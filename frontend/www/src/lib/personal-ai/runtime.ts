import { LAJUKAN_SYSTEM_PROMPT } from '@/lib/aiSystemPrompt';
import type {
  PersonalAiAgent,
  PersonalAiMemory,
  PersonalAiMessage,
  PersonalAiModelPreference,
} from './store';

const INTERNAL_AI_URL = process.env.INTERNAL_AI_URL || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL =
  process.env.OLLAMA_BUSINESS_MODEL || process.env.OLLAMA_MODEL || 'llama3.2:3b';
const OLLAMA_TIMEOUT_MS = cleanTimeout(
  process.env.OLLAMA_CHAT_TIMEOUT_MS || process.env.OLLAMA_TIMEOUT_MS,
  45000,
);
const OLLAMA_KEEP_ALIVE = cleanOllamaDuration(
  process.env.OLLAMA_KEEP_ALIVE,
  '10m',
);
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const PERSONAL_AI_FAST_PROVIDER_FIRST =
  process.env.PERSONAL_AI_FAST_PROVIDER_FIRST !== 'false';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

export type PersonalAiProviderResult = {
  response: string;
  provider: string;
  model: string;
};

function trimBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function cleanTimeout(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(3000, Math.min(95000, Math.round(parsed)));
}

function cleanOllamaDuration(value: string | undefined, fallback: string) {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  if (/^(0|[1-9]\d*(ms|s|m|h))$/i.test(trimmed)) return trimmed;
  return fallback;
}

function buildSystemPrompt(input: {
  agent: PersonalAiAgent;
  memory: PersonalAiMemory | null;
  locale: 'id' | 'en';
}) {
  const isId = input.locale === 'id';
  const memoryText =
    input.agent.memory_enabled && input.memory?.summary
      ? input.memory.summary
      : '';

  return [
    LAJUKAN_SYSTEM_PROMPT,
    '',
    isId
      ? 'Kamu sedang berjalan sebagai AI pribadi milik user Lajukan.'
      : 'You are running as a personal AI owned by a Lajukan user.',
    isId
      ? 'Ikuti instruksi pemilik AI di bawah ini selama tidak meminta hal berbahaya, ilegal, penipuan, bocor data rahasia, atau klaim pasti untung.'
      : 'Follow the owner instructions below unless they request harmful, illegal, fraudulent, secret-leaking, or guaranteed-profit claims.',
    isId
      ? 'Jangan mengarang data listing, harga, nomor kontak, supplier, legalitas, atau janji hasil. Kalau data kurang, tanya balik maksimal 2 pertanyaan.'
      : 'Do not invent listings, prices, contacts, suppliers, permits, or outcome promises. If data is missing, ask at most 2 follow-up questions.',
    isId
      ? 'Jawab ringkas, praktis, dan cocok untuk pelaku usaha Indonesia.'
      : 'Answer concisely, practically, and for Indonesian local business operators.',
    '',
    `Nama AI: ${input.agent.name}`,
    `Gaya jawaban: ${input.agent.tone}`,
    `Instruksi pemilik:\n${input.agent.instructions}`,
    memoryText
      ? `${isId ? 'Memory personal yang boleh dipakai' : 'Allowed personal memory'}:\n${memoryText}`
      : '',
  ]
    .filter(Boolean)
    .join('\n');
}

function buildMessages(input: {
  agent: PersonalAiAgent;
  memory: PersonalAiMemory | null;
  message: string;
  history: PersonalAiMessage[];
  locale: 'id' | 'en';
}): ChatMessage[] {
  const system: ChatMessage = {
    role: 'system',
    content: buildSystemPrompt({
      agent: input.agent,
      memory: input.memory,
      locale: input.locale,
    }),
  };
  const history = input.history
    .filter(item => item.role === 'user' || item.role === 'assistant')
    .slice(-14)
    .map(item => ({
      role: item.role as 'user' | 'assistant',
      content: item.content,
    }));
  return [
    system,
    ...history,
    {
      role: 'user',
      content: input.message,
    },
  ];
}

async function callOllama(
  messages: ChatMessage[],
  temperature: number,
): Promise<PersonalAiProviderResult> {
  const res = await fetch(`${trimBaseUrl(OLLAMA_URL)}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      keep_alive: OLLAMA_KEEP_ALIVE,
      options: {
        temperature,
        num_ctx: 3072,
        num_predict: 380,
      },
    }),
    signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS),
  });

  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Ollama ${res.status}: ${err.slice(0, 400)}`);
  }
  const data = (await res.json()) as { message?: { content?: string } };
  const response = cleanText(data.message?.content, 6000);
  if (!response) throw new Error('Ollama returned empty response.');
  return { response, provider: 'ollama', model: OLLAMA_MODEL };
}

async function callGroq(
  messages: ChatMessage[],
  temperature: number,
): Promise<PersonalAiProviderResult> {
  const model = 'llama-3.1-8b-instant';
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      max_tokens: 700,
      temperature,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`Groq ${res.status}: ${err.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const response = cleanText(data.choices?.[0]?.message?.content, 6000);
  if (!response) throw new Error('Groq returned empty response.');
  return { response, provider: 'groq', model };
}

async function callOpenAI(
  messages: ChatMessage[],
  temperature: number,
): Promise<PersonalAiProviderResult> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages,
      max_tokens: 700,
      temperature,
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) {
    const err = await res.text().catch(() => '');
    throw new Error(`OpenAI ${res.status}: ${err.slice(0, 400)}`);
  }
  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const response = cleanText(data.choices?.[0]?.message?.content, 6000);
  if (!response) throw new Error('OpenAI returned empty response.');
  return { response, provider: 'openai', model: AI_MODEL };
}

async function callInternalAi(
  messages: ChatMessage[],
  agent: PersonalAiAgent,
): Promise<PersonalAiProviderResult> {
  const res = await fetch(`${trimBaseUrl(INTERNAL_AI_URL)}/v1/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messages,
      message: messages[messages.length - 1]?.content || '',
      agent: {
        id: agent.id,
        name: agent.name,
        instructions: agent.instructions,
        tone: agent.tone,
      },
    }),
    signal: AbortSignal.timeout(30000),
  });
  const data = (await res.json().catch(() => ({}))) as {
    response?: string;
    message?: string;
    model?: string;
    error?: string;
  };
  const response = cleanText(data.response || data.message, 6000);
  if (res.ok && response) {
    return {
      response,
      provider: 'internal-ai',
      model: cleanText(data.model, 120) || 'internal-ai',
    };
  }
  throw new Error(data.error || `Internal AI ${res.status}`);
}

function providerOrder(preference: PersonalAiModelPreference) {
  if (preference === 'ollama') return ['ollama', 'internal', 'groq', 'openai'];
  if (preference === 'groq') return ['groq', 'ollama', 'internal', 'openai'];
  if (preference === 'openai') return ['openai', 'ollama', 'internal', 'groq'];
  if (PERSONAL_AI_FAST_PROVIDER_FIRST) {
    return ['groq', 'internal', 'ollama', 'openai'];
  }
  return ['ollama', 'internal', 'groq', 'openai'];
}

export async function runPersonalAi(input: {
  agent: PersonalAiAgent;
  memory: PersonalAiMemory | null;
  message: string;
  history: PersonalAiMessage[];
  locale: 'id' | 'en';
}): Promise<PersonalAiProviderResult & { provider_errors: string[] }> {
  const sanitizedMessage = cleanText(input.message, 3500);
  const messages = buildMessages({
    agent: input.agent,
    memory: input.memory,
    message: sanitizedMessage,
    history: input.history,
    locale: input.locale,
  });
  const errors: string[] = [];
  const temperature = Math.max(0, Math.min(1, input.agent.temperature));

  for (const provider of providerOrder(input.agent.model_preference)) {
    try {
      if (provider === 'ollama' && USE_OLLAMA) {
        return { ...(await callOllama(messages, temperature)), provider_errors: errors };
      }
      if (provider === 'internal' && INTERNAL_AI_URL) {
        return { ...(await callInternalAi(messages, input.agent)), provider_errors: errors };
      }
      if (provider === 'groq' && GROQ_API_KEY) {
        return { ...(await callGroq(messages, temperature)), provider_errors: errors };
      }
      if (provider === 'openai' && OPENAI_API_KEY) {
        return { ...(await callOpenAI(messages, temperature)), provider_errors: errors };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${provider}: ${message}`);
      console.warn('[PERSONAL_AI_PROVIDER_ERROR]', message);
    }
  }

  return {
    response:
      input.locale === 'id'
        ? 'AI belum siap menjawab sekarang. Cek Ollama/API key, lalu coba lagi. Aku tetap menyimpan chat ini sebagai konteks tab.'
        : 'AI is not ready to answer right now. Check Ollama/API keys, then try again. This chat is still kept as tab context.',
    provider: 'safe-fallback',
    model: 'personal-ai-fallback',
    provider_errors: errors.slice(0, 4),
  };
}
