# DtmX

AI-powered social media management platform (monorepo).

## Arsitektur

- **apps/api** — Backend REST API (NestJS) + queue BullMQ + scheduler
- **apps/web** — Frontend SPA (Vite + React + TypeScript + Tailwind CSS)
- **packages/config** — Konfigurasi bersama
- **packages/shared** — Tipe/utilitas bersama
- **.docker** — Infra lokal (PostgreSQL + Redis) via Docker Compose

## Prasyarat

- Node.js >= 20
- pnpm 11
- PostgreSQL 16 (atau Docker)
- Redis (opsional, untuk BullMQ)

## Setup

### 1. Install dependency

```bash
pnpm install
```

### 2. Infrastruktur database

**Opsi A — Docker** ( jika Docker terpasang ):

```bash
pnpm infra:up        # jalankan PostgreSQL + Redis
pnpm infra:down      # hentikan
```

**Opsi B — PostgreSQL lokal**:

Buat database `dtmx` dengan user `dtmx` (password `dtmx`):

```bash
sudo -u postgres psql -c "CREATE USER dtmx WITH PASSWORD 'dtmx';"
sudo -u postgres psql -c "ALTER USER dtmx CREATEDB;"
sudo -u postgres psql -c "CREATE DATABASE dtmx OWNER dtmx;"
```

### 3. Konfigurasi environment

```bash
cp apps/api/.env.example apps/api/.env
```

Ubah sesuai kebutuhan (database URL, JWT secret, kunci API pihak ketiga, dll). Nilai default sudah mencocokkan kredensial lokal/`infra:up`.

### 4. Migrasi & seed

```bash
pnpm db:generate   # buat Prisma Client
pnpm db:migrate    # terapkan migrasi (buat jika belum ada)
pnpm db:seed       # isi data awal (plans & feature flags)
```

Migration dibuat langsung dari `apps/api/prisma/schema.prisma`. File migrasi tersimpan di `apps/api/prisma/migrations/`.

## Menjalankan aplikasi

```bash
pnpm dev     # jalankan semua workspace (watch mode)
```

API jalan di `http://localhost:3000` (lihat `PORT` di `.env`). Jalankan hanya API:

```bash
pnpm --filter @dtmx/api start:dev
```

### Frontend (apps/web)

Jalankan dev server (port 4200, dengan proxy `/api` & `/uploads` ke API lokal):

```bash
pnpm --filter @dtmx/web dev
```

Build produksi:

```bash
pnpm --filter @dtmx/web build    # hasil di apps/web/dist
```

> Saat di-deploy (Railway), `apps/web/dist` otomatis di-serve oleh API (NestJS `ServeStaticModule`) sehingga domain root melayani SPA dengan fallback ke `index.html`. Pastikan `FRONTEND_URL` / `CORS_ORIGINS` di `.env` mengarah ke domain frontend (contoh: `http://localhost:4200`).

Dashboard queue (BullMQ): default Bull Board via bull-board module.

## Script lain

```bash
pnpm build         # build semua workspace
pnpm lint          # typecheck (tsc --noEmit) semua workspace
pnpm test          # jalankan test
pnpm db:push       # sinkron ke schema tanpa migrasi (untuk dev cepat)
pnpm db:studio     # Prisma Studio (GUI database)
```

## Database

- Gunakan **migration biasa (`prisma migrate dev`)** untuk produksi → `prisma migrate deploy`.
- Ubah `apps/api/prisma/schema.prisma` lalu `pnpm db:migrate --name <label>`.
- Seed idempoten (`upsert` berdasarkan slug/key) — aman dijalankan berulang.

## OAuth Callback URL (isi di dashboard platform)

Saat membuat aplikasi OAuth di **Google Cloud Console** / **Meta for Developers**, isi **Authorized redirect URIs** dengan URL callback berikut (berdasarkan `API_URL` di `apps/api/.env`):

| Platform | Login route | Callback URL (Authorized redirect URI) |
| --- | --- | --- |
| Google | `GET /api/auth/google` | `{API_URL}/api/auth/google/callback` |
| Facebook | `GET /api/auth/facebook` | `{API_URL}/api/auth/facebook/callback` |

Default lokal (dengan `API_URL=http://localhost:3000`):

- Google: `http://localhost:3000/api/auth/google/callback`
- Facebook: `http://localhost:3000/api/auth/facebook/callback`

### Di produksi (Railway)

- `API_URL` otomatis terisi dari domain Railway (`RAILWAY_PUBLIC_DOMAIN`) jika tidak diset. Contoh: domain `https://dtmx-social-management-platform-production.up.railway.app` → callback Google `https://dtmx-social-management-platform-production.up.railway.app/api/auth/google/callback`.
- `FRONTEND_URL` juga otomatis memakai domain yang sama jika tidak diset (karena SPA di-serve oleh API di satu domain). Bila frontend terpisah, set `FRONTEND_URL` ke domain frontend.
- **Penting:** daftarkan URL callback **persis** seperti di atas (tanpa trailing slash, tanpa beda huruf) di dashboard platform:
  - **Google Cloud Console** → `APIs & Services` → `Credentials` → pilih *OAuth 2.0 Client ID* → bagian **Authorized redirect URIs** → tambahkan `{APP_URL}/api/auth/google/callback`, lalu simpan.
  - **Meta for Developers** → *App settings* → *Facebook Login* → **Valid OAuth Redirect URIs** → tambahkan `{APP_URL}/api/auth/facebook/callback`.

> Error `redirect_uri_mismatch` (400) terjadi saat URI yang dikirim ke Google tidak cocok dengan daftar **Authorized redirect URIs**. Pastikan string di console benar-benar identik dengan yang terkirim. Setelah login, browser akan diarahkan ke `{FRONTEND_URL}/auth/oauth/callback` (route SPA, tidak perlu didaftarkan di platform).

> **TikTok & YouTube tidak memakai OAuth login** — keduanya hanya provider publish konten. Token (scope `video.publish` untuk TikTok, upload YouTube) dimasukkan manual via `POST /social-accounts/connect`, jadi tidak ada callback URL yang perlu didaftarkan.

### Data awal (otomatis dibuat saat deploy)

Seed berjalan idempoten (upsert) dan dieksekusi **pada setiap deploy/start** (`prisma:deploy` → `prisma:seed:prod` → `start:prod`), sehingga data awal selalu tersedia tanpa langkah manual:

- **Plans** (Free / Basic / Pro / Enterprise)
- **Feature Flags** (inbox, AI replies, media upload, scheduling, publishing)
- **Payment settings** (info rekening manual)
- **AI settings** — `ai_settings` berisi provider aktif + API key/model tiap provider; tabelnya otomatis dibuat oleh migrasi (`prisma migrate deploy`) dan datanya di-seed, sama seperti akun admin
- **Akun admin pertama** (idempoten) + subscription **Pro** aktif agar kuota AI tersedia

Untuk development, jalankan manual:

```bash
pnpm db:seed
```

Kredensial admin default dapat diubah lewat env:

```bash
SEED_ADMIN_EMAIL=admin@dtmx.app
SEED_ADMIN_PASSWORD=admin123456
```

### Konfigurasi AI (Admin Panel)

Provider AI **dikelola dari Admin Panel → tab "AI Providers"** (bukan lewat env). Data tersimpan di tabel `ai_settings`:

- Pilih **provider aktif** (OpenAI / Anthropic / Gemini) yang dipakai AI Studio, auto-reply, dll.
- Isi **API key** dan **model** per provider. API key ditampilkan tersamar (masked) dan hanya disimpan di server.
- Env `AI_PROVIDER`, `OPENAI_API_KEY`, `ANTHROPIC_API_KEY`, `GEMINI_API_KEY`, dll. hanya menjadi **fallback** jika nilai belum diatur lewat dashboard admin.

## Environment (variabel penting)

Lihat `apps/api/.env.example` untuk daftar lengkap. Bagian utama:

- `DATABASE_URL` — koneksi PostgreSQL (Prisma)
- `REDIS_HOST` / `REDIS_PORT` — Redis untuk BullMQ queue
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — token secret auth
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` — fallback provider AI (kelola utama lewat Admin Panel → AI Providers)
- `STRIPE_SECRET_KEY` / `TRIPAY_API_KEY` / `MIDTRANS_SERVER_KEY` — payment
- `GOOGLE_CLIENT_ID` / `FACEBOOK_APP_ID` — OAuth login

## Model data utama

- **User** — akun (email, role user/admin, kuota AI, oauth)
- **Plan / Subscription / Payment** — harga, langganan, pembayaran (multi-gateway)
- **SocialAccount** — akun pihak terhubung (fb/ig/yt/tiktok)
- **Post / PostAccount / PostMedia / PostPublication** — konten, media, jadwal
- **InboxItem** — komentar & DM
- **AutoReplyRule** — balasan otomatis (rule-based / AI)
- **AiUsage** — pencatatan pemakaian AI (token)
- **AiSetting** — konfigurasi AI dari admin (provider aktif, API key, model)
- **PaymentSetting** — info pembayaran manual (rekening tujuan)
- **Notification** — notifikasi in-app
- **FeatureFlag** — tombol fitur per admin (AI replies, inbox, upload, dsb)

## API

Endpoint utama (prabu `apps/api/src/**`):

```
POST /auth/register, /auth/login, /auth/google, /auth/facebook
POST /auth/refresh
GET  /users/me, PATCH /users/me
POST /social-accounts/connect (connect akun platform)
GET  /social-accounts
POST /posts (buat & jadwalkan posting)
GET  /inbox (komentar/DM)
GET  /ai/status, POST /ai/generate (fitur AI)
POST /media/upload
GET  /payments/methods
GET  /subscriptions/plans, /active, /usage
POST /subscriptions/subscribe
POST /subscriptions/:id/proof
GET  /admin/*
GET  /flags, /health
```

Auth menggunakan JWT Bearer. Guard `RolesGuard` + `FeatureGuard` untuk kontrol akses & fitur.

## Git

`.env` dan folder build (`dist`, `build`) dimasukkan ke `.gitignore` — tidak di-commit. Migration & seed ikut di-commit untuk reproduksibilitas.