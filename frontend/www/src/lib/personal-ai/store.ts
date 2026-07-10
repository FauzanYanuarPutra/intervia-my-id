import crypto from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import path from 'path';
import { getPostgresPool } from '@/lib/postgres';

export type PersonalAiVisibility = 'private' | 'shared';
export type PersonalAiModelPreference = 'auto' | 'ollama' | 'groq' | 'openai';

export type PersonalAiQuickButton = {
  id: string;
  label: string;
  prompt: string;
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
  memory_enabled: boolean;
  share_id: string;
  usage_count: number;
  created_at: string;
  updated_at: string;
  can_edit?: boolean;
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

export type PersonalAiStorageMode = 'postgres' | 'file';

type FileState = {
  version: 1;
  agents: PersonalAiAgent[];
  threads: PersonalAiThread[];
  messages: PersonalAiMessage[];
  memories: PersonalAiMemory[];
};

const FILE_DIR =
  process.env.PERSONAL_AI_STORE_DIR ||
  (process.env.NODE_ENV === 'production'
    ? '/tmp/lajukan-personal-ai'
    : path.join(process.cwd(), '../../.runtime/personal-ai'));
const FILE_PATH = path.join(FILE_DIR, 'state.json');
const MAX_AGENTS_PER_USER = 12;
const MAX_THREADS_PER_USER = 80;
const MAX_MESSAGES_PER_THREAD = 80;

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

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\u0000/g, '')
    .replace(/[<>]/g, '')
    .replace(/\s+\n/g, '\n')
    .trim()
    .slice(0, maxLength);
}

function cleanVisibility(value: unknown): PersonalAiVisibility {
  return value === 'shared' ? 'shared' : 'private';
}

function cleanModelPreference(value: unknown): PersonalAiModelPreference {
  if (value === 'ollama' || value === 'groq' || value === 'openai') return value;
  return 'auto';
}

function cleanTemperature(value: unknown): number {
  const parsed = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(parsed)) return 0.4;
  return Math.max(0, Math.min(1, Number(parsed.toFixed(2))));
}

function cleanStringList(value: unknown, limit: number, itemMax = 220): string[] {
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
    const key = label.toLowerCase();
    if (!label || !prompt || seen.has(key)) continue;
    seen.add(key);
    buttons.push({
      id: cleanText(record.id, 80) || id('btn'),
      label,
      prompt,
    });
    if (buttons.length >= 12) break;
  }
  return buttons.length > 0 ? buttons : DEFAULT_BUTTONS;
}

function normalizeAgent(row: Record<string, unknown>, canEdit = false): PersonalAiAgent {
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
    memory_enabled: row.memory_enabled !== false,
    share_id: cleanText(row.share_id, 80) || shareId(),
    usage_count: Number(row.usage_count || 0),
    created_at: cleanText(row.created_at, 40) || nowIso(),
    updated_at: cleanText(row.updated_at, 40) || nowIso(),
    can_edit: canEdit,
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

function normalizeMessage(row: Record<string, unknown>): PersonalAiMessage {
  const metadata =
    row.metadata && typeof row.metadata === 'object' && !Array.isArray(row.metadata)
      ? (row.metadata as Record<string, unknown>)
      : {};
  return {
    id: String(row.id),
    thread_id: String(row.thread_id),
    agent_id: String(row.agent_id),
    owner_id: String(row.owner_id),
    role: row.role === 'assistant' || row.role === 'system' ? row.role : 'user',
    content: cleanText(row.content, 12000),
    metadata,
    created_at: cleanText(row.created_at, 40) || nowIso(),
  };
}

function createDefaultAgent(userId: string): PersonalAiAgent {
  const at = nowIso();
  return {
    id: id('agent'),
    owner_id: userId,
    name: 'AI Usaha Saya',
    description: 'Asisten pribadi untuk rencana usaha, supplier, modal, risiko, dan langkah harian.',
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
    memory_enabled: true,
    share_id: shareId(),
    usage_count: 0,
    created_at: at,
    updated_at: at,
    can_edit: true,
  };
}

async function ensureSchema() {
  const pool = getPostgresPool();
  if (!pool) return null;
  await pool.query(`
    CREATE TABLE IF NOT EXISTS personal_ai_agents (
      id TEXT PRIMARY KEY,
      owner_id TEXT NOT NULL,
      name TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      visibility TEXT NOT NULL DEFAULT 'private',
      instructions TEXT NOT NULL DEFAULT '',
      tone TEXT NOT NULL DEFAULT '',
      model_preference TEXT NOT NULL DEFAULT 'auto',
      temperature REAL NOT NULL DEFAULT 0.4,
      quick_buttons JSONB NOT NULL DEFAULT '[]'::jsonb,
      starter_prompts JSONB NOT NULL DEFAULT '[]'::jsonb,
      memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
      share_id TEXT NOT NULL UNIQUE,
      usage_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS personal_ai_agents_owner_idx
      ON personal_ai_agents(owner_id, updated_at DESC);
    CREATE INDEX IF NOT EXISTS personal_ai_agents_share_idx
      ON personal_ai_agents(share_id);

    CREATE TABLE IF NOT EXISTS personal_ai_threads (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES personal_ai_agents(id) ON DELETE CASCADE,
      owner_id TEXT NOT NULL,
      title TEXT NOT NULL DEFAULT 'Chat baru',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS personal_ai_threads_owner_agent_idx
      ON personal_ai_threads(owner_id, agent_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS personal_ai_messages (
      id TEXT PRIMARY KEY,
      thread_id TEXT NOT NULL REFERENCES personal_ai_threads(id) ON DELETE CASCADE,
      agent_id TEXT NOT NULL REFERENCES personal_ai_agents(id) ON DELETE CASCADE,
      owner_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS personal_ai_messages_thread_idx
      ON personal_ai_messages(thread_id, created_at ASC);

    CREATE TABLE IF NOT EXISTS personal_ai_memories (
      agent_id TEXT NOT NULL REFERENCES personal_ai_agents(id) ON DELETE CASCADE,
      owner_id TEXT NOT NULL,
      summary TEXT NOT NULL DEFAULT '',
      facts JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY(agent_id, owner_id)
    );
  `);
  return pool;
}

async function readFileState(): Promise<FileState> {
  try {
    const raw = await readFile(FILE_PATH, 'utf8');
    const parsed = JSON.parse(raw) as Partial<FileState>;
    return {
      version: 1,
      agents: Array.isArray(parsed.agents) ? parsed.agents.map(item => normalizeAgent(item as Record<string, unknown>, false)) : [],
      threads: Array.isArray(parsed.threads) ? parsed.threads.map(item => normalizeThread(item as Record<string, unknown>)) : [],
      messages: Array.isArray(parsed.messages) ? parsed.messages.map(item => normalizeMessage(item as Record<string, unknown>)) : [],
      memories: Array.isArray(parsed.memories) ? (parsed.memories as PersonalAiMemory[]) : [],
    };
  } catch {
    return {
      version: 1,
      agents: [],
      threads: [],
      messages: [],
      memories: [],
    };
  }
}

async function writeFileState(state: FileState) {
  await mkdir(FILE_DIR, { recursive: true });
  await writeFile(FILE_PATH, `${JSON.stringify(state, null, 2)}\n`, 'utf8');
}

async function getStorageMode(): Promise<PersonalAiStorageMode> {
  try {
    const pool = await ensureSchema();
    return pool ? 'postgres' : 'file';
  } catch (error) {
    console.warn('[PERSONAL_AI_POSTGRES_FALLBACK]', error instanceof Error ? error.message : error);
    return 'file';
  }
}

async function ensureDefaultAgent(userId: string): Promise<PersonalAiAgent> {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await ensureSchema();
    if (pool) {
      const existing = await pool.query(
        'SELECT * FROM personal_ai_agents WHERE owner_id = $1 ORDER BY created_at ASC LIMIT 1',
        [userId],
      );
      if (existing.rows[0]) return normalizeAgent(existing.rows[0], true);
      const agent = createDefaultAgent(userId);
      await pool.query(
        `INSERT INTO personal_ai_agents
         (id, owner_id, name, description, visibility, instructions, tone, model_preference,
          temperature, quick_buttons, starter_prompts, memory_enabled, share_id, usage_count,
          created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16)`,
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
  const agent = createDefaultAgent(userId);
  state.agents.push(agent);
  await writeFileState(state);
  return agent;
}

export async function listPersonalAiAgents(userId: string, share?: string) {
  await ensureDefaultAgent(userId);
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await ensureSchema();
    if (pool) {
      const owned = await pool.query(
        'SELECT * FROM personal_ai_agents WHERE owner_id = $1 ORDER BY updated_at DESC',
        [userId],
      );
      const agents = owned.rows.map(row => normalizeAgent(row, true));
      let sharedAgent: PersonalAiAgent | null = null;
      if (share) {
        const shared = await pool.query(
          "SELECT * FROM personal_ai_agents WHERE share_id = $1 AND visibility = 'shared' LIMIT 1",
          [share],
        );
        if (shared.rows[0]) {
          sharedAgent = normalizeAgent(shared.rows[0], shared.rows[0].owner_id === userId);
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
    ? state.agents.find(agent => agent.share_id === share && agent.visibility === 'shared') || null
    : null;
  return {
    agents,
    shared_agent: shared ? { ...shared, can_edit: shared.owner_id === userId } : null,
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
      memory_enabled: input.memory_enabled,
      share_id: shareId(),
      usage_count: 0,
      created_at: at,
      updated_at: at,
    },
    true,
  );

  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await ensureSchema();
    if (pool) {
      const count = await pool.query(
        'SELECT COUNT(*)::int AS count FROM personal_ai_agents WHERE owner_id = $1',
        [userId],
      );
      if (Number(count.rows[0]?.count || 0) >= MAX_AGENTS_PER_USER) {
        throw new Error('Batas AI pribadi tercapai.');
      }
      await pool.query(
        `INSERT INTO personal_ai_agents
         (id, owner_id, name, description, visibility, instructions, tone, model_preference,
          temperature, quick_buttons, starter_prompts, memory_enabled, share_id, usage_count,
          created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10::jsonb,$11::jsonb,$12,$13,$14,$15,$16)`,
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
  if (state.agents.filter(item => item.owner_id === userId).length >= MAX_AGENTS_PER_USER) {
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
    const pool = await ensureSchema();
    if (pool) {
      const result = input.shareId
        ? await pool.query(
            "SELECT * FROM personal_ai_agents WHERE share_id = $1 AND visibility = 'shared' LIMIT 1",
            [input.shareId],
          )
        : await pool.query(
            "SELECT * FROM personal_ai_agents WHERE id = $1 AND (owner_id = $2 OR visibility = 'shared') LIMIT 1",
            [input.agentId, input.userId],
          );
      const row = result.rows[0];
      return row ? normalizeAgent(row, row.owner_id === input.userId) : null;
    }
  }

  const state = await readFileState();
  const agent = input.shareId
    ? state.agents.find(item => item.share_id === input.shareId && item.visibility === 'shared')
    : state.agents.find(
        item =>
          item.id === input.agentId &&
          (item.owner_id === input.userId || item.visibility === 'shared'),
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
    const pool = await ensureSchema();
    if (pool) {
      await pool.query(
        `UPDATE personal_ai_agents
         SET name=$3, description=$4, visibility=$5, instructions=$6, tone=$7,
             model_preference=$8, temperature=$9, quick_buttons=$10::jsonb,
             starter_prompts=$11::jsonb, memory_enabled=$12, updated_at=$13
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

export async function deletePersonalAiAgent(userId: string, agentId: string) {
  const current = await getPersonalAiAgentForUse({ userId, agentId });
  if (!current || current.owner_id !== userId) return false;
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await ensureSchema();
    if (pool) {
      const count = await pool.query(
        'SELECT COUNT(*)::int AS count FROM personal_ai_agents WHERE owner_id = $1',
        [userId],
      );
      if (Number(count.rows[0]?.count || 0) <= 1) return false;
      await pool.query('DELETE FROM personal_ai_agents WHERE id = $1 AND owner_id = $2', [
        agentId,
        userId,
      ]);
      return true;
    }
  }

  const state = await readFileState();
  if (state.agents.filter(agent => agent.owner_id === userId).length <= 1) return false;
  state.agents = state.agents.filter(
    agent => !(agent.id === agentId && agent.owner_id === userId),
  );
  state.threads = state.threads.filter(thread => thread.agent_id !== agentId);
  state.messages = state.messages.filter(message => message.agent_id !== agentId);
  state.memories = state.memories.filter(memory => memory.agent_id !== agentId);
  await writeFileState(state);
  return true;
}

export async function listPersonalAiThreads(userId: string, agentId?: string) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await ensureSchema();
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
      return result.rows.map(row => normalizeThread(row));
    }
  }

  const state = await readFileState();
  return state.threads
    .filter(thread => thread.owner_id === userId && (!agentId || thread.agent_id === agentId))
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
    const pool = await ensureSchema();
    if (pool) {
      const count = await pool.query(
        'SELECT COUNT(*)::int AS count FROM personal_ai_threads WHERE owner_id = $1',
        [userId],
      );
      if (Number(count.rows[0]?.count || 0) >= MAX_THREADS_PER_USER) {
        await pool.query(
          `DELETE FROM personal_ai_threads
           WHERE id IN (
             SELECT id FROM personal_ai_threads
             WHERE owner_id = $1
             ORDER BY updated_at ASC
             LIMIT 8
           )`,
          [userId],
        );
      }
      await pool.query(
        `INSERT INTO personal_ai_threads (id, agent_id, owner_id, title, created_at, updated_at)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [thread.id, thread.agent_id, thread.owner_id, thread.title, thread.created_at, thread.updated_at],
      );
      return thread;
    }
  }

  const state = await readFileState();
  const ownedThreads = state.threads.filter(item => item.owner_id === userId);
  if (ownedThreads.length >= MAX_THREADS_PER_USER) {
    const removeIds = new Set(
      ownedThreads
        .sort((a, b) => a.updated_at.localeCompare(b.updated_at))
        .slice(0, 8)
        .map(item => item.id),
    );
    state.threads = state.threads.filter(item => !removeIds.has(item.id));
    state.messages = state.messages.filter(item => !removeIds.has(item.thread_id));
  }
  state.threads.push(thread);
  await writeFileState(state);
  return thread;
}

export async function getPersonalAiThreadWithMessages(userId: string, threadId: string) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await ensureSchema();
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
        messages: messageResult.rows.map(row => normalizeMessage(row)),
      };
    }
  }

  const state = await readFileState();
  const thread = state.threads.find(item => item.id === threadId && item.owner_id === userId);
  if (!thread) return null;
  return {
    thread,
    messages: state.messages
      .filter(item => item.thread_id === threadId && item.owner_id === userId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at)),
  };
}

export async function renamePersonalAiThread(userId: string, threadId: string, title: string) {
  const cleanTitle = cleanText(title, 90) || 'Chat baru';
  const at = nowIso();
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await ensureSchema();
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
    const pool = await ensureSchema();
    if (pool) {
      await pool.query('DELETE FROM personal_ai_threads WHERE id = $1 AND owner_id = $2', [
        threadId,
        userId,
      ]);
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

export async function appendPersonalAiMessages(input: {
  userId: string;
  agentId: string;
  threadId: string;
  userContent: string;
  assistantContent: string;
  metadata: Record<string, unknown>;
}) {
  const at = nowIso();
  const userMessage = normalizeMessage({
    id: id('msg'),
    thread_id: input.threadId,
    agent_id: input.agentId,
    owner_id: input.userId,
    role: 'user',
    content: input.userContent,
    metadata: {},
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

  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await ensureSchema();
    if (pool) {
      await pool.query(
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
      await pool.query(
        'UPDATE personal_ai_threads SET updated_at = NOW() WHERE id = $1 AND owner_id = $2',
        [input.threadId, input.userId],
      );
      await pool.query(
        'UPDATE personal_ai_agents SET usage_count = usage_count + 1, updated_at = NOW() WHERE id = $1',
        [input.agentId],
      );
      await pool.query(
        `DELETE FROM personal_ai_messages
         WHERE id IN (
           SELECT id FROM personal_ai_messages
           WHERE thread_id = $1 AND owner_id = $2
           ORDER BY created_at ASC
           OFFSET $3
         )`,
        [input.threadId, input.userId, MAX_MESSAGES_PER_THREAD],
      );
      return { userMessage, assistantMessage };
    }
  }

  const state = await readFileState();
  state.messages.push(userMessage, assistantMessage);
  state.messages = state.messages.filter((message, _, all) => {
    if (message.thread_id !== input.threadId || message.owner_id !== input.userId) return true;
    const threadMessages = all.filter(
      item => item.thread_id === input.threadId && item.owner_id === input.userId,
    );
    return threadMessages.indexOf(message) >= threadMessages.length - MAX_MESSAGES_PER_THREAD;
  });
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
  await writeFileState(state);
  return { userMessage, assistantMessage };
}

export async function getPersonalAiMemory(agentId: string, userId: string) {
  const mode = await getStorageMode();
  if (mode === 'postgres') {
    const pool = await ensureSchema();
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
          row.facts && typeof row.facts === 'object' && !Array.isArray(row.facts)
            ? (row.facts as PersonalAiMemory['facts'])
            : { topics: [], user_terms: [], last_messages: [] },
        updated_at: cleanText(row.updated_at, 40) || nowIso(),
      };
    }
  }

  const state = await readFileState();
  return state.memories.find(item => item.agent_id === agentId && item.owner_id === userId) || null;
}

function extractKeywords(text: string) {
  return cleanText(text, 1200)
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter(word => word.length >= 4 && !/^(yang|untuk|dengan|atau|saya|kamu|tolong|bantu|usaha|bisnis)$/i.test(word))
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
}) {
  if (!input.agent.memory_enabled) return null;
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
    topics.length ? `Topik sering muncul: ${topics.slice(0, 8).join(', ')}.` : '',
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
    const pool = await ensureSchema();
    if (pool) {
      await pool.query(
        `INSERT INTO personal_ai_memories (agent_id, owner_id, summary, facts, updated_at)
         VALUES ($1,$2,$3,$4::jsonb,NOW())
         ON CONFLICT (agent_id, owner_id)
         DO UPDATE SET summary = EXCLUDED.summary, facts = EXCLUDED.facts, updated_at = NOW()`,
        [memory.agent_id, memory.owner_id, memory.summary, JSON.stringify(memory.facts)],
      );
      return memory;
    }
  }

  const state = await readFileState();
  state.memories = state.memories.filter(
    item => !(item.agent_id === memory.agent_id && item.owner_id === memory.owner_id),
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
};
