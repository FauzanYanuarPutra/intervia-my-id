'use client';

import { useEffect, useState } from 'react';

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

type CommunityBookmarkState = {
  bookmarked: boolean;
  bookmarkCount: number;
};

const EMPTY_STATE: CommunityBookmarkState = {
  bookmarked: false,
  bookmarkCount: 0,
};

export function useCommunityBookmark(
  authFetch: AuthFetch,
  threadId: string | null | undefined,
  enabled: boolean,
) {
  const [state, setState] = useState<CommunityBookmarkState>(EMPTY_STATE);

  useEffect(() => {
    if (!enabled || !threadId) {
      return;
    }

    let active = true;

    const loadBookmark = async () => {
      try {
        const response = await authFetch(
          `/api/forum/threads/${encodeURIComponent(threadId)}/bookmark`,
          { cache: 'no-store', headers: { Accept: 'application/json' } },
        );
        const payload = (await response.json().catch(() => ({}))) as {
          bookmarked?: unknown;
          bookmarkCount?: unknown;
        };
        if (!active || !response.ok) return;

        const count = Number(payload.bookmarkCount);
        setState({
          bookmarked: Boolean(payload.bookmarked),
          bookmarkCount: Number.isFinite(count) ? Math.max(0, count) : 0,
        });
      } catch {
        // Best effort; a later interaction can retry.
      }
    };

    void loadBookmark();

    return () => {
      active = false;
    };
  }, [authFetch, enabled, threadId]);

  const effectiveState =
    enabled && threadId ? state : EMPTY_STATE;

  return {
    bookmarked: effectiveState.bookmarked,
    bookmarkCount: effectiveState.bookmarkCount,
    setBookmarked: (value: boolean) =>
      setState(current => ({ ...current, bookmarked: value })),
    setBookmarkCount: (value: number | ((current: number) => number)) =>
      setState(current => ({
        ...current,
        bookmarkCount:
          typeof value === 'function'
            ? value(current.bookmarkCount)
            : value,
      })),
  };
}
