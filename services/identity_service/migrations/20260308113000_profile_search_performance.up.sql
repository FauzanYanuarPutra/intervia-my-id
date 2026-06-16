-- Improve discover profile search performance for buyer/provider/freelancer fields.
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX IF NOT EXISTS idx_user_profiles_search_surface_tsv ON core.user_profiles USING GIN (
  to_tsvector(
    'simple',
    COALESCE(full_name, '') || ' ' || COALESCE(username::text, '') || ' ' || COALESCE(location, '') || ' ' || COALESCE(bio, '') || ' ' || COALESCE(
      metadata->'freelancer_profile'->>'professional_title',
      ''
    ) || ' ' || COALESCE(metadata->'freelancer_profile'->>'tagline', '') || ' ' || COALESCE(metadata->'provider_profile'->>'headline', '') || ' ' || COALESCE(metadata->'buyer_profile'->>'intent', '')
  )
);
CREATE INDEX IF NOT EXISTS idx_user_profiles_location_trgm ON core.user_profiles USING GIN (location gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_profiles_full_name_trgm ON core.user_profiles USING GIN (full_name gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_user_profiles_roles_gin ON core.user_profiles USING GIN ((metadata->'roles'))
WHERE metadata ? 'roles';
CREATE INDEX IF NOT EXISTS idx_user_profiles_provider_skills_gin ON core.user_profiles USING GIN ((metadata->'provider_profile'->'skills'))
WHERE metadata->'provider_profile' IS NOT NULL;
SELECT 1;