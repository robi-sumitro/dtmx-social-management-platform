import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagService } from '../features/feature-flag.service';
import { BulkProcessor } from '../queue/bulk.processor';
import { RedisLockService } from './redis-lock.service';

const INBOX_SYNC_MINUTES = Math.max(1, Number(process.env.INBOX_SYNC_MINUTES || 5));

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

  // Refresh account credentials (YouTube/TikTok access tokens etc.) before they expire.
  @Cron(CronExpression.EVERY_30_MINUTES)
  async refreshTokens() {
    if (!(await this.locks.acquire('refresh-tokens', 20 * 60 * 1000))) return;
    try {
      await this.bulk.enqueueAccountSync({ action: 'refresh_tokens' });
    } finally {
      await this.locks.release('refresh-tokens');
    }
  }

  // Pull new comments/DMs from connected accounts. Default 5 menit, bisa dipercepat via INBOX_SYNC_MINUTES (mis. 1 = tiap menit).
  //
  // Fan out: instead of one global job that loops over every account (a single
  // slow/stuck account could delay or drop coverage for the rest), enqueue an
  // independent `pull_inbox` job per active account. Each platform/account is
  // then always fetched in the background, across providers, regardless of the
  // last one that logged in.
  @Cron(`*/${INBOX_SYNC_MINUTES} * * * *`)
  async syncInbox() {
    if (!(await this.locks.acquire('sync-inbox', 4 * 60 * 1000))) return;
    try {
      const accounts = await this.prisma.socialAccount.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      if (accounts.length === 0) return;
      for (const acc of accounts) {
        await this.bulk.enqueueAccountSync({
          action: 'pull_inbox',
          accountId: acc.id,
        });
      }
      this.logger.log(`Enqueued inbox sync for ${accounts.length} active accounts`);
    } finally {
      await this.locks.release('sync-inbox');
    }
  }
}
