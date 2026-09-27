# Governed data bootstrap

The marketplace service startup synchronizes the source registry, recovers stale imports, queues approved persistent imports, resolves entities, and reconciles eligible reference publication candidates.

Reference records remain unowned and claimable. Source provenance and reuse policy are retained. A successful application build does not imply that a production database has already executed the bootstrap job.
## Local profile startup

The development launcher may start marketplace_service through `backoffice`, `edge`, `local-ai`, `kyc`, `devtools`, and `tunnel` profiles. Data bootstrap is owned by marketplace_service itself and is therefore independent of whether optional AI/KYC/tunnel services are enabled. Startup is idempotent: source jobs, imported records, entities, promotion candidates, and reference content use persistent identifiers/provenance guards to avoid duplicate publication.
