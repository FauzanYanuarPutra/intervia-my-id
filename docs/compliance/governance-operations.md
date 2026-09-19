# Lajukan Governance Operations

This document describes the operational controls behind privacy requests and security incidents.

## Privacy requests

Users create a request through the authenticated identity service. The request receives a stable ID, an internal due date, verification-required state, and an immutable governance audit trail.

Operational states:

`open → in_review → waiting_user → completed/rejected/cancelled`

The internal SLA is configurable with `PRIVACY_INTERNAL_SLA_DAYS` (default 30 days). This is an internal operating target, not a statement of statutory timing.

Staff access is permission-gated:

- `privacy:request:read`
- `privacy:request:manage`

Users can only see their own requests. Staff queues are ordered by active state and due date.

## Security incidents

Incidents carry severity, affected data classes, affected-user count, owner, notification target dates, containment/remediation timestamps, notification state, and legal-hold state.

Operational states:

`open → contained → investigating → remediated → closed`

High and critical incidents receive a default internal notification target of 72 hours unless an explicit target is supplied. This is an internal escalation target; applicable legal timelines must still be assessed per incident and jurisdiction.

Staff access is permission-gated:

- `security:incident:read`
- `security:incident:manage`

## Audit integrity

Governance transitions write to `core.governance_audit_events`. The table is append-only at the database layer: UPDATE and DELETE operations are rejected by a trigger.

Do not store secrets, raw credentials, authentication tokens, or unnecessary personal data in governance notes or metadata.

## Release checklist

Before production rollout, verify:

1. The new migration is applied.
2. Identity service readiness succeeds.
3. Governance endpoints are protected by the expected role/permission checks.
4. A test privacy request can be created and transitioned.
5. A test security incident can be created and transitioned.
6. Audit records are created and cannot be modified.
7. Monitoring covers overdue privacy requests and security incidents approaching their internal notification target.
