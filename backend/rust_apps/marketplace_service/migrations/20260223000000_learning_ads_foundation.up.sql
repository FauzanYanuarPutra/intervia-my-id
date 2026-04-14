-- Foundation schema for learning, certification, memberships, and ad delivery.
-- Keep all DDL idempotent to be safe in shared dev databases.

CREATE TABLE IF NOT EXISTS learning_courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_user_id UUID NOT NULL,
    slug TEXT NOT NULL UNIQUE,
    title TEXT NOT NULL,
    summary TEXT,
    description TEXT,
    level TEXT NOT NULL DEFAULT 'beginner' CHECK (level IN ('beginner', 'intermediate', 'advanced')),
    price_cents BIGINT NOT NULL DEFAULT 0 CHECK (price_cents >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'IDR',
    visibility TEXT NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'unlisted', 'private')),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
    thumbnail_url TEXT,
    estimated_minutes INT NOT NULL DEFAULT 0 CHECK (estimated_minutes >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_learning_courses_creator
    ON learning_courses(creator_user_id);
CREATE INDEX IF NOT EXISTS idx_learning_courses_status
    ON learning_courses(status, visibility);

CREATE TABLE IF NOT EXISTS learning_modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    position INT NOT NULL CHECK (position > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, position)
);

CREATE TABLE IF NOT EXISTS learning_lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID NOT NULL REFERENCES learning_modules(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    lesson_type TEXT NOT NULL CHECK (lesson_type IN ('video', 'reading', 'quiz', 'assignment')),
    content_ref TEXT,
    duration_seconds INT NOT NULL DEFAULT 0 CHECK (duration_seconds >= 0),
    is_preview BOOLEAN NOT NULL DEFAULT FALSE,
    position INT NOT NULL CHECK (position > 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (module_id, position)
);

CREATE INDEX IF NOT EXISTS idx_learning_lessons_module
    ON learning_lessons(module_id);

CREATE TABLE IF NOT EXISTS learning_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID NOT NULL REFERENCES learning_courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL,
    source TEXT NOT NULL DEFAULT 'direct' CHECK (source IN ('direct', 'membership', 'bundle', 'coupon')),
    enrolled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (course_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_learning_enrollments_user
    ON learning_enrollments(user_id, enrolled_at DESC);

CREATE TABLE IF NOT EXISTS learning_progress (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES learning_enrollments(id) ON DELETE CASCADE,
    lesson_id UUID NOT NULL REFERENCES learning_lessons(id) ON DELETE CASCADE,
    progress_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100),
    completed_at TIMESTAMPTZ,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (enrollment_id, lesson_id)
);

CREATE TABLE IF NOT EXISTS learning_certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL UNIQUE REFERENCES learning_enrollments(id) ON DELETE CASCADE,
    certificate_number TEXT NOT NULL UNIQUE,
    issued_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    score_percent NUMERIC(5,2),
    verification_token TEXT NOT NULL UNIQUE,
    pdf_url TEXT,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_learning_certificates_issued
    ON learning_certificates(issued_at DESC);

CREATE TABLE IF NOT EXISTS creator_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    creator_user_id UUID NOT NULL,
    title TEXT NOT NULL,
    perks JSONB NOT NULL DEFAULT '[]'::jsonb,
    monthly_price_cents BIGINT NOT NULL CHECK (monthly_price_cents >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'IDR',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_creator_memberships_creator
    ON creator_memberships(creator_user_id, is_active);

CREATE TABLE IF NOT EXISTS ad_campaigns (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    advertiser_user_id UUID NOT NULL,
    name TEXT NOT NULL,
    objective TEXT NOT NULL CHECK (objective IN ('reach', 'traffic', 'conversion', 'awareness')),
    budget_cents BIGINT NOT NULL CHECK (budget_cents >= 0),
    currency CHAR(3) NOT NULL DEFAULT 'IDR',
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'active', 'paused', 'ended')),
    starts_at TIMESTAMPTZ,
    ends_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_campaigns_status_window
    ON ad_campaigns(status, starts_at, ends_at);

CREATE TABLE IF NOT EXISTS ad_creatives (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    body TEXT,
    media_url TEXT,
    destination_url TEXT NOT NULL,
    cta_label TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_target_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL UNIQUE REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    include_topics TEXT[] NOT NULL DEFAULT '{}',
    include_sectors TEXT[] NOT NULL DEFAULT '{}',
    include_locales TEXT[] NOT NULL DEFAULT '{}',
    exclude_topics TEXT[] NOT NULL DEFAULT '{}',
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_slots (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slot_code TEXT NOT NULL UNIQUE,
    placement_type TEXT NOT NULL CHECK (placement_type IN ('home_feed', 'reels_feed', 'search_result', 'course_sidebar')),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS ad_impressions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    campaign_id UUID NOT NULL REFERENCES ad_campaigns(id) ON DELETE CASCADE,
    creative_id UUID NOT NULL REFERENCES ad_creatives(id) ON DELETE CASCADE,
    slot_id UUID NOT NULL REFERENCES ad_slots(id) ON DELETE RESTRICT,
    user_id UUID,
    session_id TEXT,
    context JSONB NOT NULL DEFAULT '{}'::jsonb,
    viewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_impressions_campaign_viewed
    ON ad_impressions(campaign_id, viewed_at DESC);

CREATE TABLE IF NOT EXISTS ad_clicks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    impression_id UUID NOT NULL REFERENCES ad_impressions(id) ON DELETE CASCADE,
    clicked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ad_clicks_clicked
    ON ad_clicks(clicked_at DESC);

SELECT 1;
