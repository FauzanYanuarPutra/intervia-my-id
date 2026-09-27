use sha2::Digest;
use serde_json::Value;
use sqlx::PgPool;
use uuid::Uuid;

fn text_field(value: &Value, aliases: &[&str]) -> Option<String> {
    let object = value.as_object()?;
    for alias in aliases {
        if let Some(value) = object.get(*alias) {
            if let Some(text) = value.as_str() {
                let text = text.trim();
                if !text.is_empty() { return Some(text.to_string()); }
            } else if value.is_number() {
                return Some(value.to_string());
            }
        }
    }
    None
}

fn normalize_text(value: Option<String>) -> Option<String> {
    let value = value?;
    let value = value.to_ascii_lowercase();
    let mut out = String::with_capacity(value.len());
    let mut last_space = false;
    for ch in value.chars() {
        if ch.is_ascii_alphanumeric() {
            out.push(ch);
            last_space = false;
        } else if !last_space {
            out.push(' ');
            last_space = true;
        }
    }
    let value = out.split_whitespace().collect::<Vec<_>>().join(" ");
    (!value.is_empty()).then_some(value)
}

fn coordinate(value: &Value, aliases: &[&str], max_abs: f64) -> Option<f64> {
    text_field(value, aliases)?
        .parse::<f64>()
        .ok()
        .filter(|v| v.is_finite() && v.abs() <= max_abs)
}

fn similarity(a: Option<&str>, b: Option<&str>) -> f64 {
    match (a, b) {
        (Some(a), Some(b)) if a == b => 1.0,
        (Some(a), Some(b)) => {
            let sa = a.split_whitespace().collect::<std::collections::HashSet<_>>();
            let sb = b.split_whitespace().collect::<std::collections::HashSet<_>>();
            let union = sa.union(&sb).count() as f64;
            if union == 0.0 { 0.0 } else { sa.intersection(&sb).count() as f64 / union }
        }
        _ => 0.0,
    }
}

fn geo_similarity(a_lat: Option<f64>, a_lon: Option<f64>, b_lat: Option<f64>, b_lon: Option<f64>) -> f64 {
    let (Some(a_lat), Some(a_lon), Some(b_lat), Some(b_lon)) = (a_lat, a_lon, b_lat, b_lon) else { return 0.0; };
    let lat = (a_lat - b_lat).to_radians();
    let lon = (a_lon - b_lon).to_radians();
    let x = lat.sin().powi(2) + a_lat.to_radians().cos() * b_lat.to_radians().cos() * lon.sin().powi(2);
    let meters = 6_371_000.0 * 2.0 * x.sqrt().asin();
    if meters <= 30.0 { 1.0 } else if meters <= 250.0 { 0.8 } else if meters <= 1000.0 { 0.4 } else { 0.0 }
}

pub async fn index_record(db: &PgPool, source_id: Uuid, record_id: Uuid, raw: &Value) -> Result<(), sqlx::Error> {
    let name = normalize_text(text_field(raw, &["name","nama","nama_usaha","nama_umkm","business_name","merchant_name"]));
    let address = normalize_text(text_field(raw, &["address","alamat","alamat_usaha","street","jalan"]));
    let city = normalize_text(text_field(raw, &["city","kota","kabupaten","kabupaten_kota"]));
    let province = normalize_text(text_field(raw, &["province","provinsi"]));
    let postal = text_field(raw, &["postal_code","kode_pos","zip","zipcode"]);
    let category = normalize_text(text_field(raw, &["category","kategori","jenis_usaha","sector","sektor"]));
    let lat = coordinate(raw, &["latitude","lat","lintang"], 90.0);
    let lon = coordinate(raw, &["longitude","lon","lng","bujur"], 180.0);

    let canonical_key = {
        let mut value = String::new();
        value.push_str(name.as_deref().unwrap_or(""));
        value.push('|');
        value.push_str(address.as_deref().unwrap_or(""));
        value.push('|');
        value.push_str(city.as_deref().unwrap_or(""));
        value.push('|');
        value.push_str(province.as_deref().unwrap_or(""));
        if value.trim_matches('|').is_empty() {
            format!("record:{record_id}")
        } else {
            let digest = sha2::Sha256::digest(value.as_bytes());
            format!("{digest:x}")
        }
    };

    let entity_id = sqlx::query_scalar::<_, Uuid>(
        r#"INSERT INTO data_import_entities
           (source_id, canonical_key, normalized_name, normalized_address, city, province, postal_code, latitude, longitude, category, source_record_count, resolution_status, canonical_record_id, metadata, last_seen_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,1,'new',$11,$12,NOW(),NOW())
           ON CONFLICT (source_id, canonical_key) DO UPDATE SET
             normalized_name=COALESCE(EXCLUDED.normalized_name,data_import_entities.normalized_name),
             normalized_address=COALESCE(EXCLUDED.normalized_address,data_import_entities.normalized_address),
             city=COALESCE(EXCLUDED.city,data_import_entities.city),
             province=COALESCE(EXCLUDED.province,data_import_entities.province),
             postal_code=COALESCE(EXCLUDED.postal_code,data_import_entities.postal_code),
             latitude=COALESCE(EXCLUDED.latitude,data_import_entities.latitude),
             longitude=COALESCE(EXCLUDED.longitude,data_import_entities.longitude),
             category=COALESCE(EXCLUDED.category,data_import_entities.category),
             source_record_count=data_import_entities.source_record_count+1,
             canonical_record_id=COALESCE(data_import_entities.canonical_record_id,EXCLUDED.canonical_record_id),
             metadata=EXCLUDED.metadata,last_seen_at=NOW(),updated_at=NOW()
           RETURNING id"#,
    )
    .bind(source_id).bind(canonical_key).bind(&name).bind(&address).bind(&city).bind(&province).bind(postal)
    .bind(lat).bind(lon).bind(category).bind(record_id).bind(raw.clone())
    .fetch_one(db).await?;

    let candidates = sqlx::query_as::<_, (Uuid, Option<String>, Option<String>, Option<f64>, Option<f64>)>(
        r#"SELECT id, normalized_name, normalized_address, latitude, longitude
           FROM data_import_entities
           WHERE id <> $1
             AND (
               ($2 IS NOT NULL AND normalized_name = $2)
               OR ($3 IS NOT NULL AND city = $3)
             )
           ORDER BY updated_at DESC LIMIT 20"#,
    )
    .bind(entity_id).bind(&name).bind(&city).fetch_all(db).await?;

    for (candidate_id, candidate_name, candidate_address, candidate_lat, candidate_lon) in candidates {
        let ns = similarity(name.as_deref(), candidate_name.as_deref());
        let ads = similarity(address.as_deref(), candidate_address.as_deref());
        let gs = geo_similarity(lat, lon, candidate_lat, candidate_lon);
        let score = (ns * 0.50 + ads * 0.30 + gs * 0.20).min(1.0);
        let decision = if score >= 0.90 { "same_entity" } else if score >= 0.65 { "possible_duplicate" } else { "distinct_entity" };
        sqlx::query(
            r#"INSERT INTO data_import_entity_matches
               (entity_id,candidate_entity_id,name_similarity,address_similarity,geo_similarity,combined_score,decision,reason)
               VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
               ON CONFLICT (entity_id,candidate_entity_id) DO UPDATE SET
                 name_similarity=EXCLUDED.name_similarity,address_similarity=EXCLUDED.address_similarity,
                 geo_similarity=EXCLUDED.geo_similarity,combined_score=EXCLUDED.combined_score,
                 decision=EXCLUDED.decision,reason=EXCLUDED.reason"#,
        )
        .bind(entity_id).bind(candidate_id).bind(ns).bind(ads).bind(gs).bind(score).bind(decision)
        .bind("heuristic similarity; human review remains authoritative")
        .execute(db).await?;
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn latitude_rejects_out_of_range_values() {
        let raw = serde_json::json!({"latitude": "91.0"});
        assert_eq!(coordinate(&raw, &["latitude"], 90.0), None);
    }
    #[test]
    fn longitude_accepts_boundary_and_rejects_invalid() {
        let valid = serde_json::json!({"longitude": "-180"});
        let invalid = serde_json::json!({"longitude": "180.1"});
        assert_eq!(coordinate(&valid, &["longitude"], 180.0), Some(-180.0));
        assert_eq!(coordinate(&invalid, &["longitude"], 180.0), None);
    }
    #[test]
    fn similarity_is_deterministic() {
        assert_eq!(similarity(Some("toko maju"), Some("toko maju")), 1.0);
        assert_eq!(similarity(Some("toko maju"), Some("toko")), 0.5);
        assert_eq!(similarity(None, Some("toko")), 0.0);
    }
    #[test]
    fn normalization_collapses_whitespace_and_punctuation() {
        assert_eq!(normalize_text(Some("  Toko-Maju   Bandung ".to_string())), Some("toko maju bandung".to_string()));
        assert_eq!(normalize_text(Some("!!!".to_string())), None);
    }
}
