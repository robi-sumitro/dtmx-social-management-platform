import { Injectable, Logger } from '@nestjs/common';
import { SocialAccount } from '@prisma/client';
import { PlatformAdapter, PlatformResult, PublishContext } from '../platform.types';

/**
 * Fallback adapter used when a provider has neither a matching real adapter
 * nor configured credentials. Lets the pipeline run end-to-end in dev without
 * external API keys by faking a remote id.
 */
@Injectable()
export class SimulatedProvider implements PlatformAdapter {
  readonly provider = '__simulate__';
  private readonly logger = new Logger(SimulatedProvider.name);

  async publish(_account: SocialAccount, post: PublishContext): Promise<PlatformResult> {
    const remoteId = `sim_${Date.now()}_${Math.floor(Math.random() * 1e6)}`;
    this.logger.warn(
      `Simulated publish for "${_account.provider ?? 'unknown'}" (no keys). Post: "${(post.caption || '').slice(0, 40)}"`,
    );
    return { ok: true, remoteId, warning: 'publish disimulasikan tanpa kredensial platform' };
  }

  async reply(): Promise<PlatformResult> {
    return { ok: true, remoteId: `sim_reply_${Date.now()}` };
  }
}