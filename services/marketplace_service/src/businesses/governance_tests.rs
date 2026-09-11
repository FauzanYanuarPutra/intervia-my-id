use super::governance::{
    normalize_branch_code, validate_branch_kind, GovernanceError, GovernanceRepository, BRANCH_VIEW,
};
use sqlx::PgPool;
use uuid::Uuid;

#[test]
fn branch_code_is_normalized_without_changing_identity_semantics() {
    assert_eq!(normalize_branch_code(" main ").unwrap(), "MAIN");
    assert_eq!(normalize_branch_code("ciputat-01").unwrap(), "CIPUTAT-01");
}

#[test]
fn branch_code_rejects_blank_or_unsafe_values() {
    assert!(matches!(normalize_branch_code("   "), Err(GovernanceError::Validation(_))));
    assert!(matches!(normalize_branch_code("a/b"), Err(GovernanceError::Validation(_))));
    assert!(matches!(normalize_branch_code("branch code"), Err(GovernanceError::Validation(_))));
}

#[test]
fn branch_kind_is_closed_to_canonical_values() {
    for kind in ["store", "kiosk", "office", "warehouse", "service_area", "online"] {
        assert!(validate_branch_kind(kind).is_ok(), "{kind} should be valid");
    }
    assert!(matches!(validate_branch_kind("legal_entity"), Err(GovernanceError::Validation(_))));
}

#[test]
fn permission_denial_has_a_stable_non_storage_error() {
    let error = GovernanceError::Forbidden;
    assert_eq!(error.to_string(), "forbidden");
}

#[sqlx::test(migrations = "./migrations")]
async fn creator_gets_technical_access_without_legal_facts_being_inferred(pool: PgPool) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Rights Safe Test','general','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("1".repeat(64))
    .execute(&pool)
    .await
    .unwrap();

    GovernanceRepository::new(pool.clone())
        .authorize(actor_id, business_id, organization_id, BRANCH_VIEW)
        .await
        .expect("creator technical access should be initialized");

    let inferred_relationships: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_relationships WHERE business_id = $1",
    )
    .bind(business_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    let inferred_jurisdictions: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_jurisdictions WHERE business_id = $1",
    )
    .bind(business_id)
    .fetch_one(&pool)
    .await
    .unwrap();
    let inferred_legal_profiles: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM business_legal_profiles WHERE business_id = $1",
    )
    .bind(business_id)
    .fetch_one(&pool)
    .await
    .unwrap();

    assert_eq!(inferred_relationships, 0, "technical creator must not become a legal owner relationship automatically");
    assert_eq!(inferred_jurisdictions, 0, "jurisdiction must require recorded evidence");
    assert_eq!(inferred_legal_profiles, 0, "display name must not become a legal profile automatically");
}

#[sqlx::test(migrations = "./migrations")]
async fn authorization_is_scoped_to_the_exact_organization(pool: PgPool) {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let other_organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Tenant Boundary Test','general','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("2".repeat(64))
    .execute(&pool)
    .await
    .unwrap();

    let repository = GovernanceRepository::new(pool);
    repository
        .authorize(actor_id, business_id, organization_id, BRANCH_VIEW)
        .await
        .expect("correct organization scope should authorize creator");

    assert!(matches!(
        repository
            .authorize(actor_id, business_id, other_organization_id, BRANCH_VIEW)
            .await,
        Err(GovernanceError::NotFound)
    ));
}
