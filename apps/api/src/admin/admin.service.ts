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
    return this.prisma.user.findMany({
      select: {
        id: true, email: true, username: true, fullName: true, role: true, isActive: true, createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async toggleUser(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('User tidak ditemukan');
    return this.prisma.user.update({ where: { id }, data: { isActive: !user.isActive } });
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

  async listPendingSubscriptions() {
    return this.prisma.subscription.findMany({
      where: { status: 'pending' },
      include: { user: true, plan: true },
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