import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const isProd = process.env.NODE_ENV === 'production';

const adminDefaults = {
  email: process.env.SEED_ADMIN_EMAIL || 'admin@dtmx.app',
  password: process.env.SEED_ADMIN_PASSWORD || '',
  username: process.env.SEED_ADMIN_USERNAME || 'admin',
  fullName: process.env.SEED_ADMIN_NAME || 'DtmX Admin',
};

if (isProd && !adminDefaults.password) {
  console.error('[seed] SEED_ADMIN_PASSWORD wajib di-set saat NODE_ENV=production. Seed dibatalkan.');
  process.exit(1);
}

const plans = [
  {
    name: 'Free',
    slug: 'free',
    description: 'Mulai mengelola 1 akun sosial kamu',
    price: 0,
    currency: 'USD',
    billingPeriodDays: 30,
    maxAccounts: 1,
    maxPostsPerMonth: 10,
    aiPerMonth: 20,
  },
  {
    name: 'Basic',
    slug: 'basic',
    description: 'Untuk creator yang mulai serius',
    price: 5,
    currency: 'USD',
    billingPeriodDays: 30,
    maxAccounts: 3,
    maxPostsPerMonth: 50,
    aiPerMonth: 200,
  },
  {
    name: 'Pro',
    slug: 'pro',
    description: 'Paling populer untuk tim dan agensi kecil',
    price: 12,
    currency: 'USD',
    billingPeriodDays: 30,
    maxAccounts: 8,
    maxPostsPerMonth: 200,
    aiPerMonth: 1000,
  },
  {
    name: 'Enterprise',
    slug: 'enterprise',
    description: 'Untuk agensi besar dengan kebutuhan penuh',
    price: 30,
    currency: 'USD',
    billingPeriodDays: 30,
    maxAccounts: 20,
    maxPostsPerMonth: 1000,
    aiPerMonth: 5000,
  },
];

const featureFlags = [
  { key: 'inbox', name: 'Inbox Management', description: 'Kelola komentar & DM', enabled: true },
  { key: 'ai_replies', name: 'AI Auto Reply', description: 'Balasan otomatis dengan AI', enabled: true },
  { key: 'media_upload', name: 'Media Library', description: 'Unggah media untuk posting', enabled: true },
  { key: 'scheduling', name: 'Post Scheduling', description: 'Jadwalkan posting otomatis', enabled: true },
  { key: 'publishing', name: 'Multi-Platform Publish', description: 'Terbitkan ke Facebook/IG/YouTube/TikTok', enabled: true },
  { key: 'ai_caption', name: 'AI Content Generator', description: 'Generate caption & konten dengan AI', enabled: true },
  { key: 'analytics', name: 'Analytics & Reports', description: 'Insight performa & laporan akun', enabled: true },
  { key: 'user_registration', name: 'Pendaftaran Publik', description: 'Izinkan user baru mendaftar akun', enabled: true },
  { key: 'notifications', name: 'Notifikasi In-App', description: 'Notifikasi aktivitas di dalam aplikasi', enabled: true },
  { key: 'accounts', name: 'Koneksi Akun Sosial', description: 'Hubungkan & kelola akun Facebook/IG/YouTube/TikTok', enabled: true },
  { key: 'public_api', name: 'Public API', description: 'Ekspos API publik untuk integrasi pihak ketiga', enabled: false },
  { key: 'teams', name: 'Kolaborasi Tim', description: 'Kelola akses tim / multi-pengguna', enabled: false },
  { key: 'affiliates', name: 'Program Afiliasi', description: 'Kelola afiliasi & komisi referral', enabled: false },
];

const paymentSettings = [
  { key: 'manual_bank_name', label: 'Nama Bank Tujuan', value: '', placeholder: 'contoh: BCA' },
  { key: 'manual_bank_account', label: 'Nomor Rekening Tujuan', value: '', placeholder: 'contoh: 1234567890' },
  { key: 'manual_bank_holder', label: 'Atas Nama Rekening', value: '', placeholder: 'contoh: PT DtmX Indonesia' },
];

const aiSettings = [
  { key: 'active_provider', label: 'Provider AI Aktif', value: '', placeholder: 'openai | anthropic | gemini' },
  { key: 'openai_api_key', label: 'OpenAI API Key', value: '', placeholder: 'sk-...' },
  { key: 'openai_model', label: 'OpenAI Model', value: '', placeholder: 'gpt-4o-mini' },
  { key: 'anthropic_api_key', label: 'Anthropic API Key', value: '', placeholder: 'sk-ant-...' },
  { key: 'anthropic_model', label: 'Anthropic Model', value: '', placeholder: 'claude-3-5-haiku-latest' },
  { key: 'gemini_api_key', label: 'Gemini API Key', value: '', placeholder: 'AIza...' },
  { key: 'gemini_model', label: 'Gemini Model', value: '', placeholder: 'gemini-1.5-flash' },
];

async function main() {
  console.log('Seeding plans...');
  for (const p of plans) {
    await prisma.plan.upsert({
      where: { slug: p.slug },
      update: p,
      create: p,
    });
  }

  console.log('Seeding feature flags...');
  for (const f of featureFlags) {
    await prisma.featureFlag.upsert({
      where: { key: f.key },
      update: f,
      create: f,
    });
  }

  console.log('Seeding payment settings...');
  for (const s of paymentSettings) {
    await prisma.paymentSetting.upsert({
      where: { key: s.key },
      update: s,
      create: s,
    });
  }

  console.log('Seeding AI settings...');
  for (const s of aiSettings) {
    await prisma.aiSetting.upsert({
      where: { key: s.key },
      update: s,
      create: s,
    });
  }

  console.log(`Seeding admin user (${adminDefaults.email})...`);
  const existingAdmin = await prisma.user.findUnique({ where: { email: adminDefaults.email } });
  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: { role: 'admin', isActive: true },
    });
    console.log('Admin sudah ada, role dijamin tetap admin.');
  } else {
    const passwordHash = await bcrypt.hash(adminDefaults.password, 10);
    const admin = await prisma.user.create({
      data: {
        email: adminDefaults.email,
        username: adminDefaults.username,
        passwordHash,
        fullName: adminDefaults.fullName,
        role: 'admin',
        isActive: true,
      },
    });
    console.log(`Admin created: ${admin.email}`);
  }

  const pro = await prisma.plan.findUnique({ where: { slug: 'pro' } });
  if (pro) {
    const admin = await prisma.user.findUnique({ where: { email: adminDefaults.email } });
    if (!admin) throw new Error('Admin tidak ditemukan setelah seed');
    const existingActive = await prisma.subscription.findFirst({
      where: { userId: admin.id, status: 'active' },
    });
    if (!existingActive) {
      await prisma.subscription.create({
        data: {
          userId: admin.id,
          planId: pro.id,
          status: 'active',
          startedAt: new Date(),
          expiresAt: new Date(Date.now() + pro.billingPeriodDays * 86400000),
          activeAiQuota: pro.aiPerMonth,
        },
      });
      console.log(`Admin subscription: ${pro.name}`);
    }
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });