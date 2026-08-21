export type AvatarBodyId =
  | 'classic'
  | 'small'
  | 'sturdy'
  | 'tall'
  | 'rounded'
  | 'athletic';
export type AvatarSkinId =
  | 'porcelain'
  | 'kuning'
  | 'sawo'
  | 'tan'
  | 'deep'
  | 'olive'
  | 'mahogany'
  | 'rosewarm';
export type AvatarHairId =
  | 'crop'
  | 'wave'
  | 'curly'
  | 'long'
  | 'bun'
  | 'fade'
  | 'sidepart'
  | 'ponytail'
  | 'braids'
  | 'spiky';
export type AvatarHairColorId =
  | 'espresso'
  | 'black'
  | 'chestnut'
  | 'auburn'
  | 'silver'
  | 'hazel'
  | 'copper'
  | 'midnight'
  | 'gold';
export type AvatarAccessoryId = 'none' | 'cap' | 'beanie' | 'hijab' | 'glasses';
export type AvatarHeadwearId =
  | 'none'
  | 'cap'
  | 'beanie'
  | 'hijab'
  | 'chef'
  | 'helmet'
  | 'snapback'
  | 'bucket'
  | 'fedora'
  | 'visor'
  | 'crown'
  | 'turban';
export type AvatarEyewearId =
  | 'none'
  | 'glasses'
  | 'shades'
  | 'round'
  | 'goggles';
export type AvatarFaceAccessoryId =
  | 'none'
  | 'blush'
  | 'mask'
  | 'freckle'
  | 'mustache'
  | 'beard'
  | 'scar'
  | 'bandage';
export type AvatarOutfitId =
  | 'tee'
  | 'hoodie'
  | 'batik'
  | 'apron'
  | 'jacket'
  | 'driver'
  | 'suit'
  | 'uniform'
  | 'overalls'
  | 'kebaya'
  | 'chefcoat'
  | 'vest';
export type AvatarOutfitColorId =
  | 'emerald'
  | 'sky'
  | 'amber'
  | 'rose'
  | 'slate'
  | 'violet'
  | 'navy'
  | 'teal'
  | 'gold'
  | 'cream'
  | 'black';
export type AvatarBackgroundId =
  | 'mint'
  | 'sky'
  | 'sunset'
  | 'rose'
  | 'slate'
  | 'neon'
  | 'market'
  | 'workshop'
  | 'warehouse'
  | 'studio'
  | 'map'
  | 'night';
export type AvatarEffectId = 'none' | 'wings' | 'halo' | 'trail' | 'pet';
export type AvatarWingId =
  | 'none'
  | 'angel'
  | 'crystal'
  | 'flame'
  | 'leaf'
  | 'shadow'
  | 'mechanical'
  | 'royal'
  | 'celestial'
  | 'phoenix'
  | 'dragon'
  | 'prism'
  | 'butterfly'
  | 'techno'
  | 'renaissance';
export type AvatarAuraId =
  | 'none'
  | 'halo'
  | 'spark'
  | 'energy'
  | 'rainbow'
  | 'orbit'
  | 'flame'
  | 'stars'
  | 'coins'
  | 'mist'
  | 'matrix';
export type AvatarBackItemId =
  | 'none'
  | 'cape'
  | 'sword'
  | 'shield'
  | 'jetpack'
  | 'banner'
  | 'backpack'
  | 'toolbox'
  | 'drone'
  | 'guitar'
  | 'ledger';
export type AvatarHandItemId =
  | 'none'
  | 'phone'
  | 'package'
  | 'wrench'
  | 'camera'
  | 'coffee'
  | 'tablet'
  | 'microphone'
  | 'megaphone'
  | 'spatula'
  | 'shoppingBag'
  | 'paintbrush'
  | 'laptop';
export type AvatarMoodId =
  | 'smile'
  | 'cool'
  | 'wink'
  | 'determined'
  | 'happy'
  | 'serious'
  | 'surprised'
  | 'proud';
export type AvatarPoseId = 'idle' | 'wave' | 'ready' | 'hold' | 'hero';
export type AvatarMotionId = 'full' | 'calm' | 'still';

export type LajukanAvatarSpecV2 = {
  version: 2;
  body: AvatarBodyId;
  skin: AvatarSkinId;
  hair: AvatarHairId;
  hairColor: AvatarHairColorId;
  headwear: AvatarHeadwearId;
  eyewear: AvatarEyewearId;
  faceAccessory: AvatarFaceAccessoryId;
  outfit: AvatarOutfitId;
  outfitColor: AvatarOutfitColorId;
  wing: AvatarWingId;
  aura: AvatarAuraId;
  backItem: AvatarBackItemId;
  handItem: AvatarHandItemId;
  mood: AvatarMoodId;
  background: AvatarBackgroundId;
  pose: AvatarPoseId;
  motion: AvatarMotionId;
};

export type LajukanAvatarSpec = LajukanAvatarSpecV2 & {
  accessory: AvatarAccessoryId;
  effect: AvatarEffectId;
};

export type LajukanAvatarStyle = Partial<LajukanAvatarSpec> &
  Record<string, unknown>;

export type AvatarOption<T extends string> = {
  id: T;
  labelId: string;
  labelEn: string;
  color?: string;
  accent?: string;
};

export type AvatarRarity = 'Basic' | 'Rare' | 'Epic' | 'Legend';

export type LajukanAvatarPreset = {
  key: string;
  labelId: string;
  labelEn: string;
  captionId: string;
  captionEn: string;
  rarity: AvatarRarity;
  spec: LajukanAvatarSpec;
};
