'use client';

import {
  ArrowRight,
  CheckCircle2,
  MessageCircle,
  PackagePlus,
  PauseCircle,
  Store,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';

type PromoOnlyAction = {
  href: string;
  label: string;
};

type PromoOnlyWorkspaceProps = {
  isId: boolean;
  title: string;
  description: string;
  primaryAction: PromoOnlyAction;
  secondaryAction: PromoOnlyAction;
  storeName?: string | null;
};

export function BusinessPromoOnlyWorkspace({
  isId,
  title,
  description,
  primaryAction,
  secondaryAction,
  storeName,
}: PromoOnlyWorkspaceProps) {
  const focusItems = [
    {
      icon: Store,
      title: isId ? 'Profil usaha jelas' : 'Clear business profile',
      desc: isId
        ? 'Nama, lokasi, kontak, foto, dan cerita usaha dibuat mudah dipercaya.'
        : 'Name, location, contact, photos, and story are easy to trust.',
    },
    {
      icon: PackagePlus,
      title: isId ? 'Katalog siap promosi' : 'Promo-ready catalog',
      desc: isId
        ? 'Produk atau jasa tampil rapi agar calon pelanggan paham dulu.'
        : 'Products or services look tidy so customers understand first.',
    },
    {
      icon: MessageCircle,
      title: isId ? 'Chat tetap aktif' : 'Chat stays active',
      desc: isId
        ? 'Calon pelanggan tetap bisa tanya-tanya sebelum transaksi dibuka.'
        : 'Customers can still ask questions before transactions go live.',
    },
  ];

  return (
    <section className="overflow-hidden rounded-[30px] border border-emerald-100 bg-[linear-gradient(135deg,#fffdf8_0%,#f1fbf3_48%,#eef7ff_100%)] p-4 shadow-[0_26px_62px_-48px_rgba(15,23,42,0.28)] dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.98),rgba(6,78,59,0.34),rgba(15,23,42,0.98))] sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="relative overflow-hidden rounded-[26px] border border-white/80 bg-white/88 p-5 shadow-[0_20px_44px_-36px_rgba(15,23,42,0.24)] dark:border-white/10 dark:bg-slate-950/72 sm:p-6">
          <div className="pointer-events-none absolute -right-14 -top-16 h-40 w-40 rounded-full bg-emerald-200/70 blur-3xl dark:bg-emerald-400/15" />
          <div className="relative">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-emerald-800 dark:border-emerald-400/20 dark:bg-emerald-400/10 dark:text-emerald-200">
              <PauseCircle className="h-4 w-4" />
              {isId ? 'Mode launching awal' : 'Early launch mode'}
            </span>
            <h1 className="mt-4 line-clamp-2 max-w-3xl text-2xl font-bold leading-tight tracking-tight text-slate-950 dark:text-white sm:text-4xl">
              {title}
            </h1>
            <p className="mt-3 line-clamp-3 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300 sm:text-base">
              {description}
            </p>

            {storeName ? (
              <div className="mt-4 inline-flex max-w-full items-center gap-2 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700 dark:border-white/10 dark:bg-white/8 dark:text-slate-100">
                <Store className="h-4 w-4 text-emerald-700 dark:text-emerald-300" />
                <span className="truncate">{storeName}</span>
              </div>
            ) : null}

            <div className="mt-5 grid gap-2 sm:flex sm:flex-wrap">
              <Link
                href={primaryAction.href}
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-emerald-700 px-4 text-sm font-bold text-white shadow-[0_14px_28px_-20px_rgba(21,128,61,0.9)] transition hover:bg-emerald-800"
              >
                <span>{primaryAction.label}</span>
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href={secondaryAction.href}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-800 transition hover:bg-slate-50 dark:border-white/10 dark:bg-white/8 dark:text-white dark:hover:bg-white/12"
              >
                {secondaryAction.label}
              </Link>
            </div>
          </div>
        </div>

        <aside className="rounded-[26px] border border-white/80 bg-white/86 p-4 shadow-[0_20px_44px_-36px_rgba(15,23,42,0.22)] dark:border-white/10 dark:bg-slate-950/72">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
            {isId ? 'Prioritas sekarang' : 'Current priority'}
          </p>
          <div className="mt-3 space-y-3">
            {focusItems.map((item, index) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className={cn(
                    'rounded-[20px] border p-3',
                    index === 1
                      ? 'border-sky-100 bg-sky-50/80 dark:border-sky-400/15 dark:bg-sky-400/10'
                      : 'border-emerald-100 bg-emerald-50/70 dark:border-emerald-400/15 dark:bg-emerald-400/10',
                  )}
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-emerald-700 shadow-sm dark:bg-white/10 dark:text-emerald-200">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-bold text-slate-950 dark:text-white">
                        {item.title}
                      </span>
                      <span className="mt-1 block line-clamp-2 text-xs leading-5 text-slate-600 dark:text-slate-300">
                        {item.desc}
                      </span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-4 rounded-[20px] border border-amber-100 bg-amber-50/85 p-3 text-xs leading-5 text-amber-900 dark:border-amber-400/20 dark:bg-amber-400/10 dark:text-amber-100">
            <div className="flex items-start gap-2">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {isId
                  ? 'Transaksi, saldo, QR bayar, dan kasir sengaja disembunyikan dulu sampai fase transaksi dibuka.'
                  : 'Transactions, balance, payment QR, and cashier tools are intentionally hidden until the commerce phase opens.'}
              </span>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
