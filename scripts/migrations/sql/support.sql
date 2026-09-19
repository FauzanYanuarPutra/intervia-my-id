CREATE EXTENSION IF NOT EXISTS postgres_fdw;
CREATE SCHEMA IF NOT EXISTS legacy;
DROP SERVER IF EXISTS legacy_marketplace CASCADE;
CREATE SERVER legacy_marketplace FOREIGN DATA WRAPPER postgres_fdw OPTIONS (host :'legacy_host', port :'legacy_port', dbname 'marketplace_db');
CREATE USER MAPPING FOR CURRENT_USER SERVER legacy_marketplace OPTIONS (user :'legacy_user', password :'legacy_password');
IMPORT FOREIGN SCHEMA public LIMIT TO (support_tickets,support_ticket_replies) FROM SERVER legacy_marketplace INTO legacy;
INSERT INTO support_tickets SELECT id,requester_user_id,requester_email,requester_name,category,subject,status,priority,assigned_agent_id,source,support_room_id,created_at,updated_at,resolved_at,first_response_at FROM legacy.support_tickets ON CONFLICT(id) DO NOTHING;
INSERT INTO support_ticket_replies SELECT id,ticket_id,author_user_id,author_role,body,is_internal,created_at FROM legacy.support_ticket_replies r WHERE EXISTS (SELECT 1 FROM support_tickets t WHERE t.id=r.ticket_id) ON CONFLICT(id) DO NOTHING;
