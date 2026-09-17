#![cfg_attr(not(test), allow(dead_code))]

use uuid::Uuid;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub(crate) struct BusinessScope {
    pub(crate) organization_id: Uuid,
    pub(crate) business_id: Uuid,
    pub(crate) location_id: Option<Uuid>,
}

impl BusinessScope {
    pub(crate) const fn new(
        organization_id: Uuid,
        business_id: Uuid,
        location_id: Option<Uuid>,
    ) -> Self {
        Self {
            organization_id,
            business_id,
            location_id,
        }
    }

    pub(crate) const fn without_location(organization_id: Uuid, business_id: Uuid) -> Self {
        Self::new(organization_id, business_id, None)
    }

    pub(crate) const fn at_location(self, location_id: Uuid) -> Self {
        Self::new(self.organization_id, self.business_id, Some(location_id))
    }
}
