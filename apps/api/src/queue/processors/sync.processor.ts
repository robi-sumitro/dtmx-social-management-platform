import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { PlatformsService } from '../../platforms/platforms.service';
import { SocialAccountsService } from '../../social-accounts/social-accounts.service';
import { AIService } from '../../ai/ai.service';
import { BulkProcessor } from '../../queue/bulk.processor';
import { NotificationsService } from '../../notifications/notifications.service';
import { QuotaGuardService } from '../../quota/quota-guard.service';

type AutoReplyRule = {
  id: string;
  accountId: string | null;
  matchType: string;
  matchText: string | null;
  replyTemplate: string | null;
  useAI: boolean;
  aiPrompt: string | null;
};

@Processor('sync')
export class SyncProcessor extends WorkerHost {
  private readonly logger = new Logger(SyncProcessor.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly platforms: PlatformsService,
    private readonly social: SocialAccountsService,
    private readonly ai: AIService,
    private readonly bulk: BulkProcessor,
    private readonly notifications: NotificationsService,
    private readonly quota: QuotaGuardService,
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
        const accountRef = fresh ?? acc;
        // Source ids already in the inbox, so adapters can skip re-fetching
        // sub-resources (e.g. every YouTube thread's reply tree on each sync).
        const existingRows = await this.prisma.inboxItem.findMany({
          where: { userId: acc.userId, accountId: acc.id },
          select: { sourceId: true },
        });
        const existingIds = existingRows.map((r) => r.sourceId).filter(Boolean) as string[];
        const items = await this.platforms.pullInbox(accountRef, undefined, existingIds);
        for (const item of items) {
          if (!item.sourceId) continue;
          // Skip our own comments/replies (author == the channel/page itself).
          // Otherwise the bot would auto-reply to its own replies endlessly.
          const ownIds = [accountRef.platformId, accountRef.instagramId].filter(Boolean);
          if (item.authorId && ownIds.includes(item.authorId)) continue;
          const exists = await this.prisma.inboxItem.findFirst({
            where: { userId: acc.userId, accountId: acc.id, sourceId: item.sourceId },
            select: { id: true },
          });
          if (exists) continue;
          const inbox = await this.prisma.inboxItem.create({
            data: {
              userId: acc.userId,
              accountId: acc.id,
              kind: item.kind || 'comment',
              sourceId: item.sourceId,
              authorName: item.authorName,
              authorId: item.authorId,
              content: item.content,
              mediaUrl: item.mediaUrl,
              parentId: item.parentId || undefined,
              // Use the real comment timestamp so "terbaru" ordering reflects
              // the platform's time, not the moment the sync pulled it.
              createdAt: item.publishedAt ? new Date(item.publishedAt) : undefined,
            },
          });
          pulled += 1;
          await this.notifyInbox(acc, inbox);
          await this.tryAutoReply(acc, inbox);
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

  /** Push a bell notification whenever a new comment/DM/mention arrives. */
  private async notifyInbox(
    acc: { userId: string; accountName: string },
    inbox: { id: string; kind: string; authorName: string | null; content: string | null },
  ): Promise<void> {
    try {
      const kindLabel = inbox.kind === 'dm' ? 'DM' : inbox.kind === 'mention' ? 'Sebutan' : 'Komentar';
      await this.notifications.create({
        userId: acc.userId,
        type: 'inbox',
        title: `${kindLabel} baru dari ${inbox.authorName || 'pengguna'}`,
        message: `${acc.accountName}: ${(inbox.content || '').slice(0, 120)}`,
        link: '/app/inbox',
        data: { inboxId: inbox.id, kind: inbox.kind, accountName: acc.accountName },
      });
    } catch (err) {
      this.logger.warn(`failed to notify inbox item ${inbox.id}: ${(err as Error).message}`);
    }
  }

  /** Evaluate auto-reply rules for a freshly pulled inbox item and enqueue a reply when matched. */
  private async tryAutoReply(
    acc: { userId: string; provider: string },
    inbox: {
      id: string;
      accountId: string;
      kind: string;
      authorName: string | null;
      content: string | null;
    },
  ): Promise<void> {
    try {
      const rules = (await this.prisma.autoReplyRule.findMany({
        where: { userId: acc.userId, enabled: true },
        orderBy: { updatedAt: 'desc' },
      })) as AutoReplyRule[];

      const text = (inbox.content || '').toLowerCase();
      const matched = rules.find((rule) => {
        if (rule.accountId && rule.accountId !== inbox.accountId) return false;
        if (rule.matchType === 'always') return true;
        const needle = (rule.matchText || '').toLowerCase();
        if (!needle) return rule.useAI;
        if (rule.matchType === 'contains') return text.includes(needle);
        if (rule.matchType === 'startsWith') return text.startsWith(needle);
        if (rule.matchType === 'exact') return text === needle;
        return false;
      });
      if (!matched) return;

      // Jangan buang kuota AI untuk balasan yang ujungnya ditahan penjaga
      // kuota YouTube (50 unit per balasan). Cek dulu sisa anggaran tulis.
      if (acc.provider === 'youtube') {
        const budget = await this.quota.checkWriteBudget('youtube', 50, acc.userId);
        if (!budget.allowed) {
          this.logger.warn(`auto-reply skipped for user ${acc.userId}: ${budget.reason}`);
          return;
        }
      }

      const reply = await this.buildReply(acc.userId, inbox, matched);
      if (!reply) return;

      await this.prisma.inboxItem.update({
        where: { id: inbox.id },
        data: { status: 'queued', replyContent: reply },
      });
      await this.bulk.enqueueReply({
        inboxId: inbox.id,
        accountId: inbox.accountId,
        text: reply,
      });
      this.logger.log(`Auto-replied to inbox ${inbox.id} using rule ${matched.id}`);
    } catch (err) {
      this.logger.warn(`auto-reply failed for inbox ${inbox.id}: ${(err as Error).message}`);
    }
  }

  private async buildReply(
    userId: string,
    inbox: { content: string | null; authorName: string | null },
    rule: AutoReplyRule,
  ): Promise<string | null> {
    if (!rule.useAI) {
      return (rule.replyTemplate || '').trim() || null;
    }
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
    });
    const quota = sub?.plan?.aiPerMonth || 0;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const used = await this.prisma.aiUsage.count({ where: { userId, createdAt: { gte: since } } });
    // Only enforce the cap when the plan actually has one. quota=0 (no active
    // subscription/plan) previously made `used >= 0` always true and silently
    // skipped every AI auto-reply.
    if (quota > 0 && used >= quota) {
      this.logger.warn(`AI quota exhausted for user ${userId} — auto-reply skipped`);
      return null;
    }
    const prompt =
      (rule.aiPrompt || 'Balas dengan nada profesional dan ramah. Konten pesan:\n') +
      `"${inbox.content || inbox.authorName || ''}"`;
    const result = await this.ai.complete(prompt, { temperature: 0.6 });
    const reply = (result.content || '').trim();
    if (!reply) return null;
    await this.prisma.aiUsage.create({
      data: {
        userId,
        feature: 'auto_reply',
        provider: this.ai.activeProvider,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        prompt: prompt.slice(0, 2000),
        result: result.content.slice(0, 5000),
      },
    });
    return reply;
  }
}
