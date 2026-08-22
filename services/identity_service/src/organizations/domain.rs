use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::FromRow;
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct CreateOrganizationRequest {
    pub name: String,
    #[serde(default)]
    pub slug: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ValidatedOrganizationInput {
    pub name: String,
    pub slug: String,
}

#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum OrganizationValidationError {
    #[error("organization name must contain 2 to 120 characters")]
    InvalidName,
    #[error("organization slug must contain 3 to 64 URL-safe characters")]
    InvalidSlug,
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
}
