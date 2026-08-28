'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowRight, Building2, MapPinned, Phone } from 'lucide-react';
import { BusinessLocationField } from '@/components/forms/BusinessLocationField';
import type { LatLng } from '@/lib/maps';

const categoryOptions = ['Makanan dan minuman', 'Kopi dan cafe', 'Laundry', 'Toko kelontong', 'Jasa', 'Retail', 'Manufaktur', 'Usaha umum'];

type NewBusinessQuickFormProps = { initialOwnerName?: string; initialOwnerPhone?: string; initialOwnerEmail?: string };

export function NewBusinessQuickForm({ initialOwnerPhone = '' }: NewBusinessQuickFormProps) {
  const router = useRouter();
  const [name, setName] = useState('');
  const [category, setCategory] = useState(categoryOptions[0]);
  const [city, setCity] = useState('');
  const [address, setAddress] = useState('');
  const [locationQuery, setLocationQuery] = useState('');
  const [point, setPoint] = useState<LatLng | null>(null);
  const [phone, setPhone] = useState(initialOwnerPhone);
  const [error, setError] = useState('');
  const [pending, setPending] = useState(false);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); setError('');
    if (name.trim().length < 2) return setError('Isi nama usaha dulu.');
    if (city.trim().length < 2) return setError('Isi kota usaha.');
    if (phone.replace(/\s+/g, '').length < 9) return setError('Isi nomor usaha yang aktif.');
    if (!point) return setError('Pilih titik lokasi utama di peta.');
    setPending(true);
    try {
      const idempotencyKey = crypto.randomUUID();
      const response = await fetch('/api/businesses', { method: 'POST', headers: { 'Content-Type': 'application/json', 'Idempotency-Key': idempotencyKey }, body: JSON.stringify({ name: name.trim(), category, city: city.trim(), address: address.trim(), phone: phone.trim(), locationQuery: locationQuery.trim(), latitude: point.lat, longitude: point.lng, idempotencyKey }) });
      const result = (await response.json()) as { error?: string; redirectTo?: string };
      if (!response.ok || !result.redirectTo) throw new Error(result.error || 'Usaha belum berhasil dibuat.');
      startTransition(() => { router.push(result.redirectTo!); router.refresh(); });
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Koneksi bermasalah.'); }
    finally { setPending(false); }
  }

  const progress = [name.trim().length >= 2, city.trim().length >= 2, phone.replace(/\s+/g, '').length >= 9, Boolean(point)].filter(Boolean).length;
  return (
    <form onSubmit={submit} className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-[18px] bg-portal-sand/35 px-3 py-2"><span className="text-sm font-bold">Setup inti</span><span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-bold text-portal-forest">{progress}/4 siap</span></div>
      <section className="grid gap-3 rounded-[20px] border border-portal-line/70 bg-white p-4">
        <div className="flex items-center gap-2"><Building2 className="h-4 w-4 text-portal-forest" /><p className="font-bold">Tentang usaha</p></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-semibold">Nama usaha<input autoFocus autoComplete="organization" className="portal-input" value={name} onChange={event => setName(event.target.value)} placeholder="Contoh: Kedai Kopi Nusantara" /></label>
          <label className="grid gap-1.5 text-sm font-semibold">Kategori<select className="portal-input" value={category} onChange={event => setCategory(event.target.value)}>{categoryOptions.map(item => <option key={item}>{item}</option>)}</select></label>
          <label className="grid gap-1.5 text-sm font-semibold">Kota<input autoComplete="address-level2" className="portal-input" value={city} onChange={event => setCity(event.target.value)} placeholder="Bandung" /></label>
          <label className="grid gap-1.5 text-sm font-semibold"><span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> Nomor usaha</span><input autoComplete="tel" className="portal-input" value={phone} onChange={event => setPhone(event.target.value)} placeholder="0812..." /></label>
        </div>
      </section>
      <section className="grid gap-3 rounded-[20px] border border-portal-line/70 bg-white p-4">
        <div className="flex items-center gap-2"><MapPinned className="h-4 w-4 text-portal-forest" /><div><p className="font-bold">Lokasi utama</p><p className="text-xs text-portal-soft">Wajib supaya profil usaha siap ditemukan.</p></div></div>
        <label className="grid gap-1.5 text-sm font-semibold">Alamat<input autoComplete="street-address" className="portal-input" value={address} onChange={event => setAddress(event.target.value)} placeholder="Jalan, nomor, kecamatan, patokan" /></label>
        <BusinessLocationField businessName={name} address={address} city={city} locationQuery={locationQuery} point={point} onLocationQueryChange={setLocationQuery} onPointChange={setPoint} />
      </section>
      {error ? <p className="rounded-xl bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
      <div className="flex justify-end"><button type="submit" disabled={pending} className="portal-button-primary">{pending ? 'Membuat workspace...' : 'Buat usaha'} <ArrowRight className="h-4 w-4" /></button></div>
    </form>
  );
}
