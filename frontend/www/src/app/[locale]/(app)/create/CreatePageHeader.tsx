'use client';

import { AlertTriangle, CheckCircle2, type LucideIcon } from 'lucide-react';

type CreatePageHeaderProps = {
  locale: string;
  formEyebrow: string;
  formTitle: string;
  formSubtitle: string;
  uiVariant?: 'default' | 'compact';
  contentStatus: 'draft' | 'active';
  currentStep: number;
  totalSteps: number;
  stepLabels: string[];
  onStepSelect: (step: number) => void;
  activeTypeIcon: LucideIcon;
  selectedTypeLabel: string;
  typePicked: boolean;
  typeThemeBadgeClass: string;
  listingSideContextLabel: string;
  typeSummaryDescription: string;
  requiredDone: number;
  requiredTotal: number;
  imagesCount: number;
  documentsCount: number;
  promotionEnabled: boolean;
  promotionRequiredDone: number;
  promotionRequiredTotal: number;
  publishBlockersCount: number;
  publishReadyCount: number;
  publishReadinessTotal: number;
  supportsSimpleMode: boolean;
  listingMode: 'simple' | 'detail';
  onListingModeChange: (mode: 'simple' | 'detail') => void;
  hideModeSwitch?: boolean;
  canChangeTypeBeforeDraft: boolean;
  onChangeType: () => void;
  typeSelectionLocked: boolean;
};

export function CreatePageHeader({
  locale,
  formEyebrow,
  formTitle,
  formSubtitle,
  uiVariant = 'default',
  contentStatus,
  currentStep,
  totalSteps,
  stepLabels,
  onStepSelect,
  activeTypeIcon: ActiveTypeIcon,
  selectedTypeLabel,
  typePicked,
  listingSideContextLabel,
  typeSummaryDescription,
  requiredDone,
  requiredTotal,
  imagesCount,
  documentsCount,
  promotionEnabled,
  promotionRequiredDone,
  promotionRequiredTotal,
  publishBlockersCount,
  publishReadyCount,
  publishReadinessTotal,
  supportsSimpleMode,
  listingMode,
  onListingModeChange,
  hideModeSwitch = false,
  canChangeTypeBeforeDraft,
  onChangeType,
  typeSelectionLocked,
}: CreatePageHeaderProps) {
  const isId = locale === 'id';
  const isCompact = uiVariant === 'compact';
  const isQuickMode = supportsSimpleMode && listingMode === 'simple';
  const stepProgress = Math.round((currentStep / totalSteps) * 100);
  const steps = Array.from({ length: totalSteps }, (_, index) => index + 1);
  const showModeSwitch = supportsSimpleMode && !hideModeSwitch;
  const readinessLabel =
    publishBlockersCount > 0
      ? isId
        ? `${publishBlockersCount} perlu dicek`
        : `${publishBlockersCount} blockers`
      : isId
        ? 'Siap lanjut'
        : 'Ready';
  const compactSummary = typePicked
    ? `${selectedTypeLabel} / ${listingSideContextLabel}`
    : typeSummaryDescription;
  const statusLabel =
    contentStatus === 'active' ? (isId ? 'Sudah tayang' : 'Live') : 'Draft';
  const progressText = isId
    ? `${requiredDone}/${Math.max(requiredTotal, 1)} info utama`
    : `${requiredDone}/${Math.max(requiredTotal, 1)} core fields`;
  const mediaText = isId
    ? `${imagesCount} foto, ${documentsCount} dokumen`
    : `${imagesCount} photos, ${documentsCount} documents`;
  const promoText = promotionEnabled
    ? `${promotionRequiredDone}/${Math.max(promotionRequiredTotal, 1)} promo`
    : isId
      ? 'Promo dilewati'
      : 'Promo skipped';
  const activeStepLabel =
    stepLabels[currentStep - 1] || (isId ? 'Langkah aktif' : 'Active step');
  const statusToneClass =
    contentStatus === 'active'
      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
      : 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]';

  return (
    <div
      data-section-shell-hero="true"
      className="min-w-0 rounded-[18px] border border-[color:var(--app-border)] bg-white p-3 shadow-[0_18px_38px_-36px_rgba(15,23,42,0.18)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:p-4"
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {typePicked ? (
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55">
              <ActiveTypeIcon className="h-4 w-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
              {typePicked ? compactSummary : formEyebrow}
            </p>
            <h1 className="mt-0.5 truncate text-[1.08rem] font-black leading-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.32rem]">
              {formTitle}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          <span
            className={`inline-flex min-h-[30px] items-center rounded-full border px-2.5 text-[10px] font-black ${statusToneClass}`}
          >
            {statusLabel}
          </span>
          <span
            className={`inline-flex min-h-[30px] items-center gap-1 rounded-full border px-2.5 text-[10px] font-black ${
              publishBlockersCount > 0
                ? 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]'
                : 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
            }`}
          >
            {publishBlockersCount > 0 ? (
              <AlertTriangle className="h-3.5 w-3.5" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5" />
            )}
            {publishBlockersCount > 0
              ? isId
                ? `${publishBlockersCount} cek`
                : `${publishBlockersCount} check`
              : readinessLabel}
          </span>
        </div>
      </div>

      <p className="mt-2 line-clamp-1 text-[11px] leading-4 text-[color:var(--app-text-soft)] sm:text-[12px]">
        {isQuickMode
          ? isId
            ? 'Mode cepat: isi inti dulu, detail bisa diedit nanti.'
            : 'Quick mode: fill the essentials first, edit details later.'
          : formSubtitle}
      </p>

      <div className="mt-3 rounded-[14px] bg-[color:var(--app-surface-muted)] p-2 dark:bg-slate-950/45">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <p className="min-w-0 truncate text-[12px] font-black text-[color:var(--app-text)]">
            {currentStep}/{totalSteps} {activeStepLabel}
          </p>
          <span className="shrink-0 text-[10px] font-bold text-[color:var(--app-text-soft)]">
            {stepProgress}%
          </span>
        </div>

        <div className="mt-2 grid grid-cols-4 gap-1.5">
          {steps.map(step => {
            const active = currentStep === step;
            const done = currentStep > step;
            const clickable = step < currentStep;
            const label = stepLabels[step - 1] || `Step ${step}`;

            return (
              <button
                key={step}
                type="button"
                aria-label={label}
                disabled={!clickable && !active}
                onClick={() => {
                  if (clickable) onStepSelect(step);
                }}
                className={`min-w-0 rounded-full border px-2 py-1.5 text-center text-[10px] font-black transition ${
                  active
                    ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                    : done
                      ? 'border-[color:var(--app-accent-border)] bg-white text-[color:var(--app-accent)] dark:bg-slate-950/70'
                      : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] dark:bg-slate-950/55'
                } ${clickable ? 'hover:border-[color:var(--app-accent)]' : 'cursor-default'}`}
              >
                <span className="inline-flex items-center justify-center gap-1">
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
                  <span className="hidden truncate min-[420px]:inline">
                    {label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 grid grid-cols-4 gap-1.5" aria-hidden="true">
          {steps.map(step => {
            const active = currentStep === step;
            const done = currentStep > step;
            return (
              <div
                key={`meter-${step}`}
                className={`h-2 rounded-full transition ${
                  active
                    ? 'bg-[color:var(--app-accent)] shadow-[0_8px_18px_-12px_color-mix(in_srgb,var(--app-accent)_70%,transparent)]'
                    : done
                      ? 'bg-[color:color-mix(in_srgb,var(--app-accent)_70%,white_30%)]'
                      : 'bg-white/80 ring-1 ring-[color:var(--app-border)] dark:bg-slate-900'
                }`}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5">
          {showModeSwitch ? (
            <div className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-0.5 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55">
              <button
                type="button"
                onClick={() => onListingModeChange('simple')}
                className={`rounded-full px-3 py-1.5 text-[10px] font-black transition ${
                  listingMode === 'simple'
                    ? 'bg-[color:var(--app-accent)] text-white'
                    : 'text-[color:var(--app-text)]'
                }`}
              >
                {isId ? 'Cepat' : 'Quick'}
              </button>
              <button
                type="button"
                onClick={() => onListingModeChange('detail')}
                className={`rounded-full px-3 py-1.5 text-[10px] font-black transition ${
                  listingMode === 'detail'
                    ? 'bg-[color:var(--app-accent)] text-white'
                    : 'text-[color:var(--app-text)]'
                }`}
              >
                {isId ? 'Detail' : 'Detail'}
              </button>
            </div>
          ) : null}

          {canChangeTypeBeforeDraft ? (
            <button
              type="button"
              onClick={onChangeType}
              className="inline-flex min-h-[32px] items-center rounded-full border border-[color:var(--app-border)] bg-white px-3 text-[10px] font-black text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55"
            >
              {isId ? 'Ganti tipe' : 'Change category'}
            </button>
          ) : null}
        </div>

        <details className="group relative">
          <summary className="inline-flex min-h-[32px] cursor-pointer list-none items-center rounded-full bg-[color:var(--app-surface-muted)] px-3 text-[10px] font-black text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)] dark:bg-slate-950/55 dark:ring-[color:var(--app-border-strong)] [&::-webkit-details-marker]:hidden">
            {isId ? 'Detail status' : 'Status details'}
          </summary>
          <div className="absolute right-0 z-30 mt-2 w-[min(88vw,280px)] rounded-[16px] border border-[color:var(--app-border)] bg-white p-3 text-[11px] font-semibold text-[color:var(--app-text-soft)] shadow-[0_18px_42px_-28px_rgba(15,23,42,0.28)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950">
            <div className="grid gap-2">
              <span>{progressText}</span>
              <span>{mediaText}</span>
              {!isCompact ? <span>{promoText}</span> : null}
              <span>
                {publishReadyCount}/{Math.max(publishReadinessTotal, 1)}{' '}
                {isId ? 'siap' : 'ready'}
              </span>
            </div>
          </div>
        </details>
      </div>

      {typeSelectionLocked ? (
        <p className="mt-2 text-[11px] text-[color:var(--app-warning)]">
          {isId
            ? 'Kalau sudah tayang, tipenya tidak bisa diganti.'
            : 'Category locks after publish.'}
        </p>
      ) : null}
    </div>
  );
}
