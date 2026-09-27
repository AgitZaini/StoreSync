# BRD – Aplikasi SPG & Team Leader

Sep 27, 2026 · @agit zaini

## Ringkasan

Kak Tutut membutuhkan satu aplikasi untuk mengelola SPG dan Team Leader yang menjual produknya secara konsinyasi di apotek-apotek. Aplikasi ini menggantikan pencatatan lewat WhatsApp, Excel, dan Salesmania untuk absensi, jadwal, order barang, laporan penjualan, retur, stock opname, cuti, dan MOU apotek.

Hasil bisnis yang dituju: setiap penjualan diakui pihak apotek sebelum dihitung, selisih stok terlihat saat itu juga, dan gaji SPG dihitung dari data yang bisa dipertanggungjawabkan. Rincian hak akses mengikuti dokumen Kebutuhan Aplikasi SPG & Team Leader.

## Latar belakang dan masalah bisnis

Produk Kak Tutut dititipkan di apotek mitra. SPG ditempatkan di apotek untuk menjual, dan digaji dari penjualan riil. Barang yang belum terjual tidak ditagihkan ke apotek dan tetap menjadi aset Kak Tutut. Team Leader mengunjungi 8–12 apotek per hari untuk mengawasi SPG dan membuka kerja sama baru. Saat ini ada 40 karyawan dan 70–80 apotek mitra.

| Masalah | Dampak |
| --- | --- |
| Laporan penjualan dikirim SPG lewat WhatsApp dan diinput manual | Angka bisa dimanipulasi atau salah ketik, dan sulit diperiksa satu per satu |
| Tidak ada pengakuan penjualan dari pihak apotek | SPG bisa melaporkan penjualan yang tidak terjadi, lalu selisihnya ditanggung Kak Tutut |
| Selisih stok baru ketahuan saat stock opname akhir bulan | Kerugian terlanjur terjadi; pernah ada SPG keluar dengan selisih yang tidak kembali |
| Absen di Salesmania dan lokasi leader lewat share location WhatsApp terpisah | Data tidak terhubung dan sulit dibandingkan dengan jadwal |
| Jadwal mingguan dikirim sebagai file Word lewat WhatsApp | Admin sulit memantau siapa yang telat atau tidak masuk |
| Stok gudang, order, dan retur dicatat manual | Stok pusat tidak akurat, order yang tidak terpenuhi tidak tercatat |
| Cuti dan izin diajukan lewat chat | Tidak ada catatan jatah cuti dan potongan gaji |

## Tujuan bisnis dan indikator keberhasilan

| No | Tujuan | Indikator keberhasilan |
| --- | --- | --- |
| T1 | Penjualan yang dihitung adalah penjualan riil | Semua laporan penjualan yang masuk ke omzet sudah disetujui kasir apotek |
| T2 | Selisih stok ketahuan lebih awal | Penjualan yang melebihi stok ditolak sistem di hari yang sama, bukan saat stock opname |
| T3 | Kehadiran SPG dan leader bisa dipercaya | Semua absen memakai foto langsung dan lokasi dalam radius 20 m dari apotek |
| T4 | Stock opname dan gaji tepat waktu | Stock opname selesai paling lambat tanggal 30, gaji SPG dibayar tanggal 5 dari data aplikasi |
| T5 | Semua data dalam satu tempat | WhatsApp dan Excel tidak lagi dipakai untuk laporan penjualan, jadwal, order, retur, dan cuti |
| T6 | Setiap perubahan bisa ditelusuri | Setiap persetujuan dan koreksi punya catatan siapa, kapan, dan buktinya |

## Ruang lingkup

**Masuk tahap awal**

- Akun dan peran: Super Admin, Admin, Team Leader, SPG, Kasir Apotek.
- Data utama: apotek (titik lokasi, radius), produk, target omzet, jatah cuti, nominal potongan.
- Absen foto langsung + lokasi untuk SPG dan leader, serta lokasi live leader.
- Jadwal mingguan SPG oleh Admin dan rencana kunjungan leader.
- Order barang, stok gudang pusat, laporan penjualan dengan persetujuan kasir, dan retur.
- Stock opname bulanan dan koreksi stok.
- Cuti dan izin dengan perhitungan potongan untuk leader.
- MOU apotek baru.
- Dashboard per peran dan riwayat perubahan.

**Di luar lingkup tahap awal**

- Penagihan ke apotek: faktur, tukar faktur, pelunasan, dan nota kredit atau tunai.
- Peran Kurir/Collector.
- Penggajian lengkap (slip gaji, transfer).
- Integrasi dengan Accurate.
- Persetujuan berjenjang lewat Team Leader.
- Laporan dan notifikasi lewat WhatsApp, serta input laporan dari foto nota (menyusul setelah input manual stabil).

## Pemangku kepentingan dan pengguna

| Pihak | Peran di aplikasi | Kepentingan utama |
| --- | --- | --- |
| Kak Tutut | Super Admin, pemilik bisnis | Data penjualan dan stok yang jujur, persetujuan akhir |
| Bang Paul | Super Admin | Ikut memeriksa stok dan evaluasi tim |
| Admin kantor dan gudang (4 orang) | Admin | Jadwal, pemantauan absen, stok pusat, pencocokan stock opname |
| Team Leader | Team Leader | Kunjungan apotek, pengawasan tim, MOU apotek baru |
| SPG | SPG | Absen, order, laporan penjualan, melihat perkiraan gaji |
| Apotek mitra | Kasir Apotek (1 akun per apotek) | Menyetujui penjualan dan retur supaya tagihan sesuai |
| Agit | Business Analyst dan developer | Menyusun kebutuhan dan membangun aplikasi |

## Proses bisnis: sekarang dan yang diusulkan

Flowchart lengkap setiap proses ada di file terpisah, Flowchart Aplikasi SPG (HTML).

| Proses | Sekarang | Diusulkan |
| --- | --- | --- |
| Absen SPG | Salesmania, tanpa jaminan foto asli | Foto langsung dari kamera + lokasi dalam 20 m dari apotek tugas |
| Kunjungan leader | Share location WhatsApp | Absen masuk/keluar per apotek + lokasi live di aplikasi |
| Jadwal mingguan | File Word dari apotek, dikirim lewat WhatsApp | Admin menginput jadwal; sistem membandingkan dengan absen |
| Order barang | Lewat chat, dicatat manual | SPG ajukan di aplikasi, Super Admin setujui, Admin kirim |
| Laporan penjualan | Chat WhatsApp harian | Input di aplikasi, disetujui kasir apotek (nama + foto) |
| Retur | Nota tulis tangan | SPG ajukan, kasir dan Super Admin setujui, Admin terima barang |
| Stock opname | Hitung fisik, dicocokkan manual di kertas | Sistem menghitung sisa stok; Admin mencocokkan dan mengoreksi dengan alasan |
| Cuti dan izin | Chat, tanpa catatan jatah | Pengajuan di aplikasi, jatah dan potongan dihitung otomatis |
| MOU apotek baru | Kertas, tanda tangan basah + meterai | Leader buat di aplikasi, apotek tanda tangan dengan e-meterai (atau berkas fisik bermeterai), Super Admin setujui |

## Kebutuhan bisnis

"Wajib" harus ada saat aplikasi pertama dipakai; "Penting" bisa menyusul dalam tahap awal.

| ID | Kebutuhan | Untuk | Prioritas |
| --- | --- | --- | --- |
| BR-01 | Hanya Super Admin yang bisa membuat akun dan memberi peran | Super Admin | Wajib |
| BR-02 | Setiap pengguna hanya melihat data miliknya atau timnya | Semua | Wajib |
| BR-03 | Mengelola data apotek (titik lokasi, radius 20 m, jam buka), produk, dan target omzet | Super Admin | Wajib |
| BR-04 | Menempatkan SPG ke maksimal 3 apotek dan ke satu tim leader | Super Admin | Wajib |
| BR-05 | Absen masuk/pulang dengan foto langsung dan lokasi dalam 20 m | SPG, Team Leader | Wajib |
| BR-06 | Absen masuk/keluar per apotek yang dikunjungi dan lokasi live | Team Leader | Wajib |
| BR-07 | Menginput jadwal mingguan SPG dan melihat perbandingan jadwal dengan absen | Admin | Wajib |
| BR-08 | Membuat rencana kunjungan mingguan dan membandingkan dengan kunjungan nyata | Team Leader | Penting |
| BR-09 | Mencatat stok gudang pusat (barang masuk, keluar, retur) | Admin | Wajib |
| BR-10 | Mengajukan order barang dan melihat stok pusat; order tetap tercatat saat stok 0 | SPG | Wajib |
| BR-11 | Menyetujui order dan memproses pengirimannya | Super Admin, Admin | Wajib |
| BR-12 | Membuat laporan penjualan sekali sehari, manual per produk (input dari foto nota menyusul setelah input manual stabil) | SPG | Wajib |
| BR-13 | Menyetujui atau menolak laporan penjualan dengan nama dan foto kasir | Kasir Apotek | Wajib |
| BR-14 | Menolak penjualan yang melebihi sisa stok | Sistem | Wajib |
| BR-15 | Mengajukan retur, disetujui kasir dan Super Admin, diterima Admin | SPG, Kasir, Super Admin, Admin | Wajib |
| BR-16 | Menghitung sisa stok dan mendukung stock opname bulanan dengan koreksi beralasan | Sistem, Admin | Wajib |
| BR-17 | Mengajukan dan menyetujui cuti atau izin; menghitung potongan cuti leader di luar jatah | SPG, Team Leader, Super Admin | Wajib |
| BR-18 | Membuat MOU apotek baru dan menyetujuinya | Team Leader, Super Admin | Penting |
| BR-19 | Dashboard omzet dibanding target, sisa stok, dan hasil stock opname per peran | Semua kecuali Kasir | Wajib |
| BR-20 | Mencatat riwayat semua persetujuan, penolakan, dan koreksi | Sistem | Wajib |
| BR-21 | Rekap keterlambatan, selisih stok, dan order tidak terpenuhi | Admin, Super Admin | Penting |
| BR-22 | Serah terima stok setiap kali penempatan SPG di sebuah apotek berubah (pindah, diganti, atau resign) | Admin, Super Admin | Wajib |

## Aturan bisnis

| ID | Aturan |
| --- | --- |
| AB-01 | Foto absen diambil langsung dari kamera; unggah dari galeri tidak diizinkan dan foto dari foto atau layar ditolak |
| AB-02 | Lokasi absen maksimal 20 m dari titik apotek; lokasi palsu (fake GPS) ditolak |
| AB-03 | SPG hanya bisa absen di apotek yang ditugaskan, maksimal 3 apotek |
| AB-04 | Jam absen dicatat apa adanya; keterlambatan ditindaklanjuti Admin, bukan dipotong otomatis |
| AB-05 | Sisa stok = stok awal + order diterima − penjualan disetujui − retur diterima gudang, per SPG per apotek |
| AB-06 | Penjualan hanya dihitung setelah disetujui kasir, dan setelah itu tidak bisa diubah SPG |
| AB-07 | Setiap persetujuan kasir wajib mencantumkan nama dan foto kasir, karena akun dipakai bersama per apotek |
| AB-08 | Semua retur kembali ke gudang pusat |
| AB-09 | Stock opname dengan cut-off tanggal 25, paling lambat tanggal 30, dan SPG wajib hadir |
| AB-10 | Koreksi stok hanya oleh Admin, wajib dengan alasan, dan tercatat di riwayat |
| AB-11 | SPG digaji dari penjualan riil; gajian tanggal 5 hanya jika stock opname sudah cocok |
| AB-12 | Jatah cuti Team Leader 15 hari per tahun, termasuk izin sakit; kelebihannya dipotong per hari sesuai nominal dari Super Admin |
| AB-13 | Di tahap awal semua persetujuan akhir (order, retur, cuti, MOU) ada di Super Admin |
| AB-14 | Data yang sudah disetujui tidak bisa dihapus, hanya dikoreksi dengan riwayat |
| AB-15 | Stok menempel pada pasangan SPG dan apotek. Sebelum SPG pindah, diganti, atau resign, wajib stock opname serah terima; sisa stok dipindahkan ke SPG pengganti di apotek yang sama, atau sementara atas nama Team Leader bila belum ada pengganti |
| AB-16 | Selisih pada stock opname serah terima menjadi tanggungan SPG lama dan diselesaikan sebelum gaji terakhirnya dibayar |

## Asumsi, batasan, dan risiko

**Asumsi**

- Setiap SPG, leader, dan apotek mitra punya HP dengan kamera, GPS, dan paket data; aplikasi hanya berjalan online.
- Apotek mitra bersedia memakai akun kasir untuk menyetujui penjualan dan retur, karena ini juga melindungi tagihan mereka.
- Titik lokasi setiap apotek dicatat saat apotek didaftarkan.
- Harga produk dan target omzet diinput oleh Super Admin.

**Batasan**

- Aplikasi mobile harus jalan di Android dan iOS; pembuatan versi iOS membutuhkan perangkat Mac.
- Deteksi foto palsu dan lokasi palsu mengurangi kecurangan, tapi tidak bisa menjamin 100%.
- Penagihan dan penggajian lengkap belum ada, jadi faktur dan transfer gaji masih lewat Accurate dan cara saat ini.

**Risiko**

| Risiko | Penanganan |
| --- | --- |
| Kasir dan SPG bekerja sama memalsukan penjualan | Stock opname fisik bulanan tetap berjalan; selisih dilacak lewat riwayat dan foto kasir |
| Kasir malas atau lupa menyetujui | Laporan menunggu persetujuan terlihat di dashboard Admin untuk ditindaklanjuti |
| GPS di dalam gedung kurang akurat sehingga radius 20 m gagal | Uji di beberapa apotek sebelum rilis; siapkan pengajuan pengecualian yang disetujui Admin |
| HP SPG spesifikasi rendah | Uji di HP Android kelas bawah sebelum rilis |
| Apotek menolak MOU digital | MOU memakai e-meterai; berkas fisik bermeterai tetap bisa diunggah sebagai alternatif |

## Persetujuan dokumen

| Nama | Peran | Tanggal | Tanda tangan |
| --- | --- | --- | --- |
| Kak Tutut | Pemilik bisnis |  |  |
| Bang Paul | Pemilik bisnis |  |  |
| Agit | Business Analyst dan developer |  |  |
