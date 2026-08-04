import {
  Injectable,
  UnauthorizedException,
  ConflictException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from './email.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';

interface OauthSession {
  accessToken: string;
  refreshToken: string;
  channels?: any[];
  expiresAt: number;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  private oauthSessions = new Map<string, OauthSession>();

  private revokedJtis = new Map<string, number>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly config: ConfigService,
    private readonly email: EmailService,
  ) {}

  createOauthSession(tokens: { accessToken: string; refreshToken: string }, channels?: any[]): string {
    const code = randomBytes(24).toString('hex');
    this.oauthSessions.set(code, {
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      channels,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
    return code;
  }

  consumeOauthSession(code: string): OauthSession | undefined {
    const session = this.oauthSessions.get(code);
    if (!session) return undefined;
    this.oauthSessions.delete(code);
    if (session.expiresAt < Date.now()) return undefined;
    return session;
  }

  async getMe(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true, email: true, username: true, fullName: true, avatar: true,
        role: true, isActive: true, quotaAi: true, lastLoginAt: true, createdAt: true,
      },
    });
    if (!user) throw new UnauthorizedException('User tidak ditemukan');
    return user;
  }

  async register(dto: RegisterDto) {
    const existing = await this.prisma.user.findFirst({
      where: { OR: [{ email: dto.email }, { username: dto.username }] },
    });
    if (existing) throw new ConflictException('Email atau username sudah terdaftar');

    const hash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        username: dto.username,
        passwordHash: hash,
        fullName: dto.fullName,
      },
    });

    // Ensure a free subscription exists so usage limits have a base.
    await this.assignFreeSubscription(user.id);

    this.email.sendWelcome(dto.email);
    return this.issueTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Email atau password salah');
    }
    const ok = await bcrypt.compare(dto.password, user.passwordHash);
    if (!ok) throw new UnauthorizedException('Email atau password salah');
    if (!user.isActive) throw new UnauthorizedException('Akun dinonaktifkan');

    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return this.issueTokens(user);
  }

  async oauthLogin(provider: 'google' | 'facebook', profile: {
    id: string; email: string; name?: string; avatar?: string;
  }) {
    if (!profile.email) throw new UnauthorizedException('Platform tidak memberikan email');
    let user = await this.prisma.user.findUnique({ where: { email: profile.email } });
    if (user && !user.isActive) {
      throw new UnauthorizedException('Akun dinonaktifkan. Hubungi administrator.');
    }
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: profile.email,
          username: profile.email.split('@')[0],
          fullName: profile.name,
          avatar: profile.avatar,
          oauthProvider: provider,
          oauthId: profile.id,
        },
      });
      await this.assignFreeSubscription(user.id);
    } else if (!user.oauthId) {
      // link the provider to an existing manual account
      await this.prisma.user.update({
        where: { id: user.id },
        data: { oauthProvider: provider, oauthId: profile.id },
      });
    }
    return this.issueTokens(user);
  }

  googleValidate(profile, accessToken?: string) {
    const result = this.oauthLogin('google', {
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
      id: profile.id,
    });
    return result.then(async (r) => ({
      ...r,
      channels: await this.detectGoogleChannels(accessToken ?? ''),
    }));
  }

  facebookValidate(profile, accessToken?: string) {
    const result = this.oauthLogin('facebook', {
      email: profile.emails?.[0]?.value,
      name: profile.displayName,
      avatar: profile.photos?.[0]?.value,
      id: profile.id,
    });
    return result.then(async (r) => ({
      ...r,
      channels: await this.detectFacebookPages(accessToken ?? ''),
    }));
  }

  async forgotPassword(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    // Always success (no email enumeration)
    if (user) {
      const token = randomBytes(32).toString('hex');
      const expires = new Date(Date.now() + 2 * 3600 * 1000);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { resetToken: token, resetTokenExpires: expires },
      });
      await this.email.sendReset(user.email, token);
    }
    return { ok: true };
  }

  async resetPassword(token: string, newPassword: string) {
    const user = await this.prisma.user.findFirst({
      where: { resetToken: token, resetTokenExpires: { gt: new Date() } },
    });
    if (!user) throw new BadRequestException('Token tidak valid atau sudah kedaluwarsa');
    const hash = await bcrypt.hash(newPassword, 10);
    await this.prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: hash, resetToken: null, resetTokenExpires: null },
    });
    return { ok: true };
  }

  async issueTokens(user: {
    id: string; email: string; role: string;
  }) {
    const payload = { sub: user.id, email: user.email, role: user.role };
    const jti = randomBytes(16).toString('hex');
    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, {
        jwtid: jti,
        secret: this.config.get<string>('JWT_SECRET'),
        expiresIn: this.config.get<string>('JWT_EXPIRES_IN', '15m'),
      }),
      this.jwtService.signAsync(payload, {
        jwtid: jti,
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: '30d',
      }),
    ]);
    return {
      accessToken,
      refreshToken,
      user: { id: user.id, email: user.email, role: user.role },
    };
  }

  async revokeRefreshToken(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      if (payload?.jti) {
        const exp = (payload.exp ?? Math.floor(Date.now() / 1000) + 30 * 86400) * 1000;
        this.revokedJtis.set(payload.jti, exp);
      }
      return { ok: true };
    } catch {
      return { ok: true };
    }
  }

  private isRevoked(jti?: string): boolean {
    if (!jti) return false;
    const exp = this.revokedJtis.get(jti);
    if (!exp) return false;
    if (exp < Date.now()) {
      this.revokedJtis.delete(jti);
      return false;
    }
    return true;
  }

  async refresh(refreshToken: string) {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });
      if (this.isRevoked(payload?.jti)) {
        throw new UnauthorizedException('Refresh token tidak valid');
      }
      const user = await this.prisma.user.findUnique({ where: { id: payload.sub } });
      if (!user || !user.isActive) throw new UnauthorizedException('Akun tidak valid');
      return this.issueTokens(user);
    } catch {
      throw new UnauthorizedException('Refresh token tidak valid');
    }
  }

  private async detectGoogleChannels(accessToken: string): Promise<
    { id: string; name: string; avatar?: string; followersCount: number }[]
  > {
    if (!accessToken) return [];
    try {
      const { data } = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: { part: 'snippet,statistics', mine: true },
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      return (data?.items ?? []).map((c: any) => ({
        provider: 'youtube',
        id: c.id,
        name: c.snippet?.title || 'YouTube Channel',
        avatar: c.snippet?.thumbnails?.default?.url,
        followersCount: Number(c.statistics?.subscriberCount) || 0,
      }));
    } catch {
      return [];
    }
  }

  private async detectFacebookPages(accessToken: string): Promise<
    { id: string; name: string; avatar?: string; followersCount: number }[]
  > {
    if (!accessToken) return [];
    try {
      const { data } = await axios.get('https://graph.facebook.com/v24.0/me/accounts', {
        params: {
          access_token: accessToken,
          fields: 'id,name,picture.type(large),fan_count',
        },
      });
      return (data?.data ?? []).map((p: any) => ({
        provider: 'facebook',
        id: p.id,
        name: p.name,
        avatar: p.picture?.data?.url,
        followersCount: p.fan_count || 0,
      }));
    } catch {
      return [];
    }
  }

  private async assignFreeSubscription(userId: string) {
    const free = await this.prisma.plan.findUnique({ where: { slug: 'free' } });
    if (!free) return;
    const existingActive = await this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
    });
    if (existingActive) return;
    await this.prisma.subscription.create({
      data: {
        userId,
        planId: free.id,
        status: 'active',
        startedAt: new Date(),
        expiresAt: new Date(Date.now() + free.billingPeriodDays * 86400000),
        activeAiQuota: free.aiPerMonth,
      },
    });
  }
}