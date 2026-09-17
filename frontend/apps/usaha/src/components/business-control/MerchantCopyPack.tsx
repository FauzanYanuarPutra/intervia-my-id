'use client';

import { useMemo, useState } from 'react';
import { Check, ChevronDown, ClipboardCopy, Copy } from 'lucide-react';
import type { BusinessRecord } from '@/lib/portal-types';

type Field = { label: string; value: string };

const channels = [
  { id: 'gofood', label: 'GoFood' },
  { id: 'grabfood', label: 'GrabFood' },
  { id: 'shopeefood', label: 'ShopeeFood' },
  { id: 'whatsapp', label: 'WhatsApp' },
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
  const selected = channels.find(item => item.id === channel);

  async function copy(label: string, value: string) {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(label);
    window.setTimeout(() => setCopied(null), 1500);
  }

  async function copyAll() {
    const text = [`DATA ${selected?.label.toUpperCase() ?? 'MERCHANT'}`, '', ...fields.map(field => `${field.label}: ${field.value || '-'}`)].join('\n');
    await navigator.clipboard.writeText(text);
    setCopied('all');
    window.setTimeout(() => setCopied(null), 1500);
  }

  return (
    <section className="portal-panel overflow-hidden">
      <div className="p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div><h2 className="font-bold text-portal-ink">Data merchant</h2><p className="mt-1 text-xs text-portal-soft">Pilih platform lalu salin data usaha.</p></div>
          <span className="rounded-full bg-portal-mist px-2.5 py-1 text-xs font-bold text-portal-forest">{readiness}% siap</span>
        </div>

        <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
          {channels.map(item => <button key={item.id} type="button" onClick={() => setChannel(item.id)} className={`shrink-0 rounded-full border px-3 py-2 text-xs font-bold ${channel === item.id ? 'border-portal-forest bg-portal-mist text-portal-forest' : 'border-portal-line bg-white text-portal-soft'}`}>{item.label}</button>)}
        </div>

        <button type="button" onClick={copyAll} className="portal-button-primary mt-4 w-full justify-center py-3">
          {copied === 'all' ? <Check className="h-4 w-4" /> : <ClipboardCopy className="h-4 w-4" />} {copied === 'all' ? 'Semua tersalin' : `Salin semua untuk ${selected?.label}`}
        </button>
      </div>

      <details className="group border-t border-portal-line">
        <summary className="flex cursor-pointer list-none items-center justify-between px-4 py-3 text-xs font-bold text-portal-soft sm:px-5">
          Detail data <ChevronDown className="h-4 w-4 transition group-open:rotate-180" />
        </summary>
        <div className="divide-y divide-portal-line border-t border-portal-line">
          {fields.map(field => (
            <div key={field.label} className="flex items-center justify-between gap-3 px-4 py-3 sm:px-5">
              <div className="min-w-0"><p className="text-[11px] font-semibold text-portal-soft">{field.label}</p><p className={`mt-0.5 truncate text-sm ${field.value ? 'font-semibold text-portal-ink' : 'text-amber-700'}`}>{field.value || 'Belum diisi'}</p></div>
              <button type="button" aria-label={`Salin ${field.label}`} disabled={!field.value} onClick={() => copy(field.label, field.value)} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-portal-line text-portal-soft disabled:opacity-30">{copied === field.label ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}</button>
            </div>
          ))}
        </div>
      </details>
    </section>
  );
}
