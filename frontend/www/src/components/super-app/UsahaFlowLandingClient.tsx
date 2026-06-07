'use client';

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  CircleAlert,
  ClipboardList,
  LayoutDashboard,
  Loader2,
  MapPinned,
  PackagePlus,
  QrCode,
  Search,
  Settings2,
  Sparkles,
  Store,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import {
  derivePublishServices,
  readBusinessCategory,
  type CollectionResponse,
  type OrderRecord,
  type ProductRecord,
  type ReservationRecord,
  type StoreRecord,
  type StoresResponse,
  type TableRecord,
  type TeamMemberRecord,
} from '@/components/super-app/manage/UmkmManageHelpers';
import {
  parseCapabilityList,
  supportsDineIn,
  supportsReservations,
} from '@/lib/super-app/umkm-manage-profiles';
import {
  UMKM_ACTIVE_STORE_STORAGE_KEY,
  UMKM_DISCOVERY_PATH,
  buildUmkmStorefrontPath,
  buildUsahaPath,
} from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';

type UsahaFlowLandingClientProps = {
  locale: string;
  isId: boolean;
};

type StoreSnapshot = {
  productsCount: number;
  tablesCount: number;
  ordersTotal: number;
  ordersActive: number;
  reservationsTotal: number;
  reservationsActive: number;
  teamTotal: number;
  teamInvited: number;
};

type Tone = 'primary' | 'success' | 'warning' | 'default';

type StoreStatus = {
  tone: Tone;
  label: string;
  desc: string;
};

type WorkflowAction = {
  id: string;
  step: string;
  title: string;
  desc: string;
  href: string;
  label: string;
  metric: string;
  done: boolean;
  tone: Tone;
  icon: LucideIcon;
};

type WorkspaceShortcut = {
  id: string;
  title: string;
  desc: string;
  href: string;
  badge: string;
  tone: Tone;
  icon: LucideIcon;
};

function normalizeText(value: string | null | undefined): string {
  return String(value || '').trim();
}

function countFilled(values: Array<string | null | undefined>): number {
  return values.filter(value => normalizeText(value).length > 0).length;
}

function readMetaBool(meta: Record<string, unknown>, key: string): boolean {
  return meta[key] === true;
}

function getProfileCompletionCount(store: StoreRecord): number {
  return countFilled([
    store.name,
    store.city,
    store.address,
    store.phone,
    store.description,
  ]);
}

function hasCoreProfile(store: StoreRecord): boolean {
  return (
    normalizeText(store.name).length > 0 &&
    normalizeText(store.city).length > 0 &&
    normalizeText(store.address).length > 0 &&
    normalizeText(store.phone).length > 0
  );
}

function isStoreLive(store: StoreRecord): boolean {
  const meta = store.metadata || {};
  if (meta.outlet_active === false) return false;
  return readMetaBool(meta, 'live_now') || readMetaBool(meta, 'outlet_active');
}

function isStoreReady(store: StoreRecord): boolean {
  return hasCoreProfile(store) && derivePublishServices(store.metadata || {}).length > 0;
}

function getPublishServiceLabel(store: StoreRecord, isId: boolean): string {
  const services = derivePublishServices(store.metadata || {});
  if (services.length === 0) {
    return isId ? 'Channel belum aktif' : 'No sales channel yet';
  }

  return services
    .map(service => (service === 'food' ? 'Food' : service === 'mart' ? 'Mart' : service))
    .join(' + ');
}

function getStoreCapabilities(store: StoreRecord) {
  const meta = store.metadata || {};
  return parseCapabilityList(
    meta.business_capabilities ??
    meta.business_capability ??
    meta.capabilities ??
    meta.capability_list,
    readBusinessCategory(meta) ?? undefined,
  );
}

function getStoreStatus(
  store: StoreRecord,
  snapshot: StoreSnapshot | null,
  isId: boolean,
): StoreStatus {
  if (!hasCoreProfile(store)) {
    return {
      tone: 'warning',
      label: isId ? 'Butuh setup dasar' : 'Needs basic setup',
      desc: isId
        ? 'Alamat, kontak, atau ringkasan usaha masih belum lengkap.'
        : 'Address, contact, or business summary is still incomplete.',
    };
  }

  if (derivePublishServices(store.metadata || {}).length === 0) {
    return {
      tone: 'warning',
      label: isId ? 'Pilih channel jualan' : 'Choose a sales channel',
      desc: isId
        ? 'Aktifkan Food/Mart biar alur jualan jelas.'
        : 'Enable Food or Mart so the selling flow is ready.',
    };
  }

  if (snapshot && snapshot.productsCount === 0) {
    return {
      tone: 'primary',
      label: isId ? 'Isi katalog dulu' : 'Fill the catalog first',
      desc: isId
        ? 'Produk atau menu pertama belum dimasukkan.'
        : 'The first product or menu has not been added yet.',
    };
  }

  if (!isStoreLive(store)) {
    return {
      tone: 'default',
      label: isId ? 'Siap diluncurkan' : 'Ready to launch',
      desc: isId
        ? 'Fondasi utama sudah rapi. Tinggal aktifkan outlet dan operasional.'
        : 'The core setup is tidy. Enable the outlet and operations next.',
    };
  }

  return snapshot && (snapshot.ordersActive > 0 || snapshot.reservationsActive > 0)
    ? {
      tone: 'success',
      label: isId ? 'Sedang berjalan' : 'Running now',
      desc: isId
        ? 'Sudah ada aktivitas masuk. Fokus ke pesanan dan operasional harian.'
        : 'There is already activity. Focus on orders and daily operations.',
    }
    : {
      tone: 'success',
      label: isId ? 'Siap operasional' : 'Operationally ready',
      desc: isId
        ? 'Flow inti sudah terpasang. Tinggal jaga ritme katalog, order, dan tim.'
        : 'The core flow is in place. Keep the catalog, orders, and team moving.',
    };
}

function toneBadgeClass(tone: Tone): string {
  if (tone === 'primary') {
    return 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]';
  }
  if (tone === 'success') {
    return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200';
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200';
  }
  return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200';
}

function tonePanelClass(tone: Tone): string {
  if (tone === 'primary') {
    return 'border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(255,250,245,0.98),rgba(255,255,255,1))] dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(15,23,42,0.98))]';
  }
  if (tone === 'success') {
    return 'border-emerald-200 bg-[linear-gradient(180deg,rgba(236,253,245,0.9),rgba(255,255,255,1))] dark:border-emerald-900/70 dark:bg-[linear-gradient(180deg,rgba(6,78,59,0.2),rgba(2,6,23,0.98))]';
  }
  if (tone === 'warning') {
    return 'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.9),rgba(255,255,255,1))] dark:border-amber-900/70 dark:bg-[linear-gradient(180deg,rgba(120,53,15,0.18),rgba(2,6,23,0.98))]';
  }
  return 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950';
}

function SummaryMetricCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint: string;
}) {
  return (
    <div className="rounded-[20px] border border-slate-200 bg-white/92 px-4 py-3 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.34)] dark:border-slate-800 dark:bg-slate-950/84">
      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
        {label}
      </p>
      <p className="mt-1 text-[1.3rem] font-black leading-none text-[color:var(--app-text)]">
        {value}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
        {hint}
      </p>
    </div>
  );
}

function WorkflowCard({ action }: { action: WorkflowAction }) {
  const Icon = action.icon;

  return (
    <article
      className={cn(
        'rounded-[22px] border p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.16)]',
        tonePanelClass(action.tone),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
            {action.step}
          </p>
          <h3 className="mt-1 text-[1rem] font-black tracking-[-0.03em] text-[color:var(--app-text)]">
            {action.title}
          </h3>
        </div>
        <span
          className={cn(
            'inline-flex min-h-[28px] max-h-[28px] shrink-0 items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]',
            toneBadgeClass(action.done ? 'success' : action.tone),
          )}
        >
          {action.done ? 'Done' : action.metric}
        </span>
      </div>

      <p className="mt-2 text-[13px] leading-6 text-[color:var(--app-text-soft)]">
        {action.desc}
      </p>

      <div className="mt-4 flex items-center justify-between gap-3">
        <div className="inline-flex items-center gap-2 text-[12px] font-semibold text-[color:var(--app-text-soft)]">
          <span
            className={cn(
              'inline-flex h-10 w-10 items-center justify-center rounded-full border',
              toneBadgeClass(action.done ? 'success' : action.tone),
            )}
          >
            <Icon className="h-4 w-4" />
          </span>
          <span>{action.metric}</span>
        </div>
        <Link
          href={action.href}
          className={cn(
            'inline-flex min-h-[42px] items-center gap-2 rounded-full px-4 text-sm font-semibold',
            action.done ? 'ui-button-secondary' : 'ui-button-primary',
          )}
        >
          {action.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}

function ShortcutCard({ item }: { item: WorkspaceShortcut }) {
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      className={cn(
        'group rounded-[20px] border p-4 transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_18px_38px_-32px_rgba(15,23,42,0.22)]',
        tonePanelClass(item.tone),
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          className={cn(
            'inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border',
            toneBadgeClass(item.tone),
          )}
        >
          <Icon className="h-5 w-5" />
        </span>
        <span
          className={cn(
            'inline-flex min-h-[26px] items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]',
            toneBadgeClass(item.tone),
          )}
        >
          {item.badge}
        </span>
      </div>

      <h3 className="mt-4 text-[15px] font-black tracking-[-0.02em] text-[color:var(--app-text)]">
        {item.title}
      </h3>
      <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
        {item.desc}
      </p>

      <div className="mt-4 inline-flex items-center gap-2 text-[13px] font-semibold text-[color:var(--app-accent)]">
        <span>{item.title}</span>
        <ArrowRight className="h-4 w-4 transition duration-200 group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export function UsahaFlowLandingClient({
  locale,
  isId,
}: UsahaFlowLandingClientProps) {
  const { authFetch, isAuthenticated, loading: authLoading } = useAuth();

  const [stores, setStores] = useState<StoreRecord[]>([]);
  const [loadingStores, setLoadingStores] = useState(false);
  const [storesError, setStoresError] = useState<string | null>(null);
  const [selectedStoreId, setSelectedStoreId] = useState('');
  const [storeQuery, setStoreQuery] = useState('');
  const deferredStoreQuery = useDeferredValue(storeQuery);
  const [snapshotByStoreId, setSnapshotByStoreId] = useState<Record<string, StoreSnapshot>>({});
  const [snapshotLoadingStoreId, setSnapshotLoadingStoreId] = useState<string | null>(null);
  const [snapshotError, setSnapshotError] = useState<string | null>(null);

  const snapshotRequestRef = useRef(0);
  const loginHref = `/login?callbackUrl=${encodeURIComponent(
    buildUsahaPath('home'),
  )}`;

  const loadStores = useCallback(async () => {
    setLoadingStores(true);
    setStoresError(null);

    try {
      const response = await authFetch('/api/super-app/umkm/stores?mine=1&limit=60');
      const payload = (await response.json().catch(() => ({}))) as StoresResponse;

      if (!response.ok || !payload.data) {
        throw new Error(
          payload.error ||
          (isId ? 'Gagal memuat daftar usaha.' : 'Failed to load the business list.'),
        );
      }

      setStores(payload.data.items || []);
    } catch (error) {
      setStoresError(
        error instanceof Error
          ? error.message
          : isId
            ? 'Gagal memuat daftar usaha.'
            : 'Failed to load the business list.',
      );
      setStores([]);
    } finally {
      setLoadingStores(false);
    }
  }, [authFetch, isId]);

  const loadStoreSnapshot = useCallback(
    async (storeId: string) => {
      if (!storeId) return;

      const requestId = snapshotRequestRef.current + 1;
      snapshotRequestRef.current = requestId;
      setSnapshotLoadingStoreId(storeId);
      setSnapshotError(null);

      try {
        const [productsRes, tablesRes, ordersRes, reservationsRes, teamRes] = await Promise.all([
          authFetch(`/api/super-app/umkm/stores/${storeId}/products?include_unavailable=1&limit=500`),
          authFetch(`/api/super-app/umkm/stores/${storeId}/tables`),
          authFetch(`/api/super-app/umkm/orders?store_id=${encodeURIComponent(storeId)}&limit=200`),
          authFetch(`/api/super-app/umkm/reservations?store_id=${encodeURIComponent(storeId)}&limit=200`),
          authFetch(`/api/super-app/umkm/stores/${storeId}/team?limit=160`),
        ]);

        const [productsPayload, tablesPayload, ordersPayload, reservationsPayload, teamPayload] =
          await Promise.all([
            productsRes.json().catch(() => ({})),
            tablesRes.json().catch(() => ({})),
            ordersRes.json().catch(() => ({})),
            reservationsRes.json().catch(() => ({})),
            teamRes.json().catch(() => ({})),
          ]);

        if (snapshotRequestRef.current !== requestId) return;

        if (!productsRes.ok || !tablesRes.ok || !ordersRes.ok || !reservationsRes.ok || !teamRes.ok) {
          const firstError =
            (productsPayload as { error?: string }).error ||
            (tablesPayload as { error?: string }).error ||
            (ordersPayload as { error?: string }).error ||
            (reservationsPayload as { error?: string }).error ||
            (teamPayload as { error?: string }).error;

          throw new Error(
            firstError ||
            (isId
              ? 'Gagal memuat ringkasan operasional usaha.'
              : 'Failed to load the business operations summary.'),
          );
        }

        const products =
          ((productsPayload as CollectionResponse<ProductRecord>).data?.items || []);
        const tables = ((tablesPayload as CollectionResponse<TableRecord>).data?.items || []);
        const orders = ((ordersPayload as CollectionResponse<OrderRecord>).data?.items || []);
        const reservations =
          ((reservationsPayload as CollectionResponse<ReservationRecord>).data?.items || []);
        const team = ((teamPayload as CollectionResponse<TeamMemberRecord>).data?.items || []);

        setSnapshotByStoreId(current => ({
          ...current,
          [storeId]: {
            productsCount: products.length,
            tablesCount: tables.length,
            ordersTotal: orders.length,
            ordersActive: orders.filter(
              order => order.status !== 'paid' && order.status !== 'cancelled',
            ).length,
            reservationsTotal: reservations.length,
            reservationsActive: reservations.filter(
              reservation =>
                reservation.status === 'pending' ||
                reservation.status === 'confirmed' ||
                reservation.status === 'seated',
            ).length,
            teamTotal: team.length,
            teamInvited: team.filter(member => member.status === 'invited').length,
          },
        }));
      } catch (error) {
        if (snapshotRequestRef.current !== requestId) return;

        setSnapshotError(
          error instanceof Error
            ? error.message
            : isId
              ? 'Gagal memuat ringkasan operasional usaha.'
              : 'Failed to load the business operations summary.',
        );
      } finally {
        if (snapshotRequestRef.current === requestId) {
          setSnapshotLoadingStoreId(current => (current === storeId ? null : current));
        }
      }
    },
    [authFetch, isId],
  );

  useEffect(() => {
    if (authLoading) return;

    if (!isAuthenticated) {
      setStores([]);
      setStoresError(null);
      setSelectedStoreId('');
      setSnapshotByStoreId({});
      setSnapshotError(null);
      setSnapshotLoadingStoreId(null);
      return;
    }

    void loadStores();
  }, [authLoading, isAuthenticated, loadStores]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (stores.length === 0) {
      if (selectedStoreId) setSelectedStoreId('');
      return;
    }

    if (stores.some(store => store.id === selectedStoreId)) return;

    const savedStoreId =
      typeof window !== 'undefined'
        ? normalizeText(
          window.localStorage.getItem(UMKM_ACTIVE_STORE_STORAGE_KEY),
        )
        : '';
    const fallbackStoreId =
      (savedStoreId && stores.some(store => store.id === savedStoreId)
        ? savedStoreId
        : stores[0]?.id) || '';

    if (fallbackStoreId && fallbackStoreId !== selectedStoreId) {
      setSelectedStoreId(fallbackStoreId);
    }
  }, [isAuthenticated, selectedStoreId, stores]);

  useEffect(() => {
    if (!isAuthenticated) return;

    if (typeof window !== 'undefined') {
      if (selectedStoreId) {
        window.localStorage.setItem(
          UMKM_ACTIVE_STORE_STORAGE_KEY,
          selectedStoreId,
        );
      } else {
        window.localStorage.removeItem(UMKM_ACTIVE_STORE_STORAGE_KEY);
      }
    }
  }, [isAuthenticated, selectedStoreId]);

  useEffect(() => {
    if (!isAuthenticated || !selectedStoreId) return;
    void loadStoreSnapshot(selectedStoreId);
  }, [isAuthenticated, loadStoreSnapshot, selectedStoreId]);

  const selectedStore = useMemo(
    () => stores.find(store => store.id === selectedStoreId) || null,
    [selectedStoreId, stores],
  );
  const selectedSnapshot = selectedStoreId ? snapshotByStoreId[selectedStoreId] || null : null;
  const selectedSnapshotLoading = snapshotLoadingStoreId === selectedStoreId;

  const readyStores = useMemo(() => stores.filter(store => isStoreReady(store)).length, [stores]);
  const liveStores = useMemo(() => stores.filter(store => isStoreLive(store)).length, [stores]);
  const storesNeedingAttention = Math.max(0, stores.length - readyStores);

  const filteredStores = useMemo(() => {
    const query = normalizeText(deferredStoreQuery).toLowerCase();
    const base = [...stores].sort((left, right) => {
      if (left.id === selectedStoreId) return -1;
      if (right.id === selectedStoreId) return 1;

      const leftScore = (isStoreLive(left) ? 4 : 0) + (isStoreReady(left) ? 2 : 0);
      const rightScore = (isStoreLive(right) ? 4 : 0) + (isStoreReady(right) ? 2 : 0);
      return rightScore - leftScore;
    });

    if (!query) return base;

    return base.filter(store =>
      [store.name, store.city, store.address, store.description]
        .map(value => normalizeText(value).toLowerCase())
        .join(' ')
        .includes(query),
    );
  }, [deferredStoreQuery, selectedStoreId, stores]);

  const selectedStoreCapabilities = useMemo(
    () => (selectedStore ? getStoreCapabilities(selectedStore) : []),
    [selectedStore],
  );
  const selectedStoreSupportsDineIn = supportsDineIn(selectedStoreCapabilities);
  const selectedStoreSupportsReservations = supportsReservations(selectedStoreCapabilities);
  const selectedStoreStatus = selectedStore
    ? getStoreStatus(selectedStore, selectedSnapshot, isId)
    : null;
  const selectedStoreProfileCompletion = selectedStore
    ? getProfileCompletionCount(selectedStore)
    : 0;
  const selectedStorePublishLabel = selectedStore
    ? getPublishServiceLabel(selectedStore, isId)
    : '';

  const selectedStoreWorkflow = useMemo<WorkflowAction[]>(() => {
    if (!selectedStore) return [];

    const live = isStoreLive(selectedStore);
    const publishServices = derivePublishServices(selectedStore.metadata || {});
    const productsCount = selectedSnapshot?.productsCount ?? 0;
    const opsHref =
      live && (selectedStoreSupportsDineIn || selectedStoreSupportsReservations)
        ? buildUsahaPath('operations', { storeId: selectedStore.id })
        : live
          ? buildUsahaPath('order', { storeId: selectedStore.id })
          : buildUsahaPath('profile', {
            storeId: selectedStore.id,
            hash: 'umkm-verification',
          });

    return [
      {
        id: 'profile',
        step: isId ? 'Langkah 1' : 'Step 1',
        title: isId ? 'Rapikan identitas usaha' : 'Tidy the business identity',
        desc: isId
          ? 'Isi nama, kota, alamat, telepon, ringkasan.'
          : 'Complete the name, city, address, phone, and summary so the team has clean context.',
        href: buildUsahaPath('profile', {
          storeId: selectedStore.id,
          hash: 'umkm-store-basic',
        }),
        label: isId ? 'Buka profil dasar' : 'Open basic profile',
        metric: `${selectedStoreProfileCompletion}/5`,
        done: hasCoreProfile(selectedStore),
        tone: hasCoreProfile(selectedStore) ? 'success' : 'warning',
        icon: BookOpen,
      },
      {
        id: 'publish',
        step: isId ? 'Langkah 2' : 'Step 2',
        title: isId ? 'Aktifkan channel jualan' : 'Activate the sales channels',
        desc: isId
          ? 'Pilih Food atau Mart, cek verifikasi, lalu pastikan channel customer sudah tepat.'
          : 'Pick Food or Mart, review verification, and make sure the buyer-facing channel is correct.',
        href: buildUsahaPath('profile', {
          storeId: selectedStore.id,
          hash: 'umkm-verification',
        }),
        label: isId ? 'Buka channel & verifikasi' : 'Open channels and verification',
        metric:
          publishServices.length > 0
            ? selectedStorePublishLabel
            : isId
              ? 'Food / Mart belum aktif'
              : 'Food / Mart not active yet',
        done: publishServices.length > 0,
        tone: publishServices.length > 0 ? 'success' : 'warning',
        icon: Settings2,
      },
      {
        id: 'catalog',
        step: isId ? 'Langkah 3' : 'Step 3',
        title: isId ? 'Masukkan produk atau menu' : 'Add products or menus',
        desc: isId
          ? 'Katalog adalah jembatan ke order. Begitu item pertama masuk, flow beli jadi jelas.'
          : 'The catalog is the bridge into orders. Once the first item exists, the buying flow becomes clear.',
        href: buildUsahaPath('catalog', { storeId: selectedStore.id }),
        label: isId ? 'Buka katalog' : 'Open catalog',
        metric:
          selectedSnapshotLoading && !selectedSnapshot
            ? isId
              ? 'Memuat...'
              : 'Loading...'
            : `${productsCount} ${isId ? 'produk' : 'products'}`,
        done: productsCount > 0,
        tone: productsCount > 0 ? 'success' : 'primary',
        icon: PackagePlus,
      },
      {
        id: 'operations',
        step: isId ? 'Langkah 4' : 'Step 4',
        title: live
          ? isId
            ? 'Jaga ritme operasional harian'
            : 'Keep the daily operations moving'
          : isId
            ? 'Aktifkan outlet dan workflow harian'
            : 'Enable the outlet and daily workflow',
        desc: live
          ? selectedStoreSupportsReservations || selectedStoreSupportsDineIn
            ? isId
              ? 'Pantau meja, reservasi, QR, dan order dari satu workflow.'
              : 'Monitor tables, reservations, QR, and orders from one workflow.'
            : isId
              ? 'Pantau pesanan, pembayaran, QR, dan pembagian kerja tim.'
              : 'Monitor orders, payments, QR, and team coverage.'
          : isId
            ? 'Saat outlet aktif, tim bisa langsung lanjut ke pesanan dan operasional.'
            : 'Once the outlet is active, the team can continue directly into orders and operations.',
        href: opsHref,
        label: live
          ? selectedStoreSupportsReservations || selectedStoreSupportsDineIn
            ? isId
              ? 'Buka operasional'
              : 'Open operations'
            : isId
              ? 'Buka pesanan'
              : 'Open orders'
          : isId
            ? 'Aktifkan outlet'
            : 'Enable outlet',
        metric: live ? (isId ? 'Outlet aktif' : 'Outlet active') : isId ? 'Belum live' : 'Not live yet',
        done: live,
        tone: live ? 'success' : 'default',
        icon: live ? LayoutDashboard : Sparkles,
      },
    ];
  }, [
    isId,
    selectedSnapshot,
    selectedSnapshotLoading,
    selectedStore,
    selectedStoreProfileCompletion,
    selectedStorePublishLabel,
    selectedStoreSupportsDineIn,
    selectedStoreSupportsReservations,
  ]);

  const completedFlowSteps = selectedStoreWorkflow.filter(item => item.done).length;

  const nextAction = useMemo(() => {
    if (!selectedStore) return null;

    const pending = selectedStoreWorkflow.find(item => !item.done);
    if (pending) return { href: pending.href, label: pending.label };

    if ((selectedSnapshot?.ordersActive || 0) > 0) {
      return {
        href: buildUsahaPath('order', { storeId: selectedStore.id }),
        label: isId ? 'Lihat order aktif' : 'Review active orders',
      };
    }

    if ((selectedSnapshot?.reservationsActive || 0) > 0) {
      return {
        href: buildUsahaPath('operations', { storeId: selectedStore.id }),
        label: isId ? 'Cek reservasi aktif' : 'Check active reservations',
      };
    }

    if ((selectedSnapshot?.teamInvited || 0) > 0) {
      return {
        href: buildUsahaPath('team', { storeId: selectedStore.id }),
        label: isId ? 'Rapikan akses tim' : 'Review team access',
      };
    }

    return {
      href: buildUsahaPath('order', { storeId: selectedStore.id }),
      label: isId ? 'Buka workspace harian' : 'Open the daily workspace',
    };
  }, [isId, selectedSnapshot, selectedStore, selectedStoreWorkflow]);

  const workspaceShortcuts = useMemo<WorkspaceShortcut[]>(() => {
    if (!selectedStore) return [];

    const live = isStoreLive(selectedStore);
    const productsCount = selectedSnapshot?.productsCount ?? 0;
    const ordersActive = selectedSnapshot?.ordersActive ?? 0;
    const reservationsActive = selectedSnapshot?.reservationsActive ?? 0;
    const reservationsTotal = selectedSnapshot?.reservationsTotal ?? 0;
    const teamTotal = selectedSnapshot?.teamTotal ?? 0;
    const teamInvited = selectedSnapshot?.teamInvited ?? 0;
    const tablesCount = selectedSnapshot?.tablesCount ?? 0;

    return [
      {
        id: 'profile',
        title: isId ? 'Profil & setup' : 'Profile and setup',
        desc: isId ? 'Alamat, channel, verifikasi, dan fondasi usaha.' : 'Address, channels, verification, and business fundamentals.',
        href: buildUsahaPath('profile', { storeId: selectedStore.id }),
        badge: `${selectedStoreProfileCompletion}/5`,
        tone:
          hasCoreProfile(selectedStore) &&
            derivePublishServices(selectedStore.metadata || {}).length > 0
            ? 'success'
            : 'warning',
        icon: BookOpen,
      },
      {
        id: 'catalog',
        title: isId ? 'Katalog' : 'Catalog',
        desc: isId ? 'Produk, menu, stok, dan item yang dijual.' : 'Products, menus, stock, and items for sale.',
        href: buildUsahaPath('catalog', { storeId: selectedStore.id }),
        badge:
          selectedSnapshotLoading && !selectedSnapshot
            ? isId
              ? 'Memuat...'
              : 'Loading...'
            : `${productsCount} ${isId ? 'produk' : 'products'}`,
        tone: productsCount > 0 ? 'success' : 'primary',
        icon: PackagePlus,
      },
      {
        id: 'orders',
        title: isId ? 'Pesanan' : 'Orders',
        desc: isId ? 'Pantau order masuk, bill, dan pembayaran.' : 'Track incoming orders, bills, and payments.',
        href: buildUsahaPath('order', { storeId: selectedStore.id }),
        badge: `${ordersActive} ${isId ? 'aktif' : 'active'}`,
        tone: ordersActive > 0 ? 'primary' : live ? 'success' : 'default',
        icon: ClipboardList,
      },
      {
        id: 'operations',
        title: isId ? 'Operasional' : 'Operations',
        desc:
          selectedStoreSupportsReservations || selectedStoreSupportsDineIn
            ? isId
              ? 'Meja, QR, reservasi, dan alur outlet.'
              : 'Tables, QR, reservations, and the outlet flow.'
            : isId
              ? 'QR, alur lapangan, dan ritme operasional.'
              : 'QR, field workflow, and the operating rhythm.',
        href: buildUsahaPath('operations', { storeId: selectedStore.id }),
        badge:
          selectedStoreSupportsReservations || selectedStoreSupportsDineIn
            ? `${Math.max(reservationsActive, tablesCount)} ${isId ? 'aktif' : 'active'}`
            : live
              ? isId
                ? 'Outlet aktif'
                : 'Outlet active'
              : isId
                ? 'Belum live'
                : 'Not live',
        tone:
          reservationsActive > 0 || tablesCount > 0
            ? 'primary'
            : live
              ? 'success'
              : 'default',
        icon: Settings2,
      },
      {
        id: 'team',
        title: isId ? 'Tim' : 'Team',
        desc: isId ? 'Akses manager, kasir, stok, ops, dan finance.' : 'Access for managers, cashiers, stock, ops, and finance.',
        href: buildUsahaPath('team', { storeId: selectedStore.id }),
        badge: teamInvited > 0 ? `${teamInvited} ${isId ? 'undangan' : 'invites'}` : `${teamTotal} ${isId ? 'anggota' : 'members'}`,
        tone: teamInvited > 0 ? 'warning' : teamTotal > 0 ? 'success' : 'default',
        icon: Users,
      },
      {
        id: 'qr',
        title: isId ? 'QR & meja' : 'QR and tables',
        desc: isId ? 'Cek QR online/offline dan kesiapan area outlet.' : 'Review online/offline QR and outlet readiness.',
        href: buildUsahaPath('qr', { storeId: selectedStore.id }),
        badge:
          selectedStoreSupportsDineIn
            ? `${tablesCount} ${isId ? 'meja' : 'tables'}`
            : isId
              ? 'QR outlet'
              : 'Outlet QR',
        tone:
          selectedStoreSupportsDineIn && tablesCount === 0
            ? 'warning'
            : tablesCount > 0
              ? 'success'
              : 'default',
        icon: QrCode,
      },
      {
        id: 'storefront',
        title: isId ? 'Tampilan pembeli' : 'Buyer view',
        desc: isId ? 'Cek halaman toko seperti yang dilihat customer.' : 'Review the store page exactly as buyers see it.',
        href: buildUmkmStorefrontPath(selectedStore.slug),
        badge: reservationsTotal > 0 ? `${reservationsTotal} ${isId ? 'booking' : 'bookings'}` : selectedStorePublishLabel,
        tone: live ? 'success' : 'default',
        icon: Store,
      },
    ];
  }, [
    isId,
    selectedSnapshot,
    selectedSnapshotLoading,
    selectedStore,
    selectedStoreProfileCompletion,
    selectedStorePublishLabel,
    selectedStoreSupportsDineIn,
    selectedStoreSupportsReservations,
  ]);

  const utilityActions = useMemo(
    () => [
      {
        href: selectedStore ? buildUsahaPath('assistant', { storeId: selectedStore.id }) : buildUsahaPath('assistant'),
        title: isId ? 'Asisten setup' : 'Setup assistant',
        desc: isId ? 'Masuk ke flow setup yang lebih terarah untuk usaha aktif.' : 'Open the guided setup flow for the active business.',
        icon: Workflow,
      },
      {
        href: UMKM_DISCOVERY_PATH,
        title: isId ? 'Peta usaha' : 'Business map',
        desc: isId ? 'Lihat discovery dan konteks area sekitar.' : 'See discovery context and the surrounding area.',
        icon: MapPinned,
      },
    ],
    [isId, selectedStore],
  );

  return (
    <main className="page-shell overflow-x-hidden py-0 pb-10 sm:pb-0 sm:py-3">
      <div className="flex w-full flex-col gap-3 sm:mx-auto sm:max-w-[var(--app-max-width)] sm:gap-3.5">
        <section className="ui-page-section ui-home-section-shell px-2 sm:px-2.5 lg:px-3">
          <div className="ui-home-section-content">
            <div className="overflow-hidden rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(255,163,26,0.15),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.98))] p-4 shadow-[0_24px_48px_-34px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(249,115,22,0.12),transparent_30%),linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.98))] sm:p-5 lg:p-6">
              <div className="grid gap-4 xl:grid-cols-[minmax(0,1.25fr)_minmax(300px,0.75fr)]">
                <div>
                  <div className="inline-flex min-h-[30px] items-center rounded-full bg-[color:color-mix(in_srgb,var(--app-accent-soft)_72%,white)] px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                    {isId ? 'Control hub usaha' : 'Business control hub'}
                  </div>
                  <h1 className="mt-3 max-w-3xl text-[1.4rem] font-black leading-tight tracking-[-0.05em] text-[color:var(--app-text)] sm:text-[1.85rem]">
                    {isId
                      ? 'Pilih usaha aktif, lihat statusnya, lalu lanjut tepat ke flow yang dibutuhkan.'
                      : 'Pick the active business, review its status, then continue into the exact flow you need.'}
                  </h1>
                  <p className="mt-2 max-w-3xl text-[13px] leading-6 text-[color:var(--app-text-soft)] sm:text-[14px]">
                    {isId
                      ? 'Semua tombol mengikuti usaha aktif.'
                      : 'This page is now a work hub. Every primary button follows the selected business, so users stop jumping without context.'}
                  </p>

                  {authLoading ? (
                    <div className="mt-5 flex items-center gap-2 rounded-[20px] border border-slate-200 bg-white/84 px-4 py-4 text-sm text-[color:var(--app-text-soft)] dark:border-slate-800 dark:bg-slate-950/72">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {isId ? 'Memuat akses usaha...' : 'Loading business access...'}
                    </div>
                  ) : !isAuthenticated ? (
                    <div className="mt-5 grid gap-3 rounded-[22px] border border-slate-200 bg-white/88 p-4 dark:border-slate-800 dark:bg-slate-950/78 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--app-text)]">
                          {isId ? 'Masuk dulu untuk membuka workspace usaha' : 'Sign in first to open the business workspace'}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[color:var(--app-text-soft)]">
                          {isId
                            ? 'Login, pilih usaha, lanjut profil, katalog, order, atau operasional.'
                            : 'After signing in, you can choose the active business, review setup progress, and go straight into profile, catalog, orders, or operations.'}
                        </p>
                      </div>
                      <div className="grid gap-2 sm:min-w-[220px]">
                        <Link href={loginHref} className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">
                          {isId ? 'Masuk' : 'Sign in'}
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link href={UMKM_DISCOVERY_PATH} className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">
                          {isId ? 'Lihat peta usaha' : 'Open business map'}
                          <ArrowUpRight className="h-4 w-4" />
                        </Link>
                      </div>
                    </div>
                  ) : stores.length === 0 ? (
                    <div className="mt-5 rounded-[22px] border border-[color:var(--app-accent-border)] bg-white/92 p-4 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.16)] dark:bg-slate-950/82">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                        {isId ? 'Mulai dari nol' : 'Start from zero'}
                      </p>
                      <h2 className="mt-1 text-[1.05rem] font-black tracking-[-0.03em] text-[color:var(--app-text)]">
                        {isId ? 'Belum ada usaha yang tersimpan' : 'No businesses have been saved yet'}
                      </h2>
                      <p className="mt-2 text-[13px] leading-6 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Buat usaha. Rapikan setup. Isi katalog. Lanjut order.'
                          : 'The sequence is explicit now: create the business, tidy the setup, fill the catalog, then continue into orders or operations.'}
                      </p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Link href={buildUsahaPath('onboarding')} className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm font-semibold">
                          <Store className="h-4 w-4" />
                          {isId ? 'Buat usaha pertama' : 'Create the first business'}
                        </Link>
                        <Link href={buildUsahaPath('assistant')} className="ui-button-secondary inline-flex items-center gap-2 px-4 text-sm font-semibold">
                          <Workflow className="h-4 w-4" />
                          {isId ? 'Buka asisten setup' : 'Open setup assistant'}
                        </Link>
                      </div>
                    </div>
                  ) : selectedStore ? (
                    <div className="mt-5 rounded-[24px] border border-slate-200 bg-white/92 p-4 shadow-[0_22px_44px_-34px_rgba(15,23,42,0.18)] dark:border-slate-800 dark:bg-slate-950/82">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0 max-w-2xl">
                          <div className="flex flex-wrap items-center gap-2">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                              {isId ? 'Fokus kerja sekarang' : 'Current focus'}
                            </p>
                            <span className={cn('inline-flex min-h-[28px] items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]', toneBadgeClass(selectedStoreStatus?.tone || 'default'))}>
                              {selectedStoreStatus?.label}
                            </span>
                          </div>
                          <h2 className="mt-1 text-[1.1rem] font-black tracking-[-0.04em] text-[color:var(--app-text)] sm:text-[1.3rem]">
                            {selectedStore.name}
                          </h2>
                          <p className="mt-1 text-[13px] leading-6 text-[color:var(--app-text-soft)]">
                            {[selectedStore.city, selectedStore.address].map(value => normalizeText(value)).filter(Boolean).join(' - ') || (isId ? 'Alamat belum lengkap.' : 'Address is incomplete.')}
                          </p>
                          <p className="mt-2 text-[13px] leading-6 text-[color:var(--app-text-soft)]">
                            {selectedStoreStatus?.desc}
                          </p>
                          <div className="mt-4 flex flex-wrap gap-2">
                            <span className={cn('inline-flex min-h-[28px] items-center rounded-full border px-3 py-1 text-[11px] font-semibold', toneBadgeClass('default'))}>
                              {selectedStorePublishLabel}
                            </span>
                            <span className={cn('inline-flex min-h-[28px] items-center rounded-full border px-3 py-1 text-[11px] font-semibold', toneBadgeClass(isStoreLive(selectedStore) ? 'success' : 'default'))}>
                              {isStoreLive(selectedStore) ? (isId ? 'Outlet aktif' : 'Outlet active') : isId ? 'Belum live' : 'Not live yet'}
                            </span>
                            {selectedStoreSupportsReservations ? (
                              <span className={cn('inline-flex min-h-[28px] items-center rounded-full border px-3 py-1 text-[11px] font-semibold', toneBadgeClass('default'))}>
                                {isId ? 'Reservasi aktif' : 'Reservations ready'}
                              </span>
                            ) : null}
                            {selectedStoreSupportsDineIn ? (
                              <span className={cn('inline-flex min-h-[28px] items-center rounded-full border px-3 py-1 text-[11px] font-semibold', toneBadgeClass('default'))}>
                                {isId ? 'Flow dine-in' : 'Dine-in flow'}
                              </span>
                            ) : null}
                          </div>
                        </div>

                        <div className="grid w-full gap-2 sm:w-auto sm:min-w-[230px]">
                          <Link href={nextAction?.href || buildUsahaPath('profile', { storeId: selectedStore.id })} className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">
                            {nextAction?.label || (isId ? 'Buka usaha aktif' : 'Open active business')}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                          <Link href={buildUmkmStorefrontPath(selectedStore.slug)} className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">
                            {isId ? 'Lihat tampilan pembeli' : 'Open buyer view'}
                            <ArrowUpRight className="h-4 w-4" />
                          </Link>
                          <Link href={buildUsahaPath('onboarding')} className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">
                            {isId ? 'Tambah usaha lagi' : 'Add another business'}
                            <ArrowRight className="h-4 w-4" />
                          </Link>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <SummaryMetricCard label={isId ? 'Progress flow' : 'Flow progress'} value={`${completedFlowSteps}/${selectedStoreWorkflow.length}`} hint={isId ? 'Langkah utama yang sudah rapi.' : 'Primary steps already tidy.'} />
                        <SummaryMetricCard label={isId ? 'Katalog' : 'Catalog'} value={selectedSnapshotLoading && !selectedSnapshot ? '...' : selectedSnapshot?.productsCount || 0} hint={isId ? 'Jumlah item yang sudah masuk.' : 'Listings already added.'} />
                        <SummaryMetricCard label={isId ? 'Order aktif' : 'Active orders'} value={selectedSnapshotLoading && !selectedSnapshot ? '...' : selectedSnapshot?.ordersActive || 0} hint={isId ? 'Order yang masih perlu ditangani.' : 'Orders still needing attention.'} />
                        <SummaryMetricCard label={selectedStoreSupportsReservations || selectedStoreSupportsDineIn ? (isId ? 'Operasional' : 'Operations') : isId ? 'Tim' : 'Team'} value={selectedSnapshotLoading && !selectedSnapshot ? '...' : selectedStoreSupportsReservations || selectedStoreSupportsDineIn ? (selectedSnapshot?.reservationsActive || selectedSnapshot?.tablesCount || 0) : selectedSnapshot?.teamTotal || 0} hint={selectedStoreSupportsReservations || selectedStoreSupportsDineIn ? (isId ? 'Reservasi atau meja.' : 'Active reservations or ready tables.') : isId ? 'Jumlah anggota yang pegang usaha ini.' : 'Members handling this business.'} />
                      </div>

                      {snapshotError ? (
                        <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                          <div className="inline-flex items-center gap-2">
                            <CircleAlert className="h-4 w-4" />
                            <span>{snapshotError}</span>
                          </div>
                          <button type="button" onClick={() => void loadStoreSnapshot(selectedStore.id)} className="inline-flex min-h-[38px] items-center gap-2 rounded-full border border-amber-300 px-3 text-xs font-semibold text-amber-900 dark:border-amber-800 dark:text-amber-100">
                            {isId ? 'Muat ulang' : 'Reload'}
                          </button>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>

                <div className="grid gap-3">
                  <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-950/78">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                      {isId ? 'Ringkasan portfolio' : 'Portfolio summary'}
                    </p>
                    <div className="mt-4 grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
                      <SummaryMetricCard label={isId ? 'Total usaha' : 'Businesses'} value={stores.length} hint={isId ? 'Semua usaha yang bisa Anda kelola.' : 'Every business you can manage.'} />
                      <SummaryMetricCard label={isId ? 'Siap setup' : 'Setup ready'} value={readyStores} hint={isId ? 'Usaha dengan fondasi dasar rapi.' : 'Businesses with the basics in place.'} />
                      <SummaryMetricCard label={isId ? 'Sedang live' : 'Live now'} value={liveStores} hint={isId ? 'Usaha yang outlet-nya aktif.' : 'Businesses with an active outlet state.'} />
                    </div>
                    {storesNeedingAttention > 0 ? (
                      <div className="mt-4 rounded-[18px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-900/70 dark:bg-amber-950/30 dark:text-amber-200">
                        {isId ? `${storesNeedingAttention} usaha perlu dicek.` : `${storesNeedingAttention} businesses still need setup or channel cleanup.`}
                      </div>
                    ) : stores.length > 0 ? (
                      <div className="mt-4 rounded-[18px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-900/70 dark:bg-emerald-950/30 dark:text-emerald-200">
                        {isId ? 'Portfolio utama sudah rapi. Tinggal jaga ritme katalog dan operasional.' : 'The core portfolio is tidy. Keep the catalog and operations moving.'}
                      </div>
                    ) : null}
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-white/90 p-4 shadow-[0_20px_40px_-34px_rgba(15,23,42,0.16)] dark:border-slate-800 dark:bg-slate-950/78">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                      {isId ? 'Akses cepat' : 'Quick access'}
                    </p>
                    <div className="mt-4 grid gap-2">
                      {utilityActions.map(item => {
                        const Icon = item.icon;
                        return (
                          <Link key={item.title} href={item.href} className="group rounded-[18px] border border-slate-200 bg-slate-50/90 p-3.5 transition duration-200 hover:-translate-y-0.5 hover:bg-white dark:border-slate-800 dark:bg-slate-900/70 dark:hover:bg-slate-900">
                            <div className="flex items-start gap-3">
                              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                                <Icon className="h-4 w-4" />
                              </span>
                              <div className="min-w-0">
                                <p className="text-sm font-semibold text-[color:var(--app-text)]">{item.title}</p>
                                <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">{item.desc}</p>
                              </div>
                            </div>
                          </Link>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {isAuthenticated && stores.length > 0 ? (
          <>
            <section className="ui-page-section ui-home-section-shell px-2 sm:px-2.5 lg:px-3">
              <div className="ui-home-section-content rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_24px_42px_-34px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-950 sm:p-5">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                  <div className="max-w-3xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                      {isId ? 'Pilih fokus usaha' : 'Choose the active business'}
                    </p>
                    <h2 className="mt-1 text-[1.1rem] font-black tracking-[-0.04em] text-[color:var(--app-text)] sm:text-[1.3rem]">
                      {isId ? 'Pindah fokus tanpa memutus flow kerja' : 'Switch focus without breaking the workflow'}
                    </h2>
                    <p className="mt-1 text-[13px] leading-6 text-[color:var(--app-text-soft)]">
                      {isId ? 'Pilih usaha yang mau dikerjakan sekarang. Semua shortcut di bawah akan mengikuti usaha aktif ini.' : 'Choose the business you want to work on now. All shortcuts below will follow this active business.'}
                    </p>
                  </div>

                  <div className="flex w-full flex-col gap-2 sm:max-w-[360px]">
                    <label className="relative block">
                      <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
                      <input type="search" value={storeQuery} onChange={event => setStoreQuery(event.target.value)} placeholder={isId ? 'Cari nama usaha, kota, atau alamat' : 'Search business, city, or address'} className="h-11 w-full rounded-full border border-slate-200 bg-slate-50 pl-10 pr-4 text-sm text-[color:var(--app-text)] outline-none transition focus:border-[color:var(--app-accent-border)] focus:bg-white dark:border-slate-800 dark:bg-slate-900 dark:focus:bg-slate-950" />
                    </label>
                    <Link href={buildUsahaPath('onboarding')} className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">
                      {isId ? 'Tambah usaha baru' : 'Add a new business'}
                      <ArrowRight className="h-4 w-4" />
                    </Link>
                  </div>
                </div>

                {loadingStores ? (
                  <div className="mt-4 flex items-center gap-2 rounded-[18px] border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-[color:var(--app-text-soft)] dark:border-slate-800 dark:bg-slate-900">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {isId ? 'Memuat daftar usaha...' : 'Loading businesses...'}
                  </div>
                ) : storesError ? (
                  <div className="mt-4 rounded-[18px] border border-rose-200 bg-rose-50 px-4 py-4 text-sm text-rose-700 dark:border-rose-900/70 dark:bg-rose-950/20 dark:text-rose-200">
                    {storesError}
                  </div>
                ) : filteredStores.length === 0 ? (
                  <div className="mt-4 rounded-[20px] border border-dashed border-slate-300 bg-slate-50 px-4 py-8 text-sm text-[color:var(--app-text-soft)] dark:border-slate-700 dark:bg-slate-900">
                    {isId ? 'Tidak ada usaha yang cocok dengan pencarian ini.' : 'No businesses match this search.'}
                  </div>
                ) : (
                  <div className="mt-4 grid gap-3 xl:grid-cols-2">
                    {filteredStores.map(store => {
                      const isSelected = store.id === selectedStoreId;
                      const storeSnapshot = isSelected ? selectedSnapshot : snapshotByStoreId[store.id] || null;
                      const status = getStoreStatus(store, storeSnapshot, isId);
                      const publishLabel = getPublishServiceLabel(store, isId);
                      const productCount = storeSnapshot?.productsCount ?? 0;
                      const activeOrders = storeSnapshot?.ordersActive ?? 0;

                      return (
                        <article key={store.id} className={cn('rounded-[22px] border p-4 shadow-[0_18px_34px_-28px_rgba(15,23,42,0.16)] transition duration-200', isSelected ? 'border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(255,251,245,0.96),rgba(255,255,255,0.98))] dark:bg-[linear-gradient(180deg,rgba(24,24,27,0.96),rgba(15,23,42,0.98))]' : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950')}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="flex flex-wrap items-center gap-2">
                                <h3 className="truncate text-[1rem] font-black tracking-[-0.03em] text-[color:var(--app-text)]">{store.name}</h3>
                                <span className={cn('inline-flex min-h-[26px] items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]', toneBadgeClass(status.tone))}>
                                  {status.label}
                                </span>
                              </div>
                              <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                                {[store.city, store.address].map(value => normalizeText(value)).filter(Boolean).join(' - ') || (isId ? 'Alamat belum lengkap.' : 'Address is incomplete.')}
                              </p>
                              <p className="mt-2 text-[12px] leading-5 text-[color:var(--app-text-soft)]">{status.desc}</p>
                            </div>

                            <button type="button" aria-pressed={isSelected} onClick={() => setSelectedStoreId(store.id)} className={cn('inline-flex min-h-[40px] shrink-0 items-center justify-center rounded-full px-3.5 text-[12px] font-semibold', isSelected ? 'ui-button-primary' : 'ui-button-secondary')}>
                              {isSelected ? (isId ? 'Sedang difokuskan' : 'Current focus') : isId ? 'Fokuskan usaha ini' : 'Focus this business'}
                            </button>
                          </div>

                          <div className="mt-3 flex flex-wrap gap-2">
                            <span className={cn('inline-flex min-h-[28px] items-center rounded-full border px-3 py-1 text-[11px] font-semibold', toneBadgeClass('default'))}>
                              {publishLabel}
                            </span>
                            <span className={cn('inline-flex min-h-[28px] items-center rounded-full border px-3 py-1 text-[11px] font-semibold', toneBadgeClass(isStoreLive(store) ? 'success' : 'default'))}>
                              {isStoreLive(store) ? (isId ? 'Live sekarang' : 'Live now') : isId ? 'Belum live' : 'Not live'}
                            </span>
                            {storeSnapshot ? (
                              <>
                                <span className={cn('inline-flex min-h-[28px] items-center rounded-full border px-3 py-1 text-[11px] font-semibold', toneBadgeClass(productCount > 0 ? 'success' : 'default'))}>
                                  {productCount} {isId ? 'produk' : 'products'}
                                </span>
                                <span className={cn('inline-flex min-h-[28px] items-center rounded-full border px-3 py-1 text-[11px] font-semibold', toneBadgeClass(activeOrders > 0 ? 'primary' : 'default'))}>
                                  {activeOrders} {isId ? 'order aktif' : 'active orders'}
                                </span>
                              </>
                            ) : null}
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-3">
                            <Link href={buildUsahaPath('profile', { storeId: store.id })} className="ui-button-secondary inline-flex items-center justify-center px-4 text-sm font-semibold">
                              {isId ? 'Profil' : 'Profile'}
                            </Link>
                            <Link href={buildUsahaPath('catalog', { storeId: store.id })} className="ui-button-secondary inline-flex items-center justify-center px-4 text-sm font-semibold">
                              {isId ? 'Katalog' : 'Catalog'}
                            </Link>
                            <Link href={buildUsahaPath('order', { storeId: store.id })} className="ui-button-secondary inline-flex items-center justify-center px-4 text-sm font-semibold">
                              {isId ? 'Pesanan' : 'Orders'}
                            </Link>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                )}
              </div>
            </section>

            {selectedStore ? (
              <section className="ui-page-section ui-home-section-shell px-2 sm:px-2.5 lg:px-3">
                <div className="ui-home-section-content grid gap-3 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)]">
                  <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_24px_42px_-34px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-950 sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-2xl">
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                          {isId ? 'Langkah prioritas' : 'Priority flow'}
                        </p>
                        <h2 className="mt-1 text-[1.1rem] font-black tracking-[-0.04em] text-[color:var(--app-text)] sm:text-[1.3rem]">
                          {isId ? `Jalankan ${selectedStore.name} tanpa lompat-lompat flow` : `Run ${selectedStore.name} without jumping between flows`}
                        </h2>
                        <p className="mt-1 text-[13px] leading-6 text-[color:var(--app-text-soft)]">
                          {isId ? 'Urutan dibuat biar langkah berikutnya jelas.' : 'This order keeps the next step obvious for the user.'}
                        </p>
                      </div>
                      <span className={cn('inline-flex min-h-[28px] items-center rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]', toneBadgeClass(completedFlowSteps === selectedStoreWorkflow.length ? 'success' : 'primary'))}>
                        {completedFlowSteps}/{selectedStoreWorkflow.length} {isId ? 'langkah rapi' : 'steps tidy'}
                      </span>
                    </div>

                    <div className="mt-4 grid gap-3">
                      {selectedStoreWorkflow.map(action => (
                        <WorkflowCard key={action.id} action={action} />
                      ))}
                    </div>
                  </div>

                  <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_24px_42px_-34px_rgba(15,23,42,0.14)] dark:border-slate-800 dark:bg-slate-950 sm:p-5">
                    <div className="max-w-2xl">
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                        {isId ? 'Workspace cepat' : 'Fast workspaces'}
                      </p>
                      <h2 className="mt-1 text-[1.1rem] font-black tracking-[-0.04em] text-[color:var(--app-text)] sm:text-[1.3rem]">
                        {isId ? 'Semua tombol penting sudah dikontekstualkan ke usaha aktif' : 'Every important button is now scoped to the active business'}
                      </h2>
                      <p className="mt-1 text-[13px] leading-6 text-[color:var(--app-text-soft)]">
                        {isId ? 'Badge, status, dan tujuan tombol mengikuti kondisi usaha yang sedang dipilih.' : 'Badges, state, and destinations all follow the selected business.'}
                      </p>
                    </div>

                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {workspaceShortcuts.map(item => (
                        <ShortcutCard key={item.id} item={item} />
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}
