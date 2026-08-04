-- AlterTable
ALTER TABLE "users" ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Jakarta';

-- CreateIndex
CREATE INDEX "posts_status_idx" ON "posts"("status");

-- CreateIndex
CREATE INDEX "posts_scheduledAt_idx" ON "posts"("scheduledAt");

-- CreateIndex
CREATE INDEX "posts_createdAt_idx" ON "posts"("createdAt");

-- CreateIndex
CREATE INDEX "social_accounts_provider_idx" ON "social_accounts"("provider");

-- CreateIndex
CREATE INDEX "social_accounts_isActive_idx" ON "social_accounts"("isActive");

-- CreateIndex
CREATE INDEX "inbox_items_status_idx" ON "inbox_items"("status");
