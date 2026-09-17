# Usaha UX V3 — Targeted Polish and Legacy Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish UX V3 by polishing proven friction in team/location management, protecting already-good read-first surfaces, and removing superseded V2/legacy aliases only after usage is proven.

**Architecture:** Do not rewrite `info`, `operations`, `buyer-page`, or `reports`: audit shows they are already progressive/read-first. Add one short sensitive-confirmation primitive, convert the three-option team role selector to visible choices, protect location deletion, then canonicalize wrapper/V2 component names after reference searches prove it is safe.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-18-usaha-ux-v3-design.md`

## Global Constraints

- No visual-novelty refactor on already-good surfaces.
- Destructive actions require concise confirmation and focus restoration.
- Small role/status choices use visible controls.
- `replaceBusinessLocations` requires at least one primary location, so the last location cannot be deleted.
- Legacy deletion requires proof of no remaining production/test import before file removal.
- Full Usaha and repository frontend verification is required before merge.

---

### Task 1: Add `SensitiveActionConfirm`

**Files:**
- Create: `frontend/apps/usaha/src/components/interaction/SensitiveActionConfirm.tsx`
- Modify: `frontend/apps/usaha/src/components/interaction/usaha-ux-v3-primitives.test.tsx`

**Interfaces:**
- Produces: `SensitiveActionConfirm` for short destructive/sensitive decisions only.
- Uses existing `ModalSurface` as an approved confirmation use case.
- Accepts `returnFocusRef` and passes it through to `ModalSurface`.

- [ ] **Step 1: Add the failing primitive test**

```tsx
import { SensitiveActionConfirm } from './SensitiveActionConfirm';

it('renders a short explicit sensitive confirmation', () => {
  const html = renderToStaticMarkup(
    <SensitiveActionConfirm
      open
      title="Hapus lokasi?"
      description="Lokasi akan dihapus dari daftar outlet."
      confirmLabel="Hapus lokasi"
      onConfirm={() => {}}
      onCancel={() => {}}
    />,
  );
  expect(html).toContain('Hapus lokasi?');
  expect(html).toContain('Hapus lokasi');
});
```

- [ ] **Step 2: Run and verify RED**

```bash
cd frontend/apps/usaha
npm test -- src/components/interaction/usaha-ux-v3-primitives.test.tsx
```

Expected: FAIL because the component is missing.

- [ ] **Step 3: Implement the confirmation component with explicit props**

```tsx
'use client';

import type { RefObject } from 'react';
import { ModalSurface } from '@/components/interaction/ModalSurface';

type Props = {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  cancelLabel?: string;
  busy?: boolean;
  requireText?: boolean;
  value?: string;
  onValueChange?: (value: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

export function SensitiveActionConfirm({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = 'Batal',
  busy = false,
  requireText = false,
  value = '',
  onValueChange,
  onConfirm,
  onCancel,
  returnFocusRef,
}: Props) {
  return (
    <ModalSurface
      open={open}
      onOpenChange={next => {
        if (!next && !busy) onCancel();
      }}
      ariaLabel={title}
      presentation="adaptive"
      size="sm"
      dismissible={!busy}
      returnFocusRef={returnFocusRef}
    >
      <div className="p-4 sm:p-5">
        <h2 className="text-base font-black text-portal-ink">{title}</h2>
        <p className="mt-1 text-sm leading-6 text-portal-soft">{description}</p>
        {requireText ? (
          <input
            value={value}
            onChange={event => onValueChange?.(event.target.value)}
            className="portal-input mt-4 w-full"
          />
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className="portal-button-secondary" disabled={busy} onClick={onCancel}>{cancelLabel}</button>
          <button type="button" className="portal-button-primary" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </ModalSurface>
  );
}
```

If `ModalSurface` types `returnFocusRef` more narrowly than `RefObject<HTMLElement | null>`, use that component's exported/declared ref type rather than weakening with `any`.

- [ ] **Step 4: Run test and typecheck**

```bash
npm test -- src/components/interaction/usaha-ux-v3-primitives.test.tsx
npm run typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/interaction/SensitiveActionConfirm.tsx src/components/interaction/usaha-ux-v3-primitives.test.tsx
git commit -m "feat(usaha): add sensitive action confirmation"
```

### Task 2: Make team-role selection visible

**Files:**
- Modify: `frontend/apps/usaha/src/components/forms/InviteMemberQuickForm.tsx`
- Create: `frontend/apps/usaha/src/components/forms/invite-member-v3.contract.test.ts`

**Interfaces:**
- Preserve invitation POST body `{ username, role }`.
- Keep existing remote username search and role permission preview.

- [ ] **Step 1: Write the failing contract**

```ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const source = readFileSync('src/components/forms/InviteMemberQuickForm.tsx', 'utf8');

it('shows the three team roles as visible choices', () => {
  expect(source).toContain('ChoiceChips');
  expect(source).not.toMatch(/<select[\s\S]*?value=\{role\}/);
  expect(source).toContain('roleSummaryMap');
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/forms/invite-member-v3.contract.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Replace the role select**

Import `ChoiceChips`, then render:

```tsx
<ChoiceChips
  value={role}
  onChange={setRole}
  ariaLabel="Peran anggota"
  options={roleOptions.map(option => ({
    value: option.value,
    label: option.label,
    description: option.description,
  }))}
/>
```

Keep the current `Bisa` / `Tidak bisa` permission preview directly below this control.

- [ ] **Step 4: Run tests/typecheck and commit**

```bash
npm test -- src/components/forms/invite-member-v3.contract.test.ts
npm run typecheck
git add src/components/forms/InviteMemberQuickForm.tsx src/components/forms/invite-member-v3.contract.test.ts
git commit -m "feat(usaha): simplify team role selection"
```

### Task 3: Protect location deletion and prohibit deleting the last location

**Files:**
- Modify: `frontend/apps/usaha/src/components/forms/BusinessLocationsManager.tsx`
- Create: `frontend/apps/usaha/src/components/forms/business-locations-v3.contract.test.ts`

**Interfaces:**
- Existing PUT `/api/businesses/${businessId}/locations` remains the persistence endpoint.
- Backend `replaceBusinessLocations` throws `primary_location_required` when the array is empty, so UI disables deletion when `locations.length === 1`.

- [ ] **Step 1: Write the failing contract**

```ts
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';

const source = readFileSync('src/components/forms/BusinessLocationsManager.tsx', 'utf8');

it('confirms location deletion and protects the last location', () => {
  expect(source).toContain('SensitiveActionConfirm');
  expect(source).toContain('pendingDelete');
  expect(source).toContain('locations.length === 1');
  expect(source).not.toContain("onClick={() => void save(locations.filter(item => item.id !== editing.id))}");
});
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/forms/business-locations-v3.contract.test.ts
```

Expected: FAIL.

- [ ] **Step 3: Add state/ref and replace immediate delete**

Add imports/state:

```tsx
import { useRef, useState } from 'react';
import { SensitiveActionConfirm } from '@/components/interaction/SensitiveActionConfirm';

const deleteButtonRef = useRef<HTMLButtonElement>(null);
const [pendingDelete, setPendingDelete] = useState<BusinessLocation | null>(null);
const lastLocation = locations.length === 1;
```

Replace the delete button with:

```tsx
<button
  ref={deleteButtonRef}
  type="button"
  className="portal-button-secondary"
  disabled={lastLocation || saving}
  title={lastLocation ? 'Usaha harus memiliki minimal satu lokasi.' : undefined}
  onClick={() => setPendingDelete(editing)}
>
  <Trash2 className="h-4 w-4" /> Hapus
</button>
```

When `lastLocation` is true, render the explanation next to the disabled control:

```tsx
{lastLocation ? (
  <p className="text-xs text-portal-soft">Usaha harus memiliki minimal satu lokasi.</p>
) : null}
```

- [ ] **Step 4: Render the confirmation and delete only after confirm**

```tsx
<SensitiveActionConfirm
  open={Boolean(pendingDelete)}
  title="Hapus lokasi?"
  description={`${pendingDelete?.name || 'Lokasi ini'} akan dihapus dari daftar outlet. Lokasi lain tidak berubah.`}
  confirmLabel="Hapus lokasi"
  busy={saving}
  returnFocusRef={deleteButtonRef}
  onCancel={() => setPendingDelete(null)}
  onConfirm={() => {
    if (!pendingDelete || locations.length === 1) return;
    const next = locations.filter(item => item.id !== pendingDelete.id);
    setPendingDelete(null);
    void save(next);
  }}
/>
```

- [ ] **Step 5: Run tests/typecheck and commit**

```bash
npm test -- src/components/forms/business-locations-v3.contract.test.ts
npm run typecheck
git add src/components/forms/BusinessLocationsManager.tsx src/components/forms/business-locations-v3.contract.test.ts
git commit -m "feat(usaha): confirm location deletion"
```

### Task 4: Guard already-good read-first surfaces

**Files:**
- Create: `frontend/apps/usaha/src/components/business-control/remaining-surfaces-v3.contract.test.ts`
- Read only: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/info/page.tsx`
- Read only: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/operations/page.tsx`
- Read only: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/buyer-page/page.tsx`
- Read only: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/reports/page.tsx`

- [ ] **Step 1: Add guards that should pass immediately**

```ts
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const paths = [
  'src/app/(portal)/businesses/[businessId]/info/page.tsx',
  'src/app/(portal)/businesses/[businessId]/operations/page.tsx',
  'src/app/(portal)/businesses/[businessId]/buyer-page/page.tsx',
  'src/app/(portal)/businesses/[businessId]/reports/page.tsx',
];
const sources = paths.map(path => readFileSync(path, 'utf8'));

describe('audited read-first surfaces', () => {
  it('stay free of blocking workflow modals', () => {
    for (const source of sources) expect(source).not.toContain('ModalSurface');
  });

  it('keeps reports read-oriented', () => {
    const reports = sources[3];
    expect(reports).toContain('MetricStrip');
    expect(reports).not.toContain('<form');
  });
});
```

- [ ] **Step 2: Run and verify GREEN**

```bash
npm test -- src/components/business-control/remaining-surfaces-v3.contract.test.ts
```

Expected: PASS. Do not modify these four production pages just to create a diff.

- [ ] **Step 3: Commit the guard**

```bash
git add src/components/business-control/remaining-surfaces-v3.contract.test.ts
git commit -m "test(usaha): protect read-first management surfaces"
```

### Task 5: Canonicalize finance workspace names

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/finance/page.tsx`
- Replace canonical implementation: `frontend/apps/usaha/src/components/business-control/FinanceLedger.tsx`
- Remove after move: `frontend/apps/usaha/src/components/business-control/FinanceLedgerV2.tsx`
- Replace canonical implementation: `frontend/apps/usaha/src/components/business-control/FinancePlanningWorkspace.tsx`
- Remove after move: `frontend/apps/usaha/src/components/business-control/FinancePlanningWorkspaceV2.tsx`
- Update tests/imports that reference V2 symbols.

**Interfaces:**
- Final exports are `FinanceLedger` and `FinancePlanningWorkspace` only.

- [ ] **Step 1: Prove references before rename**

```bash
cd frontend/apps/usaha
rg "FinanceLedgerV2|FinancePlanningWorkspaceV2" src
```

Expected: wrapper files, V2 implementation declarations, and any direct tests/imports. Record every result before deletion.

- [ ] **Step 2: Move implementation files over the wrappers**

```bash
git rm src/components/business-control/FinanceLedger.tsx
git mv src/components/business-control/FinanceLedgerV2.tsx src/components/business-control/FinanceLedger.tsx
git rm src/components/business-control/FinancePlanningWorkspace.tsx
git mv src/components/business-control/FinancePlanningWorkspaceV2.tsx src/components/business-control/FinancePlanningWorkspace.tsx
```

- [ ] **Step 3: Rename the exact exported declarations**

In the moved ledger file, replace:

```ts
export function FinanceLedgerV2(
```

with:

```ts
export function FinanceLedger(
```

In the moved planning file, replace:

```ts
export function FinancePlanningWorkspaceV2(
```

with:

```ts
export function FinancePlanningWorkspace(
```

Update any test imports to the canonical names. The finance page already imports the canonical wrapper names; after the moves those imports should continue to resolve without route changes.

- [ ] **Step 4: Prove V2 names are gone**

```bash
rg "FinanceLedgerV2|FinancePlanningWorkspaceV2" src
```

Expected: no output.

- [ ] **Step 5: Run finance tests/typecheck and commit**

```bash
npm test -- FinanceLedger FinancePlanning finance-ledger-v3
npm run typecheck
git add -A src/components/business-control src/app/'(portal)'/businesses/'[businessId]'/finance/page.tsx
git commit -m "refactor(usaha): canonicalize finance workspaces"
```

### Task 6: Canonicalize `IngredientWorkspace` after proving legacy usage is gone

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/inventory/page.tsx`
- Replace canonical implementation: `frontend/apps/usaha/src/components/business-control/IngredientWorkspace.tsx`
- Remove after move: `frontend/apps/usaha/src/components/business-control/IngredientWorkspaceV2.tsx`
- Consolidate: `frontend/apps/usaha/src/components/business-control/IngredientWorkspace.test.tsx`
- Remove after consolidation: `frontend/apps/usaha/src/components/business-control/IngredientWorkspaceV2.test.tsx`

**Interfaces:**
- Final export: `IngredientWorkspace({ businessId, initialIngredients, primaryLocationId, primaryLocationName, canManage })`.

- [ ] **Step 1: Prove production references**

```bash
cd frontend/apps/usaha
rg "IngredientWorkspace(V2)?" src --glob '!components/business-control/IngredientWorkspace*.tsx'
```

Expected before cleanup: inventory page imports/uses `IngredientWorkspaceV2`; no other production route relies on the legacy `IngredientWorkspace` implementation. If any additional production import appears, stop this task and update the plan before deleting files.

- [ ] **Step 2: Replace the legacy implementation with V2 under the canonical filename**

```bash
git rm src/components/business-control/IngredientWorkspace.tsx
git mv src/components/business-control/IngredientWorkspaceV2.tsx src/components/business-control/IngredientWorkspace.tsx
```

In the moved file replace the exact declaration:

```ts
export function IngredientWorkspaceV2(
```

with:

```ts
export function IngredientWorkspace(
```

In inventory page replace:

```ts
import { IngredientWorkspaceV2 } from '@/components/business-control/IngredientWorkspaceV2';
```

with:

```ts
import { IngredientWorkspace } from '@/components/business-control/IngredientWorkspace';
```

and replace `<IngredientWorkspaceV2` with `<IngredientWorkspace`.

- [ ] **Step 3: Consolidate tests onto the canonical implementation**

Replace the contents of `IngredientWorkspace.test.tsx` with the behavioral cases currently held by `IngredientWorkspaceV2.test.tsx`, changing only the import and component name:

```ts
import { IngredientWorkspace } from './IngredientWorkspace';
```

The consolidated test must retain these four cases:
- business language instead of raw database field labels;
- auditable/unit-aware stock actions;
- effective cost and human-readable purchase summary;
- legacy yield + waste normalization to one usable percentage.

After those assertions exist in `IngredientWorkspace.test.tsx`, delete `IngredientWorkspaceV2.test.tsx`.

- [ ] **Step 4: Prove V2 names are gone**

```bash
rg "IngredientWorkspaceV2" src
npm test -- src/components/business-control/IngredientWorkspace.test.tsx
npm run typecheck
```

Expected: `rg` has no output; test and typecheck pass.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/business-control src/app/'(portal)'/businesses/'[businessId]'/inventory/page.tsx
git commit -m "refactor(usaha): canonicalize ingredient workspace"
```

### Task 7: Final V3 verification and PR readiness

**Files:** No production changes expected unless verification exposes a branch-owned regression.

- [ ] **Step 1: Run complete Usaha verification**

```bash
cd frontend/apps/usaha
npm run lint
npm test
npm run typecheck
npm run build
```

Expected: all commands exit 0.

- [ ] **Step 2: Run regression searches**

```bash
rg "ModalSurface" src/components/forms src/components/business-control
rg "<select" src/components/forms src/components/business-control
rg "WorkspaceV2|LedgerV2" src
```

Expected:
- `ModalSurface` appears only in approved short confirmations or other demonstrably short/sensitive interactions.
- Remaining `<select>` instances are rare/compact advanced choices allowed by the spec, not core long-list daily workflows.
- Canonicalized V2 names from Tasks 5–6 are absent.

- [ ] **Step 3: Compare branch scope**

```bash
git diff --stat main...HEAD
git diff --name-only main...HEAD
```

Expected: changes stay inside `frontend/apps/usaha` plus V3 docs/plans; no backend/migration changes.

- [ ] **Step 4: Push branch and verify CI**

Required green evidence for branch-owned work: Usaha Business OS Gate, repository Frontend lint/test/build, production/runtime image where triggered, Security, and KYC gates where triggered.

- [ ] **Step 5: Compare any repository-wide red job against current `main`**

For each red job, fetch the exact failing tests and compare them with the same job on current `main`. Document a pre-existing baseline failure rather than patching unrelated backend code into the UX branch.

- [ ] **Step 6: Merge only with expected-head SHA protection**

Use the reviewed PR head SHA as `expected_head_sha`. After merge, verify both that the PR is `merged` and that `main` points to the returned merge commit.
