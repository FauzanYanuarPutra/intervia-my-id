'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Save } from 'lucide-react';
import { BusinessLocationField } from '@/components/forms/BusinessLocationField';
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
        }),
      });

      const result = (await response.json()) as { error?: string };

      if (!response.ok) {
        setError(result.error ?? 'Info usaha belum tersimpan.');
        return;
      }

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

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Deskripsi
        <textarea
          rows={4}
          value={description}
          onChange={event => setDescription(event.target.value)}
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

      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p className="text-sm text-portal-forest">{success}</p> : null}

      <button type="submit" disabled={isPending} className="portal-button-primary">
        <Save className="h-4 w-4" />
        {isPending ? 'Menyimpan...' : 'Simpan info'}
      </button>
    </form>
  );
}
