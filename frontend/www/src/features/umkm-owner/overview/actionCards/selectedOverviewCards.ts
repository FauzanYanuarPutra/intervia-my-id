import type {
  OverviewActionCard,
  OverviewIcons,
  OverviewRoutes,
  OverviewStore,
} from '../types';

type SelectedCardInput = {
  icons: OverviewIcons;
  isId: boolean;
  routes: OverviewRoutes;
  selected: OverviewStore;
};

export function buildSelectedOverviewCards({
  icons,
  isId,
  routes,
  selected,
}: SelectedCardInput): OverviewActionCard[] {
  return [
    {
      desc: isId
        ? `${selected.name} sedang jadi fokus kerja. Ganti fokus dari daftar usaha.`
        : `${selected.name} is the current focus. Switch from your business list.`,
      href: routes.setup('list', selected.id),
      icon: icons.switchBusiness,
      label: isId ? 'Pilih usaha' : 'Choose business',
      primary: true,
    },
    {
      desc: isId
        ? 'Lengkapi info inti, alamat, dan kontak.'
        : 'Complete the core info, address, and contact.',
      href: routes.setup('detail', selected.id),
      icon: icons.profile,
      label: isId ? 'Profil usaha' : 'Business profile',
    },
    {
      desc: isId
        ? 'Tambah jualan, harga, dan foto.'
        : 'Add products, pricing, and photos.',
      href: routes.workspace('catalog', selected.id),
      icon: icons.catalog,
      label: isId ? 'Katalog' : 'Catalog',
    },
    {
      desc: isId
        ? 'Atur jam, area, booking, dan kerja harian.'
        : 'Set hours, area, bookings, and daily work.',
      href: routes.workspace('operations', selected.id),
      icon: icons.operations,
      label: isId ? 'Operasional' : 'Operations',
    },
    {
      desc: isId
        ? 'Buat cabang, brand, atau usaha lain dalam akun yang sama.'
        : 'Create another branch, brand, or business in the same account.',
      href: routes.setup('create'),
      icon: icons.addBusiness,
      label: isId ? 'Tambah usaha' : 'Add business',
    },
  ];
}
