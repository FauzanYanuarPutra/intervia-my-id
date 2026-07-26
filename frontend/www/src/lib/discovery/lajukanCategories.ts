export type LajukanLocale = 'id' | 'en';

export type CategoryBadgeTone =
  | 'primary'
  | 'expert'
  | 'technical'
  | 'premium'
  | 'earning'
  | 'active'
  | 'viral';

export type CategoryBadge = {
  labelId: string;
  labelEn: string;
  tone: CategoryBadgeTone;
};

export type ExploreIconKey =
  | 'package-search'
  | 'briefcase-business'
  | 'wrench'
  | 'store'
  | 'handshake'
  | 'users'
  | 'clapperboard';

export type ExploreContentType =
  | 'product'
  | 'service'
  | 'property'
  | 'opportunity'
  | 'business'
  | 'need'
  | 'community'
  | 'video'
  | 'user';

export type LajukanExploreCategoryId =
  | 'supplies'
  | 'service'
  | 'equipment'
  | 'property'
  | 'opportunity'
  | 'community'
  | 'video';

export type LajukanSubcategory = {
  slug: string;
  labelId: string;
  labelEn: string;
  query: string;
};

export type ExploreSectionKey =
  | 'latest-needs'
  | 'featured-providers'
  | 'latest-listings'
  | 'nearby-businesses'
  | 'communities'
  | 'videos'
  | 'guides'
  | 'faq';

export type ExploreSectionConfig = {
  key: ExploreSectionKey;
  titleId: string;
  titleEn: string;
  descriptionId: string;
  descriptionEn: string;
};

export type LajukanExploreCategory = {
  id: LajukanExploreCategoryId;
  slug: string;
  aliases: string[];
  labelId: string;
  labelEn: string;
  shortLabelId: string;
  shortLabelEn: string;
  descriptionId: string;
  descriptionEn: string;
  searchQuery: string;
  icon: ExploreIconKey;
  image: string;
  badge: CategoryBadge;
  contentTypes: ExploreContentType[];
  subcategories: LajukanSubcategory[];
  sections: ExploreSectionConfig[];
  navigation: {
    showInMegaMenu: boolean;
    showInSidebar: boolean;
    showInExploreHub: boolean;
    showInMobileDrawer: boolean;
    order: number;
  };
};

const COMMON_MARKETPLACE_SECTIONS: ExploreSectionConfig[] = [
  {
    key: 'latest-needs',
    titleId: 'Kebutuhan terbaru',
    titleEn: 'Latest needs',
    descriptionId: 'Permintaan nyata yang sedang mencari penyedia.',
    descriptionEn: 'Real requests currently looking for providers.',
  },
  {
    key: 'featured-providers',
    titleId: 'Penyedia pilihan',
    titleEn: 'Featured providers',
    descriptionId: 'Usaha dan penyedia yang relevan untuk kategori ini.',
    descriptionEn: 'Relevant businesses and providers for this category.',
  },
  {
    key: 'latest-listings',
    titleId: 'Penawaran terbaru',
    titleEn: 'Latest offers',
    descriptionId: 'Produk dan layanan yang baru ditambahkan.',
    descriptionEn: 'Recently added products and services.',
  },
  {
    key: 'nearby-businesses',
    titleId: 'Terdekat dari lokasimu',
    titleEn: 'Near your location',
    descriptionId: 'Temukan mitra usaha yang lebih mudah dijangkau.',
    descriptionEn: 'Find business partners that are easier to reach.',
  },
  {
    key: 'communities',
    titleId: 'Komunitas terkait',
    titleEn: 'Related communities',
    descriptionId: 'Diskusi dan grup yang membahas topik ini.',
    descriptionEn: 'Discussions and groups about this topic.',
  },
  {
    key: 'videos',
    titleId: 'Video terkait',
    titleEn: 'Related videos',
    descriptionId: 'Tutorial, cerita usaha, dan inspirasi praktis.',
    descriptionEn: 'Tutorials, business stories, and practical inspiration.',
  },
  {
    key: 'guides',
    titleId: 'Panduan praktis',
    titleEn: 'Practical guides',
    descriptionId: 'Hal penting sebelum memilih dan menghubungi penyedia.',
    descriptionEn: 'What to know before choosing and contacting a provider.',
  },
  {
    key: 'faq',
    titleId: 'Pertanyaan umum',
    titleEn: 'Frequently asked questions',
    descriptionId: 'Jawaban singkat untuk memulai dengan lebih yakin.',
    descriptionEn: 'Short answers to help you get started confidently.',
  },
];

function marketplaceSections(
  overrides: Partial<Record<ExploreSectionKey, Partial<ExploreSectionConfig>>>,
): ExploreSectionConfig[] {
  return COMMON_MARKETPLACE_SECTIONS.map(section => ({
    ...section,
    ...(overrides[section.key] || {}),
  }));
}

export const LAJUKAN_EXPLORE_CATEGORIES: LajukanExploreCategory[] = [
  {
    id: 'supplies',
    slug: 'materials-suppliers',
    aliases: ['supplies', 'materials', 'supplier'],
    labelId: 'Bahan & Supplier',
    labelEn: 'Materials & Suppliers',
    shortLabelId: 'Bahan',
    shortLabelEn: 'Materials',
    descriptionId:
      'Temukan bahan baku, kemasan, stok grosir, produsen, distributor, dan mitra produksi untuk mengembangkan usahamu.',
    descriptionEn:
      'Find raw materials, packaging, wholesale stock, producers, distributors, and production partners for your business.',
    searchQuery: 'supplier bahan usaha',
    icon: 'package-search',
    image: '/images/hero/menu/bahan-01.png',
    badge: { labelId: 'Utama', labelEn: 'Primary', tone: 'primary' },
    contentTypes: ['product', 'business', 'need'],
    subcategories: [
      [
        'raw-materials',
        'Bahan Baku Produksi',
        'Production Materials',
        'bahan baku produksi',
      ],
      ['packaging', 'Kemasan Usaha', 'Business Packaging', 'kemasan usaha'],
      ['wholesale-stock', 'Stok Grosir', 'Wholesale Stock', 'stok grosir'],
      [
        'resale-products',
        'Produk Jual Ulang',
        'Resale Products',
        'produk jual ulang',
      ],
      [
        'supporting-materials',
        'Bahan Penunjang',
        'Supporting Materials',
        'bahan penunjang',
      ],
      [
        'direct-producers',
        'Produsen Langsung',
        'Direct Producers',
        'produsen langsung',
      ],
      [
        'local-suppliers',
        'Supplier Lokal',
        'Local Suppliers',
        'supplier lokal',
      ],
      [
        'private-label',
        'Maklon & Private Label',
        'Private Label',
        'maklon private label',
      ],
      [
        'food-ingredients',
        'Bahan Makanan',
        'Food Ingredients',
        'bahan makanan',
      ],
      [
        'beverage-ingredients',
        'Bahan Minuman',
        'Beverage Ingredients',
        'bahan minuman',
      ],
      ['textiles', 'Tekstil', 'Textiles', 'tekstil'],
      ['crafts', 'Kerajinan', 'Craft Materials', 'bahan kerajinan'],
      ['construction', 'Bangunan', 'Construction', 'bahan bangunan'],
      [
        'agriculture',
        'Pertanian & Peternakan',
        'Agriculture & Livestock',
        'pertanian peternakan',
      ],
    ].map(([slug, labelId, labelEn, query]) => ({
      slug,
      labelId,
      labelEn,
      query,
    })),
    sections: marketplaceSections({
      'latest-needs': { titleId: 'Kebutuhan pembeli terbaru' },
      'featured-providers': { titleId: 'Supplier pilihan' },
      'latest-listings': { titleId: 'Produk dan stok terbaru' },
      guides: { titleId: 'Panduan memilih supplier' },
    }),
    navigation: {
      showInMegaMenu: true,
      showInSidebar: true,
      showInExploreHub: true,
      showInMobileDrawer: true,
      order: 10,
    },
  },
  {
    id: 'service',
    slug: 'services',
    aliases: ['service', 'jasa'],
    labelId: 'Cari Jasa',
    labelEn: 'Services',
    shortLabelId: 'Jasa',
    shortLabelEn: 'Services',
    descriptionId:
      'Jelajahi jasa operasional, kreatif, legal, digital, teknisi, dan lapangan untuk kebutuhan usahamu.',
    descriptionEn:
      'Explore operations, creative, legal, digital, technical, and field services for your business.',
    searchQuery: 'jasa usaha',
    icon: 'briefcase-business',
    image: '/images/hero/menu/jasa-01.png',
    badge: { labelId: 'Expert', labelEn: 'Expert', tone: 'expert' },
    contentTypes: ['service', 'business', 'need', 'user'],
    subcategories: [
      [
        'creative',
        'Kreatif & Desain',
        'Creative & Design',
        'jasa desain kreatif',
      ],
      [
        'digital',
        'Digital & Teknologi',
        'Digital & Technology',
        'jasa digital teknologi',
      ],
      [
        'operations',
        'Operasional Usaha',
        'Business Operations',
        'jasa operasional usaha',
      ],
      [
        'legal-finance',
        'Legal & Keuangan',
        'Legal & Finance',
        'jasa legal keuangan',
      ],
      [
        'repair',
        'Teknisi & Perbaikan',
        'Repair & Technicians',
        'jasa teknisi perbaikan',
      ],
      [
        'logistics',
        'Logistik & Lapangan',
        'Logistics & Field',
        'jasa logistik lapangan',
      ],
      ['marketing', 'Pemasaran', 'Marketing', 'jasa pemasaran'],
      ['consulting', 'Konsultan', 'Consulting', 'konsultan usaha'],
    ].map(([slug, labelId, labelEn, query]) => ({
      slug,
      labelId,
      labelEn,
      query,
    })),
    sections: marketplaceSections({
      'latest-needs': { titleId: 'Permintaan jasa terbaru' },
      'featured-providers': { titleId: 'Expert pilihan' },
      'latest-listings': { titleId: 'Jasa terbaru' },
      'nearby-businesses': { titleId: 'Jasa di sekitarmu' },
      guides: { titleId: 'Tips memilih penyedia jasa' },
    }),
    navigation: {
      showInMegaMenu: true,
      showInSidebar: true,
      showInExploreHub: true,
      showInMobileDrawer: true,
      order: 20,
    },
  },
  {
    id: 'equipment',
    slug: 'machines-tools',
    aliases: ['machines-equipment', 'equipment', 'mesin-alat'],
    labelId: 'Mesin & Alat',
    labelEn: 'Machines & Tools',
    shortLabelId: 'Mesin',
    shortLabelEn: 'Machines',
    descriptionId:
      'Temukan mesin produksi, peralatan usaha, sewa alat, teknisi, dan suku cadang sesuai kebutuhan.',
    descriptionEn:
      'Find production machines, business equipment, rentals, technicians, and spare parts.',
    searchQuery: 'mesin alat usaha',
    icon: 'wrench',
    image: '/images/hero/menu/mesin-01.png',
    badge: { labelId: 'Teknis', labelEn: 'Technical', tone: 'technical' },
    contentTypes: ['product', 'service', 'business', 'need'],
    subcategories: [
      [
        'production-machines',
        'Mesin Produksi',
        'Production Machines',
        'mesin produksi',
      ],
      [
        'business-tools',
        'Peralatan Usaha',
        'Business Tools',
        'peralatan usaha',
      ],
      ['used-machines', 'Mesin Bekas', 'Used Machines', 'mesin bekas'],
      ['rentals', 'Sewa Alat', 'Equipment Rental', 'sewa alat'],
      ['dealers', 'Dealer', 'Dealers', 'dealer mesin'],
      ['technicians', 'Teknisi', 'Technicians', 'teknisi mesin'],
      ['spare-parts', 'Suku Cadang', 'Spare Parts', 'suku cadang mesin'],
    ].map(([slug, labelId, labelEn, query]) => ({
      slug,
      labelId,
      labelEn,
      query,
    })),
    sections: marketplaceSections({
      'latest-needs': { titleId: 'Kebutuhan mesin & alat' },
      'featured-providers': { titleId: 'Dealer dan teknisi pilihan' },
      'latest-listings': { titleId: 'Mesin baru dan bekas' },
      guides: { titleId: 'Panduan membeli mesin' },
    }),
    navigation: {
      showInMegaMenu: true,
      showInSidebar: true,
      showInExploreHub: true,
      showInMobileDrawer: true,
      order: 30,
    },
  },
  {
    id: 'property',
    slug: 'business-places',
    aliases: ['property', 'places', 'tempat-usaha'],
    labelId: 'Tempat Usaha',
    labelEn: 'Business Places',
    shortLabelId: 'Tempat',
    shortLabelEn: 'Places',
    descriptionId:
      'Jelajahi ruko, kios, booth, gudang, dapur bersama, kantor, dan lokasi usaha populer.',
    descriptionEn:
      'Explore shophouses, kiosks, booths, warehouses, shared kitchens, offices, and popular business locations.',
    searchQuery: 'tempat usaha',
    icon: 'store',
    image: '/images/hero/menu/lok-01.png',
    badge: { labelId: 'Prime', labelEn: 'Prime', tone: 'premium' },
    contentTypes: ['property', 'business', 'need'],
    subcategories: [
      ['shophouses', 'Ruko', 'Shophouses', 'ruko'],
      ['kiosks', 'Kios', 'Kiosks', 'kios'],
      ['booths', 'Booth', 'Booths', 'booth usaha'],
      ['warehouses', 'Gudang', 'Warehouses', 'gudang'],
      ['shared-kitchens', 'Dapur Bersama', 'Shared Kitchens', 'dapur bersama'],
      ['offices', 'Kantor', 'Offices', 'kantor usaha'],
    ].map(([slug, labelId, labelEn, query]) => ({
      slug,
      labelId,
      labelEn,
      query,
    })),
    sections: marketplaceSections({
      'latest-needs': { titleId: 'Pencari tempat terbaru' },
      'featured-providers': { titleId: 'Pengelola dan pemilik pilihan' },
      'latest-listings': { titleId: 'Tempat tersedia' },
      'nearby-businesses': { titleId: 'Lokasi populer di sekitarmu' },
      guides: { titleId: 'Panduan memilih tempat usaha' },
    }),
    navigation: {
      showInMegaMenu: true,
      showInSidebar: true,
      showInExploreHub: true,
      showInMobileDrawer: true,
      order: 40,
    },
  },
  {
    id: 'opportunity',
    slug: 'business-opportunities',
    aliases: ['opportunity', 'peluang-usaha'],
    labelId: 'Peluang Usaha',
    labelEn: 'Business Opportunities',
    shortLabelId: 'Peluang',
    shortLabelEn: 'Opportunities',
    descriptionId:
      'Pelajari kemitraan, franchise, reseller, distributor, dan usaha rumahan berdasarkan modal serta risikonya.',
    descriptionEn:
      'Explore partnerships, franchises, reseller programs, distribution, and home businesses by capital and risk.',
    searchQuery: 'peluang usaha franchise kemitraan reseller',
    icon: 'handshake',
    image: '/images/hero/menu/peluang-01.png',
    badge: { labelId: 'Cuan', labelEn: 'Growth', tone: 'earning' },
    contentTypes: ['opportunity', 'business', 'need'],
    subcategories: [
      ['partnerships', 'Kemitraan', 'Partnerships', 'kemitraan usaha'],
      ['franchises', 'Franchise', 'Franchises', 'franchise'],
      ['resellers', 'Reseller', 'Resellers', 'reseller'],
      ['distributors', 'Distributor', 'Distributors', 'distributor'],
      ['home-business', 'Usaha Rumahan', 'Home Business', 'usaha rumahan'],
      [
        'low-capital',
        'Modal Terjangkau',
        'Affordable Capital',
        'peluang usaha modal kecil',
      ],
    ].map(([slug, labelId, labelEn, query]) => ({
      slug,
      labelId,
      labelEn,
      query,
    })),
    sections: marketplaceSections({
      'latest-needs': { titleId: 'Mitra yang sedang dicari' },
      'featured-providers': { titleId: 'Pemilik peluang pilihan' },
      'latest-listings': { titleId: 'Peluang terbaru' },
      guides: { titleId: 'Panduan menilai peluang dan risiko' },
    }),
    navigation: {
      showInMegaMenu: true,
      showInSidebar: true,
      showInExploreHub: true,
      showInMobileDrawer: true,
      order: 50,
    },
  },
  {
    id: 'community',
    slug: 'communities',
    aliases: ['community', 'komunitas'],
    labelId: 'Komunitas',
    labelEn: 'Communities',
    shortLabelId: 'Komunitas',
    shortLabelEn: 'Communities',
    descriptionId:
      'Temukan komunitas, diskusi, event, dan orang dengan minat usaha yang sama.',
    descriptionEn:
      'Find communities, discussions, events, and people with shared business interests.',
    searchQuery: 'komunitas usaha',
    icon: 'users',
    image: '/images/hero/menu/komun-01.png',
    badge: { labelId: 'Aktif', labelEn: 'Active', tone: 'active' },
    contentTypes: ['community', 'user'],
    subcategories: [
      ['food-beverage', 'Kuliner', 'Food & Beverage', 'komunitas kuliner'],
      ['creative', 'Kreatif', 'Creative', 'komunitas kreatif'],
      ['digital', 'Digital', 'Digital', 'komunitas digital'],
      [
        'local-business',
        'Usaha Lokal',
        'Local Business',
        'komunitas usaha lokal',
      ],
      ['export', 'Ekspor', 'Export', 'komunitas ekspor'],
    ].map(([slug, labelId, labelEn, query]) => ({
      slug,
      labelId,
      labelEn,
      query,
    })),
    sections: [
      {
        key: 'communities',
        titleId: 'Komunitas populer',
        titleEn: 'Popular communities',
        descriptionId: 'Grup dengan percakapan aktif dan topik yang jelas.',
        descriptionEn: 'Groups with active conversations and clear topics.',
      },
      {
        key: 'latest-listings',
        titleId: 'Diskusi terbaru',
        titleEn: 'Latest discussions',
        descriptionId: 'Pertanyaan, pengalaman, dan kabar dari komunitas.',
        descriptionEn: 'Questions, experiences, and updates from communities.',
      },
      {
        key: 'videos',
        titleId: 'Video dari komunitas',
        titleEn: 'Community videos',
        descriptionId: 'Cerita dan pengetahuan yang dibagikan anggota.',
        descriptionEn: 'Stories and knowledge shared by members.',
      },
      {
        key: 'guides',
        titleId: 'Mulai berkomunitas',
        titleEn: 'Get involved',
        descriptionId: 'Cara memilih grup dan berkontribusi dengan aman.',
        descriptionEn: 'How to choose groups and contribute safely.',
      },
      {
        key: 'faq',
        titleId: 'Pertanyaan umum',
        titleEn: 'Frequently asked questions',
        descriptionId: 'Hal dasar tentang grup publik dan privat.',
        descriptionEn: 'The basics of public and private groups.',
      },
    ],
    navigation: {
      showInMegaMenu: true,
      showInSidebar: true,
      showInExploreHub: true,
      showInMobileDrawer: true,
      order: 60,
    },
  },
  {
    id: 'video',
    slug: 'videos',
    aliases: ['video', 'reels'],
    labelId: 'Video',
    labelEn: 'Videos',
    shortLabelId: 'Video',
    shortLabelEn: 'Videos',
    descriptionId:
      'Tonton tutorial, edukasi, cerita usaha, dan video populer dari kreator Lajukan.',
    descriptionEn:
      'Watch tutorials, education, business stories, and popular videos from Lajukan creators.',
    searchQuery: 'usaha',
    icon: 'clapperboard',
    image: '/images/hero/menu/reel-01.png',
    badge: { labelId: 'Viral', labelEn: 'Viral', tone: 'viral' },
    contentTypes: ['video', 'user'],
    subcategories: [
      ['education', 'Edukasi', 'Education', 'video edukasi usaha'],
      ['tutorials', 'Tutorial', 'Tutorials', 'tutorial usaha'],
      ['business-stories', 'Cerita Usaha', 'Business Stories', 'cerita usaha'],
      ['popular', 'Populer', 'Popular', 'video usaha populer'],
      ['latest', 'Terbaru', 'Latest', 'video usaha terbaru'],
    ].map(([slug, labelId, labelEn, query]) => ({
      slug,
      labelId,
      labelEn,
      query,
    })),
    sections: [
      {
        key: 'videos',
        titleId: 'Video populer',
        titleEn: 'Popular videos',
        descriptionId: 'Video yang sedang banyak ditonton.',
        descriptionEn: 'Videos receiving the most attention.',
      },
      {
        key: 'communities',
        titleId: 'Kreator dan komunitas',
        titleEn: 'Creators and communities',
        descriptionId: 'Temukan orang dan grup di balik video.',
        descriptionEn: 'Find the people and groups behind the videos.',
      },
      {
        key: 'guides',
        titleId: 'Belajar lewat video',
        titleEn: 'Learn with video',
        descriptionId:
          'Topik praktis untuk menjalankan dan mengembangkan usaha.',
        descriptionEn: 'Practical topics for running and growing a business.',
      },
      {
        key: 'faq',
        titleId: 'Pertanyaan umum',
        titleEn: 'Frequently asked questions',
        descriptionId: 'Hal dasar tentang menonton dan mengunggah video.',
        descriptionEn: 'The basics of watching and uploading videos.',
      },
    ],
    navigation: {
      showInMegaMenu: true,
      showInSidebar: true,
      showInExploreHub: true,
      showInMobileDrawer: true,
      order: 70,
    },
  },
];

export const MARKETPLACE_EXPLORE_CATEGORIES = LAJUKAN_EXPLORE_CATEGORIES.filter(
  category => category.id !== 'community' && category.id !== 'video',
);

export const SOCIAL_EXPLORE_CATEGORIES = LAJUKAN_EXPLORE_CATEGORIES.filter(
  category => category.id === 'community' || category.id === 'video',
);

export function getExploreCategoryBySlug(
  slug: string | null | undefined,
): LajukanExploreCategory | null {
  const normalized = String(slug || '')
    .trim()
    .toLowerCase();
  if (!normalized) return null;
  return (
    LAJUKAN_EXPLORE_CATEGORIES.find(
      category =>
        category.slug === normalized || category.aliases.includes(normalized),
    ) || null
  );
}

export function getExploreCategoryById(
  id: string | null | undefined,
): LajukanExploreCategory | null {
  return (
    LAJUKAN_EXPLORE_CATEGORIES.find(category => category.id === id) || null
  );
}

export function categoryLabel(
  category: LajukanExploreCategory,
  locale: LajukanLocale,
): string {
  return locale === 'id' ? category.labelId : category.labelEn;
}

export function categoryDescription(
  category: LajukanExploreCategory,
  locale: LajukanLocale,
): string {
  return locale === 'id' ? category.descriptionId : category.descriptionEn;
}

export function categoryBadgeLabel(
  category: LajukanExploreCategory,
  locale: LajukanLocale,
): string {
  return locale === 'id' ? category.badge.labelId : category.badge.labelEn;
}

export function buildExploreCategoryHref(
  category: Pick<LajukanExploreCategory, 'slug'>,
): string {
  return `/explore/${category.slug}`;
}

export function buildCategorySearchHref({
  category,
  query,
  side,
  subcategory,
}: {
  category?: Pick<LajukanExploreCategory, 'slug'> | null;
  query?: string;
  side?: 'supply' | 'demand';
  subcategory?: string;
}): string {
  const params = new URLSearchParams();
  if (query?.trim()) params.set('q', query.trim());
  if (side) {
    params.set('side', side);
    if (side === 'demand') params.set('tab', 'needs');
  }
  if (subcategory?.trim()) params.set('subcategory', subcategory.trim());
  const search = params.toString();
  const base = category ? `/explore/${category.slug}` : '/explore';
  return search ? `${base}?${search}` : base;
}
