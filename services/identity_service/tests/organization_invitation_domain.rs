use identity_service::organizations::domain::{normalize_invitee_username, validate_invitation_role};

#[test]
fn invite_username_is_normalized_like_lajukan_identity() {
    assert_eq!(normalize_invitee_username(" @Kasir.Utama ").unwrap(), "kasir.utama");
    assert_eq!(normalize_invitee_username("stok_01").unwrap(), "stok_01");
    assert!(normalize_invitee_username("@").is_err());
    assert!(normalize_invitee_username("a").is_err());
}

#[test]
fn invitation_accepts_only_business_scoped_roles() {
    for role in [
        "org_admin",
        "org_manager",
        "org_cashier",
        "org_inventory",
        "org_accounting",
        "org_viewer",
    ] {
        assert_eq!(validate_invitation_role(role).unwrap(), role);
    }

    assert!(validate_invitation_role("super_admin").is_err());
    assert!(validate_invitation_role("sales").is_err());
    assert!(validate_invitation_role("buyer").is_err());
}
