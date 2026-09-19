use serde_json::{json, Value};

pub(crate) fn is_public_reference_response_metadata(metadata: &Value) -> bool {
    let record_kind = metadata
        .get("record_kind")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    let market_side = metadata
        .get("market_side")
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_ascii_lowercase();
    let explicitly_non_transactional = metadata.get("is_transactional").and_then(|value| {
        value
            .as_bool()
            .or_else(|| value.as_str().map(|raw| raw.eq_ignore_ascii_case("true")))
    }) == Some(false);

    record_kind.contains("reference")
        && (market_side == "reference" || explicitly_non_transactional)
}

fn project_reference_scalar(value: &Value) -> Option<Value> {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) => Some(value.clone()),
        Value::String(text) => Some(Value::String(text.chars().take(4_096).collect())),
        Value::Array(items) => Some(Value::Array(
            items
                .iter()
                .filter_map(|item| item.as_str())
                .take(12)
                .map(|text| Value::String(text.chars().take(2_048).collect()))
                .collect(),
        )),
        Value::Object(_) => None,
    }
}

fn project_reference_object(value: Option<&Value>, allowed: &[&str]) -> Option<Value> {
    let source = value?.as_object()?;
    let mut projected = serde_json::Map::new();
    for key in allowed {
        if let Some(value) = source.get(*key).and_then(project_reference_scalar) {
            projected.insert((*key).to_string(), value);
        }
    }
    (!projected.is_empty()).then_some(Value::Object(projected))
}

fn project_public_reference_metadata(metadata: &Value) -> Value {
    const ALLOWED_FIELDS: &[&str] = &[
        "record_kind",
        "market_side",
        "listing_side",
        "is_transactional",
        "business_discovery_category",
        "create_category",
        "marketplace_category_slug",
        "marketplace_subcategory_slug",
        "category",
        "category_label",
        "sub_category",
        "subcategory",
        "city",
        "location",
        "address",
        "latitude",
        "longitude",
        "external_id",
        "source_dataset",
        "source_url",
        "source_title",
        "source_license",
        "source_license_url",
        "source_accessed_at",
        "trust_note",
        "cover_image",
        "image_url",
        "image_urls",
        "gallery_images",
        "image_attribution",
        "image_source_provider",
        "media_kind",
        "media_is_place_specific",
        "media_storage",
        "media_asset_id",
        "media_downloaded_at",
        "media_license_key",
        "media_match_confidence",
        "media_match_method",
        "opening_hours",
        "osm_id",
        "osm_type",
        "osm_primary_key",
        "osm_primary_value",
        "wikidata",
        "wikimedia_commons",
        "brand",
        "brand_wikidata",
        "operator",
        "operator_wikidata",
        "seed_pack",
    ];
    const SOURCE_FIELDS: &[&str] = &[
        "title",
        "url",
        "license",
        "license_url",
        "accessed_at",
        "attribution",
        "author",
    ];
    const IMAGE_CREDIT_FIELDS: &[&str] = &[
        "provider",
        "author",
        "license",
        "license_name",
        "license_url",
        "source_url",
        "original_url",
        "attribution",
    ];

    let Some(source) = metadata.as_object() else {
        return json!({});
    };
    let mut projected = serde_json::Map::new();
    for key in ALLOWED_FIELDS {
        if let Some(value) = source.get(*key).and_then(project_reference_scalar) {
            projected.insert((*key).to_string(), value);
        }
    }
    if let Some(value) = project_reference_object(source.get("source"), SOURCE_FIELDS) {
        projected.insert("source".to_string(), value);
    }
    if let Some(value) = project_reference_object(source.get("image_credit"), IMAGE_CREDIT_FIELDS) {
        projected.insert("image_credit".to_string(), value);
    }
    Value::Object(projected)
}

pub(crate) fn project_content_response_metadata(metadata: Value) -> Value {
    if is_public_reference_response_metadata(&metadata) {
        project_public_reference_metadata(&metadata)
    } else {
        metadata
    }
}
