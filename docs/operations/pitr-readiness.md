# PostgreSQL PITR readiness

Lajukan's recovery target requires PostgreSQL base backups plus continuous WAL
archiving for production databases. Repository documentation alone is not proof
that PITR is active.

The executable database-side preflight is:

```bash
DATABASE_URL='postgres://...' scripts/ops/postgres_pitr_preflight.sh
```

It fails unless:

- `wal_level` supports replication;
- `archive_mode` is enabled;
- `archive_command` is non-empty and not an obvious no-op;
- WAL senders are available.

Passing this preflight proves only the database-side prerequisites; it does not prove
that WAL reaches independent storage, that retention covers the desired
RPO, or that a timestamp restore succeeds.

Production PITR is considered **verified** only when all of these have evidence:

1. a base backup exists outside the database host;
2. continuous WAL is delivered to an independent failure domain;
3. the archive has freshness monitoring and alerts;
4. a disposable cluster has been restored to a requested timestamp;
5. application invariants pass on the restored databases;
6. measured restore time meets the service RTO.

Logical dumps and the existing isolated logical-restore drill remain useful,
but they are a separate recovery layer and do not substitute for PITR.


## Executable base-backup and target-time drill

The repository now includes two explicit PITR recovery tools:

```bash
DATABASE_URL='postgres://...' \
BACKUP_ROOT=/secure/offhost/postgres \
scripts/ops/postgres_pitr_basebackup.sh
```

This creates a streamed-WAL `pg_basebackup` recovery set with SHA-256 checksums
and a manifest containing backup timestamps and LSN boundaries.

A disposable target-time restore can then be exercised with:

```bash
BASE_BACKUP_DIR=/secure/offhost/postgres/<timestamp> \
WAL_ARCHIVE_DIR=/secure/offhost/wal \
RECOVERY_TARGET_TIME='2026-09-19 00:00:00+00' \
PITR_ASSERT_SQL='SELECT 1' \
scripts/ops/postgres_pitr_restore_drill.sh
```

The Reliability Contract runs `scripts/ci/test_postgres_pitr_drill.sh`. That test
starts an isolated PostgreSQL instance with continuous WAL archiving, writes a
row before the recovery target and another after it, takes a base backup, forces
WAL archival, restores to the requested timestamp, and fails unless the
pre-target row exists while the post-target row does not.

This CI drill proves the repository recovery mechanics. It **does not prove**
that production WAL is currently reaching independent storage, that production
retention satisfies the RPO, or that production-sized restores satisfy the RTO.
Those remain operational evidence requirements.
