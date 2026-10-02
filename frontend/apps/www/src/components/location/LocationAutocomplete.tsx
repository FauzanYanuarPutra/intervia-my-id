'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { Loader2, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import type {
  LocationAutocompleteResponse,
  LocationBias,
  LocationPlaceResponse,
  LocationSuggestion,
  SelectedLocation,
} from '@/lib/location/location.types';
import {
  formatLocationInputValue,
  normalizeLocationText,
} from '@/lib/location/location.utils';
import { CurrentLocationButton } from './CurrentLocationButton';
import {
  LocationPermissionModal,
  type LocationPermissionModalState,
} from './LocationPermissionModal';
import { LocationSuggestionItem } from './LocationSuggestionItem';

type LocationAutocompleteProps = {
  value: SelectedLocation | null;
  onChange: (location: SelectedLocation | null) => void;
  textValue?: string;
  onTextChange?: (value: string) => void;
  onSelect?: (location: SelectedLocation) => void;
  label?: string;
  placeholder?: string;
  helperText?: string;
  errorMessage?: string;
  required?: boolean;
  disabled?: boolean;
  countryCode?: string;
  locationBias?: LocationBias | null;
  localSuggestions?: LocationSuggestion[];
  isId?: boolean;
  className?: string;
  /**
   * On small screens, show the location search as a keyboard-like
   * full-screen sheet instead of a tiny dropdown.
   */
  mobileSheet?: boolean;
};

function buildSuggestionKey(item: LocationSuggestion): string {
  return (
    item.placeId || `${item.primaryText}-${item.latitude}-${item.longitude}`
  );
}

type GeolocationPermissionState = 'granted' | 'prompt' | 'denied';

async function readGeolocationPermissionState(): Promise<GeolocationPermissionState> {
  if (typeof navigator === 'undefined') return 'prompt';
  if (!navigator.permissions?.query) return 'prompt';
  try {
    const permission = await navigator.permissions.query({ name: 'geolocation' });
    return permission.state === 'granted' || permission.state === 'denied'
      ? permission.state
      : 'prompt';
  } catch {
    return 'prompt';
  }
}

function mergeSuggestions(
  localSuggestions: LocationSuggestion[],
  remoteSuggestions: LocationSuggestion[],
  query: string,
): LocationSuggestion[] {
  const normalized = query.toLowerCase();
  const seen = new Set<string>();
  return [...localSuggestions, ...remoteSuggestions]
    .filter(item => {
      if (!normalized) return true;
      if (item.source !== 'business') return true;
      return [item.primaryText, item.secondaryText, item.description]
        .join(' ')
        .toLowerCase()
        .includes(normalized);
    })
    .filter(item => {
      const key = buildSuggestionKey(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .slice(0, 10);
}

export function LocationAutocomplete({
  value,
  onChange,
  textValue,
  onTextChange,
  onSelect,
  label,
  placeholder,
  helperText,
  errorMessage,
  required,
  disabled,
  countryCode = 'ID',
  locationBias,
  localSuggestions = [],
  isId = true,
  className,
  mobileSheet = true,
}: LocationAutocompleteProps) {
  const reactId = useId();
  const listboxId = `${reactId}-location-listbox`;
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<number | null>(null);
  const latestQueryRef = useRef('');
  const controlledText = textValue !== undefined;
  const [internalText, setInternalText] = useState(
    () => textValue ?? formatLocationInputValue(value),
  );
  const inputText = controlledText ? textValue || '' : internalText;
  const [open, setOpen] = useState(false);
  const [remoteSuggestions, setRemoteSuggestions] = useState<
    LocationSuggestion[]
  >([]);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [loading, setLoading] = useState(false);
  const [locating, setLocating] = useState(false);
  const [status, setStatus] = useState<'idle' | 'empty' | 'error'>('idle');
  const [localError, setLocalError] = useState('');
  const [permissionModalState, setPermissionModalState] =
    useState<LocationPermissionModalState | null>(null);

  const setInputText = useCallback(
    (next: string) => {
      if (!controlledText) setInternalText(next);
      onTextChange?.(next);
    },
    [controlledText, onTextChange],
  );

  const query = normalizeLocationText(inputText);
  const suggestions = useMemo(
    () => mergeSuggestions(localSuggestions, remoteSuggestions, query),
    [localSuggestions, query, remoteSuggestions],
  );

  const selectLocation = useCallback(
    async (suggestion: LocationSuggestion) => {
      let selected = suggestion.selectedLocation || null;
      if (!selected) {
        const response = await fetch(
          `/api/locations/place/${encodeURIComponent(suggestion.placeId)}?locale=${isId ? 'id' : 'en'}`,
          { headers: { Accept: 'application/json' } },
        );
        const payload = (await response
          .json()
          .catch(() => ({}))) as LocationPlaceResponse;
        selected = payload.data;
      }
      if (!selected) return;
      const display =
        formatLocationInputValue(selected) || selected.formattedAddress;
      setInputText(display);
      onChange(selected);
      onSelect?.(selected);
      setOpen(false);
      setActiveIndex(-1);
      setLocalError('');
    },
    [isId, onChange, onSelect, setInputText],
  );

  const searchLocations = useCallback(
    (nextQuery: string) => {
      abortRef.current?.abort();
      abortRef.current = null;
      if (debounceRef.current) {
        window.clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }

      if (nextQuery.length < 2) {
        setRemoteSuggestions([]);
        setLoading(false);
        setStatus('idle');
        return;
      }

      const controller = new AbortController();
      abortRef.current = controller;
      debounceRef.current = window.setTimeout(() => {
        latestQueryRef.current = nextQuery;
        setLoading(true);
        setStatus('idle');
        const params = new URLSearchParams({
          q: nextQuery,
          locale: isId ? 'id' : 'en',
          countryCode,
        });
        if (locationBias) {
          params.set('lat', String(locationBias.lat));
          params.set('lng', String(locationBias.lng));
        }

        fetch(`/api/locations/autocomplete?${params.toString()}`, {
          signal: controller.signal,
          headers: { Accept: 'application/json' },
        })
          .then(res => res.json())
          .then((payload: LocationAutocompleteResponse) => {
            if (
              controller.signal.aborted ||
              latestQueryRef.current !== nextQuery
            )
              return;
            const data = Array.isArray(payload.data) ? payload.data : [];
            setRemoteSuggestions(data);
            setStatus(data.length === 0 ? 'empty' : 'idle');
          })
          .catch(() => {
            if (controller.signal.aborted) return;
            setRemoteSuggestions([]);
            setStatus('error');
          })
          .finally(() => {
            if (!controller.signal.aborted) setLoading(false);
          });
      }, 360);
    },
    [countryCode, isId, locationBias],
  );

  const reverseGeocode = useCallback(
    async (lat: number, lng: number): Promise<SelectedLocation | null> => {
      const params = new URLSearchParams({
        lat: String(lat),
        lng: String(lng),
        locale: isId ? 'id' : 'en',
      });
      const response = await fetch(
        `/api/locations/reverse-geocode?${params.toString()}`,
        {
          headers: { Accept: 'application/json' },
        },
      );
      const payload = (await response
        .json()
        .catch(() => ({}))) as LocationPlaceResponse;
      return payload.data;
    },
    [isId],
  );

  const requestCurrentLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setLocating(false);
      setPermissionModalState('unsupported');
      return;
    }

    setLocating(true);
    setLocalError('');

    navigator.geolocation.getCurrentPosition(
      position => {
        const lat = Number(position.coords.latitude.toFixed(6));
        const lng = Number(position.coords.longitude.toFixed(6));
        reverseGeocode(lat, lng)
          .then(selected => {
            if (!selected) {
              setPermissionModalState('error');
              return;
            }
            const display =
              formatLocationInputValue(selected) || selected.formattedAddress;
            setInputText(display);
            onChange(selected);
            onSelect?.(selected);
            setOpen(false);
            setActiveIndex(-1);
            setPermissionModalState(null);
          })
          .catch(() => {
            setPermissionModalState('error');
          })
          .finally(() => setLocating(false));
      },
      error => {
        setLocating(false);
        if (error.code === 1) {
          setPermissionModalState('denied');
          return;
        }
        setPermissionModalState('error');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  }, [onChange, onSelect, reverseGeocode, setInputText]);

  const openCurrentLocationPermission = useCallback(async () => {
    setLocalError('');
    if (!navigator.geolocation) {
      setPermissionModalState('unsupported');
      return;
    }

    const permissionState = await readGeolocationPermissionState();
    if (permissionState === 'denied') {
      setPermissionModalState('denied');
      return;
    }

    if (permissionState === 'prompt') {
      setPermissionModalState('prompt');
      return;
    }

    requestCurrentLocation();
  }, [requestCurrentLocation]);

  const useCurrentLocation = useCallback(() => {
    void openCurrentLocationPermission();
  }, [openCurrentLocationPermission]);

  useEffect(() => {
    if (controlledText) return;
    const display = formatLocationInputValue(value);
    const timeout = window.setTimeout(() => setInternalText(display), 0);
    return () => window.clearTimeout(timeout);
  }, [controlledText, value]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('pointerdown', handlePointerDown);
    return () => document.removeEventListener('pointerdown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    return () => {
      if (debounceRef.current) window.clearTimeout(debounceRef.current);
      abortRef.current?.abort();
    };
  }, []);

  const shownError = errorMessage || localError;
  const expanded = open && !disabled;
  const activeId =
    activeIndex >= 0 && suggestions[activeIndex]
      ? `${listboxId}-${activeIndex}`
      : undefined;

  const closeLocationPermissionModal = useCallback(() => {
    if (locating) return;
    setPermissionModalState(null);
  }, [locating]);

  return (
    <div
      ref={rootRef}
      className={cn(
        'relative space-y-2',
        expanded &&
          mobileSheet &&
          'max-sm:fixed max-sm:inset-0 max-sm:z-[130000] max-sm:flex max-sm:flex-col max-sm:gap-3 max-sm:overflow-hidden max-sm:bg-[color:var(--app-surface-strong)] max-sm:p-3 max-sm:pt-[max(12px,env(safe-area-inset-top))] max-sm:pb-[max(12px,env(safe-area-inset-bottom))]',
        expanded && 'ui-layer-popover',
        className,
      )}
    >
      {expanded && mobileSheet ? (
        <div className="flex items-center justify-between gap-3 max-sm:shrink-0">
          <div className="min-w-0">
            <p className="truncate text-sm font-black text-slate-900 dark:text-white">
              {label ||
                (isId ? 'Pilih lokasi' : 'Choose location')}
            </p>
            <p className="mt-0.5 text-[11px] font-semibold text-slate-500 dark:text-slate-400">
              {isId
                ? 'Cari tempat, alamat, atau gunakan lokasi saat ini.'
                : 'Search a place, address, or use your current location.'}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setActiveIndex(-1);
            }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 shadow-sm dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            aria-label={isId ? 'Tutup pencarian lokasi' : 'Close location search'}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : null}

      {label ? (
        <label
          htmlFor={reactId}
          className="block text-sm font-semibold text-slate-800 dark:text-slate-100"
        >
          {label}
          {required ? <span className="text-red-500"> *</span> : null}
        </label>
      ) : null}

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          ref={inputRef}
          id={reactId}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={expanded}
          aria-activedescendant={activeId}
          aria-invalid={Boolean(shownError) || undefined}
          disabled={disabled}
          required={required}
          value={inputText}
          onFocus={() => {
            setOpen(true);
            if (query.length >= 2) searchLocations(query);
          }}
          onChange={event => {
            const next = event.target.value;
            const nextQuery = normalizeLocationText(next);
            setInputText(next);
            setOpen(true);
            setActiveIndex(-1);
            setLocalError('');
            searchLocations(nextQuery);
            if (
              value &&
              normalizeLocationText(next) !== formatLocationInputValue(value)
            ) {
              onChange(null);
            }
          }}
          onKeyDown={event => {
            if (event.key === 'Escape') {
              setOpen(false);
              setActiveIndex(-1);
              return;
            }
            if (event.key === 'ArrowDown') {
              event.preventDefault();
              setOpen(true);
              setActiveIndex(current =>
                Math.min(current + 1, Math.max(suggestions.length - 1, 0)),
              );
              return;
            }
            if (event.key === 'ArrowUp') {
              event.preventDefault();
              setActiveIndex(current => Math.max(current - 1, 0));
              return;
            }
            if (event.key === 'Enter' && open && activeIndex >= 0) {
              event.preventDefault();
              const item = suggestions[activeIndex];
              if (item) void selectLocation(item);
            }
          }}
          placeholder={
            placeholder ||
            (isId
              ? 'Cari nama tempat, jalan, kecamatan, atau kota'
              : 'Search place, street, district, or city')
          }
          className="min-h-[48px] w-full rounded-[16px] border border-slate-200 bg-white py-3 pl-10 pr-10 text-base text-slate-950 outline-none transition placeholder:text-slate-400 focus:border-emerald-500 focus:ring-2 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-50 dark:focus:border-emerald-400 dark:focus:ring-emerald-900/40"
        />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-slate-400" />
        ) : inputText ? (
          <button
            type="button"
            onClick={() => {
              setInputText('');
              onChange(null);
              setRemoteSuggestions([]);
              setOpen(false);
              setLocalError('');
              inputRef.current?.focus();
            }}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
            aria-label={isId ? 'Hapus lokasi' : 'Clear location'}
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {helperText ? (
        <p className="text-xs leading-5 text-slate-500 dark:text-slate-400">
          {helperText}
        </p>
      ) : null}

      {shownError ? (
        <p className="text-xs font-semibold leading-5 text-red-600 dark:text-red-300">
          {shownError}
        </p>
      ) : null}

      {expanded ? (
        <div
          id={listboxId}
          role="listbox"
          className={cn(
            'ui-layer-popover absolute left-0 right-0 top-[calc(100%+0.5rem)] max-h-[min(26rem,calc(100dvh-9rem))] overflow-y-auto overscroll-contain rounded-[18px] border border-slate-200 bg-white p-1.5 shadow-[0_28px_72px_-28px_rgba(15,23,42,0.5)] dark:border-slate-700 dark:bg-slate-950',
            mobileSheet &&
              'max-sm:static max-sm:flex-1 max-sm:min-h-0 max-sm:max-h-none max-sm:overflow-y-auto max-sm:rounded-2xl max-sm:border-0 max-sm:bg-transparent max-sm:p-0 max-sm:shadow-none',
          )}
        >
          <CurrentLocationButton
            isId={isId}
            loading={locating}
            disabled={disabled}
            onClick={useCurrentLocation}
          />

          {query.length < 2 ? (
            <div className="px-3 py-3 text-xs font-semibold text-slate-500 dark:text-slate-400">
              {isId
                ? 'Ketik nama tempat, jalan, kecamatan, atau kota'
                : 'Type a place, street, district, or city'}
            </div>
          ) : null}

          {suggestions.length > 0 ? (
            <div className="mt-1 space-y-1">
              {suggestions.map((item, index) => (
                <button
                  key={buildSuggestionKey(item)}
                  id={`${listboxId}-${index}`}
                  type="button"
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => void selectLocation(item)}
                  className="block w-full"
                >
                  <LocationSuggestionItem
                    item={item}
                    active={index === activeIndex}
                    query={query}
                  />
                </button>
              ))}
            </div>
          ) : null}

          {query.length >= 2 &&
          !loading &&
          status === 'empty' &&
          suggestions.length === 0 ? (
            <div className="px-3 py-3 text-xs font-semibold leading-5 text-slate-500 dark:text-slate-400">
              {isId
                ? 'Lokasi tidak ditemukan. Coba gunakan nama jalan, kecamatan, atau kota.'
                : 'Location was not found. Try a street, district, or city name.'}
            </div>
          ) : null}

          {status === 'error' ? (
            <div className="space-y-2 px-3 py-3 text-xs font-semibold leading-5 text-red-600 dark:text-red-300">
              <p>
                {isId
                  ? 'Lokasi belum dapat dimuat. Coba beberapa saat lagi.'
                  : 'Location could not be loaded. Please retry shortly.'}
              </p>
              <button
                type="button"
                onClick={() => searchLocations(query)}
                className="rounded-full bg-red-50 px-3 py-1.5 text-red-700 dark:bg-red-500/12 dark:text-red-200"
              >
                {isId ? 'Coba lagi' : 'Retry'}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}

      <LocationPermissionModal
        open={Boolean(permissionModalState)}
        state={permissionModalState || 'error'}
        isId={isId}
        loading={locating}
        onConfirm={() => {
          setPermissionModalState(null);
          requestCurrentLocation();
        }}
        onRetry={() => {
          void openCurrentLocationPermission();
        }}
        onClose={closeLocationPermissionModal}
      />
    </div>
  );
}
