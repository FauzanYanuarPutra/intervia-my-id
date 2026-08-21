import { describe, expect, it } from 'vitest';
import {
  loadPersonalAiAgentsCache,
  normalizeCachedPersonalAiAgents,
  normalizeCachedPersonalAiMessages,
  normalizeCachedPersonalAiThreads,
} from './browserCache';

describe('personal AI browser cache normalization', () => {
  it('allows only display-safe agent fields', () => {
    const [agent] = normalizeCachedPersonalAiAgents([
      {
        id: 'agent-1',
        name: 'Usaha Helper',
        description: 'Visible description',
        visibility: 'unlisted',
        starter_prompts: ['Visible starter'],
        usage_count: 12,
        can_edit: true,
        share_id: 'must-not-survive',
        instructions: 'hidden owner prompt',
        builder_config: { secret: true },
        model_preference: 'openai',
        memory_enabled: true,
      },
    ]);

    expect(agent).toEqual({
      id: 'agent-1',
      name: 'Usaha Helper',
      description: 'Visible description',
      visibility: 'unlisted',
      starter_prompts: ['Visible starter'],
      usage_count: 12,
      can_edit: true,
    });
    expect(agent).not.toHaveProperty('share_id');
    expect(agent).not.toHaveProperty('instructions');
    expect(agent).not.toHaveProperty('builder_config');
  });

  it('bounds and sorts thread metadata without retaining extra fields', () => {
    const threads = normalizeCachedPersonalAiThreads([
      {
        id: 'older',
        agent_id: 'agent-1',
        title: 'Older',
        updated_at: '2026-08-13T01:00:00.000Z',
        internal: 'drop-me',
      },
      {
        id: 'newer',
        agent_id: 'agent-1',
        title: 'Newer',
        updated_at: '2026-08-13T02:00:00.000Z',
      },
    ]);

    expect(threads.map(thread => thread.id)).toEqual(['newer', 'older']);
    expect(threads[1]).not.toHaveProperty('internal');
  });

  it('keeps text and safe UI metadata but drops media and creation config', () => {
    const [message] = normalizeCachedPersonalAiMessages([
      {
        id: 'local_1',
        role: 'user',
        content: 'Tolong bantu',
        created_at: '2026-08-13T02:00:00.000Z',
        metadata: {
          client_ref: 'profile-ai:request-1',
          media: [{ url: '/private/object' }],
          creation_draft: { instruction: 'do not cache' },
          reply_to: {
            message_id: 'message-0',
            role: 'assistant',
            excerpt: 'Ringkas',
          },
          user_reaction: '👍',
        },
      },
    ]);

    expect(message.metadata).toEqual({
      client_ref: 'profile-ai:request-1',
      send_status: 'failed',
      user_reaction: '👍',
      reply_to: {
        message_id: 'message-0',
        role: 'assistant',
        excerpt: 'Ringkas',
      },
    });
    expect(message.metadata).not.toHaveProperty('media');
    expect(message.metadata).not.toHaveProperty('creation_draft');
  });

  it('deduplicates messages and retains only the newest fifty', () => {
    const messages = normalizeCachedPersonalAiMessages([
      ...Array.from({ length: 70 }, (_, index) => ({
        id: `message-${index}`,
        role: index % 2 ? 'assistant' : 'user',
        content: String(index),
        created_at: new Date(Date.UTC(2026, 0, 1, 0, index)).toISOString(),
      })),
      {
        id: 'message-69',
        role: 'assistant',
        content: 'canonical',
        created_at: new Date(Date.UTC(2026, 0, 1, 1, 9)).toISOString(),
      },
    ]);

    expect(messages).toHaveLength(50);
    expect(messages[0]?.id).toBe('message-20');
    expect(messages.at(-1)).toEqual(
      expect.objectContaining({ id: 'message-69', content: 'canonical' }),
    );
  });



  it('drops system messages so hidden prompt context is never browser-cached', () => {
    const messages = normalizeCachedPersonalAiMessages([
      {
        id: 'system-1',
        role: 'system',
        content: 'SECRET_SYSTEM_PROMPT',
        created_at: '2026-08-13T01:00:00.000Z',
      },
      {
        id: 'user-1',
        role: 'user',
        content: 'Halo',
        created_at: '2026-08-13T01:00:01.000Z',
      },
    ]);

    expect(messages).toHaveLength(1);
    expect(messages[0]).toMatchObject({ id: 'user-1', role: 'user' });
    expect(JSON.stringify(messages)).not.toContain('SECRET_SYSTEM_PROMPT');
  });

  it('fails open when browser storage is unavailable', async () => {
    await expect(loadPersonalAiAgentsCache('user-1')).resolves.toBeNull();
  });
});
