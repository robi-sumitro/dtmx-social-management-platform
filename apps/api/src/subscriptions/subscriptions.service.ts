import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { EmailService } from '../auth/email.service';
import { PaymentsService } from '../payments/payments.service';
import { FileStorageService } from '../media/media.service';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class SubscriptionsService {
  private readonly logger = new Logger(SubscriptionsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
    private readonly payments: PaymentsService,
    private readonly storage: FileStorageService,
    private readonly notifications: NotificationsService,
  ) {}

  async getPlans() {
    return this.prisma.plan.findMany({
      where: { isActive: true },
      orderBy: { price: 'asc' },
    });
  }

  async getActive(userId: string) {
    return this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
    });
  }

  async getMySubscriptions(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async usage(userId: string) {
    const sub = await this.getActive(userId);
    if (!sub) return { plan: null, accountsUsed: 0, postsUsed: 0, aiUsed: 0, limits: {} };

    const accountsUsed = await this.prisma.socialAccount.count({
      where: { userId, isActive: true, parentId: null },
    });
    const since = new Date();
    since.setDate(since.getDate() - 30);
    const postsUsed = await this.prisma.post.count({
      where: { userId, createdAt: { gte: since } },
    });
    const aiUsed = await this.prisma.aiUsage.count({
      where: { userId, createdAt: { gte: since } },
    });

    return {
      plan: sub.plan,
      accountsUsed,
      postsUsed,
      aiUsed,
      limits: {
        accounts: sub.plan.maxAccounts,
        posts: sub.plan.maxPostsPerMonth,
        ai: sub.plan.aiPerMonth,
      },
    };
  }

  /** Subscribe to a plan. If price is 0 → activate immediately; else create a pending payment. */
  async subscribe(userId: string, planId: string, method: string, meta?: any) {
    const plan = await this.prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new NotFoundException('Plan tidak ditemukan');
    if (!plan.isActive) throw new BadRequestException('Plan tidak aktif');

    return this.payments.initiatePayment(userId, plan, method);
  }

  /** Manual proof upload flow + admin confirmation. */
  async saveProof(file: Express.Multer.File) {
    const info = await this.storage.save(file.buffer, file.mimetype, 'proofs');
    return info.url;
  }

  async uploadProof(userId: string, subscriptionId: string, proofUrl: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, userId },
    });
    if (!sub) throw new NotFoundException('Subscription tidak ditemukan');
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { paymentProof: proofUrl, paymentMethod: 'manual' },
    });
  }

  async activate(userId: string, planId: string, method: string) {
    return this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { userId, status: 'active' },
        data: { status: 'cancelled' },
      });
      const plan = await tx.plan.findUnique({ where: { id: planId } });
      return tx.subscription.create({
        data: {
          userId,
          planId,
          status: 'active',
          paymentMethod: method,
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + (plan?.billingPeriodDays || 30) * 86400000),
          activeAiQuota: plan?.aiPerMonth || 0,
        },
        include: { plan: true },
      });
    });
  }

  async activatePending(subscriptionId: string) {
    const sub = await this.prisma.subscription.findFirst({
      where: { id: subscriptionId, status: 'pending' },
      include: { plan: true, user: true },
    });
    if (!sub) throw new NotFoundException('Subscription pending tidak ditemukan');

    // Cancel any other active subscription for the user, then activate this one.
    const active = await this.prisma.$transaction(async (tx) => {
      await tx.subscription.updateMany({
        where: { userId: sub.userId, status: 'active' },
        data: { status: 'cancelled' },
      });
      return tx.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: 'active',
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + (sub.plan.billingPeriodDays || 30) * 86400000),
          activeAiQuota: sub.plan.aiPerMonth || 0,
        },
        include: { plan: true, user: true },
      });
    });

    await this.prisma.payment.updateMany({
      where: { subscriptionId, status: { not: 'PAID' } },
      data: { status: 'PAID' },
    });

    await this.notifications.create({
      userId: sub.userId,
      type: 'subscription',
      title: 'Langganan kamu aktif',
      message: `Paket "${sub.plan.name}" sudah diaktifkan dan berlaku hingga ${active.expiresAt?.toDateString() ?? '-'}.`,
      link: '/app/billing',
      data: { planName: sub.plan.name, expiresAt: active.expiresAt },
    });

    await this.email.sendSubscriptionConfirmed(
      sub.user.email,
      sub.plan.name,
      active.expiresAt?.toDateString() || '-',
    );
    return active;
  }
}