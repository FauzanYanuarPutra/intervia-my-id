import type { OverviewNextAction, OverviewStore } from './types';

export type OverviewStepCopy = {
  label?: string;
  desc?: string;
};

export function formatOverviewLocation(
  store: OverviewStore,
  isId: boolean,
): string {
  const location = [store.city, store.address].filter(Boolean).join(' - ');
  return location || (isId ? 'Belum ada lokasi' : 'No location yet');
}

export function formatBusinessCountLabel(count: number, isId: boolean): string {
  if (count === 0) return isId ? 'Belum ada usaha' : 'No business';
  if (isId) return `${count} usaha`;
  return `${count} ${count === 1 ? 'business' : 'businesses'}`;
}

export function getOverviewTitle(count: number, isId: boolean): string {
  if (count > 0) return isId ? 'Kelola semua usaha' : 'Manage all businesses';
  return isId ? 'Buat usaha pertama' : 'Create the first business';
}

export function getOverviewSubtitle(count: number, isId: boolean): string {
  if (count > 0) {
    return isId
      ? `Kamu punya ${count} usaha. Pilih satu sebagai fokus kerja sekarang, atau tambah usaha baru kapan saja.`
      : `You have ${count} businesses. Pick one as the current work focus, or add another anytime.`;
  }

  return isId
    ? 'Belum ada usaha. Buat usaha pertama dulu, nanti bisa tambah usaha lain lagi.'
    : 'No business yet. Create the first one first; you can add more later.';
}

export function getOverviewNextAction(
  selectedStore: OverviewStore | null | undefined,
  isId: boolean,
  nextOwnerStep?: OverviewStepCopy | null,
): OverviewNextAction | undefined {
  if (!selectedStore) return undefined;

  return {
    badge: isId ? 'Usaha dipilih' : 'Selected business',
    desc:
      nextOwnerStep?.desc ||
      (isId
        ? 'Aksi di bawah hanya untuk usaha yang sedang dipilih. Usaha lain tetap ada di daftar.'
        : 'Actions below only affect the selected business. Other businesses remain in your list.'),
    title:
      nextOwnerStep?.label ||
      (isId
        ? `Lanjutkan ${selectedStore.name}`
        : `Continue ${selectedStore.name}`),
  };
}

export function getPrimaryActionLabel({
  hasSelectedStore,
  isId,
  storeCount,
}: {
  hasSelectedStore: boolean;
  isId: boolean;
  storeCount: number;
}): string {
  if (hasSelectedStore)
    return isId ? 'Buka usaha dipilih' : 'Open selected business';
  if (storeCount > 0) return isId ? 'Pilih usaha' : 'Choose business';
  return isId ? 'Buat usaha' : 'Add business';
}
