export interface DefaultAutoReplyTemplate {
  name: string;
  matchType: string;
  matchText?: string;
  replyTemplate?: string;
  useAI: boolean;
  aiProvider?: string;
  aiPrompt?: string;
}

/**
 * Templat balasan otomatis bawaan. Diberikan sebagai acuan untuk setiap user
 * dengan status NONAKTIF (enabled=false) — user yang mengaktifkan sendiri.
 *
 * Dijaga sinkron dengan migration SQL backfill:
 * apps/api/prisma/migrations/<...>_default_auto_reply_templates/migration.sql
 */
export const DEFAULT_AUTO_REPLY_TEMPLATES: DefaultAutoReplyTemplate[] = [
  {
    name: 'Auto Reply AI - Inbox Semua Akun',
    matchType: 'always',
    useAI: true,
    aiPrompt:
      'Saat ini anda bertindak sebagai seorang customer service. Untuk itu silahkan ' +
      'berinteraksi sebagaimana manusia pada umumnya.\n\n' +
      'catatan:\n' +
      '- tidak perlu bertele-tele\n' +
      '- langsung jawab sesuai konteks\n' +
      '- jangan menambahkan kalimat lain, cukup beri balasan.',
  },
  {
    name: 'Auto Reply - Balasan Terima Kasih',
    matchType: 'contains',
    matchText: 'terima kasih',
    replyTemplate: 'Terima kasih sudah menghubungi kami. Kami akan segera membalas pesan Anda. 😊',
    useAI: false,
  },
  {
    name: 'Auto Reply - Info Harga',
    matchType: 'contains',
    matchText: 'harga',
    replyTemplate:
      'Terima kasih sudah menanyakan. Silakan tulis kebutuhan Anda agar kami dapat memberikan detail harga dan penawaran terbaik.',
    useAI: false,
  },
];