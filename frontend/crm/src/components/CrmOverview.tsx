'use client';

import React, { useMemo } from 'react';
import { Button } from '@/ui';

export type DashboardQuickPreset = 'umkm' | 'service' | 'product' | 'project';

export type DashboardCatalogDraft = {
  title: string;
  summary: string;
  contentType: 'product' | 'service' | 'project' | 'request';
  sector: string;
  subSector: string;
  pricingMode: 'fixed' | 'request';
  price: string;
  status: 'draft' | 'active';
  tags: string;
};

type LeadSummary = {
  id: string;
  name: string;
  sector: string;
  contentType: string;
  status: string;
  value: number;
  currency?: string;
  stage: string;
  updated_at: string;
};

type TicketSummary = {
  status: string;
  priority: string;
  assigned_agent_id: string | null;
};

type SuperOrderSummary = {
  status: string;
  service_type: string;
  amount_estimate_cents: number;
  amount_final_cents: number;
  risk_score: number;
};

type ActivitySummary = {
  id: string;
  message: string;
  createdAtLabel: string;
};

type Props = {
  leads: LeadSummary[];
  tickets: TicketSummary[];
  superOrders: SuperOrderSummary[];
  activities: ActivitySummary[];
  draft: DashboardCatalogDraft;
  creating: boolean;
  error: string;
  success: string;
  onDraftChange: (field: keyof DashboardCatalogDraft, value: string) => void;
  onSubmit: () => void;
  onPresetSelect: (preset: DashboardQuickPreset) => void;
  onOpenPipeline: () => void;
  onOpenSupport: () => void;
  onOpenSuperApp: () => void;
};

const STAGE_LABELS: Record<string, string> = {
  lead: 'Lead',
  qualified: 'Qualified',
  negotiation: 'Negotiation',
  contract: 'Contract',
  won: 'Closed Won',
};

function formatCurrency(valueCents: number, currency: string = 'IDR'): string {
  const numeric = Number.isFinite(valueCents) ? valueCents : 0;
  const value = numeric / 100;
  const prefix = currency.toUpperCase() === 'IDR' ? 'Rp' : currency.toUpperCase();
  if (value >= 1_000_000_000) return `${prefix} ${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${prefix} ${(value / 1_000_000).toFixed(0)}jt`;
  return `${prefix} ${value.toLocaleString('id-ID')}`;
}

function stageProgress(stage: string): number {
  switch (stage) {
    case 'lead':
      return 20;
    case 'qualified':
      return 40;
    case 'negotiation':
      return 65;
    case 'contract':
      return 85;
    case 'won':
      return 100;
    default:
      return 16;
  }
}

function stageBadge(stage: string): string {
  switch (stage) {
    case 'won':
      return 'bg-[color:var(--color-primary-soft)] border-[color:var(--color-primary-border)] text-[color:var(--color-primary)]';
    case 'contract':
      return 'bg-[color:var(--color-primary-soft)] border-[color:var(--color-primary-border)] text-[color:var(--color-primary)]';
    case 'negotiation':
      return 'bg-[color:var(--color-primary-soft)] border-[color:var(--color-primary-border)] text-[color:var(--color-primary)]';
    default:
      return 'bg-[color:var(--color-primary-soft)] border-[color:var(--color-primary-border)] text-[color:var(--color-primary)]';
  }
}

function actionLabelForStage(stage: string): string {
  switch (stage) {
    case 'lead':
      return 'Kontak dan validasi kebutuhan';
    case 'qualified':
      return 'Dorong demo, sample, atau meeting';
    case 'negotiation':
      return 'Kunci pricing dan scope';
    case 'contract':
      return 'Finalisasi approval dan invoice';
    case 'won':
      return 'Naikkan repeat order dan retention';
    default:
      return 'Review kebutuhan operasional';
  }
}

function toneClass(tone: 'emerald' | 'sky' | 'amber' | 'rose'): string {
  switch (tone) {
    case 'emerald':
      return 'bg-[color:var(--color-primary-soft)] border-[color:var(--color-primary-border)] text-[color:var(--color-primary)]';
    case 'sky':
      return 'bg-[color:var(--color-primary-soft)] border-[color:var(--color-primary-border)] text-[color:var(--color-primary)]';
    case 'amber':
      return 'bg-[color:var(--color-primary-soft)] border-[color:var(--color-primary-border)] text-[color:var(--color-primary)]';
    case 'rose':
      return 'bg-[color:var(--color-primary-soft)] border-[color:var(--color-primary-border)] text-[color:var(--color-primary)]';
  }
}

export default function CrmOverview({
  leads,
  tickets,
  superOrders,
  activities,
  draft,
  creating,
  error,
  success,
  onDraftChange,
  onSubmit,
  onPresetSelect,
  onOpenPipeline,
  onOpenSupport,
  onOpenSuperApp,
}: Props) {
  const totalPipelineValue = useMemo(
    () => leads.reduce((sum, lead) => sum + (lead.value || 0), 0),
    [leads],
  );

  const sectorInsights = useMemo(() => {
    const buckets = new Map<string, { count: number; value: number }>();
    for (const lead of leads) {
      const key = (lead.sector || 'general').trim() || 'general';
      const current = buckets.get(key) || { count: 0, value: 0 };
      current.count += 1;
      current.value += lead.value || 0;
      buckets.set(key, current);
    }
    return [...buckets.entries()]
      .sort((a, b) => b[1].value - a[1].value || b[1].count - a[1].count)
      .slice(0, 5)
      .map(([label, bucket]) => ({
        label,
        count: bucket.count,
        valueLabel: formatCurrency(bucket.value, 'IDR'),
        share: leads.length ? Math.max(8, Math.round((bucket.count / leads.length) * 100)) : 0,
      }));
  }, [leads]);

  const spotlightLeads = useMemo(() => {
    return [...leads]
      .sort((a, b) => b.value - a.value)
      .slice(0, 4)
      .map((lead) => ({
        id: lead.id,
        title: lead.name,
        subtitle: `${lead.contentType}  -  ${lead.sector}`,
        valueLabel: formatCurrency(lead.value, lead.currency || 'IDR'),
        badge: STAGE_LABELS[lead.stage] || lead.stage,
        badgeClass: stageBadge(lead.stage),
        progress: stageProgress(lead.stage),
        note: `${lead.status}  -  ${lead.updated_at}`,
      }));
  }, [leads]);

  const focusLead = useMemo(() => {
    return [...leads].sort((a, b) => b.value - a.value)[0] || null;
  }, [leads]);

  const resolvedTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'resolved' || ticket.status === 'closed').length,
    [tickets],
  );
  const openTickets = useMemo(
    () => tickets.filter((ticket) => ticket.status === 'open' || ticket.status === 'in_progress').length,
    [tickets],
  );
  const pendingVerification = useMemo(
    () => superOrders.filter((order) => order.status === 'pending_verification').length,
    [superOrders],
  );
  const superActive = useMemo(
    () => superOrders.filter((order) => order.status === 'dispatching' || order.status === 'in_progress').length,
    [superOrders],
  );
  const riskyOrders = useMemo(
    () => superOrders.filter((order) => order.risk_score >= 70 || order.status === 'disputed').length,
    [superOrders],
  );
  const servicePortfolioCount = useMemo(
    () => leads.filter((lead) => lead.contentType === 'service').length,
    [leads],
  );
  const productPortfolioCount = useMemo(
    () => leads.filter((lead) => lead.contentType === 'product').length,
    [leads],
  );
  const umkmPortfolioCount = useMemo(
    () =>
      leads.filter((lead) => {
        const sector = (lead.sector || '').toLowerCase();
        return (
          sector.includes('umkm') ||
          sector.includes('kuliner') ||
          sector.includes('retail') ||
          sector.includes('merchant') ||
          lead.contentType === 'product'
        );
      }).length,
    [leads],
  );

  const focusAnalytics = useMemo(() => {
    if (!focusLead) return null;
    const contribution = totalPipelineValue > 0 ? Math.round((focusLead.value / totalPipelineValue) * 100) : 0;
    return {
      title: focusLead.name,
      subtitle: `${focusLead.contentType.toUpperCase()}  -  ${focusLead.sector}`,
      items: [
        {
          label: 'Stage',
          value: STAGE_LABELS[focusLead.stage] || focusLead.stage,
          hint: 'Posisi entitas di funnel sekarang',
        },
        {
          label: 'Kontribusi',
          value: `${contribution}%`,
          hint: 'Share ke total pipeline value',
        },
        {
          label: 'Nilai estimasi',
          value: formatCurrency(focusLead.value, focusLead.currency || 'IDR'),
          hint: 'Potensi closing saat ini',
        },
        {
          label: 'Aksi',
          value: actionLabelForStage(focusLead.stage),
          hint: 'Rekomendasi tindak lanjut',
        },
      ],
    };
  }, [focusLead, totalPipelineValue]);

  const reportCards = useMemo(
    () => [
      {
        title: 'Laporan Global',
        summary: 'Ringkasan funnel, support, dan dispatch dalam satu snapshot operasional.',
        stats: [`${leads.length} total portofolio`, `${resolvedTickets}/${tickets.length || 0} ticket selesai`, `${superActive} order aktif`],
        tone: 'emerald' as const,
      },
      {
        title: 'Laporan UMKM',
        summary: 'Pantau UMKM dan listing commerce yang paling berpengaruh ke pipeline.',
        stats: [`${umkmPortfolioCount} portofolio UMKM`, `${productPortfolioCount} listing produk`, `${sectorInsights[0]?.label || 'general'} sektor terkuat`],
        tone: 'sky' as const,
      },
      {
        title: 'Laporan Jasa',
        summary: 'Lihat jasa yang butuh follow up cepat dan nilai deal terbesar.',
        stats: [`${servicePortfolioCount} listing jasa`, `${spotlightLeads.length} entitas prioritas`, `${openTickets} ticket paralel`],
        tone: 'amber' as const,
      },
      {
        title: 'Laporan Operasional',
        summary: 'SLA support, verifikasi risk, dan order bermasalah dalam satu panel.',
        stats: [`${pendingVerification} pending verify`, `${riskyOrders} order risk tinggi`, `${openTickets} support aktif`],
        tone: 'rose' as const,
      },
    ],
    [leads.length, openTickets, pendingVerification, productPortfolioCount, resolvedTickets, riskyOrders, sectorInsights, servicePortfolioCount, spotlightLeads.length, superActive, tickets.length, umkmPortfolioCount],
  );

  const quickActionCards = [
    {
      title: 'Tambah UMKM',
      description: 'Buka draft untuk merchant, lapak, atau UMKM baru langsung dari dashboard.',
      hint: `${umkmPortfolioCount} portofolio UMKM aktif`,
      action: () => onPresetSelect('umkm'),
      tone: 'emerald' as const,
    },
    {
      title: 'Tambah Jasa',
      description: 'Siapkan listing jasa baru untuk kebutuhan sales, vendor, atau partner.',
      hint: `${servicePortfolioCount} jasa sedang dipantau`,
      action: () => onPresetSelect('service'),
      tone: 'sky' as const,
    },
    {
      title: 'Tambah Produk',
      description: 'Masukkan produk, stok awal, atau katalog unggulan untuk UMKM tertentu.',
      hint: `${productPortfolioCount} produk di CRM`,
      action: () => onPresetSelect('product'),
      tone: 'amber' as const,
    },
    {
      title: 'Tambah Project',
      description: 'Catat peluang proyek atau permintaan besar yang perlu tracking khusus.',
      hint: `${pendingVerification + superActive} order super app live`,
      action: () => onPresetSelect('project'),
      tone: 'rose' as const,
    },
  ];

  return (
    <div className="grid gap-6 xl:grid-cols-[1.4fr_1fr]">
      <div className="space-y-6">
        <section className="glass-panel rounded-3xl p-5" data-tour="crm-dashboard-actions">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-primary)]">
                Dashboard Center
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-[color:var(--color-primary)]">
                Pusat kontrol UMKM, jasa, analytics, dan laporan
              </h2>
              <p className="mt-2 text-sm text-[color:var(--color-primary)]">
                Tambah listing baru, pantau analitik global, cek performa entitas fokus, lalu lompat ke pipeline, support, dan super app tanpa pindah konteks.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-1 text-xs font-semibold text-[color:var(--color-primary)]">
                Global analytics
              </span>
              <span className="rounded-full border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-1 text-xs font-semibold text-[color:var(--color-primary)]">
                Per UMKM / entitas
              </span>
              <span className="rounded-full border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-1 text-xs font-semibold text-[color:var(--color-primary)]">
                Laporan operasional
              </span>
            </div>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {quickActionCards.map((card) => (
              <div
                key={card.title}
                className={`rounded-3xl border bg-gradient-to-br p-4 ${toneClass(card.tone)}`}
              >
                <p className="text-sm font-semibold text-[color:var(--color-primary)]">{card.title}</p>
                <p className="mt-2 text-sm text-[color:var(--color-primary)]">{card.description}</p>
                <p className="mt-3 text-xs font-medium text-[color:var(--color-primary)]">{card.hint}</p>
                <Button onClick={card.action} className="mt-4 rounded-full px-4 py-2 text-xs">
                  Buka Draft
                </Button>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button variant="secondary" onClick={onOpenPipeline} className="rounded-full px-4 py-2 text-xs">
              Lihat Pipeline
            </Button>
            <Button
              variant="secondary"
              onClick={onOpenSupport}
              className="rounded-full px-4 py-2 text-xs"
              data-tour="crm-open-support"
            >
              Buka Support
            </Button>
            <Button variant="secondary" onClick={onOpenSuperApp} className="rounded-full px-4 py-2 text-xs">
              Buka Super App
            </Button>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
          <section className="glass-panel rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-primary)]">Analitik Global</p>
                <h3 className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">Sektor dan channel yang paling sehat</h3>
              </div>
              <span className="rounded-full text-[color:var(--color-primary)] px-3 py-1 text-xs font-semibold text-[color:var(--color-primary)]">
                {sectorInsights.length} insight
              </span>
            </div>
            <div className="mt-4 space-y-3">
              {sectorInsights.length === 0 ? (
                <p className="text-sm text-[color:var(--color-primary)]">Belum ada data sektor untuk dianalisis.</p>
              ) : (
                sectorInsights.map((sector) => (
                  <div key={sector.label} className="rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--color-primary)]">{sector.label}</p>
                        <p className="text-xs text-[color:var(--color-primary)]">{sector.count} listing aktif dipantau</p>
                      </div>
                      <p className="text-sm font-semibold text-[color:var(--color-primary)]">{sector.valueLabel}</p>
                    </div>
                    <div className="mt-3 h-2 overflow-hidden rounded-full text-[color:var(--color-primary)]">
                      <div
                        className="h-full rounded-full bg-gradient-to-r bg-[color:var(--color-primary-soft)] border-[color:var(--color-primary-border)] text-[color:var(--color-primary)]"
                        style={{ width: `${sector.share}%` }}
                      />
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="glass-panel rounded-3xl p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-primary)]">Analitik Entitas Fokus</p>
                <h3 className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">Satu UMKM / listing yang harus kamu jaga</h3>
              </div>
            </div>
            {!focusAnalytics ? (
              <p className="mt-4 text-sm text-[color:var(--color-primary)]">Belum ada entitas fokus.</p>
            ) : (
              <div className="mt-4">
                <div className="rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] p-4">
                  <p className="text-base font-semibold text-[color:var(--color-primary)]">{focusAnalytics.title}</p>
                  <p className="mt-1 text-sm text-[color:var(--color-primary)]">{focusAnalytics.subtitle}</p>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2">
                  {focusAnalytics.items.map((item) => (
                    <div key={item.label} className="rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] p-4">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--color-primary)]">
                        {item.label}
                      </p>
                      <p className="mt-2 text-sm font-semibold text-[color:var(--color-primary)]">{item.value}</p>
                      <p className="mt-1 text-xs text-[color:var(--color-primary)]">{item.hint}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        </div>

        <section className="glass-panel rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-primary)]">Portfolio Spotlight</p>
              <h3 className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">UMKM, jasa, dan listing paling prioritas</h3>
            </div>
            <span className="rounded-full text-[color:var(--color-primary)] px-3 py-1 text-xs font-semibold text-[color:var(--color-primary)]">
              {spotlightLeads.length} entitas
            </span>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {spotlightLeads.length === 0 ? (
              <p className="text-sm text-[color:var(--color-primary)]">Belum ada portfolio highlight.</p>
            ) : (
              spotlightLeads.map((lead) => (
                <div key={lead.id} className="rounded-3xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold text-[color:var(--color-primary)]">{lead.title}</p>
                      <p className="mt-1 text-xs text-[color:var(--color-primary)]">{lead.subtitle}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${lead.badgeClass}`}>
                      {lead.badge}
                    </span>
                  </div>
                  <p className="mt-3 text-lg font-semibold text-[color:var(--color-primary)]">{lead.valueLabel}</p>
                  <div className="mt-3 h-2 overflow-hidden rounded-full text-[color:var(--color-primary)]">
                    <div
                      className="h-full rounded-full bg-gradient-to-r bg-[color:var(--color-primary-soft)] border-[color:var(--color-primary-border)] text-[color:var(--color-primary)]"
                      style={{ width: `${lead.progress}%` }}
                    />
                  </div>
                  <p className="mt-3 text-xs text-[color:var(--color-primary)]">{lead.note}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-2">
          {reportCards.map((card) => (
            <div
              key={card.title}
              className={`glass-panel rounded-3xl border bg-gradient-to-br p-5 ${toneClass(card.tone)}`}
            >
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--color-primary)]">{card.title}</p>
              <p className="mt-2 text-lg font-semibold text-[color:var(--color-primary)]">{card.summary}</p>
              <div className="mt-4 space-y-2 text-sm text-[color:var(--color-primary)]">
                {card.stats.map((stat) => (
                  <div key={stat} className="rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2">
                    {stat}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </section>
      </div>

      <div className="space-y-6">
        <section id="crm-quick-create" className="glass-panel rounded-3xl p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-primary)]">Quick Create</p>
              <h3 className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">Tambah UMKM, jasa, produk, atau project</h3>
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onPresetSelect('umkm')} className="rounded-full px-3 py-2 text-xs">
              Preset UMKM
            </Button>
            <Button variant="secondary" onClick={() => onPresetSelect('service')} className="rounded-full px-3 py-2 text-xs">
              Preset Jasa
            </Button>
            <Button variant="secondary" onClick={() => onPresetSelect('product')} className="rounded-full px-3 py-2 text-xs">
              Preset Produk
            </Button>
            <Button variant="secondary" onClick={() => onPresetSelect('project')} className="rounded-full px-3 py-2 text-xs">
              Preset Project
            </Button>
          </div>

          <div className="mt-4 grid gap-3">
            <label className="text-xs font-medium text-[color:var(--color-primary)]">
              Nama UMKM / Jasa / Listing
              <input
                value={draft.title}
                onChange={(event) => onDraftChange('title', event.target.value)}
                className="mt-1 w-full rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2 text-sm text-[color:var(--color-primary)]"
                placeholder="Contoh: Kopi Nusantara Cibubur"
              />
            </label>

            <label className="text-xs font-medium text-[color:var(--color-primary)]">
              Ringkasan
              <textarea
                value={draft.summary}
                onChange={(event) => onDraftChange('summary', event.target.value)}
                className="mt-1 min-h-[96px] w-full rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2 text-sm text-[color:var(--color-primary)]"
                placeholder="Tulis ringkasan bisnis, jasa, atau kebutuhan listing yang akan dimasukkan ke CRM."
              />
            </label>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-[color:var(--color-primary)]">
                Jenis
                <select
                  value={draft.contentType}
                  onChange={(event) => onDraftChange('contentType', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2 text-sm text-[color:var(--color-primary)]"
                >
                  <option value="product">UMKM / Produk</option>
                  <option value="service">Jasa</option>
                  <option value="project">Project</option>
                  <option value="request">Request</option>
                </select>
              </label>
              <label className="text-xs font-medium text-[color:var(--color-primary)]">
                Status awal
                <select
                  value={draft.status}
                  onChange={(event) => onDraftChange('status', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2 text-sm text-[color:var(--color-primary)]"
                >
                  <option value="draft">Draft</option>
                  <option value="active">Active</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-[color:var(--color-primary)]">
                Sektor
                <input
                  value={draft.sector}
                  onChange={(event) => onDraftChange('sector', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2 text-sm text-[color:var(--color-primary)]"
                  placeholder="umkm, kuliner, retail, jasa-bangunan"
                />
              </label>
              <label className="text-xs font-medium text-[color:var(--color-primary)]">
                Sub sektor
                <input
                  value={draft.subSector}
                  onChange={(event) => onDraftChange('subSector', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2 text-sm text-[color:var(--color-primary)]"
                  placeholder="kopi, catering, desain, logistik"
                />
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-[color:var(--color-primary)]">
                Mode pricing
                <select
                  value={draft.pricingMode}
                  onChange={(event) => onDraftChange('pricingMode', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2 text-sm text-[color:var(--color-primary)]"
                >
                  <option value="fixed">Fixed</option>
                  <option value="request">By Request</option>
                </select>
              </label>
              <label className="text-xs font-medium text-[color:var(--color-primary)]">
                Harga (Rp)
                <input
                  value={draft.price}
                  onChange={(event) => onDraftChange('price', event.target.value)}
                  className="mt-1 w-full rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2 text-sm text-[color:var(--color-primary)]"
                  placeholder="500000"
                  disabled={draft.pricingMode === 'request'}
                />
              </label>
            </div>

            <label className="text-xs font-medium text-[color:var(--color-primary)]">
              Tag
              <input
                value={draft.tags}
                onChange={(event) => onDraftChange('tags', event.target.value)}
                className="mt-1 w-full rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2 text-sm text-[color:var(--color-primary)]"
                placeholder="umkm, lokal, unggulan"
              />
            </label>
          </div>

          {error ? (
            <div className="mt-4 rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2 text-sm text-[color:var(--color-primary)]">
              {error}
            </div>
          ) : null}
          {success ? (
            <div className="mt-4 rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] px-3 py-2 text-sm text-[color:var(--color-primary)]">
              {success}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <Button onClick={onSubmit} disabled={creating} className="rounded-full px-4 py-2 text-xs">
              {creating ? 'Menyimpan...' : 'Simpan ke CRM'}
            </Button>
            <p className="text-xs text-[color:var(--color-primary)]">
              Data baru langsung masuk ke lead / pipeline CRM dan bisa dianalisis dari dashboard ini.
            </p>
          </div>
        </section>

        <section className="glass-panel rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-primary)]">Activity Feed</p>
              <h3 className="mt-1 text-lg font-semibold text-[color:var(--color-primary)]">Gerakan terbaru tim</h3>
            </div>
          </div>

          <div className="mt-4 space-y-3">
            {activities.length === 0 ? (
              <p className="text-sm text-[color:var(--color-primary)]">Belum ada aktivitas terbaru.</p>
            ) : (
              activities.slice(0, 6).map((activity) => (
                <div key={activity.id} className="rounded-2xl border border-[color:var(--color-primary-border)] text-[color:var(--color-primary)] p-4">
                  <p className="text-sm text-[color:var(--color-primary)]">{activity.message}</p>
                  <p className="mt-2 text-xs text-[color:var(--color-primary)]">{activity.createdAtLabel}</p>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
