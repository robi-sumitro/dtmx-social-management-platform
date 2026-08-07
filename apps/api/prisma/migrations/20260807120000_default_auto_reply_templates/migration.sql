-- Default Auto-Reply Templates (backfill untuk user yang sudah ada)
-- Template ini hanya acuan: status enabled=false, user yang mengaktifkan sendiri.
-- Sinkron dengan DEFAULT_AUTO_REPLY_TEMPLATES di src/auto-replies/default-templates.ts

-- 1) Auto Reply AI - Inbox Semua Akun (AI, semua pesan)
INSERT INTO "auto_reply_rules" (
  "id", "userId", "accountId", "name", "matchType", "matchText",
  "replyTemplate", "useAI", "aiProvider", "aiPrompt", "enabled",
  "createdAt", "updatedAt"
)
SELECT
  ('arp_' || u."id" || '_ai_all'),
  u."id",
  NULL,
  'Auto Reply AI - Inbox Semua Akun',
  'always',
  NULL,
  NULL,
  TRUE,
  NULL,
  'Saat ini anda bertindak sebagai seorang customer service. Untuk itu silahkan berinteraksi sebagaimana manusia pada umumnya.

catatan:
- tidak perlu bertele-tele
- langsung jawab sesuai konteks
- jangan menambahkan kalimat lain, cukup beri balasan.',
  FALSE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "auto_reply_rules" r
  WHERE r."userId" = u."id" AND r."name" = 'Auto Reply AI - Inbox Semua Akun'
);

-- 2) Auto Reply - Balasan Terima Kasih (template tetap)
INSERT INTO "auto_reply_rules" (
  "id", "userId", "accountId", "name", "matchType", "matchText",
  "replyTemplate", "useAI", "aiProvider", "aiPrompt", "enabled",
  "createdAt", "updatedAt"
)
SELECT
  ('arp_' || u."id" || '_thanks'),
  u."id",
  NULL,
  'Auto Reply - Balasan Terima Kasih',
  'contains',
  'terima kasih',
  'Terima kasih sudah menghubungi kami. Kami akan segera membalas pesan Anda. 😊',
  FALSE,
  NULL,
  NULL,
  FALSE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "auto_reply_rules" r
  WHERE r."userId" = u."id" AND r."name" = 'Auto Reply - Balasan Terima Kasih'
);

-- 3) Auto Reply - Info Harga (template tetap)
INSERT INTO "auto_reply_rules" (
  "id", "userId", "accountId", "name", "matchType", "matchText",
  "replyTemplate", "useAI", "aiProvider", "aiPrompt", "enabled",
  "createdAt", "updatedAt"
)
SELECT
  ('arp_' || u."id" || '_harga'),
  u."id",
  NULL,
  'Auto Reply - Info Harga',
  'contains',
  'harga',
  'Terima kasih sudah menanyakan. Silakan tulis kebutuhan Anda agar kami dapat memberikan detail harga dan penawaran terbaik.',
  FALSE,
  NULL,
  NULL,
  FALSE,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "users" u
WHERE NOT EXISTS (
  SELECT 1 FROM "auto_reply_rules" r
  WHERE r."userId" = u."id" AND r."name" = 'Auto Reply - Info Harga'
);
