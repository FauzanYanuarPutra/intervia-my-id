import type { InboxNotification } from '@/context/NotificationInboxContext';

type NotificationData = Record<string, unknown>;

export function normalizeRecipientName(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function readNotificationData(
  notification: InboxNotification,
): NotificationData {
  const data = notification.data;
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as NotificationData)
    : {};
}

function readNotificationDataText(
  notification: InboxNotification,
  keys: string[],
): string {
  const data = readNotificationData(notification);
  for (const key of keys) {
    const value = data[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
    if (typeof value === 'number' && Number.isFinite(value)) {
      return String(value);
    }
  }
  return '';
}

function readNotificationEventName(notification: InboxNotification): string {
  const fromData = readNotificationDataText(notification, [
    'event_name',
    'action',
  ]);
  if (fromData) return fromData;

  const value = notification.event_type;
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(value);
  }
  return '';
}

function readNotificationEntityType(notification: InboxNotification): string {
  return readNotificationDataText(notification, ['entity_type', 'entityType']);
}

function readNotificationEntityId(notification: InboxNotification): string {
  return readNotificationDataText(notification, ['entity_id', 'entityId']);
}

function readNotificationTargetHref(notification: InboxNotification): string {
  return readNotificationDataText(notification, [
    'href',
    'target_href',
    'target_url',
    'content_url',
    'url',
    'action_url',
    'actionHref',
  ]);
}

export function resolveNotificationReelId(notification: InboxNotification): string {
  const directEntityId = readNotificationEntityId(notification);
  if (directEntityId) return directEntityId;

  const directHref = readNotificationTargetHref(notification);
  if (!directHref) return '';

  try {
    const base =
      typeof window !== 'undefined'
        ? window.location.origin
        : 'http://localhost';
    const parsed = new URL(directHref, base);
    const queryReel =
      parsed.searchParams.get('video')?.trim() ||
      parsed.searchParams.get('reel')?.trim();
    if (queryReel) return queryReel;
    const pathParts = parsed.pathname.split('/').filter(Boolean);
    if (pathParts[0] === 'reels' && pathParts[1]?.trim()) {
      return pathParts[1].trim();
    }
    return '';
  } catch {
    const match = directHref.match(/[?&](?:video|reel)=([^&#]+)/i);
    if (match?.[1]) {
      try {
        return decodeURIComponent(match[1]).trim();
      } catch {
        return match[1].trim();
      }
    }
    return '';
  }
}

export function isReelCommentNotification(notification: InboxNotification): boolean {
  const eventName = readNotificationEventName(notification).toLowerCase();
  const entityType = readNotificationEntityType(notification).toLowerCase();
  const text = [
    notification.category,
    notification.event_type,
    notification.title,
    notification.message,
    eventName,
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  if (eventName === 'reels.commented' || eventName === 'reels.replied') {
    return true;
  }

  if (entityType === 'reel' || entityType === 'reels') {
    return (
      text.includes('comment') ||
      text.includes('reply') ||
      text.includes('reels.')
    );
  }

  return false;
}

