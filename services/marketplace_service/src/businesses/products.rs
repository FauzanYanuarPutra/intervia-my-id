use serde::Deserialize;

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ProductSourceType {
    Owned,
    Consignment,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum ProductStockMode {
    Manual,
    Estimated,
}

#[derive(Debug, Clone, Deserialize)]
pub(crate) struct CreateBusinessProductRequest {
    pub(crate) name: String,
    pub(crate) category: String,
    pub(crate) price_label: String,
    pub(crate) source_type: ProductSourceType,
    pub(crate) owner_label: Option<String>,
    pub(crate) stock_count: Option<f64>,
    pub(crate) stock_unit: String,
    pub(crate) min_stock_alert: Option<f64>,
    pub(crate) stock_mode: ProductStockMode,
    pub(crate) consignment_terms: Option<String>,
    pub(crate) notes: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn product_name_requires_two_trimmed_characters() {
        assert!(validate_create_request(CreateBusinessProductRequest {
            name: " a ".to_owned(),
            category: "Minuman".to_owned(),
            price_label: "Rp10.000".to_owned(),
            source_type: ProductSourceType::Owned,
            owner_label: None,
            stock_count: Some(10.0),
            stock_unit: "cup".to_owned(),
            min_stock_alert: Some(2.0),
            stock_mode: ProductStockMode::Manual,
            consignment_terms: None,
            notes: None,
        })
        .is_err());
    }

    #[test]
    fn stock_values_must_be_finite_and_non_negative() {
        for stock_count in [Some(-1.0), Some(f64::NAN), Some(f64::INFINITY)] {
            assert!(validate_create_request(CreateBusinessProductRequest {
                name: "Jus mangga".to_owned(),
                category: "Minuman".to_owned(),
                price_label: "Rp10.000".to_owned(),
                source_type: ProductSourceType::Owned,
                owner_label: None,
                stock_count,
                stock_unit: "cup".to_owned(),
                min_stock_alert: Some(2.0),
                stock_mode: ProductStockMode::Manual,
                consignment_terms: None,
                notes: None,
            })
            .is_err());
        }
    }

    #[test]
    fn stock_health_is_derived_from_canonical_numeric_state() {
        assert_eq!(stock_health(None, Some(2.0)), "perlu-cocokkan");
        assert_eq!(stock_health(Some(0.0), Some(2.0)), "habis");
        assert_eq!(stock_health(Some(1.0), Some(2.0)), "tipis");
        assert_eq!(stock_health(Some(2.0), Some(2.0)), "aman");
        assert_eq!(stock_health(Some(10.0), None), "aman");
    }
}
