import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformsService } from '../../platforms/platforms.service';
import { SocialAccountsService } from '../../social-accounts/social-accounts.service';

@Processor('sync')
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly platforms: PlatformsService,
    private readonly social: SocialAccountsService,
  ) {
    super();
  }

  async process(job: Job): Promise<any> {
    if (job.name === 'pull_inbox') return this.pullInbox(job.data?.accountId);
    if (job.name === 'refresh_tokens') {
      if (job.data?.accountId) {
        const acc = await this.prisma.socialAccount.findUnique({ where: { id: job.data.accountId } });
        if (!acc) return { skipped: true, reason: 'account missing' };
        const res = await this.social.refreshTokenAll(acc.userId);
        return { refreshed: res.refreshed, failed: res.failed };
      }
      const users = await this.prisma.socialAccount.findMany({
        where: { isActive: true },
        select: { userId: true },
        distinct: ['userId'],
      });
      for (const u of users) {
        await this.social.refreshTokenAll(u.userId);
      }
      return { refreshedUsers: users.length };
    }
    return { skipped: true, reason: `unknown action ${job.name}` };
  }

  private async pullInbox(accountId?: string): Promise<any> {
    const where: { isActive: boolean; id?: string } = { isActive: true };
    if (accountId) where.id = accountId;
    const accounts = await this.prisma.socialAccount.findMany({ where });

    let pulled = 0;
    let failed = 0;
    for (const acc of accounts) {
      try {
        // Refresh credentials nearing/over expiry (e.g. YouTube 1-hour access token).
        if (acc.tokenExpiresAt && new Date(acc.tokenExpiresAt).getTime() - Date.now() < 10 * 60 * 1000) {
          try {
            await this.social.refreshAccount(acc.id);
          } catch (err) {
            this.logger.warn(`token refresh failed for ${acc.provider} ${acc.id}: ${(err as Error).message}`);
          }
        }
        const fresh = await this.prisma.socialAccount.findUnique({ where: { id: acc.id } });
        const items = await this.platforms.pullInbox(fresh ?? acc);
        for (const item of items) {
          if (!item.sourceId) continue;
          const exists = await this.prisma.inboxItem.findFirst({
            where: { userId: acc.userId, accountId: acc.id, sourceId: item.sourceId },
            select: { id: true },
          });
          if (exists) continue;
          await this.prisma.inboxItem.create({
            data: {
              userId: acc.userId,
              accountId: acc.id,
              kind: item.kind || 'comment',
              sourceId: item.sourceId,
              authorName: item.authorName,
              authorId: item.authorId,
              content: item.content,
              mediaUrl: item.mediaUrl,
            },
          });
          pulled += 1;
        }
        await this.prisma.socialAccount.update({
          where: { id: acc.id },
          data: { lastSyncAt: new Date() },
        });
      } catch (err) {
        failed += 1;
        this.logger.warn(`pull_inbox failed for ${acc.provider} ${acc.id}: ${(err as Error).message}`);
      }
    }
    this.logger.log(`Inbox sync done: pulled=${pulled} failed=${failed} accounts=${accounts.length}`);
    return { pulled, failed, accounts: accounts.length };
  }
}
