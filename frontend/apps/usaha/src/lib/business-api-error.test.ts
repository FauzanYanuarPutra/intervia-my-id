import { describe, expect, it } from 'vitest';
import { normalizeBusinessApiError } from './business-api-error';

describe('business API error normalization', () => {
  it('preserves retryable upstream status and a safe user message', () => {
    expect(normalizeBusinessApiError({
      name: 'UpstreamHttpError',
      status: 503,
      code: 'identity_unavailable',
    }, 'Gagal menyimpan usaha.')).toEqual({
      status: 503,
      code: 'identity_unavailable',
      message: 'Layanan akun sedang tidak tersedia. Coba lagi sebentar.',
    });
  });

  it('turns optimistic concurrency failures into an actionable conflict', () => {
    expect(normalizeBusinessApiError({
      name: 'UpstreamHttpError',
      status: 409,
      code: 'business_version_conflict',
    }, 'Gagal menyimpan usaha.')).toEqual({
      status: 409,
      code: 'business_version_conflict',
      message: 'Data usaha sudah berubah. Muat ulang lalu simpan kembali.',
    });
  });

  it('maps a missing session to authentication required', () => {
    expect(normalizeBusinessApiError(new Error('AUTH_REQUIRED'), 'Gagal menyimpan usaha.')).toEqual({
      status: 401,
      code: 'auth_required',
      message: 'Sesi Anda berakhir. Masuk lagi untuk melanjutkan.',
    });
  });

  it('turns product validation codes into field-specific guidance', () => {
    expect(normalizeBusinessApiError({
      name: 'UpstreamHttpError',
      status: 400,
      code: 'invalid_product_stock_count',
    }, 'Gagal tambah produk.')).toEqual({
      status: 400,
      code: 'invalid_product_stock_count',
      message: 'Jumlah stok harus berupa angka nol atau lebih.',
    });
  });
});
