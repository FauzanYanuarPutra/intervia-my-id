import { NextRequest, NextResponse } from 'next/server';

const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'llama3.2:3b';
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';

type TicketPayload = {
  subject?: string;
  category?: string;
  priority?: string;
  status?: string;
  requester_email?: string;
};

type ReplyPayload = {
  author_role?: string;
  body?: string;
  created_at?: string;
  is_internal?: boolean;
};

function sanitize(value?: string) {
  return typeof value === 'string' ? value.trim() : '';
}

function buildPrompt(ticket: TicketPayload, replies: ReplyPayload[]) {
  const history = replies
    .filter((reply) => !reply?.is_internal)
    .slice(-6)
    .map((reply, index) => {
      const role = sanitize(reply.author_role) || 'unknown';
      const body = sanitize(reply.body);
      if (!body) return '';
      return `${index + 1}. [${role}] ${body}`;
    })
    .filter(Boolean)
    .join('\n');

  return `
Tugas: buat draf balasan support agent yang ringkas, sopan, dan jelas.

Konteks ticket:
- Subject: ${sanitize(ticket.subject) || '-'}
- Category: ${sanitize(ticket.category) || '-'}
- Priority: ${sanitize(ticket.priority) || '-'}
- Status: ${sanitize(ticket.status) || '-'}
- Customer: ${sanitize(ticket.requester_email) || '-'}

Riwayat percakapan (terbaru di bawah):
${history || '- (belum ada balasan)'}

Instruksi:
- Jawab dalam Bahasa Indonesia.
- Tanyakan info penting yang belum ada.
- Berikan langkah troubleshooting sederhana jika relevan.
- Jangan membuat janji yang tidak pasti.
- Hasilkan hanya isi balasan tanpa header.
`.trim();
}

export async function POST(req: NextRequest) {
  if (!USE_OLLAMA) {
    return NextResponse.json(
      { error: 'AI belum diaktifkan. Set USE_OLLAMA=true di environment.' },
      { status: 503 },
    );
  }

  try {
    const body = (await req.json().catch(() => ({}))) as {
      ticket?: TicketPayload;
      replies?: ReplyPayload[];
    };

    const prompt = buildPrompt(body.ticket || {}, Array.isArray(body.replies) ? body.replies : []);

    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        messages: [
          {
            role: 'system',
            content:
              'Kamu adalah agen support Lajukan. Buat balasan yang ramah, ringkas, dan actionable.',
          },
          { role: 'user', content: prompt },
        ],
        options: { temperature: 0.4, num_predict: 300 },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json({ error: text || 'AI gagal merespons.' }, { status: 500 });
    }

    const data = (await res.json().catch(() => ({}))) as {
      message?: { content?: string };
    };
    const reply = sanitize(data?.message?.content) || 'Maaf, AI belum bisa membuat balasan.';

    return NextResponse.json({ reply });
  } catch (error) {
    console.error('[CRM_AI_SUPPORT_REPLY_ERROR]', error);
    return NextResponse.json({ error: 'AI error. Coba lagi ya.' }, { status: 500 });
  }
}
