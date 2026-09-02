use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

const MAX_PRODUCT_NAME_LEN: usize = 160;
const MAX_CATEGORY_LEN: usize = 120;
const MAX_PRICE_LABEL_LEN: usize = 80;
const MAX_STOCK_UNIT_LEN: usize = 40;
const MAX_OWNER_LABEL_LEN: usize = 160;
const MAX_CONSIGNMENT_TERMS_LEN: usize = 1_000;
const MAX_NOTES_LEN: usize = 2_000;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ProductSourceType {
    Owned,
    Consignment,
}

impl ProductSourceType {
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Owned => "owned",
            Self::Consignment => "consignment",
        }
    }
}

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ProductStockMode {
    Manual,
    Estimated,
}

impl ProductStockMode {
    pub(crate) const fn as_str(self) -> &'static str {
        match self {
            Self::Manual => "manual",
            Self::Estimated => "estimated",
        }
    }
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateBusinessProductRequest {
    pub(crate) name: String,
    pub(crate) category: String,
    pub(crate) price_label: String,
    pub(crate) source_type: ProductSourceType,
    pub(crate) owner_label: Option<String>,
    pub(crate) stock_count: Option<f64>,
    pub(crate) stock_unit: String,
    pub(crate) min_stock_alert: Option<f64>,
    pub(crate) stock_mode: ProductStockMode,
    pub(crate) consignment_terms: Option<String>,
    pub(crate) notes: Option<String>,
}

#[derive(Debug, Clone)]
pub(crate) struct ValidatedCreateBusinessProduct {
    pub(crate) name: String,
    pub(crate) category: String,
    pub(crate) price_label: String,
    pub(crate) source_type: ProductSourceType,
    pub(crate) owner_label: Option<String>,
    pub(crate) stock_count: Option<f64>,
    pub(crate) stock_unit: String,
    pub(crate) min_stock_alert: Option<f64>,
    pub(crate) stock_mode: ProductStockMode,
    pub(crate) consignment_terms: Option<String>,
    pub(crate) notes: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct BusinessProduct {
    pub(crate) id: Uuid,
    pub(crate) name: String,
    pub(crate) category: String,
    pub(crate) price_label: String,
    pub(crate) status: String,
    pub(crate) source_type: String,
    pub(crate) owner_label: Option<String>,
    pub(crate) stock_count: Option<f64>,
    pub(crate) stock_unit: String,
    pub(crate) min_stock_alert: Option<f64>,
    pub(crate) stock_mode: String,
    pub(crate) stock_health: String,
    pub(crate) stock_updated_at: DateTime<Utc>,
    pub(crate) consignment_terms: Option<String>,
    pub(crate) notes: Option<String>,
}

#[derive(Debug)]
pub(crate) enum ProductRepositoryError {
    BusinessNotFound,
    Database,
}

impl From<sqlx::Error> for ProductRepositoryError {
    fn from(_error: sqlx::Error) -> Self {
        Self::Database
    }
}

#[derive(Clone)]
pub(crate) struct ProductRepository {
    db: PgPool,
}

impl ProductRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn list_for_business(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<BusinessProduct>, ProductRepositoryError> {
        let rows = sqlx::query_as::<_, ProductRow>(PRODUCT_SELECT)
            .bind(business_id)
            .bind(organization_id)
            .fetch_all(&self.db)
            .await?;
        Ok(rows.into_iter().map(ProductRow::into_product).collect())
    }

    pub(crate) async fn create(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        command: &ValidatedCreateBusinessProduct,
    ) -> Result<BusinessProduct, ProductRepositoryError> {
        let mut transaction = self.db.begin().await?;
        let business_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM businesses WHERE id = $1 AND organization_id = $2)",
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_one(&mut *transaction)
        .await?;
        if !business_exists {
            return Err(ProductRepositoryError::BusinessNotFound);
        }

        let product_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO business_products (
              id, business_id, organization_id, name, category, price_label,
              status, source_type, owner_label, consignment_terms, notes
            )
            VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9, $10)
            "#,
        )
        .bind(product_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(&command.name)
        .bind(&command.category)
        .bind(&command.price_label)
        .bind(command.source_type.as_str())
        .bind(&command.owner_label)
        .bind(&command.consignment_terms)
        .bind(&command.notes)
        .execute(&mut *transaction)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO business_inventory (
              id, product_id, business_id, organization_id, stock_count,
              stock_unit, min_stock_alert, stock_mode
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            "#,
        )
        .bind(Uuid::new_v4())
        .bind(product_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(command.stock_count)
        .bind(&command.stock_unit)
        .bind(command.min_stock_alert)
        .bind(command.stock_mode.as_str())
        .execute(&mut *transaction)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO events.event_outbox (
              aggregate_type, aggregate_id, event_type, payload, routing_key
            )
            VALUES ('business', $1, 'marketplace.business.product_created', $2,
                    'marketplace.business.product_created')
            "#,
        )
        .bind(business_id.to_string())
        .bind(json!({
            "event_version": 1,
            "actor_id": actor_id,
            "business_id": business_id,
            "organization_id": organization_id,
            "product_id": product_id,
            "version": 1,
        }))
        .execute(&mut *transaction)
        .await?;

        let row = sqlx::query_as::<_, ProductRow>(PRODUCT_SELECT_BY_ID)
            .bind(business_id)
            .bind(organization_id)
            .bind(product_id)
            .fetch_one(&mut *transaction)
            .await?;
        transaction.commit().await?;
        Ok(row.into_product())
    }
}

const PRODUCT_SELECT: &str = r#"
    SELECT
      product.id,
      product.name,
      product.category,
      product.price_label,
      product.status,
      product.source_type,
      product.owner_label,
      inventory.stock_count,
      inventory.stock_unit,
      inventory.min_stock_alert,
      inventory.stock_mode,
      inventory.updated_at AS stock_updated_at,
      product.consignment_terms,
      product.notes
    FROM business_products product
    JOIN business_inventory inventory
      ON inventory.product_id = product.id
     AND inventory.business_id = product.business_id
     AND inventory.organization_id = product.organization_id
    WHERE product.business_id = $1 AND product.organization_id = $2
    ORDER BY product.created_at ASC, product.id ASC
"#;

const PRODUCT_SELECT_BY_ID: &str = r#"
    SELECT
      product.id,
      product.name,
      product.category,
      product.price_label,
      product.status,
      product.source_type,
      product.owner_label,
      inventory.stock_count,
      inventory.stock_unit,
      inventory.min_stock_alert,
      inventory.stock_mode,
      inventory.updated_at AS stock_updated_at,
      product.consignment_terms,
      product.notes
    FROM business_products product
    JOIN business_inventory inventory
      ON inventory.product_id = product.id
     AND inventory.business_id = product.business_id
     AND inventory.organization_id = product.organization_id
    WHERE product.business_id = $1
      AND product.organization_id = $2
      AND product.id = $3
"#;

#[derive(FromRow)]
struct ProductRow {
    id: Uuid,
    name: String,
    category: String,
    price_label: String,
    status: String,
    source_type: String,
    owner_label: Option<String>,
    stock_count: Option<f64>,
    stock_unit: String,
    min_stock_alert: Option<f64>,
    stock_mode: String,
    stock_updated_at: DateTime<Utc>,
    consignment_terms: Option<String>,
    notes: Option<String>,
}

impl ProductRow {
    fn into_product(self) -> BusinessProduct {
        BusinessProduct {
            id: self.id,
            name: self.name,
            category: self.category,
            price_label: self.price_label,
            status: self.status,
            source_type: self.source_type,
            owner_label: self.owner_label,
            stock_count: self.stock_count,
            stock_unit: self.stock_unit,
            min_stock_alert: self.min_stock_alert,
            stock_mode: self.stock_mode,
            stock_health: stock_health(self.stock_count, self.min_stock_alert).to_owned(),
            stock_updated_at: self.stock_updated_at,
            consignment_terms: self.consignment_terms,
            notes: self.notes,
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ProductValidationError {
    InvalidName,
    InvalidCategory,
    InvalidPriceLabel,
    InvalidOwnerLabel,
    InvalidStockCount,
    InvalidStockUnit,
    InvalidMinimumStock,
    InvalidConsignmentTerms,
    InvalidNotes,
}

impl ProductValidationError {
    pub(crate) const fn code(self) -> &'static str {
        match self {
            Self::InvalidName => "invalid_product_name",
            Self::InvalidCategory => "invalid_product_category",
            Self::InvalidPriceLabel => "invalid_product_price_label",
            Self::InvalidOwnerLabel => "invalid_product_owner_label",
            Self::InvalidStockCount => "invalid_product_stock_count",
            Self::InvalidStockUnit => "invalid_product_stock_unit",
            Self::InvalidMinimumStock => "invalid_product_min_stock_alert",
            Self::InvalidConsignmentTerms => "invalid_product_consignment_terms",
            Self::InvalidNotes => "invalid_product_notes",
        }
    }
}

pub(crate) fn validate_create_request(
    request: CreateBusinessProductRequest,
) -> Result<ValidatedCreateBusinessProduct, ProductValidationError> {
    let name = normalize_required(request.name, 2, MAX_PRODUCT_NAME_LEN)
        .ok_or(ProductValidationError::InvalidName)?;
    let category = normalize_required(request.category, 1, MAX_CATEGORY_LEN)
        .ok_or(ProductValidationError::InvalidCategory)?;
    let price_label = normalize_required(request.price_label, 1, MAX_PRICE_LABEL_LEN)
        .ok_or(ProductValidationError::InvalidPriceLabel)?;
    let owner_label = normalize_optional(request.owner_label, MAX_OWNER_LABEL_LEN)
        .ok_or(ProductValidationError::InvalidOwnerLabel)?;
    validate_non_negative_finite(request.stock_count)
        .ok_or(ProductValidationError::InvalidStockCount)?;
    let stock_unit = normalize_required(request.stock_unit, 1, MAX_STOCK_UNIT_LEN)
        .ok_or(ProductValidationError::InvalidStockUnit)?;
    validate_non_negative_finite(request.min_stock_alert)
        .ok_or(ProductValidationError::InvalidMinimumStock)?;
    let consignment_terms =
        normalize_optional(request.consignment_terms, MAX_CONSIGNMENT_TERMS_LEN)
            .ok_or(ProductValidationError::InvalidConsignmentTerms)?;
    let notes = normalize_optional(request.notes, MAX_NOTES_LEN)
        .ok_or(ProductValidationError::InvalidNotes)?;

    Ok(ValidatedCreateBusinessProduct {
        name,
        category,
        price_label,
        source_type: request.source_type,
        owner_label,
        stock_count: request.stock_count,
        stock_unit,
        min_stock_alert: request.min_stock_alert,
        stock_mode: request.stock_mode,
        consignment_terms,
        notes,
    })
}

pub(crate) fn stock_health(stock: Option<f64>, minimum: Option<f64>) -> &'static str {
    match stock {
        None => "perlu-cocokkan",
        Some(value) if value <= 0.0 => "habis",
        Some(value) if minimum.is_some_and(|minimum| value <= minimum) => "tipis",
        Some(_) => "aman",
    }
}

fn normalize_required(value: String, min_len: usize, max_len: usize) -> Option<String> {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    let len = normalized.chars().count();
    (len >= min_len && len <= max_len).then_some(normalized)
}

fn normalize_optional(value: Option<String>, max_len: usize) -> Option<Option<String>> {
    match value {
        None => Some(None),
        Some(value) if value.trim().is_empty() => Some(None),
        Some(value) => normalize_required(value, 1, max_len).map(Some),
    }
}

fn validate_non_negative_finite(value: Option<f64>) -> Option<()> {
    match value {
        None => Some(()),
        Some(value) if value.is_finite() && value >= 0.0 => Some(()),
        Some(_) => None,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn valid_request() -> CreateBusinessProductRequest {
        CreateBusinessProductRequest {
            name: "Jus mangga".to_owned(),
            category: "Minuman".to_owned(),
            price_label: "Rp10.000".to_owned(),
            source_type: ProductSourceType::Owned,
            owner_label: None,
            stock_count: Some(10.0),
            stock_unit: "cup".to_owned(),
            min_stock_alert: Some(2.0),
            stock_mode: ProductStockMode::Manual,
            consignment_terms: None,
            notes: None,
        }
    }

    #[test]
    fn product_name_requires_two_trimmed_characters() {
        let mut request = valid_request();
        request.name = " a ".to_owned();

        assert_eq!(
            validate_create_request(request).unwrap_err(),
            ProductValidationError::InvalidName
        );
    }

    #[test]
    fn stock_values_must_be_finite_and_non_negative() {
        for stock_count in [Some(-1.0), Some(f64::NAN), Some(f64::INFINITY)] {
            let mut request = valid_request();
            request.stock_count = stock_count;
            assert_eq!(
                validate_create_request(request).unwrap_err(),
                ProductValidationError::InvalidStockCount
            );
        }

        for minimum in [Some(-1.0), Some(f64::NAN), Some(f64::INFINITY)] {
            let mut request = valid_request();
            request.min_stock_alert = minimum;
            assert_eq!(
                validate_create_request(request).unwrap_err(),
                ProductValidationError::InvalidMinimumStock
            );
        }
    }

    #[test]
    fn product_request_is_normalized() {
        let mut request = valid_request();
        request.name = "  Jus   mangga  ".to_owned();
        request.owner_label = Some("  Mitra   A  ".to_owned());
        let validated = validate_create_request(request).unwrap();

        assert_eq!(validated.name, "Jus mangga");
        assert_eq!(validated.owner_label.as_deref(), Some("Mitra A"));
    }

    #[test]
    fn stock_health_is_derived_from_canonical_numeric_state() {
        assert_eq!(stock_health(None, Some(2.0)), "perlu-cocokkan");
        assert_eq!(stock_health(Some(0.0), Some(2.0)), "habis");
        assert_eq!(stock_health(Some(1.0), Some(2.0)), "tipis");
        assert_eq!(stock_health(Some(2.0), Some(2.0)), "tipis");
        assert_eq!(stock_health(Some(10.0), None), "aman");
    }
}
