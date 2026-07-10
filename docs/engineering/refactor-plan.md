# Refactor Plan

Status: initial plan 2026-07-11. This plan favors small, behavior-preserving slices.

Priority Score = Impact x Confidence / Effort. Scores guide order, but security severity can override.

| ID | Area | Masalah | Bukti | Dampak | Solusi | Risiko | Dependency | Effort | Prioritas | Validasi | Rollback |
| --- | --- | --- | --- | --- | --- | --- | --- | ---: | --- | --- | --- |
| RF-001 | Secrets | Env files contain secret-like values. | `.env.development` 31 sensitive-like lines, `.env.production` 28. | Critical security exposure if real values leaked. | Rotate secrets, add sanitized `.env.example`, keep values out of docs/logs. | Rotation can break integrations if unplanned. | Owner access to providers. | 2 | P0 | Confirm new credentials work in dev/prod. | Restore old credentials only if not compromised and approved. |
| RF-002 | AI upload boundary | `ai_service` upload handler used `unwrap()` after optional multipart parsing. | `services/ai_service/src/main.rs`. | Panic-prone pattern at upload boundary. | Replace with pattern matching while preserving error JSON. | Compile regression if Rust version mismatch. | None. | 1 | P0 | `cargo test` or `cargo check` in `services/ai_service`. | Revert small handler patch. |
| RF-003 | Sensitive logging | OTP/reset/provider logs can expose PII or secrets. | `frontend/www/src/lib/email.ts`, WhatsApp/Fonnte helpers, auth/webhook routes. | High security/privacy risk. | Add masked logger and gate dev-only logs. | May reduce useful debugging if overdone. | Logging policy. | 3 | P0 | Unit test masking helpers; grep for raw OTP logging. | Restore direct logs only in dev. |
| RF-004 | Marketplace backend size | Many domains in one file. | `marketplace_service/src/main.rs` ~19k lines. | Slow review, risky changes. | Add tests, extract modules by domain: content, wallet, transactions, UMKM, CRM. | Large refactor can break routes. | Characterization tests. | 8 | P1 | Route tests/compile after each slice. | Revert one module extraction at a time. |
| RF-005 | Community backend size | Forum/groups/reels in one file. | `community_service/src/main.rs` ~6.7k lines. | Moderation/security harder to audit. | Extract `forum`, `groups`, `reels` modules incrementally. | Route/handler import breakage. | Tests/route map. | 5 | P1 | Compile and API smoke. | Revert per module. |
| RF-006 | Create flow size | Create UI is large. | `CreatePostingClient.tsx` ~8.8k lines. | Regression risk in critical create flow. | Add tests around templates/submission, then split form state, AI assist, preview. | UX regression. | Characterization tests. | 6 | P1 | `npm run test` targeted create tests. | Revert extracted slice. |
| RF-007 | Chat page size/realtime | Chat page is large and realtime-sensitive. | `chat/[id]/page.tsx` ~8.4k lines. | Memory leak/reconnect bugs harder to find. | Split socket lifecycle hook, data fetch, message composer, message list after tests. | Realtime regression. | Chat contract tests. | 6 | P1 | Chat E2E/integration tests. | Revert hook extraction. |
| RF-008 | Search/index drift | Search taxonomy/index lifecycle not fully documented. | Search docs and metadata indexes. | Wrong/hidden/stale results. | Document index schema; add tests for visibility/deleted/private status. | None if docs/tests first. | Meili config access. | 3 | P1 | Search fixtures. | Remove new tests/docs if incorrect. |
| RF-009 | Upload policy drift | Multiple upload routes may validate differently. | content/chat/forum upload routes. | Media security and UX inconsistencies. | Create central upload policy doc, then helper if stable. | Premature abstraction if route needs differ. | Route audit. | 4 | P2 | Route-specific upload tests. | Keep route-local validation. |
| RF-010 | Performance baseline gaps | No measured Web Vitals/API latency. | `docs/performance/baseline.md`. | Optimizations may be guesswork. | Add repeatable local perf smoke script/docs. | Tooling overhead. | Stable dev environment. | 3 | P2 | Baseline command output. | Remove script if noisy. |
| RF-011 | CRM boundary | CRM is currently inside marketplace and ops-oriented, while product direction needs owner CRM plus internal CRM. | `docs/product/crm-strategy.md`, `docs/architecture/crm-architecture.md`, `frontend/crm`, `crm_leads`. | Data leakage or product confusion if owner/internal records are mixed. | Add workspace/business scoping, contacts/tasks/quotes additively; defer `crm_service` split until ADR and tests. | Scope migration mistakes can expose data. | CRM ADR, permission tests, migration backfill plan. | 6 | P1 | Permission tests; CRM API smoke; sample owner/internal workspace fixtures. | Disable owner CRM entrypoint while keeping internal CRM routes. |

## Safe Implementation Slices

1. RF-002: remove panic-prone unwrap in `ai_service` upload handler. Applied on 2026-07-11 and verified with `cargo test` in `services/ai_service`.
2. RF-003 docs-first: define log masking policy before changing all logs.
3. RF-008 docs/tests-first: document search index lifecycle before touching ranking.

## Deferred Until Tests Exist

- Splitting `marketplace_service/src/main.rs`.
- Splitting `CreatePostingClient.tsx`.
- Splitting chat realtime page.
- Changing wallet/payment/escrow semantics.
- Splitting CRM into a standalone `crm_service` before workspace scoping and V1 usage evidence exist.
