import { describe, expect, it } from 'vitest';
import {
  INDONESIA_EXPORT_READINESS_STEPS,
  INDONESIA_LOCAL_INDUSTRY_PILLARS,
  LOCAL_FIRST_HOME_LINKS,
} from './localIndustryCatalog';

function expectInternalHref(href: string) {
  expect(href).toMatch(/^\/[a-z0-9/?=&%.-]+$/i);
  expect(href).not.toContain(' ');
  expect(href).not.toContain('undefined');
}

describe('Indonesia local industry catalog', () => {
  it('covers the core local-first pillars for Indonesia', () => {
    expect(INDONESIA_LOCAL_INDUSTRY_PILLARS.map(pillar => pillar.id)).toEqual([
      'food-agri-fisheries',
      'home-fashion-beauty',
      'manufacturing-materials-energy',
      'digital-creative-services',
    ]);

    for (const pillar of INDONESIA_LOCAL_INDUSTRY_PILLARS) {
      expect(pillar.labelId).toBeTruthy();
      expect(pillar.labelEn).toBeTruthy();
      expect(pillar.summaryId).toBeTruthy();
      expect(pillar.summaryEn).toBeTruthy();
      expectInternalHref(pillar.href);
      expect(pillar.examples.length).toBeGreaterThanOrEqual(6);
      expect(pillar.exportSignals.length).toBeGreaterThanOrEqual(3);
      expect(pillar.importReplacementSignals.length).toBeGreaterThanOrEqual(3);
    }
  });

  it('keeps home links actionable and focused on export/import replacement', () => {
    const labels = LOCAL_FIRST_HOME_LINKS.map(link => link.labelId);

    expect(labels).toContain('Siap ekspor');
    expect(labels).toContain('Substitusi impor');
    expect(labels).toContain('Sertifikasi');
    expect(labels).toContain('Manufaktur lokal');

    const hrefs = new Set<string>();
    for (const link of LOCAL_FIRST_HOME_LINKS) {
      expect(link.labelId).toBeTruthy();
      expect(link.labelEn).toBeTruthy();
      expect(link.hintId).toBeTruthy();
      expect(link.hintEn).toBeTruthy();
      expectInternalHref(link.href);
      expect(hrefs.has(link.href)).toBe(false);
      hrefs.add(link.href);
    }
  });

  it('keeps export readiness guidance practical', () => {
    expect(INDONESIA_EXPORT_READINESS_STEPS.length).toBeGreaterThanOrEqual(5);
    expect(INDONESIA_EXPORT_READINESS_STEPS.join(' ').toLowerCase()).toContain('produk');
    expect(INDONESIA_EXPORT_READINESS_STEPS.join(' ').toLowerCase()).toContain('dokumen');
    expect(INDONESIA_EXPORT_READINESS_STEPS.join(' ').toLowerCase()).toContain('logistik');
  });
});

