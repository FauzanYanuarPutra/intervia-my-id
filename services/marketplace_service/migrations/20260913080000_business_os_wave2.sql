ALTER TABLE business_finance_entries
  DROP CONSTRAINT IF EXISTS business_finance_entries_entry_type_check;

ALTER TABLE business_finance_entries
  ADD CONSTRAINT business_finance_entries_entry_type_check CHECK (entry_type IN (
    -- Canonical Business OS vocabulary.
    'sale_income','other_income','capital_income',
    'inventory_expense','payroll_expense','rent_expense','utilities_expense',
    'transport_expense','marketing_expense','equipment_expense','owner_draw',
    'receivable_payment','payable_payment','other_expense',
    -- Historical values remain valid so existing ledgers are not broken by the migration.
    'ingredient_purchase','packaging_purchase','rent','utilities','salary','transport',
    'marketing','equipment','owner_capital','owner_drawing'
  ));

CREATE TABLE IF NOT EXISTS business_finance_plans (
  business_id UUID PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  owner_payroll_bps INTEGER NOT NULL DEFAULT 0 CHECK (owner_payroll_bps BETWEEN 0 AND 10000),
  staff_payroll_bps INTEGER NOT NULL DEFAULT 0 CHECK (staff_payroll_bps BETWEEN 0 AND 10000),
  working_capital_bps INTEGER NOT NULL DEFAULT 0 CHECK (working_capital_bps BETWEEN 0 AND 10000),
  operations_bps INTEGER NOT NULL DEFAULT 0 CHECK (operations_bps BETWEEN 0 AND 10000),
  reserve_bps INTEGER NOT NULL DEFAULT 0 CHECK (reserve_bps BETWEEN 0 AND 10000),
  version BIGINT NOT NULL DEFAULT 1 CHECK (version > 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT business_finance_plans_total_bps CHECK (
    owner_payroll_bps + staff_payroll_bps + working_capital_bps + operations_bps + reserve_bps <= 10000
  )
);
CREATE INDEX IF NOT EXISTS idx_business_finance_plans_org ON business_finance_plans(organization_id);

CREATE TABLE IF NOT EXISTS business_recurring_obligations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  label TEXT NOT NULL CHECK (char_length(trim(label)) BETWEEN 1 AND 160),
  entry_type TEXT NOT NULL CHECK (entry_type IN (
    'inventory_expense','payroll_expense','rent_expense','utilities_expense',
    'transport_expense','marketing_expense','equipment_expense','other_expense'
  )),
  account_key TEXT NOT NULL DEFAULT 'cash' CHECK (char_length(trim(account_key)) BETWEEN 1 AND 160),
  amount BIGINT NOT NULL CHECK (amount > 0),
  interval_days INTEGER NOT NULL CHECK (interval_days > 0 AND interval_days <= 3660),
  next_due_on DATE NOT NULL,
  active BOOLEAN NOT NULL DEFAULT TRUE,
  last_paid_at TIMESTAMPTZ,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_obligations_due
  ON business_recurring_obligations(business_id, active, next_due_on);

CREATE TABLE IF NOT EXISTS business_obligation_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  obligation_id UUID NOT NULL REFERENCES business_recurring_obligations(id) ON DELETE CASCADE,
  idempotency_key UUID NOT NULL,
  finance_entry_id UUID,
  paid_amount BIGINT NOT NULL CHECK (paid_amount > 0),
  paid_on DATE NOT NULL,
  due_on_before DATE NOT NULL,
  due_on_after DATE NOT NULL,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS business_purchases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  ingredient_id UUID NOT NULL REFERENCES business_ingredients(id) ON DELETE RESTRICT,
  idempotency_key UUID NOT NULL,
  stock_quantity_delta NUMERIC(20,6) NOT NULL CHECK (stock_quantity_delta > 0),
  total_amount BIGINT NOT NULL CHECK (total_amount > 0),
  account_key TEXT NOT NULL DEFAULT 'cash' CHECK (char_length(trim(account_key)) BETWEEN 1 AND 160),
  occurred_on DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  finance_entry_id UUID,
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (business_id, idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_business_purchases_ingredient
  ON business_purchases(business_id, ingredient_id, occurred_on DESC);

CREATE TABLE IF NOT EXISTS business_cash_shifts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  opened_by_user_id UUID NOT NULL,
  opening_cash BIGINT NOT NULL CHECK (opening_cash >= 0),
  opened_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_by_user_id UUID,
  expected_cash BIGINT,
  actual_cash BIGINT CHECK (actual_cash IS NULL OR actual_cash >= 0),
  variance BIGINT,
  closed_at TIMESTAMPTZ,
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  CHECK (
    (closed_at IS NULL AND closed_by_user_id IS NULL AND expected_cash IS NULL AND actual_cash IS NULL AND variance IS NULL)
    OR
    (closed_at IS NOT NULL AND closed_by_user_id IS NOT NULL AND expected_cash IS NOT NULL AND actual_cash IS NOT NULL AND variance = actual_cash - expected_cash)
  )
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_business_cash_shift_open
  ON business_cash_shifts(business_id) WHERE closed_at IS NULL;

CREATE TABLE IF NOT EXISTS business_product_primary_materials (
  product_id UUID PRIMARY KEY REFERENCES business_products(id) ON DELETE CASCADE,
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  ingredient_id UUID NOT NULL REFERENCES business_ingredients(id) ON DELETE RESTRICT,
  expected_input_quantity NUMERIC(20,6) NOT NULL CHECK (expected_input_quantity > 0),
  expected_output_units NUMERIC(20,6) NOT NULL CHECK (expected_output_units > 0),
  updated_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_primary_material_ingredient
  ON business_product_primary_materials(business_id, ingredient_id);

CREATE TABLE IF NOT EXISTS business_material_yield_observations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
  organization_id UUID NOT NULL,
  product_id UUID REFERENCES business_products(id) ON DELETE SET NULL,
  ingredient_id UUID NOT NULL REFERENCES business_ingredients(id) ON DELETE RESTRICT,
  input_quantity NUMERIC(20,6) NOT NULL CHECK (input_quantity > 0),
  output_units NUMERIC(20,6) NOT NULL CHECK (output_units > 0),
  input_unit TEXT NOT NULL CHECK (char_length(trim(input_unit)) BETWEEN 1 AND 40),
  observed_on DATE NOT NULL,
  note TEXT NOT NULL DEFAULT '' CHECK (char_length(note) <= 2000),
  created_by_user_id UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_business_yield_observations
  ON business_material_yield_observations(business_id, ingredient_id, observed_on DESC);