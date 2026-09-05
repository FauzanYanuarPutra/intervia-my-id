# Lajukan Public Product Hardening Design

## Goal
Consolidate the public product into one coherent discovery experience, remove legacy SEO/index debt, strengthen crawlable homepage messaging, align account/support terminology with current authentication, and clarify the boundary between `www.lajukan.com` and `usaha.lajukan.com`.

## Product contract
- `www.lajukan.com`: public discovery/network surface.
- `usaha.lajukan.com`: Business OS; not the primary marketplace discovery surface.
- `Explore` is the canonical discovery/search experience.
- Legacy `/search` remains compatible only through redirect to `/explore`.
- Core public proposition must exist in server-rendered HTML.
- Empty/system/private surfaces must not consume search index space.

## Homepage
Add a localized server-rendered semantic intro before the existing rich client home. Indonesian H1: `Cari supplier, jasa, mesin, dan kebutuhan usaha dalam satu tempat.` Supporting copy: `Temukan yang dibutuhkan usahamu atau pasang kebutuhan agar penyedia yang tepat bisa menemukanmu. Jelas kebutuhannya, tepat mitranya.` Provide Explore and post-need CTAs. Preserve the existing rich marketplace home below it.

## Search consolidation
Locale-aware `/search` traffic redirects permanently to `/explore`, preserving query parameters. Legacy type filters map to the closest current Explore taxonomy where practical.

## Index policy
Do not index `/search`, `/chat`, `/account`, `/settings`, `/notifications`, `/transactions`, `/create`, `/my-listings`, `/my-projects`, or system/test profiles. Sitemap emits canonical public landing/detail URLs only, never arbitrary search queries.

## Public profile hygiene
Known system identities such as all-zero UUID/super-admin seed identities must not render as indexable public profiles. Normal public profile URLs remain compatible in this pass.

## Authentication/support terminology
Public support/refund copy must match the currently exposed Google-first authentication. Do not tell users to troubleshoot passwords/OTP or require a phone number unless that flow is actually available on that surface. Prefer `email akun` / `akun Lajukan`.

## Canonical discovery naming
Bahan & Supplier; Jasa; Mesin & Alat; Tempat Usaha; Peluang Usaha; Orang & Keahlian; Usaha Sekitar; Kebutuhan Pembeli.

## Usaha
Preserve the separate Next.js app and deployment contract. Metadata/robots should clearly present it as Lajukan Usaha / Business OS and avoid competing with `www` for marketplace discovery keywords.

## Verification
Use existing tests plus targeted regression tests where the current harness supports them. Verify affected Next.js apps with lint, tests and build, and keep repository hygiene clean.

## Non-goals
No new marketplace verticals, payment activation, full homepage feed redesign, breaking profile-slug migration, or infrastructure platform migration.
