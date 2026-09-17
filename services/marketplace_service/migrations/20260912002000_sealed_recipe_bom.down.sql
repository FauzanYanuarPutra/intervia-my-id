-- Business OS V3 Wave 2C.2 hardening rollback.
--
-- Once immutable recipe evidence exists, unsealing its BOM would weaken the
-- historical guarantee that sales and COGS depend on. Fail closed instead.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM business_recipe_versions) THEN
    RAISE EXCEPTION
      'cannot unseal published recipe BOM after recipe evidence exists';
  END IF;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_recipe_version_items_append_only
  ON business_recipe_version_items;
DROP TRIGGER IF EXISTS trg_business_recipe_versions_bom_lock
  ON business_recipe_versions;

DROP FUNCTION IF EXISTS lock_business_recipe_version_bom_publication();

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

ALTER TABLE business_recipe_version_items
  DROP CONSTRAINT fk_business_recipe_version_items_version_scope,
  ADD CONSTRAINT fk_business_recipe_version_items_version_scope
    FOREIGN KEY (recipe_version_id, business_id, organization_id)
    REFERENCES business_recipe_versions (id, business_id, organization_id)
    ON DELETE RESTRICT;
