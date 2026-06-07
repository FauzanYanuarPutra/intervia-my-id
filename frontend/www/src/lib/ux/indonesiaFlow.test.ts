import { describe, expect, it } from 'vitest';
import {
  CORE_LAJUKAN_FLOWS,
  INDONESIA_BEHAVIOR_INSIGHTS,
  buildLocalizedRoute,
  getConcreteFlowRoutes,
  validateIndonesiaFlowContract,
} from './indonesiaFlow';

describe('Indonesia UX flow contract', () => {
  it('keeps the research-backed behavior signals covered', () => {
    expect(INDONESIA_BEHAVIOR_INSIGHTS.map(item => item.testSignal)).toEqual([
      'mobile-first',
      'visual-first',
      'short-video',
      'trust-first',
      'fast-action',
    ]);

    for (const insight of INDONESIA_BEHAVIOR_INSIGHTS) {
      expect(insight.labelId.length).toBeLessThanOrEqual(32);
      expect(insight.source).toBeTruthy();
    }
  });

  it('keeps the full Lajukan journey explicit and maintainable', () => {
    expect(validateIndonesiaFlowContract()).toEqual([]);
    expect(CORE_LAJUKAN_FLOWS.map(flow => flow.id)).toEqual([
      'home-to-search-marketplace',
      'home-to-community',
      'home-to-reels-commerce',
      'home-to-create-listing',
      'home-to-umkm',
      'home-to-profile-trust',
    ]);
  });

  it('prioritizes mobile-critical checkpoints for Indonesian users', () => {
    const criticalSteps = CORE_LAJUKAN_FLOWS.flatMap(flow =>
      flow.steps.filter(step => step.mobilePriority === 'critical'),
    );

    expect(criticalSteps.length).toBeGreaterThanOrEqual(CORE_LAJUKAN_FLOWS.length);
    expect(criticalSteps.some(step => step.expectedSignals.includes('no-horizontal-overflow'))).toBe(true);
    expect(criticalSteps.some(step => step.expectedSignals.includes('modal-above-chrome'))).toBe(true);
    expect(criticalSteps.some(step => step.expectedSignals.includes('back-home'))).toBe(true);
  });

  it('builds localized concrete routes for E2E smoke coverage', () => {
    const routes = getConcreteFlowRoutes();

    expect(routes).toContain('/home');
    expect(routes).toContain('/community?compose=post');
    expect(routes).toContain('/reels');
    expect(routes).toContain('/umkm');
    expect(routes).toContain('/usaha');
    expect(routes.every(route => !route.includes(':'))).toBe(true);
    expect(buildLocalizedRoute('/search?q=supplier%20kemasan', 'id')).toBe(
      '/id/search?q=supplier%20kemasan',
    );
  });
});
