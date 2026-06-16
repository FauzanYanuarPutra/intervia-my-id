use axum::{
    extract::Multipart,
    http::{header, HeaderValue, Method},
    routing::{get, post},
    Json, Router,
};
use bytes::Bytes;
use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};
use std::{env, net::SocketAddr};
use tower_http::cors::CorsLayer;

fn parse_cors_origins() -> Vec<HeaderValue> {
    let raw = env::var("CORS_ORIGINS")
        .ok()
        .or_else(|| env::var("CORS_ORIGIN").ok())
        .unwrap_or_else(|| {
            "http://localhost:3000,http://localhost:3001,http://localhost:3002".to_string()
        });

    raw.split(',')
        .filter_map(|origin| origin.trim().parse::<HeaderValue>().ok())
        .collect()
}

fn service_url(key: &str, fallback: &str) -> String {
    env::var(key).unwrap_or_else(|_| fallback.to_string())
}

fn read_non_empty_string(value: Option<&Value>) -> Option<String> {
    value
        .and_then(|candidate| candidate.as_str())
        .map(|candidate| candidate.trim().to_string())
        .filter(|candidate| !candidate.is_empty())
}

fn read_bool(value: Option<&Value>) -> bool {
    value
        .and_then(|candidate| candidate.as_bool())
        .unwrap_or(false)
}

fn read_f64(value: Option<&Value>) -> Option<f64> {
    value.and_then(|candidate| match candidate {
        Value::Number(number) => number.as_f64(),
        Value::String(text) => text.trim().parse::<f64>().ok(),
        _ => None,
    })
}

fn ensure_object(value: Value) -> Map<String, Value> {
    match value {
        Value::Object(map) => map,
        _ => Map::new(),
    }
}

fn merge_document_data(cleaned: Value, raw_ocr: &Value) -> Value {
    let mut document = ensure_object(cleaned);

    if !document.contains_key("nik") {
        if let Some(nik) = read_non_empty_string(raw_ocr.get("nik")) {
            document.insert("nik".to_string(), Value::String(nik));
        }
    }

    if !document.contains_key("document_type") {
        document.insert(
            "document_type".to_string(),
            Value::String("ktp".to_string()),
        );
    }
    if !document.contains_key("document_country") {
        document.insert(
            "document_country".to_string(),
            Value::String("ID".to_string()),
        );
    }

    if let Some(raw_text) = read_non_empty_string(raw_ocr.get("raw_text_for_vllm")) {
        document
            .entry("raw_capture_text".to_string())
            .or_insert(Value::String(raw_text));
    }

    Value::Object(document)
}

fn average_ocr_confidence(raw_ocr: &Value) -> f64 {
    let Some(segments) = raw_ocr
        .get("all_segments")
        .and_then(|value| value.as_array())
    else {
        return 0.0;
    };

    let mut total = 0.0;
    let mut count = 0.0;
    for segment in segments {
        if let Some(confidence) = read_f64(segment.get("confidence")) {
            total += confidence;
            count += 1.0;
        }
    }

    if count == 0.0 {
        0.0
    } else {
        total / count
    }
}

fn build_checks(document: &Value, raw_ocr: &Value, liveness: &Value, ocr_confidence: f64) -> Value {
    let nik_detected = read_non_empty_string(document.get("nik")).is_some();
    let name_detected = read_non_empty_string(document.get("nama"))
        .or_else(|| read_non_empty_string(document.get("name")))
        .is_some();
    let address_detected = read_non_empty_string(document.get("alamat"))
        .or_else(|| read_non_empty_string(document.get("address")))
        .is_some();
    let birth_details_detected = read_non_empty_string(document.get("ttl"))
        .or_else(|| read_non_empty_string(document.get("tempat_tanggal_lahir")))
        .or_else(|| read_non_empty_string(document.get("date_of_birth")))
        .is_some();
    let segments_count = raw_ocr
        .get("all_segments")
        .and_then(|value| value.as_array())
        .map(|segments| segments.len())
        .unwrap_or(0);
    let face_detected = read_bool(
        liveness
            .get("metadata")
            .and_then(|value| value.get("face_detected")),
    );
    let face_coverage = read_f64(
        liveness
            .get("metadata")
            .and_then(|value| value.get("face_coverage")),
    )
    .unwrap_or(0.0);
    let liveness_passed = read_bool(liveness.get("is_real"));
    let fields_complete = [
        nik_detected,
        name_detected,
        address_detected,
        birth_details_detected,
    ]
    .iter()
    .filter(|flag| **flag)
    .count();

    json!({
        "document_type": "ktp",
        "nik_detected": nik_detected,
        "name_detected": name_detected,
        "address_detected": address_detected,
        "birth_details_detected": birth_details_detected,
        "fields_complete": fields_complete,
        "segments_count": segments_count,
        "ocr_confidence_avg": (ocr_confidence * 100.0).round() / 100.0,
        "ocr_capture_ready": ocr_confidence >= 0.55 && segments_count >= 3,
        "face_detected": face_detected,
        "face_coverage": (face_coverage * 10000.0).round() / 10000.0,
        "liveness_passed": liveness_passed,
    })
}

fn build_verification_summary(checks: &Value, liveness: &Value) -> Value {
    let nik_detected = read_bool(checks.get("nik_detected"));
    let name_detected = read_bool(checks.get("name_detected"));
    let address_detected = read_bool(checks.get("address_detected"));
    let birth_details_detected = read_bool(checks.get("birth_details_detected"));
    let ocr_capture_ready = read_bool(checks.get("ocr_capture_ready"));
    let face_detected = read_bool(checks.get("face_detected"));
    let liveness_passed = read_bool(checks.get("liveness_passed"));
    let ocr_confidence = read_f64(checks.get("ocr_confidence_avg")).unwrap_or(0.0);
    let face_coverage = read_f64(checks.get("face_coverage")).unwrap_or(0.0);
    let liveness_score = read_f64(liveness.get("liveness_score")).unwrap_or(0.0);

    let document_verified = nik_detected
        && name_detected
        && (address_detected || birth_details_detected)
        && ocr_capture_ready;
    let capture_quality =
        if ocr_confidence >= 0.82 && liveness_score >= 0.97 && face_coverage >= 0.12 {
            "strong"
        } else if ocr_confidence >= 0.62 && liveness_score >= 0.9 && face_coverage >= 0.08 {
            "good"
        } else {
            "review"
        };

    let mut risk_flags = Vec::new();
    if !nik_detected {
        risk_flags.push("nik_missing");
    }
    if !name_detected {
        risk_flags.push("name_missing");
    }
    if !face_detected {
        risk_flags.push("face_not_detected");
    }
    if !liveness_passed {
        risk_flags.push("liveness_failed");
    }
    if ocr_confidence < 0.55 {
        risk_flags.push("ocr_confidence_low");
    }

    let kyc_status = if document_verified && liveness_passed && capture_quality == "strong" {
        "enhanced"
    } else if document_verified && liveness_passed {
        "full"
    } else if document_verified || liveness_passed {
        "basic"
    } else {
        "none"
    };

    let status = match kyc_status {
        "enhanced" | "full" => "approved",
        "basic" => "manual_review",
        _ => "retry_capture",
    };

    let benefits = match kyc_status {
        "enhanced" | "full" => vec![
            "Siap dipakai untuk unlock trust badge dan limit transaksi lebih tinggi.",
            "Membantu tim Lajukan mempercepat review sengketa dan high-risk order.",
            "Lebih siap untuk UMKM onboarding, layanan driver, dan audit kepatuhan.",
        ],
        "basic" => vec![
            "Sebagian bukti identitas sudah masuk, tapi masih perlu review manual.",
            "Bisa dipakai sebagai sinyal awal untuk support dan fraud screening.",
        ],
        _ => vec![
            "Belum cukup kuat untuk dipakai sebagai identitas tepercaya.",
            "Minta user ambil ulang KTP/selfie dengan pencahayaan yang lebih baik.",
        ],
    };

    let use_cases = match kyc_status {
        "enhanced" | "full" => vec![
            "marketplace_transactions",
            "umkm_owner_onboarding",
            "driver_or_courier_activation",
            "support_dispute_resolution",
            "manual_fraud_review",
        ],
        "basic" => vec!["manual_review_queue", "support_triage", "risk_screening"],
        _ => vec!["retry_capture_flow"],
    };

    let recommended_next_steps = match kyc_status {
        "enhanced" | "full" => vec![
            "Sinkronkan hasil verifikasi ke trust profile dan unlock flow bernilai lebih tinggi.",
            "Tampilkan badge identitas terverifikasi di profile publik dan halaman transaksi.",
        ],
        "basic" => vec![
            "Minta user unggah ulang foto KTP atau selfie yang lebih jelas.",
            "Arahkan ke review manual sebelum dipakai untuk dispatch atau payout sensitif.",
        ],
        _ => vec![
            "Ulangi capture dengan KTP utuh, tidak blur, dan wajah memenuhi frame.",
            "Gunakan kamera depan dengan cahaya merata dan tanpa masker/penutup.",
        ],
    };

    let trust_score = (((ocr_confidence.min(1.0) * 0.45)
        + (liveness_score.min(1.0) * 0.45)
        + if document_verified { 0.05 } else { 0.0 }
        + if liveness_passed { 0.05 } else { 0.0 })
        * 100.0)
        .round() as i64;

    json!({
        "status": status,
        "document_type": "ktp",
        "document_country": "ID",
        "document_verified": document_verified,
        "liveness_verified": liveness_passed,
        "identity_verified": document_verified && liveness_passed,
        "manual_review_recommended": status == "manual_review" || !risk_flags.is_empty(),
        "kyc_status": kyc_status,
        "capture_quality": capture_quality,
        "trust_score": trust_score,
        "risk_flags": risk_flags,
        "benefits": benefits,
        "use_cases": use_cases,
        "recommended_next_steps": recommended_next_steps,
        "review_recommendation": if status == "approved" {
            "auto_approve"
        } else if status == "manual_review" {
            "manual_review"
        } else {
            "retry_capture"
        }
    })
}

#[derive(Serialize, Deserialize)]
struct VerificationResponse {
    status: String,
    ocr_data: Value,
    document: Value,
    liveness: Value,
    checks: Value,
    verification: Value,
    is_verified: bool,
    message: String,
}

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt::init();

    let configured_origins = parse_cors_origins();
    let mut cors = CorsLayer::new()
        .allow_methods([Method::GET, Method::POST, Method::OPTIONS])
        .allow_headers([header::AUTHORIZATION, header::CONTENT_TYPE, header::ACCEPT]);

    if !configured_origins.is_empty() {
        cors = cors.allow_origin(configured_origins);
    }

    let app = Router::new()
        .route("/health", get(|| async { "OK" }))
        .route("/v1/verify", post(handle_verification))
        .layer(cors);

    let addr = SocketAddr::from(([0, 0, 0, 0], 8080));
    println!("AI Orchestrator running on {}", addr);

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}

async fn handle_verification(mut multipart: Multipart) -> Json<VerificationResponse> {
    let mut ktp_bytes: Option<Bytes> = None;
    let mut selfie_bytes: Option<Bytes> = None;

    while let Ok(Some(field)) = multipart.next_field().await {
        let name = field
            .name()
            .map(|value| value.to_string())
            .unwrap_or_default();
        if let Ok(data) = field.bytes().await {
            if name == "ktp" {
                ktp_bytes = Some(data);
            } else if name == "selfie" {
                selfie_bytes = Some(data);
            }
        }
    }

    if ktp_bytes.is_none() || selfie_bytes.is_none() {
        return Json(VerificationResponse {
            status: "error".into(),
            ocr_data: json!({}),
            document: json!({}),
            liveness: json!({}),
            checks: json!({}),
            verification: json!({}),
            is_verified: false,
            message: "Missing KTP or selfie image".into(),
        });
    }

    let ktp = ktp_bytes.unwrap();
    let selfie = selfie_bytes.unwrap();

    let ocr_url = service_url("OCR_URL", "http://ocr_service:8000/predict");
    let liveness_url = service_url("LIVENESS_URL", "http://liveness_service:8000/check");
    let vllm_url = service_url("VLLM_URL", "http://vllm_engine:8000/v1/chat/completions");

    let (ocr_res, liveness_res) = tokio::join!(
        call_python_service(&ocr_url, ktp.clone(), "file"),
        call_python_service(&liveness_url, selfie.clone(), "file")
    );

    let raw_ocr = ocr_res.unwrap_or_else(|_| json!({}));
    let raw_text = read_non_empty_string(raw_ocr.get("raw_text_for_vllm")).unwrap_or_default();
    let cleaned_document = if raw_text.is_empty() {
        json!({})
    } else {
        clean_with_vllm(&vllm_url, &raw_text).await
    };
    let document = merge_document_data(cleaned_document, &raw_ocr);
    let liveness = liveness_res
        .unwrap_or_else(|_| json!({"is_real": false, "error_code": "LIVENESS_UNAVAILABLE"}));
    let ocr_confidence = average_ocr_confidence(&raw_ocr);
    let checks = build_checks(&document, &raw_ocr, &liveness, ocr_confidence);
    let verification = build_verification_summary(&checks, &liveness);
    let is_verified = read_bool(verification.get("identity_verified"));
    let message = match verification
        .get("status")
        .and_then(|value| value.as_str())
        .unwrap_or("retry_capture")
    {
        "approved" => "Identitas siap dipakai untuk trust flow Lajukan".to_string(),
        "manual_review" => "Verifikasi parsial, perlu review manual".to_string(),
        _ => "Capture belum cukup kuat, minta user ambil ulang".to_string(),
    };

    Json(VerificationResponse {
        status: "success".into(),
        ocr_data: document.clone(),
        document,
        liveness,
        checks,
        verification,
        is_verified,
        message,
    })
}

async fn call_python_service(
    url: &str,
    image_data: Bytes,
    field_name: &str,
) -> Result<Value, reqwest::Error> {
    let client = reqwest::Client::new();
    let form = reqwest::multipart::Form::new().part(
        field_name.to_string(),
        reqwest::multipart::Part::bytes(image_data.to_vec()).file_name("image.jpg"),
    );

    client
        .post(url)
        .multipart(form)
        .send()
        .await?
        .json::<Value>()
        .await
}

async fn clean_with_vllm(vllm_url: &str, raw_text: &str) -> Value {
    let client = reqwest::Client::new();
    let prompt = format!(
        "Kamu adalah AI ekstraktor KTP Indonesia. Ekstrak teks berikut menjadi JSON murni. \
        Hanya JSON, tanpa kata lain. Perbaiki NIK jika ada typo karakter. \
        Format: {{\"nik\":\"\",\"nama\":\"\",\"alamat\":\"\",\"ttl\":\"\"}} \
        Teks: {}",
        raw_text
    );

    let payload = json!({
        "model": env::var("VLLM_MODEL").unwrap_or_else(|_| "/models/my-fine-tuned-llama".to_string()),
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.1
    });

    match client.post(vllm_url).json(&payload).send().await {
        Ok(resp) => match resp.json::<Value>().await {
            Ok(full_res) => {
                let content = full_res["choices"][0]["message"]["content"]
                    .as_str()
                    .unwrap_or("{}");
                let cleaned = content
                    .replace("```json", "")
                    .replace("```", "")
                    .trim()
                    .to_string();
                serde_json::from_str(&cleaned).unwrap_or_else(|_| json!({ "raw_text": raw_text }))
            }
            Err(_) => json!({ "raw_text": raw_text }),
        },
        Err(_) => json!({ "raw_text": raw_text }),
    }
}
