# Usaha UX V3 — Channel Pricing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make each sales channel answer the merchant question “kalau jual segini, saya terima dan untung berapa?” before exposing technical fee settings.

**Architecture:** Keep `ChannelSettingsWorkspace` and the existing costing helpers as the source of truth. The default row becomes a read-first business summary; technical fee/promo/target-margin inputs move under `Atur perhitungan` without duplicating pricing formulas.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-18-usaha-ux-v3-design.md`

## Global Constraints

- Do not duplicate `calculateChannelMargin` or `recommendChannelPrice` formulas.
- Existing channel PUT payload remains unchanged.
- HPP visibility continues to obey costing permissions.
- Channel activation remains immediate and obvious.
- Technical fee configuration stays available but secondary.

---

### Task 1: Add a pure channel-summary presentation helper

**Files:**
- Create: `frontend/apps/usaha/src/lib/business-control/channel-ux.ts`
- Create: `frontend/apps/usaha/src/lib/business-control/channel-ux.test.ts`

**Interfaces:**
- Produces: `buildChannelBusinessSummary({ price, hpp, feePercent, fixedFee, merchantPromo, targetMarginPercent })`.
- Internally delegates to existing costing helpers.

- [ ] **Step 1: Write the failing helper test**

```ts
import { describe, expect, it } from 'vitest';
import { buildChannelBusinessSummary } from './channel-ux';

it('returns net receipt, contribution profit, and recommendation from shared costing math', () => {
  const result = buildChannelBusinessSummary({
    price: 20000,
    hpp: 8000,
    feePercent: 20,
    fixedFee: 1000,
    merchantPromo: 1000,
    targetMarginPercent: 25,
  });
  expect(result.ready).toBe(true);
  expect(result.netReceipt).toBeTypeOf('number');
  expect(result.contributionProfit).toBeTypeOf('number');
  expect(result.recommendedPrice).toBeTypeOf('number');
});
```

- [ ] **Step 2: Run and verify RED**

```bash
cd frontend/apps/usaha
npm test -- src/lib/business-control/channel-ux.test.ts
```
Expected: FAIL because helper is missing.

- [ ] **Step 3: Implement by delegating to shared costing functions**

```ts
import { calculateChannelMargin, recommendChannelPrice } from './costing';

export function buildChannelBusinessSummary(input: {
  price: number | null; hpp: number | null; feePercent: number; fixedFee: number; merchantPromo: number; targetMarginPercent: number;
}) {
  if (input.price === null || input.hpp === null) return { ready: false as const, netReceipt: null, contributionProfit: null, recommendedPrice: null };
  const margin = calculateChannelMargin({ price: input.price, hpp: input.hpp, feeRatePercent: input.feePercent, merchantPromo: input.merchantPromo, fixedFee: input.fixedFee });
  const recommendation = recommendChannelPrice({ hpp: input.hpp, deductionRatePercent: input.feePercent, fixedFee: input.fixedFee + input.merchantPromo, targetMarginPercent: input.targetMarginPercent, roundTo: 500 });
  return {
    ready: true as const,
    netReceipt: margin.netReceipt,
    contributionProfit: margin.contributionProfit,
    recommendedPrice: recommendation.valid ? recommendation.recommendedPrice : null,
  };
}
```

- [ ] **Step 4: Run helper test + typecheck**

```bash
npm test -- src/lib/business-control/channel-ux.test.ts
npm run typecheck
```
Expected: PASS. If the exact `calculateChannelMargin` return field for net receipt differs, use the existing canonical field rather than adding a second calculation.

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
- Consumes `buildChannelBusinessSummary()`.
- Preserve PUT `/api/businesses/${businessId}/channels/${channelKey}` body.

- [ ] **Step 1: Write the failing source contract**

```ts
const source = readFileSync('src/components/business-control/ChannelSettingsWorkspace.tsx', 'utf8');
expect(source).toContain('Harga jual');
expect(source).toContain('Diterima bersih');
expect(source).toContain('Laba per item');
expect(source).toContain('Harga aman');
expect(source).toContain('Atur perhitungan');
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/business-control/channel-settings-v3.contract.test.ts
```
Expected: FAIL because current row emphasizes fee percentage rather than the full business summary.

- [ ] **Step 3: Build the row summary from the helper**

```tsx
const businessSummary = useMemo(() => buildChannelBusinessSummary({
  price, hpp, feePercent: row.feePercent, fixedFee: row.fixedFee,
  merchantPromo: row.merchantPromo, targetMarginPercent: row.targetMarginPercent,
}), [price, hpp, row.feePercent, row.fixedFee, row.merchantPromo, row.targetMarginPercent]);
```

Render, when ready:

```tsx
<div className="mt-3 grid grid-cols-2 gap-2 lg:grid-cols-4">
  <Metric label="Harga jual" value={money.format(price ?? 0)} />
  <Metric label="Diterima bersih" value={money.format(businessSummary.netReceipt ?? 0)} />
  <Metric label="Laba per item" value={money.format(businessSummary.contributionProfit ?? 0)} />
  <Metric label="Harga aman" value={businessSummary.recommendedPrice === null ? 'Belum ada' : money.format(businessSummary.recommendedPrice)} />
</div>
```

When HPP is hidden/missing, render a permission/readiness explanation instead of fabricating profit.

- [ ] **Step 4: Rename technical details summary**

Change `Atur` to `Atur perhitungan`. Keep `Potongan %`, `Target margin %`, `Biaya tetap`, and `Promo dari toko` inside it.

- [ ] **Step 5: Run targeted tests and typecheck**

```bash
npm test -- src/components/business-control/channel-settings-v3.contract.test.ts src/lib/business-control/channel-ux.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/components/business-control/ChannelSettingsWorkspace.tsx src/components/business-control/channel-settings-v3.contract.test.ts
git commit -m "feat(usaha): make channel pricing business-first"
```

### Task 3: Preserve readiness and permission behavior

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/channel-settings-v3.contract.test.ts`
- Test existing: costing/progressive-disclosure tests under `src/lib/business-control`.

**Interfaces:**
- No new production API.

- [ ] **Step 1: Add contract coverage for incomplete data**

```ts
expect(source).toContain("readiness !== 'ready'");
expect(source).toContain('canViewCosting');
expect(source).toContain('Akses ini tidak menampilkan HPP dan keuntungan');
```

- [ ] **Step 2: Run channel and costing tests**

```bash
npm test -- src/components/business-control/channel-settings-v3.contract.test.ts src/lib/business-control/channel-ux.test.ts src/lib/business-control/costing.test.ts
```
Expected: PASS; if the costing test filename differs, run `npm test -- costing` and use the matching existing suite.

- [ ] **Step 3: Run full Usaha verification**

```bash
npm run lint
npm test
npm run typecheck
npm run build
```
Expected: all exit 0.

- [ ] **Step 4: Commit only test/readiness changes**

```bash
git add src/components/business-control/channel-settings-v3.contract.test.ts
git commit -m "test(usaha): lock channel pricing readiness"
```
