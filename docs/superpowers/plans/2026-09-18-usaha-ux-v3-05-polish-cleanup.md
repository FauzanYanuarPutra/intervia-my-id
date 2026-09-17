# Usaha UX V3 — Targeted Polish and Legacy Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Finish UX V3 by polishing proven friction in team/location management, protecting already-good read-first surfaces, and removing superseded V2/legacy aliases only after usage is proven.

**Architecture:** Do not rewrite `info`, `operations`, `buyer-page`, or `reports`: current audit shows they are already progressive/read-first. Add one shared sensitive-confirmation primitive for destructive actions, convert the team role choice to visible options, and canonicalize known wrapper/V2 component names after tests prove imports are safe.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Vitest 3.

**Spec:** `docs/superpowers/specs/2026-09-18-usaha-ux-v3-design.md`

## Global Constraints

- No visual novelty refactor on already-good surfaces.
- Destructive actions require concise confirmation and preserve focus.
- Small role/status choices use visible controls.
- Legacy deletion requires proof of no remaining import/route use.
- Full Usaha and repository frontend verification is required before merge.

---

### Task 1: Add SensitiveActionConfirm for short destructive decisions

**Files:**
- Create: `frontend/apps/usaha/src/components/interaction/SensitiveActionConfirm.tsx`
- Modify: `frontend/apps/usaha/src/components/interaction/usaha-ux-v3-primitives.test.tsx`

**Interfaces:**
- Produces: `SensitiveActionConfirm({ open, title, description, confirmLabel, cancelLabel?, busy?, requireText?, value?, onValueChange?, onConfirm, onCancel })`.
- Uses existing `ModalSurface` because this is an approved short sensitive confirmation.

- [ ] **Step 1: Add failing primitive test**

```tsx
it('keeps sensitive confirmation short and explicit', () => {
  const html = renderToStaticMarkup(<SensitiveActionConfirm
    open title="Hapus lokasi?" description="Lokasi akan dihapus dari daftar outlet."
    confirmLabel="Hapus lokasi" onConfirm={() => {}} onCancel={() => {}}
  />);
  expect(html).toContain('Hapus lokasi?');
  expect(html).toContain('Hapus lokasi');
});
```

- [ ] **Step 2: Run and verify RED**

```bash
cd frontend/apps/usaha
npm test -- src/components/interaction/usaha-ux-v3-primitives.test.tsx
```
Expected: FAIL because `SensitiveActionConfirm` is missing.

- [ ] **Step 3: Implement with ModalSurface**

```tsx
export function SensitiveActionConfirm(props: Props) {
  return <ModalSurface open={props.open} onOpenChange={open => { if (!open && !props.busy) props.onCancel(); }} ariaLabel={props.title} size="sm" presentation="adaptive" dismissible={!props.busy}>
    <div className="p-4 sm:p-5">
      <h2 className="text-base font-black text-portal-ink">{props.title}</h2>
      <p className="mt-1 text-sm leading-6 text-portal-soft">{props.description}</p>
      {props.requireText ? <input value={props.value ?? ''} onChange={event => props.onValueChange?.(event.target.value)} className="portal-input mt-4 w-full" /> : null}
      <div className="mt-5 flex justify-end gap-2"><button type="button" className="portal-button-secondary" disabled={props.busy} onClick={props.onCancel}>{props.cancelLabel ?? 'Batal'}</button><button type="button" className="portal-button-primary" disabled={props.busy} onClick={props.onConfirm}>{props.confirmLabel}</button></div>
    </div>
  </ModalSurface>;
}
```

- [ ] **Step 4: Run primitive test and typecheck**

```bash
npm test -- src/components/interaction/usaha-ux-v3-primitives.test.tsx
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/interaction
git commit -m "feat(usaha): add sensitive action confirmation"
```

### Task 2: Make team-role choice visible

**Files:**
- Modify: `frontend/apps/usaha/src/components/forms/InviteMemberQuickForm.tsx`
- Create: `frontend/apps/usaha/src/components/forms/invite-member-v3.contract.test.ts`

**Interfaces:**
- Consumes `ChoiceChips`.
- Preserve invitation POST body `{ username, role }`.

- [ ] **Step 1: Write failing source contract**

```ts
const source = readFileSync('src/components/forms/InviteMemberQuickForm.tsx', 'utf8');
expect(source).toContain('ChoiceChips');
expect(source).not.toMatch(/<select[\s\S]*?value=\{role\}/);
expect(source).toContain('roleSummaryMap');
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/forms/invite-member-v3.contract.test.ts
```
Expected: FAIL because role still uses `<select>`.

- [ ] **Step 3: Replace role select with cards/chips**

```tsx
<ChoiceChips value={role} onChange={setRole} ariaLabel="Peran anggota" options={roleOptions.map(option => ({
  value: option.value, label: option.label, description: option.description,
}))} />
```

Keep the existing `Bisa / Tidak bisa` permission preview below the choice.

- [ ] **Step 4: Run targeted test and typecheck**

```bash
npm test -- src/components/forms/invite-member-v3.contract.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/InviteMemberQuickForm.tsx src/components/forms/invite-member-v3.contract.test.ts
git commit -m "feat(usaha): simplify team role selection"
```

### Task 3: Protect location deletion with sensitive confirmation

**Files:**
- Modify: `frontend/apps/usaha/src/components/forms/BusinessLocationsManager.tsx`
- Create: `frontend/apps/usaha/src/components/forms/business-locations-v3.contract.test.ts`

**Interfaces:**
- Consumes `SensitiveActionConfirm`.
- Existing PUT `/api/businesses/${businessId}/locations` remains the only persistence endpoint.

- [ ] **Step 1: Write failing source contract**

```ts
const source = readFileSync('src/components/forms/BusinessLocationsManager.tsx', 'utf8');
expect(source).toContain('SensitiveActionConfirm');
expect(source).toContain('pendingDelete');
expect(source).not.toContain("onClick={() => void save(locations.filter(item => item.id !== editing.id))}");
```

- [ ] **Step 2: Run and verify RED**

```bash
npm test -- src/components/forms/business-locations-v3.contract.test.ts
```
Expected: FAIL because delete currently saves immediately.

- [ ] **Step 3: Add pending-delete state and confirmation**

```tsx
const [pendingDelete, setPendingDelete] = useState<BusinessLocation | null>(null);
```

Change the delete button to `onClick={() => setPendingDelete(editing)}` and render:

```tsx
<SensitiveActionConfirm
  open={Boolean(pendingDelete)}
  title="Hapus lokasi?"
  description={`${pendingDelete?.name || 'Lokasi ini'} akan dihapus dari daftar outlet. Lokasi lain tidak berubah.`}
  confirmLabel="Hapus lokasi"
  busy={saving}
  onCancel={() => setPendingDelete(null)}
  onConfirm={() => {
    if (!pendingDelete) return;
    void save(locations.filter(item => item.id !== pendingDelete.id));
    setPendingDelete(null);
  }}
/>
```

If the pending location is the only location, keep deletion allowed only if the existing backend contract already allows an empty array; otherwise disable confirm and show `Usaha harus memiliki minimal satu lokasi.` based on the current endpoint behavior verified by existing route tests.

- [ ] **Step 4: Run targeted test and typecheck**

```bash
npm test -- src/components/forms/business-locations-v3.contract.test.ts
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/forms/BusinessLocationsManager.tsx src/components/forms/business-locations-v3.contract.test.ts
git commit -m "feat(usaha): confirm location deletion"
```

### Task 4: Lock already-good read-first surfaces against unnecessary modal/dropdown drift

**Files:**
- Create: `frontend/apps/usaha/src/components/business-control/remaining-surfaces-v3.contract.test.ts`
- Read only: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/info/page.tsx`
- Read only: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/operations/page.tsx`
- Read only: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/buyer-page/page.tsx`
- Read only: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/reports/page.tsx`

**Interfaces:** No production interface changes.

- [ ] **Step 1: Add behavior-oriented source guards**

```ts
const files = [
  'src/app/(portal)/businesses/[businessId]/info/page.tsx',
  'src/app/(portal)/businesses/[businessId]/operations/page.tsx',
  'src/app/(portal)/businesses/[businessId]/buyer-page/page.tsx',
  'src/app/(portal)/businesses/[businessId]/reports/page.tsx',
].map(path => readFileSync(path, 'utf8'));

it('keeps audited read-first pages free of blocking workflow modals', () => {
  for (const source of files) expect(source).not.toContain('ModalSurface');
});

it('keeps reports read-oriented', () => {
  const reports = files[3];
  expect(reports).toContain('MetricStrip');
  expect(reports).not.toContain('<form');
});
```

- [ ] **Step 2: Run test**

```bash
npm test -- src/components/business-control/remaining-surfaces-v3.contract.test.ts
```
Expected: PASS immediately. This test documents the audit conclusion; do not modify the audited pages to manufacture a diff.

- [ ] **Step 3: Commit the guard**

```bash
git add src/components/business-control/remaining-surfaces-v3.contract.test.ts
git commit -m "test(usaha): protect read-first management surfaces"
```

### Task 5: Canonicalize FinanceLedger and FinancePlanningWorkspace names

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/finance/page.tsx`
- Replace canonical implementation: `frontend/apps/usaha/src/components/business-control/FinanceLedger.tsx`
- Delete after move: `frontend/apps/usaha/src/components/business-control/FinanceLedgerV2.tsx`
- Replace canonical implementation: `frontend/apps/usaha/src/components/business-control/FinancePlanningWorkspace.tsx`
- Delete after move: `frontend/apps/usaha/src/components/business-control/FinancePlanningWorkspaceV2.tsx`
- Update tests/imports matching V2 names.

**Interfaces:**
- Final exports are `FinanceLedger` and `FinancePlanningWorkspace` only.

- [ ] **Step 1: Prove references before rename**

```bash
cd frontend/apps/usaha
rg "FinanceLedgerV2|FinancePlanningWorkspaceV2" src
```
Expected before cleanup: wrapper files, V2 implementation declarations, and any direct tests/imports only. If a separate production route imports a V2 symbol directly, update that import in the same task before deletion.

- [ ] **Step 2: Move implementation code to canonical files**

Use git moves locally so history is retained:

```bash
git rm src/components/business-control/FinanceLedger.tsx
git mv src/components/business-control/FinanceLedgerV2.tsx src/components/business-control/FinanceLedger.tsx
git rm src/components/business-control/FinancePlanningWorkspace.tsx
git mv src/components/business-control/FinancePlanningWorkspaceV2.tsx src/components/business-control/FinancePlanningWorkspace.tsx
```

Rename exported functions inside the moved files:

```ts
export function FinanceLedger(...) { ... }
export function FinancePlanningWorkspace(...) { ... }
```

Update test imports and the finance page to canonical names.

- [ ] **Step 3: Prove V2 names are gone**

```bash
rg "FinanceLedgerV2|FinancePlanningWorkspaceV2" src
```
Expected: no output.

- [ ] **Step 4: Run finance tests and typecheck**

```bash
npm test -- FinanceLedger FinancePlanning finance-ledger-v3
npm run typecheck
```
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add -A src/components/business-control src/app/'(portal)'/businesses/'[businessId]'/finance/page.tsx
git commit -m "refactor(usaha): canonicalize finance workspaces"
```

### Task 6: Canonicalize IngredientWorkspace after proving the legacy implementation is unused

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/inventory/page.tsx`
- Replace canonical implementation: `frontend/apps/usaha/src/components/business-control/IngredientWorkspace.tsx`
- Delete after move: `frontend/apps/usaha/src/components/business-control/IngredientWorkspaceV2.tsx`
- Consolidate tests: `frontend/apps/usaha/src/components/business-control/IngredientWorkspace.test.tsx`
- Delete after consolidation: `frontend/apps/usaha/src/components/business-control/IngredientWorkspaceV2.test.tsx`

**Interfaces:**
- Final export is `IngredientWorkspace` with the V2 props: `businessId`, `initialIngredients`, `primaryLocationId`, `primaryLocationName`, `canManage`.

- [ ] **Step 1: Prove production usage**

```bash
cd frontend/apps/usaha
rg "IngredientWorkspace(V2)?" src --glob '!components/business-control/IngredientWorkspace*.tsx'
```
Expected current production route: inventory page imports/uses `IngredientWorkspaceV2`; no production route should still rely on the old implementation.

- [ ] **Step 2: Replace old implementation with V2 under the canonical name**

```bash
git rm src/components/business-control/IngredientWorkspace.tsx
git mv src/components/business-control/IngredientWorkspaceV2.tsx src/components/business-control/IngredientWorkspace.tsx
```

Rename the exported function from `IngredientWorkspaceV2` to `IngredientWorkspace` and change inventory page import/use accordingly.

- [ ] **Step 3: Consolidate tests around the canonical implementation**

Replace the old legacy test with the V2 behavior coverage: business language, auditable stock actions, effective cost, and legacy yield/waste normalization. Rename imports to `IngredientWorkspace`. Remove `IngredientWorkspaceV2.test.tsx` after its assertions have been copied.

- [ ] **Step 4: Prove V2 names are gone and run tests**

```bash
rg "IngredientWorkspaceV2" src
npm test -- src/components/business-control/IngredientWorkspace.test.tsx
npm run typecheck
```
Expected: `rg` no output; tests PASS.

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
Expected: all exit 0.

- [ ] **Step 2: Run regression searches**

```bash
rg "ModalSurface" src/components/forms src/components/business-control
rg "<select" src/components/forms src/components/business-control
rg "WorkspaceV2|LedgerV2" src
```
Expected:
- `ModalSurface` appears only in approved short confirmation flows or unrelated legitimate short interactions.
- Remaining `<select>` instances are rare/compact advanced choices documented by the spec, not core long-list workflows.
- canonicalized V2 names from Tasks 5–6 are absent.

- [ ] **Step 3: Compare branch scope**

```bash
git diff --stat main...HEAD
git diff --name-only main...HEAD
```
Expected: changes stay inside `frontend/apps/usaha` plus V3 docs/plans; no backend/migration changes unless separately designed and approved.

- [ ] **Step 4: Push branch and verify CI**

Run the repository's normal PR workflow. Required green evidence for branch-owned work: Usaha Business OS Gate, repository Frontend lint/test/build, production build/runtime image where CI runs it, Security/KYC gates where triggered.

- [ ] **Step 5: Compare any repo-wide red job against `main` before merge**

If a non-Usaha job is red, fetch its exact failing tests and compare with the same job on current `main`; document baseline-only failures rather than patching unrelated backend code into the UX PR.

- [ ] **Step 6: Merge with expected-head SHA protection only after verification**

Use the reviewed PR head SHA as `expected_head_sha` when merging. Verify after merge that `main` points to the returned merge commit.
