import {
  ACCESSORIES,
  AURAS,
  BACKGROUNDS,
  BACK_ITEMS,
  BODY_TYPES,
  EFFECTS,
  EYEWEAR,
  FACE_ACCESSORIES,
  HAIRS,
  HAIR_COLORS,
  HAND_ITEMS,
  HEADWEAR,
  MOODS,
  MOTIONS,
  OUTFITS,
  OUTFIT_COLORS,
  POSES,
  SKINS,
  WINGS,
} from './options';
import { DEFAULT_LAJUKAN_AVATAR } from './presets';
import type {
  AvatarAccessoryId,
  AvatarAuraId,
  AvatarBackItemId,
  AvatarEffectId,
  AvatarEyewearId,
  AvatarHeadwearId,
  AvatarOption,
  AvatarWingId,
  LajukanAvatarSpec,
  LajukanAvatarStyle,
} from './types';

type LegacyParts = {
  wing: AvatarWingId;
  aura: AvatarAuraId;
  backItem: AvatarBackItemId;
};

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

function pick<T extends string>(
  options: ReadonlyArray<AvatarOption<T>>,
  value: unknown,
  fallback: T,
): T {
  return options.some(option => option.id === value) ? (value as T) : fallback;
}

function legacyHeadwear(accessory: AvatarAccessoryId): AvatarHeadwearId {
  if (accessory === 'cap' || accessory === 'beanie' || accessory === 'hijab') {
    return accessory;
  }
  return 'none';
}

function legacyEyewear(accessory: AvatarAccessoryId): AvatarEyewearId {
  return accessory === 'glasses' ? 'glasses' : 'none';
}

function legacyEffectParts(effect: AvatarEffectId): LegacyParts {
  if (effect === 'wings')
    return { wing: 'angel', aura: 'none', backItem: 'none' };
  if (effect === 'halo')
    return { wing: 'none', aura: 'halo', backItem: 'none' };
  if (effect === 'trail')
    return { wing: 'none', aura: 'energy', backItem: 'none' };
  if (effect === 'pet')
    return { wing: 'none', aura: 'none', backItem: 'shield' };
  return { wing: 'none', aura: 'none', backItem: 'none' };
}

function deriveAccessory(
  headwear: AvatarHeadwearId,
  eyewear: AvatarEyewearId,
): AvatarAccessoryId {
  if (headwear === 'cap' || headwear === 'beanie' || headwear === 'hijab') {
    return headwear;
  }
  return eyewear === 'glasses' ? 'glasses' : 'none';
}

function deriveEffect(
  wing: AvatarWingId,
  aura: AvatarAuraId,
  backItem: AvatarBackItemId,
): AvatarEffectId {
  if (wing !== 'none') return 'wings';
  if (aura === 'halo') return 'halo';
  if (aura !== 'none') return 'trail';
  if (backItem !== 'none') return 'pet';
  return 'none';
}

export function normalizeAvatarSpec(
  value?: Partial<LajukanAvatarStyle> | null,
): LajukanAvatarSpec {
  const record = asRecord(parseMaybeJson(value));
  const legacyAccessory = pick(
    ACCESSORIES,
    record.accessory,
    DEFAULT_LAJUKAN_AVATAR.accessory,
  );
  const legacyEffect = pick(
    EFFECTS,
    record.effect,
    DEFAULT_LAJUKAN_AVATAR.effect,
  );
  const legacyParts = legacyEffectParts(legacyEffect);
  const headwear = pick(
    HEADWEAR,
    record.headwear,
    legacyHeadwear(legacyAccessory),
  );
  const eyewear = pick(EYEWEAR, record.eyewear, legacyEyewear(legacyAccessory));
  const wing = pick(WINGS, record.wing, legacyParts.wing);
  const aura = pick(AURAS, record.aura, legacyParts.aura);
  const backItem = pick(BACK_ITEMS, record.backItem, legacyParts.backItem);

  return {
    version: 2,
    body: pick(BODY_TYPES, record.body, DEFAULT_LAJUKAN_AVATAR.body),
    skin: pick(SKINS, record.skin, DEFAULT_LAJUKAN_AVATAR.skin),
    hair: pick(HAIRS, record.hair, DEFAULT_LAJUKAN_AVATAR.hair),
    hairColor: pick(
      HAIR_COLORS,
      record.hairColor,
      DEFAULT_LAJUKAN_AVATAR.hairColor,
    ),
    headwear,
    eyewear,
    faceAccessory: pick(
      FACE_ACCESSORIES,
      record.faceAccessory,
      DEFAULT_LAJUKAN_AVATAR.faceAccessory,
    ),
    accessory: deriveAccessory(headwear, eyewear),
    outfit: pick(OUTFITS, record.outfit, DEFAULT_LAJUKAN_AVATAR.outfit),
    outfitColor: pick(
      OUTFIT_COLORS,
      record.outfitColor,
      DEFAULT_LAJUKAN_AVATAR.outfitColor,
    ),
    background: pick(
      BACKGROUNDS,
      record.background,
      DEFAULT_LAJUKAN_AVATAR.background,
    ),
    effect: deriveEffect(wing, aura, backItem),
    wing,
    aura,
    backItem,
    handItem: pick(
      HAND_ITEMS,
      record.handItem,
      DEFAULT_LAJUKAN_AVATAR.handItem,
    ),
    mood: pick(MOODS, record.mood, DEFAULT_LAJUKAN_AVATAR.mood),
    pose: pick(POSES, record.pose, DEFAULT_LAJUKAN_AVATAR.pose),
    motion: pick(MOTIONS, record.motion, DEFAULT_LAJUKAN_AVATAR.motion),
  };
}

export function readLajukanAvatarSpec(value: unknown): LajukanAvatarSpec {
  return normalizeAvatarSpec(value as Partial<LajukanAvatarStyle>);
}

export function sameAvatarSpec(
  first: Partial<LajukanAvatarStyle>,
  second: Partial<LajukanAvatarStyle>,
): boolean {
  const left = normalizeAvatarSpec(first);
  const right = normalizeAvatarSpec(second);
  return Object.keys(DEFAULT_LAJUKAN_AVATAR).every(
    key =>
      left[key as keyof LajukanAvatarSpec] ===
      right[key as keyof LajukanAvatarSpec],
  );
}
