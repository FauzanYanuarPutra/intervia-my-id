-- Add metadata column to user_profiles for flexible profile types
-- This enables: freelancer profiles, employer profiles, preferences, etc.

-- Add metadata column (JSONB for flexibility)
ALTER TABLE user_profiles 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}'::jsonb;

-- Add search indexes for common queries
CREATE INDEX IF NOT EXISTS idx_user_profiles_metadata_gin 
ON user_profiles USING GIN (metadata);

-- Index for freelancer role search
CREATE INDEX IF NOT EXISTS idx_user_profiles_freelancer_role 
ON user_profiles ((metadata->'roles')) 
WHERE metadata ? 'roles';

-- Index for skills search (for freelancers)
CREATE INDEX IF NOT EXISTS idx_user_profiles_skills 
ON user_profiles USING GIN ((metadata->'freelancer_profile'->'skills'))
WHERE metadata->'freelancer_profile' IS NOT NULL;

-- Add full-text search for freelancer profiles
CREATE INDEX IF NOT EXISTS idx_user_profiles_freelancer_search
ON user_profiles USING GIN (
  to_tsvector('simple', 
    COALESCE(full_name, '') || ' ' || 
    COALESCE(bio, '') || ' ' ||
    COALESCE(metadata->'freelancer_profile'->>'tagline', '') || ' ' ||
    COALESCE(metadata->'freelancer_profile'->>'professional_title', '')
  )
)
WHERE metadata->'freelancer_profile' IS NOT NULL;

-- Add function to check if user is freelancer
CREATE OR REPLACE FUNCTION is_freelancer(profile user_profiles) 
RETURNS BOOLEAN AS $$
  SELECT profile.metadata->'roles' ? 'freelancer';
$$ LANGUAGE SQL IMMUTABLE;

-- Add function to get freelancer hourly rate
CREATE OR REPLACE FUNCTION get_hourly_rate(profile user_profiles) 
RETURNS INTEGER AS $$
  SELECT COALESCE(
    (profile.metadata->'freelancer_profile'->>'hourly_rate')::integer, 
    0
  );
$$ LANGUAGE SQL IMMUTABLE;

SELECT 1; -- Migration complete
