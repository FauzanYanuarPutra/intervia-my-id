-- Business OS V3 Wave 2C.2 — Versioned Recipe/BOM + COGS Kernel.
--
-- Existing business_recipes/business_recipe_items are deliberately NOT copied
-- into this history. Those rows have been mutable and therefore cannot prove
-- what definition was true at an earlier point in time.

CREATE UNIQUE INDEX IF NOT EXISTS uq_business_ingredients_scope
  ON business_ingredients (id, business_id, organization_id);

CREATE TABLE business_recipe_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  product_id UUID NOT NULL,
  version_number BIGINT NOT NULL CHECK (version_number > 0),
  name TEXT NOT NULL CHECK (BTRIM(name) <> ''),
  servings NUMERIC(20, 6) NOT NULL CHECK (servings > 0),
  status TEXT NOT NULL DEFAULT 'published'
    CHECK (status IN ('published', 'superseded')),
  effective_from TIMESTAMPTZ NOT NULL,
  effective_until TIMESTAMPTZ NULL,
  published_by_user_id UUID NOT NULL,
  superseded_by_version_id UUID NULL,
  reason TEXT NOT NULL CHECK (BTRIM(reason) <> ''),
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB
    CHECK (jsonb_typeof(metadata) = 'object'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT ck_business_recipe_versions_window CHECK (
    effective_until IS NULL OR effective_until > effective_from
  ),
  CONSTRAINT ck_business_recipe_versions_state CHECK (
    (status = 'published' AND effective_until IS NULL AND superseded_by_version_id IS NULL)
    OR
    (status = 'superseded' AND effective_until IS NOT NULL AND superseded_by_version_id IS NOT NULL)
  ),
  CONSTRAINT fk_business_recipe_versions_product_scope
    FOREIGN KEY (product_id, business_id, organization_id)
    REFERENCES business_products (id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_recipe_versions_superseded_by
    FOREIGN KEY (superseded_by_version_id)
    REFERENCES business_recipe_versions (id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED,
  UNIQUE (business_id, product_id, version_number),
  UNIQUE (id, business_id, organization_id)
);

CREATE UNIQUE INDEX ux_business_recipe_versions_open
  ON business_recipe_versions (business_id, product_id)
  WHERE status = 'published' AND effective_until IS NULL;

CREATE INDEX idx_business_recipe_versions_effective
  ON business_recipe_versions (
    organization_id, business_id, product_id, effective_from DESC
  );

CREATE TABLE business_recipe_version_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL,
  business_id UUID NOT NULL,
  recipe_version_id UUID NOT NULL,
  ingredient_id UUID NOT NULL,
  quantity NUMERIC(20, 6) NOT NULL CHECK (quantity > 0),
  waste_percent_override NUMERIC(7, 4) NULL CHECK (
    waste_percent_override IS NULL
    OR (waste_percent_override >= 0 AND waste_percent_override < 100)
  ),
  position INTEGER NOT NULL DEFAULT 0 CHECK (position >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_recipe_version_items_version_scope
    FOREIGN KEY (recipe_version_id, business_id, organization_id)
    REFERENCES business_recipe_versions (id, business_id, organization_id)
    ON DELETE RESTRICT,
  CONSTRAINT fk_business_recipe_version_items_ingredient_scope
    FOREIGN KEY (ingredient_id, business_id, organization_id)
    REFERENCES business_ingredients (id, business_id, organization_id)
    ON DELETE RESTRICT,
  UNIQUE (recipe_version_id, ingredient_id)
);

CREATE INDEX idx_business_recipe_version_items_ingredient
  ON business_recipe_version_items (ingredient_id, recipe_version_id);

CREATE OR REPLACE FUNCTION guard_business_recipe_version_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_latest_effective_from TIMESTAMPTZ;
BEGIN
  IF NEW.status <> 'published'
     OR NEW.effective_until IS NOT NULL
     OR NEW.superseded_by_version_id IS NOT NULL THEN
    RAISE EXCEPTION 'recipe versions must be inserted as open published evidence';
  END IF;

  SELECT MAX(version.effective_from)
  INTO v_latest_effective_from
  FROM business_recipe_versions version
  WHERE version.business_id = NEW.business_id
    AND version.organization_id = NEW.organization_id
    AND version.product_id = NEW.product_id;

  IF v_latest_effective_from IS NOT NULL
     AND NEW.effective_from <= v_latest_effective_from THEN
    RAISE EXCEPTION 'recipe publication must advance the effective timeline';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM business_recipe_versions version
    WHERE version.business_id = NEW.business_id
      AND version.organization_id = NEW.organization_id
      AND version.product_id = NEW.product_id
      AND tstzrange(
        version.effective_from,
        COALESCE(version.effective_until, 'infinity'::TIMESTAMPTZ),
        '[)'
      ) && tstzrange(
        NEW.effective_from,
        COALESCE(NEW.effective_until, 'infinity'::TIMESTAMPTZ),
        '[)'
      )
  ) THEN
    RAISE EXCEPTION 'recipe effective windows may not overlap';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_recipe_versions_insert_guard
BEFORE INSERT ON business_recipe_versions
FOR EACH ROW
EXECUTE FUNCTION guard_business_recipe_version_insert();

CREATE OR REPLACE FUNCTION guard_business_recipe_version_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'published recipe evidence is append-only';
  END IF;

  -- Definition/evidence fields never change. The only allowed update is the
  -- one-way lifecycle transition that closes a published interval when a
  -- replacement version is published.
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

CREATE TRIGGER trg_business_recipe_versions_mutation_guard
BEFORE UPDATE OR DELETE ON business_recipe_versions
FOR EACH ROW
EXECUTE FUNCTION guard_business_recipe_version_mutation();

CREATE OR REPLACE FUNCTION reject_business_recipe_version_item_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'published recipe items are append-only';
END;
$$;

CREATE TRIGGER trg_business_recipe_version_items_append_only
BEFORE UPDATE OR DELETE ON business_recipe_version_items
FOR EACH ROW
EXECUTE FUNCTION reject_business_recipe_version_item_mutation();

ALTER TABLE business_sale_lines
  ADD COLUMN recipe_version_id UUID NULL;

ALTER TABLE business_sale_lines
  ADD CONSTRAINT fk_business_sale_lines_recipe_version
  FOREIGN KEY (recipe_version_id)
  REFERENCES business_recipe_versions (id)
  ON DELETE RESTRICT;

CREATE INDEX idx_business_sale_lines_recipe_version
  ON business_sale_lines (recipe_version_id)
  WHERE recipe_version_id IS NOT NULL;

INSERT INTO business_permissions (permission_key, description)
VALUES
  ('recipe.view', 'View versioned recipe and BOM evidence'),
  ('recipe.manage', 'Publish and supersede versioned recipes and BOMs')
ON CONFLICT (permission_key) DO UPDATE
SET description = EXCLUDED.description;

INSERT INTO business_role_permissions (role_id, permission_key)
SELECT role.id, permission.permission_key
FROM business_roles role
JOIN business_permissions permission
  ON permission.permission_key IN ('recipe.view', 'recipe.manage')
WHERE role.role_key = 'owner'
  AND role.is_system = TRUE
ON CONFLICT (role_id, permission_key) DO NOTHING;
