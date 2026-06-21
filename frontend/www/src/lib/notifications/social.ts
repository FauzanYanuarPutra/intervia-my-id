import { buildContentHref } from '@/lib/content/routes';

type NotificationLike = {
  data?: unknown;
  category?: string | null;
  event_type?: string | null;
  title?: string | null;
  message?: string | null;
};

type NotificationData = Record<string, unknown>;

function readNotificationData(notification: NotificationLike): NotificationData {
  const data = notification.data;
  return data && typeof data === 'object' && !Array.isArray(data)
    ? (data as NotificationData)
    : {};
}

export function readNotificationDataText(
  notification: NotificationLike,
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

export function notificationTargetHref(notification: NotificationLike): string {
  const data = readNotificationData(notification);
  const directHref = [
    'href',
    'target_href',
    'targetUrl',
    'target_url',
    'url',
    'action_url',
    'actionHref',
    'profile_href',
    'profile_url',
    'content_url',
  ]
    .map(key => readNotificationDataText({ data }, [key]))
    .find(value => value.startsWith('/'));

  if (directHref) return directHref;

  const entityType = readNotificationDataText(notification, [
    'entity_type',
    'entityType',
  ]).toLowerCase();
  const entityId = readNotificationDataText(notification, ['entity_id', 'entityId']);
  const entityTitle = readNotificationDataText(notification, [
    'entity_label',
    'content_title',
    'reel_title',
    'profile_name',
    'title',
    'name',
  ]);
  const entitySlug = readNotificationDataText(notification, ['slug', 'entity_slug']);

  if (entityType === 'profile' && entityId) {
    return `/profile/${encodeURIComponent(entityId)}`;
  }
  if ((entityType === 'reel' || entityType === 'reels') && entityId) {
    return `/reels?reel=${encodeURIComponent(entityId)}`;
  }
  if (entityType === 'content' && entityId) {
    return buildContentHref(entityId, entityTitle || undefined, entitySlug || undefined);
  }
  if ((entityType === 'map' || entityType === 'maps') && entityId) {
    return `/umkm?item=${encodeURIComponent(entityId)}`;
  }

  return '/notifications';
}

export function notificationSocialContext(notification: NotificationLike) {
  const actorName =
    readNotificationDataText(notification, [
      'actor_name',
      'actor_full_name',
      'viewer_name',
      'viewer_full_name',
      'sender_name',
    ]) || '';
  const actorHandle =
    readNotificationDataText(notification, [
      'actor_username',
      'viewer_username',
      'sender_username',
    ]) || '';
  const actorAvatarUrl =
    readNotificationDataText(notification, [
      'actor_avatar_url',
      'viewer_avatar_url',
      'sender_avatar_url',
    ]) || '';
  const entityLabel =
    readNotificationDataText(notification, [
      'entity_label',
      'content_title',
      'reel_title',
      'profile_name',
      'title',
      'name',
    ]) || '';
  const entityType =
    readNotificationDataText(notification, ['entity_type', 'entityType']) || '';
  const action =
    readNotificationDataText(notification, ['action', 'event_name']) ||
    String(notification.event_type || '').split('.').pop() ||
    '';

  return {
    actorName,
    actorHandle,
    actorAvatarUrl,
    entityLabel,
    entityType,
    action,
    href: notificationTargetHref(notification),
  };
}

export function notificationTargetLabel(entityType: string): string {
  const value = String(entityType || '').trim().toLowerCase();
  if (!value) return '';
  if (value === 'profile') return 'Profile';
  if (value === 'reel' || value === 'reels') return 'Reels';
  if (value === 'content') return 'Content';
  if (value === 'map' || value === 'maps') return 'Maps';
  if (value === 'chat') return 'Chat';
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
