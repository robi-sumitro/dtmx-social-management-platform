import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { getFrontendUrl } from '../common/app-url';
import { StripeGateway, ManualGateway } from './gateways/payment.gateway';
import { TripayGateway } from './gateways/payment.gateway';
import { MidtransGateway, GatewayFactory } from './gateways/midtrans.gateway';

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
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

  async handleWebhook(method: string, body: any, headers: any) {
    const gateway = GatewayFactory.get(method);
    const result = await gateway.handleWebhook(body, headers);
    if (!result.ok || !result.ref) return { received: true };

    const payment = await this.prisma.payment.findFirst({
      where: { providerRef: result.ref },
    });
    if (payment && payment.status !== 'PAID') {
      await this.prisma.payment.update({
        where: { id: payment.id },
        data: { status: result.status || 'PAID' },
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