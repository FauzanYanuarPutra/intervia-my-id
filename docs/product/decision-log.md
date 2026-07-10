# Decision Log

Status: repo audit 2026-07-11.

Use this file for approved product/architecture decisions. Do not record unapproved ideas as decisions.

## 2026-07-11: Documentation Source Of Truth

- Decision: Root `AGENTS.md` and `docs/*` become the agent/engineering knowledge base.
- Evidence: User requested documentation-only audit; repo has multiple services and older docs.
- Consequence: Future product changes should update relevant docs when meaning changes.

## 2026-07-11: Do Not Treat Community/Reels As Transaction Categories

- Decision: Community and reels are engagement/distribution layers.
- Evidence: Code places them in `community_service` with forum/reel/group schemas and public routes, not marketplace category tables.
- Consequence: Navigation can promote them, but category taxonomy should not put them beside Mesin & Alat/Bahan Usaha as direct transaction needs.

## 2026-07-11: Chat And WhatsApp Stay Separate

- Decision: Internal chat and WhatsApp must be audited and maintained as separate channels.
- Evidence: Chat service has dedicated room/message APIs; WhatsApp helper/webhook/contact links exist separately.
- Consequence: Removing either channel needs explicit product approval.

## Pending Decisions

- Canonical owner surface: `frontend/usaha` vs `/usaha/*` in `frontend/www`.
- Public wording for payments/escrow/refunds until E2E production verification.
- Canonical taxonomy registry location.
- Required moderation coverage for community/reels/listings/chat.

## 2026-07-11: Refactor Must Be Plan-First And Evidence-Based

- Decision: Structural refactor work starts from `docs/engineering/refactor-plan.md`, `docs/security/security-review.md`, and `docs/performance/baseline.md`.
- Evidence: Repository has a large dirty worktree and several very large product-critical files.
- Consequence: Large module splits, search pipeline changes, payment semantics, and chat storage changes require tests/ADR before implementation.

## 2026-07-11: CRM Evolves Additively Before Service Split

- Decision: Current CRM remains in marketplace service near-term while the product evolves toward owner CRM plus internal CRM workspaces.
- Evidence: `frontend/crm`, WWW `/api/crm/*` routes, marketplace `/v1/crm/*` routes, and `crm_leads`/`crm_activities` already exist. Product input requires a simple UMKM-facing CRM, not a heavy corporate CRM.
- Consequence: Build contacts, tasks, quotes, workspace/business scoping, and owner-friendly UI additively first. A standalone `crm_service` requires a later ADR and migration plan.

## 2026-07-11: CRM Priority Clarified To Internal Lajukan Match

- Decision: The next CRM direction is internal Lajukan operations around `Pencari -> Kebutuhan -> Penyedia sesuai -> Terhubung -> Berhasil/Gagal`, with `Lajukan Match` as the core matching workflow. Seller-owned CRM/pipeline features are deferred until the internal matching and connection lifecycle is proven.
- Evidence: Latest product instruction explicitly rejects a traditional seller CRM as the next priority. Repository evidence shows current CRM is already internal/ops-oriented (`frontend/crm`, marketplace `/v1/crm/*`, `crm_leads`, `crm_activities`) and marketplace already has request/listing primitives that can be reused for needs and providers.
- Consequence: New CRM work should add requirement review, AI extraction, candidate matching, admin approval, connection tracking, feedback, analytics, and audit logs. Passive search/view/click signals should stay analytics unless an explicit high-intent action creates a reviewed requirement or connection.

## 2026-07-11: Cluster-First Product Strategy

- Decision: Lajukan should prioritize a dense regional business-needs cluster before broad national marketplace expansion.
- Evidence: Product input emphasizes Indonesia's geography, local trust, WhatsApp behavior, and serviceability needs for machines, tools, materials, services, and places. Existing product docs already identify search, location, WhatsApp, trust, and `Mencari/Menawarkan` as core product primitives.
- Consequence: New discovery, ranking, onboarding, and analytics work should improve regional supply-demand density first. `Usaha Sekitar` should be treated as a location capability across categories, and `Mencari` demand data should be treated as a first-class asset for matching and supplier acquisition.
