use serde::{Deserialize, Serialize};
use serde_json::{json, Value};

const MAX_MEDIA_URL_LEN: usize = 500;
const MIN_IMAGE_DIMENSION: i32 = 320;
const MAX_IMAGE_DIMENSION: i32 = 4096;

#[derive(Debug, Clone, Deserialize, Serialize, PartialEq, Eq)]
pub(crate) struct BusinessImageInput {
    pub(crate) url: String,
    pub(crate) mime_type: String,
    pub(crate) width: i32,
    pub(crate) height: i32,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) struct ValidatedBusinessImage {
    pub(crate) url: String,
    pub(crate) mime_type: String,
    pub(crate) width: i32,
    pub(crate) height: i32,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum BusinessImageKind {
    Logo,
    Banner,
    Product,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) enum MediaValidationError {
    Url,
    MimeType,
    Dimensions,
    AspectRatio,
}

pub(crate) fn validate_business_image(
    input: BusinessImageInput,
    kind: BusinessImageKind,
) -> Result<ValidatedBusinessImage, MediaValidationError> {
    let url = input.url.trim().to_owned();
    if !valid_internal_media_url(&url) {
        return Err(MediaValidationError::Url);
    }

    let mime_type = input.mime_type.trim().to_ascii_lowercase();
    if !matches!(
        mime_type.as_str(),
        "image/webp" | "image/jpeg" | "image/png"
    ) {
        return Err(MediaValidationError::MimeType);
    }
    if !(MIN_IMAGE_DIMENSION..=MAX_IMAGE_DIMENSION).contains(&input.width)
        || !(MIN_IMAGE_DIMENSION..=MAX_IMAGE_DIMENSION).contains(&input.height)
    {
        return Err(MediaValidationError::Dimensions);
    }

    let valid_ratio = match kind {
        BusinessImageKind::Logo | BusinessImageKind::Product => input.width == input.height,
        BusinessImageKind::Banner => {
            input.width.saturating_mul(3) == input.height.saturating_mul(8)
        }
    };
    if !valid_ratio {
        return Err(MediaValidationError::AspectRatio);
    }

    Ok(ValidatedBusinessImage {
        url,
        mime_type,
        width: input.width,
        height: input.height,
    })
}

pub(crate) fn valid_internal_media_url(value: &str) -> bool {
    if value.is_empty() || value.len() > MAX_MEDIA_URL_LEN {
        return false;
    }
    let Some(filename) = value.strip_prefix("/api/forum/media/") else {
        return false;
    };
    !filename.is_empty()
        && filename.len() <= 200
        && filename
            .chars()
            .next()
            .is_some_and(|character| character.is_ascii_alphanumeric())
        && filename.chars().all(|character| {
            character.is_ascii_alphanumeric() || matches!(character, '.' | '_' | '-')
        })
}

impl ValidatedBusinessImage {
    pub(crate) fn public_metadata(&self, kind: BusinessImageKind) -> Value {
        match kind {
            // Keep the logo as a semantic identity image. `image_url` preserves
            // compatibility with existing storefront readers, but do not claim
            // `store_photo_url`: when a banner exists it must remain the primary
            // wide storefront visual regardless of upload order.
            BusinessImageKind::Logo => json!({
                "logo_url": self.url,
                "image_url": self.url,
                "logo_media": self.dimensions_metadata(),
            }),
            // Existing WWW storefront prioritizes `store_photo_url`, so the
            // cropped 8:3 banner becomes the stable hero image. The dedicated
            // cover keys remain for semantic consumers and SEO.
            BusinessImageKind::Banner => json!({
                "banner_url": self.url,
                "cover_image_url": self.url,
                "cover_url": self.url,
                "store_photo_url": self.url,
                "banner_media": self.dimensions_metadata(),
            }),
            BusinessImageKind::Product => json!({
                "image_mime_type": self.mime_type,
                "image_width": self.width,
                "image_height": self.height,
            }),
        }
    }

    fn dimensions_metadata(&self) -> Value {
        json!({
            "mime_type": self.mime_type,
            "width": self.width,
            "height": self.height,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn image(width: i32, height: i32) -> BusinessImageInput {
        BusinessImageInput {
            url: "/api/forum/media/business-image.webp".to_owned(),
            mime_type: "image/webp".to_owned(),
            width,
            height,
        }
    }

    #[test]
    fn accepts_only_internal_media_urls_and_expected_ratios() {
        assert!(validate_business_image(image(640, 640), BusinessImageKind::Logo).is_ok());
        assert!(validate_business_image(image(1600, 600), BusinessImageKind::Banner).is_ok());
        assert!(validate_business_image(image(1200, 1200), BusinessImageKind::Product).is_ok());

        let mut external = image(640, 640);
        external.url = "https://attacker.example/image.webp".to_owned();
        assert_eq!(
            validate_business_image(external, BusinessImageKind::Logo),
            Err(MediaValidationError::Url)
        );
        assert_eq!(
            validate_business_image(image(1600, 900), BusinessImageKind::Banner),
            Err(MediaValidationError::AspectRatio)
        );
    }

    #[test]
    fn banner_is_the_primary_storefront_visual_regardless_of_logo_upload_order() {
        let logo = validate_business_image(image(640, 640), BusinessImageKind::Logo).unwrap();
        let banner = validate_business_image(image(1600, 600), BusinessImageKind::Banner).unwrap();
        let logo_metadata = logo.public_metadata(BusinessImageKind::Logo);
        let banner_metadata = banner.public_metadata(BusinessImageKind::Banner);

        assert!(logo_metadata.get("store_photo_url").is_none());
        assert_eq!(
            logo_metadata["image_url"],
            "/api/forum/media/business-image.webp"
        );
        assert_eq!(
            banner_metadata["store_photo_url"],
            "/api/forum/media/business-image.webp"
        );
        assert_eq!(
            banner_metadata["banner_url"],
            "/api/forum/media/business-image.webp"
        );
    }
}
