export type ProductModifierRecipeEffect = {
  ingredient_id: string;
  operation: 'add' | 'set';
  quantity: number;
};

export type ProductModifierOption = {
  id: string;
  label: string;
  price_delta_cents: number;
  is_default: boolean;
  enabled: boolean;
  recipe_effects?: ProductModifierRecipeEffect[];
};

export type ProductModifierGroup = {
  id: string;
  name: string;
  selection_mode: 'single' | 'multiple';
  required: boolean;
  min_selections: number;
  max_selections: number;
  options: ProductModifierOption[];
};

export type ProductModifierSelection = {
  group_id: string;
  option_ids: string[];
};

type UnknownRecord = Record<string, unknown>;

function objectValue(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function stringValue(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function finiteNumber(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function parseRecipeEffects(value: unknown): ProductModifierRecipeEffect[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const effects = value.flatMap(candidate => {
    const effect = objectValue(candidate);
    if (!effect) return [];

    const ingredientId = stringValue(effect.ingredient_id);
    const operation = effect.operation;
    const quantity = finiteNumber(effect.quantity, Number.NaN);
    if (
      !ingredientId ||
      (operation !== 'add' && operation !== 'set') ||
      !Number.isFinite(quantity) ||
      quantity < 0
    ) {
      return [];
    }

    return [{ ingredient_id: ingredientId, operation, quantity } satisfies ProductModifierRecipeEffect];
  });

  return effects.length ? effects : undefined;
}

export function parseProductModifierGroups(
  metadata: Record<string, unknown> | null | undefined,
): ProductModifierGroup[] {
  const rawGroups = metadata?.modifier_groups;
  if (!Array.isArray(rawGroups)) return [];

  const groups: ProductModifierGroup[] = [];
  const seenGroups = new Set<string>();

  for (const candidate of rawGroups) {
    const group = objectValue(candidate);
    if (!group) continue;

    const id = stringValue(group.id);
    const name = stringValue(group.name);
    const selectionMode = group.selection_mode;
    if (
      !id ||
      !name ||
      (selectionMode !== 'single' && selectionMode !== 'multiple') ||
      seenGroups.has(id)
    ) {
      continue;
    }

    const rawOptions = Array.isArray(group.options) ? group.options : [];
    const options: ProductModifierOption[] = [];
    const seenOptions = new Set<string>();

    for (const optionCandidate of rawOptions) {
      const option = objectValue(optionCandidate);
      if (!option || option.enabled === false) continue;

      const optionId = stringValue(option.id);
      const label = stringValue(option.label);
      if (!optionId || !label || seenOptions.has(optionId)) continue;

      const priceDelta = finiteNumber(option.price_delta_cents, Number.NaN);
      if (!Number.isFinite(priceDelta)) continue;

      const recipeEffects = parseRecipeEffects(option.recipe_effects);
      seenOptions.add(optionId);
      options.push({
        id: optionId,
        label,
        price_delta_cents: Math.round(priceDelta),
        is_default: option.is_default === true,
        enabled: true,
        ...(recipeEffects ? { recipe_effects: recipeEffects } : {}),
      });
    }

    if (!options.length) continue;

    seenGroups.add(id);
    const required = group.required === true;
    const requestedMin = Math.max(0, Math.floor(finiteNumber(group.min_selections)));
    const requestedMax = Math.max(
      1,
      Math.floor(finiteNumber(group.max_selections, options.length)),
    );
    const minSelections = selectionMode === 'single'
      ? (required ? 1 : 0)
      : Math.min(options.length, required ? Math.max(1, requestedMin) : requestedMin);
    const maxSelections = selectionMode === 'single'
      ? 1
      : Math.max(minSelections, Math.min(options.length, requestedMax));

    groups.push({
      id,
      name,
      selection_mode: selectionMode,
      required,
      min_selections: minSelections,
      max_selections: maxSelections,
      options,
    });
  }

  return groups;
}

export function orderedProductModifierGroups(groups: ProductModifierGroup[]) {
  return groups
    .map((group, index) => ({ group, index }))
    .sort(
      (a, b) =>
        Number(b.group.required) - Number(a.group.required) || a.index - b.index,
    )
    .map(item => item.group);
}

export function defaultProductModifierSelections(
  groups: ProductModifierGroup[],
): ProductModifierSelection[] {
  return groups.map(group => {
    const defaults = group.options
      .filter(option => option.enabled && option.is_default)
      .map(option => option.id);
    return {
      group_id: group.id,
      option_ids:
        group.selection_mode === 'single'
          ? defaults.slice(0, 1)
          : defaults.slice(0, group.max_selections),
    };
  });
}

export function validateProductModifierSelections(
  groups: ProductModifierGroup[],
  selections: ProductModifierSelection[],
): Record<string, string> {
  const selected = new Map(
    selections.map(item => [item.group_id, [...new Set(item.option_ids)]]),
  );
  const errors: Record<string, string> = {};

  for (const group of groups) {
    const validOptions = new Set(
      group.options.filter(option => option.enabled).map(option => option.id),
    );
    const requested = selected.get(group.id) ?? [];
    const ids = requested.filter(id => validOptions.has(id));

    if (ids.length !== requested.length) {
      errors[group.id] = 'Pilihan tidak tersedia.';
    } else if (ids.length < group.min_selections) {
      errors[group.id] = group.required
        ? 'Pilihan ini wajib diisi.'
        : `Pilih minimal ${group.min_selections}.`;
    } else if (ids.length > group.max_selections) {
      errors[group.id] = `Pilih maksimal ${group.max_selections}.`;
    }
  }

  return errors;
}

export function configuredPriceCents(
  basePriceCents: number,
  groups: ProductModifierGroup[],
  selections: ProductModifierSelection[],
): number {
  const selected = new Map(
    selections.map(item => [item.group_id, new Set(item.option_ids)]),
  );
  let total = Number.isFinite(basePriceCents) ? Math.round(basePriceCents) : 0;

  for (const group of groups) {
    const ids = selected.get(group.id);
    if (!ids) continue;
    for (const option of group.options) {
      if (option.enabled && ids.has(option.id)) total += option.price_delta_cents;
    }
  }

  return total;
}

export function productConfigurationSignature(
  selections: ProductModifierSelection[],
): string {
  return [...selections]
    .sort((a, b) => a.group_id.localeCompare(b.group_id))
    .map(
      item =>
        `${item.group_id}=${[...new Set(item.option_ids)].sort().join(',')}`,
    )
    .join('|');
}

export function productConfigurationSummary(
  groups: ProductModifierGroup[],
  selections: ProductModifierSelection[],
): string {
  const selected = new Map(
    selections.map(item => [item.group_id, new Set(item.option_ids)]),
  );

  return orderedProductModifierGroups(groups)
    .flatMap(group =>
      group.options
        .filter(option => option.enabled && selected.get(group.id)?.has(option.id))
        .map(option => option.label),
    )
    .join(' · ');
}
