import { Prisma, FloodSeverity as PrismaFloodSeverity } from '@prisma/client';
import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { fromPrismaSeverity } from '../common/prisma-enum.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { RedisService } from '../redis/redis.service';
import { LocationStatusDto } from './dto/location-status.dto';
import { InstallLocationDto } from './dto/install-location.dto';
import { CreateLocationDto } from './dto/create-location.dto';

@Injectable()
export class LocationsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async listLocations(): Promise<LocationStatusDto[]> {
    const cacheKey = 'locations:list';
    const cached = await this.redis.getJson<LocationStatusDto[]>(cacheKey);

    if (cached) {
      return cached;
    }

    const locations = await this.prisma.location.findMany({
      include: {
        area: true,
        readings: {
          take: 1,
          orderBy: { measuredAt: 'desc' },
          select: { rawPayload: true },
        },
      },
      orderBy: [{ currentSeverity: 'desc' }, { updatedAt: 'desc' }],
    });

    const payload = locations.map((location: (typeof locations)[number]) => this.toDto(location));
    await this.redis.setJson(cacheKey, payload, 30);
    return payload;
  }

  async getLocationStatus(id: string): Promise<LocationStatusDto> {
    const location = await this.prisma.location.findUnique({
      where: { id },
      include: {
        area: true,
        readings: {
          take: 1,
          orderBy: { measuredAt: 'desc' },
          select: { rawPayload: true },
        },
      },
    });

    if (!location) {
      throw new NotFoundException(`Location ${id} was not found.`);
    }

    return this.toDto(location);
  }

  async createLocation(dto: CreateLocationDto): Promise<LocationStatusDto> {
    const areaId = dto.areaId.trim();
    const areaName = dto.areaName?.trim();

    if (areaName) {
      await this.upsertManualArea({
        id: areaId,
        name: areaName,
        latitude: dto.latitude,
        longitude: dto.longitude,
      });
    }

    const location = await this.prisma.location
      .create({
        data: {
          id: dto.id.trim(),
          name: dto.name.trim(),
          areaId,
          latitude: dto.latitude,
          longitude: dto.longitude,
          maxCapacityMeters: dto.maxCapacityMeters ?? 0.25,
          warningThreshold: dto.warningThreshold ?? 0.1,
          dangerThreshold: dto.dangerThreshold ?? 0.15,
          invalidCoordinateCount:
            dto.latitude == null || dto.longitude == null ? 1 : 0,
        },
        include: {
          area: true,
          readings: {
            take: 1,
            orderBy: { measuredAt: 'desc' },
            select: { rawPayload: true },
          },
        },
      })
      .catch((error: unknown) => {
        const errorCode =
          typeof error === 'object' && error != null && 'code' in error
            ? String((error as { code?: unknown }).code)
            : null;

        if (errorCode === 'P2002') {
          throw new ConflictException(`Location ${dto.id} already exists.`);
        }

        if (errorCode === 'P2003') {
          throw new NotFoundException(`Area ${areaId} was not found.`);
        }

        throw error;
      });

    await Promise.all([
      this.redis.delete('locations:list'),
      this.redis.delete('water-level:overview'),
    ]);

    return this.toDto(location);
  }

  async installLocation(id: string, dto: InstallLocationDto): Promise<LocationStatusDto> {
    const location = await this.prisma.location.update({
      where: { id },
      data: {
        latitude: dto.latitude,
        longitude: dto.longitude,
        invalidCoordinateCount: 0,
      },
      include: {
        area: true,
        readings: {
          take: 1,
          orderBy: { measuredAt: 'desc' },
          select: { rawPayload: true },
        },
      },
    }).catch((error: unknown) => {
      const errorCode =
        typeof error === 'object' && error != null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : null;

      if (errorCode == 'P2025') {
        throw new NotFoundException(`Location ${id} was not found.`);
      }

      throw error;
    });

    await Promise.all([
      this.redis.delete('locations:list'),
      this.redis.delete('water-level:overview'),
    ]);

    return this.toDto(location);
  }

  async deleteLocation(id: string): Promise<{ id: string; deleted: true }> {
    await this.prisma.location.findUniqueOrThrow({
      where: { id },
      select: { id: true },
    }).catch((error: unknown) => {
      const errorCode =
        typeof error === 'object' && error != null && 'code' in error
          ? String((error as { code?: unknown }).code)
          : null;

      if (errorCode === 'P2025') {
        throw new NotFoundException(`Location ${id} was not found.`);
      }

      throw error;
    });

    await this.prisma.$transaction(async (tx) => {
      await tx.device.updateMany({
        where: { assignedLocationId: id },
        data: { assignedLocationId: null },
      });
      await tx.alert.deleteMany({ where: { locationId: id } });
      await tx.sensorReading.deleteMany({ where: { locationId: id } });
      await tx.location.delete({ where: { id } });
    });

    await Promise.all([
      this.redis.delete('locations:list'),
      this.redis.delete('water-level:overview'),
    ]);

    return { id, deleted: true };
  }

  private toDto(location: {
    id: string;
    name: string;
    latitude: number | null;
    longitude: number | null;
    currentWaterLevel: number;
    currentFlowRate: number;
    currentSeverity: PrismaFloodSeverity;
    lastReadingAt: Date | null;
    warningThreshold: number;
    dangerThreshold: number;
    area: {
      id: string;
      name: string;
      northLatitude: number;
      southLatitude: number;
      eastLongitude: number;
      westLongitude: number;
    };
    readings: Array<{
      rawPayload: Prisma.JsonValue | null;
    }>;
  }): LocationStatusDto {
    return {
      id: location.id,
      name: location.name,
      area: {
        id: location.area.id,
        name: location.area.name,
        bounds: {
          northLatitude: location.area.northLatitude,
          southLatitude: location.area.southLatitude,
          eastLongitude: location.area.eastLongitude,
          westLongitude: location.area.westLongitude,
        },
      },
      latitude: location.latitude,
      longitude: location.longitude,
      waterLevelMeters: location.currentWaterLevel,
      flowRateMs: location.currentFlowRate,
      severity: fromPrismaSeverity(location.currentSeverity),
      lastUpdated: location.lastReadingAt?.toISOString() ?? null,
      warningThreshold: location.warningThreshold,
      dangerThreshold: location.dangerThreshold,
      rawPayload: this.toRawPayload(location.readings[0]?.rawPayload),
    };
  }

  private toRawPayload(payload: Prisma.JsonValue | null | undefined): Record<string, unknown> | null {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return null;
    }

    return payload as Record<string, unknown>;
  }

  private async upsertManualArea(input: {
    id: string;
    name: string;
    latitude?: number;
    longitude?: number;
  }): Promise<void> {
    const latitude = input.latitude ?? 0;
    const longitude = input.longitude ?? 0;
    const span = 0.025;

    await this.prisma.area.upsert({
      where: { id: input.id },
      update: { name: input.name },
      create: {
        id: input.id,
        name: input.name,
        northLatitude: latitude + span,
        southLatitude: latitude - span,
        eastLongitude: longitude + span,
        westLongitude: longitude - span,
      },
    });
  }
}


