import { Injectable, BadRequestException, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { PrismaService } from '../prisma/prisma.service';
import { FeatureFlagService } from '../features/feature-flag.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { PaymentsService } from '../payments/payments.service';

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly flags: FeatureFlagService,
    private readonly subs: SubscriptionsService,
    private readonly payments: PaymentsService,
  ) {}

  // ---------- Dashboard ----------
  async dashboard() {
    const [totalUsers, totalPosts, totalMedia, totalSubscribers, totalPlans, enabledFlags] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.post.count(),
      this.prisma.mediaFile.count(),
      this.prisma.subscription.count({ where: { status: 'active' } }),
      this.prisma.plan.count(),
      this.prisma.featureFlag.count({ where: { enabled: true } }),
    ]);
    const subscriptions = await this.prisma.subscription.findMany({
      where: { status: 'active' },
      include: { plan: true },
    });
    const revenue = subscriptions.reduce((s, x) => s + x.plan.price, 0);
    return { totalUsers, totalPosts, totalMedia, totalSubscribers, totalPlans, revenue, enabledFlags };
  }

  // ---------- Users ----------
  async createUser(data: { email: string; password: string; fullName?: string; username?: string; role?: string }) {
    const hash = await bcrypt.hash(data.password, 10);
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: hash,
        fullName: data.fullName,
        username: data.username,
        role: data.role || 'user',
      },
    });
  }

  async listUsers() {
    const users = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        username: true,
        fullName: true,
        avatar: true,
        role: true,
        isActive: true,
        createdAt: true,
        lastLoginAt: true,
        subscriptions: {
          where: { status: 'active' },
          orderBy: { createdAt: 'desc' },
          take: 1,
          include: { plan: true },
        },
        _count: {
          select: { posts: true, socialAccounts: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
    return users.map(({ subscriptions, _count, ...u }) => ({
      ...u,
      postCount: _count.posts,
      accountCount: _count.socialAccounts,
      activeSubscription: subscriptions[0] ?? null,
    }));
  }

  async toggleUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User tidak ditemukan');

    if (user.role === 'admin' && user.isActive) {
      throw new BadRequestException('Tidak dapat menonaktifkan akun admin yang sedang aktif');
    }

    return this.prisma.user.update({ where: { id }, data: { isActive: !user.isActive } });
  }

  async deleteUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User tidak ditemukan');
    if (user.role === 'admin') {
      const admins = await this.prisma.user.count({ where: { role: 'admin' } });
      if (admins <= 1) throw new BadRequestException('Tidak bisa menghapus admin terakhir');
    }
    await this.prisma.$transaction([
      this.prisma.postAccount.deleteMany({ where: { post: { userId: id } } }),
      this.prisma.postMedia.deleteMany({ where: { post: { userId: id } } }),
      this.prisma.postPublication.deleteMany({ where: { post: { userId: id } } }),
      this.prisma.post.deleteMany({ where: { userId: id } }),
      this.prisma.payment.deleteMany({ where: { userId: id } }),
      this.prisma.inboxItem.deleteMany({ where: { userId: id } }),
      this.prisma.aiUsage.deleteMany({ where: { userId: id } }),
      this.prisma.autoReplyRule.deleteMany({ where: { userId: id } }),
      this.prisma.mediaFile.deleteMany({ where: { userId: id } }),
      this.prisma.socialAccount.deleteMany({ where: { userId: id } }),
      this.prisma.subscription.deleteMany({ where: { userId: id } }),
      this.prisma.notification.deleteMany({ where: { userId: id } }),
      this.prisma.user.delete({ where: { id } }),
    ]);
    return { ok: true };
  }

  // ---------- Plans ----------
  listPlans() {
    return this.prisma.plan.findMany({ orderBy: { price: 'asc' } });
  }

  async createPlan(data: any) {
    return this.prisma.plan.create({ data: { ...data, slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-') } });
  }
  async updatePlan(id: string, data: any) {
    return this.prisma.plan.update({ where: { id }, data });
  }
  async deletePlan(id: string) {
    const ref = await this.prisma.subscription.findFirst({ where: { planId: id } });
    if (ref) throw new BadRequestException('Plan dipakai oleh subscription, tidak bisa dihapus');
    return this.prisma.plan.delete({ where: { id } });
  }

  // ---------- Payments ----------
  setPaymentMethods(methods: string[]) {
    return this.payments.setEnabledMethods(methods);
  }
  getPaymentMethods() {
    return this.payments.enabledMethods();
  }
  listPaymentSettings() {
    return this.payments.listSettings();
  }
  savePaymentSetting(key: string, body: any) {
    return this.payments.upsertSetting(key, body);
  }
  removePaymentSetting(key: string) {
    return this.payments.deleteSetting(key);
  }

  async listPendingSubscriptions() {
    return this.prisma.subscription.findMany({
      where: { status: 'pending' },
      include: { user: true, plan: true, payment: { take: 1 } },
    });
  }

  confirmSubscription(subscriptionId: string) {
    return this.subs.activatePending(subscriptionId);
  }

  // ---------- Feature flags ----------
  listFlags() {
    return this.flags.findAll();
  }
  setFlag(key: string, enabled: boolean) {
    return this.flags.set(key, enabled);
  }
}