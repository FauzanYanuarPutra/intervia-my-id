BEGIN;

DROP TRIGGER IF EXISTS business_work_items_no_delete ON business_work_items;
DROP TRIGGER IF EXISTS business_work_items_update_timestamp ON business_work_items;
DROP FUNCTION IF EXISTS reject_business_work_item_hard_delete();
DROP TABLE IF EXISTS business_work_items;

DELETE FROM business_permissions
WHERE permission_key IN ('work.view','work.manage');

COMMIT;