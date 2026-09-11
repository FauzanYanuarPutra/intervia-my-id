use chrono::{DateTime, NaiveDate, Utc};
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

pub(crate) const BUSINESS_VIEW: &str = "business.view";
pub(crate) const BRANCH_VIEW: &str = "branch.view";
pub(crate) const BRANCH_MANAGE: &str = "branch.manage";
pub(crate) const MEMBER_VIEW: &str = "member.view";

#[derive(Debug)]
pub(crate) enum GovernanceError {
    Validation(&'static str),
    Forbidden,
    NotFound,
    Conflict,
    Database,
}

impl std::fmt::Display for GovernanceError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::Validation(code) => write!(formatter, "{code}"),
            Self::Forbidden => write!(formatter, "forbidden"),
            Self::NotFound => write!(formatter, "not found"),
            Self::Conflict => write!(formatter, "conflict"),
            Self::Database => write!(formatter, "database unavailable"),
        }
    }
}

impl std::error::Error for GovernanceError {}

impl From<sqlx::Error> for GovernanceError {
    fn from(error: sqlx::Error) -> Self {
        if let sqlx::Error::Database(database) = &error {
            if database.is_unique_violation() {
                return Self::Conflict;
            }
        }
        Self::Database
    }
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct BranchRecord {
    pub(crate) id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Option<Uuid>,
    pub(crate) branch_code: String,
    pub(crate) branch_kind: String,
    pub(crate) name: String,
    pub(crate) address: String,
    pub(crate) province: String,
    pub(crate) city: String,
    pub(crate) district: String,
    pub(crate) postal_code: String,
    pub(crate) phone: Option<String>,
    pub(crate) whatsapp: Option<String>,
    pub(crate) timezone: String,
    pub(crate) business_hours: Value,
    pub(crate) special_hours: Value,
    pub(crate) status: String,
    pub(crate) is_primary: bool,
    pub(crate) public_visibility: bool,
    pub(crate) opened_on: Option<NaiveDate>,
    pub(crate) closed_on: Option<NaiveDate>,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct MemberRecord {
    pub(crate) id: Uuid,
    pub(crate) user_id: Uuid,
    pub(crate) status: String,
    pub(crate) effective_from: DateTime<Utc>,
    pub(crate) effective_until: Option<DateTime<Utc>>,
    pub(crate) role_keys: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct BusinessGovernanceSnapshot {
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) branch_count: i64,
    pub(crate) member_count: i64,
    pub(crate) relationship_count: i64,
    pub(crate) jurisdiction_count: i64,
    pub(crate) legal_profile_count: i64,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateBranchRequest {
    pub(crate) branch_code: String,
    pub(crate) branch_kind: String,
    pub(crate) name: String,
    #[serde(default)]
    pub(crate) address: String,
    #[serde(default)]
    pub(crate) province: String,
    #[serde(default)]
    pub(crate) city: String,
    #[serde(default)]
    pub(crate) district: String,
    #[serde(default)]
    pub(crate) postal_code: String,
    #[serde(default)]
    pub(crate) phone: Option<String>,
    #[serde(default)]
    pub(crate) whatsapp: Option<String>,
    #[serde(default = "default_timezone")]
    pub(crate) timezone: String,
    #[serde(default = "empty_object")]
    pub(crate) business_hours: Value,
    #[serde(default = "empty_array")]
    pub(crate) special_hours: Value,
    #[serde(default = "default_true")]
    pub(crate) public_visibility: bool,
    #[serde(default)]
    pub(crate) opened_on: Option<NaiveDate>,
}

fn default_timezone() -> String {
    "Asia/Jakarta".to_owned()
}

fn empty_object() -> Value {
    json!({})
}

fn empty_array() -> Value {
    json!([])
}

fn default_true() -> bool {
    true
}

pub(crate) fn normalize_branch_code(value: &str) -> Result<String, GovernanceError> {
    let value = value.trim().to_ascii_uppercase();
    if value.is_empty() || value.len() > 32 {
        return Err(GovernanceError::Validation("invalid_branch_code"));
    }
    if !value
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || character == '-' || character == '_')
    {
        return Err(GovernanceError::Validation("invalid_branch_code"));
    }
    Ok(value)
}

pub(crate) fn validate_branch_kind(value: &str) -> Result<(), GovernanceError> {
    if matches!(
        value,
        "store" | "kiosk" | "office" | "warehouse" | "service_area" | "online"
    ) {
        Ok(())
    } else {
        Err(GovernanceError::Validation("invalid_branch_kind"))
    }
}

fn validate_branch(payload: &CreateBranchRequest) -> Result<String, GovernanceError> {
    let branch_code = normalize_branch_code(&payload.branch_code)?;
    validate_branch_kind(payload.branch_kind.trim())?;
    if payload.name.trim().is_empty() || payload.name.trim().len() > 160 {
        return Err(GovernanceError::Validation("invalid_branch_name"));
    }
    if payload.timezone.trim().is_empty() || payload.timezone.trim().len() > 64 {
        return Err(GovernanceError::Validation("invalid_branch_timezone"));
    }
    if !payload.business_hours.is_object() || !payload.special_hours.is_array() {
        return Err(GovernanceError::Validation("invalid_branch_hours"));
    }
    Ok(branch_code)
}

#[derive(Clone)]
pub(crate) struct GovernanceRepository {
    db: PgPool,
}

impl GovernanceRepository {
    pub(crate) fn new(db: PgPool) -> Self {
        Self { db }
    }

    pub(crate) async fn authorize(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        permission_key: &str,
    ) -> Result<(), GovernanceError> {
        let business_exists: bool = sqlx::query_scalar(
            "SELECT EXISTS(SELECT 1 FROM businesses WHERE id = $1 AND organization_id = $2 AND status <> 'archived')",
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_one(&self.db)
        .await?;
        if !business_exists {
            return Err(GovernanceError::NotFound);
        }

        let authorized: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS (
              SELECT 1
              FROM business_memberships membership
              JOIN business_member_roles member_role
                ON member_role.membership_id = membership.id
               AND member_role.business_id = membership.business_id
               AND member_role.organization_id = membership.organization_id
              JOIN business_roles role
                ON role.id = member_role.role_id
               AND role.business_id = membership.business_id
               AND role.organization_id = membership.organization_id
              JOIN business_role_permissions role_permission
                ON role_permission.role_id = role.id
              WHERE membership.business_id = $1
                AND membership.organization_id = $2
                AND membership.user_id = $3
                AND membership.status = 'active'
                AND membership.effective_from <= NOW()
                AND (membership.effective_until IS NULL OR membership.effective_until >= NOW())
                AND member_role.location_id IS NULL
                AND member_role.effective_from <= NOW()
                AND (member_role.effective_until IS NULL OR member_role.effective_until >= NOW())
                AND role_permission.permission_key = $4
            )
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(actor_id)
        .bind(permission_key)
        .fetch_one(&self.db)
        .await?;

        if authorized {
            Ok(())
        } else {
            Err(GovernanceError::Forbidden)
        }
    }

    pub(crate) async fn snapshot(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<BusinessGovernanceSnapshot, GovernanceError> {
        self.authorize(actor_id, business_id, organization_id, BUSINESS_VIEW)
            .await?;
        let (branch_count, member_count, relationship_count, jurisdiction_count, legal_profile_count) =
            sqlx::query_as::<_, (i64, i64, i64, i64, i64)>(
                r#"
                SELECT
                  (SELECT COUNT(*) FROM business_locations WHERE business_id = $1 AND organization_id = $2),
                  (SELECT COUNT(*) FROM business_memberships WHERE business_id = $1 AND organization_id = $2),
                  (SELECT COUNT(*) FROM business_relationships WHERE business_id = $1 AND organization_id = $2 AND effective_until IS NULL),
                  (SELECT COUNT(*) FROM business_jurisdictions WHERE business_id = $1 AND organization_id = $2 AND effective_until IS NULL),
                  (SELECT COUNT(*) FROM business_legal_profiles WHERE business_id = $1 AND organization_id = $2 AND effective_until IS NULL)
                "#,
            )
            .bind(business_id)
            .bind(organization_id)
            .fetch_one(&self.db)
            .await?;
        Ok(BusinessGovernanceSnapshot {
            organization_id,
            business_id,
            branch_count,
            member_count,
            relationship_count,
            jurisdiction_count,
            legal_profile_count,
        })
    }

    pub(crate) async fn list_branches(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<BranchRecord>, GovernanceError> {
        self.authorize(actor_id, business_id, organization_id, BRANCH_VIEW)
            .await?;
        sqlx::query_as::<_, BranchRecord>(
            r#"
            SELECT id, business_id, organization_id, branch_code, branch_kind,
                   name, address, province, city, district, postal_code,
                   phone, whatsapp, timezone, business_hours, special_hours,
                   status, is_primary, public_visibility, opened_on, closed_on,
                   created_at, updated_at
            FROM business_locations
            WHERE business_id = $1 AND organization_id = $2
            ORDER BY is_primary DESC, created_at, id
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_all(&self.db)
        .await
        .map_err(GovernanceError::from)
    }

    pub(crate) async fn list_members(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<MemberRecord>, GovernanceError> {
        self.authorize(actor_id, business_id, organization_id, MEMBER_VIEW)
            .await?;
        sqlx::query_as::<_, MemberRecord>(
            r#"
            SELECT membership.id, membership.user_id, membership.status,
                   membership.effective_from, membership.effective_until,
                   COALESCE(array_agg(DISTINCT role.role_key ORDER BY role.role_key)
                     FILTER (WHERE role.role_key IS NOT NULL), ARRAY[]::text[]) AS role_keys
            FROM business_memberships membership
            LEFT JOIN business_member_roles member_role
              ON member_role.membership_id = membership.id
             AND member_role.business_id = membership.business_id
             AND member_role.organization_id = membership.organization_id
             AND member_role.effective_from <= NOW()
             AND (member_role.effective_until IS NULL OR member_role.effective_until >= NOW())
            LEFT JOIN business_roles role ON role.id = member_role.role_id
            WHERE membership.business_id = $1
              AND membership.organization_id = $2
            GROUP BY membership.id
            ORDER BY membership.created_at, membership.id
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_all(&self.db)
        .await
        .map_err(GovernanceError::from)
    }

    pub(crate) async fn create_branch(
        &self,
        actor_id: Uuid,
        business_id: Uuid,
        organization_id: Uuid,
        payload: CreateBranchRequest,
    ) -> Result<BranchRecord, GovernanceError> {
        let branch_code = validate_branch(&payload)?;
        let branch_kind = payload.branch_kind.trim().to_owned();
        let mut transaction = self.db.begin().await?;

        let authorized: bool = sqlx::query_scalar(
            r#"
            SELECT EXISTS (
              SELECT 1
              FROM businesses business
              JOIN business_memberships membership
                ON membership.business_id = business.id
               AND membership.organization_id = business.organization_id
              JOIN business_member_roles member_role
                ON member_role.membership_id = membership.id
               AND member_role.business_id = business.id
               AND member_role.organization_id = business.organization_id
              JOIN business_roles role
                ON role.id = member_role.role_id
               AND role.business_id = business.id
               AND role.organization_id = business.organization_id
              JOIN business_role_permissions role_permission ON role_permission.role_id = role.id
              WHERE business.id = $1
                AND business.organization_id = $2
                AND business.status <> 'archived'
                AND membership.user_id = $3
                AND membership.status = 'active'
                AND membership.effective_from <= NOW()
                AND (membership.effective_until IS NULL OR membership.effective_until >= NOW())
                AND member_role.location_id IS NULL
                AND member_role.effective_from <= NOW()
                AND (member_role.effective_until IS NULL OR member_role.effective_until >= NOW())
                AND role_permission.permission_key = $4
            )
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(actor_id)
        .bind(BRANCH_MANAGE)
        .fetch_one(&mut *transaction)
        .await?;
        if !authorized {
            return Err(GovernanceError::Forbidden);
        }

        let store_id: Option<Uuid> = sqlx::query_scalar(
            r#"
            SELECT link.store_id
            FROM business_store_links link
            JOIN businesses business ON business.id = link.business_id
            WHERE link.business_id = $1
              AND business.organization_id = $2
              AND link.link_type = 'primary'
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut *transaction)
        .await?;
        let store_id = store_id.ok_or(GovernanceError::NotFound)?;
        let location_id = Uuid::new_v4();

        let branch = sqlx::query_as::<_, BranchRecord>(
            r#"
            INSERT INTO business_locations (
              id, business_id, store_id, organization_id,
              branch_code, branch_kind, name, location_type,
              address, province, city, district, postal_code,
              phone, whatsapp, timezone, business_hours, special_hours,
              status, is_primary, public_visibility, opened_on, metadata
            ) VALUES (
              $1, $2, $3, $4,
              $5, $6, $7,
              CASE WHEN $6 = 'online' THEN 'online'
                   WHEN $6 = 'service_area' THEN 'service_area'
                   ELSE 'physical' END,
              $8, $9, $10, $11, $12,
              $13, $14, $15, $16, $17,
              'active', FALSE, $18, $19,
              jsonb_build_object('source', 'governance_branch_create')
            )
            RETURNING id, business_id, organization_id, branch_code, branch_kind,
                      name, address, province, city, district, postal_code,
                      phone, whatsapp, timezone, business_hours, special_hours,
                      status, is_primary, public_visibility, opened_on, closed_on,
                      created_at, updated_at
            "#,
        )
        .bind(location_id)
        .bind(business_id)
        .bind(store_id)
        .bind(organization_id)
        .bind(&branch_code)
        .bind(&branch_kind)
        .bind(payload.name.trim())
        .bind(payload.address.trim())
        .bind(payload.province.trim())
        .bind(payload.city.trim())
        .bind(payload.district.trim())
        .bind(payload.postal_code.trim())
        .bind(payload.phone.as_deref().map(str::trim).filter(|value| !value.is_empty()))
        .bind(payload.whatsapp.as_deref().map(str::trim).filter(|value| !value.is_empty()))
        .bind(payload.timezone.trim())
        .bind(payload.business_hours)
        .bind(payload.special_hours)
        .bind(payload.public_visibility)
        .bind(payload.opened_on)
        .fetch_one(&mut *transaction)
        .await?;

        sqlx::query(
            r#"
            INSERT INTO business_audit_events (
              organization_id, business_id, location_id, actor_user_id,
              event_key, subject_type, subject_id, reason, metadata
            ) VALUES ($1, $2, $3, $4, 'branch.created', 'business_location', $3,
                      'Branch created through governance API',
                      jsonb_build_object('branch_code', $5::text, 'branch_kind', $6::text))
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(location_id)
        .bind(actor_id)
        .bind(&branch_code)
        .bind(&branch_kind)
        .execute(&mut *transaction)
        .await?;

        transaction.commit().await?;
        Ok(branch)
    }
}
