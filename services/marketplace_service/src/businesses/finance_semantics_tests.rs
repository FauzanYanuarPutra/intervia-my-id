use super::control::{canonical_manual_finance_entry_type, ControlRepositoryError};

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
fn canonical_finance_types_are_accepted() {
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
fn historical_manual_labels_normalize_to_canonical_types() {
    assert_eq!(
        canonical_manual_finance_entry_type("ingredient_purchase").unwrap(),
        "inventory_expense"
    );
    assert_eq!(
        canonical_manual_finance_entry_type("packaging_purchase").unwrap(),
        "inventory_expense"
    );
    assert_eq!(
        canonical_manual_finance_entry_type("salary").unwrap(),
        "payroll_expense"
    );
    assert_eq!(
        canonical_manual_finance_entry_type("owner_drawing").unwrap(),
        "owner_draw"
    );
}
