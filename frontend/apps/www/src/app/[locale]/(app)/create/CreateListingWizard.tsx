            const imageUrls = Array.from(
              new Set(
                persistedMedia.map(item => item.url),
              ),
            );

            const metadata: Record<string, unknown> = {
              ...valueAsRecord(editingContentMetadata),
              form_values: savePayload.values,
              media: persistedMedia,
              image_urls: imageUrls,
              gallery_images: imageUrls,
              attributes: savePayload.attributes,
              contact_snapshot:
                savePayload.contact_snapshot,
              listing_intent: intent,
              intent,
              market_side:
                intent === 'request' ? 'demand' : 'supply',
              listing_side:
                intent === 'request' ? 'demand' : 'supply',
              marketplace_category_slug: categorySlug,
              marketplace_subcategory_slug: subcategorySlug,
              industry_ids:
                submissionIndustryIds(industryIds),
              listing_progress: {
                current_step: step,
                completion_percentage:
                  savePayload.completion_percentage,
              },
            };

            const normalizedEditingStatus =
              editingContentStatus.trim().toLowerCase();
            const editingLiveContent = [
              'active',
              'published',
              'live',
            ].includes(normalizedEditingStatus);

            const directPayload = {
              content_type:
                editingContentType ||
                category?.contentType ||
                valueAsString(metadata.content_type) ||
                'product',
              title: savePayload.title,
              summary: savePayload.summary,
              body: savePayload.body,
              pricing_mode: savePayload.pricing_mode,
              price_cents: savePayload.price_cents,
              price_unit: savePayload.price_unit,
              cover_image:
                imageUrls[0] || undefined,
              image_urls: imageUrls,
              gallery_images: imageUrls,
              category:
                editingContentType ||
                category?.contentType ||
                valueAsString(metadata.category),
              metadata,
              content_status: options.autosave
                ? editingContentStatus || 'draft'
                : editingLiveContent
                  ? 'draft'
                  : editingContentStatus || 'draft',
            };

            let response: Response | null = null;
            let payload: unknown = null;
            let lastError: unknown = null;

            for (let attempt = 0; attempt < 3; attempt += 1) {
              try {