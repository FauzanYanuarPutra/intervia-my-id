CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Supports the public people directory's partial name, skill, and location
-- search without scanning every profile as the member base grows.
CREATE INDEX IF NOT EXISTS idx_user_profiles_public_discovery_trgm
ON core.user_profiles USING GIN ((
  COALESCE(username::text, '') || ' ' ||
  COALESCE(full_name, '') || ' ' ||
  COALESCE(location, '') || ' ' ||
  COALESCE(bio, '') || ' ' ||
  COALESCE(metadata->'freelancer_profile'->>'professional_title', '') || ' ' ||
  COALESCE(metadata->'freelancer_profile'->>'tagline', '') || ' ' ||
  COALESCE(metadata->'provider_profile'->>'headline', '') || ' ' ||
  COALESCE(metadata->'buyer_profile'->>'intent', '') || ' ' ||
  COALESCE(metadata->'freelancer_profile'->'skills', '[]'::jsonb)::text || ' ' ||
  COALESCE(metadata->'provider_profile'->'skills', '[]'::jsonb)::text
) gin_trgm_ops);

CREATE INDEX IF NOT EXISTS idx_users_active_created_at
ON core.users (created_at DESC, id)
WHERE deleted_at IS NULL AND is_active = TRUE AND status = 'active';
