'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { BrandSocialIcon } from '@/components/common/BrandSocialIcon';

const COMMUNITY_JOIN_HREF = '/community/join';

export function HomeCommunityJoinSection({ isId }: { isId: boolean }) {
  return (
    <section
      className="mx-1 overflow-hidden rounded-2xl border border-emerald-500/30 bg-gradient-to-br from-emerald-600 via-emerald-600 to-emerald-700 px-2.5 py-2.5 shadow-[0_16px_32px_-22px_rgba(5,150,105,0.8)] sm:mx-0 sm:px-3.5 sm:py-3"
      aria-labelledby="home-community-join-title"
    >
      <div className="grid min-w-0 grid-cols-[auto_minmax(0,1fr)] gap-x-2.5 gap-y-2.5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center sm:gap-x-3 sm:gap-y-0">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-xl bg-white/12 text-white shadow-sm ring-1 ring-white/15 sm:self-center">
          <BrandSocialIcon brand="whatsapp" className="h-5 w-5" />
        </div>

        <div className="min-w-0">
          <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0.5">
            <p className="min-w-0 max-w-full text-[8px] font-extrabold uppercase tracking-[0.1em] text-white/85 sm:text-[9px] sm:tracking-[0.12em]">
              {isId ? 'Komunitas Rantai Usaha Lokal' : 'Local Business Chain Community'}
            </p>
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/12 px-1.5 py-0.5 text-[8px] font-bold text-white ring-1 ring-white/15">
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-100" />
              {isId ? 'gratis' : 'free'}
            </span>
          </div>

          <h2
            id="home-community-join-title"
            className="mt-0.5 text-[13px] font-black leading-[1.25] tracking-[-0.02em] text-white sm:text-[15px]"
          >
            {isId
              ? 'Cari supplier, pembeli, partner, & peluang usaha'
              : 'Find suppliers, buyers, partners & business opportunities'}
          </h2>

          <p className="mt-0.5 line-clamp-2 text-[9px] font-medium leading-4 text-white/78 sm:line-clamp-1 sm:text-[11px]">
            {isId
              ? 'Lihat dulu tanpa login. Saat mau gabung, Lajukan bantu mencocokkan peranmu agar grup lebih relevan.'
              : 'Explore first without logging in. When you join, Lajukan helps match your role so the group stays relevant.'}
          </p>
        </div>

        <Link
          href={COMMUNITY_JOIN_HREF}
          className="col-span-2 inline-flex min-h-10 w-full items-center justify-center gap-1.5 rounded-full bg-white px-3.5 text-[10px] font-extrabold text-emerald-700 shadow-[0_10px_20px_-14px_rgba(2,132,199,0.35)] transition hover:bg-emerald-50 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/80 focus-visible:ring-offset-2 focus-visible:ring-offset-emerald-600 sm:col-span-1 sm:w-auto sm:min-w-[126px] sm:px-3"
        >
          {isId ? 'Lihat & Gabung' : 'View & Join'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
