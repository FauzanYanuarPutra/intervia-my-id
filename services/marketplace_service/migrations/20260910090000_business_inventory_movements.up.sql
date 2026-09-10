ALTER TABLE business_ingredients
    ADD CONSTRAINT uq_business_ingredients_tenant_identity
    UNIQUE (id, business_id, organization_id);

CREATE TABLE business_inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES businesses(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL,
    ingredient_id UUID NOT NULL,
    movement_type TEXT NOT NULL CHECK (
        movement_type IN (
            'sale_consumption',
            'purchase_receipt',
            'waste',
            'adjustment',
            'return_in',
            'return_out'
        )
    ),
    quantity_delta NUMERIC(20,6) NOT NULL CHECK (quantity_delta <> 0),
    quantity_before NUMERIC(20,6) NOT NULL CHECK (quantity_before >= 0),
    quantity_after NUMERIC(20,6) NOT NULL CHECK (quantity_after >= 0),
    source_type TEXT,
    source_id UUID,
    note TEXT NOT NULL DEFAULT '',
    created_by_user_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_business_inventory_movements_ingredient_tenant
        FOREIGN KEY (ingredient_id, business_id, organization_id)
        REFERENCES business_ingredients(id, business_id, organization_id)
        ON DELETE RESTRICT,
    CONSTRAINT ck_business_inventory_movements_balance
        CHECK (quantity_after = quantity_before + quantity_delta),
    CONSTRAINT ck_business_inventory_movements_source_pair
        CHECK ((source_type IS NULL) = (source_id IS NULL))
);

CREATE INDEX idx_business_inventory_movements_business_created
    ON business_inventory_movements (business_id, organization_id, created_at DESC, id DESC);

CREATE INDEX idx_business_inventory_movements_ingredient_created
    ON business_inventory_movements (business_id, organization_id, ingredient_id, created_at DESC, id DESC);

CREATE INDEX idx_business_inventory_movements_source
    ON business_inventory_movements (business_id, source_type, source_id)
    WHERE source_type IS NOT NULL AND source_id IS NOT NULL;

CREATE UNIQUE INDEX ux_business_inventory_movements_sale_source
    ON business_inventory_movements (
        business_id,
        source_type,
        source_id,
        ingredient_id,
        movement_type
    )
    WHERE source_type = 'business_sale'
      AND source_id IS NOT NULL
      AND movement_type = 'sale_consumption';
