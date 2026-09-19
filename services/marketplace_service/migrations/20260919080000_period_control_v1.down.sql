BEGIN;

DROP TRIGGER IF EXISTS trg_business_close_events_append_only ON business_close_events;
DROP TRIGGER IF EXISTS trg_business_close_commands_append_only ON business_close_commands;
DROP TABLE IF EXISTS business_close_events;
DROP TABLE IF EXISTS business_close_commands;
DROP TABLE IF EXISTS business_day_closes;
DROP TABLE IF EXISTS business_accounting_periods;

COMMIT;
