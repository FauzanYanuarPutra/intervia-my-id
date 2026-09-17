#![cfg_attr(not(test), allow(dead_code))]

use chrono::{DateTime, FixedOffset, NaiveDate, Utc};

use super::KernelValidationError;

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct BusinessDateContext {
    timezone_name: String,
    offset: FixedOffset,
}

impl BusinessDateContext {
    pub(crate) fn new(timezone_name: &str) -> Result<Self, KernelValidationError> {
        let normalized = timezone_name.trim();
        let offset_seconds = match normalized {
            "UTC" => 0,
            "Asia/Jakarta" => 7 * 60 * 60,
            "Asia/Makassar" => 8 * 60 * 60,
            "Asia/Jayapura" => 9 * 60 * 60,
            _ => return Err(KernelValidationError::InvalidTimezone),
        };
        let offset =
            FixedOffset::east_opt(offset_seconds).ok_or(KernelValidationError::InvalidTimezone)?;

        Ok(Self {
            timezone_name: normalized.to_owned(),
            offset,
        })
    }

    pub(crate) fn timezone_name(&self) -> &str {
        &self.timezone_name
    }

    pub(crate) fn local_date(&self, timestamp: DateTime<Utc>) -> NaiveDate {
        timestamp.with_timezone(&self.offset).date_naive()
    }
}
