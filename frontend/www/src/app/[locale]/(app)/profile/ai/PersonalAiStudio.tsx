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
  Mic,
  MoreVertical,
  Paperclip,
  Pause,
  Play,
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
import { useDialog } from '@/components/system/feedback/DialogProvider';
import { useVoiceNoteRecorder } from '@/hooks/useVoiceNoteRecorder';
import { formatVoiceNoteDuration } from '@/lib/media/voiceNote';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
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
  createDefaultPersonalAiBuilderConfig,
  type AIBuilderBlock,
  type AIBuilderBlockType,
  type AIOutputSection,
  type PersonalAiBuilderConfig,
  type AIBuilderStep,
} from '@/lib/personal-ai/builder';
import {
  clearPersonalAiCache,
  loadPersonalAiAgentsCache,
  loadPersonalAiMessagesCache,
  loadPersonalAiThreadsCache,
  savePersonalAiAgentsCache,
  savePersonalAiMessagesCache,
  savePersonalAiThreadsCache,
  type CachedPersonalAiAgent,
} from '@/lib/personal-ai/browserCache';

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
  cache_only?: boolean;
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

type ViewerMemoryState = {
  enabled: boolean;
  can_manage_recipient_consent: boolean;
  memory: {
    summary: string;
    facts: {
      topics?: string[];
      user_terms?: string[];
      last_messages?: string[];
    };
    updated_at: string;
  } | null;
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

type PersonalAiComposerDraft = {
  input: string;
  attachments: AiDraftAttachment[];
  replyingTo: ChatMessage | null;
  editingCreationDraft: AICreationDraft | null;
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
  temperature: 0.4,
  memory_enabled: false,
  builder_config: createDefaultPersonalAiBuilderConfig(),
  quick_buttons_text: '',
  starter_prompts_text: '',
};

const MAX_AI_ATTACHMENTS = 4;
const MAX_INLINE_IMAGE_BYTES = 1_600_000;
const MAX_TEXT_FILE_BYTES = 90_000;
const PERSONAL_AI_CHAT_TIMEOUT_MS = 120_000;
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
  if (normalized === 'public') return isId ? 'Publik' : 'Public';
  if (normalized === 'unlisted')
    return isId ? 'Siapa pun dengan tautan' : 'Anyone with the link';
  return isId ? 'Hanya saya' : 'Only me';
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
        if (kind === 'audio' && item.url) {
          return (
            <div
              key={key}
              className="min-w-[220px] rounded-[14px] bg-black/6 p-2 dark:bg-white/10"
            >
              <audio
                src={item.url}
                controls
                preload="metadata"
                className="h-10 w-full"
                aria-label={label}
              />
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="mt-1 flex min-w-0 items-center gap-2 text-[11px] font-semibold"
              >
                <FileText className="h-3.5 w-3.5 shrink-0" />
                <span className="min-w-0 flex-1 truncate">{label}</span>
                <span className="shrink-0 opacity-70">
                  {formatBytes(item.size)}
                </span>
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

function compactMessageTime(input: string, isId: boolean) {
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleTimeString(isId ? 'id-ID' : 'en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function createPersonalAiClientRef() {
  const random = globalThis.crypto?.randomUUID?.();
  return random
    ? `profile-ai:${random}`
    : `profile-ai:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
}

function voiceRecorderErrorMessage(error: string | null, isId: boolean) {
  if (!error) return '';
  if (error === 'permission-denied') {
    return isId
      ? 'Izin mikrofon ditolak. Izinkan mikrofon di pengaturan browser lalu coba lagi.'
      : 'Microphone permission was denied. Allow it in browser settings and try again.';
  }
  if (error === 'microphone-not-found') {
    return isId ? 'Mikrofon tidak ditemukan.' : 'No microphone was found.';
  }
  if (error === 'microphone-busy') {
    return isId
      ? 'Mikrofon sedang dipakai aplikasi lain.'
      : 'The microphone is being used by another app.';
  }
  if (error === 'too-large') {
    return isId
      ? 'Rekaman terlalu besar. Coba rekam lebih singkat.'
      : 'The recording is too large. Try a shorter recording.';
  }
  if (error === 'insecure-context') {
    return isId
      ? 'Perekaman suara hanya tersedia melalui koneksi HTTPS yang aman.'
      : 'Voice recording is only available over a secure HTTPS connection.';
  }
  return isId
    ? 'Perekaman suara belum didukung atau gagal dimulai di perangkat ini.'
    : 'Voice recording is unavailable or could not start on this device.';
}

function creationTargetLabel(target: SupportedCreationTarget, isId: boolean) {
  if (target === 'offering_listing') return isId ? 'penawaran' : 'offer';
  if (target === 'looking_for_listing') return isId ? 'kebutuhan' : 'request';
  return isId ? 'profil usaha' : 'business profile';
}

function personalAgentFromCache(agent: CachedPersonalAiAgent): PersonalAgent {
  return {
    id: agent.id,
    owner_id: '',
    name: agent.name,
    description: agent.description,
    visibility: agent.visibility,
    instructions: '',
    tone: DEFAULT_DRAFT.tone,
    model_preference: 'auto',
    temperature: DEFAULT_DRAFT.temperature,
    quick_buttons: [],
    starter_prompts: agent.starter_prompts,
    builder_config: createDefaultPersonalAiBuilderConfig(),
    memory_enabled: false,
    share_id: '',
    usage_count: agent.usage_count,
    can_edit: agent.can_edit,
    cache_only: true,
  };
}

export default function PersonalAiStudio() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const locale = getLocaleFromPath(pathname);
  const isId = locale === 'id';
  const { user, authFetch, loading: authLoading } = useAuth();
  const { confirm } = useDialog();
  const voiceRecorder = useVoiceNoteRecorder();
  const cancelVoiceRecording = voiceRecorder.cancel;
  const messagesViewportRef = useRef<HTMLDivElement | null>(null);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const mobileToolsTriggerRef = useRef<HTMLButtonElement | null>(null);
  const mobileToolsMenuRef = useRef<HTMLDivElement | null>(null);
  const draftAttachmentsRef = useRef<AiDraftAttachment[]>([]);
  const loadAgentsRequestRef = useRef(0);
  const loadThreadsRequestRef = useRef(0);
  const loadMessagesRequestRef = useRef(0);
  const agentsRef = useRef<PersonalAgent[]>([]);
  const threadsRef = useRef<ChatThread[]>([]);
  const messagesRef = useRef<ChatMessage[]>([]);
  const selectedAgentIdRef = useRef('');
  const selectedThreadIdRef = useRef('');
  const agentsLoadContextRef = useRef('');
  const threadsLoadContextRef = useRef('');
  const messagesLoadContextRef = useRef('');
  const threadsViewAgentIdRef = useRef('');
  const messagesViewThreadIdRef = useRef('');
  const previousUserIdRef = useRef('');
  const voiceDraftContextRef = useRef('');
  const inputRef = useRef('');
  const replyingToRef = useRef<ChatMessage | null>(null);
  const editingCreationDraftRef = useRef<AICreationDraft | null>(null);
  const composerDraftContextRef = useRef('');
  const composerDraftsRef = useRef<Map<string, PersonalAiComposerDraft>>(
    new Map(),
  );
  const createAgentInFlightRef = useRef(false);
  const createThreadInFlightRef = useRef(false);
  const sendInFlightRef = useRef(false);
  const attachmentsInFlightRef = useRef(false);
  const sendRetryRef = useRef<{
    fingerprint: string;
    clientRef: string;
  } | null>(null);
  const viewerMemoryRequestRef = useRef(0);

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
  const [quickActionsOpen, setQuickActionsOpen] = useState(false);
  const [selectedBuilderStepId, setSelectedBuilderStepId] = useState('');
  const [loadingAgents, setLoadingAgents] = useState(true);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sending, setSending] = useState(false);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const [deletingThreadId, setDeletingThreadId] = useState('');
  const [attaching, setAttaching] = useState(false);
  const [transcribingVoice, setTranscribingVoice] = useState(false);
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
  const [openMessageMenuId, setOpenMessageMenuId] = useState('');
  const [forwardingMessage, setForwardingMessage] =
    useState<ChatMessage | null>(null);
  const [forwarding, setForwarding] = useState(false);
  const forwardDialogRef = useRef<HTMLDivElement | null>(null);
  const forwardingRef = useRef(false);
  forwardingRef.current = forwarding;
  const [viewerMemory, setViewerMemory] = useState<ViewerMemoryState>({
    enabled: false,
    can_manage_recipient_consent: false,
    memory: null,
  });
  const [loadingViewerMemory, setLoadingViewerMemory] = useState(false);
  const [savingViewerMemory, setSavingViewerMemory] = useState(false);
  const [savingShare, setSavingShare] = useState(false);

  useEffect(() => {
    draftAttachmentsRef.current = draftAttachments;
  }, [draftAttachments]);

  useEffect(() => {
    inputRef.current = input;
  }, [input]);

  useEffect(() => {
    replyingToRef.current = replyingTo;
  }, [replyingTo]);

  useEffect(() => {
    editingCreationDraftRef.current = editingCreationDraft;
  }, [editingCreationDraft]);

  useEffect(() => {
    agentsRef.current = agents;
  }, [agents]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    if (authLoading) return;
    const previousUserId = previousUserIdRef.current;
    const nextUserId = user?.id || '';
    if (previousUserId && previousUserId !== nextUserId) {
      void clearPersonalAiCache(previousUserId);
    }
    previousUserIdRef.current = nextUserId;
  }, [authLoading, user?.id]);

  useEffect(() => {
    if (!openMessageMenuId) return;
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (
        target instanceof Element &&
        target.closest('[data-personal-ai-message-actions]')
      ) {
        return;
      }
      setOpenMessageMenuId('');
    };
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenMessageMenuId('');
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', closeOnEscape);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [openMessageMenuId]);

  useEffect(() => {
    if (!mobileToolsOpen) return;
    const menu = mobileToolsMenuRef.current;
    const focusFirst = window.requestAnimationFrame(() => {
      menu
        ?.querySelector<HTMLElement>('[role="menuitemradio"]')
        ?.focus({ preventScroll: true });
    });
    const closeOutside = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (
        mobileToolsMenuRef.current?.contains(target) ||
        mobileToolsTriggerRef.current?.contains(target)
      )
        return;
      setMobileToolsOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        setMobileToolsOpen(false);
        mobileToolsTriggerRef.current?.focus({ preventScroll: true });
        return;
      }
      if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
      const items = Array.from(
        mobileToolsMenuRef.current?.querySelectorAll<HTMLElement>(
          '[role="menuitemradio"]',
        ) || [],
      );
      if (items.length === 0) return;
      event.preventDefault();
      const currentIndex = items.indexOf(document.activeElement as HTMLElement);
      const offset = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex =
        (Math.max(currentIndex, 0) + offset + items.length) % items.length;
      items[nextIndex]?.focus({ preventScroll: true });
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusFirst);
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [mobileToolsOpen]);

  useEffect(() => {
    if (!forwardingMessage) return;
    const previouslyFocused =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const focusInitialControl = window.requestAnimationFrame(() => {
      const dialog = forwardDialogRef.current;
      const initial = dialog?.querySelector<HTMLElement>(
        '[data-forward-initial-focus]',
      );
      (initial || dialog)?.focus({ preventScroll: true });
    });
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !forwardingRef.current) {
        event.preventDefault();
        setForwardingMessage(null);
        return;
      }
      if (event.key !== 'Tab') return;
      const dialog = forwardDialogRef.current;
      if (!dialog) return;
      const controls = Array.from(
        dialog.querySelectorAll<HTMLElement>(
          'button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter(control => control.getClientRects().length > 0);
      if (controls.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      window.cancelAnimationFrame(focusInitialControl);
      document.removeEventListener('keydown', handleKeyDown);
      previouslyFocused?.focus({ preventScroll: true });
    };
  }, [forwardingMessage]);

  useEffect(() => {
    selectedAgentIdRef.current = selectedAgentId;
  }, [selectedAgentId]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    const nextContext = `${selectedAgentId}:${selectedThreadId}`;
    if (
      voiceDraftContextRef.current &&
      voiceDraftContextRef.current !== nextContext
    ) {
      cancelVoiceRecording();
    }
    voiceDraftContextRef.current = nextContext;
  }, [cancelVoiceRecording, selectedAgentId, selectedThreadId]);

  useEffect(
    () => () => {
      const attachments = new Map<string, AiDraftAttachment>();
      draftAttachmentsRef.current.forEach(attachment =>
        attachments.set(attachment.id, attachment),
      );
      composerDraftsRef.current.forEach(draft => {
        draft.attachments.forEach(attachment =>
          attachments.set(attachment.id, attachment),
        );
      });
      attachments.forEach(revokeAttachmentPreview);
      composerDraftsRef.current.clear();
    },
    [],
  );

  useEffect(() => {
    const nextContext = `${selectedAgentId || 'none'}:${
      selectedThreadId || 'new'
    }`;
    const previousContext = composerDraftContextRef.current;
    if (previousContext === nextContext) return;

    if (previousContext) {
      composerDraftsRef.current.delete(previousContext);
      composerDraftsRef.current.set(previousContext, {
        input: inputRef.current,
        attachments: draftAttachmentsRef.current,
        replyingTo: replyingToRef.current,
        editingCreationDraft: editingCreationDraftRef.current,
      });

      while (composerDraftsRef.current.size > 32) {
        const oldestKey = composerDraftsRef.current.keys().next().value;
        if (typeof oldestKey !== 'string') break;
        const oldestDraft = composerDraftsRef.current.get(oldestKey);
        oldestDraft?.attachments.forEach(revokeAttachmentPreview);
        composerDraftsRef.current.delete(oldestKey);
      }
    }

    const restored = composerDraftsRef.current.get(nextContext);
    const nextInput = restored?.input || '';
    const nextAttachments = restored?.attachments || [];
    const nextReply = restored?.replyingTo || null;
    const nextEditingDraft = restored?.editingCreationDraft || null;
    inputRef.current = nextInput;
    draftAttachmentsRef.current = nextAttachments;
    replyingToRef.current = nextReply;
    editingCreationDraftRef.current = nextEditingDraft;
    setInput(nextInput);
    setDraftAttachments(nextAttachments);
    setReplyingTo(nextReply);
    setEditingCreationDraft(nextEditingDraft);
    setQuickActionsOpen(false);
    setOpenMessageMenuId('');
    setReactionMessageId('');
    composerDraftContextRef.current = nextContext;
  }, [selectedAgentId, selectedThreadId]);

  const shareId = searchParams.get('share') || '';

  const replaceAgents = useCallback(
    (nextAgents: PersonalAgent[], persist = true) => {
      agentsRef.current = nextAgents;
      setAgents(nextAgents);
      if (persist && user?.id) {
        void savePersonalAiAgentsCache(
          user.id,
          nextAgents.filter(agent => agent.can_edit && !agent.cache_only),
        );
      }
    },
    [user?.id],
  );

  const replaceThreads = useCallback(
    (agentId: string, nextThreads: ChatThread[], persist = true) => {
      threadsViewAgentIdRef.current = agentId;
      threadsRef.current = nextThreads;
      setThreads(nextThreads);
      if (persist && user?.id && agentId) {
        void savePersonalAiThreadsCache(user.id, agentId, nextThreads);
      }
    },
    [user?.id],
  );

  const replaceMessages = useCallback(
    (threadId: string, nextMessages: ChatMessage[], persist = true) => {
      messagesViewThreadIdRef.current = threadId;
      messagesRef.current = nextMessages;
      setMessages(nextMessages);
      if (persist && user?.id && threadId) {
        void savePersonalAiMessagesCache(user.id, threadId, nextMessages);
      }
    },
    [user?.id],
  );

  const selectedAgent =
    agents.find(agent => agent.id === selectedAgentId) || null;
  const canEditSelected = Boolean(
    selectedAgent?.can_edit && !selectedAgent.cache_only,
  );

  const copy = useMemo(
    () =>
      isId
        ? {
            title: 'Asisten AI Lajukan',
            newAi: 'Asisten baru',
            newTab: 'Chat baru',
            settings: 'Pengaturan',
            builder: 'Cara kerja',
            share: 'Bagikan',
            memory: 'Ingatan',
            private: 'Hanya saya',
            shared: 'Dengan tautan',
            public: 'Publik',
            save: 'Simpan',
            send: 'Kirim',
            placeholder:
              'Tanya apa pun tentang usaha, supplier, modal, risiko, atau langkah berikutnya...',
            empty: 'Apa yang ingin dibantu hari ini?',
            noAgent: 'Asisten AI belum siap.',
            copied: 'Link disalin',
            saved: 'Pengaturan tersimpan',
            createFailed: 'Gagal membuat AI.',
            saveFailed: 'Gagal menyimpan pengaturan.',
            sendFailed: 'Gagal mengirim pesan.',
            delete: 'Hapus',
            back: 'Profil',
          }
        : {
            title: 'Lajukan AI Assistant',
            newAi: 'New assistant',
            newTab: 'New chat',
            settings: 'Settings',
            builder: 'How it works',
            share: 'Share',
            memory: 'What it remembers',
            private: 'Private',
            shared: 'Unlisted',
            public: 'Public',
            save: 'Save',
            send: 'Send',
            placeholder:
              'Ask about business ideas, suppliers, capital, risk, or next steps...',
            empty: 'What can I help you with today?',
            noAgent: 'The AI assistant is not ready.',
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

  const suggestedPrompts = useMemo(() => {
    const configured = selectedAgent?.starter_prompts
      ?.map(prompt => prompt.trim())
      .filter(Boolean)
      .slice(0, 3);
    if (configured?.length) return configured;
    return isId
      ? [
          'Bantu buat deskripsi usaha saya',
          'Buat balasan ramah untuk pelanggan',
          'Apa langkah usaha saya berikutnya?',
        ]
      : [
          'Help me describe my business',
          'Write a friendly customer reply',
          'What should I do next for my business?',
        ];
  }, [isId, selectedAgent?.starter_prompts]);

  const shareUrl = useMemo(() => {
    if (!selectedAgent || typeof window === 'undefined') return '';
    return `${window.location.origin}/${locale}/profile/ai?share=${encodeURIComponent(
      selectedAgent.share_id,
    )}`;
  }, [locale, selectedAgent]);

  useEffect(() => {
    const requestId = ++viewerMemoryRequestRef.current;
    const agent = selectedAgent;
    if (
      activePanel !== 'memory' ||
      !agent ||
      agent.can_edit ||
      agent.cache_only
    ) {
      setLoadingViewerMemory(false);
      setViewerMemory({
        enabled: false,
        can_manage_recipient_consent: false,
        memory: null,
      });
      return;
    }

    const controller = new AbortController();
    const agentId = agent.id;
    const shareId = agent.share_id;
    setLoadingViewerMemory(true);

    void (async () => {
      try {
        const response = await authFetch(
          `/api/ai/personal/agents/${encodeURIComponent(agentId)}/memory?share_id=${encodeURIComponent(shareId)}`,
          { cache: 'no-store', signal: controller.signal },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          data?: ViewerMemoryState;
          error?: string;
        };
        if (
          !response.ok ||
          !payload.data ||
          payload.data.can_manage_recipient_consent !== true
        ) {
          throw new Error(payload.error || 'Memory unavailable.');
        }
        if (
          controller.signal.aborted ||
          requestId !== viewerMemoryRequestRef.current ||
          selectedAgentIdRef.current !== agentId
        ) {
          return;
        }
        setViewerMemory(payload.data);
      } catch (memoryError) {
        if (
          controller.signal.aborted ||
          (memoryError instanceof Error && memoryError.name === 'AbortError') ||
          requestId !== viewerMemoryRequestRef.current
        ) {
          return;
        }
        setViewerMemory({
          enabled: false,
          can_manage_recipient_consent: false,
          memory: null,
        });
        setError(
          isId
            ? 'Pengaturan ingatan belum dapat dimuat.'
            : 'Memory settings could not be loaded.',
        );
      } finally {
        if (
          !controller.signal.aborted &&
          requestId === viewerMemoryRequestRef.current
        ) {
          setLoadingViewerMemory(false);
        }
      }
    })();

    return () => controller.abort();
  }, [activePanel, authFetch, isId, selectedAgent]);

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
      const resolvedBehavior =
        typeof window !== 'undefined' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : behavior;
      const viewport = messagesViewportRef.current;
      if (viewport) {
        viewport.scrollTo({
          top: viewport.scrollHeight,
          behavior: resolvedBehavior,
        });
        return;
      }

      messagesEndRef.current?.scrollIntoView({
        behavior: resolvedBehavior,
        block: 'end',
      });
    },
    [],
  );

  const loadAgents = useCallback(async () => {
    if (!user?.id) return;
    const contextKey = `${user.id}:${shareId || 'owned'}`;
    if (agentsLoadContextRef.current === contextKey) return;
    agentsLoadContextRef.current = contextKey;
    const requestId = ++loadAgentsRequestRef.current;
    loadThreadsRequestRef.current += 1;
    loadMessagesRequestRef.current += 1;
    threadsLoadContextRef.current = '';
    messagesLoadContextRef.current = '';
    selectedAgentIdRef.current = '';
    selectedThreadIdRef.current = '';
    setLoadingAgents(true);
    setError('');
    replaceAgents([], false);
    replaceThreads('', [], false);
    replaceMessages('', [], false);
    setSelectedAgentId('');
    setSelectedThreadId('');
    setCreationDrafts({});
    try {
      if (!shareId) {
        const cached = await loadPersonalAiAgentsCache(user.id);
        if (
          requestId !== loadAgentsRequestRef.current ||
          agentsLoadContextRef.current !== contextKey
        ) {
          return;
        }
        if (cached) {
          const cachedAgents = cached.data.map(personalAgentFromCache);
          replaceAgents(cachedAgents, false);
          const cachedSelectedId = cachedAgents[0]?.id || '';
          selectedAgentIdRef.current = cachedSelectedId;
          setSelectedAgentId(cachedSelectedId);
        }
      }

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
      if (
        requestId !== loadAgentsRequestRef.current ||
        agentsLoadContextRef.current !== contextKey
      ) {
        return;
      }
      const nextAgents = [...(payload.data.agents || [])];
      if (
        payload.data.shared_agent &&
        !nextAgents.some(agent => agent.id === payload.data?.shared_agent?.id)
      ) {
        nextAgents.unshift(payload.data.shared_agent);
      }
      replaceAgents(nextAgents);
      const currentAgentId = selectedAgentIdRef.current;
      const nextSelectedAgentId =
        payload.data.shared_agent?.id ||
        nextAgents.find(agent => agent.id === currentAgentId)?.id ||
        nextAgents[0]?.id ||
        '';
      selectedAgentIdRef.current = nextSelectedAgentId;
      setSelectedAgentId(nextSelectedAgentId);
    } catch (err) {
      if (
        requestId === loadAgentsRequestRef.current &&
        agentsLoadContextRef.current === contextKey
      ) {
        agentsLoadContextRef.current = '';
        setError(err instanceof Error ? err.message : copy.noAgent);
      }
    } finally {
      if (requestId === loadAgentsRequestRef.current) {
        setLoadingAgents(false);
      }
    }
  }, [
    authFetch,
    copy.noAgent,
    replaceAgents,
    replaceMessages,
    replaceThreads,
    shareId,
    user?.id,
  ]);

  const loadThreads = useCallback(
    async (agentId: string) => {
      if (!agentId || !user?.id) return;
      const contextKey = `${user.id}:${agentId}`;
      if (threadsLoadContextRef.current === contextKey) return;
      threadsLoadContextRef.current = contextKey;
      const requestId = ++loadThreadsRequestRef.current;
      loadMessagesRequestRef.current += 1;
      messagesLoadContextRef.current = '';
      selectedThreadIdRef.current = '';
      setLoadingThreads(true);
      setLoadingMessages(false);
      replaceThreads(agentId, [], false);
      replaceMessages('', [], false);
      setSelectedThreadId('');
      setCreationDrafts({});
      try {
        const cached = await loadPersonalAiThreadsCache(user.id, agentId);
        if (
          requestId !== loadThreadsRequestRef.current ||
          selectedAgentIdRef.current !== agentId
        ) {
          return;
        }
        if (cached) {
          const cachedThreads = cached.data as ChatThread[];
          replaceThreads(agentId, cachedThreads, false);
          const cachedThreadId = cachedThreads[0]?.id || '';
          selectedThreadIdRef.current = cachedThreadId;
          setSelectedThreadId(cachedThreadId);
        }

        const res = await authFetch(
          `/api/ai/personal/threads?agent_id=${encodeURIComponent(agentId)}`,
          { cache: 'no-store' },
        );
        const payload = (await res.json().catch(() => ({}))) as {
          data?: { threads?: ChatThread[] };
          error?: string;
        };
        if (!res.ok || !payload.data) {
          throw new Error(
            payload.error ||
              (isId
                ? 'Daftar chat belum dapat dimuat.'
                : 'The chat list could not be loaded.'),
          );
        }
        if (
          requestId !== loadThreadsRequestRef.current ||
          selectedAgentIdRef.current !== agentId
        )
          return;
        const nextThreads = payload.data?.threads || [];
        replaceThreads(agentId, nextThreads);
        const currentThreadId = selectedThreadIdRef.current;
        const nextThreadId =
          nextThreads.find(thread => thread.id === currentThreadId)?.id ||
          nextThreads[0]?.id ||
          '';
        selectedThreadIdRef.current = nextThreadId;
        setSelectedThreadId(nextThreadId);
        if (!nextThreadId) {
          messagesLoadContextRef.current = '';
          replaceMessages('', [], false);
          setCreationDrafts({});
        }
      } catch (loadError) {
        if (
          requestId === loadThreadsRequestRef.current &&
          selectedAgentIdRef.current === agentId
        ) {
          threadsLoadContextRef.current = '';
          setError(
            loadError instanceof Error
              ? loadError.message
              : isId
                ? 'Daftar chat belum dapat dimuat.'
                : 'The chat list could not be loaded.',
          );
        }
      } finally {
        if (requestId === loadThreadsRequestRef.current) {
          setLoadingThreads(false);
        }
      }
    },
    [authFetch, isId, replaceMessages, replaceThreads, user?.id],
  );

  const loadThreadMessages = useCallback(
    async (threadId: string) => {
      if (!threadId || !user?.id) return;
      const contextKey = `${user.id}:${threadId}`;
      if (messagesLoadContextRef.current === contextKey) return;
      messagesLoadContextRef.current = contextKey;
      const requestId = ++loadMessagesRequestRef.current;
      setLoadingMessages(true);
      setError('');
      replaceMessages(threadId, [], false);
      setCreationDrafts({});
      setReactionMessageId('');
      setOpenMessageMenuId('');
      try {
        const cached = await loadPersonalAiMessagesCache(user.id, threadId);
        if (
          requestId !== loadMessagesRequestRef.current ||
          selectedThreadIdRef.current !== threadId
        ) {
          return;
        }
        if (cached) {
          replaceMessages(threadId, cached.data as ChatMessage[], false);
        }

        const res = await authFetch(
          `/api/ai/personal/threads/${encodeURIComponent(threadId)}`,
          {
            cache: 'no-store',
          },
        );
        const payload = (await res.json().catch(() => ({}))) as {
          data?: { messages?: ChatMessage[] };
          error?: string;
        };
        if (!res.ok || !payload.data) {
          throw new Error(
            payload.error ||
              (isId
                ? 'Riwayat chat belum dapat dibuka.'
                : 'The chat history could not be opened.'),
          );
        }
        if (
          requestId !== loadMessagesRequestRef.current ||
          selectedThreadIdRef.current !== threadId
        )
          return;
        const nextMessages = payload.data?.messages || [];
        replaceMessages(threadId, nextMessages);
        setCreationDrafts(
          Object.fromEntries(
            nextMessages.flatMap(message => {
              const draft = creationDraftFromMessage(message);
              return draft ? [[message.id, draft] as const] : [];
            }),
          ),
        );
      } catch (loadError) {
        if (
          requestId === loadMessagesRequestRef.current &&
          selectedThreadIdRef.current === threadId
        ) {
          messagesLoadContextRef.current = '';
          setError(
            loadError instanceof Error
              ? loadError.message
              : isId
                ? 'Riwayat chat belum dapat dibuka.'
                : 'The chat history could not be opened.',
          );
        }
      } finally {
        if (requestId === loadMessagesRequestRef.current) {
          setLoadingMessages(false);
        }
      }
    },
    [authFetch, isId, replaceMessages, user?.id],
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
    if (createAgentInFlightRef.current) return;
    createAgentInFlightRef.current = true;
    setCreatingAgent(true);
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
      replaceAgents([
        payload.data.agent,
        ...agentsRef.current.filter(
          agent => agent.id !== payload.data!.agent!.id,
        ),
      ]);
      selectedAgentIdRef.current = payload.data.agent.id;
      setSelectedAgentId(payload.data.agent.id);
      setActivePanel('settings');
      setMobileLibraryOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : copy.createFailed);
    } finally {
      createAgentInFlightRef.current = false;
      setCreatingAgent(false);
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
            model_preference: 'auto',
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
      replaceAgents(
        agentsRef.current.map(agent =>
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
      const nextAgents = agentsRef.current.filter(
        agent => agent.id !== selectedAgent.id,
      );
      replaceAgents(nextAgents);
      const nextAgentId = nextAgents[0]?.id || '';
      selectedAgentIdRef.current = nextAgentId;
      setSelectedAgentId(nextAgentId);
    }
  }

  async function createThread() {
    if (
      !selectedAgent ||
      selectedAgent.cache_only ||
      !user?.id ||
      createThreadInFlightRef.current
    )
      return null;
    createThreadInFlightRef.current = true;
    setCreatingThread(true);
    try {
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
        error?: string;
      };
      if (!res.ok || !payload.data?.thread) {
        throw new Error(
          payload.error ||
            (isId
              ? 'Chat baru belum dapat dibuat.'
              : 'The new chat could not be created.'),
        );
      }
      const nextThread = payload.data.thread;
      replaceThreads(selectedAgent.id, [
        nextThread,
        ...threadsRef.current.filter(thread => thread.id !== nextThread.id),
      ]);
      loadMessagesRequestRef.current += 1;
      messagesLoadContextRef.current = `${user.id}:${nextThread.id}`;
      selectedThreadIdRef.current = nextThread.id;
      setSelectedThreadId(nextThread.id);
      replaceMessages(nextThread.id, []);
      setCreationDrafts({});
      return nextThread;
    } catch (threadError) {
      setError(
        threadError instanceof Error
          ? threadError.message
          : isId
            ? 'Chat baru belum dapat dibuat.'
            : 'The new chat could not be created.',
      );
      return null;
    } finally {
      createThreadInFlightRef.current = false;
      setCreatingThread(false);
    }
  }

  async function deleteThread(thread: ChatThread) {
    if (!selectedAgent || deletingThreadId) return;
    const approved = await confirm({
      title: isId ? 'Hapus chat AI?' : 'Delete AI chat?',
      description: isId
        ? `Chat "${thread.title}" dan seluruh pesannya akan dihapus permanen dari riwayat server.`
        : `"${thread.title}" and all of its messages will be permanently deleted from server history.`,
      confirmLabel: isId ? 'Hapus chat' : 'Delete chat',
      cancelLabel: isId ? 'Batal' : 'Cancel',
      tone: 'danger',
    });
    if (!approved) return;

    setDeletingThreadId(thread.id);
    setError('');
    try {
      const response = await authFetch(
        `/api/ai/personal/threads/${encodeURIComponent(thread.id)}`,
        { method: 'DELETE' },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!response.ok) {
        throw new Error(
          payload.error ||
            (isId
              ? 'Chat belum dapat dihapus.'
              : 'The chat could not be deleted.'),
        );
      }

      const nextThreads = threadsRef.current.filter(
        item => item.id !== thread.id,
      );
      replaceThreads(selectedAgent.id, nextThreads);
      const deletedDraftKey = `${selectedAgent.id}:${thread.id}`;
      const deletedDraft = composerDraftsRef.current.get(deletedDraftKey);
      deletedDraft?.attachments.forEach(revokeAttachmentPreview);
      composerDraftsRef.current.delete(deletedDraftKey);

      if (selectedThreadIdRef.current === thread.id) {
        const nextThreadId = nextThreads[0]?.id || '';
        loadMessagesRequestRef.current += 1;
        messagesLoadContextRef.current = '';
        selectedThreadIdRef.current = nextThreadId;
        setSelectedThreadId(nextThreadId);
        replaceMessages(nextThreadId, [], false);
        setCreationDrafts({});
      }
      setNotice(isId ? 'Chat sudah dihapus' : 'Chat deleted');
    } catch (threadError) {
      setError(
        threadError instanceof Error
          ? threadError.message
          : isId
            ? 'Chat belum dapat dihapus.'
            : 'The chat could not be deleted.',
      );
    } finally {
      setDeletingThreadId('');
    }
  }

  const removeDraftAttachment = useCallback((attachmentId: string) => {
    setDraftAttachments(current => {
      const target = current.find(attachment => attachment.id === attachmentId);
      if (target) revokeAttachmentPreview(target);
      const next = current.filter(attachment => attachment.id !== attachmentId);
      draftAttachmentsRef.current = next;
      return next;
    });
  }, []);

  const clearDraftAttachments = useCallback((shouldRevoke = true) => {
    setDraftAttachments(current => {
      if (shouldRevoke) current.forEach(revokeAttachmentPreview);
      draftAttachmentsRef.current = [];
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

  async function addAttachments(files: File[]) {
    if (files.length === 0 || attachmentsInFlightRef.current) return false;
    attachmentsInFlightRef.current = true;
    setAttaching(true);
    const targetAgentId = selectedAgentIdRef.current;
    const targetThreadId = selectedThreadIdRef.current;

    try {
      const availableSlots = Math.max(
        0,
        MAX_AI_ATTACHMENTS - draftAttachmentsRef.current.length,
      );
      if (availableSlots <= 0) {
        setError(
          isId ? 'Maksimal 4 media per pesan.' : 'Maximum 4 media per message.',
        );
        return false;
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
          revokeAttachmentPreview(attachment);
          continue;
        }

        next.push(attachment);
      }

      if (next.length > 0) {
        if (
          selectedAgentIdRef.current !== targetAgentId ||
          selectedThreadIdRef.current !== targetThreadId
        ) {
          next.forEach(revokeAttachmentPreview);
          setNotice(
            isId
              ? 'Chat sudah berpindah. Media tidak dimasukkan agar tidak salah percakapan.'
              : 'The chat changed. Media was not attached to another conversation.',
          );
          return false;
        }
        setDraftAttachments(current => {
          const merged = [...current, ...next].slice(0, MAX_AI_ATTACHMENTS);
          draftAttachmentsRef.current = merged;
          return merged;
        });
        return true;
      }
      return false;
    } finally {
      attachmentsInFlightRef.current = false;
      setAttaching(false);
    }
  }

  async function transcribeVoiceNote(file: File) {
    if (transcribingVoice) return;
    const targetAgentId = selectedAgentIdRef.current;
    const targetThreadId = selectedThreadIdRef.current;
    setTranscribingVoice(true);
    setError('');
    void trackLajukanEvent('personal_ai.voice_transcription.started', {
      locale,
      entityType: 'personal_ai_agent',
      entityId: targetAgentId || undefined,
      properties: {
        duration_seconds: Math.round(voiceRecorder.durationMs / 1_000),
        size_bucket:
          file.size < 512 * 1024
            ? 'under_512kb'
            : file.size < 2 * 1024 * 1024
              ? 'under_2mb'
              : '2mb_or_more',
      },
    });
    try {
      const form = new FormData();
      form.set('file', file, file.name);
      const res = await authFetch(
        `/api/ai/personal/transcribe?locale=${encodeURIComponent(locale)}`,
        {
          method: 'POST',
          body: form,
        },
      );
      const payload = (await res.json().catch(() => ({}))) as {
        data?: { text?: string };
        error?: string;
      };
      const transcript = payload.data?.text?.trim() || '';
      if (!res.ok || !transcript) {
        throw new Error(
          payload.error ||
            (isId
              ? 'Rekaman belum bisa diubah menjadi teks.'
              : 'The recording could not be converted to text.'),
        );
      }
      if (
        selectedAgentIdRef.current !== targetAgentId ||
        selectedThreadIdRef.current !== targetThreadId
      ) {
        setNotice(
          isId
            ? 'Chat sudah berpindah. Hasil rekaman tidak dimasukkan agar tidak salah percakapan.'
            : 'The chat changed. The transcript was not inserted into another conversation.',
        );
        return;
      }
      const currentInput = inputRef.current;
      const nextInput = [currentInput.trim(), transcript]
        .filter(Boolean)
        .join(currentInput.trim() ? '\n' : '')
        .slice(0, 3_500);
      inputRef.current = nextInput;
      setInput(nextInput);
      voiceRecorder.cancel();
      void trackLajukanEvent('personal_ai.voice_transcription.completed', {
        locale,
        entityType: 'personal_ai_agent',
        entityId: targetAgentId || undefined,
        properties: {
          duration_seconds: Math.round(voiceRecorder.durationMs / 1_000),
        },
      });
      setNotice(
        isId
          ? 'Rekaman sudah menjadi teks. Periksa sebelum dikirim.'
          : 'The recording is now text. Review it before sending.',
      );
    } catch (transcriptionError) {
      void trackLajukanEvent('personal_ai.voice_transcription.failed', {
        locale,
        entityType: 'personal_ai_agent',
        entityId: targetAgentId || undefined,
      });
      setError(
        transcriptionError instanceof Error
          ? transcriptionError.message
          : isId
            ? 'Transkripsi suara gagal. Coba lagi.'
            : 'Voice transcription failed. Please try again.',
      );
    } finally {
      setTranscribingVoice(false);
    }
  }

  async function handleAttachmentChange(event: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    await addAttachments(files);
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
      quickButtonId?: string;
      clientRef?: string;
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
      selectedAgent.cache_only ||
      !user?.id ||
      sending ||
      sendInFlightRef.current
    )
      return;
    sendInFlightRef.current = true;
    const targetAgent = selectedAgent;
    const targetAgentId = selectedAgent.id;
    const targetThreadId = selectedThreadId;
    const requestFingerprint = JSON.stringify({
      agentId: targetAgentId,
      threadId: targetThreadId,
      message,
      quickButtonId: options.quickButtonId || '',
      replyToMessageId: activeReply?.id || '',
      creationTarget: guidedCreationTarget || '',
      attachments: activeAttachments.map(attachmentPayload),
    });
    const clientRef =
      options.clientRef ||
      (sendRetryRef.current?.fingerprint === requestFingerprint
        ? sendRetryRef.current.clientRef
        : createPersonalAiClientRef());
    const isRequestStillVisible = (resolvedThreadId = targetThreadId) =>
      selectedAgentIdRef.current === targetAgentId &&
      (targetThreadId
        ? selectedThreadIdRef.current === targetThreadId
        : !selectedThreadIdRef.current ||
          selectedThreadIdRef.current === resolvedThreadId);
    setSending(true);
    setError('');
    if (options.clearInput !== false) {
      inputRef.current = '';
      setInput('');
    }
    draftAttachmentsRef.current = [];
    replyingToRef.current = null;
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
      metadata: {
        client_ref: clientRef,
        ...(activeAttachments.length > 0
          ? { media: activeAttachments.map(attachmentMetadata) }
          : {}),
        ...(optimisticReply ? { reply_to: optimisticReply } : {}),
      },
    };
    replaceMessages(
      targetThreadId,
      [...messagesRef.current, optimistic],
      Boolean(targetThreadId),
    );
    try {
      const res = await authFetch('/api/ai/personal/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(PERSONAL_AI_CHAT_TIMEOUT_MS),
        body: JSON.stringify({
          agent_id: targetAgent.can_edit ? targetAgent.id : undefined,
          share_id: targetAgent.can_edit ? undefined : targetAgent.share_id,
          thread_id: targetThreadId || undefined,
          client_ref: clientRef,
          message,
          quick_button_id: options.quickButtonId || '',
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
      const resolvedThreadId = payload.data.thread?.id || targetThreadId;
      if (!isRequestStillVisible(resolvedThreadId)) {
        activeAttachments.forEach(revokeAttachmentPreview);
        return;
      }
      if (payload.data.thread) {
        const returnedThread = payload.data.thread;
        if (!targetThreadId) {
          loadMessagesRequestRef.current += 1;
          messagesLoadContextRef.current = `${user.id}:${returnedThread.id}`;
        }
        selectedThreadIdRef.current = returnedThread.id;
        setSelectedThreadId(returnedThread.id);
        replaceThreads(targetAgentId, [
          returnedThread,
          ...threadsRef.current.filter(
            thread => thread.id !== returnedThread.id,
          ),
        ]);
      }
      const savedMessages = payload.data.messages;
      if (sendRetryRef.current?.clientRef === clientRef) {
        sendRetryRef.current = null;
      }
      const savedMessageIds = new Set(savedMessages.map(item => item.id));
      replaceMessages(
        resolvedThreadId,
        [
          ...messagesRef.current.filter(
            messageItem =>
              messageItem.id !== optimistic.id &&
              !savedMessageIds.has(messageItem.id),
          ),
          ...savedMessages,
        ],
        Boolean(resolvedThreadId),
      );
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
                payload.data.thread?.id || targetThreadId || undefined,
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
          if (isRequestStillVisible(resolvedThreadId)) {
            setCreationDrafts(current => ({
              ...current,
              [assistantMessage.id]: draftPayload.data!,
            }));
            replaceMessages(
              resolvedThreadId,
              messagesRef.current.map(item =>
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
              Boolean(resolvedThreadId),
            );
            editingCreationDraftRef.current = null;
            setEditingCreationDraft(null);
          }
        } catch (draftError) {
          if (isRequestStillVisible(resolvedThreadId)) {
            setError(
              draftError instanceof Error
                ? draftError.message
                : isId
                  ? 'Jawaban AI berhasil, tetapi draft belum tersimpan.'
                  : 'The AI replied, but the draft was not saved.',
            );
          }
        }
      }
      activeAttachments.forEach(revokeAttachmentPreview);
    } catch (err) {
      if (isRequestStillVisible()) {
        sendRetryRef.current = { fingerprint: requestFingerprint, clientRef };
        setError(readableSendError(err));
        if (activeAttachments.length === 0) {
          replaceMessages(
            targetThreadId,
            messagesRef.current.map(messageItem =>
              messageItem.id === optimistic.id
                ? {
                    ...messageItem,
                    metadata: {
                      ...messageItem.metadata,
                      send_status: 'failed',
                    },
                  }
                : messageItem,
            ),
            Boolean(targetThreadId),
          );
        } else {
          replaceMessages(
            targetThreadId,
            messagesRef.current.filter(
              messageItem => messageItem.id !== optimistic.id,
            ),
            Boolean(targetThreadId),
          );
          draftAttachmentsRef.current = activeAttachments;
          setDraftAttachments(activeAttachments);
        }
        replyingToRef.current = activeReply;
        setReplyingTo(activeReply);
      }
    } finally {
      sendInFlightRef.current = false;
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
    editingCreationDraftRef.current = null;
    setEditingCreationDraft(null);
    void sendMessage(input.trim() || fallbackPrompt[target], {
      creationIntent: target,
    });
  }

  function improveCreationDraft(draft: AICreationDraft) {
    setEditingCreationDraft(draft);
    editingCreationDraftRef.current = draft;
    const nextInput = isId
      ? `Perbaiki draft "${draft.title}". Bagian yang ingin saya ubah: `
      : `Improve the draft "${draft.title}". I want to change: `;
    inputRef.current = nextInput;
    setInput(nextInput);
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
    replaceMessages(
      selectedThreadId,
      messagesRef.current.map(item =>
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
      replaceMessages(
        selectedThreadId,
        messagesRef.current.map(item =>
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
        const returnedThread = payload.data.thread;
        replaceThreads(returnedThread.agent_id, [
          returnedThread,
          ...threadsRef.current.filter(
            thread => thread.id !== returnedThread.id,
          ),
        ]);
      }
      setForwardingMessage(null);
      setNotice(isId ? 'Pesan diteruskan' : 'Message forwarded');
      if (targetThreadId === selectedThreadIdRef.current) {
        replaceMessages(targetThreadId, [
          ...messagesRef.current,
          payload.data.message,
        ]);
      } else {
        selectedThreadIdRef.current = targetThreadId;
        setSelectedThreadId(targetThreadId);
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
      replaceMessages(
        selectedThreadId,
        messagesRef.current.map(message => {
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

  async function changeViewerMemory(enabled: boolean) {
    if (
      !selectedAgent ||
      selectedAgent.can_edit ||
      !viewerMemory.can_manage_recipient_consent ||
      savingViewerMemory
    )
      return;
    const targetAgentId = selectedAgent.id;
    const targetShareId = selectedAgent.share_id;
    setSavingViewerMemory(true);
    setError('');
    try {
      const response = await authFetch(
        `/api/ai/personal/agents/${encodeURIComponent(targetAgentId)}/memory?share_id=${encodeURIComponent(targetShareId)}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { enabled?: boolean };
        error?: string;
      };
      if (!response.ok || typeof payload.data?.enabled !== 'boolean') {
        throw new Error(payload.error || 'Memory change failed.');
      }
      if (selectedAgentIdRef.current !== targetAgentId) return;
      setViewerMemory(current => ({
        ...current,
        enabled: payload.data!.enabled!,
      }));
      setNotice(
        payload.data.enabled
          ? isId
            ? 'Ingatan untuk asisten ini diaktifkan'
            : 'Memory is on for this assistant'
          : isId
            ? 'Ingatan untuk asisten ini dimatikan'
            : 'Memory is off for this assistant',
      );
    } catch (memoryError) {
      if (selectedAgentIdRef.current !== targetAgentId) return;
      setError(
        memoryError instanceof Error
          ? memoryError.message
          : isId
            ? 'Pengaturan ingatan gagal diubah.'
            : 'Failed to change memory settings.',
      );
    } finally {
      setSavingViewerMemory(false);
    }
  }

  async function removeViewerMemory() {
    if (
      !selectedAgent ||
      selectedAgent.can_edit ||
      !viewerMemory.can_manage_recipient_consent ||
      savingViewerMemory
    )
      return;
    const targetAgentId = selectedAgent.id;
    const targetShareId = selectedAgent.share_id;
    const approved = await confirm({
      title: isId ? 'Hapus ingatan asisten?' : 'Delete assistant memory?',
      description: isId
        ? 'Ringkasan yang tersimpan untuk akun Anda akan dihapus permanen dan ingatan dimatikan. Riwayat chat tidak ikut terhapus.'
        : 'Saved summaries for your account will be permanently deleted and memory will be turned off. Chat history is kept.',
      confirmLabel: isId ? 'Hapus ingatan' : 'Delete memory',
      cancelLabel: isId ? 'Batal' : 'Cancel',
      tone: 'danger',
    });
    if (!approved) return;
    setSavingViewerMemory(true);
    setError('');
    try {
      const response = await authFetch(
        `/api/ai/personal/agents/${encodeURIComponent(targetAgentId)}/memory?share_id=${encodeURIComponent(targetShareId)}`,
        { method: 'DELETE' },
      );
      if (!response.ok) throw new Error('Memory deletion failed.');
      if (selectedAgentIdRef.current !== targetAgentId) return;
      setViewerMemory({
        enabled: false,
        can_manage_recipient_consent: true,
        memory: null,
      });
      setNotice(isId ? 'Ingatan sudah dihapus' : 'Memory deleted');
    } catch {
      if (selectedAgentIdRef.current !== targetAgentId) return;
      setError(isId ? 'Ingatan gagal dihapus.' : 'Failed to delete memory.');
    } finally {
      setSavingViewerMemory(false);
    }
  }

  async function clearLocalPersonalAiData() {
    if (!user?.id) return;
    const approved = await confirm({
      title: isId
        ? 'Hapus data AI dari perangkat ini?'
        : 'Clear AI data from this device?',
      description: isId
        ? 'Snapshot agent, tab chat, dan pesan yang dipakai untuk membuka lebih cepat akan dihapus dari browser ini. Riwayat server dan ingatan akun tidak ikut terhapus.'
        : 'Browser snapshots of assistants, chat tabs, and messages will be removed from this device. Server history and account memory are kept.',
      confirmLabel: isId ? 'Hapus data lokal' : 'Clear local data',
      cancelLabel: isId ? 'Batal' : 'Cancel',
      tone: 'danger',
    });
    if (!approved) return;
    await clearPersonalAiCache(user.id);
    setNotice(
      isId
        ? 'Data AI lokal sudah dihapus. Riwayat server tidak berubah.'
        : 'Local AI data was cleared. Server history was not changed.',
    );
  }

  async function changeShareLink(action: 'rotate' | 'revoke') {
    if (!selectedAgent || !selectedAgent.can_edit || savingShare) return;
    const approved = await confirm({
      title:
        action === 'revoke'
          ? isId
            ? 'Cabut semua akses tautan?'
            : 'Revoke all link access?'
          : isId
            ? 'Ganti tautan berbagi?'
            : 'Replace the share link?',
      description:
        action === 'revoke'
          ? isId
            ? 'Tautan lama langsung tidak berlaku dan asisten diubah menjadi Hanya saya.'
            : 'The old link will stop working immediately and the assistant becomes private.'
          : isId
            ? 'Tautan lama langsung tidak berlaku. Orang lain perlu menerima tautan baru.'
            : 'The old link will stop working immediately. Recipients will need the new link.',
      confirmLabel:
        action === 'revoke'
          ? isId
            ? 'Cabut akses'
            : 'Revoke access'
          : isId
            ? 'Ganti tautan'
            : 'Replace link',
      cancelLabel: isId ? 'Batal' : 'Cancel',
      tone: action === 'revoke' ? 'danger' : 'default',
    });
    if (!approved) return;
    setSavingShare(true);
    setError('');
    try {
      const response = await authFetch(
        `/api/ai/personal/agents/${encodeURIComponent(selectedAgent.id)}/share`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as {
        data?: { agent?: PersonalAgent };
        error?: string;
      };
      if (!response.ok || !payload.data?.agent) {
        throw new Error(payload.error || 'Share-link change failed.');
      }
      replaceAgents(
        agentsRef.current.map(agent =>
          agent.id === payload.data!.agent!.id ? payload.data!.agent! : agent,
        ),
      );
      setNotice(
        action === 'revoke'
          ? isId
            ? 'Akses tautan sudah dicabut'
            : 'Link access revoked'
          : isId
            ? 'Tautan baru sudah dibuat'
            : 'New link created',
      );
    } catch (shareError) {
      setError(
        shareError instanceof Error
          ? shareError.message
          : isId
            ? 'Tautan gagal diubah.'
            : 'Failed to change the link.',
      );
    } finally {
      setSavingShare(false);
    }
  }

  if (authLoading || (loadingAgents && agents.length === 0)) {
    return (
      <main className="lajukan-visual-viewport-shell flex min-h-0 items-center justify-center overflow-hidden bg-[color:var(--app-surface-muted)] px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <div
          className="inline-flex items-center gap-2 text-sm font-bold text-[color:var(--app-text-soft)]"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="h-4 w-4 animate-spin" />
          {isId ? 'Menyiapkan AI...' : 'Preparing AI...'}
        </div>
      </main>
    );
  }

  if (!user) {
    return (
      <main className="lajukan-visual-viewport-shell flex min-h-0 items-center justify-center overflow-hidden bg-[color:var(--app-surface-muted)] px-4 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]">
        <Link
          href="/login"
          className="inline-flex min-h-11 items-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-sm font-bold text-white"
        >
          {isId ? 'Masuk' : 'Login'}
        </Link>
      </main>
    );
  }

  const showMobileLibrary = mobileLibraryOpen || !selectedAgent;
  const panels: PersonalAiPanel[] = canEditSelected
    ? ['chat', 'builder', 'settings', 'share', 'memory']
    : ['chat', 'memory'];
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
              'h-full min-h-0 w-full min-w-0 max-w-full flex-col overflow-hidden border-r border-black/5 bg-white px-3 pb-3 pt-[calc(env(safe-area-inset-top)+0.75rem)] dark:border-white/6 dark:bg-[#111b21] lg:flex lg:w-[320px] lg:shrink-0',
              showMobileLibrary ? 'flex' : 'hidden lg:flex',
            )}
          >
            <div className="mb-3 flex items-center justify-between gap-2">
              <Link
                href="/profile"
                className="inline-flex min-h-11 items-center gap-1.5 rounded-full px-2 text-xs font-bold text-[color:var(--app-text-soft)] hover:bg-[color:var(--app-surface-muted)]"
              >
                <ChevronLeft className="h-4 w-4" />
                {copy.back}
              </Link>
              <button
                type="button"
                onClick={() => void createAgent()}
                disabled={creatingAgent}
                className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] disabled:cursor-not-allowed disabled:opacity-50"
                aria-label={copy.newAi}
              >
                {creatingAgent ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4" />
                )}
              </button>
            </div>

            <h1 className="mb-3 flex items-center gap-2 text-lg font-bold tracking-[-0.03em]">
              <Bot className="h-5 w-5 text-[color:var(--app-accent)]" />
              {copy.title}
            </h1>

            <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-0.5">
              {agents.length === 0 ? (
                <div className="rounded-[16px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-center">
                  <Bot className="mx-auto h-6 w-6 text-[color:var(--app-accent)]" />
                  <p className="mt-2 text-sm font-bold">
                    {error
                      ? isId
                        ? 'Asisten belum dapat dimuat'
                        : 'Assistants could not be loaded'
                      : isId
                        ? 'Belum ada asisten'
                        : 'No assistant yet'}
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                    {error
                      ? isId
                        ? 'Periksa koneksi, lalu coba sinkronkan lagi.'
                        : 'Check your connection, then try syncing again.'
                      : isId
                        ? 'Buat satu asisten untuk membantu tugas usaha sehari-hari.'
                        : 'Create an assistant for everyday business tasks.'}
                  </p>
                  <button
                    type="button"
                    onClick={() =>
                      error ? void loadAgents() : void createAgent()
                    }
                    disabled={creatingAgent || loadingAgents}
                    className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-xs font-bold text-[color:var(--app-text-inverse)] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {creatingAgent || loadingAgents ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : error ? (
                      <RefreshCcw className="h-4 w-4" />
                    ) : (
                      <Plus className="h-4 w-4" />
                    )}
                    {error ? (isId ? 'Coba lagi' : 'Try again') : copy.newAi}
                  </button>
                </div>
              ) : null}
              {agents.map(agent => (
                <button
                  key={agent.id}
                  type="button"
                  aria-pressed={selectedAgentId === agent.id}
                  onClick={() => {
                    selectedAgentIdRef.current = agent.id;
                    setSelectedAgentId(agent.id);
                    setActivePanel('chat');
                    setMobileLibraryOpen(false);
                    setMobileToolsOpen(false);
                  }}
                  className={cn(
                    'w-full min-w-0 rounded-[14px] border p-3 text-left transition',
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
                    {agent.description ||
                      (isId
                        ? 'Asisten AI untuk membantu kebutuhan usaha.'
                        : 'An AI assistant for everyday business needs.')}
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
            <div className="relative shrink-0 border-b border-black/5 bg-[#f0f2f5] px-3 pb-2 pt-[calc(env(safe-area-inset-top)+0.5rem)] dark:border-white/6 dark:bg-[#202c33]">
              <div className="flex min-w-0 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileLibraryOpen(true);
                      setMobileToolsOpen(false);
                    }}
                    className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-[#54656f] transition hover:bg-black/5 dark:text-[#aebac1] dark:hover:bg-white/8 lg:hidden"
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
                      {' · '}
                      <span className="font-bold text-[color:var(--app-accent)]">
                        AI
                      </span>
                      {selectedAgent?.can_edit
                        ? ''
                        : isId
                          ? ' · dibagikan kepada Anda'
                          : ' · shared with you'}
                    </p>
                    {selectedAgent?.cache_only ? (
                      <p className="mt-0.5 truncate text-[10px] font-bold text-amber-700 dark:text-amber-200">
                        {isId
                          ? 'Snapshot perangkat · menyinkronkan'
                          : 'Device snapshot · syncing'}
                      </p>
                    ) : null}
                  </div>
                </div>
                <button
                  ref={mobileToolsTriggerRef}
                  type="button"
                  onClick={() => setMobileToolsOpen(value => !value)}
                  className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-white px-3 text-xs font-bold text-[#54656f] shadow-sm dark:bg-[#111b21] dark:text-[#aebac1] sm:hidden"
                  aria-expanded={mobileToolsOpen}
                  aria-haspopup="menu"
                  aria-controls="personal-ai-tools-menu"
                >
                  {panelIcon(activePanel)}
                  {panelLabel(activePanel)}
                </button>
                <div
                  className="hidden min-w-0 items-center gap-1 overflow-x-auto [scrollbar-width:none] sm:flex [&::-webkit-scrollbar]:hidden"
                  role="tablist"
                  aria-label={isId ? 'Panel AI' : 'AI panels'}
                >
                  {panels.map(panel => (
                    <button
                      key={panel}
                      type="button"
                      role="tab"
                      aria-selected={activePanel === panel}
                      onClick={() => selectPanel(panel)}
                      className={cn(
                        'inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3 text-xs font-bold',
                        activePanel === panel
                          ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
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
                <div
                  ref={mobileToolsMenuRef}
                  id="personal-ai-tools-menu"
                  role="menu"
                  className="absolute left-3 right-3 top-[calc(100%+0.4rem)] z-50 grid grid-cols-2 gap-1.5 rounded-[18px] border border-black/10 bg-white p-2 shadow-[0_24px_70px_-34px_rgba(17,27,33,0.5)] dark:border-white/10 dark:bg-[#111b21] sm:hidden"
                >
                  {panels.map(panel => (
                    <button
                      key={panel}
                      type="button"
                      role="menuitemradio"
                      aria-checked={activePanel === panel}
                      onClick={() => selectPanel(panel)}
                      className={cn(
                        'inline-flex min-h-11 items-center justify-center gap-1.5 rounded-[14px] px-3 text-xs font-bold',
                        activePanel === panel
                          ? 'bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]'
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
                  <div
                    className="flex items-center gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                    role="status"
                  >
                    <Check className="h-4 w-4" />
                    {notice}
                    <button
                      type="button"
                      onClick={() => setNotice('')}
                      className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-emerald-100"
                      aria-label={
                        isId ? 'Tutup pemberitahuan' : 'Dismiss notice'
                      }
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : null}
                {error ? (
                  <div
                    className="flex items-center gap-2 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                    role="alert"
                  >
                    {error}
                    <button
                      type="button"
                      onClick={() => setError('')}
                      className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-rose-100"
                      aria-label={
                        isId ? 'Tutup pesan kesalahan' : 'Dismiss error'
                      }
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
                    disabled={
                      !selectedAgent ||
                      selectedAgent.cache_only ||
                      creatingThread
                    }
                    className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-bold text-[color:var(--app-accent)] disabled:opacity-50"
                  >
                    {creatingThread ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MessageSquarePlus className="h-3.5 w-3.5" />
                    )}
                    {copy.newTab}
                  </button>
                  {loadingThreads ? (
                    <Loader2 className="h-4 w-4 animate-spin text-[color:var(--app-text-soft)]" />
                  ) : null}
                  {threads.map(thread => {
                    const isSelected = selectedThreadId === thread.id;
                    const isDeleting = deletingThreadId === thread.id;
                    return (
                      <div
                        key={thread.id}
                        className={cn(
                          'inline-flex min-h-11 max-w-[220px] shrink-0 items-center rounded-full text-xs font-bold',
                          isSelected
                            ? 'bg-[color:var(--app-text)] text-[color:var(--app-surface-strong)]'
                            : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                        )}
                      >
                        <button
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            selectedThreadIdRef.current = thread.id;
                            setSelectedThreadId(thread.id);
                          }}
                          className="inline-flex min-h-11 min-w-0 items-center gap-2 rounded-l-full py-2 pl-3 pr-2"
                        >
                          <span className="truncate">{thread.title}</span>
                          <span className="shrink-0 text-[9px] opacity-70">
                            {compactTime(thread.updated_at)}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => void deleteThread(thread)}
                          disabled={Boolean(deletingThreadId)}
                          className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full opacity-70 transition hover:bg-black/10 hover:opacity-100 disabled:opacity-40 dark:hover:bg-white/10"
                          aria-label={
                            isId
                              ? `Hapus chat ${thread.title}`
                              : `Delete chat ${thread.title}`
                          }
                        >
                          {isDeleting ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="h-3.5 w-3.5" />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>

                <div
                  ref={messagesViewportRef}
                  className="min-h-0 flex-1 touch-pan-y overflow-y-auto px-2 py-4 [-webkit-overflow-scrolling:touch] sm:px-2"
                  data-auto-scrollbar
                  role="log"
                  aria-live="polite"
                  aria-relevant="additions"
                  aria-busy={loadingMessages}
                  aria-label={
                    isId
                      ? 'Percakapan dengan asisten AI'
                      : 'Conversation with the AI assistant'
                  }
                >
                  {loadingMessages && messages.length === 0 ? (
                    <div
                      className="grid min-h-[220px] place-items-center"
                      role="status"
                    >
                      <div className="inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-xs font-bold text-[color:var(--app-text-soft)] shadow-sm dark:bg-[#202c33]">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {isId
                          ? 'Membuka riwayat chat...'
                          : 'Opening chat history...'}
                      </div>
                    </div>
                  ) : messages.length === 0 ? (
                    <div className="mx-auto mt-10 max-w-lg rounded-[18px] border border-dashed border-black/10 bg-white/80 p-4 text-center shadow-[0_14px_34px_-28px_rgba(17,27,33,0.35)]  dark:border-white/10 dark:bg-[#202c33]/84">
                      <Sparkles className="mx-auto h-6 w-6 text-[color:var(--app-accent)]" />
                      <p className="mt-2 text-sm font-bold">{copy.empty}</p>
                      <p className="mx-auto mt-1 max-w-md text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'AI membantu menyusun ide dan draf. Periksa kembali jawabannya sebelum dipakai.'
                          : 'AI helps draft ideas and responses. Review its answer before using it.'}
                      </p>
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {suggestedPrompts.map(prompt => (
                          <button
                            key={prompt}
                            type="button"
                            onClick={() => void sendMessage(prompt)}
                            className="min-h-11 rounded-[14px] bg-[color:var(--app-accent-soft)] px-3 py-2 text-xs font-bold leading-4 text-[color:var(--app-accent)] transition hover:bg-[color:var(--app-accent-soft-strong,var(--app-accent-soft))]"
                          >
                            {prompt}
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-[11px] font-semibold leading-4 text-amber-700 dark:text-amber-200">
                        {isId
                          ? 'Jangan kirim PIN, OTP, kata sandi, atau data rahasia.'
                          : 'Do not send PINs, one-time codes, passwords, or confidential data.'}
                      </p>
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
                              <div className="mt-1 flex items-center justify-end gap-1.5 text-[10px] font-semibold opacity-60">
                                <span>
                                  {compactMessageTime(message.created_at, isId)}
                                </span>
                                {message.id.startsWith('local_') &&
                                message.metadata?.send_status !== 'failed' ? (
                                  <span className="inline-flex items-center gap-1">
                                    <Loader2 className="h-3 w-3 animate-spin" />
                                    {isId ? 'Mengirim' : 'Sending'}
                                  </span>
                                ) : null}
                              </div>
                              {message.metadata?.send_status === 'failed' ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    replaceMessages(
                                      selectedThreadId,
                                      messagesRef.current.filter(
                                        item => item.id !== message.id,
                                      ),
                                    );
                                    void sendMessage(message.content, {
                                      clientRef:
                                        typeof message.metadata?.client_ref ===
                                        'string'
                                          ? message.metadata.client_ref
                                          : undefined,
                                    });
                                  }}
                                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-rose-50 px-3 text-xs font-bold text-rose-700 dark:bg-rose-500/15 dark:text-rose-200"
                                >
                                  <RefreshCcw className="h-3.5 w-3.5" />
                                  {isId
                                    ? 'Coba kirim lagi'
                                    : 'Try sending again'}
                                </button>
                              ) : null}
                            </div>
                            <div
                              data-personal-ai-message-actions
                              className={cn(
                                'relative mt-1 flex items-center gap-1 text-[#667781] dark:text-[#8696a0]',
                                message.role === 'user'
                                  ? 'justify-end'
                                  : 'justify-start',
                              )}
                            >
                              <button
                                type="button"
                                onClick={() => {
                                  setReactionMessageId('');
                                  setOpenMessageMenuId(current =>
                                    current === message.id ? '' : message.id,
                                  );
                                }}
                                disabled={message.id.startsWith('local_')}
                                className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5 hover:text-[color:var(--app-accent)] disabled:opacity-35 dark:hover:bg-white/10"
                                aria-label={
                                  isId ? 'Tindakan pesan' : 'Message actions'
                                }
                                aria-haspopup="menu"
                                aria-expanded={openMessageMenuId === message.id}
                                onKeyDown={event => {
                                  if (event.key === 'Escape') {
                                    setOpenMessageMenuId('');
                                  }
                                }}
                              >
                                <MoreVertical className="h-4 w-4" />
                              </button>
                              {openMessageMenuId === message.id ? (
                                <div
                                  role="menu"
                                  className={cn(
                                    'absolute bottom-full z-30 mb-1 min-w-[168px] overflow-hidden rounded-[14px] border border-black/10 bg-white py-1 shadow-xl dark:border-white/10 dark:bg-[#202c33]',
                                    message.role === 'user'
                                      ? 'right-0'
                                      : 'left-0',
                                  )}
                                >
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMessageMenuId('');
                                      replyingToRef.current = message;
                                      setReplyingTo(message);
                                      requestAnimationFrame(() =>
                                        scrollMessagesToBottom('smooth'),
                                      );
                                    }}
                                    className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                                  >
                                    <Reply className="h-4 w-4" />
                                    {isId ? 'Balas' : 'Reply'}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMessageMenuId('');
                                      setReactionMessageId(message.id);
                                    }}
                                    className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                                  >
                                    <Smile className="h-4 w-4" />
                                    {isId ? 'Beri reaksi' : 'React'}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMessageMenuId('');
                                      setForwardingMessage(message);
                                    }}
                                    className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                                  >
                                    <Forward className="h-4 w-4" />
                                    {isId ? 'Teruskan' : 'Forward'}
                                  </button>
                                  <button
                                    type="button"
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMessageMenuId('');
                                      void copyMessage(message);
                                    }}
                                    className="flex min-h-11 w-full items-center gap-3 px-3 text-left text-sm font-semibold hover:bg-black/5 dark:hover:bg-white/10"
                                  >
                                    <Copy className="h-4 w-4" />
                                    {isId ? 'Salin' : 'Copy'}
                                  </button>
                                </div>
                              ) : null}
                              {reaction ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    void reactToMessage(message, reaction)
                                  }
                                  className="ml-1 inline-flex h-11 min-w-11 items-center justify-center rounded-full bg-white px-2 text-sm shadow-sm ring-1 ring-black/5 dark:bg-[#202c33] dark:ring-white/10"
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
                                      className="inline-flex h-11 w-11 items-center justify-center rounded-full text-base hover:bg-black/5 dark:hover:bg-white/10"
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
                              ? 'AI sedang menyusun jawaban...'
                              : 'AI is preparing an answer...'}
                          </span>
                        </div>
                      ) : null}
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>

                <div className="lajukan-chat-composer max-h-[min(70%,calc(var(--app-visual-viewport-height)_-_4rem))] shrink-0 overflow-y-auto overscroll-contain border-t border-black/5 bg-[#f0f2f5] px-2 pb-[var(--chat-composer-bottom-pad)] pt-2 dark:border-white/6 dark:bg-[#202c33] sm:px-3 lg:pb-3">
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
                        onClick={() => {
                          replyingToRef.current = null;
                          setReplyingTo(null);
                        }}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
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
                        onClick={() => {
                          editingCreationDraftRef.current = null;
                          setEditingCreationDraft(null);
                        }}
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 dark:hover:bg-white/10"
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
                        className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
                        aria-label={
                          isId ? 'Batalkan pembuatan' : 'Cancel creation'
                        }
                        title={isId ? 'Batalkan pembuatan' : 'Cancel creation'}
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : null}
                  {quickActionsOpen ? (
                    <div
                      className="mb-2 rounded-[18px] border border-black/5 bg-white p-2 shadow-sm dark:border-white/8 dark:bg-[#111b21]"
                      role="region"
                      aria-label={
                        isId ? 'Pilihan bantuan cepat' : 'Quick help options'
                      }
                    >
                      <div className="mb-2 flex items-center justify-between gap-2 px-1">
                        <p className="text-xs font-bold text-[#111b21] dark:text-[#e9edef]">
                          {isId
                            ? 'Pilih yang ingin dibantu'
                            : 'Choose what you need'}
                        </p>
                        <button
                          type="button"
                          onClick={() => setQuickActionsOpen(false)}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#54656f] hover:bg-[#f0f2f5] dark:text-[#aebac1] dark:hover:bg-[#202c33]"
                          aria-label={isId ? 'Tutup pilihan' : 'Close options'}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <button
                          type="button"
                          onClick={() => {
                            setQuickActionsOpen(false);
                            fileInputRef.current?.click();
                          }}
                          disabled={
                            sending ||
                            attaching ||
                            draftAttachments.length >= MAX_AI_ATTACHMENTS
                          }
                          className="flex min-h-12 items-center gap-2 rounded-[14px] bg-[#f0f2f5] px-3 text-left text-xs font-bold text-[#54656f] disabled:opacity-50 dark:bg-[#202c33] dark:text-[#aebac1]"
                        >
                          <Paperclip className="h-4 w-4 shrink-0" />
                          {isId ? 'Foto atau file' : 'Photo or file'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickActionsOpen(false);
                            startCreation('offering_listing');
                          }}
                          disabled={sending}
                          className="flex min-h-12 items-center gap-2 rounded-[14px] bg-[#ecfdf5] px-3 text-left text-xs font-bold text-[#047857] disabled:opacity-50 dark:bg-[rgba(5,150,105,0.16)] dark:text-[#a7f3d0]"
                        >
                          <ShoppingBag className="h-4 w-4 shrink-0" />
                          {isId ? 'Buat penawaran' : 'Create offer'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickActionsOpen(false);
                            startCreation('looking_for_listing');
                          }}
                          disabled={sending}
                          className="flex min-h-12 items-center gap-2 rounded-[14px] bg-[#eff6ff] px-3 text-left text-xs font-bold text-[#1d4ed8] disabled:opacity-50 dark:bg-[rgba(37,99,235,0.16)] dark:text-[#bfdbfe]"
                        >
                          <Search className="h-4 w-4 shrink-0" />
                          {isId ? 'Buat kebutuhan' : 'Create request'}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setQuickActionsOpen(false);
                            startCreation('business_profile');
                          }}
                          disabled={sending}
                          className="flex min-h-12 items-center gap-2 rounded-[14px] bg-[#fffbeb] px-3 text-left text-xs font-bold text-[#a16207] disabled:opacity-50 dark:bg-[rgba(180,83,9,0.16)] dark:text-[#fde68a]"
                        >
                          <Building2 className="h-4 w-4 shrink-0" />
                          {isId ? 'Daftarkan usaha' : 'Register business'}
                        </button>
                      </div>
                      {selectedAgent?.quick_buttons?.length ? (
                        <div className="mt-2 flex gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                          {selectedAgent.quick_buttons.map(button => (
                            <button
                              key={button.id}
                              type="button"
                              onClick={() => {
                                setQuickActionsOpen(false);
                                void sendMessage(button.prompt, {
                                  quickButtonId: button.id,
                                });
                              }}
                              className="inline-flex min-h-11 shrink-0 items-center rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-bold text-[color:var(--app-accent)]"
                            >
                              {button.label}
                            </button>
                          ))}
                        </div>
                      ) : null}
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
                              {attachment.kind === 'image'
                                ? isId
                                  ? 'gambar'
                                  : 'image'
                                : attachment.kind === 'video'
                                  ? 'video'
                                  : attachment.kind === 'audio'
                                    ? isId
                                      ? 'suara'
                                      : 'audio'
                                    : isId
                                      ? 'dokumen'
                                      : 'document'}
                              {attachment.url
                                ? isId
                                  ? ' · siap'
                                  : ' · ready'
                                : ''}
                            </span>
                          </span>
                          <button
                            type="button"
                            onClick={() => removeDraftAttachment(attachment.id)}
                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#f0f2f5] text-[#54656f] dark:bg-[#111b21] dark:text-[#aebac1]"
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
                  {voiceRecorder.status !== 'idle' ? (
                    <div
                      className="mb-2 rounded-[18px] border border-black/5 bg-white p-2 shadow-sm dark:border-white/8 dark:bg-[#111b21]"
                      role="status"
                      aria-live="polite"
                    >
                      {voiceRecorder.status === 'error' ? (
                        <div className="flex items-center gap-2">
                          <p className="min-w-0 flex-1 text-xs font-semibold leading-5 text-rose-700 dark:text-rose-200">
                            {voiceRecorderErrorMessage(
                              voiceRecorder.error,
                              isId,
                            )}
                          </p>
                          <button
                            type="button"
                            onClick={() => void voiceRecorder.start()}
                            className="inline-flex min-h-11 items-center rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-bold text-[color:var(--app-accent)]"
                          >
                            {isId ? 'Coba lagi' : 'Try again'}
                          </button>
                          <button
                            type="button"
                            onClick={voiceRecorder.cancel}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-[#54656f] hover:bg-[#f0f2f5] dark:text-[#aebac1] dark:hover:bg-[#202c33]"
                            aria-label={isId ? 'Tutup' : 'Close'}
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </div>
                      ) : voiceRecorder.status === 'ready' &&
                        voiceRecorder.recording ? (
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <audio
                              src={voiceRecorder.recording.previewUrl}
                              controls
                              preload="metadata"
                              className="h-10 min-w-[180px] flex-1"
                              aria-label={
                                isId
                                  ? 'Pratinjau pesan suara'
                                  : 'Voice note preview'
                              }
                            />
                            <span className="text-xs font-bold tabular-nums text-[#54656f] dark:text-[#aebac1]">
                              {formatVoiceNoteDuration(
                                voiceRecorder.durationMs,
                              )}
                            </span>
                            <button
                              type="button"
                              onClick={voiceRecorder.cancel}
                              disabled={transcribingVoice}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-rose-50 px-3 text-xs font-bold text-rose-700 disabled:opacity-50 dark:bg-rose-500/15 dark:text-rose-200"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                              {isId ? 'Hapus' : 'Delete'}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                const recording = voiceRecorder.recording;
                                if (!recording) return;
                                void transcribeVoiceNote(recording.file);
                              }}
                              disabled={transcribingVoice}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[color:var(--app-accent)] px-3 text-xs font-bold text-[color:var(--app-text-inverse)] disabled:opacity-60"
                            >
                              {transcribingVoice ? (
                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                              ) : (
                                <FileText className="h-3.5 w-3.5" />
                              )}
                              {transcribingVoice
                                ? isId
                                  ? 'Mengubah...'
                                  : 'Converting...'
                                : isId
                                  ? 'Ubah jadi teks'
                                  : 'Convert to text'}
                            </button>
                          </div>
                          <p className="mt-2 px-1 text-[10px] font-semibold leading-4 text-[#667781] dark:text-[#8696a0]">
                            {isId
                              ? 'Rekaman dapat dikirim ke satu atau lebih penyedia AI yang dikonfigurasi untuk transkripsi. Periksa hasil teks sebelum dikirim dan jangan rekam data rahasia.'
                              : 'The recording may be sent to one or more configured AI providers for transcription. Review the text before sending and do not record confidential data.'}
                          </p>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <span
                            className={cn(
                              'inline-flex h-3 w-3 shrink-0 rounded-full',
                              voiceRecorder.status === 'recording'
                                ? 'animate-pulse bg-rose-500'
                                : 'bg-amber-400',
                            )}
                            aria-hidden="true"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-bold text-[#111b21] dark:text-[#e9edef]">
                              {voiceRecorder.status === 'requesting-permission'
                                ? isId
                                  ? 'Meminta izin mikrofon...'
                                  : 'Requesting microphone access...'
                                : voiceRecorder.status === 'processing'
                                  ? isId
                                    ? 'Menyiapkan rekaman...'
                                    : 'Preparing recording...'
                                  : voiceRecorder.status === 'paused'
                                    ? isId
                                      ? 'Rekaman dijeda'
                                      : 'Recording paused'
                                    : isId
                                      ? 'Merekam pesan suara'
                                      : 'Recording voice note'}
                            </p>
                            <p className="text-[11px] font-semibold tabular-nums text-[#667781] dark:text-[#8696a0]">
                              {formatVoiceNoteDuration(
                                voiceRecorder.durationMs,
                              )}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={voiceRecorder.cancel}
                            className="inline-flex h-11 w-11 items-center justify-center rounded-full text-rose-600 hover:bg-rose-50 dark:text-rose-200 dark:hover:bg-rose-500/15"
                            aria-label={
                              isId ? 'Batalkan rekaman' : 'Cancel recording'
                            }
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                          {voiceRecorder.status === 'recording' ? (
                            <button
                              type="button"
                              onClick={voiceRecorder.pause}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f0f2f5] text-[#54656f] dark:bg-[#202c33] dark:text-[#aebac1]"
                              aria-label={
                                isId ? 'Jeda rekaman' : 'Pause recording'
                              }
                            >
                              <Pause className="h-4 w-4" />
                            </button>
                          ) : voiceRecorder.status === 'paused' ? (
                            <button
                              type="button"
                              onClick={voiceRecorder.resume}
                              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[#f0f2f5] text-[#54656f] dark:bg-[#202c33] dark:text-[#aebac1]"
                              aria-label={
                                isId ? 'Lanjut merekam' : 'Resume recording'
                              }
                            >
                              <Play className="h-4 w-4" />
                            </button>
                          ) : null}
                          {voiceRecorder.status === 'recording' ||
                          voiceRecorder.status === 'paused' ? (
                            <button
                              type="button"
                              onClick={voiceRecorder.stop}
                              className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[color:var(--app-accent)] px-3 text-xs font-bold text-[color:var(--app-text-inverse)]"
                            >
                              <Check className="h-3.5 w-3.5" />
                              {isId ? 'Selesai' : 'Finish'}
                            </button>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ) : null}
                  <p className="mb-1 px-1 text-[10px] font-semibold leading-4 text-[#667781] dark:text-[#8696a0]">
                    {isId
                      ? 'AI dapat keliru. Jangan bagikan PIN, OTP, kata sandi, atau data rahasia.'
                      : 'AI can be wrong. Do not share PINs, one-time codes, passwords, or confidential data.'}
                  </p>
                  <div className="flex min-w-0 items-end gap-2">
                    <button
                      type="button"
                      onClick={() => setQuickActionsOpen(value => !value)}
                      disabled={sending || selectedAgent?.cache_only}
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-white text-[#54656f] shadow-sm transition hover:bg-[#e9edef] disabled:opacity-50 dark:bg-[#2a3942] dark:text-[#aebac1] dark:hover:bg-[#33444f]"
                      aria-label={
                        isId
                          ? 'Buka bantuan cepat dan lampiran'
                          : 'Open quick help and attachments'
                      }
                      aria-expanded={quickActionsOpen}
                      title={isId ? 'Bantuan cepat' : 'Quick help'}
                    >
                      <Plus
                        className={cn(
                          'h-5 w-5 transition-transform',
                          quickActionsOpen && 'rotate-45',
                        )}
                      />
                    </button>
                    <textarea
                      value={input}
                      onChange={event => {
                        inputRef.current = event.target.value;
                        setInput(event.target.value);
                      }}
                      disabled={!selectedAgent || selectedAgent.cache_only}
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
                      aria-label={
                        isId
                          ? 'Tulis pesan untuk asisten AI'
                          : 'Write a message to the AI assistant'
                      }
                      maxLength={3500}
                      rows={1}
                      onInput={event => {
                        const target = event.currentTarget;
                        target.style.height = 'auto';
                        target.style.height = `${Math.min(target.scrollHeight, 120)}px`;
                      }}
                      className="max-h-[120px] min-h-12 min-w-0 flex-1 resize-none rounded-[18px] border border-transparent bg-white px-3 py-3 text-sm leading-5 text-[#111b21] outline-none transition placeholder:text-[#667781] focus:border-[color:var(--app-accent)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,var(--app-accent)_14%,transparent)] dark:bg-[#2a3942] dark:text-[#e9edef] dark:placeholder:text-[#8696a0]"
                      onKeyDown={event => {
                        const hasFinePointer =
                          typeof window !== 'undefined' &&
                          window.matchMedia('(pointer: fine)').matches;
                        if (
                          event.key === 'Enter' &&
                          !event.shiftKey &&
                          !event.nativeEvent.isComposing &&
                          hasFinePointer
                        ) {
                          event.preventDefault();
                          void sendMessage();
                        }
                      }}
                    />
                    {input.trim() || draftAttachments.length > 0 ? (
                      <button
                        type="button"
                        onClick={() => void sendMessage()}
                        disabled={sending || selectedAgent?.cache_only}
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] shadow-[0_10px_24px_-16px_rgba(15,118,110,0.55)] disabled:opacity-50"
                        aria-label={copy.send}
                      >
                        {sending ? (
                          <Loader2 className="h-5 w-5 animate-spin" />
                        ) : (
                          <Send className="h-5 w-5" />
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setQuickActionsOpen(false);
                          void voiceRecorder.start();
                        }}
                        disabled={
                          sending ||
                          selectedAgent?.cache_only ||
                          transcribingVoice ||
                          !(
                            voiceRecorder.status === 'idle' ||
                            voiceRecorder.status === 'error'
                          )
                        }
                        className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] shadow-[0_10px_24px_-16px_rgba(15,118,110,0.55)] disabled:opacity-50"
                        aria-label={
                          isId ? 'Rekam pesan suara' : 'Record a voice note'
                        }
                        title={
                          isId ? 'Rekam pesan suara' : 'Record a voice note'
                        }
                      >
                        <Mic className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                </div>
                {forwardingMessage ? (
                  <div
                    className="ui-layer-modal fixed inset-0 z-[120] flex items-end justify-center bg-black/45 px-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)] sm:items-center sm:p-6"
                    onMouseDown={event => {
                      if (event.target === event.currentTarget && !forwarding) {
                        setForwardingMessage(null);
                      }
                    }}
                  >
                    <div
                      ref={forwardDialogRef}
                      role="dialog"
                      aria-modal="true"
                      aria-label={isId ? 'Teruskan pesan' : 'Forward message'}
                      tabIndex={-1}
                      className="flex max-h-[min(82dvh,var(--app-visual-viewport-height))] w-full flex-col bg-white shadow-2xl outline-none dark:bg-[#202c33] sm:max-w-md sm:rounded-lg"
                    >
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
                          data-forward-initial-focus
                          onClick={() => setForwardingMessage(null)}
                          disabled={forwarding}
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-black/5 disabled:opacity-50 dark:hover:bg-white/10"
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
              <div className="min-h-0 flex-1 overflow-y-auto p-4 pb-[calc(1rem+var(--app-shell-safe-bottom))]">
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
                                ? 'Cara kerja ini hanya bisa diubah oleh pemilik asisten.'
                                : 'Only the assistant owner can change how it works.'}
                            </div>
                          ) : null}

                          <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-bold">
                                  {isId
                                    ? 'Atur cara AI membantu'
                                    : 'Choose how the AI helps'}
                                </p>
                                <p className="mt-1 max-w-2xl text-xs leading-5 text-[color:var(--app-text-soft)]">
                                  {isId
                                    ? 'Mulai dari contoh siap pakai, lalu sesuaikan pertanyaan yang diajukan dan bentuk jawaban yang diinginkan.'
                                    : 'Start with a ready-made example, then adjust the questions it asks and the answer format you want.'}
                                </p>
                              </div>
                              <button
                                type="button"
                                onClick={() => void saveSettings()}
                                disabled={!canEditSelected || saving}
                                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white disabled:opacity-50"
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

                          <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_260px]">
                            <section className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3">
                              <div className="mb-2 flex items-center justify-between gap-2">
                                <p className="text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                                  {isId ? 'Tahapan' : 'Steps'}
                                </p>
                                <button
                                  type="button"
                                  disabled={!canEditSelected}
                                  onClick={addBuilderStep}
                                  className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] disabled:opacity-50"
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
                                      'min-h-11 rounded-[14px] px-3 py-2 text-left text-xs transition',
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
                                {isId ? 'Instruksi dasar' : 'Base instruction'}
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
                                    {isId ? 'Kanvas tahap' : 'Step canvas'}
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
                                    {isId
                                      ? 'Instruksi tahap'
                                      : 'Step instruction'}
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
                                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-[11px] font-bold text-[color:var(--app-accent)] disabled:opacity-50"
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
                                              className="min-h-11 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)]"
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
                                              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-rose-50 text-rose-600 disabled:opacity-40"
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
                                            {isId
                                              ? 'Kunci variabel'
                                              : 'Variable key'}
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
                                              className="min-h-11 rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 py-1.5 text-xs text-[color:var(--app-text)]"
                                            />
                                          </label>
                                          <label className="grid gap-1 text-[10px] font-bold text-[color:var(--app-text-soft)]">
                                            {isId
                                              ? 'Contoh / bantuan'
                                              : 'Placeholder / help'}
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
                                              className="min-h-11 rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 py-1.5 text-xs text-[color:var(--app-text)]"
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
                                              className="min-h-11 resize-y rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-2 py-1.5 text-xs leading-5 text-[color:var(--app-text)]"
                                              placeholder={
                                                isId
                                                  ? 'Label :: nilai :: konteks tambahan'
                                                  : 'Label :: value :: extra context'
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
                                {isId ? 'Tombol bantuan' : 'Help buttons'}
                              </p>
                              <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                {isId
                                  ? 'Satu tombol per baris: nama tombol :: pesan yang dikirim.'
                                  : 'One button per line: button name :: message to send.'}
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
                                    {isId ? 'Bentuk jawaban' : 'Answer format'}
                                  </p>
                                  <button
                                    type="button"
                                    disabled={!canEditSelected}
                                    onClick={addOutputSection}
                                    className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] disabled:opacity-50"
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
                                            className="min-h-11 min-w-0 flex-1 rounded-[10px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1.5 text-[11px] font-bold text-[color:var(--app-text)]"
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
                                            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-600 disabled:opacity-40"
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
                                            className="min-h-11 rounded-[10px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1.5 text-[10px] font-bold text-[color:var(--app-text-soft)]"
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
                                            className="min-h-11 rounded-[10px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1.5 text-[10px] font-bold text-[color:var(--app-text-soft)]"
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
                                          className="min-h-11 resize-y rounded-[10px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-2 py-1.5 text-[10px] leading-4 text-[color:var(--app-text)]"
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
                                    ? 'Pemrosesan jawaban diatur otomatis oleh gateway Lajukan sesuai kemampuan yang dibutuhkan.'
                                    : 'Answer processing is automatically handled by the Lajukan gateway based on the capabilities required.'}
                                </p>
                              </div>

                              <div className="mt-4 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3">
                                <div className="flex items-start gap-2">
                                  <Bot className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                                  <div>
                                    <p className="text-xs font-bold text-[color:var(--app-text)]">
                                      {isId
                                        ? 'Satu gateway untuk semua kemampuan AI'
                                        : 'One gateway for all AI capabilities'}
                                    </p>
                                    <p className="mt-1 text-[10px] font-medium leading-4 text-[color:var(--app-text-soft)]">
                                      {isId
                                        ? 'Chat, vision, memory, dan konteks asisten dikirim melalui gateway AI Lajukan. Detail provider tidak perlu diatur dari browser dan dapat berubah tanpa mengubah asistenmu.'
                                        : 'Chat, vision, memory, and assistant context go through the Lajukan AI gateway. Provider details are not configured in the browser and may change without changing your assistant.'}
                                    </p>
                                  </div>
                                </div>
                              </div>
                            </section>
                          </div>
                          {canEditSelected ? (
                            <div className="sticky bottom-0 z-10 flex justify-end rounded-[16px] border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_94%,transparent)] p-2 shadow-[0_-12px_28px_-24px_rgba(15,23,42,0.45)] backdrop-blur">
                              <button
                                type="button"
                                onClick={() => void saveSettings()}
                                disabled={saving}
                                className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-xs font-bold text-white disabled:opacity-50"
                              >
                                {saving ? (
                                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                ) : (
                                  <Save className="h-3.5 w-3.5" />
                                )}
                                {copy.save}
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })()
                  : null}

                {activePanel === 'settings' ? (
                  <div className="mx-auto grid max-w-3xl gap-3">
                    {!canEditSelected ? (
                      <div className="rounded-[14px] border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                        {isId
                          ? 'Asisten ini dibagikan kepada Anda. Hanya pemilik yang dapat mengubah pengaturannya.'
                          : 'This assistant was shared with you. Only its owner can change the settings.'}
                      </div>
                    ) : null}
                    <div className="grid gap-3 sm:grid-cols-2">
                      <label className="grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                        {isId ? 'Nama asisten' : 'Assistant name'}
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
                      <details className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 sm:col-span-2">
                        <summary className="min-h-11 cursor-pointer text-xs font-bold text-[color:var(--app-text-soft)]">
                          {isId
                            ? 'Pengaturan jawaban lanjutan'
                            : 'Advanced answer settings'}
                        </summary>
                        <div className="mt-2 grid gap-1 text-xs font-bold text-[color:var(--app-text-soft)]">
                          <span>
                            {isId ? 'Pemrosesan AI' : 'AI processing'}
                          </span>
                          <div className="rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-3">
                            <div className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
                              <Sparkles className="h-4 w-4 text-[color:var(--app-accent)]" />
                              <span>
                                {isId
                                  ? 'Lajukan AI — otomatis'
                                  : 'Lajukan AI — automatic'}
                              </span>
                            </div>
                            <p className="mt-1 text-[11px] font-medium leading-5 text-[color:var(--app-text-soft)]">
                              {isId
                                ? 'Lajukan memilih model dan kemampuan yang sesuai di server berdasarkan pesan, gambar, dan kebutuhan asisten. Kamu cukup mengatur instruksi, gaya, kreativitas, memory, dan format output.'
                                : 'Lajukan selects the appropriate model and capabilities on the server based on the message, image, and assistant needs. You only configure instructions, style, creativity, memory, and output format.'}
                            </p>
                          </div>
                        </div>
                      </details>
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
                      {isId
                        ? 'Cara asisten menjawab'
                        : 'How the assistant should answer'}
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
                      {isId ? 'Tombol bantuan' : 'Help buttons'}
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
                      {isId
                        ? 'Contoh pertanyaan awal'
                        : 'Suggested first questions'}
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
                      <label className="inline-flex min-h-11 items-center gap-2 text-xs font-bold">
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
                          className="h-5 w-5"
                        />
                        <span>
                          <span className="block">{copy.memory}</span>
                          <span className="mt-0.5 block text-[10px] font-semibold leading-4 text-[color:var(--app-text-soft)]">
                            {isId
                              ? 'Jika aktif, ringkasan percakapan dipakai untuk chat berikutnya.'
                              : 'When enabled, conversation summaries are used in future chats.'}
                          </span>
                        </span>
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
                                'min-h-11 rounded-full px-3 py-2 text-[11px] font-bold',
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
                        ? 'Hanya saya: tidak dibagikan. Dengan tautan: dapat dibuka penerima tautan yang masuk ke Lajukan. Publik: link dapat dibagikan, tetapi direktori publik belum tersedia.'
                        : 'Only me: not shared. Anyone with the link: accessible to signed-in link recipients. Public: the link can be shared, but public discovery is not available yet.'}
                    </p>
                    {canEditSelected ? (
                      <div className="flex flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void saveSettings()}
                          disabled={saving}
                          className="inline-flex min-h-11 items-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-sm font-bold text-white disabled:opacity-60"
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
                          className="inline-flex min-h-11 items-center gap-2 rounded-full border border-rose-200 px-4 text-sm font-bold text-rose-600"
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
                            ? 'Asisten ini hanya dapat dibuka oleh Anda.'
                            : 'This assistant can only be opened by you.'
                          : normalizeUiVisibility(
                                selectedAgent?.visibility || 'private',
                              ) === 'public'
                            ? isId
                              ? 'Link asisten ini dapat dibagikan. Direktori asisten publik belum tersedia.'
                              : 'This assistant link can be shared. Public assistant discovery is not available yet.'
                            : isId
                              ? 'Asisten ini hanya dapat dibuka oleh pengguna yang menerima tautannya.'
                              : 'This assistant can only be opened by people who receive its link.'}
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
                          className="min-h-11 min-w-0 flex-1 rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2 text-xs"
                        />
                        <button
                          type="button"
                          onClick={() => void copyShareLink()}
                          disabled={
                            normalizeUiVisibility(
                              selectedAgent?.visibility || 'private',
                            ) === 'private'
                          }
                          className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[color:var(--app-accent)] text-white disabled:opacity-40"
                          aria-label={isId ? 'Salin tautan' : 'Copy link'}
                        >
                          <Copy className="h-4 w-4" />
                        </button>
                      </div>
                      {canEditSelected &&
                      normalizeUiVisibility(
                        selectedAgent?.visibility || 'private',
                      ) !== 'private' ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          <button
                            type="button"
                            onClick={() => void changeShareLink('rotate')}
                            disabled={savingShare}
                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-[color:var(--app-border)] px-4 text-xs font-bold disabled:opacity-50"
                          >
                            {savingShare ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <RefreshCcw className="h-4 w-4" />
                            )}
                            {isId ? 'Ganti tautan' : 'Replace link'}
                          </button>
                          <button
                            type="button"
                            onClick={() => void changeShareLink('revoke')}
                            disabled={savingShare}
                            className="inline-flex min-h-11 items-center gap-2 rounded-full border border-rose-200 px-4 text-xs font-bold text-rose-600 disabled:opacity-50 dark:border-rose-900 dark:text-rose-300"
                          >
                            <Lock className="h-4 w-4" />
                            {isId ? 'Cabut akses' : 'Revoke access'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                ) : null}

                {activePanel === 'memory' ? (
                  <div className="mx-auto grid max-w-2xl gap-3">
                    <div className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
                      <p className="text-sm font-bold">{copy.memory}</p>
                      {selectedAgent?.can_edit ? (
                        <>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                            {selectedAgent?.cache_only
                              ? isId
                                ? 'Status ingatan sedang disinkronkan. Snapshot perangkat tidak menyimpan pengaturan ingatan.'
                                : 'Memory status is syncing. The device snapshot does not retain memory settings.'
                              : selectedAgent?.memory_enabled
                                ? isId
                                  ? 'Ingatan aktif untuk percakapan Anda sendiri. Penerima tautan tetap harus memberi izin untuk akun mereka masing-masing.'
                                  : 'Memory is on for your own conversations. Link recipients must still opt in separately for their accounts.'
                                : isId
                                  ? 'Ingatan untuk percakapan Anda dimatikan di pengaturan asisten ini.'
                                  : 'Memory for your conversations is disabled in this assistant’s settings.'}
                          </p>
                          <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                            {isId
                              ? 'Pesan terbaru di chat ini'
                              : 'Recent messages in this chat'}
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
                        </>
                      ) : loadingViewerMemory ? (
                        <div className="mt-3 inline-flex min-h-11 items-center gap-2 text-sm text-[color:var(--app-text-soft)]">
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {isId
                            ? 'Memuat pengaturan...'
                            : 'Loading settings...'}
                        </div>
                      ) : (
                        <>
                          <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
                            {isId
                              ? 'Default-nya mati. Jika diaktifkan, Lajukan menyimpan ringkasan percakapan Anda dengan asisten ini untuk membantu jawaban berikutnya. Pembuat asisten tidak dapat mengaktifkannya untuk Anda.'
                              : 'It is off by default. If enabled, Lajukan stores a summary of your conversations with this assistant to help future answers. The assistant creator cannot enable it for you.'}
                          </p>
                          <label className="mt-4 flex min-h-12 items-center justify-between gap-3 rounded-[14px] bg-[color:var(--app-surface-muted)] px-3 py-2">
                            <span className="text-sm font-bold">
                              {isId
                                ? 'Izinkan ingatan untuk akun saya'
                                : 'Allow memory for my account'}
                            </span>
                            <input
                              type="checkbox"
                              checked={viewerMemory.enabled}
                              disabled={
                                savingViewerMemory ||
                                !viewerMemory.can_manage_recipient_consent
                              }
                              onChange={event =>
                                void changeViewerMemory(event.target.checked)
                              }
                              className="h-5 w-5 accent-[color:var(--app-accent)]"
                            />
                          </label>
                          {viewerMemory.memory?.summary ? (
                            <div className="mt-4 rounded-[14px] border border-[color:var(--app-border)] p-3">
                              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--app-text-soft)]">
                                {isId ? 'Yang tersimpan' : 'Saved summary'}
                              </p>
                              <p className="mt-2 whitespace-pre-wrap text-sm leading-6">
                                {viewerMemory.memory.summary}
                              </p>
                            </div>
                          ) : (
                            <p className="mt-3 text-xs text-[color:var(--app-text-soft)]">
                              {isId
                                ? 'Belum ada ringkasan yang tersimpan untuk akun Anda.'
                                : 'There is no saved summary for your account yet.'}
                            </p>
                          )}
                          <button
                            type="button"
                            onClick={() => void removeViewerMemory()}
                            disabled={
                              savingViewerMemory ||
                              !viewerMemory.can_manage_recipient_consent ||
                              (!viewerMemory.enabled && !viewerMemory.memory)
                            }
                            className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-full border border-rose-200 px-4 text-xs font-bold text-rose-600 disabled:opacity-40 dark:border-rose-900 dark:text-rose-300"
                          >
                            {savingViewerMemory ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                            {isId ? 'Hapus ingatan saya' : 'Delete my memory'}
                          </button>
                        </>
                      )}
                    </div>
                    <div className="rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-4">
                      <p className="text-sm font-bold">
                        {isId
                          ? 'Penyimpanan di perangkat'
                          : 'On-device storage'}
                      </p>
                      <p className="mt-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Cache browser dibatasi dan hanya mempercepat pembukaan. Cache bukan riwayat kanonis dan bukan ingatan AI.'
                          : 'The bounded browser cache only speeds up opening. It is neither canonical history nor AI memory.'}
                      </p>
                      <button
                        type="button"
                        onClick={() => void clearLocalPersonalAiData()}
                        className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-full border border-rose-200 px-4 text-xs font-bold text-rose-600 transition hover:bg-rose-50 dark:border-rose-900 dark:text-rose-300 dark:hover:bg-rose-500/10"
                      >
                        <Trash2 className="h-4 w-4" />
                        {isId ? 'Hapus data AI lokal' : 'Clear local AI data'}
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            ) : null}
          </section>

          <aside className="hidden h-full min-h-0 w-[320px] shrink-0 overflow-y-auto border-l border-black/5 bg-white p-3 dark:border-white/6 dark:bg-[#111b21] 2xl:block">
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
                  (isId
                    ? 'Asisten AI untuk membantu kebutuhan usaha.'
                    : 'An AI assistant for everyday business needs.')}
              </p>
              <p className="mt-2 inline-flex rounded-full bg-[color:var(--app-surface-muted)] px-2 py-1 text-[10px] font-bold text-[color:var(--app-text-soft)]">
                {visibilityLabel(selectedAgent?.visibility, isId)}
              </p>
              <div className="mt-3 grid grid-cols-2 gap-2 text-center text-[11px] font-bold">
                <div className="rounded-[12px] bg-[color:var(--app-surface-muted)] px-2 py-2">
                  {threads.length} {isId ? 'chat' : 'chats'}
                </div>
                <div className="rounded-[12px] bg-[color:var(--app-surface-muted)] px-2 py-2">
                  {selectedAgent?.usage_count || 0}{' '}
                  {isId ? 'pemakaian' : 'uses'}
                </div>
              </div>
            </div>

            {notice ? (
              <div
                className="mt-3 flex items-center gap-2 rounded-[14px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700"
                role="status"
              >
                <Check className="h-4 w-4" />
                {notice}
                <button
                  type="button"
                  onClick={() => setNotice('')}
                  className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-emerald-100"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : null}
            {error ? (
              <div
                className="mt-3 flex items-center gap-2 rounded-[14px] border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                role="alert"
              >
                {error}
                <button
                  type="button"
                  onClick={() => setError('')}
                  className="ml-auto inline-flex h-11 w-11 items-center justify-center rounded-full hover:bg-rose-100"
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
