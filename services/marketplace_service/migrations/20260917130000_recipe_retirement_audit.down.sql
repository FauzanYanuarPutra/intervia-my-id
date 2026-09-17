BEGIN;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM business_recipe_versions WHERE status = 'retired'
  ) OR EXISTS (
    SELECT 1 FROM business_recipes WHERE status = 'retired'
  ) THEN
    RAISE EXCEPTION 'cannot roll back recipe retirement support while retired recipes exist';
  END IF;
END $$;

ALTER TABLE business_recipes
  DROP CONSTRAINT IF EXISTS business_recipes_status_check;

ALTER TABLE business_recipes
  ADD CONSTRAINT business_recipes_status_check
  CHECK (status IN ('active', 'archived'));

ALTER TABLE business_recipe_versions
  DROP CONSTRAINT IF EXISTS business_recipe_versions_status_check,
  DROP CONSTRAINT IF EXISTS ck_business_recipe_versions_state;

ALTER TABLE business_recipe_versions
  ADD CONSTRAINT business_recipe_versions_status_check
  CHECK (status IN ('published', 'superseded')),
  ADD CONSTRAINT ck_business_recipe_versions_state CHECK (
    (status = 'published' AND effective_until IS NULL AND superseded_by_version_id IS NULL)
    OR
    (status = 'superseded' AND effective_until IS NOT NULL AND superseded_by_version_id IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION guard_business_recipe_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'published recipe evidence is append-only';
  END IF;

  IF OLD.id IS DISTINCT FROM NEW.id
     OR OLD.organization_id IS DISTINCT FROM NEW.organization_id
     OR OLD.business_id IS DISTINCT FROM NEW.business_id
     OR OLD.product_id IS DISTINCT FROM NEW.product_id
     OR OLD.version_number IS DISTINCT FROM NEW.version_number
     OR OLD.name IS DISTINCT FROM NEW.name
     OR OLD.servings IS DISTINCT FROM NEW.servings
     OR OLD.effective_from IS DISTINCT FROM NEW.effective_from
     OR OLD.published_by_user_id IS DISTINCT FROM NEW.published_by_user_id
     OR OLD.reason IS DISTINCT FROM NEW.reason
     OR OLD.metadata IS DISTINCT FROM NEW.metadata
     OR OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'published recipe definition is immutable';
  END IF;

  IF OLD.status = 'published'
     AND OLD.effective_until IS NULL
     AND OLD.superseded_by_version_id IS NULL
     AND NEW.status = 'superseded'
     AND NEW.effective_until IS NOT NULL
     AND NEW.effective_until > OLD.effective_from
     AND NEW.superseded_by_version_id IS NOT NULL THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'recipe lifecycle transition is not allowed';
END;
$$;

COMMIT;
