'use client';

import { type FormEvent, useEffect, useRef, useState } from 'react';
import {
  ArrowRight,
  ChevronDown,
  MapPin,
  Plus,
  Search,
  X,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { UMKM_OWNER_ONBOARDING_PATH } from '@/lib/umkmSurface';
import { UmkmDiscoveryPanel } from './UmkmDiscoveryPanel';

type UmkmDiscoveryClientProps = {
  locale: string;
  isId: boolean;
  initialQuery?: string;
  initialCity?: string;
  initialStoreSlug?: string;
};

export function UmkmDiscoveryClient(props: UmkmDiscoveryClientProps) {
  const { isId, initialQuery = '', initialCity = '', initialStoreSlug } = props;
  const { isAuthenticated } = useAuth();
  const resultsRef = useRef<HTMLElement | null>(null);
  const [query, setQuery] = useState(initialQuery);
  const [city, setCity] = useState(initialCity);
  const cleanedQuery = query.trim();
  const cleanedCity = city.trim();

  useEffect(() => {
    setQuery(initialQuery);
  }, [initialQuery]);

  useEffect(() => {
    setCity(initialCity);
  }, [initialCity]);

  const scrollToResults = () => {
    resultsRef.current?.scrollIntoView({
      behavior: 'smooth',
      block: 'start',
    });
  };

  const handleSearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    scrollToResults();
  };
  const quickCities = ['Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta'];

  const businessCtaHref = isAuthenticated
    ? UMKM_OWNER_ONBOARDING_PATH
    : '/register';

  return (
    <main className="page-shell overflow-x-hidden py-0 pb-10 sm:pb-0 sm:py-4">
      <div className="flex w-full flex-col gap-5 sm:mx-auto sm:max-w-[var(--app-max-width)] sm:gap-6">
        <section
          className="ui-page-section ui-home-section-shell px-2 sm:px-3"
          data-home-section-hero="true"
        >
          <div className="ui-home-section-content">
            <div className="overflow-hidden rounded-[24px] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.12)] sm:px-5 sm:py-5">
              <div className="max-w-2xl">
                <h1 className="text-[1.1rem] font-black text-[color:var(--app-text)] sm:text-[1.3rem]">
                  {isId ? 'Cari usaha di sekitarmu' : 'Find businesses near you'}
                </h1>
                <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)] sm:text-[12px]">
                  {isId
                    ? 'Mau makan, servis, atau belanja? Cari di sini.'
                    : 'Looking for food, services, or shopping? Start here.'}
                </p>
              </div>

              <form
                onSubmit={handleSearch}
                className="mt-3 flex flex-col gap-2"
                role="search"
                aria-label="UMKM search"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200/80 transition focus-within:bg-white dark:bg-slate-900/80 dark:ring-slate-800/80 dark:focus-within:bg-slate-900">
                    <Search className="h-4 w-4 text-[color:var(--app-accent)]" />
                    <input
                      type="search"
                      value={query}
                      onChange={event => setQuery(event.target.value)}
                      placeholder={
                        isId
                          ? 'Cari usaha atau produk...'
                          : 'Search business or product...'
                      }
                      className="min-h-[28px] w-full min-w-0 appearance-none border-0 bg-transparent text-[11px] font-medium text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 sm:min-h-[32px] sm:text-[13px] dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                  </label>
                  <button
                    type="submit"
                    className="ui-pressable inline-flex h-9 items-center justify-center gap-2 rounded-full bg-[linear-gradient(135deg,var(--app-accent),var(--app-accent-strong))] px-4 text-[11px] font-semibold text-white shadow-[0_16px_28px_-22px_color-mix(in_srgb,var(--app-accent)_52%,transparent)] transition hover:brightness-105"
                  >
                    {isId ? 'Cari' : 'Search'}
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <label className="flex min-w-[220px] flex-1 items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5 ring-1 ring-slate-200/80 transition focus-within:bg-white dark:bg-slate-900/80 dark:ring-slate-800/80 dark:focus-within:bg-slate-900">
                    <MapPin className="h-4 w-4 text-[color:var(--app-accent)]" />
                    <input
                      value={city}
                      onChange={event => setCity(event.target.value)}
                      placeholder={isId ? 'Lokasi kamu' : 'Your location'}
                      className="min-h-[28px] w-full min-w-0 appearance-none border-0 bg-transparent text-[11px] font-medium text-slate-800 outline-none ring-0 placeholder:text-slate-400 focus:border-0 focus:outline-none focus:ring-0 sm:min-h-[32px] sm:text-[13px] dark:text-slate-100 dark:placeholder:text-slate-500"
                    />
                    <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />
                  </label>

                  <Link
                    href={businessCtaHref}
                    className="ui-pressable inline-flex h-9 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-[11px] font-semibold text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-slate-700 dark:bg-slate-950 dark:text-slate-200 dark:hover:border-[color:var(--app-accent-border)] dark:hover:text-sky-200"
                  >
                    <Plus className="h-4 w-4" />
                    {isId ? 'Tambah usaha' : 'Add business'}
                  </Link>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {cleanedCity ? (
                    <button
                      type="button"
                      onClick={() => setCity('')}
                      className="ui-pressable inline-flex min-h-[32px] items-center gap-1.5 rounded-full bg-slate-100 px-3 py-1 text-[11px] font-semibold text-slate-700 transition hover:bg-slate-200 dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      <MapPin className="h-3.5 w-3.5" />
                      {cleanedCity}
                      <X className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <span className="text-[11px] text-[color:var(--app-text-soft)]">
                      {isId ? 'Kota cepat:' : 'Quick cities:'}
                    </span>
                  )}
                  {quickCities.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setCity(item);
                        scrollToResults();
                      }}
                      className={`ui-pressable inline-flex min-h-[32px] items-center rounded-full px-3 py-1 text-[11px] font-semibold transition ${
                        cleanedCity === item
                          ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                          : 'bg-slate-100 text-slate-700 hover:bg-white hover:text-[color:var(--app-accent)] dark:bg-slate-900 dark:text-slate-200 dark:hover:bg-slate-950 dark:hover:text-sky-200'
                      }`}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </form>
            </div>
          </div>
        </section>

        <section
          ref={resultsRef}
          id="umkm-results"
          className="ui-page-section ui-home-section-shell px-2 sm:px-3"
        >
          <div className="ui-home-section-content">
            <UmkmDiscoveryPanel
              isId={isId}
              query={cleanedQuery}
              city={cleanedCity}
              limit={240}
              title={isId ? 'Usaha di sekitarmu' : 'Businesses near you'}
              description={
                isId
                  ? 'Filter yang penting saja, lalu pilih usaha yang cocok.'
                  : 'Keep the filters simple and pick the right business.'
              }
              selectedSlug={initialStoreSlug}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
