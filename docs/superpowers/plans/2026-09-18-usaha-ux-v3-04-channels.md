# Usaha UX V3 — Channel Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each sales channel answer “kalau jual segini, saya terima dan untung berapa?” before exposing technical fee settings.

**Architecture:** Keep `ChannelSettingsWorkspace` and the existing `calculateChannelMargin` / `recommendChannelPrice` helpers as the source of truth. Add a thin presentation adapter that renames `netRevenue` to merchant-facing “diterima bersih” without recalculating it. Existing channel PUT payloads remain unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-18-usaha-ux-v3-design.md`

## Global Constraints

- Do not duplicate channel-cost formulas.
- Existing channel PUT payload remains unchanged.
- HPP visibility obeys costing permissions.
- Channel activation remains immediate and obvious.
- Technical fee fields remain available under progressive disclosure.

---

### Task 1: Add a pure channel business-summary adapter

**Files:**
- Create: `frontend/apps/usaha/src/lib/business-control/channel-ux.ts`
- Create: `frontend/apps/usaha/src/lib/business-control/channel-ux.test.ts`

**Interfaces:**
- Produces: `buildChannelBusinessSummary(input)`.
- Delegates all calculations to `calculateChannelMargin` and `recommendChannelPrice`.

- [ ] **Step 1: Write the failing helper tests**

```ts
import { describe, expect, it } from 'vitest';
import { calculateChannelMargin } from './costing';
import { buildChannelBusinessSummary } from './channel-ux';

it('maps shared costing results to merchant-facing values', () => {
  const input = {
    price: 20_000,
    hpp: 8_000,
    feePercent: 20,
    fixedFee: 1_000,
    merchantPromo: 1_000,
    targetMarginPercent: 25,
  };
  const canonical = calculateChannelMargin({
    price: input.price,
    hpp: input.hpp,
    feeRatePercent: input.feePercent,
    fixedFee: input.fixedFee,
    merchantPromo: input.merchantPromo,
  });
  const result = buildChannelBusinessSummary(input);

  expect(result.ready).toBe(true);
  expect(result.netReceipt).toBe(canonical.netRevenue);
  expect(result.contributionProfit).toBe(canonical.contributionProfit);
  expect(result.recommendedPrice).toBeTypeOf('number');
});

it('does not invent profit when price or HPP is unavailable', () => {
  expect(buildChannelBusinessSummary({
    price: 20_000,
    hpp: null,
    feePercent: 20,
    fixedFee: 0,
    merchantPromo: 0,
    targetMarginPercent: 25,
  })).toEqual({
    ready: false,
    netReceipt: null,
    contributionProfit: null,
    recommendedPrice: null,
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
cd frontend/apps/usaha
npm test -- src/lib/business-control/channel-ux.test.ts
```

Expected: FAIL because the helper is missing.

- [ ] **Step 3: Implement the adapter using canonical helpers**

```ts
import { calculateChannelMargin, recommendChannelPrice } from './costing';

export function buildChannelBusinessSummary(input: {
  price: number | null;
  hpp: number | null;
  feePercent: number;
  fixedFee: number;
  merchantPromo: number;
  targetMarginPercent: number;
}) {
  if (input.price === null || input.hpp === null) {
    return {
      ready: false as const,
      netReceipt: null,
      contributionProfit: null,
      recommendedPrice: null,
    };
  }

  const margin = calculateChannelMargin({
    price: input.price,
    hpp: input.hpp,
    feeRatePercent: input.feePercent,
    fixedFee: input.fixedFee,
    merchantPromo: input.merchantPromo,
  });
  const recommendation = recommendChannelPrice({
    hpp: input.hpp,
    deductionRatePercent: input.feePercent,
    fixedFee: input.fixedFee + input.merchantPromo,
    targetMarginPercent: input.targetMarginPercent,
    roundTo: 500,
  });

  return {
    ready: true as const,
    netReceipt: margin.netRevenue,
    contributionProfit: margin.contributionProfit,
    recommendedPrice: recommendation.valid ? recommendation.recommendedPrice : null,
  };
}
```

- [ ] **Step 4: Run helper tests and typecheck**

```bash
npm test -- src/lib/business-control/channel-ux.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/business-control/channel-ux.ts src/lib/business-control/channel-ux.test.ts
git commit -m "feat(usaha): add channel business summary helper"
```

### Task 2: Make each channel row business-first

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/ChannelSettingsWorkspace.tsx`
- Create: `frontend/apps/usaha/src/components/business-control/channel-settings-v3.contract.test.ts`

**Interfaces:**
- Preserve PUT `/api/businesses/${businessId}/channels/${encodeURIComponent(row.key)}` body: `display_name`, `fee_rate_bps`, `fixed_fee_amount`, `merchant_promo_amount`, `target_margin_bps`, `enabled`, `metadata`.

- [ ] **Step 1: Write the failing source contract**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/business-control/ChannelSettingsWorkspace.tsx', 'utf8');

describe('channel UX V3', () => {
  it('shows business outcomes before technical settings', () => {
    expect(source).toContain('Harga jual');
    expect(source).toContain('Diterima bersih');
    expect(source).toContain('Laba per item');
    expect(source).toContain('Harga aman');
    expect(source).toContain('Atur perhitungan');
    expect(source).toContain('buildChannelBusinessSummary');
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/business-control/channel-settings-v3.contract.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Replace row-local margin/recommendation memo with the presentation adapter**

Import:

```tsx
import { buildChannelBusinessSummary } from '@/lib/business-control/channel-ux';
```

Inside `ChannelRow`:

```tsx
const businessSummary = useMemo(() => buildChannelBusinessSummary({
  price,
  hpp,
  feePercent: row.feePercent,
  fixedFee: row.fixedFee,
  merchantPromo: row.merchantPromo,
  targetMarginPercent: row.targetMarginPercent,
}), [price, hpp, row.feePercent, row.fixedFee, row.merchantPromo, row.targetMarginPercent]);
```

Remove direct row-local `calculateChannelMargin` and `recommendChannelPrice` calls after this adapter is in use. The adapter itself remains the only new layer and delegates to those existing helpers.

- [ ] **Step 4: Render the default business summary**

When `businessSummary.ready` is true:

```tsx
<div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
  <div className="rounded-xl bg-[#fafbf9] p-3">
    <p className="text-[11px] text-portal-soft">Harga jual</p>
    <p className="mt-1 text-sm font-black text-portal-ink">{money.format(price ?? 0)}</p>
  </div>
  <div className="rounded-xl bg-[#fafbf9] p-3">
    <p className="text-[11px] text-portal-soft">Diterima bersih</p>
    <p className="mt-1 text-sm font-black text-portal-ink">{money.format(businessSummary.netReceipt)}</p>
  </div>
  <div className="rounded-xl bg-[#fafbf9] p-3">
    <p className="text-[11px] text-portal-soft">Laba per item</p>
    <p className={`mt-1 text-sm font-black ${businessSummary.contributionProfit >= 0 ? 'text-portal-forest' : 'text-red-700'}`}>
      {money.format(businessSummary.contributionProfit)}
    </p>
  </div>
  <div className="rounded-xl bg-[#fafbf9] p-3">
    <p className="text-[11px] text-portal-soft">Harga aman</p>
    <p className="mt-1 text-sm font-black text-portal-ink">
      {businessSummary.recommendedPrice === null ? 'Belum ada' : money.format(businessSummary.recommendedPrice)}
    </p>
  </div>
</div>
```

When readiness is not complete, keep the existing `channelSimulationReadiness` explanation. If `canViewCosting` is false, do not expose HPP or profit-derived values.

- [ ] **Step 5: Rename the technical disclosure**

Change the channel-row summary from `Atur` to `Atur perhitungan`. Keep these existing fields inside it:
- Nama kanal
- Potongan %
- Target margin % when permitted
- Biaya tetap
- Promo dari toko
- Simpan

Do not move those technical fields to the default row.

- [ ] **Step 6: Run targeted tests and typecheck**

```bash
npm test -- src/components/business-control/channel-settings-v3.contract.test.ts src/lib/business-control/channel-ux.test.ts
npm run typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add src/components/business-control/ChannelSettingsWorkspace.tsx src/components/business-control/channel-settings-v3.contract.test.ts
git commit -m "feat(usaha): make channel pricing business-first"
```

### Task 3: Lock readiness, permission, and formula behavior

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/channel-settings-v3.contract.test.ts`
- Test existing costing module: `frontend/apps/usaha/src/lib/business-control/costing.ts` and its current matching test file.

- [ ] **Step 1: Add permission/readiness assertions**

```ts
expect(source).toContain("readiness !== 'ready'");
expect(source).toContain('canViewCosting');
expect(source).toContain('Akses ini tidak menampilkan HPP dan keuntungan');
expect(source).toContain('buildChannelBusinessSummary');
```

- [ ] **Step 2: Run all matching channel/costing tests**

```bash
npm test -- src/components/business-control/channel-settings-v3.contract.test.ts src/lib/business-control/channel-ux.test.ts
npm test -- costing
```

Expected: PASS. The second command must run the repository's existing tests whose names match `costing`.

- [ ] **Step 3: Run complete Usaha verification**

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 4: Commit test-only changes**

```bash
git add src/components/business-control/channel-settings-v3.contract.test.ts
git commit -m "test(usaha): lock channel pricing readiness"
```
