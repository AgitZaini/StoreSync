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

## Tahap 2 — Akun & data utama

Login sebagai Super Admin kecuali disebutkan lain.

### Pengguna dan tim (AKN-01, BR-01, BR-04)

- [ ] Tambah pengguna (Super Admin, Admin, Team Leader, SPG): muncul ringkasan nomor HP + sandi sementara; pengguna itu wajib ganti sandi saat login pertama.
- [ ] Peran Kasir tidak tersedia di form pengguna (kasir dibuat dari menu Apotek).
- [ ] Nomor HP yang sudah dipakai ditolak dengan pesan jelas.
- [ ] Ubah nama/nomor HP/peran berhasil; mengganti peran membuat pengguna itu harus login ulang.
- [ ] Reset sandi menghasilkan sandi sementara baru dan mengeluarkan pengguna dari semua perangkat.
- [ ] Menonaktifkan SPG yang masih punya penempatan, atau Team Leader yang masih memimpin tim, ditolak dengan pesan jelas.
- [ ] Buat tim dengan satu Team Leader; Team Leader yang sudah memimpin tim tidak bisa dipilih untuk tim lain.
- [ ] Masukkan SPG ke tim dari halaman detail SPG; pindah tim mengirim notifikasi ke leader lama dan baru.
- [ ] Menu Pengguna, Apotek, Produk & Target, Riwayat, dan Pengaturan hanya muncul untuk Super Admin.

### Apotek (AKN-03, BR-03)

- [ ] Daftarkan apotek: pilih titik di peta (klik, geser penanda, "Lokasi saya", atau tempel koordinat), lingkaran radius 20 m tampil.
- [ ] Setelah disimpan muncul akun kasir (nomor HP + sandi sementara); kasir bisa login dan wajib ganti sandi.
- [ ] Titik di luar Indonesia, radius < 10 m, atau jam buka kosong (bukan 24 jam) ditolak.
- [ ] Mengubah nama/nomor HP kasir di form apotek ikut mengubah akun kasirnya.
- [ ] Menonaktifkan apotek yang masih ada SPG ditolak; apotek kosong bisa dinonaktifkan dan akun kasirnya tidak bisa login.
- [ ] Riwayat perubahan apotek tampil di halaman apotek.

### Penempatan SPG (AKN-02)

- [ ] Tempatkan SPG di apotek aktif dari halaman detail SPG; SPG menerima notifikasi "Penempatan baru".
- [ ] Setelah 3 apotek aktif, tombol Tambah nonaktif dan penempatan ke-4 ditolak.
- [ ] Lepas penempatan wajib dengan alasan; penempatan lama tetap tampil di "Riwayat penempatan".

### Produk, target, pengaturan (AKN-04, AKN-05)

- [ ] Tambah/ubah produk (kode, nama, satuan, harga); kode ganda ditolak; produk nonaktif tidak terlihat oleh SPG.
- [ ] Target omzet per SPG per bulan bisa diisi, disalin dari bulan lalu, dan disimpan; total terhitung.
- [ ] Jatah cuti Team Leader bawaan 15 hari dan bisa diubah.
- [ ] Menetapkan tarif potongan baru menambah riwayat tarif; tarif lama tidak berubah.

### Batas akses dan beranda (AKN-06, DSB-01 awal)

- [ ] SPG: Beranda menampilkan target bulan ini dan hanya apotek tugasnya.
- [ ] Team Leader: Beranda menampilkan timnya beserta apotek setiap SPG.
- [ ] Kasir: Beranda menampilkan apoteknya sendiri.
- [ ] Super Admin/Admin: Beranda menampilkan jumlah karyawan, apotek, produk, target bulan ini, dan SPG yang belum ditempatkan/belum punya tim.
- [ ] Membuka alamat halaman Super Admin (mis. `/pengguna`) sebagai peran lain menampilkan "Halaman tidak ditemukan".

### Riwayat (LOG-01)

- [ ] Menu Riwayat menampilkan semua perubahan di atas beserta pelaku, waktu (WIB), dan nilai sebelum → sesudah; bisa difilter per jenis data dan tanggal.

## Tahap 3 — Jadwal & absen SPG

Uji absen dari HP sungguhan lewat HTTPS (staging), di dalam dan di luar apotek demo. Kamera dan GPS butuh izin browser.

### Jadwal (JDW-01, JDW-02)

- [ ] Admin: menu Jadwal Mingguan menampilkan setiap pasangan SPG–apotek untuk minggu berjalan (Senin–Minggu).
- [ ] Klik sel → isi jam masuk/pulang, tandai libur, atau kosongkan; "Terapkan juga ke" mengisi beberapa hari sekaligus.
- [ ] Hari saat SPG tidak ditempatkan di apotek itu tidak bisa diisi (sel "—").
- [ ] "Salin minggu lalu" hanya mengisi sel yang masih kosong; "Batalkan" membuang perubahan; "Simpan" menyimpan dan SPG menerima notifikasi "Jadwal diperbarui".
- [ ] Pindah minggu/filter dengan perubahan belum disimpan memunculkan peringatan.
- [ ] SPG: menu Jadwal menampilkan jadwal minggu ini dan minggu depan. Team Leader: menu Tim Saya menampilkan jadwal tim.
- [ ] Setiap perubahan jadwal tercatat di Riwayat.

### Absen SPG (ABS-01, AB-01…AB-03)

- [ ] Menu Absen menampilkan hanya apotek tugas, jadwal hari ini, akurasi GPS, dan jarak ke apotek.
- [ ] Tombol absen membuka kamera depan langsung (tidak ada pilihan galeri); wajah harus satu, cukup dekat, dan berkedip sebelum foto diambil otomatis.
- [ ] Foto tersimpan dengan cap nama, jenis absen, apotek, dan jam WIB.
- [ ] Absen di dalam radius tercatat dengan jam server; di luar radius ditolak dengan jarak ditampilkan.
- [ ] GPS kurang akurat dari batas di Pengaturan ditolak dengan pesan jelas.
- [ ] Absen pulang hanya setelah absen masuk; absen masuk kedua di hari yang sama ditolak; masuk di apotek lain sebelum pulang ditolak.
- [ ] Bila verifikasi wajah tidak bisa berjalan (atau tidak berkedip 30 detik), foto tetap bisa diambil lalu diajukan sebagai pengecualian.
- [ ] Izin kamera/lokasi ditolak menampilkan cara mengizinkannya.

### Pengecualian absen

- [ ] SPG yang ditolak (di luar radius/GPS/wajah) bisa mengajukan pengecualian dengan alasan; Admin menerima notifikasi.
- [ ] Admin: tab Pengecualian menampilkan foto, jarak, akurasi, alasan, dan tautan peta; Setujui mencatat absen dengan jam saat SPG mencoba; Tolak wajib beralasan.
- [ ] SPG menerima notifikasi hasilnya; setelah ditolak SPG bisa absen lagi.

### Pemantauan (ABS-04)

- [ ] Admin: Pemantauan Absen menampilkan ringkasan (terjadwal, tepat waktu, telat, belum absen, tidak masuk, libur, tanpa jadwal) dan status per SPG untuk tanggal terpilih.
- [ ] Telat menampilkan selisih menit; toleransi telat di Pengaturan hanya mengubah label, jam absen tidak berubah.
- [ ] Detail baris menampilkan foto masuk/pulang, jarak, akurasi, dan tautan peta; Admin bisa menambah catatan alasan (tanpa potongan otomatis).
- [ ] Super Admin bisa melihat Pemantauan (lewat Beranda) tetapi tidak bisa menulis catatan atau menyetujui pengecualian.
- [ ] Team Leader hanya melihat absen dan foto SPG timnya.
- [ ] Beranda: Admin/Super Admin/Team Leader melihat kartu "Absen hari ini"; SPG melihat kartu "Hari ini" dengan tombol Buka absen.

## Tahap 4 — Kunjungan Team Leader & lokasi live

Sebelum uji di staging, jalankan `prisma migrate deploy` (migrasi `20261001000000_leader_visits`) lalu seed ulang supaya rencana kunjungan demo tersedia. Uji dari HP sungguhan lewat HTTPS dengan akun Team Leader `0812-0000-0003`.

### Absen kunjungan (ABS-02)

- [ ] Menu Absen Kunjungan menampilkan status sesi kerja, akurasi GPS, apotek rencana hari ini, dan "Apotek lain" (6 terdekat, bisa dicari) — termasuk apotek di luar tim.
- [ ] Absen masuk memakai kamera depan langsung + deteksi wajah/kedip, sama seperti absen SPG; foto bercap nama, "Kunjungan masuk", apotek, dan jam WIB.
- [ ] Bila kedip tidak terdeteksi 30 detik, hanya ada tombol "Coba lagi" (tidak ada pengecualian untuk kunjungan).
- [ ] Di luar radius atau GPS kurang akurat ditolak dengan jarak/akurasi ditampilkan; apotek nonaktif tidak bisa diabsen.
- [ ] Setelah absen masuk, kartu "Sedang berkunjung" tampil; tombol Absen masuk di apotek lain nonaktif dengan pesan "Absen keluar dulu dari …".
- [ ] Absen keluar hanya di apotek yang sedang dikunjungi; lama kunjungan tercatat otomatis dan tampil di "Kunjungan hari ini".
- [ ] Apotek yang sama boleh dikunjungi lagi di hari yang sama (kunjungan baru).

### Sesi kerja & lokasi live (ABS-03)

- [ ] Sebelum absen masuk pertama, sesi "Belum mulai" dan tidak ada banner lokasi live.
- [ ] Setelah absen masuk pertama, banner "Lokasi live aktif · terakhir terkirim …" tampil di semua halaman TL; lokasi terkirim tiap 5 menit selama aplikasi terbuka dan layar dijaga menyala (bila browser mendukung).
- [ ] "Selesai hari ini" hanya bisa setelah absen keluar; sesudahnya banner hilang dan lokasi tidak dikirim lagi. Absen masuk lagi membuka sesi kembali.
- [ ] Lewat batas jam kerja (Pengaturan → Absen → Batas jam kerja Team Leader, bawaan 21:00) lokasi berhenti dikirim walau belum menekan "Selesai hari ini".
- [ ] Izin lokasi ditolak menampilkan banner merah "Lokasi live tidak terkirim".
- [ ] Super Admin/Admin: menu Peta Leader menampilkan setiap TL (status kerja, lokasi terakhir, jumlah & lama kunjungan) dan marker posisi terakhir; memilih TL menampilkan jejak harian (garis) dan apotek yang dikunjungi.
- [ ] Peta hari ini diperbarui tiap menit; tanggal lalu bisa dipilih. Klik kunjungan menampilkan foto masuk/keluar, jarak, akurasi, dan tautan peta.
- [ ] Beranda Super Admin/Admin menampilkan kartu "Team Leader hari ini" (mulai kerja, sedang bekerja, kunjungan, di apotek).

### Rencana kunjungan (KNJ-01)

- [ ] Menu Rencana Kunjungan: pilih minggu, tambah/hapus apotek aktif per hari, "Salin minggu lalu" hanya mengisi hari kosong, "Batalkan" membuang draf, "Simpan" menyimpan hari yang berubah.
- [ ] Minggu depan bebas diubah (belum terkunci); minggu berjalan terkunci sejak Senin 00.00 WIB.
- [ ] Mengubah rencana yang terkunci tetap bisa: apotek tambahan diberi label "Ditambah setelah terkunci", apotek yang dihapus tampil dicoret "dihapus setelah terkunci", dan Super Admin menerima notifikasi "Rencana kunjungan diubah".
- [ ] Hari yang sudah lewat, minggu lalu, dan minggu lebih dari 4 minggu ke depan tidak bisa diubah.
- [ ] Setiap perubahan rencana tercatat di Riwayat.

### Evaluasi kunjungan (KNJ-02)

- [ ] TL: tab Evaluasi menampilkan per hari apotek rencana (Dikunjungi / Tidak dikunjungi / Belum), jam dan lama kunjungan, serta kunjungan di luar rencana.
- [ ] Apotek rencana yang lewat tanpa kunjungan wajib diberi alasan (min. 5 karakter); bukti foto/PDF opsional (mis. surat dokter) bisa dilampirkan, diganti, atau dilepas.
- [ ] Beranda dan Absen Kunjungan TL mengingatkan jumlah apotek yang belum diberi alasan, dengan tautan ke minggu yang tepat.
- [ ] Super Admin/Admin: menu Evaluasi Kunjungan menampilkan ringkasan semua TL per minggu (rencana, dikunjungi, tidak dikunjungi, tanpa alasan, di luar rencana, total durasi) dan rincian per hari untuk TL yang dipilih, termasuk alasan dan tautan bukti.
- [ ] TL lain, SPG, dan Kasir tidak bisa membuka rencana/evaluasi TL lain (403) atau Peta Leader (menu tidak tampil, alamat langsung → "Halaman tidak ditemukan").

## Tahap 5 — Stok gudang & order

Jalankan `prisma migrate deploy` (migrasi `20261002000000_stock_orders`) lalu seed ulang. Seed mengisi stok pusat demo (Vitamin C kosong), stok awal SPG Demo, dan satu order menunggu persetujuan.

### Stok pusat (STK-01) — Admin

- [ ] Menu Stok Pusat menampilkan stok per produk, jumlah yang sudah dipesan tetapi belum dikirim, dan sisa setelah pesanan (merah bila kurang).
- [ ] "Barang masuk": pilih tanggal (tidak bisa masa depan), nomor PO opsional, isi jumlah beberapa produk sekaligus → stok bertambah.
- [ ] "Penyesuaian" wajib alasan; pengurangan melebihi stok ditolak.
- [ ] Tab Mutasi menampilkan setiap barang masuk, kirim order, dan penyesuaian dengan saldo sesudahnya, PO/nomor order, dan pelaku; bisa difilter produk, jenis, dan tanggal.
- [ ] Super Admin bisa membuka Stok Pusat tetapi tidak ada tombol Barang masuk/Penyesuaian.

### Order (ORD-01…04)

- [ ] SPG: menu Order Barang → "Buat order": pilih apotek tugas, stok pusat tiap produk terlihat, isi jumlah.
- [ ] Jumlah melebihi stok pusat (mis. Vitamin C) tetap bisa dikirim dengan keterangan "permintaan belum terpenuhi"; Super Admin menerima notifikasi "Order baru".
- [ ] Super Admin: menu Persetujuan → tab Order menampilkan order menunggu beserta stok pusat sekarang; jumlah disetujui bisa dikurangi (tidak bisa melebihi diminta), catatan opsional.
- [ ] Tolak wajib beralasan; SPG melihat alasannya di order dan menerima notifikasi.
- [ ] Setelah disetujui, SPG menerima notifikasi dan Admin menerima "Order siap dikirim".
- [ ] Admin: menu Order Masuk → Siap dikirim; jumlah kirim bawaan = disetujui tetapi dibatasi stok pusat; "Tandai dikirim" mengurangi stok pusat. Kirim kurang dari disetujui tercatat sebagai kurang kirim.
- [ ] SPG: order dikirim muncul di "Perlu konfirmasi terima"; jumlah diterima bawaan = dikirim. Bila berbeda, keterangan selisih wajib diisi.
- [ ] Setelah diterima, Stok Saya bertambah sesuai jumlah diterima; bila ada selisih Admin menerima notifikasi "Selisih penerimaan order" dan order muncul di tab Selisih sampai ditandai ditindaklanjuti.
- [ ] Jejak order (diajukan, disetujui/ditolak, dikirim, diterima, tindak lanjut) tampil lengkap dengan waktu, pelaku, dan catatan; semua tercatat di Riwayat.
- [ ] SPG tidak bisa memesan untuk apotek yang bukan tugasnya; SPG lain tidak bisa melihat order ini; Team Leader melihat order SPG timnya.

### Rekap permintaan (ORD-05)

- [ ] Stok Pusat → tab Rekap permintaan per produk: stok pusat, order menunggu kirim, perlu dibeli (menunggu − stok), diminta saat stok kurang, dan kurang kirim pada rentang tanggal; order ditolak tidak dihitung.

### Stok SPG & stok awal (AB-05)

- [ ] SPG: menu Stok Saya menampilkan sisa stok per apotek tugas dan riwayat mutasinya (stok awal, order diterima) dengan saldo.
- [ ] Admin: menu Stok SPG menampilkan setiap SPG per apotek, penanda "Stok awal belum diisi", dan filter "Hanya yang belum ada stok awal".
- [ ] "Stok awal" menyimpan jumlah per produk (tercatat di riwayat, SPG diberi notifikasi) dan masih bisa diubah sampai ada order diterima; setelah itu tombolnya terkunci.
- [ ] Super Admin bisa melihat Stok SPG tanpa tombol Stok awal; Team Leader melihat stok timnya di Tim Saya.
- [ ] Melepas penempatan SPG yang masih memegang stok atau masih punya order berjalan ditolak dengan pesan jelas.

### Beranda

- [ ] Super Admin: kartu "Order & stok pusat" (menunggu persetujuan, siap dikirim, selisih terima, produk habis). Admin: siap dikirim, dalam pengiriman, selisih terima.
- [ ] SPG: kartu "Stok & order" (stok per apotek, order yang perlu dikonfirmasi).

## Tahap 6 — Laporan penjualan, persetujuan kasir & retur

Jalankan `prisma migrate deploy` (migrasi `20261003000000_sales_returns`) lalu seed ulang. Seed membuat laporan penjualan SPG Demo hari ini (menunggu kasir Apotek Demo Sehat, `0812-0000-0005`) dan satu retur (menunggu kasir Apotek Demo Keluarga, `0812-0000-0011`). Uji kasir dari HP lewat HTTPS supaya kamera depan terbuka.

### Laporan penjualan (JUL-01, JUL-04) — SPG

- [ ] Menu Laporan Penjualan: pilih apotek tugas dan tanggal (hari ini atau kemarin); setiap produk menampilkan stok tersedia dan harga; total omzet terhitung otomatis.
- [ ] Jumlah di atas stok tersedia langsung merah dan tombol kirim nonaktif; stok yang tertahan laporan lain atau retur berjalan ikut diperhitungkan.
- [ ] Laporan kedua untuk apotek dan tanggal yang sama tidak bisa dibuat (yang ada bisa diubah selama menunggu kasir).
- [ ] Kasir menerima notifikasi "Laporan penjualan menunggu persetujuan".
- [ ] Setelah disetujui: stok SPG berkurang, omzet bulan ini bertambah di Beranda, laporan tidak bisa diubah lagi.

### Persetujuan kasir (JUL-03, RTR-02, AB-07) — Kasir Apotek

- [ ] Beranda kasir menampilkan jumlah laporan dan retur yang menunggu; menu Menunggu Persetujuan hanya berisi dokumen apotek sendiri.
- [ ] Setujui/Tolak meminta nama kasir dan foto wajah dari kamera depan (dengan deteksi kedip; bila gagal 30 detik, "Ambil foto tanpa deteksi kedip"); nama terakhir diingat di perangkat.
- [ ] Menolak wajib beralasan; SPG menerima notifikasi berisi alasan dan nama kasir.
- [ ] Bila SPG mengubah laporan saat kasir sedang memeriksa, persetujuan ditolak dengan pesan "Laporan baru saja diubah SPG".
- [ ] Riwayat Persetujuan menampilkan keputusan apotek ini dengan nama dan foto kasir.

### Perbaikan setelah ditolak — SPG

- [ ] Laporan yang ditolak menampilkan alasan kasir; SPG mengubah jumlah lalu "Kirim ulang ke kasir" (revisi bertambah, riwayat penolakan tetap tampil).

### Laporan tertunda (JUL-05) — Admin

- [ ] Menu Laporan Tertunda menampilkan laporan yang belum diputuskan lebih dari 1/2/3 hari (atau semua), lama menunggu, dan nomor kasir dengan tautan WhatsApp.
- [ ] Beranda Admin/Super Admin menampilkan kartu Penjualan (omzet disetujui vs target, menunggu kasir, tertunda > 1 hari).

### Retur (RTR-01…04)

- [ ] SPG: menu Retur → Ajukan retur: produk dengan stok tersedia, alasan wajib, foto barang opsional; jumlah melebihi stok ditolak.
- [ ] Kasir menyetujui/menolak dengan nama + foto; bila disetujui, Super Admin menerima notifikasi.
- [ ] Super Admin: Persetujuan → tab Retur menampilkan retur yang sudah disetujui kasir (dengan foto kasir dan foto barang); setujui atau tolak dengan alasan.
- [ ] Admin: menu Retur Masuk → Siap diterima; isi jumlah yang datang. Bila berbeda, keterangan wajib, retur ditandai "Ada selisih", dan Super Admin menerima notifikasi "Selisih retur".
- [ ] Setelah diterima: stok SPG berkurang sejumlah yang disetujui, stok pusat bertambah sejumlah yang diterima (terlihat di Stok Pusat → Mutasi "Retur diterima").
- [ ] Riwayat Pengajuan SPG punya tab Order, Retur, dan Laporan penjualan.

### Lain-lain

- [ ] Team Leader: Tim Saya menampilkan omzet tim per SPG vs target dan laporan yang menunggu kasir.
- [ ] Melepas penempatan SPG yang masih punya laporan menunggu kasir atau retur berjalan ditolak.
- [ ] Riwayat (Super Admin) memuat semua langkah laporan penjualan dan retur.
