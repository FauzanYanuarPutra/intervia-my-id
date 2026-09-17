# Lajukan Usaha Flow Money Unit Contract

This companion contract is normative for `docs/superpowers/plans/2026-09-16-usaha-flow-system.md` and resolves the only unit ambiguity found during plan self-review.

## Existing storage units

- Public Marketplace catalog/order pricing uses `*_cents` integer fields.
- `business_products.price_label` is a human IDR string such as `Rp12.000`; existing `price_label_to_cents()` converts it to `1_200_000` cents.
- Business-control POS/finance uses integer Rupiah `*_amount` fields, so Rp12.000 is stored as `12_000`.
- The frontend product-configuration shared domain continues to use `price_delta_cents`, because it mirrors canonical modifier JSON and WWW public pricing.

## Required POS conversion boundary

The shared Marketplace modifier resolver returns `price_delta_cents`. POS sales must convert catalog cents to whole-Rupiah amounts exactly once at the boundary before calculating `business_sale_lines.unit_price_amount`.

Use an explicit checked helper equivalent to:

```rust
fn cents_to_whole_rupiah(cents: i64) -> Result<i64, SaleRepositoryError> {
    if cents % 100 != 0 {
        return Err(SaleRepositoryError::Validation(
            "modifier_price_requires_whole_rupiah",
        ));
    }
    Ok(cents / 100)
}
```

The canonical base price for POS is parsed from `business_products.price_label` directly into whole Rupiah, or derived from the existing cents parser with the same exact checked `/ 100` boundary. Do not add cents and Rupiah integers directly.

Authoritative POS calculation for a Rp12.000 product + Rp3.000 Boba is:

```text
base_price_amount       = 12_000 Rupiah
resolved delta cents    = 300_000 cents
modifier_delta_amount   = 3_000 Rupiah
authoritative unit      = 15_000 Rupiah
```

## Snapshot units

- Shared resolver/public-order `ModifierSnapshot.price_delta_cents` remains cents.
- POS `configuration_snapshot` should store `price_delta_amount` in Rupiah because the surrounding `business_sale_lines` financial fields use Rupiah.
- It may additionally retain `catalog_price_delta_cents` for audit clarity, but display/report logic must use the stored Rupiah amount consistently.

## Tests required during Tasks 7 and 12

Add explicit regression assertions:

```rust
assert_eq!(cents_to_whole_rupiah(300_000).unwrap(), 3_000);
assert!(cents_to_whole_rupiah(301).is_err());
```

and the full sale assertion:

```rust
assert_eq!(created.sale.lines[0].unit_price_amount, 15_000);
```

This contract overrides any wording in the main implementation plan that could be read as adding `price_delta_cents` directly to a Rupiah `*_amount` field.