use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sha2::{Digest, Sha256};
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

use super::execution_policy::{
    allocate_document_number_tx, load_execution_policy_tx, ExecutionPolicyError,
};

const MAX_PARTY_NAME: usize = 200;
const MAX_LEGAL_NAME: usize = 250;
const MAX_PHONE: usize = 64;
const MAX_EMAIL: usize = 254;
const MAX_TAX_ID: usize = 100;
const MAX_ADDRESS: usize = 2_000;
const MAX_NOTE: usize = 2_000;
const MAX_REFERENCE: usize = 200;
const MAX_PAYMENT_ALLOCATIONS: usize = 100;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum CommercialCoreError {
    Validation(&'static str),
    NotFound,
    Conflict,
    Database,
}

impl From<sqlx::Error> for CommercialCoreError {
    fn from(error: sqlx::Error) -> Self {
        if matches!(&error, sqlx::Error::Database(db) if db.is_unique_violation()) {
            Self::Conflict
        } else {
            Self::Database
        }
    }
}

fn map_policy_error(_: ExecutionPolicyError) -> CommercialCoreError {
    CommercialCoreError::Database
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CreatePartyRequest {
    pub(crate) party_kind: String,
    pub(crate) display_name: String,
    #[serde(default)]
    pub(crate) legal_name: Option<String>,
    #[serde(default)]
    pub(crate) phone: Option<String>,
    #[serde(default)]
    pub(crate) email: Option<String>,
    #[serde(default)]
    pub(crate) tax_identifier: Option<String>,
    #[serde(default)]
    pub(crate) address: Option<String>,
    #[serde(default)]
    pub(crate) note: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct UpdatePartyRequest {
    pub(crate) expected_version: i64,
    pub(crate) party_kind: String,
    pub(crate) display_name: String,
    #[serde(default)]
    pub(crate) legal_name: Option<String>,
    #[serde(default)]
    pub(crate) phone: Option<String>,
    #[serde(default)]
    pub(crate) email: Option<String>,
    #[serde(default)]
    pub(crate) tax_identifier: Option<String>,
    #[serde(default)]
    pub(crate) address: Option<String>,
    #[serde(default)]
    pub(crate) note: String,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ArchivePartyRequest {
    pub(crate) expected_version: i64,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct PartyRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) party_kind: String,
    pub(crate) display_name: String,
    pub(crate) legal_name: Option<String>,
    pub(crate) phone: Option<String>,
    pub(crate) email: Option<String>,
    pub(crate) tax_identifier: Option<String>,
    pub(crate) address: Option<String>,
    pub(crate) note: String,
    pub(crate) status: String,
    pub(crate) version: i64,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) updated_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct PaymentAllocationRequest {
    #[serde(default)]
    pub(crate) sale_id: Option<Uuid>,
    #[serde(default)]
    pub(crate) purchase_id: Option<Uuid>,
    pub(crate) amount: i64,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct CreatePaymentRequest {
    pub(crate) direction: String,
    pub(crate) account_key: String,
    pub(crate) amount: i64,
    pub(crate) occurred_on: NaiveDate,
    #[serde(default)]
    pub(crate) party_id: Option<Uuid>,
    #[serde(default)]
    pub(crate) reference: String,
    #[serde(default)]
    pub(crate) note: String,
    pub(crate) allocations: Vec<PaymentAllocationRequest>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct ReversePaymentRequest {
    pub(crate) occurred_on: NaiveDate,
    pub(crate) reason: String,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct PaymentRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) document_number: String,
    pub(crate) direction: String,
    pub(crate) account_key: String,
    pub(crate) amount: i64,
    pub(crate) currency: String,
    pub(crate) party_id: Option<Uuid>,
    pub(crate) occurred_on: NaiveDate,
    pub(crate) reference: String,
    pub(crate) note: String,
    pub(crate) correlation_id: Uuid,
    pub(crate) effect_multiplier: i16,
    pub(crate) reversal_of_payment_id: Option<Uuid>,
    pub(crate) finance_entry_id: Uuid,
    pub(crate) idempotency_key: Uuid,
    pub(crate) request_hash: String,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct PaymentAllocationRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) payment_id: Uuid,
    pub(crate) sale_id: Option<Uuid>,
    pub(crate) purchase_id: Option<Uuid>,
    pub(crate) amount: i64,
    pub(crate) created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct PaymentAggregate {
    pub(crate) payment: PaymentRecord,
    pub(crate) allocations: Vec<PaymentAllocationRecord>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct PaymentOutcome {
    pub(crate) payment: PaymentAggregate,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct ReceivableBalanceRecord {
    pub(crate) sale_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) document_number: String,
    pub(crate) currency: String,
    pub(crate) occurred_on: NaiveDate,
    pub(crate) original_amount: i64,
    pub(crate) paid_amount: i64,
    pub(crate) outstanding_amount: i64,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct PayableBalanceRecord {
    pub(crate) purchase_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) document_number: String,
    pub(crate) currency: String,
    pub(crate) occurred_on: NaiveDate,
    pub(crate) original_amount: i64,
    pub(crate) paid_amount: i64,
    pub(crate) outstanding_amount: i64,
}

#[derive(Debug, Clone, Serialize)]
struct NormalizedParty {
    party_kind: String,
    display_name: String,
    legal_name: Option<String>,
    phone: Option<String>,
    email: Option<String>,
    tax_identifier: Option<String>,
    address: Option<String>,
    note: String,
}

#[derive(Debug, Clone, Serialize)]
struct NormalizedPayment {
    direction: String,
    account_key: String,
    amount: i64,
    occurred_on: NaiveDate,
    party_id: Option<Uuid>,
    reference: String,
    note: String,
    allocations: Vec<PaymentAllocationRequest>,
}

#[derive(Clone)]
pub(crate) struct CommercialCoreRepository {
    db: PgPool,
}

impl CommercialCoreRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn list_parties(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        include_archived: bool,
    ) -> Result<Vec<PartyRecord>, CommercialCoreError> {
        sqlx::query_as::<_, PartyRecord>(
            r#"
            SELECT id,organization_id,business_id,party_kind,display_name,legal_name,phone,email,
                   tax_identifier,address,note,status,version,created_by_user_id,updated_by_user_id,
                   created_at,updated_at
            FROM business_parties
            WHERE business_id=$1 AND organization_id=$2
              AND ($3 OR status='active')
            ORDER BY status,display_name,id
            LIMIT 1000
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(include_archived)
        .fetch_all(&self.db)
        .await
        .map_err(Into::into)
    }

    pub(crate) async fn create_party(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: CreatePartyRequest,
    ) -> Result<(PartyRecord, bool), CommercialCoreError> {
        let normalized = normalize_party(request)?;
        let request_hash = canonical_hash(&normalized)?;
        let mut tx = self.db.begin().await?;
        idempotency_lock(&mut tx, "party", business_id, idempotency_key).await?;

        if let Some((existing_hash, party)) =
            find_party_by_key_tx(&mut tx, business_id, organization_id, idempotency_key).await?
        {
            if existing_hash != request_hash {
                return Err(CommercialCoreError::Conflict);
            }
            tx.commit().await?;
            return Ok((party, true));
        }

        let party = sqlx::query_as::<_, PartyRecord>(
            r#"
            INSERT INTO business_parties (
              organization_id,business_id,party_kind,display_name,legal_name,phone,email,
              tax_identifier,address,note,idempotency_key,request_hash,
              created_by_user_id,updated_by_user_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$13)
            RETURNING id,organization_id,business_id,party_kind,display_name,legal_name,phone,email,
                      tax_identifier,address,note,status,version,created_by_user_id,updated_by_user_id,
                      created_at,updated_at
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(&normalized.party_kind)
        .bind(&normalized.display_name)
        .bind(normalized.legal_name.as_deref())
        .bind(normalized.phone.as_deref())
        .bind(normalized.email.as_deref())
        .bind(normalized.tax_identifier.as_deref())
        .bind(normalized.address.as_deref())
        .bind(&normalized.note)
        .bind(idempotency_key)
        .bind(&request_hash)
        .bind(actor_id)
        .fetch_one(&mut *tx)
        .await?;

        insert_outbox(
            &mut tx,
            "business_party",
            party.id,
            "marketplace.business.party_created",
            json!({
                "event_version": 1,
                "party_id": party.id,
                "business_id": business_id,
                "organization_id": organization_id,
                "party_kind": party.party_kind,
                "version": party.version,
            }),
        )
        .await?;
        tx.commit().await?;
        Ok((party, false))
    }

    pub(crate) async fn update_party(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        party_id: Uuid,
        request: UpdatePartyRequest,
    ) -> Result<PartyRecord, CommercialCoreError> {
        if request.expected_version <= 0 {
            return Err(CommercialCoreError::Validation("invalid_party_version"));
        }
        let normalized = normalize_party(CreatePartyRequest {
            party_kind: request.party_kind,
            display_name: request.display_name,
            legal_name: request.legal_name,
            phone: request.phone,
            email: request.email,
            tax_identifier: request.tax_identifier,
            address: request.address,
            note: request.note,
        })?;
        let mut tx = self.db.begin().await?;
        let updated = sqlx::query_as::<_, PartyRecord>(
            r#"
            UPDATE business_parties
            SET party_kind=$5,display_name=$6,legal_name=$7,phone=$8,email=$9,
                tax_identifier=$10,address=$11,note=$12,version=version+1,
                updated_by_user_id=$13,updated_at=NOW()
            WHERE id=$1 AND business_id=$2 AND organization_id=$3
              AND version=$4 AND status='active'
            RETURNING id,organization_id,business_id,party_kind,display_name,legal_name,phone,email,
                      tax_identifier,address,note,status,version,created_by_user_id,updated_by_user_id,
                      created_at,updated_at
            "#,
        )
        .bind(party_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(request.expected_version)
        .bind(&normalized.party_kind)
        .bind(&normalized.display_name)
        .bind(normalized.legal_name.as_deref())
        .bind(normalized.phone.as_deref())
        .bind(normalized.email.as_deref())
        .bind(normalized.tax_identifier.as_deref())
        .bind(normalized.address.as_deref())
        .bind(&normalized.note)
        .bind(actor_id)
        .fetch_optional(&mut *tx)
        .await?;

        let Some(updated) = updated else {
            return Err(
                classify_party_write_miss(&mut tx, business_id, organization_id, party_id).await?,
            );
        };
        insert_outbox(
            &mut tx,
            "business_party",
            updated.id,
            "marketplace.business.party_updated",
            json!({
                "event_version": 1,
                "party_id": updated.id,
                "business_id": business_id,
                "organization_id": organization_id,
                "version": updated.version,
            }),
        )
        .await?;
        tx.commit().await?;
        Ok(updated)
    }

    pub(crate) async fn archive_party(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        party_id: Uuid,
        expected_version: i64,
    ) -> Result<PartyRecord, CommercialCoreError> {
        if expected_version <= 0 {
            return Err(CommercialCoreError::Validation("invalid_party_version"));
        }
        let mut tx = self.db.begin().await?;
        let archived = sqlx::query_as::<_, PartyRecord>(
            r#"
            UPDATE business_parties
            SET status='archived',version=version+1,updated_by_user_id=$5,updated_at=NOW()
            WHERE id=$1 AND business_id=$2 AND organization_id=$3
              AND version=$4 AND status='active'
            RETURNING id,organization_id,business_id,party_kind,display_name,legal_name,phone,email,
                      tax_identifier,address,note,status,version,created_by_user_id,updated_by_user_id,
                      created_at,updated_at
            "#,
        )
        .bind(party_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(expected_version)
        .bind(actor_id)
        .fetch_optional(&mut *tx)
        .await?;

        let Some(archived) = archived else {
            return Err(
                classify_party_write_miss(&mut tx, business_id, organization_id, party_id).await?,
            );
        };
        insert_outbox(
            &mut tx,
            "business_party",
            archived.id,
            "marketplace.business.party_archived",
            json!({
                "event_version": 1,
                "party_id": archived.id,
                "business_id": business_id,
                "organization_id": organization_id,
                "version": archived.version,
            }),
        )
        .await?;
        tx.commit().await?;
        Ok(archived)
    }

    pub(crate) async fn list_payments(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        limit: i64,
    ) -> Result<Vec<PaymentAggregate>, CommercialCoreError> {
        let payments = sqlx::query_as::<_, PaymentRecord>(PAYMENT_SELECT)
            .bind(business_id)
            .bind(organization_id)
            .bind(limit.clamp(1, 500))
            .fetch_all(&self.db)
            .await?;
        let mut result = Vec::with_capacity(payments.len());
        for payment in payments {
            let allocations = load_allocations_pool(&self.db, payment.id).await?;
            result.push(PaymentAggregate {
                payment,
                allocations,
            });
        }
        Ok(result)
    }

    pub(crate) async fn create_payment(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        idempotency_key: Uuid,
        request: CreatePaymentRequest,
    ) -> Result<PaymentOutcome, CommercialCoreError> {
        let normalized = normalize_payment(request)?;
        let request_hash = canonical_hash(&normalized)?;
        let mut tx = self.db.begin().await?;
        idempotency_lock(&mut tx, "payment", business_id, idempotency_key).await?;

        if let Some(existing) =
            find_payment_by_key_tx(&mut tx, business_id, organization_id, idempotency_key).await?
        {
            if existing.payment.request_hash != request_hash {
                return Err(CommercialCoreError::Conflict);
            }
            tx.commit().await?;
            return Ok(PaymentOutcome {
                payment: existing,
                replayed: true,
            });
        }

        let policy = load_execution_policy_tx(&mut tx, business_id, organization_id)
            .await
            .map_err(map_policy_error)?;
        if let Some(party_id) = normalized.party_id {
            ensure_active_party_tx(&mut tx, business_id, organization_id, party_id).await?;
        }

        validate_allocations_tx(
            &mut tx,
            business_id,
            organization_id,
            &policy.currency,
            &normalized,
        )
        .await?;

        let payment_id = Uuid::new_v4();
        let correlation_id = Uuid::new_v4();
        let document_number = allocate_document_number_tx(
            &mut tx,
            business_id,
            organization_id,
            "payment",
            &policy.document_prefix,
        )
        .await
        .map_err(map_policy_error)?;
        let finance_entry_type = if normalized.direction == "incoming" {
            "receivable_payment"
        } else {
            "payable_payment"
        };
        let finance_entry_id = insert_payment_finance_entry_tx(
            &mut tx,
            payment_id,
            actor_id,
            business_id,
            organization_id,
            finance_entry_type,
            &normalized.account_key,
            normalized.amount,
            normalized.occurred_on,
            &normalized.note,
            1,
            None,
            None,
        )
        .await?;

        let payment = sqlx::query_as::<_, PaymentRecord>(
            r#"
            INSERT INTO business_payments (
              id,organization_id,business_id,document_number,direction,account_key,amount,currency,
              party_id,occurred_on,reference,note,correlation_id,effect_multiplier,
              finance_entry_id,idempotency_key,request_hash,created_by_user_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,1,$14,$15,$16,$17)
            RETURNING id,organization_id,business_id,document_number,direction,account_key,amount,
                      currency,party_id,occurred_on,reference,note,correlation_id,effect_multiplier,
                      reversal_of_payment_id,finance_entry_id,idempotency_key,request_hash,
                      created_by_user_id,created_at
            "#,
        )
        .bind(payment_id)
        .bind(organization_id)
        .bind(business_id)
        .bind(&document_number)
        .bind(&normalized.direction)
        .bind(&normalized.account_key)
        .bind(normalized.amount)
        .bind(&policy.currency)
        .bind(normalized.party_id)
        .bind(normalized.occurred_on)
        .bind(&normalized.reference)
        .bind(&normalized.note)
        .bind(correlation_id)
        .bind(finance_entry_id)
        .bind(idempotency_key)
        .bind(&request_hash)
        .bind(actor_id)
        .fetch_one(&mut *tx)
        .await?;

        for allocation in &normalized.allocations {
            insert_allocation_tx(
                &mut tx,
                organization_id,
                business_id,
                payment.id,
                allocation,
            )
            .await?;
        }
        insert_outbox(
            &mut tx,
            "business_payment",
            payment.id,
            "marketplace.business.payment_posted",
            json!({
                "event_version": 1,
                "payment_id": payment.id,
                "business_id": business_id,
                "organization_id": organization_id,
                "document_number": payment.document_number,
                "direction": payment.direction,
                "amount": payment.amount,
                "currency": payment.currency,
                "correlation_id": payment.correlation_id,
                "party_id": payment.party_id,
            }),
        )
        .await?;
        let allocations = load_allocations_tx(&mut tx, payment.id).await?;
        tx.commit().await?;

        Ok(PaymentOutcome {
            payment: PaymentAggregate {
                payment,
                allocations,
            },
            replayed: false,
        })
    }

    pub(crate) async fn reverse_payment(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        payment_id: Uuid,
        idempotency_key: Uuid,
        request: ReversePaymentRequest,
    ) -> Result<PaymentOutcome, CommercialCoreError> {
        let reason = normalized_required(
            &request.reason,
            MAX_NOTE,
            "payment_reversal_reason_required",
        )?;
        let request_hash = canonical_hash(&json!({
            "payment_id": payment_id,
            "occurred_on": request.occurred_on,
            "reason": &reason,
        }))?;
        let mut tx = self.db.begin().await?;
        idempotency_lock(&mut tx, "payment", business_id, idempotency_key).await?;

        if let Some(existing) =
            find_payment_by_key_tx(&mut tx, business_id, organization_id, idempotency_key).await?
        {
            if existing.payment.request_hash != request_hash {
                return Err(CommercialCoreError::Conflict);
            }
            tx.commit().await?;
            return Ok(PaymentOutcome {
                payment: existing,
                replayed: true,
            });
        }

        let original = sqlx::query_as::<_, PaymentRecord>(
            r#"
            SELECT id,organization_id,business_id,document_number,direction,account_key,amount,
                   currency,party_id,occurred_on,reference,note,correlation_id,effect_multiplier,
                   reversal_of_payment_id,finance_entry_id,idempotency_key,request_hash,
                   created_by_user_id,created_at
            FROM business_payments
            WHERE id=$1 AND business_id=$2 AND organization_id=$3
              AND effect_multiplier=1 AND reversal_of_payment_id IS NULL
            FOR UPDATE
            "#,
        )
        .bind(payment_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut *tx)
        .await?
        .ok_or(CommercialCoreError::NotFound)?;

        let already_reversed: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM business_payments WHERE reversal_of_payment_id=$1)",
        )
        .bind(original.id)
        .fetch_one(&mut *tx)
        .await?;
        if already_reversed {
            return Err(CommercialCoreError::Conflict);
        }

        let policy = load_execution_policy_tx(&mut tx, business_id, organization_id)
            .await
            .map_err(map_policy_error)?;
        let reversal_id = Uuid::new_v4();
        let correlation_id = Uuid::new_v4();
        let document_number = allocate_document_number_tx(
            &mut tx,
            business_id,
            organization_id,
            "payment",
            &policy.document_prefix,
        )
        .await
        .map_err(map_policy_error)?;
        let finance_entry_type = if original.direction == "incoming" {
            "receivable_payment"
        } else {
            "payable_payment"
        };
        let finance_entry_id = insert_payment_finance_entry_tx(
            &mut tx,
            reversal_id,
            actor_id,
            business_id,
            organization_id,
            finance_entry_type,
            &original.account_key,
            original.amount,
            request.occurred_on,
            &reason,
            -1,
            Some(original.finance_entry_id),
            Some(&reason),
        )
        .await?;

        let reversal = sqlx::query_as::<_, PaymentRecord>(
            r#"
            INSERT INTO business_payments (
              id,organization_id,business_id,document_number,direction,account_key,amount,currency,
              party_id,occurred_on,reference,note,correlation_id,effect_multiplier,
              reversal_of_payment_id,finance_entry_id,idempotency_key,request_hash,created_by_user_id
            ) VALUES (
              $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,-1,$14,$15,$16,$17,$18
            )
            RETURNING id,organization_id,business_id,document_number,direction,account_key,amount,
                      currency,party_id,occurred_on,reference,note,correlation_id,effect_multiplier,
                      reversal_of_payment_id,finance_entry_id,idempotency_key,request_hash,
                      created_by_user_id,created_at
            "#,
        )
        .bind(reversal_id)
        .bind(organization_id)
        .bind(business_id)
        .bind(&document_number)
        .bind(&original.direction)
        .bind(&original.account_key)
        .bind(original.amount)
        .bind(&original.currency)
        .bind(original.party_id)
        .bind(request.occurred_on)
        .bind(format!("Reversal {}", original.document_number))
        .bind(&reason)
        .bind(correlation_id)
        .bind(original.id)
        .bind(finance_entry_id)
        .bind(idempotency_key)
        .bind(&request_hash)
        .bind(actor_id)
        .fetch_one(&mut *tx)
        .await?;

        let original_allocations = load_allocations_tx(&mut tx, original.id).await?;
        for allocation in original_allocations {
            insert_allocation_tx(
                &mut tx,
                organization_id,
                business_id,
                reversal.id,
                &PaymentAllocationRequest {
                    sale_id: allocation.sale_id,
                    purchase_id: allocation.purchase_id,
                    amount: allocation.amount,
                },
            )
            .await?;
        }
        insert_outbox(
            &mut tx,
            "business_payment",
            reversal.id,
            "marketplace.business.payment_reversed",
            json!({
                "event_version": 1,
                "payment_id": reversal.id,
                "reversal_of_payment_id": original.id,
                "business_id": business_id,
                "organization_id": organization_id,
                "document_number": reversal.document_number,
                "amount": reversal.amount,
                "currency": reversal.currency,
                "correlation_id": reversal.correlation_id,
                "reason": reason,
            }),
        )
        .await?;

        let allocations = load_allocations_tx(&mut tx, reversal.id).await?;
        tx.commit().await?;
        Ok(PaymentOutcome {
            payment: PaymentAggregate {
                payment: reversal,
                allocations,
            },
            replayed: false,
        })
    }

    pub(crate) async fn receivables(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<ReceivableBalanceRecord>, CommercialCoreError> {
        sqlx::query_as::<_, ReceivableBalanceRecord>(
            r#"
            SELECT sale_id,business_id,organization_id,document_number,currency,occurred_on,
                   original_amount,paid_amount,outstanding_amount
            FROM business_sale_receivable_balances
            WHERE business_id=$1 AND organization_id=$2
            ORDER BY outstanding_amount DESC,occurred_on,sale_id
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_all(&self.db)
        .await
        .map_err(Into::into)
    }

    pub(crate) async fn payables(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<PayableBalanceRecord>, CommercialCoreError> {
        sqlx::query_as::<_, PayableBalanceRecord>(
            r#"
            SELECT purchase_id,business_id,organization_id,document_number,currency,occurred_on,
                   original_amount,paid_amount,outstanding_amount
            FROM business_purchase_payable_balances
            WHERE business_id=$1 AND organization_id=$2
            ORDER BY outstanding_amount DESC,occurred_on,purchase_id
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_all(&self.db)
        .await
        .map_err(Into::into)
    }
}

fn normalize_party(request: CreatePartyRequest) -> Result<NormalizedParty, CommercialCoreError> {
    let party_kind = request.party_kind.trim().to_ascii_lowercase();
    if !matches!(
        party_kind.as_str(),
        "customer" | "supplier" | "both" | "other"
    ) {
        return Err(CommercialCoreError::Validation("invalid_party_kind"));
    }
    Ok(NormalizedParty {
        party_kind,
        display_name: normalized_required(
            &request.display_name,
            MAX_PARTY_NAME,
            "invalid_party_name",
        )?,
        legal_name: normalized_optional(
            request.legal_name.as_deref(),
            MAX_LEGAL_NAME,
            "invalid_party_legal_name",
        )?,
        phone: normalized_optional(request.phone.as_deref(), MAX_PHONE, "invalid_party_phone")?,
        email: normalized_optional(request.email.as_deref(), MAX_EMAIL, "invalid_party_email")?
            .map(|value| value.to_ascii_lowercase()),
        tax_identifier: normalized_optional(
            request.tax_identifier.as_deref(),
            MAX_TAX_ID,
            "invalid_party_tax_identifier",
        )?,
        address: normalized_optional(
            request.address.as_deref(),
            MAX_ADDRESS,
            "invalid_party_address",
        )?,
        note: normalized_text(&request.note, MAX_NOTE, "party_note_too_long")?,
    })
}

fn normalize_payment(
    request: CreatePaymentRequest,
) -> Result<NormalizedPayment, CommercialCoreError> {
    let direction = request.direction.trim().to_ascii_lowercase();
    if !matches!(direction.as_str(), "incoming" | "outgoing") {
        return Err(CommercialCoreError::Validation("invalid_payment_direction"));
    }
    let account_key = request.account_key.trim().to_ascii_lowercase();
    if !matches!(account_key.as_str(), "cash" | "bank" | "ewallet") {
        return Err(CommercialCoreError::Validation("invalid_payment_account"));
    }
    if request.amount <= 0 {
        return Err(CommercialCoreError::Validation("invalid_payment_amount"));
    }
    if request.allocations.is_empty() || request.allocations.len() > MAX_PAYMENT_ALLOCATIONS {
        return Err(CommercialCoreError::Validation(
            "invalid_payment_allocations",
        ));
    }

    let mut allocations = request.allocations;
    for allocation in &allocations {
        if allocation.amount <= 0
            || (allocation.sale_id.is_some() == allocation.purchase_id.is_some())
        {
            return Err(CommercialCoreError::Validation(
                "invalid_payment_allocation",
            ));
        }
        if direction == "incoming" && allocation.sale_id.is_none() {
            return Err(CommercialCoreError::Validation(
                "incoming_payment_requires_sale",
            ));
        }
        if direction == "outgoing" && allocation.purchase_id.is_none() {
            return Err(CommercialCoreError::Validation(
                "outgoing_payment_requires_purchase",
            ));
        }
    }
    allocations.sort_by_key(|allocation| {
        allocation
            .sale_id
            .or(allocation.purchase_id)
            .map(|id| id.as_u128())
            .unwrap_or_default()
    });
    for pair in allocations.windows(2) {
        let left = pair[0].sale_id.or(pair[0].purchase_id);
        let right = pair[1].sale_id.or(pair[1].purchase_id);
        if left == right {
            return Err(CommercialCoreError::Validation(
                "duplicate_payment_allocation",
            ));
        }
    }
    let allocated = allocations
        .iter()
        .try_fold(0i64, |total, allocation| {
            total.checked_add(allocation.amount)
        })
        .ok_or(CommercialCoreError::Validation("payment_amount_overflow"))?;
    if allocated != request.amount {
        return Err(CommercialCoreError::Validation(
            "payment_allocation_total_mismatch",
        ));
    }

    Ok(NormalizedPayment {
        direction,
        account_key,
        amount: request.amount,
        occurred_on: request.occurred_on,
        party_id: request.party_id,
        reference: normalized_text(
            &request.reference,
            MAX_REFERENCE,
            "payment_reference_too_long",
        )?,
        note: normalized_text(&request.note, MAX_NOTE, "payment_note_too_long")?,
        allocations,
    })
}

fn normalized_required(
    value: &str,
    max: usize,
    code: &'static str,
) -> Result<String, CommercialCoreError> {
    let value = value.split_whitespace().collect::<Vec<_>>().join(" ");
    if value.is_empty() || value.chars().count() > max {
        Err(CommercialCoreError::Validation(code))
    } else {
        Ok(value)
    }
}

fn normalized_optional(
    value: Option<&str>,
    max: usize,
    code: &'static str,
) -> Result<Option<String>, CommercialCoreError> {
    let Some(value) = value else {
        return Ok(None);
    };
    let value = value.trim();
    if value.is_empty() {
        return Ok(None);
    }
    if value.chars().count() > max {
        return Err(CommercialCoreError::Validation(code));
    }
    Ok(Some(value.to_owned()))
}

fn normalized_text(
    value: &str,
    max: usize,
    code: &'static str,
) -> Result<String, CommercialCoreError> {
    if value.chars().count() > max {
        Err(CommercialCoreError::Validation(code))
    } else {
        Ok(value.trim().to_owned())
    }
}

fn canonical_hash<T: Serialize>(value: &T) -> Result<String, CommercialCoreError> {
    let bytes = serde_json::to_vec(value).map_err(|_| CommercialCoreError::Database)?;
    Ok(format!("{:x}", Sha256::digest(bytes)))
}

async fn idempotency_lock(
    tx: &mut Transaction<'_, Postgres>,
    domain: &str,
    business_id: Uuid,
    idempotency_key: Uuid,
) -> Result<(), CommercialCoreError> {
    sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1,0))")
        .bind(format!("{domain}:{business_id}:{idempotency_key}"))
        .execute(&mut **tx)
        .await?;
    Ok(())
}

async fn find_party_by_key_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<(String, PartyRecord)>, CommercialCoreError> {
    let existing = sqlx::query_as::<_, (String, Uuid)>(
        r#"
        SELECT request_hash,id
        FROM business_parties
        WHERE business_id=$1 AND organization_id=$2 AND idempotency_key=$3
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(idempotency_key)
    .fetch_optional(&mut **tx)
    .await?;

    let Some((request_hash, party_id)) = existing else {
        return Ok(None);
    };
    let party = load_party_tx(tx, business_id, organization_id, party_id)
        .await?
        .ok_or(CommercialCoreError::Database)?;
    Ok(Some((request_hash, party)))
}

async fn load_party_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    party_id: Uuid,
) -> Result<Option<PartyRecord>, CommercialCoreError> {
    sqlx::query_as::<_, PartyRecord>(
        r#"
        SELECT id,organization_id,business_id,party_kind,display_name,legal_name,phone,email,
               tax_identifier,address,note,status,version,created_by_user_id,updated_by_user_id,
               created_at,updated_at
        FROM business_parties
        WHERE id=$1 AND business_id=$2 AND organization_id=$3
        "#,
    )
    .bind(party_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_optional(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn classify_party_write_miss(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    party_id: Uuid,
) -> Result<CommercialCoreError, CommercialCoreError> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM business_parties WHERE id=$1 AND business_id=$2 AND organization_id=$3)",
    )
    .bind(party_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **tx)
    .await?;
    Ok(if exists {
        CommercialCoreError::Conflict
    } else {
        CommercialCoreError::NotFound
    })
}

async fn ensure_active_party_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    party_id: Uuid,
) -> Result<(), CommercialCoreError> {
    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
          SELECT 1 FROM business_parties
          WHERE id=$1 AND business_id=$2 AND organization_id=$3 AND status='active'
        )
        "#,
    )
    .bind(party_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **tx)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(CommercialCoreError::Validation("invalid_payment_party"))
    }
}

async fn validate_allocations_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    currency: &str,
    payment: &NormalizedPayment,
) -> Result<(), CommercialCoreError> {
    for allocation in &payment.allocations {
        if let Some(sale_id) = allocation.sale_id {
            let row = sqlx::query_as::<_, (i64, String, i64)>(
                r#"
                SELECT sale.final_amount,sale.currency,
                       COALESCE((
                         SELECT SUM(a.amount * p.effect_multiplier)::BIGINT
                         FROM business_payment_allocations a
                         JOIN business_payments p
                           ON p.id=a.payment_id
                          AND p.business_id=a.business_id
                          AND p.organization_id=a.organization_id
                         WHERE a.sale_id=sale.id
                           AND a.business_id=sale.business_id
                           AND a.organization_id=sale.organization_id
                       ),0)::BIGINT AS paid_amount
                FROM business_sales sale
                WHERE sale.id=$1 AND sale.business_id=$2 AND sale.organization_id=$3
                  AND sale.account_key='receivable'
                FOR UPDATE
                "#,
            )
            .bind(sale_id)
            .bind(business_id)
            .bind(organization_id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or(CommercialCoreError::Validation("sale_not_receivable"))?;
            if row.1 != currency {
                return Err(CommercialCoreError::Validation("payment_currency_mismatch"));
            }
            let outstanding = row
                .0
                .checked_sub(row.2)
                .ok_or(CommercialCoreError::Database)?;
            if allocation.amount > outstanding {
                return Err(CommercialCoreError::Validation(
                    "payment_exceeds_outstanding",
                ));
            }
        }
        if let Some(purchase_id) = allocation.purchase_id {
            let row = sqlx::query_as::<_, (i64, String, i64)>(
                r#"
                SELECT purchase.total_amount,purchase.currency,
                       COALESCE((
                         SELECT SUM(a.amount * p.effect_multiplier)::BIGINT
                         FROM business_payment_allocations a
                         JOIN business_payments p
                           ON p.id=a.payment_id
                          AND p.business_id=a.business_id
                          AND p.organization_id=a.organization_id
                         WHERE a.purchase_id=purchase.id
                           AND a.business_id=purchase.business_id
                           AND a.organization_id=purchase.organization_id
                       ),0)::BIGINT AS paid_amount
                FROM business_purchases purchase
                WHERE purchase.id=$1 AND purchase.business_id=$2 AND purchase.organization_id=$3
                  AND purchase.account_key='payable'
                FOR UPDATE
                "#,
            )
            .bind(purchase_id)
            .bind(business_id)
            .bind(organization_id)
            .fetch_optional(&mut **tx)
            .await?
            .ok_or(CommercialCoreError::Validation("purchase_not_payable"))?;
            if row.1 != currency {
                return Err(CommercialCoreError::Validation("payment_currency_mismatch"));
            }
            let outstanding = row
                .0
                .checked_sub(row.2)
                .ok_or(CommercialCoreError::Database)?;
            if allocation.amount > outstanding {
                return Err(CommercialCoreError::Validation(
                    "payment_exceeds_outstanding",
                ));
            }
        }
    }
    Ok(())
}

async fn insert_payment_finance_entry_tx(
    tx: &mut Transaction<'_, Postgres>,
    payment_id: Uuid,
    actor_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    entry_type: &str,
    account_key: &str,
    amount: i64,
    occurred_on: NaiveDate,
    note: &str,
    effect_multiplier: i16,
    reversal_of_entry_id: Option<Uuid>,
    correction_reason: Option<&str>,
) -> Result<Uuid, CommercialCoreError> {
    sqlx::query_scalar::<_, Uuid>(
        r#"
        INSERT INTO business_finance_entries (
          business_id,organization_id,entry_type,account_key,amount,occurred_on,note,
          source_type,source_id,created_by_user_id,effect_multiplier,reversal_of_entry_id,
          correction_reason
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,'business_payment',$8,$9,$10,$11,$12
        )
        RETURNING id
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(entry_type)
    .bind(account_key)
    .bind(amount)
    .bind(occurred_on)
    .bind(note)
    .bind(payment_id)
    .bind(actor_id)
    .bind(effect_multiplier)
    .bind(reversal_of_entry_id)
    .bind(correction_reason)
    .fetch_one(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn insert_allocation_tx(
    tx: &mut Transaction<'_, Postgres>,
    organization_id: Uuid,
    business_id: Uuid,
    payment_id: Uuid,
    allocation: &PaymentAllocationRequest,
) -> Result<(), CommercialCoreError> {
    sqlx::query(
        r#"
        INSERT INTO business_payment_allocations (
          organization_id,business_id,payment_id,sale_id,purchase_id,amount
        ) VALUES ($1,$2,$3,$4,$5,$6)
        "#,
    )
    .bind(organization_id)
    .bind(business_id)
    .bind(payment_id)
    .bind(allocation.sale_id)
    .bind(allocation.purchase_id)
    .bind(allocation.amount)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

async fn find_payment_by_key_tx(
    tx: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    idempotency_key: Uuid,
) -> Result<Option<PaymentAggregate>, CommercialCoreError> {
    let payment = sqlx::query_as::<_, PaymentRecord>(
        r#"
        SELECT id,organization_id,business_id,document_number,direction,account_key,amount,
               currency,party_id,occurred_on,reference,note,correlation_id,effect_multiplier,
               reversal_of_payment_id,finance_entry_id,idempotency_key,request_hash,
               created_by_user_id,created_at
        FROM business_payments
        WHERE business_id=$1 AND organization_id=$2 AND idempotency_key=$3
        "#,
    )
    .bind(business_id)
    .bind(organization_id)
    .bind(idempotency_key)
    .fetch_optional(&mut **tx)
    .await?;
    let Some(payment) = payment else {
        return Ok(None);
    };
    let allocations = load_allocations_tx(tx, payment.id).await?;
    Ok(Some(PaymentAggregate {
        payment,
        allocations,
    }))
}

async fn load_allocations_pool(
    db: &PgPool,
    payment_id: Uuid,
) -> Result<Vec<PaymentAllocationRecord>, CommercialCoreError> {
    sqlx::query_as::<_, PaymentAllocationRecord>(
        r#"
        SELECT id,organization_id,business_id,payment_id,sale_id,purchase_id,amount,created_at
        FROM business_payment_allocations
        WHERE payment_id=$1
        ORDER BY created_at,id
        "#,
    )
    .bind(payment_id)
    .fetch_all(db)
    .await
    .map_err(Into::into)
}

async fn load_allocations_tx(
    tx: &mut Transaction<'_, Postgres>,
    payment_id: Uuid,
) -> Result<Vec<PaymentAllocationRecord>, CommercialCoreError> {
    sqlx::query_as::<_, PaymentAllocationRecord>(
        r#"
        SELECT id,organization_id,business_id,payment_id,sale_id,purchase_id,amount,created_at
        FROM business_payment_allocations
        WHERE payment_id=$1
        ORDER BY created_at,id
        "#,
    )
    .bind(payment_id)
    .fetch_all(&mut **tx)
    .await
    .map_err(Into::into)
}

async fn insert_outbox(
    tx: &mut Transaction<'_, Postgres>,
    aggregate_type: &str,
    aggregate_id: Uuid,
    event_type: &str,
    payload: serde_json::Value,
) -> Result<(), CommercialCoreError> {
    sqlx::query(
        r#"
        INSERT INTO events.event_outbox (
          aggregate_type,aggregate_id,event_type,payload,routing_key
        ) VALUES ($1,$2,$3,$4,$3)
        "#,
    )
    .bind(aggregate_type)
    .bind(aggregate_id.to_string())
    .bind(event_type)
    .bind(payload)
    .execute(&mut **tx)
    .await?;
    Ok(())
}

const PAYMENT_SELECT: &str = r#"
SELECT id,organization_id,business_id,document_number,direction,account_key,amount,
       currency,party_id,occurred_on,reference,note,correlation_id,effect_multiplier,
       reversal_of_payment_id,finance_entry_id,idempotency_key,request_hash,
       created_by_user_id,created_at
FROM business_payments
WHERE business_id=$1 AND organization_id=$2
ORDER BY occurred_on DESC,created_at DESC,id DESC
LIMIT $3
"#;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn payment_normalization_requires_exact_allocations_and_direction() {
        let sale_id = Uuid::new_v4();
        let normalized = normalize_payment(CreatePaymentRequest {
            direction: " Incoming ".into(),
            account_key: "BANK".into(),
            amount: 50_000,
            occurred_on: NaiveDate::from_ymd_opt(2026, 9, 19).unwrap(),
            party_id: None,
            reference: " INV-1 ".into(),
            note: String::new(),
            allocations: vec![PaymentAllocationRequest {
                sale_id: Some(sale_id),
                purchase_id: None,
                amount: 50_000,
            }],
        })
        .unwrap();
        assert_eq!(normalized.direction, "incoming");
        assert_eq!(normalized.account_key, "bank");
        assert_eq!(normalized.allocations[0].sale_id, Some(sale_id));
    }

    #[test]
    fn payment_normalization_rejects_unallocated_or_wrong_direction_money() {
        let purchase_id = Uuid::new_v4();
        assert!(matches!(
            normalize_payment(CreatePaymentRequest {
                direction: "incoming".into(),
                account_key: "cash".into(),
                amount: 10_000,
                occurred_on: NaiveDate::from_ymd_opt(2026, 9, 19).unwrap(),
                party_id: None,
                reference: String::new(),
                note: String::new(),
                allocations: vec![PaymentAllocationRequest {
                    sale_id: None,
                    purchase_id: Some(purchase_id),
                    amount: 10_000,
                }],
            }),
            Err(CommercialCoreError::Validation(
                "incoming_payment_requires_sale"
            ))
        ));
    }

    #[test]
    fn party_normalization_canonicalizes_identity_fields() {
        let party = normalize_party(CreatePartyRequest {
            party_kind: " Customer ".into(),
            display_name: "  Toko   Maju  ".into(),
            legal_name: None,
            phone: Some(" 0812 ".into()),
            email: Some(" Owner@Example.COM ".into()),
            tax_identifier: None,
            address: None,
            note: String::new(),
        })
        .unwrap();
        assert_eq!(party.party_kind, "customer");
        assert_eq!(party.display_name, "Toko Maju");
        assert_eq!(party.email.as_deref(), Some("owner@example.com"));
    }
}
