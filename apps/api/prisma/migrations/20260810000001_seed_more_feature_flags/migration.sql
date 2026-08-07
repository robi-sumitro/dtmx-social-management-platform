-- Data migration: upsert feature flags supaya flags baru muncul di admin panel
-- tanpa harus menjalankan seed ulang secara manual pada database yang sudah ada.
-- (Tabel feature_flags tidak punya default id di migration, jadi diisi via gen_random_uuid.)

INSERT INTO "feature_flags" ("id", "key", "name", "description", "enabled", "updatedAt")
VALUES
  (gen_random_uuid()::text, 'ai_caption', 'AI Content Generator', 'Generate caption & konten dengan AI', true, NOW()),
  (gen_random_uuid()::text, 'analytics', 'Analytics & Reports', 'Insight performa & laporan akun', true, NOW()),
  (gen_random_uuid()::text, 'user_registration', 'Pendaftaran Publik', 'Izinkan user baru mendaftar akun', true, NOW()),
  (gen_random_uuid()::text, 'notifications', 'Notifikasi In-App', 'Notifikasi aktivitas di dalam aplikasi', true, NOW()),
  (gen_random_uuid()::text, 'accounts', 'Koneksi Akun Sosial', 'Hubungkan & kelola akun Facebook/IG/YouTube/TikTok', true, NOW()),
  (gen_random_uuid()::text, 'public_api', 'Public API', 'Ekspos API publik untuk integrasi pihak ketiga', false, NOW()),
  (gen_random_uuid()::text, 'teams', 'Kolaborasi Tim', 'Kelola akses tim / multi-pengguna', false, NOW()),
  (gen_random_uuid()::text, 'affiliates', 'Program Afiliasi', 'Kelola afiliasi & komisi referral', false, NOW())
ON CONFLICT ("key") DO NOTHING;