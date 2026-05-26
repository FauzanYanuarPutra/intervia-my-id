import type { Page, Route } from '@playwright/test';

export const seedSearchQuery = 'supplier kemasan';

export const seedCriticalRoutes = [
  '/id/home',
  `/id/search?q=${encodeURIComponent(seedSearchQuery)}`,
  '/id/community',
  '/id/reels',
  '/id/create',
  '/id/super-app/umkm',
  '/id/profile',
  '/id/my-projects',
];

const contentItems = [
  {
    id: 'e2e-kemasan-001',
    title: 'Supplier kemasan paper bowl 500ml',
    summary: 'Ready stok, MOQ kecil, cocok untuk UMKM kuliner.',
    content_type: 'product',
    category: 'product',
    content_status: 'active',
    price_cents: 450000,
    image_url: 'https://placehold.co/640x480/png?text=Kemasan',
    metadata: {
      city: 'Bandung',
      location: 'Bandung',
      unit: 'paket',
      entity_kind: 'listing',
    },
    seller_stats: {
      rating: 4.8,
      review_count: 32,
    },
    created_at: '2026-05-01T08:00:00.000Z',
    updated_at: '2026-05-21T08:00:00.000Z',
  },
  {
    id: 'e2e-jasa-ops-001',
    title: 'Jasa foto produk cepat untuk toko online',
    summary: 'Paket singkat, hasil siap upload marketplace dan reels.',
    content_type: 'service',
    category: 'service',
    content_status: 'active',
    price_cents: 25000000,
    image_url: 'https://placehold.co/640x480/png?text=Foto+Produk',
    metadata: {
      city: 'Jakarta',
      location: 'Jakarta',
      entity_kind: 'listing',
    },
    seller_stats: {
      rating: 4.7,
      review_count: 18,
    },
    created_at: '2026-05-02T08:00:00.000Z',
    updated_at: '2026-05-20T08:00:00.000Z',
  },
];

const communityGroup = {
  id: 'e2e-group-001',
  categoryId: 'supply',
  slug: 'supplier-kemasan',
  name: 'Supplier Kemasan',
  description: 'Diskusi supplier kemasan untuk UMKM.',
  privacy: 'public',
  postingPermission: 'member',
  membershipPermission: 'open',
  memberCount: 128,
  postCount: 24,
  viewerMembershipStatus: 'active',
  viewerRole: 'member',
  viewerCanPost: true,
  viewerCanManage: false,
  rules: ['No spam', 'Transaksi aman di platform'],
};

const communityTag = { id: 'kemasan', slug: 'kemasan', name: 'Kemasan', usageCount: 1 };

const communityAuthor = {
  id: 'e2e-user-001',
  name: 'Rina UMKM',
  title: 'Owner rice bowl',
  avatarUrl: '/default-avatar.svg',
  reputation: 42,
};

const communityFeed = {
  items: [
    {
      id: 'e2e-thread-001',
      kind: 'discussion',
      title: 'Supplier kemasan murah tapi aman buat makanan?',
      body: 'Ada rekomendasi paper bowl food grade untuk bisnis rice bowl?',
      href: '/community?thread=e2e-thread-001',
      threadId: 'e2e-thread-001',
      communityName: 'Supplier Kemasan',
      author: communityAuthor,
      group: communityGroup,
      category: {
        id: 'supply',
        slug: 'supply',
        name: 'Supply & Operasional',
        postCount: 1,
      },
      stats: { reactions: 12, comments: 4, shares: 2 },
      tags: [communityTag],
      createdAt: '2026-05-21T08:00:00.000Z',
      updatedAt: '2026-05-21T08:00:00.000Z',
      viewerVote: 0,
    },
  ],
  overview: {
    categories: [{ id: 'supply', slug: 'supply', name: 'Supply & Operasional', postCount: 1 }],
    groups: [communityGroup],
    recommendedGroups: [communityGroup],
    joinedGroups: [communityGroup],
    trendingTags: [communityTag],
    topContributors: [communityAuthor],
    stats: { totalThreads: 1, totalPosts: 1, totalUsers: 128 },
  },
  nextCursor: null,
  hasMore: false,
};

const communitySearch = {
  query: seedSearchQuery,
  kind: 'all',
  posts: communityFeed.items,
  groups: [communityGroup],
  people: [communityAuthor],
  reels: [],
  counts: { all: 3, posts: 1, people: 1, reels: 0, marketplace: 1, groups: 1 },
};

const reels = {
  data: [
    {
      id: 'e2e-reel-001',
      title: 'Cara packing produk biar terlihat premium',
      caption: 'Tiga langkah singkat untuk UMKM.',
      videoSrc: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
      thumbnail: 'https://placehold.co/720x1280/png?text=Reels',
      author: { id: 'e2e-user-002', name: 'Lajukan Studio', avatarUrl: '/default-avatar.svg' },
      stats: { likes: 24, comments: 3, shares: 2, views: 1200 },
      productHref: '/search?q=kemasan',
      createdAt: '2026-05-21T08:00:00.000Z',
    },
  ],
};

async function fulfillJson(route: Route, payload: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

export async function installStableApiFixtures(page: Page) {
  await page.route('**/api/content?**', route => fulfillJson(route, { items: contentItems }));
  await page.route('**/api/community/feed?**', route => fulfillJson(route, communityFeed));
  await page.route('**/api/community/search?**', route => fulfillJson(route, communitySearch));
  await page.route('**/api/reels?**', route => fulfillJson(route, reels));
  await page.route('**/api/reels/*/comments?**', route => fulfillJson(route, { data: [] }));
  await page.route('**/api/lajukan/summary', route =>
    fulfillJson(route, {
      data: {
        categories: { all: 42, supplier: 12, location: 6, service: 9, product: 10, talent: 5 },
        requests: { total: 18, active: 7, waiting: 3, completed: 8 },
        stores: { total: 16, cities: 5, verified: 4 },
      },
    }),
  );
}
