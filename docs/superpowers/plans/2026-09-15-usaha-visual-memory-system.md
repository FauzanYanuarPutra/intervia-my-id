# Lajukan Usaha Visual Memory System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lajukan Usaha faster to recognize and navigate by standardizing visual roles, merchant vocabulary, icons, and top-level hierarchy.

**Architecture:** Keep routes and permissions unchanged. Add one visual metadata module consumed by desktop/mobile navigation, extend existing Tailwind/CSS tokens, and simplify Home hierarchy using existing business data.

**Tech Stack:** Next.js 16, React 19, TypeScript 5.9, Tailwind CSS 3.4, Lucide React, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-15-usaha-visual-memory-system-design.md`

## Global Constraints
- Lajukan forest green remains the brand and primary-action color.
- Mobile top-level navigation is `Beranda · Jual · Barang · Uang · Menu`.
- Desktop daily navigation is `Beranda · Jual · Barang · Stok · Uang`.
- Routes and permission checks must remain intact.
- Active state must never depend on color alone.

---

### Task 1: Lock the visual-navigation contract

**Files:**
- Modify: `frontend/apps/usaha/src/components/portal/merchant-ui.contract.test.ts`

- [ ] Add failing expectations for `Barang`, finance in mobile primary navigation, shared visual metadata, canonical security icon, and semantic domain tokens.
- [ ] Push the test-only commit to the feature branch and verify the PR CI fails for the intended missing-contract assertions.

### Task 2: Add semantic visual roles

**Files:**
- Create: `frontend/apps/usaha/src/lib/portal-visual.ts`
- Modify: `frontend/apps/usaha/tailwind.config.ts`
- Modify: `frontend/apps/usaha/src/app/globals.css`

- [ ] Add explicit section visual metadata with stable Lucide icon keys and static Tailwind class strings.
- [ ] Add sale/catalog/stock/money accent and tint tokens.
- [ ] Add shared domain-action and navigation utility classes without removing existing portal primitives.

### Task 3: Make navigation learnable

**Files:**
- Modify: `frontend/apps/usaha/src/lib/portal-navigation.ts`
- Modify: `frontend/apps/usaha/src/components/portal/SidebarNav.tsx`
- Modify: `frontend/apps/usaha/src/components/portal/MobileNav.tsx`

- [ ] Rename `Jualan` to `Jual` and `Produk` to `Barang`.
- [ ] Put finance in the mobile primary order and move inventory to Menu.
- [ ] Use the visual metadata module so desktop/mobile share the same icon and accent semantics.
- [ ] Preserve ARIA current-page state and focus rings.

### Task 4: Strengthen shell and Home hierarchy

**Files:**
- Modify: `frontend/apps/usaha/src/components/portal/PortalShell.tsx`
- Modify: `frontend/apps/usaha/src/app/page.tsx`

- [ ] Strengthen the brand anchor while keeping the 224px desktop shell.
- [ ] Give Jual, expense, and stock quick actions distinct semantic accents.
- [ ] Reduce competing visual weight so the priority/attention block is secondary to the daily action row.
- [ ] Keep permission-aware links exactly as before.

### Task 5: Verify and integrate

- [ ] Run/observe Usaha CI for tests, typecheck, build, and Business OS contract.
- [ ] Review diff for route/permission regressions and accidental unrelated changes.
- [ ] Merge the feature branch into `main` only when checks are green.
- [ ] Confirm the resulting `main` commit and report it.
