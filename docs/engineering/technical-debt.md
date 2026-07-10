# Technical Debt Register

Status: initial register 2026-07-11.

| ID | Area | Debt | Evidence | Risk | Suggested Treatment |
| --- | --- | --- | --- | --- | --- |
| TD-001 | Marketplace backend | Many domains are concentrated in one very large Rust file. | `services/marketplace_service/src/main.rs` ~19k lines. | Hard review, high merge conflict, weak ownership. | Add characterization tests, then extract route modules by stable domain. |
| TD-002 | Community backend | Community/forum/reels logic concentrated in one large Rust file. | `services/community_service/src/main.rs` ~6.7k lines. | Hard moderation/security review. | Extract forum, groups, reels modules incrementally. |
| TD-003 | Frontend UMKM | Large UMKM client components. | `UmkmHubClient.tsx`, `UmkmStorefrontClient.tsx`, `UmkmDiscoveryPanel.tsx`. | Hydration/review complexity. | Extract presentation primitives and data hooks only after tests. |
| TD-004 | Create flow | Create flow component is very large and product-critical. | `CreatePostingClient.tsx` ~8.8k lines. | High regression risk in listing creation. | Add characterization tests for templates and submission before splitting. |
| TD-005 | Chat page | Chat page is large and realtime-sensitive. | `chat/[id]/page.tsx` ~8.4k lines. | WebSocket lifecycle and memory leak risk. | Test membership/message/read behavior, then split socket/data/UI. |
| TD-006 | Logging | Sensitive or noisy console logs exist. | Static console scan in auth/email/WhatsApp/webhook/chat routes. | PII/OTP leakage and noisy production logs. | Introduce safe logger/masking policy incrementally. |
| TD-007 | Taxonomy | Product taxonomy is distributed. | Docs and source show home/search/create/metadata surfaces. | Inconsistent UX/search/index. | Create canonical taxonomy module after auditing consumers. |
| TD-008 | Env config | Secret-bearing env files exist locally. | `.env.development`, `.env.production` sensitive-like line counts. | Secret leakage. | Add sanitized `.env.example`; rotate any exposed real credentials. |
