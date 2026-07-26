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
      result.issues.some(issue => issue.includes('safe margin buffer')),
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

  it('accepts active demand product briefs without a primary image', () => {
    const result = validateListingPayload(
      {
        content_type: 'product',
        content_status: 'active',
        title: 'Butuh cup plastik 12 oz',
        summary: 'Cari supplier cup plastik area Bandung.',
        body: 'Butuh cup plastik untuk outlet minuman, kirim rutin mingguan.',
        metadata: {
          listing_mode: 'simple',
          listing_side: 'demand',
          market_side: 'demand',
          product_name: 'Cup plastik 12 oz',
          location: 'Bandung',
        },
      },
      { mode: 'create' },
    );

    expect(result.ok).toBe(true);
  });

  it('requires provenance before activating reference-only open-data listings', () => {
    const result = validateListingPayload(
      {
        content_type: 'product',
        content_status: 'active',
        title: 'Referensi pasar lokal',
        summary: 'Rujukan publik untuk konteks bisnis lokal.',
        body: 'Konten ini bukan penawaran transaksi langsung.',
        metadata: {
          listing_mode: 'simple',
          listing_side: 'demand',
          market_side: 'demand',
          source_only: true,
          is_transactional: false,
        },
      },
      { mode: 'create' },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.some(issue => issue.includes('metadata.source_url')),
    ).toBe(true);
    expect(
      result.issues.some(issue =>
        issue.includes('contact_policy=no_private_contact_seeded'),
      ),
    ).toBe(true);
  });

  it('accepts active reference-only open-data listings with source and no-private-contact policy', () => {
    const result = validateListingPayload(
      {
        content_type: 'product',
        content_status: 'active',
        title: 'Referensi pasar lokal',
        summary: 'Rujukan publik untuk konteks bisnis lokal.',
        body: 'Konten ini bukan penawaran transaksi langsung.',
        metadata: {
          listing_mode: 'simple',
          listing_side: 'demand',
          market_side: 'demand',
          source_only: true,
          is_transactional: false,
          source_url: 'https://commons.wikimedia.org/wiki/File:Lokbaintan.jpg',
          contact_policy: 'no_private_contact_seeded',
        },
      },
      { mode: 'create' },
    );

    expect(result.ok).toBe(true);
  });

  it('accepts active demand property briefs without a primary image', () => {
    const result = validateListingPayload(
      {
        content_type: 'property',
        content_status: 'active',
        title: 'Cari kios 3x3 dekat kampus',
        summary: 'Butuh tempat usaha untuk minuman area Bandung.',
        body: 'Cari kios kecil, listrik aman, dan bisa sewa bulanan.',
        metadata: {
          listing_mode: 'simple',
          listing_side: 'demand',
          market_side: 'demand',
          property_type: 'kios',
          location: 'Bandung',
        },
      },
      { mode: 'create' },
    );

    expect(result.ok).toBe(true);
  });

  it('accepts active business transfer listings with required handover details', () => {
    const result = validateListingPayload(
      {
        content_type: 'oper-usaha',
        content_status: 'active',
        title: 'Oper laundry kiloan aktif di Bekasi',
        summary: 'Usaha berjalan lengkap dengan aset, SOP, dan laporan dasar.',
        body: 'Calon pembeli bisa cek aset, kontrak sewa, laporan omzet, biaya operasional, dan risiko sebelum deal.',
        price_cents: 185000000,
        cover_image:
          'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80',
        metadata: {
          listing_mode: 'detail',
          business_name: 'Laundry Kilat Bekasi',
          business_category: 'service',
          business_age_months: 18,
          average_monthly_revenue_cents: 42000000,
          average_monthly_profit_cents: 11000000,
          monthly_operational_cost_cents: 26000000,
          included_assets:
            'Mesin cuci 4 unit, dryer 2 unit, stok deterjen, rak, dan meja kasir.',
          handover_items:
            'SOP, kontak supplier, template promosi, training 7 hari, dan daftar pelanggan yang boleh dialihkan.',
          rating_summary: 'Google Maps 4,8 dari 320 review',
          rating_transfer_policy: 'included_needs_platform_approval',
          transferable_channels:
            'Google Maps, marketplace, nomor outlet, website, dan katalog pelanggan jika disetujui pihak terkait.',
          lease_contract_status: 'lease_needs_approval',
          liabilities_note:
            'Tidak ada hutang supplier. Sewa outlet perlu approval pemilik.',
          reason_for_sale: 'Owner pindah domisili.',
          handover_timeline:
            '14 hari setelah tanda jadi dan verifikasi dokumen',
          training_support: 'Training operasional 7 hari.',
          ownership_proof:
            'NIB, invoice aset, bukti sewa, dan laporan omzet ringkas.',
          legal_transfer_note:
            'Disarankan memakai perjanjian tertulis dan escrow/tahap pembayaran.',
          handover_risks:
            'Kontrak sewa perlu persetujuan pemilik dan omzet bisa berubah setelah owner baru.',
        },
      },
      { mode: 'create', strictActiveValidation: true },
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.payload.content_type).toBe('business_transfer');
  });

  it('rejects business transfer listings when platform/rating transfer details are missing', () => {
    const result = validateListingPayload(
      {
        content_type: 'business_transfer',
        content_status: 'active',
        title: 'Oper toko aktif',
        summary: 'Usaha berjalan.',
        body: 'Aset dan laporan bisa dicek.',
        price_cents: 100000000,
        cover_image:
          'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&w=900&q=80',
        metadata: {
          listing_mode: 'detail',
          business_name: 'Toko Aktif',
          business_category: 'retail',
          business_age_months: 12,
          average_monthly_revenue_cents: 30000000,
          monthly_operational_cost_cents: 18000000,
          included_assets: 'Rak, stok awal, dan perlengkapan kasir.',
          handover_items: 'SOP dan kontak supplier.',
          rating_transfer_policy: 'included_needs_platform_approval',
          lease_contract_status: 'owned',
          liabilities_note: 'Tidak ada hutang supplier.',
          reason_for_sale: 'Owner fokus ke usaha lain.',
          handover_timeline: '7 hari',
          training_support: 'Pendampingan 3 hari.',
          ownership_proof: 'Invoice aset.',
          legal_transfer_note: 'Perlu perjanjian tertulis.',
          handover_risks: 'Traffic toko bisa berubah.',
        },
      },
      { mode: 'create', strictActiveValidation: true },
    );

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(
      result.issues.some(issue =>
        issue.includes('metadata.transferable_channels is required'),
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
