# Lajukan Usaha UX V3 Design

Date: 2026-09-18
Status: Approved design, pending implementation-plan review
Scope: `frontend/apps/usaha` first; backend contracts change only when a seller-facing workflow cannot be implemented safely with an existing API.

## 1. Purpose

Lajukan Usaha already has durable business primitives for products, ingredients, HPP, stock, cashier sales, finance entries, cash shifts, channels, settlements, and operational records. The remaining problem is consistency: some daily workflows now use persistent workspaces while other surfaces still expose long dropdowns, large blocking modals, nested action menus, or technical fields that force merchants to understand the underlying data model.

UX V3 standardizes the merchant experience around one rule: **the interface should follow the merchant's job, while the system preserves the accounting, inventory, permission, idempotency, and audit rules underneath.**

This design extends the non-blocking cashier/HPP/order direction already merged in Operations UX V2 to the rest of Lajukan Usaha.

## 2. Goals

1. Make frequent merchant tasks complete in one obvious flow with minimal context switching.
2. Remove blocking modals from core workflows such as product management, stock purchasing, finance entry, and long-form editing.
3. Replace long or repetitive `<select>` controls with appropriate interaction patterns:
   - 2–6 stable choices: visible chips, segmented buttons, or cards.
   - many searchable entities: search picker.
   - technical/rare choices: progressive disclosure under advanced settings.
4. Make every transactional action explain its business effect before saving: stock change, cash effect, margin, allocation, or reversal.
5. Preserve immutable history and existing backend safety semantics.
6. Keep mobile and desktop workflows intentionally different where screen constraints require it.
7. Reduce legacy duplicated UI components after the replacement paths are proven and covered by tests.

## 3. Non-goals

- No rewrite of marketplace, finance-core, inventory, or business-control backend architecture merely for visual consistency.
- No seller UI wired to internal/agent-only order-engine endpoints.
- No destructive editing of posted financial or stock history.
- No new accounting terminology exposed unless it directly helps a merchant complete a task.
- No universal design-system rewrite outside `frontend/apps/usaha` in this phase.
- No requirement to eliminate every dropdown. Native selects remain acceptable for rare, compact choices where a richer control would add complexity without value.

## 4. Core UX rules

### 4.1 Modal policy

Blocking modal/dialog surfaces are allowed only for short confirmations or destructive/sensitive decisions, such as:

- confirm cancellation/void;
- enter mandatory correction reason;
- confirm archive/delete when recovery matters;
- show a concise warning that must be acknowledged.

They are not allowed for:

- editing an entire product;
- configuring a sale;
- checkout/payment;
- HPP/recipe editing;
- stock purchase recording;
- finance entry creation;
- order detail work;
- long multi-section forms.

Long work uses an inline workspace, side workspace on desktop, or full-screen stage on mobile.

### 4.2 Choice policy

- Small finite choices use chips/buttons/cards with the active choice visible.
- Searchable entities such as products, ingredients, team members, or large channel lists use a shared `SearchPicker` pattern.
- Existing selected entities become stable rows after insertion; users edit quantity/configuration, not repeatedly reselect identity.
- Inputs show units and business meaning next to the value.

### 4.3 Progressive disclosure

Default surfaces show only fields needed for the common case. Advanced sections contain:

- technical account choice;
- channel metadata;
- unusual stock modes;
- consignment terms;
- rare correction fields;
- supplier/internal notes;
- configuration only needed by a minority of businesses.

Advanced sections must never hide a required decision.

### 4.4 Operational preview

Before save, the UI should preview the effect in merchant language whenever possible:

- `+2 kg ke stok`;
- `Uang keluar Rp60.000`;
- `Biaya efektif Rp30.000/kg`;
- `Harga online Rp20.000 → diterima RpX → laba RpY`;
- `Dana Operasional turun RpX, Cadangan naik RpX`;
- `Transaksi lama dibalik, transaksi pengganti dibuat`.

### 4.5 Audit and idempotency

Existing immutable/auditable behavior remains the default:

- posted financial corrections use reversal + replacement;
- stock corrections use stock adjustment/audit events rather than silent mutation where an auditable endpoint already exists;
- cashier/payment writes keep idempotency protection;
- retries must not create duplicate business effects;
- permissions continue to gate visibility and mutation separately.

## 5. Shared interaction primitives

UX V3 may introduce a small set of Usaha-local reusable primitives. They are intentionally narrow and should not become a new cross-repo design system.

### `SearchPicker`

Purpose: choose one entity from a long list without a dropdown.

Requirements:

- search by human-readable label and optional secondary metadata;
- keyboard accessible;
- explicit empty state;
- selected item is obvious;
- supports disabled/read-only mode;
- does not place the entire page inside a blocking dialog.

### `ChoiceChips`

Purpose: 2–6 stable mutually exclusive choices.

Examples: product source, stock mode, account, payment source, finance category group, status.

### `OperationalPanel`

Purpose: persistent working area that owns one task and its preview/status.

Desktop may use a right-side workspace when the primary list/catalog should remain visible. Mobile uses a normal full-screen route/stage or stacked section.

### `EffectPreview`

Purpose: summarize the business consequences of the pending action before save.

It is presentation-only and must derive from the same values sent to the API; it must not invent an independent calculation model when shared business logic already exists.

### `SensitiveActionConfirm`

Purpose: short modal confirmation for archive/void/cancel/correction reasons. This is the approved modal use case.

## 6. Migration sequence

Implementation is intentionally staged. Each batch must be independently reviewable, tested, and mergeable.

### Batch 1 — Products and stock-facing product management

Current problems:

- product rows expose an `Aksi` layer and then a large `ModalSurface` for product management;
- the modal contains photo, identity, price, status, stock, and modifiers at once;
- add-product advanced fields still use several small-choice dropdowns.

Target design:

- selecting/managing a product opens a non-blocking product workspace;
- desktop: product list remains visible where practical, editor occupies a stable adjacent or in-page surface;
- mobile: product editor becomes a full-screen stage/page, not a dialog;
- core product section: photo, name, price, stock state;
- sales configuration section: modifiers/options;
- advanced section: category metadata, stock threshold, consignment/source details, notes;
- status uses visible choices such as `Aktif` / `Diarsipkan`;
- source uses visible choices such as `Milik sendiri` / `Titipan`;
- stock mode uses visible choices such as `Sudah dihitung` / `Perkiraan`;
- archive is visually separated from normal save actions;
- existing product and inventory API contracts remain authoritative.

Acceptance criteria:

- no `ModalSurface` is required to perform normal product editing;
- merchant can change price and stock without opening nested controls;
- modifier editing remains available without replacing the core product context;
- permissions and existing product routes continue to work.

### Batch 2 — Inventory purchase and real-yield observation

Current problems:

- ingredient, product, payment account, and primary-material selections use dropdowns;
- the purchase flow is structurally simple but visually behaves like an admin form;
- real-yield observation contains several technical selectors even though the merchant concept is sentence-like.

Target design:

#### Purchase flow

Present the task as:

`Beli [ingredient] · [quantity + purchase unit] · total [rupiah] · dibayar dari [source]`

- ingredient uses `SearchPicker`;
- payment source uses chips for common choices (`Kas`, `Bank`, `E-wallet`, `Utang usaha`);
- date/note remain under optional details unless changed from the default;
- preview shows stock delta, effective purchase cost, and cash/payable effect;
- one save action creates the same durable purchase effect as today.

#### Real-yield flow

Present the task as:

`[input quantity + unit] [ingredient] menghasilkan [output] [product/unit]`

- ingredient and optional product use search pickers;
- the UI shows existing evidence count, average, and confidence without requiring the merchant to calculate waste manually;
- primary-material mapping moves to advanced setup and uses search pickers rather than long selects.

Acceptance criteria:

- common purchase requires no long dropdown;
- the merchant sees stock and cash impact before save;
- yield observations preserve existing API semantics and learning data.

### Batch 3 — Finance activity and money allocation

Current problems:

- finance entry category, allocation bucket, account, channel, correction fields, and allocation movement use multiple `<select>` controls;
- backend behavior is strong, but the interaction still resembles an accounting form.

Target design:

#### New money entry

- start with visible `Uang masuk` / `Uang keluar`;
- show common business categories as cards/chips with human labels;
- amount is the visual primary input;
- common account/payment source is visible as chips;
- allocation bucket is optional and shown as chips when relevant;
- channel, date, note, and uncommon account choices live under details;
- preview describes whether the action changes cash, receivable/payable, and allocation.

#### Allocation movement

Replace `Dari <select> → Ke <select>` with a visual bucket picker:

- `Belum dibagi`, `Operasional`, `Gaji tim`, `Owner`, `Diputar lagi`, `Cadangan`;
- show current balances;
- prevent source and destination from being the same;
- preview balances after movement;
- reason remains mandatory because the operation is auditable.

#### Corrections

- correction UI stays inline with the history item or in a focused workspace;
- `Perbaiki` and `Batalkan` remain explicit choices;
- reason is mandatory;
- preview states `reversal + replacement` or `full reversal` in plain language;
- no mutation path may delete original finance history.

Acceptance criteria:

- common income/expense entry can be recorded without interacting with a long select;
- correction semantics and idempotency remain unchanged;
- summaries continue to match finance-core results.

### Batch 4 — Channel pricing and marketplace configuration

Current strengths:

- channel rows already use progressive disclosure and per-channel configuration;
- the design should be evolved, not rewritten.

Target design:

- each enabled channel shows a business summary first:
  - store price;
  - fee/promo deductions;
  - estimated net receipt;
  - estimated contribution profit;
  - recommended safe price when HPP is available;
- `Aktif / Tidak dipakai` remains immediate;
- technical fee, fixed-fee, promo, and target-margin fields move under `Atur perhitungan`;
- wording favors merchant language over platform/accounting terminology;
- calculation functions in existing costing modules remain the source of truth.

Acceptance criteria:

- a merchant can answer `kalau jual RpX di GoFood/GrabFood, saya terima dan untung berapa?` from the default row;
- no duplicated margin formula is introduced in presentation code.

### Batch 5 — Remaining setup and management surfaces

Audit and migrate `info`, `locations`, `team`, `buyer-page`, `operations`, and `reports` using the same rules.

Priority within this batch is based on frequency and friction, not file order. Each surface should be changed only when there is a concrete UX problem.

Typical targets:

- replace long entity selectors with `SearchPicker`;
- replace small enumerations with chips;
- move rare fields under advanced settings;
- remove unnecessary action menus that only reveal another editor;
- make status/permission limitations explicit;
- keep report views read-oriented rather than turning them into forms.

This batch must not rewrite already-good surfaces merely for visual novelty.

### Batch 6 — Legacy cleanup

After route usage and tests prove the V3 replacement paths:

- remove dead legacy wrappers/components where they are no longer imported;
- collapse `X` / `XV2` aliases to one canonical component name when safe;
- remove contract tests that assert superseded implementation details;
- keep behavior-oriented regression tests;
- do not delete a legacy component solely because a V2/V3 counterpart exists—prove it is unused first.

## 7. Responsive behavior

### Desktop

- preserve context with list + workspace layouts for products and similar management tasks;
- use sticky/persistent working panels only when they improve task continuity;
- avoid wide admin tables when a merchant list communicates the same information more clearly.

### Mobile

- no core workflow depends on side-by-side columns;
- editing/configuration uses ordinary full-screen stages or stacked panels;
- primary save/next action remains reachable without scrolling through unrelated advanced settings;
- search pickers are touch friendly and do not rely on hover;
- chips wrap horizontally or scroll when necessary without shrinking below usable tap targets.

## 8. Error, loading, and recovery behavior

- preserve server-provided error messages when safe and useful;
- validation should happen before network writes for obviously invalid numeric/text input;
- loading state disables only the action being submitted where possible, not the entire application;
- successful writes refresh only the data needed to reconcile the workspace;
- retryable transactional writes continue using idempotency when the underlying endpoint supports/requires it;
- failed saves must keep the user's unsaved inputs unless clearing them is necessary for safety;
- empty states tell the merchant what prerequisite is missing and link/point to the next action when possible.

## 9. Accessibility requirements

- all interactive primitives are keyboard reachable;
- selected state is conveyed semantically, not only by color;
- touch targets follow the existing portal minimum sizing conventions;
- search pickers expose labels, empty state, and focused/selected state;
- modal confirmation surfaces restore focus to the initiating control;
- mobile full-screen stages provide a clear back/close path that does not silently discard changes.

## 10. Data and permission boundaries

V3 is a presentation/workflow refactor first.

- Existing business permissions (`view*`, `manage*`, `createSales`, `voidSales`, `refundSales`, etc.) remain authoritative.
- UI must not expose mutation controls when the user lacks the corresponding permission.
- Internal order-engine mutation endpoints remain out of seller-facing Usaha unless a dedicated seller contract is designed separately.
- HPP/cost visibility continues to respect costing permissions.
- Finance-sensitive information continues to respect finance permissions.
- No client-side control is considered a security boundary; server routes remain responsible for authorization.

## 11. Testing strategy

Every implementation batch follows TDD and updates tests toward behavior rather than markup trivia.

Required coverage categories:

1. **Interaction contracts**
   - core workflows do not regress to blocking `ModalSurface` where prohibited;
   - small stable choices use visible choice controls;
   - entity selection is searchable where lists can grow.
2. **Business behavior**
   - payloads preserve existing API semantics;
   - stock/cash/margin previews match shared calculation helpers;
   - correction/reversal behavior remains immutable and auditable.
3. **Permission behavior**
   - view-only roles cannot mutate;
   - sensitive fields stay hidden when permission denies them.
4. **Responsive contracts**
   - desktop workspace and mobile staged flow both expose the necessary actions.
5. **Regression gates**
   - full `frontend/apps/usaha` tests;
   - TypeScript typecheck;
   - production build;
   - Usaha Business OS Gate;
   - repository Frontend lint/test/build where applicable;
   - runtime/image gates before final merge when CI provides them.

Tests that merely require a specific old component name, text marker, or `<select>` should be rewritten when the implementation detail is intentionally superseded. Tests that encode business invariants must remain.

## 12. Rollout and merge strategy

- One feature branch can host the V3 program, but implementation should be committed in independently reviewable batches.
- Prefer separate PRs for materially independent batches if the accumulated diff becomes hard to review.
- No batch merges when its Usaha-specific gate is red due to that batch.
- Repository-wide unrelated baseline failures must be documented and compared against `main` before deciding whether they block the UI change.
- `main` is updated only after the relevant branch head is verified and merge is performed with expected-head SHA protection.

## 13. Success criteria

UX V3 is successful when:

- daily merchant workflows can be understood without knowledge of the underlying database/accounting schema;
- no normal product, stock-purchase, finance-entry, cashier, HPP, or order-detail task requires a blocking long-form modal;
- common flows use visible choices and searchable entity pickers instead of repetitive long dropdowns;
- advanced/technical options remain available without dominating the default interface;
- every transactional workflow communicates its business effect before or immediately after save;
- audit, permissions, idempotency, stock integrity, and finance integrity remain intact;
- mobile users can complete the same business task without desktop-only interaction assumptions;
- legacy UI components are removed only after proven unused;
- CI and behavior tests enforce the new interaction contracts so future work does not drift back to the old patterns.

## 14. Explicit implementation order

1. Shared Usaha-local interaction primitives and contract tests.
2. Products/product management.
3. Inventory purchase + real-yield observation.
4. Finance activity + allocation + correction UX.
5. Channel pricing presentation.
6. Audit/migrate remaining setup and report surfaces where friction is proven.
7. Legacy cleanup.
8. Full verification and merge.

This order is deliberate: it improves the highest-frequency operational tasks first while keeping the most sensitive finance and cleanup work behind established shared patterns.