# Lajukan Usaha Merchant OS Redesign — Design

## Purpose
Rombak total `usaha.lajukan.com` menjadi Merchant OS yang terasa cepat, sederhana, dan familiar untuk operator UMKM Indonesia. Inspirasi interaksi utama datang dari pola aplikasi merchant Indonesia seperti GoFood Merchant/GoBiz dan POS majoo: pekerjaan harian harus langsung terlihat, keputusan per layar sedikit, dan detail teknis baru muncul saat dibutuhkan.

Redesign ini mengganti hierarchy, layout, navigation, visual system, serta pola interaksi shared UI. Existing route, permission, server contract, data ownership, dan canonical business behavior tetap dipertahankan kecuali perubahan kecil yang benar-benar diperlukan untuk mendukung presentasi.

Spec ini supersede arah UI umum pada `2026-08-23-usaha-business-os-ui-overhaul-design.md` untuk surface `frontend/apps/usaha`.

## Product position
- `www.lajukan.com`: discovery, public storefront, buyer, marketplace, content, dan chat.
- `usaha.lajukan.com`: ruang kerja owner/staff untuk menjalankan usaha sehari-hari.
- Usaha bukan dashboard admin. Ia harus terasa seperti aplikasi kerja merchant: buka, lihat yang penting, kerjakan, selesai.

## Research signals
### GoFood Merchant / GoBiz
Current GoFood Merchant app (formerly GoBiz) menggabungkan order, cabang, menu, payout, promo, dan iklan dalam satu aplikasi merchant. GoBiz sebelumnya menekankan Beranda sebagai halaman kerja utama, kartu transaksi hari ini, saldo, informasi penting, serta kumpulan fitur yang bisa dibuka saat diperlukan.

Relevant public references:
- https://play.google.com/store/apps/details?id=com.gojek.resto
- https://biztips-cdn.gojek.com/uploads/Kenali_Tampilan_Terbaru_Go_Biz_991b7cb10b.pdf
- https://biztips-cdn.gojek.com/uploads/REVISI_IFFAH_Kenali_Detail_Perubahan_Halaman_Lainnya_Go_Biz_f13b2ff9c7.pdf

### majoo
majoo menggunakan Grid POS sebagai default untuk F&B karena thumbnail produk besar memudahkan kasir mengenali produk. Category navigation dan search tersedia langsung; flow transaksi utama adalah pilih produk → Bayar → pilih metode bayar → selesai.

Relevant public references:
- https://majoo.id/panduan-pengguna/detail/52
- https://majoo.id/panduan-pengguna/detail/297

## Primary users
1. Owner UMKM yang mengurus usaha sendiri dari HP.
2. Kasir/staff yang butuh transaksi secepat mungkin.
3. Owner multi-outlet yang lebih sering memantau dari desktop/tablet.
4. User non-teknis yang tidak boleh dipaksa memahami istilah internal sistem.

## Design principles
1. **Action first.** Tindakan operasional utama muncul sebelum analytics dan konfigurasi.
2. **One dominant action.** Setiap layar memiliki satu CTA paling jelas.
3. **Bahasa manusia.** Gunakan `Jual`, `Bayar`, `Uang masuk`, `Uang keluar`, `Stok tipis`, `Habis`, `Tambah stok`; jangan memunculkan istilah backend seperti canonical, COGS, settlement completeness, atau account key di UI utama.
4. **Photo-first commerce.** Produk dan kasir mengutamakan gambar, nama, harga, jumlah, dan stok.
5. **Progressive disclosure.** Detail teknis, pengaturan, HPP, supplier, reconciliation, dan konfigurasi lanjutan tetap tersedia tetapi tidak memenuhi layar utama.
6. **Mobile is primary, desktop is faster.** Mobile memakai pola aplikasi merchant; desktop menggunakan space tambahan untuk split view, sticky action, dan data density yang lebih tinggi.
7. **Fewer containers.** Hindari `SectionCard > DataPanel > card` berlapis. Surface putih tidak selalu membutuhkan border.
8. **Status must lead to action.** Warning tanpa CTA tidak berguna.
9. **Preserve business truth.** UI tidak boleh menebak laba, HPP, saldo, atau stok ketika data tidak lengkap.
10. **Fast next transaction.** Flow kasir tidak boleh menjebak user di receipt/success state.

## Information architecture
### Primary desktop navigation
Hanya lima pekerjaan utama selalu terlihat:
- Beranda
- Jualan
- Produk
- Stok
- Uang

Kelompok `Kelola usaha` memuat:
- Laporan
- Jual Online
- Pengaturan Usaha
- Lokasi & Outlet
- Jam & Operasional
- Tim & Akses
- Tampilan Toko
- Keamanan akun

### Mobile bottom navigation
Lima slot:
- Beranda
- Jual
- Produk
- Stok
- Menu

`Jual` menjadi action paling kuat secara visual. `Uang`, `Laporan`, dan konfigurasi masuk `Menu` agar bottom navigation tidak penuh fungsi manajemen yang lebih jarang dipakai staff.

### Business switcher
- Desktop: compact at top of sidebar.
- Mobile: business name in header; switching accessible via business header/menu.
- Multi-outlet context must remain visible without taking permanent horizontal space.

## Shell redesign
### Desktop
- Sidebar 216–224 px, visually lighter than current 240 px.
- Logo/business switcher at top.
- Primary navigation first; secondary management group collapsible or visually separated.
- No redundant page title repeated in both shell header and page body.
- Main content max width depends on page type:
  - operational workspace: up to ~1600 px
  - settings/read pages: ~1120–1280 px
- Top bar height ~56 px with business status, notifications, and account menu only.

### Mobile
- Compact 52–56 px top bar.
- Page content begins immediately below header.
- Bottom nav 60–68 px plus safe area.
- Sticky primary action allowed for screens with one core task.
- Avoid modal chains; prefer bottom sheet for short decisions.

## Visual system
### Typography
Use existing system font stack unless repo already exposes a production-safe branded font. Improve hierarchy through size, weight, and spacing rather than introducing a new dependency.

Target hierarchy:
- Page title: 22–28 px desktop, 20–24 px mobile
- Section title: 16–18 px
- Body: 14 px
- Secondary/helper: 12–13 px
- Metric: 22–32 px depending importance

### Color
- Forest green remains Lajukan primary.
- White surfaces on soft neutral background.
- Pale green for selected/positive context.
- Amber for actionable warning.
- Red only for destructive/error conditions.
- Gray-green text/borders for secondary information.

### Shape
- Main cards: 16–18 px radius.
- Inputs/buttons: 12–14 px radius.
- Pills reserved for status/filter chips only.
- Shadows only for elevation such as sticky cart, bottom sheet, floating menu, or modal.

### Spacing
- 4/8 px rhythm.
- Common gaps: 8, 12, 16, 24 px.
- Reduce page-level empty space and avoid large padding around simple lists.

## Shared component architecture
Create/reshape a focused Usaha UI layer under `frontend/apps/usaha/src/components/portal` and `business-control`.

### Layout primitives
- `MerchantShell`: shell responsibility only.
- `MerchantSidebar`: primary + manage navigation.
- `MerchantMobileNav`: mobile primary nav + menu trigger.
- `MerchantTopbar`: business context + status + account utilities.
- `WorkspaceHeader`: concise page heading and optional primary action.
- `WorkspaceTabs`: page-level mode switching.

### Content primitives
- `MetricStrip`: compact metric row, not independent cards by default.
- `ActionBanner`: one operational priority with CTA.
- `ListSection`: simple header + rows; no unnecessary outer card.
- `EntityRow`: standard product/stock/transaction/order row.
- `EmptyState`: short explanation + one action.
- `InlineNotice`: error/warning/info without oversized panels.
- `BottomSheet`: mobile secondary flow.
- `StickyActionBar`: checkout/save/mobile primary action.
- `ProductThumb`: consistent product image/fallback.

### Form primitives
- Label above input.
- Main fields first.
- Optional sections collapsed under `Detail lainnya`.
- Numeric fields use appropriate `inputMode`.
- Rupiah fields visually include `Rp`.
- Form success should close/reset or clearly expose next action.

## Page redesign
### Beranda
Purpose: answer `Apa yang perlu saya lakukan sekarang?`

Top area:
- business name + open/closed status
- compact daily summary: Omzet, Transaksi, Uang keluar, Stok perlu perhatian

Primary action row:
- Jual
- Catat pengeluaran
- Tambah stok

Then:
- one `Perlu dilakukan` action banner/queue
- latest activity list
- setup progress only when incomplete
- optional owner-only finance insight

Do not render many independent statistic cards with equal visual weight.

### Jualan
Purpose: fastest possible sale/order handling.

Use tabs/modes:
- Kasir
- Transaksi
- Pesanan

Kasir default for users with `createSales`.

Kasir desktop:
- left ~68–72%: search, category chips, visual product grid
- right ~28–32%: sticky cart
- product card: square image, name, price, quantity badge
- one tap adds item
- quantity edits in cart
- no product-detail modal for ordinary products

Kasir mobile:
- search + horizontally scrollable categories
- 2-column grid where space allows
- persistent bottom total + `Bayar`
- cart opens as bottom sheet

Payment:
- total first
- methods: Tunai, QRIS, Transfer, Belum bayar where supported
- cash presets include exact amount and rounded denominations
- change is visually dominant
- channel/date under `Detail transaksi`

Success:
- `Transaksi berhasil`
- prominent change/total
- primary `Transaksi baru`
- receipt/share/print secondary

Cash shift should not permanently occupy a large panel; show compact shift status/action near kasir header.

### Produk
Purpose: see and edit catalog quickly.

Header:
- title + search
- primary `+ Produk`

Catalog:
- desktop can use compact visual list/grid toggle only if needed; default visual list/grid chosen to maximize scan speed
- mobile: visual rows/cards
- image, name, category, price, stock status, active/archive state
- filters: Semua, Aktif, Stok tipis/Habis, category when useful

Add/edit product:
Main:
- Foto produk
- Nama produk
- Harga jual
- Stok saat ini

Details:
- kategori
- source/consignment
- stock threshold/unit/mode
- supplier/owner
- notes
- HPP and online selling settings linked, not embedded into the first form

Photo flow:
- `Ambil foto` / `Pilih galeri` semantics where browser capability allows
- square preview
- crop 1:1
- clear replace action
- friendly fallback when no image

### Stok
Purpose: resolve shortages quickly.

Tabs:
- Perlu tindakan
- Semua stok
- Bahan

`Perlu tindakan` default when attention exists.

Rows:
- product image/name
- current stock
- status
- primary action `Tambah stok` / `Cocokkan`

Bahan and purchase/yield features remain available for costing users but do not dominate normal stock checking.

### Uang
Purpose: understand usable cash and record non-sale movement.

Top summary:
- Saldo / uang tersedia
- Uang masuk today
- Uang keluar today
- Aman dipakai when planning data exists

Primary CTA: `Catat uang`.

Tabs or sections:
- Aktivitas
- Rencana
- Transfer aplikasi when applicable

Use everyday labels. Educational content such as `kas != untung` becomes contextual helper/disclosure, not a large permanent section.

### Laporan
Purpose: read performance, not configure data.

Default:
- time range selector
- key results: penjualan, transaksi, average order if supported, gross profit only when costing complete
- top products
- channel/payment breakdown
- expenses

No guessed metrics. Missing cost data must produce an explicit incomplete-data message.

### Jual Online
Purpose: make marketplace/channel setup understandable.

Start with enabled channels and price readiness.
Per channel:
- active/inactive status
- current online price
- estimated deduction only from recorded settings
- primary configure action

Marketplace price calculator main fields:
- Harga toko
- HPP if known
- Potongan aplikasi
- output `Saran harga online`

Promo/fixed fee/target margin under advanced settings.

### Pengaturan Usaha / Lokasi / Operasional / Tim / Tampilan Toko / Keamanan
Use settings-center pattern:
- grouped list sections
- current value/status
- row action/edit
- full forms only after selecting a row/action

Do not render every editable field at once.

## Image and media behavior
- Product images use a single shared thumbnail primitive.
- Preserve `BusinessImageCropUpload` capability but simplify labels and action hierarchy.
- Images must lazy-load in catalog/grid where appropriate.
- Broken/missing image uses deterministic initials/icon fallback.
- Use `object-cover` and consistent aspect ratio.
- Avoid huge original images in routine list/grid surfaces.

## Loading, empty, error, and feedback states
### Loading
Skeleton must match destination geometry:
- grid skeleton for product grid
- row skeleton for transaction/list pages
- metric strip skeleton for dashboards

Avoid a universal giant spinner for whole pages when layout can render progressively.

### Empty
Every empty state answers:
1. what is empty,
2. why it matters,
3. one action to continue.

### Error
- inline recoverable errors near the affected area
- retry action when useful
- destructive API errors never look like success feedback

### Success
- short confirmation
- do not keep large success banners after ordinary save actions

## Responsive behavior
### < 640 px
- single-column pages
- 2-column POS product grid when product cards remain legible
- bottom sheets for secondary selections
- sticky bottom CTA where helpful

### 640–1023 px
- tablet layout
- POS can use split view when width permits, otherwise bottom cart
- lists become denser

### >= 1024 px
- persistent sidebar
- operational split views
- tables/list grids allowed
- sticky contextual right pane only when it represents an active task such as cart, never a generic information rail

## Accessibility
- keyboard-reachable navigation and actions
- visible focus rings
- semantic buttons/links
- `aria-current` for navigation
- status not communicated by color alone
- minimum touch target approximately 44 px; primary mobile actions 48+ px
- sufficient text contrast
- reduced-motion respected
- modal/bottom-sheet focus behavior must be correct

## Technical constraints
- Next.js 16 + React 19 patterns already in repo.
- Tailwind + existing `lucide-react`; no new UI runtime dependency unless implementation proves existing stack cannot satisfy the spec.
- Preserve current routes, permissions, auth, API request/response contracts, canonical data flows, and business-control server behavior.
- Shared UI must remain inside Usaha app; avoid leaking merchant-specific styles into WWW.
- Refactor large page components only when needed to make responsibility boundaries clearer.
- Prefer focused components over files that mix navigation, data formatting, form state, and layout.

## Migration strategy
Implement in one redesign program but in verifiable waves on a single feature branch/PR series if necessary:

1. **Foundation** — tokens/global CSS, shell, desktop/mobile navigation, shared primitives, loading/empty/error patterns.
2. **Core daily work** — Beranda, Jualan/Kasir, Produk, Stok, Uang.
3. **Management surfaces** — Laporan, Jual Online, settings-family pages.
4. **Consistency pass** — auth/create-business/account states, skeletons, responsive edge cases, wording cleanup.
5. **Regression and contract hardening** — tests, architecture contract updates only where intentional, cleanup obsolete wrappers/classes.

A wave is not considered complete merely because it renders. It must pass relevant tests/typecheck/build before moving on.

## Testing strategy
### Unit/static contracts
- navigation grouping and mobile primary items
- progressive disclosure markers for major forms
- POS filter/payment helpers
- shared formatting/helpers
- no accidental internal terminology in key UI surfaces

### Component behavior
Where current test setup permits:
- product tap adds line
- cart quantity controls
- payment validation
- product form main vs advanced fields
- stock attention sorting/action
- finance primary action visibility by permission

### Build gates
- `frontend/apps/usaha`: test
- typecheck
- Next build
- Usaha Business OS gate
- Frontend Runtime Gate
- repository hygiene

Existing unrelated failing gates must be investigated and explicitly separated from redesign regressions; they must not be silently ignored.

## Success criteria
1. A first-time UMKM operator can identify the primary action on each core screen in under a few seconds.
2. Kasir flow is visually dominant on Jualan and requires minimal taps for an ordinary cash/QRIS sale.
3. Product catalog is image-first and product creation exposes only photo/name/price/stock before optional details.
4. Stok defaults to attention-first behavior.
5. Uang uses everyday merchant language and separates actual cash movement from planning/education.
6. Mobile navigation prioritizes Beranda, Jual, Produk, Stok, Menu.
7. Desktop does not waste space on nested generic cards or duplicated headers.
8. Major routes share one visual hierarchy and consistent loading/empty/error patterns.
9. Existing API contracts, routes, permissions, and canonical accounting/sales behavior remain correct.
10. Usaha tests, typecheck, and production build pass on the redesigned tree before merge.
