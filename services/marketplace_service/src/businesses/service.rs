use super::{
    domain::{
        validate_business_profile_update, validate_provision_request, BusinessAggregate,
        BusinessProfileUpdateRequest, OrganizationMode, ProvisionBusinessRequest,
        ReconcileBusinessRequest, ValidationError,
    },
    identity_client::{IdentityClient, IdentityClientError, OrganizationSummary},
    products::{
        validate_create_request, BusinessProduct, CreateBusinessProductRequest, ProductRepository,
        ProductRepositoryError, ProductValidationError,
    },
    repository::{BusinessRepository, ProvisionOutcome, RepositoryError},
};
use sha2::{Digest, Sha256};
use uuid::Uuid;

#[derive(Debug)]
pub(crate) enum BusinessServiceError {
    Validation(ValidationError),
    ProductValidation(ProductValidationError),
    IdentityUnavailable,
    AccessDenied,
    IdempotencyConflict,
    VersionConflict,
    OrganizationSelectionRequired,
    ReconciliationSelectionRequired,
    NotFound,
    Storage,
}

#[derive(Clone)]
pub(crate) struct BusinessService {
    repository: BusinessRepository,
    product_repository: ProductRepository,
    identity: IdentityClient,
}

impl BusinessService {
    pub(crate) fn new(
        repository: BusinessRepository,
        product_repository: ProductRepository,
        identity: IdentityClient,
    ) -> Self {
        Self {
            repository,
            product_repository,
            identity,
        }
    }

    pub(crate) async fn list_mine(
        &self,
        authorization: &str,
    ) -> Result<Vec<BusinessAggregate>, BusinessServiceError> {
        let organizations = self
            .identity
            .list_organizations(authorization)
            .await
            .map_err(map_identity_error)?;
        let organization_ids = organizations
            .into_iter()
            .map(|organization| organization.id)
            .collect::<Vec<_>>();
        self.repository
            .list_for_organizations(&organization_ids)
            .await
            .map_err(map_repository_error)
    }

    pub(crate) async fn get(
        &self,
        authorization: &str,
        business_id: Uuid,
    ) -> Result<BusinessAggregate, BusinessServiceError> {
        let organizations = self
            .identity
            .list_organizations(authorization)
            .await
            .map_err(map_identity_error)?;
        for organization in organizations {
            if let Some(aggregate) = self
                .repository
                .get_for_organization(business_id, organization.id)
                .await
                .map_err(map_repository_error)?
            {
                return Ok(aggregate);
            }
        }
        Err(BusinessServiceError::NotFound)
    }

    pub(crate) async fn update_profile(
        &self,
        actor_id: Uuid,
        authorization: &str,
        business_id: Uuid,
        request: BusinessProfileUpdateRequest,
    ) -> Result<BusinessAggregate, BusinessServiceError> {
        let command =
            validate_business_profile_update(request).map_err(BusinessServiceError::Validation)?;
        let organizations = self
            .identity
            .list_organizations(authorization)
            .await
            .map_err(map_identity_error)?;
        for organization in &organizations {
            let existing = self
                .repository
                .get_for_organization(business_id, organization.id)
                .await
                .map_err(map_repository_error)?;
            if existing.is_none() {
                continue;
            }
            let managing = management_organization(&organizations, organization.id)
                .ok_or(BusinessServiceError::AccessDenied)?;
            return self
                .repository
                .update_profile(actor_id, business_id, managing.id, &command)
                .await
                .map_err(map_repository_error);
        }
        Err(BusinessServiceError::NotFound)
    }

    pub(crate) async fn create_product(
        &self,
        actor_id: Uuid,
        authorization: &str,
        business_id: Uuid,
        request: CreateBusinessProductRequest,
    ) -> Result<BusinessProduct, BusinessServiceError> {
        let command =
            validate_create_request(request).map_err(BusinessServiceError::ProductValidation)?;
        let organizations = self
            .identity
            .list_organizations(authorization)
            .await
            .map_err(map_identity_error)?;

        for organization in &organizations {
            let existing = self
                .repository
                .get_for_organization(business_id, organization.id)
                .await
                .map_err(map_repository_error)?;
            if existing.is_none() {
                continue;
            }
            let managing = management_organization(&organizations, organization.id)
                .ok_or(BusinessServiceError::AccessDenied)?;
            return self
                .product_repository
                .create(actor_id, business_id, managing.id, &command)
                .await
                .map_err(map_product_repository_error);
        }

        Err(BusinessServiceError::NotFound)
    }

    pub(crate) async fn provision(
        &self,
        actor_id: Uuid,
        authorization: &str,
        idempotency_key: Uuid,
        request: ProvisionBusinessRequest,
    ) -> Result<ProvisionOutcome, BusinessServiceError> {
        let command =
            validate_provision_request(request).map_err(BusinessServiceError::Validation)?;
        let organization = self
            .resolve_organization(authorization, idempotency_key, &command)
            .await?;
        self.repository
            .provision(actor_id, idempotency_key, organization.id, &command)
            .await
            .map_err(map_repository_error)
    }

    pub(crate) async fn reconcile(
        &self,
        actor_id: Uuid,
        authorization: &str,
        idempotency_key: Uuid,
        request: ReconcileBusinessRequest,
    ) -> Result<ProvisionOutcome, BusinessServiceError> {
        if let Some(store_id) = request.store_id {
            if let Some(aggregate) = self
                .repository
                .linked_for_actor(actor_id, store_id)
                .await
                .map_err(map_repository_error)?
            {
                return Ok(ProvisionOutcome {
                    aggregate,
                    replayed: true,
                });
            }
        }
        let candidates = self
            .repository
            .list_unlinked_for_actor(actor_id)
            .await
            .map_err(map_repository_error)?;
        let candidate = match request.store_id {
            Some(store_id) => candidates
                .into_iter()
                .find(|candidate| candidate.id == store_id)
                .ok_or(BusinessServiceError::NotFound)?,
            None if candidates.len() == 1 => candidates
                .into_iter()
                .next()
                .expect("one reconciliation candidate"),
            None if candidates.is_empty() => return Err(BusinessServiceError::NotFound),
            None => return Err(BusinessServiceError::ReconciliationSelectionRequired),
        };
        let organizations = self
            .identity
            .list_organizations(authorization)
            .await
            .map_err(map_identity_error)?;
        let organization_id = if let Some(hint) = candidate.organization_id {
            organizations
                .iter()
                .find(|organization| organization.id == hint)
                .map(|organization| organization.id)
                .ok_or(BusinessServiceError::AccessDenied)?
        } else {
            match organizations.len() {
                0 => {
                    self.identity
                        .ensure_organization(
                            authorization,
                            identity_child_key(idempotency_key),
                            &candidate.name,
                        )
                        .await
                        .map_err(map_identity_error)?
                        .id
                }
                1 => organizations[0].id,
                _ => return Err(BusinessServiceError::ReconciliationSelectionRequired),
            }
        };
        self.repository
            .reconcile_existing_store(actor_id, idempotency_key, organization_id, &candidate)
            .await
            .map_err(map_repository_error)
    }

    async fn resolve_organization(
        &self,
        authorization: &str,
        idempotency_key: Uuid,
        command: &super::domain::ValidatedProvisionCommand,
    ) -> Result<OrganizationSummary, BusinessServiceError> {
        match command.organization.mode {
            OrganizationMode::Existing => {
                let expected_id = command
                    .organization
                    .organization_id
                    .ok_or(BusinessServiceError::AccessDenied)?;
                self.identity
                    .list_organizations(authorization)
                    .await
                    .map_err(map_identity_error)?
                    .into_iter()
                    .find(|organization| organization.id == expected_id)
                    .ok_or(BusinessServiceError::AccessDenied)
            }
            OrganizationMode::Create => {
                let name = command
                    .organization
                    .new_organization_name
                    .as_deref()
                    .ok_or(BusinessServiceError::Storage)?;
                self.identity
                    .ensure_organization(authorization, identity_child_key(idempotency_key), name)
                    .await
                    .map_err(map_identity_error)
            }
            OrganizationMode::Auto => {
                let organizations = self
                    .identity
                    .list_organizations(authorization)
                    .await
                    .map_err(map_identity_error)?;
                match organizations.len() {
                    0 => {
                        let name = command
                            .organization
                            .new_organization_name
                            .as_deref()
                            .unwrap_or(&command.business.name);
                        self.identity
                            .ensure_organization(
                                authorization,
                                identity_child_key(idempotency_key),
                                name,
                            )
                            .await
                            .map_err(map_identity_error)
                    }
                    1 => Ok(organizations.into_iter().next().expect("one organization")),
                    _ => Err(BusinessServiceError::OrganizationSelectionRequired),
                }
            }
        }
    }
}

fn map_identity_error(error: IdentityClientError) -> BusinessServiceError {
    match error {
        IdentityClientError::AccessDenied => BusinessServiceError::AccessDenied,
        IdentityClientError::Unavailable | IdentityClientError::InvalidResponse => {
            BusinessServiceError::IdentityUnavailable
        }
    }
}

fn map_repository_error(error: RepositoryError) -> BusinessServiceError {
    match error {
        RepositoryError::IdempotencyConflict => BusinessServiceError::IdempotencyConflict,
        RepositoryError::VersionConflict => BusinessServiceError::VersionConflict,
        RepositoryError::Database | RepositoryError::IncompleteAggregate => {
            BusinessServiceError::Storage
        }
    }
}

fn map_product_repository_error(error: ProductRepositoryError) -> BusinessServiceError {
    match error {
        ProductRepositoryError::BusinessNotFound => BusinessServiceError::NotFound,
        ProductRepositoryError::Database => BusinessServiceError::Storage,
    }
}

fn identity_child_key(parent: Uuid) -> Uuid {
    let mut digest = Sha256::new();
    digest.update(b"lajukan:identity-organization:v1:");
    digest.update(parent.as_bytes());
    let bytes = digest.finalize();
    let mut uuid_bytes = [0u8; 16];
    uuid_bytes.copy_from_slice(&bytes[..16]);
    uuid_bytes[6] = (uuid_bytes[6] & 0x0f) | 0x50;
    uuid_bytes[8] = (uuid_bytes[8] & 0x3f) | 0x80;
    Uuid::from_bytes(uuid_bytes)
}

fn management_organization(
    organizations: &[OrganizationSummary],
    organization_id: Uuid,
) -> Option<&OrganizationSummary> {
    organizations.iter().find(|organization| {
        organization.id == organization_id && organization.can_manage_businesses()
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn identity_child_key_is_stable_and_distinct() {
        let parent = Uuid::parse_str("3d69acb2-aed8-4c48-b62d-30034e0440eb").unwrap();

        assert_eq!(identity_child_key(parent), identity_child_key(parent));
        assert_ne!(identity_child_key(parent), parent);
    }

    #[test]
    fn business_mutation_requires_an_admin_role_for_the_owning_organization() {
        let organization_id = Uuid::new_v4();
        let organizations = vec![OrganizationSummary {
            id: organization_id,
            current_user_role: "org_member".to_owned(),
        }];

        assert!(management_organization(&organizations, organization_id).is_none());

        let organizations = vec![OrganizationSummary {
            id: organization_id,
            current_user_role: "org_admin".to_owned(),
        }];
        assert_eq!(
            management_organization(&organizations, organization_id).map(|item| item.id),
            Some(organization_id)
        );
    }
}
