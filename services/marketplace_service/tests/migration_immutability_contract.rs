use sha2::{Digest, Sha384};

const APPLIED_FINANCE_CORE_V2_SHA384: &str =
    "7392bf182473e2ac238437d7ec2f283a2316a5338f747a601f2be1274bca22542dab753a2f8cb3becf1c79623b80a663";

#[test]
fn applied_finance_core_v2_migration_remains_immutable() {
    let migration = include_bytes!("../migrations/20260915140000_finance_core_v2.up.sql");
    let actual = format!("{:x}", Sha384::digest(migration));

    assert_eq!(
        actual, APPLIED_FINANCE_CORE_V2_SHA384,
        "an already-applied SQLx migration was modified; restore it and add a new forward migration instead"
    );
}
