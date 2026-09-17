# Lajukan Usaha Flow System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Lajukan Usaha into one coherent merchant flow where products, customer choices, ingredients, product cost, POS checkout, stock, receipts, money, and reporting use one consistent set of rules and simple merchant-facing language.

**Architecture:** Keep `business_products.modifier_groups` as the canonical choice catalog and extract the existing WWW choice semantics into the shared frontend package so Usaha and WWW use the same normalization/default/validation/signature rules. Marketplace remains authoritative for selection validation, price, stock, recipe consumption, cost snapshots, and finance posting; POS evolves additively so configured lines are immutable snapshots rather than client-priced rows.

**Tech Stack:** Rust/Axum/SQLx/Postgres, Next.js 16, React 19.2, TypeScript 5.9, Tailwind CSS 3.4, Lucide React, Vitest, existing `lajukan-ui` frontend package, native `<dialog>` via the existing Usaha `ModalSurface` interaction system.

**Spec:** `docs/superpowers/specs/2026-09-16-usaha-flow-system-design.md`

## Global Constraints

- User-facing flow is `Barang → Pilihan pelanggan → Bahan & kemasan → Modal produk → Kasir → Pesanan → Stok → Uang → Laporan`.
- User-facing copy says `Pilihan pelanggan`; internal code may retain `modifier` terminology.
- Primary costing label is `Modal produk`; `HPP per porsi` is supporting terminology only.
- Products with no choice groups stay one-tap in Kasir; any product with one or more choice groups opens the configurator by default.
- Same product + same normalized configuration + same meaningful note may merge quantity; a different configuration or note is a different line.
- Client prices are previews only. Marketplace recomputes the authoritative base price, choice deltas, stock requirement, cost snapshot, and final total.
- `business_products.modifier_groups` remains the canonical choice store. Do not introduce a Kasir-only choice store.
- Public storefront projection contains only public-safe choice information and must not leak cost, supplier, consignment, owner, or private-note data.
- Different configured lines of one physical product must be aggregated before base stock validation/decrement.
- Ingredient consumption is derived from the normalized final configuration, aggregated by ingredient, and applied transactionally with the sale.
- Historical receipts/reporting use immutable transaction snapshots; later catalog or ingredient-price changes never rewrite prior transactions.
- Finance bucket targets remain planning metadata; spending from one bucket only reduces that bucket.
- Existing routes and permissions remain compatible unless an additive API field is explicitly introduced by this plan.
- Never edit an already-applied migration. Schema changes use new versioned migrations with LF line endings.
- Reuse the existing Usaha interaction system (`ModalSurface`) rather than feature-local overlays or arbitrary z-index values.
- Keep mobile navigation positions stable: `Beranda · Jual · Barang · Uang · Lainnya`.
- No new framework dependency is required for dialogs or choice handling.

## File Structure and Ownership

### Shared frontend product-configuration domain

- Create `frontend/packages/product-configuration/index.ts` — canonical frontend types and pure normalization/default/validation/signature/preview helpers used by both apps.
- Create `frontend/packages/test/product-configuration.test.ts` — cross-app semantic contract.
- Modify `frontend/packages/index.ts` — export product-configuration domain.
- Modify `frontend/apps/usaha/package.json` and `frontend/apps/usaha/package-lock.json` — consume the existing local `lajukan-ui` package.
- Modify `frontend/apps/www/src/lib/super-app/storefront-product-modifiers.ts` — become a compatibility facade/re-export so existing call sites can migrate without two implementations.

### Marketplace product choices

- Create `services/marketplace_service/src/businesses/modifier_resolution.rs` — one selection resolver for public checkout and POS.
- Modify `services/marketplace_service/src/businesses/mod.rs` — register the resolver module.
- Modify `services/marketplace_service/src/businesses/product_modifiers.rs` — retain catalog validation/persistence and add optional recipe effects.
- Modify `services/marketplace_service/src/businesses/public_commerce.rs` — consume shared resolver instead of owning a second resolver.
- Modify `services/marketplace_service/src/businesses/products.rs` — include canonical `modifier_groups` in business product reads so Usaha/Kasir can render choices.

### Usaha product/catalog flow

- Modify `frontend/apps/usaha/src/lib/portal-types.ts` — add typed modifier groups to `ProductRecord`.
- Modify `frontend/apps/usaha/src/lib/business-server.ts` — parse modifier groups from canonical product payload.
- Modify `frontend/apps/usaha/src/components/forms/ProductModifierEditor.tsx` — merchant language, templates, preview, advanced ingredient effects.
- Add/modify tests under `frontend/apps/usaha/src/components/forms/` for editor contracts.

### Kasir/POS

- Modify `frontend/apps/usaha/src/components/business-control/quick-sale.ts` — configured-line model, identity, serialization, receipt display helpers.
- Modify `frontend/apps/usaha/src/components/business-control/quick-sale.test.ts` — TDD contract for configured lines and request authority.
- Create `frontend/apps/usaha/src/components/business-control/QuickSaleProductConfigurator.tsx` — responsive choice UI using `ModalSurface`.
- Create `frontend/apps/usaha/src/components/business-control/QuickSaleProductConfigurator.test.tsx` — required/optional/default/edit behavior.
- Modify `frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx` — open configurator, edit lines, merge only identical line identities, render summaries.

### POS backend and immutable snapshots

- Create `services/marketplace_service/migrations/20260916120000_business_sale_configuration_snapshot.up.sql`.
- Create `services/marketplace_service/migrations/20260916120000_business_sale_configuration_snapshot.down.sql`.
- Modify `services/marketplace_service/src/businesses/sales.rs` — additive configured-sale request, server pricing, aggregate product stock, recipe-effect consumption, snapshots.
- Modify `frontend/apps/usaha/src/lib/business-control-server.ts` — expose configuration/note snapshot fields returned by Marketplace.

### Modal Produk / HPP

- Modify `frontend/apps/usaha/src/components/business-control/DurableHppWorkspace.tsx` — summary-first merchant UX and one price source of truth.
- Modify/add `DurableHppWorkspace` tests under `frontend/apps/usaha/src/components/business-control/`.
- Reuse `frontend/apps/usaha/src/lib/business-control/costing.ts`; do not create a second costing formula.

### WWW storefront

- Modify `frontend/apps/www/src/app/[locale]/(shared)/toko/[slug]/StorefrontProductConfigurator.tsx` — consume shared domain and preserve current adaptive UI.
- Modify `frontend/apps/www/src/lib/super-app/storefront-order-client.ts` only if type imports need to move to the shared model.
- Modify storefront product-modifier tests to prove WWW and Usaha use the same semantics.

---

### Task 1: Extract one shared frontend product-configuration domain

**Files:**
- Create: `frontend/packages/product-configuration/index.ts`
- Create: `frontend/packages/test/product-configuration.test.ts`
- Modify: `frontend/packages/index.ts`
- Modify: `frontend/apps/usaha/package.json`
- Modify: `frontend/apps/usaha/package-lock.json`
- Modify: `frontend/apps/www/src/lib/super-app/storefront-product-modifiers.ts`

**Interfaces:**
- Produces:
  - `ProductModifierOption`
  - `ProductModifierGroup`
  - `ProductModifierSelection`
  - `parseProductModifierGroups(metadata)`
  - `orderedProductModifierGroups(groups)`
  - `defaultProductModifierSelections(groups)`
  - `validateProductModifierSelections(groups, selections)`
  - `configuredPriceCents(basePriceCents, groups, selections)`
  - `productConfigurationSignature(selections)`
  - `productConfigurationSummary(groups, selections)`
- Consumers: WWW configurator, Usaha product adapter, Kasir configurator, quick-sale line identity.

- [ ] **Step 1: Write the shared-domain failing tests**

Create `frontend/packages/test/product-configuration.test.ts` with concrete behavior:

```ts
import { describe, expect, it } from 'vitest';
import {
  configuredPriceCents,
  defaultProductModifierSelections,
  orderedProductModifierGroups,
  parseProductModifierGroups,
  productConfigurationSignature,
  productConfigurationSummary,
  validateProductModifierSelections,
} from '../product-configuration';

const metadata = {
  modifier_groups: [
    {
      id: 'topping',
      name: 'Topping',
      selection_mode: 'multiple',
      required: false,
      min_selections: 0,
      max_selections: 2,
      options: [
        { id: 'boba', label: 'Boba', price_delta_cents: 300_000, is_default: false, enabled: true },
      ],
    },
    {
      id: 'sugar',
      name: 'Tingkat gula',
      selection_mode: 'single',
      required: true,
      min_selections: 1,
      max_selections: 1,
      options: [
        { id: 'normal', label: 'Normal', price_delta_cents: 0, is_default: true, enabled: true },
        { id: 'less', label: 'Less Sugar', price_delta_cents: 0, is_default: false, enabled: true },
      ],
    },
  ],
};

describe('product configuration domain', () => {
  it('parses public-safe groups and orders required groups first', () => {
    const groups = parseProductModifierGroups(metadata);
    expect(orderedProductModifierGroups(groups).map(group => group.id)).toEqual(['sugar', 'topping']);
  });

  it('builds valid defaults and deterministic signatures', () => {
    const groups = parseProductModifierGroups(metadata);
    const selections = defaultProductModifierSelections(groups);
    expect(validateProductModifierSelections(groups, selections)).toEqual({});
    expect(productConfigurationSignature([
      { group_id: 'sugar', option_ids: ['less'] },
      { group_id: 'topping', option_ids: ['boba'] },
    ])).toBe('sugar=less|topping=boba');
  });

  it('prices and summarizes the selected options', () => {
    const groups = parseProductModifierGroups(metadata);
    const selections = [
      { group_id: 'sugar', option_ids: ['less'] },
      { group_id: 'topping', option_ids: ['boba'] },
    ];
    expect(configuredPriceCents(1_200_000, groups, selections)).toBe(1_500_000);
    expect(productConfigurationSummary(groups, selections)).toBe('Less Sugar · Boba');
  });
});
```

- [ ] **Step 2: Run the new test and verify it fails because the shared module does not exist**

Run:

```bash
cd frontend/packages
npx vitest run test/product-configuration.test.ts
```

Expected: FAIL resolving `../product-configuration`.

- [ ] **Step 3: Implement the shared pure domain**

Create `frontend/packages/product-configuration/index.ts`. Keep the backend JSON field names so Usaha and WWW do not translate the same payload differently:

```ts
export type ProductModifierRecipeEffect = {
  ingredient_id: string;
  operation: 'add' | 'set';
  quantity: number;
};

export type ProductModifierOption = {
  id: string;
  label: string;
  price_delta_cents: number;
  is_default: boolean;
  enabled: boolean;
  recipe_effects?: ProductModifierRecipeEffect[];
};

export type ProductModifierGroup = {
  id: string;
  name: string;
  selection_mode: 'single' | 'multiple';
  required: boolean;
  min_selections: number;
  max_selections: number;
  options: ProductModifierOption[];
};

export type ProductModifierSelection = {
  group_id: string;
  option_ids: string[];
};
```

Move the existing parsing/default/validation/price/signature behavior from WWW into this module, with these additional invariants:

```ts
export function orderedProductModifierGroups(groups: ProductModifierGroup[]) {
  return groups
    .map((group, index) => ({ group, index }))
    .sort((a, b) => Number(b.group.required) - Number(a.group.required) || a.index - b.index)
    .map(item => item.group);
}

export function productConfigurationSummary(
  groups: ProductModifierGroup[],
  selections: ProductModifierSelection[],
) {
  const selected = new Map(selections.map(item => [item.group_id, new Set(item.option_ids)]));
  return groups
    .flatMap(group => group.options.filter(option => selected.get(group.id)?.has(option.id)).map(option => option.label))
    .join(' · ');
}
```

Parsing must drop disabled options, duplicate group/option IDs, malformed values, and private unknown metadata. `recipe_effects` may be parsed only from explicit effect fields and must never expose unrelated metadata.

- [ ] **Step 4: Export the shared module and preserve WWW compatibility**

Modify `frontend/packages/index.ts`:

```ts
export * from './ui/index';
export { cn } from './utils/cn';
export * from './product-configuration/index';
```

Make `frontend/apps/www/src/lib/super-app/storefront-product-modifiers.ts` a thin compatibility facade that aliases the shared functions/types under the existing WWW names so current imports do not break in this task:

```ts
export type {
  ProductModifierGroup as StorefrontModifierGroup,
  ProductModifierOption as StorefrontModifierOption,
  ProductModifierSelection as StorefrontModifierSelection,
} from 'lajukan-ui';

export {
  parseProductModifierGroups as parseStorefrontModifierGroups,
  defaultProductModifierSelections as defaultStorefrontSelections,
  validateProductModifierSelections as validateStorefrontSelections,
  configuredPriceCents as estimatedConfiguredPriceCents,
  productConfigurationSignature as storefrontConfigurationSignature,
} from 'lajukan-ui';
```

- [ ] **Step 5: Add the existing local package dependency to Usaha**

Run from `frontend/apps/usaha`:

```bash
npm install --save "lajukan-ui@file:../../packages"
```

Verify both `package.json` and `package-lock.json` contain the local dependency. Do not hand-invent lockfile integrity values.

- [ ] **Step 6: Verify shared package and both app type resolution**

Run:

```bash
cd frontend/packages && npm run build && npm test
cd ../apps/usaha && npm run typecheck
cd ../www && npx tsc --noEmit --pretty false
```

Expected: all PASS.

- [ ] **Step 7: Commit the shared semantic layer**

```bash
git add frontend/packages frontend/apps/usaha/package.json frontend/apps/usaha/package-lock.json frontend/apps/www/src/lib/super-app/storefront-product-modifiers.ts
git commit -m "refactor(commerce): share product configuration semantics"
```

---

### Task 2: Extract one Marketplace modifier-selection resolver

**Files:**
- Create: `services/marketplace_service/src/businesses/modifier_resolution.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`
- Modify: `services/marketplace_service/src/businesses/public_commerce.rs`
- Modify: `services/marketplace_service/src/businesses/product_modifiers.rs`

**Interfaces:**
- Consumes: `ProductModifierGroup` from `product_modifiers.rs`.
- Produces:
  - `ModifierSelectionInput { group_id, option_ids }`
  - `ModifierSnapshot`
  - `ResolvedModifierSelection { signature, price_delta_cents, snapshots, recipe_effects }`
  - `resolve_modifier_selection(groups, selections)`
- Public commerce and POS sales must use this one function.

- [ ] **Step 1: Add failing resolver tests before moving public-commerce logic**

In the new module, write unit tests for:

```rust
#[test]
fn different_choices_produce_different_signatures() {
    let groups = sugar_groups();
    let normal = resolve_modifier_selection(
        &groups,
        &[ModifierSelectionInput::single("sugar", "normal")],
    ).unwrap();
    let less = resolve_modifier_selection(
        &groups,
        &[ModifierSelectionInput::single("sugar", "less")],
    ).unwrap();
    assert_ne!(normal.signature, less.signature);
}

#[test]
fn server_price_delta_comes_from_catalog_option() {
    let resolved = resolve_modifier_selection(
        &topping_groups(),
        &[ModifierSelectionInput::single("topping", "boba")],
    ).unwrap();
    assert_eq!(resolved.price_delta_cents, 300_000);
}

#[test]
fn unavailable_or_unknown_option_is_rejected() {
    let error = resolve_modifier_selection(
        &sugar_groups(),
        &[ModifierSelectionInput::single("sugar", "invented")],
    ).unwrap_err();
    assert_eq!(error, ModifierResolutionError::InvalidOption);
}
```

Use a real constructor in the module for test inputs rather than adding a production-only convenience API solely for tests.

- [ ] **Step 2: Run targeted Rust tests and prove the new module is not implemented**

```bash
cd services/marketplace_service
cargo test modifier_resolution --locked
```

Expected: FAIL until module/types/functions exist.

- [ ] **Step 3: Move selection resolution out of `public_commerce.rs`**

The resolver must:
- reject unknown group IDs
- reject duplicate submitted group IDs
- reject option IDs that do not belong to the submitted group
- reject disabled options
- enforce normalized min/max/required rules
- sort group IDs and option IDs deterministically before producing signature
- sum `price_delta_cents` with checked arithmetic
- return label/price snapshots

Use an explicit error enum and map it to existing public-commerce validation codes at the route/repository edge; do not make the resolver depend on HTTP types.

- [ ] **Step 4: Make public commerce consume the shared resolver**

Replace local `PublicModifierSelectionInput`, `ModifierSnapshot`, and resolution implementation where they duplicate the new module. Keep the public request JSON shape unchanged:

```json
{
  "group_id": "sugar",
  "option_ids": ["less"]
}
```

Existing public order snapshots and authoritative price behavior must remain byte-compatible where possible.

- [ ] **Step 5: Run public-commerce regression tests**

```bash
cd services/marketplace_service
cargo test public_commerce --locked
```

Expected: existing modifier/order tests PASS without changing external request semantics.

- [ ] **Step 6: Commit the backend semantic extraction**

```bash
git add services/marketplace_service/src/businesses
git commit -m "refactor(marketplace): share modifier selection resolution"
```

---

### Task 3: Add optional recipe effects to customer choices

**Files:**
- Modify: `services/marketplace_service/src/businesses/product_modifiers.rs`
- Modify: `services/marketplace_service/src/businesses/modifier_resolution.rs`
- Modify: `frontend/packages/product-configuration/index.ts`
- Modify: `frontend/packages/test/product-configuration.test.ts`

**Interfaces:**
- Adds to an option:

```json
{
  "recipe_effects": [
    { "ingredient_id": "<uuid>", "operation": "set", "quantity": "10" }
  ]
}
```

- `set` replaces that ingredient's per-unit base-recipe quantity before additive effects.
- `add` adds a quantity after any `set` effect.
- Selecting two `set` effects for the same ingredient in one configured line is rejected as a conflict.

- [ ] **Step 1: Write failing Rust validation tests**

Add cases that prove:
- `set 10` and `add 30` serialize/deserialize
- quantity must be non-negative and finite/valid Decimal
- ingredient ID must be non-nil UUID
- one option cannot contain duplicate effect rows for the same `(ingredient_id, operation)`
- a bounded maximum effect count per option is enforced

Example core assertion:

```rust
assert_eq!(
    validate_groups(vec![group_with_effect("sugar", "less", ingredient_id, "set", "10")])
        .unwrap()[0].options[0].recipe_effects[0].quantity,
    Decimal::new(10, 0),
);
```

- [ ] **Step 2: Run the modifier tests and observe failure**

```bash
cd services/marketplace_service
cargo test product_modifiers --locked
```

- [ ] **Step 3: Add typed recipe-effect structures**

Use:

```rust
#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ModifierRecipeOperation {
    Add,
    Set,
}

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) struct ModifierRecipeEffect {
    pub(crate) ingredient_id: Uuid,
    pub(crate) operation: ModifierRecipeOperation,
    pub(crate) quantity: Decimal,
}
```

Add `#[serde(default)] recipe_effects` to `ProductModifierOption`. Keep old stored JSON valid because omitted arrays default to empty.

- [ ] **Step 4: Resolve effect conflicts at order selection time**

`resolve_modifier_selection` returns all selected recipe effects. Reject a final configuration containing more than one `set` effect for the same ingredient. Allow multiple `add` effects and sum them later in the recipe application layer.

- [ ] **Step 5: Extend shared frontend parser without trusting arbitrary metadata**

Parse only `ingredient_id`, `operation`, and finite non-negative `quantity` from recipe effects. Invalid effect rows are omitted from the client preview model; Marketplace remains authoritative and rejects invalid persisted writes.

- [ ] **Step 6: Verify Rust and shared package tests**

```bash
cd services/marketplace_service && cargo test product_modifiers modifier_resolution --locked
cd ../../frontend/packages && npm test
```

- [ ] **Step 7: Commit optional recipe effects**

```bash
git add services/marketplace_service/src/businesses frontend/packages
git commit -m "feat(products): support choice effects on recipe usage"
```

---

### Task 4: Expose canonical choices to Usaha and improve the product editor

**Files:**
- Modify: `services/marketplace_service/src/businesses/products.rs`
- Modify: `frontend/apps/usaha/src/lib/portal-types.ts`
- Modify: `frontend/apps/usaha/src/lib/business-server.ts`
- Modify: `frontend/apps/usaha/src/components/forms/ProductModifierEditor.tsx`
- Modify/create tests under `frontend/apps/usaha/src/components/forms/`

**Interfaces:**
- `BusinessProduct` response gains additive `modifier_groups`.
- `ProductRecord` gains `modifierGroups: ProductModifierGroup[]`.
- The editor continues using the existing `/modifiers` endpoint and existing ingredients endpoint; no duplicate catalog endpoint is created.

- [ ] **Step 1: Write backend product serialization test/contract**

Add a product-repository/serialization assertion that a product with canonical modifier JSON is returned with `modifier_groups`, while a product without choices returns `[]`.

The SQL projection must read:

```sql
COALESCE(p.modifier_groups, '[]'::jsonb) AS modifier_groups
```

from `business_products`, not from `umkm_products`.

- [ ] **Step 2: Add `modifier_groups` to `BusinessProduct` and `PRODUCT_SELECT`**

Use `serde_json::Value` or a typed vector consistently with the existing SQL row conversion. Do not change product IDs or existing fields.

- [ ] **Step 3: Add a failing Usaha mapping test**

Test `mapCanonicalProduct` through the existing business-server test surface so this backend payload:

```ts
{
  id: 'p1',
  name: 'Jus Buah Naga',
  price_label: 'Rp12.000',
  modifier_groups: [{
    id: 'sugar', name: 'Tingkat gula', selection_mode: 'single', required: true,
    min_selections: 1, max_selections: 1,
    options: [{ id: 'normal', label: 'Normal', price_delta_cents: 0, is_default: true, enabled: true }],
  }],
}
```

maps to `product.modifierGroups[0].id === 'sugar'`.

- [ ] **Step 4: Extend `ProductRecord` and adapter**

Import `ProductModifierGroup` from `lajukan-ui` and set:

```ts
modifierGroups: parseProductModifierGroups({
  modifier_groups: item.modifier_groups ?? item.modifierGroups,
}),
```

The empty/missing field must become `[]`.

- [ ] **Step 5: Write editor UX tests before changing the editor**

Tests/contract assertions must cover visible merchant copy:
- heading `Pilihan pelanggan`
- template actions `Tingkat gula`, `Es`, `Topping`, `Level pedas`, `Jenis susu`, `Kemasan`
- simple labels `Pelanggan pilih satu`, `Pelanggan boleh pilih beberapa`, `Wajib dipilih`, `Pilihan awal`, `Harga tambahan`, `Tersedia`
- advanced section `Pengaruh ke bahan`
- no primary UI copy exposing `selection_mode`, `min_selections`, `canonical`, or raw JSON terminology.

- [ ] **Step 6: Add templates and checkout preview**

Template selection creates normal editable groups. For example `Tingkat gula` creates:

```ts
{
  id: generatedStableId,
  name: 'Tingkat gula',
  selection_mode: 'single',
  required: true,
  min_selections: 1,
  max_selections: 1,
  options: [
    { id: generatedId, label: 'Normal', price_delta_cents: 0, is_default: true, enabled: true },
    { id: generatedId, label: 'Less Sugar', price_delta_cents: 0, is_default: false, enabled: true },
    { id: generatedId, label: 'Tanpa Gula', price_delta_cents: 0, is_default: false, enabled: true },
  ],
}
```

Generated IDs must be stable within the editing session and remain valid backend IDs; labels remain fully editable.

- [ ] **Step 7: Add the optional `Pengaruh ke bahan` editor**

When expanded, fetch:

```text
GET /api/businesses/{businessId}/ingredients
```

Each effect row lets the merchant choose:
- ingredient
- `Jadikan pemakaian` (`set`) or `Tambahkan pemakaian` (`add`)
- quantity in the ingredient recipe unit

Show explanatory examples rather than accounting jargon. If no ingredients exist, link to `Bahan & kemasan` instead of showing an empty technical form.

- [ ] **Step 8: Verify product/editing scope**

```bash
cd frontend/apps/usaha
npm run test -- Product
npm run typecheck
cd ../../../services/marketplace_service
cargo test product_modifiers products --locked
```

- [ ] **Step 9: Commit canonical choices through the Usaha product flow**

```bash
git add services/marketplace_service/src/businesses/products.rs frontend/apps/usaha
git commit -m "feat(usaha): make customer choices easy to configure"
```

---

### Task 5: Define configured POS line identity and request serialization

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/quick-sale.ts`
- Modify: `frontend/apps/usaha/src/components/business-control/quick-sale.test.ts`

**Interfaces:**

`QuickSaleLineDraft` becomes:

```ts
export type QuickSaleLineDraft = {
  productId: string;
  quantity: number | string;
  basePriceAmount: number | string;
  unitPricePreviewAmount: number | string;
  discountAmount: number | string;
  selectedOptions: ProductModifierSelection[];
  note?: string;
  configurationSignature: string;
};
```

Produces:
- `quickSaleLineIdentity(line)`
- `mergeQuickSaleLine(lines, incoming)`
- request serializer that sends product ID, quantity, selected options, note, discount, but not authoritative unit price.

- [ ] **Step 1: Write failing identity tests**

```ts
it('keeps Normal and Less Sugar as separate lines', () => {
  const normal = line({ selectedOptions: [{ group_id: 'sugar', option_ids: ['normal'] }] });
  const less = line({ selectedOptions: [{ group_id: 'sugar', option_ids: ['less'] }] });
  expect(quickSaleLineIdentity(normal)).not.toBe(quickSaleLineIdentity(less));
});

it('merges identical configuration and note', () => {
  const first = line({ quantity: 1, selectedOptions: [{ group_id: 'sugar', option_ids: ['less'] }], note: '' });
  const second = line({ quantity: 2, selectedOptions: [{ group_id: 'sugar', option_ids: ['less'] }], note: '' });
  expect(mergeQuickSaleLine([first], second)[0].quantity).toBe(3);
});

it('keeps different notes separate', () => {
  const first = line({ note: 'tanpa sedotan' });
  const second = line({ note: 'pakai sedotan' });
  expect(quickSaleLineIdentity(first)).not.toBe(quickSaleLineIdentity(second));
});
```

- [ ] **Step 2: Write failing request-authority test**

```ts
const request = buildQuickSaleRequest(draft);
expect(request.lines[0]).toEqual({
  product_id: 'p1',
  quantity: 1,
  discount_amount: 0,
  selected_options: [{ group_id: 'sugar', option_ids: ['less'] }],
  note: 'es sedikit',
});
expect(request.lines[0]).not.toHaveProperty('unit_price_amount');
```

- [ ] **Step 3: Run tests and confirm old productId-only behavior fails**

```bash
cd frontend/apps/usaha
npx vitest run src/components/business-control/quick-sale.test.ts
```

- [ ] **Step 4: Implement deterministic line identity**

Use the shared `productConfigurationSignature`; normalize line note by trimming and collapsing internal whitespace for identity, while preserving a clean display note for the request.

```ts
export function quickSaleLineIdentity(line: Pick<QuickSaleLineDraft, 'productId' | 'selectedOptions' | 'note'>) {
  return [
    line.productId,
    productConfigurationSignature(line.selectedOptions),
    normalizeLineNote(line.note),
  ].join('::');
}
```

- [ ] **Step 5: Keep preview totals client-side but remove price authority from request**

`quickSaleTotal` continues to use `unitPricePreviewAmount` for instant UI. `buildQuickSaleRequest` sends no unit price. Discount remains an amount submitted to the server and is validated against the server-computed gross line value.

- [ ] **Step 6: Extend receipt view types**

Add:

```ts
export type ReceiptLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  configurationSummary?: string;
  note?: string;
};
```

`buildReceiptShareText` prints choice summary and note on indented secondary lines.

- [ ] **Step 7: Run tests and commit**

```bash
cd frontend/apps/usaha
npx vitest run src/components/business-control/quick-sale.test.ts

git add frontend/apps/usaha/src/components/business-control/quick-sale.ts frontend/apps/usaha/src/components/business-control/quick-sale.test.ts
git commit -m "feat(pos): model configured sale lines"
```

---

### Task 6: Add the Kasir product configurator and cart editing

**Files:**
- Create: `frontend/apps/usaha/src/components/business-control/QuickSaleProductConfigurator.tsx`
- Create: `frontend/apps/usaha/src/components/business-control/QuickSaleProductConfigurator.test.tsx`
- Modify: `frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx`

**Interfaces:**

```ts
type QuickSaleConfigurationDraft = {
  selectedOptions: ProductModifierSelection[];
  quantity: number;
  note: string;
};
```

Configurator props include product, open state, optional initial draft for editing, and `onConfirm(draft)`.

- [ ] **Step 1: Write component tests for the merchant flow**

Cover:
1. Required `Tingkat gula` appears before optional `Topping`.
2. `Normal` default is preselected.
3. Choosing `Less Sugar` updates preview price/summary.
4. Multiple topping max constraint disables excess unchecked options.
5. Confirm returns IDs, quantity, and note.
6. Reopening from a cart line populates its current configuration.

Use accessible labels (`role=radio`, `role=checkbox`, button names) rather than test IDs.

- [ ] **Step 2: Run component test and verify failure because configurator does not exist**

```bash
cd frontend/apps/usaha
npx vitest run src/components/business-control/QuickSaleProductConfigurator.test.tsx
```

- [ ] **Step 3: Implement configurator using `ModalSurface`**

Presentation rules:
- `presentation="adaptive"`
- mobile behaves as large bottom sheet
- desktop centered dialog
- required groups first via `orderedProductModifierGroups`
- radio for single, checkbox for multiple
- disabled option is not interactive
- sticky footer displays `quantity • preview total`
- CTA text `Tambah ke pesanan` for new line and `Simpan perubahan` when editing
- optional `Catatan pesanan ini`
- close restores focus to the product/cart trigger via `ModalSurface`

Do not add another raw `<dialog>` implementation in Usaha.

- [ ] **Step 4: Replace `QuickSaleWorkspace.addProduct` productId-only merge**

Behavior:

```ts
function chooseProduct(product: ProductOption) {
  if (product.modifierGroups.length === 0) {
    addConfiguredLine(makeDefaultLine(product));
    return;
  }
  setConfiguring({ product, existingKey: null });
}
```

`ProductOption` gains `modifierGroups`. Products without groups remain exactly one-tap.

- [ ] **Step 5: Add cart-line editing**

Make product name/configuration area in each cart line an accessible button. Clicking it opens the same configurator with current selections/note/quantity. Saving an edit removes the old identity first, then merges with an existing identical target line if one exists.

- [ ] **Step 6: Render human-readable choice summaries**

Cart line example:

```text
Jus Buah Naga
Less Sugar · Es Normal · Boba
Rp15.000 × 1
```

Notes appear as muted secondary copy and never become part of the product name.

- [ ] **Step 7: Verify direct-add and configured-add paths**

```bash
cd frontend/apps/usaha
npm run test -- QuickSale
npm run typecheck
```

- [ ] **Step 8: Commit POS UI**

```bash
git add frontend/apps/usaha/src/components/business-control
git commit -m "feat(pos): configure customer choices at checkout"
```

---

### Task 7: Make POS pricing and snapshots authoritative in Marketplace

**Files:**
- Create: `services/marketplace_service/migrations/20260916120000_business_sale_configuration_snapshot.up.sql`
- Create: `services/marketplace_service/migrations/20260916120000_business_sale_configuration_snapshot.down.sql`
- Modify: `services/marketplace_service/src/businesses/sales.rs`
- Modify: `frontend/apps/usaha/src/lib/business-control-server.ts`

**Interfaces:**

Additive POS line request:

```rust
pub(crate) struct CreateSaleLineRequest {
    pub(crate) product_id: Uuid,
    pub(crate) quantity: Decimal,
    #[serde(default)]
    pub(crate) discount_amount: i64,
    #[serde(default)]
    pub(crate) selected_options: Vec<ModifierSelectionInput>,
    pub(crate) note: Option<String>,
    #[serde(default)]
    pub(crate) unit_price_amount: Option<i64>, // deployment compatibility only; ignored for authority
}
```

`unit_price_amount` remains temporarily accepted so an older deployed Usaha frontend does not break during rolling deployment, but Marketplace must never use it to determine final price.

- [ ] **Step 1: Add the new migration files**

Up migration:

```sql
ALTER TABLE business_sale_lines
  ADD COLUMN configuration_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN line_note TEXT;
```

Down migration:

```sql
ALTER TABLE business_sale_lines
  DROP COLUMN IF EXISTS line_note;

ALTER TABLE business_sale_lines
  DROP COLUMN IF EXISTS configuration_snapshot;
```

Do not alter the prior Finance Core/business sales migration.

- [ ] **Step 2: Write failing sale tests for server price authority**

A test fixture has catalog price Rp12.000 and Boba +Rp3.000. Submit either no legacy unit price or a deliberately false legacy price. Assert stored line is Rp15.000:

```rust
assert_eq!(created.sale.lines[0].unit_price_amount, 15_000);
assert_ne!(created.sale.lines[0].unit_price_amount, 1);
```

Use the service's amount unit consistently; public `price_cents` and business `price_label` conversions must not be mixed accidentally.

- [ ] **Step 3: Write failing immutable snapshot test**

After creating the Less Sugar + Boba sale, assert `configuration_snapshot` includes:
- deterministic signature
- `Tingkat gula / Less Sugar`
- `Topping / Boba`
- Boba price delta
- normalized display summary

Then rename the current Boba catalog option and reload the old sale; assert the old sale snapshot still says `Boba`.

- [ ] **Step 4: Load canonical product and resolve choices inside `prepare_line`**

Query canonical `business_products` within the same transaction for:
- name
- `price_label`
- `modifier_groups`

Parse the canonical business price using the existing product price parser (make that parser `pub(crate)` if required). Do not read a request-supplied unit price for authority.

Call `resolve_modifier_selection` and calculate:

```rust
let authoritative_unit_price = base_price_amount
    .checked_add(resolved.price_delta_amount)
    .ok_or(SaleRepositoryError::Validation("sale_amount_overflow"))?;
```

Reject a non-positive configured price.

- [ ] **Step 5: Validate note and discount against authoritative gross**

Normalize note to at most 200 Unicode scalar values/characters using the same explicit bounded-text approach used elsewhere. Then compute gross from authoritative unit price × quantity and reject `discount_amount > gross`.

- [ ] **Step 6: Store configuration and note snapshots**

Extend `PreparedSaleLine` / `SaleLineRecord` and SQL inserts/selects with:
- `configuration_snapshot`
- `line_note`

The snapshot is generated server-side, not copied from client display text.

- [ ] **Step 7: Keep idempotent replay stable**

Replaying the same sale idempotency key returns the stored line snapshots and prices. It must not recompute using a newly edited catalog.

- [ ] **Step 8: Extend Usaha server types**

`ControlSaleLine` gains:

```ts
configuration_snapshot: {
  signature?: string;
  summary?: string;
  options?: Array<{
    group_id: string;
    group_name: string;
    option_id: string;
    option_label: string;
    price_delta_amount: number;
  }>;
};
line_note: string | null;
```

Keep fields tolerant for older rows/mocked responses.

- [ ] **Step 9: Run migration/sale tests**

```bash
cd services/marketplace_service
cargo test sales --locked
```

Expected: authoritative price, snapshot, and idempotency tests PASS.

- [ ] **Step 10: Commit POS authority and snapshots**

```bash
git add services/marketplace_service/migrations services/marketplace_service/src/businesses/sales.rs frontend/apps/usaha/src/lib/business-control-server.ts
git commit -m "feat(sales): price configured POS lines on the server"
```

---

### Task 8: Aggregate base-product and ingredient stock across configured lines

**Files:**
- Modify: `services/marketplace_service/src/businesses/sales.rs`
- Modify: `services/marketplace_service/src/businesses/modifier_resolution.rs` if the resolved effect shape needs a dedicated public type.

**Interfaces:**
- Base stock aggregates by `product_id` before any mutation.
- Ingredient consumption aggregates by `ingredient_id` after applying selected option recipe effects and multiplying by quantity.

- [ ] **Step 1: Write the duplicate-base-product regression test**

Fixture stock for `Jus Buah Naga` is 1. Submit:
- Normal ×1
- Less Sugar ×1

Assert:

```rust
assert_eq!(result, Err(SaleRepositoryError::InsufficientStock));
```

This must fail before any sale, finance, product stock, or ingredient stock row mutates.

- [ ] **Step 2: Write the successful aggregate decrement test**

With base stock 5, submit Normal ×1 and Less Sugar ×1. Assert post-sale base stock is 3, not 4 and not unchanged.

- [ ] **Step 3: Write recipe-effect consumption tests**

Base recipe sugar = 20g per unit.
- Normal ×1 consumes 20g.
- Less Sugar with `set 10` ×1 consumes 10g.
- Boba with `add 30` consumes 30g boba in addition to the base recipe.

A request containing Normal ×1 + Less Sugar ×1 must aggregate sugar requirement to 30g before validation/decrement.

- [ ] **Step 4: Implement aggregate base stock preparation**

Before inserting `business_sales`, build a `BTreeMap<Uuid, Decimal>` from every prepared line quantity. Lock the relevant `business_inventory` product rows in a deterministic order, validate all requirements, then decrement within the same transaction.

Do not run one independent `stock >= quantity` check per configured line.

- [ ] **Step 5: Apply recipe effects deterministically**

For each prepared line:
1. resolve base recipe per-unit quantities
2. apply at most one selected `set` effect per ingredient
3. sum all selected `add` effects per ingredient
4. reject a negative final quantity
5. multiply by sale-line quantity
6. aggregate across every sale line by ingredient ID

Use the adjusted quantities both for ingredient stock mutation and for the cost snapshot. That keeps HPP and stock consistent.

- [ ] **Step 6: Preserve transaction atomicity**

The transaction order must be logically:
1. validate request/configuration
2. prepare authoritative price/cost/stock requirements
3. validate all base and ingredient stock
4. insert sale + lines
5. decrement stock
6. insert finance entry
7. commit

Any failure before commit rolls everything back.

- [ ] **Step 7: Run focused stock and finance tests**

```bash
cd services/marketplace_service
cargo test sales --locked
cargo test finance --locked
```

- [ ] **Step 8: Commit stock correctness**

```bash
git add services/marketplace_service/src/businesses/sales.rs services/marketplace_service/src/businesses/modifier_resolution.rs
git commit -m "fix(sales): aggregate configured product stock consumption"
```

---

### Task 9: Simplify Modal Produk without creating a second price source

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/DurableHppWorkspace.tsx`
- Create/modify: `frontend/apps/usaha/src/components/business-control/DurableHppWorkspace.test.tsx`

**Interfaces:**
- Selling price is read from the selected product record.
- Product price editing remains owned by `Barang` / `ProductManageForm`.
- Recipe and costing continue to use the existing recipe endpoint and `business-control/costing.ts` formulas.

- [ ] **Step 1: Write UX contract tests**

Assert the page shows:
- `Modal produk`
- `Harga jual`
- `Modal / porsi`
- `Untung kotor`
- `Margin`
- `Bisa dibuat`
- `Terbatas oleh` when capacity has a bottleneck
- `Bahan yang dipakai`

Assert primary copy does not contain:
- `canonical`
- an editable second selling-price input

- [ ] **Step 2: Run the test against current HPP UI and confirm expected failures**

```bash
cd frontend/apps/usaha
npx vitest run src/components/business-control/DurableHppWorkspace.test.tsx
```

- [ ] **Step 3: Remove independent selling-price state**

Replace editable `sellingPrice` state with a derived product price:

```ts
const sellingPrice = priceFromLabel(product?.priceLabel);
```

When the merchant wants to change it, offer a compact link/button to the Barang page or product manager instead of silently changing an unsaved local number.

- [ ] **Step 4: Make the summary the first thing users understand**

Use a compact responsive summary with merchant labels and clear semantics. Keep negative gross profit visibly distinct but do not add alarmist copy.

- [ ] **Step 5: Rename recipe section and hide technical controls behind details**

Primary section title: `Bahan yang dipakai`.
Secondary helper: `Harga bahan dan stok diambil otomatis dari Bahan & kemasan.`

Keep `Susut khusus`, purchase unit conversion, and yield under `Rincian bahan` / `Pengaturan lanjutan` rather than the normal path.

Replace current success copy:

```text
Resep tersimpan. HPP sekarang dihitung dari bahan canonical usaha.
```

with:

```text
Bahan produk tersimpan. Modal per porsi sudah diperbarui.
```

- [ ] **Step 6: Improve empty states**

No products:
`Tambahkan barang dulu sebelum menghitung modal produk.`

No ingredients:
`Isi bahan atau kemasan yang dipakai, lalu kembali ke Modal produk.`

Keep direct CTA to `/businesses/{businessId}/inventory`.

- [ ] **Step 7: Run HPP tests/typecheck**

```bash
cd frontend/apps/usaha
npx vitest run src/components/business-control/DurableHppWorkspace.test.tsx
npm run typecheck
```

- [ ] **Step 8: Commit simplified costing UX**

```bash
git add frontend/apps/usaha/src/components/business-control/DurableHppWorkspace*
git commit -m "feat(usaha): simplify modal produk flow"
```

---

### Task 10: Move WWW configurator onto the shared domain without UX regression

**Files:**
- Modify: `frontend/apps/www/src/app/[locale]/(shared)/toko/[slug]/StorefrontProductConfigurator.tsx`
- Modify: `frontend/apps/www/src/lib/super-app/storefront-product-modifiers.ts`
- Modify: related tests under `frontend/apps/www/src/lib/super-app/` and storefront component tests.

**Interfaces:**
- Uses the same shared `ProductModifierGroup`, selection validation, signature, summary, and preview-price functions as Kasir.
- Public order request shape remains unchanged.

- [ ] **Step 1: Add parity tests around the shared domain**

For the same fixture groups/selections, assert WWW's compatibility exports return the exact same:
- defaults
- validation errors
- signature
- preview price
- summary

as direct `lajukan-ui` imports.

- [ ] **Step 2: Refactor configurator imports to shared semantics**

Prefer direct shared imports for new code. Keep `storefront-product-modifiers.ts` only if other storefront code still imports its historical names.

- [ ] **Step 3: Fix price-delta display for negative values**

Current UI must not render a negative delta as `+-Rp...`. Use explicit formatting:

```ts
function formatPriceDelta(cents: number) {
  if (cents === 0) return '';
  const prefix = cents > 0 ? '+' : '−';
  return `${prefix}${formatIdrCents(Math.abs(cents))}`;
}
```

- [ ] **Step 4: Preserve existing multiple-racikan flow**

WWW still supports queuing separate configurations before submit. Identical configuration + identical note may merge quantity; different signatures or notes remain separate.

- [ ] **Step 5: Run storefront tests and typecheck/build**

```bash
cd frontend/apps/www
npm run test -- --run
npx tsc --noEmit --pretty false
npm run build
```

- [ ] **Step 6: Commit WWW parity**

```bash
git add frontend/apps/www
git commit -m "refactor(storefront): use shared product configuration rules"
```

---

### Task 11: Render immutable choices in Kasir receipt and sale history

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/QuickSaleWorkspace.tsx`
- Modify: `frontend/apps/usaha/src/components/business-control/quick-sale.ts`
- Modify: the existing Usaha sale/history component that consumes `ControlSaleAggregate` after locating it by `ControlSaleLine` import/reference before editing.
- Modify: associated tests.

**Interfaces:**
- Fresh checkout response uses server-returned `configuration_snapshot` and `line_note` to build the receipt.
- History always renders stored transaction snapshot, never current product choice names.

- [ ] **Step 1: Add a receipt test with immutable choice summary**

```ts
const receipt = buildReceiptView({
  receiptNumber: 'LJ-TEST',
  occurredAt: '2026-09-16T10:00:00Z',
  cashierName: 'Kasir',
  paymentLabel: 'Tunai',
  total: 15_000,
  lines: [{
    name: 'Jus Buah Naga',
    quantity: 1,
    unitPrice: 15_000,
    configurationSummary: 'Less Sugar · Boba',
    note: 'es sedikit',
  }],
});
expect(buildReceiptShareText(receipt)).toContain('Less Sugar · Boba');
expect(buildReceiptShareText(receipt)).toContain('Catatan: es sedikit');
```

- [ ] **Step 2: Build the immediate receipt from the server response**

After `POST /sales`, prefer returned server line price/snapshot instead of the pre-submit client preview. This proves visually that server authority and receipt truth are aligned.

- [ ] **Step 3: Locate and update the existing sale-history renderer**

Before editing, search references to `ControlSaleAggregate`/`ControlSaleLine`. Update the actual renderer found in tracked source; do not create a second history page. Render:

```text
Jus Buah Naga
Less Sugar · Boba
Catatan: es sedikit
```

from stored snapshot fields.

- [ ] **Step 4: Keep older rows readable**

If `configuration_snapshot` is empty/missing, render only the existing product name and amount. Do not display `{}` or placeholder technical text.

- [ ] **Step 5: Verify receipt/history scope**

```bash
cd frontend/apps/usaha
npm run test -- QuickSale
npm run typecheck
```

- [ ] **Step 6: Commit immutable receipt/history UI**

```bash
git add frontend/apps/usaha
git commit -m "feat(usaha): show configured choices on receipts"
```

---

### Task 12: Lock the end-to-end merchant flow with regression tests and CI

**Files:**
- Modify/add targeted Usaha Vitest tests.
- Modify/add Marketplace Rust tests in the existing `sales.rs`, `product_modifiers.rs`, `public_commerce.rs` test modules or their existing integration-test files.
- Modify/add WWW Vitest tests.
- Modify `.github/workflows/` only if the existing permanent CI does not execute the newly added focused tests; do not add temporary auto-commit workflows.

**Interfaces:**
- This task adds no new production API; it proves the approved spec across subsystem boundaries.

- [ ] **Step 1: Add the complete Jus Buah Naga regression journey**

Test fixtures must model:
- base product `Jus Buah Naga`, Rp12.000
- Gula: Normal default, Less Sugar with sugar `set 10g`
- optional Topping: Boba +Rp3.000 with boba `add 30g`
- base recipe sugar 20g
- sufficient initial product/ingredient stock

Prove:
1. product choices survive product API mapping
2. Kasir opens configurator because groups exist
3. Less Sugar + Boba and Normal become two different line identities
4. request sends IDs/note, not authoritative unit price
5. backend produces Rp15.000 for Boba line and Rp12.000 for Normal line
6. base product stock decrements by total quantity 2
7. sugar consumption is 10g + 20g = 30g
8. boba consumption is 30g
9. stored snapshots retain option labels/deltas
10. finance sale entry equals final sale total exactly once

- [ ] **Step 2: Add legacy compatibility tests**

Prove:
- product without `modifier_groups` still one-tap sells
- older sale rows with empty configuration snapshot still deserialize/render
- old client payload containing `unit_price_amount` is accepted during rollout but the value is ignored for price authority
- existing WWW public order request still works.

- [ ] **Step 3: Run frontend shared package verification**

```bash
cd frontend/packages
npm test
npm run build
```

- [ ] **Step 4: Run Usaha verification**

```bash
cd frontend/apps/usaha
npm run lint
npm run test
npm run typecheck
npm run build
```

- [ ] **Step 5: Run WWW verification**

```bash
cd frontend/apps/www
npm run lint
npm run test
npx tsc --noEmit --pretty false
npm run build
```

- [ ] **Step 6: Run Marketplace strict verification**

```bash
cd services/marketplace_service
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

- [ ] **Step 7: Run repository/deployment checks required by `AGENTS.md`**

From repo root:

```bash
python scripts/ci/check_repository_hygiene.py
docker compose --env-file .env.development -f docker-compose.yml -f docker-compose.dev.yml config --quiet
```

If the repository's permanent CI contains development runtime smoke, require that workflow to finish successfully on the final clean SHA. Do not bypass a red runtime smoke just because unit tests are green.

- [ ] **Step 8: Review the final diff for architectural leaks**

Explicitly verify:
- no second modifier store exists
- no client-supplied unit price is authoritative
- no productId-only cart merge remains
- no raw `canonical`, `selection_mode`, or JSON jargon leaks into primary merchant UI
- no temporary workflow/helper file remains
- no internal cost/supplier metadata is added to public storefront product metadata
- no ad-hoc modal overlay or arbitrary z-index is introduced
- no prior migration was edited

- [ ] **Step 9: Open/update the feature PR and wait for the final SHA gates**

PR should summarize the flow, migration, backward compatibility, and verification evidence. Keep it draft while any required check is pending or failing.

- [ ] **Step 10: Merge only after final-SHA verification**

Use squash merge into `main` only after all required checks on the exact head SHA are green. Fetch/confirm the resulting `main` commit and report it; do not claim completion from an earlier green SHA.

---

## Self-Review Results

### Spec coverage

- Product/catalog + merchant choice language: Tasks 3–4.
- Shared Kasir/WWW semantics: Tasks 1, 6, 10.
- Any-choice-opens-configurator POS rule: Task 6.
- Deterministic configured line identity and notes: Task 5.
- Server-authoritative pricing: Tasks 2 and 7.
- Duplicate base-product / aggregate stock invariant: Task 8.
- Optional recipe impacts for Less Sugar/Boba: Tasks 3 and 8.
- Immutable receipt/order/cost snapshots: Tasks 7, 8, 11.
- Simple `Modal produk` / HPP mental model: Task 9.
- Existing interaction system and responsive sheet/dialog: Task 6 plus Global Constraints.
- Finance posting and bucket safety: Task 8 regression coverage and final Task 12 checks; existing bucket semantics are not rewritten by this feature.
- Public storefront compatibility and data privacy: Tasks 1, 2, 10, 12.
- Backward compatibility: Tasks 7, 11, 12.
- Accessibility/responsive contract: Task 6 component behavior plus final app build/tests; implementation review must exercise the viewport cases from the approved spec.
- Full approved Jus Buah Naga acceptance journey: Task 12.

### Placeholder scan

The plan contains no `TBD`, no implementation `TODO`, no unspecified “write tests” steps, and no undefined production interface that later tasks depend on. Where an existing sale-history renderer path is not known from current audit output, Task 11 explicitly requires locating the one existing `ControlSaleLine` consumer before editing and forbids creating a duplicate page.

### Type consistency

- Frontend choice types use the backend JSON field names `selection_mode`, `price_delta_cents`, `is_default`, `enabled`, `selected_options`/selection IDs at serialization boundaries.
- Shared frontend helper names are consistent across Tasks 1, 5, 6, and 10.
- POS client sends `selected_options`; backend request uses `selected_options` with the shared Rust `ModifierSelectionInput` semantics.
- `configuration_snapshot` and `line_note` names are consistent across migration, Rust record, TypeScript server adapter, receipt, and history tasks.
- Recipe effects consistently use `{ ingredient_id, operation: 'add' | 'set', quantity }`.
- Client preview uses `unitPricePreviewAmount`; server response/stored sale uses authoritative `unit_price_amount`.
