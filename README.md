# StoreSync v2 — Aplikasi SPG & Team Leader

StoreSync v2 mengelola SPG dan Team Leader yang menjual produk secara konsinyasi di apotek mitra: absen foto + lokasi, jadwal, order barang, laporan penjualan yang disetujui kasir apotek, retur, stock opname, cuti, dan MOU apotek baru. Aplikasi ini menggantikan pencatatan lewat WhatsApp, Excel, dan Salesmania.

Dokumen acuan:

- [BRD v2.0](docs/BRD_StoreSync_v2.0.md), [PRD v2.0](docs/PRD_StoreSync_v2.0.md), [Flowchart v2.0](docs/flowchart_StoreSync_v2.0.html)
- [Rencana implementasi bertahap](docs/PLAN_StoreSync_v2.0.md)
- [Checklist UAT v2](docs/UAT_CHECKLIST_v2.md)
- [Skenario uji dari nol](docs/SKENARIO_UJI_v2.md) — satu alur antarperan untuk mencoba Tahap 1–5 dari database kosong

## Status tahapan

- [x] Tahap 1 — Fondasi v2: login nomor HP, 5 peran, wajib ganti sandi pertama, sesi idle, riwayat (audit log) append-only, upload berkas ke R2/MinIO, tampilan responsive
- [x] Tahap 2 — Akun & data utama: pengguna, tim, apotek + akun kasir otomatis (peta & radius), penempatan SPG maks. 3 apotek, produk, target omzet, pengaturan cuti/potongan, riwayat, batas akses per peran
- [x] Tahap 3 — Jadwal & absen SPG: jadwal mingguan oleh Admin, absen foto langsung + deteksi wajah/kedip + radius GPS, pemantauan telat/tidak masuk, pengecualian absen disetujui Admin
- [x] Tahap 4 — Kunjungan Team Leader & lokasi live: absen kunjungan foto + radius di semua apotek aktif dengan durasi otomatis, sesi kerja + lokasi live tiap 5 menit (Wake Lock), peta leader, rencana kunjungan mingguan terkunci Senin 00.00, evaluasi rencana vs kunjungan dengan alasan + bukti
- [x] Tahap 5 — Stok gudang & order: stok pusat (barang masuk ber-PO, penyesuaian beralasan, riwayat mutasi), order SPG → persetujuan Super Admin → kirim Admin → terima SPG dengan tanda selisih, permintaan belum terpenuhi + rekap pembelian, stok SPG per apotek (ledger) dan stok awal go-live
- [x] Tahap 6 — Laporan penjualan, persetujuan kasir & retur: laporan harian SPG dengan cek stok tersedia, persetujuan/tolak kasir dengan nama + foto wajah, perbaikan & kirim ulang, omzet vs target, laporan tertunda (JUL-05), retur SPG → kasir → Super Admin → diterima gudang dengan tanda selisih
- [ ] Tahap 7 — Stock opname, serah terima & status gajian
- [ ] Tahap 8 — Cuti/izin & MOU apotek
- [ ] Tahap 9 — Dashboard lengkap, notifikasi, rekap, PWA, hardening & uji coba
- [ ] Tahap 10 — Aplikasi mobile (Android & iOS)

## Tech stack

| Layer | Teknologi |
| --- | --- |
| Frontend | React 19 + Vite + TypeScript, Tailwind CSS 4, React Router, TanStack Query, React Hook Form + Zod, Leaflet + OpenStreetMap, MediaPipe Face Landmarker (di-host sendiri) |
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

| Peran | Nomor HP | Keterangan |
| --- | --- | --- |
| Super Admin | `0812-0000-0001` | |
| Admin | `0812-0000-0002` | |
| Team Leader | `0812-0000-0003` | Memimpin "Tim Demo Jakarta"; punya rencana kunjungan minggu lalu (belum diberi alasan), minggu ini, dan minggu depan |
| SPG | `0812-0000-0004` | Ditempatkan di Apotek Demo Sehat dan Apotek Demo Keluarga; punya jadwal minggu ini dan minggu depan, stok awal di kedua apotek, satu order menunggu persetujuan, laporan penjualan hari ini (menunggu kasir Sehat), dan satu retur (menunggu kasir Keluarga) |
| SPG baru | `0812-0000-0006` | Wajib ganti sandi; belum ditempatkan |
| Kasir Apotek | `0812-0000-0005` | Kasir Apotek Demo Sehat |
| Kasir Apotek | `0812-0000-0011` | Kasir Apotek Demo Keluarga |
| Kasir Apotek | `0812-0000-0012` | Kasir Apotek Demo Harapan 24 Jam |

Seed juga membuat 5 produk demo (kode `DEMO-…`), target omzet bulan berjalan, dan stok pusat demo (Vitamin C sengaja kosong untuk mencoba permintaan belum terpenuhi). Menjalankan seed ulang akan mengembalikan kata sandi dan data demo. Untuk environment baru tanpa akun demo, isi `SEED_SUPER_ADMIN_NAME`, `SEED_SUPER_ADMIN_PHONE`, dan `SEED_SUPER_ADMIN_PASSWORD`. Dengan `NODE_ENV=production`, seed hanya membuat Super Admin tersebut.

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

## Endpoint API

Semua endpoint (kecuali login/refresh/health) butuh `Authorization: Bearer <accessToken>`. Batas data per peran (AKN-06) diterapkan di server: SPG hanya datanya sendiri, Team Leader timnya, Kasir apoteknya, Admin dan Super Admin semua.

```txt
# Auth (Tahap 1)
POST  /api/auth/login                { phone, password } — nomor 08xx / +62 / 62 diterima
GET   /api/auth/me
POST  /api/auth/refresh              { refreshToken } — berotasi; ditolak bila idle > SESSION_IDLE_MINUTES
POST  /api/auth/change-password      { currentPassword, newPassword }
POST  /api/auth/logout               { refreshToken }

# Pengguna & tim (Tahap 2)
GET   /api/users                     Super Admin, Admin — filter role, status, teamId, q
GET   /api/users/:id                 Super Admin, Admin
POST  /api/users                     Super Admin — bukan untuk KASIR (dibuat bersama apotek)
PATCH /api/users/:id                 Super Admin — nama, nomor HP, peran
PATCH /api/users/:id/status          Super Admin — SPG harus bebas penempatan, TL tidak memimpin tim
POST  /api/users/:id/reset-password  Super Admin — sandi sementara, wajib diganti
PATCH /api/users/:id/team            Super Admin — { teamId | null }, hanya SPG
GET   /api/teams                     Super Admin, Admin (semua), Team Leader (timnya)
POST  /api/teams, PATCH /api/teams/:id   Super Admin — satu leader satu tim

# Apotek & penempatan (Tahap 2)
GET   /api/pharmacies, /api/pharmacies/:id   semua peran (sesuai batas akses)
POST  /api/pharmacies                Super Admin — akun Kasir Apotek dibuat otomatis
PATCH /api/pharmacies/:id            Super Admin
PATCH /api/pharmacies/:id/status     Super Admin — ACTIVE/INACTIVE, akun kasir ikut
GET   /api/placements                semua peran (sesuai batas akses)
POST  /api/placements                Super Admin — maks. 3 apotek aktif per SPG
POST  /api/placements/:id/end        Super Admin — { reason }; stok SPG di apotek itu harus 0 dan tidak ada order berjalan

# Produk, target, pengaturan, riwayat, dashboard (Tahap 2)
GET   /api/products                  semua peran (produk aktif; Admin/SA bisa includeInactive=true)
POST  /api/products, PATCH /api/products/:id   Super Admin
GET   /api/targets?month=YYYY-MM     Super Admin, Admin, Team Leader, SPG
PUT   /api/targets/:month            Super Admin — { targets: [{ spgId, amount | null }] }
GET   /api/settings                  Super Admin
PUT   /api/settings/leave-quota      Super Admin — { days }
POST  /api/settings/deduction-rates  Super Admin — { amountPerDay }, berlaku mulai sekarang
GET   /api/audit-logs                Super Admin — filter entity, entityId, actorId, action, from, to; cursor
GET   /api/dashboard/overview        Super Admin, Admin

# Jadwal & absen (Tahap 3)
GET   /api/schedules?weekStart=YYYY-MM-DD      Super Admin, Admin, Team Leader, SPG — minggu mulai Senin
PUT   /api/schedules/week/:weekStart           Admin — { entries: [{ spgId, pharmacyId, date, value | null }] }
POST  /api/attendance                          SPG — { pharmacyId, kind, photoFileId, latitude, longitude, accuracyM, faceCheck }
GET   /api/attendance/today                    SPG — status absen di setiap apotek tugas hari ini
GET   /api/attendance?from=&to=&spgId=         Super Admin, Admin, Team Leader, SPG — riwayat
GET   /api/attendance/monitor?date=            Super Admin, Admin, Team Leader — jadwal vs absen
PUT   /api/attendance/notes                    Admin — catatan telat/tidak masuk
POST  /api/attendance/exceptions               SPG — pengecualian saat GPS/verifikasi wajah gagal
GET   /api/attendance/exceptions?status=       Super Admin, Admin, Team Leader, SPG
POST  /api/attendance/exceptions/:id/approve   Admin — absen dicatat dengan jam saat SPG mencoba
POST  /api/attendance/exceptions/:id/reject    Admin — { note }
PUT   /api/settings/attendance                 Super Admin — { maxAccuracyM, lateToleranceMinutes, leaderWorkEndTime }

# Kunjungan Team Leader & lokasi live (Tahap 4)
POST  /api/visits/attendance                   Team Leader — { pharmacyId, kind, photoFileId, latitude, longitude, accuracyM, faceCheck }; semua apotek aktif
GET   /api/visits/today                        Team Leader — sesi kerja, kunjungan & rencana hari ini, alasan yang belum diisi
POST  /api/visits/end-day                      Team Leader — "Selesai hari ini" (lokasi live berhenti)
POST  /api/locations/ping                      Team Leader — { latitude, longitude, accuracyM }; hanya selama sesi kerja
GET   /api/locations/leaders?date=             Super Admin, Admin — posisi terakhir + status kerja setiap TL
GET   /api/locations/leaders/:id/trail?date=   Super Admin, Admin — jejak harian + kunjungan
GET   /api/visit-plans?weekStart=&leaderId=    Team Leader (miliknya), Super Admin, Admin — rencana + evaluasi per hari
GET   /api/visit-plans/summary?weekStart=      Super Admin, Admin — ringkasan semua TL
PUT   /api/visit-plans/week/:weekStart         Team Leader — { days: [{ date, pharmacyIds }] }; terkunci Senin 00.00 WIB
PUT   /api/visit-plans/items/:id/reason        Team Leader — { reason, evidenceFileId? } untuk apotek rencana yang tidak dikunjungi

# Stok gudang, order & stok SPG (Tahap 5)
GET   /api/warehouse/stock                     Super Admin, Admin, Team Leader, SPG — stok pusat per produk + jumlah dipesan
GET   /api/warehouse/movements?productId=&type=&from=&to=   Super Admin, Admin — riwayat mutasi
POST  /api/warehouse/inbound                   Admin — { date, poNumber?, note?, items: [{ productId, qty }] }
POST  /api/warehouse/adjustments               Admin — { productId, qty (±), reason }
POST  /api/orders                              SPG — { pharmacyId, note?, items: [{ productId, qty }] }; stok kurang → permintaan belum terpenuhi
GET   /api/orders?status=&spgId=&pharmacyId=&openDiscrepancy=   sesuai batas akses; GET /api/orders/:id
POST  /api/orders/:id/approve                  Super Admin — { items?: [{ itemId, qty }], note? }; jumlah ≤ diminta
POST  /api/orders/:id/reject                   Super Admin — { reason }
POST  /api/orders/:id/ship                     Admin — { items?: [{ itemId, qty }], note? }; ≤ disetujui dan ≤ stok pusat
POST  /api/orders/:id/receive                  SPG pemesan — { items?: [{ itemId, qty }], note? }; catatan wajib bila selisih
POST  /api/orders/:id/resolve-discrepancy      Admin — { note }
GET   /api/orders/unfulfilled-recap?from=&to=  Super Admin, Admin — rekap permintaan belum terpenuhi (ORD-05)
GET   /api/field-stock?holderId=&pharmacyId=   Super Admin, Admin, Team Leader (timnya), SPG (miliknya)
GET   /api/field-stock/movements?holderId=&pharmacyId=&productId=   ledger stok SPG
PUT   /api/field-stock/opening                 Admin — { spgId, pharmacyId, items: [{ productId, qty }] }; terkunci setelah ada transaksi lain
GET   /api/field-stock/available?pharmacyId=  SPG — stok tersedia (sisa − laporan menunggu − retur berjalan) per produk

# Laporan penjualan & retur (Tahap 6)
POST  /api/sales-reports                       SPG — { pharmacyId, reportDate?, note?, items: [{ productId, qty }] }; hari ini/kemarin, satu per apotek per hari
PUT   /api/sales-reports/:id                   SPG — ubah/kirim ulang laporan yang menunggu atau ditolak (revisi +1)
POST  /api/sales-reports/:id/approve           Kasir — { revision, cashierName, cashierPhotoFileId, faceCheck? }; stok dicek ulang
POST  /api/sales-reports/:id/reject            Kasir — { revision, cashierName, cashierPhotoFileId, reason }
GET   /api/sales-reports?status=&from=&to=     sesuai batas akses (Kasir: apoteknya); GET /api/sales-reports/:id
GET   /api/sales-reports/pending?olderThanDays=1   Super Admin, Admin — laporan belum diputuskan kasir (JUL-05)
GET   /api/sales-reports/performance?month=    Super Admin, Admin, Team Leader, SPG — omzet disetujui vs target per SPG + harian
POST  /api/returns                             SPG — { pharmacyId, reason, photoFileId?, items: [{ productId, qty }] }
POST  /api/returns/:id/kasir-approve | kasir-reject   Kasir — nama + foto (+ reason bila menolak)
POST  /api/returns/:id/approve | reject        Super Admin — { note? } / { reason }
POST  /api/returns/:id/receive                 Admin — { items?: [{ itemId, qty }], note? }; catatan wajib bila selisih
GET   /api/returns?status=&discrepancy=        sesuai batas akses; GET /api/returns/:id

# Berkas & notifikasi (Tahap 1)
POST  /api/files/presign             { purpose, mimeType, size } → URL upload langsung ke R2/MinIO
POST  /api/files/:id/complete        verifikasi berkas sudah terunggah
GET   /api/files/:id                 URL unduh sementara (pengunggah, Admin, Super Admin, Team Leader untuk timnya)
GET   /api/notifications
POST  /api/notifications/read-all
POST  /api/notifications/:id/read
```

Selama `mustChangePassword` aktif, semua endpoint kecuali `/auth/me`, `/auth/change-password`, dan `/auth/logout` menjawab `403` dengan `code: "PASSWORD_CHANGE_REQUIRED"`.

## Aturan pengembangan

- Modul server mengikuti pola `server/src/modules/<modul>/{routes,controller,service,schemas}.ts`.
- Setiap perubahan data berjalan di `prisma.$transaction` dan mencatat riwayat lewat `recordAudit(tx, …)` (`server/src/utils/audit.ts`). Tabel `AuditLog` dilindungi trigger database: tidak bisa di-update atau di-delete.
- Query list/get memakai batas akses dari `scopeFor(actor)` (`server/src/utils/scope.ts`).
- Tanggal bisnis memakai WIB (`server/src/utils/time.ts`). Client juga menampilkan jam dalam WIB.
- Halaman client ada di `client/src/features/<modul>/`, menu per peran di `client/src/routes/navigation.ts`.
- Absen kunjungan Team Leader memakai tabel `Attendance` yang sama (pemeriksaan di `modules/attendance/attendance-checks.ts`); `LeaderVisit` menautkan absen masuk/keluar dan menyimpan durasi. Lokasi live web hanya berjalan saat aplikasi terbuka (`watchPosition` + Wake Lock, ping tiap 5 menit); titik lokasi tidak dicatat di riwayat.
- Stok hanya berubah lewat `server/src/modules/stock/stock-ledger.ts`: saldo diubah atomik (pengurangan memakai `WHERE qty >= n`) dan setiap perubahan dicatat sebagai mutasi dengan saldo sesudahnya (`WarehouseMovement`, `FieldStockMovement`). Tabel mutasi dan `Approval` append-only; kolom `qty` stok dijaga `CHECK (qty >= 0)`.
- Stok tersedia untuk laporan penjualan dan retur = sisa stok − laporan yang menunggu kasir − retur yang belum diterima gudang (`modules/stock/field-availability.ts`); dicek saat kirim dan dicek ulang saat kasir menyetujui. Laporan penjualan yang sudah disetujui dikunci trigger database (AB-06).
- Retur: stok SPG berkurang sejumlah yang disetujui kasir, stok pusat bertambah sejumlah yang benar-benar diterima Admin; selisihnya ditandai dan Super Admin diberi tahu (asumsi di rencana, menunggu konfirmasi Kak Tutut).
- Absen (`Attendance`) juga append-only di database. Absen web memakai kamera langsung + deteksi wajah/kedip MediaPipe; model `client/src/assets/models/face_landmarker.task` dan WASM-nya di-host sendiri (±7 MB setelah kompresi, diunduh sekali lalu di-cache). Deteksi lokasi palsu dan tracking latar belakang menyusul di aplikasi mobile (Tahap 10).

## Deployment

- Vercel + Neon + R2: [docs/VERCEL_NEON_DEPLOYMENT.md](docs/VERCEL_NEON_DEPLOYMENT.md)
- Docker Compose: [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md)

> **Upgrade dari v1:** migrasi Prisma v2 memakai baseline baru. Database v1 yang sudah ada harus dikosongkan dulu sebelum `prisma migrate deploy`, karena data v1 tidak dipakai lagi.
