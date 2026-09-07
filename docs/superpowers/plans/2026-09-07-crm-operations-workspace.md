# CRM Operations Workspace Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn CRM into a task-oriented operations workspace for leads, conversations, transactions, support, disputes/risk, and user follow-up.

**Architecture:** Split the oversized command center by operational domain. Keep API ownership and mutation boundaries unchanged, move data fetching close to domain workspaces, and make Overview a real work queue rather than a KPI wall.

**Tech Stack:** Next.js 16, React 19, TypeScript, lajukan-ui.

**Spec:** `docs/superpowers/specs/2026-09-07-frontend-experience-redesign-design.md`

## Global Constraints

- Desktop-first but safe on tablet/small screens.
- No demo production data; `CRM_DEMO_DATA_ENABLED` remains false or is removed if unnecessary.
- Permission/risk mutations must stay behind existing API/auth contracts.
- Task queues outrank analytics visually.
- Customer 360 must only aggregate data already authorized through existing APIs.

---

### Task 1: Extract CRM navigation/domain contracts

**Files:**
- Create: `frontend/apps/crm/src/components/crm/types.ts`
- Create: `frontend/apps/crm/src/components/crm/navigation.ts`
- Test: `navigation.test.ts`
- Modify `CrmCommandCenter.tsx` after RED/GREEN.

**Interfaces:**
```ts
export type CrmWorkspaceId = 'overview' | 'pipeline' | 'contacts' | 'conversations' | 'transactions' | 'support' | 'risk' | 'listings' | 'analytics' | 'administration';
export type CrmNavItem = { id: CrmWorkspaceId; label: string; hint: string };
```

- [ ] Write failing nav contract test for operational naming/order.
- [ ] Implement extracted nav model.
- [ ] Run lint/typecheck.
- [ ] Commit `refactor: extract CRM workspace contracts`.

### Task 2: Operations Overview priority engine

**Files:**
- Create: `components/crm/operationsPriority.ts`
- Create: `components/crm/OperationsOverview.tsx`
- Test: `operationsPriority.test.ts`

**Interfaces:**
```ts
export type OperationsTask = { id: string; kind: 'lead' | 'conversation' | 'kyc' | 'dispute' | 'transaction' | 'support'; priority: number; title: string; href?: string };
export function rankOperationsTasks(tasks: OperationsTask[]): OperationsTask[];
```

- [ ] Write RED tests that urgent dispute/risk and overdue follow-up order ahead of passive analytics.
- [ ] Implement stable priority ordering.
- [ ] Build Overview from real loaded data only.
- [ ] Run tests/build.
- [ ] Commit `feat: make CRM overview action oriented`.

### Task 3: Pipeline workspace

**Files:**
- Create: `PipelineWorkspace.tsx`
- Move current lead pipeline logic from command center.
- Test stage transitions and pending state.

- [ ] Write failing transition test.
- [ ] Keep mutation through existing `leadApi`.
- [ ] Add filters/search using shared FilterBar.
- [ ] Run tests/build.
- [ ] Commit `feat: extract CRM pipeline workspace`.

### Task 4: Contact/User workspace and Customer 360

**Files:**
- Create: `ContactWorkspace.tsx`
- Create: `ContactDetail.tsx`
- Create: `contact360.ts`
- Test aggregation from already available authorized records.

**Interfaces:**
```ts
export function buildContact360(input: AuthorizedContactSources): Contact360Model;
```

- [ ] Write RED test that missing source data remains absent rather than synthesized.
- [ ] Aggregate identity, listings, orders, conversations, support, trust/risk, recent activity where present.
- [ ] Do not add new cross-service fetch shortcuts.
- [ ] Run tests/build.
- [ ] Commit `feat: add authorized CRM contact 360 view`.

### Task 5: Conversations and Support workspaces

**Files:**
- Create: `ConversationWorkspace.tsx`
- Create: `SupportWorkspace.tsx`
- Test unread/urgent ordering and partial API failure state.

- [ ] Write failing tests distinguishing empty collection from failed collection.
- [ ] Move existing chat/support logic.
- [ ] Expose retry only for failed source.
- [ ] Run tests/build.
- [ ] Commit `feat: extract CRM conversation and support queues`.

### Task 6: Transactions and Risk/Disputes workspaces

**Files:**
- Create: `TransactionWorkspace.tsx`
- Create: `RiskWorkspace.tsx`
- Test mutation permission and confirmation.

- [ ] Write RED test proving risk/hold mutation controls are absent for unauthorized state if role capability exists in current auth model.
- [ ] Use ConfirmDialog for consequential actions.
- [ ] Keep raw risk diagnostics secondary to required operator action.
- [ ] Run tests/build.
- [ ] Commit `feat: extract CRM transaction and risk workspaces`.

### Task 7: Analytics and Administration secondary workspaces

**Files:**
- Create: `AnalyticsWorkspace.tsx`
- Create: `AdministrationWorkspace.tsx`

- [ ] Move existing analytics/settings code without promoting them over operational work.
- [ ] Remove duplicated KPI calculations that conflict with existing authoritative data.
- [ ] Run lint/typecheck/build.
- [ ] Commit `refactor: isolate CRM analytics and administration`.

### Task 8: Remove giant command-center responsibilities

**Files:**
- Rewrite: `CrmCommandCenter.tsx`

- [ ] Reduce shell responsibility to auth, navigation, common load boundary, and workspace routing/composition.
- [ ] Ensure domain mutations/fetch logic no longer live in shell where extraction is complete.
- [ ] Verify no sample collections are shown in production.
- [ ] Run full CRM lint/typecheck/build.
- [ ] Commit `refactor: simplify CRM command center shell`.

### Task 9: CRM final gate

- [ ] Verify Overview queue, Pipeline, Contacts, Conversations, Transactions, Support, Risk, Analytics, Administration.
- [ ] Verify partial-failure behavior.
- [ ] Verify tablet/small-screen controls remain reachable.
- [ ] Run lint/typecheck/build and relevant tests.
- [ ] Open PR `feat/crm-operations-workspace-20260907`; merge only on fresh normal frontend gates.
