import { Prisma } from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { PrismaService } from "../prisma/prisma.service";
import {
  ChartSeriesBucket,
  ChartQueryDto,
  ChartSeriesRange,
  defaultChartSeriesLimit,
  maxChartSeriesLimit,
} from "./dto/chart-query.dto";
import { ChartSensorSeriesDto } from "./dto/chart-sensor-series.dto";

@Injectable()
export class ChartService {
  constructor(private readonly prisma: PrismaService) {}

  async getArchiveMonths() {
    const readings = await this.prisma.sensorReading.findMany({
      orderBy: { measuredAt: "desc" },
      select: { measuredAt: true },
    });
    const counts = new Map<string, { month: Date; count: number }>();

    for (const reading of readings) {
      const month = new Date(
        reading.measuredAt.getFullYear(),
        reading.measuredAt.getMonth(),
      );
      const key = this.formatArchiveMonthValue(month);
      const existing = counts.get(key) ?? { month, count: 0 };
      existing.count += 1;
      counts.set(key, existing);
    }

    return [...counts.entries()].map(([value, entry]) => ({
      value,
      label: this.formatArchiveMonthLabel(entry.month),
      from: entry.month.toISOString(),
      to: new Date(
        entry.month.getFullYear(),
        entry.month.getMonth() + 1,
      ).toISOString(),
      readingCount: entry.count,
    }));
  }

  async getSensorSeries(
    query: ChartQueryDto = {},
  ): Promise<ChartSensorSeriesDto[]> {
    const range = this.resolveRange(query.range);
    const limit = this.resolveLimit(query.limit);
    const bucket = this.resolveBucket(query.bucket, range);
    const { start: rangeStart, end: rangeEnd } = this.resolveWindow(
      query,
      range,
    );
    const locations = await this.prisma.location.findMany({
      where: { isActive: true },
      include: {
        readings: {
          ...(bucket === "raw" ? { take: limit } : {}),
          where: {
            measuredAt: {
              gte: rangeStart,
              ...(rangeEnd ? { lt: rangeEnd } : {}),
            },
          },
          orderBy:
            bucket === "raw" ? { measuredAt: "desc" } : { measuredAt: "asc" },
          select: {
            measuredAt: true,
            waterLevelMeters: true,
            flowRateMs: true,
            rawPayload: true,
          },
        },
      },
      orderBy: [{ currentSeverity: "desc" }, { name: "asc" }],
    });

    return locations.map((location) => {
      const readings =
        bucket === "raw" ? [...location.readings].reverse() : location.readings;
      const effectiveReadings = this.buildChartReadings(
        readings,
        range,
        bucket,
      );

      const latestRawReading = readings.at(-1);
      const fallbackMeasuredAt = location.lastReadingAt ?? location.updatedAt;
      const latest = latestRawReading ?? {
        measuredAt: fallbackMeasuredAt,
        waterLevelMeters: location.currentWaterLevel,
        flowRateMs: location.currentFlowRate,
        rawPayload: null,
      };
      const currentWaterLevel = latest.waterLevelMeters;
      const currentFlowRate = latest.flowRateMs;
      const currentVolume = this.readVolume(
        latest.rawPayload,
        currentWaterLevel,
      );

      return {
        sensorId: location.id,
        sensorName: location.name,
        currentWaterLevel,
        currentFlowRate,
        currentVolume,
        lastReadingAt: location.lastReadingAt?.toISOString() ?? null,
        waterLevelData: effectiveReadings.map((reading) => ({
          label: reading.label,
          value: reading.waterLevelMeters,
          bucketStart: reading.bucketStart?.toISOString(),
          bucketEnd: reading.bucketEnd?.toISOString(),
          details: reading.waterLevelDetails,
        })),
        flowRateData: effectiveReadings.map((reading) => ({
          label: reading.label,
          value: reading.flowRateMs,
          bucketStart: reading.bucketStart?.toISOString(),
          bucketEnd: reading.bucketEnd?.toISOString(),
          details: reading.flowRateDetails,
        })),
        volumeData: effectiveReadings.map((reading) => ({
          label: reading.label,
          value: reading.volumeM3,
          bucketStart: reading.bucketStart?.toISOString(),
          bucketEnd: reading.bucketEnd?.toISOString(),
          details: reading.volumeDetails,
        })),
      };
    });
  }

  private resolveLimit(limitInput?: string): number {
    const parsed = Number(limitInput);
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return defaultChartSeriesLimit;
    }

    return Math.min(Math.trunc(parsed), maxChartSeriesLimit);
  }

  private resolveWindow(
    query: ChartQueryDto,
    range: ChartSeriesRange,
  ): { start: Date; end?: Date } {
    const customStart = this.parseDate(query.from);
    const customEnd = this.parseDate(query.to);
    if (customStart && customEnd && customStart < customEnd) {
      return { start: customStart, end: customEnd };
    }

    return { start: this.resolveRangeStart(range) };
  }

  private resolveRangeStart(range: ChartSeriesRange): Date {
    const now = new Date();
    const durationMs =
      range === "month" || range === "archive"
        ? 30 * 24 * 60 * 60 * 1000
        : range === "week"
          ? 7 * 24 * 60 * 60 * 1000
          : 24 * 60 * 60 * 1000;

    return new Date(now.getTime() - durationMs);
  }

  private resolveRange(rangeInput?: string): ChartSeriesRange {
    const normalizedRange = rangeInput?.trim().toLowerCase();
    if (
      normalizedRange === "week" ||
      normalizedRange === "month" ||
      normalizedRange === "archive"
    ) {
      return normalizedRange;
    }

    return "day";
  }

  private resolveBucket(
    bucketInput: string | undefined,
    range: ChartSeriesRange,
  ): ChartSeriesBucket {
    const normalizedBucket = bucketInput?.trim().toLowerCase();
    if (
      normalizedBucket === "raw" ||
      normalizedBucket === "hour" ||
      normalizedBucket === "day"
    ) {
      return normalizedBucket;
    }

    return range === "day" ? "raw" : "day";
  }

  private buildChartReadings(
    readings: Array<{
      measuredAt: Date;
      waterLevelMeters: number;
      flowRateMs: number;
      rawPayload: Prisma.JsonValue | null;
    }>,
    range: ChartSeriesRange,
    bucket: ChartSeriesBucket,
  ): Array<{
    label: string;
    measuredAt: Date;
    waterLevelMeters: number;
    flowRateMs: number;
    volumeM3: number;
    bucketStart?: Date;
    bucketEnd?: Date;
    waterLevelDetails?: Array<{ label: string; value: number }>;
    flowRateDetails?: Array<{ label: string; value: number }>;
    volumeDetails?: Array<{ label: string; value: number }>;
  }> {
    if (bucket === "raw") {
      return readings.map((reading) => ({
        label: this.formatPointLabel(reading.measuredAt, range, bucket),
        measuredAt: reading.measuredAt,
        waterLevelMeters: reading.waterLevelMeters,
        flowRateMs: reading.flowRateMs,
        volumeM3: this.readVolume(reading.rawPayload, reading.waterLevelMeters),
      }));
    }

    const buckets = new Map<
      string,
      {
        label: string;
        measuredAt: Date;
        waterSum: number;
        flowSum: number;
        volumeSum: number;
        count: number;
        readings: Array<{
          measuredAt: Date;
          waterLevelMeters: number;
          flowRateMs: number;
          volumeM3: number;
        }>;
      }
    >();

    for (const reading of readings) {
      const bucketDate =
        bucket === "hour"
          ? this.hourOnly(reading.measuredAt)
          : this.dateOnly(reading.measuredAt);
      const key = bucketDate.toISOString();
      const volume = this.readVolume(
        reading.rawPayload,
        reading.waterLevelMeters,
      );
      const existing = buckets.get(key) ?? {
        label: this.formatPointLabel(bucketDate, range, bucket),
        measuredAt: bucketDate,
        waterSum: 0,
        flowSum: 0,
        volumeSum: 0,
        count: 0,
        readings: [],
      };

      existing.waterSum += reading.waterLevelMeters;
      existing.flowSum += reading.flowRateMs;
      existing.volumeSum += volume;
      existing.count += 1;
      existing.readings.push({
        measuredAt: reading.measuredAt,
        waterLevelMeters: reading.waterLevelMeters,
        flowRateMs: reading.flowRateMs,
        volumeM3: volume,
      });
      buckets.set(key, existing);
    }

    return [...buckets.values()].map((entry) => ({
      label: entry.label,
      measuredAt: entry.measuredAt,
      waterLevelMeters: this.roundMetric(entry.waterSum / entry.count),
      flowRateMs: this.roundMetric(entry.flowSum / entry.count),
      volumeM3: this.roundMetric(entry.volumeSum / entry.count),
      bucketStart: entry.measuredAt,
      bucketEnd: new Date(
        entry.measuredAt.getTime() +
          (bucket === "hour" ? 60 * 60 * 1000 : 24 * 60 * 60 * 1000),
      ),
      waterLevelDetails: this.buildHourlyDetails(
        entry.readings,
        (reading) => reading.waterLevelMeters,
      ),
      flowRateDetails: this.buildHourlyDetails(
        entry.readings,
        (reading) => reading.flowRateMs,
      ),
      volumeDetails: this.buildHourlyDetails(
        entry.readings,
        (reading) => reading.volumeM3,
      ),
    }));
  }

  private buildHourlyDetails<T extends { measuredAt: Date }>(
    readings: T[],
    selectValue: (reading: T) => number,
  ): Array<{ label: string; value: number }> {
    const buckets = new Map<string, { sum: number; count: number }>();

    for (const reading of readings) {
      const hour = reading.measuredAt.getHours().toString().padStart(2, "0");
      const key = `${hour}:00`;
      const existing = buckets.get(key) ?? { sum: 0, count: 0 };
      existing.sum += selectValue(reading);
      existing.count += 1;
      buckets.set(key, existing);
    }

    return [...buckets.entries()].map(([label, bucket]) => ({
      label,
      value: this.roundMetric(bucket.sum / bucket.count),
    }));
  }

  private dateOnly(value: Date): Date {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }

  private hourOnly(value: Date): Date {
    return new Date(
      value.getFullYear(),
      value.getMonth(),
      value.getDate(),
      value.getHours(),
    );
  }

  private formatPointLabel(
    measuredAt: Date,
    range: ChartSeriesRange,
    bucket: ChartSeriesBucket,
  ): string {
    if (bucket === "hour") {
      const hours = measuredAt.getHours().toString().padStart(2, "0");
      return `${hours}:00`;
    }

    if (
      bucket === "day" ||
      range === "week" ||
      range === "month" ||
      range === "archive"
    ) {
      const monthNames = [
        "Jan",
        "Feb",
        "Mar",
        "Apr",
        "Mei",
        "Jun",
        "Jul",
        "Agu",
        "Sep",
        "Okt",
        "Nov",
        "Des",
      ];

      return `${measuredAt.getDate()} ${monthNames[measuredAt.getMonth()]}`;
    }

    const hours = measuredAt.getHours().toString().padStart(2, "0");
    const minutes = measuredAt.getMinutes().toString().padStart(2, "0");
    return `${hours}:${minutes}`;
  }

  private readVolume(
    rawPayload: Prisma.JsonValue | null,
    waterLevel: number,
  ): number {
    const payload = this.asJsonRecord(rawPayload);
    return (
      this.toNumber(payload?.volumeM3) ??
      this.toNumber(payload?.volumeCubicMeters) ??
      this.toNumber(payload?.volume) ??
      waterLevel * 325
    );
  }

  private asJsonRecord(
    value: Prisma.JsonValue | null | undefined,
  ): Record<string, unknown> | null {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return null;
    }

    return value as Record<string, unknown>;
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

  private roundMetric(value: number): number {
    return Number(value.toFixed(6));
  }

  private parseDate(value: string | undefined): Date | null {
    if (!value) {
      return null;
    }

    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private formatArchiveMonthValue(month: Date): string {
    return `${month.getFullYear()}-${(month.getMonth() + 1)
      .toString()
      .padStart(2, "0")}`;
  }

  private formatArchiveMonthLabel(month: Date): string {
    const monthNames = [
      "Januari",
      "Februari",
      "Maret",
      "April",
      "Mei",
      "Juni",
      "Juli",
      "Agustus",
      "September",
      "Oktober",
      "November",
      "Desember",
    ];

    return `${monthNames[month.getMonth()]} ${month.getFullYear()}`;
  }
}
