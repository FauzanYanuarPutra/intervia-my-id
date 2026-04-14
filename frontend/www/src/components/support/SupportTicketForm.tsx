'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { Channel } from 'phoenix';
import { useLocale } from 'next-intl';
import { useAuth } from '@/context/AuthContext';
import { CaptchaField } from '@/components/security/CaptchaField';
import { joinRoom, onMessage, sendMessageViaSocket } from '@/lib/chat';

type Ticket = {
  id: string;
  category: string;
  subject: string;
  status: string;
  priority: string;
  created_at: string;
  updated_at: string;
  support_room_id?: string | null;
};

type TicketListResponse = {
  items?: Ticket[];
};

type TicketReply = {
  id: string;
  author_role: string;
  body: string;
  is_internal: boolean;
  created_at: string;
};

type TicketDetail = {
  ticket: Ticket;
  replies: TicketReply[];
};

type ChatMessage = {
  id: string;
  sender_id: string;
  content: string;
  message_type: string;
  attachments: string[];
  created_at: string;
};

function getCategoryOptions(isId: boolean) {
  return [
    { value: 'account', label: isId ? 'Akun & login' : 'Account & Login' },
    { value: 'payment', label: isId ? 'Pembayaran & tagihan' : 'Payment & Billing' },
    { value: 'transaction', label: isId ? 'Proyek / transaksi' : 'Project/Transaction' },
    { value: 'security', label: isId ? 'Keamanan & penyalahgunaan' : 'Security & Abuse' },
    { value: 'technical', label: isId ? 'Masalah teknis' : 'Technical Issue' },
    { value: 'other', label: isId ? 'Lainnya' : 'Other' },
  ];
}

function getPriorityOptions(isId: boolean) {
  return [
    { value: 'normal', label: isId ? 'Normal' : 'Normal' },
    { value: 'high', label: isId ? 'Tinggi' : 'High' },
    { value: 'urgent', label: isId ? 'Mendesak' : 'Urgent' },
  ];
}

function getStatusLabels(isId: boolean): Record<string, string> {
  return {
    open: isId ? 'Baru' : 'Open',
    in_progress: isId ? 'Diproses' : 'In Progress',
    pending_customer: isId ? 'Menunggu Anda' : 'Pending',
    resolved: isId ? 'Selesai' : 'Resolved',
    closed: isId ? 'Ditutup' : 'Closed',
  };
}

const STATUS_BADGE: Record<string, string> = {
  open: 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]',
  in_progress: 'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)]',
  pending_customer: 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]',
  resolved: 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
  closed: 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]',
};

const PRIORITY_BADGE: Record<string, string> = {
  urgent: 'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]',
  high: 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]',
  normal: 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
};

const BADGE_BASE =
  'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide';

function formatDate(value: string): string {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatAuthor(role: string, isId: boolean): string {
  const normalized = (role || '').toLowerCase();
  if (normalized === 'agent') return isId ? 'Tim support' : 'Agent';
  if (normalized === 'customer') return 'Anda';
  return role || (isId ? 'Pengguna' : 'User');
}

export default function SupportTicketForm() {
  const locale = useLocale();
  const isId = locale === 'id';
  const searchParams = useSearchParams();
  const { user, isAuthenticated, authFetch, accessToken } = useAuth();
  const defaultEmail = useMemo(() => user?.email || '', [user?.email]);
  const needsCaptcha = Boolean(
    process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ||
      process.env.NEXT_PUBLIC_HCAPTCHA_SITE_KEY,
  );
  const ticketFromQuery = searchParams.get('ticket');
  const shouldOpenLiveTools = searchParams.get('openLive') === '1';

  const [requesterEmail, setRequesterEmail] = useState(defaultEmail);
  const [requesterName, setRequesterName] = useState('');
  const [category, setCategory] = useState('account');
  const [priority, setPriority] = useState('normal');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [captchaToken, setCaptchaToken] = useState('');
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketLoading, setTicketLoading] = useState(false);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<TicketDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [aiInput, setAiInput] = useState('');
  const [aiMessages, setAiMessages] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);
  const [aiLoading, setAiLoading] = useState(false);
  const [aiError, setAiError] = useState('');
  const [chatRoomId, setChatRoomId] = useState<string | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState('');
  const [chatInput, setChatInput] = useState('');
  const [chatSending, setChatSending] = useState(false);
  const [liveToolsOpen, setLiveToolsOpen] = useState(false);
  const chatChannelRef = useRef<Channel | null>(null);
  const chatCleanupRef = useRef<(() => void) | null>(null);
  const categoryOptions = useMemo(() => getCategoryOptions(isId), [isId]);
  const priorityOptions = useMemo(() => getPriorityOptions(isId), [isId]);
  const statusLabels = useMemo(() => getStatusLabels(isId), [isId]);
  const categoryLabels = useMemo(
    () =>
      Object.fromEntries(categoryOptions.map((item) => [item.value, item.label])),
    [categoryOptions],
  );
  const priorityLabels = useMemo(
    () =>
      Object.fromEntries(priorityOptions.map((item) => [item.value, item.label])),
    [priorityOptions],
  );

  useEffect(() => {
    if (defaultEmail) {
      setRequesterEmail(defaultEmail);
    }
  }, [defaultEmail]);

  useEffect(() => {
    if (chatRoomId || aiMessages.length > 0) {
      setLiveToolsOpen(true);
    }
  }, [chatRoomId, aiMessages.length]);

  useEffect(() => {
    if (shouldOpenLiveTools) {
      setLiveToolsOpen(true);
    }
  }, [shouldOpenLiveTools]);

  useEffect(() => {
    if (!isAuthenticated || !ticketFromQuery) return;
    setSelectedTicketId(ticketFromQuery);
  }, [isAuthenticated, ticketFromQuery]);

  const loadMyTickets = useCallback(async () => {
    if (!isAuthenticated) {
      setTickets([]);
      setSelectedTicketId(null);
      return;
    }

    setTicketLoading(true);
    try {
      const res = await authFetch('/api/support/tickets?limit=10');
      if (!res.ok) {
        setTickets([]);
        setSelectedTicketId(null);
        return;
      }
      const data: TicketListResponse = await res.json().catch(() => ({}));
      const items = Array.isArray(data.items) ? data.items : [];
      setTickets(items);
      setSelectedTicketId((prev) => prev || items[0]?.id || null);
    } catch {
      setTickets([]);
      setSelectedTicketId(null);
    } finally {
      setTicketLoading(false);
    }
  }, [isAuthenticated, authFetch]);

  useEffect(() => {
    void loadMyTickets();
  }, [loadMyTickets]);

  const loadTicketDetail = useCallback(
    async (ticketId: string) => {
      if (!isAuthenticated) return;
      setDetailLoading(true);
      setDetailError('');
      try {
        const res = await authFetch(`/api/support/tickets/${ticketId}`);
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          setTicketDetail(null);
          setDetailError(data?.error || 'Gagal memuat detail ticket.');
          return;
        }
        const data: TicketDetail = await res.json().catch(() => ({ ticket: null, replies: [] }));
        setTicketDetail(data && data.ticket ? data : null);
      } catch {
        setTicketDetail(null);
        setDetailError('Gagal memuat detail ticket.');
      } finally {
        setDetailLoading(false);
      }
    },
    [authFetch, isAuthenticated],
  );

  const cleanupChat = useCallback(() => {
    if (chatCleanupRef.current) {
      try {
        chatCleanupRef.current();
      } catch {
        // Ignore cleanup errors
      }
      chatCleanupRef.current = null;
    }
    if (chatChannelRef.current) {
      try {
        chatChannelRef.current.leave();
      } catch {
        // Ignore leave errors
      }
      chatChannelRef.current = null;
    }
  }, []);

  const loadSupportChat = useCallback(
    async (roomId: string, subjectText: string) => {
      if (!isAuthenticated) {
        setChatMessages([]);
        return;
      }
      setChatLoading(true);
      setChatError('');
      try {
        let token = accessToken;
        if (!token) {
          const tokenRes = await authFetch('/api/chat/token', { method: 'POST' });
          const tokenData = await tokenRes.json().catch(() => ({}));
          token = tokenData?.token || null;
        }
        if (!token) {
          setChatError('Token chat tidak tersedia.');
          return;
        }

        await authFetch('/api/chat/support-room', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            room_id: roomId,
            room_name: subjectText,
            member_ids: user?.id ? [user.id] : [],
          }),
        });

        const res = await authFetch(`/api/chat/rooms/${encodeURIComponent(roomId)}/messages?limit=50`, {
          cache: 'no-store',
        });
        const data = await res.json().catch(() => ({}));
        const messages = Array.isArray(data.messages) ? data.messages : [];
        setChatMessages(messages);

        cleanupChat();
        const channel = await joinRoom(roomId, token);
        chatChannelRef.current = channel;
        chatCleanupRef.current = onMessage(channel, (msg) => {
          const content = msg.content ?? msg.body ?? '';
          if (!content) return;
          const next: ChatMessage = {
            id: msg.message_id || msg.client_ref || msg.sent_at || `msg-${Date.now()}`,
            sender_id: msg.sender_id || '',
            content,
            message_type: msg.message_type || 'text',
            attachments: Array.isArray(msg.attachments) ? msg.attachments : [],
            created_at: msg.sent_at || new Date().toISOString(),
          };
          setChatMessages((prev) => {
            if (prev.some((m) => m.id === next.id)) return prev;
            return [...prev, next];
          });
        });
      } catch (err) {
        setChatError('Gagal memuat chat support.');
      } finally {
        setChatLoading(false);
      }
    },
    [accessToken, authFetch, cleanupChat, isAuthenticated, user?.id],
  );


  useEffect(() => {
    if (!isAuthenticated || !selectedTicketId) {
      setTicketDetail(null);
      return;
    }
    void loadTicketDetail(selectedTicketId);
  }, [isAuthenticated, loadTicketDetail, selectedTicketId]);

  useEffect(() => {
    if (!isAuthenticated || !ticketDetail?.ticket) {
      setChatRoomId(null);
      setChatMessages([]);
      cleanupChat();
      return;
    }

    const roomId = ticketDetail.ticket.support_room_id || `support:${ticketDetail.ticket.id}`;
    setChatRoomId(roomId);
    void loadSupportChat(roomId, ticketDetail.ticket.subject);

    return () => {
      cleanupChat();
    };
  }, [
    cleanupChat,
    isAuthenticated,
    loadSupportChat,
    ticketDetail?.ticket?.id,
    ticketDetail?.ticket?.support_room_id,
    ticketDetail?.ticket?.subject,
  ]);

  const submitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (!requesterEmail || !requesterEmail.includes('@')) {
      setError('Masukkan email yang valid.');
      return;
    }
    if (subject.trim().length < 5) {
      setError('Subjek minimal 5 karakter.');
      return;
    }
    if (message.trim().length < 5) {
      setError('Pesan minimal 5 karakter.');
      return;
    }
    if (needsCaptcha && !captchaToken) {
      setError('Lengkapi captcha sebelum mengirim ticket.');
      return;
    }

    setLoading(true);
    const optimisticId = `temp-${Date.now()}`;
    const optimisticTicket: Ticket = {
      id: optimisticId,
      category,
      subject: subject.trim(),
      status: 'open',
      priority,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    if (isAuthenticated) {
      setTickets((prev) => [optimisticTicket, ...prev]);
    }

    try {
      const payload = {
        requester_email: requesterEmail.trim().toLowerCase(),
        requester_name: requesterName.trim() || null,
        category,
        priority,
        subject: subject.trim(),
        message: message.trim(),
        source: 'help_center',
        ...(captchaToken ? { captcha_token: captchaToken } : {}),
      };

      const req = isAuthenticated
        ? authFetch('/api/support/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          })
        : fetch('/api/support/tickets', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          });

      const res = await req;
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (isAuthenticated) {
          setTickets((prev) => prev.filter((ticket) => ticket.id !== optimisticId));
        }
        setError(data?.error || 'Gagal membuat ticket.');
        return;
      }

      setSubject('');
      setMessage('');
      setCaptchaToken('');
      setSuccess('Ticket berhasil dibuat. Tim support akan merespons secepatnya.');
      await loadMyTickets();
    } catch {
      if (isAuthenticated) {
        setTickets((prev) => prev.filter((ticket) => ticket.id !== optimisticId));
      }
      setError('Gagal membuat ticket.');
    } finally {
      setLoading(false);
    }
  };

  const sendReply = async () => {
    if (!isAuthenticated || !selectedTicketId) return;
    const cleanBody = replyBody.trim();
    if (cleanBody.length < 2) return;

    setReplyLoading(true);
    setDetailError('');
    try {
      const res = await authFetch(`/api/support/tickets/${selectedTicketId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: cleanBody }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setDetailError(data?.error || 'Gagal mengirim balasan.');
        return;
      }
      if (chatChannelRef.current) {
        await sendMessageViaSocket(chatChannelRef.current, cleanBody, crypto.randomUUID());
      }
      setReplyBody('');
      await Promise.all([loadTicketDetail(selectedTicketId), loadMyTickets()]);
    } catch {
      setDetailError('Gagal mengirim balasan.');
    } finally {
      setReplyLoading(false);
    }
  };

  const sendAiMessage = async () => {
    const message = aiInput.trim();
    if (!message) return;
    setAiLoading(true);
    setAiError('');
    setAiInput('');
    setAiMessages((prev) => [...prev, { role: 'user', content: message }]);

    try {
      const res = await fetch('/api/ai/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, context: aiMessages }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const errText = data?.response || data?.error || 'AI belum bisa membantu.';
        setAiMessages((prev) => [...prev, { role: 'assistant', content: String(errText) }]);
        return;
      }
      const replyText = data?.response || 'AI belum bisa membantu.';
      setAiMessages((prev) => [...prev, { role: 'assistant', content: String(replyText) }]);
    } catch {
      setAiError('AI gagal merespons. Coba lagi ya.');
    } finally {
      setAiLoading(false);
    }
  };


  const sendChatMessage = useCallback(async () => {
    if (!selectedTicketId || !chatRoomId || !isAuthenticated) return;
    const content = chatInput.trim();
    if (!content) return;

    setChatSending(true);
    setChatError('');
    try {
      await authFetch(`/api/support/tickets/${selectedTicketId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: content }),
      });

      if (chatChannelRef.current) {
        await sendMessageViaSocket(chatChannelRef.current, content, crypto.randomUUID());
      }

      setChatInput('');
      await Promise.all([loadTicketDetail(selectedTicketId), loadMyTickets()]);
    } catch {
      setChatError('Gagal mengirim pesan chat.');
    } finally {
      setChatSending(false);
    }
  }, [
    authFetch,
    chatInput,
    chatRoomId,
    isAuthenticated,
    loadMyTickets,
    loadTicketDetail,
    selectedTicketId,
  ]);

  return (
    <div className="mt-6 space-y-4">
      <div className="rounded-3xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_85%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] p-4 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--app-accent)]">Alur cepat</p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
          <div className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-accent-border)_70%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_70%,_transparent)] p-3 text-xs text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]">
            <p className="font-semibold">1. Buat ticket</p>
            <p className="mt-1 text-[11px] text-[color:color-mix(in_srgb,_var(--app-accent)_80%,_transparent)] dark:text-[color:color-mix(in_srgb,_var(--app-accent)_70%,_transparent)]">
              Isi masalah singkat + detail transaksi jika ada.
            </p>
          </div>
          <div className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] p-3 text-xs text-[color:var(--app-text)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] dark:text-[color:var(--app-text-soft)]">
            <p className="font-semibold">2. Pantau status</p>
            <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
              Lihat balasan agent dan update status ticket.
            </p>
          </div>
          <div className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_70%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] p-3 text-xs text-[color:var(--app-text)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_70%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] dark:text-[color:var(--app-text-soft)]">
            <p className="font-semibold">3. Live tools</p>
            <p className="mt-1 text-[11px] text-[color:var(--app-text)]">
              Aktifkan chat realtime atau AI bila perlu.
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
      <div className="lg:col-span-3 rounded-3xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_85%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] p-5 shadow-sm">
        <h3 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">Buat Ticket Bantuan</h3>
        <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          Jelaskan kendala akun, transaksi, atau masalah teknis agar tim support bisa membantu lebih cepat.
        </p>

        <form className="mt-4 space-y-3" onSubmit={submitTicket}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              type="email"
              value={requesterEmail}
              onChange={(e) => setRequesterEmail(e.target.value)}
              placeholder="Email"
              className="w-full rounded-xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] px-3 py-2.5 text-sm shadow-sm shadow-[var(--app-shadow)]"
              required
            />
            <input
              type="text"
              value={requesterName}
              onChange={(e) => setRequesterName(e.target.value)}
              placeholder="Nama (opsional)"
              className="w-full rounded-xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] px-3 py-2.5 text-sm shadow-sm shadow-[var(--app-shadow)]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] px-3 py-2.5 text-sm shadow-sm shadow-[var(--app-shadow)]"
            >
              {categoryOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value)}
              className="w-full rounded-xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] px-3 py-2.5 text-sm shadow-sm shadow-[var(--app-shadow)]"
            >
              {priorityOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Subjek masalah"
            className="w-full rounded-xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] px-3 py-2.5 text-sm shadow-sm shadow-[var(--app-shadow)]"
            required
          />

          <textarea
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            placeholder="Jelaskan kendala Anda dengan detail."
            rows={5}
            className="w-full rounded-xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] px-3 py-2.5 text-sm shadow-sm shadow-[var(--app-shadow)]"
            required
          />

          <CaptchaField
            action="support"
            onTokenChange={setCaptchaToken}
            className="min-h-[70px]"
          />

          {error && <p className="text-xs text-[color:var(--app-danger)]">{error}</p>}
          {success && <p className="text-xs text-[color:var(--app-accent)]">{success}</p>}

          <button
            type="submit"
            disabled={loading}
            className="inline-flex items-center justify-center rounded-xl bg-[color:var(--app-accent)] px-4 py-2.5 text-xs font-semibold text-[color:var(--app-text-inverse)] shadow-sm shadow-[var(--app-shadow)] hover:bg-[color:var(--app-accent-strong)] transition disabled:opacity-50"
          >
            {loading ? 'Mengirim...' : isId ? 'Kirim tiket' : 'Submit ticket'}
          </button>
        </form>
      </div>

      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-3xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_85%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] p-5 shadow-sm">
          <h3 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">Ticket Terakhir</h3>
          <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
          {isAuthenticated
            ? 'Pantau progress ticket akun Anda di sini.'
            : 'Login untuk melihat riwayat ticket Anda.'}
          </p>

          <div className="mt-4 space-y-2">
            {!isAuthenticated ? (
              <p className="text-xs text-[color:var(--app-text)]">Belum login.</p>
            ) : ticketLoading ? (
              <p className="text-xs text-[color:var(--app-text)]">Memuat ticket...</p>
            ) : tickets.length === 0 ? (
              <p className="text-xs text-[color:var(--app-text)]">Belum ada ticket.</p>
            ) : (
              tickets.map((ticket) => (
                <button
                  key={ticket.id}
                  type="button"
                  onClick={() => setSelectedTicketId(ticket.id)}
                  className={`w-full text-left rounded-2xl border p-3 transition ${
                    selectedTicketId === ticket.id
                      ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_60%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_40%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)]'
                      : 'border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)]'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-xs font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{ticket.subject}</p>
                    <span className={`${BADGE_BASE} ${STATUS_BADGE[ticket.status] || 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'}`}>
                      {statusLabels[ticket.status] || ticket.status}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-[color:var(--app-text)]">
                    <span className={`${BADGE_BASE} ${PRIORITY_BADGE[ticket.priority] || 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'}`}>
                      {priorityLabels[ticket.priority] || ticket.priority}
                    </span>
                    <span className="text-[11px] text-[color:var(--app-text)]">
                      {categoryLabels[ticket.category] || ticket.category}
                    </span>
                    <span className="text-[11px] text-[color:var(--app-text)]">
                      {isId ? 'Update' : 'Updated'}: {formatDate(ticket.updated_at)}
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>

        <div className="rounded-3xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_85%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {isId ? 'Detail tiket' : 'Ticket details'}
            </h3>
            {selectedTicketId ? (
              <button
                type="button"
                onClick={() => selectedTicketId && loadTicketDetail(selectedTicketId)}
                className="text-[11px] font-semibold text-[color:var(--app-accent)] hover:text-[color:var(--app-accent)]"
              >
                {isId ? 'Muat ulang' : 'Refresh'}
              </button>
            ) : null}
          </div>
          <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            {isAuthenticated
              ? 'Balas langsung ke agent support dari sini.'
              : 'Login dulu untuk melihat percakapan ticket.'}
          </p>

          <div className="mt-4">
            {!isAuthenticated ? (
              <p className="text-xs text-[color:var(--app-text)]">Belum login.</p>
            ) : !selectedTicketId ? (
              <p className="text-xs text-[color:var(--app-text)]">Pilih ticket untuk melihat detail.</p>
            ) : detailLoading ? (
              <p className="text-xs text-[color:var(--app-text)]">Memuat detail...</p>
            ) : detailError ? (
              <p className="text-xs text-[color:var(--app-danger)]">{detailError}</p>
            ) : ticketDetail ? (
              <div className="space-y-3">
                <div className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-muted)_70%,_transparent)] p-3 text-xs text-[color:var(--app-text)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_60%,_transparent)] dark:text-[color:var(--app-text-soft)]">
                  <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {ticketDetail.ticket.subject}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <span className={`${BADGE_BASE} ${STATUS_BADGE[ticketDetail.ticket.status] || 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'}`}>
                      {statusLabels[ticketDetail.ticket.status] || ticketDetail.ticket.status}
                    </span>
                    <span className={`${BADGE_BASE} ${PRIORITY_BADGE[ticketDetail.ticket.priority] || 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'}`}>
                      {priorityLabels[ticketDetail.ticket.priority] || ticketDetail.ticket.priority}
                    </span>
                    <span className="text-[11px] text-[color:var(--app-text)]">
                      {categoryLabels[ticketDetail.ticket.category] || ticketDetail.ticket.category}
                    </span>
                  </div>
                  <p className="mt-2 text-[11px] text-[color:var(--app-text)]">
                    {isId ? 'Update terakhir' : 'Last updated'}: {formatDate(ticketDetail.ticket.updated_at)}
                  </p>
                </div>

                <div className="max-h-64 space-y-2 overflow-auto pr-1">
                  {ticketDetail.replies.length === 0 ? (
                    <p className="text-xs text-[color:var(--app-text)]">Belum ada balasan.</p>
                  ) : (
                    ticketDetail.replies
                      .filter((reply) => !reply.is_internal)
                      .map((reply) => (
                        <div
                          key={reply.id}
                          className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] p-3 text-xs text-[color:var(--app-text)] shadow-sm dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] dark:text-[color:var(--app-text-soft)]"
                        >
                          <div className="flex items-center justify-between text-[11px] text-[color:var(--app-text-soft)]">
                            <span>{formatAuthor(reply.author_role, isId)}</span>
                            <span>{formatDate(reply.created_at)}</span>
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {reply.body}
                          </p>
                        </div>
                      ))
                  )}
                </div>

                <div className="space-y-2">
                  <textarea
                    value={replyBody}
                    onChange={(e) => setReplyBody(e.target.value)}
                    placeholder="Tulis balasan untuk agent..."
                    rows={3}
                    className="w-full rounded-xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] px-3 py-2 text-sm shadow-sm shadow-[var(--app-shadow)]"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={sendReply}
                      disabled={replyLoading || replyBody.trim().length < 2}
                      className="inline-flex items-center justify-center rounded-xl bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)] shadow-sm shadow-[var(--app-shadow)] hover:bg-[color:var(--app-accent-strong)] transition disabled:opacity-50"
                    >
                      {replyLoading ? 'Mengirim...' : 'Kirim Balasan'}
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-xs text-[color:var(--app-text)]">Detail ticket belum tersedia.</p>
            )}
          </div>
        </div>

        
        <details
          className="rounded-3xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_85%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] p-5 shadow-sm"
          open={liveToolsOpen}
          onToggle={(e) => setLiveToolsOpen(e.currentTarget.open)}
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {isId ? 'Bantuan live: chat & AI' : 'Live tools: Chat & AI'}
          </summary>
          <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
            Aktifkan chat realtime atau AI hanya saat dibutuhkan agar alur tetap ringan.
          </p>

          <div className="mt-4 space-y-4">
            <div className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] p-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  {isId ? 'Chat langsung dengan tim' : 'Live Support Chat'}
                </h4>
                {chatRoomId ? (
                  <span className="text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    Room {chatRoomId.slice(0, 10)}
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                Realtime chat dengan agent. Semua pesan otomatis tersimpan ke ticket.
              </p>

              <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
                {!isAuthenticated ? (
                  <p className="text-xs text-[color:var(--app-text)]">Login dulu untuk chat.</p>
                ) : chatLoading ? (
                  <p className="text-xs text-[color:var(--app-text)]">Menghubungkan chat...</p>
                ) : chatMessages.length === 0 ? (
                  <p className="text-xs text-[color:var(--app-text)]">Belum ada pesan.</p>
                ) : (
                  chatMessages.map((msg) => {
                    const isMine = msg.sender_id === user?.id;
                    return (
                      <div
                        key={msg.id}
                        className={`max-w-[85%] rounded-2xl border p-3 text-xs shadow-sm ${
                          isMine
                            ? 'ml-auto border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_70%,_transparent)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]'
                            : 'border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] dark:text-[color:var(--app-text-soft)]'
                        }`}
                      >
                        <div className="flex items-center justify-between text-[10px] text-[color:var(--app-text-soft)]">
                          <span>{isMine ? 'Anda' : isId ? 'Tim support' : 'Agent'}</span>
                          <span>{formatDate(msg.created_at)}</span>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap text-sm">{msg.content}</p>
                      </div>
                    );
                  })
                )}
              </div>

              {chatError && <p className="mt-2 text-xs text-[color:var(--app-danger)]">{chatError}</p>}

              <div className="mt-3 space-y-2">
                <textarea
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  rows={3}
                  placeholder="Ketik pesan untuk agent..."
                  className="w-full rounded-xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] px-3 py-2 text-sm shadow-sm shadow-[var(--app-shadow)]"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={sendChatMessage}
                    disabled={chatSending || chatInput.trim().length < 2}
                    className="inline-flex items-center justify-center rounded-xl bg-[color:var(--app-surface-strong)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] shadow-sm shadow-[var(--app-shadow)] hover:bg-[color:var(--app-surface-strong)] transition disabled:opacity-50 dark:text-[color:var(--app-text-inverse)]"
                  >
                    {chatSending ? 'Mengirim...' : isId ? 'Kirim chat' : 'Send chat'}
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-2xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] p-4">
              <h4 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                {isId ? 'Asisten bantuan AI' : 'AI Support Assistant'}
              </h4>
              <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                Tanyakan dulu ke AI untuk solusi cepat sebelum diteruskan ke agent.
              </p>

              <div className="mt-3 max-h-56 space-y-2 overflow-auto pr-1">
                {aiMessages.length === 0 ? (
                  <p className="text-xs text-[color:var(--app-text)]">Belum ada percakapan AI.</p>
                ) : (
                  aiMessages.map((msg, index) => (
                    <div
                      key={`${msg.role}-${index}`}
                      className={`rounded-2xl border p-3 text-xs ${
                        msg.role === 'assistant'
                          ? 'border-[color:var(--app-accent-border)] bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_70%,_transparent)] text-[color:var(--app-accent)] dark:border-[color:color-mix(in_srgb,_var(--app-accent-border)_30%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent)_10%,_transparent)] dark:text-[color:var(--app-accent)]'
                          : 'border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] dark:text-[color:var(--app-text-soft)]'
                      }`}
                    >
                      <p className="text-[11px] font-semibold uppercase tracking-wide opacity-70">
                        {msg.role === 'assistant' ? 'AI' : 'Anda'}
                      </p>
                      <p className="mt-2 whitespace-pre-wrap text-sm">{msg.content}</p>
                    </div>
                  ))
                )}
              </div>

              {aiError && <p className="mt-2 text-xs text-[color:var(--app-danger)]">{aiError}</p>}

              <div className="mt-3 space-y-2">
                <textarea
                  value={aiInput}
                  onChange={(e) => setAiInput(e.target.value)}
                  rows={3}
                  placeholder="Tulis pertanyaan ke AI..."
                  className="w-full rounded-xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-border-strong)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_90%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_70%,_transparent)] px-3 py-2 text-sm shadow-sm shadow-[var(--app-shadow)]"
                />
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={sendAiMessage}
                    disabled={aiLoading || aiInput.trim().length < 2}
                    className="inline-flex items-center justify-center rounded-xl bg-[color:var(--app-surface-strong)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] shadow-sm shadow-[var(--app-shadow)] hover:bg-[color:var(--app-surface-strong)] transition disabled:opacity-50 dark:text-[color:var(--app-text-inverse)]"
                  >
                    {aiLoading ? 'Menjawab...' : 'Tanya AI'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </details>

        <div className="rounded-3xl border border-[color:color-mix(in_srgb,_var(--app-border)_80%,_transparent)] dark:border-[color:color-mix(in_srgb,_var(--app-text-inverse)_10%,_transparent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_85%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_80%,_transparent)] p-5 shadow-sm">
          <h4 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">Tips agar cepat ditangani</h4>
          <ul className="mt-3 space-y-2 text-xs text-[color:var(--app-text)]">
            <li>Gunakan subjek singkat yang jelas (contoh: "OTP tidak masuk").</li>
            <li>Tuliskan kronologi + langkah yang sudah dicoba.</li>
            <li>Tambahkan detail transaksi atau ID terkait jika ada.</li>
          </ul>
        </div>

      </div>
      </div>
    </div>
  );
}
