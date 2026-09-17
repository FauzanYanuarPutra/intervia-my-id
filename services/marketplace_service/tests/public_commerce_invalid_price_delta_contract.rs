#[test]
fn public_commerce_maps_invalid_modifier_price_delta() {
    let source = include_str!("../src/businesses/public_commerce.rs");

    assert!(
        source.contains(
            "ModifierResolutionError::InvalidPriceDelta => \"invalid_modifier_price_delta\""
        ),
        "public commerce must map InvalidPriceDelta to a stable validation code"
    );
}
