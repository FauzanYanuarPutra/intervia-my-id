use identity_service::backoffice::{
    is_backoffice_eligible, normalize_backoffice_target, parse_backoffice_roles, BackofficeRole,
    BackofficeTarget,
};

#[test]
fn provisioning_accepts_only_explicit_backoffice_roles() {
    let roles = parse_backoffice_roles("admin, content_admin,sales,support,admin")
        .expect("supported roles should parse");

    assert_eq!(
        roles,
        vec![
            BackofficeRole::Admin,
            BackofficeRole::ContentAdmin,
            BackofficeRole::Sales,
            BackofficeRole::Support,
        ]
    );

    assert!(parse_backoffice_roles("super_admin").is_err());
    assert!(parse_backoffice_roles("buyer").is_err());
    assert!(parse_backoffice_roles("").is_err());
}

#[test]
fn provisioning_target_distinguishes_email_and_username() {
    assert_eq!(
        normalize_backoffice_target(" Operator@Lajukan.com ").expect("valid email"),
        BackofficeTarget::Email("operator@lajukan.com".to_string())
    );
    assert_eq!(
        normalize_backoffice_target(" @Kasir.Utama ").expect("valid username"),
        BackofficeTarget::Username("kasir.utama".to_string())
    );
    assert_eq!(
        normalize_backoffice_target("kasir_utama").expect("valid username"),
        BackofficeTarget::Username("kasir_utama".to_string())
    );

    assert!(normalize_backoffice_target("@").is_err());
    assert!(normalize_backoffice_target("a").is_err());
}

#[test]
fn provisioning_requires_an_active_verified_real_account() {
    assert!(is_backoffice_eligible(true, false, true, false));
    assert!(is_backoffice_eligible(true, false, false, true));

    assert!(!is_backoffice_eligible(true, false, false, false));
    assert!(!is_backoffice_eligible(false, false, true, true));
    assert!(!is_backoffice_eligible(true, true, true, true));
}
