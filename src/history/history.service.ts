import { FloodSeverity as PrismaFloodSeverity, Prisma } from "@prisma/client";
import { Injectable } from "@nestjs/common";
import { fromPrismaSeverity } from "../common/prisma-enum.mapper";
import { PrismaService } from "../prisma/prisma.service";
import {
  HistoryEntryResponseDto,
  HistoryEntryType,
} from "./dto/history-entry-response.dto";
import {
  defaultHistoryFeedLimit,
  defaultHistoryWindowDays,
  HistoryQueryDto,
  maxHistoryFeedLimit,
  maxHistoryWindowDays,
} from "./dto/history-query.dto";
const trackedOperatorActions = [
  "alert.acknowledged",
  "alert.resolved",
] as const;

type TrackedOperatorAction = (typeof trackedOperatorActions)[number];

@Injectable()
export class HistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async listHistory(
    query: HistoryQueryDto = {},
  ): Promise<HistoryEntryResponseDto[]> {
    const limit = this.resolveLimit(query.limit);
    const windowStart = this.resolveWindowStart(query.days);

    const [readings, alerts, reports, auditLogs] = await Promise.all([
      this.prisma.sensorReading.findMany({
        take: limit,
        where: {
          measuredAt: {
            gte: windowStart,
          },
        },
        include: {
          location: {
            include: {
              area: true,
            },
          },
        },
        orderBy: { measuredAt: "desc" },
      }),
      this.prisma.alert.findMany({
        take: limit,
        where: {
          OR: [
            { triggeredAt: { gte: windowStart } },
            { acknowledgedAt: { gte: windowStart } },
            { resolvedAt: { gte: windowStart } },
            { updatedAt: { gte: windowStart } },
          ],
        },
        include: {
          location: true,
          area: true,
        },
        orderBy: [{ updatedAt: "desc" }, { triggeredAt: "desc" }],
      }),
      this.prisma.report.findMany({
        take: limit,
        where: {
          createdAt: {
            gte: windowStart,
          },
        },
        include: {
          area: true,
        },
        orderBy: { createdAt: "desc" },
      }),
      this.prisma.auditLog.findMany({
        take: limit,
        where: {
          entityType: "alert",
          createdAt: {
            gte: windowStart,
          },
          action: {
            in: [...trackedOperatorActions],
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);

    const alertById = new Map(
      alerts.map((alert) => [alert.id, alert] as const),
    );
    const operatorActionEntryIds = new Set<string>();
    const operatorActionEntries = auditLogs
      .map((auditLog) =>
        this.toOperatorActionEntry(auditLog, alertById.get(auditLog.entityId)),
      )
      .flatMap((entry) => {
        if (!entry) {
          return [];
        }

        operatorActionEntryIds.add(entry.id);
        return [entry];
      });

    return [
      ...readings.map((reading) => this.toReadingEntry(reading)),
      ...alerts.map((alert) => this.toTriggeredAlertEntry(alert)),
      ...reports.map((report) => this.toReportEntry(report)),
      ...operatorActionEntries,
      ...alerts.flatMap((alert) =>
        this.toSyntheticOperatorActionEntries(alert, operatorActionEntryIds),
      ),
    ]
      .sort(
        (left, right) =>
          new Date(right.recordedAt).getTime() -
          new Date(left.recordedAt).getTime(),
      )
      .slice(0, limit);
  }

  private resolveLimit(limitQuery?: string): number {
    const configuredLimit = Number(
      process.env.HISTORY_FEED_LIMIT ?? defaultHistoryFeedLimit,
    );
    const requestedLimit =
      limitQuery === undefined || limitQuery.trim() === ""
        ? configuredLimit
        : Number(limitQuery);

    if (!Number.isFinite(requestedLimit) || requestedLimit <= 0) {
      return defaultHistoryFeedLimit;
    }

    return Math.min(Math.floor(requestedLimit), maxHistoryFeedLimit);
  }

  private resolveWindowStart(daysQuery?: string): Date {
    const configuredDays = Number(
      process.env.HISTORY_FEED_WINDOW_DAYS ?? defaultHistoryWindowDays,
    );
    const requestedDays =
      daysQuery === undefined || daysQuery.trim() === ""
        ? configuredDays
        : Number(daysQuery);
    const safeDays =
      !Number.isFinite(requestedDays) || requestedDays <= 0
        ? defaultHistoryWindowDays
        : Math.min(Math.floor(requestedDays), maxHistoryWindowDays);

    const windowStart = new Date();
    windowStart.setUTCDate(windowStart.getUTCDate() - safeDays);
    return windowStart;
  }

  private toReadingEntry(reading: {
    locationId: string;
    measuredAt: Date;
    waterLevelMeters: number;
    flowRateMs: number;
    severity: PrismaFloodSeverity;
    rawPayload: Prisma.JsonValue | null;
    location: {
      name: string;
      area: {
        name: string;
      };
    };
  }): HistoryEntryResponseDto {
    const severity = fromPrismaSeverity(reading.severity);

    return {
      id: `reading:${reading.locationId}:${reading.measuredAt.toISOString()}`,
      type: HistoryEntryType.READING,
      title: this.buildReadingTitle(severity),
      description: this.buildReadingDescription({
        waterLevelMeters: reading.waterLevelMeters,
        flowRateMs: reading.flowRateMs,
        severity,
        rawPayload: this.asJsonRecord(reading.rawPayload),
      }),
      recordedAt: reading.measuredAt.toISOString(),
      contextLabel: this.buildContextLabel(
        reading.location.name,
        reading.location.area.name,
        "Sensor",
      ),
      areaName: reading.location.area.name,
      locationId: reading.locationId,
      locationName: reading.location.name,
    };
  }

  private toTriggeredAlertEntry(alert: {
    id: string;
    areaId: string;
    locationId: string;
    location: {
      name: string;
    };
    area: {
      name: string;
    };
    message: string;
    severity: PrismaFloodSeverity;
    triggeredAt: Date;
  }): HistoryEntryResponseDto {
    const severity = fromPrismaSeverity(alert.severity);

    return {
      id: `alert:${alert.id}:triggered`,
      type: HistoryEntryType.ALERT,
      title: this.buildAlertTitle(severity),
      description: alert.message,
      recordedAt: alert.triggeredAt.toISOString(),
      contextLabel: this.buildContextLabel(
        alert.location.name,
        alert.area.name,
        "Alert",
      ),
      areaId: alert.areaId,
      areaName: alert.area.name,
      locationId: alert.locationId,
      locationName: alert.location.name,
      alertId: alert.id,
    };
  }

  private toSyntheticOperatorActionEntries(
    alert: {
      id: string;
      areaId: string;
      locationId: string;
      location: {
        name: string;
      };
      area: {
        name: string;
      };
      acknowledgedAt: Date | null;
      resolvedAt: Date | null;
    },
    existingEntryIds: Set<string>,
  ): HistoryEntryResponseDto[] {
    const entries: HistoryEntryResponseDto[] = [];

    if (alert.acknowledgedAt) {
      const entryId = this.buildOperatorActionEntryId(
        alert.id,
        "alert.acknowledged",
      );
      if (!existingEntryIds.has(entryId)) {
        entries.push(
          this.buildOperatorEntry({
            id: entryId,
            action: "alert.acknowledged",
            recordedAt: alert.acknowledgedAt,
            alertId: alert.id,
            areaId: alert.areaId,
            areaName: alert.area.name,
            locationId: alert.locationId,
            locationName: alert.location.name,
          }),
        );
      }
    }

    if (alert.resolvedAt) {
      const entryId = this.buildOperatorActionEntryId(
        alert.id,
        "alert.resolved",
      );
      if (!existingEntryIds.has(entryId)) {
        entries.push(
          this.buildOperatorEntry({
            id: entryId,
            action: "alert.resolved",
            recordedAt: alert.resolvedAt,
            alertId: alert.id,
            areaId: alert.areaId,
            areaName: alert.area.name,
            locationId: alert.locationId,
            locationName: alert.location.name,
          }),
        );
      }
    }

    return entries;
  }

  private toReportEntry(report: {
    id: string;
    areaId: string | null;
    reporterName: string | null;
    message: string;
    latitude: number | null;
    longitude: number | null;
    createdAt: Date;
    area: {
      name: string;
    } | null;
  }): HistoryEntryResponseDto {
    const areaName = report.area?.name ?? null;
    const reporterName = this.readString(report.reporterName);

    return {
      id: `report:${report.id}`,
      type: HistoryEntryType.REPORT,
      title: "Laporan lapangan masuk",
      description: this.buildReportDescription({
        message: report.message,
        latitude: report.latitude,
        longitude: report.longitude,
      }),
      recordedAt: report.createdAt.toISOString(),
      contextLabel: this.buildReportContextLabel(reporterName, areaName),
      areaId: report.areaId ?? undefined,
      areaName: areaName ?? undefined,
      reportId: report.id,
    };
  }

  private toOperatorActionEntry(
    auditLog: {
      entityId: string;
      action: string;
      payload: Prisma.JsonValue | null;
      createdAt: Date;
    },
    alert:
      | {
          areaId: string;
          locationId: string;
          location: {
            name: string;
          };
          area: {
            name: string;
          };
        }
      | undefined,
  ): HistoryEntryResponseDto | null {
    if (
      !trackedOperatorActions.includes(auditLog.action as TrackedOperatorAction)
    ) {
      return null;
    }

    const payload = this.asJsonRecord(auditLog.payload);
    const alertId = this.readString(payload?.alertId, auditLog.entityId);
    const areaId = this.readString(payload?.areaId, alert?.areaId);
    const areaName = this.readString(payload?.areaName, alert?.area.name);
    const locationId = this.readString(payload?.locationId, alert?.locationId);
    const locationName = this.readString(
      payload?.locationName,
      alert?.location.name,
    );
    const actorLabel = this.buildActorLabel(payload);

    return this.buildOperatorEntry({
      id: this.buildOperatorActionEntryId(
        alertId,
        auditLog.action as TrackedOperatorAction,
      ),
      action: auditLog.action as TrackedOperatorAction,
      recordedAt: auditLog.createdAt,
      alertId,
      areaId: areaId || undefined,
      areaName: areaName || undefined,
      locationId: locationId || undefined,
      locationName: locationName || undefined,
      actorLabel: actorLabel || undefined,
    });
  }

  private buildOperatorEntry(input: {
    id: string;
    action: TrackedOperatorAction;
    recordedAt: Date;
    alertId: string;
    areaId?: string;
    areaName?: string;
    locationId?: string;
    locationName?: string;
    actorLabel?: string;
  }): HistoryEntryResponseDto {
    const locationName = input.locationName ?? "lokasi tidak diketahui";
    const actorLabel = input.actorLabel?.trim();
    const title =
      input.action === "alert.acknowledged"
        ? "Peringatan ditinjau"
        : "Peringatan selesai";
    const description =
      input.action === "alert.acknowledged"
        ? `Status peringatan untuk ${locationName} sedang dipantau.`
        : `Status peringatan untuk ${locationName} sudah kembali aman.`;

    return {
      id: input.id,
      type: HistoryEntryType.OPERATOR_ACTION,
      title,
      description,
      recordedAt: input.recordedAt.toISOString(),
      contextLabel: this.buildContextLabel(
        input.locationName,
        input.areaName,
        "Peringatan",
      ),
      areaId: input.areaId,
      areaName: input.areaName,
      locationId: input.locationId,
      locationName: input.locationName,
      alertId: input.alertId,
      actorLabel: actorLabel || undefined,
    };
  }

  private buildOperatorActionEntryId(
    alertId: string,
    action: TrackedOperatorAction,
  ): string {
    return `alert:${alertId}:${action === "alert.acknowledged" ? "acknowledged" : "resolved"}`;
  }

  private buildReadingTitle(severity: string): string {
    switch (severity) {
      case "danger":
        return "Pembacaan sensor status waspada";
      case "warning":
        return "Pembacaan sensor status siaga";
      case "stale":
        return "Data alat tidak update";
      default:
        return "Pembacaan sensor terbaru";
    }
  }

  private buildAlertTitle(severity: string): string {
    switch (severity) {
      case "danger":
        return "Alert waspada terpicu";
      case "warning":
        return "Alert siaga terpicu";
      case "stale":
        return "Data alat tidak update";
      default:
        return "Alert terpicu";
    }
  }

  private buildReportContextLabel(
    reporterName: string,
    areaName: string | null,
  ): string {
    if (reporterName.length > 0 && areaName != null && areaName.length > 0) {
      return `${reporterName} • ${areaName}`;
    }

    if (areaName != null && areaName.length > 0) {
      return areaName;
    }

    if (reporterName.length > 0) {
      return reporterName;
    }

    return "Laporan lapangan";
  }

  private buildReportDescription(input: {
    message: string;
    latitude: number | null;
    longitude: number | null;
  }): string {
    if (input.latitude == null || input.longitude == null) {
      return input.message;
    }

    return `${input.message} Koordinat ${input.latitude.toFixed(5)}, ${input.longitude.toFixed(5)}.`;
  }

  private buildContextLabel(
    primary: string | null | undefined,
    secondary: string | null | undefined,
    fallback: string,
  ): string {
    const left = this.readString(primary);
    const right = this.readString(secondary);

    if (left && right) {
      return `${left} • ${right}`;
    }

    if (left) {
      return left;
    }

    if (right) {
      return right;
    }

    return fallback;
  }

  private buildActorLabel(payload: Record<string, unknown> | null): string {
    if (!payload) {
      return "";
    }

    return this.readString(
      payload.actorDisplayName,
      this.readString(payload.actorEmail, this.readString(payload.actorUid)),
    );
  }

  private readString(
    value: unknown,
    fallback: string | null | undefined = "",
  ): string {
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    if (typeof fallback === "string") {
      return fallback.trim();
    }

    return "";
  }

  private buildReadingDescription(input: {
    waterLevelMeters: number;
    flowRateMs: number;
    severity: string;
    rawPayload: Record<string, unknown> | null;
  }): string {
    const telemetry: string[] = [];
    const batteryVoltage = this.toNumber(input.rawPayload?.batteryVoltage);
    if (batteryVoltage != null) {
      telemetry.push(`battery ${batteryVoltage.toFixed(1)}V`);
    }

    const rssi = this.toNumber(input.rawPayload?.rssi);
    if (rssi != null) {
      telemetry.push(`RSSI ${Math.trunc(rssi)} dBm`);
    }

    const pressureKpa = this.toNumber(input.rawPayload?.pressureKpa);
    if (pressureKpa != null) {
      telemetry.push(`pressure ${pressureKpa.toFixed(1)} kPa`);
    }

    const summary =
      `Water level ${(input.waterLevelMeters * 100).toFixed(0)} cm, flow ${input.flowRateMs.toFixed(2)} m/s, ` +
      `status ${this.severityLabel(input.severity)}.`;
    if (telemetry.length === 0) {
      return summary;
    }

    return `${summary} Telemetry: ${telemetry.join(", ")}.`;
  }

  private severityLabel(severity: string): string {
    switch (severity) {
      case "danger":
        return "waspada";
      case "warning":
        return "siaga";
      case "stale":
        return "stale";
      default:
        return "normal";
    }
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
}
