use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

const MAX_CHANNEL_KEY_LEN: usize = 80;
const MAX_NOTE_LEN: usize = 2_000;

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateSettlementRequest {
    pub(crate) channel_key: String,
    pub(crate) period_start: NaiveDate,
    pub(crate) period_end: NaiveDate,
    pub(crate) gross_sales_amount: i64,
    pub(crate) platform_fee_amount: i64,
    pub(crate) merchant_promo_amount: i64,
    pub(crate) refunds_amount: i64,
    pub(crate) other_deductions_amount: i64,
    pub(crate) actual_transfer_amount: i64,
    #[serde(default)]
    pub(crate) note: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum SettlementValidationError {
    InvalidChannel,
    InvalidPeriod,
    NegativeAmount,
    DeductionsExceedGrossSales,
    NoteTooLong,
}

impl SettlementValidationError {
    pub(crate) fn code(&self) -> &'static str {
        match self {
            Self::InvalidChannel => "invalid_settlement_channel",
            Self::InvalidPeriod => "invalid_settlement_period",
            Self::NegativeAmount => "invalid_settlement_amount",
            Self::DeductionsExceedGrossSales => "settlement_deductions_exceed_gross_sales",
            Self::NoteTooLong => "settlement_note_too_long",
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ValidatedSettlement {
    pub(crate) expected_transfer_amount: i64,
    pub(crate) difference_amount: i64,
    pub(crate) status: &'static str,
}

pub(crate) fn validate_settlement(
    request: &CreateSettlementRequest,
) -> Result<ValidatedSettlement, SettlementValidationError> {
    let channel = request.channel_key.trim();
    if channel.is_empty() || channel.len() > MAX_CHANNEL_KEY_LEN {
        return Err(SettlementValidationError::InvalidChannel);
    }
    if request.period_end < request.period_start {
        return Err(SettlementValidationError::InvalidPeriod);
    }
    let amounts = [
        request.gross_sales_amount,
        request.platform_fee_amount,
        request.merchant_promo_amount,
        request.refunds_amount,
        request.other_deductions_amount,
        request.actual_transfer_amount,
    ];
    if amounts.into_iter().any(|amount| amount < 0) {
        return Err(SettlementValidationError::NegativeAmount);
    }
    if request.note.trim().len() > MAX_NOTE_LEN {
        return Err(SettlementValidationError::NoteTooLong);
    }

    let deductions = request
        .platform_fee_amount
        .checked_add(request.merchant_promo_amount)
        .and_then(|value| value.checked_add(request.refunds_amount))
        .and_then(|value| value.checked_add(request.other_deductions_amount))
        .ok_or(SettlementValidationError::DeductionsExceedGrossSales)?;
    if deductions > request.gross_sales_amount {
        return Err(SettlementValidationError::DeductionsExceedGrossSales);
    }
    let expected_transfer_amount = request.gross_sales_amount - deductions;
    let difference_amount = request.actual_transfer_amount - expected_transfer_amount;
    let status = if difference_amount == 0 {
        "matched"
    } else if difference_amount < 0 {
        "short"
    } else {
        "excess"
    };

    Ok(ValidatedSettlement {
        expected_transfer_amount,
        difference_amount,
        status,
    })
}

#[derive(Debug)]
pub(crate) enum SettlementRepositoryError {
    Validation(SettlementValidationError),
    NotFound,
    Database,
}

impl From<sqlx::Error> for SettlementRepositoryError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct SettlementRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) channel_key: String,
    pub(crate) period_start: NaiveDate,
    pub(crate) period_end: NaiveDate,
    pub(crate) gross_sales_amount: i64,
    pub(crate) platform_fee_amount: i64,
    pub(crate) merchant_promo_amount: i64,
    pub(crate) refunds_amount: i64,
    pub(crate) other_deductions_amount: i64,
    pub(crate) expected_transfer_amount: i64,
    pub(crate) actual_transfer_amount: i64,
    pub(crate) difference_amount: i64,
    pub(crate) status: String,
    pub(crate) note: String,
    pub(crate) created_by_user_id: Uuid,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Clone)]
pub(crate) struct SettlementRepository {
    db: PgPool,
}

impl SettlementRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn list(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
        limit: i64,
    ) -> Result<Vec<SettlementRecord>, SettlementRepositoryError> {
        sqlx::query_as::<_, SettlementRecord>(
            r#"
            SELECT id, business_id, organization_id, channel_key, period_start, period_end,
              gross_sales_amount, platform_fee_amount, merchant_promo_amount, refunds_amount,
              other_deductions_amount, expected_transfer_amount, actual_transfer_amount,
              difference_amount, status, note, created_by_user_id, created_at, updated_at
            FROM business_settlements
            WHERE business_id = $1 AND organization_id = $2
            ORDER BY period_end DESC, created_at DESC
            LIMIT $3
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(limit.clamp(1, 500))
        .fetch_all(&self.db)
        .await
        .map_err(Into::into)
    }

    pub(crate) async fn create(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        request: CreateSettlementRequest,
    ) -> Result<SettlementRecord, SettlementRepositoryError> {
        let validated = validate_settlement(&request)
            .map_err(SettlementRepositoryError::Validation)?;
        ensure_business(&self.db, business_id, organization_id).await?;

        sqlx::query_as::<_, SettlementRecord>(
            r#"
            INSERT INTO business_settlements (
              business_id, organization_id, channel_key, period_start, period_end,
              gross_sales_amount, platform_fee_amount, merchant_promo_amount, refunds_amount,
              other_deductions_amount, expected_transfer_amount, actual_transfer_amount,
              difference_amount, status, note, created_by_user_id
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16)
            RETURNING id, business_id, organization_id, channel_key, period_start, period_end,
              gross_sales_amount, platform_fee_amount, merchant_promo_amount, refunds_amount,
              other_deductions_amount, expected_transfer_amount, actual_transfer_amount,
              difference_amount, status, note, created_by_user_id, created_at, updated_at
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(request.channel_key.trim().to_ascii_lowercase())
        .bind(request.period_start)
        .bind(request.period_end)
        .bind(request.gross_sales_amount)
        .bind(request.platform_fee_amount)
        .bind(request.merchant_promo_amount)
        .bind(request.refunds_amount)
        .bind(request.other_deductions_amount)
        .bind(validated.expected_transfer_amount)
        .bind(request.actual_transfer_amount)
        .bind(validated.difference_amount)
        .bind(validated.status)
        .bind(request.note.trim())
        .bind(actor_id)
        .fetch_one(&self.db)
        .await
        .map_err(Into::into)
    }
}

async fn ensure_business(
    db: &PgPool,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<(), SettlementRepositoryError> {
    let exists: Option<Uuid> = sqlx::query_scalar(
        "SELECT id FROM businesses WHERE id = $1 AND organization_id = $2 AND status <> 'deleted'",
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_optional(db)
    .await?;
    if exists.is_none() {
        return Err(SettlementRepositoryError::NotFound);
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn request() -> CreateSettlementRequest {
        CreateSettlementRequest {
            channel_key: "shopeefood".to_owned(),
            period_start: NaiveDate::from_ymd_opt(2026, 9, 5).unwrap(),
            period_end: NaiveDate::from_ymd_opt(2026, 9, 5).unwrap(),
            gross_sales_amount: 782_000,
            platform_fee_amount: 128_500,
            merchant_promo_amount: 42_000,
            refunds_amount: 0,
            other_deductions_amount: 0,
            actual_transfer_amount: 611_500,
            note: "Settlement harian".to_owned(),
        }
    }

    #[test]
    fn settlement_validation_accepts_a_matched_transfer() {
        let validated = validate_settlement(&request()).expect("valid settlement");
        assert_eq!(validated.expected_transfer_amount, 611_500);
        assert_eq!(validated.difference_amount, 0);
        assert_eq!(validated.status, "matched");
    }

    #[test]
    fn settlement_validation_marks_short_and_excess_transfers() {
        let mut short = request();
        short.actual_transfer_amount = 600_000;
        let short = validate_settlement(&short).expect("short settlement");
        assert_eq!(short.difference_amount, -11_500);
        assert_eq!(short.status, "short");

        let mut excess = request();
        excess.actual_transfer_amount = 620_000;
        let excess = validate_settlement(&excess).expect("excess settlement");
        assert_eq!(excess.difference_amount, 8_500);
        assert_eq!(excess.status, "excess");
    }

    #[test]
    fn settlement_validation_rejects_invalid_dates_and_amounts() {
        let mut invalid = request();
        invalid.period_end = NaiveDate::from_ymd_opt(2026, 9, 4).unwrap();
        assert!(matches!(
            validate_settlement(&invalid),
            Err(SettlementValidationError::InvalidPeriod)
        ));

        let mut invalid = request();
        invalid.platform_fee_amount = -1;
        assert!(matches!(
            validate_settlement(&invalid),
            Err(SettlementValidationError::NegativeAmount)
        ));

        let mut invalid = request();
        invalid.gross_sales_amount = 100_000;
        invalid.platform_fee_amount = 80_000;
        invalid.merchant_promo_amount = 30_000;
        assert!(matches!(
            validate_settlement(&invalid),
            Err(SettlementValidationError::DeductionsExceedGrossSales)
        ));
    }
}
