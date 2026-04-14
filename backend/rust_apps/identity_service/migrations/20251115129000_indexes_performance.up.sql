-- 20251115129000_indexes_performance.up.sql
-- targeted indexes
CREATE INDEX IF NOT EXISTS idx_permission_name ON permissions(name);
CREATE INDEX IF NOT EXISTS idx_roles_name ON roles(name);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role_permission ON role_permissions(role_id, permission_id);
CREATE INDEX IF NOT EXISTS idx_users_active_only ON users(id)
WHERE is_active = true
    AND deleted_at IS NULL;