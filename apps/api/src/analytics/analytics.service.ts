import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { PlatformsService } from '../platforms/platforms.service';

export interface AccountInsights {
  accountId: string;
  accountName: string;
  provider: string;
  avatarUrl?: string | null;
  reach: number;
  engagementRate: number;
  linkClicks: number;
  error?: string;
}

export interface AnalyticsSummary {
  reach: number;
  engagementRate: number;
  linkClicks: number;
  publishedPosts: number;
  lastSyncedAt: Date | null;
  byAccount: AccountInsights[];
}

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);
  private readonly cache = new Map<string, { data: AnalyticsSummary; expires: number }>();
  private readonly TTL_MS = 60 * 1000;

  constructor(
    private readonly prisma: PrismaService,
    private readonly platforms: PlatformsService,
  ) {}

  async summary(userId: string): Promise<AnalyticsSummary> {
    const cached = this.cache.get(userId);
    if (cached && cached.expires > Date.now()) return cached.data;

    const accounts = await this.prisma.socialAccount.findMany({
      where: { userId, isActive: true },
    });

    let reach = 0;
    let impressions = 0;
    let engagementCount = 0;
    let linkClicks = 0;
    let lastSync: Date | null = null;
    const byAccount: AccountInsights[] = [];

    for (const acc of accounts) {
      const row: AccountInsights = {
        accountId: acc.id,
        accountName: acc.accountName,
        provider: acc.provider,
        avatarUrl: acc.avatarUrl,
        reach: 0,
        engagementRate: 0,
        linkClicks: 0,
      };
      try {
        const ins = await this.platforms.insights(acc);
        if (ins) {
          row.reach = ins.reach;
          row.linkClicks = ins.linkClicks;
          row.engagementRate = ins.impressions > 0 ? (ins.engagementCount / ins.impressions) * 100 : 0;
          reach += ins.reach;
          impressions += ins.impressions;
          engagementCount += ins.engagementCount;
          linkClicks += ins.linkClicks;
        }
      } catch (err) {
        row.error = (err as Error).message;
        this.logger.warn(`Insights failed for ${acc.provider} ${acc.id}: ${row.error}`);
      }
      if (acc.lastSyncAt && (!lastSync || acc.lastSyncAt > lastSync)) lastSync = acc.lastSyncAt;
      byAccount.push(row);
    }

    const publishedPosts = await this.prisma.post.count({
      where: { userId, status: 'published' },
    });

    const data: AnalyticsSummary = {
      reach,
      engagementRate: impressions > 0 ? (engagementCount / impressions) * 100 : 0,
      linkClicks,
      publishedPosts,
      lastSyncedAt: lastSync,
      byAccount,
    };

    this.cache.set(userId, { data, expires: Date.now() + this.TTL_MS });
    return data;
  }
}
