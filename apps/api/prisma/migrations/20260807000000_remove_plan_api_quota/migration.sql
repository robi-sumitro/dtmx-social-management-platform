-- Hapus kuota per-plan (apiQuotaPerDay). Kuota YouTube kini hanya:
--  - cap GLOBAL proyek (YOUTUBE_QUOTA_DAILY_LIMIT, default 9000 dari 10000),
--  - jatah tulis per user OPSIONAL via env YOUTUBE_USER_DAILY_WRITE_LIMIT.
-- Kolom dihapus agar tidak mengikat pemakaian pada paket user.
ALTER TABLE "plans" DROP COLUMN IF EXISTS "apiQuotaPerDay";