use super::inventory::{
    InventoryError, InventoryMutationRequest, InventoryOperation, InventoryRepository,
};
use rust_decimal::Decimal;
use sqlx::PgPool;
use uuid::Uuid;

struct SeededInventoryContext {
    owner_id: Uuid,
    organization_id: Uuid,
    business_id: Uuid,
    primary_location_id: Uuid,
    secondary_location_id: Uuid,
    ingredient_id: Uuid,
}

async fn seed_inventory_context(pool: &PgPool) -> SeededInventoryContext {
    let owner_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();
    let primary_location_id = Uuid::new_v4();
    let secondary_location_id = Uuid::new_v4();
    let ingredient_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO umkm_stores (
          id, owner_user_id, organization_id, name, slug, address, lat, lng
        ) VALUES ($1,$2,$3,'Lajukan Juice',$4,'Test address',-6.2,106.7)
        "#,
    )
    .bind(store_id)
    .bind(owner_id)
    .bind(organization_id)
    .bind(format!("inventory-test-{business_id}"))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Lajukan Juice','food_beverage','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(owner_id)
    .bind(Uuid::new_v4())
    .bind("7".repeat(64))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO business_store_links (business_id, store_id, link_type) VALUES ($1,$2,'primary')",
    )
    .bind(business_id)
    .bind(store_id)
    .execute(pool)
    .await
    .unwrap();

    for (location_id, code, name, primary) in [
        (primary_location_id, "MAIN", "Kios Utama", true),
        (secondary_location_id, "BRANCH-2", "Kios Kedua", false),
    ] {
        sqlx::query(
            r#"
            INSERT INTO business_locations (
              id, store_id, organization_id, business_id, name,
              branch_code, branch_kind, is_primary, public_visibility
            ) VALUES ($1,$2,$3,$4,$5,$6,'kiosk',$7,TRUE)
            "#,
        )
        .bind(location_id)
        .bind(store_id)
        .bind(organization_id)
        .bind(business_id)
        .bind(name)
        .bind(code)
        .bind(primary)
        .execute(pool)
        .await
        .unwrap();
    }

    sqlx::query(
        r#"
        INSERT INTO business_ingredients (
          id, business_id, organization_id, name, kind, purchase_unit, recipe_unit,
          conversion_factor, purchase_price_amount, purchase_quantity, yield_percent,
          waste_percent, stock_quantity, minimum_stock, status
        ) VALUES ($1,$2,$3,'Jeruk','ingredient','kg','g',1000,24000,1,100,0,100,20,'active')
        "#,
    )
    .bind(ingredient_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(pool)
    .await
    .unwrap();

    SeededInventoryContext {
        owner_id,
        organization_id,
        business_id,
        primary_location_id,
        secondary_location_id,
        ingredient_id,
    }
}

fn quantity_request(
    ingredient_id: Uuid,
    operation: InventoryOperation,
    quantity: Decimal,
    reason: Option<&str>,
) -> InventoryMutationRequest {
    InventoryMutationRequest {
        ingredient_id,
        operation,
        quantity: Some(quantity),
        quantity_delta: None,
        counted_quantity: None,
        reason: reason.map(str::to_owned),
        evidence_refs: vec![],
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn primary_balance_mirrors_legacy_stock_while_new_branch_starts_empty(pool: PgPool) {
    let seeded = seed_inventory_context(&pool).await;
    let repository = InventoryRepository::new(pool);

    let primary = repository
        .list_balances(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.primary_location_id,
        )
        .await
        .unwrap();
    let secondary = repository
        .list_balances(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.secondary_location_id,
        )
        .await
        .unwrap();

    assert_eq!(primary.len(), 1);
    assert_eq!(primary[0].quantity, Decimal::from(100));
    assert_eq!(secondary.len(), 1);
    assert_eq!(secondary[0].quantity, Decimal::ZERO);
}

#[sqlx::test(migrations = "./migrations")]
async fn secondary_branch_mutation_does_not_change_primary_compatibility_stock(pool: PgPool) {
    let seeded = seed_inventory_context(&pool).await;
    let repository = InventoryRepository::new(pool.clone());

    let outcome = repository
        .mutate(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.secondary_location_id,
            Uuid::new_v4(),
            quantity_request(
                seeded.ingredient_id,
                InventoryOperation::PurchaseReceipt,
                Decimal::from(25),
                None,
            ),
        )
        .await
        .unwrap();

    assert!(!outcome.replayed);
    assert_eq!(outcome.command.quantity_before, Decimal::ZERO);
    assert_eq!(outcome.command.quantity_after, Decimal::from(25));
    assert_eq!(
        outcome.movement.as_ref().unwrap().location_id,
        seeded.secondary_location_id
    );

    let legacy_stock: Decimal =
        sqlx::query_scalar("SELECT stock_quantity FROM business_ingredients WHERE id=$1")
            .bind(seeded.ingredient_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    let primary_balance: Decimal = sqlx::query_scalar(
        "SELECT quantity FROM business_ingredient_balances WHERE location_id=$1 AND ingredient_id=$2",
    )
    .bind(seeded.primary_location_id)
    .bind(seeded.ingredient_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    let secondary_balance: Decimal = sqlx::query_scalar(
        "SELECT quantity FROM business_ingredient_balances WHERE location_id=$1 AND ingredient_id=$2",
    )
    .bind(seeded.secondary_location_id)
    .bind(seeded.ingredient_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(legacy_stock, Decimal::from(100));
    assert_eq!(primary_balance, Decimal::from(100));
    assert_eq!(secondary_balance, Decimal::from(25));

    let audit_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_audit_events WHERE subject_type='business_inventory_command' AND subject_id=$1",
    )
    .bind(outcome.command.id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(audit_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn retry_is_exactly_once_and_evidence_order_is_canonical(pool: PgPool) {
    let seeded = seed_inventory_context(&pool).await;
    let repository = InventoryRepository::new(pool.clone());
    let idempotency_key = Uuid::new_v4();

    let mut first_request = quantity_request(
        seeded.ingredient_id,
        InventoryOperation::PurchaseReceipt,
        Decimal::from(10),
        None,
    );
    first_request.evidence_refs = vec!["receipt:B".into(), "receipt:A".into()];

    let first = repository
        .mutate(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.secondary_location_id,
            idempotency_key,
            first_request,
        )
        .await
        .unwrap();

    let mut retry_request = quantity_request(
        seeded.ingredient_id,
        InventoryOperation::PurchaseReceipt,
        Decimal::from(10),
        None,
    );
    retry_request.evidence_refs = vec!["receipt:A".into(), "receipt:B".into(), "receipt:A".into()];

    let replay = repository
        .mutate(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.secondary_location_id,
            idempotency_key,
            retry_request,
        )
        .await
        .unwrap();

    assert!(!first.replayed);
    assert!(replay.replayed);
    assert_eq!(replay.command.id, first.command.id);

    let balance: Decimal = sqlx::query_scalar(
        "SELECT quantity FROM business_ingredient_balances WHERE location_id=$1 AND ingredient_id=$2",
    )
    .bind(seeded.secondary_location_id)
    .bind(seeded.ingredient_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(balance, Decimal::from(10));

    let command_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_inventory_commands WHERE business_id=$1 AND idempotency_key=$2",
    )
    .bind(seeded.business_id)
    .bind(idempotency_key)
    .fetch_one(&pool)
    .await
    .unwrap();
    let movement_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM business_inventory_movements WHERE command_id=$1")
            .bind(first.command.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    let audit_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_audit_events WHERE subject_type='business_inventory_command' AND subject_id=$1",
    )
    .bind(first.command.id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(command_count, 1);
    assert_eq!(movement_count, 1);
    assert_eq!(audit_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn same_idempotency_key_with_different_business_effect_is_rejected(pool: PgPool) {
    let seeded = seed_inventory_context(&pool).await;
    let repository = InventoryRepository::new(pool);
    let key = Uuid::new_v4();

    repository
        .mutate(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.secondary_location_id,
            key,
            quantity_request(
                seeded.ingredient_id,
                InventoryOperation::PurchaseReceipt,
                Decimal::from(10),
                None,
            ),
        )
        .await
        .unwrap();

    let error = repository
        .mutate(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.secondary_location_id,
            key,
            quantity_request(
                seeded.ingredient_id,
                InventoryOperation::PurchaseReceipt,
                Decimal::from(11),
                None,
            ),
        )
        .await
        .unwrap_err();

    assert_eq!(error, InventoryError::IdempotencyConflict);
}

#[sqlx::test(migrations = "./migrations")]
async fn stocktake_noop_records_fact_without_inventing_stock_movement(pool: PgPool) {
    let seeded = seed_inventory_context(&pool).await;
    let repository = InventoryRepository::new(pool.clone());
    let key = Uuid::new_v4();

    let request = InventoryMutationRequest {
        ingredient_id: seeded.ingredient_id,
        operation: InventoryOperation::Stocktake,
        quantity: None,
        quantity_delta: None,
        counted_quantity: Some(Decimal::from(100)),
        reason: Some("closing stocktake".into()),
        evidence_refs: vec!["photo:count-sheet".into()],
    };

    let outcome = repository
        .mutate(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.primary_location_id,
            key,
            request,
        )
        .await
        .unwrap();

    assert_eq!(outcome.command.quantity_before, Decimal::from(100));
    assert_eq!(outcome.command.quantity_after, Decimal::from(100));
    assert!(outcome.movement.is_none());

    let movement_count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM business_inventory_movements WHERE command_id=$1")
            .bind(outcome.command.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    let audit_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_audit_events WHERE subject_type='business_inventory_command' AND subject_id=$1",
    )
    .bind(outcome.command.id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(movement_count, 0);
    assert_eq!(audit_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn insufficient_stock_has_no_command_movement_or_audit_side_effect(pool: PgPool) {
    let seeded = seed_inventory_context(&pool).await;
    let repository = InventoryRepository::new(pool.clone());

    let error = repository
        .mutate(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.secondary_location_id,
            Uuid::new_v4(),
            quantity_request(
                seeded.ingredient_id,
                InventoryOperation::Waste,
                Decimal::ONE,
                Some("spoiled"),
            ),
        )
        .await
        .unwrap_err();
    assert_eq!(error, InventoryError::InsufficientStock);

    let commands: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM business_inventory_commands WHERE business_id=$1")
            .bind(seeded.business_id)
            .fetch_one(&pool)
            .await
            .unwrap();
    let movements: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_inventory_movements WHERE business_id=$1 AND command_id IS NOT NULL",
    )
    .bind(seeded.business_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    let audits: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_audit_events WHERE business_id=$1 AND subject_type='business_inventory_command'",
    )
    .bind(seeded.business_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(commands, 0);
    assert_eq!(movements, 0);
    assert_eq!(audits, 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn location_scoped_role_cannot_read_or_mutate_another_branch(pool: PgPool) {
    let seeded = seed_inventory_context(&pool).await;
    let worker_id = Uuid::new_v4();
    let membership_id = Uuid::new_v4();
    let role_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO business_memberships (
          id, organization_id, business_id, user_id, status
        ) VALUES ($1,$2,$3,$4,'active')
        "#,
    )
    .bind(membership_id)
    .bind(seeded.organization_id)
    .bind(seeded.business_id)
    .bind(worker_id)
    .execute(&pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_roles (
          id, organization_id, business_id, role_key, name, is_system
        ) VALUES ($1,$2,$3,'inventory-clerk','Inventory Clerk',FALSE)
        "#,
    )
    .bind(role_id)
    .bind(seeded.organization_id)
    .bind(seeded.business_id)
    .execute(&pool)
    .await
    .unwrap();

    for permission in ["inventory.view", "inventory.manage"] {
        sqlx::query(
            "INSERT INTO business_role_permissions (role_id, permission_key) VALUES ($1,$2)",
        )
        .bind(role_id)
        .bind(permission)
        .execute(&pool)
        .await
        .unwrap();
    }

    sqlx::query(
        r#"
        INSERT INTO business_member_roles (
          organization_id, business_id, membership_id, role_id, location_id
        ) VALUES ($1,$2,$3,$4,$5)
        "#,
    )
    .bind(seeded.organization_id)
    .bind(seeded.business_id)
    .bind(membership_id)
    .bind(role_id)
    .bind(seeded.secondary_location_id)
    .execute(&pool)
    .await
    .unwrap();

    let repository = InventoryRepository::new(pool);
    repository
        .list_balances(
            worker_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.secondary_location_id,
        )
        .await
        .unwrap();

    let read_error = repository
        .list_balances(
            worker_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.primary_location_id,
        )
        .await
        .unwrap_err();
    assert_eq!(read_error, InventoryError::Forbidden);

    let write_error = repository
        .mutate(
            worker_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.primary_location_id,
            Uuid::new_v4(),
            quantity_request(
                seeded.ingredient_id,
                InventoryOperation::PurchaseReceipt,
                Decimal::ONE,
                None,
            ),
        )
        .await
        .unwrap_err();
    assert_eq!(write_error, InventoryError::Forbidden);
}

#[sqlx::test(migrations = "./migrations")]
async fn concurrent_receipts_do_not_lose_updates(pool: PgPool) {
    let seeded = seed_inventory_context(&pool).await;
    let repository_a = InventoryRepository::new(pool.clone());
    let repository_b = InventoryRepository::new(pool.clone());

    let a = repository_a.mutate(
        seeded.owner_id,
        seeded.business_id,
        seeded.organization_id,
        seeded.secondary_location_id,
        Uuid::new_v4(),
        quantity_request(
            seeded.ingredient_id,
            InventoryOperation::PurchaseReceipt,
            Decimal::from(10),
            None,
        ),
    );
    let b = repository_b.mutate(
        seeded.owner_id,
        seeded.business_id,
        seeded.organization_id,
        seeded.secondary_location_id,
        Uuid::new_v4(),
        quantity_request(
            seeded.ingredient_id,
            InventoryOperation::PurchaseReceipt,
            Decimal::from(10),
            None,
        ),
    );

    let (first, second) = tokio::join!(a, b);
    first.unwrap();
    second.unwrap();

    let balance: Decimal = sqlx::query_scalar(
        "SELECT quantity FROM business_ingredient_balances WHERE location_id=$1 AND ingredient_id=$2",
    )
    .bind(seeded.secondary_location_id)
    .bind(seeded.ingredient_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(balance, Decimal::from(20));
}

#[sqlx::test(migrations = "./migrations")]
async fn inventory_commands_and_movements_are_append_only(pool: PgPool) {
    let seeded = seed_inventory_context(&pool).await;
    let outcome = InventoryRepository::new(pool.clone())
        .mutate(
            seeded.owner_id,
            seeded.business_id,
            seeded.organization_id,
            seeded.secondary_location_id,
            Uuid::new_v4(),
            quantity_request(
                seeded.ingredient_id,
                InventoryOperation::PurchaseReceipt,
                Decimal::ONE,
                None,
            ),
        )
        .await
        .unwrap();

    let command_update =
        sqlx::query("UPDATE business_inventory_commands SET reason='tampered' WHERE id=$1")
            .bind(outcome.command.id)
            .execute(&pool)
            .await;
    let movement_delete =
        sqlx::query("DELETE FROM business_inventory_movements WHERE command_id=$1")
            .bind(outcome.command.id)
            .execute(&pool)
            .await;

    assert!(command_update.is_err());
    assert!(movement_delete.is_err());
}
