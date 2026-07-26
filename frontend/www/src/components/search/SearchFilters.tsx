'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Filter, X } from 'lucide-react';

import { LocationAutocomplete } from '@/components/location/LocationAutocomplete';
import type { SelectedLocation } from '@/lib/location/location.types';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import type { GlobalSearchTab } from '@/lib/search/globalSearch';

export type SearchFilterValues = {
  location: string;
  lat: string;
  lng: string;
  distance: string;
  sort: string;
  minPrice: string;
  maxPrice: string;
  condition: string;
  serviceMode: string;
  verified: string;
  status: string;
  privacy: string;
};

type SearchFiltersProps = {
  locale: 'id' | 'en';
  tab: GlobalSearchTab;
  values: SearchFilterValues;
  mobileOpen: boolean;
  onMobileClose: () => void;
  onApply: (values: SearchFilterValues) => void;
};

export function SearchFilters({
  locale,
  tab,
  values,
  mobileOpen,
  onMobileClose,
  onApply,
}: SearchFiltersProps) {
  const isId = locale === 'id';
  const [draft, setDraft] = useState(values);
  const [selectedLocation, setSelectedLocation] =
    useState<SelectedLocation | null>(null);
  useBodyScrollLock(mobileOpen);
  const activeFilterCount = [
    values.location,
    values.distance,
    values.sort !== 'relevance' ? values.sort : '',
    values.minPrice,
    values.maxPrice,
    values.condition !== 'all' ? values.condition : '',
    values.serviceMode !== 'all' ? values.serviceMode : '',
    values.verified === '1' ? values.verified : '',
    values.status !== 'all' ? values.status : '',
    values.privacy !== 'all' ? values.privacy : '',
  ].filter(Boolean).length;

  const update = (key: keyof SearchFilterValues, value: string) => {
    setDraft(current => ({ ...current, [key]: value }));
  };

  const reset = () => {
    const empty: SearchFilterValues = {
      location: '',
      lat: '',
      lng: '',
      distance: '',
      sort: 'relevance',
      minPrice: '',
      maxPrice: '',
      condition: 'all',
      serviceMode: 'all',
      verified: '0',
      status: 'all',
      privacy: 'all',
    };
    setDraft(empty);
    setSelectedLocation(null);
  };

  const fields = (
    <div className="grid gap-3 sm:grid-cols-2">
      <LocationAutocomplete
        value={selectedLocation}
        onChange={location => {
          setSelectedLocation(location);
          if (!location) {
            update('lat', '');
            update('lng', '');
          }
        }}
        textValue={draft.location}
        onTextChange={value => update('location', value)}
        onSelect={location => {
          update('location', location.formattedAddress);
          update('lat', String(location.latitude));
          update('lng', String(location.longitude));
        }}
        label={isId ? 'Lokasi' : 'Location'}
        placeholder={isId ? 'Kota, jalan, atau area' : 'City, street, or area'}
        isId={isId}
      />

      <label className="block">
        <span className="mb-1 block text-[11px] font-bold text-[color:var(--app-text-soft)]">
          {isId ? 'Jarak' : 'Distance'}
        </span>
        <select
          value={draft.distance}
          onChange={event => update('distance', event.target.value)}
          disabled={!draft.lat || !draft.lng}
          className="h-11 w-full rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
        >
          <option value="">{isId ? 'Semua' : 'Any'}</option>
          <option value="5">5 km</option>
          <option value="10">10 km</option>
          <option value="25">25 km</option>
          <option value="50">50 km</option>
        </select>
      </label>

      <label className="block">
        <span className="mb-1 block text-[11px] font-bold text-[color:var(--app-text-soft)]">
          {isId ? 'Urutan' : 'Sort'}
        </span>
        <select
          value={draft.sort}
          onChange={event => update('sort', event.target.value)}
          className="h-11 w-full rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 text-sm"
        >
          <option value="relevance">
            {isId ? 'Paling relevan' : 'Most relevant'}
          </option>
          <option value="latest">{isId ? 'Terbaru' : 'Latest'}</option>
          <option value="nearest">{isId ? 'Terdekat' : 'Nearest'}</option>
        </select>
      </label>

      {tab === 'products' || tab === 'all' ? (
        <>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-[color:var(--app-text-soft)]">
              {isId ? 'Kondisi' : 'Condition'}
            </span>
            <select
              value={draft.condition}
              onChange={event => update('condition', event.target.value)}
              className="h-11 w-full rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 text-sm"
            >
              <option value="all">{isId ? 'Semua' : 'Any'}</option>
              <option value="new">{isId ? 'Baru' : 'New'}</option>
              <option value="used">{isId ? 'Bekas' : 'Used'}</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-[color:var(--app-text-soft)]">
              {isId ? 'Harga minimum' : 'Minimum price'}
            </span>
            <input
              inputMode="numeric"
              value={draft.minPrice}
              onChange={event =>
                update('minPrice', event.target.value.replace(/\D/g, ''))
              }
              placeholder="0"
              className="h-11 w-full rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-[11px] font-bold text-[color:var(--app-text-soft)]">
              {isId ? 'Harga maksimum' : 'Maximum price'}
            </span>
            <input
              inputMode="numeric"
              value={draft.maxPrice}
              onChange={event =>
                update('maxPrice', event.target.value.replace(/\D/g, ''))
              }
              placeholder={isId ? 'Tanpa batas' : 'No limit'}
              className="h-11 w-full rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm"
            />
          </label>
        </>
      ) : null}

      {tab === 'services' ? (
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-[color:var(--app-text-soft)]">
            {isId ? 'Cara layanan' : 'Service mode'}
          </span>
          <select
            value={draft.serviceMode}
            onChange={event => update('serviceMode', event.target.value)}
            className="h-11 w-full rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 text-sm"
          >
            <option value="all">{isId ? 'Semua' : 'Any'}</option>
            <option value="online">Online</option>
            <option value="onsite">{isId ? 'Di lokasi' : 'On site'}</option>
          </select>
        </label>
      ) : null}

      {tab === 'businesses' || tab === 'users' ? (
        <label className="flex min-h-11 items-center gap-2 self-end rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm font-semibold">
          <input
            type="checkbox"
            checked={draft.verified === '1'}
            onChange={event =>
              update('verified', event.target.checked ? '1' : '0')
            }
          />
          {isId ? 'Terverifikasi' : 'Verified'}
        </label>
      ) : null}

      {tab === 'needs' ? (
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-[color:var(--app-text-soft)]">
            Status
          </span>
          <select
            value={draft.status}
            onChange={event => update('status', event.target.value)}
            className="h-11 w-full rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 text-sm"
          >
            <option value="all">{isId ? 'Semua' : 'Any'}</option>
            <option value="open">{isId ? 'Masih dibuka' : 'Open'}</option>
          </select>
        </label>
      ) : null}

      {tab === 'communities' ? (
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold text-[color:var(--app-text-soft)]">
            {isId ? 'Akses grup' : 'Group access'}
          </span>
          <select
            value={draft.privacy}
            onChange={event => update('privacy', event.target.value)}
            className="h-11 w-full rounded-[8px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 text-sm"
          >
            <option value="all">{isId ? 'Semua' : 'Any'}</option>
            <option value="public">{isId ? 'Publik' : 'Public'}</option>
            <option value="private">{isId ? 'Privat' : 'Private'}</option>
          </select>
        </label>
      ) : null}
    </div>
  );

  const actions = (
    <div className="mt-3 flex justify-end gap-2">
      <button
        type="button"
        onClick={reset}
        className="min-h-10 rounded-[8px] border border-[color:var(--app-border)] px-4 text-xs font-bold text-[color:var(--app-text)]"
      >
        {isId ? 'Reset' : 'Reset'}
      </button>
      <button
        type="button"
        onClick={() => {
          onApply(draft);
          onMobileClose();
        }}
        className="min-h-10 rounded-[8px] bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white"
      >
        {isId ? 'Terapkan filter' : 'Apply filters'}
      </button>
    </div>
  );

  if (!mobileOpen || typeof document === 'undefined') return null;

  return createPortal(
    <>
      <button
        type="button"
        className="ui-layer-modal-backdrop fixed inset-0 bg-slate-950/48"
        onClick={onMobileClose}
        aria-label={isId ? 'Tutup filter' : 'Close filters'}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="search-filter-title"
        className="ui-layer-modal fixed inset-x-0 bottom-0 max-h-[88dvh] overflow-y-auto rounded-t-2xl border border-[color:var(--app-border)] bg-white px-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] pt-3 shadow-2xl sm:inset-x-auto sm:inset-y-0 sm:right-0 sm:w-[min(440px,100vw)] sm:max-h-none sm:rounded-none sm:border-y-0 sm:border-r-0 sm:px-5 sm:pt-5"
      >
        <div className="sticky top-0 z-10 -mx-4 -mt-3 flex items-center justify-between gap-3 border-b border-[color:var(--app-border)] bg-white px-4 py-3 sm:-mx-5 sm:-mt-5 sm:px-5 sm:py-4">
          <div>
            <h2
              id="search-filter-title"
              className="flex items-center gap-2 text-lg font-bold text-[color:var(--app-text)]"
            >
              <Filter className="h-5 w-5 text-[color:var(--app-accent)]" />
              {isId ? 'Filter hasil' : 'Result filters'}
            </h2>
            {activeFilterCount > 0 ? (
              <p className="mt-0.5 text-xs text-[color:var(--app-text-soft)]">
                {activeFilterCount} {isId ? 'filter aktif' : 'active filters'}
              </p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onMobileClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--app-border)] text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)]"
            aria-label={isId ? 'Tutup' : 'Close'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-4">{fields}</div>
        {actions}
      </section>
    </>,
    document.body,
  );
}
