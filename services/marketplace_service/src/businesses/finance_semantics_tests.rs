use super::{
    control::{canonical_manual_finance_entry_type, ControlRepositoryError},
    finance_core::FinanceEntrySemantic,
};

#[test]
fn manual_sale_income_is_rejected_because_sales_own_that_ledger_effect() {
    assert!(matches!(
        canonical_manual_finance_entry_type("sale_income"),
        Err(ControlRepositoryError::Validation(
            "manual_sale_income_not_allowed"
        ))
    ));
}

#[test]
fn legacy_manual_finance_types_remain_readable_during_v2_migration() {
    assert_eq!(
        canonical_manual_finance_entry_type("transport_expense").unwrap(),
        "transport_expense"
    );
    assert_eq!(
        canonical_manual_finance_entry_type("owner_draw").unwrap(),
        "owner_draw"
    );
    assert_eq!(
        canonical_manual_finance_entry_type("capital_income").unwrap(),
        "capital_income"
    );
}

#[test]
fn finance_core_canonicalizes_all_historical_purchase_labels_to_inventory_purchase() {
    for entry_type in [
        "inventory_purchase",
        "inventory_expense",
        "ingredient_purchase",
        "packaging_purchase",
    ] {
        let semantic = FinanceEntrySemantic::for_entry(entry_type).unwrap();
        assert_eq!(semantic.canonical_type, "inventory_purchase");
        assert!(semantic.affects_inventory_asset);
        assert!(!semantic.is_operating_expense);
    }
}

#[test]
fn historical_non_inventory_labels_keep_their_legacy_canonical_types() {
    assert_eq!(
        canonical_manual_finance_entry_type("salary").unwrap(),
        "payroll_expense"
    );
    assert_eq!(
        canonical_manual_finance_entry_type("owner_drawing").unwrap(),
        "owner_draw"
    );
}
