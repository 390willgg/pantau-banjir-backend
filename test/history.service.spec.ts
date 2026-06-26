import { FloodSeverity as PrismaFloodSeverity } from "@prisma/client";
import { HistoryService } from "../src/history/history.service";

describe("HistoryService", () => {
  it("merges readings, reports, alert triggers, and operator audit events into a descending history feed", async () => {
    const prisma = {
      sensorReading: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "reading-1",
            locationId: "A-1",
            measuredAt: new Date("2026-04-15T10:03:00.000Z"),
            waterLevelMeters: 2.75,
            flowRateMs: 0.84,
            severity: PrismaFloodSeverity.DANGER,
            rawPayload: {
              batteryVoltage: 3.9,
              rssi: -68,
            },
            location: {
              name: "Sensor A-1",
              area: {
                name: "Jakarta Utara",
              },
            },
          },
        ]),
      },
      alert: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "alert-1",
            areaId: "jakarta-utara",
            locationId: "A-1",
            location: {
              name: "Sensor A-1",
            },
            area: {
              name: "Jakarta Utara",
            },
            message: "Ketinggian air melewati ambang waspada.",
            severity: PrismaFloodSeverity.DANGER,
            triggeredAt: new Date("2026-04-15T10:00:00.000Z"),
            acknowledgedAt: new Date("2026-04-15T10:05:00.000Z"),
            resolvedAt: new Date("2026-04-15T10:10:00.000Z"),
            updatedAt: new Date("2026-04-15T10:10:00.000Z"),
          },
        ]),
      },
      report: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "report-1",
            areaId: "jakarta-utara",
            reporterName: "Petugas Pos",
            message: "Genangan terlihat meningkat di jalan utama.",
            latitude: -6.12,
            longitude: 106.89,
            createdAt: new Date("2026-04-15T10:07:00.000Z"),
            area: {
              name: "Jakarta Utara",
            },
          },
        ]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            entityId: "alert-1",
            action: "alert.acknowledged",
            payload: {
              alertId: "alert-1",
              areaId: "jakarta-utara",
              areaName: "Jakarta Utara",
              locationId: "A-1",
              locationName: "Sensor A-1",
              actorUid: "operator-1",
              actorEmail: "operator@example.com",
            },
            createdAt: new Date("2026-04-15T10:05:00.000Z"),
          },
          {
            entityId: "alert-1",
            action: "alert.resolved",
            payload: {
              alertId: "alert-1",
              areaId: "jakarta-utara",
              areaName: "Jakarta Utara",
              locationId: "A-1",
              locationName: "Sensor A-1",
              actorDisplayName: "Operator Shift Pagi",
            },
            createdAt: new Date("2026-04-15T10:10:00.000Z"),
          },
        ]),
      },
    };

    const service = new HistoryService(prisma as never);

    const result = await service.listHistory();

    expect(result).toHaveLength(5);
    expect(result.map((entry) => entry.id)).toEqual([
      "alert:alert-1:resolved",
      "report:report-1",
      "alert:alert-1:acknowledged",
      "reading:A-1:2026-04-15T10:03:00.000Z",
      "alert:alert-1:triggered",
    ]);
    expect(result[0].actorLabel).toBe("Operator Shift Pagi");
    expect(result[1].type).toBe("report");
    expect(result[2].actorLabel).toBe("operator@example.com");
    expect(result[3].type).toBe("reading");
    expect(result[3].description).toContain("battery 3.9V");
    expect(result[3].description).toContain("RSSI -68 dBm");
    expect(result[4].type).toBe("alert");
  });

  it("keeps synthetic operator lifecycle entries for legacy alerts without audit logs", async () => {
    const prisma = {
      sensorReading: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      alert: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "alert-legacy",
            areaId: "ancol",
            locationId: "B-2",
            location: {
              name: "Sensor B-2",
            },
            area: {
              name: "Ancol",
            },
            message: "Alert lama tanpa audit.",
            severity: PrismaFloodSeverity.WARNING,
            triggeredAt: new Date("2026-04-15T09:00:00.000Z"),
            acknowledgedAt: new Date("2026-04-15T09:05:00.000Z"),
            resolvedAt: null,
            updatedAt: new Date("2026-04-15T09:05:00.000Z"),
          },
        ]),
      },
      report: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    };

    const service = new HistoryService(prisma as never);

    const result = await service.listHistory();

    expect(result.map((entry) => entry.id)).toEqual([
      "alert:alert-legacy:acknowledged",
      "alert:alert-legacy:triggered",
    ]);
    expect(result[0].type).toBe("operatorAction");
  });

  it("falls back to linked alert context and uid actor label when audit payload is partial", async () => {
    const prisma = {
      sensorReading: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      alert: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: "alert-2",
            areaId: "bekasi",
            locationId: "C-3",
            location: {
              name: "Sensor C-3",
            },
            area: {
              name: "Bekasi",
            },
            message: "Alert dengan audit minim.",
            severity: PrismaFloodSeverity.WARNING,
            triggeredAt: new Date("2026-04-15T11:00:00.000Z"),
            acknowledgedAt: new Date("2026-04-15T11:05:00.000Z"),
            resolvedAt: null,
            updatedAt: new Date("2026-04-15T11:05:00.000Z"),
          },
        ]),
      },
      report: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            entityId: "alert-2",
            action: "alert.acknowledged",
            payload: {
              alertId: "alert-2",
              actorUid: "operator-uid-2",
            },
            createdAt: new Date("2026-04-15T11:05:00.000Z"),
          },
        ]),
      },
    };

    const service = new HistoryService(prisma as never);

    const result = await service.listHistory();

    expect(result.map((entry) => entry.id)).toEqual([
      "alert:alert-2:acknowledged",
      "alert:alert-2:triggered",
    ]);
    expect(result[0]).toMatchObject({
      type: "operatorAction",
      actorLabel: "operator-uid-2",
      areaId: "bekasi",
      areaName: "Bekasi",
      locationId: "C-3",
      locationName: "Sensor C-3",
      contextLabel: "Sensor C-3 • Bekasi",
      alertId: "alert-2",
    });
    expect(result[0].description).toContain(
      "Status peringatan untuk Sensor C-3 sedang dipantau.",
    );
  });
});
