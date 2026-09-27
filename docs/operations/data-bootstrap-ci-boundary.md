# Data bootstrap and CI verification boundary

A green CI run verifies source code, migrations, and tests. It does not by itself prove that a production database has executed a data import.

The marketplace service bootstraps only sources whose registry policy allows persistent reuse. Imports are idempotent, retain provenance, resolve entities, and publish only governed reference records. Production visibility therefore requires the deployed marketplace service to start successfully against its production database.

This distinction is intentional: build verification and production data verification are separate operational checks.
