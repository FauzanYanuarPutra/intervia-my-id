use chrono::{DateTime, Duration, Utc};
use rust_decimal::Decimal;
use sqlx::{FromRow, Postgres, Transaction};
use uuid::Uuid;

const PUBLIC_ORDER_STOCK_HOLD_MINUTES: i64 = 30;

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum StockReservationError {
    InsufficientStock,
    Database,
}

impl From<sqlx::Error> for StockReservationError {
    fn from(_: sqlx::Error) -> Self {
        Self::Database
    }
}

#[derive(Debug, Clone, Copy)]
pub(crate) struct StockReservationSummary {
    pub(crate) count: usize,
    pub(crate) expires_at: Option<DateTime<Utc>>,
}

#[derive(Debug, Clone, FromRow)]
struct ReservationRow {
    product_id: Uuid,
    quantity: Decimal,
}

pub(crate) async fn reserve_for_order_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
    requested_quantities: &[(Uuid, Decimal)],
) -> Result<StockReservationSummary, StockReservationError> {
    let mut quantities = requested_quantities.to_vec();
    quantities.sort_by_key(|(product_id, _)| product_id.as_u128());

    let expires_at = Utc::now() + Duration::minutes(PUBLIC_ORDER_STOCK_HOLD_MINUTES);
    let mut reservation_count = 0usize;

    for (product_id, requested) in quantities {
        if requested <= Decimal::ZERO {
            return Err(StockReservationError::Database);
        }

        let stock_count = sqlx::query_scalar::<_, Option<Decimal>>(
            r#"
            SELECT stock_count::numeric
            FROM business_inventory
            WHERE product_id=$1
              AND business_id=$2
              AND organization_id=$3
            FOR UPDATE
            "#,
        )
        .bind(product_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut **tx)
        .await?;

        let Some(Some(stock_count)) = stock_count else {
            // NULL/untracked stock preserves the historical unlimited/unknown-stock behavior.
            continue;
        };

        let active_reserved = sqlx::query_scalar::<_, Decimal>(
            r#"
            SELECT COALESCE(SUM(quantity), 0::numeric)
            FROM business_order_stock_reservations
            WHERE business_id=$1
              AND organization_id=$2
              AND product_id=$3
              AND state='reserved'
              AND expires_at > NOW()
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(product_id)
        .fetch_one(&mut **tx)
        .await?;

        let available = stock_count
            .checked_sub(active_reserved)
            .ok_or(StockReservationError::Database)?;
        if available < requested {
            return Err(StockReservationError::InsufficientStock);
        }

        sqlx::query(
            r#"
            INSERT INTO business_order_stock_reservations (
              organization_id,
              business_id,
              order_id,
              product_id,
              quantity,
              expires_at
            ) VALUES ($1,$2,$3,$4,$5,$6)
            "#,
        )
        .bind(organization_id)
        .bind(business_id)
        .bind(order_id)
        .bind(product_id)
        .bind(requested)
        .bind(expires_at)
        .execute(&mut **tx)
        .await?;
        reservation_count += 1;
    }

    Ok(StockReservationSummary {
        count: reservation_count,
        expires_at: (reservation_count > 0).then_some(expires_at),
    })
}

pub(crate) async fn release_for_order_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<u64, StockReservationError> {
    let result = sqlx::query(
        r#"
        UPDATE business_order_stock_reservations
        SET
          state='released',
          released_at=NOW(),
          updated_at=NOW()
        WHERE order_id=$1
          AND business_id=$2
          AND organization_id=$3
          AND state='reserved'
        "#,
    )
    .bind(order_id)
    .bind(business_id)
    .bind(organization_id)
    .execute(&mut **tx)
    .await?;
    Ok(result.rows_affected())
}

pub(crate) async fn consume_for_order_tx(
    tx: &mut Transaction<'_, Postgres>,
    order_id: Uuid,
    business_id: Uuid,
    organization_id: Uuid,
) -> Result<u64, StockReservationError> {
    let reservations = sqlx::query_as::<_, ReservationRow>(
        r#"
        SELECT product_id, quantity
        FROM business_order_stock_reservations
        WHERE order_id=$1
          AND business_id=$2
          AND organization_id=$3
          AND state='reserved'
        ORDER BY product_id
        FOR UPDATE
        "#,
    )
    .bind(order_id)
    .bind(business_id)
    .bind(organization_id)
    .fetch_all(&mut **tx)
    .await?;

    let mut consumed = 0u64;
    for reservation in reservations {
        let stock_count = sqlx::query_scalar::<_, Option<Decimal>>(
            r#"
            SELECT stock_count::numeric
            FROM business_inventory
            WHERE product_id=$1
              AND business_id=$2
              AND organization_id=$3
            FOR UPDATE
            "#,
        )
        .bind(reservation.product_id)
        .bind(business_id)
        .bind(organization_id)
        .fetch_optional(&mut **tx)
        .await?;

        let Some(Some(stock_count)) = stock_count else {
            return Err(StockReservationError::InsufficientStock);
        };

        let other_active_reserved = sqlx::query_scalar::<_, Decimal>(
            r#"
            SELECT COALESCE(SUM(quantity), 0::numeric)
            FROM business_order_stock_reservations
            WHERE business_id=$1
              AND organization_id=$2
              AND product_id=$3
              AND order_id <> $4
              AND state='reserved'
              AND expires_at > NOW()
            "#,
        )
        .bind(business_id)
        .bind(organization_id)
        .bind(reservation.product_id)
        .bind(order_id)
        .fetch_one(&mut **tx)
        .await?;

        let required = reservation
            .quantity
            .checked_add(other_active_reserved)
            .ok_or(StockReservationError::Database)?;
        if stock_count < required {
            return Err(StockReservationError::InsufficientStock);
        }

        let stock_after = stock_count
            .checked_sub(reservation.quantity)
            .ok_or(StockReservationError::Database)?;

        let updated = sqlx::query(
            r#"
            UPDATE business_inventory
            SET
              stock_count=($4::numeric)::double precision,
              updated_at=NOW()
            WHERE product_id=$1
              AND business_id=$2
              AND organization_id=$3
            "#,
        )
        .bind(reservation.product_id)
        .bind(business_id)
        .bind(organization_id)
        .bind(stock_after)
        .execute(&mut **tx)
        .await?;
        if updated.rows_affected() != 1 {
            return Err(StockReservationError::Database);
        }

        sqlx::query(
            r#"
            UPDATE umkm_products
            SET
              stock_qty=GREATEST(0, FLOOR($2::numeric))::integer,
              is_available=CASE WHEN $2::numeric <= 0 THEN FALSE ELSE is_available END,
              updated_at=NOW()
            WHERE id=$1
            "#,
        )
        .bind(reservation.product_id)
        .bind(stock_after)
        .execute(&mut **tx)
        .await?;

        let updated = sqlx::query(
            r#"
            UPDATE business_order_stock_reservations
            SET
              state='consumed',
              consumed_at=NOW(),
              updated_at=NOW()
            WHERE order_id=$1
              AND product_id=$2
              AND business_id=$3
              AND organization_id=$4
              AND state='reserved'
            "#,
        )
        .bind(order_id)
        .bind(reservation.product_id)
        .bind(business_id)
        .bind(organization_id)
        .execute(&mut **tx)
        .await?;
        if updated.rows_affected() != 1 {
            return Err(StockReservationError::Database);
        }
        consumed += 1;
    }

    Ok(consumed)
}

#[cfg(test)]
mod tests {
    use super::*;

    const _: () = {
        assert!(PUBLIC_ORDER_STOCK_HOLD_MINUTES > 0);
        assert!(PUBLIC_ORDER_STOCK_HOLD_MINUTES <= 60);
    };
}
