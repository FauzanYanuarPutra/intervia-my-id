# Lajukan Usaha Business OS UI Overhaul — Design

## Purpose
Transform `usaha.lajukan.com` from a card-heavy merchant portal into a cohesive, modern Business OS for Indonesian UMKM operators while preserving existing routes, data contracts, permissions, and business behavior.

## Product position
- `www.lajukan.com`: public discovery, buyer, storefront, chat and marketplace surface.
- `usaha.lajukan.com`: owner/staff operating workspace for the same businesses.
- This UI overhaul changes presentation and interaction hierarchy only. It does not migrate business data ownership or API contracts.

## Design principles
1. Action first: show the next operational action before secondary information.
2. Scan first, inspect second: dense data uses compact rows/tables on desktop and compact cards on mobile.
3. One shell, one language: shared navigation, headers, statuses, buttons, empty states, KPI cards and data panels.
4. Lajukan identity without visual noise: forest green is primary, warm sand is secondary, backgrounds become neutral and shadows restrained.
5. Responsive by intent: desktop optimizes operations; mobile uses touch-friendly primary navigation and an overflow menu.
6. Preserve behavior: existing routes, permissions, forms, reads/writes and server behavior remain intact.

## Information architecture
### Desktop sidebar
- Ringkasan: Beranda
- Penjualan: Pesanan
- Katalog: Produk
- Operasional: Lokasi & Cabang, Operasional
- Bisnis: Profil usaha, Halaman pembeli
- Tim & Keamanan: Tim, Keamanan

The active business switcher lives at the top of the sidebar. Portfolio switching no longer consumes a permanent right rail.

### Top bar
- Context/current section title
- Business status
- Account identity/logout affordance
- Space for primary page actions where relevant

### Mobile navigation
- Compact business header
- Bottom navigation for Beranda, Pesanan, Produk, Menu
- Remaining routes available in the Menu surface
- No horizontal pill-strip navigation

## Visual system
- Background: neutral off-white
- Surface: white
- Primary: forest green
- Primary-soft: pale green
- Secondary warm: muted sand used sparingly
- Text: near-black slate
- Muted text: medium slate
- Border: subtle gray-green
- Warning: amber
- Danger: red

Standard cards use 18–20px radius; controls use 12–14px radius; pills are reserved for statuses/tags rather than primary navigation. Shadows are subtle and used only for elevation.

## Shared UI primitives
- `PortalShell`: responsive frame only
- `SidebarNav`: grouped desktop navigation
- `BusinessSwitcher`: active business and portfolio switching
- `MobileNav`: primary mobile navigation + overflow links
- `PageHeader`: section title, description, optional action
- `StatCard`: KPI value/label/supporting note
- `StatusBadge`: semantic statuses
- `ActionCard`: attention/next-action item
- `EmptyState`: consistent no-data state
- `DataPanel`: operational section wrapper

The shell must stop rendering progress, team and role widgets in a permanent right rail. Those widgets become contextual page content.

## Page direction
### Beranda
Page header → attention queue → KPI row → incomplete setup progress → secondary business/portfolio context.

### Produk
Header with primary action when permitted → KPI row → compact product list/table → quick-add as a clear secondary panel → mobile compact cards.

### Pesanan
Status-oriented summary → compact operational rows → clear empty state.

### Lokasi & Cabang
Primary branch is visually distinct; show name/address/city/state/map action; add-location action stays in header.

### Operasional
Attention-first command center; reservations and metrics are separated from configuration.

### Profil usaha
Settings-like grouped sections; completion context is visible but not dominant.

### Halaman pembeli
Public-preview/status treatment with a clear CTA to open the storefront on WWW.

### Tim
Member list first; role/access context second; actions remain permission-gated.

### Keamanan
Calm settings-center layout grouped by security purpose.

### Create business / Login / Not found / Empty states
All use the same restrained Business OS visual language.

## Accessibility and responsive requirements
- Visible focus states.
- Touch targets approximately 40–44px minimum.
- No information communicated only by color.
- Readable contrast.
- Desktop lists collapse to compact mobile cards without viewport overflow.
- Navigation remains keyboard reachable.

## Technical constraints
- Keep current Next.js 16 + React 19 patterns.
- Preserve routes and API request/response shapes.
- Preserve permission checks.
- Add no runtime dependency; use Tailwind and existing `lucide-react`.
- Keep Usaha-specific UI in `frontend/apps/usaha/src/components/portal`.

## Verification
- Usaha typecheck
- Usaha build
- Usaha Business OS architecture/static contracts
- Relevant frontend runtime gate
- Repository hygiene for newly tracked docs/source

## Success criteria
- Persistent grouped desktop sidebar replaces horizontal section pills.
- Mobile no longer relies on horizontal section navigation.
- Permanent right rail is removed.
- Dashboard stays action-first but becomes visually calmer.
- Product/operational pages prioritize scanability over nested-card detail.
- Major Usaha routes share consistent primitives/hierarchy.
- Existing behavior, routes, auth, permissions and API contracts remain unchanged.
