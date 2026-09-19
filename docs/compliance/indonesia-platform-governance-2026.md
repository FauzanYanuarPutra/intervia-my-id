# Lajukan — Indonesia Platform Governance Baseline (September 2026)

This is an engineering and operations baseline, not legal advice. Final PSE classification, contracts, privacy notice, retention schedule, and regulator-facing procedures must be reviewed with Indonesian counsel.

## 1. Product scope
Lajukan operates accounts, user-generated listings/content, chat and community interaction, news/editorial content, support, transactions, and internal CRM/CMS tooling. Governance therefore needs public reporting, moderation cases, audit evidence, appeals, privacy requests, security incidents, and staff access controls.

## 2. Canonical moderation flow
User/reporter -> public report endpoint -> normalized reason -> report receipt -> moderation case -> severity -> CRM queue -> assignment -> reviewer checks content, context, owner verification and history -> decision (action + reason + note + severity + legal hold) -> immutable evidence snapshot -> content visibility change -> uploader notification -> appeal -> different reviewer -> uphold/overturn/needs information -> close.

News uses a stricter editorial flow: draft -> submitted -> editorial review -> source/fact checks -> approve, revision, or reject -> publish -> correction/withdrawal history.

## 3. Content actions
Supported actions: approve, needs_revision, reject, restrict, remove, restore, escalate.
Content enforcement is separate from account enforcement. A moderator deciding that one listing violates policy does not automatically ban the user's account.

## 4. Report reason taxonomy
Canonical reasons: legal_violation, fraud_misleading, spam, irrelevant, unverifiable_information, copyright, prohibited_goods_services, sexual_pornographic, gambling, violence_threat, harassment_discrimination, privacy_personal_data, child_safety, impersonation, duplicate, quality, other.
For reject, restrict, remove, escalate, and needs_revision, a decision note is required. `other` always requires an explanation.

## 5. Severity
low = ordinary quality issue; medium = repeated spam or misleading content; high = fraud, privacy exposure, prohibited goods, serious sexual/violent content, or child-safety concern; critical = credible immediate safety risk or serious regulator/law-enforcement escalation. Severity is a triage level, not a legal conclusion.

## 6. Reporting
A report is not proof of guilt. The system keeps reporter, target, reason, details, timestamp, status, and case linkage; avoids duplicate active reports; creates or reuses a case; and gives the uploader a review notification.

## 7. Evidence and legal hold
Every decision should preserve case_id, content_id, actor_id, timestamp, action, reason_code, note, severity, previous/new status, content snapshot, legal_hold, and available request metadata. Moderation evidence events are append-only at the database layer.

## 8. Appeals
Owners can appeal eligible moderation decisions. The original reviewer cannot decide the appeal. Outcomes are upheld, overturned, or needs_information. An overturn creates a new evidence event and restores visibility when appropriate.

## 9. Data protection operations
Privacy requests are tracked as access, correction, export, deletion, withdraw_consent, restrict, or objection. Each request has a status, owner, due_at, evidence note, and completion timestamp.
Security incidents have severity, discovery time, notification_due_at, affected data classes, containment/remediation notes, legal_hold, and notification status.

## 10. Child-safety baseline
Lajukan currently uses an explicit 18+ product rule. Registration collects date of birth and backend validation rejects under-18 accounts. This is a product restriction; it is not a claim that Indonesian law universally requires all online services to be 18+.
If Lajukan later supports minors, implement age assurance, age-appropriate defaults, parent/guardian flows where required, child-safety risk assessment, and documented safety-by-design controls before opening access.

## 11. Backoffice access
CRM is the moderation/support control plane. CMS is the editorial control plane. WWW is the public submit/report/status/appeal surface. Identity is the authorization source of truth.
Roles: moderator, support, sales, content_admin, admin, super_admin. Super Admin is never granted through ordinary staff invitation.

## 12. Privacy and security deadlines
Where a statutory 3 x 24 hour deadline applies, the operational queue must track it separately from internal SLAs. The system should alert before due_at and preserve the evidence needed to demonstrate the response.

## 13. Pre-production legal/operations checklist
- Confirm the correct PSE registration scope and keep the registration information current.
- Publish Community Guidelines, Privacy Policy, Terms, report channel, appeal channel, and privacy/security contact channel.
- Finalize data retention/deletion schedules and legal-hold exceptions.
- Inventory processors/vendors and cross-border data flows.
- Perform privacy-impact assessment where the processing is high-risk.
- Confirm whether the product or any feature falls within child-protection age/risk classifications.
- Maintain regulator and law-enforcement request SOP.
- Periodically review CRM/CMS permissions.
- Test incident response, backup recovery, moderation appeal, and privacy request handling.