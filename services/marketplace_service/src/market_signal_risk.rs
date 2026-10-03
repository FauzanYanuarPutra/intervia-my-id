use sqlx::{PgPool, Row};
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct RiskAssessment {
    pub score: i16,
    pub decision: &'static str,
    pub eligible_for_market: bool,
    pub reasons: Vec<&'static str>,
}

pub fn score_signal(
    amount_cents: Option<i64>,
    listing_price_cents: Option<i64>,
    actor_10m: i64,
    actor_content_24h: i64,
    content_10m: i64,
    same_amount_24h: i64,
    quantity: Option<f64>,
) -> RiskAssessment {
    let mut score: i16 = 0;
    let mut reasons = Vec::new();

    if actor_10m >= 20 {
        score += 45;
        reasons.push("actor_velocity_critical");
    } else if actor_10m >= 10 {
        score += 25;
        reasons.push("actor_velocity_high");
    } else if actor_10m >= 6 {
        score += 10;
        reasons.push("actor_velocity_elevated");
    }

    if actor_content_24h >= 8 {
        score += 25;
        reasons.push("same_actor_content_burst");
    } else if actor_content_24h >= 4 {
        score += 12;
        reasons.push("same_actor_content_repeat");
    }

    if content_10m >= 40 {
        score += 25;
        reasons.push("content_signal_burst");
    } else if content_10m >= 20 {
        score += 12;
        reasons.push("content_signal_elevated");
    }

    if same_amount_24h >= 5 {
        score += 20;
        reasons.push("repeated_identical_price");
    } else if same_amount_24h >= 3 {
        score += 10;
        reasons.push("repeated_price");
    }

    if let (Some(amount), Some(listing)) = (amount_cents, listing_price_cents) {
        if listing > 0 {
            let ratio = amount as f64 / listing as f64;
            if !(0.02..=50.0).contains(&ratio) {
                score += 50;
                reasons.push("extreme_price_ratio");
            } else if !(0.10..=10.0).contains(&ratio) {
                score += 12;
                reasons.push("unusual_price_ratio");
            }
        }
    }

    if quantity.is_some_and(|value| !value.is_finite() || value > 1_000_000.0) {
        score += 30;
        reasons.push("abnormal_quantity");
    }

    let score = score.min(100);
    let decision = if score >= 80 {
        "block"
    } else if score >= 50 {
        "review"
    } else {
        "allow"
    };

    RiskAssessment {
        score,
        decision,
        eligible_for_market: decision == "allow",
        reasons,
    }
}

pub async fn evaluate_signal(
    db: &PgPool,
    actor_id: Uuid,
    content_id: Uuid,
    amount_cents: Option<i64>,
    quantity: Option<f64>,
) -> Result<RiskAssessment, sqlx::Error> {
    let row = sqlx::query(
        r#"
        SELECT
          (SELECT COUNT(*) FROM market_negotiation_signals
             WHERE actor_id = $1 AND created_at >= NOW() - INTERVAL '10 minutes') AS actor_10m,
          (SELECT COUNT(*) FROM market_negotiation_signals
             WHERE actor_id = $1 AND content_id = $2 AND created_at >= NOW() - INTERVAL '24 hours') AS actor_content_24h,
          (SELECT COUNT(*) FROM market_negotiation_signals
             WHERE content_id = $2 AND created_at >= NOW() - INTERVAL '10 minutes') AS content_10m,
          (SELECT COUNT(*) FROM market_negotiation_signals
             WHERE actor_id = $1 AND content_id = $2 AND amount_cents = $3
               AND created_at >= NOW() - INTERVAL '24 hours') AS same_amount_24h,
          (SELECT price_cents FROM content_items WHERE id = $2 LIMIT 1) AS listing_price_cents
        "#,
    )
    .bind(actor_id)
    .bind(content_id)
    .bind(amount_cents)
    .fetch_one(db)
    .await?;

    Ok(score_signal(
        amount_cents,
        row.get("listing_price_cents"),
        row.get("actor_10m"),
        row.get("actor_content_24h"),
        row.get("content_10m"),
        row.get("same_amount_24h"),
        quantity,
    ))
}

#[cfg(test)]
mod tests {
    use super::score_signal;

    #[test]
    fn normal_signal_is_allowed() {
        let result = score_signal(Some(700_000), Some(750_000), 1, 1, 2, 1, None);
        assert_eq!(result.decision, "allow");
        assert!(result.eligible_for_market);
    }

    #[test]
    fn burst_is_reviewed_or_blocked() {
        let result = score_signal(Some(700_000), Some(750_000), 12, 5, 25, 4, None);
        assert!(matches!(result.decision, "review" | "block"));
        assert!(!result.eligible_for_market);
    }

    #[test]
    fn extreme_price_is_not_market_eligible() {
        let result = score_signal(Some(1), Some(1_000_000), 1, 1, 1, 1, None);
        assert!(result.score >= 50);
        assert_eq!(result.decision, "review");
        assert!(!result.eligible_for_market);
    }

    #[test]
    fn abnormal_quantity_is_not_market_eligible() {
        let result = score_signal(None, None, 1, 1, 1, 1, Some(1_000_001.0));
        assert!(result.reasons.contains(&"abnormal_quantity"));
        assert!(!result.eligible_for_market);
    }

    #[test]
    fn repeated_identical_price_adds_risk() {
        let result = score_signal(Some(700_000), Some(750_000), 1, 1, 2, 5, None);
        assert!(result.score >= 20);
        assert!(result.reasons.contains(&"repeated_identical_price"));
    }
}
