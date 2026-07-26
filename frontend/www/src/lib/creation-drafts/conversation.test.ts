import { describe, expect, it } from 'vitest';
import {
  buildCreationIntakeMessage,
  evaluateCreationFlow,
  readCreationFlowMetadata,
} from './conversation';

describe('guided creation conversation', () => {
  it('keeps a generic offer request in the collecting stage', () => {
    const flow = evaluateCreationFlow({
      target: 'offering_listing',
      message: 'Saya ingin membuat penawaran dari informasi yang saya kirim.',
      locale: 'id',
    });

    expect(flow.status).toBe('collecting');
    expect(flow.collectedFields).toEqual([]);
    expect(buildCreationIntakeMessage(flow, 'id')).toContain(
      'Nama produk / jasa:',
    );
    expect(buildCreationIntakeMessage(flow, 'id')).toContain('Harga:');
  });

  it('marks an offer ready after the core labeled answers are supplied', () => {
    const flow = evaluateCreationFlow({
      target: 'offering_listing',
      message: [
        'Nama produk: Keripik pisang madu',
        'Kategori: Makanan ringan',
        'Keunggulan: Renyah, dibuat harian, kemasan 250 gram',
        'Harga: Rp18.000',
        'Lokasi: Bandung Timur',
      ].join('\n'),
      locale: 'id',
    });

    expect(flow.status).toBe('ready');
    expect(flow.collected.subject).toBe('Keripik pisang madu');
    expect(flow.draftInstruction).toContain('Harga: Rp18.000');
  });

  it('retains answers across partial follow-up messages', () => {
    const first = evaluateCreationFlow({
      target: 'looking_for_listing',
      message: 'Barang yang dibutuhkan: Botol PET 250 ml',
      locale: 'id',
    });
    const second = evaluateCreationFlow({
      target: 'looking_for_listing',
      message: 'Jumlah: 2.000 pcs',
      locale: 'id',
      previous: first,
    });

    expect(first.status).toBe('collecting');
    expect(second.status).toBe('ready');
    expect(second.collected.subject).toBe('Botol PET 250 ml');
    expect(second.collected.quantity).toBe('2.000 pcs');
  });

  it('allows media to support an explicitly named offer', () => {
    const flow = evaluateCreationFlow({
      target: 'offering_listing',
      message: 'Nama produk: Rak display kayu',
      locale: 'id',
      media: [{ kind: 'image', name: 'rak.jpg', url: '/owned/rak.jpg' }],
    });

    expect(flow.status).toBe('ready');
    expect(flow.media).toHaveLength(1);
  });

  it('requires a business name and main product before creating a profile draft', () => {
    const flow = evaluateCreationFlow({
      target: 'business_profile',
      message: [
        'Nama usaha: Dapur Nusa',
        'Produk utama: Katering makan siang',
      ].join('\n'),
      locale: 'id',
    });

    expect(flow.status).toBe('ready');
    expect(flow.missingFields).toEqual([]);
  });

  it('stops the active flow when the user cancels', () => {
    const flow = evaluateCreationFlow({
      target: 'offering_listing',
      message: 'batal',
      locale: 'id',
    });

    expect(flow.status).toBe('cancelled');
  });

  it('sanitizes persisted flow metadata', () => {
    const flow = readCreationFlowMetadata({
      target: 'offering_listing',
      status: 'ready',
      collected: { subject: 'Kopi arabika' },
      completeness: 140,
      submitted: true,
      media: [{ kind: 'image', url: '/media/coffee.jpg' }],
    });

    expect(flow?.completeness).toBe(100);
    expect(flow?.collected.subject).toBe('Kopi arabika');
  });
});
