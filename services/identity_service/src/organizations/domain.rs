use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateOrganizationRequest {
    pub name: String,
    #[serde(default)]
    pub slug: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct EnsureOrganizationRequest {
    pub name: String,
}

#[derive(Debug, Deserialize)]
pub struct CreateOrganizationInvitationRequest {
    pub username: String,
    pub role: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedOrganizationInput {
    pub name: String,
    pub slug: String,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedEnsureOrganizationInput {
    pub name: String,
    pub slug: String,
    pub request_hash: String,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum OrganizationValidationError {
    #[error("organization name must contain 2 to 120 characters")]
    InvalidName,
    #[error("organization slug must contain 3 to 64 URL-safe characters")]
    InvalidSlug,
    #[error("invitee username must contain 3 to 30 supported characters")]
    InvalidInviteeUsername,
    #[error("unsupported organization invitation role")]
    InvalidInvitationRole,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct OrganizationView {
    pub id: Uuid,
    pub name: String,
    pub slug: Option<String>,
    pub owner_user_id: Option<Uuid>,
    pub current_user_role: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct OrganizationMemberView {
    pub user_id: Uuid,
    pub email: Option<String>,
    pub username: Option<String>,
    pub full_name: Option<String>,
    pub role: String,
    pub status: String,
    pub joined_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, FromRow)]
pub struct OrganizationInvitationView {
    pub id: Uuid,
    pub org_id: Uuid,
    pub organization_name: String,
    pub invitee_user_id: Uuid,
    pub invitee_username: Option<String>,
    pub role: String,
    pub status: String,
    pub expires_at: DateTime<Utc>,
    pub created_at: DateTime<Utc>,
}

pub fn validate_create_organization(
    name: &str,
    requested_slug: Option<&str>,
) -> Result<ValidatedOrganizationInput, OrganizationValidationError> {
    let name = name.split_whitespace().collect::<Vec<_>>().join(" ");
    if !(2..=120).contains(&name.chars().count()) {
        return Err(OrganizationValidationError::InvalidName);
    }

    let slug_source = requested_slug.unwrap_or(&name);
    let slug = slugify(slug_source);
    if !(3..=64).contains(&slug.len()) {
        return Err(OrganizationValidationError::InvalidSlug);
    }

    Ok(ValidatedOrganizationInput { name, slug })
}

pub fn validate_ensure_organization(
    name: &str,
) -> Result<ValidatedEnsureOrganizationInput, OrganizationValidationError> {
    let validated = validate_create_organization(name, None)?;
    let canonical_payload = serde_json::json!({ "name": validated.name }).to_string();
    let request_hash = format!("{:x}", Sha256::digest(canonical_payload.as_bytes()));

    Ok(ValidatedEnsureOrganizationInput {
        name: validated.name,
        slug: validated.slug,
        request_hash,
    })
}

pub fn normalize_invitee_username(value: &str) -> Result<String, OrganizationValidationError> {
    let username = value.trim().trim_start_matches('@').to_ascii_lowercase();
    if !(3..=30).contains(&username.len())
        || username.starts_with('.')
        || username.ends_with('.')
        || username.contains("..")
        || !username.chars().all(|character| {
            character.is_ascii_alphanumeric() || character == '_' || character == '.'
        })
    {
        return Err(OrganizationValidationError::InvalidInviteeUsername);
    }
    Ok(username)
}

pub fn validate_invitation_role(value: &str) -> Result<String, OrganizationValidationError> {
    let role = value.trim().to_ascii_lowercase();
    match role.as_str() {
        "org_admin" | "org_manager" | "org_cashier" | "org_inventory" | "org_accounting"
        | "org_viewer" => Ok(role),
        _ => Err(OrganizationValidationError::InvalidInvitationRole),
    }
}

pub fn organization_slug_candidate(base_slug: &str, collision_index: u32) -> String {
    if collision_index == 0 {
        return base_slug.chars().take(64).collect();
    }

    let suffix = format!("-{collision_index}");
    let base_limit = 64usize.saturating_sub(suffix.len());
    let base = base_slug.chars().take(base_limit).collect::<String>();
    format!("{}{}", base.trim_matches('-'), suffix)
}

fn slugify(value: &str) -> String {
    let mut slug = String::with_capacity(value.len().min(64));
    let mut previous_was_dash = false;

    for character in value.chars().flat_map(char::to_lowercase) {
        if character.is_ascii_alphanumeric() {
            if slug.len() == 64 {
                break;
            }
            slug.push(character);
            previous_was_dash = false;
        } else if !previous_was_dash && !slug.is_empty() && slug.len() < 64 {
            slug.push('-');
            previous_was_dash = true;
        }
    }

    slug.trim_matches('-').to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn organization_input_normalizes_name_and_slug() {
        let validated = validate_create_organization(
            "  Kedai   Kopi Nusantara  ",
            Some(" Kedai Kopi Nusantara "),
        )
        .expect("valid organization");
        assert_eq!(validated.name, "Kedai Kopi Nusantara");
        assert_eq!(validated.slug, "kedai-kopi-nusantara");
    }

    #[test]
    fn organization_input_rejects_empty_or_oversized_names() {
        assert!(validate_create_organization(" ", None).is_err());
        assert!(validate_create_organization(&"a".repeat(121), None).is_err());
    }

    #[test]
    fn organization_slug_requires_a_meaningful_identifier() {
        assert!(validate_create_organization("Usaha", Some("---")).is_err());
        assert!(validate_create_organization("Usaha", Some("ab")).is_err());
    }

    #[test]
    fn ensure_request_hash_is_stable_for_equivalent_names() {
        let first = validate_ensure_organization("  Kedai   Kopi Nusantara  ")
            .expect("valid ensure request");
        let second =
            validate_ensure_organization("Kedai Kopi Nusantara").expect("valid ensure request");
        assert_eq!(first.request_hash, second.request_hash);
        assert_eq!(
            first.request_hash,
            "c6cd0fd3aba6155c4403e5ce47c619b0dd5537f5698c7dd86add6619523915cb"
        );
    }

    #[test]
    fn ensure_slug_candidates_are_deterministic_and_bounded() {
        let input = validate_ensure_organization(&format!("Kedai {}", "Panjang ".repeat(13)))
            .expect("valid ensure request");
        assert!(input.slug.len() <= 64);
        assert_eq!(organization_slug_candidate(&input.slug, 0), input.slug);
        assert_eq!(
            organization_slug_candidate("kedai-kopi-nusantara", 7),
            "kedai-kopi-nusantara-7"
        );
        assert!(organization_slug_candidate(&input.slug, 999_999).len() <= 64);
    }
}
