export type ListingReportReason =
  | 'spam'
  | 'fake'
  | 'scam'
  | 'harassment'
  | 'illegal'
  | 'inaccurate'
  | 'other';

export type ListingReportRecord = {
  id: string;
  reporter_id?: string | null;
  reporter_name?: string | null;
  reporter_email?: string | null;
  reason: ListingReportReason;
  details?: string | null;
  created_at: string;
};

export type ListingModerationState =
  | 'clean'
  | 'flagged'
  | 'under_review'
  | 'restricted'
  | 'banned';

export type ListingModerationAction = {
  id: string;
  actor_id?: string | null;
  action: 'warn' | 'flag' | 'restrict' | 'ban' | 'unban' | 'note';
  note?: string | null;
  created_at: string;
};

export type ListingModerationSnapshot = {
  state: ListingModerationState;
  strike_count: number;
  report_count: number;
  last_report_at: string | null;
  last_action_at: string | null;
  note?: string | null;
  actions: ListingModerationAction[];
};

export function normalizeListingReportReason(value: unknown): ListingReportReason {
  const reason = String(value || '').trim().toLowerCase();
  if (reason === 'spam') return 'spam';
  if (reason === 'fake') return 'fake';
  if (reason === 'scam') return 'scam';
  if (reason === 'harassment') return 'harassment';
  if (reason === 'illegal') return 'illegal';
  if (reason === 'inaccurate') return 'inaccurate';
  return 'other';
}

export function normalizeListingModerationState(value: unknown): ListingModerationState {
  const state = String(value || '').trim().toLowerCase();
  if (state === 'flagged') return 'flagged';
  if (state === 'under_review') return 'under_review';
  if (state === 'restricted') return 'restricted';
  if (state === 'banned') return 'banned';
  return 'clean';
}

export function summarizeListingModeration(
  reports: ListingReportRecord[],
  actions: ListingModerationAction[],
  fallbackState?: unknown,
): ListingModerationSnapshot {
  const reportCount = reports.length;
  const strikeCount = reports.filter(report =>
    ['scam', 'illegal', 'harassment'].includes(report.reason),
  ).length;
  const lastReportAt = reports[0]?.created_at || null;
  const lastActionAt = actions[0]?.created_at || null;
  const derivedState =
    reportCount >= 6 || strikeCount >= 3
      ? 'banned'
      : reportCount >= 4 || strikeCount >= 2
        ? 'restricted'
        : reportCount >= 2
          ? 'under_review'
          : reportCount >= 1
            ? 'flagged'
            : 'clean';
  return {
    state: normalizeListingModerationState(fallbackState) || derivedState,
    strike_count: strikeCount,
    report_count: reportCount,
    last_report_at: lastReportAt,
    last_action_at: lastActionAt,
    note:
      reportCount === 0
        ? 'No report'
        : derivedState === 'flagged'
          ? 'Monitor and verify details'
          : derivedState === 'under_review'
            ? 'Assign reviewer and inspect evidence'
            : derivedState === 'restricted'
              ? 'Limit exposure until verification is done'
              : 'Escalate and consider ban review',
    actions,
  };
}

export function getModerationNextStep(snapshot: ListingModerationSnapshot): string {
  if (snapshot.state === 'clean') return 'No action needed';
  if (snapshot.state === 'flagged') return 'Review the reports and compare evidence';
  if (snapshot.state === 'under_review') return 'Assign an agent and verify the listing';
  if (snapshot.state === 'restricted') return 'Restrict visibility until the review is complete';
  return 'Ban review recommended due to repeated abuse';
}
