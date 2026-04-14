import { NextRequest, NextResponse } from 'next/server';
import { LAJUKAN_SYSTEM_PROMPT } from '@/lib/aiSystemPrompt';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

const INTERNAL_AI_URL = process.env.INTERNAL_AI_URL || '';
const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const MARKETPLACE_URL = process.env.INTERNAL_MARKETPLACE_URL || process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'http://localhost:8081';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

function buildOpenAIMessages(message: string, context?: ChatMessage[]): ChatMessage[] {
  const system: ChatMessage = { role: 'system', content: LAJUKAN_SYSTEM_PROMPT };
  const history = (context || [])
    .filter((m) => m.role === 'user' || m.role === 'assistant')
    .slice(-10)
    .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }));
  const userMsg: ChatMessage = { role: 'user', content: message };
  return [system, ...history, userMsg];
}

async function callGroq(messages: ChatMessage[], dbContext?: string): Promise<string> {
  // Enhance system message with database context if available
  const enhancedMessages = messages.map((m, idx) => {
    if (idx === 0 && m.role === 'system' && dbContext) {
      return { ...m, content: m.content + dbContext };
    }
    return m;
  });

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: enhancedMessages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Groq: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  return text || "Maaf, saya tidak bisa menghasilkan jawaban saat ini. Coba lagi ya.";
}

async function callOpenAI(messages: ChatMessage[], dbContext?: string): Promise<string> {
  // Enhance system message with database context if available
  const enhancedMessages = messages.map((m, idx) => {
    if (idx === 0 && m.role === 'system' && dbContext) {
      return { ...m, content: m.content + dbContext };
    }
    return m;
  });

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: AI_MODEL,
      messages: enhancedMessages.map((m) => ({ role: m.role, content: m.content })),
      max_tokens: 1024,
      temperature: 0.7,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OpenAI: ${res.status} ${err}`);
  }
  const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const text = data.choices?.[0]?.message?.content?.trim();
  return text || "Maaf, saya tidak bisa menghasilkan jawaban saat ini. Coba lagi ya.";
}

async function fetchDatabaseContext(query: string): Promise<string> {
  try {
    // Extract keywords from query untuk search
    const keywords = query
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 2)
      .slice(0, 5)
      .join(' ');

    if (!keywords) return '';

    const params = new URLSearchParams({
      q: keywords,
      limit: '10',
      offset: '0',
    });

    const res = await fetch(`${MARKETPLACE_URL}/v1/content?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) return '';

    const data = await res.json().catch(() => []);
    if (!Array.isArray(data) || data.length === 0) return '';

    // Build context from database results
    const context = data
      .slice(0, 5)
      .map((item: any, idx: number) => {
        const title = item.title || '';
        const type = item.type || '';
        const summary = item.summary || '';
        const sector = item.metadata?.sector || '';
        const tags = Array.isArray(item.tags) ? item.tags.slice(0, 3).join(', ') : '';
        
        return `${idx + 1}. [${type}] ${title}${summary ? ` - ${summary.slice(0, 80)}` : ''}${sector ? ` (Sector: ${sector})` : ''}${tags ? ` [Tags: ${tags}]` : ''}`;
      })
      .join('\n');

    return `\n\nData terkait dari database Lajukan:\n${context}\n\nGunakan informasi ini untuk memberikan jawaban yang lebih akurat dan relevan.`;
  } catch (error) {
    console.warn('[AI Chat] Failed to fetch database context:', error);
    return '';
  }
}

async function callOllama(message: string, context?: ChatMessage[], dbContext?: string): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  
  // Build enhanced system prompt with database context
  let systemPrompt = LAJUKAN_SYSTEM_PROMPT;
  if (dbContext) {
    systemPrompt += dbContext;
  }
  
  // Add system prompt
  messages.push({ role: 'system', content: systemPrompt });
  
  // Add context/history
  if (context && context.length > 0) {
    for (const msg of context.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  
  // Add current message
  messages.push({ role: 'user', content: message });

  const res = await fetch(`${OLLAMA_URL}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      messages,
      stream: false,
      options: {
        temperature: 0.7,
        num_predict: 500,
      },
    }),
    signal: AbortSignal.timeout(30000), // 30s timeout
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Ollama: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.message?.content?.trim() || "Maaf, saya tidak bisa menghasilkan jawaban saat ini.";
}

async function callInternalAI(body: Record<string, unknown>): Promise<string> {
  const url = INTERNAL_AI_URL.replace(/\/$/, '') + '/v1/chat';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as { response?: string; message?: string; error?: string };
  const text = data.response ?? data.message;
  if (res.ok && typeof text === 'string') return text.trim();
  throw new Error(data?.error ?? `Internal AI: ${res.status}`);
}

const CHAT_RATE_LIMIT_WINDOW_SEC = 60; // 1 minute
const CHAT_RATE_LIMIT_MAX = 30; // 30 requests per minute

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const rate = await enforceRateLimit(
      `rl:ai:chat:${ip}`,
      CHAT_RATE_LIMIT_MAX,
      CHAT_RATE_LIMIT_WINDOW_SEC,
    );
    if (!rate.allowed) {
      const limited = NextResponse.json(
        { response: 'Terlalu banyak permintaan. Silakan coba lagi sebentar ya.' },
        { status: 429 },
      );
      limited.headers.set('X-RateLimit-Limit', String(rate.limit));
      limited.headers.set('X-RateLimit-Remaining', String(rate.remaining));
      limited.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
      return limited;
    }

    const body = (await req.json()) as {
      message?: string;
      context?: Array<{ role?: string; content?: string }>;
    };
    const message = typeof body.message === 'string' ? body.message.trim() : '';
    if (!message) {
      return NextResponse.json(
        { response: 'Kirim dulu pertanyaan atau kalimat yang ingin kamu tanyakan ya.' },
        { status: 400 }
      );
    }

    // Security: Sanitize message length
    const sanitizedMessage = message.slice(0, 2000);

    const context = Array.isArray(body.context)
      ? body.context.map((m) => ({
          role: (m.role === 'assistant' ? 'assistant' : 'user') as 'user' | 'assistant',
          content: String(m.content ?? ''),
        }))
      : undefined;

    // Fetch database context untuk memberikan konteks yang lebih baik
    // Hanya fetch jika query mengandung kata kunci yang relevan (bukan hanya sapaan)
    const shouldFetchContext = sanitizedMessage.length > 5 && 
      !/^(hi|hai|halo|hello|hey|hallo|selamat|good|morning|afternoon|evening)/i.test(sanitizedMessage);
    
    const dbContext = shouldFetchContext 
      ? await fetchDatabaseContext(sanitizedMessage).catch(() => '')
      : '';

    const openAIMessages = buildOpenAIMessages(sanitizedMessage, context);

    // 1) Coba Ollama (custom AI) dulu jika diaktifkan
    if (USE_OLLAMA) {
      try {
        const text = await callOllama(sanitizedMessage, context, dbContext);
        const ok = NextResponse.json({ response: text });
        ok.headers.set('X-RateLimit-Limit', String(rate.limit));
        ok.headers.set('X-RateLimit-Remaining', String(rate.remaining));
        ok.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
        return ok;
      } catch (e) {
        console.warn('[AI] Ollama unavailable, falling back:', (e as Error).message);
      }
    }

    // 2) Coba internal AI (kalau URL diset dan body cocok)
    if (INTERNAL_AI_URL) {
      try {
        const internalBody = { message: sanitizedMessage, context: body.context };
        const text = await callInternalAI(internalBody);
        const ok = NextResponse.json({ response: text });
        ok.headers.set('X-RateLimit-Limit', String(rate.limit));
        ok.headers.set('X-RateLimit-Remaining', String(rate.remaining));
        ok.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
        return ok;
      } catch (e) {
        console.warn('[AI] Internal AI unavailable, falling back:', (e as Error).message);
      }
    }

    // 3) Groq (gratis) — prioritas kalau ada key
    if (GROQ_API_KEY) {
      try {
        const text = await callGroq(openAIMessages, dbContext);
        const ok = NextResponse.json({ response: text });
        ok.headers.set('X-RateLimit-Limit', String(rate.limit));
        ok.headers.set('X-RateLimit-Remaining', String(rate.remaining));
        ok.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
        return ok;
      } catch (e) {
        console.warn('[AI] Groq failed:', (e as Error).message);
      }
    }

    // 4) OpenAI
    if (OPENAI_API_KEY) {
      try {
        const text = await callOpenAI(openAIMessages, dbContext);
        const ok = NextResponse.json({ response: text });
        ok.headers.set('X-RateLimit-Limit', String(rate.limit));
        ok.headers.set('X-RateLimit-Remaining', String(rate.remaining));
        ok.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
        return ok;
      } catch (e) {
        console.warn('[AI] OpenAI failed:', (e as Error).message);
      }
    }

    const unavailable = NextResponse.json(
      {
        response:
          'Fitur AI belum dikonfigurasi. Tambahkan GROQ_API_KEY (gratis di console.groq.com) atau OPENAI_API_KEY di env agar asisten bisa menjawab.',
      },
      { status: 503 }
    );
    unavailable.headers.set('X-RateLimit-Limit', String(rate.limit));
    unavailable.headers.set('X-RateLimit-Remaining', String(rate.remaining));
    unavailable.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
    return unavailable;
  } catch (error) {
    console.error('[AI_CHAT_ERROR]', error);
    const errMsg = error instanceof Error ? error.message : '';
    const isNetwork =
      (error instanceof TypeError || (errMsg && (errMsg === 'fetch failed' || errMsg.includes('ECONNREFUSED'))));
    return NextResponse.json(
      {
        response: isNetwork
          ? 'Koneksi ke layanan AI gagal. Cek koneksi internet atau coba lagi sebentar.'
          : 'Terjadi kesalahan. Coba lagi ya.',
      },
      { status: 500 }
    );
  }
}

