import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter!: nodemailer.Transporter;
  private from: string;

  constructor(private readonly config: ConfigService) {
    const host = this.config.get<string>('SMTP_HOST');
    if (host) {
      this.transporter = nodemailer.createTransport({
        host,
        port: this.config.get<number>('SMTP_PORT', 587),
        secure: this.config.get<boolean>('SMTP_SECURE', false),
        auth: {
          user: this.config.get<string>('SMTP_USER'),
          pass: this.config.get<string>('SMTP_PASS'),
        },
      });
    }
    this.from = this.config.get<string>('MAIL_FROM', 'DtmX <no-reply@dtmx.app>');
  }

  private wrap(body: string): string {
    return `<!doctype html><html><body style="font-family:Arial;background:#f6f7fb;padding:24px">
      <div style="max-width:520px;margin:auto;background:#fff;border-radius:8px;padding:28px">
        <h1 style="font-size:20px;color:#111;margin-top:0">DtmX</h1>
        ${body}
        <p style="color:#aaa;font-size:12px;margin-top:24px">© ${new Date().getFullYear()} DtmX</p>
      </div></body></html>`;
  }

  async send(to: string, subject: string, html: string): Promise<boolean> {
    if (!this.transporter) {
      this.logger.warn(`SMTP not configured; skipping email to ${to}`);
      return false;
    }
    try {
      await this.transporter.sendMail({ from: this.from, to, subject, html });
      return true;
    } catch (e) {
      const err = e as Error;
      this.logger.error(`SMTP send failed: ${err.message}`);
      return false;
    }
  }

  sendWelcome(to: string, password?: string) {
    const hint = password
      ? `<p>Password sementara: <code>${password}</code> (silakan ubah setelah login).</p>`
      : '';
    return this.send(
      to,
      'Selamat datang di DtmX',
      this.wrap(`
        <p>Halo! Akun DtmX kamu sudah dibuat.</p>
        ${hint}
        <p>Login: <a href="${this.frontUrl()}/login">DtmX Login</a></p>
      `),
    );
  }

  sendReset(to: string, token: string) {
    const url = `${this.frontUrl()}/auth/reset-password?token=${token}`;
    return this.send(
      to,
      'Reset Password DtmX',
      this.wrap(`
        <p>Kami menerima permintaan reset password.</p>
        <p>Klik tombol di bawah untuk mengatur ulang (berlaku 2 jam):</p>
        <p><a href="${url}" style="display:inline-block;background:#111;color:#fff;padding:12px 20px;border-radius:6px;text-decoration:none">Reset Password</a></p>
        <p>Jika kamu tidak meminta ini, abaikan email ini.</p>
      `),
    );
  }

  sendSubscriptionConfirmed(to: string, planName: string, expiresAt: string) {
    return this.send(
      to,
      'Langganan DtmX Aktif',
      this.wrap(`
        <p>Pembayaran kamu dikonfirmasi 🎉</p>
        <p>Plan: <strong>${planName}</strong><br/>Berlaku s/d <strong>${expiresAt}</strong></p>
        <p>Mulai kelola konten kamu sekarang.</p>
      `),
    );
  }

  private frontUrl(): string {
    return this.config.get<string>('FRONTEND_URL', 'http://localhost:4200');
  }
}