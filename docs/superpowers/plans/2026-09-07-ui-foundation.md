# Shared UI Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `frontend/packages` the canonical visual and interaction foundation for WWW, Usaha, CMS, and CRM without forcing the applications into identical navigation or density.

**Architecture:** Extend the existing `lajukan-ui` package in place. Keep shared code limited to cross-app primitives and semantic tokens; app workflows remain app-owned. Add a lightweight contract test harness in the package so behavior and accessibility can be developed test-first before consumers migrate.

**Tech Stack:** React 19, TypeScript, class-variance-authority, clsx, tailwind-merge, Vitest, Testing Library, jsdom.

**Spec:** `docs/superpowers/specs/2026-09-07-frontend-experience-redesign-design.md`

## Global Constraints

- WWW and Usaha are mobile-first; CMS and CRM are desktop-first but tablet/small-screen safe.
- Never fabricate prices, revenue, counts, margins, readiness, activity, or status.
- Permission-sensitive actions must not appear actionable to unauthorized roles.
- Shared semantics for neutral, primary, success, warning, danger, and info must remain consistent across apps.
- Keep app-specific workflows out of `frontend/packages`.
- Every behavior change follows TDD: failing test, minimal implementation, passing test.
- Every task must leave `npm run build` green in `frontend/packages`.

---

## File Structure

### Existing files to modify
- `frontend/packages/package.json` — shared package scripts and test dependencies.
- `frontend/packages/tokens.css` — canonical semantic tokens, typography, layout, focus, motion.
- `frontend/packages/ui/Button.tsx` — canonical action variants and loading semantics.
- `frontend/packages/ui/Input.tsx` — canonical field error/description semantics.
- `frontend/packages/ui/Card.tsx` — canonical surface density and sections.
- `frontend/packages/ui/EmptyState.tsx` — actionable empty-state contract.
- `frontend/packages/ui/Modal.tsx` — accessible modal behavior.
- `frontend/packages/ui/index.ts` — public exports.
- `frontend/packages/index.ts` — package-level exports if required by current barrel structure.

### New files
- `frontend/packages/vitest.config.ts` — jsdom test environment.
- `frontend/packages/test/setup.ts` — DOM cleanup and matchers.
- `frontend/packages/ui/StatusBadge.tsx` — semantic status rendering.
- `frontend/packages/ui/Alert.tsx` — semantic inline/system feedback.
- `frontend/packages/ui/PageHeader.tsx` — page title/description/primary action hierarchy.
- `frontend/packages/ui/SectionHeader.tsx` — section hierarchy.
- `frontend/packages/ui/Drawer.tsx` — mobile/small-screen secondary panel.
- `frontend/packages/ui/ConfirmDialog.tsx` — destructive/important confirmation.
- `frontend/packages/ui/FilterBar.tsx` — reusable search/filter container.
- `frontend/packages/ui/Pagination.tsx` — explicit paging state.
- `frontend/packages/ui/Table.tsx` — responsive table building blocks, not domain logic.
- `frontend/packages/ui/__tests__/tokens.test.ts` — semantic token contract.
- `frontend/packages/ui/__tests__/Button.test.tsx`
- `frontend/packages/ui/__tests__/Input.test.tsx`
- `frontend/packages/ui/__tests__/EmptyState.test.tsx`
- `frontend/packages/ui/__tests__/Modal.test.tsx`
- `frontend/packages/ui/__tests__/StatusBadge.test.tsx`
- `frontend/packages/ui/__tests__/ConfirmDialog.test.tsx`
- `frontend/packages/ui/__tests__/FilterBar.test.tsx`

---

### Task 1: Add the shared UI test harness and semantic token contract

**Files:**
- Modify: `frontend/packages/package.json`
- Create: `frontend/packages/vitest.config.ts`
- Create: `frontend/packages/test/setup.ts`
- Modify: `frontend/packages/tokens.css`
- Create: `frontend/packages/ui/__tests__/tokens.test.ts`

**Interfaces:**
- Consumes: current CSS custom properties in `tokens.css`.
- Produces: stable semantic token names used by every later shared primitive.

- [ ] **Step 1: Write the failing token contract test**

```ts
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const css = readFileSync(resolve(process.cwd(), 'tokens.css'), 'utf8');

const requiredTokens = [
  '--color-info',
  '--color-info-soft',
  '--color-info-border',
  '--color-focus',
  '--content-width-sm',
  '--content-width-md',
  '--content-width-lg',
  '--motion-fast',
  '--motion-normal',
  '--touch-target',
];

describe('shared semantic tokens', () => {
  it.each(requiredTokens)('defines %s', (token) => {
    expect(css).toContain(token);
  });
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:
```bash
cd frontend/packages
npm install
npm test -- ui/__tests__/tokens.test.ts
```
Expected: FAIL because the new semantic/layout tokens do not exist yet.

- [ ] **Step 3: Add the test harness**

Add scripts/dependencies to `package.json`:
```json
{
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -w -p tsconfig.build.json --preserveWatchOutput",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.9.1",
    "@testing-library/react": "^16.3.0",
    "@testing-library/user-event": "^14.6.1",
    "jsdom": "^26.1.0",
    "typescript": "7.0.2",
    "vitest": "^3.2.4"
  }
}
```

Create `vitest.config.ts`:
```ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./test/setup.ts'],
    include: ['ui/**/*.test.ts', 'ui/**/*.test.tsx'],
  },
});
```

Create `test/setup.ts`:
```ts
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

afterEach(() => cleanup());
```

- [ ] **Step 4: Extend `tokens.css` minimally**

Add semantic info, focus, content width, motion, and touch-target tokens to both light/dark themes where color-specific:
```css
--color-info: #2563eb;
--color-info-soft: #dbeafe;
--color-info-border: color-mix(in srgb, var(--color-info) 38%, transparent);
--color-focus: var(--color-primary);
--content-width-sm: 42rem;
--content-width-md: 64rem;
--content-width-lg: 80rem;
--motion-fast: 120ms;
--motion-normal: 180ms;
--touch-target: 2.75rem;
```

Dark theme uses:
```css
--color-info: #60a5fa;
--color-info-soft: #172554;
```

- [ ] **Step 5: Run tests/build and commit**

Run:
```bash
cd frontend/packages
npm test
npm run build
```
Expected: PASS.

Commit:
```bash
git add frontend/packages
git commit -m "feat: extend shared UI semantic foundation"
```

---

### Task 2: Normalize primary action, field, surface, status, and empty-state primitives

**Files:**
- Modify: `frontend/packages/ui/Button.tsx`
- Modify: `frontend/packages/ui/Input.tsx`
- Modify: `frontend/packages/ui/Card.tsx`
- Modify: `frontend/packages/ui/EmptyState.tsx`
- Create: `frontend/packages/ui/StatusBadge.tsx`
- Create: `frontend/packages/ui/Alert.tsx`
- Create: `frontend/packages/ui/PageHeader.tsx`
- Create: `frontend/packages/ui/SectionHeader.tsx`
- Create tests under `frontend/packages/ui/__tests__/`
- Modify: `frontend/packages/ui/index.ts`

**Interfaces:**
- Produces `ButtonProps` with `loading?: boolean` and `loadingLabel?: string`.
- Produces `InputProps` with `error?: string`, `description?: string`.
- Produces `StatusTone = 'neutral' | 'primary' | 'success' | 'warning' | 'danger' | 'info'`.
- Produces `StatusBadge({ tone, children })`.
- Produces `PageHeader({ title, description, primaryAction, secondaryActions })`.
- Produces `EmptyState({ title, description, action })` with exactly one primary action slot.

- [ ] **Step 1: Write failing Button behavior test**

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import { Button } from '../Button';

it('disables activation and exposes pending text while loading', async () => {
  const user = userEvent.setup();
  const onClick = vi.fn();
  render(<Button loading loadingLabel="Menyimpan" onClick={onClick}>Simpan</Button>);
  expect(screen.getByRole('button', { name: /menyimpan/i })).toBeDisabled();
  await user.click(screen.getByRole('button'));
  expect(onClick).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the test and verify RED**

Run:
```bash
cd frontend/packages
npm test -- ui/__tests__/Button.test.tsx
```
Expected: FAIL because `loading` is not implemented.

- [ ] **Step 3: Implement the Button contract**

Required signature:
```ts
export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  loadingLabel?: string;
}
```

Implementation rule:
```tsx
const isDisabled = disabled || loading;
return (
  <button disabled={isDisabled} aria-busy={loading || undefined} {...props}>
    {loading ? loadingLabel ?? children : children}
  </button>
);
```

- [ ] **Step 4: Write failing field/status/empty-state tests**

```tsx
it('connects input error text with aria-describedby', () => {
  render(<Input label="Nama" error="Nama wajib diisi" />);
  expect(screen.getByRole('textbox', { name: 'Nama' })).toHaveAccessibleDescription('Nama wajib diisi');
});

it('uses semantic status text without relying on color only', () => {
  render(<StatusBadge tone="warning">Perlu tindakan</StatusBadge>);
  expect(screen.getByText('Perlu tindakan')).toBeVisible();
});

it('renders one explicit next action in empty state', () => {
  render(<EmptyState title="Belum ada produk" description="Tambahkan produk pertama." action={<Button>Tambah produk</Button>} />);
  expect(screen.getAllByRole('button')).toHaveLength(1);
});
```

- [ ] **Step 5: Implement minimal primitives and exports**

`StatusBadge.tsx` tone mapping must use semantic CSS variables/classes only. `Alert.tsx` uses the same `StatusTone`. `PageHeader` must render one visually dominant `primaryAction`; secondary actions use a separate slot and no default primary styling. `SectionHeader` renders `h2` by default with optional `as` override.

- [ ] **Step 6: Run all shared tests/build and commit**

Run:
```bash
cd frontend/packages
npm test
npm run build
```
Expected: PASS.

Commit:
```bash
git add frontend/packages/ui frontend/packages/package*.json
git commit -m "feat: standardize shared UI states and actions"
```

---

### Task 3: Make modal, drawer, and confirmation interactions accessible

**Files:**
- Modify: `frontend/packages/ui/Modal.tsx`
- Create: `frontend/packages/ui/Drawer.tsx`
- Create: `frontend/packages/ui/ConfirmDialog.tsx`
- Create: `frontend/packages/ui/__tests__/Modal.test.tsx`
- Create: `frontend/packages/ui/__tests__/ConfirmDialog.test.tsx`
- Modify: `frontend/packages/ui/index.ts`

**Interfaces:**
- `ModalProps`: `open`, `onOpenChange`, `title`, `description?`, `children`, `initialFocusRef?`.
- `DrawerProps`: same disclosure contract plus `side?: 'left' | 'right' | 'bottom'`.
- `ConfirmDialogProps`: `open`, `title`, `description`, `confirmLabel`, `cancelLabel?`, `tone?: 'primary' | 'danger'`, `loading?`, `onConfirm`, `onOpenChange`.

- [ ] **Step 1: Write failing focus/escape/return tests**

```tsx
it('moves focus into modal, closes on Escape, and returns focus', async () => {
  const user = userEvent.setup();
  function Harness() {
    const [open, setOpen] = React.useState(false);
    return <><button onClick={() => setOpen(true)}>Open</button><Modal open={open} onOpenChange={setOpen} title="Edit"><button>Save</button></Modal></>;
  }
  render(<Harness />);
  await user.click(screen.getByRole('button', { name: 'Open' }));
  expect(screen.getByRole('dialog')).toContainElement(document.activeElement as HTMLElement);
  await user.keyboard('{Escape}');
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open' })).toHaveFocus();
});
```

- [ ] **Step 2: Verify RED**

Run:
```bash
cd frontend/packages
npm test -- ui/__tests__/Modal.test.tsx
```
Expected: current modal fails one or more focus lifecycle assertions.

- [ ] **Step 3: Implement disclosure lifecycle without adding a second design system**

Use React DOM/refs already available. Do not introduce a new UI framework solely for modal behavior. Required semantics:
```tsx
<div role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description ? descriptionId : undefined}>
```
Store the previously focused element on open; focus the first focusable element or dialog container; trap Tab/Shift+Tab; close on Escape; restore focus on close.

- [ ] **Step 4: Write failing ConfirmDialog destructive-state test**

```tsx
it('prevents duplicate destructive confirmation while pending', async () => {
  const onConfirm = vi.fn();
  render(<ConfirmDialog open title="Hapus?" description="Tidak dapat dibatalkan." confirmLabel="Hapus" tone="danger" loading onConfirm={onConfirm} onOpenChange={() => {}} />);
  expect(screen.getByRole('button', { name: /hapus/i })).toBeDisabled();
});
```

- [ ] **Step 5: Implement Drawer/ConfirmDialog and run tests/build**

Run:
```bash
cd frontend/packages
npm test
npm run build
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/packages/ui
git commit -m "feat: add accessible shared disclosure primitives"
```

---

### Task 4: Add shared filtering, pagination, and responsive table building blocks

**Files:**
- Create: `frontend/packages/ui/FilterBar.tsx`
- Create: `frontend/packages/ui/Pagination.tsx`
- Create: `frontend/packages/ui/Table.tsx`
- Create: `frontend/packages/ui/__tests__/FilterBar.test.tsx`
- Modify: `frontend/packages/ui/index.ts`

**Interfaces:**
- `FilterBar({ search, filters, clearAction? })` — layout only; app owns filter state.
- `Pagination({ page, pageCount, onPageChange, label? })` — explicit page numbers, no hidden fake totals.
- Table exports `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell`, `TableScrollArea`.

- [ ] **Step 1: Write failing FilterBar semantics test**

```tsx
it('keeps search, filters, and clear action in one named region', () => {
  render(<FilterBar aria-label="Filter konten" search={<Input label="Cari" />} filters={<button>Aktif</button>} clearAction={<button>Reset</button>} />);
  const region = screen.getByRole('region', { name: 'Filter konten' });
  expect(region).toContainElement(screen.getByRole('textbox', { name: 'Cari' }));
  expect(region).toContainElement(screen.getByRole('button', { name: 'Reset' }));
});
```

- [ ] **Step 2: Verify RED, implement layout-only primitives, verify GREEN**

Run:
```bash
cd frontend/packages
npm test -- ui/__tests__/FilterBar.test.tsx
npm test
npm run build
```
Expected: first run FAIL; final runs PASS.

- [ ] **Step 3: Commit**

```bash
git add frontend/packages/ui
git commit -m "feat: add shared data workspace primitives"
```

---

### Task 5: Prove the package contract in all four apps without redesigning app workflows yet

**Files:**
- Modify only app imports/styles needed to consume `lajukan-ui/tokens.css` consistently.
- Add/modify lightweight contract tests in the existing app test locations only when necessary.

**Interfaces:**
- All apps consume the same token file and shared exports.
- No route, API, data-fetching, permission, or workflow behavior changes in this task.

- [ ] **Step 1: Build shared package**

Run:
```bash
cd frontend/packages
npm ci
npm test
npm run build
```
Expected: PASS.

- [ ] **Step 2: Verify all consumers compile against new exports**

Run:
```bash
cd frontend/apps/www && npm ci --legacy-peer-deps && npm run lint && npx tsc --noEmit --pretty false
cd ../usaha && npm ci --legacy-peer-deps && npm run lint && npm run typecheck
cd ../cms && npm ci --legacy-peer-deps && npm run lint && npm run typecheck
cd ../crm && npm ci --legacy-peer-deps && npm run lint && npm run typecheck
```
Expected: PASS.

- [ ] **Step 3: Run production builds**

Run:
```bash
cd frontend/apps/www && npm run build
cd ../usaha && npm run build
cd ../cms && npm run build
cd ../crm && npm run build
```
Expected: PASS.

- [ ] **Step 4: Commit consumer compatibility only if needed**

```bash
git add frontend/packages frontend/apps/www frontend/apps/usaha frontend/apps/cms frontend/apps/crm
git commit -m "chore: align apps with shared UI foundation"
```

- [ ] **Step 5: PR gate**

Open one PR from a fresh `feat/ui-foundation-20260907` branch based on current `main`. The PR is mergeable only when shared package tests/build and lint/typecheck/build for all four apps are green and no temporary workflow remains.
