import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { getFrontendUrl } from '../common/app-url';
import { StripeGateway, ManualGateway } from './gateways/payment.gateway';
import { TripayGateway } from './gateways/payment.gateway';
import { MidtransGateway, GatewayFactory } from './gateways/midtrans.gateway';
import { NotificationsService } from '../notifications/notifications.service';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly notifications: NotificationsService,
  ) {
    GatewayFactory.register(new ManualGateway());
    GatewayFactory.register(new StripeGateway(config));
    GatewayFactory.register(new TripayGateway(config));
    GatewayFactory.register(new MidtransGateway(config));
  }

  async enabledMethods(): Promise<string[]> {
    const cfg = this.config.get<string>('ENABLED_PAYMENT_METHODS', 'manual,stripe,tripay,midtrans');
    return cfg.split(',').map((s) => s.trim()).filter(Boolean);
  }

  async setEnabledMethods(methods: string[]) {
    this.config.set('ENABLED_PAYMENT_METHODS', methods.join(','));
    return { enabledMethods: methods };
  }

  async manualInfo() {
    const settings = await this.prisma.paymentSetting.findMany({
      orderBy: { order: 'asc' },
    });
    const info = settings.reduce<Record<string, string>>((acc, s) => {
      if (s.value) acc[s.key] = s.value;
      return acc;
    }, {});
    return {
      enabled: (await this.enabledMethods()).includes('manual'),
      info,
      fields: settings,
    };
  }

  async listSettings() {
    return this.prisma.paymentSetting.findMany({ orderBy: { order: 'asc' } });
  }

  async upsertSetting(key: string, data: { label?: string; value?: string; placeholder?: string; order?: number }) {
    return this.prisma.paymentSetting.upsert({
      where: { key },
      update: data,
      create: { key, label: data.label || key, value: data.value, placeholder: data.placeholder, order: data.order ?? 0 },
    });
  }

  async deleteSetting(key: string) {
    await this.prisma.paymentSetting.deleteMany({ where: { key } });
    return { ok: true };
  }

  async getPayment(id: string, userId?: string) {
    return this.prisma.payment.findFirst({
      where: userId ? { id, userId } : { id },
      include: { plan: true },
    });
  }

  async listMine(userId: string) {
    return this.prisma.payment.findMany({
      where: { userId },
      include: { plan: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async initiatePayment(userId: string, plan: any, method: string) {
    // Free plan always activates immediately
    if (plan.price === 0) {
      return this.activateFree(userId, plan);
    }

    const allowed = await this.enabledMethods();
    if (!allowed.includes(method)) {
      throw new BadRequestException(`Metode pembayaran "${method}" tidak tersedia`);
    }

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    const ref = `DTMX-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    const front = getFrontendUrl(this.config);

    const payment = await this.prisma.payment.create({
      data: {
        userId,
        planId: plan.id,
        amount: plan.price,
        currency: plan.currency,
        method,
        status: 'PENDING',
        providerRef: ref,
        metadata: { planName: plan.name },
      },
    });

    if (method === 'manual') {
      // Create a pending subscription so admin confirmation has something to activate.
      const pending = await this.prisma.subscription.create({
        data: {
          userId,
          planId: plan.id,
          status: 'pending',
          paymentMethod: 'manual',
        },
      });
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { subscriptionId: pending.id },
      });
      const payer = await this.prisma.user.findUnique({ where: { id: userId } });
      await this.notifications.createForAdmins({
        type: 'payment',
        title: 'Pembayaran manual baru menunggu konfirmasi',
        message: `${payer?.email ?? userId} memesan paket "${plan.name}" dan menunggu verifikasi bukti transfer.`,
        link: '/app/admin?tab=pending',
        data: { subscriptionId: pending.id, paymentId: payment.id, planName: plan.name },
      });
      return { mode: 'manual', payment, subscriptionId: pending.id, action: 'upload_proof' };
    }

    const gateway = GatewayFactory.get(method);
    let intent;
    try {
      intent = await gateway.create(plan.price, plan.currency, {
        ref,
        email: user?.email,
        planName: plan.name,
        successUrl: `${front}/billing/success?ref=${ref}`,
        cancelUrl: `${front}/billing?ref=${ref}`,
      });
    } catch (e) {
      const err = e as Error;
      this.logger.error(`Gateway ${method} error: ${err.message}`);
      throw new BadRequestException('Gagal membuat pembayaran');
    }

    await this.prisma.payment.update({
      where: { id: payment.id },
      data: { providerRef: intent.providerRef || ref, metadata: { planName: plan.name, ...intent.raw } },
    });

    return { mode: method, payment, payUrl: intent.transactionUrl };
  }

  async handleWebhook(method: string, body: any, headers: any, rawBody?: Buffer | string) {
    const gateway = GatewayFactory.get(method);
    const result = await gateway.handleWebhook(body, headers, rawBody);
    if (!result.ok || !result.ref) return { received: true };

    const payment = await this.prisma.payment.findFirst({
      where: { providerRef: result.ref },
    });
    if (!payment) return { received: true, status: result.status };
    if (payment.method !== method) {
      this.logger.warn(
        `Webhook ${method} ref ${result.ref} does not match payment method ${payment.method}; ignored`,
      );
      return { received: true };
    }
    if (payment.status !== 'PAID' && result.status) {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: result.status },
      });
      if (result.status === 'PAID') {
        await this.activate(payment.userId, payment.planId, payment.method);
      }
    }
    return { received: true, status: result.status };
  }

  private async activateFree(userId: string, plan: any) {
    return this.activate(userId, plan.id, 'auto');
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
}