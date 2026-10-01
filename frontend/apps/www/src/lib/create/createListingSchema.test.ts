import { describe, expect, it } from 'vitest';
import {
  buildListingFieldSchema,
  fieldsForStep,
  selectMainStepFields,
} from './createListingSchema';

describe('create listing schema', () => {
  it('uses different fields for offer and request', () => {
    const offer = buildListingFieldSchema(
      'offer',
      'materials-suppliers',
      'raw-materials',
    ).map(field => field.key);
    const request = buildListingFieldSchema(
      'request',
      'materials-suppliers',
      'raw-materials',
    ).map(field => field.key);

    expect(offer).toContain('minimum_order');
    expect(offer).toContain('owned_certifications');
    expect(request).toContain('need_frequency');
    expect(request).toContain('required_certifications');
    expect(request).not.toContain('owned_certifications');
  });

  it('lets subcategory influence the field schema', () => {
    const packaging = buildListingFieldSchema(
      'offer',
      'materials-suppliers',
      'business-packaging',
    ).map(field => field.key);
    const raw = buildListingFieldSchema(
      'offer',
      'materials-suppliers',
      'raw-materials',
    ).map(field => field.key);

    expect(packaging).toContain('custom_printing');
    expect(raw).not.toContain('custom_printing');
  });

  it('uses a select for long unit lists and chips for short stock choices', () => {
    const fields = buildListingFieldSchema(
      'offer',
      'materials-suppliers',
      'raw-materials',
    );
    const unit = fields.find(field => field.key === 'unit');
    const stockStatus = fields.find(field => field.key === 'stock_status');

    expect(unit?.type).toBe('select');
    expect(unit?.options?.map(option => option.value)).toEqual(
      expect.arrayContaining(['kg', 'l', 'pcs', 'box', 'sack', 'pallet']),
    );
    expect(stockStatus?.type).toBe('radio');
    expect(stockStatus?.options?.map(option => option.value)).toEqual(
      expect.arrayContaining(['ready_stock', 'pre_order', 'recurring_stock']),
    );
  });

  it('separates request quantity, unit, and frequency', () => {
    const fields = buildListingFieldSchema(
      'request',
      'materials-suppliers',
      'raw-materials',
    );

    expect(fields.find(field => field.key === 'quantity')?.type).toBe('number');
    expect(fields.find(field => field.key === 'unit')?.type).toBe('select');
    expect(fields.find(field => field.key === 'need_frequency')?.type).toBe(
      'radio',
    );
  });

  it('uses multi-select chips for values that can have several answers', () => {
    const supplies = buildListingFieldSchema(
      'offer',
      'materials-suppliers',
      'business-packaging',
    );
    const places = buildListingFieldSchema(
      'offer',
      'business-places',
      'shop-houses',
    );

    expect(
      supplies.find(field => field.key === 'owned_certifications')?.type,
    ).toBe('multi-select');
    expect(supplies.find(field => field.key === 'material')?.type).toBe(
      'multi-select',
    );
    expect(places.find(field => field.key === 'facilities')?.type).toBe(
      'multi-select',
    );
  });



  it('keeps price and budget inputs visible in the compact main step', () => {
    const offerFields = buildListingFieldSchema(
      'offer',
      'materials-suppliers',
      'raw-materials',
    );
    const requestFields = buildListingFieldSchema(
      'request',
      'materials-suppliers',
      'raw-materials',
    );

    const offerMain = selectMainStepFields(
      fieldsForStep(offerFields, 4),
      7,
    ).map(field => field.key);
    const requestMain = selectMainStepFields(
      fieldsForStep(requestFields, 4),
      7,
    ).map(field => field.key);

    expect(offerMain).toContain('price_amount');
    expect(offerMain).toContain('price_mode');
    expect(requestMain).toContain('price_amount');
    expect(requestMain).toContain('budget_mode');
    expect(offerMain.length).toBeLessThanOrEqual(7);
    expect(requestMain.length).toBeLessThanOrEqual(7);
  });

  it('uses radio chips for short transaction and contact choices', () => {
    const fields = buildListingFieldSchema(
      'offer',
      'machines-tools',
      'production-machines',
    );

    expect(fields.find(field => field.key === 'price_mode')?.type).toBe(
      'radio',
    );
    expect(fields.find(field => field.key === 'sale_mode')?.type).toBe('radio');
    expect(fields.find(field => field.key === 'condition')?.type).toBe('radio');
    expect(fields.find(field => field.key === 'contact_channel')?.type).toBe(
      'radio',
    );
  });
});
