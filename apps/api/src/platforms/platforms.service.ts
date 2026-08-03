import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { SocialAccount } from '@prisma/client';
import { PlatformAdapter, PublishContext, ReplyContext } from './platform.types';
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
}