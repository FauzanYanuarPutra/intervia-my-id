'use client';

import { useEffect, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { MyProjectsSkeleton } from '@/components/system/feedback/RouteSkeletons';
import {
  MessageCircleMore,
  TrendingUp,
  PlusCircle,
  LayoutDashboard,
  LifeBuoy,
} from 'lucide-react';

type ChatRoom = {
  unread_count?: number;
};

type Transaction = {
  status?: string;
};

export default function MyProjectsPage() {
  const { user, authFetch } = useAuth();
  const [loading, setLoading] = useState(true);
  const [chatCount, setChatCount] = useState(0);
  const [unreadCount, setUnreadCount] = useState(0);
  const [transactionCount, setTransactionCount] = useState(0);
  const [activeTransactionCount, setActiveTransactionCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      if (!user) {
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const [chatRes, txRes] = await Promise.all([
          authFetch('/api/chat/inbox'),
          authFetch('/api/transactions'),
        ]);

        const chatData = (await chatRes.json().catch(() => ({}))) as {
          rooms?: ChatRoom[];
          data?: ChatRoom[];
        };
        const txData = (await txRes.json().catch(() => ({}))) as
          | Transaction[]
          | { data?: Transaction[] };

        const rooms = Array.isArray(chatData.rooms)
          ? chatData.rooms
          : Array.isArray(chatData.data)
            ? chatData.data
            : [];

        const transactions = Array.isArray(txData)
          ? txData
          : Array.isArray(txData.data)
            ? txData.data
            : [];

        if (!cancelled) {
          setChatCount(rooms.length);
          setUnreadCount(
            rooms.reduce(
              (total, room) => total + Math.max(0, room.unread_count || 0),
              0,
            ),
          );
          setTransactionCount(transactions.length);
          setActiveTransactionCount(
            transactions.filter(tx =>
              ['pending', 'accepted'].includes((tx.status || '').toLowerCase()),
            ).length,
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, [authFetch, user]);

  if (loading) {
    return <MyProjectsSkeleton />;
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-4 px-0 py-4 sm:px-5">
      <section className="rounded-none border border-x-0 border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:rounded-3xl sm:border-x">
        <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
          Projects Hub
        </p>
        <h1 className="mt-2 text-2xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          Kerjaan aktif Anda
        </h1>
        <p className="mt-1 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          Fokus ke tiga alur inti: komunikasi, transaksi, dan publikasi konten.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        <Link
          href="/chat"
          className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 transition hover:border-[color:var(--app-accent-border)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
        >
          <div className="flex items-center justify-between">
            <MessageCircleMore className="h-5 w-5 text-[color:var(--app-accent)]" />
            <span className="text-xs font-semibold text-[color:var(--app-text)]">
              {chatCount} room
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            Chat & Kolaborasi
          </p>
          <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {unreadCount} pesan belum dibaca.
          </p>
        </Link>

        <Link
          href="/transactions"
          className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 transition hover:border-[color:var(--app-accent-border)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
        >
          <div className="flex items-center justify-between">
            <TrendingUp className="h-5 w-5 text-[color:var(--app-accent)]" />
            <span className="text-xs font-semibold text-[color:var(--app-text)]">
              {transactionCount} total
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            Transaksi
          </p>
          <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {activeTransactionCount} transaksi sedang berjalan.
          </p>
        </Link>
      </section>

      <section className="rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <h2 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          Quick Actions
        </h2>
        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          <Link
            href="/create"
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-sm font-medium hover:border-[color:var(--app-accent-border)] dark:border-[color:var(--app-border-strong)]"
          >
            <PlusCircle className="h-4 w-4 text-[color:var(--app-accent)]" />
            Buat Postingan
          </Link>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-sm font-medium hover:border-[color:var(--app-accent-border)] dark:border-[color:var(--app-border-strong)]"
          >
            <LayoutDashboard className="h-4 w-4 text-[color:var(--app-accent)]" />
            Buka Dashboard
          </Link>
          <Link
            href="/support"
            className="inline-flex items-center gap-2 rounded-xl border border-[color:var(--app-border)] px-3 py-2 text-sm font-medium hover:border-[color:var(--app-accent-border)] dark:border-[color:var(--app-border-strong)]"
          >
            <LifeBuoy className="h-4 w-4 text-[color:var(--app-accent)]" />
            Pusat Bantuan
          </Link>
        </div>
      </section>
    </div>
  );
}
