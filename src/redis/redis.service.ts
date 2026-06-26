import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import Redis from 'ioredis';
import { getRedisUrl, isRedisRequired } from '../config/runtime-config';

@Injectable()
export class RedisService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private readonly redisRequired = isRedisRequired();
  private readonly redisUrl = getRedisUrl();
  private client: Redis | null = null;
  private connectionDisabled = false;
  private hasLoggedUnavailable = false;

  async getClient(): Promise<Redis | null> {
    return this.getConnectedClient();
  }

  async setJson(key: string, value: unknown, ttlSeconds?: number) {
    const payload = JSON.stringify(value);
    await this.runOptional(async (client) => {
      if (ttlSeconds) {
        await client.set(key, payload, 'EX', ttlSeconds);
        return;
      }

      await client.set(key, payload);
    }, undefined);
  }

  async getJson<T>(key: string): Promise<T | null> {
    return this.runOptional(async (client) => {
      const value = await client.get(key);
      return value ? (JSON.parse(value) as T) : null;
    }, null);
  }

  async delete(key: string) {
    await this.runOptional(async (client) => {
      await client.del(key);
    }, undefined);
  }

  async onModuleDestroy() {
    if (!this.client) {
      return;
    }

    try {
      await this.client.quit();
    } catch {
      this.client.disconnect();
    }
  }

  private async getConnectedClient(): Promise<Redis | null> {
    if (this.connectionDisabled) {
      return null;
    }

    const client = this.client ?? this.createClient();
    this.client = client;

    try {
      if (client.status === 'wait') {
        await client.connect();
      }

      if (client.status === 'end') {
        this.client = this.createClient();
        await this.client.connect();
      }

      return this.client;
    } catch (error) {
      if (this.redisRequired) {
        throw error;
      }

      this.logUnavailable(error);
      this.connectionDisabled = true;
      this.client?.disconnect();
      this.client = null;
      return null;
    }
  }

  private createClient() {
    const client = new Redis(this.redisUrl, {
      maxRetriesPerRequest: null,
      lazyConnect: true,
      enableOfflineQueue: false,
    });

    client.on('error', (error) => {
      if (this.redisRequired) {
        this.logger.error(`Redis connection error: ${error.message}`);
        return;
      }

      this.logUnavailable(error);
    });

    return client;
  }

  private async runOptional<T>(
    operation: (client: Redis) => Promise<T>,
    fallback: T,
  ): Promise<T> {
    const client = await this.getConnectedClient();
    if (!client) {
      return fallback;
    }

    try {
      return await operation(client);
    } catch (error) {
      if (this.redisRequired) {
        throw error;
      }

      this.disableConnection(error);
      return fallback;
    }
  }

  private disableConnection(error: unknown) {
    this.logUnavailable(error);
    this.connectionDisabled = true;
    this.client?.disconnect();
    this.client = null;
  }

  private logUnavailable(error: unknown) {
    if (this.hasLoggedUnavailable) {
      return;
    }

    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(
      `Redis unavailable at ${this.redisUrl}. Continuing without cache support. ${message}`,
    );
    this.hasLoggedUnavailable = true;
  }
}
