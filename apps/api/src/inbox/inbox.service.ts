import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { FeatureFlagService } from '../features/feature-flag.service';
import { PrismaService } from '../prisma/prisma.service';
import { AIService } from '../ai/ai.service';
import { BulkProcessor } from '../queue/bulk.processor';
import { PlatformsService } from '../platforms/platforms.service';
import { QuotaGuardService } from '../quota/quota-guard.service';

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AIService,
    private readonly flags: FeatureFlagService,
    private readonly bulk: BulkProcessor,
    private readonly platforms: PlatformsService,
    private readonly quota: QuotaGuardService,
  ) {}

  async list(
    userId: string,
    filters: { status?: string; accountId?: string; page?: number; limit?: number; since?: string },
  ) {
    await this.flags.assertEnabled('inbox');
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const where: any = { userId };
    if (filters.status) where.status = filters.status;
    if (filters.accountId) where.accountId = filters.accountId;
    // Incremental: hanya item yang lebih baru dari cursor (createdAt > since).
    // Ditangani di sini agar loop client bisa menambah "baru" tanpa menarik ulang seluruh list.
    if (filters.since) {
      const since = new Date(filters.since);
      if (!isNaN(since.getTime())) where.createdAt = { gt: since };
    }

    // Counts are computed without the status filter so tab badges stay in sync
    // regardless of which tab is currently open.
    const baseWhere: any = { userId };
    if (filters.accountId) baseWhere.accountId = filters.accountId;

    const [items, total, statusGroups] = await Promise.all([
      this.prisma.inboxItem.findMany({
        where,
        include: { account: true },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.inboxItem.count({ where }),
      this.prisma.inboxItem.groupBy({
        by: ['status'],
        where: baseWhere,
        _count: { _all: true },
      }),
    ]);
    const counts = this.buildCounts(statusGroups, total);
    return { items, total, page, limit, counts };
  }

  /**
   * Ringan — hanya total & jumlah per status. Dipakai polling badge agar tidak
   * perlu menarik ulang list penuh setiap 30 detik.
   */
  async counts(userId: string, accountId?: string) {
    await this.flags.assertEnabled('inbox');
    const where: any = { userId };
    if (accountId) where.accountId = accountId;

    const [total, statusGroups] = await Promise.all([
      this.prisma.inboxItem.count({ where }),
      this.prisma.inboxItem.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
    ]);
    return { total, counts: this.buildCounts(statusGroups, total) };
  }

  private buildCounts(statusGroups: Array<{ status: string; _count: { _all: number } }>, total: number) {
    const counts: Record<string, number> = { all: total, new: 0, replied: 0, ignored: 0, queued: 0 };
    for (const g of statusGroups) {
      if (g.status in counts) counts[g.status] = g._count._all;
    }
    return counts;
  }

  async reply(userId: string, inboxId: string, text: string, useAI?: boolean) {
    const item = await this.prisma.inboxItem.findFirst({ where: { id: inboxId, userId } });
    if (!item) throw new NotFoundException('Inbox item tidak ditemukan');

    if (useAI) {
      await this.flags.assertEnabled('ai_replies');
      // Jangan buang kuota AI kalau balasan YouTube akan ditahan penjaga kuota.
      await this.assertReplyBudget(userId, item.accountId);
    }

    let replyContent = text;
    let aiUsed = false;

    if (useAI) {
      const result = await this.consumeQuota(userId, item, text);
      replyContent = result;
      aiUsed = true;
    }
    if (!replyContent) throw new BadRequestException('Konten balasan kosong');

    await this.prisma.inboxItem.update({
      where: { id: inboxId },
      data: { status: 'replied', repliedAt: new Date(), replyContent },
    });
    // Kirim balasan ke platform lewat antrian (komentar/DM).
    await this.bulk.enqueueReply({ inboxId: item.id, accountId: item.accountId, text: replyContent });
    return { inboxId, status: 'replied', replyContent, aiUsed };
  }

  async autoReply(userId: string, inboxId: string) {
    const item = await this.prisma.inboxItem.findFirst({ where: { id: inboxId, userId } });
    if (!item) throw new NotFoundException('Inbox item tidak ditemukan');

    // Jangan buang kuota AI kalau balasan YouTube akan ditahan penjaga kuota.
    await this.assertReplyBudget(userId, item.accountId);

    // Honor the matching enabled rule (template OR AI), exactly like the
    // automatic sync path. Falls back to AI when no rule matches.
    const rule = await this.findMatchingRule(userId, item);
    let reply: string | null = null;

    if (rule && !rule.useAI) {
      reply = (rule.replyTemplate || '').trim() || null;
    } else {
      const prompt =
        (rule?.aiPrompt || 'Balas dengan nada profesional dan ramah. Konten pesan:\n') +
        `"${item.content || item.authorName || ''}"`;
      reply = await this.consumeQuota(userId, item, prompt);
    }

    if (!reply) {
      throw new BadRequestException('Tidak ada balasan untuk dikirim. Periksa isi template/prompt aturan.');
    }

    await this.prisma.inboxItem.update({
      where: { id: inboxId },
      data: { status: 'replied', repliedAt: new Date(), replyContent: reply },
    });
    await this.bulk.enqueueReply({ inboxId: item.id, accountId: item.accountId, text: reply });
    return { inboxId, status: 'replied', replyContent: reply };
  }

  /** Same rule matching used by the inbox-sync auto-reply path. */
  private async findMatchingRule(
    userId: string,
    inbox: { accountId: string; content: string | null },
  ) {
    const rules = await this.prisma.autoReplyRule.findMany({
      where: { userId, enabled: true },
      orderBy: { updatedAt: 'desc' },
    });
    const text = (inbox.content || '').toLowerCase();
    return rules.find((rule) => {
      if (rule.accountId && rule.accountId !== inbox.accountId) return false;
      if (rule.matchType === 'always') return true;
      const needle = (rule.matchText || '').toLowerCase();
      if (!needle) return rule.useAI;
      if (rule.matchType === 'contains') return text.includes(needle);
      if (rule.matchType === 'startsWith') return text.startsWith(needle);
      if (rule.matchType === 'exact') return text === needle;
      return false;
    });
  }

  /** Tolak balasan manual lebih awal bila kuota tulis YouTube user sudah habis. */
  private async assertReplyBudget(userId: string, accountId: string): Promise<void> {
    const acc = await this.prisma.socialAccount.findUnique({ where: { id: accountId } });
    if (acc?.provider !== 'youtube') return;
    const budget = await this.quota.checkWriteBudget('youtube', 50, userId);
    if (!budget.allowed) {
      throw new BadRequestException(budget.reason);
    }
  }

  private async consumeQuota(userId: string, item: any, prompt: string): Promise<string> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
    });
    const quota = sub?.plan?.aiPerMonth || 0;
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const used = await this.prisma.aiUsage.count({ where: { userId, createdAt: { gte: since } } });
    // Only enforce when the plan actually has a quota; 0 used to block even the
    // first AI reply for users without an active subscription.
    if (quota > 0 && used >= quota) {
      throw new BadRequestException('Quota AI bulanan habis. Upgrade paket atau isi ulang kuota.');
    }

    const result = await this.ai.complete(prompt, { temperature: 0.6, feature: 'auto_reply' });
    await this.prisma.aiUsage.create({
      data: {
        userId,
        feature: 'auto_reply',
        provider: this.ai.activeProvider,
        inputTokens: result.inputTokens,
        outputTokens: result.outputTokens,
        prompt: prompt.slice(0, 2000),
        result: result.content.slice(0, 5000),
        accountId: item.accountId,
      },
    });
    return result.content;
  }

  async mark(userId: string, id: string, status: string) {
    return this.prisma.inboxItem.update({
      where: { id },
      data: { status },
    });
  }

  /**
   * Hapus komentar: dari platform (channel) langsung + dari database.
   * Jika penghapusan dari platform gagal/ditolak, item tetap dihapus dari
   * database dan alasan kegagalan dikembalikan sebagai peringatan.
   */
  async remove(userId: string, inboxId: string) {
    const item = await this.prisma.inboxItem.findFirst({
      where: { id: inboxId, userId },
      include: { account: true },
    });
    if (!item) throw new NotFoundException('Inbox item tidak ditemukan');

    let warning: string | undefined;
    if (item.sourceId && item.account) {
      const provider = item.account.provider;
      if (this.platforms.supportsDelete(provider)) {
        try {
          await this.platforms.deleteComment(item.account, item.sourceId);
        } catch (err) {
          warning = `Komentar dihapus dari inbox, tetapi gagal dihapus dari ${provider}: ${(err as Error).message}`;
        }
      } else {
        warning = `Penghapusan dari ${provider} tidak didukung via API; hanya dihapus dari database.`;
      }
    }

    await this.prisma.inboxItem.delete({ where: { id: inboxId } });
    return { ok: true, warning };
  }
}