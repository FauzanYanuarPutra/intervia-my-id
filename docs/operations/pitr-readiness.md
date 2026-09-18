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
