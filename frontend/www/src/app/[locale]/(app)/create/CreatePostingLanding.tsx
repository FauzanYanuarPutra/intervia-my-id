'use client';

import type { ReactNode } from 'react';
import Image from 'next/image';
import { useLocale } from 'next-intl';
import {
  ArrowRight,
  Bell,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clock3,
  FileText,
  Headphones,
  Lightbulb,
  ShieldCheck,
  Sparkles,
  Target,
  Users,
  Package,
  BriefcaseBusiness,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { buildCreateBasePath } from './createPageUtils';
import { cn } from '@/lib/utils';
import BusinessPlanAiLite from './BusinessPlanAiLite';

type Intent = 'offer' | 'find';

type IntentCard = {
  key: Intent;
  titleId: string;
  titleEn: string;
  descriptionId: string;
  descriptionEn: string;
  examples: string[];
  imageSrc: string;
  href: string;
};

const STEP_LABELS_ID = [
  'Tujuan',
  'Kategori',
  'Informasi Dasar',
  'Foto',
  'Informasi Tambahan',
  'Preview',
];

const STEP_LABELS_EN = [
  'Purpose',
  'Category',
  'Basic Info',
  'Photo',
  'Additional Info',
  'Preview',
];

const OFFER_EXAMPLES = [
  'Supplier',
  'Produk',
  'Jasa',
  'Tempat Usaha',
  'Freelancer',
  'Franchise',
];
const FIND_EXAMPLES = [
  'Supplier',
  'Produk',
  'Freelancer',
  'Investor',
  'Partner',
  'Distributor',
];

function Stepper({ locale }: { locale: 'id' | 'en' }) {
  const labels = locale === 'id' ? STEP_LABELS_ID : STEP_LABELS_EN;
  return (
    <div className="flex items-center gap-2 overflow-hidden">
      {labels.map((label, index) => {
        const active = index === 0;
        return (
          <div key={label} className="flex min-w-0 items-center gap-2">
            <span
              className={cn(
                'inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border text-[12px] font-bold',
                active
                  ? 'border-emerald-600 bg-emerald-600 text-white shadow-[0_12px_22px_-16px_rgba(22,163,74,0.55)]'
                  : 'border-slate-300 bg-white text-slate-500',
              )}
            >
              {index + 1}
            </span>
            <div className="min-w-0">
              <div
                className={cn(
                  'h-[2px] w-10 rounded-full',
                  active ? 'bg-emerald-600' : 'bg-slate-200',
                )}
              />
              <p className="mt-1 truncate text-[10px] font-semibold text-slate-500">
                {label}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SidebarCard({
  icon: Icon,
  title,
  description,
  children,
  className,
}: {
  icon: typeof Lightbulb;
  title: string;
  description: string;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'rounded-[18px] border border-emerald-100 bg-[linear-gradient(180deg,#f6fbf7_0%,#ffffff_100%)] p-4 shadow-[0_18px_30px_-28px_rgba(15,23,42,0.15)]',
        className,
      )}
    >
      <div className="flex items-start gap-3">
        <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-600 ring-1 ring-emerald-100">
          <Icon className="h-4.5 w-4.5" />
        </span>
        <div className="min-w-0">
          <p className="text-[12px] font-bold text-slate-900">{title}</p>
          <p className="mt-1 text-[11px] leading-5 text-slate-500">
            {description}
          </p>
        </div>
      </div>
      {children ? <div className="mt-4">{children}</div> : null}
    </div>
  );
}

function IntentTile({
  item,
  locale,
}: {
  item: IntentCard;
  locale: 'id' | 'en';
}) {
  const isOffer = item.key === 'offer';
  return (
    <Link
      href={item.href}
      className={cn(
        'group relative overflow-hidden rounded-[24px] border bg-white p-4 transition hover:-translate-y-0.5 hover:shadow-[0_20px_38px_-30px_rgba(15,23,42,0.2)]',
        isOffer
          ? 'border-emerald-300 shadow-[0_20px_38px_-34px_rgba(22,163,74,0.24)]'
          : 'border-slate-200 shadow-[0_20px_38px_-34px_rgba(15,23,42,0.18)]',
      )}
    >
      <span
        className={cn(
          'absolute left-4 top-4 inline-flex h-5 w-5 items-center justify-center rounded-full border-2 bg-white',
          isOffer
            ? 'border-emerald-500 text-emerald-500'
            : 'border-slate-300 text-slate-300',
        )}
      >
        <span
          className={cn(
            'h-2.5 w-2.5 rounded-full',
            isOffer ? 'bg-emerald-500' : 'bg-transparent',
          )}
        />
      </span>

      <div className="grid grid-cols-[96px_minmax(0,1fr)] gap-4 pl-4 pt-5">
        <div className="flex items-center justify-center">
          <div
            className={cn(
              'flex h-[120px] w-[120px] items-center justify-center rounded-[24px] border p-3',
              isOffer
                ? 'border-emerald-100 bg-emerald-50/70 text-emerald-600'
                : 'border-slate-100 bg-slate-50 text-slate-700',
            )}
          >
            <Image
              src={item.imageSrc}
              alt={locale === 'id' ? item.titleId : item.titleEn}
              width={112}
              height={112}
              className="h-full w-full rounded-full border border-white/80 object-cover shadow-sm"
              draggable={false}
            />
          </div>
        </div>

        <div className="min-w-0 pt-1">
          <h2 className="text-[16px] font-bold text-slate-900">
            {locale === 'id' ? item.titleId : item.titleEn}
          </h2>
          <p className="mt-2 max-w-md text-[13px] leading-6 text-slate-500">
            {locale === 'id' ? item.descriptionId : item.descriptionEn}
          </p>
          <div className="mt-4">
            <p className="text-[10px] font-semibold text-slate-500">Contoh:</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {item.examples.map(example => (
                <span
                  key={example}
                  className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-[11px] text-slate-600 shadow-[0_10px_18px_-16px_rgba(15,23,42,0.18)]"
                >
                  {example}
                </span>
              ))}
              <span className="inline-flex h-8 items-center rounded-full border border-slate-200 bg-white px-3 text-[11px] text-slate-500">
                +4 lainnya
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="text-[11px] font-semibold text-slate-500">
          {locale === 'id'
            ? 'Langsung ke form yang relevan'
            : 'Jump straight to the relevant form'}
        </div>
        <span
          className={cn(
            'inline-flex h-9 w-9 items-center justify-center rounded-full',
            isOffer ? 'bg-emerald-600 text-white' : 'bg-slate-900 text-white',
          )}
        >
          <ChevronRight className="h-4 w-4" />
        </span>
      </div>
    </Link>
  );
}

function MobileMock({ locale }: { locale: 'id' | 'en' }) {
  const offerHref = buildCreateBasePath({ locale, sideId: 'supply' });
  const findHref = buildCreateBasePath({ locale, sideId: 'demand' });
  return (
    <div className="hidden 2xl:block">
      <div className="mx-auto w-[372px] rounded-[34px] border border-slate-200 bg-white p-3 shadow-[0_28px_60px_-34px_rgba(15,23,42,0.3)]">
        <div className="rounded-[28px] border border-slate-100 bg-white p-4">
          <div className="flex items-center justify-between">
            <ChevronLeft className="h-5 w-5 text-slate-700" />
            <p className="text-[14px] font-bold text-slate-900">
              {locale === 'id' ? 'Buat Postingan' : 'Create Post'}
            </p>
            <span className="text-[11px] font-semibold text-emerald-600">
              {locale === 'id' ? 'Simpan Draft' : 'Save Draft'}
            </span>
          </div>

          <div className="mt-4">
            <Stepper locale={locale} />
          </div>

          <div className="mt-5 space-y-4">
            <IntentTile
              locale={locale}
              item={{
                key: 'offer',
                titleId: 'Saya Mau Menawarkan',
                titleEn: 'I Want To Offer',
                descriptionId:
                  'Tawarkan produk, jasa, atau peluang bisnis Anda kepada banyak orang.',
                descriptionEn:
                  'Offer products, services, or business opportunities to the right audience.',
                examples: OFFER_EXAMPLES,
                imageSrc: '/images/create/kategori/tawar.png',
                href: offerHref,
              }}
            />
            <IntentTile
              locale={locale}
              item={{
                key: 'find',
                titleId: 'Saya sedang membutuhkan',
                titleEn: 'I need something',
                descriptionId:
                  'Temukan supplier, partner, investor, atau peluang yang Anda butuhkan.',
                descriptionEn:
                  'Find suppliers, partners, investors, or the opportunity you need.',
                examples: FIND_EXAMPLES,
                imageSrc: '/images/create/kategori/cari.png',
                href: findHref,
              }}
            />
          </div>

          <div className="mt-4 rounded-[20px] border border-emerald-100 bg-emerald-50/50 p-3">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white text-emerald-600 ring-1 ring-emerald-100">
                <Target className="h-4.5 w-4.5" />
              </span>
              <div>
                <p className="text-[12px] font-bold text-slate-900">
                  {locale === 'id' ? 'Tujuan Bisnismu' : 'Your business goal'}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-slate-500">
                  {locale === 'id'
                    ? 'Menawarkan → Supplier. Form akan menyesuaikan otomatis.'
                    : 'Offering → Supplier. The form will adapt automatically.'}
                </p>
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-emerald-100">
                <Users className="h-4 w-4 text-emerald-600" />
              </span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-emerald-100">
                <BriefcaseBusiness className="h-4 w-4 text-emerald-600" />
              </span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-emerald-100">
                <Package className="h-4 w-4 text-emerald-600" />
              </span>
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white ring-1 ring-emerald-100 text-[11px] font-bold text-slate-500">
                +2
              </span>
            </div>
          </div>

          <Link
            href={offerHref}
            className="mt-4 inline-flex h-12 w-full items-center justify-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#16a34a,#0f7a38)] px-4 text-[13px] font-bold text-white shadow-[0_18px_30px_-22px_rgba(22,163,74,0.52)]"
          >
            {locale === 'id' ? 'Lanjutkan' : 'Continue'}
            <ArrowRight className="h-4 w-4" />
          </Link>

          <div className="mt-4 grid grid-cols-5 border-t border-slate-100 pt-3 text-center text-[10px] text-slate-500">
            {['Beranda', 'Jelajahi', 'Buat', 'Chat', 'Profil'].map(
              (label, index) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <span
                    className={cn(
                      'inline-flex h-6 w-6 items-center justify-center rounded-full',
                      index === 2
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-100 text-slate-500',
                    )}
                  >
                    {index === 2 ? '+' : '•'}
                  </span>
                  <span>{label}</span>
                </div>
              ),
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CreatePostingLanding() {
  const locale = useLocale() === 'en' ? 'en' : 'id';
  const offerHref = buildCreateBasePath({ locale, sideId: 'supply' });
  const findHref = buildCreateBasePath({ locale, sideId: 'demand' });

  const offerIntent: IntentCard = {
    key: 'offer',
    titleId: 'Saya Mau Menawarkan',
    titleEn: 'I Want To Offer',
    descriptionId:
      'Tawarkan produk, jasa, atau peluang bisnis Anda kepada banyak orang.',
    descriptionEn:
      'Offer products, services, or business opportunities to the right audience.',
    examples: OFFER_EXAMPLES,
    imageSrc: '/images/create/kategori/tawar.png',
    href: offerHref,
  };

  const findIntent: IntentCard = {
    key: 'find',
    titleId: 'Saya sedang membutuhkan',
    titleEn: 'I need something',
    descriptionId:
      'Temukan supplier, partner, investor, atau peluang yang Anda butuhkan.',
    descriptionEn:
      'Find suppliers, partners, investors, or the opportunity you need.',
    examples: FIND_EXAMPLES,
    imageSrc: '/images/create/kategori/cari.png',
    href: findHref,
  };

  return (
    <div className="min-h-screen bg-transparent px-3 py-3 sm:px-2 lg:px-6 lg:py-4">
      <div className="mx-auto max-w-[2000px]">
        <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_20px_50px_-44px_rgba(15,23,42,0.22)]">
          <div className="grid grid-cols-1 gap-0 border-b border-slate-100 px-4 py-4 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)_auto] lg:px-6 lg:py-5">
            <div className="flex items-center gap-3 border-b border-slate-100 pb-3 lg:border-b-0 lg:border-r lg:pr-6">
              <div className="flex h-12 w-12 items-center justify-center rounded-[16px] bg-emerald-600 text-white shadow-[0_16px_28px_-20px_rgba(22,163,74,0.55)]">
                <span className="text-[18px] font-bold leading-none">L</span>
              </div>
              <div>
                <p className="text-[18px] font-bold tracking-[-0.04em] text-slate-900">
                  Lajukan
                </p>
              </div>
            </div>

            <div className="min-w-0 px-0 py-4 lg:px-6 lg:py-0">
              <h1 className="text-[28px] font-bold tracking-[-0.04em] text-slate-900">
                {locale === 'id' ? 'Buat Postingan Baru' : 'Create New Posting'}
              </h1>
              <p className="mt-1 text-[13px] text-slate-500">
                {locale === 'id'
                  ? 'Ceritakan peluang atau kebutuhan bisnismu'
                  : 'Tell us about the opportunity or need behind your business'}
              </p>
              <div className="mt-5">
                <Stepper locale={locale} />
              </div>
            </div>

            <div className="flex items-center justify-start gap-3 pt-2 lg:justify-end lg:pt-0">
              <button
                type="button"
                className="inline-flex h-10 items-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[12px] font-semibold text-slate-700 shadow-[0_12px_22px_-18px_rgba(15,23,42,0.15)]"
              >
                <FileText className="h-4 w-4" />
                {locale === 'id' ? 'Simpan Draft' : 'Save Draft'}
              </button>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600"
                aria-label="close"
              >
                <ChevronLeft className="h-4 w-4 rotate-180" />
              </button>
            </div>
          </div>

          <div className="grid gap-4 px-4 py-4 lg:grid-cols-[180px_minmax(0,1fr)_300px] lg:px-4 lg:py-5 2xl:grid-cols-[180px_minmax(0,1fr)_300px_392px]">
            <aside className="hidden lg:flex lg:flex-col lg:gap-4">
              <SidebarCard
                icon={Lightbulb}
                title={
                  locale === 'id' ? 'Progres Postingan' : 'Posting progress'
                }
                description={
                  locale === 'id' ? 'Langkah 1 dari 6' : 'Step 1 of 6'
                }
              >
                <div className="rounded-full bg-slate-100">
                  <div className="h-1.5 w-1/6 rounded-full bg-emerald-600" />
                </div>
                <p className="mt-2 text-right text-[10px] font-semibold text-slate-500">
                  16%
                </p>
              </SidebarCard>

              <SidebarCard
                icon={Clock3}
                title={locale === 'id' ? 'Tips' : 'Tips'}
                description={
                  locale === 'id'
                    ? 'Semakin lengkap informasi yang Anda berikan, semakin besar peluang postingan dilihat.'
                    : 'The more complete your info, the better the chance your posting gets noticed.'
                }
              />

              <SidebarCard
                icon={ShieldCheck}
                title={
                  locale === 'id'
                    ? 'Draft tersimpan otomatis'
                    : 'Auto-saved draft'
                }
                description={
                  locale === 'id'
                    ? 'Terakhir disimpan 2 menit lalu'
                    : 'Last saved 2 minutes ago'
                }
              />

              <SidebarCard
                icon={Headphones}
                title={locale === 'id' ? 'Butuh bantuan?' : 'Need help?'}
                description={
                  locale === 'id'
                    ? 'Kami siap membantu Anda membuat postingan terbaik.'
                    : 'We can help you create the best posting.'
                }
                className="mt-auto"
              >
                <button
                  type="button"
                  className="inline-flex h-10 w-full items-center justify-center rounded-full bg-emerald-600 px-4 text-[12px] font-bold text-white shadow-[0_16px_28px_-20px_rgba(22,163,74,0.55)]"
                >
                  {locale === 'id' ? 'Hubungi CS' : 'Contact CS'}
                </button>
              </SidebarCard>
            </aside>

            <main className="min-w-0">
              <div className="rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_20px_38px_-34px_rgba(15,23,42,0.16)] lg:p-5">
                <div className="flex items-center gap-3">
                  <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                    <Target className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[18px] font-bold tracking-[-0.03em] text-slate-900">
                      {locale === 'id'
                        ? '1. Apa tujuan Anda hari ini?'
                        : '1. What is your purpose today?'}
                    </p>
                    <p className="mt-1 text-[13px] text-slate-500">
                      {locale === 'id'
                        ? 'Pilih tujuan utama agar kami dapat menyesuaikan form yang tepat untuk Anda.'
                        : 'Choose the main goal so we can adapt the form for you.'}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <IntentTile locale={locale} item={offerIntent} />
                  <IntentTile locale={locale} item={findIntent} />
                </div>

                <BusinessPlanAiLite />

                <div className="mt-5 rounded-[24px] border border-emerald-100 bg-[linear-gradient(180deg,#f8fff9_0%,#ffffff_100%)] p-4 shadow-[0_16px_30px_-30px_rgba(22,163,74,0.22)]">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-white text-emerald-600 ring-1 ring-emerald-100">
                      <Sparkles className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-[14px] font-bold text-slate-900">
                        {locale === 'id'
                          ? 'Tujuan Bisnismu'
                          : 'Your business direction'}
                      </p>
                      <p className="mt-1 text-[12px] text-slate-500">
                        {locale === 'id'
                          ? 'Menawarkan → Supplier'
                          : 'Offering → Supplier'}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 text-[12px] text-slate-500">
                    {locale === 'id'
                      ? 'Kategori dan detail yang jelas membantu postingan ditemukan oleh pihak yang relevan.'
                      : 'Clear categories and details help relevant people discover your post.'}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-3">
                    {['Pemilik UMKM', 'Distributor', 'Pabrik', 'Pebisnis'].map(
                      label => (
                        <div
                          key={label}
                          className="flex flex-col items-center gap-2"
                        >
                          <div className="h-12 w-12 rounded-full bg-slate-100" />
                          <span className="text-[10px] font-semibold text-slate-600">
                            {label}
                          </span>
                        </div>
                      ),
                    )}
                    <div className="flex items-center justify-center rounded-full border border-slate-200 bg-white px-3 text-[12px] font-bold text-slate-500">
                      +2
                    </div>
                  </div>
                </div>

                <div className="mt-5 flex justify-end">
                  <Link
                    href={offerHref}
                    className="inline-flex h-12 items-center gap-2 rounded-[14px] bg-[linear-gradient(135deg,#16a34a,#0f7a38)] px-6 text-[13px] font-bold text-white shadow-[0_18px_30px_-22px_rgba(22,163,74,0.5)]"
                  >
                    {locale === 'id' ? 'Lanjutkan' : 'Continue'}
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              </div>

              <div className="mt-5 rounded-[24px] border border-slate-200 bg-white p-4 shadow-[0_20px_38px_-34px_rgba(15,23,42,0.16)]">
                <p className="text-center text-[12px] font-semibold text-slate-900">
                  {locale === 'id'
                    ? 'Alur singkat untuk kebutuhan usaha'
                    : 'A focused flow for business needs'}
                </p>
                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  {[
                    [
                      locale === 'id' ? 'Tujuan jelas' : 'Clear purpose',
                      locale === 'id'
                        ? 'Pilih mencari atau menawarkan'
                        : 'Choose whether to seek or offer',
                    ],
                    [
                      locale === 'id' ? 'Form relevan' : 'Relevant form',
                      locale === 'id'
                        ? 'Pertanyaan mengikuti jenis kebutuhan'
                        : 'Questions adapt to the business need',
                    ],
                    [
                      locale === 'id' ? 'Draft terjaga' : 'Draft preserved',
                      locale === 'id'
                        ? 'Lanjutkan setelah masuk tanpa mengulang'
                        : 'Continue after sign-in without restarting',
                    ],
                    [
                      locale === 'id'
                        ? 'Siap dibandingkan'
                        : 'Ready to compare',
                      locale === 'id'
                        ? 'Detail penting lebih mudah dibaca vendor'
                        : 'Key details are easier for providers to review',
                    ],
                  ].map(([title, description]) => (
                    <div
                      key={title}
                      className="flex items-center gap-3 rounded-[18px] bg-slate-50 px-4 py-3"
                    >
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                        <CheckCircle2 className="h-4.5 w-4.5" />
                      </span>
                      <div>
                        <p className="text-[13px] font-bold text-slate-900">
                          {title}
                        </p>
                        <p className="text-[11px] leading-4 text-slate-500">
                          {description}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </main>

            <aside className="hidden xl:flex xl:flex-col xl:gap-4">
              <SidebarCard
                icon={ShieldCheck}
                title={
                  locale === 'id'
                    ? 'Mengapa pilih tujuan?'
                    : 'Why choose a purpose?'
                }
                description={
                  locale === 'id'
                    ? 'Form lebih relevan, hasil lebih tepat, dan lebih hemat waktu.'
                    : 'The form becomes more relevant, results are better, and it saves time.'
                }
              >
                <div className="space-y-3">
                  {[
                    {
                      icon: Users,
                      title:
                        locale === 'id'
                          ? 'Form lebih relevan'
                          : 'More relevant form',
                      desc:
                        locale === 'id'
                          ? 'Kami tampilkan pertanyaan yang sesuai dengan tujuan Anda.'
                          : 'We show only the questions that match your goal.',
                    },
                    {
                      icon: Sparkles,
                      title:
                        locale === 'id'
                          ? 'Hasil lebih tepat'
                          : 'Better results',
                      desc:
                        locale === 'id'
                          ? 'Postingan Anda akan lebih mudah ditemukan oleh orang yang tepat.'
                          : 'Your posting gets discovered by the right people more easily.',
                    },
                    {
                      icon: Clock3,
                      title: locale === 'id' ? 'Hemat waktu' : 'Save time',
                      desc:
                        locale === 'id'
                          ? 'Anda tidak perlu mengisi informasi yang tidak diperlukan.'
                          : 'You do not need to fill in unnecessary fields.',
                    },
                  ].map(item => {
                    const Icon = item.icon;
                    return (
                      <div key={item.title} className="flex gap-3">
                        <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-100">
                          <Icon className="h-4.5 w-4.5" />
                        </span>
                        <div className="min-w-0">
                          <p className="text-[12px] font-bold text-slate-900">
                            {item.title}
                          </p>
                          <p className="mt-1 text-[11px] leading-5 text-slate-500">
                            {item.desc}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </SidebarCard>

              <SidebarCard
                icon={Lightbulb}
                title={
                  locale === 'id' ? 'Tips Membuat Postingan' : 'Posting tips'
                }
                description={
                  locale === 'id'
                    ? 'Langkah sederhana untuk hasil lebih baik.'
                    : 'Simple steps for better results.'
                }
              >
                <div className="space-y-2 text-[12px] text-slate-600">
                  {[
                    locale === 'id'
                      ? 'Gunakan judul yang jelas dan spesifik'
                      : 'Use a clear and specific title',
                    locale === 'id'
                      ? 'Lengkapi informasi bisnis Anda'
                      : 'Complete your business details',
                    locale === 'id'
                      ? 'Tambahkan foto berkualitas'
                      : 'Add high-quality photos',
                    locale === 'id'
                      ? 'Cantumkan lokasi dengan tepat'
                      : 'Set the location accurately',
                    locale === 'id'
                      ? 'Respon pesan dengan cepat'
                      : 'Respond quickly to messages',
                  ].map(item => (
                    <div key={item} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
              </SidebarCard>

              <SidebarCard
                icon={Bell}
                title={locale === 'id' ? 'Aman & Terpercaya' : 'Safe & trusted'}
                description={
                  locale === 'id'
                    ? 'Lajukan melindungi data dan privasi bisnis Anda dengan enkripsi tingkat tinggi.'
                    : 'Lajukan protects your business data and privacy with strong encryption.'
                }
              >
                <Link
                  href={offerHref}
                  className="inline-flex items-center gap-2 text-[12px] font-semibold text-emerald-700"
                >
                  {locale === 'id'
                    ? 'Lebih lanjut tentang keamanan'
                    : 'Learn more about safety'}
                  <ChevronRight className="h-4 w-4" />
                </Link>
              </SidebarCard>
            </aside>

            <MobileMock locale={locale} />
          </div>
        </section>
      </div>
    </div>
  );
}
