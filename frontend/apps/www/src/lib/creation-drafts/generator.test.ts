import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import type { GeneratedCreationDraft } from './generator';

let generateCreationDraft: (
  input: Parameters<(typeof import('./generator'))['generateCreationDraft']>[0],
) => Promise<GeneratedCreationDraft>;

beforeAll(async () => {
  vi.stubEnv('USE_OLLAMA', 'false');
  vi.resetModules();
  ({ generateCreationDraft } = await import('./generator'));
});

afterAll(() => {
  vi.unstubAllEnvs();
});

describe('structured creation draft generation', () => {
  it('uses the explicit product name instead of an assistant heading', async () => {
    const draft = await generateCreationDraft({
      target: 'offering_listing',
      instruction: [
        'Data penawaran dari user',
        'Nama produk / jasa: Keripik pisang madu',
        'Keunggulan / kondisi: Renyah dan dibuat harian',
        'Harga: Rp18.000',
        'Lokasi / area layanan: Bandung Timur',
      ].join('\n'),
      assistantContext: '**Ringkasan**\n- Informasi inti sudah lengkap.',
      media: [],
      locale: 'id',
    });

    expect(draft.title).toBe('Keripik pisang madu');
    expect(draft.payload.target).toBe('offering_listing');
    if (draft.payload.target === 'offering_listing') {
      expect(draft.payload.price).toBe(18_000);
      expect(draft.payload.locationText).toBe('Bandung Timur');
    }
  });

  it('reads request quantity from a labeled answer', async () => {
    const draft = await generateCreationDraft({
      target: 'looking_for_listing',
      instruction: [
        'Barang / jasa yang dibutuhkan: Botol PET 250 ml',
        'Jumlah: 2.000 pcs',
        'Spesifikasi / kriteria: Tutup ulir dan food grade',
      ].join('\n'),
      assistantContext: '',
      media: [],
      locale: 'id',
    });

    expect(draft.title).toBe('Botol PET 250 ml');
    if (draft.payload.target === 'looking_for_listing') {
      expect(draft.payload.quantity).toBe(2_000);
      expect(draft.payload.unit).toBe('pcs');
    }
  });

  it('uses an explicit business name for a profile draft', async () => {
    const draft = await generateCreationDraft({
      target: 'business_profile',
      instruction: [
        'Nama usaha: Dapur Nusa',
        'Produk / jasa utama: Katering makan siang',
        'Alamat / area usaha: Antapani, Bandung',
      ].join('\n'),
      assistantContext: 'Profil usaha sudah siap dirangkum.',
      media: [],
      locale: 'id',
    });

    expect(draft.title).toBe('Dapur Nusa');
    if (draft.payload.target === 'business_profile') {
      expect(draft.payload.businessName).toBe('Dapur Nusa');
      expect(draft.payload.locationText).toBe('Antapani, Bandung');
    }
  });
});
