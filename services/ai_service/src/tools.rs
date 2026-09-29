use crate::intent::MarketplaceIntent;
use reqwest::{Client, Url};
use serde::Serialize;
use serde_json::Value;
use std::time::Duration;

#[derive(Clone)]
pub struct ToolRegistryConfig {
    pub marketplace_url: String,
    pub service_token: String,
    pub timeout_ms: u64,
    pub max_results: usize,
}

#[derive(Clone)]
pub struct ToolRegistry {
    http: Client,
    config: ToolRegistryConfig,
}

#[derive(Debug, Clone, Serialize)]
pub struct ToolCallTrace {
    pub name: String,
    pub status: String,
    pub result_count: usize,
    pub query: String,
    pub side: String,
    pub category: String,
    pub location: String,
}

#[derive(Debug, Clone)]
pub struct ToolSource {
    pub id: String,
    pub title: String,
    pub content: String,
    pub url: String,
    pub kind: String,
}

#[derive(Debug, Clone, Default)]
pub struct ToolExecution {
    pub sources: Vec<ToolSource>,
    pub traces: Vec<ToolCallTrace>,
}

impl ToolRegistry {
    pub fn new(config: ToolRegistryConfig) -> Self {
        let http = Client::builder()
            .connect_timeout(Duration::from_millis((config.timeout_ms / 3).max(500)))
            .timeout(Duration::from_millis(config.timeout_ms.max(1_000)))
            .build()
            .expect("failed to build AI tool registry HTTP client");

        Self { http, config }
    }

    pub fn configured(&self) -> bool {
        !self.config.marketplace_url.is_empty()
    }

    pub async fn execute_marketplace_search(
        &self,
        intent: &MarketplaceIntent,
    ) -> Result<ToolExecution, String> {
        if !self.configured() || !intent.should_search {
            return Ok(ToolExecution::default());
        }

        let mut url = Url::parse(&format!(
            "{}/v1/content",
            self.config.marketplace_url.trim_end_matches('/')
        ))
        .map_err(|error| format!("invalid_marketplace_url: {}", error))?;

        {
            let mut query = url.query_pairs_mut();
            let search_query = if intent.search_query.trim().is_empty() {
                intent.normalized_query.trim()
            } else {
                intent.search_query.trim()
            };
            if !search_query.is_empty() {
                query.append_pair("q", search_query);
            }
            query.append_pair("marketplace_only", "true");
            query.append_pair("status", "active");
            query.append_pair("limit", &self.config.max_results.clamp(1, 30).to_string());
            if intent.side.as_str() != "unknown" {
                query.append_pair("side", intent.side.as_str());
            }
            if intent.category != "unknown" {
                query.append_pair("category", &intent.category);
            }
            if !intent.location.is_empty() {
                query.append_pair("location", &intent.location);
            }
        }

        let mut request = self
            .http
            .get(url)
            .header("accept", "application/json")
            .header("x-lajukan-ai-tool", "1");

        if !self.config.service_token.is_empty() {
            request = request.bearer_auth(&self.config.service_token);
        }

        let response = request
            .send()
            .await
            .map_err(|error| format!("marketplace_network: {}", error))?;
        let status = response.status();
        let payload = response
            .json::<Value>()
            .await
            .map_err(|error| format!("marketplace_invalid_json: {}", error))?;

        if !status.is_success() {
            return Err(format!("marketplace_http_{}", status.as_u16()));
        }

        let items = payload
            .get("items")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default();

        let mut sources = Vec::new();
        for item in items.iter().take(self.config.max_results.clamp(1, 30)) {
            let id = item
                .get("id")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_string();
            let title = item
                .get("title")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_string();
            if id.is_empty() || title.is_empty() {
                continue;
            }

            let metadata = item.get("metadata");
            let market_side = metadata
                .and_then(|value| value.get("market_side"))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim()
                .to_ascii_lowercase();
            if market_side == "reference" {
                continue;
            }

            let summary = item
                .get("summary")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim();
            let category = item
                .get("category")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim();
            let content_type = item
                .get("content_type")
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim();
            let location = metadata
                .and_then(|value| value.get("location").or_else(|| value.get("city")))
                .and_then(Value::as_str)
                .unwrap_or_default()
                .trim();
            let price = item
                .get("price_cents")
                .and_then(Value::as_i64)
                .map(|cents| format!("Rp{}", cents / 100))
                .unwrap_or_else(|| "Harga belum dicantumkan".to_string());
            let side = metadata
                .and_then(|value| {
                    value
                        .get("side")
                        .or_else(|| value.get("listing_side"))
                        .or_else(|| value.get("market_side"))
                })
                .and_then(Value::as_str)
                .unwrap_or_else(|| intent.side.as_str());

            let detail = format!(
                "Listing nyata Lajukan. ID: {}. Sisi: {}. Jenis: {}. Kategori: {}. Lokasi: {}. Harga: {}. Ringkasan: {}",
                id, side, content_type, category, location, price, summary
            );

            sources.push(ToolSource {
                id: format!("listing:{}", id),
                title,
                content: detail,
                url: format!("/content/{}", id),
                kind: "lajukan_listing".to_string(),
            });
        }

        Ok(ToolExecution {
            sources: sources.clone(),
            traces: vec![ToolCallTrace {
                name: "search_listings".to_string(),
                status: "success".to_string(),
                result_count: sources.len(),
                query: if intent.search_query.trim().is_empty() {
                    intent.normalized_query.clone()
                } else {
                    intent.search_query.clone()
                },
                side: intent.side.as_str().to_string(),
                category: intent.category.clone(),
                location: intent.location.clone(),
            }],
        })
    }
}
