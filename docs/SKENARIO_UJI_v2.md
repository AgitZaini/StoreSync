# Skenario Uji dari Nol — StoreSync v2 (Tahap 1–6)

Satu alur cerita dari database kosong sampai semua fitur Tahap 1–6 tercoba, dijalankan di laptop. Perkiraan waktu 90–120 menit. Kasus tepi (validasi, batas akses) ada di [Checklist UAT v2](UAT_CHECKLIST_v2.md); skenario ini fokus ke alur utama antarperan.

Setiap langkah punya **Harapan** berupa kotak centang. Bila hasilnya berbeda, catat nomor langkah, peran, dan screenshot, lalu lihat terminal server untuk pesan error.

---

## 0. Persiapan

### 0.1 Jalankan database dan penyimpanan berkas

```bash
docker compose up -d
```

### 0.2 Kosongkan database dev (semua data dev hilang)

Dari folder `server`:

```bash
npx prisma migrate reset --force
```

### 0.3 Isi data demo

```bash
npm run db:seed
```

- [ ] Output seed diakhiri baris `Order  1 order SPG Demo menunggu persetujuan`.

### 0.4 Jalankan server dan client

Server (folder `server`) dan client (folder `client`), masing-masing di terminal sendiri:

```bash
npm run dev
```

### 0.5 Siapkan tiga jendela browser

Sesi login disimpan per browser, jadi satu jendela = satu peran:

| Jendela | Browser | Dipakai untuk |
| --- | --- | --- |
| **A** | Chrome biasa | Super Admin (bagian 1), lalu SPG, lalu Team Leader. Semua yang butuh kamera/lokasi dikerjakan di sini. |
| **B** | Chrome Incognito | Admin, dan Kasir Apotek Uji Rumah di bagian 10 (butuh kamera) |
| **C** | Safari | Super Admin (mulai bagian 4) |

Semua jendela membuka `http://localhost:3000`. Izinkan Chrome memakai lokasi dan kamera: **System Settings → Privacy & Security → Location Services → Google Chrome** (nyalakan), dan **Camera → Google Chrome** (nyalakan).

Akun demo (sandi `Password123!`): Super Admin `0812-0000-0001`, Admin `0812-0000-0002`, Team Leader `0812-0000-0003`, SPG Demo `0812-0000-0004`. Izinkan juga kamera untuk jendela Incognito saat diminta (kasir di bagian 10).

---

## 1. Super Admin menyiapkan data — Jendela A

### 1.1 Login
1. Klik tombol akun demo **Super Admin**, lalu **Masuk**.
- [ ] Dashboard tampil dengan kartu Order & stok pusat, Absen hari ini, Team Leader hari ini.

### 1.2 Pengaturan absen
1. Menu **Pengaturan** → kartu **Absen**: Batas akurasi GPS `150`, Toleransi telat `10`, Batas jam kerja Team Leader `23:59` (supaya lokasi live bisa dicoba walau sudah malam). **Simpan**.
- [ ] Muncul "Pengaturan absen disimpan".

### 1.3 Daftarkan apotek di lokasi laptop Anda
1. Menu **Apotek** → **Daftarkan apotek**.
2. Nama `Apotek Uji Rumah`, alamat bebas, klik **Lokasi saya** (izinkan lokasi), Radius absen `100`, jam buka `07:00`–`23:00`.
3. Nomor HP login kasir `0812-9999-0001`, kata sandi sementara biarkan yang dibuat otomatis. Klik **Daftarkan apotek**.
- [ ] Peta menampilkan titik dan lingkaran radius di posisi Anda.
- [ ] Setelah disimpan muncul ringkasan akun kasir (nomor HP + sandi sementara). **Catat sandi kasir** (dipakai di bagian 10).

### 1.4 Buat akun SPG baru
1. Menu **Pengguna & Penempatan** → **Tambah pengguna**: Nama `SPG Uji`, Nomor HP `0812-9999-0002`, Peran **SPG**, Tim **Tim Demo Jakarta**. **Buat akun**.
2. **Catat kata sandi sementaranya.**
- [ ] SPG Uji muncul di daftar dengan label "Belum ganti sandi".

### 1.5 Tempatkan SPG di apotek
1. Buka detail **SPG Uji** → **Tambah penempatan** → pilih **Apotek Uji Rumah** → **Tempatkan**.
- [ ] Penempatan tampil di detail SPG.

### 1.6 Produk dan target
1. Menu **Produk & Target** → **Tambah produk**: Kode `UJI-001`, Nama `Sirup Uji`, Satuan `botol`, Harga `25000`. Simpan.
2. Di bagian target bulan ini, isi SPG Uji `5000000` → **Simpan target**.
- [ ] Produk dan target tersimpan.

### 1.7 Keluar
1. Klik **Keluar** (jendela A dipakai SPG di bagian 3).

---

## 2. Admin: jadwal, stok pusat, stok awal — Jendela B

### 2.1 Login
1. Tombol akun demo **Admin** → **Masuk**.
- [ ] Kartu "Order & stok pusat": 0 siap dikirim; Vitamin C tertulis habis.

### 2.2 Jadwal hari ini untuk SPG Uji
1. Menu **Jadwal Mingguan** → baris **SPG Uji · Apotek Uji Rumah** → klik sel hari ini.
2. Jenis **Masuk**, jam masuk = **1 jam sebelum sekarang**, jam pulang = 4 jam dari sekarang. Di "Terapkan juga ke" klik tombol hari besok → **Terapkan ke 2 hari**, lalu **Simpan (2)** di atas grid.
- [ ] Sel hari ini dan besok terisi.

### 2.3 Barang masuk
1. Menu **Stok Pusat** → **Barang masuk**: tanggal hari ini, Nomor PO `PO-UJI-001`, Sirup Uji `50`, Madu Herbal `20`. Simpan.
2. Buka tab **Mutasi**.
- [ ] Stok Sirup Uji 50; Madu bertambah 20.
- [ ] Tab Mutasi menampilkan "Barang masuk +50" dengan PO-UJI-001 dan nama Anda.

### 2.4 Penyesuaian stok
1. Tab **Stok** → **Penyesuaian**: Madu Herbal, **Kurangi stok** `2`, alasan `Botol pecah di gudang`. Simpan.
- [ ] Mutasi baru "Penyesuaian −2" dengan alasannya.
- [ ] Mengisi pengurangan lebih besar dari stok membuat tombol simpan nonaktif.

### 2.5 Stok awal SPG Uji
1. Menu **Stok SPG** → centang "Hanya yang belum ada stok awal".
2. Kartu **SPG Uji · Apotek Uji Rumah** → **Stok awal** → Sirup Uji `10` → Simpan.
- [ ] Kartu menampilkan total 10 barang.

---

## 3. SPG: login pertama, absen, stok, order — Jendela A

### 3.1 Login pertama dan ganti sandi
1. Login `0812-9999-0002` dengan sandi sementara dari langkah 1.4.
2. Buat kata sandi baru (min. 8 karakter, huruf + angka).
- [ ] Langsung diarahkan ke halaman ganti sandi; setelah diganti masuk ke Beranda.
- [ ] Lonceng berisi notifikasi Penempatan baru, Jadwal diperbarui, dan Stok awal diisi.
- [ ] Beranda menampilkan kartu "Hari ini" (jadwal Apotek Uji Rumah) dan "Stok & order" (10 barang).

### 3.2 Absen masuk (kamera + kedip)
1. Menu **Absen**. Tunggu banner hijau "Lokasi terkunci, akurasi ±… m".
- [ ] Kartu Apotek Uji Rumah menulis "Anda di dalam radius".
2. **Absen masuk** → izinkan kamera → wajah di dalam bingkai → kedipkan mata perlahan.
- [ ] Foto terambil otomatis dengan cap nama, "Absen masuk", apotek, dan jam WIB.
3. **Gunakan foto**.
- [ ] "Absen masuk tercatat"; status **Telat ± 60 mnt** (jadwal masuk 1 jam lalu).

### 3.3 Absen pulang ditolak → pengecualian
1. Di **jendela C (Safari)**, login **Super Admin** → **Pengaturan** → Batas akurasi GPS `10` → Simpan. (Akurasi GPS laptop hampir selalu lebih buruk dari 10 m.)
2. Kembali ke jendela A → **Absen pulang** → ambil foto seperti tadi.
- [ ] Muncul "Absen belum tercatat" karena GPS kurang akurat, beserta jarak dan akurasinya.
3. Isi alasan `Uji coba: GPS dalam rumah kurang akurat` → **Ajukan pengecualian**.
- [ ] Kartu apotek menulis "Menunggu persetujuan Admin untuk pengecualian absen."
4. Di jendela C, kembalikan Batas akurasi GPS ke `150` → Simpan.

### 3.4 Stok saya
1. Menu **Stok Saya** → **Riwayat** di Apotek Uji Rumah.
- [ ] Sirup Uji 10 botol; riwayat "Stok awal +10, sisa 10" oleh Admin Gudang Demo.

### 3.5 Dua order
1. Menu **Order Barang** → **Buat order**: apotek Apotek Uji Rumah, Sirup Uji `5`, Vitamin C `3`. **Kirim order**.
- [ ] Vitamin C menampilkan "Stok pusat 0 … kekurangan dicatat sebagai permintaan belum terpenuhi", dan ada peringatan oranye.
- [ ] Order baru berstatus "Menunggu persetujuan" + "Sebagian belum terpenuhi".
2. **Buat order** lagi: Madu Herbal `2`. Kirim.
- [ ] Dua order tampil di "Sedang diproses".

---

## 4. Super Admin: persetujuan — Jendela C

### 4.1 Notifikasi
1. Jendela C (sudah login Super Admin) → lonceng.
- [ ] Ada dua "Order baru"; salah satunya menyebut produk yang melebihi stok pusat.

### 4.2 Setujui dengan jumlah dikurangi
1. Menu **Persetujuan** → tab **Order** → order Sirup Uji + Vitamin C.
2. Ubah Vitamin C disetujui `0`, catatan `Vitamin C menunggu barang pabrik` → **Setujui**.
- [ ] Order pindah ke "Keputusan terakhir" dengan jejak "Disetujui … oleh Super Admin Demo" dan catatannya.

### 4.3 Tolak
1. Order Madu → **Tolak** → alasan `Stok apotek masih cukup`.
- [ ] Order berstatus "Ditolak" dengan alasannya.

---

## 5. Admin: pengecualian, pemantauan, kirim, rekap — Jendela B

### 5.1 Pengecualian absen
1. Lonceng: "Pengecualian absen". Menu **Pemantauan Absen** → tab **Pengecualian**.
- [ ] Kartu menampilkan foto wajah Anda, jarak, akurasi, alasan, dan tautan peta.
2. **Setujui**.
- [ ] Status "Disetujui"; SPG menerima notifikasi.

### 5.2 Pemantauan absen harian
1. Tab **Absen harian** → klik baris **SPG Uji**.
- [ ] Foto masuk dan pulang tampil, jam masuk berstatus telat, pulang berlabel "Pengecualian".
2. Isi Catatan Admin `Telat karena uji coba` → **Simpan catatan**.

### 5.3 Kirim order
1. Menu **Order Masuk** → tab **Siap dikirim**.
- [ ] Sirup Uji jumlah kirim terisi 5; Vitamin C 0.
2. Catatan `Kurir sore` → **Tandai dikirim**.
3. Buka **Stok Pusat** → tab **Mutasi**.
- [ ] Stok Sirup Uji 45; mutasi "Kirim order −5" dengan nomor order, nama SPG, dan apotek.

### 5.4 Rekap permintaan
1. Stok Pusat → tab **Rekap permintaan**.
- [ ] Vitamin C muncul dengan "Diminta saat stok kurang" berisi order Anda (dan order demo dari seed); order Madu yang ditolak tidak dihitung.

---

## 6. SPG: terima barang dengan selisih — Jendela A

1. Menu **Order Barang** → bagian "Perlu konfirmasi terima" → **Konfirmasi terima**.
2. Ubah Sirup Uji diterima `4`.
- [ ] Muncul peringatan merah dan tombol konfirmasi nonaktif sampai keterangan diisi.
3. Keterangan `1 botol pecah saat diterima` → **Konfirmasi terima**.
- [ ] Order berstatus "Diterima" + "Ada selisih".
- [ ] **Stok Saya**: Sirup Uji 14 (10 + 4); riwayat "Order diterima +4" dengan nomor order.
- [ ] Order Madu tampil "Ditolak" dengan alasan dari Super Admin.

---

## 7. Admin: tindak lanjut selisih — Jendela B

1. Lonceng: "Selisih penerimaan order … dikirim 5, diterima 4".
2. **Order Masuk** → tab **Selisih** → **Tandai ditindaklanjuti** → catatan `Sudah dicek dengan kurir`.
- [ ] Tab Selisih kosong; di tab Selesai order menampilkan jejak tindak lanjut.
3. **Stok SPG** → kartu SPG Uji.
- [ ] Label "Stok awal terkunci" dan tombol Stok awal nonaktif (sudah ada order diterima).

---

## 8. Team Leader: rencana, kunjungan, lokasi live — Jendela A

### 8.1 Login
1. **Keluar** dari SPG, login akun demo **Team Leader**.
- [ ] Beranda: kartu "Kunjungan hari ini" (Belum mulai) dan pengingat apotek rencana minggu lalu yang belum diberi alasan.

### 8.2 Rencana minggu depan (belum terkunci)
1. Menu **Rencana Kunjungan** → panah minggu berikutnya → hari Senin **+ Tambah apotek** → Apotek Uji Rumah → **Simpan**.
- [ ] Tertulis "Bebas diubah sampai terkunci …".

### 8.3 Ubah rencana minggu ini (sudah terkunci)
1. Kembali ke **Minggu ini** → hari ini **+ Tambah apotek** → Apotek Uji Rumah → **Simpan**.
- [ ] Toast "Perubahan ditandai karena rencana sudah terkunci"; apotek berlabel "Ditambah setelah terkunci".

### 8.4 Absen kunjungan
1. Menu **Absen Kunjungan**.
- [ ] Rencana hari ini memuat Apotek Uji Rumah "Di dalam radius".
2. **Absen masuk** → kamera → kedip → Gunakan foto.
- [ ] Kartu "Sedang berkunjung" muncul; banner biru **"Lokasi live aktif"** tampil di atas semua halaman TL.
- [ ] Tombol Absen masuk di apotek lain nonaktif ("Absen keluar dulu dari …").
3. Tunggu ±2 menit → **Absen keluar**.
- [ ] Toast menyebut lama kunjungan; "Kunjungan hari ini" menampilkan jam masuk–keluar dan durasinya.
4. **Selesai hari ini** → konfirmasi.
- [ ] Sesi "Selesai"; banner lokasi live hilang.

### 8.5 Evaluasi dan alasan
1. **Rencana Kunjungan** → tab **Evaluasi** → minggu lalu.
- [ ] Apotek rencana dari seed berstatus "Tidak dikunjungi" dengan "Alasan belum diisi".
2. **Isi alasan** pada salah satunya: `Sakit, ada surat dokter`, lampirkan foto/PDF apa saja → **Simpan alasan**.
- [ ] Alasan dan tautan "Lihat bukti" tampil; jumlah "Tanpa alasan" berkurang.

### 8.6 Tim Saya
1. Menu **Tim Saya**.
- [ ] Absen hari ini memuat SPG Uji (telat); kartu **Stok tim** memuat SPG Uji · Apotek Uji Rumah 14.

---

## 9. Super Admin: peta, evaluasi, riwayat, guard — Jendela C

1. Lonceng: "Rencana kunjungan diubah … setelah rencana terkunci".
2. Menu **Peta Leader** → klik **Team Leader Demo**.
- [ ] Status "Selesai", lokasi terakhir, marker di peta; daftar kunjungan Apotek Uji Rumah. Klik kunjungan → foto masuk dan keluar tampil.
3. Menu **Evaluasi Kunjungan**, minggu ini → Team Leader Demo.
- [ ] Apotek Uji Rumah "Dikunjungi" dengan durasi, berlabel "Ditambah setelah terkunci". Minggu lalu menampilkan alasan dan bukti dari 8.5.
4. Menu **Riwayat** → filter jenis data **Order**, lalu **Stok pusat**.
- [ ] Setiap langkah tercatat (mengajukan, menyetujui, menolak, mengirim, menerima, menindaklanjuti; barang masuk, penyesuaian) dengan pelaku, waktu, dan isi perubahan.
5. **Pengguna & Penempatan** → SPG Uji → **Lepas penempatan** → alasan apa saja.
- [ ] Ditolak: "SPG masih memegang 14 barang di apotek ini …".

---

## 10. Penjualan, persetujuan kasir, dan retur (Tahap 6)

### 10.1 SPG membuat laporan penjualan — Jendela A
1. **Keluar** dari Team Leader, login SPG Uji (`0812-9999-0002`, sandi baru dari 3.1).
2. Menu **Laporan Penjualan** → Apotek Uji Rumah, Hari ini.
- [ ] Sirup Uji "Tersedia 14 botol · Rp 25.000".
3. Isi Sirup Uji `15`.
- [ ] Angka merah, pesan "Jumlah melebihi stok tersedia", tombol kirim nonaktif.
4. Ubah ke `3` → **Kirim ke kasir**.
- [ ] Total Rp 75.000; laporan berstatus "Menunggu kasir".

### 10.2 Kasir login pertama dan menolak — Jendela B
1. **Keluar** dari Admin, login `0812-9999-0001` dengan sandi sementara kasir dari 1.3, lalu buat sandi baru.
- [ ] Beranda kasir: "Menunggu persetujuan Anda" 1 laporan penjualan.
2. **Periksa sekarang** → laporan SPG Uji → **Tolak**.
3. Nama kasir `Rina` → **Ambil foto wajah** (kamera laptop, kedipkan mata) → **Gunakan foto** → alasan `Yang terjual 2 botol` → **Tolak**.
- [ ] Laporan hilang dari daftar tunggu.

### 10.3 SPG memperbaiki — Jendela A
1. Muat ulang Laporan Penjualan.
- [ ] Tampil "Ditolak kasir: Yang terjual 2 botol", lengkap dengan nama kasir Rina.
2. Ubah Sirup Uji jadi `2` → **Kirim ulang ke kasir**.
- [ ] Judul menjadi "revisi 2", status "Menunggu kasir".

### 10.4 Kasir menyetujui — Jendela B
1. Laporan revisi 2 → **Setujui**.
- [ ] Nama "Rina" sudah terisi otomatis.
2. Ambil foto wajah → **Setujui**.
- [ ] Menu **Riwayat Persetujuan** menampilkan penolakan dan persetujuan, masing-masing dengan foto Anda.

### 10.5 Dampak ke stok dan omzet — Jendela A
1. **Beranda** dan **Stok Saya**.
- [ ] Omzet bulan ini Rp 50.000 dari target Rp 5.000.000 (1%).
- [ ] Stok Sirup Uji 12; riwayat "Penjualan disetujui −2" dengan nomor laporan.
- [ ] Laporan tidak bisa diubah lagi ("sudah disetujui … AB-06").

### 10.6 Retur — SPG, Kasir, Super Admin, Admin
1. Jendela A: menu **Retur** → **Ajukan retur**: Sirup Uji `1`, alasan `Segel kemasan rusak`, **Foto barang** (pilih gambar apa saja) → Ajukan.
- [ ] Retur berstatus "Menunggu kasir".
2. Jendela B (kasir): tab **Retur** → foto barang terlihat → **Setujui** (nama + foto wajah).
3. Jendela C (Super Admin): lonceng "Retur menunggu persetujuan" → **Persetujuan** → tab **Retur** → **Setujui**.
- [ ] Kartu retur menampilkan foto barang dan foto kasir Rina.
4. Jendela B: **Keluar** dari kasir, login **Admin** → menu **Retur Masuk** → Siap diterima: isi diterima `1` → **Konfirmasi diterima gudang**.
- [ ] Stok Pusat Sirup Uji bertambah 1 (tab Mutasi: "Retur diterima"); Stok Saya SPG Uji menjadi 11.
- [ ] Sebelum konfirmasi, coba ubah jumlah diterima jadi `0`: tombol konfirmasi nonaktif sampai keterangan selisih diisi. Kembalikan ke `1` sebelum konfirmasi.

### 10.7 Pantauan — Admin dan Super Admin
1. Jendela B: menu **Laporan Tertunda** → pilih "semua".
- [ ] Tidak ada laporan SPG Uji (sudah disetujui); laporan demo lain yang masih menunggu tampil dengan tautan WhatsApp kasirnya.
2. Jendela C: **Riwayat** → filter **Laporan penjualan**, lalu **Retur**.
- [ ] Tercatat: kirim, ditolak kasir (nama kasir), perbaikan, disetujui; retur diajukan, disetujui kasir, disetujui Super Admin, diterima gudang.

---

## 11. Tampilan HP (tanpa HP)

Kamera dan GPS di HP sungguhan butuh HTTPS, jadi untuk sekarang cek tampilannya di Chrome:

1. Jendela A → **View → Developer → Developer Tools** → ikon HP (**Toggle device toolbar**, ⌘⇧M) → pilih ukuran 375 px (mis. iPhone SE) → muat ulang.
2. Buka Beranda, Absen Kunjungan, Rencana Kunjungan (sebagai SPG: Absen, Laporan Penjualan, Order Barang, Stok Saya; sebagai kasir: Menunggu Persetujuan).
- [ ] Navigasi bawah tampil, tidak ada geser ke samping, dialog muncul dari bawah layar.

---

## Mengulang dari awal

Ulangi langkah 0.2–0.3 (reset + seed). Seed tidak menghapus data yang Anda buat; hanya reset yang mengosongkan database.
