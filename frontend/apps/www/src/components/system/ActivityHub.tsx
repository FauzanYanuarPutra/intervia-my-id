'use client';

import { useCallback, useEffect, useState } from 'react';
import { ArrowRight, Briefcase, CircleDot, CreditCard, Loader2, MessageCircle, PlusSquare, RefreshCcw, ShieldCheck } from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useTranslations } from 'next-intl';
import { SuperAppSnapshot } from '@/components/system/SuperAppOperatingSystem';

type ListingItem = {
  id: string;
  title?: string;
  status?: string;
  updated_at?: string;
  created_at?: string;
};

type TransactionItem = {
  id: string;
  status?: string;
  amount_cents?: number;
  updated_at?: string;
};

type ChatRoom = {
  id?: string;
  room_id?: string;
  room_name?: string;
  name?: string;
  last_message?: string;
  last_message_at?: string;
};

function formatCount(value: number) {
  return new Intl.NumberFormat().format(value);
}

export function ActivityHub() {
  const { user, authFetch, loading: authLoading } = useAuth();
  const t = useTranslations('Flow.activityHub');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [rooms, setRooms] = useState<ChatRoom[]>([]);

  const loadHub = useCallback(async (silent = false) => {
    if (silent) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const [listingRes, txnRes, chatRes] = await Promise.all([
        authFetch('/api/my-listings', { cache: 'no-store' }),
        authFetch('/api/transactions?limit=6', { cache: 'no-store' }),
        authFetch('/api/chat/inbox', { cache: 'no-store' }),
      ]);

      const listingData = await listingRes.json().catch(() => ({}));
      const txnData = await txnRes.json().catch(() => ({}));
      const chatData = await chatRes.json().catch(() => ({}));

      setListings(Array.isArray(listingData?.items) ? listingData.items : []);
      setTransactions(Array.isArray(txnData?.items) ? txnData.items : Array.isArray(txnData) ? txnData : []);
      setRooms(Array.isArray(chatData?.items) ? chatData.items : Array.isArray(chatData?.rooms) ? chatData.rooms : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [authFetch, t]);

  useEffect(() => {
    if (authLoading || !user) return;
    void loadHub();
  }, [authLoading, user, loadHub]);

  const activeListings = listings.filter((item) => String(item.status || '').toLowerCase() === 'active').length;
  const draftListings = listings.filter((item) => String(item.status || '').toLowerCase() === 'draft').length;
  const activeTransactions = transactions.filter((item) => !['completed', 'cancelled'].includes(String(item.status || '').toLowerCase())).length;
  const latestRoom = [...rooms].sort((a, b) => new Date(b.last_message_at || 0).getTime() - new Date(a.last_message_at || 0).getTime())[0];
  const latestRoomId = String(latestRoom?.room_id || latestRoom?.id || '').trim();

  if (authLoading || loading) {
    return (
      <div className="page-shell py-10">
        <div className="ui-panel rounded-3xl p-6 text-sm text-[color:var(--app-text-soft)]">
          <span className="inline-flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--app-accent)]" />
            {t('loading')}
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="page-shell py-10">
        <div className="ui-panel rounded-3xl p-6">
          <p className="text-sm text-[color:var(--app-text-soft)]">{t('loginPrompt')}</p>
          <Link href="/login" className="ui-button-primary mt-4 inline-flex items-center px-4 text-sm">
            {t('loginCta')}
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-shell page-rhythm py-6">
      <section className="ui-panel ui-hero-panel rounded-[32px] p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.22em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
              {t('eyebrow')}
            </p>
            <h1 className="mt-2 text-3xl font-bold tracking-tight text-[color:var(--app-text)]">
              {t('title')}
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
              {t('description')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/explore" className="ui-button-secondary inline-flex items-center px-4 text-sm">
              {t('searchCta')}
            </Link>
            <Link href="/create?mode=quick" className="ui-button-primary inline-flex items-center px-4 text-sm">
              {t('createCta')}
            </Link>
          </div>
        </div>
      </section>

      {error ? (
        <div className="mt-4 rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-3 text-sm text-[color:var(--app-accent)]">
          {error}
        </div>
      ) : null}

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: t('statActiveListings'), value: activeListings, icon: Briefcase },
          { label: t('statDraftListings'), value: draftListings, icon: PlusSquare },
          { label: t('statTransactions'), value: activeTransactions, icon: CreditCard },
          { label: t('statChats'), value: rooms.length, icon: MessageCircle },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <article key={item.label} className="ui-panel ui-card-hover rounded-3xl p-5">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-[linear-gradient(135deg,_var(--app-accent),_var(--app-accent-strong))] text-[color:var(--app-accent)]">
                <Icon className="h-5 w-5" />
              </span>
              <p className="mt-4 text-3xl font-bold tracking-tight text-[color:var(--app-text)]">{formatCount(item.value)}</p>
              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">{item.label}</p>
            </article>
          );
        })}
      </section>

      <SuperAppSnapshot />

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-[1.05fr_0.95fr]">
        <article className="ui-panel rounded-3xl p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {t('nextEyebrow')}
              </p>
              <h2 className="mt-1 text-xl font-bold tracking-tight text-[color:var(--app-text)]">
                {t('nextTitle')}
              </h2>
            </div>
            <button
              type="button"
              onClick={() => void loadHub(true)}
              className="ui-shell-button px-3 py-2 text-xs font-semibold text-[color:var(--app-text-soft)]"
            >
              <RefreshCcw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              {t('refresh')}
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <Link href="/explore" className="ui-panel-muted ui-card-hover flex items-start justify-between rounded-2xl p-4">
              <div>
                <p className="text-sm font-bold text-[color:var(--app-text)]">{t('nextSearchTitle')}</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">{t('nextSearchDesc')}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[color:var(--app-text-soft)]" />
            </Link>
            <Link href="/create?mode=quick" className="ui-panel-muted ui-card-hover flex items-start justify-between rounded-2xl p-4">
              <div>
                <p className="text-sm font-bold text-[color:var(--app-text)]">{t('nextCreateTitle')}</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">{t('nextCreateDesc')}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[color:var(--app-text-soft)]" />
            </Link>
            <Link href={latestRoomId ? `/chat/${encodeURIComponent(latestRoomId)}` : '/chat'} className="ui-panel-muted ui-card-hover flex items-start justify-between rounded-2xl p-4">
              <div>
                <p className="text-sm font-bold text-[color:var(--app-text)]">{t('nextChatTitle')}</p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">{latestRoom?.last_message || t('nextChatDesc')}</p>
              </div>
              <ArrowRight className="h-4 w-4 text-[color:var(--app-text-soft)]" />
            </Link>
          </div>
        </article>

        <article className="ui-panel rounded-3xl p-5">
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
            {t('healthEyebrow')}
          </p>
          <h2 className="mt-1 text-xl font-bold tracking-tight text-[color:var(--app-text)]">
            {t('healthTitle')}
          </h2>
          <div className="mt-4 space-y-3">
            <div className="ui-panel-muted rounded-2xl p-4">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
                <CircleDot className="h-4 w-4 text-[color:var(--app-accent)]" />
                {t('draftTitle')}
              </p>
              <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                {t('draftDesc', { count: draftListings })}
              </p>
            </div>
            <div className="ui-panel-muted rounded-2xl p-4">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
                <CircleDot className="h-4 w-4 text-[color:var(--app-accent)]" />
                {t('txnTitle')}
              </p>
              <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                {t('txnDesc', { count: activeTransactions })}
              </p>
            </div>
            <div className="ui-panel-muted rounded-2xl p-4">
              <p className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
                <ShieldCheck className="h-4 w-4 text-[color:var(--app-accent)]" />
                {t('helpTitle')}
              </p>
              <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                {t('helpDesc')}
              </p>
              <Link href="/support" className="mt-3 inline-flex items-center gap-2 text-xs font-bold bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                {t('supportCta')}
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
