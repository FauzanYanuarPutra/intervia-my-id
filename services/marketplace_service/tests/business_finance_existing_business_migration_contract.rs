const REQUIRED_ENTRY_TYPES: &[&str] = &[
    "sale_income",
    "sale_refund",
    "other_income",
    "capital_income",
    "owner_capital",
    "receivable_payment",
    "ingredient_purchase",
    "packaging_purchase",
    "inventory_purchase",
    "inventory_expense",
    "payroll_expense",
    "salary",
    "rent_expense",
    "rent",
    "utilities_expense",
    "utilities",
    "transport_expense",
    "transport",
    "marketing_expense",
    "marketing",
    "equipment_expense",
    "equipment",
    "owner_draw",
    "owner_drawing",
    "payable_payment",
    "other_expense",
    "opening_balance",
    "account_transfer",
];

const REQUIRED_OPERATIONS: &[&str] = &[
    "create_entry",
    "correct_entry",
    "move_allocation",
    "transfer_accounts",
];

#[test]
fn existing_business_finance_migration_accepts_full_ledger_vocabulary() {
    let migration =
        include_str!("../migrations/20260921090000_business_finance_existing_business.up.sql");

    for entry_type in REQUIRED_ENTRY_TYPES {
        assert!(
            migration.contains(&format!("'{entry_type}'")),
            "migration must preserve finance entry type {entry_type}"
        );
    }

    for operation in REQUIRED_OPERATIONS {
        assert!(
            migration.contains(&format!("'{operation}'")),
            "migration must preserve finance command operation {operation}"
        );
    }

    assert!(
        migration.contains("CREATE OR REPLACE VIEW business_finance_account_balances"),
        "migration must keep the authoritative account balance view"
    );
}
