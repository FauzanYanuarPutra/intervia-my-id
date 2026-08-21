import { expect, test, type Page, type Route } from '@playwright/test';
import { expectNoHorizontalOverflow } from './helpers/uxAssertions';

const OWNER_ID = '11111111-1111-4111-8111-111111111111';
const listingImage =
  'https://images.unsplash.com/photo-1648587456176-4969b0124b12?auto=format&fit=crop&w=900&q=80';
const communityImage =
  'https://images.unsplash.com/photo-1521737711867-e3b97375f902?auto=format&fit=crop&w=900&q=80';
const reelImage =
  'https://images.unsplash.com/photo-1545242640-7c9e9cc07d23?auto=format&fit=crop&w=720&h=1080&q=80';

async function fulfillJson(route: Route, payload: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

async function installManageSession(page: Page) {
  await page.context().addCookies([
    {
      name: 'refresh_token',
      value: 'manage-refresh-token',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'session_id',
      value: 'manage-session-id',
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'auth_present',
      value: '1',
      domain: 'localhost',
      path: '/',
      httpOnly: false,
      sameSite: 'Lax',
    },
  ]);

  await page.route('**/api/auth/refresh', route =>
    fulfillJson(route, { access_token: 'manage-access-token' }),
  );
  await page.route('**/api/auth/me', route =>
    fulfillJson(route, {
      id: OWNER_ID,
      email: 'pemilik@lajukan.test',
      full_name: 'Pemilik Usaha',
      username: 'pemilikusaha',
      roles: ['user'],
      permissions: [],
    }),
  );
  await page.route('**/api/users/**', route =>
    fulfillJson(route, {
      id: OWNER_ID,
      email: 'pemilik@lajukan.test',
      full_name: 'Pemilik Usaha',
      username: 'pemilikusaha',
      bio: 'Membangun usaha lokal bersama komunitas.',
      location: 'Bandung',
      avatar_url: '/default-avatar.svg',
      created_at: '2026-01-15T08:00:00.000Z',
    }),
  );
  await page.route('**/api/my-listings?**', route => {
    const status = new URL(route.request().url()).searchParams.get('status');
    const results =
      status === 'draft'
        ? [
            {
              id: 'listing-draft-001',
              owner_id: OWNER_ID,
              title: 'Draft jasa foto produk',
              content_status: 'draft',
              image_url: listingImage,
            },
          ]
        : status === 'archived'
          ? []
          : [
              {
                id: 'listing-active-001',
                owner_id: OWNER_ID,
                title: 'Supplier kemasan paper bowl',
                summary: 'Ready stok untuk UMKM kuliner.',
                content_status: 'active',
                image_url: listingImage,
                view_count: 128,
                created_at: '2026-05-21T08:00:00.000Z',
              },
            ];
    return fulfillJson(route, { results, total: results.length });
  });
  await page.route('**/api/forum/threads?**', route =>
    fulfillJson(route, {
      data: [
        {
          id: 'thread-owner-001',
          title: 'Cara memilih supplier kemasan yang aman?',
          createdAt: '2026-05-21T08:00:00.000Z',
          lastActivityAt: '2026-05-22T08:00:00.000Z',
          replyCount: 8,
          views: 93,
          status: 'published',
          imageUrls: [communityImage],
        },
      ],
      total: 1,
    }),
  );
  await page.route('**/api/reels?**', route =>
    fulfillJson(route, {
      items: [
        {
          id: 'reel-owner-001',
          title: 'Tiga cara bikin kemasan terlihat premium',
          caption: 'Tips singkat untuk UMKM.',
          tag: '#tipsusaha',
          mediaType: 'image',
          videoSrc: reelImage,
          sourceUrl: reelImage,
          thumbnail: reelImage,
          likesCount: 42,
          commentsCount: 7,
          sharesCount: 3,
        },
      ],
      nextCursor: null,
      hasMore: false,
    }),
  );
  await page.route('**/api/transactions?**', route =>
    fulfillJson(route, {
      data: [{ id: 'transaction-001', status: 'in_progress' }],
    }),
  );
  await page.route('**/api/chat/inbox**', route =>
    fulfillJson(route, {
      rooms: [{ id: 'room-001', title: 'Supplier Kemasan' }],
    }),
  );
  await page.route('**/api/super-app/umkm/stores?**', route =>
    fulfillJson(route, {
      data: {
        items: [{ id: 'store-001', name: 'Dapur Pemilik' }],
      },
    }),
  );
  await page.route('**/api/dashboard/stats', route =>
    fulfillJson(route, {
      total_content: 3,
      active_transactions: 1,
      unread_messages: 1,
      profile_views: 74,
      total_favorites: 9,
      user_rating: 4.8,
    }),
  );
  await page.route('**/api/community/users/**/social?**', route =>
    fulfillJson(route, {
      userId: OWNER_ID,
      followersCount: 12,
      followingCount: 4,
      reelsCount: 1,
      followers: [],
      following: [],
    }),
  );
  await page.route('**/api/notifications?**', route =>
    fulfillJson(route, { items: [], data: [], total: 0 }),
  );
  await page.route('**/api/notifications/unread-count**', route =>
    fulfillJson(route, { count: 0 }),
  );
  await page.route('**/api/events', route =>
    fulfillJson(route, { accepted: true }),
  );
}

test.describe('visual content management studio', () => {
  test.use({ serviceWorkers: 'block' });

  test('manage separates content channels from operations at a glance', async ({
    page,
  }) => {
    await installManageSession(page);
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/id/manage', { waitUntil: 'domcontentloaded' });

    await expect(page.getByTestId('manage-studio')).toBeVisible();
    await expect(page.getByTestId('manage-channel-listing')).toContainText(
      'Supplier kemasan paper bowl',
    );
    await expect(page.getByTestId('manage-channel-community')).toContainText(
      'Cara memilih supplier kemasan',
    );
    await expect(page.getByTestId('manage-channel-reel')).toContainText(
      'Tiga cara bikin kemasan',
    );
    await expect(
      page.getByRole('heading', { name: 'Operasional' }),
    ).toBeVisible();

    const channelBoxes = await Promise.all(
      ['listing', 'community', 'reel'].map(kind =>
        page.getByTestId(`manage-channel-${kind}`).boundingBox(),
      ),
    );
    expect(channelBoxes.every(Boolean)).toBe(true);
    await expectNoHorizontalOverflow(page, 4);
  });

  test('profile exposes one prominent cross-content entry point', async ({
    page,
  }) => {
    await installManageSession(page);
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/id/profile', { waitUntil: 'domcontentloaded' });

    const studio = page.getByTestId('profile-content-studio');
    await expect(studio).toBeVisible();
    await expect(studio.getByText('Listing Saya')).toBeVisible();
    await expect(studio.getByText('Komunitas', { exact: true })).toBeVisible();
    await expect(studio.getByText('Reels', { exact: true })).toBeVisible();
    await expect(
      studio.getByRole('link', { name: /Buka Studio Konten/i }),
    ).toHaveAttribute('href', /\/manage$/);
    await expectNoHorizontalOverflow(page, 4);
  });

  test('manage channel cards remain readable on mobile', async ({ page }) => {
    await installManageSession(page);
    await page.setViewportSize({ width: 360, height: 800 });
    await page.goto('/id/manage', { waitUntil: 'domcontentloaded' });

    for (const kind of ['listing', 'community', 'reel']) {
      const channel = page.getByTestId(`manage-channel-${kind}`);
      await expect(channel).toBeVisible();
      const box = await channel.boundingBox();
      expect(box?.x || 0).toBeGreaterThanOrEqual(0);
      expect((box?.x || 0) + (box?.width || 0)).toBeLessThanOrEqual(361);
    }
    await expectNoHorizontalOverflow(page, 4);
  });

  test('community and reels managers use visual content cards', async ({
    page,
  }) => {
    await installManageSession(page);
    await page.setViewportSize({ width: 1280, height: 860 });

    await page.goto('/id/manage/community', {
      waitUntil: 'domcontentloaded',
    });
    await expect(
      page.getByRole('heading', { name: 'Kelola postingan komunitas' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Cara memilih supplier kemasan yang aman?',
      }),
    ).toBeVisible();
    await expect(page.getByText('dilihat + balasan')).toBeVisible();

    await page.goto('/id/manage/reels', { waitUntil: 'domcontentloaded' });
    await expect(
      page.getByRole('heading', { name: 'Kelola reels' }),
    ).toBeVisible();
    await expect(
      page.getByRole('heading', {
        name: 'Tiga cara bikin kemasan terlihat premium',
      }),
    ).toBeVisible();
    await expect(page.getByRole('button', { name: /Arsipkan/i })).toBeVisible();
    await expectNoHorizontalOverflow(page, 4);
  });
});
