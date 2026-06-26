import { BadRequestException, NotFoundException } from '@nestjs/common';
import { AlertStatus as PrismaAlertStatus, FloodSeverity as PrismaFloodSeverity } from '@prisma/client';
import { AlertsService } from '../src/alerts/alerts.service';

describe('AlertsService', () => {
  const baseAlert = {
    id: 'alert-1',
    area: {
      id: 'jakarta-utara',
      name: 'Jakarta Utara',
      northLatitude: -6.09,
      southLatitude: -6.18,
      eastLongitude: 106.935,
      westLongitude: 106.76,
    },
    location: {
      id: 'A-1',
      name: 'Sensor A-1',
    },
    message: 'Ketinggian air di Sensor A-1 mencapai 3.4m dengan status danger.',
    severity: PrismaFloodSeverity.DANGER,
    status: PrismaAlertStatus.NEW,
    triggeredAt: new Date('2026-03-14T08:37:58.990Z'),
    acknowledgedAt: null,
    resolvedAt: null,
  };

  const createService = (overrides?: {
    findUnique?: jest.Mock;
    update?: jest.Mock;
    auditCreate?: jest.Mock;
  }) => {
    const prisma = {
      alert: {
        findMany: jest.fn(),
        findUnique: overrides?.findUnique ?? jest.fn(),
        update: overrides?.update ?? jest.fn(),
      },
      auditLog: {
        create: overrides?.auditCreate ?? jest.fn(),
      },
    };

    const notificationsService = {
      queueAlertNotification: jest.fn(),
    };

    return {
      service: new AlertsService(prisma as never, notificationsService as never),
      prisma,
    };
  };

  it('acknowledges a new alert', async () => {
    const updatedAlert = {
      ...baseAlert,
      status: PrismaAlertStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date('2026-03-14T08:40:00.000Z'),
    };
    const findUnique = jest.fn().mockResolvedValue(baseAlert);
    const update = jest.fn().mockResolvedValue(updatedAlert);
    const auditCreate = jest.fn().mockResolvedValue({});
    const { service, prisma } = createService({ findUnique, update, auditCreate });

    const result = await service.acknowledgeAlert(baseAlert.id);

    expect(prisma.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: baseAlert.id },
        data: expect.objectContaining({
          status: PrismaAlertStatus.ACKNOWLEDGED,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'alert.acknowledged',
          entityType: 'alert',
          entityId: baseAlert.id,
          payload: expect.objectContaining({
            alertId: baseAlert.id,
            areaId: baseAlert.area.id,
            locationId: baseAlert.location.id,
            actorUid: null,
          }),
        }),
      }),
    );
    expect(result.status).toBe('acknowledged');
    expect(result.locationId).toBe(baseAlert.location.id);
    expect(result.acknowledgedAt).toBe(updatedAlert.acknowledgedAt.toISOString());
  });

  it('rejects acknowledging a resolved alert', async () => {
    const findUnique = jest.fn().mockResolvedValue({
      ...baseAlert,
      status: PrismaAlertStatus.RESOLVED,
      resolvedAt: new Date('2026-03-14T08:45:00.000Z'),
    });
    const { service } = createService({ findUnique });

    await expect(service.acknowledgeAlert(baseAlert.id)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('resolves an active alert', async () => {
    const updatedAlert = {
      ...baseAlert,
      status: PrismaAlertStatus.RESOLVED,
      resolvedAt: new Date('2026-03-14T08:50:00.000Z'),
    };
    const findUnique = jest.fn().mockResolvedValue({
      ...baseAlert,
      status: PrismaAlertStatus.ACTIVE,
    });
    const update = jest.fn().mockResolvedValue(updatedAlert);
    const auditCreate = jest.fn().mockResolvedValue({});
    const { service, prisma } = createService({ findUnique, update, auditCreate });

    const result = await service.resolveAlert(baseAlert.id);

    expect(prisma.alert.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: baseAlert.id },
        data: expect.objectContaining({
          status: PrismaAlertStatus.RESOLVED,
        }),
      }),
    );
    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'alert.resolved',
          entityId: baseAlert.id,
        }),
      }),
    );
    expect(result.status).toBe('resolved');
    expect(result.locationId).toBe(baseAlert.location.id);
    expect(result.resolvedAt).toBe(updatedAlert.resolvedAt.toISOString());
  });

  it('records actor identity when an authenticated operator acknowledges an alert', async () => {
    const updatedAlert = {
      ...baseAlert,
      status: PrismaAlertStatus.ACKNOWLEDGED,
      acknowledgedAt: new Date('2026-03-14T08:40:00.000Z'),
    };
    const findUnique = jest.fn().mockResolvedValue(baseAlert);
    const update = jest.fn().mockResolvedValue(updatedAlert);
    const auditCreate = jest.fn().mockResolvedValue({});
    const { service, prisma } = createService({ findUnique, update, auditCreate });

    await service.acknowledgeAlert(baseAlert.id, {
      uid: 'firebase-user-1',
      email: 'operator@example.com',
      name: 'Operator Satu',
    } as never);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          payload: expect.objectContaining({
            actorUid: 'firebase-user-1',
            actorEmail: 'operator@example.com',
            actorDisplayName: 'Operator Satu',
          }),
        }),
      }),
    );
  });

  it('records actor identity when an authenticated operator resolves an alert', async () => {
    const updatedAlert = {
      ...baseAlert,
      status: PrismaAlertStatus.RESOLVED,
      resolvedAt: new Date('2026-03-14T08:50:00.000Z'),
    };
    const findUnique = jest.fn().mockResolvedValue({
      ...baseAlert,
      status: PrismaAlertStatus.ACTIVE,
    });
    const update = jest.fn().mockResolvedValue(updatedAlert);
    const auditCreate = jest.fn().mockResolvedValue({});
    const { service, prisma } = createService({ findUnique, update, auditCreate });

    await service.resolveAlert(baseAlert.id, {
      uid: 'firebase-user-2',
      email: 'resolver@example.com',
      name: 'Operator Dua',
    } as never);

    expect(prisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: 'alert.resolved',
          payload: expect.objectContaining({
            actorUid: 'firebase-user-2',
            actorEmail: 'resolver@example.com',
            actorDisplayName: 'Operator Dua',
          }),
        }),
      }),
    );
  });

  it('throws when the alert does not exist', async () => {
    const findUnique = jest.fn().mockResolvedValue(null);
    const { service } = createService({ findUnique });

    await expect(service.getAlertById('missing-alert')).rejects.toBeInstanceOf(NotFoundException);
  });
});
