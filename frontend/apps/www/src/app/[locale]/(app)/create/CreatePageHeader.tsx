'use client';

import { AlertTriangle, CheckCircle2, type LucideIcon } from 'lucide-react';
import { useHorizontalDragScroll } from '@/hooks/useHorizontalDragScroll';

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
  minimal?: boolean;
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
  minimal = false,
  canChangeTypeBeforeDraft,
  onChangeType,
  typeSelectionLocked,
}: CreatePageHeaderProps) {
  const isId = locale === 'id';
  const isCompact = uiVariant === 'compact';
  const isMinimal = minimal;
  const isQuickMode = supportsSimpleMode && listingMode === 'simple';
  const {
    ref: stepRailRef,
    onClickCapture,
    onPointerCancel,
    onPointerDown,
    onPointerLeave,
    onPointerMove,
    onPointerUp,
    onWheel,
  } = useHorizontalDragScroll<HTMLDivElement>();
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
      className={`min-w-0 rounded-[16px] border border-[color:var(--app-border)] bg-white shadow-[0_14px_30px_-28px_rgba(15,23,42,0.18)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] ${isMinimal ? 'p-2 sm:p-2.5' : 'p-2.5 sm:p-3'
        }`}
    >
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2">
          {typePicked ? (
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55">
              <ActiveTypeIcon className="h-4 w-4" />
            </span>
          ) : null}
          <div className="min-w-0">
            <p className="truncate text-[10px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
              {typePicked ? compactSummary : formEyebrow}
            </p>
            <h1 className="truncate text-[1.02rem] font-bold leading-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.2rem]">
              {formTitle}
            </h1>
          </div>
        </div>

        <div className="flex shrink-0 items-center gap-1.5">
          {isMinimal ? (
            <span className="inline-flex min-h-[26px] items-center rounded-full bg-[color:var(--app-surface-muted)] px-2 text-[10px] font-bold text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)] dark:bg-slate-950/55 dark:ring-[color:var(--app-border-strong)]">
              {currentStep}/{totalSteps}
            </span>
          ) : null}
          <span
            className={`inline-flex min-h-[26px] items-center rounded-full border px-2 text-[10px] font-bold ${statusToneClass}`}
          >
            {statusLabel}
          </span>
          {!isMinimal ? (
            <span
              className={`inline-flex min-h-[26px] items-center gap-1 rounded-full border px-2 text-[10px] font-bold ${publishBlockersCount > 0
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
          ) : null}
        </div>
      </div>

      {isMinimal ? (
        <div className="relative mt-2 h-1 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)] dark:bg-slate-950/55">
          <div
            className="absolute top-0 left-0 h-full rounded-full bg-[color:var(--app-accent)] transition-all"
            style={{ width: `${stepProgress}%` }}
          />
        </div>
      ) : (
        <div className="mt-2 flex min-w-0 items-center gap-2 rounded-[12px] bg-[color:var(--app-surface-muted)] px-2 py-1.5 dark:bg-slate-950/45">
          <span className="inline-flex h-7 min-w-9 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-2 text-[10px] font-bold text-white">
            {currentStep}/{totalSteps}
          </span>
          <div className="min-w-0 flex-1">
            <div className="flex min-w-0 items-center justify-between gap-2">
              <p className="min-w-0 truncate text-[11px] font-bold text-[color:var(--app-text)]">
                {activeStepLabel}
              </p>
              <span className="shrink-0 text-[10px] font-bold text-[color:var(--app-text-soft)]">
                {stepProgress}%
              </span>
            </div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-white/90 ring-1 ring-[color:var(--app-border)] dark:bg-slate-900 dark:ring-[color:var(--app-border-strong)]">
              <div
                className="h-full rounded-full bg-[color:var(--app-accent)] transition-all"
                style={{ width: `${stepProgress}%` }}
              />
            </div>
          </div>
        </div>
      )}

      {!isMinimal ? (
        <div
          ref={stepRailRef}
          onClickCapture={onClickCapture}
          onPointerCancel={onPointerCancel}
          onPointerDown={onPointerDown}
          onPointerLeave={onPointerLeave}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onWheel={onWheel}
          className="mt-2 flex gap-1 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] select-none [&::-webkit-scrollbar]:hidden cursor-grab active:cursor-grabbing"
        >
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
                className={`min-h-[28px] shrink-0 rounded-full border px-2.5 text-center text-[10px] font-bold transition ${active
                  ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                  : done
                    ? 'border-[color:var(--app-accent-border)] bg-white text-[color:var(--app-accent)] dark:bg-slate-950/70'
                    : 'border-[color:var(--app-border)] bg-white text-[color:var(--app-text-soft)] dark:bg-slate-950/55'
                  } ${clickable ? 'hover:border-[color:var(--app-accent)]' : 'cursor-default'}`}
              >
                <span className="inline-flex items-center justify-center gap-1">
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
                  <span className={active ? 'max-w-[8rem] truncate' : 'hidden truncate sm:inline'}>
                    {label}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      {!isMinimal ? (
        <div className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
          <div className="flex flex-wrap items-center gap-1.5">
            {showModeSwitch ? (
              <div className="flex flex-col gap-1">
                <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
                  {isId ? 'Mode isi' : 'Input mode'}
                </span>
                <div className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-0.5 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55">
                  <button
                    type="button"
                    onClick={() => onListingModeChange('simple')}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${listingMode === 'simple'
                      ? 'bg-[color:var(--app-accent)] text-white'
                      : 'text-[color:var(--app-text)]'
                      }`}
                  >
                    {isId ? 'Cepat' : 'Quick'}
                  </button>
                  <button
                    type="button"
                    onClick={() => onListingModeChange('detail')}
                    className={`rounded-full px-2.5 py-1 text-[10px] font-bold transition ${listingMode === 'detail'
                      ? 'bg-[color:var(--app-accent)] text-white'
                      : 'text-[color:var(--app-text)]'
                      }`}
                  >
                    {isId ? 'Lengkap' : 'Full'}
                  </button>
                </div>
              </div>
            ) : null}

            {canChangeTypeBeforeDraft ? (
              <button
                type="button"
                onClick={onChangeType}
                className="inline-flex min-h-[28px] items-center rounded-full border border-[color:var(--app-border)] bg-white px-2.5 text-[10px] font-bold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55"
              >
                {isId ? 'Tipe' : 'Category'}
              </button>
            ) : null}
          </div>

          <details className="group relative">
            <summary className="inline-flex min-h-[28px] cursor-pointer list-none items-center rounded-full bg-[color:var(--app-surface-muted)] px-2.5 text-[10px] font-bold text-[color:var(--app-text-soft)] ring-1 ring-[color:var(--app-border)] dark:bg-slate-950/55 dark:ring-[color:var(--app-border-strong)] [&::-webkit-details-marker]:hidden">
              {isId ? 'Status' : 'Status'}
            </summary>
            <div className="absolute right-0 z-30 mt-2 w-[min(88vw,280px)] rounded-[16px] border border-[color:var(--app-border)] bg-white p-3 text-[11px] font-semibold text-[color:var(--app-text-soft)] shadow-[0_18px_42px_-28px_rgba(15,23,42,0.28)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950">
              <div className="grid gap-2">
                <span>
                  {isQuickMode
                    ? isId
                      ? 'Mode ringkas: isi inti dulu, detail bisa ditambah nanti.'
                      : 'Compact mode: fill the core info first, add detail later.'
                    : formSubtitle}
                </span>
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
      ) : null}

      {!isMinimal && typeSelectionLocked ? (
        <p className="mt-2 text-[11px] text-[color:var(--app-warning)]">
          {isId
            ? 'Kalau sudah tayang, tipenya tidak bisa diganti.'
            : 'Category locks after publish.'}
        </p>
      ) : null}
    </div>
  );
}
