import { TripayGateway } from './payment.gateway';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

function makeConfig(values: Record<string, any>): ConfigService {
  return { get: (key: string, fallback?: any) => values[key] ?? fallback } as unknown as ConfigService;
}

describe('TripayGateway.handleWebhook', () => {
  const privateKey = 'tripay-private-key-for-tests';
  const gateway = new TripayGateway(makeConfig({ TRIPAY_PRIVATE_KEY: privateKey }));

  it('accepts a valid signature for a PAID event', async () => {
    const ref = 'DTMX-123';
    const body = { event: 'PAYMENT_PAID', merchant_ref: ref, is_closed: true };
    const signature = crypto
      .createHash('sha256')
      .update(`${ref}${privateKey}`)
      .digest('hex');

    const result = await gateway.handleWebhook(body, { 'x-signature': signature });

    expect(result.ok).toBe(true);
    expect(result.status).toBe('PAID');
    expect(result.ref).toBe(ref);
  });

  it('rejects an invalid signature', async () => {
    const body = { event: 'PAYMENT_PAID', merchant_ref: 'DTMX-123', is_closed: true };
    const result = await gateway.handleWebhook(body, { 'x-signature': 'not-a-valid-signature' });

    expect(result.ok).toBe(false);
  });

  it('rejects an expired event', async () => {
    const ref = 'DTMX-999';
    const body = { event: 'PAYMENT_EXPIRED', merchant_ref: ref, is_closed: true };
    const signature = crypto
      .createHash('sha256')
      .update(`${ref}${privateKey}`)
      .digest('hex');

    const result = await gateway.handleWebhook(body, { 'x-signature': signature });

    expect(result.ok).toBe(false);
    expect(result.status).toBe('EXPIRED');
  });

  it('rejects when the signature header is missing', async () => {
    const body = { event: 'PAYMENT_PAID', merchant_ref: 'DTMX-123', is_closed: true };
    const result = await gateway.handleWebhook(body, {});

    expect(result.ok).toBe(false);
  });
});
