export type BusinessResetScope =
  | 'finance_activity'
  | 'owner_capital'
  | 'sales_transactions'
  | 'inventory'
  | 'products';

export type BusinessResetRequest = {
  scopes: BusinessResetScope[];
  reason: string;
  confirmation: string;
  effective_on?: string | null;
};

export type BusinessResetCounts = {
  finance_activity: number;
  owner_capital: number;
  sales_transactions: number;
  inventory_product_records: number;
  inventory_ingredient_records: number;
  active_products: number;
  active_recipes: number;
  protected_finance_entries: number;
  sales_in_closed_period: number;
};

export type BusinessResetPreview = {
  scopes: BusinessResetScope[];
  labels: string[];
  counts: BusinessResetCounts;
  warnings: string[];
  can_apply: boolean;
};

export type BusinessResetBatch = {
  id: string;
  status: 'running' | 'completed' | 'partial' | 'failed' | string;
  scopes: BusinessResetScope[];
  affected_counts: Record<string, unknown>;
  reason: string;
  error_code: string | null;
  started_at: string;
  completed_at: string | null;
};
