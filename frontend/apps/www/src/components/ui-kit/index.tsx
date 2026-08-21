import React from 'react';
import Link, { LinkProps } from 'next/link';
import {
  AlertCircle,
  Angry,
  ArrowLeft,
  Bell,
  Briefcase,
  Calendar,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  CircleArrowLeft,
  Compass,
  Cpu,
  CreditCard,
  FileText,
  Folder,
  Frown,
  Globe,
  Heart,
  HelpCircle,
  Home,
  Info,
  Laugh,
  LayoutGrid,
  List,
  Lock,
  LogOut,
  LucideIcon,
  Menu,
  MessageCircle,
  MessageCircleMore,
  MessagesSquare,
  Moon,
  Plane,
  Play,
  Plus,
  Search,
  Send,
  Settings,
  Smile,
  Star,
  Sticker,
  Store,
  Sun,
  ThumbsUp,
  Ticket,
  User,
  Users,
  X,
  Zap,
} from 'lucide-react';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any> & { id?: React.Key };
const DEFAULT_CARD_IMAGE = '/images/placeholders/content-default.svg';

export enum IconEnum {
  AlertCircle = 'AlertCircle',
  Angry = 'Angry',
  ArrowLeft = 'ArrowLeft',
  Bell = 'Bell',
  Briefcase = 'Briefcase',
  Calendar = 'Calendar',
  Check = 'Check',
  CheckCircle = 'CheckCircle',
  ChevronDown = 'ChevronDown',
  ChevronRight = 'ChevronRight',
  CircleArrowLeft = 'CircleArrowLeft',
  Close = 'Close',
  Compass = 'Compass',
  Cpu = 'Cpu',
  CreditCard = 'CreditCard',
  FileText = 'FileText',
  Folder = 'Folder',
  Freelance = 'Freelance',
  Frown = 'Frown',
  Globe = 'Globe',
  Heart = 'Heart',
  HelpCircle = 'HelpCircle',
  Home = 'Home',
  Info = 'Info',
  Jobs = 'Jobs',
  Laugh = 'Laugh',
  LayoutGrid = 'LayoutGrid',
  List = 'List',
  Lock = 'Lock',
  LogOut = 'LogOut',
  Menu = 'Menu',
  MessageCircle = 'MessageCircle',
  MessageCircleMore = 'MessageCircleMore',
  MessagesSquare = 'MessagesSquare',
  Moon = 'Moon',
  Play = 'Play',
  Plus = 'Plus',
  Property = 'Property',
  Search = 'Search',
  Send = 'Send',
  Settings = 'Settings',
  Smile = 'Smile',
  Star = 'Star',
  Sticker = 'Sticker',
  Store = 'Store',
  Sun = 'Sun',
  ThumbsUp = 'ThumbsUp',
  Ticket = 'Ticket',
  Travel = 'Travel',
  User = 'User',
  Users = 'Users',
  Zap = 'Zap',
}

const ICON_MAP: Record<string, LucideIcon> = {
  [IconEnum.AlertCircle]: AlertCircle,
  [IconEnum.Angry]: Angry,
  [IconEnum.ArrowLeft]: ArrowLeft,
  [IconEnum.Bell]: Bell,
  [IconEnum.Briefcase]: Briefcase,
  [IconEnum.Calendar]: Calendar,
  [IconEnum.Check]: Check,
  [IconEnum.CheckCircle]: CheckCircle,
  [IconEnum.ChevronDown]: ChevronDown,
  [IconEnum.ChevronRight]: ChevronRight,
  [IconEnum.CircleArrowLeft]: CircleArrowLeft,
  [IconEnum.Close]: X,
  [IconEnum.Compass]: Compass,
  [IconEnum.Cpu]: Cpu,
  [IconEnum.CreditCard]: CreditCard,
  [IconEnum.FileText]: FileText,
  [IconEnum.Folder]: Folder,
  [IconEnum.Freelance]: Briefcase,
  [IconEnum.Frown]: Frown,
  [IconEnum.Globe]: Globe,
  [IconEnum.Heart]: Heart,
  [IconEnum.HelpCircle]: HelpCircle,
  [IconEnum.Home]: Home,
  [IconEnum.Info]: Info,
  [IconEnum.Jobs]: Briefcase,
  [IconEnum.Laugh]: Laugh,
  [IconEnum.LayoutGrid]: LayoutGrid,
  [IconEnum.List]: List,
  [IconEnum.Lock]: Lock,
  [IconEnum.LogOut]: LogOut,
  [IconEnum.Menu]: Menu,
  [IconEnum.MessageCircle]: MessageCircle,
  [IconEnum.MessageCircleMore]: MessageCircleMore,
  [IconEnum.MessagesSquare]: MessagesSquare,
  [IconEnum.Moon]: Moon,
  [IconEnum.Play]: Play,
  [IconEnum.Plus]: Plus,
  [IconEnum.Property]: Home,
  [IconEnum.Search]: Search,
  [IconEnum.Send]: Send,
  [IconEnum.Settings]: Settings,
  [IconEnum.Smile]: Smile,
  [IconEnum.Star]: Star,
  [IconEnum.Sticker]: Sticker,
  [IconEnum.Store]: Store,
  [IconEnum.Sun]: Sun,
  [IconEnum.ThumbsUp]: ThumbsUp,
  [IconEnum.Ticket]: Ticket,
  [IconEnum.Travel]: Plane,
  [IconEnum.User]: User,
  [IconEnum.Users]: Users,
  [IconEnum.Zap]: Zap,
};

type IconProps = React.ComponentProps<'svg'> & {
  name: IconEnum | string;
};

export function Icon({ name, className, ...rest }: IconProps) {
  const IconComponent = ICON_MAP[name] || AlertCircle;
  return <IconComponent className={className} {...rest} />;
}

type LocalizedLinkProps = Omit<
  React.AnchorHTMLAttributes<HTMLAnchorElement>,
  'href'
> &
  Omit<LinkProps, 'href'> & {
    href: LinkProps['href'];
    locale?: string;
    passHref?: boolean;
  };

function applyLocaleToHref(href: LinkProps['href'], locale?: string) {
  if (!locale || typeof href !== 'string') return href;
  if (!href.startsWith('/')) return href;
  if (href === '/') return `/${locale}`;
  if (href.startsWith(`/${locale}/`) || href === `/${locale}`) return href;
  return `/${locale}${href}`;
}

export function LocalizedLink({
  href,
  locale,
  passHref: _passHref,
  ...props
}: LocalizedLinkProps) {
  void _passHref;
  return <Link href={applyLocaleToHref(href, locale)} {...props} />;
}

type BottomNavItem = {
  href: string;
  iconName?: IconEnum | string;
  label: string;
  badge?: number;
};

type BottomNavProps = {
  items: BottomNavItem[];
  currentPath?: string;
  className?: string;
  padding?: string;
  shadow?: string;
};

export function BottomNav({
  items,
  currentPath,
  className,
  padding = 'p-1 max-[320px]:px-1 max-[320px]:py-1 min-[360px]:p-2',
  shadow = '',
}: BottomNavProps) {
  return (
    <nav
      className={[
        'fixed bottom-0 left-0 right-0 z-50 overflow-x-hidden border-t border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_95%,_transparent)]  dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_95%,_transparent)] lg:hidden',
        padding,
        shadow,
        className,
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <ul className="mx-auto flex max-w-3xl items-center justify-around gap-0.5 min-[360px]:gap-1">
        {items.map(item => {
          const active =
            !!currentPath &&
            normalizePath(item.href) === normalizePath(currentPath);
          const badgeCount = Math.max(0, Math.floor(item.badge || 0));
          return (
            <li key={`${item.href}-${item.label}`} className="min-w-0 flex-1">
              <LocalizedLink
                href={item.href}
                aria-label={item.label}
                className={[
                  'relative z-10 flex min-h-[40px] w-full touch-manipulation select-none flex-col items-center justify-center gap-0.5 rounded-xl px-0.5 py-1 text-[10px] font-semibold leading-none transition max-[320px]:min-h-[38px] min-[360px]:min-h-[44px] min-[360px]:gap-1 min-[360px]:px-2 min-[360px]:py-1.5 min-[360px]:text-[11px]',
                  active
                    ? 'bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_80%,_transparent)] text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]'
                    : 'text-[color:var(--app-text)] hover:text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] dark:hover:text-[color:var(--app-text-soft)]',
                ].join(' ')}
              >
                <Icon
                  name={item.iconName || IconEnum.Home}
                  className="pointer-events-none h-4 w-4 min-[360px]:h-5 min-[360px]:w-5"
                />
                {badgeCount > 0 ? (
                  <span className="pointer-events-none absolute right-1.5 top-1.5 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-[color:var(--app-danger)] px-1 text-[9px] font-bold text-[color:var(--app-text-inverse)] min-[360px]:right-2 min-[360px]:top-2">
                    {badgeCount > 99 ? '99+' : badgeCount}
                  </span>
                ) : null}
                <span className="pointer-events-none truncate max-[320px]:hidden">
                  {item.label}
                </span>
                {active ? (
                  <span className="pointer-events-none h-1 w-1 rounded-full bg-[color:var(--app-accent)] min-[360px]:h-1.5 min-[360px]:w-1.5" />
                ) : null}
              </LocalizedLink>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function normalizePath(path: string) {
  if (!path) return '/';
  const cleaned = path.replace(/^\/(id|en)(?=\/|$)/, '');
  return cleaned === '' ? '/' : cleaned;
}

export function HeroSection() {
  return (
    <section className="relative overflow-hidden rounded-[1.75rem] border border-[color:var(--app-accent-border)] bg-gradient-to-br from-[color:var(--app-accent-soft)] via-[color:var(--app-surface-strong)] to-[color:color-mix(in_srgb,_var(--app-info-soft)_60%,_transparent)] p-5 sm:p-7 dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_50%,_transparent)] dark:from-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)] dark:via-[color:var(--app-surface-strong)] dark:to-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)]">
      <div className="absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] blur-3xl" />
      <div className="absolute -bottom-20 left-1/2 h-48 w-48 rounded-full bg-[color:color-mix(in_srgb,_var(--app-info)_20%,_transparent)] blur-3xl" />
      <div className="relative">
        <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-[color:var(--app-accent)] dark:text-[color:var(--app-accent)]">
          Lajukan Workspace
        </p>
        <h1 className="mt-2 text-2xl font-bold tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-3xl">
          Cari, pilih, chat, jalan.
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          Langsung dipakai dari mobile atau desktop.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <span className="rounded-full border border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] px-3 py-1 text-[11px] font-bold text-[color:var(--app-accent)] dark:border-[color:var(--app-accent-border)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] dark:text-[color:var(--app-accent)]">
            Search cepat
          </span>
          <span className="rounded-full border border-[color:var(--app-info-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] px-3 py-1 text-[11px] font-bold text-[color:var(--app-info)] dark:border-[color:var(--app-info-border)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] dark:text-[color:var(--app-info)]">
            Chat instan
          </span>
          <span className="rounded-full border border-[color:var(--app-info-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] px-3 py-1 text-[11px] font-bold text-[color:var(--app-info)] dark:border-[color:var(--app-info-border)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_30%,_transparent)] dark:text-[color:var(--app-info)]">
            Workflow ringkas
          </span>
        </div>
      </div>
    </section>
  );
}

export function CategorySection() {
  return (
    <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
      <h2 className="text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        Categories
      </h2>
      <p className="mt-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
        Browse sectors and content types from one place.
      </p>
    </section>
  );
}

export function ProblemSection() {
  return (
    <section className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-6 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
      <h2 className="text-lg font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        Why Lajukan
      </h2>
      <p className="mt-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
        Fewer disconnected tools, better execution speed.
      </p>
    </section>
  );
}

export function BalanceDashboard({ user, t }: AnyRecord) {
  const username =
    user?.fullName ||
    user?.full_name ||
    user?.username ||
    user?.email ||
    'User';
  return (
    <section className="rounded-3xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] p-6 dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_50%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_20%,_transparent)]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
        {safeTranslate(t, 'welcomeBack', 'Welcome back')}
      </p>
      <h2 className="mt-1 text-2xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {username}
      </h2>
      <p className="mt-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
        {safeTranslate(t, 'dashboardReady', 'Your workspace is ready.')}
      </p>
    </section>
  );
}

export function IndustryCard(props: AnyRecord) {
  const title = props.title || props.nama || 'Industry';
  const description = props.description || props.desc || 'Explore this sector';
  const count = props.sectors_count || props.count;
  const variant = props.variant === 'list' ? 'list' : 'grid';
  const content = (
    <div
      className={[
        'rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 transition hover:-translate-y-0.5 hover:shadow-md dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]',
        props.bgClass || '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          {props.icon || <LayoutGrid className="h-5 w-5" />}
        </div>
        {count ? (
          <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-1 text-[10px] font-bold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
            {count}
          </span>
        ) : null}
      </div>
      <h3 className="mt-3 text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {title}
      </h3>
      {variant === 'list' ? (
        <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          {description}
        </p>
      ) : null}
    </div>
  );

  if (props.href) {
    return (
      <LocalizedLink href={props.href} className="block">
        {content}
      </LocalizedLink>
    );
  }

  return content;
}

function safeTranslate(t: unknown, key: string, fallback: string): string {
  if (typeof t !== 'function') return fallback;
  try {
    const value = t(key);
    return typeof value === 'string' && value.trim() ? value : fallback;
  } catch {
    return fallback;
  }
}

type GenericCardProps = AnyRecord;

function extractTitle(props: GenericCardProps): string {
  return (
    props.title ||
    props.name ||
    props.label ||
    props.user?.name ||
    props.company ||
    props.source ||
    'Untitled'
  );
}

function extractSubtitle(props: GenericCardProps): string {
  return (
    props.subtitle ||
    props.tagline ||
    props.summary ||
    props.description ||
    props.user?.tagline ||
    props.location ||
    props.seller_type ||
    props.work_mode ||
    props.type ||
    ''
  );
}

function extractImage(props: GenericCardProps): string | undefined {
  return (
    props.image ||
    props.logo ||
    props.thumbnail ||
    props.coverImage?.src ||
    props.avatar?.src ||
    props.user?.avatar?.src ||
    props.user?.coverImage?.src
  );
}

function extractHref(props: GenericCardProps): string | undefined {
  return (
    props.href || props.link || (props.slug ? `/${props.slug}` : undefined)
  );
}

function extractMeta(props: GenericCardProps): string[] {
  const values = [
    props.price,
    props.salary,
    props.level,
    props.category,
    props.type,
    props.content_type,
    props.seller_type,
    props.work_mode,
    props.price_unit,
    props.stock ? `${props.stock} stock` : undefined,
    props.minimum_order,
    props.status,
    props.location,
    props.rating ? `Rating ${props.rating}` : undefined,
  ];
  return values.filter(
    (value): value is string =>
      typeof value === 'string' && value.trim().length > 0,
  );
}

function GenericCard({ kind, ...props }: GenericCardProps & { kind: string }) {
  const title = extractTitle(props);
  const subtitle = extractSubtitle(props);
  const image = extractImage(props);
  const href = extractHref(props);
  const meta = extractMeta(props);
  const imageSrc = image || DEFAULT_CARD_IMAGE;
  const badge = props.content_type || props.type || kind;
  const highlight = props.seller_type || props.work_mode || props.price_unit;

  const body = (
    <article className="relative min-w-0 overflow-hidden rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-32px_rgba(15,23,42,0.24)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
      <img
        src={imageSrc}
        alt={title}
        className="aspect-[4/3] h-auto w-full object-cover sm:aspect-[5/4]"
        loading="lazy"
        onError={event => {
          const target = event.currentTarget;
          if (target.src.endsWith(DEFAULT_CARD_IMAGE)) return;
          target.src = DEFAULT_CARD_IMAGE;
        }}
      />
      <div className="pointer-events-none absolute left-2 top-2 flex max-w-[calc(100%-1rem)] flex-wrap gap-1">
        <span className="rounded-full bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_88%,_transparent)] px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.08em] text-[color:var(--app-text)] shadow-sm  dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_88%,_transparent)] dark:text-[color:var(--app-text-soft)]">
          {badge}
        </span>
        {highlight ? (
          <span className="rounded-full bg-[color:var(--app-accent-soft)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-accent)] shadow-sm">
            {highlight}
          </span>
        ) : null}
      </div>
      <div className="min-w-0 space-y-1.5 p-2.5 sm:p-3">
        <h3 className="line-clamp-2 text-[0.82rem] font-bold leading-snug text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-sm">
          {title}
        </h3>
        {subtitle ? (
          <p className="line-clamp-1 text-[11px] leading-4 text-[color:var(--app-text-soft)] sm:line-clamp-2 sm:text-xs">
            {subtitle}
          </p>
        ) : null}
        {meta.length ? (
          <div className="flex min-w-0 flex-wrap gap-1 overflow-hidden">
            {meta.slice(0, 4).map(item => (
              <span
                key={item}
                className="min-w-0 truncate rounded-full bg-[color:var(--app-surface-muted)] px-1.5 py-0.5 text-[10px] font-semibold text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface-strong)]"
              >
                {item}
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </article>
  );

  if (href) {
    return (
      <LocalizedLink href={href} className="block">
        {body}
      </LocalizedLink>
    );
  }

  return body;
}

function makeCard(kind: string) {
  return function BuiltCard(props: GenericCardProps) {
    return <GenericCard kind={kind} {...props} />;
  };
}

export const CourseCard = makeCard('Course');
export const FinancialCard = makeCard('Financial');
export const FitnessCard = makeCard('Fitness');
export const FreelancerCard = makeCard('Freelancer');
export const GameAssetCard = makeCard('Game Asset');
export const JobCard = makeCard('Job');
export const MicroGigCard = makeCard('Micro Gig');
export const PostCard = makeCard('Post');
export const ProductCard = makeCard('Product');
export const PropertyCard = makeCard('Property');
export const TravelCard = makeCard('Travel');
export const VendorCard = makeCard('Vendor');
export const FeatureCard = makeCard('Feature');

export function PropertyDetail({
  property,
  onBack,
}: {
  property?: AnyRecord;
  onBack?: () => void;
}) {
  const p = property || {};
  const title = p.title || 'Property Detail';
  const location = p.location || 'Unknown location';
  const price = p.price || '-';
  const images =
    Array.isArray(p.images) && p.images.length
      ? p.images
      : [p.image || DEFAULT_CARD_IMAGE].filter(Boolean);
  const features = Array.isArray(p.features) ? p.features : [];

  return (
    <section className="mx-auto max-w-5xl space-y-6 px-4 py-6">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      ) : null}

      {images[0] ? (
        <img
          src={images[0]}
          alt={title}
          className="h-72 w-full rounded-2xl border border-[color:var(--app-border)] object-cover dark:border-[color:var(--app-border-strong)]"
          onError={event => {
            const target = event.currentTarget;
            if (target.src.endsWith(DEFAULT_CARD_IMAGE)) return;
            target.src = DEFAULT_CARD_IMAGE;
          }}
        />
      ) : null}

      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <h1 className="text-2xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          {location}
        </p>
        <p className="mt-3 text-lg font-bold text-[color:var(--app-accent)]">{price}</p>
        {p.description ? (
          <div className="mt-4 space-y-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {Array.isArray(p.description) ? (
              p.description.map((line: string) => <p key={line}>{line}</p>)
            ) : (
              <p>{p.description}</p>
            )}
          </div>
        ) : null}
        {features.length ? (
          <ul className="mt-4 flex flex-wrap gap-2">
            {features.map((feature: string) => (
              <li
                key={feature}
                className="rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]"
              >
                {feature}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export function JobDetail({
  job,
  onBack,
}: {
  job?: AnyRecord;
  onBack?: () => void;
}) {
  const j = job || {};
  const title = j.title || 'Job Detail';
  const company = j.company || 'Company';
  const location = j.location || 'Remote';
  const salary = j.salary || '-';
  const description = Array.isArray(j.description)
    ? j.description
    : [j.description].filter(Boolean);
  const requirements = Array.isArray(j.requirements) ? j.requirements : [];

  return (
    <section className="mx-auto max-w-4xl space-y-6 px-4 py-6">
      {onBack ? (
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:bg-[color:var(--app-surface-strong)]"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </button>
      ) : null}

      <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <h1 className="text-2xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {title}
        </h1>
        <p className="mt-1 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          {company}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1 text-xs font-semibold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
            {location}
          </span>
          <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_20%,_transparent)] dark:text-[color:var(--app-accent)]">
            {salary}
          </span>
        </div>
        {description.length ? (
          <div className="mt-4 space-y-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {description.map((line: string) => (
              <p key={line}>{line}</p>
            ))}
          </div>
        ) : null}
        {requirements.length ? (
          <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {requirements.map((item: string) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        ) : null}
      </div>
    </section>
  );
}

export type CourseCardProps = AnyRecord;
export type FinancialCardProps = AnyRecord;
export type FitnessCardProps = AnyRecord;
export type GameAssetCardProps = AnyRecord;
export type MicroGigCardProps = AnyRecord;
export type PostCardProps = AnyRecord;
export type TravelCardProps = AnyRecord;
export type VendorCardProps = AnyRecord;
