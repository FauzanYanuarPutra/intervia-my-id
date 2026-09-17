use chrono::{DateTime, Utc};

pub fn effective_invitation_status(
    status: &str,
    expires_at: DateTime<Utc>,
    now: DateTime<Utc>,
) -> &'static str {
    match status {
        "accepted" => "accepted",
        "rejected" => "rejected",
        "pending" if expires_at <= now => "expired",
        "pending" => "pending",
        _ => "unknown",
    }
}
