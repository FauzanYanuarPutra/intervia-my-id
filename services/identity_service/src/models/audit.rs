use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use axum::http::HeaderMap;
use std::net::IpAddr;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AuditLog {
    pub id: i64,
    pub user_id: Option<Uuid>,
    pub action: String,      // Contoh: "auth.login", "user.update_password"
    pub resource: Option<String>,
    pub ip_address: Option<String>, // Disimpan sebagai String/Inet di PG
    pub user_agent: Option<String>,
    pub status: String,      // "success", "failure", "blocked"
    pub metadata: serde_json::Value,
    pub created_at: DateTime<Utc>,
}

// Struct untuk mempermudah pengiriman data ke antrean (RabbitMQ)
#[derive(Serialize, Deserialize)]
pub struct AuditEvent {
    pub user_id: Option<Uuid>,
    pub action: String,
    pub resource: Option<String>,
    pub ip: Option<String>,
    pub ua: Option<String>,
    pub status: String,
    pub metadata: serde_json::Value,
}