pub(crate) mod control;
pub(crate) mod domain;
mod identity_client;
mod products;
#[cfg(test)]
mod products_persistence_tests;
mod repository;
mod routes;
mod service;

pub(crate) use routes::router;
