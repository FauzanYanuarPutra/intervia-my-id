'use client';

import { ArrowRight, CheckCircle2, Users } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';

const COMMUNITY_JOIN_HREF = '/community/join';

export function HomeCommunityJoinSection({ isId }: { isId: boolean }) {
  const { isAuthenticated } = useAuth();

  return (
    <section className="mx-1 overflow-hidden rounded-[22px] border border-emerald-100 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_55%,#eff6ff_100%)] p-4 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.35)] sm:mx-0 sm:p-5" aria-labelledby="home-community-join-title">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-emerald-700">
              {isId ? 'Komunitas Rantai Usaha Lokal' : 'Local Business Chain Community'}
            </p>
            <h2 id="home-community-join-title" className="mt-1 text-lg font-black tracking-[-0.035em] text-zinc-950 sm:text-xl">
              {isId ? 'Gabung komunitas yang sesuai dengan usaha kamu' : 'Join the community that fits your business'}
            </h2>
            <p className="mt-1 max-w-2xl text-xs font-medium leading-5 text-zinc-600 sm:text-sm">
              {isId
                ? 'Login, cantumkan minimal 1 listing aktif usaha, lalu Lajukan bantu mengenali peranmu sebelum kamu masuk ke komunitas WhatsApp.'
                : 'Log in, add at least one business listing, then Lajukan identifies your role before you enter the WhatsApp community.'}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-[10px] font-bold text-zinc-600">
              {[
                'Login',
                isId ? '1 listing' : '1 listing',
                isId ? 'Dikelompokkan sesuai peran' : 'Role-based grouping',
              ].map(label => (
                <span key={label} className="inline-flex items-center gap-1 rounded-full bg-white/80 px-2.5 py-1 ring-1 ring-emerald-100">
                  <CheckCircle2 className="h-3 w-3 text-emerald-600" />
                  {label}
                </span>
              ))}
            </div>
          </div>
        </div>

        <Link
          href={isAuthenticated ? COMMUNITY_JOIN_HREF : '/login?next=%2Fcommunity%2Fjoin'}
          className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 text-xs font-extrabold text-white shadow-[0_14px_28px_-18px_rgba(5,150,105,0.8)] transition hover:bg-emerald-700 sm:min-w-[150px]"
        >
          {isId ? 'Gabung Sekarang' : 'Join Now'}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
