import { NextRequest, NextResponse } from 'next/server';
import { LAJUKAN_AI_SEARCH_PROMPT } from '@/lib/aiSystemPrompt';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'lajukan-ai';
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const MARKETPLACE_URL = process.env.INTERNAL_MARKETPLACE_URL || process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'http://localhost:8081';

type ChatMessage = { role: 'user' | 'assistant' | 'system'; content: string };

async function fetchSearchResults(query: string, type?: string, hasImages?: boolean, sectors?: string[], limit: number = 20): Promise<any[]> {
  try {
    const params = new URLSearchParams();
    if (query.trim()) params.set('q', query.trim());
    if (type) params.set('type', type);
    if (hasImages) params.set('has_images', '1');
    if (sectors && sectors.length > 0) params.set('sector', sectors.join(','));
    params.set('limit', String(limit));
    params.set('offset', '0');

    const res = await fetch(`${MARKETPLACE_URL}/v1/content?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) return [];
    const payload = await res.json().catch(() => ({}));
    if (Array.isArray(payload)) return payload;
    if (payload && Array.isArray((payload as { items?: unknown[] }).items)) {
      return (payload as { items: any[] }).items;
    }
    return [];
  } catch (error) {
    console.warn('[AI Summary] Failed to fetch search results:', error);
    return [];
  }
}

async function callOllamaForSummary(query: string, results: any[], type?: string): Promise<string> {
  const systemPrompt = `Kamu adalah AI assistant untuk Lajukan — platform untuk mencari pekerjaan, jasa, produk, dan properti.

Tugas kamu:
- Menganalisis hasil pencarian dan memberikan ringkasan yang informatif
- Memahami struktur data: Products, Services, Jobs, Property, Images, Users
- Handle typo dan tetap memberikan ringkasan yang relevan
- Gunakan bahasa yang sama dengan query user (Indonesia/English)
- Ringkasan harus natural, informatif, dan membantu user memahami hasil pencarian

Struktur Data:
- Content Types: product (Produk), service (Jasa), job (Lowongan), property (Properti)
- Setiap item punya: title, summary, price, tags, sector, location, work_mode, dll

Format Ringkasan:
- Mulai dengan konteks pencarian (apa yang dicari user)
- Jelaskan jenis konten yang ditemukan (Products/Services/Jobs/Property)
- Highlight informasi penting: jumlah hasil, kategori utama, range harga (jika ada), lokasi (jika relevan)
- Berikan insight singkat tentang hasil pencarian
- Akhiri dengan saran untuk memperbaiki pencarian jika perlu

Jawab dalam bahasa yang sama dengan query user.`;

  // Build context from results
  const resultsContext = results.slice(0, 10).map((item: any, idx: number) => {
    const title = item.title || '';
    const itemType = item.type || '';
    const summary = item.summary || '';
    const price = item.price_cents ? `IDR ${(item.price_cents / 100).toLocaleString('id-ID')}` : '';
    const sector = item.metadata?.sector || '';
    const location = item.metadata?.location || '';
    const tags = Array.isArray(item.tags) ? item.tags.slice(0, 3).join(', ') : '';
    
    return `${idx + 1}. [${itemType}] ${title}${summary ? ` - ${summary.slice(0, 100)}` : ''}${price ? ` (${price})` : ''}${sector ? ` | Sector: ${sector}` : ''}${location ? ` | Lokasi: ${location}` : ''}${tags ? ` | Tags: ${tags}` : ''}`;
  }).join('\n');

  const userPrompt = `User mencari: "${query}"${type ? ` (Filter: ${type})` : ''}

Hasil pencarian (${results.length} item):
${resultsContext || 'Tidak ada hasil yang ditemukan.'}

Beri ringkasan yang informatif tentang hasil pencarian ini.`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 500,
        },
      }),
      signal: AbortSignal.timeout(30000),
    });

    if (res.ok) {
      const data = await res.json();
      return data.message?.content?.trim() || '';
    }
  } catch (error) {
    console.warn('[AI Summary] Ollama failed:', error);
  }
  return '';
}

async function callAIForSummary(query: string, results: any[], type?: string): Promise<string> {
  // Try Ollama first if enabled
  if (USE_OLLAMA) {
    const summary = await callOllamaForSummary(query, results, type);
    if (summary) return summary;
  }

  const systemPrompt = `Kamu adalah AI assistant untuk Lajukan — platform untuk mencari pekerjaan, jasa, produk, dan properti.

Tugas kamu:
- Menganalisis hasil pencarian dan memberikan ringkasan yang informatif
- Memahami struktur data: Products, Services, Jobs, Property, Images, Users
- Handle typo dan tetap memberikan ringkasan yang relevan
- Gunakan bahasa yang sama dengan query user (Indonesia/English)
- Ringkasan harus natural, informatif, dan membantu user memahami hasil pencarian

Format Ringkasan:
- Mulai dengan konteks pencarian
- Jelaskan jenis konten yang ditemukan
- Highlight informasi penting: jumlah hasil, kategori utama, range harga, lokasi
- Berikan insight singkat tentang hasil pencarian
- Akhiri dengan saran jika perlu`;

  const resultsContext = results.slice(0, 10).map((item: any, idx: number) => {
    const title = item.title || '';
    const itemType = item.type || '';
    const summary = item.summary || '';
    const price = item.price_cents ? `IDR ${(item.price_cents / 100).toLocaleString('id-ID')}` : '';
    const sector = item.metadata?.sector || '';
    const location = item.metadata?.location || '';
    
    return `${idx + 1}. [${itemType}] ${title}${summary ? ` - ${summary.slice(0, 100)}` : ''}${price ? ` (${price})` : ''}${sector ? ` | ${sector}` : ''}${location ? ` | ${location}` : ''}`;
  }).join('\n');

  const messages: ChatMessage[] = [
    { role: 'system', content: systemPrompt },
    { role: 'user', content: `User mencari: "${query}"${type ? ` (Filter: ${type})` : ''}\n\nHasil pencarian:\n${resultsContext || 'Tidak ada hasil.'}\n\nBeri ringkasan yang informatif.` },
  ];

  // Try Groq
  if (GROQ_API_KEY) {
    try {
      const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'llama-3.1-8b-instant',
          messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch (error) {
      console.warn('[AI Summary] Groq failed:', error);
    }
  }

  // Fallback to OpenAI
  if (OPENAI_API_KEY) {
    try {
      const res = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: AI_MODEL,
          messages,
          max_tokens: 500,
          temperature: 0.7,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (res.ok) {
        const data = await res.json();
        const text = data.choices?.[0]?.message?.content?.trim();
        if (text) return text;
      }
    } catch (error) {
      console.warn('[AI Summary] OpenAI failed:', error);
    }
  }

  return '';
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const type = typeof body.type === 'string' ? body.type : undefined;
    const hasImages = body.has_images === true;
    const sectors = Array.isArray(body.sectors) ? body.sectors : [];

    if (!query) {
      return NextResponse.json({ summary: null }, { status: 200 });
    }

    // Fetch search results from database
    const results = await fetchSearchResults(query, type, hasImages, sectors, 20);

    // Generate AI summary
    const summary = await callAIForSummary(query, results, type);

    return NextResponse.json({ summary: summary || null }, { status: 200 });
  } catch (error) {
    console.error('[AI_SEARCH_SUMMARY_ERROR]', error);
    return NextResponse.json({ summary: null }, { status: 200 });
  }
}

