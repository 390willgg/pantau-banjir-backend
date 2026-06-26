import { NotFoundException } from '@nestjs/common';
import { LocationsService } from '../src/locations/locations.service';

describe('LocationsService', () => {
  it('creates a manual area before creating a location', async () => {
    const createdLocation = {
      id: 'FW-0001',
      name: 'Sensor FW-0001',
      latitude: 1.17,
      longitude: 108.97,
      currentWaterLevel: 0,
      currentFlowRate: 0,
      currentSeverity: 'NORMAL',
      lastReadingAt: null,
      warningThreshold: 2,
      dangerThreshold: 3,
      area: {
        id: 'pemangkat',
        name: 'Pemangkat',
        northLatitude: 1.195,
        southLatitude: 1.145,
        eastLongitude: 108.995,
        westLongitude: 108.945,
      },
      readings: [{ rawPayload: null }],
    };

    const prisma = {
      area: {
        upsert: jest.fn().mockResolvedValue(createdLocation.area),
      },
      location: {
        create: jest.fn().mockResolvedValue(createdLocation),
      },
    };
    const redis = {
      getJson: jest.fn(),
      setJson: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const service = new LocationsService(prisma as never, redis as never);
    const result = await service.createLocation({
      id: 'FW-0001',
      name: 'Sensor FW-0001',
      areaId: ' pemangkat ',
      areaName: ' Pemangkat ',
      latitude: 1.17,
      longitude: 108.97,
      warningThreshold: 2,
      dangerThreshold: 3,
    });

    expect(prisma.area.upsert).toHaveBeenCalledWith({
      where: { id: 'pemangkat' },
      update: { name: 'Pemangkat' },
      create: expect.objectContaining({
        id: 'pemangkat',
        name: 'Pemangkat',
        northLatitude: expect.closeTo(1.195),
        southLatitude: expect.closeTo(1.145),
        eastLongitude: expect.closeTo(108.995),
        westLongitude: expect.closeTo(108.945),
      }),
    });
    expect(prisma.location.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          id: 'FW-0001',
          areaId: 'pemangkat',
        }),
      }),
    );
    expect(redis.delete).toHaveBeenNthCalledWith(1, 'locations:list');
    expect(redis.delete).toHaveBeenNthCalledWith(2, 'water-level:overview');
    expect(result.area.name).toBe('Pemangkat');
  });

  it('updates installation coordinates and clears location caches', async () => {
    const updatedLocation = {
      id: 'A-1',
      name: 'Sensor A-1',
      latitude: -6.1197,
      longitude: 106.8894,
      currentWaterLevel: 2.3,
      currentFlowRate: 0.8,
      currentSeverity: 'WARNING',
      lastReadingAt: new Date('2026-03-23T02:00:00.000Z'),
      warningThreshold: 2,
      dangerThreshold: 3,
      area: {
        id: 'jakarta-utara',
        name: 'Jakarta Utara',
        northLatitude: -6.09,
        southLatitude: -6.18,
        eastLongitude: 106.935,
        westLongitude: 106.76,
      },
      readings: [{ rawPayload: null }],
    };

    const prisma = {
      location: {
        update: jest.fn().mockResolvedValue(updatedLocation),
      },
    };
    const redis = {
      getJson: jest.fn(),
      setJson: jest.fn(),
      delete: jest.fn().mockResolvedValue(undefined),
    };

    const service = new LocationsService(prisma as never, redis as never);
    const result = await service.installLocation('A-1', {
      latitude: -6.1197,
      longitude: 106.8894,
    });

    expect(prisma.location.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'A-1' },
        data: expect.objectContaining({
          latitude: -6.1197,
          longitude: 106.8894,
          invalidCoordinateCount: 0,
        }),
      }),
    );
    expect(redis.delete).toHaveBeenNthCalledWith(1, 'locations:list');
    expect(redis.delete).toHaveBeenNthCalledWith(2, 'water-level:overview');
    expect(result.latitude).toBe(-6.1197);
    expect(result.longitude).toBe(106.8894);
  });

  it('throws not found when the target location does not exist', async () => {
    const prisma = {
      location: {
        update: jest.fn().mockRejectedValue({
          code: 'P2025',
          constructor: { name: 'PrismaClientKnownRequestError' },
        }),
      },
    };
    const redis = {
      getJson: jest.fn(),
      setJson: jest.fn(),
      delete: jest.fn(),
    };

    const service = new LocationsService(prisma as never, redis as never);

    await expect(
      service.installLocation('missing', {
        latitude: -6.11,
        longitude: 106.88,
      }),
    ).rejects.toBeInstanceOf(NotFoundException);
  });
});
