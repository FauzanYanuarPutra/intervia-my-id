use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

use super::{
    domain::{
        validate_business_profile_update, validate_provision_request, BusinessInput,
        BusinessProfileUpdateRequest, OrganizationMode, OrganizationSelection,
        PrimaryLocationInput, ProvisionBusinessRequest, StorefrontInput,
    },
    media::BusinessImageInput,
    profile::BusinessProfileInput,
    repository::{BusinessRepository, RepositoryError},
};

fn request(organization_id: Uuid, template_key: &str, name: &str) -> ProvisionBusinessRequest {
    ProvisionBusinessRequest {
        organization: OrganizationSelection {
            mode: OrganizationMode::Existing,
            organization_id: Some(organization_id),
            new_organization_name: None,
        },
        business: BusinessInput {
            name: name.to_owned(),
            capability_key: "general".to_owned(),
            profile: Some(BusinessProfileInput {
                template_key: template_key.to_owned(),
                ..BusinessProfileInput::default()
            }),
        },
        primary_location: PrimaryLocationInput {
            name: "Lokasi utama".to_owned(),
            address: "Jl. Contoh 1".to_owned(),
            city: "Jakarta".to_owned(),
            lat: Some(-6.2),
            lng: Some(106.8),
            phone: Some("+628111111111".to_owned()),
            public_visibility: true,
        },
        storefront: StorefrontInput {
            description: None,
            online_order_enabled: true,
            offline_order_enabled: true,
            public_metadata: json!({"category": "Laundry"}),
        },
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn explicit_template_is_persisted_and_replayed_atomically(pool: PgPool) {
    let repository = BusinessRepository::new(pool.clone());
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let idempotency_key = Uuid::new_v4();
    let command = validate_provision_request(request(organization_id, "laundry", "Bersih Kilat"))
        .expect("valid laundry provisioning command");

    let first = repository
        .provision(actor_id, idempotency_key, organization_id, &command)
        .await
        .expect("first provision succeeds");

    assert!(!first.replayed);
    assert_eq!(first.aggregate.business.capability_key, "services");
    assert_eq!(first.aggregate.profile.template_key, "laundry");
    assert_eq!(first.aggregate.profile.currency, "IDR");
    assert_eq!(first.aggregate.profile.timezone, "Asia/Jakarta");
    assert_eq!(first.aggregate.profile.document_prefix, "LDR");
    assert!(first
        .aggregate
        .capabilities
        .iter()
        .any(|capability| capability.enabled && capability.capability_key == "laundry_tracking"));
    assert!(!first
        .aggregate
        .capabilities
        .iter()
        .any(|capability| capability.enabled && capability.capability_key == "field_service"));

    let replay = repository
        .provision(actor_id, idempotency_key, organization_id, &command)
        .await
        .expect("idempotent replay succeeds");
    assert!(replay.replayed);
    assert_eq!(replay.aggregate.business.id, first.aggregate.business.id);
    assert_eq!(replay.aggregate.profile.template_key, "laundry");

    let profile_count: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_profiles WHERE business_id = $1 AND organization_id = $2",
    )
    .bind(first.aggregate.business.id)
    .bind(organization_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(profile_count, 1);
}

#[sqlx::test(migrations = "./migrations")]
async fn replay_with_a_different_template_is_rejected(pool: PgPool) {
    let repository = BusinessRepository::new(pool);
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let idempotency_key = Uuid::new_v4();
    let laundry = validate_provision_request(request(organization_id, "laundry", "Usaha Cuk"))
        .expect("valid laundry command");
    repository
        .provision(actor_id, idempotency_key, organization_id, &laundry)
        .await
        .expect("first provision succeeds");

    let mart = validate_provision_request(request(organization_id, "mart_retail", "Usaha Cuk"))
        .expect("valid mart command");
    let error = repository
        .provision(actor_id, idempotency_key, organization_id, &mart)
        .await
        .expect_err("same idempotency key cannot change the template");
    assert!(matches!(error, RepositoryError::IdempotencyConflict));
}

#[sqlx::test(migrations = "./migrations")]
async fn aggregate_loading_is_scoped_to_the_owning_organization(pool: PgPool) {
    let repository = BusinessRepository::new(pool);
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let other_organization_id = Uuid::new_v4();
    let command =
        validate_provision_request(request(organization_id, "ac_field_service", "Lajukan AC"))
            .expect("valid AC command");

    let provisioned = repository
        .provision(actor_id, Uuid::new_v4(), organization_id, &command)
        .await
        .expect("provision succeeds");

    let own = repository
        .get_for_organization(provisioned.aggregate.business.id, organization_id)
        .await
        .expect("own scope query succeeds");
    assert_eq!(own.unwrap().profile.template_key, "ac_field_service");

    let cross_tenant = repository
        .get_for_organization(provisioned.aggregate.business.id, other_organization_id)
        .await
        .expect("cross-scope query is handled safely");
    assert!(cross_tenant.is_none());
}

#[sqlx::test(migrations = "./migrations")]
async fn logo_and_banner_updates_are_validated_and_projected_atomically(pool: PgPool) {
    let repository = BusinessRepository::new(pool.clone());
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let provisioned = repository
        .provision(
            actor_id,
            Uuid::new_v4(),
            organization_id,
            &validate_provision_request(request(organization_id, "juice_fnb", "Lajukan Juice"))
                .unwrap(),
        )
        .await
        .unwrap();
    let current = provisioned.aggregate;

    let command = validate_business_profile_update(BusinessProfileUpdateRequest {
        expected_version: current.business.version,
        name: current.business.name.clone(),
        capability_key: current.business.capability_key.clone(),
        category: "Minuman".to_owned(),
        description: current.primary_store.description.clone(),
        schedule: "08.00 - 20.00".to_owned(),
        location_query: "Jl. Contoh 1, Jakarta".to_owned(),
        primary_location: PrimaryLocationInput {
            name: current.primary_location.name.clone(),
            address: current.primary_location.address.clone(),
            city: current.primary_location.city.clone(),
            lat: current.primary_location.lat,
            lng: current.primary_location.lng,
            phone: current.primary_location.phone.clone(),
            public_visibility: true,
        },
        logo: Some(BusinessImageInput {
            url: "/api/forum/media/logo-lajukan.webp".to_owned(),
            mime_type: "image/webp".to_owned(),
            width: 640,
            height: 640,
        }),
        banner: Some(BusinessImageInput {
            url: "/api/forum/media/banner-lajukan.webp".to_owned(),
            mime_type: "image/webp".to_owned(),
            width: 1600,
            height: 600,
        }),
    })
    .unwrap();

    let updated = repository
        .update_profile(actor_id, current.business.id, organization_id, &command)
        .await
        .unwrap();
    let public = &updated.primary_store.metadata["public"];
    assert_eq!(public["logo_url"], "/api/forum/media/logo-lajukan.webp");
    assert_eq!(public["image_url"], "/api/forum/media/logo-lajukan.webp");
    assert_eq!(public["banner_url"], "/api/forum/media/banner-lajukan.webp");
    assert_eq!(public["cover_image_url"], "/api/forum/media/banner-lajukan.webp");
    assert_eq!(public["logo_media"]["width"], 640);
    assert_eq!(public["banner_media"]["height"], 600);
}
