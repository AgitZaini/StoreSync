# StoreSync

StoreSync adalah aplikasi monitoring dan manajemen operasional toko berbasis web. Aplikasi ini menghubungkan Pemilik, Supervisor, dan Sales dalam satu platform terpusat untuk mengelola stok, mencatat penjualan, mengatur persetujuan pembelian stok, memantau deposit, dan melihat laporan keuangan.

## Tech Stack

| Layer | Teknologi |
| --- | --- |
| Frontend | React.js + Vite + TypeScript |
| UI | Tailwind CSS + shadcn/ui-ready structure |
| Backend | Node.js + Express + TypeScript |
| Database | PostgreSQL |
| ORM | Prisma |
| Auth | JWT access token + refresh token |
| Export | PDFKit / ExcelJS, planned |
| Local dev | Docker Compose |

## Struktur Proyek

```txt
StoreSync/
├── client/
│   ├── src/
│   │   ├── app/
│   │   ├── components/
│   │   ├── features/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── routes/
│   │   ├── store/
│   │   └── types/
│   └── public/
├── server/
│   ├── prisma/
│   │   └── schema.prisma
│   ├── src/
│   │   ├── config/
│   │   ├── middleware/
│   │   ├── modules/
│   │   ├── routes/
│   │   ├── utils/
│   │   ├── app.ts
│   │   └── server.ts
│   └── tests/
├── docs/
│   └── PRD_StoreSync_v1.0.docx
└── docker-compose.yml
```

## Menjalankan Lokal

### 1. Jalankan PostgreSQL

```bash
docker compose up -d
```

### 2. Setup backend

```bash
cd server
cp .env.example .env
npm install
npm run prisma:generate
npm run dev
```

### Backend testing

Integration test backend memakai Jest + Supertest dan database PostgreSQL terpisah `storesync_test`.

```bash
docker compose up -d
docker exec storesync-postgres createdb -U storesync storesync_test
cd server
DATABASE_URL="postgresql://storesync:storesync_dev@localhost:5432/storesync_test?schema=public" npx prisma migrate deploy
npm test
```

Test coverage awal mencakup auth, RBAC, produk/stok, penjualan, SPP, deposit/finance, dashboard, dan notifikasi.

Backend berjalan di:

```txt
http://localhost:4000
```

Health check:

```txt
GET http://localhost:4000/api/health
```

Seed akun development:

```txt
Pemilik    owner@storesync.local      Password123!
Supervisor supervisor@storesync.local Password123!
Sales      sales@storesync.local      Password123!
```

Endpoint auth awal:

```txt
POST /api/auth/login
GET  /api/auth/me
POST /api/auth/refresh
POST /api/auth/logout
GET  /api/users              # OWNER only
POST /api/users              # OWNER only
PATCH /api/users/:id/status  # OWNER only
```

Endpoint produk dan stok awal:

```txt
GET  /api/products                         # OWNER, SUPERVISOR, SALES
POST /api/products                         # OWNER, SUPERVISOR
GET  /api/products/:id                     # OWNER, SUPERVISOR, SALES
PATCH /api/products/:id                    # OWNER, SUPERVISOR
GET  /api/products/categories              # OWNER, SUPERVISOR, SALES
POST /api/products/categories              # OWNER, SUPERVISOR
GET  /api/inventory/mutations              # OWNER, SUPERVISOR
POST /api/inventory/products/:id/adjust    # OWNER, SUPERVISOR
```

Endpoint penjualan awal:

```txt
GET  /api/sales       # OWNER/SUPERVISOR melihat semua, SALES melihat milik sendiri
POST /api/sales       # mencatat transaksi dan otomatis mengurangi stok
GET  /api/sales/:id   # SALES hanya bisa membuka transaksi milik sendiri
```

Endpoint SPP pembelian stok:

```txt
GET  /api/purchase-requests                     # OWNER, SUPERVISOR
POST /api/purchase-requests                     # OWNER, SUPERVISOR
GET  /api/purchase-requests/:id                 # OWNER, SUPERVISOR
POST /api/purchase-requests/:id/approve         # OWNER
POST /api/purchase-requests/:id/reject          # OWNER
POST /api/purchase-requests/:id/request-revision # OWNER
POST /api/purchase-requests/:id/realize         # OWNER, SUPERVISOR
```

Endpoint deposit dan keuangan:

```txt
GET  /api/deposits          # OWNER, SUPERVISOR
POST /api/deposits          # OWNER, SUPERVISOR
GET  /api/finance/summary   # OWNER, SUPERVISOR
GET  /api/finance/expenses  # OWNER, SUPERVISOR
POST /api/finance/expenses  # OWNER, SUPERVISOR
```

Endpoint dashboard dan notifikasi:

```txt
GET  /api/dashboard/summary       # Semua role
GET  /api/notifications           # Semua role
POST /api/notifications/read-all  # Semua role
POST /api/notifications/:id/read  # Semua role
```

### 3. Setup frontend

```bash
cd client
cp .env.example .env.local
npm install
npm run dev
```

Frontend berjalan di:

```txt
http://localhost:3000
```

## Roadmap MVP

- [x] Fase 0: project foundation
- [x] Fase 1: autentikasi dan RBAC
- [x] Fase 2: manajemen produk dan stok
- [x] Fase 3: pencatatan penjualan
- [x] Fase 4: alur SPP dan approval pembelian stok
- [x] Fase 5: deposit dan laporan keuangan dasar
- [x] Fase 6: dashboard per peran dan notifikasi
- [ ] Fase 7: testing, UAT, dan deployment
