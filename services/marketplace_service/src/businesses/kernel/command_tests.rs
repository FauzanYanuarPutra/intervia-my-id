use super::command::canonical_request_hash;

#[test]
fn canonical_hash_ignores_object_key_insertion_order() {
    let a = serde_json::json!({
        "business_id": "b",
        "amount": 100,
        "meta": {"z": 1, "a": 2}
    });
    let b = serde_json::json!({
        "meta": {"a": 2, "z": 1},
        "amount": 100,
        "business_id": "b"
    });

    assert_eq!(
        canonical_request_hash(&a).unwrap(),
        canonical_request_hash(&b).unwrap()
    );
}

#[test]
fn canonical_hash_preserves_array_order() {
    let a = serde_json::json!({"lines": [1, 2]});
    let b = serde_json::json!({"lines": [2, 1]});

    assert_ne!(
        canonical_request_hash(&a).unwrap(),
        canonical_request_hash(&b).unwrap()
    );
}

#[test]
fn canonical_hash_is_stable_for_nested_objects_inside_arrays() {
    let a = serde_json::json!({
        "lines": [
            {"sku": "A", "meta": {"z": true, "a": false}},
            {"sku": "B", "qty": 2}
        ]
    });
    let b = serde_json::json!({
        "lines": [
            {"meta": {"a": false, "z": true}, "sku": "A"},
            {"qty": 2, "sku": "B"}
        ]
    });

    assert_eq!(
        canonical_request_hash(&a).unwrap(),
        canonical_request_hash(&b).unwrap()
    );
}
