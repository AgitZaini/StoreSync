# Checklist UAT StoreSync v2

Checklist ini bertambah setiap tahap selesai. Jalankan di staging (HTTPS) dari laptop dan dari HP.

## Prasyarat

- Migrasi Prisma sudah dijalankan dan health check `GET /api/health` mengembalikan `status: ok`.
- Seed akun demo tersedia (lihat README), atau Super Admin pertama dibuat lewat `SEED_SUPER_ADMIN_*`.
- Penyimpanan berkas (R2 di staging, MinIO di lokal) sudah dikonfigurasi, termasuk CORS bucket.

## Tahap 1 — Fondasi v2

### Login dan sesi (AKN-01)

- [ ] Login dengan nomor HP format `0812…`, `+62 812…`, dan `62812…` untuk akun yang sama berhasil.
- [ ] Nomor HP atau kata sandi salah menampilkan "Nomor HP atau kata sandi salah".
- [ ] Akun nonaktif tidak bisa login dan menampilkan pesan untuk menghubungi Super Admin.
- [ ] Login SPG baru (`0812-0000-0006`) langsung diarahkan ke halaman "Buat kata sandi baru".
- [ ] Selama belum ganti sandi, membuka `/profil` atau `/` tetap diarahkan ke halaman ganti sandi, juga setelah reload.
- [ ] Sandi baru yang kurang dari 8 karakter, tanpa huruf, tanpa angka, sama dengan sandi lama, atau konfirmasinya berbeda ditolak dengan pesan jelas.
- [ ] Setelah ganti sandi, pengguna masuk ke Beranda; sandi lama tidak bisa dipakai lagi.
- [ ] Ganti sandi dari halaman Profil mengeluarkan sesi di perangkat lain.
- [ ] Tidak ada aktivitas selama 30 menit → pengguna keluar otomatis dengan pesan "Sesi berakhir karena tidak ada aktivitas".
- [ ] Tombol Keluar (sidebar, menu akun, Profil) mengakhiri sesi; tombol Back browser tidak membuka halaman aplikasi lagi.

### Menu per peran dan tampilan

- [ ] Kelima peran bisa login dan melihat Beranda dengan sapaan, peran, dan tanggal.
- [ ] Menu tiap peran sesuai "Daftar layar" PRD; menu yang belum dibangun tampil redup dengan label "Segera".
- [ ] Laptop (≥ 1024 px): sidebar bisa diciutkan; pencarian menu (⌘K / Ctrl K) berfungsi.
- [ ] HP (375 px): navigasi bawah tampil, tombol "Menu" membuka menu lengkap, tidak ada scroll horizontal.
- [ ] Profil menampilkan nama, nomor HP, peran, dan login terakhir dalam WIB.

### Notifikasi

- [ ] Ikon lonceng menampilkan titik merah bila ada notifikasi belum dibaca.
- [ ] Klik notifikasi menandainya dibaca dan membuka halaman terkait bila ada.
- [ ] "Tandai semua dibaca" dan halaman "Lihat semua notifikasi" berfungsi.

### Riwayat dan berkas (LOG-01, untuk tim teknis)

- [ ] Setiap login dan ganti sandi tercatat di tabel `AuditLog` (pelaku, peran, waktu, IP, nilai sebelum/sesudah).
- [ ] `UPDATE` atau `DELETE` pada `AuditLog` ditolak database.
- [ ] Upload foto uji lewat `/api/files/presign` → PUT ke URL → `/complete` berhasil, dan berkas bisa diunduh lewat `GET /api/files/:id`.
- [ ] SPG lain tidak bisa membuka berkas milik SPG lain (404).
