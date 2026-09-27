# PRD – Aplikasi SPG & Team Leader

Sep 27, 2026 · @agit zaini

## Ringkasan

PRD ini menerjemahkan BRD Aplikasi SPG & Team Leader menjadi fitur, user story, dan kriteria penerimaan yang siap dibangun untuk tahap awal. Alur setiap proses mengikuti file Flowchart Aplikasi SPG (HTML), dan hak akses mengikuti dokumen Kebutuhan Aplikasi SPG & Team Leader.

Penomoran: setiap user story punya ID modul (misalnya ABS-01) supaya mudah dirujuk saat pengembangan dan pengujian.

## Pengguna dan platform

| Peran | Aplikasi | Kebutuhan utama |
| --- | --- | --- |
| Super Admin (Kak Tutut, Bang Paul) | Web + mobile | Melihat semua data, menyetujui, mengatur akun dan pengaturan |
| Admin | Web | Jadwal, pemantauan absen, stok pusat, pencocokan stock opname |
| Team Leader | Mobile | Absen per apotek, lokasi live, rencana kunjungan, pantau tim, MOU |
| SPG | Mobile | Absen, order, laporan penjualan, retur, cuti, dashboard pribadi |
| Kasir Apotek (1 akun per apotek) | Mobile atau web | Menyetujui penjualan dan retur dengan nama + foto |

Aplikasi mobile tersedia untuk Android dan iOS dan membutuhkan koneksi internet. Web dipakai lewat browser di laptop. Skala awal: 40 karyawan (2 Super Admin, 4 Admin, sisanya SPG, Team Leader, dan kurir) dan 70–80 apotek, jadi 70–80 akun Kasir Apotek.

## Modul 1 – Akun dan data utama

**AKN-01 – Membuat akun.** Sebagai Super Admin, saya ingin membuat akun dan memberi peran supaya hanya orang yang saya tunjuk yang bisa masuk.

- Hanya Super Admin yang melihat menu kelola akun.
- Data akun: nama, nomor HP, peran, status aktif. Login memakai nomor HP dan kata sandi.
- Pengguna wajib mengganti kata sandi saat login pertama.
- Akun bisa dinonaktifkan; data dan riwayatnya tetap tersimpan.

**AKN-02 – Menempatkan SPG.** Sebagai Super Admin, saya ingin menempatkan SPG ke apotek dan ke tim leader.

- Satu SPG maksimal 3 apotek; penempatan ke-4 ditolak dengan pesan yang jelas.
- Satu SPG hanya masuk satu tim leader.
- Perubahan penempatan tercatat di riwayat dan tidak mengubah data penjualan lama. Penempatan SPG di sebuah apotek tidak bisa dilepas sebelum serah terima stok (SO-05) selesai.

**AKN-03 – Data apotek.** Sebagai Super Admin, saya ingin mendaftarkan apotek beserta titik lokasinya.

- Data: nama, alamat, titik lokasi (pilih di peta), radius absen (bawaan 20 m), jam buka, 24 jam atau tidak, status aktif.
- Setiap apotek otomatis punya satu akun Kasir Apotek.

**AKN-04 – Data produk dan target.** Sebagai Super Admin, saya ingin mengatur produk, harga, dan target omzet.

- Data produk: nama, kode, satuan, harga jual.
- Target omzet diatur per SPG per bulan.

**AKN-05 – Pengaturan cuti dan potongan.** Sebagai Super Admin, saya ingin mengatur jatah cuti leader dan nominal potongan per hari.

- Bawaan jatah cuti leader 15 hari per tahun, bisa diubah.
- Nominal potongan per hari diisi Super Admin; perubahan hanya berlaku untuk cuti yang disetujui setelahnya.

**AKN-06 – Batas akses.** Sebagai pengguna, saya hanya melihat data sesuai peran saya.

- SPG hanya melihat datanya sendiri; leader hanya timnya; kasir hanya apoteknya.
- Akses dicek di server, bukan hanya disembunyikan di tampilan.

## Modul 2 – Absen dan lokasi

**ABS-01 – Absen SPG.** Sebagai SPG, saya ingin absen masuk dan pulang di apotek tugas saya.

- SPG memilih apotek dari daftar apotek tugasnya (maksimal 3).
- Kamera langsung terbuka; tidak ada pilihan unggah dari galeri.
- Sistem mengecek foto adalah wajah asli (bukan foto dari foto atau layar). Jika gagal, absen ditolak dan SPG diminta mengulang.
- Sistem mengecek lokasi maksimal 20 m dari titik apotek dan menolak lokasi palsu (mock location). Jika gagal, tampilkan jarak saat ini.
- Absen tersimpan dengan jam server (bukan jam HP), foto, koordinat, dan jarak.
- Absen pulang hanya bisa setelah absen masuk di hari yang sama.

**ABS-02 – Absen kunjungan leader.** Sebagai Team Leader, saya ingin absen masuk dan keluar di setiap apotek yang saya kunjungi.

- Pengecekan foto dan lokasi sama dengan ABS-01, untuk semua apotek aktif.
- Leader tidak bisa absen masuk di apotek baru sebelum absen keluar dari apotek sebelumnya.
- Lama kunjungan dihitung otomatis dari jam masuk dan keluar.

**ABS-03 – Lokasi live leader.** Sebagai Super Admin, saya ingin melihat posisi leader selama jam kerja.

- Lokasi terkirim berkala (misalnya tiap 5 menit) sejak absen masuk pertama sampai absen keluar terakhir hari itu.
- Di luar jam kerja lokasi tidak dikirim.
- Super Admin dan Admin melihat posisi terakhir dan jejak harian di peta.

**ABS-04 – Perbandingan dengan jadwal.** Sebagai Admin, saya ingin melihat SPG yang telat atau tidak masuk.

- Sistem membandingkan jam absen masuk dengan jadwal dari Admin.
- Status: tepat waktu, telat (dengan selisih menit), tidak masuk.
- Tidak ada potongan otomatis; Admin mengisi catatan alasan.

## Modul 3 – Jadwal dan kunjungan

**JDW-01 – Input jadwal mingguan.** Sebagai Admin, saya ingin menginput jadwal SPG per minggu.

- Per SPG per apotek per hari: jam masuk, jam pulang, atau libur.
- Admin bisa menyalin jadwal minggu lalu lalu mengubahnya.
- Hanya Admin yang bisa mengisi dan mengubah jadwal; setiap perubahan tercatat.

**JDW-02 – Melihat jadwal.** Sebagai SPG, saya ingin melihat jadwal saya minggu ini dan minggu depan. Leader melihat jadwal seluruh timnya.

**KNJ-01 – Rencana kunjungan.** Sebagai Team Leader, saya ingin membuat rencana kunjungan mingguan.

- Per hari: daftar apotek yang akan dikunjungi.
- Rencana dikunci saat minggu berjalan; perubahan setelahnya tercatat.

**KNJ-02 – Evaluasi kunjungan.** Sebagai Super Admin, saya ingin membandingkan rencana dengan kunjungan nyata.

- Per hari: apotek yang direncanakan, yang dikunjungi, dan lama kunjungan.
- Apotek yang tidak dikunjungi ditandai; leader wajib mengisi alasan dan bisa melampirkan bukti (misalnya surat dokter).

## Modul 4 – Stok gudang dan order

**STK-01 – Stok gudang pusat.** Sebagai Admin, saya ingin mencatat barang masuk ke gudang pusat.

- Barang masuk: produk, jumlah, tanggal, nomor PO pembelian ke pabrik (opsional).
- Stok pusat berkurang otomatis saat order dikirim dan bertambah saat retur diterima.
- Setiap perubahan stok pusat punya riwayat.

**ORD-01 – Mengajukan order.** Sebagai SPG, saya ingin mengajukan order barang untuk apotek tugas saya.

- SPG melihat stok pusat per produk sebelum memesan.
- Isi order: apotek, produk, jumlah.
- Jika stok pusat 0, order tetap bisa dikirim sebagai "permintaan belum terpenuhi".

**ORD-02 – Menyetujui order.** Sebagai Super Admin, saya ingin menyetujui atau menolak order.

- Penolakan wajib disertai alasan dan terlihat oleh SPG.
- Jumlah yang disetujui boleh lebih kecil dari yang diminta.

**ORD-03 – Mengirim order.** Sebagai Admin, saya ingin menandai order sebagai dikirim.

- Status order: diajukan, disetujui, dikirim, diterima, ditolak.
- Stok pusat berkurang saat status dikirim.

**ORD-04 – Menerima barang.** Sebagai SPG, saya ingin mengonfirmasi barang sudah sampai di apotek.

- Stok SPG di apotek itu bertambah setelah konfirmasi.
- Jika jumlah yang datang berbeda, SPG mengisi jumlah sebenarnya dan Admin menerima tanda selisih.

**ORD-05 – Rekap permintaan.** Sebagai Admin, saya ingin melihat rekap permintaan yang belum terpenuhi per produk untuk dasar pembelian ke pabrik.

## Modul 5 – Laporan penjualan dan persetujuan kasir

**JUL-01 – Input manual.** Sebagai SPG, saya ingin melaporkan penjualan hari ini dengan memilih produk dan jumlahnya.

- Satu laporan per SPG per apotek per hari, dikirim sekali sehari; bisa berisi banyak produk.
- Omzet dihitung dari jumlah × harga produk.
- Jumlah per produk tidak boleh melebihi sisa stok SPG di apotek itu; jika melebihi, laporan tidak bisa dikirim.

**JUL-02 – Input dari foto nota (rilis berikutnya, setelah input manual stabil).** Sebagai SPG, saya ingin memfoto nota supaya produk dan jumlahnya terisi otomatis.

- Sistem membaca nota dan mengisi produk serta jumlah; SPG wajib memeriksa sebelum mengirim.
- Foto nota tersimpan sebagai bukti di laporan.
- Aturan sisa stok sama dengan JUL-01.

**JUL-03 – Persetujuan kasir.** Sebagai Kasir Apotek, saya ingin menyetujui atau menolak laporan penjualan SPG di apotek saya.

- Kasir melihat daftar laporan yang menunggu persetujuan untuk apoteknya saja.
- Setuju: kasir wajib mengisi nama dan mengambil foto wajah langsung dari kamera.
- Tolak: kasir wajib mengisi nama, foto, dan alasan; laporan kembali ke SPG untuk diperbaiki.
- Tersimpan: akun apotek, nama kasir, foto, tanggal, dan jam.

**JUL-04 – Setelah disetujui.** Sebagai Super Admin, saya ingin penjualan yang sudah disetujui langsung dihitung.

- Omzet SPG bertambah dan sisa stok berkurang saat disetujui.
- SPG tidak bisa mengubah atau menghapus laporan yang sudah disetujui.

**JUL-05 – Laporan tertunda.** Sebagai Admin, saya ingin melihat laporan yang belum disetujui lebih dari 1 hari supaya bisa menghubungi apotek.

## Modul 6 – Retur

**RTR-01 – Mengajukan retur.** Sebagai SPG, saya ingin mengembalikan barang ke gudang pusat.

- Isi: apotek, produk, jumlah, alasan, foto barang (opsional).
- Jumlah tidak boleh melebihi sisa stok SPG di apotek itu.
- Tujuan retur selalu gudang pusat.

**RTR-02 – Persetujuan kasir.** Sebagai Kasir Apotek, saya ingin menyetujui retur yang keluar dari apotek saya, dengan aturan nama + foto yang sama seperti JUL-03.

**RTR-03 – Persetujuan Super Admin.** Sebagai Super Admin, saya ingin menyetujui retur setelah kasir menyetujui. Penolakan wajib disertai alasan.

**RTR-04 – Penerimaan di gudang.** Sebagai Admin, saya ingin mengonfirmasi barang retur sudah diterima.

- Status retur: diajukan, disetujui kasir, disetujui Super Admin, diterima gudang, ditolak.
- Saat diterima gudang: sisa stok SPG berkurang dan stok pusat bertambah.
- Jika jumlah yang diterima berbeda, Admin mengisi jumlah sebenarnya dan selisihnya ditandai.

## Modul 7 – Stock opname

Rumus sisa stok per SPG per apotek:

```latex
\text{Sisa stok} = \text{stok awal} + \text{order diterima} - \text{penjualan disetujui} - \text{retur diterima}
```

**SO-01 – Membuka periode.** Sebagai Admin, saya ingin membuka periode stock opname pada tanggal 25.

- Sistem membuat lembar stock opname per SPG per apotek berisi sisa stok sistem per produk.
- Periode harus ditutup paling lambat tanggal 30.

**SO-02 – Mencatat hitungan fisik.** Sebagai Admin atau Super Admin, saya ingin mencatat hasil hitungan fisik di apotek.

- Isi jumlah fisik per produk, foto bukti, dan tanda bahwa SPG hadir.
- Jika SPG tidak hadir, lembar dijadwalkan ulang, paling lambat tanggal 30.
- Sistem menampilkan selisih per produk (fisik dikurangi sistem).

**SO-03 – Koreksi selisih.** Sebagai Admin, saya ingin mengoreksi sisa stok bila ada selisih.

- Koreksi wajib diisi alasan; tercatat di riwayat dan muncul di dashboard Super Admin.
- Sisa stok setelah koreksi menjadi stok awal bulan berikutnya.

**SO-04 – Hasil di dashboard SPG.** Sebagai SPG, saya ingin melihat hasil stock opname dan omzet final saya.

- Tampil: total order, total penjualan disetujui, retur, sisa stok, selisih, dan omzet final.
- Status gajian: siap dibayar tanggal 5 jika stock opname sudah ditutup tanpa selisih yang belum diselesaikan.

**SO-05 – Serah terima stok.** Sebagai Admin, saya ingin melakukan stock opname serah terima setiap kali SPG pindah apotek, diganti, atau resign, karena stok menempel pada pasangan SPG dan apotek.

- Admin membuka lembar serah terima untuk SPG dan apotek yang berubah; isinya sisa stok sistem per produk.
- Stok fisik dihitung bersama SPG lama, lalu selisihnya ditampilkan.
- Selisih menjadi tanggungan SPG lama dan harus diselesaikan sebelum gaji terakhirnya dibayar.
- Sisa stok dipindahkan ke SPG pengganti di apotek yang sama. Bila belum ada pengganti, stok dicatat sementara atas nama Team Leader tim itu sampai ada SPG baru.
- Omzet SPG lama dihitung sampai tanggal serah terima; setelah itu penempatannya dilepas, dan akunnya dinonaktifkan bila resign.

## Modul 8 – Cuti dan izin

**CTI-01 – Mengajukan.** Sebagai SPG atau Team Leader, saya ingin mengajukan cuti atau izin sakit.

- Cuti: tanggal mulai, tanggal selesai, alasan.
- Izin sakit: tanggal dan foto surat dokter (wajib).
- Leader melihat sisa jatah cutinya sebelum mengajukan. Izin sakit leader juga mengurangi jatah cuti.

**CTI-02 – Menyetujui.** Sebagai Super Admin, saya ingin menyetujui atau menolak pengajuan. Penolakan wajib disertai alasan.

**CTI-03 – Potongan cuti leader.** Sebagai Super Admin, saya ingin potongan cuti leader dihitung otomatis.

- Potongan = jumlah hari cuti dan izin sakit di luar jatah tahunan × nominal potongan per hari dari pengaturan (AKN-05).
- Rekap potongan per leader per bulan tampil di dashboard Super Admin.

**CTI-04 – Dampak ke jadwal.** Cuti dan izin yang disetujui otomatis tampil di jadwal dan tidak dihitung sebagai tidak masuk di pemantauan Admin.

## Modul 9 – MOU apotek baru

**MOU-01 – Membuat MOU.** Sebagai Team Leader, saya ingin mendaftarkan apotek calon mitra dan membuat MOU-nya.

- Isi data apotek: nama, alamat, nama pemilik atau penanggung jawab, nomor HP, titik lokasi (diambil saat leader berada di apotek).
- MOU memakai templat pernyataan yang diatur Super Admin: menjaga produk tetap bersegel, tidak dicoret, produk rusak wajib dibayar, dan produk yang tidak bisa diretur.

**MOU-02 – Tanda tangan apotek.** Sebagai Team Leader, saya ingin pihak apotek menandatangani MOU di HP saya.

- Tanda tangan digital di layar, nama penanda tangan, dan foto wajahnya.
- Sistem membuat file PDF MOU yang dibubuhi e-meterai dan bisa diunduh. Bila apotek memilih berkas fisik, leader mengunggah scan MOU bermeterai yang sudah ditandatangani.

**MOU-03 – Persetujuan.** Sebagai Super Admin, saya ingin menyetujui MOU sebelum apotek aktif.

- Setelah disetujui: apotek aktif, radius absen 20 m, dan akun Kasir Apotek dibuat.
- Setelah ditolak: MOU kembali ke leader dengan alasan.

## Modul 10 – Dashboard, notifikasi, dan riwayat

**DSB-01 – Isi dashboard per peran.**

| Peran | Isi dashboard |
| --- | --- |
| Super Admin | Omzet semua SPG vs target (harian, mingguan, bulanan), persetujuan yang menunggu, selisih stok, keterlambatan, potongan cuti leader, peta lokasi leader |
| Admin | Absen hari ini vs jadwal, laporan belum disetujui lebih dari 1 hari, order untuk dikirim, retur untuk diterima, stock opname berjalan, stok pusat |
| Team Leader | Omzet dan sisa stok SPG di timnya, absen tim hari ini, rencana vs kunjungan, sisa jatah cuti |
| SPG | Omzet vs target, sisa stok per apotek, jadwal minggu ini, status pengajuan, hasil stock opname |
| Kasir Apotek | Daftar yang menunggu persetujuan dan riwayat persetujuan apotek |

**NTF-01 – Notifikasi di aplikasi.**

Notifikasi hanya lewat aplikasi (push notification); WhatsApp tidak dipakai di tahap awal.

| Kejadian | Penerima |
| --- | --- |
| Laporan penjualan atau retur dikirim | Kasir Apotek terkait |
| Order, retur, cuti, atau MOU menunggu persetujuan | Super Admin |
| Pengajuan disetujui atau ditolak | Pengaju |
| Order dikirim | SPG |
| SPG belum absen 30 menit setelah jam jadwal | Admin |
| Periode stock opname dibuka | Admin, SPG |

**LOG-01 – Riwayat.** Setiap buat, ubah, setujui, tolak, dan koreksi tercatat dengan pengguna, tanggal, jam, nilai sebelum dan sesudah, serta bukti (foto) bila ada. Riwayat tidak bisa diubah atau dihapus oleh siapa pun.

## Daftar layar

| Aplikasi | Peran | Layar |
| --- | --- | --- |
| Mobile | SPG | Login, Beranda (dashboard), Absen, Jadwal, Stok saya, Order, Laporan penjualan, Retur, Cuti/izin, Riwayat pengajuan, Profil |
| Mobile | Team Leader | Login, Beranda tim, Absen kunjungan, Rencana kunjungan, Detail SPG, MOU apotek baru, Cuti, Profil |
| Mobile / web | Kasir Apotek | Login, Menunggu persetujuan, Detail laporan (setuju/tolak + nama + foto), Riwayat |
| Web | Admin | Dashboard, Jadwal mingguan, Pemantauan absen, Stok pusat, Order masuk, Retur masuk, Stock opname, Rekap |
| Web + mobile | Super Admin | Dashboard, Persetujuan, Pengguna dan penempatan, Apotek, Produk dan target, Peta leader, Stock opname, Riwayat, Pengaturan (cuti, potongan, templat MOU) |

## Data utama

| Data | Isi pokok | Terhubung ke |
| --- | --- | --- |
| Pengguna | Nama, nomor HP, peran, status | Tim, Penempatan |
| Apotek | Nama, alamat, titik lokasi, radius, jam buka, status | Akun kasir, Penempatan, MOU |
| Penempatan | SPG, apotek (maks. 3 per SPG) | Pengguna, Apotek |
| Tim | Leader dan daftar SPG | Pengguna |
| Produk | Nama, kode, satuan, harga | Stok, Order, Penjualan |
| Stok pusat | Produk, jumlah, mutasi masuk/keluar | Produk, Order, Retur |
| Stok SPG | SPG, apotek, produk, jumlah | Penempatan, Produk |
| Absen | Pengguna, apotek, jenis (masuk/keluar), jam server, foto, koordinat, jarak | Pengguna, Apotek, Jadwal |
| Jadwal | SPG, apotek, tanggal, jam masuk/pulang atau libur | Pengguna, Apotek |
| Rencana kunjungan | Leader, tanggal, daftar apotek | Pengguna, Apotek |
| Order | SPG, apotek, produk, jumlah diminta/disetujui/diterima, status | Stok pusat, Stok SPG |
| Laporan penjualan | SPG, apotek, tanggal, produk dan jumlah, omzet, foto nota, status | Stok SPG, Persetujuan |
| Retur | SPG, apotek, produk, jumlah, alasan, status | Stok SPG, Stok pusat, Persetujuan |
| Persetujuan | Jenis, penyetuju (akun, nama kasir, foto), hasil, alasan, waktu | Penjualan, Retur, Order, Cuti, MOU |
| Stock opname | Jenis (bulanan atau serah terima), periode, SPG, apotek, stok sistem, stok fisik, selisih, koreksi, alasan | Stok SPG |
| Cuti/izin | Pengguna, jenis, tanggal, surat dokter, status, potongan | Pengguna, Pengaturan |
| MOU | Apotek, isi pernyataan, tanda tangan, foto, PDF, status | Apotek |
| Pengaturan | Jatah cuti, nominal potongan per hari, templat MOU, target | – |
| Riwayat | Pengguna, aksi, data, nilai sebelum/sesudah, waktu | Semua data |

## Kebutuhan non-fungsional

| Aspek | Kebutuhan |
| --- | --- |
| Platform | Mobile Android dan iOS, web untuk browser Chrome dan Safari versi terbaru |
| Koneksi | Online; bila sinyal putus saat mengirim, aplikasi menampilkan pesan dan tidak menyimpan data setengah jadi |
| Waktu | Semua jam (absen, persetujuan) memakai jam server, zona waktu WIB |
| Keamanan | Kata sandi terenkripsi, akses dicek di server per peran, sesi login berakhir setelah tidak aktif |
| Foto | Hanya dari kamera langsung, dikompres sebelum dikirim, disimpan minimal 2 tahun |
| Lokasi | Pengecekan lokasi palsu di Android dan iOS; akurasi GPS dicatat bersama koordinat |
| Kinerja | Absen dan pengiriman laporan selesai kurang dari 5 detik pada koneksi 4G normal |
| Perangkat | Berjalan lancar di HP Android kelas bawah yang dipakai SPG |
| Riwayat | Riwayat tidak bisa diubah atau dihapus |
| Cadangan data | Pencadangan otomatis harian |
| Kapasitas | Sekitar 40 pengguna internal dan 70–80 akun Kasir Apotek, dengan ruang tumbuh 2 kali lipat tanpa perubahan arsitektur |

## Rilis dan pertanyaan terbuka

**Usulan rilis**

1. Uji coba di 2–3 apotek dengan satu tim leader selama satu periode stock opname.
2. Perbaikan dari hasil uji coba.
3. Rilis ke semua apotek, didahului pelatihan singkat untuk SPG, leader, kasir, dan Admin.

**Tahap awal dianggap selesai jika**

- Semua user story di modul 1–10, kecuali JUL-02, lolos uji sesuai kriteria penerimaannya.
- Absen dengan radius 20 m sudah diuji di dalam gedung beberapa apotek.
- Satu siklus penuh (order, penjualan, retur, stock opname sampai status gajian) berjalan di aplikasi tanpa WhatsApp atau Excel.

**Keputusan Kak Tutut atas pertanyaan terbuka**

| Pertanyaan | Keputusan |
| --- | --- |
| Konfirmasi barang diterima oleh SPG (ORD-04) | Setuju dipakai |
| Izin sakit leader mengurangi jatah cuti 15 hari? | Ya |
| Bentuk MOU | E-meterai; tetap disediakan opsi berkas fisik bermeterai |
| Frekuensi laporan penjualan | Sekali sehari |
| Input dari foto nota (JUL-02) | Menyusul setelah input manual stabil |
| Saluran notifikasi | Hanya lewat aplikasi |
| Skala pengguna | 40 karyawan (2 Super Admin, 4 Admin, sisanya SPG, leader, kurir), 70–80 apotek |
| Serah terima stok (SO-05) | Setuju: stok sementara di Team Leader, selisih ditanggung SPG lama |
