'use client';

import React, { useMemo } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

const CONTENT = [
  { title: 'Tren Energi Terbarukan 2026', status: 'Draft', sector: 'Energy' },
  { title: 'Panduan Tender Konstruksi', status: 'Published', sector: 'Industrials' },
  { title: 'Strategi Supply Chain 2026', status: 'Review', sector: 'Materials' },
];

const SECTORS = [
  'Energy',
  'Materials',
  'Industrials',
  'Consumer Discretionary',
  'Consumer Staples',
  'Health Care',
  'Financials',
  'Information Technology',
  'Communication Services',
  'Utilities',
  'Real Estate',
];

const BANNERS = [
  { name: 'Investor Promo', location: 'Home Hero', status: 'Active' },
  { name: 'Escrow Trust Week', location: 'Search Sidebar', status: 'Scheduled' },
];

export default function CmsDashboard() {
  const pathname = usePathname();
  const locale = useMemo(() => {
    const seg = pathname.split('/');
    return seg[1] && seg[1].length === 2 ? seg[1] : 'id';
  }, [pathname]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-10 sm:px-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] text-[color:var(--app-accent)]">
            CMS Control
          </p>
          <h1 className="text-3xl font-bold tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            Manage sectors, content, and knowledge base.
          </h1>
          <p className="mt-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            Konten di CMS akan mempengaruhi ranking search dan trust user.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/explore"
            className="rounded-full border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:var(--app-surface-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_5%,_transparent)] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]"
          >
            Preview Search
          </Link>
          <button className="rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-text-inverse)]">
            New Article
          </button>
        </div>
      </header>

      <section className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="rounded-2xl border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] p-6 shadow-sm">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
            Content Queue
          </p>
          <div className="mt-4 space-y-3">
            {CONTENT.map(item => (
              <div
                key={item.title}
                className="flex flex-col gap-1 rounded-xl border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_5%,_transparent)] bg-[color:var(--app-surface-muted)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_5%,_transparent)] p-4"
              >
                <p className="text-sm font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {item.title}
                </p>
                <p className="text-[10px] uppercase tracking-widest text-[color:var(--app-text-soft)]">
                  {item.sector} • {item.status}
                </p>
              </div>
            ))}
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
              Sector Manager
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
              {SECTORS.map(sector => (
                <span
                  key={sector}
                  className="rounded-lg border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_5%,_transparent)] bg-[color:var(--app-surface-muted)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_5%,_transparent)] px-2 py-1"
                >
                  {sector}
                </span>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:var(--app-surface-strong)] dark:bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
              Banner Management
            </p>
            <div className="mt-3 space-y-2">
              {BANNERS.map(banner => (
                <div
                  key={banner.name}
                  className="rounded-xl border border-[color:var(--app-border)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_5%,_transparent)] bg-[color:var(--app-surface-muted)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_5%,_transparent)] p-3"
                >
                  <p className="text-xs font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {banner.name}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-[color:var(--app-text-soft)]">
                    {banner.location} • {banner.status}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </div>
  );
}