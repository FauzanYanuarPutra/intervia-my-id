use chrono::{DateTime, Utc};
use uuid::Uuid;

use super::{
    money::{CurrencyCode, NonNegativeAmount, PositiveAmount, ScaledMoney},
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
fn business_scope_can_be_created_without_location_then_scoped_to_one() {
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let location_id = Uuid::new_v4();

    let business_scope = BusinessScope::without_location(organization_id, business_id);
    assert_eq!(business_scope.organization_id, organization_id);
    assert_eq!(business_scope.business_id, business_id);
    assert_eq!(business_scope.location_id, None);

    let location_scope = business_scope.at_location(location_id);
    assert_eq!(location_scope.organization_id, organization_id);
    assert_eq!(location_scope.business_id, business_id);
    assert_eq!(location_scope.location_id, Some(location_id));
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
fn currency_code_is_canonical_and_strict() {
    assert_eq!(CurrencyCode::new(" idr ").unwrap().as_str(), "IDR");
    assert!(CurrencyCode::new("RP").is_err());
    assert!(CurrencyCode::new("IDR1").is_err());
}

#[test]
fn scaled_money_rejects_mixed_currency_and_scale() {
    let idr = ScaledMoney::new(10_000, "IDR", 0).unwrap();
    let usd = ScaledMoney::new(10_000, "USD", 2).unwrap();
    let scaled_idr = ScaledMoney::new(10_000, "IDR", 2).unwrap();

    assert!(idr.checked_add(&usd).is_err());
    assert!(idr.checked_add(&scaled_idr).is_err());
}

#[test]
fn scaled_money_uses_checked_arithmetic_and_exact_decimal_conversion() {
    let unit = ScaledMoney::positive(12_345, "IDR", 2).unwrap();
    let line = unit.checked_mul_i64(3).unwrap();
    assert_eq!(line.minor_units(), 37_035);
    assert_eq!(line.currency(), "IDR");
    assert_eq!(line.scale(), 2);
    assert_eq!(line.to_decimal().to_string(), "370.35");

    let subtotal = ScaledMoney::zero("IDR", 2)
        .unwrap()
        .checked_add(&line)
        .unwrap();
    assert_eq!(subtotal.to_decimal().to_string(), "370.35");
    assert!(ScaledMoney::new(i64::MAX, "IDR", 0)
        .unwrap()
        .checked_add(&ScaledMoney::new(1, "IDR", 0).unwrap())
        .is_err());
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
