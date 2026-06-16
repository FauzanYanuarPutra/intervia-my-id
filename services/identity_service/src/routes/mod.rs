// src/routes/mod.rs

pub mod auth;
pub mod health;
pub mod info;
pub mod user_lookup;
pub mod users;
pub mod verification;

pub use auth::{
    change_password, login, login_phone, logout, me, oauth_google, refresh_token, register,
    reset_password,
};
pub use health::health_check;
pub use info::app_info;
pub use user_lookup::{
    discover_users, get_public_user_profile, get_user_by_email, get_user_by_phone,
};
pub use users::{
    delete_me_account, get_me_profile, get_user_detail, list_users, update_me_profile,
};
