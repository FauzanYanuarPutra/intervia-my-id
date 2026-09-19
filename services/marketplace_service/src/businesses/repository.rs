use super::domain::{
    store_slug, BusinessAggregate, BusinessLocation, BusinessRecord, BusinessStore,
    ValidatedBusinessProfileUpdate, ValidatedProvisionCommand,
};
use super::products::{ProductRepository, ProductRepositoryError};
use super::profile::{BusinessCapabilityRecord, BusinessProfileRecord, ResolvedBusinessProfile};
use super::audit;
use chrono::{DateTime, Utc};
use serde_json::json;
use sha2::Digest;
use sqlx::{FromRow, PgPool, Postgres, Transaction};
use uuid::Uuid;

#[derive(Debug)]
pub(crate) enum RepositoryError {
    Database,
    IdempotencyConflict,
    VersionConflict,
    IncompleteAggregate,
}
