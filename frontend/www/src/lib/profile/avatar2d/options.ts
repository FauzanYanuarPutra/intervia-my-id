import type {
  AvatarAccessoryId,
  AvatarAuraId,
  AvatarBackItemId,
  AvatarBackgroundId,
  AvatarBodyId,
  AvatarEffectId,
  AvatarEyewearId,
  AvatarFaceAccessoryId,
  AvatarHairColorId,
  AvatarHairId,
  AvatarHandItemId,
  AvatarHeadwearId,
  AvatarMoodId,
  AvatarMotionId,
  AvatarOption,
  AvatarOutfitColorId,
  AvatarOutfitId,
  AvatarPoseId,
  AvatarSkinId,
  AvatarWingId,
} from './types';

export const BODY_TYPES: ReadonlyArray<AvatarOption<AvatarBodyId>> = [
  { id: 'classic', labelId: 'Seimbang', labelEn: 'Balanced', color: '#a7f3d0' },
  { id: 'small', labelId: 'Mini', labelEn: 'Mini', color: '#bfdbfe' },
  { id: 'sturdy', labelId: 'Tegap', labelEn: 'Sturdy', color: '#fed7aa' },
  { id: 'tall', labelId: 'Tinggi', labelEn: 'Tall', color: '#bae6fd' },
  { id: 'rounded', labelId: 'Gemoy', labelEn: 'Rounded', color: '#fecdd3' },
  { id: 'athletic', labelId: 'Aktif', labelEn: 'Active', color: '#fde68a' },
];

export const SKINS: ReadonlyArray<AvatarOption<AvatarSkinId>> = [
  { id: 'porcelain', labelId: 'Cerah', labelEn: 'Light', color: '#f6d8c9' },
  {
    id: 'kuning',
    labelId: 'Kuning langsat',
    labelEn: 'Warm',
    color: '#eec39b',
  },
  { id: 'sawo', labelId: 'Sawo matang', labelEn: 'Sawo', color: '#c88652' },
  { id: 'tan', labelId: 'Tan', labelEn: 'Tan', color: '#a8683f' },
  { id: 'deep', labelId: 'Gelap', labelEn: 'Deep', color: '#6f3f2a' },
  { id: 'olive', labelId: 'Olive', labelEn: 'Olive', color: '#b48755' },
  {
    id: 'mahogany',
    labelId: 'Mahogany',
    labelEn: 'Mahogany',
    color: '#7b4a32',
  },
  {
    id: 'rosewarm',
    labelId: 'Rosy warm',
    labelEn: 'Rosy warm',
    color: '#d99a83',
  },
];

export const HAIRS: ReadonlyArray<AvatarOption<AvatarHairId>> = [
  { id: 'crop', labelId: 'Pendek', labelEn: 'Short', color: '#1f2937' },
  { id: 'wave', labelId: 'Wavy', labelEn: 'Wavy', color: '#312218' },
  { id: 'curly', labelId: 'Curly', labelEn: 'Curly', color: '#18181b' },
  { id: 'long', labelId: 'Panjang', labelEn: 'Long', color: '#3b2416' },
  { id: 'bun', labelId: 'Bun', labelEn: 'Bun', color: '#24150f' },
  { id: 'fade', labelId: 'Fade', labelEn: 'Fade', color: '#111827' },
  {
    id: 'sidepart',
    labelId: 'Belah samping',
    labelEn: 'Side part',
    color: '#312218',
  },
  {
    id: 'ponytail',
    labelId: 'Ponytail',
    labelEn: 'Ponytail',
    color: '#3b2416',
  },
  { id: 'braids', labelId: 'Braids', labelEn: 'Braids', color: '#18181b' },
  { id: 'spiky', labelId: 'Spiky', labelEn: 'Spiky', color: '#111827' },
];

export const HAIR_COLORS: ReadonlyArray<AvatarOption<AvatarHairColorId>> = [
  {
    id: 'espresso',
    labelId: 'Espresso',
    labelEn: 'Espresso',
    color: '#312218',
  },
  { id: 'black', labelId: 'Hitam', labelEn: 'Black', color: '#111827' },
  {
    id: 'chestnut',
    labelId: 'Chestnut',
    labelEn: 'Chestnut',
    color: '#7c3f1d',
  },
  { id: 'auburn', labelId: 'Auburn', labelEn: 'Auburn', color: '#9a3412' },
  { id: 'silver', labelId: 'Silver', labelEn: 'Silver', color: '#cbd5e1' },
  { id: 'hazel', labelId: 'Hazel', labelEn: 'Hazel', color: '#8b5a2b' },
  { id: 'copper', labelId: 'Copper', labelEn: 'Copper', color: '#c2410c' },
  {
    id: 'midnight',
    labelId: 'Midnight',
    labelEn: 'Midnight',
    color: '#020617',
  },
  { id: 'gold', labelId: 'Gold', labelEn: 'Gold', color: '#d97706' },
];

export const HEADWEAR: ReadonlyArray<AvatarOption<AvatarHeadwearId>> = [
  { id: 'none', labelId: 'Polos', labelEn: 'None' },
  { id: 'cap', labelId: 'Topi', labelEn: 'Cap', color: '#0f766e' },
  { id: 'beanie', labelId: 'Beanie', labelEn: 'Beanie', color: '#be123c' },
  { id: 'hijab', labelId: 'Hijab', labelEn: 'Hijab', color: '#475569' },
  { id: 'chef', labelId: 'Chef', labelEn: 'Chef', color: '#f8fafc' },
  { id: 'helmet', labelId: 'Helm', labelEn: 'Helmet', color: '#f59e0b' },
  {
    id: 'snapback',
    labelId: 'Snapback',
    labelEn: 'Snapback',
    color: '#0ea5e9',
  },
  { id: 'bucket', labelId: 'Bucket', labelEn: 'Bucket', color: '#84cc16' },
  { id: 'fedora', labelId: 'Fedora', labelEn: 'Fedora', color: '#92400e' },
  { id: 'visor', labelId: 'Visor', labelEn: 'Visor', color: '#14b8a6' },
  { id: 'crown', labelId: 'Crown', labelEn: 'Crown', color: '#facc15' },
  { id: 'turban', labelId: 'Turban', labelEn: 'Turban', color: '#7c3aed' },
];

export const ACCESSORIES: ReadonlyArray<AvatarOption<AvatarAccessoryId>> = [
  { id: 'none', labelId: 'Polos', labelEn: 'None' },
  { id: 'cap', labelId: 'Topi', labelEn: 'Cap' },
  { id: 'beanie', labelId: 'Beanie', labelEn: 'Beanie' },
  { id: 'hijab', labelId: 'Hijab', labelEn: 'Hijab' },
  { id: 'glasses', labelId: 'Kacamata', labelEn: 'Glasses' },
];

export const EFFECTS: ReadonlyArray<AvatarOption<AvatarEffectId>> = [
  { id: 'none', labelId: 'Polos', labelEn: 'None' },
  { id: 'wings', labelId: 'Sayap', labelEn: 'Wings' },
  { id: 'halo', labelId: 'Halo', labelEn: 'Halo' },
  { id: 'trail', labelId: 'Trail', labelEn: 'Trail' },
  { id: 'pet', labelId: 'Item', labelEn: 'Item' },
];

export const EYEWEAR: ReadonlyArray<AvatarOption<AvatarEyewearId>> = [
  { id: 'none', labelId: 'Tanpa kacamata', labelEn: 'No glasses' },
  { id: 'glasses', labelId: 'Kacamata', labelEn: 'Glasses', color: '#0f172a' },
  { id: 'shades', labelId: 'Shades', labelEn: 'Shades', color: '#111827' },
  { id: 'round', labelId: 'Bulat', labelEn: 'Round', color: '#334155' },
  { id: 'goggles', labelId: 'Goggles', labelEn: 'Goggles', color: '#0e7490' },
];

export const FACE_ACCESSORIES: ReadonlyArray<
  AvatarOption<AvatarFaceAccessoryId>
> = [
  { id: 'none', labelId: 'Polos', labelEn: 'Clean' },
  { id: 'blush', labelId: 'Blush', labelEn: 'Blush', color: '#fda4af' },
  { id: 'mask', labelId: 'Masker', labelEn: 'Mask', color: '#bae6fd' },
  { id: 'freckle', labelId: 'Freckles', labelEn: 'Freckles', color: '#92400e' },
  { id: 'mustache', labelId: 'Kumis', labelEn: 'Mustache', color: '#312218' },
  { id: 'beard', labelId: 'Janggut', labelEn: 'Beard', color: '#312218' },
  { id: 'scar', labelId: 'Scar', labelEn: 'Scar', color: '#ef4444' },
  { id: 'bandage', labelId: 'Plester', labelEn: 'Bandage', color: '#fde68a' },
];

export const OUTFITS: ReadonlyArray<AvatarOption<AvatarOutfitId>> = [
  { id: 'tee', labelId: 'Kaos', labelEn: 'Tee', color: '#0f766e' },
  { id: 'hoodie', labelId: 'Hoodie', labelEn: 'Hoodie', color: '#2563eb' },
  { id: 'batik', labelId: 'Batik', labelEn: 'Batik', color: '#92400e' },
  { id: 'apron', labelId: 'Apron', labelEn: 'Apron', color: '#047857' },
  { id: 'jacket', labelId: 'Jaket', labelEn: 'Jacket', color: '#334155' },
  { id: 'driver', labelId: 'Kurir', labelEn: 'Courier', color: '#f59e0b' },
  { id: 'suit', labelId: 'Suit', labelEn: 'Suit', color: '#0f172a' },
  { id: 'uniform', labelId: 'Uniform', labelEn: 'Uniform', color: '#0ea5e9' },
  { id: 'overalls', labelId: 'Overall', labelEn: 'Overalls', color: '#2563eb' },
  { id: 'kebaya', labelId: 'Kebaya', labelEn: 'Kebaya', color: '#e11d48' },
  {
    id: 'chefcoat',
    labelId: 'Chef coat',
    labelEn: 'Chef coat',
    color: '#f8fafc',
  },
  { id: 'vest', labelId: 'Vest', labelEn: 'Vest', color: '#92400e' },
];

export const OUTFIT_COLORS: ReadonlyArray<AvatarOption<AvatarOutfitColorId>> = [
  { id: 'emerald', labelId: 'Mint', labelEn: 'Mint', color: '#0f766e' },
  { id: 'sky', labelId: 'Langit', labelEn: 'Sky', color: '#2563eb' },
  { id: 'amber', labelId: 'Senja', labelEn: 'Amber', color: '#f59e0b' },
  { id: 'rose', labelId: 'Rose', labelEn: 'Rose', color: '#e11d48' },
  { id: 'slate', labelId: 'Slate', labelEn: 'Slate', color: '#334155' },
  { id: 'violet', labelId: 'Violet', labelEn: 'Violet', color: '#7c3aed' },
  { id: 'navy', labelId: 'Navy', labelEn: 'Navy', color: '#1e3a8a' },
  { id: 'teal', labelId: 'Teal', labelEn: 'Teal', color: '#0d9488' },
  { id: 'gold', labelId: 'Gold', labelEn: 'Gold', color: '#d97706' },
  { id: 'cream', labelId: 'Cream', labelEn: 'Cream', color: '#f5e6c8' },
  { id: 'black', labelId: 'Black', labelEn: 'Black', color: '#111827' },
];

export const WINGS: ReadonlyArray<AvatarOption<AvatarWingId>> = [
  { id: 'none', labelId: 'Polos', labelEn: 'None' },
  { id: 'angel', labelId: 'Angel', labelEn: 'Angel', color: '#f8fafc' },
  { id: 'crystal', labelId: 'Crystal', labelEn: 'Crystal', color: '#67e8f9' },
  { id: 'flame', labelId: 'Flame', labelEn: 'Flame', color: '#fb923c' },
  { id: 'leaf', labelId: 'Leaf', labelEn: 'Leaf', color: '#86efac' },
  { id: 'shadow', labelId: 'Shadow', labelEn: 'Shadow', color: '#475569' },
  { id: 'mechanical', labelId: 'Mecha', labelEn: 'Mecha', color: '#94a3b8' },
  { id: 'royal', labelId: 'Royal', labelEn: 'Royal', color: '#facc15' },
  {
    id: 'celestial',
    labelId: 'Celestial',
    labelEn: 'Celestial',
    color: '#a78bfa',
  },
  { id: 'phoenix', labelId: 'Phoenix', labelEn: 'Phoenix', color: '#f97316' },
  { id: 'dragon', labelId: 'Dragon', labelEn: 'Dragon', color: '#22c55e' },
  { id: 'prism', labelId: 'Prism', labelEn: 'Prism', color: '#67e8f9' },
  {
    id: 'butterfly',
    labelId: 'Butterfly',
    labelEn: 'Butterfly',
    color: '#f0abfc',
  },
  { id: 'techno', labelId: 'Techno', labelEn: 'Techno', color: '#38bdf8' },
  {
    id: 'renaissance',
    labelId: 'Renaissance',
    labelEn: 'Renaissance',
    color: '#fef3c7',
  },
];

export const AURAS: ReadonlyArray<AvatarOption<AvatarAuraId>> = [
  { id: 'none', labelId: 'Polos', labelEn: 'None' },
  { id: 'halo', labelId: 'Halo', labelEn: 'Halo', color: '#fde68a' },
  { id: 'spark', labelId: 'Spark', labelEn: 'Spark', color: '#fef3c7' },
  { id: 'energy', labelId: 'Energy', labelEn: 'Energy', color: '#5eead4' },
  { id: 'rainbow', labelId: 'Rainbow', labelEn: 'Rainbow', color: '#f9a8d4' },
  { id: 'orbit', labelId: 'Orbit', labelEn: 'Orbit', color: '#a78bfa' },
  { id: 'flame', labelId: 'Flame', labelEn: 'Flame', color: '#fb923c' },
  { id: 'stars', labelId: 'Stars', labelEn: 'Stars', color: '#fde68a' },
  { id: 'coins', labelId: 'Coins', labelEn: 'Coins', color: '#facc15' },
  { id: 'mist', labelId: 'Mist', labelEn: 'Mist', color: '#bae6fd' },
  { id: 'matrix', labelId: 'Matrix', labelEn: 'Matrix', color: '#86efac' },
];

export const BACK_ITEMS: ReadonlyArray<AvatarOption<AvatarBackItemId>> = [
  { id: 'none', labelId: 'Polos', labelEn: 'None' },
  { id: 'cape', labelId: 'Cape', labelEn: 'Cape', color: '#ef4444' },
  { id: 'sword', labelId: 'Pedang', labelEn: 'Sword', color: '#cbd5e1' },
  { id: 'shield', labelId: 'Shield', labelEn: 'Shield', color: '#38bdf8' },
  { id: 'jetpack', labelId: 'Jetpack', labelEn: 'Jetpack', color: '#64748b' },
  { id: 'banner', labelId: 'Banner', labelEn: 'Banner', color: '#10b981' },
  {
    id: 'backpack',
    labelId: 'Backpack',
    labelEn: 'Backpack',
    color: '#92400e',
  },
  { id: 'toolbox', labelId: 'Toolbox', labelEn: 'Toolbox', color: '#ef4444' },
  { id: 'drone', labelId: 'Drone', labelEn: 'Drone', color: '#64748b' },
  { id: 'guitar', labelId: 'Gitar', labelEn: 'Guitar', color: '#b45309' },
  { id: 'ledger', labelId: 'Ledger', labelEn: 'Ledger', color: '#0f766e' },
];

export const HAND_ITEMS: ReadonlyArray<AvatarOption<AvatarHandItemId>> = [
  { id: 'none', labelId: 'Polos', labelEn: 'None' },
  { id: 'phone', labelId: 'HP', labelEn: 'Phone', color: '#0f172a' },
  { id: 'package', labelId: 'Paket', labelEn: 'Package', color: '#d97706' },
  { id: 'wrench', labelId: 'Kunci', labelEn: 'Wrench', color: '#64748b' },
  { id: 'camera', labelId: 'Kamera', labelEn: 'Camera', color: '#111827' },
  { id: 'coffee', labelId: 'Kopi', labelEn: 'Coffee', color: '#92400e' },
  { id: 'tablet', labelId: 'Tablet', labelEn: 'Tablet', color: '#0f172a' },
  {
    id: 'microphone',
    labelId: 'Mic',
    labelEn: 'Microphone',
    color: '#334155',
  },
  {
    id: 'megaphone',
    labelId: 'Megaphone',
    labelEn: 'Megaphone',
    color: '#ef4444',
  },
  { id: 'spatula', labelId: 'Spatula', labelEn: 'Spatula', color: '#94a3b8' },
  {
    id: 'shoppingBag',
    labelId: 'Tas jualan',
    labelEn: 'Shopping bag',
    color: '#14b8a6',
  },
  {
    id: 'paintbrush',
    labelId: 'Kuas',
    labelEn: 'Paintbrush',
    color: '#f97316',
  },
  { id: 'laptop', labelId: 'Laptop', labelEn: 'Laptop', color: '#475569' },
];

export const MOODS: ReadonlyArray<AvatarOption<AvatarMoodId>> = [
  { id: 'smile', labelId: 'Senyum', labelEn: 'Smile' },
  { id: 'cool', labelId: 'Cool', labelEn: 'Cool' },
  { id: 'wink', labelId: 'Wink', labelEn: 'Wink' },
  { id: 'determined', labelId: 'Fokus', labelEn: 'Focused' },
  { id: 'happy', labelId: 'Happy', labelEn: 'Happy' },
  { id: 'serious', labelId: 'Serius', labelEn: 'Serious' },
  { id: 'surprised', labelId: 'Kaget', labelEn: 'Surprised' },
  { id: 'proud', labelId: 'Bangga', labelEn: 'Proud' },
];

export const BACKGROUNDS: ReadonlyArray<AvatarOption<AvatarBackgroundId>> = [
  { id: 'mint', labelId: 'Mint', labelEn: 'Mint', color: '#99f6e4' },
  { id: 'sky', labelId: 'Langit', labelEn: 'Sky', color: '#7dd3fc' },
  { id: 'sunset', labelId: 'Senja', labelEn: 'Sunset', color: '#fdba74' },
  { id: 'rose', labelId: 'Rose', labelEn: 'Rose', color: '#f9a8d4' },
  { id: 'slate', labelId: 'Slate', labelEn: 'Slate', color: '#94a3b8' },
  { id: 'neon', labelId: 'Arcade', labelEn: 'Arcade', color: '#a78bfa' },
  { id: 'market', labelId: 'Pasar', labelEn: 'Market', color: '#bbf7d0' },
  {
    id: 'workshop',
    labelId: 'Workshop',
    labelEn: 'Workshop',
    color: '#fed7aa',
  },
  {
    id: 'warehouse',
    labelId: 'Gudang',
    labelEn: 'Warehouse',
    color: '#cbd5e1',
  },
  { id: 'studio', labelId: 'Studio', labelEn: 'Studio', color: '#f0abfc' },
  { id: 'map', labelId: 'Map', labelEn: 'Map', color: '#93c5fd' },
  { id: 'night', labelId: 'Night', labelEn: 'Night', color: '#1e293b' },
];

export const POSES: ReadonlyArray<AvatarOption<AvatarPoseId>> = [
  { id: 'idle', labelId: 'Idle', labelEn: 'Idle' },
  { id: 'wave', labelId: 'Wave', labelEn: 'Wave' },
  { id: 'ready', labelId: 'Ready', labelEn: 'Ready' },
  { id: 'hold', labelId: 'Pegang item', labelEn: 'Hold item' },
  { id: 'hero', labelId: 'Hero', labelEn: 'Hero' },
];

export const MOTIONS: ReadonlyArray<AvatarOption<AvatarMotionId>> = [
  { id: 'full', labelId: 'Hidup', labelEn: 'Alive' },
  { id: 'calm', labelId: 'Kalem', labelEn: 'Calm' },
  { id: 'still', labelId: 'Diam', labelEn: 'Still' },
];

export function labelOf<T extends string>(
  options: ReadonlyArray<AvatarOption<T>>,
  id: T,
  isId = true,
): string {
  const option = options.find(item => item.id === id);
  if (!option) return id;
  return isId ? option.labelId : option.labelEn;
}

export function optionIds<T extends string>(
  options: ReadonlyArray<AvatarOption<T>>,
): ReadonlyArray<T> {
  return options.map(option => option.id);
}
