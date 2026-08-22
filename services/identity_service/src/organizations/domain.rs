#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn organization_input_normalizes_name_and_slug() {
        let validated = validate_create_organization(
            "  Kedai   Kopi Nusantara  ",
            Some(" Kedai Kopi Nusantara "),
        )
        .expect("valid organization");

        assert_eq!(validated.name, "Kedai Kopi Nusantara");
        assert_eq!(validated.slug, "kedai-kopi-nusantara");
    }

    #[test]
    fn organization_input_rejects_empty_or_oversized_names() {
        assert!(validate_create_organization(" ", None).is_err());
        assert!(validate_create_organization(&"a".repeat(121), None).is_err());
    }

    #[test]
    fn organization_slug_requires_a_meaningful_identifier() {
        assert!(validate_create_organization("Usaha", Some("---")).is_err());
        assert!(validate_create_organization("Usaha", Some("ab")).is_err());
    }
}
