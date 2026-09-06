use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::json;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

const MAX_PRODUCT_NAME_LEN: usize = 160;
const MAX_CATEGORY_LEN: usize = 120;
const MAX_PRICE_LABEL_LEN: usize = 80;
const MAX_STOCK_UNIT_LEN: usize = 40;
const MAX_OWNER_LABEL_LEN: usize = 160;
const MAX_CONSIGNMENT_TERMS_LEN: usize = 1_000;
const MAX_NOTES_LEN: usize = 2_000;
const MAX_INVENTORY_REASON_LEN: usize = 160;

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

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct UpdateBusinessProductRequest {
    pub(crate) name: Option<String>,
    pub(crate) category: Option<String>,
    pub(crate) price_label: Option<String>,
    pub(crate) status: Option<String>,
    pub(crate) source_type: Option<ProductSourceType>,
    pub(crate) owner_label: Option<String>,
    pub(crate) min_stock_alert: Option<f64>,
    pub(crate) stock_unit: Option<String>,
    pub(crate) stock_mode: Option<ProductStockMode>,
    pub(crate) consignment_terms: Option<String>,
    pub(crate) notes: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct AdjustBusinessInventoryRequest {
    pub(crate) stock_count: Option<f64>,
    pub(crate) reason: Option<String>,
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
    Validation(ProductValidationError),
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

    pub(crate) async fn list_for_business_in_transaction(
        transaction: &mut Transaction<'_, Postgres>,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<BusinessProduct>, ProductRepositoryError> {
        let rows = sqlx::query_as::<_, ProductRow>(PRODUCT_SELECT)
            .bind(business_id)
            .bind(organization_id)
            .fetch_all(&mut **transaction)
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
        ensure_business_exists(&mut transaction, business_id, organization_id).await?;
        let store_id = sqlx::query_scalar::<_, Uuid>(
            r#"
            SELECT store_id
            FROM business_store_links
            WHERE business_id = $1 AND link_type = 'primary'
            "#,
        )
        .bind(business_id)
        .fetch_optional(&mut *transaction)
        .await?
        .ok_or(ProductRepositoryError::Database)?;

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

        let price_cents = price_label_to_cents(&command.price_label);
        let stock_qty = storefront_stock_quantity(command.stock_count);
        sqlx::query(
            r#"
            INSERT INTO umkm_products (
              id, store_id, name, slug, description, category, price_cents,
              stock_qty, is_available, image_url, metadata
            )
            VALUES ($1, $2, $3, $4, NULL, $5, $6, $7, $8, NULL, $9)
            "#,
        )
        .bind(product_id)
        .bind(store_id)
        .bind(&command.name)
        .bind(storefront_product_slug(&command.name, product_id))
        .bind(&command.category)
        .bind(price_cents)
        .bind(stock_qty)
        .bind(storefront_is_available(
            "active",
            price_cents,
            command.stock_count,
        ))
        .bind(public_metadata(
            product_id,
            business_id,
            &command.price_label,
            command.source_type.as_str(),
            command.stock_mode.as_str(),
            command.stock_count,
        ))
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

        insert_outbox_event(
            &mut transaction,
            actor_id,
            business_id,
            organization_id,
            product_id,
            "marketplace.business.product_created",
            json!({ "version": 1 }),
        )
        .await?;

        let row =
            fetch_product_row(&mut transaction, business_id, organization_id, product_id).await?;
        transaction.commit().await?;
        Ok(row.into_product())
    }

    pub(crate) async fn update(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        product_id: Uuid,
        request: UpdateBusinessProductRequest,
    ) -> Result<BusinessProduct, ProductRepositoryError> {
        let request =
            validate_update_request(request).map_err(ProductRepositoryError::Validation)?;
        let mut transaction = self.db.begin().await?;
        ensure_product_exists(&mut transaction, business_id, organization_id, product_id).await?;

        let source_type = request.source_type.map(ProductSourceType::as_str);
        let stock_mode = request.stock_mode.map(ProductStockMode::as_str);
        sqlx::query(
            r#"
            UPDATE business_products
            SET name = COALESCE($4, name),
                category = COALESCE($5, category),
                price_label = COALESCE($6, price_label),
                status = COALESCE($7, status),
                source_type = COALESCE($8, source_type),
                owner_label = COALESCE($9, owner_label),
                consignment_terms = COALESCE($10, consignment_terms),
                notes = COALESCE($11, notes),
                version = version + 1,
                updated_at = NOW()
            WHERE id = $1 AND business_id = $2 AND organization_id = $3
            "#,
        )
        .bind(product_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(&request.name)
        .bind(&request.category)
        .bind(&request.price_label)
        .bind(&request.status)
        .bind(source_type)
        .bind(&request.owner_label)
        .bind(&request.consignment_terms)
        .bind(&request.notes)
        .execute(&mut *transaction)
        .await?;

        if request.min_stock_alert.is_some() || request.stock_unit.is_some() || stock_mode.is_some()
        {
            sqlx::query(
                r#"
                UPDATE business_inventory
                SET min_stock_alert = COALESCE($4, min_stock_alert),
                    stock_unit = COALESCE($5, stock_unit),
                    stock_mode = COALESCE($6, stock_mode),
                    updated_at = NOW()
                WHERE product_id = $1 AND business_id = $2 AND organization_id = $3
                "#,
            )
            .bind(product_id)
            .bind(business_id)
            .bind(organization_id)
            .bind(request.min_stock_alert)
            .bind(&request.stock_unit)
            .bind(stock_mode)
            .execute(&mut *transaction)
            .await?;
        }

        let row =
            fetch_product_row(&mut transaction, business_id, organization_id, product_id).await?;
        sync_public_projection(&mut transaction, business_id, &row).await?;
        insert_outbox_event(
            &mut transaction,
            actor_id,
            business_id,
            organization_id,
            product_id,
            "marketplace.business.product_updated",
            json!({ "version": 1 }),
        )
        .await?;
        transaction.commit().await?;
        Ok(row.into_product())
    }

    pub(crate) async fn adjust_inventory(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        product_id: Uuid,
        request: AdjustBusinessInventoryRequest,
    ) -> Result<BusinessProduct, ProductRepositoryError> {
        let request =
            validate_inventory_adjustment(request).map_err(ProductRepositoryError::Validation)?;
        let mut transaction = self.db.begin().await?;
        ensure_product_exists(&mut transaction, business_id, organization_id, product_id).await?;

        let result = sqlx::query(
            r#"
            UPDATE business_inventory
            SET stock_count = $4, updated_at = NOW()
            WHERE product_id = $1 AND business_id = $2 AND organization_id = $3
            "#,
        )
        .bind(product_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(request.stock_count)
        .execute(&mut *transaction)
        .await?;
        if result.rows_affected() != 1 {
            return Err(ProductRepositoryError::BusinessNotFound);
        }

        let row =
            fetch_product_row(&mut transaction, business_id, organization_id, product_id).await?;
        sync_public_projection(&mut transaction, business_id, &row).await?;
        insert_outbox_event(
            &mut transaction,
            actor_id,
            business_id,
            organization_id,
            product_id,
            "marketplace.business.inventory_adjusted",
            json!({
                "version": 1,
                "stock_count": request.stock_count,
                "reason": request.reason,
            }),
        )
        .await?;
        transaction.commit().await?;
        Ok(row.into_product())
    }
}

async fn ensure_business_exists(
    transaction: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<(), ProductRepositoryError> {
    let exists: bool = sqlx::query_scalar(
        "SELECT EXISTS(SELECT 1 FROM businesses WHERE id = $1 AND organization_id = $2)",
    )
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **transaction)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(ProductRepositoryError::BusinessNotFound)
    }
}

async fn ensure_product_exists(
    transaction: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    product_id: Uuid,
) -> Result<(), ProductRepositoryError> {
    let exists: bool = sqlx::query_scalar(
        r#"
        SELECT EXISTS(
          SELECT 1
          FROM business_products
          WHERE id = $1 AND business_id = $2 AND organization_id = $3
        )
        "#,
    )
    .bind(product_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_one(&mut **transaction)
    .await?;
    if exists {
        Ok(())
    } else {
        Err(ProductRepositoryError::BusinessNotFound)
    }
}

async fn fetch_product_row(
    transaction: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
    product_id: Uuid,
) -> Result<ProductRow, ProductRepositoryError> {
    sqlx::query_as::<_, ProductRow>(PRODUCT_SELECT_BY_ID)
        .bind(business_id)
        .bind(organization_id)
        .bind(product_id)
        .fetch_optional(&mut **transaction)
        .await?
        .ok_or(ProductRepositoryError::BusinessNotFound)
}

async fn sync_public_projection(
    transaction: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    row: &ProductRow,
) -> Result<(), ProductRepositoryError> {
    let price_cents = price_label_to_cents(&row.price_label);
    let stock_qty = storefront_stock_quantity(row.stock_count);
    let metadata = public_metadata(
        row.id,
        business_id,
        &row.price_label,
        &row.source_type,
        &row.stock_mode,
        row.stock_count,
    );
    let result = sqlx::query(
        r#"
        UPDATE umkm_products
        SET name = $2,
            slug = $3,
            category = $4,
            price_cents = $5,
            stock_qty = $6,
            is_available = $7,
            metadata = COALESCE(metadata, '{}'::JSONB) || $8,
            updated_at = NOW()
        WHERE id = $1
        "#,
    )
    .bind(row.id)
    .bind(&row.name)
    .bind(storefront_product_slug(&row.name, row.id))
    .bind(&row.category)
    .bind(price_cents)
    .bind(stock_qty)
    .bind(storefront_is_available(
        &row.status,
        price_cents,
        row.stock_count,
    ))
    .bind(metadata)
    .execute(&mut **transaction)
    .await?;
    if result.rows_affected() == 1 {
        Ok(())
    } else {
        Err(ProductRepositoryError::Database)
    }
}

async fn insert_outbox_event(
    transaction: &mut Transaction<'_, Postgres>,
    actor_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    product_id: Uuid,
    event_type: &'static str,
    details: serde_json::Value,
) -> Result<(), ProductRepositoryError> {
    sqlx::query(
        r#"
        INSERT INTO events.event_outbox (
          aggregate_type, aggregate_id, event_type, payload, routing_key
        )
        VALUES ('business', $1, $2, $3, $2)
        "#,
    )
    .bind(business_id.to_string())
    .bind(event_type)
    .bind(json!({
        "event_version": 1,
        "actor_id": actor_id,
        "business_id": business_id,
        "organization_id": organization_id,
        "product_id": product_id,
        "details": details,
    }))
    .execute(&mut **transaction)
    .await?;
    Ok(())
}

fn price_label_to_cents(price_label: &str) -> i64 {
    price_label
        .chars()
        .filter(char::is_ascii_digit)
        .collect::<String>()
        .parse::<i64>()
        .unwrap_or(0)
        .saturating_mul(100)
}

fn storefront_stock_quantity(stock_count: Option<f64>) -> i32 {
    stock_count
        .unwrap_or(0.0)
        .floor()
        .clamp(0.0, f64::from(i32::MAX)) as i32
}

fn storefront_is_available(status: &str, price_cents: i64, stock_count: Option<f64>) -> bool {
    status == "active" && price_cents > 0 && stock_count != Some(0.0)
}

fn public_metadata(
    product_id: Uuid,
    business_id: Uuid,
    price_label: &str,
    source_type: &str,
    stock_mode: &str,
    stock_count: Option<f64>,
) -> serde_json::Value {
    json!({
        "canonical_business_product_id": product_id,
        "canonical_business_id": business_id,
        "price_label": price_label,
        "source_type": source_type,
        "stock_mode": stock_mode,
        "stock_known": stock_count.is_some(),
    })
}

fn storefront_product_slug(name: &str, product_id: Uuid) -> String {
    let base = name
        .to_lowercase()
        .chars()
        .map(|character| {
            if character.is_ascii_alphanumeric() {
                character
            } else {
                '-'
            }
        })
        .collect::<String>()
        .split('-')
        .filter(|segment| !segment.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let base = if base.is_empty() { "produk" } else { &base };
    let suffix = product_id.simple().to_string();
    format!("{base}-{}", &suffix[..8])
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
    Name,
    Category,
    PriceLabel,
    Status,
    OwnerLabel,
    StockCount,
    StockUnit,
    MinimumStock,
    ConsignmentTerms,
    Notes,
    InventoryReason,
    EmptyUpdate,
}

impl ProductValidationError {
    pub(crate) const fn code(self) -> &'static str {
        match self {
            Self::Name => "invalid_product_name",
            Self::Category => "invalid_product_category",
            Self::PriceLabel => "invalid_product_price_label",
            Self::Status => "invalid_product_status",
            Self::OwnerLabel => "invalid_product_owner_label",
            Self::StockCount => "invalid_product_stock_count",
            Self::StockUnit => "invalid_product_stock_unit",
            Self::MinimumStock => "invalid_product_min_stock_alert",
            Self::ConsignmentTerms => "invalid_product_consignment_terms",
            Self::Notes => "invalid_product_notes",
            Self::InventoryReason => "invalid_inventory_reason",
            Self::EmptyUpdate => "empty_product_update",
        }
    }
}

pub(crate) fn validate_create_request(
    request: CreateBusinessProductRequest,
) -> Result<ValidatedCreateBusinessProduct, ProductValidationError> {
    let name = normalize_required(request.name, 2, MAX_PRODUCT_NAME_LEN)
        .ok_or(ProductValidationError::Name)?;
    let category = normalize_required(request.category, 1, MAX_CATEGORY_LEN)
        .ok_or(ProductValidationError::Category)?;
    let price_label = normalize_required(request.price_label, 1, MAX_PRICE_LABEL_LEN)
        .ok_or(ProductValidationError::PriceLabel)?;
    let owner_label = normalize_optional(request.owner_label, MAX_OWNER_LABEL_LEN)
        .ok_or(ProductValidationError::OwnerLabel)?;
    validate_non_negative_finite(request.stock_count).ok_or(ProductValidationError::StockCount)?;
    let stock_unit = normalize_required(request.stock_unit, 1, MAX_STOCK_UNIT_LEN)
        .ok_or(ProductValidationError::StockUnit)?;
    validate_non_negative_finite(request.min_stock_alert)
        .ok_or(ProductValidationError::MinimumStock)?;
    let consignment_terms =
        normalize_optional(request.consignment_terms, MAX_CONSIGNMENT_TERMS_LEN)
            .ok_or(ProductValidationError::ConsignmentTerms)?;
    let notes =
        normalize_optional(request.notes, MAX_NOTES_LEN).ok_or(ProductValidationError::Notes)?;

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

fn validate_update_request(
    mut request: UpdateBusinessProductRequest,
) -> Result<UpdateBusinessProductRequest, ProductValidationError> {
    let has_update = request.name.is_some()
        || request.category.is_some()
        || request.price_label.is_some()
        || request.status.is_some()
        || request.source_type.is_some()
        || request.owner_label.is_some()
        || request.min_stock_alert.is_some()
        || request.stock_unit.is_some()
        || request.stock_mode.is_some()
        || request.consignment_terms.is_some()
        || request.notes.is_some();
    if !has_update {
        return Err(ProductValidationError::EmptyUpdate);
    }

    request.name = request
        .name
        .map(|value| {
            normalize_required(value, 2, MAX_PRODUCT_NAME_LEN).ok_or(ProductValidationError::Name)
        })
        .transpose()?;
    request.category = request
        .category
        .map(|value| {
            normalize_required(value, 1, MAX_CATEGORY_LEN).ok_or(ProductValidationError::Category)
        })
        .transpose()?;
    request.price_label = request
        .price_label
        .map(|value| {
            normalize_required(value, 1, MAX_PRICE_LABEL_LEN)
                .ok_or(ProductValidationError::PriceLabel)
        })
        .transpose()?;
    request.status = request
        .status
        .map(|value| {
            let normalized = value.trim().to_ascii_lowercase();
            match normalized.as_str() {
                "active" | "archived" => Ok(normalized),
                _ => Err(ProductValidationError::Status),
            }
        })
        .transpose()?;
    request.owner_label = normalize_optional(request.owner_label, MAX_OWNER_LABEL_LEN)
        .ok_or(ProductValidationError::OwnerLabel)?;
    validate_non_negative_finite(request.min_stock_alert)
        .ok_or(ProductValidationError::MinimumStock)?;
    request.stock_unit = request
        .stock_unit
        .map(|value| {
            normalize_required(value, 1, MAX_STOCK_UNIT_LEN)
                .ok_or(ProductValidationError::StockUnit)
        })
        .transpose()?;
    request.consignment_terms =
        normalize_optional(request.consignment_terms, MAX_CONSIGNMENT_TERMS_LEN)
            .ok_or(ProductValidationError::ConsignmentTerms)?;
    request.notes =
        normalize_optional(request.notes, MAX_NOTES_LEN).ok_or(ProductValidationError::Notes)?;
    Ok(request)
}

fn validate_inventory_adjustment(
    mut request: AdjustBusinessInventoryRequest,
) -> Result<AdjustBusinessInventoryRequest, ProductValidationError> {
    validate_non_negative_finite(request.stock_count).ok_or(ProductValidationError::StockCount)?;
    request.reason = normalize_optional(request.reason, MAX_INVENTORY_REASON_LEN)
        .ok_or(ProductValidationError::InventoryReason)?;
    Ok(request)
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
            ProductValidationError::Name
        );
    }

    #[test]
    fn stock_values_must_be_finite_and_non_negative() {
        for stock_count in [Some(-1.0), Some(f64::NAN), Some(f64::INFINITY)] {
            let mut request = valid_request();
            request.stock_count = stock_count;
            assert_eq!(
                validate_create_request(request).unwrap_err(),
                ProductValidationError::StockCount
            );
        }

        for minimum in [Some(-1.0), Some(f64::NAN), Some(f64::INFINITY)] {
            let mut request = valid_request();
            request.min_stock_alert = minimum;
            assert_eq!(
                validate_create_request(request).unwrap_err(),
                ProductValidationError::MinimumStock
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

    #[test]
    fn storefront_projection_converts_rupiah_labels_and_bounds_stock() {
        assert_eq!(price_label_to_cents("Rp10.000"), 1_000_000);
        assert_eq!(price_label_to_cents("Hubungi"), 0);
        assert_eq!(storefront_stock_quantity(Some(12.9)), 12);
        assert_eq!(storefront_stock_quantity(None), 0);
        assert_eq!(
            storefront_stock_quantity(Some(f64::from(i32::MAX) + 10.0)),
            i32::MAX
        );
    }

    #[test]
    fn product_status_is_limited_to_database_contract() {
        let request = UpdateBusinessProductRequest {
            name: None,
            category: None,
            price_label: None,
            status: Some("inactive".to_owned()),
            source_type: None,
            owner_label: None,
            min_stock_alert: None,
            stock_unit: None,
            stock_mode: None,
            consignment_terms: None,
            notes: None,
        };
        assert_eq!(
            validate_update_request(request).unwrap_err(),
            ProductValidationError::Status
        );
    }
}
