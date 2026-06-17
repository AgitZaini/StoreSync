# StoreSync Vercel + Neon Deployment

Panduan ini adalah opsi deployment gratis/staging untuk StoreSync tanpa VPS. Jalur Docker Compose production tetap tersedia lewat `docker-compose.prod.yml`.

## Arsitektur

```txt
Vercel
├── client/dist sebagai static frontend
└── api/[...path].ts sebagai Vercel Function untuk Express API

Neon
└── PostgreSQL serverless
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
NODE_ENV=production
```

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

Untuk demo/UAT, seed data bisa dijalankan:

```bash
cd server
DATABASE_URL="postgresql://USER:PASSWORD@HOST.REGION.aws.neon.tech/DB?sslmode=require" npm run db:seed
```

Gunakan direct connection Neon untuk migrasi bila tersedia. Gunakan pooled connection untuk runtime Vercel.

## 5. Smoke Test

Setelah deploy:

```txt
GET https://your-project.vercel.app/api/health
```

Lalu uji dari UI:

- Login Pemilik.
- Login Supervisor.
- Login Sales.
- Input penjualan.
- Buat SPP.
- Approve SPP.
- Cek dashboard dan notifikasi.

## Catatan Batasan Gratis

- Vercel Hobby cocok untuk demo/staging personal.
- Neon Free cocok untuk database kecil/UAT.
- Untuk operasional toko sungguhan, siapkan backup, monitoring, rate limit, dan strategi upgrade plan.
