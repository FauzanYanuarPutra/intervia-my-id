export type ProfileContentTab =
  | 'all'
  | 'job'
  | 'freelancer'
  | 'product'
  | 'service'
  | 'tool_rental'
  | 'property'
  | 'umkm';

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
    key: 'all',
    labelId: 'Semua',
    labelEn: 'All',
    emptyTitleId: 'Belum ada yang ditampilkan',
    emptyTitleEn: 'Nothing to show yet',
    emptyDescriptionId:
      'Mulai isi profil dan pasang listing supaya halaman ini terasa hidup.',
    emptyDescriptionEn:
      'Start filling this profile and publish listings so this page feels alive.',
    addLabelId: 'Mulai isi',
    addLabelEn: 'Start building',
    createHref: '/profile/edit?focus=identity',
    browseHref: '/search',
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
    browseHref: '/search?type=job',
  },
  {
    key: 'freelancer',
    labelId: 'Freelancer',
    labelEn: 'Freelancer',
    emptyTitleId: 'Belum ada mode freelancer',
    emptyTitleEn: 'No freelancer setup yet',
    emptyDescriptionId:
      'Lengkapi headline, skill, pengalaman, dan portofolio agar buyer bisa langsung menilai Anda.',
    emptyDescriptionEn:
      'Complete your headline, skills, experience, and portfolio so buyers can assess you quickly.',
    addLabelId: 'Lengkapi freelancer',
    addLabelEn: 'Setup freelancer',
    createHref: '/profile/edit?focus=talent',
    browseHref: '/search?type=freelancer',
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
    browseHref: '/search?type=product',
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
    browseHref: '/search?type=service',
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
    browseHref: '/search?type=tool_rental',
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
    browseHref: '/search?type=property',
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
];

function normalizeToken(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
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
    metadata.publish_service,
    metadata.publish_services,
    metadata.tags,
  ];

  return rawValues.flatMap(value => {
    if (typeof value === 'string') return [normalizeToken(value)];
    if (Array.isArray(value)) {
      return value
        .map(entry => normalizeToken(entry))
        .filter(Boolean);
    }
    return [];
  });
}

export function normalizeProfileContentTab(input: {
  type?: string | null;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
}): ProfileLeafTab {
  const tokens = [
    normalizeToken(input.type),
    normalizeToken(input.category),
    ...collectMetadataTokens(input.metadata),
  ].filter(Boolean);
  const joined = tokens.join(' ');

  if (/(freelancer|talent|creator|profile)/.test(joined)) return 'freelancer';
  if (/(job|career|hiring|recruit|loker|vacancy)/.test(joined)) return 'job';
  if (/(tool_rental|tool-rental|rental|rent|sewa|pinjam|meminjam)/.test(joined))
    return 'tool_rental';
  if (/(property|real estate|apartment|house|ruko|kios|lapak)/.test(joined))
    return 'property';
  if (/(umkm|merchant|warung|kuliner|storefront)/.test(joined)) return 'umkm';
  if (/(service|jasa|agency|consult)/.test(joined)) return 'service';
  if (/(product|produk|shop|store|marketplace|commerce)/.test(joined))
    return 'product';
  return 'product';
}

export function getProfileContentTabDefinition(
  key: ProfileContentTab,
): ProfileContentTabDefinition {
  return (
    PROFILE_CONTENT_TABS.find(item => item.key === key) || PROFILE_CONTENT_TABS[0]
  );
}

export function getProfileContentTabLabel(
  key: ProfileContentTab,
  locale: 'id' | 'en',
): string {
  const item = getProfileContentTabDefinition(key);
  return locale === 'id' ? item.labelId : item.labelEn;
}
