    use super::{
        apply_reel_privacy_metadata, clean_store_reference, database_session_setup,
        has_valid_media_signature, normalize_reel_action, normalize_trust_report_reason,
        parse_media_range, resolve_reel_privacy, safe_public_display_name, sanitize_reel_metadata,
        sanitize_report_details, is_migration_unique_conflict_message,
        DatabasePoolPurpose, MAX_MEDIA_RANGE_BYTES,
    };
    use serde_json::json;

    #[test]
    fn migration_pool_keeps_the_canonical_public_migration_tracker() {
        assert_eq!(database_session_setup(DatabasePoolPurpose::Migration), None);
        assert_eq!(
            database_session_setup(DatabasePoolPurpose::Application),
            Some("SET search_path TO forum, reel, public, events")
        );
    }

    #[test]
    fn migration_unique_conflict_is_retried_only_for_the_sqlx_migration_tracker() {
        assert!(is_migration_unique_conflict_message(
            "duplicate key value violates unique constraint \"_sqlx_migrations_pkey\""
        ));
        assert!(!is_migration_unique_conflict_message(
            "duplicate key value violates unique constraint \"some_other_table_pkey\""
        ));
        assert!(!is_migration_unique_conflict_message(
            "was previously applied but has been modified"
        ));
    }

    #[test]
    fn media_signatures_reject_active_content_disguised_as_an_image() {
        assert!(has_valid_media_signature(
            &[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a],
            ".png"
        ));
        assert!(!has_valid_media_signature(
            b"<svg><script>alert(1)</script></svg>",
            ".png"
        ));
    }

    #[test]
    fn media_ranges_are_bounded_and_invalid_ranges_are_rejected() {
        let total = MAX_MEDIA_RANGE_BYTES * 3;
        assert_eq!(
            parse_media_range("bytes=0-", total),
            Some((0, MAX_MEDIA_RANGE_BYTES - 1))
        );
        assert_eq!(parse_media_range("bytes=99-100", 20), None);
        assert_eq!(parse_media_range("bytes=0-1,4-5", total), None);
    }

    #[test]
    fn trust_safety_actions_and_reasons_are_allowlisted() {
        assert_eq!(
            normalize_reel_action(Some(" Not_Interested ".to_string())).unwrap(),
            "not_interested"
        );
        assert!(normalize_reel_action(Some("report".to_string())).is_err());
        assert_eq!(
            normalize_trust_report_reason(Some(" Scam ".to_string())).unwrap(),
            "scam"
        );
        assert!(normalize_trust_report_reason(Some("because".to_string())).is_err());
    }

    #[test]
    fn trust_report_details_are_trimmed_and_bounded() {
        assert_eq!(
            sanitize_report_details(Some("  bukti ringkas  ".to_string())).as_deref(),
            Some("bukti ringkas")
        );
        assert_eq!(
            sanitize_report_details(Some("x".repeat(1200)))
                .unwrap()
                .chars()
                .count(),
            1000
        );
    }

    #[test]
    fn reel_privacy_accepts_legacy_metadata_shapes_and_rejects_unknown_visibility() {
        let camel_case = json!({
            "publishingPreferences": {
                "visibility": "followers",
                "allowComments": false
            }
        });
        assert_eq!(
            resolve_reel_privacy(None, None, &camel_case, None).unwrap(),
            ("followers".to_string(), false)
        );

        let snake_case = json!({
            "visibility": "private",
            "allow_comments": "0"
        });
        assert_eq!(
            resolve_reel_privacy(None, None, &snake_case, None).unwrap(),
            ("private".to_string(), false)
        );
        assert!(resolve_reel_privacy(Some("friends".to_string()), None, &json!({}), None).is_err());
    }

    #[test]
    fn reel_privacy_metadata_is_canonicalized_for_compatible_clients() {
        let mut metadata = json!({"publishingPreferences": {"shareToMainFeed": true}});
        apply_reel_privacy_metadata(&mut metadata, "private", false);
        assert_eq!(metadata["visibility"], json!("private"));
        assert_eq!(metadata["allowComments"], json!(false));
        assert_eq!(metadata["allow_comments"], json!(false));
        assert_eq!(
            metadata["publishingPreferences"]["visibility"],
            json!("private")
        );
        assert_eq!(
            metadata["publishingPreferences"]["allowComments"],
            json!(false)
        );
    }

    #[test]
    fn reel_metadata_and_creator_identity_do_not_leak_contact_fields() {
        let metadata = sanitize_reel_metadata(Some(json!({
            "storePhone": "+62 812 0000 0000",
            "creatorEmail": "owner@example.test",
            "creator": "Spoofed Creator",
            "linkedStoreId": "spoofed-store",
            "studio": {"phone": "+62 811 0000 0000", "filter": "warm"}
        })));
        assert!(metadata.get("storePhone").is_none());
        assert!(metadata.get("creatorEmail").is_none());
        assert!(metadata.get("creator").is_none());
        assert!(metadata.get("linkedStoreId").is_none());
        assert!(metadata["studio"].get("phone").is_none());
        assert_eq!(metadata["studio"]["filter"], json!("warm"));
        assert_eq!(
            safe_public_display_name("owner@example.test"),
            "Pengguna Lajukan"
        );
        assert_eq!(safe_public_display_name("  Toko Aman  "), "Toko Aman");
    }

    #[test]
    fn store_references_are_tightly_allowlisted() {
        assert_eq!(
            clean_store_reference(Some(" toko-kopi_01 ")).as_deref(),
            Some("toko-kopi_01")
        );
        assert!(clean_store_reference(Some("../../internal")).is_none());
        assert!(clean_store_reference(Some("toko?owner=lain")).is_none());
    }
