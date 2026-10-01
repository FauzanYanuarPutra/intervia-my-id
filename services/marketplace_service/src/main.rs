        .get("x-lajukan-autosave")
        .and_then(|value| value.to_str().ok())
        .is_some_and(|value| value.trim() == "1" || value.eq_ignore_ascii_case("true"));

    let mut content_status = normalize_content_status(payload.content_status)
        .unwrap_or_else(|| existing.content_status.clone().to_lowercase());
    if !is_valid_content_status(&content_status) {
        return err(StatusCode::BAD_REQUEST, "invalid content_status").into_response();
    }

    // Any live marketplace status must not remain live while its owner is
    // changing substantive content. Autosave may keep the live state temporarily;
    // an explicit save moves the revision back into the moderation queue.
    let was_live_before_edit = !autosave
        && matches!(
            existing.content_status.trim().to_ascii_lowercase().as_str(),
            "active" | "published" | "live"
        );
    if was_live_before_edit && content_status.eq_ignore_ascii_case("active") {
        content_status = "draft".to_string();
    }
    let owner_revision_pending =
        was_live_before_edit && content_status.eq_ignore_ascii_case("draft");

    let pricing_mode = normalize_pricing_mode(payload.pricing_mode)
        .unwrap_or_else(|| existing.pricing_mode.clone());
    if !is_valid_pricing_mode(&pricing_mode) {
        return err(StatusCode::BAD_REQUEST, "invalid pricing_mode").into_response();