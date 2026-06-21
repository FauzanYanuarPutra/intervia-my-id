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
  if (count > 0) return isId ? 'Usaha kamu' : 'Your businesses';
  return isId ? 'Buat usaha' : 'Create business';
}

export function getOverviewSubtitle(count: number, isId: boolean): string {
  if (count > 0) {
    return isId
      ? 'Pilih usaha, lalu lanjut kerja.'
      : 'Pick a business, then continue.';
  }

  return isId
    ? 'Isi profil singkat. Detail bisa nanti.'
    : 'Fill a short profile. Details can wait.';
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
        ? 'Aksi untuk usaha ini.'
        : 'Actions for this business.'),
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
