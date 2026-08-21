export type IndonesiaBehaviorInsight = {
  id: string;
  labelId: string;
  testSignal: 'mobile-first' | 'visual-first' | 'trust-first' | 'short-video' | 'fast-action';
  source: string;
};

export type FlowAudience =
  | 'guest'
  | 'buyer'
  | 'seller'
  | 'creator'
  | 'community-member'
  | 'umkm-owner';

export type FlowStep = {
  id: string;
  route: string;
  labelId: string;
  primaryActionId: string;
  expectedSignals: string[];
  mobilePriority: 'critical' | 'high' | 'normal';
};

export type LajukanFlow = {
  id: string;
  labelId: string;
  audience: FlowAudience[];
  entryRoute: string;
  expectedOutcomeId: string;
  steps: FlowStep[];
};

export const INDONESIA_BEHAVIOR_INSIGHTS: IndonesiaBehaviorInsight[] = [
  {
    id: 'mobile-first',
    labelId: 'Nyaman di HP dulu',
    testSignal: 'mobile-first',
    source: 'DataReportal Digital 2025 Indonesia',
  },
  {
    id: 'social-discovery',
    labelId: 'Biasa cari lewat sosial',
    testSignal: 'visual-first',
    source: 'DataReportal Digital 2025 Indonesia',
  },
  {
    id: 'video-commerce',
    labelId: 'Video bantu keputusan beli',
    testSignal: 'short-video',
    source: 'Google e-Conomy SEA 2024',
  },
  {
    id: 'trust-before-transaction',
    labelId: 'Aman dulu baru transaksi',
    testSignal: 'trust-first',
    source: 'Lajukan trust and transaction policy',
  },
  {
    id: 'quick-scan',
    labelId: 'Label pendek, aksi jelas',
    testSignal: 'fast-action',
    source: 'Lajukan Indonesia UX principle',
  },
];

export const CORE_LAJUKAN_FLOWS: LajukanFlow[] = [
  {
    id: 'home-to-search-marketplace',
    labelId: 'Home ke pencarian',
    audience: ['guest', 'buyer', 'seller'],
    entryRoute: '/home',
    expectedOutcomeId: 'user-can-find-actionable-listings',
    steps: [
      {
        id: 'scan-home',
        route: '/home',
        labelId: 'Scan beranda',
        primaryActionId: 'search',
        expectedSignals: ['global-search', 'menu', 'recommendation-rail', 'bottom-nav'],
        mobilePriority: 'critical',
      },
      {
        id: 'search-results',
        route: '/explore?q=supplier%20kemasan',
        labelId: 'Lihat hasil',
        primaryActionId: 'open-result',
        expectedSignals: ['filters', 'result-cards', 'back-home', 'no-horizontal-overflow'],
        mobilePriority: 'critical',
      },
      {
        id: 'listing-detail',
        route: '/content/:id',
        labelId: 'Cek detail',
        primaryActionId: 'chat-or-offer',
        expectedSignals: ['trust-signal', 'price', 'seller', 'primary-cta'],
        mobilePriority: 'high',
      },
    ],
  },
  {
    id: 'home-to-community',
    labelId: 'Home ke komunitas',
    audience: ['guest', 'community-member', 'seller'],
    entryRoute: '/home',
    expectedOutcomeId: 'user-can-post-or-join-discussion',
    steps: [
      {
        id: 'community-feed',
        route: '/community',
        labelId: 'Buka komunitas',
        primaryActionId: 'compose-post',
        expectedSignals: ['composer', 'groups', 'tabs', 'feed'],
        mobilePriority: 'critical',
      },
      {
        id: 'compose-post',
        route: '/community?compose=post',
        labelId: 'Buat posting',
        primaryActionId: 'post',
        expectedSignals: ['modal-above-chrome', 'centered-desktop', 'media-upload', 'group-select'],
        mobilePriority: 'critical',
      },
      {
        id: 'create-group',
        route: '/community?create=group',
        labelId: 'Buat grup',
        primaryActionId: 'create-group',
        expectedSignals: ['privacy', 'permissions', 'rules'],
        mobilePriority: 'high',
      },
    ],
  },
  {
    id: 'home-to-reels-commerce',
    labelId: 'Home ke reels',
    audience: ['guest', 'creator', 'buyer'],
    entryRoute: '/home',
    expectedOutcomeId: 'user-can-watch-act-or-upload',
    steps: [
      {
        id: 'reels-feed',
        route: '/reels',
        labelId: 'Tonton reels',
        primaryActionId: 'watch',
        expectedSignals: ['back-home', 'like', 'comment', 'share', 'product-link'],
        mobilePriority: 'critical',
      },
      {
        id: 'upload-reels',
        route: '/reels?upload=1',
        labelId: 'Upload reels',
        primaryActionId: 'upload',
        expectedSignals: ['video-input', 'caption', 'privacy-or-category'],
        mobilePriority: 'high',
      },
    ],
  },
  {
    id: 'home-to-create-listing',
    labelId: 'Home ke upload listing',
    audience: ['seller', 'umkm-owner'],
    entryRoute: '/home',
    expectedOutcomeId: 'user-can-create-marketplace-supply',
    steps: [
      {
        id: 'create-hub',
        route: '/create',
        labelId: 'Pilih jenis',
        primaryActionId: 'choose-template',
        expectedSignals: ['template', 'progress', 'short-copy'],
        mobilePriority: 'critical',
      },
      {
        id: 'marketplace-template',
        route: '/create/supply/product',
        labelId: 'Isi listing',
        primaryActionId: 'save-draft',
        expectedSignals: ['form', 'media', 'price', 'location'],
        mobilePriority: 'high',
      },
    ],
  },
  {
    id: 'home-to-umkm',
    labelId: 'Home ke UMKM',
    audience: ['buyer', 'seller', 'umkm-owner'],
    entryRoute: '/home',
    expectedOutcomeId: 'user-can-find-or-manage-local-business',
    steps: [
      {
        id: 'umkm-discovery',
        route: '/umkm',
        labelId: 'Cari UMKM',
        primaryActionId: 'open-store',
        expectedSignals: ['nearby', 'category', 'map-or-list', 'order-cta'],
        mobilePriority: 'critical',
      },
      {
        id: 'umkm-manage',
        route: '/usaha',
        labelId: 'Kelola toko',
        primaryActionId: 'setup-store',
        expectedSignals: ['catalog', 'orders', 'team', 'qr'],
        mobilePriority: 'high',
      },
    ],
  },
  {
    id: 'home-to-profile-trust',
    labelId: 'Home ke profil',
    audience: ['guest', 'seller', 'creator', 'umkm-owner'],
    entryRoute: '/home',
    expectedOutcomeId: 'user-can-understand-reputation-and-actions',
    steps: [
      {
        id: 'profile-hub',
        route: '/profile',
        labelId: 'Cek profil',
        primaryActionId: 'edit-or-verify',
        expectedSignals: ['identity', 'trusted', 'skill-arena', 'listings', 'reels'],
        mobilePriority: 'critical',
      }
    ],
  },
];

export function buildLocalizedRoute(route: string, locale: 'id' | 'en' = 'id') {
  if (!route.startsWith('/')) return `/${locale}/${route}`;
  return `/${locale}${route}`;
}

export function getConcreteFlowRoutes(flows = CORE_LAJUKAN_FLOWS) {
  return flows
    .flatMap(flow => flow.steps.map(step => step.route))
    .filter(route => !route.includes(':'));
}

export function validateIndonesiaFlowContract(flows = CORE_LAJUKAN_FLOWS) {
  const errors: string[] = [];
  const ids = new Set<string>();

  for (const flow of flows) {
    if (ids.has(flow.id)) errors.push(`Duplicate flow id: ${flow.id}`);
    ids.add(flow.id);
    if (!flow.entryRoute.startsWith('/')) errors.push(`${flow.id} entry route must be internal`);
    if (!flow.steps.length) errors.push(`${flow.id} must have at least one step`);

    for (const step of flow.steps) {
      if (!step.route.startsWith('/')) errors.push(`${flow.id}/${step.id} route must be internal`);
      if (step.labelId.length > 28) errors.push(`${flow.id}/${step.id} label is too long`);
      if (!step.primaryActionId) errors.push(`${flow.id}/${step.id} needs a primary action`);
      if (!step.expectedSignals.length) errors.push(`${flow.id}/${step.id} needs UX signals`);
    }
  }

  return errors;
}
