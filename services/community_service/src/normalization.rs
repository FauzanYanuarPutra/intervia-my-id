pub(crate) fn normalize_group_privacy(value: Option<String>) -> String {
    let clean = value.unwrap_or_default().trim().to_ascii_lowercase();
    match clean.as_str() {
        "private" | "hidden" => clean,
        _ => "public".to_string(),
    }
}

pub(crate) fn normalize_posting_permission(value: Option<String>) -> String {
    let clean = value.unwrap_or_default().trim().to_ascii_lowercase();
    match clean.as_str() {
        "public" | "moderator" => clean,
        _ => "member".to_string(),
    }
}

pub(crate) fn normalize_membership_permission(value: Option<String>) -> String {
    let clean = value.unwrap_or_default().trim().to_ascii_lowercase();
    match clean.as_str() {
        "approval" | "invite" => clean,
        _ => "open".to_string(),
    }
}

pub(crate) fn normalize_group_member_role(value: Option<String>) -> String {
    let clean = value.unwrap_or_default().trim().to_ascii_lowercase();
    match clean.as_str() {
        "owner" | "moderator" => clean,
        _ => "member".to_string(),
    }
}

pub(crate) fn normalize_group_member_status(value: Option<String>) -> String {
    let clean = value.unwrap_or_default().trim().to_ascii_lowercase();
    match clean.as_str() {
        "pending" | "blocked" => clean,
        _ => "active".to_string(),
    }
}

pub(crate) fn normalize_reel_tone(value: Option<String>) -> String {
    let tone = value
        .unwrap_or_else(|| "emerald".to_string())
        .trim()
        .to_ascii_lowercase();
    match tone.as_str() {
        "emerald" | "orange" | "blue" | "amber" | "rose" => tone,
        _ => "emerald".to_string(),
    }
}

pub(crate) fn normalize_reel_icon(value: Option<String>) -> String {
    let icon = value
        .unwrap_or_else(|| "supplier".to_string())
        .trim()
        .to_ascii_lowercase();
    match icon.as_str() {
        "supplier" | "marketing" | "finance" | "packaging" | "frozen" => icon,
        _ => "supplier".to_string(),
    }
}

pub(crate) fn normalize_media_type(value: Option<String>, media_url: &str) -> String {
    let requested = value.unwrap_or_default().trim().to_ascii_lowercase();
    if requested == "image" || requested == "video" {
        return requested;
    }
    let lower = media_url.to_ascii_lowercase();
    if lower.ends_with(".jpg")
        || lower.ends_with(".jpeg")
        || lower.ends_with(".png")
        || lower.ends_with(".webp")
        || lower.ends_with(".gif")
    {
        "image".to_string()
    } else {
        "video".to_string()
    }
}

pub(crate) fn normalize_reel_filter_preset(value: Option<String>) -> String {
    let preset = value
        .unwrap_or_else(|| "natural".to_string())
        .trim()
        .to_ascii_lowercase();
    match preset.as_str() {
        "natural" | "warm" | "fresh" | "cinema" | "mono" | "pop" => preset,
        _ => "natural".to_string(),
    }
}

pub(crate) fn normalize_reel_capture_mode(value: Option<String>) -> String {
    let mode = value
        .unwrap_or_else(|| "upload".to_string())
        .trim()
        .to_ascii_lowercase();
    match mode.as_str() {
        "camera" | "live" | "upload" => mode,
        _ => "upload".to_string(),
    }
}

pub(crate) fn normalize_reel_live_status(value: Option<String>, capture_mode: &str) -> String {
    if capture_mode != "live" {
        return "none".to_string();
    }

    let status = value
        .unwrap_or_else(|| "scheduled".to_string())
        .trim()
        .to_ascii_lowercase();
    match status.as_str() {
        "scheduled" | "live" | "ended" => status,
        _ => "scheduled".to_string(),
    }
}
