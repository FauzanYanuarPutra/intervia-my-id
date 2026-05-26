'use client';

import { useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useChatInbox } from '@/context/ChatInboxContext';
import { MessageCircle, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from '@/i18n/navigation';

function normalizeRoomId(raw: unknown): string {
  const value = String(raw ?? '').trim();
  if (!value) return '';

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function getLatestRoom(rooms: unknown[]) {
  const rows = [...rooms] as any[];
  rows.sort((a, b) => {
    const aTime = new Date(a?.last_message_at ?? 0).getTime();
    const bTime = new Date(b?.last_message_at ?? 0).getTime();
    return bTime - aTime;
  });
  return rows[0] as any | undefined;
}

export default function ChatIndexPage() {
  const params = useParams() ?? {};
  const rawLocale = (params as { locale?: unknown })?.locale;
  const isId = rawLocale !== 'en';
  const { rooms: inboxRooms, loading } = useChatInbox();
  const router = useRouter();

  const latestRoom = useMemo(() => getLatestRoom(inboxRooms), [inboxRooms]);

  const openLatest = () => {
    const roomId = normalizeRoomId(latestRoom?.room_id ?? latestRoom?.id);
    if (!roomId) return;
    router.push(`/chat/${encodeURIComponent(roomId)}`);
  };

  const latestRoomName = (latestRoom?.room_name ??
    latestRoom?.name ??
    (isId ? 'Percakapan' : 'Conversation')) as string;
  const latestPreview = (latestRoom?.last_message ??
    latestRoom?.lastMsg ??
    (isId ? 'Belum ada chat' : 'No messages yet')) as string;

  return (
    <section className="hidden h-full min-h-0 flex-1 flex-col bg-[#efeae2] dark:bg-[#0b141a] lg:flex">
      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden px-6 py-8 xl:px-10">
        <div
          className="pointer-events-none absolute inset-0 opacity-70 dark:opacity-35"
          style={{
            backgroundImage:
              'radial-gradient(rgba(17,27,33,0.045) 1px, transparent 1px), radial-gradient(rgba(17,27,33,0.02) 1px, transparent 1px)',
            backgroundPosition: '0 0, 12px 12px',
            backgroundSize: '24px 24px',
          }}
        />

        <div className="relative w-full max-w-xl rounded-[28px] border border-black/5 bg-white/70 p-8 text-center shadow-[0_18px_46px_-30px_rgba(17,27,33,0.45)] backdrop-blur dark:border-white/10 dark:bg-[#202c33]/78">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-[#d9fdd3] dark:bg-[#103529]">
            <MessageCircle className="h-9 w-9 text-[#128c7e] dark:text-[#d1f4cc]" />
          </div>

          <h1 className="mt-6 text-[28px] font-light tracking-[-0.02em] text-[#111b21] dark:text-[#e9edef]">
            {isId
              ? 'Pilih chat'
              : 'Select a conversation to start'}
          </h1>
          <p className="mx-auto mt-3 max-w-md text-sm leading-6 text-[#667781] dark:text-[#8696a0]">
            {isId
              ? 'Buka chat, balas, lanjut deal.'
              : 'This chat area is tuned for a familiar, compact messaging flow so replying feels natural on desktop and mobile.'}
          </p>

          {loading ? (
            <div className="mt-8 inline-flex items-center gap-2 rounded-full bg-[#f0f2f5] px-4 py-2 text-sm text-[#54656f] dark:bg-[#111b21] dark:text-[#aebac1]">
              <Loader2 className="h-4 w-4 animate-spin text-[#25d366]" />
              {isId ? 'Menyiapkan chat...' : 'Loading chats...'}
            </div>
          ) : latestRoom ? (
            <div className="mt-8 rounded-[24px] bg-[#f0f2f5] p-4 text-left dark:bg-[#111b21]">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[#667781] dark:text-[#8696a0]">
                {isId ? 'Chat terbaru' : 'Latest conversation'}
              </p>
              <p className="mt-2 truncate text-base font-medium text-[#111b21] dark:text-[#e9edef]">
                {latestRoomName}
              </p>
              <p className="mt-1 line-clamp-1 text-sm leading-6 text-[#667781] dark:text-[#8696a0]">
                {latestPreview}
              </p>

              <button
                type="button"
                onClick={openLatest}
                className="mt-4 inline-flex items-center gap-2 rounded-full bg-[#25d366] px-4 py-2 text-sm font-semibold text-[#111b21] transition hover:bg-[#22c55e]"
              >
                {isId ? 'Buka terbaru' : 'Open latest'}
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          ) : (
            <p className="mt-8 text-sm text-[#667781] dark:text-[#8696a0]">
              {isId
                ? 'Belum ada chat.'
                : 'No conversations yet. Start a new chat from the left panel.'}
            </p>
          )}

          <p className="mt-8 text-xs text-[#667781] dark:text-[#8696a0]">
            {isId ? 'Satu room. Satu konteks.' : 'One room. One context.'}
          </p>
        </div>
      </div>
    </section>
  );
}
