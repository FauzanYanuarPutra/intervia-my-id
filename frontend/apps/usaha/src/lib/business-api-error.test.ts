import { describe, expect, it } from 'vitest';
import { businessApiErrorMessage, normalizeBusinessApiError } from './business-api-error';

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

  it('turns raw client error codes into human guidance', () => {
    expect(businessApiErrorMessage(
      { error: 'inventory_insufficient_stock' },
      'Gagal mengubah stok.',
      409,
    )).toBe('Stok tidak cukup untuk perubahan ini.');
  });

  it('never leaks an unknown snake-case backend code to the user', () => {
    expect(businessApiErrorMessage(
      { error: 'some_internal_backend_code' },
      'Operasi belum berhasil.',
      400,
    )).toBe('Operasi belum berhasil.');
  });

  it('maps operational conflict codes to a recovery action', () => {
    expect(businessApiErrorMessage(
      { error: 'business_wave2_conflict' },
      'Operasi belum berhasil.',
      409,
    )).toBe('Aksi ini bentrok dengan kondisi terbaru. Muat ulang halaman lalu coba lagi.');
  });

  it('uses a safe generic message for server failures', () => {
    expect(businessApiErrorMessage(
      { error: 'database_pool_failed' },
      'Operasi belum berhasil.',
      503,
    )).toBe('Layanan sedang bermasalah. Coba lagi sebentar.');
  });
});
