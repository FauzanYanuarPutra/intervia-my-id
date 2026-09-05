# Detail to Chat Conversion Wave 9 Design

## Goal
Turn public discovery into an actionable marketplace funnel by making the next step from listing, need, business profile, and user profile clear, safe, and context-preserving.

Target funnel:

`Explore → Detail/Profile → Contact or Chat → Deal`

Wave 9 must improve conversion without inventing routes, changing the chat subsystem, changing authentication architecture, or adding payments.

## Product Principle
A public discovery page is incomplete if the user finds a relevant entity but cannot understand the safest next action.

The CTA contract must therefore be:
- explicit;
- context-aware;
- ownership-aware;
- authentication-aware;
- truthful about what the route actually does.

## Scope

### 1. Verify Existing Contact and Chat Routes
Before any CTA is added or changed, inspect the repository for the actual implemented routes and APIs used to:
- open an existing chat room;
- start a conversation with another user/provider;
- contact a business/provider;
- pass listing/content context into chat, if supported;
- authenticate and return to the intended destination.

A route is considered usable only if its implementation and access/auth handling can be verified. Naming similarity is not sufficient.

Wave 9 must not create a speculative `/chat/:id`, `/messages/:id`, or equivalent route.

### 2. Shared Public CTA Decision Contract
Introduce one small shared helper or equivalent deterministic contract for public detail/profile CTA decisions.

Inputs should be limited to facts already available to the rendering surface, such as:
- locale;
- entity type: listing, need, business, user;
- side: supply or demand where applicable;
- current viewer authentication state if available;
- current viewer ownership relation if available;
- target provider/user identifier when verified;
- canonical detail/profile href;
- verified chat/contact capability discovered in the existing codebase.

Outputs should describe the next action without embedding UI-specific presentation details. A typical result may include:
- action kind;
- target href or action identifier;
- whether authentication is required;
- locale-aware label intent;
- fallback action when direct contact is unavailable.

Do not infer any field that is not present.

### 3. Ownership-Aware Actions
The CTA must not encourage a user to contact themselves.

For owned entities:
- listing owner: primary action should be an existing safe owner action such as edit/manage/view listing management if available;
- need owner: primary action should be an existing safe manage/edit action if available;
- business/user profile owner: use an existing profile management action if available, otherwise render no misleading contact CTA.

Ownership checks must use existing identity information already exposed to the page. Do not add a new identity lookup solely for CTA rendering unless an existing shared accessor makes it trivial and safe.

### 4. Supply vs Demand CTA Semantics
CTA wording and destination must follow marketplace side semantics.

For supply listings/providers:
- user intent is to ask, contact, or discuss the offering;
- preferred primary CTA is an existing verified chat/contact action;
- profile/view-provider is a valid fallback.

For demand/need entries:
- user intent is to respond to the need or offer help/supply;
- preferred primary CTA is an existing verified chat/contact action with the need context preserved if supported;
- provider/profile CTA is secondary only when meaningful.

Do not label a generic navigation action as “Chat” if it does not actually open or start a conversation.

### 5. Authentication Return Context
If the existing product requires authentication before chat/contact, Wave 9 should preserve the user’s intent through the existing auth boundary.

Requirements:
- use the current auth redirect/query contract exactly as implemented;
- return to the intended detail/contact action after authentication where supported;
- preserve locale;
- preserve content/listing/need context only through parameters already accepted by the auth/chat flow;
- do not add a new auth callback architecture.

If the current auth flow does not support post-login continuation safely, the CTA may route to login with the closest supported return URL, and the limitation should remain explicit in code comments/tests rather than being hidden behind a fake continuation flow.

### 6. Context Preservation Into Conversation
If the existing chat flow already accepts listing/content/business context, Wave 9 should pass it consistently.

Allowed context includes only existing supported identifiers and public metadata such as:
- content/listing ID;
- need ID;
- business/provider ID;
- canonical public href;
- short public title if the contract already accepts it.

Do not pass private data, full descriptions, payment data, phone numbers, identity documents, or arbitrary user-entered hidden metadata into chat routing.

If context-aware chat is not supported today, do not invent it. Use the verified generic chat/contact path and defer richer context linking.

### 7. Surface Coverage
Audit and align primary/secondary actions on these public surfaces:
- content/listing detail;
- need detail if implemented separately;
- business profile;
- public user profile;
- Explore result cards only where they already expose a CTA that should match the same contract.

Wave 9 does not require every surface to render identical buttons. It requires them to use the same underlying action semantics.

### 8. Recovery Paths
A user should not hit a dead end if direct contact is unavailable.

Safe fallbacks, in order of usefulness, may include existing routes for:
1. view provider/business profile;
2. view related listing/need;
3. create a need or offer;
4. Explore search;
5. Support only for actual support problems, not as a substitute for marketplace contact.

Do not route normal marketplace intent to Support merely because chat is unavailable.

### 9. Analytics
Use existing analytics infrastructure to record the conversion funnel without creating a new analytics system.

Target events:
- public detail primary CTA clicked;
- public profile contact CTA clicked;
- login-required contact action clicked;
- owner-management CTA clicked where already meaningful;
- fallback profile action clicked.

Requirements:
- one event per user action;
- stable event/action names;
- include only non-sensitive public identifiers already used by analytics contracts;
- do not log message text, credentials, phone numbers, email addresses, identity documents, or private profile data.

### 10. Copy and UX
CTA labels should describe the real action.

Examples of semantic intent, not mandatory exact strings:
- supply: `Hubungi penyedia`, `Tanya lewat chat`;
- demand: `Tawarkan bantuan`, `Hubungi pembuat kebutuhan`;
- unauthenticated: same user-facing intent; authentication should be an implementation detail unless the current product clearly labels it;
- owned: `Kelola listing`, `Edit kebutuhan`, `Kelola profil` when corresponding routes exist.

Avoid inflated claims such as:
- “Respon cepat”;
- “Penyedia terpercaya”;
- “Aman 100%”;
- “Stok tersedia”;
- “Siap deal”.

## Error Handling
- Missing target user/provider ID: do not render a direct chat CTA that requires it; use the closest verified fallback.
- Missing auth state: prefer a server/client contract already used elsewhere; do not assume logged-in state.
- Self-contact: suppress direct contact and use an owner action if available.
- Chat route unavailable or unverified: do not render a fake chat CTA.
- Chat creation failure: preserve the current page and surface the existing error handling pattern rather than navigating to a dead route.
- Deleted/unavailable entity: preserve current not-found behavior.

## Testing Strategy
Add focused regression tests around the shared action-decision contract and route preservation where practical.

Core cases:
1. supply + visitor + verified contact capability → contact/chat action;
2. demand + visitor + verified contact capability → respond/contact action;
3. owned entity → no self-contact; owner action when available;
4. missing provider/target identifier → safe fallback;
5. unauthenticated visitor → existing auth boundary with return context when supported;
6. equal entity titles or similar profiles must not alter the target identity;
7. unsupported chat context must not be serialized into invented params.

Tests should assert action semantics and generated destinations, not brittle button markup.

Per the user’s requested repository workflow, separate test execution does not block PR merge. No test/build-green claim may be made without actual execution. The post-merge local quality gate remains:

`./up.ps1 -Profile backoffice,edge,local-ai,kyc,devtools,tunnel -Build`

## Implementation Boundaries
Wave 9 must not:
- redesign or replace the chat subsystem;
- add WebSocket/realtime architecture;
- change authentication architecture;
- add payment, escrow, checkout, transaction, or order flows;
- change database schema;
- expose private contact details that are not already intentionally public;
- create new trust/rating/response-speed scoring;
- alter backend search ranking;
- retire `/umkm`;
- change unrelated community/reels features;
- perform broad visual redesign.

## Expected Outcome
After Wave 9, a user who discovers a relevant listing, need, business, or person should have a clear and truthful next step. Contact actions should point only to routes that actually exist, ownership should be respected, authentication should preserve intent where the current platform supports it, and direct-contact gaps should degrade to useful marketplace fallbacks instead of dead ends.

This creates the conversion baseline needed before Wave 10 deepens backend Search Intelligence and before later liquidity/seeding work.