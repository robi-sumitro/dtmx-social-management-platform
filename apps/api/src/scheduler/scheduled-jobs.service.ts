import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagService } from '../features/feature-flag.service';
import { BulkProcessor } from '../queue/bulk.processor';
import { RedisLockService } from './redis-lock.service';

@Injectable()
export class ScheduledJobsService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledJobsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
    private readonly bulk: BulkProcessor,
    private readonly locks: RedisLockService,
  ) {}

  onModuleInit() {
    this.logger.log('Scheduled jobs registered');
  }

  // Auto-expire subscriptions that passed expiresAt
  @Cron(CronExpression.EVERY_HOUR)
  async expireSubscriptions() {
    if (!(await this.locks.acquire('expire-subscriptions', 5 * 60 * 1000))) return;
    try {
      const now = new Date();
      const res = await this.prisma.subscription.updateMany({
        where: { status: 'active', expiresAt: { lt: now } },
        data: { status: 'expired' },
      });
      if (res.count > 0) this.logger.log(`Expired ${res.count} subscriptions`);
    } finally {
      await this.locks.release('expire-subscriptions');
    }
  }

  // Publish scheduled posts whose scheduledAt has arrived
  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledPosts() {
    if (!(await this.locks.acquire('publish-scheduled-posts', 50 * 1000))) return;
    try {
      const now = new Date();
      const posts = await this.prisma.post.findMany({
        where: {
          status: 'scheduled',
          scheduledAt: { not: null, lte: now },
        },
        select: { id: true },
      });
      for (const post of posts) {
        await this.prisma.post.update({
          where: { id: post.id },
          data: { status: 'publishing' },
        });
        await this.bulk.enqueuePublish({ postId: post.id });
        this.logger.log(`Enqueued scheduled post ${post.id} for publishing`);
      }
      if (posts.length > 0) this.logger.log(`Picked up ${posts.length} scheduled posts`);
    } finally {
      await this.locks.release('publish-scheduled-posts');
    }
  }

  // Refresh token freshness markers nightly
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async touchTokens() {
    if (!(await this.locks.acquire('touch-tokens', 10 * 60 * 1000))) return;
    try {
      const res = await this.prisma.socialAccount.updateMany({
        data: { lastSyncAt: new Date() },
        where: { isActive: true },
      });
      this.logger.log(`Touched ${res.count} social accounts`);
    } finally {
      await this.locks.release('touch-tokens');
    }
  }

  // Pull new comments/DMs from connected META accounts every 5 minutes.
  @Cron(CronExpression.EVERY_5_MINUTES)
  async syncInbox() {
    if (!(await this.locks.acquire('sync-inbox', 4 * 60 * 1000))) return;
    try {
      await this.bulk.enqueueAccountSync({ action: 'pull_inbox' });
    } finally {
      await this.locks.release('sync-inbox');
    }
  }
}
