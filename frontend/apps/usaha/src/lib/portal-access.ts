import type {
  PermissionId,
  PortalRole,
  RoleSummary,
} from '@/lib/portal-types';

export const permissionMap: Record<PortalRole, PermissionId[]> = {
  owner: [
    'viewInfo',
    'manageInfo',
    'viewProducts',
    'manageProducts',
    'viewOrders',
    'manageOrders',
    'viewOperations',
    'manageOperations',
    'viewTeam',
    'inviteMembers',
    'manageRoles',
    'viewBuyerPage',
    'openBusiness',
    'manageSecurity',
  ],
  manager: [
    'viewInfo',
    'manageInfo',
    'viewProducts',
    'manageProducts',
    'viewOrders',
    'manageOrders',
    'viewOperations',
    'manageOperations',
    'viewTeam',
    'inviteMembers',
    'viewBuyerPage',
    'openBusiness',
  ],
  cashier: [
    'viewProducts',
    'viewOrders',
    'manageOrders',
    'viewOperations',
    'manageOperations',
    'viewBuyerPage',
  ],
  viewer: [
    'viewInfo',
    'viewProducts',
    'viewOrders',
    'viewOperations',
    'viewBuyerPage',
  ],
};

export const roleSummaryMap: Record<PortalRole, RoleSummary> = {
  owner: {
    label: 'Owner',
    shortLabel: 'Pemilik penuh',
    description:
      'Pegang keputusan sensitif usaha: info utama, produk, operasional, tim, dan pengamanan akun usaha.',
    can: [
      'Ubah info usaha',
      'Tambah atau ubah produk',
      'Buka dan tutup usaha',
      'Undang anggota serta atur jabatan',
      'Aktifkan PIN usaha dan audit log',
    ],
    cannot: [],
  },
  manager: {
    label: 'Manager',
    shortLabel: 'Pengelola harian',
    description:
      'Fokus pada ritme usaha harian: produk, pesanan, operasional, dan koordinasi tim tanpa akses kepemilikan penuh.',
    can: [
      'Lihat dan proses pesanan',
      'Atur produk dan stok',
      'Atur operasional harian',
      'Lihat tim dan kirim undangan',
    ],
    cannot: ['Pindah kepemilikan usaha', 'Atur akses sensitif'],
  },
  cashier: {
    label: 'Kasir',
    shortLabel: 'Transaksi & lapangan',
    description:
      'Cocok untuk anggota yang memegang pesanan, meja, pembayaran, dan ritme operasional di lapangan.',
    can: [
      'Lihat pesanan',
      'Proses pesanan',
      'Kelola meja dan QR',
      'Cek reservasi',
    ],
    cannot: ['Ubah info usaha', 'Atur tim', 'Atur pengamanan sensitif'],
  },
  viewer: {
    label: 'Viewer',
    shortLabel: 'Akses baca saja',
    description:
      'Cocok untuk partner, auditor, atau pihak pemantau yang hanya perlu melihat ringkasan tanpa mengubah data.',
    can: ['Lihat ringkasan usaha', 'Pantau produk dan status order'],
    cannot: ['Tambah produk', 'Atur operasional', 'Undang anggota'],
  },
};
