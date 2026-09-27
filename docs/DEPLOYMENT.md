# StoreSync Deployment Guide

Panduan ini menyiapkan deployment Docker untuk MVP StoreSync.

## Environment Produksi

Buat file `.env.production` di root project:

```bash
POSTGRES_DB=storesync
POSTGRES_USER=storesync
POSTGRES_PASSWORD=change-me-strong-db-password
JWT_ACCESS_SECRET=change-me-access-secret-min-32-chars
JWT_REFRESH_SECRET=change-me-refresh-secret-min-32-chars
CLIENT_URL=http://localhost:3000
CLIENT_PORT=3000
SESSION_IDLE_MINUTES=45
S3_ENDPOINT=https://ACCOUNT_ID.r2.cloudflarestorage.com
S3_REGION=auto
S3_BUCKET=storesync
S3_ACCESS_KEY_ID=change-me
S3_SECRET_ACCESS_KEY=change-me
S3_FORCE_PATH_STYLE=false
```

Berkas (foto absen, foto kasir, MOU) disimpan di Cloudflare R2. Atur CORS bucket seperti di [VERCEL_NEON_DEPLOYMENT.md](VERCEL_NEON_DEPLOYMENT.md#2b-siapkan-bucket-cloudflare-r2), dengan origin `CLIENT_URL`.

Untuk domain produksi, ubah `CLIENT_URL` menjadi origin frontend, misalnya `https://storesync.example.com`.

## Build dan Start

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml up -d --build
```

Frontend tersedia di:

```txt
http://localhost:3000
```

Backend diproxy lewat frontend:

```txt
http://localhost:3000/api/health
```

## Migrasi Database

Container backend menjalankan:

```bash
npx prisma migrate deploy
```

setiap kali start. Pastikan migration Prisma sudah tersedia sebelum deploy.

> **Upgrade dari v1:** migrasi v2 memakai baseline baru. Volume database v1 (`storesync_postgres_data`) harus dikosongkan dulu, karena data v1 tidak dipakai di v2.

## Seed Data

Container produksi berjalan dengan `NODE_ENV=production`, sehingga seed tidak membuat akun demo. Buat Super Admin pertama (wajib ganti sandi saat login pertama):

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec \
  -e SEED_SUPER_ADMIN_NAME="Nama Super Admin" -e SEED_SUPER_ADMIN_PHONE="0812xxxxxxxx" -e SEED_SUPER_ADMIN_PASSWORD="SandiSementara1" \
  server npm run db:seed
```

## Smoke Test

```bash
curl http://localhost:3000/api/health
```

Login dari UI menggunakan akun yang sudah dibuat, lalu cek menu sesuai role.

## Rollback

Jika deploy gagal:

1. Cek log: `docker compose --env-file .env.production -f docker-compose.prod.yml logs -f`.
2. Stop service: `docker compose --env-file .env.production -f docker-compose.prod.yml down`.
3. Deploy ulang image/commit sebelumnya.

Data PostgreSQL tersimpan di volume `storesync_postgres_data`.
