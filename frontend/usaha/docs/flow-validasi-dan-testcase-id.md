# Validasi Flow Frontend Usaha

Dokumen ini dipakai untuk memvalidasi `frontend/usaha` pada `http://localhost:3003` agar flow-nya rapi, mudah diuji, dan mudah dipahami oleh tim Indonesia.

## 1. Tujuan

- Memastikan halaman penting bisa dibuka tanpa dead end.
- Memastikan flow `guest -> login/register -> buat usaha -> setup -> operasional` nyambung.
- Memastikan link buyer/public mengarah ke `http://localhost:3000`.
- Memastikan lokasi usaha bisa diisi dengan format yang cocok untuk Google Maps.
- Memastikan error session stale tidak lagi menghasilkan `500`.

## 2. Entry Point Utama

### 2.1 Root guest

- URL: `http://localhost:3003/`
- Kondisi:
  - belum login
  - tidak ada query `?business=...`
- Hasil yang diharapkan:
  - tampil launcher guest
  - ada CTA `Masuk`, `Daftar`, dan `Buat usaha`
  - ada jalur menuju bisnis demo

### 2.2 Root demo

- URL contoh: `http://localhost:3003/?business=warung-barokah`
- Kondisi:
  - belum login
  - business id cocok dengan seed
- Hasil yang diharapkan:
  - tampil dashboard demo
  - task, progress, dan CTA tetap muncul
  - route detail seperti `products` dan `operations` masih bisa dibuka

### 2.3 Create business

- URL: `http://localhost:3003/businesses/new`
- Hasil yang diharapkan:
  - halaman bisa dibuka baik saat guest maupun saat sudah login
  - form punya field identitas usaha dan owner
  - ada field lokasi untuk Google Maps
  - submit tidak boleh jatuh ke `500`

## 3. Use Case Utama

### Use Case 1: Guest daftar lalu bikin usaha pertama

1. User buka `/register`.
2. User isi nama, nomor HP, email.
3. Sistem membuat atau memperbarui account.
4. Session `usaha_session` ditulis.
5. User diarahkan ke `/businesses/new`.
6. User isi nama usaha, kategori, kota, alamat, telepon, owner, dan lokasi Google Maps.
7. Sistem membuat business.
8. User diarahkan ke `/?business=<id>&created=1`.
9. Dashboard menampilkan CTA setup berikutnya.

### Use Case 2: User lama login lalu lanjut setup

1. User buka `/login`.
2. User isi nomor HP yang sudah ada.
3. Sistem menulis session.
4. Jika user punya usaha, redirect ke dashboard usaha pertama.
5. Jika user belum punya usaha, redirect ke `/businesses/new`.
6. Dashboard menampilkan CTA yang sesuai kondisi bisnis:
   - info
   - products
   - operations
   - orders
   - team

### Use Case 3: User dengan session lama atau stale

1. Browser masih menyimpan cookie `usaha_session`.
2. In-memory store sudah reset atau account lama sudah tidak ada.
3. User buka `/businesses/new` dan submit form.
4. Sistem mendeteksi account dari cookie sudah tidak valid.
5. Sistem membersihkan session stale.
6. Sistem fallback ke pembuatan account inline jika data owner tersedia.
7. Request tidak lagi meledak `500`.

### Use Case 4: Owner menambahkan lokasi usaha

1. Owner buka halaman create business atau info usaha.
2. Owner isi:
   - alamat biasa
   - atau query/link Google Maps
3. Sistem menyimpan `locationQuery`.
4. Sistem membentuk `googleMapsUrl`.
5. Di halaman info dan buyer preview muncul tombol `Buka Google Maps`.

### Use Case 5: Owner buka buyer page publik

1. Owner buka `/businesses/[businessId]/buyer-page`.
2. Sistem menampilkan readiness bisnis.
3. Tombol publik mengarah ke storefront `localhost:3000`.
4. Tombol maps mengarah ke Google Maps jika lokasi tersedia.

## 4. Skenario Manual QA

### A. Validasi halaman dasar

| Halaman | URL | Expected |
| --- | --- | --- |
| Root guest | `http://localhost:3003/` | Launcher guest muncul |
| Login | `http://localhost:3003/login` | Form login muncul |
| Register | `http://localhost:3003/register` | Form daftar muncul |
| Create business | `http://localhost:3003/businesses/new` | Form bisnis muncul tanpa crash |
| Security | `http://localhost:3003/security` | Halaman security muncul |

### B. Validasi create business

| No | Langkah | Expected |
| --- | --- | --- |
| 1 | Buka `/businesses/new` | Halaman render normal |
| 2 | Isi field wajib | Tidak ada error validasi lokal yang aneh |
| 3 | Submit form | Request `POST /api/businesses` sukses |
| 4 | Cek response | Status `200`, ada `redirectTo` |
| 5 | Setelah redirect | Dashboard bisnis baru muncul |

### C. Validasi stale session

| No | Langkah | Expected |
| --- | --- | --- |
| 1 | Set cookie `usaha_session` ke `accountId` palsu | Browser tetap punya cookie |
| 2 | Submit create business | Tidak `500` |
| 3 | Cek network | Jika owner data lengkap, request sukses |
| 4 | Cek cookie | Session diperbarui atau dibersihkan |

### D. Validasi integrasi `3000`

| No | Langkah | Expected |
| --- | --- | --- |
| 1 | Buka buyer page bisnis | Ada tombol publik |
| 2 | Klik tombol buyer page | Arah ke `http://localhost:3000/...` |
| 3 | Cek slug/public url | Tidak lagi ke domain placeholder lama |

### E. Validasi lokasi dan Google Maps

| No | Langkah | Expected |
| --- | --- | --- |
| 1 | Isi lokasi di form bisnis | Data bisa disimpan |
| 2 | Buka halaman info usaha | Lokasi tampil |
| 3 | Klik `Buka Google Maps` | Tab baru membuka pencarian/tautan maps |

## 5. Test Case Per Flow

### TC-001 Guest launcher

- Precondition: tidak ada cookie `usaha_session`
- Step:
  1. buka `/`
- Expected:
  - launcher guest tampil
  - CTA auth tampil
  - tidak redirect liar

### TC-002 Register ke create business

- Precondition: nomor HP belum dipakai
- Step:
  1. buka `/register`
  2. submit form valid
- Expected:
  - status sukses
  - diarahkan ke `/businesses/new`
  - field owner terprefill

### TC-003 Create business sukses

- Precondition: halaman `/businesses/new` terbuka
- Step:
  1. isi semua field wajib
  2. submit
- Expected:
  - `POST /api/businesses` sukses
  - redirect ke root dashboard dengan query `created=1`
  - progress step pertama aktif

### TC-004 Create business dengan cookie stale

- Precondition: cookie `usaha_session` berisi `accountId` yang tidak ada
- Step:
  1. buka `/businesses/new`
  2. submit data valid
- Expected:
  - sistem tidak melempar `500`
  - session stale tidak memblokir flow
  - business tetap bisa dibuat jika owner info valid

### TC-005 Update info usaha + maps

- Precondition: bisnis sudah ada
- Step:
  1. buka `info`
  2. ubah data usaha
  3. isi `locationQuery`
  4. submit
- Expected:
  - update sukses
  - tombol preview Google Maps aktif
  - CTA dashboard bergeser ke langkah berikutnya bila info sudah lengkap

### TC-006 Add product

- Precondition: info usaha sudah cukup lengkap
- Step:
  1. buka `products`
  2. tambah 1 produk
- Expected:
  - produk muncul di daftar
  - `productsCount > 0`
  - buyer readiness ikut meningkat

### TC-007 Open operations

- Precondition: bisnis sudah punya info dan produk
- Step:
  1. buka `operations`
  2. set jadwal
  3. aktifkan `isOpen`
- Expected:
  - step `Usaha dibuka` selesai
  - CTA harian mengarah ke order/reservasi bila ada

### TC-008 Buyer page ke `3000`

- Precondition: bisnis punya slug/public URL
- Step:
  1. buka `buyer-page`
  2. klik tombol buyer page
- Expected:
  - link menuju storefront publik `localhost:3000`
  - bukan lagi ke domain placeholder eksternal

## 6. Rekomendasi UX

### Yang sudah benar

- Flow portal sudah berorientasi tahap, bukan sekadar menu.
- CTA utama sudah dihitung dari kondisi bisnis.
- Dashboard sudah cocok untuk owner Indonesia yang butuh arahan cepat.

### Yang bagus untuk dilanjutkan

- Tambahkan preview peta embed ringan di halaman info usaha.
- Tambahkan normalisasi link Google Maps agar link share pendek tetap terbaca.
- Tambahkan pesan error Indonesia yang lebih operasional:
  - `Sesi habis, silakan login lagi`
  - `Lokasi belum lengkap`
  - `Produk pertama belum ditambahkan`
- Tambahkan flow accept/reject invite agar step tim lebih nyata.
- Tambahkan mutasi order agar halaman orders tidak sekadar monitor.

## 7. Checklist Rilis Internal

- `GET /businesses/new` tidak error
- `POST /api/businesses` tidak error untuk session valid
- `POST /api/businesses` tidak error untuk session stale
- `publicUrl` bisnis mengarah ke `localhost:3000`
- `googleMapsUrl` terbentuk kalau lokasi diisi
- dashboard root menghitung CTA berikutnya dengan benar
- buyer page menampilkan link publik dan maps
- info usaha dapat menyimpan `locationQuery`
- dev stack `usaha` bisa dinyalakan dari compose dev tanpa error config
