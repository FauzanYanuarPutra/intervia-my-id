CREATE TABLE IF NOT EXISTS crm_leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  requester_user_id UUID NULL,
  requester_email TEXT NULL,
  requester_name TEXT NULL,
  owner_id UUID NULL,
  contact_user_id UUID NULL,
  content_id UUID NULL,
  chat_room_id TEXT NULL,
  name TEXT NOT NULL,
  sector TEXT NULL,
  stage TEXT NOT NULL DEFAULT 'lead',
  source TEXT NOT NULL DEFAULT 'web',
  value_cents BIGINT NULL,
  currency TEXT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_leads_stage ON crm_leads(stage);
CREATE INDEX IF NOT EXISTS idx_crm_leads_requester_user_id ON crm_leads(requester_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_owner_id ON crm_leads(owner_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_contact_user_id ON crm_leads(contact_user_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_content_id ON crm_leads(content_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_source ON crm_leads(source);
CREATE INDEX IF NOT EXISTS idx_crm_leads_chat_room_id ON crm_leads(chat_room_id);
CREATE INDEX IF NOT EXISTS idx_crm_leads_updated_at ON crm_leads(updated_at DESC);

CREATE TABLE IF NOT EXISTS crm_activities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES crm_leads(id) ON DELETE CASCADE,
  actor_user_id UUID NULL,
  actor_role TEXT NOT NULL DEFAULT 'user',
  action TEXT NOT NULL,
  message TEXT NOT NULL,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_crm_activities_lead_id_created_at
  ON crm_activities(lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_crm_activities_created_at
  ON crm_activities(created_at DESC);
