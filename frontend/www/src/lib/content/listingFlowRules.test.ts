import { describe, expect, it } from 'vitest';
import {
  toUpsertListingPayload,
  validateListingPayload,
} from './listingFlowRules';

describe('validateListingPayload', () => {
  it('canonicalizes matching listing type aliases without forwarding the legacy type key', () => {
    const result = validateListingPayload(
      {
        type: 'properties',
        content_type: 'property',
        category: 'property',
        title: 'Villa Canggu',
        summary: 'Ringkasan singkat',
        body: 'Deskripsi listing lengkap',
      },
      { mode: 'create' },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.payload.content_type).toBe('property');
    expect(result.payload.category).toBe('property');
    expect(result.payload).not.toHaveProperty('type');
  });

  it('rejects conflicting listing type aliases before forwarding upstream', () => {
    const result = validateListingPayload(
      {
        type: 'job',
        content_type: 'property',
        title: 'Listing bentrok',
      },
      { mode: 'create' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(
      result.issues.some(issue =>
        issue.includes('conflicting listing type fields'),
      ),
    ).toBe(true);
  });

  it('rejects unsafe primary promotion programs that exceed the margin buffer', () => {
    const result = validateListingPayload(
      {
        content_type: 'service',
        content_status: 'active',
        title: 'Kopi literan',
        summary: 'Promo besar',
        body: 'Diskon kampanye.',
        price_cents: 10000000,
        metadata: {
          work_mode: 'remote',
          service_scope: 'Audit pajak bulanan dan review invoice.',
          deliverables: 'Laporan, rekomendasi, dan review bulanan.',
          rate_type: 'project',
          availability: 'Senin-Jumat',
          area_served: 'Jakarta',
          delivery_time: '7 hari kerja',
          revisions_included: 2,
          promotion: {
            enabled: true,
            promo_objective: 'sale',
            promo_budget_type: 'total',
            promo_budget_amount: 500000,
            promo_start_date: '2026-03-20',
            promo_end_date: '2026-03-31',
            promo_target_locations: 'Jakarta',
            promo_target_audience: 'Pelanggan baru',
            promo_channels: 'search',
            promo_headline: 'Promo minggu ini',
            promo_caption: 'Diskon besar.',
            promo_offer_type: 'raffle',
            promo_cta: 'buy_now',
            promo_raffle_prize_title: 'Voucher jumbo',
            promo_raffle_prize_value: 500000,
            promo_raffle_draw_date: '2026-03-31',
            promo_raffle_expected_entries: 20,
            promo_raffle_max_winners: 2,
            promo_estimated_margin_percent: 18,
          },
        },
      },
      { mode: 'create', strictActiveValidation: true },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(
      result.issues.some(issue =>
        issue.includes('safe margin buffer'),
      ),
    ).toBe(true);
  });

  it('accepts safe loyalty card promotions with the required financial fields', () => {
    const result = validateListingPayload(
      {
        content_type: 'service',
        content_status: 'active',
        title: 'Kopi literan',
        summary: 'Promo repeat order',
        body: 'Kartu loyalti untuk repeat customer.',
        price_cents: 12000000,
        metadata: {
          work_mode: 'remote',
          service_scope: 'Pendampingan brand dan retention plan.',
          deliverables: 'Retainer bulanan plus review campaign.',
          rate_type: 'project',
          availability: 'Senin-Jumat',
          area_served: 'Indonesia',
          delivery_time: '14 hari kerja',
          revisions_included: 3,
          promotion: {
            enabled: true,
            promo_objective: 'sale',
            promo_budget_type: 'total',
            promo_budget_amount: 500000,
            promo_start_date: '2026-03-20',
            promo_end_date: '2026-03-31',
            promo_target_locations: 'Jakarta',
            promo_target_audience: 'Pelanggan repeat',
            promo_channels: 'feed',
            promo_headline: 'Balik lagi dapat reward',
            promo_caption: 'Kumpulkan stamp dan tukar reward.',
            promo_offer_type: 'loyalty_card',
            promo_cta: 'buy_now',
            promo_loyalty_stamp_target: 8,
            promo_loyalty_reward_type: 'discount',
            promo_loyalty_reward_value: 25000,
            promo_estimated_margin_percent: 32,
          },
        },
      },
      { mode: 'create', strictActiveValidation: true },
    );

    expect(result.ok).toBe(true);
  });

  it('accepts active company listings with company-specific required metadata', () => {
    const result = validateListingPayload(
      {
        content_type: 'company',
        content_status: 'active',
        title: 'Northstar Labs',
        summary: 'Profil perusahaan AI untuk produk enterprise.',
        body: 'Kami membangun perangkat lunak AI untuk workflow enterprise.',
        metadata: {
          company_name: 'Northstar Labs',
          industry_focus: 'Artificial Intelligence',
          about_company:
            'Perusahaan fokus pada AI workflow, infrastruktur data, dan automation enterprise.',
          headquarters: 'Jakarta',
          company_size: '51-200',
          founded_year: 2020,
          listing_mode: 'detail',
        },
      },
      { mode: 'create', strictActiveValidation: true },
    );

    expect(result.ok).toBe(true);
  });

  it('rejects simple mode for company listings', () => {
    const result = validateListingPayload(
      {
        content_type: 'company',
        content_status: 'active',
        title: 'Northstar Labs',
        summary: 'Profil singkat.',
        body: 'Profil perusahaan.',
        metadata: {
          company_name: 'Northstar Labs',
          industry_focus: 'Artificial Intelligence',
          about_company: 'Profil perusahaan.',
          listing_mode: 'simple',
        },
      },
      { mode: 'create', strictActiveValidation: true },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(
      result.issues.some(issue =>
        issue.includes('simple listing mode is not allowed for company'),
      ),
    ).toBe(true);
  });

  it('rejects active supply listings that point to foreign brands', () => {
    const result = validateListingPayload(
      {
        content_type: 'service',
        content_status: 'active',
        title: 'Jasa setup toko Nike dan Adidas',
        summary: 'Bantu launch channel jualan untuk brand global.',
        body: 'Setup operasional, katalog, dan campaign.',
        price_cents: 8000000,
        metadata: {
          work_mode: 'remote',
          service_scope: 'Operasional marketplace dan campaign setup.',
          deliverables: 'Setup toko, SOP, dan dashboard harian.',
          rate_type: 'project',
          availability: 'Senin-Jumat',
          area_served: 'Indonesia',
          delivery_time: '7 hari kerja',
          revisions_included: 2,
          listing_mode: 'detail',
        },
      },
      { mode: 'create', strictActiveValidation: true },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;

    expect(
      result.issues.some(issue =>
        issue.includes('foreign brand signals detected'),
      ),
    ).toBe(true);
  });
});

describe('toUpsertListingPayload', () => {
  it('keeps only supported upsert keys for marketplace payloads', () => {
    expect(
      toUpsertListingPayload({
        content_type: 'property',
        category: 'property',
        title: 'Villa Canggu',
        content_status: 'draft',
        metadata: { location: 'Bali' },
        type: 'property',
        description: 'legacy text',
        random: 'should-be-dropped',
      }),
    ).toEqual({
      content_type: 'property',
      category: 'property',
      title: 'Villa Canggu',
      content_status: 'draft',
      metadata: { location: 'Bali' },
    });
  });
});
