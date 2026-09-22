export type ProfileContentTab =
  | 'all'
  | 'news'
  | 'community'
  | 'reels'
  | 'job'
  | 'freelancer'
  | 'product'
  | 'service'
  | 'supplier'
  | 'tool_rental'
  | 'business_transfer'
  | 'business_place'
  | 'property'
  | 'umkm'
  | 'other';

export type ProfileLeafTab = Exclude<ProfileContentTab, 'all'>;

export type ProfileContentTabDefinition = {
  key: ProfileContentTab;
  labelId: string;
  labelEn: string;
  emptyTitleId: string;
  emptyTitleEn: string;
  emptyDescriptionId: string;
  emptyDescriptionEn: string;
  addLabelId: string;
  addLabelEn: string;
  createHref: string;
  browseHref: string;
};

export const PROFILE_CONTENT_TABS: ProfileContentTabDefinition[] = [
  {
    key: 'news',
    labelId: 'News',
    labelEn: 'News',
    emptyTitleId: 'Belum ada news',
    emptyTitleEn: 'No news yet',
    emptyDescriptionId:
      'Berita, analisis, dan rilis usaha yang sudah melewati alur editorial akan tampil di sini.',
    emptyDescriptionEn:
      'News, analysis, and business releases that have passed editorial flow appear here.',
    addLabelId: 'Kirim news',
    addLabelEn: 'Submit news',
    createHref: '/news/submit',
    browseHref: '/news',
  },
  {
    key: 'community',
    labelId: 'Komunitas',
    labelEn: 'Community',
    emptyTitleId: 'Belum ada postingan komunitas',
    emptyTitleEn: 'No community posts yet',
    emptyDescriptionId:
      'Diskusi, pertanyaan, dan update komunitas dari profil ini akan tampil terpisah dari produk.',
    emptyDescriptionEn:
      'Discussions, questions, and community updates from this profile stay separate from products.',
    addLabelId: 'Posting komunitas',
    addLabelEn: 'Post to community',
    createHref: '/community?compose=post',
    browseHref: '/community',
  },
  {
    key: 'reels',
    labelId: 'Reels',
    labelEn: 'Reels',
    emptyTitleId: 'Belum ada reels',
    emptyTitleEn: 'No reels yet',
    emptyDescriptionId:
      'Video pendek dan konten promosi visual akan tampil di tab ini.',
    emptyDescriptionEn:
      'Short videos and visual promotion content appear in this tab.',
    addLabelId: 'Upload reels',
    addLabelEn: 'Upload reels',
    createHref: '/reels?upload=1',
    browseHref: '/reels',
  },
  {
    key: 'job',
    labelId: 'Jobs',
    labelEn: 'Jobs',
    emptyTitleId: 'Belum ada jobs',
    emptyTitleEn: 'No jobs yet',
    emptyDescriptionId:
      'Pasang lowongan atau kebutuhan kerja supaya kandidat bisa langsung melamar.',
    emptyDescriptionEn:
      'Publish a job or hiring need so candidates can apply right away.',
    addLabelId: 'Tambah job',
    addLabelEn: 'Add job',
    createHref: '/create/jual/lowongan',
    browseHref: '/explore?type=job',
  },
  {
    key: 'product',
    labelId: 'Produk',
    labelEn: 'Products',
    emptyTitleId: 'Belum ada produk',
    emptyTitleEn: 'No products yet',
    emptyDescriptionId:
      'Tampilkan produk yang siap dijual supaya profil Anda juga terasa seperti storefront.',
    emptyDescriptionEn:
      'Show products ready to sell so this profile also feels like a storefront.',
    addLabelId: 'Tambah produk',
    addLabelEn: 'Add product',
    createHref: '/create/jual/produk',
    browseHref: '/explore?type=product',
  },
  {
    key: 'supplier',
    labelId: 'Supplier',
    labelEn: 'Suppliers',
    emptyTitleId: 'Belum ada supplier',
    emptyTitleEn: 'No suppliers yet',
    emptyDescriptionId:
      'Supplier bahan, stok, atau mitra pasokan akan tampil di sini.',
    emptyDescriptionEn:
      'Material, stock, or supply partner listings appear here.',
    addLabelId: 'Tambah supplier',
    addLabelEn: 'Add supplier',
    createHref: '/create/jual/supplier',
    browseHref: '/explore?type=supplier',
  },
  {
    key: 'service',
    labelId: 'Jasa',
    labelEn: 'Services',
    emptyTitleId: 'Belum ada jasa',
    emptyTitleEn: 'No services yet',
    emptyDescriptionId:
      'Buat penawaran jasa supaya orang langsung paham apa yang Anda kerjakan.',
    emptyDescriptionEn:
      'Publish a service offer so people immediately understand what you do.',
    addLabelId: 'Tambah jasa',
    addLabelEn: 'Add service',
    createHref: '/create/jual/jasa',
    browseHref: '/explore?type=service',
  },
  {
    key: 'tool_rental',
    labelId: 'Pinjam/Meminjamkan',
    labelEn: 'Borrow/Lend',
    emptyTitleId: 'Belum ada listing pinjam',
    emptyTitleEn: 'No borrow/lend listing yet',
    emptyDescriptionId:
      'Pakai tab ini untuk alat, perlengkapan, atau inventaris yang bisa disewa.',
    emptyDescriptionEn:
      'Use this tab for tools, equipment, or inventory that can be rented out.',
    addLabelId: 'Tambah listing pinjam',
    addLabelEn: 'Add rental listing',
    createHref: '/create/jual/sewa-alat',
    browseHref: '/explore?type=tool_rental',
  },
  {
    key: 'business_transfer',
    labelId: 'Oper Usaha',
    labelEn: 'Business Transfer',
    emptyTitleId: 'Belum ada oper usaha',
    emptyTitleEn: 'No business transfer yet',
    emptyDescriptionId:
      'Tampilkan usaha berjalan yang bisa dialihkan lengkap dengan aset, rating, biaya, dan risiko.',
    emptyDescriptionEn:
      'Show running businesses for transfer with assets, ratings, costs, and risks.',
    addLabelId: 'Tambah oper usaha',
    addLabelEn: 'Add business transfer',
    createHref: '/create/jual/oper-usaha',
    browseHref: '/explore?type=business_transfer',
  },
  {
    key: 'business_place',
    labelId: 'Tempat Usaha',
    labelEn: 'Business Places',
    emptyTitleId: 'Belum ada tempat usaha',
    emptyTitleEn: 'No business places yet',
    emptyDescriptionId:
      'Profil toko, outlet, tempat jualan, atau lokasi usaha akan tampil di sini.',
    emptyDescriptionEn:
      'Store, outlet, selling spot, or business location profiles appear here.',
    addLabelId: 'Tambah tempat usaha',
    addLabelEn: 'Add business place',
    createHref: '/usaha',
    browseHref: '/umkm',
  },
  {
    key: 'property',
    labelId: 'Properti',
    labelEn: 'Property',
    emptyTitleId: 'Belum ada properti',
    emptyTitleEn: 'No property yet',
    emptyDescriptionId:
      'Tampilkan aset properti, ruko, kios, atau ruang yang sedang Anda tawarkan.',
    emptyDescriptionEn:
      'Show property assets, shop houses, kiosks, or spaces you are offering.',
    addLabelId: 'Tambah properti',
    addLabelEn: 'Add property',
    createHref: '/create/jual/properti',
    browseHref: '/explore?type=property',
  },
  {
    key: 'umkm',
    labelId: 'UMKM',
    labelEn: 'UMKM',
    emptyTitleId: 'Belum ada UMKM',
    emptyTitleEn: 'No UMKM yet',
    emptyDescriptionId:
      'Hubungkan profil ini ke toko UMKM agar orang bisa masuk ke storefront dan operasionalnya.',
    emptyDescriptionEn:
      'Connect this profile to an UMKM store so visitors can open its storefront and operations hub.',
    addLabelId: 'Buka UMKM',
    addLabelEn: 'Open UMKM',
    createHref: '/usaha',
    browseHref: '/umkm',
  },
  {
    key: 'other',
    labelId: 'Lainnya',
    labelEn: 'Other',
    emptyTitleId: 'Belum ada konten lain',
    emptyTitleEn: 'No other content yet',
    emptyDescriptionId:
      'Konten yang belum masuk kategori utama akan ditampilkan di sini agar tidak bercampur dengan produk.',
    emptyDescriptionEn:
      'Content that does not fit the main categories appears here instead of mixing with products.',
    addLabelId: 'Buat konten',
    addLabelEn: 'Create content',
    createHref: '/create',
    browseHref: '/explore',
  },
];

function normalizeToken(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function collectMetadataTokens(
  metadata: Record<string, unknown> | null | undefined,
): string[] {
  if (!metadata) return [];

  const rawValues: unknown[] = [
    metadata.type,
    metadata.category,
    metadata.sector,
    metadata.sub_sector,
    metadata.business_type,
    metadata.store_type,
    metadata.entity_kind,
    metadata.content_kind,
    metadata.module,
    metadata.surface,
    metadata.channel,
    metadata.publish_service,
    metadata.publish_services,
    metadata.tags,
    asRecord(metadata.news)?.article_kind,
    asRecord(metadata.news)?.category,
  ];

  return rawValues.flatMap(value => {
    if (typeof value === 'string') return [normalizeToken(value)];
    if (Array.isArray(value)) {
      return value.map(entry => normalizeToken(entry)).filter(Boolean);
    }
    return [];
  });
}

export function normalizeProfileContentTab(input: {
  type?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
}): ProfileLeafTab {
  const explicit = [normalizeToken(input.type), normalizeToken(input.category)]
    .filter(Boolean)
    .join(' ');
  const metadata = collectMetadataTokens(input.metadata).join(' ');
  const joined = [explicit, metadata].filter(Boolean).join(' ');

  if (explicit && /(news|berita|analysis|analisis|press release|press_release|rilis bisnis|editorial)/.test(explicit))
    return 'news';
  if (explicit && /(community|komunitas|forum|thread|discussion|diskusi|question|tanya)/.test(explicit))
    return 'community';
  if (explicit && /(reels|reel|short video|video pendek|clips?)/.test(explicit))
    return 'reels';
  if (
    explicit &&
    /(business_profile|business profile|company|tempat usaha|outlet|merchant|warung|storefront|toko|profil usaha)/.test(explicit)
  )
    return 'business_place';
  if (explicit && /(supplier|pasokan|bahan baku|material|stockist|distributor)/.test(explicit))
    return 'supplier';
  if (explicit && /(freelancer|talent|creator|worker|professional)/.test(explicit))
    return 'freelancer';
  if (explicit && /(job|career|hiring|recruit|loker|vacancy)/.test(explicit)) return 'job';
  if (
    explicit &&
    /(business_transfer|business-transfer|business transfer|oper usaha|jual usaha|usaha berjalan|handover|takeover)/.test(explicit)
  )
    return 'business_transfer';
  if (explicit && /(tool_rental|tool-rental|rental|rent|sewa|pinjam|meminjam)/.test(explicit))
    return 'tool_rental';
  if (explicit && /(property|real estate|apartment|house|ruko|kios|lapak)/.test(explicit))
    return 'property';
  if (explicit && /(umkm)/.test(explicit)) return 'umkm';
  if (explicit && /(service|jasa|agency|consult)/.test(explicit))
    return 'service';
  if (explicit && /(product|produk|shop|store|marketplace|commerce)/.test(explicit))
    return 'product';

  if (/(news|berita|analysis|analisis|press release|press_release|rilis bisnis|editorial)/.test(metadata))
    return 'news';
  if (/(community|komunitas|forum|thread|discussion|diskusi|question|tanya)/.test(metadata))
    return 'community';
  if (/(reels|reel|short video|video pendek|clips?)/.test(metadata))
    return 'reels';
  if (
    /(business_profile|business profile|company|tempat usaha|outlet|merchant|warung|storefront|toko|profil usaha)/.test(metadata)
  )
    return 'business_place';
  if (/(supplier|pasokan|bahan baku|material|stockist|distributor)/.test(metadata))
    return 'supplier';
  if (/(freelancer|talent|creator|worker|professional)/.test(metadata))
    return 'freelancer';
  if (/(job|career|hiring|recruit|loker|vacancy)/.test(metadata)) return 'job';
  if (
    /(business_transfer|business-transfer|business transfer|oper usaha|jual usaha|usaha berjalan|handover|takeover)/.test(metadata)
  )
    return 'business_transfer';
  if (/(tool_rental|tool-rental|rental|rent|sewa|pinjam|meminjam)/.test(metadata))
    return 'tool_rental';
  if (/(property|real estate|apartment|house|ruko|kios|lapak)/.test(metadata))
    return 'property';
  if (/(umkm|kuliner)/.test(metadata)) return 'umkm';
  if (/(service|jasa|agency|consult)/.test(metadata)) return 'service';
  if (/(product|produk|shop|store|marketplace|commerce)/.test(metadata))
    return 'product';
  if (joined) return 'other';
  return 'product';
}

export function getProfileContentTabDefinition(
  key: ProfileContentTab,
): ProfileContentTabDefinition {
  return (
    PROFILE_CONTENT_TABS.find(item => item.key === key) ||
    PROFILE_CONTENT_TABS[0]
  );
}

export function getProfileContentTabLabel(
  key: ProfileContentTab,
  locale: 'id' | 'en',
): string {
  const item = getProfileContentTabDefinition(key);
  return locale === 'id' ? item.labelId : item.labelEn;
}
