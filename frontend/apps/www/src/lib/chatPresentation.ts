export type ChatPresentationLocale = 'id' | 'en';

export type ChatRoomAccessResult = 'allowed' | 'denied' | 'error';

function localeTag(locale: ChatPresentationLocale): 'id-ID' | 'en-US' {
  return locale === 'id' ? 'id-ID' : 'en-US';
}

function sameCalendarDay(left: Date, right: Date): boolean {
  return (
    left.getFullYear() === right.getFullYear() &&
    left.getMonth() === right.getMonth() &&
    left.getDate() === right.getDate()
  );
}

function calendarDayNumber(value: Date): number {
  return Date.UTC(value.getFullYear(), value.getMonth(), value.getDate());
}

export function formatChatMessageTime(
  iso: string,
  locale: ChatPresentationLocale,
  now = new Date(),
): string {
  if (!iso) return '';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';

  const time = value.toLocaleTimeString(localeTag(locale), {
    hour: '2-digit',
    minute: '2-digit',
  });
  if (sameCalendarDay(value, now)) return time;

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (sameCalendarDay(value, yesterday)) {
    return `${locale === 'id' ? 'Kemarin' : 'Yesterday'} ${time}`;
  }

  return value.toLocaleString(localeTag(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatChatDayLabel(
  iso: string,
  locale: ChatPresentationLocale,
  now = new Date(),
): string {
  if (!iso) return '';
  const value = new Date(iso);
  if (Number.isNaN(value.getTime())) return '';

  const diffDays = Math.round(
    (calendarDayNumber(now) - calendarDayNumber(value)) / 86_400_000,
  );
  if (diffDays === 0) return locale === 'id' ? 'Hari ini' : 'Today';
  if (diffDays === 1) return locale === 'id' ? 'Kemarin' : 'Yesterday';

  return value.toLocaleDateString(localeTag(locale), {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function classifyChatRoomAccessResponse(
  status: number,
  ok: boolean,
): ChatRoomAccessResult {
  if (ok) return 'allowed';
  if (status === 403 || status === 404) return 'denied';
  return 'error';
}

export function canUseOfflineChatSnapshot(
  status: number,
  hasCachedInboxRoom: boolean,
): boolean {
  return hasCachedInboxRoom && status >= 500 && status <= 599;
}

export function shouldSubmitChatComposer(input: {
  key: string;
  shiftKey: boolean;
  isComposing: boolean;
  keyCode?: number;
  isCoarsePointer: boolean;
}): boolean {
  return (
    input.key === 'Enter' &&
    !input.shiftKey &&
    !input.isComposing &&
    input.keyCode !== 229 &&
    !input.isCoarsePointer
  );
}

export function reconcileOptimisticChatMessage<T extends { id: string }>(
  messages: T[],
  clientRef: string,
  resolved: T,
): T[] {
  const next: T[] = [];
  let inserted = false;

  for (const message of messages) {
    if (message.id === clientRef || message.id === resolved.id) {
      if (!inserted) {
        next.push(resolved);
        inserted = true;
      }
      continue;
    }
    next.push(message);
  }

  if (!inserted) next.push(resolved);
  return next;
}
