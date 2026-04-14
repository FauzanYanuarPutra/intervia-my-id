use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Permission {
    pub id: i32,
    pub code: String,        // Contoh: "user:create", "billing:view"
    pub resource: String,    // Kelompok: "user", "billing", "system"
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct RolePermission {
    pub role_id: i32,
    pub permission_id: i32,
    pub created_at: DateTime<Utc>,
}