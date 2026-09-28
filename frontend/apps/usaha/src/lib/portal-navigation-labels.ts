import { portalSectionLabel } from './portal-navigation';
import type { PortalSection } from './portal-types';

const userFacingLabels: Partial<Record<PortalSection, string>> = {
  channels: 'Jual Online',
  buyerPage: 'Toko Saya',
};

export function portalSectionUserLabel(section: PortalSection) {
  return userFacingLabels[section] ?? portalSectionLabel(section);
}
