import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

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
  handleWebhook(body: any, headers: any): Promise<{ ok: boolean; ref?: string; status?: string }>;
}

export abstract class BaseGateway implements PaymentGateway {
  protected logger = new Logger(this.constructor.name);
  abstract method: string;
  abstract create(amount: number, currency: string, meta: any): Promise<PaymentIntent>;
  async handleWebhook(_body: any, _headers: any) {
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
  constructor(config: ConfigService) {
    super();
    const key = config.get<string>('STRIPE_SECRET_KEY');
    if (key && typeof require === 'function') {
      this.sdk = new (require('stripe'))(key);
    }
  }
  async create(amount: number, currency: string, meta: any) {
    if (!this.sdk) throw new Error('Stripe not configured');
    const session = await this.sdk.checkout.sessions.create({
      mode: 'payment',
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
    return { provider: 'stripe', transactionUrl: session.url, raw: session };
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
  async handleWebhook(body: any) {
    return { ok: body?.event === 'PAYMENT_PAID', ref: body?.merchant_ref, status: body?.is_closed ? 'PAID' : 'PENDING' };
  }
}