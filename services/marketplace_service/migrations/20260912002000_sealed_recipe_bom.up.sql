-- Business OS V3 Wave 2C.2 hardening — seal published recipe BOMs.
--
-- Publication protocol:
--   1. Build version items while the parent recipe version does not yet exist.
--   2. Insert the immutable parent recipe version last in the same transaction.
--   3. The deferred scope FK validates the complete aggregate at commit.
--
-- Transaction-scoped advisory locks serialize item assembly with publication so
-- a concurrent transaction cannot race an item into a version as it is sealed.

ALTER TABLE business_recipe_version_items
  DROP CONSTRAINT fk_business_recipe_version_items_version_scope,
  ADD CONSTRAINT fk_business_recipe_version_items_version_scope
    FOREIGN KEY (recipe_version_id, business_id, organization_id)
    REFERENCES business_recipe_versions (id, business_id, organization_id)
    ON DELETE RESTRICT
    DEFERRABLE INITIALLY DEFERRED;

CREATE OR REPLACE FUNCTION lock_business_recipe_version_bom_publication()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.id::text, 0));
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_recipe_versions_bom_lock
BEFORE INSERT ON business_recipe_versions
FOR EACH ROW
EXECUTE FUNCTION lock_business_recipe_version_bom_publication();

DROP TRIGGER trg_business_recipe_version_items_append_only
  ON business_recipe_version_items;

CREATE OR REPLACE FUNCTION reject_business_recipe_version_item_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    PERFORM pg_advisory_xact_lock(hashtextextended(NEW.recipe_version_id::text, 0));

    IF EXISTS (
      SELECT 1
      FROM business_recipe_versions version
      WHERE version.id = NEW.recipe_version_id
        AND version.business_id = NEW.business_id
        AND version.organization_id = NEW.organization_id
    ) THEN
      RAISE EXCEPTION 'published recipe BOM is sealed';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'published recipe items are append-only';
END;
$$;

CREATE TRIGGER trg_business_recipe_version_items_append_only
BEFORE INSERT OR UPDATE OR DELETE ON business_recipe_version_items
FOR EACH ROW
EXECUTE FUNCTION reject_business_recipe_version_item_mutation();
