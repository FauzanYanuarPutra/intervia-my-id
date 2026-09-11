use std::sync::Arc;

use axum::{routing::post, Router};

use crate::AppState;

use super::public_commerce::create_public_product_order;

pub(crate) fn router() -> Router<Arc<AppState>> {
    Router::new().route(
        "/v1/public/commerce/orders",
        post(create_public_product_order),
    )
}
