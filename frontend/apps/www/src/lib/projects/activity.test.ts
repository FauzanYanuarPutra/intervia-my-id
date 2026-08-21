import { describe, expect, it } from 'vitest';
import { summarizeProjectActivity } from './activity';

describe('summarizeProjectActivity', () => {
  it('uses only provided project and offer values', () => {
    const summary = summarizeProjectActivity([
      { title: 'Butuh kemasan', statusKey: 'waiting', offerCount: 0 },
      { title: 'Cari mesin', statusKey: 'active', offerCount: 3 },
      { title: 'Jasa foto', statusKey: 'completed', offerCount: 2 },
    ]);

    expect(summary).toEqual({
      totalRequests: 3,
      activeCount: 2,
      waitingCount: 1,
      completedCount: 1,
      totalOffers: 5,
      noOfferCount: 1,
      averageOffers: 1.7,
      completionRate: 33,
      attentionProjectTitle: 'Butuh kemasan',
    });
  });

  it('returns an honest empty summary', () => {
    expect(summarizeProjectActivity([])).toEqual({
      totalRequests: 0,
      activeCount: 0,
      waitingCount: 0,
      completedCount: 0,
      totalOffers: 0,
      noOfferCount: 0,
      averageOffers: 0,
      completionRate: 0,
      attentionProjectTitle: 'Belum ada proyek yang perlu ditinjau',
    });
  });

  it('clamps invalid offer counts instead of inventing activity', () => {
    const summary = summarizeProjectActivity([
      { title: 'Kebutuhan A', statusKey: 'active', offerCount: Number.NaN },
      { title: 'Kebutuhan B', statusKey: 'active', offerCount: -4 },
    ]);

    expect(summary.totalOffers).toBe(0);
    expect(summary.noOfferCount).toBe(2);
  });
});
