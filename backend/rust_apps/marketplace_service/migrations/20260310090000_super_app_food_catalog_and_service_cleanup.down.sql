-- Rollback for super app service cleanup and food catalog.

DROP TABLE IF EXISTS super_app_food_menu_items;
DROP TABLE IF EXISTS super_app_food_merchants;

ALTER TABLE super_app_orders DROP CONSTRAINT IF EXISTS chk_super_app_orders_service_type;
ALTER TABLE driver_locations_latest DROP CONSTRAINT IF EXISTS chk_driver_locations_latest_service_type;
ALTER TABLE dispatch_orders DROP CONSTRAINT IF EXISTS chk_dispatch_orders_service_type;

ALTER TABLE super_app_orders
ADD CONSTRAINT super_app_orders_service_type_check
CHECK (service_type IN ('ride', 'car', 'food', 'send', 'mart', 'services', 'franchise'));

ALTER TABLE driver_locations_latest
ADD CONSTRAINT driver_locations_latest_service_type_check
CHECK (service_type IN ('ride', 'car', 'food', 'send', 'mart', 'services', 'franchise'));

ALTER TABLE dispatch_orders
ADD CONSTRAINT dispatch_orders_service_type_check
CHECK (service_type IN ('ride', 'car', 'food', 'send', 'mart', 'services', 'franchise'));

SELECT 1;
