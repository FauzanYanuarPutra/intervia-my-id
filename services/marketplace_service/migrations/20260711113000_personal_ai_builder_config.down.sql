DROP INDEX IF EXISTS personal_ai_agents_builder_template_idx;

ALTER TABLE personal_ai_agents
  DROP COLUMN IF EXISTS builder_config;
