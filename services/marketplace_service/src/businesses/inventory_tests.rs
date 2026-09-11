use super::inventory::{normalize_mutation, InventoryMutationRequest, InventoryOperation};
use rust_decimal::Decimal;
use uuid::Uuid;

fn base_request(operation: InventoryOperation) -> InventoryMutationRequest {
    InventoryMutationRequest {
        ingredient_id: Uuid::new_v4(),
        operation,
        quantity: None,
        quantity_delta: None,
        counted_quantity: None,
        reason: None,
        evidence_refs: vec![],
    }
}

#[test]
fn stock_in_and_out_operations_use_positive_quantities() {
    for operation in [
        InventoryOperation::PurchaseReceipt,
        InventoryOperation::Waste,
        InventoryOperation::ReturnIn,
        InventoryOperation::ReturnOut,
    ] {
        let mut request = base_request(operation);
        request.quantity = Some(Decimal::from(10));
        if matches!(
            operation,
            InventoryOperation::Waste | InventoryOperation::ReturnOut
        ) {
            request.reason = Some("operational reason".into());
        }
        assert!(normalize_mutation(request).is_ok());
    }
}

#[test]
fn adjustment_and_stocktake_are_explicit_and_reasoned() {
    let mut adjustment = base_request(InventoryOperation::Adjustment);
    adjustment.quantity_delta = Some(Decimal::from(-5));
    adjustment.reason = Some("verified recount".into());
    assert!(normalize_mutation(adjustment).is_ok());

    let mut stocktake = base_request(InventoryOperation::Stocktake);
    stocktake.counted_quantity = Some(Decimal::from(95));
    stocktake.reason = Some("closing stocktake".into());
    assert!(normalize_mutation(stocktake).is_ok());
}

#[test]
fn ambiguous_or_unreasoned_inventory_mutations_are_rejected() {
    let mut waste = base_request(InventoryOperation::Waste);
    waste.quantity = Some(Decimal::from(5));
    assert!(normalize_mutation(waste).is_err());

    let mut stocktake = base_request(InventoryOperation::Stocktake);
    stocktake.quantity = Some(Decimal::ONE);
    stocktake.counted_quantity = Some(Decimal::ONE);
    stocktake.reason = Some("count".into());
    assert!(normalize_mutation(stocktake).is_err());

    let mut adjustment = base_request(InventoryOperation::Adjustment);
    adjustment.quantity_delta = Some(Decimal::ZERO);
    adjustment.reason = Some("count".into());
    assert!(normalize_mutation(adjustment).is_err());
}
