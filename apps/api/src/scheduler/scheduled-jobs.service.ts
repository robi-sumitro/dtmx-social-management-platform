import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagService } from '../features/feature-flag.service';

@Injectable()
export class ScheduledJobsService implements OnModuleInit {
  private readonly logger = new Logger(ScheduledJobsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
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