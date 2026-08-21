import { NextRequest, NextResponse } from 'next/server';
import { LAJUKAN_SYSTEM_PROMPT } from '@/lib/aiSystemPrompt';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

const CUSTOM_RATE_LIMIT_WINDOW_SEC = 60; // 1 minute
const CUSTOM_RATE_LIMIT_MAX = 30; // 30 requests per minute

async function callOllama(message: string, context?: ChatMessage[]): Promise<string> {
  const messages: Array<{ role: string; content: string }> = [];
  
  // Add system prompt
  messages.push({ role: 'system', content: LAJUKAN_SYSTEM_PROMPT });
  
  // Add context/history
  if (context && context.length > 0) {
    for (const msg of context.slice(-10)) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }
  
  // Add current message
  messages.push({ role: 'user', content: message });

  try {
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
  } catch (error) {
    console.error('[Ollama] Error:', error);
    throw error;
  }
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const rate = await enforceRateLimit(
      `rl:ai:custom-chat:${ip}`,
      CUSTOM_RATE_LIMIT_MAX,
      CUSTOM_RATE_LIMIT_WINDOW_SEC,
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

    if (!USE_OLLAMA) {
      return NextResponse.json(
        { response: 'Custom AI belum diaktifkan. Set USE_OLLAMA=true di environment variables.' },
        { status: 503 }
      );
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

    const response = await callOllama(sanitizedMessage, context);

    const ok = NextResponse.json({ response });
    ok.headers.set('X-RateLimit-Limit', String(rate.limit));
    ok.headers.set('X-RateLimit-Remaining', String(rate.remaining));
    ok.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
    return ok;
  } catch (error) {
    console.error('[CUSTOM_AI_CHAT_ERROR]', error);
    const errMsg = error instanceof Error ? error.message : '';
    const isNetwork =
      (error instanceof TypeError || (errMsg && (errMsg === 'fetch failed' || errMsg.includes('ECONNREFUSED'))));
    
    return NextResponse.json(
      {
        response: isNetwork
          ? 'Koneksi ke custom AI model gagal. Pastikan Ollama sudah berjalan dan OLLAMA_URL sudah benar.'
          : 'Terjadi kesalahan. Coba lagi ya.',
      },
      { status: 500 }
    );
  }
}
