'use client';

import { useMemo, useState } from 'react';
import { Check, ClipboardCopy, Copy, ExternalLink } from 'lucide-react';
import type { BusinessRecord } from '@/lib/portal-types';

type Field = { label: string; value: string };

const channels = [
  { id: 'gofood', label: 'GoFood', hint: 'Salin data lalu tempel di dashboard/aplikasi merchant.' },
  { id: 'grabfood', label: 'GrabFood', hint: 'Gunakan data canonical yang sama untuk outlet dan menu.' },
  { id: 'shopeefood', label: 'ShopeeFood', hint: 'Siapkan profil outlet sebelum mengelola menu.' },
  { id: 'whatsapp', label: 'WhatsApp', hint: 'Cocok untuk katalog dan pesan bisnis.' },
] as const;

export function MerchantCopyPack({ business }: { business: BusinessRecord }) {
  const [channel, setChannel] = useState<(typeof channels)[number]['id']>('gofood');
  const [copied, setCopied] = useState<string | null>(null);

  const fields = useMemo<Field[]>(() => [
    { label: 'Nama usaha', value: business.name },
    { label: 'Kategori', value: business.category },
    { label: 'Deskripsi', value: business.description },
    { label: 'Nomor telepon', value: business.phone },
    { label: 'Alamat', value: business.address },
    { label: 'Kota', value: business.city },
    { label: 'Jam operasional', value: business.schedule },
    { label: 'Link lokasi', value: business.googleMapsUrl },
  ], [business]);

  const complete = fields.filter(field => field.value.trim()).length;
  const readiness = Math.round((complete / fields.length) * 100);

  async function copy(label: string, value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1500);
  }

  async function copyAll() {
    const selected = channels.find(item => item.id === channel);
    const text = [`DATA ${selected?.label.toUpperCase() ?? 'MERCHANT'}`, '', ...fields.map(field => `${field.label}: ${field.value || '-'}`)].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied('all');
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <div className="portal-panel overflow-hidden">
      <div className="border-b border-portal-line p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div><p className="portal-kicker">Sekali isi, pakai ulang</p><h2 className="mt-1 text-lg font-bold text-portal-ink">Paket profil merchant</h2><p className="mt-1 max-w-2xl text-sm leading-6 text-portal-soft">Pilih kanal, lalu salin field satu-satu atau semuanya. Tujuannya mengurangi ketik ulang dan perbedaan data antar platform.</p></div>
          <div className="rounded-2xl bg-portal-mist px-4 py-3 text-right"><p className="portal-label">Kesiapan data</p><p className="mt-1 text-xl font-bold text-portal-forest">{readiness}%</p></div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {channels.map(item => <button key={item.id} type="button" onClick={() => setChannel(item.id)} className={`rounded-xl border px-3 py-2 text-xs font-bold ${channel === item.id ? 'border-portal-forest bg-portal-mist text-portal-forest' : 'border-portal-line bg-white text-portal-soft'}`}>{item.label}</button>)}
        </div>
      </div>

      <div className="divide-y divide-portal-line">
        {fields.map(field => (
          <div key={field.label} className="flex items-start justify-between gap-3 px-4 py-3 sm:px-5">
            <div className="min-w-0"><p className="portal-label">{field.label}</p><p className={`mt-1 break-words text-sm ${field.value ? 'font-semibold text-portal-ink' : 'text-amber-700'}`}>{field.value || 'Belum diisi'}</p></div>
            <button type="button" disabled={!field.value} onClick={() => copy(field.label, field.value)} className="portal-button-secondary shrink-0 disabled:cursor-not-allowed disabled:opacity-40">{copied === field.label ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />} {copied === field.label ? 'Tersalin' : 'Copy'}</button>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 border-t border-portal-line bg-[#fafbf9] p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="text-xs leading-5 text-portal-soft"><p className="font-bold text-portal-ink">{channels.find(item => item.id === channel)?.label}</p><p>{channels.find(item => item.id === channel)?.hint}</p></div>
        <button type="button" onClick={copyAll} className="portal-button-primary"><ClipboardCopy className="h-4 w-4" /> {copied === 'all' ? 'Semua tersalin' : 'Copy semua data'} <ExternalLink className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}
