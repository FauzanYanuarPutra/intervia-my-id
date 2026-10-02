'use client';

import { ArrowRight, CheckCircle2 } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { BrandSocialIcon } from '@/components/common/BrandSocialIcon';

const COMMUNITY_JOIN_HREF = '/community/join';

export function HomeCommunityJoinSection({ isId }: { isId: boolean }) {
  return (
    <section
      className="mx-1 overflow-hidden rounded-2xl border border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_58%,#eff6ff_100%)] px-3 py-2.5 shadow-[0_12px_28px_-24px_rgba(15,23,42,0.35)] sm:mx-0 sm:px-3.5 sm:py-3"
      aria-labelledby="home-community-join-title"
    >
      <div className="flex items-center gap-2.5 sm:gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white shadow-sm">
          <BrandSocialIcon brand="whatsapp" className="h-5 w-5" />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <p className="text-[9px] font-extrabold uppercase tracking-[0.12em] text-emerald-700">
              {isId ? 'Komunitas Rantai Usaha Lokal' : 'Local Business Chain Community'}
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-white/80 px-1.5 py-0.5 text-[8px] font-bold text-zinc-500 ring-1 ring-emerald-100">
              <CheckCircle2 className="h-2.5 w-2.5 text-emerald-600" />
              {isId ? 'gratis' : 'free'}
            </span>
          </div>

          <h2
            id="home-community-join-title"
            className="mt-0.5 truncate text-sm font-black tracking-[-0.02em] text-zinc-950 sm:text-[15px]"
          >
            {isId
              ? 'Cari supplier, pembeli, partner, & peluang usaha'
              : 'Find suppliers, buyers, partners & business opportunities'}
          </h2>

          <p className="mt-0.5 line-clamp-1 text-[10px] font-medium leading-4 text-zinc-500 sm:text-[11px]">
            {isId
              ? 'Lihat dulu tanpa login. Saat mau gabung, Lajukan bantu mencocokkan peranmu agar grup lebih relevan.'
              : 'Explore first without logging in. When you join, Lajukan helps match your role so the group stays relevant.'}
          </p>
        </div>

        <Link
          href={COMMUNITY_JOIN_HREF}
          className="inline-flex min-h-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-emerald-600 px-3 text-[10px] font-extrabold text-white shadow-[0_10px_20px_-14px_rgba(5,150,105,0.9)] transition hover:bg-emerald-700 active:scale-[0.98] sm:min-w-[126px]"
        >
          {isId ? 'Lihat & Gabung' : 'View & Join'}
          <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </section>
  );
}
