use std::{fs, path::PathBuf};

fn repo_root() -> PathBuf {
    PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .join("../..")
        .canonicalize()
        .expect("repository root")
}

#[test]
fn pos_modifier_money_boundary_requires_whole_rupiah() {
    let root = repo_root();
    let source = fs::read_to_string(
        root.join("services/marketplace_service/src/businesses/product_modifiers.rs"),
    )
    .expect("product modifier source");

    assert!(
        source.contains("price_delta_cents % 100"),
        "canonical modifier writes must reject cent values that cannot convert exactly to integer Rupiah"
    );
}

#[test]
fn sale_configuration_snapshot_has_forward_only_migration() {
    let root = repo_root();
    let up = root.join(
        "services/marketplace_service/migrations/20260916120000_business_sale_configuration_snapshot.up.sql",
    );
    let down = root.join(
        "services/marketplace_service/migrations/20260916120000_business_sale_configuration_snapshot.down.sql",
    );

    assert!(up.exists(), "configuration snapshot up migration is required");
    assert!(down.exists(), "configuration snapshot down migration is required");
    let sql = fs::read_to_string(up).expect("snapshot migration");
    assert!(sql.contains("configuration_snapshot"));
    assert!(sql.contains("line_note"));
    assert!(sql.contains("cost_snapshot"));
}
