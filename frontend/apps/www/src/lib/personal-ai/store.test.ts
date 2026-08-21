import { describe, expect, it } from 'vitest';
import { createDefaultPersonalAiBuilderConfig } from './builder';
import {
  assertPersonalAiQuotaAvailable,
  canPersistPersonalAiMemory,
  createDefaultPersonalAiAgent,
  hashPersonalAiChatRequest,
  normalizePersonalAiClientRef,
  personalAiLimits,
  PersonalAiQuotaExceededError,
  resolvePersonalAiFileStorePolicy,
  resolvePersonalAiQuickButtonInstruction,
  sanitizePersonalAiMessageMetadata,
  serializePersonalAiAgentForViewer,
  type PersonalAiAgent,
} from './store';

function makeAgent(): PersonalAiAgent {
  const builderConfig = structuredClone(createDefaultPersonalAiBuilderConfig());
  builderConfig.instructions.baseInstruction = 'SECRET_BUILDER_INSTRUCTION';
  builderConfig.instructions.negativeInstruction = 'SECRET_NEGATIVE_RULE';
  builderConfig.modelPolicy = {
    mode: 'locked',
    preferredModelId: 'secret-provider-model',
    requiredCapabilities: ['text'],
  };

  return {
    id: 'agent_internal_id',
    owner_id: 'owner_123',
    name: 'Asisten Toko Mawar',
    description: 'Membantu menjawab pertanyaan umum pelanggan.',
    visibility: 'unlisted',
    instructions: 'SECRET_OWNER_SYSTEM_PROMPT',
    tone: 'SECRET_OWNER_TONE',
    model_preference: 'openai',
    temperature: 0.73,
    quick_buttons: [
      {
        id: 'button_internal_id',
        label: 'Tanya stok',
        prompt: 'Bantu saya menanyakan ketersediaan stok.',
        instructionAppend: 'SECRET_BUTTON_INSTRUCTION',
        negativeInstruction: 'SECRET_BUTTON_NEGATIVE_RULE',
      },
    ],
    starter_prompts: ['Apa yang bisa dibantu hari ini?'],
    builder_config: builderConfig,
    memory_enabled: true,
    share_id: 'public_share_token',
    usage_count: 99,
    created_at: '2026-08-11T00:00:00.000Z',
    updated_at: '2026-08-11T01:00:00.000Z',
    can_edit: true,
  };
}

describe('personal AI client serialization', () => {
  it('returns only the explicit shared-agent allowlist to a non-owner', () => {
    const exposed = serializePersonalAiAgentForViewer(
      makeAgent(),
      'viewer_456',
    );

    expect(exposed).toEqual({
      id: 'agent_internal_id',
      name: 'Asisten Toko Mawar',
      description: 'Membantu menjawab pertanyaan umum pelanggan.',
      visibility: 'unlisted',
      share_id: 'public_share_token',
      starter_prompts: ['Apa yang bisa dibantu hari ini?'],
      quick_buttons: [
        {
          id: 'shared-action-1',
          label: 'Tanya stok',
          prompt: 'Bantu saya menanyakan ketersediaan stok.',
        },
      ],
      can_edit: false,
    });
    expect(Object.keys(exposed).sort()).toEqual(
      [
        'can_edit',
        'description',
        'id',
        'name',
        'quick_buttons',
        'share_id',
        'starter_prompts',
        'visibility',
      ].sort(),
    );

    const serialized = JSON.stringify(exposed);
    for (const forbidden of [
      'owner_123',
      'button_internal_id',
      'SECRET_OWNER_SYSTEM_PROMPT',
      'SECRET_OWNER_TONE',
      'SECRET_BUILDER_INSTRUCTION',
      'SECRET_NEGATIVE_RULE',
      'secret-provider-model',
      'SECRET_BUTTON_INSTRUCTION',
      'SECRET_BUTTON_NEGATIVE_RULE',
      'memory_enabled',
      'usage_count',
      'temperature',
      'model_preference',
      'builder_config',
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });

  it('keeps the complete owner response unchanged', () => {
    const agent = makeAgent();
    const exposed = serializePersonalAiAgentForViewer(agent, agent.owner_id);

    expect(exposed).toBe(agent);
    expect(exposed).toEqual(agent);
    expect(exposed).toMatchObject({
      owner_id: 'owner_123',
      instructions: 'SECRET_OWNER_SYSTEM_PROMPT',
      model_preference: 'openai',
      memory_enabled: true,
      builder_config: expect.objectContaining({
        instructions: expect.objectContaining({
          baseInstruction: 'SECRET_BUILDER_INSTRUCTION',
        }),
      }),
    });
  });

  it('applies the same boundary to a public agent viewed by a non-owner', () => {
    const exposed = serializePersonalAiAgentForViewer(
      { ...makeAgent(), visibility: 'public' },
      'viewer_456',
    );

    expect(exposed).toMatchObject({
      id: 'agent_internal_id',
      visibility: 'public',
      can_edit: false,
    });
    expect(exposed).not.toHaveProperty('owner_id');
    expect(exposed).not.toHaveProperty('instructions');
    expect(exposed).not.toHaveProperty('builder_config');
    expect(exposed).not.toHaveProperty('model_preference');
    expect(exposed).not.toHaveProperty('memory_enabled');
  });

  it('fails closed if a private agent is serialized for a non-owner', () => {
    const agent = { ...makeAgent(), visibility: 'private' as const };

    expect(() =>
      serializePersonalAiAgentForViewer(agent, 'viewer_456'),
    ).toThrow('Private AI cannot be serialized for a non-owner.');
  });

  it('removes a historical shared owner id from message metadata', () => {
    const storedMetadata = {
      provider: 'guided-creation',
      provider_errors: [
        'internal: http://private-ai:8080 failed with token=secret',
      ],
      shared_agent_owner_id: 'owner_123',
      creation_flow: { status: 'collecting' },
    };

    expect(sanitizePersonalAiMessageMetadata(storedMetadata)).toEqual({
      provider: 'guided-creation',
      provider_errors: ['provider_unavailable'],
      creation_flow: { status: 'collecting' },
    });
    expect(storedMetadata.shared_agent_owner_id).toBe('owner_123');
    expect(storedMetadata.provider_errors).toEqual([
      'internal: http://private-ai:8080 failed with token=secret',
    ]);
  });

  it('keeps memory off for a newly provisioned personal AI', () => {
    const agent = createDefaultPersonalAiAgent('new_owner');

    expect(agent.memory_enabled).toBe(false);
  });

  it('requires the shared recipient to opt in independently', () => {
    expect(
      canPersistPersonalAiMemory({
        agentOwnerId: 'owner_123',
        viewerUserId: 'viewer_456',
        ownerMemoryEnabled: true,
      }),
    ).toBe(false);
    expect(
      canPersistPersonalAiMemory({
        agentOwnerId: 'owner_123',
        viewerUserId: 'viewer_456',
        ownerMemoryEnabled: true,
        sharedRecipientConsent: true,
      }),
    ).toBe(true);
    expect(
      canPersistPersonalAiMemory({
        agentOwnerId: 'owner_123',
        viewerUserId: 'owner_123',
        ownerMemoryEnabled: false,
        sharedRecipientConsent: true,
      }),
    ).toBe(false);
  });

  it('resolves hidden quick-button instructions only from a server-known id', () => {
    const agent = makeAgent();
    expect(
      resolvePersonalAiQuickButtonInstruction({
        agent,
        viewerUserId: 'viewer_456',
        publicButtonId: 'shared-action-1',
      }),
    ).toBe(
      'SECRET_BUTTON_INSTRUCTION\nNegative instruction: SECRET_BUTTON_NEGATIVE_RULE',
    );
    expect(
      resolvePersonalAiQuickButtonInstruction({
        agent,
        viewerUserId: 'viewer_456',
        publicButtonId: 'button_internal_id',
      }),
    ).toBe('');
    expect(
      resolvePersonalAiQuickButtonInstruction({
        agent,
        viewerUserId: agent.owner_id,
        publicButtonId: 'button_internal_id',
      }),
    ).toContain('SECRET_BUTTON_INSTRUCTION');
  });

  it('validates stable client refs and hashes equivalent payloads consistently', () => {
    expect(normalizePersonalAiClientRef('profile-ai:request_123')).toBe(
      'profile-ai:request_123',
    );
    expect(normalizePersonalAiClientRef('too short')).toBeNull();
    expect(normalizePersonalAiClientRef('profile-ai:invalid value')).toBeNull();
    expect(hashPersonalAiChatRequest({ b: 2, a: 1 })).toBe(
      hashPersonalAiChatRequest({ a: 1, b: 2 }),
    );
    expect(hashPersonalAiChatRequest({ a: 1 })).not.toBe(
      hashPersonalAiChatRequest({ a: 2 }),
    );
  });


  it('drops obvious secret-bearing metadata recursively while keeping safe UI data', () => {
    expect(
      sanitizePersonalAiMessageMetadata({
        provider: 'ai-service',
        token: 'SECRET_TOKEN',
        nested: {
          password: 'SECRET_PASSWORD',
          safe: 'visible',
        },
      }),
    ).toEqual({
      provider: 'ai-service',
      nested: { safe: 'visible' },
    });
  });

  it('fails closed for malformed provider error metadata', () => {
    expect(
      sanitizePersonalAiMessageMetadata({
        provider_errors: 'private provider error',
      }),
    ).toEqual({ provider_errors: [] });
  });
});

describe('personal AI filesystem storage policy', () => {
  it('fails closed in production unless filesystem storage is explicitly enabled', () => {
    expect(
      resolvePersonalAiFileStorePolicy({
        NODE_ENV: 'production',
        PERSONAL_AI_STORE_DIR: '/var/lib/lajukan/personal-ai',
      }),
    ).toEqual({
      allowed: false,
      directory: null,
      reason: 'production_opt_in_required',
    });
  });

  it('requires an explicit non-temporary directory for a production opt-in', () => {
    expect(
      resolvePersonalAiFileStorePolicy({
        NODE_ENV: 'production',
        PERSONAL_AI_ALLOW_FILE_STORE: 'true',
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'production_directory_required',
    });

    expect(
      resolvePersonalAiFileStorePolicy({
        NODE_ENV: 'production',
        PERSONAL_AI_ALLOW_FILE_STORE: 'true',
        PERSONAL_AI_STORE_DIR: './runtime/personal-ai',
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'production_absolute_directory_required',
    });

    expect(
      resolvePersonalAiFileStorePolicy({
        NODE_ENV: 'production',
        PERSONAL_AI_ALLOW_FILE_STORE: 'true',
        PERSONAL_AI_STORE_DIR: '/tmp/lajukan-personal-ai',
      }),
    ).toMatchObject({
      allowed: false,
      reason: 'temporary_directory_rejected',
    });
  });

  it('accepts an explicit durable-looking production directory', () => {
    const policy = resolvePersonalAiFileStorePolicy({
      NODE_ENV: 'production',
      PERSONAL_AI_ALLOW_FILE_STORE: '1',
      PERSONAL_AI_STORE_DIR: '/var/lib/lajukan/personal-ai',
    });

    expect(policy.allowed).toBe(true);
    expect(policy.reason).toBe('explicit_opt_in');
    expect(policy.directory?.replace(/\\/g, '/')).toContain(
      '/var/lib/lajukan/personal-ai',
    );
  });

  it('keeps the local development fallback available outside production', () => {
    const policy = resolvePersonalAiFileStorePolicy(
      { NODE_ENV: 'test' },
      '/workspace/frontend/www',
    );

    expect(policy.allowed).toBe(true);
    expect(policy.reason).toBe('development_or_test');
    expect(policy.directory?.replace(/\\/g, '/')).toContain(
      '/workspace/.runtime/personal-ai',
    );
  });
});

describe('personal AI canonical-history quotas', () => {
  it('accepts writes at the boundary without trimming existing history', () => {
    expect(() =>
      assertPersonalAiQuotaAvailable({
        resource: 'threads',
        currentCount: personalAiLimits.maxThreadsPerUser - 1,
      }),
    ).not.toThrow();
    expect(() =>
      assertPersonalAiQuotaAvailable({
        resource: 'messages',
        currentCount: personalAiLimits.maxMessagesPerThread - 2,
        additionalCount: 2,
      }),
    ).not.toThrow();
  });

  it('returns a typed thread quota instead of authorizing implicit deletion', () => {
    let caught: unknown;
    try {
      assertPersonalAiQuotaAvailable({
        resource: 'threads',
        currentCount: personalAiLimits.maxThreadsPerUser,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toBeInstanceOf(PersonalAiQuotaExceededError);
    expect(caught).toMatchObject({
      code: 'personal_ai_quota_exceeded',
      resource: 'threads',
      limit: 80,
    });
    expect((caught as Error).message).toContain('Hapus chat secara manual');
  });

  it('rejects an atomic response pair when it would exceed message capacity', () => {
    let caught: unknown;
    try {
      assertPersonalAiQuotaAvailable({
        resource: 'messages',
        currentCount: personalAiLimits.maxMessagesPerThread - 1,
        additionalCount: 2,
      });
    } catch (error) {
      caught = error;
    }

    expect(caught).toMatchObject({
      code: 'personal_ai_quota_exceeded',
      resource: 'messages',
      limit: 80,
    });
    expect((caught as Error).message).toContain(
      'riwayat lama tidak dihapus otomatis',
    );
  });
});
