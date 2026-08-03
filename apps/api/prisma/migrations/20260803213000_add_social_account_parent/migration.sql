-- AlterTable: group linked Instagram business accounts under their Facebook page (1 slot = page + IG).
ALTER TABLE "social_accounts" ADD COLUMN "parent_id" TEXT;

-- CreateIndex
CREATE INDEX "social_accounts_parent_id_idx" ON "social_accounts"("parent_id");

-- AddForeignKey: self-relation for page -> IG business grouping
ALTER TABLE "social_accounts" ADD CONSTRAINT "social_accounts_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "social_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
