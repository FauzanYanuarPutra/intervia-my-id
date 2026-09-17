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

    pub(crate) fn can_manage_business_profile(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin" | "org_manager" | "manager"
        )
    }

    pub(crate) fn can_manage_catalog(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin" | "org_manager" | "manager"
        )
    }

    pub(crate) fn can_record_sales(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin" | "org_manager" | "manager" | "org_cashier" | "cashier"
        )
    }

    pub(crate) fn can_view_sales(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin"
                | "org_manager"
                | "manager"
                | "org_cashier"
                | "cashier"
                | "org_accounting"
                | "org_viewer"
                | "viewer"
        )
    }

    pub(crate) fn can_view_sale_costs(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin" | "org_manager" | "manager"
        )
    }

    /// Access to detailed ingredient/control records, including supplier/cost fields.
    /// Product stock visible to cashiers/viewers comes from the safe business aggregate instead.
    pub(crate) fn can_view_inventory_controls(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin" | "org_manager" | "manager" | "org_inventory"
        )
    }

    pub(crate) fn can_manage_finance_controls(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin" | "org_manager" | "manager" | "org_accounting"
        )
    }

    pub(crate) fn can_view_finance_controls(&self) -> bool {
        self.can_manage_finance_controls()
    }

    pub(crate) fn can_manage_inventory_controls(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin" | "org_manager" | "manager" | "org_inventory"
        )
    }

    pub(crate) fn can_manage_channels(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin" | "org_manager" | "manager"
        )
    }

    pub(crate) fn can_manage_cash_shifts(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin" | "org_manager" | "manager" | "org_cashier" | "cashier"
        )
    }

    pub(crate) fn can_record_purchases(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin" | "org_manager" | "manager"
        )
    }

    pub(crate) fn can_use_business_advisor(&self) -> bool {
        matches!(
            self.current_user_role.as_str(),
            "org_admin" | "org_manager" | "manager" | "org_accounting"
        )
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

    fn organization(role: &str) -> OrganizationSummary {
        OrganizationSummary {
            id: Uuid::new_v4(),
            current_user_role: role.to_owned(),
        }
    }

    #[test]
    fn organization_list_parses_identity_public_role_values() {
        let body = r#"{"data":{"count":3,"items":[{"id":"76b836f4-3032-433f-8ac7-04a88f1a8511","current_user_role":"manager"},{"id":"86b836f4-3032-433f-8ac7-04a88f1a8511","current_user_role":"cashier"},{"id":"96b836f4-3032-433f-8ac7-04a88f1a8511","current_user_role":"viewer"}]}}"#;
        let organizations = parse_organization_list(body).expect("identity response");

        assert_eq!(organizations.len(), 3);
        assert!(organizations[0].can_manage_catalog());
        assert!(organizations[1].can_record_sales());
        assert!(organizations[1].can_manage_cash_shifts());
        assert!(organizations[2].can_view_sales());
        assert!(!organizations[2].can_record_sales());
    }

    #[test]
    fn organization_level_business_creation_stays_admin_only() {
        assert!(!organization("org_member").can_manage_businesses());
        assert!(!organization("manager").can_manage_businesses());
        assert!(organization("org_admin").can_manage_businesses());
    }

    #[test]
    fn profile_and_catalog_management_allow_admin_and_manager_only() {
        for role in ["org_admin", "org_manager", "manager"] {
            assert!(organization(role).can_manage_business_profile());
            assert!(organization(role).can_manage_catalog());
        }
        for role in ["cashier", "org_inventory", "org_accounting", "viewer"] {
            assert!(!organization(role).can_manage_business_profile());
            assert!(!organization(role).can_manage_catalog());
        }
    }

    #[test]
    fn sales_recording_allows_admin_manager_and_cashier_only() {
        for role in [
            "org_admin",
            "org_manager",
            "manager",
            "org_cashier",
            "cashier",
        ] {
            assert!(organization(role).can_record_sales());
        }
        assert!(!organization("org_inventory").can_record_sales());
        assert!(!organization("org_accounting").can_record_sales());
        assert!(!organization("viewer").can_record_sales());
    }

    #[test]
    fn sales_history_read_allows_viewer_and_accounting_without_granting_write() {
        for role in [
            "org_admin",
            "manager",
            "cashier",
            "org_accounting",
            "viewer",
        ] {
            assert!(organization(role).can_view_sales());
        }
        assert!(!organization("org_inventory").can_view_sales());
        assert!(!organization("viewer").can_record_sales());
        assert!(!organization("org_accounting").can_record_sales());
    }

    #[test]
    fn sales_cost_visibility_excludes_cashiers_and_viewers() {
        assert!(organization("org_admin").can_view_sale_costs());
        assert!(organization("manager").can_view_sale_costs());
        assert!(!organization("cashier").can_view_sale_costs());
        assert!(!organization("viewer").can_view_sale_costs());
    }

    #[test]
    fn detailed_inventory_control_access_does_not_leak_costs_to_cashier_or_viewer() {
        for role in ["org_admin", "manager", "org_inventory"] {
            assert!(organization(role).can_view_inventory_controls());
        }
        for role in ["cashier", "viewer", "org_accounting"] {
            assert!(!organization(role).can_view_inventory_controls());
        }
    }

    #[test]
    fn finance_controls_allow_accounting_but_not_cashier_or_inventory() {
        for role in ["org_admin", "manager", "org_accounting"] {
            assert!(organization(role).can_manage_finance_controls());
            assert!(organization(role).can_view_finance_controls());
        }
        assert!(!organization("cashier").can_manage_finance_controls());
        assert!(!organization("org_inventory").can_manage_finance_controls());
        assert!(!organization("viewer").can_manage_finance_controls());
    }

    #[test]
    fn inventory_controls_allow_inventory_role_but_not_cashier_or_accounting() {
        assert!(organization("org_admin").can_manage_inventory_controls());
        assert!(organization("manager").can_manage_inventory_controls());
        assert!(organization("org_inventory").can_manage_inventory_controls());
        assert!(!organization("cashier").can_manage_inventory_controls());
        assert!(!organization("org_accounting").can_manage_inventory_controls());
        assert!(!organization("viewer").can_manage_inventory_controls());
    }

    #[test]
    fn channel_management_excludes_cashier_viewer_inventory_and_accounting() {
        assert!(organization("org_admin").can_manage_channels());
        assert!(organization("manager").can_manage_channels());
        assert!(!organization("cashier").can_manage_channels());
        assert!(!organization("viewer").can_manage_channels());
        assert!(!organization("org_inventory").can_manage_channels());
        assert!(!organization("org_accounting").can_manage_channels());
    }

    #[test]
    fn cash_shift_controls_allow_cashier_but_not_inventory_accounting_or_viewer() {
        assert!(organization("org_admin").can_manage_cash_shifts());
        assert!(organization("manager").can_manage_cash_shifts());
        assert!(organization("cashier").can_manage_cash_shifts());
        assert!(!organization("org_inventory").can_manage_cash_shifts());
        assert!(!organization("org_accounting").can_manage_cash_shifts());
        assert!(!organization("viewer").can_manage_cash_shifts());
    }

    #[test]
    fn purchase_controls_require_a_role_that_can_change_money_and_stock_together() {
        assert!(organization("org_admin").can_record_purchases());
        assert!(organization("manager").can_record_purchases());
        assert!(!organization("cashier").can_record_purchases());
        assert!(!organization("org_inventory").can_record_purchases());
        assert!(!organization("org_accounting").can_record_purchases());
        assert!(!organization("viewer").can_record_purchases());
    }

    #[test]
    fn advisor_access_is_kept_to_business_decision_roles() {
        assert!(organization("org_admin").can_use_business_advisor());
        assert!(organization("manager").can_use_business_advisor());
        assert!(organization("org_accounting").can_use_business_advisor());
        assert!(!organization("cashier").can_use_business_advisor());
        assert!(!organization("org_inventory").can_use_business_advisor());
        assert!(!organization("viewer").can_use_business_advisor());
    }
}
