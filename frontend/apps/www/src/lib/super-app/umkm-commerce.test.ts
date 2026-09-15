import { beforeEach, describe, expect, it } from 'vitest';
import {
  __resetUmkmCommerceRuntime,
  checkoutUmkmOrder,
  confirmUmkmOrderBill,
  createUmkmOrder,
  createUmkmReservation,
  listUmkmOrderBundlesByStore,
  listUmkmTables,
  updateUmkmOrderStatus,
} from '@/lib/super-app/umkm-commerce';

describe('umkm-commerce offline table flow', () => {
  beforeEach(() => {
    __resetUmkmCommerceRuntime();
  });

  it('merges repeated offline scans and releases the table after the order is served and paid', async () => {
    const first = await createUmkmOrder({
      storeId: '50000000-0000-0000-0000-000000000001',
      channel: 'offline',
      tableId: '52000000-0000-0000-0000-000000000001',
      customerName: 'Andi',
      paymentTiming: 'postpay',
      items: [
        {
          product_id: '51000000-0000-0000-0000-000000000001',
          quantity: 1,
        },
      ],
    });

    expect(first.mutation).toBe('created');
    expect(first.order.table_code).toBe('T01');

    const second = await createUmkmOrder({
      storeId: '50000000-0000-0000-0000-000000000001',
      channel: 'offline',
      tableId: '52000000-0000-0000-0000-000000000001',
      paymentTiming: 'postpay',
      items: [
        {
          product_id: '51000000-0000-0000-0000-000000000003',
          quantity: 2,
        },
      ],
    });

    expect(second.mutation).toBe('merged');
    expect(second.order.id).toBe(first.order.id);
    expect(second.items).toHaveLength(2);

    const occupied = await listUmkmTables('50000000-0000-0000-0000-000000000001');
    expect(occupied.find((table) => table.id === '52000000-0000-0000-0000-000000000001')?.status).toBe(
      'occupied',
    );

    await confirmUmkmOrderBill({
      orderId: first.order.id,
    });

    await updateUmkmOrderStatus({
      orderId: first.order.id,
      status: 'served',
    });

    const checkedOut = await checkoutUmkmOrder({
      orderId: first.order.id,
      paymentMetadata: { cashier: 'kasir-1' },
    });

    expect(checkedOut.order.payment_status).toBe('paid');

    const released = await listUmkmTables('50000000-0000-0000-0000-000000000001');
    expect(released.find((table) => table.id === '52000000-0000-0000-0000-000000000001')?.status).toBe(
      'available',
    );
  });

  it('assigns the smallest fitting table for reservations and blocks overlapping slots', async () => {
    const reservedFor = new Date(Date.now() + 2 * 60 * 60_000).toISOString();

    const first = await createUmkmReservation({
      storeId: '50000000-0000-0000-0000-000000000001',
      customerName: 'Sari',
      customerPhone: '081200000001',
      guestCount: 3,
      reservedFor,
      durationMinutes: 90,
    });

    expect(first.table_code).toBe('T02');

    await expect(
      createUmkmReservation({
        storeId: '50000000-0000-0000-0000-000000000001',
        tableCode: 'T02',
        customerName: 'Bima',
        customerPhone: '081200000002',
        guestCount: 4,
        reservedFor,
        durationMinutes: 60,
      }),
    ).rejects.toThrow('No table is available for the requested reservation slot');

    const second = await createUmkmReservation({
      storeId: '50000000-0000-0000-0000-000000000001',
      customerName: 'Rina',
      customerPhone: '081200000003',
      guestCount: 2,
      reservedFor,
      durationMinutes: 60,
    });

    expect(second.table_code).toBe('T01');
  });

  it('snapshots product display metadata on order items for cashier cards', async () => {
    const created = await createUmkmOrder({
      storeId: '50000000-0000-0000-0000-000000000001',
      channel: 'offline',
      tableId: '52000000-0000-0000-0000-000000000001',
      items: [
        {
          product_id: '51000000-0000-0000-0000-000000000001',
          quantity: 2,
        },
      ],
    });

    expect(created.items[0]?.metadata).toMatchObject({
      product_image_url: null,
      product_category: 'main_course',
      product_slug: 'nasi-bakar-ayam-kemangi',
    });

    const [listed] = await listUmkmOrderBundlesByStore({
      storeId: '50000000-0000-0000-0000-000000000001',
      limit: 1,
    });

    expect(listed?.order.id).toBe(created.order.id);
    expect(listed?.items[0]?.product_name).toBe('Nasi Bakar Ayam Kemangi');
    expect(listed?.items[0]?.metadata.product_image_url).toBe(
      created.items[0]?.metadata.product_image_url,
    );
  });
});
