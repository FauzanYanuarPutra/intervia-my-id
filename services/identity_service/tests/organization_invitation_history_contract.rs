use chrono::{Duration, Utc};
use identity_service::organizations::invitation_status::effective_invitation_status;

#[test]
fn pending_invitation_past_expiry_is_exposed_as_expired() {
    let now = Utc::now();
    assert_eq!(
        effective_invitation_status("pending", now - Duration::minutes(1), now),
        "expired"
    );
}

#[test]
fn responded_invitation_keeps_its_terminal_status() {
    let now = Utc::now();
    assert_eq!(
        effective_invitation_status("accepted", now - Duration::days(2), now),
        "accepted"
    );
    assert_eq!(
        effective_invitation_status("rejected", now - Duration::days(2), now),
        "rejected"
    );
}

#[test]
fn unexpired_pending_invitation_stays_pending() {
    let now = Utc::now();
    assert_eq!(
        effective_invitation_status("pending", now + Duration::hours(1), now),
        "pending"
    );
}
