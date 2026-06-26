import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import { RedisService } from "../redis/redis.service";
import { fromPrismaSeverity } from "../common/prisma-enum.mapper";
import { WaterLevelOverviewResponseDto } from "./dto/water-level-overview-response.dto";

@Injectable()
export class WaterLevelService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly redis: RedisService,
  ) {}

  async getOverview(): Promise<WaterLevelOverviewResponseDto> {
    const cacheKey = "water-level:overview";
    const cached =
      await this.redis.getJson<WaterLevelOverviewResponseDto>(cacheKey);

    if (cached) {
      return cached;
    }

    const locations = await this.prisma.location.findMany({
      where: { isActive: true },
      orderBy: [{ currentSeverity: "desc" }, { currentWaterLevel: "desc" }],
    });
    const monitoredAreaCount = new Set(
      locations.map((location) => location.areaId),
    ).size;

    const payload: WaterLevelOverviewResponseDto = {
      activeDevices: locations.length,
      monitoredAreas: monitoredAreaCount,
      invalidCoordinateCount: locations.filter(
        (location) => location.latitude == null || location.longitude == null,
      ).length,
      waterLevels: locations.map((location) => ({
        sensorName: location.name,
        waterLevelMeters: location.currentWaterLevel,
        fillPercent:
          location.maxCapacityMeters > 0
            ? location.currentWaterLevel / location.maxCapacityMeters
            : 0,
        severity: fromPrismaSeverity(location.currentSeverity),
      })),
    };

    await this.redis.setJson(cacheKey, payload, 30);
    return payload;
  }
}
