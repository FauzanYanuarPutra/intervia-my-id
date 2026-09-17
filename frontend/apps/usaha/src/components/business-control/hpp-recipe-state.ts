export type HppRecipeItemDraft = {
  ingredientId: string;
  quantity: number;
  wastePercentOverride: number | null;
};

export type HppRecipeDraft = {
  recipeName: string;
  servings: number;
  items: HppRecipeItemDraft[];
};

function finiteNumber(value: number) {
  return Number.isFinite(value) ? value : 0;
}

export function recipeDraftFingerprint(draft: HppRecipeDraft) {
  return JSON.stringify({
    recipeName: draft.recipeName.trim(),
    servings: finiteNumber(draft.servings),
    items: draft.items.map(item => ({
      ingredientId: item.ingredientId,
      quantity: finiteNumber(item.quantity),
      wastePercentOverride: item.wastePercentOverride === null
        ? null
        : finiteNumber(item.wastePercentOverride),
    })),
  });
}

export function validateHppRecipeDraft(draft: HppRecipeDraft) {
  const errors: string[] = [];

  if (!Number.isFinite(draft.servings) || draft.servings <= 0) {
    errors.push('Jumlah hasil harus lebih dari 0.');
  }

  if (!draft.items.length) {
    errors.push('Tambahkan minimal satu bahan ke resep.');
    return errors;
  }

  const seenIngredientIds = new Set<string>();
  for (const item of draft.items) {
    if (!item.ingredientId) {
      errors.push('Pilih bahan untuk setiap baris resep.');
      continue;
    }

    if (seenIngredientIds.has(item.ingredientId)) {
      errors.push('Bahan yang sama tidak boleh dipakai dua kali.');
    }
    seenIngredientIds.add(item.ingredientId);

    if (!Number.isFinite(item.quantity) || item.quantity <= 0) {
      errors.push('Jumlah bahan yang dipakai harus lebih dari 0.');
    }

    if (
      item.wastePercentOverride !== null
      && (!Number.isFinite(item.wastePercentOverride)
        || item.wastePercentOverride < 0
        || item.wastePercentOverride >= 100)
    ) {
      errors.push('Susut khusus harus di antara 0% dan kurang dari 100%.');
    }
  }

  return [...new Set(errors)];
}
