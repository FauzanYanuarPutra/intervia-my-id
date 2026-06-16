/**
 * Map API error messages to user-friendly messages (for register, login, OTP).
 * Handles human-facing copy and common backend responses.
 */
export function mapCommonAuthError(apiError: string | undefined, status?: number): string {
  if (!apiError) return 'Something went wrong. Please try again.';
  const lower = apiError.toLowerCase();

  // Duplicate / already exists
  if (
    lower.includes('phone number already registered') ||
    lower.includes('phone already registered')
  ) {
    return 'Nomor HP ini sudah terdaftar. Masuk saja pakai OTP. Kalau baru saja daftar lalu kena error, akun kemungkinan sudah jadi.';
  }
  if (
    status === 409 ||
    lower.includes('email already registered') ||
    lower.includes('username already registered') ||
    lower.includes('already exists') ||
    lower.includes('duplicate')
  ) {
    return 'Username atau data ini sudah terdaftar. Coba masuk, atau pakai username lain.';
  }

  // Validation
  if (status === 400) {
    if (lower.includes('email')) return 'Format email tidak valid.';
    if (lower.includes('phone')) return 'Nomor HP tidak valid.';
    if (lower.includes('uppercase')) return 'Password harus punya huruf besar.';
    if (lower.includes('lowercase')) return 'Password harus punya huruf kecil.';
    if (lower.includes('number')) return 'Password harus punya angka.';
    if (lower.includes('symbol')) return 'Password harus punya simbol.';
    if (lower.includes('spaces')) return 'Password tidak boleh mengandung spasi.';
    if (lower.includes('username or name')) {
      return 'Password jangan mengandung username, nama, atau nama usaha.';
    }
    if (lower.includes('too short') || lower.includes('least')) {
      return 'Password belum cukup panjang.';
    }
    if (lower.includes('invalid')) return 'Data tidak valid. Periksa kembali.';
  }

  // Unauthorized / invalid credentials
  if (
    lower.includes('invalid credential') ||
    lower.includes('wrong password')
  ) {
    return 'Username atau password tidak cocok. Demi keamanan, kami tidak kasih tahu bagian mana yang salah.';
  }
  if (lower.includes('account locked')) {
    return 'Akun dikunci sementara karena terlalu banyak percobaan gagal. Coba lagi beberapa menit lagi.';
  }
  if (lower.includes('account deactivated')) {
    return 'Akun ini sedang tidak aktif. Hubungi support kalau ini tidak sesuai.';
  }
  if (lower.includes('phone login is not available')) {
    return 'Nomor HP ini belum punya akun. Lanjut daftar saja.';
  }
  if (lower.includes('phone number is not verified for login')) {
    return 'Nomor HP ini belum terverifikasi untuk login. Ulangi OTP lalu coba lagi.';
  }
  if (lower.includes('phone number is linked to multiple accounts')) {
    return 'Nomor HP ini terhubung ke lebih dari satu akun. Rapikan data dulu atau hubungi support.';
  }
  if (lower.includes('phone otp verification is required')) {
    return 'Verifikasi OTP nomor HP dulu sebelum lanjut.';
  }
  if (
    lower.includes('invalid or expired phone login otp verification token') ||
    lower.includes('phone otp verification is invalid or expired')
  ) {
    return 'Sesi OTP nomor HP sudah kedaluwarsa. Kirim kode baru lalu coba lagi.';
  }
  if (lower.includes('current password is required')) {
    return 'Masukkan password lama dulu.';
  }
  if (lower.includes('current password is invalid')) {
    return 'Password lama tidak cocok.';
  }
  if (lower.includes('set a password first')) {
    return 'Buat password dulu di Settings sebelum lanjut ke langkah ini.';
  }
  if (lower.includes('password login is not available')) {
    return 'Akun ini belum punya password. Buat dulu di Settings kalau memang dibutuhkan.';
  }
  if (status === 401) {
    return 'Sesi atau kode masuk tidak valid. Coba lagi.';
  }

  // Rate limit / too many attempts
  if (status === 429 || lower.includes('too many') || lower.includes('try again later')) {
    return 'Terlalu banyak percobaan. Tunggu sebentar, lalu coba lagi.';
  }

  if (lower.includes('captcha')) {
    return 'Verifikasi keamanan belum lolos. Muat ulang captcha lalu coba lagi.';
  }

  // OTP
  if (lower.includes('invalid otp') || lower.includes('otp expired')) {
    return 'Kode OTP salah atau kedaluwarsa. Minta kode baru.';
  }
  if (lower.includes('registration service temporarily unavailable')) {
    return 'Pendaftaran sempat bermasalah. Kalau nomor ini sudah terdaftar, coba masuk pakai OTP yang sama atau kirim ulang kode.';
  }
  if (lower.includes('failed to send otp') || lower.includes('failed to send')) {
    return 'Gagal mengirim kode. Periksa email/nomor HP dan coba lagi.';
  }
  if (lower.includes('type and target are required')) {
    return 'Email atau nomor HP wajib diisi.';
  }

  // Service unavailable
  if (status === 503 || status === 502 || lower.includes('unavailable') || lower.includes('service')) {
    return 'Layanan sibuk. Silakan coba lagi dalam beberapa saat.';
  }

  // Network / generic
  if (lower.includes('network') || lower.includes('fetch')) {
    return 'Koneksi gagal. Periksa internet dan coba lagi.';
  }

  // Return original if we don't have a mapping (keep it short)
  return apiError.length > 80 ? apiError.slice(0, 77) + '...' : apiError;
}
