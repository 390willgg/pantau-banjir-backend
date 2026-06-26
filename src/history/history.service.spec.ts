import { HistoryService } from "./history.service";
import { PrismaService } from "../prisma/prisma.service";

describe("HistoryService", () => {
  let sensorReadingFindMany: jest.Mock;
  let alertFindMany: jest.Mock;
  let reportFindMany: jest.Mock;
  let auditLogFindMany: jest.Mock;
  let service: HistoryService;

  beforeEach(() => {
    sensorReadingFindMany = jest.fn().mockResolvedValue([]);
    alertFindMany = jest.fn().mockResolvedValue([]);
    reportFindMany = jest.fn().mockResolvedValue([]);
    auditLogFindMany = jest.fn().mockResolvedValue([]);
    service = new HistoryService({
      sensorReading: { findMany: sensorReadingFindMany },
      alert: { findMany: alertFindMany },
      report: { findMany: reportFindMany },
      auditLog: { findMany: auditLogFindMany },
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("uses the requested limit for every history source", async () => {
    await service.listHistory({ limit: "25" });

    expect(sensorReadingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
    expect(alertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
    expect(reportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
    expect(auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 25 }),
    );
  });

  it("caps requested limits to protect the history aggregator", async () => {
    await service.listHistory({ limit: "9999" });

    expect(sensorReadingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 200 }),
    );
  });

  it("falls back to the default limit when the query is invalid", async () => {
    await service.listHistory({ limit: "not-a-number" });

    expect(sensorReadingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("filters history sources to the requested recent day window", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-01T00:00:00.000Z"));

    await service.listHistory({ limit: "25", days: "7" });

    const expectedWindowStart = new Date("2026-04-24T00:00:00.000Z");
    expect(sensorReadingFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          measuredAt: {
            gte: expectedWindowStart,
          },
        },
      }),
    );
    expect(alertFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [
            { triggeredAt: { gte: expectedWindowStart } },
            { acknowledgedAt: { gte: expectedWindowStart } },
            { resolvedAt: { gte: expectedWindowStart } },
            { updatedAt: { gte: expectedWindowStart } },
          ],
        },
      }),
    );
    expect(reportFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          createdAt: {
            gte: expectedWindowStart,
          },
        },
      }),
    );
    expect(auditLogFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          createdAt: {
            gte: expectedWindowStart,
          },
        }),
      }),
    );
  });
});
