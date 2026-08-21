'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  BadgeCheck,
  Check,
  CircleAlert,
  Crown,
  Dice5,
  Feather,
  Loader2,
  Palette,
  Shield,
  Shirt,
  Smile,
  Sparkles,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { LajukanImage as Image } from '@/components/common/LajukanImage';
import { Modal } from '@/components/common/Modal';
import {
  AURAS,
  BACKGROUNDS,
  BACK_ITEMS,
  BODY_TYPES,
  DEFAULT_LAJUKAN_AVATAR,
  EYEWEAR,
  FACE_ACCESSORIES,
  HAIRS,
  HAIR_COLORS,
  HAND_ITEMS,
  HEADWEAR,
  LAJUKAN_AVATAR_PRESETS,
  MOODS,
  MOTIONS,
  OUTFITS,
  OUTFIT_COLORS,
  POSES,
  SKINS,
  WINGS,
  createLajukanAvatarDataUrl,
  labelOf,
  normalizeAvatarSpec,
  sameAvatarSpec,
  type AvatarOption,
  type LajukanAvatarPreset,
  type LajukanAvatarSpec,
  type LajukanAvatarStyle,
} from '@/lib/profile/avatar2d';
import { cn } from '@/lib/utils';

export {
  DEFAULT_LAJUKAN_AVATAR,
  LAJUKAN_AVATAR_PRESETS,
  createLajukanAvatarDataUrl,
  readLajukanAvatarSpec,
} from '@/lib/profile/avatar2d';
export type {
  AvatarAccessoryId,
  AvatarAuraId,
  AvatarBackItemId,
  AvatarBackgroundId,
  AvatarEffectId,
  AvatarHairId,
  AvatarHandItemId,
  AvatarHeadwearId,
  AvatarMoodId,
  AvatarOutfitId,
  AvatarSkinId,
  AvatarWingId,
  LajukanAvatarSpec,
  LajukanAvatarSpecV2,
} from '@/lib/profile/avatar2d';

type AvatarTabKey =
  | 'preset'
  | 'body'
  | 'skin'
  | 'hair'
  | 'headwear'
  | 'face'
  | 'outfit'
  | 'wing'
  | 'aura'
  | 'backItem'
  | 'handItem'
  | 'background';

type OptionFocus = 'full' | 'head' | 'body' | 'wide' | 'effect' | 'background';

type AvatarBuilderProps = {
  className?: string;
  compact?: boolean;
  isId?: boolean;
  locale?: string;
  onChange: (spec: LajukanAvatarSpec, dataUrl: string) => void;
  onConfirm?: (
    spec: LajukanAvatarSpec,
    dataUrl: string,
  ) => Promise<void> | void;
  title?: string;
  value?: Partial<LajukanAvatarStyle> | null;
};

type AvatarTab = {
  key: AvatarTabKey;
  labelId: string;
  labelEn: string;
  icon: LucideIcon;
};

const AVATAR_TABS: ReadonlyArray<AvatarTab> = [
  { key: 'preset', labelId: 'Template', labelEn: 'Presets', icon: Crown },
  { key: 'body', labelId: 'Tubuh', labelEn: 'Body', icon: UserRound },
  { key: 'skin', labelId: 'Kulit', labelEn: 'Skin', icon: Palette },
  { key: 'hair', labelId: 'Rambut', labelEn: 'Hair', icon: Feather },
  { key: 'headwear', labelId: 'Topi / Hijab', labelEn: 'Headwear', icon: Crown },
  { key: 'face', labelId: 'Wajah', labelEn: 'Face', icon: Smile },
  { key: 'outfit', labelId: 'Pakaian', labelEn: 'Outfit', icon: Shirt },
  { key: 'wing', labelId: 'Sayap', labelEn: 'Wings', icon: Feather },
  { key: 'aura', labelId: 'Aura', labelEn: 'Aura', icon: Sparkles },
  { key: 'backItem', labelId: 'Aksesori Belakang', labelEn: 'Back item', icon: Shield },
  {
    key: 'handItem',
    labelId: 'Aksesori Tangan',
    labelEn: 'Hand item',
    icon: BadgeCheck,
  },
  {
    key: 'background',
    labelId: 'Latar',
    labelEn: 'Background',
    icon: Palette,
  },
];

export function AvatarBuilder({
  className,
  compact = false,
  isId: isIdProp,
  locale,
  onChange,
  onConfirm,
  title,
  value = DEFAULT_LAJUKAN_AVATAR,
}: AvatarBuilderProps) {
  const [customizerOpen, setCustomizerOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<AvatarTabKey>('preset');
  const [confirming, setConfirming] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);

  const isId =
    typeof isIdProp === 'boolean'
      ? isIdProp
      : locale
        ? locale.toLowerCase().startsWith('id')
        : true;

  const normalizedValue = useMemo(() => normalizeAvatarSpec(value), [value]);
  const [draftSpec, setDraftSpec] = useState<LajukanAvatarSpec>(() =>
    normalizeAvatarSpec(value),
  );
  const avatarLabel = title || 'Lajukan avatar';

  useEffect(() => {
    if (customizerOpen) return;
    setDraftSpec(current =>
      sameAvatarSpec(current, normalizedValue) ? current : normalizedValue,
    );
  }, [customizerOpen, normalizedValue]);

  const dataUrl = useMemo(
    () => createLajukanAvatarDataUrl(draftSpec, avatarLabel),
    [avatarLabel, draftSpec],
  );
  const rarity = useMemo(() => getRarity(draftSpec), [draftSpec]);

  const commitSpec = (next: LajukanAvatarSpec) => {
    setDraftSpec(next);
    setConfirmError(null);
    onChange(next, createLajukanAvatarDataUrl(next, avatarLabel));
  };

  const update = (patch: Partial<LajukanAvatarStyle>) => {
    const next = normalizeAvatarSpec({ ...draftSpec, ...patch });
    commitSpec(next);
  };

  const randomize = () => {
    const next = normalizeAvatarSpec({
      ...draftSpec,
      ...randomAvatarSpec(draftSpec),
    });
    commitSpec(next);
  };

  const openCustomizer = () => {
    setDraftSpec(normalizedValue);
    setConfirmError(null);
    setActiveTab('preset');
    setCustomizerOpen(true);
  };

  const closeCustomizer = () => {
    if (confirming) return;
    setConfirmError(null);
    setCustomizerOpen(false);
  };

  const confirmAvatar = async () => {
    if (!onConfirm) {
      closeCustomizer();
      return;
    }

    setConfirming(true);
    setConfirmError(null);
    try {
      await onConfirm(draftSpec, dataUrl);
      setCustomizerOpen(false);
    } catch {
      setConfirmError(
        isId
          ? 'Avatar belum berhasil disimpan. Coba lagi.'
          : 'The avatar could not be saved. Please try again.',
      );
    } finally {
      setConfirming(false);
    }
  };

  return (
    <>
      <section
        className={cn(
          'relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-3 shadow-[0_16px_36px_-28px_rgba(15,23,42,0.34)] dark:border-white/10 dark:bg-slate-950',
          compact ? 'sm:p-3' : 'sm:p-4',
          className,
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-emerald-50/90 to-transparent dark:from-emerald-500/10" />
        <div className="relative grid grid-cols-[92px_minmax(0,1fr)] items-center gap-3 sm:grid-cols-[132px_minmax(0,1fr)] sm:gap-4">
          <AvatarPreview
            alt={avatarLabel}
            dataUrl={dataUrl}
            isId={isId}
            rarity={rarity}
            size="compact"
          />
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="min-w-0 truncate text-sm font-bold text-slate-950 dark:text-white">
                {title || (isId ? 'Avatar Lajukan' : 'Lajukan Avatar')}
              </p>
              <span className="inline-flex items-center justify-center rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                {isId ? 'Avatar 2D' : '2D Avatar'}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs font-semibold leading-5 text-slate-600 dark:text-slate-300">
              {isId
                ? 'Pilih template atau atur detail wajah, rambut, pakaian, aksesori, dan latar.'
                : 'Choose a preset or customize the face, hair, outfit, accessories, and background.'}
            </p>
            <LoadoutSummary isId={isId} spec={draftSpec} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              <AvatarActionButton onClick={randomize} variant="secondary">
                <Dice5 className="h-3.5 w-3.5" />
                {isId ? 'Acak gaya' : 'Shuffle'}
              </AvatarActionButton>
              <AvatarActionButton onClick={openCustomizer}>
                <Sparkles className="h-3.5 w-3.5" />
                {isId ? 'Atur avatar' : 'Customize'}
              </AvatarActionButton>
            </div>
          </div>
        </div>
      </section>

      <Modal
        open={customizerOpen}
        title={isId ? 'Buat Avatar Kamu' : 'Create Your Avatar'}
        onClose={closeCustomizer}
        className="sm:max-w-5xl"
        footer={
          <>
            <AvatarActionButton
              disabled={confirming}
              onClick={randomize}
              variant="secondary"
            >
              <Dice5 className="h-4 w-4" />
              {isId ? 'Acak gaya' : 'Shuffle style'}
            </AvatarActionButton>
            <AvatarActionButton disabled={confirming} onClick={confirmAvatar}>
              {confirming ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Check className="h-4 w-4" />
              )}
              {confirming
                ? isId
                  ? 'Menyimpan...'
                  : 'Saving...'
                : isId
                  ? 'Pakai avatar ini'
                  : 'Use this avatar'}
            </AvatarActionButton>
          </>
        }
      >
        {confirmError ? (
          <div
            role="alert"
            className="mb-4 flex items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs font-semibold leading-5 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200"
          >
            <CircleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{confirmError}</span>
          </div>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)] xl:grid-cols-[300px_minmax(0,1fr)]">
          <aside className="lg:sticky lg:top-0 lg:self-start">
            <AvatarPreview
              alt={avatarLabel}
              dataUrl={dataUrl}
              isId={isId}
              rarity={rarity}
              size="large"
            />
            <LoadoutSummary isId={isId} spec={draftSpec} variant="panel" />
          </aside>

          <section className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50/70 p-3 dark:border-white/10 dark:bg-white/5 sm:p-4">
            <AvatarTabStrip
              activeTab={activeTab}
              isId={isId}
              onSelect={setActiveTab}
            />
            <div className="mt-4">
              <PartPanel
                activeTab={activeTab}
                avatarLabel={avatarLabel}
                isId={isId}
                onChange={update}
                spec={draftSpec}
              />
            </div>
          </section>
        </div>
      </Modal>
    </>
  );
}

function AvatarPreview({
  alt,
  dataUrl,
  isId,
  rarity,
  size,
}: {
  alt: string;
  dataUrl: string;
  isId: boolean;
  rarity: string;
  size: 'compact' | 'large';
}) {
  const large = size === 'large';
  return (
    <div
      className={cn(
        'relative mx-auto aspect-square overflow-hidden border border-slate-200 bg-[linear-gradient(160deg,#ecfdf5_0%,#f8fafc_48%,#ffffff_100%)] shadow-[0_18px_38px_-30px_rgba(15,23,42,0.5)] dark:border-white/10 dark:bg-[linear-gradient(160deg,#052e2b_0%,#0f172a_52%,#020617_100%)]',
        large
          ? 'w-full max-w-[220px] rounded-3xl sm:max-w-[260px] lg:max-w-[300px]'
          : 'w-[92px] rounded-2xl sm:w-full sm:max-w-[132px]',
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.95),transparent_38%),linear-gradient(180deg,transparent_55%,rgba(15,23,42,0.08))] dark:bg-[radial-gradient(circle_at_50%_18%,rgba(255,255,255,0.08),transparent_40%),linear-gradient(180deg,transparent_55%,rgba(0,0,0,0.18))]" />
      <Image
        src={dataUrl}
        alt={alt}
        width={large ? 320 : 156}
        height={large ? 320 : 156}
        className="relative h-full w-full object-contain"
        unoptimized
      />
      <span className="absolute left-2 top-2 inline-flex min-h-6 items-center gap-1 rounded-full bg-slate-950/80 px-2 text-[10px] font-bold text-white shadow-sm  dark:bg-white/90 dark:text-slate-950">
        <Crown className="h-3 w-3" />
        {rarityLabel(rarity, isId)}
      </span>
      {large ? (
        <span className="absolute bottom-2 left-2 right-2 rounded-xl bg-white/90 px-3 py-2 text-center text-[10px] font-bold text-slate-600 shadow-sm backdrop-blur dark:bg-slate-950/75 dark:text-slate-200">
          {isId ? 'Pratinjau avatar' : 'Avatar preview'}
        </span>
      ) : null}
    </div>
  );
}

function AvatarTabStrip({
  activeTab,
  isId,
  onSelect,
}: {
  activeTab: AvatarTabKey;
  isId: boolean;
  onSelect: (tab: AvatarTabKey) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label={isId ? 'Bagian avatar' : 'Avatar sections'}
      className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {AVATAR_TABS.map(tab => {
        const Icon = tab.icon;
        const active = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onSelect(tab.key)}
            className={cn(
              'inline-flex min-h-10 shrink-0 items-center gap-2 rounded-full border px-3 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2',
              active
                ? 'border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-950/15 dark:border-white dark:bg-white dark:text-slate-950'
                : 'border-slate-200 bg-white/80 text-slate-700 hover:border-[color:var(--app-accent-border)] dark:border-white/10 dark:bg-white/10 dark:text-slate-200',
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            {isId ? tab.labelId : tab.labelEn}
          </button>
        );
      })}
    </div>
  );
}

function PartPanel({
  activeTab,
  avatarLabel,
  isId,
  onChange,
  spec,
}: {
  activeTab: AvatarTabKey;
  avatarLabel: string;
  isId: boolean;
  onChange: (patch: Partial<LajukanAvatarStyle>) => void;
  spec: LajukanAvatarSpec;
}) {
  const title = AVATAR_TABS.find(tab => tab.key === activeTab);
  return (
    <div>
      <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {title ? (isId ? title.labelId : title.labelEn) : activeTab}
          </p>
          <p className="mt-1 text-xs font-semibold text-slate-500 dark:text-slate-400">
            {activeTab === 'preset'
              ? isId
                ? `Pilih salah satu dari ${LAJUKAN_AVATAR_PRESETS.length} template, lalu ubah bagian yang kamu mau.`
                : `Choose one of ${LAJUKAN_AVATAR_PRESETS.length} presets, then customize any part you want.`
              : isId
                ? 'Pilih salah satu opsi. Perubahan langsung terlihat di pratinjau.'
                : 'Choose an option. Changes appear immediately in the preview.'}
          </p>
        </div>
        {activeTab === 'preset' ? (
          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-[10px] font-bold text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-200">
            {LAJUKAN_AVATAR_PRESETS.length} {isId ? 'template' : 'presets'}
          </span>
        ) : null}
      </div>

      {activeTab === 'preset' ? (
        <PresetGrid
          avatarLabel={avatarLabel}
          isId={isId}
          onSelect={preset => onChange(preset)}
          selected={spec}
        />
      ) : (
        <TabContent
          avatarLabel={avatarLabel}
          isId={isId}
          onChange={onChange}
          spec={spec}
          tab={activeTab}
        />
      )}
    </div>
  );
}

function TabContent({
  avatarLabel,
  isId,
  onChange,
  spec,
  tab,
}: {
  avatarLabel: string;
  isId: boolean;
  onChange: (patch: Partial<LajukanAvatarStyle>) => void;
  spec: LajukanAvatarSpec;
  tab: Exclude<AvatarTabKey, 'preset'>;
}) {
  if (tab === 'body') {
    return (
      <div className="space-y-4">
        <OptionSection
          avatarLabel={avatarLabel}
          focus="body"
          isId={isId}
          label={isId ? 'Bentuk tubuh' : 'Body shape'}
          onSelect={body => onChange({ body })}
          options={BODY_TYPES}
          patch={body => ({ body })}
          selected={spec.body}
          spec={spec}
        />
        <OptionSection
          avatarLabel={avatarLabel}
          focus="body"
          isId={isId}
          label={isId ? 'Pose' : 'Pose'}
          onSelect={pose => onChange({ pose })}
          options={POSES}
          patch={pose => ({ pose })}
          selected={spec.pose}
          spec={spec}
        />
        <OptionSection
          avatarLabel={avatarLabel}
          focus="effect"
          isId={isId}
          label={isId ? 'Animasi' : 'Motion'}
          onSelect={motion => onChange({ motion })}
          options={MOTIONS}
          patch={motion => ({ motion })}
          selected={spec.motion}
          spec={spec}
        />
      </div>
    );
  }
  if (tab === 'hair') {
    return (
      <div className="space-y-4">
        <OptionSection
          avatarLabel={avatarLabel}
          focus="head"
          isId={isId}
          label={isId ? 'Model rambut' : 'Hair style'}
          onSelect={hair => onChange({ hair })}
          options={HAIRS}
          patch={hair => ({ hair })}
          selected={spec.hair}
          spec={spec}
        />
        <OptionSection
          avatarLabel={avatarLabel}
          focus="head"
          isId={isId}
          label={isId ? 'Warna rambut' : 'Hair color'}
          onSelect={hairColor => onChange({ hairColor })}
          options={HAIR_COLORS}
          patch={hairColor => ({ hairColor })}
          selected={spec.hairColor}
          spec={spec}
        />
      </div>
    );
  }
  if (tab === 'face') {
    return (
      <div className="space-y-4">
        <OptionSection
          avatarLabel={avatarLabel}
          focus="head"
          isId={isId}
          label={isId ? 'Ekspresi' : 'Expression'}
          onSelect={mood => onChange({ mood })}
          options={MOODS}
          patch={mood => ({ mood })}
          selected={spec.mood}
          spec={spec}
        />
        <OptionSection
          avatarLabel={avatarLabel}
          focus="head"
          isId={isId}
          label={isId ? 'Kacamata' : 'Eyewear'}
          onSelect={eyewear => onChange({ eyewear })}
          options={EYEWEAR}
          patch={eyewear => ({ eyewear })}
          selected={spec.eyewear}
          spec={spec}
        />
        <OptionSection
          avatarLabel={avatarLabel}
          focus="head"
          isId={isId}
          label={isId ? 'Detail wajah' : 'Face detail'}
          onSelect={faceAccessory => onChange({ faceAccessory })}
          options={FACE_ACCESSORIES}
          patch={faceAccessory => ({ faceAccessory })}
          selected={spec.faceAccessory}
          spec={spec}
        />
      </div>
    );
  }
  if (tab === 'outfit') {
    return (
      <div className="space-y-4">
        <OptionSection
          avatarLabel={avatarLabel}
          focus="body"
          isId={isId}
          label={isId ? 'Model baju' : 'Outfit'}
          onSelect={outfit => onChange({ outfit })}
          options={OUTFITS}
          patch={outfit => ({ outfit })}
          selected={spec.outfit}
          spec={spec}
        />
        <OptionSection
          avatarLabel={avatarLabel}
          focus="body"
          isId={isId}
          label={isId ? 'Warna baju' : 'Outfit color'}
          onSelect={outfitColor => onChange({ outfitColor })}
          options={OUTFIT_COLORS}
          patch={outfitColor => ({ outfitColor })}
          selected={spec.outfitColor}
          spec={spec}
        />
      </div>
    );
  }
  return (
    <OptionSection
      avatarLabel={avatarLabel}
      focus={focusForTab(tab)}
      isId={isId}
      label={sectionLabel(tab, isId)}
      onSelect={id => onChange(patchForTab(tab, id))}
      options={optionsForTab(tab)}
      patch={id => patchForTab(tab, id)}
      selected={spec[tab]}
      spec={spec}
    />
  );
}

function OptionSection<T extends string>({
  avatarLabel,
  focus,
  isId,
  label,
  onSelect,
  options,
  patch,
  selected,
  spec,
}: {
  avatarLabel: string;
  focus: OptionFocus;
  isId: boolean;
  label: string;
  onSelect: (id: T) => void;
  options: ReadonlyArray<AvatarOption<T>>;
  patch: (id: T) => Partial<LajukanAvatarStyle>;
  selected: T;
  spec: LajukanAvatarSpec;
}) {
  return (
    <section>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 dark:text-slate-400">
        {label}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-4">
        {options.map(option => {
          const previewSpec = normalizeAvatarSpec({
            ...spec,
            ...patch(option.id),
          });
          return (
            <AvatarOptionTile
              key={option.id}
              active={selected === option.id}
              color={option.color}
              focus={focus}
              label={isId ? option.labelId : option.labelEn}
              onClick={() => onSelect(option.id)}
              preview={createLajukanAvatarDataUrl(previewSpec, avatarLabel)}
            />
          );
        })}
      </div>
    </section>
  );
}

function AvatarOptionTile({
  active,
  color,
  focus,
  label,
  onClick,
  preview,
}: {
  active: boolean;
  color?: string;
  focus: OptionFocus;
  label: string;
  onClick: () => void;
  preview: string;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'group min-w-0 rounded-2xl border bg-white p-2 text-center shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 dark:bg-white/10',
        active
          ? 'border-[color:var(--app-accent)] ring-2 ring-[color:var(--app-accent)]/15'
          : 'border-slate-200 dark:border-white/10',
      )}
    >
      <div className="relative mx-auto aspect-square w-full overflow-hidden rounded-[14px] bg-slate-100 dark:bg-slate-950">
        <Image
          src={preview}
          alt={label}
          width={130}
          height={130}
          className={cn(
            'h-full w-full object-cover transition duration-200 group-hover:scale-105',
            focusClass(focus),
          )}
          unoptimized
        />
        {color ? (
          <span
            className="absolute bottom-1.5 left-1.5 h-5 w-5 rounded-full border-2 border-white shadow-sm ring-1 ring-black/10 dark:border-slate-950"
            style={{ backgroundColor: color }}
          />
        ) : null}
        {active ? (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-[color:var(--app-accent)] p-1 text-white shadow-sm">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <span className="mt-2 block truncate text-[11px] font-bold text-slate-800 dark:text-white">
        {label}
      </span>
    </button>
  );
}

function PresetGrid({
  avatarLabel,
  isId,
  onSelect,
  selected,
}: {
  avatarLabel: string;
  isId: boolean;
  onSelect: (spec: LajukanAvatarSpec) => void;
  selected: LajukanAvatarSpec;
}) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5">
      {LAJUKAN_AVATAR_PRESETS.map(preset => {
        const active = sameAvatarSpec(selected, preset.spec);
        return (
          <PresetButton
            key={preset.key}
            active={active}
            avatarLabel={avatarLabel}
            isId={isId}
            onClick={() => onSelect(preset.spec)}
            preset={preset}
          />
        );
      })}
    </div>
  );
}

function PresetButton({
  active,
  avatarLabel,
  isId,
  onClick,
  preset,
}: {
  active: boolean;
  avatarLabel: string;
  isId: boolean;
  onClick: () => void;
  preset: LajukanAvatarPreset;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={cn(
        'group min-w-0 rounded-2xl border bg-white p-2 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 dark:bg-white/10',
        active
          ? 'border-slate-950 ring-2 ring-slate-950/10 dark:border-white dark:ring-white/20'
          : 'border-slate-200 dark:border-white/10',
      )}
    >
      <div className="relative overflow-hidden rounded-[16px] bg-slate-100 dark:bg-slate-950">
        <Image
          src={createLajukanAvatarDataUrl(preset.spec, avatarLabel)}
          alt={isId ? preset.labelId : preset.labelEn}
          width={126}
          height={126}
          className="aspect-square w-full object-cover transition group-hover:scale-105"
          unoptimized
        />
        <span className="absolute left-1.5 top-1.5 rounded-full bg-slate-950/80 px-1.5 py-0.5 text-[9px] font-bold text-white ">
          {rarityLabel(preset.rarity, isId)}
        </span>
        {active ? (
          <span className="absolute right-1.5 top-1.5 rounded-full bg-slate-950 p-1 text-white dark:bg-white dark:text-slate-950">
            <Check className="h-3.5 w-3.5" />
          </span>
        ) : null}
      </div>
      <p className="mt-2 truncate text-[11px] font-bold text-slate-900 dark:text-white">
        {isId ? preset.labelId : preset.labelEn}
      </p>
      <p className="mt-0.5 line-clamp-2 text-[10px] font-semibold leading-4 text-slate-500 dark:text-slate-400">
        {isId ? preset.captionId : preset.captionEn}
      </p>
    </button>
  );
}

function LoadoutSummary({
  isId,
  spec,
  variant = 'compact',
}: {
  isId: boolean;
  spec: LajukanAvatarSpec;
  variant?: 'compact' | 'panel';
}) {
  const chips = buildChips(spec, isId);
  const visibleChips = variant === 'compact' ? chips.slice(0, 4) : chips;
  return (
    <div
      className={cn(
        'rounded-[20px] border border-slate-200 bg-white/80 p-3 shadow-sm dark:border-white/10 dark:bg-white/10',
        variant === 'panel' ? 'mt-3' : 'mt-2',
      )}
    >
      <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
        {isId ? 'Pilihan saat ini' : 'Current choices'}
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {visibleChips.map(chip => (
          <span
            key={chip}
            className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-700 dark:border-white/10 dark:bg-slate-950 dark:text-slate-200"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

function AvatarActionButton({
  children,
  disabled = false,
  onClick,
  variant = 'primary',
}: {
  children: ReactNode;
  disabled?: boolean;
  onClick: () => void;
  variant?: 'primary' | 'secondary';
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--app-accent)] focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60',
        variant === 'primary'
          ? 'bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-slate-100'
          : 'border border-slate-200 bg-white text-slate-800 hover:bg-slate-50 dark:border-white/10 dark:bg-white/10 dark:text-white dark:hover:bg-white/15',
      )}
    >
      {children}
    </button>
  );
}

function optionsForTab(
  tab: Exclude<AvatarTabKey, 'preset' | 'body' | 'hair' | 'face' | 'outfit'>,
) {
  if (tab === 'skin') return SKINS;
  if (tab === 'headwear') return HEADWEAR;
  if (tab === 'wing') return WINGS;
  if (tab === 'aura') return AURAS;
  if (tab === 'backItem') return BACK_ITEMS;
  if (tab === 'handItem') return HAND_ITEMS;
  return BACKGROUNDS;
}

function patchForTab(
  tab: AvatarTabKey,
  id: string,
): Partial<LajukanAvatarStyle> {
  if (tab === 'skin') return { skin: id as LajukanAvatarSpec['skin'] };
  if (tab === 'headwear')
    return { headwear: id as LajukanAvatarSpec['headwear'] };
  if (tab === 'wing') return { wing: id as LajukanAvatarSpec['wing'] };
  if (tab === 'aura') return { aura: id as LajukanAvatarSpec['aura'] };
  if (tab === 'backItem')
    return { backItem: id as LajukanAvatarSpec['backItem'] };
  if (tab === 'handItem')
    return { handItem: id as LajukanAvatarSpec['handItem'] };
  if (tab === 'background')
    return { background: id as LajukanAvatarSpec['background'] };
  return {};
}

function focusForTab(tab: AvatarTabKey): OptionFocus {
  if (tab === 'skin' || tab === 'headwear' || tab === 'face') return 'head';
  if (tab === 'outfit' || tab === 'body' || tab === 'handItem') return 'body';
  if (tab === 'wing' || tab === 'backItem') return 'wide';
  if (tab === 'aura') return 'effect';
  if (tab === 'background') return 'background';
  return 'full';
}

function focusClass(focus: OptionFocus): string {
  if (focus === 'head') return 'scale-[1.45] translate-y-5';
  if (focus === 'body') return 'scale-[1.18] -translate-y-1';
  if (focus === 'wide') return 'scale-105';
  if (focus === 'effect') return 'scale-100';
  if (focus === 'background') return 'scale-95';
  return '';
}

function sectionLabel(tab: AvatarTabKey, isId: boolean): string {
  const labels: Record<string, [string, string]> = {
    skin: ['Warna kulit', 'Skin tone'],
    headwear: ['Topi dan hijab', 'Headwear'],
    wing: ['Sayap', 'Wings'],
    aura: ['Aura', 'Aura'],
    backItem: ['Item belakang', 'Back item'],
    handItem: ['Item tangan', 'Hand item'],
    background: ['Background', 'Background'],
  };
  const value = labels[tab] || [tab, tab];
  return isId ? value[0] : value[1];
}

function buildChips(spec: LajukanAvatarSpec, isId: boolean): string[] {
  const chips = [
    labelOf(BODY_TYPES, spec.body, isId),
    labelOf(HAIRS, spec.hair, isId),
    labelOf(OUTFITS, spec.outfit, isId),
    labelOf(MOODS, spec.mood, isId),
  ];
  if (spec.headwear !== 'none')
    chips.push(labelOf(HEADWEAR, spec.headwear, isId));
  if (spec.eyewear !== 'none') chips.push(labelOf(EYEWEAR, spec.eyewear, isId));
  if (spec.wing !== 'none') chips.push(labelOf(WINGS, spec.wing, isId));
  if (spec.aura !== 'none') chips.push(labelOf(AURAS, spec.aura, isId));
  if (spec.backItem !== 'none')
    chips.push(labelOf(BACK_ITEMS, spec.backItem, isId));
  if (spec.handItem !== 'none')
    chips.push(labelOf(HAND_ITEMS, spec.handItem, isId));
  return chips.slice(0, 9);
}

function getRarity(spec: LajukanAvatarSpec): string {
  const preset = LAJUKAN_AVATAR_PRESETS.find(item =>
    sameAvatarSpec(spec, item.spec),
  );
  if (preset) return preset.rarity;
  const score = [
    spec.headwear !== 'none',
    spec.eyewear !== 'none',
    spec.faceAccessory !== 'none',
    spec.wing !== 'none',
    spec.aura !== 'none',
    spec.backItem !== 'none',
    spec.handItem !== 'none',
  ].filter(Boolean).length;
  if (score >= 5) return 'Legend';
  if (score >= 3) return 'Epic';
  if (score >= 1) return 'Rare';
  return 'Basic';
}

function randomAvatarSpec(
  base: LajukanAvatarSpec,
): Partial<LajukanAvatarStyle> {
  const fantasyMode = Math.random() < 0.32;

  return {
    ...base,
    body: pickRandom(BODY_TYPES),
    skin: pickRandom(SKINS),
    hair: pickRandom(HAIRS),
    hairColor: pickRandom(HAIR_COLORS),
    headwear: maybeNone(HEADWEAR, 0.48),
    eyewear: maybeNone(EYEWEAR, 0.68),
    faceAccessory: maybeNone(FACE_ACCESSORIES, 0.76),
    outfit: pickRandom(OUTFITS),
    outfitColor: pickRandom(OUTFIT_COLORS),
    wing: fantasyMode ? maybeNone(WINGS, 0.5) : noneOrFirst(WINGS),
    aura: fantasyMode ? maybeNone(AURAS, 0.42) : noneOrFirst(AURAS),
    backItem: maybeNone(BACK_ITEMS, 0.7),
    handItem: maybeNone(HAND_ITEMS, 0.48),
    mood: pickRandom(MOODS),
    background: pickRandom(BACKGROUNDS),
    pose: pickRandom(POSES),
    motion: pickRandom(MOTIONS),
  };
}

function pickRandom<T extends string>(
  options: ReadonlyArray<AvatarOption<T>>,
  skipNone = false,
): T {
  const fallback = options[0];
  if (!fallback) {
    throw new Error('Avatar option list cannot be empty');
  }
  const candidates = skipNone
    ? options.filter(option => option.id !== 'none')
    : options;
  const source = candidates.length > 0 ? candidates : options;
  const index = Math.floor(Math.random() * source.length);
  return (source[index] || fallback).id;
}

function noneOrFirst<T extends string>(
  options: ReadonlyArray<AvatarOption<T>>,
): T {
  const none = options.find(option => option.id === 'none');
  return none?.id ?? pickRandom(options);
}

function rarityLabel(value: string, isId: boolean): string {
  if (!isId) return value;
  const labels: Record<string, string> = {
    Basic: 'Dasar',
    Rare: 'Langka',
    Epic: 'Epik',
    Legend: 'Legenda',
  };
  return labels[value] || value;
}

function maybeNone<T extends string>(
  options: ReadonlyArray<AvatarOption<T>>,
  noneChance: number,
): T {
  if (Math.random() < noneChance) {
    const none = options.find(option => option.id === 'none');
    if (none) return none.id;
  }
  return pickRandom(options, true);
}