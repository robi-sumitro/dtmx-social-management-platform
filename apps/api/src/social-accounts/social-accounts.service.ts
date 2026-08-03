import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { PrismaService } from '../prisma/prisma.service';

const FB_GRAPH = 'https://graph.facebook.com/v24.0';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';

@Injectable()
export class SocialAccountsService {
  private readonly logger = new Logger(SocialAccountsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async connect(
    userId: string,
    data: {
      provider: string;
      accountType: string;
      accountName: string;
      platformId: string;
      accessToken?: string;
      refreshToken?: string;
      instagramId?: string;
      avatarUrl?: string;
      followersCount?: number;
      tokenExpiresAt?: string;
      parentId?: string;
    },
  ) {
    const plan = await this.limitCheck(userId);
    const existing = await this.prisma.socialAccount.findFirst({
      where: { userId, provider: data.provider, platformId: data.platformId },
    });
    if (!existing && !data.parentId) {
      // Only primary accounts (no parent) consume a slot.
      const count = await this.prisma.socialAccount.count({
        where: { userId, isActive: true, parentId: null },
      });
      if (count >= (plan || { maxAccounts: 1 }).maxAccounts) {
        throw new BadRequestException('Jumlah akun sudah mencapai batas paket');
      }
    }
    return this.prisma.socialAccount.upsert({
      where: { id: existing?.id || '__none__' },
      create: {
        userId,
        provider: data.provider,
        accountType: data.accountType,
        accountName: data.accountName,
        platformId: data.platformId,
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
        instagramId: data.instagramId,
        avatarUrl: data.avatarUrl,
        followersCount: data.followersCount || 0,
        tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : null,
        parentId: data.parentId ?? null,
      },
      update: {
        accessToken: data.accessToken ?? undefined,
        refreshToken: data.refreshToken ?? undefined,
        tokenExpiresAt: data.tokenExpiresAt ? new Date(data.tokenExpiresAt) : undefined,
        accountName: data.accountName,
        avatarUrl: data.avatarUrl ?? undefined,
        followersCount: data.followersCount ?? undefined,
        isActive: true,
      },
    });
  }

  async limitCheck(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
    }).then((s) => s?.plan || null);
  }

  async list(userId: string) {
    return this.prisma.socialAccount.findMany({
      where: { userId },
      orderBy: { createdAt: 'asc' },
    });
  }

  async remove(userId: string, id: string) {
    const acc = await this.prisma.socialAccount.findFirst({ where: { id, userId } });
    if (!acc) throw new NotFoundException('Akun tidak ditemukan');
    await this.prisma.socialAccount.updateMany({
      where: { OR: [{ id }, { parentId: id }] },
      data: { isActive: false },
    });
    return { ok: true };
  }

  /**
   * Refresh credentials for every active account the user owns.
   * - facebook: extend the long-lived user token, then re-fetch page tokens.
   * - youtube: exchange the refresh token for a fresh access token.
   */
  async refreshTokenAll(userId: string) {
    const accounts = await this.prisma.socialAccount.findMany({
      where: { userId, isActive: true },
    });
    const results: { id: string; accountName: string; ok: boolean; error?: string }[] = [];

    for (const acc of accounts) {
      try {
        if (acc.provider === 'youtube') {
          await this.refreshYoutube(acc);
        } else if (acc.provider === 'facebook') {
          await this.refreshFacebook(acc);
        }
        results.push({ id: acc.id, accountName: acc.accountName, ok: true });
      } catch (err) {
        this.logger.warn(`Refresh failed for ${acc.provider} ${acc.id}: ${(err as Error).message}`);
        results.push({
          id: acc.id,
          accountName: acc.accountName,
          ok: false,
          error: (err as Error).message,
        });
      }
    }

    await this.prisma.socialAccount.updateMany({
      where: { userId },
      data: { lastSyncAt: new Date() },
    });

    return {
      ok: true,
      total: results.length,
      refreshed: results.filter((r) => r.ok).length,
      failed: results.filter((r) => !r.ok).length,
      results,
    };
  }

  private async refreshYoutube(acc: {
    id: string; provider: string; refreshToken: string | null;
  }): Promise<void> {
    const refreshToken = acc.refreshToken;
    if (!refreshToken) throw new BadRequestException('Tidak ada refresh token (hubungkan ulang via OAuth)');
    const { data } = await axios.post(
      GOOGLE_TOKEN,
      new URLSearchParams({
        refresh_token: refreshToken,
        client_id: this.config.get<string>('GOOGLE_CLIENT_ID', ''),
        client_secret: this.config.get<string>('GOOGLE_CLIENT_SECRET', ''),
        grant_type: 'refresh_token',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const accessToken = data.access_token as string;
    if (!accessToken) throw new BadRequestException('Google menolak refresh token');
    await this.prisma.socialAccount.update({
      where: { id: acc.id },
      data: {
        accessToken,
        tokenIssuedAt: new Date(),
        tokenExpiresAt: new Date(Date.now() + 3600 * 1000),
      },
    });
  }

  private async refreshFacebook(acc: {
    id: string; provider: string; platformId: string; accessToken: string | null;
    refreshToken: string | null;
  }): Promise<void> {
    const clientId = this.config.get<string>('FACEBOOK_APP_ID', '');
    const clientSecret = this.config.get<string>('FACEBOOK_APP_SECRET', '');
    const userToken = acc.refreshToken || acc.accessToken;
    if (!userToken) throw new BadRequestException('Tidak ada token (hubungkan ulang via OAuth)');

    // Extend the user token (if it came from the OAuth connect flow) to keep it long-lived.
    let longLived = userToken;
    if (acc.refreshToken) {
      const { data: ext } = await axios.get(`${FB_GRAPH}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: userToken,
        },
      });
      if (ext.access_token) longLived = ext.access_token;
    }

    // Re-fetch the page token using the long-lived user token.
    const { data: page } = await axios.get(`${FB_GRAPH}/${acc.platformId}`, {
      params: { fields: 'access_token', access_token: longLived },
    });
    const pageToken = page.access_token || longLived;
    if (!pageToken) throw new BadRequestException('Facebook menolak token');

    await this.prisma.socialAccount.update({
      where: { id: acc.id },
      data: {
        accessToken: pageToken,
        refreshToken: acc.refreshToken ? longLived : undefined,
        tokenIssuedAt: new Date(),
        tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000),
      },
    });

    // Sync child IG accounts with the fresh page token.
    await this.prisma.socialAccount.updateMany({
      where: { parentId: acc.id, isActive: true },
      data: { accessToken: pageToken, lastSyncAt: new Date() },
    });
  }
}
