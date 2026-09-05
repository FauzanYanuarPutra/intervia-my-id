# Public Funnel Stabilization Wave 8 Design

## Goal
Stabilize the public Lajukan funnel after Waves 4–7 so Explore, public detail/profile pages, SEO metadata, URL state, and recovery actions behave as one coherent system before deeper backend search and chat conversion work.

## Why This Wave Exists
The public product has improved materially, but several pieces were changed quickly across multiple waves. The remaining risk is inconsistency rather than missing breadth: duplicated URL semantics, metadata drift, compacted frontend files that are difficult to review, and route transitions that can become dead ends.

Wave 8 is therefore a consolidation pass. It must improve correctness, readability, and consistency without adding a new subsystem.

## Scope

### 1. Explore Code Stabilization
Target the existing Explore surfaces, especially `ExploreHubPage.tsx` and `ExploreSearchResults.tsx`.

Requirements:
- restore readable formatting and clear component boundaries where prior changes made files excessively compact;
- preserve current visible behavior unless a behavior is explicitly changed by this spec;
- avoid broad visual redesigns;
- keep result group semantics introduced in Waves 4–7;
- preserve backend result ordering and stable identity dedupe from Wave 7;
- keep zero-result recovery from Wave 5.

The goal is maintainable code, not cosmetic churn.

### 2. Canonical Search URL Contract
There must be one public meaning for supply/demand search state.

Canonical values:
- `side=supply` = offerings/providers/listings available to buyers;
- `side=demand` = buyer needs/requests;
- omitted `side` = neutral/all-mode only where the screen genuinely represents both sides.

Requirements:
- normalize helper-generated Explore links to the same contract used by `parseGlobalSearchState`;
- remove redundant or contradictory side parameters;
- preserve legacy aliases only at parsing boundaries, never emit them in new URLs;
- preserve query, tab, category, subcategory, location, distance, and sort when appropriate;
- no redirect loop between legacy `/search` and `/explore`.

### 3. Public SEO Metadata Completion
Bring the remaining public static/trust surfaces onto the same metadata contract used by newer pages.

Audit and normalize where they exist:
- Trust;
- Cookie Policy;
- Refund Policy;
- Terms;
- Privacy;
- Support/Contact as needed for parity.

Requirements:
- locale-correct title and description;
- canonical URL;
- `id`, `en`, and `x-default` hreflang;
- consistent Open Graph and Twitter metadata where the page is indexable;
- explicit robots policy;
- no Indonesian page-level metadata overriding English layouts;
- no legacy “Lajukan UMKM” metadata unless the page intentionally describes the legacy surface.

No policy wording should be materially rewritten unless required to correct an authentication/account terminology mismatch already established by current product behavior.

### 4. Legacy Route and UMKM Map Contract
`/umkm` remains a functional compatibility surface until Explore has full map/deep-link parity.

Requirements:
- do not redirect `/umkm` to Explore in this wave;
- keep `/umkm` `noindex,follow` with canonical pointing to the appropriate Explore businesses surface;
- preserve map-mode and existing deep-link/query behavior;
- keep it out of the sitemap;
- ensure Explore “nearby businesses” links continue to reach the functional map;
- document the parity conditions required before future retirement.

Retirement criteria for `/umkm`:
1. Explore has map view parity;
2. business deep links resolve without loss;
3. city/category/store filters have equivalents;
4. existing public links can be redirected without losing user intent.

### 5. Public Detail/Profile Funnel Audit
Audit the next action available from:
- listing detail;
- need detail;
- business profile;
- user profile.

Requirements:
- every public detail/profile surface must have a clear next action or recovery path;
- do not invent a chat URL;
- add a chat/contact CTA only if an existing safe route and permission contract can be verified in the repository;
- unauthenticated actions may route through the existing auth boundary if that is already the product contract;
- preserve ownership, verified status, and location as factual signals only;
- never infer rating, stock, response speed, trust score, seller quality, or availability.

If a safe chat route cannot be verified during implementation, Wave 8 must keep detail/profile actions and defer direct chat conversion to Wave 9.

### 6. Search Presentation Consistency
Wave 7 made backend order authoritative. Wave 8 must ensure that contract survives all Explore presentation layers.

Requirements:
- no second independent frontend relevance model;
- stable dedupe may remove only explicit duplicate identity/href;
- equal titles from different entities must remain distinct;
- displayed totals must not become misleading after client-side dedupe;
- `latest` and `nearest` labels/URL state must not imply behavior the backend does not actually provide;
- where a sort mode is unsupported for a result source, degrade explicitly rather than silently mislabel the ordering.

Deep backend ranking expansion is out of scope for this wave.

### 7. Analytics Contract Cleanup
Preserve and normalize existing public-funnel events rather than creating a new analytics system.

Target actions:
- Explore search performed;
- result clicked;
- zero-result recovery clicked;
- detail/profile primary CTA clicked;
- create need/offer clicked.

Requirements:
- use existing analytics/event infrastructure;
- use stable action names;
- do not log credentials, private chat content, identity documents, or other sensitive payloads;
- avoid duplicate event emission for a single user action.

## Error Handling
- Missing public listing/profile: preserve current not-found/noindex behavior.
- Unsupported legacy parameter: normalize to a safe canonical state instead of throwing.
- Unavailable result source: preserve partial Explore results and identify the unavailable group where the current UI supports it.
- Missing chat capability: do not render a dead chat CTA.
- Metadata generation failure must fall back to safe generic metadata, not block rendering.

## Testing Strategy
Add or update focused regression tests for:
- Explore URL state serialization and supply/demand normalization;
- backend order preservation and explicit identity dedupe;
- metadata canonical/hreflang/robots parity for remaining policy/trust pages where helpers permit unit testing;
- UMKM route/canonical contract where existing test patterns permit;
- detail/profile CTA helper behavior if a shared helper is introduced.

Per the user's requested workflow, separate test execution does not block PR merge. Tests remain part of the code contract, while the full local quality gate is:

`./up.ps1 -Profile backoffice,edge,local-ai,kyc,devtools,tunnel -Build`

No build/test-green claim may be made until that command or equivalent targeted commands have actually completed successfully.

## Implementation Boundaries
Wave 8 must not:
- alter payment flows;
- alter authentication architecture;
- alter database schema;
- change marketplace backend ranking SQL substantially;
- add vector/semantic search;
- create a new chat subsystem;
- retire `/umkm` before parity;
- perform unrelated UI redesigns;
- minify or aggressively compact touched source files.

## Expected Outcome
After Wave 8, the public product should have one coherent URL vocabulary, consistent SEO/trust metadata, readable Explore code, preserved backend search order, truthful public signals, functional legacy map compatibility, and no obvious dead-end CTA introduced by recent waves.

This creates a safer baseline for Wave 9 (detail/profile → contact/chat conversion) and Wave 10 (backend search intelligence).
