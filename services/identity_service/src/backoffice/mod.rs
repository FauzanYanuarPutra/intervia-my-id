//! Backoffice integration boundary for the identity service.
//!
//! Backoffice access is granted only to an existing, verified Lajukan account.
//! This module deliberately excludes `super_admin`: emergency/platform-owner
//! elevation is a separate operational concern and must never be granted by the
//! everyday CMS/CRM provisioning command.

use std::{collections::HashSet, fmt};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum BackofficeRole {
    Admin,
    ContentAdmin,
    Sales,
    Support,
}

impl BackofficeRole {
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Admin => "admin",
            Self::ContentAdmin => "content_admin",
            Self::Sales => "sales",
            Self::Support => "support",
        }
    }
}

impl fmt::Display for BackofficeRole {
    fn fmt(&self, formatter: &mut fmt::Formatter<'_>) -> fmt::Result {
        formatter.write_str(self.as_str())
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum BackofficeTarget {
    Email(String),
    Username(String),
}

#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
pub enum BackofficeInputError {
    #[error("backoffice target must be a valid email or username")]
    InvalidTarget,
    #[error("at least one supported backoffice role is required")]
    MissingRoles,
    #[error("unsupported backoffice role: {0}")]
    UnsupportedRole(String),
}

pub fn normalize_backoffice_target(raw: &str) -> Result<BackofficeTarget, BackofficeInputError> {
    let normalized = raw.trim().trim_start_matches('@').to_ascii_lowercase();
    if normalized.is_empty() {
        return Err(BackofficeInputError::InvalidTarget);
    }

    if normalized.contains('@') {
        let mut parts = normalized.split('@');
        let local = parts.next().unwrap_or_default();
        let domain = parts.next().unwrap_or_default();
        if parts.next().is_some()
            || local.is_empty()
            || domain.len() < 3
            || !domain.contains('.')
            || normalized.chars().any(char::is_whitespace)
        {
            return Err(BackofficeInputError::InvalidTarget);
        }
        return Ok(BackofficeTarget::Email(normalized));
    }

    if !(3..=30).contains(&normalized.len())
        || normalized.starts_with('.')
        || normalized.ends_with('.')
        || normalized.contains("..")
        || !normalized
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || character == '_' || character == '.')
    {
        return Err(BackofficeInputError::InvalidTarget);
    }

    Ok(BackofficeTarget::Username(normalized))
}

pub fn parse_backoffice_roles(raw: &str) -> Result<Vec<BackofficeRole>, BackofficeInputError> {
    let mut seen = HashSet::new();
    let mut roles = Vec::new();

    for value in raw
        .split(',')
        .map(str::trim)
        .filter(|value| !value.is_empty())
    {
        let role = match value.to_ascii_lowercase().as_str() {
            "admin" => BackofficeRole::Admin,
            "content_admin" => BackofficeRole::ContentAdmin,
            "sales" => BackofficeRole::Sales,
            "support" => BackofficeRole::Support,
            other => return Err(BackofficeInputError::UnsupportedRole(other.to_string())),
        };

        if seen.insert(role) {
            roles.push(role);
        }
    }

    if roles.is_empty() {
        return Err(BackofficeInputError::MissingRoles);
    }

    Ok(roles)
}

pub const fn is_backoffice_eligible(
    is_active: bool,
    is_banned: bool,
    email_verified: bool,
    phone_verified: bool,
) -> bool {
    is_active && !is_banned && (email_verified || phone_verified)
}
