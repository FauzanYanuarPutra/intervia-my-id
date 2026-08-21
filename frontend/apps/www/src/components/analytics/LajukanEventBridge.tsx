'use client';

import { useEffect, useRef } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import { resolveRouteViewEvent } from '@/lib/analytics/eventTaxonomy';

const SCROLL_MILESTONES = [25, 50, 75, 100] as const;

export function LajukanEventBridge() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const sentScrollMilestonesRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    const query = searchParams.toString();
    const page = query ? `${pathname}?${query}` : pathname;
    sentScrollMilestonesRef.current = new Set();

    void trackLajukanEvent('page.viewed', {
      page,
      properties: {
        title: document.title,
      },
    });

    const routeEvent = resolveRouteViewEvent(pathname);
    if (routeEvent) {
      void trackLajukanEvent(routeEvent.eventName, {
        page,
        properties: {
          module: routeEvent.module,
          surface: routeEvent.surface,
          title: document.title,
        },
      });
    }
  }, [pathname, searchParams]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;

      const tracked = target.closest<HTMLElement>('[data-lajukan-event]');
      if (!tracked) return;

      const eventName = tracked.dataset.lajukanEvent;
      if (!eventName) return;

      void trackLajukanEvent(eventName, {
        entityType: tracked.dataset.lajukanEntityType,
        entityId: tracked.dataset.lajukanEntityId,
        properties: {
          surface: tracked.dataset.lajukanSurface,
          label:
            tracked.dataset.lajukanLabel ||
            tracked.getAttribute('aria-label') ||
            tracked.textContent?.trim().slice(0, 120),
          href:
            tracked instanceof HTMLAnchorElement
              ? tracked.getAttribute('href')
              : undefined,
        },
      });
    };

    document.addEventListener('click', onClick, { capture: true });
    return () =>
      document.removeEventListener('click', onClick, { capture: true });
  }, []);

  useEffect(() => {
    const onSubmit = (event: SubmitEvent) => {
      const target = event.target;
      if (!(target instanceof HTMLFormElement)) return;

      const explicitEvent = target.dataset.lajukanEvent;
      const explicitForm = target.dataset.lajukanForm;
      const role = target.getAttribute('role');
      const isSearch =
        role === 'search' || Boolean(target.querySelector('[type="search"]'));

      if (!explicitEvent && !explicitForm && !isSearch) return;

      const eventName =
        explicitEvent || (isSearch ? 'search.submitted' : 'form.submitted');

      void trackLajukanEvent(eventName, {
        properties: {
          form:
            explicitForm || target.getAttribute('aria-label') || role || 'form',
          surface:
            target.dataset.lajukanSurface ||
            target.closest<HTMLElement>('[data-lajukan-surface]')?.dataset
              .lajukanSurface,
          page: pathname,
        },
      });
    };

    document.addEventListener('submit', onSubmit, { capture: true });
    return () =>
      document.removeEventListener('submit', onSubmit, { capture: true });
  }, [pathname]);

  useEffect(() => {
    let ticking = false;

    const onScroll = () => {
      if (ticking) return;
      ticking = true;

      window.requestAnimationFrame(() => {
        ticking = false;

        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollHeight =
          document.documentElement.scrollHeight - window.innerHeight;
        if (scrollHeight <= 0) return;

        const depth = Math.min(
          100,
          Math.round((scrollTop / scrollHeight) * 100),
        );
        const nextMilestone = SCROLL_MILESTONES.find(
          milestone =>
            depth >= milestone &&
            !sentScrollMilestonesRef.current.has(milestone),
        );

        if (!nextMilestone) return;
        sentScrollMilestonesRef.current.add(nextMilestone);

        void trackLajukanEvent('page.scroll_depth', {
          properties: {
            depth: nextMilestone,
          },
        });
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();

    return () => window.removeEventListener('scroll', onScroll);
  }, [pathname, searchParams]);

  return null;
}
