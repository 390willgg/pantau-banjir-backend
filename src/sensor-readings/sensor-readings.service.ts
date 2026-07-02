import { Prisma } from "@prisma/client";
import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { FloodSeverity } from "../common/enums/flood-severity.enum";
import { toPrismaSeverity } from "../common/prisma-enum.mapper";
import { FloodClassificationService } from "../domain/flood-classification.service";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { AlertsService } from "../alerts/alerts.service";
import { DevicesService } from "../devices/devices.service";
import { IngestSensorReadingDto } from "./dto/ingest-sensor-reading.dto";
import { IngestSensorReadingResponseDto } from "./dto/ingest-sensor-reading-response.dto";

@Injectable()
export class SensorReadingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly alertsService: AlertsService,
    private readonly devicesService: DevicesService,
    private readonly floodClassificationService: FloodClassificationService,
    private readonly redis: RedisService,
  ) {}

  async ingest(
    dto: IngestSensorReadingDto,
  ): Promise<IngestSensorReadingResponseDto> {
    if (!dto.locationId && !dto.deviceId) {
      throw new BadRequestException(
        'Either locationId or deviceId must be provided.',
      );
    }

    const locationId =
      dto.locationId ??
      (await this.devicesService.resolveAssignedLocationId(dto.deviceId!));
    const location = await this.prisma.location.findUnique({
      where: { id: locationId },
      include: { area: true },
    });

    if (!location) {
      throw new NotFoundException(`Location ${locationId} was not found.`);
    }

    const measuredAt = new Date(dto.measuredAt);
    const dedupeKey = `${locationId}:${measuredAt.toISOString()}`;
    const existingReading = await this.prisma.sensorReading.findUnique({
      where: { dedupeKey },
    });

    if (existingReading) {
      return {
        readingId: existingReading.id,
        locationId,
        severity: existingReading.severity.toLowerCase() as FloodSeverity,
        deduplicated: true,
        alertId: null,
      };
    }

    const severity = this.floodClassificationService.classify({
      waterLevelMeters: dto.waterLevelMeters,
      measuredAt,
      warningThreshold: location.warningThreshold,
      dangerThreshold: location.dangerThreshold,
      staleReadingMinutes: Number(process.env.STALE_READING_MINUTES ?? 15),
    });

    const rawPayload: Prisma.InputJsonValue | undefined = dto.rawPayload
      ? ({ ...dto.rawPayload } as Prisma.InputJsonValue)
      : undefined;

    const result = await this.prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const reading = await tx.sensorReading.create({
          data: {
            locationId,
            measuredAt,
            waterLevelMeters: dto.waterLevelMeters,
            flowRateMs: dto.flowRateMs,
            severity: toPrismaSeverity(severity),
            dedupeKey,
            rawPayload,
          },
        });

        await tx.location.update({
          where: { id: locationId },
          data: {
            currentSeverity: toPrismaSeverity(severity),
            currentWaterLevel: dto.waterLevelMeters,
            currentFlowRate: dto.flowRateMs,
            lastReadingAt: measuredAt,
            invalidCoordinateCount:
              location.latitude == null || location.longitude == null
                ? { increment: 1 }
                : undefined,
          },
        });

        const alert = await this.alertsService.syncLocationAlert({
          tx,
          areaId: location.areaId,
          areaName: location.area.name,
          locationId: location.id,
          locationName: location.name,
          severity,
          sourceReadingId: reading.id,
          waterLevelMeters: dto.waterLevelMeters,
        });

        const auditPayload: Prisma.InputJsonValue = rawPayload ?? {
          locationId,
          deviceId: dto.deviceId,
          measuredAt: dto.measuredAt,
          waterLevelMeters: dto.waterLevelMeters,
          flowRateMs: dto.flowRateMs,
        };

        await tx.auditLog.create({
          data: {
            action: "sensor-reading.ingested",
            entityType: "sensor_reading",
            entityId: reading.id,
            payload: auditPayload,
          },
        });

        return {
          readingId: reading.id,
          alertId: alert?.id ?? null,
        };
      },
    );

    await this.redis.delete("water-level:overview");

    return {
      readingId: result.readingId,
      locationId,
      severity,
      deduplicated: false,
      alertId: result.alertId,
    };
  }
}
