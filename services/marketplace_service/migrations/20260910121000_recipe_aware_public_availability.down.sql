DROP TRIGGER IF EXISTS trg_business_ingredients_refresh_public_availability ON business_ingredients;
DROP TRIGGER IF EXISTS trg_business_recipe_items_refresh_public_availability ON business_recipe_items;
DROP TRIGGER IF EXISTS trg_business_recipes_refresh_public_availability ON business_recipes;
DROP TRIGGER IF EXISTS trg_business_inventory_refresh_public_availability ON business_inventory;
DROP TRIGGER IF EXISTS trg_umkm_products_canonical_availability ON umkm_products;

DROP FUNCTION IF EXISTS refresh_umkm_products_from_ingredient();
DROP FUNCTION IF EXISTS refresh_umkm_product_from_recipe_item();
DROP FUNCTION IF EXISTS refresh_umkm_product_from_recipe();
DROP FUNCTION IF EXISTS refresh_umkm_product_from_inventory();
DROP FUNCTION IF EXISTS refresh_umkm_product_canonical_availability(UUID);
DROP FUNCTION IF EXISTS enforce_umkm_product_canonical_availability();

DROP INDEX IF EXISTS idx_business_recipe_items_ingredient;
