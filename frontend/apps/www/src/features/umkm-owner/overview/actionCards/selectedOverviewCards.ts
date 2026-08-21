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
        ? `${selected.name} aktif.`
        : `${selected.name} is active.`,
      href: routes.setup('list', selected.id),
      icon: icons.switchBusiness,
      label: isId ? 'Pilih usaha' : 'Choose business',
      primary: true,
    },
    {
      desc: isId
        ? 'Nama, foto, alamat, kontak.'
        : 'Name, photo, address, contact.',
      href: routes.setup('detail', selected.id),
      icon: icons.profile,
      label: isId ? 'Profil usaha' : 'Business profile',
    },
    {
      desc: isId
        ? 'Produk, harga, foto.'
        : 'Products, prices, photos.',
      href: routes.workspace('catalog', selected.id),
      icon: icons.catalog,
      label: isId ? 'Katalog' : 'Catalog',
    },
    {
      desc: isId
        ? 'Jam, area, booking.'
        : 'Hours, area, bookings.',
      href: routes.workspace('operations', selected.id),
      icon: icons.operations,
      label: isId ? 'Operasional' : 'Operations',
    },
    {
      desc: isId
        ? 'Buat usaha lain.'
        : 'Create another business.',
      href: routes.setup('create'),
      icon: icons.addBusiness,
      label: isId ? 'Tambah usaha' : 'Add business',
    },
  ];
}
