use super::finance_core::{
    cash_effect_for, normalize_allocation_bucket, FinanceCoreError, FinanceEntrySemantic,
};

#[test]
fn finance_core_migration_is_append_only_and_idempotent() {
    let migration = include_str!("../../migrations/20260915140000_finance_core_v2.up.sql");

    for required in [
        "business_finance_commands",
        "idempotency_key",
        "request_hash",
        "reversal_of_entry_id",
        "corrects_entry_id",
        "business_allocation_movements",
        "business_allocation_bucket_balances",
        "business_finance_account_balances",
        "business_finance_entry_corrections",
        "reject_business_finance_core_mutation",
    ] {
        assert!(
            migration.contains(required),
            "missing finance-core invariant: {required}"
        );
    }

    assert!(migration.contains("BEFORE UPDATE OR DELETE"));
    assert!(migration.contains("UNIQUE (business_id, idempotency_key)"));
}

#[test]
fn inventory_purchase_moves_cash_but_is_not_operating_expense() {
    let semantic = FinanceEntrySemantic::for_entry("inventory_purchase").unwrap();
    assert!(semantic.affects_inventory_asset);
    assert!(!semantic.is_operating_expense);
    assert_eq!(
        cash_effect_for("inventory_purchase", "cash", 125_000).unwrap(),
        -125_000
    );
}

#[test]
fn receivable_payment_moves_cash_without_creating_revenue_again() {
    let semantic = FinanceEntrySemantic::for_entry("receivable_payment").unwrap();
    assert!(!semantic.is_revenue);
    assert_eq!(
        cash_effect_for("receivable_payment", "bank", 250_000).unwrap(),
        250_000
    );
}

#[test]
fn receivable_sale_is_not_liquid_cash() {
    assert_eq!(
        cash_effect_for("sale_income", "receivable", 100_000).unwrap(),
        0
    );
}

#[test]
fn unknown_entry_type_or_account_fails_closed() {
    assert!(matches!(
        cash_effect_for("future_magic", "cash", 10_000),
        Err(FinanceCoreError::Validation(
            "unsupported_finance_entry_type"
        ))
    ));
    assert!(matches!(
        cash_effect_for("other_income", "typo-wallet", 10_000),
        Err(FinanceCoreError::Validation("unsupported_finance_account"))
    ));
}

#[test]
fn allocation_bucket_names_are_canonical_and_closed_set() {
    assert_eq!(normalize_allocation_bucket("owner").unwrap(), "owner");
    assert_eq!(normalize_allocation_bucket("gaji_tim").unwrap(), "team");
    assert_eq!(
        normalize_allocation_bucket("diputar_lagi").unwrap(),
        "reinvest"
    );
    assert_eq!(
        normalize_allocation_bucket("operasional").unwrap(),
        "operations"
    );
    assert_eq!(normalize_allocation_bucket("cadangan").unwrap(), "reserve");
    assert!(normalize_allocation_bucket("random").is_err());
}
