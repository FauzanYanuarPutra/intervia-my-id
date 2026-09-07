# Platform Hardening and Usaha Simplification Design

## Goal

Make Lajukan safer to change, easier to operate, and substantially simpler for ordinary Usaha users without weakening the durable costing, stock, finance, channel, settlement, authorization, or audit capabilities already shipped.

## Approved execution order

1. Restore a clean Marketplace quality baseline on the current `main` tree.
2. Resolve security advisories in isolated frontend, Chat/Elixir, and Rust/JWT waves without suppressing findings or forcing unsafe dependency upgrades.
3. Simplify the Usaha experience on top of the hardened baseline.
4. Run full-repository verification and merge only waves with fresh green evidence for their affected scope.

## Marketplace quality baseline

Use one canonical branch based on current `main`. Preserve behavior while addressing current rustfmt/Clippy debt. Prefer mechanical, semantics-preserving rewrites for lint findings. Do not weaken `-D warnings` globally. A narrowly scoped lint allowance is acceptable only when the function boundary is intentionally stable and restructuring it would create unrelated behavioral risk; otherwise prefer a small parameter object or local simplification.

Required evidence before merge:

- `cargo fmt --check`
- `cargo clippy --locked --all-targets -- -D warnings`
- `cargo test --locked`
- relevant Usaha control backend gate
- repository hygiene and runtime contracts affected by the PR

Duplicate/stale Marketplace repair branches are closed after the canonical branch is green.

## Security waves

Security work is split by dependency ecosystem so failures remain attributable.

### Frontend

Use non-forced compatible dependency updates first. Re-run production audit plus lint/test/build for affected apps. Do not use `npm audit fix --force` as a shortcut.

### Chat / Elixir

Upgrade vulnerable direct dependency families deliberately, preserving Phoenix/OTP structure. Require `mix format --check-formatted`, tests, and `mix hex.audit` evidence. Do not suppress advisories merely to obtain a green workflow.

### Rust / JWT

Restore the intended cryptographic backend and regenerate lockfiles with the pinned repository toolchain. Preserve issuer, audience, expiry, and signature verification. Require locked compile/test plus Cargo audit evidence for affected Rust services.

## Usaha UX simplification

The durable backend remains canonical. UX simplification changes what is exposed first, not the underlying accounting or commerce rules.

### Principles

- Mobile-first and action-first.
- One obvious primary action per screen/state.
- Use ordinary Indonesian business language before accounting terminology.
- Progressive disclosure: advanced costing, supplier, margin, settlement, and report details stay available but do not dominate the default view.
- Never fabricate omzet, laba, stock, or readiness when durable data is absent.
- Permission-sensitive data stays hidden from roles that cannot view costing/financial details.
- Empty states teach the next useful action rather than presenting dead dashboards.

### Primary merchant journey

1. Create/select a business.
2. Add the first product.
3. Add ingredients/packaging and purchase prices.
4. Build the first recipe and see HPP.
5. Set a selling price/channel when relevant.
6. Record daily money movement with simple income/expense choices.
7. Reconcile platform settlement only for merchants using delivery channels.
8. Return to Home to see a short prioritized action queue based on durable data.

### Screen hierarchy

- **Beranda:** “yang perlu dilakukan hari ini”, compact health summary, and a single next action.
- **Produk & HPP:** products first; recipe/cost details open progressively.
- **Stok & Belanja:** operational stock first; supplier/cost details permission-gated and secondary.
- **Uang:** simple transaction entry first; settlement and detailed breakdown are secondary workspaces.
- **Kanal Jual:** channel readiness and recommended price first; fee/margin assumptions expandable.
- **Laporan:** answer-first summaries using real data, with explicit no-data states.

## Non-goals

- No replacement accounting ledger or second source of truth.
- No new orchestration platform, broker, or database.
- No broad service rewrite while fixing lint/security debt.
- No fake sample metrics in production views.
- No role-permission relaxation for convenience.

## Definition of done

The program is complete when Marketplace quality gates are clean, security waves have fresh audit/test evidence, the Usaha primary merchant journey is simpler without losing advanced capabilities, duplicate repair branches are closed, and the final `main` state passes the relevant repository-wide quality/security/runtime gates.