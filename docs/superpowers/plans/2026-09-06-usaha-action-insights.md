# Usaha Action Insights Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Lajukan Usaha Home and Reports derive actionable, permission-safe insights from durable ingredients, finance entries, channels, and existing business state.

**Architecture:** Keep all calculations in the pure `business-control/insights.ts` module. Server pages fetch canonical data through `business-control-server.ts` only when the existing portal permission allows that data, then render actions/read-only summaries without fabricating missing values.

**Tech Stack:** Next.js 16, React 19, TypeScript, Vitest, Rust marketplace APIs already merged in PR #152, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-06-usaha-action-insights-design.md`

## Global Constraints

- Never invent revenue, profit, stock, or platform fee values.
- Use `Asia/Jakarta` for daily finance bucketing.
- Ingredient purchase price/supplier data requires `viewCosting`.
- Finance entries require `viewFinance`.
- Channel settings require `viewChannels`.
- Finished-product inventory remains governed by `viewInventory`.
- No predictive AI, automated purchasing, accounting journal UI, or hard-coded platform fee assumptions.

---

### Task 1: Insight summary contract

**Files:**
- Modify: `frontend/apps/usaha/src/lib/business-control/insights.test.ts`
- Modify: `frontend/apps/usaha/src/lib/business-control/insights.ts`

**Interfaces:**
- Consumes: durable ingredient, finance-entry, and channel records.
- Produces: `summarizeControlCenter(input)` and `jakartaDateKey(date)`.

- [ ] **Step 1: Add failing tests for zero-data, low-stock, daily finance, and channel readiness**
- [ ] **Step 2: Run `npm test -- insights.test.ts` in `frontend/apps/usaha` and confirm the new expectations fail for missing summary fields**
- [ ] **Step 3: Implement only the missing summary fields in `insights.ts`**
- [ ] **Step 4: Re-run the focused test and confirm pass**
- [ ] **Step 5: Commit the pure insight changes**

### Task 2: Permission-safe inventory data

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/inventory/page.tsx`
- Modify: `scripts/ci/check_usaha_business_os_contract.py`

**Interfaces:**
- Consumes: `hasPermission(business, 'viewCosting')`.
- Produces: inventory page that fetches `listControlIngredients` only for costing-authorized roles.

- [ ] **Step 1: Add a static contract assertion requiring `viewCosting` before `listControlIngredients`**
- [ ] **Step 2: Run `python scripts/ci/check_usaha_business_os_contract.py` and confirm it fails against the unsafe page shape**
- [ ] **Step 3: Guard the ingredient fetch and render a non-sensitive stock explanation for other roles**
- [ ] **Step 4: Re-run contract and Usaha typecheck**
- [ ] **Step 5: Commit permission hardening**

### Task 3: Action-oriented Home

**Files:**
- Modify: `frontend/apps/usaha/src/app/page.tsx`
- Modify: `scripts/ci/check_usaha_business_os_contract.py`

**Interfaces:**
- Consumes: `listControlIngredients`, `listFinanceEntries`, `listChannelSettings`, `summarizeControlCenter`, `jakartaDateKey`, existing `BusinessRecord` permissions.
- Produces: Home action queue and real operational stat cards.

- [ ] **Step 1: Extend static contract to require canonical control fetches and `summarizeControlCenter` on Home**
- [ ] **Step 2: Run the contract and confirm failure before Home implementation**
- [ ] **Step 3: Fetch only permitted datasets and derive summary**
- [ ] **Step 4: Add actions for low ingredients, no costing ingredients, no finance entry today, and missing channel configuration**
- [ ] **Step 5: Run contract, focused tests, typecheck, and Next build**
- [ ] **Step 6: Commit Home decision queue**

### Task 4: Real-data Reports

**Files:**
- Modify: `frontend/apps/usaha/src/app/(portal)/businesses/[businessId]/reports/page.tsx`
- Modify: `scripts/ci/check_usaha_business_os_contract.py`

**Interfaces:**
- Consumes: same permission-scoped canonical datasets and insight summary.
- Produces: read-only operational report cards with explicit no-data states.

- [ ] **Step 1: Extend static contract to require real durable data reads on Reports**
- [ ] **Step 2: Run contract and confirm failure before implementation**
- [ ] **Step 3: Add permission-scoped reads and summary values**
- [ ] **Step 4: Replace simulator copy with current-day finance, restock pressure, and channel readiness**
- [ ] **Step 5: Run contract, focused tests, typecheck, Next build, and Docker build through PR CI**
- [ ] **Step 6: Commit Reports changes**

### Task 5: PR verification and merge

**Files:** none beyond CI fixes directly caused by this wave.

**Interfaces:**
- Produces: mergeable PR with Usaha-focused checks green.

- [ ] **Step 1: Open PR against `main`**
- [ ] **Step 2: Verify Usaha Business OS contract, typecheck, Next build, and Usaha Docker image**
- [ ] **Step 3: If a failure is caused by this wave, inspect logs and patch on the same branch**
- [ ] **Step 4: If unrelated global debt fails, record it separately and do not mix it into this PR**
- [ ] **Step 5: Merge only after relevant checks pass**
