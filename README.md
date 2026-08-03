# DtmX

AI-powered social media management platform (monorepo).

## Arsitektur

- **apps/api** — Backend REST API (NestJS) + queue BullMQ + scheduler
- **apps/web** — Frontend (belum diisi)
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

## Environment (variabel penting)

Lihat `apps/api/.env.example` untuk daftar lengkap. Bagian utama:

- `DATABASE_URL` — koneksi PostgreSQL (Prisma)
- `REDIS_HOST` / `REDIS_PORT` — Redis untuk BullMQ queue
- `JWT_SECRET` / `JWT_REFRESH_SECRET` — token secret auth
- `OPENAI_API_KEY` / `ANTHROPIC_API_KEY` / `GEMINI_API_KEY` — provider AI
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
- **FeatureFlag** — tombol fitur per admin (AI replies, inbox, upload, dsb)

## API

Endpoint utama (prabu `apps/api/src/**`):

```
POST /auth/register, /auth/login, /auth/google, /auth/facebook
GET  /users/me, /profile
POST /social-accounts (connect akun platform)
POST /posts (buat & jadwalkan posting)
GET  /inbox (komentar/DM)
POST /ai/reply, /ai/caption (fitur AI)
POST /media/upload
POST /payments/checkout
POST /subscriptions/activate
GET  /admin/*
GET  /features
```

Auth menggunakan JWT Bearer. Guard `RolesGuard` + `FeatureGuard` untuk kontrol akses & fitur.

## Git

`.env` dan folder build (`dist`, `build`) dimasukkan ke `.gitignore` — tidak di-commit. Migration & seed ikut di-commit untuk reproduksibilitas.