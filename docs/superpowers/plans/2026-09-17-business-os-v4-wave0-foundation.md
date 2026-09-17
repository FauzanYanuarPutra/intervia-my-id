# Lajukan Business OS V4 — Wave 0 Foundation Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Harden the existing Business OS foundation so every later transaction, finance, inventory, workforce, case, and document feature has one canonical persistence boundary, immutable applied migrations, and reusable command/scope/money/time conventions.

**Architecture:** Preserve `frontend/apps/usaha`, `identity_service`, and the existing `marketplace_service/src/businesses` implementation. Add executable repository contracts around source-of-truth and migration immutability, then introduce small pure Rust kernel helpers that later domains can reuse without moving existing business behavior in a big bang.

**Tech Stack:** Rust/Axum/SQLx/PostgreSQL, TypeScript/Next.js 16/React 19, Python 3.12 CI contract scripts, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-09-17-lajukan-business-os-v4-master-design.md`

## Global Constraints

- `frontend/apps/usaha` remains the single merchant Business OS frontend.
- `frontend/apps/crm` remains an internal Lajukan command center, not merchant CRM.
- Identity/authentication remains owned by `identity_service`.
- Canonical business state is persistent backend state; `portal-store` or browser state must not be a production source of truth.
- Existing business profile, capability, governance, inventory, recipe, sales, settlement, finance-core, and audit behavior must remain compatible in Wave 0.
- Applied database migrations are immutable; fixes use new forward migrations.
- Business-critical mutations are authorized server-side; UI visibility is not authorization.
- Money uses integer/exact representations, never floating point.
- New command helpers must preserve deterministic request hashing and explicit idempotency semantics.
- No production code is added without a failing test or contract first.

---

### Task 1: Make the persistence boundary executable

**Files:**
- Create: `scripts/ci/check_usaha_persistence_boundary.py`
- Create: `scripts/ci/test_usaha_persistence_boundary.py`
- Modify: `.github/workflows/usaha-business-os-gate.yml`
- Document: `docs/architecture/business-os-source-of-truth.md`

**Interfaces:**
- Consumes: repository paths under `frontend/apps/usaha/src`.
- Produces: `check_usaha_persistence_boundary.py` returning exit code `0` only when production Usaha code does not import/use the legacy in-memory `portal-store` as persistence.

- [ ] **Step 1: Write the failing contract test**

```python
# scripts/ci/test_usaha_persistence_boundary.py
import tempfile
import unittest
from pathlib import Path

from check_usaha_persistence_boundary import find_violations


class PersistenceBoundaryTest(unittest.TestCase):
    def test_rejects_production_portal_store_import(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            target = root / "frontend/apps/usaha/src/app/api/example/route.ts"
            target.parent.mkdir(parents=True)
            target.write_text("import { mutate } from '@/lib/portal-store';\n", encoding="utf-8")
            self.assertEqual([str(target.relative_to(root))], find_violations(root))

    def test_ignores_legacy_store_definition_and_tests(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            legacy = root / "frontend/apps/usaha/src/lib/portal-store.ts"
            test = root / "frontend/apps/usaha/src/lib/example.test.ts"
            legacy.parent.mkdir(parents=True)
            legacy.write_text("globalThis.__usahaPortalStore = {};\n", encoding="utf-8")
            test.write_text("import '@/lib/portal-store';\n", encoding="utf-8")
            self.assertEqual([], find_violations(root))
```

- [ ] **Step 2: Run the test and verify RED**

Run:

```bash
cd scripts/ci
python -m unittest -v test_usaha_persistence_boundary.py
```

Expected: FAIL because `check_usaha_persistence_boundary.py` does not exist yet.

- [ ] **Step 3: Implement the minimal scanner**

```python
# scripts/ci/check_usaha_persistence_boundary.py
from pathlib import Path
import sys

FORBIDDEN = ("portal-store", "__usahaPortalStore")


def find_violations(repo_root: Path) -> list[str]:
    source = repo_root / "frontend/apps/usaha/src"
    violations: list[str] = []
    for path in source.rglob("*"):
        if path.suffix not in {".ts", ".tsx", ".js", ".jsx"}:
            continue
        rel = path.relative_to(repo_root)
        if path.name == "portal-store.ts" or ".test." in path.name or ".spec." in path.name:
            continue
        text = path.read_text(encoding="utf-8")
        if any(token in text for token in FORBIDDEN):
            violations.append(str(rel))
    return sorted(violations)


def main() -> int:
    root = Path(__file__).resolve().parents[2]
    violations = find_violations(root)
    if violations:
        print("Usaha production persistence must use canonical backend APIs, not portal-store:")
        for path in violations:
            print(f" - {path}")
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
```

- [ ] **Step 4: Run unit test and repository scan**

```bash
cd scripts/ci
python -m unittest -v test_usaha_persistence_boundary.py
python check_usaha_persistence_boundary.py
```

Expected: unit tests PASS. Repository scan either PASS or identifies exact remaining production dependencies that must be migrated before this task is complete.

- [ ] **Step 5: Remove every reported production dependency**

For each reported file, replace reads/mutations with the existing `business-server.ts`, authenticated Identity adapter, or Marketplace business endpoint. Do not delete `portal-store.ts` until there are zero production consumers; it may remain temporarily as historical/demo compatibility code.

- [ ] **Step 6: Add the boundary to CI**

Add this step to `.github/workflows/usaha-business-os-gate.yml` contract job after the existing application boundary validation:

```yaml
      - name: Reject legacy Usaha persistence dependencies
        run: |
          python scripts/ci/check_usaha_persistence_boundary.py
          cd scripts/ci
          python -m unittest -v test_usaha_persistence_boundary.py
```

- [ ] **Step 7: Document the canonical owners**

`docs/architecture/business-os-source-of-truth.md` must state:

```text
Identity/session/organization identity -> identity_service
Business/profile/location/catalog      -> marketplace_service businesses domain
Sales/inventory/finance/governance      -> marketplace_service businesses domain
Usaha frontend                          -> presentation/BFF adapter only
portal-store                            -> legacy/demo compatibility; never production persistence
```

- [ ] **Step 8: Commit**

```bash
git add scripts/ci/check_usaha_persistence_boundary.py scripts/ci/test_usaha_persistence_boundary.py .github/workflows/usaha-business-os-gate.yml docs/architecture/business-os-source-of-truth.md
git commit -m "chore: enforce Business OS persistence boundary"
```

---

### Task 2: Freeze the current Business OS migration baseline

**Files:**
- Create: `services/marketplace_service/migrations/business_os_immutable_manifest.txt`
- Create: `scripts/ci/check_business_os_migration_immutability.py`
- Create: `scripts/ci/test_business_os_migration_immutability.py`
- Modify: `.github/workflows/usaha-control-backend-gate.yml`
- Retain: `services/marketplace_service/tests/migration_immutability_contract.rs`

**Interfaces:**
- Manifest format: `<git-blob-sha>  <repo-relative-path>` one entry per line.
- Script output: non-zero exit when a protected file is absent or `git hash-object` differs from the manifest.

- [ ] **Step 1: Write failing tests for changed and missing migrations**

```python
import tempfile
import unittest
from pathlib import Path

from check_business_os_migration_immutability import verify_manifest


class MigrationImmutabilityTest(unittest.TestCase):
    def test_reports_missing_file(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            manifest = root / "manifest.txt"
            manifest.write_text("deadbeef  migrations/missing.sql\n", encoding="utf-8")
            errors = verify_manifest(root, manifest, hash_file=lambda _: "deadbeef")
            self.assertEqual(["missing: migrations/missing.sql"], errors)

    def test_reports_hash_drift(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            migration = root / "migrations/a.sql"
            migration.parent.mkdir(parents=True)
            migration.write_text("SELECT 1;", encoding="utf-8")
            manifest = root / "manifest.txt"
            manifest.write_text("expected  migrations/a.sql\n", encoding="utf-8")
            errors = verify_manifest(root, manifest, hash_file=lambda _: "actual")
            self.assertEqual(["drift: migrations/a.sql expected=expected actual=actual"], errors)
```

- [ ] **Step 2: Verify RED**

```bash
cd scripts/ci
python -m unittest -v test_business_os_migration_immutability.py
```

Expected: FAIL because the checker does not exist.

- [ ] **Step 3: Implement manifest verification**

The checker must parse the manifest, validate path existence, run `git hash-object <path>` by default, and return deterministic sorted errors. Unit tests inject `hash_file` so they do not require git.

- [ ] **Step 4: Baseline current Business OS migrations**

Protect the existing Business OS migration files from `20260823001000_usaha_business_os.up.sql` through `20260916120000_business_sale_configuration_snapshot.up.sql`, including their paired down migrations when present. Use the current Git blob SHA from the repository as the manifest value.

- [ ] **Step 5: Add CI verification**

Add to the Usaha backend gate before Rust tests:

```yaml
      - name: Verify applied Business OS migrations are immutable
        run: |
          python scripts/ci/check_business_os_migration_immutability.py
          cd scripts/ci
          python -m unittest -v test_business_os_migration_immutability.py
```

- [ ] **Step 6: Preserve the existing Finance Core SHA384 test**

Do not remove `migration_immutability_contract.rs`; it remains a second defense for the migration that already experienced drift.

- [ ] **Step 7: Commit**

```bash
git add services/marketplace_service/migrations/business_os_immutable_manifest.txt scripts/ci/check_business_os_migration_immutability.py scripts/ci/test_business_os_migration_immutability.py .github/workflows/usaha-control-backend-gate.yml
git commit -m "chore: freeze Business OS migration baseline"
```

---

### Task 3: Introduce deterministic Business OS command hashing

**Files:**
- Create: `services/marketplace_service/src/businesses/kernel/mod.rs`
- Create: `services/marketplace_service/src/businesses/kernel/command.rs`
- Create: `services/marketplace_service/src/businesses/kernel/command_tests.rs`
- Modify: `services/marketplace_service/src/businesses/mod.rs`

**Interfaces:**
- Produces: `pub(crate) fn canonical_request_hash<T: Serialize>(value: &T) -> Result<String, serde_json::Error>`.
- Produces: `pub(crate) struct IdempotencyFingerprint { pub(crate) key: Uuid, pub(crate) request_hash: String }`.
- Hash contract: recursively sort JSON object keys, preserve array order, serialize compact JSON, SHA-256 lowercase hex.

- [ ] **Step 1: Write failing tests**

```rust
#[test]
fn canonical_hash_ignores_object_key_insertion_order() {
    let a = serde_json::json!({"business_id":"b", "amount":100, "meta":{"z":1,"a":2}});
    let b = serde_json::json!({"meta":{"a":2,"z":1}, "amount":100, "business_id":"b"});
    assert_eq!(canonical_request_hash(&a).unwrap(), canonical_request_hash(&b).unwrap());
}

#[test]
fn canonical_hash_preserves_array_order() {
    let a = serde_json::json!({"lines":[1,2]});
    let b = serde_json::json!({"lines":[2,1]});
    assert_ne!(canonical_request_hash(&a).unwrap(), canonical_request_hash(&b).unwrap());
}
```

- [ ] **Step 2: Verify RED**

```bash
cd services/marketplace_service
cargo test --locked businesses::kernel::command_tests -- --nocapture
```

Expected: compile/test failure because kernel/command does not exist.

- [ ] **Step 3: Implement deterministic canonicalization and SHA-256 hash**

Use `serde_json::Value` recursion and `BTreeMap`/sorted keys; do not hash debug output.

- [ ] **Step 4: Verify GREEN and full marketplace tests**

```bash
cargo test --locked businesses::kernel::command_tests -- --nocapture
cargo test --locked
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
```

- [ ] **Step 5: Commit**

```bash
git add services/marketplace_service/src/businesses/kernel services/marketplace_service/src/businesses/mod.rs
git commit -m "feat: add canonical Business OS command hashing"
```

---

### Task 4: Add shared tenant, money, and business-time primitives

**Files:**
- Create: `services/marketplace_service/src/businesses/kernel/scope.rs`
- Create: `services/marketplace_service/src/businesses/kernel/money.rs`
- Create: `services/marketplace_service/src/businesses/kernel/time.rs`
- Create: `services/marketplace_service/src/businesses/kernel/kernel_tests.rs`
- Modify: `services/marketplace_service/src/businesses/kernel/mod.rs`

**Interfaces:**
- `BusinessScope { organization_id: Uuid, business_id: Uuid, location_id: Option<Uuid> }`.
- `NonNegativeAmount::new(i64) -> Result<NonNegativeAmount, KernelValidationError>` and `.value() -> i64`.
- `PositiveAmount::new(i64) -> Result<PositiveAmount, KernelValidationError>` and `.value() -> i64`.
- `BusinessDateContext { timezone: chrono_tz::Tz }` with `local_date(DateTime<Utc>) -> NaiveDate`.

- [ ] **Step 1: Write failing tests**

```rust
#[test]
fn non_negative_amount_rejects_negative_values() {
    assert!(NonNegativeAmount::new(-1).is_err());
    assert_eq!(NonNegativeAmount::new(0).unwrap().value(), 0);
}

#[test]
fn positive_amount_rejects_zero() {
    assert!(PositiveAmount::new(0).is_err());
    assert_eq!(PositiveAmount::new(1).unwrap().value(), 1);
}

#[test]
fn business_date_uses_configured_timezone() {
    let ctx = BusinessDateContext::new("Asia/Jakarta").unwrap();
    let utc = chrono::DateTime::parse_from_rfc3339("2026-09-17T18:30:00Z").unwrap().with_timezone(&Utc);
    assert_eq!(ctx.local_date(utc).to_string(), "2026-09-18");
}
```

- [ ] **Step 2: Verify RED**

```bash
cd services/marketplace_service
cargo test --locked businesses::kernel::kernel_tests -- --nocapture
```

- [ ] **Step 3: Implement minimal primitives**

Do not migrate existing domain fields to these wrappers in Wave 0. These are shared contracts for new V4 code and later incremental adoption.

- [ ] **Step 4: Verify GREEN**

```bash
cargo test --locked businesses::kernel -- --nocapture
cargo test --locked
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
```

- [ ] **Step 5: Commit**

```bash
git add services/marketplace_service/src/businesses/kernel
git commit -m "feat: add Business OS kernel primitives"
```

---

### Task 5: Lock the Party migration direction without premature schema churn

**Files:**
- Create: `docs/architecture/business-os-party-migration.md`
- Modify: `docs/architecture/business-os-source-of-truth.md`

**Interfaces:**
- No runtime schema change in Wave 0.
- Defines the Wave 2 migration contract from `business_relationships` to normalized Party records.

- [ ] **Step 1: Document current-to-target mapping**

The document must explicitly map:

```text
business_relationships.party_user_id       -> party.identity_user_id when the relationship is backed by a Lajukan user
business_relationships.party_label         -> party.display_name for external/manual parties
business_relationships.external_reference  -> party_external_reference
relationship_type                          -> party_relationship.relationship_type
```

- [ ] **Step 2: Define non-inference rules**

State that migration must not infer legal owner, employee status, liability, payroll facts, or KYC facts beyond evidence already stored.

- [ ] **Step 3: Define uniqueness/deduplication rules**

Same Lajukan `user_id` within one organization maps to one person Party. External/manual contacts are not automatically merged solely by display name.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/business-os-party-migration.md docs/architecture/business-os-source-of-truth.md
git commit -m "docs: define Business OS party migration contract"
```

---

### Task 6: Verify Wave 0 as one coherent foundation

**Files:**
- No new production files unless verification exposes a defect.

**Interfaces:**
- Produces a green baseline for the Wave 1 Transaction Kernel plan.

- [ ] **Step 1: Run focused contracts**

```bash
python scripts/ci/check_usaha_persistence_boundary.py
python scripts/ci/check_business_os_migration_immutability.py
cd scripts/ci
python -m unittest -v test_usaha_persistence_boundary.py test_business_os_migration_immutability.py
```

- [ ] **Step 2: Run Marketplace quality gates**

```bash
cd services/marketplace_service
cargo fmt --check
cargo clippy --locked --all-targets -- -D warnings
cargo test --locked
```

- [ ] **Step 3: Run Usaha frontend gates**

```bash
cd frontend/packages
npm ci --legacy-peer-deps --include=dev --ignore-scripts --no-audit --no-fund
npm run build
cd ../apps/usaha
npm ci --legacy-peer-deps --include=optional --ignore-scripts --no-audit --no-fund
npm test
npm run typecheck
npm run build
```

- [ ] **Step 4: Require GitHub Actions green**

Required checks for the implementation PR:

```text
Quality Gates
Usaha Business OS Gate
Usaha Control Backend Gate
Security gates affected by the changed paths
```

- [ ] **Step 5: Merge/fast-forward to main only after green**

Do not force-update `main`. If `main` moved, rebase/reconcile and rerun checks.
