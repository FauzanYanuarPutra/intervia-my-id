import { buildContentHref } from '@/lib/content/routes';

const DEFAULT_SITE_URL =
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.lajukan.com';

export type SocialChannelId =
  | 'linkedin'
  | 'instagram'
  | 'facebook'
  | 'tiktok'
  | 'x'
  | 'whatsapp'
  | 'telegram';

export type SocialConnection = {
  channel: SocialChannelId;
  enabled: boolean;
  label?: string;
  handle?: string;
  targetUrl?: string;
  accountType?: string;
  notes?: string;
  connectedAt?: string;
};

export type SocialConnectionMap = Partial<Record<SocialChannelId, SocialConnection>>;

export type SharePackChannel = {
  id: SocialChannelId;
  label: string;
  status: 'connected' | 'ready' | 'manual';
  caption: string;
  shareUrl: string;
  actionLabel: string;
  helper: string;
};

export type SharePackInput = {
  locale: string;
  title: string;
  summary?: string | null;
  body?: string | null;
  tags?: string[] | null;
  priceLabel?: string | null;
  listingUrl?: string | null;
  slug?: string | null;
  contentId?: string | null;
  coverImage?: string | null;
  listingSideLabel?: string | null;
  typeLabel?: string | null;
  locationLabel?: string | null;
  connections?: SocialConnectionMap | null;
};

function trimText(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function toTags(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(entry => (typeof entry === 'string' ? entry.trim() : ''))
    .filter(Boolean);
}

function slugifyTag(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .trim()
    .replace(/\s+/g, '');
}

export function readSocialConnections(metadata: unknown): SocialConnectionMap {
  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return {};
  const root = metadata as Record<string, unknown>;
  const raw =
    root.social_connections &&
    typeof root.social_connections === 'object' &&
    !Array.isArray(root.social_connections)
      ? (root.social_connections as Record<string, unknown>)
      : {};

  const entries = Object.entries(raw).map(([key, value]) => {
    const channel = key as SocialChannelId;
    if (
      ![
        'linkedin',
        'instagram',
        'facebook',
        'tiktok',
        'x',
        'whatsapp',
        'telegram',
      ].includes(channel)
    ) {
      return null;
    }
    const record =
      value && typeof value === 'object' && !Array.isArray(value)
        ? (value as Record<string, unknown>)
        : {};
    return [
      channel,
      {
        channel,
        enabled: Boolean(record.enabled),
        label: trimText(record.label),
        handle: trimText(record.handle),
        targetUrl: trimText(record.targetUrl),
        accountType: trimText(record.accountType),
        notes: trimText(record.notes),
        connectedAt: trimText(record.connectedAt),
      } satisfies SocialConnection,
    ] as const;
  });

  return Object.fromEntries(entries.filter(Boolean) as Array<readonly [SocialChannelId, SocialConnection]>);
}

function truncate(value: string, limit: number): string {
  if (value.length <= limit) return value;
  const clipped = value.slice(0, Math.max(0, limit - 1));
  const lastSpace = clipped.lastIndexOf(' ');
  return `${(lastSpace > 0 ? clipped.slice(0, lastSpace) : clipped).trim()}...`;
}

function absolutizeUrl(value: string): string {
  const normalized = trimText(value);
  if (!normalized) return '';
  if (/^https?:\/\//i.test(normalized)) return normalized;
  const base = DEFAULT_SITE_URL.replace(/\/+$/, '');
  const path = normalized.startsWith('/') ? normalized : `/${normalized}`;
  return `${base}${path}`;
}

function getListingUrl(input: SharePackInput): string {
  if (trimText(input.listingUrl)) return absolutizeUrl(trimText(input.listingUrl));
  if (trimText(input.contentId)) {
    return absolutizeUrl(
      buildContentHref(
        trimText(input.contentId),
        trimText(input.title),
        trimText(input.slug),
      ),
    );
  }
  return '';
}

function buildBaseMessage(input: SharePackInput): string {
  const locale = input.locale === 'id' ? 'id' : 'en';
  const summary = trimText(input.summary) || truncate(trimText(input.body), 180);
  const typeLabel = trimText(input.typeLabel);
  const sideLabel = trimText(input.listingSideLabel);
  const locationLabel = trimText(input.locationLabel);
  const priceLabel = trimText(input.priceLabel);
  const metaParts = [typeLabel, sideLabel, locationLabel, priceLabel].filter(Boolean);
  const lead = locale === 'id' ? 'Bantu dorong listing ini:' : 'Help push this listing:';
  return [lead, trimText(input.title), summary, metaParts.join(' | ')].filter(Boolean).join('\n');
}

function buildHashtagLine(tags: string[], locale: string): string {
  const selected = tags.slice(0, 5).map(tag => `#${slugifyTag(tag)}`).filter(Boolean);
  if (selected.length > 0) return selected.join(' ');
  return locale === 'id' ? '#Lajukan #JualanCepat' : '#Lajukan #BusinessGrowth';
}

function buildCaption(input: SharePackInput, variant: SocialChannelId): string {
  const locale = input.locale === 'id' ? 'id' : 'en';
  const base = buildBaseMessage(input);
  const tags = buildHashtagLine(toTags(input.tags), locale);
  const url = getListingUrl(input);

  if (variant === 'linkedin') {
    return [
      base,
      locale === 'id'
        ? 'Kalau relevan, saya terbuka untuk diskusi, partnership, atau respons cepat dari channel yang tepat.'
        : 'If relevant, I am open to discussion, partnerships, or a quick response from the right channel.',
      url,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  if (variant === 'instagram' || variant === 'facebook' || variant === 'tiktok') {
    return [
      base,
      locale === 'id'
        ? 'Kalau cocok, klik link listing atau DM untuk lanjut.'
        : 'If it fits, open the listing link or DM to continue.',
      tags,
      url,
    ]
      .filter(Boolean)
      .join('\n\n');
  }

  if (variant === 'x') {
    return truncate([trimText(input.title), trimText(input.summary), url].filter(Boolean).join(' - '), 260);
  }

  return [base, tags, url].filter(Boolean).join('\n\n');
}

function buildShareUrl(channel: SocialChannelId, caption: string, url: string): string {
  if (!url) {
    switch (channel) {
      case 'linkedin':
        return 'https://www.linkedin.com/feed/';
      case 'facebook':
        return 'https://www.facebook.com/';
      case 'instagram':
        return 'https://www.instagram.com/';
      case 'tiktok':
        return 'https://www.tiktok.com/creator-center/upload';
      case 'x':
        return 'https://x.com/compose/post';
      case 'telegram':
        return 'https://web.telegram.org/';
      case 'whatsapp':
        return 'https://web.whatsapp.com/';
      default:
        return DEFAULT_SITE_URL;
    }
  }

  const encodedUrl = encodeURIComponent(url);
  const encodedCaption = encodeURIComponent(caption);

  switch (channel) {
    case 'linkedin':
      return `https://www.linkedin.com/sharing/share-offsite/?url=${encodedUrl}`;
    case 'facebook':
      return `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}`;
    case 'instagram':
      return 'https://www.instagram.com/';
    case 'tiktok':
      return 'https://www.tiktok.com/creator-center/upload';
    case 'x':
      return `https://twitter.com/intent/tweet?text=${encodedCaption}&url=${encodedUrl}`;
    case 'telegram':
      return `https://t.me/share/url?url=${encodedUrl}&text=${encodedCaption}`;
    case 'whatsapp':
      return `https://wa.me/?text=${encodeURIComponent(`${caption}\n\n${url}`.trim())}`;
    default:
      return url;
  }
}

export function buildSharePackChannels(input: SharePackInput): SharePackChannel[] {
  const locale = input.locale === 'id' ? 'id' : 'en';
  const url = getListingUrl(input);
  const connections = input.connections || {};

  const channels: Array<{
    id: SocialChannelId;
    label: string;
    actionLabelId: string;
    actionLabelEn: string;
    helperId: string;
    helperEn: string;
  }> = [
    {
      id: 'linkedin',
      label: 'LinkedIn',
      actionLabelId: 'Publish / buka',
      actionLabelEn: 'Publish / open',
      helperId: 'Paling siap untuk distribusi B2B dan post profesional.',
      helperEn: 'Best-ready path for B2B distribution and professional posting.',
    },
    {
      id: 'instagram',
      label: 'Instagram',
      actionLabelId: 'Copy & buka app',
      actionLabelEn: 'Copy & open app',
      helperId: 'Untuk akun professional atau Page-linked workflow.',
      helperEn: 'For professional accounts or Page-linked workflows.',
    },
    {
      id: 'facebook',
      label: 'Facebook',
      actionLabelId: 'Share',
      actionLabelEn: 'Share',
      helperId: 'Cocok untuk Page, komunitas, dan distribusi link cepat.',
      helperEn: 'Works well for Pages, communities, and quick link distribution.',
    },
    {
      id: 'tiktok',
      label: 'TikTok',
      actionLabelId: 'Copy & upload',
      actionLabelEn: 'Copy & upload',
      helperId: 'Siapkan caption dan buka upload flow creator.',
      helperEn: 'Prepare the caption and open the creator upload flow.',
    },
    {
      id: 'x',
      label: 'X',
      actionLabelId: 'Post',
      actionLabelEn: 'Post',
      helperId: 'Cocok untuk teaser singkat dan traffic cepat.',
      helperEn: 'Good for short teasers and quick traffic.',
    },
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      actionLabelId: 'Broadcast',
      actionLabelEn: 'Broadcast',
      helperId: 'Paling cepat untuk follow-up buyer, reseller, dan channel sendiri.',
      helperEn: 'Fastest for buyer follow-up, reseller outreach, and your own network.',
    },
    {
      id: 'telegram',
      label: 'Telegram',
      actionLabelId: 'Share',
      actionLabelEn: 'Share',
      helperId: 'Bagus untuk grup jualan dan distribusi komunitas.',
      helperEn: 'Useful for sales groups and community distribution.',
    },
  ];

  return channels.map(channel => {
    const caption = buildCaption(input, channel.id);
    const connection = connections[channel.id];
    return {
      id: channel.id,
      label: channel.label,
      status: connection?.enabled ? 'connected' : channel.id === 'linkedin' || channel.id === 'facebook' || channel.id === 'x' || channel.id === 'whatsapp' || channel.id === 'telegram' ? 'ready' : 'manual',
      caption,
      shareUrl: buildShareUrl(channel.id, caption, url),
      actionLabel:
        locale === 'id' ? channel.actionLabelId : channel.actionLabelEn,
      helper:
        locale === 'id' ? channel.helperId : channel.helperEn,
    };
  });
}
