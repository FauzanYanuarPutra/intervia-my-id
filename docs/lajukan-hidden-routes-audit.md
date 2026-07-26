# Lajukan Hidden Routes Audit

Status: 2026-05-28

## Prinsip

- Satu kebutuhan user harus punya satu pintu utama.
- Route lama boleh tetap hidup untuk kompatibilitas, tapi harus redirect ke pintu utama jika fungsinya duplikat.
- Halaman yang menambah trust, SEO, edukasi, transaksi, atau operasional boleh dipertahankan.
- Halaman yang hanya variasi nama tanpa flow jelas harus digabung atau diarahkan ke home/Explore.

## Route Yang Dipertahankan

- `/home`: beranda utama.
- `/explore`: satu pintu untuk kategori dan hasil pencarian supplier, jasa, produk, talent, lokasi, serta peluang.
- `/search`: route kompatibilitas yang selalu redirect ke `/explore` dengan parameter yang sama.
- `/umkm`: peta usaha fisik dan business directory.
- `/toko/[slug]`: detail toko/usaha fisik.
- `/content/[id]`: detail listing utama untuk produk, jasa, property, dan peluang.
- `/community`, `/community/groups/[slug]`: feed dan detail grup.
- `/reels`: video bisnis.
- `/learn`, `/learn/[slug]`: kelas, video, bacaan, dan materi creator dari database.
- `/education`: panduan trust/safety dan rujukan ke Learn.
- `/microgigs`: paket kerja kecil dan jasa cepat.
- `/crm`: pintu produk CRM/operasional.
- `/lainnya`: direktori halaman bernilai dan jalur canonical yang sengaja tidak ditaruh di navigasi utama.
- `/create`, `/create/[flow]`, `/create/[flow]/[listing]`: pintu utama membuat listing/request.
- `/my-projects`, `/my-listings`, `/transactions`, `/payments`, `/chat`, `/profile`, `/settings`: workspace login user.
- `/trust`, `/trust/[topic]`, `/support`, `/privacy`, `/terms`, `/cookie-policy`, `/contact`, `/about`: trust, legal, dan support.

## Route Duplikat Yang Redirect Ke Canonical

- `/marketplace` -> `/explore?type=product&q=supplier`
- `/listing/[id]` -> `/content/[id]`
- `/projects` -> `/my-projects`
- `/my-applications` -> `/dashboard`
- `/freelancers` -> `/explore?type=freelancer&q=umkm`
- `/freelancers/[slug]` -> `/profile/[slug]` jika profile publik tersedia.
- `/property` -> `/explore?type=property&q=lokasi%20jualan`
- `/property/[slug]` -> `/content/[slug]` atau detail property canonical jika sudah ada.
- `/jobs` -> `/explore?type=job&q=lowongan`
- `/jobs/[slug]` -> `/content/[slug]` atau job canonical.
- `/super-app/umkm` -> `/umkm`
- `/super-app/umkm/[slug]` -> `/toko/[slug]`

## Route Mati Yang Ditendang Ke Home

- `/pricing`
- `/blog`
- `/news`
- `/travel`
- `/wellness`
- `/vendor`
- `/hr`
- `/investor`
- `/analytics`
- `/charity`

## Route Legacy Yang Ditendang Ke Produk Aktif

- `/finance` -> `/payments`
- `/collaboration` -> `/chat`
- `/spatial` -> `/umkm`
- `/property/create` -> `/create/jual/properti`
- `/jobs/create` -> `/create/butuh/lowongan`
- `/profile/freelancer/create` -> `/profile/edit?focus=talent`
- `/company/create` -> `/usaha/onboarding`

## Route Usaha Internal

Route `/usaha/*` dan `/super-app/umkm/manage/*` sebaiknya diposisikan sebagai area owner/dashboard, bukan discovery publik.

- Public discovery tetap `/umkm` dan `/toko/[slug]`.
- Owner management tetap `/super-app/umkm/manage/*` atau diganti ke `/usaha/*`, pilih satu canonical.
- Jangan tampilkan dua navigasi owner sekaligus di menu utama.

## Learn Dan Education

- `/learn` sekarang menjadi produk creator-led learning: course, video, dan reading dari backend.
- `/learn/[slug]` menjadi detail materi, modul, dan lesson.
- `/education` tetap sebagai pusat panduan aman, trust, dan onboarding yang mengarahkan user ke Learn.

## Reward Harian

- Reward login harian harus muncul hanya untuk user login.
- Claim bersifat idempotent per hari.
- Reset mingguan memberi target ringan: hari ke-7 membuka voucher.
- Reward ini untuk retention, bukan SEO langsung. Dampak SEO datang dari konten Learn/community yang aktif dan indexable.

## Redirect Implementation

Redirect legacy dan dead route dipasang di `src/proxy.ts` agar berlaku sebelum auth check dan sebelum halaman 404/compile. Redirect wrapper page-level yang hanya melempar user ke canonical route sudah dihapus dari route build dan dicatat di `no-use.txt`.
