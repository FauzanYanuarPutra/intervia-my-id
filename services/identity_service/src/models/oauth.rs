use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OAuthClient {
    pub id: Uuid,
    pub client_id: String,
    /// MENTOK: Jangan simpan plain text. Simpan Hash (seperti password)
    #[serde(skip_serializing)] 
    pub client_secret_hash: String, 
    pub name: String,
    pub redirect_uris: Vec<String>, // Gunakan Vec langsung (PG Array)
    pub grant_types: Vec<String>,
    pub scope: Option<String>,
    pub is_confidential: bool,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct OAuthToken {
    pub id: Uuid,
    pub user_id: Option<Uuid>,
    pub client_id: Uuid,
    /// MENTOK: Gunakan JTI (JWT ID) untuk referensi, jangan simpan seluruh token jika JWT.
    /// Jika Opaque Token, simpan SHA-256 hash-nya saja.
    pub token_hash: String, 
    pub refresh_token_hash: Option<String>,
    pub scope: Option<String>,
    pub expires_at: DateTime<Utc>,
    pub issued_at: DateTime<Utc>,
    pub revoked: bool,
    /// Metadata untuk menyimpan Fingerprint/IP saat token dibuat
    pub metadata: serde_json::Value, 
}