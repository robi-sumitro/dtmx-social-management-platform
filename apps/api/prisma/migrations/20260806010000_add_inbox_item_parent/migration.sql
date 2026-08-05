-- Menyimpan id komentar induk (parent) untuk balasan/thread di inbox,
-- supaya komentar turunan bisa ditampilkan tepat di bawah komentarnya.
ALTER TABLE "inbox_items" ADD COLUMN IF NOT EXISTS "parentId" TEXT;
CREATE INDEX IF NOT EXISTS "inbox_items_parentId_idx" ON "inbox_items"("parentId");
