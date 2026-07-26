ALTER TABLE content_items
  DROP COLUMN IF EXISTS marketplace_subcategory_id,
  DROP COLUMN IF EXISTS marketplace_category_id;

DROP TABLE IF EXISTS marketplace_search_synonyms;
DROP TABLE IF EXISTS listing_attribute_values;
DROP TABLE IF EXISTS listing_attributes;
DROP TABLE IF EXISTS listing_tags;
DROP TABLE IF EXISTS listing_industries;
DROP TABLE IF EXISTS industries;
DROP TABLE IF EXISTS marketplace_subcategories;
DROP TABLE IF EXISTS marketplace_categories;
