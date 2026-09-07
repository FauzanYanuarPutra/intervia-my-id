# Marketplace Quality Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore a clean, current-tree Marketplace quality baseline without changing externally observable behavior.

**Architecture:** Keep PR #162 (`fix/marketplace-quality-current-20260907`) as the canonical repair branch. Treat the existing failing `cargo clippy --locked --all-targets -- -D warnings` run as RED, apply only semantics-preserving lint cleanups, then require fmt, Clippy, tests, and the Usaha backend gate before merge. Close duplicate repair PR #166 only after #162 is green.

**Tech Stack:** Rust 1.97.1, Axum, SQLx, Cargo, GitHub Actions

**Spec:** `docs/superpowers/specs/2026-09-07-platform-hardening-usaha-simplification-design.md`

## Global Constraints

- Preserve externally observable contracts unless the task explicitly changes them.
- Do not weaken `-D warnings` globally.
- Prefer mechanical, semantics-preserving rewrites for lint findings.
- Do not mix security dependency changes or Usaha UX changes into this branch.
- Require fresh CI evidence from the current PR merge tree before merge.

---

### Task 1: Remove the remaining behavior-neutral Clippy findings

**Files:**
- Modify: `services/marketplace_service/src/order_engine.rs:448-463`
- Modify: `services/marketplace_service/src/main.rs:770-777`
- Modify: `services/marketplace_service/src/main.rs:6028-6043`
- Modify: `services/marketplace_service/src/main.rs:8038-8047`
- Modify: `services/marketplace_service/src/main.rs:9218`
- Modify: `services/marketplace_service/src/main.rs:23693`

**Interfaces:**
- Consumes: existing Marketplace request/response and order status types.
- Produces: identical runtime behavior with a Clippy-clean source tree.

- [ ] **Step 1: Re-run the failing quality command to preserve the RED baseline**

Run from `services/marketplace_service`:

```bash
cargo clippy --locked --all-targets -- -D warnings
```

Expected: FAIL on the seven remaining current-tree findings: duplicate `if` branches, large enum variant, match-like-matches, duplicated actor-label branches, unnecessary sort comparator, and redundant match guard.

- [ ] **Step 2: Simplify the duplicate order base-status branch**

Replace the whole `base_status_on_create` body with the invariant it already returns on both branches:

```rust
fn base_status_on_create(&self, _input: &CreateOrderRequest) -> OrderBaseStatus {
    OrderBaseStatus::PendingPayment
}
```

This preserves current behavior for both TOP and non-TOP creation.

- [ ] **Step 3: Box the oversized single analytics event variant**

Change the enum to:

```rust
#[derive(Debug, Deserialize)]
#[serde(untagged)]
enum CollectEventsRequest {
    Batch { events: Vec<TrackEventRequest> },
    Single(Box<TrackEventRequest>),
}
```

At each `CollectEventsRequest::Single(event)` match site, dereference the box where an owned `TrackEventRequest` is required:

```rust
CollectEventsRequest::Single(event) => vec![*event],
```

- [ ] **Step 4: Replace the demand-side boolean match with `matches!`**

```rust
fn is_demand_listing_metadata(metadata: &Value) -> bool {
    matches!(
        metadata_listing_side(metadata).as_deref(),
        Some("demand")
            | Some("need")
            | Some("needs")
            | Some("request")
            | Some("requested")
            | Some("seeker")
            | Some("buyer request")
            | Some("buy request")
            | Some("butuh")
            | Some("mencari")
    )
}
```

- [ ] **Step 5: Collapse the actor-label branches that all return `value`**

Replace the existing branch chain with:

```rust
.map(|value| {
    if value.starts_with('@')
        || value.contains(' ')
        || value.contains('.')
        || value == "Seseorang"
        || value == "Someone"
    {
        value
    } else {
        format!("@{value}")
    }
})
```

- [ ] **Step 6: Use a key sort for completed request cards**

```rust
completed.sort_by_key(|item| std::cmp::Reverse(item.created_at));
```

- [ ] **Step 7: Remove the redundant zero-count guard**

Replace:

```rust
Ok(count) if count == 0 => sleep(Duration::from_millis(poll_ms)).await,
```

with:

```rust
Ok(0) => sleep(Duration::from_millis(poll_ms)).await,
```

- [ ] **Step 8: Format and verify GREEN**

Run:

```bash
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

Expected: all PASS.

- [ ] **Step 9: Commit the repair**

```bash
git add services/marketplace_service/src/order_engine.rs services/marketplace_service/src/main.rs
git commit -m "fix: clear remaining marketplace clippy findings"
```

### Task 2: Verify the Marketplace/Usaha integration surface

**Files:**
- Test only; no source change expected.

**Interfaces:**
- Consumes: Marketplace durable business-control endpoints already used by Usaha.
- Produces: fresh evidence that the lint cleanup did not break Usaha business-control behavior.

- [ ] **Step 1: Run repository hygiene**

```bash
python scripts/ci/check_repository_hygiene.py
```

Expected: PASS.

- [ ] **Step 2: Run the Usaha Control Backend Gate workflow/tests used by CI**

Use the repository's existing `Usaha Control Backend Gate` workflow and require a successful conclusion on the canonical branch merge tree.

- [ ] **Step 3: Re-run Quality Gates**

Expected for `Rust / marketplace_service`: Format PASS, Clippy PASS, Tests PASS. Other unrelated jobs must not regress from the branch baseline.

### Task 3: Canonicalize the repair branch

**Files:**
- GitHub PR metadata only.

**Interfaces:**
- Consumes: green PR #162.
- Produces: one canonical Marketplace quality PR and no ambiguous duplicate repair path.

- [ ] **Step 1: Mark PR #162 ready for review only after fresh gates are green**

Update the PR body with exact successful workflow run IDs.

- [ ] **Step 2: Close PR #166 as superseded**

Close `style: format marketplace on current main` only after PR #162 contains the formatter output plus the final Clippy fixes and is mergeable.

- [ ] **Step 3: Merge PR #162**

Merge only when the current merge tree has fresh green Quality Gates, Usaha Control Backend Gate, and relevant runtime/security checks not made worse by this branch.

## Self-review

- Spec coverage: Marketplace baseline, behavior preservation, strict Clippy, duplicate branch cleanup, and Usaha integration verification are covered.
- Placeholder scan: no TBD/TODO/future implementation placeholders remain.
- Type consistency: `CollectEventsRequest::Single(Box<TrackEventRequest>)` is paired with `vec![*event]`; `OrderBaseStatus::PendingPayment` preserves both existing branches.