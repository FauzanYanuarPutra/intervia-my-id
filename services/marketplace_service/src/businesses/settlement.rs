#[cfg(test)]
mod tests {
    use super::*;
    use chrono::NaiveDate;

    fn request() -> CreateSettlementRequest {
        CreateSettlementRequest {
            channel_key: "shopeefood".to_owned(),
            period_start: NaiveDate::from_ymd_opt(2026, 9, 5).unwrap(),
            period_end: NaiveDate::from_ymd_opt(2026, 9, 5).unwrap(),
            gross_sales_amount: 782_000,
            platform_fee_amount: 128_500,
            merchant_promo_amount: 42_000,
            refunds_amount: 0,
            other_deductions_amount: 0,
            actual_transfer_amount: 611_500,
            note: "Settlement harian".to_owned(),
        }
    }

    #[test]
    fn settlement_validation_accepts_a_matched_transfer() {
        let validated = validate_settlement(&request()).expect("valid settlement");
        assert_eq!(validated.expected_transfer_amount, 611_500);
        assert_eq!(validated.difference_amount, 0);
        assert_eq!(validated.status, "matched");
    }

    #[test]
    fn settlement_validation_marks_short_and_excess_transfers() {
        let mut short = request();
        short.actual_transfer_amount = 600_000;
        let short = validate_settlement(&short).expect("short settlement");
        assert_eq!(short.difference_amount, -11_500);
        assert_eq!(short.status, "short");

        let mut excess = request();
        excess.actual_transfer_amount = 620_000;
        let excess = validate_settlement(&excess).expect("excess settlement");
        assert_eq!(excess.difference_amount, 8_500);
        assert_eq!(excess.status, "excess");
    }

    #[test]
    fn settlement_validation_rejects_invalid_dates_and_amounts() {
        let mut invalid = request();
        invalid.period_end = NaiveDate::from_ymd_opt(2026, 9, 4).unwrap();
        assert!(matches!(
            validate_settlement(&invalid),
            Err(SettlementValidationError::InvalidPeriod)
        ));

        let mut invalid = request();
        invalid.platform_fee_amount = -1;
        assert!(matches!(
            validate_settlement(&invalid),
            Err(SettlementValidationError::NegativeAmount)
        ));

        let mut invalid = request();
        invalid.gross_sales_amount = 100_000;
        invalid.platform_fee_amount = 80_000;
        invalid.merchant_promo_amount = 30_000;
        assert!(matches!(
            validate_settlement(&invalid),
            Err(SettlementValidationError::DeductionsExceedGrossSales)
        ));
    }
}
