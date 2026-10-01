use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use super::{
    domain::{
        BusinessInput, OrganizationMode, OrganizationSelection,
        PrimaryLocationInput, ProvisionBusinessRequest, StorefrontInput,
    },
    profile::BusinessProfileInput,
    repository::BusinessRepository,
    reset::{DataResetRepository, ResetRequest, ResetScope},
};

fn provision_request(organization_id: Uuid) -> ProvisionBusinessRequest {
    ProvisionBusinessRequest {
        organization: OrganizationSelection {
            mode: OrganizationMode::Existing,
            organization_id: Some(organization_id),
            new_organization_name: None,
        },
        business: BusinessInput {
            name: "Reset Integration Test".to_owned(),
            capability_key: "general".to_owned(),
            profile: Some(BusinessProfileInput::default()),
        },
        primary_location: PrimaryLocationInput {
            name: "Lokasi utama".to_owned(),
            address: "Jl. Reset Test 1".to_owned(),
            city: "Jakarta".to_owned(),
            lat: Some(-6.2),
            lng: Some(106.8),
            phone: Some("+628111111111".to_owned()),
            public_visibility: true,
        },
        storefront: StorefrontInput {
            description: Some("reset integration test".to_owned()),
            online_order_enabled: true,
            offline_order_enabled: true,
            public_metadata: json!({"category": "test"}),
        },
    }
}

fn reset_request() -> ResetRequest {
    ResetRequest {
        scopes: vec![
            ResetScope::FinanceActivity,
            ResetScope::OwnerCapital,
            ResetScope::SalesTransactions,
            ResetScope::Inventory,
            ResetScope::Products,
        ],
        reason: "integration reset".to_owned(),
        confirmation: "MULAI DARI NOL".to_owned(),
        effective_on: None,
    }
}

async fn provision_business(pool: &PgPool) -> (Uuid, Uuid, Uuid) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let provisioned = BusinessRepository::new(pool.clone())
        .provision(
            actor_id,
            Uuid::new_v4(),
            organization_id,
            &super::domain::validate_provision_request(provision_request(organization_id))
                .expect("reset integration seed request is valid"),
        )
        .await
        .expect("business provision succeeds");

    (
        actor_id,
        organization_id,
        provisioned.aggregate.business.id,
    )
}

#[sqlx::test(migrations = "./migrations")]
async fn reset_preview_covers_the_complete_storage_contract(pool: PgPool) {
    let (_actor_id, organization_id, business_id) = provision_business(&pool).await;

    let preview = DataResetRepository::new(pool.clone())
        .preview(
            business_id,
            organization_id,
            &reset_request().scopes,
        )
        .await
        .expect("reset preview succeeds against migrated schema");

    assert!(preview.can_apply);
    assert_eq!(preview.counts.finance_activity, 0);
    assert_eq!(preview.counts.owner_capital, 0);
    assert_eq!(preview.counts.sales_transactions, 0);
    assert_eq!(preview.counts.inventory_product_records, 0);
    assert_eq!(preview.counts.inventory_ingredient_records, 0);
    assert_eq!(preview.counts.active_products, 0);
    assert_eq!(preview.counts.active_recipes, 0);
}

#[sqlx::test(migrations = "./migrations")]
async fn reset_apply_is_completed_and_idempotent(pool: PgPool) {
    let (actor_id, organization_id, business_id) = provision_business(&pool).await;
    let idempotency_key = Uuid::new_v4();
    let repository = DataResetRepository::new(pool.clone());
    let request = reset_request();

    let first = repository
        .apply(
            actor_id,
            business_id,
            organization_id,
            idempotency_key,
            request.clone(),
        )
        .await
        .expect("first reset succeeds");

    assert_eq!(first.status, "completed");
    assert_eq!(first.scopes.len(), 5);

    let replay = repository
        .apply(
            actor_id,
            business_id,
            organization_id,
            idempotency_key,
            request,
        )
        .await
        .expect("same reset replays safely");

    assert_eq!(replay.id, first.id);
    assert_eq!(replay.status, "completed");

    let batch_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_data_reset_batches WHERE business_id=$1 AND idempotency_key=$2",
    )
    .bind(business_id)
    .bind(idempotency_key)
    .fetch_one(&pool)
    .await
    .expect("reset batch exists");

    assert_eq!(batch_count, 1);
}
