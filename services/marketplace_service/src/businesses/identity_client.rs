use reqwest::{header, Client, StatusCode};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct OrganizationSummary {
    pub(crate) id: Uuid,
    pub(crate) current_user_role: String,
}

impl OrganizationSummary {
    pub(crate) fn can_manage_businesses(&self) -> bool {
        self.current_user_role == "org_admin"
    }
}

#[derive(Debug)]
pub(crate) enum IdentityClientError {
    AccessDenied,
    Unavailable,
    InvalidResponse,
}

#[derive(Clone)]
pub(crate) struct IdentityClient {
    client: Client,
    base_url: String,
}

impl IdentityClient {
    pub(crate) fn new(client: Client, base_url: String) -> Self {
        Self {
            client,
            base_url: base_url.trim_end_matches('/').to_owned(),
        }
    }

    pub(crate) async fn list_organizations(
        &self,
        authorization: &str,
    ) -> Result<Vec<OrganizationSummary>, IdentityClientError> {
        let response = self
            .client
            .get(format!("{}/organizations", self.base_url))
            .header(header::AUTHORIZATION, authorization)
            .send()
            .await
            .map_err(|_| IdentityClientError::Unavailable)?;
        match response.status() {
            status if status.is_success() => {
                let body = response
                    .text()
                    .await
                    .map_err(|_| IdentityClientError::InvalidResponse)?;
                parse_organization_list(&body)
            }
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                Err(IdentityClientError::AccessDenied)
            }
            _ => Err(IdentityClientError::Unavailable),
        }
    }

    pub(crate) async fn ensure_organization(
        &self,
        authorization: &str,
        idempotency_key: Uuid,
        name: &str,
    ) -> Result<OrganizationSummary, IdentityClientError> {
        let response = self
            .client
            .post(format!("{}/organizations/ensure", self.base_url))
            .header(header::AUTHORIZATION, authorization)
            .header("idempotency-key", idempotency_key.to_string())
            .json(&EnsureOrganizationBody { name })
            .send()
            .await
            .map_err(|_| IdentityClientError::Unavailable)?;
        match response.status() {
            status if status.is_success() => response
                .json::<OrganizationEnvelope>()
                .await
                .map(|envelope| envelope.data.organization)
                .map_err(|_| IdentityClientError::InvalidResponse),
            StatusCode::UNAUTHORIZED | StatusCode::FORBIDDEN => {
                Err(IdentityClientError::AccessDenied)
            }
            _ => Err(IdentityClientError::Unavailable),
        }
    }
}

#[derive(Serialize)]
struct EnsureOrganizationBody<'a> {
    name: &'a str,
}

#[derive(Deserialize)]
struct OrganizationListEnvelope {
    data: OrganizationListData,
}

#[derive(Deserialize)]
struct OrganizationListData {
    items: Vec<OrganizationSummary>,
}

#[derive(Deserialize)]
struct OrganizationEnvelope {
    data: OrganizationData,
}

#[derive(Deserialize)]
struct OrganizationData {
    organization: OrganizationSummary,
}

fn parse_organization_list(body: &str) -> Result<Vec<OrganizationSummary>, IdentityClientError> {
    serde_json::from_str::<OrganizationListEnvelope>(body)
        .map(|envelope| envelope.data.items)
        .map_err(|_| IdentityClientError::InvalidResponse)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn organization_list_parses_the_identity_envelope() {
        let body = r#"{"data":{"count":1,"items":[{"id":"76b836f4-3032-433f-8ac7-04a88f1a8511","name":"Cuk","slug":"cuk","owner_user_id":"44444444-4444-4444-8444-444444444444","current_user_role":"org_admin"}]}}"#;
        let organizations = parse_organization_list(body).expect("identity response");

        assert_eq!(organizations.len(), 1);
        assert_eq!(
            organizations[0].id,
            Uuid::parse_str("76b836f4-3032-433f-8ac7-04a88f1a8511").unwrap()
        );
        assert_eq!(organizations[0].current_user_role, "org_admin");
        assert!(organizations[0].can_manage_businesses());
    }

    #[test]
    fn ordinary_organization_members_cannot_mutate_businesses() {
        let member = OrganizationSummary {
            id: Uuid::new_v4(),
            current_user_role: "org_member".to_owned(),
        };

        assert!(!member.can_manage_businesses());
    }
}
