use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::{
    money::{NonNegativeAmount, PositiveAmount},
    scope::BusinessScope,
    time::BusinessDateContext,
};

#[test]
fn business_scope_keeps_tenant_and_optional_location_together() {
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let location_id = Uuid::new_v4();
    let scope = BusinessScope::new(organization_id, business_id, Some(location_id));

    assert_eq!(scope.organization_id, organization_id);
    assert_eq!(scope.business_id, business_id);
    assert_eq!(scope.location_id, Some(location_id));
}

#[test]
fn non_negative_amount_rejects_negative_values() {
    assert!(NonNegativeAmount::new(-1).is_err());
    assert_eq!(NonNegativeAmount::new(0).unwrap().value(), 0);
    assert_eq!(NonNegativeAmount::new(25).unwrap().value(), 25);
}

#[test]
fn positive_amount_rejects_zero_and_negative_values() {
    assert!(PositiveAmount::new(-1).is_err());
    assert!(PositiveAmount::new(0).is_err());
    assert_eq!(PositiveAmount::new(1).unwrap().value(), 1);
}

#[test]
fn business_date_uses_configured_timezone() {
    let ctx = BusinessDateContext::new("Asia/Jakarta").unwrap();
    let utc: DateTime<Utc> = DateTime::parse_from_rfc3339("2026-09-17T18:30:00Z")
        .unwrap()
        .with_timezone(&Utc);

    assert_eq!(ctx.local_date(utc).to_string(), "2026-09-18");
    assert_eq!(ctx.timezone_name(), "Asia/Jakarta");
}

#[test]
fn business_date_supports_all_indonesian_business_timezones_and_utc() {
    let utc: DateTime<Utc> = DateTime::parse_from_rfc3339("2026-09-17T16:30:00Z")
        .unwrap()
        .with_timezone(&Utc);

    assert_eq!(
        BusinessDateContext::new("UTC")
            .unwrap()
            .local_date(utc)
            .to_string(),
        "2026-09-17"
    );
    assert_eq!(
        BusinessDateContext::new("Asia/Jakarta")
            .unwrap()
            .local_date(utc)
            .to_string(),
        "2026-09-17"
    );
    assert_eq!(
        BusinessDateContext::new("Asia/Makassar")
            .unwrap()
            .local_date(utc)
            .to_string(),
        "2026-09-18"
    );
    assert_eq!(
        BusinessDateContext::new("Asia/Jayapura")
            .unwrap()
            .local_date(utc)
            .to_string(),
        "2026-09-18"
    );
}

#[test]
fn business_date_rejects_timezone_without_a_safe_runtime_mapping() {
    assert!(BusinessDateContext::new("Europe/London").is_err());
}
