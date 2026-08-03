import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SocialAccountsService {
  constructor(private readonly prisma: PrismaService) {}

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
    },
  ) {
    const plan = await this.limitCheck(userId);
    const existing = await this.prisma.socialAccount.findFirst({
      where: { userId, provider: data.provider, platformId: data.platformId },
    });
    if (!existing) {
      const count = await this.prisma.socialAccount.count({
        where: { userId, isActive: true },
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
    return this.prisma.socialAccount.update({
      where: { id },
      data: { isActive: false },
    });
  }

  async refreshTokenAll(userId: string) {
    return this.prisma.socialAccount.updateMany({
      where: { userId },
      data: { lastSyncAt: new Date() },
    });
  }
}