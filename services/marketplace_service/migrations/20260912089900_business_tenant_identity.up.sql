-- Business OS V3: make the tenant identity of a business referenceable.
--
-- `businesses.id` remains the primary identity. The composite uniqueness is
-- intentionally additive so tenant-scoped child tables can enforce both the
-- business and owning organization in a single foreign key.

ALTER TABLE businesses
  ADD CONSTRAINT uq_businesses_id_organization
  UNIQUE (id, organization_id);
