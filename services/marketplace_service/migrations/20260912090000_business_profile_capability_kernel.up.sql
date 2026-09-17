-- Business OS V3 Wave 2C.2: universal business profile and capability kernel.
--
-- The legacy businesses.capability_key remains a compatibility projection.
-- New operational decisions use the typed business profile and capability rows.

CREATE TABLE business_templates (
  template_key TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  name TEXT NOT NULL,
  vertical_group TEXT NOT NULL,
  default_currency TEXT NOT NULL CHECK (default_currency ~ '^[A-Z]{3}$'),
  default_timezone TEXT NOT NULL,
  default_costing_policy TEXT NOT NULL
    CHECK (default_costing_policy IN ('weighted_average', 'fifo', 'specific_identification')),
  default_accounting_mode TEXT NOT NULL
    CHECK (default_accounting_mode IN ('simple', 'advanced')),
  default_approval_policy TEXT NOT NULL
    CHECK (default_approval_policy IN ('owner_managed', 'role_based')),
  default_document_prefix TEXT NOT NULL
    CHECK (default_document_prefix ~ '^[A-Z0-9][A-Z0-9-]{0,15}$'),
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (template_key, version),
  CONSTRAINT chk_business_templates_key
    CHECK (template_key ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT chk_business_templates_timezone
    CHECK (length(btrim(default_timezone)) BETWEEN 1 AND 64)
);

CREATE UNIQUE INDEX uq_business_templates_active_key
  ON business_templates (template_key)
  WHERE status = 'active';

CREATE TABLE business_capability_definitions (
  capability_key TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'retired')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT chk_business_capability_definitions_key
    CHECK (capability_key ~ '^[a-z][a-z0-9_]{1,63}$')
);

CREATE TABLE business_template_capabilities (
  template_key TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  capability_key TEXT NOT NULL
    REFERENCES business_capability_definitions(capability_key) ON DELETE RESTRICT,
  enabled_by_default BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (template_key, template_version, capability_key),
  FOREIGN KEY (template_key, template_version)
    REFERENCES business_templates(template_key, version) ON DELETE RESTRICT
);

CREATE INDEX idx_business_template_capabilities_enabled
  ON business_template_capabilities (template_key, template_version, capability_key)
  WHERE enabled_by_default;

CREATE TABLE business_profiles (
  business_id UUID PRIMARY KEY,
  organization_id UUID NOT NULL,
  template_key TEXT NOT NULL,
  template_version INTEGER NOT NULL,
  currency TEXT NOT NULL CHECK (currency ~ '^[A-Z]{3}$'),
  timezone TEXT NOT NULL,
  costing_policy TEXT NOT NULL
    CHECK (costing_policy IN ('weighted_average', 'fifo', 'specific_identification')),
  accounting_mode TEXT NOT NULL
    CHECK (accounting_mode IN ('simple', 'advanced')),
  approval_policy TEXT NOT NULL
    CHECK (approval_policy IN ('owner_managed', 'role_based')),
  branch_mode TEXT NOT NULL DEFAULT 'single'
    CHECK (branch_mode IN ('single', 'multi')),
  negative_stock_policy TEXT NOT NULL DEFAULT 'deny'
    CHECK (negative_stock_policy IN ('deny', 'allow_with_approval')),
  business_day_cutoff TIME NOT NULL DEFAULT '23:59:59',
  document_prefix TEXT NOT NULL
    CHECK (document_prefix ~ '^[A-Z0-9][A-Z0-9-]{0,15}$'),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_by_user_id UUID NOT NULL,
  updated_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT fk_business_profiles_business_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES businesses(id, organization_id) ON DELETE RESTRICT,
  CONSTRAINT fk_business_profiles_template_version
    FOREIGN KEY (template_key, template_version)
    REFERENCES business_templates(template_key, version) ON DELETE RESTRICT,
  CONSTRAINT chk_business_profiles_timezone
    CHECK (length(btrim(timezone)) BETWEEN 1 AND 64),
  UNIQUE (business_id, organization_id)
);

CREATE INDEX idx_business_profiles_organization_template
  ON business_profiles (organization_id, template_key, updated_at DESC);

CREATE TABLE business_capabilities (
  business_id UUID NOT NULL,
  organization_id UUID NOT NULL,
  capability_key TEXT NOT NULL
    REFERENCES business_capability_definitions(capability_key) ON DELETE RESTRICT,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  source TEXT NOT NULL DEFAULT 'template'
    CHECK (source IN ('template', 'manual')),
  created_by_user_id UUID NOT NULL,
  updated_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (business_id, capability_key),
  CONSTRAINT fk_business_capabilities_profile_scope
    FOREIGN KEY (business_id, organization_id)
    REFERENCES business_profiles(business_id, organization_id) ON DELETE CASCADE
);

CREATE INDEX idx_business_capabilities_active_scope
  ON business_capabilities (business_id, organization_id, capability_key)
  WHERE enabled;

INSERT INTO business_templates (
  template_key, version, name, vertical_group, default_currency,
  default_timezone, default_costing_policy, default_accounting_mode,
  default_approval_policy, default_document_prefix
) VALUES
  ('general', 1, 'Usaha Umum', 'general', 'IDR', 'Asia/Jakarta', 'weighted_average', 'simple', 'owner_managed', 'LJK'),
  ('juice_fnb', 1, 'Juice & F&B', 'food_beverage', 'IDR', 'Asia/Jakarta', 'weighted_average', 'simple', 'owner_managed', 'FNB'),
  ('laundry', 1, 'Laundry', 'services', 'IDR', 'Asia/Jakarta', 'weighted_average', 'simple', 'owner_managed', 'LDR'),
  ('ac_field_service', 1, 'AC & Field Service', 'services', 'IDR', 'Asia/Jakarta', 'weighted_average', 'simple', 'owner_managed', 'SVC'),
  ('mart_retail', 1, 'Mart & Retail', 'retail', 'IDR', 'Asia/Jakarta', 'weighted_average', 'simple', 'owner_managed', 'RTL');

INSERT INTO business_capability_definitions (capability_key, name, description) VALUES
  ('business_core', 'Business Core', 'Canonical business identity and configuration'),
  ('catalog', 'Catalog', 'Products, services, variants, units and pricing'),
  ('services', 'Services', 'Service catalog and service delivery'),
  ('customers', 'Customers', 'Customer records and transaction linkage'),
  ('suppliers', 'Suppliers', 'Supplier records and purchasing linkage'),
  ('sales', 'Sales', 'Sales and order lifecycle'),
  ('payments', 'Payments', 'Cash and non-cash payment recording'),
  ('finance_basic', 'Simple Finance', 'Simple money-in and money-out experience'),
  ('reporting', 'Reporting', 'Canonical operational reports'),
  ('inventory', 'Inventory', 'Stock movements and balances'),
  ('recipes', 'Recipes and BOM', 'Recipe and bill-of-material consumption'),
  ('production', 'Production', 'Production and batch lifecycle'),
  ('procurement', 'Procurement', 'Purchase order and receiving lifecycle'),
  ('appointments', 'Appointments', 'Booking and appointment scheduling'),
  ('work_orders', 'Work Orders', 'Operational work tracking'),
  ('field_service', 'Field Service', 'Dispatch and technician workflows'),
  ('laundry_tracking', 'Laundry Tracking', 'Laundry intake and configurable processing stages'),
  ('assets', 'Assets', 'Owned and customer equipment lifecycle'),
  ('payroll', 'Payroll', 'Workforce pay and commission primitives'),
  ('accounting', 'Accounting', 'Double-entry accounting workspace'),
  ('approval', 'Approval', 'Policy-controlled sensitive actions'),
  ('multi_branch', 'Multi Branch', 'Multiple operational branches'),
  ('multi_warehouse', 'Multi Warehouse', 'Multiple stock locations'),
  ('pos', 'Point of Sale', 'Low-latency cashier sales'),
  ('barcode', 'Barcode', 'Barcode lookup and scanning'),
  ('settlements', 'Settlements', 'Payment-channel and platform settlement reconciliation'),
  ('cashier_shifts', 'Cashier Shifts', 'Cash drawer and cashier shift lifecycle'),
  ('daily_close', 'Daily Close', 'Auditable day and shift closing'),
  ('supporting_documents', 'Supporting Documents', 'Evidence and business document attachments');

WITH template_capabilities(template_key, capability_key) AS (
  VALUES
    ('general', 'business_core'), ('general', 'catalog'),
    ('general', 'customers'), ('general', 'finance_basic'),
    ('general', 'payments'), ('general', 'reporting'), ('general', 'sales'),
    ('general', 'supporting_documents'),

    ('juice_fnb', 'business_core'), ('juice_fnb', 'catalog'),
    ('juice_fnb', 'customers'), ('juice_fnb', 'suppliers'),
    ('juice_fnb', 'sales'), ('juice_fnb', 'payments'),
    ('juice_fnb', 'finance_basic'), ('juice_fnb', 'reporting'),
    ('juice_fnb', 'inventory'), ('juice_fnb', 'recipes'),
    ('juice_fnb', 'procurement'), ('juice_fnb', 'pos'),
    ('juice_fnb', 'settlements'), ('juice_fnb', 'cashier_shifts'),
    ('juice_fnb', 'daily_close'), ('juice_fnb', 'supporting_documents'),

    ('laundry', 'business_core'), ('laundry', 'catalog'),
    ('laundry', 'services'), ('laundry', 'customers'),
    ('laundry', 'sales'), ('laundry', 'payments'),
    ('laundry', 'finance_basic'), ('laundry', 'reporting'),
    ('laundry', 'appointments'), ('laundry', 'work_orders'),
    ('laundry', 'laundry_tracking'), ('laundry', 'daily_close'),
    ('laundry', 'supporting_documents'),

    ('ac_field_service', 'business_core'), ('ac_field_service', 'catalog'),
    ('ac_field_service', 'services'), ('ac_field_service', 'customers'),
    ('ac_field_service', 'suppliers'), ('ac_field_service', 'sales'),
    ('ac_field_service', 'payments'), ('ac_field_service', 'finance_basic'),
    ('ac_field_service', 'reporting'), ('ac_field_service', 'inventory'),
    ('ac_field_service', 'procurement'), ('ac_field_service', 'appointments'),
    ('ac_field_service', 'work_orders'), ('ac_field_service', 'field_service'),
    ('ac_field_service', 'assets'), ('ac_field_service', 'supporting_documents'),

    ('mart_retail', 'business_core'), ('mart_retail', 'catalog'),
    ('mart_retail', 'customers'), ('mart_retail', 'suppliers'),
    ('mart_retail', 'sales'), ('mart_retail', 'payments'),
    ('mart_retail', 'finance_basic'), ('mart_retail', 'reporting'),
    ('mart_retail', 'inventory'), ('mart_retail', 'procurement'),
    ('mart_retail', 'pos'), ('mart_retail', 'barcode'),
    ('mart_retail', 'settlements'), ('mart_retail', 'cashier_shifts'),
    ('mart_retail', 'daily_close'), ('mart_retail', 'supporting_documents')
)
INSERT INTO business_template_capabilities (
  template_key, template_version, capability_key, enabled_by_default
)
SELECT template_key, 1, capability_key, TRUE
FROM template_capabilities;

INSERT INTO business_profiles (
  business_id, organization_id, template_key, template_version,
  currency, timezone, costing_policy, accounting_mode, approval_policy,
  document_prefix, created_by_user_id, updated_by_user_id,
  created_at, updated_at
)
SELECT
  business.id,
  business.organization_id,
  CASE business.capability_key
    WHEN 'food_beverage' THEN 'juice_fnb'
    WHEN 'retail' THEN 'mart_retail'
    ELSE 'general'
  END,
  1,
  'IDR',
  'Asia/Jakarta',
  'weighted_average',
  'simple',
  'owner_managed',
  CASE business.capability_key
    WHEN 'food_beverage' THEN 'FNB'
    WHEN 'retail' THEN 'RTL'
    ELSE 'LJK'
  END,
  business.created_by_user_id,
  business.created_by_user_id,
  business.created_at,
  business.updated_at
FROM businesses business
ON CONFLICT (business_id) DO NOTHING;

INSERT INTO business_capabilities (
  business_id, organization_id, capability_key, enabled, source,
  created_by_user_id, updated_by_user_id, created_at, updated_at
)
SELECT
  profile.business_id,
  profile.organization_id,
  mapping.capability_key,
  TRUE,
  'template',
  profile.created_by_user_id,
  profile.updated_by_user_id,
  profile.created_at,
  profile.updated_at
FROM business_profiles profile
JOIN business_template_capabilities mapping
  ON mapping.template_key = profile.template_key
 AND mapping.template_version = profile.template_version
 AND mapping.enabled_by_default
ON CONFLICT (business_id, capability_key) DO NOTHING;

CREATE OR REPLACE FUNCTION initialize_business_profile()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  selected_template_key TEXT;
  selected_document_prefix TEXT;
BEGIN
  selected_template_key := CASE NEW.capability_key
    WHEN 'food_beverage' THEN 'juice_fnb'
    WHEN 'retail' THEN 'mart_retail'
    ELSE 'general'
  END;
  selected_document_prefix := CASE selected_template_key
    WHEN 'juice_fnb' THEN 'FNB'
    WHEN 'mart_retail' THEN 'RTL'
    ELSE 'LJK'
  END;

  INSERT INTO business_profiles (
    business_id, organization_id, template_key, template_version,
    currency, timezone, costing_policy, accounting_mode, approval_policy,
    document_prefix, created_by_user_id, updated_by_user_id,
    created_at, updated_at
  ) VALUES (
    NEW.id, NEW.organization_id, selected_template_key, 1,
    'IDR', 'Asia/Jakarta', 'weighted_average', 'simple', 'owner_managed',
    selected_document_prefix, NEW.created_by_user_id, NEW.created_by_user_id,
    NEW.created_at, NEW.updated_at
  )
  ON CONFLICT (business_id) DO NOTHING;

  INSERT INTO business_capabilities (
    business_id, organization_id, capability_key, enabled, source,
    created_by_user_id, updated_by_user_id, created_at, updated_at
  )
  SELECT
    NEW.id, NEW.organization_id, mapping.capability_key, TRUE, 'template',
    NEW.created_by_user_id, NEW.created_by_user_id, NEW.created_at, NEW.updated_at
  FROM business_template_capabilities mapping
  WHERE mapping.template_key = selected_template_key
    AND mapping.template_version = 1
    AND mapping.enabled_by_default
  ON CONFLICT (business_id, capability_key) DO NOTHING;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_business_initialize_profile
AFTER INSERT ON businesses
FOR EACH ROW EXECUTE FUNCTION initialize_business_profile();
