'use client';

import {
  Check,
  Dice5,
  Palette,
  Shirt,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { cn } from '@/lib/utils';

export type AvatarSkinId = 'porcelain' | 'kuning' | 'sawo' | 'tan' | 'deep';
export type AvatarHairId = 'crop' | 'wave' | 'curly' | 'long' | 'bun';
export type AvatarAccessoryId = 'none' | 'cap' | 'beanie' | 'hijab' | 'glasses';
export type AvatarOutfitId = 'tee' | 'hoodie' | 'batik' | 'apron' | 'jacket';
export type AvatarBackgroundId = 'mint' | 'sky' | 'sunset' | 'rose' | 'slate';

export type LajukanAvatarSpec = {
  skin: AvatarSkinId;
  hair: AvatarHairId;
  accessory: AvatarAccessoryId;
  outfit: AvatarOutfitId;
  background: AvatarBackgroundId;
};

type Option<T extends string> = {
  id: T;
  labelId: string;
  labelEn: string;
  color?: string;
};

const SKINS: Array<Option<AvatarSkinId>> = [
  { id: 'porcelain', labelId: 'Cerah', labelEn: 'Light', color: '#f6d8c9' },
  {
    id: 'kuning',
    labelId: 'Kuning langsat',
    labelEn: 'Warm',
    color: '#eec39b',
  },
  {
    id: 'sawo',
    labelId: 'Sawo matang',
    labelEn: 'Golden tan',
    color: '#c88652',
  },
  { id: 'tan', labelId: 'Tan', labelEn: 'Tan', color: '#a8683f' },
  { id: 'deep', labelId: 'Gelap', labelEn: 'Deep', color: '#6f3f2a' },
];

const HAIRS: Array<Option<AvatarHairId>> = [
  { id: 'crop', labelId: 'Pendek', labelEn: 'Crop' },
  { id: 'wave', labelId: 'Wavy', labelEn: 'Wavy' },
  { id: 'curly', labelId: 'Curly', labelEn: 'Curly' },
  { id: 'long', labelId: 'Panjang', labelEn: 'Long' },
  { id: 'bun', labelId: 'Bun', labelEn: 'Bun' },
];

const ACCESSORIES: Array<Option<AvatarAccessoryId>> = [
  { id: 'none', labelId: 'Polos', labelEn: 'None' },
  { id: 'cap', labelId: 'Topi', labelEn: 'Cap' },
  { id: 'beanie', labelId: 'Beanie', labelEn: 'Beanie' },
  { id: 'hijab', labelId: 'Hijab', labelEn: 'Hijab' },
  { id: 'glasses', labelId: 'Kacamata', labelEn: 'Glasses' },
];

const OUTFITS: Array<Option<AvatarOutfitId>> = [
  { id: 'tee', labelId: 'Kaos', labelEn: 'Tee', color: '#0f766e' },
  { id: 'hoodie', labelId: 'Hoodie', labelEn: 'Hoodie', color: '#2563eb' },
  { id: 'batik', labelId: 'Batik', labelEn: 'Batik', color: '#92400e' },
  { id: 'apron', labelId: 'Apron', labelEn: 'Apron', color: '#047857' },
  { id: 'jacket', labelId: 'Jaket', labelEn: 'Jacket', color: '#334155' },
];

const BACKGROUNDS: Array<Option<AvatarBackgroundId>> = [
  { id: 'mint', labelId: 'Mint', labelEn: 'Mint', color: '#bbf7d0' },
  { id: 'sky', labelId: 'Langit', labelEn: 'Sky', color: '#bae6fd' },
  { id: 'sunset', labelId: 'Senja', labelEn: 'Sunset', color: '#fed7aa' },
  { id: 'rose', labelId: 'Rose', labelEn: 'Rose', color: '#fecdd3' },
  { id: 'slate', labelId: 'Slate', labelEn: 'Slate', color: '#cbd5e1' },
];

export const DEFAULT_LAJUKAN_AVATAR: LajukanAvatarSpec = {
  skin: 'sawo',
  hair: 'wave',
  accessory: 'none',
  outfit: 'hoodie',
  background: 'mint',
};

export const LAJUKAN_AVATAR_PRESETS: LajukanAvatarSpec[] = [
  DEFAULT_LAJUKAN_AVATAR,
  {
    skin: 'kuning',
    hair: 'crop',
    accessory: 'cap',
    outfit: 'apron',
    background: 'sky',
  },
  {
    skin: 'porcelain',
    hair: 'long',
    accessory: 'glasses',
    outfit: 'jacket',
    background: 'rose',
  },
  {
    skin: 'tan',
    hair: 'curly',
    accessory: 'beanie',
    outfit: 'tee',
    background: 'sunset',
  },
  {
    skin: 'deep',
    hair: 'bun',
    accessory: 'none',
    outfit: 'batik',
    background: 'mint',
  },
  {
    skin: 'sawo',
    hair: 'crop',
    accessory: 'hijab',
    outfit: 'hoodie',
    background: 'slate',
  },
];

const SKIN_COLOR: Record<AvatarSkinId, string> = {
  porcelain: '#f6d8c9',
  kuning: '#eec39b',
  sawo: '#c88652',
  tan: '#a8683f',
  deep: '#6f3f2a',
};

const HAIR_COLOR: Record<AvatarHairId, string> = {
  crop: '#1f2937',
  wave: '#312218',
  curly: '#18181b',
  long: '#3b2416',
  bun: '#24150f',
};

const OUTFIT_COLOR: Record<AvatarOutfitId, string> = {
  tee: '#0f766e',
  hoodie: '#2563eb',
  batik: '#92400e',
  apron: '#047857',
  jacket: '#334155',
};

const BG_COLOR: Record<AvatarBackgroundId, [string, string]> = {
  mint: ['#dcfce7', '#99f6e4'],
  sky: ['#dbeafe', '#7dd3fc'],
  sunset: ['#ffedd5', '#fdba74'],
  rose: ['#ffe4e6', '#f9a8d4'],
  slate: ['#e2e8f0', '#94a3b8'],
};

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeAvatarSpec(
  value: Partial<LajukanAvatarSpec> | null | undefined,
): LajukanAvatarSpec {
  const candidate = value || {};
  return {
    skin: SKINS.some(item => item.id === candidate.skin)
      ? candidate.skin!
      : DEFAULT_LAJUKAN_AVATAR.skin,
    hair: HAIRS.some(item => item.id === candidate.hair)
      ? candidate.hair!
      : DEFAULT_LAJUKAN_AVATAR.hair,
    accessory: ACCESSORIES.some(item => item.id === candidate.accessory)
      ? candidate.accessory!
      : DEFAULT_LAJUKAN_AVATAR.accessory,
    outfit: OUTFITS.some(item => item.id === candidate.outfit)
      ? candidate.outfit!
      : DEFAULT_LAJUKAN_AVATAR.outfit,
    background: BACKGROUNDS.some(item => item.id === candidate.background)
      ? candidate.background!
      : DEFAULT_LAJUKAN_AVATAR.background,
  };
}

export function readLajukanAvatarSpec(value: unknown): LajukanAvatarSpec {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return DEFAULT_LAJUKAN_AVATAR;
  }
  return normalizeAvatarSpec(value as Partial<LajukanAvatarSpec>);
}

export function createLajukanAvatarSvg(
  value: Partial<LajukanAvatarSpec> = DEFAULT_LAJUKAN_AVATAR,
  label = 'Lajukan avatar',
) {
  const spec = normalizeAvatarSpec(value);
  const [bgStart, bgEnd] = BG_COLOR[spec.background];
  const skin = SKIN_COLOR[spec.skin];
  const hair = HAIR_COLOR[spec.hair];
  const outfit = OUTFIT_COLOR[spec.outfit];
  const isHijab = spec.accessory === 'hijab';

  const hairSvg = isHijab
    ? `<path d="M82 117c2-43 22-73 49-73s48 30 50 73c3 39-13 65-49 65s-53-26-50-65Z" fill="#334155"/>
       <path d="M100 87c13-20 48-28 64 0-7 16-17 25-32 25s-25-9-32-25Z" fill="#475569"/>`
    : spec.hair === 'crop'
      ? `<path d="M81 91c7-31 31-47 60-39 24 7 36 25 37 50-28-20-62-22-97-11Z" fill="${hair}"/>`
      : spec.hair === 'wave'
        ? `<path d="M76 103c4-38 31-60 66-53 31 6 45 32 42 66-17-21-36-32-58-29-20 2-34 9-50 16Z" fill="${hair}"/>
           <path d="M83 91c18-29 59-35 88-8-23-8-45-6-66 7-8 5-15 5-22 1Z" fill="#4a2f1e"/>`
        : spec.hair === 'curly'
          ? `<g fill="${hair}"><circle cx="91" cy="83" r="18"/><circle cx="113" cy="64" r="18"/><circle cx="139" cy="61" r="20"/><circle cx="164" cy="78" r="19"/><circle cx="173" cy="104" r="18"/><circle cx="78" cy="108" r="17"/></g>`
          : spec.hair === 'long'
            ? `<path d="M76 102c-1-35 22-57 54-57 34 0 57 23 57 60 0 42-20 75-56 75-37 0-56-33-55-78Z" fill="${hair}"/>
               <path d="M90 87c11-24 54-37 78 0-14 17-29 24-45 24-14 0-24-8-33-24Z" fill="#5b3922"/>`
            : `<path d="M82 96c6-33 31-51 60-45 28 6 42 29 40 59-25-24-62-24-100-14Z" fill="${hair}"/>
               <circle cx="149" cy="43" r="19" fill="${hair}"/>`;

  const accessorySvg =
    spec.accessory === 'cap'
      ? `<path d="M86 75c14-26 70-30 89 1l-6 20H91l-5-21Z" fill="#0f766e"/>
         <path d="M111 84c34-2 60 2 78 12-17 8-49 8-82 2l4-14Z" fill="#115e59"/>`
      : spec.accessory === 'beanie'
        ? `<path d="M87 80c10-31 74-33 89 0v20H87V80Z" fill="#be123c"/>
           <path d="M91 94h80v14H91z" fill="#9f1239"/>`
        : spec.accessory === 'glasses'
          ? `<g fill="none" stroke="#0f172a" stroke-width="5" stroke-linecap="round"><circle cx="112" cy="103" r="15"/><circle cx="151" cy="103" r="15"/><path d="M127 103h9"/></g>`
          : '';

  const outfitPattern =
    spec.outfit === 'batik'
      ? `<g fill="none" stroke="#facc15" stroke-width="4" opacity=".7"><path d="M82 210c14-22 31-22 45 0s31 22 45 0"/><path d="M87 188c10 12 20 12 30 0s20-12 30 0"/></g>`
      : spec.outfit === 'apron'
        ? `<path d="M101 169h61l11 62H90l11-62Z" fill="#f8fafc" opacity=".88"/><path d="M103 183h58" stroke="#047857" stroke-width="5" stroke-linecap="round"/>`
        : spec.outfit === 'hoodie'
          ? `<path d="M83 176c15-24 80-25 96 0l-12 55H95l-12-55Z" fill="${outfit}"/><path d="M107 178c8 11 41 11 49 0" fill="none" stroke="#dbeafe" stroke-width="5" stroke-linecap="round"/>`
          : spec.outfit === 'jacket'
            ? `<path d="M80 178c18-26 84-26 102 0l-11 53H91l-11-53Z" fill="${outfit}"/><path d="M130 174v57" stroke="#e2e8f0" stroke-width="5"/><path d="M103 190h17M142 190h17" stroke="#e2e8f0" stroke-width="5" stroke-linecap="round"/>`
            : `<path d="M83 178c18-23 82-24 98 0l-12 53H95l-12-53Z" fill="${outfit}"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-label="${escapeXml(label)}">
    <defs>
      <linearGradient id="bg" x1="0" x2="1" y1="0" y2="1">
        <stop offset="0" stop-color="${bgStart}"/>
        <stop offset="1" stop-color="${bgEnd}"/>
      </linearGradient>
      <clipPath id="circle"><circle cx="128" cy="128" r="128"/></clipPath>
    </defs>
    <g clip-path="url(#circle)">
      <rect width="256" height="256" fill="url(#bg)"/>
      <path d="M20 205c38-22 64-18 94 0s70 22 122-4v55H20v-51Z" fill="#ffffff" opacity=".32"/>
      ${hairSvg}
      <ellipse cx="84" cy="111" rx="12" ry="17" fill="${skin}"/>
      <ellipse cx="172" cy="111" rx="12" ry="17" fill="${skin}"/>
      <rect x="108" y="137" width="40" height="45" rx="18" fill="${skin}"/>
      ${outfitPattern}
      <circle cx="128" cy="105" r="45" fill="${skin}"/>
      <path d="M96 83c12-30 61-37 76 4-18-5-30-8-45-6-13 2-21 6-31 2Z" fill="${isHijab ? '#475569' : hair}" opacity="${isHijab ? '.92' : '.96'}"/>
      ${accessorySvg}
      <circle cx="112" cy="105" r="4" fill="#111827"/>
      <circle cx="146" cy="105" r="4" fill="#111827"/>
      <path d="M121 124c7 6 17 6 24 0" fill="none" stroke="#7f1d1d" stroke-width="4" stroke-linecap="round"/>
      <path d="M129 108l-4 12h10" fill="none" stroke="#9a5c3b" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".6"/>
    </g>
  </svg>`;
}

export function createLajukanAvatarDataUrl(
  spec: Partial<LajukanAvatarSpec> = DEFAULT_LAJUKAN_AVATAR,
  label?: string,
) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(
    createLajukanAvatarSvg(spec, label),
  )}`;
}

export function AvatarBuilder({
  className,
  compact = false,
  isId,
  onChange,
  title,
  value,
}: {
  className?: string;
  compact?: boolean;
  isId: boolean;
  onChange: (spec: LajukanAvatarSpec, dataUrl: string) => void;
  title?: string;
  value: LajukanAvatarSpec;
}) {
  const spec = normalizeAvatarSpec(value);
  const dataUrl = createLajukanAvatarDataUrl(spec, title || 'Lajukan avatar');

  const update = (patch: Partial<LajukanAvatarSpec>) => {
    const next = normalizeAvatarSpec({ ...spec, ...patch });
    onChange(next, createLajukanAvatarDataUrl(next, title || 'Lajukan avatar'));
  };

  const randomize = () => {
    const pick = <T extends string>(items: Array<Option<T>>) =>
      items[Math.floor(Math.random() * items.length)]!.id;
    const next = normalizeAvatarSpec({
      skin: pick(SKINS),
      hair: pick(HAIRS),
      accessory: pick(ACCESSORIES),
      outfit: pick(OUTFITS),
      background: pick(BACKGROUNDS),
    });
    onChange(next, createLajukanAvatarDataUrl(next, title || 'Lajukan avatar'));
  };

  return (
    <section
      className={cn(
        'rounded-[22px] border border-slate-200 bg-white p-3 shadow-[0_16px_34px_-30px_rgba(15,23,42,0.2)] dark:border-white/10 dark:bg-slate-900',
        compact ? 'sm:p-3' : 'sm:p-4',
        className,
      )}
    >
      <div className="grid gap-3 sm:grid-cols-[132px_minmax(0,1fr)]">
        <div className="min-w-0">
          <div className="mx-auto aspect-square w-full max-w-[132px] overflow-hidden rounded-[28px] border border-slate-200 bg-slate-50 dark:border-white/10 dark:bg-slate-950">
            <Image
              src={dataUrl}
              alt={title || 'Avatar'}
              width={132}
              height={132}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
          <button
            type="button"
            onClick={randomize}
            className="mt-2 inline-flex min-h-9 w-full items-center justify-center gap-2 rounded-full bg-slate-950 px-3 text-xs font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
          >
            <Dice5 className="h-3.5 w-3.5" />
            {isId ? 'Acak gaya' : 'Shuffle'}
          </button>
        </div>

        <div className="min-w-0 space-y-3">
          <div>
            <p className="flex items-center gap-1.5 text-[12px] font-black text-slate-900 dark:text-white">
              <Sparkles className="h-3.5 w-3.5 text-[color:var(--app-accent)]" />
              {isId ? 'Avatar 2D' : '2D avatar'}
            </p>
            <p className="mt-0.5 text-[11px] leading-5 text-slate-500 dark:text-slate-400">
              {isId
                ? 'Pilih karakter. Bisa ganti kulit, rambut, topi, pakaian, dan warna.'
                : 'Pick a character. Customize skin, hair, accessories, outfit, and color.'}
            </p>
          </div>

          <OptionRow
            icon={Palette}
            isId={isId}
            labelId="Kulit"
            labelEn="Skin"
            options={SKINS}
            selected={spec.skin}
            onSelect={skin => update({ skin })}
          />
          <OptionRow
            icon={UserRound}
            isId={isId}
            labelId="Rambut"
            labelEn="Hair"
            options={HAIRS}
            selected={spec.hair}
            onSelect={hair => update({ hair })}
          />
          <OptionRow
            icon={Sparkles}
            isId={isId}
            labelId="Aksesori"
            labelEn="Accessory"
            options={ACCESSORIES}
            selected={spec.accessory}
            onSelect={accessory => update({ accessory })}
          />
          <OptionRow
            icon={Shirt}
            isId={isId}
            labelId="Pakaian"
            labelEn="Outfit"
            options={OUTFITS}
            selected={spec.outfit}
            onSelect={outfit => update({ outfit })}
          />
          <OptionRow
            icon={Palette}
            isId={isId}
            labelId="Warna"
            labelEn="Color"
            options={BACKGROUNDS}
            selected={spec.background}
            onSelect={background => update({ background })}
          />
        </div>
      </div>
    </section>
  );
}

function OptionRow<T extends string>({
  icon: Icon,
  isId,
  labelEn,
  labelId,
  onSelect,
  options,
  selected,
}: {
  icon: typeof Palette;
  isId: boolean;
  labelEn: string;
  labelId: string;
  onSelect: (value: T) => void;
  options: Array<Option<T>>;
  selected: T;
}) {
  return (
    <div className="min-w-0">
      <p className="mb-1.5 flex items-center gap-1.5 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
        <Icon className="h-3.5 w-3.5" />
        {isId ? labelId : labelEn}
      </p>
      <div className="flex min-w-0 gap-1.5 overflow-x-auto pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {options.map(option => {
          const active = option.id === selected;
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelect(option.id)}
              className={cn(
                'inline-flex min-h-8 shrink-0 items-center gap-1.5 rounded-full border px-2.5 text-[11px] font-black transition',
                active
                  ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                  : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-[color:var(--app-accent-border)] dark:border-white/10 dark:bg-slate-950 dark:text-slate-200',
              )}
            >
              {option.color ? (
                <span
                  className="h-3.5 w-3.5 rounded-full ring-1 ring-black/10"
                  style={{ backgroundColor: option.color }}
                />
              ) : null}
              <span>{isId ? option.labelId : option.labelEn}</span>
              {active ? <Check className="h-3.5 w-3.5" /> : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
