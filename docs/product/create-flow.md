# Create Listing Flow

Status: implementation update 2026-07-23.

## Product Goal

Create listing is the canonical marketplace entry point for both sides of demand:

- `offer`: the user wants to offer a material, supplier service, machine, place, or opportunity.
- `request`: the user is looking for the same business need and may later become a reviewed Lajukan Match requirement.

The flow must help users publish structured listings without forcing long forms too early. It should preserve partial work from the first choice, then move to a server-backed draft once the category and closest subcategory are clear.

## Canonical Steps

1. Choose intent.
2. Choose marketplace category.
3. Choose subcategory; add industry only when clear.
4. Basic information.
5. Detailed attributes.
6. Media and supporting documents.
7. Location and service area.
8. Contact and response preference.
9. Review and publish.

## Draft Lifecycle

Before step 3 is complete, the WWW app stores a temporary browser draft under `lajukan:create:temporary-draft`. This storage must not contain binary media payloads, secrets, raw tokens, or private provider errors.

For new posts, `/create` starts from the brief-first `SimpleCreateFlow`: choose intent, choose the closest category, fill only the required fields, then publish or add optional detail. The longer schema-driven wizard remains available for existing drafts, AI draft continuation, and detail category routes that still need the full draft lifecycle.

After step 3 in the full wizard, authenticated users get a server draft through `/api/listing-drafts`, proxied to marketplace `/v1/listing-drafts`. The UI treats industry as optional; if none is chosen it submits the general `other` industry slug to satisfy the current marketplace draft contract. Server drafts are stored in `content_items` with:

- `content_status = draft`
- `listing_status = draft`
- `listing_intent = offer | request`
- `current_step`
- `completion_percentage`
- `draft_version`
- `last_saved_at`
- structured `attributes`, `contact_snapshot`, and metadata form values.

Publishing validates required fields and media rules, then transitions the record to:

- `content_status = active`
- `listing_status = published`
- `published_at`
- `current_step = 9`
- `completion_percentage = 100`

Archived/deleted drafts must not appear in public marketplace discovery.

Server publish validation is intentionally stricter than draft autosave:

- `offer` drafts require the category-specific primary field, display identity, contact channel, and a location/service area before publishing.
- `request` drafts require the category-specific primary need field, display identity, and contact channel, but may start without an exact address or image.
- Draft metadata must carry `listing_intent`, `market_side`, `listing_side`, category/subcategory slugs, industry IDs, form values, and media references so create, draft, edit, search, and cards resolve the same buyer/provider side.
- Reference-only/open-data records with `source_only` or `is_transactional=false` must keep source URL/license metadata and `contact_policy=no_private_contact_seeded`; they are not vendor claims.

## Schema Rules

Create fields are defined by intent, category, subcategory, and step. `offer` and `request` copy must stay distinct: users are either offering something or asking for something. Avoid ambiguous copy such as "Cari atau tawarkan" after the intent is known.

Request/kebutuhan posts are brief-first and may be intentionally incomplete. They must support text-only publishing, optional reference images/documents, area-level location text without precise coordinates, and flexible budget context stored as request metadata rather than a fixed selling price. Offer/penyedia posts should start from the minimum credible information first; photos, exact map pins, branch linking, documents, and extra specs are encouraged when useful but should not block the initial form unless the backend publish policy requires them.

The schema should be shared with edit listing over time so published listings, drafts, and edits use the same required fields and validation semantics.

## Current Implementation Notes

- Main WWW wizard: `frontend/www/src/app/[locale]/(app)/create/CreateListingWizard.tsx`.
- Brief-first create now asks for a lightweight closest-type choice before the main fields. The choice stores marketplace category, subcategory, and specific type metadata so examples like AyamQu can resolve to `Bahan & Supplier -> Bahan Baku Produksi -> Daging & Unggas` without turning the seller name into a category.
- Create shell intentionally avoids the old multi-section desktop sidebar; create pages should focus on the active create flow, not a full owner workspace navigation.
- The full wizard shows user-facing progress as three phases: choose, fill, review. The internal 9-step schema remains for validation, drafts, and publish routing.
- Create schema: `frontend/www/src/lib/create/createListingSchema.ts`.
- Temporary browser draft helpers: `frontend/www/src/lib/create/createDraftStorage.ts`.
- Draft list page: `frontend/www/src/app/[locale]/(app)/create/drafts`.
- Marketplace draft API and lifecycle columns are additive; old direct content create/update paths remain compatible.

Known follow-up gaps:

- Edit listing is not yet fully routed through the shared create schema.
- Media reorder and explicit cover selection are partial.
- Document upload and map picking are placeholders.
- Login recovery uses local draft hydration and authenticated draft creation, but does not yet show a dedicated migration prompt.
