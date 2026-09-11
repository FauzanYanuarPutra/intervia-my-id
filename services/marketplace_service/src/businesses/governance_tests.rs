use super::governance::{normalize_branch_code, validate_branch_kind, GovernanceError};

#[test]
fn branch_code_is_normalized_without_changing_identity_semantics() {
    assert_eq!(normalize_branch_code(" main ").unwrap(), "MAIN");
    assert_eq!(normalize_branch_code("ciputat-01").unwrap(), "CIPUTAT-01");
}

#[test]
fn branch_code_rejects_blank_or_unsafe_values() {
    assert!(matches!(normalize_branch_code("   "), Err(GovernanceError::Validation(_))));
    assert!(matches!(normalize_branch_code("a/b"), Err(GovernanceError::Validation(_))));
    assert!(matches!(normalize_branch_code("branch code"), Err(GovernanceError::Validation(_))));
}

#[test]
fn branch_kind_is_closed_to_canonical_values() {
    for kind in ["store", "kiosk", "office", "warehouse", "service_area", "online"] {
        assert!(validate_branch_kind(kind).is_ok(), "{kind} should be valid");
    }
    assert!(matches!(validate_branch_kind("legal_entity"), Err(GovernanceError::Validation(_))));
}

#[test]
fn permission_denial_has_a_stable_non_storage_error() {
    let error = GovernanceError::Forbidden;
    assert_eq!(error.to_string(), "forbidden");
}
