'use client';

import {
  ArrowRight,
  CircleAlert,
  Database,
  ExternalLink,
  MapPin,
  PackageSearch,
  ShieldCheck,
} from 'lucide-react';

import { CompactSeeAllButton } from '@/components/common/CompactSectionAction';
import { EmblaDesktopControls } from '@/components/common/EmblaDesktopControls';
import { useExploreEmblaRail } from '@/components/explore/ExploreVisualSystem';
import { ExploreCardMedia } from '@/components/explore/cards/ExploreCardMedia';
import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';
import { BusinessSearchCard } from '@/components/search/result-cards/BusinessSearchCard';
import { CommunitySearchCard } from '@/components/search/result-cards/CommunitySearchCard';
import { NeedSearchCard } from '@/components/search/result-cards/NeedSearchCard';
import { ProductSearchCard } from '@/components/search/result-cards/ProductSearchCard';
import { ServiceSearchCard } from '@/components/search/result-cards/ServiceSearchCard';
import { UserSearchCard } from '@/components/search/result-cards/UserSearchCard';
import { VideoSearchCard } from '@/components/search/result-cards/VideoSearchCard';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import type { LajukanLocale } from '@/lib/discovery/lajukanCategories';
import { getZeroResultRecovery } from '@/lib/discovery/exploreResultConversion';
import type {
  GlobalSearchGroup,
  GlobalSearchGroupKey,
  GlobalSearchItem,
  GlobalSearchResponse,
  GlobalSearchTab,
} from '@/lib/search/globalSearch';
import { cn } from '@/lib/utils';

const SEARCH_GROUPS: GlobalSearchGroupKey[] = [
  'products', 'services', 'businesses', 'references', 'needs', 'communities', 'videos', 'users',
];
const DEFAULT_SEARCH_GROUPS: GlobalSearchGroupKey[] = ['products', 'services', 'businesses'];
const SUPPLY_RESULT_TABS: GlobalSearchTab[] = ['all', 'products', 'services', 'businesses'];
const DEDICATED_TABS = new Set<GlobalSearchTab>(['needs', 'users', 'references']);

const SEARCH_GROUP_COPY: Record<GlobalSearchGroupKey, { labelId: string; labelEn: string; descriptionId: string; descriptionEn: string }> = {
  products: { labelId: 'Produk', labelEn: 'Products', descriptionId: 'Produk, bahan, stok, dan alat yang bisa kamu bandingkan.', descriptionEn: 'Materials, stock, tools, and goods you can compare.' },
  services: { labelId: 'Jasa', labelEn: 'Services', descriptionId: 'Jasa untuk kebutuhan operasional, kreatif, teknis, dan usaha.', descriptionEn: 'Operational, creative, technical, and business services.' },
  businesses: { labelId: 'Usaha', labelEn: 'Businesses', descriptionId: 'Toko, UMKM, dan usaha yang sesuai dengan pencarianmu.', descriptionEn: 'Relevant stores, MSMEs, and provider profiles.' },
  references: { labelId: 'Lokasi Usaha', labelEn: 'Public data references', descriptionId: 'Referensi lokasi usaha dari data publik yang sumbernya bisa diperiksa.', descriptionEn: 'Non-transactional locations with a source and license you can inspect.' },
  needs: { labelId: 'Kebutuhan Pembeli', labelEn: 'Needs', descriptionId: 'Orang atau usaha yang sedang mencari produk, jasa, atau penyedia.', descriptionEn: 'Active requests from buyers or seekers.' },
  communities: { labelId: 'Komunitas', labelEn: 'Communities', descriptionId: 'Grup dan diskusi untuk belajar, tanya jawab, dan jejaring.', descriptionEn: 'Groups and discussions for learning and networking.' },
  videos: { labelId: 'Video', labelEn: 'Videos', descriptionId: 'Konten singkat untuk inspirasi dan edukasi usaha.', descriptionEn: 'Short content for business inspiration and education.' },
  users: { labelId: 'Orang & Keahlian', labelEn: 'Users', descriptionId: 'Profil pelaku usaha, penjual, freelancer, dan keahlian yang bisa kamu lihat.', descriptionEn: 'People and business owner profiles you can inspect.' },
};

function ResultTypeTabs({ payload, activeTab, locale, onSelectTab }: { payload: GlobalSearchResponse; activeTab: GlobalSearchTab; locale: LajukanLocale; onSelectTab?: (tab: GlobalSearchTab) => void }) {
  if (!onSelectTab || DEDICATED_TABS.has(activeTab)) return null;
  const isId = locale === 'id';
  const tabs = SUPPLY_RESULT_TABS.filter(tab => tab === 'all' || Boolean(payload.groups[tab as GlobalSearchGroupKey]?.available && (payload.groups[tab as GlobalSearchGroupKey].total > 0 || tab === activeTab)));
  if (tabs.length <= 1) return null;
  return (
    <div className="mt-3 rounded-[16px] border border-zinc-200/80 bg-white p-2 dark:border-zinc-800 dark:bg-zinc-950 sm:p-2.5">
      <div className="flex items-center justify-between gap-3 px-1 pb-2">
        <p className="text-[10px] font-bold text-zinc-500 dark:text-zinc-400 sm:text-[11px]">{isId ? 'Jenis hasil' : 'Result type'}</p>
        {activeTab !== 'all' ? <button type="button" onClick={() => onSelectTab('all')} className="text-[10px] font-bold text-emerald-700 hover:underline dark:text-emerald-400 sm:text-[11px]">{isId ? 'Semua hasil' : 'All results'}</button> : null}
      </div>
      <div role="tablist" aria-label={isId ? 'Jenis hasil pencarian' : 'Search result type'} className="flex min-w-0 flex-wrap gap-1.5">
        {tabs.map(tab => {
          const active = activeTab === tab;
          const count = tab === 'all' ? DEFAULT_SEARCH_GROUPS.reduce((total, key) => total + (payload.groups[key]?.total || 0), 0) : payload.groups[tab as GlobalSearchGroupKey]?.total || 0;
          const label = tab === 'all' ? (isId ? 'Semua hasil' : 'All results') : (isId ? SEARCH_GROUP_COPY[tab as GlobalSearchGroupKey].labelId : SEARCH_GROUP_COPY[tab as GlobalSearchGroupKey].labelEn);
          return <button key={tab} type="button" role="tab" aria-selected={active ? true : undefined} onClick={() => onSelectTab(tab)} className={cn('inline-flex min-h-9 max-w-full items-center gap-1.5 rounded-[10px] border px-2.5 text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500/25', active ? 'border-zinc-950 bg-zinc-950 text-white shadow-sm dark:border-white dark:bg-white dark:text-zinc-950' : 'border-zinc-200 bg-white text-zinc-500 shadow-none hover:border-zinc-300 hover:text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-400 dark:hover:border-zinc-700 dark:hover:text-white')}><span className="truncate">{label}</span><span className={cn('rounded-full px-1.5 py-0.5 text-[9px] tabular-nums', active ? 'bg-emerald-400 text-zinc-950 dark:bg-emerald-500' : 'bg-zinc-100 text-zinc-400 dark:bg-zinc-900 dark:text-zinc-500')}>{count.toLocaleString(isId ? 'id-ID' : 'en-US')}</span></button>;
        })}
      </div>
    </div>
  );
}

function ReferenceNextBatchAction({ cursor, isId, onNextCursor }: { cursor: string; isId: boolean; onNextCursor: (cursor: string) => void }) {
  return <div className="mt-5 flex flex-col items-start gap-2 border-t border-[color:var(--app-border)] pt-4 sm:flex-row sm:items-center sm:justify-between"><p className="text-[11px] leading-5 text-[color:var(--app-text-soft)]">{isId ? 'Daftar berikutnya akan mengganti hasil saat ini agar halaman tetap ringan.' : 'The next batch replaces the current results to keep this page lightweight.'}</p><button type="button" onClick={() => onNextCursor(cursor)} className="inline-flex min-h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-lg bg-[color:var(--app-accent)] px-4 text-xs font-black text-white">{isId ? 'Muat berikutnya' : 'Load next'}<ArrowRight className="h-4 w-4" aria-hidden="true" /></button></div>;
}

function metadataText(item: GlobalSearchItem, key: string): string { const value = item.metadata[key]; return typeof value === 'string' ? value.trim() : ''; }
function safeExternalHref(value: string): string { try { const url = new URL(value); return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : ''; } catch { return ''; } }
function hasCompleteReferenceProvenance(item: GlobalSearchItem): boolean { return item.kind !== 'references' || Boolean(item.metadata.isTransactional === false && metadataText(item, 'sourceTitle') && safeExternalHref(metadataText(item, 'sourceUrl')) && metadataText(item, 'sourceLicense') && safeExternalHref(metadataText(item, 'sourceLicenseUrl'))); }

function PublicReferenceCard({ item, locale }: { item: GlobalSearchItem; locale: LajukanLocale }) {
  const isId = locale === 'id';
  const sourceTitle = metadataText(item, 'sourceTitle');
  const sourceUrl = safeExternalHref(metadataText(item, 'sourceUrl'));
  const sourceLicense = metadataText(item, 'sourceLicense');
  const sourceLicenseUrl = safeExternalHref(metadataText(item, 'sourceLicenseUrl'));
  const imageAttribution = metadataText(item, 'imageAttribution');
  const imageSourceUrl = safeExternalHref(metadataText(item, 'imageSourceUrl'));
  const distanceKm = item.metadata.distanceKm;
  const distanceLabel = typeof distanceKm === 'number' && Number.isFinite(distanceKm) ? `${distanceKm.toLocaleString(isId ? 'id-ID' : 'en-US', { maximumFractionDigits: 1 })} km` : '';
  return (
    <article data-testid="public-reference-card" className="flex h-full min-w-0 flex-col overflow-hidden rounded-[18px] border border-amber-200/80 bg-[color:var(--app-surface-strong)] dark:border-amber-900/60">
      <div className="relative"><Link href={item.href} className="block"><ExploreCardMedia src={item.image} alt={item.title} attribution={imageAttribution} sourceHref={imageSourceUrl || undefined} fallbackLabel={isId ? 'Lokasi usaha dari data publik' : 'Business location from public data'} className="aspect-[16/9] w-full" /></Link><span className="absolute left-2 top-2 inline-flex min-h-7 items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50/95 px-2.5 text-[10px] font-black text-amber-900"><Database className="h-3.5 w-3.5" aria-hidden="true" />{isId ? 'Data lokasi publik' : 'Public location data'}</span></div>
      <div className="flex min-w-0 flex-1 flex-col p-3"><div className="flex min-w-0 items-center gap-2 text-[11px] font-bold text-[color:var(--app-text-soft)]"><span className="truncate">{item.label}</span>{distanceLabel ? <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-[color:var(--app-accent)]"><MapPin className="h-3.5 w-3.5" />{distanceLabel}</span> : null}</div><Link href={item.href} className="mt-1.5"><h3 className="line-clamp-2 min-h-10 text-sm font-bold leading-5 text-[color:var(--app-text)]">{item.title}</h3></Link>{item.location ? <p className="mt-1.5 flex min-w-0 items-center gap-1.5 text-[11px] font-medium text-[color:var(--app-text-soft)]"><MapPin className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{item.location}</span></p> : null}{item.summary ? <p className="mt-2 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">{item.summary}</p> : null}<p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-2 text-[10px] font-semibold leading-4 text-amber-950 dark:border-amber-900/70 dark:bg-amber-950/40 dark:text-amber-100">{isId ? 'Bukan toko atau penawaran aktif di Lajukan. Gunakan untuk melihat lokasi; stok, harga, kontak, dan status usaha perlu dicek lagi.' : 'Not a Lajukan store or offer. Activity, ownership, stock, price, contact details, and verification are not implied.'}</p><div className="mt-auto grid gap-1.5 pt-3 text-[10px] font-bold">{sourceTitle && sourceUrl ? <a href={sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[color:var(--app-border)] px-2"><Database className="h-3.5 w-3.5" /><span className="truncate">{isId ? 'Sumber: ' : 'Source: '}{sourceTitle}</span><ExternalLink className="ml-auto h-3 w-3" /></a> : null}{sourceLicense && sourceLicenseUrl ? <a href={sourceLicenseUrl} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[color:var(--app-border)] px-2"><ShieldCheck className="h-3.5 w-3.5" /><span className="truncate">{isId ? 'Lisensi: ' : 'License: '}{sourceLicense}</span><ExternalLink className="ml-auto h-3 w-3" /></a> : null}</div></div>
    </article>
  );
}

function SearchSkeleton() { return <section className="py-3" aria-hidden="true"><div className="h-5 w-40 animate-pulse rounded bg-[color:var(--app-border)]" /><div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 6 }).map((_, index) => <div key={index} className="h-44 animate-pulse rounded-lg bg-[color:var(--app-border)]" />)}</div></section>; }
function renderSearchCard(item: GlobalSearchItem, locale: LajukanLocale) { if (item.kind === 'products') return <ProductSearchCard item={item} locale={locale} />; if (item.kind === 'services') return <ServiceSearchCard item={item} locale={locale} />; if (item.kind === 'businesses') return <BusinessSearchCard item={item} locale={locale} />; if (item.kind === 'references') return <PublicReferenceCard item={item} locale={locale} />; if (item.kind === 'needs') return <NeedSearchCard item={item} locale={locale} />; if (item.kind === 'communities') return <CommunitySearchCard item={item} locale={locale} />; if (item.kind === 'videos') return <VideoSearchCard item={item} />; return <UserSearchCard item={item} locale={locale} />; }

function SearchGroupSection({ groupKey, group, locale, compact, onSelectTab, onNextCursor }: { groupKey: GlobalSearchGroupKey; group: GlobalSearchGroup; locale: LajukanLocale; compact: boolean; onSelectTab?: (tab: GlobalSearchTab) => void; onNextCursor?: (cursor: string) => void }) {
  const isId = locale === 'id'; const { emblaRef, emblaApi } = useExploreEmblaRail(); if (!group.available || (group.items.length === 0 && !group.error)) return null; const copy = SEARCH_GROUP_COPY[groupKey]; const items = compact ? group.items.slice(0, groupKey === 'videos' ? 6 : 5) : group.items; const compactSlideClass = groupKey === 'videos' || groupKey === 'products' || groupKey === 'services' ? 'flex-[0_0_47%] sm:flex-[0_0_31%] lg:flex-[0_0_24%]' : 'flex-[0_0_88%] sm:flex-[0_0_48%] lg:flex-[0_0_32%]'; const fullGridClass = groupKey === 'videos' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : groupKey === 'products' || groupKey === 'services' ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4' : groupKey === 'needs' ? 'sm:grid-cols-2 xl:grid-cols-3' : groupKey === 'businesses' || groupKey === 'references' || groupKey === 'communities' ? 'sm:grid-cols-2 lg:grid-cols-3' : 'sm:grid-cols-2 xl:grid-cols-3';
  return <section className="mt-3 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3.5 sm:p-4"><div className="flex items-end justify-between gap-3"><div><h2 className="text-base font-bold text-[color:var(--app-text)]">{isId ? copy.labelId : copy.labelEn}</h2><p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)]">{group.total.toLocaleString(isId ? 'id-ID' : 'en-US')} {isId ? 'hasil' : 'results'}</p></div>{compact && group.items.length > 0 ? <div className="flex items-center gap-1.5"><EmblaDesktopControls api={emblaApi} isId={isId} compact />{onSelectTab ? <CompactSeeAllButton isId={isId} onClick={() => onSelectTab(groupKey)} /> : null}</div> : null}</div>{group.error ? <div className="mt-3 rounded-[16px] border border-dashed p-4 text-xs text-[color:var(--app-text-soft)]">{isId ? `Hasil ${copy.labelId.toLowerCase()} belum dapat dimuat.` : `${copy.labelEn} results are temporarily unavailable.`}</div> : compact ? <div ref={emblaRef} className="mt-3 w-full overflow-hidden"><div className="flex gap-3">{items.map(item => <div key={`${item.kind}-${item.id}`} className={`min-w-0 shrink-0 ${compactSlideClass}`}>{renderSearchCard(item, locale)}</div>)}</div></div> : <><div className={`mt-4 grid gap-3 ${fullGridClass}`}>{items.map(item => <div key={`${item.kind}-${item.id}`}>{renderSearchCard(item, locale)}</div>)}</div>{groupKey === 'references' && group.nextCursor && onNextCursor ? <ReferenceNextBatchAction cursor={group.nextCursor} isId={isId} onNextCursor={onNextCursor} /> : null}</>}</section>;
}

export function ExploreSearchResults({ payload, loading, error, locale, compact = true, activeTab = 'all', searchSide = 'supply', onSelectTab, onNextCursor, onRetry }: { payload: GlobalSearchResponse; loading: boolean; error: boolean; locale: LajukanLocale; compact?: boolean; activeTab?: GlobalSearchTab; searchSide?: 'supply' | 'demand'; onSelectTab?: (tab: GlobalSearchTab) => void; onNextCursor?: (cursor: string) => void; onRetry?: () => void }) {
  const isId = locale === 'id';
  const safeReferenceItems = payload.groups.references.items.filter(hasCompleteReferenceProvenance);
  const visiblePayload: GlobalSearchResponse = safeReferenceItems.length === payload.groups.references.items.length ? payload : { ...payload, groups: { ...payload.groups, references: { ...payload.groups.references, items: safeReferenceItems, total: safeReferenceItems.length === 0 ? 0 : Math.max(safeReferenceItems.length, payload.groups.references.total) } } };
  const referenceNextCursor = activeTab === 'references' ? visiblePayload.groups.references.nextCursor : null;
  const hasVisibleItems = activeTab === 'all' ? DEFAULT_SEARCH_GROUPS.some(key => visiblePayload.groups[key].items.length > 0) : visiblePayload.groups[activeTab as GlobalSearchGroupKey]?.items.length > 0;
  if (loading && !hasVisibleItems) return <SearchSkeleton />;
  if (error && !hasVisibleItems) return <section className="py-3"><div className="flex flex-col items-start gap-4 rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 sm:flex-row sm:items-center sm:justify-between"><div><p className="flex items-center gap-2 text-sm font-bold"><CircleAlert className="h-4 w-4 text-amber-600" />{isId ? 'Hasil belum bisa dimuat.' : 'Results could not be loaded.'}</p><p className="mt-1 text-xs text-[color:var(--app-text-soft)]">{isId ? 'Coba lagi sebentar.' : 'Please retry in a moment.'}</p></div>{onRetry ? <button type="button" onClick={onRetry} className="min-h-10 rounded-[8px] border px-4 text-xs font-bold">{isId ? 'Coba lagi' : 'Retry'}</button> : null}</div></section>;
  const activeGroupKey = activeTab === 'all' ? null : activeTab as GlobalSearchGroupKey;
  const displayedTotal = activeGroupKey ? visiblePayload.groups[activeGroupKey]?.total || 0 : DEFAULT_SEARCH_GROUPS.reduce((total, key) => total + (visiblePayload.groups[key]?.total || 0), 0);

  if (displayedTotal === 0) {
    const recoveryActions = getZeroResultRecovery({ locale, searchSide, activeTab });
    return <><ResultTypeTabs payload={visiblePayload} activeTab={activeTab} locale={locale} onSelectTab={onSelectTab} /><section className="py-3"><div className="rounded-[18px] border border-dashed border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] p-4 sm:p-5"><p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]"><PackageSearch className="h-4 w-4 text-[color:var(--app-accent)]" />{activeTab !== 'all' && activeTab !== 'references' ? (isId ? `Belum ada hasil ${SEARCH_GROUP_COPY[activeTab as GlobalSearchGroupKey].labelId.toLowerCase()}` : `No ${SEARCH_GROUP_COPY[activeTab as GlobalSearchGroupKey].labelEn.toLowerCase()} results yet`) : (isId ? 'Belum ada hasil yang cocok.' : 'No matching results yet.')}</p><p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">{activeTab === 'references' ? (isId ? 'Coba nama usaha, jenis tempat, atau kota lain. Hanya data dengan sumber dan lisensi yang jelas yang ditampilkan.' : 'Try another business name, place type, or city. Only data with a clear source and license is shown.') : (isId ? 'Coba kata yang lebih umum, jelajahi kategori lain, atau pasang kebutuhan/penawaran agar pihak yang cocok bisa menemukanmu.' : 'Try a broader keyword, browse another category, or post a need/offer so the right people can find you.')}</p>{referenceNextCursor && onNextCursor ? <ReferenceNextBatchAction cursor={referenceNextCursor} isId={isId} onNextCursor={onNextCursor} /> : null}<div className="mt-4 flex flex-wrap gap-2">{recoveryActions.map((action, index) => <Link key={action.analyticsAction} href={action.href} onClick={() => { void trackLajukanEvent('search.zero_result_action_clicked', { properties: { active_tab: activeTab, search_side: searchSide, action: action.analyticsAction } }); }} className={cn('inline-flex min-h-10 items-center gap-2 rounded-[10px] px-4 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)]', index === recoveryActions.length - 1 && activeTab !== 'references' ? 'bg-[color:var(--app-accent)] text-white hover:opacity-90' : 'border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] hover:border-[color:var(--app-accent-border)]')}>{action.label}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>)}</div></div></section></>;
  }

  const groups = activeTab === 'all' ? DEFAULT_SEARCH_GROUPS : SEARCH_GROUPS.filter(groupKey => groupKey === activeTab);
  return <>{loading || error ? <div role="status" className="mt-3 flex items-center justify-between gap-3 rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs font-semibold text-[color:var(--app-text-soft)]"><span>{loading ? (isId ? 'Memperbarui hasil. Hasil terakhir tetap ditampilkan.' : 'Refreshing results. The latest available results remain visible.') : (isId ? 'Pembaruan gagal. Hasil terakhir yang tersedia tetap ditampilkan.' : 'Refresh failed. The latest available results remain visible.')}</span>{error && onRetry ? <button type="button" onClick={onRetry} className="shrink-0 font-bold text-[color:var(--app-accent)]">{isId ? 'Coba lagi' : 'Retry'}</button> : null}</div> : null}<ResultTypeTabs payload={visiblePayload} activeTab={activeTab} locale={locale} onSelectTab={onSelectTab} />{groups.map(groupKey => <SearchGroupSection key={groupKey} groupKey={groupKey} group={visiblePayload.groups[groupKey]} locale={locale} compact={compact && activeTab === 'all'} onSelectTab={onSelectTab} onNextCursor={onNextCursor} />)}</>;
}
