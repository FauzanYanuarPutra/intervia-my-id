use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::{prelude::ToPrimitive, Decimal, RoundingStrategy};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::{
    counterparty::{validate_document_party_tx, CounterpartyError, CounterpartyRole},
    event_outbox::enqueue_business_event,
    execution_policy::{
        allocate_document_number_tx, load_execution_policy_tx, resolve_operational_location_tx,
        ExecutionPolicyError,
    },
};

const MAX_DOCUMENT_LINES: usize = 200;
const MAX_DESCRIPTION: usize = 500;
const MAX_NOTE: usize = 4_000;
const MAX_REASON: usize = 2_000;
const MAX_METADATA_BYTES: usize = 32 * 1024;

fn default_json_object() -> Value {
    json!({})
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum DocumentError {
    Validation(&'static str),
    NotFound,
    Forbidden,
    Conflict,
    ApprovalRequired,
    Database,
}

impl From<sqlx::Error> for DocumentError {
    fn from(error: sqlx::Error) -> Self {
        if matches!(&error, sqlx::Error::Database(db) if db.is_unique_violation()) {
            Self::Conflict
        } else {
            Self::Database
        }
    }
}

impl From<ExecutionPolicyError> for DocumentError {
    fn from(error: ExecutionPolicyError) -> Self {
        match error {
            ExecutionPolicyError::LocationRequired => {
                Self::Validation("document_location_required")
            }
            ExecutionPolicyError::LocationNotFound => Self::Validation("invalid_document_location"),
            _ => Self::Database,
        }
    }
}

impl From<CounterpartyError> for DocumentError {
    fn from(error: CounterpartyError) -> Self {
        match error {
            CounterpartyError::Required => Self::Validation("document_party_required"),
            CounterpartyError::Invalid => Self::Validation("invalid_document_party"),
            _ => Self::Database,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CreateDocumentLineRequest {
    #[serde(default)]
    pub(crate) product_id: Option<Uuid>,
    pub(crate) description: String,
    pub(crate) quantity: Decimal,
    pub(crate) unit_price_amount: i64,
    #[serde(default)]
    pub(crate) discount_amount: i64,
    #[serde(default)]
    pub(crate) tax_amount: i64,
    #[serde(default = "default_json_object")]
    pub(crate) metadata: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CreateDocumentRequest {
    pub(crate) document_type: String,
    #[serde(default)]
    pub(crate) location_id: Option<Uuid>,
    #[serde(default)]
    pub(crate) party_id: Option<Uuid>,
    pub(crate) document_date: NaiveDate,
    #[serde(default)]
    pub(crate) due_date: Option<NaiveDate>,
    #[serde(default)]
    pub(crate) note: String,
    #[serde(default = "default_json_object")]
    pub(crate) metadata: Value,
    #[serde(default)]
    pub(crate) source_type: Option<String>,
    #[serde(default)]
    pub(crate) source_id: Option<Uuid>,
    pub(crate) lines: Vec<CreateDocumentLineRequest>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct DocumentTransitionRequest {
    pub(crate) action: String,
    #[serde(default)]
    pub(crate) reason: Option<String>,
    #[serde(default)]
    pub(crate) approval_request_id: Option<Uuid>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateDocumentLinkRequest {
    pub(crate) to_document_id: Uuid,
    pub(crate) relation_type: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CreateApprovalRuleRequest {
    pub(crate) document_type: String,
    pub(crate) action_key: String,
    #[serde(default)]
    pub(crate) min_amount: i64,
    pub(crate) required_role: String,
    #[serde(default = "default_required_approvals")]
    pub(crate) required_approvals: i32,
    #[serde(default = "default_priority")]
    pub(crate) priority: i32,
}

const fn default_required_approvals() -> i32 {
    1
}

const fn default_priority() -> i32 {
    100
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct UpdateApprovalRuleRequest {
    pub(crate) expected_version: i64,
    pub(crate) active: bool,
    pub(crate) document_type: String,
    pub(crate) action_key: String,
    pub(crate) min_amount: i64,
    pub(crate) required_role: String,
    pub(crate) required_approvals: i32,
    pub(crate) priority: i32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CreateApprovalRequest {
    pub(crate) action_key: String,
    #[serde(default)]
    pub(crate) reason: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ApprovalDecisionRequest {
    pub(crate) decision: String,
    #[serde(default)]
    pub(crate) note: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct DocumentRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) location_id: Option<Uuid>,
    pub(crate) party_id: Option<Uuid>,
    pub(crate) document_type: String,
    pub(crate) document_number: String,
    pub(crate) status: String,
    pub(crate) currency: String,
    pub(crate) document_date: NaiveDate,
    pub(crate) due_date: Option<NaiveDate>,
    pub(crate) subtotal_amount: i64,
    pub(crate) discount_amount: i64,
    pub(crate) tax_amount: i64,
    pub(crate) total_amount: i64,
    pub(crate) note: String,
    pub(crate) metadata: Value,
    pub(crate) source_type: Option<String>,
    pub(crate) source_id: Option<Uuid>,
    pub(crate) correlation_id: Uuid,
    pub(crate) idempotency_key: Uuid,
    pub(crate) request_hash: String,
    pub(crate) version: i64,
    pub(crate) issued_at: Option<DateTime<Utc>>,
    pub(crate) issued_by_user_id: Option<Uuid>,
    pub(crate) posted_at: Option<DateTime<Utc>>,
    pub(crate) posted_by_user_id: Option<Uuid>,
    pub(crate) voided_at: Option<DateTime<Utc>>,
    pub(crate) voided_by_user_id: Option<Uuid>,
    pub(crate) void_reason: Option<String>,
    pub(crate) reversed_at: Option<DateTime<Utc>>,
    pub(crate) reversed_by_user_id: Option<Uuid>,
    pub(crate) reversal_reason: Option<String>,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) updated_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct DocumentLineRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) document_id: Uuid,
    pub(crate) line_no: i32,
    pub(crate) product_id: Option<Uuid>,
    pub(crate) description: String,
    pub(crate) quantity: Decimal,
    pub(crate) unit_price_amount: i64,
    pub(crate) discount_amount: i64,
    pub(crate) tax_amount: i64,
    pub(crate) line_total_amount: i64,
    pub(crate) metadata: Value,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct DocumentLinkRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) from_document_id: Uuid,
    pub(crate) to_document_id: Uuid,
    pub(crate) relation_type: String,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct DocumentAggregate {
    pub(crate) document: DocumentRecord,
    pub(crate) lines: Vec<DocumentLineRecord>,
    pub(crate) links_from: Vec<DocumentLinkRecord>,
    pub(crate) links_to: Vec<DocumentLinkRecord>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct DocumentOutcome {
    pub(crate) document: DocumentAggregate,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct ApprovalRuleRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) document_type: String,
    pub(crate) action_key: String,
    pub(crate) min_amount: i64,
    pub(crate) required_role: String,
    pub(crate) required_approvals: i32,
    pub(crate) priority: i32,
    pub(crate) active: bool,
    pub(crate) version: i64,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) updated_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct ApprovalRequestRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) document_id: Uuid,
    pub(crate) action_key: String,
    pub(crate) rule_id: Uuid,
    pub(crate) state: String,
    pub(crate) required_role: String,
    pub(crate) required_approvals: i32,
    pub(crate) requested_by_user_id: Uuid,
    pub(crate) request_reason: String,
    pub(crate) idempotency_key: Uuid,
    pub(crate) request_hash: String,
    pub(crate) decided_at: Option<DateTime<Utc>>,
    pub(crate) consumed_at: Option<DateTime<Utc>>,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct ApprovalDecisionRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) approval_request_id: Uuid,
    pub(crate) approver_user_id: Uuid,
    pub(crate) approver_role: String,
    pub(crate) decision: String,
    pub(crate) note: String,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ApprovalAggregate {
    pub(crate) request: ApprovalRequestRecord,
    pub(crate) decisions: Vec<ApprovalDecisionRecord>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct ApprovalOutcome {
    pub(crate) approval: ApprovalAggregate,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Serialize)]
struct NormalizedLine {
    product_id: Option<Uuid>,
    description: String,
    quantity: Decimal,
    unit_price_amount: i64,
    discount_amount: i64,
    tax_amount: i64,
    gross_amount: i64,
    line_total_amount: i64,
    metadata: Value,
}

#[derive(Debug, Clone, Serialize)]
struct NormalizedDocument {
    document_type: String,
    location_id: Option<Uuid>,
    party_id: Option<Uuid>,
    document_date: NaiveDate,
    due_date: Option<NaiveDate>,
    note: String,
    metadata: Value,
    source_type: Option<String>,
    source_id: Option<Uuid>,
    lines: Vec<NormalizedLine>,
    subtotal_amount: i64,
    discount_amount: i64,
    tax_amount: i64,
    total_amount: i64,
}

#[derive(Clone)]
pub(crate) struct DocumentRepository {
    db: PgPool,
}

impl DocumentRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn list(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        limit: i64,
    ) -> Result<Vec<DocumentRecord>, DocumentError> {
        sqlx::query_as::<_, DocumentRecord>(DOCUMENT_SELECT_LIST)
            .bind(business_id)
            .bind(organization_id)
            .bind(limit.clamp(1, 500))
            .fetch_all(&self.db)
            .await
            .map_err(Into::into)
    }

    pub(crate) async fn get(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        document_id: Uuid,
    ) -> Result<DocumentAggregate, DocumentError> {
        let mut tx = self.db.begin().await?;
        let aggregate =
            load_document_aggregate_tx(&mut tx, business_id, organization_id, document_id, false)
                .await?
                .ok_or(DocumentError::NotFound)?;
        tx.commit().await?;
        Ok(aggregate)
    }

    pub(crate) async fn create(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: CreateDocumentRequest,
    ) -> Result<DocumentOutcome, DocumentError> {
        let normalized = normalize_document(request)?;
        let request_hash = canonical_hash(&normalized)?;
        let mut tx = self.db.begin().await?;
        idempotency_lock(&mut tx, "document", business_id, idempotency_key).await?;

        if let Some(existing) =
            find_document_by_key_tx(&mut tx, business_id, organization_id, idempotency_key).await?
        {
            if existing.document.request_hash != request_hash {
                return Err(DocumentError::Conflict);
            }
            tx.commit().await?;
            return Ok(DocumentOutcome {
                document: existing,
                replayed: true,
            });
        }

        let policy = load_execution_policy_tx(&mut tx, business_id, organization_id).await?;
        let location_id = resolve_operational_location_tx(
            &mut tx,
            business_id,
            organization_id,
            &policy,
            normalized.location_id,
        )
        .await?;

        let (party_role, party_required) = document_party_policy(&normalized.document_type);
        let party_id = match party_role {
            Some(role) => {
                validate_document_party_tx(
                    &mut tx,
                    business_id,
                    organization_id,
                    normalized.party_id,
                    role,
                    party_required,
                )
                .await?
            }
            None => normalized.party_id,
        };

        let document_id = Uuid::new_v4();
        let document_number = allocate_document_number_tx(
            &mut tx,
            business_id,
            organization_id,
            &normalized.document_type,
            &policy.document_prefix,
        )
        .await?;
        let correlation_id = Uuid::new_v4();
        let document = sqlx::query_as::<_, DocumentRecord>(
            r#"
            INSERT INTO business_documents (
              id,organization_id,business_id,location_id,party_id,document_type,document_number,
              currency,document_date,due_date,subtotal_amount,discount_amount,tax_amount,total_amount,
              note,metadata,source_type,source_id,correlation_id,idempotency_key,request_hash,
              created_by_user_id,updated_by_user_id
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,$22
            )
            RETURNING id,organization_id,business_id,location_id,party_id,document_type,
                      document_number,status,currency,document_date,due_date,subtotal_amount,
                      discount_amount,tax_amount,total_amount,note,metadata,source_type,source_id,
                      correlation_id,idempotency_key,request_hash,version,issued_at,issued_by_user_id,
                      posted_at,posted_by_user_id,voided_at,voided_by_user_id,void_reason,
                      reversed_at,reversed_by_user_id,reversal_reason,created_by_user_id,
                      updated_by_user_id,created_at,updated_at
            "#,
        )
        .bind(document_id)
        .bind(organization_id)
        .bind(business_id)
        .bind(location_id)
        .bind(party_id)
        .bind(&normalized.document_type)
        .bind(&document_number)
        .bind(&policy.currency)
        .bind(normalized.document_date)
        .bind(normalized.due_date)
        .bind(normalized.subtotal_amount)
        .bind(normalized.discount_amount)
        .bind(normalized.tax_amount)
        .bind(normalized.total_amount)
        .bind(&normalized.note)
        .bind(&normalized.metadata)
        .bind(normalized.source_type.as_deref())
        .bind(normalized.source_id)
        .bind(correlation_id)
        .bind(idempotency_key)
        .bind(&request_hash)
        .bind(actor_id)
        .fetch_one(&mut *tx)
        .await?;

        for (index, line) in normalized.lines.iter().enumerate() {
            sqlx::query(
                r#"
                INSERT INTO business_document_lines (
                  organization_id,business_id,document_id,line_no,product_id,description,quantity,
                  unit_price_amount,discount_amount,tax_amount,line_total_amount,metadata
                ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
                "#,
            )
            .bind(organization_id)
            .bind(business_id)
            .bind(document.id)
            .bind((index + 1) as i32)
            .bind(line.product_id)
            .bind(&line.description)
            .bind(line.quantity)
            .bind(line.unit_price_amount)
            .bind(line.discount_amount)
            .bind(line.tax_amount)
            .bind(line.line_total_amount)
            .bind(&line.metadata)
            .execute(&mut *tx)
            .await?;
        }

        emit_document_event(
            &mut tx,
            &document,
            "marketplace.business.document_created",
            json!({"status":"draft"}),
        )
        .await?;

        let aggregate =
            load_document_aggregate_tx(&mut tx, business_id, organization_id, document.id, false)
                .await?
                .ok_or(DocumentError::Database)?;
        tx.commit().await?;

        Ok(DocumentOutcome {
            document: aggregate,
            replayed: false,
        })
    }

    pub(crate) async fn link(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        from_document_id: Uuid,
        request: CreateDocumentLinkRequest,
    ) -> Result<(DocumentLinkRecord, bool), DocumentError> {
        let relation_type = normalize_relation(&request.relation_type)?;
        if from_document_id == request.to_document_id {
            return Err(DocumentError::Validation("document_link_self_reference"));
        }
        let mut tx = self.db.begin().await?;
        ensure_document_exists_tx(&mut tx, business_id, organization_id, from_document_id).await?;
        ensure_document_exists_tx(
            &mut tx,
            business_id,
            organization_id,
            request.to_document_id,
        )
        .await?;

        let inserted = sqlx::query_as::<_, DocumentLinkRecord>(
            r#"
            INSERT INTO business_document_links (
              organization_id,business_id,from_document_id,to_document_id,relation_type,
              created_by_user_id
            ) VALUES ($1,$2,$3,$4,$5,$6)
            ON CONFLICT (from_document_id,to_document_id,relation_type) DO NOTHING
            RETURNING id,organization_id,business_id,from_document_id,to_document_id,
                      relation_type,created_by_user_id,created_at
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(from_document_id)
        .bind(request.to_document_id)
        .bind(&relation_type)
        .bind(actor_id)
        .fetch_optional(&mut *tx)
        .await?;

        let replayed = inserted.is_none();
        let link = match inserted {
            Some(link) => link,
            None => {
                sqlx::query_as::<_, DocumentLinkRecord>(
                    r#"
                    SELECT id,organization_id,business_id,from_document_id,to_document_id,
                           relation_type,created_by_user_id,created_at
                    FROM business_document_links
                    WHERE from_document_id=$1 AND to_document_id=$2 AND relation_type=$3
                    "#,
                )
                .bind(from_document_id)
                .bind(request.to_document_id)
                .bind(&relation_type)
                .fetch_one(&mut *tx)
                .await?
            }
        };
        tx.commit().await?;
        Ok((link, replayed))
    }

    pub(crate) async fn transition(
        &self,
        actor_id: Uuid,
        actor_role: &str,
        business_id: Uuid,
        organization_id: Uuid,
        document_id: Uuid,
        request: DocumentTransitionRequest,
    ) -> Result<DocumentAggregate, DocumentError> {
        let action = normalize_action(&request.action)?;
        let reason = normalize_optional_reason(request.reason.as_deref())?;
        let mut tx = self.db.begin().await?;
        let document = load_document_tx(&mut tx, business_id, organization_id, document_id, true)
            .await?
            .ok_or(DocumentError::NotFound)?;
        validate_transition(&document.status, &action, reason.as_deref())?;

        let policy = load_execution_policy_tx(&mut tx, business_id, organization_id).await?;
        if policy.approval_policy == "role_based" {
            let approval_id = request
                .approval_request_id
                .ok_or(DocumentError::ApprovalRequired)?;
            consume_approved_request_tx(
                &mut tx,
                business_id,
                organization_id,
                document.id,
                &action,
                approval_id,
            )
            .await?;
        } else if !is_owner_manager_role(actor_role) {
            return Err(DocumentError::Forbidden);
        }

        let updated = apply_transition_tx(
            &mut tx,
            actor_id,
            business_id,
            organization_id,
            document.id,
            &action,
            reason.as_deref(),
        )
        .await?;
        emit_document_event(
            &mut tx,
            &updated,
            "marketplace.business.document_transitioned",
            json!({"action":action,"previous_status":document.status,"status":updated.status}),
        )
        .await?;

        let aggregate =
            load_document_aggregate_tx(&mut tx, business_id, organization_id, document.id, false)
                .await?
                .ok_or(DocumentError::Database)?;
        tx.commit().await?;
        Ok(aggregate)
    }

    pub(crate) async fn list_rules(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<ApprovalRuleRecord>, DocumentError> {
        sqlx::query_as::<_, ApprovalRuleRecord>(
            r#"
            SELECT id,organization_id,business_id,document_type,action_key,min_amount,
                   required_role,required_approvals,priority,active,version,created_by_user_id,
                   updated_by_user_id,created_at,updated_at
            FROM business_approval_rules
            WHERE business_id=$1 AND organization_id=$2
            ORDER BY active DESC,action_key,document_type,min_amount DESC,priority,id
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_all(&self.db)
        .await
        .map_err(Into::into)
    }

    pub(crate) async fn create_rule(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        request: CreateApprovalRuleRequest,
    ) -> Result<ApprovalRuleRecord, DocumentError> {
        let normalized = normalize_rule(request)?;
        sqlx::query_as::<_, ApprovalRuleRecord>(
            r#"
            INSERT INTO business_approval_rules (
              organization_id,business_id,document_type,action_key,min_amount,required_role,
              required_approvals,priority,created_by_user_id,updated_by_user_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9)
            RETURNING id,organization_id,business_id,document_type,action_key,min_amount,
                      required_role,required_approvals,priority,active,version,created_by_user_id,
                      updated_by_user_id,created_at,updated_at
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(&normalized.document_type)
        .bind(&normalized.action_key)
        .bind(normalized.min_amount)
        .bind(&normalized.required_role)
        .bind(normalized.required_approvals)
        .bind(normalized.priority)
        .bind(actor_id)
        .fetch_one(&self.db)
        .await
        .map_err(Into::into)
    }

    pub(crate) async fn update_rule(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        rule_id: Uuid,
        request: UpdateApprovalRuleRequest,
    ) -> Result<ApprovalRuleRecord, DocumentError> {
        if request.expected_version <= 0 {
            return Err(DocumentError::Validation("invalid_approval_rule_version"));
        }
        let normalized = normalize_rule(CreateApprovalRuleRequest {
            document_type: request.document_type,
            action_key: request.action_key,
            min_amount: request.min_amount,
            required_role: request.required_role,
            required_approvals: request.required_approvals,
            priority: request.priority,
        })?;
        sqlx::query_as::<_, ApprovalRuleRecord>(
            r#"
            UPDATE business_approval_rules
            SET document_type=$5,action_key=$6,min_amount=$7,required_role=$8,
                required_approvals=$9,priority=$10,active=$11,version=version+1,
                updated_by_user_id=$12,updated_at=NOW()
            WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND version=$4
            RETURNING id,organization_id,business_id,document_type,action_key,min_amount,
                      required_role,required_approvals,priority,active,version,created_by_user_id,
                      updated_by_user_id,created_at,updated_at
            "#,
        )
        .bind(rule_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(request.expected_version)
        .bind(&normalized.document_type)
        .bind(&normalized.action_key)
        .bind(normalized.min_amount)
        .bind(&normalized.required_role)
        .bind(normalized.required_approvals)
        .bind(normalized.priority)
        .bind(request.active)
        .bind(actor_id)
        .fetch_optional(&self.db)
        .await?
        .ok_or(DocumentError::Conflict)
    }

    pub(crate) async fn request_approval(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        document_id: Uuid,
        idempotency_key: Uuid,
        request: CreateApprovalRequest,
    ) -> Result<ApprovalOutcome, DocumentError> {
        let action = normalize_action(&request.action_key)?;
        let reason = normalize_text(&request.reason, MAX_REASON, "approval_reason_too_long")?;
        let fingerprint = json!({"document_id":document_id,"action_key":action,"reason":reason});
        let request_hash = canonical_hash(&fingerprint)?;
        let mut tx = self.db.begin().await?;
        idempotency_lock(&mut tx, "approval-request", business_id, idempotency_key).await?;

        if let Some(existing) =
            find_approval_by_key_tx(&mut tx, business_id, organization_id, idempotency_key).await?
        {
            if existing.request.request_hash != request_hash {
                return Err(DocumentError::Conflict);
            }
            tx.commit().await?;
            return Ok(ApprovalOutcome {
                approval: existing,
                replayed: true,
            });
        }

        let document = load_document_tx(&mut tx, business_id, organization_id, document_id, true)
            .await?
            .ok_or(DocumentError::NotFound)?;
        validate_transition_status(&document.status, &action)?;

        let policy = load_execution_policy_tx(&mut tx, business_id, organization_id).await?;
        if policy.approval_policy != "role_based" {
            return Err(DocumentError::Validation("approval_not_required"));
        }

        let rule = matching_rule_tx(
            &mut tx,
            business_id,
            organization_id,
            &document.document_type,
            &action,
            document.total_amount,
        )
        .await?
        .ok_or(DocumentError::Validation("approval_rule_missing"))?;

        let record = sqlx::query_as::<_, ApprovalRequestRecord>(
            r#"
            INSERT INTO business_approval_requests (
              organization_id,business_id,document_id,action_key,rule_id,state,
              required_role,required_approvals,requested_by_user_id,request_reason,
              idempotency_key,request_hash
            ) VALUES ($1,$2,$3,$4,$5,'pending',$6,$7,$8,$9,$10,$11)
            RETURNING id,organization_id,business_id,document_id,action_key,rule_id,state,
                      required_role,required_approvals,requested_by_user_id,request_reason,
                      idempotency_key,request_hash,decided_at,consumed_at,created_at
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(document_id)
        .bind(&action)
        .bind(rule.id)
        .bind(&rule.required_role)
        .bind(rule.required_approvals)
        .bind(actor_id)
        .bind(&reason)
        .bind(idempotency_key)
        .bind(&request_hash)
        .fetch_one(&mut *tx)
        .await?;

        emit_approval_event(
            &mut tx,
            &record,
            "marketplace.business.approval_requested",
            "requested",
            json!({"document_number":document.document_number}),
        )
        .await?;
        tx.commit().await?;
        Ok(ApprovalOutcome {
            approval: ApprovalAggregate {
                request: record,
                decisions: Vec::new(),
            },
            replayed: false,
        })
    }

    pub(crate) async fn decide(
        &self,
        actor_id: Uuid,
        actor_role: &str,
        business_id: Uuid,
        organization_id: Uuid,
        approval_id: Uuid,
        request: ApprovalDecisionRequest,
    ) -> Result<ApprovalAggregate, DocumentError> {
        let decision = normalize_decision(&request.decision)?;
        let note = normalize_text(&request.note, MAX_REASON, "approval_note_too_long")?;
        let mut tx = self.db.begin().await?;
        let approval =
            load_approval_request_tx(&mut tx, business_id, organization_id, approval_id, true)
                .await?
                .ok_or(DocumentError::NotFound)?;

        if let Some(existing) = sqlx::query_as::<_, ApprovalDecisionRecord>(
            r#"
            SELECT id,organization_id,business_id,approval_request_id,approver_user_id,
                   approver_role,decision,note,created_at
            FROM business_approval_decisions
            WHERE approval_request_id=$1 AND approver_user_id=$2
            "#,
        )
        .bind(approval.id)
        .bind(actor_id)
        .fetch_optional(&mut *tx)
        .await?
        {
            if existing.decision != decision || existing.note != note {
                return Err(DocumentError::Conflict);
            }
            let aggregate =
                load_approval_aggregate_tx(&mut tx, business_id, organization_id, approval.id)
                    .await?
                    .ok_or(DocumentError::Database)?;
            tx.commit().await?;
            return Ok(aggregate);
        }

        if approval.state != "pending" {
            return Err(DocumentError::Conflict);
        }
        if approval.requested_by_user_id == actor_id {
            return Err(DocumentError::Validation(
                "maker_cannot_approve_own_request",
            ));
        }
        if actor_role != approval.required_role && actor_role != "org_admin" {
            return Err(DocumentError::Forbidden);
        }

        sqlx::query(
            r#"
            INSERT INTO business_approval_decisions (
              organization_id,business_id,approval_request_id,approver_user_id,
              approver_role,decision,note
            ) VALUES ($1,$2,$3,$4,$5,$6,$7)
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(approval.id)
        .bind(actor_id)
        .bind(actor_role)
        .bind(&decision)
        .bind(&note)
        .execute(&mut *tx)
        .await?;

        if decision == "reject" {
            sqlx::query(
                "UPDATE business_approval_requests SET state='rejected',decided_at=NOW() WHERE id=$1 AND state='pending'",
            )
            .bind(approval.id)
            .execute(&mut *tx)
            .await?;
        } else {
            let approvals: i64 = sqlx::query_scalar(
                "SELECT COUNT(*) FROM business_approval_decisions WHERE approval_request_id=$1 AND decision='approve'",
            )
            .bind(approval.id)
            .fetch_one(&mut *tx)
            .await?;
            if approvals >= i64::from(approval.required_approvals) {
                sqlx::query(
                    "UPDATE business_approval_requests SET state='approved',decided_at=NOW() WHERE id=$1 AND state='pending'",
                )
                .bind(approval.id)
                .execute(&mut *tx)
                .await?;
            }
        }

        let aggregate =
            load_approval_aggregate_tx(&mut tx, business_id, organization_id, approval.id)
                .await?
                .ok_or(DocumentError::Database)?;
        emit_approval_event(
            &mut tx,
            &aggregate.request,
            "marketplace.business.approval_decided",
            &format!("{actor_id}:{decision}"),
            json!({"decision":decision,"approver_user_id":actor_id}),
        )
        .await?;
        tx.commit().await?;
        Ok(aggregate)
    }

    pub(crate) async fn approvals_for_document(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        document_id: Uuid,
    ) -> Result<Vec<ApprovalAggregate>, DocumentError> {
        let requests = sqlx::query_as::<_, ApprovalRequestRecord>(
            r#"
            SELECT id,organization_id,business_id,document_id,action_key,rule_id,state,
                   required_role,required_approvals,requested_by_user_id,request_reason,
                   idempotency_key,request_hash,decided_at,consumed_at,created_at
            FROM business_approval_requests
            WHERE business_id=$1 AND organization_id=$2 AND document_id=$3
            ORDER BY created_at DESC,id DESC
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(document_id)
        .fetch_all(&self.db)
        .await?;

        let mut result = Vec::with_capacity(requests.len());
        for request in requests {
            let decisions = load_decisions_pool(&self.db, request.id).await?;
            result.push(ApprovalAggregate { request, decisions });
        }
        Ok(result)
    }
}

fn normalize_document(request: CreateDocumentRequest) -> Result<NormalizedDocument, DocumentError> {
    let document_type = normalize_document_type(&request.document_type, false)?;
    if request.lines.is_empty() || request.lines.len() > MAX_DOCUMENT_LINES {
        return Err(DocumentError::Validation("invalid_document_lines"));
    }
    if request
        .due_date
        .is_some_and(|due_date| due_date < request.document_date)
    {
        return Err(DocumentError::Validation("invalid_document_due_date"));
    }
    if request.source_type.is_some() != request.source_id.is_some() {
        return Err(DocumentError::Validation("invalid_document_source"));
    }
    let source_type = request
        .source_type
        .as_deref()
        .map(|value| normalize_required_text(value, 80, "invalid_document_source"))
        .transpose()?;
    let note = normalize_text(&request.note, MAX_NOTE, "document_note_too_long")?;
    let metadata = normalize_metadata(request.metadata)?;

    let mut lines = Vec::with_capacity(request.lines.len());
    let mut subtotal = 0i64;
    let mut discount = 0i64;
    let mut tax = 0i64;
    let mut total = 0i64;
    for request_line in request.lines {
        let line = normalize_line(request_line)?;
        subtotal = subtotal
            .checked_add(line.gross_amount)
            .ok_or(DocumentError::Validation("document_amount_overflow"))?;
        discount = discount
            .checked_add(line.discount_amount)
            .ok_or(DocumentError::Validation("document_amount_overflow"))?;
        tax = tax
            .checked_add(line.tax_amount)
            .ok_or(DocumentError::Validation("document_amount_overflow"))?;
        total = total
            .checked_add(line.line_total_amount)
            .ok_or(DocumentError::Validation("document_amount_overflow"))?;
        lines.push(line);
    }

    Ok(NormalizedDocument {
        document_type,
        location_id: request.location_id,
        party_id: request.party_id,
        document_date: request.document_date,
        due_date: request.due_date,
        note,
        metadata,
        source_type,
        source_id: request.source_id,
        lines,
        subtotal_amount: subtotal,
        discount_amount: discount,
        tax_amount: tax,
        total_amount: total,
    })
}

fn normalize_line(request: CreateDocumentLineRequest) -> Result<NormalizedLine, DocumentError> {
    if request.quantity <= Decimal::ZERO || request.quantity.scale() > 6 {
        return Err(DocumentError::Validation("invalid_document_line_quantity"));
    }
    if request.unit_price_amount < 0 || request.discount_amount < 0 || request.tax_amount < 0 {
        return Err(DocumentError::Validation("invalid_document_line_amount"));
    }
    let description = normalize_required_text(
        &request.description,
        MAX_DESCRIPTION,
        "invalid_document_line_description",
    )?;
    let gross = (request.quantity * Decimal::from(request.unit_price_amount))
        .round_dp_with_strategy(0, RoundingStrategy::MidpointAwayFromZero)
        .to_i64()
        .ok_or(DocumentError::Validation("document_amount_overflow"))?;
    let total = gross
        .checked_sub(request.discount_amount)
        .and_then(|value| value.checked_add(request.tax_amount))
        .ok_or(DocumentError::Validation("document_amount_overflow"))?;
    if total < 0 {
        return Err(DocumentError::Validation("invalid_document_line_total"));
    }
    Ok(NormalizedLine {
        product_id: request.product_id,
        description,
        quantity: request.quantity,
        unit_price_amount: request.unit_price_amount,
        discount_amount: request.discount_amount,
        tax_amount: request.tax_amount,
        gross_amount: gross,
        line_total_amount: total,
        metadata: normalize_metadata(request.metadata)?,
    })
}

fn normalize_rule(
    request: CreateApprovalRuleRequest,
) -> Result<CreateApprovalRuleRequest, DocumentError> {
    let document_type = normalize_document_type(&request.document_type, true)?;
    let action_key = normalize_action(&request.action_key)?;
    if request.min_amount < 0 {
        return Err(DocumentError::Validation("invalid_approval_rule_amount"));
    }
    if !(1..=5).contains(&request.required_approvals) {
        return Err(DocumentError::Validation("invalid_approval_count"));
    }
    let required_role =
        normalize_required_text(&request.required_role, 80, "invalid_approval_role")?;
    Ok(CreateApprovalRuleRequest {
        document_type,
        action_key,
        min_amount: request.min_amount,
        required_role,
        required_approvals: request.required_approvals,
        priority: request.priority.clamp(-10_000, 10_000),
    })
}

fn normalize_document_type(value: &str, allow_wildcard: bool) -> Result<String, DocumentError> {
    let value = value.trim().to_ascii_lowercase();
    if (allow_wildcard && value == "*")
        || matches!(
            value.as_str(),
            "quotation"
                | "sales_order"
                | "delivery"
                | "invoice"
                | "credit_note"
                | "purchase_requisition"
                | "rfq"
                | "purchase_order"
                | "goods_receipt"
                | "vendor_bill"
                | "debit_note"
                | "service_order"
                | "work_order"
        )
    {
        Ok(value)
    } else {
        Err(DocumentError::Validation("invalid_document_type"))
    }
}

fn normalize_action(value: &str) -> Result<String, DocumentError> {
    let value = value.trim().to_ascii_lowercase();
    if matches!(value.as_str(), "issue" | "post" | "void" | "reverse") {
        Ok(value)
    } else {
        Err(DocumentError::Validation("invalid_document_action"))
    }
}

fn normalize_relation(value: &str) -> Result<String, DocumentError> {
    let value = value.trim().to_ascii_lowercase();
    if matches!(
        value.as_str(),
        "converts_to" | "fulfills" | "bills" | "credits" | "debits" | "reverses" | "references"
    ) {
        Ok(value)
    } else {
        Err(DocumentError::Validation("invalid_document_relation"))
    }
}

fn normalize_decision(value: &str) -> Result<String, DocumentError> {
    let value = value.trim().to_ascii_lowercase();
    if matches!(value.as_str(), "approve" | "reject") {
        Ok(value)
    } else {
        Err(DocumentError::Validation("invalid_approval_decision"))
    }
}

fn normalize_metadata(value: Value) -> Result<Value, DocumentError> {
    if !value.is_object() {
        return Err(DocumentError::Validation(
            "document_metadata_must_be_object",
        ));
    }
    let bytes = serde_json::to_vec(&value).map_err(|_| DocumentError::Database)?;
    if bytes.len() > MAX_METADATA_BYTES {
        return Err(DocumentError::Validation("document_metadata_too_large"));
    }
    Ok(value)
}

fn normalize_text(value: &str, max: usize, code: &'static str) -> Result<String, DocumentError> {
    let value = value.trim();
    if value.chars().count() > max {
        Err(DocumentError::Validation(code))
    } else {
        Ok(value.to_owned())
    }
}

fn normalize_required_text(
    value: &str,
    max: usize,
    code: &'static str,
) -> Result<String, DocumentError> {
    let value = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() || value.chars().count() > max {
        Err(DocumentError::Validation(code))
    } else {
        Ok(value)
    }
}

fn normalize_optional_reason(value: Option<&str>) -> Result<Option<String>, DocumentError> {
    value
        .map(|value| normalize_required_text(value, MAX_REASON, "document_reason_required"))
        .transpose()
}

fn document_party_policy(document_type: &str) -> (Option<CounterpartyRole>, bool) {
    match document_type {
        "quotation" | "sales_order" | "delivery" | "invoice" | "credit_note" | "service_order"
        | "work_order" => (
            Some(CounterpartyRole::Customer),
            matches!(document_type, "invoice" | "credit_note"),
        ),
        "purchase_requisition" => (None, false),
        "rfq" | "purchase_order" | "goods_receipt" | "vendor_bill" | "debit_note" => (
            Some(CounterpartyRole::Supplier),
            matches!(
                document_type,
                "purchase_order" | "vendor_bill" | "debit_note"
            ),
        ),
        _ => (None, false),
    }
}

fn validate_transition_status(status: &str, action: &str) -> Result<(), DocumentError> {
    if matches!(
        (status, action),
        ("draft", "issue")
            | ("issued", "post")
            | ("draft", "void")
            | ("issued", "void")
            | ("posted", "reverse")
    ) {
        Ok(())
    } else {
        Err(DocumentError::Validation("invalid_document_transition"))
    }
}

fn validate_transition(
    status: &str,
    action: &str,
    reason: Option<&str>,
) -> Result<(), DocumentError> {
    validate_transition_status(status, action)?;
    if matches!(action, "void" | "reverse") && reason.is_none() {
        return Err(DocumentError::Validation("document_reason_required"));
    }
    Ok(())
}

fn is_owner_manager_role(role: &str) -> bool {
    matches!(role, "org_admin" | "org_manager" | "manager")
}

fn canonical_hash<T: Serialize>(value: &T) -> Result<String, DocumentError> {
    let bytes = serde_json::to_vec(value).map_err(|_| DocumentError::Database)?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

async fn idempotency_lock(
    tx: &mut Transaction<'_, Postgres>,
    domain: &str,
    business_id: Uuid,
    idempotency_key: Uuid,
) -> Result<(), DocumentError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("{domain}:{business_id}:{idempotency_key}"))
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn find_document_by_key_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<DocumentAggregate>, DocumentError> {
    let document_id = sqlx::query_scalar::<_, Uuid>(
        "SELECT id FROM business_documents WHERE business_id=$1 AND organization_id=$2 AND idempotency_key=$3",
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(idempotency_key)
    .fetch_optional(&mut **tx)
    .await?;
    match document_id {
        Some(document_id) => {
            load_document_aggregate_tx(tx, business_id, organization_id, document_id, false).await
        }
        None => Ok(None),
    }
}

async fn load_document_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    document_id: Uuid,
    for_update: bool,
) -> Result<Option<DocumentRecord>, DocumentError> {
    let query = if for_update {
        sqlx::query_as::<_, DocumentRecord>(DOCUMENT_SELECT_ONE_FOR_UPDATE)
    } else {
        sqlx::query_as::<_, DocumentRecord>(DOCUMENT_SELECT_ONE)
    };
    query
        .bind(document_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

async fn load_document_aggregate_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    document_id: Uuid,
    for_update: bool,
) -> Result<Option<DocumentAggregate>, DocumentError> {
    let Some(document) =
        load_document_tx(tx, business_id, organization_id, document_id, for_update).await?
    else {
        return Ok(None);
    };
    let lines = sqlx::query_as::<_, DocumentLineRecord>(
        r#"
        SELECT id,organization_id,business_id,document_id,line_no,product_id,description,
               quantity,unit_price_amount,discount_amount,tax_amount,line_total_amount,
               metadata,created_at
        FROM business_document_lines
        WHERE document_id=$1 AND business_id=$2 AND organization_id=$3
        ORDER BY line_no,id
        "#,
    )
    .bind(document_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_all(&mut **tx)
    .await?;
    let links_from = load_links_tx(tx, business_id, organization_id, document_id, true).await?;
    let links_to = load_links_tx(tx, business_id, organization_id, document_id, false).await?;
    Ok(Some(DocumentAggregate {
        document,
        lines,
        links_from,
        links_to,
    }))
}

async fn load_links_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    document_id: Uuid,
    outbound: bool,
) -> Result<Vec<DocumentLinkRecord>, DocumentError> {
    let query = if outbound {
        sqlx::query_as::<_, DocumentLinkRecord>(DOCUMENT_LINKS_OUTBOUND_SELECT)
    } else {
        sqlx::query_as::<_, DocumentLinkRecord>(DOCUMENT_LINKS_INBOUND_SELECT)
    };
    query
        .bind(business_id)
        .bind(organization_id)
        .bind(document_id)
        .fetch_all(&mut **tx)
        .await
        .map_err(Into::into)
}

async fn ensure_document_exists_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    document_id: Uuid,
) -> Result<(), DocumentError> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM business_documents WHERE id=$1 AND business_id=$2 AND organization_id=$3)",
    )
    .bind(document_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **tx)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(DocumentError::NotFound)
    }
}

async fn apply_transition_tx(
    tx: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    document_id: Uuid,
    action: &str,
    reason: Option<&str>,
) -> Result<DocumentRecord, DocumentError> {
    let result = match action {
        "issue" => {
            sqlx::query(
                r#"
                UPDATE business_documents
                SET status='issued',issued_at=NOW(),issued_by_user_id=$4,
                    version=version+1,updated_by_user_id=$4,updated_at=NOW()
                WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='draft'
                "#,
            )
            .bind(document_id)
            .bind(business_id)
            .bind(organization_id)
            .bind(actor_id)
            .execute(&mut **tx)
            .await?
        }
        "post" => {
            sqlx::query(
                r#"
                UPDATE business_documents
                SET status='posted',posted_at=NOW(),posted_by_user_id=$4,
                    version=version+1,updated_by_user_id=$4,updated_at=NOW()
                WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='issued'
                "#,
            )
            .bind(document_id)
            .bind(business_id)
            .bind(organization_id)
            .bind(actor_id)
            .execute(&mut **tx)
            .await?
        }
        "void" => {
            sqlx::query(
                r#"
                UPDATE business_documents
                SET status='voided',voided_at=NOW(),voided_by_user_id=$4,void_reason=$5,
                    version=version+1,updated_by_user_id=$4,updated_at=NOW()
                WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status IN ('draft','issued')
                "#,
            )
            .bind(document_id)
            .bind(business_id)
            .bind(organization_id)
            .bind(actor_id)
            .bind(reason)
            .execute(&mut **tx)
            .await?
        }
        "reverse" => {
            sqlx::query(
                r#"
                UPDATE business_documents
                SET status='reversed',reversed_at=NOW(),reversed_by_user_id=$4,reversal_reason=$5,
                    version=version+1,updated_by_user_id=$4,updated_at=NOW()
                WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='posted'
                "#,
            )
            .bind(document_id)
            .bind(business_id)
            .bind(organization_id)
            .bind(actor_id)
            .bind(reason)
            .execute(&mut **tx)
            .await?
        }
        _ => return Err(DocumentError::Validation("invalid_document_action")),
    };
    if result.rows_affected() != 1 {
        return Err(DocumentError::Conflict);
    }
    load_document_tx(tx, business_id, organization_id, document_id, false)
        .await?
        .ok_or(DocumentError::Database)
}

async fn matching_rule_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    document_type: &str,
    action: &str,
    amount: i64,
) -> Result<Option<ApprovalRuleRecord>, DocumentError> {
    sqlx::query_as::<_, ApprovalRuleRecord>(
        r#"
        SELECT id,organization_id,business_id,document_type,action_key,min_amount,
               required_role,required_approvals,priority,active,version,created_by_user_id,
               updated_by_user_id,created_at,updated_at
        FROM business_approval_rules
        WHERE business_id=$1 AND organization_id=$2 AND active
          AND action_key=$3
          AND document_type IN ($4,'*')
          AND min_amount <= $5
        ORDER BY CASE WHEN document_type=$4 THEN 0 ELSE 1 END,
                 min_amount DESC,priority ASC,id
        LIMIT 1
        FOR SHARE
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(action)
    .bind(document_type)
    .bind(amount)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn consume_approved_request_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    document_id: Uuid,
    action: &str,
    approval_id: Uuid,
) -> Result<(), DocumentError> {
    let result = sqlx::query(
        r#"
        UPDATE business_approval_requests
        SET state='consumed',consumed_at=NOW()
        WHERE id=$1 AND business_id=$2 AND organization_id=$3
          AND document_id=$4 AND action_key=$5 AND state='approved'
        "#,
    )
    .bind(approval_id)
    .bind(business_id)
    .bind(organization_id)
    .bind(document_id)
    .bind(action)
    .execute(&mut **tx)
    .await?;
    if result.rows_affected() == 1 {
        Ok(())
    } else {
        Err(DocumentError::ApprovalRequired)
    }
}

async fn find_approval_by_key_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<ApprovalAggregate>, DocumentError> {
    let request = sqlx::query_as::<_, ApprovalRequestRecord>(
        r#"
        SELECT id,organization_id,business_id,document_id,action_key,rule_id,state,
               required_role,required_approvals,requested_by_user_id,request_reason,
               idempotency_key,request_hash,decided_at,consumed_at,created_at
        FROM business_approval_requests
        WHERE business_id=$1 AND organization_id=$2 AND idempotency_key=$3
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(idempotency_key)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(request) = request else {
        return Ok(None);
    };
    let decisions = load_decisions_tx(tx, request.id).await?;
    Ok(Some(ApprovalAggregate { request, decisions }))
}

async fn load_approval_request_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    approval_id: Uuid,
    for_update: bool,
) -> Result<Option<ApprovalRequestRecord>, DocumentError> {
    let query = if for_update {
        sqlx::query_as::<_, ApprovalRequestRecord>(APPROVAL_SELECT_ONE_FOR_UPDATE)
    } else {
        sqlx::query_as::<_, ApprovalRequestRecord>(APPROVAL_SELECT_ONE)
    };
    query
        .bind(approval_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut **tx)
        .await
        .map_err(Into::into)
}

async fn load_approval_aggregate_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    approval_id: Uuid,
) -> Result<Option<ApprovalAggregate>, DocumentError> {
    let Some(request) =
        load_approval_request_tx(tx, business_id, organization_id, approval_id, false).await?
    else {
        return Ok(None);
    };
    let decisions = load_decisions_tx(tx, request.id).await?;
    Ok(Some(ApprovalAggregate { request, decisions }))
}

async fn load_decisions_tx(
    tx: &mut Transaction<'_, Postgres>,
    approval_id: Uuid,
) -> Result<Vec<ApprovalDecisionRecord>, DocumentError> {
    sqlx::query_as::<_, ApprovalDecisionRecord>(DECISION_SELECT)
        .bind(approval_id)
        .fetch_all(&mut **tx)
        .await
        .map_err(Into::into)
}

async fn load_decisions_pool(
    db: &PgPool,
    approval_id: Uuid,
) -> Result<Vec<ApprovalDecisionRecord>, DocumentError> {
    sqlx::query_as::<_, ApprovalDecisionRecord>(DECISION_SELECT)
        .bind(approval_id)
        .fetch_all(db)
        .await
        .map_err(Into::into)
}

async fn emit_document_event(
    tx: &mut Transaction<'_, Postgres>,
    document: &DocumentRecord,
    event_type: &str,
    extra: Value,
) -> Result<(), DocumentError> {
    let event_id = Uuid::new_v4();
    let payload = json!({
        "event_version":1,
        "document_id":document.id,
        "business_id":document.business_id,
        "organization_id":document.organization_id,
        "document_type":document.document_type,
        "document_number":document.document_number,
        "status":document.status,
        "total_amount":document.total_amount,
        "currency":document.currency,
        "party_id":document.party_id,
        "location_id":document.location_id,
        "correlation_id":document.correlation_id,
        "extra":extra,
    });
    enqueue_business_event(
        tx,
        event_id,
        "business_document",
        document.id,
        event_type,
        &payload,
        &format!("{event_type}:{}:v{}", document.id, document.version),
        event_type,
    )
    .await?;
    Ok(())
}

async fn emit_approval_event(
    tx: &mut Transaction<'_, Postgres>,
    approval: &ApprovalRequestRecord,
    event_type: &str,
    event_suffix: &str,
    extra: Value,
) -> Result<(), DocumentError> {
    let event_id = Uuid::new_v4();
    let payload = json!({
        "event_version":1,
        "approval_request_id":approval.id,
        "document_id":approval.document_id,
        "business_id":approval.business_id,
        "organization_id":approval.organization_id,
        "action_key":approval.action_key,
        "state":approval.state,
        "required_role":approval.required_role,
        "required_approvals":approval.required_approvals,
        "extra":extra,
    });
    enqueue_business_event(
        tx,
        event_id,
        "business_approval_request",
        approval.id,
        event_type,
        &payload,
        &format!("{event_type}:{}:{event_suffix}", approval.id),
        event_type,
    )
    .await?;
    Ok(())
}

const DOCUMENT_SELECT_LIST: &str = r#"
SELECT id,organization_id,business_id,location_id,party_id,document_type,document_number,status,
       currency,document_date,due_date,subtotal_amount,discount_amount,tax_amount,total_amount,
       note,metadata,source_type,source_id,correlation_id,idempotency_key,request_hash,version,
       issued_at,issued_by_user_id,posted_at,posted_by_user_id,voided_at,voided_by_user_id,
       void_reason,reversed_at,reversed_by_user_id,reversal_reason,created_by_user_id,
       updated_by_user_id,created_at,updated_at
FROM business_documents
WHERE business_id=$1 AND organization_id=$2
ORDER BY document_date DESC,created_at DESC,id DESC
LIMIT $3
"#;

const DOCUMENT_SELECT_ONE: &str = r#"
SELECT id,organization_id,business_id,location_id,party_id,document_type,document_number,status,
       currency,document_date,due_date,subtotal_amount,discount_amount,tax_amount,total_amount,
       note,metadata,source_type,source_id,correlation_id,idempotency_key,request_hash,version,
       issued_at,issued_by_user_id,posted_at,posted_by_user_id,voided_at,voided_by_user_id,
       void_reason,reversed_at,reversed_by_user_id,reversal_reason,created_by_user_id,
       updated_by_user_id,created_at,updated_at
FROM business_documents
WHERE id=$1 AND business_id=$2 AND organization_id=$3
"#;

const DOCUMENT_SELECT_ONE_FOR_UPDATE: &str = r#"
SELECT id,organization_id,business_id,location_id,party_id,document_type,document_number,status,
       currency,document_date,due_date,subtotal_amount,discount_amount,tax_amount,total_amount,
       note,metadata,source_type,source_id,correlation_id,idempotency_key,request_hash,version,
       issued_at,issued_by_user_id,posted_at,posted_by_user_id,voided_at,voided_by_user_id,
       void_reason,reversed_at,reversed_by_user_id,reversal_reason,created_by_user_id,
       updated_by_user_id,created_at,updated_at
FROM business_documents
WHERE id=$1 AND business_id=$2 AND organization_id=$3
FOR UPDATE
"#;

const DOCUMENT_LINKS_OUTBOUND_SELECT: &str = r#"
SELECT id,organization_id,business_id,from_document_id,to_document_id,relation_type,
       created_by_user_id,created_at
FROM business_document_links
WHERE business_id=$1 AND organization_id=$2 AND from_document_id=$3
ORDER BY created_at,id
"#;

const DOCUMENT_LINKS_INBOUND_SELECT: &str = r#"
SELECT id,organization_id,business_id,from_document_id,to_document_id,relation_type,
       created_by_user_id,created_at
FROM business_document_links
WHERE business_id=$1 AND organization_id=$2 AND to_document_id=$3
ORDER BY created_at,id
"#;

const APPROVAL_SELECT_ONE: &str = r#"
SELECT id,organization_id,business_id,document_id,action_key,rule_id,state,
       required_role,required_approvals,requested_by_user_id,request_reason,
       idempotency_key,request_hash,decided_at,consumed_at,created_at
FROM business_approval_requests
WHERE id=$1 AND business_id=$2 AND organization_id=$3
"#;

const APPROVAL_SELECT_ONE_FOR_UPDATE: &str = r#"
SELECT id,organization_id,business_id,document_id,action_key,rule_id,state,
       required_role,required_approvals,requested_by_user_id,request_reason,
       idempotency_key,request_hash,decided_at,consumed_at,created_at
FROM business_approval_requests
WHERE id=$1 AND business_id=$2 AND organization_id=$3
FOR UPDATE
"#;

const DECISION_SELECT: &str = r#"
SELECT id,organization_id,business_id,approval_request_id,approver_user_id,
       approver_role,decision,note,created_at
FROM business_approval_decisions
WHERE approval_request_id=$1
ORDER BY created_at,id
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn document_line_math_rounds_fractional_quantity_deterministically() {
        let line = normalize_line(CreateDocumentLineRequest {
            product_id: None,
            description: "Jasa 1,5 jam".into(),
            quantity: Decimal::new(15, 1),
            unit_price_amount: 10_001,
            discount_amount: 1,
            tax_amount: 2,
            metadata: json!({}),
        })
        .unwrap();
        assert_eq!(line.gross_amount, 15_002);
        assert_eq!(line.line_total_amount, 15_003);
    }

    #[test]
    fn posted_document_cannot_be_voided_in_place() {
        assert!(validate_transition("draft", "issue", None).is_ok());
        assert!(validate_transition("issued", "post", None).is_ok());
        assert!(validate_transition("issued", "void", Some("mistake")).is_ok());
        assert!(validate_transition("posted", "void", Some("mistake")).is_err());
        assert!(validate_transition("posted", "reverse", Some("correction")).is_ok());
    }

    #[test]
    fn document_party_policy_separates_customer_and_supplier_documents() {
        assert_eq!(
            document_party_policy("invoice"),
            (Some(CounterpartyRole::Customer), true)
        );
        assert_eq!(
            document_party_policy("vendor_bill"),
            (Some(CounterpartyRole::Supplier), true)
        );
        assert_eq!(document_party_policy("purchase_requisition"), (None, false));
    }

    #[test]
    fn maker_checker_role_boundary_is_explicit() {
        assert!(is_owner_manager_role("org_admin"));
        assert!(is_owner_manager_role("manager"));
        assert!(!is_owner_manager_role("cashier"));
    }
}
