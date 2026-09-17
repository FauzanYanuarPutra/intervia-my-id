-- Keep public product availability synchronized when canonical product status changes.
-- The recipe-aware projection guard remains the single source of availability derivation.

CREATE OR REPLACE FUNCTION refresh_umkm_product_from_business_product_status()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  PERFORM refresh_umkm_product_canonical_availability(NEW.id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_business_products_refresh_public_availability ON business_products;
CREATE TRIGGER trg_business_products_refresh_public_availability
AFTER UPDATE OF status
ON business_products
FOR EACH ROW
WHEN (OLD.status IS DISTINCT FROM NEW.status)
EXECUTE FUNCTION refresh_umkm_product_from_business_product_status();
