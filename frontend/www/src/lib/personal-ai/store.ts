import crypto from 'crypto';
import { mkdir, readFile, rename, unlink, writeFile } from 'fs/promises';
import path from 'path';
import { getPostgresPool } from '@/lib/postgres';
import {
  createDefaultPersonalAiBuilderConfig,
  sanitizePersonalAiBuilderConfig,
  type PersonalAiBuilderConfig,
} from './builder';

export type PersonalAiVisibility = 'private' | 'unlisted' | 'public' | 'shared';
export type PersonalAiModelPreference = 'auto' | 'ollama' | 'groq' | 'openai';

export type PersonalAiQuickButton = {
  id: string;
  label: string;
  prompt: string;
  instructionAppend?: string;
  negativeInstruction?: string;
};

export type PersonalAiAgent = {
  id: string;
  owner_id: string;
  name: string;
  description: string;
  visibility: PersonalAiVisibility;
  instructions: string;
  tone: string;
  model_preference: PersonalAiModelPreference;
  temperature: number;
  quick_buttons: PersonalAiQuickButton[];
  starter_prompts: string[];
  builder_config: PersonalAiBuilderConfig;
  memory_enabled: boolean;
  share_id: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
  can_edit?: boolean;
};

export type PersonalAiSharedQuickButton = Pick<
  PersonalAiQuickButton,
  'id' | 'label' | 'prompt'
>;

/**
 * The only agent fields that may cross the API boundary for a non-owner.
 *
 * Keep this deliberately separate from PersonalAiAgent: the internal record
 * contains the owner's prompt, builder/model configuration, memory settings,
 * private owner/action identifiers, and usage metadata needed by the
 * server-side runtime.
 */
export type PersonalAiSharedAgent = Pick<
  PersonalAiAgent,
  'id' | 'name' | 'description' | 'visibility' | 'share_id' | 'starter_prompts'
> & {
  quick_buttons: PersonalAiSharedQuickButton[];
  can_edit: false;
};

export type PersonalAiThread = {
  id: string;
  agent_id: string;
  owner_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type PersonalAiMessage = {
  id: string;
  thread_id: string;
  agent_id: string;
  owner_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type PersonalAiMemory = {
  agent_id: string;
  owner_id: string;
  summary: string;
  facts: {
    topics: string[];
    user_terms: string[];
    last_messages: string[];
  };
  updated_at: string;
};

export type PersonalAiMemoryPreference = {
  agent_id: string;
  viewer_id: string;
  enabled: boolean;
  created_at: string;
  updated_at: string;
};

type PersonalAiChatRequest = {
  viewer_id: string;
  client_ref: string;
  agent_id: string;
  request_hash: string;
  status: 'processing' | 'completed';
  response?: Record<string, unknown>;
  lease_expires_at: string;
  created_at: string;
  updated_at: string;
};

export type PersonalAiChatRequestClaim =
  | { status: 'claimed' }
  | { status: 'processing' }
  | { status: 'conflict' }
  | { status: 'completed'; response: Record<string, unknown> };

export type PersonalAiStorageMode = 'postgres' | 'file';

export type PersonalAiFileStorePolicy = {
  allowed: boolean;
  directory: string | null;
  reason:
    | 'development_or_test'
    | 'explicit_opt_in'
    | 'production_opt_in_required'
    | 'production_directory_required'
    | 'production_absolute_directory_required'
    | 'temporary_directory_rejected';
};

export class PersonalAiStorageUnavailableError extends Error {
  readonly code = 'PERSONAL_AI_STORAGE_UNAVAILABLE';

  constructor() {
    super('Personal AI storage is unavailable.');
    this.name = 'PersonalAiStorageUnavailableError';
  }
}

export type PersonalAiQuotaResource = 'threads' | 'messages';

/**
 * A write was rejected before any canonical history was removed.
 *
 * API routes expose the stable code/resource/limit fields so clients can
 * distinguish a storage quota from an availability failure without parsing
 * localized copy.
 */
export class PersonalAiQuotaExceededError extends Error {
  readonly code = 'personal_ai_quota_exceeded';

  constructor(
    readonly resource: PersonalAiQuotaResource,
    readonly limit: number,
  ) {
    super(
      resource === 'threads'
        ? `Batas ${limit} chat Profile AI tercapai. Hapus chat secara manual sebelum membuat chat baru.`
        : `Batas ${limit} pesan di chat ini tercapai. Buat chat baru untuk melanjutkan; riwayat lama tidak dihapus otomatis.`,
    );
    this.name = 'PersonalAiQuotaExceededError';
  }
}

type FileState = {
  version: 1;
  agents: PersonalAiAgent[];
  threads: PersonalAiThread[];
  messages: PersonalAiMessage[];
  memories: PersonalAiMemory[];
  memory_preferences: PersonalAiMemoryPreference[];
  chat_requests: PersonalAiChatRequest[];
};

const MAX_AGENTS_PER_USER = 12;
const MAX_THREADS_PER_USER = 80;
const MAX_MESSAGES_PER_THREAD = 80;
const PERSONAL_AI_REQUEST_LEASE_MS = 10 * 60 * 1000;
const PERSONAL_AI_CLIENT_REF_PATTERN = /^[A-Za-z0-9._:-]{12,128}$/;

export function assertPersonalAiQuotaAvailable(input: {
  resource: PersonalAiQuotaResource;
  currentCount: number;
  additionalCount?: number;
}) {
  const limit =
    input.resource === 'threads'
      ? MAX_THREADS_PER_USER
      : MAX_MESSAGES_PER_THREAD;
  const currentCount = Math.max(0, Math.floor(input.currentCount));
  const additionalCount = Math.max(1, Math.floor(input.additionalCount ?? 1));
  if (currentCount + additionalCount > limit) {
    throw new PersonalAiQuotaExceededError(input.resource, limit);
  }
}

function envFlag(value: string | undefined) {
  return /^(1|true|yes|on)$/i.test((value || '').trim());
}

function isTemporaryDirectory(directory: string) {
  const normalized = path.resolve(directory).replace(/\\/g, '/').toLowerCase();
  return (
    normalized === '/tmp' ||
    normalized.startsWith('/tmp/') ||
    /\/(temp|tmp)(\/|$)/.test(normalized)
  );
}

export function resolvePersonalAiFileStorePolicy(
  env: Partial<Record<string, string | undefined>> = process.env,
  cwd = process.cwd(),
): PersonalAiFileStorePolicy {
  const isProduction =
    (env.NODE_ENV || '').trim().toLowerCase() === 'production';
  const explicitOptIn = envFlag(env.PERSONAL_AI_ALLOW_FILE_STORE);
  const configuredDirectory = (env.PERSONAL_AI_STORE_DIR || '').trim();

  if (isProduction && !explicitOptIn) {
    return {
      allowed: false,
      directory: null,
      reason: 'production_opt_in_required',
    };
  }

  if (isProduction && !configuredDirectory) {
    return {
      allowed: false,
      directory: null,
      reason: 'production_directory_required',
    };
  }

  if (isProduction && !path.isAbsolute(configuredDirectory)) {
    return {
      allowed: false,
      directory: null,
      reason: 'production_absolute_directory_required',
    };
  }

  const directory = path.resolve(
    configuredDirectory || path.join(cwd, '../../.runtime/personal-ai'),
  );
  if (isProduction && isTemporaryDirectory(directory)) {
    return {
      allowed: false,
      directory: null,
      reason: 'temporary_directory_rejected',
    };
  }

  return {
    allowed: true,
    directory,
    reason: isProduction ? 'explicit_opt_in' : 'development_or_test',
  };
}

function getFileStorePath() {
  const policy = resolvePersonalAiFileStorePolicy();
  if (!policy.allowed || !policy.directory) {
    throw new PersonalAiStorageUnavailableError();
  }
  return path.join(policy.directory, 'state.json');
}

const DEFAULT_INSTRUCTIONS =
  'Bantu saya mengambil keputusan usaha lokal dengan bahasa sederhana. Jangan mengarang data, harga, supplier, atau janji untung. Kalau belum yakin, tanya balik singkat.';

const DEFAULT_BUTTONS: PersonalAiQuickButton[] = [
  {
    id: 'plan',
    label: 'Buat rencana',
    prompt:
      'Bantu buat rencana langkah praktis dari kondisi saya sekarang. Pisahkan modal, kebutuhan, risiko, dan langkah pertama.',
  },
  {
    id: 'supplier',
    label: 'Cari kebutuhan',
    prompt:
      'Bantu pecah kebutuhan usaha ini menjadi bahan, alat, kemasan, jasa pendukung, dan hal yang perlu dicek.',
  },
  {
    id: 'risk',
    label: 'Cek risiko',
    prompt:
      'Tolong cek risiko keputusan ini. Jangan menakut-nakuti, tapi sebutkan hal yang perlu diverifikasi sebelum bayar atau mulai.',
  },
];

function nowIso() {
  return new Date().toISOString();
}

function id(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

function shareId() {
  return crypto.randomBytes(12).toString('base64url');
}

export function normalizePersonalAiClientRef(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const normalized = value.trim();
  return PERSONAL_AI_CLIENT_REF_PATTERN.test(normalized) ? normalized : null;
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(item => stableJson(item)).join(',')}]`;
  }
  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }
  return JSON.stringify(value) ?? 'null';
}

export function hashPersonalAiChatRequest(value: unknown): string {
  return crypto.createHash('sha256').update(stableJson(value)).digest('hex');
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  // Storage is not an HTML renderer. Preserve legitimate code/comparison text
  // such as `<div>` and `a > b`; escaping belongs at the presentation boundary.
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function cleanVisibility(value: unknown): PersonalAiVisibility {
  if (value === 'public') return 'public';
  if (value === 'unlisted' || value === 'shared') return 'unlisted';
  return 'private';
}

function sharedVisibilitySql() {
  return "visibility IN ('shared', 'unlisted', 'public')";
}

function canUseAgent(row: Record<string, unknown>, userId: string) {
  const ownerId = String(row.owner_id || '');
  const visibility = cleanVisibility(row.visibility);
  return ownerId === userId || visibility === 'public';
}

function cleanModelPreference(value: unknown): PersonalAiModelPreference {
  if (value === 'ollama' || value === 'groq' || value === 'openai')
    return value;
  return 'auto';
}

function cleanTemperature(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0.4;
  return Math.max(0, Math.min(1, Number(parsed.toFixed(2))));
}

function cleanStringList(
  value: unknown,
  limit: number,
  itemMax = 220,
): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = cleanText(item, itemMax);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function cleanButtons(value: unknown): PersonalAiQuickButton[] {
  if (!Array.isArray(value)) return DEFAULT_BUTTONS;
  const buttons: PersonalAiQuickButton[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
    const record = item as Record<string, unknown>;
    const label = cleanText(record.label, 36);
    const prompt = cleanText(record.prompt, 600);
    const instructionAppend = cleanText(
      record.instructionAppend || record.instruction_append,
      1200,
    );
    const negativeInstruction = cleanText(
      record.negativeInstruction || record.negative_instruction,
      700,
    );
    const key = label.toLowerCase();
    if (!label || !prompt || seen.has(key)) continue;
    seen.add(key);
    buttons.push({
      id: cleanText(record.id, 80) || id('btn'),
      label,
      prompt,
      instructionAppend: instructionAppend || undefined,
      negativeInstruction: negativeInstruction || undefined,
    });
    if (buttons.length >= 12) break;
  }
  return buttons.length > 0 ? buttons : DEFAULT_BUTTONS;
}

function normalizeAgent(
  row: Record<string, unknown>,
  canEdit = false,
): PersonalAiAgent {
  return {
    id: String(row.id),
    owner_id: String(row.owner_id),
    name: cleanText(row.name, 80) || 'AI Usaha Saya',
    description: cleanText(row.description, 260),
    visibility: cleanVisibility(row.visibility),
    instructions: cleanText(row.instructions, 4000) || DEFAULT_INSTRUCTIONS,
    tone: cleanText(row.tone, 40) || 'ramah, praktis, tidak bertele-tele',
    model_preference: cleanModelPreference(row.model_preference),
    temperature: cleanTemperature(row.temperature),
    quick_buttons: cleanButtons(row.quick_buttons),
    starter_prompts: cleanStringList(row.starter_prompts, 8),
    builder_config: sanitizePersonalAiBuilderConfig(row.builder_config),
    // Missing/legacy values must fail closed. Memory is opt-in, never opt-out.
    memory_enabled: row.memory_enabled === true,
    share_id: cleanText(row.share_id, 80) || shareId(),
    usage_count: Number(row.usage_count || 0),
    created_at: cleanText(row.created_at, 40) || nowIso(),
    updated_at: cleanText(row.updated_at, 40) || nowIso(),
    can_edit: canEdit,
  };
}

export function resolvePersonalAiQuickButtonAction(input: {
  agent: PersonalAiAgent;
  viewerUserId: string;
  publicButtonId: unknown;
}): { prompt: string; instruction: string } | null {
  const requestedId = cleanText(input.publicButtonId, 80);
  if (!requestedId) return null;

  let button: PersonalAiQuickButton | undefined;
  if (input.agent.owner_id === input.viewerUserId) {
    button = input.agent.quick_buttons.find(item => item.id === requestedId);
  } else {
    const match = /^shared-action-([1-9][0-9]?)$/.exec(requestedId);
    const index = match ? Number(match[1]) - 1 : -1;
    if (index >= 0 && index < 12) button = input.agent.quick_buttons[index];
  }

  if (!button) return null;
  const instruction = [
    cleanText(button.instructionAppend, 1200),
    button.negativeInstruction
      ? `Negative instruction: ${cleanText(button.negativeInstruction, 700)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
  return { prompt: cleanText(button.prompt, 600), instruction };
}

export function resolvePersonalAiQuickButtonInstruction(input: {
  agent: PersonalAiAgent;
  viewerUserId: string;
  publicButtonId: unknown;
}): string {
  return resolvePersonalAiQuickButtonAction(input)?.instruction || '';
}

export function serializePersonalAiAgentForViewer(
  agent: PersonalAiAgent,
  viewerUserId: string,
): PersonalAiAgent | PersonalAiSharedAgent {
  if (agent.owner_id === viewerUserId) return agent;

  if (cleanVisibility(agent.visibility) === 'private') {
    throw new Error('Private AI cannot be serialized for a non-owner.');
  }

  return {
    id: cleanText(agent.id, 120),
    name: cleanText(agent.name, 80) || 'AI Usaha Saya',
    description: cleanText(agent.description, 260),
    visibility: cleanVisibility(agent.visibility),
    share_id: cleanText(agent.share_id, 80),
    starter_prompts: cleanStringList(agent.starter_prompts, 8),
    quick_buttons: agent.quick_buttons
      .map((button, index) => ({
        // The client needs a stable React key, but not the owner's internal
        // button identifier. Derive a response-local public identifier.
        id: `shared-action-${index + 1}`,
        label: cleanText(button.label, 36),
        prompt: cleanText(button.prompt, 600),
      }))
      .filter(button => button.label && button.prompt)
      .slice(0, 12),
    can_edit: false,
  };
}

function normalizeThread(row: Record<string, unknown>): PersonalAiThread {
  return {
    id: String(row.id),
    agent_id: String(row.agent_id),
    owner_id: String(row.owner_id),
    title: cleanText(row.title, 90) || 'Chat baru',
    created_at: cleanText(row.created_at, 40) || nowIso(),
    updated_at: cleanText(row.updated_at, 40) || nowIso(),
  };
}

function safeJsonValue(
  value: unknown,
  depth = 0,
): unknown {
  if (depth > 5) return undefined;
  if (value === null || typeof value === 'boolean') return value;
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === 'string') return cleanText(value, 4_000);
  if (Array.isArray(value)) {
    return value
      .slice(0, 40)
      .map(item => safeJsonValue(item, depth + 1))
      .filter(item => item !== undefined);
  }
  if (!value || typeof value !== 'object') return undefined;

  const output: Record<string, unknown> = {};
  for (const [rawKey, rawValue] of Object.entries(
    value as Record<string, unknown>,
  ).slice(0, 60)) {
    const key = cleanText(rawKey, 80);
    if (!key) continue;
    // Never persist obvious secret-bearing metadata even if a future route
    // accidentally forwards an upstream response object wholesale.
    if (
      /^(authorization|cookie|set-cookie|api[_-]?key|token|access[_-]?token|refresh[_-]?token|secret|password)$/i.test(
        key,
      )
    ) {
      continue;
    }
    const sanitized = safeJsonValue(rawValue, depth + 1);
    if (sanitized !== undefined) output[key] = sanitized;
  }
  return output;
}

function safeJsonObject(value: unknown): Record<string, unknown> {
  const sanitized = safeJsonValue(value);
  return sanitized && typeof sanitized === 'object' && !Array.isArray(sanitized)
    ? (sanitized as Record<string, unknown>)
    : {};
}

export function sanitizePersonalAiMessageMetadata(
  value: unknown,
): Record<string, unknown> {
  const metadata = safeJsonObject(value);

  // This identifier is useful only while authorizing the shared agent on the
  // server. Never persist it in a message or return it with chat history.
  delete metadata.shared_agent_owner_id;

  // Provider failures are logged server-side. Preserve the response shape for
  // existing clients without returning raw upstream errors, URLs, or model
  // endpoint details through chat history.
  if (Object.prototype.hasOwnProperty.call(metadata, 'provider_errors')) {
    metadata.provider_errors =
      Array.isArray(metadata.provider_errors) &&
      metadata.provider_errors.length > 0
        ? ['provider_unavailable']
        : [];
  }
  return metadata;
}

function normalizeMessage(row: Record<string, unknown>): PersonalAiMessage {
  return {
    id: String(row.id),
    thread_id: String(row.thread_id),
    agent_id: String(row.agent_id),
    owner_id: String(row.owner_id),
    role: row.role === 'assistant' || row.role === 'system' ? row.role : 'user',
    content: cleanText(row.content, 12000),
    metadata: sanitizePersonalAiMessageMetadata(row.metadata),
    created_at: cleanText(row.created_at, 40) || nowIso(),
  };
}

export function createDefaultPersonalAiAgent(userId: string): PersonalAiAgent {
  const at = nowIso();
  return {
    id: id('agent'),
    owner_id: userId,
    name: 'AI Usaha Saya',
    description:
      'Asisten pribadi untuk rencana usaha, supplier, modal, risiko, dan langkah harian.',
    visibility: 'private',
    instructions: DEFAULT_INSTRUCTIONS,
    tone: 'ramah, praktis, lokal Indonesia, to the point',
    model_preference: 'auto',
    temperature: 0.4,
    quick_buttons: DEFAULT_BUTTONS,
    starter_prompts: [
      'Saya punya modal Rp3 juta dan ingin mulai usaha makanan ringan.',
      'Bantu cek kebutuhan alat dan bahan untuk minuman cup.',
      'Tolong hitungkan risiko sebelum saya bayar DP supplier ini.',
    ],
    builder_config: createDefaultPersonalAiBuilderConfig(),
    memory_enabled: false,
    share_id: shareId(),
    usage_count: 0,
    created_at: at,
    updated_at: at,
    can_edit: true,
  };
}

async function getPersonalAiPostgresPool() {
  // Schema ownership stays with marketplace_service migrations. Application
  // requests must never need DDL privileges or mutate the database schema.
  return getPostgresPool();
}

function normalizeMemoryRecord(value: unknown): PersonalAiMemory | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const agentId = cleanText(row.agent_id, 160);
  const ownerId = cleanText(row.owner_id, 160);
  if (!agentId || !ownerId) return null;
  const facts = safeJsonObject(row.facts);
  return {
    agent_id: agentId,
    owner_id: ownerId,
    summary: cleanText(row.summary, 1_800),
    facts: {
      topics: cleanStringList(facts.topics, 18, 90),
      user_terms: cleanStringList(facts.user_terms, 8, 120),
      last_messages: cleanStringList(facts.last_messages, 6, 180),
    },
    updated_at: cleanText(row.updated_at, 40) || nowIso(),
  };
}

function normalizeMemoryPreferenceRecord(
  value: unknown,
): PersonalAiMemoryPreference | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const agentId = cleanText(row.agent_id, 160);
  const viewerId = cleanText(row.viewer_id, 160);
  if (!agentId || !viewerId) return null;
  const at = nowIso();
  return {
    agent_id: agentId,
    viewer_id: viewerId,
    enabled: row.enabled === true,
    created_at: cleanText(row.created_at, 40) || at,
    updated_at: cleanText(row.updated_at, 40) || at,
  };
}

function normalizeChatRequestRecord(value: unknown): PersonalAiChatRequest | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const viewerId = cleanText(row.viewer_id, 160);
  const clientRef = normalizePersonalAiClientRef(row.client_ref);
  const agentId = cleanText(row.agent_id, 160);
  const requestHash = cleanText(row.request_hash, 64).toLowerCase();
  if (
    !viewerId ||
    !clientRef ||
    !agentId ||
    !/^[a-f0-9]{64}$/.test(requestHash)
  ) {
    return null;
  }
  const at = nowIso();
  return {
    viewer_id: viewerId,
    client_ref: clientRef,
    agent_id: agentId,
    request_hash: requestHash,
    status: row.status === 'completed' ? 'completed' : 'processing',
    response:
      row.status === 'completed' ? safeJsonObject(row.response) : undefined,
    lease_expires_at: cleanText(row.lease_expires_at, 40) || at,
    created_at: cleanText(row.created_at, 40) || at,
    updated_at: cleanText(row.updated_at, 40) || at,
  };
}

async function readFileState(): Promise<FileState> {
  const filePath = getFileStorePath();
  try {
    const raw = await readFile(filePath, 'utf8');
    const parsed = JSON.parse(raw) as Partial<FileState>;
    return {
      version: 1,
      agents: Array.isArray(parsed.agents)
        ? parsed.agents.map(item =>
            normalizeAgent(item as Record<string, unknown>, false),
          )
        : [],
      threads: Array.isArray(parsed.threads)
        ? parsed.threads.map(item =>
            normalizeThread(item as Record<string, unknown>),
          )
        : [],
      messages: Array.isArray(parsed.messages)
        ? parsed.messages.map(item =>
            normalizeMessage(item as Record<string, unknown>),
          )
        : [],
      memories: Array.isArray(parsed.memories)
        ? parsed.memories
            .map(item => normalizeMemoryRecord(item))
            .filter((item): item is PersonalAiMemory => Boolean(item))
        : [],
      memory_preferences: Array.isArray(parsed.memory_preferences)
        ? parsed.memory_preferences
            .map(item => normalizeMemoryPreferenceRecord(item))
            .filter(
              (item): item is PersonalAiMemoryPreference => Boolean(item),
            )
        : [],
      chat_requests: Array.isArray(parsed.chat_requests)
        ? parsed.chat_requests
            .map(item => normalizeChatRequestRecord(item))
            .filter((item): item is PersonalAiChatRequest => Boolean(item))
        : [],
    };
  } catch (error) {
    if ((error as NodeJS.ErrnoException)?.code === 'ENOENT') {
      return {
        version: 1,
        agents: [],
        threads: [],
        messages: [],
        memories: [],
        memory_preferences: [],
        chat_requests: [],
      };
    }
    throw new PersonalAiStorageUnavailableError();
  }
}

async function writeFileState(state: FileState) {
  const filePath = getFileStorePath();
  const directory = path.dirname(filePath);
  await mkdir(directory, { recursive: true, mode: 0o700 });

  // Write-then-rename prevents a process crash from leaving a half-written
  // canonical state.json. The fallback store is still intended for local/dev;
  // production should use PostgreSQL.
  const temporaryPath = path.join(
    directory,
    `.state.${process.pid}.${crypto.randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
      flag: 'wx',
    });
    await rename(temporaryPath, filePath);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

async function getStorageMode(): Promise<PersonalAiStorageMode> {
  const pool = await getPersonalAiPostgresPool();
  if (pool) return 'postgres';

  const filePolicy = resolvePersonalAiFileStorePolicy();
  if (!filePolicy.allowed) {
    throw new PersonalAiStorageUnavailableError();
  }
  return 'file';
}

export async function assertPersonalAiThreadCapacity(userId: string) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = await pool.query(
        'SELECT COUNT(*)::int AS count FROM personal_ai_threads WHERE owner_id = $1',
        [userId],
      );
      assertPersonalAiQuotaAvailable({
        resource: 'threads',
        currentCount: Number(result.rows[0]?.count || 0),
      });
      return;
    }
  }

  const state = await readFileState();
  assertPersonalAiQuotaAvailable({
    resource: 'threads',
    currentCount: state.threads.filter(thread => thread.owner_id === userId)
      .length,
  });
}

export async function assertPersonalAiMessageCapacity(
  userId: string,
  threadId: string,
  additionalCount = 1,
) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM personal_ai_messages
         WHERE thread_id = $1 AND owner_id = $2`,
        [threadId, userId],
      );
      assertPersonalAiQuotaAvailable({
        resource: 'messages',
        currentCount: Number(result.rows[0]?.count || 0),
        additionalCount,
      });
      return;
    }
  }

  const state = await readFileState();
  assertPersonalAiQuotaAvailable({
    resource: 'messages',
    currentCount: state.messages.filter(
      message => message.thread_id === threadId && message.owner_id === userId,
    ).length,
    additionalCount,
  });
}

async function ensureDefaultAgent(userId: string): Promise<PersonalAiAgent> {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const existing = await pool.query(
        'SELECT * FROM personal_ai_agents WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [userId],
      );
      if (existing.rows[0]) return normalizeAgent(existing.rows[0], true);
      const agent = createDefaultPersonalAiAgent(userId);
      await pool.query(
        `INSERT INTO personal_ai_agents
         (id, owner_id, name, description, visibility, instructions, tone, model_preference,
          temperature, quick_buttons, starter_prompts, builder_config, memory_enabled, share_id, usage_count,
          created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17)`,
        [
          agent.id,
          agent.owner_id,
          agent.name,
          agent.description,
          agent.visibility,
          agent.instructions,
          agent.tone,
          agent.model_preference,
          agent.temperature,
          JSON.stringify(agent.quick_buttons),
          JSON.stringify(agent.starter_prompts),
          JSON.stringify(agent.builder_config),
          agent.memory_enabled,
          agent.share_id,
          agent.usage_count,
          agent.created_at,
          agent.updated_at,
        ],
      );
      return agent;
    }
  }

  const state = await readFileState();
  const existing = state.agents.find(agent => agent.owner_id === userId);
  if (existing) return { ...existing, can_edit: true };
  const agent = createDefaultPersonalAiAgent(userId);
  state.agents.push(agent);
  await writeFileState(state);
  return agent;
}

export async function listPersonalAiAgents(userId: string, share?: string) {
  await ensureDefaultAgent(userId);
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const owned = await pool.query(
        'SELECT * FROM personal_ai_agents WHERE owner_id = $1 ORDER BY updated_at DESC',
        [userId],
      );
      const agents = owned.rows.map((row: Record<string, unknown>) => normalizeAgent(row, true));
      let sharedAgent: PersonalAiAgent | PersonalAiSharedAgent | null = null;
      if (share) {
        const shared = await pool.query(
          `SELECT * FROM personal_ai_agents WHERE share_id = $1 AND ${sharedVisibilitySql()} LIMIT 1`,
          [share],
        );
        if (shared.rows[0]) {
          const internalAgent = normalizeAgent(
            shared.rows[0],
            shared.rows[0].owner_id === userId,
          );
          sharedAgent = serializePersonalAiAgentForViewer(
            internalAgent,
            userId,
          );
        }
      }
      return { agents, shared_agent: sharedAgent, storage: mode };
    }
  }

  const state = await readFileState();
  const agents = state.agents
    .filter(agent => agent.owner_id === userId)
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .map(agent => ({ ...agent, can_edit: true }));
  const shared = share
    ? state.agents.find(
        agent => agent.share_id === share && agent.visibility !== 'private',
      ) || null
    : null;
  return {
    agents,
    shared_agent: shared
      ? serializePersonalAiAgentForViewer(
          { ...shared, can_edit: shared.owner_id === userId },
          userId,
        )
      : null,
    storage: mode,
  };
}

export async function createPersonalAiAgent(
  userId: string,
  input: Partial<PersonalAiAgent>,
) {
  await ensureDefaultAgent(userId);
  const at = nowIso();
  const agent = normalizeAgent(
    {
      id: id('agent'),
      owner_id: userId,
      name: input.name,
      description: input.description,
      visibility: input.visibility,
      instructions: input.instructions,
      tone: input.tone,
      model_preference: input.model_preference,
      temperature: input.temperature,
      quick_buttons: input.quick_buttons,
      starter_prompts: input.starter_prompts,
      builder_config: input.builder_config,
      memory_enabled: input.memory_enabled === true,
      share_id: shareId(),
      usage_count: 0,
      created_at: at,
      updated_at: at,
    },
    true,
  );

  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `personal-ai-agents:${userId}`,
        ]);
        const count = await client.query(
          'SELECT COUNT(*)::int AS count FROM personal_ai_agents WHERE owner_id = $1',
          [userId],
        );
        if (Number(count.rows[0]?.count || 0) >= MAX_AGENTS_PER_USER) {
          throw new Error('Batas AI pribadi tercapai.');
        }
        await client.query(
          `INSERT INTO personal_ai_agents
           (id, owner_id, name, description, visibility, instructions, tone, model_preference,
            temperature, quick_buttons, starter_prompts, builder_config, memory_enabled, share_id, usage_count,
            created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12::jsonb,$13,$14,$15,$16,$17)`,
          [
            agent.id,
            agent.owner_id,
            agent.name,
            agent.description,
            agent.visibility,
            agent.instructions,
            agent.tone,
            agent.model_preference,
            agent.temperature,
            JSON.stringify(agent.quick_buttons),
            JSON.stringify(agent.starter_prompts),
            JSON.stringify(agent.builder_config),
            agent.memory_enabled,
            agent.share_id,
            agent.usage_count,
            agent.created_at,
            agent.updated_at,
          ],
        );
        await client.query('COMMIT');
        return agent;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  }

  const state = await readFileState();
  if (
    state.agents.filter(item => item.owner_id === userId).length >=
    MAX_AGENTS_PER_USER
  ) {
    throw new Error('Batas AI pribadi tercapai.');
  }
  state.agents.push(agent);
  await writeFileState(state);
  return agent;
}

export async function getPersonalAiAgentForUse(input: {
  userId: string;
  agentId?: string;
  shareId?: string;
}) {
  await ensureDefaultAgent(input.userId);
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = input.shareId
        ? await pool.query(
            `SELECT * FROM personal_ai_agents WHERE share_id = $1 AND ${sharedVisibilitySql()} LIMIT 1`,
            [input.shareId],
          )
        : await pool.query(
            "SELECT * FROM personal_ai_agents WHERE id = $1 AND (owner_id = $2 OR visibility = 'public') LIMIT 1",
            [input.agentId, input.userId],
          );
      const row = result.rows[0];
      return row && (input.shareId || canUseAgent(row, input.userId))
        ? normalizeAgent(row, row.owner_id === input.userId)
        : null;
    }
  }

  const state = await readFileState();
  const agent = input.shareId
    ? state.agents.find(
        item =>
          item.share_id === input.shareId && item.visibility !== 'private',
      )
    : state.agents.find(
        item =>
          item.id === input.agentId &&
          (item.owner_id === input.userId || item.visibility === 'public'),
      );
  return agent ? { ...agent, can_edit: agent.owner_id === input.userId } : null;
}

export async function updatePersonalAiAgent(
  userId: string,
  agentId: string,
  input: Partial<PersonalAiAgent>,
) {
  const current = await getPersonalAiAgentForUse({ userId, agentId });
  if (!current || current.owner_id !== userId) return null;
  const updated = normalizeAgent(
    {
      ...current,
      ...input,
      owner_id: userId,
      id: agentId,
      share_id: current.share_id,
      usage_count: current.usage_count,
      updated_at: nowIso(),
    },
    true,
  );

  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      await pool.query(
        `UPDATE personal_ai_agents
         SET name=$3, description=$4, visibility=$5, instructions=$6, tone=$7,
             model_preference=$8, temperature=$9, quick_buttons=$10::jsonb,
             starter_prompts=$11::jsonb, builder_config=$12::jsonb,
             memory_enabled=$13, updated_at=$14
         WHERE id=$1 AND owner_id=$2`,
        [
          agentId,
          userId,
          updated.name,
          updated.description,
          updated.visibility,
          updated.instructions,
          updated.tone,
          updated.model_preference,
          updated.temperature,
          JSON.stringify(updated.quick_buttons),
          JSON.stringify(updated.starter_prompts),
          JSON.stringify(updated.builder_config),
          updated.memory_enabled,
          updated.updated_at,
        ],
      );
      return updated;
    }
  }

  const state = await readFileState();
  state.agents = state.agents.map(agent =>
    agent.id === agentId && agent.owner_id === userId ? updated : agent,
  );
  await writeFileState(state);
  return updated;
}

export async function rotatePersonalAiShare(input: {
  userId: string;
  agentId: string;
  revoke?: boolean;
}) {
  const current = await getPersonalAiAgentForUse({
    userId: input.userId,
    agentId: input.agentId,
  });
  if (!current || current.owner_id !== input.userId) return null;

  const nextShareId = shareId();
  const nextVisibility: PersonalAiVisibility = input.revoke
    ? 'private'
    : current.visibility;
  const at = nowIso();
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = await pool.query(
        `UPDATE personal_ai_agents
         SET share_id = $3, visibility = $4, updated_at = $5
         WHERE id = $1 AND owner_id = $2
         RETURNING *`,
        [input.agentId, input.userId, nextShareId, nextVisibility, at],
      );
      return result.rows[0] ? normalizeAgent(result.rows[0], true) : null;
    }
  }

  const state = await readFileState();
  let updated: PersonalAiAgent | null = null;
  state.agents = state.agents.map(agent => {
    if (agent.id !== input.agentId || agent.owner_id !== input.userId) {
      return agent;
    }
    updated = {
      ...agent,
      share_id: nextShareId,
      visibility: nextVisibility,
      updated_at: at,
      can_edit: true,
    };
    return updated;
  });
  await writeFileState(state);
  return updated;
}

export async function deletePersonalAiAgent(userId: string, agentId: string) {
  const current = await getPersonalAiAgentForUse({ userId, agentId });
  if (!current || current.owner_id !== userId) return false;
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `personal-ai-agents:${userId}`,
        ]);
        const count = await client.query(
          'SELECT COUNT(*)::int AS count FROM personal_ai_agents WHERE owner_id = $1',
          [userId],
        );
        if (Number(count.rows[0]?.count || 0) <= 1) {
          await client.query('ROLLBACK');
          return false;
        }
        const deleted = await client.query(
          'DELETE FROM personal_ai_agents WHERE id = $1 AND owner_id = $2 RETURNING id',
          [agentId, userId],
        );
        await client.query('COMMIT');
        return Boolean(deleted.rows[0]);
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  }

  const state = await readFileState();
  if (state.agents.filter(agent => agent.owner_id === userId).length <= 1)
    return false;
  state.agents = state.agents.filter(
    agent => !(agent.id === agentId && agent.owner_id === userId),
  );
  state.threads = state.threads.filter(thread => thread.agent_id !== agentId);
  state.messages = state.messages.filter(
    message => message.agent_id !== agentId,
  );
  state.memories = state.memories.filter(memory => memory.agent_id !== agentId);
  state.memory_preferences = state.memory_preferences.filter(
    preference => preference.agent_id !== agentId,
  );
  state.chat_requests = state.chat_requests.filter(
    request => request.agent_id !== agentId,
  );
  await writeFileState(state);
  return true;
}

export async function listPersonalAiThreads(userId: string, agentId?: string) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = agentId
        ? await pool.query(
            'SELECT * FROM personal_ai_threads WHERE owner_id = $1 AND agent_id = $2 ORDER BY updated_at DESC LIMIT 80',
            [userId, agentId],
          )
        : await pool.query(
            'SELECT * FROM personal_ai_threads WHERE owner_id = $1 ORDER BY updated_at DESC LIMIT 80',
            [userId],
          );
      return result.rows.map((row: Record<string, unknown>) => normalizeThread(row));
    }
  }

  const state = await readFileState();
  return state.threads
    .filter(
      thread =>
        thread.owner_id === userId && (!agentId || thread.agent_id === agentId),
    )
    .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
    .slice(0, 80);
}

export async function createPersonalAiThread(
  userId: string,
  agentId: string,
  title = 'Chat baru',
) {
  const at = nowIso();
  const thread = normalizeThread({
    id: id('thread'),
    agent_id: agentId,
    owner_id: userId,
    title,
    created_at: at,
    updated_at: at,
  });

  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `personal-ai-threads:${userId}`,
        ]);
        const count = await client.query(
          'SELECT COUNT(*)::int AS count FROM personal_ai_threads WHERE owner_id = $1',
          [userId],
        );
        assertPersonalAiQuotaAvailable({
          resource: 'threads',
          currentCount: Number(count.rows[0]?.count || 0),
        });
        await client.query(
          `INSERT INTO personal_ai_threads (id, agent_id, owner_id, title, created_at, updated_at)
           VALUES ($1,$2,$3,$4,$5,$6)`,
          [
            thread.id,
            thread.agent_id,
            thread.owner_id,
            thread.title,
            thread.created_at,
            thread.updated_at,
          ],
        );
        await client.query('COMMIT');
        return thread;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  }

  const state = await readFileState();
  const ownedThreads = state.threads.filter(item => item.owner_id === userId);
  assertPersonalAiQuotaAvailable({
    resource: 'threads',
    currentCount: ownedThreads.length,
  });
  state.threads.push(thread);
  await writeFileState(state);
  return thread;
}

export async function getPersonalAiThreadWithMessages(
  userId: string,
  threadId: string,
) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const threadResult = await pool.query(
        'SELECT * FROM personal_ai_threads WHERE id = $1 AND owner_id = $2 LIMIT 1',
        [threadId, userId],
      );
      if (!threadResult.rows[0]) return null;
      const messageResult = await pool.query(
        'SELECT * FROM personal_ai_messages WHERE thread_id = $1 AND owner_id = $2 ORDER BY created_at ASC LIMIT 160',
        [threadId, userId],
      );
      return {
        thread: normalizeThread(threadResult.rows[0]),
        messages: messageResult.rows.map((row: Record<string, unknown>) => normalizeMessage(row)),
      };
    }
  }

  const state = await readFileState();
  const thread = state.threads.find(
    item => item.id === threadId && item.owner_id === userId,
  );
  if (!thread) return null;
  return {
    thread,
    messages: state.messages
      .filter(item => item.thread_id === threadId && item.owner_id === userId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

export async function renamePersonalAiThread(
  userId: string,
  threadId: string,
  title: string,
) {
  const cleanTitle = cleanText(title, 90) || 'Chat baru';
  const at = nowIso();
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = await pool.query(
        `UPDATE personal_ai_threads
         SET title = $3, updated_at = $4
         WHERE id = $1 AND owner_id = $2
         RETURNING *`,
        [threadId, userId, cleanTitle, at],
      );
      return result.rows[0] ? normalizeThread(result.rows[0]) : null;
    }
  }

  const state = await readFileState();
  let updated: PersonalAiThread | null = null;
  state.threads = state.threads.map(thread => {
    if (thread.id !== threadId || thread.owner_id !== userId) return thread;
    updated = { ...thread, title: cleanTitle, updated_at: at };
    return updated;
  });
  await writeFileState(state);
  return updated;
}

export async function deletePersonalAiThread(userId: string, threadId: string) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      await pool.query(
        'DELETE FROM personal_ai_threads WHERE id = $1 AND owner_id = $2',
        [threadId, userId],
      );
      return true;
    }
  }

  const state = await readFileState();
  state.threads = state.threads.filter(
    thread => !(thread.id === threadId && thread.owner_id === userId),
  );
  state.messages = state.messages.filter(
    message => !(message.thread_id === threadId && message.owner_id === userId),
  );
  await writeFileState(state);
  return true;
}

export async function claimPersonalAiChatRequest(input: {
  userId: string;
  clientRef: string;
  agentId: string;
  requestHash: string;
}): Promise<PersonalAiChatRequestClaim> {
  const clientRef = normalizePersonalAiClientRef(input.clientRef);
  if (!clientRef || !/^[a-f0-9]{64}$/.test(input.requestHash)) {
    return { status: 'conflict' };
  }

  const at = nowIso();
  const leaseExpiresAt = new Date(
    Date.now() + PERSONAL_AI_REQUEST_LEASE_MS,
  ).toISOString();
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const inserted = await pool.query(
        `INSERT INTO personal_ai_chat_requests
         (viewer_id, client_ref, agent_id, request_hash, status, lease_expires_at, created_at, updated_at)
         VALUES ($1,$2,$3,$4,'processing',$5,$6,$6)
         ON CONFLICT (viewer_id, client_ref) DO NOTHING
         RETURNING client_ref`,
        [
          input.userId,
          clientRef,
          input.agentId,
          input.requestHash,
          leaseExpiresAt,
          at,
        ],
      );
      if (inserted.rows[0]) return { status: 'claimed' };

      const existingResult = await pool.query(
        `SELECT request_hash, status, response, lease_expires_at
         FROM personal_ai_chat_requests
         WHERE viewer_id = $1 AND client_ref = $2
         LIMIT 1`,
        [input.userId, clientRef],
      );
      const existing = existingResult.rows[0] as
        | Record<string, unknown>
        | undefined;
      if (!existing || existing.request_hash !== input.requestHash) {
        return { status: 'conflict' };
      }
      if (existing.status === 'completed') {
        const response = existing.response;
        return {
          status: 'completed',
          response:
            response && typeof response === 'object' && !Array.isArray(response)
              ? (response as Record<string, unknown>)
              : {},
        };
      }

      const reclaimed = await pool.query(
        `UPDATE personal_ai_chat_requests
         SET agent_id = $3, lease_expires_at = $5, updated_at = $6
         WHERE viewer_id = $1 AND client_ref = $2
           AND request_hash = $4
           AND status = 'processing'
           AND lease_expires_at <= NOW()
         RETURNING client_ref`,
        [
          input.userId,
          clientRef,
          input.agentId,
          input.requestHash,
          leaseExpiresAt,
          at,
        ],
      );
      return reclaimed.rows[0]
        ? { status: 'claimed' }
        : { status: 'processing' };
    }
  }

  const state = await readFileState();
  const existingIndex = state.chat_requests.findIndex(
    request =>
      request.viewer_id === input.userId && request.client_ref === clientRef,
  );
  if (existingIndex < 0) {
    state.chat_requests.push({
      viewer_id: input.userId,
      client_ref: clientRef,
      agent_id: input.agentId,
      request_hash: input.requestHash,
      status: 'processing',
      lease_expires_at: leaseExpiresAt,
      created_at: at,
      updated_at: at,
    });
    await writeFileState(state);
    return { status: 'claimed' };
  }

  const existing = state.chat_requests[existingIndex]!;
  if (existing.request_hash !== input.requestHash)
    return { status: 'conflict' };
  if (existing.status === 'completed') {
    return { status: 'completed', response: existing.response || {} };
  }
  if (Date.parse(existing.lease_expires_at) > Date.now()) {
    return { status: 'processing' };
  }
  state.chat_requests[existingIndex] = {
    ...existing,
    agent_id: input.agentId,
    lease_expires_at: leaseExpiresAt,
    updated_at: at,
  };
  await writeFileState(state);
  return { status: 'claimed' };
}

export async function completePersonalAiChatRequest(input: {
  userId: string;
  clientRef: string;
  requestHash: string;
  response: Record<string, unknown>;
}) {
  const clientRef = normalizePersonalAiClientRef(input.clientRef);
  if (!clientRef) return false;
  const safeResponse = safeJsonObject(input.response);
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = await pool.query(
        `UPDATE personal_ai_chat_requests
         SET status = 'completed', response = $4::jsonb,
             lease_expires_at = NOW(), updated_at = NOW()
         WHERE viewer_id = $1 AND client_ref = $2 AND request_hash = $3
         RETURNING client_ref`,
        [
          input.userId,
          clientRef,
          input.requestHash,
          JSON.stringify(safeResponse),
        ],
      );
      return Boolean(result.rows[0]);
    }
  }

  const state = await readFileState();
  let completed = false;
  state.chat_requests = state.chat_requests.map(request => {
    if (
      request.viewer_id !== input.userId ||
      request.client_ref !== clientRef ||
      request.request_hash !== input.requestHash
    ) {
      return request;
    }
    completed = true;
    return {
      ...request,
      status: 'completed',
      response: safeResponse,
      lease_expires_at: nowIso(),
      updated_at: nowIso(),
    };
  });
  if (completed) await writeFileState(state);
  return completed;
}

/**
 * Releases only the still-processing claim owned by this exact request.
 * This is used when a quota race rejects a write after the preflight check, so
 * a safe retry is not stranded behind the processing lease.
 */
export async function releasePersonalAiChatRequest(input: {
  userId: string;
  clientRef: string;
  requestHash: string;
}) {
  const clientRef = normalizePersonalAiClientRef(input.clientRef);
  if (!clientRef || !/^[a-f0-9]{64}$/.test(input.requestHash)) return false;

  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = await pool.query(
        `DELETE FROM personal_ai_chat_requests
         WHERE viewer_id = $1 AND client_ref = $2 AND request_hash = $3
           AND status = 'processing'
         RETURNING client_ref`,
        [input.userId, clientRef, input.requestHash],
      );
      return Boolean(result.rows[0]);
    }
  }

  const state = await readFileState();
  const previousLength = state.chat_requests.length;
  state.chat_requests = state.chat_requests.filter(
    request =>
      request.viewer_id !== input.userId ||
      request.client_ref !== clientRef ||
      request.request_hash !== input.requestHash ||
      request.status !== 'processing',
  );
  const released = state.chat_requests.length !== previousLength;
  if (released) await writeFileState(state);
  return released;
}

export async function appendPersonalAiMessages(input: {
  userId: string;
  agentId: string;
  threadId: string;
  userContent: string;
  assistantContent: string;
  userMetadata?: Record<string, unknown>;
  metadata: Record<string, unknown>;
  requestCompletion?: {
    clientRef: string;
    requestHash: string;
    buildResponse: (messages: {
      userMessage: PersonalAiMessage;
      assistantMessage: PersonalAiMessage;
    }) => Record<string, unknown>;
  };
}) {
  const at = nowIso();
  const userMessage = normalizeMessage({
    id: id('msg'),
    thread_id: input.threadId,
    agent_id: input.agentId,
    owner_id: input.userId,
    role: 'user',
    content: input.userContent,
    metadata: input.userMetadata || {},
    created_at: at,
  });
  const assistantMessage = normalizeMessage({
    id: id('msg'),
    thread_id: input.threadId,
    agent_id: input.agentId,
    owner_id: input.userId,
    role: 'assistant',
    content: input.assistantContent,
    metadata: input.metadata,
    created_at: nowIso(),
  });
  const completedResponse = input.requestCompletion
    ? safeJsonObject(
        input.requestCompletion.buildResponse({
          userMessage,
          assistantMessage,
        }),
      )
    : undefined;

  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `personal-ai-messages:${input.userId}:${input.threadId}`,
        ]);
        const count = await client.query(
          `SELECT COUNT(*)::int AS count
           FROM personal_ai_messages
           WHERE thread_id = $1 AND owner_id = $2`,
          [input.threadId, input.userId],
        );
        assertPersonalAiQuotaAvailable({
          resource: 'messages',
          currentCount: Number(count.rows[0]?.count || 0),
          additionalCount: 2,
        });
        await client.query(
          `INSERT INTO personal_ai_messages
           (id, thread_id, agent_id, owner_id, role, content, metadata, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8), ($9,$10,$11,$12,$13,$14,$15::jsonb,$16)`,
          [
            userMessage.id,
            userMessage.thread_id,
            userMessage.agent_id,
            userMessage.owner_id,
            userMessage.role,
            userMessage.content,
            JSON.stringify(userMessage.metadata),
            userMessage.created_at,
            assistantMessage.id,
            assistantMessage.thread_id,
            assistantMessage.agent_id,
            assistantMessage.owner_id,
            assistantMessage.role,
            assistantMessage.content,
            JSON.stringify(assistantMessage.metadata),
            assistantMessage.created_at,
          ],
        );
        await client.query(
          'UPDATE personal_ai_threads SET updated_at = NOW() WHERE id = $1 AND owner_id = $2',
          [input.threadId, input.userId],
        );
        await client.query(
          'UPDATE personal_ai_agents SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1',
          [input.agentId],
        );
        if (input.requestCompletion && completedResponse) {
          const completed = await client.query(
            `UPDATE personal_ai_chat_requests
             SET status = 'completed', response = $4::jsonb,
                 lease_expires_at = NOW(), updated_at = NOW()
             WHERE viewer_id = $1 AND client_ref = $2 AND request_hash = $3
               AND status = 'processing'
             RETURNING client_ref`,
            [
              input.userId,
              input.requestCompletion.clientRef,
              input.requestCompletion.requestHash,
              JSON.stringify(completedResponse),
            ],
          );
          if (!completed.rows[0]) {
            throw new Error('Personal AI request claim was not completed.');
          }
        }
        await client.query('COMMIT');
        return { userMessage, assistantMessage, completedResponse };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  }

  const state = await readFileState();
  const threadMessageCount = state.messages.filter(
    message =>
      message.thread_id === input.threadId && message.owner_id === input.userId,
  ).length;
  assertPersonalAiQuotaAvailable({
    resource: 'messages',
    currentCount: threadMessageCount,
    additionalCount: 2,
  });
  state.messages.push(userMessage, assistantMessage);
  state.threads = state.threads.map(thread =>
    thread.id === input.threadId && thread.owner_id === input.userId
      ? { ...thread, updated_at: nowIso() }
      : thread,
  );
  state.agents = state.agents.map(agent =>
    agent.id === input.agentId
      ? { ...agent, usage_count: agent.usage_count + 1, updated_at: nowIso() }
      : agent,
  );
  if (input.requestCompletion && completedResponse) {
    let requestCompleted = false;
    state.chat_requests = state.chat_requests.map(request => {
      if (
        request.viewer_id !== input.userId ||
        request.client_ref !== input.requestCompletion!.clientRef ||
        request.request_hash !== input.requestCompletion!.requestHash ||
        request.status !== 'processing'
      ) {
        return request;
      }
      requestCompleted = true;
      return {
        ...request,
        status: 'completed',
        response: completedResponse,
        lease_expires_at: nowIso(),
        updated_at: nowIso(),
      };
    });
    if (!requestCompleted) {
      throw new Error('Personal AI request claim was not completed.');
    }
  }
  await writeFileState(state);
  return { userMessage, assistantMessage, completedResponse };
}

export async function setPersonalAiMessageReaction(input: {
  userId: string;
  messageId: string;
  reaction: string;
}) {
  const reaction = cleanText(input.reaction, 12);
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = await pool.query(
        `UPDATE personal_ai_messages
         SET metadata = CASE
           WHEN $3 = '' THEN COALESCE(metadata, '{}'::jsonb) - 'user_reaction'
           ELSE jsonb_set(
             COALESCE(metadata, '{}'::jsonb),
             '{user_reaction}',
             to_jsonb($3::text),
             true
           )
         END
         WHERE id = $1 AND owner_id = $2
         RETURNING *`,
        [input.messageId, input.userId, reaction],
      );
      return result.rows[0]
        ? normalizeMessage(result.rows[0] as Record<string, unknown>)
        : null;
    }
  }

  const state = await readFileState();
  let updated: PersonalAiMessage | null = null;
  state.messages = state.messages.map(message => {
    if (message.id !== input.messageId || message.owner_id !== input.userId) {
      return message;
    }
    const metadata = { ...message.metadata };
    if (reaction) metadata.user_reaction = reaction;
    else delete metadata.user_reaction;
    updated = { ...message, metadata };
    return updated;
  });
  await writeFileState(state);
  return updated;
}

function forwardedMessageMetadata(source: PersonalAiMessage) {
  return {
    ...(Array.isArray(source.metadata.media)
      ? { media: source.metadata.media.slice(0, 10) }
      : {}),
    forwarded_from: {
      message_id: source.id,
      thread_id: source.thread_id,
      role: source.role,
    },
  };
}

export async function forwardPersonalAiMessage(input: {
  userId: string;
  messageId: string;
  targetThreadId: string;
}) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
          `personal-ai-messages:${input.userId}:${input.targetThreadId}`,
        ]);
        const sourceResult = await client.query(
          'SELECT * FROM personal_ai_messages WHERE id = $1 AND owner_id = $2 LIMIT 1',
          [input.messageId, input.userId],
        );
        const targetResult = await client.query(
          'SELECT * FROM personal_ai_threads WHERE id = $1 AND owner_id = $2 LIMIT 1',
          [input.targetThreadId, input.userId],
        );
        if (!sourceResult.rows[0] || !targetResult.rows[0]) {
          await client.query('ROLLBACK');
          return null;
        }

        const count = await client.query(
          `SELECT COUNT(*)::int AS count
           FROM personal_ai_messages
           WHERE thread_id = $1 AND owner_id = $2`,
          [input.targetThreadId, input.userId],
        );
        assertPersonalAiQuotaAvailable({
          resource: 'messages',
          currentCount: Number(count.rows[0]?.count || 0),
        });

        const source = normalizeMessage(sourceResult.rows[0]);
        const target = normalizeThread(targetResult.rows[0]);
        const message = normalizeMessage({
          id: id('msg'),
          thread_id: target.id,
          agent_id: target.agent_id,
          owner_id: input.userId,
          role: 'user',
          content: source.content,
          metadata: forwardedMessageMetadata(source),
          created_at: nowIso(),
        });
        await client.query(
          `INSERT INTO personal_ai_messages
           (id, thread_id, agent_id, owner_id, role, content, metadata, created_at)
           VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)`,
          [
            message.id,
            message.thread_id,
            message.agent_id,
            message.owner_id,
            message.role,
            message.content,
            JSON.stringify(message.metadata),
            message.created_at,
          ],
        );
        const updatedThreadResult = await client.query(
          `UPDATE personal_ai_threads
           SET updated_at = NOW()
           WHERE id = $1 AND owner_id = $2
           RETURNING *`,
          [target.id, input.userId],
        );
        await client.query('COMMIT');
        return {
          message,
          thread: updatedThreadResult.rows[0]
            ? normalizeThread(updatedThreadResult.rows[0])
            : target,
        };
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  }

  const state = await readFileState();
  const source = state.messages.find(
    message =>
      message.id === input.messageId && message.owner_id === input.userId,
  );
  const target = state.threads.find(
    thread =>
      thread.id === input.targetThreadId && thread.owner_id === input.userId,
  );
  if (!source || !target) return null;
  const targetMessageCount = state.messages.filter(
    item => item.thread_id === target.id && item.owner_id === input.userId,
  ).length;
  assertPersonalAiQuotaAvailable({
    resource: 'messages',
    currentCount: targetMessageCount,
  });
  const message = normalizeMessage({
    id: id('msg'),
    thread_id: target.id,
    agent_id: target.agent_id,
    owner_id: input.userId,
    role: 'user',
    content: source.content,
    metadata: forwardedMessageMetadata(source),
    created_at: nowIso(),
  });
  state.messages.push(message);
  const updatedThread = { ...target, updated_at: nowIso() };
  state.threads = state.threads.map(thread =>
    thread.id === target.id ? updatedThread : thread,
  );
  await writeFileState(state);
  return { message, thread: updatedThread };
}

export async function attachCreationDraftToPersonalAiMessage(input: {
  userId: string;
  messageId: string;
  draft: Record<string, unknown>;
}) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = await pool.query(
        `UPDATE personal_ai_messages
         SET metadata = COALESCE(metadata, '{}'::jsonb) || $3::jsonb
         WHERE id = $1 AND owner_id = $2 AND role = 'assistant'
         RETURNING *`,
        [
          input.messageId,
          input.userId,
          JSON.stringify({ creation_draft: input.draft }),
        ],
      );
      return result.rows[0]
        ? normalizeMessage(result.rows[0] as Record<string, unknown>)
        : null;
    }
  }

  const state = await readFileState();
  let updated: PersonalAiMessage | null = null;
  state.messages = state.messages.map(message => {
    if (
      message.id !== input.messageId ||
      message.owner_id !== input.userId ||
      message.role !== 'assistant'
    ) {
      return message;
    }
    updated = {
      ...message,
      metadata: { ...message.metadata, creation_draft: input.draft },
    };
    return updated;
  });
  await writeFileState(state);
  return updated;
}

export async function getPersonalAiMemory(agentId: string, userId: string) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = await pool.query(
        'SELECT * FROM personal_ai_memories WHERE agent_id = $1 AND owner_id = $2 LIMIT 1',
        [agentId, userId],
      );
      const row = result.rows[0];
      if (!row) return null;
      return {
        agent_id: String(row.agent_id),
        owner_id: String(row.owner_id),
        summary: cleanText(row.summary, 1800),
        facts:
          row.facts &&
          typeof row.facts === 'object' &&
          !Array.isArray(row.facts)
            ? (row.facts as PersonalAiMemory['facts'])
            : { topics: [], user_terms: [], last_messages: [] },
        updated_at: cleanText(row.updated_at, 40) || nowIso(),
      };
    }
  }

  const state = await readFileState();
  return (
    state.memories.find(
      item => item.agent_id === agentId && item.owner_id === userId,
    ) || null
  );
}

export async function isPersonalAiMemoryEnabled(input: {
  agent: PersonalAiAgent;
  userId: string;
}) {
  if (input.agent.owner_id === input.userId) {
    return input.agent.memory_enabled === true;
  }

  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = await pool.query(
        `SELECT enabled
         FROM personal_ai_memory_preferences
         WHERE agent_id = $1 AND viewer_id = $2
         LIMIT 1`,
        [input.agent.id, input.userId],
      );
      return result.rows[0]?.enabled === true;
    }
  }

  const state = await readFileState();
  return (
    state.memory_preferences.find(
      preference =>
        preference.agent_id === input.agent.id &&
        preference.viewer_id === input.userId,
    )?.enabled === true
  );
}

export function canPersistPersonalAiMemory(input: {
  agentOwnerId: string;
  viewerUserId: string;
  ownerMemoryEnabled: boolean;
  sharedRecipientConsent?: boolean;
}) {
  return input.agentOwnerId === input.viewerUserId
    ? input.ownerMemoryEnabled === true
    : input.sharedRecipientConsent === true;
}

export async function setPersonalAiMemoryPreference(input: {
  agent: PersonalAiAgent;
  userId: string;
  enabled: boolean;
}) {
  if (input.agent.owner_id === input.userId) return null;
  const at = nowIso();
  const preference: PersonalAiMemoryPreference = {
    agent_id: input.agent.id,
    viewer_id: input.userId,
    enabled: input.enabled === true,
    created_at: at,
    updated_at: at,
  };
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const result = await pool.query(
        `INSERT INTO personal_ai_memory_preferences
         (agent_id, viewer_id, enabled, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$4)
         ON CONFLICT (agent_id, viewer_id)
         DO UPDATE SET enabled = EXCLUDED.enabled, updated_at = EXCLUDED.updated_at
         RETURNING *`,
        [preference.agent_id, preference.viewer_id, preference.enabled, at],
      );
      return result.rows[0]
        ? {
            agent_id: String(result.rows[0].agent_id),
            viewer_id: String(result.rows[0].viewer_id),
            enabled: result.rows[0].enabled === true,
            created_at: cleanText(result.rows[0].created_at, 40) || at,
            updated_at: cleanText(result.rows[0].updated_at, 40) || at,
          }
        : null;
    }
  }

  const state = await readFileState();
  const existing = state.memory_preferences.find(
    item => item.agent_id === input.agent.id && item.viewer_id === input.userId,
  );
  state.memory_preferences = state.memory_preferences.filter(
    item =>
      !(item.agent_id === input.agent.id && item.viewer_id === input.userId),
  );
  state.memory_preferences.push({
    ...preference,
    created_at: existing?.created_at || at,
  });
  await writeFileState(state);
  return preference;
}

export async function deletePersonalAiMemory(input: {
  agentId: string;
  userId: string;
  disablePreference?: boolean;
}) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        await client.query(
          'DELETE FROM personal_ai_memories WHERE agent_id = $1 AND owner_id = $2',
          [input.agentId, input.userId],
        );
        if (input.disablePreference) {
          await client.query(
            `INSERT INTO personal_ai_memory_preferences
             (agent_id, viewer_id, enabled, created_at, updated_at)
             VALUES ($1,$2,FALSE,NOW(),NOW())
             ON CONFLICT (agent_id, viewer_id)
             DO UPDATE SET enabled = FALSE, updated_at = NOW()`,
            [input.agentId, input.userId],
          );
        }
        await client.query('COMMIT');
        return true;
      } catch (error) {
        await client.query('ROLLBACK').catch(() => undefined);
        throw error;
      } finally {
        client.release();
      }
    }
  }

  const state = await readFileState();
  state.memories = state.memories.filter(
    memory =>
      !(memory.agent_id === input.agentId && memory.owner_id === input.userId),
  );
  if (input.disablePreference) {
    const at = nowIso();
    const existing = state.memory_preferences.find(
      item =>
        item.agent_id === input.agentId && item.viewer_id === input.userId,
    );
    state.memory_preferences = state.memory_preferences.filter(
      item =>
        !(item.agent_id === input.agentId && item.viewer_id === input.userId),
    );
    state.memory_preferences.push({
      agent_id: input.agentId,
      viewer_id: input.userId,
      enabled: false,
      created_at: existing?.created_at || at,
      updated_at: at,
    });
  }
  await writeFileState(state);
  return true;
}

function extractKeywords(text: string) {
  return cleanText(text, 1200)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(
      word =>
        word.length >= 4 &&
        !/^(yang|untuk|dengan|atau|saya|kamu|tolong|bantu|usaha|bisnis)$/i.test(
          word,
        ),
    )
    .slice(0, 12);
}

function uniqueLimit(items: string[], limit: number) {
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of items) {
    const clean = cleanText(item, 90);
    const key = clean.toLowerCase();
    if (!clean || seen.has(key)) continue;
    seen.add(key);
    result.push(clean);
    if (result.length >= limit) break;
  }
  return result;
}

export async function updatePersonalAiMemory(input: {
  agent: PersonalAiAgent;
  userId: string;
  userMessage: string;
  assistantMessage: string;
  sharedRecipientConsent?: boolean;
}) {
  const allowed = canPersistPersonalAiMemory({
    agentOwnerId: input.agent.owner_id,
    viewerUserId: input.userId,
    ownerMemoryEnabled: input.agent.memory_enabled,
    sharedRecipientConsent: input.sharedRecipientConsent,
  });
  if (!allowed) return null;
  const existing = await getPersonalAiMemory(input.agent.id, input.userId);
  const topics = uniqueLimit(
    [...(existing?.facts.topics || []), ...extractKeywords(input.userMessage)],
    18,
  );
  const userTerms = uniqueLimit(
    [...(existing?.facts.user_terms || []), input.userMessage.slice(0, 120)],
    8,
  );
  const lastMessages = uniqueLimit(
    [input.userMessage.slice(0, 180), ...(existing?.facts.last_messages || [])],
    6,
  );
  const summary = [
    topics.length
      ? `Topik sering muncul: ${topics.slice(0, 8).join(', ')}.`
      : '',
    lastMessages[0] ? `Kebutuhan terbaru user: ${lastMessages[0]}` : '',
  ]
    .filter(Boolean)
    .join('\n')
    .slice(0, 1800);

  const memory: PersonalAiMemory = {
    agent_id: input.agent.id,
    owner_id: input.userId,
    summary,
    facts: {
      topics,
      user_terms: userTerms,
      last_messages: lastMessages,
    },
    updated_at: nowIso(),
  };

  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await getPersonalAiPostgresPool();
    if (pool) {
      await pool.query(
        `INSERT INTO personal_ai_memories (agent_id, owner_id, summary, facts, updated_at)
         VALUES ($1,$2,$3,$4::jsonb,NOW())
         ON CONFLICT (agent_id, owner_id)
         DO UPDATE SET summary = EXCLUDED.summary, facts = EXCLUDED.facts, updated_at = NOW()`,
        [
          memory.agent_id,
          memory.owner_id,
          memory.summary,
          JSON.stringify(memory.facts),
        ],
      );
      return memory;
    }
  }

  const state = await readFileState();
  state.memories = state.memories.filter(
    item =>
      !(item.agent_id === memory.agent_id && item.owner_id === memory.owner_id),
  );
  state.memories.push(memory);
  await writeFileState(state);
  return memory;
}

export function buildThreadTitle(message: string) {
  const cleaned = cleanText(message, 70);
  if (!cleaned) return 'Chat baru';
  return cleaned.length <= 54 ? cleaned : `${cleaned.slice(0, 54).trim()}...`;
}

export const personalAiLimits = {
  maxAgentsPerUser: MAX_AGENTS_PER_USER,
  maxThreadsPerUser: MAX_THREADS_PER_USER,
  maxMessagesPerThread: MAX_MESSAGES_PER_THREAD,
};
