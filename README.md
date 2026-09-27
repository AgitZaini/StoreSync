# StoreSync v2 — Aplikasi SPG & Team Leader

StoreSync v2 mengelola SPG dan Team Leader yang menjual produk secara konsinyasi di apotek mitra: absen foto + lokasi, jadwal, order barang, laporan penjualan yang disetujui kasir apotek, retur, stock opname, cuti, dan MOU apotek baru. Aplikasi ini menggantikan pencatatan lewat WhatsApp, Excel, dan Salesmania.

Dokumen acuan:

- [BRD v2.0](docs/BRD_StoreSync_v2.0.md), [PRD v2.0](docs/PRD_StoreSync_v2.0.md), [Flowchart v2.0](docs/flowchart_StoreSync_v2.0.html)
- [Rencana implementasi bertahap](docs/PLAN_StoreSync_v2.0.md)
- [Checklist UAT v2](docs/UAT_CHECKLIST_v2.md)

## Status tahapan

- [x] Tahap 1 — Fondasi v2: login nomor HP, 5 peran, wajib ganti sandi pertama, sesi idle, riwayat (audit log) append-only, upload berkas ke R2/MinIO, tampilan responsive
- [ ] Tahap 2 — Akun & data utama
- [ ] Tahap 3 — Jadwal & absen SPG
- [ ] Tahap 4 — Kunjungan Team Leader & lokasi live
- [ ] Tahap 5 — Stok gudang & order
- [ ] Tahap 6 — Laporan penjualan, persetujuan kasir & retur
- [ ] Tahap 7 — Stock opname, serah terima & status gajian
- [ ] Tahap 8 — Cuti/izin & MOU apotek
- [ ] Tahap 9 — Dashboard lengkap, notifikasi, rekap, PWA, hardening & uji coba
- [ ] Tahap 10 — Aplikasi mobile (Android & iOS)

## Tech stack

| Layer | Teknologi |
| --- | --- |
| Frontend | React 19 + Vite + TypeScript, Tailwind CSS 4, React Router, TanStack Query, React Hook Form + Zod |
| Backend | Node.js + Express 5 + TypeScript, Zod |
| Database | PostgreSQL + Prisma |
| Auth | JWT access token (15 menit) + refresh token berotasi |
| Berkas | S3-compatible: Cloudflare R2 (produksi), MinIO (lokal) |
| Deploy | Vercel + Neon, atau Docker Compose |

## Menjalankan lokal

### 1. Jalankan PostgreSQL dan MinIO

```bash
docker compose up -d
```

MinIO: API di `http://localhost:9100`, console di `http://localhost:9101` (user `storesync`, sandi `storesync_dev`). Bucket `storesync` dibuat otomatis oleh service `minio-setup`.

### 2. Backend

```bash
cd server
cp .env.example .env
npm install
npx prisma migrate deploy
npm run db:seed
npm run dev
```

API berjalan di `http://localhost:4000/api` (health check: `GET /api/health`).

### 3. Frontend

```bash
cd client
cp .env.example .env.local
npm install
npm run dev
```

Frontend berjalan di `http://localhost:3000`.

### Akun demo (dari `npm run db:seed`)

Semua akun memakai kata sandi `Password123!`.

| Peran | Nomor HP |
| --- | --- |
| Super Admin | `0812-0000-0001` |
| Admin | `0812-0000-0002` |
| Team Leader | `0812-0000-0003` |
| SPG | `0812-0000-0004` |
| Kasir Apotek | `0812-0000-0005` |
| SPG baru (wajib ganti sandi) | `0812-0000-0006` |

Seed dijalankan ulang akan mengembalikan kata sandi akun demo. Untuk environment baru tanpa akun demo, isi `SEED_SUPER_ADMIN_NAME`, `SEED_SUPER_ADMIN_PHONE`, dan `SEED_SUPER_ADMIN_PASSWORD`. Dengan `NODE_ENV=production`, seed hanya membuat Super Admin tersebut.

## Testing

Test integrasi memakai Jest + Supertest dengan database terpisah `storesync_test`. Test selalu memakai database ini (atau `TEST_DATABASE_URL`), dan menolak mengosongkan database yang namanya tidak mengandung `test`.

```bash
docker exec storesync-postgres createdb -U storesync storesync_test
cd server
DATABASE_URL="postgresql://storesync:storesync_dev@localhost:5432/storesync_test?schema=public" npx prisma migrate deploy
npm test
```

Verifikasi sebelum UAT:

```bash
cd server && npm test && npm run build
cd ../client && npm run lint && npm run build
```

## Endpoint API (Tahap 1)

```txt
POST  /api/auth/login              { phone, password } — nomor 08xx / +62 / 62 diterima
GET   /api/auth/me
POST  /api/auth/refresh            { refreshToken } — token berotasi; ditolak bila idle > SESSION_IDLE_MINUTES
POST  /api/auth/change-password    { currentPassword, newPassword }
POST  /api/auth/logout             { refreshToken }

GET   /api/users                   Super Admin
POST  /api/users                   Super Admin — akun baru wajib ganti sandi saat login pertama
PATCH /api/users/:id/status        Super Admin

POST  /api/files/presign           { purpose, mimeType, size } → URL upload langsung ke R2/MinIO
POST  /api/files/:id/complete      verifikasi berkas sudah terunggah
GET   /api/files/:id               URL unduh sementara (pengunggah, Admin, Super Admin)

GET   /api/notifications
POST  /api/notifications/read-all
POST  /api/notifications/:id/read
```

Selama `mustChangePassword` aktif, semua endpoint kecuali `/auth/me`, `/auth/change-password`, dan `/auth/logout` menjawab `403` dengan `code: "PASSWORD_CHANGE_REQUIRED"`.

## Aturan pengembangan

- Modul server mengikuti pola `server/src/modules/<modul>/{routes,controller,service,schemas}.ts`.
- Setiap perubahan data berjalan di `prisma.$transaction` dan mencatat riwayat lewat `recordAudit(tx, …)` (`server/src/utils/audit.ts`). Tabel `AuditLog` dilindungi trigger database: tidak bisa di-update atau di-delete.
- Tanggal bisnis memakai WIB (`server/src/utils/time.ts`). Client juga menampilkan jam dalam WIB.
- Halaman client ada di `client/src/features/<modul>/`, menu per peran di `client/src/routes/navigation.ts`.

## Deployment

- Vercel + Neon + R2: [docs/VERCEL_NEON_DEPLOYMENT.md](docs/VERCEL_NEON_DEPLOYMENT.md)
- Docker Compose: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

> **Upgrade dari v1:** migrasi Prisma v2 memakai baseline baru. Database v1 yang sudah ada harus dikosongkan dulu sebelum `prisma migrate deploy`, karena data v1 tidak dipakai lagi.
