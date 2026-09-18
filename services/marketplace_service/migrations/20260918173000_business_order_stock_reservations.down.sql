DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM business_order_stock_reservations LIMIT 1) THEN
    RAISE EXCEPTION
      'refusing to drop business_order_stock_reservations while reservation history exists';
  END IF;
END $$;

DROP TABLE IF EXISTS business_order_stock_reservations;
