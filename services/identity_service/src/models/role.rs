use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct Role {
    pub id: i32,
    pub code: String,        // Contoh: "SUPER_ADMIN", "USER_MEMBER"
    pub name: String,
    pub description: Option<String>,
    pub priority: i16,       // Semakin besar angka, semakin tinggi kekuasaannya
    pub is_system: bool,     // Mencegah role krusial dihapus via API
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UserRole {
    pub user_id: Uuid,
    pub role_id: i32,
    pub assigned_by: Option<Uuid>, 
    pub created_at: DateTime<Utc>,
}