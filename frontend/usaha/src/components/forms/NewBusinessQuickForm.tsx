'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight } from 'lucide-react';
import { BusinessLocationField } from '@/components/forms/BusinessLocationField';
import type { LatLng } from '@/lib/maps';

const categoryOptions = [
  'Makanan dan minuman',
  'Kopi dan cafe',
  'Laundry',
  'Toko kelontong',
  'Jasa',
];

type NewBusinessQuickFormProps = {
  initialOwnerName?: string;
  initialOwnerPhone?: string;
  initialOwnerEmail?: string;
};

export function NewBusinessQuickForm({
  initialOwnerName = '',
  initialOwnerPhone = '',
  initialOwnerEmail = '',
}: NewBusinessQuickFormProps) {
  const router = useRouter();
  const [businessName, setBusinessName] = useState('');
  const [category, setCategory] = useState(categoryOptions[0]);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [phone, setPhone] = useState(initialOwnerPhone);
  const [ownerName, setOwnerName] = useState(initialOwnerName);
  const [ownerEmail, setOwnerEmail] = useState(initialOwnerEmail);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isPending, setIsPending] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (businessName.trim().length < 2) {
      setError('Isi nama usaha dulu.');
      return;
    }

    if (city.trim().length < 2) {
      setError('Isi kota usaha.');
      return;
    }

    if (phone.replace(/\s+/g, '').trim().length < 9) {
      setError('Isi nomor usaha yang aktif.');
      return;
    }

    setError('');
    setSuccess('');
    setIsPending(true);

    try {
      const response = await fetch('/api/businesses', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: businessName.trim(),
          category,
          city: city.trim(),
          address: address.trim(),
          locationQuery: locationQuery.trim(),
          latitude: point?.lat ?? null,
          longitude: point?.lng ?? null,
          phone: phone.trim(),
          ownerName: ownerName.trim(),
          ownerEmail: ownerEmail.trim(),
        }),
      });

      const result = (await response.json()) as {
        error?: string;
        redirectTo?: string;
      };

      if (!response.ok || !result.redirectTo) {
        setError(result.error ?? 'Usaha belum berhasil dibuat. Coba lagi.');
        return;
      }

      setSuccess('Usaha dibuat. Masuk ke dashboard...');
      startTransition(() => {
        router.push(result.redirectTo!);
        router.refresh();
      });
    } catch {
      setError('Koneksi lagi bermasalah. Coba lagi.');
    } finally {
      setIsPending(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="grid gap-4">
      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Nama usaha
        <input
          autoFocus
          placeholder="Contoh: Warung Barokah"
          value={businessName}
          onChange={event => setBusinessName(event.target.value)}
          className="portal-input"
        />
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Kategori
          <select
            value={category}
            onChange={event => setCategory(event.target.value)}
            className="portal-input"
          >
            {categoryOptions.map(option => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Kota
          <input
            placeholder="Contoh: Depok"
            value={city}
            onChange={event => setCity(event.target.value)}
            className="portal-input"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Alamat singkat
        <input
          placeholder="Jalan, area, atau patokan"
          value={address}
          onChange={event => setAddress(event.target.value)}
          className="portal-input"
        />
      </label>

      <BusinessLocationField
        businessName={businessName}
        address={address}
        city={city}
        locationQuery={locationQuery}
        point={point}
        onLocationQueryChange={setLocationQuery}
        onPointChange={setPoint}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Nomor usaha
          <input
            inputMode="tel"
            placeholder="0812 1111 2222"
            value={phone}
            onChange={event => setPhone(event.target.value)}
            className="portal-input"
          />
        </label>

        <label className="grid gap-2 text-sm font-semibold text-portal-ink">
          Nama pemilik
          <input
            placeholder="Siapa yang pegang usaha ini?"
            value={ownerName}
            onChange={event => setOwnerName(event.target.value)}
            className="portal-input"
          />
        </label>
      </div>

      <label className="grid gap-2 text-sm font-semibold text-portal-ink">
        Email pemilik
        <input
          inputMode="email"
          placeholder="Opsional"
          value={ownerEmail}
          onChange={event => setOwnerEmail(event.target.value)}
          className="portal-input"
        />
      </label>

      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p className="text-sm text-portal-forest">{success}</p> : null}

      <button type="submit" disabled={isPending} className="portal-button-primary">
        {isPending ? 'Membuat usaha...' : 'Buat usaha sekarang'}
        <ArrowRight className="h-4 w-4" />
      </button>
    </form>
  );
}
