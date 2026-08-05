-- Perbaikan: Prisma memetakan field `replyContent` ke kolom `replyContent`
-- (camelCase, konsisten dengan kolom lain di inbox_items). Migration
-- sebelumnya menambahkan `reply_content` (snake_case) sehingga kolom yang
-- dibutuhkan Prisma tidak pernah ada dan semua query inbox gagal.
ALTER TABLE "inbox_items" ADD COLUMN IF NOT EXISTS "replyContent" TEXT;
ALTER TABLE "inbox_items" DROP COLUMN IF EXISTS "reply_content";
