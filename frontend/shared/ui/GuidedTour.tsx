'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { cn } from '../utils/cn';

export type TourStep = {
  id: string;
  title: string;
  description?: string;
  target?: string | string[];
  placement?: 'auto' | 'top' | 'bottom' | 'left' | 'right';
  padding?: number;
};

type GuidedTourProps = {
  steps: TourStep[];
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  onSkip?: () => void;
  onFinish?: () => void;
  className?: string;
};

type Placement = 'top' | 'bottom' | 'left' | 'right';

function resolveTarget(step: TourStep): HTMLElement | null {
  const selectors = Array.isArray(step.target)
    ? step.target
    : step.target
    ? [step.target]
    : [];

  for (const selector of selectors) {
    const el = document.querySelector(selector);
    if (el instanceof HTMLElement) return el;
  }

  return null;
}

function pickPlacement(
  placement: TourStep['placement'],
  targetRect: DOMRect,
  panelRect: DOMRect,
  spacing: number,
): Placement {
  if (placement && placement !== 'auto') return placement;

  const spaceBottom = window.innerHeight - targetRect.bottom;
  const spaceTop = targetRect.top;
  const spaceRight = window.innerWidth - targetRect.right;
  const spaceLeft = targetRect.left;

  if (spaceBottom >= panelRect.height + spacing) return 'bottom';
  if (spaceTop >= panelRect.height + spacing) return 'top';
  if (spaceRight >= panelRect.width + spacing) return 'right';
  if (spaceLeft >= panelRect.width + spacing) return 'left';

  return 'bottom';
}

export function GuidedTour({
  steps,
  open,
  onOpenChange,
  onSkip,
  onFinish,
  className,
}: GuidedTourProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties | null>(null);
  const panelRef = useRef<HTMLDivElement | null>(null);

  const step = useMemo(() => steps[activeIndex], [steps, activeIndex]);

  useEffect(() => {
    if (open) {
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    if (!open) return;

    const update = () => {
      const currentStep = steps[activeIndex];
      if (!currentStep) return;

      const el = resolveTarget(currentStep);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      }

      const rect = el?.getBoundingClientRect() ?? null;
      setTargetRect(rect);

      requestAnimationFrame(() => {
        const panel = panelRef.current;
        if (!panel) return;

        const panelRect = panel.getBoundingClientRect();
        const spacing = 16;
        const margin = 16;

        if (!rect) {
          const top = Math.max(margin, (window.innerHeight - panelRect.height) / 2);
          const left = Math.max(margin, (window.innerWidth - panelRect.width) / 2);
          setPanelStyle({ top, left });
          return;
        }

        const placement = pickPlacement(currentStep.placement, rect, panelRect, spacing);
        let top = rect.bottom + spacing;
        let left = rect.left + rect.width / 2 - panelRect.width / 2;

        if (placement === 'top') {
          top = rect.top - panelRect.height - spacing;
        }
        if (placement === 'left') {
          top = rect.top + rect.height / 2 - panelRect.height / 2;
          left = rect.left - panelRect.width - spacing;
        }
        if (placement === 'right') {
          top = rect.top + rect.height / 2 - panelRect.height / 2;
          left = rect.right + spacing;
        }

        const clampedTop = Math.min(
          Math.max(top, margin),
          window.innerHeight - panelRect.height - margin,
        );
        const clampedLeft = Math.min(
          Math.max(left, margin),
          window.innerWidth - panelRect.width - margin,
        );

        setPanelStyle({ top: clampedTop, left: clampedLeft });
      });
    };

    update();

    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);

    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [open, activeIndex, steps]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onSkip?.();
        onOpenChange?.(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onSkip, onOpenChange]);

  if (!open || steps.length === 0 || !step) return null;

  const isLast = activeIndex === steps.length - 1;
  const padding = step.padding ?? 8;
  const highlightStyle: React.CSSProperties | null = targetRect
    ? {
        top: Math.max(0, targetRect.top - padding),
        left: Math.max(0, targetRect.left - padding),
        width: Math.max(0, targetRect.width + padding * 2),
        height: Math.max(0, targetRect.height + padding * 2),
      }
    : null;

  return (
    <div className={cn('fixed inset-0 z-[1000]', className)} aria-live="polite">
      <div
        className={cn(
          'absolute inset-0',
          highlightStyle ? 'bg-transparent' : 'bg-[color:color-mix(in_srgb,_var(--color-surface)_50%,_transparent)]',
        )}
      />
      {highlightStyle ? (
        <div
          className="pointer-events-none absolute rounded-2xl border border-[color:color-mix(in_srgb,_var(--color-primary-border)_70%,_transparent)] bg-transparent shadow-[0_0_0_9999px_rgba(15,23,42,0.5)] transition-all duration-200"
          style={highlightStyle}
        />
      ) : null}

      <div
        ref={panelRef}
        className="absolute max-w-sm rounded-2xl border border-[color:color-mix(in_srgb,_var(--color-border)_70%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_95%,_transparent)] p-4 text-[color:var(--color-text)] shadow-2xl backdrop-blur dark:border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] dark:bg-[color:color-mix(in_srgb,_var(--color-surface)_95%,_transparent)] dark:text-[color:var(--color-text-soft)]"
        style={panelStyle || { top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-[color:var(--color-primary)]">
              Step {activeIndex + 1} of {steps.length}
            </p>
            <h3 className="mt-1 text-base font-semibold">{step.title}</h3>
          </div>
          <button
            type="button"
            onClick={() => {
              onSkip?.();
              onOpenChange?.(false);
            }}
            className="rounded-full border border-[color:var(--color-border)] px-2 py-1 text-[10px] font-semibold uppercase text-[color:var(--color-text)] transition hover:border-[color:var(--color-border)] hover:text-[color:var(--color-text)] dark:border-[color:var(--color-border)] dark:text-[color:var(--color-text-soft)] dark:hover:text-[color:var(--color-text-soft)]"
          >
            Skip
          </button>
        </div>
        {step.description ? (
          <p className="mt-2 text-sm text-[color:var(--color-text)] dark:text-[color:var(--color-text-soft)]">{step.description}</p>
        ) : null}
        <div className="mt-4 flex items-center justify-between">
          <button
            type="button"
            onClick={() => setActiveIndex((prev) => Math.max(0, prev - 1))}
            className="rounded-full border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-semibold text-[color:var(--color-text)] transition hover:border-[color:var(--color-border)] hover:text-[color:var(--color-text)] disabled:opacity-40 dark:border-[color:var(--color-border)] dark:text-[color:var(--color-text-soft)] dark:hover:text-[color:var(--color-text-inverse)]"
            disabled={activeIndex === 0}
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => {
              if (isLast) {
                onFinish?.();
                onOpenChange?.(false);
                return;
              }
              setActiveIndex((prev) => Math.min(prev + 1, steps.length - 1));
            }}
            className="rounded-full bg-[color:var(--color-primary)] px-4 py-1.5 text-xs font-semibold text-[color:var(--color-text-inverse)] shadow-sm shadow-[var(--color-shadow)] transition hover:bg-[color:var(--color-primary-strong)]"
          >
            {isLast ? 'Selesai' : 'Next'}
          </button>
        </div>
      </div>
    </div>
  );
}