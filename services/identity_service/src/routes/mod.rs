// src/routes/mod.rs

pub mod auth;
pub mod governance;
pub mod health;
pub mod info;
mod proofs;
pub mod user_lookup;
pub mod users;
pub mod verification;

pub use auth::{
    change_password, login, login_phone, logout, me, oauth_google, refresh_token, register,
    reset_password,
};
pub use governance::{
    cancel_my_privacy_request, create_privacy_request, create_security_incident,
    list_my_privacy_requests, list_privacy_requests, list_security_incidents,
    transition_privacy_request, transition_security_incident,
};
pub use health::{health_check, ready_check, service_metrics};
pub use info::app_info;
pub use user_lookup::{
    discover_users, get_public_user_profile, get_user_by_email, get_user_by_phone,
};
pub use users::{
    create_backoffice_invitation, delete_me_account, get_me_profile, get_user_detail,
    list_backoffice_google_access, list_backoffice_invitations, list_my_backoffice_invitations,
    list_users, moderate_user, respond_backoffice_invitation, revoke_backoffice_invitation,
    search_backoffice_candidates, update_me_profile, upsert_backoffice_google_access,
};
