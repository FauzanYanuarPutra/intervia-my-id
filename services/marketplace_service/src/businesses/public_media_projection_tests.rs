use serde_json::json;

use super::domain::project_public_store_details;

#[test]
fn canonical_nested_public_brand_media_is_projected_without_private_metadata() {
    let projected = project_public_store_details(&json!({
        "public": {
            "logo_url": "/api/forum/media/logo.webp",
            "banner_url": "/api/forum/media/banner.webp",
            "cover_image_url": "/api/forum/media/banner.webp",
            "private_note": "never expose this"
        },
        "internal_note": "never expose this either"
    }));

    assert_eq!(projected["logo_url"], "/api/forum/media/logo.webp");
    assert_eq!(projected["banner_url"], "/api/forum/media/banner.webp");
    assert_eq!(
        projected["cover_image_url"],
        "/api/forum/media/banner.webp"
    );
    assert!(!projected.contains_key("private_note"));
    assert!(!projected.contains_key("internal_note"));
    assert!(!projected.contains_key("public"));
}

#[test]
fn legacy_flat_public_brand_media_remains_supported() {
    let projected = project_public_store_details(&json!({
        "logo_url": "/api/forum/media/legacy-logo.webp",
        "banner_url": "/api/forum/media/legacy-banner.webp"
    }));

    assert_eq!(
        projected["logo_url"],
        "/api/forum/media/legacy-logo.webp"
    );
    assert_eq!(
        projected["banner_url"],
        "/api/forum/media/legacy-banner.webp"
    );
}
