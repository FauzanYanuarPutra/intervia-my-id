'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useDialog } from '@/components/system/feedback/DialogProvider';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { useAuth } from '@/context/AuthContext';
import { useChatInbox } from '@/context/ChatInboxContext';
import { motion } from 'framer-motion';
import {
  AlertCircle,
  ArrowLeft,
  BadgeCheck,
  Camera,
  Check,
  CheckCheck,
  CheckCircle2,
  Clock,
  Loader2,
  MoreVertical,
  Paperclip,
  Phone,
  ReceiptText,
  Send,
  ShieldAlert,
  Smile,
  Sparkles,
  Sticker,
  Video,
  Wallet,
  X,
  MessageSquareText,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { joinRoom, onMessage, sendMessageViaSocket } from '@/lib/chat';
import { createIdempotencyKey } from '@/lib/clientIdempotency';
import { buildAiChatPayload } from '@/lib/aiChat';
import {
  buildAiRoomCardPayload,
  buildAiRoomCreatePayload,
  buildAiRoomDraftInstruction,
  buildDefaultAiRoomDraftPrompt,
  extractAiRoomDraftFromResponse,
  type AiRoomDraftResult,
  type AiRoomDraftWorkspace,
} from '@/lib/chatAiDrafts';
import {
  getLatestDeliverySubmission,
  parseTransactionDelivery,
} from '@/lib/transactionDelivery';
import {
  inferPricingModeFromPayload,
  parseRichCardPayload,
  type StructuredChatPayload,
} from '@/lib/commerce/orderFlow';
import {
  getListingSideContextLabel,
  getListingSideLabel,
  resolveListingSide,
  toMarketSideValue,
  type ListingSide,
} from '@/lib/content/listingSide';
import { validateListingPayload } from '@/lib/content/listingFlowRules';
import { buildContentHref } from '@/lib/content/routes';
import { buildCreatePath } from '@/lib/createRoutes';
import { soundManager } from '@/lib/soundManager';
import { CameraCaptureModal } from '@/components/chat/CameraCaptureModal';
import { VideoCall } from '@/components/chat/VideoCall';
import { VoiceCall } from '@/components/chat/VoiceCall';
import { IncomingCall } from '@/components/chat/IncomingCall';
import { ChatDetailSkeleton } from '@/components/system/feedback/RouteSkeletons';

type PublicProfile = {
  id: string;
  username?: string | null;
  full_name?: string | null;
};

type MessageStatus = 'sending' | 'sent' | 'read' | 'failed';

type Message = {
  id: string;
  content: string;
  sender_id: string;
  message_type?: string;
  attachments?: string[];
  created_at: string;
  status?: MessageStatus;
};

type AttachmentKind = 'image' | 'video' | 'audio' | 'file';

type DraftAttachment = {
  id: string;
  file?: File;
  name: string;
  size: number;
  type: AttachmentKind;
  previewUrl?: string;
  serverUrl?: string;
  status: 'uploading' | 'uploaded' | 'error';
};

const MAX_COMPOSER_ATTACHMENTS = 10;

const QUICK_EMOJIS = [
  '\u{1F600}',
  '\u{1F602}',
  '\u{1F60D}',
  '\u{1F44D}',
  '\u{1F64F}',
  '\u{1F525}',
  '\u{2764}\u{FE0F}',
  '\u{1F389}',
  '\u{1F60E}',
  '\u{1F91D}',
  '\u{1F44F}',
  '\u{2705}',
] as const;

const STICKER_PACK = [
  {
    id: 'celebrate',
    label: 'Celebration',
    url: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/emoji_u1f389.png',
  },
  {
    id: 'party',
    label: 'Party Parrot',
    url: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/emoji_u1f973.png',
  },
  {
    id: 'sparkles',
    label: 'Sparkles',
    url: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/emoji_u2728.png',
  },
  {
    id: 'thumbs',
    label: 'Thumbs Up',
    url: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/emoji_u1f44d.png',
  },
  {
    id: 'heart',
    label: 'Heart',
    url: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/emoji_u2764.png',
  },
  {
    id: 'fire',
    label: 'Fire',
    url: 'https://raw.githubusercontent.com/googlefonts/noto-emoji/main/png/128/emoji_u1f525.png',
  },
] as const;

const AI_TEMPLATES = [
  {
    id: 'quick-reply',
    label: 'Balas cepat',
    prompt:
      'Balas singkat, jelas, dan ramah. Jika perlu, tanyakan 1 detail penting.',
  },
  {
    id: 'negotiate',
    label: 'Negosiasi',
    prompt:
      'Buat penawaran balik yang sopan, sebutkan kisaran, dan ajak diskusi.',
  },
  {
    id: 'follow-up',
    label: 'Follow up',
    prompt: 'Tindak lanjuti status terakhir secara profesional, tetap singkat.',
  },
  {
    id: 'clarify',
    label: 'Minta detail',
    prompt: 'Tanyakan 2-3 detail agar pekerjaan/penawaran jelas.',
  },
  {
    id: 'decline',
    label: 'Tolak sopan',
    prompt:
      'Tolak dengan sopan, beri alasan singkat, tetap buka peluang di lain waktu.',
  },
] as const;

const AI_TONES = [
  { id: 'ramah', label: 'Ramah' },
  { id: 'profesional', label: 'Profesional' },
  { id: 'santai', label: 'Santai' },
] as const;

const AI_LENGTHS = [
  { id: 'singkat', label: 'Singkat' },
  { id: 'sedang', label: 'Sedang' },
] as const;

const AI_PROMPT_EXAMPLES = [
  {
    id: 'budget',
    label: 'Tanya budget & deadline',
    prompt: 'Tolong tanyakan budget dan deadline secara sopan.',
  },
  {
    id: 'scope',
    label: 'Perjelas scope',
    prompt: 'Tanyakan scope, deliverables, dan ekspektasi revisi.',
  },
  {
    id: 'closing',
    label: 'Ajak closing',
    prompt: 'Ringkas poin penting lalu ajak konfirmasi untuk lanjut.',
  },
] as const;

const AI_WORKSPACES = [
  { id: 'reply', labelId: 'Balas chat', labelEn: 'Reply' },
  { id: 'listing', labelId: 'Buat listing', labelEn: 'Listing' },
  { id: 'company', labelId: 'Profil usaha', labelEn: 'Business profile' },
] as const;

const AI_STRUCTURED_PROMPT_EXAMPLES: Record<
  AiRoomDraftWorkspace,
  Array<{
    id: string;
    labelId: string;
    labelEn: string;
    promptId: string;
    promptEn: string;
  }>
> = {
  listing: [
    {
      id: 'supplier',
      labelId: 'Listing supplier',
      labelEn: 'Supplier listing',
      promptId:
        'Buat listing supplier bahan baku lokal yang jelas, ringkas, dan cepat dipercaya buyer.',
      promptEn:
        'Create a local raw-material supplier listing that is clear, concise, and easy for buyers to trust.',
    },
    {
      id: 'service',
      labelId: 'Listing jasa',
      labelEn: 'Service listing',
      promptId:
        'Buat listing jasa operasional usaha dengan scope kerja, hasil, dan ekspektasi timeline yang jelas.',
      promptEn:
        'Create an operational service listing with a clear scope, deliverables, and realistic timeline expectations.',
    },
    {
      id: 'job',
      labelId: 'Lowongan cepat',
      labelEn: 'Quick job post',
      promptId:
        'Buat draft lowongan yang singkat tapi tetap jelas soal peran, requirement, dan lokasi kerja.',
      promptEn:
        'Create a short but clear job draft covering the role, requirements, and work location.',
    },
  ],
  company: [
    {
      id: 'storefront',
      labelId: 'Profil brand',
      labelEn: 'Brand profile',
      promptId:
        'Buat profil usaha yang bikin supplier, partner, dan calon buyer cepat paham posisi brand ini.',
      promptEn:
        'Create a business profile that helps suppliers, partners, and buyers quickly understand the brand position.',
    },
    {
      id: 'maker',
      labelId: 'Usaha produksi',
      labelEn: 'Production business',
      promptId:
        'Buat profil usaha produksi lokal dengan fokus kapasitas, kualitas, dan reliability kerja.',
      promptEn:
        'Create a local production-business profile focused on capacity, quality, and operational reliability.',
    },
    {
      id: 'agency',
      labelId: 'Profil agency',
      labelEn: 'Agency profile',
      promptId:
        'Buat profil usaha jasa kreatif yang menonjolkan layanan utama, cara kerja, dan nilai bisnis.',
      promptEn:
        'Create a creative-service business profile that highlights the core services, working style, and business value.',
    },
  ],
};

type AiTemplateId = (typeof AI_TEMPLATES)[number]['id'];
type AiToneId = (typeof AI_TONES)[number]['id'];
type AiLengthId = (typeof AI_LENGTHS)[number]['id'];

const isAiTemplateId = (value: string): value is AiTemplateId =>
  AI_TEMPLATES.some(item => item.id === value);
const isAiToneId = (value: string): value is AiToneId =>
  AI_TONES.some(item => item.id === value);
const isAiLengthId = (value: string): value is AiLengthId =>
  AI_LENGTHS.some(item => item.id === value);

function normId(id: string | undefined | null): string {
  if (id == null) return '';
  return String(id).trim().toLowerCase();
}

function normalizeRoomId(raw: unknown): string {
  const v = String(raw ?? '').trim();
  if (!v) return '';
  try {
    return decodeURIComponent(v);
  } catch {
    return v;
  }
}

function parseDraftContact(roomId: string): string | null {
  if (!roomId.startsWith('draft:')) return null;
  const raw = roomId.slice('draft:'.length).trim();
  if (!raw) return null;
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
}

function parseDmPeerId(
  roomIdRaw: string,
  currentUserId?: string | null,
): string | null {
  const roomId = String(roomIdRaw || '').trim();
  if (!roomId.startsWith('dm:')) return null;
  const parts = roomId.split(':');
  if (parts.length < 3) return null;
  const first = parts[1] || '';
  const second = parts[2] || '';
  if (!first || !second) return null;
  const current = String(currentUserId || '').toLowerCase();
  if (current && first.toLowerCase() === current) return second;
  if (current && second.toLowerCase() === current) return first;
  return first;
}

function detectAttachmentType(file: File): AttachmentKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  return 'file';
}

function formatFileSize(bytes: number): string {
  if (!Number.isFinite(bytes)) return '';
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const idx = Math.min(
    Math.floor(Math.log(bytes) / Math.log(1024)),
    units.length - 1,
  );
  return `${(bytes / 1024 ** idx).toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function formatMessageTime(iso: string): string {
  if (!iso) return '';
  try {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return '';
    const now = new Date();
    const sameDay =
      d.getDate() === now.getDate() &&
      d.getMonth() === now.getMonth() &&
      d.getFullYear() === now.getFullYear();
    if (sameDay)
      return d.toLocaleTimeString(undefined, {
        hour: '2-digit',
        minute: '2-digit',
      });
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    if (
      d.getDate() === yesterday.getDate() &&
      d.getMonth() === yesterday.getMonth()
    ) {
      return `Yesterday ${d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}`;
    }
    return d.toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return '';
  }
}

function formatDayLabel(iso: string): string {
  if (!iso) return '';
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) return '';
  const today = new Date();
  const normalize = (value: Date) =>
    new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime();
  const diffDays = Math.round(
    (normalize(today) - normalize(target)) / 86_400_000,
  );
  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Yesterday';
  return target.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function normalizeAttachmentUrl(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';
  if (
    value.startsWith('/api/chat/media/') ||
    value.startsWith('/api/content/media/') ||
    value.startsWith('/uploads/')
  ) {
    return value;
  }
  if (!/^https?:\/\//i.test(value)) return value;

  try {
    const parsed = new URL(value);
    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .map(part => decodeURIComponent(part));
    if (segments.length < 2) return value;
    const bucket = encodeURIComponent(segments[0]);
    const keyParts = segments.slice(1);
    const encodedKey = keyParts.map(part => encodeURIComponent(part)).join('/');
    const firstKey = keyParts[0]?.toLowerCase();
    if (firstKey === 'content' || firstKey === 'forum') {
      return `/api/content/media/${bucket}/${encodedKey}`;
    }
    if (firstKey === 'chat') {
      return `/api/chat/media/${bucket}/${encodedKey}`;
    }
    return value;
  } catch {
    return value;
  }
}

type TimelineItem =
  | { type: 'day'; id: string; label: string }
  | { type: 'message'; message: Message };

type OfferFlowMode = 'direct' | 'offer';
type ListingActionDraft = {
  contentId: string;
  title: string;
  listingSide: ListingSide;
  amountCents: number;
  suggestedOfferCents: number;
  currency: string;
  contentUrl?: string;
  dealKind:
    | 'job'
    | 'service'
    | 'product'
    | 'property'
    | 'tool_rental'
    | 'profile'
    | 'other';
  fulfillmentMode:
    | 'standard'
    | 'shipping'
    | 'pickup'
    | 'remote'
    | 'onsite'
    | 'instant';
  pricingMode: 'fixed' | 'request';
};

type RoomTransaction = {
  id: string;
  content_id?: string;
  buyer_id?: string;
  seller_id?: string;
  amount_cents?: number;
  currency?: string;
  status?: string;
  transaction_status?: string;
  protection_status?: string;
  deal_kind?: string | null;
  fulfillment_mode?: string | null;
  transaction_meta?: Record<string, unknown> | null;
  snapshot_listing?: Record<string, unknown> | null;
  safety_checklist?: Record<string, unknown> | null;
  risk_flags?: unknown[] | null;
  offer_message?: string | null;
  response_message?: string | null;
  created_at?: string;
  updated_at?: string;
  timeline?: Array<{
    event?: string;
    status?: string;
    actor?: string | null;
    at?: string | null;
    description?: string;
  }>;
};

type FraudSignal = {
  severity: 'high' | 'medium';
  message: string;
};

type DiscoverUser = {
  id: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  username?: string | null;
};

type InvitePayload = {
  room_id?: string;
  room_name?: string;
  inviter_id?: string;
  inviter_name?: string;
  member_count?: number;
  invite_token?: string;
};

function parseStructuredAttachment(raw?: string): StructuredChatPayload | null {
  return parseRichCardPayload(raw);
}

function buildInteractionReference(prefix: string, primaryId: string): string {
  const compactId = String(primaryId || '')
    .replace(/[^a-z0-9]/gi, '')
    .slice(0, 6)
    .toUpperCase();
  const timePart = Date.now().toString().slice(-6);
  return `${prefix}-${compactId || 'CHAT'}-${timePart}`;
}

function getListingActionDefaults(
  draft: Pick<
    ListingActionDraft,
    | 'listingSide'
    | 'pricingMode'
    | 'amountCents'
    | 'suggestedOfferCents'
    | 'dealKind'
    | 'fulfillmentMode'
  >,
  mode: OfferFlowMode,
  locale: 'id' | 'en',
): { amount: string; message: string } {
  const baseAmountCents =
    mode === 'direct' ? draft.amountCents : draft.suggestedOfferCents;
  const isRental = draft.dealKind === 'tool_rental';
  const isProperty = draft.dealKind === 'property';
  const isService =
    draft.dealKind === 'service' || draft.dealKind === 'profile';
  const isJob = draft.dealKind === 'job';
  const isProduct = draft.dealKind === 'product';
  return {
    amount:
      baseAmountCents > 0 ? String(Math.floor(baseAmountCents / 100)) : '',
    message:
      mode === 'direct'
        ? isRental
          ? locale === 'id'
            ? 'Halo kak, saya mau lanjut sewa. Mohon info jadwal ready, deposit, dan cara ambilnya.'
            : 'Hi, I want to proceed with the rental. Please share the schedule, deposit, and pickup details.'
          : isProperty
            ? locale === 'id'
              ? 'Halo kak, saya mau lanjut untuk lokasi ini. Mohon info survey dan syarat deal utamanya.'
              : 'Hi, I want to proceed with this location. Please share the viewing and key deal terms.'
            : isService
              ? locale === 'id'
                ? 'Halo kak, saya mau lanjut deal jasa ini. Tolong kirim langkah mulai, timeline, dan catatan kerjanya.'
                : 'Hi, I want to proceed with this service. Please share the start steps, timeline, and work notes.'
              : isProduct
                ? locale === 'id'
                  ? 'Halo kak, saya mau lanjut order sesuai harga listing. Mohon konfirmasi stok, ongkir, dan langkah bayarnya.'
                  : 'Hi, I want to proceed at the listed price. Please confirm stock, delivery, and payment steps.'
                : locale === 'id'
                  ? 'Saya lanjut sesuai detail listing. Mohon kirim langkah berikutnya.'
                  : 'I want to proceed based on the listing details. Please share the next steps.'
        : draft.listingSide === 'demand'
          ? isJob
            ? locale === 'id'
              ? 'Halo kak, saya tertarik apply. Saya kirim profil singkat, pengalaman, dan kesiapan saya di sini.'
              : 'Hi, I want to apply. I am sharing my short profile, experience, and availability here.'
            : isProperty
              ? locale === 'id'
                ? 'Halo kak, saya punya lokasi yang mungkin cocok. Saya kirim harga, detail, dan catatan utamanya di sini.'
                : 'Hi, I may have a suitable location. I am sending the price, details, and key notes here.'
              : isRental
                ? locale === 'id'
                  ? 'Halo kak, saya bisa bantu alat yang dibutuhkan. Saya kirim durasi, biaya, dan catatan utamanya di sini.'
                  : 'Hi, I can support the equipment needed. I am sending duration, pricing, and key notes here.'
                : locale === 'id'
                  ? 'Halo kak, saya bisa bantu kebutuhan ini. Saya kirim nominal, scope, dan catatan singkat supaya cepat dicek.'
                  : 'Hi, I can help with this need. I am sending the amount, scope, and a short note for quick review.'
          : draft.pricingMode === 'request'
            ? isRental
              ? locale === 'id'
                ? 'Halo kak, saya tertarik sewa ini. Boleh info jadwal ready, deposit, dan harga akhirnya?'
                : 'Hi, I am interested in this rental. Could you share the ready schedule, deposit, and final price?'
              : isProperty
                ? locale === 'id'
                  ? 'Halo kak, saya tertarik lokasi ini. Boleh info harga deal, survey, dan syarat utamanya?'
                  : 'Hi, I am interested in this location. Could you share the deal price, viewing plan, and key terms?'
                : isService
                  ? locale === 'id'
                    ? 'Halo kak, saya tertarik jasa ini. Boleh info scope final, timeline, dan harga kerjanya?'
                    : 'Hi, I am interested in this service. Could you share the final scope, timeline, and price?'
                  : isProduct
                    ? locale === 'id'
                      ? 'Halo kak, saya tertarik produk ini. Boleh info stok ready, harga, dan ongkirnya?'
                      : 'Hi, I am interested in this product. Could you share stock, price, and delivery cost?'
                    : locale === 'id'
                      ? 'Halo kak, saya tertarik. Boleh kirim detail harga dan ketentuan utamanya?'
                      : 'I am interested. Could you share the price details and key terms?'
            : isRental
              ? locale === 'id'
                ? 'Halo kak, saya tertarik sewa ini. Saya kirim request durasi, jadwal, dan penawaran awal saya.'
                : 'Hi, I am interested in this rental. I am sending the duration, schedule, and my initial offer.'
              : isProperty
                ? locale === 'id'
                  ? 'Halo kak, saya tertarik lokasi ini. Saya kirim penawaran awal dan catatan singkat saya.'
                  : 'Hi, I am interested in this location. I am sending my initial offer and a short note.'
                : locale === 'id'
                  ? 'Halo kak, saya tertarik. Saya kirim penawaran awal supaya cepat dibahas.'
                  : 'Hi, I am interested. Here is my initial offer so we can discuss it quickly.',
  };
}

function parseInvitePayload(message: Message): InvitePayload | null {
  if (message.message_type !== 'invite') return null;
  const raw = message.attachments?.[0] || message.content;
  if (!raw || typeof raw !== 'string') return null;
  try {
    const parsed = JSON.parse(raw) as InvitePayload;
    if (!parsed || typeof parsed !== 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}

function formatValidationIssues(issues: string[], locale: 'id' | 'en'): string {
  const visible = issues
    .map(issue => issue.trim())
    .filter(Boolean)
    .slice(0, 4);
  if (visible.length === 0) {
    return locale === 'id'
      ? 'Draft perlu dicek lagi sebelum publish.'
      : 'The draft needs another review before publishing.';
  }
  return visible.join(' | ');
}

function formatMoney(cents: unknown, currency: unknown): string {
  const amountCents = Number(cents ?? 0);
  const curr =
    typeof currency === 'string' && currency.trim()
      ? currency.toUpperCase()
      : 'IDR';
  if (!Number.isFinite(amountCents) || amountCents <= 0) return '-';
  const amount = amountCents / 100;
  try {
    return new Intl.NumberFormat(undefined, {
      style: 'currency',
      currency: curr,
      maximumFractionDigits: curr === 'IDR' ? 0 : 2,
    }).format(amount);
  } catch {
    return `${curr} ${amount.toLocaleString()}`;
  }
}

function humanizeStatus(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return 'Updated';
  return raw
    .split('_')
    .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
    .join(' ');
}

function normalizeTransactionStatus(raw: unknown): string {
  const value = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  return value || 'pending';
}

function asObject(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function formatShortTransactionId(value: unknown): string {
  const raw = typeof value === 'string' ? value.trim() : '';
  if (!raw) return '-';
  if (raw.length <= 16) return raw;
  return `${raw.slice(0, 8)}...${raw.slice(-4)}`;
}

function resolveTransactionWalletLabel(
  txn: RoomTransaction | null,
  locale: 'id' | 'en',
): string {
  const meta = asObject(txn?.transaction_meta);
  const flow = asObject(meta.flow);
  const environment =
    typeof flow.wallet_environment === 'string'
      ? flow.wallet_environment.trim().toLowerCase()
      : '';
  if (environment === 'live') {
    return locale === 'id' ? 'Saldo live' : 'Live wallet';
  }
  return locale === 'id' ? 'Saldo dev' : 'Dev wallet';
}

function resolveTransactionPaymentStatus(txn: RoomTransaction | null): string {
  if (!txn) return 'awaiting_payment';
  const meta = asObject(txn.transaction_meta);
  const payment = asObject(meta.payment);
  const value =
    typeof payment.status === 'string'
      ? payment.status.trim().toLowerCase()
      : '';
  if (value) return value;
  const protection = String(txn.protection_status || '')
    .trim()
    .toLowerCase();
  if (
    protection === 'funds_held' ||
    protection === 'on_hold' ||
    protection === 'escrow_released'
  ) {
    return 'paid';
  }
  return 'awaiting_payment';
}

function transactionPaymentReady(txn: RoomTransaction | null): boolean {
  if (!txn) return false;
  const protection = String(txn.protection_status || '')
    .trim()
    .toLowerCase();
  const paymentStatus = resolveTransactionPaymentStatus(txn);
  return (
    paymentStatus === 'paid' ||
    protection === 'funds_held' ||
    protection === 'on_hold'
  );
}

function canUserOpenTransactionPayment(
  txn: RoomTransaction | null,
  currentUserId?: string | null,
): boolean {
  if (!txn) return false;
  const status = normalizeTransactionStatus(
    txn.status || txn.transaction_status,
  );
  const isBuyer = Boolean(
    currentUserId && normId(txn.buyer_id) === normId(currentUserId),
  );
  return (
    isBuyer &&
    (status === 'pending' || status === 'accepted') &&
    !transactionPaymentReady(txn)
  );
}

type TransactionStepKey =
  | 'offer_created'
  | 'accepted'
  | 'payment_secured'
  | 'in_progress'
  | 'delivered'
  | 'completed';

type TransactionStep = {
  key: TransactionStepKey;
  label: string;
  done: boolean;
  active: boolean;
};

function getTransactionSteps(txn: RoomTransaction | null): TransactionStep[] {
  const status = normalizeTransactionStatus(
    txn?.status || txn?.transaction_status,
  );
  const paymentReady = transactionPaymentReady(txn);
  const acceptedDone =
    status === 'accepted' ||
    status === 'in_progress' ||
    status === 'delivered' ||
    status === 'completed';
  const inProgressDone =
    status === 'in_progress' ||
    status === 'delivered' ||
    status === 'completed';
  const deliveredDone = status === 'delivered' || status === 'completed';
  const completedDone = status === 'completed';

  return [
    {
      key: 'offer_created',
      label: 'Offer dibuat',
      done: Boolean(txn),
      active: !txn,
    },
    {
      key: 'accepted',
      label: 'Disetujui seller',
      done: acceptedDone,
      active: status === 'pending',
    },
    {
      key: 'payment_secured',
      label: 'Dana diamankan',
      done: paymentReady,
      active: acceptedDone && !paymentReady,
    },
    {
      key: 'in_progress',
      label: 'Pengerjaan dimulai',
      done: inProgressDone,
      active: paymentReady && status === 'accepted',
    },
    {
      key: 'delivered',
      label: 'Hasil dikirim',
      done: deliveredDone,
      active: status === 'in_progress',
    },
    {
      key: 'completed',
      label: 'Selesai',
      done: completedDone,
      active: status === 'delivered',
    },
  ];
}

function getTransactionProgressPercent(txn: RoomTransaction | null): number {
  const status = normalizeTransactionStatus(
    txn?.status || txn?.transaction_status,
  );
  if (status === 'completed') return 100;
  if (status === 'cancelled') return 100;
  const steps = getTransactionSteps(txn);
  if (steps.length === 0) return 0;
  const doneCount = steps.filter(step => step.done).length;
  return Math.max(
    0,
    Math.min(99, Math.round((doneCount / steps.length) * 100)),
  );
}

function getTransactionWaitingParty(
  txn: RoomTransaction | null,
  currentUserId?: string | null,
): string {
  if (!txn) return 'Menunggu data transaksi';
  const status = normalizeTransactionStatus(
    txn.status || txn.transaction_status,
  );
  if (status === 'completed') return 'Transaksi selesai';
  if (status === 'cancelled') return 'Transaksi dibatalkan';
  if (status === 'disputed') return 'Menunggu mediasi Support';

  const isBuyer = Boolean(
    currentUserId && normId(txn.buyer_id) === normId(currentUserId),
  );
  const isSeller = Boolean(
    currentUserId && normId(txn.seller_id) === normId(currentUserId),
  );
  const paymentReady = transactionPaymentReady(txn);

  if (status === 'pending') {
    if (isSeller) return 'Menunggu aksi Anda (Seller): terima / tolak';
    return 'Menunggu Seller menerima transaksi';
  }
  if (status === 'accepted' && !paymentReady) {
    if (isBuyer) return 'Menunggu pembayaran Anda (Buyer)';
    return 'Menunggu Buyer melakukan pembayaran';
  }
  if (status === 'accepted' && paymentReady) {
    if (isSeller) return 'Menunggu aksi Anda (Seller): mulai pengerjaan';
    return 'Menunggu Seller memulai pengerjaan';
  }
  if (status === 'in_progress') {
    if (isSeller) return 'Menunggu aksi Anda (Seller): kirim hasil';
    return 'Menunggu Seller mengirim hasil';
  }
  if (status === 'delivered') {
    if (isBuyer) return 'Menunggu aksi Anda (Buyer): konfirmasi selesai';
    return 'Menunggu Buyer konfirmasi selesai';
  }

  return 'Menunggu pembaruan transaksi';
}

function canRunTransactionAction(
  action: 'accept' | 'start' | 'deliver' | 'complete' | 'cancel' | 'dispute',
  txn: RoomTransaction,
  currentUserId?: string | null,
): boolean {
  const status = normalizeTransactionStatus(
    txn.status || txn.transaction_status,
  );
  const isBuyer = Boolean(
    currentUserId && normId(txn.buyer_id) === normId(currentUserId),
  );
  const isSeller = Boolean(
    currentUserId && normId(txn.seller_id) === normId(currentUserId),
  );
  const paymentReady = transactionPaymentReady(txn);

  if (action === 'accept') return isSeller && status === 'pending';
  if (action === 'start')
    return isSeller && status === 'accepted' && paymentReady;
  if (action === 'deliver') return isSeller && status === 'in_progress';
  if (action === 'complete') return isBuyer && status === 'delivered';
  if (action === 'cancel') {
    return (
      (status === 'pending' && !isSeller) ||
      status === 'accepted' ||
      status === 'in_progress'
    );
  }
  if (action === 'dispute') {
    return (
      status === 'accepted' ||
      status === 'in_progress' ||
      status === 'delivered'
    );
  }
  return false;
}

function statusTone(status: string): string {
  const normalized = normalizeTransactionStatus(status);
  if (normalized === 'completed')
    return 'text-[color:var(--app-accent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_15%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)]';
  if (normalized === 'delivered')
    return 'text-[color:var(--app-group-talent)] bg-[color:color-mix(in_srgb,_var(--app-group-talent)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-group-talent-border)_40%,_transparent)]';
  if (normalized === 'in_progress')
    return 'text-[color:var(--app-info)] bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-info-border)_40%,_transparent)]';
  if (normalized === 'accepted')
    return 'text-[color:var(--app-info)] bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-info-border)_40%,_transparent)]';
  if (normalized === 'disputed')
    return 'text-[color:var(--app-warning)] bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)]';
  if (normalized === 'cancelled')
    return 'text-[color:var(--app-danger)] bg-[color:color-mix(in_srgb,_var(--app-danger)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)]';
  return 'text-[color:var(--app-text-soft)] bg-[color:color-mix(in_srgb,_var(--app-surface)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-border-strong)_30%,_transparent)]';
}

function statusDot(status: string): string {
  const normalized = normalizeTransactionStatus(status);
  if (normalized === 'completed') return 'bg-[color:var(--app-accent)]';
  if (normalized === 'delivered') return 'bg-[color:var(--app-group-talent)]';
  if (normalized === 'in_progress') return 'bg-[color:var(--app-info)]';
  if (normalized === 'accepted') return 'bg-[color:var(--app-info)]';
  if (normalized === 'disputed') return 'bg-[color:var(--app-warning)]';
  if (normalized === 'cancelled') return 'bg-[color:var(--app-danger)]';
  return 'bg-[color:var(--app-surface)]';
}

function protectionTone(protectionStatus: unknown): string {
  const normalized =
    typeof protectionStatus === 'string'
      ? protectionStatus.trim().toLowerCase()
      : '';
  if (normalized === 'funds_held' || normalized === 'on_hold') {
    return 'text-[color:var(--app-info)] bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-info-border)_40%,_transparent)]';
  }
  if (normalized === 'escrow_released') {
    return 'text-[color:var(--app-accent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)]';
  }
  if (normalized === 'refunded') {
    return 'text-[color:var(--app-warning)] bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)]';
  }
  return 'text-[color:var(--app-text-soft)] bg-[color:color-mix(in_srgb,_var(--app-surface)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-border-strong)_30%,_transparent)]';
}

function paymentTone(paymentStatus: string): string {
  if (paymentStatus === 'paid')
    return 'text-[color:var(--app-accent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)]';
  if (paymentStatus === 'partial')
    return 'text-[color:var(--app-warning)] bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)]';
  if (paymentStatus === 'hold_error')
    return 'text-[color:var(--app-danger)] bg-[color:color-mix(in_srgb,_var(--app-danger)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)]';
  return 'text-[color:var(--app-text-soft)] bg-[color:color-mix(in_srgb,_var(--app-surface)_20%,_transparent)] border-[color:color-mix(in_srgb,_var(--app-border-strong)_30%,_transparent)]';
}

function formatDateTimeLabel(raw: unknown): string {
  if (typeof raw !== 'string' || !raw.trim()) return '-';
  try {
    const value = new Date(raw);
    if (Number.isNaN(value.getTime())) return '-';
    return value.toLocaleString();
  } catch {
    return '-';
  }
}

function buildFallbackTimeline(txn: RoomTransaction | null): Array<{
  event?: string;
  status?: string;
  actor?: string | null;
  at?: string | null;
  description?: string;
}> {
  if (!txn) return [];
  const items: Array<{
    event?: string;
    status?: string;
    actor?: string | null;
    at?: string | null;
    description?: string;
  }> = [];
  const status = normalizeTransactionStatus(
    txn.status || txn.transaction_status,
  );
  const createdAt = typeof txn.created_at === 'string' ? txn.created_at : null;
  const updatedAt =
    typeof txn.updated_at === 'string' ? txn.updated_at : createdAt;
  const paymentStatus = resolveTransactionPaymentStatus(txn);

  items.push({
    event: 'created',
    status: 'pending',
    actor: txn.buyer_id || null,
    at: createdAt,
    description: 'Order dibuat',
  });
  items.push({
    event: `payment_${paymentStatus}`,
    status: paymentStatus,
    actor: txn.buyer_id || null,
    at: updatedAt,
    description:
      paymentStatus === 'paid'
        ? 'Pembayaran terkonfirmasi'
        : paymentStatus === 'awaiting_payment'
          ? 'Menunggu pembayaran'
          : 'Status pembayaran diperbarui',
  });
  if (status !== 'pending') {
    items.push({
      event: `status_${status}`,
      status,
      actor:
        status === 'completed' ? txn.buyer_id || null : txn.seller_id || null,
      at: updatedAt,
      description: `Order ${humanizeStatus(status)}`,
    });
  }
  const delivery = parseTransactionDelivery(txn.transaction_meta);
  delivery.submissions.forEach(submission => {
    items.push({
      event: `delivery_submission_${submission.attemptNumber || delivery.attemptsUsed}`,
      status: 'delivered',
      actor: txn.seller_id || null,
      at: submission.submittedAt || updatedAt,
      description:
        submission.title ||
        submission.note ||
        `Seller mengirim hasil kerja attempt ${submission.attemptNumber || delivery.attemptsUsed}/${delivery.maxAttempts}`,
    });
    if (
      submission.reviewStatus === 'accepted' ||
      submission.reviewStatus === 'revision_requested'
    ) {
      items.push({
        event: `delivery_review_${submission.attemptNumber || delivery.attemptsUsed}`,
        status:
          submission.reviewStatus === 'accepted' ? 'completed' : 'in_progress',
        actor: txn.buyer_id || null,
        at: submission.reviewedAt || updatedAt,
        description:
          submission.buyerFeedbackNote ||
          (submission.reviewStatus === 'accepted'
            ? `Buyer menerima hasil kerja attempt ${submission.attemptNumber || delivery.attemptsUsed}/${delivery.maxAttempts}`
            : `Buyer meminta revisi untuk attempt ${submission.attemptNumber || delivery.attemptsUsed}/${delivery.maxAttempts}`),
      });
    }
  });
  return items;
}

function mapDealKind(
  raw: unknown,
):
  | 'job'
  | 'service'
  | 'product'
  | 'property'
  | 'tool_rental'
  | 'profile'
  | 'other' {
  const v = typeof raw === 'string' ? raw.trim().toLowerCase() : '';
  if (v === 'job') return 'job';
  if (v === 'service') return 'service';
  if (v === 'property' || v === 'real_estate') return 'property';
  if (v === 'tool_rental' || v === 'tool-rental' || v === 'rental')
    return 'tool_rental';
  if (v === 'profile' || v === 'freelancer') return 'profile';
  if (v === 'product' || v === 'item') return 'product';
  return 'other';
}

function mapFulfillmentMode(
  rawDeal: unknown,
  rawMode: unknown,
): 'standard' | 'shipping' | 'pickup' | 'remote' | 'onsite' | 'instant' {
  const mode = typeof rawMode === 'string' ? rawMode.trim().toLowerCase() : '';
  if (
    mode === 'shipping' ||
    mode === 'pickup' ||
    mode === 'remote' ||
    mode === 'onsite' ||
    mode === 'instant'
  )
    return mode;
  const deal = mapDealKind(rawDeal);
  if (deal === 'service' || deal === 'profile') return 'remote';
  if (deal === 'tool_rental') return 'pickup';
  if (deal === 'job' || deal === 'property') return 'onsite';
  if (deal === 'product') return 'shipping';
  return 'standard';
}

function parseMoneyCents(value: unknown): number {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.floor(parsed);
}

function toRoomTransactionFromStructuredPayload(
  payload: StructuredChatPayload | null,
): RoomTransaction | null {
  if (!payload) return null;

  const readString = (value: unknown): string | undefined => {
    if (typeof value !== 'string') return undefined;
    const trimmed = value.trim();
    return trimmed || undefined;
  };

  const id = readString(payload.transaction_id) || readString(payload.id);
  if (!id) return null;

  const amountCents = parseMoneyCents(payload.amount_cents);
  const transactionMeta = asObject(payload.transaction_meta);
  const snapshotListing = asObject(payload.snapshot_listing);
  const safetyChecklist = asObject(payload.safety_checklist);

  return {
    id,
    content_id: readString(payload.content_id),
    buyer_id: readString(payload.buyer_id),
    seller_id: readString(payload.seller_id),
    amount_cents: amountCents > 0 ? amountCents : undefined,
    currency: readString(payload.currency),
    status: readString(payload.status),
    transaction_status: readString(payload.transaction_status),
    protection_status: readString(payload.protection_status),
    deal_kind: readString(payload.deal_kind),
    fulfillment_mode: readString(payload.fulfillment_mode),
    transaction_meta:
      Object.keys(transactionMeta).length > 0 ? transactionMeta : undefined,
    snapshot_listing:
      Object.keys(snapshotListing).length > 0 ? snapshotListing : undefined,
    safety_checklist:
      Object.keys(safetyChecklist).length > 0 ? safetyChecklist : undefined,
    risk_flags: Array.isArray(payload.risk_flags)
      ? payload.risk_flags
      : undefined,
    offer_message: readString(payload.offer_message),
    response_message: readString(payload.response_message),
    created_at: readString(payload.created_at),
    updated_at: readString(payload.updated_at),
  };
}

function inferPricingMode(meta: StructuredChatPayload): 'fixed' | 'request' {
  return inferPricingModeFromPayload(meta);
}

function getTrustBadge(meta: StructuredChatPayload): string {
  const trusted = Boolean(
    meta.transaction_eligible || meta.identity_verified || meta.verified,
  );
  if (trusted) return 'Verified';
  const rating = Number(meta.rating ?? 0);
  if (Number.isFinite(rating) && rating >= 4) return 'Top rated';
  return 'Review profile';
}

function detectFraudSignals(content: string): FraudSignal[] {
  const text = String(content || '').toLowerCase();
  if (!text) return [];
  const highRiskPatterns = [
    /transfer.*(langsung|direct)/i,
    /bayar.*(luar|outside).*(aplikasi|platform)/i,
    /(wa|whatsapp|telegram|dm pribadi).*(lanjut|payment|bayar)/i,
    /(otp|kode verifikasi|password|pin).*(kirim|share)/i,
  ];
  const mediumRiskPatterns = [
    /(dp|down payment).*(tanpa|without).*(invoice|receipt)/i,
    /(cepat|urgent).*(transfer|bayar)/i,
    /(rekening|account).*(berbeda|other)/i,
  ];

  const found: FraudSignal[] = [];
  if (highRiskPatterns.some(pattern => pattern.test(text))) {
    found.push({
      severity: 'high',
      message:
        'Potential scam risk: avoid off-platform payment and never share OTP/PIN.',
    });
  }
  if (mediumRiskPatterns.some(pattern => pattern.test(text))) {
    found.push({
      severity: 'medium',
      message:
        'Double-check counterparty identity and payment method before continuing.',
    });
  }
  return found;
}

export default function ChatRoomPage() {
  const params = useParams() ?? {};
  const searchParams = useSearchParams();
  const rawId = (params as { id?: unknown })?.id;
  const rawLocale = (params as { locale?: unknown })?.locale;
  const chatLocale: 'id' | 'en' = rawLocale === 'en' ? 'en' : 'id';
  const canonicalRoomId = useMemo(() => normalizeRoomId(rawId), [rawId]);
  const draftComposerPrefill = (searchParams.get('draft') ?? '').trim();
  const draftContact = useMemo(
    () => parseDraftContact(canonicalRoomId),
    [canonicalRoomId],
  );
  const isDraftRoom = Boolean(draftContact);
  const isSupportRoom = canonicalRoomId.startsWith('support:');

  const router = useRouter();
  const { confirm, prompt } = useDialog();
  const { notify } = useToast();
  const { user, authFetch, accessToken, loading: authLoading } = useAuth();
  const {
    rooms: inboxRooms,
    loading: inboxLoading,
    refetch: refetchInbox,
  } = useChatInbox();

  // Allowed rooms based on inbox (anti URL injection)
  const allowedRoomIds = useMemo(() => {
    const set = new Set<string>();
    for (const r of inboxRooms) {
      const rid = normalizeRoomId((r as any).room_id ?? (r as any).id);
      if (rid) set.add(rid);
    }
    return set;
  }, [inboxRooms]);

  const [roomValidationPending, setRoomValidationPending] = useState(true);
  const roomValidationAttemptRef = useRef<string>('');

  useEffect(() => {
    roomValidationAttemptRef.current = '';
    setRoomValidationPending(Boolean(canonicalRoomId));
  }, [canonicalRoomId]);

  useEffect(() => {
    if (!canonicalRoomId) {
      setRoomValidationPending(false);
      return;
    }
    if (isDraftRoom) {
      setRoomValidationPending(false);
      return;
    }

    if (inboxLoading) {
      setRoomValidationPending(true);
      return;
    }

    if (allowedRoomIds.has(canonicalRoomId)) {
      setRoomValidationPending(false);
      return;
    }

    if (roomValidationAttemptRef.current === canonicalRoomId) {
      setRoomValidationPending(false);
      return;
    }

    roomValidationAttemptRef.current = canonicalRoomId;
    setRoomValidationPending(true);

    const timer = setTimeout(async () => {
      try {
        if (isSupportRoom && user?.id) {
          await authFetch('/api/chat/support-room', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              room_id: canonicalRoomId,
              room_name:
                canonicalRoomId === 'support:aida'
                  ? 'Aida Support'
                  : 'Support Room',
              member_ids: [user.id],
            }),
          }).catch(() => {});
        }
        await refetchInbox();
      } finally {
        setRoomValidationPending(false);
      }
    }, 700);

    return () => clearTimeout(timer);
  }, [
    canonicalRoomId,
    inboxLoading,
    allowedRoomIds,
    authFetch,
    isSupportRoom,
    refetchInbox,
    user?.id,
    isDraftRoom,
  ]);

  const roomAllowed = useMemo(() => {
    if (!canonicalRoomId) return false;
    if (isDraftRoom) return true;
    if (inboxLoading || roomValidationPending) return null; // not decided yet
    return allowedRoomIds.has(canonicalRoomId);
  }, [
    canonicalRoomId,
    inboxLoading,
    roomValidationPending,
    allowedRoomIds,
    isDraftRoom,
  ]);

  // Resolve room title from inbox + DM peer profile
  const [dmNamesByUserId, setDmNamesByUserId] = useState<
    Record<string, string>
  >({});
  const [roomName, setRoomName] = useState('Chat');

  useEffect(() => {
    if (!user?.id || inboxRooms.length === 0) return;

    const peerIds = Array.from(
      new Set(
        inboxRooms
          .map(room =>
            parseDmPeerId(
              String((room as any).room_id ?? (room as any).id ?? ''),
              user.id,
            ),
          )
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const missing = peerIds.filter(id => !dmNamesByUserId[id]);
    if (missing.length === 0) return;

    let cancelled = false;
    const run = async () => {
      const results = await Promise.all(
        missing.map(async id => {
          try {
            const res = await fetch(
              `/api/users/public/${encodeURIComponent(id)}`,
              { cache: 'no-store' },
            );
            if (!res.ok) return null;
            const payload = (await res
              .json()
              .catch(() => ({}))) as PublicProfile;
            const label =
              (typeof payload.username === 'string' && payload.username.trim()
                ? `@${payload.username.trim()}`
                : typeof payload.full_name === 'string' &&
                    payload.full_name.trim()
                  ? payload.full_name.trim()
                  : null) || null;
            return label ? { id, label } : null;
          } catch {
            return null;
          }
        }),
      );
      if (cancelled) return;
      setDmNamesByUserId(prev => {
        const next = { ...prev };
        for (const row of results) {
          if (!row) continue;
          next[row.id] = row.label;
        }
        return next;
      });
    };
    void run();
    return () => {
      cancelled = true;
    };
  }, [inboxRooms, user?.id, dmNamesByUserId]);

  useEffect(() => {
    if (isDraftRoom) {
      setRoomName('Direct Message');
      return;
    }
    if (!canonicalRoomId || inboxLoading) return;
    const found = inboxRooms.find(
      (r: any) => normalizeRoomId(r.room_id ?? r.id) === canonicalRoomId,
    ) as any;
    if (!found) return;

    const rawRoomId = String(found.room_id ?? found.id ?? '');
    const rawRoomName = String(found.room_name ?? found.name ?? '');
    const peerId = parseDmPeerId(rawRoomId, user?.id);

    if (peerId && dmNamesByUserId[peerId]) {
      setRoomName(dmNamesByUserId[peerId]);
    } else if (rawRoomName && !rawRoomName.startsWith('dm:')) {
      setRoomName(rawRoomName);
    } else if (rawRoomId.startsWith('dm:')) {
      setRoomName('Direct Message');
    } else {
      setRoomName(rawRoomName || 'Chat');
    }
  }, [
    canonicalRoomId,
    inboxLoading,
    inboxRooms,
    user?.id,
    dmNamesByUserId,
    isDraftRoom,
  ]);

  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [newMessage, setNewMessage] = useState('');
  const [typingUser, setTypingUser] = useState<string | null>(null);
  const [channelReady, setChannelReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<
    'connecting' | 'connected' | 'disconnected' | 'error'
  >('connecting');

  const [showVideoCall, setShowVideoCall] = useState(false);
  const [showVoiceCall, setShowVoiceCall] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerPanel, setShowStickerPanel] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [showListingActionModal, setShowListingActionModal] = useState(false);
  const [listingActionMode, setListingActionMode] =
    useState<OfferFlowMode>('offer');
  const [listingActionDraft, setListingActionDraft] =
    useState<ListingActionDraft | null>(null);
  const [listingActionAmount, setListingActionAmount] = useState('');
  const [listingActionMessage, setListingActionMessage] = useState('');
  const [listingActionSubmitting, setListingActionSubmitting] = useState(false);
  const [showTransactionsDrawer, setShowTransactionsDrawer] = useState(false);
  const [transactionsLoading, setTransactionsLoading] = useState(false);
  const [transactionsError, setTransactionsError] = useState<string | null>(
    null,
  );
  const [roomTransactions, setRoomTransactions] = useState<RoomTransaction[]>(
    [],
  );
  const [selectedTransaction, setSelectedTransaction] =
    useState<RoomTransaction | null>(null);
  const [txnActionLoading, setTxnActionLoading] = useState<string | null>(null);
  const [txnActionError, setTxnActionError] = useState<string | null>(null);
  const [txnActionInfo, setTxnActionInfo] = useState<string | null>(null);
  const [showChatSettings, setShowChatSettings] = useState(false);
  const [showAiQuickPanel, setShowAiQuickPanel] = useState(false);
  const [aiWorkspaceMode, setAiWorkspaceMode] = useState<
    'reply' | AiRoomDraftWorkspace
  >('reply');

  const [aiTemplateId, setAiTemplateId] = useState<AiTemplateId>(
    AI_TEMPLATES[0].id,
  );
  const [aiToneId, setAiToneId] = useState<AiToneId>(AI_TONES[0].id);
  const [aiLengthId, setAiLengthId] = useState<AiLengthId>(AI_LENGTHS[0].id);
  const [aiInstruction, setAiInstruction] = useState('');
  const [aiAutoSend, setAiAutoSend] = useState(false);
  const [aiUseContext, setAiUseContext] = useState(true);
  const [aiProfileName, setAiProfileName] = useState('AI Pribadi');
  const [aiDraft, setAiDraft] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiLastGeneratedAt, setAiLastGeneratedAt] = useState<string | null>(
    null,
  );
  const [aiStructuredPrompt, setAiStructuredPrompt] = useState('');
  const [aiStructuredDraft, setAiStructuredDraft] =
    useState<AiRoomDraftResult | null>(null);
  const [aiStructuredLoading, setAiStructuredLoading] = useState(false);
  const [aiStructuredError, setAiStructuredError] = useState<string | null>(
    null,
  );
  const [aiStructuredApplying, setAiStructuredApplying] = useState(false);
  const [publishingDraftId, setPublishingDraftId] = useState<string | null>(
    null,
  );

  const [draftAttachments, setDraftAttachments] = useState<DraftAttachment[]>(
    [],
  );
  const isUploadingAttachments = draftAttachments.some(
    att => att.status === 'uploading',
  );
  const hasComposerAttachments = draftAttachments.length > 0;
  const canSendMessage = newMessage.trim().length > 0 || hasComposerAttachments;
  const composerFraudSignals = useMemo(
    () => detectFraudSignals(newMessage),
    [newMessage],
  );
  const conversationFraudSignals = useMemo(() => {
    const seen = new Set<string>();
    const signals: FraudSignal[] = [];
    const recent = messages.slice(-15);
    for (const message of recent) {
      if (!message.content || message.sender_id === user?.id) continue;
      for (const signal of detectFraudSignals(message.content)) {
        const key = `${signal.severity}:${signal.message}`;
        if (seen.has(key)) continue;
        seen.add(key);
        signals.push(signal);
      }
    }
    return signals;
  }, [messages, user?.id]);
  const activeFraudSignal =
    composerFraudSignals[0] || conversationFraudSignals[0] || null;
  const hasTransactionMessages = useMemo(
    () => messages.some(message => message.message_type === 'transaction'),
    [messages],
  );
  const roomTransactionsById = useMemo(() => {
    const next = new Map<string, RoomTransaction>();
    for (const txn of roomTransactions) {
      if (!txn.id) continue;
      next.set(txn.id, txn);
    }
    return next;
  }, [roomTransactions]);

  const aiTemplate = useMemo(
    () =>
      AI_TEMPLATES.find(template => template.id === aiTemplateId) ??
      AI_TEMPLATES[0],
    [aiTemplateId],
  );
  const aiTone = useMemo(
    () => AI_TONES.find(tone => tone.id === aiToneId) ?? AI_TONES[0],
    [aiToneId],
  );
  const aiLength = useMemo(
    () => AI_LENGTHS.find(length => length.id === aiLengthId) ?? AI_LENGTHS[0],
    [aiLengthId],
  );
  const aiContextMessages = useMemo(() => {
    if (!aiUseContext) return [];
    return messages
      .filter(
        msg => typeof msg.content === 'string' && msg.content.trim().length > 0,
      )
      .slice(-8)
      .map(msg => ({
        role: msg.sender_id === user?.id ? 'user' : 'assistant',
        content: msg.content,
      }));
  }, [aiUseContext, messages, user?.id]);
  const lastIncomingMessage = useMemo(
    () =>
      [...messages]
        .reverse()
        .find(msg => msg.sender_id !== user?.id && msg.content?.trim())
        ?.content || '',
    [messages, user?.id],
  );

  const [incomingCall, setIncomingCall] = useState<{
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    callType: 'video' | 'voice';
  } | null>(null);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeCallIsCaller, setActiveCallIsCaller] = useState(false);
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [keyboardOffset, setKeyboardOffset] = useState(0);
  const [composerHeight, setComposerHeight] = useState(0);
  const [isComposerFocused, setIsComposerFocused] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const messageInputRef = useRef<HTMLInputElement>(null);
  const composerRef = useRef<HTMLDivElement>(null);
  const emojiPickerRef = useRef<HTMLDivElement>(null);
  const stickerPanelRef = useRef<HTMLDivElement>(null);
  const keyboardBaselineHeightRef = useRef(0);

  const channelRef = useRef<Awaited<ReturnType<typeof joinRoom>> | null>(null);
  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const typingDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastTypingSentRef = useRef<number>(0);

  const hasSentReadRef = useRef(false);
  const isJoiningRef = useRef(false);
  const lastJoinAttemptRef = useRef<number>(0);
  const lastErrorTimeRef = useRef<number>(0);
  const activeCallIdRef = useRef<string | null>(null);
  const prefilledDraftRef = useRef<string>('');
  const incomingCallRefState = useRef<{
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar?: string;
    callType: 'video' | 'voice';
  } | null>(null);

  const TYPING_DEBOUNCE_MS = 2000;
  const TYPING_STOP_MS = 3000;

  useEffect(() => {
    activeCallIdRef.current = activeCallId;
  }, [activeCallId]);

  useEffect(() => {
    incomingCallRefState.current = incomingCall;
  }, [incomingCall]);

  useEffect(() => {
    setNewMessage('');
    prefilledDraftRef.current = '';
  }, [canonicalRoomId]);

  useEffect(() => {
    if (!canonicalRoomId || !draftComposerPrefill) return;
    const prefillKey = `${canonicalRoomId}:${draftComposerPrefill}`;
    if (prefilledDraftRef.current === prefillKey) return;
    setNewMessage(draftComposerPrefill);
    prefilledDraftRef.current = prefillKey;
    requestAnimationFrame(() => {
      messageInputRef.current?.focus();
    });
  }, [canonicalRoomId, draftComposerPrefill]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;
    const key = `chat_ai_settings:${user.id}`;
    const raw = window.localStorage.getItem(key);
    if (!raw) return;
    try {
      const payload = JSON.parse(raw) as Partial<{
        templateId: string;
        toneId: string;
        lengthId: string;
        instruction: string;
        autoSend: boolean;
        useContext: boolean;
        profileName: string;
      }>;
      if (payload.templateId && isAiTemplateId(payload.templateId))
        setAiTemplateId(payload.templateId);
      if (payload.toneId && isAiToneId(payload.toneId))
        setAiToneId(payload.toneId);
      if (payload.lengthId && isAiLengthId(payload.lengthId))
        setAiLengthId(payload.lengthId);
      if (typeof payload.instruction === 'string')
        setAiInstruction(payload.instruction);
      if (typeof payload.autoSend === 'boolean')
        setAiAutoSend(payload.autoSend);
      if (typeof payload.useContext === 'boolean')
        setAiUseContext(payload.useContext);
      if (
        typeof payload.profileName === 'string' &&
        payload.profileName.trim()
      ) {
        setAiProfileName(payload.profileName.trim());
      }
    } catch {
      // ignore corrupted storage
    }
  }, [user?.id]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') return;
    const key = `chat_ai_settings:${user.id}`;
    const payload = {
      templateId: aiTemplateId,
      toneId: aiToneId,
      lengthId: aiLengthId,
      instruction: aiInstruction,
      autoSend: aiAutoSend,
      useContext: aiUseContext,
      profileName: aiProfileName,
    };
    window.localStorage.setItem(key, JSON.stringify(payload));
  }, [
    aiAutoSend,
    aiInstruction,
    aiLengthId,
    aiProfileName,
    aiTemplateId,
    aiToneId,
    aiUseContext,
    user?.id,
  ]);

  // Click outside emoji/sticker
  useEffect(() => {
    if (!showEmojiPicker && !showStickerPanel) return;
    const handleClick = (event: MouseEvent) => {
      const target = event.target as Node;
      if (composerRef.current && composerRef.current.contains(target)) return;
      setShowEmojiPicker(false);
      setShowStickerPanel(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showEmojiPicker, showStickerPanel]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setShowEmojiPicker(false);
        setShowStickerPanel(false);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(max-width: 639px)');
    const update = () => setIsMobileViewport(mq.matches);
    update();
    if (typeof mq.addEventListener === 'function') {
      mq.addEventListener('change', update);
      return () => mq.removeEventListener('change', update);
    }
    mq.addListener(update);
    return () => mq.removeListener(update);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!isMobileViewport) {
      setKeyboardOffset(0);
      keyboardBaselineHeightRef.current = 0;
      return;
    }
    const viewport = window.visualViewport;
    const KEYBOARD_THRESHOLD = 80;
    let raf = 0;

    const update = () => {
      const layoutHeight = window.innerHeight;
      const visualHeight = viewport?.height ?? layoutHeight;

      if (!keyboardBaselineHeightRef.current) {
        keyboardBaselineHeightRef.current = layoutHeight;
      }

      const baselineHeight = keyboardBaselineHeightRef.current || layoutHeight;
      const diff = Math.max(0, Math.round(baselineHeight - visualHeight));
      const keyboardLikelyOpen = isComposerFocused && diff > KEYBOARD_THRESHOLD;

      if (!keyboardLikelyOpen) {
        keyboardBaselineHeightRef.current = layoutHeight;
      }

      setKeyboardOffset(keyboardLikelyOpen ? diff : 0);
    };

    const scheduleUpdate = () => {
      if (raf) window.cancelAnimationFrame(raf);
      raf = window.requestAnimationFrame(update);
    };

    update();
    viewport?.addEventListener('resize', scheduleUpdate);
    viewport?.addEventListener('scroll', scheduleUpdate);
    window.addEventListener('resize', scheduleUpdate);
    return () => {
      if (raf) window.cancelAnimationFrame(raf);
      viewport?.removeEventListener('resize', scheduleUpdate);
      viewport?.removeEventListener('scroll', scheduleUpdate);
      window.removeEventListener('resize', scheduleUpdate);
    };
  }, [isMobileViewport, isComposerFocused]);

  useEffect(() => {
    const element = composerRef.current;
    if (!element) return;
    const update = () => {
      setComposerHeight(Math.ceil(element.getBoundingClientRect().height));
    };
    update();
    let observer: ResizeObserver | null = null;
    if (typeof ResizeObserver !== 'undefined') {
      observer = new ResizeObserver(update);
      observer.observe(element);
    }
    window.addEventListener('resize', update);
    return () => {
      observer?.disconnect();
      window.removeEventListener('resize', update);
    };
  }, []);

  const openAiWorkspace = useCallback(
    (workspace: 'reply' | AiRoomDraftWorkspace) => {
      setShowAiQuickPanel(true);
      setAiWorkspaceMode(workspace);
      if (workspace === 'reply') return;
      setAiStructuredPrompt(
        buildDefaultAiRoomDraftPrompt(workspace, chatLocale, {
          lastIncoming: lastIncomingMessage,
        }),
      );
      setAiStructuredDraft(null);
      setAiStructuredError(null);
    },
    [chatLocale, lastIncomingMessage],
  );

  const applyStructuredPromptExample = useCallback(
    (workspace: AiRoomDraftWorkspace, promptId: string, promptEn: string) => {
      setAiWorkspaceMode(workspace);
      setAiStructuredPrompt(chatLocale === 'id' ? promptId : promptEn);
      setAiStructuredDraft(null);
      setAiStructuredError(null);
    },
    [chatLocale],
  );

  const resetStructuredPrompt = useCallback(
    (workspace: AiRoomDraftWorkspace) => {
      setAiStructuredPrompt(
        buildDefaultAiRoomDraftPrompt(workspace, chatLocale, {
          lastIncoming: lastIncomingMessage,
        }),
      );
      setAiStructuredDraft(null);
      setAiStructuredError(null);
    },
    [chatLocale, lastIncomingMessage],
  );

  const handleGenerateStructuredDraft = useCallback(async () => {
    if (aiWorkspaceMode === 'reply' || aiStructuredLoading) return;
    const prompt = aiStructuredPrompt.trim();
    if (!prompt) {
      setAiStructuredError(
        chatLocale === 'id'
          ? 'Isi brief dulu sebelum minta AI buat draft.'
          : 'Add a brief first before asking AI to generate a draft.',
      );
      return;
    }

    setAiStructuredLoading(true);
    setAiStructuredError(null);
    setAiStructuredDraft(null);

    try {
      const instruction = buildAiRoomDraftInstruction({
        workspace: aiWorkspaceMode,
        locale: chatLocale,
        prompt,
        extraInstruction: aiInstruction,
        lastIncoming: lastIncomingMessage,
        composerDraft: newMessage.trim(),
      });
      const payload = buildAiChatPayload(instruction, aiContextMessages);
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        response?: string;
      };
      const raw = String(data.response ?? '').trim();
      if (!raw) {
        throw new Error(
          res.ok
            ? chatLocale === 'id'
              ? 'AI tidak mengembalikan draft.'
              : 'The AI did not return a draft.'
            : chatLocale === 'id'
              ? 'Layanan AI sedang bermasalah.'
              : 'The AI service is unavailable.',
        );
      }
      const structured = extractAiRoomDraftFromResponse(raw, aiWorkspaceMode);
      if (!structured) {
        throw new Error(
          chatLocale === 'id'
            ? 'Format jawaban AI belum rapi. Coba generate ulang atau rapikan brief-nya.'
            : 'The AI response format is invalid. Try again or tighten the brief.',
        );
      }
      setAiStructuredDraft(structured);
      setAiLastGeneratedAt(new Date().toISOString());
    } catch (error) {
      setAiStructuredError(
        error instanceof Error
          ? error.message
          : chatLocale === 'id'
            ? 'Gagal membuat draft AI.'
            : 'Failed to create the AI draft.',
      );
    } finally {
      setAiStructuredLoading(false);
    }
  }, [
    aiContextMessages,
    aiInstruction,
    aiStructuredLoading,
    aiStructuredPrompt,
    aiWorkspaceMode,
    chatLocale,
    lastIncomingMessage,
    newMessage,
  ]);

  const notifyRead = async () => {
    if (isDraftRoom) return;
    if (!canonicalRoomId) return;
    authFetch(`/api/chat/rooms/${encodeURIComponent(canonicalRoomId)}/read`, {
      method: 'POST',
    }).catch(() => {});
    try {
      channelRef.current?.push('read', {});
    } catch {
      // ignore
    }
    hasSentReadRef.current = true;
  };

  const loadMessages = useCallback(async () => {
    if (!user || !canonicalRoomId || isDraftRoom) return;
    if (roomAllowed !== true) return;

    setLoadError(null);
    setLoading(true);
    try {
      const encodedRoomId = encodeURIComponent(canonicalRoomId);
      const res = await authFetch(`/api/chat/rooms/${encodedRoomId}/messages`);
      const data = await res.json().catch(() => ({}));
      const list = Array.isArray((data as any).messages)
        ? (data as any).messages
        : (data as any).data || [];
      if (res.ok) {
        setMessages(
          list.map((m: any) => ({
            id: String(m.id ?? m.message_id ?? m.sent_at ?? ''),
            content: String(m.content ?? ''),
            sender_id: m.sender_id != null ? String(m.sender_id) : '',
            message_type: m.message_type ?? 'text',
            attachments: Array.isArray(m.attachments)
              ? m.attachments.map(normalizeAttachmentUrl).filter(Boolean)
              : [],
            created_at: m.created_at ?? m.sent_at ?? '',
            status: 'sent' as MessageStatus,
          })),
        );
      } else {
        setMessages([]);
        setLoadError((data as any)?.error || 'Could not load messages');
      }
      notifyRead();
    } catch {
      setMessages([]);
      setLoadError('Connection error. Check chat service.');
    } finally {
      setLoading(false);
    }
  }, [user, canonicalRoomId, authFetch, roomAllowed, isDraftRoom]);

  const refreshMessagesSilently = useCallback(async () => {
    if (!user || !canonicalRoomId || isDraftRoom) return;
    if (roomAllowed !== true) return;

    try {
      const encodedRoomId = encodeURIComponent(canonicalRoomId);
      const res = await authFetch(
        `/api/chat/rooms/${encodedRoomId}/messages?limit=80`,
        {
          cache: 'no-store',
        },
      );
      const data = await res.json().catch(() => ({}));
      const payload =
        data && typeof data === 'object'
          ? (data as { messages?: unknown[]; data?: unknown[] })
          : {};
      const list = Array.isArray(payload.messages)
        ? payload.messages
        : Array.isArray(payload.data)
          ? payload.data
          : [];
      if (!res.ok) return;

      const fromServer: Message[] = list.map(row => {
        const m =
          row && typeof row === 'object'
            ? (row as Record<string, unknown>)
            : {};
        return {
          id: String(m.id ?? m.message_id ?? m.sent_at ?? ''),
          content: String(m.content ?? ''),
          sender_id: m.sender_id != null ? String(m.sender_id) : '',
          message_type:
            typeof m.message_type === 'string' ? m.message_type : 'text',
          attachments: Array.isArray(m.attachments)
            ? m.attachments.map(normalizeAttachmentUrl).filter(Boolean)
            : [],
          created_at: String(m.created_at ?? m.sent_at ?? ''),
          status: 'sent' as MessageStatus,
        };
      });

      setMessages(prev => {
        const pending = prev.filter(
          msg => msg.status === 'sending' || msg.status === 'failed',
        );
        const seen = new Set(fromServer.map(msg => msg.id));
        const merged = [...fromServer];

        for (const msg of pending) {
          if (!seen.has(msg.id)) merged.push(msg);
        }

        merged.sort((a, b) => {
          const aTime = new Date(a.created_at || '').getTime();
          const bTime = new Date(b.created_at || '').getTime();
          if (!Number.isFinite(aTime) && !Number.isFinite(bTime)) return 0;
          if (!Number.isFinite(aTime)) return 1;
          if (!Number.isFinite(bTime)) return -1;
          return aTime - bTime;
        });

        return merged;
      });
    } catch {
      // ignore silent refresh failures
    }
  }, [user, canonicalRoomId, roomAllowed, authFetch, isDraftRoom]);

  useEffect(() => {
    if (!user || !canonicalRoomId || isDraftRoom) return;
    if (roomAllowed !== true) return;
    loadMessages();
  }, [user, canonicalRoomId, loadMessages, roomAllowed, isDraftRoom]);

  useEffect(() => {
    if (!user || !canonicalRoomId || isDraftRoom) return;
    if (roomAllowed !== true) return;
    if (connectionStatus === 'connected') return;

    const timer = setInterval(() => {
      void refreshMessagesSilently();
    }, 3500);

    return () => clearInterval(timer);
  }, [
    user,
    canonicalRoomId,
    roomAllowed,
    connectionStatus,
    refreshMessagesSilently,
    isDraftRoom,
  ]);

  // Join socket channel
  useEffect(() => {
    if (!canonicalRoomId || !user || authLoading || !accessToken || isDraftRoom)
      return;
    if (roomAllowed !== true) return;

    let cancelled = false;
    let teardown: (() => void) | null = null;

    function doJoin() {
      const token = accessToken;
      if (!token || cancelled) return;

      const now = Date.now();
      if (isJoiningRef.current || now - lastJoinAttemptRef.current < 2000)
        return;
      isJoiningRef.current = true;
      lastJoinAttemptRef.current = now;

      setConnectionStatus('connecting');

      joinRoom(canonicalRoomId, token)
        .then(channel => {
          isJoiningRef.current = false;
          if (cancelled) {
            channel.leave();
            return;
          }

          if (channelRef.current && channelRef.current !== channel) {
            try {
              channelRef.current.leave();
            } catch {}
          }

          channelRef.current = channel;
          setChannelReady(true);
          setConnectionStatus('connected');

          const onErr = () => {
            if (cancelled) return;
            const now = Date.now();
            if (now - lastErrorTimeRef.current < 5000) return;
            lastErrorTimeRef.current = now;
            setChannelReady(false);
            setConnectionStatus('error');
          };

          const onClose = () => {
            if (cancelled) return;
            const now = Date.now();
            if (now - lastErrorTimeRef.current < 5000) return;
            lastErrorTimeRef.current = now;
            setChannelReady(false);
            setConnectionStatus('disconnected');
          };

          channel.onError(onErr);
          channel.onClose(onClose);

          const typingRef = channel.on(
            'typing',
            (payload: {
              user_id?: string;
              username?: string;
              is_typing?: boolean;
            }) => {
              if (
                cancelled ||
                !user ||
                normId(payload.user_id) === normId(user.id)
              )
                return;
              setTypingUser(
                payload.is_typing ? payload.username || 'Someone' : null,
              );
            },
          ) as number;

          const readRef = channel.on(
            'read',
            (payload: { user_id?: string }) => {
              if (
                cancelled ||
                !user ||
                normId(payload.user_id) === normId(user.id)
              )
                return;
              setMessages(prev =>
                prev.map(m =>
                  normId(m.sender_id) === normId(user.id) &&
                  (m.status === 'sent' || m.status === 'sending')
                    ? { ...m, status: 'read' as MessageStatus }
                    : m,
                ),
              );
            },
          ) as number;

          const incomingCallRef = channel.on(
            'call_incoming',
            (payload: any) => {
              if (
                cancelled ||
                !user ||
                normId(payload.caller_id) === normId(user.id)
              )
                return;
              setIncomingCall({
                callId: payload.call_id,
                callerId: payload.caller_id,
                callerName: payload.caller_username,
                callerAvatar: payload.caller_avatar,
                callType: payload.call_type,
              });
            },
          ) as number;

          const callRejectedRef = channel.on(
            'call_rejected',
            (payload: any) => {
              if (cancelled) return;
              soundManager.stopLoop('outgoingRing');
              soundManager.stopLoop('incomingRing');
              if (activeCallIdRef.current === payload.call_id) {
                setShowVideoCall(false);
                setShowVoiceCall(false);
                setActiveCallId(null);
                setActiveCallIsCaller(false);
              }
              if (incomingCallRefState.current?.callId === payload.call_id)
                setIncomingCall(null);
            },
          ) as number;

          const callEndedRef = channel.on('call_ended', (payload: any) => {
            if (cancelled) return;
            soundManager.stopLoop('outgoingRing');
            soundManager.stopLoop('incomingRing');
            if (activeCallIdRef.current === payload.call_id) {
              setShowVideoCall(false);
              setShowVoiceCall(false);
              setActiveCallId(null);
              setActiveCallIsCaller(false);
            }
            if (incomingCallRefState.current?.callId === payload.call_id)
              setIncomingCall(null);
          }) as number;

          const messageHandlerDispose = onMessage(channel, (payload: any) => {
            if (cancelled) return;

            const msgId =
              payload.message_id ?? payload.sent_at ?? `socket-${Date.now()}`;
            const isOwn = normId(payload.sender_id) === normId(user?.id);

            setMessages(prev => {
              const exists = prev.some(
                m =>
                  m.id === msgId ||
                  (payload.client_ref && m.id === payload.client_ref),
              );
              if (exists) return prev;

              // own messages: ignore if not matching client_ref (we already optimistically render)
              if (isOwn && !payload.client_ref) return prev;

              if (isOwn && payload.client_ref) {
                return prev.map(m =>
                  m.id === payload.client_ref
                    ? {
                        ...m,
                        id: msgId,
                        status: 'sent' as MessageStatus,
                        created_at: payload.sent_at ?? m.created_at,
                      }
                    : m,
                );
              }

              const newMsg: Message = {
                id: msgId,
                content: payload.content ?? payload.body ?? '',
                sender_id: payload.sender_id ?? '',
                message_type: payload.message_type ?? 'text',
                attachments: Array.isArray(payload.attachments)
                  ? payload.attachments
                      .map(normalizeAttachmentUrl)
                      .filter(Boolean)
                  : [],
                created_at: payload.sent_at ?? new Date().toISOString(),
                status: 'sent',
              };

              return [...prev, newMsg];
            });

            if (!isOwn) {
              soundManager.play('messageReceive');
              notifyRead();
            }
          });

          teardown = () => {
            try {
              channel.off('typing', typingRef);
              channel.off('read', readRef);
              channel.off('call_incoming', incomingCallRef);
              channel.off('call_rejected', callRejectedRef);
              channel.off('call_ended', callEndedRef);
            } catch {}

            try {
              messageHandlerDispose?.();
            } catch {}

            try {
              channel.leave();
            } catch {}

            if (channelRef.current === channel) channelRef.current = null;
            setChannelReady(false);
            setConnectionStatus('disconnected');
          };
        })
        .catch(() => {
          isJoiningRef.current = false;
          if (cancelled) return;
          setChannelReady(false);
          setConnectionStatus('error');
        });
    }

    doJoin();

    return () => {
      cancelled = true;
      isJoiningRef.current = false;
      if (teardown) teardown();
      if (channelRef.current) {
        try {
          channelRef.current.leave();
        } catch {}
        channelRef.current = null;
      }
      setChannelReady(false);
      setConnectionStatus('disconnected');
    };
  }, [
    canonicalRoomId,
    user?.id,
    accessToken,
    authLoading,
    roomAllowed,
    isDraftRoom,
  ]);

  useEffect(() => {
    if (!canonicalRoomId || !user || messages.length === 0 || isDraftRoom)
      return;
    if (roomAllowed !== true) return;
    if (!hasSentReadRef.current) notifyRead();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages.length, canonicalRoomId, user?.id, roomAllowed, isDraftRoom]);

  useEffect(() => {
    if (messages.length === 0) return;
    const raf = window.requestAnimationFrame(() => {
      messagesEndRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'end',
      });
    });
    return () => window.cancelAnimationFrame(raf);
  }, [messages.length]);

  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;
    const prevRootOverflow = root.style.overflow;
    const prevBodyOverflow = body.style.overflow;
    const prevBodyOverscroll = body.style.overscrollBehaviorY;

    root.style.overflow = 'hidden';
    body.style.overflow = 'hidden';
    body.style.overscrollBehaviorY = 'none';

    return () => {
      root.style.overflow = prevRootOverflow;
      body.style.overflow = prevBodyOverflow;
      body.style.overscrollBehaviorY = prevBodyOverscroll;
    };
  }, []);

  const startOutgoingCall = useCallback(
    async (type: 'video' | 'voice') => {
      if (!channelRef.current || !channelReady || !canonicalRoomId) return;
      if (showVideoCall || showVoiceCall || incomingCall) return;

      const provisionalCallId =
        crypto.randomUUID?.() ??
        `call-${Date.now()}-${Math.random().toString(36).slice(2)}`;

      try {
        void soundManager.unlock();
        const reply = await new Promise<{ ok: boolean; callId?: string }>(
          resolve => {
            channelRef.current
              ?.push(
                'call_start',
                { call_id: provisionalCallId, call_type: type },
                12000,
              )
              .receive('ok', (resp: { call_id?: string }) =>
                resolve({ ok: true, callId: resp.call_id }),
              )
              .receive('error', () => resolve({ ok: false }))
              .receive('timeout', () => resolve({ ok: false }));
          },
        );

        if (!reply.ok) {
          notify({
            title: 'Failed to start call',
            description: 'Please try again.',
            variant: 'error',
          });
          return;
        }

        const callId = reply.callId || provisionalCallId;
        setActiveCallId(callId);
        setActiveCallIsCaller(true);
        if (type === 'video') {
          setShowVoiceCall(false);
          setShowVideoCall(true);
        } else {
          setShowVideoCall(false);
          setShowVoiceCall(true);
        }
      } catch {
        notify({
          title: 'Failed to start call',
          description: 'Please try again.',
          variant: 'error',
        });
      }
    },
    [
      channelReady,
      canonicalRoomId,
      incomingCall,
      notify,
      showVideoCall,
      showVoiceCall,
    ],
  );

  const handleTypingChange = useCallback(
    (value: string) => {
      setNewMessage(value);
      if (!channelRef.current || !channelReady) return;

      const now = Date.now();
      if (now - lastTypingSentRef.current >= TYPING_DEBOUNCE_MS) {
        try {
          channelRef.current.push('typing', { is_typing: true });
          lastTypingSentRef.current = now;
        } catch {}
      }

      if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
      if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);

      typingDebounceRef.current = setTimeout(() => {
        typingStopTimerRef.current = setTimeout(() => {
          try {
            if (channelRef.current && channelReady) {
              channelRef.current.push('typing', { is_typing: false });
              lastTypingSentRef.current = 0;
            }
          } catch {}
          typingStopTimerRef.current = null;
        }, TYPING_STOP_MS);
        typingDebounceRef.current = null;
      }, 100);
    },
    [channelReady],
  );

  // Upload
  const previewUrlsRef = useRef<Set<string>>(new Set());
  const rememberPreviewUrl = useCallback((url?: string) => {
    if (url) previewUrlsRef.current.add(url);
  }, []);
  const cleanupPreviewUrl = useCallback((url?: string) => {
    if (url && previewUrlsRef.current.has(url)) {
      URL.revokeObjectURL(url);
      previewUrlsRef.current.delete(url);
    }
  }, []);
  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      previewUrlsRef.current.clear();
    };
  }, []);

  const uploadAttachment = useCallback(
    async (file: File, attachmentId: string) => {
      if (!canonicalRoomId) return;
      const encodedRoomId = encodeURIComponent(canonicalRoomId);
      setDraftAttachments(prev =>
        prev.map(att =>
          att.id === attachmentId ? { ...att, status: 'uploading' } : att,
        ),
      );
      try {
        const form = new FormData();
        form.append('file', file);
        const uploadRes = await authFetch(
          `/api/chat/rooms/${encodedRoomId}/upload`,
          { method: 'POST', body: form },
        );
        const uploadData = await uploadRes.json().catch(() => ({}));
        if (!uploadRes.ok)
          throw new Error((uploadData as any).error || 'upload failed');
        const payload = (uploadData as any).data || {};
        const fileUrl = payload.url as string;
        const uploadType =
          (payload.type as AttachmentKind) || detectAttachmentType(file);
        setDraftAttachments(prev =>
          prev.map(att =>
            att.id === attachmentId
              ? {
                  ...att,
                  serverUrl: fileUrl,
                  status: 'uploaded',
                  type: uploadType,
                }
              : att,
          ),
        );
      } catch {
        setDraftAttachments(prev =>
          prev.map(att =>
            att.id === attachmentId ? { ...att, status: 'error' } : att,
          ),
        );
      }
    },
    [authFetch, canonicalRoomId],
  );

  const handleFilesSelected = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || fileList.length === 0) return;
      if (!canonicalRoomId) return;

      const currentCount = draftAttachments.length;
      const remainingSlots = Math.max(
        0,
        MAX_COMPOSER_ATTACHMENTS - currentCount,
      );
      if (remainingSlots === 0) {
        notify({
          title: 'Attachment limit reached',
          description: `You can only attach up to ${MAX_COMPOSER_ATTACHMENTS} files at once.`,
          variant: 'info',
          durationMs: 4200,
        });
        return;
      }

      const selectedFiles = Array.from(fileList).slice(0, remainingSlots);
      selectedFiles.forEach(file => {
        const attachmentId =
          crypto.randomUUID?.() ??
          `draft-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const type = detectAttachmentType(file);
        const previewUrl =
          type === 'image' || type === 'video'
            ? URL.createObjectURL(file)
            : undefined;
        rememberPreviewUrl(previewUrl);

        setDraftAttachments(prev => [
          ...prev,
          {
            id: attachmentId,
            file,
            name: file.name,
            size: file.size,
            type,
            previewUrl,
            status: 'uploading',
          },
        ]);
        uploadAttachment(file, attachmentId);
      });

      setShowEmojiPicker(false);
      setShowStickerPanel(false);
    },
    [
      canonicalRoomId,
      draftAttachments.length,
      rememberPreviewUrl,
      uploadAttachment,
    ],
  );

  const removeDraftAttachment = useCallback(
    (attachmentId: string) => {
      setDraftAttachments(prev => {
        const target = prev.find(att => att.id === attachmentId);
        cleanupPreviewUrl(target?.previewUrl);
        return prev.filter(att => att.id !== attachmentId);
      });
    },
    [cleanupPreviewUrl],
  );

  const retryAttachmentUpload = useCallback(
    (attachmentId: string) => {
      const target = draftAttachments.find(att => att.id === attachmentId);
      if (target?.file) uploadAttachment(target.file, attachmentId);
    },
    [draftAttachments, uploadAttachment],
  );

  const clearDraftAttachments = useCallback(() => {
    setDraftAttachments(prev => {
      prev.forEach(att => cleanupPreviewUrl(att.previewUrl));
      return [];
    });
  }, [cleanupPreviewUrl]);

  const sendPayload = async (
    content: string,
    messageType: string = 'text',
    attachments: string[] = [],
  ) => {
    setSending(true);

    const clientRef = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    const tempMessage: Message = {
      id: clientRef,
      content,
      sender_id: user?.id || '',
      message_type: messageType,
      attachments,
      created_at: new Date().toISOString(),
      status: 'sending',
    };

    setMessages(prev => [...prev, tempMessage]);
    soundManager.play('messageSend');

    const ch = channelRef.current;
    const useSocket = !!(ch && channelReady);
    let targetRoomId = canonicalRoomId;

    const ensureRoomForDraft = async (): Promise<string> => {
      if (!isDraftRoom || !draftContact) return targetRoomId;
      const createRes = await authFetch('/api/chat/create-room', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contact: draftContact,
          lead: { source: 'manual_chat', name: draftContact },
        }),
        credentials: 'include',
      });
      const createData = await createRes.json().catch(() => ({}) as any);
      const newRoomId = String((createData as any)?.room_id || '').trim();
      if (!createRes.ok || !newRoomId) {
        throw new Error((createData as any)?.error || 'Failed to create chat');
      }
      targetRoomId = newRoomId;
      await refetchInbox().catch(() => {});
      router.replace(`/chat/${encodeURIComponent(newRoomId)}`);
      return targetRoomId;
    };

    const doPostFallback = async () => {
      const roomId = await ensureRoomForDraft();
      const encodedRoomId = encodeURIComponent(roomId);
      const res = await authFetch(`/api/chat/rooms/${encodedRoomId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, type: messageType, attachments }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        const serverMsg = (data as any).message ?? (data as any).data;
        const resolved: Message = serverMsg
          ? {
              id: serverMsg.id ?? serverMsg.sent_at ?? clientRef,
              content: serverMsg.content ?? content,
              sender_id: serverMsg.sender_id ?? user?.id ?? '',
              message_type: serverMsg.message_type ?? messageType,
              attachments: Array.isArray(serverMsg.attachments)
                ? serverMsg.attachments
                    .map(normalizeAttachmentUrl)
                    .filter(Boolean)
                : attachments.map(normalizeAttachmentUrl).filter(Boolean),
              created_at:
                serverMsg.created_at ??
                serverMsg.sent_at ??
                tempMessage.created_at,
              status: 'sent',
            }
          : { ...tempMessage, status: 'sent' as MessageStatus };
        setMessages(prev => prev.map(m => (m.id === clientRef ? resolved : m)));
      } else {
        setMessages(prev =>
          prev.map(m =>
            m.id === clientRef
              ? { ...m, status: 'failed' as MessageStatus }
              : m,
          ),
        );
      }
    };

    try {
      if (isDraftRoom) {
        await doPostFallback();
        return;
      }
      if (useSocket && ch) {
        const result = await sendMessageViaSocket(ch, content, clientRef, {
          message_type: messageType,
          attachments,
        });
        if (result.ok) {
          setMessages(prev =>
            prev.map(m =>
              m.id === clientRef
                ? {
                    id: result.message_id,
                    content: result.content ?? content,
                    sender_id: user?.id ?? '',
                    message_type: result.message_type ?? messageType,
                    attachments: (result.attachments ?? attachments)
                      .map(normalizeAttachmentUrl)
                      .filter(Boolean),
                    created_at: result.sent_at,
                    status: 'sent',
                  }
                : m,
            ),
          );
        } else {
          await doPostFallback();
        }
      } else {
        await doPostFallback();
      }
    } catch {
      await doPostFallback().catch(() => {
        setMessages(prev =>
          prev.map(m =>
            m.id === clientRef
              ? { ...m, status: 'failed' as MessageStatus }
              : m,
          ),
        );
      });
    } finally {
      setSending(false);
    }
  };

  const patchStructuredCardMessage = useCallback(
    (messageId: string, patch: Record<string, unknown>) => {
      setMessages(prev =>
        prev.map(message => {
          if (message.id !== messageId) return message;
          const currentMeta = parseStructuredAttachment(
            message.attachments?.[0],
          );
          if (!currentMeta) return message;
          const nextMeta = {
            ...currentMeta,
            ...patch,
          };
          const nextAttachments = [...(message.attachments || [])];
          nextAttachments[0] = JSON.stringify(nextMeta);
          return {
            ...message,
            attachments: nextAttachments,
          };
        }),
      );
    },
    [],
  );

  const handleCreateStructuredDraftCard = useCallback(async () => {
    if (!aiStructuredDraft || aiStructuredApplying) return;

    setAiStructuredApplying(true);
    setAiStructuredError(null);

    try {
      const draftPayload = buildAiRoomCreatePayload(aiStructuredDraft);
      const localValidation = validateListingPayload(draftPayload, {
        mode: 'create',
      });
      if (!localValidation.ok) {
        throw new Error(
          formatValidationIssues(localValidation.issues, chatLocale),
        );
      }

      const publishValidation = validateListingPayload(
        {
          ...draftPayload,
          content_status: 'active',
        },
        {
          mode: 'create',
          strictActiveValidation: true,
        },
      );
      const publishIssues = publishValidation.ok
        ? []
        : publishValidation.issues;

      const res = await authFetch('/api/content/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localValidation.payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        slug?: string;
        title?: string;
        content_status?: string;
        error?: string;
        issues?: string[];
      };
      if (!res.ok) {
        throw new Error(
          Array.isArray(data.issues) && data.issues.length > 0
            ? formatValidationIssues(data.issues, chatLocale)
            : data.error ||
                (chatLocale === 'id'
                  ? 'Gagal membuat draft listing.'
                  : 'Failed to create the draft.'),
        );
      }

      const draftId = typeof data.id === 'string' ? data.id.trim() : '';
      if (!draftId) {
        throw new Error(
          chatLocale === 'id'
            ? 'Draft berhasil dibuat tapi ID draft tidak ditemukan.'
            : 'The draft was created but no draft ID was returned.',
        );
      }

      const cardPayload = buildAiRoomCardPayload({
        draft: aiStructuredDraft,
        contentId: draftId,
        slug: data.slug,
        status: data.content_status,
        publishIssues,
      });
      await sendPayload('', 'listing', [JSON.stringify(cardPayload)]);

      notify({
        title:
          chatLocale === 'id'
            ? 'Draft AI sudah masuk room'
            : 'The AI draft was added to the room',
        description:
          chatLocale === 'id'
            ? 'Cek card di chat, review detailnya, lalu edit atau publish.'
            : 'Check the draft card in chat, review the details, then edit or publish.',
        variant: 'success',
      });
      setShowAiQuickPanel(false);
      setAiStructuredDraft(null);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : chatLocale === 'id'
            ? 'Gagal mengirim draft AI ke room.'
            : 'Failed to send the AI draft to the room.';
      setAiStructuredError(message);
      notify({
        title:
          chatLocale === 'id'
            ? 'Draft AI gagal dibuat'
            : 'Failed to create the AI draft',
        description: message,
        variant: 'error',
        durationMs: 4200,
      });
    } finally {
      setAiStructuredApplying(false);
    }
  }, [
    aiStructuredApplying,
    aiStructuredDraft,
    authFetch,
    chatLocale,
    notify,
    sendPayload,
  ]);

  const handlePublishStructuredDraft = useCallback(
    async (messageId: string, meta: StructuredChatPayload | null) => {
      const draftId =
        typeof meta?.draft_id === 'string' && meta.draft_id.trim()
          ? meta.draft_id.trim()
          : typeof meta?.content_id === 'string' && meta.content_id.trim()
            ? meta.content_id.trim()
            : '';
      if (!draftId || publishingDraftId === draftId) return;

      setPublishingDraftId(draftId);
      try {
        const res = await authFetch(`/api/content/${draftId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content_status: 'active' }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          title?: string;
          slug?: string;
          content_status?: string;
          error?: string;
          issues?: string[];
        };
        if (!res.ok) {
          throw new Error(
            Array.isArray(data.issues) && data.issues.length > 0
              ? formatValidationIssues(data.issues, chatLocale)
              : data.error ||
                  (chatLocale === 'id'
                    ? 'Draft belum bisa dipublish.'
                    : 'The draft cannot be published yet.'),
          );
        }

        patchStructuredCardMessage(messageId, {
          content_status: data.content_status || 'active',
          publish_ready: true,
          publish_issues: [],
          slug:
            typeof data.slug === 'string' && data.slug.trim()
              ? data.slug
              : meta?.slug,
          content_url: buildContentHref(
            draftId,
            typeof data.title === 'string' && data.title.trim()
              ? data.title
              : typeof meta?.content_title === 'string' &&
                  meta.content_title.trim()
                ? meta.content_title
                : 'Listing',
            typeof data.slug === 'string' && data.slug.trim()
              ? data.slug
              : typeof meta?.slug === 'string'
                ? meta.slug
                : '',
          ),
          published_at: new Date().toISOString(),
        });

        notify({
          title:
            chatLocale === 'id'
              ? 'Draft berhasil dipublish'
              : 'Draft published',
          description:
            chatLocale === 'id'
              ? 'Listing sekarang sudah aktif.'
              : 'The listing is now active.',
          variant: 'success',
        });
      } catch (error) {
        notify({
          title:
            chatLocale === 'id'
              ? 'Publish masih tertahan'
              : 'Publishing is blocked',
          description:
            error instanceof Error
              ? error.message
              : chatLocale === 'id'
                ? 'Draft masih perlu dicek sebelum publish.'
                : 'The draft still needs review before publishing.',
          variant: 'info',
          durationMs: 4500,
        });
      } finally {
        setPublishingDraftId(null);
      }
    },
    [
      authFetch,
      chatLocale,
      notify,
      patchStructuredCardMessage,
      publishingDraftId,
    ],
  );

  const handleGenerateAiDraft = useCallback(async () => {
    if (aiLoading) return;
    if (sending) {
      setAiError('Tunggu pesan selesai terkirim dulu.');
      return;
    }
    setAiError(null);
    setAiLoading(true);

    const lastIncoming = [...messages]
      .reverse()
      .find(msg => msg.sender_id !== user?.id && msg.content?.trim())?.content;
    const userDraftHint = newMessage.trim();
    const instructionParts = [
      `Kamu adalah asisten chat pribadi milik pengguna Lajukan.`,
      `Nama asisten: ${aiProfileName || 'AI Pribadi'}.`,
      `Tujuan: ${aiTemplate.label}.`,
      `Arahan template: ${aiTemplate.prompt}.`,
      `Nada: ${aiTone.label}. Panjang: ${aiLength.label}.`,
      aiInstruction ? `Instruksi tambahan user: ${aiInstruction}` : '',
      userDraftHint
        ? `Gunakan draft pengguna sebagai referensi lalu rapikan: "${userDraftHint}"`
        : '',
      lastIncoming
        ? `Pesan terakhir lawan bicara: "${lastIncoming}"`
        : 'Belum ada pesan. Buat pesan pembuka singkat dan ramah.',
      'Balasan harus natural, siap dikirim, dan tidak kaku.',
    ].filter(Boolean);

    try {
      const payload = buildAiChatPayload(
        instructionParts.join('\n'),
        aiContextMessages,
      );
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as {
        response?: string;
      };
      const draft = String(data.response ?? '').trim();
      if (!draft) {
        throw new Error(
          res.ok
            ? 'AI tidak mengembalikan jawaban.'
            : 'Layanan AI sedang bermasalah.',
        );
      }
      setAiDraft(draft);
      setAiLastGeneratedAt(new Date().toISOString());

      if (aiAutoSend) {
        if (isUploadingAttachments) {
          setAiError('Tunggu upload selesai sebelum auto-send.');
          return;
        }
        await sendPayload(draft);
      }
    } catch (error) {
      setAiError(
        error instanceof Error ? error.message : 'Gagal membuat draft AI.',
      );
    } finally {
      setAiLoading(false);
    }
  }, [
    aiAutoSend,
    aiContextMessages,
    aiInstruction,
    aiLength.label,
    aiLoading,
    aiProfileName,
    aiTemplate.label,
    aiTemplate.prompt,
    aiTone.label,
    isUploadingAttachments,
    messages,
    newMessage,
    sendPayload,
    sending,
    user?.id,
  ]);

  const handleInsertAiDraft = useCallback(() => {
    if (!aiDraft.trim()) return;
    setNewMessage(aiDraft.trim());
    setAiDraft('');
    messageInputRef.current?.focus();
  }, [aiDraft]);

  const handleSendAiDraft = useCallback(async () => {
    const draft = aiDraft.trim();
    if (!draft || sending || isUploadingAttachments) return;
    setAiDraft('');
    await sendPayload(draft);
  }, [aiDraft, isUploadingAttachments, sendPayload, sending]);

  const handleClearAiDraft = useCallback(() => {
    setAiDraft('');
    setAiError(null);
  }, []);

  const handleSend = useCallback(async () => {
    const trimmed = newMessage.trim();
    const hasAttachments = draftAttachments.length > 0;
    if (!trimmed && !hasAttachments) return;
    if (sending || isUploadingAttachments) return;

    if (trimmed) {
      const risks = detectFraudSignals(trimmed);
      if (risks.some(risk => risk.severity === 'high')) {
        const proceed = await confirm({
          title: 'Pesan berisiko',
          description:
            'Pesan ini terdeteksi berisiko scam/off-platform. Lanjut kirim?',
          confirmLabel: 'Tetap kirim',
          cancelLabel: 'Batal',
          tone: 'danger',
        });
        if (!proceed) return;
      }
    }

    if (hasAttachments) {
      const notReady = draftAttachments.filter(
        att => att.status !== 'uploaded' || !att.serverUrl,
      );
      if (notReady.length > 0) {
        notify({
          title: 'Upload masih berjalan',
          description: 'Please wait until all attachments finish uploading.',
          variant: 'info',
        });
        return;
      }
    }

    if (typingStopTimerRef.current) clearTimeout(typingStopTimerRef.current);
    if (typingDebounceRef.current) clearTimeout(typingDebounceRef.current);
    if (channelRef.current && channelReady) {
      try {
        channelRef.current.push('typing', { is_typing: false });
        lastTypingSentRef.current = 0;
      } catch {}
    }

    const attachmentUrls = hasAttachments
      ? draftAttachments.map(att => att.serverUrl ?? '').filter(Boolean)
      : [];
    const messageType = hasAttachments
      ? draftAttachments.length === 1
        ? draftAttachments[0].type
        : 'file'
      : 'text';

    await sendPayload(trimmed, messageType, attachmentUrls);
    setNewMessage('');
    clearDraftAttachments();
  }, [
    newMessage,
    draftAttachments,
    sending,
    isUploadingAttachments,
    confirm,
    notify,
    sendPayload,
    channelReady,
    clearDraftAttachments,
  ]);

  const handleChooseFile = () => fileInputRef.current?.click();
  const handleFileChange = (ev: React.ChangeEvent<HTMLInputElement>) => {
    handleFilesSelected(ev.target.files);
    ev.target.value = '';
  };

  const handleStickerSelect = useCallback(
    (url: string) => {
      if (!url || sending) return;
      setShowStickerPanel(false);
      void sendPayload('', 'sticker', [url]);
    },
    [sending],
  );

  const handleEmojiPick = useCallback(
    (emoji: string) => {
      if (!emoji) return;
      handleTypingChange(`${newMessage}${emoji}`);
    },
    [newMessage, handleTypingChange],
  );

  const applyListingActionMode = useCallback(
    (draft: ListingActionDraft, mode: OfferFlowMode) => {
      if (
        mode === 'direct' &&
        (draft.listingSide === 'demand' || draft.pricingMode === 'request')
      ) {
        return;
      }
      const defaults = getListingActionDefaults(draft, mode, chatLocale);
      setListingActionMode(mode);
      setListingActionAmount(defaults.amount);
      setListingActionMessage(defaults.message);
    },
    [chatLocale],
  );

  const openListingActionModal = useCallback(
    (meta: StructuredChatPayload, mode: OfferFlowMode) => {
      const contentId =
        typeof meta.content_id === 'string' ? meta.content_id : '';
      if (!contentId) {
        notify({
          title: 'Listing tidak valid',
          description: 'Listing ini tidak bisa dipakai untuk transaksi.',
          variant: 'error',
        });
        return;
      }
      const listingSide = resolveListingSide({
        type: meta.content_type,
        metadata: meta,
        title: meta.content_title,
        summary: meta.summary,
      });
      const pricingMode = inferPricingMode(meta);
      if (mode === 'direct' && listingSide === 'demand') {
        notify({
          title: 'Gunakan mode offer',
          description:
            'Listing ini mencari respons, jadi gunakan mode offer / proposal.',
          variant: 'info',
        });
        return;
      }
      if (mode === 'direct' && pricingMode === 'request') {
        notify({
          title: 'Gunakan tawaran',
          description:
            'Listing ini menggunakan ask-price. Silakan kirim tawaran / tanya harga.',
          variant: 'info',
        });
        return;
      }
      const amountCents = parseMoneyCents(meta.price_cents);
      const fallbackRequestCents = parseMoneyCents(
        meta.suggested_budget_cents ?? meta.min_budget_cents,
      );
      const draft: ListingActionDraft = {
        contentId,
        title: String(meta.content_title || 'Listing'),
        listingSide,
        amountCents,
        suggestedOfferCents:
          amountCents > 0
            ? Math.max(0, Math.floor(amountCents * 0.9))
            : fallbackRequestCents,
        currency:
          typeof meta.currency === 'string' && meta.currency.trim()
            ? meta.currency.trim().toUpperCase()
            : 'IDR',
        contentUrl:
          typeof meta.content_url === 'string' && meta.content_url.trim()
            ? meta.content_url
            : buildContentHref(
                contentId,
                String(meta.content_title || 'Listing'),
                typeof meta.slug === 'string' ? meta.slug : '',
              ),
        dealKind: mapDealKind(meta.deal_kind ?? meta.content_type),
        fulfillmentMode: mapFulfillmentMode(
          meta.deal_kind ?? meta.content_type,
          meta.fulfillment_mode ?? meta.shipping_method,
        ),
        pricingMode,
      };
      setListingActionDraft(draft);
      applyListingActionMode(draft, mode);
      setShowListingActionModal(true);
    },
    [applyListingActionMode],
  );

  const submitListingAction = useCallback(async () => {
    if (!listingActionDraft || !canonicalRoomId) return;
    const parsedAmount = Number(listingActionAmount || '0');
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      notify({ title: 'Nominal tidak valid.', variant: 'error' });
      return;
    }
    const amountCents = Math.floor(parsedAmount * 100);
    if (amountCents <= 0) {
      notify({
        title: 'Nominal harus lebih dari 0.',
        variant: 'error',
      });
      return;
    }

    setListingActionSubmitting(true);
    try {
      const createdAt = new Date().toISOString();
      const interactionReference = buildInteractionReference(
        listingActionMode === 'direct' ? 'TRX' : 'OFF',
        listingActionDraft.contentId,
      );
      const safetyChecklist = {
        identity_confirmed: true,
        platform_payment_confirmed: true,
        item_detail_confirmed: true,
        anti_scam_acknowledged: true,
      };
      const riskFlags = detectFraudSignals(listingActionMessage).map(signal =>
        signal.severity === 'high'
          ? 'off_platform_or_otp_risk'
          : 'payment_confirmation_risk',
      );
      const offerRes = await authFetch('/api/transactions/offer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content_id: listingActionDraft.contentId,
          amount_cents: amountCents,
          currency: listingActionDraft.currency,
          offer_message: listingActionMessage.trim() || undefined,
          deal_kind: listingActionDraft.dealKind,
          fulfillment_mode: listingActionDraft.fulfillmentMode,
          safety_checklist: safetyChecklist,
          risk_flags: riskFlags,
          transaction_meta: {
            source: 'chat_listing_card',
            flow_mode: listingActionMode,
            pricing_mode: listingActionDraft.pricingMode,
            market_side: toMarketSideValue(listingActionDraft.listingSide),
            ticket: {
              reference: interactionReference,
              kind: listingActionMode === 'direct' ? 'transaction' : 'offer',
              created_at: createdAt,
              next_step:
                'Open transaction detail to review the structured card and next actions.',
            },
          },
        }),
      });
      const offerData = await offerRes.json().catch(() => ({}));
      if (!offerRes.ok) {
        throw new Error(
          (offerData as { error?: string }).error || 'Gagal membuat penawaran',
        );
      }

      const resolvedAmount =
        typeof (offerData as any)?.amount_cents === 'number'
          ? (offerData as any).amount_cents
          : amountCents;
      const resolvedCurrency =
        typeof (offerData as any)?.currency === 'string'
          ? (offerData as any).currency
          : listingActionDraft.currency;
      const resolvedStatus =
        typeof (offerData as any)?.status === 'string'
          ? (offerData as any).status
          : typeof (offerData as any)?.transaction_status === 'string'
            ? (offerData as any).transaction_status
            : 'pending';
      const summary =
        listingActionMode === 'direct'
          ? `Direct purchase: ${formatMoney(resolvedAmount, resolvedCurrency)}`
          : listingActionDraft.listingSide === 'demand'
            ? `Need response: ${formatMoney(resolvedAmount, resolvedCurrency)}`
            : `Offer: ${formatMoney(resolvedAmount, resolvedCurrency)}`;
      const payload = {
        transaction_id:
          typeof (offerData as any)?.id === 'string'
            ? (offerData as any).id
            : '',
        content_id: listingActionDraft.contentId,
        content_title: listingActionDraft.title,
        content_url: listingActionDraft.contentUrl,
        amount_cents: resolvedAmount,
        currency: resolvedCurrency,
        offer_message: listingActionMessage.trim() || undefined,
        market_side: toMarketSideValue(listingActionDraft.listingSide),
        created_at: createdAt,
        buyer_id:
          typeof (offerData as any)?.buyer_id === 'string'
            ? (offerData as any).buyer_id
            : user?.id,
        seller_id:
          typeof (offerData as any)?.seller_id === 'string'
            ? (offerData as any).seller_id
            : undefined,
        deal_kind:
          typeof (offerData as any)?.deal_kind === 'string'
            ? (offerData as any).deal_kind
            : listingActionDraft.dealKind,
        fulfillment_mode:
          typeof (offerData as any)?.fulfillment_mode === 'string'
            ? (offerData as any).fulfillment_mode
            : listingActionDraft.fulfillmentMode,
        snapshot_listing:
          typeof (offerData as any)?.snapshot_listing === 'object'
            ? (offerData as any).snapshot_listing
            : undefined,
        safety_checklist: safetyChecklist,
        risk_flags: riskFlags,
        status: resolvedStatus,
        protection_status:
          typeof (offerData as any)?.protection_status === 'string'
            ? (offerData as any).protection_status
            : 'awaiting_funding',
        flow_mode: listingActionMode,
        ticket: {
          reference: interactionReference,
          kind: listingActionMode === 'direct' ? 'transaction' : 'offer',
          status: resolvedStatus,
          created_at: createdAt,
          next_step:
            'Open the detail panel to see amount, scope, and transaction progress.',
        },
      };

      await sendPayload(
        summary,
        listingActionMode === 'direct' ? 'transaction' : 'offer',
        [JSON.stringify(payload)],
      );
      setShowListingActionModal(false);
      setListingActionDraft(null);
      setListingActionAmount('');
      setListingActionMessage('');
    } catch (error) {
      notify({
        title:
          error instanceof Error ? error.message : 'Gagal memproses transaksi',
        variant: 'error',
      });
    } finally {
      setListingActionSubmitting(false);
    }
  }, [
    listingActionDraft,
    canonicalRoomId,
    listingActionAmount,
    authFetch,
    listingActionMessage,
    listingActionMode,
    notify,
    user?.id,
    sendPayload,
  ]);

  const syncRoomTransactions = useCallback(
    async ({ silent = false }: { silent?: boolean } = {}): Promise<
      RoomTransaction[]
    > => {
      if (!canonicalRoomId) return [];
      const loadErrorFallback =
        chatLocale === 'id'
          ? 'Riwayat transaksi belum bisa dimuat. Coba lagi sebentar.'
          : 'Unable to load transactions right now. Please try again.';
      if (!silent) {
        setTransactionsLoading(true);
        setTransactionsError(null);
        setTxnActionError(null);
      }
      try {
        const response = await authFetch(
          `/api/chat/rooms/${encodeURIComponent(canonicalRoomId)}/transactions?limit=100`,
          {
            cache: 'no-store',
          },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
          transactions?: RoomTransaction[];
        };
        if (!response.ok) {
          throw new Error(payload.error || loadErrorFallback);
        }
        const next = Array.isArray(payload.transactions)
          ? payload.transactions
          : [];
        setRoomTransactions(next);
        setSelectedTransaction(prev => {
          if (!prev) return prev;
          const found = next.find(txn => txn.id === prev.id);
          return found || prev;
        });
        return next;
      } catch (error) {
        if (!silent) {
          setTransactionsError(
            error instanceof Error &&
              !/failed to fetch|networkerror|load failed/i.test(
                error.message.toLowerCase(),
              )
              ? error.message
              : loadErrorFallback,
          );
        }
        return [];
      } finally {
        if (!silent) {
          setTransactionsLoading(false);
        }
      }
    },
    [authFetch, canonicalRoomId, chatLocale],
  );

  const loadRoomTransactions = useCallback(async (): Promise<
    RoomTransaction[]
  > => {
    return syncRoomTransactions();
  }, [syncRoomTransactions]);

  const refreshRoomTransactionsSilently = useCallback(async (): Promise<
    RoomTransaction[]
  > => {
    return syncRoomTransactions({ silent: true });
  }, [syncRoomTransactions]);

  const openPaymentForTransaction = useCallback(
    (candidate: {
      id?: string;
      transaction_id?: string;
      amount_cents?: unknown;
      currency?: unknown;
    }) => {
      const transactionId = String(
        candidate.id || candidate.transaction_id || '',
      ).trim();
      const params = new URLSearchParams({ source: 'chat' });
      if (transactionId) {
        params.set('transaction_id', transactionId);
      }
      router.push(`/transactions?${params.toString()}`);
    },
    [router],
  );

  const applyRoomTransactionUpdate = useCallback((updated: RoomTransaction) => {
    setRoomTransactions(prev =>
      prev.map(txn => (txn.id === updated.id ? { ...txn, ...updated } : txn)),
    );
    setSelectedTransaction(prev => {
      if (!prev || prev.id !== updated.id) return prev;
      return { ...prev, ...updated };
    });
  }, []);

  const runTransactionAction = useCallback(
    async (
      action:
        | 'accept'
        | 'start'
        | 'deliver'
        | 'complete'
        | 'cancel'
        | 'dispute',
      txn: RoomTransaction,
    ) => {
      const transactionId = String(txn.id || '').trim();
      if (!transactionId) return;
      if (!canRunTransactionAction(action, txn, user?.id)) {
        setTxnActionError(
          'Aksi tidak diizinkan untuk role/status transaksi saat ini.',
        );
        return;
      }

      let responseMessage = '';
      let reasonCode: string | undefined;
      const allowedCancelReasonCodes = new Set([
        'buyer_changed_mind',
        'seller_unresponsive',
        'schedule_issue',
        'duplicate_order',
        'other',
      ]);
      const allowedDisputeReasonCodes = new Set([
        'non_delivery',
        'item_not_as_described',
        'damaged_item',
        'missing_parts',
        'fake_tracking',
        'service_not_delivered',
        'unauthorized_charge',
        'other',
      ]);
      if (action === 'complete') {
        const ok = await confirm({
          title: 'Selesaikan order?',
          description: 'Tandai order ini sebagai selesai?',
          confirmLabel: 'Tandai selesai',
          cancelLabel: 'Batal',
        });
        if (!ok) return;
      }
      if (action === 'cancel') {
        const reason = await prompt({
          title: 'Batalkan order',
          description: 'Tulis alasan pembatalan bila perlu.',
          placeholder: 'Alasan pembatalan (opsional)',
          confirmLabel: 'Lanjut',
          cancelLabel: 'Batal',
          multiline: true,
        });
        if (reason === null) return;
        responseMessage = reason.trim();
        const reasonCodeRaw = await prompt({
          title: 'Kode alasan pembatalan',
          description:
            'Wajib diisi. Contoh: buyer_changed_mind, seller_unresponsive, schedule_issue, duplicate_order, other',
          placeholder: 'other',
          defaultValue: 'other',
          confirmLabel: 'Simpan',
          cancelLabel: 'Batal',
          required: true,
        });
        if (reasonCodeRaw === null) return;
        reasonCode = reasonCodeRaw
          .trim()
          .toLowerCase()
          .replace(/-/g, '_')
          .replace(/\s+/g, '_');
        if (reasonCode === 'change_of_mind') reasonCode = 'other';
        if (reasonCode && !allowedCancelReasonCodes.has(reasonCode)) {
          setTxnActionError(
            'Kode alasan tidak valid. Gunakan salah satu kode yang didukung.',
          );
          return;
        }
        if (!reasonCode) {
          setTxnActionError('Kode alasan pembatalan wajib diisi.');
          return;
        }
      }
      if (action === 'dispute') {
        const reason = await prompt({
          title: 'Ajukan dispute',
          description: 'Jelaskan alasan dispute.',
          placeholder: 'Alasan dispute (wajib)',
          confirmLabel: 'Lanjut',
          cancelLabel: 'Batal',
          required: true,
          multiline: true,
        });
        if (reason === null) return;
        if (!reason.trim()) {
          setTxnActionError('Alasan dispute wajib diisi.');
          return;
        }
        responseMessage = reason.trim();
        const reasonCodeRaw = await prompt({
          title: 'Kode alasan dispute',
          description:
            'Wajib diisi. Contoh: non_delivery, item_not_as_described, service_not_delivered, damaged_item, other',
          placeholder: 'other',
          defaultValue: 'other',
          confirmLabel: 'Simpan',
          cancelLabel: 'Batal',
          required: true,
        });
        if (reasonCodeRaw === null) return;
        reasonCode = reasonCodeRaw
          .trim()
          .toLowerCase()
          .replace(/-/g, '_')
          .replace(/\s+/g, '_');
        if (reasonCode && !allowedDisputeReasonCodes.has(reasonCode)) {
          setTxnActionError('Kode alasan dispute tidak valid.');
          return;
        }
        if (!reasonCode) {
          setTxnActionError('Kode alasan dispute wajib diisi.');
          return;
        }
      }
      if (action === 'accept' || action === 'deliver') {
        const note = await prompt({
          title: action === 'accept' ? 'Terima transaksi' : 'Kirim hasil',
          description: 'Tambahkan catatan bila perlu.',
          placeholder: 'Catatan (opsional)',
          confirmLabel: 'Lanjut',
          cancelLabel: 'Batal',
          multiline: true,
        });
        if (note === null) return;
        responseMessage = note.trim();
      }

      setTxnActionLoading(`${action}:${transactionId}`);
      setTxnActionError(null);
      setTxnActionInfo(null);

      try {
        const res = await authFetch(
          `/api/transactions/${encodeURIComponent(transactionId)}/${action}`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': createIdempotencyKey(
                `chat-${action}-${transactionId}`,
              ),
            },
            body: JSON.stringify({
              response_message: responseMessage || undefined,
              message: responseMessage || undefined,
              reason_code: reasonCode,
            }),
          },
        );
        const payload = (await res.json().catch(() => ({}))) as
          | (RoomTransaction & { error?: string })
          | { error?: string };
        if (!res.ok) {
          throw new Error(
            typeof payload === 'object' && payload && 'error' in payload
              ? String(payload.error || 'Aksi transaksi gagal')
              : 'Aksi transaksi gagal',
          );
        }

        const updated =
          payload && typeof payload === 'object' && 'id' in payload
            ? (payload as RoomTransaction)
            : txn;
        applyRoomTransactionUpdate(updated);
        setTxnActionInfo(`Order berhasil ${humanizeStatus(action)}.`);
        await loadRoomTransactions();

        const txPayload = {
          transaction_id: updated.id,
          content_id: updated.content_id,
          amount_cents: updated.amount_cents,
          currency: updated.currency,
          status: updated.status || action,
          transaction_status: updated.status || action,
          protection_status: updated.protection_status,
          deal_kind: updated.deal_kind,
          fulfillment_mode: updated.fulfillment_mode,
          transaction_meta: updated.transaction_meta,
          snapshot_listing: updated.snapshot_listing,
          response_message: responseMessage || undefined,
          buyer_id: updated.buyer_id,
          seller_id: updated.seller_id,
        };
        const summary = `Transaction ${humanizeStatus(updated.status || action)}: ${formatMoney(
          updated.amount_cents,
          updated.currency,
        )}`;
        await sendPayload(summary, 'transaction', [JSON.stringify(txPayload)]);
      } catch (error) {
        setTxnActionError(
          error instanceof Error
            ? error.message
            : 'Gagal menjalankan aksi transaksi',
        );
      } finally {
        setTxnActionLoading(null);
      }
    },
    [
      authFetch,
      applyRoomTransactionUpdate,
      confirm,
      loadRoomTransactions,
      prompt,
      sendPayload,
      user?.id,
    ],
  );

  const runCounterOffer = useCallback(
    async (txn: RoomTransaction) => {
      const transactionId = String(txn.id || '').trim();
      if (!transactionId) return;
      const status = normalizeTransactionStatus(
        txn.status || txn.transaction_status,
      );
      const isParty = Boolean(
        user?.id &&
        (normId(txn.buyer_id) === normId(user.id) ||
          normId(txn.seller_id) === normId(user.id)),
      );
      if (!isParty || status !== 'pending') {
        setTxnActionError(
          'Counter offer hanya tersedia untuk pihak transaksi pada status pending.',
        );
        return;
      }

      const baseCurrency =
        typeof txn.currency === 'string' && txn.currency.trim()
          ? txn.currency.trim().toUpperCase()
          : 'IDR';
      const currentAmount = Math.max(
        0,
        Math.floor(Number(txn.amount_cents || 0) / 100),
      );
      const rawAmount = await prompt({
        title: 'Counter offer',
        description: `Masukkan nominal counter offer (${baseCurrency}).`,
        placeholder: currentAmount > 0 ? String(currentAmount) : '0',
        defaultValue: currentAmount > 0 ? String(currentAmount) : '',
        confirmLabel: 'Lanjut',
        cancelLabel: 'Batal',
        required: true,
      });
      if (rawAmount === null) return;
      const parsedAmount = Number(rawAmount.replace(/[^0-9.]/g, ''));
      if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
        setTxnActionError('Nominal counter offer tidak valid.');
        return;
      }
      const amountCents = Math.floor(parsedAmount * 100);
      if (amountCents <= 0) {
        setTxnActionError('Nominal counter offer tidak valid.');
        return;
      }

      const message =
        (await prompt({
          title: 'Pesan counter offer',
          description: 'Tambahkan pesan bila perlu.',
          placeholder: 'Pesan counter offer (opsional)',
          confirmLabel: 'Lanjut',
          cancelLabel: 'Batal',
          multiline: true,
        })) ?? '';
      const safetyChecklist =
        Object.keys(asObject(txn.safety_checklist)).length > 0
          ? asObject(txn.safety_checklist)
          : {
              identity_confirmed: true,
              platform_payment_confirmed: true,
              item_detail_confirmed: true,
              anti_scam_acknowledged: true,
            };
      const riskFlags = detectFraudSignals(message).map(signal =>
        signal.severity === 'high'
          ? 'off_platform_or_otp_risk'
          : 'payment_confirmation_risk',
      );

      setTxnActionLoading(`counter:${transactionId}`);
      setTxnActionError(null);
      setTxnActionInfo(null);

      try {
        const res = await authFetch(
          `/api/transactions/${encodeURIComponent(transactionId)}/counter-offer`,
          {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'X-Idempotency-Key': createIdempotencyKey(
                `counter-offer-${transactionId}`,
              ),
            },
            body: JSON.stringify({
              amount_cents: amountCents,
              currency: baseCurrency,
              offer_message: message.trim() || undefined,
              deal_kind: txn.deal_kind || undefined,
              fulfillment_mode: txn.fulfillment_mode || undefined,
              safety_checklist: safetyChecklist,
              risk_flags: riskFlags,
              transaction_meta: {
                source: 'chat_counter_offer',
                parent_transaction_id: transactionId,
              },
            }),
          },
        );
        const payload = (await res
          .json()
          .catch(() => ({}))) as RoomTransaction & { error?: string };
        if (!res.ok || !payload?.id) {
          throw new Error(payload?.error || 'Gagal membuat counter offer');
        }

        setTxnActionInfo('Counter offer berhasil dikirim.');
        const refreshed = await loadRoomTransactions();
        const latest =
          refreshed.find(item => item.id === payload.id) || payload;
        setSelectedTransaction(latest);

        const chatPayload = {
          transaction_id: latest.id,
          content_id: latest.content_id,
          content_title:
            typeof latest.snapshot_listing?.title === 'string'
              ? latest.snapshot_listing.title
              : 'Counter Offer',
          content_url:
            typeof latest.snapshot_listing?.content_url === 'string'
              ? latest.snapshot_listing.content_url
              : latest.content_id
                ? buildContentHref(
                    latest.content_id,
                    typeof latest.snapshot_listing?.title === 'string'
                      ? latest.snapshot_listing.title
                      : 'Listing',
                    typeof latest.snapshot_listing?.slug === 'string'
                      ? latest.snapshot_listing.slug
                      : '',
                  )
                : undefined,
          amount_cents: latest.amount_cents,
          currency: latest.currency,
          offer_message: latest.offer_message || message.trim() || undefined,
          buyer_id: latest.buyer_id,
          seller_id: latest.seller_id,
          deal_kind: latest.deal_kind,
          fulfillment_mode: latest.fulfillment_mode,
          snapshot_listing: latest.snapshot_listing,
          market_side: toMarketSideValue(
            resolveListingSide({
              type: latest.deal_kind ?? latest.snapshot_listing?.content_type,
              metadata: latest.transaction_meta ?? latest.snapshot_listing,
              title: latest.snapshot_listing?.title,
            }),
          ),
          safety_checklist: latest.safety_checklist,
          risk_flags: latest.risk_flags,
          status: latest.status || latest.transaction_status || 'pending',
          protection_status: latest.protection_status || 'awaiting_funding',
          flow_mode: 'counter_offer',
          ticket: {
            reference: buildInteractionReference('CTR', latest.id),
            kind: 'offer',
            status: latest.status || latest.transaction_status || 'pending',
            created_at:
              latest.updated_at ||
              latest.created_at ||
              new Date().toISOString(),
            next_step:
              'Review the counter offer details and continue from the transaction panel.',
          },
        };
        const summary = `Counter Offer: ${formatMoney(latest.amount_cents, latest.currency)}`;
        await sendPayload(summary, 'offer', [JSON.stringify(chatPayload)]);
      } catch (error) {
        setTxnActionError(
          error instanceof Error
            ? error.message
            : 'Gagal membuat counter offer',
        );
      } finally {
        setTxnActionLoading(null);
      }
    },
    [authFetch, loadRoomTransactions, prompt, sendPayload, user?.id],
  );

  useEffect(() => {
    if (!showTransactionsDrawer) return;
    loadRoomTransactions();
  }, [showTransactionsDrawer, loadRoomTransactions]);

  useEffect(() => {
    if (!canonicalRoomId || roomAllowed !== true || isDraftRoom) return;
    if (!hasTransactionMessages) return;
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      return;
    }

    void refreshRoomTransactionsSilently();

    const refresh = () => {
      if (document.visibilityState === 'hidden') return;
      void refreshRoomTransactionsSilently();
    };

    const timer = window.setInterval(refresh, 12000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [
    canonicalRoomId,
    roomAllowed,
    isDraftRoom,
    hasTransactionMessages,
    refreshRoomTransactionsSilently,
  ]);

  useEffect(() => {
    setShowTransactionsDrawer(false);
    setSelectedTransaction(null);
    setRoomTransactions([]);
    setTransactionsError(null);
    setTxnActionError(null);
    setTxnActionInfo(null);
    setTxnActionLoading(null);
  }, [canonicalRoomId]);

  const timelineItems = useMemo<TimelineItem[]>(() => {
    if (messages.length === 0) return [];
    const next: TimelineItem[] = [];
    let prevDayKey = '';
    for (const msg of messages) {
      const dayKey = new Date(msg.created_at || '').toDateString();
      if (dayKey !== prevDayKey) {
        next.push({
          type: 'day',
          id: `day-${dayKey}-${msg.id}`,
          label: formatDayLabel(msg.created_at),
        });
        prevDayKey = dayKey;
      }
      next.push({ type: 'message', message: msg });
    }
    return next;
  }, [messages]);

  const statusMeta: Record<
    'connecting' | 'connected' | 'disconnected' | 'error',
    { label: string; subtext: string; dotClass: string; textClass: string }
  > = {
    connected: {
      label: chatLocale === 'id' ? 'Online' : 'Online',
      subtext: typingUser
        ? chatLocale === 'id'
          ? `${typingUser} sedang mengetik...`
          : `${typingUser} is typing...`
        : chatLocale === 'id'
          ? 'Chat terenkripsi'
          : 'End-to-end encrypted',
      dotClass: 'bg-[color:var(--app-accent)]',
      textClass:
        'text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]',
    },
    connecting: {
      label: chatLocale === 'id' ? 'Menghubungkan...' : 'Connecting...',
      subtext:
        chatLocale === 'id'
          ? 'Menyiapkan layanan chat'
          : 'Reaching the chat service',
      dotClass: 'bg-[color:var(--app-warning)] animate-pulse',
      textClass: 'text-[color:var(--app-warning)]',
    },
    disconnected: {
      label: chatLocale === 'id' ? 'Menyambung ulang...' : 'Reconnecting...',
      subtext:
        chatLocale === 'id'
          ? 'Akan dicoba lagi otomatis'
          : "We'll retry automatically",
      dotClass: 'bg-[color:var(--app-surface)] animate-pulse',
      textClass:
        'text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]',
    },
    error: {
      label: chatLocale === 'id' ? 'Masalah koneksi' : 'Connection issue',
      subtext:
        chatLocale === 'id'
          ? 'Coba lagi sebentar lagi'
          : 'Tap to retry in a moment',
      dotClass: 'bg-[color:var(--app-danger)] animate-pulse',
      textClass: 'text-[color:var(--app-danger)]',
    },
  };

  const statusInfo = statusMeta[connectionStatus];
  const roomInitial = roomName?.charAt(0)?.toUpperCase() || 'C';
  const roomKind = canonicalRoomId.startsWith('support:')
    ? 'support'
    : canonicalRoomId.startsWith('dm:') || canonicalRoomId.startsWith('draft:')
      ? 'direct'
      : 'group';
  const roomSummaryTransaction = useMemo(() => {
    if (selectedTransaction) return selectedTransaction;
    const activeTxn = roomTransactions.find(txn => {
      const status = normalizeTransactionStatus(
        txn.status || txn.transaction_status,
      );
      return status !== 'completed' && status !== 'cancelled';
    });
    return activeTxn || roomTransactions[0] || null;
  }, [roomTransactions, selectedTransaction]);
  const roomSummaryTxnStatus = normalizeTransactionStatus(
    roomSummaryTransaction?.status ||
      roomSummaryTransaction?.transaction_status,
  );
  const roomSummaryTxnPaymentStatus = resolveTransactionPaymentStatus(
    roomSummaryTransaction,
  );
  const roomSummaryTxnProgress = useMemo(
    () => getTransactionProgressPercent(roomSummaryTransaction),
    [roomSummaryTransaction],
  );
  const roomSummaryTxnWaitingParty = useMemo(
    () => getTransactionWaitingParty(roomSummaryTransaction, user?.id),
    [roomSummaryTransaction, user?.id],
  );
  const roomSummaryTxnTitle =
    typeof roomSummaryTransaction?.snapshot_listing?.title === 'string' &&
    roomSummaryTransaction.snapshot_listing.title.trim()
      ? roomSummaryTransaction.snapshot_listing.title
      : typeof roomSummaryTransaction?.content_id === 'string' &&
          roomSummaryTransaction.content_id.trim()
        ? roomSummaryTransaction.content_id
        : chatLocale === 'id'
          ? 'Transaksi aktif'
          : 'Active transaction';
  const roomSummaryTxnShouldPay = Boolean(
    roomSummaryTransaction &&
    user?.id &&
    normId(roomSummaryTransaction.buyer_id) === normId(user.id) &&
    (roomSummaryTxnStatus === 'pending' ||
      roomSummaryTxnStatus === 'accepted') &&
    !transactionPaymentReady(roomSummaryTransaction),
  );
  const selectedTxnStatus = normalizeTransactionStatus(
    selectedTransaction?.status || selectedTransaction?.transaction_status,
  );
  const selectedTxnProtectionStatus = String(
    selectedTransaction?.protection_status || 'awaiting_funding',
  )
    .trim()
    .toLowerCase();
  const selectedTxnPaymentStatus =
    resolveTransactionPaymentStatus(selectedTransaction);
  const selectedTxnIsBuyer = Boolean(
    user?.id &&
    selectedTransaction &&
    normId(selectedTransaction.buyer_id) === normId(user.id),
  );
  const selectedTxnIsSeller = Boolean(
    user?.id &&
    selectedTransaction &&
    normId(selectedTransaction.seller_id) === normId(user.id),
  );
  const selectedTxnPaymentReady = transactionPaymentReady(selectedTransaction);
  const selectedTxnShouldPay = Boolean(
    selectedTransaction &&
    selectedTxnIsBuyer &&
    (selectedTxnStatus === 'pending' || selectedTxnStatus === 'accepted') &&
    !selectedTxnPaymentReady,
  );
  const selectedTxnCanAccept = Boolean(
    selectedTransaction &&
    selectedTxnIsSeller &&
    selectedTxnStatus === 'pending',
  );
  const selectedTxnCanStart = Boolean(
    selectedTransaction &&
    selectedTxnIsSeller &&
    selectedTxnStatus === 'accepted' &&
    selectedTxnPaymentReady,
  );
  const selectedTxnCanDeliver = Boolean(
    selectedTransaction &&
    selectedTxnIsSeller &&
    selectedTxnStatus === 'in_progress',
  );
  const selectedTxnCanComplete = Boolean(
    selectedTransaction &&
    selectedTxnIsBuyer &&
    selectedTxnStatus === 'delivered',
  );
  const selectedTxnCanCancel = Boolean(
    selectedTransaction &&
    ((selectedTxnStatus === 'pending' && !selectedTxnIsSeller) ||
      selectedTxnStatus === 'accepted' ||
      selectedTxnStatus === 'in_progress'),
  );
  const selectedTxnCanDispute = Boolean(
    selectedTransaction &&
    (selectedTxnStatus === 'accepted' ||
      selectedTxnStatus === 'in_progress' ||
      selectedTxnStatus === 'delivered'),
  );
  const selectedTxnCanCounter = Boolean(
    selectedTransaction &&
    selectedTxnStatus === 'pending' &&
    (selectedTxnIsBuyer || selectedTxnIsSeller),
  );
  const selectedTxnSteps = useMemo(
    () => getTransactionSteps(selectedTransaction),
    [selectedTransaction],
  );
  const selectedTxnProgressPercent = useMemo(
    () => getTransactionProgressPercent(selectedTransaction),
    [selectedTransaction],
  );
  const selectedTxnWaitingParty = useMemo(
    () => getTransactionWaitingParty(selectedTransaction, user?.id),
    [selectedTransaction, user?.id],
  );
  const selectedTxnMeta = asObject(selectedTransaction?.transaction_meta);
  const selectedTxnTicket = asObject(selectedTxnMeta.ticket);
  const selectedTxnDelivery = parseTransactionDelivery(
    selectedTransaction?.transaction_meta,
  );
  const selectedTxnLatestDelivery = getLatestDeliverySubmission(
    selectedTransaction?.transaction_meta,
  );
  const selectedTxnSide = selectedTransaction
    ? resolveListingSide({
        type:
          selectedTransaction.deal_kind ??
          selectedTransaction.snapshot_listing?.content_type,
        metadata: selectedTxnMeta,
        title: selectedTransaction.snapshot_listing?.title,
      })
    : 'supply';
  const selectedTxnSideLabel = getListingSideContextLabel(
    selectedTxnSide,
    selectedTransaction?.deal_kind ??
      selectedTransaction?.snapshot_listing?.content_type,
    chatLocale,
  );
  const canListingActionDirect = Boolean(
    listingActionDraft &&
    listingActionDraft.listingSide === 'supply' &&
    listingActionDraft.pricingMode === 'fixed',
  );
  const canListingActionAskPrice = Boolean(
    listingActionDraft &&
    listingActionDraft.listingSide === 'supply' &&
    listingActionDraft.pricingMode === 'request',
  );
  const isListingActionAmountLocked = Boolean(
    listingActionDraft &&
    listingActionMode === 'direct' &&
    canListingActionDirect &&
    listingActionDraft.amountCents > 0,
  );
  const listingActionHeading = !listingActionDraft
    ? ''
    : chatLocale === 'id'
      ? listingActionDraft.listingSide === 'demand'
        ? 'Susun respons'
        : canListingActionDirect
          ? 'Pilih respons deal'
          : 'Siapkan respons chat'
      : listingActionDraft.listingSide === 'demand'
        ? 'Prepare response'
        : canListingActionDirect
          ? 'Choose deal path'
          : 'Prepare chat response';
  const listingActionHint = !listingActionDraft
    ? ''
    : chatLocale === 'id'
      ? listingActionDraft.listingSide === 'demand'
        ? 'Balasan ini akan dikirim sebagai tiket terstruktur agar nominal, scope, dan tindak lanjut terbaca jelas.'
        : canListingActionDirect
          ? 'Satu modal untuk pilih lanjut langsung atau negosiasi dulu. Detailnya tetap dikirim ke chat sebagai tiket.'
          : 'Harga belum fix. Pakai modal ini untuk kirim budget atau mulai tanya detail lewat chat.'
      : listingActionDraft.listingSide === 'demand'
        ? 'This reply will be sent as a structured ticket so amount, scope, and next steps stay clear.'
        : canListingActionDirect
          ? 'Use one modal to proceed directly or negotiate first. The result is still sent to chat as a structured ticket.'
          : 'The price is not fixed yet. Use this modal to send your budget or ask for details in chat.';
  const listingActionAmountLabel = !listingActionDraft
    ? ''
    : listingActionDraft.listingSide === 'demand'
      ? chatLocale === 'id'
        ? `Nominal respons (${listingActionDraft.currency})`
        : `Response amount (${listingActionDraft.currency})`
      : listingActionMode === 'direct'
        ? chatLocale === 'id'
          ? `Nominal deal (${listingActionDraft.currency})`
          : `Deal amount (${listingActionDraft.currency})`
        : chatLocale === 'id'
          ? `Nominal offer (${listingActionDraft.currency})`
          : `Offer amount (${listingActionDraft.currency})`;
  const listingActionAmountPlaceholder = !listingActionDraft
    ? ''
    : listingActionMode === 'direct'
      ? chatLocale === 'id'
        ? 'Mengikuti harga listing'
        : 'Follows the listed price'
      : chatLocale === 'id'
        ? 'Masukkan nominal'
        : 'Enter amount';
  const structuredDraftPayload = aiStructuredDraft
    ? buildAiRoomCreatePayload(aiStructuredDraft)
    : null;
  const structuredDraftPublishValidation = structuredDraftPayload
    ? validateListingPayload(
        {
          ...structuredDraftPayload,
          content_status: 'active',
        },
        {
          mode: 'create',
          strictActiveValidation: true,
        },
      )
    : null;
  const structuredDraftPublishIssues =
    structuredDraftPublishValidation && !structuredDraftPublishValidation.ok
      ? structuredDraftPublishValidation.issues
      : [];

  // Gates
  if (authLoading) {
    return <ChatDetailSkeleton />;
  }

  if (!user) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[color:var(--app-surface)]">
        <p className="text-[color:var(--app-text-soft)]">
          {chatLocale === 'id'
            ? 'Masuk dulu untuk buka chat.'
            : 'Please login to access chat'}
        </p>
      </div>
    );
  }

  const composerOffset = isMobileViewport ? keyboardOffset : 0;
  const messageListPadding =
    isMobileViewport && composerHeight > 0
      ? `calc(${composerHeight}px + ${composerOffset}px + env(safe-area-inset-bottom))`
      : undefined;
  const messageListSpacerHeight =
    isMobileViewport && composerHeight > 0
      ? `calc(${composerHeight}px + ${composerOffset}px + env(safe-area-inset-bottom))`
      : undefined;
  const composerStyle = isMobileViewport
    ? {
        transform: `translateY(-${composerOffset}px)`,
        paddingBottom: 'calc(8px + env(safe-area-inset-bottom))',
      }
    : undefined;

  if (!canonicalRoomId) {
    return (
      <div className="min-h-full flex flex-col items-center justify-center gap-4 bg-[color:var(--app-surface)] p-4">
        <p className="text-[color:var(--app-text-soft)]">Invalid chat room</p>
        <Link
          href="/chat"
          className="px-4 py-2 rounded-full bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] text-sm font-bold hover:bg-[color:var(--app-accent-strong)]"
        >
          Back to chats
        </Link>
      </div>
    );
  }

  if (roomAllowed === null) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[color:var(--app-surface)]">
        <div className="flex items-center gap-2 text-[color:var(--app-text-soft)]">
          <Loader2 className="h-5 w-5 animate-spin text-[color:var(--app-accent)]" />
          <span className="text-sm">
            {chatLocale === 'id' ? 'Membuka chat...' : 'Opening chat...'}
          </span>
        </div>
      </div>
    );
  }

  if (!isDraftRoom && roomAllowed === false) {
    return (
      <div className="min-h-full flex items-center justify-center bg-[color:var(--app-surface)] p-6">
        <div className="ui-feed-section w-full max-w-md rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-6 text-center">
          <AlertCircle className="mx-auto h-8 w-8 text-[color:var(--app-warning)]" />
          <h2 className="mt-3 text-base font-semibold text-[color:var(--app-text)]">
            {chatLocale === 'id' ? 'Chat tidak tersedia' : 'Chat not available'}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
            Room ini tidak ditemukan / kamu tidak punya akses. Buka chat dari
            list, bukan dari URL.
          </p>
          <Link
            href="/chat"
            className="mt-5 inline-flex items-center justify-center rounded-full bg-[color:var(--app-accent)] px-5 py-2 text-sm font-bold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
          >
            {chatLocale === 'id' ? 'Kembali ke chat' : 'Back to chats'}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex h-full min-h-0 w-full min-w-0 flex-col overflow-hidden overscroll-none bg-[#efeae2] dark:bg-[#0b141a]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom)',
        backgroundColor: 'transparent',
      }}
    >
      <header className="sticky top-0 z-40 border-b border-black/5 bg-[#f0f2f5]/95 pt-[env(safe-area-inset-top)] backdrop-blur dark:border-white/6 dark:bg-[#202c33]/95">
        <div className="flex min-w-0 items-center gap-3 px-3 py-2.5 sm:px-4 sm:py-3">
          {/* Mobile back */}
          <button
            onClick={() => router.push('/chat')}
            className="rounded-full p-2 text-[#54656f] transition hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/5 lg:hidden"
            aria-label={
              chatLocale === 'id' ? 'Kembali ke chat' : 'Back to chats'
            }
          >
            <ArrowLeft className="h-5 w-5" />
          </button>

          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#dfe5e7] text-sm font-semibold text-[#54656f] dark:bg-[#2a3942] dark:text-[#d1d7db] sm:h-11 sm:w-11">
            {roomInitial}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-[15px] font-medium text-[#111b21] dark:text-[#e9edef] sm:text-base">
                {roomName}
              </h1>
              {roomKind !== 'direct' ? (
                <span
                  className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                    roomKind === 'group'
                      ? 'bg-[#dfe5e7] text-[#54656f] dark:bg-[#2a3942] dark:text-[#aebac1]'
                      : 'bg-[#fff3cd] text-[#8a6d1d] dark:bg-[#3b2f12] dark:text-[#f6d87a]'
                  }`}
                >
                  {roomKind === 'group'
                    ? chatLocale === 'id'
                      ? 'Grup'
                      : 'Group'
                    : chatLocale === 'id'
                      ? 'Bantuan'
                      : 'Support'}
                </span>
              ) : null}
            </div>
            <div className="mt-0.5 flex items-center gap-2 text-[11px] text-[#667781] dark:text-[#8696a0] sm:text-xs">
              <span className={`h-2 w-2 rounded-full ${statusInfo.dotClass}`} />
              <span className="truncate">
                {typingUser
                  ? chatLocale === 'id'
                    ? `${typingUser} sedang mengetik...`
                    : `${typingUser} is typing...`
                  : statusInfo.subtext}
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1 sm:gap-1.5">
            <button
              onClick={() => setShowTransactionsDrawer(prev => !prev)}
              className="inline-flex h-10 min-w-10 items-center justify-center gap-1 rounded-full px-2.5 text-[11px] font-medium text-[#54656f] transition hover:bg-black/5 max-[340px]:hidden dark:text-[#aebac1] dark:hover:bg-white/5 sm:px-3"
              aria-label={
                chatLocale === 'id' ? 'Buka transaksi' : 'Open transactions'
              }
              title={chatLocale === 'id' ? 'Transaksi' : 'Transactions'}
            >
              <ReceiptText className="h-4 w-4" />
              <span className="hidden xl:inline">
                {chatLocale === 'id' ? 'Transaksi' : 'Transactions'}
              </span>
            </button>

            <button
              onClick={() => void startOutgoingCall('video')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 max-[340px]:hidden dark:text-[#aebac1] dark:hover:bg-white/5"
              aria-label="Start video call"
              disabled={
                !channelReady ||
                !channelRef.current ||
                showVideoCall ||
                showVoiceCall ||
                !!incomingCall
              }
              title={
                !channelReady
                  ? chatLocale === 'id'
                    ? 'Menghubungkan...'
                    : 'Connecting...'
                  : chatLocale === 'id'
                    ? 'Panggilan video'
                    : 'Video call'
              }
            >
              <Video className="h-5 w-5" />
            </button>

            <button
              onClick={() => void startOutgoingCall('voice')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-50 max-[340px]:hidden dark:text-[#aebac1] dark:hover:bg-white/5"
              aria-label="Start voice call"
              disabled={
                !channelReady ||
                !channelRef.current ||
                showVideoCall ||
                showVoiceCall ||
                !!incomingCall
              }
              title={
                !channelReady
                  ? chatLocale === 'id'
                    ? 'Menghubungkan...'
                    : 'Connecting...'
                  : chatLocale === 'id'
                    ? 'Panggilan suara'
                    : 'Voice call'
              }
            >
              <Phone className="h-5 w-5" />
            </button>

            <button
              type="button"
              onClick={() => setShowChatSettings(true)}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/5"
              aria-label={
                chatLocale === 'id' ? 'Pengaturan chat' : 'Chat settings'
              }
              title={chatLocale === 'id' ? 'Pengaturan chat' : 'Chat settings'}
            >
              <MoreVertical className="h-5 w-5" />
            </button>
          </div>
        </div>
      </header>

      {roomSummaryTransaction ? (
        <div className="border-b border-black/5 bg-[#f7f5f3]/85 px-3 py-2.5 dark:border-white/6 dark:bg-[#162028]/85 sm:px-4">
          <div className="mx-auto w-full max-w-[920px]">
            <div className="rounded-[20px] border border-black/5 bg-white/85 px-4 py-3 shadow-[0_10px_24px_-24px_rgba(17,27,33,0.45)] backdrop-blur dark:border-white/8 dark:bg-[#202c33]/88">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[#25d366]">
                    {chatLocale === 'id'
                      ? 'Ringkasan transaksi'
                      : 'Transaction summary'}
                  </p>
                  <h2 className="mt-1 truncate text-sm font-semibold text-[#111b21] dark:text-[#e9edef] sm:text-base">
                    {roomSummaryTxnTitle}
                  </h2>
                  <p className="mt-1 text-xs text-[#667781] dark:text-[#8696a0]">
                    {roomSummaryTxnWaitingParty}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setShowTransactionsDrawer(true);
                      setSelectedTransaction(roomSummaryTransaction);
                    }}
                    className="inline-flex min-h-[38px] items-center justify-center rounded-full bg-[#f0f2f5] px-4 text-sm font-medium text-[#111b21] transition hover:bg-[#e9edef] dark:bg-[#111b21] dark:text-[#dfe7ea] dark:hover:bg-[#1a252c]"
                  >
                    {chatLocale === 'id'
                      ? 'Lihat transaksi'
                      : 'Open transaction'}
                  </button>
                  {roomSummaryTxnShouldPay ? (
                    <button
                      type="button"
                      onClick={() =>
                        openPaymentForTransaction({
                          id: roomSummaryTransaction.id,
                          amount_cents: roomSummaryTransaction.amount_cents,
                          currency: roomSummaryTransaction.currency,
                        })
                      }
                      className="inline-flex min-h-[38px] items-center justify-center gap-2 rounded-full bg-[#25d366] px-4 text-sm font-semibold text-[#111b21] shadow-[0_18px_32px_-24px_rgba(37,211,102,0.55)] transition hover:bg-[#22c55e]"
                    >
                      <Wallet className="h-4 w-4" />
                      {chatLocale === 'id' ? 'Bayar sekarang' : 'Pay now'}
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-3 grid gap-2 sm:grid-cols-4">
                <div className="rounded-[16px] bg-[#f7f5f3] px-3 py-2.5 dark:bg-[#111b21]">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#667781] dark:text-[#8696a0]">
                    {chatLocale === 'id' ? 'Nominal' : 'Amount'}
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[#128c7e] dark:text-[#25d366]">
                    {formatMoney(
                      roomSummaryTransaction.amount_cents,
                      roomSummaryTransaction.currency,
                    )}
                  </p>
                </div>
                <div className="rounded-[16px] bg-[#f7f5f3] px-3 py-2.5 dark:bg-[#111b21]">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#667781] dark:text-[#8696a0]">
                    {chatLocale === 'id' ? 'Status' : 'Status'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#111b21] dark:text-[#dfe7ea]">
                    {humanizeStatus(roomSummaryTxnStatus)}
                  </p>
                </div>
                <div className="rounded-[16px] bg-[#f7f5f3] px-3 py-2.5 dark:bg-[#111b21]">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#667781] dark:text-[#8696a0]">
                    {chatLocale === 'id' ? 'Pembayaran' : 'Payment'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#111b21] dark:text-[#dfe7ea]">
                    {humanizeStatus(roomSummaryTxnPaymentStatus)}
                  </p>
                </div>
                <div className="rounded-[16px] bg-[#f7f5f3] px-3 py-2.5 dark:bg-[#111b21]">
                  <p className="text-[10px] uppercase tracking-[0.16em] text-[#667781] dark:text-[#8696a0]">
                    {chatLocale === 'id' ? 'Progress' : 'Progress'}
                  </p>
                  <p className="mt-1 text-sm font-medium text-[#111b21] dark:text-[#dfe7ea]">
                    {roomSummaryTxnProgress}%
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Messages */}
      <main className="flex-1 min-w-0 overflow-hidden bg-[#efeae2] dark:bg-[#0b141a]">
        <div className="relative h-full">
          <div
            className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-35"
            style={{
              backgroundImage:
                'radial-gradient(rgba(17,27,33,0.045) 1px, transparent 1px), radial-gradient(rgba(17,27,33,0.02) 1px, transparent 1px)',
              backgroundPosition: '0 0, 12px 12px',
              backgroundSize: '24px 24px',
            }}
          />
          <div
            className="relative h-full min-w-0 overflow-x-hidden overflow-y-auto overscroll-contain px-2 py-3 sm:px-5 sm:py-4"
            style={
              messageListPadding
                ? { paddingBottom: messageListPadding }
                : undefined
            }
          >
            <div className="mx-auto flex w-full max-w-[920px] flex-col space-y-1.5">
              {loading ? (
                <div className="flex justify-center py-20">
                  <Loader2 className="h-6 w-6 animate-spin text-[#25d366]" />
                </div>
              ) : loadError ? (
                <div className="flex flex-col items-center justify-center gap-4 rounded-[24px] border border-[#f4c7ae] bg-white/80 p-6 text-center shadow-sm dark:border-[#6b4f3b] dark:bg-[#202c33]/88">
                  <AlertCircle className="h-6 w-6 text-[#ff8a65]" />
                  <p className="text-sm text-[#c65b3d] dark:text-[#ffb199]">
                    {loadError}
                  </p>
                  <button
                    type="button"
                    onClick={() => loadMessages()}
                    className="rounded-full bg-[#25d366] px-5 py-2 text-sm font-medium text-[#111b21] shadow-sm transition hover:bg-[#22c55e]"
                  >
                    {chatLocale === 'id' ? 'Coba lagi' : 'Retry'}
                  </button>
                </div>
              ) : messages.length === 0 ? (
                <div className="rounded-[26px] border border-white/60 bg-white/70 p-10 text-center shadow-[0_18px_36px_-28px_rgba(17,27,33,0.35)] backdrop-blur dark:border-white/10 dark:bg-[#202c33]/80">
                  <MessageSquareText className="mx-auto mb-3 h-8 w-8 text-[#25d366]" />
                  <p className="font-medium text-[#54656f] dark:text-[#dfe7ea]">
                    {chatLocale === 'id' ? 'Belum ada chat' : 'No messages yet'}
                  </p>
                  <p className="text-sm text-[#667781] dark:text-[#8696a0]">
                    {chatLocale === 'id'
                      ? 'Mulai saja dengan pesan singkat seperti di WhatsApp.'
                      : 'Start the conversation with a friendly hello.'}
                  </p>
                </div>
              ) : (
                timelineItems.map(item => {
                  if (item.type === 'day') {
                    return (
                      <div
                        key={item.id}
                        className="sticky top-2 z-10 flex justify-center py-1"
                      >
                        <span className="rounded-full border border-black/5 bg-[#e9edef]/92 px-3 py-1 text-[10px] font-medium text-[#54656f] shadow-sm backdrop-blur dark:border-white/8 dark:bg-[#202c33]/92 dark:text-[#aebac1]">
                          {item.label}
                        </span>
                      </div>
                    );
                  }

                  const msg = item.message;
                  const isOwn = msg.sender_id === user?.id;
                  const status = msg.status ?? 'sent';
                  const meta = parseStructuredAttachment(msg.attachments?.[0]);
                  const ticketMeta = asObject(meta?.ticket);
                  const applicantMeta = asObject(meta?.applicant);
                  const listingSnapshot = asObject(meta?.snapshot_listing);
                  const structuredSide = resolveListingSide({
                    type:
                      meta?.content_type ??
                      meta?.deal_kind ??
                      listingSnapshot.content_type,
                    metadata: meta || listingSnapshot,
                    title: meta?.content_title ?? listingSnapshot.title,
                    summary: meta?.summary,
                  });
                  const structuredSideLabel = getListingSideLabel(
                    structuredSide,
                    chatLocale,
                  );
                  const structuredSideContext = getListingSideContextLabel(
                    structuredSide,
                    meta?.content_type ??
                      meta?.deal_kind ??
                      listingSnapshot.content_type,
                    chatLocale,
                  );
                  const structuredContentUrl =
                    typeof meta?.content_url === 'string' &&
                    meta.content_url.trim()
                      ? meta.content_url
                      : typeof listingSnapshot.content_url === 'string' &&
                          listingSnapshot.content_url.trim()
                        ? String(listingSnapshot.content_url)
                        : typeof meta?.content_id === 'string' &&
                            meta.content_id.trim()
                          ? buildContentHref(
                              String(meta.content_id),
                              String(
                                meta?.content_title ||
                                  listingSnapshot.title ||
                                  'Listing',
                              ),
                              typeof listingSnapshot.slug === 'string'
                                ? listingSnapshot.slug
                                : '',
                            )
                          : '';
                  const isAiRoomDraftCard =
                    msg.message_type === 'listing' &&
                    typeof meta?.source === 'string' &&
                    meta.source.trim() === 'ai_room_draft';
                  const structuredDraftId =
                    typeof meta?.draft_id === 'string' && meta.draft_id.trim()
                      ? meta.draft_id.trim()
                      : typeof meta?.content_id === 'string' &&
                          meta.content_id.trim()
                        ? meta.content_id.trim()
                        : '';
                  const structuredDraftStatus =
                    typeof meta?.content_status === 'string' &&
                    meta.content_status.trim()
                      ? meta.content_status.trim().toLowerCase()
                      : 'draft';
                  const structuredDraftPublishIssues = Array.isArray(
                    meta?.publish_issues,
                  )
                    ? meta.publish_issues
                        .map(item => String(item).trim())
                        .filter(Boolean)
                    : [];
                  const structuredDraftReviewNotes = Array.isArray(
                    meta?.review_notes,
                  )
                    ? meta.review_notes
                        .map(item => String(item).trim())
                        .filter(Boolean)
                    : [];
                  const structuredDraftAssumptions = Array.isArray(
                    meta?.assumptions,
                  )
                    ? meta.assumptions
                        .map(item => String(item).trim())
                        .filter(Boolean)
                    : [];
                  const structuredDraftFollowUpQuestions = Array.isArray(
                    meta?.follow_up_questions,
                  )
                    ? meta.follow_up_questions
                        .map(item => String(item).trim())
                        .filter(Boolean)
                    : [];
                  const structuredDraftEditHref = structuredDraftId
                    ? `${buildCreatePath({
                        locale: chatLocale,
                        side: structuredSide,
                        type:
                          typeof meta?.content_type === 'string'
                            ? meta.content_type
                            : 'service',
                      })}?draft=${encodeURIComponent(structuredDraftId)}`
                    : '';
                  const transactionCardTxn =
                    msg.message_type === 'transaction'
                      ? (() => {
                          const fallback =
                            toRoomTransactionFromStructuredPayload(meta);
                          if (!fallback) return null;
                          return (
                            roomTransactionsById.get(fallback.id) || fallback
                          );
                        })()
                      : null;
                  const transactionCardMeta =
                    msg.message_type === 'transaction' && transactionCardTxn
                      ? ({
                          ...meta,
                          ...transactionCardTxn,
                          transaction_id: transactionCardTxn.id,
                          status:
                            transactionCardTxn.status ||
                            transactionCardTxn.transaction_status ||
                            meta?.status,
                          transaction_status:
                            transactionCardTxn.transaction_status ||
                            transactionCardTxn.status ||
                            meta?.transaction_status,
                          protection_status:
                            transactionCardTxn.protection_status ||
                            meta?.protection_status,
                          snapshot_listing:
                            transactionCardTxn.snapshot_listing ||
                            meta?.snapshot_listing,
                          transaction_meta:
                            transactionCardTxn.transaction_meta ||
                            meta?.transaction_meta,
                          response_message:
                            transactionCardTxn.response_message ||
                            meta?.response_message,
                          offer_message:
                            transactionCardTxn.offer_message ||
                            meta?.offer_message,
                          buyer_id:
                            transactionCardTxn.buyer_id || meta?.buyer_id,
                          seller_id:
                            transactionCardTxn.seller_id || meta?.seller_id,
                          content_id:
                            transactionCardTxn.content_id || meta?.content_id,
                          amount_cents:
                            transactionCardTxn.amount_cents ??
                            meta?.amount_cents,
                          currency:
                            transactionCardTxn.currency || meta?.currency,
                          deal_kind:
                            transactionCardTxn.deal_kind || meta?.deal_kind,
                          fulfillment_mode:
                            transactionCardTxn.fulfillment_mode ||
                            meta?.fulfillment_mode,
                        } as StructuredChatPayload)
                      : meta;
                  const transactionCardId =
                    transactionCardTxn?.id ||
                    (typeof meta?.transaction_id === 'string'
                      ? meta.transaction_id.trim()
                      : '');
                  const transactionCardStatus = transactionCardTxn
                    ? normalizeTransactionStatus(
                        transactionCardTxn.status ||
                          transactionCardTxn.transaction_status,
                      )
                    : normalizeTransactionStatus(
                        meta?.status || meta?.transaction_status,
                      );
                  const transactionCardPaymentStatus =
                    resolveTransactionPaymentStatus(transactionCardTxn);
                  const transactionCardListingSnapshot = asObject(
                    transactionCardMeta?.snapshot_listing,
                  );
                  const transactionCardCoverImage = normalizeAttachmentUrl(
                    transactionCardListingSnapshot.cover_image,
                  );
                  const transactionCardTitle =
                    typeof transactionCardListingSnapshot.title === 'string' &&
                    transactionCardListingSnapshot.title.trim()
                      ? String(transactionCardListingSnapshot.title)
                      : typeof transactionCardMeta?.content_title ===
                            'string' && transactionCardMeta.content_title.trim()
                        ? transactionCardMeta.content_title
                        : 'Item';
                  const transactionCardNextStep = transactionCardTxn
                    ? getTransactionWaitingParty(transactionCardTxn, user?.id)
                    : typeof ticketMeta.next_step === 'string' &&
                        ticketMeta.next_step.trim()
                      ? String(ticketMeta.next_step)
                      : '';
                  const transactionCardProgress =
                    getTransactionProgressPercent(transactionCardTxn);
                  const transactionCardShortId =
                    formatShortTransactionId(transactionCardId);
                  const transactionCardWalletLabel =
                    resolveTransactionWalletLabel(
                      transactionCardTxn,
                      chatLocale,
                    );
                  const transactionShouldShowPay =
                    canUserOpenTransactionPayment(transactionCardTxn, user?.id);
                  const isStructured =
                    msg.message_type === 'offer' ||
                    msg.message_type === 'application' ||
                    msg.message_type === 'listing' ||
                    msg.message_type === 'transaction' ||
                    msg.message_type === 'job_update';

                  const bubbleClass = `relative max-w-[86%] overflow-visible rounded-[18px] px-2.5 py-2 text-[13px] leading-[1.45] break-words whitespace-pre-wrap sm:max-w-[72%] sm:px-3 sm:py-2.5 sm:text-sm ${
                    isOwn
                      ? 'rounded-br-[6px] bg-[#d9fdd3] text-[#111b21] shadow-[0_1px_1px_rgba(17,27,33,0.16)] dark:bg-[#005c4b] dark:text-[#e9edef]'
                      : 'rounded-bl-[6px] bg-white text-[#111b21] shadow-[0_1px_1px_rgba(17,27,33,0.16)] dark:bg-[#202c33] dark:text-[#e9edef]'
                  }`;
                  const bubbleTailClass = `absolute bottom-1 h-3 w-3 rotate-45 ${
                    isOwn
                      ? 'right-[-4px] rounded-bl-[2px] bg-[#d9fdd3] dark:bg-[#005c4b]'
                      : 'left-[-4px] rounded-br-[2px] bg-white dark:bg-[#202c33]'
                  }`;
                  const bubbleMetaClass = isOwn
                    ? 'text-[#667781] dark:text-[#d1f4cc]'
                    : 'text-[#667781] dark:text-[#8696a0]';

                  return (
                    <motion.div
                      key={msg.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`flex px-1 ${isOwn ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={bubbleClass}>
                        <span aria-hidden="true" className={bubbleTailClass} />
                        <div className="relative z-10">
                        {/* Structured business messages */}
                        {isStructured ? (
                          <div className="space-y-2">
                            <div
                              className={`inline-flex rounded-full px-2 py-1 text-[10px] font-bold uppercase tracking-wide ${isOwn ? 'bg-[color:color-mix(in_srgb,_var(--app-overlay)_25%,_transparent)] text-[color:var(--app-accent)]' : 'bg-[color:var(--app-surface)] text-[color:var(--app-accent)]'}`}
                            >
                              {msg.message_type === 'offer' &&
                                (chatLocale === 'id' ? 'Offer' : 'Offer')}
                              {msg.message_type === 'application' &&
                                (chatLocale === 'id'
                                  ? 'Lamaran'
                                  : 'Application')}
                              {msg.message_type === 'listing' &&
                                (isAiRoomDraftCard
                                  ? chatLocale === 'id'
                                    ? 'Draft AI'
                                    : 'AI Draft'
                                  : chatLocale === 'id'
                                    ? 'Listing dibagikan'
                                    : 'Listing Shared')}
                              {msg.message_type === 'transaction' &&
                                (chatLocale === 'id'
                                  ? 'Update transaksi'
                                  : 'Transaction Update')}
                              {msg.message_type === 'job_update' &&
                                (chatLocale === 'id'
                                  ? 'Update kerja'
                                  : 'Job Update')}
                            </div>

                            {msg.message_type === 'offer' && (
                              <div
                                className={`rounded-xl border p-3 ${isOwn ? 'border-[color:color-mix(in_srgb,_var(--app-accent-border)_20%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-overlay)_20%,_transparent)]' : 'border-[color:var(--app-border-strong)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)]'}`}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                                  {chatLocale === 'id'
                                    ? 'Ringkasan offer'
                                    : 'Offer Summary'}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold opacity-80">
                                  {typeof ticketMeta.reference === 'string' &&
                                    ticketMeta.reference.trim() && (
                                      <span className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5">
                                        {ticketMeta.reference}
                                      </span>
                                    )}
                                  <span className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5">
                                    {structuredSideContext}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs font-semibold">
                                  {String(
                                    meta?.content_title ||
                                      (chatLocale === 'id'
                                        ? 'Offer baru'
                                        : 'New offer'),
                                  )}
                                </p>
                                <p className="mt-1 text-base font-black text-[color:var(--app-accent)]">
                                  {formatMoney(
                                    transactionCardMeta?.amount_cents,
                                    transactionCardMeta?.currency,
                                  )}
                                </p>
                                <p className="mt-1 text-[11px] opacity-80">
                                  {humanizeStatus(meta?.status)} •{' '}
                                  {String(meta?.deal_kind || 'deal')}
                                </p>
                                {typeof meta?.offer_message === 'string' &&
                                  meta.offer_message.trim() && (
                                    <p className="mt-2 rounded-lg bg-[color:color-mix(in_srgb,_var(--app-overlay)_20%,_transparent)] px-2 py-1.5 text-xs opacity-90">
                                      {meta.offer_message}
                                    </p>
                                  )}
                                {typeof ticketMeta.next_step === 'string' &&
                                  ticketMeta.next_step.trim() && (
                                    <p className="mt-2 text-[11px] opacity-80">
                                      {String(ticketMeta.next_step)}
                                    </p>
                                  )}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {typeof meta?.transaction_id === 'string' &&
                                    meta.transaction_id.trim() && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setShowTransactionsDrawer(true);
                                          void (async () => {
                                            const list =
                                              await loadRoomTransactions();
                                            const found = list.find(
                                              txn =>
                                                txn.id === meta.transaction_id,
                                            );
                                            if (found)
                                              setSelectedTransaction(found);
                                          })();
                                        }}
                                        className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-border-strong)]"
                                      >
                                        {chatLocale === 'id'
                                          ? 'Buka transaksi'
                                          : 'Open Ticket'}
                                      </button>
                                    )}
                                  {structuredContentUrl && (
                                    <Link
                                      href={structuredContentUrl}
                                      className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-accent)] hover:bg-[color:color-mix(in_srgb,_var(--app-accent)_30%,_transparent)]"
                                    >
                                      {chatLocale === 'id'
                                        ? 'Buka listing'
                                        : 'Open Listing'}
                                    </Link>
                                  )}
                                </div>
                              </div>
                            )}

                            {msg.message_type === 'application' && (
                              <div
                                className={`rounded-xl border p-3 ${isOwn ? 'border-[color:color-mix(in_srgb,_var(--app-accent-border)_20%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-overlay)_20%,_transparent)]' : 'border-[color:var(--app-border-strong)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)]'}`}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                                  {chatLocale === 'id'
                                    ? 'Profil pelamar'
                                    : 'Applicant Profile'}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold opacity-80">
                                  {typeof ticketMeta.reference === 'string' &&
                                    ticketMeta.reference.trim() && (
                                      <span className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5">
                                        {ticketMeta.reference}
                                      </span>
                                    )}
                                  <span className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5">
                                    {structuredSideContext}
                                  </span>
                                </div>
                                <p className="mt-1 text-xs font-semibold">
                                  {String(
                                    meta?.content_title ||
                                      (chatLocale === 'id'
                                        ? 'Lamaran kerja'
                                        : 'Job application'),
                                  )}
                                </p>
                                <p className="mt-1 text-xs opacity-95">
                                  {String(
                                    (applicantMeta.full_name as string) ||
                                      (applicantMeta.email as string) ||
                                      'Applicant submitted',
                                  )}
                                </p>
                                {typeof applicantMeta.headline === 'string' && (
                                  <p className="mt-1 text-[11px] opacity-80">
                                    {String(applicantMeta.headline)}
                                  </p>
                                )}
                                <div className="mt-2 grid gap-2 text-[11px] opacity-90 sm:grid-cols-2">
                                  {typeof applicantMeta.location === 'string' &&
                                    applicantMeta.location.trim() && (
                                      <div className="rounded-lg bg-[color:color-mix(in_srgb,_var(--app-overlay)_12%,_transparent)] px-2 py-1.5">
                                        <p className="font-semibold opacity-75">
                                          Location
                                        </p>
                                        <p>{String(applicantMeta.location)}</p>
                                      </div>
                                    )}
                                  {typeof applicantMeta.years_exp ===
                                    'string' &&
                                    applicantMeta.years_exp.trim() && (
                                      <div className="rounded-lg bg-[color:color-mix(in_srgb,_var(--app-overlay)_12%,_transparent)] px-2 py-1.5">
                                        <p className="font-semibold opacity-75">
                                          Experience
                                        </p>
                                        <p>
                                          {String(applicantMeta.years_exp)}{' '}
                                          years
                                        </p>
                                      </div>
                                    )}
                                  {(typeof applicantMeta.expected_salary_cents ===
                                    'number' ||
                                    typeof applicantMeta.expected_salary_cents ===
                                      'string') && (
                                    <div className="rounded-lg bg-[color:color-mix(in_srgb,_var(--app-overlay)_12%,_transparent)] px-2 py-1.5">
                                      <p className="font-semibold opacity-75">
                                        Expectation
                                      </p>
                                      <p>
                                        {formatMoney(
                                          applicantMeta.expected_salary_cents,
                                          meta?.currency || 'IDR',
                                        )}
                                      </p>
                                    </div>
                                  )}
                                  {typeof applicantMeta.phone === 'string' &&
                                    applicantMeta.phone.trim() && (
                                      <div className="rounded-lg bg-[color:color-mix(in_srgb,_var(--app-overlay)_12%,_transparent)] px-2 py-1.5">
                                        <p className="font-semibold opacity-75">
                                          Phone
                                        </p>
                                        <p>{String(applicantMeta.phone)}</p>
                                      </div>
                                    )}
                                </div>
                                {typeof applicantMeta.message === 'string' &&
                                  applicantMeta.message.trim() && (
                                    <p className="mt-2 rounded-lg bg-[color:color-mix(in_srgb,_var(--app-overlay)_20%,_transparent)] px-2 py-1.5 text-xs opacity-90">
                                      {String(applicantMeta.message)}
                                    </p>
                                  )}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  {typeof applicantMeta.resume_url ===
                                    'string' &&
                                    applicantMeta.resume_url.trim() && (
                                      <a
                                        href={normalizeAttachmentUrl(
                                          String(applicantMeta.resume_url),
                                        )}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-border-strong)]"
                                      >
                                        {chatLocale === 'id'
                                          ? 'Lihat CV'
                                          : 'View Resume'}
                                      </a>
                                    )}
                                  {structuredContentUrl && (
                                    <Link
                                      href={structuredContentUrl}
                                      className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-accent)] hover:bg-[color:color-mix(in_srgb,_var(--app-accent)_30%,_transparent)]"
                                    >
                                      {chatLocale === 'id'
                                        ? 'Buka listing'
                                        : 'Open Listing'}
                                    </Link>
                                  )}
                                </div>
                              </div>
                            )}

                            {msg.message_type === 'listing' && (
                              <div
                                className={`rounded-xl border p-3 ${isOwn ? 'border-[color:color-mix(in_srgb,_var(--app-accent-border)_20%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-overlay)_20%,_transparent)]' : 'border-[color:var(--app-border-strong)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)]'}`}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                                  {isAiRoomDraftCard
                                    ? chatLocale === 'id'
                                      ? 'Review draft AI'
                                      : 'AI Draft Review'
                                    : chatLocale === 'id'
                                      ? 'Listing dibagikan'
                                      : 'Shared Listing'}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold opacity-80">
                                  <span className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5">
                                    {structuredSideLabel}
                                  </span>
                                  <span className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5">
                                    {structuredSideContext}
                                  </span>
                                  {isAiRoomDraftCard && (
                                    <span
                                      className={`rounded-full border px-2 py-0.5 ${
                                        structuredDraftStatus === 'active'
                                          ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,_var(--app-accent)_18%,_transparent)] text-[color:var(--app-accent)]'
                                          : structuredDraftPublishIssues.length ===
                                              0
                                            ? 'border-[color:var(--app-info-border)] bg-[color:color-mix(in_srgb,_var(--app-info)_14%,_transparent)] text-[color:var(--app-info)]'
                                            : 'border-[color:var(--app-warning-border)] bg-[color:color-mix(in_srgb,_var(--app-warning)_14%,_transparent)] text-[color:var(--app-warning)]'
                                      }`}
                                    >
                                      {structuredDraftStatus === 'active'
                                        ? chatLocale === 'id'
                                          ? 'Sudah aktif'
                                          : 'Published'
                                        : structuredDraftPublishIssues.length ===
                                            0
                                          ? chatLocale === 'id'
                                            ? 'Siap publish'
                                            : 'Ready to publish'
                                          : chatLocale === 'id'
                                            ? 'Perlu review'
                                            : 'Needs review'}
                                    </span>
                                  )}
                                </div>
                                {typeof meta?.cover_image === 'string' &&
                                  meta.cover_image.trim() && (
                                    <img
                                      src={normalizeAttachmentUrl(
                                        meta.cover_image,
                                      )}
                                      alt={String(
                                        meta?.content_title || 'Listing',
                                      )}
                                      className="mt-2 h-28 w-full rounded-lg object-cover"
                                      loading="lazy"
                                    />
                                  )}
                                <p className="mt-2 text-xs font-semibold">
                                  {String(meta?.content_title || 'Listing')}
                                </p>
                                <p className="mt-1 text-[11px] opacity-80">
                                  {String(meta?.content_type || 'content')}{' '}
                                  {meta?.location
                                    ? `• ${String(meta.location)}`
                                    : ''}
                                </p>
                                <div className="mt-1 flex items-end gap-1.5">
                                  <p className="text-base font-black text-[color:var(--app-accent)]">
                                    {inferPricingMode(meta || {}) === 'request'
                                      ? 'Price on request'
                                      : formatMoney(
                                          meta?.price_cents,
                                          meta?.currency,
                                        )}
                                  </p>
                                  {inferPricingMode(meta || {}) === 'fixed' &&
                                    parseMoneyCents(
                                      meta?.original_price_cents,
                                    ) > parseMoneyCents(meta?.price_cents) && (
                                      <span className="text-[11px] line-through opacity-70">
                                        {formatMoney(
                                          meta?.original_price_cents,
                                          meta?.currency,
                                        )}
                                      </span>
                                    )}
                                </div>
                                <div className="mt-1 flex flex-wrap gap-1.5">
                                  {typeof meta?.promo_label === 'string' &&
                                    meta.promo_label.trim() && (
                                      <span className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-danger)_20%,_transparent)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-danger)]">
                                        {meta.promo_label}
                                      </span>
                                    )}
                                  <span className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-accent)]">
                                    <BadgeCheck className="mr-1 inline h-3 w-3" />
                                    {getTrustBadge(meta || {})}
                                  </span>
                                </div>
                                {isAiRoomDraftCard &&
                                  structuredDraftReviewNotes.length > 0 && (
                                    <div className="mt-2 rounded-xl bg-[color:color-mix(in_srgb,_var(--app-overlay)_18%,_transparent)] px-3 py-2 text-[11px] opacity-90">
                                      <p className="font-semibold">
                                        {chatLocale === 'id'
                                          ? 'Yang wajib dicek'
                                          : 'Review before posting'}
                                      </p>
                                      <ul className="mt-1 space-y-1">
                                        {structuredDraftReviewNotes
                                          .slice(0, 3)
                                          .map(note => (
                                            <li key={`${msg.id}-${note}`}>
                                              - {note}
                                            </li>
                                          ))}
                                      </ul>
                                    </div>
                                  )}
                                {isAiRoomDraftCard &&
                                  structuredDraftAssumptions.length > 0 && (
                                    <div className="mt-2 rounded-xl bg-[color:color-mix(in_srgb,_var(--app-overlay)_14%,_transparent)] px-3 py-2 text-[11px] opacity-85">
                                      <p className="font-semibold">
                                        {chatLocale === 'id'
                                          ? 'Asumsi AI'
                                          : 'AI assumptions'}
                                      </p>
                                      <p className="mt-1">
                                        {structuredDraftAssumptions
                                          .slice(0, 2)
                                          .join(' | ')}
                                      </p>
                                    </div>
                                  )}
                                {isAiRoomDraftCard &&
                                  structuredDraftFollowUpQuestions.length >
                                    0 && (
                                    <div className="mt-2 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-info-border)_38%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] px-3 py-2 text-[11px] text-[color:var(--app-text)]">
                                      <p className="font-semibold">
                                        {chatLocale === 'id'
                                          ? 'AI masih butuh detail ini'
                                          : 'The AI still needs these details'}
                                      </p>
                                      <ul className="mt-1 space-y-1">
                                        {structuredDraftFollowUpQuestions
                                          .slice(0, 3)
                                          .map(question => (
                                            <li key={`${msg.id}-${question}`}>
                                              - {question}
                                            </li>
                                          ))}
                                      </ul>
                                    </div>
                                  )}
                                {isAiRoomDraftCard &&
                                  structuredDraftPublishIssues.length > 0 && (
                                    <div className="mt-2 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-warning-border)_42%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-warning)_10%,_transparent)] px-3 py-2 text-[11px] text-[color:var(--app-warning)]">
                                      <p className="font-semibold">
                                        {chatLocale === 'id'
                                          ? 'Masih perlu dirapikan'
                                          : 'Still needs work'}
                                      </p>
                                      <p className="mt-1">
                                        {formatValidationIssues(
                                          structuredDraftPublishIssues,
                                          chatLocale,
                                        )}
                                      </p>
                                    </div>
                                  )}
                                {isOwn && isAiRoomDraftCard && (
                                  <div className="mt-2 flex flex-wrap gap-1.5">
                                    {structuredDraftEditHref && (
                                      <Link
                                        href={structuredDraftEditHref}
                                        className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-border-strong)]"
                                      >
                                        {chatLocale === 'id'
                                          ? 'Edit draft'
                                          : 'Edit draft'}
                                      </Link>
                                    )}
                                    {structuredDraftId &&
                                      structuredDraftStatus !== 'active' && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            void handlePublishStructuredDraft(
                                              msg.id,
                                              meta,
                                            )
                                          }
                                          disabled={
                                            publishingDraftId ===
                                            structuredDraftId
                                          }
                                          className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-accent)] hover:bg-[color:color-mix(in_srgb,_var(--app-accent)_30%,_transparent)] disabled:opacity-60"
                                        >
                                          {publishingDraftId ===
                                          structuredDraftId ? (
                                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                          ) : null}
                                          {chatLocale === 'id'
                                            ? 'Publish sekarang'
                                            : 'Publish now'}
                                        </button>
                                      )}
                                    {(structuredDraftStatus === 'active'
                                      ? structuredContentUrl
                                      : structuredDraftEditHref) && (
                                      <Link
                                        href={
                                          structuredDraftStatus === 'active'
                                            ? structuredContentUrl
                                            : structuredDraftEditHref
                                        }
                                        className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_18%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_28%,_transparent)]"
                                      >
                                        {structuredDraftStatus === 'active'
                                          ? chatLocale === 'id'
                                            ? 'Buka listing'
                                            : 'Open listing'
                                          : chatLocale === 'id'
                                            ? 'Lihat draft'
                                            : 'Open draft'}
                                      </Link>
                                    )}
                                  </div>
                                )}
                                {!isOwn &&
                                  typeof meta?.content_id === 'string' &&
                                  meta.content_id.trim() && (
                                    <div className="mt-2 flex flex-wrap gap-1.5">
                                      <button
                                        type="button"
                                        onClick={() =>
                                          openListingActionModal(
                                            meta,
                                            structuredSide === 'supply' &&
                                              inferPricingMode(meta || {}) ===
                                                'fixed'
                                              ? 'direct'
                                              : 'offer',
                                          )
                                        }
                                        className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-accent)] hover:bg-[color:color-mix(in_srgb,_var(--app-accent)_30%,_transparent)]"
                                      >
                                        {chatLocale === 'id'
                                          ? structuredSide === 'demand'
                                            ? 'Tanggapi Listing'
                                            : 'Pilih Respons'
                                          : structuredSide === 'demand'
                                            ? 'Respond'
                                            : 'Choose Action'}
                                      </button>
                                      {structuredContentUrl && (
                                        <Link
                                          href={structuredContentUrl}
                                          className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-border-strong)]"
                                        >
                                          {chatLocale === 'id'
                                            ? 'Buka listing'
                                            : 'Open Listing'}
                                        </Link>
                                      )}
                                    </div>
                                  )}
                              </div>
                            )}

                            {msg.message_type === 'transaction' && (
                              <div
                                className={`rounded-2xl border p-3 ${isOwn ? 'border-[color:color-mix(in_srgb,_var(--app-accent-border)_20%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-overlay)_20%,_transparent)]' : 'border-[color:var(--app-border-strong)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)]'}`}
                              >
                                <p className="text-[11px] font-semibold uppercase tracking-wide opacity-80">
                                  {chatLocale === 'id'
                                    ? 'Transaksi'
                                    : 'Transaction'}
                                </p>
                                <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[10px] font-semibold opacity-80">
                                  {typeof ticketMeta.reference === 'string' &&
                                    ticketMeta.reference.trim() && (
                                      <span className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5">
                                        {ticketMeta.reference}
                                      </span>
                                    )}
                                  <span className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5">
                                    {structuredSideContext}
                                  </span>
                                  <span className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5">
                                    {transactionCardWalletLabel}
                                  </span>
                                </div>
                                {transactionCardCoverImage && (
                                  <img
                                    src={transactionCardCoverImage}
                                    alt={transactionCardTitle}
                                    className="mt-2 h-20 w-full rounded-xl object-cover"
                                    loading="lazy"
                                  />
                                )}
                                <div className="mt-2 flex items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <p className="truncate text-xs font-semibold">
                                      {transactionCardTitle}
                                    </p>
                                    <p className="mt-1 text-[11px] opacity-80">
                                      {transactionCardShortId}
                                    </p>
                                  </div>
                                  <p className="shrink-0 text-base font-black text-[color:var(--app-accent)]">
                                    {formatMoney(
                                      transactionCardMeta?.amount_cents,
                                      transactionCardMeta?.currency,
                                    )}
                                  </p>
                                </div>
                                <div className="mt-2 flex flex-wrap gap-1.5 text-[11px] font-semibold">
                                  <span
                                    className={`rounded-full border px-2 py-0.5 ${statusTone(transactionCardStatus)}`}
                                  >
                                    {humanizeStatus(transactionCardStatus)}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 ${protectionTone(
                                      transactionCardMeta?.protection_status ||
                                        'awaiting_funding',
                                    )}`}
                                  >
                                    {humanizeStatus(
                                      transactionCardMeta?.protection_status ||
                                        'awaiting_funding',
                                    )}
                                  </span>
                                  <span
                                    className={`rounded-full border px-2 py-0.5 ${paymentTone(transactionCardPaymentStatus)}`}
                                  >
                                    {humanizeStatus(
                                      transactionCardPaymentStatus,
                                    )}
                                  </span>
                                </div>
                                <div className="mt-2 rounded-xl bg-[color:color-mix(in_srgb,_var(--app-overlay)_18%,_transparent)] px-3 py-2">
                                  <div className="flex items-center justify-between gap-2 text-[11px]">
                                    <p className="font-semibold opacity-90">
                                      {transactionCardNextStep ||
                                        (chatLocale === 'id'
                                          ? 'Menunggu pembaruan transaksi'
                                          : 'Waiting for transaction update')}
                                    </p>
                                    <span className="font-bold text-[color:var(--app-accent)]">
                                      {transactionCardProgress}%
                                    </span>
                                  </div>
                                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[color:color-mix(in_srgb,_var(--app-surface)_45%,_transparent)]">
                                    <div
                                      className="h-full rounded-full bg-gradient-to-r from-[color:var(--app-info)] via-[color:var(--app-accent)] to-[color:var(--app-accent)]"
                                      style={{
                                        width: `${transactionCardProgress}%`,
                                      }}
                                    />
                                  </div>
                                  <p className="mt-2 text-[11px] opacity-80">
                                    {humanizeStatus(
                                      transactionCardMeta?.deal_kind || 'deal',
                                    )}{' '}
                                    |{' '}
                                    {humanizeStatus(
                                      transactionCardMeta?.fulfillment_mode ||
                                        'standard',
                                    )}
                                  </p>
                                </div>
                                {typeof transactionCardMeta?.response_message ===
                                  'string' &&
                                  transactionCardMeta.response_message.trim() && (
                                    <p className="mt-2 rounded-xl bg-[color:color-mix(in_srgb,_var(--app-overlay)_20%,_transparent)] px-3 py-2 text-xs opacity-90">
                                      {transactionCardMeta.response_message}
                                    </p>
                                  )}
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setShowTransactionsDrawer(true);
                                      void (async () => {
                                        const list =
                                          await loadRoomTransactions();
                                        if (!transactionCardId) return;
                                        const found = list.find(
                                          txn => txn.id === transactionCardId,
                                        );
                                        if (found)
                                          setSelectedTransaction(found);
                                      })();
                                    }}
                                    className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-border-strong)]"
                                  >
                                    {chatLocale === 'id'
                                      ? 'Buka transaksi'
                                      : 'Open transaction'}
                                  </button>
                                  {transactionShouldShowPay ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        openPaymentForTransaction({
                                          transaction_id: transactionCardId,
                                          amount_cents:
                                            transactionCardMeta?.amount_cents,
                                          currency:
                                            transactionCardMeta?.currency,
                                        })
                                      }
                                      className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)]"
                                    >
                                      <Wallet className="h-3.5 w-3.5" />
                                      {chatLocale === 'id'
                                        ? 'Bayar sekarang'
                                        : 'Pay now'}
                                    </button>
                                  ) : null}
                                </div>
                              </div>
                            )}

                            {msg.message_type === 'job_update' && (
                              <div
                                className={`rounded-xl border p-2.5 ${isOwn ? 'border-[color:color-mix(in_srgb,_var(--app-accent-border)_20%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-overlay)_20%,_transparent)]' : 'border-[color:var(--app-border-strong)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)]'}`}
                              >
                                <p className="text-xs font-semibold">
                                  {String(meta?.title || 'Job updated')}
                                </p>
                              </div>
                            )}

                            {msg.content && (
                              <p className="text-xs opacity-90">
                                {msg.content}
                              </p>
                            )}
                          </div>
                        ) : msg.message_type === 'image' &&
                          msg.attachments?.[0] ? (
                          <div className="space-y-2">
                            {msg.attachments.map((rawUrl, index) => {
                              const imageUrl = normalizeAttachmentUrl(rawUrl);
                              if (!imageUrl) return null;
                              return (
                                <img
                                  key={`${msg.id}-img-${index}`}
                                  src={imageUrl}
                                  alt={
                                    (msg.attachments?.length ?? 0) > 1
                                      ? `Image ${index + 1}`
                                      : 'Image'
                                  }
                                  className="max-w-full rounded-lg border border-[color:color-mix(in_srgb,_var(--app-border-strong)_5%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)]"
                                  loading="lazy"
                                />
                              );
                            })}
                            {msg.content && (
                              <span className="block">{msg.content}</span>
                            )}
                          </div>
                        ) : msg.message_type === 'video' &&
                          msg.attachments?.[0] ? (
                          <div className="space-y-2">
                            <video
                              src={normalizeAttachmentUrl(msg.attachments[0])}
                              controls
                              className="max-w-full rounded-lg"
                            />
                            {msg.content && (
                              <span className="block">{msg.content}</span>
                            )}
                          </div>
                        ) : msg.message_type === 'audio' &&
                          msg.attachments?.[0] ? (
                          <div className="space-y-2">
                            <audio
                              src={normalizeAttachmentUrl(msg.attachments[0])}
                              controls
                              className="max-w-full"
                            />
                            {msg.content && (
                              <span className="block">{msg.content}</span>
                            )}
                          </div>
                        ) : msg.message_type === 'sticker' &&
                          msg.attachments?.[0] ? (
                          <div className="space-y-2">
                            <img
                              src={normalizeAttachmentUrl(msg.attachments[0])}
                              alt="Sticker"
                              className="mx-auto h-24 w-24 object-contain"
                              loading="lazy"
                            />
                            {msg.content && (
                              <span className="block">{msg.content}</span>
                            )}
                          </div>
                        ) : msg.message_type === 'file' &&
                          msg.attachments?.[0] ? (
                          <a
                            href={normalizeAttachmentUrl(msg.attachments[0])}
                            target="_blank"
                            rel="noreferrer"
                            className={`break-words underline ${isOwn ? 'text-[color:color-mix(in_srgb,_var(--app-text-inverse)_90%,_transparent)]' : 'text-[color:var(--app-accent)]'}`}
                          >
                            {msg.content || 'Download file'}
                          </a>
                        ) : (
                          <span>{msg.content}</span>
                        )}

                        <div
                          className="mt-1.5 flex items-center justify-end gap-1 pl-8"
                        >
                          <span
                            className={`text-[10px] ${bubbleMetaClass}`}
                          >
                            {formatMessageTime(msg.created_at)}
                          </span>
                          {isOwn && (
                            <span className="ml-0.5 inline-flex items-center opacity-90">
                              {status === 'sending' && (
                                <Clock
                                  className="w-3 h-3 animate-pulse"
                                  aria-label="Sending"
                                />
                              )}
                              {status === 'sent' && (
                                <Check className="w-3 h-3" aria-label="Sent" />
                              )}
                              {status === 'read' && (
                                <CheckCheck
                                  className="w-3 h-3 text-[#53bdeb]"
                                  aria-label="Read"
                                />
                              )}
                              {status === 'failed' && (
                                <AlertCircle
                                  className="w-3 h-3 text-[#ff6b6b]"
                                  aria-label="Failed"
                                />
                              )}
                            </span>
                          )}
                        </div>
                        </div>
                      </div>
                    </motion.div>
                  );
                })
              )}

              {messageListSpacerHeight ? (
                <div style={{ height: messageListSpacerHeight }} />
              ) : null}
              <div ref={messagesEndRef} />
            </div>
          </div>
        </div>
      </main>

      {/* Composer */}
      <div
        ref={composerRef}
        className={`border-t border-black/5 bg-[#f0f2f5]/95 px-2 py-2 backdrop-blur dark:border-white/6 dark:bg-[#202c33]/95 ${
          isMobileViewport ? 'fixed inset-x-0 bottom-0 z-40' : ''
        }`}
        style={composerStyle}
      >
        <div className="mx-auto w-full max-w-[920px] space-y-2">
          <input
            ref={fileInputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt"
          />

          {draftAttachments.length > 0 && (
            <div className="rounded-[20px] border border-black/5 bg-white/82 p-2 shadow-sm dark:border-white/8 dark:bg-[#111b21]/82">
              <div className="flex gap-3 overflow-x-auto pb-1">
                {draftAttachments.map(attachment => (
                  <div
                    key={attachment.id}
                    className="relative min-w-[112px] max-w-[136px] rounded-2xl border border-black/5 bg-[#f8fafb] p-2 shadow-sm dark:border-white/8 dark:bg-[#202c33]"
                  >
                    <button
                      type="button"
                      onClick={() => removeDraftAttachment(attachment.id)}
                      className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-white text-[#54656f] shadow-md dark:bg-[#111b21] dark:text-[#aebac1]"
                      title="Remove attachment"
                    >
                      <X className="w-3 h-3" />
                    </button>

                    {attachment.type === 'image' && attachment.previewUrl ? (
                      <img
                        src={attachment.previewUrl}
                        alt={attachment.name}
                        className="h-24 w-full rounded-xl border border-black/5 object-cover dark:border-white/8"
                      />
                    ) : attachment.type === 'video' && attachment.previewUrl ? (
                      <video
                        src={attachment.previewUrl}
                        className="h-24 w-full rounded-xl border border-black/5 object-cover dark:border-white/8"
                        muted
                        loop
                        playsInline
                      />
                    ) : (
                      <div className="flex h-24 flex-col items-center justify-center gap-1 text-xs text-[#667781] dark:text-[#8696a0]">
                        <Paperclip className="w-5 h-5" />
                        <span className="text-center line-clamp-2">
                          {attachment.name}
                        </span>
                      </div>
                    )}

                    <div className="mt-2 flex items-center justify-between text-[11px] text-[#667781] dark:text-[#8696a0]">
                      <span>{formatFileSize(attachment.size)}</span>
                      {attachment.status === 'uploading' && (
                        <Loader2
                          className="w-3 h-3 animate-spin text-[#25d366]"
                          aria-label="Uploading"
                        />
                      )}
                      {attachment.status === 'error' && (
                        <button
                          type="button"
                          onClick={() => retryAttachmentUpload(attachment.id)}
                          className="text-[#128c7e] hover:underline dark:text-[#25d366]"
                        >
                          Retry
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-1 text-xs text-[#667781] dark:text-[#8696a0]">
                {isUploadingAttachments
                  ? 'Uploading attachments...'
                  : 'Attachments ready to send'}
              </p>
            </div>
          )}

          {activeFraudSignal && (
            <div
              className={`flex items-start gap-2 rounded-[18px] border bg-white/84 px-3 py-2 text-xs shadow-sm dark:bg-[#111b21]/84 ${
                activeFraudSignal.severity === 'high'
                  ? 'border-[#ffb4a2] text-[#c65b3d] dark:border-[#6b4f3b] dark:text-[#ffb199]'
                  : 'border-[#f7d794] text-[#b07c00] dark:border-[#6b5a2e] dark:text-[#f6d87a]'
              }`}
            >
              <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
              <p>{activeFraudSignal.message}</p>
            </div>
          )}

          <div className="flex items-end gap-2">
            <div className="flex min-w-0 flex-1 items-end gap-1 rounded-[28px] bg-white px-2 py-1.5 shadow-[0_1px_2px_rgba(17,27,33,0.14)] dark:bg-[#2a3942]">
              <div className="flex shrink-0 items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPicker(prev => !prev);
                    setShowStickerPanel(false);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/5"
                  title="Emoji"
                >
                  <Smile className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowStickerPanel(prev => !prev);
                    setShowEmojiPicker(false);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 max-[420px]:hidden dark:text-[#aebac1] dark:hover:bg-white/5"
                  title="Stickers"
                >
                  <Sticker className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setShowEmojiPicker(false);
                    setShowStickerPanel(false);
                    setShowCameraModal(true);
                  }}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 max-[420px]:hidden dark:text-[#aebac1] dark:hover:bg-white/5"
                  title="Camera"
                >
                  <Camera className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={() => openAiWorkspace('reply')}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#128c7e] transition hover:bg-[#d9fdd3] max-[520px]:hidden dark:text-[#25d366] dark:hover:bg-[#103529]"
                  title="AI draft"
                  aria-label="AI draft"
                >
                  <Sparkles className="h-4 w-4" />
                </button>

                <button
                  type="button"
                  onClick={handleChooseFile}
                  disabled={isUploadingAttachments}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 disabled:cursor-not-allowed disabled:opacity-60 dark:text-[#aebac1] dark:hover:bg-white/5"
                  title="Attach files"
                >
                  {isUploadingAttachments ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Paperclip className="h-4 w-4" />
                  )}
                </button>
              </div>

              <div className="flex min-w-0 flex-1 items-center gap-1.5">
                <div className="relative min-w-0 flex-1">
                  <input
                    ref={messageInputRef}
                    type="text"
                    value={newMessage}
                    onChange={e => handleTypingChange(e.target.value)}
                    onFocus={() => setIsComposerFocused(true)}
                    onBlur={() => {
                      setIsComposerFocused(false);
                      setKeyboardOffset(0);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSend();
                      }
                    }}
                    placeholder={
                      chatLocale === 'id' ? 'Ketik pesan' : 'Type a message'
                    }
                    className="h-10 w-full border-0 bg-transparent px-2 text-[14px] text-[#111b21] placeholder:text-[#667781] focus:outline-none dark:text-[#e9edef] dark:placeholder:text-[#8696a0]"
                  />

                  {showEmojiPicker && (
                    <div
                      ref={emojiPickerRef}
                      className="absolute bottom-full left-1/2 z-40 mb-2 w-[min(300px,calc(100vw-2rem))] -translate-x-1/2 rounded-2xl border border-black/5 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-[#202c33] sm:left-0 sm:w-[300px] sm:translate-x-0"
                    >
                      <div className="grid grid-cols-5 gap-1.5 sm:grid-cols-6 sm:gap-2">
                        {QUICK_EMOJIS.map(emoji => (
                          <button
                            key={emoji}
                            type="button"
                            onClick={() => handleEmojiPick(emoji)}
                            className="rounded-lg p-1.5 text-lg transition-colors hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] sm:p-2 sm:text-xl"
                          >
                            {emoji}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() => void handleSend()}
                  disabled={
                    !canSendMessage || sending || isUploadingAttachments
                  }
                  className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-[#111b21] transition hover:bg-[#22c55e] disabled:cursor-not-allowed disabled:bg-[#dfe5e7] disabled:text-[#7b8b94] disabled:opacity-100 dark:disabled:bg-[#374248] dark:disabled:text-[#8696a0]"
                  title="Send"
                >
                  {sending ? (
                    <Loader2 className="h-4.5 w-4.5 animate-spin" />
                  ) : (
                    <Send className="h-4.5 w-4.5" />
                  )}
                </button>
              </div>
            </div>
          </div>

          {showStickerPanel && (
            <div
              ref={stickerPanelRef}
              className="rounded-2xl border border-black/5 bg-white p-2.5 shadow-2xl dark:border-white/10 dark:bg-[#202c33] sm:p-3"
            >
              <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-6 sm:gap-2">
                {STICKER_PACK.map(sticker => (
                  <button
                    key={sticker.id}
                    type="button"
                    onClick={() => handleStickerSelect(sticker.url)}
                    className="rounded-xl p-1.5 transition-colors hover:bg-[#f0f2f5] dark:hover:bg-[#2a3942] sm:p-2"
                    title={sticker.label}
                  >
                    <img
                      src={sticker.url}
                      alt={sticker.label}
                      className="mx-auto h-9 w-9 sm:h-12 sm:w-12"
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {showAiQuickPanel && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] p-3 sm:items-center"
          onClick={() => setShowAiQuickPanel(false)}
        >
          <div
            className="ui-feed-section max-h-[80svh] w-full max-w-md overflow-y-auto rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-4 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--app-text-soft)]">
                  {chatLocale === 'id' ? 'AI Workspace' : 'AI Workspace'}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-[color:var(--app-text-soft)]">
                  {aiProfileName || 'AI Pribadi'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowAiQuickPanel(false)}
                className="rounded-full p-1.5 text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
                aria-label="Close AI panel"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {AI_WORKSPACES.map(workspace => (
                <button
                  key={workspace.id}
                  type="button"
                  onClick={() => {
                    if (workspace.id === 'reply') {
                      setAiWorkspaceMode('reply');
                      return;
                    }
                    openAiWorkspace(workspace.id);
                  }}
                  className={`rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                    aiWorkspaceMode === workspace.id
                      ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                      : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]'
                  }`}
                >
                  {chatLocale === 'id' ? workspace.labelId : workspace.labelEn}
                </button>
              ))}
            </div>

            {aiWorkspaceMode === 'reply' ? (
              <>
                <div className="mt-3 flex flex-wrap items-center gap-1.5">
                  {AI_TEMPLATES.map(template => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => setAiTemplateId(template.id)}
                      className={`rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                        aiTemplateId === template.id
                          ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                          : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]'
                      }`}
                    >
                      {template.label}
                    </button>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGenerateAiDraft()}
                    disabled={aiLoading}
                    className="inline-flex items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent-strong)] disabled:opacity-60"
                  >
                    {aiLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {aiLoading
                      ? chatLocale === 'id'
                        ? 'Membuat draft...'
                        : 'Generating...'
                      : chatLocale === 'id'
                        ? 'Generate balasan'
                        : 'Generate reply'}
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAiDraft}
                    className="rounded-full border border-[color:var(--app-border-strong)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
                  >
                    {chatLocale === 'id' ? 'Clear' : 'Clear'}
                  </button>
                  {aiLastGeneratedAt && (
                    <span className="text-[10px] text-[color:var(--app-text-soft)]">
                      {chatLocale === 'id' ? 'Terakhir' : 'Last'}:{' '}
                      {new Date(aiLastGeneratedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                {aiError ? (
                  <p className="mt-2 text-[11px] text-[color:var(--app-danger)]">
                    {aiError}
                  </p>
                ) : null}

                {aiDraft && (
                  <div className="mt-3 rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] p-3">
                    <p className="whitespace-pre-wrap text-xs text-[color:var(--app-text)]">
                      {aiDraft}
                    </p>
                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={handleInsertAiDraft}
                        className="rounded-full bg-[color:var(--app-surface-strong)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface)]"
                      >
                        {chatLocale === 'id'
                          ? 'Masukkan ke input'
                          : 'Insert to input'}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleSendAiDraft()}
                        disabled={
                          sending || isUploadingAttachments || aiAutoSend
                        }
                        className="rounded-full bg-[color:var(--app-accent)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent-strong)] disabled:opacity-60"
                      >
                        {aiAutoSend
                          ? chatLocale === 'id'
                            ? 'Auto-send aktif'
                            : 'Auto-send enabled'
                          : chatLocale === 'id'
                            ? 'Kirim sekarang'
                            : 'Send now'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiDraft('')}
                        className="rounded-full border border-[color:var(--app-border-strong)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
                      >
                        {chatLocale === 'id' ? 'Buang draft' : 'Discard'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            ) : (
              <>
                <div className="mt-3 rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] p-3">
                  <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                    {aiWorkspaceMode === 'listing'
                      ? chatLocale === 'id'
                        ? 'AI akan bikin draft listing yang bisa diedit dan dipublish.'
                        : 'The AI will draft a listing that can be edited and published.'
                      : chatLocale === 'id'
                        ? 'AI akan bikin draft profil usaha yang tetap harus direview dulu.'
                        : 'The AI will draft a business profile that still needs review first.'}
                  </p>
                  <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                    {chatLocale === 'id'
                      ? 'Isi brief awalnya. Nanti AI susun jadi card review di room chat, lalu kamu edit atau publish.'
                      : 'Start from a short brief. The AI will turn it into a review card in the room chat, then you can edit or publish it.'}
                  </p>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {AI_STRUCTURED_PROMPT_EXAMPLES[aiWorkspaceMode].map(
                    example => (
                      <button
                        key={example.id}
                        type="button"
                        onClick={() =>
                          applyStructuredPromptExample(
                            aiWorkspaceMode,
                            example.promptId,
                            example.promptEn,
                          )
                        }
                        className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
                      >
                        {chatLocale === 'id'
                          ? example.labelId
                          : example.labelEn}
                      </button>
                    ),
                  )}
                </div>

                <label className="mt-3 block text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {chatLocale === 'id' ? 'Brief default' : 'Default brief'}
                  <textarea
                    value={aiStructuredPrompt}
                    onChange={event =>
                      setAiStructuredPrompt(event.target.value)
                    }
                    rows={9}
                    className="mt-1 w-full rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] px-3 py-3 text-xs text-[color:var(--app-text)] outline-none transition focus:border-[color:var(--app-accent)]"
                    placeholder={
                      chatLocale === 'id'
                        ? 'Tulis dulu inti listing atau profil usaha yang ingin dibantu AI.'
                        : 'Write the core listing or business profile brief you want the AI to help with.'
                    }
                  />
                </label>

                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => void handleGenerateStructuredDraft()}
                    disabled={aiStructuredLoading}
                    className="inline-flex items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent-strong)] disabled:opacity-60"
                  >
                    {aiStructuredLoading ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Sparkles className="h-3.5 w-3.5" />
                    )}
                    {aiStructuredLoading
                      ? chatLocale === 'id'
                        ? 'Menyusun draft...'
                        : 'Building draft...'
                      : chatLocale === 'id'
                        ? 'Generate draft terstruktur'
                        : 'Generate structured draft'}
                  </button>
                  <button
                    type="button"
                    onClick={() => resetStructuredPrompt(aiWorkspaceMode)}
                    className="rounded-full border border-[color:var(--app-border-strong)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
                  >
                    {chatLocale === 'id' ? 'Reset prompt' : 'Reset prompt'}
                  </button>
                  {aiLastGeneratedAt && (
                    <span className="text-[10px] text-[color:var(--app-text-soft)]">
                      {chatLocale === 'id' ? 'Terakhir' : 'Last'}:{' '}
                      {new Date(aiLastGeneratedAt).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  )}
                </div>

                {aiStructuredError ? (
                  <p className="mt-2 text-[11px] text-[color:var(--app-danger)]">
                    {aiStructuredError}
                  </p>
                ) : null}

                {aiStructuredDraft && (
                  <div className="mt-3 rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] p-3">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_18%,_transparent)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-accent)]">
                        {aiStructuredDraft.contentType}
                      </span>
                      <span className="rounded-full bg-[color:var(--app-surface)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                        {aiStructuredDraft.listingSide}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          structuredDraftPublishIssues.length === 0
                            ? 'bg-[color:color-mix(in_srgb,_var(--app-accent)_16%,_transparent)] text-[color:var(--app-accent)]'
                            : 'bg-[color:color-mix(in_srgb,_var(--app-warning)_14%,_transparent)] text-[color:var(--app-warning)]'
                        }`}
                      >
                        {structuredDraftPublishIssues.length === 0
                          ? chatLocale === 'id'
                            ? 'Siap publish'
                            : 'Ready to publish'
                          : chatLocale === 'id'
                            ? 'Wajib review'
                            : 'Review required'}
                      </span>
                    </div>

                    <p className="mt-3 text-sm font-semibold text-[color:var(--app-text)]">
                      {aiStructuredDraft.title}
                    </p>
                    <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                      {aiStructuredDraft.summary}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-[color:var(--app-text)]">
                      {aiStructuredDraft.body}
                    </p>

                    {aiStructuredDraft.tags.length > 0 && (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {aiStructuredDraft.tags.slice(0, 6).map(tag => (
                          <span
                            key={tag}
                            className="rounded-full bg-[color:var(--app-surface)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-text-soft)]"
                          >
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}

                    {aiStructuredDraft.reviewNotes.length > 0 && (
                      <div className="mt-3 rounded-xl bg-[color:color-mix(in_srgb,_var(--app-overlay)_14%,_transparent)] px-3 py-2 text-[11px] text-[color:var(--app-text)]">
                        <p className="font-semibold">
                          {chatLocale === 'id'
                            ? 'Checklist review'
                            : 'Review checklist'}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {aiStructuredDraft.reviewNotes
                            .slice(0, 3)
                            .map(note => (
                              <li key={note}>- {note}</li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {aiStructuredDraft.followUpQuestions.length > 0 && (
                      <div className="mt-3 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-info-border)_38%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] px-3 py-2 text-[11px] text-[color:var(--app-text)]">
                        <p className="font-semibold">
                          {chatLocale === 'id'
                            ? 'Data yang masih perlu kamu cek'
                            : 'Details you should still confirm'}
                        </p>
                        <ul className="mt-1 space-y-1">
                          {aiStructuredDraft.followUpQuestions
                            .slice(0, 3)
                            .map(question => (
                              <li key={question}>- {question}</li>
                            ))}
                        </ul>
                      </div>
                    )}

                    {structuredDraftPublishIssues.length > 0 && (
                      <div className="mt-3 rounded-xl border border-[color:color-mix(in_srgb,_var(--app-warning-border)_42%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-warning)_10%,_transparent)] px-3 py-2 text-[11px] text-[color:var(--app-warning)]">
                        <p className="font-semibold">
                          {chatLocale === 'id'
                            ? 'Sebelum publish'
                            : 'Before publishing'}
                        </p>
                        <p className="mt-1">
                          {formatValidationIssues(
                            structuredDraftPublishIssues,
                            chatLocale,
                          )}
                        </p>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => void handleCreateStructuredDraftCard()}
                        disabled={aiStructuredApplying || sending}
                        className="inline-flex items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-inverse)] transition hover:bg-[color:var(--app-accent-strong)] disabled:opacity-60"
                      >
                        {aiStructuredApplying ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <CheckCircle2 className="h-3.5 w-3.5" />
                        )}
                        {aiStructuredApplying
                          ? chatLocale === 'id'
                            ? 'Menyimpan draft...'
                            : 'Saving draft...'
                          : chatLocale === 'id'
                            ? 'Buat draft dan kirim ke room'
                            : 'Create draft and send to room'}
                      </button>
                      <button
                        type="button"
                        onClick={() => setAiStructuredDraft(null)}
                        className="rounded-full border border-[color:var(--app-border-strong)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
                      >
                        {chatLocale === 'id' ? 'Buang hasil' : 'Discard'}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            <div className="mt-3 rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] p-3 text-[11px] text-[color:var(--app-text-soft)]">
              {chatLocale === 'id'
                ? 'Nada AI, instruksi tambahan, dan auto-send masih bisa diatur dari Chat Settings.'
                : 'The AI tone, extra instruction, and auto-send are still managed from Chat Settings.'}
              <button
                type="button"
                onClick={() => {
                  setShowAiQuickPanel(false);
                  setShowChatSettings(true);
                }}
                className="ml-2 font-semibold text-[color:var(--app-accent)] hover:underline"
              >
                {chatLocale === 'id' ? 'Buka Settings' : 'Open settings'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showChatSettings && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[color:color-mix(in_srgb,_var(--app-overlay)_45%,_transparent)]"
          onClick={() => setShowChatSettings(false)}
        >
          <div
            className="ui-feed-section flex h-[100svh] max-h-[100svh] w-full max-w-md flex-col overflow-hidden border-l border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-4 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--app-text-soft)]">
                  Chat Settings
                </p>
                <h3 className="text-sm font-semibold text-[color:var(--app-text-soft)]">
                  Pengaturan room
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowChatSettings(false)}
                className="rounded-full p-2 text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
                title="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 space-y-4 overflow-y-auto pb-8">
              <div className="ui-feed-tile rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wide text-[color:var(--app-text-soft)]">
                      AI Pribadi
                    </p>
                    <h4 className="mt-1 text-sm font-semibold text-[color:var(--app-text-soft)]">
                      {aiProfileName || 'AI Pribadi'}
                    </h4>
                    <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                      Atur gaya balasan AI untuk room ini.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setShowChatSettings(false);
                      openAiWorkspace('reply');
                    }}
                    className="inline-flex items-center gap-1.5 rounded-full bg-[color:var(--app-accent)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-inverse)]"
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    Buka AI
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => setAiUseContext(prev => !prev)}
                    aria-pressed={aiUseContext}
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                      aiUseContext
                        ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                        : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]'
                    }`}
                  >
                    Konteks
                  </button>
                  <button
                    type="button"
                    onClick={() => setAiAutoSend(prev => !prev)}
                    aria-pressed={aiAutoSend}
                    className={`rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                      aiAutoSend
                        ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                        : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]'
                    }`}
                  >
                    {aiAutoSend ? 'Auto send' : 'Manual'}
                  </button>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <label className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                    Nama AI
                    <input
                      type="text"
                      value={aiProfileName}
                      onChange={event => setAiProfileName(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs text-[color:var(--app-text)] focus:border-[color:var(--app-accent)] focus:outline-none"
                      placeholder="AI Pribadi"
                    />
                  </label>
                  <label className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                    Nada
                    <select
                      value={aiToneId}
                      onChange={event => {
                        const next = event.target.value;
                        if (isAiToneId(next)) setAiToneId(next);
                      }}
                      className="mt-1 w-full rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs text-[color:var(--app-text)] focus:border-[color:var(--app-accent)] focus:outline-none"
                    >
                      {AI_TONES.map(tone => (
                        <option key={tone.id} value={tone.id}>
                          {tone.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="mt-2 grid gap-2 sm:grid-cols-2">
                  <label className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                    Panjang
                    <select
                      value={aiLengthId}
                      onChange={event => {
                        const next = event.target.value;
                        if (isAiLengthId(next)) setAiLengthId(next);
                      }}
                      className="mt-1 w-full rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs text-[color:var(--app-text)] focus:border-[color:var(--app-accent)] focus:outline-none"
                    >
                      {AI_LENGTHS.map(length => (
                        <option key={length.id} value={length.id}>
                          {length.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                    Instruksi tambahan
                    <input
                      type="text"
                      value={aiInstruction}
                      onChange={event => setAiInstruction(event.target.value)}
                      className="mt-1 w-full rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs text-[color:var(--app-text)] focus:border-[color:var(--app-accent)] focus:outline-none"
                      placeholder="Contoh: fokus ke harga dan deadline"
                    />
                  </label>
                </div>

                <div className="mt-3">
                  <p className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                    Template default
                  </p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {AI_TEMPLATES.map(template => (
                      <button
                        key={template.id}
                        type="button"
                        onClick={() => setAiTemplateId(template.id)}
                        className={`rounded-full px-2 py-1 text-[10px] font-semibold transition ${
                          aiTemplateId === template.id
                            ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                            : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]'
                        }`}
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {AI_PROMPT_EXAMPLES.map(example => (
                    <button
                      key={example.id}
                      type="button"
                      onClick={() => setAiInstruction(example.prompt)}
                      className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)] transition hover:bg-[color:var(--app-surface-muted)]"
                    >
                      {example.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {showListingActionModal && listingActionDraft && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_50%,_transparent)] p-3 sm:items-center">
          <div className="ui-feed-section max-h-[80svh] w-full max-w-md overflow-y-auto rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-4 shadow-2xl">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--app-text-soft)]">
                  {listingActionHeading}
                </p>
                <h3 className="mt-1 text-sm font-semibold text-[color:var(--app-text-soft)]">
                  {listingActionDraft.title}
                </h3>
                <div className="mt-1 flex flex-wrap items-center gap-1.5">
                  <span className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    {getListingSideContextLabel(
                      listingActionDraft.listingSide,
                      listingActionDraft.dealKind,
                      chatLocale,
                    )}
                  </span>
                  {canListingActionDirect && (
                    <span className="rounded-full border border-[color:color-mix(in_srgb,_var(--app-accent)_35%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_14%,_transparent)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-accent)]">
                      {listingActionMode === 'direct'
                        ? chatLocale === 'id'
                          ? 'Mode langsung'
                          : 'Direct mode'
                        : chatLocale === 'id'
                          ? 'Mode negosiasi'
                          : 'Offer mode'}
                    </span>
                  )}
                </div>
                <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                  {listingActionDraft.pricingMode === 'request'
                    ? chatLocale === 'id'
                      ? 'Harga belum ditampilkan. Anda bisa mulai dari budget atau tanya detail dulu.'
                      : 'Price is still by request. You can start with a budget or ask for details first.'
                    : listingActionDraft.listingSide === 'demand'
                      ? `${chatLocale === 'id' ? 'Budget acuan' : 'Reference budget'}: ${formatMoney(listingActionDraft.amountCents, listingActionDraft.currency)}`
                      : `${chatLocale === 'id' ? 'Harga listing' : 'Listed price'}: ${formatMoney(listingActionDraft.amountCents, listingActionDraft.currency)}`}
                </p>
                <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                  {listingActionHint}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (listingActionSubmitting) return;
                  setShowListingActionModal(false);
                }}
                className="rounded-full p-1.5 text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {canListingActionDirect && (
              <div className="mb-3 grid gap-2 sm:grid-cols-2">
                <button
                  type="button"
                  onClick={() =>
                    applyListingActionMode(listingActionDraft, 'direct')
                  }
                  className={`ui-feed-tile rounded-2xl border px-3 py-3 text-left transition ${
                    listingActionMode === 'direct'
                      ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,_var(--app-accent)_14%,_transparent)]'
                      : 'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)]'
                  }`}
                >
                  <p className="text-[11px] font-semibold text-[color:var(--app-accent)]">
                    {chatLocale === 'id'
                      ? 'Lanjut langsung'
                      : 'Proceed directly'}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                    {chatLocale === 'id'
                      ? 'Pakai harga listing dan buat tiket deal sekarang.'
                      : 'Use the listed price and create the deal ticket now.'}
                  </p>
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyListingActionMode(listingActionDraft, 'offer')
                  }
                  className={`ui-feed-tile rounded-2xl border px-3 py-3 text-left transition ${
                    listingActionMode === 'offer'
                      ? 'border-[color:var(--app-info-border)] bg-[color:color-mix(in_srgb,_var(--app-info)_12%,_transparent)]'
                      : 'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)]'
                  }`}
                >
                  <p className="text-[11px] font-semibold text-[color:var(--app-info)]">
                    {chatLocale === 'id' ? 'Nego dulu' : 'Negotiate first'}
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                    {chatLocale === 'id'
                      ? 'Kirim nominal awal, scope, dan catatan untuk buka negosiasi.'
                      : 'Send a starting amount, scope, and note to open negotiation.'}
                  </p>
                </button>
              </div>
            )}

            {canListingActionAskPrice && (
              <div className="ui-feed-row mb-3 rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] p-3">
                <p className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {chatLocale === 'id'
                    ? 'Perlu harga dulu?'
                    : 'Need the price first?'}
                </p>
                <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                  {chatLocale === 'id'
                    ? 'Isi chat otomatis untuk minta rincian harga dan ketentuan utama.'
                    : 'Prefill the chat composer to request pricing details and key terms.'}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setShowListingActionModal(false);
                    setNewMessage(
                      prev =>
                        `${prev}${prev ? ' ' : ''}${
                          chatLocale === 'id'
                            ? 'Halo, boleh kirim detail harga dan ketentuan utamanya?'
                            : 'Could you share the price details and key terms?'
                        }`,
                    );
                  }}
                  className="mt-2 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_18%,_transparent)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_28%,_transparent)]"
                >
                  {chatLocale === 'id'
                    ? 'Tanya harga via chat'
                    : 'Ask price in chat'}
                </button>
              </div>
            )}

            <label className="block text-xs font-semibold text-[color:var(--app-text-soft)]">
              {listingActionAmountLabel}
            </label>
            <input
              type="number"
              min={1}
              value={listingActionAmount}
              onChange={e => setListingActionAmount(e.target.value)}
              readOnly={isListingActionAmountLocked}
              className={`mt-1 w-full rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-sm text-[color:var(--app-text-soft)] outline-none focus:border-[color:var(--app-accent)] ${
                isListingActionAmountLocked
                  ? 'cursor-not-allowed opacity-80'
                  : ''
              }`}
              placeholder={listingActionAmountPlaceholder}
            />
            <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
              {listingActionMode === 'direct'
                ? chatLocale === 'id'
                  ? 'Nominal mengikuti harga listing agar transaksi langsung terbentuk rapi.'
                  : 'The amount follows the listing price so the transaction can be created immediately.'
                : listingActionDraft.listingSide === 'demand'
                  ? chatLocale === 'id'
                    ? 'Gunakan nominal ini untuk fee, budget, atau estimasi nilai pekerjaan.'
                    : 'Use this amount for fee, budget, or estimated project value.'
                  : chatLocale === 'id'
                    ? 'Gunakan nominal awal untuk membuka negosiasi yang lebih jelas.'
                    : 'Use this as the starting point for a clearer negotiation.'}
            </p>

            <label className="mt-3 block text-xs font-semibold text-[color:var(--app-text-soft)]">
              {chatLocale === 'id'
                ? 'Pesan detail (opsional)'
                : 'Detailed note (optional)'}
            </label>
            <textarea
              rows={4}
              value={listingActionMessage}
              onChange={e => setListingActionMessage(e.target.value)}
              className="mt-1 w-full resize-none rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-sm text-[color:var(--app-text-soft)] outline-none focus:border-[color:var(--app-accent)]"
              placeholder={
                listingActionMode === 'direct'
                  ? chatLocale === 'id'
                    ? 'Contoh: saya lanjut hari ini, mohon kirim detail pembayaran dan pengiriman.'
                    : 'Example: I am ready to proceed today, please share payment and delivery details.'
                  : listingActionDraft.listingSide === 'demand'
                    ? chatLocale === 'id'
                      ? 'Contoh: kami bisa kerjakan 3 hari, scope-nya mencakup A, B, C, dengan revisi 2 kali.'
                      : 'Example: we can deliver in 3 days, covering scope A, B, and C with 2 revisions.'
                    : chatLocale === 'id'
                      ? 'Contoh: saya ajukan nominal ini dengan catatan timeline dan scope berikut.'
                      : 'Example: I am sending this amount with the following scope and timeline.'
              }
            />
            <p className="mt-2 text-[11px] text-[color:var(--app-text-soft)]">
              {chatLocale === 'id'
                ? 'Setelah dikirim, chat akan menerima kartu tiket lengkap dengan referensi, status, dan langkah berikutnya.'
                : 'After submission, chat receives a structured ticket card with reference, status, and next steps.'}
            </p>

            <div className="mt-4 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowListingActionModal(false)}
                disabled={listingActionSubmitting}
                className="rounded-full bg-[color:var(--app-surface-muted)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)] disabled:opacity-50"
              >
                {chatLocale === 'id' ? 'Batal' : 'Cancel'}
              </button>
              <button
                type="button"
                onClick={() => void submitListingAction()}
                disabled={listingActionSubmitting}
                className="rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)] disabled:opacity-50"
              >
                {listingActionSubmitting
                  ? chatLocale === 'id'
                    ? 'Memproses...'
                    : 'Processing...'
                  : listingActionMode === 'direct'
                    ? chatLocale === 'id'
                      ? 'Buat Tiket Deal'
                      : 'Create Deal Ticket'
                    : listingActionDraft.listingSide === 'demand'
                      ? chatLocale === 'id'
                        ? 'Kirim Respons'
                        : 'Send Response'
                      : chatLocale === 'id'
                        ? 'Kirim Offer'
                        : 'Send Offer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransactionsDrawer && (
        <div
          className="fixed inset-0 z-50 flex justify-end bg-[color:color-mix(in_srgb,_var(--app-overlay)_45%,_transparent)]"
          onClick={() => setShowTransactionsDrawer(false)}
        >
          <div
            className="ui-feed-section flex h-[100svh] max-h-[100svh] w-full max-w-md flex-col overflow-hidden border-l border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-4 shadow-2xl"
            onClick={event => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <p className="text-xs uppercase tracking-wide text-[color:var(--app-text-soft)]">
                  {chatLocale === 'id' ? 'Daftar transaksi' : 'Order list'}
                </p>
                <h3 className="text-sm font-semibold text-[color:var(--app-text-soft)]">
                  {chatLocale === 'id'
                    ? `Riwayat transaksi ${roomName}`
                    : `Transaction history ${roomName}`}
                </h3>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => void loadRoomTransactions()}
                  className="rounded-full p-2 text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
                  title="Refresh"
                >
                  <Loader2
                    className={`h-4 w-4 ${transactionsLoading ? 'animate-spin' : ''}`}
                  />
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransactionsDrawer(false)}
                  className="rounded-full p-2 text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
                  title="Close"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto pb-8 pr-1">
              {transactionsLoading ? (
                <div className="flex items-center gap-2 py-6 text-sm text-[color:var(--app-text-soft)]">
                  <Loader2 className="h-4 w-4 animate-spin text-[color:var(--app-accent)]" />
                  {chatLocale === 'id'
                    ? 'Memuat transaksi...'
                    : 'Loading transactions...'}
                </div>
              ) : transactionsError ? (
                <div className="ui-feed-row rounded-xl border border-[color:color-mix(in_srgb,_var(--app-danger-border)_30%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)] p-3 text-xs text-[color:var(--app-danger)]">
                  <p>{transactionsError}</p>
                  <button
                    type="button"
                    onClick={() => void loadRoomTransactions()}
                    className="mt-3 inline-flex rounded-full border border-[color:color-mix(in_srgb,_var(--app-danger-border)_45%,_transparent)] px-3 py-1.5 font-semibold text-[color:var(--app-danger)] transition hover:bg-[color:color-mix(in_srgb,_var(--app-danger)_8%,_transparent)]"
                  >
                    {chatLocale === 'id' ? 'Coba lagi' : 'Try again'}
                  </button>
                </div>
              ) : roomTransactions.length === 0 ? (
                <div className="ui-feed-row rounded-xl border border-dashed border-[color:var(--app-border-strong)] p-4 text-xs text-[color:var(--app-text-soft)]">
                  {chatLocale === 'id'
                    ? 'Belum ada transaksi di room ini.'
                    : 'No transactions in this room yet.'}
                </div>
              ) : (
                <div className="space-y-2">
                  {roomTransactions.map(txn => {
                    const status = normalizeTransactionStatus(
                      txn.status || txn.transaction_status,
                    );
                    const protection = String(
                      txn.protection_status || 'awaiting_funding',
                    )
                      .trim()
                      .toLowerCase();
                    const paymentStatus = resolveTransactionPaymentStatus(txn);
                    const title =
                      typeof txn.snapshot_listing?.title === 'string'
                        ? txn.snapshot_listing.title
                        : typeof txn.content_id === 'string'
                          ? `Content ${txn.content_id}`
                          : 'Transaction';
                    const isSelected = selectedTransaction?.id === txn.id;
                    const txnProgressPercent =
                      getTransactionProgressPercent(txn);
                    const txnWaitingParty = getTransactionWaitingParty(
                      txn,
                      user?.id,
                    );
                    const txnCoverImage = normalizeAttachmentUrl(
                      txn.snapshot_listing?.cover_image,
                    );
                    const txnWalletLabel = resolveTransactionWalletLabel(
                      txn,
                      chatLocale,
                    );
                    const txnShortId = formatShortTransactionId(txn.id);
                    return (
                      <button
                        key={txn.id}
                        type="button"
                        onClick={() => setSelectedTransaction(txn)}
                        className={`ui-feed-row w-full rounded-2xl border p-3 text-left transition ${
                          isSelected
                            ? 'border-[color:color-mix(in_srgb,_var(--app-accent)_70%,_transparent)] bg-[color:var(--app-accent-soft)]'
                            : 'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] hover:bg-[color:var(--app-surface-muted)]'
                        }`}
                      >
                        <div className="flex items-start gap-3">
                          {txnCoverImage ? (
                            <img
                              src={txnCoverImage}
                              alt={title}
                              className="h-16 w-16 shrink-0 rounded-2xl object-cover"
                              loading="lazy"
                            />
                          ) : (
                            <span
                              className={`mt-1.5 h-2.5 w-2.5 rounded-full ${statusDot(status)}`}
                            />
                          )}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <p className="truncate text-xs font-semibold text-[color:var(--app-text-soft)]">
                                {title}
                              </p>
                              <span className="text-[10px] text-[color:var(--app-text-soft)]">
                                {formatDateTimeLabel(
                                  txn.updated_at || txn.created_at,
                                )}
                              </span>
                            </div>
                            <p className="mt-1 text-sm font-black text-[color:var(--app-accent)]">
                              {formatMoney(txn.amount_cents, txn.currency)}
                            </p>
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-[color:var(--app-text-soft)]">
                              <span>{txnShortId}</span>
                              <span>|</span>
                              <span>{txnWalletLabel}</span>
                            </div>
                            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
                              <span
                                className={`rounded-full border px-2 py-0.5 ${statusTone(status)}`}
                              >
                                {humanizeStatus(status)}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 ${protectionTone(protection)}`}
                              >
                                {humanizeStatus(protection)}
                              </span>
                              <span
                                className={`rounded-full border px-2 py-0.5 ${paymentTone(paymentStatus)}`}
                              >
                                {humanizeStatus(paymentStatus)}
                              </span>
                            </div>
                            <div className="mt-2">
                              <div className="flex items-center justify-between text-[10px] text-[color:var(--app-text-soft)]">
                                <span>Progress</span>
                                <span>{txnProgressPercent}%</span>
                              </div>
                              <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                                <div
                                  className="h-full rounded-full bg-gradient-to-r from-[color:var(--app-info)] via-[color:var(--app-accent)] to-[color:var(--app-accent)]"
                                  style={{ width: `${txnProgressPercent}%` }}
                                />
                              </div>
                              <p className="mt-1 truncate text-[10px] font-medium text-[color:var(--app-text-soft)]">
                                {txnWaitingParty}
                              </p>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedTransaction && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-[color:color-mix(in_srgb,_var(--app-overlay)_60%,_transparent)] p-3 sm:items-center">
          <div className="ui-feed-section max-h-[80svh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-4 shadow-2xl sm:p-5">
            <div className="mb-3 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs uppercase tracking-wide text-[color:var(--app-text-soft)]">
                  {chatLocale === 'id' ? 'Detail transaksi' : 'Order detail'}
                </p>
                <h3 className="mt-1 truncate text-sm font-semibold text-[color:var(--app-text-soft)] sm:text-base">
                  {String(
                    selectedTransaction.snapshot_listing?.title ||
                      selectedTransaction.content_id ||
                      'Transaction',
                  )}
                </h3>
                <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                  ID: {selectedTransaction.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="rounded-full p-1.5 text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
              <span
                className={`rounded-full border px-2 py-0.5 ${statusTone(selectedTxnStatus)}`}
              >
                {humanizeStatus(selectedTxnStatus)}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 ${protectionTone(
                  selectedTxnProtectionStatus,
                )}`}
              >
                {humanizeStatus(selectedTxnProtectionStatus)}
              </span>
              <span
                className={`rounded-full border px-2 py-0.5 ${paymentTone(
                  selectedTxnPaymentStatus,
                )}`}
              >
                {chatLocale === 'id' ? 'Pembayaran' : 'Payment'}:{' '}
                {humanizeStatus(selectedTxnPaymentStatus)}
              </span>
              <span className="rounded-full border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] px-2 py-0.5 text-[color:var(--app-text-soft)]">
                {selectedTxnIsBuyer
                  ? chatLocale === 'id'
                    ? 'Peran: Buyer'
                    : 'Role: Buyer'
                  : selectedTxnIsSeller
                    ? chatLocale === 'id'
                      ? 'Peran: Seller'
                      : 'Role: Seller'
                    : chatLocale === 'id'
                      ? 'Penonton'
                      : 'Viewer'}
              </span>
            </div>
            {(Object.keys(selectedTxnTicket).length > 0 ||
              selectedTxnSideLabel) && (
              <div className="mb-3 flex flex-wrap items-center gap-1.5 text-[11px]">
                {typeof selectedTxnTicket.reference === 'string' &&
                  selectedTxnTicket.reference.trim() && (
                    <span className="rounded-full border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] px-2 py-0.5 text-[color:var(--app-text-soft)]">
                      Ref: {selectedTxnTicket.reference}
                    </span>
                  )}
                <span className="rounded-full border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] px-2 py-0.5 text-[color:var(--app-text-soft)]">
                  {selectedTxnSideLabel}
                </span>
              </div>
            )}

            <div className="mb-3 rounded-xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text-soft)]">
                  {chatLocale === 'id'
                    ? 'Progress transaksi'
                    : 'Transaction progress'}
                </p>
                <span className="rounded-full border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {selectedTxnProgressPercent}%
                </span>
              </div>
              <div className="h-2 w-full overflow-hidden rounded-full bg-[color:var(--app-surface-muted)]">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-[color:var(--app-info)] via-[color:var(--app-accent)] to-[color:var(--app-accent)] transition-all"
                  style={{ width: `${selectedTxnProgressPercent}%` }}
                />
              </div>
              <p className="mt-2 text-xs text-[color:var(--app-text-soft)]">
                {selectedTxnWaitingParty}
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-3">
                {selectedTxnSteps.map((step, index) => (
                  <div
                    key={`${selectedTransaction.id}-step-${step.key}`}
                    className={`rounded-lg border px-2 py-1.5 text-[11px] ${
                      step.done
                        ? 'border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] text-[color:var(--app-accent)]'
                        : step.active
                          ? 'border-[color:color-mix(in_srgb,_var(--app-info-border)_50%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] text-[color:var(--app-info)]'
                          : 'border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)]'
                    }`}
                  >
                    <p className="font-semibold">
                      {index + 1}. {step.label}
                    </p>
                    <p className="mt-0.5">
                      {step.done
                        ? 'Selesai'
                        : step.active
                          ? 'Sedang berjalan'
                          : 'Menunggu'}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            {typeof selectedTransaction.snapshot_listing?.cover_image ===
              'string' &&
              selectedTransaction.snapshot_listing.cover_image.trim() && (
                <img
                  src={normalizeAttachmentUrl(
                    selectedTransaction.snapshot_listing.cover_image,
                  )}
                  alt={String(
                    selectedTransaction.snapshot_listing?.title || 'Listing',
                  )}
                  className="mb-3 h-36 w-full rounded-xl object-cover"
                  loading="lazy"
                />
              )}

            <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
              <div className="rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2">
                <p className="text-[color:var(--app-text-soft)]">Nominal</p>
                <p className="mt-0.5 font-bold text-[color:var(--app-accent)]">
                  {formatMoney(
                    selectedTransaction.amount_cents,
                    selectedTransaction.currency,
                  )}
                </p>
              </div>
              <div className="rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2">
                <p className="text-[color:var(--app-text-soft)]">Deal</p>
                <p className="mt-0.5 font-semibold text-[color:var(--app-text-soft)]">
                  {String(selectedTransaction.deal_kind || '-')}
                </p>
              </div>
              <div className="rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2">
                <p className="text-[color:var(--app-text-soft)]">Fulfillment</p>
                <p className="mt-0.5 font-semibold text-[color:var(--app-text-soft)]">
                  {String(selectedTransaction.fulfillment_mode || '-')}
                </p>
              </div>
              <div className="rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2">
                <p className="text-[color:var(--app-text-soft)]">Last Update</p>
                <p className="mt-0.5 font-semibold text-[color:var(--app-text-soft)]">
                  {formatDateTimeLabel(
                    selectedTransaction.updated_at ||
                      selectedTransaction.created_at,
                  )}
                </p>
              </div>
            </div>

            {typeof selectedTxnTicket.next_step === 'string' &&
              selectedTxnTicket.next_step.trim() && (
                <div className="mt-3 rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5 text-xs text-[color:var(--app-text-soft)]">
                  <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text-soft)]">
                    Next Step
                  </p>
                  <p>{String(selectedTxnTicket.next_step)}</p>
                </div>
              )}

            {selectedTxnLatestDelivery ? (
              <div className="mt-3 rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5 text-xs text-[color:var(--app-text-soft)]">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text-soft)]">
                      {`Delivery ${selectedTxnLatestDelivery.attemptNumber || selectedTxnDelivery.attemptsUsed}/${selectedTxnDelivery.maxAttempts}`}
                    </p>
                    <p className="mt-1 font-semibold text-[color:var(--app-text)]">
                      {selectedTxnLatestDelivery.title ||
                        (chatLocale === 'id'
                          ? 'Paket pengiriman terbaru'
                          : 'Latest delivery package')}
                    </p>
                  </div>
                  <span className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5 text-[11px] font-semibold">
                    {selectedTxnLatestDelivery.reviewStatus === 'accepted'
                      ? chatLocale === 'id'
                        ? 'Diterima'
                        : 'Accepted'
                      : selectedTxnLatestDelivery.reviewStatus ===
                          'revision_requested'
                        ? chatLocale === 'id'
                          ? 'Perlu revisi'
                          : 'Revision requested'
                        : chatLocale === 'id'
                          ? 'Menunggu review'
                          : 'Waiting review'}
                  </span>
                </div>
                {selectedTxnLatestDelivery.note ? (
                  <p className="mt-2 text-[11px] text-[color:color-mix(in_srgb,_var(--app-text-soft)_92%,_transparent)]">
                    {selectedTxnLatestDelivery.note}
                  </p>
                ) : null}
                <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                  <span>
                    Proof / links:{' '}
                    {selectedTxnLatestDelivery.attachments.length}
                  </span>
                  {selectedTxnLatestDelivery.buyerFeedbackNote ? (
                    <span>Buyer feedback captured</span>
                  ) : null}
                </div>
                {selectedTxnLatestDelivery.attachments.length > 0 ? (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedTxnLatestDelivery.attachments
                      .slice(0, 3)
                      .map((attachment, index) =>
                        attachment.url ? (
                          <a
                            key={`${selectedTransaction.id}-delivery-attachment-${index}`}
                            href={attachment.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5 text-[11px] font-semibold text-[color:var(--app-info)]"
                          >
                            {attachment.label || `Link ${index + 1}`}
                          </a>
                        ) : (
                          <span
                            key={`${selectedTransaction.id}-delivery-attachment-${index}`}
                            className="rounded-full border border-[color:var(--app-border-strong)] px-2 py-0.5 text-[11px] font-semibold"
                          >
                            {attachment.label ||
                              attachment.externalRef ||
                              `Ref ${index + 1}`}
                          </span>
                        ),
                      )}
                  </div>
                ) : null}
                {selectedTxnLatestDelivery.buyerFeedbackNote ? (
                  <div className="mt-2 rounded-lg border border-[color:color-mix(in_srgb,_var(--app-info-border)_35%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-info)_10%,_transparent)] px-2.5 py-2 text-[11px] text-[color:var(--app-text)]">
                    <span className="font-semibold">Buyer note:</span>{' '}
                    {selectedTxnLatestDelivery.buyerFeedbackNote}
                  </div>
                ) : null}
              </div>
            ) : null}

            <details
              className="mt-3 rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5"
              open
            >
              <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text-soft)]">
                Ringkasan Aktivitas
              </summary>
              <div className="mt-2 max-h-44 space-y-2 overflow-y-auto pr-1">
                {(
                  selectedTransaction.timeline ||
                  buildFallbackTimeline(selectedTransaction)
                ).map((item, index) => (
                  <div
                    key={`${selectedTransaction.id}-timeline-${index}`}
                    className="flex items-start gap-2 text-xs text-[color:var(--app-text-soft)]"
                  >
                    <span className="mt-1 h-1.5 w-1.5 rounded-full bg-[color:var(--app-accent)]" />
                    <div>
                      <p className="font-semibold">
                        {humanizeStatus(item.status || item.event || 'updated')}
                      </p>
                      {'description' in item &&
                      typeof item.description === 'string' &&
                      item.description.trim() ? (
                        <p className="text-[11px] text-[color:color-mix(in_srgb,_var(--app-text-soft)_90%,_transparent)]">
                          {item.description}
                        </p>
                      ) : null}
                      <p className="text-[11px] text-[color:var(--app-text-soft)]">
                        {item.at ? formatMessageTime(item.at) : '-'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </details>

            {(selectedTransaction.offer_message ||
              selectedTransaction.response_message) && (
              <details className="mt-3 rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5">
                <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text-soft)]">
                  Catatan Negosiasi
                </summary>
                <div className="mt-2 space-y-2">
                  {selectedTransaction.offer_message ? (
                    <div className="rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-2.5 text-xs text-[color:var(--app-text-soft)]">
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-[color:var(--app-text-soft)]">
                        Catatan Buyer
                      </p>
                      <p>{selectedTransaction.offer_message}</p>
                    </div>
                  ) : null}
                  {selectedTransaction.response_message ? (
                    <div className="rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-2.5 text-xs text-[color:var(--app-text-soft)]">
                      <p className="mb-1 text-[11px] uppercase tracking-wide text-[color:var(--app-text-soft)]">
                        Catatan Seller
                      </p>
                      <p>{selectedTransaction.response_message}</p>
                    </div>
                  ) : null}
                </div>
              </details>
            )}

            <details className="mt-3 rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-2.5">
              <summary className="cursor-pointer list-none text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text-soft)]">
                {chatLocale === 'id' ? 'Keamanan & risiko' : 'Safety & risk'}
              </summary>
              {Array.isArray(selectedTransaction.risk_flags) &&
              selectedTransaction.risk_flags.length > 0 ? (
                <div className="mt-2 rounded-lg border border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-warning)_10%,_transparent)] p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-warning)]">
                    Risk Flags
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {selectedTransaction.risk_flags.map((flag, idx) => (
                      <span
                        key={`${selectedTransaction.id}-risk-${idx}`}
                        className="rounded-full border border-[color:color-mix(in_srgb,_var(--app-warning-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-warning)_15%,_transparent)] px-2 py-0.5 text-[11px] text-[color:var(--app-warning)]"
                      >
                        {String(flag)}
                      </span>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[color:var(--app-text-soft)]">
                  Tidak ada risk flag.
                </p>
              )}

              {Object.keys(asObject(selectedTransaction.safety_checklist))
                .length > 0 ? (
                <div className="mt-2 rounded-lg border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-[color:var(--app-text-soft)]">
                    Safety Checklist
                  </p>
                  <div className="mt-1.5 space-y-1.5">
                    {Object.entries(
                      asObject(selectedTransaction.safety_checklist),
                    ).map(([key, value]) => (
                      <div
                        key={`${selectedTransaction.id}-safety-${key}`}
                        className="flex items-center gap-2 text-xs text-[color:var(--app-text-soft)]"
                      >
                        <span
                          className={`inline-block h-2 w-2 rounded-full ${
                            Boolean(value)
                              ? 'bg-[color:var(--app-accent)]'
                              : 'bg-[color:var(--app-surface)]'
                          }`}
                        />
                        <span>{humanizeStatus(key)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="mt-2 text-xs text-[color:var(--app-text-soft)]">
                  Checklist keamanan belum tersedia.
                </p>
              )}
            </details>

            {txnActionError ? (
              <div className="mt-3 rounded-lg border border-[color:color-mix(in_srgb,_var(--app-danger-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-danger)_10%,_transparent)] p-2 text-xs text-[color:var(--app-danger)]">
                {txnActionError}
              </div>
            ) : null}
            {txnActionInfo ? (
              <div className="mt-3 rounded-lg border border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] p-2 text-xs text-[color:var(--app-accent)]">
                {txnActionInfo}
              </div>
            ) : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {selectedTxnCanCounter && (
                <button
                  type="button"
                  disabled={
                    txnActionLoading === `counter:${selectedTransaction.id}`
                  }
                  onClick={() => void runCounterOffer(selectedTransaction)}
                  className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] disabled:opacity-60"
                >
                  {txnActionLoading === `counter:${selectedTransaction.id}`
                    ? chatLocale === 'id'
                      ? 'Memproses...'
                      : 'Processing...'
                    : chatLocale === 'id'
                      ? 'Ajukan balik'
                      : 'Counter Offer'}
                </button>
              )}
              {selectedTxnShouldPay && (
                <button
                  type="button"
                  disabled={Boolean(txnActionLoading)}
                  onClick={() =>
                    openPaymentForTransaction({
                      id: selectedTransaction.id,
                      amount_cents: selectedTransaction.amount_cents,
                      currency: selectedTransaction.currency,
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] disabled:opacity-60"
                >
                  <Wallet className="h-3.5 w-3.5" />
                  {chatLocale === 'id' ? 'Bayar' : 'Pay'}
                </button>
              )}
              {selectedTxnCanAccept && (
                <button
                  type="button"
                  disabled={
                    txnActionLoading === `accept:${selectedTransaction.id}`
                  }
                  onClick={() =>
                    void runTransactionAction('accept', selectedTransaction)
                  }
                  className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-accent)] hover:bg-[color:color-mix(in_srgb,_var(--app-accent)_30%,_transparent)] disabled:opacity-60"
                >
                  {txnActionLoading === `accept:${selectedTransaction.id}`
                    ? chatLocale === 'id'
                      ? 'Memproses...'
                      : 'Processing...'
                    : chatLocale === 'id'
                      ? 'Terima'
                      : 'Accept'}
                </button>
              )}
              {selectedTxnCanStart && (
                <button
                  type="button"
                  disabled={
                    txnActionLoading === `start:${selectedTransaction.id}`
                  }
                  onClick={() =>
                    void runTransactionAction('start', selectedTransaction)
                  }
                  className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-info)] hover:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] disabled:opacity-60"
                >
                  {txnActionLoading === `start:${selectedTransaction.id}`
                    ? chatLocale === 'id'
                      ? 'Memproses...'
                      : 'Processing...'
                    : chatLocale === 'id'
                      ? 'Mulai'
                      : 'Start'}
                </button>
              )}
              {selectedTxnCanDeliver && (
                <button
                  type="button"
                  disabled={Boolean(txnActionLoading)}
                  onClick={() =>
                    router.push(
                      `/transactions?focus_transaction_id=${encodeURIComponent(
                        selectedTransaction.id,
                      )}&delivery_action=deliver`,
                    )
                  }
                  className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-group-talent)_20%,_transparent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-group-talent)] hover:bg-[color:color-mix(in_srgb,_var(--app-group-talent)_30%,_transparent)] disabled:opacity-60"
                >
                  {chatLocale === 'id'
                    ? 'Buka Workspace Pengiriman'
                    : 'Open Delivery Workspace'}
                </button>
              )}
              {selectedTxnCanComplete && (
                <button
                  type="button"
                  disabled={Boolean(txnActionLoading)}
                  onClick={() =>
                    router.push(
                      `/transactions?focus_transaction_id=${encodeURIComponent(
                        selectedTransaction.id,
                      )}&delivery_action=review_accept`,
                    )
                  }
                  className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-accent)] hover:bg-[color:color-mix(in_srgb,_var(--app-accent)_30%,_transparent)] disabled:opacity-60"
                >
                  {chatLocale === 'id' ? 'Review Hasil' : 'Review Delivery'}
                </button>
              )}
              {selectedTxnCanCancel && (
                <button
                  type="button"
                  disabled={
                    txnActionLoading === `cancel:${selectedTransaction.id}`
                  }
                  onClick={() =>
                    void runTransactionAction('cancel', selectedTransaction)
                  }
                  className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-danger)_20%,_transparent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-danger)] hover:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)] disabled:opacity-60"
                >
                  {txnActionLoading === `cancel:${selectedTransaction.id}`
                    ? chatLocale === 'id'
                      ? 'Memproses...'
                      : 'Processing...'
                    : chatLocale === 'id'
                      ? 'Batalkan'
                      : 'Cancel'}
                </button>
              )}
              {selectedTxnCanDispute && (
                <button
                  type="button"
                  disabled={
                    txnActionLoading === `dispute:${selectedTransaction.id}`
                  }
                  onClick={() =>
                    void runTransactionAction('dispute', selectedTransaction)
                  }
                  className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-warning)_20%,_transparent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-warning)] hover:bg-[color:color-mix(in_srgb,_var(--app-warning)_30%,_transparent)] disabled:opacity-60"
                >
                  {txnActionLoading === `dispute:${selectedTransaction.id}`
                    ? chatLocale === 'id'
                      ? 'Memproses...'
                      : 'Processing...'
                    : chatLocale === 'id'
                      ? 'Komplain'
                      : 'Dispute'}
                </button>
              )}
            </div>

            <div className="mt-4 flex items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Link
                  href={`/transactions?focus_transaction_id=${encodeURIComponent(selectedTransaction.id)}`}
                  className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_18%,_transparent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-accent)] hover:bg-[color:color-mix(in_srgb,_var(--app-accent)_24%,_transparent)]"
                >
                  {chatLocale === 'id' ? 'Workspace order' : 'Order workspace'}
                </Link>
                <Link
                  href="/support"
                  className="rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
                >
                  {chatLocale === 'id' ? 'Hubungi support' : 'Contact support'}
                </Link>
              </div>
              <button
                type="button"
                onClick={() => setSelectedTransaction(null)}
                className="rounded-full bg-[color:var(--app-accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent-strong)]"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Incoming Call */}
      {incomingCall && channelRef.current && (
        <IncomingCall
          callId={incomingCall.callId}
          callerId={incomingCall.callerId}
          callerName={incomingCall.callerName}
          callerAvatar={incomingCall.callerAvatar}
          callType={incomingCall.callType}
          onAccept={async () => {
            try {
              void soundManager.unlock();
              channelRef.current?.push('call_accept', {
                call_id: incomingCall.callId,
              });
              setActiveCallId(incomingCall.callId);
              setActiveCallIsCaller(false);
              const callType = incomingCall.callType;
              setIncomingCall(null);
              setTimeout(() => {
                if (callType === 'video') setShowVideoCall(true);
                else setShowVoiceCall(true);
              }, 100);
            } catch {
              setActiveCallIsCaller(false);
              setIncomingCall(null);
            }
          }}
          onReject={() => {
            try {
              channelRef.current?.push('call_reject', {
                call_id: incomingCall.callId,
              });
            } catch {}
            setIncomingCall(null);
          }}
        />
      )}

      {/* Video Call */}
      {showVideoCall &&
        user?.id &&
        canonicalRoomId &&
        activeCallId &&
        channelRef.current && (
          <VideoCall
            roomId={canonicalRoomId}
            userId={user.id}
            callId={activeCallId}
            channel={channelRef.current}
            isCaller={activeCallIsCaller}
            onClose={() => {
              setShowVideoCall(false);
              setActiveCallId(null);
              setActiveCallIsCaller(false);
            }}
          />
        )}

      {/* Voice Call */}
      {showVoiceCall &&
        user?.id &&
        canonicalRoomId &&
        activeCallId &&
        channelRef.current && (
          <VoiceCall
            roomId={canonicalRoomId}
            userId={user.id}
            callId={activeCallId}
            channel={channelRef.current}
            isCaller={activeCallIsCaller}
            userName={roomName}
            onClose={() => {
              setShowVoiceCall(false);
              setActiveCallId(null);
              setActiveCallIsCaller(false);
            }}
          />
        )}

      {/* Camera */}
      <CameraCaptureModal
        open={showCameraModal}
        onClose={() => setShowCameraModal(false)}
        onCapture={file => {
          const dt = new DataTransfer();
          dt.items.add(file);
          handleFilesSelected(dt.files);
        }}
      />
    </div>
  );
}
