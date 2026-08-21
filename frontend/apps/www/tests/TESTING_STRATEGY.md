# Lajukan Frontend Test Strategy

Tujuan: jaga UI tetap sat-set untuk pengguna Indonesia, terutama mobile, visual scan, social/video discovery, trust signal, dan flow transaksi.

## Kenapa Playwright + Vitest

- Vitest dipakai untuk kontrak data, routing, z-index, dan business rules yang cepat.
- Playwright dipakai untuk flow nyata: viewport mobile, overflow, modal layer, search, community, reels, create, UMKM, profile.
- Cypress tidak ditambah karena Playwright sudah ada di repo, lebih ringan untuk multi-viewport dan API/UI smoke tanpa dependency baru.

## Perilaku Pengguna Indonesia Yang Jadi Dasar

- Mobile-first: DataReportal mencatat 212 juta pengguna internet Indonesia pada Januari 2025, dengan penetrasi 74.6%.
- Social-first: DataReportal mencatat 143 juta identitas pengguna social media di Indonesia pada Januari 2025.
- Video commerce penting: Google e-Conomy SEA 2024 mencatat video commerce sudah 20% dari GMV e-commerce SEA, naik lebih dari 4x dari 2022.
- Social/video brand research tinggi: Digital 2025 Indonesia menampilkan social media, video, dan messaging sebagai kanal penting untuk discovery.

Referensi:
- https://datareportal.com/reports/digital-2025-indonesia
- https://business.google.com/en-all/think/consumer-insights/e-conomy-sea-2024/
- https://wearesocial.com/wp-content/uploads/2025/02/Digital_2025_Indonesia_v02.pdf

## Test Yang Ditambahkan

- `src/lib/ux/indonesiaFlow.ts`
  - Kontrak flow utama Lajukan: home, search, community, reels, create listing, UMKM, profile.
  - Insight UX Indonesia yang harus tetap dijaga setiap CR.

- `src/lib/ux/indonesiaFlow.test.ts`
  - Memastikan flow utama eksplisit, route internal, label singkat, mobile-critical step ada.

- `src/components/constants/z-index.test.ts`
  - Memastikan modal selalu di atas bottom nav, header, popover, dan drawer.

- `tests/e2e/helpers/uxAssertions.ts`
  - Helper reusable untuk cek no horizontal overflow, rail card width konsisten, modal center, dan z-index.

- `tests/e2e/fixtures/lajukanFlowSeed.ts`
  - Fixture route dan API mock opsional untuk flow stabil saat data backend berubah.
  - Aktifkan dengan `E2E_USE_STABLE_FIXTURES=true`.

- `tests/e2e/lajukan-critical-flow.spec.ts`
  - Home mobile tidak overflow.
  - Card rail `Rekomendasi untuk Usaha` dan `Reels Inspirasi` width-nya konsisten.
  - Search dari home langsung ke hasil.
  - Modal compose community di atas chrome dan center di desktop.
  - Smoke mobile untuk `/home`, `/explore`, `/community`, `/reels`, `/create`, `/super-app/umkm`, `/profile`, `/my-projects`.

## Command

```bash
npm run test:unit
npm run test:flow
npm run test:ux
npm run test:e2e
```

Untuk pakai server yang sudah jalan:

```bash
E2E_USE_EXISTING_SERVER=true npm run test:flow
```

Dengan fixture stabil:

```bash
E2E_USE_EXISTING_SERVER=true E2E_USE_STABLE_FIXTURES=true npm run test:flow
```

Local Windows akan memakai Chrome sistem jika tersedia, supaya tidak wajib download browser Playwright. Video recording default mati biar tidak wajib download ffmpeg dan test lebih cepat. Override jika perlu:

```bash
E2E_BROWSER_CHANNEL=msedge npm run test:flow
E2E_VIDEO=true npm run test:flow
```

PowerShell:

```powershell
$env:E2E_USE_EXISTING_SERVER="true"; npm run test:flow
$env:E2E_USE_STABLE_FIXTURES="true"; npm run test:flow
$env:E2E_BROWSER_CHANNEL="chrome"; npm run test:flow
```

## CR Checklist Untuk UI Indonesia

- Mobile 360-430px tidak boleh horizontal overflow.
- First viewport harus punya search/menu/back/primary action yang jelas.
- Label aksi maksimal 1-3 kata kalau bisa.
- Card rail sejenis harus width konsisten, title panjang pakai clamp.
- Modal harus `z-index` di atas header, bottom nav, dan dropdown.
- Desktop modal harus center X/Y, kecuali sheet/detail panel yang memang sengaja side-panel.
- Skeleton harus mirip layout asli.
- Menu dan profile dropdown tidak boleh duplikat fungsi yang bikin bingung.
- Trust signal, rating, lokasi, harga, dan CTA harus dekat.
- Reels/video route harus punya jalan balik ke home dan aksi cepat.

## Notes Issue / Saran CR Berikutnya

- `data-testid` stabil sudah dipasang untuk home rail, community modal, search mobile, create form, reels action, dan bottom nav. Lanjutkan untuk CTA utama profile dan checkout/chat transaksi.
- Layer CSS global `ui-layer-*` sudah tersedia dan dipakai untuk header, bottom nav, local topbar, drawer, modal, toast, permission gate, dan not-found. Sisa `z-[...]` saat ini mostly local media/map stacking atau decorative positioning.
- Fixture E2E stabil sudah tersedia. Flow dynamic detail seperti `/content/:id`, `/profile/:slug`, `/super-app/umkm/:slug` masih butuh seed backend agar bisa dites sampai transaksi/chat tanpa skip.
- Perlu visual regression kecil untuk home/explore/community mobile karena targetnya visual scan cepat.
- Perlu API seed/reset khusus E2E agar flow register, upload listing, upload reels, chat, dan checkout bisa jalan end-to-end tanpa data manual.
- Security header Next.js sudah diperketat dengan CSP dasar, HSTS production, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`, COOP/CORP, dan `poweredByHeader: false`. Jika nanti ada payment/OAuth form external, cek ulang `form-action`.
