export const TRUST_REPORT_REASONS = [
  'spam',
  'scam',
  'harassment',
  'hate',
  'sexual',
  'violence',
  'illegal',
  'privacy',
  'other',
] as const;

export type TrustReportReason = (typeof TRUST_REPORT_REASONS)[number];
export type TrustReportTarget = 'reel' | 'thread';

type AuthFetch = (url: string, options?: RequestInit) => Promise<Response>;

export type TrustReportReceipt = {
  reportId: string;
  status: string;
  message: string;
};

function trustReportPath(target: TrustReportTarget, targetId: string): string {
  const id = encodeURIComponent(targetId.trim());
  return target === 'reel'
    ? `/api/reels/${id}/report`
    : `/api/community/threads/${id}/report`;
}

async function readRequestError(response: Response): Promise<string> {
  const payload = (await response.json().catch(() => ({}))) as {
    error?: unknown;
    message?: unknown;
  };
  const message = [payload.error, payload.message].find(
    value => typeof value === 'string' && value.trim(),
  );
  return typeof message === 'string'
    ? message
    : `Request failed (${response.status})`;
}

export async function submitTrustReport(
  authFetch: AuthFetch,
  target: TrustReportTarget,
  targetId: string,
  input: { reason: TrustReportReason; details?: string },
): Promise<TrustReportReceipt> {
  const response = await authFetch(trustReportPath(target, targetId), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      reason: input.reason,
      details: input.details?.trim() || undefined,
    }),
  });
  if (!response.ok) throw new Error(await readRequestError(response));

  const payload = (await response.json().catch(() => ({}))) as {
    reportId?: unknown;
    status?: unknown;
    message?: unknown;
  };
  const reportId = String(payload.reportId || '').trim();
  if (!reportId) throw new Error('Report receipt is missing');
  return {
    reportId,
    status: String(payload.status || 'open'),
    message: String(payload.message || 'Report received'),
  };
}

export async function markReelNotInterested(
  authFetch: AuthFetch,
  reelId: string,
): Promise<void> {
  const response = await authFetch(
    `/api/reels/${encodeURIComponent(reelId.trim())}/actions`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'not_interested', active: true }),
    },
  );
  if (!response.ok) throw new Error(await readRequestError(response));
}

export async function setCommunityUserBlocked(
  authFetch: AuthFetch,
  userId: string,
  active = true,
): Promise<void> {
  const response = await authFetch(
    `/api/community/users/${encodeURIComponent(userId.trim())}/block`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ active }),
    },
  );
  if (!response.ok) throw new Error(await readRequestError(response));
}

export function isSameCommunityUser(
  left: string | null | undefined,
  right: string | null | undefined,
): boolean {
  const normalize = (value: string | null | undefined) =>
    String(value || '')
      .trim()
      .replace(/^auth-/i, '')
      .toLowerCase();
  const a = normalize(left);
  const b = normalize(right);
  return Boolean(a && b && a === b);
}

