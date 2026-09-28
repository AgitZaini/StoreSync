# Rencana Implementasi StoreSync v2.0 — Aplikasi SPG & Team Leader

## Konteks

StoreSync v1 adalah aplikasi monitoring toko (peran Pemilik/Supervisor/Sales: produk, penjualan, SPP, deposit, keuangan). Dokumen v2.0 (`docs/BRD_StoreSync_v2.0.md`, `docs/PRD_StoreSync_v2.0.md`, `docs/flowchart_StoreSync_v2.0.html`) mengganti domainnya menjadi **pengelolaan SPG & Team Leader yang menjual produk Kak Tutut secara konsinyasi di 70–80 apotek**. Aplikasi ini menggantikan WhatsApp, Excel, dan Salesmania. Ada 5 peran (Super Admin, Admin, Team Leader, SPG, Kasir Apotek) dan 10 modul (AKN, ABS, JDW/KNJ, STK/ORD, JUL, RTR, SO, CTI, MOU, DSB/NTF/LOG).

Target: semua user story modul 1–10 (kecuali JUL-02) berjalan, dikerjakan bertahap. **Web dulu (responsive sampai lebar HP 375 px)**, tiap tahap ringan dan bisa diuji sendiri. **Aplikasi mobile dikerjakan setelah semua tahap web selesai.**

### Keputusan yang sudah disepakati
| Topik | Keputusan |
| --- | --- |
| Modul v1 | Diganti total. Schema Prisma baru untuk v2, modul v1 dihapus. Fondasinya dipakai ulang. |
| Absen di web | Uji coba lapangan memakai web responsive. Anti-fraud di web: kamera langsung, deteksi wajah + kedip, radius 20 m, dan akurasi GPS dicatat. Deteksi fake GPS dan tracking di latar belakang menyusul di app mobile. |
| Penyimpanan berkas | Cloudflare R2 (S3-compatible) untuk produksi dan MinIO untuk lokal. |
| E-meterai | Ditunda. Tahap web: MOU digital (TTD di layar + foto) jadi PDF, ditambah opsi unggah scan MOU fisik bermeterai. Integrasi API e-meterai masuk backlog. |
| Teknologi mobile (usulan) | React Native + Expo (TypeScript), memakai backend dan tipe yang sama. |

---

## Fondasi yang dipakai ulang (jangan ditulis ulang)

**Server** (Express 5 + Prisma 6 + Zod + JWT, deploy Vercel `api/index.ts` + Neon, atau Docker):
- Pola modul `server/src/modules/<modul>/{routes,controller,service,schemas}.ts`, contohnya `modules/sales/*`
- `middleware/authenticate.ts`, `middleware/authorize.ts` (enum peran diganti), `middleware/validate-request.ts` (`validateBody`), `middleware/error-handler.ts` (`AppError`), `utils/async-handler.ts`
- `modules/auth/*` (access + refresh token, `token.service.ts`), `utils/password.ts`
- `modules/notifications/notifications.service.ts` (`notifyUser`, `notifyUsersByRole`) untuk notifikasi in-app
- Model `AuditLog`, yang diperluas menjadi riwayat immutable
- Test integrasi Jest + Supertest (`server/tests/helpers/{auth,db,data}.helper.ts`)

**Client** (React 19 + Vite + Tailwind 4):
- Komponen hasil refactor UI yang belum di-commit: `components/ui.tsx` (Card, StatCard, DataTable, Field, Notice, EmptyState, Pill, Avatar), `components/layout.tsx` (Sidebar, SearchBox, NotificationMenu, UserMenu), `components/charts.tsx` (SalesTrendChart, RadialGauge, SplitBar), `components/styles.ts`, `lib/format.ts`, `lib/utils.ts` (`cn`), `hooks/use-dismiss.ts`
- `lib/api.ts` (axios + bearer) dan `lib/auth-storage.ts`
- Token warna/tema di `index.css`

Yang perlu dibenahi: `client/src/App.tsx` (1.584 baris, satu file, navigasi pakai `useState`) dipecah menjadi routing + folder fitur.

---

## Ringkasan tahapan

| Tahap | Nama | Modul PRD | Bobot |
| --- | --- | --- | --- |
| 1 | Fondasi v2 | AKN-01 (login), AKN-06, LOG-01 (dasar) | M |
| 2 | Akun & data utama | AKN-01…06 | M |
| 3 | Jadwal & absen SPG | JDW-01/02, ABS-01, ABS-04 | L |
| 4 | Kunjungan Team Leader & lokasi live | ABS-02/03, KNJ-01/02 | M |
| 5 | Stok gudang & order | STK-01, ORD-01…05 | L |
| 6 | Laporan penjualan, persetujuan kasir, retur | JUL-01/03/04/05, RTR-01…04 | L |
| 7 | Stock opname, serah terima, status gajian | SO-01…05 | L |
| 8 | Cuti/izin & MOU apotek | CTI-01…04, MOU-01…03 | M |
| 9 | Dashboard lengkap, notifikasi, rekap, PWA, hardening, uji coba | DSB-01, NTF-01, BR-21, LOG-01 | L |
| 10 | Aplikasi mobile (Android & iOS) | Semua layar mobile di PRD | XL |

Urutan ini mengikuti ketergantungan data: master data → absen (hanya butuh apotek & penempatan) → stok (order mengisi stok SPG) → penjualan/retur (mengurangi stok) → stock opname (mencocokkan stok) → cuti/MOU → konsolidasi.

---

## Aturan yang berlaku di setiap tahap

1. **Backend**: modul baru mengikuti pola `modules/sales`. Setiap route memakai `authenticate` + `authorize(...)` + `validateBody(zod)`.
2. **Transaksi + riwayat**: setiap aksi yang mengubah data berjalan di `prisma.$transaction`, dan `recordAudit(tx, …)` dipanggil di transaksi yang sama (LOG-01). Data yang sudah disetujui tidak pernah di-delete, hanya dikoreksi (AB-14).
3. **Batas akses**: semua query list/get difilter lewat `scopeFor(actor)`: SPG → datanya sendiri, TL → timnya, Kasir → apoteknya, Admin/SA → semua (AKN-06, dicek di server).
4. **Waktu**: semua jam memakai jam server. "Tanggal bisnis" dihitung di zona `Asia/Jakarta` (WIB).
5. **Stok**: perubahan stok ditulis sebagai ledger/mutasi, dengan guard kondisional (`updateMany … where qty >= n`) supaya stok tidak pernah minus saat ada request bersamaan.
6. **Notifikasi & dashboard**: setiap tahap langsung menambah notifikasi in-app dan widget dashboard untuk fiturnya. Tahap 9 tinggal merapikan.
7. **Selesai tahap** = migrasi + seed diperbarui, test integrasi baru hijau, `npm run build` server & client lolos, layar dicek di lebar 375 px dan 1280 px, bagian checklist UAT v2 ditambah, lalu deploy ke staging (Vercel + Neon).
8. **Git**: satu branch per tahap (`v2/tahap-N-…`), di-merge ke `main` setelah tahap lolos.

---

## Tahap 1 — Fondasi v2

**Tujuan:** kerangka v2 berdiri. Kelima peran bisa login dengan nomor HP, tampilan responsive sudah siap, dan riwayat serta upload berkas sudah berfungsi.

**Persiapan**
- Commit refactor UI yang sedang berjalan (components/*, lib/format.ts, dsb.) dan dokumen v2 sebagai titik awal.

**Backend**
- Hapus modul v1: `deposits`, `finance`, `purchase-requests`, `sales`, `inventory`, `products`, `dashboard` (dibangun ulang di tahap berikutnya), beserta test v1-nya.
- Reset migrasi Prisma menjadi baseline `v2_init`. DB lokal dan staging Neon di-reset karena data v1 tidak dipakai lagi.
- Model awal: `User` (name, **phone unik**, role, status, `mustChangePassword`), `RefreshToken`, `Notification`, `AuditLog` (actorId, action, entity, entityId, `before`/`after` Json, evidenceKeys, createdAt), dan `Setting`.
- Enum `UserRole`: `SUPER_ADMIN, ADMIN, TEAM_LEADER, SPG, KASIR`.
- Trigger SQL di migrasi yang menolak `UPDATE`/`DELETE` pada tabel audit log, supaya riwayat tidak bisa diubah (LOG-01).
- Auth: login `{phone, password}` dengan normalisasi nomor (08xx → 628xx). Endpoint `POST /auth/change-password`. Middleware yang memblokir endpoint lain selama `mustChangePassword` masih aktif. Sesi berakhir bila tidak aktif (env `SESSION_IDLE_MINUTES`, dicek di refresh). Rate limit login (`express-rate-limit`) dan `helmet`.
- Util baru: `utils/audit.ts` (`recordAudit`), `utils/time.ts` (helper WIB via `date-fns-tz`), `utils/scope.ts` (`scopeFor`), `utils/storage.ts` (adapter S3 via `@aws-sdk/client-s3` dan presigner).
- Modul `files`: `POST /files/presign` (purpose, mime, size) untuk URL upload langsung ke R2, dan `GET /files/:id` untuk URL baca yang aksesnya dicek. Upload langsung dari browser dipakai karena batas body fungsi Vercel 4,5 MB.
- `docker-compose.yml`: tambah service MinIO. Env baru: `S3_ENDPOINT`, `S3_BUCKET`, `S3_ACCESS_KEY`, `S3_SECRET_KEY`, `SESSION_IDLE_MINUTES` (di `config/env.ts` dan `.env*.example`).
- Seed: satu akun per peran dengan nomor HP dummy, dicatat di seed dan README.

**Frontend**
- Struktur: `src/app/` (providers, router), `src/routes/` (konfigurasi menu & route per peran), `src/features/<modul>/` (halaman + hook API), `src/components/` (bersama).
- Pasang `@tanstack/react-query`, `react-hook-form` + `zod`. `react-router-dom` sudah terpasang.
- `lib/api.ts`: interceptor refresh token otomatis, redirect ke login saat 401, dan logout otomatis bila idle.
- `AppShell` responsive: Sidebar di desktop (≥1024 px), bottom nav + drawer di HP. Menu dibentuk dari konfigurasi per peran, dengan `RoleGuard`.
- Helper `uploadFile()`: kompres gambar di browser (`browser-image-compression`, target ±200 KB), presign, lalu PUT.
- Halaman: Login (nomor HP), Ganti kata sandi pertama, Profil, Notifikasi, dan kerangka dashboard per peran.

**Selesai jika:** kelima peran bisa login, ganti sandi pertama wajib, sesi idle berakhir, login dan ganti sandi tercatat di riwayat, upload foto uji ke MinIO berhasil, dan shell rapi di 375 px maupun 1280 px.

---

## Tahap 2 — Akun & data utama (Super Admin, web)

**Model:** `Pharmacy` (name, address, phone, lat, lng, `radiusM` default 20, openTime, closeTime, is24h, status `PROSPECT/ACTIVE/INACTIVE`, `kasirUserId` unik), `Team` (leaderId unik) dengan `User.teamId` untuk SPG, `Placement` (spgId, pharmacyId, startedAt, endedAt, status), `Product` (code unik, name, unit, price, isActive), `SalesTarget` (spgId, month `YYYY-MM`, amount, unik), dan `Setting` (jatah cuti TL = 15, `DeductionRate` amount + effectiveFrom).

**Backend**
- `users`: buat akun (hanya SA, BR-01), ubah, nonaktifkan (data tetap ada), reset sandi.
- `pharmacies`: CRUD. **Akun Kasir dibuat otomatis** di transaksi yang sama (login memakai nomor HP apotek).
- `teams` dan `placements`: maksimal 3 penempatan aktif per SPG, dicek di dalam transaksi. Penempatan ke-4 ditolak dengan pesan jelas. SPG hanya boleh ada di 1 tim. Perubahan penempatan tercatat di riwayat.
- `products`, `targets` (per SPG per bulan, bisa bulk), dan `settings`.
- `audit-logs`: `GET` dengan filter entity/user/tanggal (hanya SA).

**Frontend (SA):** Pengguna & penempatan, Apotek (form dengan **peta Leaflet + OpenStreetMap** untuk memilih titik dan pratinjau lingkaran radius), Produk & target, Pengaturan (jatah cuti, potongan per hari), dan Riwayat.

**Selesai jika:** BR-01…04 dan AKN-01…06 lolos test, termasuk test 403 untuk akses lintas peran dan lintas data.

---

## Tahap 3 — Jadwal & absen SPG

**Model:** `Schedule` (spgId, pharmacyId, date, startTime, endTime, isOff; unik spg+apotek+tanggal), `Attendance` (userId, pharmacyId, kind `CHECK_IN/CHECK_OUT`, serverAt, businessDate, photoFileId, lat, lng, accuracyM, distanceM, faceCheck Json, source `WEB/APP`), `AttendanceNote` (catatan Admin untuk status telat atau tidak masuk), dan `AttendanceException` (pengajuan pengecualian saat GPS dalam gedung gagal, disetujui Admin, sesuai mitigasi risiko di BRD).

**Backend**
- `schedules`: simpan grid mingguan, **salin minggu lalu**, dan jadwal minggu ini/depan untuk SPG serta seluruh tim untuk TL. Setiap perubahan tercatat.
- `attendance`: check-in/out dengan validasi berikut:
  - Apotek harus apotek tugas SPG (AB-03).
  - Jarak dihitung haversine di server dan harus ≤ radius. Bila lebih, jarak dikembalikan dalam respons.
  - Akurasi GPS dicatat, dengan ambang yang bisa diatur.
  - Waktu memakai jam server WIB.
  - Absen pulang hanya boleh setelah absen masuk di hari yang sama.
- `GET /attendance/monitor?date=`: status per SPG yang dijadwalkan (tepat waktu / telat n menit / tidak masuk / libur), dihitung saat dibaca sehingga tidak butuh job. Admin bisa mengisi catatan. Tidak ada potongan otomatis (AB-04).

**Frontend**
- Komponen **`CameraCapture`**:
  - `getUserMedia` dengan pratinjau live saja; tidak ada `<input type=file>` atau galeri.
  - Frame diambil ke canvas, lalu dikompres.
  - **Deteksi wajah + tantangan kedip** memakai `@mediapipe/tasks-vision` (FaceLandmarker) di browser. Gagal berarti ulang. Hasilnya dikirim sebagai metadata `faceCheck`.
- Hook `useGeolocation`: high accuracy, menampilkan jarak ke apotek sebelum kirim. Server tetap penentu akhir.
- SPG (mobile-first): Absen dan Jadwal saya. TL: Jadwal tim.
- Admin: Jadwal mingguan (grid SPG × hari), Pemantauan absen (dengan foto dan titik lokasi), dan Pengecualian absen.

**Selesai jika:** kriteria ABS-01, ABS-04, JDW-01, dan JDW-02 lolos. Absen di luar 20 m ditolak dengan menampilkan jaraknya.

---

## Tahap 4 — Kunjungan Team Leader & lokasi live

**Model:** `LeaderVisit` (leaderId, pharmacyId, checkIn/checkOut attendance, durationMin), `LocationPing` (userId, lat, lng, accuracy, recordedAt; index userId+waktu), `VisitPlan` (leaderId, weekStart, lockedAt), dan `VisitPlanItem` (date, pharmacyId, missReason, evidenceFileId).

**Backend**
- Absen kunjungan memakai ulang validasi Tahap 3 untuk semua apotek aktif. TL tidak bisa check-in di apotek baru sebelum check-out dari apotek sebelumnya. Durasi kunjungan dihitung otomatis.
- `POST /locations/ping` hanya diterima selama sesi kerja, yaitu sejak check-in pertama hari itu sampai TL menekan "Selesai hari ini" atau batas jam kerja yang diatur. Endpoint jejak harian dan posisi terakhir untuk SA/Admin.
- Rencana kunjungan: CRUD per minggu, terkunci mulai Senin 00:00 WIB. Perubahan setelah terkunci tetap boleh tetapi tercatat dengan penanda.
- Evaluasi: per hari menampilkan apotek rencana vs yang dikunjungi beserta durasinya. Apotek yang tidak dikunjungi wajib diberi alasan, bukti opsional.

**Frontend**
- TL: Absen kunjungan dan Rencana kunjungan.
- Tracking foreground memakai `watchPosition` dengan ping tiap 5 menit selama halaman terbuka, plus Wake Lock API dan banner "biarkan aplikasi terbuka". Ini batasan web yang sudah disepakati.
- SA/Admin: **Peta leader** (marker posisi terakhir + polyline jejak harian, Leaflet) dan Evaluasi kunjungan.

---

## Tahap 5 — Stok gudang & order

**Model**
- `WarehouseStock` (productId, qty) dan `WarehouseMovement` (type `INBOUND/ORDER_SHIPPED/RETURN_RECEIVED/ADJUSTMENT`, qty, balanceAfter, poNumber, ref).
- **`FieldStock`** (holderId, pharmacyId, productId, qty) dan **`FieldStockMovement`** (type `OPENING/ORDER_RECEIVED/SALE_APPROVED/RETURN_RECEIVED/CORRECTION/HANDOVER_OUT/HANDOVER_IN`, qty, balanceAfter, ref). Ledger ini menerapkan rumus AB-05. `holderId` bisa SPG atau TL untuk mendukung serah terima di AB-15.
- `Order` (no, spgId, pharmacyId, status `SUBMITTED/APPROVED/SHIPPED/RECEIVED/REJECTED`, rejectReason, hasDiscrepancy) dan `OrderItem` (requestedQty, approvedQty, shippedQty, receivedQty, `unfulfilledAtSubmit`).
- **`Approval`** generik (entityType, entityId, step, decision, reason, approverId, cashierName, cashierPhotoFileId, decidedAt). Dipakai ulang oleh penjualan, retur, cuti, dan MOU.

**Backend**
- `warehouse`: barang masuk (dengan nomor PO opsional), riwayat mutasi, dan penyesuaian beralasan.
- `orders`:
  - Ajukan (SPG): item dengan stok pusat 0 tetap tercatat sebagai **permintaan belum terpenuhi**.
  - Setujui/tolak (SA): jumlah disetujui ≤ jumlah diminta, alasan wajib bila ditolak.
  - Kirim (Admin): stok pusat berkurang, tidak bisa melebihi stok.
  - Terima (SPG): jumlah aktual dicatat, `FieldStock` bertambah, selisih ditandai dan Admin dinotifikasi.
- `GET /orders/unfulfilled-recap` per produk (ORD-05).
- **Input stok awal** per SPG per apotek oleh Admin saat go-live (ber-riwayat).
- Guard sementara: penempatan tidak bisa dilepas bila masih ada `FieldStock` > 0. Alur penuhnya dibuat di Tahap 7.

**Frontend**
- SPG: Stok saya dan Order (form dengan info stok pusat, status, konfirmasi terima).
- SA: halaman **Persetujuan** terpadu, mulai dengan tab Order.
- Admin: Stok pusat, Order masuk, Rekap permintaan, dan Stok awal.

---

## Tahap 6 — Laporan penjualan, persetujuan kasir & retur

**Model:** `SalesReport` (spgId, pharmacyId, reportDate, status `SUBMITTED/APPROVED/REJECTED`, totalAmount, revision; unik spg+apotek+tanggal), `SalesReportItem` (productId, qty, unitPrice snapshot, subtotal), `Return` (status `SUBMITTED/KASIR_APPROVED/SA_APPROVED/RECEIVED/REJECTED`, reason, photoFileId, hasDiscrepancy), dan `ReturnItem` (qty, receivedQty).

**Backend**
- Stok tersedia = `FieldStock.qty` − qty laporan dan retur yang masih menunggu. Dicek saat kirim **dan dicek ulang saat disetujui kasir** di dalam transaksi (BR-14).
- Satu laporan per SPG per apotek per hari. Bila ditolak, SPG memperbaiki laporan yang sama lalu mengirim ulang (revision++, histori tersimpan di `Approval`).
- Kasir setuju: nama dan ID foto wajib. Kasir tolak: nama, foto, dan alasan wajib (AB-07). Kasir hanya melihat apoteknya sendiri.
- Saat disetujui: `SALE_APPROVED` mengurangi stok dan omzet dihitung. Setelah itu laporan tidak bisa diubah atau dihapus (AB-06).
- `GET /sales-reports/pending?olderThanDays=1` untuk Admin (JUL-05).
- Retur: SPG ajukan → Kasir → SA → Admin terima. Barang selalu ke gudang pusat (AB-08).
- Endpoint omzet vs target per SPG, per periode.

**Frontend**
- SPG: Laporan penjualan (validasi stok langsung, perbaiki bila ditolak) dan Retur.
- **Kasir** (mobile/web): Menunggu persetujuan, Detail (setuju/tolak + nama + foto via `CameraCapture`), dan Riwayat.
- SA: tab Retur di halaman Persetujuan.
- Admin: Laporan tertunda dan Retur masuk.

> **Asumsi, perlu dikonfirmasi ke Kak Tutut:** bila jumlah retur yang diterima gudang berbeda, stok SPG dikurangi sejumlah yang disetujui kasir, stok pusat ditambah sejumlah yang benar-benar diterima, dan selisihnya ditandai untuk ditelusuri SA.

---

## Tahap 7 — Stock opname, serah terima & status gajian

**Model:** `StockOpnamePeriod` (month, cutoff tgl 25, deadline tgl 30, status `OPEN/CLOSED`), `StockOpnameSheet` (type `MONTHLY/HANDOVER`, holderId, pharmacyId, status, spgPresent, rescheduledTo ≤ tgl 30, evidenceFileIds), `StockOpnameItem` (systemQty, physicalQty, diff, correctionReason), dan `Handover` (fromSpgId, toUserId SPG baru/TL, reason `MOVE/REPLACE/RESIGN`, liabilityAmount, settledAt).

**Backend**
- Admin membuka periode (SO-01): sistem membuat lembar per pasangan SPG–apotek. Notifikasi dikirim ke Admin dan SPG.
- Hitung fisik (SO-02): isi qty fisik, foto bukti, dan tanda SPG hadir. Bila SPG tidak hadir, jadwalkan ulang paling lambat tanggal 30. Selisih = fisik − sistem.
- Koreksi (SO-03): hanya Admin, alasan wajib. Dicatat sebagai movement `CORRECTION` sehingga otomatis menjadi stok awal bulan berikutnya. Koreksi tampil di dashboard SA.
- Hasil untuk SPG (SO-04): total order, penjualan disetujui, retur, sisa stok, selisih, dan omzet final. Status gajian **"Siap dibayar tgl 5"** bila periode sudah ditutup tanpa selisih yang belum diselesaikan.
- Serah terima (SO-05):
  - Hitung stok bersama SPG lama. Selisih menjadi tanggungan SPG lama.
  - Sisa stok dipindahkan (`HANDOVER_OUT/IN`) ke SPG pengganti, atau ke TL bila belum ada pengganti.
  - Penempatan lama dilepas. Akun dinonaktifkan bila resign. Omzet SPG lama dihitung sampai tanggal serah terima.
  - Guard dari Tahap 5 diganti: pelepasan penempatan hanya lewat alur ini.

**Frontend**
- Admin: Stock opname (buka/tutup periode, lembar hitung, koreksi) dan wizard Serah terima.
- SA: ringkasan selisih dan pelunasan tanggungan.
- SPG: Hasil stock opname & status gajian.

> **Asumsi, perlu dikonfirmasi:** stok sistem di lembar SO adalah saldo pada saat penghitungan, sehingga penjualan tanggal 25 sampai hari hitung tetap terhitung. Periode omzet gajian = tanggal 26 bulan lalu s/d tanggal 25 bulan ini.

---

## Tahap 8 — Cuti/izin & MOU apotek baru

**Model:** `LeaveRequest` (type `CUTI/SAKIT`, startDate, endDate, days, reason, doctorNoteFileId, status, overQuotaDays, deductionRate snapshot, deductionAmount), `MouTemplate` (version, statements[], active), dan `Mou` (data calon apotek, lat/lng diambil di lokasi, snapshot pernyataan, signerName, signatureFileId, signerPhotoFileId, pdfFileId, physicalScanFileId, stampType `NONE/PHYSICAL/EMETERAI`, status, rejectReason).

**Backend**
- Cuti:
  - Izin sakit wajib melampirkan surat dokter.
  - Sisa jatah TL = 15 − (cuti + sakit yang disetujui tahun berjalan).
  - Potongan = hari di luar jatah × tarif yang berlaku saat disetujui (disimpan sebagai snapshot, AKN-05).
  - Rekap potongan per TL per bulan.
  - Cuti yang disetujui tampil di jadwal, dan status "tidak masuk" di monitor Tahap 3 diubah menjadi "Cuti/Izin" (CTI-04).
- MOU:
  - TL membuat MOU dari templat aktif.
  - TTD di layar (`signature_pad`) + foto penanda tangan.
  - **PDF dibuat di server** (`pdf-lib`) lalu disimpan di R2 dan bisa diunduh. Alternatifnya, unggah scan MOU fisik bermeterai.
  - SA setuju → `Pharmacy` menjadi ACTIVE dengan radius 20 m dan akun Kasir dibuat (memakai ulang service Tahap 2). SA tolak → MOU kembali ke TL dengan alasan.

**Frontend**
- SPG/TL: Cuti/izin (TL melihat sisa jatah).
- TL: MOU apotek baru.
- SA: tab Cuti & MOU di Persetujuan, Pengaturan templat MOU, dan Rekap potongan.

> **Asumsi, perlu dikonfirmasi:** hari cuti dihitung per hari kalender, inklusif.

---

## Tahap 9 — Dashboard lengkap, notifikasi, rekap, PWA, hardening & uji coba

- **DSB-01**: rapikan dashboard kelima peran sesuai tabel PRD. Contoh untuk SA: omzet vs target harian/mingguan/bulanan, persetujuan menunggu, selisih stok, keterlambatan, potongan cuti TL, dan peta leader. Pakai ulang `components/charts.tsx` dan `StatCard`.
- **NTF-01**:
  - Pusat notifikasi in-app.
  - **PWA** (`vite-plugin-pwa`: manifest, service worker) + **Web Push** (`web-push`, VAPID, model `PushSubscription`). Di iOS, Web Push hanya jalan bila PWA dipasang ke Home Screen (iOS 16.4+).
  - Semua kejadian di tabel NTF-01 terpasang.
- **Job terjadwal**:
  - Endpoint `/api/jobs/*` dengan header `CRON_SECRET`.
  - Isinya: SPG belum absen 30 menit setelah jadwal (tiap 10–15 menit), laporan tertunda > 1 hari (harian), pengingat SO tanggal 25.
  - Pemicunya Vercel Cron (paket Hobby hanya harian, jadi butuh Pro) atau cron eksternal (cron-job.org / GitHub Actions).
- **BR-21 Rekap**: keterlambatan, selisih stok, dan order tidak terpenuhi per bulan, dengan ekspor Excel (`exceljs`).
- **LOG-01**: tampilan riwayat final dengan diff sebelum/sesudah dan bukti foto.
- **Hardening NFR**:
  - Absen < 5 detik di 4G (kompres ±200 KB, upload langsung ke R2).
  - Uji di Android kelas bawah (Chrome).
  - Tangani putus koneksi: banner offline, tombol kirim dinonaktifkan, tidak ada data setengah jadi.
  - Backup harian (Neon PITR / `pg_dump` terjadwal) dan retensi foto ≥ 2 tahun di R2.
  - Uji IDOR/akses lintas peran.
  - E2E Playwright untuk satu siklus penuh.
- **Uji coba** sesuai PRD:
  - Buat `docs/UAT_CHECKLIST_v2.md` dan panduan singkat per peran.
  - Pilot di 2–3 apotek dengan 1 tim selama 1 periode SO, lalu perbaikan, lalu rollout ke semua apotek.

**Tahap web dianggap selesai** bila kriteria "Tahap awal dianggap selesai" di PRD terpenuhi: modul 1–10 kecuali JUL-02, radius 20 m sudah diuji di dalam gedung, dan satu siklus order → penjualan → retur → SO → status gajian berjalan tanpa WhatsApp atau Excel.

---

## Tahap 10 — Aplikasi mobile (setelah web selesai)

Backend yang sama. Admin tetap memakai web. SPG, TL, dan Kasir pindah ke app. SA memakai web + app.

- **M0 — Persiapan**:
  - Monorepo npm workspaces dengan `packages/shared` (enum, skema Zod, tipe API) yang dipakai server, web, dan mobile.
  - `mobile/` memakai Expo (React Native, TypeScript, Expo Router) dan EAS Build.
  - Endpoint `POST /devices` untuk registrasi push token.
  - Absen menerima `source: APP` + sinyal anti-fraud.
- **M1 — SPG**:
  - Login, Beranda, Absen, Jadwal, Stok, Order, Laporan penjualan, Retur, Cuti, Riwayat, Profil.
  - Absen memakai `expo-camera` (live saja) dengan deteksi wajah/liveness on-device.
  - Lokasi memakai `expo-location` dan **menolak lokasi palsu**: flag `mocked` di Android, `isSimulatedBySoftware` di iOS 15+ lewat config plugin.
- **M2 — Team Leader**:
  - Absen kunjungan.
  - **Lokasi live di latar belakang** (`expo-location` + `expo-task-manager`, foreground service Android, izin "Always" iOS), hanya selama sesi kerja.
  - Rencana kunjungan, Detail SPG, MOU (TTD via `react-native-signature-canvas`), Cuti.
- **M3 — Kasir & Super Admin**:
  - Persetujuan dengan kamera, dashboard, dan peta leader.
  - **Push notification native** (`expo-notifications` → FCM/APNs).
- **M4 — Rilis**:
  - Uji di HP Android kelas bawah.
  - Build internal testing Play Store dan TestFlight (dibuild di Mac ini).
  - Teks izin kamera/lokasi dan kebijakan privasi.
  - Rollout ke SPG/TL. Setelah itu, flag konfigurasi server mewajibkan absen SPG/TL lewat app.

---

## Backlog (di luar tahap awal)

- JUL-02: input laporan dari foto nota (OCR/vision).
- Integrasi API e-meterai (distributor resmi Peruri).
- Liveness pasif dari vendor.
- Notifikasi WhatsApp.
- Hal yang di BRD dinyatakan di luar lingkup: penagihan/faktur, peran Kurir, penggajian lengkap, integrasi Accurate, persetujuan berjenjang.

---

## File penting

- Server:
  - `server/prisma/schema.prisma` (ditulis ulang), `server/prisma/migrations/*` (baseline baru), `server/prisma/seed.ts`
  - `server/src/routes/index.ts`, `server/src/config/env.ts`, `server/src/middleware/authorize.ts`
  - `server/src/modules/auth/*`, `server/src/modules/users/*`, `server/src/modules/<modul-baru>/*`
  - `server/src/utils/{audit,time,scope,storage}.ts` (baru)
  - `server/tests/helpers/*`, `server/tests/integration/*`
- Client:
  - `client/src/App.tsx` (dipecah), `client/src/app/*`, `client/src/routes/*`, `client/src/features/*`
  - `client/src/components/{camera-capture,map-picker,signature-pad}.tsx` (baru)
  - `client/src/lib/api.ts`, `client/src/types/*` (diganti tipe v2)
- Infra & docs:
  - `docker-compose.yml` (+MinIO), `.env*.example`, `vercel.json` (cron), `README.md`, `docs/UAT_CHECKLIST_v2.md`
- Mobile (Tahap 10): `mobile/*`, `packages/shared/*`

## Verifikasi (tiap tahap)

1. `docker compose up -d` untuk menyalakan Postgres + MinIO.
2. Server: `npx prisma migrate dev`, `npm run db:seed`, `npm test` (test integrasi modul tahap itu, termasuk kasus tolak dan 403), lalu `npm run build`.
3. Client: `npm run lint` dan `npm run build`.
4. Jalankan `preview_start` untuk `server` dan `client` (sudah ada di `.claude/launch.json`). Uji alur tiap peran di browser pada viewport 1280 px dan **375 px**, dan cek console serta network tidak ada error.
5. Fitur kamera dan lokasi (Tahap 3, 4, 6, 8):
   - Uji di HP sungguhan lewat HTTPS (staging Vercel).
   - Untuk otomatisasi: Playwright dengan `geolocation` palsu dan `--use-fake-device-for-media-stream`.
   - Uji di dalam gedung apotek untuk validasi radius 20 m.
6. Deploy ke staging (Vercel + Neon + R2), lalu jalankan bagian checklist UAT v2 untuk tahap tersebut.
