import { Injectable, NotFoundException } from '@nestjs/common';
import { FeatureFlagService } from '../features/feature-flag.service';
import { PrismaService } from '../prisma/prisma.service';

export interface AutoReplyInput {
  name: string;
  accountId?: string;
  matchType?: string;
  matchText?: string;
  replyTemplate?: string;
  useAI?: boolean;
  aiProvider?: string;
  aiPrompt?: string;
  enabled?: boolean;
}

const MATCH_TYPES = ['contains', 'startsWith', 'exact', 'always'];

@Injectable()
export class AutoRepliesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
  ) {}

  async list(userId: string) {
    await this.flags.assertEnabled('ai_replies');
    const rules = await this.prisma.autoReplyRule.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
    });
    return this.withAccounts(rules);
  }

  async create(userId: string, input: AutoReplyInput) {
    await this.flags.assertEnabled('ai_replies');
    const rule = await this.prisma.autoReplyRule.create({
      data: {
        userId,
        name: input.name || 'Aturan baru',
        accountId: input.accountId || null,
        matchType: this.sanitizeMatchType(input.matchType),
        matchText: input.matchText || null,
        replyTemplate: input.replyTemplate || null,
        useAI: input.useAI ?? false,
        aiProvider: input.aiProvider || null,
        aiPrompt: input.aiPrompt || null,
        enabled: input.enabled ?? true,
      },
    });
    return this.withAccounts([rule]).then((r) => r[0]);
  }

  async update(userId: string, id: string, input: AutoReplyInput) {
    await this.flags.assertEnabled('ai_replies');
    const existing = await this.prisma.autoReplyRule.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Aturan tidak ditemukan');
    const rule = await this.prisma.autoReplyRule.update({
      where: { id },
      data: {
        name: input.name ?? existing.name,
        accountId: input.accountId ?? existing.accountId,
        matchType: input.matchType ? this.sanitizeMatchType(input.matchType) : existing.matchType,
        matchText: input.matchText ?? existing.matchText,
        replyTemplate: input.replyTemplate ?? existing.replyTemplate,
        useAI: input.useAI ?? existing.useAI,
        aiProvider: input.aiProvider ?? existing.aiProvider,
        aiPrompt: input.aiPrompt ?? existing.aiPrompt,
        enabled: input.enabled ?? existing.enabled,
      },
    });
    return this.withAccounts([rule]).then((r) => r[0]);
  }

  async toggle(userId: string, id: string) {
    const existing = await this.prisma.autoReplyRule.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Aturan tidak ditemukan');
    const rule = await this.prisma.autoReplyRule.update({
      where: { id },
      data: { enabled: !existing.enabled },
    });
    return this.withAccounts([rule]).then((r) => r[0]);
  }

  async remove(userId: string, id: string) {
    const existing = await this.prisma.autoReplyRule.findFirst({ where: { id, userId } });
    if (!existing) throw new NotFoundException('Aturan tidak ditemukan');
    await this.prisma.autoReplyRule.delete({ where: { id } });
    return { ok: true };
  }

  private async withAccounts(rules: any[]) {
    const ids = [...new Set(rules.map((r) => r.accountId).filter(Boolean))] as string[];
    const accounts = ids.length
      ? await this.prisma.socialAccount.findMany({ where: { id: { in: ids } } })
      : [];
    const map = new Map(accounts.map((a) => [a.id, a]));
    return rules.map((r) => ({ ...r, account: r.accountId ? (map.get(r.accountId) ?? null) : null }));
  }

  private sanitizeMatchType(type?: string): string {
    return type && MATCH_TYPES.includes(type) ? type : 'contains';
  }
}
