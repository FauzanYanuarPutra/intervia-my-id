-- Disable the guarded public projection before restoring the previous
-- business_inventory-only semantics.
DROP TRIGGER IF EXISTS trg_umkm_products_canonical_availability ON umkm_products;

UPDATE umkm_products public_product
SET stock_qty = CASE
      WHEN canonical.stock_count IS NULL THEN 0
      ELSE LEAST(
        GREATEST(FLOOR(canonical.stock_count), 0.0),
        2147483647.0
      )::INTEGER
    END,
    is_available = canonical.status = 'active'
      AND public_product.price_cents > 0
      AND (canonical.stock_count IS NULL OR canonical.stock_count > 0.0),
    metadata = COALESCE(public_product.metadata, '{}'::JSONB)
      || jsonb_build_object('stock_known', canonical.stock_count IS NOT NULL),
    updated_at = NOW()
FROM (
  SELECT product.id, product.status, inventory.stock_count
  FROM business_products product
  JOIN business_inventory inventory
    ON inventory.product_id = product.id
   AND inventory.business_id = product.business_id
   AND inventory.organization_id = product.organization_id
) canonical
WHERE public_product.id = canonical.id;

DROP TRIGGER IF EXISTS trg_business_ingredients_refresh_public_availability ON business_ingredients;
DROP TRIGGER IF EXISTS trg_business_recipe_items_refresh_public_availability ON business_recipe_items;
DROP TRIGGER IF EXISTS trg_business_recipes_refresh_public_availability ON business_recipes;
DROP TRIGGER IF EXISTS trg_business_inventory_refresh_public_availability ON business_inventory;

DROP FUNCTION IF EXISTS refresh_umkm_products_from_ingredient();
DROP FUNCTION IF EXISTS refresh_umkm_product_from_recipe_item();
DROP FUNCTION IF EXISTS refresh_umkm_product_from_recipe();
DROP FUNCTION IF EXISTS refresh_umkm_product_from_inventory();
DROP FUNCTION IF EXISTS refresh_umkm_product_canonical_availability(UUID);
DROP FUNCTION IF EXISTS enforce_umkm_product_canonical_availability();

DROP INDEX IF EXISTS idx_business_recipe_items_ingredient;
