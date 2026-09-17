# Incident Response

Status: operational baseline, 2026-09-18.

The first objective during an incident is to preserve correctness and restore a
known-safe service state. Root-cause work follows once the blast radius is
contained.

## Severity

| Severity | Example | Response goal |
| --- | --- | --- |
| SEV-1 | widespread outage, data-integrity risk, auth/security compromise, financial corruption risk | immediate containment and recovery |
| SEV-2 | major feature unavailable or severe latency for a material population | rapid mitigation and controlled recovery |
| SEV-3 | degraded non-critical capability with a safe workaround | normal engineering response |

## Initial response

1. Name one incident lead and one communication owner when more than one person is responding.
2. Record UTC start time, first symptom, affected journeys and current release SHA.
3. Freeze unrelated deployments.
4. Check edge availability, host health, service readiness, database health, queue depth and recent deploy/migration changes.
5. Protect correctness first. Disable optional AI/recommendation/background work before weakening auth, authorization or transaction guarantees.
6. Prefer rollback to the last successful immutable image tag when a new release is the likely cause.
7. Preserve logs, metrics and database evidence needed for reconciliation.

## Failure-specific actions

### Application replica failure

Remove the unhealthy replica from routing. Do not restart-loop indefinitely
without checking memory pressure, dependency failure and crash evidence.

### Host failure

Traffic must move to another healthy host once multi-node production exists.
Until then, treat a production-host failure as SEV-1 and recover from the
documented server/backup procedure.

### PostgreSQL

Stop risky writes if integrity is uncertain. Determine whether the failure is
connectivity, saturation, lock contention, storage, primary failure or
corruption before promotion/restore.

Never restore an old dump over the active database during incident triage.
Follow the isolated recovery and reconciliation rules in
`backup-and-disaster-recovery.md`.

### Redis

Because Redis is non-canonical, prefer degraded cache/coordination behavior.
Do not restore business truth from Redis.

### RabbitMQ

Do not invent missing events from memory. Canonical writes plus transactional
outbox are the recovery source where implemented. Restore broker availability
then replay idempotently.

### Meilisearch

Treat it as a projection. Disable/degrade search features if necessary, restore
the service and rebuild from canonical data.

### Object storage

Prevent writes that would create dangling database references if object
persistence is unavailable. Use versioned/replicated recovery procedures and
reconcile references after recovery.

### Payment provider

Do not mark ambiguous provider timeouts as success or failure without evidence.
Preserve provider IDs/idempotency keys and reconcile.

## Recovery validation

Before declaring recovery, verify the user journeys that failed plus their
canonical invariants. A green process health check alone is insufficient.

For financial changes reconcile balances, ledger sums, order state transitions,
provider references and duplicate processing.

For media reconcile object existence with database references.

For event-driven changes verify outbox backlog decreases and consumers do not
create duplicate business effects.

## Communication record

Keep an incident timeline containing observations, actions, commands/queries
that materially changed state, release identifiers and validation evidence.
Do not paste secrets, authorization tokens, raw identity documents or sensitive
user payloads into the incident record.

## Post-incident

A SEV-1 or repeated SEV-2 requires a short post-incident review covering:

- initiating condition;
- why detection did or did not work;
- blast radius;
- recovery path;
- data reconciliation result;
- missing guardrail;
- concrete prevention/detection work with an owner.

Prefer systemic guardrails over instructions that depend on remembering a
manual step.
