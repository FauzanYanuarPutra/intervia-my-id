import { describe, expect, it } from 'vitest';
import { LISTING_TEMPLATES, getListingTemplates } from './listingTemplates';

const REQUIRED_TEMPLATE_FIELDS = ['title', 'summary', 'body', 'price_cents', 'location', 'tags'];

describe('local-first and export listing templates', () => {
  it('provides create-flow templates for import replacement and export readiness', () => {
    const ids = LISTING_TEMPLATES.map(template => template.id);

    expect(ids).toContain('demand-product-import-replacement');
    expect(ids).toContain('supply-product-export-coconut-briquette');
    expect(ids).toContain('supply-service-export-readiness');
  });

  it('keeps the export/import templates complete enough for one-click create', () => {
    const templates = LISTING_TEMPLATES.filter(template =>
      [
        'demand-product-import-replacement',
        'supply-product-export-coconut-briquette',
        'supply-service-export-readiness',
      ].includes(template.id),
    );

    for (const template of templates) {
      expect(template.listingMode).toBe('detail');
      expect(template.titleId).toBeTruthy();
      expect(template.titleEn).toBeTruthy();
      expect(template.summaryId).toBeTruthy();
      expect(template.summaryEn).toBeTruthy();
      expect(template.badgeId).toBeTruthy();
      expect(template.badgeEn).toBeTruthy();

      for (const field of REQUIRED_TEMPLATE_FIELDS) {
        expect(template.fields[field], `${template.id}.${field}`).toBeTruthy();
      }

      expect(template.fields.tags.toLowerCase()).toMatch(
        /(ekspor|export|impor|import|lokal|tkdn)/,
      );
    }
  });

  it('filters localized templates by listing side and type', () => {
    const supplyProducts = getListingTemplates('id', 'supply', 'product');
    const supplyServices = getListingTemplates('id', 'supply', 'service');
    const demandProducts = getListingTemplates('id', 'demand', 'product');

    expect(supplyProducts.some(template => template.id === 'supply-product-export-coconut-briquette')).toBe(
      true,
    );
    expect(supplyServices.some(template => template.id === 'supply-service-export-readiness')).toBe(
      true,
    );
    expect(demandProducts.some(template => template.id === 'demand-product-import-replacement')).toBe(
      true,
    );
    expect(supplyProducts.every(template => template.title && template.summary && template.badge)).toBe(
      true,
    );
  });
});

