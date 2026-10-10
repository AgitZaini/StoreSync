# StoreSync Vercel + Neon Deployment

Panduan ini adalah opsi deployment gratis/staging untuk StoreSync tanpa VPS. Jalur Docker Compose production tetap tersedia lewat `docker-compose.prod.yml`.

## Arsitektur

```txt
Vercel
├── client/dist sebagai static frontend
└── api/index.ts sebagai Vercel Function untuk Express API

Neon
└── PostgreSQL serverless

Cloudflare R2
└── Foto absen, foto kasir, surat dokter, dan berkas MOU (upload langsung dari browser)
```

Frontend memakai `VITE_API_URL=/api`, sehingga request API tetap satu origin:

```txt
https://your-project.vercel.app/api/health
```

## 1. Buat Database Neon

1. Buat project baru di Neon.
2. Pilih region yang dekat dengan region Vercel.
3. Ambil connection string pooled. Biasanya hostname mengandung `-pooler`.
4. Gunakan string pooled untuk runtime Vercel karena serverless perlu connection pooling.

## 2. Environment Variables di Vercel

Tambahkan variable berikut di Project Settings Vercel:

```txt
DATABASE_URL=postgresql://USER:PASSWORD@HOST-pooler.REGION.aws.neon.tech/DB?sslmode=require
JWT_ACCESS_SECRET=secret-minimal-32-karakter
JWT_REFRESH_SECRET=secret-minimal-32-karakter
CLIENT_URL=https://your-project.vercel.app
VITE_API_URL=/api
VITE_IDLE_TIMEOUT_MINUTES=30
SESSION_IDLE_MINUTES=45
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=storesync
S3_ACCESS_KEY_ID=...
S3_SECRET_ACCESS_KEY=...
S3_FORCE_PATH_STYLE=false
```

Untuk staging yang dipakai demo, tambahkan `VITE_SHOW_DEMO_ACCOUNTS=true` supaya tombol akun demo muncul di halaman login.

> **Jangan tambahkan `NODE_ENV`.** Dengan `NODE_ENV=production`, `npm ci` saat build melewati devDependencies (Vite, TypeScript, Prisma CLI) sehingga build gagal. Vercel sudah memakai mode production saat runtime. `SESSION_IDLE_MINUTES` dan `VITE_IDLE_TIMEOUT_MINUTES` opsional (bawaan 45 dan 30 menit).

Pindahkan juga region fungsi ke dekat database: **Settings → Functions → Function Region → Singapore (sin1)** bila Neon di AWS Asia Pacific (Singapore).

## 2b. Siapkan bucket Cloudflare R2

1. Buat bucket `storesync` di Cloudflare R2 (lokasi: Asia-Pacific).
2. Buat API token R2 dengan izin *Object Read & Write* untuk bucket itu; isi `S3_ACCESS_KEY_ID` dan `S3_SECRET_ACCESS_KEY`.
3. Atur CORS bucket supaya browser bisa upload langsung:

```json
[
  {
    "AllowedOrigins": ["https://your-project.vercel.app"],
    "AllowedMethods": ["PUT", "GET"],
    "AllowedHeaders": ["Content-Type"],
    "MaxAgeSeconds": 3600
  }
]
```

4. Jangan pasang lifecycle rule yang menghapus objek: foto wajib disimpan minimal 2 tahun (NFR PRD).

Untuk preview deployment, `CLIENT_URL` bisa diganti ke URL preview bila ingin CORS presisi. Jika frontend memanggil `/api` di origin yang sama, CORS tidak menjadi blocker utama.

## 3. Import Project ke Vercel

1. Push repository ke GitHub/GitLab/Bitbucket.
2. Import repository dari dashboard Vercel.
3. Root Directory tetap root repository.
4. Vercel akan membaca `vercel.json`.
5. Build command yang dipakai:

```bash
npm run vercel-build
```

Build ini akan menginstall dependency backend, generate Prisma Client, menginstall dependency frontend, lalu build Vite.

## 4. Jalankan Migrasi Prisma ke Neon

Jalankan dari lokal setelah `DATABASE_URL` Neon tersedia:

```bash
cd server
DATABASE_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require" npx prisma migrate deploy
```

> **Upgrade dari v1:** migrasi v2 memakai baseline baru. Database Neon yang berisi schema v1 harus dikosongkan dulu (misalnya buat branch/database baru di Neon), lalu jalankan `migrate deploy`.

Untuk demo/UAT, seed akun demo bisa dijalankan (NODE_ENV bukan `production`):

```bash
cd server
DATABASE_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require" npm run db:seed
```

Untuk environment tanpa akun demo, buat Super Admin pertama (wajib ganti sandi saat login pertama):

```bash
cd server
NODE_ENV=production SEED_SUPER_ADMIN_NAME="Nama Super Admin" SEED_SUPER_ADMIN_PHONE="0812xxxxxxxx" SEED_SUPER_ADMIN_PASSWORD="SandiSementara1" \
DATABASE_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require" npm run db:seed
```

Gunakan direct connection Neon untuk migrasi bila tersedia. Gunakan pooled connection untuk runtime Vercel.

## 5. Smoke Test

Setelah deploy:

```txt
GET https://your-project.vercel.app/api/health
```

Lalu jalankan [Checklist UAT v2](UAT_CHECKLIST_v2.md) untuk tahap yang sedang dirilis, dari laptop dan dari HP. Halaman seperti `/profil` harus tetap terbuka saat di-reload (rewrite SPA di `vercel.json`).

## Catatan Batasan Gratis

- Vercel Hobby cocok untuk demo/staging personal.
- Neon Free cocok untuk database kecil/UAT.
- Vercel Cron di paket Hobby hanya berjalan harian; job per 10–15 menit di Tahap 9 butuh paket Pro atau cron eksternal.
- Untuk operasional sungguhan, siapkan backup, monitoring, dan strategi upgrade plan.
