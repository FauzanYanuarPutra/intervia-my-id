use anyhow::{anyhow, Result};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

fn redact(value: &Value) -> Value {
    const BLOCKED: &[&str] = &[
        "phone", "telephone", "mobile", "whatsapp", "email", "npwp",
        "nik", "ktp", "bank_account", "account_number", "contact_person",
    ];
    match value {
        Value::Object(map) => {
            let mut out = serde_json::Map::new();
            for (key, value) in map {
                let key_normalized = key.to_ascii_lowercase().replace(['-', ' '], "_");
                if BLOCKED.iter().any(|item| key_normalized.contains(item)) {
                    continue;
                }
                out.insert(key.clone(), redact(value));
            }
            Value::Object(out)
        }
        Value::Array(items) => Value::Array(items.iter().map(redact).collect()),
        _ => value.clone(),
    }
}

fn hash(value: &Value) -> String {
    let bytes = serde_json::to_vec(value).unwrap_or_default();
    format!("{:x}", Sha256::digest(bytes))
}

fn base_url(api_url: &str) -> Option<&str> {
    api_url.split("/api/").next().filter(|v| !v.is_empty())
}

async fn run_inner(state: Arc<AppState>, job_id: Uuid) -> Result<()> {
    let job = sqlx::query_as::<_, (Uuid, Uuid, String, String)>(
        "UPDATE data_import_jobs SET status='running', started_at=NOW(), error_summary=NULL WHERE id=$1 AND status='queued' RETURNING id, source_id, mode, status"
    ).bind(job_id).fetch_optional(&state.db).await?;

    let Some(job) = job else {
        return Ok(());
    };

    let source = sqlx::query_as::<_, (Uuid, String, String, String, Option<String>, Option<String>, String, bool, bool, Option<String>)>(
        "SELECT id, source_key, source_kind, source_url, api_url, license_name, reuse_mode, storage_allowed, pii_import_allowed, attribution_text FROM data_source_registry WHERE id=$1"
    ).bind(job.1).fetch_one(&state.db).await?;

    if job.2 != "dry_run" && !(source.6 == "persistent_import" && source.7) {
        sqlx::query("UPDATE data_import_jobs SET status='failed', finished_at=NOW(), error_count=1, error_summary=$2 WHERE id=$1")
            .bind(job_id).bind("persistent import is not permitted by source policy").execute(&state.db).await?;
        return Ok(());
    }

    if source.2 == "osm_overpass" {
        return run_osm_reference_import(&state, job_id, &source).await;
    }

    let api_url = source.4.ok_or_else(|| anyhow!("source has no CKAN API"))?;
    let base = base_url(&api_url).ok_or_else(|| anyhow!("invalid CKAN API URL"))?;

    let package: Value = state.http_client.get(&api_url).send().await?.error_for_status()?.json().await?;
    let package = package.get("result").cloned().unwrap_or(package);
    let resources = package.get("resources").and_then(Value::as_array).cloned().unwrap_or_default();

    let mut discovered = 0i32;
    let mut accepted = 0i32;
    let mut rejected = 0i32;
    let mut errors = 0i32;

    for resource in resources.into_iter().take(100) {
        let resource_id = match resource.get("id").and_then(Value::as_str) {
            Some(value) => value,
            None => { rejected += 1; continue; }
        };
        let active = resource.get("datastore_active").and_then(Value::as_bool).unwrap_or(false);
        let resource_license = resource.get("license").or_else(|| resource.get("license_title"))
            .and_then(Value::as_str).unwrap_or("");
        let license_ok = !resource_license.trim().is_empty() || source.5.as_deref().is_some_and(|v| !v.trim().is_empty());
        if !active || !license_ok {
            rejected += 1;
            continue;
        }

        let mut offset = 0usize;
        loop {
            let url = format!("{}/api/action/datastore_search?resource_id={}&limit=500&offset={}", base, resource_id, offset);
            let payload: Value = state.http_client.get(&url).send().await?.error_for_status()?.json().await?;
            let records = payload.get("result").and_then(|v| v.get("records")).and_then(Value::as_array).cloned().unwrap_or_default();
            if records.is_empty() { break; }

            for raw in records.iter() {
                discovered += 1;
                if discovered > 100_000 { break; }

                let safe = if source.7 { raw.clone() } else { redact(raw) };
                if job.2 == "dry_run" {
                    accepted += 1;
                    continue;
                }
                let record_id = raw.get("_id").map(|v| v.to_string())
                    .or_else(|| raw.get("id").map(|v| v.to_string()))
                    .unwrap_or_else(|| hash(&safe));
                let source_hash = hash(&safe);
                let kind = if source.2 == "government_open_data" { "government_reference" } else { "open_data_reference" };

                let result = sqlx::query(
                    "INSERT INTO data_import_records (job_id,source_id,source_record_id,source_url,source_hash,record_kind,license_snapshot,attribution_snapshot,raw_metadata,validation_status,validation_reason,last_seen_at,updated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,'accepted',$10,NOW(),NOW()) ON CONFLICT (source_id,source_record_id) DO UPDATE SET job_id=EXCLUDED.job_id,source_url=EXCLUDED.source_url,source_hash=EXCLUDED.source_hash,raw_metadata=EXCLUDED.raw_metadata,validation_status='accepted',last_seen_at=NOW(),updated_at=NOW()"
                )
                .bind(job_id).bind(source.0).bind(&record_id)
                .bind(resource.get("url").and_then(Value::as_str))
                .bind(source_hash).bind(kind)
                .bind(if resource_license.is_empty() { source.5.as_deref() } else { Some(resource_license) })
                .bind(source.9.as_deref()).bind(&safe)
                .bind("validated resource; sensitive fields removed when policy disallows PII import")
                .execute(&state.db).await;

                match result {
                    Ok(_) => {
                        match sqlx::query_scalar::<_, uuid::Uuid>(
                            "SELECT id FROM data_import_records WHERE source_id=$1 AND source_record_id=$2 LIMIT 1"
                        )
                        .bind(source.0)
                        .bind(&record_id)
                        .fetch_one(&state.db)
                        .await {
                            Ok(import_record_id) => {
                                match crate::data_entity_resolution::index_record(
                                    &state.db, source.0, import_record_id, &safe
                                ).await {
                                    Ok(entity_id) => {
                                        if let Err(error) = crate::reference_promotion::generate_for_entity(
                                            &state.db, entity_id
                                        ).await {
                                            errors += 1;
                                            tracing::warn!("reference promotion candidate generation failed (import remains accepted): {:?}", error);
                                        }
                                    }
                                    Err(error) => {
                                        errors += 1;
                                        tracing::warn!("entity normalization failed: {:?}", error);
                                    }
                                }
                            }
                            Err(error) => {
                                errors += 1;
                                tracing::warn!("import record lookup failed: {:?}", error);
                            }
                        }
                        accepted += 1;
                    }
                    Err(error) => { errors += 1; tracing::warn!("record import failed: {:?}", error); }
                }
            }

            if records.len() < 500 || discovered >= 100_000 { break; }
            offset += 500;
        }
        if discovered >= 100_000 { break; }
    }

    let status = if errors > 0 && accepted > 0 { "partial" } else if errors > 0 { "failed" } else { "succeeded" };
    sqlx::query("UPDATE data_import_jobs SET status=$2,finished_at=NOW(),discovered_count=$3,accepted_count=$4,rejected_count=$5,error_count=$6,error_summary=$7 WHERE id=$1")
        .bind(job_id).bind(status).bind(discovered).bind(accepted).bind(rejected).bind(errors)
        .bind(if errors > 0 { Some("some resources or records failed") } else { None })
        .execute(&state.db).await?;

    Ok(())
}


async fn run_osm_reference_import(
    state: &Arc<AppState>,
    job_id: Uuid,
    source: &(Uuid, String, String, String, Option<String>, Option<String>, String, bool, bool, Option<String>),
) -> Result<()> {
    let (source_id, source_key, _source_kind, source_url, api_url, license_name, reuse_mode, storage_allowed, _pii_allowed, attribution) = source;

    if reuse_mode != "persistent_import" || !*storage_allowed {
        return Err(anyhow!("OSM source is not approved for persistent import"));
    }
    let endpoint = api_url.as_deref().ok_or_else(|| anyhow!("OSM source has no Overpass endpoint"))?;

    let bboxes: &[(&str, &str, f64, f64, f64, f64)] = &[
        ("Jakarta", "DKI Jakarta", -6.40, -6.05, 106.65, 107.05),
        ("Bandung", "Jawa Barat", -7.10, -6.75, 107.45, 107.80),
        ("Surabaya", "Jawa Timur", -7.40, -7.10, 112.55, 112.90),
        ("Yogyakarta", "DI Yogyakarta", -7.95, -7.65, 110.25, 110.50),
        ("Semarang", "Jawa Tengah", -7.20, -6.85, 110.25, 110.55),
        ("Denpasar", "Bali", -8.80, -8.55, 115.10, 115.30),
        ("Medan", "Sumatera Utara", 3.45, 3.75, 98.50, 98.80),
        ("Makassar", "Sulawesi Selatan", -5.30, -5.00, 119.25, 119.55),
        ("Palembang", "Sumatera Selatan", -3.15, -2.80, 104.55, 104.90),
        ("Balikpapan", "Kalimantan Timur", -1.40, -1.10, 116.65, 117.00),
        ("Tangerang Selatan", "Banten", -6.40, -6.20, 106.60, 106.85),
        ("Bogor", "Jawa Barat", -6.75, -6.45, 106.65, 106.90),
    ];

    let query = r#"
[out:json][timeout:120];
(
  nwr["name"]["shop"]({south},{west},{north},{east});
  nwr["name"]["craft"]({south},{west},{north},{east});
  nwr["name"]["office"]({south},{west},{north},{east});
  nwr["name"]["amenity"~"^(marketplace|restaurant|cafe|fast_food|pharmacy|bank)$"]({south},{west},{north},{east});
  nwr["name"]["tourism"~"^(hotel|guest_house|hostel)$"]({south},{west},{north},{east});
);
out center tags;
"#;

    let mut discovered = 0i32;
    let mut accepted = 0i32;
    let mut rejected = 0i32;
    let mut errors = 0i32;
    let mut seen = std::collections::HashSet::new();

    for (city, province, south, west, north, east) in bboxes {
        let body = query
            .replace("{south}", &south.to_string())
            .replace("{west}", &west.to_string())
            .replace("{north}", &north.to_string())
            .replace("{east}", &east.to_string());

        let response = state.http_client
            .post(endpoint)
            .header(reqwest::header::USER_AGENT, "LajukanOpenDataImporter/1.0 (+https://www.lajukan.com)")
            .form(&[("data", body)])
            .send()
            .await;

        let payload: Value = match response {
            Ok(response) => match response.error_for_status() {
                Ok(response) => response.json().await?,
                Err(error) => {
                    errors += 1;
                    tracing::warn!(city=%city, "OSM Overpass request failed: {:?}", error);
                    continue;
                }
            },
            Err(error) => {
                errors += 1;
                tracing::warn!(city=%city, "OSM Overpass request failed: {:?}", error);
                continue;
            }
        };

        for element in payload.get("elements").and_then(Value::as_array).cloned().unwrap_or_default() {
            discovered += 1;
            let element_type = element.get("type").and_then(Value::as_str).unwrap_or("unknown");
            let element_id = element.get("id").and_then(Value::as_i64).unwrap_or_default();
            if element_id <= 0 {
                rejected += 1;
                continue;
            }

            let source_record_id = format!("osm:{}:{}", element_type, element_id);
            if !seen.insert(source_record_id.clone()) {
                continue;
            }

            let tags = match element.get("tags").and_then(Value::as_object) {
                Some(tags) => tags,
                None => {
                    rejected += 1;
                    continue;
                }
            };
            let name = tags.get("name").and_then(Value::as_str).unwrap_or("").trim();
            if name.len() < 3 {
                rejected += 1;
                continue;
            }

            let lat = element.get("lat").and_then(Value::as_f64)
                .or_else(|| element.get("center").and_then(|v| v.get("lat")).and_then(Value::as_f64));
            let lon = element.get("lon").and_then(Value::as_f64)
                .or_else(|| element.get("center").and_then(|v| v.get("lon")).and_then(Value::as_f64));
            let (Some(lat), Some(lon)) = (lat, lon) else {
                rejected += 1;
                continue;
            };
            if !(-90.0..=90.0).contains(&lat) || !(-180.0..=180.0).contains(&lon) {
                rejected += 1;
                continue;
            }

            let allowed_keys = [
                "name", "shop", "craft", "office", "amenity", "tourism", "cuisine",
                "brand", "operator", "website", "opening_hours", "addr:street",
                "addr:housenumber", "addr:suburb", "addr:city", "addr:postcode",
                "wikidata", "wikimedia_commons", "image"
            ];
            let mut safe_map = serde_json::Map::new();
            for key in allowed_keys {
                if let Some(value) = tags.get(key) {
                    safe_map.insert(key.to_string(), value.clone());
                }
            }
            safe_map.insert("latitude".to_string(), Value::from(lat));
            safe_map.insert("longitude".to_string(), Value::from(lon));
            safe_map.insert("city".to_string(), Value::String((*city).to_string()));
            safe_map.insert("province".to_string(), Value::String((*province).to_string()));
            safe_map.insert("source_url".to_string(), Value::String(
                format!("https://www.openstreetmap.org/{}/{}", element_type, element_id)
            ));
            let safe = Value::Object(safe_map);
            let source_hash = hash(&safe);

            let result = sqlx::query(
                "INSERT INTO data_import_records (job_id,source_id,source_record_id,source_url,source_hash,record_kind,license_snapshot,attribution_snapshot,raw_metadata,validation_status,validation_reason,last_seen_at,updated_at)
                 VALUES ($1,$2,$3,$4,$5,'open_data_reference',$6,$7,$8,'accepted','OSM public reference; contact fields intentionally excluded',NOW(),NOW())
                 ON CONFLICT (source_id,source_record_id) DO UPDATE SET job_id=EXCLUDED.job_id,source_url=EXCLUDED.source_url,source_hash=EXCLUDED.source_hash,raw_metadata=EXCLUDED.raw_metadata,validation_status='accepted',last_seen_at=NOW(),updated_at=NOW()"
            )
            .bind(job_id)
            .bind(*source_id)
            .bind(&source_record_id)
            .bind(safe.get("source_url").and_then(Value::as_str))
            .bind(source_hash)
            .bind(license_name.as_deref())
            .bind(attribution.as_deref())
            .bind(&safe)
            .execute(&state.db)
            .await;

            match result {
                Ok(_) => {
                    let import_record_id = sqlx::query_scalar::<_, Uuid>(
                        "SELECT id FROM data_import_records WHERE source_id=$1 AND source_record_id=$2 LIMIT 1"
                    )
                    .bind(*source_id)
                    .bind(&source_record_id)
                    .fetch_one(&state.db)
                    .await?;

                    match crate::data_entity_resolution::index_record(&state.db, *source_id, import_record_id, &safe).await {
                        Ok(entity_id) => {
                            if let Err(error) = crate::reference_promotion::generate_for_entity(&state.db, entity_id).await {
                                errors += 1;
                                tracing::warn!(entity_id=%entity_id, "OSM promotion candidate generation failed: {:?}", error);
                            } else {
                                accepted += 1;
                            }
                        }
                        Err(error) => {
                            errors += 1;
                            tracing::warn!(source_record_id=%source_record_id, "OSM entity resolution failed: {:?}", error);
                        }
                    }
                }
                Err(error) => {
                    errors += 1;
                    tracing::warn!(source_record_id=%source_record_id, "OSM record import failed: {:?}", error);
                }
            }
        }

        tokio::time::sleep(std::time::Duration::from_secs(2)).await;
    }

    let status = if errors > 0 && accepted > 0 { "partial" } else if errors > 0 { "failed" } else { "succeeded" };
    sqlx::query(
        "UPDATE data_import_jobs SET status=$2,finished_at=NOW(),discovered_count=$3,accepted_count=$4,rejected_count=$5,error_count=$6,error_summary=$7 WHERE id=$1"
    )
    .bind(job_id).bind(status).bind(discovered).bind(accepted).bind(rejected).bind(errors)
    .bind(if errors > 0 { Some("some OSM bboxes or records failed") } else { None })
    .execute(&state.db)
    .await?;

    tracing::info!(source_key=%source_key, source_url=%source_url, discovered, accepted, rejected, errors, "OSM reference import completed");
    Ok(())
}


pub async fn run(state: Arc<AppState>, job_id: Uuid) -> Result<()> {
    match run_inner(state.clone(), job_id).await {
        Ok(()) => Ok(()),
        Err(error) => {
            let summary = error.to_string().chars().take(2000).collect::<String>();
            if let Err(db_error) = sqlx::query(
                "UPDATE data_import_jobs
                 SET status='failed', finished_at=NOW(), error_count=GREATEST(COALESCE(error_count, 0), 1),
                     error_summary=$2
                 WHERE id=$1 AND status='running'"
            )
            .bind(job_id)
            .bind(&summary)
            .execute(&state.db)
            .await
            {
                tracing::error!(
                    "failed to persist importer recovery state for job {}: {:?}; original error: {}",
                    job_id, db_error, summary
                );
            }
            Err(error)
        }
    }
}
