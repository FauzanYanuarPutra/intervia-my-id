'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, ChevronDown, MapPinned, UserRound } from 'lucide-react';
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

  const requiredFilledCount = [
    businessName.trim(),
    city.trim(),
    phone.replace(/\s+/g, '').trim(),
  ].filter(Boolean).length;

  return (
    <form onSubmit={handleSubmit} className="grid gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] border border-portal-line/70 bg-portal-sand/25 px-3 py-2">
        <div className="inline-flex items-center gap-2 text-sm font-bold text-portal-ink">
          <Building2 className="h-4 w-4 text-portal-forest" />
          Data wajib dulu
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]">
          <span className="rounded-full bg-white px-2.5 py-1 text-portal-forest">
            {requiredFilledCount}/3 terisi
          </span>
          <span className="rounded-full bg-white px-2.5 py-1 text-portal-soft">Peta opsional</span>
        </div>
      </div>

      <section className="grid gap-3 rounded-[18px] border border-portal-line/70 bg-white p-3">
        <div className="flex items-center gap-2">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-[14px] bg-portal-forest/10 text-portal-forest">
            <Building2 className="h-4 w-4" />
          </span>
          <div>
            <p className="text-sm font-bold text-portal-ink">Info usaha</p>
            <p className="text-xs text-portal-soft">Yang wajib biar usaha langsung bisa dibuat.</p>
          </div>
        </div>

        <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
          Nama usaha
          <input
            autoFocus
            autoComplete="organization"
            placeholder="Contoh: Warung Barokah"
            value={businessName}
            onChange={event => setBusinessName(event.target.value)}
            className="portal-input"
          />
        </label>

        <div className="grid gap-3 sm:grid-cols-3">
          <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
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

          <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
            Kota
            <input
              autoComplete="address-level2"
              placeholder="Depok"
              value={city}
              onChange={event => setCity(event.target.value)}
              className="portal-input"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
            Nomor usaha
            <input
              autoComplete="tel"
              inputMode="tel"
              placeholder="0812 1111 2222"
              value={phone}
              onChange={event => setPhone(event.target.value)}
              className="portal-input"
            />
          </label>
        </div>
      </section>

      <details className="group rounded-[18px] border border-portal-line/70 bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-portal-sand/70 text-portal-forest">
              <MapPinned className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-portal-ink">Alamat & peta</span>
              <span className="block truncate text-xs text-portal-soft">Bisa dilengkapi sekarang atau nanti.</span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-portal-soft transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-portal-line/70 p-3">
          <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
            Alamat singkat
            <input
              autoComplete="street-address"
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
        </div>
      </details>

      <details className="group rounded-[18px] border border-portal-line/70 bg-white">
        <summary className="flex min-h-12 cursor-pointer list-none items-center justify-between gap-3 px-3 py-2.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-portal-sand/70 text-portal-forest">
              <UserRound className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-sm font-bold text-portal-ink">Kontak pemilik</span>
              <span className="block truncate text-xs text-portal-soft">Opsional, buat admin internal.</span>
            </span>
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-portal-soft transition group-open:rotate-180" />
        </summary>
        <div className="grid gap-3 border-t border-portal-line/70 p-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
            Nama pemilik
            <input
              autoComplete="name"
              placeholder="Nama admin/pemilik"
              value={ownerName}
              onChange={event => setOwnerName(event.target.value)}
              className="portal-input"
            />
          </label>

          <label className="grid gap-1.5 text-sm font-semibold text-portal-ink">
            Email pemilik
            <input
              autoComplete="email"
              inputMode="email"
              placeholder="Opsional"
              value={ownerEmail}
              onChange={event => setOwnerEmail(event.target.value)}
              className="portal-input"
            />
          </label>
        </div>
      </details>

      {error ? <p className="text-sm text-portal-ember">{error}</p> : null}
      {success ? <p className="text-sm text-portal-forest">{success}</p> : null}

      <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs leading-5 text-portal-soft">
          Setelah dibuat, kamu langsung masuk dashboard dan bisa edit lagi.
        </p>
        <button type="submit" disabled={isPending} className="portal-button-primary shrink-0">
          {isPending ? 'Membuat...' : 'Buat usaha'}
          <ArrowRight className="h-4 w-4" />
        </button>
      </div>
    </form>
  );
}
