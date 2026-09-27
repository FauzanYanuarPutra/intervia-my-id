use anyhow::{anyhow, Result};
use serde_json::Value;
use sha2::{Digest, Sha256};
use std::sync::Arc;
use uuid::Uuid;

use crate::AppState;

fn redact(value: &Value) -> Value {
    const BLOCKED: &[&str] = &[
        "phone",
        "telephone",
        "mobile",
        "whatsapp",
        "email",
        "npwp",
        "nik",
        "ktp",
        "bank_account",
        "account_number",
        "contact_person",
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

type SourceRow = (
    Uuid,
    String,
    String,
    String,
    Option<String>,
    Option<String>,
    String,
    bool,
    bool,
    Option<String>,
);


// Import adapters currently support governed CKAN/DataStore and OSM Overpass sources.
// File-resource adapters are intentionally added separately so licensing and size limits
// remain explicit rather than silently treating every downloadable URL as reusable.
fn base_url(api_url: &str) -> Option<&str> {
    api_url.split("/api/").next().filter(|v| !v.is_empty())
}

fn ckan_action_url(api_url: &str, action: &str) -> Option<String> {
    let base = base_url(api_url)?;
    Some(format!("{base}/api/3/action/{action}"))
}

async fn run_inner(state: Arc<AppState>, job_id: Uuid) -> Result<()> {
    let job = sqlx::query_as::<_, (Uuid, Uuid, String, String)>(
        "UPDATE data_import_jobs SET status='running', started_at=NOW(), error_summary=NULL WHERE id=$1 AND status='queued' RETURNING id, source_id, mode, status"
    ).bind(job_id).fetch_optional(&state.db).await?;

    let Some(job) = job else {
        return Ok(());
    };

    let source = sqlx::query_as::<_, SourceRow>(
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
    let package_url =
        ckan_action_url(&api_url, "package_show").ok_or_else(|| anyhow!("invalid CKAN API URL"))?;

    let package_response = state.http_client.get(&package_url).send().await?;
    let package_status = package_response.status();
    let package_text = package_response.text().await?;
    if !package_status.is_success() {
        return Err(anyhow!(
            "CKAN package_show failed status={} url={} body={}",
            package_status,
            package_url,
            package_text.chars().take(1000).collect::<String>()
        ));
    }
    let package: Value = serde_json::from_str(&package_text)
        .map_err(|error| anyhow!("invalid CKAN package_show JSON: {error}"))?;
    let package = package.get("result").cloned().unwrap_or(package);
    let resources = package
        .get("resources")
        .and_then(Value::as_array)
        .cloned()
        .unwrap_or_default();

    let mut discovered = 0i32;
    let mut accepted = 0i32;
    let mut rejected = 0i32;
    let mut errors = 0i32;

    for resource in resources.into_iter().take(100) {
        let resource_id = match resource.get("id").and_then(Value::as_str) {
            Some(value) => value,
            None => {
                rejected += 1;
                continue;
            }
        };
        let active = resource
            .get("datastore_active")
            .and_then(Value::as_bool)
            .unwrap_or(false);
        let resource_license = resource
            .get("license")
            .or_else(|| resource.get("license_title"))
            .and_then(Value::as_str)
            .unwrap_or("");
        let license_ok = !resource_license.trim().is_empty()
            || source.5.as_deref().is_some_and(|v| !v.trim().is_empty());
        if !active || !license_ok {
            rejected += 1;
            continue;
        }

        let mut offset = 0usize;
        loop {
            let url = ckan_action_url(&api_url, "datastore_search")
                .ok_or_else(|| anyhow!("invalid CKAN API URL"))?;
            let offset_value = offset.to_string();
            let response = state
                .http_client
                .get(&url)
                .query(&[
                    ("resource_id", resource_id),
                    ("limit", "500"),
                    ("offset", offset_value.as_str()),
                ])
                .send()
                .await?;
            let status = response.status();
            let body = response.text().await?;
            if !status.is_success() {
                return Err(anyhow!(
                    "CKAN datastore_search failed status={} resource_id={} url={} body={}",
                    status,
                    resource_id,
                    url,
                    body.chars().take(1000).collect::<String>()
                ));
            }
            let payload: Value = serde_json::from_str(&body)
                .map_err(|error| anyhow!("invalid CKAN datastore_search JSON: {error}"))?;
            let records = payload
                .get("result")
                .and_then(|v| v.get("records"))
                .and_then(Value::as_array)
                .cloned()
                .unwrap_or_default();
            if records.is_empty() {
                break;
            }

            for raw in records.iter() {
                discovered += 1;
                if discovered > 100_000 {
                    break;
                }

                let safe = if source.7 { raw.clone() } else { redact(raw) };
                if job.2 == "dry_run" {
                    accepted += 1;
                    continue;
                }
                let record_id = raw
                    .get("_id")
                    .map(|v| v.to_string())
                    .or_else(|| raw.get("id").map(|v| v.to_string()))
                    .unwrap_or_else(|| hash(&safe));
                let source_hash = hash(&safe);
                let kind = if source.2 == "government_open_data" {
                    "government_reference"
                } else {
                    "open_data_reference"
                };

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
                    Err(error) => {
                        errors += 1;
                        tracing::warn!("record import failed: {:?}", error);
                    }
                }
            }

            if records.len() < 500 || discovered >= 100_000 {
                break;
            }
            offset += 500;
        }
        if discovered >= 100_000 {
            break;
        }
    }

    let status = if errors > 0 && accepted > 0 {
        "partial"
    } else if errors > 0 {
        "failed"
    } else {
        "succeeded"
    };
    sqlx::query("UPDATE data_import_jobs SET status=$2,finished_at=NOW(),discovered_count=$3,accepted_count=$4,rejected_count=$5,error_count=$6,error_summary=$7 WHERE id=$1")
        .bind(job_id).bind(status).bind(discovered).bind(accepted).bind(rejected).bind(errors)
        .bind(if errors > 0 { Some("some resources or records failed") } else { None })
        .execute(&state.db).await?;

    Ok(())
}

async fn run_osm_reference_import(
    state: &Arc<AppState>,
    job_id: Uuid,
    source: &SourceRow,
) -> Result<()> {
    let (
        source_id,
        source_key,
        _source_kind,
        source_url,
        api_url,
        license_name,
        reuse_mode,
        storage_allowed,
        _pii_allowed,
        attribution,
    ) = source;

    if reuse_mode != "persistent_import" || !*storage_allowed {
        return Err(anyhow!("OSM source is not approved for persistent import"));
    }
    let endpoint = api_url
        .as_deref()
        .ok_or_else(|| anyhow!("OSM source has no Overpass endpoint"))?;

    let cities: &[(&str, &str, f64, f64, f64)] = &[
        ("Jakarta", "DKI Jakarta", -6.2088, 106.8456, 20_000.0),
        ("Bogor", "Jawa Barat", -6.5950, 106.8166, 15_000.0),
        ("Tangerang", "Banten", -6.1783, 106.6319, 15_000.0),
        ("Bekasi", "Jawa Barat", -6.2383, 106.9756, 15_000.0),
        ("Bandung", "Jawa Barat", -6.9175, 107.6191, 18_000.0),
        ("Surabaya", "Jawa Timur", -7.2575, 112.7521, 18_000.0),
        ("Medan", "Sumatera Utara", 3.5952, 98.6722, 18_000.0),
        ("Semarang", "Jawa Tengah", -6.9667, 110.4167, 16_000.0),
        ("Makassar", "Sulawesi Selatan", -5.1477, 119.4327, 16_000.0),
        ("Yogyakarta", "DI Yogyakarta", -7.7956, 110.3695, 15_000.0),
        ("Denpasar", "Bali", -8.6500, 115.2167, 15_000.0),
        ("Palembang", "Sumatera Selatan", -2.9761, 104.7754, 16_000.0),
        ("Bandar Lampung", "Lampung", -5.3971, 105.2668, 15_000.0),
        ("Pekanbaru", "Riau", 0.5071, 101.4478, 16_000.0),
        ("Padang", "Sumatera Barat", -0.9471, 100.4172, 15_000.0),
        ("Batam", "Kepulauan Riau", 1.0456, 104.0305, 16_000.0),
        ("Banda Aceh", "Aceh", 5.5483, 95.3238, 13_000.0),
        ("Jambi", "Jambi", -1.6101, 103.6131, 14_000.0),
        ("Pontianak", "Kalimantan Barat", -0.0263, 109.3425, 15_000.0),
        (
            "Banjarmasin",
            "Kalimantan Selatan",
            -3.3186,
            114.5944,
            15_000.0,
        ),
        ("Samarinda", "Kalimantan Timur", -0.5022, 117.1536, 15_000.0),
        (
            "Balikpapan",
            "Kalimantan Timur",
            -1.2379,
            116.8529,
            15_000.0,
        ),
        ("Manado", "Sulawesi Utara", 1.4748, 124.8421, 14_000.0),
        ("Malang", "Jawa Timur", -7.9666, 112.6326, 15_000.0),
        ("Surakarta", "Jawa Tengah", -7.5755, 110.8243, 14_000.0),
        ("Cirebon", "Jawa Barat", -6.7320, 108.5523, 12_000.0),
        ("Tasikmalaya", "Jawa Barat", -7.3274, 108.2207, 12_000.0),
        (
            "Mataram",
            "Nusa Tenggara Barat",
            -8.5833,
            116.1167,
            13_000.0,
        ),
        (
            "Kupang",
            "Nusa Tenggara Timur",
            -10.1772,
            123.6070,
            13_000.0,
        ),
        ("Jayapura", "Papua", -2.5337, 140.7181, 12_000.0),
    ];

    let query = r#"
[out:json][timeout:110];
(
  nwr(around:{radius},{lat},{lng})["name"]["shop"];
  nwr(around:{radius},{lat},{lng})["name"]["craft"];
  nwr(around:{radius},{lat},{lng})["name"]["office"];
  nwr(around:{radius},{lat},{lng})["name"]["industrial"];
  nwr(around:{radius},{lat},{lng})["name"]["amenity"="marketplace"];
);
out center tags;
"#;

    let mut discovered = 0i32;
    let mut accepted = 0i32;
    let mut rejected = 0i32;
    let mut errors = 0i32;
    let mut seen = std::collections::HashSet::new();

    for (city_index, (city, province, lat, lng, radius)) in cities.iter().enumerate() {
        if discovered >= 50_000 {
            tracing::warn!("OSM reference import reached the per-job safety cap of 50,000 records");
            break;
        }
        if city_index > 0 {
            tokio::time::sleep(std::time::Duration::from_millis(1200)).await;
        }
        let body = query
            .replace("{radius}", &radius.to_string())
            .replace("{lat}", &lat.to_string())
            .replace("{lng}", &lng.to_string());

        let mut payload_result: Option<Value> = None;
        let endpoints = if endpoint == "https://overpass-api.de/api/interpreter" {
            vec![
                endpoint.to_string(),
                "https://overpass.kumi.systems/api/interpreter".to_string(),
            ]
        } else {
            vec![endpoint.to_string()]
        };

        for endpoint_candidate in endpoints {
            let response = state
                .http_client
                .post(&endpoint_candidate)
                .timeout(std::time::Duration::from_secs(150))
                .header(
                    reqwest::header::USER_AGENT,
                    "LajukanOpenDataImporter/1.0 (+https://www.lajukan.com)",
                )
                .header(reqwest::header::CONTENT_TYPE, "text/plain; charset=utf-8")
                .body(body.clone())
                .send()
                .await;

            match response {
                Ok(response) => {
                    let status = response.status();
                    match response.text().await {
                        Ok(response_body) if status.is_success() => {
                            match serde_json::from_str::<Value>(&response_body) {
                                Ok(payload) => {
                                    payload_result = Some(payload);
                                    break;
                                }
                                Err(error) => {
                                    tracing::warn!(
                                        city=%city,
                                        endpoint=%endpoint_candidate,
                                        status=%status,
                                        "OSM Overpass response parse failed: {:?}; body={}",
                                        error,
                                        response_body.chars().take(800).collect::<String>()
                                    );
                                }
                            }
                        }
                        Ok(response_body) => {
                            tracing::warn!(
                                city=%city,
                                endpoint=%endpoint_candidate,
                                status=%status,
                                "OSM Overpass request failed: body={}",
                                response_body.chars().take(800).collect::<String>()
                            );
                        }
                        Err(error) => {
                            tracing::warn!(
                                city=%city,
                                endpoint=%endpoint_candidate,
                                status=%status,
                                "OSM Overpass response body read failed: {:?}",
                                error
                            );
                        }
                    }
                }
                Err(error) => {
                    tracing::warn!(city=%city, endpoint=%endpoint_candidate, "OSM Overpass request failed: {:?}", error);
                }
            }
        }

        let Some(payload) = payload_result else {
            errors += 1;
            tracing::warn!(city=%city, "all configured OSM Overpass endpoints failed");
            continue;
        };

        for element in payload
            .get("elements")
            .and_then(Value::as_array)
            .cloned()
            .unwrap_or_default()
        {
            discovered += 1;
            let element_type = element
                .get("type")
                .and_then(Value::as_str)
                .unwrap_or("unknown");
            let element_id = element
                .get("id")
                .and_then(Value::as_i64)
                .unwrap_or_default();
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
            let name = tags
                .get("name")
                .and_then(Value::as_str)
                .unwrap_or("")
                .trim();
            if name.len() < 3 {
                rejected += 1;
                continue;
            }

            let lat = element.get("lat").and_then(Value::as_f64).or_else(|| {
                element
                    .get("center")
                    .and_then(|v| v.get("lat"))
                    .and_then(Value::as_f64)
            });
            let lon = element.get("lon").and_then(Value::as_f64).or_else(|| {
                element
                    .get("center")
                    .and_then(|v| v.get("lon"))
                    .and_then(Value::as_f64)
            });
            let (Some(lat), Some(lon)) = (lat, lon) else {
                rejected += 1;
                continue;
            };
            if !(-90.0..=90.0).contains(&lat) || !(-180.0..=180.0).contains(&lon) {
                rejected += 1;
                continue;
            }

            let allowed_keys = [
                "name",
                "shop",
                "craft",
                "office",
                "amenity",
                "tourism",
                "cuisine",
                "brand",
                "operator",
                "website",
                "opening_hours",
                "addr:street",
                "addr:housenumber",
                "addr:suburb",
                "addr:city",
                "addr:postcode",
                "wikidata",
                "wikimedia_commons",
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
            safe_map.insert(
                "province".to_string(),
                Value::String((*province).to_string()),
            );
            let address = [
                tags.get("addr:street").and_then(Value::as_str),
                tags.get("addr:housenumber").and_then(Value::as_str),
                tags.get("addr:suburb").and_then(Value::as_str),
            ]
            .into_iter()
            .flatten()
            .map(str::trim)
            .filter(|value| !value.is_empty())
            .collect::<Vec<_>>()
            .join(", ");
            if !address.is_empty() {
                safe_map.insert("address".to_string(), Value::String(address));
            }
            safe_map.insert(
                "source_url".to_string(),
                Value::String(format!(
                    "https://www.openstreetmap.org/{}/{}",
                    element_type, element_id
                )),
            );
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

                    match crate::data_entity_resolution::index_record(
                        &state.db,
                        *source_id,
                        import_record_id,
                        &safe,
                    )
                    .await
                    {
                        Ok(entity_id) => {
                            if let Err(error) = crate::reference_promotion::generate_for_entity(
                                &state.db, entity_id,
                            )
                            .await
                            {
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

    let status = if errors > 0 && accepted > 0 {
        "partial"
    } else if errors > 0 {
        "failed"
    } else {
        "succeeded"
    };
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
        Ok(()) => {
            if let Err(error) = sqlx::query(
                r#"UPDATE data_source_registry s
                   SET last_success_at=NOW(), updated_at=NOW()
                   FROM data_import_jobs j
                   WHERE j.id=$1
                     AND s.id=j.source_id
                     AND j.status IN ('succeeded','partial')"#,
            )
            .bind(job_id)
            .execute(&state.db)
            .await
            {
                tracing::warn!(job_id=%job_id, "failed to record source success timestamp: {:?}", error);
            }
            Ok(())
        }
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
            if let Err(db_error) = sqlx::query(
                r#"UPDATE data_source_registry s
                   SET last_error_at=NOW(), updated_at=NOW()
                   FROM data_import_jobs j
                   WHERE j.id=$1
                     AND s.id=j.source_id"#,
            )
            .bind(job_id)
            .execute(&state.db)
            .await
            {
                tracing::warn!(job_id=%job_id, "failed to record source error timestamp: {:?}", db_error);
            }
            Err(error)
        }
    }
}
