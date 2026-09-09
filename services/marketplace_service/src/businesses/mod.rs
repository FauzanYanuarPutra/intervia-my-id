pub(crate) mod control;
pub(crate) mod domain;
mod identity_client;
mod products;
#[cfg(test)]
mod products_persistence_tests;
mod repository;
mod routes;
pub(crate) mod sales;
#[cfg(test)]
mod sales_schema_tests;
mod service;
pub(crate) mod settlement;

pub(crate) use routes::router;
