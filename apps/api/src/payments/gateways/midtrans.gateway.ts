import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import * as crypto from 'crypto';
import { PaymentGateway } from './payment.gateway';

export class MidtransGateway implements PaymentGateway {
  method = 'midtrans';
  private logger = new Logger(MidtransGateway.name);
  constructor(private config: ConfigService) {}
  private isProd() {
    return this.config.get<string>('MIDTRANS_IS_PRODUCTION', 'false') === 'true';
  }
  private base() {
    return this.isProd() ? 'https://app.midtrans.com/snap/v1' : 'https://app.sandbox.midtrans.com/snap/v1';
  }
  private basics() {
    const key = this.isProd() ? 'MIDTRANS_SERVER_KEY' : 'MIDTRANS_SERVER_KEY';
    return {
      headers: {
        Authorization: `Basic ${Buffer.from(this.config.get<string>(key) + ':').toString('base64')}`,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
    };
  }
  async create(amount: number, currency: string, meta: any) {
    const res = await axios.post(
      `${this.base()}/transactions`,
      {
        transaction_details: {
          order_id: meta.ref,
          gross_amount: amount,
        },
        item_details: [{ name: meta.planName || 'DtmX', price: amount, quantity: 1 }],
        customer_details: { email: meta.email },
        credit_card: { secure: true },
        callbacks: { finish: meta.successUrl },
      },
      this.basics(),
    );
    return { provider: 'midtrans', transactionUrl: res.data?.redirect_url, raw: res.data };
  }
async handleWebhook(body: any, headers: any) {
    const raw = crypto
      .createHash('sha512')
      .update(`${body.order_id}${body.status_code}${body.gross_amount}${this.config.get('MIDTRANS_SERVER_KEY')}`)
      .digest('hex');
    if (body.signature_key !== raw) return { ok: false };
    const status = body.transaction_status === 'capture' || body.transaction_status === 'settlement'
      ? 'PAID'
      : body.transaction_status === 'expire'
      ? 'EXPIRED'
      : body.transaction_status === 'deny' ? 'FAILED'
      : 'PENDING';
    return { ok: status === 'PAID', ref: body.order_id, status };
  }
}

export class GatewayFactory {
  private static ctx = new Map<string, PaymentGateway>();
  static register(gateway: PaymentGateway) {
    this.ctx.set(gateway.method, gateway);
  }
  static get(method: string): PaymentGateway {
    const g = this.ctx.get(method);
    if (!g) throw new Error(`Payment gateway "${method}" not registered`);
    return g;
  }
}