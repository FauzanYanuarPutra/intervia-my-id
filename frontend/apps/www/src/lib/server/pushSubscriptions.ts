import 'server-only';

import { Pool } from 'pg';

type PushSubscriptionRow = {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth_secret: string;
  user_agent: string | null;
  device_label: string | null;
};

declare global {
  // eslint-disable-next-line no-var
  var __lajukanPushPool: Pool | undefined;
}

function getPool(): Pool {
  if (globalThis.__lajukanPushPool) return globalThis.__lajukanPushPool;

  const connectionString =
    process.env.PUSH_DATABASE_URL || process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not configured');
  }

  const pool = new Pool({
    connectionString,
    max: 5,
    idleTimeoutMillis: 10_000,
    allowExitOnIdle: true,
  });

  globalThis.__lajukanPushPool = pool;
  return pool;
}

export async function ensurePushSubscriptionTable() {
  const pool = getPool();

  await pool.query(`
    CREATE TABLE IF NOT EXISTS lajukan_push_subscriptions (
      endpoint TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth_secret TEXT NOT NULL,
      user_agent TEXT,
      device_label TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )
  `);

  await pool.query(
    'CREATE INDEX IF NOT EXISTS idx_lajukan_push_subscriptions_user ON lajukan_push_subscriptions(user_id)',
  );
}

export async function upsertPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  deviceLabel?: string | null;
}) {
  await ensurePushSubscriptionTable();

  const pool = getPool();
  await pool.query(
    `
      INSERT INTO lajukan_push_subscriptions
        (endpoint, user_id, p256dh, auth_secret, user_agent, device_label)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT (endpoint)
      DO UPDATE SET
        user_id = EXCLUDED.user_id,
        p256dh = EXCLUDED.p256dh,
        auth_secret = EXCLUDED.auth_secret,
        user_agent = EXCLUDED.user_agent,
        device_label = EXCLUDED.device_label,
        updated_at = NOW(),
        last_seen_at = NOW()
    `,
    [
      input.endpoint,
      input.userId,
      input.p256dh,
      input.auth,
      input.userAgent ?? null,
      input.deviceLabel ?? null,
    ],
  );
}

export async function listPushSubscriptions(
  userId: string,
): Promise<PushSubscriptionRow[]> {
  await ensurePushSubscriptionTable();
  const pool = getPool();
  const result = await pool.query<PushSubscriptionRow>(
    `
      SELECT endpoint, user_id, p256dh, auth_secret, user_agent, device_label
      FROM lajukan_push_subscriptions
      WHERE user_id = $1
      ORDER BY last_seen_at DESC
    `,
    [userId],
  );
  return result.rows;
}

export async function deletePushSubscription(
  userId: string,
  endpoint: string,
) {
  await ensurePushSubscriptionTable();
  const pool = getPool();
  await pool.query(
    'DELETE FROM lajukan_push_subscriptions WHERE user_id = $1 AND endpoint = $2',
    [userId, endpoint],
  );
}

export async function deletePushEndpoint(endpoint: string) {
  await ensurePushSubscriptionTable();
  const pool = getPool();
  await pool.query(
    'DELETE FROM lajukan_push_subscriptions WHERE endpoint = $1',
    [endpoint],
  );
}