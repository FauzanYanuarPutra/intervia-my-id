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
};

function errorRecord(error: unknown): Record<string, unknown> | null {
  return error && typeof error === 'object'
    ? error as Record<string, unknown>
    : null;
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
