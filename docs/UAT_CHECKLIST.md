# StoreSync UAT Checklist

Gunakan checklist ini sebelum aplikasi dipromosikan ke environment produksi.

## Prasyarat

- Database PostgreSQL aktif dan migrasi sudah berjalan.
- Seed akun development tersedia untuk Pemilik, Supervisor, dan Sales.
- Backend health check mengembalikan `status: ok`.
- Frontend bisa dibuka dari browser target.

## Akun UAT

| Role | Email | Password |
| --- | --- | --- |
| Pemilik | `owner@storesync.local` | `Password123!` |
| Supervisor | `supervisor@storesync.local` | `Password123!` |
| Sales | `sales@storesync.local` | `Password123!` |

## Skenario Pemilik

- Login sebagai Pemilik dan pastikan menu yang terlihat: Dashboard, Approval SPP, Keuangan, Pengguna.
- Buka Dashboard dan validasi KPI pendapatan, laba kotor, kas, dan SPP menunggu muncul.
- Buka Approval SPP dan pastikan daftar SPP tampil.
- Approve satu SPP yang menunggu approval.
- Reject atau minta revisi SPP lain bila tersedia.
- Buka Keuangan dan pastikan breakdown pemasukan, pengeluaran, laba, dan kas tampil.
- Buka Pengguna dan pastikan daftar user serta ringkasan akses role tampil.
- Logout dan pastikan kembali ke halaman login.

## Skenario Supervisor

- Login sebagai Supervisor dan pastikan menu yang terlihat: Dashboard, Penjualan, Stok, SPP, Deposit.
- Buka Stok dan tambah kategori produk.
- Tambah produk baru dengan SKU unik.
- Adjust stok produk dan pastikan stok berubah.
- Buka SPP dan buat pengajuan pembelian stok.
- Buka Deposit dan catat deposit kas.
- Buka Dashboard dan pastikan ringkasan operasional termuat.
- Logout.

## Skenario Sales

- Login sebagai Sales dan pastikan menu yang terlihat: Dashboard, Input Penjualan, Stok, Riwayat.
- Buka Stok dan pastikan daftar produk dapat dilihat tanpa tombol kelola produk.
- Buka Input Penjualan dan catat transaksi baru.
- Pastikan stok produk berkurang setelah transaksi.
- Buka Riwayat dan pastikan transaksi milik Sales terlihat.
- Pastikan Sales tidak dapat melihat menu Approval SPP, Keuangan, atau Pengguna.
- Logout.

## Skenario RBAC Negatif

- Sales tidak boleh mengakses endpoint user management.
- Sales tidak boleh membuat produk atau adjust stok.
- Sales tidak boleh membuka daftar SPP.
- Supervisor tidak boleh approve, reject, atau request revisi SPP.
- Token yang tidak valid harus mendapat respons unauthorized.

## Kriteria Lulus

- Semua role dapat login dan logout.
- Menu dan aksi sesuai role PRD.
- Data utama tersimpan dan muncul ulang setelah refresh.
- Tidak ada error JavaScript di browser console untuk alur utama.
- Backend test suite lulus.
- Client dan server build lulus.
