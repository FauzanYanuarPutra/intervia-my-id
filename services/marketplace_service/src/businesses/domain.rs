use serde::{Deserialize, Serialize};
use serde_json::Value;
use sha2::{Digest, Sha256};
use uuid::Uuid;

const MAX_NAME_LEN: usize = 160;
const MAX_ADDRESS_LEN: usize = 500;
const MAX_DESCRIPTION_LEN: usize = 2_000;
const MAX_PHONE_LEN: usize = 40;
const MAX_PUBLIC_METADATA_BYTES: usize = 8 * 1024;

#[derive(Debug, Clone, Copy, Deserialize, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub(crate) enum OrganizationMode {
    Existing,
    Create,
    Auto,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct OrganizationSelection {
    pub(crate) mode: OrganizationMode,
    pub(crate) organization_id: Option<Uuid>,
    pub(crate) new_organization_name: Option<String>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct BusinessInput {
    pub(crate) name: String,
    #[serde(default = "default_capability_key")]
    pub(crate) capability_key: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct PrimaryLocationInput {
    pub(crate) name: String,
    pub(crate) address: String,
    pub(crate) city: String,
    pub(crate) lat: Option<f64>,
    pub(crate) lng: Option<f64>,
    pub(crate) phone: Option<String>,
    #[serde(default = "default_true")]
    pub(crate) public_visibility: bool,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct StorefrontInput {
    pub(crate) description: Option<String>,
    #[serde(default = "default_true")]
    pub(crate) online_order_enabled: bool,
    #[serde(default = "default_true")]
    pub(crate) offline_order_enabled: bool,
    #[serde(default)]
    pub(crate) public_metadata: Value,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub(crate) struct ProvisionBusinessRequest {
    pub(crate) organization: OrganizationSelection,
    pub(crate) business: BusinessInput,
    pub(crate) primary_location: PrimaryLocationInput,
    pub(crate) storefront: StorefrontInput,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct ReconcileBusinessRequest {
    pub(crate) store_id: Option<Uuid>,
}

#[derive(Debug, Clone)]
pub(crate) struct ValidatedProvisionCommand {
    pub(crate) organization: OrganizationSelection,
    pub(crate) business: BusinessInput,
    pub(crate) primary_location: PrimaryLocationInput,
    pub(crate) storefront: StorefrontInput,
    pub(crate) request_hash: String,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct BusinessRecord {
    pub(crate) id: Uuid,
    pub(crate) organization_id: Uuid,
    pub(crate) name: String,
    pub(crate) capability_key: String,
    pub(crate) status: String,
    pub(crate) version: i64,
    pub(crate) created_at: chrono::DateTime<chrono::Utc>,
    pub(crate) updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct BusinessStore {
    pub(crate) id: Uuid,
    pub(crate) name: String,
    pub(crate) slug: String,
    pub(crate) description: Option<String>,
    pub(crate) city: String,
    pub(crate) address: String,
    pub(crate) lat: f64,
    pub(crate) lng: f64,
    pub(crate) phone: Option<String>,
    pub(crate) is_active: bool,
    pub(crate) online_order_enabled: bool,
    pub(crate) offline_order_enabled: bool,
    pub(crate) metadata: Value,
    pub(crate) created_at: chrono::DateTime<chrono::Utc>,
    pub(crate) updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct BusinessLocation {
    pub(crate) id: Uuid,
    pub(crate) store_id: Uuid,
    pub(crate) name: String,
    pub(crate) address: String,
    pub(crate) city: String,
    pub(crate) lat: Option<f64>,
    pub(crate) lng: Option<f64>,
    pub(crate) phone: Option<String>,
    pub(crate) status: String,
    pub(crate) is_primary: bool,
    pub(crate) public_visibility: bool,
    pub(crate) created_at: chrono::DateTime<chrono::Utc>,
    pub(crate) updated_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct BusinessAggregate {
    pub(crate) business: BusinessRecord,
    pub(crate) primary_store: BusinessStore,
    pub(crate) primary_location: BusinessLocation,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum ValidationError {
    OrganizationIdRequired,
    OrganizationIdNotAllowed,
    OrganizationNameRequired,
    OrganizationNameNotAllowed,
    InvalidBusinessName,
    InvalidCapability,
    InvalidLocationName,
    InvalidLocationAddress,
    InvalidLocationCity,
    InvalidLocationCoordinates,
    InvalidPhone,
    InvalidDescription,
    InvalidPublicMetadata,
}

impl ValidationError {
    pub(crate) const fn code(self) -> &'static str {
        match self {
            Self::OrganizationIdRequired => "organization_id_required",
            Self::OrganizationIdNotAllowed => "organization_id_not_allowed",
            Self::OrganizationNameRequired => "organization_name_required",
            Self::OrganizationNameNotAllowed => "organization_name_not_allowed",
            Self::InvalidBusinessName => "invalid_business_name",
            Self::InvalidCapability => "invalid_capability_key",
            Self::InvalidLocationName => "invalid_location_name",
            Self::InvalidLocationAddress => "invalid_location_address",
            Self::InvalidLocationCity => "invalid_location_city",
            Self::InvalidLocationCoordinates => "invalid_location_coordinates",
            Self::InvalidPhone => "invalid_phone",
            Self::InvalidDescription => "invalid_storefront_description",
            Self::InvalidPublicMetadata => "invalid_public_metadata",
        }
    }
}

pub(crate) fn validate_provision_request(
    request: ProvisionBusinessRequest,
) -> Result<ValidatedProvisionCommand, ValidationError> {
    let business_name = normalize_required(request.business.name, MAX_NAME_LEN)
        .ok_or(ValidationError::InvalidBusinessName)?;
    let capability_key = request.business.capability_key.trim().to_ascii_lowercase();
    if !matches!(
        capability_key.as_str(),
        "general" | "food_beverage" | "retail" | "services"
    ) {
        return Err(ValidationError::InvalidCapability);
    }

    let organization_name = request
        .organization
        .new_organization_name
        .map(|name| normalize_required(name, MAX_NAME_LEN))
        .transpose_option()
        .ok_or(ValidationError::OrganizationNameRequired)?;
    match request.organization.mode {
        OrganizationMode::Existing => {
            if request.organization.organization_id.is_none() {
                return Err(ValidationError::OrganizationIdRequired);
            }
            if organization_name.is_some() {
                return Err(ValidationError::OrganizationNameNotAllowed);
            }
        }
        OrganizationMode::Create => {
            if request.organization.organization_id.is_some() {
                return Err(ValidationError::OrganizationIdNotAllowed);
            }
            if organization_name.is_none() {
                return Err(ValidationError::OrganizationNameRequired);
            }
        }
        OrganizationMode::Auto => {
            if request.organization.organization_id.is_some() {
                return Err(ValidationError::OrganizationIdNotAllowed);
            }
        }
    }

    let location_name = normalize_required(request.primary_location.name, MAX_NAME_LEN)
        .ok_or(ValidationError::InvalidLocationName)?;
    let address = normalize_required(request.primary_location.address, MAX_ADDRESS_LEN)
        .ok_or(ValidationError::InvalidLocationAddress)?;
    let city = normalize_required(request.primary_location.city, MAX_NAME_LEN)
        .ok_or(ValidationError::InvalidLocationCity)?;
    validate_coordinates(request.primary_location.lat, request.primary_location.lng)?;

    let phone = normalize_optional(request.primary_location.phone, MAX_PHONE_LEN)
        .ok_or(ValidationError::InvalidPhone)?;
    let description = normalize_optional(request.storefront.description, MAX_DESCRIPTION_LEN)
        .ok_or(ValidationError::InvalidDescription)?;
    if !request.storefront.public_metadata.is_object()
        || serde_json::to_vec(&request.storefront.public_metadata)
            .map_or(true, |metadata| metadata.len() > MAX_PUBLIC_METADATA_BYTES)
    {
        return Err(ValidationError::InvalidPublicMetadata);
    }

    let organization = OrganizationSelection {
        mode: request.organization.mode,
        organization_id: request.organization.organization_id,
        new_organization_name: organization_name,
    };
    let business = BusinessInput {
        name: business_name,
        capability_key,
    };
    let primary_location = PrimaryLocationInput {
        name: location_name,
        address,
        city,
        lat: request.primary_location.lat,
        lng: request.primary_location.lng,
        phone,
        public_visibility: request.primary_location.public_visibility,
    };
    let storefront = StorefrontInput {
        description,
        online_order_enabled: request.storefront.online_order_enabled,
        offline_order_enabled: request.storefront.offline_order_enabled,
        public_metadata: request.storefront.public_metadata,
    };
    let canonical = serde_json::json!({
        "version": 1,
        "organization": &organization,
        "business": &business,
        "primary_location": &primary_location,
        "storefront": &storefront,
    });
    let bytes = serde_json::to_vec(&canonical).expect("canonical business command is serializable");
    let request_hash = format!("{:x}", Sha256::digest(bytes));

    Ok(ValidatedProvisionCommand {
        organization,
        business,
        primary_location,
        storefront,
        request_hash,
    })
}

fn default_capability_key() -> String {
    "general".to_owned()
}

const fn default_true() -> bool {
    true
}

fn normalize_required(value: String, max_len: usize) -> Option<String> {
    let normalized = value.split_whitespace().collect::<Vec<_>>().join(" ");
    (!normalized.is_empty() && normalized.chars().count() <= max_len).then_some(normalized)
}

fn normalize_optional(value: Option<String>, max_len: usize) -> Option<Option<String>> {
    match value {
        Some(value) => normalize_required(value, max_len).map(Some),
        None => Some(None),
    }
}

fn validate_coordinates(lat: Option<f64>, lng: Option<f64>) -> Result<(), ValidationError> {
    match (lat, lng) {
        (None, None) => Ok(()),
        (Some(lat), Some(lng))
            if lat.is_finite()
                && lng.is_finite()
                && (-90.0..=90.0).contains(&lat)
                && (-180.0..=180.0).contains(&lng) =>
        {
            Ok(())
        }
        _ => Err(ValidationError::InvalidLocationCoordinates),
    }
}

const PUBLIC_STORE_KEYS: [&str; 44] = [
    "source",
    "portal_public_url",
    "store_photo_url",
    "cover_image_url",
    "cover_url",
    "banner_url",
    "image_url",
    "imageUrl",
    "image",
    "menu_photo_url",
    "gallery_images",
    "gallery_videos",
    "images",
    "photos",
    "video_urls",
    "business_videos",
    "umkm_category",
    "business_type",
    "store_type",
    "segment",
    "focus_label",
    "umkm_focus",
    "business_focus",
    "category",
    "category_label",
    "publish_services",
    "publish_service",
    "services",
    "publish_food",
    "publish_mart",
    "open_hours",
    "price_band",
    "outlet_active",
    "location_mode",
    "live_now",
    "auto_live_schedule_enabled",
    "live_schedule_days",
    "live_schedule_start",
    "live_schedule_end",
    "rating_avg",
    "rating_count",
    "review_count",
    "recommended_qr",
    "reservation_enabled",
];

pub(crate) fn project_public_store_details(raw: &Value) -> serde_json::Map<String, Value> {
    let Some(object) = raw.as_object() else {
        return serde_json::Map::new();
    };
    PUBLIC_STORE_KEYS
        .iter()
        .filter_map(|key| {
            object
                .get(*key)
                .and_then(sanitize_public_value)
                .map(|value| ((*key).to_owned(), value))
        })
        .collect()
}

fn sanitize_public_value(value: &Value) -> Option<Value> {
    match value {
        Value::Null | Value::Bool(_) | Value::Number(_) => Some(value.clone()),
        Value::String(value) => Some(Value::String(value.chars().take(4096).collect())),
        Value::Array(values) => Some(Value::Array(
            values
                .iter()
                .take(24)
                .filter_map(sanitize_public_value)
                .collect(),
        )),
        Value::Object(_) => None,
    }
}

pub(crate) fn project_public_phone(raw_phone: Option<String>, details: &Value) -> Option<String> {
    let object = details.as_object()?;
    let consent = [
        "public_contact_enabled",
        "contact_public",
        "phone_public",
        "show_public_phone",
        "whatsapp_public",
    ]
    .iter()
    .any(|key| object.get(*key).and_then(Value::as_bool) == Some(true));
    let source = ["contact_source", "phone_source", "whatsapp_source"]
        .iter()
        .find_map(|key| object.get(*key).and_then(Value::as_str))
        .unwrap_or_default()
        .trim()
        .to_ascii_lowercase();
    let allowed_source = matches!(
        source.as_str(),
        "owner"
            | "owner_metadata"
            | "owner_published"
            | "business_owner"
            | "user"
            | "user_submitted"
            | "public_profile"
            | "usaha_portal_public"
            | "verified_provider"
    );
    (consent && allowed_source).then_some(raw_phone).flatten()
}

pub(crate) fn store_slug(name: &str, id: Uuid) -> String {
    let base = name
        .to_ascii_lowercase()
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
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-");
    let base = if base.is_empty() { "usaha" } else { &base };
    let suffix = id.simple().to_string();
    let max_base_len = 64usize.saturating_sub(1 + 8);
    let truncated = base.chars().take(max_base_len).collect::<String>();
    format!("{}-{}", truncated.trim_end_matches('-'), &suffix[..8])
}

trait TransposeOption<T> {
    fn transpose_option(self) -> Option<Option<T>>;
}

impl<T> TransposeOption<T> for Option<Option<T>> {
    fn transpose_option(self) -> Option<Option<T>> {
        match self {
            Some(Some(value)) => Some(Some(value)),
            Some(None) => None,
            None => Some(None),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;
    use uuid::Uuid;

    fn valid_request() -> ProvisionBusinessRequest {
        ProvisionBusinessRequest {
            organization: OrganizationSelection {
                mode: OrganizationMode::Auto,
                organization_id: None,
                new_organization_name: Some("  Kedai   Cuk  ".to_owned()),
            },
            business: BusinessInput {
                name: "  Kedai   Cuk  ".to_owned(),
                capability_key: "FOOD_BEVERAGE".to_owned(),
            },
            primary_location: PrimaryLocationInput {
                name: "  Lokasi   utama ".to_owned(),
                address: " Jl. Contoh 1 ".to_owned(),
                city: " Jakarta ".to_owned(),
                lat: Some(-6.2),
                lng: Some(106.8),
                phone: Some(" +628123456789 ".to_owned()),
                public_visibility: true,
            },
            storefront: StorefrontInput {
                description: Some(" Minuman segar. ".to_owned()),
                online_order_enabled: true,
                offline_order_enabled: true,
                public_metadata: json!({"category": "beverage"}),
            },
        }
    }

    #[test]
    fn validation_normalizes_input_and_hash_is_stable() {
        let first = validate_provision_request(valid_request()).expect("valid request");
        let second = validate_provision_request(valid_request()).expect("valid request");

        assert_eq!(first.business.name, "Kedai Cuk");
        assert_eq!(first.business.capability_key, "food_beverage");
        assert_eq!(first.primary_location.name, "Lokasi utama");
        assert_eq!(first.request_hash, second.request_hash);
        assert_eq!(first.request_hash.len(), 64);
    }

    #[test]
    fn validation_rejects_inconsistent_organization_modes() {
        let mut request = valid_request();
        request.organization.mode = OrganizationMode::Existing;

        assert_eq!(
            validate_provision_request(request).unwrap_err().code(),
            "organization_id_required"
        );

        let mut request = valid_request();
        request.organization.mode = OrganizationMode::Create;
        request.organization.organization_id = Some(Uuid::new_v4());

        assert_eq!(
            validate_provision_request(request).unwrap_err().code(),
            "organization_id_not_allowed"
        );
    }

    #[test]
    fn validation_rejects_invalid_location_and_metadata() {
        let mut request = valid_request();
        request.primary_location.lat = Some(91.0);
        assert_eq!(
            validate_provision_request(request).unwrap_err().code(),
            "invalid_location_coordinates"
        );

        let mut request = valid_request();
        request.storefront.public_metadata = json!(["not", "an", "object"]);
        assert_eq!(
            validate_provision_request(request).unwrap_err().code(),
            "invalid_public_metadata"
        );
    }

    #[test]
    fn public_store_serialization_is_allowlist_only() {
        let dto = PublicStore {
            id: Uuid::new_v4(),
            name: "Kedai Cuk".to_owned(),
            slug: "kedai-cuk".to_owned(),
            description: Some("Minuman segar".to_owned()),
            city: "Jakarta".to_owned(),
            address: "Jl. Contoh 1".to_owned(),
            lat: -6.2,
            lng: 106.8,
            phone: None,
            is_active: true,
            online_order_enabled: true,
            offline_order_enabled: true,
            metadata: serde_json::Map::new(),
            created_at: chrono::Utc::now(),
            updated_at: chrono::Utc::now(),
        };

        let serialized = serde_json::to_value(dto).expect("serialize public store");
        let object = serialized.as_object().expect("public store object");
        assert_eq!(object.len(), 15);
    }

    #[test]
    fn store_slug_is_bounded_and_stable() {
        let id = Uuid::parse_str("4f696c27-8291-42d0-9f90-b9da53f938ba").unwrap();
        let name = "Kedai Sangat Panjang Dengan Nama Yang Tetap Harus Aman Untuk URL Publik";
        let first = store_slug(name, id);

        assert_eq!(first, store_slug(name, id));
        assert!(first.len() <= 64);
        assert!(first.ends_with("-4f696c27"));
    }
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct PublicStore {
    pub(crate) id: Uuid,
    pub(crate) name: String,
    pub(crate) slug: String,
    pub(crate) description: Option<String>,
    pub(crate) city: String,
    pub(crate) address: String,
    pub(crate) lat: f64,
    pub(crate) lng: f64,
    pub(crate) phone: Option<String>,
    pub(crate) is_active: bool,
    pub(crate) online_order_enabled: bool,
    pub(crate) offline_order_enabled: bool,
    pub(crate) metadata: serde_json::Map<String, Value>,
    pub(crate) created_at: chrono::DateTime<chrono::Utc>,
    pub(crate) updated_at: chrono::DateTime<chrono::Utc>,
}
