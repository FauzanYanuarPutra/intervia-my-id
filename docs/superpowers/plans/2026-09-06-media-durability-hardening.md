# Media Durability Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make public Lajukan media durable across deployments, verify new MinIO writes before returning success, recover historical public objects safely when possible, and ensure broken origin media cannot be hidden by cache or weak deployment health checks.

**Architecture:** Keep MinIO as the canonical object store and keep public media behind the existing `/api/content/media/{bucket}/{key}` proxy. Introduce focused storage helpers so upload verification and GET/HEAD reads share metadata rules, make production volume identity explicit, add non-destructive operator diagnostics/recovery, and add bounded client fallback/telemetry without weakening private-media authorization.

**Tech Stack:** Next.js 16 route handlers, TypeScript, AWS SDK S3 client (`@aws-sdk/client-s3`), Docker Compose, GitHub Actions deployment shell, Bash/Python operator tooling, Vitest.

**Spec:** `docs/superpowers/specs/2026-09-05-media-durability-hardening-design.md`

## Global Constraints

- MinIO remains the canonical object store; do not migrate providers in this wave.
- Public proxy access remains limited to `content/` and `forum/` object keys.
- Chat and personal-AI media authorization boundaries must not change.
- Recovery is additive only; do not delete historical volumes and do not overwrite healthy active objects blindly.
- Public successful UUID-addressed media responses may be immutable; 404/503 responses must not be immutable or long-lived.
- Production storage misconfiguration must fail closed rather than silently creating unrelated empty storage.
- Upload endpoints using `requireMinio: true` must not return a successful media URL until the written object passes post-PUT verification.
- Operator recovery defaults to dry-run.
- No hard-coded incident UUIDs in product logic.
- Run www lint/tests/build, repository hygiene, and Compose contract checks before completion.

---

### Task 1: Extract the public MinIO object-read contract

**Files:**
- Create: `frontend/apps/www/src/lib/server/publicMediaStorage.ts`
- Create: `frontend/apps/www/src/lib/server/publicMediaStorage.test.ts`
- Modify: `frontend/apps/www/src/app/api/content/media/[...path]/route.ts`

**Interfaces:**
- Consumes: existing MinIO environment variables and `isPublicContentMediaKey(key: string): boolean`.
- Produces: `parsePublicMediaPath(pathSegments: string[]): { bucket: string; key: string } | null`, `getPublicMediaObject(bucket: string, key: string): Promise<PublicMediaObjectResult>`, and `publicMediaResponseHeaders(...)` shared by GET/HEAD.

- [ ] **Step 1: Write failing helper tests**

Create tests covering canonical `['laju-chat','content','abc.jpg']`, rejection of `chat/` and `personal-ai/`, invalid segments, missing-object classification, and storage-failure classification. Mock S3 calls at the helper boundary rather than relying on a live MinIO instance.

- [ ] **Step 2: Run focused test to verify RED**

Run:
```bash
cd frontend/apps/www
npm test -- --run src/lib/server/publicMediaStorage.test.ts
```
Expected: FAIL because `publicMediaStorage.ts` and exported functions do not exist.

- [ ] **Step 3: Implement the minimal storage helper**

The helper must:
```ts
export type PublicMediaMetadata = {
  contentType: string;
  contentLength?: number;
  etag?: string;
  lastModified?: Date;
};

export type PublicMediaObjectResult =
  | { kind: 'found'; body?: Uint8Array; metadata: PublicMediaMetadata }
  | { kind: 'missing' }
  | { kind: 'unavailable'; reason: string };
```
It must validate configured bucket, safe segments, and `isPublicContentMediaKey`. It must classify S3 `NoSuchKey`/404 as `missing` and non-404 SDK/storage failures as `unavailable`.

- [ ] **Step 4: Refactor GET route to use helper without changing behavior yet**

Keep current security checks and response body semantics while routing all object lookup through the helper. Do not add HEAD until Task 3.

- [ ] **Step 5: Run focused tests and existing public-media tests**

Run:
```bash
cd frontend/apps/www
npm test -- --run src/lib/server/publicMediaStorage.test.ts src/lib/server/publicMediaKey.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/www/src/lib/server/publicMediaStorage.ts \
        frontend/apps/www/src/lib/server/publicMediaStorage.test.ts \
        'frontend/apps/www/src/app/api/content/media/[...path]/route.ts'
git commit -m "refactor: centralize public media storage reads"
```

### Task 2: Enforce post-PUT durability verification

**Files:**
- Modify: `frontend/apps/www/src/lib/minio.ts`
- Create: `frontend/apps/www/src/lib/minio.test.ts` if no existing dedicated test file is present; otherwise extend the existing MinIO test file.
- Modify: `frontend/apps/www/src/lib/server/uploadFiles.test.ts` only if existing upload tests need contract coverage.

**Interfaces:**
- Consumes: `uploadToMinIO(roomId, buffer, mime, originalName)`.
- Produces: the same public function signature, but it returns only after a successful `HeadObjectCommand` verifies the key exists and has expected non-zero content length.

- [ ] **Step 1: Write failing tests for PUT -> HEAD ordering**

Test that `PutObjectCommand` is followed by `HeadObjectCommand` for the exact same bucket/key, that non-zero `ContentLength` succeeds, and that HEAD missing/zero-length/failure rejects the upload.

- [ ] **Step 2: Run the focused MinIO tests to verify RED**

Run:
```bash
cd frontend/apps/www
npm test -- --run src/lib/minio.test.ts
```
Expected: FAIL because upload currently returns immediately after PUT.

- [ ] **Step 3: Implement HEAD verification**

Add `HeadObjectCommand` to `minio.ts`. After PUT:
```ts
const verified = await client.send(
  new HeadObjectCommand({ Bucket: bucket, Key: key }),
);
if (!verified.ContentLength || Number(verified.ContentLength) <= 0) {
  throw new Error('MinIO object verification failed');
}
```
Preserve the returned URL/key format.

- [ ] **Step 4: Harden production bucket initialization**

Do not silently `CreateBucket` in production when the configured bucket is missing. In production, `HeadBucket` failure for a missing intended bucket must surface as an error; development/test may retain create-on-demand behavior.

- [ ] **Step 5: Run focused and upload regression tests**

Run:
```bash
cd frontend/apps/www
npm test -- --run src/lib/minio.test.ts src/lib/server/uploadFiles.test.ts
```
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/www/src/lib/minio.ts frontend/apps/www/src/lib/minio.test.ts frontend/apps/www/src/lib/server/uploadFiles.test.ts
git commit -m "fix: verify MinIO uploads before success"
```

### Task 3: Make public media GET/HEAD cache-correct and metadata-aware

**Files:**
- Modify: `frontend/apps/www/src/app/api/content/media/[...path]/route.ts`
- Create: `frontend/apps/www/src/app/api/content/media/[...path]/route.test.ts`

**Interfaces:**
- Consumes: `parsePublicMediaPath` and `getPublicMediaObject` from Task 1.
- Produces: `GET` and `HEAD` handlers with identical validation/storage classification.

- [ ] **Step 1: Write failing route tests**

Cover:
```text
GET found -> 200 + Content-Type + Content-Length + ETag + Last-Modified + immutable cache
HEAD found -> 200 + same metadata headers + empty body
missing -> 404 + Cache-Control: no-store (or short max-age <= 60)
storage unavailable -> 503 + Cache-Control: no-store
invalid/private key -> 404 + no-store
```

- [ ] **Step 2: Run route test to verify RED**

Run:
```bash
cd frontend/apps/www
npm test -- --run 'src/app/api/content/media/[...path]/route.test.ts'
```
Expected: FAIL because HEAD and error cache headers are missing.

- [ ] **Step 3: Implement shared GET/HEAD response path**

Successful responses must set available metadata headers and preserve immutable success caching. Error responses must explicitly set `Cache-Control: no-store` so recovered objects are visible immediately after origin repair.

- [ ] **Step 4: Run route tests**

Run the same command; expected PASS.

- [ ] **Step 5: Commit**

```bash
git add 'frontend/apps/www/src/app/api/content/media/[...path]/route.ts' \
        'frontend/apps/www/src/app/api/content/media/[...path]/route.test.ts'
git commit -m "fix: harden public media read contract"
```

### Task 4: Give production MinIO an explicit durable volume identity

**Files:**
- Modify: `docker-compose.yml`
- Modify: `docker-compose.prod.yml`
- Modify: `.env.production.example`
- Modify: `scripts/ci/check_compose_contract.py` if Compose contract validation already lives there; otherwise extend the nearest existing Compose contract script used by CI.

**Interfaces:**
- Consumes: existing `minio` service and named volume declaration.
- Produces: stable external/explicit production volume name controlled by `MINIO_DATA_VOLUME`, defaulting to `lajukan_minio_data` in production examples.

- [ ] **Step 1: Write/update Compose contract assertion first**

The contract must fail if production MinIO storage resolves only to a Compose-project-derived anonymous name. Assert that the production overlay maps MinIO data to an explicit name/env-controlled volume and does not remove `/data` persistence.

- [ ] **Step 2: Run Compose contract to verify RED**

Run the repository's existing Compose contract command (from Quality Gates) and confirm the new assertion fails on current configuration.

- [ ] **Step 3: Implement stable volume naming**

Use a top-level volume entry such as:
```yaml
volumes:
  minio_data:
    name: ${MINIO_DATA_VOLUME:-lajukan_minio_data}
```
Ensure development remains usable and production `.env.production.example` documents `MINIO_DATA_VOLUME=lajukan_minio_data`.

- [ ] **Step 4: Re-run Compose contract**

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add docker-compose.yml docker-compose.prod.yml .env.production.example scripts/ci
git commit -m "fix: stabilize production MinIO volume identity"
```

### Task 5: Add non-destructive MinIO inventory and recovery tooling

**Files:**
- Create: `scripts/ops/minio_media_recovery.sh`
- Create: `scripts/ops/test_minio_media_recovery.py`
- Modify: `docs/runbooks/media-durability.md`

**Interfaces:**
- Consumes: Docker CLI, current Compose project, MinIO `mc` available inside/alongside MinIO container, optional `--key content/<uuid>.jpg` arguments.
- Produces: dry-run inventory/report by default; explicit `--execute` performs additive copy of missing public objects only.

- [ ] **Step 1: Write contract tests for the script**

Tests must assert:
- default mode is dry-run;
- no `docker volume rm`, `mc rm`, or destructive source deletion command exists;
- only `content/` and `forum/` prefixes are eligible;
- execution requires explicit `--execute`;
- active objects are skipped rather than overwritten;
- output categories include `RECOVERED`, `ALREADY_PRESENT`, `ABSENT_EVERYWHERE`, `FAILED`.

- [ ] **Step 2: Run script contract test to verify RED**

Run:
```bash
python scripts/ops/test_minio_media_recovery.py
```
Expected: FAIL because the script does not exist.

- [ ] **Step 3: Implement inventory/dry-run flow**

The script must determine active MinIO container/volume, enumerate Docker volumes whose mount data contains MinIO layout candidates, and use temporary read-only mounts/MinIO-compatible access where possible. It must print the planned source -> active key copy without mutation by default.

- [ ] **Step 4: Implement additive execution mode**

`--execute` may copy only keys confirmed absent in the active bucket. After each copy, verify the destination key exists before counting it as recovered. Never delete source volume/object data.

- [ ] **Step 5: Document incident usage**

Runbook example:
```bash
./scripts/ops/minio_media_recovery.sh \
  --key content/bbb81f5a-13cc-4635-8dc4-718324cc4a27.jpg \
  --key content/26586b23-afc5-472e-b411-9b12b4d753a8.jpg
```
Then show explicit `--execute` as a separate reviewed action.

- [ ] **Step 6: Run script contract tests**

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add scripts/ops/minio_media_recovery.sh scripts/ops/test_minio_media_recovery.py docs/runbooks/media-durability.md
git commit -m "feat: add safe MinIO media recovery tooling"
```

### Task 6: Add deployment storage/media health gate

**Files:**
- Modify: `.github/workflows/deploy.yml`
- Create: `scripts/ops/minio_storage_probe.sh`
- Create: `scripts/ops/test_minio_storage_probe.py`

**Interfaces:**
- Consumes: server-managed production env and running MinIO/www containers after Compose `up`.
- Produces: a probe that validates bucket reachability and write -> HEAD/read -> cleanup under a reserved `_health/` prefix before release marker creation.

- [ ] **Step 1: Write probe contract tests**

Assert the probe uses only `_health/` keys, performs write and verification before cleanup, exits non-zero on any failure, and never touches `content/`, `forum/`, `chat/`, or `personal-ai/` user objects.

- [ ] **Step 2: Run probe test to verify RED**

Run:
```bash
python scripts/ops/test_minio_storage_probe.py
```
Expected: FAIL because the probe does not exist.

- [ ] **Step 3: Implement the storage probe**

Use the existing MinIO container credentials/config from the deployment environment. Generate a unique `_health/<timestamp>-<random>` object, put known bytes, stat/HEAD it, read/compare bytes, then remove only that exact health object.

- [ ] **Step 4: Insert probe before successful release marker**

In `.github/workflows/deploy.yml`, invoke the probe after Compose health is up and before:
```bash
printf '%s\n' "$IMAGE_TAG" > "$release_marker"
```
Any probe failure must flow into the existing rollback trap.

- [ ] **Step 5: Run contract tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/deploy.yml scripts/ops/minio_storage_probe.sh scripts/ops/test_minio_storage_probe.py
git commit -m "ci: gate deploys on durable media storage"
```

### Task 7: Add bounded public-image fallback and telemetry

**Files:**
- Create: `frontend/apps/www/src/components/media/PublicMediaImage.tsx`
- Create: `frontend/apps/www/src/components/media/PublicMediaImage.test.tsx`
- Modify: public listing/detail image components that currently render raw public content URLs directly, starting with `frontend/apps/www/src/components/explore/cards/ExploreListingCard.tsx` and any shared detail-image component identified by code search.

**Interfaces:**
- Consumes: standard image props and a public `/api/content/media/...` source.
- Produces: deterministic fallback UI after `onError`, with deduplicated client telemetry for public-media failures only.

- [ ] **Step 1: Write failing component tests**

Test normal render, `onError` fallback, accessible alt behavior, and single telemetry emission for repeated error events on the same normalized source.

- [ ] **Step 2: Run component test to verify RED**

Run:
```bash
cd frontend/apps/www
npm test -- --run src/components/media/PublicMediaImage.test.tsx
```
Expected: FAIL because component does not exist.

- [ ] **Step 3: Implement the wrapper**

Do not retry forever or append cache-busting query strings. On error, show a neutral media placeholder that preserves layout. Telemetry must normalize to public path/category and must not include credentials, signed query strings, or private media IDs.

- [ ] **Step 4: Replace raw public-media image usage in shared public surfaces**

Only migrate public listing/detail surfaces touched by content URLs. Do not route private chat/personal-AI media through this public wrapper.

- [ ] **Step 5: Run component and relevant Explore/detail tests**

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/apps/www/src/components/media/PublicMediaImage.tsx \
        frontend/apps/www/src/components/media/PublicMediaImage.test.tsx \
        frontend/apps/www/src/components/explore/cards/ExploreListingCard.tsx
git commit -m "fix: make public media failures graceful"
```

### Task 8: Full verification and PR

**Files:**
- Review all files changed above.
- Update: `docs/runbooks/media-durability.md` only if verification uncovers operator caveats.

**Interfaces:**
- Produces: reviewable PR with fresh evidence and no temporary workflow/helper artifacts.

- [ ] **Step 1: Run frontend gates**

```bash
cd frontend/apps/www
npm run lint
npm test -- --run
npm run build
```
Expected: all PASS.

- [ ] **Step 2: Run repository and Compose gates**

Run the exact repository hygiene and Compose contract commands used by `.github/workflows/quality.yml`.

- [ ] **Step 3: Run operator-tool contract tests**

```bash
python scripts/ops/test_minio_media_recovery.py
python scripts/ops/test_minio_storage_probe.py
```
Expected: PASS.

- [ ] **Step 4: Inspect branch diff for security boundaries**

Confirm no public route accepts `chat/` or `personal-ai/`; no destructive recovery command exists; production upload verification cannot be bypassed by a success response.

- [ ] **Step 5: Open PR**

Title:
```text
fix: harden public media durability and recovery
```
PR body must summarize root cause evidence, durability changes, recovery safety, and exact CI evidence. Do not claim historical media recovered until the production dry-run/execute tool actually proves it.

- [ ] **Step 6: Merge only after fresh CI evidence is reviewed**

Use the verified head SHA when merging. If unrelated pre-existing red gates remain, report them precisely and do not call the whole repository green.
