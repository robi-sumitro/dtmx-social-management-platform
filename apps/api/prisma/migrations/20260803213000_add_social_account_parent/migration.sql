-- AlterTable: group linked Instagram business accounts under their Facebook page (1 slot = page + IG).
ALTER TABLE "social_accounts" ADD COLUMN "parentId" TEXT;

-- CreateIndex
CREATE INDEX "social_accounts_parentId_idx" ON "social_accounts"("parentId");

-- AddForeignKey: self-relation for page -> IG business grouping
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
