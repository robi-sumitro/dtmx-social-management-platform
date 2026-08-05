import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SocialAccount } from '@prisma/client';
import {
  InboxPullItem,
  PlatformAdapter,
  PlatformInsights,
  PublishContext,
  ReplyContext,
} from './platform.types';
import { FacebookProvider } from './providers/facebook.provider';
import { InstagramProvider } from './providers/instagram.provider';
import { YoutubeProvider } from './providers/youtube.provider';
import { TiktokProvider } from './providers/tiktok.provider';
import { SimulatedProvider } from './providers/simulated.provider';

@Injectable()
export class PlatformsService implements OnModuleInit {
  private readonly logger = new Logger(PlatformsService.name);
  private readonly registry = new Map<string, PlatformAdapter>();
  private simulated: SimulatedProvider;

  constructor(
    facebook: FacebookProvider,
    instagram: InstagramProvider,
    youtube: YoutubeProvider,
    tiktok: TiktokProvider,
    simulated: SimulatedProvider,
  ) {
    this.simulated = simulated;
    for (const p of [facebook, instagram, youtube, tiktok]) {
      this.registry.set(p.provider, p);
    }
  }

  onModuleInit() {
    this.logger.log(`Registered platform adapters: ${[...this.registry.keys()].join(', ')}`);
  }

  supports(provider: string): boolean {
    return this.registry.has(provider);
  }

  private adapterFor(account: SocialAccount): PlatformAdapter {
    return this.registry.get(account.provider) ?? this.simulated;
  }

  /** Publish a post for a single connected account. Returns remote id when available. */
  async publish(
    account: SocialAccount,
    post: PublishContext,
  ): Promise<string | null> {
    if (!account.isActive) {
      throw new Error(`Account "${account.accountName}" tidak aktif`);
    }
    const adapter = this.adapterFor(account);
    const result = await adapter.publish(account, post);
    if (result.warning) this.logger.warn(`[${account.provider}] ${result.warning}`);
    return result.remoteId ?? null;
  }

  /** Push a reply to a platform. Returns true on success. */
  async reply(account: SocialAccount, ctx: ReplyContext): Promise<boolean> {
    const adapter = this.adapterFor(account);
    if (typeof adapter.reply !== 'function') return false;
const result = await adapter.reply(account, ctx);
    return result.ok;
  }

  /** Whether the platform supports deleting a comment from the channel. */
  supportsDelete(provider: string): boolean {
    const adapter = this.registry.get(provider);
    return Boolean(adapter && typeof adapter.deleteComment === 'function');
  }

  /** Delete a comment/reply from the platform. Throws on hard failure. */
  async deleteComment(account: SocialAccount, targetId: string): Promise<void> {
    const adapter = this.adapterFor(account);
    if (typeof adapter.deleteComment !== 'function') {
      throw new Error(`Hapus komentar tidak didukung untuk platform ${account.provider}`);
    }
    const result = await adapter.deleteComment(account, targetId);
    if (!result.ok) throw new Error(`Hapus komentar ditolak platform ${account.provider}`);
  }

  /** Pull inbox items (comments/DMs) from the platform. Returns [] when unsupported. */
  async pullInbox(account: SocialAccount, since?: Date): Promise<InboxPullItem[]> {
    const adapter = this.adapterFor(account);
    if (typeof adapter.pullInbox !== 'function') return [];
    return adapter.pullInbox(account, since);
  }

  /** Fetch aggregated engagement insights. Returns null when unsupported. */
  async insights(account: SocialAccount, since?: Date): Promise<PlatformInsights | null> {
    const adapter = this.adapterFor(account);
    if (typeof adapter.insights !== 'function') return null;
    return adapter.insights(account, since);
  }
}