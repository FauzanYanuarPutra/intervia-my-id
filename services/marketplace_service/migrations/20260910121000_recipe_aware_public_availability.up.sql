-- Keep the public UMKM product projection aligned with canonical Usaha inventory.
-- Recipe-backed products expose the lower of explicit finished-goods stock and
-- ingredient-backed sellable capacity. Products without recipes preserve the
-- legacy stock semantics.

CREATE INDEX IF NOT EXISTS idx_business_recipe_items_ingredient
  ON business_recipe_items (ingredient_id, recipe_id);

CREATE OR REPLACE FUNCTION enforce_umkm_product_canonical_availability()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_business_id UUID;
  v_organization_id UUID;
  v_product_status TEXT;
  v_legacy_stock DOUBLE PRECISION;
  v_recipe_id UUID;
  v_recipe_servings NUMERIC;
  v_recipe_item_count BIGINT;
  v_valid_item_count BIGINT;
  v_recipe_capacity NUMERIC;
  v_effective_capacity NUMERIC;
BEGIN
  SELECT
    product.business_id,
    product.organization_id,
    product.status,
    inventory.stock_count
  INTO
    v_business_id,
    v_organization_id,
    v_product_status,
    v_legacy_stock
  FROM business_products product
  LEFT JOIN business_inventory inventory
    ON inventory.product_id = product.id
   AND inventory.business_id = product.business_id
   AND inventory.organization_id = product.organization_id
  WHERE product.id = NEW.id;

  -- Public-only/legacy rows are outside the canonical Business OS projection.
  IF NOT FOUND THEN
    RETURN NEW;
  END IF;

  SELECT recipe.id, recipe.servings
  INTO v_recipe_id, v_recipe_servings
  FROM business_recipes recipe
  WHERE recipe.product_id = NEW.id
    AND recipe.business_id = v_business_id
    AND recipe.organization_id = v_organization_id
    AND recipe.status = 'active'
  LIMIT 1;

  IF v_recipe_id IS NULL THEN
    IF v_legacy_stock IS NULL THEN
      -- Preserve existing unknown-stock behavior: numeric quantity is zero,
      -- while an active priced product remains orderable.
      NEW.stock_qty := 0;
      NEW.is_available := v_product_status = 'active' AND NEW.price_cents > 0;
      NEW.metadata := COALESCE(NEW.metadata, '{}'::JSONB)
        || jsonb_build_object('stock_known', FALSE);
    ELSE
      v_effective_capacity := LEAST(
        GREATEST(FLOOR(v_legacy_stock), 0.0),
        2147483647.0
      )::NUMERIC;
      NEW.stock_qty := v_effective_capacity::INTEGER;
      NEW.is_available := v_product_status = 'active'
        AND NEW.price_cents > 0
        AND v_legacy_stock > 0.0;
      NEW.metadata := COALESCE(NEW.metadata, '{}'::JSONB)
        || jsonb_build_object('stock_known', TRUE);
    END IF;
    RETURN NEW;
  END IF;

  SELECT COUNT(*)
  INTO v_recipe_item_count
  FROM business_recipe_items item
  WHERE item.recipe_id = v_recipe_id;

  SELECT
    COUNT(*),
    FLOOR(MIN(ingredient.stock_quantity * v_recipe_servings / item.quantity))
  INTO v_valid_item_count, v_recipe_capacity
  FROM business_recipe_items item
  JOIN business_ingredients ingredient
    ON ingredient.id = item.ingredient_id
   AND ingredient.business_id = v_business_id
   AND ingredient.organization_id = v_organization_id
   AND ingredient.status = 'active'
  WHERE item.recipe_id = v_recipe_id;

  -- Fail closed when a recipe has no inputs, or when any recipe input no
  -- longer resolves to an active ingredient in the same tenant.
  IF v_recipe_item_count = 0
     OR v_valid_item_count <> v_recipe_item_count
     OR v_recipe_capacity IS NULL THEN
    v_effective_capacity := 0;
  ELSE
    v_effective_capacity := LEAST(
      GREATEST(v_recipe_capacity, 0),
      2147483647
    );
  END IF;

  -- Explicit finished-goods stock is also an upper bound. NULL means that
  -- ingredient capacity is the canonical sellable quantity for this recipe.
  IF v_legacy_stock IS NOT NULL THEN
    v_effective_capacity := LEAST(
      v_effective_capacity,
      LEAST(
        GREATEST(FLOOR(v_legacy_stock), 0.0),
        2147483647.0
      )::NUMERIC
    );
  END IF;

  NEW.stock_qty := v_effective_capacity::INTEGER;
  NEW.is_available := v_product_status = 'active'
    AND NEW.price_cents > 0
    AND v_effective_capacity > 0;
  NEW.metadata := COALESCE(NEW.metadata, '{}'::JSONB)
    || jsonb_build_object('stock_known', TRUE);

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_umkm_products_canonical_availability ON umkm_products;
CREATE TRIGGER trg_umkm_products_canonical_availability
BEFORE INSERT OR UPDATE OF price_cents, stock_qty, is_available
ON umkm_products
FOR EACH ROW
EXECUTE FUNCTION enforce_umkm_product_canonical_availability();

CREATE OR REPLACE FUNCTION refresh_umkm_product_canonical_availability(p_product_id UUID)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Listing the guarded columns intentionally re-enters the projection guard.
  UPDATE umkm_products
  SET stock_qty = stock_qty,
      is_available = is_available
  WHERE id = p_product_id;
END;
$$;

CREATE OR REPLACE FUNCTION refresh_umkm_product_from_inventory()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_umkm_product_canonical_availability(OLD.product_id);
    RETURN OLD;
  END IF;

  PERFORM refresh_umkm_product_canonical_availability(NEW.product_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_inventory_refresh_public_availability ON business_inventory;
CREATE TRIGGER trg_business_inventory_refresh_public_availability
AFTER INSERT OR UPDATE OF stock_count OR DELETE
ON business_inventory
FOR EACH ROW
EXECUTE FUNCTION refresh_umkm_product_from_inventory();

CREATE OR REPLACE FUNCTION refresh_umkm_product_from_recipe()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM refresh_umkm_product_canonical_availability(OLD.product_id);
    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD.product_id IS DISTINCT FROM NEW.product_id THEN
    PERFORM refresh_umkm_product_canonical_availability(OLD.product_id);
  END IF;

  PERFORM refresh_umkm_product_canonical_availability(NEW.product_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_recipes_refresh_public_availability ON business_recipes;
CREATE TRIGGER trg_business_recipes_refresh_public_availability
AFTER INSERT OR DELETE OR UPDATE OF product_id, servings, status, business_id, organization_id
ON business_recipes
FOR EACH ROW
EXECUTE FUNCTION refresh_umkm_product_from_recipe();

CREATE OR REPLACE FUNCTION refresh_umkm_product_from_recipe_item()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  IF TG_OP = 'DELETE' OR TG_OP = 'UPDATE' THEN
    SELECT recipe.product_id
    INTO v_product_id
    FROM business_recipes recipe
    WHERE recipe.id = OLD.recipe_id;

    IF v_product_id IS NOT NULL THEN
      PERFORM refresh_umkm_product_canonical_availability(v_product_id);
    END IF;
  END IF;

  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    v_product_id := NULL;
    SELECT recipe.product_id
    INTO v_product_id
    FROM business_recipes recipe
    WHERE recipe.id = NEW.recipe_id;

    IF v_product_id IS NOT NULL THEN
      PERFORM refresh_umkm_product_canonical_availability(v_product_id);
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_recipe_items_refresh_public_availability ON business_recipe_items;
CREATE TRIGGER trg_business_recipe_items_refresh_public_availability
AFTER INSERT OR DELETE OR UPDATE OF recipe_id, ingredient_id, quantity
ON business_recipe_items
FOR EACH ROW
EXECUTE FUNCTION refresh_umkm_product_from_recipe_item();

CREATE OR REPLACE FUNCTION refresh_umkm_products_from_ingredient()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
DECLARE
  v_product_id UUID;
BEGIN
  FOR v_product_id IN
    SELECT DISTINCT recipe.product_id
    FROM business_recipe_items item
    JOIN business_recipes recipe ON recipe.id = item.recipe_id
    WHERE item.ingredient_id = NEW.id
      AND recipe.status = 'active'
  LOOP
    PERFORM refresh_umkm_product_canonical_availability(v_product_id);
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_ingredients_refresh_public_availability ON business_ingredients;
CREATE TRIGGER trg_business_ingredients_refresh_public_availability
AFTER UPDATE OF stock_quantity, status, business_id, organization_id
ON business_ingredients
FOR EACH ROW
EXECUTE FUNCTION refresh_umkm_products_from_ingredient();

-- Reconcile only canonical public rows once so deployment does not rewrite
-- unrelated marketplace products and does not wait for a future mutation.
UPDATE umkm_products public_product
SET stock_qty = public_product.stock_qty,
    is_available = public_product.is_available
WHERE EXISTS (
  SELECT 1
  FROM business_products product
  WHERE product.id = public_product.id
);
