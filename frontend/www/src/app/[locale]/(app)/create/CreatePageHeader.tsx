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
  typeThemeBadgeClass,
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
  const showModeSwitch = supportsSimpleMode && !hideModeSwitch;
  const readinessLabel =
    publishBlockersCount > 0
      ? isId
        ? `${publishBlockersCount} yang perlu dicek`
        : `${publishBlockersCount} blockers`
      : isId
        ? 'Siap lanjut'
        : 'Ready';
  const compactSummary = typePicked
    ? `${selectedTypeLabel} • ${listingSideContextLabel}`
    : typeSummaryDescription;

  return (
    <div
      data-section-shell-hero="true"
      className="ui-feed-section ui-section-shell relative min-w-0 overflow-hidden rounded-none border-x-0 border-y border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 py-3 shadow-none dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:rounded-[22px] sm:border sm:px-4 sm:py-3.5 sm:shadow-[0_18px_34px_-32px_rgba(15,23,42,0.14)]"
    >
      <div aria-hidden="true" className="pointer-events-none absolute inset-0">
        <div className="absolute left-[-2rem] top-[-2rem] h-24 w-24 rounded-full bg-[radial-gradient(circle_at_center,rgba(14,165,233,0.1),transparent_72%)] blur-3xl" />
      </div>

      <div className="relative">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="max-w-2xl">
            <p className="inline-flex rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[9px] font-semibold uppercase tracking-[0.14em] text-slate-600 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
              {formEyebrow}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <h1 className="text-[1.12rem] font-black leading-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-[1.28rem]">
                {formTitle}
              </h1>
              <span
                className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold ${
                  contentStatus === 'active'
                    ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                    : 'border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-warning)]'
                }`}
              >
                {contentStatus === 'active'
                  ? isId
                    ? 'Udah tayang'
                    : 'Live'
                  : isId
                    ? 'Draft'
                    : 'Draft'}
              </span>
            </div>
            <p className="mt-1.5 max-w-xl text-[10px] leading-4 text-[color:var(--app-text-soft)] sm:text-[11px]">
              {formSubtitle}
            </p>
            {compactSummary ? (
              <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                {compactSummary}
              </p>
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {typePicked ? (
              <span className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-1 text-[10px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55 dark:text-[color:var(--app-text-inverse)]">
                <ActiveTypeIcon className="h-3.5 w-3.5" />
                {selectedTypeLabel}
              </span>
            ) : null}

            {typePicked ? (
              <span
                className={`inline-flex min-h-[32px] items-center rounded-full border px-3 py-1 text-[10px] font-semibold ${typeThemeBadgeClass}`}
              >
                {listingSideContextLabel}
              </span>
            ) : null}

            <span className="inline-flex min-h-[32px] items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[10px] font-semibold text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-200">
              {isId
                ? `Langkah ${currentStep} dari ${totalSteps}`
                : `Step ${currentStep} of ${totalSteps}`}{' '}
              | {stepProgress}%
            </span>

            {publishBlockersCount > 0 ? (
              <span className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3 py-1 text-[10px] font-semibold text-[color:var(--app-warning)]">
                <AlertTriangle className="h-3.5 w-3.5" />
                {readinessLabel}
              </span>
            ) : (
              <span className="inline-flex min-h-[32px] items-center gap-2 rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-[10px] font-semibold text-[color:var(--app-accent)]">
                <CheckCircle2 className="h-3.5 w-3.5" />
                {readinessLabel}
              </span>
            )}
          </div>
        </div>

        <div className="mt-3 h-2 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)] dark:bg-slate-900/70">
          <div
            className="h-full rounded-full bg-[linear-gradient(90deg,var(--app-accent),var(--app-accent-strong))] transition-[width] duration-300"
            style={{ width: `${stepProgress}%` }}
          />
        </div>

        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {Array.from({ length: totalSteps }).map((_, idx) => {
            const step = idx + 1;
            const active = currentStep === step;
            const done = currentStep > step;
            const clickable = step < currentStep;
            const label = stepLabels[step - 1] || `Step ${step}`;

            return (
              <button
                key={step}
                type="button"
                disabled={!clickable && !active}
                onClick={() => {
                  if (clickable) onStepSelect(step);
                }}
                className={`inline-flex min-h-[34px] shrink-0 items-center gap-2 rounded-full border px-3 text-[10px] font-semibold transition ${
                  active
                    ? 'border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] text-[color:var(--app-info)]'
                    : done
                      ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'border-slate-200 bg-white text-[color:var(--app-text-soft)] dark:border-slate-800 dark:bg-slate-950/60'
                } ${clickable ? 'hover:-translate-y-0.5' : 'cursor-default'}`}
              >
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-full border border-current/10 bg-white/80 text-[10px] font-bold dark:bg-slate-950/60">
                  {done ? <CheckCircle2 className="h-3.5 w-3.5" /> : step}
                </span>
                <span>{label}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            {showModeSwitch ? (
              <div className="inline-flex rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-1 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55">
                <button
                  type="button"
                  onClick={() => onListingModeChange('simple')}
                  className={`rounded-[10px] px-3 py-1.5 text-[10px] font-semibold transition ${
                    listingMode === 'simple'
                      ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'text-[color:var(--app-text)]'
                  }`}
                >
                  {isId ? 'Cepat' : 'Quick'}
                </button>
                <button
                  type="button"
                  onClick={() => onListingModeChange('detail')}
                  className={`rounded-[10px] px-3 py-1.5 text-[10px] font-semibold transition ${
                    listingMode === 'detail'
                      ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                      : 'text-[color:var(--app-text)]'
                  }`}
                >
                  {isId ? 'Lengkap' : 'Detail'}
                </button>
              </div>
            ) : null}

            {canChangeTypeBeforeDraft ? (
              <button
                type="button"
                onClick={onChangeType}
                className="inline-flex items-center rounded-full border border-[color:var(--app-info-border)] bg-[color:var(--app-info-soft)] px-3 py-1.5 text-[10px] font-semibold text-[color:var(--app-info)]"
              >
                {isId ? 'Ganti tipe' : 'Change category'}
              </button>
            ) : null}
          </div>

          {typeSelectionLocked ? (
            <p className="text-[11px] text-[color:var(--app-warning)]">
              {isId
                ? 'Kalau udah tayang, tipenya nggak bisa diganti.'
                : 'Category locks after publish.'}
            </p>
          ) : !isCompact ? (
            <p className="text-[11px] text-[color:var(--app-text-soft)]">
              {isQuickMode
                ? isId
                  ? 'Mulai dari inti dulu. Detail bisa ditambah nanti.'
                  : 'Start from the core. Details can follow later.'
                : isId
                  ? `${requiredDone}/${Math.max(requiredTotal, 1)} info utama sudah terisi.`
                  : `${requiredDone}/${Math.max(requiredTotal, 1)} core fields filled.`}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
