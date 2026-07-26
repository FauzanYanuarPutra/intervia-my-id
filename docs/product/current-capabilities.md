# Current Capabilities Matrix

Status: repo audit 2026-07-11. Status means source surfaces exist; it does not guarantee production readiness.

| Domain | Sudah Ada | Sebagian | Belum | Service | API | Database | Frontend | Risiko | Rekomendasi |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Home | Yes |  |  | www/marketplace | `/api/home/trending-searches`, `/api/content` | event/search tables | `/home` | Trending may use fallback if event data thin | Keep event-driven home modules |
| Search | Yes |  |  | www/marketplace/community/Meili | `/api/search`, `/api/content`, `/v1/content`, forum/community search | `content_items`, GIN/trigram, Meili | `/explore` results mode | Taxonomy/index drift | Keep one public Explore entry and one canonical search intent schema |
| Listing | Yes |  |  | marketplace/www | `/api/content`, `/v1/content` | `content_items`, `listings` | `/content/[id]` | Legacy route/canonical mismatch | Keep `/content/[id]` canonical |
| Mencari/Menawarkan |  | Yes |  | www/marketplace | create/content/offers/requests APIs | content metadata, offers/request-related migrations | `/create/[flow]`, `/my-projects` | Flow taxonomy can drift; detailed view/chat analytics are not yet available per owned request | Keep owner-scoped request workspace and show only measured counts |
| Kategori |  | Yes |  | www/marketplace | content/search/create APIs | metadata indexes | home/explore/create | Mixed labels/promotional badges risk | Maintain taxonomy doc |
| Lokasi |  | Yes |  | www/marketplace/super-app | locations, stores, search APIs | lat/lng metadata indexes, tracking tables | explore/umkm/map | Text location vs coordinates can be confused | Only show distance with coordinates |
| Peta |  | Yes |  | www/marketplace | UMKM stores, super-app routing/tracking | UMKM stores, driver/trip tables | `/umkm`, map components | Map data quality depends on seller coordinates | Add location quality indicators |
| Profil usaha | Yes |  |  | marketplace/www/usaha | UMKM store APIs | `umkm_stores` | `/toko/[slug]`, `/usaha/*` | Owner surfaces duplicated | Choose canonical owner surface |
| Katalog | Yes |  |  | marketplace/www/usaha | store products/content | `umkm_products`, `content_items` | toko/usaha/katalog | Product/listing separation can confuse | Document product vs listing |
| Blog |  | Yes |  | www/marketplace | `/api/blog`, `/api/blog/[slug]`, `/v1/content?type=article/news` | `content_items` with blog metadata indexes | `/blog`, `/blog/[slug]` | CMS authoring workflow not fully exposed; static fallback still exists | Treat blog as content pipeline, not a separate table |
| Komunitas | Yes |  |  | community/www | `/api/community`, `/api/forum`, `/v1/community`, `/v1/forum` | forum/groups tables | `/community` | Moderation scope must be explicit | Add moderation checklist |
| Reels | Yes |  |  | community/www | `/api/reels`, `/v1/reels` | reels/comments/actions/events | `/reels` | Listing/profile linkage may be partial; external video URLs must stay browser-playable and rights-safe | Require explicit metadata links and media provenance |
| Chat | Yes |  |  | chat/www | `/api/chat`, `/api/v1/*` | Scylla rooms/messages/unread | `/chat` | WebSocket/presence needs verification | Test E2E chat flows |
| WhatsApp seller |  | Yes |  | www/identity/provider | webhooks, WhatsApp helper | phone/metadata fields | CTAs in UMKM/profile surfaces | Consent/click tracking uncertain | Track CTA and honor consent |
| Notifikasi | Yes |  |  | marketplace/www | notifications APIs, stream | `user_notifications` | `/notifications` | Stream reliability needs runtime test | Add notification E2E checks |
| Autentikasi | Yes |  |  | identity/www | auth APIs | users/sessions/roles | login/register/onboarding | Public copy may conflict Google/password/OTP | Keep auth docs current |
| Media | Yes |  |  | www/community/minio | content/forum/chat media APIs | media stored through app/provider | upload surfaces | Type/size/security review needed | Centralize upload policy |
| Verification |  | Yes |  | identity/ai/www/marketplace | identity verification, face recognition, trust profiles | profile metadata, trust profiles | trust/profile | AI/verification status can be overclaimed | Use tiers and manual review |
| Moderation |  | Yes |  | marketplace/community/crm | report/moderation/support APIs | audit/report/support tables | CRM/support/community | Coverage differs by domain | Create moderation ownership map |
| Analytics |  | Yes |  | marketplace/www | `/api/events`, `/v1/events` | `events.event_log`, AI OS tables | tracked UI varies | Missing events weaken AI | Add funnel event checklist |
| Support | Yes |  |  | marketplace/www/chat | support ticket and support room APIs | support tickets/replies | `/support` | SLA/process not enforced by code alone | Define ops workflow |
| CMS | Yes |  |  | marketplace/cms | sectors/banners APIs | `sectors`, `banners` | `frontend/cms` | CMS scope may be broader in UI than backend | Keep CMS contract explicit |
| CRM |  | Yes |  | marketplace/crm | CRM leads/activities/moderation APIs | `crm_leads`, `crm_activities` | `frontend/crm`, `/crm` | Current CRM is internal/ops-oriented; owner CRM needs workspace/business scoping before public use | Follow `product/crm-strategy.md` and `architecture/crm-architecture.md` |
| Transaksi | Yes |  |  | marketplace/www | transactions/orders APIs | transactions/orders/disputes | `/transactions` | Lifecycle invariants need tests | Add state-machine tests |
| Pembayaran |  | Yes |  | marketplace/www/provider | wallet/topups/Midtrans notify | wallet tables | `/payments` | Sandbox/live and reconciliation risk | Label beta unless verified |
| Refund |  | Yes |  | marketplace/support/wallet | dispute/resolve/support routes | disputes/wallet ledger | refund policy/support | Automated refund not proven | Document support-led refund |
| Escrow |  | Yes |  | marketplace/wallet/transactions | fund/resolve/complete/dispute | transactions/wallet ledger | transactions/payments | Ledger protection semantics need audit | Avoid "guaranteed escrow" wording |

## UI Or Documentation Only / Not Fully Verified

- Full production payment/refund/escrow readiness.
- Chat block/report/rate-limit behavior.
- Exact Meilisearch synchronization guarantees.
- Public SEO rendering quality for all profile/listing pages.
- Consent and analytics coverage for WhatsApp seller clicks.
