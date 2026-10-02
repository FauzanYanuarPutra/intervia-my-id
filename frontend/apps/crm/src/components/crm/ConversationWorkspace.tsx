'use client';

import { useMemo, useState } from 'react';
import { ExternalLink, MessageCircle } from 'lucide-react';
import { Card, EmptyState, PageHeader, StatusBadge } from 'lajukan-ui';
import type { CrmChatRow } from './models';
import { rankConversations } from './queues';

const WEB_ORIGIN = (process.env.NEXT_PUBLIC_LAJUKAN_WEB_ORIGIN || 'https://www.lajukan.com').replace(/\/$/, '');

export function ConversationWorkspace({ chats }: { chats: CrmChatRow[] }) {
  const ranked = useMemo(() => rankConversations(chats), [chats]);
  const [selectedId, setSelectedId] = useState('');
  const selected = ranked.find(x => x.id === selectedId) || ranked[0] || null;

  const openChat = () => {
    if (!selected?.id) return;
    window.open(
      `${WEB_ORIGIN}/id/chat/${encodeURIComponent(selected.id)}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Percakapan"
        description="Inbox CRM menampilkan percakapan berintensi tinggi. Buka room asli untuk membalas tanpa membuat salinan chat di CRM."
      />

      <div className="grid min-h-0 gap-3 xl:grid-cols-[320px_minmax(0,1fr)]">
        <Card className={`p-2 ${selected ? 'order-2 xl:order-1' : 'order-1'}`}>
          <div className="max-h-[52vh] space-y-1.5 overflow-y-auto pr-1 xl:max-h-[calc(100vh-210px)]">
            {ranked.map(chat => (
              <button
                key={chat.id}
                type="button"
                onClick={() => setSelectedId(chat.id)}
                className={`w-full rounded-xl border p-2.5 text-left transition ${selected?.id === chat.id ? 'border-emerald-300 bg-emerald-50' : 'border-[color:var(--color-border)] hover:bg-slate-50'}`}
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-bold">{chat.name}</p>
                  {chat.unread ? <StatusBadge tone="success">{chat.unread} unread</StatusBadge> : null}
                </div>
                <p className="mt-1 line-clamp-2 text-xs text-[color:var(--color-text-soft)]">{chat.lastMessage}</p>
              </button>
            ))}
            {!ranked.length ? (
              <EmptyState
                title="Belum ada percakapan"
                description="Percakapan akan muncul ketika data real tersedia."
              />
            ) : null}
          </div>
        </Card>

        <Card className={`p-4 sm:p-5 ${selected ? 'order-1 xl:order-2' : 'order-2'}`}>
          {selected ? (
            <div>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <MessageCircle className="h-4 w-4 text-emerald-600" />
                    <h2 className="text-lg font-bold">{selected.name}</h2>
                    <StatusBadge tone={selected.stage === 'Hot' ? 'warning' : 'neutral'}>{selected.stage}</StatusBadge>
                  </div>
                  <p className="mt-4 rounded-2xl bg-[color:var(--color-surface-muted)] p-4 text-sm leading-6">
                    {selected.lastMessage || 'Pesan belum tersedia dari sumber chat.'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={openChat}
                  className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3.5 text-xs font-black text-white hover:bg-emerald-700"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  Buka chat
                </button>
              </div>

              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-[color:var(--color-text-soft)]">Sumber</dt>
                  <dd className="font-bold">{selected.source}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--color-text-soft)]">Listing</dt>
                  <dd className="font-bold">{selected.listingTitle || '-'}</dd>
                </div>
                <div>
                  <dt className="text-[color:var(--color-text-soft)]">Room</dt>
                  <dd className="truncate font-mono text-xs">{selected.id}</dd>
                </div>
              </dl>

              <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50/60 p-3 text-xs leading-5 text-emerald-900">
                CRM hanya menyimpan konteks dan aktivitas penting. Isi percakapan tetap dimiliki Chat Service, sehingga agent bekerja pada room yang sama dengan pengguna.
              </div>
            </div>
          ) : (
            <EmptyState title="Pilih percakapan" description="Pilih inbox untuk melihat konteks dan membuka room chat asli." />
          )}
        </Card>
      </div>
    </div>
  );
}
