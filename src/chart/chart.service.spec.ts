import { ChartService } from "./chart.service";
import { PrismaService } from "../prisma/prisma.service";

describe("ChartService", () => {
  let findMany: jest.Mock;
  let service: ChartService;

  beforeEach(() => {
    findMany = jest.fn();
    service = new ChartService({
      location: { findMany },
    } as unknown as PrismaService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns day sensor series from recent readings in chronological order", async () => {
    findMany.mockResolvedValue([
      {
        id: "A-1",
        name: "Sensor A-1",
        currentWaterLevel: 2.1,
        currentFlowRate: 1.4,
        lastReadingAt: new Date(2026, 2, 22, 10, 5),
        updatedAt: new Date(2026, 2, 22, 10, 6),
        readings: [
          {
            measuredAt: new Date(2026, 2, 22, 10, 5),
            waterLevelMeters: 2.5,
            flowRateMs: 1.8,
            rawPayload: { volumeM3: 725.5 },
          },
          {
            measuredAt: new Date(2026, 2, 22, 10, 0),
            waterLevelMeters: 2.1,
            flowRateMs: 1.4,
            rawPayload: { volumeM3: 650 },
          },
        ],
      },
    ]);

    const result = await service.getSensorSeries({ limit: "2", range: "day" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true },
        include: expect.objectContaining({
          readings: expect.objectContaining({
            take: 2,
            where: {
              measuredAt: {
                gte: expect.any(Date),
              },
            },
          }),
        }),
      }),
    );
    expect(result).toEqual([
      {
        sensorId: "A-1",
        sensorName: "Sensor A-1",
        currentWaterLevel: 2.5,
        currentFlowRate: 1.8,
        currentVolume: 725.5,
        waterLevelData: [
          { label: "10:00", value: 2.1 },
          { label: "10:05", value: 2.5 },
        ],
        flowRateData: [
          { label: "10:00", value: 1.4 },
          { label: "10:05", value: 1.8 },
        ],
        volumeData: [
          { label: "10:00", value: 650 },
          { label: "10:05", value: 725.5 },
        ],
      },
    ]);
  });

  it("aggregates week readings into daily average points", async () => {
    findMany.mockResolvedValue([
      {
        id: "A-1",
        name: "Sensor A-1",
        currentWaterLevel: 2.1,
        currentFlowRate: 1.4,
        lastReadingAt: new Date(2026, 2, 23, 10, 5),
        updatedAt: new Date(2026, 2, 23, 10, 6),
        readings: [
          {
            measuredAt: new Date(2026, 2, 22, 10, 0),
            waterLevelMeters: 2,
            flowRateMs: 1,
            rawPayload: { volumeM3: 600 },
          },
          {
            measuredAt: new Date(2026, 2, 22, 11, 0),
            waterLevelMeters: 4,
            flowRateMs: 3,
            rawPayload: { volumeM3: 800 },
          },
          {
            measuredAt: new Date(2026, 2, 23, 10, 0),
            waterLevelMeters: 1,
            flowRateMs: 0.5,
            rawPayload: { volumeM3: 300 },
          },
        ],
      },
    ]);

    const result = await service.getSensorSeries({ range: "week" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          readings: expect.not.objectContaining({
            take: expect.any(Number),
          }),
        }),
      }),
    );
    expect(result[0]).toMatchObject({
      currentWaterLevel: 1,
      currentFlowRate: 0.5,
      currentVolume: 300,
      waterLevelData: [
        { label: "22 Mar", value: 3 },
        { label: "23 Mar", value: 1 },
      ],
      flowRateData: [
        { label: "22 Mar", value: 2 },
        { label: "23 Mar", value: 0.5 },
      ],
      volumeData: [
        { label: "22 Mar", value: 700 },
        { label: "23 Mar", value: 300 },
      ],
    });
  });

  it("uses current location values when no readings exist", async () => {
    findMany.mockResolvedValue([
      {
        id: "B-2",
        name: "Sensor B-2",
        currentWaterLevel: 3,
        currentFlowRate: 2,
        lastReadingAt: null,
        updatedAt: new Date(2026, 2, 22, 11, 30),
        readings: [],
      },
    ]);

    const result = await service.getSensorSeries();

    expect(result[0]).toMatchObject({
      sensorId: "B-2",
      currentWaterLevel: 3,
      currentFlowRate: 2,
      currentVolume: 975,
      waterLevelData: [{ label: "11:30", value: 3 }],
    });
  });

  it("caps day range limit to 720 readings", async () => {
    findMany.mockResolvedValue([]);

    await service.getSensorSeries({ limit: "9999", range: "day" });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          readings: expect.objectContaining({
            take: 720,
          }),
        }),
      }),
    );
  });

  it("uses the requested range window for recent readings", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-01T12:00:00.000Z"));
    findMany.mockResolvedValue([]);

    await service.getSensorSeries({ range: "week" });

    expect(readingWindowStart()).toEqual(new Date("2026-04-24T12:00:00.000Z"));
  });

  it("uses the month range window when requested", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-01T12:00:00.000Z"));
    findMany.mockResolvedValue([]);

    await service.getSensorSeries({ range: "month" });

    expect(readingWindowStart()).toEqual(new Date("2026-04-01T12:00:00.000Z"));
  });

  it("falls back to the day range window for invalid ranges", async () => {
    jest.useFakeTimers().setSystemTime(new Date("2026-05-01T12:00:00.000Z"));
    findMany.mockResolvedValue([]);

    await service.getSensorSeries({ range: "year" });

    expect(readingWindowStart()).toEqual(new Date("2026-04-30T12:00:00.000Z"));
  });

  function readingWindowStart(): Date {
    return findMany.mock.calls.at(-1)?.[0].include.readings.where.measuredAt
      .gte;
  }
});
