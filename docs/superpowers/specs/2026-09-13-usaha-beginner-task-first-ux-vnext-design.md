# Lajukan Usaha VNext — Beginner-First Task UX Design

**Date:** 2026-09-13  
**Status:** Design approved; implementation not started  
**Scope:** `frontend/apps/usaha` plus the smallest backend/API changes required to preserve real-world transaction integrity  
**Primary audience:** Indonesian micro/small business owners and staff who may have little experience with ERP/accounting software

## 1. Problem statement

Lajukan Usaha already has strong business-system foundations: role-aware access, business setup, products, stock, costing/HPP, sales, finance, channels, reporting, team access, and public storefront controls. The primary usability problem is not missing capability. The problem is that the UI exposes too much of the system model to the operator.

Today, a beginner may encounter concepts such as `workspace`, `flow`, `capability`, `canonical`, `durable`, `snapshot`, `backend`, `costing`, `settlement`, `merchant`, `hard-code fee`, `channel`, and `HPP` before they can complete a normal business task. The information architecture also exposes too many first-class destinations, creating decision overload.

The desired product experience is:

> Open Lajukan Usaha, immediately understand what needs attention, complete a real business task in a few taps, and leave without having to understand the internal architecture.

Lajukan Usaha must feel like a daily business assistant, not a miniature ERP console.

## 2. Product north star

A beginner should be able to use Lajukan Usaha with the mental model:

1. What needs attention now?
2. I want to record a sale.
3. I want to check or refill stock.
4. I want to record money in/out.
5. I want to know whether the business is doing well.

The user must not need to understand how ledgers, snapshots, canonical records, backend persistence, channel assumptions, or costing internals work.

## 3. Design principles

### 3.1 Task-first, not module-first

Navigation and page hierarchy are organized around jobs the user wants to complete, not internal domain modules.

### 3.2 Progressive disclosure

Show only the minimum information needed for the current task. Advanced costing, recipes, channel assumptions, supplier details, consignment terms, and technical explanations stay behind expandable sections, detail views, or contextual help.

### 3.3 Real operations must continue

Missing secondary/master data must not block a real transaction that happened in the field unless accepting it would create an invalid transaction itself.

In particular, a completed sale must still be recordable when HPP/costing is incomplete. The sale records quantity, product, selling price, payment destination, date/time, and available source/channel data. Profit/HPP-dependent metrics remain explicitly incomplete until valid costing exists.

The system must never silently convert unknown HPP to `Rp0`.

### 3.4 One event, one recording

Users should not have to understand separate Sales vs Finance ledgers to avoid double entry.

A normal sale recorded through Jualan must produce the appropriate downstream financial effect automatically. The standard Uang flow should not ask the user to record the same sale again.

### 3.5 Indonesian everyday language first

Use terms familiar to small business operators. Technical/accounting concepts can exist, but must be introduced only when necessary and explained once in simple language.

### 3.6 Dense but breathable

Space efficiency means fewer nested containers and less repeated explanatory copy, not tiny text. Prioritize scanning speed, readable touch targets, and one clear action per section.

### 3.7 Adaptive without separate apps

Lajukan remains one universal Business OS. F&B, laundry, service/field work, retail, and general business may receive different wording, priorities, and quick actions without becoming separate products.

## 4. Success tests

Every primary screen must pass these tests:

- **3-second test:** a first-time user can identify what the page is for in approximately three seconds.
- **One-action test:** the primary next action is visually obvious.
- **Warung test:** the user does not need ERP/accounting/developer vocabulary to proceed.
- **One-hand mobile test:** common daily operations are comfortable on a phone.
- **Field-operation test:** missing costing/profile details do not unnecessarily stop a real sale or operational event.
- **Space test:** irrelevant information does not occupy persistent screen space.
- **Truth test:** Lajukan never fabricates revenue, cost, stock, fees, or profit.

## 5. Information architecture

### 5.1 Desktop primary navigation

Reduce first-class business destinations to:

1. **Beranda**
2. **Jualan**
3. **Produk**
4. **Stok**
5. **Uang**
6. **Laporan**
7. **Jual Online**
8. **Pengaturan Usaha**

The goal is not merely fewer routes. Existing capabilities are regrouped under destinations that match the user's mental model.

### 5.2 Navigation regrouping

- `Operasional` is no longer a first-class navigation destination.
  - current open/closed status -> Beranda quick control
  - business schedule -> Pengaturan Usaha
  - stock alerts -> Stok and Beranda alerts
- `Halaman pembeli` becomes **Tampilan Toko** under Jual Online or Pengaturan Usaha.
- `Tim` and `Undangan & akses` become **Tim & Akses**.
- `Keamanan` moves to account-level settings unless the control is truly business-specific.
- `Lokasi & Outlet` lives under Pengaturan Usaha, with outlet-aware shortcuts when multiple locations materially affect daily work.

### 5.3 Mobile bottom navigation

For users with normal owner/manager permissions, the default bottom navigation is:

- **Beranda**
- **Jualan**
- **Stok**
- **Uang**
- **Menu**

Products remain easy to reach from Menu and contextual actions, but daily transaction/stock/cash work receives priority.

Labels should be readable at approximately 11–12 px minimum rather than relying on very small navigation text.

### 5.4 Permission behavior

Permission-aware hiding remains. If a user cannot access a primary destination, the remaining navigation should still preserve a coherent order instead of exposing technical placeholders.

## 6. Language system

### 6.1 User-facing term replacements

| Internal/current wording | Beginner-facing wording |
| --- | --- |
| Workspace bisnis | Usaha |
| Buat workspace usaha baru | Tambah usaha |
| Onboarding usaha | Mulai usaha |
| Setup inti | Data utama |
| Pilih flow | Pilih jenis usaha |
| Flow | Cara kerja, or omit |
| Quick Start | Langkah berikutnya |
| Template | Omit from normal UI |
| Capability | Never expose |
| ERP | Omit from normal UI |
| Produk & HPP | Produk / Produk & Modal |
| Costing | Hitung modal |
| HPP | Modal produk (HPP) on first explanation, then HPP where useful |
| Kanal Jual | Jual Online / Tempat Jualan |
| Kanal | Dijual lewat |
| Fee | Potongan aplikasi |
| Promo merchant | Promo yang ditanggung toko |
| Merchant | Toko / Usaha |
| Settlement | Transfer dari aplikasi |
| Canonical | Never expose |
| Durable | Never expose |
| Snapshot historis | Biaya saat transaksi dibuat, only when explanation is needed |
| Backend | Sistem, or omit |
| Hard-code fee | Never expose |
| Halaman pembeli | Tampilan Toko |
| Undangan & akses | Tim & Akses |
| Konsinyasi | Barang titipan |
| Restock | Isi stok / Tambah stok |
| Qty | Jumlah |
| Masuk ke | Dibayar ke |
| Status publik | Bisa dilihat pelanggan |
| Identitas visual usaha | Foto & Logo |
| Data merchant untuk disalin | Data toko untuk aplikasi lain |

### 6.2 Copy rules

- Do not explain backend architecture in normal page descriptions.
- Page descriptions should answer: **what can I do here?**
- Technical integrity explanations move to contextual `Tentang angka ini`, help text, or advanced sections.
- Prefer short action verbs: `Catat`, `Tambah`, `Cek`, `Bayar`, `Isi`, `Lihat`, `Atur`.
- Avoid English when a common Indonesian term exists.
- Do not use reassuring technical copy as permanent visual noise. Example: data-truth explanations should be available contextually, not repeated on every visit.

## 7. Shared visual hierarchy and density

### 7.1 Reduce card nesting

Avoid structures equivalent to `panel -> card -> bordered row -> badge` unless every boundary communicates a real semantic grouping.

Use a small number of main surfaces with dividers between related sections. Cards remain appropriate for:

- urgent alerts
- key summaries
- clearly separate entities
- one important CTA

### 7.2 Header density

A page header should normally contain:

- page title
- one short description only when needed
- one primary action or compact status

Eyebrows/kickers are optional and should not repeat the visible navigation label.

### 7.3 Form density

- Hide optional/advanced fields by default.
- Remember reasonable recent/default choices where safe.
- Use chips/segmented controls for small, common categorical choices.
- Use dropdown/search only when the option set justifies it.
- Long mobile forms should keep the primary save/continue action reachable, including sticky action treatment where appropriate.
- Currency input should display formatted Rupiah feedback while preserving valid numeric submission.

### 7.4 Touch targets and readability

Retain the existing good accessibility baseline: approximately 44 px minimum interactive targets, visible focus states, reduced-motion handling, semantic labels, and keyboard navigation.

Do not gain density by shrinking critical text or targets.

## 8. Onboarding / Add business

Replace software-centric onboarding with a three-step beginner flow.

### Step 1 — Pilih jenis usaha

Beginner labels:

- **Makanan & Minuman** — jus, kopi, warung, restoran, katering
- **Laundry** — kiloan, satuan, sepatu, related services
- **Servis & Jasa Lapangan** — AC, teknisi, reparasi, home services
- **Toko & Retail** — warung, minimarket, product retail
- **Usaha Lainnya**

Internal template/capability keys remain implementation details.

### Step 2 — Info usaha

Primary fields:

- Nama usaha
- Kategori
- Nomor WhatsApp/telepon

Prefill known account information when valid and appropriate.

### Step 3 — Lokasi

- search/enter address
- map pin
- derive city/region where possible instead of requiring duplicate typing
- confirm location

### Completion

CTA: **Buat Usaha**

Success state:

> `<Nama usaha> sudah siap.`  
> Sekarang tambahkan produk atau layanan pertama yang kamu jual.

Primary CTA: **Tambah produk** or template-appropriate equivalent.

Do not show `workspace`, `flow`, `capability`, or ERP explanations in the normal onboarding path.

## 9. Beranda

Beranda is a daily command center, not a directory of modules.

### Required hierarchy

1. Business identity + open/closed status
2. Greeting/date only if it adds context
3. One highest-priority alert/action
4. Common quick actions
5. A small daily summary
6. Recent activity

### Suggested quick actions

Owner/manager F&B example:

- `+ Catat jualan`
- `- Catat pengeluaran`
- `Cek stok`

### Daily summary examples

- Jualan hari ini
- Pengeluaran hari ini
- Stok perlu dicek

Only show values backed by recorded data.

### Empty/healthy state

If nothing requires attention, say so directly:

> **Usaha aman. Tidak ada yang mendesak.**

Do not fill the screen with zero-value or irrelevant cards.

### Remove duplicate business portfolio surface

If BusinessSwitcher already gives persistent access to other businesses, do not also render a large always-visible `Usaha yang kamu kelola` panel on the daily home unless there is a specific multi-business task to surface.

## 10. Jualan

Jualan should behave like a fast cashier/order workspace.

### 10.1 Fast sale default

Default flow:

1. choose/search product
2. quantity with fast +/- controls
3. price prefilled from product
4. payment method
5. save

Automatic/defaulted data:

- date/time defaults to now/today
- price defaults from product
- last/default sales source may be remembered when safe

Optional controls such as discount and source/channel stay behind `+ Diskon` / `Detail lainnya` unless required.

### 10.2 Example mental model

```text
Cari produk...

[Jus Mangga 15k] [Jus Alpukat 15k]
[Jus Jeruk 10k ] [Es Teler 15k]

Keranjang
Jus Mangga          -  2  +     30.000
Jus Jeruk           -  1  +     10.000

Total                          Rp40.000

Dibayar dengan:
[Tunai] [QRIS] [Bank] [Belum bayar]

[ Simpan Jualan ]
```

### 10.3 P0 transaction-integrity rule: incomplete HPP

A real completed sale must not be rejected solely because costing/HPP is incomplete.

Persist what is known. Mark cost-dependent fields as unavailable/incomplete. Reports must clearly display `Belum lengkap` where HPP/profit cannot be calculated.

Do not backfill unknown cost as zero. Do not silently recompute historical cost in a way that changes previously locked valid cost without an explicit accounting rule.

The implementation plan must inspect the current backend contract before selecting the exact persistence model for incomplete-cost sales.

### 10.4 Orders vs direct sales

If external orders and direct cashier sales remain separate operational concepts, explain them using user language and tabs/segments such as:

- **Kasir / Penjualan langsung**
- **Pesanan masuk**

Do not explain the distinction with terms such as `canonical` or backend storage.

## 11. Uang

Uang is a business cash activity screen, not a technical ledger editor.

### 11.1 Normal user flow

Top-level choices:

- **Uang masuk**
- **Uang keluar**

Common categories should use fast chips/cards where feasible.

Uang keluar examples:

- Bahan
- Kemasan
- Sewa
- Listrik/air/internet
- Gaji
- Promosi
- Peralatan
- Bayar utang
- Ambil pribadi
- Lainnya

### 11.2 One-event-one-recording rule

A normal sale recorded in Jualan must appear in financial summaries without asking the user to manually create another `Penjualan` finance entry.

If a manual sale correction or exceptional entry is necessary, place it in an advanced/exception path such as `Lainnya -> Koreksi transaksi`, with clear semantics.

The implementation plan must verify current backend/source-of-truth behavior before removing or transforming existing finance entry types.

### 11.3 Sales source/channel control

Do not use free-text input for a known set of active selling platforms. Select from the business's configured selling sources when the field is relevant.

### 11.4 Transfer from apps

Replace user-facing `settlement` wording with **Transfer dari aplikasi**.

Example:

```text
GoFood
Penjualan tercatat     Rp250.000
Transfer masuk         Rp183.500

[ Cocokkan transfer ]
```

If no relevant platform is active, hide this entire feature rather than showing a panel that says settlement is not relevant.

## 12. Produk

The primary product list is for scanning, not full inline administration.

### Default row/card information

- image if useful
- product name
- selling price
- stock status/quantity
- active/attention state
- compact edit/detail action

Example:

```text
Jus Mangga
Rp15.000
Stok 18 cup                         Aktif
```

### Product detail

Primary:

- Info
- Harga
- Stok

Advanced:

- Modal (HPP)
- Resep
- Harga online
- Supplier/source
- Barang titipan
- advanced identifiers/settings

Do not render the full management form inside every list row.

## 13. Stok

Use **Stok** as the primary destination, with clear internal separation between sellable items and inputs.

For F&B:

- **Produk**
- **Bahan & Kemasan**

For laundry/service/retail, labels adapt to what the business actually handles while keeping the same underlying system.

### Priority section

Show items requiring action first:

- Habis
- Hampir habis / Tipis
- Perlu dicek

Use action wording such as `Tambah stok`, `Cek stok`, `Catat belanja` rather than `restock` or `costing`.

## 14. Jual Online

Rename/reframe current channel management around the user's outcome: selling outside the physical counter and understanding platform deductions.

For a configured platform show, where data exists:

- offline/base price
- platform price
- potongan aplikasi
- promo ditanggung toko
- estimated amount received
- HPP/modal when permitted and available
- estimated margin/profit when data is complete

Example:

```text
GoFood                              AKTIF
Potongan aplikasi                   20%
Promo ditanggung toko               10%

Harga offline                 Rp10.000
Modal produk                   Rp5.000
Harga online                  Rp19.000
Uang yang diterima            Rp13.680
Untung perkiraan               Rp8.680

✓ Masih aman
```

Do not expose concepts such as `merchant assumptions`, `hard-coded fee`, or `durable HPP` in primary copy.

## 15. Laporan

Default reports answer business questions, not database questions.

### Primary period control

- Hari ini
- 7 hari
- Bulan ini

### Primary numbers

Where data/permissions allow:

- Omzet
- Laba kotor
- Pengeluaran
- Hasil/perkiraan hasil with a precise definition

### Supporting information

- top products/services
- sales count
- relevant stock warnings
- trend comparison when valid comparable data exists

### Incomplete-data behavior

If HPP is incomplete:

> **Laba belum lengkap**  
> Modal 3 produk belum diisi.  
> `Lengkapi modal`

Do not show backend/snapshot/canonical explanations in the primary report surface. Put calculation methodology behind `Cara angka ini dihitung`.

## 16. Pengaturan Usaha

Group lower-frequency configuration into one coherent area.

Suggested sections/tabs:

- **Info**
- **Lokasi**
- **Tampilan Toko**
- **Tim & Akses**

Business hours belong here, with a quick open/close control also available from Beranda where operationally useful.

Latitude/longitude and other debug-oriented fields should not be visible in normal owner/staff UI unless there is a direct user task requiring them.

Account-level security remains separate from business settings where appropriate.

## 17. Adaptive templates

Keep one application and one core IA. Adapt terminology and priority actions by business type.

### F&B

Priority concepts: jualan, menu/produk, bahan & kemasan, stok, uang, delivery.

### Laundry

Priority concepts: terima cucian, status proses, layanan, pembayaran, pickup/selesai.

### Service / field work

Priority concepts: pekerjaan/booking, teknisi, status pekerjaan, sparepart, pembayaran.

### Retail

Priority concepts: kasir, produk, stok, pembelian, uang.

### General

Use generic product/service, sales, stock (if enabled), and money language.

Adaptive templates must not create disconnected apps or incompatible data models.

## 18. Responsive behavior

### Mobile

- bottom navigation always keeps the most common daily jobs reachable
- dense data tables become scan-friendly rows/cards
- actions become full-width or sticky where the task benefits
- avoid horizontal scrolling for ordinary forms/lists
- no primary action depends on hover

### Tablet

Treat tablets as a first-class operational device, not merely stretched mobile. Two-column forms and split views may be used when touch targets remain comfortable.

### Desktop

Use the extra width for comparison and parallel context, not for multiplying permanent cards.

## 19. Accessibility

Preserve and expand the current accessibility baseline:

- keyboard reachable controls
- visible focus indicators
- semantic navigation and headings
- accessible names for icon-only buttons
- minimum comfortable touch target sizing
- reduced-motion support
- status is never communicated only through color
- empty/error/success states use understandable language

## 20. Error and empty states

Errors must tell the user:

1. what did not happen
2. what they can do next

Avoid raw backend/internal error identifiers.

Empty states must offer the most likely next action instead of explaining internal data architecture.

Examples:

- `Belum ada produk. Tambah produk pertama.`
- `Belum ada transaksi hari ini. Catat jualan atau pengeluaran untuk mulai.`
- `Belum ada stok yang perlu dicek.`

## 21. Data integrity guardrails

The beginner UX must not weaken the Business OS's correctness rules.

Required guardrails:

- server remains authoritative for protected calculations and permissions
- unknown cost remains unknown, never coerced to zero
- normal sale entry must not create duplicate revenue when finance summaries consume the same event
- platform transfer reconciliation must not count the same sale as revenue twice
- role restrictions remain enforced server-side; hiding UI is not authorization
- historical cost behavior must be explicit and tested
- stock changes must have clear source events and avoid silent double mutation
- currency values use integer minor/business units according to the existing backend contract; UI formatting does not change stored semantics

## 22. Analytics and usability validation

Implementation should make it possible to measure whether simplification works without collecting unnecessary sensitive data.

Recommended product metrics:

- time from login/home to first completed daily action
- sale completion success rate
- abandonment rate in sale/expense/product forms
- percentage of users who open advanced sections
- rate of duplicate manual sale-entry attempts after the one-event-one-recording change
- navigation usage frequency by destination
- mobile vs desktop task completion
- onboarding completion rate

Qualitative validation should include at least these novice scenarios:

1. create an F&B business
2. add first product
3. record a sale with complete HPP
4. record a sale with incomplete HPP
5. record ingredient purchase/expense
6. check low stock
7. understand GoFood deductions
8. interpret today's result without accounting knowledge

## 23. Implementation boundaries

This design does **not** authorize a full rewrite.

Prefer incremental changes in existing components and routes while establishing shared primitives for:

- navigation config
- beginner-facing copy/labels
- page density patterns
- quick actions
- progressive disclosure
- transaction forms

Backend changes are permitted only where necessary to satisfy the approved operational integrity requirements, especially sale recording with incomplete costing and one-event-one-recording semantics.

The implementation plan must inspect current APIs/tests before changing these contracts.

## 24. Implementation sequence

### P0 — language and transaction integrity

- remove developer/system jargon from user-facing surfaces
- ensure a real sale is not rejected only because HPP is incomplete
- define and implement single-recording semantics between Jualan and Uang

### P0 — information architecture

- reduce desktop first-class navigation
- mobile bottom nav becomes Beranda / Jualan / Stok / Uang / Menu
- regroup Operasional, Tampilan Toko, Tim & Akses, Keamanan, Lokasi

### P1 — daily core

- redesign Beranda
- redesign fast Jualan flow
- redesign Uang flow

### P1 — catalog and inventory

- simplify product list/detail
- separate sellable stock from bahan/kemasan or template-equivalent inputs

### P1 — onboarding

- implement three-step beginner setup

### P2 — Jual Online, Laporan, Pengaturan

- outcome-first platform pricing/deductions
- simplified reporting
- compact business settings

### P2 — density and responsive pass

- reduce nested surfaces
- mobile/tablet/desktop verification
- sticky actions where justified

### P3 — adaptive template refinement

- improve template-specific terminology/actions without fragmenting the platform

## 25. Testing requirements

Implementation must include automated tests for changed behavior and targeted user-flow verification.

At minimum:

- navigation visibility/order by permission
- mobile primary navigation order
- forbidden jargon regression checks for high-value user-facing copy where practical
- sale with complete costing
- sale with incomplete costing succeeds while cost/profit remains explicitly incomplete
- sale does not require duplicate finance entry
- finance summary does not double-count the sale
- platform transfer reconciliation does not double-count revenue
- responsive component states for dense lists/forms
- accessibility checks for labels, focus, and icon-only controls

Existing truth/permission tests must remain green.

## 26. Acceptance criteria

This design is considered implemented when all of the following are true:

1. A novice can identify the four main daily jobs from Beranda/mobile navigation without learning internal terminology.
2. The normal UI does not expose `canonical`, `durable`, `backend`, `hard-code`, `capability`, or `workspace` as business concepts.
3. Core daily destinations are reduced/regrouped as specified.
4. Mobile exposes Beranda, Jualan, Stok, Uang, and Menu as its primary navigation when permissions allow.
5. A legitimate sale can be recorded when HPP is incomplete, while all cost-dependent metrics are marked incomplete rather than fabricated.
6. A sale normally needs to be recorded only once by the user.
7. Settlement is presented as Transfer dari aplikasi and hidden when irrelevant.
8. Product and stock screens no longer expose full advanced configuration inline by default.
9. Onboarding uses simple business-type, info, and location steps without software-architecture vocabulary.
10. Reports show outcome-oriented numbers and simple incomplete-data explanations.
11. Common mobile tasks do not require horizontal scrolling and retain comfortable touch targets.
12. Permission and data-integrity guarantees remain server-enforced.

## 27. Out of scope

This design intentionally does not include:

- a new standalone app for each business type
- a wholesale visual brand redesign
- changing the entire backend architecture merely to match UI terminology
- fabricating missing finance/cost/stock data for nicer dashboards
- exposing advanced accounting concepts to every user by default
- implementing unrelated Lajukan.com marketplace/community features

## 28. Final design decision

The selected approach is **Task-First Redesign**: simplify language, reduce navigation choices, prioritize daily actions, enforce progressive disclosure, and fix operational blockers while preserving the current Business OS foundation.

The target feeling is:

> **Lajukan Usaha membantu saya menjalankan usaha hari ini. Saya tidak perlu belajar software bisnis dulu untuk memakainya.**
