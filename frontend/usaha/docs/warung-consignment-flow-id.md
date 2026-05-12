# Flow Warung + Titip Jual

Dokumen ini merapikan flow bisnis untuk warung yang menjual stok sendiri sekaligus menerima titipan makanan, jajanan, atau produk rumahan dari warga sekitar.

## 1. Tujuan

- Owner warung bisa daftar usaha dan buka katalog dengan cepat.
- Penitip barang bisa tercatat jelas: barang apa, milik siapa, skema setoran bagaimana.
- Kasir tetap bisa jalan walau update stok tidak disiplin.
- Pembeli bisa lihat warung jual apa saja tanpa bercampur antara info publik dan catatan internal.

## 2. Model Produk

Setiap item di warung wajib punya dua klasifikasi:

- `sourceType=owned`
  Artinya stok milik warung sendiri.
- `sourceType=consignment`
  Artinya barang titipan dari orang lain.

Field minimum yang perlu ada:

- nama item
- kategori
- harga jual
- status stok ringkas
- jumlah stok opsional
- satuan stok
- batas stok tipis
- pemilik barang
- mode stok
- waktu update stok terakhir
- catatan / skema titip jual

## 3. Flow Utama

### A. Owner bikin warung

1. Daftar atau login.
2. Buat usaha baru dengan kategori warung.
3. Isi alamat, nomor WA, jam buka, dan lokasi.
4. Tambah minimal 3 item awal:
   - 1 stok warung sendiri
   - 1 barang titipan
   - 1 item yang paling sering ditanya pembeli

### B. Owner menambah barang titipan

1. Pilih `Sumber barang = Barang titipan`.
2. Isi nama penitip.
3. Isi skema titip jual:
   - bagi hasil
   - setor laku harian / mingguan
   - barang sisa dikembalikan atau tidak
4. Jika stok belum dihitung fisik, pilih `Mode stok = Estimasi`.
5. Sistem menaruh item ke checklist stok sampai ada pencocokan.

### C. Kasir buka shift

1. Buka halaman operasional.
2. Cek daftar item `tipis`, `habis`, atau `perlu cocokkan`.
3. Cocokkan fisik hanya untuk item bermasalah, bukan semua item.
4. Lanjut proses order.

### D. Tutup shift

1. Kasir cukup update item yang berubah cepat.
2. Barang titipan yang laku dicatat untuk settlement penitip.
3. Item dengan stok tidak pasti diubah ke `estimasi` agar besok tetap muncul di checklist.

## 4. Kalau User Malas Update Stok

Ini titik paling penting. Jangan memaksa semua stok harus selalu presisi karena warung kecil hampir pasti tidak disiplin update.

Strategi yang lebih realistis:

- Sistem menerima `mode stok`:
  - `manual`: stok baru dihitung.
  - `estimated`: angka hanya perkiraan.
- Item `estimated` otomatis diberi status `perlu cocokkan`.
- Dashboard operasional hanya menonjolkan item yang:
  - habis
  - tipis
  - estimasi
- Jadi user tidak perlu audit semua stok setiap saat.

Prinsipnya:

- lebih baik ada stok estimasi yang jujur
- daripada angka stok palsu yang terlihat rapi tapi menyesatkan

## 5. Aturan UX yang Disarankan

- Form tambah produk jangan terlalu panjang, tapi field titipan harus muncul saat relevan.
- Label publik untuk pembeli tetap sederhana:
  - tersedia
  - stok tipis
  - habis
- Detail internal seperti nama penitip dan skema setor hanya untuk owner/tim.
- Item titipan harus mudah difilter agar owner tahu mana yang harus disetor ke mitra.

## 6. Aturan Operasional

- Item titipan wajib punya `ownerLabel`.
- Item titipan tanpa update stok 1-2 hari jangan dianggap aman.
- Produk cepat laku seperti gorengan, kue basah, snack sekolah cocok default ke `estimated`.
- Produk stabil seperti minuman kemasan boleh tetap `manual`.

## 7. Backlog Lanjutan yang Sebaiknya Dibangun

- transaksi penjualan yang otomatis mengurangi stok
- settlement titip jual per penitip
- riwayat restock dan retur
- reminder stok per shift
- filter katalog publik: stok warung vs titipan
- laporan item paling laku dan item paling sering mismatch stok

## 8. Kesimpulan Flow

Flow yang sehat bukan mengejar stok selalu sempurna, tapi:

1. pisahkan stok warung dan titipan
2. tandai mana yang pasti dan mana yang estimasi
3. fokuskan kerja kasir ke item bermasalah
4. jaga katalog publik tetap jelas untuk pembeli

Dengan model ini, warung tetap bisa jalan walau owner dan kasir tidak rajin update setiap menit.
