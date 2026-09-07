#[cfg(test)]
mod tests {
    use super::{ProvisionAccess, ProvisionCommand};

    fn command(arguments: &[&str]) -> Result<ProvisionCommand, super::ProvisionCommandError> {
        ProvisionCommand::parse(arguments.iter().map(|argument| argument.to_string()))
    }

    #[test]
    fn maps_access_profiles_to_the_exact_allowlisted_roles() {
        assert_eq!(ProvisionAccess::Cms.role_names(), &["content_admin"]);
        assert_eq!(ProvisionAccess::Crm.role_names(), &["sales", "support"]);
        assert_eq!(
            ProvisionAccess::Both.role_names(),
            &["admin", "content_admin", "sales", "support"]
        );
    }

    #[test]
    fn rejects_missing_unknown_and_repeated_flags() {
        assert!(command(&[]).is_err());
        assert!(command(&["--identifier", "operator"]).is_err());
        assert!(command(&["--access", "cms"]).is_err());
        assert!(command(&["--identifier", "operator", "--access", "unknown"]).is_err());
        assert!(command(&[
            "--identifier",
            "operator",
            "--identifier",
            "another",
            "--access",
            "cms",
        ])
        .is_err());
        assert!(command(&[
            "--identifier",
            "operator",
            "--access",
            "cms",
            "--access",
            "crm",
        ])
        .is_err());
        assert!(command(&["--unknown", "value"]).is_err());
    }

    #[test]
    fn normalizes_identifiers_without_accepting_empty_or_control_values() {
        let parsed = command(&["--identifier", "  @Operator  ", "--access", "cms"])
            .expect("identifier should be normalized");
        assert_eq!(parsed.identifier(), "operator");

        assert!(command(&["--identifier", "  @  ", "--access", "cms"]).is_err());
        assert!(command(&["--identifier", "oper\nator", "--access", "cms"]).is_err());
        assert!(command(&["--identifier", "operator\u{0000}", "--access", "cms"]).is_err());
    }
}
