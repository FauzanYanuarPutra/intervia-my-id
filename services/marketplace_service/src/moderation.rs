use super::*;

#[derive(Debug, Deserialize)]
pub struct ContentReportRequest {
    reason: String,
    details: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct ContentModerationRequest {
    action: String,
    reason_code: String,
    reason_note: Option<String>,
    severity: Option<String>,
    legal_hold: Option<bool>,
}

#[derive(Debug, Deserialize)]
pub struct ContentAppealRequest {
    reason: String,
}

#[derive(Debug, Deserialize)]
pub struct ContentAppealReviewRequest {
    action: String,
    note: Option<String>,
}

fn has_content_moderation_access(claims: &AccessClaims) -> bool {
    claims.roles.iter().any(|role| {
        matches!(
            role.trim().to_ascii_lowercase().as_str(),
            "moderator" | "admin" | "super_admin"
        )
    }) || claims
        .perms
        .iter()
        .any(|permission| permission.eq_ignore_ascii_case("content:moderate"))
}

fn has_content_admin_access(claims: &AccessClaims) -> bool {
    claims.roles.iter().any(|role| {
        matches!(
            role.trim().to_ascii_lowercase().as_str(),
            "admin" | "super_admin"
        )
    })
}

fn normalize_content_report_reason(raw: &str) -> Option<&'static str> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "spam" => Some("spam"),
        "fake" | "scam" | "fraud" | "penipuan" => Some("fraud_misleading"),
        "harassment" | "pelecehan" => Some("harassment"),
        "illegal" | "illegal_goods" => Some("illegal"),
        "privacy" | "privacy_personal_data" => Some("privacy_personal_data"),
        "sexual" | "sexual_pornographic" => Some("sexual_pornographic"),
        "violence" | "violence_threat" => Some("violence_threat"),
        "copyright" => Some("copyright"),
        "inaccurate" | "false_information" => Some("inaccurate"),
        "fraud_misleading" => Some("fraud_misleading"),
        "other" => Some("other"),
        _ => None,
    }
}

fn normalize_moderation_reason(raw: &str) -> Option<&'static str> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "approved_clean" => Some("approved_clean"),
        "legal_violation" => Some("legal_violation"),
        "fraud_misleading" => Some("fraud_misleading"),
        "spam" => Some("spam"),
        "irrelevant" => Some("irrelevant"),
        "unverifiable_information" => Some("unverifiable_information"),
        "copyright" => Some("copyright"),
        "prohibited_goods_services" => Some("prohibited_goods_services"),
        "sexual_pornographic" => Some("sexual_pornographic"),
        "gambling" => Some("gambling"),
        "violence_threat" => Some("violence_threat"),
        "harassment_discrimination" => Some("harassment_discrimination"),
        "privacy_personal_data" => Some("privacy_personal_data"),
        "child_safety" => Some("child_safety"),
        "impersonation" => Some("impersonation"),
        "duplicate" => Some("duplicate"),
        "quality" => Some("quality"),
        "restored_after_appeal" => Some("restored_after_appeal"),
        "other" => Some("other"),
        _ => None,
    }
}

fn normalize_moderation_severity(raw: Option<&str>) -> &'static str {
    match raw.unwrap_or("medium").trim().to_ascii_lowercase().as_str() {
        "low" => "low",
        "high" => "high",
        "critical" => "critical",
        _ => "medium",
    }
}

fn moderation_action_changes_visibility(action: &str) -> bool {
    matches!(
        action,
        "approve" | "needs_revision" | "reject" | "restrict" | "remove" | "restore"
    )
}

fn moderation_action_requires_note(action: &str) -> bool {
    matches!(
        action,
        "needs_revision" | "reject" | "restrict" | "remove" | "escalate"
    )
}

fn normalize_moderation_action(raw: &str) -> Option<&'static str> {
    match raw.trim().to_ascii_lowercase().as_str() {
        "approve" => Some("approve"),
        "needs_revision" => Some("needs_revision"),
        "reject" => Some("reject"),
        "restrict" => Some("restrict"),
        "remove" => Some("remove"),
        "restore" => Some("restore"),
        "escalate" => Some("escalate"),
        _ => None,
    }
}

pub async fn report_content(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ContentReportRequest>,
) -> impl IntoResponse {
    let reporter_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };

    let reason_code = match normalize_content_report_reason(&payload.reason) {
        Some(value) => value,
        None => return err(StatusCode::BAD_REQUEST, "unsupported report reason").into_response(),
    };

    let details = payload
        .details
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(4000).collect::<String>());

    let content_id = match Uuid::parse_str(id.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid content id").into_response(),
    };

    let content = match find_content(&state.db, &content_id.to_string()).await {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(error) => {
            tracing::error!("report_content load error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load content")
                .into_response();
        }
    };

    if content.content_type.eq_ignore_ascii_case("news") {
        return err(
            StatusCode::CONFLICT,
            "news reports must use the editorial report flow",
        )
        .into_response();
    }

    let report = match sqlx::query(
        r#"
        INSERT INTO internal_moderation.content_reports
          (content_id, reporter_user_id, reason_code, details, status)
        VALUES ($1,$2,$3,$4,'open')
        ON CONFLICT (content_id, reporter_user_id)
        WHERE status IN ('open','reviewing')
        DO UPDATE SET
          reason_code = EXCLUDED.reason_code,
          details = EXCLUDED.details,
          updated_at = NOW()
        RETURNING id, status, created_at
        "#,
    )
    .bind(content_id)
    .bind(reporter_id)
    .bind(reason_code)
    .bind(details.as_deref())
    .fetch_one(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("report_content insert error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to submit report")
                .into_response();
        }
    };

    let case = match sqlx::query(
        r#"
        INSERT INTO internal_moderation.content_moderation_cases
          (content_id, opened_by, source, status, severity, current_action, current_reason_code)
        SELECT $1,$2,'user_report','open',
               CASE
                 WHEN $3 IN ('child_safety','violence_threat','sexual_pornographic','illegal') THEN 'high'
                 ELSE 'medium'
               END,
               NULL,$3
        WHERE NOT EXISTS (
          SELECT 1
          FROM internal_moderation.content_moderation_cases
          WHERE content_id = $1
            AND status IN ('open','reviewing','escalated','appealed')
        )
        RETURNING id, severity, status
        "#,
    )
    .bind(content_id)
    .bind(reporter_id)
    .bind(reason_code)
    .fetch_optional(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("report_content case error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to open moderation case")
                .into_response();
        }
    };

    if let Some(case_row) = case {
        let case_id: Uuid = case_row.get("id");
        let severity: String = case_row.get("severity");
        let _ = sqlx::query(
            r#"
            INSERT INTO internal_moderation.content_moderation_events
              (case_id, actor_id, action, reason_code, reason_note, severity,
               previous_status, new_status, content_snapshot)
            VALUES ($1,$2,'report_received',$3,$4,$5,NULL,'open',$6)
            "#,
        )
        .bind(case_id)
        .bind(reporter_id)
        .bind(reason_code)
        .bind(details.as_deref())
        .bind(severity)
        .bind(serde_json::to_value(&content).unwrap_or_else(|_| json!({})))
        .execute(&state.db)
        .await;

        let _ = state.notification_tx.send(RealtimeNotificationEnvelope {
            user_id: content.owner_id,
            payload: json!({
                "type": "content_report_received",
                "content_id": content.id,
                "message": "Konten Anda menerima laporan dan sedang ditinjau.",
            }),
        });
    }

    (
        StatusCode::CREATED,
        Json(json!({
            "report_id": report.get::<Uuid,_>("id"),
            "status": report.get::<String,_>("status"),
            "message": "Laporan diterima dan akan ditinjau."
        })),
    )
        .into_response()
}

pub async fn list_moderation_queue(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Query(query): Query<HashMap<String, String>>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_content_moderation_access(&claims) {
        return err(StatusCode::FORBIDDEN, "moderation permission required").into_response();
    }

    let status = query
        .get("status")
        .map(|value| value.trim())
        .filter(|value| !value.is_empty());
    let severity = query
        .get("severity")
        .map(|value| value.trim())
        .filter(|value| !value.is_empty());
    let limit = query
        .get("limit")
        .and_then(|value| value.parse::<i64>().ok())
        .unwrap_or(50)
        .clamp(1, 100);

    let rows = match sqlx::query(
        r#"
        SELECT
          c.id AS case_id,
          c.content_id,
          c.status AS case_status,
          c.severity,
          c.source,
          c.assigned_to,
          c.current_action,
          c.current_reason_code,
          c.current_reason_note,
          c.legal_hold,
          c.opened_at,
          c.updated_at,
          i.owner_id,
          i.content_type,
          i.title,
          i.content_status,
          i.updated_at AS content_updated_at,
          COALESCE(
            jsonb_agg(
              jsonb_build_object(
                'id', r.id,
                'reason_code', r.reason_code,
                'details', r.details,
                'reporter_user_id', r.reporter_user_id,
                'status', r.status,
                'created_at', r.created_at
              ) ORDER BY r.created_at DESC
            ) FILTER (WHERE r.id IS NOT NULL),
            '[]'::jsonb
          ) AS reports
        FROM internal_moderation.content_moderation_cases c
        JOIN content_items i ON i.id = c.content_id
        LEFT JOIN internal_moderation.content_reports r ON r.content_id = c.content_id
        WHERE ($1::text IS NULL OR c.status = $1)
          AND ($2::text IS NULL OR c.severity = $2)
        GROUP BY
          c.id, c.content_id, c.status, c.severity, c.source, c.assigned_to,
          c.current_action, c.current_reason_code, c.current_reason_note,
          c.legal_hold, c.opened_at, c.updated_at,
          i.owner_id, i.content_type, i.title, i.content_status, i.updated_at
        ORDER BY
          CASE c.severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
          c.updated_at DESC
        LIMIT $3
        "#,
    )
    .bind(status)
    .bind(severity)
    .bind(limit)
    .fetch_all(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("list_moderation_queue error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load moderation queue",
            )
            .into_response();
        }
    };

    let items: Vec<Value> = rows
        .into_iter()
        .map(|row| {
            json!({
                "case_id": row.get::<Uuid,_>("case_id"),
                "content_id": row.get::<Uuid,_>("content_id"),
                "case_status": row.get::<String,_>("case_status"),
                "severity": row.get::<String,_>("severity"),
                "source": row.get::<String,_>("source"),
                "assigned_to": row.get::<Option<Uuid>,_>("assigned_to"),
                "current_action": row.get::<Option<String>,_>("current_action"),
                "current_reason_code": row.get::<Option<String>,_>("current_reason_code"),
                "current_reason_note": row.get::<Option<String>,_>("current_reason_note"),
                "legal_hold": row.get::<bool,_>("legal_hold"),
                "opened_at": row.get::<DateTime<Utc>,_>("opened_at"),
                "updated_at": row.get::<DateTime<Utc>,_>("updated_at"),
                "content": {
                    "owner_id": row.get::<Uuid,_>("owner_id"),
                    "content_type": row.get::<String,_>("content_type"),
                    "title": row.get::<String,_>("title"),
                    "content_status": row.get::<String,_>("content_status"),
                    "updated_at": row.get::<DateTime<Utc>,_>("content_updated_at")
                },
                "reports": row.get::<Value,_>("reports")
            })
        })
        .collect();

    (StatusCode::OK, Json(json!({ "items": items }))).into_response()
}

pub async fn get_moderation_history(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let actor_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid actor").into_response(),
    };

    let content_id = match Uuid::parse_str(id.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid content id").into_response(),
    };

    let content = match find_content(&state.db, &content_id.to_string()).await {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(_) => {
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load content").into_response()
        }
    };

    let owner_access = content.owner_id == actor_id;
    if !owner_access && !has_content_moderation_access(&claims) {
        return err(StatusCode::FORBIDDEN, "forbidden").into_response();
    }

    let cases = match sqlx::query(
        r#"
        SELECT id, status, severity, source, assigned_to, current_action, current_reason_code,
               current_reason_note, legal_hold, opened_at, updated_at, resolved_at
        FROM internal_moderation.content_moderation_cases
        WHERE content_id = $1
        ORDER BY updated_at DESC
        "#,
    )
    .bind(content_id)
    .fetch_all(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("get_moderation_history cases error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load moderation history",
            )
            .into_response();
        }
    };

    let events = match sqlx::query(
        r#"
        SELECT id, case_id, actor_id, action, reason_code, reason_note, severity,
               previous_status, new_status, legal_hold, created_at
        FROM internal_moderation.content_moderation_events
        WHERE case_id IN (
          SELECT id FROM internal_moderation.content_moderation_cases WHERE content_id = $1
        )
        ORDER BY created_at DESC
        LIMIT 200
        "#,
    )
    .bind(content_id)
    .fetch_all(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("get_moderation_history events error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load moderation events",
            )
            .into_response();
        }
    };

    let appeals = match sqlx::query(
        r#"
        SELECT id, case_id, appellant_user_id, reason, status, reviewer_id, reviewer_note,
               created_at, updated_at, resolved_at
        FROM internal_moderation.content_appeals
        WHERE case_id IN (
          SELECT id FROM internal_moderation.content_moderation_cases WHERE content_id = $1
        )
        ORDER BY created_at DESC
        "#,
    )
    .bind(content_id)
    .fetch_all(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("get_moderation_history appeals error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load appeals")
                .into_response();
        }
    };

    let map_rows = |rows: Vec<sqlx::postgres::PgRow>| {
        rows.into_iter()
            .map(|row| {
                json!({
                    "id": row.get::<Uuid,_>("id"),
                    "case_id": row.try_get::<Uuid,_>("case_id").ok(),
                    "actor_id": row.try_get::<Option<Uuid>,_>("actor_id").ok().flatten(),
                    "action": row.try_get::<String,_>("action").ok(),
                    "reason_code": row.try_get::<String,_>("reason_code").ok(),
                    "reason_note": row.try_get::<Option<String>,_>("reason_note").ok().flatten(),
                    "severity": row.try_get::<String,_>("severity").ok(),
                    "previous_status": row.try_get::<Option<String>,_>("previous_status").ok().flatten(),
                    "new_status": row.try_get::<Option<String>,_>("new_status").ok().flatten(),
                    "legal_hold": row.try_get::<bool,_>("legal_hold").ok(),
                    "created_at": row.try_get::<DateTime<Utc>,_>("created_at").ok(),
                })
            })
            .collect::<Vec<_>>()
    };

    let case_items: Vec<Value> = cases
        .into_iter()
        .map(|row| {
            json!({
                "id": row.get::<Uuid,_>("id"),
                "status": row.get::<String,_>("status"),
                "severity": row.get::<String,_>("severity"),
                "source": row.get::<String,_>("source"),
                "assigned_to": row.get::<Option<Uuid>,_>("assigned_to"),
                "current_action": row.get::<Option<String>,_>("current_action"),
                "current_reason_code": row.get::<Option<String>,_>("current_reason_code"),
                "current_reason_note": row.get::<Option<String>,_>("current_reason_note"),
                "legal_hold": row.get::<bool,_>("legal_hold"),
                "opened_at": row.get::<DateTime<Utc>,_>("opened_at"),
                "updated_at": row.get::<DateTime<Utc>,_>("updated_at"),
                "resolved_at": row.get::<Option<DateTime<Utc>>,_>("resolved_at")
            })
        })
        .collect();

    let event_items = map_rows(events);
    let appeal_items: Vec<Value> = appeals
        .into_iter()
        .map(|row| {
            json!({
                "id": row.get::<Uuid,_>("id"),
                "case_id": row.get::<Uuid,_>("case_id"),
                "appellant_user_id": row.get::<Uuid,_>("appellant_user_id"),
                "reason": row.get::<String,_>("reason"),
                "status": row.get::<String,_>("status"),
                "reviewer_id": row.get::<Option<Uuid>,_>("reviewer_id"),
                "reviewer_note": row.get::<Option<String>,_>("reviewer_note"),
                "created_at": row.get::<DateTime<Utc>,_>("created_at"),
                "updated_at": row.get::<DateTime<Utc>,_>("updated_at"),
                "resolved_at": row.get::<Option<DateTime<Utc>>,_>("resolved_at")
            })
        })
        .collect();

    (
        StatusCode::OK,
        Json(json!({
            "cases": case_items,
            "events": event_items,
            "appeals": appeal_items
        })),
    )
        .into_response()
}

pub async fn moderate_content(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ContentModerationRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_content_moderation_access(&claims) {
        return err(StatusCode::FORBIDDEN, "moderation permission required").into_response();
    }

    let actor_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid actor").into_response(),
    };

    let action = match normalize_moderation_action(&payload.action) {
        Some(value) => value,
        None => {
            return err(StatusCode::BAD_REQUEST, "unsupported moderation action").into_response()
        }
    };
    let reason_code = match normalize_moderation_reason(&payload.reason_code) {
        Some(value) => value,
        None => {
            return err(StatusCode::BAD_REQUEST, "unsupported moderation reason").into_response()
        }
    };
    let reason_note = payload
        .reason_note
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(4000).collect::<String>());

    if moderation_action_requires_note(action) && reason_note.is_none() {
        return err(
            StatusCode::BAD_REQUEST,
            "reason note is required for this moderation action",
        )
        .into_response();
    }
    if reason_code == "other" && reason_note.is_none() {
        return err(
            StatusCode::BAD_REQUEST,
            "reason note is required when reason_code is other",
        )
        .into_response();
    }

    let content_id = match Uuid::parse_str(id.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid content id").into_response(),
    };
    let existing = match find_content(&state.db, &content_id.to_string()).await {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(error) => {
            tracing::error!("moderate_content load error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load content")
                .into_response();
        }
    };

    if existing.content_type.eq_ignore_ascii_case("news") {
        return err(
            StatusCode::CONFLICT,
            "news must be moderated through CMS editorial workflow",
        )
        .into_response();
    }

    if action == "restore" && !has_content_admin_access(&claims) {
        return err(
            StatusCode::FORBIDDEN,
            "only admin can restore restricted content",
        )
        .into_response();
    }

    let severity = normalize_moderation_severity(payload.severity.as_deref());
    let legal_hold = payload
        .legal_hold
        .unwrap_or(matches!(severity, "high" | "critical"));

    let previous_status = existing.content_status.clone();
    let new_status = match action {
        "approve" | "restore" => "active",
        "needs_revision" => "draft",
        "reject" | "restrict" | "remove" => "archived",
        "escalate" => previous_status.as_str(),
        _ => previous_status.as_str(),
    };

    let case_row = match sqlx::query(
        r#"
        INSERT INTO internal_moderation.content_moderation_cases
          (content_id, opened_by, assigned_to, source, status, severity, current_action,
           current_reason_code, current_reason_note, legal_hold)
        VALUES (
          $1,$2,$2,'proactive',
          CASE WHEN $3 = 'escalate' THEN 'escalated' ELSE 'reviewing' END,
          $4,$3,$5,$6,$7
        )
        RETURNING id
        "#,
    )
    .bind(content_id)
    .bind(actor_id)
    .bind(action)
    .bind(severity)
    .bind(reason_code)
    .bind(reason_note.as_deref())
    .bind(legal_hold)
    .fetch_one(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("moderate_content case create error: {:?}", error);
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to create moderation case",
            )
            .into_response();
        }
    };
    let case_id: Uuid = case_row.get("id");

    let snapshot = serde_json::to_value(&existing).unwrap_or_else(|_| json!({}));

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(_) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to open transaction",
            )
            .into_response()
        }
    };

    let mut updated = existing.clone();
    if moderation_action_changes_visibility(action) {
        let update = sqlx::query(
            r#"
            UPDATE content_items
            SET content_status = $2,
                updated_at = NOW()
            WHERE id = $1
            RETURNING content_status
            "#,
        )
        .bind(content_id)
        .bind(new_status)
        .fetch_one(&mut *tx)
        .await;

        match update {
            Ok(_) => {}
            Err(error) => {
                let _ = tx.rollback().await;
                tracing::error!("moderate_content update error: {:?}", error);
                return err(
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "failed to apply moderation decision",
                )
                .into_response();
            }
        }
        updated.content_status = new_status.to_string();
        updated.updated_at = Utc::now();
    }

    let next_case_status = if action == "escalate" {
        "escalated"
    } else {
        "resolved"
    };

    if sqlx::query(
        r#"
        UPDATE internal_moderation.content_moderation_cases
        SET status=$2, current_action=$3, current_reason_code=$4,
            current_reason_note=$5, legal_hold=$6,
            updated_at=NOW(), resolved_at=CASE WHEN $2='resolved' THEN NOW() ELSE NULL END
        WHERE id=$1
        "#,
    )
    .bind(case_id)
    .bind(next_case_status)
    .bind(action)
    .bind(reason_code)
    .bind(reason_note.as_deref())
    .bind(legal_hold)
    .execute(&mut *tx)
    .await
    .is_err()
    {
        let _ = tx.rollback().await;
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to finalize moderation case",
        )
        .into_response();
    }

    if sqlx::query(
        r#"
        INSERT INTO internal_moderation.content_moderation_events
          (case_id, actor_id, action, reason_code, reason_note, severity,
           previous_status, new_status, content_snapshot, legal_hold, ip_address, user_agent)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11::inet,$12)
        "#,
    )
    .bind(case_id)
    .bind(actor_id)
    .bind(action)
    .bind(reason_code)
    .bind(reason_note.as_deref())
    .bind(severity)
    .bind(previous_status)
    .bind(updated.content_status.clone())
    .bind(snapshot)
    .bind(legal_hold)
    .bind(
        headers
            .get("x-real-ip")
            .or_else(|| headers.get("x-forwarded-for"))
            .and_then(|value| value.to_str().ok())
            .and_then(|value| value.split(',').next())
            .map(str::trim),
    )
    .bind(
        headers
            .get("user-agent")
            .and_then(|value| value.to_str().ok()),
    )
    .execute(&mut *tx)
    .await
    .is_err()
    {
        let _ = tx.rollback().await;
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to write moderation evidence",
        )
        .into_response();
    }

    if tx.commit().await.is_err() {
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to commit moderation decision",
        )
        .into_response();
    }

    let _ = state.notification_tx.send(RealtimeNotificationEnvelope {
        user_id: updated.owner_id,
        payload: json!({
            "type": "content_moderation_decision",
            "content_id": content_id,
            "action": action,
            "reason_code": reason_code,
            "message": "Konten Anda telah ditinjau. Buka detail untuk melihat status dan alasan."
        }),
    });

    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "case_id": case_id,
            "content_id": content_id,
            "action": action,
            "reason_code": reason_code,
            "reason_note": reason_note,
            "severity": severity,
            "legal_hold": legal_hold,
            "content_status": updated.content_status
        })),
    )
        .into_response()
}

pub async fn submit_content_appeal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(id): Path<String>,
    Json(payload): Json<ContentAppealRequest>,
) -> impl IntoResponse {
    let appellant_id = match user_id_from_auth(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    let reason = payload.reason.trim();
    if reason.is_empty() {
        return err(StatusCode::BAD_REQUEST, "appeal reason is required").into_response();
    }

    let content_id = match Uuid::parse_str(id.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid content id").into_response(),
    };
    let content = match find_content(&state.db, &content_id.to_string()).await {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(_) => {
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load content").into_response()
        }
    };
    if content.owner_id != appellant_id {
        return err(StatusCode::FORBIDDEN, "only the content owner can appeal").into_response();
    }

    let case_id: Uuid = match sqlx::query_scalar(
        r#"
        SELECT id
        FROM internal_moderation.content_moderation_cases
        WHERE content_id = $1
          AND status IN ('resolved','escalated','appealed')
        ORDER BY updated_at DESC
        LIMIT 1
        "#,
    )
    .bind(content_id)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => {
            return err(
                StatusCode::CONFLICT,
                "no moderation decision available for appeal",
            )
            .into_response()
        }
        Err(_) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to load moderation case",
            )
            .into_response()
        }
    };

    let reason = reason.chars().take(4000).collect::<String>();
    let appeal = match sqlx::query(
        r#"
        INSERT INTO internal_moderation.content_appeals
          (case_id, appellant_user_id, reason, status)
        VALUES ($1,$2,$3,'pending')
        ON CONFLICT (case_id, appellant_user_id)
        WHERE status IN ('pending','in_review')
        DO UPDATE SET reason = EXCLUDED.reason, updated_at=NOW()
        RETURNING id, status, created_at
        "#,
    )
    .bind(case_id)
    .bind(appellant_id)
    .bind(&reason)
    .fetch_one(&state.db)
    .await
    {
        Ok(value) => value,
        Err(error) => {
            tracing::error!("submit_content_appeal error: {:?}", error);
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to submit appeal")
                .into_response();
        }
    };

    let _ = sqlx::query(
        "UPDATE internal_moderation.content_moderation_cases SET status='appealed', updated_at=NOW() WHERE id=$1",
    )
    .bind(case_id)
    .execute(&state.db)
    .await;

    let _ = state.notification_tx.send(RealtimeNotificationEnvelope {
        user_id: content.owner_id,
        payload: json!({
            "type": "content_appeal_received",
            "content_id": content_id,
            "message": "Banding Anda diterima dan akan ditinjau."
        }),
    });

    (
        StatusCode::CREATED,
        Json(json!({
            "appeal_id": appeal.get::<Uuid,_>("id"),
            "status": appeal.get::<String,_>("status"),
            "message": "Banding diterima dan masuk antrean peninjauan."
        })),
    )
        .into_response()
}

pub async fn review_content_appeal(
    State(state): State<Arc<AppState>>,
    headers: HeaderMap,
    Path(appeal_id): Path<String>,
    Json(payload): Json<ContentAppealReviewRequest>,
) -> impl IntoResponse {
    let claims = match auth_claims_from_headers(&headers, &state.jwt_secret) {
        Some(value) => value,
        None => return err(StatusCode::UNAUTHORIZED, "unauthorized").into_response(),
    };
    if !has_content_moderation_access(&claims) {
        return err(StatusCode::FORBIDDEN, "moderation permission required").into_response();
    }

    let reviewer_id = match Uuid::parse_str(claims.sub.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::UNAUTHORIZED, "invalid reviewer").into_response(),
    };
    let action = match payload.action.trim().to_ascii_lowercase().as_str() {
        "uphold" => "upheld",
        "overturn" => "overturned",
        "needs_information" => "needs_information",
        _ => return err(StatusCode::BAD_REQUEST, "unsupported appeal decision").into_response(),
    };
    let note = payload
        .note
        .as_deref()
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| value.chars().take(4000).collect::<String>());

    let appeal_uuid = match Uuid::parse_str(appeal_id.trim()) {
        Ok(value) => value,
        Err(_) => return err(StatusCode::BAD_REQUEST, "invalid appeal id").into_response(),
    };

    let appeal = match sqlx::query(
        r#"
        SELECT a.id, a.case_id, a.appellant_user_id, a.status, c.content_id,
               (
                 SELECT e.actor_id
                 FROM internal_moderation.content_moderation_events e
                 WHERE e.case_id = a.case_id AND e.actor_id IS NOT NULL
                 ORDER BY e.created_at DESC
                 LIMIT 1
               ) AS last_reviewer_id
        FROM internal_moderation.content_appeals a
        JOIN internal_moderation.content_moderation_cases c ON c.id=a.case_id
        WHERE a.id=$1
        LIMIT 1
        "#,
    )
    .bind(appeal_uuid)
    .fetch_optional(&state.db)
    .await
    {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "appeal not found").into_response(),
        Err(_) => {
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load appeal").into_response()
        }
    };

    if appeal.get::<String, _>("status") != "pending"
        && appeal.get::<String, _>("status") != "in_review"
    {
        return err(StatusCode::CONFLICT, "appeal is already resolved").into_response();
    }

    if appeal.get::<Option<Uuid>, _>("last_reviewer_id") == Some(reviewer_id) {
        return err(
            StatusCode::CONFLICT,
            "appeal must be reviewed by a different person",
        )
        .into_response();
    }

    let content_id: Uuid = appeal.get("content_id");
    let current = match find_content(&state.db, &content_id.to_string()).await {
        Ok(Some(value)) => value,
        Ok(None) => return err(StatusCode::NOT_FOUND, "content not found").into_response(),
        Err(_) => {
            return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to load content").into_response()
        }
    };
    let previous_status = current.content_status.clone();

    let next_status = if action == "overturned" {
        "active"
    } else {
        previous_status.as_str()
    };

    let mut tx = match state.db.begin().await {
        Ok(value) => value,
        Err(_) => {
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to open transaction",
            )
            .into_response()
        }
    };

    if action == "overturned" {
        if sqlx::query(
            "UPDATE content_items SET content_status='active', updated_at=NOW() WHERE id=$1",
        )
        .bind(content_id)
        .execute(&mut *tx)
        .await
        .is_err()
        {
            let _ = tx.rollback().await;
            return err(
                StatusCode::INTERNAL_SERVER_ERROR,
                "failed to restore content",
            )
            .into_response();
        }
    }

    if sqlx::query(
        r#"
        UPDATE internal_moderation.content_appeals
        SET status=$2, reviewer_id=$3, reviewer_note=$4,
            resolved_at=CASE WHEN $2 IN ('upheld','overturned') THEN NOW() ELSE NULL END,
            updated_at=NOW()
        WHERE id=$1
        "#,
    )
    .bind(appeal_uuid)
    .bind(action)
    .bind(reviewer_id)
    .bind(note.as_deref())
    .execute(&mut *tx)
    .await
    .is_err()
    {
        let _ = tx.rollback().await;
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update appeal").into_response();
    }

    let case_status = if action == "needs_information" {
        "appealed"
    } else {
        "resolved"
    };
    if sqlx::query(
        "UPDATE internal_moderation.content_moderation_cases SET status=$2, updated_at=NOW() WHERE id=$1",
    )
    .bind(appeal.get::<Uuid,_>("case_id"))
    .bind(case_status)
    .execute(&mut *tx)
    .await
    .is_err()
    {
        let _ = tx.rollback().await;
        return err(StatusCode::INTERNAL_SERVER_ERROR, "failed to update moderation case").into_response();
    }

    let _ = sqlx::query(
        r#"
        INSERT INTO internal_moderation.content_moderation_events
          (case_id, actor_id, action, reason_code, reason_note, severity,
           previous_status, new_status, content_snapshot, legal_hold)
        SELECT
          c.id, $2, 'appeal_' || $3,
          CASE WHEN $3='overturned' THEN 'restored_after_appeal' ELSE 'other' END,
          $4, c.severity,
          $5, $6, $7, c.legal_hold
        FROM internal_moderation.content_moderation_cases c
        WHERE c.id=$1
        "#,
    )
    .bind(appeal.get::<Uuid, _>("case_id"))
    .bind(reviewer_id)
    .bind(action)
    .bind(note.as_deref())
    .bind(previous_status)
    .bind(next_status)
    .bind(serde_json::to_value(&current).unwrap_or_else(|_| json!({})))
    .execute(&mut *tx)
    .await;

    if tx.commit().await.is_err() {
        return err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "failed to commit appeal decision",
        )
        .into_response();
    }

    let _ = state.notification_tx.send(RealtimeNotificationEnvelope {
        user_id: appeal.get::<Uuid, _>("appellant_user_id"),
        payload: json!({
            "type": "content_appeal_decision",
            "content_id": content_id,
            "status": action,
            "message": if action == "overturned" {
                "Banding diterima; konten dipulihkan."
            } else if action == "upheld" {
                "Banding ditinjau dan keputusan sebelumnya dipertahankan."
            } else {
                "Tim moderasi memerlukan informasi tambahan dari Anda."
            }
        }),
    });

    (
        StatusCode::OK,
        Json(json!({
            "success": true,
            "appeal_id": appeal_uuid,
            "status": action,
            "content_status": next_status
        })),
    )
        .into_response()
}

