CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE SCHEMA IF NOT EXISTS legacy;
DROP SERVER IF EXISTS legacy_marketplace CASCADE;
CREATE SERVER legacy_marketplace FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host :'legacy_host', port :'legacy_port', dbname 'marketplace_db');
CREATE USER MAPPING FOR CURRENT_USER SERVER legacy_marketplace OPTIONS (user :'legacy_user', password :'legacy_password');
IMPORT FOREIGN SCHEMA public LIMIT TO (orders,order_items,order_state_transitions) FROM SERVER legacy_marketplace INTO legacy;
INSERT INTO orders SELECT id,order_number,user_id,merchant_id,category_type,base_status,payment_status,currency,subtotal_amount,shipping_amount,discount_amount,tax_amount,total_amount,payment_provider,payment_reference,payment_due_at,accepted_at,paid_at,completed_at,cancelled_at,expired_at,refunded_at,category_specific_metadata,idempotency_key,created_at,updated_at,version FROM legacy.orders ON CONFLICT(id) DO NOTHING;
INSERT INTO order_items SELECT id,order_id,product_id,service_id,sku_id,item_name,quantity,unit_price,line_total,metadata,created_at FROM legacy.order_items i WHERE EXISTS (SELECT 1 FROM orders o WHERE o.id=i.order_id) ON CONFLICT(id) DO NOTHING;
INSERT INTO order_state_transitions SELECT id,order_id,from_status,to_status,transition_type,actor_type,actor_id,reason,metadata,idempotency_key,request_hash,created_at FROM legacy.order_state_transitions t WHERE EXISTS (SELECT 1 FROM orders o WHERE o.id=t.order_id) ON CONFLICT(id) DO NOTHING;