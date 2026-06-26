import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../prisma/prisma.service";

type ReadingPayload = Record<string, unknown>;

@Injectable()
export class IotDashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async getReadings(limitInput?: string) {
    const limit = this.resolveLimit(limitInput);
    const [readings, total, waterStats, flowStats] = await Promise.all([
      this.prisma.sensorReading.findMany({
        take: limit,
        orderBy: { measuredAt: "desc" },
        include: {
          location: {
            select: {
              id: true,
              name: true,
              latitude: true,
              longitude: true,
              area: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.sensorReading.count(),
      this.prisma.sensorReading.aggregate({
        _min: { waterLevelMeters: true },
        _max: { waterLevelMeters: true },
        _avg: { waterLevelMeters: true },
      }),
      this.prisma.sensorReading.aggregate({
        _min: { flowRateMs: true },
        _max: { flowRateMs: true },
        _avg: { flowRateMs: true },
      }),
    ]);

    const latest = readings[0] ?? null;

    return {
      summary: {
        total,
        returned: readings.length,
        latestMeasuredAt: latest?.measuredAt ?? null,
        latestWaterLevelMeters: latest?.waterLevelMeters ?? null,
        latestFlowRateMs: latest?.flowRateMs ?? null,
        latestSeverity: latest?.severity ?? null,
        waterLevelMeters: {
          min: waterStats._min.waterLevelMeters,
          max: waterStats._max.waterLevelMeters,
          avg: waterStats._avg.waterLevelMeters,
        },
        flowRateMs: {
          min: flowStats._min.flowRateMs,
          max: flowStats._max.flowRateMs,
          avg: flowStats._avg.flowRateMs,
        },
      },
      readings: readings.map((reading) => {
        const payload = this.asPayload(reading.rawPayload);

        return {
          id: reading.id,
          locationId: reading.locationId,
          locationName: reading.location.name,
          areaId: reading.location.area.id,
          areaName: reading.location.area.name,
          latitude: reading.location.latitude,
          longitude: reading.location.longitude,
          measuredAt: reading.measuredAt,
          createdAt: reading.createdAt,
          waterLevelMeters: reading.waterLevelMeters,
          waterLevelCm: reading.waterLevelMeters * 100,
          flowRateMs: reading.flowRateMs,
          severity: reading.severity,
          pressureRaw: this.toNumber(payload.pressureRaw),
          pressureValid: this.toBoolean(payload.pressureValid),
          ultrasonicValid: this.toBoolean(payload.ultrasonicValid),
          effectiveWaterHeightCm: this.toNumber(payload.effectiveWaterHeightCm),
          ultrasonicHeightCm: this.toNumber(payload.ultrasonicHeightCm),
          ultrasonicDistanceCm: this.toNumber(payload.ultrasonicDistanceCm),
          flowRateLpm: this.toNumber(payload.flowRateLpm),
          flowPulseCount: this.toNumber(payload.flowPulseCount),
          volumeM3: this.toNumber(payload.volumeM3),
          predictionCm: this.toNumber(payload.predictionCm),
          rawPayload: payload,
        };
      }),
    };
  }

  private resolveLimit(limitInput?: string): number {
    const parsed = Number(limitInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 200;
    }

    return Math.min(Math.trunc(parsed), 1_000);
  }

  private asPayload(value: Prisma.JsonValue | null): ReadingPayload {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }

    return value as ReadingPayload;
  }

  private toNumber(value: unknown): number | null {
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }

    if (typeof value === "string") {
      const parsed = Number(value);
      return Number.isFinite(parsed) ? parsed : null;
    }

    return null;
  }

  private toBoolean(value: unknown): boolean | null {
    if (typeof value === "boolean") {
      return value;
    }

    if (value === "true") {
      return true;
    }

    if (value === "false") {
      return false;
    }

    return null;
  }
}
