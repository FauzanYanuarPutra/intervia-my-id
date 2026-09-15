mod advisor;
mod advisor_routes;
#[cfg(test)]
mod availability_persistence_tests;
pub(crate) mod control;
pub(crate) mod domain;
mod finance_core;
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
mod media;
#[cfg(test)]
mod media_migration_tests;
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
mod service;
pub(crate) mod settlement;
mod wave2;
#[cfg(test)]
mod wave2_migration_tests;
#[cfg(test)]
mod wave2_persistence_tests;
mod wave2_routes;

pub(crate) fn router() -> axum::Router<std::sync::Arc<crate::AppState>> {
    routes::router()
        .merge(governance_routes::router())
        .merge(ingredient_management_routes::router())
        .merge(inventory_routes::router())
        .merge(sales_routes::router())
        .merge(public_commerce_routes::router())
        .merge(wave2_routes::router())
        .merge(advisor_routes::router())
}
