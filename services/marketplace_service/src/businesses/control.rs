use super::audit;
use chrono::{DateTime, NaiveDate, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sqlx::{FromRow, PgPool};
use uuid::Uuid;

const MAX_NAME_LEN: usize = 160;
const MAX_UNIT_LEN: usize = 40;
const MAX_NOTE_LEN: usize = 2_000;
const MAX_CHANNEL_KEY_LEN: usize = 80;

#[derive(Debug)]
pub(crate) enum ControlRepositoryError {
    NotFound,
    Validation(&'static str),
    Database,
}

impl From<sqlx::Error> for ControlRepositoryError {