import { NextRequest, NextResponse } from 'next/server';
import { LAJUKAN_AI_SEARCH_PROMPT } from '@/lib/aiSystemPrompt';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';

const GROQ_API_KEY = process.env.GROQ_API_KEY || '';
const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const AI_MODEL = process.env.AI_MODEL || 'gpt-3.5-turbo';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL = process.env.OLLAMA_MODEL || 'lajukan-ai';
const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const MARKETPLACE_URL = process.env.INTERNAL_MARKETPLACE_URL || process.env.NEXT_PUBLIC_MARKETPLACE_URL || 'http://localhost:8081';

const RATE_LIMIT_WINDOW_SEC = 60; // 1 minute
const RATE_LIMIT_MAX = 20; // 20 requests per minute
const MAX_SUGGESTIONS = 5;

type MarketplaceContextItem = {
  title?: string;
  type?: string;
  content_type?: string;
  summary?: string;
  metadata?: { sector?: string } | null;
  tags?: unknown;
};

type OllamaChatResponse = {
  message?: {
    content?: string;
  };
};

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
};

function asContextItem(value: unknown): MarketplaceContextItem | null {
  return value && typeof value === 'object' ? (value as MarketplaceContextItem) : null;
}

function normalizeSuggestion(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const clean = value.replace(/\s+/g, ' ').trim().slice(0, 140);
  if (clean.length < 2) return null;
  return clean;
}

function dedupeSuggestions(values: unknown[], limit = MAX_SUGGESTIONS): string[] {
  const seen = new Set<string>();
  const output: string[] = [];

  for (const value of values) {
    const clean = normalizeSuggestion(value);
    if (!clean) continue;
    const key = clean.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(clean);
    if (output.length >= limit) break;
  }

  return output;
}

function parseSuggestionText(content: string): string[] {
  const cleanContent = content.trim();
  if (!cleanContent) return [];

  try {
    const parsed = JSON.parse(cleanContent) as {
      suggestions?: unknown;
      queries?: unknown;
    };
    const payload = Array.isArray(parsed.suggestions)
      ? parsed.suggestions
      : Array.isArray(parsed.queries)
        ? parsed.queries
        : [];
    const suggestions = dedupeSuggestions(payload);
    if (suggestions.length > 0) return suggestions;
  } catch {
    // continue to bracket-based fallback
  }

  const match = cleanContent.match(/\[(.*?)\]/);
  if (!match?.[1]) return [];
  const rawItems = match[1].split(',').map((item) => item.trim().replace(/^["']|["']$/g, ''));
  return dedupeSuggestions(rawItems);
}

function buildFallbackSuggestions(query: string): string[] {
  const cleanQuery = query.trim().toLowerCase();
  const suggestions: string[] = [];

  if (cleanQuery) suggestions.push(`lajukan ${cleanQuery}`);

  const addWhenContains = (needles: string[], items: string[]) => {
    if (needles.some((needle) => cleanQuery.includes(needle))) {
      suggestions.push(...items);
    }
  };

  addWhenContains(['lajukan'], [
    'lajukan jobs freelance remote',
    'lajukan freelancer siap kerja',
    'lajukan supply produk dan jasa',
    'lajukan property sewa ruko',
    'lajukan sewa lapak kios food court',
  ]);

  addWhenContains(['job', 'jobs', 'loker', 'kerja', 'career', 'vacancy'], [
    'lajukan jobs indonesia',
    'lajukan lowongan kerja remote',
    'lajukan freelance developer',
  ]);

  addWhenContains(['freelancer', 'talent', 'jasa', 'service', 'designer', 'developer'], [
    'lajukan freelancer desain',
    'lajukan freelancer web developer',
    'lajukan talent marketing',
  ]);

  addWhenContains(['supply', 'supplier', 'produk', 'bahan', 'material', 'vendor', 'umkm'], [
    'lajukan supply bahan baku',
    'lajukan supplier produk umkm',
    'lajukan marketplace grosir',
  ]);

  addWhenContains(['property', 'properti', 'rumah', 'apartemen', 'ruko', 'real estate'], [
    'lajukan property rumah apartemen',
    'lajukan sewa ruko strategis',
    'lajukan investasi properti',
  ]);

  addWhenContains(['lapak', 'kios', 'food court', 'kantin', 'cafe', 'resto', 'cepat saji'], [
    'sewa lapak kios food court',
    'sewa lapak kantin cafe resto',
    'lajukan lapak umkm murah rame',
  ]);

  suggestions.push(
    'lajukan jobs freelancer supply property',
    'lajukan sewa ruko dan lapak kios',
    'lajukan marketplace produk dan jasa',
  );

  return dedupeSuggestions(suggestions);
}

async function fetchDatabaseContext(query: string): Promise<string> {
  try {
    // Fetch sample content from database to understand data structure
    const params = new URLSearchParams({
      q: query,
      limit: '10',
      offset: '0',
    });

    const res = await fetch(`${MARKETPLACE_URL}/v1/content?${params.toString()}`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000), // 5s timeout
    });

    if (!res.ok) return '';

    const payload = await res.json().catch(() => ({}));
    const data = Array.isArray(payload)
      ? payload
      : Array.isArray((payload as { items?: unknown[] }).items)
        ? ((payload as { items: unknown[] }).items)
        : [];
    if (data.length === 0) return '';

    // Build context from database results
    const context = data
      .slice(0, 5)
      .map((rawItem, idx: number) => {
        const item = asContextItem(rawItem);
        if (!item) return null;

        const title = item.title || '';
        const type = item.type || item.content_type || '';
        const summary = item.summary || '';
        const sector = item.metadata && typeof item.metadata === 'object' ? item.metadata.sector || '' : '';
        const tags = Array.isArray(item.tags) ? item.tags.slice(0, 3).join(', ') : '';
        
        return `${idx + 1}. [${type}] ${title}${summary ? ` - ${summary.slice(0, 80)}` : ''}${sector ? ` (Sector: ${sector})` : ''}${tags ? ` [Tags: ${tags}]` : ''}`;
      })
      .filter((line): line is string => Boolean(line))
      .join('\n');

    if (!context) return '';
    return `Available content in database:\n${context}`;
  } catch (error) {
    console.warn('[AI Search] Failed to fetch database context:', error);
    return '';
  }
}

async function callOllamaForSuggestions(query: string, dbContext: string): Promise<string[]> {
  const systemPrompt = `${LAJUKAN_AI_SEARCH_PROMPT}\n\n${dbContext ? `\n${dbContext}\n` : ''}\nBased on the user's search query and available data, suggest 3-5 relevant search queries. Return only a JSON object with "suggestions" key containing an array of strings.`;

  try {
    const res = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: `User search: "${query}"\n\nSuggest relevant search queries as JSON: {"suggestions": ["query1", "query2"]}` },
        ],
        stream: false,
        options: {
          temperature: 0.7,
          num_predict: 200,
        },
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (res.ok) {
      const data = (await res.json().catch(() => ({}))) as OllamaChatResponse;
      const content = data.message?.content || '';
      const suggestions = parseSuggestionText(content);
      if (suggestions.length > 0) {
        return suggestions;
      }
    }
  } catch (error) {
    console.warn('[AI Search] Ollama failed:', error);
  }
  return [];
}

async function callAI(query: string, dbContext: string): Promise<string[]> {
  // Try Ollama first if enabled
  if (USE_OLLAMA) {
    const suggestions = await callOllamaForSuggestions(query, dbContext);
    if (suggestions.length > 0) {
      return suggestions;
    }
  }

  const systemPrompt = `${LAJUKAN_AI_SEARCH_PROMPT}\n\n${dbContext ? `\n${dbContext}\n` : ''}\nBased on the user's search query and available data, suggest 3-5 relevant search queries that would help them find what they're looking for. Return only a JSON object with "suggestions" key containing an array of strings. Example: {"suggestions": ["query 1", "query 2", "query 3"]}`;

  const messages = [
    { role: 'system' as const, content: systemPrompt },
    { role: 'user' as const, content: `User search: "${query}"\n\nSuggest relevant search queries as a JSON object with "suggestions" array.` },
  ];

  // Try Groq first (faster, free)
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
          max_tokens: 200,
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(10000), // 10s timeout
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const suggestions = parseSuggestionText(content);
          if (suggestions.length > 0) {
            return suggestions;
          }
        }
      }
    } catch (error) {
      console.warn('[AI Search] Groq failed:', error);
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
          max_tokens: 200,
          temperature: 0.7,
          response_format: { type: 'json_object' },
        }),
        signal: AbortSignal.timeout(10000),
      });

      if (res.ok) {
        const data = (await res.json().catch(() => ({}))) as ChatCompletionResponse;
        const content = data.choices?.[0]?.message?.content;
        if (content) {
          const suggestions = parseSuggestionText(content);
          if (suggestions.length > 0) {
            return suggestions;
          }
        }
      }
    } catch (error) {
      console.warn('[AI Search] OpenAI failed:', error);
    }
  }

  return [];
}

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIp(req.headers);
    const rate = await enforceRateLimit(
      `rl:ai:search-suggestions:${ip}`,
      RATE_LIMIT_MAX,
      RATE_LIMIT_WINDOW_SEC,
    );
    if (!rate.allowed) {
      const limited = NextResponse.json(
        { error: 'Too many requests. Please try again later.' },
        { status: 429 },
      );
      limited.headers.set('X-RateLimit-Limit', String(rate.limit));
      limited.headers.set('X-RateLimit-Remaining', String(rate.remaining));
      limited.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
      return limited;
    }

    const body = await req.json();
    const query = typeof body.query === 'string' ? body.query.trim() : '';

    if (!query || query.length < 3) {
      const ok = NextResponse.json(
        { suggestions: [] },
        { status: 200 }
      );
      ok.headers.set('X-RateLimit-Limit', String(rate.limit));
      ok.headers.set('X-RateLimit-Remaining', String(rate.remaining));
      ok.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
      return ok;
    }

    // Security: Sanitize query
    const sanitizedQuery = query.slice(0, 200).replace(/[<>]/g, '');

    // Fetch database context
    const dbContext = await fetchDatabaseContext(sanitizedQuery);

    // Get AI suggestions
    const aiSuggestions = await callAI(sanitizedQuery, dbContext);
    const fallbackSuggestions = buildFallbackSuggestions(sanitizedQuery);
    const suggestions = dedupeSuggestions([...aiSuggestions, ...fallbackSuggestions], MAX_SUGGESTIONS);

    const ok = NextResponse.json(
      { suggestions },
      { status: 200 }
    );
    ok.headers.set('X-RateLimit-Limit', String(rate.limit));
    ok.headers.set('X-RateLimit-Remaining', String(rate.remaining));
    ok.headers.set('X-RateLimit-Reset', String(rate.resetInSec));
    return ok;
  } catch (error) {
    console.error('[AI_SEARCH_SUGGESTIONS_ERROR]', error);
    return NextResponse.json(
      { suggestions: [] },
      { status: 200 } // Return empty instead of error to not break UI
    );
  }
}

