use std::env;

use crate::PostRow;

pub(crate) fn upload_dir() -> String {
    env::var("COMMUNITY_UPLOAD_DIR").unwrap_or_else(|_| "./uploads/forum".to_string())
}

pub(crate) fn media_public_path() -> String {
    env::var("COMMUNITY_MEDIA_PUBLIC_PATH").unwrap_or_else(|_| "/api/forum/media".to_string())
}

pub(crate) fn safe_file_name(name: &str) -> String {
    name.chars()
        .map(|ch| {
            if ch.is_ascii_alphanumeric() || ch == '.' || ch == '_' || ch == '-' {
                ch
            } else {
                '_'
            }
        })
        .collect::<String>()
        .trim_matches('.')
        .chars()
        .take(120)
        .collect()
}

pub(crate) fn extension_for(file_name: Option<&str>, content_type: &str) -> &'static str {
    match content_type.to_ascii_lowercase().as_str() {
        "video/mp4" => ".mp4",
        "video/webm" => ".webm",
        "video/quicktime" => ".mov",
        "video/x-m4v" => ".m4v",
        "image/jpeg" | "image/jpg" => ".jpg",
        "image/png" => ".png",
        "image/webp" => ".webp",
        "image/gif" => ".gif",
        "image/bmp" => ".bmp",
        "image/avif" => ".avif",
        "image/heic" => ".heic",
        "image/heif" => ".heif",
        _ => file_name
            .map(str::to_ascii_lowercase)
            .as_deref()
            .map(|name| {
                if name.ends_with(".jpeg") || name.ends_with(".jpg") {
                    ".jpg"
                } else {
                    ""
                }
            })
            .filter(|extension| !extension.is_empty())
            .unwrap_or(".bin"),
    }
}

pub(crate) fn content_type_for_filename(name: &str) -> &'static str {
    let lower = name.to_ascii_lowercase();
    if lower.ends_with(".mp4") {
        "video/mp4"
    } else if lower.ends_with(".webm") {
        "video/webm"
    } else if lower.ends_with(".mov") {
        "video/quicktime"
    } else if lower.ends_with(".m4v") {
        "video/x-m4v"
    } else if lower.ends_with(".png") {
        "image/png"
    } else if lower.ends_with(".webp") {
        "image/webp"
    } else if lower.ends_with(".gif") {
        "image/gif"
    } else if lower.ends_with(".bmp") {
        "image/bmp"
    } else if lower.ends_with(".avif") {
        "image/avif"
    } else if lower.ends_with(".heic") {
        "image/heic"
    } else if lower.ends_with(".heif") {
        "image/heif"
    } else {
        "application/octet-stream"
    }
}

pub(crate) fn is_allowed_image_type(content_type: &str, file_name: Option<&str>) -> bool {
    let _ = file_name;
    matches!(
        content_type.to_ascii_lowercase().as_str(),
        "image/jpeg"
            | "image/jpg"
            | "image/png"
            | "image/gif"
            | "image/webp"
            | "image/bmp"
            | "image/heic"
            | "image/heif"
            | "image/avif"
    )
}

pub(crate) fn is_allowed_video_type(content_type: &str, file_name: Option<&str>) -> bool {
    let _ = file_name;
    matches!(
        content_type.to_ascii_lowercase().as_str(),
        "video/mp4" | "video/webm" | "video/quicktime" | "video/x-m4v"
    )
}

pub(crate) fn is_allowed_media_type(content_type: &str, allow_video: bool, file_name: Option<&str>) -> bool {
    is_allowed_image_type(content_type, file_name)
        || (allow_video && is_allowed_video_type(content_type, file_name))
}

pub(crate) fn has_ftyp_signature(bytes: &[u8]) -> bool {
    bytes.windows(4).take(32).any(|window| window == b"ftyp")
}

pub(crate) fn has_valid_media_signature(bytes: &[u8], extension: &str) -> bool {
    match extension {
        ".jpg" => bytes.starts_with(&[0xff, 0xd8, 0xff]),
        ".png" => bytes.starts_with(&[0x89, b'P', b'N', b'G', 0x0d, 0x0a, 0x1a, 0x0a]),
        ".gif" => bytes.starts_with(b"GIF87a") || bytes.starts_with(b"GIF89a"),
        ".webp" => bytes.len() >= 12 && bytes.starts_with(b"RIFF") && &bytes[8..12] == b"WEBP",
        ".bmp" => bytes.starts_with(b"BM"),
        ".avif" | ".heic" | ".heif" | ".mp4" | ".mov" | ".m4v" => has_ftyp_signature(bytes),
        ".webm" => bytes.starts_with(&[0x1a, 0x45, 0xdf, 0xa3]),
        _ => false,
    }
}

pub(crate) fn is_video_url(value: &str) -> bool {
    let lower = value.to_ascii_lowercase();

    lower.ends_with(".mp4")
        || lower.ends_with(".webm")
        || lower.ends_with(".mov")
        || lower.ends_with(".m4v")
        || lower.ends_with(".avi")
        || lower.ends_with(".mkv")
        || lower.ends_with(".3gp")
}

pub(crate) fn clean_feed_media_url(value: &str) -> Option<String> {
    let clean = value.trim();
    if clean.is_empty() || clean.len() > 2_000 {
        return None;
    }

    let lower = clean.to_ascii_lowercase();
    if lower.contains("/images/company/")
        || lower.contains("placeholder")
        || lower.contains("no-image")
        || lower.contains("image-not-available")
        || lower.contains("default_image")
    {
        return None;
    }

    Some(clean.to_string())
}

pub(crate) fn first_feed_media_url(thread_urls: &[String], root_post: Option<&PostRow>) -> Option<String> {
    thread_urls
        .iter()
        .chain(
            root_post
                .into_iter()
                .flat_map(|post| post.image_urls.iter()),
        )
        .find_map(|url| clean_feed_media_url(url))
}

