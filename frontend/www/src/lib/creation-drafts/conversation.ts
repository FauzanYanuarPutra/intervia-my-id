import {
  isSupportedCreationTarget,
  type SupportedCreationTarget,
} from './types';

export type CreationFlowStatus = 'collecting' | 'ready' | 'cancelled';

export type CreationFlowMedia = {
  kind?: 'image' | 'video' | 'audio' | 'document' | 'file';
  name?: string;
  mime?: string;
  size?: number;
  url?: string;
};

export type CreationFlowMetadata = {
  version: 1;
  target: SupportedCreationTarget;
  status: CreationFlowStatus;
  collected: Record<string, string>;
  collectedFields: string[];
  missingFields: string[];
  completeness: number;
  submitted: boolean;
  draftInstruction?: string;
  media: CreationFlowMedia[];
};

type CreationField = {
  key: string;
  labelId: string;
  labelEn: string;
  aliases: string[];
};

const TARGET_FIELDS: Record<SupportedCreationTarget, CreationField[]> = {
  offering_listing: [
    {
      key: 'subject',
      labelId: 'Nama produk / jasa',
      labelEn: 'Product / service name',
      aliases: [
        'nama produk',
        'nama jasa',
        'produk',
        'jasa',
        'produk jasa',
        'yang ditawarkan',
        'nama penawaran',
      ],
    },
    {
      key: 'category',
      labelId: 'Kategori',
      labelEn: 'Category',
      aliases: ['kategori', 'jenis', 'jenis produk', 'jenis jasa'],
    },
    {
      key: 'details',
      labelId: 'Keunggulan / kondisi',
      labelEn: 'Highlights / condition',
      aliases: [
        'keunggulan',
        'kondisi',
        'detail',
        'deskripsi',
        'spesifikasi',
        'kelebihan',
      ],
    },
    {
      key: 'price',
      labelId: 'Harga',
      labelEn: 'Price',
      aliases: ['harga', 'harga jual', 'tarif', 'biaya'],
    },
    {
      key: 'location',
      labelId: 'Lokasi / area layanan',
      labelEn: 'Location / service area',
      aliases: ['lokasi', 'alamat', 'area', 'area layanan', 'wilayah'],
    },
    {
      key: 'terms',
      labelId: 'Minimum pembelian / cakupan',
      labelEn: 'Minimum order / scope',
      aliases: [
        'minimum pembelian',
        'minimal pembelian',
        'minimum order',
        'moq',
        'cakupan',
        'syarat',
      ],
    },
  ],
  looking_for_listing: [
    {
      key: 'subject',
      labelId: 'Barang / jasa yang dibutuhkan',
      labelEn: 'Product / service needed',
      aliases: [
        'barang yang dibutuhkan',
        'jasa yang dibutuhkan',
        'kebutuhan',
        'produk',
        'barang',
        'jasa',
        'yang dicari',
      ],
    },
    {
      key: 'quantity',
      labelId: 'Jumlah',
      labelEn: 'Quantity',
      aliases: ['jumlah', 'kuantitas', 'qty', 'volume'],
    },
    {
      key: 'details',
      labelId: 'Spesifikasi / kriteria',
      labelEn: 'Specifications / criteria',
      aliases: ['spesifikasi', 'kriteria', 'detail', 'deskripsi', 'kondisi'],
    },
    {
      key: 'price',
      labelId: 'Budget',
      labelEn: 'Budget',
      aliases: ['budget', 'anggaran', 'harga', 'dana'],
    },
    {
      key: 'location',
      labelId: 'Lokasi tujuan',
      labelEn: 'Destination location',
      aliases: ['lokasi', 'alamat', 'area', 'tujuan', 'lokasi tujuan'],
    },
    {
      key: 'timeline',
      labelId: 'Kapan dibutuhkan',
      labelEn: 'When it is needed',
      aliases: ['kapan', 'waktu', 'deadline', 'tanggal', 'dibutuhkan'],
    },
  ],
  business_profile: [
    {
      key: 'business_name',
      labelId: 'Nama usaha',
      labelEn: 'Business name',
      aliases: ['nama usaha', 'nama bisnis', 'usaha', 'bisnis'],
    },
    {
      key: 'category',
      labelId: 'Jenis usaha',
      labelEn: 'Business type',
      aliases: ['jenis usaha', 'kategori', 'bidang usaha', 'industri'],
    },
    {
      key: 'main_offer',
      labelId: 'Produk / jasa utama',
      labelEn: 'Main product / service',
      aliases: [
        'produk utama',
        'jasa utama',
        'produk jasa utama',
        'produk',
        'jasa',
        'menjual',
      ],
    },
    {
      key: 'details',
      labelId: 'Keunggulan usaha',
      labelEn: 'Business highlights',
      aliases: ['keunggulan', 'kelebihan', 'deskripsi', 'tentang usaha'],
    },
    {
      key: 'location',
      labelId: 'Alamat / area usaha',
      labelEn: 'Business address / area',
      aliases: ['lokasi', 'alamat', 'area', 'alamat usaha'],
    },
    {
      key: 'contact',
      labelId: 'Kontak pilihan',
      labelEn: 'Preferred contact',
      aliases: ['kontak', 'whatsapp', 'wa', 'chat', 'kontak pilihan'],
    },
  ],
};

const EMPTY_VALUE_RE = /^(?:-|belum(?:\s+tahu)?|tidak\s+tahu|n\/a|none|skip)$/i;
const CANCEL_RE =
  /^(?:batal|batalkan|gak jadi|ga jadi|nggak jadi|tidak jadi|cancel|stop)(?:\s+.*)?$/i;

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value
        .replace(/\u0000/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, maxLength)
    : '';
}

function cleanMultilineText(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value
        .replace(/\u0000/g, '')
        .replace(/\r\n/g, '\n')
        .replace(/[ \t]+/g, ' ')
        .trim()
        .slice(0, maxLength)
    : '';
}

function normalizeLabel(value: string) {
  return value
    .toLocaleLowerCase('id-ID')
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function meaningfulValue(value: unknown) {
  const clean = cleanText(value, 500);
  return clean && !EMPTY_VALUE_RE.test(clean) ? clean : '';
}

function fieldByLabel(target: SupportedCreationTarget, label: string) {
  const normalized = normalizeLabel(label);
  return TARGET_FIELDS[target].find(field =>
    field.aliases.some(alias => normalizeLabel(alias) === normalized),
  );
}

function parseLabeledValues(target: SupportedCreationTarget, message: string) {
  const result: Record<string, string> = {};
  for (const rawLine of message.replace(/\r\n/g, '\n').split('\n')) {
    const match = /^\s*(?:[-*•]\s*)?([^:\n]{2,64})\s*:\s*(.*?)\s*$/.exec(
      rawLine,
    );
    if (!match) continue;
    const field = fieldByLabel(target, match[1] || '');
    const value = meaningfulValue(match[2]);
    if (field && value) result[field.key] = value;
  }
  return result;
}

function isGenericCreationIntent(message: string) {
  const normalized = normalizeLabel(message);
  if (!normalized || message.includes(':')) return false;
  return (
    normalized.length < 190 &&
    /\b(?:ingin|mau|tolong|bantu|buat|bikin|membuat|create|want)\b/.test(
      normalized,
    ) &&
    /\b(?:penawaran|kebutuhan|postingan|profil usaha|usaha|offer|request|business profile)\b/.test(
      normalized,
    )
  );
}

function uniqueMedia(media: CreationFlowMedia[]) {
  const seen = new Set<string>();
  const result: CreationFlowMedia[] = [];
  for (const item of media) {
    const url = cleanText(item.url, 700);
    const name = cleanText(item.name, 140);
    const key = url || `${item.kind || 'file'}:${name}`;
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push({
      kind: item.kind,
      name: name || undefined,
      mime: cleanText(item.mime, 120) || undefined,
      size: Math.max(0, Math.min(5_000_000, Number(item.size || 0) || 0)),
      url: url || undefined,
    });
    if (result.length >= 10) break;
  }
  return result;
}

function requiredFields(
  target: SupportedCreationTarget,
  collected: Record<string, string>,
  hasMedia: boolean,
) {
  if (target === 'business_profile') {
    return [
      ...(!meaningfulValue(collected.business_name) ? ['business_name'] : []),
      ...(!meaningfulValue(collected.main_offer) ? ['main_offer'] : []),
    ];
  }
  if (target === 'looking_for_listing') {
    return [
      ...(!meaningfulValue(collected.subject) ? ['subject'] : []),
      ...(!meaningfulValue(collected.details) &&
      !meaningfulValue(collected.quantity) &&
      !hasMedia
        ? ['details']
        : []),
    ];
  }
  return [
    ...(!meaningfulValue(collected.subject) ? ['subject'] : []),
    ...(!meaningfulValue(collected.details) && !hasMedia ? ['details'] : []),
  ];
}

function labelFor(
  target: SupportedCreationTarget,
  key: string,
  locale: 'id' | 'en',
) {
  const field = TARGET_FIELDS[target].find(item => item.key === key);
  return field ? (locale === 'id' ? field.labelId : field.labelEn) : key;
}

function draftInstruction(
  target: SupportedCreationTarget,
  collected: Record<string, string>,
  locale: 'id' | 'en',
  hasMedia: boolean,
) {
  const heading =
    target === 'offering_listing'
      ? locale === 'id'
        ? 'Data penawaran dari user'
        : 'User offer details'
      : target === 'looking_for_listing'
        ? locale === 'id'
          ? 'Data kebutuhan dari user'
          : 'User request details'
        : locale === 'id'
          ? 'Data profil usaha dari user'
          : 'User business profile details';
  const lines = TARGET_FIELDS[target]
    .map(field => {
      const value = meaningfulValue(collected[field.key]);
      return value
        ? `${locale === 'id' ? field.labelId : field.labelEn}: ${value}`
        : '';
    })
    .filter(Boolean);
  if (hasMedia) {
    lines.push(
      locale === 'id'
        ? 'Media pendukung: sudah dikirim oleh user'
        : 'Supporting media: provided by the user',
    );
  }
  return [heading, ...lines].join('\n').slice(0, 3500);
}

export function readCreationFlowMetadata(
  value: unknown,
): CreationFlowMetadata | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  if (!isSupportedCreationTarget(raw.target)) return null;
  const status =
    raw.status === 'ready' || raw.status === 'cancelled'
      ? raw.status
      : 'collecting';
  const collected =
    raw.collected &&
    typeof raw.collected === 'object' &&
    !Array.isArray(raw.collected)
      ? Object.fromEntries(
          Object.entries(raw.collected as Record<string, unknown>)
            .map(([key, item]) => [key, meaningfulValue(item)] as const)
            .filter(([, item]) => Boolean(item)),
        )
      : {};
  const media = Array.isArray(raw.media)
    ? uniqueMedia(
        raw.media.filter((item): item is CreationFlowMedia =>
          Boolean(item && typeof item === 'object' && !Array.isArray(item)),
        ),
      )
    : [];
  const missingFields = Array.isArray(raw.missingFields)
    ? raw.missingFields
        .map(item => cleanText(item, 80))
        .filter(Boolean)
        .slice(0, 12)
    : [];
  return {
    version: 1,
    target: raw.target,
    status,
    collected,
    collectedFields: Object.keys(collected),
    missingFields,
    completeness: Math.max(
      0,
      Math.min(100, Number(raw.completeness || 0) || 0),
    ),
    submitted: raw.submitted === true,
    draftInstruction: cleanText(raw.draftInstruction, 3500) || undefined,
    media,
  };
}

export function evaluateCreationFlow(input: {
  target: SupportedCreationTarget;
  message: string;
  locale: 'id' | 'en';
  previous?: CreationFlowMetadata | null;
  media?: CreationFlowMedia[];
}): CreationFlowMetadata {
  const message = cleanMultilineText(input.message, 3500);
  const previous =
    input.previous?.target === input.target ? input.previous : null;
  const media = uniqueMedia([
    ...(previous?.media || []),
    ...(input.media || []),
  ]);
  const collected = { ...(previous?.collected || {}) };
  const parsed = parseLabeledValues(input.target, message);
  Object.assign(collected, parsed);

  const generic = isGenericCreationIntent(message);
  const previousMissing = requiredFields(
    input.target,
    collected,
    media.length > 0,
  );
  if (
    Object.keys(parsed).length === 0 &&
    !generic &&
    message.length >= 12 &&
    previousMissing.length === 1
  ) {
    collected[previousMissing[0]!] = message;
  }

  const submitted =
    Boolean(previous?.submitted) ||
    Object.keys(parsed).length > 0 ||
    (!generic && message.length >= 24);
  const missingFields = requiredFields(
    input.target,
    collected,
    media.length > 0,
  );
  const fields = TARGET_FIELDS[input.target];
  const filledCount = fields.filter(field =>
    meaningfulValue(collected[field.key]),
  ).length;
  const completeness = Math.max(
    0,
    Math.min(100, Math.round((filledCount / fields.length) * 100)),
  );
  const cancelled = CANCEL_RE.test(message);
  const status: CreationFlowStatus = cancelled
    ? 'cancelled'
    : submitted && missingFields.length === 0
      ? 'ready'
      : 'collecting';

  return {
    version: 1,
    target: input.target,
    status,
    collected,
    collectedFields: Object.keys(collected),
    missingFields,
    completeness,
    submitted,
    draftInstruction:
      status === 'ready'
        ? draftInstruction(
            input.target,
            collected,
            input.locale,
            media.length > 0,
          )
        : undefined,
    media,
  };
}

export function buildCreationIntakeMessage(
  flow: CreationFlowMetadata,
  locale: 'id' | 'en',
) {
  if (flow.status === 'cancelled') {
    return locale === 'id'
      ? 'Pembuatan draft dibatalkan. Kita bisa lanjut membahas hal lain.'
      : 'Draft creation was cancelled. We can continue with something else.';
  }

  const fields = TARGET_FIELDS[flow.target];
  const isFirstPrompt = flow.collectedFields.length === 0;
  const requestedFields = isFirstPrompt
    ? fields
    : fields.filter(field => flow.missingFields.includes(field.key));
  const title =
    flow.target === 'offering_listing'
      ? locale === 'id'
        ? 'Lengkapi penawaran'
        : 'Complete the offer'
      : flow.target === 'looking_for_listing'
        ? locale === 'id'
          ? 'Lengkapi kebutuhan'
          : 'Complete the request'
        : locale === 'id'
          ? 'Lengkapi profil usaha'
          : 'Complete the business profile';
  const caught = flow.collectedFields
    .map(key => labelFor(flow.target, key, locale))
    .slice(0, 5);

  return [
    `**${isFirstPrompt ? title : locale === 'id' ? 'Sedikit lagi' : 'Almost there'}**`,
    isFirstPrompt
      ? locale === 'id'
        ? 'Balas pesan ini dengan mengisi label berikut. Yang belum tahu boleh dikosongkan.'
        : 'Reply by filling in these labels. You may leave unknown items blank.'
      : caught.length > 0
        ? `${locale === 'id' ? 'Sudah tertangkap' : 'Captured'}: ${caught.join(', ')}.`
        : '',
    '',
    ...requestedFields.map(
      field => `${locale === 'id' ? field.labelId : field.labelEn}:`,
    ),
  ]
    .filter((line, index, all) => line || (index > 0 && all[index - 1]))
    .join('\n')
    .trim();
}

export function buildCreationReadyInstruction(
  flow: CreationFlowMetadata,
  locale: 'id' | 'en',
) {
  const facts = flow.draftInstruction || '';
  return locale === 'id'
    ? [
        'User sedang menyelesaikan flow pembuatan konten Lajukan.',
        'Ringkas fakta yang sudah user berikan dalam 3-6 bullet pendek.',
        'Jangan menanyakan ulang data yang sudah ada dan jangan mengarang fakta.',
        'Katakan bahwa draft sedang disiapkan dan masih dapat diperbaiki sebelum diterbitkan.',
        facts,
      ].join('\n')
    : [
        'The user is completing a Lajukan creation flow.',
        'Summarize the facts they provided in 3-6 short bullets.',
        'Do not ask for information already supplied and do not invent facts.',
        'Say that the draft is being prepared and can still be edited before publishing.',
        facts,
      ].join('\n');
}
