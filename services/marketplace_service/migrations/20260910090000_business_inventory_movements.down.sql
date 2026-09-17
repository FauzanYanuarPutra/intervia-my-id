DROP TABLE IF EXISTS business_inventory_movements;

ALTER TABLE business_ingredients
    DROP CONSTRAINT IF EXISTS uq_business_ingredients_tenant_identity;
