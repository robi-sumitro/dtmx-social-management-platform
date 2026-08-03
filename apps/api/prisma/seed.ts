import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

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
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });