import { buildContentHref } from '@/lib/content/routes';
import { buildUmkmDiscoveryPath } from '@/lib/umkmSurface';

type NotificationLike = {
  data?: unknown;
  category?: string | null;
  event_type?: string | null;
  title?: string | null;
  message?: string | null;
};

type NotificationData = Record<string, unknown>;

function readNotificationData(
  notification: NotificationLike,
): NotificationData {
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
  const entityId = readNotificationDataText(notification, [
    'entity_id',
    'entityId',
  ]);
  const entityTitle = readNotificationDataText(notification, [
    'entity_label',
    'content_title',
    'reel_title',
    'profile_name',
    'title',
    'name',
  ]);
  const entitySlug = readNotificationDataText(notification, [
    'slug',
    'entity_slug',
  ]);

  if (entityType === 'profile' && entityId) {
    return `/profile/${encodeURIComponent(entityId)}`;
  }
  if ((entityType === 'reel' || entityType === 'reels') && entityId) {
    return `/reels?video=${encodeURIComponent(entityId)}`;
  }
  if (entityType === 'content' && entityId) {
    return buildContentHref(
      entityId,
      entityTitle || undefined,
      entitySlug || undefined,
    );
  }
  if ((entityType === 'map' || entityType === 'maps') && entityId) {
    return buildUmkmDiscoveryPath({ storeId: entityId });
  }

  return '/notifications';
}

export function notificationSocialContext(notification: NotificationLike) {
  const actorName =
    readNotificationDataText(notification, [
      'actor_name',
      'actor_full_name',
      'actor_display_name',
      'viewer_name',
      'viewer_full_name',
      'sender_name',
      'sender_full_name',
      'full_name',
      'display_name',
      'name',
    ]) || '';
  const actorHandle =
    readNotificationDataText(notification, [
      'actor_username',
      'actor_handle',
      'viewer_username',
      'sender_username',
      'username',
    ]) || '';
  const actorAvatarUrl =
    readNotificationDataText(notification, [
      'actor_avatar_url',
      'actor_avatar',
      'actor_photo_url',
      'actor_profile_image_url',
      'viewer_avatar_url',
      'viewer_avatar',
      'sender_avatar_url',
      'sender_avatar',
      'avatar_url',
      'photo_url',
      'picture_url',
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
    String(notification.event_type || '')
      .split('.')
      .pop() ||
    '';
  const actionCopy =
    readNotificationDataText(notification, [
      'action_copy',
      'action_label',
      'verb',
    ]) || '';

  return {
    actorName,
    actorHandle,
    actorAvatarUrl,
    entityLabel,
    entityType,
    action,
    actionCopy,
    href: notificationTargetHref(notification),
  };
}

export function notificationSocialSummary(
  notification: NotificationLike,
  locale: 'id' | 'en' = 'id',
) {
  const social = notificationSocialContext(notification);
  const event = String(notification.event_type || '')
    .trim()
    .toLowerCase();
  const actor =
    social.actorName ||
    (social.actorHandle
      ? social.actorHandle.startsWith('@')
        ? social.actorHandle
        : `@${social.actorHandle}`
      : '');
  const entity = social.entityLabel || '';
  const entityTypeLabel = notificationTargetLabel(social.entityType, locale);
  const fallbackTitle =
    String(notification.title || '').trim() ||
    (locale === 'id' ? 'Notifikasi baru' : 'New notification');

  const actionLabel = (() => {
    if (event.includes('liked') || event.includes('like')) {
      return locale === 'id' ? 'Menyukai' : 'Liked';
    }
    if (event.includes('commented') || event.includes('comment')) {
      return locale === 'id' ? 'Mengomentari' : 'Commented on';
    }
    if (event.includes('replied') || event.includes('reply')) {
      return locale === 'id' ? 'Membalas' : 'Replied to';
    }
    if (event.includes('viewed') || event.includes('profile_opened')) {
      return locale === 'id' ? 'Melihat' : 'Viewed';
    }
    if (event.includes('route_clicked')) {
      return locale === 'id' ? 'Membuka rute' : 'Opened directions';
    }
    if (event.includes('message')) {
      return locale === 'id' ? 'Mengirim pesan' : 'Sent a message';
    }
    const copy = social.actionCopy.trim();
    if (copy) return copy.charAt(0).toUpperCase() + copy.slice(1);
    return locale === 'id' ? 'Update baru' : 'New update';
  })();

  const target = entity || entityTypeLabel;
  const actionTitle =
    target && entityTypeLabel
      ? `${actionLabel} ${entityTypeLabel.toLowerCase()}`
      : actionLabel;
  const subtitle = target
    ? target
    : String(notification.message || '').trim() ||
      (locale === 'id' ? 'Ada update baru.' : 'There is a new update.');
  const metaParts = [actor, entityTypeLabel].filter(Boolean);

  return {
    title: target ? actionTitle : actor || fallbackTitle,
    handle:
      social.actorHandle && social.actorName
        ? social.actorHandle.startsWith('@')
          ? social.actorHandle
          : `@${social.actorHandle}`
        : '',
    subtitle,
    actor,
    entity,
    entityTypeLabel,
    actionLabel,
    actionTitle,
    targetTitle: target,
    metaLabel: metaParts.join(' · '),
    href: social.href,
  };
}

export function notificationTargetLabel(
  entityType: string,
  locale: 'id' | 'en' = 'id',
): string {
  const value = String(entityType || '')
    .trim()
    .toLowerCase();
  if (!value) return '';
  if (value === 'profile') return locale === 'id' ? 'profil' : 'profile';
  if (value === 'reel' || value === 'reels') return 'Reels';
  if (value === 'content') return locale === 'id' ? 'listing' : 'listing';
  if (value === 'map' || value === 'maps')
    return locale === 'id' ? 'lokasi' : 'place';
  if (value === 'chat') return 'Chat';
  return value
    .split(/[_-]+/)
    .filter(Boolean)
    .map(part => part[0].toUpperCase() + part.slice(1))
    .join(' ');
}
