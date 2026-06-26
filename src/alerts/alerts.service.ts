import {
  AlertStatus as PrismaAlertStatus,
  FloodSeverity as PrismaFloodSeverity,
  Prisma,
} from '@prisma/client';
import { DecodedIdToken } from 'firebase-admin/auth';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AlertLifecyclePolicy } from '../domain/alert-lifecycle.policy';
import { NotificationEvent } from '../common/enums/notification-event.enum';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  fromPrismaAlertStatus,
  fromPrismaSeverity,
  toPrismaAlertStatus,
  toPrismaSeverity,
} from '../common/prisma-enum.mapper';
import { AlertResponseDto } from './dto/alert-response.dto';
import { AlertStatus } from '../common/enums/alert-status.enum';
import { FloodSeverity } from '../common/enums/flood-severity.enum';

interface SyncLocationAlertInput {
  tx?: Prisma.TransactionClient;
  areaId: string;
  areaName: string;
  locationId: string;
  locationName: string;
  severity: FloodSeverity;
  sourceReadingId?: string;
  waterLevelMeters: number;
}

interface AlertOperatorAuditInput {
  action: 'alert.acknowledged' | 'alert.resolved';
  actor?: DecodedIdToken;
  alert: {
    id: string;
    area: {
      id: string;
      name: string;
    };
    location: {
      id: string;
      name: string;
    };
  };
}

@Injectable()
export class AlertsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notificationsService: NotificationsService,
  ) {}

  async listActiveAlerts(): Promise<AlertResponseDto[]> {
    const alerts = await this.prisma.alert.findMany({
      where: {
        status: {
          in: [PrismaAlertStatus.NEW, PrismaAlertStatus.ACTIVE, PrismaAlertStatus.ACKNOWLEDGED],
        },
      },
      include: {
        area: true,
        location: true,
      },
      orderBy: [{ severity: 'desc' }, { triggeredAt: 'desc' }],
    });

    return alerts.map((alert: (typeof alerts)[number]) => this.toAlertResponse(alert));
  }

  async getAlertById(id: string): Promise<AlertResponseDto> {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: {
        area: true,
        location: true,
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${id} was not found.`);
    }

    return this.toAlertResponse(alert);
  }

  async acknowledgeAlert(
    id: string,
    actor?: DecodedIdToken,
  ): Promise<AlertResponseDto> {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: {
        area: true,
        location: true,
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${id} was not found.`);
    }

    if (alert.status === PrismaAlertStatus.RESOLVED) {
      throw new BadRequestException(`Alert ${id} is already resolved and cannot be acknowledged.`);
    }

    if (alert.status === PrismaAlertStatus.ACKNOWLEDGED) {
      return this.toAlertResponse(alert);
    }

    const updatedAlert = await this.prisma.alert.update({
      where: { id },
      data: {
        status: PrismaAlertStatus.ACKNOWLEDGED,
        acknowledgedAt: alert.acknowledgedAt ?? new Date(),
      },
      include: {
        area: true,
        location: true,
      },
    });

    await this.logAlertOperatorAction({
      action: 'alert.acknowledged',
      actor,
      alert: updatedAlert,
    });

    return this.toAlertResponse(updatedAlert);
  }

  async resolveAlert(
    id: string,
    actor?: DecodedIdToken,
  ): Promise<AlertResponseDto> {
    const alert = await this.prisma.alert.findUnique({
      where: { id },
      include: {
        area: true,
        location: true,
      },
    });

    if (!alert) {
      throw new NotFoundException(`Alert ${id} was not found.`);
    }

    if (alert.status === PrismaAlertStatus.RESOLVED) {
      return this.toAlertResponse(alert);
    }

    const updatedAlert = await this.prisma.alert.update({
      where: { id },
      data: {
        status: PrismaAlertStatus.RESOLVED,
        resolvedAt: alert.resolvedAt ?? new Date(),
      },
      include: {
        area: true,
        location: true,
      },
    });

    await this.logAlertOperatorAction({
      action: 'alert.resolved',
      actor,
      alert: updatedAlert,
    });

    return this.toAlertResponse(updatedAlert);
  }

  async syncLocationAlert(input: SyncLocationAlertInput) {
    const db = input.tx ?? this.prisma;
    const existingAlert = await db.alert.findFirst({
      where: {
        locationId: input.locationId,
        status: {
          in: [PrismaAlertStatus.NEW, PrismaAlertStatus.ACTIVE, PrismaAlertStatus.ACKNOWLEDGED],
        },
      },
      orderBy: {
        triggeredAt: 'desc',
      },
    });

    const decision = AlertLifecyclePolicy.decide(
      existingAlert
        ? {
            severity: fromPrismaSeverity(existingAlert.severity),
            status: fromPrismaAlertStatus(existingAlert.status),
          }
        : null,
      input.severity,
    );

    if (!decision.createAlert && !decision.updateAlert) {
      return existingAlert;
    }

    const title = this.buildAlertTitle(input.locationName, input.severity);
    const message = this.buildAlertMessage(input.locationName, input.waterLevelMeters, input.severity);
    let alertId = existingAlert?.id;

    if (decision.createAlert) {
      const createdAlert = await db.alert.create({
        data: {
          areaId: input.areaId,
          locationId: input.locationId,
          sourceReadingId: input.sourceReadingId,
          severity: toPrismaSeverity(input.severity),
          status: toPrismaAlertStatus(decision.nextStatus ?? AlertStatus.NEW),
          title,
          message,
          triggeredAt: new Date(),
        },
      });
      alertId = createdAlert.id;
    } else if (decision.resolveAlert && existingAlert) {
      await db.alert.update({
        where: { id: existingAlert.id },
        data: {
          status: toPrismaAlertStatus(decision.nextStatus ?? AlertStatus.RESOLVED),
          resolvedAt: new Date(),
          message: `${existingAlert.message} Status kembali normal.`,
        },
      });
    } else if (decision.updateAlert && existingAlert) {
      await db.alert.update({
        where: { id: existingAlert.id },
        data: {
          status: toPrismaAlertStatus(decision.nextStatus ?? AlertStatus.ACTIVE),
          severity: toPrismaSeverity(input.severity),
          sourceReadingId: input.sourceReadingId,
          title,
          message,
          triggeredAt: new Date(),
        },
      });
    }

    if (decision.notificationEvent && alertId) {
      await this.notificationsService.queueAlertNotification({
        event: decision.notificationEvent as NotificationEvent,
        alertId,
        title,
        message,
        areaId: input.areaId,
      });
    }

    return alertId ? db.alert.findUnique({ where: { id: alertId } }) : null;
  }

  private buildAlertTitle(locationName: string, severity: FloodSeverity) {
    return `Status ${this.formatSeverityForCustomer(severity)} pada ${locationName}`;
  }

  private buildAlertMessage(
    locationName: string,
    waterLevelMeters: number,
    severity: FloodSeverity,
  ) {
    if (severity === FloodSeverity.STALE) {
      return `Data dari ${locationName} belum update. Pastikan alat menyala dan tersambung internet.`;
    }

    return `Ketinggian air di ${locationName} mencapai ${this.formatWaterLevelForCustomer(waterLevelMeters)} dengan kondisi ${this.formatSeverityForCustomer(severity)}.`;
  }

  private formatSeverityForCustomer(severity: FloodSeverity) {
    switch (severity) {
      case FloodSeverity.WARNING:
        return 'Siaga';
      case FloodSeverity.DANGER:
        return 'Waspada';
      case FloodSeverity.STALE:
        return 'Tidak update';
      case FloodSeverity.NORMAL:
      default:
        return 'Normal';
    }
  }

  private formatWaterLevelForCustomer(waterLevelMeters: number) {
    const waterLevelCentimeters = waterLevelMeters * 100;
    return `${waterLevelCentimeters.toFixed(0)} cm`;
  }

  private async logAlertOperatorAction(input: AlertOperatorAuditInput) {
    const auditPayload: Prisma.InputJsonValue = {
      alertId: input.alert.id,
      areaId: input.alert.area.id,
      areaName: input.alert.area.name,
      locationId: input.alert.location.id,
      locationName: input.alert.location.name,
      actorUid: input.actor?.uid ?? null,
      actorEmail: input.actor?.email ?? null,
      actorDisplayName: input.actor?.name ?? null,
    };

    await this.prisma.auditLog.create({
      data: {
        action: input.action,
        entityType: 'alert',
        entityId: input.alert.id,
        payload: auditPayload,
      },
    });
  }

  private toAlertResponse(
    alert: {
      id: string;
      area: {
        id: string;
        name: string;
        northLatitude: number;
        southLatitude: number;
        eastLongitude: number;
        westLongitude: number;
      };
      location: {
        id: string;
        name: string;
      };
      message: string;
      severity: PrismaFloodSeverity;
      status: PrismaAlertStatus;
      triggeredAt: Date;
      acknowledgedAt: Date | null;
      resolvedAt: Date | null;
    },
  ): AlertResponseDto {
    return {
      id: alert.id,
      area: {
        id: alert.area.id,
        name: alert.area.name,
        bounds: {
          northLatitude: alert.area.northLatitude,
          southLatitude: alert.area.southLatitude,
          eastLongitude: alert.area.eastLongitude,
          westLongitude: alert.area.westLongitude,
        },
      },
      locationId: alert.location.id,
      location: alert.location.name,
      message: alert.message,
      severity: fromPrismaSeverity(alert.severity),
      status: fromPrismaAlertStatus(alert.status),
      triggeredAt: alert.triggeredAt.toISOString(),
      acknowledgedAt: alert.acknowledgedAt?.toISOString() ?? null,
      resolvedAt: alert.resolvedAt?.toISOString() ?? null,
    };
  }
}

