# Usaha UX V3 — Finance Activity and Allocation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make finance entry, allocation movement, and correction flows understandable as merchant tasks without weakening finance-core immutability or idempotency.

**Architecture:** Keep `FinanceLedgerV2` as the canonical implementation until the final cleanup batch. Reuse `ChoiceChips` and `EffectPreview`. Pure presentation helpers live in `src/lib/business-control/finance-ux.ts`. All finance-core POST endpoints, idempotency headers, reversal behavior, and replacement payloads remain unchanged.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-18-usaha-ux-v3-design.md`

## Global Constraints

- Posted finance history is never destructively edited.
- Corrections remain reversal + replacement; void remains full reversal.
- Existing `Idempotency-Key` headers remain on finance writes.
- Common income/expense entry should not require a long dropdown.
- Summary balances continue to come from finance-core and existing ledger helpers.

---

### Task 1: Add pure finance UX helpers

**Files:**
- Create: `frontend/apps/usaha/src/lib/business-control/finance-ux.ts`
- Create: `frontend/apps/usaha/src/lib/business-control/finance-ux.test.ts`

**Interfaces:**
- Produces: `commonFinanceChoices(direction)`.
- Produces: `allocationBalanceAfterMove(input)` for preview only.

- [ ] **Step 1: Write failing tests**

```ts
import { describe, expect, it } from 'vitest';
import { allocationBalanceAfterMove, commonFinanceChoices } from './finance-ux';

it('returns merchant-facing common expense choices', () => {
  expect(commonFinanceChoices('out').map(item => item.value)).toEqual(expect.arrayContaining([
    'inventory_purchase',
    'payroll_expense',
    'rent_expense',
    'utilities_expense',
    'marketing_expense',
    'other_expense',
  ]));
});

it('previews source and destination balances', () => {
  expect(allocationBalanceAfterMove({
    sourceBalance: 100_000,
    destinationBalance: 20_000,
    amount: 30_000,
  })).toEqual({ sourceAfter: 70_000, destinationAfter: 50_000, valid: true });
});

it('rejects a move larger than the source balance', () => {
  expect(allocationBalanceAfterMove({
    sourceBalance: 10_000,
    destinationBalance: 5_000,
    amount: 20_000,
  }).valid).toBe(false);
});
```

- [ ] **Step 2: Run and verify RED**

```bash
cd frontend/apps/usaha
npm test -- src/lib/business-control/finance-ux.test.ts
```

Expected: FAIL because the helper module is missing.

- [ ] **Step 3: Implement helpers using existing finance-entry options**

```ts
import { financeEntryOptions } from './finance-entry-options';

const common: Record<'in' | 'out', ReadonlySet<string>> = {
  in: new Set(['other_income', 'capital_income', 'owner_capital', 'receivable_payment']),
  out: new Set([
    'inventory_purchase',
    'payroll_expense',
    'rent_expense',
    'utilities_expense',
    'transport_expense',
    'marketing_expense',
    'equipment_expense',
    'owner_draw',
    'payable_payment',
    'other_expense',
  ]),
};

export function commonFinanceChoices(direction: 'in' | 'out') {
  return financeEntryOptions(direction).filter(item => common[direction].has(item.value));
}

export function allocationBalanceAfterMove({
  sourceBalance,
  destinationBalance,
  amount,
}: {
  sourceBalance: number;
  destinationBalance: number;
  amount: number;
}) {
  const valid = Number.isFinite(amount) && amount > 0 && sourceBalance >= amount;
  return {
    sourceAfter: valid ? sourceBalance - amount : sourceBalance,
    destinationAfter: valid ? destinationBalance + amount : destinationBalance,
    valid,
  };
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

### Task 2: Replace common finance-entry selectors

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/FinanceLedgerV2.tsx`
- Create: `frontend/apps/usaha/src/components/business-control/finance-ledger-v3.contract.test.ts`

**Interfaces:**
- Preserve POST `/api/businesses/${businessId}/finance-core/entries` body: `entry_type`, `account_key`, `amount`, `occurred_on`, `note`, `channel_key`, `allocation_bucket`.
- Preserve request `Idempotency-Key`.

- [ ] **Step 1: Write the failing source contract**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/business-control/FinanceLedgerV2.tsx', 'utf8');

describe('finance ledger UX V3', () => {
  it('uses visible common choices and effect previews', () => {
    expect(source).toContain('ChoiceChips');
    expect(source).toContain('EffectPreview');
    expect(source).not.toMatch(/<select[\s\S]*?value=\{entryType\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{allocationBucket\}/);
    expect(source).toContain('Idempotency-Key');
  });
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/business-control/finance-ledger-v3.contract.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Import the shared controls and finance helper**

```tsx
import { ChoiceChips } from '@/components/interaction/ChoiceChips';
import { EffectPreview } from '@/components/interaction/EffectPreview';
import { commonFinanceChoices } from '@/lib/business-control/finance-ux';
```

- [ ] **Step 4: Replace category and allocation controls**

```tsx
<ChoiceChips
  value={entryType}
  onChange={setEntryType}
  ariaLabel={direction === 'in' ? 'Kategori uang masuk' : 'Kategori uang keluar'}
  options={commonFinanceChoices(direction).map(item => ({ value: item.value, label: item.label }))}
/>

<ChoiceChips
  value={allocationBucket}
  onChange={setAllocationBucket}
  ariaLabel="Kantong uang"
  options={allocationOptions.map(item => ({ value: item.value, label: item.label }))}
/>
```

If an existing record or future option uses a valid non-common `entryType`, render a `Kategori lainnya` `<details>` section containing the existing full `financeEntryOptions(direction)` native select. This preserves compatibility while keeping the daily path visible.

- [ ] **Step 5: Add a non-authoritative action preview before save**

```tsx
<EffectPreview items={[
  {
    label: 'Nominal',
    value: money.format(Math.max(0, Number(entryAmount) || 0)),
  },
  {
    label: 'Dampak pencatatan',
    value: direction === 'in' ? 'Uang/nilai masuk dicatat' : 'Uang/nilai keluar dicatat',
    tone: direction === 'in' ? 'positive' : 'warning',
  },
]} />
```

Do not compute final account balances client-side; reload finance-core summary after save remains authoritative.

- [ ] **Step 6: Run contract and typecheck**

```bash
npm test -- src/components/business-control/finance-ledger-v3.contract.test.ts
npm run typecheck
```

Expected: PASS for Task 2 assertions.

- [ ] **Step 7: Commit**

```bash
git add src/components/business-control/FinanceLedgerV2.tsx src/components/business-control/finance-ledger-v3.contract.test.ts
git commit -m "feat(usaha): simplify finance entry workflow"
```

### Task 3: Make common account/channel choices visible

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/FinanceLedgerV2.tsx`

**Interfaces:**
- Common account keys remain `cash`, `bank`, `ewallet`, `receivable`, `payable`.
- Channel remains an advanced/detail field.

- [ ] **Step 1: Replace the account select**

```tsx
<ChoiceChips
  value={accountKey}
  onChange={setAccountKey}
  ariaLabel="Akun transaksi"
  options={[
    { value: 'cash', label: 'Kas' },
    { value: 'bank', label: 'Bank' },
    { value: 'ewallet', label: 'E-wallet' },
    { value: 'receivable', label: 'Piutang' },
    { value: 'payable', label: 'Utang' },
  ]}
/>
```

- [ ] **Step 2: Keep channel under `Detail transaksi` with adaptive choice density**

```tsx
{channelChoices.length <= 6 ? (
  <ChoiceChips
    value={channelKey}
    onChange={setChannelKey}
    ariaLabel="Kanal"
    options={channelChoices.map(choice => ({ value: choice.value, label: choice.label }))}
  />
) : (
  <select value={channelKey} onChange={event => setChannelKey(event.target.value)} className="portal-input">
    {channelChoices.map(choice => <option key={choice.value} value={choice.value}>{choice.label}</option>)}
  </select>
)}
```

The native select is intentionally retained only for this rare advanced case when the list is larger than six.

- [ ] **Step 3: Run finance tests and typecheck**

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

### Task 4: Replace allocation movement selects with bucket choices

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/FinanceLedgerV2.tsx`
- Modify: `frontend/apps/usaha/src/components/business-control/finance-ledger-v3.contract.test.ts`

**Interfaces:**
- Preserve POST `/api/businesses/${businessId}/finance-core/allocations/move` body: `from_bucket`, `to_bucket`, `amount`, `reason`.

- [ ] **Step 1: Extend the failing contract**

```ts
expect(source).not.toMatch(/<select[\s\S]*?value=\{allocationFrom\}/);
expect(source).not.toMatch(/<select[\s\S]*?value=\{allocationTo\}/);
expect(source).toContain('Saldo setelah dipindah');
```

Run the contract; expected: FAIL.

- [ ] **Step 2: Import `allocationBalanceAfterMove` and build balance-labelled options**

```tsx
import { allocationBalanceAfterMove, commonFinanceChoices } from '@/lib/business-control/finance-ux';

const allocationChoiceOptions = [
  {
    value: 'unallocated',
    label: `Belum dibagi · ${money.format(summary?.unallocated_cash ?? 0)}`,
  },
  ...allocations.map(item => ({
    value: item.bucket,
    label: `${allocationLabels[item.bucket]} · ${money.format(item.balance)}`,
  })),
];
```

- [ ] **Step 3: Render source and destination groups**

```tsx
<ChoiceChips
  value={allocationFrom}
  onChange={setAllocationFrom}
  ariaLabel="Pindahkan dari"
  options={allocationChoiceOptions}
/>

<ChoiceChips
  value={allocationTo}
  onChange={setAllocationTo}
  ariaLabel="Pindahkan ke"
  options={allocationChoiceOptions.filter(item => item.value !== allocationFrom && item.value !== 'unallocated')}
/>
```

- [ ] **Step 4: Calculate and render preview from current balances**

Resolve source/destination balances:

```tsx
const sourceBalance = allocationFrom === 'unallocated'
  ? (summary?.unallocated_cash ?? 0)
  : (allocations.find(item => item.bucket === allocationFrom)?.balance ?? 0);
const destinationBalance = allocations.find(item => item.bucket === allocationTo)?.balance ?? 0;
const allocationPreview = allocationBalanceAfterMove({
  sourceBalance,
  destinationBalance,
  amount: Number(allocationAmount),
});
```

Render:

```tsx
<EffectPreview ariaLabel="Saldo setelah dipindah" items={[
  { label: 'Sumber setelah', value: money.format(allocationPreview.sourceAfter), tone: 'warning' },
  { label: 'Tujuan setelah', value: money.format(allocationPreview.destinationAfter), tone: 'positive' },
]} />
```

Disable `Pindahkan` if `!allocationPreview.valid`, source equals destination, reason is shorter than three characters, or the request is already pending.

- [ ] **Step 5: Run tests/typecheck and commit**

```bash
npm test -- src/components/business-control/finance-ledger-v3.contract.test.ts src/lib/business-control/finance-ux.test.ts
npm run typecheck
git add src/components/business-control/FinanceLedgerV2.tsx src/components/business-control/finance-ledger-v3.contract.test.ts
git commit -m "feat(usaha): simplify money allocation movement"
```

### Task 5: Simplify correction controls without changing immutable semantics

**Files:**
- Modify: `frontend/apps/usaha/src/components/business-control/FinanceLedgerV2.tsx`
- Modify: `frontend/apps/usaha/src/components/business-control/finance-ledger-v3.contract.test.ts`

**Interfaces:**
- Preserve POST `/api/businesses/${businessId}/finance-core/entries/${entry.id}/correct` body `{ reason, replacement }` and `Idempotency-Key`.

- [ ] **Step 1: Extend contract assertions**

```ts
expect(source).toContain("setCorrectionMode('correct')");
expect(source).toContain("setCorrectionMode('void')");
expect(source).toContain('reversal');
expect(source).toContain('Idempotency-Key');
```

- [ ] **Step 2: Replace correction account and bucket selects with explicit options**

```tsx
<ChoiceChips
  value={correctionAccount}
  onChange={setCorrectionAccount}
  ariaLabel="Akun pengganti"
  options={[
    { value: 'cash', label: 'Kas' },
    { value: 'bank', label: 'Bank' },
    { value: 'ewallet', label: 'E-wallet' },
    { value: 'receivable', label: 'Piutang' },
    { value: 'payable', label: 'Utang' },
  ]}
/>

<ChoiceChips
  value={correctionBucket}
  onChange={setCorrectionBucket}
  ariaLabel="Kantong pengganti"
  options={allocationOptions.map(item => ({ value: item.value, label: item.label }))}
/>
```

Keep replacement category as a native select because it combines the full income/expense taxonomy and appears only inside a rare correction flow.

- [ ] **Step 3: Render immutable-effect preview**

For `correct`:

```tsx
<EffectPreview items={[
  { label: 'Langkah 1', value: 'Transaksi lama dibalik', tone: 'warning' },
  { label: 'Langkah 2', value: 'Transaksi pengganti dibuat', tone: 'positive' },
]} />
```

For `void`:

```tsx
<EffectPreview items={[
  { label: 'Pembatalan', value: 'Transaksi lama dibalik penuh', tone: 'warning' },
]} />
```

Keep existing minimum-three-character correction reason validation.

- [ ] **Step 4: Run complete Usaha verification**

```bash
npm run lint
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 5: Commit**

```bash
git add src/components/business-control/FinanceLedgerV2.tsx src/components/business-control/finance-ledger-v3.contract.test.ts
git commit -m "feat(usaha): clarify finance correction workflow"
```
