use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum MarketplaceSide {
    Supply,
    Demand,
    Unknown,
}

impl MarketplaceSide {
    pub fn as_str(self) -> &'static str {
        match self {
            Self::Supply => "supply",
            Self::Demand => "demand",
            Self::Unknown => "unknown",
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct MarketplaceIntent {
    pub should_search: bool,
    pub side: MarketplaceSide,
    pub category: String,
    pub location: String,
    pub normalized_query: String,
}

fn has_any(text: &str, words: &[&str]) -> bool {
    words.iter().any(|word| text.contains(word))
}

fn clean_location_candidate(value: &str) -> String {
    value
        .split([',', '.', ';', '?', '!'])
        .next()
        .unwrap_or(value)
        .split_once(" dengan ")
        .map(|(left, _)| left)
        .unwrap_or(value)
        .split_once(" budget ")
        .map(|(left, _)| left)
        .unwrap_or(value)
        .split_once(" harga ")
        .map(|(left, _)| left)
        .unwrap_or(value)
        .trim()
        .trim_matches(['-', ':'])
        .split_whitespace()
        .take(6)
        .collect::<Vec<_>>()
        .join(" ")
}

fn extract_location(lower: &str) -> String {
    for marker in [" di ", " daerah ", " area ", " sekitar ", " wilayah "] {
        if let Some(index) = lower.find(marker) {
            let candidate = &lower[index + marker.len()..];
            let cleaned = clean_location_candidate(candidate);
            if cleaned.len() >= 3 {
                return cleaned;
            }
        }
    }
    String::new()
}

fn infer_category(lower: &str) -> String {
    if has_any(
        lower,
        &[
            "jasa",
            "service",
            "desain",
            "desainer",
            "fotografi",
            "foto",
            "video",
            "akuntansi",
            "pajak",
            "marketing",
            "admin",
        ],
    ) {
        return "services".to_string();
    }

    if has_any(
        lower,
        &[
            "mesin",
            "alat",
            "peralatan",
            "coffee machine",
            "sealer",
            "blender",
            "oven",
            "freezer",
            "kompor",
        ],
    ) {
        return "machines-tools".to_string();
    }

    if has_any(
        lower,
        &[
            "ruko",
            "toko",
            "kios",
            "gudang",
            "tempat usaha",
            "lokasi usaha",
            "sewa tempat",
        ],
    ) {
        return "business-places".to_string();
    }

    if has_any(
        lower,
        &[
            "modal",
            "investor",
            "mitra usaha",
            "kemitraan",
            "peluang usaha",
            "ambil alih usaha",
            "oper usaha",
        ],
    ) {
        return "business-opportunities".to_string();
    }

    if has_any(
        lower,
        &[
            "supplier",
            "pemasok",
            "bahan",
            "buah",
            "mangga",
            "jeruk",
            "naga",
            "sayur",
            "daging",
            "kemasan",
            "kardus",
            "bahan baku",
            "stok",
            "barang",
            "produk",
        ],
    ) {
        return "materials-suppliers".to_string();
    }

    "unknown".to_string()
}

pub fn infer_marketplace_intent(query: &str) -> MarketplaceIntent {
    let normalized_query = query.trim().chars().take(6000).collect::<String>();
    let lower = normalized_query.to_lowercase();

    let search_language = has_any(
        &lower,
        &[
            "cari",
            "carikan",
            "butuh",
            "membutuhkan",
            "mencari",
            "ada yang jual",
            "ada yang punya",
            "supplier",
            "pemasok",
            "pembeli",
            "buyer",
            "penjual",
            "jual",
            "menjual",
            "menawarkan",
            "tersedia",
            "ready stock",
            "stok",
            "penawaran",
        ],
    );

    let demand = has_any(
        &lower,
        &[
            "cari pembeli",
            "mencari pembeli",
            "butuh pembeli",
            "sedang mencari",
            "aku butuh",
            "saya butuh",
            "kami butuh",
            "dibutuhkan",
            "membutuhkan",
            "butuh ",
            "need ",
            "wanted ",
        ],
    );

    let supply = has_any(
        &lower,
        &[
            "cari supplier",
            "carikan supplier",
            "mencari supplier",
            "pemasok",
            "supplier",
            "penjual",
            "ada yang jual",
            "menjual",
            "jualan",
            "menawarkan",
            "tersedia",
            "ready stock",
            "stok ",
        ],
    );

    let side = if demand && !supply {
        MarketplaceSide::Demand
    } else if supply && !demand {
        MarketplaceSide::Supply
    } else if demand {
        MarketplaceSide::Demand
    } else if supply {
        MarketplaceSide::Supply
    } else {
        MarketplaceSide::Unknown
    };

    MarketplaceIntent {
        should_search: search_language && !normalized_query.is_empty(),
        side,
        category: infer_category(&lower),
        location: extract_location(&lower),
        normalized_query,
    }
}

#[cfg(test)]
mod tests {
    use super::{infer_marketplace_intent, MarketplaceSide};

    #[test]
    fn finds_supplier_side_and_materials_category() {
        let intent = infer_marketplace_intent("Carikan supplier mangga 100kg di Tangerang Selatan");
        assert!(intent.should_search);
        assert_eq!(intent.side, MarketplaceSide::Supply);
        assert_eq!(intent.category, "materials-suppliers");
        assert!(intent.location.contains("tangerang"));
    }

    #[test]
    fn finds_buyer_side() {
        let intent = infer_marketplace_intent("Saya jual kardus dan sedang cari pembeli di Bintaro");
        assert!(intent.should_search);
        assert_eq!(intent.side, MarketplaceSide::Demand);
    }

    #[test]
    fn does_not_force_search_for_generic_chat() {
        let intent = infer_marketplace_intent("Jelaskan apa itu UMKM");
        assert!(!intent.should_search);
        assert_eq!(intent.side, MarketplaceSide::Unknown);
    }

    #[test]
    fn infers_machines_and_tools() {
        let intent = infer_marketplace_intent("Cari mesin kopi untuk kedai kecil budget 10 juta");
        assert_eq!(intent.category, "machines-tools");
        assert_eq!(intent.side, MarketplaceSide::Supply);
    }
}
