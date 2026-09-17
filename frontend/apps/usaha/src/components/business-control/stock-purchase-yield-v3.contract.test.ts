import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/components/business-control/StockPurchaseYieldWorkspace.tsx', 'utf8');

describe('inventory UX V3', () => {
  it('uses searchable entity choices and visible payment choices', () => {
    expect(source).toContain('SearchPicker');
    expect(source).toContain('ChoiceChips');
    expect(source).toContain('EffectPreview');
    expect(source).not.toMatch(/<select[\s\S]*?value=\{ingredientId\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{yieldIngredientId\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{yieldProductId\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{primaryProductId\}/);
    expect(source).not.toMatch(/<select[\s\S]*?value=\{primaryIngredientId\}/);
  });

  it('preserves durable Wave2 action names', () => {
    expect(source).toContain("action: 'purchase'");
    expect(source).toContain("action: 'create_yield_observation'");
    expect(source).toContain("action: 'set_primary_material'");
  });
});
