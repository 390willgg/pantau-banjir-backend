import { HealthService } from '../src/health/health.service';

describe('HealthService', () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  it('reports ok when database is reachable and MQTT is connected', async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-22T10:30:00.000Z'));

    const prisma = {
      $queryRaw: jest.fn().mockResolvedValue([{ ok: 1 }]),
      location: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'A-1',
            name: 'Sensor A-1',
            lastReadingAt: new Date('2026-03-22T10:29:00.000Z'),
            currentSeverity: 'DANGER',
          },
          {
            id: 'B-2',
            name: 'Sensor B-2',
            lastReadingAt: null,
            currentSeverity: 'NORMAL',
          },
        ]),
      },
    };

    const mqttIngestionService = {
      getStatus: jest.fn().mockReturnValue({
        enabled: true,
        connectionState: 'connected',
        brokerUrl: 'mqtt://localhost:1883',
        clientId: 'pantau-banjir-backend',
        topicPattern: 'pantau-banjir/sensors/+/readings',
        lastMessageAt: '2026-03-22T10:29:40.000Z',
        lastError: null,
      }),
    };

    const service = new HealthService(prisma as never, mqttIngestionService as never);
    const result = await service.getHealth();

    expect(result.status).toBe('ok');
    expect(result.services.database.status).toBe('up');
    expect(result.services.mqtt.connectionState).toBe('connected');
    expect(result.ingestion.latestReadingAt).toBe('2026-03-22T10:29:00.000Z');
    expect(result.ingestion.latestReadingAgeSeconds).toBe(60);
    expect(result.ingestion.sensors).toEqual([
      {
        locationId: 'A-1',
        locationName: 'Sensor A-1',
        lastReadingAt: '2026-03-22T10:29:00.000Z',
        lastReadingAgeSeconds: 60,
        severity: 'danger',
      },
      {
        locationId: 'B-2',
        locationName: 'Sensor B-2',
        lastReadingAt: null,
        lastReadingAgeSeconds: null,
        severity: 'normal',
      },
    ]);
  });

  it('reports degraded when the database check fails', async () => {
    const prisma = {
      $queryRaw: jest.fn().mockRejectedValue(new Error('database offline')),
      location: {
        findMany: jest.fn(),
      },
    };

    const mqttIngestionService = {
      getStatus: jest.fn().mockReturnValue({
        enabled: false,
        connectionState: 'disabled',
        brokerUrl: 'mqtt://localhost:1883',
        clientId: 'pantau-banjir-backend',
        topicPattern: 'pantau-banjir/sensors/+/readings',
        lastMessageAt: null,
        lastError: null,
      }),
    };

    const service = new HealthService(prisma as never, mqttIngestionService as never);
    const result = await service.getHealth();

    expect(result.status).toBe('degraded');
    expect(result.services.database.status).toBe('down');
    expect(result.services.database.error).toBe('database offline');
    expect(result.ingestion.latestReadingAt).toBeNull();
    expect(result.ingestion.sensors).toEqual([]);
  });
});
