import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';

export interface PaymentIntent {
  providerRef?: string;
  paymentUrl?: string;
  transactionUrl?: string;
  virtualAccount?: string;
  qrCode?: string;
  raw?: any;
}

export interface PaymentGateway {
  method: string;
  create(amount: number, currency: string, meta: any): Promise<PaymentIntent>;
  verifyStatus?(ref: string): Promise<string>;
  handleWebhook(
    body: any,
    headers: any,
    rawBody?: Buffer | string,
  ): Promise<{ ok: boolean; ref?: string; status?: string }>;
}

export abstract class BaseGateway implements PaymentGateway {
  protected logger = new Logger(this.constructor.name);
  abstract method: string;
  abstract create(amount: number, currency: string, meta: any): Promise<PaymentIntent>;
  async handleWebhook(_body: any, _headers: any, _rawBody?: Buffer | string) {
    return { ok: false };
  }
}

@Injectable()
export class ManualGateway extends BaseGateway {
  method = 'manual';
  async create() {
    return { provider: 'manual', transactionUrl: undefined };
  }
}

@Injectable()
export class StripeGateway extends BaseGateway {
  method = 'stripe';
  private sdk: any;
  private webhookSecret: string | undefined;

  constructor(config: ConfigService) {
    super();
    this.webhookSecret = config.get<string>('STRIPE_WEBHOOK_SECRET');
    const key = config.get<string>('STRIPE_SECRET_KEY');
    if (key && typeof require === 'function') {
      this.sdk = new (require('stripe'))(key);
    }
  }

  async create(amount: number, currency: string, meta: any) {
    if (!this.sdk) throw new Error('Stripe not configured');
    const session = await this.sdk.checkout.sessions.create({
      mode: 'payment',
      client_reference_id: meta.ref,
      line_items: [
        {
          price_data: { currency, product_data: { name: meta.planName || 'DtmX' }, unit_amount: Math.round(amount * 100) },
          quantity: 1,
        },
      ],
      metadata: meta,
      success_url: meta.successUrl,
      cancel_url: meta.cancelUrl,
    });
    // Keep providerRef = merchant ref (also sent as client_reference_id) so
    // the webhook can map back via client_reference_id.
    return { provider: 'stripe', providerRef: meta.ref, transactionUrl: session.url, raw: session };
  }

  async handleWebhook(body: any, headers: any, rawBody?: Buffer | string) {
    if (!this.sdk || !this.webhookSecret) return { ok: false };
    const signature = headers?.['stripe-signature'] as string | undefined;
    if (!signature || !rawBody) return { ok: false };
    let event: any;
    try {
      event = this.sdk.webhooks.constructEvent(rawBody, signature, this.webhookSecret);
    } catch (e) {
      this.logger.warn(`Stripe webhook signature verification failed: ${(e as Error).message}`);
      return { ok: false };
    }
    const session = event?.data?.object ?? {};
    if (event.type === 'checkout.session.completed' && session.payment_status === 'paid') {
      return { ok: true, ref: session.client_reference_id, status: 'PAID' };
    }
    if (event.type === 'checkout.session.expired') {
      return { ok: true, ref: session.client_reference_id, status: 'EXPIRED' };
    }
    return { ok: true, ref: undefined };
  }
}

export class TripayGateway extends BaseGateway {
  method = 'tripay';
  constructor(private config: ConfigService) {
    super();
  }
  private sandbox() {
    return this.config.get<string>('TRIPAY_SANDBOX', 'true') === 'true' ? 'https://tripay.co.id/api-sandbox' : 'https://tripay.co.id/api';
  }
  private headers() {
    return {
      Authorization: `Bearer ${this.config.get<string>('TRIPAY_API_KEY')}`,
      'Content-Type': 'application/json',
    };
  }
  async create(amount: number, currency: string, meta: any) {
    const res = await axios.post(
      `${this.sandbox()}/transaction/create`,
      {
        method: this.config.get<string>('TRIPAY_CHANNEL', 'OVO'),
        merchant_code: this.config.get<string>('TRIPAY_MERCHANT_CODE'),
        amount,
        currency,
        merchant_ref: meta.ref,
        customer_email: meta.email,
        order_items: [{ name: meta.planName || 'DtmX', price: amount, quantity: 1 }],
        return_url: meta.successUrl,
      },
      { headers: this.headers() },
    );
    const d = res.data?.data;
    return { provider: 'tripay', transactionUrl: d?.checkout_url, raw: d };
  }
  async handleWebhook(body: any, headers: any) {
    if (body?.event !== 'PAYMENT_PAID' && body?.event !== 'PAYMENT_EXPIRED') {
      return { ok: false };
    }
    const signature = headers?.['x-signature'] as string | undefined;
    const privateKey = this.config.get<string>('TRIPAY_PRIVATE_KEY');
    if (!signature || !privateKey) return { ok: false };
    const expected = crypto
      .createHash('sha256')
      .update(`${body.merchant_ref}${privateKey}`)
      .digest('hex');
    const a = Buffer.from(signature);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) {
      return { ok: false };
    }
    const status =
      body.event === 'PAYMENT_PAID' && body.is_closed
        ? 'PAID'
        : body.event === 'PAYMENT_EXPIRED'
          ? 'EXPIRED'
          : 'PENDING';
    return { ok: status === 'PAID', ref: body.merchant_ref, status };
  }
}
