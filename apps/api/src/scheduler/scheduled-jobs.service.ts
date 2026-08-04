import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagService } from '../features/feature-flag.service';
import { BulkProcessor } from '../queue/bulk.processor';

@Injectable()
export class ScheduledJobsService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledJobsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
    private readonly bulk: BulkProcessor,
  ) {}

  onModuleInit() {
    this.logger.log('Scheduled jobs registered');
  }

  // Auto-expire subscriptions that passed expiresAt
  @Cron(CronExpression.EVERY_HOUR)
  async expireSubscriptions() {
    const now = new Date();
    const res = await this.prisma.subscription.updateMany({
      where: { status: 'active', expiresAt: { lt: now } },
      data: { status: 'expired' },
    });
    if (res.count > 0) this.logger.log(`Expired ${res.count} subscriptions`);
  }

  // Publish scheduled posts whose scheduledAt has arrived
  @Cron(CronExpression.EVERY_MINUTE)
  async publishScheduledPosts() {
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
  }

  // Refresh token freshness markers nightly
  @Cron(CronExpression.EVERY_DAY_AT_2AM)
  async touchTokens() {
    const res = await this.prisma.socialAccount.updateMany({
      data: { lastSyncAt: new Date() },
      where: { isActive: true },
    });
    this.logger.log(`Touched ${res.count} social accounts`);
  }
}