# Media Durability Hardening Design

Date: 2026-09-05
Status: Approved in chat; written-spec review pending

## Problem

Public content images intermittently appear on some devices while fresh devices receive HTTP 404 for URLs such as `/api/content/media/laju-chat/content/<uuid>.jpg`.

The browser lazy-loading notice is not the root cause: the media request reaches the public content-media route. The current route returns 503 when storage is unavailable/misconfigured, while a valid public media path returns 404 when the backing object cannot be retrieved. Current uploads write content objects to the configured MinIO bucket under `content/<uuid>.<ext>` and persist/return the proxy URL.

The production deployment contract currently validates application/API/chat health but does not validate the MinIO bucket, a known media object, storage continuity, or media recovery. MinIO data is held in a Compose named volume, so accidental Compose project/volume drift can make an existing object set invisible even though the application remains healthy.

A likely explanation for device-dependent behavior is that an older browser/CDN cache still contains bytes for an object that is missing from the current origin, while a fresh device must fetch the origin and receives 404. This is a hypothesis to verify operationally, not a license to overwrite storage blindly.

## Goals

1. Recover missing historical public content media when recoverable copies still exist on the production host.
2. Make the production MinIO data location explicit and stable across deployments.
3. Never report a new upload as successful until the object is verifiably retrievable from storage.
4. Make public media responses cache-correct and observable.
5. Prevent deployment from silently succeeding with broken storage/media connectivity.
6. Make missing/corrupt media degrade gracefully in the UI without hiding the operational failure.
7. Add repeatable diagnostics so future missing-media incidents can distinguish invalid URL, missing object, wrong bucket/volume, and unavailable storage.

## Non-goals

- Moving media to a new cloud provider.
- Making private chat or personal-AI media public.
- Rewriting marketplace/community data models.
- Blindly copying or deleting MinIO volumes.
- Fabricating replacement images for unrecoverable historical objects.

## Architecture

### 1. Stable production storage identity

The production Compose contract will use an explicit production MinIO volume identity rather than relying solely on a Compose-project-derived volume name. Existing installations must be migrated conservatively: deployment must not create an empty replacement and call it success when an existing populated volume is available.

The migration/recovery tooling will inventory candidate Docker volumes and MinIO object sets before mutation. Recovery is additive: copy only objects missing from the active bucket unless an explicit checksum-safe rule proves replacement is appropriate. Existing active objects are never blindly overwritten.

### 2. Upload durability contract

`uploadToMinIO` remains the single object-write primitive for www media. After `PutObject`, it will verify the written key with an S3 HEAD operation and validate expected non-zero size/content metadata before returning the URL. A failed verification means the upload fails; callers using `requireMinio: true` must not persist a successful media reference.

Bucket creation behavior must remain safe for development while production configuration errors must not silently create an unrelated empty bucket when the intended durable bucket is missing. Production should prefer fail-closed diagnostics over accidental empty-storage initialization.

### 3. Public media read contract

The content-media proxy remains restricted to public `content/` and `forum/` keys. Chat and personal-AI keys remain behind authenticated routes.

Add HEAD support sharing the same validation and storage lookup as GET. Successful GET/HEAD responses should expose storage metadata useful to clients/caches (Content-Type, Content-Length when known, ETag and Last-Modified when available) and immutable caching for UUID-addressed objects.

404 responses must not receive long-lived immutable caching. Storage connectivity/configuration failures remain 503 and must not masquerade as missing objects.

### 4. Diagnostics and recovery

Add an operator-facing script that can:

- identify the active MinIO container/volume and configured bucket;
- list candidate historical MinIO volumes on the host;
- count/list public `content/` and `forum/` objects;
- test explicitly supplied missing keys;
- produce a dry-run recovery plan;
- recover missing objects additively after explicit execution mode;
- report recovered, already-present, absent-everywhere, and failed keys.

The script must default to dry-run and must not delete source data.

The five concrete missing UUIDs reported in the incident can be supplied to this diagnostic, but must not be hard-coded into product logic.

### 5. Deployment health gate

Production deployment will validate MinIO/storage before writing the successful release marker. At minimum it must prove the configured bucket is reachable through the application/storage contract. Where a safe probe object can be used, the gate should verify write -> HEAD/read -> cleanup using a dedicated health prefix, without touching user objects.

A failed storage/media probe fails deployment and triggers the existing rollback behavior.

### 6. Frontend resilience and observability

Reusable public image surfaces should provide a deterministic visual fallback on image load failure rather than leaving broken-image chrome or empty layout. The fallback is not a substitute for recovery.

Media failures should emit bounded telemetry/logging containing the normalized media path/category and status class without leaking credentials, signed URLs, or private media identifiers. Repeated failures should be deduplicated/rate-limited client-side where appropriate.

### 7. Cache behavior

UUID object URLs are immutable only after successful retrieval. Successful object responses can retain long immutable caching. Error responses, especially 404/503, must be short/no-cache so a recovered object becomes visible quickly on fresh requests rather than being pinned as missing by an intermediary.

No cache-busting query parameter should be required for normal correctness.

## Recovery safety

Recovery order:

1. Inventory current production environment and candidate volumes.
2. Verify the active bucket/key counts without mutation.
3. Search candidate historical volumes for reported missing keys and broader missing public objects.
4. Produce a dry-run diff.
5. Copy only missing objects into active storage.
6. Verify every copied object with HEAD/read metadata.
7. Re-test public `/api/content/media/...` URLs.
8. Preserve historical source volumes until a separate retention decision; this wave does not delete them.

If historical objects do not exist anywhere accessible, report them as unrecoverable. Product data cleanup/re-upload is a separate explicit action.

## Testing

### Unit/route tests

- public media key allowlist still blocks chat/personal-AI paths;
- GET and HEAD accept the canonical content URL shape;
- invalid bucket/key returns 404;
- missing object returns 404 with non-immutable/no-store-or-short-cache policy;
- storage failure returns 503;
- successful response forwards type/length/ETag/Last-Modified and immutable cache policy;
- upload returns success only after post-PUT verification;
- verification mismatch/failure rejects upload.

### Contract tests

- Compose production volume identity is stable/explicit;
- deploy contains a storage/media health gate before the successful release marker;
- diagnostic script defaults to dry-run and contains no destructive deletion path.

### Regression gates

Run www lint/tests/build plus repository hygiene and Compose contract checks. Storage changes must not weaken private-media authorization.

## Rollout

1. Land code and diagnostics without deleting/mutating historical volumes.
2. Deploy hardened read/upload/deploy contracts.
3. Run production diagnostic in dry-run mode.
4. Review candidate recovery set.
5. Execute additive recovery.
6. Verify the reported 404 URLs and a representative sample from public listings on a cache-cold client.
7. Monitor media 404/503 telemetry.

## Success criteria

- Newly uploaded public images are retrievable immediately after upload and from a fresh device.
- Production cannot mark a release successful while its configured MinIO/media contract is broken.
- Reported historical 404 objects are restored when copies exist in historical storage.
- Missing objects that cannot be recovered are explicitly identified rather than masked.
- Public media 404/503 responses do not become long-lived immutable cache entries.
- Private chat/personal-AI media access boundaries remain unchanged.
