# Pola Chat WhatsApp untuk Lajukan

Status: riset dan audit implementasi 2026-08-13.

## Ringkasan keputusan

Lajukan sebaiknya mengambil **gramatika interaksi** yang sudah akrab dari WhatsApp, bukan menyalin merek, arsitektur keamanan, atau seluruh daftar fiturnya. Hasil audit mengarah ke empat keputusan utama:

1. Chat internal tetap menjadi kanal Lajukan yang menyimpan riwayat platform. Tombol WhatsApp tetap menjadi kanal eksternal untuk respons cepat. Keduanya tidak digabung menjadi satu riwayat semu.
2. Chat internal memakai pola `cache lokal -> validasi server sekali -> peristiwa realtime -> sinkronisasi terbatas saat fokus/koneksi pulih`. Polling riwayat tanpa henti bukan bagian dari lifecycle normal.
3. ScyllaDB tetap sumber kebenaran Chat dan PostgreSQL tetap sumber kebenaran Profile AI. `sessionStorage`/IndexedDB hanya lapisan percepatan yang terbatas, dapat kedaluwarsa, dan boleh gagal tanpa memutus layanan utama.
4. Lajukan tidak boleh mengklaim E2EE, centang dibaca per pesan, pesan hilang, `view once`, edit, hapus, arsip, mute, atau kunci chat sebelum ada kontrak backend dan model keamanan yang benar-benar menegakkan perilaku tersebut.

## Cara membaca dokumen ini

Dokumen ini sengaja membedakan tiga jenis pernyataan:

- **Fakta sumber**: perilaku yang dinyatakan oleh dokumentasi resmi Phoenix atau publikasi resmi Meta.
- **Fakta repo**: perilaku yang ditemukan pada surface kanonis Lajukan pada tanggal audit.
- **Inferensi desain**: pelajaran yang dapat diadaptasi untuk Lajukan. Inferensi bukan klaim bahwa arsitektur WhatsApp dan Lajukan sama.

Sumber eksternal dibatasi pada dokumentasi resmi Phoenix dan publikasi resmi Meta. Publikasi produk Meta menjelaskan fitur WhatsApp, tetapi bukan spesifikasi protokol lengkap dan bukan bukti bahwa fitur yang sama otomatis aman untuk Lajukan.

## Surface kanonis yang diaudit

- UI Chat: `frontend/www/src/app/[locale]/(app)/chat`.
- Lifecycle inbox: `frontend/www/src/context/ChatInboxContext.tsx`.
- Transport realtime: `frontend/www/src/lib/socket.ts` dan `frontend/www/src/lib/chat.ts`.
- Cache pesan Chat: `frontend/www/src/lib/chatMessageCache.ts`.
- BFF Chat: `frontend/www/src/app/api/chat/*`.
- Kontrak Chat: `services/chat_service/lib/chat_service_web`.
- Penyimpanan Chat: tabel ScyllaDB untuk room, pesan, inbox, unread, block, dan report.
- UI Profile AI: `frontend/www/src/app/[locale]/(app)/profile/ai/PersonalAiStudio.tsx`.
- Cache Profile AI: `frontend/www/src/lib/personal-ai/browserCache.ts`.
- Sumber kebenaran Profile AI: penyimpanan PostgreSQL melalui BFF `frontend/www/src/app/api/ai/personal/*`.
- Kanal WhatsApp: helper/provider, webhook, serta CTA profil/toko; ini bukan bagian dari room Chat internal.

## Temuan dari sumber resmi

### Realtime bukan berarti fetch tanpa henti

**Fakta sumber:** Phoenix membuat satu koneksi socket dan memultipleks banyak channel di atas koneksi tersebut. Channel yang terputus mencoba bergabung kembali dengan exponential backoff. Phoenix juga menutup subscription lama saat klien membuat subscription duplikat untuk topik yang sama. WebSocket adalah transport utama; Long Poll dapat dijadikan fallback setelah upaya WebSocket gagal. Satu request Long Poll dapat menunggu hingga batas waktu yang dikonfigurasi, dengan default klien 20 detik. Lihat [S1].

**Inferensi desain:**

- Kondisi sehat di browser adalah satu koneksi WebSocket dan satu subscription per topik aktif, bukan interval `GET messages`.
- Deretan request `/socket/...` dapat merupakan mekanisme Long Poll yang normal. Itu berbeda dari loop aplikasi seperti `GET messages -> POST read -> GET inbox -> render -> GET messages`.
- Long Poll harus fallback terukur, bukan dipaksa pada seluruh produksi jika jalur `wss://` tersedia.
- Callback React yang berubah pada setiap pembaruan state dapat menciptakan `leave/join` ulang. Efek socket harus bergantung pada identitas stabil dan selalu melepas handler lama dengan referensi yang tepat.

### Cache lokal adalah bootstrap, bukan sumber kebenaran

**Fakta sumber:** desain multi-device WhatsApp mengirim bundle riwayat terbaru ke perangkat pendamping, menyimpan database lokal pada perangkat tersebut, lalu menyinkronkan perubahan keadaan berikutnya. Desain resmi itu juga menggunakan sesi dan kunci kriptografi per perangkat. Lihat [S2].

**Inferensi desain:** bagian yang relevan untuk Lajukan adalah `recent local snapshot + incremental sync`, bukan protokol enkripsinya. Lajukan dapat memakai cache lokal untuk first paint dan ketahanan koneksi, tetapi:

- server tetap kanonis;
- cache harus dibatasi ukuran dan umur;
- data harus dipisahkan per pengguna;
- respons server harus menggantikan snapshot stale;
- retry pengiriman harus memakai identitas stabil;
- mekanisme ini tidak membuat Lajukan menjadi multi-device E2EE.

### Pola pemindaian yang akrab

**Fakta sumber:** WhatsApp memperkenalkan filter `All`, `Unread`, dan `Groups` untuk mempercepat pemindaian daftar chat. Lihat [S3].

**Inferensi desain:** `Semua`, `Belum dibaca`, dan `Grup` adalah pola sederhana yang layak dipertahankan di Chat Lajukan. Filter tersebut tidak perlu membawa merek, warna, ikon, atau terminologi WhatsApp lainnya.

### Voice note perlu lifecycle draft yang jelas

**Fakta sumber:** fitur voice message WhatsApp mencakup rekam di luar chat, jeda/lanjut rekaman, preview sebelum kirim, visualisasi waveform, melanjutkan posisi dengar, dan pilihan kecepatan playback. Lihat [S4].

**Inferensi desain:** nilai utamanya bukan tombol mikrofon, melainkan status eksplisit `merekam -> dijeda -> preview -> kirim/batal`, durasi yang terlihat, dan tidak pernah mengirim otomatis. Lajukan dapat menerapkan subset yang jujur; posisi dengar lintas sesi dan kecepatan playback memerlukan state tersendiri bila diprioritaskan.

### Fitur bisnis bekerja lebih baik sebagai objek terstruktur

**Fakta sumber:** WhatsApp Business mendukung QR untuk membuka chat dengan pesan awal, katalog/item yang dapat dibagikan, cart berisi beberapa item, serta pencarian bisnis di wilayah yang didukung. Lihat [S5], [S6], dan [S7].

**Inferensi desain:** untuk Lajukan, sebuah listing, kebutuhan, toko, order, transaksi, atau update pengiriman sebaiknya menjadi pesan terstruktur yang membawa ID kanonis dan deep link. Menempelkan harga atau status transaksi hanya sebagai teks bebas akan menyulitkan audit dan menjadi stale.

### Pengguna harus mengendalikan percakapan bisnis

**Fakta sumber:** Meta menjelaskan kontrol pengguna atas pesan bisnis, termasuk pilihan menerima pesan, memberi umpan balik, menghentikan percakapan, block/report, dan pembatasan pesan pemasaran. Meta juga menjelaskan bahwa percakapan dengan bisnis yang memakai penyedia hosting tertentu memiliki model privasi yang berbeda. Lihat [S8] dan [S9].

**Inferensi desain:** menekan CTA WhatsApp atau membuka Chat Lajukan tidak otomatis menjadi persetujuan untuk pesan promosi berulang. Lajukan perlu mencatat sumber consent, membedakan pesan transaksional dari pemasaran, menyediakan block/report, dan tidak menyembunyikan perubahan pemrosesan data di balik copy umum.

### Semantik edit dan privasi bukan dekorasi UI

**Fakta sumber:** WhatsApp memberi jendela 15 menit untuk edit dan menandai pesan sebagai edited. Chat Lock memindahkan percakapan ke area terlindungi perangkat. Disappearing messages memiliki durasi tertentu, sedangkan View Once membatasi media untuk satu kali pembukaan. Lihat [S10], [S11], [S12], dan [S13].

**Inferensi desain:** setiap fitur tersebut membutuhkan kontrak server, invalidasi cache, aturan lintas perangkat, audit, dan definisi kegagalan. Menambahkan menu tanpa enforcement akan memberi rasa aman palsu.

### Penyimpanan perlu kontrol pengguna

**Fakta sumber:** WhatsApp mengumumkan kontrol untuk meninjau dan menghapus berkas besar tanpa menghapus seluruh chat, serta peningkatan pemindahan riwayat antarplatform. Lihat [S14].

**Inferensi desain:** cache dan media Chat Lajukan sebaiknya kelak memiliki halaman penggunaan ruang, penghapusan cache lokal, dan pengelolaan media terpisah dari penghapusan riwayat server. `Hapus cache` tidak boleh disebut `Hapus chat`.

### AI bisnis tetap memerlukan fakta usaha dan alih kendali manusia

**Fakta sumber:** publikasi Business AI WhatsApp untuk usaha kecil di India menyebut jawaban yang memanfaatkan profil/katalog bisnis dan kemampuan pemilik usaha untuk mengambil alih percakapan. Peluncuran tersebut bersifat produk/wilayah tertentu, bukan standar universal WhatsApp. Lihat [S15].

**Inferensi desain:** Profile AI Lajukan sebaiknya di-grounding pada data usaha/listing yang diizinkan, menyatakan dirinya sebagai AI, dan selalu memberi jalur ke pemilik/manusia. Ini bukan alasan untuk menggabungkan Profile AI ke kanal WhatsApp atau mengklaim kemampuan WhatsApp Business AI.

### Riwayat anggota grup baru harus eksplisit

**Fakta sumber:** Group Message History WhatsApp membagikan 25–100 pesan terbaru hanya melalui tindakan eksplisit, menampilkan pesan itu secara berbeda, memberi tahu grup, dan memungkinkan admin mematikan fitur. Lihat [S16].

**Inferensi desain:** keanggotaan baru tidak boleh otomatis membuka arsip sebelum waktu bergabung. Lajukan sekarang membatasi pembacaan grup dengan `joined_at`. Fitur berbagi riwayat lama kelak harus menjadi grant eksplisit yang terukur dan transparan, bukan menghapus batas tersebut.

### Mode AI sementara adalah kontrak data, bukan toggle kosmetik

**Fakta sumber:** Meta mendeskripsikan Incognito Chat untuk Meta AI sebagai percakapan sementara yang tidak disimpan dan hilang secara default, dengan pemrosesan di lingkungan yang mereka sebut aman. Lihat [S17].

**Inferensi desain:** Lajukan belum memiliki kontrak no-history tersebut dan tidak boleh memakai klaim yang sama. Mode sementara baru sah bila thread, pesan, memory, cache browser, media, analytics isi, serta retensi provider benar-benar tidak menyimpan percakapan sesuai kebijakan yang dinyatakan.

### Responsif adalah bagian dari correctness

**Fakta sumber:** WCAG 2.2 menetapkan target minimum 24×24 CSS pixel atau spacing ekuivalen untuk pointer input. Lihat [S18]. Produk ini memakai baseline internal 44×44 untuk kontrol percakapan utama agar lebih nyaman pada ponsel.

**Inferensi desain:** safe area, keyboard/visual viewport, fokus dialog, reduced motion, dan ketersediaan fitur pada 320–360 px harus diuji sebagai perilaku produk. Menyembunyikan tombol Kamera/Stiker tanpa jalur pengganti adalah kehilangan fitur, bukan penyederhanaan responsif.

## Akar loop yang ditemukan di Lajukan

Bagian ini adalah **fakta repo**, bukan temuan dari Meta.

1. Penandaan room sebagai dibaca sebelumnya menghapus `unread_counters`, tetapi tidak membersihkan `user_room_state.unread_count`.
2. Endpoint inbox mengambil nilai maksimum dari dua proyeksi tersebut. Akibatnya room yang baru ditandai dibaca dapat muncul lagi sebagai belum dibaca.
3. Halaman pesan menandai room dibaca lalu meminta inbox lagi. Perubahan state inbox mengubah identitas callback context, memicu ulang efek pemuatan pesan dan efek socket.
4. Lookup profil DM yang gagal tetap menulis object state baru tanpa negative cache/backoff. Efek yang bergantung pada object itu dapat berjalan lagi walaupun tidak ada hasil baru.
5. Produksi pernah memaksa Long Poll. Request socket yang memang berulang karena sifat Long Poll bercampur dengan loop fetch aplikasi dan terlihat seperti satu masalah yang sama.
6. Join channel meminta riwayat sementara halaman juga mengambil riwayat lewat HTTP; payload riwayat join tidak dipakai UI. Rejoin karena efek yang tidak stabil berarti pembacaan Scylla yang mubazir ikut berulang.

Perbaikan batch 2026-08-13 memutus rantai tersebut dengan:

- membersihkan kedua proyeksi unread dalam satu operasi domain `UnreadState.clear`, dengan timestamp cell agar pesan yang datang setelahnya dapat membuat room unread lagi;
- membuat callback inbox stabil, memakai referensi room terbaru, menggabungkan request inbox yang sedang berjalan, dan mencegah penulisan state bila signature tidak berubah;
- memberi negative cache/backoff pada lookup profil DM;
- tidak meminta/mengirim history yang tidak digunakan saat channel join;
- menghapus polling riwayat 3,5 detik dan memakai revalidasi terbatas saat focus/visibility/reconnect;
- menjadikan WebSocket jalur utama dan Long Poll fallback terbatas/opt-in;
- menghidrasi UI dari cache lokal terbatas sebelum revalidasi server;
- menyediakan mode offline read-only hanya untuk room yang sudah ada pada inbox user aktif dan gangguan jaringan/5xx, tanpa socket, read receipt, upload, panggilan, AI, atau mutation sampai membership kembali tervalidasi; 401/403/404 tidak pernah dilonggarkan menjadi akses cache;
- membatasi history grup dengan `joined_at`, termasuk ketika memakai cursor, dan fail closed bila metadata akses tidak lengkap;
- membuat consent konteks Chat AI berlaku hanya pada room/sesi aktif, tidak menyimpan instruksi bebas di `localStorage`, dan membatalkan respons AI saat room berubah;
- mengisolasi draft teks/media Profile AI per agent+thread, membuat create/send/upload single-flight, dan mencegah respons memory agent lama menimpa agent baru;
- menghentikan penghapusan diam-diam thread/pesan kanonis Profile AI: write yang melampaui batas sekarang ditolak atomik dengan error kuota terstruktur, sementara pengguna dapat menghapus thread secara eksplisit dari UI.

## Lifecycle realtime dan cache yang menjadi acuan

```text
Buka room
  -> baca snapshot lokal milik user+room
  -> tampilkan snapshot jika valid
  -> satu request revalidasi ke server kanonis
  -> rekonsiliasi/deduplikasi berdasarkan ID pesan dan client_ref
  -> dengarkan event Phoenix pada satu channel aktif
  -> simpan snapshot baru secara debounce
  -> saat focus/reconnect, lakukan satu sinkronisasi terbatas
```

Aturan lifecycle:

1. **Hydrate:** cache hanya mempercepat tampilan awal. Loading tidak perlu menutupi snapshot yang valid.
2. **Revalidate:** satu pemuatan kanonis tetap dilakukan. Request yang sama harus single-flight, dapat dibatalkan, dan hasil room/user lama tidak boleh menimpa room/user baru.
3. **Subscribe:** satu socket memultipleks channel. Satu topik hanya memiliki satu subscription aktif.
4. **Apply event:** pesan baru dan pembaruan inbox mengubah state in-memory; refetch inbox akibat burst event didebounce.
5. **Acknowledge:** aksi read optimistis hanya mengubah room lokal yang sedang dibuka, lalu server membersihkan semua proyeksi unread terkait. Read tidak memicu rantai refetch baru.
6. **Persist snapshot:** penulisan cache didebounce dan dinormalisasi. Pesan optimistis yang tertinggal setelah reload kembali sebagai `failed`, bukan `sending` selamanya.
7. **Recover:** focus, visibility, atau koneksi pulih dapat memicu satu sinkronisasi terbatas. Tidak ada interval riwayat pada kondisi koneksi stabil.
8. **Fallback:** Long Poll boleh digunakan jika WebSocket gagal atau operator mengaktifkannya secara eksplisit. Telemetri harus membedakan transport fallback dari fetch endpoint bisnis.

## Batas penyimpanan saat ini

| Data               | Sumber kebenaran                               | Cache browser batch ini               | Batas dan perilaku                                                                                         |
| ------------------ | ---------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Daftar inbox Chat  | Scylla `user_room_state` dan unread projection | `sessionStorage`, key per user        | TTL 5 menit, paling banyak 30 room, payload maksimal sekitar 96 KB; dihapus saat sesi user context dilepas |
| Pesan Chat terbaru | Scylla `messages`                              | IndexedDB `lajukan-chat-cache`        | TTL 7 hari, 100 pesan per room, 24 room per user; dedupe, normalisasi, dan best-effort                     |
| Agent Profile AI   | PostgreSQL                                     | IndexedDB `lajukan-personal-ai-cache` | TTL 7 hari, maksimal 12 agent; hanya field display yang di-allowlist                                       |
| Thread Profile AI  | PostgreSQL                                     | IndexedDB yang sama                   | Hingga 80 thread per daftar agent, maksimal 12 daftar thread per user                                      |
| Pesan Profile AI   | PostgreSQL                                     | IndexedDB yang sama                   | 50 pesan terbaru per thread, maksimal 16 thread pesan per user                                             |

Konsekuensi penting:

- Cache browser menyimpan konten plaintext di profil browser dan **bukan E2EE**.
- Key per user mencegah state user A tampil sebagai state user B di aplikasi. Batch ini menghapus cache Chat/Profile AI pada logout/pergantian akun, menutup socket client saat logout, serta menyediakan kontrol `Hapus cache`/`Hapus data AI lokal`. Purge ketika akses share dicabut masih perlu ditambahkan.
- Cache Profile AI sengaja tidak menyimpan prompt pemilik, konfigurasi provider, memory summary, builder config, atau hidden quick-action instruction. Konten percakapan yang diizinkan tetap data sensitif.
- Kegagalan quota/privacy-mode IndexedDB tidak boleh membuat Chat/Profile AI gagal; aplikasi kembali ke server. Sebaliknya, batas penyimpanan kanonis harus menghasilkan error eksplisit dan tidak pernah memangkas riwayat diam-diam.
- TTL cache bukan kebijakan retensi server. Edit, delete, disappearing message, dan pencabutan akses kelak wajib mengirim invalidasi/tombstone agar salinan lokal ikut hilang.
- Cache Profile AI tidak membuat inference AI tersedia offline. Ia hanya mempercepat daftar dan riwayat yang pernah diterima browser.

## Matriks fitur dan keputusan

Status:

- **Ada**: kontrak dan UI kanonis sudah ditemukan.
- **Batch ini**: diperkuat dalam pekerjaan 2026-08-13.
- **Parsial**: primitive ada, tetapi semantik lengkap belum ada.
- **Perlu backend**: jangan ditampilkan sebagai fitur sampai kontrak kanonis tersedia.
- **Tidak diklaim**: sengaja ditolak sebagai copy/claim karena arsitektur Lajukan belum membuktikannya.

| Pola/fitur                            | Fakta sumber atau tujuan                                                             | Status Lajukan                    | Keputusan                                                                                                                             |
| ------------------------------------- | ------------------------------------------------------------------------------------ | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| Daftar percakapan dan filter          | WhatsApp memiliki All/Unread/Groups [S3]                                             | **Ada**                           | Pertahankan `Semua`, `Belum dibaca`, `Grup`; gunakan identitas visual Lajukan                                                         |
| Composer multiline, reply, attachment | Gramatika percakapan umum                                                            | **Ada**                           | Pertahankan pada surface Chat kanonis, jangan buat flow kedua                                                                         |
| Voice-note draft dan preview          | Lifecycle voice resmi mencakup pause, preview, waveform, dan playback controls [S4]  | **Ada/Parsial**                   | Jaga kirim eksplisit; tambah resume playback/speed hanya jika state dan aksesibilitas diuji                                           |
| Satu koneksi realtime                 | Phoenix memultipleks channel pada satu koneksi [S1]                                  | **Batch ini**                     | WebSocket utama; satu subscription per topik; cleanup handler wajib                                                                   |
| Long Poll fallback                    | Phoenix mendukung fallback terukur dan request tunggu panjang [S1]                   | **Batch ini**                     | Jangan paksa secara global; monitor alasan fallback                                                                                   |
| Cache inbox/pesan                     | Recent local DB + sync adalah pola yang dapat diinferensikan dari multi-device [S2]  | **Batch ini**                     | Cache terbatas, user-scoped, stale-while-revalidate; server tetap kanonis                                                             |
| Deduplikasi request                   | Mencegah lifecycle UI membuat request identik                                        | **Batch ini**                     | Single-flight, abort stale request, jangan set state bila signature sama                                                              |
| Idempotensi send                      | Retry transport harus konvergen                                                      | **Ada**                           | `client_ref` stabil tetap wajib pada WebSocket dan HTTP                                                                               |
| Unread room                           | Room read adalah proyeksi state, bukan read receipt per pesan                        | **Batch ini**                     | Bersihkan counter dan inbox projection bersama; pesan yang lebih baru boleh menaikkan unread                                          |
| Delivered/read per pesan              | Membutuhkan recipient cursor/receipt yang kanonis                                    | **Perlu backend**                 | Jangan tampilkan centang delivered/read dari status lokal `sent`                                                                      |
| Typing/presence                       | Phoenix menyediakan lifecycle Presence [S1]                                          | **Ada/Parsial**                   | Label hanya berdasarkan event server dengan timeout; hindari klaim `online` permanen                                                  |
| Block dan report                      | Pengguna WhatsApp memiliki kontrol bisnis termasuk block/report [S8]                 | **Ada**                           | Pertahankan enforcement server dan audit moderasi, bukan UI-only                                                                      |
| Edit pesan                            | WhatsApp memberi batas 15 menit dan label edited [S10]                               | **Perlu backend**                 | Definisikan otorisasi, window, versi, event, audit, dan invalidasi cache terlebih dahulu                                              |
| Hapus untuk saya/semua                | Bukan sekadar menghilangkan bubble lokal                                             | **Perlu backend**                 | Butuh tombstone, otorisasi, kebijakan attachment, dan sinkronisasi lintas perangkat                                                   |
| Archive, mute, pin                    | State organisasi percakapan                                                          | **Perlu backend**                 | Primitive `is_pinned` pada projection bukan kontrak mutasi; jangan simulasikan di browser                                             |
| Disappearing messages                 | WhatsApp memiliki durasi pesan hilang [S12]                                          | **Perlu backend**                 | Butuh TTL kanonis, worker, cache tombstone, aturan backup/audit, dan copy yang jujur                                                  |
| View Once                             | WhatsApp membatasi media untuk satu pembukaan [S13]                                  | **Perlu backend**                 | Butuh token akses sekali pakai dan enforcement media; jangan mengandalkan flag UI                                                     |
| Chat Lock                             | WhatsApp mengikat perlindungan ke autentikasi perangkat [S11]                        | **Perlu backend/perangkat**       | Jangan klaim lock hanya karena route disembunyikan                                                                                    |
| E2EE dan verifikasi perangkat         | WhatsApp multi-device menggunakan sesi/kunci per perangkat [S2]                      | **Tidak diklaim**                 | Perlu protokol kunci, identitas device, recovery, security review, dan UX verifikasi tersendiri                                       |
| Storage manager                       | WhatsApp dapat mengelola berkas besar tanpa menghapus seluruh chat [S14]             | **Batch ini/Parsial**             | Kontrol cache lokal sudah terpisah dan jujur; penggunaan ruang, pengelolaan media, dan penghapusan history server tetap roadmap       |
| History anggota grup baru             | WhatsApp membagikan 25–100 pesan lewat grant eksplisit dan transparan [S16]          | **Batch ini/Parsial**             | History sebelum `joined_at` ditolak; explicit history grant belum tersedia                                                            |
| Offline snapshot                      | Cache boleh membantu saat jaringan terputus tanpa menjadi sumber otorisasi           | **Batch ini**                     | Hanya room pada inbox user aktif; read-only sampai server memvalidasi ulang; cold-start auth offline tidak diklaim                    |
| Responsif 320–360 px                  | Target pointer dan visual viewport adalah correctness [S18]                          | **Batch ini/Parsial**             | Safe area, composer bounded, menu tidak terpotong, dan Kamera/Stiker punya compact tray; matrix Playwright keyboard/focus tetap perlu |
| Listing/order/transaction card        | Katalog/cart menunjukkan nilai objek bisnis terstruktur [S5][S6]                     | **Ada/Parsial**                   | Gunakan ID dan status kanonis; jangan salin harga/status menjadi teks bebas saja                                                      |
| CTA WhatsApp dengan konteks           | QR dapat membuka chat dengan pesan awal dan katalog [S5]                             | **Ada/Parsial**                   | Link/pesan awal boleh ada jika nomor bersumber dan consent; QR serta analytics perlu kontrak konsisten                                |
| Pencarian bisnis                      | WhatsApp mendukung discovery bisnis di pasar tertentu [S7]                           | **Ada lewat Explore, bukan Chat** | Jangan buat directory baru di Chat; deep-link hasil Explore ke Chat/WhatsApp yang disetujui                                           |
| Pesan bisnis proaktif                 | Meta menekankan opt-in, feedback, stop, block/report, dan limits [S8]                | **Perlu kebijakan**               | CTA/contact click bukan consent pemasaran dan bukan lead CRM otomatis                                                                 |
| Profile AI chat/builder               | Business AI resmi mengilustrasikan grounding profil/katalog dan owner takeover [S15] | **Ada/Batch ini**                 | Profile AI tetap produk Lajukan, berlabel AI, review-first, dan punya jalur manusia                                                   |
| Memory penerima Profile AI            | Personalisasi menyimpan data penerima                                                | **Ada/Batch ini**                 | Consent per `(agent, viewer)`; pilihan owner tidak boleh memberi consent atas nama penerima                                           |
| Cache Profile AI                      | Bootstrap cepat tanpa refetch berulang                                               | **Batch ini**                     | Cache DTO allowlist; Postgres kanonis; jangan cache hidden instruction/memory/provider config                                         |
| Draft Profile AI lintas thread        | Teks/media tidak boleh bocor ke konteks lain                                         | **Batch ini**                     | Draft dipisahkan per agent+thread; hasil upload/transkripsi stale ditolak                                                             |
| AI temporary/no-history               | Meta mengumumkan Incognito Chat untuk Meta AI [S17]                                  | **Perlu backend/privacy review**  | Jangan menambah toggle sebelum seluruh write, cache, memory, media, analytics, dan retensi provider benar-benar dinonaktifkan         |

## Privacy, consent, dan batas klaim

### Chat internal

- Auth dan membership diperiksa server-side untuk data room yang dilindungi.
- Log tidak boleh berisi token, nomor penuh, atau body percakapan yang tidak diperlukan.
- Isi cache lokal adalah data pribadi. Risiko perangkat bersama harus dijelaskan dan diberi kontrol penghapusan.
- `Terkirim ke server` tidak sama dengan `diterima perangkat` atau `dibaca penerima`.
- Koneksi terenkripsi melalui TLS tidak sama dengan end-to-end encryption.

### WhatsApp sebagai kanal eksternal

- Nomor hanya boleh ditampilkan jika memiliki field sumber/consent yang dapat diaudit.
- Pesan awal harus relevan dengan listing/toko dan dapat diedit pengguna sebelum berpindah aplikasi.
- Click tracking menyimpan event minimum, bukan nomor mentah di log analytics.
- Setelah pengguna berpindah ke WhatsApp, retensi dan pemrosesan mengikuti pihak yang terlibat di kanal tersebut; UI Lajukan tidak boleh menyiratkan bahwa riwayat itu tersimpan sebagai Chat Lajukan.
- CTA WhatsApp bukan persetujuan untuk pesan promosi berulang.

### Profile AI

- Profile AI selalu memperkenalkan diri sebagai AI dan mengingatkan bahwa jawaban dapat salah.
- Shared agent tidak membuka owner prompt, hidden instruction, provider config, atau memory owner ke penerima.
- Memory penerima default off dan consent-nya terpisah dari `memory_enabled` milik pembuat agent.
- AI tidak mengirim, mempublikasikan, menghubungkan pemasok, atau menyelesaikan transaksi tanpa tindakan konfirmasi manusia.
- Alih kendali ke owner/manusia harus jelas; jangan menyamar sebagai owner yang sedang mengetik.

## Kriteria penerimaan operasional

Perubahan lifecycle dianggap benar bila pengujian dua browser/tab menunjukkan:

1. Membuka satu room menghasilkan paling banyak satu fetch riwayat awal dan satu acknowledge read yang diperlukan; tidak ada fetch riwayat berulang saat koneksi stabil dan tidak ada pesan baru.
2. Network panel menunjukkan satu koneksi WebSocket `101` pada jalur normal. Jika Long Poll aktif, request berulang hanya milik transport socket, bukan loop endpoint messages/inbox/read.
3. Render ulang atau perubahan unread tidak membuat subscription room yang sama terus `leave/join`.
4. Lookup profil yang menghasilkan `404`/gagal tidak langsung diulang pada setiap render.
5. Dalam sesi autentikasi yang masih aktif, room yang sudah ada di inbox dapat menampilkan snapshot lokal secara read-only ketika jaringan putus; setelah online, satu validasi/revalidasi menggantinya dengan data kanonis. Cold reload tanpa auth server tidak diklaim.
6. Pindah room/user tidak membiarkan respons lama menimpa state baru dan tidak menampilkan cache milik akun lain.
7. Urutan `unread=1 -> buka room -> 0 -> pesan baru datang -> 1` bertahan pada refresh dan dua klien.
8. Retry send dengan `client_ref` sama membuat satu pesan kanonis, bukan duplikat.
9. Kegagalan IndexedDB/sessionStorage tidak menghalangi Chat atau Profile AI mengambil data server.
10. Tidak ada copy E2EE, delivered/read, disappearing, atau privacy lock tanpa bukti kontrak terkait.

Telemetri minimum yang disarankan:

- jumlah `messages_fetch` dan `inbox_fetch` per room-open;
- alasan revalidasi: `initial`, `focus`, `reconnect`, atau `event`;
- transport aktif: WebSocket atau Long Poll serta alasan fallback;
- jumlah join/leave per topik;
- cache hit, miss, stale, quota/error tanpa isi pesan;
- latency cache-to-first-paint dan server-to-canonical-paint;
- duplicate `client_ref`, unread mismatch, serta projection repair count.

## Roadmap berurutan

### P0 — stabilitas dan penghentian loop

- Pertahankan perbaikan dua proyeksi unread, callback stabil, request single-flight, negative lookup cache, WebSocket-first, dan penghapusan history polling.
- Jalankan uji dua-klien untuk reconnect, read, send retry, block/report, serta pergantian room cepat.
- Tambahkan regression test untuk effect dependency agar render state tidak membuat join/fetch baru.

### P1 — ketahanan data dan privacy cache

- Pertahankan regression test purge logout/pergantian akun dan kontrol hapus lokal, lalu tambahkan purge ketika akses share dicabut.
- Tambahkan storage usage view yang membedakan cache lokal, attachment lokal, dan riwayat server.
- Ganti batas kanonis Profile AI saat ini dengan pagination dan kebijakan quota/retensi yang dapat dikonfigurasi; pertahankan prinsip bahwa penghapusan thread selalu eksplisit, bukan side effect dari write baru.
- Selesaikan pagination lintas bucket bulan Scylla dengan bucket manifest/index, cursor, limit+1, dan backfill; jangan scan partition tidak terbatas.
- Tambahkan outbox/reconciler untuk memperbaiki inbox/unread/broadcast bila proyeksi gagal setelah pesan kanonis tersimpan.

### P2 — kontrak percakapan yang belum lengkap

- Rancang receipt cursor per penerima sebelum UI centang delivered/read.
- Tambahkan edit/delete sebagai mutation berversi dengan policy waktu, audit, event realtime, dan cache invalidation.
- Tambahkan archive/mute/pin sebagai state server per pengguna dengan index query inbox yang sesuai.
- Perkuat workflow moderasi report, SLA, status transition, dan ownership operasional.

### P3 — fitur privacy lanjutan bila terbukti dibutuhkan

- Prioritaskan kebutuhan pengguna dan threat model sebelum disappearing messages, View Once, atau Chat Lock.
- Definisikan perilaku screenshot, download, backup, cache, attachment, perangkat offline, legal hold, serta kegagalan sinkronisasi.
- E2EE memerlukan ADR keamanan terpisah; tidak boleh masuk sebagai perubahan copy/UI.

### P4 — bisnis dan Profile AI

- Jadikan listing, kebutuhan, toko, order, transaksi, dan delivery update sebagai kartu terstruktur yang membaca status kanonis.
- Lengkapi consent/sumber nomor, event CTA WhatsApp, pesan awal yang dapat diedit, serta fallback desktop/mobile.
- Ground Profile AI hanya pada data profil/katalog/listing yang diizinkan, tampilkan provenance fakta, dan sediakan eskalasi manusia.
- Ukur keberhasilan kanal secara terpisah: chat start/reply/outcome untuk Chat internal dan contact click/return outcome untuk WhatsApp.

## Hal yang sengaja tidak dilakukan

- Tidak membuat service, route, atau UI Chat kedua.
- Tidak mengimpor branding, ikon, copy, atau klaim kepemilikan WhatsApp.
- Tidak menyatukan riwayat WhatsApp dengan Chat internal tanpa integrasi provider, consent, dan kontrak retensi yang sah.
- Tidak menganggap cache browser sebagai database kanonis, backup, atau bukti delivery/read.
- Tidak menyebut Lajukan E2EE hanya karena memakai HTTPS/WSS atau penyimpanan lokal.
- Tidak menambahkan menu fitur yang belum mempunyai enforcement backend.
- Tidak memperlakukan Profile AI sebagai WhatsApp Business AI atau sebagai manusia pemilik usaha.

## Sumber resmi

- **S1 — Phoenix Channels JavaScript client:** https://phoenix.hexdocs.pm/js/index.html
- **S2 — Meta Engineering, WhatsApp multi-device:** https://engineering.fb.com/2021/07/14/security/whatsapp-multi-device/
- **S3 — Meta, WhatsApp Chat Filters:** https://about.fb.com/news/2024/04/whatsapp-chat-filters/
- **S4 — Meta, Voice Message Features:** https://about.fb.com/news/2022/03/new-voice-message-features-on-whatsapp/
- **S5 — Meta, QR codes and catalog links:** https://about.fb.com/news/2020/07/connect-with-businesses-on-whatsapp/
- **S6 — Meta, WhatsApp carts:** https://about.fb.com/news/2020/12/making-it-easier-to-shop-on-whatsapp-with-carts/
- **S7 — Meta, Find and Buy from Businesses:** https://about.fb.com/news/2022/11/find-and-buy-from-businesses-on-whatsapp/
- **S8 — Meta, controls for business chats:** https://about.fb.com/news/2025/04/ways-to-manage-your-businesses-chats-on-whatsapp/
- **S9 — Meta, privacy of hosted business conversations:** https://about.fb.com/news/2020/10/privacy-matters-whatsapp-business-conversations/
- **S10 — Meta, edit messages:** https://about.fb.com/news/2023/05/edit-whatsapp-messages/
- **S11 — Meta, Chat Lock:** https://about.fb.com/news/2023/05/whatsapp-chat-lock/
- **S12 — Meta, default disappearing messages and durations:** https://about.fb.com/news/2021/12/whatsapp-default-disappearing-messages-multiple-durations/
- **S13 — Meta, View Once media:** https://about.fb.com/news/2021/08/view-once-photos-and-videos-on-whatsapp/
- **S14 — Meta, storage and account switching features:** https://about.fb.com/news/2026/03/whatsapp-new-features-simplify-storage-switch-accounts/
- **S15 — Meta, Business AI for small businesses in India:** https://about.fb.com/news/2026/05/introducing-business-ai-on-whatsapp-for-small-businesses-in-india/
- **S16 — WhatsApp, Group Message History:** https://blog.whatsapp.com/introducing-group-message-history-a-more-private-way-to-catch-up-in-group-chats
- **S17 — Meta, Incognito Chat for Meta AI:** https://about.fb.com/news/2026/05/incognito-chat-whatsapp-meta-ai/
- **S18 — W3C, WCAG 2.2 Target Size (Minimum):** https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html
