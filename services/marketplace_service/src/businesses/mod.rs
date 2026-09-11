#[cfg(test)]
mod availability_persistence_tests;
pub(crate) mod control;
pub(crate) mod domain;
mod governance;
#[cfg(test)]
mod governance_migration_tests;
#[cfg(test)]
mod governance_tests;
mod identity_client;
mod products;
#[cfg(test)]
mod products_persistence_tests;
mod public_commerce;
mod public_commerce_routes;
#[cfg(test)]
mod public_commerce_tests;
mod repository;
mod routes;
pub(crate) mod sales;
#[cfg(test)]
mod sales_persistence_tests;
mod sales_routes;
#[cfg(test)]
mod sales_schema_tests;
mod service;
pub(crate) mod settlement;

pub(crate) fn router() -> axum::Router<std::sync::Arc<crate::AppState>> {
    routes::router()
        .merge(sales_routes::router())
        .merge(public_commerce_routes::router())
}
