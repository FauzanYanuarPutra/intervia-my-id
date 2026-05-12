'use client';

import { useEffect, useState } from 'react';
import { Loader2, LocateFixed, MapPinned, Search } from 'lucide-react';
import { BusinessLocationMap } from '@/components/maps/BusinessLocationMap';
import { geocodeLocation, searchLocationSuggestions, type LocationSuggestion } from '@/lib/location-search';
import { type LatLng, parseLatLngFromMapsInput } from '@/lib/maps';
import { buildBusinessGoogleMapsUrl, buildBusinessLocationQuery } from '@/lib/portal-links';

type BusinessLocationFieldProps = {
  businessName: string;
  address: string;
  city: string;
  locationQuery: string;
  point: LatLng | null;
  onLocationQueryChange: (value: string) => void;
  onPointChange: (value: LatLng) => void;
};

export function BusinessLocationField({
  businessName,
  address,
  city,
  locationQuery,
  point,
  onLocationQueryChange,
  onPointChange,
}: BusinessLocationFieldProps) {
  const [suggestions, setSuggestions] = useState<LocationSuggestion[]>([]);
  const [isSuggesting, setIsSuggesting] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [isLocating, setIsLocating] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const effectiveQuery = buildBusinessLocationQuery({
    name: businessName,
    address,
    city,
    locationQuery,
  });
  const googleMapsUrl = buildBusinessGoogleMapsUrl({
    name: businessName,
    address,
    city,
    locationQuery,
    latitude: point?.lat ?? null,
    longitude: point?.lng ?? null,
  });

  useEffect(() => {
    const inferredPoint = parseLatLngFromMapsInput(locationQuery);
    if (!inferredPoint) {
      return;
    }

    if (point?.lat === inferredPoint.lat && point.lng === inferredPoint.lng) {
      return;
    }

    onPointChange(inferredPoint);
    setError('');
    setFeedback('Koordinat berhasil diambil dari link maps atau format lat,lng.');
  }, [locationQuery, onPointChange, point]);

  useEffect(() => {
    const query = locationQuery.trim();
    if (query.length < 3) {
      setSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    if (parseLatLngFromMapsInput(query) || /^https?:\/\//i.test(query)) {
      setSuggestions([]);
      setIsSuggesting(false);
      return;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setIsSuggesting(true);
      void searchLocationSuggestions(query, {
        signal: controller.signal,
        limit: 5,
        language: 'id',
      })
        .then(items => {
          if (!controller.signal.aborted) {
            setSuggestions(items);
          }
        })
        .catch(() => {
          if (!controller.signal.aborted) {
            setSuggestions([]);
          }
        })
        .finally(() => {
          if (!controller.signal.aborted) {
            setIsSuggesting(false);
          }
        });
    }, 260);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [locationQuery]);

  async function handleSearchOnMap() {
    const query = effectiveQuery.trim();
    if (query.length < 3) {
      setError('Isi alamat, kota, atau query lokasi dulu sebelum cari di peta.');
      setFeedback('');
      return;
    }

    setIsSearching(true);
    setError('');
    setFeedback('');

    try {
      const directPoint = parseLatLngFromMapsInput(query);
      if (directPoint) {
        onPointChange(directPoint);
        setFeedback('Titik usaha dipasang dari koordinat atau link maps yang kamu beri.');
        return;
      }

      const result = await geocodeLocation(query, {
        language: 'id',
      });

      if (!result) {
        setError('Lokasi belum ketemu. Tambahkan alamat lebih detail atau pilih saran di bawah.');
        return;
      }

      onPointChange(result.point);
      if (!locationQuery.trim()) {
        onLocationQueryChange(result.rawLabel);
      }
      setFeedback('Marker dipindahkan ke hasil pencarian. Geser sedikit kalau titiknya belum pas.');
    } catch {
      setError('Pencarian lokasi gagal. Coba lagi.');
    } finally {
      setIsSearching(false);
    }
  }

  function handleSelectSuggestion(item: LocationSuggestion) {
    onLocationQueryChange(item.rawLabel);
    onPointChange(item.point);
    setSuggestions([]);
    setError('');
    setFeedback('Lokasi dipilih dari hasil pencarian. Marker siap dikoreksi langsung di peta.');
  }

  function handleMapChange(nextPoint: LatLng) {
    onPointChange(nextPoint);
    setError('');
    setFeedback('Titik usaha diperbarui dari peta.');
  }

  function handleUseCurrentLocation() {
    if (!window.isSecureContext) {
      setError('Browser hanya mengizinkan GPS di HTTPS atau localhost.');
      setFeedback('');
      return;
    }

    if (!navigator.geolocation) {
      setError('Browser ini belum mendukung geolocation.');
      setFeedback('');
      return;
    }

    setIsLocating(true);
    setError('');
    setFeedback('');

    navigator.geolocation.getCurrentPosition(
      position => {
        onPointChange({
          lat: Number(position.coords.latitude.toFixed(6)),
          lng: Number(position.coords.longitude.toFixed(6)),
        });
        setFeedback('Lokasi perangkat dipakai sebagai titik usaha. Geser marker jika outlet tidak persis di sana.');
        setIsLocating(false);
      },
      geoError => {
        if (geoError.code === geoError.PERMISSION_DENIED) {
          setError('Izin lokasi ditolak. Aktifkan Location lalu coba lagi.');
        } else {
          setError('GPS belum bisa dibaca. Coba lagi beberapa saat.');
        }
        setIsLocating(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 12000,
        maximumAge: 10000,
      },
    );
  }

  return (
    <div className="grid gap-4 rounded-[24px] border border-portal-line/70 bg-portal-sand/30 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-portal-ink">Lokasi usaha di peta</p>
          <p className="mt-1 text-xs leading-5 text-portal-soft">
            Bisa paste link Google Maps, tulis nama tempat, atau langsung geser marker sampai titik outlet pas.
          </p>
        </div>
        <div className="rounded-full border border-portal-line/70 bg-white px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-portal-forest">
          {point ? 'Marker aktif' : 'Preview aktif'}
        </div>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Google Maps atau query lokasi
        <input
          placeholder="Paste link Google Maps, koordinat, atau nama tempat"
          value={locationQuery}
          onChange={event => onLocationQueryChange(event.target.value)}
          className="portal-input"
        />
      </label>

      {suggestions.length > 0 ? (
        <div className="grid gap-2 rounded-[20px] border border-portal-line/70 bg-white p-2">
          {suggestions.map(item => (
            <button
              key={`${item.rawLabel}-${item.point.lat}-${item.point.lng}`}
              type="button"
              onClick={() => handleSelectSuggestion(item)}
              className="rounded-2xl border border-transparent px-3 py-3 text-left transition hover:border-portal-line hover:bg-portal-sand/30"
            >
              <div className="text-sm font-semibold text-portal-ink">{item.title}</div>
              {item.subtitle ? (
                <div className="mt-1 text-xs leading-5 text-portal-soft">{item.subtitle}</div>
              ) : null}
              <div className="mt-1 text-[11px] leading-5 text-portal-soft">{item.rawLabel}</div>
            </button>
          ))}
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleSearchOnMap}
          disabled={isSearching}
          className="portal-button-secondary min-h-11 px-4"
        >
          {isSearching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          Cari di peta
        </button>
        <button
          type="button"
          onClick={handleUseCurrentLocation}
          disabled={isLocating}
          className="portal-button-secondary min-h-11 px-4"
        >
          {isLocating ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LocateFixed className="h-4 w-4" />
          )}
          Pakai lokasi saya
        </button>
        {googleMapsUrl ? (
          <a href={googleMapsUrl} target="_blank" rel="noreferrer" className="portal-button-secondary min-h-11 px-4">
            <MapPinned className="h-4 w-4" />
            Preview Google Maps
          </a>
        ) : null}
      </div>

      {effectiveQuery ? (
        <div className="rounded-[20px] border border-portal-line/70 bg-white px-4 py-3 text-xs leading-5 text-portal-soft">
          Query aktif: <span className="font-semibold text-portal-ink">{effectiveQuery}</span>
        </div>
      ) : null}

      <BusinessLocationMap
        value={point}
        searchQuery={effectiveQuery}
        onChange={handleMapChange}
        markerLabel={
          point
            ? 'Geser marker atau tap peta untuk koreksi titik usaha'
            : 'Tap peta atau cari alamat untuk pasang titik usaha'
        }
      />

      <div className="flex flex-wrap gap-2 text-xs">
        {point ? (
          <div className="rounded-full border border-portal-line/70 bg-white px-3 py-1.5 font-semibold text-portal-ink">
            Lat {point.lat} | Lng {point.lng}
          </div>
        ) : (
          <div className="rounded-full border border-portal-line/70 bg-white px-3 py-1.5 font-semibold text-portal-soft">
            Belum ada titik presisi tersimpan
          </div>
        )}
        {isSuggesting ? (
          <div className="rounded-full border border-portal-line/70 bg-white px-3 py-1.5 font-semibold text-portal-soft">
            Mencari saran alamat...
          </div>
        ) : null}
      </div>

      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {!error && feedback ? <p className="text-sm text-portal-forest">{feedback}</p> : null}
    </div>
  );
}
