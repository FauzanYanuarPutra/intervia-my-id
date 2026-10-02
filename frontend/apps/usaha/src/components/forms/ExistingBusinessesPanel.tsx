import Link from 'next/link';
import { ArrowRight, Building2, Plus, Store, Users } from 'lucide-react';
import type { BusinessRecord } from '@/lib/portal-types';

type ExistingBusinessesPanelProps = {
  businesses: BusinessRecord[];
};

export function ExistingBusinessesPanel({ businesses }: ExistingBusinessesPanelProps) {
  if (businesses.length === 0) return null;

  const visibleBusinesses = businesses.slice(0, 6);

  return (
    <section className="merchant-surface-bordered overflow-hidden">
      <div className="border-b border-portal-line/70 bg-[#fafbf9] px-4 py-3 sm:px-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-black uppercase tracking-[.1em] text-portal-forest">Sudah ada usaha</p>
            <h2 className="mt-1 text-base font-black text-portal-ink sm:text-lg">Mau pakai yang sudah ada?</h2>
            <p className="mt-1 max-w-2xl text-xs leading-5 text-portal-soft">
              Buka usaha yang benar sebelum membuat baru supaya tidak membuat workspace ganda.
            </p>
          </div>
          <span className="hidden shrink-0 rounded-full bg-white px-2.5 py-1 text-[10px] font-black text-portal-soft ring-1 ring-portal-line/70 sm:inline-flex">
            {businesses.length} usaha
          </span>
        </div>
      </div>

      <div className="grid gap-2 p-3 sm:p-4">
        {visibleBusinesses.map(business => {
          const joined = business.relationship === 'joined';
          const imageUrl = business.logoUrl || business.bannerUrl || business.imageUrls?.[0] || '';

          return (
            <Link
              key={business.id}
              href={'/?business=' + encodeURIComponent(business.id)}
              className="group flex min-w-0 items-center gap-3 rounded-2xl border border-portal-line/70 bg-white p-3 transition hover:border-portal-forest/40 hover:bg-portal-sand/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-portal-forest/40"
            >
              <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-2xl bg-portal-mist text-portal-forest">
                {imageUrl ? (
                  <img src={imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <Store className="h-5 w-5" />
                )}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex min-w-0 items-center gap-2">
                  <p className="truncate text-sm font-black text-portal-ink">{business.name}</p>
                  <span className="hidden shrink-0 rounded-full bg-portal-mist px-2 py-0.5 text-[9px] font-black text-portal-forest sm:inline-flex">
                    {joined ? 'Bergabung' : 'Milik akun'}
                  </span>
                </div>
                <p className="mt-0.5 truncate text-xs font-semibold text-portal-soft">
                  {[business.city, business.category].filter(Boolean).join(' · ') || 'Detail usaha belum lengkap'}
                </p>
                <p className="mt-1 inline-flex items-center gap-1 text-[10px] font-bold text-portal-soft">
                  {joined ? <Users className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}
                  {joined ? 'Akses ' + business.currentRole : 'Workspace di akun ini'}
                </p>
              </div>

              <ArrowRight className="h-4 w-4 shrink-0 text-portal-soft transition group-hover:translate-x-0.5 group-hover:text-portal-forest" />
            </Link>
          );
        })}

        {businesses.length > visibleBusinesses.length ? (
          <Link href="/" className="px-1 pt-1 text-center text-xs font-bold text-portal-forest">
            Lihat semua {businesses.length} usaha
          </Link>
        ) : null}

        <a
          href="#new-business-form"
          className="mt-1 flex min-h-11 items-center justify-center gap-2 rounded-2xl border border-dashed border-portal-forest/40 bg-portal-mist/35 px-3 text-sm font-black text-portal-forest transition hover:bg-portal-mist"
        >
          <Plus className="h-4 w-4" />
          Tetap buat usaha baru
        </a>
      </div>
    </section>
  );
}
