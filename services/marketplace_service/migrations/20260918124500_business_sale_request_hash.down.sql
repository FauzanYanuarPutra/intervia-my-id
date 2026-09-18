ALTER TABLE business_sales
  DROP CONSTRAINT IF EXISTS business_sales_request_hash_check;

ALTER TABLE business_sales
  DROP COLUMN IF EXISTS request_hash;
