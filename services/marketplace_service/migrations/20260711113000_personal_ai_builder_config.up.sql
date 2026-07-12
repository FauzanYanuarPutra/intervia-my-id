ALTER TABLE personal_ai_agents
  ADD COLUMN IF NOT EXISTS builder_config JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS personal_ai_agents_builder_template_idx
  ON personal_ai_agents ((builder_config->>'templateId'));
