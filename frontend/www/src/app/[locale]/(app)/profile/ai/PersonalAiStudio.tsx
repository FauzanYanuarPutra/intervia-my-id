'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { cn } from '@/lib/utils';
import {
  Bot,
  Check,
  ChevronLeft,
  Copy,
  Loader2,
  Lock,
  MessageSquarePlus,
  Plus,
  Save,
  Send,
  Settings2,
  Share2,
  Sparkles,
  Trash2,
  Users,
  X,
} from 'lucide-react';

type QuickButton = {
  id: string;
  label: string;
  prompt: string;
};

type PersonalAgent = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  visibility: 'private' | 'shared';
  instructions: string;
  tone: string;
  model_preference: 'auto' | 'ollama' | 'groq' | 'openai';
  temperature: number;
  quick_buttons: QuickButton[];
  starter_prompts: string[];
  memory_enabled: boolean;
  share_id: string;
  usage_count: number;
  can_edit?: boolean;
};

type ChatThread = {
  id: string;
  agent_id: string;
  title: string;
  updated_at: string;
};

type ChatMessage = {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  metadata?: Record<string, unknown>;
};

type SettingsDraft = {
  name: string;
  description: string;
  visibility: 'private' | 'shared';
  instructions: string;
  tone: string;
  model_preference: 'auto' | 'ollama' | 'groq' | 'openai';
  temperature: number;
  memory_enabled: boolean;
  quick_buttons_text: string;
  starter_prompts_text: string;
};

const DEFAULT_DRAFT: SettingsDraft = {
  name: '',
  description: '',
  visibility: 'private',
  instructions: '',
  tone: 'ramah, praktis, lokal Indonesia, to the point',
  model_preference: 'auto',
  temperature: 0.4,
  memory_enabled: true,
  quick_buttons_text: '',
  starter_prompts_text: '',
};

function getLocaleFromPath(pathname: string | null) {
  return pathname?.split('/').filter(Boolean)[0] === 'en' ? 'en' : 'id';
}

function buttonsToText(buttons: QuickButton[]) {
  return buttons.map(button => `${button.label} :: ${button.prompt}`).join('\n');
}

function parseButtons(text: string): QuickButton[] {
  return text
    .split('\n')
    .map(row => row.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((row, index) => {
      const [labelRaw, ...promptParts] = row.split('::');
      const prompt = promptParts.join('::').trim() || row;
      const label = labelRaw.trim().slice(0, 36) || `Tombol ${index + 1}`;
      return {
        id: `btn_${index + 1}`,
        label,
        prompt: prompt.slice(0, 600),
      };
    });
}

function promptsToText(prompts: string[]) {
  return prompts.join('\n');
}

function parsePrompts(text: string) {
  return text
    .split('\n')
    .map(row => row.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function makeDraft(agent: PersonalAgent | null): SettingsDraft {
  if (!agent) return DEFAULT_DRAFT;
  return {
    name: agent.name,
    description: agent.description,
    visibility: agent.visibility,
    instructions: agent.instructions,
    tone: agent.tone,
    model_preference: agent.model_preference,
    temperature: agent.temperature,
    memory_enabled: agent.memory_enabled,
    quick_buttons_text: buttonsToText(agent.quick_buttons),
    starter_prompts_text: promptsToText(agent.starter_prompts),
  };
}

function compactTime(input: string) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
  });
}

export default function PersonalAiStudio() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPath(pathname);
  const isId = locale === 'id';
  const { user, authFetch, loading: authLoading } = useAuth();
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const [agents, setAgents] = useState<PersonalAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<SettingsDraft>(DEFAULT_DRAFT);
  const [input, setInput] = useState('');
  const [activePanel, setActivePanel] = useState<'chat' | 'settings' | 'share' | 'memory'>('chat');
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const shareId = searchParams.get('share') || '';
  const selectedAgent = agents.find(agent => agent.id === selectedAgentId) || null;
  const canEditSelected = Boolean(selectedAgent?.can_edit);

  const copy = useMemo(
    () =>
      isId
        ? {
            title: 'AI Pribadi',
            newAi: 'AI baru',
            newTab: 'Tab baru',
            settings: 'Setting',
            share: 'Share',
            memory: 'Memory',
            private: 'Private',
            shared: 'Dibagikan',
            save: 'Simpan',
            send: 'Kirim',
            placeholder: 'Tanya apa pun tentang usaha, supplier, modal, risiko, atau langkah berikutnya...',
            empty: 'Mulai chat dari tab ini.',
            noAgent: 'AI belum siap.',
            copied: 'Link disalin',
            saved: 'Setting tersimpan',
            createFailed: 'Gagal membuat AI.',
            saveFailed: 'Gagal menyimpan setting.',
            sendFailed: 'Gagal mengirim pesan.',
            delete: 'Hapus',
            back: 'Profile',
          }
        : {
            title: 'Personal AI',
            newAi: 'New AI',
            newTab: 'New tab',
            settings: 'Settings',
            share: 'Share',
            memory: 'Memory',
            private: 'Private',
            shared: 'Shared',
            save: 'Save',
            send: 'Send',
            placeholder: 'Ask about business ideas, suppliers, capital, risk, or next steps...',
            empty: 'Start chatting in this tab.',
            noAgent: 'AI is not ready.',
            copied: 'Link copied',
            saved: 'Settings saved',
            createFailed: 'Failed to create AI.',
            saveFailed: 'Failed to save settings.',
            sendFailed: 'Failed to send message.',
            delete: 'Delete',
            back: 'Profile',
          },
    [isId],
  );

  const shareUrl = useMemo(() => {
    if (!selectedAgent || typeof window === 'undefined') return '';
    return `${window.location.origin}/${locale}/profile/ai?share=${encodeURIComponent(
      selectedAgent.share_id,
    )}`;
  }, [locale, selectedAgent]);

  const loadAgents = useCallback(async () => {
    if (!user?.id) return;
    setLoadingAgents(true);
    setError('');
    try {
      const params = shareId ? `?share_id=${encodeURIComponent(shareId)}` : '';
      const res = await authFetch(`/api/ai/personal/agents${params}`, {
        cache: 'no-store',
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { agents?: PersonalAgent[]; shared_agent?: PersonalAgent | null };
        error?: string;
      };
      if (!res.ok || !payload.data) throw new Error(payload.error || copy.noAgent);
      const nextAgents = [...(payload.data.agents || [])];
      if (
        payload.data.shared_agent &&
        !nextAgents.some(agent => agent.id === payload.data?.shared_agent?.id)
      ) {
        nextAgents.unshift(payload.data.shared_agent);
      }
      setAgents(nextAgents);
      setSelectedAgentId(current =>
        payload.data?.shared_agent?.id || current || nextAgents[0]?.id || '',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.noAgent);
    } finally {
      setLoadingAgents(false);
    }
  }, [authFetch, copy.noAgent, shareId, user?.id]);

  const loadThreads = useCallback(
    async (agentId: string) => {
      if (!agentId || !user?.id) return;
      setLoadingThreads(true);
      try {
        const res = await authFetch(
          `/api/ai/personal/threads?agent_id=${encodeURIComponent(agentId)}`,
          { cache: 'no-store' },
        );
        const payload = (await res.json().catch(() => ({}))) as {
          data?: { threads?: ChatThread[] };
        };
        const nextThreads = payload.data?.threads || [];
        setThreads(nextThreads);
        setSelectedThreadId(current => {
          const nextThreadId =
            nextThreads.find(thread => thread.id === current)?.id ||
            nextThreads[0]?.id ||
            '';
          if (!nextThreadId) setMessages([]);
          return nextThreadId;
        });
      } finally {
        setLoadingThreads(false);
      }
    },
    [authFetch, user?.id],
  );

  const loadThreadMessages = useCallback(
    async (threadId: string) => {
      if (!threadId || !user?.id) return;
      const res = await authFetch(`/api/ai/personal/threads/${encodeURIComponent(threadId)}`, {
        cache: 'no-store',
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { messages?: ChatMessage[] };
      };
      setMessages(payload.data?.messages || []);
    },
    [authFetch, user?.id],
  );

  useEffect(() => {
    if (!authLoading && user?.id) void loadAgents();
  }, [authLoading, loadAgents, user?.id]);

  useEffect(() => {
    if (selectedAgentId) void loadThreads(selectedAgentId);
  }, [loadThreads, selectedAgentId]);

  useEffect(() => {
    if (selectedThreadId) void loadThreadMessages(selectedThreadId);
  }, [loadThreadMessages, selectedThreadId]);

  useEffect(() => {
    setDraft(makeDraft(selectedAgent));
  }, [selectedAgent]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages.length, sending]);

  async function createAgent() {
    setError('');
    try {
      const res = await authFetch('/api/ai/personal/agents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: isId ? 'AI Usaha Baru' : 'New Business AI',
          description: isId
            ? 'Asisten baru yang bisa kamu atur sendiri.'
            : 'A new assistant you can configure.',
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { agent?: PersonalAgent };
        error?: string;
      };
      if (!res.ok || !payload.data?.agent) throw new Error(payload.error || copy.createFailed);
      setAgents(current => [payload.data!.agent!, ...current]);
      setSelectedAgentId(payload.data.agent.id);
      setActivePanel('settings');
      setMobileLibraryOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.createFailed);
    }
  }

  async function saveSettings() {
    if (!selectedAgent || !canEditSelected) return;
    setSaving(true);
    setError('');
    setNotice('');
    try {
      const res = await authFetch(
        `/api/ai/personal/agents/${encodeURIComponent(selectedAgent.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: draft.name,
            description: draft.description,
            visibility: draft.visibility,
            instructions: draft.instructions,
            tone: draft.tone,
            model_preference: draft.model_preference,
            temperature: draft.temperature,
            memory_enabled: draft.memory_enabled,
            quick_buttons: parseButtons(draft.quick_buttons_text),
            starter_prompts: parsePrompts(draft.starter_prompts_text),
          }),
        },
      );
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { agent?: PersonalAgent };
        error?: string;
      };
      if (!res.ok || !payload.data?.agent) throw new Error(payload.error || copy.saveFailed);
      setAgents(current =>
        current.map(agent =>
          agent.id === payload.data!.agent!.id ? payload.data!.agent! : agent,
        ),
      );
      setNotice(copy.saved);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  }

  async function deleteAgent() {
    if (!selectedAgent || !canEditSelected || agents.filter(agent => agent.can_edit).length <= 1) return;
    const res = await authFetch(
      `/api/ai/personal/agents/${encodeURIComponent(selectedAgent.id)}`,
      { method: 'DELETE' },
    );
    if (res.ok) {
      setAgents(current => current.filter(agent => agent.id !== selectedAgent.id));
      setSelectedAgentId(agents.find(agent => agent.id !== selectedAgent.id)?.id || '');
    }
  }

  async function createThread() {
    if (!selectedAgent) return;
    const res = await authFetch('/api/ai/personal/threads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agent_id: selectedAgent.can_edit ? selectedAgent.id : undefined,
        share_id: selectedAgent.can_edit ? undefined : selectedAgent.share_id,
        title: isId ? 'Chat baru' : 'New chat',
      }),
    });
    const payload = (await res.json().catch(() => ({}))) as {
      data?: { thread?: ChatThread };
    };
    if (payload.data?.thread) {
      setThreads(current => [payload.data!.thread!, ...current]);
      setSelectedThreadId(payload.data.thread.id);
      setMessages([]);
    }
  }

  async function sendMessage(text = input) {
    const message = text.trim();
    if (!message || !selectedAgent || sending) return;
    setSending(true);
    setError('');
    setInput('');
    const optimistic: ChatMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
    };
    setMessages(current => [...current, optimistic]);
    try {
      const res = await authFetch('/api/ai/personal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: selectedAgent.can_edit ? selectedAgent.id : undefined,
          share_id: selectedAgent.can_edit ? undefined : selectedAgent.share_id,
          thread_id: selectedThreadId || undefined,
          message,
          locale,
        }),
      });
      const payload = (await res.json().catch(() => ({}))) as {
        data?: {
          thread?: ChatThread;
          messages?: ChatMessage[];
        };
        error?: string;
      };
      if (!res.ok || !payload.data?.messages) throw new Error(payload.error || copy.sendFailed);
      if (payload.data.thread) {
        setSelectedThreadId(payload.data.thread.id);
        setThreads(current => {
          const without = current.filter(thread => thread.id !== payload.data!.thread!.id);
          return [payload.data!.thread!, ...without];
        });
      }
      setMessages(current => [
        ...current.filter(messageItem => messageItem.id !== optimistic.id),
        ...payload.data!.messages!,
      ]);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.sendFailed);
      setMessages(current => current.filter(messageItem => messageItem.id !== optimistic.id));
      setInput(message);
    } finally {
      setSending(false);
    }
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard?.writeText(shareUrl);
    setNotice(copy.copied);
  }

  if (authLoading || loadingAgents) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[color:var(--app-surface-muted)] px-4">
        <div className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--app-text-soft)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isId ? 'Menyiapkan AI...' : 'Preparing AI...'}
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="flex min-h-[70vh] items-center justify-center bg-[color:var(--app-surface-muted)] px-4">
        <Link
          href="/login"
          className="rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-sm font-bold text-white"
        >
          Login
        </Link>
      </main>
    );
  }

  const showMobileLibrary = mobileLibraryOpen || !selectedAgent;

  return (
    <main className="h-[var(--app-viewport-height)] max-h-[var(--app-viewport-height)] overflow-hidden bg-[#d9dbd5] text-[color:var(--app-text)] dark:bg-[#0b141a]">
      <div className="mx-auto flex h-full max-h-full min-h-0 w-full min-w-0 max-w-[1600px] overflow-hidden lg:px-4 lg:py-4">
        <div className="flex h-full w-full min-w-0 overflow-hidden bg-[#f7f5f3] shadow-none dark:bg-[#111b21] lg:rounded-[18px] lg:border lg:border-black/5 lg:shadow-[0_18px_46px_-30px_rgba(17,27,33,0.45)] dark:lg:border-white/10">
        <aside
          className={cn(
            'h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden border-r border-black/5 bg-white p-3 dark:border-white/6 dark:bg-[#111b21] lg:flex lg:w-[320px] lg:shrink-0',
            showMobileLibrary ? 'flex' : 'hidden lg:flex',
          )}
        >
          <div className="mb-3 flex items-center justify-between gap-2">
            <Link
              href="/profile"
              className="inline-flex items-center gap-1.5 text-xs font-bold text-[color:var(--app-text-soft)]"
            >
              <ChevronLeft className="h-4 w-4" />
              {copy.back}
            </Link>
            <button
              type="button"
              onClick={() => void createAgent()}
              className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white"
              aria-label={copy.newAi}
            >
              <Plus className="h-4 w-4" />
            </button>
          </div>

          <h1 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-[-0.03em]">
            <Bot className="h-5 w-5 text-[color:var(--app-accent)]" />
            {copy.title}
          </h1>

          <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
            {agents.map(agent => (
              <button
                key={agent.id}
                type="button"
                onClick={() => {
                  setSelectedAgentId(agent.id);
                  setActivePanel('chat');
                  setMobileLibraryOpen(false);
                }}
                className={cn(
                  'min-w-0 rounded-[14px] border p-3 text-left transition',
                  selectedAgentId === agent.id
                    ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]'
                    : 'border-[color:var(--app-border)] bg-[color:var(--app-surface)] hover:border-[color:var(--app-accent-border)]',
                )}
              >
                <div className="flex min-w-0 items-center justify-between gap-2">
                  <span className="truncate text-sm font-bold">{agent.name}</span>
                  {agent.visibility === 'shared' ? (
                    <Users className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-accent)]" />
                  ) : (
                    <Lock className="h-3.5 w-3.5 shrink-0 text-[color:var(--app-text-soft)]" />
                  )}
                </div>
                <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-[color:var(--app-text-soft)]">
                  {agent.description || agent.instructions}
                </p>
              </button>
            ))}
          </div>
        </aside>

        <section
          className={cn(
            'h-full min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden bg-[#efeae2] dark:bg-[#0b141a]',
            showMobileLibrary ? 'hidden lg:flex' : 'flex',
          )}
        >
          <div className="flex shrink-0 flex-col gap-2 border-b border-black/5 bg-[#f0f2f5] px-3 py-2 dark:border-white/6 dark:bg-[#202c33] sm:flex-row sm:items-center sm:justify-between">
            <div className="flex min-w-0 items-center gap-2">
              <button
                type="button"
                onClick={() => setMobileLibraryOpen(true)}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/8 lg:hidden"
                aria-label={isId ? 'Buka daftar AI' : 'Open AI list'}
              >
                <ChevronLeft className="h-5 w-5" />
              </button>
              <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#111b21] dark:text-[#e9edef]">{selectedAgent?.name || copy.noAgent}</p>
              <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696a0]">
                {selectedAgent?.visibility === 'shared' ? copy.shared : copy.private}
                {selectedAgent?.can_edit ? '' : ' · shared AI'}
              </p>
              </div>
            </div>
            <div className="flex min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {(['chat', 'settings', 'share', 'memory'] as const).map(panel => (
                <button
                  key={panel}
                  type="button"
                  onClick={() => setActivePanel(panel)}
                  className={cn(
                    'inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold',
                    activePanel === panel
                      ? 'bg-[#25d366] text-[#111b21]'
                      : 'bg-white text-[#54656f] hover:text-[#128c7e] dark:bg-[#111b21] dark:text-[#aebac1]',
                  )}
                >
                  {panel === 'chat' ? <Bot className="h-3.5 w-3.5" /> : null}
                  {panel === 'settings' ? <Settings2 className="h-3.5 w-3.5" /> : null}
                  {panel === 'share' ? <Share2 className="h-3.5 w-3.5" /> : null}
                  {panel === 'memory' ? <Sparkles className="h-3.5 w-3.5" /> : null}
                  {panel === 'chat'
                    ? 'Chat'
                    : panel === 'settings'
                      ? copy.settings
                      : panel === 'share'
                        ? copy.share
                        : copy.memory}
                </button>
              ))}
            </div>
          </div>

          {(notice || error) ? (
            <div className="grid gap-2 border-b border-[color:var(--app-border)] px-3 py-2 lg:hidden">
              {notice ? (
                <div className="flex items-center gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                  <Check className="h-4 w-4" />
                  {notice}
                  <button type="button" onClick={() => setNotice('')} className="ml-auto">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
              {error ? (
                <div className="flex items-center gap-2 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                  {error}
                  <button type="button" onClick={() => setError('')} className="ml-auto">
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}

          {activePanel === 'chat' ? (
            <>
              <div className="flex shrink-0 items-center gap-2 overflow-x-auto border-b border-[color:var(--app-border)] px-3 py-2">
                <button
                  type="button"
                  onClick={() => void createThread()}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-bold text-[color:var(--app-accent)]"
                >
                  <MessageSquarePlus className="h-3.5 w-3.5" />
                  {copy.newTab}
                </button>
                {loadingThreads ? (
                  <Loader2 className="h-4 w-4 animate-spin text-[color:var(--app-text-soft)]" />
                ) : null}
                {threads.map(thread => (
                  <button
                    key={thread.id}
                    type="button"
                    onClick={() => setSelectedThreadId(thread.id)}
                    className={cn(
                      'inline-flex h-9 max-w-[180px] shrink-0 items-center gap-2 rounded-full px-3 text-[11px] font-bold',
                      selectedThreadId === thread.id
                        ? 'bg-[color:var(--app-text)] text-[color:var(--app-surface-strong)]'
                        : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                    )}
                  >
                    <span className="truncate">{thread.title}</span>
                    <span className="text-[9px] opacity-70">{compactTime(thread.updated_at)}</span>
                  </button>
                ))}
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto px-2 py-4 sm:px-4">
                {messages.length === 0 ? (
                  <div className="mx-auto mt-10 max-w-lg rounded-[18px] border border-dashed border-black/10 bg-white/80 p-4 text-center shadow-[0_14px_34px_-28px_rgba(17,27,33,0.35)]  dark:border-white/10 dark:bg-[#202c33]/84">
                    <Sparkles className="mx-auto h-6 w-6 text-[color:var(--app-accent)]" />
                    <p className="mt-2 text-sm font-bold">{copy.empty}</p>
                    {selectedAgent?.starter_prompts?.length ? (
                      <div className="mt-3 flex flex-wrap justify-center gap-2">
                        {selectedAgent.starter_prompts.slice(0, 3).map(prompt => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => void sendMessage(prompt)}
                            className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-[11px] font-bold text-[color:var(--app-accent)]"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mx-auto grid max-w-3xl gap-3">
                    {messages.map(message => (
                      <div
                        key={message.id}
                        className={cn(
                          'max-w-[88%] break-words rounded-[18px] px-3 py-2 text-sm leading-6 shadow-[0_10px_22px_-18px_rgba(17,27,33,0.32)]',
                          message.role === 'user'
                            ? 'ml-auto rounded-br-[6px] bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]'
                            : 'mr-auto rounded-bl-[6px] border border-black/5 bg-white text-[#111b21] dark:border-white/6 dark:bg-[#202c33] dark:text-[#e9edef]',
                        )}
                      >
                        <p className="whitespace-pre-wrap">{message.content}</p>
                      </div>
                    ))}
                    {sending ? (
                      <div className="mr-auto inline-flex items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-xs font-bold text-[color:var(--app-text-soft)]">
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        AI
                      </div>
                    ) : null}
                    <div ref={messagesEndRef} />
                  </div>
                )}
              </div>

              <div className="shrink-0 border-t border-black/5 bg-[#f0f2f5] px-2 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-2 dark:border-white/6 dark:bg-[#202c33] sm:px-3 lg:pb-3">
                {selectedAgent?.quick_buttons?.length ? (
                  <div className="mb-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    {selectedAgent.quick_buttons.map(button => (
                      <button
                        key={button.id}
                        type="button"
                        onClick={() => void sendMessage(button.prompt)}
                        className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-white px-3 text-[11px] font-bold text-[#54656f] hover:text-[#128c7e] dark:bg-[#111b21] dark:text-[#aebac1]"
                      >
                        {button.label}
                      </button>
                    ))}
                  </div>
                ) : null}
                <div className="flex min-w-0 items-end gap-2">
                  <textarea
                    value={input}
                    onChange={event => setInput(event.target.value)}
                    placeholder={copy.placeholder}
                    rows={2}
                    className="min-h-[46px] min-w-0 flex-1 resize-none rounded-[18px] border border-transparent bg-white px-3 py-2 text-sm text-[#111b21] outline-none transition placeholder:text-[#667781] focus:border-[#25d366] focus:ring-2 focus:ring-[#25d366]/14 dark:bg-[#2a3942] dark:text-[#e9edef] dark:placeholder:text-[#8696a0]"
                    onKeyDown={event => {
                      if (event.key === 'Enter' && !event.shiftKey) {
                        event.preventDefault();
                        void sendMessage();
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => void sendMessage()}
                    disabled={sending || !input.trim()}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-[#111b21] shadow-[0_10px_24px_-16px_rgba(37,211,102,0.65)] disabled:opacity-50"
                    aria-label={copy.send}
                  >
                    {sending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                  </button>
                </div>
              </div>
            </>
          ) : null}

          {activePanel !== 'chat' ? (
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {activePanel === 'settings' ? (
                <div className="mx-auto grid max-w-3xl gap-3">
                  {!canEditSelected ? (
                    <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                      {isId ? 'AI ini dibagikan. Setting hanya bisa diedit pemilik.' : 'This AI is shared. Only the owner can edit settings.'}
                    </div>
                  ) : null}
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                      Nama AI
                      <input
                        value={draft.name}
                        disabled={!canEditSelected}
                        onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                        className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                      Model
                      <select
                        value={draft.model_preference}
                        disabled={!canEditSelected}
                        onChange={event =>
                          setDraft(current => ({
                            ...current,
                            model_preference: event.target.value as SettingsDraft['model_preference'],
                          }))
                        }
                        className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                      >
                        <option value="auto">Auto</option>
                        <option value="ollama">Ollama lokal</option>
                        <option value="groq">Groq</option>
                        <option value="openai">OpenAI</option>
                      </select>
                    </label>
                  </div>
                  <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                    Deskripsi
                    <input
                      value={draft.description}
                      disabled={!canEditSelected}
                      onChange={event => setDraft(current => ({ ...current, description: event.target.value }))}
                      className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                    Instruksi
                    <textarea
                      value={draft.instructions}
                      disabled={!canEditSelected}
                      rows={8}
                      onChange={event => setDraft(current => ({ ...current, instructions: event.target.value }))}
                      className="resize-y rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm leading-6 text-[color:var(--app-text)]"
                    />
                  </label>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                      Gaya jawaban
                      <input
                        value={draft.tone}
                        disabled={!canEditSelected}
                        onChange={event => setDraft(current => ({ ...current, tone: event.target.value }))}
                        className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                      Kreativitas {Math.round(draft.temperature * 100)}%
                      <input
                        type="range"
                        min={0}
                        max={1}
                        step={0.05}
                        value={draft.temperature}
                        disabled={!canEditSelected}
                        onChange={event =>
                          setDraft(current => ({
                            ...current,
                            temperature: Number(event.target.value),
                          }))
                        }
                      />
                    </label>
                  </div>
                  <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                    Quick buttons
                    <textarea
                      value={draft.quick_buttons_text}
                      disabled={!canEditSelected}
                      rows={5}
                      onChange={event => setDraft(current => ({ ...current, quick_buttons_text: event.target.value }))}
                      className="resize-y rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm leading-6 text-[color:var(--app-text)]"
                    />
                  </label>
                  <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                    Starter prompts
                    <textarea
                      value={draft.starter_prompts_text}
                      disabled={!canEditSelected}
                      rows={4}
                      onChange={event => setDraft(current => ({ ...current, starter_prompts_text: event.target.value }))}
                      className="resize-y rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm leading-6 text-[color:var(--app-text)]"
                    />
                  </label>
                  <div className="flex flex-wrap items-center justify-between gap-2 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3">
                    <label className="inline-flex items-center gap-2 text-xs font-bold">
                      <input
                        type="checkbox"
                        checked={draft.memory_enabled}
                        disabled={!canEditSelected}
                        onChange={event =>
                          setDraft(current => ({
                            ...current,
                            memory_enabled: event.target.checked,
                          }))
                        }
                      />
                      {copy.memory}
                    </label>
                    <div className="inline-flex rounded-full bg-[color:var(--app-surface-muted)] p-1">
                      {(['private', 'shared'] as const).map(value => (
                        <button
                          key={value}
                          type="button"
                          disabled={!canEditSelected}
                          onClick={() => setDraft(current => ({ ...current, visibility: value }))}
                          className={cn(
                            'rounded-full px-3 py-1 text-[11px] font-bold',
                            draft.visibility === value
                              ? 'bg-[color:var(--app-accent)] text-white'
                              : 'text-[color:var(--app-text-soft)]',
                          )}
                        >
                          {value === 'private' ? copy.private : copy.shared}
                        </button>
                      ))}
                    </div>
                  </div>
                  {canEditSelected ? (
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => void saveSettings()}
                        disabled={saving}
                        className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-sm font-bold text-white disabled:opacity-60"
                      >
                        {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        {copy.save}
                      </button>
                      <button
                        type="button"
                        onClick={() => void deleteAgent()}
                        className="inline-flex min-h-10 items-center gap-2 rounded-full border border-rose-200 px-4 text-sm font-bold text-rose-600"
                      >
                        <Trash2 className="h-4 w-4" />
                        {copy.delete}
                      </button>
                    </div>
                  ) : null}
                </div>
              ) : null}

              {activePanel === 'share' ? (
                <div className="mx-auto grid max-w-2xl gap-3">
                  <div className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
                    <p className="text-sm font-bold">{selectedAgent?.visibility === 'shared' ? copy.shared : copy.private}</p>
                    <div className="mt-3 flex gap-2">
                      <input
                        readOnly
                        value={selectedAgent?.visibility === 'shared' ? shareUrl : ''}
                        className="min-w-0 flex-1 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-xs"
                      />
                      <button
                        type="button"
                        onClick={() => void copyShareLink()}
                        disabled={selectedAgent?.visibility !== 'shared'}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white disabled:opacity-40"
                        aria-label="Copy"
                      >
                        <Copy className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}

              {activePanel === 'memory' ? (
                <div className="mx-auto grid max-w-2xl gap-3">
                  <div className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
                    <p className="text-sm font-bold">{copy.memory}</p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                      {selectedAgent?.memory_enabled
                        ? isId
                          ? 'Memory aktif. AI memakai ringkasan percakapanmu di tab ini dan tab lain untuk memahami konteks berikutnya.'
                          : 'Memory is active. AI uses compact conversation memory across your tabs for future context.'
                        : isId
                          ? 'Memory dimatikan di setting AI ini.'
                          : 'Memory is disabled for this AI.'}
                    </p>
                    <div className="mt-3 grid gap-2">
                      {messages
                        .filter(message => message.role === 'user')
                        .slice(-5)
                        .map(message => (
                          <div
                            key={message.id}
                            className="rounded-[12px] bg-[color:var(--app-surface-muted)] px-3 py-2 text-xs font-semibold text-[color:var(--app-text-soft)]"
                          >
                            {message.content}
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}
        </section>

        <aside className="hidden h-full min-h-0 w-[320px] shrink-0 overflow-y-auto border-l border-black/5 bg-white p-3 dark:border-white/6 dark:bg-[#111b21] lg:block">
          <div className="rounded-[16px] bg-[color:var(--app-surface)] p-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-bold">{selectedAgent?.name || copy.title}</p>
              {selectedAgent?.visibility === 'shared' ? (
                <Users className="h-4 w-4 text-[color:var(--app-accent)]" />
              ) : (
                <Lock className="h-4 w-4 text-[color:var(--app-text-soft)]" />
              )}
            </div>
            <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
              {selectedAgent?.description || selectedAgent?.instructions || copy.noAgent}
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] font-bold">
              <div className="rounded-[12px] bg-[color:var(--app-surface-muted)] px-2 py-2">
                {threads.length} tabs
              </div>
              <div className="rounded-[12px] bg-[color:var(--app-surface-muted)] px-2 py-2">
                {selectedAgent?.usage_count || 0} chats
              </div>
            </div>
          </div>

          {notice ? (
            <div className="mt-3 flex items-center gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
              <Check className="h-4 w-4" />
              {notice}
              <button type="button" onClick={() => setNotice('')} className="ml-auto">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
          {error ? (
            <div className="mt-3 flex items-center gap-2 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
              {error}
              <button type="button" onClick={() => setError('')} className="ml-auto">
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : null}
        </aside>
        </div>
      </div>
    </main>
  );
}
