-- CreateTable
CREATE TABLE "inbox_removed_sources" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "sourceId" TEXT NOT NULL,
    "removedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "inbox_removed_sources_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "inbox_removed_sources_accountId_sourceId_key" ON "inbox_removed_sources"("accountId", "sourceId");

-- CreateIndex
CREATE INDEX "inbox_removed_sources_userId_removedAt_idx" ON "inbox_removed_sources"("userId", "removedAt");

-- AddForeignKey
ALTER TABLE "inbox_removed_sources" ADD CONSTRAINT "inbox_removed_sources_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "inbox_removed_sources" ADD CONSTRAINT "inbox_removed_sources_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "social_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
