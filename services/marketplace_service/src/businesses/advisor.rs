use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub(crate) enum AdvisorProvider {
    Disabled,
    Ollama,
    OpenAiCompatible,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct AdvisorConfig {
    pub(crate) provider: AdvisorProvider,
    pub(crate) base_url: Option<String>,
    pub(crate) model: Option<String>,
}

impl AdvisorConfig {
    pub(crate) fn from_env() -> Self {
        Self::from_values(
            std::env::var("USAHA_ADVISOR_PROVIDER").ok().as_deref(),
            std::env::var("USAHA_ADVISOR_BASE_URL").ok().as_deref(),
            std::env::var("USAHA_ADVISOR_MODEL").ok().as_deref(),
        )
    }

    fn from_values(provider: Option<&str>, base_url: Option<&str>, model: Option<&str>) -> Self {
        let provider = match provider
            .unwrap_or("disabled")
            .trim()
            .to_ascii_lowercase()
            .as_str()
        {
            "ollama" => AdvisorProvider::Ollama,
            "openai" | "openai_compatible" | "openai-compatible" => {
                AdvisorProvider::OpenAiCompatible
            }
            _ => AdvisorProvider::Disabled,
        };
        let clean = |value: Option<&str>| {
            value
                .map(str::trim)
                .filter(|value| !value.is_empty())
                .map(str::to_owned)
        };
        Self {
            provider,
            base_url: clean(base_url),
            model: clean(model),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct AdvisorMetrics {
    pub(crate) sales_30d_amount: i64,
    pub(crate) sales_30d_count: i64,
    pub(crate) incomplete_cost_sales_30d: i64,
    pub(crate) due_14d_amount: i64,
    pub(crate) low_stock_count: i64,
    pub(crate) yield_evidence_count: i64,
}

#[derive(Debug, Clone, Serialize)]
pub(crate) struct AdvisorSummary {
    pub(crate) metrics: AdvisorMetrics,
    pub(crate) signals: Vec<String>,
    pub(crate) provider: AdvisorConfig,
    pub(crate) mode: &'static str,
}

pub(crate) fn build_advisor_summary(metrics: AdvisorMetrics) -> AdvisorSummary {
    let mut signals = Vec::new();

    if metrics.incomplete_cost_sales_30d > 0 {
        signals.push(format!(
            "Ada {} penjualan 30 hari terakhir yang modal produknya belum lengkap. Lengkapi HPP saat datanya tersedia agar laba tidak ditebak.",
            metrics.incomplete_cost_sales_30d
        ));
    }
    if metrics.due_14d_amount > 0 {
        signals.push(format!(
            "Ada kewajiban Rp{} yang jatuh tempo dalam 14 hari. Lindungi dana ini sebelum mengambil uang untuk kebutuhan lain.",
            metrics.due_14d_amount
        ));
    }
    if metrics.low_stock_count > 0 {
        signals.push(format!(
            "Ada {} bahan dengan stok di atau di bawah batas minimum. Prioritaskan pengecekan fisik dan belanja yang benar-benar diperlukan.",
            metrics.low_stock_count
        ));
    }
    if metrics.yield_evidence_count == 0 {
        signals.push(
            "Belum ada observasi hasil nyata bahan. Catat beberapa produksi nyata sebelum memakai yield sebagai dasar keputusan.".into(),
        );
    }
    if metrics.sales_30d_count == 0 {
        signals.push(
            "Belum ada penjualan 30 hari terakhir pada ledger canonical. Fokuskan dulu pada pencatatan Kasir yang konsisten.".into(),
        );
    }
    if signals.is_empty() {
        signals.push(
            "Tidak ada sinyal mendesak dari data deterministic saat ini. Pertahankan pencatatan penjualan, stok, dan tagihan secara konsisten.".into(),
        );
    }

    AdvisorSummary {
        metrics,
        signals,
        provider: AdvisorConfig::from_env(),
        mode: "read_only_deterministic",
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn provider_boundary_defaults_to_disabled_and_supports_future_adapters() {
        assert_eq!(
            AdvisorConfig::from_values(None, None, None).provider,
            AdvisorProvider::Disabled
        );
        assert_eq!(
            AdvisorConfig::from_values(Some("ollama"), Some("http://ollama:11434"), Some("qwen"))
                .provider,
            AdvisorProvider::Ollama
        );
        assert_eq!(
            AdvisorConfig::from_values(
                Some("openai-compatible"),
                Some("http://gateway"),
                Some("model")
            )
            .provider,
            AdvisorProvider::OpenAiCompatible
        );
    }

    #[test]
    fn advisor_is_explainable_and_does_not_invent_profit() {
        let summary = build_advisor_summary(AdvisorMetrics {
            sales_30d_amount: 500_000,
            sales_30d_count: 12,
            incomplete_cost_sales_30d: 3,
            due_14d_amount: 200_000,
            low_stock_count: 2,
            yield_evidence_count: 0,
        });

        assert_eq!(summary.mode, "read_only_deterministic");
        assert!(summary
            .signals
            .iter()
            .any(|item| item.contains("modal produknya belum lengkap")));
        assert!(summary
            .signals
            .iter()
            .any(|item| item.contains("jatuh tempo")));
        assert!(summary.signals.iter().any(|item| item.contains("stok")));
        assert!(!summary
            .signals
            .iter()
            .any(|item| item.contains("laba bersih")));
    }
}
