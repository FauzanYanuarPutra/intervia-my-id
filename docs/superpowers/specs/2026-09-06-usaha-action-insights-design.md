# Usaha Action Insights Design

## Purpose
Turn the Lajukan Usaha home and reports surfaces into a decision-oriented control center backed only by canonical business data. The feature must tell a merchant what needs attention now without inventing revenue, profit, stock, or platform assumptions.

## Scope
This wave covers three tightly related concerns:

1. derive safe operational insights from durable ingredients, finance entries, channels, and existing finished-product state;
2. surface those insights on Home and Reports with direct actions;
3. close the permission gap so cashier/viewer roles never fetch or render supplier prices, HPP inputs, or finance/channel data they are not allowed to see.

CI debt outside the Usaha feature is intentionally handled in separate follow-up waves.

## Architecture

### Pure insight layer
`frontend/apps/usaha/src/lib/business-control/insights.ts` is the only place that turns raw control-center records into summary signals. It remains side-effect free and accepts plain serializable values so it can be unit tested without server mocks.

The summary exposes:
- ingredients at/below configured minimum stock;
- count and operating/cash summary for today's finance entries;
- configured and enabled channel counts;
- enough state for Home/Reports to derive actionable empty states without duplicating calculations.

Date bucketing uses `Asia/Jakarta` because the Usaha workspace is operated in Indonesia and daily finance actions must not shift at UTC midnight.

### Server data boundary
Server pages continue to use `business-control-server.ts` to fetch canonical Marketplace data. Pages must guard each fetch with existing permissions before making the request.

Sensitive control data is restricted as follows:
- ingredients with purchase price/supplier details: `viewCosting` only;
- finance entries: `viewFinance` only;
- channel settings: `viewChannels` only;
- finished-product inventory remains visible according to `viewInventory`.

This prevents UI/backend permission mismatches and avoids exposing costing data to cashier/viewer roles.

### Home action queue
The Home page combines existing setup/order/finished-product signals with the pure control-center summary. Priority actions include:
- low ingredient stock -> inventory;
- products exist but no costing ingredients -> HPP setup;
- no finance entry today -> finance entry flow, only for finance-authorized roles;
- no configured/enabled channel -> channel setup, only for channel-authorized roles.

The page must not label absence of data as failure. Empty states should explain the next useful action.

### Reports
Reports becomes a read-only business summary rather than a set of explanatory cards. It should show real values only when source data exists and otherwise show explicit “belum ada data” guidance.

Reports may summarize:
- today's revenue/operating movement from finance entries;
- ingredient restock pressure;
- channel readiness;
- links to HPP, Finance, Inventory, and Channels for remediation.

It must not synthesize historical P&L beyond the data returned by the current durable endpoints.

## Error handling
Server pages should fail closed for sensitive data. A user without the relevant permission does not trigger the upstream control request. Existing application-level error boundaries remain responsible for genuine upstream failures; the feature does not silently replace failed canonical reads with fake values.

## Testing
- unit tests for `summarizeControlCenter` and Jakarta date boundaries;
- permission regression contract proving inventory does not fetch cost details for roles without `viewCosting`;
- Usaha typecheck;
- Usaha Next production build;
- Usaha Docker runtime build;
- existing Business OS static contract.

## Non-goals
- predictive AI recommendations;
- automated purchases;
- accounting journal/debit-credit UI;
- hard-coded GoFood/GrabFood/ShopeeFood fees;
- fixing unrelated global frontend/Rust/Elixir CI debt in this PR.
