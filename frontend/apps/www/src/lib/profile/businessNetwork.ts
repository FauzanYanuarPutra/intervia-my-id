export const BUSINESS_ROLE_OPTIONS = [
  { id: 'producer', idLabel: 'Produsen', enLabel: 'Producer' },
  { id: 'supplier', idLabel: 'Supplier', enLabel: 'Supplier' },
  { id: 'collector', idLabel: 'Pengepul', enLabel: 'Collector' },
  { id: 'distributor', idLabel: 'Distributor', enLabel: 'Distributor' },
  { id: 'reseller', idLabel: 'Reseller / Pedagang', enLabel: 'Reseller / Seller' },
  { id: 'buyer', idLabel: 'Buyer Bisnis', enLabel: 'Business Buyer' },
  { id: 'service_provider', idLabel: 'Penyedia Jasa', enLabel: 'Service Provider' },
  { id: 'logistics', idLabel: 'Logistik', enLabel: 'Logistics' },
  { id: 'asset_owner', idLabel: 'Pemilik Aset', enLabel: 'Asset Owner' },
  { id: 'connector', idLabel: 'Agen / Connector', enLabel: 'Agent / Connector' },
  { id: 'consultant', idLabel: 'Konsultan / Mentor', enLabel: 'Consultant / Mentor' },
  { id: 'community', idLabel: 'Komunitas / Asosiasi', enLabel: 'Community / Association' },
  { id: 'partner', idLabel: 'Partner Bisnis', enLabel: 'Business Partner' },
] as const;

export const BUSINESS_OPEN_TO_OPTIONS = [
  { id: 'suppliers', idLabel: 'Supplier baru', enLabel: 'New suppliers' },
  { id: 'buyers', idLabel: 'Buyer baru', enLabel: 'New buyers' },
  { id: 'resellers', idLabel: 'Reseller', enLabel: 'Resellers' },
  { id: 'distributors', idLabel: 'Distributor', enLabel: 'Distributors' },
  { id: 'partnership', idLabel: 'Kemitraan', enLabel: 'Partnerships' },
  { id: 'connectors', idLabel: 'Agen / Connector', enLabel: 'Agents / Connectors' },
  { id: 'logistics', idLabel: 'Logistik', enLabel: 'Logistics partners' },
  { id: 'communities', idLabel: 'Komunitas', enLabel: 'Communities' },
] as const;

export type BusinessNetwork = {
  roles: string[];
  offers: string[];
  needs: string[];
  capacity: string;
  open_to: string[];
  service_area: string[];
};

export const EMPTY_BUSINESS_NETWORK: BusinessNetwork = {
  roles: [],
  offers: [],
  needs: [],
  capacity: '',
  open_to: [],
  service_area: [],
};

export function toBusinessNetwork(value: unknown): BusinessNetwork {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { ...EMPTY_BUSINESS_NETWORK };
  }

  const source = value as Record<string, unknown>;
  const list = (input: unknown) =>
    Array.isArray(input)
      ? input.map(item => String(item ?? '').trim()).filter(Boolean).slice(0, 30)
      : typeof input === 'string'
        ? input.split(/[,\\n;|]/g).map(item => item.trim()).filter(Boolean).slice(0, 30)
        : [];

  return {
    roles: list(source.roles),
    offers: list(source.offers),
    needs: list(source.needs),
    capacity: typeof source.capacity === 'string' ? source.capacity.trim().slice(0, 180) : '',
    open_to: list(source.open_to ?? source.openTo),
    service_area: list(source.service_area ?? source.serviceArea),
  };
}

export function businessNetworkHasData(network: BusinessNetwork) {
  return (
    network.roles.length > 0 ||
    network.offers.length > 0 ||
    network.needs.length > 0 ||
    Boolean(network.capacity) ||
    network.open_to.length > 0 ||
    network.service_area.length > 0
  );
}
