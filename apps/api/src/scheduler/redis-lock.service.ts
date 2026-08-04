import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisLockService implements OnModuleDestroy {
  private readonly logger = new Logger(RedisLockService.name);
  private client: Redis | null = null;
  private readonly lockPrefix = 'dtmx:lock:';

  constructor(private readonly config: ConfigService) {}

  private getClient(): Redis {
    if (!this.client) {
      this.client = new Redis({
        host: this.config.get<string>('REDIS_HOST', 'localhost'),
        port: this.config.get<number>('REDIS_PORT', 6379),
        password: this.config.get<string>('REDIS_PASSWORD', '') || undefined,
        maxRetriesPerRequest: null,
        lazyConnect: false,
        enableOfflineQueue: true,
      });
      this.client.on('error', (err) =>
        this.logger.warn(`Redis lock error: ${err.message}`),
      );
    }
    return this.client;
  }

  /**
   * Try to acquire a lock with the given key for `ttlMs` milliseconds.
   * Returns true only for the single replica that wins.
   */
  async acquire(key: string, ttlMs = 60000): Promise<boolean> {
    try {
      const res = await this.getClient().set(
        `${this.lockPrefix}${key}`,
        '1',
        'PX',
        ttlMs,
        'NX',
      );
      return res === 'OK';
    } catch (err) {
      this.logger.warn(`Failed to acquire lock ${key}: ${(err as Error).message}`);
      return false;
    }
  }

  async release(key: string): Promise<void> {
    try {
      await this.getClient().del(`${this.lockPrefix}${key}`);
    } catch (err) {
      this.logger.warn(`Failed to release lock ${key}: ${(err as Error).message}`);
    }
  }

  onModuleDestroy() {
    if (this.client) {
      this.client.disconnect();
    }
  }
}
