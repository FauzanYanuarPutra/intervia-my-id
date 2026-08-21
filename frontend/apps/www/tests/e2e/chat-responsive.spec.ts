import {
  expect,
  test,
  type Locator,
  type Page,
  type Route,
} from '@playwright/test';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const ROOM_ID = 'responsive-chat-room';
const ROOM_NAME = 'Responsive Team';
const CHAT_PATH = `/en/chat/${ROOM_ID}`;

const inboxRoom = {
  id: ROOM_ID,
  room_id: ROOM_ID,
  name: ROOM_NAME,
  room_name: ROOM_NAME,
  last_message: 'Responsive fixture is ready',
  last_message_at: '2026-08-13T08:00:00.000Z',
  last_sender: '22222222-2222-4222-8222-222222222222',
  unread_count: 1,
};

async function fulfillJson(route: Route, payload: unknown) {
  await route.fulfill({
    status: 200,
    contentType: 'application/json',
    body: JSON.stringify(payload),
  });
}

async function installChatFixtures(page: Page) {
  const baseUrl = new URL(process.env.E2E_BASE_URL || 'http://localhost:3000');

  await page.context().addCookies([
    {
      name: 'refresh_token',
      value: 'responsive-refresh-token',
      url: baseUrl.origin,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'session_id',
      value: 'responsive-session-id',
      url: baseUrl.origin,
      httpOnly: true,
      sameSite: 'Lax',
    },
    {
      name: 'auth_present',
      value: '1',
      url: baseUrl.origin,
      sameSite: 'Lax',
    },
  ]);

  // Keep both Phoenix chat channels local to this spec. Acknowledge joins and
  // heartbeats so the responsive UI is not coupled to a running chat service.
  await page.routeWebSocket(
    /\/(?:socket(?:\/websocket)?|api\/notifications\/ws)(?:\?|$)/,
    socket => {
      socket.onMessage(message => {
        if (typeof message !== 'string') return;
        try {
          const frame = JSON.parse(message) as unknown;
          if (!Array.isArray(frame) || frame.length < 5) return;
          const [joinRef, ref, topic, event] = frame;
          if (event !== 'phx_join' && event !== 'heartbeat') return;
          socket.send(
            JSON.stringify([
              joinRef,
              ref,
              topic,
              'phx_reply',
              { status: 'ok', response: {} },
            ]),
          );
        } catch {
          // Notification sockets use a different payload and need no reply.
        }
      });
    },
  );

  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url());
    const { pathname } = url;

    if (pathname === '/api/auth/refresh') {
      return fulfillJson(route, { access_token: 'responsive-access-token' });
    }
    if (pathname === '/api/auth/me') {
      return fulfillJson(route, {
        id: USER_ID,
        email: 'responsive@lajukan.test',
        full_name: 'Responsive Tester',
        username: 'responsive-tester',
        roles: ['user'],
        permissions: [],
      });
    }
    if (pathname === '/api/chat/inbox') {
      return fulfillJson(route, { data: [inboxRoom] });
    }
    if (
      pathname === `/api/chat/rooms/${ROOM_ID}/messages` &&
      route.request().method() === 'GET'
    ) {
      return fulfillJson(route, {
        room_name: ROOM_NAME,
        messages: [],
      });
    }
    if (pathname === `/api/chat/rooms/${ROOM_ID}/read`) {
      return fulfillJson(route, { ok: true });
    }
    if (pathname === `/api/chat/rooms/${ROOM_ID}/transactions`) {
      return fulfillJson(route, { transactions: [] });
    }
    if (pathname === '/api/notifications/unread-count') {
      return fulfillJson(route, { count: 0 });
    }
    if (pathname === '/api/notifications') {
      return fulfillJson(route, { items: [], data: [], total: 0 });
    }

    return fulfillJson(route, { data: [], items: [], accepted: true });
  });
}

async function expectInsideViewport(page: Page, locator: Locator) {
  const [viewport, box] = await Promise.all([
    page.viewportSize(),
    locator.boundingBox(),
  ]);

  expect(viewport).not.toBeNull();
  expect(box).not.toBeNull();
  if (!viewport || !box) return;

  expect(box.x).toBeGreaterThanOrEqual(-1);
  expect(box.y).toBeGreaterThanOrEqual(-1);
  expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 1);
  expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 1);
}

async function expectNoHorizontalOverflow(page: Page) {
  const widths = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth,
    body: document.body.scrollWidth,
  }));

  expect(widths.document, JSON.stringify(widths)).toBeLessThanOrEqual(
    widths.viewport + 1,
  );
  expect(widths.body, JSON.stringify(widths)).toBeLessThanOrEqual(
    widths.viewport + 1,
  );
}

test.describe('chat responsive regression', () => {
  test.use({ serviceWorkers: 'block' });

  for (const width of [320, 360]) {
    test(`${width}px keeps the composer and compact attachment features reachable`, async ({
      page,
    }) => {
      await page.setViewportSize({ width, height: 760 });
      await installChatFixtures(page);
      await page.goto(CHAT_PATH, { waitUntil: 'domcontentloaded' });

      const composer = page.getByRole('textbox', { name: 'Message' });
      const attachmentTrigger = page.getByRole('button', {
        name: 'Open attachment options',
      });

      await expect(composer).toBeVisible();
      await expect(composer).toBeEnabled();
      await expect(attachmentTrigger).toBeVisible();
      await attachmentTrigger.click();

      const tray = page.getByRole('menu', { name: 'Attachment options' });
      await expect(tray).toBeVisible();
      for (const name of ['Camera', 'File', 'Sticker', 'AI']) {
        const action = tray.getByRole('menuitem', { name, exact: true });
        await expect(action).toBeVisible();
        await expect(action).toBeEnabled();
        const actionBox = await action.boundingBox();
        expect(
          actionBox?.height ?? 0,
          `${name} target height`,
        ).toBeGreaterThanOrEqual(44);
      }

      await expect(page.getByPlaceholder('Search chats')).not.toBeVisible();
      await expectInsideViewport(page, composer);
      await expectInsideViewport(page, tray);
      await expectNoHorizontalOverflow(page);
    });
  }

  test('768px keeps inbox and active room visible as a split view', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 768, height: 900 });
    await installChatFixtures(page);
    await page.goto(CHAT_PATH, { waitUntil: 'domcontentloaded' });

    const inboxSearch = page.getByPlaceholder('Search chats');
    const inboxPane = page.locator('section').filter({ has: inboxSearch });
    const activeRoomHeading = page.getByRole('heading', {
      name: ROOM_NAME,
      exact: true,
      level: 1,
    });
    const composer = page.getByRole('textbox', { name: 'Message' });

    await expect(inboxPane).toBeVisible();
    await expect(inboxSearch).toBeVisible();
    await expect(activeRoomHeading).toBeVisible();
    await expect(composer).toBeVisible();

    const [inboxBox, roomHeadingBox] = await Promise.all([
      inboxPane.boundingBox(),
      activeRoomHeading.boundingBox(),
    ]);
    expect(inboxBox).not.toBeNull();
    expect(roomHeadingBox).not.toBeNull();
    if (inboxBox && roomHeadingBox) {
      expect(inboxBox.width).toBeGreaterThanOrEqual(300);
      expect(inboxBox.width).toBeLessThanOrEqual(340);
      expect(roomHeadingBox.x).toBeGreaterThanOrEqual(
        inboxBox.x + inboxBox.width,
      );
    }

    await expectInsideViewport(page, composer);
    await expectNoHorizontalOverflow(page);
  });
});
