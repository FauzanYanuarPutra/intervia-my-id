import { describe, expect, it } from 'vitest';
import {
  createDefaultPersonalAiBuilderConfig,
  sanitizePersonalAiBuilderConfig,
} from './builder';

describe('personal AI builder sanitization', () => {
  it('returns an isolated default config for every caller', () => {
    const first = createDefaultPersonalAiBuilderConfig();
    const second = createDefaultPersonalAiBuilderConfig();

    expect(first).not.toBe(second);
    expect(first.steps).not.toBe(second.steps);
    const original = second.branding.name;
    first.branding.name = 'Mutated locally';
    expect(second.branding.name).toBe(original);
  });

  it('rejects arbitrary accent CSS and restores a safe fallback', () => {
    const config = sanitizePersonalAiBuilderConfig({
      branding: {
        name: 'Test',
        shortDescription: 'Test',
        accentColor: 'url(javascript:alert(1))',
      },
    });

    expect(config.branding.accentColor).toMatch(/^#[0-9a-f]{3,6}$/i);
  });

  it('deduplicates behavior rules and keeps a usable model capability', () => {
    const config = sanitizePersonalAiBuilderConfig({
      instructions: {
        behaviorRules: ['Jujur', 'jujur', 'Ringkas'],
      },
      modelPolicy: {
        requiredCapabilities: ['not-real'],
      },
    });

    expect(config.instructions.behaviorRules).toEqual(['Jujur', 'Ringkas']);
    expect(config.modelPolicy.requiredCapabilities.length).toBeGreaterThan(0);
  });
});
