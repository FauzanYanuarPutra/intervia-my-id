# Decision Log

Status: repo audit 2026-07-11.

Use this file for approved product/architecture decisions. Do not record unapproved ideas as decisions.

## 2026-08-10: Runtime And Database Bootstrap Are Seed-Free

- Decision: Local/runtime startup and fresh database migration replay must finish without fictional accounts, demo listings, sample catalogs, community/reel examples, or open-reference seed rows. Additive cleanup migrations remove historical seed records; production-like runtime surfaces remain truthfully empty until genuine data is created. Test-only fixtures may remain isolated behind the test runner.
- Evidence: Seed data had accumulated across identity, marketplace, community, WWW runtime state, Usaha portal state, and CRM sample fallbacks. The approved reset removed 11 identity users, 36,584 marketplace content/reference rows, 10 seeded stores, 51 legacy listings, 6 seeded catalog parents, 22 community users, 17 threads, and 18 reels from the active local databases.
- Consequence: Structural RBAC roles/permissions, marketplace taxonomy, matching weights, and the public `c-fyp` category remain because they are required configuration rather than demo content. Public-reference imports are explicit data operations, not automatic bootstrap data. New demo data must use isolated test fixtures and must not appear in normal development or runtime builds.

## 2026-07-28: Regular WWW Pages Share One Layout Shell And Footer Owner

- Decision: Non-immersive WWW pages use a 1280 px canonical content shell, with explicit 920 px readable, 1180 px form, and 1440 px wide variants only when the page purpose requires them. The global layout wrapper is the sole owner of the site footer.
- Evidence: Home rendered its footer inside a narrow desktop feed column, Community placed it after a clipped full-height shell, and shared CSS mixed 1120, 1180, 1240, 1440, 1560, and 1700 px width rules.
- Consequence: Header, page content, and footer align to shared gutters; regular pages expose one reachable footer; immersive chat, reels, and map-like surfaces remain deliberate exceptions. New routes should use semantic shell variants and pass responsive overflow/footer tests.

## 2026-07-28: Manage Is The Canonical Cross-Content Studio

- Decision: `/manage` is the canonical owner entry point for managing published content across Listing, Community, and Reels. Each channel keeps its existing dedicated editor, while Profile, account navigation, and the footer expose one shared Studio Konten entry point.
- Evidence: Profile previously emphasized only listing management, and `/manage` presented content and operational tools as a flat grid. Existing `/my-listings`, `/manage/community`, and `/manage/reels` routes already provide the correct domain-specific workflows.
- Consequence: The manage hub uses scan-first channel previews, channel-specific visual identity, live owner counts, and a separate operational section. New owner content types should extend this hub instead of adding another competing dashboard, and protected owner data must remain filtered by the authenticated identity.

## 2026-07-28: Public Listing Discovery Uses One Scan-First Card

- Decision: Public supply listings use one canonical visual order—media, offer/type, title, price or value, then owner and location—across Home recommendations and Explore results. Demand cards prioritize budget, location, and deadline. The content detail page follows the same intent and value hierarchy before progressively revealing supporting information.
- Evidence: Home recommendations, unfiltered Explore cards, and filtered product/service results previously used different proportions and fact density, so the same listing changed shape while users browsed. Home also linked a supply-listing rail to the broader UMKM surface.
- Consequence: Discovery surfaces adapt their data into `ExploreListingCard` instead of creating another listing-card variant. Public cards stay comparison-focused and omit duplicated summaries or CTA labels; owner-management cards may retain status and editing controls. Business results use the canonical `/toko/[slug]` storefront route.

## 2026-07-28: Public UMKM Flows From Discovery To One Storefront

- Decision: `/umkm` remains the immersive public business directory and `/toko/[slug]` remains the canonical public business detail. Business cards use a shared scan order—visual and category, business name, truthful operating state, then city or viewer-backed distance—while the storefront groups identity, products, location, and one dominant contact action. Owner controls remain under `/usaha`.
- Evidence: Home, Explore/Search, the UMKM map, and the storefront used different card proportions, labels, width rules, and meanings for status. Missing opening hours could appear as open, zero ratings looked like real reviews, and several entry points called the same storefront “Profil”, “Info”, or “Toko”.
- Consequence: Public entry points link to `/toko/[slug]`, unknown hours, ratings, coordinates, or contact data stay visibly unknown instead of becoming positive claims, and related UMKM surfaces reuse the canonical shell, vocabulary, and business-card hierarchy without duplicating owner workflows.

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
- External legal review for payment, escrow, refund, and dispute wording.
- Canonical taxonomy registry location.
- Required moderation coverage for community/reels/listings/chat.

## 2026-07-30: Public Reference Data Is Not A Seller Listing

- Decision: Licensed public/open-data seed records are rendered as non-transactional references with their original source, usage license, and media attribution. They must not show seller, price, stock, verification, chat, or transaction actions. Fictional Indonesia demo profiles are archived from identity and discovery read models instead of being presented as active users.
- Evidence: The active local marketplace dataset contains sourced public references marked `is_transactional=false`, while the older `indonesia_demo_20260709` identities remained discoverable after their listings, threads, and reels were archived.
- Consequence: Home may use public references to provide real, attributable context when live offers are unavailable, but transactional recommendation and latest-needs modules remain empty until genuine users publish them. Public references stay owned by the system curator; a personal account can curate or copy them only after a verified account exists and without changing source provenance.

## 2026-07-27: Public Content Uses Scan-First Visual Hierarchy

- Decision: Content-heavy public surfaces use a scan-first hierarchy: a clear title and intent/status badge, a short summary, grouped facts with meaningful icons or semantic color, bounded reading width, progressive disclosure for long copy, and one visually dominant next action. Color distinguishes content type, intent, status, or action; it is not decorative noise.
- Evidence: Product input identified flat, visually undifferentiated pages as tiring to read. The canonical `/content/[id]` surface contains mixed media, identity, transaction intent, specifications, location, trust, and long descriptions that require chunking before users can compare or act.
- Consequence: `/content/[id]` is the reference implementation. Home, Explore, public profiles, UMKM discovery, Community, learning, legal/help content, and future public pages should reuse the shared surface and semantic color tokens. Do not give every card a different arbitrary color. Validate the pattern through readability/responsive QA and measured events such as content views, detail expansion, contact/chat starts, and completion of the intended page action.

## 2026-07-27: Long Forms Use Dedicated Pages

- Decision: Multi-section forms, forms with several permissions/rules, and edit flows with media uploads use dedicated routes instead of modal overlays. Modals remain for confirmations, short prompts, previews, compact filters, and other reversible contextual actions.
- Evidence: Group creation and group settings combined identity, media, privacy, membership, posting permissions, and dynamic rules inside scroll-constrained overlays. Profile quick edit duplicated the canonical full profile editor.
- Consequence: Community group creation uses `/community/groups/new`, group settings use `/community/groups/[slug]/settings`, and profile edit triggers use the existing `/profile/edit` route. New long-form flows should extend a canonical page rather than introducing another modal form.

## 2026-07-27: Public Discovery Must Be Readable Before Login

- Decision: Community feeds, community group detail, reels, public profiles, active listing detail, and UMKM discovery are public read surfaces. Authentication is required for write actions such as posting, following, reacting, joining, chatting, or publishing.
- Evidence: These surfaces already expose public metadata and public GET contracts, while route configuration incorrectly marked Community and Reels as authenticated. The public audit also found profile and UMKM HTML dominated by loading states.
- Consequence: Route configuration marks Community and Reels as shared/public, client actions retain their existing login gates, and primary profile/listing/UMKM content receives server-rendered initial data where available.

## 2026-07-27: Inactive Listings Are Not Public Pages

- Decision: Only active listings are readable and indexable on `/content/[id]`. Draft, archived, rejected, or otherwise inactive content returns the same public not-found behavior unless requested by its authenticated owner through an owner workflow.
- Evidence: Marketplace detail previously returned any content status and the client detail page converted backend 404 into a visual `Content not found` message inside an HTTP 200 page.
- Consequence: Marketplace service enforces active-or-owner access, the public detail page validates data on the server and calls `notFound()`, metadata is `noindex` for unavailable content, and the active-only sitemap query remains canonical.

## 2026-07-27: Payment Claims Require Explicit Runtime Status

- Decision: Public legal and trust copy must not imply that Lajukan payment, escrow, mediation, refund, or binding dispute decisions are generally active. Those capabilities apply only when the relevant transaction explicitly marks them active.
- Evidence: Public footer/about copy described secure payment as gradual, while Terms and Trust Center used unconditional escrow and platform-decision language.
- Consequence: Legal copy states the current discovery/listing/chat role, labels payment material as readiness standards, and directs users to verify transaction-level status before paying.

## 2026-07-23: Create Starts Brief-First

- Decision: `/create` opens the brief-first simple create flow for new posts. The longer draft wizard remains for existing draft continuation and detail routes.
- Evidence: Product input identified the long create form as a major friction point; existing product principles already require publishing a need or offer without complex forms.
- Consequence: New create sessions should ask only for required fields first, keep optional detail collapsed, and avoid making exact map pins or supporting documents feel mandatory unless backend publish policy requires them.

## 2026-07-23: Create Layout Stays Focused

- Decision: Create pages should not show the old multi-section desktop sidebar (`Mulai`, `Usaha`, `Kelola`) or expose all 9 schema steps as the primary progress UI. The visible create progress is three phases: choose, fill, review.
- Evidence: Product input found the sidebar and 9-step progress overwhelming, especially around the `Jenis` step.
- Consequence: Keep create focused on the active task. Subcategory remains the required taxonomy choice; industry is optional in the UI and uses a backend-compatible fallback when omitted.

## 2026-07-23: Visible Seed Data Uses Real Public Indonesia Sources

- Decision: New visible seed data must prefer real Indonesia open/public references and free/public media. Fictional seller-like demo rows should be hidden from primary discovery when a real seed pack is available.
- Evidence: Product input explicitly requested real Indonesian seed data with free web images/videos and no fake business data.
- Consequence: Seed rows must store source/license/provenance metadata, avoid private phone/WhatsApp data unless consent is explicit, and label reference-only rows as non-transactional.
- Implementation note: Bulk provider imports may use OpenStreetMap/Overpass or Geofabrik OSM extracts with ODbL attribution. Bulk buyer imports may use public RUP/SiRUP references as `request` rows, but they remain source-only demand references and must not create CRM leads or auto-connections.
- Image note: Google images must not be scraped. Provider photo enrichment may use Google Places API only when an API key is configured, store `place_id`/proxy references instead of raw photo names or downloaded files, and display Google Maps attribution.

## 2026-07-30: Bulk Open Data Is A Separate Reference Catalog

- Decision: Large discovery imports from OpenStreetMap are stored as non-transactional public references, never as seller offers, buyer needs, verified businesses, or user-owned inventory.
- Evidence: Product input requested at least 10,000 real records. OpenStreetMap provides named Indonesia business/location POIs under ODbL, while the source does not prove current activity, ownership, stock, pricing, contact consent, or Lajukan verification.
- Consequence: Imports must be idempotent by source/external ID, retain element URLs and ODbL attribution, omit phone/email/contact fields, and keep price, rating, review, stock, and verification claims empty. Explore exposes a distinct `Referensi` filter and excludes these rows from offer/need counts, cart, and like actions. User-created demand remains separate and cannot be manufactured from map data.
- Quality floor: Numeric targets are an upper bound, not permission to pad the catalog. Generic names, common consumer-retail chains, inactive lifecycle tags, unsupported shop types, or records carrying private-contact patterns are rejected or policy-archived even when that leaves fewer rows than requested.
- Media and map presentation: Imported references use a neutral no-photo state until an exact, reuse-compatible source image has passed relationship and license checks and has been copied into Lajukan MinIO. A category illustration must not be presented as the photo of a specific business. UMKM Map may include reference coordinates only through the opt-in `include_references` discovery layer, with `Referensi publik` labeling, no store/order/contact claims, and a link to the source-backed content detail. Owner, transaction, and default store APIs remain reference-free.

## 2026-07-30: Public Reference Photos Require Exact Evidence And Rehosted Provenance

- Decision: Automatic media enrichment is limited to either an exact OSM `wikimedia_commons=File:*` link on the same source element or a versioned curator manifest that binds one stable source identifier (for OSM, `node|way|relation/id`) to one exact Commons file and explicitly records the match context. Commons categories and Wikidata P18 remain review-only inputs and do not independently authorize publication. Every accepted file must have an allowed CC0, Public Domain, CC BY, or CC BY-SA license. Google, social media, marketplaces, arbitrary websites, unknown licenses, NC, ND, and fair-use files are not downloaded into MinIO.
- Evidence: The first 10,000 OSM references had no direct Commons file links; their few P18 candidates often represented a global headquarters, logo, or different branch. Repeating category illustrations made unrelated businesses look as if they shared the same real photo, while a mutable provider label or source URL alone could not prove that a contextual image had been reviewed for the referenced subject.
- Consequence: Approved files are downloaded through an allowlisted, size/MIME/signature-checked pipeline, deduplicated by SHA-256, stored under immutable MinIO keys, and rendered only through the controlled content-media proxy. Provider URLs remain provenance rather than hotlinked display sources. Author, Commons source page, normalized license name and URL, match method, manifest version, reviewer, and review evidence remain auditable in asset/link metadata. Unmatched references display an explicit no-licensed-photo state rather than a random image.

## 2026-07-26: Owned Project Workspaces Must Not Use Synthetic Activity

- Decision: `/my-projects` only loads request posts owned by the authenticated user. Runtime demo requests and deterministic view/profile/chat/readiness calculations are not valid fallbacks.
- Evidence: The previous client used `LAJUKAN_SAMPLE_REQUESTS` whenever the request API had not returned data and generated activity values from a string seed. The marketplace request endpoint also returned all active requests without an owner filter.
- Consequence: The BFF forwards the access token, requests use `mine=true`, marketplace filtering is enforced by authenticated `owner_id`, public mode omits offer details, and the UI uses explicit loading/error/empty states. Only persisted request, status, and offer counts may appear until measured event aggregates are implemented.

## 2026-07-19: Explore Is The Single Public Discovery Surface

- Decision: `/explore` is the only public destination for browsing and searching. With no result parameters it shows category discovery; with a query or filter it renders the shared search results experience. The earlier Search/Explore presentation split is superseded.
- Evidence: Product review found that two adjacent destinations with overlapping categories, filters, and results increased navigation and terminology overhead for Indonesian users.
- Consequence: Public links, navigation, SEO search actions, and legacy route mappings target `/explore`. `/search` remains only as a permanent compatibility redirect that preserves query parameters. `/api/search` and the shared search data/components remain the canonical backend and implementation primitives.

## 2026-07-17: Blog Uses Marketplace Content Pipeline

- Decision: Public blog pages use `content_items` with `content_type` `article` or `news` as the backend/database source, with static SEO articles kept only as fallback.
- Evidence: The marketplace schema already allows `article` and `news`, `/v1/content` already supports type/status filtering, and the public `/blog` routes already existed with static localized article data.
- Consequence: Do not create a duplicate blog table/service yet. Blog authoring should feed marketplace content metadata, while WWW exposes `/api/blog` and `/api/blog/[slug]` as the public BFF contract.

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

## 2026-07-12: Personal AI Evolves Into Configurable AI Mini-App Builder

- Decision: `/profile/ai` is the canonical MVP surface for user-created AI mini-apps. Creators can configure steps, input fields, hidden instructions, quick actions, output sections, model policy, media support, and visibility without custom code.
- Evidence: Product input asks for a Lajukan-native version of a wizard prompt generator where users can create private or public tools. Existing `personal_ai_agents.builder_config` already stores declarative JSON configuration and Personal AI already supports media, model routing, and private owner data.
- Consequence: Keep the builder declarative and component-based for security. Visibility starts as `private`, `unlisted`, and `public`; public discovery/profile surfacing can be added later on top of the same canonical builder instead of creating a duplicate AI Tools flow.

## 2026-07-13: Supply-First Marketplace Entry Points

- Decision: Home, search, and simple create should default to `Bahan & Supplier` first, then `Jasa`, then `Mesin & Alat`, then `Tempat Usaha`. Machines/tools stay a core category but should be positioned as a technical/production need, not the default first mental model.
- Evidence: Product input challenged the over-focus on machines/tools and asked to inspect available supply first. Local marketplace `content_items` on 2026-07-13 showed active `supplies` listings/requests ahead of `equipment` in `metadata.create_category` (`supplies`: 6 active, `equipment`: 4 active) and active supply side (`supplies`: 5, `equipment`: 3).
- Consequence: Category registries and UI surfaces should be supply-chain-first by default. Regional campaigns can override ranking only with explicit demand/supply evidence.

## 2026-07-13: Five-Category Marketplace Taxonomy

- Decision: Marketplace search/create uses five transaction categories with canonical slugs: `materials-suppliers`, `services`, `machines-tools`, `business-places`, and `business-opportunities`.
- Evidence: Product instruction required separating marketplace taxonomy from community/video/profile/chat modules and distinguishing category, subcategory, industry, listing type, and filters. Existing code already had partial legacy IDs (`supplies`, `service`, `equipment`, `property`, `opportunity`) and `Usaha Sekitar` as a location capability.
- Consequence: Legacy IDs remain as aliases, `Usaha Sekitar` stays outside transaction taxonomy, and normalized taxonomy tables/backfills become the source for category, subcategory, industry, filter, and suggestion APIs.

## 2026-07-13: Draft-First Schema-Driven Create Flow

- Decision: Listing creation uses a 9-step draft-first wizard backed by the canonical marketplace taxonomy and intent-specific schemas for `offer` and `request`.
- Evidence: Product instruction required a full create-flow redesign, not a cosmetic patch, with temporary local drafts from the first step, server drafts after category/subcategory/industry selection, autosave, media, location, contact, and review/publish.
- Consequence: Create and edit should share the same schema definitions over time. Draft lifecycle fields live additively on `content_items`; public discovery should continue to use published/active listings, while incomplete drafts remain private to their owner.

## 2026-07-14: Profile AI Uses One Owner-Scoped Creation Draft Bridge

- Decision: Profile AI creates structured `creation_drafts` and hands only a random draft ID to canonical create flows. Phase 1 supports offers, requests, and business profiles; AI never publishes automatically.
- Evidence: Product instruction requires a universal AI Creation Hub, secure media reuse, preview cards, field confidence, and draft-first continuation. Existing Profile AI, private media upload, listing autosave, and business onboarding can be extended without duplicating those surfaces.
- Consequence: `marketplace_service` owns creation draft lifecycle and version history. WWW remains the authenticated BFF and adapter layer. Plain location text must still be confirmed through structured location autocomplete, publish endpoints retain final validation, and later community/reel adapters must reuse this draft contract instead of creating separate AI draft stores.

## 2026-07-14: Category Explore Reuses Canonical Search

- Decision: `/explore/[category]` remains the contextual and indexable category URL used by home, but its results, cards, grid, filters, pagination, and URL state are rendered by the canonical search client.
- Evidence: Product input identified inconsistent cards and grids between category explore and `/search`, while the repository had two independent result-fetching clients for the same marketplace data.
- Consequence: Category and subcategory are first-class search parameters. Home, explore, search, and create reuse the same canonical category slugs and taxonomy fallback; new category result behavior must be implemented in search rather than duplicated under explore.

## 2026-07-14: Search Utility And Explore Destination Split

- Decision: The latest approved direction supersedes the presentation model above. Global Search is a multi-source utility with semantic result tabs, while `/explore` and `/explore/[category]` are indexable navigation destinations with category-specific sections, guides, and discovery context. Both surfaces continue sharing the canonical taxonomy, normalized API adapters, and result-card primitives.
- Evidence: Product instruction explicitly separates searching for a known need from browsing categories, while requiring consistent data, filters, cards, URLs, desktop navigation, and mobile navigation across both journeys.
- Consequence: Search is omitted from primary navigation and marked `noindex, follow`; Explore owns category navigation and canonical category URLs. Community and Video may appear as Explore channels, but remain engagement/distribution modules rather than marketplace transaction categories. Legacy category/search URLs must redirect or migrate their parameters without breaking saved links.

## 2026-07-14: Profile AI Uses Guided Creation Before Draft Generation

- Decision: Offer, request, and business-profile actions in `/profile/ai` start an owner-scoped guided creation state. Profile AI collects target-specific labeled facts across messages and creates an `AICreationCard` only after the minimum factual fields are present.
- Evidence: Product input rejected draft cards generated from a generic intent sentence and requested chat-native form collection, contextual AI behavior, reply, reactions, and forwarding. The existing Personal AI message metadata and creation-draft bridge can support this without adding a duplicate creation flow.
- Consequence: Generic creation intent remains `collecting`; partial answers and media survive reloads; cancellation prevents draft creation. Reply and forwarded-message context is included in AI history, while reactions remain interaction metadata. AI still cannot publish automatically or invent missing business facts.

## 2026-08-01: UMKM Map Uses Viewport-Bounded Progressive Discovery

- Decision: The canonical UMKM map loads registered businesses and public references in network batches of 10, ranks by viewer proximity or visible-map center, and fetches public-reference markers separately through a thin viewport-bounded endpoint. Public requests are capped at 50 rows and a 500-row progressive window rather than exposing an unbounded collection read.
- Evidence: Product feedback identified slow first load and requested Google Maps-like nearby loading. The implementation audit found a 120-row server seed, a 160-row client refetch, periodic full polling, and public references fetched through a generic content query that reached its 1.5-second deadline.
- Consequence: Map movement must query indexed bounds, stale requests must be cancelled, public projections must exclude private metadata, and user coordinates placed in URLs must remain coarse. Newest-first reference browsing uses keyset cursors; query, nearby, and viewport ranking use a bounded 10-at-a-time prefix window of at most 50 reference rows. A reference is publishable on these surfaces only with an explicit safe source URL and license URL. Larger windows, spatial tiles, replicas, partitioning, or sharding require production query plans and load evidence rather than row-count claims alone.
