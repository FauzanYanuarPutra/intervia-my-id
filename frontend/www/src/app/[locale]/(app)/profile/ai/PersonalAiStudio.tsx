'use client';

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type ReactNode,
} from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useBodyScrollLock } from '@/hooks/useBodyScrollLock';
import { cn } from '@/lib/utils';
import {
  Bot,
  Building2,
  Check,
  ChevronLeft,
  Copy,
  FileText,
  Forward,
  Image as ImageIcon,
  Layers3,
  Loader2,
  Lock,
  MessageSquarePlus,
  Paperclip,
  Plus,
  RefreshCcw,
  Reply,
  Save,
  Search,
  Send,
  Settings2,
  Share2,
  Smile,
  Sparkles,
  ShoppingBag,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AICreationCard } from '@/components/ai/AICreationCard';
import type {
  AICreationDraft,
  SupportedCreationTarget,
} from '@/lib/creation-drafts/types';
import { isSupportedCreationTarget } from '@/lib/creation-drafts/types';
import {
  readCreationFlowMetadata,
  type CreationFlowMetadata,
} from '@/lib/creation-drafts/conversation';
import {
  PERSONAL_AI_BUILDER_TEMPLATES,
  PERSONAL_AI_MODEL_REGISTRY,
  createDefaultPersonalAiBuilderConfig,
  type AIBuilderBlock,
  type AIBuilderBlockType,
  type AIOutputSection,
  type PersonalAiBuilderConfig,
  type AIBuilderStep,
} from '@/lib/personal-ai/builder';

type QuickButton = {
  id: string;
  label: string;
  prompt: string;
  instructionAppend?: string;
  negativeInstruction?: string;
};

type PersonalAgent = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  visibility: 'private' | 'unlisted' | 'public' | 'shared';
  instructions: string;
  tone: string;
  model_preference: 'auto' | 'ollama' | 'groq' | 'openai';
  temperature: number;
  quick_buttons: QuickButton[];
  starter_prompts: string[];
  builder_config: PersonalAiBuilderConfig;
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

type MessageReplyReference = {
  message_id: string;
  role: ChatMessage['role'];
  excerpt: string;
};

type PersonalAiPanel = 'chat' | 'builder' | 'settings' | 'share' | 'memory';

type AiAttachmentKind = 'image' | 'video' | 'audio' | 'document' | 'file';

type AiDraftAttachment = {
  id: string;
  name: string;
  mime: string;
  size: number;
  kind: AiAttachmentKind;
  url?: string;
  dataUrl?: string;
  previewUrl?: string;
  text?: string;
};

type AiStoredMedia = {
  kind?: AiAttachmentKind;
  name?: string;
  mime?: string;
  size?: number;
  url?: string;
  has_inline_image?: boolean;
  has_text?: boolean;
};

type StoredPersonalAiMedia = {
  name: string;
  url: string;
  size: number;
  mime: string;
  type: 'image' | 'video' | 'audio' | 'file';
};

type SettingsDraft = {
  name: string;
  description: string;
  visibility: 'private' | 'unlisted' | 'public';
  instructions: string;
  tone: string;
  model_preference: 'auto' | 'ollama' | 'groq' | 'openai';
  temperature: number;
  memory_enabled: boolean;
  builder_config: PersonalAiBuilderConfig;
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
  builder_config: createDefaultPersonalAiBuilderConfig(),
  quick_buttons_text: '',
  starter_prompts_text: '',
};

const MAX_AI_ATTACHMENTS = 4;
const MAX_INLINE_IMAGE_BYTES = 1_600_000;
const MAX_TEXT_FILE_BYTES = 90_000;
const BUILDER_BLOCK_TYPES: AIBuilderBlockType[] = [
  'text',
  'textarea',
  'single_choice',
  'multi_choice',
  'number',
  'slider',
  'toggle',
  'image_upload',
  'document_upload',
  'model_select',
  'notice',
  'summary',
] as AIBuilderBlockType[];
const OUTPUT_SECTION_TYPES: AIOutputSection['type'][] = [
  'markdown',
  'text',
  'prompt',
  'scene_collection',
  'json',
  'table',
  'key_value',
  'code',
];

function normalizeUiVisibility(
  value: PersonalAgent['visibility'] | SettingsDraft['visibility'],
): SettingsDraft['visibility'] {
  if (value === 'public') return 'public';
  if (value === 'unlisted' || value === 'shared') return 'unlisted';
  return 'private';
}

function visibilityLabel(
  value: PersonalAgent['visibility'] | SettingsDraft['visibility'] | undefined,
  isId: boolean,
) {
  const normalized = normalizeUiVisibility(value || 'private');
  if (normalized === 'public') return isId ? 'Public' : 'Public';
  if (normalized === 'unlisted') return isId ? 'Unlisted' : 'Unlisted';
  return isId ? 'Private' : 'Private';
}

function variableKeyFromLabel(label: string) {
  const base = label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 50);
  return base || `field_${Date.now()}`;
}

function optionsToText(block: AIBuilderBlock) {
  return (block.options || [])
    .map(option =>
      [option.label, option.value, option.instructionAppend]
        .map(part => String(part || '').trim())
        .filter(Boolean)
        .join(' :: '),
    )
    .join('\n');
}

function textToOptions(text: string) {
  return text
    .split('\n')
    .map(row => row.trim())
    .filter(Boolean)
    .slice(0, 40)
    .map((row, index) => {
      const [labelRaw, valueRaw, ...instructionParts] = row.split('::');
      const label = (labelRaw || '').trim() || `Option ${index + 1}`;
      const value = (valueRaw || '').trim() || variableKeyFromLabel(label);
      return {
        id: `option_${index + 1}_${variableKeyFromLabel(value)}`,
        label: label.slice(0, 80),
        value: value.slice(0, 120),
        instructionAppend:
          instructionParts.join('::').trim().slice(0, 900) || undefined,
      };
    });
}

function fileKind(file: File): AiAttachmentKind {
  if (file.type.startsWith('image/')) return 'image';
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('audio/')) return 'audio';
  if (
    file.type === 'application/pdf' ||
    /\.(pdf|docx?|xlsx?|pptx?)$/i.test(file.name)
  ) {
    return 'document';
  }
  return 'file';
}

function readAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function readAsText(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      resolve(typeof reader.result === 'string' ? reader.result : '');
    reader.onerror = () => reject(reader.error || new Error('read failed'));
    reader.readAsText(file);
  });
}

function canReadText(file: File) {
  return (
    file.size <= MAX_TEXT_FILE_BYTES &&
    (file.type.startsWith('text/') || /\.(txt|md|csv|json)$/i.test(file.name))
  );
}

function revokeAttachmentPreview(attachment: AiDraftAttachment) {
  if (attachment.previewUrl) URL.revokeObjectURL(attachment.previewUrl);
}

function mediaFromMessage(message: ChatMessage): AiStoredMedia[] {
  const raw = message.metadata?.media;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(item => item && typeof item === 'object' && !Array.isArray(item))
    .map(item => item as AiStoredMedia);
}

function creationDraftFromMessage(
  message: ChatMessage,
): AICreationDraft | null {
  const raw = message.metadata?.creation_draft;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const draft = raw as Partial<AICreationDraft>;
  if (
    typeof draft.id !== 'string' ||
    typeof draft.title !== 'string' ||
    typeof draft.target !== 'string'
  ) {
    return null;
  }
  return draft as AICreationDraft;
}

function creationFlowFromMessage(
  message: ChatMessage,
): CreationFlowMetadata | null {
  return readCreationFlowMetadata(message.metadata?.creation_flow);
}

function replyReferenceFromMessage(
  message: ChatMessage,
): MessageReplyReference | null {
  const raw = message.metadata?.reply_to;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const value = raw as Record<string, unknown>;
  if (
    typeof value.message_id !== 'string' ||
    typeof value.excerpt !== 'string'
  ) {
    return null;
  }
  return {
    message_id: value.message_id,
    role:
      value.role === 'assistant' || value.role === 'system'
        ? value.role
        : 'user',
    excerpt: value.excerpt.slice(0, 500),
  };
}

function isForwardedMessage(message: ChatMessage) {
  const raw = message.metadata?.forwarded_from;
  return Boolean(raw && typeof raw === 'object' && !Array.isArray(raw));
}

function messageReaction(message: ChatMessage) {
  return typeof message.metadata?.user_reaction === 'string'
    ? message.metadata.user_reaction
    : '';
}

function formatBytes(size: number | undefined) {
  const value = Number(size || 0);
  if (!Number.isFinite(value) || value <= 0) return '';
  if (value < 1024) return `${value} B`;
  if (value < 1024 * 1024) return `${Math.round(value / 1024)} KB`;
  return `${(value / (1024 * 1024)).toFixed(1)} MB`;
}

function renderInlineMarkdown(text: string, prefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(text))) {
    if (match.index > lastIndex) nodes.push(text.slice(lastIndex, match.index));
    const token = match[0];
    const key = `${prefix}-${match.index}`;
    if (token.startsWith('`')) {
      nodes.push(
        <code
          key={key}
          className="rounded bg-black/[0.08] px-1 py-0.5 text-[0.92em] dark:bg-white/10"
        >
          {token.slice(1, -1)}
        </code>,
      );
    } else {
      nodes.push(<strong key={key}>{token.slice(2, -2)}</strong>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) nodes.push(text.slice(lastIndex));
  return nodes;
}

function MarkdownMessage({ content }: { content: string }) {
  const lines = content.replace(/\r\n/g, '\n').split('\n');
  return (
    <div className="space-y-1.5">
      {lines.map((line, index) => {
        const trimmed = line.trim();
        if (!trimmed) return <div key={`gap-${index}`} className="h-1" />;

        const heading = /^(#{1,3})\s+(.+)$/.exec(trimmed);
        if (heading) {
          return (
            <p
              key={`h-${index}`}
              className="pt-1 text-[1.02em] font-bold leading-6"
            >
              {renderInlineMarkdown(heading[2] || '', `h-${index}`)}
            </p>
          );
        }

        const bullet = /^[-*]\s+(.+)$/.exec(trimmed);
        if (bullet) {
          return (
            <div
              key={`b-${index}`}
              className="grid grid-cols-[14px_minmax(0,1fr)] gap-1"
            >
              <span
                className="flex justify-center pt-[0.62rem]"
                aria-hidden="true"
              >
                <span className="h-1 w-1 rounded-full bg-current" />
              </span>
              <p>{renderInlineMarkdown(bullet[1] || '', `b-${index}`)}</p>
            </div>
          );
        }

        const numbered = /^(\d+)[.)]\s+(.+)$/.exec(trimmed);
        if (numbered) {
          return (
            <div
              key={`n-${index}`}
              className="grid grid-cols-[22px_minmax(0,1fr)] gap-1"
            >
              <span className="font-semibold opacity-70">{numbered[1]}.</span>
              <p>{renderInlineMarkdown(numbered[2] || '', `n-${index}`)}</p>
            </div>
          );
        }

        return (
          <p key={`p-${index}`}>{renderInlineMarkdown(line, `p-${index}`)}</p>
        );
      })}
    </div>
  );
}

function MessageMediaList({ media }: { media: AiStoredMedia[] }) {
  if (media.length === 0) return null;
  return (
    <div className="mb-2 grid gap-2">
      {media.map((item, index) => {
        const kind = item.kind || 'file';
        const Icon = kind === 'image' ? ImageIcon : FileText;
        const key = `${item.name || 'media'}-${index}`;
        const label = item.name || kind;
        const detail = [kind, formatBytes(item.size)]
          .filter(Boolean)
          .join(' / ');
        if (kind === 'image' && item.url) {
          return (
            <a
              key={key}
              href={item.url}
              target="_blank"
              rel="noreferrer"
              className="group block overflow-hidden rounded-[14px] bg-black/6 dark:bg-white/10"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={item.url}
                alt={label}
                className="max-h-[260px] w-full min-w-[180px] object-cover"
                loading="lazy"
              />
              <span className="flex min-w-0 items-center gap-2 px-2 py-1.5 text-[11px] font-semibold">
                <ImageIcon className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {detail ? (
                  <span className="shrink-0 opacity-70">{detail}</span>
                ) : null}
              </span>
            </a>
          );
        }
        if (kind === 'video' && item.url) {
          return (
            <div
              key={key}
              className="overflow-hidden rounded-[14px] bg-black/6 dark:bg-white/10"
            >
              <video
                src={item.url}
                className="max-h-[260px] w-full min-w-[180px] object-cover"
                controls
                preload="metadata"
              />
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex min-w-0 items-center gap-2 px-2 py-1.5 text-[11px] font-semibold"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                {detail ? (
                  <span className="shrink-0 opacity-70">{detail}</span>
                ) : null}
              </a>
            </div>
          );
        }
        return (
          <a
            key={key}
            href={item.url || undefined}
            target={item.url ? '_blank' : undefined}
            rel={item.url ? 'noreferrer' : undefined}
            className="flex min-w-0 items-center gap-2 rounded-[12px] bg-black/6 px-2 py-1.5 text-[11px] font-semibold dark:bg-white/10"
          >
            <Icon className="h-3.5 w-3.5 shrink-0" />
            <span className="min-w-0 flex-1 truncate">{label}</span>
            <span className="shrink-0 opacity-70">
              {item.url
                ? formatBytes(item.size)
                : item.has_inline_image
                  ? 'vision only'
                  : formatBytes(item.size)}
            </span>
          </a>
        );
      })}
    </div>
  );
}

function getLocaleFromPath(pathname: string | null) {
  return pathname?.split('/').filter(Boolean)[0] === 'en' ? 'en' : 'id';
}

function buttonsToText(buttons: QuickButton[]) {
  return buttons
    .map(button =>
      [button.label, button.prompt, button.instructionAppend || '']
        .map(part => part.trim())
        .filter(Boolean)
        .join(' :: '),
    )
    .join('\n');
}

function parseButtons(text: string): QuickButton[] {
  return text
    .split('\n')
    .map(row => row.trim())
    .filter(Boolean)
    .slice(0, 12)
    .map((row, index) => {
      const [labelRaw, ...promptParts] = row.split('::');
      const prompt = (promptParts[0] || '').trim() || row;
      const instructionAppend = promptParts.slice(1).join('::').trim();
      const label = labelRaw.trim().slice(0, 36) || `Tombol ${index + 1}`;
      return {
        id: `btn_${index + 1}`,
        label,
        prompt: prompt.slice(0, 600),
        instructionAppend: instructionAppend.slice(0, 1200) || undefined,
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
    visibility: normalizeUiVisibility(agent.visibility),
    instructions: agent.instructions,
    tone: agent.tone,
    model_preference: agent.model_preference,
    temperature: agent.temperature,
    memory_enabled: agent.memory_enabled,
    builder_config:
      agent.builder_config || createDefaultPersonalAiBuilderConfig(),
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

function creationTargetLabel(target: SupportedCreationTarget, isId: boolean) {
  if (target === 'offering_listing') return isId ? 'penawaran' : 'offer';
  if (target === 'looking_for_listing') return isId ? 'kebutuhan' : 'request';
  return isId ? 'profil usaha' : 'business profile';
}

export default function PersonalAiStudio() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPath(pathname);
  const isId = locale === 'id';
  const { user, authFetch, loading: authLoading } = useAuth();
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const draftAttachmentsRef = useRef<AiDraftAttachment[]>([]);

  const [agents, setAgents] = useState<PersonalAgent[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState<SettingsDraft>(DEFAULT_DRAFT);
  const [input, setInput] = useState('');
  const [draftAttachments, setDraftAttachments] = useState<AiDraftAttachment[]>(
    [],
  );
  const [activePanel, setActivePanel] = useState<PersonalAiPanel>('chat');
  const [mobileLibraryOpen, setMobileLibraryOpen] = useState(false);
  const [mobileToolsOpen, setMobileToolsOpen] = useState(false);
  const [selectedBuilderStepId, setSelectedBuilderStepId] = useState('');
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [sending, setSending] = useState(false);
  const [saving, setSaving] = useState(false);
  const [composerFocused, setComposerFocused] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [creationDrafts, setCreationDrafts] = useState<
    Record<string, AICreationDraft>
  >({});
  const [discardingDraftId, setDiscardingDraftId] = useState('');
  const [editingCreationDraft, setEditingCreationDraft] =
    useState<AICreationDraft | null>(null);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [reactionMessageId, setReactionMessageId] = useState('');
  const [forwardingMessage, setForwardingMessage] =
    useState<ChatMessage | null>(null);
  const [forwarding, setForwarding] = useState(false);

  useEffect(() => {
    draftAttachmentsRef.current = draftAttachments;
  }, [draftAttachments]);

  useEffect(
    () => () => {
      draftAttachmentsRef.current.forEach(revokeAttachmentPreview);
    },
    [],
  );

  const shareId = searchParams.get('share') || '';
  const selectedAgent =
    agents.find(agent => agent.id === selectedAgentId) || null;
  const canEditSelected = Boolean(selectedAgent?.can_edit);

  const copy = useMemo(
    () =>
      isId
        ? {
            title: 'AI Pribadi',
            newAi: 'AI baru',
            newTab: 'Tab baru',
            settings: 'Setting',
            builder: 'Builder',
            share: 'Share',
            memory: 'Memory',
            private: 'Private',
            shared: 'Unlisted',
            public: 'Public',
            save: 'Simpan',
            send: 'Kirim',
            placeholder:
              'Tanya apa pun tentang usaha, supplier, modal, risiko, atau langkah berikutnya...',
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
            builder: 'Builder',
            share: 'Share',
            memory: 'Memory',
            private: 'Private',
            shared: 'Unlisted',
            public: 'Public',
            save: 'Save',
            send: 'Send',
            placeholder:
              'Ask about business ideas, suppliers, capital, risk, or next steps...',
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

  const latestCreationMessageByDraftId = useMemo(() => {
    const result = new Map<string, string>();
    messages.forEach(message => {
      const draft =
        creationDrafts[message.id] || creationDraftFromMessage(message);
      if (draft?.id) result.set(draft.id, message.id);
    });
    return result;
  }, [creationDrafts, messages]);

  const activeCreationFlow = useMemo(() => {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
      const flow = creationFlowFromMessage(messages[index]!);
      if (!flow) continue;
      return flow.status === 'collecting' ? flow : null;
    }
    return null;
  }, [messages]);

  useBodyScrollLock(true, { resetScroll: true });

  const scrollMessagesToBottom = useCallback(
    (behavior: ScrollBehavior = 'auto') => {
      const viewport = messagesViewportRef.current;
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior,
        });
        return;
      }

      messagesEndRef.current?.scrollIntoView({
        behavior,
        block: 'end',
      });
    },
    [],
  );

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
        data?: {
          agents?: PersonalAgent[];
          shared_agent?: PersonalAgent | null;
        };
        error?: string;
      };
      if (!res.ok || !payload.data)
        throw new Error(payload.error || copy.noAgent);
      const nextAgents = [...(payload.data.agents || [])];
      if (
        payload.data.shared_agent &&
        !nextAgents.some(agent => agent.id === payload.data?.shared_agent?.id)
      ) {
        nextAgents.unshift(payload.data.shared_agent);
      }
      setAgents(nextAgents);
      setSelectedAgentId(
        current =>
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
      setReplyingTo(null);
      setReactionMessageId('');
      const res = await authFetch(
        `/api/ai/personal/threads/${encodeURIComponent(threadId)}`,
        {
          cache: 'no-store',
        },
      );
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { messages?: ChatMessage[] };
      };
      const nextMessages = payload.data?.messages || [];
      setMessages(nextMessages);
      const linkedDrafts = nextMessages
        .map(message => ({
          messageId: message.id,
          draft: creationDraftFromMessage(message),
        }))
        .filter((item): item is { messageId: string; draft: AICreationDraft } =>
          Boolean(item.draft),
        )
        .slice(-20);
      const hydratedDrafts = await Promise.all(
        linkedDrafts.map(async item => {
          const response = await authFetch(
            `/api/creation-drafts/${encodeURIComponent(item.draft.id)}`,
            { cache: 'no-store' },
          );
          const draftPayload = (await response.json().catch(() => ({}))) as {
            data?: AICreationDraft;
          };
          return response.ok && draftPayload.data
            ? ([
                item.messageId,
                {
                  ...draftPayload.data,
                  continueUrl: item.draft.continueUrl,
                },
              ] as const)
            : null;
        }),
      );
      setCreationDrafts(
        Object.fromEntries(
          hydratedDrafts.filter((item): item is NonNullable<typeof item> =>
            Boolean(item),
          ),
        ),
      );
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
    setSelectedBuilderStepId(
      selectedAgent?.builder_config?.steps?.[0]?.id ||
        createDefaultPersonalAiBuilderConfig().steps[0]?.id ||
        '',
    );
  }, [selectedAgent]);

  useEffect(() => {
    const raf = window.requestAnimationFrame(() => {
      scrollMessagesToBottom(composerFocused ? 'auto' : 'smooth');
    });
    return () => window.cancelAnimationFrame(raf);
  }, [composerFocused, messages.length, scrollMessagesToBottom, sending]);

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
      if (!res.ok || !payload.data?.agent)
        throw new Error(payload.error || copy.createFailed);
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
            builder_config: draft.builder_config,
            quick_buttons: parseButtons(draft.quick_buttons_text),
            starter_prompts: parsePrompts(draft.starter_prompts_text),
          }),
        },
      );
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { agent?: PersonalAgent };
        error?: string;
      };
      if (!res.ok || !payload.data?.agent)
        throw new Error(payload.error || copy.saveFailed);
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
    if (
      !selectedAgent ||
      !canEditSelected ||
      agents.filter(agent => agent.can_edit).length <= 1
    )
      return;
    const res = await authFetch(
      `/api/ai/personal/agents/${encodeURIComponent(selectedAgent.id)}`,
      { method: 'DELETE' },
    );
    if (res.ok) {
      setAgents(current =>
        current.filter(agent => agent.id !== selectedAgent.id),
      );
      setSelectedAgentId(
        agents.find(agent => agent.id !== selectedAgent.id)?.id || '',
      );
    }
  }

  async function createThread() {
    if (!selectedAgent) return null;
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
      return payload.data.thread;
    }
    return null;
  }

  const removeDraftAttachment = useCallback((attachmentId: string) => {
    setDraftAttachments(current => {
      const target = current.find(attachment => attachment.id === attachmentId);
      if (target) revokeAttachmentPreview(target);
      return current.filter(attachment => attachment.id !== attachmentId);
    });
  }, []);

  const clearDraftAttachments = useCallback((shouldRevoke = true) => {
    setDraftAttachments(current => {
      if (shouldRevoke) current.forEach(revokeAttachmentPreview);
      return [];
    });
  }, []);

  async function uploadPersonalAiMedia(
    file: File,
  ): Promise<StoredPersonalAiMedia | null> {
    const form = new FormData();
    form.append('file', file);
    const res = await authFetch('/api/ai/personal/media', {
      method: 'POST',
      body: form,
    });
    const payload = (await res.json().catch(() => ({}))) as {
      data?: StoredPersonalAiMedia;
      files?: StoredPersonalAiMedia[];
      error?: string;
      details?: string;
    };
    if (!res.ok) {
      throw new Error(
        payload.details || payload.error || 'Upload media gagal.',
      );
    }
    return payload.data || payload.files?.[0] || null;
  }

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (files.length === 0) return;

    const availableSlots = Math.max(
      0,
      MAX_AI_ATTACHMENTS - draftAttachments.length,
    );
    if (availableSlots <= 0) {
      setError(
        isId ? 'Maksimal 4 media per pesan.' : 'Maximum 4 media per message.',
      );
      return;
    }

    const acceptedFiles = files.slice(0, availableSlots);
    const next: AiDraftAttachment[] = [];

    for (const file of acceptedFiles) {
      const kind = fileKind(file);
      if (file.size > 5_000_000) {
        setError(
          isId
            ? 'File terlalu besar. Batas sementara 5 MB per file.'
            : 'File is too large. Current limit is 5 MB per file.',
        );
        continue;
      }

      const attachment: AiDraftAttachment = {
        id: `media_${Date.now()}_${Math.random().toString(36).slice(2)}`,
        name: file.name,
        mime: file.type || 'application/octet-stream',
        size: file.size,
        kind,
      };

      if (kind === 'image') {
        if (file.size <= MAX_INLINE_IMAGE_BYTES) {
          attachment.dataUrl = await readAsDataUrl(file);
        } else {
          setError(
            isId
              ? 'Gambar besar tetap dilampirkan sebagai metadata. Untuk dibaca AI vision, kompres di bawah 1.6 MB.'
              : 'Large image attached as metadata. Compress below 1.6 MB for vision reading.',
          );
        }
        attachment.previewUrl = URL.createObjectURL(file);
      } else if (kind === 'video' || kind === 'audio') {
        attachment.previewUrl = URL.createObjectURL(file);
      }

      if (canReadText(file)) {
        attachment.text = (await readAsText(file)).slice(0, 1600);
      }

      try {
        const stored = await uploadPersonalAiMedia(file);
        if (stored?.url) {
          attachment.url = stored.url;
          attachment.mime = stored.mime || attachment.mime;
          attachment.size = stored.size || attachment.size;
        }
      } catch (uploadError) {
        setError(
          uploadError instanceof Error
            ? uploadError.message
            : isId
              ? 'Upload media gagal.'
              : 'Media upload failed.',
        );
      }

      next.push(attachment);
    }

    if (next.length > 0) {
      setDraftAttachments(current =>
        [...current, ...next].slice(0, MAX_AI_ATTACHMENTS),
      );
    }
  }

  function attachmentPayload(attachment: AiDraftAttachment) {
    return {
      kind: attachment.kind,
      name: attachment.name,
      mime: attachment.mime,
      size: attachment.size,
      url: attachment.url,
      data_url: attachment.dataUrl,
      text: attachment.text,
    };
  }

  function attachmentMetadata(attachment: AiDraftAttachment): AiStoredMedia {
    return {
      kind: attachment.kind,
      name: attachment.name,
      mime: attachment.mime,
      size: attachment.size,
      url: attachment.url,
      has_inline_image: Boolean(attachment.dataUrl),
      has_text: Boolean(attachment.text),
    };
  }

  function readableSendError(errorValue: unknown) {
    const message =
      errorValue instanceof Error
        ? errorValue.message
        : String(errorValue || '');
    if (/failed to fetch|networkerror|load failed/i.test(message)) {
      return isId
        ? 'Pesan belum terkirim karena koneksi atau server terlalu lama merespons. Coba kirim ulang.'
        : 'The message was not sent because the connection or server response took too long. Please retry.';
    }
    if (/aborted|timeout|timed out/i.test(message)) {
      return isId
        ? 'AI butuh terlalu lama memproses pesan ini. Coba kirim ulang atau gunakan gambar yang lebih kecil.'
        : 'The AI took too long to process this message. Please retry or use a smaller image.';
    }
    return message || copy.sendFailed;
  }

  async function sendMessage(
    text = input,
    options: {
      actionInstruction?: string;
      clearInput?: boolean;
      creationTarget?: SupportedCreationTarget;
      creationIntent?: SupportedCreationTarget;
    } = {},
  ) {
    const activeEditingDraft = options.creationTarget
      ? null
      : editingCreationDraft;
    const creationTarget =
      options.creationTarget ||
      (isSupportedCreationTarget(activeEditingDraft?.target)
        ? activeEditingDraft.target
        : undefined);
    const guidedCreationTarget =
      options.creationIntent ||
      (!creationTarget ? activeCreationFlow?.target : undefined);
    const activeAttachments = [...draftAttachments];
    const activeReply = replyingTo;
    const message =
      text.trim() ||
      (activeAttachments.length > 0
        ? isId
          ? 'Tolong analisis media ini dan jelaskan hal pentingnya.'
          : 'Please analyze this media and explain the important parts.'
        : '');
    if (
      (!message && activeAttachments.length === 0) ||
      !selectedAgent ||
      sending
    )
      return;
    setSending(true);
    setError('');
    if (options.clearInput !== false) setInput('');
    setDraftAttachments([]);
    setReplyingTo(null);
    const optimisticReply = activeReply
      ? {
          message_id: activeReply.id,
          role: activeReply.role,
          excerpt: activeReply.content.slice(0, 500),
        }
      : undefined;
    const optimistic: ChatMessage = {
      id: `local_${Date.now()}`,
      role: 'user',
      content: message,
      created_at: new Date().toISOString(),
      metadata:
        activeAttachments.length > 0 || optimisticReply
          ? {
              ...(activeAttachments.length > 0
                ? { media: activeAttachments.map(attachmentMetadata) }
                : {}),
              ...(optimisticReply ? { reply_to: optimisticReply } : {}),
            }
          : undefined,
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
          action_instruction: options.actionInstruction || '',
          creation_target: guidedCreationTarget,
          reply_to_message_id: activeReply?.id,
          attachments: activeAttachments.map(attachmentPayload),
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
      if (!res.ok || !payload.data?.messages) {
        throw new Error(payload.error || `${copy.sendFailed} (${res.status})`);
      }
      if (payload.data.thread) {
        setSelectedThreadId(payload.data.thread.id);
        setThreads(current => {
          const without = current.filter(
            thread => thread.id !== payload.data!.thread!.id,
          );
          return [payload.data!.thread!, ...without];
        });
      }
      const savedMessages = payload.data.messages;
      setMessages(current => [
        ...current.filter(messageItem => messageItem.id !== optimistic.id),
        ...savedMessages,
      ]);
      const assistantMessage = savedMessages.find(
        item => item.role === 'assistant',
      );
      const assistantCreationFlow = assistantMessage
        ? creationFlowFromMessage(assistantMessage)
        : null;
      const draftCreationTarget =
        creationTarget ||
        (assistantCreationFlow?.status === 'ready'
          ? assistantCreationFlow.target
          : undefined);
      if (draftCreationTarget && assistantMessage) {
        try {
          const creationMedia = assistantCreationFlow?.media?.length
            ? assistantCreationFlow.media
            : activeAttachments.map(attachmentPayload);
          const draftResponse = await authFetch('/api/ai/creation-drafts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              target: draftCreationTarget,
              draftId: activeEditingDraft?.id,
              instruction: assistantCreationFlow?.draftInstruction || message,
              assistantContext: assistantMessage.content,
              conversationId:
                payload.data.thread?.id || selectedThreadId || undefined,
              assistantMessageId: assistantMessage.id,
              idempotencyKey: `profile-ai:${assistantMessage.id}:${draftCreationTarget}`,
              media: creationMedia,
              locale,
            }),
          });
          const draftPayload = (await draftResponse
            .json()
            .catch(() => ({}))) as {
            data?: AICreationDraft;
            error?: string;
          };
          if (!draftResponse.ok || !draftPayload.data) {
            throw new Error(
              draftPayload.error ||
                (isId
                  ? 'Draft belum dapat dibuat.'
                  : 'The draft could not be created.'),
            );
          }
          setCreationDrafts(current => ({
            ...current,
            [assistantMessage.id]: draftPayload.data!,
          }));
          setMessages(current =>
            current.map(item =>
              item.id === assistantMessage.id
                ? {
                    ...item,
                    metadata: {
                      ...item.metadata,
                      creation_draft: draftPayload.data,
                    },
                  }
                : item,
            ),
          );
          setEditingCreationDraft(null);
        } catch (draftError) {
          setError(
            draftError instanceof Error
              ? draftError.message
              : isId
                ? 'Jawaban AI berhasil, tetapi draft belum tersimpan.'
                : 'The AI replied, but the draft was not saved.',
          );
        }
      }
      activeAttachments.forEach(revokeAttachmentPreview);
    } catch (err) {
      setError(readableSendError(err));
      setMessages(current =>
        current.filter(messageItem => messageItem.id !== optimistic.id),
      );
      setInput(message);
      setDraftAttachments(activeAttachments);
      setReplyingTo(activeReply);
    } finally {
      setSending(false);
    }
  }

  function startCreation(target: SupportedCreationTarget) {
    const fallbackPrompt: Record<SupportedCreationTarget, string> = {
      offering_listing: isId
        ? 'Saya ingin membuat penawaran dari informasi dan media yang saya kirim.'
        : 'I want to create an offer from the information and media I send.',
      looking_for_listing: isId
        ? 'Saya ingin membuat postingan kebutuhan dari informasi dan media yang saya kirim.'
        : 'I want to create a request from the information and media I send.',
      business_profile: isId
        ? 'Saya ingin mendaftarkan profil usaha dari informasi dan media yang saya kirim.'
        : 'I want to register a business profile from the information and media I send.',
    };
    setEditingCreationDraft(null);
    void sendMessage(input.trim() || fallbackPrompt[target], {
      creationIntent: target,
    });
  }

  function improveCreationDraft(draft: AICreationDraft) {
    setEditingCreationDraft(draft);
    setInput(
      isId
        ? `Perbaiki draft "${draft.title}". Bagian yang ingin saya ubah: `
        : `Improve the draft "${draft.title}". I want to change: `,
    );
    requestAnimationFrame(() => scrollMessagesToBottom('smooth'));
  }

  async function copyMessage(message: ChatMessage) {
    try {
      await navigator.clipboard.writeText(message.content);
      setNotice(isId ? 'Pesan disalin' : 'Message copied');
    } catch {
      setError(isId ? 'Pesan gagal disalin.' : 'Failed to copy message.');
    }
  }

  async function reactToMessage(message: ChatMessage, reaction: string) {
    if (message.id.startsWith('local_')) return;
    const previousReaction = messageReaction(message);
    const nextReaction = previousReaction === reaction ? '' : reaction;
    setReactionMessageId('');
    setMessages(current =>
      current.map(item =>
        item.id === message.id
          ? {
              ...item,
              metadata: {
                ...item.metadata,
                user_reaction: nextReaction || undefined,
              },
            }
          : item,
      ),
    );
    try {
      const response = await authFetch(
        `/api/ai/personal/messages/${encodeURIComponent(message.id)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reaction: nextReaction }),
        },
      );
      if (!response.ok) throw new Error('reaction failed');
    } catch {
      setMessages(current =>
        current.map(item =>
          item.id === message.id
            ? {
                ...item,
                metadata: {
                  ...item.metadata,
                  user_reaction: previousReaction || undefined,
                },
              }
            : item,
        ),
      );
      setError(isId ? 'Reaksi gagal disimpan.' : 'Failed to save reaction.');
    }
  }

  async function forwardMessageToThread(targetThreadId: string) {
    if (!forwardingMessage || forwarding) return;
    setForwarding(true);
    setError('');
    try {
      const response = await authFetch(
        `/api/ai/personal/messages/${encodeURIComponent(forwardingMessage.id)}/forward`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_thread_id: targetThreadId }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { message?: ChatMessage; thread?: ChatThread };
        error?: string;
      };
      if (!response.ok || !payload.data?.message) {
        throw new Error(
          payload.error ||
            (isId ? 'Pesan gagal diteruskan.' : 'Failed to forward message.'),
        );
      }
      if (payload.data.thread) {
        setThreads(current => {
          const without = current.filter(
            thread => thread.id !== payload.data!.thread!.id,
          );
          return [payload.data!.thread!, ...without];
        });
      }
      setForwardingMessage(null);
      setNotice(isId ? 'Pesan diteruskan' : 'Message forwarded');
      if (targetThreadId === selectedThreadId) {
        setMessages(current => [...current, payload.data!.message!]);
      } else {
        setSelectedThreadId(targetThreadId);
        await loadThreadMessages(targetThreadId);
      }
    } catch (forwardError) {
      setError(
        forwardError instanceof Error
          ? forwardError.message
          : isId
            ? 'Pesan gagal diteruskan.'
            : 'Failed to forward message.',
      );
    } finally {
      setForwarding(false);
    }
  }

  async function forwardMessageToNewThread() {
    const thread = await createThread();
    if (thread) await forwardMessageToThread(thread.id);
  }

  async function discardCreationDraft(
    messageId: string,
    draft: AICreationDraft,
  ) {
    if (discardingDraftId) return;
    setDiscardingDraftId(draft.id);
    setError('');
    try {
      const response = await authFetch(
        `/api/creation-drafts/${encodeURIComponent(draft.id)}`,
        { method: 'DELETE' },
      );
      if (!response.ok && response.status !== 404) {
        const payload = (await response.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(
          payload.error ||
            (isId ? 'Draft gagal dihapus.' : 'Failed to delete draft.'),
        );
      }
      setCreationDrafts(current => {
        return Object.fromEntries(
          Object.entries(current).filter(([, item]) => item.id !== draft.id),
        );
      });
      setMessages(current =>
        current.map(message => {
          const linkedDraft = creationDraftFromMessage(message);
          if (
            !message.metadata ||
            (message.id !== messageId && linkedDraft?.id !== draft.id)
          ) {
            return message;
          }
          const metadata = { ...message.metadata };
          delete metadata.creation_draft;
          return { ...message, metadata };
        }),
      );
    } catch (discardError) {
      setError(
        discardError instanceof Error
          ? discardError.message
          : isId
            ? 'Draft gagal dihapus.'
            : 'Failed to delete draft.',
      );
    } finally {
      setDiscardingDraftId('');
    }
  }

  function applyBuilderTemplate(templateId: string) {
    const template = PERSONAL_AI_BUILDER_TEMPLATES.find(
      item => item.id === templateId,
    );
    if (!template || !canEditSelected) return;
    const config = template.config;
    setDraft(current => ({
      ...current,
      name: config.branding.name,
      description: config.branding.shortDescription,
      instructions: [
        config.instructions.baseInstruction,
        '',
        'Behavior rules:',
        ...config.instructions.behaviorRules.map(rule => `- ${rule}`),
        config.instructions.negativeInstruction
          ? `\nNegative instruction:\n${config.instructions.negativeInstruction}`
          : '',
      ]
        .filter(Boolean)
        .join('\n'),
      builder_config: config,
      quick_buttons_text: template.quickButtons
        .map(button =>
          [button.label, button.prompt, button.instructionAppend].join(' :: '),
        )
        .join('\n'),
      starter_prompts_text: template.quickButtons
        .map(button => button.prompt)
        .slice(0, 4)
        .join('\n'),
    }));
    setSelectedBuilderStepId(config.steps[0]?.id || '');
    setNotice(
      isId
        ? `Template ${template.name} dipakai. Jangan lupa simpan.`
        : `${template.name} template applied. Do not forget to save.`,
    );
  }

  function updateBuilderConfig(
    updater: (current: PersonalAiBuilderConfig) => PersonalAiBuilderConfig,
  ) {
    setDraft(current => ({
      ...current,
      builder_config: updater(
        current.builder_config || createDefaultPersonalAiBuilderConfig(),
      ),
    }));
  }

  function updateSelectedBuilderStep(
    updater: (step: AIBuilderStep) => AIBuilderStep,
  ) {
    updateBuilderConfig(config => ({
      ...config,
      steps: config.steps.map(step =>
        step.id === selectedBuilderStepId ? updater(step) : step,
      ),
    }));
  }

  function addBuilderStep() {
    const nextStep: AIBuilderStep = {
      id: `step_${Date.now()}`,
      title: isId ? 'Step baru' : 'New step',
      description: '',
      icon: 'sparkles',
      blocks: [
        {
          id: `block_${Date.now()}`,
          type: 'text',
          label: isId ? 'Input user' : 'User input',
          variable: 'input',
          placeholder: isId ? 'Tulis kebutuhan...' : 'Write the need...',
        },
      ],
    };
    updateBuilderConfig(config => ({
      ...config,
      steps: [...config.steps, nextStep].slice(0, 12),
    }));
    setSelectedBuilderStepId(nextStep.id);
  }

  function updateSelectedBuilderBlock(
    blockId: string,
    updater: (block: AIBuilderBlock) => AIBuilderBlock,
  ) {
    updateSelectedBuilderStep(step => ({
      ...step,
      blocks: step.blocks.map(block =>
        block.id === blockId ? updater(block) : block,
      ),
    }));
  }

  function addBuilderBlock(type: AIBuilderBlockType = 'text') {
    const label = isId ? 'Input baru' : 'New input';
    const nextBlock: AIBuilderBlock = {
      id: `block_${Date.now()}`,
      type,
      label,
      variable: variableKeyFromLabel(label),
      required: false,
      placeholder:
        type === 'textarea'
          ? isId
            ? 'Tulis detail kebutuhan...'
            : 'Write the details...'
          : undefined,
      options:
        type === 'single_choice' || type === 'multi_choice'
          ? [
              {
                id: 'option_1',
                label: isId ? 'Pilihan 1' : 'Option 1',
                value: 'option_1',
              },
              {
                id: 'option_2',
                label: isId ? 'Pilihan 2' : 'Option 2',
                value: 'option_2',
              },
            ]
          : undefined,
    };
    updateSelectedBuilderStep(step => ({
      ...step,
      blocks: [...step.blocks, nextBlock].slice(0, 80),
    }));
  }

  function removeBuilderBlock(blockId: string) {
    updateSelectedBuilderStep(step => ({
      ...step,
      blocks:
        step.blocks.length > 1
          ? step.blocks.filter(block => block.id !== blockId)
          : step.blocks,
    }));
  }

  function addOutputSection() {
    const title = isId ? 'Output baru' : 'New output';
    const nextSection: AIOutputSection = {
      id: `section_${Date.now()}`,
      key: variableKeyFromLabel(title),
      title,
      type: 'markdown',
      copyable: true,
      downloadable: false,
      instruction: isId
        ? 'Jelaskan hasil bagian ini dengan jelas dan siap dipakai user.'
        : 'Explain this output clearly so the user can use it immediately.',
    };
    updateBuilderConfig(config => ({
      ...config,
      output: {
        ...config.output,
        sections: [...config.output.sections, nextSection].slice(0, 24),
      },
    }));
  }

  function updateOutputSection(
    sectionId: string,
    updater: (section: AIOutputSection) => AIOutputSection,
  ) {
    updateBuilderConfig(config => ({
      ...config,
      output: {
        ...config.output,
        sections: config.output.sections.map(section =>
          section.id === sectionId ? updater(section) : section,
        ),
      },
    }));
  }

  function removeOutputSection(sectionId: string) {
    updateBuilderConfig(config => ({
      ...config,
      output: {
        ...config.output,
        sections:
          config.output.sections.length > 1
            ? config.output.sections.filter(section => section.id !== sectionId)
            : config.output.sections,
      },
    }));
  }

  async function copyShareLink() {
    if (!shareUrl) return;
    await navigator.clipboard?.writeText(shareUrl);
    setNotice(copy.copied);
  }

  if (authLoading || loadingAgents) {
    return (
      <main className="lajukan-visual-viewport-shell flex min-h-0 items-center justify-center overflow-hidden bg-[color:var(--app-surface-muted)] px-4">
        <div className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--app-text-soft)]">
          <Loader2 className="h-4 w-4 animate-spin" />
          {isId ? 'Menyiapkan AI...' : 'Preparing AI...'}
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="lajukan-visual-viewport-shell flex min-h-0 items-center justify-center overflow-hidden bg-[color:var(--app-surface-muted)] px-4">
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
  const panels: PersonalAiPanel[] = [
    'chat',
    'builder',
    'settings',
    'share',
    'memory',
  ];
  const panelLabel = (panel: PersonalAiPanel) =>
    panel === 'chat'
      ? 'Chat'
      : panel === 'builder'
        ? copy.builder
        : panel === 'settings'
          ? copy.settings
          : panel === 'share'
            ? copy.share
            : copy.memory;
  const panelIcon = (panel: PersonalAiPanel) =>
    panel === 'chat' ? (
      <Bot className="h-3.5 w-3.5" />
    ) : panel === 'builder' ? (
      <Layers3 className="h-3.5 w-3.5" />
    ) : panel === 'settings' ? (
      <Settings2 className="h-3.5 w-3.5" />
    ) : panel === 'share' ? (
      <Share2 className="h-3.5 w-3.5" />
    ) : (
      <Sparkles className="h-3.5 w-3.5" />
    );
  const selectPanel = (panel: PersonalAiPanel) => {
    setActivePanel(panel);
    setMobileToolsOpen(false);
  };

  return (
    <main className="lajukan-visual-viewport-shell min-h-0 overflow-hidden overscroll-none bg-[#d9dbd5] text-[color:var(--app-text)] dark:bg-[#0b141a]">
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
                    setMobileToolsOpen(false);
                  }}
                  className={cn(
                    'min-w-0 rounded-[14px] border p-3 text-left transition',
                    selectedAgentId === agent.id
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]'
                      : 'border-[color:var(--app-border)] bg-[color:var(--app-surface)] hover:border-[color:var(--app-accent-border)]',
                  )}
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span className="truncate text-sm font-bold">
                      {agent.name}
                    </span>
                    {normalizeUiVisibility(agent.visibility) !== 'private' ? (
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
            <div className="relative shrink-0 border-b border-black/5 bg-[#f0f2f5] px-3 py-2 dark:border-white/6 dark:bg-[#202c33]">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileLibraryOpen(true);
                      setMobileToolsOpen(false);
                    }}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/8 lg:hidden"
                    aria-label={isId ? 'Buka daftar AI' : 'Open AI list'}
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </button>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-[#111b21] dark:text-[#e9edef]">
                      {selectedAgent?.name || copy.noAgent}
                    </p>
                    <p className="text-[11px] font-semibold text-[#667781] dark:text-[#8696a0]">
                      {visibilityLabel(selectedAgent?.visibility, isId)}
                      {selectedAgent?.can_edit ? '' : ' · shared AI'}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setMobileToolsOpen(value => !value)}
                  className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-[11px] font-bold text-[#54656f] shadow-sm dark:bg-[#111b21] dark:text-[#aebac1] sm:hidden"
                  aria-expanded={mobileToolsOpen}
                >
                  {panelIcon(activePanel)}
                  {panelLabel(activePanel)}
                </button>
                <div className="hidden min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:flex [&::-webkit-scrollbar]:hidden">
                  {panels.map(panel => (
                    <button
                      key={panel}
                      type="button"
                      onClick={() => selectPanel(panel)}
                      className={cn(
                        'inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full px-3 text-[11px] font-bold',
                        activePanel === panel
                          ? 'bg-[#25d366] text-[#111b21]'
                          : 'bg-white text-[#54656f] hover:text-[#128c7e] dark:bg-[#111b21] dark:text-[#aebac1]',
                      )}
                    >
                      {panelIcon(panel)}
                      {panelLabel(panel)}
                    </button>
                  ))}
                </div>
              </div>
              {mobileToolsOpen ? (
                <div className="absolute left-3 right-3 top-[calc(100%+0.4rem)] z-50 grid grid-cols-2 gap-1.5 rounded-[18px] border border-black/10 bg-white p-2 shadow-[0_24px_70px_-34px_rgba(17,27,33,0.5)] dark:border-white/10 dark:bg-[#111b21] sm:hidden">
                  {panels.map(panel => (
                    <button
                      key={panel}
                      type="button"
                      onClick={() => selectPanel(panel)}
                      className={cn(
                        'inline-flex min-h-10 items-center justify-center gap-1.5 rounded-[14px] px-3 text-[11px] font-bold',
                        activePanel === panel
                          ? 'bg-[#25d366] text-[#111b21]'
                          : 'bg-[#f0f2f5] text-[#54656f] dark:bg-[#202c33] dark:text-[#aebac1]',
                      )}
                    >
                      {panelIcon(panel)}
                      {panelLabel(panel)}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            {notice || error ? (
              <div className="grid gap-2 border-b border-[color:var(--app-border)] px-3 py-2 lg:hidden">
                {notice ? (
                  <div className="flex items-center gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                    <Check className="h-4 w-4" />
                    {notice}
                    <button
                      type="button"
                      onClick={() => setNotice('')}
                      className="ml-auto"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
                {error ? (
                  <div className="flex items-center gap-2 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                    {error}
                    <button
                      type="button"
                      onClick={() => setError('')}
                      className="ml-auto"
                    >
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
                      <span className="text-[9px] opacity-70">
                        {compactTime(thread.updated_at)}
                      </span>
                    </button>
                  ))}
                </div>

                <div
                  ref={messagesViewportRef}
                  className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-2 py-4 [-webkit-overflow-scrolling:touch] sm:px-4"
                  data-auto-scrollbar
                >
                  {messages.length === 0 ? (
                    <div className="mx-auto mt-10 max-w-lg rounded-[18px] border border-dashed border-black/10 bg-white/80 p-4 text-center shadow-[0_14px_34px_-28px_rgba(17,27,33,0.35)]  dark:border-white/10 dark:bg-[#202c33]/84">
                      <Sparkles className="mx-auto h-6 w-6 text-[color:var(--app-accent)]" />
                      <p className="mt-2 text-sm font-bold">{copy.empty}</p>
                      {selectedAgent?.starter_prompts?.length ? (
                        <div className="mt-3 flex flex-wrap justify-center gap-2">
                          {selectedAgent.starter_prompts
                            .slice(0, 3)
                            .map(prompt => (
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
                      {messages.map(message => {
                        const linkedDraft =
                          creationDrafts[message.id] ||
                          creationDraftFromMessage(message);
                        const replyReference =
                          replyReferenceFromMessage(message);
                        const forwarded = isForwardedMessage(message);
                        const reaction = messageReaction(message);
                        return (
                          <div
                            key={message.id}
                            className={cn(
                              'max-w-[88%] break-words',
                              message.role === 'user'
                                ? 'ml-auto'
                                : linkedDraft
                                  ? 'mr-auto w-full max-w-xl'
                                  : 'mr-auto',
                            )}
                          >
                            <div
                              className={cn(
                                'rounded-[18px] px-3 py-2 text-sm leading-6 shadow-[0_10px_22px_-18px_rgba(17,27,33,0.32)]',
                                message.role === 'user'
                                  ? 'rounded-br-[6px] bg-[#d9fdd3] text-[#111b21] dark:bg-[#005c4b] dark:text-[#e9edef]'
                                  : 'rounded-bl-[6px] border border-black/5 bg-white text-[#111b21] dark:border-white/6 dark:bg-[#202c33] dark:text-[#e9edef]',
                              )}
                            >
                              {forwarded ? (
                                <p className="mb-1 flex items-center gap-1 text-[10px] font-semibold opacity-65">
                                  <Forward className="h-3 w-3" />
                                  {isId ? 'Diteruskan' : 'Forwarded'}
                                </p>
                              ) : null}
                              {replyReference ? (
                                <div className="mb-2 min-w-0 border-l-2 border-[#128c7e] bg-black/[0.045] px-2 py-1.5 dark:bg-white/[0.07]">
                                  <p className="text-[10px] font-bold text-[#087c6d] dark:text-[#53bdeb]">
                                    {replyReference.role === 'assistant'
                                      ? selectedAgent?.name || copy.title
                                      : isId
                                        ? 'Anda'
                                        : 'You'}
                                  </p>
                                  <p className="line-clamp-2 text-[11px] leading-4 opacity-70">
                                    {replyReference.excerpt}
                                  </p>
                                </div>
                              ) : null}
                              <MessageMediaList
                                media={mediaFromMessage(message)}
                              />
                              <MarkdownMessage content={message.content} />
                            </div>
                            <div
                              className={cn(
                                'mt-1 flex items-center gap-0.5 text-[#667781] dark:text-[#8696a0]',
                                message.role === 'user'
                                  ? 'justify-end'
                                  : 'justify-start',
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setReplyingTo(message);
                                  requestAnimationFrame(() =>
                                    scrollMessagesToBottom('smooth'),
                                  );
                                }}
                                disabled={message.id.startsWith('local_')}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 hover:text-[#128c7e] disabled:opacity-35 dark:hover:bg-white/10"
                                aria-label={
                                  isId ? 'Balas pesan' : 'Reply to message'
                                }
                                title={isId ? 'Balas' : 'Reply'}
                              >
                                <Reply className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setReactionMessageId(current =>
                                    current === message.id ? '' : message.id,
                                  )
                                }
                                disabled={message.id.startsWith('local_')}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 hover:text-[#128c7e] disabled:opacity-35 dark:hover:bg-white/10"
                                aria-label={
                                  isId ? 'Beri reaksi' : 'React to message'
                                }
                                title={isId ? 'Reaksi' : 'React'}
                              >
                                <Smile className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setForwardingMessage(message)}
                                disabled={message.id.startsWith('local_')}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 hover:text-[#128c7e] disabled:opacity-35 dark:hover:bg-white/10"
                                aria-label={
                                  isId ? 'Teruskan pesan' : 'Forward message'
                                }
                                title={isId ? 'Teruskan' : 'Forward'}
                              >
                                <Forward className="h-3.5 w-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => void copyMessage(message)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-full hover:bg-black/5 hover:text-[#128c7e] dark:hover:bg-white/10"
                                aria-label={
                                  isId ? 'Salin pesan' : 'Copy message'
                                }
                                title={isId ? 'Salin' : 'Copy'}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </button>
                              {reaction ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void reactToMessage(message, reaction)
                                  }
                                  className="ml-1 inline-flex h-7 min-w-7 items-center justify-center rounded-full bg-white px-1.5 text-sm shadow-sm ring-1 ring-black/5 dark:bg-[#202c33] dark:ring-white/10"
                                  aria-label={
                                    isId ? 'Hapus reaksi' : 'Remove reaction'
                                  }
                                  title={
                                    isId ? 'Hapus reaksi' : 'Remove reaction'
                                  }
                                >
                                  {reaction}
                                </button>
                              ) : null}
                            </div>
                            {reactionMessageId === message.id ? (
                              <div
                                className={cn(
                                  'mt-1 flex w-fit items-center gap-0.5 rounded-full bg-white p-1 shadow-lg ring-1 ring-black/5 dark:bg-[#202c33] dark:ring-white/10',
                                  message.role === 'user'
                                    ? 'ml-auto'
                                    : 'mr-auto',
                                )}
                              >
                                {['👍', '❤️', '😂', '😮', '😢', '🙏'].map(
                                  emoji => (
                                    <button
                                      key={emoji}
                                      type="button"
                                      onClick={() =>
                                        void reactToMessage(message, emoji)
                                      }
                                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-base hover:bg-black/5 dark:hover:bg-white/10"
                                      aria-label={`${isId ? 'Reaksi' : 'React'} ${emoji}`}
                                    >
                                      {emoji}
                                    </button>
                                  ),
                                )}
                              </div>
                            ) : null}
                            {message.role === 'assistant' &&
                            linkedDraft &&
                            latestCreationMessageByDraftId.get(
                              linkedDraft.id,
                            ) === message.id ? (
                              <AICreationCard
                                draft={linkedDraft}
                                locale={locale}
                                onImprove={improveCreationDraft}
                                onDiscard={draft =>
                                  void discardCreationDraft(message.id, draft)
                                }
                                discarding={
                                  discardingDraftId === linkedDraft.id
                                }
                              />
                            ) : null}
                          </div>
                        );
                      })}
                      {sending ? (
                        <div className="mr-auto inline-flex max-w-[88%] items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-xs font-bold text-[color:var(--app-text-soft)]">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          <span className="truncate">
                            {isId
                              ? 'AI sedang menganalisis. Foto bisa butuh 1-3 menit.'
                              : 'AI is analyzing. Photos can take 1-3 minutes.'}
                          </span>
                        </div>
                      ) : null}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                <div className="lajukan-chat-composer shrink-0 border-t border-black/5 bg-[#f0f2f5] px-2 pb-[var(--chat-composer-bottom-pad)] pt-2 dark:border-white/6 dark:bg-[#202c33] sm:px-3 lg:pb-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept="image/*,video/*,audio/*,.pdf,.txt,.md,.csv,.json"
                    className="hidden"
                    onChange={event => void handleAttachmentChange(event)}
                  />
                  {replyingTo ? (
                    <div className="mb-2 flex min-w-0 items-center gap-2 border-l-2 border-[#128c7e] bg-white px-3 py-2 text-[11px] text-[#111b21] shadow-sm dark:bg-[#2a3942] dark:text-[#e9edef]">
                      <Reply className="h-3.5 w-3.5 shrink-0 text-[#128c7e]" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[10px] font-bold text-[#128c7e]">
                          {isId ? 'Membalas' : 'Replying to'}{' '}
                          {replyingTo.role === 'assistant'
                            ? selectedAgent?.name || copy.title
                            : isId
                              ? 'Anda'
                              : 'You'}
                        </span>
                        <span className="block truncate opacity-70">
                          {replyingTo.content}
                        </span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setReplyingTo(null)}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label={isId ? 'Batalkan balasan' : 'Cancel reply'}
                        title={isId ? 'Batalkan balasan' : 'Cancel reply'}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  {editingCreationDraft ? (
                    <div className="mb-2 flex min-w-0 items-center gap-2 rounded-md bg-[#fff7ed] px-3 py-2 text-[11px] font-semibold text-[#9a3412] ring-1 ring-[#fed7aa] dark:bg-[rgba(154,52,18,0.18)] dark:text-[#fed7aa] dark:ring-[rgba(251,146,60,0.3)]">
                      <RefreshCcw className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {isId ? 'Memperbaiki' : 'Improving'}:{' '}
                        {editingCreationDraft.title}
                      </span>
                      <button
                        type="button"
                        onClick={() => setEditingCreationDraft(null)}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
                        aria-label={
                          isId ? 'Batalkan perbaikan' : 'Cancel improvement'
                        }
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  {activeCreationFlow && !editingCreationDraft ? (
                    <div className="mb-2 flex min-w-0 items-center gap-2 rounded-md bg-[#ecfdf5] px-3 py-2 text-[11px] font-semibold text-[#047857] ring-1 ring-[#a7f3d0] dark:bg-[rgba(5,150,105,0.16)] dark:text-[#a7f3d0] dark:ring-[rgba(52,211,153,0.28)]">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      <span className="min-w-0 flex-1 truncate">
                        {isId ? 'Melengkapi' : 'Completing'}{' '}
                        {creationTargetLabel(activeCreationFlow.target, isId)}
                        {activeCreationFlow.collectedFields.length > 0
                          ? ` | ${activeCreationFlow.completeness}%`
                          : ''}
                      </span>
                      <button
                        type="button"
                        onClick={() =>
                          void sendMessage(isId ? 'batal' : 'cancel')
                        }
                        disabled={sending}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                        aria-label={
                          isId ? 'Batalkan pembuatan' : 'Cancel creation'
                        }
                        title={isId ? 'Batalkan pembuatan' : 'Cancel creation'}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  <div className="mb-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                    <button
                      type="button"
                      onClick={() => startCreation('offering_listing')}
                      disabled={sending}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#ecfdf5] px-3 text-[11px] font-bold text-[#047857] ring-1 ring-[#a7f3d0] disabled:opacity-50 dark:bg-[rgba(5,150,105,0.16)] dark:text-[#a7f3d0] dark:ring-[rgba(52,211,153,0.28)]"
                    >
                      <ShoppingBag className="h-3.5 w-3.5" />
                      {isId ? 'Buat Penawaran' : 'Create Offer'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startCreation('looking_for_listing')}
                      disabled={sending}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#eff6ff] px-3 text-[11px] font-bold text-[#1d4ed8] ring-1 ring-[#bfdbfe] disabled:opacity-50 dark:bg-[rgba(37,99,235,0.16)] dark:text-[#bfdbfe] dark:ring-[rgba(96,165,250,0.28)]"
                    >
                      <Search className="h-3.5 w-3.5" />
                      {isId ? 'Buat Kebutuhan' : 'Create Request'}
                    </button>
                    <button
                      type="button"
                      onClick={() => startCreation('business_profile')}
                      disabled={sending}
                      className="inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full bg-[#fffbeb] px-3 text-[11px] font-bold text-[#a16207] ring-1 ring-[#fde68a] disabled:opacity-50 dark:bg-[rgba(180,83,9,0.16)] dark:text-[#fde68a] dark:ring-[rgba(245,158,11,0.28)]"
                    >
                      <Building2 className="h-3.5 w-3.5" />
                      {isId ? 'Daftarkan Usaha' : 'Register Business'}
                    </button>
                  </div>
                  {selectedAgent?.quick_buttons?.length ? (
                    <div className="mb-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {selectedAgent.quick_buttons.map(button => (
                        <button
                          key={button.id}
                          type="button"
                          onClick={() =>
                            void sendMessage(button.prompt, {
                              actionInstruction: [
                                button.instructionAppend,
                                button.negativeInstruction
                                  ? `Negative instruction: ${button.negativeInstruction}`
                                  : '',
                              ]
                                .filter(Boolean)
                                .join('\n'),
                            })
                          }
                          className="inline-flex min-h-8 shrink-0 items-center rounded-full bg-white px-3 text-[11px] font-bold text-[#54656f] hover:text-[#128c7e] dark:bg-[#111b21] dark:text-[#aebac1]"
                        >
                          {button.label}
                        </button>
                      ))}
                    </div>
                  ) : null}
                  {draftAttachments.length > 0 ? (
                    <div className="mb-2 flex gap-2 overflow-x-auto rounded-[18px] bg-white/70 p-2 [scrollbar-width:none] dark:bg-[#111b21]/70 [&::-webkit-scrollbar]:hidden">
                      {draftAttachments.map(attachment => (
                        <div
                          key={attachment.id}
                          className="relative flex min-w-[156px] max-w-[210px] shrink-0 items-center gap-2 rounded-[14px] border border-black/5 bg-white px-2 py-2 text-[#111b21] shadow-sm dark:border-white/8 dark:bg-[#202c33] dark:text-[#e9edef]"
                        >
                          {attachment.kind === 'image' &&
                          attachment.previewUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={attachment.previewUrl}
                              alt={attachment.name}
                              className="h-10 w-10 shrink-0 rounded-[10px] object-cover"
                            />
                          ) : (
                            <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[10px] bg-[#e7f8ef] text-[#128c7e] dark:bg-[#123d32] dark:text-[#25d366]">
                              {attachment.kind === 'image' ? (
                                <ImageIcon className="h-4 w-4" />
                              ) : (
                                <FileText className="h-4 w-4" />
                              )}
                            </span>
                          )}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[11px] font-bold">
                              {attachment.name}
                            </span>
                            <span className="block truncate text-[10px] font-semibold text-[#667781] dark:text-[#8696a0]">
                              {attachment.kind}
                              {attachment.url ? ' / stored' : ''}
                              {attachment.dataUrl ? ' / vision' : ''}
                              {attachment.text ? ' / text' : ''}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDraftAttachment(attachment.id)}
                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[#54656f] dark:bg-[#111b21] dark:text-[#aebac1]"
                            aria-label={isId ? 'Hapus media' : 'Remove media'}
                          >
                            <X className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      ))}
                      {draftAttachments.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => clearDraftAttachments()}
                          className="inline-flex min-h-[56px] shrink-0 items-center justify-center rounded-[14px] bg-white px-3 text-[11px] font-bold text-[#54656f] shadow-sm dark:bg-[#202c33] dark:text-[#aebac1]"
                        >
                          {isId ? 'Hapus semua' : 'Clear all'}
                        </button>
                      ) : null}
                    </div>
                  ) : null}
                  <div className="flex min-w-0 items-end gap-2">
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={
                        sending || draftAttachments.length >= MAX_AI_ATTACHMENTS
                      }
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#54656f] shadow-sm transition hover:bg-[#e9edef] disabled:opacity-50 dark:bg-[#2a3942] dark:text-[#aebac1] dark:hover:bg-[#33444f]"
                      aria-label={isId ? 'Lampirkan media' : 'Attach media'}
                      title={isId ? 'Lampirkan media' : 'Attach media'}
                    >
                      <Paperclip className="h-5 w-5" />
                    </button>
                    <textarea
                      value={input}
                      onChange={event => setInput(event.target.value)}
                      onFocus={() => {
                        setComposerFocused(true);
                        requestAnimationFrame(() =>
                          scrollMessagesToBottom('auto'),
                        );
                        window.setTimeout(
                          () => scrollMessagesToBottom('auto'),
                          90,
                        );
                        window.setTimeout(
                          () => scrollMessagesToBottom('auto'),
                          280,
                        );
                      }}
                      onBlur={() => {
                        window.setTimeout(() => setComposerFocused(false), 80);
                      }}
                      placeholder={
                        activeCreationFlow
                          ? isId
                            ? 'Isi jawaban sesuai label dari AI...'
                            : 'Fill in the labels requested by the AI...'
                          : copy.placeholder
                      }
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
                      disabled={
                        sending ||
                        (!input.trim() && draftAttachments.length === 0)
                      }
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#25d366] text-[#111b21] shadow-[0_10px_24px_-16px_rgba(37,211,102,0.65)] disabled:opacity-50"
                      aria-label={copy.send}
                    >
                      {sending ? (
                        <Loader2 className="h-5 w-5 animate-spin" />
                      ) : (
                        <Send className="h-5 w-5" />
                      )}
                    </button>
                  </div>
                </div>
                {forwardingMessage ? (
                  <div
                    className="fixed inset-0 z-[120] flex items-end justify-center bg-black/45 sm:items-center sm:p-6"
                    role="dialog"
                    aria-modal="true"
                    aria-label={isId ? 'Teruskan pesan' : 'Forward message'}
                    onMouseDown={event => {
                      if (event.target === event.currentTarget && !forwarding) {
                        setForwardingMessage(null);
                      }
                    }}
                  >
                    <div className="flex max-h-[82dvh] w-full flex-col bg-white shadow-2xl dark:bg-[#202c33] sm:max-w-md sm:rounded-lg">
                      <div className="flex items-center gap-3 border-b border-black/5 px-4 py-3 dark:border-white/8">
                        <Forward className="h-4 w-4 text-[#128c7e]" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-bold">
                            {isId ? 'Teruskan pesan' : 'Forward message'}
                          </p>
                          <p className="truncate text-[11px] text-[#667781] dark:text-[#8696a0]">
                            {forwardingMessage.content}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setForwardingMessage(null)}
                          disabled={forwarding}
                          className="inline-flex h-9 w-9 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                          aria-label={isId ? 'Tutup' : 'Close'}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="min-h-0 flex-1 overflow-y-auto p-2">
                        <button
                          type="button"
                          onClick={() => void forwardMessageToNewThread()}
                          disabled={forwarding}
                          className="flex min-h-12 w-full items-center gap-3 px-3 text-left hover:bg-[#f0f2f5] disabled:opacity-50 dark:hover:bg-[#2a3942]"
                        >
                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#dcf8e8] text-[#128c7e] dark:bg-[#123d32] dark:text-[#25d366]">
                            <MessageSquarePlus className="h-4 w-4" />
                          </span>
                          <span className="text-sm font-bold">
                            {isId ? 'Tab chat baru' : 'New chat tab'}
                          </span>
                        </button>
                        {threads.map(thread => (
                          <button
                            key={thread.id}
                            type="button"
                            onClick={() =>
                              void forwardMessageToThread(thread.id)
                            }
                            disabled={forwarding}
                            className="flex min-h-12 w-full items-center gap-3 px-3 text-left hover:bg-[#f0f2f5] disabled:opacity-50 dark:hover:bg-[#2a3942]"
                          >
                            <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#e9edef] text-[#54656f] dark:bg-[#2a3942] dark:text-[#aebac1]">
                              <Bot className="h-4 w-4" />
                            </span>
                            <span className="min-w-0 flex-1">
                              <span className="block truncate text-sm font-bold">
                                {thread.title}
                              </span>
                              <span className="block text-[10px] text-[#667781] dark:text-[#8696a0]">
                                {thread.id === selectedThreadId
                                  ? isId
                                    ? 'Chat saat ini'
                                    : 'Current chat'
                                  : compactTime(thread.updated_at)}
                              </span>
                            </span>
                            {forwarding ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Forward className="h-4 w-4 text-[#8696a0]" />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}

            {activePanel !== 'chat' ? (
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                {activePanel === 'builder'
                  ? (() => {
                      const config =
                        draft.builder_config ||
                        createDefaultPersonalAiBuilderConfig();
                      const selectedStep =
                        config.steps.find(
                          step => step.id === selectedBuilderStepId,
                        ) || config.steps[0];
                      return (
                        <div className="mx-auto grid max-w-5xl gap-4">
                          {!canEditSelected ? (
                            <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                              {isId
                                ? 'Builder hanya bisa diedit pemilik AI.'
                                : 'Only the AI owner can edit the builder.'}
                            </div>
                          ) : null}

                          <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold">
                                  {isId
                                    ? 'AI Studio Builder'
                                    : 'AI Studio Builder'}
                                </p>
                                <p className="mt-1 max-w-2xl text-xs leading-5 text-[color:var(--app-text-soft)]">
                                  {isId
                                    ? 'Pilih tool siap pakai, lalu sesuaikan bahan baku, instruksi tersembunyi, upload gambar, model target, dan output yang ingin dihasilkan.'
                                    : 'Pick a ready-to-use tool, then adjust the source material, hidden instructions, image upload, target model, and desired output.'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void saveSettings()}
                                disabled={!canEditSelected || saving}
                                className="inline-flex min-h-9 items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white disabled:opacity-50"
                              >
                                {saving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                                {copy.save}
                              </button>
                            </div>

                            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                              {PERSONAL_AI_BUILDER_TEMPLATES.map(template => (
                                <button
                                  key={template.id}
                                  type="button"
                                  disabled={!canEditSelected}
                                  onClick={() =>
                                    applyBuilderTemplate(template.id)
                                  }
                                  className={cn(
                                    'rounded-[16px] border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-[0_16px_30px_-26px_rgba(15,23,42,0.35)] disabled:cursor-not-allowed disabled:opacity-60',
                                    config.templateId === template.id
                                      ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
                                      : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)]',
                                  )}
                                >
                                  <span className="text-xs font-bold text-[color:var(--app-text)]">
                                    {template.name}
                                  </span>
                                  <span className="mt-1 block text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                    {template.description}
                                  </span>
                                </button>
                              ))}
                            </div>
                          </section>

                          <div className="grid gap-4 lg:grid-cols-[240px_minmax(0,1fr)_280px]">
                            <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                                  Steps
                                </p>
                                <button
                                  type="button"
                                  disabled={!canEditSelected}
                                  onClick={addBuilderStep}
                                  className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] disabled:opacity-50"
                                  aria-label={isId ? 'Tambah step' : 'Add step'}
                                >
                                  <Plus className="h-4 w-4" />
                                </button>
                              </div>
                              <div className="grid gap-2">
                                {config.steps.map((step, index) => (
                                  <button
                                    key={step.id}
                                    type="button"
                                    onClick={() =>
                                      setSelectedBuilderStepId(step.id)
                                    }
                                    className={cn(
                                      'rounded-[14px] px-3 py-2 text-left text-xs transition',
                                      selectedStep?.id === step.id
                                        ? 'bg-[color:var(--app-text)] text-[color:var(--app-surface-strong)]'
                                        : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]',
                                    )}
                                  >
                                    <span className="block font-bold">
                                      {index + 1}. {step.title}
                                    </span>
                                    {step.description ? (
                                      <span className="mt-0.5 line-clamp-2 block text-[10px] opacity-70">
                                        {step.description}
                                      </span>
                                    ) : null}
                                  </button>
                                ))}
                              </div>
                            </section>

                            <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
                              <div className="grid gap-3 sm:grid-cols-2">
                                <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                                  Nama mini-app
                                  <input
                                    value={config.branding.name}
                                    disabled={!canEditSelected}
                                    onChange={event =>
                                      updateBuilderConfig(current => ({
                                        ...current,
                                        branding: {
                                          ...current.branding,
                                          name: event.target.value,
                                        },
                                      }))
                                    }
                                    className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                                  />
                                </label>
                                <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                                  Kategori
                                  <input
                                    value={config.branding.category || ''}
                                    disabled={!canEditSelected}
                                    onChange={event =>
                                      updateBuilderConfig(current => ({
                                        ...current,
                                        branding: {
                                          ...current.branding,
                                          category: event.target.value,
                                        },
                                      }))
                                    }
                                    className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                                  />
                                </label>
                              </div>
                              <label className="mt-3 grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                                Deskripsi mini-app
                                <textarea
                                  value={config.branding.shortDescription}
                                  disabled={!canEditSelected}
                                  rows={2}
                                  onChange={event =>
                                    updateBuilderConfig(current => ({
                                      ...current,
                                      branding: {
                                        ...current.branding,
                                        shortDescription: event.target.value,
                                      },
                                    }))
                                  }
                                  className="resize-y rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm leading-6 text-[color:var(--app-text)]"
                                />
                              </label>
                              <label className="mt-3 grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                                Base instruction
                                <textarea
                                  value={config.instructions.baseInstruction}
                                  disabled={!canEditSelected}
                                  rows={4}
                                  onChange={event =>
                                    updateBuilderConfig(current => ({
                                      ...current,
                                      instructions: {
                                        ...current.instructions,
                                        baseInstruction: event.target.value,
                                      },
                                    }))
                                  }
                                  className="resize-y rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm leading-6 text-[color:var(--app-text)]"
                                />
                              </label>

                              {selectedStep ? (
                                <div className="mt-4 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3">
                                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                                    Canvas step
                                  </p>
                                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                    <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                                      Judul step
                                      <input
                                        value={selectedStep.title}
                                        disabled={!canEditSelected}
                                        onChange={event =>
                                          updateSelectedBuilderStep(step => ({
                                            ...step,
                                            title: event.target.value,
                                          }))
                                        }
                                        className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                                      />
                                    </label>
                                    <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                                      Deskripsi step
                                      <input
                                        value={selectedStep.description || ''}
                                        disabled={!canEditSelected}
                                        onChange={event =>
                                          updateSelectedBuilderStep(step => ({
                                            ...step,
                                            description: event.target.value,
                                          }))
                                        }
                                        className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                                      />
                                    </label>
                                  </div>
                                  <label className="mt-3 grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                                    Step instruction
                                    <textarea
                                      value={selectedStep.instruction || ''}
                                      disabled={!canEditSelected}
                                      rows={3}
                                      onChange={event =>
                                        updateSelectedBuilderStep(step => ({
                                          ...step,
                                          instruction: event.target.value,
                                        }))
                                      }
                                      className="resize-y rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm leading-6 text-[color:var(--app-text)]"
                                    />
                                  </label>
                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                                    <p className="text-xs font-bold text-[color:var(--app-text-soft)]">
                                      {isId
                                        ? 'Field di step ini'
                                        : 'Fields in this step'}
                                    </p>
                                    <button
                                      type="button"
                                      disabled={!canEditSelected}
                                      onClick={() => addBuilderBlock('text')}
                                      className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-bold text-[color:var(--app-accent)] disabled:opacity-50"
                                    >
                                      <Plus className="h-3.5 w-3.5" />
                                      {isId ? 'Tambah field' : 'Add field'}
                                    </button>
                                  </div>
                                  <div className="mt-2 grid gap-2">
                                    {selectedStep.blocks.map(block => (
                                      <div
                                        key={block.id}
                                        className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3"
                                      >
                                        <div className="flex flex-wrap items-center justify-between gap-2">
                                          <input
                                            value={block.label}
                                            disabled={!canEditSelected}
                                            onChange={event =>
                                              updateSelectedBuilderBlock(
                                                block.id,
                                                current => ({
                                                  ...current,
                                                  label: event.target.value,
                                                  variable:
                                                    current.variable ||
                                                    variableKeyFromLabel(
                                                      event.target.value,
                                                    ),
                                                }),
                                              )
                                            }
                                            className="min-w-[160px] flex-1 rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-sm font-bold text-[color:var(--app-text)]"
                                          />
                                          <div className="flex shrink-0 items-center gap-1.5">
                                            <select
                                              value={block.type}
                                              disabled={!canEditSelected}
                                              onChange={event =>
                                                updateSelectedBuilderBlock(
                                                  block.id,
                                                  current => {
                                                    const nextType = event
                                                      .target
                                                      .value as AIBuilderBlockType;
                                                    return {
                                                      ...current,
                                                      type: nextType,
                                                      options:
                                                        nextType ===
                                                          'single_choice' ||
                                                        nextType ===
                                                          'multi_choice'
                                                          ? current.options
                                                              ?.length
                                                            ? current.options
                                                            : textToOptions(
                                                                isId
                                                                  ? 'Pilihan 1\nPilihan 2'
                                                                  : 'Option 1\nOption 2',
                                                              )
                                                          : undefined,
                                                    };
                                                  },
                                                )
                                              }
                                              className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)]"
                                            >
                                              {BUILDER_BLOCK_TYPES.map(type => (
                                                <option key={type} value={type}>
                                                  {type}
                                                </option>
                                              ))}
                                            </select>
                                            <button
                                              type="button"
                                              disabled={
                                                !canEditSelected ||
                                                selectedStep.blocks.length <= 1
                                              }
                                              onClick={() =>
                                                removeBuilderBlock(block.id)
                                              }
                                              className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-rose-50 text-rose-600 disabled:opacity-40"
                                              aria-label={
                                                isId
                                                  ? 'Hapus field'
                                                  : 'Remove field'
                                              }
                                            >
                                              <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                          </div>
                                        </div>
                                        <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                          <label className="grid gap-1 text-[10px] font-bold text-[color:var(--app-text-soft)]">
                                            Variable key
                                            <input
                                              value={block.variable || ''}
                                              disabled={!canEditSelected}
                                              onChange={event =>
                                                updateSelectedBuilderBlock(
                                                  block.id,
                                                  current => ({
                                                    ...current,
                                                    variable:
                                                      variableKeyFromLabel(
                                                        event.target.value,
                                                      ),
                                                  }),
                                                )
                                              }
                                              className="rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 py-1.5 text-xs text-[color:var(--app-text)]"
                                            />
                                          </label>
                                          <label className="grid gap-1 text-[10px] font-bold text-[color:var(--app-text-soft)]">
                                            Placeholder / help
                                            <input
                                              value={
                                                block.placeholder ||
                                                block.helpText ||
                                                ''
                                              }
                                              disabled={!canEditSelected}
                                              onChange={event =>
                                                updateSelectedBuilderBlock(
                                                  block.id,
                                                  current => ({
                                                    ...current,
                                                    placeholder:
                                                      event.target.value,
                                                  }),
                                                )
                                              }
                                              className="rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 py-1.5 text-xs text-[color:var(--app-text)]"
                                            />
                                          </label>
                                        </div>
                                        <label className="mt-2 flex items-center gap-2 text-[11px] font-bold text-[color:var(--app-text-soft)]">
                                          <input
                                            type="checkbox"
                                            checked={block.required === true}
                                            disabled={!canEditSelected}
                                            onChange={event =>
                                              updateSelectedBuilderBlock(
                                                block.id,
                                                current => ({
                                                  ...current,
                                                  required:
                                                    event.target.checked,
                                                }),
                                              )
                                            }
                                          />
                                          {isId ? 'Wajib diisi' : 'Required'}
                                        </label>
                                        {block.type === 'single_choice' ||
                                        block.type === 'multi_choice' ? (
                                          <label className="mt-2 grid gap-1 text-[10px] font-bold text-[color:var(--app-text-soft)]">
                                            {isId
                                              ? 'Opsi pilihan'
                                              : 'Choice options'}
                                            <textarea
                                              value={optionsToText(block)}
                                              disabled={!canEditSelected}
                                              rows={3}
                                              onChange={event =>
                                                updateSelectedBuilderBlock(
                                                  block.id,
                                                  current => ({
                                                    ...current,
                                                    options: textToOptions(
                                                      event.target.value,
                                                    ),
                                                  }),
                                                )
                                              }
                                              className="resize-y rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 py-1.5 text-xs leading-5 text-[color:var(--app-text)]"
                                              placeholder={
                                                isId
                                                  ? 'Label :: value :: instruksi tersembunyi'
                                                  : 'Label :: value :: hidden instruction'
                                              }
                                            />
                                          </label>
                                        ) : null}
                                        {block.options?.length ? (
                                          <div className="mt-2 flex flex-wrap gap-1.5">
                                            {block.options
                                              .slice(0, 8)
                                              .map(option => (
                                                <span
                                                  key={option.id}
                                                  className="rounded-full border border-[color:var(--app-border)] px-2 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)]"
                                                >
                                                  {option.label}
                                                </span>
                                              ))}
                                          </div>
                                        ) : null}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ) : null}
                            </section>

                            <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3">
                              <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                                Quick actions
                              </p>
                              <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                {isId
                                  ? 'Format: Label :: pesan user :: instruksi tersembunyi.'
                                  : 'Format: Label :: user message :: hidden instruction.'}
                              </p>
                              <textarea
                                value={draft.quick_buttons_text}
                                disabled={!canEditSelected}
                                rows={7}
                                onChange={event =>
                                  setDraft(current => ({
                                    ...current,
                                    quick_buttons_text: event.target.value,
                                  }))
                                }
                                className="mt-2 w-full resize-y rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-xs leading-5 text-[color:var(--app-text)]"
                              />

                              <div className="mt-4 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                                    {isId ? 'Output tool' : 'Tool output'}
                                  </p>
                                  <button
                                    type="button"
                                    disabled={!canEditSelected}
                                    onClick={addOutputSection}
                                    className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] disabled:opacity-50"
                                    aria-label={
                                      isId ? 'Tambah output' : 'Add output'
                                    }
                                  >
                                    <Plus className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                                <div className="mt-2 grid gap-1.5">
                                  {config.output.sections
                                    .slice(0, 12)
                                    .map(section => (
                                      <div
                                        key={section.id}
                                        className="grid gap-2 rounded-[12px] bg-[color:var(--app-surface-muted)] p-2"
                                      >
                                        <div className="flex items-center gap-1.5">
                                          <input
                                            value={section.title}
                                            disabled={!canEditSelected}
                                            onChange={event =>
                                              updateOutputSection(
                                                section.id,
                                                current => ({
                                                  ...current,
                                                  title: event.target.value,
                                                  key:
                                                    current.key ||
                                                    variableKeyFromLabel(
                                                      event.target.value,
                                                    ),
                                                }),
                                              )
                                            }
                                            className="min-w-0 flex-1 rounded-[10px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1.5 text-[11px] font-bold text-[color:var(--app-text)]"
                                          />
                                          <button
                                            type="button"
                                            disabled={
                                              !canEditSelected ||
                                              config.output.sections.length <= 1
                                            }
                                            onClick={() =>
                                              removeOutputSection(section.id)
                                            }
                                            className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 disabled:opacity-40"
                                            aria-label={
                                              isId
                                                ? 'Hapus output'
                                                : 'Remove output'
                                            }
                                          >
                                            <Trash2 className="h-3 w-3" />
                                          </button>
                                        </div>
                                        <div className="grid gap-1 sm:grid-cols-2">
                                          <select
                                            value={section.type}
                                            disabled={!canEditSelected}
                                            onChange={event =>
                                              updateOutputSection(
                                                section.id,
                                                current => ({
                                                  ...current,
                                                  type: event.target
                                                    .value as AIOutputSection['type'],
                                                }),
                                              )
                                            }
                                            className="rounded-[10px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1.5 text-[10px] font-bold text-[color:var(--app-text-soft)]"
                                          >
                                            {OUTPUT_SECTION_TYPES.map(type => (
                                              <option key={type} value={type}>
                                                {type}
                                              </option>
                                            ))}
                                          </select>
                                          <input
                                            value={section.key}
                                            disabled={!canEditSelected}
                                            onChange={event =>
                                              updateOutputSection(
                                                section.id,
                                                current => ({
                                                  ...current,
                                                  key: variableKeyFromLabel(
                                                    event.target.value,
                                                  ),
                                                }),
                                              )
                                            }
                                            className="rounded-[10px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1.5 text-[10px] font-bold text-[color:var(--app-text-soft)]"
                                            placeholder="output_key"
                                          />
                                        </div>
                                        <textarea
                                          value={section.instruction || ''}
                                          disabled={!canEditSelected}
                                          rows={2}
                                          onChange={event =>
                                            updateOutputSection(
                                              section.id,
                                              current => ({
                                                ...current,
                                                instruction: event.target.value,
                                              }),
                                            )
                                          }
                                          className="resize-y rounded-[10px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1.5 text-[10px] leading-4 text-[color:var(--app-text)]"
                                          placeholder={
                                            isId
                                              ? 'Instruksi khusus untuk bagian output ini'
                                              : 'Instruction for this output section'
                                          }
                                        />
                                      </div>
                                    ))}
                                </div>
                                <p className="mt-2 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                                  {isId
                                    ? `Mode: ${config.modelPolicy.mode} - Target: ${config.modelPolicy.preferredModelId || 'auto'}`
                                    : `Mode: ${config.modelPolicy.mode} - Target: ${config.modelPolicy.preferredModelId || 'auto'}`}
                                </p>
                              </div>

                              <p className="mt-4 text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                                AI model registry
                              </p>
                              <div className="mt-2 grid gap-2">
                                {PERSONAL_AI_MODEL_REGISTRY.slice(0, 6).map(
                                  model => (
                                    <div
                                      key={model.id}
                                      className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-2"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="truncate text-xs font-bold">
                                          {model.name}
                                        </p>
                                        <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5 text-[9px] font-bold text-[color:var(--app-text-soft)]">
                                          {model.status}
                                        </span>
                                      </div>
                                      <p className="mt-1 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                                        {model.provider} -{' '}
                                        {model.capabilities.join(', ')}
                                      </p>
                                    </div>
                                  ),
                                )}
                              </div>
                            </section>
                          </div>
                        </div>
                      );
                    })()
                  : null}

                {activePanel === 'settings' ? (
                  <div className="mx-auto grid max-w-3xl gap-3">
                    {!canEditSelected ? (
                      <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                        {isId
                          ? 'AI ini dibagikan. Setting hanya bisa diedit pemilik.'
                          : 'This AI is shared. Only the owner can edit settings.'}
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                        Nama AI
                        <input
                          value={draft.name}
                          disabled={!canEditSelected}
                          onChange={event =>
                            setDraft(current => ({
                              ...current,
                              name: event.target.value,
                            }))
                          }
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
                              model_preference: event.target
                                .value as SettingsDraft['model_preference'],
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
                        onChange={event =>
                          setDraft(current => ({
                            ...current,
                            description: event.target.value,
                          }))
                        }
                        className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm text-[color:var(--app-text)]"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                      Instruksi
                      <textarea
                        value={draft.instructions}
                        disabled={!canEditSelected}
                        rows={8}
                        onChange={event =>
                          setDraft(current => ({
                            ...current,
                            instructions: event.target.value,
                          }))
                        }
                        className="resize-y rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm leading-6 text-[color:var(--app-text)]"
                      />
                    </label>
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                        Gaya jawaban
                        <input
                          value={draft.tone}
                          disabled={!canEditSelected}
                          onChange={event =>
                            setDraft(current => ({
                              ...current,
                              tone: event.target.value,
                            }))
                          }
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
                        onChange={event =>
                          setDraft(current => ({
                            ...current,
                            quick_buttons_text: event.target.value,
                          }))
                        }
                        className="resize-y rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2 text-sm leading-6 text-[color:var(--app-text)]"
                      />
                    </label>
                    <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                      Starter prompts
                      <textarea
                        value={draft.starter_prompts_text}
                        disabled={!canEditSelected}
                        rows={4}
                        onChange={event =>
                          setDraft(current => ({
                            ...current,
                            starter_prompts_text: event.target.value,
                          }))
                        }
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
                        {(['private', 'unlisted', 'public'] as const).map(
                          value => (
                            <button
                              key={value}
                              type="button"
                              disabled={!canEditSelected}
                              onClick={() =>
                                setDraft(current => ({
                                  ...current,
                                  visibility: value,
                                }))
                              }
                              className={cn(
                                'rounded-full px-3 py-1 text-[11px] font-bold',
                                draft.visibility === value
                                  ? 'bg-[color:var(--app-accent)] text-white'
                                  : 'text-[color:var(--app-text-soft)]',
                              )}
                            >
                              {visibilityLabel(value, isId)}
                            </button>
                          ),
                        )}
                      </div>
                    </div>
                    <p className="text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Private hanya pemilik. Unlisted bisa dibuka lewat link. Public disiapkan untuk tampil di profil/pencarian AI Tools Lajukan.'
                        : 'Private is owner-only. Unlisted opens by link. Public is ready for profile and Explore discovery.'}
                    </p>
                    {canEditSelected ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void saveSettings()}
                          disabled={saving}
                          className="inline-flex min-h-10 items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-sm font-bold text-white disabled:opacity-60"
                        >
                          {saving ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Save className="h-4 w-4" />
                          )}
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
                      <p className="text-sm font-bold">
                        {visibilityLabel(selectedAgent?.visibility, isId)}
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {normalizeUiVisibility(
                          selectedAgent?.visibility || 'private',
                        ) === 'private'
                          ? isId
                            ? 'AI ini masih private dan tidak bisa dibuka orang lain.'
                            : 'This AI is private and cannot be opened by others.'
                          : normalizeUiVisibility(
                                selectedAgent?.visibility || 'private',
                              ) === 'public'
                            ? isId
                              ? 'AI ini public. Link bisa dibagikan, dan siap ditampilkan di AI Tools publik Lajukan.'
                              : 'This AI is public. The link can be shared and it is ready for public AI Tools discovery.'
                            : isId
                              ? 'AI ini unlisted. Orang lain hanya bisa membuka lewat link.'
                              : 'This AI is unlisted. Others can open it only with the link.'}
                      </p>
                      <div className="mt-3 flex gap-2">
                        <input
                          readOnly
                          value={
                            normalizeUiVisibility(
                              selectedAgent?.visibility || 'private',
                            ) !== 'private'
                              ? shareUrl
                              : ''
                          }
                          className="min-w-0 flex-1 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => void copyShareLink()}
                          disabled={
                            normalizeUiVisibility(
                              selectedAgent?.visibility || 'private',
                            ) === 'private'
                          }
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
                <p className="text-sm font-bold">
                  {selectedAgent?.name || copy.title}
                </p>
                {normalizeUiVisibility(
                  selectedAgent?.visibility || 'private',
                ) !== 'private' ? (
                  <Users className="h-4 w-4 text-[color:var(--app-accent)]" />
                ) : (
                  <Lock className="h-4 w-4 text-[color:var(--app-text-soft)]" />
                )}
              </div>
              <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                {selectedAgent?.description ||
                  selectedAgent?.instructions ||
                  copy.noAgent}
              </p>
              <p className="mt-2 inline-flex rounded-full bg-[color:var(--app-surface-muted)] px-2 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)]">
                {visibilityLabel(selectedAgent?.visibility, isId)}
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
                <button
                  type="button"
                  onClick={() => setNotice('')}
                  className="ml-auto"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {error ? (
              <div className="mt-3 flex items-center gap-2 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                {error}
                <button
                  type="button"
                  onClick={() => setError('')}
                  className="ml-auto"
                >
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
