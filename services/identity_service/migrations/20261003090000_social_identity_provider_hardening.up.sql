-- Google and Facebook are account identities, never replacement user records.
-- Keep the provider subject immutable/unique while allowing one Lajukan user
-- to link at most one identity per provider.
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider_subject_active
    ON core.user_identities(provider, provider_user_id)
    WHERE provider IN ('google', 'facebook');

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_identities_provider_user_active
    ON core.user_identities(provider, user_id)
    WHERE provider IN ('google', 'facebook');
