import 'server-only';

import crypto from 'node:crypto';
import { getRedis } from '@/lib/redis';

type PushSubscriptionRow = {
  endpoint: string;
  user_id: string;
  p256dh: string;
  auth_secret: string;
  user_agent: string | null;
  device_label: string | null;
};

const USER_PREFIX = 'push:subscriptions:user:';
const ENDPOINT_PREFIX = 'push:subscriptions:endpoint:';

function userKey(userId: string) {
  return USER_PREFIX + userId.trim();
}

function endpointKey(endpoint: string) {
  return (
    ENDPOINT_PREFIX +
    crypto.createHash('sha256').update(endpoint).digest('hex')
  );
}

function parseRow(value: string | null): PushSubscriptionRow | null {
  if (!value) return null;

  try {
    const parsed = JSON.parse(value) as Partial<PushSubscriptionRow>;
    if (
      typeof parsed.endpoint !== 'string' ||
      typeof parsed.user_id !== 'string' ||
      typeof parsed.p256dh !== 'string' ||
      typeof parsed.auth_secret !== 'string'
    ) {
      return null;
    }

    return {
      endpoint: parsed.endpoint,
      user_id: parsed.user_id,
      p256dh: parsed.p256dh,
      auth_secret: parsed.auth_secret,
      user_agent: parsed.user_agent ?? null,
      device_label: parsed.device_label ?? null,
    };
  } catch {
    return null;
  }
}

export async function ensurePushSubscriptionTable() {
  // Kept as a compatibility name for the existing API. Redis is already
  // provisioned for the WWW runtime, so there is no schema migration or
  // backend startup dependency.
  await getRedis().ping();
}

export async function upsertPushSubscription(input: {
  userId: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  userAgent?: string | null;
  deviceLabel?: string | null;
}) {
  const userId = input.userId.trim();
  const endpoint = input.endpoint.trim();
  if (!userId || !endpoint) {
    throw new Error('Push subscription user and endpoint are required');
  }

  const redis = getRedis();
  const row: PushSubscriptionRow = {
    endpoint,
    user_id: userId,
    p256dh: input.p256dh,
    auth_secret: input.auth,
    user_agent: input.userAgent ?? null,
    device_label: input.deviceLabel ?? null,
  };

  const previousUserId = await redis.get(endpointKey(endpoint));
  const encoded = JSON.stringify(row);
  const pipeline = redis.pipeline();

  if (previousUserId && previousUserId !== userId) {
    pipeline.hdel(userKey(previousUserId), endpoint);
  }

  pipeline.hset(userKey(userId), endpoint, encoded);
  pipeline.set(endpointKey(endpoint), userId);

  await pipeline.exec();
}

export async function listPushSubscriptions(
  userId: string,
): Promise<PushSubscriptionRow[]> {
  const cleanUserId = userId.trim();
  if (!cleanUserId) return [];

  const redis = getRedis();
  const rows = await redis.hgetall(userKey(cleanUserId));

  return Object.values(rows)
    .map(value => parseRow(value))
    .filter((value): value is PushSubscriptionRow => value !== null);
}

export async function deletePushSubscription(
  userId: string,
  endpoint: string,
) {
  const cleanUserId = userId.trim();
  const cleanEndpoint = endpoint.trim();
  if (!cleanUserId || !cleanEndpoint) return;

  const redis = getRedis();
  const pipeline = redis.pipeline();
  pipeline.hdel(userKey(cleanUserId), cleanEndpoint);
  pipeline.del(endpointKey(cleanEndpoint));
  await pipeline.exec();
}

export async function deletePushEndpoint(endpoint: string) {
  const cleanEndpoint = endpoint.trim();
  if (!cleanEndpoint) return;

  const redis = getRedis();
  const ownerId = await redis.get(endpointKey(cleanEndpoint));
  if (!ownerId) return;

  const pipeline = redis.pipeline();
  pipeline.hdel(userKey(ownerId), cleanEndpoint);
  pipeline.del(endpointKey(cleanEndpoint));
  await pipeline.exec();
}
