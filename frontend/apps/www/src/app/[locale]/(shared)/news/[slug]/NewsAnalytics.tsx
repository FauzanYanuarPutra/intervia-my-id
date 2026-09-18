'use client';

import { useEffect } from 'react';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';

type Props = {
  articleId: string;
  slug: string;
  category: string;
};

const READ_MILESTONES = [25, 50, 75, 100] as const;

function acquisitionProperties() {
  const params = new URLSearchParams(window.location.search);
  let referrerDomain: string | undefined;
  try {
    if (document.referrer) {
      const referrer = new URL(document.referrer);
      if (referrer.origin !== window.location.origin) {
        referrerDomain = referrer.hostname.replace(/^www\./, '').slice(0, 120);
      }
    }
  } catch {
    referrerDomain = undefined;
  }
  const readParam = (name: string) => {
    const value = params.get(name)?.trim();
    return value ? value.slice(0, 120) : undefined;
  };
  return {
    referrer_domain: referrerDomain,
    utm_source: readParam('utm_source'),
    utm_medium: readParam('utm_medium'),
    utm_campaign: readParam('utm_campaign'),
  };
}

function destinationProperties(anchor: HTMLAnchorElement) {
  try {
    const url = new URL(anchor.href, window.location.origin);
    if (url.origin === window.location.origin) {
      return { destination_path: url.pathname };
    }
    return { destination_domain: url.hostname.replace(/^www\./, '') };
  } catch {
    return {};
  }
}

export default function NewsAnalytics({ articleId, slug, category }: Props) {
  useEffect(() => {
    const acquisition = acquisitionProperties();
    const base = {
      entityType: 'news',
      entityId: articleId,
      source: 'news_article',
      properties: { slug, category, ...acquisition },
    };

    void trackLajukanEvent('news.opened', base);
    const engagedTimer = window.setTimeout(() => {
      if (document.hidden) return;
      void trackLajukanEvent('news.engaged_30s', {
        ...base,
        properties: { slug, category, engaged_seconds: 30, ...acquisition },
      });
    }, 30_000);

    const seen = new Set<number>();
    let frame = 0;

    const reportReadDepth = () => {
      frame = 0;
      const article = document.getElementById('news-article');
      if (!article) return;
      const rect = article.getBoundingClientRect();
      const articleTop = window.scrollY + rect.top;
      const articleHeight = Math.max(article.scrollHeight, rect.height, 1);
      const viewportBottom = window.scrollY + window.innerHeight;
      const progress = Math.max(
        0,
        Math.min(100, ((viewportBottom - articleTop) / articleHeight) * 100),
      );

      for (const milestone of READ_MILESTONES) {
        if (progress < milestone || seen.has(milestone)) continue;
        seen.add(milestone);
        void trackLajukanEvent(`news.read_${milestone}`, {
          ...base,
          properties: {
            slug,
            category,
            read_depth: milestone,
            ...acquisition,
          },
        });
      }
    };

    const onScroll = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(reportReadDepth);
    };

    const onClick = (event: MouseEvent) => {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const anchor = target.closest<HTMLAnchorElement>('a[data-news-action]');
      if (!anchor) return;
      const action = anchor.dataset.newsAction;
      if (!action) return;
      void trackLajukanEvent(`news.${action}`, {
        ...base,
        properties: {
          slug,
          category,
          ...destinationProperties(anchor),
          ...acquisition,
        },
      });
    };

    window.addEventListener('scroll', onScroll, { passive: true });
    document.addEventListener('click', onClick);
    reportReadDepth();

    return () => {
      window.removeEventListener('scroll', onScroll);
      document.removeEventListener('click', onClick);
      if (frame) window.cancelAnimationFrame(frame);
      window.clearTimeout(engagedTimer);
    };
  }, [articleId, category, slug]);

  return null;
}
