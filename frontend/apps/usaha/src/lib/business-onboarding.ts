import type { BusinessTemplateKey } from './business-templates';

export const beginnerBusinessTypeOptions: Array<{
  key: BusinessTemplateKey;
  label: string;
  description: string;
}> = [
  { key: 'juice_fnb', label: 'Makanan & Minuman', description: 'Untuk minuman, makanan, kedai, warung, dan usaha sejenis.' },
  { key: 'laundry', label: 'Laundry', description: 'Untuk cucian kiloan/satuan dan layanan antar-jemput.' },
  { key: 'ac_field_service', label: 'Servis & Jasa Lapangan', description: 'Untuk servis AC, teknisi, perbaikan, dan pekerjaan ke lokasi pelanggan.' },
  { key: 'mart_retail', label: 'Toko & Retail', description: 'Untuk toko, minimarket, kios, dan penjualan barang.' },
  { key: 'general', label: 'Usaha Lainnya', description: 'Untuk usaha lain yang ingin dimulai dengan pengaturan sederhana.' },
];

const steps = {
  1: { step: 1 as const, label: 'Jenis usaha' },
  2: { step: 2 as const, label: 'Info usaha' },
  3: { step: 3 as const, label: 'Lokasi' },
};

export function onboardingStepState(step: number) {
  if (step !== 1 && step !== 2 && step !== 3) throw new Error('invalid_onboarding_step');
  return steps[step];
}
