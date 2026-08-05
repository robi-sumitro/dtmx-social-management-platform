import 'dotenv/config';
import { execSync } from 'child_process';
import { PrismaClient } from '@prisma/client';

/**
 * Menyembuhkan migration Prisma yang "stuck" dalam keadaan failed.
 *
 * Latar belakang: ketika `prisma migrate deploy` menemui error, Prisma mencatat
 * migrasinya di tabel internal `_prisma_migrations` dengan `finished_at = NULL`.
 * Pada deploy berikutnya, Prisma TIDAK akan mengulang migration itu lagi —
 * ia sudah tercatat, sehingga build akan terus gagal sampai record gagal
 * dibersihkan dan objek DB yang terlanjur dibuat di-rollback.
 *
 * Script ini:
 *  1. Mendeteksi migration yang gagal (finished_at IS NULL).
 *  2. Mencetak isi log error aslinya (untuk diagnosa).
 *  3. Meng-rollback objek parsial yang diketahui dari migration tersebut.
 *  4. Menghapus record failed-nya, lalu menjalankan ulang `prisma migrate deploy`.
 */

const prisma = new PrismaClient();

// Pemetaan calon migration yang berpotensi gagal terhadap perintah rollback-nya.
// Hanya objek yang AMAN di-drop (baru dibuat, belum dipakai) yang masuk sini.
// Jika sebuah migration failed tidak ada di daftar ini, kita hanya memperingatkan
// (tidak melakukan aksi destruktif) supaya diputuskan secara manual.
const FAILED_MIGRATION_ROLLBACKS: Record<string, string[]> = {
  '20260806020000_add_api_usage_and_plan_quota': [
    'ALTER TABLE "plans" DROP COLUMN IF EXISTS "apiQuotaPerDay";',
    'DROP TABLE IF EXISTS "api_usage";',
  ],
};

async function listFailedMigrations() {
  return prisma.$queryRaw<{ migration_name: string; finished_at: Date | null; logs: string | null }[]>`
    SELECT "migration_name", "finished_at", "logs"
    FROM "_prisma_migrations"
    WHERE "finished_at" IS NULL
      OR "rolled_back_at" IS NOT NULL
    ORDER BY "started_at" ASC
  `;
}

async function runDeploy(cwd: string): Promise<void> {
  try {
    execSync('npx prisma migrate deploy', {
      cwd,
      stdio: 'inherit',
      env: process.env,
    });
    console.log('\n[heal] prisma migrate deploy selesai tanpa error.');
  } catch (error) {
    console.error('\n[heal] migrate deploy masih gagal. Lihat output di atas.');
    process.exit(1);
  }
}

async function main(): Promise<void> {
  const cwd = process.cwd();
  const failed = await listFailedMigrations();

  if (failed.length === 0) {
    console.log('[heal] Tidak ada migration gagal. Menjalankan migrate deploy biasa...');
    await runDeploy(cwd);
    return;
  }

  console.log(`[heal] Ditemukan ${failed.length} migration dalam keadaan failed:`);
  for (const m of failed) {
    console.log(`  - ${m.migration_name}`);
    const firstLine = (m.logs ?? '').split('\n').slice(0, 6).join('\n');
    if (firstLine) {
      console.log('     log error asli:');
      console.log(firstLine.split('\n').map((l) => `       ${l}`).join('\n'));
    }
  }

  const rollback = failed.map((m) => FAILED_MIGRATION_ROLLBACKS[m.migration_name]);
  const hasUnresolved = failed.some((m) => !FAILED_MIGRATION_ROLLBACKS[m.migration_name]);

  if (hasUnresolved) {
    console.log('\n[heal] Ada migration gagal tanpa resep rollback di script ini.');
    console.log('[heal] Lewati auto-heal agar tidak ada aksi destruktif yang salah.');
    console.log('[heal] Tambahkan resep untuk migration tsb di FAILED_MIGRATION_ROLLBACKS.');
    await runDeploy(cwd);
    return;
  }

  console.log('\n[heal] Rollback objek parsial + hapus record failed...');
  for (const stmt of rollback.flat()) {
    try {
      await prisma.$executeRawUnsafe(stmt);
      console.log(`  [ok] ${stmt}`);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.warn(`  [skip] ${stmt} -> ${msg}`);
    }
  }

  await prisma.$executeRaw`
    DELETE FROM "_prisma_migrations" WHERE "finished_at" IS NULL OR "rolled_back_at" IS NOT NULL
  `;

  await prisma.$disconnect();

  console.log('\n[heal] Jalankan ulang prisma migrate deploy...');
  await runDeploy(cwd);
}

main()
  .catch((error) => {
    console.error('[heal] Gagal:', error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());