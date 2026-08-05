import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformsService } from '../../platforms/platforms.service';
import { SocialAccountsService } from '../../social-accounts/social-accounts.service';

@Processor('replies')
export class RepliesProcessor extends WorkerHost {
  private readonly logger = new Logger(RepliesProcessor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly platforms: PlatformsService,
    private readonly social: SocialAccountsService,
  ) {
    super();
  }
  async process(job: Job): Promise<any> {
    const { inboxId, accountId, text } = job.data;
    this.logger.log(`Sending reply for inbox ${inboxId} on account ${accountId}`);

    const inbox = await this.prisma.inboxItem.findUnique({ where: { id: inboxId } });
    let account = await this.prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (!inbox || !account) return { skipped: true, reason: 'inbox/account missing' };

    // Refresh credentials nearing/over expiry (e.g. YouTube 1-hour access token).
    if (account.tokenExpiresAt && new Date(account.tokenExpiresAt).getTime() - Date.now() < 10 * 60 * 1000) {
      try {
        await this.social.refreshAccount(account.id);
      } catch (err) {
        this.logger.warn(`token refresh failed for ${account.provider} ${account.id}: ${(err as Error).message}`);
      }
      const fresh = await this.prisma.socialAccount.findUnique({ where: { id: accountId } });
      if (fresh) account = fresh;
    }

    const sent = await this.platforms.reply(account, {
      text,
      authorId: inbox.authorId,
      targetId: inbox.sourceId,
      kind: inbox.kind,
    });

    await this.prisma.inboxItem.update({
      where: { id: inboxId },
      data: {
        status: sent ? 'replied' : 'queued',
        repliedAt: sent ? new Date() : undefined,
        replyContent: sent ? text : undefined,
      },
    });
    return { ok: sent, text };
  }
}