# Backup and Disaster Recovery

## Current evidence (2026-08-22)

- `D:\LAJUKAN\lajukan-backups` was initially empty. It now contains a filtered
  historical recovery set plus verified pre-merge and post-merge snapshots.
- Repository-local `.backups/` contains historical artifacts, including three
  PostgreSQL custom-format dumps from `2026-08-21`. Their catalogs can be read
  by `pg_restore --list`, but they have not yet passed a full isolated restore
  and application-invariant test.
- The historical set does not provide a complete, independently verified
  ScyllaDB and MinIO recovery point.
- `lajukan_dev_*` and older `intervia-my-id_*` Docker volumes coexist. The
  apparent data loss was therefore a project/volume namespace change, not
  evidence that the old volumes were erased.
- The repository and `D:\LAJUKAN\lajukan-backups` are on the same drive. This is
  useful as a fast local recovery copy, but it does not protect against disk,
  machine, ransomware, theft, or site failure.

No old dump should be restored over the active databases. Recovery uses a new
isolated target, validates it, and then performs an explicit merge/cutover.

## Recovery objectives

These are initial targets and should be tightened after production traffic and
storage growth are measured.

| Data owner | Source of truth | Target RPO | Target RTO |
| --- | --- | ---: | ---: |
| Identity | PostgreSQL | 5 minutes | 1 hour |
| Marketplace, wallet, payment | PostgreSQL | 1 minute | 30 minutes |
| Community | PostgreSQL + media | 15 minutes | 2 hours |
| Chat | ScyllaDB + MinIO media | 15 minutes | 4 hours |
| Search | Rebuildable projection | 24 hours | 4 hours |
| Cache | Rebuildable Redis state | none | 30 minutes |

RPO states the maximum tolerable data-loss window. RTO states the maximum
tolerable service-recovery window. A backup schedule is invalid when its
measured restore time cannot meet the RTO.

## Target protection model

Use a `3-2-1-1-0` policy for production data:

1. three copies, including the live copy;
2. two independent storage/media failure domains;
3. one offsite copy;
4. one immutable or offline copy;
5. zero unverified backup errors after automated integrity and restore checks.

The local external directory is the fast recovery tier. It must be paired with
an encrypted offsite object-storage repository whose retention/immutability
credentials are separate from application credentials.

## What is backed up

| Component | Protection | Restore rule |
| --- | --- | --- |
| Identity PostgreSQL | nightly logical custom dump; production base backup + continuous WAL archive | restore to isolated cluster, then validate identities/session invariants |
| Marketplace PostgreSQL | nightly logical custom dump; production base backup + continuous WAL archive | restore ledger and orders together; reconcile before opening writes |
| Community PostgreSQL | nightly logical custom dump; production base backup + continuous WAL archive | restore database before its media projection |
| ScyllaDB chat | ScyllaDB Manager schema + SSTable backup + manifest to independent object storage | restore schema first, then tables; verify room/message counts and sample reads |
| MinIO | versioning plus replication to a separate bucket/site | preserve versions and metadata; a plain `mc mirror` is only a current-state copy |
| Bind-mounted uploads | versioned encrypted file backup | restore after owning database and verify referenced objects |
| Meilisearch | settings/schema export where useful; no canonical business backup | rebuild from owning Postgres services/events |
| Redis | no canonical business backup | recreate; losing it must not lose durable business data |
| RabbitMQ | definitions/config and durable outbox/inbox data in owning Postgres | replay idempotently; do not treat broker queues as the only business record |
| Runtime configuration | sanitized manifest in backup; encrypted secrets in a separate secret-backup system | restore by environment and rotate credentials after a disaster |
| Logs/audit | centralized append-only retention with access control | restore only for incident/compliance analysis, not application state |

PostgreSQL logical dumps remain useful for inspection and selective migration,
but production PITR requires base backups plus an uninterrupted WAL archive.
PostgreSQL configuration files are protected separately because WAL recovery
does not restore them.

## Backup-set contract

Every recovery point is a timestamped directory or object prefix containing:

```text
manifest.json
checksums.sha256
postgres/identity.dump
postgres/marketplace.dump
postgres/community.dump
scylla/{schema,manifest,sstables-or-reference}/
object-storage/inventory.json
uploads/...
metadata/migration-hashes.json
metadata/row-counts.json
metadata/image-digests.json
```

The manifest records environment, UTC timestamp, repository commit, Compose
project name, database/server versions, migration heads, image digests, dump
format, sizes, retention class, and verification results. It contains names and
hashes, never passwords, tokens, OAuth secrets, or full connection strings.

Required automated checks:

- every expected artifact exists and is non-empty;
- SHA-256 checksums match after copying offsite;
- each PostgreSQL dump passes `pg_restore --list`;
- Scylla schema, data manifest, and snapshot tag belong to the same run;
- object count/bytes are reconciled against the source inventory;
- backup age is within RPO and failed jobs alert an operator;
- the newest eligible set is restored into disposable infrastructure and its
  application invariants pass.

## Community media volume snapshots

Until Community uploads move to shared object storage, the production
`community_uploads` Docker volume remains canonical media state for forum
uploads. Production deploys pin that volume identity and refuse a silent switch
to an empty replacement.

Operators can create and verify a local snapshot with:

```bash
BACKUP_ROOT=/path/to/backup-root scripts/ops/community_media_backup.sh
scripts/ops/verify_community_media_backup.sh /path/to/backup-root/<timestamp>
```

The backup records a SHA-256 checksum, source volume, file count and source byte
count, and verifies that the gzip/tar archive is readable. The resulting
snapshot must still be copied to the encrypted offsite/immutable tier; a
same-host archive is not disaster recovery.

This snapshot mechanism is transitional. Multi-host production requires
Community media to move to shared/replicated object storage (or an equivalently
tested shared filesystem) before Community can be considered multi-host safe.

## Schedule and retention

Initial production policy:

- PostgreSQL WAL: continuous, shipped off-host; retain enough WAL to cover all
  retained base backups;
- PostgreSQL base backup: daily, 14 daily + 8 weekly + 12 monthly;
- PostgreSQL logical dump: nightly and immediately before risky migrations,
  14 daily + 8 weekly + 12 monthly;
- ScyllaDB: daily incremental/deduplicated Manager backup, 14 daily + 8 weekly
  + 12 monthly;
- MinIO: continuous cross-site replication/versioning, lifecycle aligned with
  legal/product retention;
- uploads/config/log archives: daily, with separate log/privacy retention;
- restore drill: automated daily smoke restore, monthly full service restore,
  quarterly disaster/cutover exercise.

Development can use daily logical dumps and weekly isolated restores. It still
must not rely solely on Docker volumes.

## Safe migration gate

Before any destructive or contract migration:

1. inventory live tables, row counts, important sums, object counts, and current
   migration heads;
2. create a named pre-migration recovery point and copy it off-host;
3. verify checksums and restore it into an isolated target;
4. use expand -> backfill -> verify -> switch -> observe -> contract;
5. keep old columns/tables and the recovery point through the rollback window;
6. compare counts and domain invariants, especially wallet balances, ledger
   totals, order ownership, identity uniqueness, and media references;
7. only contract old schema in a later versioned migration.

`docker compose down -v`, volume pruning, and blind dump import are never part
of an ordinary migration workflow.

## Recovery of the currently missing historical data

1. Freeze the historical dump/volume inventory and calculate checksums.
2. Copy the verified artifacts to the external fast-recovery tier and then to
   encrypted offsite storage.
3. Restore each old PostgreSQL dump into new temporary databases, never the
   active service databases.
4. compare old/new schemas and build explicit per-domain mapping tables;
5. merge using idempotent scripts with stable legacy IDs and conflict reports;
6. reconcile row counts and business invariants;
7. switch reads only after application smoke tests; keep the old volumes
   read-only until the rollback window ends.

This is a data migration, not a Docker-volume rename.

### Recovery execution record (2026-08-22)

- The historical PostgreSQL dumps passed catalog checks and full isolated
  restores: Identity 17 tables, Marketplace 94 tables, Community 19 tables.
- A pre-merge snapshot was created before active data changed.
- Four identity users, profiles, identities, and roles were restored. Role IDs
  were translated by stable role name because seed UUIDs differed. Historical
  sessions and outbox state were deliberately excluded.
- Marketplace business data was restored with category, subcategory, and
  industry IDs translated by stable slug. Pending automation jobs and broker
  inbox/outbox state were excluded.
- Community forum, reels, and uploads were restored. One historical reel action
  with a null `reel_id` was quarantined because the current invariant requires
  a reel. It remains in the historical dump and reconciliation report.
- Table reconciliation passed for 5 Identity, 17 Marketplace, and 9 Community
  tables. Application smoke probes returned content, forum threads, reels, and
  the UMKM store.
- A post-merge snapshot was created and its PostgreSQL catalogs were verified.

The local recovery directory remains a same-drive copy. It still needs an
encrypted offsite and immutable tier before it meets the target policy.

## Logs, monitoring, and ownership

Applications keep logging to stdout/stderr. A collector ships structured logs
to centralized storage with request/correlation IDs, redaction, access control,
and retention. Backing up raw Docker JSON log files is not the observability
strategy.

Alerts are required for backup failure, stale recovery point, WAL archive lag,
checksum mismatch, offsite-copy failure, immutable-retention failure, restore
test failure, and RTO regression. A named operator owns each alert and quarterly
drill evidence.

## References

- PostgreSQL continuous archiving and PITR:
  https://www.postgresql.org/docs/17/continuous-archiving.html
- ScyllaDB Manager backup and restore:
  https://manager.docs.scylladb.com/stable/backup/
  and https://manager.docs.scylladb.com/stable/sctool/restore.html
- MinIO mirror semantics and its version-history limitation:
  https://min.io/docs/minio/linux/reference/minio-mc/mc-mirror.html
- NIST contingency planning and offsite recovery guidance:
  https://csrc.nist.gov/topics/security-and-privacy/security-programs-and-operations/contingency-planning


## Executable PostgreSQL logical backup tier

The repository includes a non-destructive logical backup helper for the three
owned PostgreSQL databases. It deliberately refuses to write inside the Git
working tree and validates every custom-format dump with `pg_restore --list`
before the set is declared complete.

Example on a production host:

```bash
compose=(
  --env-file .env.production
  -f docker-compose.yml
  -f docker-compose.prod.yml
  -f docker-compose.observability.yml
)

ENV=production bash scripts/ops/postgres_logical_backup.sh \
  /var/backups/lajukan "${compose[@]}"
```

The command creates a timestamped backup set containing `manifest.json`,
`checksums.sha256`, three PostgreSQL custom-format dumps, migration heads and
the repository commit. It contains no application secrets by design.

Verify an existing set without restoring into the live databases:

```bash
bash scripts/ops/verify_backup_set.sh \
  /var/backups/lajukan/lajukan-YYYYMMDDTHHMMSSZ "${compose[@]}"
```

The catalog/checksum helper is only the logical/inspection recovery tier. For a
full disposable logical restore rehearsal, run:

```bash
bash scripts/ops/postgres_isolated_restore_drill.sh \
  /var/backups/lajukan/lajukan-YYYYMMDDTHHMMSSZ
```

The restore drill creates a temporary PostgreSQL 16 container and named volume
without publishing a host port, verifies the backup checksums, restores Identity,
Marketplace and Community with `pg_restore --exit-on-error`, verifies that each
restored database contains user tables, performs a schema-only re-dump, and then
removes the temporary container and volume. Set `KEEP_RESTORE_DRILL=1` only when
an operator intentionally needs to inspect the isolated result.

This closes the gap between "the dump catalog is readable" and "PostgreSQL can
actually restore the dump". It still does not replace application-invariant
validation, off-host immutable copies, production PITR/WAL recovery, Scylla
recovery or object-storage recovery drills.
