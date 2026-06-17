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
```

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

## Seed Data

Untuk environment demo/UAT, jalankan seed secara manual:

```bash
docker compose --env-file .env.production -f docker-compose.prod.yml exec server npm run db:seed
```

Jangan menjalankan seed demo di produksi nyata tanpa menyesuaikan akun dan password.

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
