export type CommunityJoinRole = {
  id: 'producers' | 'suppliers' | 'umkm-buyers' | 'logistics' | 'services' | 'needs-opportunities';
  labelId: string;
  labelEn: string;
  descriptionId: string;
  descriptionEn: string;
  icon: 'leaf' | 'truck' | 'store' | 'route' | 'briefcase' | 'sparkles';
  score: number;
};

type ListingLike = {
  title?: unknown;
  summary?: unknown;
  body?: unknown;
  category?: unknown;
  content_type?: unknown;
  metadata?: unknown;
};

function textOf(value: unknown): string {
  if (typeof value === 'string') return value.trim().toLowerCase();
  if (typeof value === 'number') return String(value);
  return '';
}

function listingText(item: ListingLike): string {
  const metadata =
    item.metadata && typeof item.metadata === 'object' && !Array.isArray(item.metadata)
      ? Object.values(item.metadata as Record<string, unknown>)
          .filter(value => typeof value === 'string' || typeof value === 'number')
          .map(value => String(value))
          .join(' ')
      : '';

  return [
    item.title,
    item.summary,
    item.body,
    item.category,
    item.content_type,
    metadata,
  ].map(textOf).filter(Boolean).join(' ');
}

const ROLE_RULES = [
  {
    id: 'producers',
    keywords: ['petani','peternak','nelayan','perkebunan','kebun','pabrik','produsen','produksi','manufaktur','pengrajin','hasil tani','hasil laut','bahan mentah'],
    labelId: 'Petani & Produsen',
    labelEn: 'Farmers & Producers',
    descriptionId: 'Produksi barang, bahan baku, atau hasil usaha dari sumber langsung.',
    descriptionEn: 'Produces goods, raw materials, or products directly.',
    icon: 'leaf',
  },
  {
    id: 'suppliers',
    keywords: ['supplier','distributor','distribusi','tengkulak','pengepul','grosir','wholesale','kulakan','stok','reseller','agen','pemasok'],
    labelId: 'Pengepul, Supplier & Distributor',
    labelEn: 'Collectors, Suppliers & Distributors',
    descriptionId: 'Menghubungkan barang dari produsen ke usaha atau pembeli berikutnya.',
    descriptionEn: 'Moves goods from producers to businesses or downstream buyers.',
    icon: 'truck',
  },
  {
    id: 'logistics',
    keywords: ['logistik','ekspedisi','kurir','pengiriman','angkutan','transportasi','truk','pickup','delivery','cargo','sewa kendaraan','driver'],
    labelId: 'Logistik & Transportasi',
    labelEn: 'Logistics & Transport',
    descriptionId: 'Membantu perpindahan barang, pengiriman, kendaraan, dan operasional lapangan.',
    descriptionEn: 'Supports delivery, transport, vehicles, and field operations.',
    icon: 'route',
  },
  {
    id: 'services',
    keywords: ['jasa','konsultan','freelance','desain','developer','marketing','iklan','fotografi','videografi','akuntansi','legal','maintenance','servis','partner','percetakan'],
    labelId: 'Jasa & Partner Usaha',
    labelEn: 'Services & Business Partners',
    descriptionId: 'Menyediakan jasa atau menjadi partner untuk membantu operasional usaha.',
    descriptionEn: 'Provides services or partners with businesses on operations.',
    icon: 'briefcase',
  },
  {
    id: 'umkm-buyers',
    keywords: ['umkm','warung','toko','kedai','kafe','cafe','restoran','bakery','kuliner','usaha makanan','retail','merchant','pembeli','butuh bahan'],
    labelId: 'UMKM & Pembeli Usaha',
    labelEn: 'UMKM & Business Buyers',
    descriptionId: 'Menjalankan usaha atau membeli barang dan jasa untuk kebutuhan usaha.',
    descriptionEn: 'Runs a business or buys goods and services for business needs.',
    icon: 'store',
  },
] as const;

export function classifyCommunityJoinRole(listings: ListingLike[]): CommunityJoinRole {
  const scores = new Map<string, number>();

  for (const item of listings.filter(Boolean)) {
    const content = listingText(item);
    for (const rule of ROLE_RULES) {
      let score = 0;
      for (const keyword of rule.keywords) {
        if (content.includes(keyword)) score += keyword.includes(' ') ? 3 : 2;
      }
      if (
        content.includes('butuh') ||
        content.includes('mencari') ||
        content.includes('kebutuhan')
      ) {
        if (rule.id === 'umkm-buyers') score += 2;
      }
      scores.set(rule.id, (scores.get(rule.id) || 0) + score);
    }
  }

  const best = ROLE_RULES
    .map(rule => ({ rule, score: scores.get(rule.id) || 0 }))
    .sort((a, b) => b.score - a.score)[0];

  if (best && best.score > 0) {
    return {
      id: best.rule.id,
      score: best.score,
      labelId: best.rule.labelId,
      labelEn: best.rule.labelEn,
      descriptionId: best.rule.descriptionId,
      descriptionEn: best.rule.descriptionEn,
      icon: best.rule.icon,
    };
  }

  return {
    id: 'needs-opportunities',
    labelId: 'Punya, Butuh & Peluang',
    labelEn: 'Have, Need & Opportunities',
    descriptionId: 'Untuk kebutuhan, peluang, permintaan, dan koneksi usaha yang belum masuk kategori spesifik.',
    descriptionEn: 'For needs, opportunities, requests, and business connections without a specific category.',
    icon: 'sparkles',
    score: 0,
  };
}

export function hasCommunityJoinReadyListing(listings: ListingLike[]): boolean {
  return listings.some(item => {
    const title = textOf(item.title);
    const category = textOf(item.category) || textOf(item.content_type);
    return title.length >= 3 && category.length >= 2;
  });
}
