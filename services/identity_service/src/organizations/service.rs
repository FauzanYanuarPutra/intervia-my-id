use sqlx::error::DatabaseError;
use uuid::Uuid;

use super::{
    domain::{
        validate_create_organization, OrganizationMemberView, OrganizationValidationError,
        OrganizationView,
    },
    repository::OrganizationRepository,
};

#[derive(Debug, thiserror::Error)]
pub enum OrganizationServiceError {
    #[error(transparent)]
    Validation(#[from] OrganizationValidationError),
    #[error("organization name or slug already exists")]
    Conflict,
    #[error("organization not found")]
    NotFound,
    #[error("organization storage unavailable")]
    Storage,
}

pub struct OrganizationService<'a> {
    repository: OrganizationRepository<'a>,
}

impl<'a> OrganizationService<'a> {
    pub fn new(repository: OrganizationRepository<'a>) -> Self {
        Self { repository }
    }

    pub async fn list(
        &self,
        actor_user_id: Uuid,
    ) -> Result<Vec<OrganizationView>, OrganizationServiceError> {
        self.repository
            .list_for_actor(actor_user_id)
            .await
            .map_err(|_| OrganizationServiceError::Storage)
    }

    pub async fn get(
        &self,
        actor_user_id: Uuid,
        organization_id: Uuid,
    ) -> Result<OrganizationView, OrganizationServiceError> {
        self.repository
            .get_for_actor(actor_user_id, organization_id)
            .await
            .map_err(|_| OrganizationServiceError::Storage)?
            .ok_or(OrganizationServiceError::NotFound)
    }

    pub async fn members(
        &self,
        actor_user_id: Uuid,
        organization_id: Uuid,
    ) -> Result<Vec<OrganizationMemberView>, OrganizationServiceError> {
        self.repository
            .list_members_for_actor(actor_user_id, organization_id)
            .await
            .map_err(|_| OrganizationServiceError::Storage)?
            .ok_or(OrganizationServiceError::NotFound)
    }

    pub async fn create(
        &self,
        actor_user_id: Uuid,
        name: &str,
        slug: Option<&str>,
    ) -> Result<OrganizationView, OrganizationServiceError> {
        let input = validate_create_organization(name, slug)?;
        self.repository
            .create_for_actor(actor_user_id, &input)
            .await
            .map_err(map_create_error)
    }
}

fn map_create_error(error: sqlx::Error) -> OrganizationServiceError {
    match &error {
        sqlx::Error::Database(database_error) if is_unique_violation(database_error.as_ref()) => {
            OrganizationServiceError::Conflict
        }
        _ => OrganizationServiceError::Storage,
    }
}

fn is_unique_violation(error: &dyn DatabaseError) -> bool {
    error.code().as_deref() == Some("23505")
}
