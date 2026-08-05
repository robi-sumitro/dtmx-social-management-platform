-- Penjaga kuota API platform (YouTube): batas unit/hari per user dari Plan
-- (apiQuotaPerDay) + pencatatan pemakaian unit harian per provider (api_usage).
-- Global cap proyek dikonfigurasi via env YOUTUBE_QUOTA_DAILY_LIMIT.
ALTER TABLE "plans" ADD COLUMN IF NOT EXISTS "apiQuotaPerDay" INTEGER NOT NULL DEFAULT 500;

CREATE TABLE IF NOT EXISTS "api_usage" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "day" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "units" INTEGER NOT NULL DEFAULT 0,
    "writeUnits" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "api_usage_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "api_usage_userId_idx" ON "api_usage"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "api_usage_provider_day_userId_key" ON "api_usage"("provider", "day", "userId");
CREATE INDEX IF NOT EXISTS "api_usage_provider_day_idx" ON "api_usage"("provider", "day");
ALTER TABLE "api_usage" ADD CONSTRAINT "api_usage_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
