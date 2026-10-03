'use client';

import type { RefObject } from 'react';
import { cn } from '@/lib/utils';

export function normalizeCommunityBody(body: string): {
  body: string;
  hashtags: string[];
} {
  const normalized = String(body || '')
    .replace(/\\r?\\n/g, '\n')
    .replace(/\r\n?/g, '\n')
    .replace(/[\t ]+$/gm, '')
    .trim();

  if (!normalized) return { body: '', hashtags: [] };

  const tagLinePattern =
    /^\s*#[\p{L}\p{N}_-]+(?:\s+#[\p{L}\p{N}_-]+)*\s*$/u;
  const lines = normalized.split('\n');
  const hashtags: string[] = [];

  while (lines.length > 0 && tagLinePattern.test(lines[lines.length - 1])) {
    const tagLine = lines.pop() || '';
    for (const tag of tagLine.match(/#[\p{L}\p{N}_-]+/gu) || []) {
      const normalizedTag = tag.slice(1).trim();
      if (normalizedTag) hashtags.push(normalizedTag);
    }
  }

  return {
    body: lines.join('\n').trim(),
    hashtags: [...new Set(hashtags)],
  };
}

export function CommunityFormattedBody({
  body,
  collapsed = false,
  bodyRef,
}: {
  body: string;
  collapsed?: boolean;
  bodyRef?: RefObject<HTMLDivElement | null>;
}) {
  const normalized = String(body || '')
    .replace(/\r\n?/g, '\n')
    .trim();

  if (!normalized) return null;

  const paragraphs = normalized.split(/\n{2,}/);

  return (
    <div
      ref={bodyRef}
      className={cn(
        'space-y-2 break-words text-sm leading-6 text-[color:var(--app-text)]',
        collapsed
          ? 'max-h-[8.75rem] overflow-hidden [mask-image:linear-gradient(to_bottom,black_82%,transparent_100%)] sm:max-h-[9.5rem]'
          : 'max-h-none',
      )}
    >
      {paragraphs.map((paragraph, index) => (
        <p key={index} className="m-0 whitespace-pre-line">
          {paragraph}
        </p>
      ))}
    </div>
  );
}
