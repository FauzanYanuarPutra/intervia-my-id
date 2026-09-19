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

## Archive-path evidence

After the prerequisites pass, inspect actual PostgreSQL archiver evidence:

```bash
DATABASE_URL='postgres://...' scripts/ops/postgres_pitr_archive_evidence.sh
```

For an approved active probe on the primary, force one WAL switch and wait for
PostgreSQL to report a successful archive completion:

```bash
DATABASE_URL='postgres://...' \
FORCE_WAL_SWITCH=I_UNDERSTAND_WAL_SWITCH \
ARCHIVE_WAIT_SECONDS=60 \
scripts/ops/postgres_pitr_archive_evidence.sh
```

The active probe refuses to run against a standby, fails when the latest archive
attempt is a failure, and requires `archived_count` to advance after the WAL
switch. This proves that PostgreSQL's configured archive command completed for
the probe. It still does **not** prove that the destination is an independent
failure domain, that retention is sufficient, or that a timestamp restore is
correct; those remain restore-drill requirements.

Production PITR is considered **verified** only when all of these have evidence:

1. a base backup exists outside the database host;
2. continuous WAL is delivered to an independent failure domain;
3. the archive has freshness monitoring and alerts;
4. a disposable cluster has been restored to a requested timestamp;
5. application invariants pass on the restored databases;
6. measured restore time meets the service RTO.

Logical dumps and the existing isolated logical-restore drill remain useful,
but they are a separate recovery layer and do not substitute for PITR.
