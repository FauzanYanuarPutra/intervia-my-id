import { NextRequest, NextResponse } from 'next/server';
import { getJwtSubject } from '@/lib/server/jwtPayload';

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  'http://localhost:8081';
const CHAT_URL = process.env.INTERNAL_CHAT_URL || 'http://localhost:4000';

type GenericRecord = Record<string, unknown>;

type ListingMetricAccumulator = {
  orders_total: number;
  orders_active: number;
  orders_completed: number;
  orders_cancelled: number;
  dispute_count: number;
  gross_cents: number;
  revenue_cents: number;
  buyers: Map<string, number>;
  last_order_at: string | null;
};

function readList(payload: unknown): GenericRecord[] {
  if (Array.isArray(payload)) return payload as GenericRecord[];
  if (payload && typeof payload === 'object') {
    const objectPayload = payload as GenericRecord;
    const candidates = [
      objectPayload.items,
      objectPayload.data,
      objectPayload.results,
      objectPayload.transactions,
      objectPayload.contents,
      objectPayload.tickets,
    ];
    for (const candidate of candidates) {
      if (Array.isArray(candidate)) return candidate as GenericRecord[];
    }
  }
  return [];
}

function asObject(value: unknown): GenericRecord {
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    return value as GenericRecord;
  }
  return {};
}

function asString(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return '';
}

function asInt(value: unknown): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.floor(parsed));
}

function normalizeStatus(value: unknown): string {
  return asString(value).toLowerCase();
}

function normalizeListingStatus(listing: GenericRecord): string {
  return (
    normalizeStatus(listing.content_status || listing.status || 'draft') ||
    'draft'
  );
}

function normalizeListingType(listing: GenericRecord): string {
  const contentType = asString(
    listing.content_type || listing.type || listing.category || 'listing',
  ).toLowerCase();
  return contentType || 'listing';
}

function normalizeListingSector(listing: GenericRecord): string {
  const metadata = asObject(listing.metadata);
  const sector =
    asString(metadata.sector) ||
    asString(metadata.sub_sector) ||
    asString(listing.category) ||
    normalizeListingType(listing);
  return sector.toLowerCase() || 'general';
}

function normalizeCurrency(value: unknown): string {
  const currency = asString(value || 'IDR').toUpperCase();
  return currency || 'IDR';
}

function toTimestamp(value: unknown): number {
  const iso = asString(value);
  if (!iso) return 0;
  const parsed = Date.parse(iso);
  return Number.isFinite(parsed) ? parsed : 0;
}

function isWithinRange(
  timestamp: number,
  minExclusive: number,
  maxInclusive: number,
): boolean {
  if (!timestamp) return false;
  return timestamp > minExclusive && timestamp <= maxInclusive;
}

function getNestedNumber(input: unknown, path: string[]): number {
  let cursor: unknown = input;
  for (const segment of path) {
    if (!cursor || typeof cursor !== 'object' || Array.isArray(cursor))
      return 0;
    cursor = (cursor as GenericRecord)[segment];
  }
  return asInt(cursor);
}

function readListingViews(listing: GenericRecord): number {
  const metadata = asObject(listing.metadata);
  return (
    asInt(listing.view_count) ||
    asInt(listing.views) ||
    getNestedNumber(listing, ['metrics', 'views']) ||
    getNestedNumber(listing, ['stats', 'views']) ||
    getNestedNumber(metadata, ['analytics', 'views']) ||
    getNestedNumber(metadata, ['insights', 'views']) ||
    0
  );
}

function readListingClicks(listing: GenericRecord): number {
  const metadata = asObject(listing.metadata);
  return (
    asInt(listing.click_count) ||
    asInt(listing.clicks) ||
    getNestedNumber(listing, ['metrics', 'clicks']) ||
    getNestedNumber(listing, ['stats', 'clicks']) ||
    getNestedNumber(metadata, ['analytics', 'clicks']) ||
    getNestedNumber(metadata, ['insights', 'clicks']) ||
    0
  );
}

function readListingPriceCents(listing: GenericRecord): number {
  const direct = asInt(
    listing.price_cents || listing.value_cents || listing.price,
  );
  if (direct > 0) {
    if (listing.price_cents || listing.value_cents) return direct;
    return direct * 100;
  }
  const metadata = asObject(listing.metadata);
  const metadataPrice = asInt(metadata.price_cents || metadata.price);
  if (!metadataPrice) return 0;
  if (metadata.price_cents) return metadataPrice;
  return metadataPrice * 100;
}

function readTransactionAmountCents(transaction: GenericRecord): number {
  const direct = asInt(
    transaction.amount_cents ||
      transaction.amount_final_cents ||
      transaction.amount_estimate_cents ||
      transaction.value_cents ||
      transaction.amount,
  );
  if (
    transaction.amount_cents ||
    transaction.amount_final_cents ||
    transaction.amount_estimate_cents ||
    transaction.value_cents
  ) {
    return direct;
  }
  return direct > 0 ? direct * 100 : 0;
}

function isActiveTransaction(status: string): boolean {
  return new Set([
    'pending',
    'accepted',
    'in_progress',
    'processing',
    'funded',
    'awaiting_funding',
    'awaiting_delivery',
    'delivering',
    'delivered',
    'disputed',
  ]).has(status);
}

function isCompletedTransaction(status: string): boolean {
  return new Set(['completed', 'settled', 'done']).has(status);
}

function isCancelledTransaction(status: string): boolean {
  return new Set([
    'cancelled',
    'canceled',
    'failed',
    'expired',
    'refunded',
    'rejected',
  ]).has(status);
}

function isDisputeTransaction(status: string): boolean {
  return status === 'disputed' || status === 'chargeback';
}

function isOpenSupportTicket(status: string): boolean {
  return new Set(['open', 'in_progress', 'pending_customer']).has(status);
}

function readRoomUnreadCount(room: GenericRecord): number {
  return asInt(room.unread_count || room.unread || room.unreadCount);
}

async function fetchFromUpstream(
  url: string,
  token: string,
  timeoutMs = 4000,
): Promise<{ ok: boolean; payload: unknown }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: 'no-store',
      signal: controller.signal,
    });
    const payload = await response.json().catch(() => ({}));
    return { ok: response.ok, payload };
  } catch {
    return { ok: false, payload: {} };
  } finally {
    clearTimeout(timer);
  }
}

function percent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, Number(value.toFixed(1))));
}

function formatListingTitle(listing: GenericRecord): string {
  return (
    asString(
      listing.title || listing.name || listing.slug || 'Untitled listing',
    ) || 'Untitled listing'
  );
}

function normalizeIso(value: unknown): string {
  const raw = asString(value);
  if (!raw) return '';
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return '';
  return date.toISOString();
}

export async function GET(req: NextRequest) {
  const token =
    req.headers.get('authorization')?.replace('Bearer ', '').trim() ||
    req.cookies.get('access_token')?.value?.trim();

  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ownerId = getJwtSubject(token);
  const contentQuery = new URLSearchParams({ limit: '300', offset: '0' });
  if (ownerId) contentQuery.set('owner_id', ownerId);

  const [contentResult, transactionResult, inboxResult, supportResult] =
    await Promise.all([
      fetchFromUpstream(
        `${MARKETPLACE_URL}/v1/content?${contentQuery.toString()}`,
        token,
      ),
      fetchFromUpstream(
        `${MARKETPLACE_URL}/v1/transactions?limit=400&offset=0`,
        token,
      ),
      fetchFromUpstream(`${CHAT_URL}/api/v1/inbox?limit=120`, token),
      fetchFromUpstream(
        `${MARKETPLACE_URL}/v1/support/tickets?limit=200&offset=0`,
        token,
      ),
    ]);

  const rawListings = readList(contentResult.payload);
  const listings = ownerId
    ? rawListings.filter(item => asString(item.owner_id) === ownerId)
    : rawListings;

  const listingIds = new Set(
    listings.map(item => asString(item.id)).filter(Boolean),
  );

  const rawTransactions = readList(transactionResult.payload);
  const salesTransactions = rawTransactions.filter(item => {
    const contentId = asString(item.content_id);
    if (contentId && listingIds.has(contentId)) return true;
    if (ownerId && asString(item.seller_id) === ownerId) return true;
    return false;
  });

  const inboxRooms = readList(inboxResult.payload);
  const supportTickets = readList(supportResult.payload);

  const listingMetrics = new Map<string, ListingMetricAccumulator>();
  for (const listing of listings) {
    const listingId = asString(listing.id);
    if (!listingId) continue;
    listingMetrics.set(listingId, {
      orders_total: 0,
      orders_active: 0,
      orders_completed: 0,
      orders_cancelled: 0,
      dispute_count: 0,
      gross_cents: 0,
      revenue_cents: 0,
      buyers: new Map<string, number>(),
      last_order_at: null,
    });
  }

  const transactionStatusBreakdown = new Map<string, number>();
  const uniqueCustomers = new Set<string>();

  for (const transaction of salesTransactions) {
    const status =
      normalizeStatus(transaction.status || 'pending') || 'pending';
    transactionStatusBreakdown.set(
      status,
      (transactionStatusBreakdown.get(status) || 0) + 1,
    );

    const buyerId = asString(transaction.buyer_id);
    if (buyerId) uniqueCustomers.add(buyerId);

    const listingId = asString(transaction.content_id);
    if (!listingId || !listingMetrics.has(listingId)) continue;

    const accumulator = listingMetrics.get(listingId);
    if (!accumulator) continue;

    const amountCents = readTransactionAmountCents(transaction);
    accumulator.orders_total += 1;

    if (isActiveTransaction(status)) accumulator.orders_active += 1;
    if (isCompletedTransaction(status)) {
      accumulator.orders_completed += 1;
      accumulator.revenue_cents += amountCents;
    }
    if (isCancelledTransaction(status)) accumulator.orders_cancelled += 1;
    if (isDisputeTransaction(status)) accumulator.dispute_count += 1;
    if (!isCancelledTransaction(status)) accumulator.gross_cents += amountCents;

    if (buyerId) {
      const previous = accumulator.buyers.get(buyerId) || 0;
      accumulator.buyers.set(buyerId, previous + 1);
    }

    const txTimestamp = toTimestamp(
      transaction.updated_at || transaction.created_at,
    );
    const currentTimestamp = toTimestamp(accumulator.last_order_at);
    if (txTimestamp > currentTimestamp) {
      accumulator.last_order_at = normalizeIso(
        transaction.updated_at || transaction.created_at,
      );
    }
  }

  const listingAnalytics = listings
    .map(listing => {
      const listingId = asString(listing.id);
      const metrics = listingMetrics.get(listingId);
      const ordersTotal = metrics?.orders_total || 0;
      const grossCents = metrics?.gross_cents || 0;
      const revenueCents = metrics?.revenue_cents || 0;
      const repeatCustomers = Array.from(metrics?.buyers.values() || []).filter(
        count => count > 1,
      ).length;
      const completed = metrics?.orders_completed || 0;

      return {
        listing_id: listingId,
        slug: asString(listing.slug) || null,
        title: formatListingTitle(listing),
        content_type: normalizeListingType(listing),
        status: normalizeListingStatus(listing),
        sector: normalizeListingSector(listing),
        updated_at: normalizeIso(listing.updated_at || listing.created_at),
        created_at: normalizeIso(listing.created_at),
        price_cents: readListingPriceCents(listing),
        currency: normalizeCurrency(listing.currency),
        views: readListingViews(listing),
        clicks: readListingClicks(listing),
        orders_total: ordersTotal,
        orders_active: metrics?.orders_active || 0,
        orders_completed: completed,
        orders_cancelled: metrics?.orders_cancelled || 0,
        dispute_count: metrics?.dispute_count || 0,
        gross_cents: grossCents,
        revenue_cents: revenueCents,
        avg_order_cents:
          ordersTotal > 0 ? Math.round(grossCents / ordersTotal) : 0,
        conversion_rate: percent(
          ordersTotal > 0 ? (completed / ordersTotal) * 100 : 0,
        ),
        repeat_customers: repeatCustomers,
        last_order_at: metrics?.last_order_at || null,
      };
    })
    .sort((left, right) => {
      if (right.revenue_cents !== left.revenue_cents)
        return right.revenue_cents - left.revenue_cents;
      if (right.orders_total !== left.orders_total)
        return right.orders_total - left.orders_total;
      return toTimestamp(right.updated_at) - toTimestamp(left.updated_at);
    });

  const sectorMap = new Map<
    string,
    {
      listings: number;
      orders: number;
      completed: number;
      revenue_cents: number;
    }
  >();

  for (const listing of listingAnalytics) {
    const sector = listing.sector || 'general';
    const current = sectorMap.get(sector) || {
      listings: 0,
      orders: 0,
      completed: 0,
      revenue_cents: 0,
    };
    current.listings += 1;
    current.orders += listing.orders_total;
    current.completed += listing.orders_completed;
    current.revenue_cents += listing.revenue_cents;
    sectorMap.set(sector, current);
  }

  const sectorAnalytics = Array.from(sectorMap.entries())
    .map(([sector, value]) => ({
      sector,
      listings: value.listings,
      orders: value.orders,
      revenue_cents: value.revenue_cents,
      conversion_rate: percent(
        value.orders > 0 ? (value.completed / value.orders) * 100 : 0,
      ),
    }))
    .sort((left, right) => {
      if (right.revenue_cents !== left.revenue_cents)
        return right.revenue_cents - left.revenue_cents;
      return right.orders - left.orders;
    });

  const now = Date.now();
  const sevenDaysMs = 7 * 86_400_000;
  const oneWeekAgo = now - sevenDaysMs;
  const twoWeeksAgo = now - sevenDaysMs * 2;

  const weeklySalesTransactions = salesTransactions.filter(tx =>
    isWithinRange(toTimestamp(tx.created_at || tx.updated_at), oneWeekAgo, now),
  ).length;
  const previousWeekSalesTransactions = salesTransactions.filter(tx =>
    isWithinRange(
      toTimestamp(tx.created_at || tx.updated_at),
      twoWeeksAgo,
      oneWeekAgo,
    ),
  ).length;

  const weeklyListingsCreated = listings.filter(listing =>
    isWithinRange(
      toTimestamp(listing.created_at || listing.updated_at),
      oneWeekAgo,
      now,
    ),
  ).length;
  const previousWeekListingsCreated = listings.filter(listing =>
    isWithinRange(
      toTimestamp(listing.created_at || listing.updated_at),
      twoWeeksAgo,
      oneWeekAgo,
    ),
  ).length;

  const totalSalesTransactions = salesTransactions.length;
  const activeSalesTransactions = salesTransactions.filter(tx =>
    isActiveTransaction(normalizeStatus(tx.status)),
  ).length;
  const completedSalesTransactions = salesTransactions.filter(tx =>
    isCompletedTransaction(normalizeStatus(tx.status)),
  ).length;
  const disputedSalesTransactions = salesTransactions.filter(tx =>
    isDisputeTransaction(normalizeStatus(tx.status)),
  ).length;
  const cancelledSalesTransactions = salesTransactions.filter(tx =>
    isCancelledTransaction(normalizeStatus(tx.status)),
  ).length;

  const grossSalesCents = salesTransactions.reduce((sum, tx) => {
    const status = normalizeStatus(tx.status);
    if (isCancelledTransaction(status)) return sum;
    return sum + readTransactionAmountCents(tx);
  }, 0);

  const settledSalesCents = salesTransactions.reduce((sum, tx) => {
    const status = normalizeStatus(tx.status);
    if (!isCompletedTransaction(status)) return sum;
    return sum + readTransactionAmountCents(tx);
  }, 0);

  const unreadMessages = inboxRooms.reduce(
    (sum, room) => sum + readRoomUnreadCount(room),
    0,
  );
  const openSupportTickets = supportTickets.filter(ticket =>
    isOpenSupportTicket(normalizeStatus(ticket.status)),
  ).length;

  const byType = {
    umkm_listings: listingAnalytics.filter(item => {
      const sector = item.sector.toLowerCase();
      return (
        sector.includes('umkm') ||
        sector.includes('kuliner') ||
        sector.includes('retail')
      );
    }).length,
    service_listings: listingAnalytics.filter(
      item => item.content_type === 'service',
    ).length,
    product_listings: listingAnalytics.filter(
      item => item.content_type === 'product',
    ).length,
    project_listings: listingAnalytics.filter(
      item => item.content_type === 'project',
    ).length,
  };

  const summary = {
    total_listings: listingAnalytics.length,
    active_listings: listingAnalytics.filter(item => item.status === 'active')
      .length,
    draft_listings: listingAnalytics.filter(item => item.status === 'draft')
      .length,
    archived_listings: listingAnalytics.filter(
      item => item.status === 'archived',
    ).length,
    ...byType,
    total_sales_transactions: totalSalesTransactions,
    active_sales_transactions: activeSalesTransactions,
    completed_sales_transactions: completedSalesTransactions,
    disputed_sales_transactions: disputedSalesTransactions,
    cancelled_sales_transactions: cancelledSalesTransactions,
    unread_messages: unreadMessages,
    open_support_tickets: openSupportTickets,
    gross_sales_cents: grossSalesCents,
    settled_sales_cents: settledSalesCents,
    avg_order_cents:
      totalSalesTransactions > 0
        ? Math.round(grossSalesCents / totalSalesTransactions)
        : 0,
    unique_customers: uniqueCustomers.size,
    conversion_rate: percent(
      totalSalesTransactions > 0
        ? (completedSalesTransactions / totalSalesTransactions) * 100
        : 0,
    ),
    weekly_sales_transactions: weeklySalesTransactions,
    previous_week_sales_transactions: previousWeekSalesTransactions,
    weekly_listings_created: weeklyListingsCreated,
    previous_week_listings_created: previousWeekListingsCreated,
  };

  const recentActivities = [
    ...listingAnalytics.slice(0, 4).map(item => ({
      id: `listing:${item.listing_id}`,
      type: 'listing',
      title: item.title,
      description: `Listing ${item.status} diperbarui`,
      at: item.updated_at,
      href: item.listing_id ? `/content/${item.listing_id}` : '/my-listings',
    })),
    ...salesTransactions
      .slice()
      .sort(
        (left, right) =>
          toTimestamp(right.updated_at || right.created_at) -
          toTimestamp(left.updated_at || left.created_at),
      )
      .slice(0, 4)
      .map(transaction => ({
        id: `txn:${asString(transaction.id)}`,
        type: 'transaction',
        title: `Transaksi ${normalizeStatus(transaction.status) || 'pending'}`,
        description: asString(
          transaction.offer_message ||
            transaction.response_message ||
            'Pantau progres transaksi terbaru',
        ),
        at: normalizeIso(transaction.updated_at || transaction.created_at),
        href: '/transactions',
      })),
  ]
    .sort((left, right) => toTimestamp(right.at) - toTimestamp(left.at))
    .slice(0, 8);

  const recommendations: Array<{
    id: string;
    level: 'high' | 'medium' | 'low';
    title: string;
    description: string;
    href: string;
  }> = [];

  if (summary.draft_listings > 0) {
    recommendations.push({
      id: 'finish-drafts',
      level: 'high',
      title: 'Selesaikan draft listing',
      description: `${summary.draft_listings} draft belum aktif. Lengkapi agar traffic dan order bisa masuk.`,
      href: '/my-listings',
    });
  }

  if (summary.unread_messages > 0) {
    recommendations.push({
      id: 'reply-chat',
      level: 'high',
      title: 'Balas chat prospek',
      description: `${summary.unread_messages} pesan belum dibaca. Respons cepat biasanya menaikkan conversion.`,
      href: '/chat',
    });
  }

  if (summary.active_sales_transactions > 0) {
    recommendations.push({
      id: 'close-active-transactions',
      level: 'medium',
      title: 'Dorong transaksi aktif ke selesai',
      description: `${summary.active_sales_transactions} transaksi masih berjalan. Fokus ke SLA dan follow-up pembayaran/pengiriman.`,
      href: '/transactions',
    });
  }

  if (summary.active_listings === 0) {
    recommendations.push({
      id: 'activate-listing',
      level: 'medium',
      title: 'Belum ada listing aktif',
      description:
        'Aktifkan minimal satu listing agar dashboard mulai merekam performa real-time.',
      href: '/create?mode=quick',
    });
  }

  if (recommendations.length === 0) {
    recommendations.push({
      id: 'maintain-growth',
      level: 'low',
      title: 'Performa stabil, lanjut optimasi',
      description:
        'Pertahankan respons chat, tambah listing baru, dan review sektor dengan revenue tertinggi.',
      href: '/dashboard',
    });
  }

  const response = {
    generated_at: new Date().toISOString(),
    summary,
    listing_analytics: listingAnalytics,
    sector_analytics: sectorAnalytics,
    transaction_status_breakdown: Array.from(
      transactionStatusBreakdown.entries(),
    )
      .map(([status, count]) => ({ status, count }))
      .sort((left, right) => right.count - left.count),
    recent_activities: recentActivities,
    recommendations,
    data_health: {
      listing_source_ok: contentResult.ok,
      transaction_source_ok: transactionResult.ok,
      inbox_source_ok: inboxResult.ok,
      support_source_ok: supportResult.ok,
    },
  };

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'private, max-age=15, stale-while-revalidate=30',
    },
  });
}
