-- Business OS V3 Wave 2C.2 rollback.
--
-- Fail closed once immutable recipe evidence or a sale reference exists. A
-- rollback after that point would erase the historical basis of COGS/stock.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM business_recipe_versions)
     OR EXISTS (
       SELECT 1
       FROM business_sale_lines
       WHERE recipe_version_id IS NOT NULL
     ) THEN
    RAISE EXCEPTION
      'cannot roll back versioned recipe kernel after recipe or sale evidence exists';
  END IF;
END;
$$;

DELETE FROM business_role_permissions
WHERE permission_key IN ('recipe.view', 'recipe.manage');

DELETE FROM business_permissions
WHERE permission_key IN ('recipe.view', 'recipe.manage');

DROP INDEX IF EXISTS idx_business_sale_lines_recipe_version;

ALTER TABLE business_sale_lines
  DROP CONSTRAINT IF EXISTS fk_business_sale_lines_recipe_version,
  DROP COLUMN IF EXISTS recipe_version_id;

DROP TRIGGER IF EXISTS trg_business_recipe_version_items_append_only
  ON business_recipe_version_items;
DROP TRIGGER IF EXISTS trg_business_recipe_versions_mutation_guard
  ON business_recipe_versions;
DROP TRIGGER IF EXISTS trg_business_recipe_versions_insert_guard
  ON business_recipe_versions;

DROP TABLE IF EXISTS business_recipe_version_items;
DROP TABLE IF EXISTS business_recipe_versions;

DROP FUNCTION IF EXISTS reject_business_recipe_version_item_mutation();
DROP FUNCTION IF EXISTS guard_business_recipe_version_mutation();
DROP FUNCTION IF EXISTS guard_business_recipe_version_insert();

DROP INDEX IF EXISTS uq_business_ingredients_scope;
