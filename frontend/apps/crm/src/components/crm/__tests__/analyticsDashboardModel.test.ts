import { describe, expect, it } from 'vitest';
import type { DashboardData } from '../models';
import {
  buildBreakdown,
  buildTrendSeries,
  countNewInRange,
  sumOrderValue,
} from '../analyticsDashboardModel';

function fixture(): DashboardData {
  return {
    leads: [
      {
        id: 'lead-1',
        requester_user_id: null,
        requester_email: null,
        requester_name: null,
        owner_id: null,
        contact_user_id: null,
        content_id: null,
        chat_room_id: null,
        name: 'Lead A',
        sector: 'kuliner',
        stage: 'lead',
        source: 'web',
        value_cents: 50000,
        currency: 'IDR',
        metadata: {},
        created_at: '2026-09-28T09:00:00Z',
        updated_at: '2026-09-28T09:00:00Z',
      },
    ],
    activities: [
      {
        id: 'activity-1',
        title: 'User Baru',
        body: 'Registrasi akun',
        type: 'user',
        at: '2026-09-29T09:00:00Z',
      },
    ],
    tickets: [
      {
        id: 'ticket-1',
        requester_user_id: null,
        requester_email: '',
        requester_name: null,
        category: 'support',
        subject: 'Bantuan',
        status: 'open',
        priority: 'normal',
        assigned_agent_id: null,
        support_room_id: null,
        source: 'web',
        created_at: '2026-09-28T09:00:00Z',
        updated_at: '2026-09-28T09:00:00Z',
        resolved_at: null,
        first_response_at: null,
        latest_message: null,
        latest_message_at: null,
      },
    ],
    orders: [
      {
        id: 'order-1',
        requester_id: 'buyer',
        partner_id: 'seller',
        merchant_id: null,
        provider_id: null,
        service_type: 'marketplace',
        status: 'completed',
        payment_mode: 'manual',
        currency: 'IDR',
        amount_estimate_cents: 10000,
        amount_final_cents: 12000,
        pickup_address: null,
        pickup_lat: null,
        pickup_lng: null,
        dropoff_address: null,
        dropoff_lat: null,
        dropoff_lng: null,
        risk_score: 0,
        risk_flags: null,
        metadata: {},
        created_at: '2026-09-29T09:00:00Z',
        updated_at: '2026-09-29T09:00:00Z',
      },
    ],
    trustProfiles: [],
    users: [],
    listings: [
      {
        id: 'listing-1',
        title: 'Produk A',
        category: 'product',
        priceCents: 10000,
        currency: 'IDR',
        location: 'Jakarta',
        status: 'active',
        rawStatus: 'active',
        image: '',
        ownerId: 'seller',
        featured: false,
        updatedAt: '2026-09-28T09:00:00Z',
        createdAt: '2026-09-28T09:00:00Z',
        metadata: {},
        reportCount: 0,
        reporters: [],
        reportReasons: [],
        reportTicketIds: [],
        moderationStatus: 'normal',
      },
    ],
    businesses: [],
    chats: [],
    sampleCollections: [],
    emptyCollections: [],
    failures: [],
  };
}

describe('CRM analytics dashboard model', () => {
  it('builds trend buckets without inventing extra data', () => {
    const data = fixture();
    const trend = buildTrendSeries(data, 'orders', 7, Date.parse('2026-09-29T23:00:00Z'));
    expect(trend).toHaveLength(7);
    expect(trend.reduce((sum, item) => sum + item.value, 0)).toBe(1);
  });

  it('recognizes registration activity and keeps breakdown counts exact', () => {
    const data = fixture();
    expect(countNewInRange(data, 'registrations', 7, Date.parse('2026-09-30T00:00:00Z'))).toBe(1);
    expect(buildBreakdown(data, 'listings')).toEqual([{ label: 'Aktif', value: 1 }]);
  });

  it('uses exact order amounts for GMV', () => {
    expect(sumOrderValue(fixture())).toBe(12000);
  });
});
