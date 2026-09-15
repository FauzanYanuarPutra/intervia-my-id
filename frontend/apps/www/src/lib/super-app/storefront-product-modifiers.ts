export type StorefrontModifierOption = {
  id: string;
  name: string;
  priceDeltaCents: number;
  isDefault: boolean;
  sortOrder: number;
};

export type StorefrontModifierGroup = {
  id: string;
  name: string;
  selectionType: 'single' | 'multiple';
  isRequired: boolean;
  minSelect: number;
  maxSelect: number;
  sortOrder: number;
  options: StorefrontModifierOption[];
};

export type StorefrontModifierSelection = {
  groupId: string;
  optionIds: string[];
};

type UnknownRecord = Record<string, unknown>;

function record(value: unknown): UnknownRecord | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as UnknownRecord)
    : null;
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function integer(value: unknown, fallback = 0): number {
  return typeof value === 'number' && Number.isSafeInteger(value) ? value : fallback;
}

export function parseStorefrontModifierGroups(metadata: Record<string, unknown>): StorefrontModifierGroup[] {
  const rawGroups = Array.isArray(metadata.modifier_groups) ? metadata.modifier_groups : [];
  return rawGroups
    .map((raw, groupIndex): StorefrontModifierGroup | null => {
      const group = record(raw);
      if (!group) return null;
      const id = text(group.id);
      const name = text(group.name);
      const selectionType = group.selection_type === 'multiple' ? 'multiple' : group.selection_type === 'single' ? 'single' : null;
      if (!id || !name || !selectionType || group.is_active === false) return null;
      const options = (Array.isArray(group.options) ? group.options : [])
        .map((rawOption, optionIndex): StorefrontModifierOption | null => {
          const option = record(rawOption);
          if (!option || option.is_active === false) return null;
          const optionId = text(option.id);
          const optionName = text(option.name);
          const priceDeltaCents = Math.max(0, integer(option.price_delta_cents));
          if (!optionId || !optionName) return null;
          return {
            id: optionId,
            name: optionName,
            priceDeltaCents,
            isDefault: option.is_default === true,
            sortOrder: Math.max(0, integer(option.sort_order, optionIndex)),
          };
        })
        .filter((option): option is StorefrontModifierOption => Boolean(option))
        .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
      if (!options.length) return null;
      const minSelect = Math.max(0, integer(group.min_select, group.is_required === true ? 1 : 0));
      const rawMax = group.max_select === null || group.max_select === undefined
        ? options.length
        : integer(group.max_select, options.length);
      const maxSelect = selectionType === 'single' ? 1 : Math.max(minSelect, Math.min(options.length, rawMax));
      return {
        id,
        name,
        selectionType,
        isRequired: group.is_required === true,
        minSelect: selectionType === 'single' ? (group.is_required === true ? 1 : Math.min(1, minSelect)) : minSelect,
        maxSelect,
        sortOrder: Math.max(0, integer(group.sort_order, groupIndex)),
        options,
      };
    })
    .filter((group): group is StorefrontModifierGroup => Boolean(group))
    .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
}

export function defaultStorefrontSelections(groups: StorefrontModifierGroup[]): StorefrontModifierSelection[] {
  return groups.map(group => {
    const defaults = group.options.filter(option => option.isDefault).map(option => option.id);
    const optionIds = group.selectionType === 'single'
      ? defaults.slice(0, 1)
      : defaults.slice(0, group.maxSelect);
    return { groupId: group.id, optionIds };
  });
}

export function validateStorefrontSelections(
  groups: StorefrontModifierGroup[],
  selections: StorefrontModifierSelection[],
): string | null {
  const byGroup = new Map(selections.map(selection => [selection.groupId, selection.optionIds]));
  for (const group of groups) {
    const selected = Array.from(new Set(byGroup.get(group.id) ?? []));
    if (group.isRequired && selected.length === 0) return `${group.name} wajib dipilih.`;
    if (selected.length < group.minSelect) return `${group.name} minimal pilih ${group.minSelect}.`;
    if (selected.length > group.maxSelect) return `${group.name} maksimal pilih ${group.maxSelect}.`;
    if (group.selectionType === 'single' && selected.length > 1) return `${group.name} hanya boleh satu pilihan.`;
    const known = new Set(group.options.map(option => option.id));
    if (selected.some(optionId => !known.has(optionId))) return `Pilihan ${group.name} tidak valid.`;
  }
  return null;
}

export function modifierDeltaCents(
  groups: StorefrontModifierGroup[],
  selections: StorefrontModifierSelection[],
): number {
  const selected = new Set(selections.flatMap(selection => selection.optionIds));
  return groups.reduce(
    (sum, group) => sum + group.options.reduce(
      (groupSum, option) => groupSum + (selected.has(option.id) ? option.priceDeltaCents : 0),
      0,
    ),
    0,
  );
}

export function canonicalConfigurationKey(
  productId: string,
  selections: StorefrontModifierSelection[],
  note?: string | null,
): string {
  const parts = selections
    .filter(selection => selection.optionIds.length)
    .map(selection => `${selection.groupId}:${[...new Set(selection.optionIds)].sort().join(',')}`)
    .sort();
  const normalizedNote = note?.trim() ?? '';
  return `${productId}|${parts.join('|')}|note:${normalizedNote}`;
}

export function selectionLabels(
  groups: StorefrontModifierGroup[],
  selections: StorefrontModifierSelection[],
): string[] {
  const byGroup = new Map(selections.map(selection => [selection.groupId, new Set(selection.optionIds)]));
  return groups.flatMap(group => {
    const selected = byGroup.get(group.id) ?? new Set<string>();
    const labels = group.options.filter(option => selected.has(option.id)).map(option => option.name);
    return labels.length ? [`${group.name}: ${labels.join(', ')}`] : [];
  });
}
