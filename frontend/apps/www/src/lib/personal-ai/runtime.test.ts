import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createDefaultPersonalAiBuilderConfig } from './builder';
import type { PersonalAiAgent, PersonalAiMessage } from './store';

function makeAgent(): PersonalAiAgent {
  return {
    id: 'agent-1',
    owner_id: 'owner-1',
    name: 'Asisten Usaha',
    description: 'Test',
    visibility: 'private',
    instructions: 'Bantu user dengan praktis.',
    tone: 'ringkas',
    // Deliberately legacy/direct-looking: runtime must still use ai_service only.
    model_preference: 'openai',
    temperature: 0.4,
    quick_buttons: [],
    starter_prompts: [],
    builder_config: createDefaultPersonalAiBuilderConfig(),
    memory_enabled: false,
    share_id: 'share-1',
    usage_count: 0,
    created_at: '2026-08-21T00:00:00.000Z',
    updated_at: '2026-08-21T00:00:00.000Z',
  };
}

describe('Personal AI runtime gateway boundary', () => {
  beforeEach(() => {
    vi.resetModules();

    process.env.INTERNAL_AI_URL = 'http://ai_service:8080';
    process.env.AI_SERVICE_TOKEN = 'test-token';

    // These are deliberately configured. The runtime must ignore all of them
    // and still call only the Rust gateway.
    process.env.USE_OLLAMA = 'true';
    process.env.OLLAMA_URL = 'http://ollama:11434';
    process.env.GROQ_API_KEY = 'must-not-be-used';
    process.env.OPENAI_API_KEY = 'must-not-be-used';

    delete process.env.PERSONAL_AI_DOMAIN_DATASET_FILE;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.USE_OLLAMA;
    delete process.env.OLLAMA_URL;
    delete process.env.GROQ_API_KEY;
    delete process.env.OPENAI_API_KEY;
  });

  it('calls only Rust ai_service and preserves authorized personalization/media context', async () => {
    const fetchMock = vi.fn(async (url: string, init?: RequestInit) => {
      expect(url).toBe('http://ai_service:8080/v1/chat');

      const headers = init?.headers as Record<string, string>;
      expect(headers.Authorization).toBe('Bearer test-token');

      const body = JSON.parse(String(init?.body)) as Record<string, any>;

      expect(body.task).toBe('chat');
      expect(body.message).toBe('Apa ini?');
      expect(body.locale).toBe('id');
      expect(body.response_mode).toBe('text');

      expect(body.agent).toEqual(
        expect.objectContaining({
          id: 'agent-1',
          name: 'Asisten Usaha',
          instructions: 'Bantu user dengan praktis.',
          tone: 'ringkas',
        }),
      );

      expect(body.context.personal_ai.legacy_model_preference).toBe('openai');
      expect(body.context.personal_ai.builder).toBeTruthy();
      expect(body.context.personal_ai.domain_reference).toContain(
        'Referensi domain Lajukan',
      );

      expect(body.media).toHaveLength(1);
      expect(body.media[0].data_url).toMatch(/^data:image\/png;base64,/);
      expect(body.media[0]).not.toHaveProperty('url');

      expect(body.messages.some((item: any) => item.role === 'system')).toBe(true);

      return new Response(
        JSON.stringify({
          status: 'success',
          response: 'Ini gambar uji.',
          provider: 'vllm',
          model: 'qwen3-vl:2b',
          warnings: [],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const { runPersonalAi } = await import('./runtime');

    const result = await runPersonalAi({
      agent: makeAgent(),
      memory: null,
      message: 'Apa ini?',
      history: [],
      locale: 'id',
      media: [
        {
          kind: 'image',
          name: 'test.png',
          mime: 'image/png',
          size: 3,
          dataUrl: 'data:image/png;base64,YWJj',
          url: 'https://private.example/object',
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result).toMatchObject({
      response: 'Ini gambar uji.',
      provider: 'ai-service',
      model: 'qwen3-vl:2b',
    });
  });

  it('preserves reply/history and caller-authorized memory without forwarding private owner fields', async () => {
    const history: PersonalAiMessage[] = [
      {
        id: 'message-1',
        thread_id: 'thread-1',
        agent_id: 'agent-1',
        owner_id: 'owner-1',
        role: 'user',
        content: 'Yang ukuran kecil.',
        metadata: {
          reply_to: {
            message_id: 'message-0',
            role: 'assistant',
            excerpt: 'Mau ukuran berapa?',
          },
        },
        created_at: '2026-08-21T00:00:00.000Z',
      },
    ];

    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body)) as Record<string, any>;

      expect(body.messages).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            role: 'user',
            content: expect.stringContaining('[Membalas pesan] Mau ukuran berapa?'),
          }),
        ]),
      );

      expect(body.memory).toMatchObject({
        summary: 'User sering mencari alat usaha kecil.',
      });

      expect(body.agent).not.toHaveProperty('owner_id');
      expect(body.agent).not.toHaveProperty('share_id');
      expect(body.context.personal_ai).not.toHaveProperty('owner_id');

      return new Response(
        JSON.stringify({
          status: 'success',
          response: 'Baik, saya prioritaskan ukuran kecil.',
          model: 'qwen3:4b',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const { runPersonalAi } = await import('./runtime');

    const result = await runPersonalAi({
      agent: makeAgent(),
      memory: {
        agent_id: 'agent-1',
        owner_id: 'owner-1',
        summary: 'User sering mencari alat usaha kecil.',
        facts: {
          topics: ['alat usaha'],
          user_terms: ['ukuran kecil'],
          last_messages: ['Cari mesin kecil'],
        },
        updated_at: '2026-08-21T00:00:00.000Z',
      },
      message: 'Lanjut.',
      history,
      locale: 'id',
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('ai-service');
  });

  it('never fetches media URLs and never falls back to direct providers when gateway fails', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      expect(url).toBe('http://ai_service:8080/v1/chat');
      return new Response(
        JSON.stringify({
          status: 'error',
          error: 'PROVIDER_DOWN',
        }),
        { status: 502, headers: { 'Content-Type': 'application/json' } },
      );
    });

    vi.stubGlobal('fetch', fetchMock);

    const { runPersonalAi } = await import('./runtime');

    const result = await runPersonalAi({
      agent: makeAgent(),
      memory: null,
      message: 'Tolong baca file ini.',
      history: [],
      locale: 'id',
      media: [
        {
          kind: 'document',
          name: 'dokumen.pdf',
          mime: 'application/pdf',
          size: 100,
          url: 'http://169.254.169.254/latest/meta-data',
          text: 'Cuplikan yang sudah diparsing oleh caller.',
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.provider).toBe('safe-fallback');
    expect(result.provider_errors.join(' ')).toContain('ai-service:PROVIDER_DOWN');
  });
});
