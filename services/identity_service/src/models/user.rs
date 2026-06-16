use chrono::{DateTime, Utc};
use serde::{Serialize, Deserialize};
use uuid::Uuid;
use validator::Validate;

#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct User {
    pub id: Uuid,
    pub email: Option<String>,
    pub username: Option<String>,
    
    #[serde(skip_serializing)] // Keamanan: Jangan pernah kirim hash ke JSON
    pub password_hash: Option<String>,
    
    // Keamanan: Status akun yang lebih granular
    pub is_active: bool,
    pub is_banned: bool,
    pub email_verified: bool,
    
    // Keamanan: MFA Hardening
    pub mfa_enabled: bool,
    #[serde(skip_serializing)]
    pub mfa_secret: Option<String>,
    pub mfa_backup_codes: Option<Vec<String>>, // Wajib ada untuk recovery MFA
    
    // Keamanan: Brute Force Protection (OWASP)
    pub failed_login_attempts: i16,
    pub lockout_expires_at: Option<DateTime<Utc>>,
    
    // Performa: Metadata menggunakan JSONB di Postgres (sqlx handles this)
    pub metadata: serde_json::Value,
    
    // Audit
    pub last_login_at: Option<DateTime<Utc>>,
    pub last_login_ip: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct CreateUserInput {
    #[validate(email)] 
    pub email: String,
    
    #[validate(length(min = 3, max = 30), regex(path = "*crate::utils::RE_USERNAME"))]
    pub username: Option<String>,
    
    #[validate(length(min = 12))] // NIST: Min 12 chars
    pub password: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Validate)]
pub struct UserLoginInput {
    #[validate(email)] 
    pub email: String,
    pub password: String,
}
