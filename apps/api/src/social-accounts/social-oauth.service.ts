import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import axios from 'axios';
import { SocialAccountsService } from './social-accounts.service';
import { getAppBaseUrl, getFrontendUrl } from '../common/app-url';

const FB_GRAPH = 'https://graph.facebook.com/v24.0';
const FB_DIALOG = 'https://www.facebook.com/v24.0/dialog/oauth';
const GOOGLE_OAUTH = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token';
const YOUTUBE_API = 'https://www.googleapis.com/youtube/v3';
const TIKTOK_AUTH = 'https://www.tiktok.com/v2/auth/authorize/';
const TIKTOK_TOKEN = 'https://open.tiktokapis.com/v2/oauth/token/';
const TIKTOK_API = 'https://open.tiktokapis.com/v2';

const CONNECT_SCOPES: Record<string, string> = {
  facebook: ['pages_show_list', 'pages_manage_posts', 'pages_read_engagement'].join(','),
  youtube: [
    'https://www.googleapis.com/auth/youtube.readonly',
    'https://www.googleapis.com/auth/youtube.upload',
  ].join(' '),
  tiktok: 'user.info.basic,video.publish',
};

/**
 * OAuth "connect account" flow (independent from login).
 * - facebook (+instagram): page management scopes; callback imports FB pages and any linked IG business account.
 * - youtube: channel read/publish scopes; callback imports the YouTube channel.
 * - tiktok: user info + video publish scopes; callback imports the TikTok account.
 */
@Injectable()
export class SocialOAuthService {
  private readonly logger = new Logger(SocialOAuthService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly jwt: JwtService,
    private readonly social: SocialAccountsService,
  ) {}

  getAuthorizeUrl(provider: string, userId: string): string {
    const base = getAppBaseUrl(this.config);
    const state = this.jwt.sign({ sub: userId }, { expiresIn: '15m' });

    if (provider === 'youtube') {
      const clientId = this.config.get<string>('GOOGLE_CLIENT_ID', '');
      if (!clientId) throw new BadRequestException('Google OAuth belum dikonfigurasi');
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${base}/api/social-accounts/auth/youtube/callback`,
        response_type: 'code',
        scope: CONNECT_SCOPES.youtube,
        access_type: 'offline',
        prompt: 'consent',
        state,
      });
      return `${GOOGLE_OAUTH}?${params.toString()}`;
    }

    if (provider === 'facebook' || provider === 'instagram') {
      const clientId = this.config.get<string>('FACEBOOK_APP_ID', '');
      if (!clientId) throw new BadRequestException('Facebook OAuth belum dikonfigurasi');
      const params = new URLSearchParams({
        client_id: clientId,
        redirect_uri: `${base}/api/social-accounts/auth/facebook/callback`,
        response_type: 'code',
        scope: CONNECT_SCOPES.facebook,
        state,
      });
      return `${FB_DIALOG}?${params.toString()}`;
    }

    if (provider === 'tiktok') {
      const clientKey = this.config.get<string>('TIKTOK_CLIENT_KEY', '');
      if (!clientKey) throw new BadRequestException('TikTok OAuth belum dikonfigurasi');
      const params = new URLSearchParams({
        client_key: clientKey,
        response_type: 'code',
        scope: CONNECT_SCOPES.tiktok,
        redirect_uri: `${base}/api/social-accounts/auth/tiktok/callback`,
        state,
      });
      return `${TIKTOK_AUTH}?${params.toString()}`;
    }

    throw new BadRequestException('Provider tidak mendukung OAuth connect');
  }

  async handleCallback(provider: string, code: string, state: string): Promise<string> {
    const base = getAppBaseUrl(this.config);
    let userId: string;
    try {
      const payload = this.jwt.verify(state);
      userId = payload.sub;
    } catch {
      throw new BadRequestException('Sesi OAuth tidak valid, silakan coba lagi');
    }

    if (provider === 'youtube') return this.handleYoutube(userId, code, base);
    if (provider === 'facebook') return this.handleFacebook(userId, code, base);
    if (provider === 'tiktok') return this.handleTiktok(userId, code, base);
    throw new BadRequestException('Provider tidak didukung');
  }

  private async handleFacebook(userId: string, code: string, base: string) {
    const clientId = this.config.get<string>('FACEBOOK_APP_ID', '');
    const clientSecret = this.config.get<string>('FACEBOOK_APP_SECRET', '');
    const redirectUri = `${base}/api/social-accounts/auth/facebook/callback`;

    const { data: tok } = await axios.get(`${FB_GRAPH}/oauth/access_token`, {
      params: { client_id: clientId, client_secret: clientSecret, code, redirect_uri: redirectUri },
    });
    const userToken = tok.access_token as string;

    // Exchange the short-lived user token for a long-lived one (~60 days).
    let longLived = userToken;
    try {
      const { data: ext } = await axios.get(`${FB_GRAPH}/oauth/access_token`, {
        params: {
          grant_type: 'fb_exchange_token',
          client_id: clientId,
          client_secret: clientSecret,
          fb_exchange_token: userToken,
        },
      });
      if (ext.access_token) longLived = ext.access_token;
    } catch (err) {
      this.logger.warn(`Long-lived token exchange failed, falling back: ${(err as Error).message}`);
    }

    const { data: res } = await axios.get(`${FB_GRAPH}/me/accounts`, {
      params: {
        access_token: userToken,
        fields: 'id,name,link,picture.type(large),access_token,fan_count,instagram_business_account{id,username,profile_picture_url}',
      },
    });
    const pages: any[] = res?.data ?? [];

    let connected = 0;
    const errors: string[] = [];
    for (const page of pages) {
      const pageToken = page.access_token || longLived;
      try {
        const saved = await this.social.connect(userId, {
          provider: 'facebook',
          accountType: 'facebook_page',
          accountName: page.name,
          platformId: page.id,
          accessToken: pageToken,
          refreshToken: longLived,
          avatarUrl: page.picture?.data?.url,
          followersCount: page.fan_count || 0,
          tokenExpiresAt: new Date(Date.now() + 60 * 24 * 3600 * 1000).toISOString(),
        });
        connected += 1;

        const ig = page.instagram_business_account;
        if (ig?.id) {
          // Linked IG business counts as part of the same slot (parentId = page).
          await this.social.connect(userId, {
            provider: 'instagram',
            accountType: 'instagram',
            accountName: ig.username || 'Instagram',
            platformId: ig.id,
            instagramId: ig.id,
            accessToken: pageToken,
            refreshToken: longLived,
            avatarUrl: ig.profile_picture_url,
            parentId: saved.id,
          });
          connected += 1;
        }
      } catch (err) {
        this.logger.warn(`Failed to connect page ${page.id}: ${(err as Error).message}`);
        errors.push((err as Error).message);
      }
    }

    this.logger.log(`User ${userId} connected ${connected} FB/IG accounts`);
    if (connected === 0) {
      return `${getFrontendUrl(this.config)}/app/accounts?error=${encodeURIComponent(errors[0] || 'Tidak ada halaman Facebook yang bisa dihubungkan pada akun ini.')}`;
    }
    if (errors.length > 0) {
      return `${getFrontendUrl(this.config)}/app/accounts?connected=${connected}&error=${encodeURIComponent(errors[0])}`;
    }
    return `${getFrontendUrl(this.config)}/app/accounts?connected=${connected}`;
  }

  private async handleYoutube(userId: string, code: string, base: string) {
    const clientId = this.config.get<string>('GOOGLE_CLIENT_ID', '');
    const clientSecret = this.config.get<string>('GOOGLE_CLIENT_SECRET', '');
    const redirectUri = `${base}/api/social-accounts/auth/youtube/callback`;

    const { data: tok } = await axios.post(
      GOOGLE_TOKEN,
      new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const accessToken = tok.access_token as string;
    const refreshToken = tok.refresh_token as string | undefined;

    const { data: ch } = await axios.get(`${YOUTUBE_API}/channels`, {
      params: { part: 'snippet,statistics', mine: true },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const channel = ch?.items?.[0];
    if (!channel) {
      throw new BadRequestException('Tidak ada channel YouTube pada akun Google ini');
    }

    await this.social.connect(userId, {
      provider: 'youtube',
      accountType: 'youtube_channel',
      accountName: channel.snippet?.title || 'YouTube Channel',
      platformId: channel.id,
      accessToken,
      refreshToken,
      avatarUrl: channel.snippet?.thumbnails?.default?.url,
      followersCount: Number(channel.statistics?.subscriberCount) || 0,
      tokenExpiresAt: new Date(Date.now() + 3600 * 1000).toISOString(),
    });

    this.logger.log(`User ${userId} connected YouTube channel ${channel.id}`);
    return `${getFrontendUrl(this.config)}/app/accounts?connected=1`;
  }

  private async handleTiktok(userId: string, code: string, base: string) {
    const clientKey = this.config.get<string>('TIKTOK_CLIENT_KEY', '');
    const clientSecret = this.config.get<string>('TIKTOK_CLIENT_SECRET', '');
    const redirectUri = `${base}/api/social-accounts/auth/tiktok/callback`;

    const { data: tok } = await axios.post(
      TIKTOK_TOKEN,
      new URLSearchParams({
        client_key: clientKey,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
        redirect_uri: redirectUri,
      }).toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } },
    );
    const accessToken = tok.access_token as string;
    const refreshToken = tok.refresh_token as string | undefined;
    if (!accessToken || !tok.open_id) {
      throw new BadRequestException('TikTok menolak otorisasi. Silakan coba lagi.');
    }

    const { data: info } = await axios.get(`${TIKTOK_API}/user/info/`, {
      params: { fields: 'open_id,avatar_url,display_name,follower_count' },
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const u = info?.data?.user;
    const openId = u?.open_id || (tok.open_id as string);
    if (!u) {
      throw new BadRequestException('Gagal mengambil info akun TikTok');
    }

    await this.social.connect(userId, {
      provider: 'tiktok',
      accountType: 'tiktok_account',
      accountName: u.display_name || 'Akun TikTok',
      platformId: openId,
      accessToken,
      refreshToken,
      avatarUrl: u.avatar_url,
      followersCount: Number(u.follower_count) || 0,
      tokenExpiresAt: new Date(Date.now() + (tok.expires_in || 86400) * 1000).toISOString(),
    });

    this.logger.log(`User ${userId} connected TikTok account ${openId}`);
    return `${getFrontendUrl(this.config)}/app/accounts?connected=1`;
  }
}
