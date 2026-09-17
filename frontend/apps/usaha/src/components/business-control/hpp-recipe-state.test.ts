import { describe, expect, it } from 'vitest';

import {
  recipeDraftFingerprint,
  validateHppRecipeDraft,
  type HppRecipeDraft,
} from './hpp-recipe-state';

const validDraft: HppRecipeDraft = {
  recipeName: 'Jus alpukat',
  servings: 2,
  items: [
    { ingredientId: 'alpukat', quantity: 300, wastePercentOverride: null },
    { ingredientId: 'cup', quantity: 2, wastePercentOverride: 0 },
  ],
};

describe('HPP recipe draft state', () => {
  it('accepts a structurally valid recipe', () => {
    expect(validateHppRecipeDraft(validDraft)).toEqual([]);
  });

  it('rejects duplicate ingredients, zero quantity, and invalid servings', () => {
    const errors = validateHppRecipeDraft({
      ...validDraft,
      servings: 0,
      items: [
        { ingredientId: 'alpukat', quantity: 0, wastePercentOverride: null },
        { ingredientId: 'alpukat', quantity: 1, wastePercentOverride: 100 },
      ],
    });

    expect(errors).toContain('Jumlah hasil harus lebih dari 0.');
    expect(errors).toContain('Bahan yang sama tidak boleh dipakai dua kali.');
    expect(errors).toContain('Jumlah bahan yang dipakai harus lebih dari 0.');
    expect(errors).toContain('Susut khusus harus di antara 0% dan kurang dari 100%.');
  });

  it('uses a stable fingerprint for equivalent saved and edited drafts', () => {
    expect(recipeDraftFingerprint(validDraft)).toBe(recipeDraftFingerprint({
      ...validDraft,
      recipeName: '  Jus alpukat  ',
    }));
  });
});
