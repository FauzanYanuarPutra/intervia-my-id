# Merchant Flow and Financial Core Design

## Goal

Make Lajukan feel simple for daily merchants while making financial data harder to damage. The user-facing flow should feel like a fast merchant app: open shift, sell, correct mistakes, close shift, and read only the numbers that matter. The system-facing flow must preserve idempotency, auditability, and recoverability.

## Product Principles

- Drafts may be edited or discarded.
- Posted money, stock, sale, and shift records are never deleted to hide history.
- Mistakes are handled through void, refund, reversal, correction, or replacement.
- The UI uses merchant words: Buka kas, Bayar, Batalkan, Koreksi, Refund, Tutup kas.
- The backend uses canonical commands, immutable journals, ledger lines, allocation movements, and audit events.
- List limits and pagination must not affect balances, KPIs, or reports.

## Parallel Work Lanes

These lanes may be implemented in parallel after an implementation plan assigns exact files and ownership:

1. Daily merchant UI lane
   - Improve Orders/Kasir as the daily command center.
   - Keep POS grid, checkout modal, receipt state, and mobile bottom bar.
   - Make CashShiftWorkspace show expected cash, counted cash, variance, and closing notes more clearly.
   - Add transaction action affordances in the sales list: Koreksi, Batalkan, Refund, and Riwayat.

2. Financial semantics lane
   - Split profit metrics from cash-flow metrics.
   - Stop treating inventory purchase as operating expense in profit reports.
   - Treat inventory purchase as inventory asset movement; COGS is recognized when sold.
   - Make receivable and payable payments affect cash and balance sheet accounts, not revenue or expense.

3. Idempotent command lane
   - Require Idempotency-Key and request_hash for every financial command.
   - Same key plus same hash returns the prior result.
   - Same key plus different hash returns conflict.
   - Reuse the inventory kernel pattern where possible.

4. Correction and audit lane
   - Add correction commands for sale void, sale refund, manual finance correction, and replacement transaction.
   - Every correction stores reason_code, reason, before snapshot, after snapshot, actor, approver when needed, and impact preview.
   - The UI shows Riwayat & Audit in human language.

5. Ledger and balances lane
   - Add canonical account registry and double-entry journal tables.
   - Add journal lines for Cash, Bank, E-Wallet, Platform Clearing, Accounts Receivable, Inventory, Accounts Payable, Revenue, COGS, Expenses, Equity, and Drawings.
   - Add account balance projection rebuildable from journals.
   - Reports read aggregates or projections, not the latest 200 rows.

6. Allocation lane
   - Version allocation policies instead of overwriting the current plan.
   - Track allocation balances through movements, not percentage times current cash.
   - Allocation changes apply to future allocations only.

7. Shift integrity lane
   - Attach cash postings to cash_shift_id when possible.
   - Closing a shift computes expected cash from opening cash plus cash postings.
   - Counted cash and variance are recorded; expected cash is not overwritten to match reality.

## UI Flow

### Start Day

The cashier sees one primary action when no shift is open: Buka kas. The form asks only for opening cash, with optional note hidden under details.

### Sell

The cashier taps products, chooses payment, and confirms. Cash shows tendered amount, presets, and change. Non-cash payments keep the same fast checkout but clearly say the cashier must confirm receipt before finishing.

### After Sale

Success state shows receipt number, payment method, total, change if cash, and Transaksi baru as the main action. Detail receipt, print, and share stay secondary.

### Fix Mistake

The sales history exposes actions as merchant language:

- Batalkan: transaction should not count.
- Refund: money returned after transaction happened.
- Koreksi: wrong product, quantity, method, category, or amount.
- Riwayat: who did what, when, why, and financial or stock impact.

Each action shows an impact preview before confirmation.

### Close Day

The cashier enters counted cash. The system displays opening cash, cash sales, cash in, cash out, refunds, expected cash, counted cash, and variance. A note is required only when variance is non-zero.

## Backend Data Shape

Minimum target tables or equivalents:

- business_finance_commands
- business_journals
- business_journal_lines
- business_account_registry
- business_account_balances
- business_allocation_plan_versions
- business_allocation_movements
- business_audit_events

Existing tables may remain during migration. New write paths should prefer canonical commands and journals while old reads are bridged with projections until the UI no longer depends on legacy summaries.

## Error Handling

- Missing idempotency key: reject for money, stock, sale, shift, correction, refund, and allocation effects.
- Duplicate same request: replay existing response.
- Duplicate different request: reject with idempotency conflict.
- Closed shift correction: require stronger permission or explicit audited reason.
- External payment refund: separate business void from provider refund status.
- Insufficient stock on replacement sale: reject replacement unless policy allows negative stock.

## Testing

Frontend:

- POS checkout still completes a sale.
- Cash shift open/close uses stable idempotency keys.
- Shift close shows variance and requires note when non-zero.
- Correction/refund UI shows preview before submit.
- UI simplification markers remain stable.

Backend:

- Inventory purchase no longer doubles as operating expense in profit metrics.
- COGS affects profit but not same-day cash movement.
- Receivable payment affects cash but not revenue.
- Same idempotency key plus different hash conflicts.
- Void/refund/replacement creates reversal and audit events in one transaction.
- Account balances rebuild from journal lines.

## Rollout

1. Stabilize UI copy and daily merchant flow without changing financial contracts.
2. Fix deterministic frontend summaries that are already wrong or misleading.
3. Add idempotent command primitives and request hashes.
4. Add correction APIs and audit UI.
5. Introduce journal tables and account balances behind read models.
6. Switch reports from list-derived calculations to server aggregates/projections.
7. Migrate allocation plans and balances.
8. Deprecate legacy finance summaries only after parity checks pass.

## Non-Goals

- No raw delete button for posted financial records.
- No Kubernetes, Kafka, or orchestration change.
- No rewrite of unrelated portal navigation.
- No AI agent may move money, change stock, void, refund, or approve corrections.
