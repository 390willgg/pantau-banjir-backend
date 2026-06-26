import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { MqttIngestionService } from '../mqtt-ingestion/mqtt-ingestion.service';

@Injectable()
export class HealthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mqttIngestionService: MqttIngestionService,
  ) {}

  async getHealth() {
    let databaseStatus = 'down';
    let databaseError: string | null = null;
    let latestReadingAt: string | null = null;
    let latestReadingAgeSeconds: number | null = null;
    let sensors: Array<{
      locationId: string;
      locationName: string;
      lastReadingAt: string | null;
      lastReadingAgeSeconds: number | null;
      severity: string;
    }> = [];

    try {
      await this.prisma.$queryRaw`SELECT 1`;
      databaseStatus = 'up';

      const locations = await this.prisma.location.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          lastReadingAt: true,
          currentSeverity: true,
        },
        orderBy: { name: 'asc' },
      });

      const now = Date.now();
      sensors = locations.map((location) => ({
        locationId: location.id,
        locationName: location.name,
        lastReadingAt: location.lastReadingAt?.toISOString() ?? null,
        lastReadingAgeSeconds: location.lastReadingAt
          ? Math.max(0, Math.floor((now - location.lastReadingAt.getTime()) / 1000))
          : null,
        severity: location.currentSeverity.toLowerCase(),
      }));

      const latestReading = locations
        .map((location) => location.lastReadingAt)
        .filter((value): value is Date => value instanceof Date)
        .sort((left, right) => right.getTime() - left.getTime())[0];

      latestReadingAt = latestReading?.toISOString() ?? null;
      latestReadingAgeSeconds = latestReading
        ? Math.max(0, Math.floor((Date.now() - latestReading.getTime()) / 1000))
        : null;
    } catch (error) {
      databaseError = error instanceof Error ? error.message : 'Unknown database error.';
    }

    const mqtt = this.mqttIngestionService.getStatus();
    const mqttHealthy = !mqtt.enabled || mqtt.connectionState === 'connected';
    const status = databaseStatus === 'up' && mqttHealthy ? 'ok' : 'degraded';

    return {
      status,
      timestamp: new Date().toISOString(),
      services: {
        database: {
          status: databaseStatus,
          error: databaseError,
        },
        mqtt,
      },
      ingestion: {
        latestReadingAt,
        latestReadingAgeSeconds,
        sensors,
      },
    };
  }
}
