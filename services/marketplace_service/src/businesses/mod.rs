mod advisor;
mod audit;
mod advisor_routes;
#[cfg(test)]
mod availability_persistence_tests;
mod commercial_core;
mod commercial_core_routes;
pub(crate) mod control;
mod counterparty;
mod document_routes;
mod documents;
#[cfg(test)]
mod documents_persistence_tests;
pub(crate) mod domain;
mod event_outbox;
mod execution_policy;
mod finance_core;
mod finance_core_routes;
#[cfg(test)]
mod finance_core_tests;
#[cfg(test)]
mod finance_semantics_tests;
mod governance;
#[cfg(test)]
mod governance_migration_tests;
mod governance_routes;
#[cfg(test)]
mod governance_tests;
mod identity_client;
mod ingredient_management;
#[cfg(test)]
mod ingredient_management_persistence_tests;
mod ingredient_management_routes;
mod inventory;
#[cfg(test)]
mod inventory_persistence_tests;
mod inventory_routes;
#[cfg(test)]
mod inventory_routes_tests;
#[cfg(test)]
mod inventory_tests;
pub(crate) mod kernel;
mod media;
#[cfg(test)]
mod media_migration_tests;
#[cfg(test)]
mod modifier_recipe_effect_tests;
mod modifier_resolution;
mod period_control;
mod period_control_routes;
mod product_modifiers;
mod products;
#[cfg(test)]
mod products_persistence_tests;
pub(crate) mod profile;
#[cfg(test)]
mod profile_migration_tests;
#[cfg(test)]
mod profile_persistence_tests;
mod public_commerce;
mod public_commerce_routes;
#[cfg(test)]
mod public_commerce_tests;
#[cfg(test)]
mod recipe_sales_versioning_tests;
#[cfg(test)]
mod recipe_versioning_persistence_tests;
mod recipes;
mod repository;
mod routes;
pub(crate) mod sales;
#[cfg(test)]
mod sales_incomplete_cost_persistence_tests;
#[cfg(test)]
mod sales_persistence_tests;
mod sales_routes;
#[cfg(test)]
mod sales_schema_tests;
mod seller_orders;
#[cfg(test)]
mod seller_orders_persistence_tests;
mod service;
pub(crate) mod settlement;
mod stock_reservations;
mod stock_transfer;
mod stock_transfer_routes;
pub(crate) mod transactions;
mod wave2;
#[cfg(test)]
mod wave2_migration_tests;
#[cfg(test)]
mod wave2_persistence_tests;
mod wave2_routes;
mod work;
mod work_routes;

pub(crate) fn router() -> axum::Router<std::sync::Arc<crate::AppState>> {
    routes::router()
        .merge(product_modifiers::router())
        .merge(commercial_core_routes::router())
        .merge(document_routes::router())
        .merge(finance_core_routes::router())
        .merge(governance_routes::router())
        .merge(ingredient_management_routes::router())
        .merge(inventory_routes::router())
        .merge(period_control_routes::router())
        .merge(stock_transfer_routes::router())
        .merge(sales_routes::router())
        .merge(public_commerce_routes::router())
        .merge(wave2_routes::router())
        .merge(work_routes::router())
        .merge(advisor_routes::router())
}
