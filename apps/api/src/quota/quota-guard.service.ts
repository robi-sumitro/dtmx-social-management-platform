import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/** Error khusus saat kuota API harian habis (global proyek atau kuota per user). */
export class QuotaExceededError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'QuotaExceededError';
  }
}

/**
 * Penjaga kuota API platform (utamanya YouTube Data API v3, 10.000 unit/hari
 * per proyek Google Cloud dan dibagi semua channel):
 *  - penjaga GLOBAL: memastikan total unit yang tercatat per hari tidak
 *    melewati YOUTUBE_QUOTA_DAILY_LIMIT (default 9.000, sisanya buffer).
 *  - penjaga PER-USER: kuota operasi tulis per user/hari dari Plan
 *    (apiQuotaPerDay). Baca (1 unit) tidak dihitung ke kuota user.
 */
@Injectable()
export class QuotaGuardService {
  private readonly logger = new Logger(QuotaGuardService.name);
  constructor(private readonly prisma: PrismaService) {}

  private globalLimit(provider: string): number {
    if (provider === 'youtube') return Number(process.env.YOUTUBE_QUOTA_DAILY_LIMIT || 9000);
    return 0; // platform lain tanpa batas kuota berbasis unit
  }

  /** Kunci hari pemakaian (UTC YYYY-MM-DD), reset tengah malam. */
  dayKey(d = new Date()): string {
    return d.toISOString().slice(0, 10);
  }

  async used(provider: string, userId?: string, day = this.dayKey()): Promise<number> {
    if (userId) {
      const row = await this.prisma.apiUsage.findUnique({
        where: { provider_day_userId: { provider, day, userId } },
      });
      return row?.units ?? 0;
    }
    const agg = await this.prisma.apiUsage.aggregate({
      where: { provider, day },
      _sum: { units: true },
    });
    return agg._sum.units ?? 0;
  }

  private async writeUsed(provider: string, userId: string, day = this.dayKey()): Promise<number> {
    const row = await this.prisma.apiUsage.findUnique({
      where: { provider_day_userId: { provider, day, userId } },
    });
    return row?.writeUnits ?? 0;
  }

  /**
   * Cek (tanpa mencatat) apakah operasi tulis mahal (mis. balasan komentar)
   * masih diizinkan untuk user. Dipanggil sebelum generate balasan AI supaya
   * kuota AI tidak terbuang untuk balasan yang ujungnya ditahan penjaga kuota.
   */
  async checkWriteBudget(provider: string, units: number, userId: string): Promise<{ allowed: boolean; reason?: string }> {
    const day = this.dayKey();
    const limit = this.globalLimit(provider);
    if (limit > 0) {
      const globalUsed = await this.used(provider, undefined, day);
      if (globalUsed + units > limit) {
        return { allowed: false, reason: 'Kuota API harian platform hampir habis — operasi ditunda.' };
      }
    }
    const planLimit = await this.userPlanLimit(userId);
    if (planLimit > 0) {
      const userUsed = await this.writeUsed(provider, userId, day);
      if (userUsed + units > planLimit) {
        return {
          allowed: false,
          reason: `Kuota balasan harian akunmu habis (${userUsed}/${planLimit} unit). Tunggu reset besok atau upgrade paket.`,
        };
      }
    }
    return { allowed: true };
  }

  /**
   * Catat pemakaian unit dan tolak (QuotaExceededError) bila melewati batas.
   * Dipanggil tepat sebelum request API dikirim. `write=true` untuk operasi
   * mahal (balasan/hapus = 50 unit) yang ikut dihitung ke kuota per-user.
   */
  async consume(provider: string, units: number, userId: string, opts?: { write?: boolean }): Promise<void> {
    const day = this.dayKey();
    const limit = this.globalLimit(provider);
    if (limit > 0) {
      const globalUsed = await this.used(provider, undefined, day);
      if (globalUsed + units > limit) {
        throw new QuotaExceededError(
          `Kuota ${provider} harian hampir habis (${globalUsed}/${limit} unit) — pemakaian ditahan.`,
        );
      }
    }
    const isWrite = Boolean(opts?.write);
    if (isWrite) {
      const planLimit = await this.userPlanLimit(userId);
      if (planLimit > 0) {
        const userUsed = await this.writeUsed(provider, userId, day);
        if (userUsed + units > planLimit) {
          throw new QuotaExceededError(
            `Kuota balasan harian akunmu habis (${userUsed}/${planLimit} unit). Tunggu reset besok atau upgrade paket.`,
          );
        }
      }
    }
    await this.prisma.apiUsage.upsert({
      where: { provider_day_userId: { provider, day, userId } },
      create: { provider, day, userId, units, writeUnits: isWrite ? units : 0 },
      update: isWrite
        ? { units: { increment: units }, writeUnits: { increment: units } }
        : { units: { increment: units } },
    });
  }

  private async userPlanLimit(userId: string): Promise<number> {
    const sub = await this.prisma.subscription.findFirst({
      where: { userId, status: 'active' },
      include: { plan: true },
    });
    return sub?.plan?.apiQuotaPerDay ?? 0;
  }
}
