use super::domain::{
    store_slug, BusinessAggregate, BusinessLocation, BusinessRecord, BusinessStore,
    ValidatedBusinessProfileUpdate, ValidatedProvisionCommand,
};
use super::products::{ProductRepository, ProductRepositoryError};
use chrono::{DateTime, Utc};
use serde_json::json;
use sha2::Digest;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug)]
pub(crate) enum RepositoryError {
    Database,
    IdempotencyConflict,
    VersionConflict,
    IncompleteAggregate,
}

impl From<sqlx::Error> for RepositoryError {
    fn from(_error: sqlx::Error) -> Self {
        Self::Database
    }
}

#[derive(Debug, Clone)]
pub(crate) struct ProvisionOutcome {
    pub(crate) aggregate: BusinessAggregate,
    pub(crate) replayed: bool,
}

#[derive(Debug, Clone, FromRow)]
pub(crate) struct LegacyStoreCandidate {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Option<Uuid>,
    pub(crate) name: String,
    pub(crate) city: String,
    pub(crate) address: String,
    pub(crate) lat: f64,
    pub(crate) lng: f64,
    pub(crate) phone: Option<String>,
}

#[derive(Clone)]
pub(crate) struct BusinessRepository {
    db: PgPool,
}

impl BusinessRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn provision(
        &self,
        actor_id: Uuid,
        idempotency_key: Uuid,
        organization_id: Uuid,
        command: &ValidatedProvisionCommand,
    ) -> Result<ProvisionOutcome, RepositoryError> {
        let mut transaction = self.db.begin().await?;
        let lock_key = format!("business-provision:{actor_id}:{idempotency_key}");
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(lock_key)
            .execute(&mut *transaction)
            .await?;

        if let Some(existing) = sqlx::query_as::<_, ExistingProvisionRow>(
            r#"
            SELECT id, organization_id, provisioning_request_hash
            FROM businesses
            WHERE created_by_user_id = $1 AND idempotency_key = $2
            "#,
        )
        .bind(actor_id)
        .bind(idempotency_key)
        .fetch_optional(&mut *transaction)
        .await?
        {
            if existing.provisioning_request_hash.trim() != command.request_hash {
                return Err(RepositoryError::IdempotencyConflict);
            }
            let aggregate = load_aggregate_in_transaction(
                &mut transaction,
                existing.id,
                existing.organization_id,
            )
            .await?;
            transaction.commit().await?;
            return Ok(ProvisionOutcome {
                aggregate,
                replayed: true,
            });
        }

        let business_id = Uuid::new_v4();
        let store_id = Uuid::new_v4();
        let location_id = Uuid::new_v4();
        let slug = store_slug(&command.business.name, store_id);

        sqlx::query(
            r#"
            INSERT INTO businesses (
              id, organization_id, name, capability_key, status,
              created_by_user_id, idempotency_key, provisioning_request_hash
            )
            VALUES ($1, $2, $3, $4, 'active', $5, $6, $7)
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(&command.business.name)
        .bind(&command.business.capability_key)
        .bind(actor_id)
        .bind(idempotency_key)
        .bind(&command.request_hash)
        .execute(&mut *transaction)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO umkm_stores (
              id, owner_user_id, organization_id, name, slug, description,
              city, address, lat, lng, phone, is_active,
              online_order_enabled, offline_order_enabled, metadata
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11,
                    TRUE, $12, $13, $14)
            "#,
        )
        .bind(store_id)
        .bind(actor_id)
        .bind(organization_id)
        .bind(&command.business.name)
        .bind(&slug)
        .bind(&command.storefront.description)
        .bind(&command.primary_location.city)
        .bind(&command.primary_location.address)
        .bind(command.primary_location.lat.unwrap_or(0.0))
        .bind(command.primary_location.lng.unwrap_or(0.0))
        .bind(&command.primary_location.phone)
        .bind(command.storefront.online_order_enabled)
        .bind(command.storefront.offline_order_enabled)
        .bind(json!({"public": &command.storefront.public_metadata}))
        .execute(&mut *transaction)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO business_store_links (business_id, store_id, link_type)
            VALUES ($1, $2, 'primary')
            "#,
        )
        .bind(business_id)
        .bind(store_id)
        .execute(&mut *transaction)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO business_locations (
              id, business_id, store_id, organization_id, name, address, city,
              lat, lng, phone, whatsapp, status, is_primary, public_visibility
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $10,
                    'active', TRUE, $11)
            "#,
        )
        .bind(location_id)
        .bind(business_id)
        .bind(store_id)
        .bind(organization_id)
        .bind(&command.primary_location.name)
        .bind(&command.primary_location.address)
        .bind(&command.primary_location.city)
        .bind(command.primary_location.lat)
        .bind(command.primary_location.lng)
        .bind(&command.primary_location.phone)
        .bind(command.primary_location.public_visibility)
        .execute(&mut *transaction)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO events.event_outbox (
              aggregate_type, aggregate_id, event_type, payload, routing_key
            )
            VALUES ('business', $1, 'marketplace.business.provisioned', $2,
                    'marketplace.business.provisioned')
            "#,
        )
        .bind(business_id.to_string())
        .bind(json!({
            "event_version": 1,
            "business_id": business_id,
            "organization_id": organization_id,
            "store_id": store_id,
            "version": 1
        }))
        .execute(&mut *transaction)
        .await?;

        let aggregate =
            load_aggregate_in_transaction(&mut transaction, business_id, organization_id).await?;
        transaction.commit().await?;
        Ok(ProvisionOutcome {
            aggregate,
            replayed: false,
        })
    }

    pub(crate) async fn list_for_organizations(
        &self,
        organization_ids: &[Uuid],
    ) -> Result<Vec<BusinessAggregate>, RepositoryError> {
        if organization_ids.is_empty() {
            return Ok(Vec::new());
        }
        let rows = sqlx::query_as::<_, BusinessIdentityRow>(
            r#"
            SELECT id, organization_id
            FROM businesses
            WHERE organization_id = ANY($1) AND status <> 'archived'
            ORDER BY updated_at DESC, id
            "#,
        )
        .bind(organization_ids)
        .fetch_all(&self.db)
        .await?;
        let mut aggregates = Vec::with_capacity(rows.len());
        for row in rows {
            aggregates.push(load_aggregate(&self.db, row.id, row.organization_id).await?);
        }
        Ok(aggregates)
    }

    pub(crate) async fn get_for_organization(
        &self,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Option<BusinessAggregate>, RepositoryError> {
        match load_aggregate(&self.db, business_id, organization_id).await {
            Ok(aggregate) => Ok(Some(aggregate)),
            Err(RepositoryError::IncompleteAggregate) => Ok(None),
            Err(error) => Err(error),
        }
    }

    pub(crate) async fn update_profile(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        command: &ValidatedBusinessProfileUpdate,
    ) -> Result<BusinessAggregate, RepositoryError> {
        let mut transaction = self.db.begin().await?;
        let updated = sqlx::query(
            r#"
            UPDATE businesses
            SET name = $1,
                capability_key = $2,
                version = version + 1,
                updated_at = NOW()
            WHERE id = $3
              AND organization_id = $4
              AND status <> 'archived'
              AND version = $5
            "#,
        )
        .bind(&command.name)
        .bind(&command.capability_key)
        .bind(business_id)
        .bind(organization_id)
        .bind(command.expected_version)
        .execute(&mut *transaction)
        .await?
        .rows_affected();
        if updated == 0 {
            return Err(RepositoryError::VersionConflict);
        }

        let store_updated = sqlx::query(
            r#"
            UPDATE umkm_stores store
            SET name = $1,
                description = $2,
                city = $3,
                address = $4,
                lat = $5,
                lng = $6,
                phone = $7,
                metadata = COALESCE(store.metadata, '{}'::jsonb)
                  || jsonb_build_object(
                    'public',
                    COALESCE(store.metadata->'public', '{}'::jsonb)
                      || jsonb_build_object(
                        'category', $8::text,
                        'schedule', $9::text,
                        'locationQuery', $10::text
                      )
                  ),
                updated_at = NOW()
            FROM business_store_links link
            WHERE link.store_id = store.id
              AND link.business_id = $11
              AND link.link_type = 'primary'
            "#,
        )
        .bind(&command.name)
        .bind(&command.description)
        .bind(&command.primary_location.city)
        .bind(&command.primary_location.address)
        .bind(command.primary_location.lat.unwrap_or(0.0))
        .bind(command.primary_location.lng.unwrap_or(0.0))
        .bind(&command.primary_location.phone)
        .bind(&command.category)
        .bind(&command.schedule)
        .bind(&command.location_query)
        .bind(business_id)
        .execute(&mut *transaction)
        .await?
        .rows_affected();
        if store_updated != 1 {
            return Err(RepositoryError::IncompleteAggregate);
        }

        let location_updated = sqlx::query(
            r#"
            UPDATE business_locations
            SET name = $1,
                address = $2,
                city = $3,
                lat = $4,
                lng = $5,
                phone = $6,
                whatsapp = $6,
                public_visibility = $7,
                updated_at = NOW()
            WHERE business_id = $8 AND is_primary
            "#,
        )
        .bind(&command.primary_location.name)
        .bind(&command.primary_location.address)
        .bind(&command.primary_location.city)
        .bind(command.primary_location.lat)
        .bind(command.primary_location.lng)
        .bind(&command.primary_location.phone)
        .bind(command.primary_location.public_visibility)
        .bind(business_id)
        .execute(&mut *transaction)
        .await?
        .rows_affected();
        if location_updated != 1 {
            return Err(RepositoryError::IncompleteAggregate);
        }

        let new_version = command.expected_version + 1;
        sqlx::query(
            r#"
            INSERT INTO events.event_outbox (
              aggregate_type, aggregate_id, event_type, payload, routing_key
            ) VALUES ('business', $1, 'marketplace.business.profile_updated', $2,
                      'marketplace.business.profile_updated')
            "#,
        )
        .bind(business_id.to_string())
        .bind(json!({
            "event_version": 1,
            "business_id": business_id,
            "organization_id": organization_id,
            "actor_user_id": actor_id,
            "version": new_version
        }))
        .execute(&mut *transaction)
        .await?;

        let aggregate =
            load_aggregate_in_transaction(&mut transaction, business_id, organization_id).await?;
        transaction.commit().await?;
        Ok(aggregate)
    }

    pub(crate) async fn list_unlinked_for_actor(
        &self,
        actor_id: Uuid,
    ) -> Result<Vec<LegacyStoreCandidate>, RepositoryError> {
        sqlx::query_as(
            r#"
            SELECT s.id, s.organization_id, s.name, s.city, s.address,
                   s.lat, s.lng, s.phone
            FROM umkm_stores s
            LEFT JOIN business_store_links link ON link.store_id = s.id
            WHERE s.owner_user_id = $1 AND link.store_id IS NULL
            ORDER BY s.created_at, s.id
            "#,
        )
        .bind(actor_id)
        .fetch_all(&self.db)
        .await
        .map_err(RepositoryError::from)
    }

    pub(crate) async fn linked_for_actor(
        &self,
        actor_id: Uuid,
        store_id: Uuid,
    ) -> Result<Option<BusinessAggregate>, RepositoryError> {
        let linked = sqlx::query_as::<_, BusinessIdentityRow>(
            r#"
            SELECT business.id, business.organization_id
            FROM businesses business
            JOIN business_store_links link ON link.business_id = business.id
            JOIN umkm_stores store ON store.id = link.store_id
            WHERE link.store_id = $1 AND store.owner_user_id = $2
            "#,
        )
        .bind(store_id)
        .bind(actor_id)
        .fetch_optional(&self.db)
        .await?;
        match linked {
            Some(row) => load_aggregate(&self.db, row.id, row.organization_id)
                .await
                .map(Some),
            None => Ok(None),
        }
    }

    pub(crate) async fn reconcile_existing_store(
        &self,
        actor_id: Uuid,
        idempotency_key: Uuid,
        organization_id: Uuid,
        candidate: &LegacyStoreCandidate,
    ) -> Result<ProvisionOutcome, RepositoryError> {
        let request_hash = format!(
            "{:x}",
            sha2::Sha256::digest(format!("v1:{}:{}", candidate.id, organization_id).as_bytes())
        );
        let mut transaction = self.db.begin().await?;
        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1, 0))")
            .bind(format!("business-reconcile:{actor_id}:{idempotency_key}"))
            .execute(&mut *transaction)
            .await?;

        if let Some(existing) = sqlx::query_as::<_, ExistingProvisionRow>(
            "SELECT id, organization_id, provisioning_request_hash FROM businesses WHERE created_by_user_id = $1 AND idempotency_key = $2",
        )
        .bind(actor_id)
        .bind(idempotency_key)
        .fetch_optional(&mut *transaction)
        .await?
        {
            if existing.provisioning_request_hash.trim() != request_hash {
                return Err(RepositoryError::IdempotencyConflict);
            }
            let aggregate = load_aggregate_in_transaction(
                &mut transaction,
                existing.id,
                existing.organization_id,
            )
            .await?;
            transaction.commit().await?;
            return Ok(ProvisionOutcome { aggregate, replayed: true });
        }

        if let Some(existing) = sqlx::query_as::<_, BusinessIdentityRow>(
            r#"
            SELECT business.id, business.organization_id
            FROM businesses business
            JOIN business_store_links link ON link.business_id = business.id
            JOIN umkm_stores store ON store.id = link.store_id
            WHERE link.store_id = $1 AND store.owner_user_id = $2
            "#,
        )
        .bind(candidate.id)
        .bind(actor_id)
        .fetch_optional(&mut *transaction)
        .await?
        {
            let aggregate = load_aggregate_in_transaction(
                &mut transaction,
                existing.id,
                existing.organization_id,
            )
            .await?;
            transaction.commit().await?;
            return Ok(ProvisionOutcome {
                aggregate,
                replayed: true,
            });
        }

        let business_id = Uuid::new_v4();
        sqlx::query(
            r#"
            INSERT INTO businesses (
              id, organization_id, name, capability_key, status,
              created_by_user_id, idempotency_key, provisioning_request_hash
            ) VALUES ($1, $2, $3, 'general', 'active', $4, $5, $6)
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(&candidate.name)
        .bind(actor_id)
        .bind(idempotency_key)
        .bind(&request_hash)
        .execute(&mut *transaction)
        .await?;
        sqlx::query(
            "INSERT INTO business_store_links (business_id, store_id, link_type) VALUES ($1, $2, 'primary')",
        )
        .bind(business_id)
        .bind(candidate.id)
        .execute(&mut *transaction)
        .await?;
        sqlx::query("UPDATE umkm_stores SET organization_id = $1, updated_at = NOW() WHERE id = $2 AND owner_user_id = $3")
            .bind(organization_id)
            .bind(candidate.id)
            .bind(actor_id)
            .execute(&mut *transaction)
            .await?;
        let updated = sqlx::query(
            r#"
            UPDATE business_locations
            SET business_id = $1, organization_id = $2, updated_at = NOW()
            WHERE store_id = $3 AND is_primary
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(candidate.id)
        .execute(&mut *transaction)
        .await?
        .rows_affected();
        if updated == 0 {
            sqlx::query(
                r#"
                INSERT INTO business_locations (
                  business_id, store_id, organization_id, name, address, city,
                  lat, lng, phone, whatsapp, status, is_primary, public_visibility
                ) VALUES ($1, $2, $3, 'Lokasi utama', $4, $5, $6, $7, $8, $8,
                          'active', TRUE, TRUE)
                "#,
            )
            .bind(business_id)
            .bind(candidate.id)
            .bind(organization_id)
            .bind(&candidate.address)
            .bind(&candidate.city)
            .bind(candidate.lat)
            .bind(candidate.lng)
            .bind(&candidate.phone)
            .execute(&mut *transaction)
            .await?;
        }
        sqlx::query(
            r#"
            INSERT INTO events.event_outbox (
              aggregate_type, aggregate_id, event_type, payload, routing_key
            ) VALUES ('business', $1, 'marketplace.business.reconciled', $2,
                      'marketplace.business.reconciled')
            "#,
        )
        .bind(business_id.to_string())
        .bind(json!({
            "event_version": 1,
            "business_id": business_id,
            "organization_id": organization_id,
            "store_id": candidate.id,
            "version": 1
        }))
        .execute(&mut *transaction)
        .await?;
        let aggregate =
            load_aggregate_in_transaction(&mut transaction, business_id, organization_id).await?;
        transaction.commit().await?;
        Ok(ProvisionOutcome {
            aggregate,
            replayed: false,
        })
    }
}

#[derive(Debug, FromRow)]
struct ExistingProvisionRow {
    id: Uuid,
    organization_id: Uuid,
    provisioning_request_hash: String,
}

#[derive(Debug, FromRow)]
struct BusinessIdentityRow {
    id: Uuid,
    organization_id: Uuid,
}

#[derive(Debug, FromRow)]
struct BusinessRow {
    id: Uuid,
    organization_id: Uuid,
    name: String,
    capability_key: String,
    status: String,
    version: i64,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct StoreRow {
    id: Uuid,
    name: String,
    slug: String,
    description: Option<String>,
    city: String,
    address: String,
    lat: f64,
    lng: f64,
    phone: Option<String>,
    is_active: bool,
    online_order_enabled: bool,
    offline_order_enabled: bool,
    metadata: serde_json::Value,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

#[derive(Debug, FromRow)]
struct LocationRow {
    id: Uuid,
    store_id: Uuid,
    name: String,
    address: String,
    city: String,
    lat: Option<f64>,
    lng: Option<f64>,
    phone: Option<String>,
    status: String,
    is_primary: bool,
    public_visibility: bool,
    created_at: DateTime<Utc>,
    updated_at: DateTime<Utc>,
}

async fn load_aggregate(
    db: &PgPool,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<BusinessAggregate, RepositoryError> {
    let business = fetch_business(db, business_id, organization_id).await?;
    let store = fetch_store(db, business_id).await?;
    let location = fetch_location(db, business_id).await?;
    let products = ProductRepository::new(db.clone())
        .list_for_business(business_id, organization_id)
        .await
        .map_err(map_product_repository_error)?;
    build_aggregate(business, store, location, products)
}

async fn load_aggregate_in_transaction(
    transaction: &mut Transaction<'_, Postgres>,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<BusinessAggregate, RepositoryError> {
    let business = sqlx::query_as::<_, BusinessRow>(BUSINESS_QUERY)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut **transaction)
        .await?;
    let store = sqlx::query_as::<_, StoreRow>(STORE_QUERY)
        .bind(business_id)
        .fetch_optional(&mut **transaction)
        .await?;
    let location = sqlx::query_as::<_, LocationRow>(LOCATION_QUERY)
        .bind(business_id)
        .fetch_optional(&mut **transaction)
        .await?;
    let products = ProductRepository::list_for_business_in_transaction(
        transaction,
        business_id,
        organization_id,
    )
    .await
    .map_err(map_product_repository_error)?;
    build_aggregate(business, store, location, products)
}

async fn fetch_business(
    db: &PgPool,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<Option<BusinessRow>, sqlx::Error> {
    sqlx::query_as(BUSINESS_QUERY)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(db)
        .await
}

async fn fetch_store(db: &PgPool, business_id: Uuid) -> Result<Option<StoreRow>, sqlx::Error> {
    sqlx::query_as(STORE_QUERY)
        .bind(business_id)
        .fetch_optional(db)
        .await
}

async fn fetch_location(
    db: &PgPool,
    business_id: Uuid,
) -> Result<Option<LocationRow>, sqlx::Error> {
    sqlx::query_as(LOCATION_QUERY)
        .bind(business_id)
        .fetch_optional(db)
        .await
}

fn build_aggregate(
    business: Option<BusinessRow>,
    store: Option<StoreRow>,
    location: Option<LocationRow>,
    products: Vec<super::products::BusinessProduct>,
) -> Result<BusinessAggregate, RepositoryError> {
    let business = business.ok_or(RepositoryError::IncompleteAggregate)?;
    let store = store.ok_or(RepositoryError::IncompleteAggregate)?;
    let location = location.ok_or(RepositoryError::IncompleteAggregate)?;
    Ok(BusinessAggregate {
        business: BusinessRecord {
            id: business.id,
            organization_id: business.organization_id,
            name: business.name,
            capability_key: business.capability_key,
            status: business.status,
            version: business.version,
            created_at: business.created_at,
            updated_at: business.updated_at,
        },
        primary_store: BusinessStore {
            id: store.id,
            name: store.name,
            slug: store.slug,
            description: store.description,
            city: store.city,
            address: store.address,
            lat: store.lat,
            lng: store.lng,
            phone: store.phone,
            is_active: store.is_active,
            online_order_enabled: store.online_order_enabled,
            offline_order_enabled: store.offline_order_enabled,
            metadata: store.metadata,
            created_at: store.created_at,
            updated_at: store.updated_at,
        },
        primary_location: BusinessLocation {
            id: location.id,
            store_id: location.store_id,
            name: location.name,
            address: location.address,
            city: location.city,
            lat: location.lat,
            lng: location.lng,
            phone: location.phone,
            status: location.status,
            is_primary: location.is_primary,
            public_visibility: location.public_visibility,
            created_at: location.created_at,
            updated_at: location.updated_at,
        },
        products,
    })
}

fn map_product_repository_error(_error: ProductRepositoryError) -> RepositoryError {
    RepositoryError::Database
}

const BUSINESS_QUERY: &str = r#"
    SELECT id, organization_id, name, capability_key, status, version,
           created_at, updated_at
    FROM businesses
    WHERE id = $1 AND organization_id = $2 AND status <> 'archived'
"#;

const STORE_QUERY: &str = r#"
    SELECT s.id, s.name, s.slug, s.description, s.city, s.address, s.lat, s.lng,
           s.phone, s.is_active, s.online_order_enabled, s.offline_order_enabled, s.metadata,
           s.created_at, s.updated_at
    FROM umkm_stores s
    JOIN business_store_links l ON l.store_id = s.id
    WHERE l.business_id = $1 AND l.link_type = 'primary'
"#;

const LOCATION_QUERY: &str = r#"
    SELECT id, store_id, name, address, city, lat, lng, phone, status,
           is_primary, public_visibility, created_at, updated_at
    FROM business_locations
    WHERE business_id = $1 AND is_primary
"#;
