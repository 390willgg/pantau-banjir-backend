import { Logger } from '@nestjs/common';
import Redis from 'ioredis';
import { RedisService } from '../src/redis/redis.service';

jest.mock('ioredis');

describe('RedisService', () => {
  const RedisMock = Redis as unknown as jest.Mock;
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('fails open when redis is unavailable and not required', async () => {
    const connectError = new Error('ECONNREFUSED');
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const mockClient = {
      status: 'wait',
      connect: jest.fn().mockRejectedValue(connectError),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      quit: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
    };
    RedisMock.mockImplementation(() => mockClient);
    delete process.env.REDIS_REQUIRED;

    const service = new RedisService();

    await expect(service.getJson('water-level:overview')).resolves.toBeNull();
    await expect(service.setJson('water-level:overview', { ok: true }, 30)).resolves.toBeUndefined();
    await expect(service.delete('water-level:overview')).resolves.toBeUndefined();

    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(mockClient.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.set).not.toHaveBeenCalled();
    expect(mockClient.del).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });

  it('throws when redis is required and unavailable', async () => {
    const connectError = new Error('ECONNREFUSED');
    const mockClient = {
      status: 'wait',
      connect: jest.fn().mockRejectedValue(connectError),
      get: jest.fn(),
      set: jest.fn(),
      del: jest.fn(),
      quit: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
    };
    RedisMock.mockImplementation(() => mockClient);
    process.env.REDIS_REQUIRED = 'true';

    const service = new RedisService();

    await expect(service.getJson('water-level:overview')).rejects.toThrow('ECONNREFUSED');
  });

  it('fails open when redis operation throws after connecting', async () => {
    const operationError = new Error("Stream isn't writeable and enableOfflineQueue options is false");
    const warnSpy = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    const mockClient = {
      status: 'ready',
      connect: jest.fn(),
      get: jest.fn().mockRejectedValue(operationError),
      set: jest.fn(),
      del: jest.fn(),
      quit: jest.fn(),
      disconnect: jest.fn(),
      on: jest.fn(),
    };
    RedisMock.mockImplementation(() => mockClient);
    delete process.env.REDIS_REQUIRED;

    const service = new RedisService();

    await expect(service.getJson('locations:list')).resolves.toBeNull();
    await expect(service.setJson('locations:list', [{ id: 'jakarta-utara' }], 30)).resolves.toBeUndefined();
    await expect(service.delete('locations:list')).resolves.toBeUndefined();

    expect(RedisMock).toHaveBeenCalledTimes(1);
    expect(mockClient.get).toHaveBeenCalledTimes(1);
    expect(mockClient.set).not.toHaveBeenCalled();
    expect(mockClient.del).not.toHaveBeenCalled();
    expect(mockClient.disconnect).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
