// src/lib.rs

pub mod backoffice;
pub mod config;
pub mod db;
pub mod organizations;
pub mod routes;

pub use config::{AppState, Config};
