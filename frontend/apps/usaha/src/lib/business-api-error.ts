export type BusinessApiError = {
  status: number;
  code: string;
  message: string;
};

const messages: Record<string, string> = {
  auth_required: 'Sesi Anda berakhir. Masuk lagi untuk melanjutkan.',
  business_access_denied: 'Anda tidak memiliki akses untuk mengubah usaha ini.',
  business_not_found: 'Usaha tidak ditemukan atau sudah tidak tersedia.',
  business_version_conflict: 'Data usaha sudah berubah. Muat ulang lalu simpan kembali.',
  identity_unavailable: 'Layanan akun sedang tidak tersedia. Coba lagi sebentar.',
  provisioning_retryable: 'Layanan usaha sedang sibuk. Coba lagi sebentar.',
  invalid_product_name: 'Nama produk minimal dua karakter.',
  invalid_product_category: 'Pilih kategori produk yang valid.',
  invalid_product_price_label: 'Isi harga produk.',
  invalid_product_status: 'Status produk tidak valid.',
  invalid_product_owner_label: 'Nama penitip atau supplier terlalu panjang.',
  invalid_product_stock_count: 'Jumlah stok harus berupa angka nol atau lebih.',
  invalid_product_stock_unit: 'Isi satuan stok, misalnya pcs atau botol.',
  invalid_product_min_stock_alert: 'Batas stok tipis harus berupa angka nol atau lebih.',
  invalid_product_consignment_terms: 'Skema titip jual terlalu panjang.',
  invalid_product_notes: 'Catatan produk terlalu panjang.',
  invalid_inventory_reason: 'Alasan perubahan stok terlalu panjang.',
  empty_product_update: 'Tidak ada perubahan produk untuk disimpan.',
  missing_idempotency_key: 'Permintaan belum lengkap. Muat ulang halaman lalu coba lagi.',
  inventory_insufficient_stock: 'Stok tidak cukup untuk perubahan ini.',
  sale_inventory_insufficient: 'Stok produk tidak cukup untuk jumlah ini.',
  sale_discount_exceeds_line_total: 'Diskon tidak boleh melebihi subtotal produk.',
  ingredient_in_active_recipe: 'Bahan masih dipakai resep aktif. Lepaskan dari resep sebelum mengarsipkan.',
  business_ingredient_permission_denied: 'Peran Anda tidak memiliki izin mengubah bahan atau stok.',
  invalid_obligation_payment: 'Data pembayaran tagihan belum lengkap.',
  invalid_cash_shift: 'Shift kas tidak valid atau sudah berubah.',
  invalid_product_id: 'Produk yang dipilih tidak valid.',
  primary_location_required: 'Usaha harus memiliki minimal satu lokasi utama.',
  business_control_request_failed: 'Data operasional belum dapat diproses. Coba lagi.',
  business_wave2_request_failed: 'Kontrol usaha belum dapat diproses. Coba lagi.',
  finance_core_request_failed: 'Transaksi keuangan belum dapat diproses. Coba lagi.',
  invalid_json_response: 'Respons layanan tidak valid. Coba lagi.',
  invalid_sale_response: 'Respons transaksi tidak valid. Coba lagi.',
  invalid_finance_summary_response: 'Ringkasan keuangan belum dapat dibaca. Coba lagi.',
  business_wave2_resource_not_found: 'Data operasional tidak ditemukan atau sudah berubah. Muat ulang halaman.',
  business_wave2_conflict: 'Aksi ini bentrok dengan kondisi terbaru. Muat ulang halaman lalu coba lagi.',
  business_wave2_storage_unavailable: 'Penyimpanan kontrol usaha sedang tidak tersedia. Coba lagi sebentar.',
  invalid_opening_cash: 'Kas awal harus nol atau lebih.',
  invalid_actual_cash: 'Uang fisik harus nol atau lebih.',
  cash_shift_note_too_long: 'Catatan shift kas terlalu panjang.',
  cash_shift_amount_overflow: 'Nilai kas terlalu besar untuk diproses.',
  invalid_primary_material_yield: 'Perkiraan bahan utama dan hasil harus lebih dari nol.',
  invalid_purchase: 'Data belanja belum lengkap atau tidak valid.',
  invalid_yield_observation: 'Data hasil nyata belum lengkap atau tidak valid.',
  invalid_finance_account: 'Akun pembayaran tidak valid.',
  invalid_finance_allocation: 'Pembagian uang tidak valid.',
  finance_allocation_exceeds_100_percent: 'Total target pembagian uang tidak boleh melebihi 100%.',
  invalid_obligation: 'Data tagihan belum lengkap atau tidak valid.',
  invalid_obligation_entry_type: 'Kategori tagihan tidak valid.',
  obligation_must_be_expense: 'Tagihan rutin harus menggunakan kategori pengeluaran.',
  obligation_due_overflow: 'Jadwal tagihan terlalu jauh untuk diproses.',
};

function errorRecord(error: unknown): Record<string, unknown> | null {
  return error && typeof error === 'object'
    ? error as Record<string, unknown>
    : null;
}

function looksLikeErrorCode(value: string) {
  return /^[a-z0-9]+(?:_[a-z0-9]+)+$/.test(value);
}

export function businessApiErrorMessage(
  payload: unknown,
  fallbackMessage: string,
  status = 400,
) {
  const value = errorRecord(payload);
  const rawError = typeof value?.error === 'string' ? value.error.trim() : '';
  const rawMessage = typeof value?.message === 'string' ? value.message.trim() : '';
  const explicitCode = typeof value?.code === 'string' ? value.code.trim() : '';
  const inferredCode = looksLikeErrorCode(rawError) ? rawError : '';
  const code = explicitCode || inferredCode;
  const safeStatus = status >= 400 && status <= 599 ? status : 500;

  if (code && messages[code]) return messages[code];
  if (safeStatus === 401) return messages.auth_required;
  if (safeStatus === 403) return 'Anda tidak memiliki izin untuk tindakan ini.';
  if (safeStatus >= 500) return 'Layanan sedang bermasalah. Coba lagi sebentar.';

  if (rawError && !looksLikeErrorCode(rawError)) return rawError;
  if (rawMessage && !looksLikeErrorCode(rawMessage)) return rawMessage;
  return fallbackMessage;
}

export function normalizeBusinessApiError(
  error: unknown,
  fallbackMessage: string,
): BusinessApiError {
  if (error instanceof Error && error.message === 'AUTH_REQUIRED') {
    return {
      status: 401,
      code: 'auth_required',
      message: messages.auth_required,
    };
  }

  const value = errorRecord(error);
  const status = typeof value?.status === 'number' ? value.status : 400;
  const rawCode = typeof value?.code === 'string' ? value.code : '';
  const code = rawCode || (status === 401 ? 'auth_required' : 'business_request_failed');
  const safeStatus = status >= 400 && status <= 599 ? status : 500;
  const defaultMessage = safeStatus >= 500
    ? 'Layanan sedang bermasalah. Coba lagi sebentar.'
    : fallbackMessage;

  return {
    status: safeStatus,
    code,
    message: messages[code] ?? defaultMessage,
  };
}
