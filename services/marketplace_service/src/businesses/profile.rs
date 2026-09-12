use chrono::{DateTime, NaiveTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

const GENERAL_CAPABILITIES: &[&str] = &[
    "business_core",
    "catalog",
    "customers",
    "finance_basic",
    "payments",
    "reporting",
    "sales",
    "supporting_documents",
];
const JUICE_FNB_CAPABILITIES: &[&str] = &[
    "business_core",
    "catalog",
    "customers",
    "suppliers",
    "sales",
    "payments",
    "finance_basic",
    "reporting",
    "inventory",
    "recipes",
    "procurement",
    "pos",
    "settlements",
    "cashier_shifts",
    "daily_close",
    "supporting_documents",
];
const LAUNDRY_CAPABILITIES: &[&str] = &[
    "business_core",
    "catalog",
    "services",
    "customers",
    "sales",
    "payments",
    "finance_basic",
    "reporting",
    "appointments",
    "work_orders",
    "laundry_tracking",
    "daily_close",
    "supporting_documents",
];
const AC_FIELD_SERVICE_CAPABILITIES: &[&str] = &[
    "business_core",
    "catalog",
    "services",
    "customers",
    "suppliers",
    "sales",
    "payments",
    "finance_basic",
    "reporting",
    "inventory",
    "procurement",
    "appointments",
    "work_orders",
    "field_service",
    "assets",
    "supporting_documents",
];
const MART_RETAIL_CAPABILITIES: &[&str] = &[
    "business_core",
    "catalog",
    "customers",
    "suppliers",
    "sales",
    "payments",
    "finance_basic",
    "reporting",
    "inventory",
    "procurement",
    "pos",
    "barcode",
    "settlements",
    "cashier_shifts",
    "daily_close",
    "supporting_documents",
];

#[derive(Debug, Clone, Default, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) struct BusinessProfileInput {
    pub(crate) template_key: String,
    #[serde(default)]
    pub(crate) currency: Option<String>,
    #[serde(default)]
    pub(crate) timezone: Option<String>,
    #[serde(default)]
    pub(crate) costing_policy: Option<String>,
    #[serde(default)]
    pub(crate) accounting_mode: Option<String>,
    #[serde(default)]
    pub(crate) approval_policy: Option<String>,
    #[serde(default)]
    pub(crate) branch_mode: Option<String>,
    #[serde(default)]
    pub(crate) negative_stock_policy: Option<String>,
    #[serde(default)]
    pub(crate) document_prefix: Option<String>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct BusinessProfileRecord {
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) template_key: String,
    pub(crate) template_version: i32,
    pub(crate) currency: String,
    pub(crate) timezone: String,
    pub(crate) costing_policy: String,
    pub(crate) accounting_mode: String,
    pub(crate) approval_policy: String,
    pub(crate) branch_mode: String,
    pub(crate) negative_stock_policy: String,
    pub(crate) business_day_cutoff: NaiveTime,
    pub(crate) document_prefix: String,
    pub(crate) version: i64,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub(crate) struct BusinessCapabilityRecord {
    pub(crate) business_id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) capability_key: String,
    pub(crate) enabled: bool,
    pub(crate) source: String,
    pub(crate) created_at: DateTime<Utc>,
    pub(crate) updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct ResolvedBusinessTemplate {
    pub(crate) template_key: &'static str,
    pub(crate) version: i32,
    pub(crate) legacy_capability_key: &'static str,
    pub(crate) default_currency: &'static str,
    pub(crate) default_timezone: &'static str,
    pub(crate) default_costing_policy: &'static str,
    pub(crate) default_accounting_mode: &'static str,
    pub(crate) default_approval_policy: &'static str,
    pub(crate) default_document_prefix: &'static str,
    pub(crate) capabilities: &'static [&'static str],
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub(crate) struct ResolvedBusinessProfile {
    pub(crate) template_key: String,
    pub(crate) template_version: i32,
    pub(crate) currency: String,
    pub(crate) timezone: String,
    pub(crate) costing_policy: String,
    pub(crate) accounting_mode: String,
    pub(crate) approval_policy: String,
    pub(crate) branch_mode: String,
    pub(crate) negative_stock_policy: String,
    pub(crate) document_prefix: String,
    pub(crate) legacy_capability_key: String,
}

impl ResolvedBusinessProfile {
    pub(crate) fn as_input(&self) -> BusinessProfileInput {
        BusinessProfileInput {
            template_key: self.template_key.clone(),
            currency: Some(self.currency.clone()),
            timezone: Some(self.timezone.clone()),
            costing_policy: Some(self.costing_policy.clone()),
            accounting_mode: Some(self.accounting_mode.clone()),
            approval_policy: Some(self.approval_policy.clone()),
            branch_mode: Some(self.branch_mode.clone()),
            negative_stock_policy: Some(self.negative_stock_policy.clone()),
            document_prefix: Some(self.document_prefix.clone()),
        }
    }
}

#[allow(clippy::enum_variant_names)]
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ProfileValidationError {
    InvalidTemplate,
    InvalidCurrency,
    InvalidTimezone,
    InvalidCostingPolicy,
    InvalidAccountingMode,
    InvalidApprovalPolicy,
    InvalidBranchMode,
    InvalidNegativeStockPolicy,
    InvalidDocumentPrefix,
}

#[cfg(test)]
impl ProfileValidationError {
    pub(crate) const fn code(self) -> &'static str {
        match self {
            Self::InvalidTemplate => "invalid_business_template",
            Self::InvalidCurrency => "invalid_business_currency",
            Self::InvalidTimezone => "invalid_business_timezone",
            Self::InvalidCostingPolicy => "invalid_costing_policy",
            Self::InvalidAccountingMode => "invalid_accounting_mode",
            Self::InvalidApprovalPolicy => "invalid_approval_policy",
            Self::InvalidBranchMode => "invalid_branch_mode",
            Self::InvalidNegativeStockPolicy => "invalid_negative_stock_policy",
            Self::InvalidDocumentPrefix => "invalid_document_prefix",
        }
    }
}

pub(crate) fn resolve_template(template_key: &str) -> Option<ResolvedBusinessTemplate> {
    match template_key.trim().to_ascii_lowercase().as_str() {
        "general" => Some(template("general", "general", "LJK", GENERAL_CAPABILITIES)),
        "juice_fnb" => Some(template(
            "juice_fnb",
            "food_beverage",
            "FNB",
            JUICE_FNB_CAPABILITIES,
        )),
        "laundry" => Some(template("laundry", "services", "LDR", LAUNDRY_CAPABILITIES)),
        "ac_field_service" => Some(template(
            "ac_field_service",
            "services",
            "SVC",
            AC_FIELD_SERVICE_CAPABILITIES,
        )),
        "mart_retail" => Some(template(
            "mart_retail",
            "retail",
            "RTL",
            MART_RETAIL_CAPABILITIES,
        )),
        _ => None,
    }
}

const fn template(
    template_key: &'static str,
    legacy_capability_key: &'static str,
    default_document_prefix: &'static str,
    capabilities: &'static [&'static str],
) -> ResolvedBusinessTemplate {
    ResolvedBusinessTemplate {
        template_key,
        version: 1,
        legacy_capability_key,
        default_currency: "IDR",
        default_timezone: "Asia/Jakarta",
        default_costing_policy: "weighted_average",
        default_accounting_mode: "simple",
        default_approval_policy: "owner_managed",
        default_document_prefix,
        capabilities,
    }
}

pub(crate) fn template_for_legacy_capability(capability_key: &str) -> &'static str {
    match capability_key.trim().to_ascii_lowercase().as_str() {
        "food_beverage" => "juice_fnb",
        "retail" => "mart_retail",
        // `services` was historically ambiguous between Laundry and field service.
        // Keep a neutral typed template until an explicit vertical is selected.
        _ => "general",
    }
}

pub(crate) fn validate_profile_input(
    input: Option<&BusinessProfileInput>,
    legacy_capability_key: &str,
) -> Result<ResolvedBusinessProfile, ProfileValidationError> {
    let explicit_template_key = input
        .map(|profile| profile.template_key.trim())
        .filter(|key| !key.is_empty());
    let template_key = explicit_template_key
        .unwrap_or_else(|| template_for_legacy_capability(legacy_capability_key));
    let template = resolve_template(template_key).ok_or(ProfileValidationError::InvalidTemplate)?;
    if template.capabilities.is_empty() {
        return Err(ProfileValidationError::InvalidTemplate);
    }

    let currency = input
        .and_then(|profile| profile.currency.as_deref())
        .unwrap_or(template.default_currency)
        .trim()
        .to_ascii_uppercase();
    if currency.len() != 3
        || !currency
            .chars()
            .all(|character| character.is_ascii_uppercase())
    {
        return Err(ProfileValidationError::InvalidCurrency);
    }

    let timezone = input
        .and_then(|profile| profile.timezone.as_deref())
        .unwrap_or(template.default_timezone)
        .trim()
        .to_owned();
    if !valid_timezone(&timezone) {
        return Err(ProfileValidationError::InvalidTimezone);
    }

    let costing_policy = normalized_choice(
        input.and_then(|profile| profile.costing_policy.as_deref()),
        template.default_costing_policy,
        &["weighted_average", "fifo", "specific_identification"],
        ProfileValidationError::InvalidCostingPolicy,
    )?;
    let accounting_mode = normalized_choice(
        input.and_then(|profile| profile.accounting_mode.as_deref()),
        template.default_accounting_mode,
        &["simple", "advanced"],
        ProfileValidationError::InvalidAccountingMode,
    )?;
    let approval_policy = normalized_choice(
        input.and_then(|profile| profile.approval_policy.as_deref()),
        template.default_approval_policy,
        &["owner_managed", "role_based"],
        ProfileValidationError::InvalidApprovalPolicy,
    )?;
    let branch_mode = normalized_choice(
        input.and_then(|profile| profile.branch_mode.as_deref()),
        "single",
        &["single", "multi"],
        ProfileValidationError::InvalidBranchMode,
    )?;
    let negative_stock_policy = normalized_choice(
        input.and_then(|profile| profile.negative_stock_policy.as_deref()),
        "deny",
        &["deny", "allow_with_approval"],
        ProfileValidationError::InvalidNegativeStockPolicy,
    )?;

    let document_prefix = input
        .and_then(|profile| profile.document_prefix.as_deref())
        .unwrap_or(template.default_document_prefix)
        .trim()
        .to_ascii_uppercase();
    if !valid_document_prefix(&document_prefix) {
        return Err(ProfileValidationError::InvalidDocumentPrefix);
    }

    let normalized_legacy_capability = legacy_capability_key.trim().to_ascii_lowercase();
    let legacy_projection = if explicit_template_key.is_some() {
        template.legacy_capability_key.to_owned()
    } else if matches!(
        normalized_legacy_capability.as_str(),
        "general" | "food_beverage" | "retail" | "services"
    ) {
        normalized_legacy_capability
    } else {
        template.legacy_capability_key.to_owned()
    };

    Ok(ResolvedBusinessProfile {
        template_key: template.template_key.to_owned(),
        template_version: template.version,
        currency,
        timezone,
        costing_policy,
        accounting_mode,
        approval_policy,
        branch_mode,
        negative_stock_policy,
        document_prefix,
        legacy_capability_key: legacy_projection,
    })
}

fn normalized_choice(
    value: Option<&str>,
    default: &str,
    allowed: &[&str],
    error: ProfileValidationError,
) -> Result<String, ProfileValidationError> {
    let normalized = value.unwrap_or(default).trim().to_ascii_lowercase();
    allowed
        .contains(&normalized.as_str())
        .then_some(normalized)
        .ok_or(error)
}

fn valid_timezone(value: &str) -> bool {
    if value.is_empty() || value.len() > 64 || value.chars().any(char::is_whitespace) {
        return false;
    }
    if value == "UTC" {
        return true;
    }
    let mut parts = value.split('/');
    let first = parts.next().unwrap_or_default();
    let second = parts.next().unwrap_or_default();
    !first.is_empty()
        && !second.is_empty()
        && parts.all(|part| !part.is_empty())
        && value.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '/' | '_' | '-' | '+')
        })
}

fn valid_document_prefix(value: &str) -> bool {
    (1..=16).contains(&value.len())
        && value
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_alphanumeric())
        && value
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '-')
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn vertical_templates_resolve_to_explicit_capability_sets() {
        let juice = resolve_template("juice_fnb").unwrap();
        assert_eq!(juice.legacy_capability_key, "food_beverage");
        assert!(juice.capabilities.contains(&"recipes"));
        assert!(juice.capabilities.contains(&"pos"));

        let laundry = resolve_template("laundry").unwrap();
        assert_eq!(laundry.legacy_capability_key, "services");
        assert!(laundry.capabilities.contains(&"laundry_tracking"));
        assert!(!laundry.capabilities.contains(&"inventory"));

        let ac = resolve_template("ac_field_service").unwrap();
        assert!(ac.capabilities.contains(&"field_service"));
        assert!(ac.capabilities.contains(&"assets"));

        let mart = resolve_template("mart_retail").unwrap();
        assert_eq!(mart.legacy_capability_key, "retail");
        assert!(mart.capabilities.contains(&"barcode"));

        let general = resolve_template("general").unwrap();
        assert!(general.capabilities.contains(&"supporting_documents"));
        assert!(!general.capabilities.contains(&"inventory"));
    }

    #[test]
    fn profile_validation_applies_template_defaults_and_normalizes_overrides() {
        let profile = validate_profile_input(
            Some(&BusinessProfileInput {
                template_key: " laundry ".to_owned(),
                currency: Some("idr".to_owned()),
                timezone: Some("Asia/Jakarta".to_owned()),
                document_prefix: Some(" ldr-1 ".to_owned()),
                ..BusinessProfileInput::default()
            }),
            "general",
        )
        .unwrap();

        assert_eq!(profile.template_key, "laundry");
        assert_eq!(profile.legacy_capability_key, "services");
        assert_eq!(profile.currency, "IDR");
        assert_eq!(profile.document_prefix, "LDR-1");
        assert_eq!(profile.costing_policy, "weighted_average");
    }

    #[test]
    fn legacy_callers_keep_safe_profiles_without_changing_their_projection() {
        let food = validate_profile_input(None, "food_beverage").unwrap();
        assert_eq!(food.template_key, "juice_fnb");
        assert_eq!(food.legacy_capability_key, "food_beverage");

        let retail = validate_profile_input(None, "retail").unwrap();
        assert_eq!(retail.template_key, "mart_retail");
        assert_eq!(retail.legacy_capability_key, "retail");

        let services = validate_profile_input(None, "services").unwrap();
        assert_eq!(services.template_key, "general");
        assert_eq!(services.legacy_capability_key, "services");
    }

    #[test]
    fn invalid_critical_configuration_fails_closed() {
        let invalid_currency = BusinessProfileInput {
            template_key: "general".to_owned(),
            currency: Some("RUPIAH".to_owned()),
            ..BusinessProfileInput::default()
        };
        assert_eq!(
            validate_profile_input(Some(&invalid_currency), "general")
                .unwrap_err()
                .code(),
            "invalid_business_currency"
        );

        let invalid_timezone = BusinessProfileInput {
            template_key: "general".to_owned(),
            timezone: Some("Jakarta".to_owned()),
            ..BusinessProfileInput::default()
        };
        assert_eq!(
            validate_profile_input(Some(&invalid_timezone), "general")
                .unwrap_err()
                .code(),
            "invalid_business_timezone"
        );

        let invalid_template = BusinessProfileInput {
            template_key: "unknown_vertical".to_owned(),
            ..BusinessProfileInput::default()
        };
        assert_eq!(
            validate_profile_input(Some(&invalid_template), "general")
                .unwrap_err()
                .code(),
            "invalid_business_template"
        );
    }
}
