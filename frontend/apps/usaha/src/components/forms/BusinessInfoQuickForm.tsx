'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { BusinessLocationField } from '@/components/forms/BusinessLocationField';
import { businessApiErrorMessage } from '@/lib/business-api-error';
import { toLatLng } from '@/lib/maps';
import { buildBusinessGoogleMapsUrl } from '@/lib/portal-links';
import type { BusinessRecord } from '@/lib/portal-types';

type BusinessInfoQuickFormProps = {
  business: BusinessRecord;
};

export function BusinessInfoQuickForm({ business }: BusinessInfoQuickFormProps) {
  const router = useRouter();
  const [name, setName] = useState(business.name);
  const [category, setCategory] = useState(business.category);
  const [city, setCity] = useState(business.city);
  const [address, setAddress] = useState(business.address);
  const [locationQuery, setLocationQuery] = useState(business.locationQuery);
  const [point, setPoint] = useState(() => toLatLng(business.latitude, business.longitude));
  const [phone, setPhone] = useState(business.phone);
  const [description, setDescription] = useState(business.description);
  const [schedule, setSchedule] = useState(business.schedule);
  const [reason, setReason] = useState('Pembaruan info usaha');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (name.trim().length < 2) {
      setError('Nama usaha belum valid.');
      return;
    }

    if (city.trim().length < 2) {
      setError('Kota usaha belum valid.');
      return;
    }

    if (phone.replace(/\s+/g, '').trim().length < 9) {
      setError('Nomor usaha belum valid.');
      return;
    }

    if (schedule.trim().length < 5) {
      setError('Jam buka belum valid.');
      return;
    }

    if (reason.trim().length < 3) {
      setError('Tulis alasan perubahan info usaha minimal 3 karakter.');
      return;
    }

    setError('');
    setSuccess('');
    setIsPending(true);

    try {
      const response = await fetch(`/api/businesses/${business.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: name.trim(),
          category: category.trim(),
          city: city.trim(),
          address: address.trim(),
          locationQuery: locationQuery.trim(),
          latitude: point?.lat ?? null,
          longitude: point?.lng ?? null,
          phone: phone.trim(),
          description: description.trim(),
          schedule: schedule.trim(),
          reason: reason.trim(),
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(businessApiErrorMessage(result, 'Info usaha belum tersimpan.', response.status));
        return;
      }

      setReason('Pembaruan info usaha');
      setSuccess('Info usaha tersimpan.');
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setError('Koneksi lagi bermasalah. Coba lagi.');
    } finally {
      setIsPending(false);
    }
  }

  const locationPreviewUrl = buildBusinessGoogleMapsUrl({
    name,
    address,
    city,
    locationQuery,
    latitude: point?.lat ?? null,
    longitude: point?.lng ?? null,
  });

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Nama usaha
          <input
            value={name}
            onChange={event => setName(event.target.value)}
            className="portal-input"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Kategori
          <input
            value={category}
            onChange={event => setCategory(event.target.value)}
            className="portal-input"
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Kota
          <input
            value={city}
            onChange={event => setCity(event.target.value)}
            className="portal-input"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Nomor usaha
          <input
            inputMode="tel"
            value={phone}
            onChange={event => setPhone(event.target.value)}
            className="portal-input"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Alamat singkat
        <input
          value={address}
          onChange={event => setAddress(event.target.value)}
          className="portal-input"
        />
      </label>

      <BusinessLocationField
        businessName={name}
        address={address}
        city={city}
        locationQuery={locationQuery}
        point={point}
        onLocationQueryChange={setLocationQuery}
        onPointChange={setPoint}
      />

      {locationPreviewUrl ? (
        <a href={locationPreviewUrl} target="_blank" rel="noreferrer" className="portal-button-secondary min-h-11 px-4">
          Cek pratinjau Google Maps
        </a>
      ) : null}

      <details className="group rounded-[16px] border border-portal-line bg-white">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3.5 text-sm font-bold text-portal-ink">
          <span>Detail tambahan <span className="ml-2 text-xs font-normal text-portal-soft">Deskripsi & jam buka</span></span>
          <span className="text-xs font-bold text-portal-forest group-open:hidden">Buka</span>
          <span className="hidden text-xs font-bold text-portal-forest group-open:inline">Tutup</span>
        </summary>
        <div className="grid gap-4 border-t border-portal-line p-4">
          <label className="grid gap-2 text-sm font-semibold text-portal-ink">
            Deskripsi usaha
            <textarea
              rows={3}
              value={description}
              onChange={event => setDescription(event.target.value)}
              placeholder="Contoh: Jus segar, es teler, dan minuman untuk dibawa pulang."
              className="portal-textarea"
            />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-portal-ink">
            Jam buka
            <input
              value={schedule}
              onChange={event => setSchedule(event.target.value)}
              placeholder="08.00 - 20.00"
              className="portal-input"
            />
          </label>
        </div>
      </details>

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Catatan perubahan
        <input
          value={reason}
          onChange={event => setReason(event.target.value)}
          maxLength={500}
          placeholder="Contoh: nomor usaha diperbarui"
          className="portal-input"
          aria-describedby="business-info-change-reason-hint"
        />
        <span id="business-info-change-reason-hint" className="text-[11px] font-normal leading-5 text-portal-soft">
          Sudah diisi otomatis. Ganti bila perlu untuk memberi konteks perubahan. Disimpan di riwayat perubahan.
        </span>
      </label>

      {error ? <p role="alert" className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p role="status" aria-live="polite" className="text-sm text-portal-forest">{success}</p> : null}

      <button type="submit" disabled={isPending || reason.trim().length < 3} className="portal-button-primary">
        <Save className="h-4 w-4" />
        {isPending ? 'Menyimpan...' : 'Simpan info'}
      </button>
    </form>
  );
}
