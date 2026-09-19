use super::documents::{
    ApprovalDecisionRequest, CreateApprovalRequest, CreateApprovalRuleRequest,
    CreateDocumentLineRequest, CreateDocumentRequest, DocumentError, DocumentRepository,
    DocumentTransitionRequest,
};
use chrono::NaiveDate;
use rust_decimal::Decimal;
use serde_json::json;
use sqlx::PgPool;
use uuid::Uuid;

struct SeededDocumentContext {
    actor_id: Uuid,
    organization_id: Uuid,
    business_id: Uuid,
    location_id: Uuid,
}

async fn seed_document_business(pool: &PgPool) -> SeededDocumentContext {
    let actor_id = Uuid::new_v4();
    let organization_id = Uuid::new_v4();
    let business_id = Uuid::new_v4();
    let store_id = Uuid::new_v4();
    let location_id = Uuid::new_v4();

    sqlx::query(
        r#"
        INSERT INTO umkm_stores (
          id, owner_user_id, organization_id, name, slug, address, lat, lng
        ) VALUES ($1,$2,$3,'Document Test',$4,'Test address',-6.2,106.7)
        "#,
    )
    .bind(store_id)
    .bind(actor_id)
    .bind(organization_id)
    .bind(format!("document-test-{business_id}"))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO businesses (
          id, organization_id, name, capability_key, status,
          created_by_user_id, idempotency_key, provisioning_request_hash
        ) VALUES ($1,$2,'Document Test','general','active',$3,$4,$5)
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(actor_id)
    .bind(Uuid::new_v4())
    .bind("0".repeat(64))
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        "INSERT INTO business_store_links (business_id,store_id,link_type) VALUES ($1,$2,'primary')",
    )
    .bind(business_id)
    .bind(store_id)
    .execute(pool)
    .await
    .unwrap();

    sqlx::query(
        r#"
        INSERT INTO business_locations (
          id,store_id,organization_id,business_id,name,
          branch_code,branch_kind,is_primary,public_visibility
        ) VALUES ($1,$2,$3,$4,'Lokasi Utama','MAIN','office',TRUE,FALSE)
        "#,
    )
    .bind(location_id)
    .bind(store_id)
    .bind(organization_id)
    .bind(business_id)
    .execute(pool)
    .await
    .unwrap();

    SeededDocumentContext {
        actor_id,
        organization_id,
        business_id,
        location_id,
    }
}

fn quotation_request() -> CreateDocumentRequest {
    CreateDocumentRequest {
        document_type: "quotation".into(),
        location_id: None,
        party_id: None,
        document_date: NaiveDate::from_ymd_opt(2026, 9, 19).unwrap(),
        due_date: Some(NaiveDate::from_ymd_opt(2026, 9, 26).unwrap()),
        note: "Penawaran awal".into(),
        metadata: json!({"channel":"manual"}),
        source_type: None,
        source_id: None,
        lines: vec![
            CreateDocumentLineRequest {
                product_id: None,
                description: "Jasa konsultasi".into(),
                quantity: Decimal::new(15, 1),
                unit_price_amount: 100_000,
                discount_amount: 5_000,
                tax_amount: 0,
                metadata: json!({}),
            },
            CreateDocumentLineRequest {
                product_id: None,
                description: "Implementasi".into(),
                quantity: Decimal::ONE,
                unit_price_amount: 250_000,
                discount_amount: 0,
                tax_amount: 25_000,
                metadata: json!({"phase":1}),
            },
        ],
    }
}

#[sqlx::test(migrations = "./migrations")]
async fn document_create_is_idempotent_and_owner_managed_lifecycle_is_explicit(pool: PgPool) {
    let seeded = seed_document_business(&pool).await;
    let repository = DocumentRepository::new(pool.clone());
    let key = Uuid::new_v4();

    let first = repository
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            key,
            quotation_request(),
        )
        .await
        .unwrap();

    assert!(!first.replayed);
    assert_eq!(
        first.document.document.location_id,
        Some(seeded.location_id)
    );
    assert_eq!(first.document.document.currency, "IDR");
    assert!(first.document.document.document_number.contains("-QUO-"));
    assert_eq!(first.document.document.status, "draft");
    assert_eq!(first.document.lines.len(), 2);
    assert_eq!(first.document.document.subtotal_amount, 400_000);
    assert_eq!(first.document.document.discount_amount, 5_000);
    assert_eq!(first.document.document.tax_amount, 25_000);
    assert_eq!(first.document.document.total_amount, 420_000);

    let replay = repository
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            key,
            quotation_request(),
        )
        .await
        .unwrap();
    assert!(replay.replayed);
    assert_eq!(replay.document.document.id, first.document.document.id);

    let issued = repository
        .transition(
            seeded.actor_id,
            "manager",
            seeded.business_id,
            seeded.organization_id,
            first.document.document.id,
            DocumentTransitionRequest {
                action: "issue".into(),
                reason: None,
                approval_request_id: None,
            },
        )
        .await
        .unwrap();
    assert_eq!(issued.document.status, "issued");

    let posted = repository
        .transition(
            seeded.actor_id,
            "manager",
            seeded.business_id,
            seeded.organization_id,
            first.document.document.id,
            DocumentTransitionRequest {
                action: "post".into(),
                reason: None,
                approval_request_id: None,
            },
        )
        .await
        .unwrap();
    assert_eq!(posted.document.status, "posted");

    let void_error = repository
        .transition(
            seeded.actor_id,
            "manager",
            seeded.business_id,
            seeded.organization_id,
            first.document.document.id,
            DocumentTransitionRequest {
                action: "void".into(),
                reason: Some("Tidak boleh void posted".into()),
                approval_request_id: None,
            },
        )
        .await
        .unwrap_err();
    assert_eq!(
        void_error,
        DocumentError::Validation("invalid_document_transition")
    );

    let reversed = repository
        .transition(
            seeded.actor_id,
            "manager",
            seeded.business_id,
            seeded.organization_id,
            first.document.document.id,
            DocumentTransitionRequest {
                action: "reverse".into(),
                reason: Some("Koreksi administrasi".into()),
                approval_request_id: None,
            },
        )
        .await
        .unwrap();
    assert_eq!(reversed.document.status, "reversed");

    let document_events: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM events.event_outbox WHERE aggregate_type='business_document' AND aggregate_id=$1",
    )
    .bind(first.document.document.id.to_string())
    .fetch_one(&pool)
    .await
    .unwrap();
    assert_eq!(document_events, 4);
}

#[sqlx::test(migrations = "./migrations")]
async fn role_based_approval_enforces_maker_checker_multi_approval_and_single_consumption(
    pool: PgPool,
) {
    let seeded = seed_document_business(&pool).await;
    let repository = DocumentRepository::new(pool.clone());

    sqlx::query(
        "UPDATE business_profiles SET approval_policy='role_based',updated_at=NOW() WHERE business_id=$1 AND organization_id=$2",
    )
    .bind(seeded.business_id)
    .bind(seeded.organization_id)
    .execute(&pool)
    .await
    .unwrap();

    repository
        .create_rule(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            CreateApprovalRuleRequest {
                document_type: "quotation".into(),
                action_key: "issue".into(),
                min_amount: 100_000,
                required_role: "org_manager".into(),
                required_approvals: 2,
                priority: 10,
            },
        )
        .await
        .unwrap();

    let document = repository
        .create(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            Uuid::new_v4(),
            quotation_request(),
        )
        .await
        .unwrap();

    let without_approval = repository
        .transition(
            seeded.actor_id,
            "manager",
            seeded.business_id,
            seeded.organization_id,
            document.document.document.id,
            DocumentTransitionRequest {
                action: "issue".into(),
                reason: None,
                approval_request_id: None,
            },
        )
        .await
        .unwrap_err();
    assert_eq!(without_approval, DocumentError::ApprovalRequired);

    let approval = repository
        .request_approval(
            seeded.actor_id,
            seeded.business_id,
            seeded.organization_id,
            document.document.document.id,
            Uuid::new_v4(),
            CreateApprovalRequest {
                action_key: "issue".into(),
                reason: "Nilai penawaran memerlukan checker".into(),
            },
        )
        .await
        .unwrap();

    let self_approval = repository
        .decide(
            seeded.actor_id,
            "org_manager",
            seeded.business_id,
            seeded.organization_id,
            approval.approval.request.id,
            ApprovalDecisionRequest {
                decision: "approve".into(),
                note: "self".into(),
            },
        )
        .await
        .unwrap_err();
    assert_eq!(
        self_approval,
        DocumentError::Validation("maker_cannot_approve_own_request")
    );

    let approver_one = Uuid::new_v4();
    let first_decision = repository
        .decide(
            approver_one,
            "org_manager",
            seeded.business_id,
            seeded.organization_id,
            approval.approval.request.id,
            ApprovalDecisionRequest {
                decision: "approve".into(),
                note: "checker 1".into(),
            },
        )
        .await
        .unwrap();
    assert_eq!(first_decision.request.state, "pending");
    assert_eq!(first_decision.decisions.len(), 1);

    let approver_two = Uuid::new_v4();
    let second_decision = repository
        .decide(
            approver_two,
            "org_manager",
            seeded.business_id,
            seeded.organization_id,
            approval.approval.request.id,
            ApprovalDecisionRequest {
                decision: "approve".into(),
                note: "checker 2".into(),
            },
        )
        .await
        .unwrap();
    assert_eq!(second_decision.request.state, "approved");
    assert_eq!(second_decision.decisions.len(), 2);

    let issued = repository
        .transition(
            seeded.actor_id,
            "manager",
            seeded.business_id,
            seeded.organization_id,
            document.document.document.id,
            DocumentTransitionRequest {
                action: "issue".into(),
                reason: None,
                approval_request_id: Some(approval.approval.request.id),
            },
        )
        .await
        .unwrap();
    assert_eq!(issued.document.status, "issued");

    let approval_state: String =
        sqlx::query_scalar("SELECT state FROM business_approval_requests WHERE id=$1")
            .bind(approval.approval.request.id)
            .fetch_one(&pool)
            .await
            .unwrap();
    assert_eq!(approval_state, "consumed");

    let reuse = repository
        .transition(
            seeded.actor_id,
            "manager",
            seeded.business_id,
            seeded.organization_id,
            document.document.document.id,
            DocumentTransitionRequest {
                action: "post".into(),
                reason: None,
                approval_request_id: Some(approval.approval.request.id),
            },
        )
        .await
        .unwrap_err();
    assert_eq!(reuse, DocumentError::ApprovalRequired);
}
