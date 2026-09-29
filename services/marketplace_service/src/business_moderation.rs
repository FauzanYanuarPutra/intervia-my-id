            "uploader_user_id": row.get::<Uuid, _>("uploader_user_id"),
            "uploader_name": row.get::<Option<String>, _>("uploader_name_snapshot"),
            "uploader_username": row.get::<Option<String>, _>("uploader_username_snapshot"),
            "is_primary": is_primary,
            "created_at": row.get::<DateTime<Utc>, _>("created_at"),
        }));
    }

    owner_gallery.extend(approved_urls);
    owner_gallery.truncate(24);

    let still_approved = placement
        .as_ref()
        .map(|(media_url, _, _)| {
            items
                .iter()
                .any(|item| item.get("url").and_then(Value::as_str) == Some(media_url.as_str()))
        })
        .unwrap_or(false);

    let mut object = metadata.as_object_mut().cloned().unwrap_or_default();
    object.insert("gallery_media".to_string(), json!(owner_gallery));
    object.insert("gallery_media_items".to_string(), Value::Array(items));
    if let Some(primary) = primary_url {
        object.insert("gallery_media_primary".to_string(), json!(primary));
    } else {
        object.remove("gallery_media_primary");
    }

    if let Some((media_url, placement, approved)) = placement {
        if approved && still_approved {
            match placement {
                "cover" => {
                    object.insert("store_photo_url".to_string(), json!(media_url));