# Usaha UX V3 — Finance Activity and Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make finance entry, allocation movement, and correction flows understandable as merchant tasks without weakening finance-core immutability or idempotency.

**Architecture:** Keep `FinanceLedgerV2` as the canonical data owner and split only pure UI decision helpers when that improves testability. Reuse `ChoiceChips` and `EffectPreview`. All POST endpoints and reversal/replacement semantics remain unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-18-usaha-ux-v3-design.md`

## Global Constraints

- Posted finance history is never destructively edited.
- Corrections remain reversal + replacement; void remains full reversal.
- Existing `Idempotency-Key` headers remain on finance writes.
- Common income/expense entry should not require long dropdown interaction.
- Summary values continue to come from finance-core / existing ledger helpers.

---

### Task 1: Add pure finance UX helpers and tests

**Files:**
- Create: `frontend/apps/usaha/src/lib/business-control/finance-ux.ts`
- Create: `frontend/apps/usaha/src/lib/business-control/finance-ux.test.ts`

**Interfaces:**
- Produces: `commonFinanceChoices(direction: 'in' | 'out')`.
- Produces: `allocationBalanceAfterMove(input)` for presentation preview only.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { allocationBalanceAfterMove, commonFinanceChoices } from './finance-ux';

it('returns merchant-facing common expense choices', () => {
  expect(commonFinanceChoices('out').map(item => item.value)).toEqual(expect.arrayContaining([
    'inventory_purchase', 'payroll_expense', 'rent_expense', 'utilities_expense', 'marketing_expense', 'other_expense',
  ]));
});

it('previews source and destination allocation balances', () => {
  expect(allocationBalanceAfterMove({ sourceBalance: 100000, destinationBalance: 20000, amount: 30000 }))
    .toEqual({ sourceAfter: 70000, destinationAfter: 50000, valid: true });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
cd frontend/apps/usaha
npm test -- src/lib/business-control/finance-ux.test.ts
```
Expected: FAIL because helper module does not exist.

- [ ] **Step 3: Implement helpers from existing finance-entry options**

```ts
import { financeEntryOptions } from './finance-entry-options';

const common = {
  in: new Set(['other_income', 'capital_income', 'owner_capital', 'receivable_payment']),
  out: new Set(['inventory_purchase', 'payroll_expense', 'rent_expense', 'utilities_expense', 'transport_expense', 'marketing_expense', 'equipment_expense', 'owner_draw', 'payable_payment', 'other_expense']),
} as const;

export function commonFinanceChoices(direction: 'in' | 'out') {
  return financeEntryOptions(direction).filter(item => common[direction].has(item.value as never));
}

export function allocationBalanceAfterMove({ sourceBalance, destinationBalance, amount }: { sourceBalance: number; destinationBalance: number; amount: number }) {
  const valid = Number.isFinite(amount) && amount > 0 && sourceBalance >= amount;
  return { sourceAfter: valid ? sourceBalance - amount : sourceBalance, destinationAfter: valid ? destinationBalance + amount : destinationBalance, valid };
}
```

- [ ] **Step 4: Run tests and typecheck**

```bash
npm test -- src/lib/business-control/finance-ux.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/business-control/finance-ux.ts src/lib/business-control/finance-ux.test.ts
git commit -m "feat(usaha): add finance UX helpers"
```

### Task 2: Replace common finance-entry selects with visible choices

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/FinanceLedgerV2.tsx`
- Create: `frontend/apps/usaha/src/components/business-control/finance-ledger-v3.contract.test.ts`

**Interfaces:**
- Consumes: `ChoiceChips`, `EffectPreview`, `commonFinanceChoices`.
- Preserve POST `/finance-core/entries` body and idempotency header.

- [ ] **Step 1: Write failing source contract**

```ts
const source = readFileSync('src/components/business-control/FinanceLedgerV2.tsx', 'utf8');
expect(source).toContain('ChoiceChips');
expect(source).toContain('EffectPreview');
expect(source).not.toMatch(/<select[\s\S]*?value=\{entryType\}/);
expect(source).not.toMatch(/<select[\s\S]*?value=\{allocationBucket\}/);
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/business-control/finance-ledger-v3.contract.test.ts
```
Expected: FAIL on current select markup.

- [ ] **Step 3: Render category choices as merchant cards/chips**

```tsx
<ChoiceChips value={entryType} onChange={setEntryType} ariaLabel={direction === 'in' ? 'Kategori uang masuk' : 'Kategori uang keluar'}
  options={commonFinanceChoices(direction).map(item => ({ value: item.value, label: item.label }))} />
```

If `entryType` is a valid non-common legacy type, expose it under `Kategori lainnya` details using the existing `financeEntryOptions(direction)` list; do not delete compatibility.

- [ ] **Step 4: Render allocation bucket as chips**

```tsx
<ChoiceChips value={allocationBucket} onChange={setAllocationBucket} ariaLabel="Kantong uang" options={allocationOptions.map(item => ({ value: item.value, label: item.label }))} />
```

- [ ] **Step 5: Add an EffectPreview before save**

```tsx
<EffectPreview items={[
  { label: 'Nominal', value: money.format(Math.max(0, Number(entryAmount) || 0)) },
  { label: 'Dampak', value: direction === 'in' ? 'Menambah nilai tercatat' : 'Mengurangi nilai tercatat', tone: direction === 'in' ? 'positive' : 'warning' },
]} />
```

Do not calculate ledger balances here; finance-core remains the source of truth after save.

- [ ] **Step 6: Run targeted test and typecheck**

```bash
npm test -- src/components/business-control/finance-ledger-v3.contract.test.ts
npm run typecheck
```
Expected: PASS for common-entry assertions.

- [ ] **Step 7: Commit**

```bash
git add src/components/business-control/FinanceLedgerV2.tsx src/components/business-control/finance-ledger-v3.contract.test.ts
git commit -m "feat(usaha): simplify finance entry workflow"
```

### Task 3: Replace account/channel small choices where practical without hiding rare compatibility

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/FinanceLedgerV2.tsx`

**Interfaces:**
- Common `accountKey` values use visible choices: `cash`, `bank`, `ewallet`, `receivable`, `payable`.
- Channel remains under `Detail transaksi`; when enabled channels exceed six, retain the existing compact native select because it is a rare detail and spec permits it.

- [ ] **Step 1: Replace account select with ChoiceChips**

```tsx
<ChoiceChips value={accountKey} onChange={setAccountKey} ariaLabel="Akun transaksi" options={[
  { value: 'cash', label: 'Kas' }, { value: 'bank', label: 'Bank' }, { value: 'ewallet', label: 'E-wallet' },
  { value: 'receivable', label: 'Piutang' }, { value: 'payable', label: 'Utang' },
]} />
```

- [ ] **Step 2: Keep date, channel, and note inside the existing details section**

Do not promote them to the default surface. If `channelChoices.length <= 6`, render them via `ChoiceChips`; otherwise keep the native select.

```tsx
{channelChoices.length <= 6
  ? <ChoiceChips value={channelKey} onChange={setChannelKey} ariaLabel="Kanal" options={channelChoices} />
  : <select value={channelKey} onChange={event => setChannelKey(event.target.value)}>{channelChoices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}</select>}
```

- [ ] **Step 3: Run full finance-related tests and typecheck**

```bash
npm test -- src/components/business-control/finance-ledger-v3.contract.test.ts src/lib/business-control/finance-ux.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/business-control/FinanceLedgerV2.tsx
git commit -m "feat(usaha): make finance account choices visible"
```

### Task 4: Replace allocation movement selects with balance-aware bucket choices

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/FinanceLedgerV2.tsx`
- Modify: `frontend/apps/usaha/src/components/business-control/finance-ledger-v3.contract.test.ts`

**Interfaces:**
- Consumes `allocationBalanceAfterMove()`.
- Preserve POST `/finance-core/allocations/move` body and required reason.

- [ ] **Step 1: Extend failing contract**

```ts
expect(source).not.toMatch(/<select[\s\S]*?value=\{allocationFrom\}/);
expect(source).not.toMatch(/<select[\s\S]*?value=\{allocationTo\}/);
expect(source).toContain('Saldo setelah dipindah');
```

Run targeted test; expected: FAIL.

- [ ] **Step 2: Build bucket choices including balances**

```tsx
const allocationChoiceOptions = [
  { value: 'unallocated', label: `Belum dibagi · ${money.format(summary?.unallocated_cash ?? 0)}` },
  ...allocations.map(item => ({ value: item.bucket, label: `${allocationLabels[item.bucket]} · ${money.format(item.balance)}` })),
];
```

Render `Dari` and `Ke` as separate `ChoiceChips` groups. Filter the selected source out of destination choices.

- [ ] **Step 3: Add balance-after preview**

Resolve current source/destination balances, call `allocationBalanceAfterMove`, then render:

```tsx
<EffectPreview ariaLabel="Saldo setelah dipindah" items={[
  { label: 'Sumber setelah', value: money.format(preview.sourceAfter), tone: 'warning' },
  { label: 'Tujuan setelah', value: money.format(preview.destinationAfter), tone: 'positive' },
]} />
```

Disable `Pindahkan` when source and destination are identical or preview is invalid.

- [ ] **Step 4: Run tests and commit**

```bash
npm test -- src/components/business-control/finance-ledger-v3.contract.test.ts src/lib/business-control/finance-ux.test.ts
npm run typecheck
git add src/components/business-control/FinanceLedgerV2.tsx src/components/business-control/finance-ledger-v3.contract.test.ts
git commit -m "feat(usaha): simplify money allocation movement"
```

### Task 5: Simplify correction choices without changing immutable semantics

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/FinanceLedgerV2.tsx`
- Modify test: `frontend/apps/usaha/src/components/business-control/finance-ledger-v3.contract.test.ts`

**Interfaces:**
- Preserve POST `/finance-core/entries/${entry.id}/correct` and its `replacement` shape.

- [ ] **Step 1: Add contract assertions**

```ts
expect(source).toContain("setCorrectionMode('correct')");
expect(source).toContain("setCorrectionMode('void')");
expect(source).toContain('reversal');
expect(source).toContain('Idempotency-Key');
```

- [ ] **Step 2: Use ChoiceChips for correction account and bucket**

```tsx
<ChoiceChips value={correctionAccount} onChange={setCorrectionAccount} ariaLabel="Akun pengganti" options={accountOptions} />
<ChoiceChips value={correctionBucket} onChange={setCorrectionBucket} ariaLabel="Kantong pengganti" options={allocationOptions.map(item => ({ value: item.value, label: item.label }))} />
```

Keep replacement category as a native select only because it merges all finance entry types and is a rare correction-only detail.

- [ ] **Step 3: Keep the plain-language immutable preview**

Use `EffectPreview` with either `Transaksi lama dibalik` + `Transaksi pengganti dibuat` or `Transaksi lama dibalik penuh`. Do not remove the existing mandatory reason validation.

- [ ] **Step 4: Run full Usaha verification**

```bash
npm run lint
npm test
npm run typecheck
npm run build
```
Expected: all exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/business-control/FinanceLedgerV2.tsx src/components/business-control/finance-ledger-v3.contract.test.ts
git commit -m "feat(usaha): clarify finance correction workflow"
```
