# Async UX System Design

## Goal

Make loading, refreshing, empty, error, stale, mutation, upload, and hydration states consistent across Lajukan's public marketplace, business OS, CRM, CMS, and shared frontend packages.

## Problem

The current frontend has fragmented loading patterns:

- Some surfaces replace an entire page while only one auth-dependent slot is unknown.
- Some lists infer empty state from `items.length === 0` before the first request has settled.
- Some refreshes remove useful stale data and replace it with a skeleton.
- Some money/KPI views risk treating unknown values as `0`.
- Skeleton primitives are split between shared packages, app-local components, raw `animate-pulse`, and direct spinners.

These are state architecture bugs first and visual polish bugs second.

## State Model

Every async data surface should distinguish:

- `initialLoading`: no usable data has ever been loaded for this surface.
- `refreshing`: usable stale data exists while a new request is running.
- `fetchingNextPage`: existing list remains visible while the tail page loads.
- `mutating`: one entity or control is being changed.
- `submitting`: a form submission is pending.
- `uploading`: bytes are moving and progress can be shown.
- `processing`: server-side work continues after upload/submit.
- `hydrating`: client auth/session or permissions are resolving.

Empty state requires a settled request. It must not be inferred from an empty array while `initialLoading` is true.

Unknown numeric values are distinct from `0`. Business and finance surfaces must render an unknown placeholder for `undefined`, unavailable copy for `null`, and a real formatted zero only for `0`.

## Shared Primitives

Shared primitive responsibilities:

- `Skeleton`: decorative placeholder with tokenized color and reduced-motion support.
- `SkeletonText`, `SkeletonAvatar`, `SkeletonMedia`, `SkeletonAction`: common shapes.
- `RefreshIndicator`: subtle stale-data refresh status.
- `Spinner`: scoped control progress, not page skeleton replacement.
- `AsyncBoundary`: declarative state branching for initial, refresh, empty, error, and stale-error surfaces.
- `EmptyState` and `ErrorState`: first-class settled states.

Domain-specific topology remains in the owning app. For example, `ProductCardSkeleton`, `MetricSkeleton`, `DealCardSkeleton`, and `MediaTileSkeleton` compose shared primitives but live beside their real domain components.

## Public Web Requirements

Home:

- Auth/session hydration must not replace the full Home shell.
- Static navigation, search, discovery, and public content remain mounted.
- Auth-only slots show local skeletons.
- Summary counters must not display fake zero before summary is known.

Community:

- Initial feed load can show feed-shaped skeletons.
- Tab/filter refresh keeps stale posts visible and shows a subtle refresh indicator.
- Empty feed appears only after initial load completes successfully.
- Search uses skeleton for initial search and stale results plus indicator for refresh.

Explore:

- Existing results remain visible while refresh is running.
- Skeletons should follow entity topology instead of generic rectangles.
- Zero-result recovery appears only after a settled response.

Reels:

- Initial empty reels must not appear before fetch completion.
- Pagination uses tail loader.
- Mutations remain scoped to the action/control.

Storefront:

- Product, menu, hero, and contact surfaces reserve media aspect ratio.
- Unavailable catalog and empty catalog are separate states.

## Business OS Requirements

Dashboard, finance, orders, inventory, and reports prioritize information persistence:

- Initial load may show structure skeletons with stable headers.
- Date, branch, business, filter, and pagination refreshes keep old data visible.
- Row/cell/action mutations do not blank whole tables.
- Finance never displays `Rp0` as placeholder for unknown values.
- Charts keep known axes/headers during refresh when dimensions are known.

## CRM Requirements

CRM must preserve working context:

- Pipelines and tables remain visible during filter refresh.
- Detail drawers can show local skeleton sections while the main list remains visible.
- Notes/tasks/status mutations are local and optimistic where safe.

## CMS Requirements

CMS must preserve authoring context:

- Editor startup can show an editor-shell skeleton.
- Autosave never replaces the editor with a spinner.
- Publish state is distinct from saving draft.
- Media upload shows upload and processing progress, not a skeleton.

## Accessibility

- Async regions use `aria-busy` at the region level.
- Decorative skeleton nodes use `aria-hidden="true"`.
- Avoid multiple live regions announcing the same loading state.
- Reduced motion must disable shimmer or pulse animation.

## Verification

Verification should include:

- Unit/component tests for state transitions.
- Static guard tests for high-risk anti-patterns in touched surfaces.
- `npm run lint`, relevant `vitest run ...`, and app typechecks/builds where feasible.

