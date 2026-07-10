# Lajukan Copywriting Style Guide

Dokumen ini menjadi pegangan untuk semua teks yang tampil di frontend Lajukan. Tujuannya sederhana: kata-kata di aplikasi harus terasa jelas, ramah, mudah dipahami, dan cocok untuk pelaku usaha Indonesia.

## Prinsip Utama

- Gunakan bahasa yang singkat dan langsung ke tindakan.
- Pakai `kamu` untuk komunikasi langsung ke pengguna.
- Hindari bahasa korporat seperti `melakukan pengisian`, `permintaan Anda`, atau `kriteria pencarian`.
- Hindari klaim yang tidak bisa dijamin, seperti `pasti aman`, `harga termurah`, `pasti laku`, atau `semua terpercaya`.
- Untuk keamanan dan transaksi, gunakan nada tegas tetapi tetap membantu.
- Bahasa Inggris harus natural, bukan terjemahan kata per kata dari Indonesia.

## Bahasa Indonesia

Gunakan gaya sehari-hari yang ringan:

- `Lagi memuat...`
- `Belum ada hasil yang cocok.`
- `Isi detailnya dulu, ya.`
- `Postingan sudah tayang.`
- `Ada kendala. Coba lagi.`

Hindari:

- `Silakan melakukan pengisian data.`
- `Tidak terdapat hasil sesuai kriteria.`
- `Terjadi kesalahan saat memproses permintaan Anda.`

## Bahasa Inggris

Gunakan gaya aplikasi modern:

- `Loading...`
- `No matching results yet.`
- `Add the details first.`
- `Your post is live.`
- `Something went wrong. Try again.`

Hindari kalimat yang terlalu formal atau literal:

- `There are no results that match your criteria.`
- `Please perform data filling in this form.`

## Istilah Utama

| Konsep | Indonesia | English |
| --- | --- | --- |
| Post | Postingan | Post |
| Create post | Buat postingan | Create post |
| Provider | Penyedia | Provider |
| Seeker | Pencari | Seeker |
| Offer | Tawaran | Offer |
| Request | Kebutuhan | Request |
| Product | Produk | Product |
| Service | Jasa | Service |
| Business place | Tempat usaha | Business place |
| Business opportunity | Peluang usaha | Business opportunity |
| Nearby businesses | Usaha sekitar | Nearby businesses |
| Community | Komunitas | Community |
| Reels | Video | Video |
| Save / Bookmark | Simpan | Save |
| Share | Bagikan | Share |
| Report | Laporkan | Report |
| Verified | Terverifikasi | Verified |
| Draft | Draf | Draft |
| Publish | Tayangkan | Publish |
| Published | Sudah tayang | Live |
| Expired | Sudah berakhir | Ended |
| Negotiable | Bisa nego | Negotiable |
| Free | Gratis | Free |

Gunakan `listing` hanya jika konteks teknis internal. Untuk UI, pilih `postingan`, `kebutuhan`, `tawaran`, `produk`, atau `jasa` sesuai konteks.

## Kapitalisasi

- Judul: pakai sentence case, bukan Title Case berlebihan.
- Kategori utama boleh title case karena nama kategori: `Mesin & Alat`, `Bahan Usaha`, `Tempat Usaha`.
- Tombol pendek: `Cari`, `Simpan`, `Lanjut`, `Buat postingan`.

## Pola CTA

CTA harus menjelaskan tindakan:

- `Cari`
- `Lihat semua`
- `Buat postingan`
- `Pasang kebutuhan`
- `Tawarkan sekarang`
- `Hubungi penyedia`
- `Buka chat`
- `Pakai lokasi saya`
- `Coba lagi`

Hindari:

- `Ya`
- `Oke`
- `Konfirmasi`
- `Klik di sini`
- `Proses`

## Placeholder

Placeholder harus memberi contoh:

- `Cari mesin, bahan, jasa, atau tempat...`
- `Contoh: freezer bekas Bandung`
- `Jelaskan kebutuhanmu secara singkat`

Hindari placeholder generik seperti `Masukkan judul` atau `Cari`.

## Empty State

Pola:

- Judul: `Belum ada postingan`
- Deskripsi: `Mulai dari kebutuhan atau tawaran pertamamu.`
- CTA: `Buat postingan`

Empty state harus memberi arah berikutnya, bukan hanya bilang data kosong.

## Error

Error harus menjelaskan masalah dan solusi:

- `Nomor telepon belum lengkap.`
- `Ukuran gambar terlalu besar. Maksimal 5 MB.`
- `Pesan belum terkirim. Coba lagi.`
- `Lokasi belum dipilih.`

Untuk error umum:

- ID: `Ada kendala. Coba lagi.`
- EN: `Something went wrong. Try again.`

## Success

Gunakan kalimat singkat:

- `Postingan sudah tayang.`
- `Profil sudah disimpan.`
- `Pesan terkirim.`
- `Draf tersimpan.`

## Konfirmasi Tindakan Berisiko

Pola:

- Judul: `Hapus postingan ini?`
- Deskripsi: `Postingan yang sudah dihapus tidak bisa dikembalikan.`
- Tombol aman: `Batal`
- Tombol destruktif: `Hapus postingan`

Jangan pakai `Ya` / `Tidak` untuk tindakan penting.

## Peringatan Keamanan

Lajukan membantu mempertemukan pengguna, tetapi tidak boleh mengesankan semua transaksi dijamin Lajukan.

Gunakan:

- `Cek profil dan detailnya sebelum lanjut.`
- `Jangan kirim uang sebelum identitas dan kebutuhannya jelas.`
- `Pembayaran dan kesepakatan dilakukan langsung antar pengguna.`

Hindari:

- `Pasti aman`
- `Dijamin terpercaya`
- `Transaksi dijamin Lajukan`

## Aturan i18n

- Semua teks penting harus punya versi `id` dan `en`.
- Struktur key `id` dan `en` harus sama.
- Hindari key terlalu umum seperti `title`, `text`, atau `button` tanpa konteks parent yang jelas.
- Jangan masukkan class, enum internal, URL, atau konten buatan pengguna ke file locale.
- Enum backend yang tampil ke pengguna harus dipetakan ke label ramah.

Gunakan `npm run i18n:audit` di `frontend/www` untuk mengecek struktur locale dan kandidat teks hardcoded.
