'use client';

import { useState } from 'react';
import { MapPin, Plus, Save, Trash2 } from 'lucide-react';
import { BusinessLocationField } from '@/components/forms/BusinessLocationField';
import type { BusinessLocation } from '@/lib/portal-types';
import type { LatLng } from '@/lib/maps';

export function BusinessLocationsManager({ businessId, businessName, initialLocations }: { businessId: string; businessName: string; initialLocations: BusinessLocation[] }) {
  const [locations, setLocations] = useState(initialLocations);
  const [editing, setEditing] = useState<BusinessLocation | null>(null);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  function newLocation(): BusinessLocation {
    return {
      id: crypto.randomUUID(), name: '', locationType: 'physical', address: '', city: '', province: '', district: '', postalCode: '',
      latitude: null, longitude: null, phone: '', whatsapp: '', timezone: 'Asia/Jakarta', businessHours: {}, status: 'active',
      isPrimary: locations.length === 0, publicVisibility: true,
    };
  }

  async function save(next: BusinessLocation[]) {
    setSaving(true); setError('');
    try {
      const response = await fetch(`/api/businesses/${encodeURIComponent(businessId)}/locations`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ locations: next }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Lokasi belum berhasil disimpan.');
      setLocations(next); setEditing(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Lokasi belum berhasil disimpan.');
    } finally { setSaving(false); }
  }

  const point: LatLng | null = editing?.latitude != null && editing?.longitude != null ? { lat: editing.latitude, lng: editing.longitude } : null;

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><p className="text-sm font-bold text-portal-ink">{locations.length} lokasi</p><p className="text-xs text-portal-soft">Kelola cabang, pin peta, kontak, dan visibilitas publik.</p></div>
        <button type="button" className="portal-button-primary" onClick={() => setEditing(newLocation())}><Plus className="h-4 w-4" /> Tambah lokasi</button>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        {locations.map(location => (
          <button key={location.id} type="button" onClick={() => setEditing(location)} className="rounded-[20px] border border-portal-line/70 bg-white p-4 text-left transition hover:border-portal-forest/40">
            <div className="flex items-start gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-portal-forest/10 text-portal-forest"><MapPin className="h-4 w-4" /></span><div className="min-w-0"><div className="flex flex-wrap items-center gap-2"><p className="font-bold text-portal-ink">{location.name || 'Lokasi usaha'}</p>{location.isPrimary ? <span className="rounded-full bg-portal-sand px-2 py-0.5 text-[10px] font-bold text-portal-forest">Utama</span> : null}</div><p className="mt-1 text-xs leading-5 text-portal-soft">{[location.address, location.city].filter(Boolean).join(', ') || 'Alamat belum lengkap'}</p></div></div>
          </button>
        ))}
      </div>

      {editing ? (
        <div className="rounded-[24px] border border-portal-line bg-white p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm font-semibold">Nama lokasi<input className="portal-input" value={editing.name} onChange={event => setEditing({ ...editing, name: event.target.value })} placeholder="Cabang Sindanglaya" /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Kota<input className="portal-input" value={editing.city} onChange={event => setEditing({ ...editing, city: event.target.value })} placeholder="Bandung" /></label>
            <label className="grid gap-1.5 text-sm font-semibold sm:col-span-2">Alamat<input className="portal-input" value={editing.address} onChange={event => setEditing({ ...editing, address: event.target.value })} placeholder="Jalan, nomor, kecamatan, patokan" /></label>
            <label className="grid gap-1.5 text-sm font-semibold">Telepon<input className="portal-input" value={editing.phone} onChange={event => setEditing({ ...editing, phone: event.target.value })} /></label>
            <label className="grid gap-1.5 text-sm font-semibold">WhatsApp<input className="portal-input" value={editing.whatsapp} onChange={event => setEditing({ ...editing, whatsapp: event.target.value })} /></label>
          </div>
          <div className="mt-4"><BusinessLocationField businessName={businessName} address={editing.address} city={editing.city} locationQuery={[editing.name, editing.address, editing.city].filter(Boolean).join(', ')} point={point} onLocationQueryChange={() => {}} onPointChange={next => setEditing({ ...editing, latitude: next?.lat ?? null, longitude: next?.lng ?? null })} /></div>
          <label className="mt-4 flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={editing.isPrimary} onChange={event => setEditing({ ...editing, isPrimary: event.target.checked })} /> Jadikan lokasi utama</label>
          {error ? <p className="mt-3 text-sm text-portal-ember">{error}</p> : null}
          <div className="mt-4 flex flex-wrap justify-between gap-2">
            <button type="button" className="portal-button-secondary" onClick={() => void save(locations.filter(item => item.id !== editing.id))}><Trash2 className="h-4 w-4" /> Hapus</button>
            <div className="flex gap-2"><button type="button" className="portal-button-secondary" onClick={() => setEditing(null)}>Batal</button><button type="button" disabled={saving || !editing.name.trim() || editing.latitude === null || editing.longitude === null} className="portal-button-primary" onClick={() => { const normalized = editing.isPrimary ? locations.map(item => ({ ...item, isPrimary: false })) : locations; const exists = normalized.some(item => item.id === editing.id); void save(exists ? normalized.map(item => item.id === editing.id ? editing : item) : [...normalized, editing]); }}><Save className="h-4 w-4" /> {saving ? 'Menyimpan...' : 'Simpan lokasi'}</button></div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
