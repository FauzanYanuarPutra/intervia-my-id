'use client';

import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useSearchParams } from 'next/navigation';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { CONTENT_TYPES, getContentTypeName } from '@/data/contentTypes';
import { resolveMarketplaceCreatePath } from '@/lib/createRoutes';
import { PROMO_ONLY_MODE } from '@/lib/featureFlags';
import {
  getSectorDescription,
  getSectorLabel,
  useSectors,
} from '@/context/SectorContext';
import { getSubSectors, getSubSectorName } from '@/data/subSectors';
import { getFieldsForCreate, needsImageGallery } from '@/data/sectorFields';
import type { SectorField } from '@/data/sectorFields';
import { normalizeContentMediaUrl } from '@/lib/content/catalog';
import { normalizePriceUnit } from '@/lib/content/priceUnit';
import { readSocialConnections } from '@/lib/content/distribution';
import { LISTING_TEMPLATES } from '@/lib/content/listingTemplates';
import { buildContentHref } from '@/lib/content/routes';
import {
  detectForeignBrandSignals,
  formatForeignBrandSignalSummary,
} from '@/lib/content/localPriorityGuardrails';
import {
  createPromotionSnapshot,
  DEFAULT_PROMOTION_OPEX_PERCENT,
  DEFAULT_PROMOTION_PLATFORM_FEE_PERCENT,
  DEFAULT_PROMOTION_TAX_PERCENT,
  derivePromotionTopLevelFields,
  isPrimaryPromotionOfferType,
  normalizePromotionOfferType,
  type PromotionOfferType,
  type PromotionSnapshot,
} from '@/lib/content/promotionPrograms';
import {
  filterFieldsForListingSide,
  getDefaultListingSide,
  getListingSideContextLabel,
  isListingSideEditable,
  resolveListingSide,
  supportsDemandListing,
  toMarketSideValue,
  type ListingSide,
} from '@/lib/content/listingSide';
import { UMKM_JOURNEY_STEPS } from '@/lib/umkmBusinessFlow';
import {
  extractUploadedContentDocumentFiles,
  extractUploadedContentImageUrls,
} from '@/lib/content/uploadMedia';
import { prepareUploadFiles } from '@/lib/media/prepareUploadMedia';
import { validateListingPayload } from '@/lib/content/listingFlowRules';
import { useAppBack } from '@/lib/navigation/useAppBack';
import { IMAGE_UPLOAD_RAW_MAX_MB } from '@/lib/media/uploadStandard';
import { DetailAccordion } from '@/components/ui/DetailAccordion';
import { ImageUpload } from '@/components/ui/ImageUpload';
import { CreatePageSkeleton } from '@/components/system/feedback/RouteSkeletons';
import { CreatePageHeader } from './CreatePageHeader';
import { CreateListingTemplatePicker } from './CreateListingTemplatePicker';
import { CreateSharePackPanel } from './CreateSharePackPanel';
import {
  buildCreateHrefFromSearch,
  clampStep,
  cleanText,
  collectImageUrls,
  compactSubmissionValue,
  type CreateFlowIntent,
  type ContentItem,
  DOC_ACCEPT,
  type DocumentFile,
  DOC_MAX_BYTES,
  DOC_MAX_FILES,
  extractContentId,
  extractListingMediaUrls,
  formatFileSize,
  formatListingIssuesForUi,
  DEFAULT_STEP_LABELS_EN,
  DEFAULT_STEP_LABELS_ID,
  buildCreateBasePath,
  isAllowedDocument,
  type ImageFile,
  type ListingTypeId,
  makeUploadDraftId,
  normalizeListingSideParam,
  parseDocuments,
  resolveDisplayFieldLabel,
  revokePreviewUrl,
  supportsSectorClassification,
  TOTAL_STEPS,
} from './createPageUtils';
import { cn } from '@/lib/utils';
import {
  BadgeDollarSign,
  BadgePercent,
  BriefcaseBusiness,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  FileText,
  FolderKanban,
  Gift,
  Handshake,
  ImageIcon,
  Loader2,
  MapPin,
  Megaphone,
  Trophy,
  ScanLine,
  ShieldCheck,
  Search,
  Snowflake,
  Sparkles,
  Store,
  Target,
  Tag,
  Upload,
  Users,
  Wrench,
  X,
  Package,
  type LucideIcon,
} from 'lucide-react';

type PromotionOfferCardMeta = {
  offerType: PromotionOfferType;
  icon: LucideIcon;
  titleId: string;
  titleEn: string;
  descId: string;
  descEn: string;
  benefitId: string;
  benefitEn: string;
};

const PROMOTION_PRIMARY_CARDS: PromotionOfferCardMeta[] = [
  {
    offerType: 'discount',
    icon: BadgePercent,
    titleId: 'Diskon langsung',
    titleEn: 'Direct discount',
    descId: 'Gampang dipahami, enak buat narik klik dan checkout.',
    descEn: 'Easy to understand and strong for clicks or checkout.',
    benefitId: 'Paling kerasa',
    benefitEn: 'Fastest perceived value',
  },
  {
    offerType: 'loyalty_card',
    icon: Gift,
    titleId: 'Kartu loyalti',
    titleEn: 'Loyalty card',
    descId: 'Bikin orang balik lagi tanpa motong margin di semua order.',
    descEn: 'Encourages repeat orders without cutting every transaction.',
    benefitId: 'Paling oke buat repeat',
    benefitEn: 'Healthiest for repeat orders',
  },
  {
    offerType: 'raffle',
    icon: Trophy,
    titleId: 'Raffle hadiah',
    titleEn: 'Prize raffle',
    descId: 'Lebih seru dan rame, tapi biayanya masih bisa dijaga.',
    descEn: 'Feels exciting while keeping the campaign cost bounded.',
    benefitId: 'Paling irit buat rame-rame',
    benefitEn: 'Most cost-efficient at scale',
  },
];

const PROMOTION_SECONDARY_OFFER_TYPES: PromotionOfferType[] = [
  'bundle',
  'free_shipping',
  'bonus',
  'referral',
];
type TypeConfigMeta = {
  headlineId: string;
  headlineEn: string;
  descId: string;
  descEn: string;
  stepsId: [string, string, string, string];
  stepsEn: [string, string, string, string];
  step1Keys: string[];
  step2HintId: string;
  step2HintEn: string;
};
type TypeThemeMeta = {
  stepActive: string;
  cardSelected: string;
  cardBase: string;
  cardIcon: string;
  buttonPrimary: string;
  badge: string;
};
type TypePickerMeta = {
  helperId: string;
  helperEn: string;
};
type TypeChecklistMeta = {
  titleId: string;
  titleEn: string;
  itemsId: string[];
  itemsEn: string[];
  noteId?: string;
  noteEn?: string;
  href?: string;
  hrefLabelId?: string;
  hrefLabelEn?: string;
};
type TypeVisualChecklistMeta = {
  itemsId: string[];
  itemsEn: string[];
};
type DemandTypeMeta = {
  stepsId: [string, string, string, string];
  stepsEn: [string, string, string, string];
  step2HintId: string;
  step2HintEn: string;
};
type QuickFieldActionTone = 'accent' | 'muted' | 'danger';
type QuickFieldAction = {
  key: string;
  label: string;
  tone?: QuickFieldActionTone;
  onClick: () => void;
};

const SIMPLE_MODE_ALLOWED_TYPES = new Set<ListingTypeId>([
  'product',
  'service',
  'job',
  'property',
  'tool_rental',
  'business_transfer',
  'company',
]);
const PRIMARY_IMAGE_REQUIRED_TYPES = new Set<ListingTypeId>([
  'product',
  'property',
  'tool_rental',
  'business_transfer',
]);
const CORE_DEMAND_CREATE_TYPE_IDS = new Set<ListingTypeId>([
  'product',
  'service',
  'job',
  'property',
  'tool_rental',
]);

function supportsSimpleListingMode(type: string): boolean {
  return SIMPLE_MODE_ALLOWED_TYPES.has(type as ListingTypeId);
}

function getDefaultPriceUnitForType(
  type: string,
  listingSide: ListingSide,
): string {
  if (type === 'property') return 'month';
  if (type === 'tool_rental') return 'day';
  if (type === 'job') return 'month';
  if (type === 'service')
    return listingSide === 'demand' ? 'project' : 'project';
  if (type === 'business_transfer') return 'deal';
  if (type === 'product') return listingSide === 'demand' ? 'shipment' : 'pcs';
  return '';
}

function getSimpleModePinnedFieldKeys(
  type: ListingTypeId,
  listingSide: ListingSide,
): string[] {
  switch (type) {
    case 'product':
    case 'property':
    case 'tool_rental':
      return listingSide === 'demand'
        ? ['title', 'price_cents', 'location']
        : ['title', 'price_cents', 'location'];
    case 'business_transfer':
      return ['title', 'price_cents', 'location'];
    case 'service':
      return listingSide === 'demand'
        ? ['title', 'price_cents', 'location']
        : ['title', 'price_cents', 'location'];
    case 'job':
      return ['title', 'salary_range', 'location'];
    case 'company':
      return ['title', 'company_name'];
    default:
      return ['title'];
  }
}

function formatQuickPrice(rawValue: string, locale: string): string | null {
  const normalized = rawValue.replace(/\D/g, '');
  if (!normalized) return null;
  const amount = Number.parseInt(normalized, 10);
  if (!Number.isFinite(amount) || amount <= 0) return null;
  return new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

function buildSimpleModeFallbackCopy({
  title,
  locale,
  listingSide,
  price,
  location,
}: {
  title: string;
  locale: string;
  listingSide: ListingSide;
  price?: string;
  location?: string;
}): { summary: string; body: string } {
  const isId = locale === 'id';
  const formattedPrice = price ? formatQuickPrice(price, locale) : null;
  const cleanLocation = cleanText(location);
  const summaryPrice = formattedPrice
    ? isId
      ? ` Kisaran harga ${formattedPrice}.`
      : ` Reference price ${formattedPrice}.`
    : '';
  const summaryLocation = cleanLocation
    ? isId
      ? ` Area ${cleanLocation}.`
      : ` Area ${cleanLocation}.`
    : '';

  if (listingSide === 'demand') {
    return {
      summary: isId
        ? `${title}.${summaryPrice}${summaryLocation}`
        : `${title}. This core need is posted fast.${summaryPrice}${summaryLocation}`,
      body: isId
        ? `Kebutuhan inti sudah ditulis. ${formattedPrice ? `Budget ${formattedPrice}. ` : ''
        }${cleanLocation ? `Area ${cleanLocation}. ` : ''
        }Detail tambahan bisa ditulis kalau perlu.`
        : `${title}. This brief was created quickly so relevant offers can arrive first. ${formattedPrice ? `Reference budget ${formattedPrice}. ` : ''
        }${cleanLocation ? `Work or delivery area: ${cleanLocation}. ` : ''
        }More detail can be added after responses start coming in.`,
    };
  }

  return {
    summary: isId
      ? `${title}.${summaryPrice}${summaryLocation}`
      : `${title}. This core offer is posted fast.${summaryPrice}${summaryLocation}`,
    body: isId
      ? `Penawaran inti sudah ditulis. ${formattedPrice ? `Harga ${formattedPrice}. ` : ''
      }${cleanLocation ? `Area ${cleanLocation}. ` : ''
      }Detail tambahan bisa ditulis kalau perlu.`
      : `${title}. This listing was created quickly so people can grasp the main offer first. ${formattedPrice ? `Reference price ${formattedPrice}. ` : ''
      }${cleanLocation ? `Primary area ${cleanLocation}. ` : ''
      }More detail can be added after the listing starts getting traction.`,
  };
}

type CreateEntryAction = {
  key: string;
  href: string;
  title: string;
  description: string;
  chips: string[];
  Icon: LucideIcon;
  tone: string;
};

function CreateEntryActionCard({ item }: { item: CreateEntryAction }) {
  const Icon = item.Icon;

  return (
    <Link
      href={item.href}
      data-testid="create-entry-action-card"
      className="group flex min-h-[124px] flex-col justify-between rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 text-left shadow-[0_14px_28px_-28px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_20px_34px_-30px_rgba(15,23,42,0.24)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70 sm:min-h-[150px] sm:p-3.5"
    >
      <span
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-[15px] sm:h-11 sm:w-11 sm:rounded-[16px]',
          item.tone,
        )}
      >
        <Icon className="h-5 w-5 sm:h-6 sm:w-6" />
      </span>
      <span className="mt-2.5 block">
        <span className="line-clamp-2 block text-[13px] font-black leading-tight text-[color:var(--app-text)] sm:text-[14px]">
          {item.title}
        </span>
        <span className="mt-1 block line-clamp-2 text-[10.5px] leading-4 text-[color:var(--app-text-soft)] sm:text-[11px] sm:leading-5">
          {item.description}
        </span>
      </span>
      <span className="mt-2 flex items-center justify-between gap-2">
        <span className="flex min-w-0 gap-1 overflow-hidden">
          {item.chips.slice(0, 1).map(chip => (
            <span
              key={chip}
              className="truncate rounded-full bg-[color:var(--app-surface-muted)] px-2 py-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]"
            >
              {chip}
            </span>
          ))}
        </span>
        <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] sm:h-8 sm:w-8">
          <ChevronRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5 sm:h-4 sm:w-4" />
        </span>
      </span>
    </Link>
  );
}

function CreateHeroShell({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      data-section-shell-hero="true"
      className={cn(
        'ui-feed-section ui-section-shell relative overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-white px-4 py-5 shadow-[0_18px_38px_-36px_rgba(15,23,42,0.18)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:px-5 sm:py-5',
        className,
      )}
    >
      <div className="relative">{children}</div>
    </div>
  );
}

function CreateFormSectionCard({
  eyebrow,
  title,
  description,
  aside,
  children,
  className,
}: {
  eyebrow: string;
  title: string;
  description: string;
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cn(
        'ui-section-shell relative overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-white px-3 py-3 shadow-[0_14px_30px_-30px_rgba(15,23,42,0.14)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:rounded-[18px] sm:px-4 sm:py-4',
        className,
      )}
    >
      <div className="relative flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 pb-2 dark:border-slate-800/70">
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 text-[15px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {title}
          </h2>
          <p className="mt-0.5 hidden line-clamp-1 max-w-2xl text-[11px] leading-4 text-[color:var(--app-text-soft)] sm:block">
            {description}
          </p>
        </div>
        {aside ? <div className="shrink-0">{aside}</div> : null}
      </div>
      <div className="relative mt-3 space-y-2.5">{children}</div>
    </section>
  );
}

function CreateChoiceCard({
  badge,
  title,
  description,
  example,
  highlights,
  actionLabel,
  Icon,
  theme,
  selected,
  disabled,
  onClick,
}: {
  badge: string;
  title: string;
  description: string;
  example?: string;
  highlights?: string[];
  actionLabel: string;
  Icon: LucideIcon;
  theme: TypeThemeMeta;
  selected: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={`${title}. ${actionLabel}`}
      className={cn(
        'group relative flex min-h-[124px] w-full flex-col justify-end overflow-hidden rounded-[18px] border px-3 pb-2.5 pt-12 text-left shadow-[0_14px_28px_-28px_rgba(15,23,42,0.2)] transition disabled:cursor-not-allowed disabled:opacity-60 sm:min-h-[150px] sm:px-3.5 sm:pb-3 sm:pt-14',
        selected
          ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_28%,white)] shadow-[0_18px_34px_-30px_rgba(15,23,42,0.22)] ring-1 ring-[color:var(--app-accent-border)] dark:border-[color:var(--app-accent-border)] dark:bg-[color:color-mix(in_srgb,var(--app-accent-soft)_16%,rgba(15,23,42,0.94))]'
          : `${theme.cardBase} hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_20px_34px_-30px_rgba(15,23,42,0.24)]`,
      )}
    >
      <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-current/20" />
      <span
        className={`absolute left-3 top-3 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[13px] sm:h-10 sm:w-10 sm:rounded-[15px] ${selected
            ? 'bg-[color:var(--app-accent)] text-white shadow-[0_14px_26px_-18px_rgba(4,120,87,0.72)]'
            : theme.cardIcon
          }`}
      >
        <Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
      </span>
      <span className="mt-auto block min-w-0">
        <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[color:var(--app-text-soft)] sm:text-[10px] sm:tracking-[0.12em]">
          {badge}
        </span>
        <span className="mt-1 line-clamp-2 block text-[13px] font-black leading-tight text-[color:var(--app-text)] sm:text-[14px]">
          {title}
        </span>
        <span className="mt-1 hidden line-clamp-2 text-[11px] leading-5 text-[color:var(--app-text-soft)] min-[420px]:block">
          {description}
        </span>
        {example ? (
          <span className="mt-2 block rounded-[12px] bg-white/78 px-2.5 py-1.5 text-[10.5px] font-semibold leading-4 text-[color:var(--app-text)] ring-1 ring-white/80 dark:bg-slate-950/48 dark:ring-white/10 sm:text-[11px]">
            <span className="font-black text-[color:var(--app-accent)]">
              {example.startsWith('Example:')
                ? 'Example:'
                : example.startsWith('Contoh:')
                  ? 'Contoh:'
                  : 'Contoh:'}
            </span>{' '}
            {example.replace(/^(Contoh:|Example:)\s*/i, '')}
          </span>
        ) : null}
      </span>
      <span className="mt-2 flex w-full items-center justify-between gap-2">
        <span className="min-w-0 flex-1 truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
          {highlights?.[0] || actionLabel}
        </span>
        <span
          className={cn(
            'inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full transition sm:h-8 sm:w-8',
            selected
              ? 'bg-[color:var(--app-accent)] text-white'
              : 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:bg-slate-900/80',
          )}
        >
          {selected ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
          )}
        </span>
      </span>
    </button>
  );
}

function getCreateChoiceExample(
  type: ListingTypeId,
  listingSide: ListingSide,
  locale: string,
): string {
  const isId = locale === 'id';
  const demand = listingSide === 'demand';

  if (type === 'product') {
    return demand
      ? isId
        ? 'Contoh: cari supplier kopi 10 kg/bulan Bandung'
        : 'Example: find a coffee supplier for 10 kg/month in Bandung'
      : isId
        ? 'Contoh: supplier kemasan standing pouch 1.000 pcs'
        : 'Example: standing pouch packaging supplier, 1,000 pcs';
  }

  if (type === 'service') {
    return demand
      ? isId
        ? 'Contoh: cari jasa foto produk untuk katalog skincare'
        : 'Example: need product photos for a skincare catalog'
      : isId
        ? 'Contoh: jasa host live shopping Tangerang'
        : 'Example: live-shopping host service in Tangerang';
  }

  if (type === 'property') {
    return demand
      ? isId
        ? 'Contoh: cari booth bazaar 3 hari area BSD'
        : 'Example: looking for a three-day bazaar booth in BSD'
      : isId
        ? 'Contoh: sewa kios kuliner dekat kampus Bandung'
        : 'Example: rent a food kiosk near a Bandung campus';
  }

  if (type === 'tool_rental') {
    return demand
      ? isId
        ? 'Contoh: cari sewa freezer display 1 minggu'
        : 'Example: need a display freezer rental for one week'
      : isId
        ? 'Contoh: sewa tenda lipat event booth Bandung'
        : 'Example: folding tent rental for an event booth in Bandung';
  }

  if (type === 'job') {
    return isId
      ? 'Contoh: cari admin toko online shift sore Jakarta'
      : 'Example: hiring an online-store admin for evening shift in Jakarta';
  }

  if (type === 'business_transfer') {
    return isId
      ? 'Contoh: oper usaha laundry aktif dengan alat dan SOP'
      : 'Example: transfer an active laundry business with assets and SOP';
  }

  return isId
    ? 'Contoh: tulis kebutuhan atau penawaran yang paling dekat'
    : 'Example: describe the closest need or offer';
}

function getQuickCreateExamples(
  type: ListingTypeId,
  locale: string,
  listingSide: ListingSide,
): string[] {
  const isId = locale === 'id';

  if (type === 'job') {
    return isId
      ? [
        'Judul: Cari admin live TikTok untuk brand F&B Jakarta',
        'Budget: Rp 4.500.000 / bulan',
        'Lokasi: Jakarta Barat, shift sore',
      ]
      : [
        'Title: Need a TikTok live admin for an F&B brand in Jakarta',
        'Budget: IDR 4,500,000 / month',
        'Location: West Jakarta, afternoon shift',
      ];
  }

  if (type === 'property') {
    return listingSide === 'demand'
      ? isId
        ? [
          'Judul: Cari booth bazaar untuk brand cemilan area BSD',
          'Budget: Maks Rp 1.000.000 / minggu',
          'Lokasi: BSD, traffic event atau kampus',
        ]
        : [
          'Title: Looking for a bazaar booth for a snack brand in BSD',
          'Budget: Max IDR 1,000,000 / week',
          'Location: BSD, event or campus traffic',
        ]
      : isId
        ? [
          'Judul: Booth bazaar BSD untuk brand kuliner dan cemilan',
          'Harga: Rp 950.000 / minggu',
          'Lokasi: BSD, Tangerang',
        ]
        : [
          'Title: BSD bazaar booth for food and snack brands',
          'Price: IDR 950,000 / week',
          'Location: BSD, Tangerang',
        ];
  }

  if (type === 'service') {
    return listingSide === 'demand'
      ? isId
        ? [
          'Judul: Cari channel reseller skincare dan host live commerce',
          'Budget: Rp 12.000.000 / aktivasi awal',
          'Lokasi: Bandung / hybrid',
        ]
        : [
          'Title: Need reseller channel support and live-commerce hosts',
          'Budget: IDR 12,000,000 / initial activation',
          'Location: Bandung / hybrid',
        ]
      : isId
        ? [
          'Judul: Paket admin Shopee dan Tokopedia 30 hari',
          'Harga: Rp 1.250.000',
          'Lokasi: Jakarta Selatan / remote',
        ]
        : [
          'Title: Shopee and Tokopedia admin package for 30 days',
          'Price: IDR 1,250,000',
          'Location: South Jakarta / remote',
        ];
  }

  if (type === 'tool_rental') {
    return listingSide === 'demand'
      ? isId
        ? [
          'Judul: Cari sewa freezer display untuk bazaar minuman',
          'Budget: Rp 700.000 / 3 hari',
          'Lokasi: Depok, pick up fleksibel',
        ]
        : [
          'Title: Need a freezer display rental for a beverage bazaar',
          'Budget: IDR 700,000 / 3 days',
          'Location: Depok, flexible pickup',
        ]
      : isId
        ? [
          'Judul: Sewa vacuum sealer dan mesin label usaha Bekasi',
          'Harga: Rp 450.000 / 3 hari',
          'Lokasi: Bekasi',
        ]
        : [
          'Title: Vacuum sealer and label machine rental for businesses in Bekasi',
          'Price: IDR 450,000 / 3 days',
          'Location: Bekasi',
        ];
  }

  if (type === 'business_transfer') {
    return isId
      ? [
        'Judul: Oper usaha laundry berjalan area Bekasi',
        'Harga: Rp 185.000.000 nego',
        'Lokasi: Bekasi, omzet 6 bulan siap dicek',
      ]
      : [
        'Title: Running laundry business transfer in Bekasi',
        'Price: IDR 185,000,000 negotiable',
        'Location: Bekasi, six-month revenue can be reviewed',
      ];
  }

  if (type === 'company') {
    return isId
      ? [
        'Nama: PT Sumber Niaga Nusantara',
        'Bidang: Distribusi bahan baku dan kemasan usaha',
        'Lokasi: Tangerang',
      ]
      : [
        'Name: PT Sumber Niaga Nusantara',
        'Field: Raw material and packaging distribution for businesses',
        'Location: Tangerang',
      ];
  }

  return listingSide === 'demand'
    ? isId
      ? [
        'Judul: Cari supplier sembako untuk warung & toko area Tangerang',
        'Budget: Mulai Rp 8.000.000 / pengiriman',
        'Lokasi: Tangerang Selatan, kirim rutin',
      ]
      : [
        'Title: Looking for a grocery supplier for stores in Tangerang',
        'Budget: Starting at IDR 8,000,000 / shipment',
        'Location: South Tangerang, recurring delivery',
      ]
    : isId
      ? [
        'Judul: Distributor cemilan kemasan untuk reseller Cikarang',
        'Harga: Rp 185.000 / karton',
        'Lokasi: Cikarang, kirim Jabodetabek',
      ]
      : [
        'Title: Packaged snack distributor for resellers in Cikarang',
        'Price: IDR 185,000 / carton',
        'Location: Cikarang, ships across Greater Jakarta',
      ];
}

function getFieldExample(
  fieldKey: string,
  locale: string,
  type: ListingTypeId,
  listingSide: ListingSide,
): string | null {
  const isId = locale === 'id';
  const key = fieldKey.toLowerCase();

  if (key === 'title') {
    return getQuickCreateExamples(type, locale, listingSide)[0] || null;
  }
  if (key.includes('summary')) {
    if (type === 'business_transfer') {
      return isId
        ? 'Usaha berjalan, omzet stabil, aset siap dicek, alasan ditawarkan jelas.'
        : 'Running business with stable revenue, verifiable assets, and a clear reason for sale.';
    }
    if (listingSide === 'demand' && type === 'product') {
      return isId
        ? 'Cari supplier sembako dengan MOQ fleksibel, harga grosir, dan kirim rutin ke toko.'
        : 'Need a grocery supplier with flexible MOQ, wholesale pricing, and recurring delivery.';
    }
    if (listingSide === 'demand' && type === 'service') {
      return isId
        ? 'Cari jasa atau channel operasional seperti host live, reseller aktif, admin marketplace, atau vendor eksekusi dengan output jelas.'
        : 'Need an operations or channel partner such as live hosts, active resellers, marketplace admins, or an execution vendor with clear output.';
    }
    if (listingSide === 'demand' && type === 'property') {
      return isId
        ? 'Cari booth, kios, atau ruko yang cocok untuk channel jualan dan budget bisnis.'
        : 'Looking for a booth, kiosk, or shophouse that fits the sales channel and budget.';
    }
    if (listingSide === 'demand' && type === 'job') {
      return isId
        ? 'Cari talent untuk closing, konten, operasional.'
        : 'Need talent who can immediately support sales, content, or day-to-day operations.';
    }
    return isId
      ? 'Singkat. Jelas. Benefit utama.'
      : 'Keep it short, clear, and focused on the main benefit.';
  }
  if (key === 'body' || key.includes('description')) {
    if (type === 'business_transfer') {
      return isId
        ? 'Tulis alasan ditawarkan, omzet rata-rata, biaya operasional, aset yang ikut, rating/review, akun yang bisa dipindahkan, hutang/kontrak, dan skema handover.'
        : 'Describe the reason for sale, average revenue, operational costs, included assets, ratings/reviews, transferable accounts, liabilities/contracts, and handover flow.';
    }
    if (listingSide === 'demand' && type === 'product') {
      return isId
        ? 'Tulis barang yang dicari, volume, merek wajib, area kirim, target datang, dan syarat supplier.'
        : 'State the item needed, volume, required brands, delivery area, target arrival, and supplier conditions.';
    }
    if (listingSide === 'demand' && type === 'service') {
      return isId
        ? 'Tulis channel, target launch, partner, output, deadline.'
        : 'Explain the business channel, launch target, partner profile needed, output, revision expectation, and execution deadline.';
    }
    if (listingSide === 'demand' && type === 'property') {
      return isId
        ? 'Tulis area, traffic, ukuran, parkir, target mulai.'
        : 'Describe the target area, traffic needed, minimum size, parking access, and target start date.';
    }
    if (listingSide === 'demand' && type === 'job') {
      return isId
        ? 'Tulis role, shift, tools, KPI, tanggal mulai.'
        : 'Describe the role target, work shift, tools used, KPI, and when the person needs to start.';
    }
    return isId
      ? 'Tulis kondisi, spesifikasi, benefit, dan cara transaksi secara singkat.'
      : 'Write the condition, specs, benefit, and transaction flow briefly.';
  }
  if (key === 'price_unit') {
    if (type === 'property') return 'month';
    if (type === 'tool_rental') return 'day';
    if (type === 'job') return 'month';
    if (type === 'service') return 'project';
    if (type === 'business_transfer') return 'deal';
    return listingSide === 'demand' ? 'shipment' : 'pcs';
  }
  if (
    key.includes('price') ||
    key.includes('budget') ||
    key.includes('salary') ||
    key.includes('rent') ||
    key.includes('rate')
  ) {
    if (type === 'job') return '4500000 - 5500000';
    if (type === 'service')
      return listingSide === 'demand' ? '12000000' : '1250000';
    if (type === 'property')
      return listingSide === 'demand' ? '1000000' : '950000';
    if (type === 'tool_rental')
      return listingSide === 'demand' ? '700000' : '450000';
    if (type === 'business_transfer') return '185000000';
    return listingSide === 'demand' ? '8000000' : '185000';
  }
  if (
    key.includes('location') ||
    key.includes('city') ||
    key.includes('address')
  ) {
    if (type === 'property') return isId ? 'BSD, Tangerang' : 'BSD, Tangerang';
    if (type === 'service') {
      return listingSide === 'demand'
        ? isId
          ? 'Bandung'
          : 'Bandung'
        : isId
          ? 'Jakarta Selatan'
          : 'South Jakarta';
    }
    if (type === 'job') return isId ? 'Jakarta Barat' : 'West Jakarta';
    if (type === 'tool_rental') return isId ? 'Depok' : 'Depok';
    if (type === 'business_transfer') return isId ? 'Bekasi' : 'Bekasi';
    return isId ? 'Tangerang Selatan' : 'South Tangerang';
  }
  if (key === 'business_name') {
    return isId ? 'Laundry Kilat Bekasi' : 'Laundry Kilat Bekasi';
  }
  if (key === 'business_category') {
    return 'service';
  }
  if (key === 'business_age_months') {
    return '18';
  }
  if (key === 'average_monthly_revenue_cents') {
    return '42000000';
  }
  if (key === 'average_monthly_profit_cents') {
    return '11000000';
  }
  if (key === 'monthly_operational_cost_cents') {
    return '26000000';
  }
  if (key === 'included_assets') {
    return isId
      ? 'Mesin cuci 4 unit, dryer 2 unit, stok deterjen, rak, meja kasir, banner, dan perlengkapan outlet.'
      : 'Four washing machines, two dryers, detergent stock, racks, cashier desk, banner, and outlet equipment.';
  }
  if (key === 'handover_items') {
    return isId
      ? 'SOP operasional, kontak supplier, template promosi, file harga, training owner 7 hari, dan daftar pelanggan yang boleh dialihkan.'
      : 'Operational SOP, supplier contacts, promo templates, price files, seven-day owner training, and transferable customer list.';
  }
  if (key === 'rating_summary') {
    return isId
      ? 'Google Maps 4,8 dari 320 review'
      : 'Google Maps 4.8 from 320 reviews';
  }
  if (key === 'rating_transfer_policy') {
    return 'included_needs_platform_approval';
  }
  if (key === 'transferable_channels') {
    return isId
      ? 'Google Maps, marketplace, nomor outlet, website, dan katalog pelanggan jika disetujui platform/pihak terkait.'
      : 'Google Maps, marketplace, outlet number, website, and customer catalog if approved by each platform or party.';
  }
  if (key === 'lease_contract_status') {
    return 'lease_needs_approval';
  }
  if (key === 'liabilities_note') {
    return isId
      ? 'Tidak ada hutang supplier. Sewa outlet perlu approval pemilik. Pajak dan utilitas berjalan dibuka saat due diligence.'
      : 'No supplier debt. Outlet lease needs owner approval. Current tax and utility records can be reviewed during due diligence.';
  }
  if (key === 'optional_extra_costs') {
    return isId
      ? 'Opsional: deposit sewa lanjutan, notaris, biaya ganti nama akun bila disetujui platform.'
      : 'Optional: continued lease deposit, notary, account name-change fees if approved by platforms.';
  }
  if (key === 'reason_for_sale') {
    return isId
      ? 'Owner pindah domisili dan ingin fokus ke usaha lain.'
      : 'Owner is relocating and wants to focus on another business.';
  }
  if (key === 'handover_timeline') {
    return isId
      ? '14 hari setelah tanda jadi dan verifikasi dokumen'
      : '14 days after deposit and document verification';
  }
  if (key === 'training_support') {
    return isId
      ? 'Training owner 7 hari + pendampingan chat 30 hari'
      : 'Seven-day owner training plus 30-day chat support';
  }
  if (key === 'staff_transfer_note') {
    return isId
      ? '2 staf operasional bersedia lanjut jika cocok dengan owner baru.'
      : 'Two operational staff are open to continue if aligned with the new owner.';
  }
  if (key === 'ownership_proof') {
    return isId
      ? 'Invoice aset, kontrak sewa, NIB, dan akses dashboard siap dicek saat due diligence.'
      : 'Asset invoices, lease contract, business registration, and dashboard access can be reviewed during due diligence.';
  }
  if (key === 'legal_transfer_note') {
    return isId
      ? 'Alih kelola mengikuti persetujuan pemilik lokasi dan aturan platform. Akun yang tidak boleh dipindah tidak termasuk transaksi.'
      : 'Transfer follows location-owner approval and platform rules. Accounts that cannot be transferred are excluded from the deal.';
  }
  if (key === 'handover_risks') {
    return isId
      ? 'Omzet turun saat musim libur panjang, lokasi bergantung traffic kos/kampus, dan sewa perlu approval pemilik.'
      : 'Revenue drops during long holidays, location depends on boarding-house/campus traffic, and lease transfer needs owner approval.';
  }
  if (key.includes('company')) {
    return isId ? 'CV Dapur Tumbuh Jaya' : 'CV Dapur Tumbuh Jaya';
  }
  if (key.includes('skill')) {
    return isId
      ? 'Admin marketplace, Canva, balas chat cepat'
      : 'Marketplace admin, Canva, fast chat handling';
  }
  if (key.includes('experience')) {
    return isId ? '2' : '2';
  }
  if (key.includes('tag')) {
    if (type === 'property') {
      return isId
        ? 'booth bazaar, kios, ruko, traffic'
        : 'bazaar booth, kiosk, shophouse, traffic';
    }
    if (type === 'service') {
      return listingSide === 'demand'
        ? isId
          ? 'reseller, live host, channel launch'
          : 'resellers, live hosts, launch channel'
        : isId
          ? 'admin marketplace, konten, foto produk'
          : 'marketplace admin, content, product photos';
    }
    if (type === 'tool_rental') {
      return isId
        ? 'freezer, vacuum sealer, kamera konten'
        : 'freezer, vacuum sealer, content camera';
    }
    if (type === 'business_transfer') {
      return isId
        ? 'oper usaha, usaha berjalan, laundry, handover'
        : 'business transfer, running business, laundry, handover';
    }
    return isId
      ? 'supplier, sembako, MOQ, area kirim'
      : 'supplier, groceries, MOQ, delivery area';
  }
  if (
    key.includes('portfolio') ||
    key.includes('website') ||
    key.includes('url')
  ) {
    return 'https://example.com/portfolio';
  }

  return null;
}

function getFieldHelperHint(
  fieldKey: string,
  locale: string,
  listingSide: ListingSide,
): string | null {
  const isId = locale === 'id';
  const key = fieldKey.toLowerCase();

  if (key === 'title') {
    return isId ? 'Tulis singkat dan jelas.' : 'Keep it short and clear.';
  }

  if (
    key.includes('price') ||
    key.includes('budget') ||
    key.includes('salary') ||
    key.includes('rent') ||
    key.includes('rate')
  ) {
    if (key === 'price_unit') {
      return listingSide === 'demand'
        ? isId
          ? 'Pilih satuan budget supaya penawaran yang masuk tidak salah hitung.'
          : 'Pick a budget unit so incoming offers calculate the basis correctly.'
        : isId
          ? 'Pilih satuan harga supaya buyer paham harga ini untuk apa.'
          : 'Pick a price unit so buyers understand what the price covers.';
    }
    return listingSide === 'demand'
      ? isId
        ? 'Boleh dikosongkan kalau budgetnya masih fleksibel.'
        : 'You can leave this blank if the budget is still flexible.'
      : isId
        ? 'Boleh dikosongkan kalau harganya masih nego.'
        : 'You can leave this blank if the price is still negotiable.';
  }

  if (
    key.includes('location') ||
    key.includes('city') ||
    key.includes('address')
  ) {
    return isId
      ? 'Pilih kota dulu, lalu tambah area atau alamat detailnya.'
      : 'Start with the city, then add the area or full address.';
  }

  if (key === 'company_name') {
    return isId
      ? 'Pakai nama usaha yang paling dikenal orang.'
      : 'Use the business name people recognize the most.';
  }

  return null;
}

function formatDateInputValue(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function requiresPrimaryImageForType(type: string): boolean {
  return PRIMARY_IMAGE_REQUIRED_TYPES.has(type as ListingTypeId);
}
const SIMPLE_FIELD_KEYS = new Set([
  'title',
  'summary',
  'body',
  'price_cents',
  'price_unit',
  'salary_range',
  'location',
  'address',
  'tags',
  'company_name',
]);

function getSimpleModeVisibleFieldKeys(
  type: ListingTypeId,
  listingSide: ListingSide,
): Set<string> {
  const keys = new Set(SIMPLE_FIELD_KEYS);

  if (type === 'service' && listingSide === 'demand') {
    [
      'work_mode',
      'area_served',
      'delivery_time',
      'service_scope',
      'deliverables',
      'client_requirements',
    ].forEach(key => keys.add(key));
  }

  if (type === 'business_transfer') {
    [
      'business_name',
      'business_age_months',
      'average_monthly_revenue_cents',
      'monthly_operational_cost_cents',
      'included_assets',
      'handover_items',
      'rating_transfer_policy',
      'liabilities_note',
      'reason_for_sale',
      'handover_timeline',
      'ownership_proof',
      'legal_transfer_note',
    ].forEach(key => keys.add(key));
  }

  return keys;
}
const TYPE_SWITCH_SAFE_KEYS = new Set([
  'title',
  'summary',
  'body',
  'tags',
  'location',
  'address',
  'price_cents',
  'price_unit',
  'price',
]);
const PROMOTION_BASE_FIELDS: SectorField[] = [
  {
    key: 'promo_objective',
    kind: 'select',
    labelEn: 'Promotion objective',
    labelId: 'Tujuan promosi',
    placeholderEn: 'Select objective',
    placeholderId: 'Pilih tujuan',
    hintEn: 'Choose one core goal for this campaign.',
    hintId: 'Pilih satu tujuan utama untuk kampanye ini.',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
    options: [
      { value: 'awareness', labelEn: 'Awareness', labelId: 'Awareness' },
      { value: 'lead', labelEn: 'Lead generation', labelId: 'Lead masuk' },
      { value: 'sale', labelEn: 'Direct sales', labelId: 'Penjualan langsung' },
    ],
  },
  {
    key: 'promo_budget_type',
    kind: 'select',
    labelEn: 'Budget type',
    labelId: 'Tipe budget',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
    options: [
      { value: 'daily', labelEn: 'Daily budget', labelId: 'Budget harian' },
      { value: 'total', labelEn: 'Total budget', labelId: 'Budget total' },
    ],
  },
  {
    key: 'promo_budget_amount',
    kind: 'currency',
    labelEn: 'Budget amount (IDR)',
    labelId: 'Nominal budget (IDR)',
    placeholderEn: 'e.g. 1000000',
    placeholderId: 'mis. 1000000',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
  {
    key: 'promo_start_date',
    kind: 'date',
    labelEn: 'Start date',
    labelId: 'Tanggal mulai',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
  {
    key: 'promo_end_date',
    kind: 'date',
    labelEn: 'End date',
    labelId: 'Tanggal selesai',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
  {
    key: 'promo_target_locations',
    kind: 'text',
    labelEn: 'Target locations',
    labelId: 'Target lokasi',
    placeholderEn: 'e.g. Jakarta, Bandung',
    placeholderId: 'mis. Jakarta, Bandung',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
  {
    key: 'promo_target_audience',
    kind: 'text',
    labelEn: 'Target audience',
    labelId: 'Target audiens',
    placeholderEn: 'e.g. New homeowners, age 25-45',
    placeholderId: 'mis. First jobber, usia 23-35',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
  {
    key: 'promo_channels',
    kind: 'text',
    labelEn: 'Promotion channels',
    labelId: 'Channel promosi',
    placeholderEn: 'e.g. home feed, search, recommendation',
    placeholderId: 'mis. home feed, search, rekomendasi',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
  {
    key: 'promo_headline',
    kind: 'text',
    labelEn: 'Campaign headline',
    labelId: 'Headline kampanye',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
  {
    key: 'promo_caption',
    kind: 'multiline',
    labelEn: 'Campaign caption',
    labelId: 'Caption kampanye',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
  {
    key: 'promo_offer_type',
    kind: 'select',
    labelEn: 'Offer type',
    labelId: 'Jenis penawaran',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
    options: [
      { value: 'none', labelEn: 'No offer', labelId: 'Tanpa penawaran' },
      { value: 'discount', labelEn: 'Discount', labelId: 'Diskon' },
      {
        value: 'loyalty_card',
        labelEn: 'Loyalty card',
        labelId: 'Kartu loyalti',
      },
      { value: 'raffle', labelEn: 'Raffle', labelId: 'Raffle' },
      { value: 'bundle', labelEn: 'Bundle', labelId: 'Bundle' },
      {
        value: 'free_shipping',
        labelEn: 'Free shipping',
        labelId: 'Gratis ongkir',
      },
      { value: 'bonus', labelEn: 'Bonus item/service', labelId: 'Bonus' },
      {
        value: 'referral',
        labelEn: 'Referral program',
        labelId: 'Program referral',
      },
    ],
  },
  {
    key: 'promo_offer_value',
    kind: 'text',
    labelEn: 'Offer detail',
    labelId: 'Detail penawaran',
    placeholderEn: 'e.g. 15% off, buy 2 get 1',
    placeholderId: 'mis. Diskon 15%, beli 2 gratis 1',
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
  {
    key: 'promo_cta',
    kind: 'select',
    labelEn: 'Primary CTA',
    labelId: 'CTA utama',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
    options: [
      { value: 'chat_now', labelEn: 'Chat now', labelId: 'Chat sekarang' },
      { value: 'buy_now', labelEn: 'Buy now', labelId: 'Beli sekarang' },
      { value: 'apply_now', labelEn: 'Apply now', labelId: 'Lamar sekarang' },
      { value: 'book_visit', labelEn: 'Book visit', labelId: 'Booking survey' },
      { value: 'contact_us', labelEn: 'Contact us', labelId: 'Hubungi kami' },
    ],
  },
  {
    key: 'promo_tracking_code',
    kind: 'text',
    labelEn: 'Tracking code (UTM/campaign)',
    labelId: 'Kode tracking (UTM/kampanye)',
    placeholderEn: 'e.g. march-property-awareness',
    placeholderId: 'mis. maret-properti-awareness',
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
];

const PROMOTION_TYPE_FIELDS: Record<ListingTypeId, SectorField[]> = {
  product: [
    {
      key: 'promo_flash_sale_window',
      kind: 'text',
      labelEn: 'Flash sale window',
      labelId: 'Window flash sale',
      placeholderEn: 'e.g. 10:00-14:00 WIB',
      placeholderId: 'mis. 10:00-14:00 WIB',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_voucher_code',
      kind: 'text',
      labelEn: 'Voucher code',
      labelId: 'Kode voucher',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_min_order_for_offer',
      kind: 'number',
      labelEn: 'Minimum order for offer',
      labelId: 'Minimum order untuk promo',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
  ],
  service: [
    {
      key: 'promo_free_consultation_slots',
      kind: 'number',
      labelEn: 'Free consultation slots',
      labelId: 'Slot konsultasi gratis',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_package_focus',
      kind: 'select',
      labelEn: 'Package to highlight',
      labelId: 'Paket yang ditonjolkan',
      inCreate: true,
      inCard: false,
      inDetail: true,
      options: [
        { value: 'basic', labelEn: 'Basic', labelId: 'Basic' },
        { value: 'standard', labelEn: 'Standard', labelId: 'Standard' },
        { value: 'premium', labelEn: 'Premium', labelId: 'Premium' },
      ],
    },
    {
      key: 'promo_guarantee_line',
      kind: 'text',
      labelEn: 'Guarantee line',
      labelId: 'Kalimat garansi',
      placeholderEn: 'e.g. Free 2 revisions guaranteed',
      placeholderId: 'mis. Dijamin 2x revisi gratis',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
  ],
  job: [
    {
      key: 'promo_boost_days',
      kind: 'number',
      labelEn: 'Boost duration (days)',
      labelId: 'Durasi boost (hari)',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_referral_bonus',
      kind: 'currency',
      labelEn: 'Referral bonus (IDR)',
      labelId: 'Bonus referral (IDR)',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_candidate_profile',
      kind: 'text',
      labelEn: 'Ideal candidate profile',
      labelId: 'Profil kandidat ideal',
      placeholderEn: 'e.g. Backend Rust 3+ years in fintech',
      placeholderId: 'mis. Backend Rust 3+ tahun fintech',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
  ],
  property: [
    {
      key: 'promo_open_house_date',
      kind: 'date',
      labelEn: 'Open house date',
      labelId: 'Tanggal open house',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_featured_area',
      kind: 'text',
      labelEn: 'Featured area placement',
      labelId: 'Placement area unggulan',
      placeholderEn: 'e.g. Homepage property spotlight',
      placeholderId: 'mis. Homepage property spotlight',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_kpr_simulation_url',
      kind: 'url',
      labelEn: 'KPR/cicilan simulation link',
      labelId: 'Link simulasi KPR/cicilan',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
  ],
  tool_rental: [
    {
      key: 'promo_priority_window',
      kind: 'text',
      labelEn: 'Priority booking window',
      labelId: 'Window prioritas booking',
      placeholderEn: 'e.g. Weekend, 20-31 March',
      placeholderId: 'mis. Akhir pekan, 20-31 Maret',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_free_accessories',
      kind: 'text',
      labelEn: 'Included bonus accessories',
      labelId: 'Bonus aksesoris yang ikut',
      placeholderEn: 'e.g. Extra battery, hardcase',
      placeholderId: 'mis. Baterai cadangan, hardcase',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_fast_return_lane',
      kind: 'text',
      labelEn: 'Fast return note',
      labelId: 'Catatan fast return',
      placeholderEn: 'e.g. Priority inspection in under 30 minutes',
      placeholderId: 'mis. Prioritas inspeksi kurang dari 30 menit',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
  ],
  business_transfer: [
    {
      key: 'promo_fast_sale_angle',
      kind: 'text',
      labelEn: 'Fast-sale angle',
      labelId: 'Angle cepat laku',
      placeholderEn: 'e.g. Verified revenue and owner training included',
      placeholderId: 'mis. Omzet bisa dicek dan training owner ikut',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_due_diligence_slot',
      kind: 'text',
      labelEn: 'Due diligence slot',
      labelId: 'Slot cek usaha',
      placeholderEn: 'e.g. Saturday 10:00-12:00',
      placeholderId: 'mis. Sabtu 10.00-12.00',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_included_bonus',
      kind: 'text',
      labelEn: 'Included bonus',
      labelId: 'Bonus yang ikut',
      placeholderEn: 'e.g. 30 days transition support',
      placeholderId: 'mis. support transisi 30 hari',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
  ],
  company: [
    {
      key: 'promo_featured_story_angle',
      kind: 'text',
      labelEn: 'Story angle to feature',
      labelId: 'Sudut cerita yang diangkat',
      placeholderEn: 'e.g. AI company hiring product teams across SEA',
      placeholderId:
        'mis. Perusahaan AI yang ekspansi tim produk di Asia Tenggara',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_trust_signal',
      kind: 'text',
      labelEn: 'Trust signal to highlight',
      labelId: 'Sinyal trust yang ditonjolkan',
      placeholderEn: 'e.g. Backed by enterprise clients, ISO-ready team',
      placeholderId: 'mis. Dipakai klien enterprise, tim siap audit',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_recruiting_focus',
      kind: 'text',
      labelEn: 'Recruiting / partnership focus',
      labelId: 'Fokus hiring / kemitraan',
      placeholderEn: 'e.g. Hiring backend and design teams this quarter',
      placeholderId: 'mis. Buka hiring backend dan design quarter ini',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
  ],
};

const PROMOTION_FINANCE_FIELDS: SectorField[] = [
  {
    key: 'promo_estimated_margin_percent',
    kind: 'number',
    labelEn: 'Estimated gross margin (%)',
    labelId: 'Estimasi margin kotor (%)',
    placeholderEn: 'e.g. 28',
    placeholderId: 'mis. 28',
    required: true,
    inCreate: true,
    inCard: false,
    inDetail: true,
    hintEn: 'Your approximate margin before platform fee, tax, and opex.',
    hintId: 'Perkiraan margin sebelum fee platform, pajak, dan opex.',
  },
  {
    key: 'promo_platform_fee_percent',
    kind: 'number',
    labelEn: 'Platform fee reserve (%)',
    labelId: 'Cadangan fee platform (%)',
    placeholderEn: `e.g. ${DEFAULT_PROMOTION_PLATFORM_FEE_PERCENT}`,
    placeholderId: `mis. ${DEFAULT_PROMOTION_PLATFORM_FEE_PERCENT}`,
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
  {
    key: 'promo_tax_percent',
    kind: 'number',
    labelEn: 'Tax / PPN reserve (%)',
    labelId: 'Cadangan pajak / PPN (%)',
    placeholderEn: `e.g. ${DEFAULT_PROMOTION_TAX_PERCENT}`,
    placeholderId: `mis. ${DEFAULT_PROMOTION_TAX_PERCENT}`,
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
  {
    key: 'promo_opex_percent',
    kind: 'number',
    labelEn: 'Opex reserve (%)',
    labelId: 'Cadangan opex (%)',
    placeholderEn: `e.g. ${DEFAULT_PROMOTION_OPEX_PERCENT}`,
    placeholderId: `mis. ${DEFAULT_PROMOTION_OPEX_PERCENT}`,
    inCreate: true,
    inCard: false,
    inDetail: true,
  },
];

const PROMOTION_BENEFIT_FIELDS: Partial<
  Record<PromotionOfferType, SectorField[]>
> = {
  discount: [
    {
      key: 'promo_discount_kind',
      kind: 'select',
      labelEn: 'Discount model',
      labelId: 'Model diskon',
      required: true,
      inCreate: true,
      inCard: false,
      inDetail: true,
      options: [
        { value: 'percent', labelEn: 'Percent', labelId: 'Persen' },
        { value: 'flat', labelEn: 'Flat amount', labelId: 'Nominal tetap' },
        {
          value: 'shipping',
          labelEn: 'Shipping subsidy',
          labelId: 'Subsidi ongkir',
        },
      ],
    },
    {
      key: 'promo_discount_percent',
      kind: 'number',
      labelEn: 'Discount percent (%)',
      labelId: 'Persen diskon (%)',
      placeholderEn: 'e.g. 10',
      placeholderId: 'mis. 10',
      required: true,
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_discount_amount',
      kind: 'currency',
      labelEn: 'Discount amount (IDR)',
      labelId: 'Nominal diskon (IDR)',
      placeholderEn: 'e.g. 10000',
      placeholderId: 'mis. 10000',
      required: true,
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
  ],
  loyalty_card: [
    {
      key: 'promo_loyalty_stamp_target',
      kind: 'number',
      labelEn: 'Stamp target',
      labelId: 'Target stamp',
      placeholderEn: 'e.g. 8',
      placeholderId: 'mis. 8',
      required: true,
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_loyalty_reward_type',
      kind: 'select',
      labelEn: 'Reward type',
      labelId: 'Jenis reward',
      required: true,
      inCreate: true,
      inCard: false,
      inDetail: true,
      options: [
        { value: 'discount', labelEn: 'Discount', labelId: 'Diskon' },
        { value: 'bonus', labelEn: 'Bonus item', labelId: 'Bonus item' },
        {
          value: 'free_shipping',
          labelEn: 'Shipping subsidy',
          labelId: 'Subsidi ongkir',
        },
      ],
    },
    {
      key: 'promo_loyalty_reward_value',
      kind: 'currency',
      labelEn: 'Reward value (IDR)',
      labelId: 'Nilai reward (IDR)',
      placeholderEn: 'e.g. 25000',
      placeholderId: 'mis. 25000',
      required: true,
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
  ],
  raffle: [
    {
      key: 'promo_raffle_prize_title',
      kind: 'text',
      labelEn: 'Prize title',
      labelId: 'Nama hadiah',
      placeholderEn: 'e.g. Shopping voucher',
      placeholderId: 'mis. Voucher belanja',
      required: true,
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_raffle_prize_value',
      kind: 'currency',
      labelEn: 'Prize value (IDR)',
      labelId: 'Nilai hadiah (IDR)',
      placeholderEn: 'e.g. 250000',
      placeholderId: 'mis. 250000',
      required: true,
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_raffle_draw_date',
      kind: 'date',
      labelEn: 'Draw date',
      labelId: 'Tanggal undian',
      required: true,
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_raffle_expected_entries',
      kind: 'number',
      labelEn: 'Expected qualified orders',
      labelId: 'Estimasi order yang ikut',
      placeholderEn: 'e.g. 120',
      placeholderId: 'mis. 120',
      required: true,
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
    {
      key: 'promo_raffle_max_winners',
      kind: 'number',
      labelEn: 'Number of winners',
      labelId: 'Jumlah pemenang',
      placeholderEn: 'e.g. 1',
      placeholderId: 'mis. 1',
      inCreate: true,
      inCard: false,
      inDetail: true,
    },
  ],
};

const PROMOTION_HIDDEN_RENDER_KEYS = new Set([
  'promo_offer_type',
  'promo_discount_percent',
  'promo_discount_amount',
]);

const ALL_PROMOTION_KEYS = Array.from(
  new Set(
    [
      ...PROMOTION_BASE_FIELDS,
      ...Object.values(PROMOTION_TYPE_FIELDS).flat(),
      ...PROMOTION_FINANCE_FIELDS,
      ...(Object.values(PROMOTION_BENEFIT_FIELDS)
        .flat()
        .filter(Boolean) as SectorField[]),
    ].map(field => field.key),
  ),
);

const TYPE_CONFIG: Record<ListingTypeId, TypeConfigMeta> = {
  product: {
    headlineId: 'Tawarkan produk / stok usaha',
    headlineEn: 'Supplier / Stock Listing',
    descId: 'Tawarkan barang jadi, bahan baku, stok grosir, atau supplier.',
    descEn:
      'Publish suppliers, distributors, raw materials, or business stock that is ready to offer.',
    stepsId: ['Informasi Produk', 'Harga & Stok', 'Foto Produk', 'Selesai'],
    stepsEn: ['Product Info', 'Price & Stock', 'Product Photos', 'Finish'],
    step1Keys: [
      'title',
      'summary',
      'body',
      'price_cents',
      'price_unit',
      'location',
      'brand',
      'sku',
      'condition',
      'availability',
      'stock',
    ],
    step2HintId: 'Tambahin info kirim, retur, garansi, dan speknya ya.',
    step2HintEn: 'Complete shipping, returns, warranty, and product specs.',
  },
  service: {
    headlineId: 'Tawarkan jasa operasional',
    headlineEn: 'Operations Service Listing',
    descId: 'Tawarkan jasa admin, konten, desain, legal, dan operasional.',
    descEn:
      'Offer marketplace admin, content, packaging, design, legal, or other operational services for businesses.',
    stepsId: ['Informasi Jasa', 'Paket & Area', 'Foto & Portofolio', 'Selesai'],
    stepsEn: ['Service Info', 'Package & Area', 'Photos & Portfolio', 'Finish'],
    step1Keys: [
      'title',
      'summary',
      'body',
      'price_cents',
      'price_unit',
      'location',
      'work_mode',
      'rate_type',
      'level',
      'availability',
      'area_served',
      'delivery_time',
    ],
    step2HintId: 'Tambah scope, output, revisi.',
    step2HintEn:
      'Complete service scope, deliverables, revisions, and client requirements.',
    step3Title: 'Foto, portofolio, dan lampiran',
    step3Description:
      'Upload foto hasil kerja, contoh portofolio, atau dokumen pendukung. Foto pertama jadi thumbnail.',
  },
  job: {
    headlineId: 'Brief Talent',
    headlineEn: 'Talent Brief',
    descId: 'Tulis kebutuhan admin, host, kreator, sales.',
    descEn:
      'Describe the admin, live host, creator, sales, or other operational talent you need with clear targets.',
    stepsId: ['Informasi Talent', 'Kriteria', 'Lampiran', 'Selesai'],
    stepsEn: ['Talent Info', 'Criteria', 'Attachments', 'Finish'],
    step1Keys: [
      'title',
      'summary',
      'body',
      'company_name',
      'location',
      'employment_type',
      'level',
      'work_mode',
      'openings',
      'salary_range',
      'compensation_period',
      'price_cents',
      'price_unit',
    ],
    step2HintId:
      'Tambahin skill wajib, tugas utama, tanggal mulai, dan batas lamarannya ya.',
    step2HintEn:
      'Add required skills, responsibilities, start date, and application deadline.',
  },
  property: {
    headlineId: 'Lokasi jualan',
    headlineEn: 'Selling Location Listing',
    descId: 'Pasang ruko, kios, booth, lapak.',
    descEn:
      'List shophouses, kiosks, booths, bazaar spots, or distribution points ready for business use.',
    stepsId: [
      'Informasi Lokasi',
      'Kontak & Alamat',
      'Foto & Dokumen',
      'Selesai',
    ],
    stepsEn: [
      'Location Info',
      'Contact & Address',
      'Photos & Documents',
      'Finish',
    ],
    step1Keys: [
      'title',
      'summary',
      'body',
      'price_cents',
      'price_unit',
      'location',
      'listing_purpose',
      'property_type',
      'availability_status',
      'bedrooms',
      'bathrooms',
      'area_sqm',
    ],
    step2HintId:
      'Tambahin kapan ready, status kepemilikan, alamat, dan dokumen legalnya ya.',
    step2HintEn:
      'Complete available-from date, ownership, full address, and legal docs.',
  },
  tool_rental: {
    headlineId: 'Sewakan alat usaha',
    headlineEn: 'Business Tool Rental Listing',
    descId:
      'Tawarkan alat sewa: freezer, kamera, lighting, atau alat produksi.',
    descEn:
      'Publish business tools ready for rent: freezers, vacuum sealers, content cameras, lighting, and other operational gear.',
    stepsId: ['Informasi Aset', 'Aturan Sewa', 'Foto Aset', 'Selesai'],
    stepsEn: ['Asset Info', 'Rental Rules', 'Asset Photos', 'Finish'],
    step1Keys: [
      'title',
      'summary',
      'body',
      'price_cents',
      'price_unit',
      'location',
      'brand',
      'model_name',
      'asset_identity_code',
      'condition',
      'rental_rate_type',
      'deposit_amount_cents',
      'minimum_rental_days',
      'pickup_location',
      'availability_status',
    ],
    step2HintId:
      'Tambahin minus barang, item yang ikut, batas pakai, bukti kepemilikan, dan aturan komplainnya ya.',
    step2HintEn:
      'Complete defects, included items, usage restrictions, ownership proof, and complaint rules.',
  },
  business_transfer: {
    headlineId: 'Tawarkan oper usaha',
    headlineEn: 'Running Business Transfer',
    descId:
      'Tawarkan usaha aktif lengkap dengan aset, angka, rating, dan catatan handover yang jelas.',
    descEn:
      'Sell an active business with clear assets, numbers, ratings, and handover notes.',
    stepsId: ['Profil Usaha', 'Aset & Risiko', 'Bukti', 'Selesai'],
    stepsEn: ['Business Profile', 'Assets & Risk', 'Proof', 'Finish'],
    step1Keys: [
      'title',
      'summary',
      'body',
      'price_cents',
      'price_unit',
      'location',
      'business_name',
      'business_category',
      'business_age_months',
      'average_monthly_revenue_cents',
      'average_monthly_profit_cents',
      'monthly_operational_cost_cents',
      'reason_for_sale',
    ],
    step2HintId:
      'Lengkapin aset yang ikut, rating/akun yang bisa dialihkan, biaya tambahan opsional, hutang/kontrak, dan proses handover.',
    step2HintEn:
      'Complete included assets, transferable ratings/accounts, optional extra costs, liabilities/contracts, and handover process.',
  },
  company: {
    headlineId: 'Profil usaha',
    headlineEn: 'Business Profile',
    descId:
      'Bikin halaman usaha publik yang identitasnya jelas biar supplier, partner, dan calon talent cepat nangkep bisnis kamu.',
    descEn:
      'Create a clear public business page so suppliers, partners, and future talent quickly understand your business.',
    stepsId: ['Informasi Usaha', 'Kontak & Lokasi', 'Verifikasi', 'Selesai'],
    stepsEn: ['Business Info', 'Contact & Location', 'Verification', 'Finish'],
    step1Keys: [
      'title',
      'summary',
      'body',
      'company_name',
      'industry_focus',
      'company_size',
      'headquarters',
      'website',
      'founded_year',
    ],
    step2HintId:
      'Tambahin cerita perusahaan, value, fokus hiring/kemitraan, dan kontak publiknya ya.',
    step2HintEn:
      'Complete the company story, values, hiring/partnership focus, and public contact.',
  },
};

const TYPE_THEMES: Record<ListingTypeId, TypeThemeMeta> = {
  product: {
    stepActive:
      'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_30%,_transparent)] dark:text-[color:var(--app-warning)]',
    cardSelected:
      'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_30%,_transparent)] dark:text-[color:var(--app-warning)]',
    cardBase:
      'border-amber-200 bg-[linear-gradient(135deg,rgba(251,191,36,0.18)_0%,rgba(255,255,255,0.97)_70%)] text-[color:var(--app-text)] dark:border-amber-900/70 dark:bg-[linear-gradient(135deg,rgba(245,158,11,0.24)_0%,rgba(15,23,42,0.92)_72%)]',
    cardIcon:
      'border-amber-200/80 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200',
    buttonPrimary:
      'from-[color:var(--app-warning)] to-[color:var(--app-warning)]',
    badge:
      'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_60%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_30%,_transparent)] dark:text-[color:var(--app-warning)]',
  },
  service: {
    stepActive:
      'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)] dark:border-[color:color-mix(in_srgb,_var(--app-info-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] dark:text-[color:var(--app-info)]',
    cardSelected:
      'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)] dark:border-[color:color-mix(in_srgb,_var(--app-info-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] dark:text-[color:var(--app-info)]',
    cardBase:
      'border-teal-200 bg-[linear-gradient(135deg,rgba(94,234,212,0.18)_0%,rgba(255,255,255,0.97)_70%)] text-[color:var(--app-text)] dark:border-teal-900/70 dark:bg-[linear-gradient(135deg,rgba(20,184,166,0.24)_0%,rgba(10,10,10,0.92)_72%)]',
    cardIcon:
      'border-teal-200/80 bg-teal-50 text-teal-700 dark:border-teal-900/70 dark:bg-teal-950/50 dark:text-teal-200',
    buttonPrimary: 'from-[color:var(--app-info)] to-[color:var(--app-info)]',
    badge:
      'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)] dark:border-[color:color-mix(in_srgb,_var(--app-info-border)_60%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] dark:text-[color:var(--app-info)]',
  },
  job: {
    stepActive:
      'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:text-[color:var(--app-accent)]',
    cardSelected:
      'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:text-[color:var(--app-accent)]',
    cardBase:
      'border-emerald-200 bg-[linear-gradient(135deg,rgba(110,231,183,0.18)_0%,rgba(255,255,255,0.97)_70%)] text-[color:var(--app-text)] dark:border-emerald-900/70 dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.24)_0%,rgba(15,23,42,0.92)_72%)]',
    cardIcon:
      'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200',
    buttonPrimary:
      'from-[color:var(--app-accent)] to-[color:var(--app-accent)]',
    badge:
      'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_60%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:text-[color:var(--app-accent)]',
  },
  property: {
    stepActive:
      'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)] dark:border-[color:color-mix(in_srgb,_var(--app-danger-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)] dark:text-[color:var(--app-danger)]',
    cardSelected:
      'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)] dark:border-[color:color-mix(in_srgb,_var(--app-danger-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)] dark:text-[color:var(--app-danger)]',
    cardBase:
      'border-rose-200 bg-[linear-gradient(135deg,rgba(253,164,175,0.16)_0%,rgba(255,255,255,0.97)_70%)] text-[color:var(--app-text)] dark:border-rose-900/70 dark:bg-[linear-gradient(135deg,rgba(244,63,94,0.22)_0%,rgba(15,23,42,0.92)_72%)]',
    cardIcon:
      'border-rose-200/80 bg-rose-50 text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/50 dark:text-rose-200',
    buttonPrimary:
      'from-[color:var(--app-danger)] to-[color:var(--app-danger)]',
    badge:
      'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)] dark:border-[color:color-mix(in_srgb,_var(--app-danger-border)_60%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-danger)_30%,_transparent)] dark:text-[color:var(--app-danger)]',
  },
  tool_rental: {
    stepActive:
      'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_30%,_transparent)] dark:text-[color:var(--app-warning)]',
    cardSelected:
      'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_30%,_transparent)] dark:text-[color:var(--app-warning)]',
    cardBase:
      'border-teal-200 bg-[linear-gradient(135deg,rgba(94,234,212,0.18)_0%,rgba(255,255,255,0.97)_70%)] text-[color:var(--app-text)] dark:border-teal-900/70 dark:bg-[linear-gradient(135deg,rgba(20,184,166,0.24)_0%,rgba(15,23,42,0.92)_72%)]',
    cardIcon:
      'border-teal-200/80 bg-teal-50 text-teal-700 dark:border-teal-900/70 dark:bg-teal-950/50 dark:text-teal-200',
    buttonPrimary:
      'from-[color:var(--app-warning)] to-[color:var(--app-warning)]',
    badge:
      'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] dark:border-[color:color-mix(in_srgb,_var(--app-warning-border)_60%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-warning)_30%,_transparent)] dark:text-[color:var(--app-warning)]',
  },
  business_transfer: {
    stepActive:
      'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:text-[color:var(--app-accent)]',
    cardSelected:
      'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:text-[color:var(--app-accent)]',
    cardBase:
      'border-emerald-200 bg-[linear-gradient(135deg,rgba(52,211,153,0.18)_0%,rgba(255,255,255,0.97)_70%)] text-[color:var(--app-text)] dark:border-emerald-900/70 dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.24)_0%,rgba(15,23,42,0.92)_72%)]',
    cardIcon:
      'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200',
    buttonPrimary:
      'from-[color:var(--app-accent)] to-[color:var(--app-accent)]',
    badge:
      'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_60%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:text-[color:var(--app-accent)]',
  },
  company: {
    stepActive:
      'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)] dark:border-[color:color-mix(in_srgb,_var(--app-info-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] dark:text-[color:var(--app-info)]',
    cardSelected:
      'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)] dark:border-[color:color-mix(in_srgb,_var(--app-info-border)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] dark:text-[color:var(--app-info)]',
    cardBase:
      'border-slate-200 bg-[linear-gradient(135deg,rgba(148,163,184,0.18)_0%,rgba(255,255,255,0.97)_70%)] text-[color:var(--app-text)] dark:border-slate-700 dark:bg-[linear-gradient(135deg,rgba(71,85,105,0.4)_0%,rgba(15,23,42,0.94)_72%)]',
    cardIcon:
      'border-slate-200/80 bg-slate-50 text-slate-700 dark:border-slate-700 dark:bg-slate-900/80 dark:text-slate-200',
    buttonPrimary: 'from-[color:var(--app-info)] to-[color:var(--app-info)]',
    badge:
      'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)] dark:border-[color:color-mix(in_srgb,_var(--app-info-border)_60%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] dark:text-[color:var(--app-info)]',
  },
};

type FieldOverride = {
  labelId?: string;
  labelEn?: string;
  placeholderId?: string;
  placeholderEn?: string;
  hintId?: string;
  hintEn?: string;
};

const FIELD_OVERRIDES: Record<string, Record<string, FieldOverride>> = {
  job: {
    price_cents: {
      labelId: 'Gaji utama (IDR)',
      labelEn: 'Primary salary (IDR)',
      placeholderId: 'mis. 10000000',
      placeholderEn: 'e.g. 10000000',
      hintId: 'Kalau cukup pakai range gaji, ini boleh dikosongin.',
      hintEn: 'Optional if salary range is filled.',
    },
    price_unit: {
      labelId: 'Gaji per',
      labelEn: 'Salary per',
      hintId:
        'Biasanya per bulan, tapi bisa per hari/jam untuk shift atau freelance.',
      hintEn:
        'Usually monthly, but daily/hourly can fit shift or freelance roles.',
    },
    salary_range: {
      hintId: 'Contoh: 10-15 jt per bulan.',
      hintEn: 'Example: 10-15M per month.',
    },
    application_deadline: {
      hintId: 'Kasih tahu sampai kapan lamarannya masih dibuka.',
      hintEn: 'Last date to accept applications.',
    },
  },
  service: {
    price_cents: {
      labelId: 'Mulai dari (IDR)',
      labelEn: 'Starting from (IDR)',
      placeholderId: 'mis. 500000',
      placeholderEn: 'e.g. 500000',
    },
    price_unit: {
      labelId: 'Harga jasa per',
      labelEn: 'Service price per',
      hintId:
        'Pilih proyek, sesi, jam, atau bulan supaya buyer paham hitungannya.',
      hintEn:
        'Choose project, session, hour, or month so buyers understand the basis.',
    },
    delivery_time: {
      hintId: 'Kasih perkiraan beresnya, mis. 5-7 hari.',
      hintEn: 'Add delivery estimate, e.g. 5-7 days.',
    },
  },
  property: {
    price_cents: {
      labelId: 'Harga / Sewa (IDR)',
      labelEn: 'Price / Rent (IDR)',
      placeholderId: 'mis. 1500000000',
      placeholderEn: 'e.g. 1500000000',
    },
    price_unit: {
      labelId: 'Harga / sewa per',
      labelEn: 'Price / rent per',
      hintId:
        'Untuk lokasi jualan biasanya per bulan, tahun, hari, atau event.',
      hintEn:
        'Business locations are usually monthly, yearly, daily, or per event.',
    },
    area_sqm: {
      labelId: 'Luas (m2)',
      labelEn: 'Area (m2)',
    },
    available_from: {
      hintId: 'Kasih tahu kapan unitnya udah siap dipakai.',
      hintEn: 'Date the unit becomes available.',
    },
  },
  tool_rental: {
    price_cents: {
      labelId: 'Tarif sewa utama (IDR)',
      labelEn: 'Primary rental rate (IDR)',
      placeholderId: 'mis. 350000',
      placeholderEn: 'e.g. 350000',
      hintId: 'Isi sesuai skema sewanya, mis. per hari.',
      hintEn:
        'Enter the amount based on the selected rate type, for example per day.',
    },
    price_unit: {
      labelId: 'Tarif sewa per',
      labelEn: 'Rental rate per',
      hintId: 'Pilih hari, minggu, bulan, atau event sesuai cara sewa alatnya.',
      hintEn: 'Choose day, week, month, or event based on the rental scheme.',
    },
    deposit_amount_cents: {
      hintId: 'Biar aman, batas depositnya tulis jelas dari awal.',
      hintEn:
        'The security deposit should be explicit before any booking is made.',
    },
    asset_identity_code: {
      hintId: 'Pakai nomor seri atau kode inventaris yang bisa dicek.',
      hintEn: 'Use a serial number or inventory code that can be verified.',
    },
    complaint_window_hours: {
      hintId: 'Contoh: 24 jam setelah pickup ya.',
      hintEn: 'Example: 24 hours after pickup.',
    },
  },
  business_transfer: {
    title: {
      labelId: 'Judul oper usaha',
      labelEn: 'Business transfer title',
      placeholderId: 'mis. Oper usaha laundry berjalan area Bekasi',
      placeholderEn: 'e.g. Running laundry business transfer in Bekasi',
    },
    price_cents: {
      labelId: 'Harga oper usaha (IDR)',
      labelEn: 'Business transfer price (IDR)',
      placeholderId: 'mis. 185000000',
      placeholderEn: 'e.g. 185000000',
      hintId: 'Isi harga acuan. Kalau nego, tulis di ringkasan/detail.',
      hintEn:
        'Add the reference asking price. Mention negotiation in the summary or details.',
    },
    price_unit: {
      labelId: 'Harga untuk',
      labelEn: 'Price for',
      hintId: 'Untuk oper usaha biasanya per deal/handover.',
      hintEn: 'Business transfer pricing is usually for the deal or handover.',
    },
    business_name: {
      hintId: 'Pakai nama usaha yang dikenal pelanggan.',
      hintEn: 'Use the business name customers recognize.',
    },
    average_monthly_revenue_cents: {
      hintId:
        'Wajib bisa dibuktikan saat due diligence. Jangan tulis angka asal.',
      hintEn: 'Must be provable during due diligence. Do not invent numbers.',
    },
    average_monthly_profit_cents: {
      hintId:
        'Opsional, tapi bagus kalau bisa dibuktikan dari laporan sederhana.',
      hintEn: 'Optional, but useful if it can be supported by simple records.',
    },
    included_assets: {
      hintId:
        'Tulis aset yang ikut dan yang tidak ikut supaya tidak salah paham.',
      hintEn: 'List included and excluded assets to avoid misunderstanding.',
    },
    handover_items: {
      hintId:
        'Akun/rating hanya boleh ikut kalau aturan platform atau kontrak mengizinkan.',
      hintEn:
        'Accounts/ratings may only be included when platform or contract rules allow transfer.',
    },
    liabilities_note: {
      hintId:
        'Jujur soal hutang, pajak, kontrak, deposit, sewa, dan kewajiban karyawan.',
      hintEn:
        'Disclose debt, tax, contracts, deposits, leases, and staff obligations.',
    },
    optional_extra_costs: {
      hintId:
        'Boleh kosong. Isi kalau ada biaya tambahan supaya calon pembeli bisa hitung cepat.',
      hintEn:
        'Optional. Fill this if extra costs exist so buyers can calculate quickly.',
    },
    legal_transfer_note: {
      hintId:
        'Tulis apa yang bisa dialihkan langsung dan apa yang butuh approval pihak ketiga.',
      hintEn:
        'State what can transfer directly and what needs third-party approval.',
    },
  },
  company: {
    title: {
      labelId: 'Judul halaman perusahaan',
      labelEn: 'Company page title',
      placeholderId: 'mis. Northstar Labs | AI infrastructure company',
      placeholderEn: 'e.g. Northstar Labs | AI infrastructure company',
    },
    summary: {
      labelId: 'Singkatnya perusahaan',
      labelEn: 'Company summary',
      placeholderId:
        'Cerita singkat soal perusahaannya, fokusnya, dan kenapa orang perlu tahu.',
      placeholderEn:
        'Summarize who the company is, its focus, and why people should care.',
    },
    body: {
      labelId: 'Cerita halaman publik',
      labelEn: 'Public page description',
      hintId:
        'Tulis versi publik yang aman dibaca kandidat, partner, atau klien.',
      hintEn:
        'Write the public-safe version for candidates, partners, or clients.',
    },
    company_name: {
      hintId:
        'Pakai nama entitas yang sama dengan identitas publik perusahaan.',
      hintEn: 'Use the entity name that matches the company’s public identity.',
    },
    website: {
      labelId: 'Website publik',
      labelEn: 'Public website',
    },
    hiring_email: {
      labelId: 'Email publik / hiring',
      labelEn: 'Public / hiring email',
    },
    about_company: {
      hintId: 'Tulis bisnis, produk utama, dan target pembeli.',
      hintEn:
        'Describe the business, core products, operating model, and who it serves.',
    },
  },
  product: {
    price_unit: {
      labelId: 'Harga produk per',
      labelEn: 'Product price per',
      hintId: 'Contoh: pcs, paket, bal, karton, kg, atau pengiriman.',
      hintEn: 'Examples: piece, pack, bale, carton, kg, or shipment.',
    },
    delivery_estimate: {
      hintId: 'Contoh: 2-3 hari kerja ya.',
      hintEn: 'Example: 2-3 business days.',
    },
  },
};

const DEMAND_FIELD_OVERRIDES: Record<string, Record<string, FieldOverride>> = {
  product: {
    title: {
      labelId: 'Supplier / stok yang dicari',
      labelEn: 'Supplier / stock needed',
      placeholderId: 'mis. Supplier sembako untuk warung & toko area Tangerang',
      placeholderEn: 'e.g. Grocery supplier for stores in Tangerang',
    },
    summary: {
      labelId: 'Kebutuhan singkat',
      labelEn: 'Need summary',
      placeholderId:
        'Singkat aja: barangnya apa, volumenya berapa, kirim ke mana, dan target bisnisnya.',
      placeholderEn:
        'Summarize the item, volume, delivery area, and business target.',
    },
    body: {
      labelId: 'Detail',
      labelEn: 'Need details',
      hintId: 'Tulis barang, qty, MOQ, area kirim, deadline.',
      hintEn:
        'Clarify the item, quantity, workable MOQ, delivery area, deadline, and supplier requirements.',
    },
    price_cents: {
      labelId: 'Kisaran budget (IDR)',
      labelEn: 'Reference budget (IDR)',
      placeholderId: 'mis. 8000000',
      placeholderEn: 'e.g. 8000000',
      hintId:
        'Boleh kosong, tapi ini bantu supplier kasih penawaran yang lebih pas.',
      hintEn: 'Optional, but helps providers send a more precise offer.',
    },
    price_unit: {
      labelId: 'Budget per',
      labelEn: 'Budget per',
      hintId: 'Contoh: per bal, karton, pcs, atau pengiriman.',
      hintEn: 'Examples: per bale, carton, piece, or shipment.',
    },
    stock: {
      labelId: 'Volume / qty dibutuhkan',
      labelEn: 'Volume / quantity needed',
    },
    delivery_estimate: {
      labelId: 'Target diterima kapan',
      labelEn: 'Target receive date',
      hintId: 'Contoh: maksimal H+2 atau rutin tiap Senin dan Kamis.',
      hintEn:
        'Example: deliver within 2 days or on recurring Monday and Thursday slots.',
    },
    specs: {
      labelId: 'Spesifikasi kebutuhan',
      labelEn: 'Required specifications',
    },
    min_order_qty: {
      labelId: 'MOQ / qty minimal yang masih masuk',
      labelEn: 'Acceptable MOQ / minimum quantity',
    },
    location: {
      labelId: 'Kota / titik drop',
      labelEn: 'City / drop point',
    },
    address: {
      labelId: 'Detail area kirim',
      labelEn: 'Detailed delivery area',
      placeholderId: 'mis. Ciputat, Pamulang, atau gudang Cikupa',
      placeholderEn: 'e.g. Ciputat, Pamulang, or a Cikupa warehouse',
    },
  },
  service: {
    title: {
      labelId: 'Jasa apa yang dicari?',
      labelEn: 'What service do you need?',
      placeholderId:
        'mis. Cari host live dan admin marketplace untuk launching',
      placeholderEn:
        'e.g. Need live hosts and a marketplace admin for a launch',
    },
    summary: {
      labelId: 'Inti jasa yang dicari',
      labelEn: 'Need summary',
      placeholderId:
        'Contoh: cari partner untuk live, closing, dan operasional selama 2 minggu.',
      placeholderEn:
        'Example: need a partner to handle live sessions, selling, and operations for 2 weeks.',
    },
    body: {
      labelId: 'Ceritakan konteksnya',
      labelEn: 'Share the context',
      hintId:
        'Tulis kondisi usaha, targetnya, kerjaannya, hasil yang diharap, dan deadline utamanya.',
      hintEn:
        'Explain the business situation, target, main tasks, expected output, and main deadline.',
    },
    price_cents: {
      labelId: 'Kisaran budget (IDR)',
      labelEn: 'Reference budget (IDR)',
      placeholderId: 'mis. 2500000',
      placeholderEn: 'e.g. 2500000',
    },
    price_unit: {
      labelId: 'Budget jasa per',
      labelEn: 'Service budget per',
      hintId: 'Pilih proyek, sesi, jam, hari, atau bulan.',
      hintEn: 'Choose project, session, hour, day, or month.',
    },
    work_mode: {
      labelId: 'Cara kerjanya',
      labelEn: 'Working setup',
    },
    service_scope: {
      labelId: 'Kerjaannya apa saja?',
      labelEn: 'Main scope',
    },
    deliverables: {
      labelId: 'Hasil yang diharapkan',
      labelEn: 'Expected result',
    },
    area_served: {
      labelId: 'Area kerja / cakupan',
      labelEn: 'Coverage area',
    },
    delivery_time: {
      labelId: 'Kapan dibutuhkan selesai?',
      labelEn: 'When should it be done?',
    },
    client_requirements: {
      labelId: 'Catatan penting',
      labelEn: 'Important notes',
    },
    location: {
      labelId: 'Kota utama',
      labelEn: 'Primary city',
    },
  },
  property: {
    title: {
      labelId: 'Lokasi jualan yang lagi dicari',
      labelEn: 'Selling location needed',
      placeholderId: 'mis. Booth bazaar untuk brand cemilan area BSD',
      placeholderEn: 'e.g. Bazaar booth for a snack brand in BSD',
    },
    summary: {
      labelId: 'Kebutuhan singkat',
      labelEn: 'Need summary',
      placeholderId: 'Singkat aja: jenis lokasi, area, traffic, dan budgetnya.',
      placeholderEn: 'Summarize the location type, area, traffic, and budget.',
    },
    body: {
      labelId: 'Detail lokasi',
      labelEn: 'Location requirement details',
      hintId: 'Tulis area, traffic, akses, luas, fasilitas, mulai kapan.',
      hintEn:
        'Explain the target area, traffic, access, minimum size, facilities, and usage timeline.',
    },
    price_cents: {
      labelId: 'Kisaran budget / sewa (IDR)',
      labelEn: 'Reference budget / rent (IDR)',
      placeholderId: 'mis. 1000000',
      placeholderEn: 'e.g. 1000000',
    },
    price_unit: {
      labelId: 'Budget lokasi per',
      labelEn: 'Location budget per',
      hintId: 'Pilih bulan, tahun, hari, atau event.',
      hintEn: 'Choose month, year, day, or event.',
    },
    listing_purpose: {
      labelId: 'Skema lokasi',
      labelEn: 'Location scheme',
      hintId: 'Pilih beli atau sewa sesuai kebutuhan bisnis kamu.',
      hintEn: 'Choose buy or rent based on the business scenario.',
    },
    property_type: {
      labelId: 'Jenis lokasi yang dicari',
      labelEn: 'Location type needed',
    },
    available_from: {
      labelId: 'Mulai dibutuhkan',
      labelEn: 'Needed from',
    },
    address: {
      labelId: 'Area favorit',
      labelEn: 'Preferred area',
      placeholderId: 'mis. BSD, dekat event hall atau area kampus',
      placeholderEn: 'e.g. BSD, near an event hall or campus area',
    },
    location: {
      labelId: 'Kota target',
      labelEn: 'Target city',
    },
  },
  job: {
    title: {
      labelId: 'Talent / PIC yang lagi dicari',
      labelEn: 'Talent / PIC needed',
      placeholderId: 'mis. Admin live TikTok untuk brand F&B Jakarta',
      placeholderEn: 'e.g. TikTok live admin for an F&B brand in Jakarta',
    },
    summary: {
      labelId: 'Kebutuhan singkat',
      labelEn: 'Need summary',
      placeholderId:
        'Singkat aja: role, shift, target closing, dan tools yang dipakai.',
      placeholderEn:
        'Summarize the role, shift, closing target, and tools used.',
    },
    body: {
      labelId: 'Konteks bisnis & tugas utamanya',
      labelEn: 'Business context and main responsibilities',
      hintId: 'Tulis alasan role, target kerja, channel, KPI.',
      hintEn:
        'Explain why the role is needed, work targets, sales channel, KPI, and operating context.',
    },
    location: {
      labelId: 'Lokasi usaha / penempatan',
      labelEn: 'Business location / placement',
    },
    price_cents: {
      labelId: 'Kisaran budget (IDR)',
      labelEn: 'Reference budget (IDR)',
      placeholderId: 'mis. 4500000',
      placeholderEn: 'e.g. 4500000',
    },
    price_unit: {
      labelId: 'Budget gaji per',
      labelEn: 'Salary budget per',
      hintId: 'Biasanya per bulan, tapi bisa per shift/hari/jam.',
      hintEn: 'Usually monthly, but shift/day/hour can fit some roles.',
    },
    company_name: {
      labelId: 'Nama usaha / brand',
      labelEn: 'Business / brand name',
    },
    work_mode: {
      labelId: 'Mode kerja yang dicari',
      labelEn: 'Required work mode',
    },
    level: {
      labelId: 'Level yang dicari',
      labelEn: 'Seniority needed',
    },
    employment_type: {
      labelId: 'Jenis kebutuhan',
      labelEn: 'Engagement type',
    },
    openings: {
      labelId: 'Jumlah orang yang dicari',
      labelEn: 'Headcount needed',
    },
    salary_range: {
      labelId: 'Range budget / gaji',
      labelEn: 'Budget / salary range',
      hintId: 'Contoh: 4-5 jt per bulan atau 250 rb per shift.',
      hintEn: 'Example: 4-5M per month or 250k per shift.',
    },
    compensation_period: {
      labelId: 'Skema budget',
      labelEn: 'Budget scheme',
    },
    experience_years: {
      labelId: 'Minimal pengalaman (tahun)',
      labelEn: 'Minimum experience (years)',
    },
    experience: {
      labelId: 'Pengalaman yang diharap',
      labelEn: 'Expected experience',
    },
    must_have_skills: {
      labelId: 'Skill wajib',
      labelEn: 'Must-have skills',
    },
    responsibilities: {
      labelId: 'Tugas utamanya',
      labelEn: 'Core responsibilities',
    },
    start_date: {
      labelId: 'Target mulai kapan',
      labelEn: 'Target start date',
    },
    application_deadline: {
      labelId: 'Batas respon',
      labelEn: 'Response deadline',
      hintId: 'Kasih tahu kapan shortlist kandidat idealnya udah mulai masuk.',
      hintEn: 'Set when you expect the shortlist to start coming in.',
    },
  },
  tool_rental: {
    title: {
      labelId: 'Alat yang dibutuhkan',
      labelEn: 'Tool needed',
      placeholderId: 'mis. Sewa freezer kapasitas besar untuk event 3 hari',
      placeholderEn: 'e.g. Large-capacity freezer rental for a 3-day event',
    },
    summary: {
      labelId: 'Kebutuhan singkat',
      labelEn: 'Need summary',
      placeholderId:
        'Singkat aja: alatnya apa, durasinya berapa lama, dan dipakai di mana.',
      placeholderEn: 'Summarize the tool, duration, and usage location.',
    },
    body: {
      labelId: 'Konteks pakainya',
      labelEn: 'Usage context',
      hintId: 'Tulis fungsi alat, durasi, lokasi, batasan.',
      hintEn:
        'Explain the use case, duration, site access, and key constraints.',
    },
    price_cents: {
      labelId: 'Kisaran budget sewa (IDR)',
      labelEn: 'Reference rental budget (IDR)',
      placeholderId: 'mis. 750000',
      placeholderEn: 'e.g. 750000',
    },
    price_unit: {
      labelId: 'Budget sewa per',
      labelEn: 'Rental budget per',
      hintId: 'Pilih hari, minggu, bulan, atau event.',
      hintEn: 'Choose day, week, month, or event.',
    },
    brand: {
      labelId: 'Merek / tipe (opsional)',
      labelEn: 'Preferred brand / type',
    },
    model_name: {
      labelId: 'Model / kategori alat',
      labelEn: 'Tool model / category',
    },
    specs: {
      labelId: 'Spesifikasi / kapasitas',
      labelEn: 'Required specs / capacity',
    },
    condition: {
      labelId: 'Kondisi minimum',
      labelEn: 'Minimum condition',
    },
    usage_restrictions: {
      labelId: 'Catatan pakai',
      labelEn: 'Usage notes',
    },
    rental_rate_type: {
      labelId: 'Skema sewa yang diinginkan',
      labelEn: 'Preferred rental scheme',
    },
    deposit_amount_cents: {
      labelId: 'Batas deposit (IDR)',
      labelEn: 'Deposit limit (IDR)',
      hintId:
        'Boleh kosong. Isi kalau ada batas deposit yang masih oke buat bisnis kamu.',
      hintEn:
        'Optional. Use when there is a deposit ceiling that still works for your business.',
    },
    minimum_rental_days: {
      labelId: 'Durasi sewa minimum',
      labelEn: 'Minimum rental duration',
    },
    maximum_rental_days: {
      labelId: 'Durasi sewa maksimum',
      labelEn: 'Maximum rental duration',
    },
    pickup_location: {
      labelId: 'Lokasi pakai / ambil',
      labelEn: 'Usage / pickup location',
    },
  },
};

// Kept local for future reuse when the inline guidance panel is reintroduced.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TYPE_COMPLIANCE_GUIDANCE: Record<ListingTypeId, TypeChecklistMeta> = {
  product: {
    titleId: 'Yang wajib jelas untuk produk',
    titleEn: 'What must be clear for products',
    itemsId: [
      'Barang, kondisi, stok, estimasi kirim, dan kebijakan retur harus konsisten.',
      'Jangan cantumkan klaim palsu, stok fiktif, atau bonus yang tidak bisa dipenuhi.',
      'Isi GTIN/MPN kalau ada.',
    ],
    itemsEn: [
      'Item identity, condition, stock, delivery estimate, and return policy must stay consistent.',
      'Do not publish false claims, fake stock, or benefits you cannot honor.',
      'If official GTIN/MPN exists, include it so product identity is not ambiguous.',
    ],
  },
  service: {
    titleId: 'Yang wajib jelas untuk jasa',
    titleEn: 'What must be clear for services',
    itemsId: [
      'Scope, deliverables, revisi, dan timeline harus eksplisit sejak awal.',
      'Jangan minta pembayaran di luar platform atau janji hasil yang menyesatkan.',
      'Data klien yang diminta harus relevan, bukan mengumpulkan data berlebihan.',
    ],
    itemsEn: [
      'Scope, deliverables, revisions, and timeline should be explicit from the start.',
      'Do not ask for off-platform payment or promise misleading outcomes.',
      'Any client data you request should be relevant, not excessive.',
    ],
  },
  job: {
    titleId: 'Yang wajib jelas untuk lowongan',
    titleEn: 'What must be clear for jobs',
    itemsId: [
      'Peran, kompensasi, status kerja, skill wajib, dan deadline harus tegas.',
      'Jangan minta kandidat membayar biaya admin, training, atau deposit untuk melamar.',
      'Data kandidat hanya boleh dipakai untuk proses rekrutmen yang sah dan proporsional.',
    ],
    itemsEn: [
      'Role, compensation, employment status, must-have skills, and deadline should be explicit.',
      'Do not ask applicants to pay admin fees, training fees, or deposits to apply.',
      'Candidate data should only be collected for legitimate and proportionate hiring purposes.',
    ],
  },
  property: {
    titleId: 'Yang wajib jelas untuk properti',
    titleEn: 'What must be clear for property',
    itemsId: [
      'Tujuan listing, alamat/area, luas, status ketersediaan, dan legal docs harus konsisten.',
      'Jangan publish unit yang tidak jelas status kepemilikannya atau tidak siap ditawarkan.',
      'Foto dan dokumen harus merepresentasikan unit yang sama, bukan materi generik.',
    ],
    itemsEn: [
      'Listing purpose, address/area, size, availability, and legal documents must stay consistent.',
      'Do not publish units with unclear ownership status or units not ready to be offered.',
      'Photos and documents should represent the same unit, not generic material.',
    ],
  },
  tool_rental: {
    titleId: 'Yang wajib jelas untuk sewa alat',
    titleEn: 'What must be clear for rentals',
    itemsId: [
      'Tarif, deposit, durasi minimum, denda telat, dan evidence check-in/check-out harus tegas.',
      'Kondisi barang, kelengkapan, defect, dan batas penggunaan wajib ditulis apa adanya.',
      'Peminjaman berisiko tinggi butuh bukti kepemilikan/kuasa dan jejak serah-terima yang kuat.',
    ],
    itemsEn: [
      'Rate, deposit, minimum duration, late fee, and check-in/check-out evidence must be explicit.',
      'Condition, included items, defects, and usage restrictions must reflect the real asset state.',
      'Higher-risk rentals need ownership/authority proof and a strong handover trail.',
    ],
  },
  business_transfer: {
    titleId: 'Yang wajib jelas untuk oper usaha',
    titleEn: 'What must be clear for business transfers',
    itemsId: [
      'Omzet, biaya, aset, rating, dan alasan ditawarkan harus bisa dibuktikan saat due diligence.',
      'Akun, rating, lokasi, kontrak, dan database pelanggan hanya boleh dialihkan kalau aturan pihak terkait mengizinkan.',
      'Hutang, pajak, deposit sewa, kewajiban karyawan, dan risiko usaha wajib ditulis jujur dari awal.',
    ],
    itemsEn: [
      'Revenue, costs, assets, ratings, and reason for sale must be provable during due diligence.',
      'Accounts, ratings, locations, contracts, and customer databases may transfer only when relevant rules allow it.',
      'Debts, tax, lease deposits, staff obligations, and business risks must be disclosed from the start.',
    ],
    noteId:
      'Jangan bayar penuh sebelum verifikasi dokumen, cek lokasi/aset, dan kesepakatan handover tertulis.',
    noteEn:
      'Do not pay in full before document verification, asset/location checks, and written handover terms.',
  },
  company: {
    titleId: 'Yang wajib jelas untuk profil perusahaan',
    titleEn: 'What must be clear for company profiles',
    itemsId: [
      'Identitas perusahaan, fokus industri, kantor pusat, dan cerita perusahaan harus dapat diverifikasi publik.',
      'Halaman company dipakai untuk profil entitas; lowongan tetap harus dibuat sebagai listing job tersendiri.',
      'Jangan meminta atau mempublikasikan data personal yang tidak relevan dengan profil perusahaan.',
    ],
    itemsEn: [
      'Company identity, industry focus, headquarters, and company story should be publicly verifiable.',
      'A company page is for the entity profile; open roles should still be posted as separate job listings.',
      'Do not ask for or publish personal data that is not relevant to the company profile itself.',
    ],
    noteId:
      'Kalau tujuan utama Anda hiring, partnership, atau employer branding, company page ini jadi hub; transaksi langsung tidak dipakai di sini.',
    noteEn:
      'If your goal is hiring, partnerships, or employer branding, use this company page as the hub; direct transaction flow is not used here.',
    href: '/usaha/onboarding',
    hrefLabelId: 'Buka setup usaha',
    hrefLabelEn: 'Open business setup',
  },
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const TYPE_COMPLIANCE_VISUALS: Record<ListingTypeId, TypeVisualChecklistMeta> =
{
  product: {
    itemsId: [
      'Produk, stok, retur jelas',
      'Tanpa klaim palsu',
      'Tambah GTIN/MPN bila ada',
    ],
    itemsEn: [
      'Product, stock, and returns are clear',
      'No false claims',
      'Add GTIN/MPN when available',
    ],
  },
  service: {
    itemsId: [
      'Scope dan timeline jelas',
      'No bayar di luar app',
      'Data klien seperlunya',
    ],
    itemsEn: [
      'Scope and timeline are clear',
      'No off-platform payment',
      'Only necessary client data',
    ],
  },
  job: {
    itemsId: [
      'Role dan kompensasi jelas',
      'Kandidat tidak bayar',
      'Data pelamar seperlunya',
    ],
    itemsEn: [
      'Role and compensation are clear',
      'Applicants never pay',
      'Only necessary applicant data',
    ],
  },
  property: {
    itemsId: [
      'Alamat dan legal jelas',
      'Unit harus siap tayang',
      'Foto sesuai unit',
    ],
    itemsEn: [
      'Address and legal status are clear',
      'Unit must be listing-ready',
      'Photos must match the unit',
    ],
  },
  tool_rental: {
    itemsId: [
      'Rate dan deposit jelas',
      'Kondisi alat harus jujur',
      'Bukti serah-terima wajib',
    ],
    itemsEn: [
      'Rate and deposit are clear',
      'Asset condition must be honest',
      'Handover proof is required',
    ],
  },
  business_transfer: {
    itemsId: [
      'Angka usaha bisa dicek',
      'Aset dan akun jelas',
      'Risiko ditulis jujur',
    ],
    itemsEn: [
      'Business numbers can be checked',
      'Assets and accounts are clear',
      'Risks are disclosed honestly',
    ],
  },
  company: {
    itemsId: [
      'Identitas publik harus valid',
      'Lowongan tetap di page job',
      'Jaga data personal minim',
    ],
    itemsEn: [
      'Public identity must be valid',
      'Roles still belong in jobs',
      'Keep personal data minimal',
    ],
  },
};

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEMAND_FORM_GUIDANCE: Partial<Record<ListingTypeId, TypeChecklistMeta>> =
{
  product: {
    titleId: 'Agar supplier cepat respon',
    titleEn: 'So suppliers can respond faster',
    itemsId: [
      'Tulis barang, qty, budget, dan deadline.',
      'Sebut merek, MOQ, atau spesifikasi yang wajib.',
      'Cantumkan area kirim atau titik drop.',
    ],
    itemsEn: [
      'State the item, quantity, budget, and deadline.',
      'Mention required brand, MOQ, or specifications.',
      'Include delivery area or drop point.',
    ],
    noteId:
      'Kalau ada toleransi merek atau spesifikasi alternatif, tulis juga.',
    noteEn:
      'If there is tolerance for alternative brands or specs, mention it too.',
  },
  service: {
    titleId: 'Agar vendor cepat paham',
    titleEn: 'So providers understand faster',
    itemsId: [
      'Tulis target bisnis, scope, output.',
      'Sebut timeline, area kerja, dan mode eksekusi.',
      'Tulis budget acuan atau range yang realistis.',
    ],
    itemsEn: [
      'Describe the business target, scope, and expected output.',
      'Mention timeline, work area, and execution mode.',
      'Share a realistic reference budget or range.',
    ],
    noteId:
      'Kalau fokusnya live, reseller, marketplace, toko, atau event, sebutkan dari awal.',
    noteEn:
      'If the main focus is live commerce, resellers, marketplaces, stores, or events, say it early.',
  },
  job: {
    titleId: 'Agar talent tepat yang masuk',
    titleEn: 'So the right talent responds',
    itemsId: [
      'Tulis role, jumlah orang, tugas utama.',
      'Sebut sistem kerja, shift, lokasi, dan target mulai.',
      'Tulis skill wajib dan range budget atau gaji.',
    ],
    itemsEn: [
      'State the role, headcount, and core responsibilities.',
      'Mention work setup, shifts, location, and target start date.',
      'List must-have skills and the salary or budget range.',
    ],
    noteId:
      'Fokuskan brief ke kebutuhan operasional nyata, bukan deskripsi perusahaan yang terlalu panjang.',
    noteEn:
      'Keep the brief focused on the actual operational need, not a long company description.',
  },
  property: {
    titleId: 'Agar lokasi yang masuk lebih relevan',
    titleEn: 'So location matches are more relevant',
    itemsId: [
      'Tulis tipe lokasi, area, dan budget.',
      'Sebut kebutuhan luas, akses, dan channel jualan.',
      'Cantumkan target kapan lokasi mulai dipakai.',
    ],
    itemsEn: [
      'Write the location type, area, and budget.',
      'Mention size, access, and sales channel needs.',
      'Include when the location needs to start being used.',
    ],
    noteId:
      'Kalau perlu parkir, dekat sekolah, dekat pasar, atau dekat gudang, tulis sejak awal.',
    noteEn:
      'If you need parking, school access, market proximity, or warehouse access, say it early.',
  },
  tool_rental: {
    titleId: 'Agar vendor alat cepat cocok',
    titleEn: 'So rental vendors can match faster',
    itemsId: [
      'Tulis alat, kapasitas, durasi sewa.',
      'Sebut lokasi pakai, operator, dan target tanggal.',
      'Tulis budget atau batas deposit bila ada.',
    ],
    itemsEn: [
      'Describe the tool, capacity, and rental duration.',
      'Mention usage location, operator needs, and target date.',
      'Share the budget or deposit limit if any.',
    ],
    noteId:
      'Tambahkan kondisi minimum atau akses lokasi bila alat dipakai di lapangan.',
    noteEn:
      'Add minimum condition or site access details if the tool will be used in the field.',
  },
};
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const DEMAND_FORM_VISUALS: Partial<
  Record<ListingTypeId, TypeVisualChecklistMeta>
> = {
  product: {
    itemsId: [
      'Barang + qty jelas',
      'Budget / target ada',
      'Area kirim disebut',
    ],
    itemsEn: [
      'Item + quantity clear',
      'Budget / target exists',
      'Delivery area included',
    ],
  },
  service: {
    itemsId: ['Scope jelas', 'Output terukur', 'Deadline disebut'],
    itemsEn: ['Scope is clear', 'Output is measurable', 'Deadline included'],
  },
  job: {
    itemsId: ['Role jelas', 'Skill wajib ada', 'Mulai kerja disebut'],
    itemsEn: [
      'Role is clear',
      'Must-have skills listed',
      'Start target included',
    ],
  },
  property: {
    itemsId: ['Area jelas', 'Budget disebut', 'Akses penting ditulis'],
    itemsEn: [
      'Area is clear',
      'Budget is stated',
      'Key access needs are written',
    ],
  },
  tool_rental: {
    itemsId: ['Alat + kapasitas jelas', 'Durasi disebut', 'Lokasi pakai ada'],
    itemsEn: [
      'Tool + capacity clear',
      'Duration stated',
      'Usage location included',
    ],
  },
};
const DEMAND_TYPE_META: Partial<Record<ListingTypeId, DemandTypeMeta>> = {
  product: {
    stepsId: ['Kebutuhan', 'Spesifikasi', 'Media', 'Promosi'],
    stepsEn: ['Need', 'Specs', 'Media', 'Promotion'],
    step2HintId:
      'Lengkapin qty, merek, MOQ, area kirim, target datang, dan detail supplier yang cocok.',
    step2HintEn:
      'Complete quantity, brand, MOQ, delivery area, arrival target, and the supplier criteria that fit.',
  },
  service: {
    stepsId: ['Kebutuhan', 'Detail kerja', 'Lampiran', 'Promosi'],
    stepsEn: ['Need', 'Work details', 'Attachments', 'Promotion'],
    step2HintId:
      'Tambahin cara kerja, hasil yang diharapkan, area kerja, dan deadline kalau mau penyedia yang masuk lebih nyambung.',
    step2HintEn:
      'Add the work setup, expected output, coverage area, and deadline if you want more relevant providers.',
  },
  job: {
    stepsId: ['Talent', 'Kriteria', 'Media', 'Promosi'],
    stepsEn: ['Talent', 'Criteria', 'Media', 'Promotion'],
    step2HintId:
      'Lengkapin skill, shift, jumlah orang, KPI, dan target mulai kerja.',
    step2HintEn:
      'Complete skills, shifts, headcount, KPI, and target start date.',
  },
  property: {
    stepsId: ['Lokasi', 'Kriteria', 'Media', 'Promosi'],
    stepsEn: ['Location', 'Criteria', 'Media', 'Promotion'],
    step2HintId:
      'Lengkapin area, traffic, luas, akses, fasilitas, dan target mulai pakai.',
    step2HintEn:
      'Complete area, traffic, size, access, facilities, and target usage date.',
  },
  tool_rental: {
    stepsId: ['Alat', 'Sewa', 'Media', 'Promosi'],
    stepsEn: ['Tool', 'Rental', 'Media', 'Promotion'],
    step2HintId:
      'Lengkapin kapasitas alat, durasi sewa, operator, lokasi pakai, dan batas deposit.',
    step2HintEn:
      'Complete tool capacity, rental duration, operators, usage location, and deposit limit.',
  },
};
const TYPE_PICKER_META: Record<ListingTypeId, TypePickerMeta> = {
  product: {
    helperId: 'Tawarkan barang / stok',
    helperEn: 'Suppliers / business stock',
  },
  service: {
    helperId: 'Tawarkan jasa / channel',
    helperEn: 'Operations / channel',
  },
  job: {
    helperId: 'Talent / operasional',
    helperEn: 'Talent / operations PIC',
  },
  property: {
    helperId: 'Tawarkan lokasi jualan',
    helperEn: 'Selling locations',
  },
  tool_rental: {
    helperId: 'Sewakan alat usaha',
    helperEn: 'Business tool rental',
  },
  business_transfer: {
    helperId: 'Tawarkan oper usaha',
    helperEn: 'Business handover / assets + ratings',
  },
  company: {
    helperId: 'Profil usaha',
    helperEn: 'Business profile',
  },
};

function sanitizeFieldValuesForType(
  values: Record<string, string>,
  nextType: string,
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const [key, value] of Object.entries(values)) {
    if (!TYPE_SWITCH_SAFE_KEYS.has(key)) continue;
    if (
      (key === 'price_cents' || key === 'price_unit' || key === 'price') &&
      nextType === 'company'
    ) {
      continue;
    }
    const normalized = cleanText(value);
    if (normalized) {
      next[key] = normalized;
    }
  }
  return next;
}

export type CreatePostingPageProps = {
  entryMode?: 'root' | CreateFlowIntent;
  forcedTypeId?: ListingTypeId | '';
  forcedListingSide?: ListingSide | null;
};

export function CreatePostingClient({
  entryMode = 'root',
  forcedTypeId = '',
  forcedListingSide = null,
}: CreatePostingPageProps) {
  const router = useRouter();
  const handlePageBack = useAppBack(router, '/home');
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = useLocale() || 'id';
  const { user, authFetch, loading: authLoading } = useAuth();
  const {
    sectors,
    loading: sectorsLoading,
    error: sectorsError,
  } = useSectors();
  const draftParam = extractContentId(searchParams.get('draft') || '');
  const requestedTypeParam = cleanText(
    forcedTypeId || searchParams.get('type') || '',
  ).toLowerCase();
  const requestedSide =
    forcedListingSide ?? normalizeListingSideParam(searchParams.get('side'));
  const requestedStepParam = cleanText(searchParams.get('step') || '');
  const requestedStep =
    requestedStepParam && Number.isFinite(Number(requestedStepParam))
      ? clampStep(Number(requestedStepParam))
      : null;
  const requestedType = CONTENT_TYPES.some(ct => ct.id === requestedTypeParam)
    ? requestedTypeParam
    : '';

  const [loadingInitial, setLoadingInitial] = useState(Boolean(draftParam));
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [currentStep, setCurrentStep] = useState(1);
  const [workingId, setWorkingId] = useState<string | null>(draftParam || null);
  const [contentStatus, setContentStatus] = useState<'draft' | 'active'>(
    'draft',
  );
  const [infoMessage, setInfoMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  const [type, setType] = useState<string>(requestedType);
  const [typePicked, setTypePicked] = useState(Boolean(requestedType));
  const [sector, setSector] = useState<string>('');
  const [subSector, setSubSector] = useState<string>('');
  const [isSectorPickerOpen, setIsSectorPickerOpen] = useState(false);
  const [sectorQuery, setSectorQuery] = useState('');
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});
  const [images, setImages] = useState<ImageFile[]>([]);
  const [documents, setDocuments] = useState<DocumentFile[]>([]);
  const [promotionEnabled, setPromotionEnabled] = useState(false);
  const [metadataBase, setMetadataBase] = useState<Record<string, unknown>>({});
  const [listingMode, setListingMode] = useState<'simple' | 'detail'>(
    requestedType && !supportsSimpleListingMode(requestedType)
      ? 'detail'
      : 'simple',
  );
  const [listingSide, setListingSide] = useState<ListingSide>(
    requestedSide ?? getDefaultListingSide(requestedType || 'product'),
  );
  const subSectors = sector ? getSubSectors(sector) : [];
  const localeCode = locale === 'id' ? 'id' : 'en';
  const socialConnections = useMemo(
    () => readSocialConnections(user?.metadata || {}),
    [user?.metadata],
  );

  const activeType = type || 'product';
  const activeTypeIsProperty = activeType === 'property';
  const activeTypeSupportsSector = supportsSectorClassification(activeType);
  const supportsSimpleMode = supportsSimpleListingMode(activeType);
  const effectiveSector = activeTypeIsProperty
    ? 'realestate'
    : activeTypeSupportsSector
      ? sector || undefined
      : undefined;
  const showSectorPicker = typePicked && activeTypeSupportsSector;
  const selectedSectorView = sector
    ? sectors.find(item => item.id === sector) || null
    : null;
  const selectedSubSectorView =
    subSector && subSectors.length > 0
      ? subSectors.find(item => item.id === subSector) || null
      : null;
  const filteredSectors = useMemo(() => {
    const query = cleanText(sectorQuery).toLowerCase();
    const base =
      query.length === 0
        ? sectors
        : sectors.filter(item => {
          const label = getSectorLabel(item, locale).toLowerCase();
          const description = getSectorDescription(
            item,
            locale,
          ).toLowerCase();
          return label.includes(query) || description.includes(query);
        });

    return [...base].sort((a, b) => {
      if (a.id === sector) return -1;
      if (b.id === sector) return 1;
      return getSectorLabel(a, locale).localeCompare(getSectorLabel(b, locale));
    });
  }, [locale, sector, sectorQuery, sectors]);
  const typeSelectionLocked = Boolean(workingId && contentStatus !== 'draft');
  const typeConfig =
    TYPE_CONFIG[activeType as keyof typeof TYPE_CONFIG] || TYPE_CONFIG.product;
  const typeTheme =
    TYPE_THEMES[activeType as keyof typeof TYPE_THEMES] || TYPE_THEMES.product;
  const selectedType = CONTENT_TYPES.find(ct => ct.id === activeType);
  const demandTypeMeta =
    listingSide === 'demand'
      ? DEMAND_TYPE_META[activeType as ListingTypeId]
      : undefined;
  const isNeedServiceJourney =
    forcedTypeId === 'service' &&
    forcedListingSide === 'demand' &&
    activeType === 'service' &&
    listingSide === 'demand';
  useEffect(() => {
    if (showSectorPicker) return;
    setIsSectorPickerOpen(false);
    setSectorQuery('');
  }, [showSectorPicker]);

  useEffect(() => {
    if (!isNeedServiceJourney || listingMode === 'simple') return;
    setListingMode('simple');
  }, [isNeedServiceJourney, listingMode]);

  useEffect(() => {
    if (!typePicked || activeType === 'company') return;
    const defaultUnit = getDefaultPriceUnitForType(activeType, listingSide);
    if (!defaultUnit) return;
    setFieldValues(prev => {
      if (normalizePriceUnit(prev.price_unit)) return prev;
      return { ...prev, price_unit: defaultUnit };
    });
  }, [activeType, listingSide, typePicked]);

  const canSwitchListingSide =
    typePicked &&
    supportsDemandListing(activeType) &&
    isListingSideEditable(activeType);
  const listingSideContextLabel = getListingSideContextLabel(
    listingSide,
    activeType,
    localeCode,
  );
  const baseStepLabels = typePicked
    ? listingSide === 'demand'
      ? locale === 'id'
        ? demandTypeMeta?.stepsId || typeConfig.stepsId
        : demandTypeMeta?.stepsEn || typeConfig.stepsEn
      : locale === 'id'
        ? typeConfig.stepsId
        : typeConfig.stepsEn
    : locale === 'id'
      ? DEFAULT_STEP_LABELS_ID
      : DEFAULT_STEP_LABELS_EN;
  const stepLabels = baseStepLabels.map((label, index) => {
    if (index !== TOTAL_STEPS - 1) return label;
    const normalized = label.toLowerCase();
    if (
      normalized.includes('selesai') ||
      normalized.includes('finish') ||
      normalized.includes('review')
    ) {
      return label;
    }
    return locale === 'id' ? `${label} opsional` : `${label} optional`;
  });
  const fields = useMemo(
    () => (typePicked ? getFieldsForCreate(activeType, effectiveSector) : []),
    [activeType, effectiveSector, typePicked],
  );
  const effectiveFields = useMemo(() => {
    if (!typePicked) return [];
    const sideAwareFields = filterFieldsForListingSide(
      fields,
      activeType,
      listingSide,
    );
    if (listingMode === 'simple' && supportsSimpleMode) {
      const simpleModeFieldKeys = getSimpleModeVisibleFieldKeys(
        activeType as ListingTypeId,
        listingSide,
      );
      return sideAwareFields.filter(f => simpleModeFieldKeys.has(f.key));
    }
    return sideAwareFields;
  }, [
    activeType,
    fields,
    listingMode,
    listingSide,
    supportsSimpleMode,
    typePicked,
  ]);
  const isSimpleModeActive = listingMode === 'simple' && supportsSimpleMode;
  const showImages =
    typePicked && needsImageGallery(activeType, effectiveSector);
  const coverImage = images[0] || null;
  const setCoverImage = useCallback((index: number) => {
    setImages(prev => {
      if (index <= 0 || index >= prev.length) return prev;
      const next = [...prev];
      const [selected] = next.splice(index, 1);
      next.unshift(selected);
      return next;
    });
  }, []);
  function renderMediaUploadPanel() {
    if (!showImages) return null;
    return (
    <div className="space-y-2.5">
      <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[color:var(--app-accent)]">
              {locale === 'id' ? 'Foto utama' : 'Primary photo'}
            </p>
            <p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)]">
              {locale === 'id'
                ? 'Upload foto utama dulu. Ini yang paling cepat dilihat pembeli.'
                : 'Upload the main photo first. This is what people see first.'}
            </p>
          </div>
          <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)] dark:bg-slate-900">
            {images.length > 0
              ? locale === 'id'
                ? `${images.length} foto`
                : `${images.length} photos`
              : locale === 'id'
                ? 'Belum ada foto'
                : 'No photos yet'}
          </span>
        </div>
        {coverImage ? (
          <div className="mt-3 flex items-center gap-3">
            <div
              className="h-16 w-16 shrink-0 overflow-hidden rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] bg-cover bg-center dark:border-[color:var(--app-border-strong)]"
              style={{
                backgroundImage: `url(${coverImage.preview || coverImage.url || ''})`,
              }}
            />
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[color:var(--app-text)]">
                {locale === 'id' ? 'Foto terpilih' : 'Selected photo'}
              </p>
              <p className="text-[11px] text-[color:var(--app-text-soft)]">
                {locale === 'id'
                  ? 'Kalau mau ganti, tarik urutan foto atau pilih foto lain sebagai utama.'
                  : 'Reorder or pick another image if you want to change the main photo.'}
              </p>
            </div>
          </div>
        ) : (
          <div className="mt-3 rounded-lg border border-dashed border-[color:var(--app-border)] px-3 py-3 text-[11px] text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]">
            {locale === 'id'
              ? 'Upload foto dulu biar listing terasa lebih jelas.'
              : 'Upload a photo first so the listing feels clearer.'}
          </div>
        )}
      </div>
      <label className="block text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] mb-1.5">
        <span className="inline-flex items-center gap-1.5">
          <ImageIcon className="w-3.5 h-3.5 text-[color:var(--app-text-soft)]" />
          <span>
            {locale === 'id' ? 'Foto' : 'Images'}{' '}
            {images.length > 0 && `(${images.length})`}
          </span>
        </span>
      </label>
      <ImageUpload
        images={images}
        onChange={setImages}
        onSetCover={setCoverImage}
        onAddFiles={handleAddImages}
        maxImages={10}
        maxSizeMB={IMAGE_UPLOAD_RAW_MAX_MB}
        locale={locale}
      />
    </div>
    );
  }
  const requiredFields = useMemo(() => {
    if (!typePicked) return [];
    if (isSimpleModeActive) {
      const simpleKeys = new Set(
        getSimpleModePinnedFieldKeys(activeType as ListingTypeId, listingSide),
      );
      return effectiveFields.filter(f => simpleKeys.has(f.key));
    }
    return effectiveFields.filter(f => f.required);
  }, [
    activeType,
    effectiveFields,
    isSimpleModeActive,
    listingSide,
    typePicked,
  ]);
  const requiredFieldKeys = useMemo(
    () => new Set(requiredFields.map(field => field.key)),
    [requiredFields],
  );
  const requiredDone = useMemo(
    () =>
      requiredFields.filter(f => cleanText(fieldValues[f.key]).length > 0)
        .length,
    [fieldValues, requiredFields],
  );
  const step1FieldKeys = useMemo(
    () => new Set<string>(typePicked ? [...typeConfig.step1Keys] : []),
    [typePicked, typeConfig.step1Keys],
  );
  const step1Fields = useMemo(
    () => effectiveFields.filter(f => step1FieldKeys.has(f.key)),
    [effectiveFields, step1FieldKeys],
  );
  const step2Fields = useMemo(
    () =>
      effectiveFields.filter(
        f => !step1FieldKeys.has(f.key) && !['images', 'tags'].includes(f.key),
      ),
    [effectiveFields, step1FieldKeys],
  );
  const step1PinnedFieldKeys = useMemo(
    () =>
      new Set<string>(
        isSimpleModeActive
          ? getSimpleModePinnedFieldKeys(
            activeType as ListingTypeId,
            listingSide,
          )
          : [],
      ),
    [activeType, isSimpleModeActive, listingSide],
  );
  const step1RequiredFields = useMemo(
    () => step1Fields.filter(f => requiredFieldKeys.has(f.key)),
    [requiredFieldKeys, step1Fields],
  );
  const step1OptionalFields = useMemo(
    () => step1Fields.filter(f => !requiredFieldKeys.has(f.key)),
    [requiredFieldKeys, step1Fields],
  );
  const step2RequiredFields = useMemo(
    () => step2Fields.filter(f => requiredFieldKeys.has(f.key)),
    [requiredFieldKeys, step2Fields],
  );
  const step2OptionalFields = useMemo(
    () => step2Fields.filter(f => !requiredFieldKeys.has(f.key)),
    [requiredFieldKeys, step2Fields],
  );
  const step1PrimaryFields = useMemo(
    () =>
      isSimpleModeActive
        ? step1Fields.filter(field => step1PinnedFieldKeys.has(field.key))
        : step1RequiredFields,
    [
      isSimpleModeActive,
      step1Fields,
      step1PinnedFieldKeys,
      step1RequiredFields,
    ],
  );
  const step1SecondaryFields = useMemo(
    () => (isSimpleModeActive ? [] : step1OptionalFields),
    [isSimpleModeActive, step1OptionalFields],
  );
  const parsedPriceCents = useMemo(() => {
    const raw = cleanText(fieldValues.price_cents);
    if (!raw) return undefined;
    const normalized = parseInt(raw.replace(/\D/g, ''), 10);
    return Number.isFinite(normalized) && normalized > 0
      ? normalized * 100
      : undefined;
  }, [fieldValues.price_cents]);
  const selectedPromotionOfferType = useMemo(
    () => normalizePromotionOfferType(fieldValues.promo_offer_type),
    [fieldValues.promo_offer_type],
  );
  const promotionBenefitFields = useMemo(() => {
    if (!selectedPromotionOfferType) return [];
    return PROMOTION_BENEFIT_FIELDS[selectedPromotionOfferType] || [];
  }, [selectedPromotionOfferType]);
  const visiblePromotionBenefitFields = useMemo(() => {
    if (selectedPromotionOfferType !== 'discount') {
      return promotionBenefitFields;
    }
    const discountKind = cleanText(
      fieldValues.promo_discount_kind,
    ).toLowerCase();
    return promotionBenefitFields.filter(field => {
      if (field.key === 'promo_discount_percent') {
        return discountKind === 'percent';
      }
      if (field.key === 'promo_discount_amount') {
        return discountKind === 'flat' || discountKind === 'shipping';
      }
      return true;
    });
  }, [
    fieldValues.promo_discount_kind,
    promotionBenefitFields,
    selectedPromotionOfferType,
  ]);
  const promotionFields = useMemo(() => {
    if (!typePicked) return [];
    const typeSpecific =
      PROMOTION_TYPE_FIELDS[activeType as ListingTypeId] || [];
    if (!promotionEnabled) {
      return [...PROMOTION_BASE_FIELDS, ...typeSpecific];
    }
    const offerSpecific = selectedPromotionOfferType
      ? visiblePromotionBenefitFields
      : [];
    const financeFields =
      selectedPromotionOfferType && selectedPromotionOfferType !== 'bundle'
        ? PROMOTION_FINANCE_FIELDS
        : [];
    return [
      ...PROMOTION_BASE_FIELDS,
      ...typeSpecific,
      ...offerSpecific,
      ...financeFields,
    ];
  }, [
    activeType,
    promotionEnabled,
    selectedPromotionOfferType,
    typePicked,
    visiblePromotionBenefitFields,
  ]);
  const promotionCoreFields = useMemo(
    () =>
      PROMOTION_BASE_FIELDS.filter(
        field =>
          !PROMOTION_HIDDEN_RENDER_KEYS.has(field.key) &&
          field.key !== 'promo_offer_value',
      ),
    [],
  );
  const promotionTypeFields = useMemo(
    () => PROMOTION_TYPE_FIELDS[activeType as ListingTypeId] || [],
    [activeType],
  );
  const promotionAdvancedFields = useMemo(
    () =>
      selectedPromotionOfferType &&
        !isPrimaryPromotionOfferType(selectedPromotionOfferType) &&
        selectedPromotionOfferType !== 'discount'
        ? PROMOTION_BASE_FIELDS.filter(
          field => field.key === 'promo_offer_value',
        )
        : [],
    [selectedPromotionOfferType],
  );
  const promotionRequiredFields = useMemo(
    () =>
      promotionEnabled ? promotionFields.filter(field => field.required) : [],
    [promotionEnabled, promotionFields],
  );
  const promotionRequiredDone = useMemo(
    () =>
      promotionRequiredFields.filter(
        field => cleanText(fieldValues[field.key]).length > 0,
      ).length,
    [fieldValues, promotionRequiredFields],
  );
  const requiresPrimaryImageForPublish =
    typePicked && requiresPrimaryImageForType(activeType);
  const publishReadiness = useMemo(
    () => [
      {
        key: 'type',
        done: typePicked,
        labelId: 'Pilih jenis posting yang paling pas',
        labelEn: 'Pick the closest posting type',
      },
      {
        key: 'required',
        done: typePicked && requiredDone >= requiredFields.length,
        labelId: isSimpleModeActive
          ? 'Isi info utama dengan jelas'
          : 'Lengkapi info utama dulu',
        labelEn: isSimpleModeActive
          ? 'Keep the essentials clear'
          : 'Complete the core information',
      },
      {
        key: 'images',
        done: !requiresPrimaryImageForPublish || images.length > 0,
        labelId: 'Foto utama siap',
        labelEn: 'Primary photo ready',
      },
      {
        key: 'promotion',
        done:
          !promotionEnabled ||
          promotionRequiredDone >= promotionRequiredFields.length,
        labelId: 'Cek promo kalau dipakai',
        labelEn: 'Review promo if you use it',
      },
    ],
    [
      activeType,
      images.length,
      promotionEnabled,
      promotionRequiredDone,
      promotionRequiredFields.length,
      requiredDone,
      requiredFields.length,
      isSimpleModeActive,
      requiresPrimaryImageForPublish,
      typePicked,
    ],
  );

  const getFieldLabel = (field: SectorField): string => {
    return resolveDisplayFieldLabel(
      field,
      activeType,
      listingSide,
      locale,
      FIELD_OVERRIDES,
      DEMAND_FIELD_OVERRIDES,
    );
  };
  const getPromotionOfferLabel = (
    offerType: PromotionOfferType | 'none',
  ): string => {
    const field = PROMOTION_BASE_FIELDS.find(
      item => item.key === 'promo_offer_type',
    );
    const option = field?.options?.find(item => item.value === offerType);
    if (!option) {
      return offerType;
    }
    return locale === 'id' ? option.labelId : option.labelEn;
  };
  const isFieldRequired = (field: SectorField) =>
    requiredFieldKeys.has(field.key);
  const missingStep1Fields = useMemo(
    () =>
      step1RequiredFields.filter(
        field => cleanText(fieldValues[field.key]).length === 0,
      ),
    [fieldValues, step1RequiredFields],
  );
  const missingStep2Fields = useMemo(
    () =>
      step2RequiredFields.filter(
        field => cleanText(fieldValues[field.key]).length === 0,
      ),
    [fieldValues, step2RequiredFields],
  );
  const missingPromotionFields = useMemo(
    () =>
      promotionRequiredFields.filter(
        field => cleanText(fieldValues[field.key]).length === 0,
      ),
    [fieldValues, promotionRequiredFields],
  );
  const promotionSnapshot = useMemo<PromotionSnapshot | null>(
    () =>
      promotionEnabled
        ? createPromotionSnapshot(fieldValues, parsedPriceCents, localeCode)
        : null,
    [fieldValues, localeCode, parsedPriceCents, promotionEnabled],
  );
  const promotionNeedsPriceAnchor =
    promotionEnabled &&
    isPrimaryPromotionOfferType(selectedPromotionOfferType) &&
    !parsedPriceCents;
  const promotionGuardrailUnsafe =
    promotionEnabled && promotionSnapshot?.status === 'unsafe';
  const promotionDateRangeInvalid = useMemo(() => {
    const startDate = cleanText(fieldValues.promo_start_date);
    const endDate = cleanText(fieldValues.promo_end_date);
    if (!startDate || !endDate) return false;
    return new Date(endDate).getTime() < new Date(startDate).getTime();
  }, [fieldValues.promo_end_date, fieldValues.promo_start_date]);
  const foreignBrandSignals = useMemo(
    () => detectForeignBrandSignals(fieldValues),
    [fieldValues],
  );
  const foreignBrandSignalSummary = useMemo(
    () => formatForeignBrandSignalSummary(foreignBrandSignals, locale),
    [foreignBrandSignals, locale],
  );
  const hasForeignBrandSignalForSupply =
    listingSide === 'supply' && foreignBrandSignals.length > 0;
  const publishBlockers = useMemo(() => {
    const summarizeFieldLabels = (fields: SectorField[]): string => {
      const labels = fields
        .slice(0, 2)
        .map(field =>
          resolveDisplayFieldLabel(
            field,
            activeType,
            listingSide,
            locale,
            FIELD_OVERRIDES,
            DEMAND_FIELD_OVERRIDES,
          ),
        );
      if (labels.length === 0) {
        return locale === 'id'
          ? 'Lengkapin data utamanya'
          : 'Complete the main data';
      }
      const extraCount = fields.length - labels.length;
      if (extraCount <= 0) return labels.join(', ');
      return locale === 'id'
        ? `${labels.join(', ')} +${extraCount} lagi`
        : `${labels.join(', ')} +${extraCount} more`;
    };
    const blockers: Array<{
      key: string;
      step: number;
      icon: LucideIcon;
      title: string;
      description: string;
    }> = [];

    if (!typePicked) {
      blockers.push({
        key: 'type',
        step: 1,
        icon: Target,
        title: locale === 'id' ? 'Pilih tipe listing' : 'Select listing type',
        description:
          locale === 'id'
            ? 'Begitu tipenya dipilih, form dan cekannya langsung ngikut.'
            : 'The form and validation adapt after the type is selected.',
      });
    }

    if (typePicked && missingStep1Fields.length > 0) {
      blockers.push({
        key: 'step-1',
        step: 1,
        icon: ClipboardList,
        title:
          locale === 'id'
            ? 'Bagian dasar listing belum beres'
            : 'Listing basics are incomplete',
        description: summarizeFieldLabels(missingStep1Fields),
      });
    }

    if (typePicked && hasForeignBrandSignalForSupply) {
      blockers.push({
        key: 'local-priority',
        step: 1,
        icon: ShieldCheck,
        title:
          locale === 'id'
            ? 'Ada sinyal brand luar'
            : 'Foreign-brand signal detected',
        description:
          locale === 'id'
            ? `Hapus referensi brand luar: ${foreignBrandSignalSummary}.`
            : `Lajukan prioritizes local Indonesian brands and businesses. Remove references such as ${foreignBrandSignalSummary} before publishing.`,
      });
    }

    if (
      typePicked &&
      listingMode !== 'simple' &&
      missingStep2Fields.length > 0
    ) {
      blockers.push({
        key: 'step-2',
        step: 2,
        icon: FolderKanban,
        title:
          locale === 'id'
            ? 'Detailnya masih ada yang bolong'
            : 'Detail requirements are incomplete',
        description: summarizeFieldLabels(missingStep2Fields),
      });
    }

    if (requiresPrimaryImageForPublish && images.length === 0) {
      blockers.push({
        key: 'images',
        step: 3,
        icon: ImageIcon,
        title:
          locale === 'id'
            ? 'Perlu minimal 1 foto'
            : 'At least 1 photo is required',
        description:
          locale === 'id'
            ? activeType === 'tool_rental'
              ? 'Biar kondisinya gampang dicek, listing sewa alat perlu foto utama dulu.'
              : 'Produk dan properti perlu cover dulu biar bisa tayang.'
            : activeType === 'tool_rental'
              ? 'Rental listings need a primary image so the asset condition can be verified before publish.'
              : 'Products and properties need a cover image before publishing.',
      });
    }

    if (promotionEnabled && missingPromotionFields.length > 0) {
      blockers.push({
        key: 'promotion',
        step: 4,
        icon: Megaphone,
        title:
          locale === 'id'
            ? 'Bagian promonya masih bolong'
            : 'Promotion setup is incomplete',
        description: summarizeFieldLabels(missingPromotionFields),
      });
    }

    if (promotionNeedsPriceAnchor) {
      blockers.push({
        key: 'promotion-price',
        step: 4,
        icon: BadgeDollarSign,
        title:
          locale === 'id'
            ? 'Benefit perlu harga patokan'
            : 'Benefit needs a price anchor',
        description:
          locale === 'id'
            ? 'Isi harga listing dulu biar sistem bisa cek fee, PPN, dan opex-nya masih ketutup atau belum.'
            : 'Add the listing price so the system can verify fees, tax, and opex stay covered.',
      });
    }

    if (promotionGuardrailUnsafe) {
      blockers.push({
        key: 'promotion-guardrail',
        step: 4,
        icon: ShieldCheck,
        title:
          locale === 'id'
            ? 'Benefitnya ketinggian'
            : 'Benefit is too aggressive',
        description:
          promotionSnapshot?.financialMessage ||
          (locale === 'id'
            ? 'Coba kecilin benefitnya atau naikin margin/harganya.'
            : 'Reduce the offer or improve margin/price.'),
      });
    }

    if (promotionEnabled && promotionDateRangeInvalid) {
      blockers.push({
        key: 'promotion-dates',
        step: 4,
        icon: CalendarClock,
        title:
          locale === 'id'
            ? 'Tanggal promonya belum pas'
            : 'Promotion dates are invalid',
        description:
          locale === 'id'
            ? 'Tanggal selesai harus lewat dari tanggal mulai.'
            : 'End date must be after the start date.',
      });
    }

    return blockers;
  }, [
    activeType,
    images.length,
    listingMode,
    locale,
    listingSide,
    missingPromotionFields,
    missingStep1Fields,
    missingStep2Fields,
    promotionDateRangeInvalid,
    promotionEnabled,
    promotionGuardrailUnsafe,
    promotionNeedsPriceAnchor,
    promotionSnapshot?.financialMessage,
    requiresPrimaryImageForPublish,
    hasForeignBrandSignalForSupply,
    foreignBrandSignalSummary,
    typePicked,
  ]);
  const ActiveTypeIcon = selectedType?.icon || ScanLine;
  const buildCreateHref = ({
    draftId = workingId,
    step = currentStep,
    typeId = requestedType || (typePicked ? activeType : ''),
    sideId = listingSide,
  }: {
    draftId?: string | null;
    step?: number;
    typeId?: string;
    sideId?: ListingSide | null;
  } = {}) =>
    buildCreateHrefFromSearch(searchParams, {
      locale,
      draftId,
      step,
      typeId,
      sideId,
    });
  const syncCreateRoute = ({
    draftId = workingId,
    step = currentStep,
    typeId = requestedType || (typePicked ? activeType : ''),
    sideId = listingSide,
  }: {
    draftId?: string | null;
    step?: number;
    typeId?: string;
    sideId?: ListingSide | null;
  } = {}) => {
    const nextHref = buildCreateHref({ draftId, step, typeId, sideId });
    const currentHref = searchParams.toString()
      ? `${pathname}?${searchParams.toString()}`
      : pathname;
    if (nextHref === currentHref) return;
    router.replace(nextHref, { scroll: false });
  };
  const goToStep = (
    step: number,
    options?: {
      draftId?: string | null;
      typeId?: string;
      sideId?: ListingSide | null;
    },
  ) => {
    const nextStep = clampStep(step);
    setCurrentStep(nextStep);
    syncCreateRoute({
      draftId: options?.draftId ?? workingId,
      step: nextStep,
      typeId: options?.typeId ?? (typePicked ? activeType : requestedType),
      sideId: options?.sideId ?? listingSide,
    });
  };
  const handleTypeSelection = (
    nextType: string,
    options?: { listingSide?: ListingSide | null },
  ) => {
    if (typeSelectionLocked) return;
    if (nextType !== type) {
      setFieldValues(prev => sanitizeFieldValuesForType(prev, nextType));
      setPromotionEnabled(false);
    }
    const nextSide = options?.listingSide ?? getDefaultListingSide(nextType);
    setType(nextType);
    setTypePicked(true);
    setCurrentStep(1);
    setListingSide(nextSide);
    if (!supportsSimpleListingMode(nextType)) {
      setListingMode('detail');
    }
    if (nextType === 'property') {
      setSector('realestate');
      setSubSector('');
    } else if (!supportsSectorClassification(nextType)) {
      setSector('');
      setSubSector('');
    } else if (type === 'property' && sector === 'realestate') {
      setSector('');
      setSubSector('');
    }
    setInfoMessage('');
    setErrorMessage('');
    syncCreateRoute({
      draftId: workingId,
      step: 1,
      typeId: nextType,
      sideId: nextSide,
    });
  };
  const applyListingTemplate = (templateId: string) => {
    const template = LISTING_TEMPLATES.find(item => item.id === templateId);
    if (!template) return;

    handleTypeSelection(template.typeId, { listingSide: template.listingSide });
    setListingMode(
      template.listingMode ||
      (supportsSimpleListingMode(template.typeId) ? 'simple' : 'detail'),
    );
    setListingSide(template.listingSide);
    if (template.typeId === 'property') {
      setSector('realestate');
      setSubSector(template.subSector || '');
    } else if (supportsSectorClassification(template.typeId)) {
      setSector(template.sector || '');
      setSubSector(template.subSector || '');
    } else {
      setSector('');
      setSubSector('');
    }
    setPromotionEnabled(false);
    setFieldValues(prev => ({
      ...sanitizeFieldValuesForType(prev, template.typeId),
      ...template.fields,
    }));
    setInfoMessage(
      locale === 'id'
        ? 'Template diterapkan. Tinggal edit seperlunya.'
        : 'Template applied. Edit only what you need.',
    );
    setErrorMessage('');
    syncCreateRoute({
      draftId: workingId,
      step: 1,
      typeId: template.typeId,
      sideId: template.listingSide,
    });
  };
  const openTypePicker = () => {
    if (typeSelectionLocked) return;
    const nextBasePath =
      entryMode === 'root'
        ? '/create'
        : buildCreateBasePath({
          locale,
          sideId: entryMode === 'demand' ? 'demand' : 'supply',
        });
    setType('');
    setTypePicked(false);
    setCurrentStep(1);
    setSector('');
    setSubSector('');
    setIsSectorPickerOpen(false);
    setSectorQuery('');
    setListingMode('simple');
    setListingSide('supply');
    setPromotionEnabled(false);
    setFieldValues(prev => sanitizeFieldValuesForType(prev, 'product'));
    setInfoMessage('');
    setErrorMessage('');
    router.replace(nextBasePath, { scroll: false });
  };
  const applyJourneyIntent = (step: (typeof journeyIntents)[number]) => {
    handleTypeSelection(step.typeId, { listingSide: step.listingSide });
  };
  const specialCreateThemes = {
    profile: {
      stepActive:
        'border-lime-300 bg-lime-50 text-lime-800 dark:border-lime-800 dark:bg-lime-950/40 dark:text-lime-200',
      cardSelected:
        'border-lime-300 bg-lime-50 text-lime-800 dark:border-lime-800 dark:bg-lime-950/40 dark:text-lime-200',
      cardBase:
        'border-lime-200 bg-[linear-gradient(135deg,rgba(217,249,157,0.2)_0%,rgba(255,255,255,0.97)_70%)] text-[color:var(--app-text)] dark:border-lime-900/70 dark:bg-[linear-gradient(135deg,rgba(132,204,22,0.2)_0%,rgba(10,10,10,0.92)_72%)]',
      cardIcon:
        'border-lime-200/80 bg-lime-50 text-lime-800 dark:border-lime-900/70 dark:bg-lime-950/50 dark:text-lime-200',
      buttonPrimary: 'from-lime-500 to-emerald-600',
      badge:
        'border-lime-300 bg-lime-50 text-lime-800 dark:border-lime-800 dark:bg-lime-950/40 dark:text-lime-200',
    },
    umkm: {
      stepActive:
        'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
      cardSelected:
        'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
      cardBase:
        'border-emerald-200 bg-[linear-gradient(135deg,rgba(110,231,183,0.18)_0%,rgba(255,255,255,0.97)_70%)] text-[color:var(--app-text)] dark:border-emerald-900/70 dark:bg-[linear-gradient(135deg,rgba(16,185,129,0.22)_0%,rgba(15,23,42,0.92)_72%)]',
      cardIcon:
        'border-emerald-200/80 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/50 dark:text-emerald-200',
      buttonPrimary: 'from-emerald-500 to-emerald-600',
      badge:
        'border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200',
    },
  } satisfies Record<'profile' | 'umkm', TypeThemeMeta>;
  const supplyCreateCards = [
    {
      key: 'product',
      typeId: 'product' as ListingTypeId,
      badge: locale === 'id' ? 'Produk' : 'Products',
      title: locale === 'id' ? 'Tawarkan produk Anda' : 'Offer your products',
      description:
        locale === 'id'
          ? 'Untuk barang jadi, bahan baku, stok grosir, atau supplier.'
          : 'Offer stock, raw materials, or ready-to-ship products.',
      Icon: Package,
      theme: TYPE_THEMES.product,
      highlights:
        locale === 'id'
          ? ['Stok', 'MOQ', 'Kirim']
          : ['Stock', 'MOQ', 'Delivery'],
    },
    {
      key: 'service',
      typeId: 'service' as ListingTypeId,
      badge: locale === 'id' ? 'Jasa' : 'Services',
      title: locale === 'id' ? 'Tawarkan jasa Anda' : 'Offer your service',
      description:
        locale === 'id'
          ? 'Untuk layanan, paket kerja, atau channel operasional.'
          : 'Offer services buyers can understand immediately.',
      Icon: Wrench,
      theme: TYPE_THEMES.service,
      highlights:
        locale === 'id'
          ? ['Scope', 'Output', 'Area']
          : ['Scope', 'Output', 'Area'],
    },
  ] as const;
  const supplySupportCards = PROMO_ONLY_MODE
    ? []
    : ([
      {
        key: 'property',
        href: resolveMarketplaceCreatePath(locale, 'property', 'supply'),
        badge: locale === 'id' ? 'Lokasi' : 'Spaces',
        title:
          locale === 'id' ? 'Tawarkan lokasi jualan' : 'Offer selling space',
        description:
          locale === 'id'
            ? 'Untuk booth, kios, ruko, atau area jual.'
            : 'Use this for booths, kiosks, shophouses, or selling spaces.',
        example:
          locale === 'id'
            ? 'Contoh: sewa booth bazaar weekend di Bekasi'
            : 'Example: rent a weekend bazaar booth in Bekasi',
        Icon: MapPin,
        theme: TYPE_THEMES.property,
        highlights:
          locale === 'id'
            ? ['Booth', 'Kios', 'Traffic']
            : ['Booth', 'Kiosk', 'Traffic'],
      },
      {
        key: 'tool_rental',
        href: resolveMarketplaceCreatePath(locale, 'tool_rental', 'supply'),
        badge: locale === 'id' ? 'Sewa alat' : 'Tool rental',
        title: locale === 'id' ? 'Sewakan alat usaha' : 'Rent out tools',
        description:
          locale === 'id'
            ? 'Untuk freezer, alat produksi, atau alat konten.'
            : 'Use this for freezers, production gear, or content tools.',
        example:
          locale === 'id'
            ? 'Contoh: sewa freezer display 7 hari untuk pop-up'
            : 'Example: rent a display freezer for a seven-day pop-up',
        Icon: Snowflake,
        theme: TYPE_THEMES.tool_rental,
        highlights:
          locale === 'id'
            ? ['Alat', 'Durasi', 'Pickup']
            : ['Tools', 'Duration', 'Pickup'],
      },
      {
        key: 'business_transfer',
        href: resolveMarketplaceCreatePath(
          locale,
          'business_transfer',
          'supply',
        ),
        badge: locale === 'id' ? 'Oper usaha' : 'Business transfer',
        title:
          locale === 'id' ? 'Tawarkan oper usaha' : 'Offer business transfer',
        description:
          locale === 'id'
            ? 'Usaha berjalan, aset, rating, dan handover.'
            : 'Sell a running business, assets, ratings, and handover.',
        example:
          locale === 'id'
            ? 'Contoh: oper usaha laundry aktif plus SOP'
            : 'Example: transfer an active laundry business plus SOP',
        Icon: Handshake,
        theme: TYPE_THEMES.business_transfer,
        highlights:
          locale === 'id'
            ? ['Omzet', 'Aset', 'Handover']
            : ['Revenue', 'Assets', 'Handover'],
      },
      {
        key: 'profile',
        href: '/profile/edit?focus=talent',
        badge: locale === 'id' ? 'Profil talent' : 'Talent profile',
        title:
          locale === 'id'
            ? 'Tawarkan skill lewat profil'
            : 'Offer skills via profile',
        description:
          locale === 'id'
            ? 'Kalau Anda menjual skill pribadi, rapikan profil agar mudah dipercaya.'
            : 'If you want to sell personal skills, polish your user profile.',
        example:
          locale === 'id'
            ? 'Contoh: profil akuntan UMKM freelance'
            : 'Example: freelance MSME accountant profile',
        Icon: Users,
        theme: specialCreateThemes.profile,
        highlights:
          locale === 'id'
            ? ['Headline', 'Skill', 'Rate']
            : ['Headline', 'Skills', 'Rate'],
      },
    ] as const);
  const typeSelectorGrid = (
    <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
      {supplyCreateCards.map(card => {
        const pickerMeta =
          TYPE_PICKER_META[card.typeId] || TYPE_PICKER_META.product;
        return (
          <CreateChoiceCard
            key={card.key}
            disabled={typeSelectionLocked}
            onClick={() => handleTypeSelection(card.typeId)}
            Icon={card.Icon}
            theme={card.theme}
            selected={type === card.typeId}
            badge={card.badge}
            title={card.title}
            description={
              locale === 'id'
                ? pickerMeta?.helperId || card.description
                : pickerMeta?.helperEn || card.description
            }
            example={getCreateChoiceExample(card.typeId, 'supply', locale)}
            highlights={card.highlights}
            actionLabel={locale === 'id' ? 'Mulai' : 'Start'}
          />
        );
      })}
    </div>
  );
  const supplySupportQuickLinks =
    supplySupportCards.length > 0 ? (
      <div className="mt-2 grid grid-cols-2 gap-2 xl:grid-cols-3">
        {supplySupportCards.map(card => (
          <button
            key={card.key}
            type="button"
            onClick={() => router.push(card.href)}
            className={cn(
              'group relative flex min-h-[124px] flex-col items-start justify-end overflow-hidden rounded-[18px] border px-3 pb-2.5 pt-12 text-left shadow-[0_14px_28px_-28px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_20px_34px_-30px_rgba(15,23,42,0.24)] sm:min-h-[150px] sm:px-3.5 sm:pb-3 sm:pt-14',
              card.theme.cardBase,
            )}
          >
            <span className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-current/20" />
            <span
              className={cn(
                'absolute left-3 top-3 inline-flex h-9 w-9 items-center justify-center rounded-[13px] sm:h-10 sm:w-10 sm:rounded-[15px]',
                card.theme.cardIcon,
              )}
            >
              <card.Icon className="h-4.5 w-4.5 sm:h-5 sm:w-5" />
            </span>
            <span className="mt-auto block min-w-0">
              <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[color:var(--app-text-soft)] sm:text-[10px] sm:tracking-[0.12em]">
                {card.badge}
              </span>
              <span className="mt-1 line-clamp-2 block text-[13px] font-black leading-tight text-[color:var(--app-text)] sm:text-[14px]">
                {card.title}
              </span>
              <span className="mt-1 hidden line-clamp-2 text-[11px] leading-5 text-[color:var(--app-text-soft)] min-[420px]:block">
                {card.description}
              </span>
              <span className="mt-2 block rounded-[12px] bg-white/78 px-2.5 py-1.5 text-[10.5px] font-semibold leading-4 text-[color:var(--app-text)] ring-1 ring-white/80 dark:bg-slate-950/48 dark:ring-white/10 sm:text-[11px]">
                <span className="font-black text-[color:var(--app-accent)]">
                  {locale === 'id' ? 'Contoh:' : 'Example:'}
                </span>{' '}
                {card.example.replace(/^(Contoh:|Example:)\s*/i, '')}
              </span>
            </span>
            <span className="mt-2 flex w-full items-center justify-between gap-2">
              <span className="truncate text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                {card.highlights[0]}
              </span>
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] sm:h-8 sm:w-8">
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </span>
          </button>
        ))}
      </div>
    ) : null;
  const errorDetails = errorMessage
    .split('\n')
    .map(line => line.trim())
    .filter(Boolean);
  const showCreateEntry = !typePicked && (!draftParam || Boolean(errorMessage));
  const showRootIntentPicker = showCreateEntry && entryMode === 'root';
  const showDemandIntentPicker = showCreateEntry && entryMode === 'demand';
  const showSupplyIntentPicker = showCreateEntry && entryMode === 'supply';
  const demandEntryHref = buildCreateBasePath({
    locale,
    sideId: 'demand',
  });
  const supplyEntryHref = buildCreateBasePath({
    locale,
    sideId: 'supply',
  });
  const createEntryTabs: Array<{
    key: CreateFlowIntent;
    href: string;
    label: string;
    helper: string;
    Icon: LucideIcon;
  }> = [
      {
        key: 'supply',
        href: supplyEntryHref,
        label: locale === 'id' ? 'Tawarkan' : 'Offer',
        helper:
          locale === 'id'
            ? PROMO_ONLY_MODE
              ? 'Produk dan jasa'
              : 'Produk, jasa, lokasi'
            : PROMO_ONLY_MODE
              ? 'Products and services'
              : 'Products, services, spaces',
        Icon: Store,
      },
      {
        key: 'demand',
        href: demandEntryHref,
        label: locale === 'id' ? 'Cari kebutuhan' : 'Find what you need',
        helper:
          locale === 'id'
            ? PROMO_ONLY_MODE
              ? 'Supplier dan jasa'
              : 'Supplier, jasa, talent'
            : PROMO_ONLY_MODE
              ? 'Find suppliers and services'
              : 'Find suppliers, services, talent',
        Icon: Target,
      },
    ];
  const renderCreateEntrySurface = ({
    activeIntent,
    topTitle,
    showIntentTabs = true,
    eyebrow,
    title,
    description,
    children,
    aside,
  }: {
    activeIntent: CreateFlowIntent;
    topTitle?: string;
    showIntentTabs?: boolean;
    eyebrow: string;
    title: string;
    description: string;
    children: ReactNode;
    aside?: ReactNode;
  }) => {
    return (
      <div className="mx-auto w-full max-w-none px-0 py-0">
        <CreateHeroShell className="border-emerald-100/90 bg-[linear-gradient(180deg,#ffffff_0%,#f7fff9_100%)] p-3 shadow-[0_20px_44px_-38px_rgba(15,23,42,0.22)] sm:p-5 lg:p-5 dark:border-emerald-900/40 dark:bg-[color:var(--app-surface-strong)]">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={handlePageBack}
                aria-label={locale === 'id' ? 'Kembali' : 'Back'}
                className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[15px] bg-white text-[color:var(--app-text)] ring-1 ring-emerald-100 transition hover:bg-emerald-50 dark:bg-slate-950/60 dark:ring-[color:var(--app-border-strong)]"
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                  {locale === 'id' ? 'Buat Baru' : 'Create'}
                </p>
                <h1 className="truncate text-[1.1rem] font-black leading-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.3rem]">
                  {topTitle ??
                    (activeIntent === 'supply'
                      ? locale === 'id'
                        ? 'Listing'
                        : 'Listing'
                      : locale === 'id'
                        ? 'Permintaan'
                        : 'Request')}
                </h1>
              </div>
            </div>
            <button
              type="button"
              onClick={() => router.push('/my-listings')}
              className="inline-flex min-h-[36px] items-center justify-center gap-2 rounded-full bg-white px-3 text-[11px] font-semibold text-[color:var(--app-text)] ring-1 ring-emerald-100 transition hover:bg-emerald-50 dark:bg-slate-950/60 dark:ring-[color:var(--app-border-strong)]"
            >
              <FolderKanban className="h-4 w-4" />
              {locale === 'id' ? 'Draft' : 'Drafts'}
            </button>
          </div>

          <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="min-w-0">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="inline-flex rounded-full border border-[color:var(--app-accent-border)] bg-white/88 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)] shadow-sm">
                    {eyebrow}
                  </p>
                  <h2 className="mt-2 text-[1.25rem] font-black leading-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.75rem]">
                    {title}
                  </h2>
                  <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[color:var(--app-text-soft)] sm:text-[13px]">
                    {description}
                  </p>
                </div>
              </div>

              {showIntentTabs ? (
                <nav className="mt-3 grid max-w-[560px] grid-cols-2 gap-1.5 rounded-[16px] border border-emerald-100 bg-white/86 p-1.5 text-[11px] font-semibold shadow-[0_14px_28px_-26px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-950/55">
                  {createEntryTabs.map(tab => {
                    const isActive = tab.key === activeIntent;
                    const TabIcon = tab.Icon;
                    return (
                      <Link
                        key={tab.key}
                        href={tab.href}
                        aria-current={isActive ? 'page' : undefined}
                        className={cn(
                          'flex min-h-[44px] min-w-0 items-center gap-2 rounded-[13px] px-2.5 py-2 text-left transition',
                          isActive
                            ? tab.key === 'demand'
                              ? 'bg-amber-500 text-white shadow-[0_14px_26px_-22px_rgba(217,119,6,0.45)]'
                              : 'bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] text-[color:var(--app-text-inverse)] shadow-[0_14px_26px_-22px_rgba(22,163,74,0.45)]'
                            : 'text-[color:var(--app-text-soft)] hover:bg-white hover:text-[color:var(--app-text)] dark:hover:bg-slate-900/80',
                        )}
                      >
                        <span
                          className={cn(
                            'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[11px]',
                            isActive ? 'bg-white/16' : 'bg-emerald-50',
                          )}
                        >
                          <TabIcon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                          <span className="block truncate font-black">
                            {tab.label}
                          </span>
                          <span
                            className={cn(
                              'block truncate text-[10px] font-semibold',
                              isActive
                                ? 'text-white/78'
                                : 'text-[color:var(--app-text-soft)]',
                            )}
                          >
                            {tab.helper}
                          </span>
                        </span>
                      </Link>
                    );
                  })}
                </nav>
              ) : null}

              <div className="mt-3">{children}</div>
            </section>

            {aside ? (
              <aside className="grid content-start gap-2">{aside}</aside>
            ) : null}
          </div>
        </CreateHeroShell>
      </div>
    );
  };
  const canChangeTypeBeforeDraft =
    typePicked && !typeSelectionLocked && !workingId;
  const publishReadyCount = publishReadiness.filter(item => item.done).length;
  const topPublishBlockers = publishBlockers.slice(0, 3);
  const showStepOneSetupCard =
    currentStep === 1 &&
    !isNeedServiceJourney &&
    !isSimpleModeActive &&
    (canSwitchListingSide || (!isSimpleModeActive && typePicked));
  const showSharePackPanel =
    typePicked &&
    (!isSimpleModeActive ||
      currentStep === TOTAL_STEPS ||
      contentStatus === 'active');
  const showDesktopAssistRail = typePicked && currentStep > 1;
  const industryPickerLayer =
    showSectorPicker && isSectorPickerOpen ? (
      <div
        className="ui-layer-modal fixed inset-0 bg-slate-950/50 px-3 py-4 backdrop-blur-sm sm:p-6"
        onClick={() => setIsSectorPickerOpen(false)}
      >
        <div className="flex h-full items-end justify-center sm:items-center">
          <div
            className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-[0_26px_60px_-34px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
            onClick={event => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-slate-200/75 px-3.5 py-3.5 dark:border-slate-800/70">
              <div className="min-w-0">
                <p className="inline-flex rounded-full border border-teal-200/70 bg-white/85 px-2.5 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-teal-700 shadow-[0_16px_24px_-20px_rgba(20,184,166,0.34)] dark:border-teal-900/70 dark:bg-teal-950/20 dark:text-teal-200">
                  {locale === 'id'
                    ? 'Spesialisasi industri'
                    : 'Industry specialization'}
                </p>
                <h3 className="mt-3 text-[1.05rem] font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {locale === 'id'
                    ? 'Pilih bila perlu field yang lebih spesifik'
                    : 'Pick this only when you need more specific fields'}
                </h3>
                <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                  {locale === 'id'
                    ? 'Form tetap bisa lanjut tanpa kategori ini. Picker ini hanya merapikan filter dan konteks listing.'
                    : 'The form can continue without this category. This picker only sharpens filtering and listing context.'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsSectorPickerOpen(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/70 bg-white/80 text-[color:var(--app-text)] shadow-[0_16px_24px_-20px_rgba(15,23,42,0.2)] backdrop-blur-sm dark:border-slate-800/70 dark:bg-slate-950/55"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-4">
              <label className="block text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                {locale === 'id' ? 'Cari kategori' : 'Search categories'}
              </label>
              <div className="mt-1 flex items-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 dark:border-[color:var(--app-border-strong)]">
                <Search className="h-4 w-4 text-[color:var(--app-text-soft)]" />
                <input
                  type="text"
                  value={sectorQuery}
                  onChange={event => setSectorQuery(event.target.value)}
                  placeholder={
                    locale === 'id'
                      ? 'Cari manufaktur, makanan, teknologi, properti...'
                      : 'Search manufacturing, food, technology, real estate...'
                  }
                  className="w-full border-0 bg-transparent text-sm text-[color:var(--app-text)] outline-none placeholder:text-[color:var(--app-text-soft)]"
                />
              </div>

              {sectorsLoading ? (
                <p className="mt-3 text-[12px] text-[color:var(--app-text-soft)]">
                  {locale === 'id'
                    ? 'Memuat kategori industri...'
                    : 'Loading industry categories...'}
                </p>
              ) : null}

              {sectorsError ? (
                <div className="mt-3 rounded-2xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-[12px] text-[color:var(--app-danger)]">
                  {sectorsError}
                </div>
              ) : null}

              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {filteredSectors.map(item => {
                  const selected = sector === item.id;
                  const itemSubSectors = getSubSectors(item.id);
                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => {
                        if (selected) {
                          setSector('');
                          setSubSector('');
                          return;
                        }
                        setSector(item.id);
                        setSubSector('');
                        if (itemSubSectors.length === 0) {
                          setIsSectorPickerOpen(false);
                        }
                      }}
                      style={selected ? item.colorStyle : undefined}
                      className={cn(
                        'rounded-[22px] border p-3 text-left transition',
                        selected
                          ? `${item.colorClass} border-transparent text-white shadow-[0_18px_36px_-28px_rgba(15,23,42,0.4)]`
                          : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-[color:var(--app-info-border)] dark:border-[color:var(--app-border-strong)]',
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          className={cn(
                            'inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl border',
                            selected
                              ? 'border-white/20 bg-white/15'
                              : `${item.colorClass || 'bg-slate-100'} border-transparent text-white`,
                          )}
                          style={!selected ? item.colorStyle : undefined}
                        >
                          <item.icon className="h-4.5 w-4.5" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold leading-tight">
                            {getSectorLabel(item, locale)}
                          </span>
                          <span
                            className={cn(
                              'mt-1 block text-[11px] leading-5',
                              selected
                                ? 'text-white/80'
                                : 'text-[color:var(--app-text-soft)]',
                            )}
                          >
                            {getSectorDescription(item, locale) ||
                              (locale === 'id'
                                ? 'Kategori umum'
                                : 'General category')}
                          </span>
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {!sectorsLoading && filteredSectors.length === 0 ? (
                <div className="mt-3 rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-4 text-[12px] text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]">
                  {locale === 'id'
                    ? 'Tidak ada kategori yang cocok. Coba kata kunci lain atau lanjut tanpa kategori industri.'
                    : 'No category matches the search. Try another keyword or continue without an industry category.'}
                </div>
              ) : null}

              {selectedSectorView && subSectors.length > 0 ? (
                <div className="mt-4 rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {locale === 'id'
                          ? 'Sub-kategori (opsional)'
                          : 'Sub-category (optional)'}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--app-text-soft)]">
                        {locale === 'id'
                          ? 'Pilih bila ingin konteks yang lebih presisi.'
                          : 'Pick one if you want even more precise context.'}
                      </p>
                    </div>
                    {selectedSubSectorView ? (
                      <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-1 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)]">
                        {getSubSectorName(selectedSubSectorView, locale)}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {subSectors.map(item => (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => {
                          setSubSector(subSector === item.id ? '' : item.id);
                          setIsSectorPickerOpen(false);
                        }}
                        className={cn(
                          'rounded-full border px-3 py-1.5 text-[11px] font-semibold transition',
                          subSector === item.id
                            ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                            : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-[color:var(--app-info-border)] dark:border-[color:var(--app-border-strong)]',
                        )}
                      >
                        {getSubSectorName(item, locale)}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--app-border)] px-4 py-4 dark:border-[color:var(--app-border-strong)]">
              <button
                type="button"
                onClick={() => {
                  setSector('');
                  setSubSector('');
                  setSectorQuery('');
                  setIsSectorPickerOpen(false);
                }}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 text-xs font-semibold text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]"
              >
                {locale === 'id'
                  ? 'Lanjut tanpa kategori'
                  : 'Continue without category'}
              </button>
              <button
                type="button"
                onClick={() => setIsSectorPickerOpen(false)}
                className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-teal-200 bg-teal-50 px-3.5 text-xs font-semibold text-teal-700 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200"
              >
                {locale === 'id' ? 'Selesai' : 'Done'}
              </button>
            </div>
          </div>
        </div>
      </div>
    ) : null;
  const rootCreateActions: CreateEntryAction[] = [
    {
      key: 'sell-product',
      href: buildCreateBasePath({
        locale,
        sideId: 'supply',
        typeId: 'product',
      }),
      title: locale === 'id' ? 'Tawarkan produk' : 'Offer product',
      description:
        locale === 'id'
          ? 'Barang jadi, bahan baku, stok grosir, atau paket supplier.'
          : 'Post products, stock, or raw materials.',
      chips:
        locale === 'id'
          ? ['Harga', 'Stok', 'MOQ']
          : ['Price', 'Stock', 'Photos'],
      Icon: Package,
      tone: 'bg-emerald-100 text-emerald-700',
    },
    {
      key: 'sell-service-package',
      href: buildCreateBasePath({
        locale,
        sideId: 'supply',
        typeId: 'service',
      }),
      title: locale === 'id' ? 'Buat paket jasa' : 'Create service package',
      description:
        locale === 'id'
          ? 'Jual jasa sebagai paket jelas: scope, durasi, output, dan harga.'
          : 'Sell services as clear packages with scope, duration, output, and price.',
      chips:
        locale === 'id'
          ? ['Paket', 'Output', 'Harga']
          : ['Package', 'Output', 'Price'],
      Icon: BriefcaseBusiness,
      tone: 'bg-orange-100 text-orange-700',
    },
    {
      key: 'sell-mentor',
      href: buildCreateBasePath({
        locale,
        sideId: 'supply',
        typeId: 'service',
      }),
      title: locale === 'id' ? 'Jadi mentor' : 'Offer mentoring',
      description:
        locale === 'id'
          ? 'Tawarkan sesi konsultasi, kelas kecil, audit, atau pendampingan.'
          : 'Offer consulting sessions, mini classes, audits, or mentoring.',
      chips:
        locale === 'id'
          ? ['Sesi', 'Materi', 'Harga']
          : ['Session', 'Topic', 'Price'],
      Icon: Users,
      tone: 'bg-sky-100 text-sky-700',
    },
    {
      key: 'need-mentor',
      href: buildCreateBasePath({
        locale,
        sideId: 'demand',
        typeId: 'service',
      }),
      title: locale === 'id' ? 'Cari mentor' : 'Find mentor',
      description:
        locale === 'id'
          ? 'Butuh arahan untuk usaha, karier, produk, marketing, atau operasional.'
          : 'Need guidance for business, career, products, marketing, or operations.',
      chips:
        locale === 'id'
          ? ['Topik', 'Budget', 'Jadwal']
          : ['Topic', 'Budget', 'Schedule'],
      Icon: Sparkles,
      tone: 'bg-violet-100 text-violet-700',
    },
    {
      key: 'need-product',
      href: buildCreateBasePath({
        locale,
        sideId: 'demand',
        typeId: 'product',
      }),
      title: locale === 'id' ? 'Cari produk/supplier' : 'Find supplier/goods',
      description:
        locale === 'id'
          ? 'Tulis barang, jumlah, lokasi kirim, dan budget agar supplier bisa respon.'
          : 'Post item, quantity, delivery area, and budget so suppliers can respond.',
      chips:
        locale === 'id' ? ['Budget', 'Area', 'Qty'] : ['Budget', 'Area', 'Qty'],
      Icon: Target,
      tone: 'bg-amber-100 text-amber-700',
    },
    {
      key: 'need-service',
      href: buildCreateBasePath({
        locale,
        sideId: 'demand',
        typeId: 'service',
      }),
      title: locale === 'id' ? 'Cari jasa/vendor' : 'Find service',
      description:
        locale === 'id'
          ? 'Cari vendor untuk foto produk, admin, desain, legal, event, atau live.'
          : 'Find vendors for photos, admin, design, legal, events, or live selling.',
      chips:
        locale === 'id'
          ? ['Scope', 'Deadline', 'Budget']
          : ['Scope', 'Deadline', 'Budget'],
      Icon: Wrench,
      tone: 'bg-cyan-100 text-cyan-700',
    },
    {
      key: 'sell-property',
      href: buildCreateBasePath({
        locale,
        sideId: 'supply',
        typeId: 'property',
      }),
      title: locale === 'id' ? 'Tawarkan lokasi' : 'Offer space',
      description:
        locale === 'id'
          ? 'Untuk ruko, booth, kios, dapur, gudang, atau area jualan.'
          : 'Offer business locations, booths, or spaces.',
      chips:
        locale === 'id'
          ? ['Sewa', 'Fasilitas', 'Maps']
          : ['Rent', 'Facilities', 'Maps'],
      Icon: MapPin,
      tone: 'bg-rose-100 text-rose-700',
    },
    {
      key: 'rent-tools',
      href: buildCreateBasePath({
        locale,
        sideId: 'supply',
        typeId: 'tool_rental',
      }),
      title: locale === 'id' ? 'Sewakan alat' : 'Rent out tools',
      description:
        locale === 'id'
          ? 'Untuk kamera, freezer, mesin, booth, tenda, atau alat event.'
          : 'For cameras, freezers, machines, booths, tents, or event tools.',
      chips:
        locale === 'id'
          ? ['Durasi', 'Deposit', 'Foto']
          : ['Duration', 'Deposit', 'Photos'],
      Icon: Wrench,
      tone: 'bg-lime-100 text-lime-800',
    },
    {
      key: 'company',
      href: resolveMarketplaceCreatePath(locale, 'company', 'supply'),
      title: locale === 'id' ? 'Buat profil usaha' : 'Create business profile',
      description:
        locale === 'id'
          ? 'Halaman usaha publik untuk alamat, kontak, katalog, dan cerita singkat.'
          : 'A public business page for address, contact, catalog, and a short story.',
      chips:
        locale === 'id'
          ? ['Alamat', 'Kontak', 'Katalog']
          : ['Profile', 'Address', 'Catalog'],
      Icon: Store,
      tone: 'bg-emerald-100 text-emerald-700',
    },
  ];
  const journeyIntents = UMKM_JOURNEY_STEPS.filter(step => {
    if (!CORE_DEMAND_CREATE_TYPE_IDS.has(step.typeId as ListingTypeId)) {
      return false;
    }
    if (!PROMO_ONLY_MODE) return true;
    return step.typeId === 'product' || step.typeId === 'service';
  });
  const demandFormEyebrow =
    activeType === 'product'
      ? locale === 'id'
        ? 'Cari barang'
        : 'Supplier brief'
      : activeType === 'property'
        ? locale === 'id'
          ? 'Cari properti'
          : 'Location brief'
        : activeType === 'service'
          ? locale === 'id'
            ? 'Cari jasa'
            : 'Service brief'
          : activeType === 'job'
            ? locale === 'id'
              ? 'Cari talent'
              : 'Talent brief'
            : activeType === 'tool_rental'
              ? locale === 'id'
                ? 'Cari alat sewa'
                : 'Tool rental brief'
              : locale === 'id'
                ? 'Cari kebutuhan'
                : 'Need brief';
  const supplyFormEyebrow =
    activeType === 'product'
      ? locale === 'id'
        ? 'Tawarkan produk'
        : 'Supplier listing'
      : activeType === 'property'
        ? locale === 'id'
          ? 'Tawarkan lokasi'
          : 'Location listing'
        : activeType === 'service'
          ? locale === 'id'
            ? 'Tawarkan jasa'
            : 'Service listing'
          : activeType === 'tool_rental'
            ? locale === 'id'
              ? 'Sewakan alat'
              : 'Tool rental listing'
            : activeType === 'company'
              ? locale === 'id'
                ? 'Profil usaha'
                : 'Business profile'
              : locale === 'id'
                ? 'Form listing'
                : 'Listing form';
  const formEyebrow =
    typePicked && listingSide === 'demand'
      ? demandFormEyebrow
      : supplyFormEyebrow;
  const demandFormTitle =
    activeType === 'product'
      ? locale === 'id'
        ? 'Buat Permintaan Produk'
        : 'Create Product Request'
      : activeType === 'property'
        ? locale === 'id'
          ? 'Buat Permintaan Lokasi'
          : 'Create Location Request'
        : activeType === 'service'
          ? locale === 'id'
            ? 'Buat Permintaan Jasa'
            : 'Create Service Request'
          : activeType === 'job'
            ? locale === 'id'
              ? 'Buat Permintaan Talent'
              : 'Create Talent Request'
            : activeType === 'tool_rental'
              ? locale === 'id'
                ? 'Buat Permintaan Sewa Alat'
                : 'Create Tool Rental Request'
              : locale === 'id'
                ? 'Buat Permintaan Baru'
                : 'Create New Request';
  const supplyFormTitle =
    activeType === 'product'
      ? locale === 'id'
        ? 'Tawarkan Produk Baru'
        : 'Add New Product'
      : activeType === 'property'
        ? locale === 'id'
          ? 'Tawarkan Lokasi Baru'
          : 'Add New Space'
        : activeType === 'service'
          ? locale === 'id'
            ? 'Tawarkan Jasa Baru'
            : 'Add New Service'
          : activeType === 'tool_rental'
            ? locale === 'id'
              ? 'Sewakan Alat Baru'
              : 'Add New Tool Rental'
            : activeType === 'business_transfer'
              ? locale === 'id'
                ? 'Tawarkan Oper Usaha'
                : 'Add Business Transfer'
              : activeType === 'company'
                ? locale === 'id'
                  ? 'Tambah Usaha Baru'
                  : 'Add New Business'
                : locale === 'id'
                  ? 'Tambah Listing Baru'
                  : 'Add New Listing';
  const formTitle = workingId
    ? locale === 'id'
      ? 'Edit postingan'
      : 'Edit listing'
    : typePicked && listingSide === 'demand'
      ? demandFormTitle
      : supplyFormTitle;
  const formSubtitle =
    typePicked && listingSide === 'demand'
      ? locale === 'id'
        ? 'Isi inti kebutuhan dulu.'
        : 'Start with the essentials. We will help show it to the right people.'
      : typePicked
        ? locale === 'id'
          ? activeType === 'company'
            ? 'Lengkapi profil usaha agar lebih dipercaya dan mudah ditemukan.'
            : activeType === 'product'
              ? 'Isi nama, harga, stok, dan foto supaya mudah ditemukan.'
              : activeType === 'service'
                ? 'Isi layanan, paket, area, dan portfolio supaya cepat dipahami.'
                : activeType === 'property'
                  ? 'Isi lokasi, alamat, fasilitas, dan foto supaya mudah dicek.'
                  : 'Isi data utama dulu, detail bisa menyusul.'
          : activeType === 'company'
            ? 'Fill the business basics first so people can understand your company quickly.'
            : 'Fill the essentials first. We will help show it to the right people.'
        : locale === 'id'
          ? 'Pilih yang paling pas.'
          : 'Pick the closest option, then fill it step by step.';
  const effectiveFormEyebrow = isNeedServiceJourney
    ? locale === 'id'
      ? 'Cari jasa'
      : 'Need services'
    : formEyebrow;
  const effectiveFormTitle = isNeedServiceJourney
    ? locale === 'id'
      ? 'Ceritakan jasa yang kamu butuhkan'
      : 'Describe the service you need'
    : formTitle;
  const effectiveFormSubtitle = isNeedServiceJourney
    ? locale === 'id'
      ? 'Isi inti dulu biar penyedia cepat paham.'
      : 'Start with the essentials so relevant providers can understand it fast and respond sooner.'
    : formSubtitle;
  const stepCopyByType: Record<
    ListingTypeId,
    {
      step1Title: string;
      step1Description: string;
      step2Title: string;
      step2Description: string;
      step3Title: string;
      step3Description: string;
    }
  > =
    locale === 'id'
      ? {
        product: {
          step1Title: 'Produk',
          step1Description: 'Foto utama, nama, harga, stok, lokasi.',
          step2Title: 'Spesifikasi',
          step2Description: 'Varian, kirim, garansi, aturan order.',
          step3Title: 'Lampiran',
          step3Description: 'Video, catatan, atau dokumen pendukung.',
        },
        service: {
          step1Title: 'Jasa',
          step1Description: 'Foto utama, layanan, harga, lokasi, ringkasan.',
          step2Title: 'Scope',
          step2Description: 'Output, revisi, kebutuhan klien.',
          step3Title: 'Portofolio & lampiran',
          step3Description: 'Contoh kerja, sertifikat, atau dokumen pendukung.',
        },
        job: {
          step1Title: 'Talent',
          step1Description: 'Posisi, lokasi, kompensasi, tipe kerja.',
          step2Title: 'Kriteria',
          step2Description: 'Skill, tugas, benefit, jadwal.',
          step3Title: 'Lampiran',
          step3Description: 'Dokumen atau visual pendukung.',
        },
        property: {
          step1Title: 'Lokasi',
          step1Description: 'Foto utama, nama, harga, alamat, tipe.',
          step2Title: 'Fasilitas',
          step2Description: 'Ukuran, akses, legalitas, aturan.',
          step3Title: 'Dokumen',
          step3Description: 'Dokumen pendukung dan catatan tambahan.',
        },
        tool_rental: {
          step1Title: 'Aset',
          step1Description: 'Foto utama, nama alat, tarif, kondisi, pickup.',
          step2Title: 'Aturan Sewa',
          step2Description: 'Deposit, durasi, batas pakai.',
          step3Title: 'Lampiran',
          step3Description: 'Bukti kondisi, dokumen, atau catatan.',
        },
        business_transfer: {
          step1Title: 'Usaha',
          step1Description: 'Foto utama, nama, harga, omzet, alasan ditawarkan.',
          step2Title: 'Handover',
          step2Description: 'Aset, akun/rating, biaya, risiko.',
          step3Title: 'Bukti',
          step3Description: 'Dokumen, catatan tambahan, dan checklist.',
        },
        company: {
          step1Title: 'Usaha',
          step1Description: 'Logo/sampul dulu, lalu nama, kategori, ringkasan.',
          step2Title: 'Kontak',
          step2Description: 'Telepon, email, alamat, titik lokasi.',
          step3Title: 'Verifikasi',
          step3Description: 'Dokumen legalitas dan catatan publik.',
        },
      }
      : {
        product: {
          step1Title: 'Product Information',
          step1Description:
            'Start with the main photo, then add name, summary, price, stock, and location.',
          step2Title: 'Product Specs',
          step2Description:
            'Add variants, delivery, warranty, and order rules.',
          step3Title: 'Attachments',
          step3Description: 'Add video, notes, or supporting files.',
        },
        service: {
          step1Title: 'Service Information',
          step1Description:
            'Start with the main photo, then add service name, starting price, location, and summary.',
          step2Title: 'Service Details',
          step2Description:
            'Complete scope, deliverables, revisions, and client needs.',
          step3Title: 'Portfolio and Attachments',
          step3Description:
            'Add work samples, certificates, or supporting documents.',
        },
        job: {
          step1Title: 'Talent Information',
          step1Description:
            'Add role, company, location, compensation, and work type.',
          step2Title: 'Criteria and Responsibilities',
          step2Description:
            'Complete required skills, duties, benefits, and schedule.',
          step3Title: 'Supporting Attachments',
          step3Description:
            'Add documents or visuals that help candidates understand the role.',
        },
        property: {
          step1Title: 'Location Information',
          step1Description:
            'Start with the main photo, then add location name, rent, address, and property type.',
          step2Title: 'Facilities and Location Details',
          step2Description:
            'Complete size, facilities, access, legality, and usage rules.',
          step3Title: 'Documents',
          step3Description:
            'Add supporting documents and extra notes if needed.',
        },
        tool_rental: {
          step1Title: 'Asset Information',
          step1Description:
            'Start with the main photo, then add tool name, rental rate, condition, and pickup location.',
          step2Title: 'Rental Rules',
          step2Description:
            'Complete deposit, duration, usage limits, and complaint rules.',
          step3Title: 'Attachments',
          step3Description: 'Add condition proofs, documents, or extra notes.',
        },
        business_transfer: {
          step1Title: 'Business Information',
          step1Description:
            'Start with the main photo, then add business name, price, revenue, and reason for sale.',
          step2Title: 'Handover Details',
          step2Description:
            'Complete assets, accounts/ratings, costs, and risks.',
          step3Title: 'Proof and Documents',
          step3Description: 'Add documents, extra photos, and handover checklist.',
        },
        company: {
          step1Title: 'Business Information',
          step1Description:
            'Start with the logo or cover photo, then add business name, category, and description.',
          step2Title: 'Contact and Location',
          step2Description: 'Add phone, email, full address, and map point.',
          step3Title: 'Business Verification',
          step3Description:
            'Upload legal documents and extra notes to increase trust.',
        },
      };
  const stepCopy =
    stepCopyByType[activeType as ListingTypeId] || stepCopyByType.product;
  const stepOneMainTitle = isNeedServiceJourney
    ? locale === 'id'
      ? 'Apa jasa yang lagi kamu butuhkan?'
      : 'What service are you looking for?'
    : isSimpleModeActive
      ? locale === 'id'
        ? 'Isi cepat'
        : 'Quick fill'
      : stepCopy.step1Title;
  const stepOneMainDescription = isNeedServiceJourney
    ? locale === 'id'
      ? 'Tulis inti kebutuhannya dulu. Biar orang cepat paham tanpa baca terlalu banyak.'
      : 'Write the core need first so people can understand it quickly.'
    : isSimpleModeActive
      ? locale === 'id'
        ? 'Judul, harga, lokasi. Detail bisa nanti.'
        : 'Title, price, location. Details can wait.'
      : stepCopy.step1Description;
  const stepTwoMainTitle = isNeedServiceJourney
    ? locale === 'id'
      ? 'Tambahkan detail kerja kalau perlu'
      : 'Add work details if needed'
    : isSimpleModeActive
      ? locale === 'id'
        ? 'Kalau mau tambah detail'
        : 'Add detail if you want'
      : stepCopy.step2Title;
  const stepTwoMainDescription = isNeedServiceJourney
    ? locale === 'id'
      ? 'Isi kalau mau vendor lebih nyambung.'
      : 'Add more detail if you want more relevant providers.'
    : isSimpleModeActive
      ? locale === 'id'
        ? 'Skip aja kalau belum perlu.'
        : 'Skip if not needed.'
      : stepCopy.step2Description;
  const stepThreeMainTitle = isNeedServiceJourney
    ? locale === 'id'
      ? 'Lampiran pendukung'
      : 'Supporting attachments'
    : stepCopy.step3Title;
  const stepThreeMainDescription = isNeedServiceJourney
    ? locale === 'id'
      ? 'Tambah foto, brief, atau tag kalau perlu.'
      : 'Add photos, a brief, or tags only if they help people understand faster.'
    : stepCopy.step3Description;
  const demandActionTitle =
    activeType === 'property'
      ? locale === 'id'
        ? 'Cari properti'
        : 'Find property'
      : activeType === 'service'
        ? locale === 'id'
          ? 'Cari jasa'
          : 'Find service'
        : activeType === 'job'
          ? locale === 'id'
            ? 'Cari talent'
            : 'Find talent'
          : activeType === 'tool_rental'
            ? locale === 'id'
              ? 'Cari sewa alat'
              : 'Find tool rental'
            : locale === 'id'
              ? 'Cari barang atau supplier'
              : 'Find products or suppliers';
  const supplyActionTitle =
    activeType === 'property'
      ? locale === 'id'
        ? 'Tawarkan lokasi'
        : 'Sell property'
      : activeType === 'service'
        ? locale === 'id'
          ? 'Tawarkan jasa'
          : 'Offer service'
        : activeType === 'job'
          ? locale === 'id'
            ? 'Buka lowongan'
            : 'Open a job post'
          : activeType === 'tool_rental'
            ? locale === 'id'
              ? 'Sewakan alat'
              : 'Rent out tools'
            : locale === 'id'
              ? 'Tawarkan barang atau stok'
              : 'Sell products or stock';
  const selectedTypeLabel = selectedType
    ? getContentTypeName(selectedType, locale)
    : locale === 'id'
      ? 'Listing'
      : 'Listing';
  const sideRailTitle =
    cleanText(fieldValues.title) ||
    selectedTypeLabel ||
    (locale === 'id' ? 'Posting baru' : 'New post');
  const sideRailLocation =
    cleanText(fieldValues.location) ||
    cleanText(fieldValues.address) ||
    (locale === 'id' ? 'Lokasi belum diisi' : 'Location not set');
  const sideRailPriceLabel = parsedPriceCents
    ? new Intl.NumberFormat(locale === 'id' ? 'id-ID' : 'en-US', {
      style: 'currency',
      currency: 'IDR',
      maximumFractionDigits: 0,
    }).format(parsedPriceCents / 100)
    : locale === 'id'
      ? 'Harga belum diisi'
      : 'Price not set';
  const typeSummaryDescription = useMemo(() => {
    if (!typePicked) {
      return locale === 'id'
        ? 'Pilih yang paling deket. Nggak harus persis.'
        : 'Pick the closest option. It does not need to be perfect.';
    }

    return listingSide === 'demand'
      ? locale === 'id'
        ? isNeedServiceJourney
          ? 'Bikin orang cepat paham apa yang kamu cari, budgetnya, dan di area mana.'
          : 'Fokus ke info yang paling ingin dilihat orang dulu.'
        : isNeedServiceJourney
          ? 'Help people understand what you need, the budget, and the area first.'
          : 'Focus on the details people need first.'
      : locale === 'id'
        ? 'Fokus ke info yang paling ingin dilihat orang dulu.'
        : 'Focus on the details people need first.';
  }, [isNeedServiceJourney, listingSide, locale, typePicked]);
  const sharePackInput = useMemo(() => {
    const title = cleanText(fieldValues.title);
    const summary = cleanText(fieldValues.summary);
    const body = cleanText(fieldValues.body);
    const locationLabel =
      cleanText(fieldValues.location) || cleanText(fieldValues.address);
    const firstVisual =
      images[0] ||
      images.find(image => Boolean(image.url || image.preview)) ||
      null;
    const coverImage = normalizeContentMediaUrl(
      firstVisual?.url || firstVisual?.preview || '',
    );
    const siteUrl = (
      process.env.NEXT_PUBLIC_APP_URL || 'https://www.lajukan.com'
    ).replace(/\/+$/, '');
    const listingPath =
      contentStatus === 'active' && workingId
        ? `/${localeCode}${buildContentHref(workingId, title || 'listing')}`
        : '';
    const priceLabel = parsedPriceCents
      ? new Intl.NumberFormat(localeCode === 'id' ? 'id-ID' : 'en-US', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0,
      }).format(parsedPriceCents / 100)
      : '';

    return {
      locale: localeCode,
      title,
      summary,
      body,
      tags: cleanText(fieldValues.tags)
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean),
      priceLabel,
      listingUrl: listingPath ? `${siteUrl}${listingPath}` : '',
      contentId: contentStatus === 'active' ? workingId : null,
      coverImage,
      listingSideLabel: listingSideContextLabel,
      typeLabel: selectedTypeLabel,
      locationLabel,
      connections: socialConnections,
    };
  }, [
    contentStatus,
    fieldValues.address,
    fieldValues.body,
    fieldValues.location,
    fieldValues.summary,
    fieldValues.tags,
    fieldValues.title,
    images,
    listingSideContextLabel,
    localeCode,
    parsedPriceCents,
    selectedTypeLabel,
    socialConnections,
    workingId,
  ]);

  const getMissingRequiredFields = (candidates: SectorField[]): SectorField[] =>
    candidates.filter(
      field =>
        requiredFieldKeys.has(field.key) &&
        cleanText(fieldValues[field.key]).length === 0,
    );

  const formatMissingFieldsMessage = (
    missing: SectorField[],
    scope: 'step' | 'publish',
  ): string => {
    if (
      isSimpleModeActive &&
      missing.length === 1 &&
      missing[0]?.key === 'title'
    ) {
      return locale === 'id'
        ? scope === 'publish'
          ? 'Belum bisa tayang. Isi dulu judul singkatnya ya.'
          : 'Isi dulu judul singkatnya biar bisa lanjut.'
        : scope === 'publish'
          ? 'Unable to publish yet. Add a short title first.'
          : 'Add a short title first so you can continue.';
    }
    const topFields = missing
      .slice(0, 3)
      .map(field => getFieldLabel(field))
      .join(', ');
    const extraCount = missing.length - 3;
    const extraLabel =
      extraCount > 0
        ? locale === 'id'
          ? ` +${extraCount} lainnya`
          : ` +${extraCount} more`
        : '';
    if (scope === 'publish') {
      return locale === 'id'
        ? `Belum bisa tayang. Lengkapi: ${topFields}${extraLabel}.`
        : `Unable to publish yet. Complete required fields: ${topFields}${extraLabel}.`;
    }
    return locale === 'id'
      ? `Lengkapin field wajib di step ini dulu: ${topFields}${extraLabel}.`
      : `Complete required fields in this step: ${topFields}${extraLabel}.`;
  };

  const updateField = (key: string, value: string) => {
    setFieldValues(prev => ({ ...prev, [key]: value }));
  };

  const buildQuickFieldActions = (
    field: SectorField,
    value: string,
  ): QuickFieldAction[] => {
    const normalizedValue = cleanText(value);
    const actions: QuickFieldAction[] = [];

    if (field.kind === 'select' && field.options && field.options.length <= 4) {
      actions.push(
        ...field.options.map(option => ({
          key: `option-${option.value}`,
          label: locale === 'id' ? option.labelId : option.labelEn,
          tone: (normalizedValue === option.value
            ? 'accent'
            : 'muted') as QuickFieldActionTone,
          onClick: () => updateField(field.key, option.value),
        })),
      );
    }

    if (field.kind === 'date') {
      const now = new Date();
      const presets = [
        {
          key: 'today',
          label: locale === 'id' ? 'Hari ini' : 'Today',
          value: formatDateInputValue(now),
        },
        {
          key: 'plus-7',
          label: '+7d',
          value: formatDateInputValue(
            new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
          ),
        },
        {
          key: 'plus-30',
          label: '+30d',
          value: formatDateInputValue(
            new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
          ),
        },
      ];
      actions.push(
        ...presets.map(preset => ({
          key: preset.key,
          label: preset.label,
          tone: (normalizedValue === preset.value
            ? 'accent'
            : 'muted') as QuickFieldActionTone,
          onClick: () => updateField(field.key, preset.value),
        })),
      );
    }

    if (normalizedValue) {
      actions.push({
        key: 'clear',
        label: locale === 'id' ? 'Kosongkan' : 'Clear',
        tone: 'danger',
        onClick: () => updateField(field.key, ''),
      });
    }

    const unique = new Map<string, QuickFieldAction>();
    for (const action of actions) {
      if (!unique.has(action.key)) {
        unique.set(action.key, action);
      }
    }
    const uniqueActions = Array.from(unique.values());
    return Array.from(unique.values()).slice(
      0,
      field.kind === 'select' ? 4 : 1,
    );
  };

  useEffect(() => {
    setWorkingId(draftParam || null);
  }, [draftParam]);

  useEffect(() => {
    if (requestedStep == null) return;
    if (!draftParam && requestedStep > 1) {
      setCurrentStep(1);
      setInfoMessage(
        locale === 'id'
          ? 'Mulai dari step 1 dulu ya biar draft-nya kebikin.'
          : 'Start from step 1 first so the draft can be created.',
      );
      const nextHref = buildCreateHrefFromSearch(searchParams, {
        locale,
        draftId: null,
        step: 1,
        typeId: requestedType || (typePicked ? activeType : ''),
        sideId: requestedSide ?? listingSide,
      });
      const currentHref = searchParams.toString()
        ? `${pathname}?${searchParams.toString()}`
        : pathname;
      if (nextHref !== currentHref) {
        router.replace(nextHref, { scroll: false });
      }
      return;
    }
    setCurrentStep(prev => (prev === requestedStep ? prev : requestedStep));
  }, [
    activeType,
    draftParam,
    listingSide,
    locale,
    router,
    requestedStep,
    requestedSide,
    requestedType,
    pathname,
    searchParams,
    typePicked,
  ]);

  useEffect(() => {
    if (draftParam || !requestedType || typePicked) return;
    setType(requestedType);
    setTypePicked(true);
    setListingSide(requestedSide ?? getDefaultListingSide(requestedType));
    if (!supportsSimpleListingMode(requestedType)) {
      setListingMode('detail');
    }
    if (requestedType === 'property') {
      setSector('realestate');
      setSubSector('');
    } else if (!supportsSectorClassification(requestedType)) {
      setSector('');
      setSubSector('');
    }
  }, [draftParam, requestedSide, requestedType, typePicked]);

  useEffect(() => {
    if (!typePicked) return;
    if (!supportsDemandListing(activeType)) {
      setListingSide('supply');
      return;
    }
    if (!isListingSideEditable(activeType)) {
      setListingSide(getDefaultListingSide(activeType));
    }
  }, [activeType, typePicked]);

  useEffect(() => {
    if (!typePicked) return;
    if (!supportsSimpleListingMode(activeType) && listingMode !== 'detail') {
      setListingMode('detail');
    }
  }, [activeType, listingMode, typePicked]);

  useEffect(() => {
    if (!promotionEnabled) return;
    setFieldValues(prev => {
      const next = { ...prev };
      let changed = false;
      const applyDefault = (key: string, value: string) => {
        if (cleanText(next[key])) return;
        next[key] = value;
        changed = true;
      };

      applyDefault(
        'promo_platform_fee_percent',
        String(DEFAULT_PROMOTION_PLATFORM_FEE_PERCENT),
      );
      applyDefault('promo_tax_percent', String(DEFAULT_PROMOTION_TAX_PERCENT));
      applyDefault(
        'promo_opex_percent',
        String(DEFAULT_PROMOTION_OPEX_PERCENT),
      );
      applyDefault('promo_budget_type', 'total');
      applyDefault(
        'promo_objective',
        activeType === 'product'
          ? 'sale'
          : activeType === 'job'
            ? 'lead'
            : activeType === 'tool_rental'
              ? 'sale'
              : 'awareness',
      );
      applyDefault(
        'promo_cta',
        activeType === 'property'
          ? 'book_visit'
          : activeType === 'job'
            ? 'apply_now'
            : activeType === 'product'
              ? 'buy_now'
              : activeType === 'company'
                ? 'contact_us'
                : 'chat_now',
      );

      return changed ? next : prev;
    });
  }, [activeType, promotionEnabled]);

  useEffect(() => {
    if (authLoading) return;
    if (!draftParam) {
      setLoadingInitial(false);
      return;
    }

    let cancelled = false;

    const loadDraft = async () => {
      setLoadingInitial(true);
      setErrorMessage('');
      setInfoMessage('');
      try {
        const res = await fetch(`/api/content/${draftParam}`, {
          cache: 'no-store',
        });
        const data = (await res.json().catch(() => ({}))) as ContentItem & {
          error?: string;
        };
        if (!res.ok) {
          throw new Error(
            data.error ||
            (locale === 'id' ? 'Draft tidak ditemukan' : 'Draft not found'),
          );
        }
        if (user?.id && data.owner_id && data.owner_id !== user.id) {
          throw new Error(
            locale === 'id'
              ? 'Anda tidak punya akses ke draft ini'
              : 'You do not have access to this draft',
          );
        }
        if (cancelled) return;

        const meta = (
          data.metadata && typeof data.metadata === 'object'
            ? data.metadata
            : {}
        ) as Record<string, unknown>;
        const loadedSide = resolveListingSide({
          type: cleanText(data.type) || cleanText(data.content_type),
          metadata: meta,
          title: data.title,
          summary: data.summary,
        });
        setListingSide(loadedSide);
        const nextValues: Record<string, string> = {};
        if (cleanText(data.title)) nextValues.title = cleanText(data.title);
        if (cleanText(data.summary))
          nextValues.summary = cleanText(data.summary);
        if (cleanText(data.body)) nextValues.body = cleanText(data.body);
        if (
          Number.isFinite(data.price_cents as number) &&
          (data.price_cents as number) > 0
        ) {
          nextValues.price_cents = String(
            Math.floor((data.price_cents as number) / 100),
          );
        }
        if (Array.isArray(data.tags) && data.tags.length > 0) {
          nextValues.tags = data.tags.join(', ');
        }
        Object.entries(meta).forEach(([key, value]) => {
          if (typeof value === 'string' || typeof value === 'number') {
            nextValues[key] = String(value);
          }
        });
        const loadedPriceUnit =
          normalizePriceUnit(data.price_unit) ||
          normalizePriceUnit(meta.price_unit) ||
          normalizePriceUnit(meta.unit) ||
          normalizePriceUnit(meta.price_basis) ||
          normalizePriceUnit(meta.rate_type) ||
          normalizePriceUnit(meta.rental_rate_type) ||
          normalizePriceUnit(meta.rental_period) ||
          normalizePriceUnit(meta.lease_term) ||
          normalizePriceUnit(meta.compensation_period);
        if (loadedPriceUnit) nextValues.price_unit = loadedPriceUnit;
        const promotionMetaRaw = meta.promotion;
        if (promotionMetaRaw && typeof promotionMetaRaw === 'object') {
          const promotionMeta = promotionMetaRaw as Record<string, unknown>;
          const enabledValue = String(
            promotionMeta.enabled ?? '',
          ).toLowerCase();
          setPromotionEnabled(
            enabledValue === 'true' ||
            enabledValue === '1' ||
            enabledValue === 'yes',
          );
          Object.entries(promotionMeta).forEach(([key, value]) => {
            if (key === 'enabled') return;
            if (typeof value === 'string' || typeof value === 'number') {
              nextValues[key] = String(value);
            }
          });
        } else {
          setPromotionEnabled(false);
        }

        const imageUrls: string[] = [];
        if (cleanText(data.cover_image)) {
          imageUrls.push(normalizeContentMediaUrl(cleanText(data.cover_image)));
        }
        imageUrls.push(...extractListingMediaUrls(meta));

        const stepFromMeta =
          typeof (
            meta.listing_progress as { current_step?: unknown } | undefined
          )?.current_step === 'number'
            ? Number(
              (meta.listing_progress as { current_step?: unknown })
                .current_step,
            )
            : 1;

        const loadedTypeRaw = (
          cleanText(data.type) ||
          cleanText(data.content_type) ||
          'product'
        ).toLowerCase();
        const loadedType = CONTENT_TYPES.some(ct => ct.id === loadedTypeRaw)
          ? loadedTypeRaw
          : 'product';
        const savedMode = cleanText(meta.listing_mode).toLowerCase();
        const resolvedMode =
          savedMode === 'simple' || savedMode === 'detail'
            ? (savedMode as 'simple' | 'detail')
            : 'detail';
        setTypePicked(true);
        setType(loadedType);
        setListingMode(
          supportsSimpleListingMode(loadedType) ? resolvedMode : 'detail',
        );
        if (loadedType === 'property') {
          setSector('realestate');
          setSubSector('');
        } else if (supportsSectorClassification(loadedType)) {
          setSector(cleanText(meta.sector));
          setSubSector(cleanText(meta.sub_sector));
        } else {
          setSector('');
          setSubSector('');
        }
        setFieldValues(nextValues);
        setImages(
          [...new Set(imageUrls)].map(url => ({
            id: makeUploadDraftId('image'),
            preview: url,
            url,
            persisted: true,
          })),
        );
        setDocuments(parseDocuments(meta.documents));
        setMetadataBase(meta);
        const nextLoadedStep =
          requestedStep ?? clampStep(Math.floor(stepFromMeta));
        setCurrentStep(nextLoadedStep);
        const nextHref = buildCreateHrefFromSearch(searchParams, {
          locale,
          draftId: data.id || draftParam,
          step: nextLoadedStep,
          typeId: loadedType,
          sideId: loadedSide,
        });
        const currentHref = searchParams.toString()
          ? `${pathname}?${searchParams.toString()}`
          : pathname;
        if (nextHref !== currentHref) {
          router.replace(nextHref, { scroll: false });
        }
        setContentStatus(
          cleanText(data.content_status || data.status).toLowerCase() ===
            'active'
            ? 'active'
            : 'draft',
        );
        setWorkingId(data.id || draftParam);
        setInfoMessage(
          locale === 'id'
            ? 'Draft berhasil dimuat. Lanjutkan dari step terakhir.'
            : 'Draft loaded. Continue from latest step.',
        );
      } catch (error) {
        if (!cancelled) {
          setWorkingId(null);
          setType('');
          setTypePicked(false);
          setErrorMessage(
            error instanceof Error
              ? error.message
              : locale === 'id'
                ? 'Gagal memuat draft'
                : 'Failed to load draft',
          );
        }
      } finally {
        if (!cancelled) setLoadingInitial(false);
      }
    };

    loadDraft();
    return () => {
      cancelled = true;
    };
  }, [
    authLoading,
    draftParam,
    locale,
    pathname,
    requestedStep,
    router,
    searchParams,
    user?.id,
  ]);

  const uploadPendingImages = async (): Promise<string[]> => {
    const pendingIndexes: number[] = [];
    const pendingFiles: File[] = [];
    images.forEach((img, idx) => {
      if (img.file && !img.url) {
        pendingIndexes.push(idx);
        pendingFiles.push(img.file);
      }
    });

    if (pendingIndexes.length === 0) {
      return collectImageUrls(images);
    }

    setUploadingImages(true);
    try {
      const optimizedFiles = await prepareUploadFiles(pendingFiles);
      const formData = new FormData();
      optimizedFiles.forEach(file => formData.append('images', file));

      setImages(prev =>
        prev.map((img, idx) =>
          pendingIndexes.includes(idx)
            ? { ...img, uploading: true, error: undefined }
            : img,
        ),
      );

      const uploadRes = await authFetch('/api/content/upload-images', {
        method: 'POST',
        body: formData,
      });
      const uploadData = (await uploadRes.json().catch(() => ({}))) as {
        urls?: string[];
        error?: string;
      };
      if (!uploadRes.ok) {
        throw new Error(
          uploadData.error ||
            (locale === 'id' ? 'Gagal upload gambar' : 'Failed to upload images'),
        );
      }

      const uploadedUrls = extractUploadedContentImageUrls(uploadData);

      const next = [...images];
      pendingIndexes.forEach((idx, order) => {
        const nextUrl = uploadedUrls[order];
        const previousPreview = next[idx]?.preview;
        next[idx] = {
          ...next[idx],
          uploading: false,
          preview: nextUrl || next[idx].preview,
          url: nextUrl || next[idx].url,
          persisted: Boolean(nextUrl || next[idx].persisted),
          error: nextUrl
            ? undefined
            : locale === 'id'
              ? 'Gagal upload'
              : 'Upload failed',
        };
        if (nextUrl && previousPreview !== nextUrl) {
          revokePreviewUrl(previousPreview);
        }
      });
      setImages(next);
      if (uploadedUrls.length < pendingIndexes.length) {
        throw new Error(
          locale === 'id'
            ? 'Sebagian gambar gagal diupload. Cek format (JPG/PNG/WEBP/GIF) dan ukuran file.'
            : 'Some images failed to upload. Check file type (JPG/PNG/WEBP/GIF) and size.',
        );
      }
      return collectImageUrls(next);
    } finally {
      setUploadingImages(false);
    }
  };

  const uploadPendingDocuments = async (): Promise<
    Array<{ name: string; url: string; size?: number; mime?: string }>
  > => {
    const pendingIndexes: number[] = [];
    const formData = new FormData();
    documents.forEach((doc, idx) => {
      if (doc.file && !doc.url) {
        pendingIndexes.push(idx);
        formData.append('files', doc.file);
      }
    });
    if (pendingIndexes.length === 0) {
      return documents
        .filter((doc): doc is DocumentFile & { url: string } =>
          Boolean(cleanText(doc.url)),
        )
        .map(doc => ({
          name: doc.name,
          url: normalizeContentMediaUrl(cleanText(doc.url)),
          size: doc.size,
          mime: doc.mime,
        }));
    }

    setUploadingDocs(true);
    setDocuments(prev =>
      prev.map((doc, idx) =>
        pendingIndexes.includes(idx)
          ? { ...doc, uploading: true, error: undefined }
          : doc,
      ),
    );

    const uploadRes = await authFetch('/api/content/upload-files', {
      method: 'POST',
      body: formData,
    });
    const uploadData = (await uploadRes.json().catch(() => ({}))) as {
      files?: Array<{
        name?: string;
        url?: string;
        size?: number;
        mime?: string;
      }>;
      urls?: string[];
      error?: string;
    };
    if (!uploadRes.ok) {
      throw new Error(
        uploadData.error ||
        (locale === 'id' ? 'Gagal upload dokumen' : 'Failed to upload files'),
      );
    }

    const returnedFiles = extractUploadedContentDocumentFiles(uploadData);

    const next = [...documents];
    pendingIndexes.forEach((idx, order) => {
      const entry = returnedFiles[order];
      const nextUrl = normalizeContentMediaUrl(cleanText(entry?.url));
      next[idx] = {
        ...next[idx],
        uploading: false,
        url: nextUrl || next[idx].url,
        name: cleanText(entry?.name) || next[idx].name,
        size: typeof entry?.size === 'number' ? entry.size : next[idx].size,
        mime: cleanText(entry?.mime) || next[idx].mime,
        error: nextUrl
          ? undefined
          : locale === 'id'
            ? 'Gagal upload'
            : 'Upload failed',
      };
    });
    setDocuments(next);

    return next
      .filter((doc): doc is DocumentFile & { url: string } =>
        Boolean(cleanText(doc.url)),
      )
      .map(doc => ({
        name: doc.name,
        url: normalizeContentMediaUrl(cleanText(doc.url)),
        size: doc.size,
        mime: doc.mime,
      }));
  };

  const handleAddImages = async (files: File[]) => {
    if (files.length === 0) return;

    setErrorMessage('');
    setUploadingImages(true);
    let pendingIds = new Set<string>();
    try {
      const optimizedFiles = await prepareUploadFiles(files);

      const pendingImages: ImageFile[] = optimizedFiles.map(file => ({
        id: makeUploadDraftId('image'),
        file,
        preview: URL.createObjectURL(file),
        uploading: true,
      }));
      pendingIds = new Set(
        pendingImages
          .map(image => image.id)
          .filter((id): id is string => Boolean(id)),
      );

      setImages(prev => [...prev, ...pendingImages]);

      const formData = new FormData();
      optimizedFiles.forEach(file => formData.append('images', file));

      const uploadRes = await authFetch('/api/content/upload-images', {
        method: 'POST',
        body: formData,
      });
      const uploadData = (await uploadRes.json().catch(() => ({}))) as {
        urls?: string[];
        error?: string;
      };

      if (!uploadRes.ok) {
        throw new Error(
          uploadData.error ||
            (locale === 'id' ? 'Gagal upload gambar' : 'Failed to upload images'),
        );
      }

      const uploadedUrls = extractUploadedContentImageUrls(uploadData);
      const partialFailure = uploadedUrls.length < pendingImages.length;

      setImages(prev =>
        prev.map(image => {
          const imageId = image.id;
          if (!imageId || !pendingIds.has(imageId)) return image;
          const order = pendingImages.findIndex(
            pendingImage => pendingImage.id === imageId,
          );
          const nextUrl = uploadedUrls[order];
          if (!nextUrl) {
            return {
              ...image,
              uploading: false,
              error: locale === 'id' ? 'Gagal upload' : 'Upload failed',
            };
          }
          revokePreviewUrl(image.preview);
          return {
            ...image,
            uploading: false,
            preview: nextUrl,
            url: nextUrl,
            persisted: true,
            error: undefined,
          };
        }),
      );

      if (partialFailure) {
        setErrorMessage(
          locale === 'id'
            ? 'Sebagian gambar gagal diupload. Coba ulangi file yang bermasalah.'
            : 'Some images failed to upload. Retry the affected files.',
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : locale === 'id'
            ? 'Gagal upload gambar'
            : 'Failed to upload images';

      setImages(prev =>
        prev.map(image =>
          image.id && pendingIds.has(image.id)
            ? {
                ...image,
                uploading: false,
                error: message,
              }
            : image,
        ),
      );
      setErrorMessage(message);
    } finally {
      setUploadingImages(false);
    }
  };

  const saveListing = async (
    status: 'draft' | 'active',
    options?: {
      persistStep?: number;
      silentSuccess?: boolean;
      successMessage?: string;
      redirectOnSuccess?: boolean;
    },
  ): Promise<string | null> => {
    const persistStep = clampStep(options?.persistStep ?? currentStep);
    if (!typePicked) {
      setErrorMessage(
        locale === 'id'
          ? 'Pilih tipe listing dulu ya baru simpan.'
          : 'Select a listing type before saving.',
      );
      goToStep(1, { draftId: workingId, typeId: activeType });
      return null;
    }
    const title = fieldValues.title?.trim() || '';
    if (!title) {
      setErrorMessage(
        locale === 'id' ? 'Judulnya belum diisi' : 'Title is required',
      );
      goToStep(1, { draftId: workingId, typeId: activeType });
      return null;
    }
    if (status === 'active') {
      if (hasForeignBrandSignalForSupply) {
        goToStep(1, { draftId: workingId, typeId: activeType });
        setErrorMessage(
          locale === 'id'
            ? `Listing mengarah ke brand luar: ${foreignBrandSignalSummary}. Revisi dulu.`
            : `This listing points to foreign brands such as ${foreignBrandSignalSummary}. Lajukan is prioritized for local Indonesian brands and businesses, so revise it before publishing.`,
        );
        return null;
      }
      const missingRequired = getMissingRequiredFields(requiredFields);
      if (missingRequired.length > 0) {
        const hasStep1Gap = missingRequired.some(field =>
          step1FieldKeys.has(field.key),
        );
        goToStep(hasStep1Gap ? 1 : 2, {
          draftId: workingId,
          typeId: activeType,
        });
        setErrorMessage(formatMissingFieldsMessage(missingRequired, 'publish'));
        return null;
      }
      if (promotionEnabled) {
        const missingPromotion = getMissingRequiredFields(
          promotionRequiredFields,
        );
        if (missingPromotion.length > 0) {
          goToStep(4, { draftId: workingId, typeId: activeType });
          setErrorMessage(
            formatMissingFieldsMessage(missingPromotion, 'publish'),
          );
          return null;
        }
        const startDate = cleanText(fieldValues.promo_start_date);
        const endDate = cleanText(fieldValues.promo_end_date);
        if (
          startDate &&
          endDate &&
          new Date(endDate).getTime() < new Date(startDate).getTime()
        ) {
          goToStep(4, { draftId: workingId, typeId: activeType });
          setErrorMessage(
            locale === 'id'
              ? 'Tanggal selesai promonya harus lewat dari tanggal mulai.'
              : 'Promotion end date must be after start date.',
          );
          return null;
        }
        if (promotionNeedsPriceAnchor) {
          goToStep(4, { draftId: workingId, typeId: activeType });
          setErrorMessage(
            locale === 'id'
              ? 'Isi harga listing dulu biar benefit discount, loyalty, atau raffle-nya bisa dicek aman atau nggaknya.'
              : 'Add the listing price so discount, loyalty, or raffle safety can be validated.',
          );
          return null;
        }
        if (promotionGuardrailUnsafe) {
          goToStep(4, { draftId: workingId, typeId: activeType });
          setErrorMessage(
            promotionSnapshot?.financialMessage ||
            (locale === 'id'
              ? 'Benefit promonya kebesaran buat buffer margin yang ada.'
              : 'The promotion benefit is too large for the available margin buffer.'),
          );
          return null;
        }
      }
    }

    setLoading(true);
    setInfoMessage('');
    setErrorMessage('');
    setUploadingImages(false);
    setUploadingDocs(false);

    try {
      const uploadedImageUrls = showImages ? await uploadPendingImages() : [];
      const uploadedDocuments = await uploadPendingDocuments();

      const priceStr = fieldValues.price_cents || fieldValues.price || '';
      const priceCents = priceStr.trim()
        ? parseInt(String(priceStr).replace(/\D/g, ''), 10) * 100
        : undefined;
      const summaryValue = cleanText(fieldValues.summary);
      const bodyValue = cleanText(fieldValues.body);
      const fallbackCopy =
        isSimpleModeActive && (!summaryValue || !bodyValue)
          ? buildSimpleModeFallbackCopy({
            title,
            locale,
            listingSide,
            price: priceStr,
            location: fieldValues.location,
          })
          : null;
      const resolvedSummary = summaryValue || fallbackCopy?.summary;
      const resolvedBody = bodyValue || fallbackCopy?.body;
      if (fallbackCopy && (!summaryValue || !bodyValue)) {
        setFieldValues(prev => ({
          ...prev,
          ...(summaryValue ? {} : { summary: fallbackCopy.summary }),
          ...(bodyValue ? {} : { body: fallbackCopy.body }),
        }));
      }

      const tagsStr = fieldValues.tags || '';
      const tagsArray = tagsStr
        .split(/[,\n]/)
        .map(t => t.trim())
        .filter(Boolean);

      const coverImage = uploadedImageUrls[0] || undefined;
      const requiresPrimaryImage =
        status === 'active' && requiresPrimaryImageForType(activeType);
      if (requiresPrimaryImage && !coverImage) {
        throw new Error(
          locale === 'id'
            ? activeType === 'tool_rental'
              ? 'Listing sewa alat wajib punya minimal 1 foto aset dulu sebelum tayang.'
              : 'Listing properti/produk wajib punya minimal 1 foto dulu sebelum tayang.'
            : activeType === 'tool_rental'
              ? 'Tool-rental listing requires at least 1 asset image before publishing.'
              : 'Property/product listing requires at least 1 image before publishing.',
        );
      }
      const metadata: Record<string, unknown> = { ...metadataBase };
      metadata.market_side = toMarketSideValue(listingSide);
      const normalizedSector = activeTypeIsProperty
        ? 'realestate'
        : activeTypeSupportsSector
          ? sector.trim()
          : '';
      if (normalizedSector) metadata.sector = normalizedSector;
      else delete metadata.sector;
      if (activeTypeIsProperty) {
        delete metadata.sub_sector;
      } else if (!activeTypeSupportsSector) {
        delete metadata.sub_sector;
      } else if (subSector.trim()) {
        metadata.sub_sector = subSector.trim();
      } else {
        delete metadata.sub_sector;
      }
      if (fieldValues.location?.trim())
        metadata.location = fieldValues.location.trim();
      else delete metadata.location;
      const priceUnit = normalizePriceUnit(fieldValues.price_unit);
      if (priceUnit) {
        metadata.price_unit = priceUnit;
        metadata.unit = priceUnit;
      } else {
        delete metadata.price_unit;
        delete metadata.unit;
      }

      for (const f of effectiveFields) {
        if (
          [
            'title',
            'summary',
            'body',
            'price_cents',
            'price_unit',
            'tags',
            'images',
          ].includes(f.key)
        )
          continue;
        const v = fieldValues[f.key];
        if (v == null || v === '') {
          delete metadata[f.key];
          continue;
        }
        if (f.kind === 'number') metadata[f.key] = Number(v) || v;
        else metadata[f.key] = v;
      }
      for (const key of ALL_PROMOTION_KEYS) {
        delete metadata[key];
      }
      if (promotionEnabled) {
        const promotion: Record<string, unknown> = {
          enabled: true,
          listing_type: activeType,
          updated_at: new Date().toISOString(),
        };
        for (const field of promotionFields) {
          const rawValue = cleanText(fieldValues[field.key]);
          if (!rawValue) continue;
          if (field.kind === 'number') {
            promotion[field.key] = Number(rawValue) || rawValue;
            continue;
          }
          if (field.kind === 'currency') {
            const normalized = parseInt(rawValue.replace(/\D/g, ''), 10);
            promotion[field.key] = Number.isFinite(normalized)
              ? normalized
              : rawValue;
            continue;
          }
          promotion[field.key] = rawValue;
        }
        const calculatedPromotionSnapshot = createPromotionSnapshot(
          promotion,
          priceCents,
          localeCode,
        );
        if (
          calculatedPromotionSnapshot &&
          isPrimaryPromotionOfferType(promotion.promo_offer_type)
        ) {
          promotion.promo_offer_value =
            calculatedPromotionSnapshot.benefitLabel;
          promotion.guardrail_status = calculatedPromotionSnapshot.status;
          promotion.guardrail_message =
            calculatedPromotionSnapshot.financialMessage;
          if (calculatedPromotionSnapshot.estimatedBenefitCents) {
            promotion.guardrail_estimated_benefit_cents =
              calculatedPromotionSnapshot.estimatedBenefitCents;
          }
          if (calculatedPromotionSnapshot.safeCapCents) {
            promotion.guardrail_safe_cap_cents =
              calculatedPromotionSnapshot.safeCapCents;
          }
          if (calculatedPromotionSnapshot.bufferPercent) {
            promotion.guardrail_buffer_percent =
              calculatedPromotionSnapshot.bufferPercent;
          }
          promotion.guardrail_reserve_percent =
            calculatedPromotionSnapshot.reservePercent;
        }
        metadata.promotion = promotion;
      } else {
        delete metadata.promotion;
      }
      if (uploadedImageUrls.length > 0) {
        metadata.images = uploadedImageUrls;
        metadata.image_urls = uploadedImageUrls;
        metadata.gallery_images = uploadedImageUrls;
      } else {
        delete metadata.images;
        delete metadata.image_urls;
        delete metadata.gallery_images;
      }
      if (coverImage) metadata.cover_image = coverImage;
      else delete metadata.cover_image;
      if (uploadedDocuments.length > 0) metadata.documents = uploadedDocuments;
      else delete metadata.documents;
      metadata.listing_mode = listingMode;
      const coreCompletion = requiredDone / Math.max(requiredFields.length, 1);
      const mediaCompletion = uploadedImageUrls.length > 0 ? 0.1 : 0;
      const promotionCompletion = promotionEnabled
        ? (promotionRequiredDone /
          Math.max(promotionRequiredFields.length, 1)) *
        0.2
        : 0;
      metadata.listing_progress = {
        current_step: persistStep,
        total_steps: TOTAL_STEPS,
        completion_percent: Math.min(
          100,
          Math.round(
            (coreCompletion * 0.7 + mediaCompletion + promotionCompletion) *
            100,
          ),
        ),
        updated_at: new Date().toISOString(),
      };
      metadata.listing_form_version = 4;

      const derivedPromotionFields = promotionEnabled
        ? derivePromotionTopLevelFields({
          promotionLike: metadata.promotion,
          priceCents,
          locale: localeCode,
        })
        : {};

      const endpoint = workingId
        ? `/api/content/${workingId}`
        : '/api/content/create';
      const method = workingId ? 'PUT' : 'POST';
      const requestPayload = compactSubmissionValue({
        content_type: activeType,
        title,
        summary: resolvedSummary || undefined,
        body: resolvedBody || undefined,
        price_cents: priceCents,
        price_unit: priceUnit || undefined,
        original_price_cents: derivedPromotionFields.originalPriceCents,
        promo_label: derivedPromotionFields.promoLabel,
        promo_start_at: derivedPromotionFields.promoStartAt,
        promo_end_at: derivedPromotionFields.promoEndAt,
        cover_image: coverImage,
        tags: tagsArray.length > 0 ? tagsArray : undefined,
        content_status: status,
        metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
      }) as Record<string, unknown>;
      const localValidation = validateListingPayload(requestPayload, {
        mode: workingId ? 'update' : 'create',
        strictActiveValidation: status === 'active',
      });
      if (!localValidation.ok) {
        throw new Error(
          formatListingIssuesForUi(localValidation.issues, locale),
        );
      }

      const res = await authFetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(localValidation.payload),
      });

      const data = (await res.json().catch(() => ({}))) as ContentItem & {
        error?: string;
        issues?: string[];
      };

      if (res.ok) {
        setContentStatus(status);
        const savedId = data.id || workingId || null;
        setWorkingId(savedId);
        setMetadataBase((data.metadata as Record<string, unknown>) || metadata);
        if (status === 'active' && savedId) {
          setInfoMessage(
            options?.successMessage ||
            (locale === 'id'
              ? 'Listing sudah aktif. Share Pack dan channel distribusi siap dipakai.'
              : 'The listing is now active. Share Pack and distribution channels are ready.'),
          );
          if (options?.redirectOnSuccess) {
            router.push(
              buildContentHref(
                data.id || savedId,
                data.title || title || 'listing',
                data.slug,
              ),
            );
            return savedId;
          }
        }
        goToStep(persistStep, {
          draftId: savedId,
          typeId: activeType,
          sideId: listingSide,
        });
        if (!options?.silentSuccess) {
          if (status !== 'active') {
            setInfoMessage(
              options?.successMessage ||
              (locale === 'id'
                ? 'Draft berhasil disimpan. Bisa dilanjutkan kapan saja.'
                : 'Draft saved successfully. You can continue anytime.'),
            );
          }
        }
        return savedId;
      } else {
        const issuesMessage =
          Array.isArray(data.issues) && data.issues.length > 0
            ? formatListingIssuesForUi(data.issues, locale)
            : undefined;
        throw new Error(
          issuesMessage ||
          data.error ||
          (locale === 'id'
            ? 'Gagal menyimpan postingan'
            : 'Failed to save posting'),
        );
      }
    } catch (error) {
      console.error(error);
      setErrorMessage(
        error instanceof Error
          ? error.message
          : locale === 'id'
            ? 'Terjadi kesalahan'
            : 'Error creating posting',
      );
      return null;
    } finally {
      setLoading(false);
      setUploadingImages(false);
      setUploadingDocs(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!typePicked) {
      setErrorMessage(
        locale === 'id'
          ? 'Pilih tipe listing dulu.'
          : 'Select a listing type first.',
      );
      return;
    }
    const needsPrimaryImage = requiresPrimaryImageForType(activeType);
    if (currentStep < TOTAL_STEPS) {
      if (currentStep === 1 || currentStep === 2) {
        const currentStepFields = currentStep === 1 ? step1Fields : step2Fields;
        const missingRequired = getMissingRequiredFields(currentStepFields);
        if (missingRequired.length > 0) {
          setErrorMessage(formatMissingFieldsMessage(missingRequired, 'step'));
          return;
        }
      }
      if (currentStep === 3 && needsPrimaryImage && images.length === 0) {
        setErrorMessage(
          locale === 'id'
            ? activeType === 'tool_rental'
              ? 'Tambahin minimal 1 foto aset dulu sebelum lanjut ke promo.'
              : 'Tambahin minimal 1 foto dulu sebelum lanjut ke promo.'
            : activeType === 'tool_rental'
              ? 'Add at least 1 asset image before moving to promotion.'
              : 'Add at least 1 image before moving to promotion step.',
        );
        return;
      }
      setErrorMessage('');
      const nextStep = clampStep(currentStep + 1);
      const savedId = await saveListing('draft', {
        persistStep: nextStep,
        silentSuccess: true,
      });
      if (savedId) {
        setInfoMessage(
          locale === 'id'
            ? `Bagian ini tersimpan. Lanjut ke ${stepLabels[nextStep - 1].toLowerCase()}.`
            : `This part is saved. Continue to ${stepLabels[nextStep - 1].toLowerCase()}.`,
        );
      }
      return;
    }
    await saveListing('active', {
      persistStep: TOTAL_STEPS,
      redirectOnSuccess: true,
    });
  };

  const handleAddDocuments = async (files: FileList | null) => {
    if (!files) return;
    const remain = Math.max(0, DOC_MAX_FILES - documents.length);
    const picks = Array.from(files).slice(0, remain);
    const accepted: DocumentFile[] = [];
    const rejected: string[] = [];
    for (const file of picks) {
      if (file.size > DOC_MAX_BYTES) {
        rejected.push(
          `${file.name} (${locale === 'id' ? 'terlalu besar' : 'too large'})`,
        );
        continue;
      }
      if (!isAllowedDocument(file)) {
        rejected.push(
          `${file.name} (${locale === 'id' ? 'format tidak didukung' : 'unsupported format'})`,
        );
        continue;
      }
      accepted.push({
        id: makeUploadDraftId('doc'),
        name: file.name,
        file,
        size: file.size,
        mime: file.type || undefined,
        uploading: true,
      });
    }
    if (accepted.length === 0) {
      if (rejected.length > 0) setErrorMessage(rejected.join(', '));
      return;
    }

    setErrorMessage(rejected.length > 0 ? rejected.join(', ') : '');
    setDocuments(prev => [...prev, ...accepted]);
    setUploadingDocs(true);

    try {
      const formData = new FormData();
      accepted.forEach(doc => {
        if (doc.file) formData.append('files', doc.file);
      });

      const uploadRes = await authFetch('/api/content/upload-files', {
        method: 'POST',
        body: formData,
      });
      const uploadData = (await uploadRes.json().catch(() => ({}))) as {
        files?: Array<{
          name?: string;
          url?: string;
          size?: number;
          mime?: string;
        }>;
        urls?: string[];
        error?: string;
      };

      if (!uploadRes.ok) {
        throw new Error(
          uploadData.error ||
          (locale === 'id'
            ? 'Gagal upload dokumen'
            : 'Failed to upload files'),
        );
      }

      const uploadedDocs = extractUploadedContentDocumentFiles(uploadData);
      const pendingIds = new Set(accepted.map(doc => doc.id));
      const partialFailure = uploadedDocs.length < accepted.length;

      setDocuments(prev =>
        prev.map(doc => {
          if (!pendingIds.has(doc.id)) return doc;
          const order = accepted.findIndex(
            acceptedDoc => acceptedDoc.id === doc.id,
          );
          const uploadedDoc = uploadedDocs[order];
          const nextUrl = normalizeContentMediaUrl(cleanText(uploadedDoc?.url));
          if (!nextUrl) {
            return {
              ...doc,
              uploading: false,
              error: locale === 'id' ? 'Gagal upload' : 'Upload failed',
            };
          }
          return {
            ...doc,
            uploading: false,
            url: nextUrl,
            name: cleanText(uploadedDoc?.name) || doc.name,
            size:
              typeof uploadedDoc?.size === 'number'
                ? uploadedDoc.size
                : doc.size,
            mime: cleanText(uploadedDoc?.mime) || doc.mime,
            error: undefined,
          };
        }),
      );

      if (partialFailure) {
        setErrorMessage(current =>
          [
            current,
            locale === 'id'
              ? 'Sebagian dokumen gagal diupload.'
              : 'Some documents failed to upload.',
          ]
            .filter(Boolean)
            .join(', '),
        );
      }
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : locale === 'id'
            ? 'Gagal upload dokumen'
            : 'Failed to upload files';

      const pendingIds = new Set(accepted.map(doc => doc.id));
      setDocuments(prev =>
        prev.map(doc =>
          pendingIds.has(doc.id)
            ? {
              ...doc,
              uploading: false,
              error: message,
            }
            : doc,
        ),
      );
      setErrorMessage(current => [current, message].filter(Boolean).join(', '));
    } finally {
      setUploadingDocs(false);
    }
  };

  const resolveFieldMeta = (f: SectorField) => {
    const override = FIELD_OVERRIDES[activeType]?.[f.key];
    const sideOverride =
      listingSide === 'demand'
        ? DEMAND_FIELD_OVERRIDES[activeType]?.[f.key]
        : undefined;
    const label =
      locale === 'id'
        ? sideOverride?.labelId || override?.labelId || f.labelId
        : sideOverride?.labelEn || override?.labelEn || f.labelEn;
    const placeholder =
      locale === 'id'
        ? sideOverride?.placeholderId ||
        override?.placeholderId ||
        f.placeholderId
        : sideOverride?.placeholderEn ||
        override?.placeholderEn ||
        f.placeholderEn;
    const hint =
      locale === 'id'
        ? sideOverride?.hintId || override?.hintId || f.hintId
        : sideOverride?.hintEn || override?.hintEn || f.hintEn;
    return {
      label,
      placeholder,
      hint: hint || getFieldHelperHint(f.key, locale, listingSide),
    };
  };

  const renderField = (f: SectorField) => {
    const value = fieldValues[f.key] ?? '';
    const { label, placeholder } = resolveFieldMeta(f);
    const example = getFieldExample(
      f.key,
      locale,
      activeType as ListingTypeId,
      listingSide,
    );
    const inputPlaceholder = placeholder || example || '';
    const fieldIsFilled = cleanText(value).length > 0;
    const baseInput = cn(
      'ui-data-control h-10 px-3 text-[13px] font-semibold min-[360px]:text-[14px]',
      'placeholder:text-[color:var(--app-text-soft)]',
    );
    const textAreaInput = cn(
      'ui-data-control ui-data-textarea min-h-[96px] px-3 py-2.5 text-[13px] font-medium leading-5 min-[360px]:text-[14px]',
      'placeholder:text-[color:var(--app-text-soft)]',
    );

    if (f.kind === 'multiline') {
      return (
        <textarea
          key={f.key}
          data-filled={fieldIsFilled ? 'true' : 'false'}
          value={value}
          onChange={e => updateField(f.key, e.target.value)}
          placeholder={inputPlaceholder}
          rows={3}
          className={textAreaInput}
        />
      );
    }

    if (f.kind === 'select') {
      return (
        <select
          key={f.key}
          data-filled={fieldIsFilled ? 'true' : 'false'}
          value={value}
          onChange={e => updateField(f.key, e.target.value)}
          className={baseInput}
        >
          <option value="">{placeholder || `- ${label} -`}</option>
          {f.options?.map(o => (
            <option key={o.value} value={o.value}>
              {locale === 'id' ? o.labelId : o.labelEn}
            </option>
          ))}
        </select>
      );
    }

    if (f.kind === 'number') {
      return (
        <input
          key={f.key}
          type="number"
          data-filled={fieldIsFilled ? 'true' : 'false'}
          value={value}
          onChange={e => updateField(f.key, e.target.value)}
          placeholder={inputPlaceholder}
          className={baseInput}
        />
      );
    }

    if (f.kind === 'currency') {
      return (
        <input
          key={f.key}
          type="text"
          data-filled={fieldIsFilled ? 'true' : 'false'}
          value={value}
          onChange={e => updateField(f.key, e.target.value)}
          placeholder={inputPlaceholder || 'e.g. 5000000'}
          className={baseInput}
        />
      );
    }

    if (f.kind === 'date') {
      const dateValue =
        value && value.includes('T') ? value.split('T')[0] : value;
      return (
        <input
          key={f.key}
          type="date"
          data-filled={fieldIsFilled ? 'true' : 'false'}
          value={dateValue}
          onChange={e => updateField(f.key, e.target.value)}
          className={baseInput}
        />
      );
    }

    if (f.kind === 'url') {
      return (
        <input
          key={f.key}
          type="url"
          data-filled={fieldIsFilled ? 'true' : 'false'}
          value={value}
          onChange={e => updateField(f.key, e.target.value)}
          placeholder={inputPlaceholder}
          className={baseInput}
        />
      );
    }

    return (
      <input
        key={f.key}
        type="text"
        data-filled={fieldIsFilled ? 'true' : 'false'}
        value={value}
        onChange={e => updateField(f.key, e.target.value)}
        placeholder={inputPlaceholder}
        required={isFieldRequired(f)}
        className={baseInput}
      />
    );
  };

  const renderFieldBlock = (f: SectorField) => {
    const meta = resolveFieldMeta(f);
    const isWide = f.kind === 'multiline';
    const value = String(fieldValues[f.key] ?? '');
    const quickActions = isSimpleModeActive
      ? []
      : buildQuickFieldActions(f, value);
    const lowerKey = f.key.toLowerCase();
    const isRequired = isFieldRequired(f);
    const showHint =
      Boolean(meta.hint) &&
      !isSimpleModeActive &&
      !cleanText(value) &&
      (f.kind === 'select' ||
        f.kind === 'date' ||
        f.kind === 'url' ||
        lowerKey.startsWith('promo_') ||
        lowerKey === 'title' ||
        lowerKey === 'summary' ||
        lowerKey === 'body' ||
        lowerKey === 'price_cents' ||
        lowerKey === 'price_unit' ||
        lowerKey === 'salary_range' ||
        lowerKey === 'location' ||
        lowerKey === 'address' ||
        lowerKey === 'company_name');
    return (
      <div
        key={f.key}
        className={cn('space-y-1.5', isWide ? 'lg:col-span-2' : undefined)}
      >
        <label className="block text-[12px] font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          <span className="inline-flex min-w-0 items-center gap-1">
            <span className="min-w-0 truncate">{meta.label}</span>
            {isRequired ? (
              <span className="text-[color:var(--app-danger)]">*</span>
            ) : null}
          </span>
        </label>
        {renderField(f)}
        {quickActions.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {quickActions.map(action => (
              <button
                key={`${f.key}-${action.key}`}
                type="button"
                onClick={action.onClick}
                className={cn(
                  'inline-flex min-h-[28px] items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold transition hover:-translate-y-0.5',
                  action.tone === 'accent'
                    ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                    : action.tone === 'danger'
                      ? 'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]'
                      : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55 dark:text-[color:var(--app-text-inverse)]',
                )}
              >
                {action.label}
              </button>
            ))}
          </div>
        ) : null}
        {showHint && (
          <p className="line-clamp-1 text-[10.5px] leading-4 text-[color:var(--app-text-soft)]">
            {meta.hint}
          </p>
        )}
      </div>
    );
  };

  if (authLoading || loadingInitial) {
    return <CreatePageSkeleton />;
  }

  if (showRootIntentPicker) {
    return renderCreateEntrySurface({
      activeIntent: 'supply',
      topTitle: locale === 'id' ? 'Buat posting' : 'Create post',
      showIntentTabs: false,
      eyebrow: locale === 'id' ? 'Mulai dari sini' : 'Start here',
      title:
        locale === 'id'
          ? 'Mau menawarkan atau mencari?'
          : 'Do you want to sell or need something?',
      description:
        locale === 'id'
          ? 'Pilih sesuai tujuan Anda. Setelah itu isi detail singkat seperti judul, harga atau budget, lokasi, dan foto.'
          : 'Choose one first. Then add the short details like title, price/budget, location, and photos.',
      children: (
        <>
          <div className="grid gap-3 lg:grid-cols-2">
            <Link
              href={supplyEntryHref}
              className="group relative overflow-hidden rounded-[18px] border border-emerald-200 bg-[linear-gradient(135deg,#ffffff_0%,#f4fff8_100%)] p-4 text-left shadow-[0_18px_34px_-30px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:border-emerald-300 dark:border-emerald-900/70 dark:bg-emerald-950/20"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-emerald-600 text-white shadow-[0_14px_26px_-18px_rgba(4,120,87,0.72)]">
                  <Store className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="rounded-full border border-emerald-200 bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-emerald-700">
                    {locale === 'id' ? 'Saya menawarkan' : 'I offer'}
                  </span>
                  <span className="mt-3 block text-[1.15rem] font-black leading-tight text-[color:var(--app-text)] dark:text-white">
                    {locale === 'id' ? 'Tawarkan sesuatu' : 'Want to sell'}
                  </span>
                  <span className="mt-1.5 block text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                    {locale === 'id'
                      ? PROMO_ONLY_MODE
                        ? 'Untuk produk dan jasa yang ingin dipromosikan dulu.'
                        : 'Untuk produk, jasa, lokasi, alat sewa, atau oper usaha.'
                      : PROMO_ONLY_MODE
                        ? 'For products and services you want to promote first.'
                        : 'Products, services, spaces, rentals, or business transfer.'}
                  </span>
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(locale === 'id'
                  ? PROMO_ONLY_MODE
                    ? ['Produk', 'Jasa']
                    : ['Produk', 'Jasa', 'Lokasi']
                  : PROMO_ONLY_MODE
                    ? ['Product', 'Service']
                    : ['Product', 'Service', 'Space']
                ).map(item => (
                  <span
                    key={item}
                    className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-emerald-700 ring-1 ring-emerald-100"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <span className="mt-4 inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-emerald-600 px-3.5 text-[12px] font-black text-white transition group-hover:bg-emerald-700">
                {locale === 'id' ? 'Mulai tawarkan' : 'Start selling'}
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
            <Link
              href={demandEntryHref}
              className="group relative overflow-hidden rounded-[18px] border border-amber-200 bg-[linear-gradient(135deg,#ffffff_0%,#fffbeb_100%)] p-4 text-left shadow-[0_18px_34px_-30px_rgba(15,23,42,0.2)] transition hover:-translate-y-0.5 hover:border-amber-300 dark:border-amber-900/70 dark:bg-amber-950/20"
            >
              <div className="flex items-start gap-3">
                <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[16px] bg-amber-500 text-white shadow-[0_14px_26px_-18px_rgba(217,119,6,0.72)]">
                  <Target className="h-5 w-5" />
                </span>
                <span className="min-w-0">
                  <span className="rounded-full border border-amber-200 bg-white/90 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-amber-700">
                    {locale === 'id' ? 'Saya mencari' : 'I need'}
                  </span>
                  <span className="mt-3 block text-[1.15rem] font-black leading-tight text-[color:var(--app-text)] dark:text-white">
                    {locale === 'id'
                      ? 'Cari kebutuhan usaha'
                      : 'Need something'}
                  </span>
                  <span className="mt-1.5 block text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                    {locale === 'id'
                      ? PROMO_ONLY_MODE
                        ? 'Cari supplier produk atau jasa yang dibutuhkan.'
                        : 'Cari supplier, jasa, pekerja, lokasi, atau alat.'
                      : PROMO_ONLY_MODE
                        ? 'Find product suppliers or services you need.'
                        : 'Find suppliers, services, talent, spaces, or tools.'}
                  </span>
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-1.5">
                {(locale === 'id'
                  ? PROMO_ONLY_MODE
                    ? ['Supplier', 'Jasa']
                    : ['Supplier', 'Jasa', 'Talent']
                  : PROMO_ONLY_MODE
                    ? ['Supplier', 'Service']
                    : ['Supplier', 'Service', 'Talent']
                ).map(item => (
                  <span
                    key={item}
                    className="rounded-full bg-white/90 px-2.5 py-1 text-[10px] font-bold text-amber-700 ring-1 ring-amber-100"
                  >
                    {item}
                  </span>
                ))}
              </div>
              <span className="mt-4 inline-flex min-h-9 items-center justify-center gap-2 rounded-full bg-amber-500 px-3.5 text-[12px] font-black text-white transition group-hover:bg-amber-600">
                {locale === 'id' ? 'Mulai cari' : 'Create request'}
                <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
              </span>
            </Link>
          </div>

          <div className="mt-4 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/45">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="text-[12px] font-black text-[color:var(--app-text)]">
                  {locale === 'id'
                    ? 'Langsung pilih yang paling mirip'
                    : 'Pick the closest shortcut'}
                </p>
                <p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)]">
                  {locale === 'id'
                    ? 'Nanti masih bisa diedit sebelum tayang.'
                    : 'You can still edit before publishing.'}
                </p>
              </div>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)] dark:bg-slate-900">
                {locale === 'id' ? 'Mode ringkas' : 'Compact mode'}
              </span>
            </div>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2 sm:gap-3 xl:grid-cols-4">
            {rootCreateActions.map(item => (
              <CreateEntryActionCard key={item.key} item={item} />
            ))}
          </div>
          <p className="mt-3 flex items-center gap-2 text-[11px] text-[color:var(--app-text-soft)]">
            <ShieldCheck className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
            {locale === 'id'
              ? 'Belum yakin? Bisa buat lagi nanti.'
              : 'Not sure? You can create more than one later.'}
          </p>
        </>
      ),
      aside: (
        <>
          <div className="rounded-[14px] bg-[color:var(--app-surface-muted)] p-3 ring-1 ring-[color:var(--app-border)] dark:bg-slate-950/55 dark:ring-[color:var(--app-border-strong)]">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-200">
              <ClipboardList className="h-4 w-4" />
            </span>
            <p className="mt-2 text-[13px] font-black text-[color:var(--app-text)]">
              {locale === 'id' ? 'Alurnya simpel' : 'Simple flow'}
            </p>
            <div className="mt-2 grid gap-2">
              {(locale === 'id'
                ? [
                  'Pilih Tawarkan atau Cari',
                  'Isi detail yang wajib',
                  'Tayang, lalu lanjut chat',
                ]
                : [
                  'Choose Sell or Need',
                  'Fill required details',
                  'Publish, then continue in chat',
                ]
              ).map((item, index) => (
                <span
                  key={item}
                  className="flex items-start gap-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]"
                >
                  <span className="mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-[10px] font-black text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)] dark:bg-slate-900">
                    {index + 1}
                  </span>
                  {item}
                </span>
              ))}
            </div>
          </div>
          <div className="rounded-[14px] bg-white/80 p-3 ring-1 ring-[color:var(--app-border)] dark:bg-slate-950/45 dark:ring-[color:var(--app-border-strong)]">
            <p className="text-[13px] font-black text-[color:var(--app-text)]">
              {locale === 'id'
                ? 'Proses cepat & aman'
                : 'Fast and safe process'}
            </p>
            <div className="mt-2 grid gap-1.5">
              {(locale === 'id'
                ? ['Data aman', 'Bisa edit', 'Tayang setelah cek']
                : ['Safe draft', 'Editable', 'Checked before publish']
              ).map(item => (
                <span
                  key={item}
                  className="flex items-center gap-2 text-[11px] text-[color:var(--app-text-soft)]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </>
      ),
    });
  }

  if (showDemandIntentPicker) {
    return renderCreateEntrySurface({
      activeIntent: 'demand',
      eyebrow: locale === 'id' ? 'Cari kebutuhan usaha' : 'Post a need',
      title:
        locale === 'id' ? 'Apa yang ingin Anda cari?' : 'What do you need?',
      description:
        locale === 'id'
          ? PROMO_ONLY_MODE
            ? 'Pilih kategori yang paling dekat. Setelah itu tulis barang atau jasa yang sedang dicari.'
            : 'Pilih kategori yang paling dekat. Setelah itu tulis barang, jasa, talent, lokasi, atau alat yang sedang dicari.'
          : 'Choose the closest category. Then add a short brief.',
      children: (
        <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
          {journeyIntents.map(step => (
            <CreateChoiceCard
              key={step.id}
              disabled={typeSelectionLocked}
              onClick={() => applyJourneyIntent(step)}
              Icon={step.icon}
              theme={
                TYPE_THEMES[step.typeId as keyof typeof TYPE_THEMES] ||
                TYPE_THEMES.product
              }
              selected={type === step.typeId}
              badge={
                locale === 'id'
                  ? (CONTENT_TYPES.find(ct => ct.id === step.typeId)?.shortId ??
                    'Brief')
                  : (CONTENT_TYPES.find(ct => ct.id === step.typeId)?.shortEn ??
                    'Brief')
              }
              title={locale === 'id' ? step.titleId : step.titleEn}
              description={locale === 'id' ? step.bodyId : step.bodyEn}
              example={getCreateChoiceExample(
                step.typeId as ListingTypeId,
                step.listingSide,
                locale,
              )}
              highlights={
                step.typeId === 'product'
                  ? locale === 'id'
                    ? ['Supplier', 'MOQ', 'Kirim']
                    : ['Suppliers', 'MOQ', 'Delivery']
                  : step.typeId === 'service'
                    ? locale === 'id'
                      ? ['Scope', 'Output', 'Deadline']
                      : ['Scope', 'Output', 'Deadline']
                    : step.typeId === 'job'
                      ? locale === 'id'
                        ? ['Role', 'Shift', 'KPI']
                        : ['Role', 'Shift', 'KPI']
                      : step.typeId === 'tool_rental'
                        ? locale === 'id'
                          ? ['Alat', 'Durasi', 'Lokasi']
                          : ['Tool', 'Duration', 'Location']
                        : locale === 'id'
                          ? ['Lokasi', 'Traffic', 'Budget']
                          : ['Location', 'Traffic', 'Budget']
              }
              actionLabel={locale === 'id' ? 'Pilih ini' : 'Use this'}
            />
          ))}
        </div>
      ),
      aside: (
        <>
          <div className="rounded-[14px] bg-[color:var(--app-surface-muted)] p-3 ring-1 ring-[color:var(--app-border)] dark:bg-slate-950/55 dark:ring-[color:var(--app-border-strong)]">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-200">
              <Store className="h-4 w-4" />
            </span>
            <p className="mt-2 text-[13px] font-black text-[color:var(--app-text)]">
              {locale === 'id' ? 'Ingin menawarkan?' : 'Want to offer?'}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
              {locale === 'id'
                ? PROMO_ONLY_MODE
                  ? 'Kalau Anda menyediakan produk atau jasa, pindah ke Tawarkan.'
                  : 'Kalau Anda menyediakan produk, jasa, lokasi, alat, atau oper usaha, pindah ke Tawarkan.'
                : PROMO_ONLY_MODE
                  ? 'If you want to post products or services, switch to Offer.'
                  : 'If you want to post products, services, or spaces, switch to Offer. Talent is managed from the account profile.'}
            </p>
            <Link
              href={supplyEntryHref}
              className="mt-3 inline-flex min-h-[38px] w-full items-center justify-center gap-2 rounded-full bg-[color:var(--app-surface-strong)] px-4 text-[12px] font-semibold text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]"
            >
              {locale === 'id' ? 'Pindah ke Tawarkan' : 'Switch to Sell'}
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="rounded-[14px] bg-white/80 p-3 ring-1 ring-[color:var(--app-border)] dark:bg-slate-950/45 dark:ring-[color:var(--app-border-strong)]">
            <p className="text-[13px] font-black text-[color:var(--app-text)]">
              {locale === 'id' ? 'Biar cepat dibalas' : 'Get faster replies'}
            </p>
            <div className="mt-2 grid gap-1.5">
              {(locale === 'id'
                ? [
                  'Tulis kebutuhan jelas',
                  'Cantumkan area',
                  'Kasih kisaran budget',
                ]
                : ['Write a clear need', 'Add location', 'Add budget range']
              ).map(item => (
                <span
                  key={item}
                  className="flex items-center gap-2 text-[11px] text-[color:var(--app-text-soft)]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </>
      ),
    });
  }

  if (showSupplyIntentPicker) {
    return renderCreateEntrySurface({
      activeIntent: 'supply',
      eyebrow: locale === 'id' ? 'Tawarkan ke pasar' : 'Sell category',
      title:
        locale === 'id'
          ? 'Apa yang ingin Anda tawarkan?'
          : 'What do you want to sell?',
      description:
        locale === 'id'
          ? 'Pilih jenis tawaran yang paling dekat. Setelah itu isi form pendek dengan contoh yang mudah dipahami pembeli.'
          : 'Choose an offer category first. Then fill a short, clear form.',
      children: (
        <>
          {errorMessage && (
            <div className="mb-2 rounded-[14px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)]/92 px-3 py-2.5 text-[11px] text-[color:var(--app-danger)]">
              {errorMessage}
            </div>
          )}
          {typeSelectorGrid}
          {supplySupportQuickLinks}
        </>
      ),
      aside: (
        <>
          <div className="rounded-[14px] bg-[color:var(--app-surface-muted)] p-3 ring-1 ring-[color:var(--app-border)] dark:bg-slate-950/55 dark:ring-[color:var(--app-border-strong)]">
            <span className="inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-emerald-50 text-emerald-700 dark:bg-emerald-950/55 dark:text-emerald-200">
              <ClipboardList className="h-4 w-4" />
            </span>
            <p className="mt-2 text-[13px] font-black text-[color:var(--app-text)]">
              {locale === 'id' ? 'Yang dicari orang' : 'What buyers need'}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
              {locale === 'id'
                ? PROMO_ONLY_MODE
                  ? 'Produk dan jasa paling mudah ditemukan kalau judul, foto, dan deskripsinya jelas.'
                  : 'Produk, jasa, supplier, lokasi, dan talent paling mudah ditemukan kalau judulnya jelas.'
                : PROMO_ONLY_MODE
                  ? 'Products and services are easier to find with a clear title, photos, and description.'
                  : 'Products, services, suppliers, spaces, and talent are easier to find with a clear title.'}
            </p>
          </div>
          <div className="rounded-[14px] bg-white/80 p-3 ring-1 ring-[color:var(--app-border)] dark:bg-slate-950/45 dark:ring-[color:var(--app-border-strong)]">
            <p className="text-[13px] font-black text-[color:var(--app-text)]">
              {locale === 'id' ? 'Tips singkat' : 'Quick tips'}
            </p>
            <div className="mt-2 grid gap-1.5">
              {(locale === 'id'
                ? [
                  'Judul langsung jelas',
                  'Harga atau range ada',
                  'Foto utama siap',
                ]
                : ['Clear title', 'Price or range added', 'Cover photo ready']
              ).map(item => (
                <span
                  key={item}
                  className="flex items-center gap-2 text-[11px] text-[color:var(--app-text-soft)]"
                >
                  <CheckCircle2 className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </>
      ),
    });
  }

  const primaryActionWillAdvance =
    currentStep < TOTAL_STEPS;
  const nextStepLabel =
    stepLabels[Math.min(currentStep, TOTAL_STEPS - 1)] ||
    (locale === 'id' ? 'Berikutnya' : 'Next');
  const primaryActionLabel = uploadingImages
    ? locale === 'id'
      ? 'Lagi upload foto...'
      : 'Uploading images...'
    : uploadingDocs
      ? locale === 'id'
        ? 'Lagi upload dokumen...'
        : 'Uploading files...'
      : loading
        ? locale === 'id'
          ? 'Lagi nyimpen...'
          : 'Saving...'
        : primaryActionWillAdvance
          ? locale === 'id'
            ? `Lanjut: ${nextStepLabel}`
            : `Next: ${nextStepLabel}`
          : contentStatus === 'active'
            ? locale === 'id'
              ? 'Simpan perubahan'
              : 'Save changes'
            : locale === 'id'
              ? 'Selesai & Publikasikan'
              : 'Finish & Publish';

  return (
    <div className="ui-page-stack mx-auto w-full max-w-none px-0 py-0">
      <CreatePageHeader
        locale={locale}
        formEyebrow={effectiveFormEyebrow}
        formTitle={effectiveFormTitle}
        formSubtitle={effectiveFormSubtitle}
        uiVariant={isNeedServiceJourney ? 'compact' : 'default'}
        contentStatus={contentStatus}
        currentStep={currentStep}
        totalSteps={TOTAL_STEPS}
        stepLabels={stepLabels}
        onStepSelect={step =>
          goToStep(step, {
            draftId: workingId,
            typeId: activeType,
          })
        }
        activeTypeIcon={ActiveTypeIcon}
        selectedTypeLabel={selectedTypeLabel}
        typePicked={typePicked}
        typeThemeBadgeClass={typeTheme.badge}
        listingSideContextLabel={listingSideContextLabel}
        typeSummaryDescription={typeSummaryDescription}
        requiredDone={requiredDone}
        requiredTotal={requiredFields.length}
        imagesCount={images.length}
        documentsCount={documents.length}
        promotionEnabled={promotionEnabled}
        promotionRequiredDone={promotionRequiredDone}
        promotionRequiredTotal={promotionRequiredFields.length}
        publishBlockersCount={publishBlockers.length}
        publishReadyCount={publishReadyCount}
        publishReadinessTotal={publishReadiness.length}
        supportsSimpleMode={supportsSimpleMode}
        listingMode={listingMode}
        onListingModeChange={setListingMode}
        hideModeSwitch={isNeedServiceJourney}
        minimal={currentStep === 1 && typePicked && !isNeedServiceJourney}
        canChangeTypeBeforeDraft={canChangeTypeBeforeDraft}
        onChangeType={openTypePicker}
        typeSelectionLocked={typeSelectionLocked}
      />

      {infoMessage && (
        <div className="mt-3 rounded-[18px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]/92 px-3 py-2.5 text-xs text-[color:var(--app-accent)]">
          {infoMessage}
        </div>
      )}
      {errorMessage && (
        <div className="mt-3 rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)]/92 px-3 py-2.5 text-xs text-[color:var(--app-danger)]">
          {errorMessage}
          {errorDetails.length > 1 && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {errorDetails.slice(0, 6).map(detail => (
                <span
                  key={detail}
                  className="rounded-full border border-[color:var(--app-danger-border)] bg-[color:var(--app-surface-strong)]/88 px-2.5 py-1 text-[10px] font-medium text-[color:var(--app-danger)] backdrop-blur-sm"
                >
                  {detail}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {hasForeignBrandSignalForSupply ? (
        <div className="mt-3 rounded-[18px] border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)]/92 px-3 py-2.5 text-[11px] text-[color:var(--app-danger)]">
          <p className="font-semibold">
            {locale === 'id'
              ? 'Ada sinyal brand luar di listing ini.'
              : 'Foreign-brand signals were found in this listing.'}
          </p>
          <p className="mt-1 leading-5">
            {locale === 'id'
              ? `Hapus referensi seperti ${foreignBrandSignalSummary} dulu sebelum tayang.`
              : `Remove references such as ${foreignBrandSignalSummary} before publishing.`}
          </p>
        </div>
      ) : null}

      <form
        onSubmit={handleSubmit}
        data-testid="create-listing-form"
        className={cn(
          'mt-3',
          showDesktopAssistRail
            ? 'xl:grid xl:grid-cols-[minmax(0,1fr)_300px] xl:gap-4 2xl:grid-cols-[minmax(0,1fr)_320px]'
            : '',
        )}
      >
        <div className="space-y-3">
          {showStepOneSetupCard && (
            <details className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 py-2 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/35">
              <summary className="flex min-h-9 cursor-pointer list-none items-center justify-between gap-3 rounded-[12px] px-1 text-left text-[12px] font-black text-[color:var(--app-text)] [&::-webkit-details-marker]:hidden">
                <span className="min-w-0 truncate">
                  {locale === 'id' ? 'Opsi lanjutan' : 'Advanced options'}
                </span>
                <span className="shrink-0 rounded-full bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)] dark:ring-[color:var(--app-border-strong)]">
                  {locale === 'id' ? 'Kategori, contoh' : 'Category, samples'}
                </span>
              </summary>
              <div className="mt-2 space-y-2">
                {typePicked && supportsDemandListing(activeType) && (
                  <section className="rounded-[18px] border border-[color:color-mix(in_srgb,var(--app-border)_84%,transparent)] bg-[color:var(--app-surface-strong)] p-2 shadow-[0_16px_34px_-32px_rgba(15,23,42,0.22)] dark:border-[color:var(--app-border-strong)]">
                    <div className="flex flex-wrap items-center justify-between gap-2 px-1">
                      <div className="min-w-0">
                        <p className="text-[11px] font-black uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                          {locale === 'id' ? 'Arah posting' : 'Post direction'}
                        </p>
                        <p className="truncate text-xs font-medium text-[color:var(--app-text)]">
                          {locale === 'id'
                            ? 'Pilih ringkas kalau mau isi inti dulu. Detail bisa ditambah nanti.'
                            : 'Pick compact if you want to fill the core info first. Add detail later.'}
                        </p>
                      </div>
                      <span className="inline-flex max-w-[54vw] items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[11px] font-bold text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]">
                        <span className="truncate">{selectedTypeLabel}</span>
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-1.5">
                      <button
                        type="button"
                        aria-pressed={listingSide === 'demand'}
                        disabled={!canSwitchListingSide}
                        onClick={() => {
                          if (listingSide === 'demand') return;
                          setListingSide('demand');
                          syncCreateRoute({ sideId: 'demand' });
                        }}
                        className={`inline-flex min-h-[46px] items-center gap-2 rounded-[14px] border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${listingSide === 'demand'
                            ? 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--app-warning-border)_70%,transparent)]'
                            : 'border-transparent bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:border-[color:var(--app-border)]'
                          }`}
                      >
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/15 bg-[color:var(--app-surface-strong)]">
                          {listingSide === 'demand' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Target className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 text-[13px] font-black leading-4">
                          <span className="line-clamp-2">
                            {demandActionTitle}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-pressed={listingSide === 'supply'}
                        disabled={!canSwitchListingSide}
                        onClick={() => {
                          if (listingSide === 'supply') return;
                          setListingSide('supply');
                          syncCreateRoute({ sideId: 'supply' });
                        }}
                        className={`inline-flex min-h-[46px] items-center gap-2 rounded-[14px] border px-2.5 py-2 text-left transition disabled:cursor-not-allowed disabled:opacity-60 ${listingSide === 'supply'
                            ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--app-accent-border)_70%,transparent)]'
                            : 'border-transparent bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] hover:border-[color:var(--app-border)]'
                          }`}
                      >
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-current/15 bg-[color:var(--app-surface-strong)]">
                          {listingSide === 'supply' ? (
                            <CheckCircle2 className="h-4 w-4" />
                          ) : (
                            <Sparkles className="h-4 w-4" />
                          )}
                        </span>
                        <span className="min-w-0 text-[13px] font-black leading-4">
                          <span className="line-clamp-2">
                            {supplyActionTitle}
                          </span>
                        </span>
                      </button>
                    </div>
                    {!canSwitchListingSide && (
                      <p className="px-1 pt-2 text-[11px] text-[color:var(--app-text-soft)]">
                        {locale === 'id'
                          ? 'Arah ini udah dikunci.'
                          : 'Direction is locked.'}
                      </p>
                    )}
                  </section>
                )}

                {typePicked && activeTypeIsProperty && (
                  <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                    <label className="block text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] mb-1.5">
                      {locale === 'id' ? 'Sektor listing' : 'Listing sector'}
                    </label>
                    <p className="text-[11px] text-[color:var(--app-text)]">
                      {locale === 'id'
                        ? 'Untuk properti, sektornya otomatis Real Estate.'
                        : 'Property is mapped to Real Estate.'}
                    </p>
                  </div>
                )}

                {showSectorPicker && !isSimpleModeActive && (
                  <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
                        <label className="block text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                          {locale === 'id'
                            ? 'Kategori usaha (opsional)'
                            : 'Industry specialization (optional)'}
                        </label>
                        <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
                          {locale === 'id'
                            ? 'Boleh kosong. Pakai kalau butuh field yang lebih spesifik.'
                            : 'Optional. Use it for more specific fields.'}
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setSectorQuery('');
                          setIsSectorPickerOpen(true);
                        }}
                        className="inline-flex min-h-[40px] items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 text-xs font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-info-border)] hover:text-[color:var(--app-info)] dark:border-[color:var(--app-border-strong)]"
                      >
                        {selectedSectorView
                          ? locale === 'id'
                            ? 'Ganti kategori'
                            : 'Change category'
                          : locale === 'id'
                            ? 'Pilih kategori'
                            : 'Choose category'}
                      </button>
                    </div>

                    {selectedSectorView ? (
                      <div className="mt-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <span
                            style={selectedSectorView.colorStyle}
                            className={cn(
                              'inline-flex items-center gap-2 rounded-full border border-transparent px-3 py-1.5 text-[11px] font-semibold text-white shadow-sm',
                              selectedSectorView.colorClass,
                            )}
                          >
                            <selectedSectorView.icon className="h-3.5 w-3.5" />
                            {getSectorLabel(selectedSectorView, locale)}
                          </span>
                          {selectedSubSectorView ? (
                            <span className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)]">
                              {getSubSectorName(selectedSubSectorView, locale)}
                            </span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              setSector('');
                              setSubSector('');
                              setSectorQuery('');
                            }}
                            className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-1.5 text-[11px] font-semibold text-[color:var(--app-text-soft)] transition hover:text-[color:var(--app-danger)] dark:border-[color:var(--app-border-strong)]"
                          >
                            {locale === 'id' ? 'Hapus' : 'Clear'}
                          </button>
                        </div>
                        {getSectorDescription(selectedSectorView, locale) ? (
                          <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                            {getSectorDescription(selectedSectorView, locale)}
                          </p>
                        ) : null}
                      </div>
                    ) : (
                      <p className="mt-3 rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-[11px] text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]">
                        {locale === 'id'
                          ? 'Belum dipilih, tapi tetap bisa lanjut.'
                          : 'Nothing selected. You can continue.'}
                      </p>
                    )}
                  </div>
                )}
                {typePicked && !isSimpleModeActive ? (
                  <CreateListingTemplatePicker
                    locale={localeCode}
                    listingSide={listingSide}
                    activeType={activeType as ListingTypeId}
                    onApplyTemplate={applyListingTemplate}
                  />
                ) : null}
              </div>
            </details>
          )}

          {/* Step 1 fields */}
          {currentStep === 1 && (
            <>
              <CreateFormSectionCard
                eyebrow={locale === 'id' ? 'Isi utama' : 'Main info'}
                title={stepOneMainTitle}
                description={stepOneMainDescription}
                aside={
                  <div className="flex flex-col items-end gap-1">
                    <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                      {isSimpleModeActive
                        ? locale === 'id'
                          ? `${requiredFields.length} info inti`
                          : `${requiredFields.length} core info`
                        : locale === 'id'
                          ? `${requiredDone}/${requiredFields.length} wajib`
                          : `${requiredDone}/${requiredFields.length} required`}
                    </span>
                    {supportsSimpleMode ? (
                      <span className="inline-flex items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2.5 py-1 text-[10px] font-black text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55">
                        {isSimpleModeActive
                          ? locale === 'id'
                            ? 'Mode cepat'
                            : 'Quick mode'
                          : locale === 'id'
                            ? 'Mode lengkap'
                            : 'Full mode'}
                      </span>
                    ) : null}
                  </div>
                }
              >
                {!typePicked && (
                  <div className="rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-4 text-xs text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] dark:text-[color:var(--app-text-soft)]">
                    {locale === 'id'
                      ? 'Pilih tipe dulu, lalu isi inti.'
                      : 'After picking the type, fill the core listing info here.'}
                  </div>
                )}
                {typePicked && (
                  <>
                    {renderMediaUploadPanel()}
                    <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                      {step1PrimaryFields.map(renderFieldBlock)}
                    </div>
                    {step1SecondaryFields.length > 0 && (
                      <DetailAccordion
                        title={
                          locale === 'id'
                            ? isSimpleModeActive
                              ? 'Opsional'
                              : 'Detail tambahan (opsional)'
                            : isSimpleModeActive
                              ? 'Optional'
                              : 'Optional details'
                        }
                        description={
                          locale === 'id'
                            ? 'Isi kalau perlu.'
                            : 'Fill if needed.'
                        }
                        className="bg-[color:var(--app-surface-muted)]"
                      >
                        <div className="grid grid-cols-1 gap-2.5 text-[color:var(--app-text)] lg:grid-cols-2">
                          {step1SecondaryFields.map(renderFieldBlock)}
                        </div>
                      </DetailAccordion>
                    )}
                  </>
                )}
              </CreateFormSectionCard>
            </>
          )}

          {/* Step 2 fields */}
          {currentStep === 2 && (
            <>
              <CreateFormSectionCard
                eyebrow={
                  locale === 'id' ? 'Detail opsional' : 'Optional detail'
                }
                title={stepTwoMainTitle}
                description={stepTwoMainDescription}
                aside={
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {isSimpleModeActive
                      ? locale === 'id'
                        ? 'opsional'
                        : 'optional'
                      : locale === 'id'
                        ? `${step2RequiredFields.length} field utama`
                        : `${step2RequiredFields.length} main fields`}
                  </span>
                }
              >
                {!typePicked && (
                  <div className="rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-4 text-xs text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] dark:text-[color:var(--app-text-soft)]">
                    {locale === 'id'
                      ? 'Pilih tipe dulu di step 1 ya.'
                      : 'Pick the type in step 1 first.'}
                  </div>
                )}
                {typePicked && (
                  <>
                    {!isSimpleModeActive ? (
                      <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-[11px] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] dark:text-[color:var(--app-text-soft)]">
                        {locale === 'id'
                          ? demandTypeMeta?.step2HintId ||
                          typeConfig.step2HintId
                          : demandTypeMeta?.step2HintEn ||
                          typeConfig.step2HintEn}
                      </div>
                    ) : null}
                    {step2Fields.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-4 text-xs text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] dark:text-[color:var(--app-text-soft)]">
                        {isSimpleModeActive
                          ? locale === 'id'
                            ? 'Tidak ada yang wajib.'
                            : 'Nothing required here.'
                          : locale === 'id'
                            ? 'Belum ada detail tambahan.'
                            : 'No additional detail fields for this combination yet.'}
                      </div>
                    ) : (
                      <>
                        <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2">
                          {step2RequiredFields.map(renderFieldBlock)}
                        </div>
                        {step2OptionalFields.length > 0 && (
                          <DetailAccordion
                            title={
                              locale === 'id'
                                ? isSimpleModeActive
                                  ? 'Opsional'
                                  : 'Detail tambahan (opsional)'
                                : isSimpleModeActive
                                  ? 'Optional'
                                  : 'Optional details'
                            }
                            description={
                              locale === 'id'
                                ? 'Isi kalau perlu.'
                                : 'Fill if needed.'
                            }
                            className="bg-[color:var(--app-surface-muted)]"
                          >
                            <div className="grid grid-cols-1 gap-2.5 text-[color:var(--app-text)] lg:grid-cols-2">
                              {step2OptionalFields.map(renderFieldBlock)}
                            </div>
                          </DetailAccordion>
                        )}
                      </>
                    )}
                  </>
                )}
              </CreateFormSectionCard>
            </>
          )}

          {/* Step 3: media + docs + tags */}
          {currentStep === 3 && (
            <>
              <CreateFormSectionCard
                eyebrow={locale === 'id' ? 'Foto & dokumen' : 'Photos & docs'}
                title={stepThreeMainTitle}
                description={stepThreeMainDescription}
                aside={
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[11px] font-semibold text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
                    {images.length + documents.length}{' '}
                    {locale === 'id' ? 'aset' : 'assets'}
                  </span>
                }
              >
                {showImages ? (
                  <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 text-xs text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] dark:text-[color:var(--app-text-soft)]">
                    <p className="font-semibold">
                      {locale === 'id'
                        ? 'Foto utama sudah dipasang di step 1.'
                        : 'The main photo is already handled in step 1.'}
                    </p>
                    <p className="mt-1 leading-5">
                      {locale === 'id'
                        ? 'Di sini tinggal tambah dokumen pendukung, kalau memang ada.'
                        : 'Use this step for supporting documents if needed.'}
                    </p>
                  </div>
                ) : null}

                <div>
                  <label className="block text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] mb-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <FileText className="w-3.5 h-3.5 text-[color:var(--app-text-soft)]" />
                      <span>
                        {locale === 'id'
                          ? 'Dokumen tambahan'
                          : 'Supporting documents'}
                      </span>
                    </span>
                  </label>
                  <div className="rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                    <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg bg-[color:var(--app-accent)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-text-inverse)] hover:bg-[color:var(--app-accent)]">
                      <Upload className="w-3.5 h-3.5" />
                      {locale === 'id' ? 'Tambah dokumen' : 'Add documents'}
                      <input
                        type="file"
                        accept={DOC_ACCEPT}
                        multiple
                        className="hidden"
                        onChange={e => {
                          void handleAddDocuments(e.target.files);
                          e.currentTarget.value = '';
                        }}
                      />
                    </label>
                    <p className="mt-2 text-[11px] text-[color:var(--app-text)]">
                      {locale === 'id'
                        ? 'PDF, DOC, XLS, CSV, PPT, ZIP, RAR, 7Z. Maksimal 80MB per file.'
                        : 'PDF, DOC, XLS, CSV, PPT, ZIP, RAR, 7Z. Max 80MB/file.'}
                    </p>
                    {documents.length > 0 && (
                      <div className="mt-2 space-y-2">
                        {documents.map((doc, idx) => (
                          <div
                            key={`${doc.name}-${idx}`}
                            className="flex items-center justify-between gap-2 rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2.5 py-1.5 text-xs"
                          >
                            <div className="min-w-0">
                              <div className="truncate font-medium text-[color:var(--app-text)]">
                                {doc.name}
                              </div>
                              <div className="text-[color:var(--app-text)]">
                                {formatFileSize(doc.size)}
                                {doc.url
                                  ? ` - ${locale === 'id' ? 'Udah masuk' : 'Saved'}`
                                  : ''}
                                {doc.uploading ? ` - Uploading` : ''}
                              </div>
                            </div>
                            <div className="flex items-center gap-1.5">
                              {doc.url && (
                                <a
                                  href={doc.url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="inline-flex items-center gap-1 rounded-md border border-[color:var(--app-border)] px-2 py-1 text-[color:var(--app-text)]"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  {locale === 'id' ? 'Buka' : 'View'}
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setDocuments(prev =>
                                    prev.filter((_, i) => i !== idx),
                                  )
                                }
                                className="inline-flex items-center justify-center rounded-md border border-[color:var(--app-danger-border)] px-2 py-1 text-[color:var(--app-danger)]"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] mb-1.5">
                    <span className="inline-flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-[color:var(--app-text-soft)]" />
                      <span>{locale === 'id' ? 'Tag' : 'Tags'}</span>
                    </span>
                  </label>
                  <input
                    type="text"
                    value={fieldValues.tags || ''}
                    onChange={e => updateField('tags', e.target.value)}
                    placeholder={
                      locale === 'id' ? 'Pisahin pakai koma' : 'Comma-separated'
                    }
                    className="h-10 w-full min-w-0 rounded-[12px] border border-slate-300 bg-white px-3 text-[13px] font-medium text-[color:var(--app-text)] shadow-none transition placeholder:text-slate-400 hover:border-slate-400 focus:border-[color:var(--app-accent)] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--app-accent)_14%,transparent)] dark:border-slate-600 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500 dark:hover:border-slate-500 dark:focus:border-[color:var(--app-accent)]"
                  />
                </div>
              </CreateFormSectionCard>
            </>
          )}

          {/* Step 4: promotion setup */}
          {currentStep === 4 && (
            <>
              <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                <p className="text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {locale === 'id'
                    ? 'Promo, opsional'
                    : 'Optional Listing Promotion'}
                </p>
                <p className="mt-1 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {locale === 'id'
                    ? 'Boleh skip. Listing tetap bisa tayang.'
                    : 'Optional. You can still publish without this.'}
                </p>
                <div className="mt-3 inline-flex rounded-lg border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-1 text-[11px] font-semibold">
                  <button
                    type="button"
                    onClick={() => {
                      setPromotionEnabled(true);
                      setErrorMessage('');
                    }}
                    className={`px-3 py-1 rounded-md transition ${promotionEnabled
                        ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
                        : 'text-[color:var(--app-text)]'
                      }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      {locale === 'id' ? 'Pakai promo' : 'Use Promotion'}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPromotionEnabled(false);
                      setErrorMessage('');
                    }}
                    className={`px-3 py-1 rounded-md transition ${!promotionEnabled
                        ? 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]'
                        : 'text-[color:var(--app-text)]'
                      }`}
                  >
                    <span className="inline-flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      {locale === 'id' ? 'Skip step ini' : 'Skip This Step'}
                    </span>
                  </button>
                </div>
              </div>

              {!promotionEnabled && (
                <div className="rounded-xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-4 text-xs text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] dark:text-[color:var(--app-text-soft)]">
                  {locale === 'id'
                    ? 'Tanpa promo tetap bisa tayang. Aktifkan nanti saat edit.'
                    : 'The listing can still be published without promotion. If you need discounts or a campaign later, enable it while editing.'}
                </div>
              )}

              {promotionEnabled && (
                <>
                  <div className="rounded-xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-2 text-[11px] text-[color:var(--app-accent)]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span>
                        {locale === 'id'
                          ? `Isi promo wajib: ${promotionRequiredDone}/${promotionRequiredFields.length}.`
                          : `Complete ${promotionRequiredDone}/${promotionRequiredFields.length} required promotion fields.`}
                      </span>
                      {selectedPromotionOfferType && (
                        <span className="inline-flex items-center rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] px-2.5 py-1 text-[10px] font-semibold text-[color:var(--app-accent)]">
                          {getPromotionOfferLabel(selectedPromotionOfferType)}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="space-y-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                    <div>
                      <p className="text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                        {locale === 'id'
                          ? 'Benefit utama'
                          : 'Primary benefit programs'}
                      </p>
                      <p className="mt-1 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                        {locale === 'id'
                          ? 'Pilih benefit. Sistem cek batas aman.'
                          : 'Pick the benefit users will feel most. The system will then check if fees, tax, and opex are still covered.'}
                      </p>
                    </div>
                    <div className="grid gap-3 md:grid-cols-3">
                      {PROMOTION_PRIMARY_CARDS.map(card => {
                        const selected =
                          selectedPromotionOfferType === card.offerType;
                        const CardIcon = card.icon;
                        return (
                          <button
                            key={card.offerType}
                            type="button"
                            onClick={() => {
                              setFieldValues(prev => {
                                const next: Record<string, string> = {
                                  ...prev,
                                  promo_offer_type: card.offerType,
                                };
                                if (
                                  card.offerType === 'discount' &&
                                  !cleanText(next.promo_discount_kind)
                                ) {
                                  next.promo_discount_kind = 'percent';
                                }
                                if (
                                  card.offerType === 'loyalty_card' &&
                                  !cleanText(next.promo_loyalty_reward_type)
                                ) {
                                  next.promo_loyalty_reward_type = 'discount';
                                }
                                if (
                                  card.offerType === 'raffle' &&
                                  !cleanText(next.promo_raffle_max_winners)
                                ) {
                                  next.promo_raffle_max_winners = '1';
                                }
                                return next;
                              });
                              setErrorMessage('');
                            }}
                            className={`rounded-2xl border p-3 text-left transition-all ${selected
                                ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-surface-strong)] shadow-sm'
                                : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] hover:border-[color:var(--app-accent-border)]'
                              }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-center gap-2">
                                <span
                                  className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${selected
                                      ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                                      : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'
                                    }`}
                                >
                                  <CardIcon className="h-4 w-4" />
                                </span>
                                <div>
                                  <p className="text-sm font-semibold text-[color:var(--app-text)]">
                                    {locale === 'id'
                                      ? card.titleId
                                      : card.titleEn}
                                  </p>
                                  <p className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                                    {locale === 'id'
                                      ? card.benefitId
                                      : card.benefitEn}
                                  </p>
                                </div>
                              </div>
                              {selected && (
                                <CheckCircle2 className="h-4 w-4 text-[color:var(--app-accent)]" />
                              )}
                            </div>
                            <p className="mt-3 text-[11px] leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                              {locale === 'id' ? card.descId : card.descEn}
                            </p>
                          </button>
                        );
                      })}
                    </div>

                    <div>
                      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                        {locale === 'id' ? 'Opsi lain' : 'Other offer types'}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            updateField('promo_offer_type', 'none');
                            setErrorMessage('');
                          }}
                          className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${!selectedPromotionOfferType &&
                              cleanText(fieldValues.promo_offer_type) === 'none'
                              ? 'border-[color:var(--app-text)] bg-[color:var(--app-text)] text-[color:var(--app-text-inverse)]'
                              : 'border-[color:var(--app-border)] text-[color:var(--app-text)]'
                            }`}
                        >
                          {getPromotionOfferLabel('none')}
                        </button>
                        {PROMOTION_SECONDARY_OFFER_TYPES.map(offerType => {
                          const selected =
                            selectedPromotionOfferType === offerType;
                          return (
                            <button
                              key={offerType}
                              type="button"
                              onClick={() => {
                                updateField('promo_offer_type', offerType);
                                setErrorMessage('');
                              }}
                              className={`rounded-full border px-3 py-1.5 text-[11px] font-semibold transition ${selected
                                  ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                                  : 'border-[color:var(--app-border)] text-[color:var(--app-text)]'
                                }`}
                            >
                              {getPromotionOfferLabel(offerType)}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {selectedPromotionOfferType && (
                    <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <p className="text-xs font-semibold text-[color:var(--app-text)]">
                            {locale === 'id'
                              ? 'Simulasi benefit & batas aman'
                              : 'Benefit simulation and guardrail'}
                          </p>
                          <p className="mt-1 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {promotionSnapshot?.offerTagline ||
                              (locale === 'id'
                                ? 'Isi benefitnya dulu biar sistem bisa hitung masih aman atau nggak.'
                                : 'Configure the benefit first so the system can estimate it.')}
                          </p>
                        </div>
                        <span
                          className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold ${promotionSnapshot?.status === 'safe'
                              ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                              : promotionSnapshot?.status === 'watch'
                                ? 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]'
                                : promotionSnapshot?.status === 'unsafe'
                                  ? 'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]'
                                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)]'
                            }`}
                        >
                          {promotionSnapshot?.status === 'safe'
                            ? locale === 'id'
                              ? 'Aman'
                              : 'Safe'
                            : promotionSnapshot?.status === 'watch'
                              ? locale === 'id'
                                ? 'Waspada'
                                : 'Watch'
                              : promotionSnapshot?.status === 'unsafe'
                                ? locale === 'id'
                                  ? 'Ketinggian'
                                  : 'Too aggressive'
                                : locale === 'id'
                                  ? 'Data belum cukup'
                                  : 'Needs data'}
                        </span>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                            {locale === 'id'
                              ? 'Benefit yang kerasa'
                              : 'Customer-facing benefit'}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                            {promotionSnapshot?.benefitLabel ||
                              (locale === 'id'
                                ? 'Pilih benefitnya lalu isi detailnya'
                                : 'Pick a benefit and fill the details')}
                          </div>
                        </div>
                        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                            {locale === 'id'
                              ? 'Perkiraan biaya / order'
                              : 'Estimated cost / order'}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                            {promotionSnapshot?.estimatedBenefitCents
                              ? new Intl.NumberFormat(
                                locale === 'id' ? 'id-ID' : 'en-US',
                                {
                                  style: 'currency',
                                  currency: 'IDR',
                                  maximumFractionDigits: 0,
                                },
                              ).format(
                                promotionSnapshot.estimatedBenefitCents / 100,
                              )
                              : locale === 'id'
                                ? 'Datanya belum cukup'
                                : 'Not enough data'}
                          </div>
                        </div>
                        <div className="rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2">
                          <div className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                            {locale === 'id'
                              ? 'Batas aman / order'
                              : 'Safe buffer / order'}
                          </div>
                          <div className="mt-1 text-sm font-semibold text-[color:var(--app-text)]">
                            {promotionSnapshot?.safeCapCents
                              ? new Intl.NumberFormat(
                                locale === 'id' ? 'id-ID' : 'en-US',
                                {
                                  style: 'currency',
                                  currency: 'IDR',
                                  maximumFractionDigits: 0,
                                },
                              ).format(promotionSnapshot.safeCapCents / 100)
                              : locale === 'id'
                                ? 'Isi harga + margin dulu'
                                : 'Add price + margin'}
                          </div>
                        </div>
                      </div>

                      <p className="mt-3 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                        {promotionSnapshot?.financialMessage ||
                          (locale === 'id'
                            ? 'Sistem bakal ngitung benefitnya setelah cadangan fee platform, PPN, dan opex dipotong dari margin.'
                            : 'The system evaluates the benefit after reserving platform fee, tax, and opex from margin.')}
                      </p>
                    </div>
                  )}

                  <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                    {promotionCoreFields.map(renderFieldBlock)}
                  </div>

                  {promotionTypeFields.length > 0 && (
                    <DetailAccordion
                      title={
                        locale === 'id'
                          ? 'Tambahan sesuai tipe listing'
                          : 'Type-specific promotion extras'
                      }
                      description={
                        locale === 'id'
                          ? 'Tambahan yang relevan buat tipe listing ini.'
                          : 'Extra promotion fields relevant to this listing type.'
                      }
                    >
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {promotionTypeFields.map(renderFieldBlock)}
                      </div>
                    </DetailAccordion>
                  )}

                  {selectedPromotionOfferType &&
                    visiblePromotionBenefitFields.length > 0 && (
                      <div className="space-y-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                        <div>
                          <p className="text-xs font-semibold text-[color:var(--app-text)]">
                            {locale === 'id'
                              ? 'Detail benefit'
                              : 'Benefit details'}
                          </p>
                          <p className="mt-1 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {promotionSnapshot?.supportLabel ||
                              (locale === 'id'
                                ? 'Isi detail benefit yang nanti beneran dilihat user.'
                                : 'Fill the benefit parameters users will actually see.')}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {visiblePromotionBenefitFields.map(renderFieldBlock)}
                        </div>
                      </div>
                    )}

                  {promotionAdvancedFields.length > 0 && (
                    <div className="space-y-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                      <div>
                        <p className="text-xs font-semibold text-[color:var(--app-text)]">
                          {locale === 'id'
                            ? 'Detail promo tambahan'
                            : 'Additional offer detail'}
                        </p>
                        <p className="mt-1 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                          {locale === 'id'
                            ? 'Dipakai buat bundle, referral, bonus, atau format promo non-utama.'
                            : 'Used for bundles, referrals, bonuses, or non-primary offer formats.'}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        {promotionAdvancedFields.map(renderFieldBlock)}
                      </div>
                    </div>
                  )}

                  {selectedPromotionOfferType &&
                    selectedPromotionOfferType !== 'bundle' && (
                      <div className="space-y-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]">
                        <div>
                          <p className="text-xs font-semibold text-[color:var(--app-text)]">
                            {locale === 'id'
                              ? 'Batas aman biaya'
                              : 'Cost guardrail'}
                          </p>
                          <p className="mt-1 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {locale === 'id'
                              ? 'Angka ini bantu jaga biaya Lajukan, pajak, dan operasional tetap ketutup, tapi user masih ngerasa dapat benefit yang jelas.'
                              : 'These numbers help keep platform, tax, and operating costs covered while users still feel a real benefit.'}
                          </p>
                        </div>
                        <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                          {PROMOTION_FINANCE_FIELDS.map(renderFieldBlock)}
                        </div>
                      </div>
                    )}
                </>
              )}
            </>
          )}

          {showSharePackPanel ? (
            <div className="xl:hidden">
              <CreateSharePackPanel
                locale={localeCode}
                input={sharePackInput}
                compact
              />
            </div>
          ) : null}

          <div className="sticky bottom-2 z-20 grid grid-cols-[0.82fr_1.18fr] gap-2 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2 shadow-[0_18px_34px_-24px_rgba(15,23,42,0.18)] backdrop-blur-xl sm:grid-cols-[0.9fr_auto_1.25fr] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/88">
            <button
              type="button"
              onClick={() => {
                if (currentStep > 1) {
                  goToStep(Math.max(1, currentStep - 1), {
                    draftId: workingId,
                    typeId: activeType,
                  });
                  return;
                }
                router.push('/create');
              }}
              className="flex h-11 w-full items-center justify-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-white px-4 text-xs font-semibold text-[color:var(--app-text)] shadow-[0_16px_24px_-22px_rgba(15,23,42,0.2)] backdrop-blur-sm transition hover:bg-[color:var(--app-surface-muted)] dark:border-slate-800/70 dark:bg-slate-950/68"
            >
              <ChevronLeft className="h-4 w-4" />
              {currentStep > 1
                ? locale === 'id'
                  ? 'Kembali'
                  : 'Back'
                : locale === 'id'
                  ? 'Batal'
                  : 'Cancel'}
            </button>

            <button
              type="button"
              onClick={() => saveListing('draft', { persistStep: currentStep })}
              disabled={
                loading || uploadingImages || uploadingDocs || !typePicked
              }
              className="hidden h-11 min-w-[128px] items-center justify-center gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-xs font-semibold text-[color:var(--app-text-soft)] disabled:opacity-50 sm:flex"
            >
              <FileText className="h-4 w-4" />
              {loading && contentStatus === 'draft'
                ? locale === 'id'
                  ? 'Nyimpan...'
                  : 'Saving...'
                : locale === 'id'
                  ? 'Simpan draft'
                  : 'Save draft'}
            </button>

            <button
              type="submit"
              disabled={
                loading ||
                uploadingImages ||
                uploadingDocs ||
                !typePicked ||
                !fieldValues.title?.trim()
              }
              className={`flex h-11 w-full items-center justify-center gap-2 rounded-[14px] bg-gradient-to-r ${typeTheme.buttonPrimary} px-4 text-sm font-bold text-[color:var(--app-text-inverse)] shadow-[0_18px_28px_-20px_rgba(15,23,42,0.28)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {primaryActionWillAdvance ? (
                <ChevronRight className="h-4 w-4" />
              ) : (
                <CheckCircle2 className="h-4 w-4" />
              )}
              {primaryActionLabel}
            </button>
          </div>

          {(uploadingImages || uploadingDocs) && (
            <div className="text-[11px] text-[color:var(--app-text)] flex items-center gap-1.5">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-[color:var(--app-accent)]" />
              {uploadingImages
                ? locale === 'id'
                  ? 'Foto lagi di-upload...'
                  : 'Uploading images...'
                : locale === 'id'
                  ? 'Dokumen lagi di-upload...'
                  : 'Uploading files...'}
            </div>
          )}
        </div>

        {showDesktopAssistRail ? (
          <aside className="mt-3 hidden xl:block xl:mt-0">
            <div className="sticky top-3 space-y-3">
              <div className="rounded-[14px] border border-emerald-100 bg-emerald-50/70 p-4 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.18)] dark:border-emerald-900/70 dark:bg-emerald-950/20">
                <p className="text-[13px] font-black text-[color:var(--app-text)]">
                  {locale === 'id' ? 'Tips' : 'Tips'}
                </p>
                <div className="mt-3 space-y-2">
                  {publishReadiness.slice(0, 4).map((item, index) => (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() =>
                        !item.done
                          ? goToStep(Math.min(index + 1, TOTAL_STEPS), {
                            draftId: workingId,
                            typeId: activeType,
                          })
                          : undefined
                      }
                      className="flex w-full items-start gap-2 rounded-[10px] px-1 py-1 text-left"
                    >
                      <CheckCircle2
                        className={cn(
                          'mt-0.5 h-4 w-4 shrink-0',
                          item.done
                            ? 'text-[color:var(--app-accent)]'
                            : 'text-slate-400',
                        )}
                      />
                      <span className="text-[11px] leading-5 text-[color:var(--app-text)]">
                        {locale === 'id' ? item.labelId : item.labelEn}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              <div className="rounded-[14px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.18)] dark:border-slate-800/75 dark:bg-[color:var(--app-surface-strong)]">
                <div className="flex items-start justify-between gap-3">
                  <p className="text-[13px] font-black text-[color:var(--app-text)]">
                    {locale === 'id' ? 'Ikhtisar' : 'Summary'}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      goToStep(1, { draftId: workingId, typeId: activeType })
                    }
                    className="text-[10px] font-bold text-[color:var(--app-accent)]"
                  >
                    Edit
                  </button>
                </div>
                <div className="mt-4 flex items-center gap-3">
                  <span className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                    <ActiveTypeIcon className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-black text-[color:var(--app-text)]">
                      {sideRailTitle}
                    </p>
                    <p className="mt-0.5 truncate text-[10px] font-semibold text-[color:var(--app-accent)]">
                      {listingSideContextLabel}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid gap-2 text-[11px] text-[color:var(--app-text-soft)]">
                  <span className="flex items-center gap-2">
                    <MapPin className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{sideRailLocation}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <BadgeDollarSign className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{sideRailPriceLabel}</span>
                  </span>
                  <span className="flex items-center gap-2">
                    <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
                    <span>
                      {contentStatus === 'active'
                        ? locale === 'id'
                          ? 'Sudah tayang'
                          : 'Live'
                        : locale === 'id'
                          ? 'Draft tersimpan'
                          : 'Draft saved'}
                    </span>
                  </span>
                </div>
              </div>

              {topPublishBlockers.length > 0 ? (
                <div className="rounded-[14px] border border-amber-200 bg-amber-50/80 p-4 shadow-[0_18px_36px_-34px_rgba(15,23,42,0.18)] dark:border-amber-900 dark:bg-amber-950/20">
                  <p className="text-[13px] font-black text-amber-800 dark:text-amber-200">
                    {locale === 'id'
                      ? 'Prioritas sekarang'
                      : 'Priority right now'}
                  </p>
                  <div className="mt-3 space-y-2">
                    {topPublishBlockers.map(blocker => (
                      <button
                        key={blocker.key}
                        type="button"
                        onClick={() =>
                          goToStep(blocker.step, {
                            draftId: workingId,
                            typeId: activeType,
                          })
                        }
                        className="w-full rounded-[10px] border border-amber-200 bg-white/90 px-3 py-2 text-left transition hover:border-amber-300 hover:bg-white dark:border-amber-900 dark:bg-slate-950/70 dark:hover:border-amber-800"
                      >
                        <p className="text-[11px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          {blocker.title}
                        </p>
                        <p className="mt-1 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                          {blocker.description}
                        </p>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {showSharePackPanel ? (
                <CreateSharePackPanel
                  locale={localeCode}
                  input={sharePackInput}
                  compact
                />
              ) : null}
            </div>
          </aside>
        ) : null}
      </form>
      {industryPickerLayer}
    </div>
  );
}

export default CreatePostingClient;
