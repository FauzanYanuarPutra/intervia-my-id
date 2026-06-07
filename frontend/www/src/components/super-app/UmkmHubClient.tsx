'use client';

import {
  useDeferredValue,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowRightLeft,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Clipboard,
  Circle,
  FileText,
  LayoutDashboard,
  Loader2,
  Map,
  MapPinned,
  PackagePlus,
  ShieldCheck,
  Store,
  Table2,
  UploadCloud,
  Users,
  WalletCards,
} from 'lucide-react';
import { Link, usePathname, useRouter } from '@/i18n/navigation';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { useAuth } from '@/context/AuthContext';
import { UMKM_PLAYBOOKS } from '@/lib/umkmBusinessFlow';
import {
  UMKM_ACTIVE_STORE_STORAGE_KEY,
  UMKM_DISCOVERY_PATH,
  buildUmkmScanPath,
  buildUmkmStorefrontPath,
  buildUsahaPath,
  buildUsahaPathFromWorkspace,
} from '@/lib/umkmSurface';
import { cn } from '@/lib/utils';
import {
  buildDefaultCustomFieldsForBusiness,
  buildUmkmCatalogMetadata,
  createCustomFieldDefinition,
  getCapabilityDescription,
  getCapabilityLabel,
  getRelevantCustomFields,
  getUmkmCatalogFieldProfile,
  getUmkmDefaultCapabilities,
  getUmkmDefaultChannelsForBusiness,
  getUmkmDefaultProductKindForBusiness,
  getUmkmManageProfile,
  getUmkmOperationsSummary,
  getUmkmRecommendedPublishServices,
  parseCapabilityList,
  parseCustomFieldDefinitions,
  supportsDigitalDelivery,
  supportsDineIn,
  supportsFieldService,
  supportsReservations,
  supportsShipping,
  type UmkmBusinessCapabilityId,
  type UmkmCustomFieldDefinition,
  type UmkmCustomFieldScope,
  type UmkmCustomFieldType,
  type UmkmManageWorkspaceId,
} from '@/lib/super-app/umkm-manage-profiles';
import {
  getDefaultProductCategoryForBusiness,
  getUmkmBusinessCategoryGroup,
  getUmkmBusinessCategoryGroups,
  getUmkmBusinessCategoryDescription,
  getUmkmBusinessCategoryLabel,
  getUmkmBusinessCategoryOptions,
  getUmkmBusinessCategoryOptionsByGroup,
  getUmkmBusinessFocusPlaceholder,
  getUmkmProductCategoryLabel,
  getUmkmProductCategoryOptions,
  getUmkmPublishServiceLabel,
  type UmkmBusinessCategoryId,
  type UmkmBusinessCategoryGroupId,
} from '@/lib/super-app/umkm-taxonomy';
import {
  formatUmkmLiveScheduleSummary,
  getUmkmLivePresence,
  getUmkmLocationModeHint,
  getUmkmLocationModeLabel,
  normalizeUmkmLocationMode,
  parseUmkmLiveScheduleDays,
  UMKM_LIVE_SCHEDULE_DAY_OPTIONS,
  type UmkmLiveScheduleDay,
} from '@/lib/super-app/umkm-live-ops';
import {
  ActionTile,
  InlineBadge,
  RoleBlueprintCard,
  SectionCard,
  SectionJumpTile,
  SelectInput,
  StatCard,
  StoreSwitcherCard,
  TextArea,
  TextInput,
  type TileIcon,
  Toggle,
} from './manage/UmkmManagePrimitives';
import {
  ALL_BUSINESS_CAPABILITIES,
  createCustomFieldDraftState,
  createProductFormState,
  createStoreFormState,
  createVerificationFormState,
  type CollectionResponse,
  type CreateStoreResponse,
  derivePublishServices,
  formatDateTime,
  formatIdr,
  formatOrderFulfillmentLabel,
  formatPaymentMethod,
  formatPaymentStage,
  readBusinessCategory,
  readMetaBool,
  readMetaNumber,
  readMetaString,
  type OrderFilter,
  type OrderRecord,
  type ProductFormState,
  type ProductRecord,
  type QrRecord,
  readPaymentFlow,
  type ReservationRecord,
  SECTION_TO_WORKSPACE,
  statusTone,
  type StoreFormState,
  type StoreRecord,
  type StoresResponse,
  type TableRecord,
  teamRoleLabel,
  type TeamMemberRecord,
  type VerificationFormState,
  type CustomFieldDraftState,
} from './manage/UmkmManageHelpers';
import { QrPreview } from './QrPreview';
import { UmkmLocationPicker } from './UmkmLocationPicker';
import { getPlaceIcon } from './UmkmPlacesChromePrimitives';

type UmkmHubClientProps = {
  locale: string;
  isId: boolean;
  initialWorkspace?: UmkmManageWorkspaceId;
  setupView?: 'list' | 'create' | 'detail';
  forcedStoreId?: string;
  uiVariant?: 'default' | 'simple';
};

type StoreCreateStepId =
  | 'intro'
  | 'group'
  | 'identity'
  | 'location'
  | 'operations';
type StoreListFilterId = 'all' | 'attention' | 'active' | 'live';
type SimpleWorkspaceHero =
  | {
    eyebrow: string;
    title: string;
    desc: string;
    primaryLabel: string;
    primaryHref: string;
    secondaryLabel: string;
    secondaryHref: string;
  }
  | {
    eyebrow: string;
    title: string;
    desc: string;
    primaryLabel: string;
    primaryTarget: string;
    secondaryLabel: string;
    secondaryHref: string;
  };
type BasicStoreEditFormState = Pick<
  StoreFormState,
  'name' | 'description' | 'city' | 'address' | 'phone'
>;
type LaunchRecommendationCard = {
  id: string;
  icon: TileIcon;
  title: string;
  desc: string;
  badge: string;
  query: string;
  searchHref: string;
  searchLabel: string;
  briefHref: string;
  briefLabel: string;
};
type GuidedFlowAction =
  | {
    kind: 'href';
    href: string;
    label: string;
  }
  | {
    kind: 'target';
    target: string;
    label: string;
  };
type GuidedFlowCard = {
  id: string;
  stepLabel: string;
  title: string;
  desc: string;
  badge: string;
  tone: 'default' | 'accent' | 'warning' | 'success';
  done: boolean;
  action: GuidedFlowAction;
};
type SetupDetailStepId =
  | 'summary'
  | 'basic'
  | 'publish'
  | 'recommendations'
  | 'next';
type SetupDetailStep = {
  id: SetupDetailStepId;
  target: string;
  icon: TileIcon;
  stepLabel: string;
  title: string;
  desc: string;
  badge: string;
  tone: 'default' | 'accent' | 'warning' | 'success';
  done: boolean;
  href?: string;
};

const STORE_CREATE_STEP_ORDER: StoreCreateStepId[] = [
  'intro',
  'group',
  'identity',
  'location',
  'operations',
];

const SETUP_DETAIL_STEP_TARGETS: Record<SetupDetailStepId, string> = {
  summary: 'umkm-setup-summary',
  basic: 'umkm-store-basic',
  publish: 'umkm-verification',
  recommendations: 'umkm-start-recommendations',
  next: 'umkm-setup-next',
};

function setupDetailStepFromTarget(target: string): SetupDetailStepId | null {
  const entry = Object.entries(SETUP_DETAIL_STEP_TARGETS).find(
    ([, sectionId]) => sectionId === target,
  );
  return (entry?.[0] as SetupDetailStepId | undefined) || null;
}

const STORE_LIMITS = {
  name: 120,
  city: 80,
  address: 240,
  description: 500,
  phone: 40,
  tableCount: 200,
  tablePrefix: 8,
  tableCapacity: 40,
} as const;

const PRODUCT_LIMITS = {
  name: 160,
  description: 600,
  imageUrl: 500,
  digitalDeliveryNote: 200,
  priceRupiah: 20_000_000,
  stockQty: 1_000_000,
  weightGrams: 500_000,
} as const;

const TEAM_LIMITS = {
  name: 120,
  email: 200,
  notes: 300,
} as const;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeSingleLineInput(value: string): string {
  return value.replace(/\s+/g, ' ').trim();
}

function normalizeTextBlock(value: string): string {
  return value.replace(/\r\n/g, '\n').trim();
}

function isWholeNumber(value: string): boolean {
  return /^\d+$/.test(value);
}

function createBasicStoreEditFormState(): BasicStoreEditFormState {
  return {
    name: '',
    description: '',
    city: '',
    address: '',
    phone: '',
  };
}

function buildSearchHref(type: string, query: string): string {
  const params = new URLSearchParams();
  if (type.trim()) {
    params.set('type', type);
  }
  if (query.trim()) {
    params.set('q', query.trim());
  }
  const queryString = params.toString();
  return queryString ? `/search?${queryString}` : '/search';
}

export function UmkmHubClient({
  locale,
  isId,
  initialWorkspace = 'overview',
  setupView = 'list',
  forcedStoreId,
  uiVariant = 'default',
}: UmkmHubClientProps) {
  const { authFetch, isAuthenticated, loading: authLoading, user } = useAuth();
  const { notify } = useToast();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const requestedStoreId = (
    forcedStoreId ||
    searchParams.get('store') ||
    ''
  ).trim();
  const currentWorkspace = initialWorkspace;
  const isOverviewWorkspace = currentWorkspace === 'overview';
  const isSetupListView = currentWorkspace === 'setup' && setupView === 'list';
  const isSetupCreateView =
    currentWorkspace === 'setup' && setupView === 'create';
  const isSetupDetailView =
    currentWorkspace === 'setup' && setupView === 'detail';
  const isSimpleHubMode = uiVariant === 'simple';
  const useSimpleOverviewLayout = isSimpleHubMode && isOverviewWorkspace;
  const useSimpleSetupCreateLayout = isSimpleHubMode && isSetupCreateView;
  const useSimpleSetupShell =
    isSimpleHubMode && currentWorkspace === 'setup' && !isSetupCreateView;
  const useSimpleWorkspaceShell =
    isSimpleHubMode && !isOverviewWorkspace && currentWorkspace !== 'setup';
  const storefrontActionLabel = isId ? 'Tampilan pembeli' : 'Buyer view';

  const [myStores, setMyStores] = useState<StoreRecord[]>([]);
  const [selectedStoreId, setSelectedStoreId] = useState<string>('');
  const [products, setProducts] = useState<ProductRecord[]>([]);
  const [tables, setTables] = useState<TableRecord[]>([]);
  const [qrs, setQrs] = useState<QrRecord[]>([]);
  const [orders, setOrders] = useState<OrderRecord[]>([]);
  const [reservations, setReservations] = useState<ReservationRecord[]>([]);
  const [teamMembers, setTeamMembers] = useState<TeamMemberRecord[]>([]);

  const [loadingStores, setLoadingStores] = useState(false);
  const [loadingStoreData, setLoadingStoreData] = useState(false);
  const [pageError, setPageError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const [submittingStore, setSubmittingStore] = useState(false);
  const [submittingProduct, setSubmittingProduct] = useState(false);
  const [submittingTables, setSubmittingTables] = useState(false);
  const [savingBasicStore, setSavingBasicStore] = useState(false);
  const [verificationSaving, setVerificationSaving] = useState(false);
  const [submittingTeamMember, setSubmittingTeamMember] = useState(false);
  const [actingOrderId, setActingOrderId] = useState<string | null>(null);
  const [actingReservationId, setActingReservationId] = useState<string | null>(
    null,
  );
  const [actingTeamMemberId, setActingTeamMemberId] = useState<string | null>(
    null,
  );

  const [copyMessage, setCopyMessage] = useState<string | null>(null);
  const [basicStoreMessage, setBasicStoreMessage] = useState<string | null>(
    null,
  );
  const [verificationMessage, setVerificationMessage] = useState<string | null>(
    null,
  );
  const [liveLocationMessage, setLiveLocationMessage] = useState<string | null>(
    null,
  );
  const [teamMessage, setTeamMessage] = useState<string | null>(null);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);
  const [customFieldDraft, setCustomFieldDraft] =
    useState<CustomFieldDraftState>(createCustomFieldDraftState());
  const [showAdvancedStoreCapabilities, setShowAdvancedStoreCapabilities] =
    useState(false);
  const [
    showAdvancedVerificationCapabilities,
    setShowAdvancedVerificationCapabilities,
  ] = useState(false);
  const [moveTargets, setMoveTargets] = useState<Record<string, string>>({});
  const [orderFilter, setOrderFilter] = useState<OrderFilter>('active');
  const [liveLocationSharing, setLiveLocationSharing] = useState(false);
  const [storeListQuery, setStoreListQuery] = useState('');
  const [storeListFilter, setStoreListFilter] =
    useState<StoreListFilterId>('all');
  const deferredStoreListQuery = useDeferredValue(storeListQuery);

  const storeRequestRef = useRef(0);
  const liveLocationWatchRef = useRef<number | null>(null);
  const lastLiveLocationSyncRef = useRef<{
    lat: number;
    lng: number;
    sentAt: number;
  } | null>(null);

  const [storeForm, setStoreForm] = useState<StoreFormState>(() =>
    createStoreFormState('culinary'),
  );
  const [basicStoreForm, setBasicStoreForm] = useState<BasicStoreEditFormState>(
    createBasicStoreEditFormState,
  );
  const [storeCreateStep, setStoreCreateStep] =
    useState<StoreCreateStepId>('intro');
  const [storeSetupMode, setStoreSetupMode] = useState<'guided' | 'full'>(
    'guided',
  );
  const [activeSetupDetailStep, setActiveSetupDetailStep] =
    useState<SetupDetailStepId>('basic');
  const [showStoreBusinessFocus, setShowStoreBusinessFocus] = useState(false);
  const [showOptionalStoreIdentity, setShowOptionalStoreIdentity] =
    useState(false);
  const [showDetailedStoreOperations, setShowDetailedStoreOperations] =
    useState(false);

  const showHubToast = useCallback(
    (
      variant: 'success' | 'error' | 'info',
      title: string,
      description?: string,
    ) => {
      notify({
        title,
        description,
        variant,
        durationMs: variant === 'error' ? 4200 : 3200,
      });
    },
    [notify],
  );

  const resolveActionErrorMessage = useCallback(
    (error: unknown, fallback: string) => {
      if (error instanceof Error) {
        const message = error.message.trim();
        if (message) return message;
      }
      return fallback;
    },
    [],
  );

  const [verificationForm, setVerificationForm] =
    useState<VerificationFormState>(() =>
      createVerificationFormState('culinary'),
    );

  const [productForm, setProductForm] = useState<ProductFormState>(() =>
    createProductFormState('culinary'),
  );

  const [tableForm, setTableForm] = useState({
    count: '4',
    prefix: 'T',
    start_number: '1',
    capacity: '4',
  });

  const [teamForm, setTeamForm] = useState({
    name: '',
    email: '',
    role: 'cashier' as TeamMemberRecord['role'],
    notes: '',
  });

  const selectedStore = useMemo(
    () => myStores.find(store => store.id === selectedStoreId) || null,
    [myStores, selectedStoreId],
  );

  const selectedStorePresence = useMemo(
    () =>
      selectedStore ? getUmkmLivePresence(selectedStore.metadata || {}) : null,
    [selectedStore],
  );

  const basicStoreCompletion = useMemo(() => {
    if (!selectedStore) return 0;

    return [
      selectedStore.name,
      selectedStore.city,
      selectedStore.address,
      selectedStore.phone,
      selectedStore.description,
    ].filter(value => normalizeTextBlock(String(value || '')).length > 0)
      .length;
  }, [selectedStore]);
  const basicStoreDraftCompletion = useMemo(
    () =>
      [
        basicStoreForm.name,
        basicStoreForm.city,
        basicStoreForm.address,
        basicStoreForm.phone,
        basicStoreForm.description,
      ].filter(value => normalizeTextBlock(String(value || '')).length > 0)
        .length,
    [basicStoreForm],
  );

  const canManageTeam =
    selectedStore?.access_role === 'owner' ||
    selectedStore?.access_via === 'owner';

  const onlineQr = useMemo(
    () => qrs.find(qr => qr.mode === 'online') || null,
    [qrs],
  );

  const offlineQrs = useMemo(
    () =>
      qrs
        .filter(qr => qr.mode === 'offline')
        .sort((a, b) => (a.table_code || '').localeCompare(b.table_code || '')),
    [qrs],
  );

  const openOrders = useMemo(
    () =>
      orders.filter(
        order =>
          order.payment_status === 'unpaid' && order.status !== 'cancelled',
      ),
    [orders],
  );

  const availableTables = useMemo(
    () => tables.filter(table => table.status === 'available'),
    [tables],
  );

  const orderSummary = useMemo(() => {
    const total = orders.length;
    const unpaid = orders.filter(
      order => order.payment_status !== 'paid' && order.status !== 'cancelled',
    ).length;
    const awaitingBill = orders.filter(
      order => order.payment_stage === 'awaiting_confirmation',
    ).length;
    const preparing = orders.filter(
      order => order.status === 'preparing',
    ).length;
    const served = orders.filter(order => order.status === 'served').length;
    const completed = orders.filter(
      order => order.status === 'paid' || order.payment_status === 'paid',
    ).length;
    return { total, unpaid, awaitingBill, preparing, served, completed };
  }, [orders]);

  const reservationSummary = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const total = reservations.length;
    const active = reservations.filter(
      reservation =>
        reservation.status === 'pending' ||
        reservation.status === 'confirmed' ||
        reservation.status === 'seated',
    ).length;
    const todayCount = reservations.filter(
      reservation => reservation.reserved_for.slice(0, 10) === today,
    ).length;
    const seated = reservations.filter(
      reservation => reservation.status === 'seated',
    ).length;
    return { total, active, todayCount, seated };
  }, [reservations]);

  const teamSummary = useMemo(() => {
    const total = teamMembers.length;
    const active = teamMembers.filter(
      member => member.status === 'active',
    ).length;
    const invited = teamMembers.filter(
      member => member.status === 'invited',
    ).length;
    const disabled = teamMembers.filter(
      member => member.status === 'disabled',
    ).length;
    return { total, active, invited, disabled };
  }, [teamMembers]);

  const filteredOrders = useMemo(() => {
    if (orderFilter === 'awaiting_bill') {
      return orders.filter(
        order => order.payment_stage === 'awaiting_confirmation',
      );
    }
    if (orderFilter === 'completed') {
      return orders.filter(
        order => order.status === 'paid' || order.payment_status === 'paid',
      );
    }
    if (orderFilter === 'all') return orders;
    return orders.filter(
      order => order.status !== 'cancelled' && order.status !== 'paid',
    );
  }, [orderFilter, orders]);

  const orderFilterOptions = useMemo(
    () => [
      {
        id: 'active' as const,
        label: isId ? 'Aktif' : 'Active',
        count: orderSummary.unpaid,
      },
      {
        id: 'awaiting_bill' as const,
        label: isId ? 'Menunggu bill' : 'Awaiting bill',
        count: orderSummary.awaitingBill,
      },
      {
        id: 'completed' as const,
        label: isId ? 'Selesai' : 'Completed',
        count: orderSummary.completed,
      },
      {
        id: 'all' as const,
        label: isId ? 'Semua' : 'All',
        count: orderSummary.total,
      },
    ],
    [isId, orderSummary],
  );

  const origin = useMemo(
    () => (typeof window !== 'undefined' ? window.location.origin : ''),
    [],
  );

  const storefrontHref = selectedStore
    ? buildUmkmStorefrontPath(selectedStore.slug)
    : '';
  const storefrontUrl = selectedStore ? `/${locale}${storefrontHref}` : '';
  const onlineQrBaseUrl = `${origin}/${locale}${buildUmkmScanPath()}?token=`;
  const prefersAssistantPath = pathname.includes('/usaha/asisten');
  const isAssistantSetupRoute =
    currentWorkspace === 'setup' &&
    (prefersAssistantPath || searchParams.get('assistant') === '1');
  const buildAssistantHref = useCallback(
    (storeIdOverride?: string, hash?: string) => {
      const activeStoreId =
        storeIdOverride || selectedStoreId || requestedStoreId;
      return buildUsahaPath('assistant', {
        storeId: activeStoreId || undefined,
        hash,
      });
    },
    [requestedStoreId, selectedStoreId],
  );
  const buildSetupHref = useCallback(
    (
      view: 'list' | 'create' | 'detail',
      storeIdOverride?: string,
      hash?: string,
    ) => {
      const activeStoreId =
        storeIdOverride || selectedStoreId || requestedStoreId;

      if (view === 'detail' && activeStoreId) {
        return isAssistantSetupRoute
          ? buildUsahaPath('assistant', {
            storeId: activeStoreId,
            hash,
          })
          : buildUsahaPath('profile', {
            storeId: activeStoreId,
            hash,
          });
      }

      const basePath = isAssistantSetupRoute
        ? buildUsahaPath('assistant')
        : view === 'create'
          ? buildUsahaPath('onboarding')
          : buildUsahaPath('profile');
      const params = new URLSearchParams(searchParams.toString());

      params.delete('assistant');
      params.delete('store');

      const query = params.toString();
      const target = query ? `${basePath}?${query}` : basePath;
      return hash ? `${target}#${hash}` : target;
    },
    [isAssistantSetupRoute, requestedStoreId, searchParams, selectedStoreId],
  );
  const buildWorkspaceHref = useCallback(
    (
      workspace: UmkmManageWorkspaceId,
      storeIdOverride?: string,
      hash?: string,
    ) => {
      if (workspace === 'setup') {
        return buildSetupHref('list', storeIdOverride, hash);
      }
      const activeStoreId =
        storeIdOverride || selectedStoreId || requestedStoreId;
      return buildUsahaPathFromWorkspace(workspace, {
        storeId: activeStoreId || undefined,
        hash,
      });
    },
    [buildSetupHref, requestedStoreId, selectedStoreId],
  );

  const businessCategoryOptions = useMemo(
    () => getUmkmBusinessCategoryOptions(),
    [],
  );
  const businessCategoryGroups = useMemo(
    () => getUmkmBusinessCategoryGroups(),
    [],
  );
  const applyStoreCategory = useCallback(
    (nextCategory: UmkmBusinessCategoryId) => {
      const nextCapabilities = getUmkmDefaultCapabilities(nextCategory);
      setStoreForm(current => ({
        ...current,
        business_category: nextCategory,
        business_capabilities: nextCapabilities,
        table_count: supportsDineIn(nextCapabilities)
          ? current.table_count && current.table_count !== '0'
            ? current.table_count
            : '6'
          : '0',
      }));
      setShowAdvancedStoreCapabilities(false);
      setSubmitError(null);
    },
    [],
  );
  const selectedStoreCategoryGroup = useMemo(
    () =>
      getUmkmBusinessCategoryGroup(storeForm.business_category) ||
      businessCategoryGroups[0]?.id ||
      null,
    [businessCategoryGroups, storeForm.business_category],
  );
  const applyStoreCategoryGroup = useCallback(
    (groupId: UmkmBusinessCategoryGroupId) => {
      const group = businessCategoryGroups.find(item => item.id === groupId);
      if (!group) return;
      const nextCategory = group.categories.includes(
        storeForm.business_category,
      )
        ? storeForm.business_category
        : group.defaultCategory;
      applyStoreCategory(nextCategory);
    },
    [applyStoreCategory, businessCategoryGroups, storeForm.business_category],
  );
  const filteredStoreBusinessCategoryOptions = useMemo(
    () => getUmkmBusinessCategoryOptionsByGroup(selectedStoreCategoryGroup),
    [selectedStoreCategoryGroup],
  );

  const storeRegistrationProfile = useMemo(
    () => getUmkmManageProfile(storeForm.business_category),
    [storeForm.business_category],
  );
  const storePrimaryCapabilities = useMemo(() => {
    const prioritized = new Set<UmkmBusinessCapabilityId>([
      ...storeRegistrationProfile.defaultCapabilities,
      ...storeForm.business_capabilities,
    ]);
    return ALL_BUSINESS_CAPABILITIES.filter(capability =>
      prioritized.has(capability),
    );
  }, [
    storeForm.business_capabilities,
    storeRegistrationProfile.defaultCapabilities,
  ]);

  const storeAdvancedCapabilities = useMemo(
    () =>
      ALL_BUSINESS_CAPABILITIES.filter(
        capability => !storePrimaryCapabilities.includes(capability),
      ),
    [storePrimaryCapabilities],
  );

  const registrationPathOptions = useMemo(
    () =>
      businessCategoryGroups.map(group => {
        const iconMap: Record<UmkmBusinessCategoryGroupId, typeof Store> = {
          food: getPlaceIcon('food'),
          retail: getPlaceIcon('retail'),
          service: getPlaceIcon('service'),
          craft: getPlaceIcon('craft'),
          workshop: getPlaceIcon('workshop'),
          agri: getPlaceIcon('agri'),
        };
        const badgeMap: Record<
          UmkmBusinessCategoryGroupId,
          { id: string; en: string }
        > = {
          food: { id: 'Menu & pickup', en: 'Menu & pickup' },
          retail: { id: 'Stok & kirim', en: 'Stock & shipping' },
          service: { id: 'Booking & kunjungan', en: 'Bookings & visits' },
          craft: { id: 'Made to order', en: 'Made to order' },
          workshop: { id: 'Servis & estimasi', en: 'Service & estimate' },
          agri: { id: 'Supply & panen', en: 'Supply & harvest' },
        };
        const toneMap: Record<
          UmkmBusinessCategoryGroupId,
          'warning' | 'accent' | 'success' | 'default'
        > = {
          food: 'warning',
          retail: 'accent',
          service: 'success',
          craft: 'warning',
          workshop: 'default',
          agri: 'success',
        };
        const badge = badgeMap[group.id];
        return {
          groupId: group.id,
          icon: iconMap[group.id],
          title: isId ? group.labelId : group.labelEn,
          desc: isId ? group.descriptionId : group.descriptionEn,
          badge: isId ? badge.id : badge.en,
          tone: toneMap[group.id],
        };
      }),
    [businessCategoryGroups, isId],
  );

  const storeRegistrationCopy = useMemo(() => {
    const isServiceProfile =
      storeRegistrationProfile.id === 'service_booking' ||
      storeRegistrationProfile.id === 'repair_service';
    const isDigitalProfile = storeRegistrationProfile.id === 'digital_service';
    const usesVisitFlow =
      storeForm.business_capabilities.includes('field_service');
    const isMobileLocation = storeForm.location_mode === 'mobile';

    return {
      sectionTitle: isId ? 'Daftarkan usaha' : 'Register business',
      sectionDesc: isId
        ? 'Isi 5 langkah singkat. Detail bisa nanti.'
        : 'Fill the essentials first. Details can follow later.',
      intro: isId ? 'Isi data wajib dulu.' : 'Start with the required details.',
      modelLabel: isId ? 'Usaha kamu termasuk apa?' : 'Business type',
      modelHint: isId
        ? 'Pilih yang paling mirip. Kalau ragu, pilih yang paling dekat.'
        : 'Pick the closest fit. You can change it later.',
      nameLabel: isId ? 'Nama usaha / brand' : 'Business / brand name',
      namePlaceholder: isDigitalProfile
        ? isId
          ? 'Contoh: Studio Konten Lajukan'
          : 'Example: Lajukan Content Studio'
        : isServiceProfile
          ? isId
            ? 'Contoh: Sejuk Jaya Servis AC'
            : 'Example: Sejuk Jaya AC Service'
          : storeRegistrationProfile.id === 'made_to_order'
            ? isId
              ? 'Contoh: Konveksi Rapi Jaya'
              : 'Example: Rapi Jaya Tailoring'
            : isId
              ? 'Contoh: Kedai Nusantara'
              : 'Example: Nusantara Business',
      cityLabel: isDigitalProfile
        ? isId
          ? 'Kota / basis tim'
          : 'City / team base'
        : isMobileLocation
          ? isId
            ? 'Kota / area keliling utama'
            : 'City / main mobile area'
          : usesVisitFlow
            ? isId
              ? 'Kota / area layanan utama'
              : 'City / main service area'
            : isId
              ? 'Kota / area utama'
              : 'City / main area',
      phoneLabel: isId ? 'Nomor WhatsApp usaha' : 'Business WhatsApp',
      addressLabel: isDigitalProfile
        ? isId
          ? 'Alamat basis tim'
          : 'Operational base address'
        : isMobileLocation
          ? isId
            ? 'Alamat basis / area utama'
            : 'Base / registered address'
          : usesVisitFlow
            ? isId
              ? 'Alamat workshop / basis'
              : 'Workshop / operational base address'
            : isId
              ? 'Alamat atau patokan usaha'
              : 'Business address',
      addressPlaceholder: isDigitalProfile
        ? isId
          ? 'Contoh: Studio di Kemang / kantor utama'
          : 'Team, studio, or main office address'
        : isMobileLocation
          ? isId
            ? 'Contoh: Rumah produksi di Setiabudi'
            : 'Home, storage, or base address when not selling'
          : usesVisitFlow
            ? isId
              ? 'Contoh: Workshop dekat Pasar Minggu'
              : 'Workshop, store, garage, or team base address'
            : isId
              ? 'Contoh: Jl. Melati No. 10, dekat Alfamart'
              : 'Full business address',
      descriptionLabel: isId ? 'Usaha ini menjual apa?' : 'What do you offer?',
      descriptionPlaceholder: isDigitalProfile
        ? isId
          ? 'Contoh: Jasa desain konten Instagram untuk UMKM kuliner.'
          : 'Describe the main service, deliverable format, and how your team works.'
        : isServiceProfile
          ? isId
            ? 'Contoh: Servis AC area Bandung, bisa datang ke rumah.'
            : 'Describe the service type, coverage area, booking flow, and what buyers receive.'
          : storeRegistrationProfile.id === 'made_to_order'
            ? isId
              ? 'Contoh: Jahit seragam custom, estimasi 7 hari kerja.'
              : 'Describe the custom order type, materials, sizing, and production lead time.'
            : isId
              ? 'Contoh: Jual ayam geprek, bisa pickup dan pesan untuk kantor.'
              : 'Describe the main products and what makes the business strong.',
      locationHint: isDigitalProfile
        ? isId
          ? 'Pakai titik basis tim. Tidak harus toko fisik.'
          : 'For digital businesses, the map point is used as the team base. It does not need to be a physical shop.'
        : isMobileLocation
          ? isId
            ? 'Pakai area atau base utama dulu. Titik bisa diubah nanti.'
            : 'Use the main base first. The live point can be updated later.'
          : usesVisitFlow
            ? isId
              ? 'Pakai workshop atau base tim. Jangan pakai lokasi customer.'
              : 'Use the workshop or team base. It does not need to be the customer location.'
            : null,
      noTablesMessage: isDigitalProfile
        ? isId
          ? 'Meja tidak perlu untuk usaha digital. Kamu bisa lanjut simpan.'
          : 'Tables are disabled because this business runs on briefs and digital delivery.'
        : usesVisitFlow || isServiceProfile
          ? isId
            ? 'Meja tidak perlu untuk jasa booking atau kunjungan.'
            : 'Tables are disabled because this business is better handled through bookings or field visits.'
          : isId
            ? 'Meja belum dipakai. Aktifkan nanti kalau perlu.'
            : 'Tables are disabled for now. You can enable them later.',
    };
  }, [
    isId,
    storeForm.business_capabilities,
    storeForm.location_mode,
    storeRegistrationProfile,
  ]);
  const storeLocationPoint = useMemo(() => {
    const lat = Number(storeForm.lat);
    const lng = Number(storeForm.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [storeForm.lat, storeForm.lng]);
  const selectedRegistrationPath = useMemo(
    () =>
      registrationPathOptions.find(
        option => option.groupId === selectedStoreCategoryGroup,
      ) || null,
    [registrationPathOptions, selectedStoreCategoryGroup],
  );
  const isGuidedStoreSetup = storeSetupMode === 'guided';
  const compactStoreControlClass =
    'min-h-[40px] rounded-[13px] px-3 text-[13px]';
  const compactStoreTextAreaClass =
    'min-h-[84px] rounded-[13px] px-3 py-2.5 text-[13px]';
  const manageFormHeroClass =
    'relative overflow-hidden rounded-[22px] border border-emerald-200/85 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_48%,#ecfeff_100%)] px-3.5 py-3.5 shadow-[0_18px_38px_-32px_rgba(15,23,42,0.22)] dark:border-emerald-400/20 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.26),rgba(2,6,23,0.96)_56%,rgba(8,47,73,0.22))] sm:px-4 sm:py-4';
  const manageInfoCardClass =
    'rounded-[16px] border border-emerald-100/90 bg-white/84 px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)] dark:border-emerald-400/14 dark:bg-white/[0.07]';
  const manageSectionBlockClass =
    'rounded-[20px] border border-emerald-100/90 bg-white/96 px-3 py-3 shadow-[0_14px_30px_-28px_rgba(15,23,42,0.18)] dark:border-emerald-400/14 dark:bg-slate-950/86';
  const manageStorePanelClass =
    'rounded-[20px] border border-emerald-100/90 bg-white/96 px-3 py-3 shadow-[0_16px_30px_-28px_rgba(15,23,42,0.26)] dark:border-emerald-400/14 dark:bg-slate-950/88 sm:px-4 sm:py-4';
  const manageStoreSoftPanelClass =
    'rounded-[18px] border border-emerald-100/85 bg-[linear-gradient(135deg,#f0fdf4_0%,#ffffff_100%)] px-3 py-3 text-[12px] leading-5 text-[color:var(--app-accent)] shadow-[0_12px_24px_-24px_rgba(15,23,42,0.16)] dark:border-emerald-400/14 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.18),rgba(2,6,23,0.94))]';
  const manageDashboardShellClass =
    'relative overflow-hidden rounded-[24px] border border-emerald-200/85 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_44%,#f8fafc_72%,#eff6ff_100%)] p-2.5 shadow-[0_22px_46px_-36px_rgba(15,23,42,0.24)] dark:border-emerald-400/18 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.28),rgba(2,6,23,0.96)_58%,rgba(15,23,42,0.94))] sm:p-3';
  const manageDashboardCardClass =
    'rounded-[22px] border border-white/80 bg-white/92 p-3.5 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.2)] dark:border-white/10 dark:bg-slate-950/82 sm:p-4';
  const manageDashboardSoftCardClass =
    'rounded-[20px] border border-emerald-100/85 bg-[linear-gradient(135deg,#ffffff_0%,#f0fdf4_100%)] p-3 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.18)] dark:border-emerald-400/14 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.18),rgba(15,23,42,0.92))]';
  const buildStoreBaseAddress = useCallback(
    (city: string, locationMode: StoreFormState['location_mode']) => {
      const trimmedCity = city.trim();
      if (!trimmedCity) return '';
      if (locationMode === 'mobile') {
        return isId
          ? `Area jual ${trimmedCity}`
          : `${trimmedCity} selling area`;
      }
      return isId ? `Basis ${trimmedCity}` : `${trimmedCity} base location`;
    },
    [isId],
  );
  const storeSuggestedBaseAddress = useMemo(
    () => buildStoreBaseAddress(storeForm.city, storeForm.location_mode),
    [buildStoreBaseAddress, storeForm.city, storeForm.location_mode],
  );

  useEffect(() => {
    if (!useSimpleSetupCreateLayout || storeSetupMode === 'guided') return;
    setStoreSetupMode('guided');
  }, [storeSetupMode, useSimpleSetupCreateLayout]);

  const storeCreateValidation = useMemo(() => {
    const lat = Number(storeForm.lat);
    const lng = Number(storeForm.lng);
    const supportsTables = supportsDineIn(storeForm.business_capabilities);

    return {
      intro: true,
      group:
        Boolean(selectedStoreCategoryGroup) &&
        Boolean(storeForm.business_category) &&
        Boolean(storeForm.location_mode),
      identity:
        normalizeSingleLineInput(storeForm.name).length >= 3 &&
        storeForm.city.trim().length >= 2 &&
        normalizeSingleLineInput(storeForm.address).length >= 3,
      location:
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat >= -90 &&
        lat <= 90 &&
        lng >= -180 &&
        lng <= 180,
      operations:
        storeForm.business_capabilities.length > 0 &&
        (!supportsTables ||
          ((!storeForm.table_count.trim() ||
            isWholeNumber(storeForm.table_count.trim())) &&
            (!storeForm.default_capacity.trim() ||
              isWholeNumber(storeForm.default_capacity.trim())) &&
            normalizeSingleLineInput(storeForm.table_prefix).length > 0)),
    };
  }, [
    selectedStoreCategoryGroup,
    storeForm.address,
    storeForm.business_capabilities,
    storeForm.business_category,
    storeForm.city,
    storeForm.default_capacity,
    storeForm.lat,
    storeForm.lng,
    storeForm.location_mode,
    storeForm.name,
    storeForm.table_count,
    storeForm.table_prefix,
  ]);
  const highestUnlockedStoreCreateStepIndex = useMemo(() => {
    let highest = 0;

    for (
      let index = 0;
      index < STORE_CREATE_STEP_ORDER.length - 1;
      index += 1
    ) {
      const stepId = STORE_CREATE_STEP_ORDER[index];
      if (!storeCreateValidation[stepId]) break;
      highest = index + 1;
    }

    return highest;
  }, [storeCreateValidation]);
  const storeCreateSteps = useMemo(
    () => [
      {
        id: 'intro' as const,
        icon: Clipboard,
        title: isId ? 'Mulai' : 'Start',
        desc: isId ? 'Lihat alur singkat.' : 'See the quick flow.',
        summary: isId
          ? 'Kamu akan isi jenis, nama, alamat, lokasi, lalu simpan.'
          : 'Prepare the business type, name, base address, and location point.',
      },
      {
        id: 'group' as const,
        icon: Store,
        title: isId ? 'Jenis' : 'Type',
        desc: isId ? 'Pilih yang paling mirip.' : 'Pick the closest fit.',
        summary: selectedRegistrationPath
          ? `${selectedRegistrationPath.title} - ${getUmkmBusinessCategoryLabel(storeForm.business_category, isId)}`
          : isId
            ? 'Pilih kategori usaha yang paling dekat dengan aktivitasmu.'
            : 'Pick one first.',
      },
      {
        id: 'identity' as const,
        icon: FileText,
        title: isId ? 'Data' : 'Details',
        desc: isId ? 'Nama, kota, alamat.' : 'Name, city, address.',
        summary:
          storeForm.name.trim() || storeForm.city.trim()
            ? [
              storeForm.name.trim() ||
              (isId ? 'Nama belum diisi' : 'Name missing'),
              storeForm.city.trim(),
            ]
              .filter(Boolean)
              .join(' - ')
            : isId
              ? 'Isi nama usaha, kota, dan alamat atau patokan.'
              : 'Fill the core data.',
      },
      {
        id: 'location' as const,
        icon: Map,
        title: isId ? 'Lokasi' : 'Location',
        desc: isId ? 'Tandai area usaha.' : 'Place the business area.',
        summary: storeLocationPoint
          ? `${storeLocationPoint.lat.toFixed(4)}, ${storeLocationPoint.lng.toFixed(4)}`
          : isId
            ? 'Pakai lokasi saya atau geser pin di peta.'
            : 'Pin not set.',
      },
      {
        id: 'operations' as const,
        icon: ShieldCheck,
        title: isId ? 'Cek' : 'Review',
        desc: isId ? 'Review lalu simpan.' : 'Review then save.',
        summary: supportsDineIn(storeForm.business_capabilities)
          ? isId
            ? `${Math.max(0, Number(storeForm.table_count) || 0)} meja awal`
            : `${Math.max(0, Number(storeForm.table_count) || 0)} initial tables`
          : isId
            ? `${storeForm.business_capabilities.length} mode aktif`
            : `${storeForm.business_capabilities.length} active modes`,
      },
    ],
    [
      isId,
      selectedRegistrationPath,
      storeForm.business_capabilities,
      storeForm.business_category,
      storeForm.city,
      storeForm.name,
      storeForm.table_count,
      storeLocationPoint,
    ],
  );
  const storeCreateStepIndex = useMemo(
    () => STORE_CREATE_STEP_ORDER.indexOf(storeCreateStep),
    [storeCreateStep],
  );
  const currentStoreCreateStep =
    storeCreateSteps[storeCreateStepIndex] || storeCreateSteps[0];
  const storeCreateProgress = Math.round(
    ((storeCreateStepIndex + 1) / STORE_CREATE_STEP_ORDER.length) * 100,
  );
  const storeCreateChecklist = useMemo(
    () => [
      {
        id: 'intro',
        done: true,
        label: isId ? 'Mulai' : 'Start',
      },
      {
        id: 'group-profile',
        done: Boolean(selectedRegistrationPath),
        label: isId ? 'Jenis' : 'Type',
      },
      {
        id: 'identity-core',
        done: storeCreateValidation.identity,
        label: isId ? 'Data' : 'Details',
      },
      {
        id: 'location-point',
        done: storeCreateValidation.location,
        label: isId ? 'Lokasi' : 'Location',
      },
      {
        id: 'operations-capabilities',
        done: storeCreateValidation.operations,
        label: isId ? 'Cek' : 'Review',
      },
    ],
    [
      isId,
      selectedRegistrationPath,
      storeCreateValidation.identity,
      storeCreateValidation.location,
      storeCreateValidation.operations,
    ],
  );
  const storeSupportsTables = useMemo(
    () => supportsDineIn(storeForm.business_capabilities),
    [storeForm.business_capabilities],
  );
  const storeTablePlanningAvailable = useMemo(
    () =>
      storeSupportsTables ||
      supportsDineIn(getUmkmDefaultCapabilities(storeForm.business_category)),
    [storeForm.business_category, storeSupportsTables],
  );
  const activeStoreTablePreset = useMemo(() => {
    const count = Math.max(0, Number(storeForm.table_count) || 0);
    if (!storeSupportsTables || count === 0) return 'none';
    if (count <= 4) return 'small';
    if (count <= 8) return 'medium';
    return 'large';
  }, [storeForm.table_count, storeSupportsTables]);
  const storeOnboardingInfoCards = useMemo(
    () => [
      {
        icon: Store,
        title: isId ? 'Pilih jenis usaha' : 'Pick business type',
        desc: isId
          ? 'Misalnya kuliner, retail, jasa, workshop, kerajinan, atau agribisnis.'
          : 'Choose the closest category. Details can be changed after saving.',
      },
      {
        icon: FileText,
        title: isId ? 'Isi data yang dicari pembeli' : 'Fill core details',
        desc: isId
          ? 'Nama usaha, kota, dan alamat atau patokan dulu cukup.'
          : 'Name, city, and base address are enough. Phone and description are optional.',
      },
      {
        icon: MapPinned,
        title: isId ? 'Tandai lokasi' : 'Set location point',
        desc: isId
          ? 'Tekan Lokasi saya atau geser pin. Bisa diedit lagi nanti.'
          : 'Use your current location if unsure. The point can be refined later.',
      },
      {
        icon: PackagePlus,
        title: isId ? 'Simpan, lalu rapikan' : 'Continue after saving',
        desc: isId
          ? 'Setelah jadi, baru tambah produk, QR, tim, dan jam operasional.'
          : 'Catalog, QR, team, and operations open after the business profile exists.',
      },
    ],
    [isId],
  );
  const storeCreateReviewCards = useMemo(
    () => [
      {
        label: isId ? 'Jenis' : 'Type',
        value: getUmkmBusinessCategoryLabel(storeForm.business_category, isId),
      },
      {
        label: isId ? 'Nama' : 'Name',
        value:
          normalizeSingleLineInput(storeForm.name) ||
          (isId ? 'Belum diisi' : 'Not filled'),
      },
      {
        label: isId ? 'Area' : 'Area',
        value: [storeForm.city.trim(), storeForm.address.trim()]
          .filter(Boolean)
          .join(' - '),
      },
      {
        label: isId ? 'Titik' : 'Point',
        value: storeLocationPoint
          ? `${storeLocationPoint.lat.toFixed(5)}, ${storeLocationPoint.lng.toFixed(5)}`
          : isId
            ? 'Belum ada titik'
            : 'No point yet',
      },
      {
        label: isId ? 'Mode' : 'Mode',
        value:
          storeForm.business_capabilities
            .slice(0, 3)
            .map(capability => getCapabilityLabel(capability, isId))
            .join(', ') || (isId ? 'Default' : 'Default'),
      },
    ],
    [
      isId,
      storeForm.address,
      storeForm.business_capabilities,
      storeForm.business_category,
      storeForm.city,
      storeForm.name,
      storeLocationPoint,
    ],
  );

  const storePublishServices = useMemo(() => {
    if (!selectedStore) return [];
    return derivePublishServices(selectedStore.metadata || {});
  }, [selectedStore]);

  const selectedBusinessCategory = useMemo(
    () =>
      verificationForm.business_type ||
      (selectedStore
        ? readBusinessCategory(selectedStore.metadata || {})
        : null) ||
      storeForm.business_category,
    [
      selectedStore,
      storeForm.business_category,
      verificationForm.business_type,
    ],
  );

  const selectedBusinessFocus = useMemo(
    () => verificationForm.business_focus || storeForm.business_focus || '',
    [storeForm.business_focus, verificationForm.business_focus],
  );

  const selectedBusinessCapabilities = useMemo(() => {
    if (verificationForm.business_capabilities.length > 0) {
      return verificationForm.business_capabilities;
    }
    if (selectedStore) {
      return parseCapabilityList(
        selectedStore.metadata?.business_capabilities ??
        selectedStore.metadata?.capabilities,
        selectedBusinessCategory,
      );
    }
    return getUmkmDefaultCapabilities(selectedBusinessCategory);
  }, [
    selectedBusinessCategory,
    selectedStore,
    verificationForm.business_capabilities,
  ]);

  const selectedCustomFields = useMemo(() => {
    if (verificationForm.custom_fields.length > 0) {
      return verificationForm.custom_fields;
    }
    if (selectedStore) {
      return parseCustomFieldDefinitions(
        selectedStore.metadata?.custom_fields,
        selectedBusinessCategory,
      );
    }
    return buildDefaultCustomFieldsForBusiness(selectedBusinessCategory);
  }, [selectedBusinessCategory, selectedStore, verificationForm.custom_fields]);

  const selectedManageProfile = useMemo(
    () => getUmkmManageProfile(selectedBusinessCategory),
    [selectedBusinessCategory],
  );
  const verificationPrimaryCapabilities = useMemo(() => {
    const prioritized = new Set<UmkmBusinessCapabilityId>([
      ...selectedManageProfile.defaultCapabilities,
      ...verificationForm.business_capabilities,
    ]);
    return ALL_BUSINESS_CAPABILITIES.filter(capability =>
      prioritized.has(capability),
    );
  }, [
    selectedManageProfile.defaultCapabilities,
    verificationForm.business_capabilities,
  ]);

  const verificationAdvancedCapabilities = useMemo(
    () =>
      ALL_BUSINESS_CAPABILITIES.filter(
        capability => !verificationPrimaryCapabilities.includes(capability),
      ),
    [verificationPrimaryCapabilities],
  );

  const businessCategoryDescription = useMemo(
    () => getUmkmBusinessCategoryDescription(selectedBusinessCategory, isId),
    [isId, selectedBusinessCategory],
  );

  const businessFocusPlaceholder = useMemo(
    () => getUmkmBusinessFocusPlaceholder(selectedBusinessCategory, isId),
    [isId, selectedBusinessCategory],
  );
  const verificationLocationPoint = useMemo(() => {
    const lat = Number(verificationForm.lat);
    const lng = Number(verificationForm.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return { lat, lng };
  }, [verificationForm.lat, verificationForm.lng]);

  const productCategoryOptions = useMemo(
    () => getUmkmProductCategoryOptions(selectedBusinessCategory),
    [selectedBusinessCategory],
  );

  const catalogFieldProfile = useMemo(
    () => getUmkmCatalogFieldProfile(selectedBusinessCategory),
    [selectedBusinessCategory],
  );

  const listingRequirementFields = useMemo(
    () => getRelevantCustomFields(selectedCustomFields, 'listing'),
    [selectedCustomFields],
  );

  const bookingRequirementFields = useMemo(
    () => getRelevantCustomFields(selectedCustomFields, 'booking'),
    [selectedCustomFields],
  );

  const orderRequirementFields = useMemo(
    () => getRelevantCustomFields(selectedCustomFields, 'order'),
    [selectedCustomFields],
  );

  const canUseFoodChannel = useMemo(
    () =>
      selectedManageProfile.recommendedPublishServices.includes('food') ||
      selectedBusinessCategory === 'culinary' ||
      selectedBusinessCategory === 'warung_kios',
    [
      selectedBusinessCategory,
      selectedManageProfile.recommendedPublishServices,
    ],
  );

  const canUseMartChannel = useMemo(
    () =>
      selectedManageProfile.recommendedPublishServices.includes('mart') ||
      selectedBusinessCapabilities.includes('inventory') ||
      selectedBusinessCapabilities.includes('made_to_order'),
    [
      selectedBusinessCapabilities,
      selectedManageProfile.recommendedPublishServices,
    ],
  );
  const listingFulfillmentReady = useMemo(() => {
    if (productForm.product_kind === 'digital') {
      return productForm.digital_delivery_note.trim().length > 0;
    }
    if (productForm.channel_online) {
      return productForm.allow_pickup || productForm.allow_courier_shipping;
    }
    return true;
  }, [
    productForm.allow_courier_shipping,
    productForm.allow_pickup,
    productForm.channel_online,
    productForm.digital_delivery_note,
    productForm.product_kind,
  ]);
  const listingQuickCards = useMemo(
    () => [
      {
        key: 'title',
        icon: PackagePlus,
        title: isId ? 'Nama & jenis' : 'Name and type',
        body: productForm.name.trim()
          ? `${productForm.name.trim()} / ${productForm.product_kind === 'digital'
            ? isId
              ? 'digital'
              : 'digital'
            : isId
              ? 'fisik'
              : 'physical'
          }`
          : isId
            ? 'Isi nama listing yang jelas.'
            : 'Add a clear listing name.',
        done: productForm.name.trim().length > 0,
      },
      {
        key: 'pricing',
        icon: WalletCards,
        title: isId ? 'Harga & stok' : 'Price and stock',
        body:
          Number(productForm.price_rupiah) > 0
            ? `${isId ? 'Rp' : 'Rp'} ${productForm.price_rupiah || '0'} / ${isId ? 'stok' : 'stock'
            } ${productForm.stock_qty || '0'}`
            : isId
              ? 'Isi harga dulu.'
              : 'Set the price first.',
        done: Number(productForm.price_rupiah) > 0,
      },
      {
        key: 'channels',
        icon: ArrowRightLeft,
        title: isId ? 'Kanal & kirim' : 'Channels and delivery',
        body:
          [
            productForm.channel_online ? 'Online' : '',
            productForm.channel_offline ? 'Offline' : '',
            productForm.product_kind === 'digital'
              ? isId
                ? 'Digital'
                : 'Digital'
              : [
                productForm.allow_pickup ? (isId ? 'Pickup' : 'Pickup') : '',
                productForm.allow_courier_shipping
                  ? isId
                    ? 'Kurir'
                    : 'Courier'
                  : '',
              ]
                .filter(Boolean)
                .join(' / '),
          ]
            .filter(Boolean)
            .join(' / ') ||
          (isId
            ? 'Pilih cara jual dan kirim.'
            : 'Pick selling and delivery modes.'),
        done:
          (productForm.channel_online || productForm.channel_offline) &&
          listingFulfillmentReady,
      },
    ],
    [
      isId,
      listingFulfillmentReady,
      productForm.allow_courier_shipping,
      productForm.allow_pickup,
      productForm.channel_offline,
      productForm.channel_online,
      productForm.name,
      productForm.price_rupiah,
      productForm.product_kind,
      productForm.stock_qty,
    ],
  );

  const supportsDineInFlow = useMemo(
    () => supportsDineIn(selectedBusinessCapabilities),
    [selectedBusinessCapabilities],
  );

  const supportsReservationFlow = useMemo(
    () => supportsReservations(selectedBusinessCapabilities),
    [selectedBusinessCapabilities],
  );

  const supportsDigitalFlow = useMemo(
    () => supportsDigitalDelivery(selectedBusinessCapabilities),
    [selectedBusinessCapabilities],
  );

  const supportsFieldVisitFlow = useMemo(
    () => supportsFieldService(selectedBusinessCapabilities),
    [selectedBusinessCapabilities],
  );

  const guideBusinessLabel = useMemo(
    () => getUmkmBusinessCategoryLabel(selectedBusinessCategory, isId),
    [isId, selectedBusinessCategory],
  );

  const guideBusinessFocus = useMemo(
    () => normalizeSingleLineInput(selectedBusinessFocus),
    [selectedBusinessFocus],
  );

  const guideCity = useMemo(
    () =>
      normalizeSingleLineInput(
        (isSetupDetailView ? selectedStore?.city : '') ||
        storeForm.city ||
        selectedStore?.city ||
        '',
      ),
    [isSetupDetailView, selectedStore?.city, storeForm.city],
  );

  const guideLocationMode = isSetupCreateView
    ? storeForm.location_mode
    : verificationForm.location_mode;

  const startCompanionNotes = useMemo(
    () => [
      {
        title: isId
          ? 'Tidak harus lengkap hari ini'
          : 'It does not need to be perfect today',
        desc: isId
          ? 'Nama usaha, kota, alamat, dan titik peta sudah cukup untuk mulai. Detail lain bisa nyusul setelah fondasinya ada.'
          : 'The business name, city, address, and map pin are enough to get started. The rest can follow once the foundation exists.',
      },
      {
        title: isId
          ? 'Fokus ke satu kebutuhan dulu'
          : 'Solve one need at a time',
        desc: isId
          ? 'Kalau masih bingung, pilih kebutuhan paling nyata dulu: supplier, lokasi, jasa operasional, legalitas, atau talent.'
          : 'If it still feels fuzzy, pick the most concrete need first: supply, location, operations support, legal help, or talent.',
      },
      {
        title: isId ? 'Biar tetap aman saat mulai' : 'Keep the first move safe',
        desc: isId
          ? 'Bandingkan minimal dua opsi supplier, dua titik jual, atau dua partner jasa sebelum benar-benar deal.'
          : 'Compare at least two suppliers, two selling spots, or two service partners before committing.',
      },
    ],
    [isId],
  );

  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- Used in the setup playbook JSX below; this large component can trip the lint reference pass.
  const prioritizedPlaybooks = useMemo(() => {
    const focusToken =
      `${selectedBusinessCategory} ${guideBusinessFocus}`.toLowerCase();
    const scorePlaybook = (id: string) => {
      if (
        id === 'kopi' &&
        /(kopi|coffee|cafe|espresso|beans)/.test(focusToken)
      ) {
        return 4;
      }
      if (
        id === 'beauty' &&
        /(beauty|skincare|kosmetik|makeup|parfum)/.test(focusToken)
      ) {
        return 4;
      }
      if (
        id === 'fashion' &&
        /(fashion|baju|pakaian|tailor|konveksi|hijab)/.test(focusToken)
      ) {
        return 4;
      }
      if (
        id === 'frozen-food' &&
        /(frozen|makanan|kuliner|snack|warung|food)/.test(focusToken)
      ) {
        return 4;
      }
      return 0;
    };

    return [...UMKM_PLAYBOOKS]
      .sort((left, right) => scorePlaybook(right.id) - scorePlaybook(left.id))
      .slice(0, 4);
  }, [guideBusinessFocus, selectedBusinessCategory]);

  const launchRecommendationCards = useMemo<LaunchRecommendationCard[]>(() => {
    const businessNeed = guideBusinessFocus || guideBusinessLabel;
    const citySuffix = guideCity ? ` ${guideCity}` : '';
    const locationNeed = supportsFieldVisitFlow
      ? isId
        ? 'area layanan strategis'
        : 'strategic service area'
      : guideLocationMode === 'mobile'
        ? isId
          ? 'titik jual ramai untuk bazaar atau booth'
          : 'busy selling spots for booths or bazaars'
        : isId
          ? 'lokasi usaha strategis'
          : 'strategic business location';

    const supplierQuery =
      `${businessNeed} supplier bahan baku${citySuffix}`.trim();
    const locationQuery =
      `${guideBusinessLabel} ${locationNeed}${citySuffix}`.trim();
    const operationsQuery =
      `${businessNeed} kemasan foto admin usaha${citySuffix}`.trim();
    const legalQuery =
      `${guideBusinessLabel} legalitas izin usaha${citySuffix}`.trim();
    const talentQuery =
      `${businessNeed} admin toko kasir helper${citySuffix}`.trim();

    return [
      {
        id: 'supplier',
        icon: PackagePlus,
        title: isId ? 'Supplier & bahan baku' : 'Suppliers and raw materials',
        desc: isId
          ? 'Bandingkan MOQ, harga, ritme kirim, dan backup supplier sebelum ambil keputusan.'
          : 'Compare MOQs, pricing, delivery rhythm, and backup suppliers before deciding.',
        badge: isId ? 'Stok lebih aman' : 'Safer supply',
        query: supplierQuery,
        searchHref: buildSearchHref('product', supplierQuery),
        searchLabel: isId ? 'Cari supplier' : 'Find suppliers',
        briefHref: '/create/butuh/produk',
        briefLabel: isId ? 'Buat brief supplier' : 'Create supplier brief',
      },
      {
        id: 'location',
        icon: MapPinned,
        title: supportsFieldVisitFlow
          ? isId
            ? 'Area layanan yang sehat'
            : 'Healthier service coverage'
          : isId
            ? 'Lokasi yang lebih strategis'
            : 'More strategic location',
        desc: isId
          ? 'Cari titik atau area yang realistis buat traffic, akses, parkir, atau jangkauan pelanggan.'
          : 'Look for a realistic point or area for traffic, access, parking, or customer reach.',
        badge: isId ? 'Lebih gampang diuji' : 'Easier to validate',
        query: locationQuery,
        searchHref: buildSearchHref('property', locationQuery),
        searchLabel: isId ? 'Cari lokasi' : 'Find location',
        briefHref: '/create/butuh/properti',
        briefLabel: isId ? 'Buat brief lokasi' : 'Create location brief',
      },
      {
        id: 'operations',
        icon: LayoutDashboard,
        title: isId ? 'Jasa operasional penting' : 'Operational support',
        desc: isId
          ? 'Kemasan, foto menu, admin toko, desain, atau support harian lain yang bikin usaha lebih siap jual.'
          : 'Packaging, menu photos, store admin, design, or other support that makes the business more ready to sell.',
        badge: isId ? 'Biar tidak keteteran' : 'Avoid overwhelm',
        query: operationsQuery,
        searchHref: buildSearchHref('service', operationsQuery),
        searchLabel: isId ? 'Cari jasa' : 'Find services',
        briefHref: '/create/butuh/jasa',
        briefLabel: isId ? 'Buat brief jasa' : 'Create service brief',
      },
      {
        id: 'legal',
        icon: FileText,
        title: isId ? 'Legalitas & izin' : 'Legal and permits',
        desc: isId
          ? 'Cari pendamping yang bisa bantu urus legalitas dasar, izin, kontrak, dan hal-hal yang bikin owner lebih tenang.'
          : 'Find help for basic legal setup, permits, contracts, and the pieces that make the owner feel safer.',
        badge: isId ? 'Biar lebih tenang' : 'More peace of mind',
        query: legalQuery,
        searchHref: buildSearchHref('service', legalQuery),
        searchLabel: isId ? 'Cari pendamping legal' : 'Find legal help',
        briefHref: '/create/butuh/jasa',
        briefLabel: isId ? 'Buat brief legal' : 'Create legal brief',
      },
      {
        id: 'talent',
        icon: Users,
        title: isId ? 'Talent harian' : 'Day-to-day talent',
        desc: isId
          ? 'Kalau owner tidak bisa kerjakan semuanya sendiri, mulai cari admin, kasir, helper, host live, atau ops support.'
          : 'If the owner cannot do everything alone, start finding admins, cashiers, helpers, live hosts, or ops support.',
        badge: isId ? 'Beban owner turun' : 'Reduce owner load',
        query: talentQuery,
        searchHref: buildSearchHref('freelancer', talentQuery),
        searchLabel: isId ? 'Cari talent' : 'Find talent',
        briefHref: '/create/butuh/lowongan',
        briefLabel: isId ? 'Buat brief talent' : 'Create talent brief',
      },
    ];
  }, [
    guideBusinessFocus,
    guideBusinessLabel,
    guideCity,
    guideLocationMode,
    isId,
    supportsFieldVisitFlow,
  ]);

  const verificationPresencePreview = useMemo(
    () =>
      getUmkmLivePresence({
        outlet_active: verificationForm.outlet_active,
        location_mode: verificationForm.location_mode,
        live_now: verificationForm.live_now,
        auto_live_schedule_enabled: verificationForm.auto_live_schedule_enabled,
        live_schedule_days: verificationForm.live_schedule_days,
        live_schedule_start: verificationForm.live_schedule_start,
        live_schedule_end: verificationForm.live_schedule_end,
      }),
    [
      verificationForm.auto_live_schedule_enabled,
      verificationForm.live_now,
      verificationForm.live_schedule_days,
      verificationForm.live_schedule_end,
      verificationForm.live_schedule_start,
      verificationForm.location_mode,
      verificationForm.outlet_active,
    ],
  );

  const verificationLocationModeLabel = useMemo(
    () => getUmkmLocationModeLabel(verificationForm.location_mode, isId),
    [isId, verificationForm.location_mode],
  );

  const verificationLocationModeHint = useMemo(
    () => getUmkmLocationModeHint(verificationForm.location_mode, isId),
    [isId, verificationForm.location_mode],
  );

  const verificationScheduleSummary = useMemo(
    () =>
      formatUmkmLiveScheduleSummary(
        {
          days: verificationForm.live_schedule_days,
          start: verificationForm.live_schedule_start,
          end: verificationForm.live_schedule_end,
        },
        isId,
      ),
    [
      isId,
      verificationForm.live_schedule_days,
      verificationForm.live_schedule_end,
      verificationForm.live_schedule_start,
    ],
  );

  const canShareLiveLocation = useMemo(
    () =>
      verificationForm.location_mode === 'mobile' &&
      verificationForm.outlet_active &&
      verificationForm.live_now,
    [
      verificationForm.live_now,
      verificationForm.location_mode,
      verificationForm.outlet_active,
    ],
  );

  const verificationLiveStatusLabel = useMemo(() => {
    if (!verificationPresencePreview.outletActive) {
      return isId ? 'Belum aktif jualan' : 'Not active yet';
    }
    if (verificationPresencePreview.liveNow) {
      return verificationForm.location_mode === 'mobile'
        ? isId
          ? 'Sedang keliling'
          : 'Selling on the move'
        : isId
          ? 'Buka sekarang'
          : 'Open now';
    }
    if (
      verificationForm.auto_live_schedule_enabled &&
      !verificationPresencePreview.scheduleOpenNow
    ) {
      return isId ? 'Di luar jadwal' : 'Outside schedule';
    }
    return verificationForm.location_mode === 'mobile'
      ? isId
        ? 'Belum mulai keliling'
        : 'Not live yet'
      : isId
        ? 'Sedang off'
        : 'Offline';
  }, [
    isId,
    verificationForm.auto_live_schedule_enabled,
    verificationForm.location_mode,
    verificationPresencePreview.liveNow,
    verificationPresencePreview.outletActive,
    verificationPresencePreview.scheduleOpenNow,
  ]);

  const operationsWorkspaceCopy = useMemo(() => {
    if (supportsDineInFlow) {
      return {
        title: isId ? 'Meja & QR' : 'Tables & QR',
        desc: isId
          ? 'QR, meja, booking, pickup.'
          : 'QR, tables, bookings, pickup.',
        badge: onlineQr
          ? `${tables.length} ${isId ? 'meja' : 'tables'}`
          : isId
            ? 'QR belum siap'
            : 'QR pending',
        modeTitle: isId ? 'Operasional outlet' : 'Outlet ops',
        modeDesc: isId
          ? 'Atur meja, QR, booking, dan ritme outlet.'
          : 'Manage tables, QR, bookings, and outlet flow.',
        teamScope: isId ? 'Dine-in / pickup' : 'Dine-in / pickup',
        teamDesc: isId
          ? 'Pegang meja, QR, booking, dan flow layanan.'
          : 'Handle tables, QR, bookings, and on-site flow.',
      };
    }

    if (supportsFieldVisitFlow) {
      return {
        title: isId ? 'Booking & area' : 'Bookings & coverage',
        desc: isId
          ? 'Jadwal, area, pickup, kunjungan.'
          : 'Schedules, coverage, pickup, visits.',
        badge:
          reservationSummary.todayCount > 0
            ? `${reservationSummary.todayCount} ${isId ? 'booking' : 'bookings'}`
            : isId
              ? 'Siap dijadwalkan'
              : 'Schedule ready',
        modeTitle: isId ? 'Operasional lapangan' : 'Field ops',
        modeDesc: isId
          ? 'Atur booking, area kerja, pickup, dan jalur tim.'
          : 'Manage bookings, coverage, pickup, and routing.',
        teamScope: isId ? 'Booking / kunjungan' : 'Bookings / visits',
        teamDesc: isId
          ? 'Fokus ke booking, area, urutan kunjungan, dan selesai kerja.'
          : 'Focus on bookings, coverage, visit order, and completion.',
      };
    }

    if (supportsDigitalFlow) {
      return {
        title: isId ? 'Brief & delivery' : 'Briefs & delivery',
        desc: isId
          ? 'Brief, revisi, deadline, kirim hasil.'
          : 'Briefs, revisions, deadlines, delivery.',
        badge:
          reservationSummary.todayCount > 0
            ? `${reservationSummary.todayCount} ${isId ? 'brief' : 'briefs'}`
            : isId
              ? 'Online workflow'
              : 'Online workflow',
        modeTitle: isId ? 'Operasional digital' : 'Digital ops',
        modeDesc: isId
          ? 'Fokus ke brief, deadline, revisi, dan delivery.'
          : 'Focus on briefs, deadlines, revisions, and delivery.',
        teamScope: isId ? 'Brief / project' : 'Brief / project',
        teamDesc: isId
          ? 'Fokus ke antrian project, revisi, dan kirim hasil.'
          : 'Focus on project queues, revisions, and delivery.',
      };
    }

    if (supportsReservationFlow) {
      return {
        title: isId ? 'Booking & sesi' : 'Bookings & sessions',
        desc: isId
          ? 'Slot, kedatangan, sesi layanan.'
          : 'Slots, arrivals, service sessions.',
        badge:
          reservationSummary.todayCount > 0
            ? `${reservationSummary.todayCount} ${isId ? 'booking' : 'bookings'}`
            : isId
              ? 'Siap booking'
              : 'Booking ready',
        modeTitle: isId ? 'Operasional booking' : 'Booking ops',
        modeDesc: isId
          ? 'Atur jadwal, slot, dan progress layanan.'
          : 'Manage schedules, slot capacity, and progress.',
        teamScope: isId ? 'Booking / sesi' : 'Bookings / sessions',
        teamDesc: isId
          ? 'Fokus ke jadwal harian, kedatangan, dan tutup sesi.'
          : 'Focus on daily schedules, arrivals, and closeout.',
      };
    }

    return {
      title: isId ? 'Operasional' : 'Operations',
      desc: isId ? 'Alur kerja harian usaha.' : 'Daily business workflow.',
      badge: isId ? 'Siap' : 'Ready',
      modeTitle: isId ? 'Operasional' : 'Operations',
      modeDesc: isId
        ? 'Alur kerja utama usaha ini.'
        : 'The main workflow for this business.',
      teamScope: isId ? 'Operasional' : 'Operations',
      teamDesc: isId
        ? 'Fokus ke alur kerja utama tim setiap hari.'
        : 'Focus on the main team workflow every day.',
    };
  }, [
    isId,
    onlineQr,
    reservationSummary.todayCount,
    supportsDigitalFlow,
    supportsDineInFlow,
    supportsFieldVisitFlow,
    supportsReservationFlow,
    tables.length,
  ]);

  const publishReadiness = useMemo(() => {
    const missingBase: string[] = [];

    if (!verificationForm.outlet_active) {
      missingBase.push(isId ? 'Outlet aktif' : 'Active outlet');
    }
    if (!verificationForm.owner_email) {
      missingBase.push(isId ? 'Email pemilik' : 'Owner email');
    }
    if (!verificationForm.owner_phone) {
      missingBase.push(isId ? 'HP pemilik' : 'Owner phone');
    }
    if (!verificationForm.outlet_phone && !selectedStore?.phone) {
      missingBase.push(isId ? 'Telepon outlet' : 'Outlet phone');
    }
    if (!selectedStore?.address) {
      missingBase.push(isId ? 'Alamat outlet' : 'Outlet address');
    }
    if (!verificationForm.ktp_number || !verificationForm.ktp_url) {
      missingBase.push(isId ? 'KTP + foto' : 'ID + photo');
    }
    if (
      !verificationForm.bank_name ||
      !verificationForm.bank_account_name ||
      !verificationForm.bank_account_number
    ) {
      missingBase.push(isId ? 'Rekening bank' : 'Bank account');
    }

    if (verificationForm.legal_type === 'company') {
      if (!verificationForm.npwp_number || !verificationForm.npwp_url) {
        missingBase.push(isId ? 'NPWP perusahaan' : 'Company NPWP');
      }
      if (!verificationForm.business_license_url) {
        missingBase.push(isId ? 'NIB/SIUP' : 'Business license');
      }
      if (!verificationForm.deed_url) {
        missingBase.push(isId ? 'Akta pendirian' : 'Deed of establishment');
      }
      if (!verificationForm.director_id_url) {
        missingBase.push(isId ? 'KTP direksi' : 'Director ID');
      }
    }

    const foodMissing = [...missingBase];
    if (!verificationForm.store_photo_url) {
      foodMissing.push(isId ? 'Foto outlet' : 'Store photo');
    }
    if (!verificationForm.menu_photo_url) {
      foodMissing.push(isId ? 'Foto menu' : 'Menu photo');
    }

    const martMissing = [...missingBase];
    if (!verificationForm.store_photo_url) {
      martMissing.push(isId ? 'Foto outlet' : 'Store photo');
    }

    return {
      food: { ok: foodMissing.length === 0, missing: foodMissing },
      mart: { ok: martMissing.length === 0, missing: martMissing },
    };
  }, [isId, selectedStore?.address, selectedStore?.phone, verificationForm]);

  const paidRevenueCents = useMemo(
    () =>
      orders.reduce(
        (sum, order) =>
          order.payment_status === 'paid'
            ? sum + Math.max(order.total_cents, 0)
            : sum,
        0,
      ),
    [orders],
  );

  const lowStockCount = useMemo(
    () =>
      products.filter(
        product => product.stock_qty > 0 && product.stock_qty <= 5,
      ).length,
    [products],
  );

  const outOfStockCount = useMemo(
    () => products.filter(product => product.stock_qty <= 0).length,
    [products],
  );

  const hasEnabledPublishChannel =
    verificationForm.publish_food || verificationForm.publish_mart;
  const verificationPublishServices = useMemo(
    () => [
      ...(verificationForm.publish_food ? (['food'] as const) : []),
      ...(verificationForm.publish_mart ? (['mart'] as const) : []),
    ],
    [verificationForm.publish_food, verificationForm.publish_mart],
  );

  const storeListInsights = useMemo(
    () =>
      myStores.map(store => {
        const meta = store.metadata || {};
        const selected = store.id === selectedStoreId;
        const services = derivePublishServices(meta);
        const businessCategory = readBusinessCategory(meta);
        const businessCategoryLabel = businessCategory
          ? getUmkmBusinessCategoryLabel(businessCategory, isId)
          : '';
        const storePresence = getUmkmLivePresence(meta);
        const presenceLabel = getUmkmLocationModeLabel(
          storePresence.locationMode,
          isId,
        );
        const roleLabel = store.access_role
          ? teamRoleLabel(store.access_role, isId)
          : isId
            ? 'Pemilik'
            : 'Owner';
        const isActive =
          readMetaBool(meta, 'outlet_active') ||
          store.online_order_enabled ||
          store.offline_order_enabled;
        const liveNow = readMetaBool(meta, 'live_now');
        const ownerEmail = readMetaString(meta, 'owner_email').trim();
        const ownerPhone = readMetaString(meta, 'owner_phone').trim();
        const outletPhone =
          readMetaString(meta, 'outlet_phone').trim() ||
          store.phone?.trim() ||
          '';
        const hasOwnerContact = Boolean(ownerEmail && ownerPhone);
        const hasOutletPhone = Boolean(outletPhone);
        const hasIdentity = Boolean(
          readMetaString(meta, 'ktp_number').trim() &&
          readMetaString(meta, 'ktp_url').trim(),
        );
        const hasFinance = Boolean(
          readMetaString(meta, 'bank_name').trim() &&
          readMetaString(meta, 'bank_account_name').trim() &&
          readMetaString(meta, 'bank_account_number').trim(),
        );
        const hasStorePhoto = Boolean(
          readMetaString(meta, 'store_photo_url').trim(),
        );
        const hasMenuPhoto = Boolean(
          readMetaString(meta, 'menu_photo_url').trim(),
        );
        const hasSellingChannel = Boolean(
          services.length > 0 ||
          store.online_order_enabled ||
          store.offline_order_enabled,
        );

        const readinessChecks = [
          {
            label: isId ? 'Outlet aktif' : 'Active outlet',
            done: isActive,
          },
          {
            label: isId ? 'Kontak pemilik' : 'Owner contact',
            done: hasOwnerContact,
          },
          {
            label: isId ? 'Telepon outlet' : 'Outlet phone',
            done: hasOutletPhone,
          },
          {
            label: isId ? 'Identitas usaha' : 'Business identity',
            done: hasIdentity,
          },
          {
            label: isId ? 'Rekening bank' : 'Bank account',
            done: hasFinance,
          },
          {
            label: isId ? 'Foto outlet' : 'Store photo',
            done: hasStorePhoto,
          },
          ...(services.includes('food')
            ? [
              {
                label: isId ? 'Foto menu' : 'Menu photo',
                done: hasMenuPhoto,
              },
            ]
            : []),
          {
            label: isId ? 'Kanal jual' : 'Selling channel',
            done: hasSellingChannel,
          },
        ];

        const readinessDone = readinessChecks.filter(item => item.done).length;
        const readinessPercent = readinessChecks.length
          ? Math.round((readinessDone / readinessChecks.length) * 100)
          : 0;
        const missingItems = readinessChecks
          .filter(item => !item.done)
          .map(item => item.label);
        const attentionCount = missingItems.length;
        const needsAttention = attentionCount > 0;
        const readyNow = isActive && !needsAttention;
        const serviceLabels = services.map(service =>
          getUmkmPublishServiceLabel(service, isId),
        );
        const channelLabel =
          store.online_order_enabled && store.offline_order_enabled
            ? isId
              ? 'Online + offline'
              : 'Online + offline'
            : store.online_order_enabled
              ? 'Online'
              : store.offline_order_enabled
                ? 'Offline'
                : serviceLabels.length > 0
                  ? serviceLabels.join(' + ')
                  : isId
                    ? 'Belum dipilih'
                    : 'Not set';

        let nextActionLabel = isId ? 'Buka workspace' : 'Open workspace';
        let nextActionDesc = isId
          ? 'Outlet ini sudah cukup rapi untuk dipakai owner.'
          : 'This outlet is structured enough for daily owner use.';

        if (!isActive) {
          nextActionLabel = isId ? 'Aktifkan outlet' : 'Activate outlet';
          nextActionDesc = isId
            ? 'Nyalakan outlet biar siap dipakai.'
            : 'Turn the outlet on so the team and buyers can use it.';
        } else if (!hasOwnerContact) {
          nextActionLabel = isId
            ? 'Lengkapi kontak pemilik'
            : 'Complete owner contact';
          nextActionDesc = isId
            ? 'Isi email dan nomor owner untuk operasional inti.'
            : 'Add the owner email and phone for core operations.';
        } else if (!hasIdentity) {
          nextActionLabel = isId ? 'Upload identitas' : 'Upload identity';
          nextActionDesc = isId
            ? 'KTP dan identitas dasar masih dibutuhkan.'
            : 'ID and core verification details are still needed.';
        } else if (!hasFinance) {
          nextActionLabel = isId
            ? 'Sambungkan rekening'
            : 'Connect bank account';
          nextActionDesc = isId
            ? 'Pencairan dan trust belum lengkap tanpa rekening bisnis.'
            : 'Payout and trust stay incomplete without a bank account.';
        } else if (!hasSellingChannel) {
          nextActionLabel = isId
            ? 'Pilih kanal jual'
            : 'Choose selling channels';
          nextActionDesc = isId
            ? 'Tentukan alur jualan online, offline, atau keduanya.'
            : 'Set whether this business sells online, offline, or both.';
        } else if (!hasStorePhoto) {
          nextActionLabel = isId ? 'Tambah foto outlet' : 'Add store photo';
          nextActionDesc = isId
            ? 'Foto outlet bantu buyer dan tim cepat paham konteks usaha.'
            : 'A storefront photo gives buyers and staff faster context.';
        } else if (services.includes('food') && !hasMenuPhoto) {
          nextActionLabel = isId ? 'Tambah foto menu' : 'Add menu photo';
          nextActionDesc = isId
            ? 'Channel food lebih siap kalau menu sudah punya visual.'
            : 'Food flow works better when the menu already has visuals.';
        }

        const healthLabel = readyNow
          ? isId
            ? 'Siap jalan'
            : 'Ready'
          : `${attentionCount} ${isId ? 'prioritas' : 'priorities'}`;
        const healthTone = readyNow
          ? ('success' as const)
          : isActive
            ? ('warning' as const)
            : ('default' as const);
        const status = selected
          ? isId
            ? 'Sedang dipakai'
            : 'Currently selected'
          : readyNow
            ? isId
              ? 'Siap dikelola'
              : 'Ready to manage'
            : isActive
              ? isId
                ? 'Perlu follow-up'
                : 'Needs follow-up'
              : isId
                ? 'Masih disiapkan'
                : 'Still setting up';
        const summary = readyNow
          ? isId
            ? 'Data inti, trust, dan kanal jual sudah cukup rapi buat dipakai harian.'
            : 'Core data, trust, and sales channels are tidy enough for daily work.'
          : isId
            ? `Masih perlu: ${missingItems
              .slice(0, 3)
              .join(
                ', ',
              )}${attentionCount > 3 ? `, +${attentionCount - 3} lainnya` : ''}.`
            : `Still missing: ${missingItems
              .slice(0, 3)
              .join(
                ', ',
              )}${attentionCount > 3 ? `, +${attentionCount - 3} more` : ''}.`;

        const badges = [
          ...(businessCategoryLabel
            ? [
              {
                label: businessCategoryLabel,
                tone: 'accent' as const,
              },
            ]
            : []),
          {
            label: presenceLabel,
            tone: 'default' as const,
          },
          {
            label: isActive
              ? isId
                ? 'Outlet aktif'
                : 'Outlet active'
              : isId
                ? 'Belum aktif'
                : 'Not active yet',
            tone: isActive ? ('success' as const) : ('warning' as const),
          },
          ...(liveNow
            ? [
              {
                label: 'Live',
                tone: 'accent' as const,
              },
            ]
            : []),
          ...(store.online_order_enabled
            ? [
              {
                label: 'Online',
                tone: 'accent' as const,
              },
            ]
            : []),
          ...(store.offline_order_enabled
            ? [
              {
                label: 'Offline',
                tone: 'default' as const,
              },
            ]
            : []),
          {
            label: roleLabel,
            tone:
              store.access_role === 'owner' || !store.access_role
                ? ('accent' as const)
                : ('default' as const),
          },
          ...serviceLabels.map(label => ({
            label,
            tone: 'default' as const,
          })),
        ];

        const metrics = [
          {
            label: isId ? 'Status' : 'Status',
            value: liveNow
              ? 'Live'
              : isActive
                ? isId
                  ? 'Aktif'
                  : 'Active'
                : isId
                  ? 'Draft'
                  : 'Draft',
            tone: liveNow
              ? ('accent' as const)
              : isActive
                ? ('success' as const)
                : ('warning' as const),
          },
          {
            label: isId ? 'Kanal' : 'Channels',
            value: channelLabel,
            tone: hasSellingChannel
              ? ('accent' as const)
              : ('default' as const),
          },
          {
            label: isId ? 'Peran' : 'Role',
            value: roleLabel,
            tone:
              store.access_role === 'owner' || !store.access_role
                ? ('accent' as const)
                : ('default' as const),
          },
        ];

        const searchHaystack = [
          store.name,
          store.city,
          store.address,
          businessCategoryLabel,
          presenceLabel,
          roleLabel,
          serviceLabels.join(' '),
          nextActionLabel,
          summary,
        ]
          .join(' ')
          .toLowerCase();

        return {
          store,
          selected,
          isActive,
          liveNow,
          needsAttention,
          readyNow,
          readinessPercent,
          status,
          healthLabel,
          healthTone,
          summary,
          badges,
          metrics,
          nextActionLabel,
          nextActionDesc,
          actionLabel: selected
            ? isId
              ? 'Lanjut kelola'
              : 'Continue managing'
            : isId
              ? 'Kelola outlet'
              : 'Manage outlet',
          secondaryActionHref: store.slug
            ? buildUmkmStorefrontPath(store.slug)
            : undefined,
          secondaryActionLabel: store.slug ? storefrontActionLabel : undefined,
          searchHaystack,
        };
      }),
    [isId, myStores, selectedStoreId, storefrontActionLabel],
  );

  const activeStoreCount = useMemo(
    () => storeListInsights.filter(item => item.isActive).length,
    [storeListInsights],
  );

  const readyStoreCount = useMemo(
    () => storeListInsights.filter(item => item.readyNow).length,
    [storeListInsights],
  );

  const storeAttentionCount = useMemo(
    () => storeListInsights.filter(item => item.needsAttention).length,
    [storeListInsights],
  );

  const liveStoreCount = useMemo(
    () => storeListInsights.filter(item => item.liveNow).length,
    [storeListInsights],
  );

  const selectedStoreInsight = useMemo(
    () => storeListInsights.find(item => item.selected) || null,
    [storeListInsights],
  );

  const storeListFilterOptions = useMemo(
    () => [
      {
        id: 'all' as const,
        label: isId ? 'Semua' : 'All',
        count: storeListInsights.length,
      },
      {
        id: 'attention' as const,
        label: isId ? 'Perlu aksi' : 'Needs action',
        count: storeAttentionCount,
      },
      {
        id: 'active' as const,
        label: isId ? 'Aktif' : 'Active',
        count: activeStoreCount,
      },
      {
        id: 'live' as const,
        label: 'Live',
        count: liveStoreCount,
      },
    ],
    [
      activeStoreCount,
      isId,
      liveStoreCount,
      storeAttentionCount,
      storeListInsights.length,
    ],
  );

  const filteredStoreList = useMemo(() => {
    const query = deferredStoreListQuery.trim().toLowerCase();

    const items = storeListInsights.filter(item => {
      if (query && !item.searchHaystack.includes(query)) return false;
      if (storeListFilter === 'attention') return item.needsAttention;
      if (storeListFilter === 'active') return item.isActive;
      if (storeListFilter === 'live') return item.liveNow;
      return true;
    });

    const rank = (item: (typeof items)[number]) =>
      (item.selected ? 100 : 0) +
      (item.needsAttention ? 40 : 0) +
      (item.isActive ? 20 : 0) +
      (item.liveNow ? 10 : 0);

    return [...items].sort((left, right) => {
      const diff = rank(right) - rank(left);
      if (diff !== 0) return diff;
      return left.store.name.localeCompare(
        right.store.name,
        isId ? 'id' : 'en',
      );
    });
  }, [deferredStoreListQuery, isId, storeListFilter, storeListInsights]);

  const hasStoreListQuery = storeListQuery.trim().length > 0;

  const storeListEmptyMessage =
    storeListFilter === 'attention'
      ? isId
        ? 'Tidak ada outlet yang butuh follow-up untuk filter ini.'
        : 'There are no outlets needing follow-up for this filter.'
      : storeListFilter === 'active'
        ? isId
          ? 'Belum ada outlet aktif pada filter ini.'
          : 'There are no active outlets for this filter.'
        : storeListFilter === 'live'
          ? isId
            ? 'Belum ada outlet yang live sekarang.'
            : 'There are no live outlets right now.'
          : hasStoreListQuery
            ? isId
              ? 'Tidak ada outlet yang cocok dengan pencarian ini.'
              : 'No outlet matches this search.'
            : isId
              ? 'Belum ada outlet yang bisa ditampilkan.'
              : 'There are no outlets to show yet.';

  const portfolioAttentionStores = useMemo(
    () =>
      [...storeListInsights]
        .filter(item => item.needsAttention && !item.selected)
        .sort((left, right) => {
          const readinessDiff = left.readinessPercent - right.readinessPercent;
          if (readinessDiff !== 0) return readinessDiff;
          if (left.liveNow !== right.liveNow) {
            return Number(right.liveNow) - Number(left.liveNow);
          }
          return left.store.name.localeCompare(
            right.store.name,
            isId ? 'id' : 'en',
          );
        }),
    [isId, storeListInsights],
  );

  const portfolioReadyStores = useMemo(
    () =>
      [...storeListInsights]
        .filter(item => item.readyNow && !item.selected)
        .sort((left, right) => {
          if (left.liveNow !== right.liveNow) {
            return Number(right.liveNow) - Number(left.liveNow);
          }
          const readinessDiff = right.readinessPercent - left.readinessPercent;
          if (readinessDiff !== 0) return readinessDiff;
          return left.store.name.localeCompare(
            right.store.name,
            isId ? 'id' : 'en',
          );
        }),
    [isId, storeListInsights],
  );

  const portfolioPriorityStore = useMemo(
    () =>
      selectedStoreInsight ||
      portfolioAttentionStores[0] ||
      filteredStoreList[0] ||
      null,
    [filteredStoreList, portfolioAttentionStores, selectedStoreInsight],
  );

  const portfolioNextStore = useMemo(
    () => portfolioAttentionStores[0] || portfolioReadyStores[0] || null,
    [portfolioAttentionStores, portfolioReadyStores],
  );

  useEffect(() => {
    if (!copyMessage) return;
    const timer = window.setTimeout(() => setCopyMessage(null), 2200);
    return () => window.clearTimeout(timer);
  }, [copyMessage]);

  useEffect(() => {
    if (!basicStoreMessage) return;
    const timer = window.setTimeout(() => setBasicStoreMessage(null), 2600);
    return () => window.clearTimeout(timer);
  }, [basicStoreMessage]);

  useEffect(() => {
    if (!teamMessage) return;
    const timer = window.setTimeout(() => setTeamMessage(null), 2400);
    return () => window.clearTimeout(timer);
  }, [teamMessage]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    const timer = window.setTimeout(() => {
      document
        .getElementById(hash)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 120);
    return () => window.clearTimeout(timer);
  }, [currentWorkspace, selectedStoreId, loadingStoreData]);

  const loadMyStores = useCallback(async () => {
    setLoadingStores(true);
    setPageError(null);
    try {
      const res = await authFetch('/api/super-app/umkm/stores?mine=1&limit=50');
      const payload = (await res.json().catch(() => ({}))) as StoresResponse;
      if (!res.ok || !payload.data) {
        throw new Error(payload.error || 'Failed to load businesses');
      }
      const items = payload.data.items || [];
      setMyStores(items);
      setSelectedStoreId(current => {
        const savedStoreId =
          typeof window !== 'undefined'
            ? window.localStorage
              .getItem(UMKM_ACTIVE_STORE_STORAGE_KEY)
              ?.trim() || ''
            : '';
        const useBlankCreateSelection = !forcedStoreId && isSetupCreateView;

        if (useBlankCreateSelection) {
          return '';
        }

        if (
          requestedStoreId &&
          items.some(item => item.id === requestedStoreId)
        ) {
          return requestedStoreId;
        }
        if (current && items.some(item => item.id === current)) return current;
        if (savedStoreId && items.some(item => item.id === savedStoreId)) {
          return savedStoreId;
        }
        return items[0]?.id || '';
      });
    } catch (error) {
      setPageError(
        error instanceof Error
          ? error.message
          : isId
            ? 'Gagal memuat usaha milik Anda.'
            : 'Failed to load your businesses.',
      );
    } finally {
      setLoadingStores(false);
    }
  }, [authFetch, forcedStoreId, isId, isSetupCreateView, requestedStoreId]);

  const loadStoreData = useCallback(
    async (storeId: string) => {
      if (!storeId) return;

      const requestId = ++storeRequestRef.current;
      setLoadingStoreData(true);
      setPageError(null);

      try {
        const [productRes, tableRes, qrRes, orderRes, reservationRes, teamRes] =
          await Promise.all([
            authFetch(
              `/api/super-app/umkm/stores/${storeId}/products?include_unavailable=1`,
            ),
            authFetch(`/api/super-app/umkm/stores/${storeId}/tables`),
            authFetch(`/api/super-app/umkm/stores/${storeId}/qr`),
            authFetch(
              `/api/super-app/umkm/orders?store_id=${encodeURIComponent(storeId)}&limit=120`,
            ),
            authFetch(
              `/api/super-app/umkm/reservations?store_id=${encodeURIComponent(storeId)}&limit=120`,
            ),
            authFetch(`/api/super-app/umkm/stores/${storeId}/team?limit=120`),
          ]);

        const [
          productPayload,
          tablePayload,
          qrPayload,
          orderPayload,
          reservationPayload,
          teamPayload,
        ] = (await Promise.all([
          productRes.json().catch(() => ({})),
          tableRes.json().catch(() => ({})),
          qrRes.json().catch(() => ({})),
          orderRes.json().catch(() => ({})),
          reservationRes.json().catch(() => ({})),
          teamRes.json().catch(() => ({})),
        ])) as [
            CollectionResponse<ProductRecord>,
            CollectionResponse<TableRecord>,
            CollectionResponse<QrRecord>,
            CollectionResponse<OrderRecord>,
            CollectionResponse<ReservationRecord>,
            CollectionResponse<TeamMemberRecord>,
          ];

        if (!productRes.ok || !productPayload.data) {
          throw new Error(productPayload.error || 'Failed to load products');
        }
        if (!tableRes.ok || !tablePayload.data) {
          throw new Error(tablePayload.error || 'Failed to load tables');
        }
        if (!qrRes.ok || !qrPayload.data) {
          throw new Error(qrPayload.error || 'Failed to load QR tokens');
        }
        if (!orderRes.ok || !orderPayload.data) {
          throw new Error(orderPayload.error || 'Failed to load orders');
        }
        if (!reservationRes.ok || !reservationPayload.data) {
          throw new Error(
            reservationPayload.error || 'Failed to load reservations',
          );
        }
        if (!teamRes.ok || !teamPayload.data) {
          throw new Error(teamPayload.error || 'Failed to load team members');
        }

        if (requestId !== storeRequestRef.current) return;

        setProducts(productPayload.data.items || []);
        setTables(tablePayload.data.items || []);
        setQrs(qrPayload.data.items || []);
        setOrders(orderPayload.data.items || []);
        setReservations(reservationPayload.data.items || []);
        setTeamMembers(teamPayload.data.items || []);
      } catch (error) {
        if (requestId !== storeRequestRef.current) return;

        setPageError(
          error instanceof Error
            ? error.message
            : isId
              ? 'Gagal memuat detail operasional toko.'
              : 'Failed to load store operational data.',
        );
      } finally {
        if (requestId === storeRequestRef.current) {
          setLoadingStoreData(false);
        }
      }
    },
    [authFetch, isId],
  );

  useEffect(() => {
    if (authLoading || !isAuthenticated) return;
    void loadMyStores();
  }, [authLoading, isAuthenticated, loadMyStores]);

  useEffect(() => {
    if (!requestedStoreId || (!forcedStoreId && isSetupCreateView)) {
      return;
    }
    setSelectedStoreId(current =>
      current === requestedStoreId ? current : requestedStoreId,
    );
  }, [forcedStoreId, isSetupCreateView, requestedStoreId]);

  useEffect(() => {
    setLiveLocationMessage(null);
  }, [selectedStoreId]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!selectedStoreId && !forcedStoreId && isSetupCreateView) {
      return;
    }
    if (selectedStoreId) {
      window.localStorage.setItem(
        UMKM_ACTIVE_STORE_STORAGE_KEY,
        selectedStoreId,
      );
    } else {
      window.localStorage.removeItem(UMKM_ACTIVE_STORE_STORAGE_KEY);
    }
  }, [forcedStoreId, isSetupCreateView, selectedStoreId]);

  useEffect(() => {
    if (forcedStoreId) return;
    if (!isSetupCreateView && !isSetupListView) return;

    const currentStoreParam = (searchParams.get('store') || '').trim();
    if (!currentStoreParam) return;

    const params = new URLSearchParams(searchParams.toString());
    params.delete('store');
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname);
  }, [
    forcedStoreId,
    isSetupCreateView,
    isSetupListView,
    pathname,
    router,
    searchParams,
  ]);

  useEffect(() => {
    if (!selectedStoreId) return;
    void loadStoreData(selectedStoreId);
  }, [loadStoreData, selectedStoreId]);

  useEffect(() => {
    if (!selectedStore) return;
    const meta = selectedStore.metadata || {};
    const publishServices = derivePublishServices(meta);
    const businessCategory =
      readBusinessCategory(meta) || storeForm.business_category;
    const recommendedServices =
      getUmkmRecommendedPublishServices(businessCategory);
    const capabilities = parseCapabilityList(
      meta.business_capabilities ?? meta.capabilities,
      businessCategory,
    );
    const customFields = parseCustomFieldDefinitions(
      meta.custom_fields,
      businessCategory,
    );

    setVerificationForm(current => ({
      ...current,
      business_type: businessCategory || current.business_type,
      business_focus:
        readMetaString(meta, 'umkm_focus') ||
        readMetaString(meta, 'business_focus') ||
        current.business_focus,
      business_capabilities: capabilities,
      custom_fields:
        customFields.length > 0
          ? customFields
          : buildDefaultCustomFieldsForBusiness(businessCategory),
      location_mode: normalizeUmkmLocationMode(
        meta.location_mode,
        current.location_mode,
      ),
      live_now: Object.prototype.hasOwnProperty.call(meta, 'live_now')
        ? readMetaBool(meta, 'live_now', current.live_now)
        : readMetaBool(
          meta,
          'outlet_active',
          current.live_now ||
          selectedStore.online_order_enabled ||
          selectedStore.offline_order_enabled,
        ),
      auto_live_schedule_enabled: readMetaBool(
        meta,
        'auto_live_schedule_enabled',
        current.auto_live_schedule_enabled,
      ),
      live_schedule_days:
        parseUmkmLiveScheduleDays(meta.live_schedule_days).length > 0
          ? parseUmkmLiveScheduleDays(meta.live_schedule_days)
          : current.live_schedule_days,
      live_schedule_start:
        readMetaString(meta, 'live_schedule_start') ||
        current.live_schedule_start,
      live_schedule_end:
        readMetaString(meta, 'live_schedule_end') || current.live_schedule_end,
      legal_type:
        readMetaString(meta, 'legal_type') ||
        (current.legal_type === 'company' ? 'company' : 'individual'),
      outlet_active: readMetaBool(meta, 'outlet_active', current.outlet_active),
      lat: Number.isFinite(selectedStore.lat)
        ? selectedStore.lat.toFixed(6)
        : current.lat,
      lng: Number.isFinite(selectedStore.lng)
        ? selectedStore.lng.toFixed(6)
        : current.lng,
      owner_name: readMetaString(meta, 'owner_name') || current.owner_name,
      owner_email:
        readMetaString(meta, 'owner_email') ||
        user?.email ||
        current.owner_email,
      owner_phone:
        readMetaString(meta, 'owner_phone') ||
        user?.phone ||
        current.owner_phone,
      outlet_phone:
        readMetaString(meta, 'outlet_phone') ||
        selectedStore.phone ||
        current.outlet_phone,
      established_year:
        String(readMetaNumber(meta, 'established_year') || '').trim() ||
        current.established_year,
      ktp_number: readMetaString(meta, 'ktp_number') || current.ktp_number,
      ktp_url: readMetaString(meta, 'ktp_url') || current.ktp_url,
      npwp_number: readMetaString(meta, 'npwp_number') || current.npwp_number,
      npwp_url: readMetaString(meta, 'npwp_url') || current.npwp_url,
      bank_name: readMetaString(meta, 'bank_name') || current.bank_name,
      bank_account_name:
        readMetaString(meta, 'bank_account_name') || current.bank_account_name,
      bank_account_number:
        readMetaString(meta, 'bank_account_number') ||
        current.bank_account_number,
      bank_proof_url:
        readMetaString(meta, 'bank_proof_url') || current.bank_proof_url,
      business_license_url:
        readMetaString(meta, 'business_license_url') ||
        current.business_license_url,
      deed_url: readMetaString(meta, 'deed_url') || current.deed_url,
      director_id_url:
        readMetaString(meta, 'director_id_url') || current.director_id_url,
      store_photo_url:
        readMetaString(meta, 'store_photo_url') || current.store_photo_url,
      menu_photo_url:
        readMetaString(meta, 'menu_photo_url') || current.menu_photo_url,
      publish_food:
        publishServices.length > 0
          ? publishServices.includes('food')
          : recommendedServices.includes('food'),
      publish_mart:
        publishServices.length > 0
          ? publishServices.includes('mart')
          : recommendedServices.includes('mart'),
    }));
  }, [selectedStore, storeForm.business_category, user?.email, user?.phone]);

  useEffect(() => {
    if (!selectedStore) {
      setBasicStoreForm(createBasicStoreEditFormState());
      return;
    }

    setBasicStoreForm({
      name: selectedStore.name || '',
      description: selectedStore.description || '',
      city: selectedStore.city || '',
      address: selectedStore.address || '',
      phone: selectedStore.phone || '',
    });
  }, [selectedStore]);

  useEffect(() => {
    if (canShareLiveLocation) return;
    setLiveLocationSharing(false);
    lastLiveLocationSyncRef.current = null;
    setLiveLocationMessage(null);
  }, [canShareLiveLocation]);

  useEffect(() => {
    if (!selectedStoreId || !liveLocationSharing || !canShareLiveLocation) {
      if (liveLocationWatchRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(liveLocationWatchRef.current);
        liveLocationWatchRef.current = null;
      }
      return;
    }

    if (!navigator.geolocation) {
      setLiveLocationMessage(
        isId
          ? 'Browser ini tidak mendukung live location.'
          : 'This browser does not support live location.',
      );
      return;
    }

    let active = true;
    setLiveLocationMessage(
      isId
        ? 'Live location aktif. Titik akan ikut bergerak selama halaman ini terbuka.'
        : 'Live location is active while this page stays open.',
    );

    const pushLiveLocation = async (lat: number, lng: number) => {
      const now = Date.now();
      const lastSync = lastLiveLocationSyncRef.current;
      if (
        lastSync &&
        now - lastSync.sentAt < 45000 &&
        Math.abs(lastSync.lat - lat) < 0.00025 &&
        Math.abs(lastSync.lng - lng) < 0.00025
      ) {
        return;
      }

      lastLiveLocationSyncRef.current = { lat, lng, sentAt: now };
      setVerificationForm(current => ({
        ...current,
        lat: lat.toFixed(6),
        lng: lng.toFixed(6),
      }));

      try {
        await authFetch(`/api/super-app/umkm/stores/${selectedStoreId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            lat,
            lng,
            metadata: {
              location_mode: 'mobile',
              live_now: true,
              last_live_location_at: new Date(now).toISOString(),
            },
          }),
        });
        if (!active) return;
        setLiveLocationMessage(
          isId
            ? `Lokasi live tersinkron ${new Date(now).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}.`
            : `Live location synced at ${new Date(now).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}.`,
        );
      } catch {
        if (!active) return;
        setLiveLocationMessage(
          isId
            ? 'Lokasi bergerak tidak berhasil disinkronkan. Cek koneksi lalu coba lagi.'
            : 'Moving location failed to sync. Check the connection and retry.',
        );
      }
    };

    liveLocationWatchRef.current = navigator.geolocation.watchPosition(
      position => {
        void pushLiveLocation(
          position.coords.latitude,
          position.coords.longitude,
        );
      },
      () => {
        if (!active) return;
        setLiveLocationMessage(
          isId
            ? 'Izinkan lokasi biar titik PKL ikut bergerak.'
            : 'Location permission is required to keep the mobile vendor pin moving.',
        );
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 15000,
      },
    );

    return () => {
      active = false;
      if (liveLocationWatchRef.current !== null) {
        navigator.geolocation.clearWatch(liveLocationWatchRef.current);
        liveLocationWatchRef.current = null;
      }
    };
  }, [
    authFetch,
    canShareLiveLocation,
    isId,
    liveLocationSharing,
    selectedStoreId,
  ]);

  useEffect(() => {
    return () => {
      if (liveLocationWatchRef.current !== null && navigator.geolocation) {
        navigator.geolocation.clearWatch(liveLocationWatchRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!selectedStore) return;
    const publishSet = new Set(storePublishServices);
    const allowedCategories = new Set(
      productCategoryOptions.map(item => item.id),
    );
    const nextDefaultCategory = getDefaultProductCategoryForBusiness(
      selectedBusinessCategory,
    );
    const defaultChannels = new Set(
      getUmkmDefaultChannelsForBusiness(selectedBusinessCategory),
    );
    const defaultKind = getUmkmDefaultProductKindForBusiness(
      selectedBusinessCategory,
    );
    setProductForm(current => {
      const nextKind =
        defaultKind === 'digital' &&
          !products.length &&
          !current.name &&
          !current.description &&
          !current.image_url
          ? 'digital'
          : current.product_kind;

      return {
        ...current,
        category: allowedCategories.has(
          current.category as typeof nextDefaultCategory,
        )
          ? current.category
          : nextDefaultCategory,
        product_kind: nextKind,
        allow_pickup:
          nextKind === 'physical'
            ? current.allow_pickup ||
            selectedBusinessCapabilities.includes('pickup')
            : false,
        allow_courier_shipping:
          nextKind === 'physical'
            ? current.allow_courier_shipping ||
            supportsShipping(selectedBusinessCapabilities)
            : false,
        publish_food: publishSet.has('food'),
        publish_mart: publishSet.has('mart'),
        channel_online: current.channel_online || defaultChannels.has('online'),
        channel_offline:
          current.channel_offline || defaultChannels.has('offline'),
        weight_grams:
          nextKind === 'physical' &&
            supportsShipping(selectedBusinessCapabilities)
            ? current.weight_grams || '500'
            : nextKind === 'digital'
              ? '0'
              : current.weight_grams,
        digital_delivery_note:
          nextKind === 'digital' && !current.digital_delivery_note
            ? 'Hasil dikirim online setelah pembayaran dan brief diterima.'
            : current.digital_delivery_note,
      };
    });
  }, [
    productCategoryOptions,
    products.length,
    selectedBusinessCapabilities,
    selectedBusinessCategory,
    selectedStore,
    storePublishServices,
  ]);

  const copyText = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      setCopyMessage(isId ? 'Link disalin' : 'Link copied');
    } catch {
      setCopyMessage(isId ? 'Gagal menyalin link' : 'Failed to copy link');
    }
  };

  const openSetupDetailStep = useCallback((stepId: SetupDetailStepId) => {
    setActiveSetupDetailStep(stepId);
    if (typeof document === 'undefined') return;
    window.requestAnimationFrame(() => {
      document
        .getElementById('umkm-setup-step-panel')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }, []);

  const scrollToSection = (id: string) => {
    if (id === 'umkm-register') {
      router.push(buildSetupHref('create'));
      return;
    }
    const setupDetailStep = setupDetailStepFromTarget(id);
    if (setupDetailStep) {
      if (currentWorkspace === 'setup' && isSetupDetailView) {
        openSetupDetailStep(setupDetailStep);
        return;
      }

      router.push(
        selectedStoreId
          ? buildSetupHref('detail', selectedStoreId, id)
          : buildSetupHref('list'),
      );
      return;
    }
    const targetWorkspace = SECTION_TO_WORKSPACE[id];
    if (targetWorkspace && targetWorkspace !== currentWorkspace) {
      router.push(buildWorkspaceHref(targetWorkspace, selectedStoreId, id));
      return;
    }
    if (typeof document === 'undefined') return;
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  useEffect(() => {
    if (!isSetupDetailView) return;
    if (typeof window === 'undefined') return;

    const hashStep = setupDetailStepFromTarget(
      window.location.hash.replace(/^#/, ''),
    );
    setActiveSetupDetailStep(hashStep || 'basic');
  }, [isSetupDetailView, selectedStoreId]);

  const setStoreCoords = useCallback((lat: string, lng: string) => {
    setStoreForm(current => ({
      ...current,
      lat,
      lng,
    }));
    setSubmitError(null);
  }, []);

  const setVerificationCoords = useCallback((lat: string, lng: string) => {
    setVerificationForm(current => ({
      ...current,
      lat,
      lng,
    }));
    setSubmitError(null);
  }, []);

  const fillCurrentCoords = (target: 'store' | 'verification' = 'store') => {
    if (!navigator.geolocation) {
      setSubmitError(
        isId
          ? 'Browser tidak mendukung geolocation.'
          : 'Browser geolocation is not supported.',
      );
      return;
    }

    navigator.geolocation.getCurrentPosition(
      position => {
        const nextLat = position.coords.latitude.toFixed(6);
        const nextLng = position.coords.longitude.toFixed(6);
        if (target === 'verification') {
          setVerificationCoords(nextLat, nextLng);
          setLiveLocationMessage(
            isId ? 'Titik live berhasil diperbarui.' : 'Live point updated.',
          );
          return;
        }
        setStoreCoords(nextLat, nextLng);
      },
      () => {
        setSubmitError(
          isId
            ? 'Gagal membaca koordinat saat ini.'
            : 'Failed to read current coordinates.',
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    );
  };

  useEffect(() => {
    if (storeCreateStepIndex <= highestUnlockedStoreCreateStepIndex) return;
    setStoreCreateStep(
      STORE_CREATE_STEP_ORDER[highestUnlockedStoreCreateStepIndex],
    );
  }, [highestUnlockedStoreCreateStepIndex, storeCreateStepIndex]);

  const jumpToStoreCreateStep = useCallback(
    (stepId: StoreCreateStepId) => {
      const nextIndex = STORE_CREATE_STEP_ORDER.indexOf(stepId);
      if (nextIndex < 0 || nextIndex > highestUnlockedStoreCreateStepIndex)
        return;
      setStoreCreateStep(stepId);
      setSubmitError(null);
      if (typeof document !== 'undefined') {
        document.getElementById('umkm-register')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        });
      }
    },
    [highestUnlockedStoreCreateStepIndex],
  );

  const moveStoreCreateStep = useCallback(
    (direction: 'next' | 'back') => {
      if (direction === 'back') {
        if (storeCreateStepIndex === 0) return;
        jumpToStoreCreateStep(
          STORE_CREATE_STEP_ORDER[storeCreateStepIndex - 1],
        );
        return;
      }

      if (storeCreateStep === 'identity') {
        const nextAddress =
          normalizeSingleLineInput(storeForm.address).length >= 3
            ? storeForm.address.trim()
            : isGuidedStoreSetup
              ? buildStoreBaseAddress(storeForm.city, storeForm.location_mode)
              : '';

        if (nextAddress && nextAddress !== storeForm.address) {
          setStoreForm(current => ({
            ...current,
            address:
              normalizeSingleLineInput(current.address).length >= 3
                ? current.address
                : nextAddress,
          }));
        }

        const identityReady =
          normalizeSingleLineInput(storeForm.name).length >= 3 &&
          normalizeSingleLineInput(storeForm.city).length >= 2 &&
          normalizeSingleLineInput(nextAddress).length >= 3;

        if (!identityReady) {
          setSubmitError(
            isId
              ? 'Lengkapi dulu nama usaha, kota, dan alamat basis sebelum lanjut.'
              : 'Complete the business name, city, and base address before continuing.',
          );
          return;
        }
      }

      if (storeCreateStep === 'location' && !storeCreateValidation.location) {
        setSubmitError(
          isId
            ? 'Tentukan titik usaha di peta dulu sebelum lanjut.'
            : 'Set the business point on the map before continuing.',
        );
        return;
      }

      if (storeCreateStepIndex >= STORE_CREATE_STEP_ORDER.length - 1) return;
      jumpToStoreCreateStep(STORE_CREATE_STEP_ORDER[storeCreateStepIndex + 1]);
    },
    [
      buildStoreBaseAddress,
      isId,
      isGuidedStoreSetup,
      jumpToStoreCreateStep,
      storeCreateStep,
      storeCreateStepIndex,
      storeForm.address,
      storeForm.city,
      storeForm.location_mode,
      storeForm.name,
      storeCreateValidation.location,
    ],
  );

  const uploadImage = async (file: File) => {
    const formData = new FormData();
    formData.append('images', file);

    const res = await authFetch('/api/content/upload-images', {
      method: 'POST',
      body: formData,
    });
    const payload = (await res.json().catch(() => ({}))) as {
      urls?: string[];
      error?: string;
    };
    if (!res.ok) throw new Error(payload.error || 'Gagal upload gambar');

    const url = Array.isArray(payload.urls) ? payload.urls[0] : '';
    if (!url) throw new Error('URL gambar tidak ditemukan');
    return url;
  };

  const uploadDocument = async (file: File) => {
    const formData = new FormData();
    formData.append('files', file);

    const res = await authFetch('/api/content/upload-files', {
      method: 'POST',
      body: formData,
    });

    const payload = (await res.json().catch(() => ({}))) as {
      urls?: string[];
      files?: Array<{ url?: string }>;
      error?: string;
    };

    if (!res.ok) throw new Error(payload.error || 'Gagal upload dokumen');

    const url =
      Array.isArray(payload.files) && payload.files[0]?.url
        ? payload.files[0]?.url
        : Array.isArray(payload.urls)
          ? payload.urls[0]
          : '';

    if (!url) throw new Error('URL dokumen tidak ditemukan');
    return url;
  };

  const handleUpload = async (
    key: string,
    file: File | null,
    type: 'image' | 'document',
    onSuccess: (url: string) => void,
  ) => {
    if (!file) return;
    setUploadingKey(key);
    setSubmitError(null);

    try {
      const url =
        type === 'image' ? await uploadImage(file) : await uploadDocument(file);
      onSuccess(url);
    } catch (error) {
      const message = resolveActionErrorMessage(
        error,
        isId ? 'Upload gagal.' : 'Upload failed.',
      );
      setSubmitError(message);
      showHubToast(
        'error',
        isId ? 'Upload belum berhasil' : 'Upload failed',
        message,
      );
    } finally {
      setUploadingKey(null);
    }
  };

  const toggleStoreCapability = (capability: UmkmBusinessCapabilityId) => {
    setStoreForm(current => {
      const exists = current.business_capabilities.includes(capability);
      const nextCapabilities = exists
        ? current.business_capabilities.filter(item => item !== capability)
        : [...current.business_capabilities, capability];
      const nextSupportsTables = supportsDineIn(nextCapabilities);
      return {
        ...current,
        business_capabilities: nextCapabilities,
        table_count: nextSupportsTables
          ? current.table_count && current.table_count !== '0'
            ? current.table_count
            : '6'
          : '0',
      };
    });
  };
  const fillSuggestedStoreAddress = useCallback(() => {
    setStoreForm(current => {
      if (normalizeSingleLineInput(current.address).length >= 3) return current;
      const nextAddress = buildStoreBaseAddress(
        current.city,
        current.location_mode,
      );
      if (!nextAddress) return current;
      return {
        ...current,
        address: nextAddress,
      };
    });
    setSubmitError(null);
  }, [buildStoreBaseAddress]);
  const applyQuickStoreTablePreset = useCallback(
    (preset: 'none' | 'small' | 'medium' | 'large') => {
      setStoreForm(current => {
        const nextCount =
          preset === 'none'
            ? '0'
            : preset === 'small'
              ? '4'
              : preset === 'medium'
                ? '8'
                : '12';
        const nextCapabilities = new Set(current.business_capabilities);

        if (preset === 'none') {
          nextCapabilities.delete('dine_in');
          nextCapabilities.delete('reservations');
        } else {
          nextCapabilities.add('dine_in');
          nextCapabilities.add('reservations');
        }

        return {
          ...current,
          business_capabilities: Array.from(nextCapabilities),
          table_count: nextCount,
          table_prefix: current.table_prefix || 'T',
          default_capacity: current.default_capacity || '4',
        };
      });
      setSubmitError(null);
    },
    [],
  );

  const toggleVerificationCapability = (
    capability: UmkmBusinessCapabilityId,
  ) => {
    setVerificationForm(current => {
      const exists = current.business_capabilities.includes(capability);
      const nextCapabilities = exists
        ? current.business_capabilities.filter(item => item !== capability)
        : [...current.business_capabilities, capability];
      return {
        ...current,
        business_capabilities: nextCapabilities,
      };
    });
  };

  const toggleVerificationScheduleDay = (day: UmkmLiveScheduleDay) => {
    setVerificationForm(current => {
      const exists = current.live_schedule_days.includes(day);
      return {
        ...current,
        live_schedule_days: exists
          ? current.live_schedule_days.filter(item => item !== day)
          : [...current.live_schedule_days, day],
      };
    });
  };

  const addSuggestedCustomField = (field: UmkmCustomFieldDefinition) => {
    setVerificationForm(current => {
      if (current.custom_fields.some(item => item.id === field.id))
        return current;
      return {
        ...current,
        custom_fields: [
          ...current.custom_fields,
          createCustomFieldDefinition(field),
        ],
      };
    });
  };

  const removeCustomField = (fieldId: string) => {
    setVerificationForm(current => ({
      ...current,
      custom_fields: current.custom_fields.filter(
        field => field.id !== fieldId,
      ),
    }));
  };

  const addCustomField = () => {
    const label = customFieldDraft.label.trim();
    if (!label) {
      setSubmitError(
        isId
          ? 'Label kebutuhan custom wajib diisi.'
          : 'A custom field label is required.',
      );
      return;
    }

    const options = customFieldDraft.options
      .split(',')
      .map(item => item.trim())
      .filter(Boolean);

    const field = createCustomFieldDefinition({
      label,
      type: customFieldDraft.type,
      scope: customFieldDraft.scope,
      required: customFieldDraft.required,
      help: customFieldDraft.help,
      options,
    });

    setVerificationForm(current => ({
      ...current,
      custom_fields: [...current.custom_fields, field],
    }));
    setCustomFieldDraft(createCustomFieldDraftState());
    setSubmitError(null);
  };

  const submitStore = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSubmittingStore(true);
    setSubmitError(null);

    try {
      const name = normalizeSingleLineInput(storeForm.name);
      const city = normalizeSingleLineInput(storeForm.city);
      const address = normalizeSingleLineInput(storeForm.address);
      const description = normalizeTextBlock(storeForm.description);
      const phone = normalizeSingleLineInput(storeForm.phone);
      const lat = Number(storeForm.lat);
      const lng = Number(storeForm.lng);
      const supportsTables = supportsDineIn(storeForm.business_capabilities);
      const tableCountInput = storeForm.table_count.trim();
      const defaultCapacityInput = storeForm.default_capacity.trim();
      const tablePrefix = normalizeSingleLineInput(storeForm.table_prefix)
        .toUpperCase()
        .slice(0, STORE_LIMITS.tablePrefix);
      const tableCount = supportsTables ? Number(tableCountInput || '0') : 0;
      const businessCategory = storeForm.business_category;
      const businessFocus = storeForm.business_focus.trim();
      const businessProfile = getUmkmManageProfile(businessCategory);
      const defaultCapacity = supportsTables
        ? Number(defaultCapacityInput || '2')
        : 2;

      if (name.length < 3) {
        throw new Error(
          isId
            ? 'Nama usaha minimal 3 karakter.'
            : 'Business name must be at least 3 characters.',
        );
      }
      if (name.length > STORE_LIMITS.name) {
        throw new Error(
          isId
            ? 'Nama usaha kepanjangan. Maksimal 120 karakter.'
            : 'Business name is too long. Maximum 120 characters.',
        );
      }
      if (city.length < 2) {
        throw new Error(
          isId
            ? 'Kota minimal 2 karakter.'
            : 'City must be at least 2 characters.',
        );
      }
      if (city.length > STORE_LIMITS.city) {
        throw new Error(
          isId
            ? 'Nama kota kepanjangan. Maksimal 80 karakter.'
            : 'City is too long. Maximum 80 characters.',
        );
      }
      if (address.length < 3) {
        throw new Error(
          isId
            ? 'Alamat minimal 3 karakter.'
            : 'Address must be at least 3 characters.',
        );
      }
      if (address.length > STORE_LIMITS.address) {
        throw new Error(
          isId
            ? 'Alamat kepanjangan. Maksimal 240 karakter.'
            : 'Address is too long. Maximum 240 characters.',
        );
      }
      if (description.length > STORE_LIMITS.description) {
        throw new Error(
          isId
            ? 'Deskripsi usaha terlalu panjang. Maksimal 500 karakter.'
            : 'Business description is too long. Maximum 500 characters.',
        );
      }
      if (phone.length > STORE_LIMITS.phone) {
        throw new Error(
          isId
            ? 'Nomor telepon terlalu panjang. Maksimal 40 karakter.'
            : 'Phone number is too long. Maximum 40 characters.',
        );
      }
      if (
        supportsTables &&
        tableCountInput &&
        !isWholeNumber(tableCountInput)
      ) {
        throw new Error(
          isId
            ? 'Jumlah meja harus angka bulat.'
            : 'Table count must be a whole number.',
        );
      }
      if (tableCount < 0 || tableCount > STORE_LIMITS.tableCount) {
        throw new Error(
          isId
            ? 'Jumlah meja harus di antara 0 sampai 200.'
            : 'Table count must stay between 0 and 200.',
        );
      }
      if (!tablePrefix) {
        throw new Error(
          isId
            ? 'Kode awalan meja wajib diisi.'
            : 'A table prefix is required.',
        );
      }
      if (
        normalizeSingleLineInput(storeForm.table_prefix).length >
        STORE_LIMITS.tablePrefix
      ) {
        throw new Error(
          isId
            ? 'Awalan meja terlalu panjang. Maksimal 8 karakter.'
            : 'Table prefix is too long. Maximum 8 characters.',
        );
      }
      if (
        supportsTables &&
        defaultCapacityInput &&
        !isWholeNumber(defaultCapacityInput)
      ) {
        throw new Error(
          isId
            ? 'Kapasitas default harus angka bulat.'
            : 'Default capacity must be a whole number.',
        );
      }
      if (defaultCapacity < 1 || defaultCapacity > STORE_LIMITS.tableCapacity) {
        throw new Error(
          isId
            ? 'Kapasitas default harus di antara 1 sampai 40.'
            : 'Default capacity must stay between 1 and 40.',
        );
      }

      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        throw new Error(isId ? 'Latitude tidak valid.' : 'Invalid latitude.');
      }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        throw new Error(isId ? 'Longitude tidak valid.' : 'Invalid longitude.');
      }

      const res = await authFetch('/api/super-app/umkm/stores', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description: description || undefined,
          city,
          address,
          lat,
          lng,
          phone: phone || undefined,
          online_order_enabled:
            storeForm.business_capabilities.includes('pickup') ||
            storeForm.business_capabilities.includes('courier_shipping') ||
            storeForm.business_capabilities.includes('digital_delivery') ||
            storeForm.business_capabilities.includes('appointments'),
          offline_order_enabled:
            supportsTables ||
            storeForm.business_capabilities.includes('pickup') ||
            storeForm.business_capabilities.includes('field_service'),
          table_count: tableCount,
          table_prefix: tablePrefix || 'T',
          default_capacity: defaultCapacity,
          metadata: {
            recommended_qr: tableCount > 0 ? 'offline' : 'online',
            umkm_category: businessCategory,
            business_type: businessCategory,
            segment: getUmkmBusinessCategoryLabel(businessCategory, true),
            business_profile: businessProfile.id,
            business_capabilities: storeForm.business_capabilities,
            location_mode: storeForm.location_mode,
            outlet_active: false,
            live_now: false,
            ...(businessFocus
              ? { umkm_focus: businessFocus, business_focus: businessFocus }
              : {}),
          },
        }),
      });

      const payload = (await res
        .json()
        .catch(() => ({}))) as CreateStoreResponse;
      if (!res.ok || !payload.data) {
        throw new Error(payload.error || 'Failed to create store');
      }

      setStoreForm(createStoreFormState('culinary'));
      setStoreCreateStep('intro');
      setStoreSetupMode('guided');
      setShowStoreBusinessFocus(false);
      setShowOptionalStoreIdentity(false);
      setShowDetailedStoreOperations(false);
      setLiveLocationSharing(false);
      setLiveLocationMessage(null);
      setShowAdvancedStoreCapabilities(false);

      await loadMyStores();
      setSelectedStoreId(payload.data.store.id);
      showHubToast(
        'success',
        isId ? 'Usaha berhasil disimpan' : 'Business saved',
        isId
          ? 'Lanjut dari prioritas biar cepat siap.'
          : 'Continue from the priority flow so the business becomes usable quickly.',
      );
      router.push(buildWorkspaceHref('overview', payload.data.store.id));
    } catch (error) {
      const message = resolveActionErrorMessage(
        error,
        isId ? 'Gagal mendaftarkan usaha.' : 'Failed to register business.',
      );
      setSubmitError(message);
      showHubToast(
        'error',
        isId ? 'Usaha belum bisa disimpan' : 'Business could not be saved',
        message,
      );
    } finally {
      setSubmittingStore(false);
    }
  };

  const saveVerification = async () => {
    if (!selectedStoreId) return;
    setVerificationSaving(true);
    setVerificationMessage(null);
    setSubmitError(null);

    try {
      const publishServices = [];
      if (verificationForm.publish_food) publishServices.push('food');
      if (verificationForm.publish_mart) publishServices.push('mart');
      const businessCategory = verificationForm.business_type;
      const businessFocus = verificationForm.business_focus.trim();
      const establishedYear = Number(verificationForm.established_year);
      const businessProfile = getUmkmManageProfile(businessCategory);
      const lat = Number(verificationForm.lat);
      const lng = Number(verificationForm.lng);
      const outletPhone = normalizeSingleLineInput(
        verificationForm.outlet_phone,
      );

      if (outletPhone.length > STORE_LIMITS.phone) {
        throw new Error(
          isId
            ? 'Nomor telepon outlet terlalu panjang. Maksimal 40 karakter.'
            : 'Outlet phone is too long. Maximum 40 characters.',
        );
      }

      if (!Number.isFinite(lat) || lat < -90 || lat > 90) {
        throw new Error(
          isId ? 'Latitude live tidak valid.' : 'Invalid live latitude.',
        );
      }
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) {
        throw new Error(
          isId ? 'Longitude live tidak valid.' : 'Invalid live longitude.',
        );
      }

      const res = await authFetch(
        `/api/super-app/umkm/stores/${selectedStoreId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            phone: outletPhone || undefined,
            lat,
            lng,
            metadata: {
              umkm_category: businessCategory,
              business_type: businessCategory,
              store_type: businessCategory,
              segment: getUmkmBusinessCategoryLabel(businessCategory, true),
              business_profile: businessProfile.id,
              business_capabilities: verificationForm.business_capabilities,
              location_mode: verificationForm.location_mode,
              live_now: verificationForm.live_now,
              auto_live_schedule_enabled:
                verificationForm.auto_live_schedule_enabled,
              live_schedule_days: verificationForm.live_schedule_days,
              live_schedule_start: verificationForm.live_schedule_start,
              live_schedule_end: verificationForm.live_schedule_end,
              custom_fields: verificationForm.custom_fields,
              recommended_qr: supportsDineIn(
                verificationForm.business_capabilities,
              )
                ? 'offline'
                : 'online',
              ...(businessFocus
                ? { umkm_focus: businessFocus, business_focus: businessFocus }
                : {}),
              legal_type: verificationForm.legal_type,
              outlet_active: verificationForm.outlet_active,
              owner_name: verificationForm.owner_name || undefined,
              owner_email: verificationForm.owner_email,
              owner_phone: verificationForm.owner_phone,
              outlet_phone: verificationForm.outlet_phone,
              established_year:
                Number.isFinite(establishedYear) && establishedYear >= 1950
                  ? establishedYear
                  : undefined,
              ktp_number: verificationForm.ktp_number,
              ktp_url: verificationForm.ktp_url,
              npwp_number: verificationForm.npwp_number || undefined,
              npwp_url: verificationForm.npwp_url || undefined,
              bank_name: verificationForm.bank_name,
              bank_account_name: verificationForm.bank_account_name,
              bank_account_number: verificationForm.bank_account_number,
              bank_proof_url: verificationForm.bank_proof_url || undefined,
              business_license_url:
                verificationForm.business_license_url || undefined,
              deed_url: verificationForm.deed_url || undefined,
              director_id_url: verificationForm.director_id_url || undefined,
              store_photo_url: verificationForm.store_photo_url || undefined,
              menu_photo_url: verificationForm.menu_photo_url || undefined,
              publish_services: publishServices,
              publish_food: verificationForm.publish_food,
              publish_mart: verificationForm.publish_mart,
            },
          }),
        },
      );

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok)
        throw new Error(payload.error || 'Failed to update verification');

      setVerificationMessage(
        isId ? 'Persyaratan tersimpan.' : 'Verification saved.',
      );
      showHubToast(
        'success',
        isId ? 'Data usaha tersimpan' : 'Business info saved',
        isId
          ? 'Perubahan outlet sudah masuk.'
          : 'The outlet changes have been saved.',
      );
      await loadMyStores();
      await loadStoreData(selectedStoreId);
    } catch (error) {
      const message = resolveActionErrorMessage(
        error,
        isId ? 'Gagal menyimpan persyaratan.' : 'Failed to save verification.',
      );
      setSubmitError(message);
      showHubToast(
        'error',
        isId
          ? 'Data usaha belum tersimpan'
          : 'Business info could not be saved',
        message,
      );
    } finally {
      setVerificationSaving(false);
    }
  };

  const saveBasicStore = async () => {
    if (!selectedStoreId) return;
    setSavingBasicStore(true);
    setBasicStoreMessage(null);
    setSubmitError(null);

    try {
      const name = normalizeSingleLineInput(basicStoreForm.name);
      const city = normalizeSingleLineInput(basicStoreForm.city);
      const address = normalizeSingleLineInput(basicStoreForm.address);
      const phone = normalizeSingleLineInput(basicStoreForm.phone);
      const description = normalizeTextBlock(basicStoreForm.description);

      if (name.length < 3) {
        throw new Error(
          isId
            ? 'Nama usaha minimal 3 karakter.'
            : 'Business name must be at least 3 characters.',
        );
      }
      if (name.length > STORE_LIMITS.name) {
        throw new Error(
          isId
            ? 'Nama usaha kepanjangan. Maksimal 120 karakter.'
            : 'Business name is too long. Maximum 120 characters.',
        );
      }
      if (city.length < 2) {
        throw new Error(
          isId
            ? 'Kota minimal 2 karakter.'
            : 'City must be at least 2 characters.',
        );
      }
      if (city.length > STORE_LIMITS.city) {
        throw new Error(
          isId
            ? 'Nama kota kepanjangan. Maksimal 80 karakter.'
            : 'City is too long. Maximum 80 characters.',
        );
      }
      if (address.length < 3) {
        throw new Error(
          isId
            ? 'Alamat minimal 3 karakter.'
            : 'Address must be at least 3 characters.',
        );
      }
      if (address.length > STORE_LIMITS.address) {
        throw new Error(
          isId
            ? 'Alamat kepanjangan. Maksimal 240 karakter.'
            : 'Address is too long. Maximum 240 characters.',
        );
      }
      if (phone.length > STORE_LIMITS.phone) {
        throw new Error(
          isId
            ? 'Nomor telepon terlalu panjang. Maksimal 40 karakter.'
            : 'Phone number is too long. Maximum 40 characters.',
        );
      }
      if (description.length > STORE_LIMITS.description) {
        throw new Error(
          isId
            ? 'Deskripsi usaha terlalu panjang. Maksimal 500 karakter.'
            : 'Business description is too long. Maximum 500 characters.',
        );
      }

      const res = await authFetch(
        `/api/super-app/umkm/stores/${selectedStoreId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            city,
            address,
            phone,
            description,
          }),
        },
      );

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(payload.error || 'Failed to update outlet info');
      }

      setBasicStoreForm({
        name,
        city,
        address,
        phone,
        description,
      });
      setVerificationForm(current => ({
        ...current,
        outlet_phone: phone,
      }));
      setBasicStoreMessage(
        isId ? 'Info outlet tersimpan.' : 'Outlet info saved.',
      );
      showHubToast(
        'success',
        isId ? 'Info outlet tersimpan' : 'Outlet info saved',
        isId
          ? 'Perubahan hanya diterapkan ke outlet yang sedang dipilih.'
          : 'The changes were applied only to the selected outlet.',
      );
      await loadMyStores();
    } catch (error) {
      const message = resolveActionErrorMessage(
        error,
        isId ? 'Gagal menyimpan info outlet.' : 'Failed to save outlet info.',
      );
      setSubmitError(message);
      showHubToast(
        'error',
        isId ? 'Info outlet belum tersimpan' : 'Outlet info could not be saved',
        message,
      );
    } finally {
      setSavingBasicStore(false);
    }
  };

  const submitProduct = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStoreId) return;

    setSubmittingProduct(true);
    setSubmitError(null);

    try {
      const trimmedName = normalizeSingleLineInput(productForm.name);
      const trimmedDescription = normalizeTextBlock(productForm.description);
      const trimmedImageUrl = normalizeSingleLineInput(productForm.image_url);
      const trimmedDigitalNote = normalizeTextBlock(
        productForm.digital_delivery_note,
      );
      const trimmedBusinessFocus = normalizeSingleLineInput(
        selectedBusinessFocus,
      );
      const trimmedSku = normalizeSingleLineInput(productForm.sku);
      const priceInput = productForm.price_rupiah.trim();
      const stockInput = productForm.stock_qty.trim();
      const prepInput = productForm.prep_minutes.trim();
      const weightInput = productForm.weight_grams.trim();
      const publishServices = [];
      if (productForm.publish_food) publishServices.push('food');
      if (productForm.publish_mart) publishServices.push('mart');

      if (publishServices.includes('food') && !publishReadiness.food.ok) {
        throw new Error(
          isId
            ? `Lengkapi dulu persyaratan kanal Food: ${publishReadiness.food.missing.join(', ')}`
            : `Complete Food channel requirements: ${publishReadiness.food.missing.join(', ')}`,
        );
      }

      if (publishServices.includes('mart') && !publishReadiness.mart.ok) {
        throw new Error(
          isId
            ? `Lengkapi dulu persyaratan kanal Mart: ${publishReadiness.mart.missing.join(', ')}`
            : `Complete Mart channel requirements: ${publishReadiness.mart.missing.join(', ')}`,
        );
      }

      const channels = [];
      if (productForm.channel_online) channels.push('online');
      if (productForm.channel_offline) channels.push('offline');
      if (channels.length === 0) {
        throw new Error(
          isId
            ? 'Aktifkan minimal satu channel: online atau offline.'
            : 'Enable at least one channel: online or offline.',
        );
      }

      if (trimmedName.length < 2) {
        throw new Error(
          isId
            ? 'Nama produk minimal 2 karakter.'
            : 'Product name must be at least 2 characters.',
        );
      }
      if (trimmedName.length > PRODUCT_LIMITS.name) {
        throw new Error(
          isId
            ? 'Nama produk kepanjangan. Maksimal 160 karakter.'
            : 'Product name is too long. Maximum 160 characters.',
        );
      }
      if (trimmedDescription.length > PRODUCT_LIMITS.description) {
        throw new Error(
          isId
            ? 'Deskripsi produk terlalu panjang. Maksimal 600 karakter.'
            : 'Product description is too long. Maximum 600 characters.',
        );
      }
      if (trimmedImageUrl.length > PRODUCT_LIMITS.imageUrl) {
        throw new Error(
          isId
            ? 'Link gambar terlalu panjang. Maksimal 500 karakter.'
            : 'Image URL is too long. Maximum 500 characters.',
        );
      }
      if (trimmedDigitalNote.length > PRODUCT_LIMITS.digitalDeliveryNote) {
        throw new Error(
          isId
            ? 'Catatan pengiriman digital terlalu panjang. Maksimal 200 karakter.'
            : 'Digital delivery note is too long. Maximum 200 characters.',
        );
      }
      if (!isWholeNumber(priceInput)) {
        throw new Error(
          isId
            ? 'Harga produk harus angka bulat.'
            : 'Product price must be a whole number.',
        );
      }
      const priceRupiah = Number(priceInput);
      if (priceRupiah <= 0) {
        throw new Error(
          isId
            ? 'Harga produk harus lebih dari 0.'
            : 'Product price must be greater than 0.',
        );
      }
      if (priceRupiah > PRODUCT_LIMITS.priceRupiah) {
        throw new Error(
          isId
            ? 'Harga produk terlalu besar. Maksimal Rp20.000.000.'
            : 'Product price is too high. Maximum Rp20,000,000.',
        );
      }
      if (stockInput && !isWholeNumber(stockInput)) {
        throw new Error(
          isId ? 'Stok harus angka bulat.' : 'Stock must be a whole number.',
        );
      }
      const stockQty = Number(stockInput || '0');
      if (stockQty < 0 || stockQty > PRODUCT_LIMITS.stockQty) {
        throw new Error(
          isId
            ? 'Stok harus di antara 0 sampai 1.000.000.'
            : 'Stock must stay between 0 and 1,000,000.',
        );
      }
      if (prepInput && !isWholeNumber(prepInput)) {
        throw new Error(
          isId
            ? 'Estimasi proses harus angka bulat.'
            : 'Preparation time must be a whole number.',
        );
      }
      const prepMinutes = Number(prepInput || '1');
      if (prepMinutes < 1) {
        throw new Error(
          isId
            ? 'Estimasi proses minimal 1 menit.'
            : 'Preparation time must be at least 1 minute.',
        );
      }
      if (weightInput && !isWholeNumber(weightInput)) {
        throw new Error(
          isId ? 'Berat harus angka bulat.' : 'Weight must be a whole number.',
        );
      }
      const weightGrams = Number(weightInput || '0');
      if (weightGrams < 0 || weightGrams > PRODUCT_LIMITS.weightGrams) {
        throw new Error(
          isId
            ? 'Berat harus di antara 0 sampai 500.000 gram.'
            : 'Weight must stay between 0 and 500,000 grams.',
        );
      }
      if (
        !trimmedImageUrl &&
        (publishServices.length > 0 || productForm.product_kind === 'physical')
      ) {
        throw new Error(
          isId
            ? 'Foto/URL gambar wajib diisi untuk produk fisik atau listing yang dipublish ke Food/Mart.'
            : 'An image URL is required for physical items or listings published to Food/Mart.',
        );
      }
      if (
        channels.includes('online') &&
        selectedStore?.online_order_enabled === false
      ) {
        throw new Error(
          isId
            ? 'Order online toko ini masih nonaktif. Aktifkan dulu sebelum publish produk online.'
            : 'This store has online ordering disabled. Enable it before publishing online products.',
        );
      }
      if (
        channels.includes('offline') &&
        selectedStore?.offline_order_enabled === false
      ) {
        throw new Error(
          isId
            ? 'Order offline toko ini masih nonaktif. Aktifkan dulu sebelum publish produk offline.'
            : 'This store has offline ordering disabled. Enable it before publishing offline products.',
        );
      }
      if (
        productForm.product_kind === 'physical' &&
        channels.includes('online') &&
        !productForm.allow_pickup &&
        !productForm.allow_courier_shipping
      ) {
        throw new Error(
          isId
            ? 'Produk fisik online wajib punya minimal satu mode fulfillment: pickup atau ekspedisi.'
            : 'Physical online products must enable at least one fulfillment mode: pickup or courier.',
        );
      }
      if (
        productForm.product_kind === 'physical' &&
        productForm.allow_courier_shipping &&
        weightGrams <= 0
      ) {
        throw new Error(
          isId
            ? 'Berat wajib diisi jika produk bisa dikirim dengan ekspedisi.'
            : 'Weight is required when the product can be shipped by courier.',
        );
      }
      if (
        productForm.product_kind === 'digital' &&
        channels.includes('online') &&
        trimmedDigitalNote.length < 6
      ) {
        throw new Error(
          isId
            ? 'Tambahkan catatan kirim digital.'
            : 'Digital products need a delivery note so buyers know how delivery works.',
        );
      }

      const res = await authFetch(
        `/api/super-app/umkm/stores/${selectedStoreId}/products`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: trimmedName,
            description: trimmedDescription || undefined,
            category: productForm.category,
            price_cents: priceRupiah * 100,
            stock_qty: stockQty,
            image_url: trimmedImageUrl || undefined,
            product_kind: productForm.product_kind,
            weight_grams:
              productForm.product_kind === 'physical' ? weightGrams : undefined,
            allow_pickup:
              productForm.product_kind === 'physical'
                ? productForm.allow_pickup
                : false,
            allow_courier_shipping:
              productForm.product_kind === 'physical'
                ? productForm.allow_courier_shipping
                : false,
            digital_delivery_note:
              productForm.product_kind === 'digital'
                ? trimmedDigitalNote || undefined
                : undefined,
            metadata: {
              ...buildUmkmCatalogMetadata(
                selectedBusinessCategory,
                selectedBusinessCapabilities,
                selectedCustomFields,
              ),
              channel: channels,
              publish_services: publishServices,
              ...(trimmedBusinessFocus
                ? {
                  umkm_focus: trimmedBusinessFocus,
                  business_focus: trimmedBusinessFocus,
                }
                : {}),
              prep_minutes: prepMinutes || undefined,
              sku: trimmedSku || undefined,
              listing_requirements: listingRequirementFields,
              order_requirements: orderRequirementFields,
            },
          }),
        },
      );

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || 'Failed to create product');

      setProductForm(
        createProductFormState(
          selectedBusinessCategory,
          selectedBusinessCapabilities,
          verificationForm.publish_food || verificationForm.publish_mart
            ? [
              ...(verificationForm.publish_food ? (['food'] as const) : []),
              ...(verificationForm.publish_mart ? (['mart'] as const) : []),
            ]
            : storePublishServices,
        ),
      );

      await loadStoreData(selectedStoreId);
      showHubToast(
        'success',
        isId ? 'Produk berhasil ditambah' : 'Product added',
        isId
          ? 'Listing baru sudah masuk ke katalog.'
          : 'The new listing is now in the catalog.',
      );
    } catch (error) {
      const message = resolveActionErrorMessage(
        error,
        isId ? 'Gagal menambahkan produk.' : 'Failed to add product.',
      );
      setSubmitError(message);
      showHubToast(
        'error',
        isId ? 'Produk belum bisa ditambah' : 'Product could not be added',
        message,
      );
    } finally {
      setSubmittingProduct(false);
    }
  };

  const submitTables = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStoreId) return;

    setSubmittingTables(true);
    setSubmitError(null);

    try {
      const countInput = tableForm.count.trim();
      const prefix = normalizeSingleLineInput(tableForm.prefix).toUpperCase();
      const startNumberInput = tableForm.start_number.trim();
      const capacityInput = tableForm.capacity.trim();

      if (!isWholeNumber(countInput)) {
        throw new Error(
          isId
            ? 'Jumlah meja harus angka bulat.'
            : 'Table count must be a whole number.',
        );
      }
      if (!prefix) {
        throw new Error(
          isId ? 'Awalan meja wajib diisi.' : 'A table prefix is required.',
        );
      }
      if (prefix.length > STORE_LIMITS.tablePrefix) {
        throw new Error(
          isId
            ? 'Awalan meja terlalu panjang. Maksimal 8 karakter.'
            : 'Table prefix is too long. Maximum 8 characters.',
        );
      }
      if (!isWholeNumber(startNumberInput)) {
        throw new Error(
          isId
            ? 'Nomor mulai meja harus angka bulat.'
            : 'Table start number must be a whole number.',
        );
      }
      if (!isWholeNumber(capacityInput)) {
        throw new Error(
          isId
            ? 'Kapasitas meja harus angka bulat.'
            : 'Table capacity must be a whole number.',
        );
      }

      const count = Number(countInput);
      const startNumber = Number(startNumberInput);
      const capacity = Number(capacityInput);

      if (count < 1 || count > 400) {
        throw new Error(
          isId
            ? 'Jumlah meja harus di antara 1 sampai 400.'
            : 'Table count must stay between 1 and 400.',
        );
      }
      if (startNumber < 1 || startNumber > 10_000) {
        throw new Error(
          isId
            ? 'Nomor mulai meja harus di antara 1 sampai 10.000.'
            : 'Table start number must stay between 1 and 10,000.',
        );
      }
      if (capacity < 1 || capacity > STORE_LIMITS.tableCapacity) {
        throw new Error(
          isId
            ? 'Kapasitas meja harus di antara 1 sampai 40.'
            : 'Table capacity must stay between 1 and 40.',
        );
      }

      const res = await authFetch(
        `/api/super-app/umkm/stores/${selectedStoreId}/tables`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            generate: {
              count,
              prefix,
              start_number: startNumber,
              capacity,
            },
            create_offline_qr: true,
          }),
        },
      );

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok)
        throw new Error(payload.error || 'Failed to generate tables');

      await loadStoreData(selectedStoreId);
      showHubToast(
        'success',
        isId ? 'Meja dan QR berhasil dibuat' : 'Tables and QR created',
        isId
          ? 'Flow meja sudah siap dipakai.'
          : 'The table flow is now ready to use.',
      );
    } catch (error) {
      const message = resolveActionErrorMessage(
        error,
        isId
          ? 'Gagal membuat meja dan QR.'
          : 'Failed to generate tables and QR.',
      );
      setSubmitError(message);
      showHubToast(
        'error',
        isId
          ? 'Meja dan QR belum bisa dibuat'
          : 'Tables and QR could not be created',
        message,
      );
    } finally {
      setSubmittingTables(false);
    }
  };

  const submitTeamMember = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!selectedStoreId) return;

    setSubmittingTeamMember(true);
    setSubmitError(null);
    setTeamMessage(null);

    try {
      const name = normalizeSingleLineInput(teamForm.name);
      const email = normalizeSingleLineInput(teamForm.email).toLowerCase();
      const notes = normalizeTextBlock(teamForm.notes);

      if (name.length < 2) {
        throw new Error(
          isId
            ? 'Nama anggota minimal 2 karakter.'
            : 'Member name must be at least 2 characters.',
        );
      }
      if (name.length > TEAM_LIMITS.name) {
        throw new Error(
          isId
            ? 'Nama anggota kepanjangan. Maksimal 120 karakter.'
            : 'Member name is too long. Maximum 120 characters.',
        );
      }
      if (!email) {
        throw new Error(
          isId ? 'Email login wajib diisi.' : 'A login email is required.',
        );
      }
      if (email.length > TEAM_LIMITS.email) {
        throw new Error(
          isId
            ? 'Email terlalu panjang. Maksimal 200 karakter.'
            : 'Email is too long. Maximum 200 characters.',
        );
      }
      if (!EMAIL_PATTERN.test(email)) {
        throw new Error(
          isId ? 'Format email belum valid.' : 'Email format is invalid.',
        );
      }
      if (notes.length > TEAM_LIMITS.notes) {
        throw new Error(
          isId
            ? 'Catatan akses terlalu panjang. Maksimal 300 karakter.'
            : 'Access note is too long. Maximum 300 characters.',
        );
      }

      const res = await authFetch(
        `/api/super-app/umkm/stores/${selectedStoreId}/team`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name,
            email: email || undefined,
            role: teamForm.role,
            notes: notes || undefined,
            status: 'active',
          }),
        },
      );

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok)
        throw new Error(payload.error || 'Failed to create team member');

      setTeamForm({
        name: '',
        email: '',
        role: 'cashier',
        notes: '',
      });
      setTeamMessage(isId ? 'Akses tim tersimpan.' : 'Team access saved.');
      await loadStoreData(selectedStoreId);
      showHubToast(
        'success',
        isId ? 'Akses tim tersimpan' : 'Team access saved',
        isId
          ? 'Anggota tim baru sudah bisa dipakai.'
          : 'The new team member is now ready to use.',
      );
    } catch (error) {
      const message = resolveActionErrorMessage(
        error,
        isId ? 'Gagal menambahkan anggota tim.' : 'Failed to add team member.',
      );
      setSubmitError(message);
      showHubToast(
        'error',
        isId
          ? 'Akses tim belum bisa disimpan'
          : 'Team access could not be saved',
        message,
      );
    } finally {
      setSubmittingTeamMember(false);
    }
  };

  const updateTeamMemberStatus = async (
    member: TeamMemberRecord,
    nextStatus: TeamMemberRecord['status'],
  ) => {
    if (!selectedStoreId) return;

    setActingTeamMemberId(member.id);
    setSubmitError(null);
    setTeamMessage(null);

    try {
      const res = await authFetch(
        `/api/super-app/umkm/stores/${selectedStoreId}/team`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            member_id: member.id,
            status: nextStatus,
          }),
        },
      );

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok)
        throw new Error(payload.error || 'Failed to update team member');

      setTeamMessage(
        nextStatus === 'disabled'
          ? isId
            ? 'Akses tim dinonaktifkan.'
            : 'Team access disabled.'
          : isId
            ? 'Akses tim diaktifkan lagi.'
            : 'Team access reactivated.',
      );
      await loadStoreData(selectedStoreId);
      showHubToast(
        'success',
        nextStatus === 'disabled'
          ? isId
            ? 'Akses tim dimatikan'
            : 'Team access disabled'
          : isId
            ? 'Akses tim diaktifkan lagi'
            : 'Team access reactivated',
        isId
          ? 'Perubahan akses tim sudah tersimpan.'
          : 'The team access update has been saved.',
      );
    } catch (error) {
      const message = resolveActionErrorMessage(
        error,
        isId ? 'Gagal mengubah akses tim.' : 'Failed to update team access.',
      );
      setSubmitError(message);
      showHubToast(
        'error',
        isId ? 'Akses tim belum berubah' : 'Team access could not be updated',
        message,
      );
    } finally {
      setActingTeamMemberId(null);
    }
  };

  const runOrderAction = async (
    orderId: string,
    body:
      | {
        action: 'update_status';
        status: 'pending' | 'preparing' | 'served' | 'paid' | 'cancelled';
      }
      | { action: 'checkout' }
      | { action: 'confirm_bill' }
      | { action: 'move_table'; to_table_id: string },
  ) => {
    setActingOrderId(orderId);
    setSubmitError(null);

    try {
      const res = await authFetch('/api/super-app/umkm/orders/lifecycle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          order_id: orderId,
          ...body,
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) throw new Error(payload.error || 'Failed to update order');

      if (selectedStoreId) await loadStoreData(selectedStoreId);
      showHubToast(
        'success',
        body.action === 'confirm_bill'
          ? isId
            ? 'Pembayaran dikonfirmasi'
            : 'Payment confirmed'
          : body.action === 'checkout'
            ? isId
              ? 'Checkout order tersimpan'
              : 'Order checkout saved'
            : body.action === 'move_table'
              ? isId
                ? 'Meja order dipindah'
                : 'Order table moved'
              : isId
                ? 'Status order diperbarui'
                : 'Order status updated',
        isId
          ? 'Perubahan order sudah masuk.'
          : 'The order change has been saved.',
      );
    } catch (error) {
      const message = resolveActionErrorMessage(
        error,
        isId ? 'Gagal mengubah order.' : 'Failed to update order.',
      );
      setSubmitError(message);
      showHubToast(
        'error',
        isId ? 'Order belum berubah' : 'Order could not be updated',
        message,
      );
    } finally {
      setActingOrderId(null);
    }
  };

  const runReservationAction = async (
    reservationId: string,
    status: ReservationRecord['status'],
  ) => {
    setActingReservationId(reservationId);
    setSubmitError(null);

    try {
      const res = await authFetch('/api/super-app/umkm/reservations', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          reservation_id: reservationId,
          status,
          metadata_patch: {
            updated_from: 'umkm_hub',
            updated_at: new Date().toISOString(),
          },
        }),
      });

      const payload = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok)
        throw new Error(payload.error || 'Failed to update reservation');

      if (selectedStoreId) await loadStoreData(selectedStoreId);
      showHubToast(
        'success',
        status === 'confirmed'
          ? isId
            ? 'Booking dikonfirmasi'
            : 'Reservation confirmed'
          : status === 'seated'
            ? isId
              ? 'Tamu sudah duduk'
              : 'Guests marked as seated'
            : status === 'completed'
              ? isId
                ? 'Booking selesai'
                : 'Reservation completed'
              : status === 'cancelled'
                ? isId
                  ? 'Booking dibatalkan'
                  : 'Reservation cancelled'
                : isId
                  ? 'Status booking diperbarui'
                  : 'Reservation updated',
        isId
          ? 'Perubahan booking sudah masuk.'
          : 'The reservation change has been saved.',
      );
    } catch (error) {
      const message = resolveActionErrorMessage(
        error,
        isId ? 'Gagal mengubah reservasi.' : 'Failed to update reservation.',
      );
      setSubmitError(message);
      showHubToast(
        'error',
        isId ? 'Booking belum berubah' : 'Reservation could not be updated',
        message,
      );
    } finally {
      setActingReservationId(null);
    }
  };

  const nextOwnerStep = useMemo(() => {
    if (!selectedStore) return null;

    if (
      hasEnabledPublishChannel &&
      ((verificationForm.publish_food && !publishReadiness.food.ok) ||
        (verificationForm.publish_mart && !publishReadiness.mart.ok))
    ) {
      return {
        target: 'umkm-verification',
        label: isId ? 'Lengkapi usaha' : 'Complete business',
        desc: isId
          ? 'Isi data yang kurang dulu.'
          : 'Fill the missing core info first.',
      };
    }

    if (products.length === 0) {
      return {
        target: 'umkm-products',
        label: isId ? 'Masukkin jualan' : 'Add products',
        desc: isId
          ? 'Biar toko cepat siap jual.'
          : 'Get the store ready to sell.',
      };
    }

    if (
      supportsDineInFlow &&
      tables.length === 0 &&
      selectedStore.offline_order_enabled !== false
    ) {
      return {
        target: 'umkm-tables',
        label: isId ? 'Bikin meja & QR' : 'Create tables & QR',
        desc: isId
          ? 'Sekali bikin, langsung jalan.'
          : 'Create once and use right away.',
      };
    }

    if (supportsReservationFlow && reservations.length > 0) {
      return {
        target: 'umkm-reservations',
        label: isId ? 'Cek booking' : 'Check bookings',
        desc: isId
          ? 'Lihat yang aktif hari ini.'
          : 'Review today active bookings.',
      };
    }

    return {
      target: 'umkm-orders',
      label: isId ? 'Buka pesanan' : 'Open orders',
      desc: isId
        ? 'Masuk ke kerjaan yang lagi jalan.'
        : 'Jump into the live work queue.',
    };
  }, [
    hasEnabledPublishChannel,
    isId,
    products.length,
    publishReadiness.food.ok,
    publishReadiness.mart.ok,
    reservations.length,
    selectedStore,
    supportsDineInFlow,
    supportsReservationFlow,
    tables.length,
    verificationForm.publish_food,
    verificationForm.publish_mart,
  ]);

  const ownerAlerts = useMemo(() => {
    const items: Array<{
      id: string;
      icon: TileIcon;
      title: string;
      desc: string;
      target: string;
      tone?: 'default' | 'warning' | 'success';
    }> = [];

    if (!selectedStore) return items;

    const basicOutletGaps: string[] = [];
    if (normalizeSingleLineInput(selectedStore.phone || '').length === 0) {
      basicOutletGaps.push(isId ? 'telepon outlet' : 'outlet phone');
    }
    if (normalizeTextBlock(selectedStore.description || '').length === 0) {
      basicOutletGaps.push(isId ? 'deskripsi singkat' : 'short description');
    }

    if (basicOutletGaps.length > 0) {
      items.push({
        id: 'store-basic',
        icon: Store,
        title: isId ? 'Rapikan info outlet' : 'Tighten outlet info',
        desc: basicOutletGaps.slice(0, 2).join(', '),
        target: 'umkm-store-basic',
        tone: 'warning',
      });
    }

    if (!publishReadiness.food.ok && verificationForm.publish_food) {
      items.push({
        id: 'food-readiness',
        icon: ShieldCheck,
        title: isId ? 'Food belum siap' : 'Food is not ready',
        desc: publishReadiness.food.missing.slice(0, 3).join(', '),
        target: 'umkm-verification',
        tone: 'warning',
      });
    }

    if (!publishReadiness.mart.ok && verificationForm.publish_mart) {
      items.push({
        id: 'mart-readiness',
        icon: ShieldCheck,
        title: isId ? 'Mart belum siap' : 'Mart is not ready',
        desc: publishReadiness.mart.missing.slice(0, 3).join(', '),
        target: 'umkm-verification',
        tone: 'warning',
      });
    }

    if (products.length === 0) {
      items.push({
        id: 'products',
        icon: PackagePlus,
        title: isId ? 'Belum ada jualan' : 'No products yet',
        desc: isId
          ? 'Masukin menu atau produk pertama.'
          : 'Add the first item.',
        target: 'umkm-products',
      });
    }

    if (supportsDineInFlow && !onlineQr) {
      items.push({
        id: 'qr',
        icon: Table2,
        title: isId ? 'QR belum siap' : 'QR is not ready',
        desc: isId
          ? 'Biar pembeli bisa langsung scan.'
          : 'So buyers can scan faster.',
        target: 'umkm-tables',
      });
    }

    if (outOfStockCount > 0 || lowStockCount > 0) {
      items.push({
        id: 'stock',
        icon: PackagePlus,
        title: isId ? 'Stok perlu cek' : 'Stock needs review',
        desc:
          outOfStockCount > 0
            ? isId
              ? `${outOfStockCount} produk habis dan ${lowStockCount} mulai tipis.`
              : `${outOfStockCount} products are empty and ${lowStockCount} are low.`
            : isId
              ? `${lowStockCount} produk mulai tipis.`
              : `${lowStockCount} products are running low.`,
        target: 'umkm-products',
        tone: 'warning',
      });
    }

    if (orderSummary.awaitingBill > 0) {
      items.push({
        id: 'awaiting-bill',
        icon: WalletCards,
        title: isId ? 'Ada bill masuk' : 'Bills need confirmation',
        desc: isId
          ? `${orderSummary.awaitingBill} pesanan masih nunggu konfirmasi pembayaran.`
          : `${orderSummary.awaitingBill} orders are still waiting for payment confirmation.`,
        target: 'umkm-orders',
        tone: 'warning',
      });
    }

    if (reservationSummary.todayCount > 0) {
      items.push({
        id: 'reservations',
        icon: Clipboard,
        title: supportsDineInFlow
          ? isId
            ? 'Booking hari ini'
            : 'Today bookings'
          : isId
            ? 'Booking hari ini'
            : 'Today bookings',
        desc: isId
          ? `${reservationSummary.todayCount} booking perlu dipantau di usaha ini.`
          : `${reservationSummary.todayCount} bookings need monitoring for this business.`,
        target: 'umkm-reservations',
        tone: 'success',
      });
    }

    return items.slice(0, 4);
  }, [
    isId,
    lowStockCount,
    onlineQr,
    orderSummary.awaitingBill,
    outOfStockCount,
    products.length,
    publishReadiness.food.missing,
    publishReadiness.food.ok,
    publishReadiness.mart.missing,
    publishReadiness.mart.ok,
    reservationSummary.todayCount,
    selectedStore,
    supportsDineInFlow,
    verificationForm.publish_food,
    verificationForm.publish_mart,
  ]);
  const simpleOverviewStats = useMemo(
    () =>
      selectedStore
        ? [
          {
            label: isId ? 'Produk' : 'Products',
            value: products.length,
            desc: isId ? 'Sudah masuk' : 'Added already',
          },
          {
            label: isId ? 'Pesanan aktif' : 'Active orders',
            value: openOrders.length,
            desc: isId ? 'Cek sekarang' : 'Check now',
          },
          {
            label: isId ? 'Perlu dicek' : 'Needs attention',
            value: ownerAlerts.length,
            desc:
              ownerAlerts.length > 0
                ? isId
                  ? 'Beresin dulu'
                  : 'Fix first'
                : isId
                  ? 'Aman'
                  : 'Healthy',
          },
        ]
        : [
          {
            label: isId ? 'Usaha' : 'Businesses',
            value: myStores.length,
            desc: isId
              ? `${activeStoreCount} aktif`
              : `${activeStoreCount} active`,
          },
          {
            label: isId ? 'Aktif' : 'Active',
            value: activeStoreCount,
            desc: isId ? 'Sudah siap dibuka' : 'Ready to be opened',
          },
          {
            label: isId ? 'Mulai' : 'Start',
            value: isId ? 'Bikin usaha' : 'Add one',
            desc: isId ? 'Simpan satu dulu' : 'Save one first',
          },
        ],
    [
      activeStoreCount,
      isId,
      myStores.length,
      openOrders.length,
      ownerAlerts.length,
      products.length,
      selectedStore,
    ],
  );
  const verificationGapCount = useMemo(
    () =>
      new Set([
        ...(verificationForm.publish_food ? publishReadiness.food.missing : []),
        ...(verificationForm.publish_mart ? publishReadiness.mart.missing : []),
      ]).size,
    [
      publishReadiness.food.missing,
      publishReadiness.mart.missing,
      verificationForm.publish_food,
      verificationForm.publish_mart,
    ],
  );
  const simpleOverviewFlowSteps = useMemo<GuidedFlowCard[]>(() => {
    const stepPrefix = isId ? 'Langkah' : 'Step';

    if (!selectedStore) {
      const hasStores = myStores.length > 0;
      const firstActionHref = buildSetupHref(hasStores ? 'list' : 'create');

      return [
        {
          id: 'choose-store',
          stepLabel: `${stepPrefix} 1`,
          title: hasStores
            ? isId
              ? 'Pilih usaha aktif'
              : 'Choose the active business'
            : isId
              ? 'Buat usaha pertama'
              : 'Create the first business',
          desc: hasStores
            ? isId
              ? 'Pilih usaha aktif dulu.'
              : 'One account can manage multiple businesses. Pick the active business first so the next pages stay focused.'
            : isId
              ? 'Mulai dari usaha pertama dulu. Setelah tersimpan, Anda bisa tambah usaha lain kapan saja.'
              : 'Start with the first business. After saving it, you can add more businesses anytime.',
          badge: hasStores
            ? `${myStores.length} ${isId ? 'usaha siap dipilih' : 'businesses ready'}`
            : isId
              ? 'Mulai di sini'
              : 'Start here',
          tone: 'accent',
          done: false,
          action: {
            kind: 'href',
            href: firstActionHref,
            label: hasStores
              ? isId
                ? 'Pilih usaha aktif'
                : 'Choose active business'
              : isId
                ? 'Buat usaha'
                : 'Add business',
          },
        },
        {
          id: 'foundation',
          stepLabel: `${stepPrefix} 2`,
          title: isId ? 'Rapikan info inti' : 'Tidy up the essentials',
          desc: isId
            ? 'Nama usaha, alamat, kontak, dan profil publish cukup dulu.'
            : 'Start with the business name, address, contact, and publishing profile.',
          badge: isId
            ? 'Setelah usaha dipilih'
            : 'After a business is selected',
          tone: 'default',
          done: false,
          action: {
            kind: 'href',
            href: firstActionHref,
            label: hasStores
              ? isId
                ? 'Buka setup'
                : 'Open setup'
              : isId
                ? 'Mulai setup'
                : 'Start setup',
          },
        },
        {
          id: 'selling',
          stepLabel: `${stepPrefix} 3`,
          title: isId ? 'Masukkin jualan pertama' : 'Add the first listing',
          desc: isId
            ? 'Begitu fondasi beres, baru lanjut ke katalog dan pesanan.'
            : 'Once the foundation is ready, move into catalog and orders.',
          badge: isId ? 'Buka setelah setup' : 'Opens after setup',
          tone: 'default',
          done: false,
          action: {
            kind: 'href',
            href: firstActionHref,
            label: hasStores
              ? isId
                ? 'Lanjut'
                : 'Continue'
              : isId
                ? 'Mulai'
                : 'Start',
          },
        },
      ];
    }

    const foundationReady =
      basicStoreDraftCompletion === 5 &&
      hasEnabledPublishChannel &&
      verificationGapCount === 0;
    const sellingReady = products.length > 0;
    const ordersReady =
      openOrders.length > 0 ||
      selectedStore.online_order_enabled ||
      selectedStore.offline_order_enabled ||
      Boolean(onlineQr);

    return [
      {
        id: 'foundation',
        stepLabel: `${stepPrefix} 1`,
        title: isId ? 'Rapikan usaha' : 'Tidy up the business',
        desc: isId
          ? 'Bereskan info outlet, profil owner, dan kanal publish dulu.'
          : 'Finish the outlet info, owner profile, and publishing channels first.',
        badge: foundationReady
          ? isId
            ? 'Fondasi rapi'
            : 'Foundation ready'
          : hasEnabledPublishChannel
            ? `${verificationGapCount} ${isId ? 'bagian kurang' : 'items missing'}`
            : isId
              ? `${basicStoreDraftCompletion}/5 info inti`
              : `${basicStoreDraftCompletion}/5 essentials`,
        tone: foundationReady ? 'success' : 'warning',
        done: foundationReady,
        action: {
          kind: 'href',
          href: buildSetupHref('detail', selectedStore.id),
          label: foundationReady
            ? isId
              ? 'Cek setup'
              : 'Review setup'
            : isId
              ? 'Lengkapi setup'
              : 'Complete setup',
        },
      },
      {
        id: 'selling',
        stepLabel: `${stepPrefix} 2`,
        title: isId ? 'Masukkin jualan' : 'Add listings',
        desc: isId
          ? 'Tambah menu/produk dulu.'
          : 'Add the first menu or product so the outlet becomes usable for selling.',
        badge: sellingReady
          ? `${products.length} ${isId ? 'jualan masuk' : 'listings added'}`
          : isId
            ? 'Belum ada jualan'
            : 'No listings yet',
        tone: sellingReady ? 'success' : 'warning',
        done: sellingReady,
        action: {
          kind: 'href',
          href: buildWorkspaceHref('catalog', selectedStore.id),
          label: sellingReady
            ? isId
              ? 'Buka katalog'
              : 'Open catalog'
            : isId
              ? 'Tambah jualan'
              : 'Add listing',
        },
      },
      {
        id: 'orders',
        stepLabel: `${stepPrefix} 3`,
        title: isId ? 'Jalanin pesanan' : 'Run the orders flow',
        desc: isId
          ? 'Setelah setup dan katalog aman, fokus ke order yang sedang jalan.'
          : 'Once setup and catalog are in shape, focus on the live order flow.',
        badge:
          openOrders.length > 0
            ? `${openOrders.length} ${isId ? 'pesanan aktif' : 'active orders'}`
            : ordersReady
              ? isId
                ? 'Siap dipakai'
                : 'Ready to use'
              : isId
                ? 'Nyalakan alur jual'
                : 'Turn on the selling flow',
        tone:
          openOrders.length > 0
            ? 'accent'
            : ordersReady
              ? 'success'
              : 'default',
        done: ordersReady,
        action: {
          kind: 'href',
          href: buildWorkspaceHref('orders', selectedStore.id),
          label:
            openOrders.length > 0
              ? isId
                ? 'Cek pesanan'
                : 'Check orders'
              : isId
                ? 'Buka pesanan'
                : 'Open orders',
        },
      },
    ];
  }, [
    basicStoreDraftCompletion,
    buildSetupHref,
    buildWorkspaceHref,
    hasEnabledPublishChannel,
    isId,
    myStores.length,
    onlineQr,
    openOrders.length,
    products.length,
    selectedStore,
    verificationGapCount,
  ]);
  const simpleOverviewCompletedSteps = useMemo(
    () => simpleOverviewFlowSteps.filter(step => step.done).length,
    [simpleOverviewFlowSteps],
  );
  const setupDetailSteps = useMemo<SetupDetailStep[]>(() => {
    if (!selectedStore) return [];

    const publishReady = hasEnabledPublishChannel && verificationGapCount === 0;
    const prefix = isId ? 'Langkah' : 'Step';

    return [
      {
        id: 'summary',
        target: SETUP_DETAIL_STEP_TARGETS.summary,
        icon: Store,
        stepLabel: `${prefix} 1`,
        title: isId ? 'Ringkasan' : 'Summary',
        desc: isId
          ? 'Lihat kondisi outlet dan prioritas yang paling dekat.'
          : 'Review the outlet status and the closest priority.',
        badge:
          ownerAlerts.length > 0
            ? isId
              ? 'Ada prioritas'
              : 'Needs focus'
            : isId
              ? 'Aman'
              : 'Clean',
        tone: ownerAlerts.length > 0 ? 'warning' : 'success',
        done: ownerAlerts.length === 0,
      },
      {
        id: 'basic',
        target: SETUP_DETAIL_STEP_TARGETS.basic,
        icon: FileText,
        stepLabel: `${prefix} 2`,
        title: isId ? 'Info outlet' : 'Outlet info',
        desc: isId
          ? 'Nama, kota, alamat, WA, dan deskripsi saja dulu.'
          : 'Only name, city, address, WhatsApp, and description first.',
        badge:
          basicStoreDraftCompletion === 5
            ? isId
              ? 'Lengkap'
              : 'Complete'
            : `${basicStoreDraftCompletion}/5`,
        tone: basicStoreDraftCompletion === 5 ? 'success' : 'warning',
        done: basicStoreDraftCompletion === 5,
      },
      {
        id: 'publish',
        target: SETUP_DETAIL_STEP_TARGETS.publish,
        icon: ShieldCheck,
        stepLabel: `${prefix} 3`,
        title: isId ? 'Profil & publish' : 'Profile & publish',
        desc: isId
          ? 'Pilih kategori, kanal publish, lokasi, dan dokumen penting.'
          : 'Choose category, publish channels, location, and key documents.',
        badge: publishReady
          ? isId
            ? 'Siap'
            : 'Ready'
          : hasEnabledPublishChannel
            ? `${verificationGapCount} ${isId ? 'kurang' : 'missing'}`
            : isId
              ? 'Pilih kanal'
              : 'Pick channel',
        tone: publishReady ? 'success' : 'warning',
        done: publishReady,
      },
      {
        id: 'recommendations',
        target: SETUP_DETAIL_STEP_TARGETS.recommendations,
        icon: MapPinned,
        stepLabel: `${prefix} 4`,
        title: isId ? 'Cari partner' : 'Find partners',
        desc: isId
          ? 'Pilih satu arah pencarian: supplier, lokasi, ops, legal, atau talent.'
          : 'Pick one search direction: supply, location, ops, legal, or talent.',
        badge: `${launchRecommendationCards.length} opsi`,
        tone: 'accent',
        done: true,
      },
      {
        id: 'next',
        target: SETUP_DETAIL_STEP_TARGETS.next,
        icon: PackagePlus,
        stepLabel: `${prefix} 5`,
        title: isId ? 'Lanjut jualan' : 'Start selling',
        desc: isId
          ? 'Setelah profil cukup aman, lanjut ke katalog atau storefront.'
          : 'Once the profile is safe enough, continue to catalog or storefront.',
        badge:
          products.length > 0
            ? `${products.length} ${isId ? 'produk' : 'items'}`
            : isId
              ? 'Belum ada'
              : 'No item yet',
        tone: products.length > 0 ? 'success' : 'warning',
        done: products.length > 0,
      },
    ];
  }, [
    basicStoreDraftCompletion,
    hasEnabledPublishChannel,
    isId,
    launchRecommendationCards.length,
    ownerAlerts.length,
    products.length,
    selectedStore,
    verificationGapCount,
  ]);
  const activeSetupDetailStepMeta =
    setupDetailSteps.find(step => step.id === activeSetupDetailStep) ||
    setupDetailSteps[0] ||
    null;
  const activeSetupDetailStepIndex = Math.max(
    0,
    setupDetailSteps.findIndex(step => step.id === activeSetupDetailStep),
  );
  const simpleSetupPrimaryAction = useMemo<GuidedFlowAction | null>(() => {
    if (!selectedStore) return null;

    if (ownerAlerts.length > 0) {
      return {
        kind: 'target',
        target: ownerAlerts[0].target,
        label: isId ? 'Bereskan prioritas utama' : 'Fix the top priority',
      };
    }

    if (products.length === 0) {
      return {
        kind: 'target',
        target: 'umkm-products',
        label: isId ? 'Tambah jualan pertama' : 'Add the first listing',
      };
    }

    if (nextOwnerStep) {
      return {
        kind: 'target',
        target: nextOwnerStep.target,
        label: nextOwnerStep.label,
      };
    }

    return {
      kind: 'href',
      href: buildWorkspaceHref('orders', selectedStore.id),
      label: isId ? 'Buka pesanan' : 'Open orders',
    };
  }, [
    buildWorkspaceHref,
    isId,
    nextOwnerStep,
    ownerAlerts,
    products.length,
    selectedStore,
  ]);

  const workspaceModes = useMemo(
    () => [
      {
        id: 'owner',
        icon: ShieldCheck,
        title: isId ? 'Pemilik' : 'Owner',
        desc: isId
          ? 'Data usaha dan publish.'
          : 'Business info and publishing.',
        badge: isId ? 'Full control' : 'Full control',
        target: 'umkm-verification',
      },
      {
        id: 'cashier',
        icon: WalletCards,
        title: isId ? 'Kasir' : 'Cashier',
        desc: isId ? 'Pesanan, bill, bayar.' : 'Orders, bills, payments.',
        badge: `${orderSummary.unpaid} ${isId ? 'aktif' : 'active'}`,
        target: 'umkm-orders',
      },
      {
        id: 'stock',
        icon: PackagePlus,
        title: isId ? 'Stok' : 'Stock',
        desc: isId ? 'Jualan dan stok.' : 'Products and stock.',
        badge:
          lowStockCount + outOfStockCount > 0
            ? `${lowStockCount + outOfStockCount} ${isId ? 'butuh cek' : 'need review'}`
            : isId
              ? 'Aman'
              : 'Healthy',
        target: 'umkm-products',
      },
      {
        id: 'outlet',
        icon: Table2,
        title: operationsWorkspaceCopy.modeTitle,
        desc: operationsWorkspaceCopy.modeDesc,
        badge: operationsWorkspaceCopy.badge,
        target: 'umkm-tables',
      },
    ],
    [
      isId,
      lowStockCount,
      operationsWorkspaceCopy.badge,
      operationsWorkspaceCopy.modeDesc,
      operationsWorkspaceCopy.modeTitle,
      orderSummary.unpaid,
      outOfStockCount,
    ],
  );

  const teamBlueprints = useMemo(
    () => [
      {
        title: isId ? 'Pemilik / admin utama' : 'Owner / primary admin',
        scope: isId ? 'Semua usaha' : 'All businesses',
        desc: isId
          ? 'Pegang outlet, publish, payout, tim, dan operasional lintas toko.'
          : 'Own outlets, publishing, payouts, team setup, and cross-store operations.',
        permissions: [
          isId ? 'semua outlet' : 'all outlets',
          isId ? 'publish' : 'publish',
          isId ? 'pembayaran' : 'payments',
        ],
        icon: ShieldCheck,
        tone: 'accent' as const,
      },
      {
        title: isId ? 'Kasir' : 'Cashier',
        scope: selectedStore
          ? selectedStore.name
          : isId
            ? 'Per outlet'
            : 'Per outlet',
        desc: isId
          ? 'Lihat pesanan aktif, pindah meja, konfirmasi bill, dan checkout.'
          : 'Handle active orders, move tables, confirm bills, and checkout.',
        permissions: [
          isId ? 'order aktif' : 'live orders',
          isId ? 'bill' : 'billing',
          isId ? 'checkout' : 'checkout',
        ],
        icon: WalletCards,
      },
      {
        title: isId ? 'Stok / katalog' : 'Stock / catalog',
        scope: selectedStore
          ? selectedStore.name
          : isId
            ? 'Per outlet'
            : 'Per outlet',
        desc: isId
          ? 'Tambah produk, update stok, dan jaga listing tetap siap jual.'
          : 'Add products, update stock, and keep listings ready to sell.',
        permissions: [
          isId ? 'produk' : 'products',
          isId ? 'stok' : 'stock',
          isId ? 'harga' : 'pricing',
        ],
        icon: PackagePlus,
      },
      {
        title: isId ? 'Operasional usaha' : 'Outlet operations',
        scope: operationsWorkspaceCopy.teamScope,
        desc: operationsWorkspaceCopy.teamDesc,
        permissions: [
          supportsDineInFlow
            ? isId
              ? 'meja & QR'
              : 'tables & QR'
            : supportsFieldVisitFlow
              ? isId
                ? 'area layanan'
                : 'service coverage'
              : supportsDigitalFlow
                ? isId
                  ? 'brief'
                  : 'briefs'
                : isId
                  ? 'booking'
                  : 'bookings',
          supportsDigitalFlow
            ? isId
              ? 'delivery'
              : 'delivery'
            : isId
              ? 'reservasi'
              : 'reservations',
          isId ? 'pickup' : 'pickup',
        ],
        icon: Clipboard,
        tone: 'warning' as const,
      },
    ],
    [
      isId,
      operationsWorkspaceCopy.teamDesc,
      operationsWorkspaceCopy.teamScope,
      selectedStore,
      supportsDigitalFlow,
      supportsDineInFlow,
      supportsFieldVisitFlow,
    ],
  );

  const workspaceJumpTiles = useMemo(
    () => [
      {
        id: 'register',
        icon: Store,
        title: isId ? 'Tambah usaha' : 'Add business',
        desc: isId
          ? 'Form 4 langkah, bisa diulang untuk tiap usaha.'
          : 'Repeatable 4-step flow for each business.',
        badge: `${myStores.length} ${isId ? 'terdaftar' : 'listed'}`,
        tone:
          myStores.length === 0 ? ('accent' as const) : ('default' as const),
        disabled: false,
      },
      {
        id: 'portfolio',
        icon: MapPinned,
        title: isId ? 'Portfolio usaha' : 'Business portfolio',
        desc: isId
          ? 'Pilih usaha aktif atau tambah usaha lain.'
          : 'Choose the active business or add another one.',
        badge: `${activeStoreCount} ${isId ? 'aktif' : 'active'}`,
        tone: selectedStore ? ('success' as const) : ('default' as const),
        disabled: myStores.length === 0,
      },
      {
        id: 'verification',
        icon: ShieldCheck,
        title: isId ? 'Edit usaha' : 'Edit business',
        desc: isId ? 'Nama, alamat, channel.' : 'Name, address, channels.',
        badge: selectedStore
          ? verificationGapCount === 0
            ? isId
              ? 'Siap publish'
              : 'Ready'
            : `${verificationGapCount} ${isId ? 'gap' : 'gaps'}`
          : isId
            ? 'Pilih outlet dulu'
            : 'Pick an outlet first',
        tone: selectedStore
          ? verificationGapCount === 0
            ? ('success' as const)
            : ('warning' as const)
          : ('default' as const),
        disabled: !selectedStore,
      },
      {
        id: 'products',
        icon: PackagePlus,
        title: isId ? 'Jualan' : 'Products',
        desc: isId ? 'Produk dan stok.' : 'Products and stock.',
        badge: selectedStore
          ? outOfStockCount > 0
            ? `${outOfStockCount} ${isId ? 'habis' : 'empty'}`
            : `${products.length} ${isId ? 'item' : 'items'}`
          : isId
            ? 'Pilih outlet dulu'
            : 'Pick an outlet first',
        tone: selectedStore
          ? lowStockCount + outOfStockCount > 0
            ? ('warning' as const)
            : ('default' as const)
          : ('default' as const),
        disabled: !selectedStore,
      },
      {
        id: 'tables',
        icon: Table2,
        title: operationsWorkspaceCopy.title,
        desc: operationsWorkspaceCopy.desc,
        badge: selectedStore
          ? operationsWorkspaceCopy.badge
          : isId
            ? 'Pilih outlet dulu'
            : 'Pick an outlet first',
        tone: selectedStore
          ? supportsDineInFlow && !onlineQr
            ? ('warning' as const)
            : ('default' as const)
          : ('default' as const),
        disabled: !selectedStore,
      },
      {
        id: 'orders',
        icon: WalletCards,
        title: isId ? 'Pesanan' : 'Orders',
        desc: isId ? 'Yang lagi jalan.' : 'Active queue.',
        badge: `${orderSummary.unpaid} ${isId ? 'aktif' : 'active'}`,
        tone:
          orderSummary.unpaid > 0 ? ('accent' as const) : ('default' as const),
        disabled: !selectedStore,
      },
      {
        id: 'team',
        icon: Users,
        title: isId ? 'Tim' : 'Team',
        desc: isId ? 'Orang dan akses.' : 'People and access.',
        badge: `${teamMembers.length} ${isId ? 'anggota' : 'members'}`,
        tone:
          teamMembers.length > 0 ? ('success' as const) : ('default' as const),
        disabled: !selectedStore,
      },
    ],
    [
      activeStoreCount,
      isId,
      lowStockCount,
      myStores.length,
      onlineQr,
      orderSummary.unpaid,
      outOfStockCount,
      products.length,
      selectedStore,
      teamMembers.length,
      supportsDineInFlow,
      verificationGapCount,
      operationsWorkspaceCopy.badge,
      operationsWorkspaceCopy.desc,
      operationsWorkspaceCopy.title,
    ],
  );
  const overviewWorkspaceTiles = useMemo(
    () =>
      selectedStore
        ? workspaceJumpTiles.filter(item =>
          [
            'register',
            'portfolio',
            'verification',
            'products',
            'orders',
          ].includes(item.id),
        )
        : workspaceJumpTiles.filter(item =>
          ['register', 'portfolio'].includes(item.id),
        ),
    [selectedStore, workspaceJumpTiles],
  );

  const openWorkspaceTile = useCallback(
    (tileId: string) => {
      if (tileId === 'register') {
        router.push(buildSetupHref('create'));
        return;
      }
      if (tileId === 'portfolio') {
        router.push(buildSetupHref('list'));
        return;
      }
      if (tileId === 'verification') {
        router.push(
          selectedStoreId
            ? buildSetupHref('detail', selectedStoreId)
            : buildSetupHref('list'),
        );
        return;
      }
      if (tileId === 'products') {
        router.push(buildWorkspaceHref('catalog', selectedStoreId));
        return;
      }
      if (tileId === 'tables') {
        router.push(buildWorkspaceHref('operations', selectedStoreId));
        return;
      }
      if (tileId === 'orders') {
        router.push(buildWorkspaceHref('orders', selectedStoreId));
        return;
      }
      if (tileId === 'team') {
        router.push(buildWorkspaceHref('team', selectedStoreId));
      }
    },
    [buildSetupHref, buildWorkspaceHref, router, selectedStoreId],
  );

  const workspacePageMeta = useMemo(() => {
    if (currentWorkspace === 'setup') {
      if (isSetupCreateView) {
        return {
          title: isId ? 'Mulai usaha' : 'Add business',
          desc: isId ? 'Isi 4 langkah.' : 'Fill the 4 steps.',
        };
      }
      if (isSetupDetailView) {
        return {
          title: isId ? 'Edit usaha' : 'Edit business',
          desc: isId ? 'Ubah yang perlu.' : 'Change what matters.',
        };
      }
      return {
        title: isId ? 'Pilih outlet' : 'Choose outlet',
        desc: isId
          ? 'Buka outlet yang mau dipakai.'
          : 'Open the outlet you need.',
      };
    }

    if (currentWorkspace === 'catalog') {
      return {
        title: isId ? 'Jualan' : 'Products',
        desc: isId
          ? 'Tambah produk, harga, dan stok.'
          : 'Products, pricing, and stock.',
      };
    }
    if (currentWorkspace === 'operations') {
      return {
        title: isId ? 'Operasional' : 'Operations',
        desc: isId
          ? 'QR, meja, booking, dan alur harian.'
          : 'QR, tables, bookings, and daily flow.',
      };
    }
    if (currentWorkspace === 'orders') {
      return {
        title: isId ? 'Pesanan' : 'Orders',
        desc: isId
          ? 'Pesanan masuk sampai pembayaran.'
          : 'Incoming orders and payments.',
      };
    }
    return {
      title: isId ? 'Tim' : 'Team',
      desc: isId
        ? 'Undang orang dan atur akses.'
        : 'Invite people and manage access.',
    };
  }, [currentWorkspace, isId, isSetupCreateView, isSetupDetailView]);
  const simpleWorkspaceHero = useMemo<SimpleWorkspaceHero>(() => {
    if (!selectedStore) {
      return {
        eyebrow: isId
          ? 'Pilih usaha aktif dulu'
          : 'Choose the active business first',
        title: isId
          ? 'Buka usaha yang mau dipakai sekarang'
          : 'Open the business you want to use now',
        desc: isId
          ? 'Satu akun bisa pegang banyak usaha. Pilih yang aktif dulu, lalu pindah atau tambah usaha lain kapan saja.'
          : 'One account can manage multiple businesses. Pick the active one first, then switch or add another business anytime.',
        primaryLabel: isId ? 'Pilih usaha aktif' : 'Choose active business',
        primaryHref: buildSetupHref('list'),
        secondaryLabel: isId ? 'Tambah usaha' : 'Add business',
        secondaryHref: buildSetupHref('create'),
      };
    }

    if (currentWorkspace === 'catalog') {
      return {
        eyebrow: selectedStore.name,
        title: isId ? 'Atur jualan' : 'Manage products',
        desc: isId
          ? 'Tambah produk, atur harga, dan cek stok tanpa pindah-pindah.'
          : 'Add products, update pricing, and check stock in one place.',
        primaryLabel: isId ? 'Tambah jualan' : 'Add product',
        primaryTarget: 'umkm-products',
        secondaryLabel: isId ? 'Ganti outlet' : 'Switch outlet',
        secondaryHref: buildSetupHref('list'),
      };
    }

    if (currentWorkspace === 'operations') {
      return {
        eyebrow: selectedStore.name,
        title: isId ? 'Jalankan operasional' : 'Run operations',
        desc: isId
          ? 'Atur QR, meja, booking, dan alur harian outlet ini.'
          : 'Manage QR, tables, bookings, and the daily flow for this outlet.',
        primaryLabel: isId ? 'Buka operasional' : 'Open operations',
        primaryTarget: 'umkm-tables',
        secondaryLabel: isId ? 'Ganti outlet' : 'Switch outlet',
        secondaryHref: buildSetupHref('list'),
      };
    }

    if (currentWorkspace === 'orders') {
      return {
        eyebrow: selectedStore.name,
        title: isId ? 'Pantau pesanan' : 'Review orders',
        desc: isId
          ? 'Lihat pesanan aktif, tagihan, dan pembayaran di satu tempat.'
          : 'Track live orders, bills, and payments in one place.',
        primaryLabel: isId ? 'Lihat pesanan' : 'Open orders',
        primaryTarget: 'umkm-orders',
        secondaryLabel: isId ? 'Ganti outlet' : 'Switch outlet',
        secondaryHref: buildSetupHref('list'),
      };
    }

    return {
      eyebrow: selectedStore.name,
      title: isId ? 'Atur tim outlet' : 'Manage the outlet team',
      desc: isId
        ? 'Undang tim, bagi role, dan rapikan akses outlet ini.'
        : 'Invite teammates, assign roles, and keep outlet access tidy.',
      primaryLabel: isId ? 'Atur tim' : 'Manage team',
      primaryTarget: 'umkm-team',
      secondaryLabel: isId ? 'Ganti outlet' : 'Switch outlet',
      secondaryHref: buildSetupHref('list'),
    };
  }, [buildSetupHref, currentWorkspace, isId, selectedStore]);
  const simpleWorkspaceStats = useMemo(() => {
    if (!selectedStore) return [];

    if (currentWorkspace === 'catalog') {
      return [
        {
          label: isId ? 'Produk' : 'Products',
          value: products.length,
          desc: isId ? 'Sudah masuk katalog' : 'Already in catalog',
        },
        {
          label: isId ? 'Stok cek' : 'Stock check',
          value: lowStockCount + outOfStockCount,
          desc:
            outOfStockCount > 0
              ? isId
                ? `${outOfStockCount} habis`
                : `${outOfStockCount} empty`
              : lowStockCount > 0
                ? isId
                  ? `${lowStockCount} tipis`
                  : `${lowStockCount} low`
                : isId
                  ? 'Masih aman'
                  : 'Still healthy',
        },
        {
          label: isId ? 'Pesanan aktif' : 'Live orders',
          value: openOrders.length,
          desc: isId ? 'Masih berjalan' : 'Still in progress',
        },
      ];
    }

    if (currentWorkspace === 'operations') {
      return [
        {
          label: supportsDineInFlow
            ? isId
              ? 'Meja'
              : 'Tables'
            : isId
              ? 'Booking hari ini'
              : 'Today bookings',
          value: supportsDineInFlow
            ? tables.length
            : reservationSummary.todayCount,
          desc: supportsDineInFlow
            ? isId
              ? 'Area layanan'
              : 'Service spots'
            : reservationSummary.active > 0
              ? isId
                ? `${reservationSummary.active} aktif`
                : `${reservationSummary.active} active`
              : isId
                ? 'Belum ada'
                : 'No active sessions',
        },
        {
          label: isId ? 'QR siap' : 'Ready QR',
          value: qrs.length,
          desc: onlineQr
            ? isId
              ? 'Online aktif'
              : 'Online live'
            : isId
              ? 'Belum dibuat'
              : 'Not set yet',
        },
        {
          label: isId ? 'Aktif hari ini' : 'Active today',
          value: reservationSummary.active,
          desc: isId ? 'Booking / sesi jalan' : 'Live bookings / sessions',
        },
      ];
    }

    if (currentWorkspace === 'orders') {
      return [
        {
          label: isId ? 'Aktif' : 'Active',
          value: orderSummary.unpaid,
          desc: isId ? 'Belum selesai' : 'Still in progress',
        },
        {
          label: isId ? 'Menunggu bill' : 'Awaiting bill',
          value: orderSummary.awaitingBill,
          desc: isId ? 'Butuh konfirmasi' : 'Needs confirmation',
        },
        {
          label: isId ? 'Selesai' : 'Completed',
          value: orderSummary.completed,
          desc: isId ? 'Sudah dibayar' : 'Already paid',
        },
      ];
    }

    const distinctRoles = new Set(teamMembers.map(member => member.role)).size;
    const leadCount = teamMembers.filter(member =>
      ['manager', 'finance'].includes(member.role),
    ).length;

    return [
      {
        label: isId ? 'Anggota' : 'Members',
        value: teamMembers.length,
        desc: isId ? 'Sudah punya akses' : 'Already have access',
      },
      {
        label: isId ? 'Role aktif' : 'Active roles',
        value: distinctRoles,
        desc: isId ? 'Jenis akses' : 'Access types',
      },
      {
        label: isId ? 'Lead' : 'Leads',
        value: leadCount,
        desc: isId ? 'Manager / finance' : 'Manager / finance',
      },
    ];
  }, [
    currentWorkspace,
    isId,
    lowStockCount,
    onlineQr,
    openOrders.length,
    orderSummary.awaitingBill,
    orderSummary.completed,
    orderSummary.unpaid,
    outOfStockCount,
    products.length,
    qrs.length,
    reservationSummary.active,
    reservationSummary.todayCount,
    selectedStore,
    supportsDineInFlow,
    tables.length,
    teamMembers,
  ]);
  const simpleWorkspaceNote = useMemo(() => {
    if (!selectedStore) return null;

    if (currentWorkspace === 'catalog') {
      if (products.length === 0) {
        return {
          tone: 'warning' as const,
          text: isId
            ? 'Belum ada jualan. Tambah satu produk dulu.'
            : 'No products yet. Add one listing first so the catalog becomes usable.',
        };
      }
      if (outOfStockCount > 0) {
        return {
          tone: 'warning' as const,
          text: isId
            ? `${outOfStockCount} produk habis. Rapikan stok dulu sebelum tambah promo.`
            : `${outOfStockCount} products are empty. Fix stock first before pushing promos.`,
        };
      }
      if (lowStockCount > 0) {
        return {
          tone: 'warning' as const,
          text: isId
            ? `${lowStockCount} produk mulai tipis. Cek stok yang paling laku dulu.`
            : `${lowStockCount} products are running low. Review your fastest sellers first.`,
        };
      }
      return {
        tone: 'success' as const,
        text: isId
          ? 'Katalog cukup aman. Tinggal tambah atau rapikan listing yang perlu.'
          : 'The catalog looks healthy. Add or refine listings as needed.',
      };
    }

    if (currentWorkspace === 'operations') {
      if (reservationSummary.todayCount > 0) {
        return {
          tone: 'warning' as const,
          text: isId
            ? `${reservationSummary.todayCount} booking hari ini perlu dipantau.`
            : `${reservationSummary.todayCount} bookings need attention today.`,
        };
      }
      if (qrs.length === 0 && tables.length === 0) {
        return {
          tone: 'warning' as const,
          text: isId
            ? 'QR dan area layanan belum siap. Mulai dari setelan operasional dulu.'
            : 'QR and service spots are not ready yet. Start with the operations setup.',
        };
      }
      return {
        tone: 'success' as const,
        text: isId
          ? 'Operasional inti sudah siap dipakai.'
          : 'The core operations flow is ready to use.',
      };
    }

    if (currentWorkspace === 'orders') {
      if (orderSummary.unpaid > 0) {
        return {
          tone: 'warning' as const,
          text: isId
            ? `${orderSummary.unpaid} pesanan aktif masih perlu dicek.`
            : `${orderSummary.unpaid} active orders still need review.`,
        };
      }
      return {
        tone: 'success' as const,
        text: isId
          ? 'Belum ada pesanan aktif sekarang.'
          : 'There are no active orders right now.',
      };
    }

    if (teamMembers.length === 0) {
      return {
        tone: 'warning' as const,
        text: isId
          ? 'Belum ada anggota tim. Semua akses masih di owner.'
          : 'There are no team members yet. All access is still on the owner account.',
      };
    }

    return {
      tone: 'success' as const,
      text: isId
        ? `${teamMembers.length} anggota sudah punya akses. Tinggal rapikan role jika perlu.`
        : `${teamMembers.length} teammates already have access. Refine roles if needed.`,
    };
  }, [
    currentWorkspace,
    isId,
    lowStockCount,
    orderSummary.unpaid,
    outOfStockCount,
    products.length,
    qrs.length,
    reservationSummary.todayCount,
    selectedStore,
    tables.length,
    teamMembers.length,
  ]);
  const workspaceHeaderShortcuts = useMemo(
    () => [
      {
        key: 'overview',
        href: buildWorkspaceHref('overview', selectedStore?.id),
        label: isId ? 'Utama' : 'Home',
      },
      {
        key: 'primary',
        href: selectedStore
          ? buildWorkspaceHref('orders', selectedStore.id)
          : buildSetupHref('create'),
        label: selectedStore
          ? isId
            ? 'Pesanan'
            : 'Orders'
          : isId
            ? 'Buat'
            : 'Add',
      },
      {
        key: 'storefront',
        href: selectedStore
          ? buildUmkmStorefrontPath(selectedStore.slug)
          : buildWorkspaceHref('setup', selectedStoreId),
        label: selectedStore
          ? isId
            ? 'Toko'
            : 'Store'
          : isId
            ? 'Usaha'
            : 'Setup',
      },
    ],
    [buildSetupHref, buildWorkspaceHref, isId, selectedStore, selectedStoreId],
  );
  const workspaceNavTiles = useMemo(
    () => [
      {
        id: 'overview',
        icon: LayoutDashboard,
        title: isId ? 'Utama' : 'Overview',
        desc: isId ? 'Arah cepat.' : 'Quick direction.',
        badge: isId ? 'Utama' : 'Main',
        selected: isOverviewWorkspace,
        href: buildWorkspaceHref('overview'),
      },
      {
        id: 'setup',
        icon: FileText,
        title: isId ? 'Usaha' : 'Business',
        desc: isId ? 'Data utama.' : 'Core info.',
        badge:
          currentWorkspace === 'setup'
            ? isSetupCreateView
              ? isId
                ? 'Tambah'
                : 'Create'
              : isSetupDetailView
                ? isId
                  ? 'Detail'
                  : 'Detail'
                : isId
                  ? 'Daftar'
                  : 'List'
            : isId
              ? 'Data'
              : 'Info',
        selected: currentWorkspace === 'setup',
        href: buildSetupHref(
          isSetupDetailView && selectedStoreId
            ? 'detail'
            : isSetupCreateView
              ? 'create'
              : 'list',
          isSetupDetailView ? selectedStoreId : undefined,
        ),
      },
      {
        id: 'catalog',
        icon: PackagePlus,
        title: isId ? 'Jualan' : 'Products',
        desc: isId ? 'Produk dan stok.' : 'Products and stock.',
        badge: `${products.length} ${isId ? 'item' : 'items'}`,
        selected: currentWorkspace === 'catalog',
        href: buildWorkspaceHref('catalog'),
      },
      {
        id: 'operations',
        icon: Table2,
        title: isId ? 'Operasional' : 'Operations',
        desc: isId ? 'QR, booking, alur.' : 'QR, bookings, flow.',
        badge: operationsWorkspaceCopy.badge,
        selected: currentWorkspace === 'operations',
        href: buildWorkspaceHref('operations'),
      },
      {
        id: 'orders',
        icon: WalletCards,
        title: isId ? 'Pesanan' : 'Orders',
        desc: isId ? 'Yang lagi jalan.' : 'Live queue.',
        badge: `${orderSummary.unpaid} ${isId ? 'aktif' : 'active'}`,
        selected: currentWorkspace === 'orders',
        href: buildWorkspaceHref('orders'),
      },
      {
        id: 'team',
        icon: Users,
        title: isId ? 'Tim' : 'Team',
        desc: isId ? 'Akses tim.' : 'Team access.',
        badge: `${teamMembers.length} ${isId ? 'anggota' : 'members'}`,
        selected: currentWorkspace === 'team',
        href: buildWorkspaceHref('team'),
      },
    ],
    [
      buildSetupHref,
      buildWorkspaceHref,
      currentWorkspace,
      isId,
      isOverviewWorkspace,
      isSetupCreateView,
      isSetupDetailView,
      operationsWorkspaceCopy.badge,
      orderSummary.unpaid,
      products.length,
      selectedStoreId,
      teamMembers.length,
    ],
  );
  const workspaceShortcutTiles = useMemo(
    () =>
      workspaceNavTiles.filter(tile =>
        ['setup', 'catalog', 'operations', 'orders'].includes(tile.id),
      ),
    [workspaceNavTiles],
  );
  const setupPrimaryAction =
    currentWorkspace === 'setup'
      ? isSetupCreateView
        ? {
          href: buildSetupHref('list'),
          label: isId ? 'Daftar outlet' : 'See outlets',
        }
        : isSetupDetailView
          ? {
            href: buildSetupHref('list'),
            label: isId ? 'Pilih outlet' : 'Choose outlet',
          }
          : {
            href: buildSetupHref('create'),
            label: isId ? 'Tambah usaha' : 'Add business',
          }
      : null;
  const setupHeaderCopy =
    currentWorkspace === 'setup'
      ? isSetupCreateView
        ? {
          eyebrow: isId ? 'Buka usaha' : 'Add business',
          title: isId
            ? 'Buat profil usaha yang rapi'
            : 'Create a clean business profile',
          desc: isId
            ? 'Ikuti alur singkat: info dasar, lokasi, kontak, operasional, lalu review.'
            : 'Follow the short flow: basic info, location, contact, operations, then review.',
        }
        : isSetupDetailView
          ? {
            eyebrow: isId ? 'Edit usaha' : 'Edit business',
            title:
              selectedStore?.name || (isId ? 'Edit usaha' : 'Edit business'),
            desc: isId ? 'Ubah yang perlu aja.' : 'Change only what matters.',
          }
          : {
            eyebrow: isId ? 'Daftar outlet' : 'Outlet list',
            title: isId ? 'Pilih outlet' : 'Pick one outlet',
            desc: isId
              ? 'Tap outlet yang mau dipakai sekarang.'
              : 'Tap the outlet you want to use right now.',
          }
      : null;
  const ActiveSetupDetailStepIcon = activeSetupDetailStepMeta?.icon || FileText;
  const renderGuidedFlowAction = (
    action: GuidedFlowAction,
    className: string,
  ) => {
    if (action.kind === 'href') {
      return (
        <Link href={action.href} className={className}>
          <span>{action.label}</span>
          <ChevronRight className="h-4 w-4" />
        </Link>
      );
    }

    return (
      <button
        type="button"
        onClick={() => scrollToSection(action.target)}
        className={className}
      >
        <span>{action.label}</span>
        <ChevronRight className="h-4 w-4" />
      </button>
    );
  };

  return (
    <main className="page-shell overflow-x-hidden py-0 pb-8 sm:pb-0 sm:py-2.5 umkm-hub">
      <div className="flex w-full flex-col gap-2 sm:mx-auto sm:max-w-[var(--app-max-width)] sm:gap-2.5">
        {useSimpleOverviewLayout ? (
          <section className="rounded-none border-x-0 p-2 sm:p-2.5">
            <div className={manageDashboardShellClass}>
              <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-emerald-200/55 blur-3xl dark:bg-emerald-400/10" />
              <div className="pointer-events-none absolute -bottom-20 left-1/4 h-44 w-44 rounded-full bg-sky-100/75 blur-3xl dark:bg-sky-500/10" />
              <div className="relative grid gap-3 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className={manageDashboardCardClass}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 max-w-2xl">
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]">
                        {isId ? 'Dashboard usaha' : 'Business dashboard'}
                      </p>
                      <h1 className="mt-1 text-[1.18rem] font-black leading-tight tracking-tight text-[color:var(--app-text)] sm:text-[1.55rem]">
                        {selectedStore
                          ? isId
                            ? selectedStore.name
                            : selectedStore.name
                          : isId
                            ? 'Kelola usaha dari satu tempat'
                            : 'Manage the business from one place'}
                      </h1>
                      <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[color:var(--app-text-soft)] sm:text-[13px]">
                        {selectedStore
                          ? isId
                            ? myStores.length > 1
                              ? 'Lihat prioritas, katalog, pesanan, dan usaha lain tanpa pindah-pindah tampilan.'
                              : 'Lihat prioritas, katalog, pesanan, dan langkah berikutnya dalam satu tampilan.'
                            : myStores.length > 1
                              ? `Focus on ${selectedStore.name} first. Clean up the foundation, add the listings, then switch quickly to the other businesses from the portfolio below.`
                              : `Focus on ${selectedStore.name} first. Clean up the foundation, add the listings, then move into orders.`
                          : myStores.length > 0
                            ? isId
                              ? 'Pilih usaha aktif dulu, lalu dashboard akan nunjukin aksi yang paling penting.'
                              : 'Choose the active business first. You can still switch to other businesses anytime from the portfolio.'
                            : isId
                              ? 'Mulai dari usaha pertama, lalu lanjut ke info usaha, katalog, pesanan, dan tim.'
                              : 'Start with the first business. After it is saved, you can add more businesses, and the setup, catalog, and operations flow becomes easier to understand.'}
                      </p>
                    </div>
                    <InlineBadge
                      tone={
                        selectedStore
                          ? simpleOverviewCompletedSteps ===
                            simpleOverviewFlowSteps.length
                            ? 'success'
                            : 'accent'
                          : 'default'
                      }
                    >
                      {selectedStore
                        ? `${simpleOverviewCompletedSteps}/${simpleOverviewFlowSteps.length} ${isId ? 'langkah rapi' : 'steps tidy'}`
                        : isId
                          ? 'Belum pilih usaha'
                          : 'No active business'}
                    </InlineBadge>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {selectedStore && nextOwnerStep ? (
                      <button
                        type="button"
                        onClick={() => scrollToSection(nextOwnerStep.target)}
                        className="ui-button-primary inline-flex items-center gap-2 px-3.5 text-[12px] font-semibold"
                      >
                        <ArrowRightLeft className="h-4 w-4" />
                        {nextOwnerStep.label}
                      </button>
                    ) : (
                      <Link
                        href={buildSetupHref(
                          selectedStore
                            ? 'detail'
                            : myStores.length > 0
                              ? 'list'
                              : 'create',
                          selectedStore?.id,
                        )}
                        className="ui-button-primary px-3.5 text-[12px] font-semibold"
                      >
                        {selectedStore
                          ? isId
                            ? 'Buka setup usaha'
                            : 'Open business setup'
                          : myStores.length > 0
                            ? isId
                              ? 'Pilih usaha aktif'
                              : 'Choose active business'
                            : isId
                              ? 'Buat usaha'
                              : 'Add business'}
                      </Link>
                    )}
                    {selectedStore && myStores.length > 1 ? (
                      <button
                        type="button"
                        onClick={() =>
                          scrollToSection('umkm-overview-portfolio')
                        }
                        className="ui-button-secondary px-3.5 text-[12px] font-semibold"
                      >
                        {isId ? 'Kelola semua usaha' : 'Manage all businesses'}
                      </button>
                    ) : (
                      <Link
                        href={
                          selectedStore
                            ? buildWorkspaceHref('overview', selectedStore.id)
                            : myStores.length > 0
                              ? buildSetupHref('list')
                              : UMKM_DISCOVERY_PATH
                        }
                        className="ui-button-secondary px-3.5 text-[12px] font-semibold"
                      >
                        {selectedStore
                          ? isId
                            ? 'Buka usaha'
                            : 'Open business'
                          : myStores.length > 0
                            ? isId
                              ? 'Daftar usaha'
                              : 'Business list'
                            : isId
                              ? 'Lihat peta'
                              : 'Browse map'}
                      </Link>
                    )}
                    {myStores.length > 0 ? (
                      <Link
                        href={buildSetupHref('create')}
                        className="ui-button-secondary px-3.5 text-[12px] font-semibold"
                      >
                        {isId ? 'Tambah usaha lain' : 'Add another business'}
                      </Link>
                    ) : null}
                  </div>

                  {copyMessage ? (
                    <div className="mt-3 ui-inline-meta ui-success-text ui-success-border">
                      {copyMessage}
                    </div>
                  ) : null}

                  <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.12fr)_minmax(0,0.88fr)]">
                    <div className="rounded-[22px] border border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,240,0.94))] p-4 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.16)]">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                            {isId ? 'Fokus sekarang' : 'Current focus'}
                          </p>
                          <h2 className="mt-1 text-[1rem] font-black text-[color:var(--app-text)] sm:text-[1.08rem]">
                            {selectedStore
                              ? selectedStore.name
                              : isId
                                ? 'Pilih usaha aktif dulu'
                                : 'Pick an active business first'}
                          </h2>
                          <p className="mt-1 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                            {selectedStore
                              ? isId
                                ? 'Lanjutkan dari prioritas paling penting agar workspace tetap bersih dan gampang dipakai.'
                                : 'Continue from the most important priority so the workspace stays clean and easy to use.'
                              : isId
                                ? 'Setelah usaha dipilih, panel ini akan menampilkan langkah berikutnya yang paling relevan.'
                                : 'Once a business is selected, this panel will point to the most relevant next step.'}
                          </p>
                        </div>
                        <InlineBadge tone={selectedStore ? 'accent' : 'default'}>
                          {selectedStore
                            ? nextOwnerStep?.label ||
                              (isId ? 'Siap lanjut' : 'Ready to continue')
                            : isId
                              ? 'Belum aktif'
                              : 'Inactive'}
                        </InlineBadge>
                      </div>

                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        {simpleOverviewStats.slice(0, 3).map((item, index) => (
                          <div
                            key={item.label}
                            className={cn(
                              'rounded-[16px] border px-3 py-2.5',
                              index === 1
                                ? 'border-sky-100 bg-sky-50/80'
                                : index === 2
                                  ? 'border-amber-100 bg-amber-50/80'
                                  : 'border-emerald-100 bg-white/90',
                            )}
                          >
                            <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[color:var(--app-text-soft)]">
                              {item.label}
                            </p>
                            <p className="mt-1 text-[1.05rem] font-black text-[color:var(--app-text)]">
                              {item.value}
                            </p>
                            <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                              {item.desc}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-[22px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_16px_32px_-28px_rgba(15,23,42,0.14)]">
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                        {isId ? 'Langkah berikutnya' : 'Next step'}
                      </p>
                      <div className="mt-3 space-y-2">
                        {simpleOverviewFlowSteps.slice(0, 3).map(step => (
                          <div
                            key={step.id}
                            className={cn(
                              'flex items-start gap-3 rounded-[16px] border px-3 py-3',
                              step.done
                                ? 'border-emerald-100 bg-emerald-50/70'
                                : 'border-slate-200/80 bg-white',
                            )}
                          >
                            <span
                              className={cn(
                                'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-black',
                                step.done
                                  ? 'bg-emerald-600 text-white'
                                  : 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
                              )}
                            >
                              {step.done ? '✓' : step.badge.slice(0, 1)}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[12px] font-black text-[color:var(--app-text)]">
                                {step.title}
                              </span>
                              <span className="mt-1 block text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                {step.desc}
                              </span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2 md:grid-cols-3">
                    {simpleOverviewFlowSteps.map((step, index) => (
                      <article
                        key={step.id}
                        className={cn(
                          'relative overflow-hidden rounded-[18px] border px-3 py-3 shadow-[0_14px_28px_-25px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5 sm:px-3.5',
                          step.done
                            ? 'border-emerald-200 bg-emerald-50/80 dark:border-emerald-400/18 dark:bg-emerald-400/10'
                            : step.tone === 'warning'
                              ? 'border-amber-200 bg-amber-50/78 dark:border-amber-400/18 dark:bg-amber-400/10'
                              : 'border-slate-200/85 bg-white/92 dark:border-slate-800/80 dark:bg-slate-950/82',
                        )}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <span
                            className={cn(
                              'inline-flex min-h-[30px] min-w-8 items-center justify-center rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.08em]',
                              step.done
                                ? 'bg-emerald-600 text-white'
                                : step.tone === 'warning'
                                  ? 'bg-amber-500 text-white'
                                  : 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]',
                            )}
                          >
                            {index + 1}
                          </span>
                          <InlineBadge tone={step.tone}>
                            {step.badge}
                          </InlineBadge>
                        </div>
                        <p className="mt-3 text-[14px] font-black leading-tight text-[color:var(--app-text)]">
                          {step.title}
                        </p>
                        <p className="mt-1 line-clamp-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                          {step.desc}
                        </p>
                        <div className="mt-3">
                          {renderGuidedFlowAction(
                            step.action,
                            cn(
                              'inline-flex w-full items-center justify-between rounded-[14px] px-3.5 py-2.5 text-[12px] font-semibold',
                              step.done
                                ? 'ui-button-secondary'
                                : 'ui-button-primary',
                            ),
                          )}
                        </div>
                      </article>
                    ))}
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className={manageDashboardSoftCardClass}>
                    {selectedStore ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                              {isId
                                ? 'Usaha yang dipakai sekarang'
                                : 'Currently active business'}
                            </p>
                            <h3 className="mt-1 truncate text-[14px] font-black text-[color:var(--app-text)]">
                              {selectedStore.name}
                            </h3>
                            <p className="mt-1 line-clamp-2 text-[10px] leading-4 ui-text-soft sm:text-[11px]">
                              {[selectedStore.city, selectedStore.address]
                                .filter(Boolean)
                                .join(' - ')}
                            </p>
                          </div>
                          <InlineBadge tone="accent">
                            {selectedStore.access_role
                              ? teamRoleLabel(selectedStore.access_role, isId)
                              : isId
                                ? 'Pemilik'
                                : 'Owner'}
                          </InlineBadge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {selectedBusinessCategory ? (
                            <InlineBadge tone="default">
                              {getUmkmBusinessCategoryLabel(
                                selectedBusinessCategory,
                                isId,
                              )}
                            </InlineBadge>
                          ) : null}
                          <InlineBadge
                            tone={
                              hasEnabledPublishChannel &&
                                verificationGapCount === 0
                                ? 'success'
                                : 'warning'
                            }
                          >
                            {hasEnabledPublishChannel &&
                              verificationGapCount === 0
                              ? isId
                                ? 'Publish siap'
                                : 'Publish ready'
                              : isId
                                ? 'Setup belum rapi'
                                : 'Setup still incomplete'}
                          </InlineBadge>
                          <InlineBadge tone={onlineQr ? 'success' : 'default'}>
                            {onlineQr
                              ? isId
                                ? 'QR siap'
                                : 'QR ready'
                              : isId
                                ? 'QR nanti'
                                : 'QR later'}
                          </InlineBadge>
                        </div>

                        <div className="mt-3 grid gap-2 sm:grid-cols-3 xl:grid-cols-1">
                          {simpleOverviewStats.map((item, index) => (
                            <div
                              key={item.label}
                              className={cn(
                                'rounded-[16px] border px-3 py-2.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.72)]',
                                index === 1
                                  ? 'border-sky-100 bg-sky-50/82 text-sky-800 dark:border-sky-400/16 dark:bg-sky-400/10 dark:text-sky-100'
                                  : index === 2
                                    ? 'border-amber-100 bg-amber-50/82 text-amber-800 dark:border-amber-400/16 dark:bg-amber-400/10 dark:text-amber-100'
                                    : 'border-emerald-100 bg-white/88 text-emerald-800 dark:border-emerald-400/16 dark:bg-white/[0.07] dark:text-emerald-100',
                              )}
                            >
                              <p className="text-[9px] font-black uppercase tracking-[0.14em] opacity-70">
                                {item.label}
                              </p>
                              <p className="mt-1 text-[1.15rem] font-black leading-none tracking-tight">
                                {item.value}
                              </p>
                              <p className="mt-1 line-clamp-1 text-[10px] font-semibold opacity-72">
                                {item.desc}
                              </p>
                            </div>
                          ))}
                        </div>
                      </>
                    ) : (
                      <div className="space-y-3">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                            {myStores.length > 0
                              ? isId
                                ? 'Pilih usaha aktif'
                                : 'Choose the active business'
                              : isId
                                ? 'Mulai dari sini'
                                : 'Start here'}
                          </p>
                          <h3 className="mt-1 text-[14px] font-black text-[color:var(--app-text)]">
                            {myStores.length > 0
                              ? isId
                                ? 'Pilih usaha aktif'
                                : 'The businesses are ready, pick the active one'
                              : isId
                                ? 'Mulai dari usaha pertama'
                                : 'Start with the first business'}
                          </h3>
                          <p className="mt-1 text-[10px] leading-4 ui-text-soft sm:text-[11px]">
                            {myStores.length > 0
                              ? isId
                                ? `${myStores.length} usaha tersedia. Pilih yang dipakai sekarang.`
                                : `${myStores.length} businesses are already available. Choose the one to use now, and add more businesses anytime when needed.`
                              : isId
                                ? 'Simpan usaha pertama, lanjut langkah berikutnya.'
                                : 'Once the first business is saved, this page can point you clearly to the next step, and you can still add more businesses later.'}
                          </p>
                        </div>
                        <Link
                          href={buildSetupHref(
                            myStores.length > 0 ? 'list' : 'create',
                          )}
                          className="ui-button-primary inline-flex items-center justify-center px-4 text-sm font-semibold"
                        >
                          {myStores.length > 0
                            ? isId
                              ? 'Pilih usaha aktif'
                              : 'Choose active business'
                            : isId
                              ? 'Buat usaha pertama'
                              : 'Add the first business'}
                        </Link>
                      </div>
                    )}
                  </div>

                  <div className="rounded-[20px] border border-amber-100/90 bg-[linear-gradient(135deg,#fffbeb_0%,#ffffff_100%)] px-3.5 py-3.5 shadow-[0_14px_28px_-26px_rgba(15,23,42,0.18)] dark:border-amber-400/14 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.18),rgba(15,23,42,0.92))]">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                          {isId ? 'Prioritas sekarang' : 'Priority now'}
                        </p>
                        <p className="mt-1 text-[11px] leading-5 ui-text-soft">
                          {selectedStore
                            ? isId
                              ? 'Bereskan yang paling ngaruh dulu.'
                              : 'Do not tackle everything at once. Fix the highest-impact piece first.'
                            : isId
                              ? 'Pilih usaha dulu.'
                              : 'Once a business is selected, this area will point to the next move.'}
                        </p>
                      </div>
                      <InlineBadge
                        tone={
                          selectedStore
                            ? ownerAlerts.length > 0
                              ? 'warning'
                              : 'success'
                            : 'default'
                        }
                      >
                        {selectedStore
                          ? ownerAlerts.length > 0
                            ? `${ownerAlerts.length} ${isId ? 'yang perlu dicek' : 'items to review'}`
                            : isId
                              ? 'Aman'
                              : 'Healthy'
                          : isId
                            ? 'Menunggu usaha'
                            : 'Waiting for a business'}
                      </InlineBadge>
                    </div>

                    <div className="mt-3 space-y-2">
                      {!selectedStore ? (
                        <div className="rounded-[16px] border border-dashed border-[color:var(--app-accent-border)] bg-white/92 px-3 py-3 text-[11px] leading-5 ui-text-soft dark:bg-slate-950/84">
                          {isId
                            ? 'Urutan simpel: pilih usaha, rapikan info, tambah jualan.'
                            : 'If it still feels fuzzy, keep the order simple: choose a business, tidy the essentials, then add the first listing.'}
                        </div>
                      ) : ownerAlerts.length === 0 ? (
                        <div className="rounded-[16px] border border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] px-3 py-3 text-[11px] leading-5 ui-success-text">
                          {isId
                            ? 'Fondasi rapi. Lanjut katalog, order, atau operasional.'
                            : 'The business foundation is already in good shape. Continue with the catalog, orders, or operations.'}
                        </div>
                      ) : (
                        ownerAlerts.slice(0, 2).map(alert => {
                          const AlertIcon = alert.icon;
                          return (
                            <button
                              key={alert.id}
                              type="button"
                              onClick={() => scrollToSection(alert.target)}
                              className="flex w-full items-start gap-3 rounded-[16px] bg-white px-3 py-3 text-left shadow-[0_12px_22px_-20px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 dark:bg-slate-950 dark:ring-slate-800/80"
                            >
                              <div className="rounded-[14px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_28%,white)] p-2 text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
                                <AlertIcon className="h-4 w-4" />
                              </div>
                              <div className="min-w-0">
                                <p className="text-[12px] font-black text-[color:var(--app-text)]">
                                  {alert.title}
                                </p>
                                <p className="mt-1 line-clamp-2 text-[10px] leading-4 ui-text-soft sm:text-[11px] sm:leading-5">
                                  {alert.desc}
                                </p>
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>

                {myStores.length > 0 ? (
                  <div
                    id="umkm-overview-portfolio"
                    className="mt-3 rounded-[22px] border border-emerald-100/90 bg-white/88 p-3 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-emerald-400/14 dark:bg-slate-950/80 sm:p-4"
                  >
                    <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
                      <div>
                        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
                          <div className="max-w-3xl">
                            <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[color:var(--app-accent)]/72">
                              {isId
                                ? 'Control center'
                                : 'Multi-business control center'}
                            </p>
                            <h3 className="mt-1 text-[1.02rem] font-black leading-tight text-[color:var(--app-text)] sm:text-[1.18rem]">
                              {isId
                                ? 'Pilih usaha. Cek prioritas. Lanjut aksi.'
                                : 'Pick the active business, review priorities, then jump into the next action'}
                            </h3>
                            <p className="mt-2 text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                              {isId
                                ? 'Cari outlet, filter yang perlu aksi, lalu buka detail.'
                                : 'This page now acts as the owner control center. Search outlets, filter what needs action, switch the active business without leaving the page, then open the detail workspace only when needed.'}
                            </p>
                          </div>

                          <div className="w-full rounded-[20px] border border-white/70 bg-white/92 px-4 py-3 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.18)] xl:max-w-[290px]">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]/72">
                              {isId ? 'Fokus portofolio' : 'Portfolio focus'}
                            </p>
                            <p className="mt-1.5 text-[13px] font-black text-[color:var(--app-text)]">
                              {portfolioPriorityStore
                                ? portfolioPriorityStore.store.name
                                : isId
                                  ? 'Belum ada usaha'
                                  : 'No business yet'}
                            </p>
                            <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                              {portfolioPriorityStore
                                ? portfolioPriorityStore.nextActionDesc
                                : isId
                                  ? 'Tambah usaha dulu.'
                                  : 'Add a business first so this control center can be used.'}
                            </p>
                            {portfolioPriorityStore ? (
                              <div className="mt-3 flex flex-wrap gap-1.5">
                                <InlineBadge
                                  tone={portfolioPriorityStore.healthTone}
                                >
                                  {portfolioPriorityStore.healthLabel}
                                </InlineBadge>
                                <InlineBadge
                                  tone={
                                    portfolioPriorityStore.selected
                                      ? 'accent'
                                      : 'default'
                                  }
                                >
                                  {portfolioPriorityStore.selected
                                    ? isId
                                      ? 'Sedang dipakai'
                                      : 'Currently active'
                                    : isId
                                      ? 'Siap dipilih'
                                      : 'Ready to switch'}
                                </InlineBadge>
                              </div>
                            ) : null}
                          </div>
                        </div>

                        <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                          <StatCard
                            label={isId ? 'Total usaha' : 'Businesses'}
                            value={myStores.length}
                            desc={
                              isId
                                ? 'Semua outlet yang Anda pegang'
                                : 'All outlets in your portfolio'
                            }
                          />
                          <StatCard
                            label={isId ? 'Aktif' : 'Active'}
                            value={activeStoreCount}
                            desc={
                              isId
                                ? 'Sudah bisa dipakai operasional'
                                : 'Already usable for operations'
                            }
                          />
                          <StatCard
                            label={isId ? 'Butuh aksi' : 'Need action'}
                            value={storeAttentionCount}
                            desc={
                              isId
                                ? 'Outlet yang masih ada gap owner'
                                : 'Outlets still missing owner essentials'
                            }
                          />
                          <StatCard
                            label={isId ? 'Siap jalan' : 'Ready'}
                            value={readyStoreCount}
                            desc={
                              isId
                                ? `${liveStoreCount} outlet sedang live`
                                : `${liveStoreCount} outlets are live now`
                            }
                          />
                        </div>

                        <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
                          <label className="block min-w-0 flex-1">
                            <span className="sr-only">
                              {isId ? 'Cari usaha' : 'Search businesses'}
                            </span>
                            <input
                              type="search"
                              value={storeListQuery}
                              onChange={event =>
                                setStoreListQuery(event.target.value)
                              }
                              placeholder={
                                isId
                                  ? 'Cari nama usaha, kota, kategori, atau aksi berikutnya'
                                  : 'Search by business name, city, category, or next action'
                              }
                              className="min-h-[40px] w-full rounded-[12px] border border-[color:var(--app-accent-border)] bg-white px-3 text-[13px] text-[color:var(--app-text)] outline-none transition placeholder:text-[color:var(--app-text-soft)]/75 focus:border-[color:var(--app-accent)] focus:ring-2 focus:ring-[color:var(--app-accent-border)]"
                            />
                          </label>

                          <div className="flex flex-wrap gap-2">
                            {storeListFilterOptions.map(option => {
                              const active = option.id === storeListFilter;
                              return (
                                <button
                                  key={option.id}
                                  type="button"
                                  onClick={() => setStoreListFilter(option.id)}
                                  className={cn(
                                    'ui-pressable inline-flex min-h-[42px] items-center gap-2 rounded-full px-3.5 text-[12px] font-semibold transition',
                                    active
                                      ? 'bg-[color:color-mix(in_srgb,var(--app-accent-soft)_38%,white)] text-[color:var(--app-accent)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.18)] ring-1 ring-[color:var(--app-accent-border)]'
                                      : 'bg-white text-[color:var(--app-text-soft)] shadow-[0_10px_22px_-24px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 hover:-translate-y-0.5 hover:text-[color:var(--app-accent)]',
                                  )}
                                >
                                  <span>{option.label}</span>
                                  <span
                                    className={cn(
                                      'inline-flex h-6 min-w-[1.8rem] items-center justify-center rounded-full px-2 text-[10px] font-black',
                                      active
                                        ? 'bg-[color:var(--app-accent)] text-white'
                                        : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                                    )}
                                  >
                                    {option.count}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        <div className="mt-4">
                          {filteredStoreList.length === 0 ? (
                            <div className="rounded-[20px] border border-dashed border-[color:var(--app-accent-border)] bg-white/92 px-4 py-5 text-sm text-[color:var(--app-text-soft)]">
                              <p>{storeListEmptyMessage}</p>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {(hasStoreListQuery ||
                                  storeListFilter !== 'all') && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStoreListQuery('');
                                        setStoreListFilter('all');
                                      }}
                                      className="ui-button-secondary ui-button-compact inline-flex px-4 text-sm font-semibold"
                                    >
                                      {isId ? 'Reset pencarian' : 'Reset search'}
                                    </button>
                                  )}
                                <Link
                                  href={buildSetupHref('create')}
                                  className="ui-button-primary ui-button-compact inline-flex px-4 text-sm font-semibold"
                                >
                                  {isId
                                    ? 'Tambah usaha baru'
                                    : 'Add new business'}
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <div className="max-h-[820px] overflow-y-auto pr-1">
                              <div className="grid gap-3 xl:grid-cols-2">
                                {filteredStoreList.map(item => (
                                  <StoreSwitcherCard
                                    key={item.store.id}
                                    name={item.store.name}
                                    city={item.store.city}
                                    address={item.store.address}
                                    badges={item.badges}
                                    status={item.status}
                                    selected={item.selected}
                                    summary={item.summary}
                                    readinessPercent={item.readinessPercent}
                                    healthLabel={item.healthLabel}
                                    healthTone={item.healthTone}
                                    metrics={item.metrics}
                                    nextActionLabel={item.nextActionLabel}
                                    nextActionDesc={item.nextActionDesc}
                                    actionLabel={
                                      item.selected
                                        ? isId
                                          ? 'Sedang dipakai'
                                          : 'Currently active'
                                        : isId
                                          ? 'Pakai sekarang'
                                          : 'Use now'
                                    }
                                    secondaryActionHref={buildSetupHref(
                                      'detail',
                                      item.store.id,
                                    )}
                                    secondaryActionLabel={
                                      isId ? 'Edit usaha' : 'Edit business'
                                    }
                                    onClick={() =>
                                      setSelectedStoreId(item.store.id)
                                    }
                                  />
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-3">
                        <div className="rounded-[20px] border border-slate-200/80 bg-white/92 px-4 py-4 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.14)] dark:border-slate-800/80 dark:bg-slate-950/86">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                                {isId ? 'Sedang dipakai' : 'Current focus'}
                              </p>
                              <p className="mt-1 text-[13px] font-black text-[color:var(--app-text)]">
                                {selectedStoreInsight
                                  ? selectedStoreInsight.store.name
                                  : isId
                                    ? 'Pilih usaha dulu'
                                    : 'Choose a business first'}
                              </p>
                            </div>
                            <InlineBadge
                              tone={
                                selectedStoreInsight
                                  ? selectedStoreInsight.healthTone
                                  : 'default'
                              }
                            >
                              {selectedStoreInsight
                                ? selectedStoreInsight.healthLabel
                                : isId
                                  ? 'Belum aktif'
                                  : 'Not active yet'}
                            </InlineBadge>
                          </div>
                          <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                            {selectedStoreInsight
                              ? selectedStoreInsight.nextActionDesc
                              : isId
                                ? 'Setelah usaha dipilih, bagian ini akan kasih konteks dan langkah berikutnya.'
                                : 'Once a business is selected, this card will provide context and the next step.'}
                          </p>
                          {selectedStoreInsight ? (
                            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                              <Link
                                href={buildWorkspaceHref(
                                  'orders',
                                  selectedStoreInsight.store.id,
                                )}
                                className="ui-button-primary inline-flex items-center justify-center px-4 text-sm font-semibold"
                              >
                                {isId ? 'Buka pesanan' : 'Open orders'}
                              </Link>
                              <Link
                                href={buildWorkspaceHref(
                                  'catalog',
                                  selectedStoreInsight.store.id,
                                )}
                                className="ui-button-secondary inline-flex items-center justify-center px-4 text-sm font-semibold"
                              >
                                {isId ? 'Buka katalog' : 'Open catalog'}
                              </Link>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[20px] border border-slate-200/80 bg-slate-50/92 px-4 py-4 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.14)] dark:border-slate-800/80 dark:bg-slate-900/78">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                                {isId ? 'Berikutnya' : 'Up next'}
                              </p>
                              <p className="mt-1 text-[13px] font-black text-[color:var(--app-text)]">
                                {portfolioNextStore
                                  ? portfolioNextStore.store.name
                                  : isId
                                    ? 'Portofolio lagi rapi'
                                    : 'Portfolio is in good shape'}
                              </p>
                            </div>
                            <InlineBadge
                              tone={
                                portfolioNextStore
                                  ? portfolioNextStore.readyNow
                                    ? 'success'
                                    : 'warning'
                                  : 'success'
                              }
                            >
                              {portfolioNextStore
                                ? portfolioNextStore.readyNow
                                  ? isId
                                    ? 'Siap dorong'
                                    : 'Ready to grow'
                                  : isId
                                    ? 'Perlu follow-up'
                                    : 'Needs follow-up'
                                : isId
                                  ? 'Aman'
                                  : 'Healthy'}
                            </InlineBadge>
                          </div>
                          <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                            {portfolioNextStore
                              ? portfolioNextStore.summary
                              : isId
                                ? 'Outlet yang ada sudah cukup rapi. Lanjutkan ke penjualan, promosi, atau ekspansi usaha berikutnya.'
                                : 'The listed outlets are already in good shape. Continue into selling, promotion, or the next business expansion.'}
                          </p>
                          {portfolioNextStore ? (
                            <div className="mt-3 flex flex-col gap-2">
                              <button
                                type="button"
                                onClick={() =>
                                  setSelectedStoreId(
                                    portfolioNextStore.store.id,
                                  )
                                }
                                className="ui-button-primary inline-flex items-center justify-center px-4 text-sm font-semibold"
                              >
                                {portfolioNextStore.selected
                                  ? isId
                                    ? 'Sudah aktif'
                                    : 'Already active'
                                  : isId
                                    ? 'Pakai usaha ini'
                                    : 'Use this business'}
                              </button>
                              <Link
                                href={buildSetupHref(
                                  'detail',
                                  portfolioNextStore.store.id,
                                )}
                                className="ui-button-secondary inline-flex items-center justify-center px-4 text-sm font-semibold"
                              >
                                {isId ? 'Edit setup' : 'Edit setup'}
                              </Link>
                            </div>
                          ) : null}
                        </div>

                        <div className="rounded-[20px] border border-slate-200/80 bg-white/92 px-4 py-4 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.14)] dark:border-slate-800/80 dark:bg-slate-950/86">
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                            {isId ? 'Jalur cepat owner' : 'Owner quick links'}
                          </p>
                          <div className="mt-3 space-y-2">
                            <Link
                              href={buildSetupHref('create')}
                              className="ui-button-primary inline-flex w-full items-center justify-between px-4 text-sm font-semibold"
                            >
                              <span>
                                {isId
                                  ? 'Tambah usaha baru'
                                  : 'Add new business'}
                              </span>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                            <Link
                              href={buildSetupHref('list')}
                              className="ui-button-secondary inline-flex w-full items-center justify-between px-4 text-sm font-semibold"
                            >
                              <span>
                                {isId
                                  ? 'Buka daftar usaha penuh'
                                  : 'Open the full business list'}
                              </span>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                            <Link
                              href={buildAssistantHref()}
                              className="ui-button-secondary inline-flex w-full items-center justify-between px-4 text-sm font-semibold"
                            >
                              <span>
                                {isId
                                  ? 'Pakai asisten usaha'
                                  : 'Open business assistant'}
                              </span>
                              <ChevronRight className="h-4 w-4" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            </div>
          </section>
        ) : isOverviewWorkspace ? (
          <section className="ui-panel ui-hero-panel rounded-none border-x-0 p-2 sm:rounded-[24px] sm:border-x sm:p-2.5">
            <div className="overflow-hidden rounded-[20px] bg-white p-1.5 shadow-[0_20px_40px_-36px_rgba(15,23,42,0.14)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80 sm:rounded-[24px] sm:p-2">
              <div className="grid gap-2.5 xl:grid-cols-[minmax(0,1.1fr)_minmax(300px,0.9fr)]">
                <div className="rounded-[18px] bg-slate-50/92 p-3 ring-1 ring-slate-200/80 dark:bg-slate-900/78 dark:ring-slate-800/80 sm:rounded-[20px] sm:p-3.5">
                  <div className="flex flex-col gap-2.5 min-[520px]:flex-row min-[520px]:items-start min-[520px]:justify-between">
                    <div className="min-w-0">
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] ui-accent-text">
                        Lajukan UMKM
                      </p>
                      <h1 className="mt-1 text-[1.12rem] font-black tracking-tight ui-text sm:text-[1.4rem]">
                        {isId ? 'Kerjain yang penting dulu' : 'Manage fast'}
                      </h1>
                      <p className="mt-1 max-w-2xl text-[11px] leading-4 ui-text-soft sm:text-[12px]">
                        {isId
                          ? 'Yang penting dikerjain dulu. Sisanya bisa nyusul.'
                          : 'Open the main task first. The rest can follow.'}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <InlineBadge tone="accent">
                        {selectedStore
                          ? isId
                            ? 'Usaha yang lagi dipakai'
                            : 'Active business'
                          : isId
                            ? 'Belum pilih usaha'
                            : 'No business selected'}
                      </InlineBadge>
                      <InlineBadge tone="success">
                        {isId ? 'Mode simpel' : 'Fast lane'}
                      </InlineBadge>
                    </div>
                  </div>

                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() =>
                        scrollToSection(
                          selectedStore ? 'umkm-orders' : 'umkm-register',
                        )
                      }
                      className="ui-button-primary px-3.5 text-[12px] font-semibold"
                    >
                      {selectedStore
                        ? isId
                          ? 'Lanjut kerja'
                          : 'Continue'
                        : isId
                          ? 'Bikin usaha'
                          : 'Add business'}
                    </button>
                    <Link
                      href={UMKM_DISCOVERY_PATH}
                      className="ui-button-secondary px-3.5 text-[12px] font-semibold"
                    >
                      {isId ? 'Cari UMKM' : 'Map'}
                    </Link>
                    <Link
                      href="/chat"
                      className="ui-button-secondary px-3.5 text-[12px] font-semibold"
                    >
                      {isId ? 'Inbox' : 'Inbox'}
                    </Link>
                  </div>

                  {copyMessage ? (
                    <div className="mt-3 ui-inline-meta ui-success-text ui-success-border">
                      {copyMessage}
                    </div>
                  ) : null}

                  <div className="mt-2.5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                    {overviewWorkspaceTiles.map(item => (
                      <SectionJumpTile
                        key={item.id}
                        icon={item.icon}
                        title={item.title}
                        desc={item.desc}
                        badge={item.badge}
                        tone={item.tone}
                        disabled={item.disabled}
                        compact
                        actionLabel={isId ? 'Buka' : 'Open'}
                        selectedLabel={isId ? 'Aktif' : 'Active'}
                        onClick={() => openWorkspaceTile(item.id)}
                      />
                    ))}
                  </div>
                </div>

                <div className="grid gap-2">
                  <div className="rounded-[18px] border border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.94))] px-3.5 py-3.5 shadow-[0_16px_28px_-26px_rgba(15,23,42,0.18)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.96),rgba(2,6,23,0.94))]">
                    {selectedStore ? (
                      <>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                              {isId
                                ? 'Usaha yang lagi dipakai'
                                : 'Active business'}
                            </p>
                            <h3 className="mt-1 truncate text-[14px] font-black text-[color:var(--app-text)]">
                              {selectedStore.name}
                            </h3>
                            <p className="mt-1 line-clamp-2 text-[10px] leading-4 ui-text-soft sm:text-[11px]">
                              {[selectedStore.city, selectedStore.address]
                                .filter(Boolean)
                                .join(' - ')}
                            </p>
                          </div>
                          <InlineBadge tone="accent">
                            {selectedStore.access_role
                              ? teamRoleLabel(selectedStore.access_role, isId)
                              : isId
                                ? 'Pemilik'
                                : 'Owner'}
                          </InlineBadge>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {selectedBusinessCategory ? (
                            <InlineBadge tone="default">
                              {getUmkmBusinessCategoryLabel(
                                selectedBusinessCategory,
                                isId,
                              )}
                            </InlineBadge>
                          ) : null}
                          {selectedStore.online_order_enabled ? (
                            <InlineBadge tone="accent">
                              {isId ? 'Online nyala' : 'Online live'}
                            </InlineBadge>
                          ) : null}
                          {selectedStore.offline_order_enabled ? (
                            <InlineBadge tone="success">
                              {isId ? 'Offline nyala' : 'Offline live'}
                            </InlineBadge>
                          ) : null}
                          <InlineBadge tone={onlineQr ? 'success' : 'warning'}>
                            {onlineQr
                              ? isId
                                ? 'QR udah siap'
                                : 'QR ready'
                              : isId
                                ? 'QR belum jadi'
                                : 'QR pending'}
                          </InlineBadge>
                        </div>

                        <div className="mt-2.5 grid gap-2 sm:grid-cols-2">
                          <Link
                            href={buildSetupHref('detail', selectedStore.id)}
                            className="ui-button-secondary inline-flex items-center justify-center px-3.5 text-[12px] font-semibold"
                          >
                            {isId ? 'Edit usaha' : 'Edit business'}
                          </Link>
                          <Link
                            href={buildUmkmStorefrontPath(selectedStore.slug)}
                            className="ui-button-secondary inline-flex items-center justify-center px-3.5 text-[12px] font-semibold"
                          >
                            {storefrontActionLabel}
                          </Link>
                          {nextOwnerStep ? (
                            <button
                              type="button"
                              onClick={() =>
                                scrollToSection(nextOwnerStep.target)
                              }
                              className="ui-button-primary inline-flex items-center justify-center gap-2 px-3.5 text-[12px] font-semibold"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                              {nextOwnerStep.label}
                            </button>
                          ) : (
                            <Link
                              href={buildWorkspaceHref(
                                'orders',
                                selectedStore.id,
                              )}
                              className="ui-button-primary inline-flex items-center justify-center px-3.5 text-[12px] font-semibold"
                            >
                              {isId ? 'Buka pesanan' : 'Open orders'}
                            </Link>
                          )}
                        </div>

                        <div className="mt-2.5 space-y-2">
                          {ownerAlerts.length === 0 ? (
                            <div className="rounded-[18px] border border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] px-3 py-3 text-[11px] leading-5 ui-success-text">
                              {isId
                                ? 'Bagian pentingnya udah beres. Tinggal jalanin jualannya.'
                                : 'The core setup is ready. Keep selling.'}
                            </div>
                          ) : (
                            ownerAlerts.slice(0, 2).map(alert => {
                              const AlertIcon = alert.icon;
                              return (
                                <button
                                  key={alert.id}
                                  type="button"
                                  onClick={() => scrollToSection(alert.target)}
                                  className="flex w-full items-start gap-3 rounded-[18px] bg-white px-3 py-3 text-left shadow-[0_14px_24px_-20px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 transition hover:-translate-y-0.5 hover:shadow-[0_18px_28px_-20px_rgba(15,23,42,0.16)] dark:bg-slate-950 dark:ring-slate-800/80"
                                >
                                  <div className="rounded-[14px] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_28%,white)] p-2 text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
                                    <AlertIcon className="h-4 w-4" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[12px] font-black text-[color:var(--app-text)]">
                                      {alert.title}
                                    </p>
                                    <p className="mt-1 line-clamp-2 text-[10px] leading-4 ui-text-soft sm:text-[11px] sm:leading-5">
                                      {alert.desc}
                                    </p>
                                  </div>
                                </button>
                              );
                            })
                          )}
                        </div>
                      </>
                    ) : (
                      <div className="flex h-full flex-col justify-between gap-3.5">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                            {isId ? 'Belum ada usaha' : 'No business yet'}
                          </p>
                          <h3 className="mt-1 text-[14px] font-black text-[color:var(--app-text)]">
                            {isId
                              ? 'Bikin usaha dulu, yuk'
                              : 'Add a business first'}
                          </h3>
                          <p className="mt-1 text-[10px] leading-4 ui-text-soft sm:text-[11px]">
                            {isId
                              ? 'Mulai dari usaha pertama dulu. Setelah tersimpan, Anda bisa tambah usaha lain, lalu katalog, pesanan, dan tim jadi lebih gampang diatur.'
                              : 'Start with the first business. Once it is saved, you can add more businesses, and orders, catalog, and team flow become easier to manage.'}
                          </p>
                        </div>
                        <div className="grid gap-2 sm:grid-cols-2">
                          <button
                            type="button"
                            onClick={() => scrollToSection('umkm-register')}
                            className="ui-button-primary px-4 text-sm font-semibold"
                          >
                            {isId ? 'Bikin usaha' : 'Add business'}
                          </button>
                          <Link
                            href={UMKM_DISCOVERY_PATH}
                            className="ui-button-secondary inline-flex items-center justify-center px-4 text-sm font-semibold"
                          >
                            {isId ? 'Cari UMKM' : 'Open map'}
                          </Link>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </section>
        ) : null}

        <section className="ui-panel rounded-none border-x-0 p-3 sm:rounded-[24px] sm:border-x sm:p-4">
          {isSetupCreateView ? (
            useSimpleSetupCreateLayout ? (
              <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div className="max-w-2xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] ui-accent-text">
                    {isAssistantSetupRoute
                      ? isId
                        ? 'Asisten usaha'
                        : 'Business assistant'
                      : isId
                        ? 'Bikin usaha'
                        : 'Add business'}
                  </p>
                  <h2 className="mt-1 text-lg font-black ui-text">
                    {isAssistantSetupRoute
                      ? isId
                        ? 'Mulai usaha dengan pendamping yang jelas'
                        : 'Start the business with a clearer guide'
                      : isId
                        ? 'Buat profil usaha pertama'
                        : 'Create the first business profile'}
                  </h2>
                  <p className="mt-1 text-sm ui-text-soft">
                    {isAssistantSetupRoute
                      ? isId
                        ? 'Mulai dari fondasi, lalu lanjut rekomendasi.'
                        : 'This page helps the owner start from the foundation first, then adds search recommendations so the next move feels safer.'
                      : isId
                        ? 'Isi data seperti bikin profil toko: kategori, nama, kota, alamat, titik peta. Setelah tersimpan, baru tambah jualan dan operasional.'
                        : 'Fill it like a store profile: category, name, city, address, map pin. After saving, add listings and operations.'}
                  </p>
                </div>
                {setupPrimaryAction ? (
                  <Link
                    href={setupPrimaryAction.href}
                    className="ui-button-secondary px-4 text-sm font-semibold"
                  >
                    {setupPrimaryAction.label}
                  </Link>
                ) : null}
              </div>
            ) : (
              <div className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3.5 py-3.5 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.14)] sm:px-4 sm:py-4 dark:border-[color:var(--app-border-strong)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="min-w-0 max-w-3xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] ui-accent-text">
                      {isId ? 'Bikin usaha' : 'Add business'}
                    </p>
                    <h2 className="mt-1.5 text-lg font-black ui-text sm:text-[1.35rem]">
                      {isId
                        ? 'Mulai dari usaha pertama dulu'
                        : 'Start with the first business'}
                    </h2>
                    <p className="mt-1.5 text-[13px] leading-5 ui-text-soft">
                      {isId
                        ? 'Isi bagian pentingnya dulu aja. Setelah tersimpan, Anda tetap bisa rapikan detail dan tambah usaha lain kalau perlu.'
                        : 'Start with the core details. After saving, refine it later and add more businesses if needed.'}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <InlineBadge tone="accent">
                      {isId ? 'Mode santai' : 'Easy mode'}
                    </InlineBadge>
                    {setupPrimaryAction ? (
                      <Link
                        href={setupPrimaryAction.href}
                        className="ui-button-secondary ui-button-compact px-3 text-xs font-semibold"
                      >
                        {setupPrimaryAction.label}
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>
            )
          ) : useSimpleOverviewLayout ? null : useSimpleSetupShell ? (
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] font-black uppercase tracking-[0.22em] ui-accent-text">
                  {setupHeaderCopy?.eyebrow}
                </p>
                <h2 className="mt-1 text-lg font-black ui-text">
                  {setupHeaderCopy?.title}
                </h2>
                <p className="mt-1 text-sm ui-text-soft">
                  {setupHeaderCopy?.desc}
                </p>
              </div>
              <div className="grid w-full gap-2 sm:flex sm:w-auto sm:flex-wrap">
                {setupPrimaryAction ? (
                  <Link
                    href={setupPrimaryAction.href}
                    className="ui-button-primary w-full px-4 text-sm font-semibold sm:w-auto"
                  >
                    {setupPrimaryAction.label}
                  </Link>
                ) : null}
                {isSetupDetailView && selectedStore ? (
                  <Link
                    href={buildUmkmStorefrontPath(selectedStore.slug)}
                    className="ui-button-secondary w-full px-4 text-sm font-semibold sm:w-auto"
                  >
                    {storefrontActionLabel}
                  </Link>
                ) : null}
              </div>
            </div>
          ) : useSimpleWorkspaceShell ? (
            <div className="grid gap-4 xl:grid-cols-[220px_minmax(0,1fr)_320px]">
              <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,247,0.92))] p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-[color:var(--app-border-strong)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.92))]">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] ui-accent-text">
                  {isId ? 'Langkah usaha' : 'Business steps'}
                </p>
                <div className="mt-3 space-y-2.5">
                  {setupDetailSteps.map((step, index) => {
                    const active = step.id === activeSetupDetailStep;
                    const done = step.done;
                    return (
                      <button
                        key={step.id}
                        type="button"
                        onClick={() => openSetupDetailStep(step.id)}
                        className={cn(
                          'flex w-full items-start gap-3 rounded-[18px] border px-3 py-3 text-left transition',
                          active
                            ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
                            : 'border-[color:var(--app-border)] bg-white hover:border-[color:var(--app-accent-border)] dark:bg-slate-950/80',
                        )}
                        aria-current={active ? 'step' : undefined}
                      >
                        <span
                          className={cn(
                            'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black',
                            done
                              ? 'bg-[color:var(--app-accent)] text-white'
                              : active
                                ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                                : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                          )}
                        >
                          {index + 1}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-black ui-text">
                            {step.title}
                          </span>
                          <span className="mt-0.5 block text-[11px] leading-5 ui-text-soft">
                            {step.desc}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.18)] sm:p-5">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="max-w-2xl">
                  <p className="text-[10px] font-black uppercase tracking-[0.22em] ui-accent-text">
                    {simpleWorkspaceHero.eyebrow}
                  </p>
                  <h2 className="mt-1 text-lg font-black ui-text">
                    {simpleWorkspaceHero.title}
                  </h2>
                  <p className="mt-1 text-sm ui-text-soft">
                    {simpleWorkspaceHero.desc}
                  </p>
                </div>
                <div className="grid w-full gap-2 sm:w-auto sm:min-w-[220px]">
                  {'primaryTarget' in simpleWorkspaceHero ? (
                    <button
                      type="button"
                      onClick={() =>
                        scrollToSection(simpleWorkspaceHero.primaryTarget)
                      }
                      className="ui-button-primary w-full px-4 text-sm font-semibold"
                    >
                      {simpleWorkspaceHero.primaryLabel}
                    </button>
                  ) : (
                    <Link
                      href={simpleWorkspaceHero.primaryHref}
                      className="ui-button-primary w-full px-4 text-sm font-semibold"
                    >
                      {simpleWorkspaceHero.primaryLabel}
                    </Link>
                  )}
                  <Link
                    href={simpleWorkspaceHero.secondaryHref}
                    className="ui-button-secondary w-full px-4 text-sm font-semibold"
                  >
                    {simpleWorkspaceHero.secondaryLabel}
                  </Link>
                </div>
                </div>

                {selectedStore ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-3">
                    {simpleWorkspaceStats.map(item => (
                      <StatCard
                        key={item.label}
                        label={item.label}
                        value={item.value}
                        desc={item.desc}
                      />
                    ))}
                  </div>
                ) : null}

                {simpleWorkspaceNote ? (
                  <div
                    className={cn(
                      'mt-4 rounded-[18px] px-4 py-3 text-sm leading-5',
                      simpleWorkspaceNote.tone === 'warning'
                        ? 'border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] text-[color:var(--app-accent)]'
                        : 'border border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] text-[color:var(--app-accent)]',
                    )}
                  >
                    {simpleWorkspaceNote.text}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,247,0.92))] p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-[color:var(--app-border-strong)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.92))]">
                <p className="text-[10px] font-black uppercase tracking-[0.24em] ui-accent-text">
                  {isId ? 'Preview usaha' : 'Business preview'}
                </p>
                {selectedStore ? (
                  <div className="mt-3 rounded-[22px] border border-[color:var(--app-border)] bg-white p-4 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950">
                    <div className="flex items-start gap-3">
                      <span className="inline-flex h-14 w-14 shrink-0 items-center justify-center rounded-[20px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                        <Store className="h-6 w-6" />
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-black ui-text">
                          {selectedStore.name}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-sm ui-text-soft">
                          {[selectedStore.city, selectedStore.address]
                            .filter(Boolean)
                            .join(' - ')}
                        </p>
                      </div>
                    </div>
                    <div className="mt-4 grid gap-2">
                      {simpleWorkspaceStats.slice(0, 3).map(item => (
                        <StatCard
                          key={item.label}
                          label={item.label}
                          value={item.value}
                          desc={item.desc}
                          compact
                        />
                      ))}
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 rounded-[22px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-5 text-sm leading-6 ui-text-soft">
                    {isId
                      ? 'Pilih usaha dulu supaya panel kanan bisa menampilkan ringkasan dan langkah berikutnya.'
                      : 'Pick a business first so the right panel can show the preview and next move.'}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <>
              {currentWorkspace === 'setup' ? (
                <div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_340px]">
                  <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,247,0.92))] p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-[color:var(--app-border-strong)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.92))]">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] ui-accent-text">
                      {isId ? 'Langkah usaha' : 'Business steps'}
                    </p>
                    <div className="mt-3 space-y-2.5">
                      {STORE_CREATE_STEP_ORDER.map((stepId, index) => {
                        const active = stepId === storeCreateStep;
                        const unlocked =
                          index <= highestUnlockedStoreCreateStepIndex;
                        const label =
                          stepId === 'intro'
                            ? isId
                              ? 'Informasi dasar'
                              : 'Basic info'
                            : stepId === 'group'
                              ? isId
                                ? 'Jenis usaha'
                                : 'Business type'
                              : stepId === 'identity'
                                ? isId
                                  ? 'Nama & kategori'
                                  : 'Identity'
                                : stepId === 'location'
                                  ? isId
                                    ? 'Lokasi'
                                    : 'Location'
                                  : isId
                                    ? 'Operasional'
                                    : 'Operations';
                        return (
                          <button
                            key={stepId}
                            type="button"
                            onClick={() => jumpToStoreCreateStep(stepId)}
                            disabled={!unlocked}
                            className={cn(
                              'flex w-full items-start gap-3 rounded-[18px] border px-3 py-3 text-left transition disabled:cursor-not-allowed disabled:opacity-45',
                              active
                                ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)]'
                                : 'border-[color:var(--app-border)] bg-white hover:border-[color:var(--app-accent-border)] dark:bg-slate-950/80',
                            )}
                          >
                            <span
                              className={cn(
                                'mt-0.5 inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-black',
                                active
                                  ? 'bg-[color:var(--app-accent)] text-white'
                                  : unlocked
                                    ? 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)]'
                                    : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                              )}
                            >
                              {index + 1}
                            </span>
                            <span className="min-w-0">
                              <span className="block text-[13px] font-black ui-text">
                                {label}
                              </span>
                              <span className="mt-0.5 block text-[11px] leading-5 ui-text-soft">
                                {stepId === 'intro'
                                  ? isId
                                    ? 'Isi nama, kategori, dan deskripsi singkat.'
                                    : 'Fill the name, category, and short description.'
                                  : stepId === 'group'
                                    ? isId
                                      ? 'Pilih model usaha paling dekat.'
                                      : 'Pick the closest business model.'
                                    : stepId === 'identity'
                                      ? isId
                                        ? 'Buat identitas usaha yang mudah ditemukan.'
                                        : 'Create a findable business identity.'
                                      : stepId === 'location'
                                        ? isId
                                          ? 'Tentukan alamat dan titik peta.'
                                          : 'Set the address and map pin.'
                                        : isId
                                          ? 'Rapiin jam, layanan, dan kanal.'
                                          : 'Finish hours, services, and channels.'}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-[0_18px_36px_-30px_rgba(15,23,42,0.18)] sm:p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                      <div className="max-w-2xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.22em] ui-accent-text">
                      {setupHeaderCopy?.eyebrow}
                    </p>
                    <h2 className="mt-1 text-[1.2rem] font-black tracking-[-0.02em] ui-text sm:text-[1.5rem]">
                      {setupHeaderCopy?.title}
                    </h2>
                    <p className="mt-1 text-sm leading-6 ui-text-soft">
                      {setupHeaderCopy?.desc}
                    </p>
                  </div>
                      {setupPrimaryAction ? (
                        <Link
                          href={setupPrimaryAction.href}
                          className="ui-button-primary w-full px-4 text-sm font-semibold sm:w-auto"
                        >
                          {setupPrimaryAction.label}
                        </Link>
                      ) : null}
                    </div>
                    <div className="mt-4 rounded-[22px] border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-sm leading-6 ui-text-soft">
                      {isId
                        ? 'Layout ini dibuat ringan di mobile dan tetap punya panel pendamping di desktop, jadi langkah lanjutan lebih enak diikuti.'
                        : 'This layout stays light on mobile and keeps a helper panel on desktop, so the next steps are easier to follow.'}
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(247,250,247,0.92))] p-4 shadow-[0_18px_34px_-30px_rgba(15,23,42,0.18)] dark:border-[color:var(--app-border-strong)] dark:bg-[linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.92))]">
                    <p className="text-[10px] font-black uppercase tracking-[0.24em] ui-accent-text">
                      {isId ? 'Ringkasan' : 'Summary'}
                    </p>
                    <div className="mt-3 rounded-[22px] border border-[color:var(--app-border)] bg-white p-4 dark:border-[color:var(--app-border-strong)] dark:bg-slate-950">
                      <p className="text-sm font-black ui-text">
                        {selectedStore?.name || (isId ? 'Usaha baru' : 'New business')}
                      </p>
                      <p className="mt-1 text-sm leading-6 ui-text-soft">
                        {selectedStore
                          ? [selectedStore.city, selectedStore.address]
                              .filter(Boolean)
                              .join(' - ')
                          : isId
                            ? 'Setelah data inti tersimpan, ringkasan dan saran langkah berikutnya akan muncul di sini.'
                            : 'After the core data is saved, the summary and next-step hints appear here.'}
                      </p>
                    </div>
                  </div>
                </div>
                ) : (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.22em] ui-accent-text">
                        {isOverviewWorkspace
                          ? isId
                            ? 'Area kerja'
                            : 'Business control'
                          : workspacePageMeta.title}
                      </p>
                      {isOverviewWorkspace ? (
                        <p className="mt-1 text-sm ui-text-soft">
                          {isId
                            ? 'Kalau bingung, mulai dari edit usaha atau tambah usaha dulu.'
                            : 'If unsure, start from edit business or add business first.'}
                        </p>
                      ) : (
                        <>
                          <h2 className="mt-1 text-lg font-black ui-text">
                            {isId
                              ? 'Kerjakan yang penting dulu'
                              : 'Do the main task first'}
                          </h2>
                          <p className="mt-1 text-sm ui-text-soft">
                            {workspacePageMeta.title}. {workspacePageMeta.desc}
                          </p>
                        </>
                      )}
                    </div>
                    <div className="flex w-full flex-wrap gap-2 xl:max-w-[44rem]">
                      {workspaceShortcutTiles.map(tile => (
                        <Link
                          key={tile.id}
                          href={tile.href}
                          className={cn(
                            'inline-flex min-h-[40px] items-center gap-2 rounded-full border px-3.5 text-[11px] font-semibold transition',
                            tile.selected
                              ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white shadow-[0_12px_26px_-20px_rgba(15,23,42,0.32)]'
                              : 'border-[color:var(--app-accent-border)] bg-white text-[color:var(--app-accent)] hover:border-[color:var(--app-accent)]/35 dark:bg-slate-950',
                          )}
                        >
                          <tile.icon className="h-4 w-4" />
                          <span>{tile.title}</span>
                        </Link>
                      ))}
                    </div>
                  </div>

                  {!isOverviewWorkspace ? (
                    <div className="mt-3 grid gap-2 sm:grid-cols-3">
                      {workspaceHeaderShortcuts.map(item => (
                        <Link
                          key={item.key}
                          href={item.href}
                          className="inline-flex min-h-[44px] items-center justify-center rounded-full bg-[color:var(--app-surface)] px-4 text-sm font-semibold text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)] transition hover:bg-[color:color-mix(in_srgb,_var(--app-accent-soft)_18%,white)]"
                        >
                          {item.label}
                        </Link>
                      ))}
                    </div>
                  ) : null}
                </>
              )}
            </>
          )}

          {useSimpleSetupShell && isSetupDetailView && selectedStore ? (
            <div className="mt-3 grid gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
              <div className="rounded-[22px] border border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,244,235,0.94))] p-4 shadow-[0_18px_32px_-28px_rgba(15,23,42,0.18)] sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="max-w-3xl">
                    <p className="text-[10px] font-black uppercase tracking-[0.2em] text-[color:var(--app-accent)]/72">
                      {isId ? 'Alur setup ringkas' : 'Simple setup flow'}
                    </p>
                    <h3 className="mt-1 text-[1.02rem] font-black text-[color:var(--app-text)] sm:text-[1.18rem]">
                      {isId
                        ? `Pilih satu langkah untuk ${selectedStore.name}`
                        : `Pick one step for ${selectedStore.name}`}
                    </h3>
                    <p className="mt-2 text-[12px] leading-5 text-[color:var(--app-text-soft)] sm:text-[13px]">
                      {isId
                        ? 'Satu layar cukup satu pekerjaan: info, publish, cari partner, lalu lanjut jualan. Bagian lain tetap tersembunyi sampai dipilih.'
                        : 'Keep one job per screen: info, publishing, partner search, then selling. The other sections stay hidden until selected.'}
                    </p>
                  </div>
                  <InlineBadge
                    tone={
                      activeSetupDetailStepMeta?.done ? 'success' : 'accent'
                    }
                  >
                    {activeSetupDetailStepIndex + 1}/{setupDetailSteps.length}{' '}
                    {isId ? 'langkah aktif' : 'active step'}
                  </InlineBadge>
                </div>

                <div id="umkm-setup-step-panel" className="mt-4 space-y-3">
                  <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
                    {setupDetailSteps.map(step => {
                      const StepIcon = step.icon;
                      const active = step.id === activeSetupDetailStep;

                      return step.href ? (
                        <Link
                          key={step.id}
                          href={step.href}
                          className={cn(
                            'group flex min-h-[74px] min-w-0 flex-col justify-between rounded-[18px] border px-3 py-2.5 text-left transition',
                            active
                              ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white shadow-[0_16px_32px_-24px_rgba(15,23,42,0.35)]'
                              : 'border-white/80 bg-white/88 text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.14)] hover:border-[color:var(--app-accent-border)]',
                          )}
                        >
                          <span className="flex min-w-0 items-center justify-between gap-2">
                            <span className="truncate text-[10px] font-black uppercase tracking-[0.12em]">
                              {step.stepLabel}
                            </span>
                            <StepIcon className="h-4 w-4 shrink-0" />
                          </span>
                          <span className="mt-2 truncate text-[12px] font-black">
                            {step.title}
                          </span>
                        </Link>
                      ) : (
                        <button
                          key={step.id}
                          type="button"
                          onClick={() => openSetupDetailStep(step.id)}
                          className={cn(
                            'group flex min-h-[74px] min-w-0 flex-col justify-between rounded-[18px] border px-3 py-2.5 text-left transition',
                            active
                              ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white shadow-[0_16px_32px_-24px_rgba(15,23,42,0.35)]'
                              : 'border-white/80 bg-white/88 text-[color:var(--app-text)] shadow-[0_12px_24px_-22px_rgba(15,23,42,0.14)] hover:border-[color:var(--app-accent-border)]',
                          )}
                          aria-current={active ? 'step' : undefined}
                        >
                          <span className="flex min-w-0 items-center justify-between gap-2">
                            <span className="truncate text-[10px] font-black uppercase tracking-[0.12em]">
                              {step.stepLabel}
                            </span>
                            <StepIcon className="h-4 w-4 shrink-0" />
                          </span>
                          <span className="mt-2 truncate text-[12px] font-black">
                            {step.title}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {activeSetupDetailStepMeta ? (
                    <div className="rounded-[20px] border border-white/80 bg-white/96 px-3.5 py-3.5 shadow-[0_14px_26px_-24px_rgba(15,23,42,0.18)]">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]">
                            <ActiveSetupDetailStepIcon className="h-5 w-5" />
                          </span>
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                {activeSetupDetailStepMeta.stepLabel}
                              </span>
                              <InlineBadge
                                tone={activeSetupDetailStepMeta.tone}
                              >
                                {activeSetupDetailStepMeta.badge}
                              </InlineBadge>
                            </div>
                            <p className="mt-1 text-[15px] font-black text-[color:var(--app-text)]">
                              {activeSetupDetailStepMeta.title}
                            </p>
                            <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                              {activeSetupDetailStepMeta.desc}
                            </p>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-2 sm:min-w-[220px]">
                          <button
                            type="button"
                            onClick={() =>
                              openSetupDetailStep(
                                setupDetailSteps[
                                  Math.max(0, activeSetupDetailStepIndex - 1)
                                ]?.id || 'basic',
                              )
                            }
                            disabled={activeSetupDetailStepIndex <= 0}
                            className="ui-button-secondary ui-button-compact inline-flex items-center justify-center gap-1.5 px-3 text-xs font-bold disabled:opacity-45"
                          >
                            <ChevronLeft className="h-4 w-4" />
                            {isId ? 'Sebelum' : 'Previous'}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              openSetupDetailStep(
                                setupDetailSteps[
                                  Math.min(
                                    setupDetailSteps.length - 1,
                                    activeSetupDetailStepIndex + 1,
                                  )
                                ]?.id || 'basic',
                              )
                            }
                            disabled={
                              activeSetupDetailStepIndex >=
                              setupDetailSteps.length - 1
                            }
                            className="ui-button-primary ui-button-compact inline-flex items-center justify-center gap-1.5 px-3 text-xs font-bold disabled:opacity-45"
                          >
                            {isId ? 'Lanjut' : 'Next'}
                            <ChevronRight className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="space-y-3">
                <div className="rounded-[22px] border border-slate-200/80 bg-white px-4 py-4 shadow-[0_16px_28px_-24px_rgba(15,23,42,0.16)] dark:border-slate-800/80 dark:bg-slate-950">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                        {isId ? 'Prioritas sekarang' : 'Priority now'}
                      </p>
                      <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                        {ownerAlerts.length > 0
                          ? isId
                            ? 'Bereskan satu prioritas utama dulu. Yang lain bisa nyusul.'
                            : 'Fix the single top priority first. The rest can follow.'
                          : isId
                            ? 'Fondasi utamanya sudah rapi. Tinggal lanjut jualan atau operasional.'
                            : 'The main foundation is already in shape. Continue into selling or operations.'}
                      </p>
                    </div>
                    <InlineBadge
                      tone={ownerAlerts.length > 0 ? 'warning' : 'success'}
                    >
                      {ownerAlerts.length > 0
                        ? isId
                          ? 'Perlu follow-up'
                          : 'Needs follow-up'
                        : isId
                          ? 'Sudah rapi'
                          : 'In good shape'}
                    </InlineBadge>
                  </div>

                  <div className="mt-3 rounded-[18px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3.5 py-3">
                    <p className="text-[13px] font-black text-[color:var(--app-accent)]">
                      {ownerAlerts[0]?.title ||
                        (isId
                          ? 'Setup inti sudah aman'
                          : 'The core setup is already safe')}
                    </p>
                    <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-accent)]/78">
                      {ownerAlerts[0]?.desc ||
                        (isId
                          ? 'Lanjutkan ke katalog, pesanan, atau tampilan pembeli sesuai kebutuhan sekarang.'
                          : 'Continue to the catalog, orders, or buyer view based on what matters most right now.')}
                    </p>
                  </div>

                  {simpleSetupPrimaryAction ? (
                    <div className="mt-3">
                      {renderGuidedFlowAction(
                        simpleSetupPrimaryAction,
                        'ui-button-primary inline-flex w-full items-center justify-between px-4 text-sm font-semibold',
                      )}
                    </div>
                  ) : null}
                </div>

                <div className="rounded-[22px] border border-slate-200/80 bg-slate-50/92 px-4 py-4 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.16)] dark:border-slate-800/80 dark:bg-slate-900/72">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                    {isId ? 'Jalur cepat' : 'Quick links'}
                  </p>
                  <div className="mt-3 space-y-2">
                    <Link
                      href={buildSetupHref('list', selectedStore.id)}
                      className="ui-button-secondary inline-flex w-full items-center justify-between px-4 text-sm font-semibold"
                    >
                      <span>
                        {isId ? 'Lihat daftar usaha' : 'Open business list'}
                      </span>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                    <Link
                      href={buildUmkmStorefrontPath(selectedStore.slug)}
                      className="ui-button-secondary inline-flex w-full items-center justify-between px-4 text-sm font-semibold"
                    >
                      <span>{storefrontActionLabel}</span>
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </div>

                  <div className="mt-3 rounded-[18px] border border-dashed border-[color:var(--app-accent-border)] bg-white/92 px-3 py-3 text-[11px] leading-5 text-[color:var(--app-text-soft)] dark:bg-slate-950/82">
                    {isId
                      ? 'Kalau masih terasa ramai, abaikan dulu modul lain. Cukup tuntaskan tiga fokus di atas.'
                      : 'If the page still feels busy, ignore the other modules for now. Finish the three focus areas above first.'}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {!isOverviewWorkspace &&
            currentWorkspace !== 'setup' &&
            !useSimpleWorkspaceShell ? (
            <div className="mt-3 rounded-[20px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface)] px-3.5 py-3.5">
              {selectedStore && !isSetupCreateView ? (
                <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] ui-accent-text">
                      {isId ? 'Usaha yang lagi dipakai' : 'Active business'}
                    </p>
                    <h2 className="mt-2 text-lg font-black ui-text">
                      {selectedStore.name}
                    </h2>
                    <p className="mt-1 text-sm leading-6 ui-text-soft">
                      {[selectedStore.city, selectedStore.address]
                        .filter(Boolean)
                        .join(' - ')}
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedBusinessCategory ? (
                        <InlineBadge tone="default">
                          {getUmkmBusinessCategoryLabel(
                            selectedBusinessCategory,
                            isId,
                          )}
                        </InlineBadge>
                      ) : null}
                      {selectedStorePresence ? (
                        <InlineBadge tone="default">
                          {getUmkmLocationModeLabel(
                            selectedStorePresence.locationMode,
                            isId,
                          )}
                        </InlineBadge>
                      ) : null}
                      {selectedStore.access_role ? (
                        <InlineBadge
                          tone={
                            selectedStore.access_role === 'owner'
                              ? 'accent'
                              : 'default'
                          }
                        >
                          {teamRoleLabel(selectedStore.access_role, isId)}
                        </InlineBadge>
                      ) : null}
                      {selectedStore.online_order_enabled ? (
                        <InlineBadge tone="accent">
                          {isId ? 'Online aktif' : 'Online live'}
                        </InlineBadge>
                      ) : null}
                      {selectedStore.offline_order_enabled ? (
                        <InlineBadge tone="success">
                          {isId ? 'Offline aktif' : 'Offline live'}
                        </InlineBadge>
                      ) : null}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={buildWorkspaceHref('overview')}
                      className="ui-button-secondary px-4 text-sm font-semibold"
                    >
                      {isId ? 'Utama' : 'Overview'}
                    </Link>
                    <Link
                      href={buildSetupHref('detail', selectedStore.id)}
                      className="ui-button-secondary px-4 text-sm font-semibold"
                    >
                      {isId ? 'Edit usaha' : 'Edit business'}
                    </Link>
                    <Link
                      href={buildUmkmStorefrontPath(selectedStore.slug)}
                      className="ui-button-secondary px-4 text-sm font-semibold"
                    >
                      {storefrontActionLabel}
                    </Link>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="max-w-3xl text-sm leading-6 ui-text-soft">
                    {isSetupCreateView
                      ? isId
                        ? 'Halaman ini cuma untuk data inti. Simpan dulu, rapikan nanti.'
                        : 'This page is only for the core details. Save first, refine later.'
                      : isId
                        ? 'Pilih outlet lalu buka workspace-nya. Detail setup tetap bisa dibuka dari sana.'
                        : 'Pick an outlet and open its workspace. The setup detail stays available from there.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={buildWorkspaceHref('overview')}
                      className="ui-button-secondary px-4 text-sm font-semibold"
                    >
                      {isId ? 'Utama' : 'Overview'}
                    </Link>
                    <Link
                      href={
                        isSetupCreateView
                          ? buildSetupHref('list')
                          : buildSetupHref('create')
                      }
                      className="ui-button-primary px-4 text-sm font-semibold"
                    >
                      {isSetupCreateView
                        ? isId
                          ? 'Buka daftar'
                          : 'Open list'
                        : isId
                          ? 'Bikin usaha'
                          : 'Add business'}
                    </Link>
                  </div>
                </div>
              )}
            </div>
          ) : null}

          {isOverviewWorkspace ? null : authLoading ? (
            <div className="ui-panel-muted flex items-center gap-2 px-3.5 py-3 text-sm ui-text-soft">
              <Loader2 className="h-4 w-4 animate-spin" />
              {isId ? 'Memeriksa sesi login...' : 'Checking your session...'}
            </div>
          ) : !isAuthenticated ? (
            <div className="ui-panel-muted border border-dashed px-4 py-5 text-sm ui-text-soft">
              <p>
                {isId
                  ? 'Login dulu untuk mendaftarkan usaha dan mengelola order.'
                  : 'Log in first to register a business and manage orders.'}
              </p>
              <Link
                href="/login"
                className="ui-button-primary mt-4 px-4 text-sm font-semibold"
              >
                {isId ? 'Masuk untuk mulai' : 'Log in to start'}
              </Link>
            </div>
          ) : (
            <div className="space-y-4">
              {currentWorkspace === 'setup' ? (
                <div className="space-y-4">
                  {isSetupCreateView ? (
                    <>
                      {/* <SectionCard
                        id="umkm-start-companion"
                        title={isId ? 'Panduan mulai usaha' : 'Business launch guide'}
                        desc={
                          isId
                            ? 'Bantu owner mulai usaha dengan langkah yang lebih jelas, ringan, dan tidak bikin bingung.'
                            : 'A simpler guide to help the owner start the business with more clarity and less friction.'
                        }
                        action={
                          isAssistantSetupRoute ? (
                            <InlineBadge tone="accent">
                              {isId ? 'Mode pendamping' : 'Guided mode'}
                            </InlineBadge>
                          ) : (
                            <Link
                              href={buildAssistantHref()}
                              className="ui-button-secondary inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-bold"
                            >
                              {isId ? 'Buka panduan' : 'Open guide'}
                            </Link>
                          )
                        }
                      >
                        <div className="grid grid-cols-1 gap-4 md:gap-5 xl:grid-cols-[0.96fr_1.04fr]">
                          <div className="space-y-4">
                            <div className="rounded-3xl border border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,245,237,0.96))] p-4 sm:p-5 text-[color:var(--app-accent)] shadow-sm">
                              <div className="max-w-2xl">
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/72">
                                  {isId ? 'Biar lebih siap mulai' : 'So the first step feels safer'}
                                </p>
                                <h3 className="mt-2 text-lg font-black leading-tight text-[color:var(--app-accent)] sm:text-[1.15rem]">
                                  {isId
                                    ? 'Mulai dari yang paling penting dulu'
                                    : 'Start from the most important things first'}
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-[color:var(--app-accent)]/78">
                                  {isId
                                    ? 'Owner tidak harus beresin semuanya hari ini. Cukup mulai dari fondasi yang paling jelas, lalu lanjut ke langkah berikutnya.'
                                    : 'The owner does not need to finish everything today. Start with the clearest foundation first, then continue to the next step.'}
                                </p>
                              </div>

                              <div className="mt-4 space-y-3">
                                {startCompanionNotes.map(note => (
                                  <div
                                    key={note.title}
                                    className="rounded-2xl border border-[color:var(--app-accent-border)] bg-white px-4 py-3"
                                  >
                                    <p className="text-sm font-black text-[color:var(--app-accent)]">
                                      {note.title}
                                    </p>
                                    <p className="mt-1 text-sm leading-6 text-[color:var(--app-accent)]/76">
                                      {note.desc}
                                    </p>
                                  </div>
                                ))}
                              </div>
                            </div>

                            <div className="rounded-3xl border border-[color:var(--app-accent-border)] bg-white p-4 sm:p-5 text-[color:var(--app-accent)]">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/72">
                                    {isId ? 'Contoh usaha yang bisa ditiru' : 'Quick playbooks'}
                                  </p>
                                  <p className="mt-2 text-sm leading-6 text-[color:var(--app-accent)]/76">
                                    {isId
                                      ? 'Mulai dari playbook yang paling dekat.'
                                      : 'If the business direction is still fuzzy, start with the closest playbook first.'}
                                  </p>
                                </div>

                                <InlineBadge tone="default">
                                  {guideBusinessLabel}
                                </InlineBadge>
                              </div>

                              {prioritizedPlaybooks.length > 0 ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                  {prioritizedPlaybooks.map(playbook => (
                                    <Link
                                      key={playbook.id}
                                      href={playbook.href}
                                      className="ui-button-secondary inline-flex min-h-[44px] items-center rounded-full px-4 text-sm font-bold"
                                    >
                                      {isId
                                        ? playbook.titleId
                                        : playbook.titleEn}
                                    </Link>
                                  ))}
                                </div>
                              ) : null}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                              <div className="min-w-0">
                                <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/72">
                                  {isId ? 'Mulai dari kebutuhan nyata' : 'Start from the clearest need'}
                                </p>
                                <h3 className="mt-2 text-lg font-black leading-tight text-[color:var(--app-accent)] sm:text-[1.15rem]">
                                  {isId
                                    ? 'Cari partner, lokasi, atau bantuan yang paling dibutuhkan'
                                    : 'Find the partners, location, or support you need first'}
                                </h3>
                                <p className="mt-2 text-sm leading-6 text-[color:var(--app-accent)]/76">
                                  {isId
                                    ? 'Kalau masih bingung harus mulai dari mana, pakai kartu ini buat cari supplier, lokasi, jasa operasional, legalitas, atau talent pendukung.'
                                    : 'If the next move is still unclear, use these cards to find suppliers, locations, operational support, legal help, or supporting talent.'}
                                </p>
                              </div>

                              <InlineBadge tone="accent">
                                {guideCity || (isId ? 'Area belum diisi' : 'City not set yet')}
                              </InlineBadge>
                            </div>

                            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
                              {launchRecommendationCards.map(card => {
                                const Icon = card.icon;

                                return (
                                  <article
                                    key={card.id}
                                    className="rounded-3xl border border-[color:var(--app-accent-border)] bg-white p-4 shadow-sm"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                                        <Icon className="h-4 w-4" />
                                      </span>

                                      <InlineBadge tone="accent">
                                        {card.badge}
                                      </InlineBadge>
                                    </div>

                                    <p className="mt-3 text-sm font-black text-[color:var(--app-accent)]">
                                      {card.title}
                                    </p>

                                    <p className="mt-1 text-sm leading-6 text-[color:var(--app-accent)]/76">
                                      {card.desc}
                                    </p>

                                    <div className="mt-3 rounded-2xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-3">
                                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/72">
                                        {isId ? 'Contoh pencarian' : 'Search query idea'}
                                      </p>
                                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/82 break-words">
                                        {card.query}
                                      </p>
                                    </div>

                                    <div className="mt-4 flex flex-col gap-2">
                                      <Link
                                        href={card.searchHref}
                                        className="ui-button-primary inline-flex min-h-[44px] items-center justify-center px-4 text-sm font-bold"
                                      >
                                        {card.searchLabel}
                                      </Link>

                                      <Link
                                        href={card.briefHref}
                                        className="ui-button-secondary inline-flex min-h-[44px] items-center justify-center px-4 text-sm font-bold"
                                      >
                                        {card.briefLabel}
                                      </Link>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>

                            <div className="rounded-3xl border border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,245,237,0.96))] p-4 sm:p-5 text-[color:var(--app-accent)] shadow-sm">
                              <p className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/72">
                                {isId ? 'Biar owner lebih tenang' : 'So the owner feels safer'}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-[color:var(--app-accent)]/78">
                                {isId
                                  ? 'Tidak perlu ambil semua keputusan sekaligus. Pilih satu kebutuhan yang paling mendesak dulu, selesaikan, lalu lanjut ke kebutuhan berikutnya.'
                                  : 'There is no need to solve everything at once. Pick the most urgent need first, solve it, then move to the next one.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </SectionCard> */}

                      <SectionCard
                        id="umkm-register"
                        title={
                          useSimpleSetupCreateLayout
                            ? isId
                              ? 'Buat profil usaha'
                              : 'Create business'
                            : isId
                              ? 'Form usaha'
                              : 'Business form'
                        }
                        desc={
                          useSimpleSetupCreateLayout
                            ? isId
                              ? 'Ikuti 5 langkah pendek. Yang penting terisi dulu, sisanya bisa nanti.'
                              : 'Choose the type, fill the main details, set the location, then save.'
                            : isGuidedStoreSetup
                              ? isId
                                ? 'Isi yang inti dulu.'
                                : 'Essentials first.'
                              : isId
                                ? 'Detail lengkap kebuka.'
                                : 'Extra detail is open.'
                        }
                        action={
                          useSimpleSetupCreateLayout ? (
                            <InlineBadge
                              tone={
                                storeCreateValidation[storeCreateStep]
                                  ? 'success'
                                  : 'warning'
                              }
                            >
                              {storeCreateStepIndex + 1}/
                              {STORE_CREATE_STEP_ORDER.length}
                            </InlineBadge>
                          ) : loadingStores ? (
                            <Loader2 className="h-4 w-4 animate-spin ui-accent-text" />
                          ) : null
                        }
                      >
                        <form
                          onSubmit={event => {
                            if (storeCreateStep !== 'operations') {
                              event.preventDefault();
                              moveStoreCreateStep('next');
                              return;
                            }
                            void submitStore(event);
                          }}
                          className="space-y-3"
                        >
                          <div className={manageFormHeroClass}>
                            <div className="pointer-events-none absolute -right-14 -top-14 h-32 w-32 rounded-full bg-emerald-200/50 blur-3xl dark:bg-emerald-400/10" />
                            <div className="pointer-events-none absolute -bottom-16 -left-12 h-28 w-28 rounded-full bg-sky-200/42 blur-3xl dark:bg-sky-400/10" />
                            <div className="flex flex-col gap-2.5 lg:flex-row lg:items-start lg:justify-between">
                              <div className="relative max-w-3xl">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[color:var(--app-accent)]/68">
                                  {storeRegistrationCopy.sectionTitle}
                                </p>
                                <h4 className="mt-1 text-[1.05rem] font-black leading-tight text-[color:var(--app-text)] sm:text-[1.25rem]">
                                  {isId
                                    ? 'Buat profil usaha dalam 5 langkah'
                                    : 'Create a new business profile'}
                                </h4>
                                <p className="mt-1 max-w-2xl text-[12px] leading-5 text-[color:var(--app-text-soft)] sm:text-[13px]">
                                  {useSimpleSetupCreateLayout
                                    ? isId
                                      ? 'Isi yang wajib dulu: jenis usaha, nama, kota, alamat atau patokan, dan titik lokasi. Katalog, QR, tim, dan jam operasional bisa dirapikan setelah usaha tersimpan.'
                                      : 'Fill the business type, name, city, address, and location pin. Catalog, QR, team, and operations can be refined after saving.'
                                    : isGuidedStoreSetup
                                      ? isId
                                        ? 'Pilih tipe, isi info, pasang titik, simpan.'
                                        : 'Pick the type, fill the info, set the pin, save.'
                                      : isId
                                        ? 'Urutannya sama, detailnya dibuka.'
                                        : 'Same order, more detail open.'}
                                </p>
                              </div>

                              <div
                                className={cn(
                                  manageInfoCardClass,
                                  'relative',
                                  useSimpleSetupCreateLayout
                                    ? 'w-full max-w-[240px]'
                                    : 'w-full max-w-[220px]',
                                )}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/62">
                                      {isId ? 'Sekarang' : 'Now'}
                                    </p>
                                    <p className="mt-1 text-[13px] font-black text-[color:var(--app-text)]">
                                      {currentStoreCreateStep.title}
                                    </p>
                                  </div>
                                  <InlineBadge
                                    tone={
                                      storeCreateValidation[storeCreateStep]
                                        ? 'success'
                                        : 'warning'
                                    }
                                  >
                                    {storeCreateStepIndex + 1}/
                                    {STORE_CREATE_STEP_ORDER.length}
                                  </InlineBadge>
                                </div>
                                {!useSimpleSetupCreateLayout ? (
                                  <div className="mt-2.5 h-2 rounded-full bg-[color:var(--app-accent-soft)]">
                                    <div
                                      className="h-full rounded-full bg-[color:var(--app-accent)] transition-[width] duration-300"
                                      style={{
                                        width: `${storeCreateProgress}%`,
                                      }}
                                    />
                                  </div>
                                ) : null}
                                <p className="mt-1 text-[10px] leading-4 text-[color:var(--app-text-soft)] sm:text-[11px]">
                                  {currentStoreCreateStep.summary}
                                </p>
                              </div>
                            </div>

                            {useSimpleSetupCreateLayout ? (
                              <div className="relative mt-3 grid grid-cols-5 gap-1 sm:gap-2">
                                {storeCreateSteps.map((step, index) => {
                                  const active = step.id === storeCreateStep;
                                  const done =
                                    index < storeCreateStepIndex ||
                                    (index === storeCreateStepIndex &&
                                      step.id !== 'operations' &&
                                      storeCreateValidation[step.id]);
                                  const unlocked =
                                    index <=
                                    highestUnlockedStoreCreateStepIndex;
                                  const StepIcon = step.icon;

                                  return (
                                    <button
                                      key={step.id}
                                      type="button"
                                      onClick={() =>
                                        jumpToStoreCreateStep(step.id)
                                      }
                                      disabled={!unlocked}
                                      className={cn(
                                        'ui-pressable flex min-h-[62px] min-w-0 flex-col items-center justify-center gap-1.5 rounded-[15px] border px-1.5 py-2 text-center transition sm:min-h-[70px] sm:px-2.5',
                                        active
                                          ? 'border-[color:var(--app-accent)] bg-white shadow-[0_14px_26px_-22px_rgba(15,23,42,0.22)]'
                                          : done
                                            ? 'border-emerald-100 bg-white/86'
                                            : unlocked
                                              ? 'border-emerald-100/80 bg-white/72 hover:bg-white'
                                              : 'cursor-not-allowed border-slate-200/80 bg-white/52 opacity-65',
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[13px]',
                                          active || done
                                            ? 'bg-[color:var(--app-accent)] text-white'
                                            : 'bg-emerald-50 text-[color:var(--app-accent)] ring-1 ring-emerald-100',
                                        )}
                                      >
                                        {done ? (
                                          <CheckCircle2 className="h-4 w-4" />
                                        ) : (
                                          <StepIcon className="h-4 w-4" />
                                        )}
                                      </span>
                                      <span className="min-w-0">
                                        <span className="block truncate text-[10px] font-black leading-3 text-[color:var(--app-text)] sm:text-[11px] sm:leading-4">
                                          {step.title}
                                        </span>
                                        <span className="mt-0.5 hidden text-[10px] leading-4 text-[color:var(--app-text-soft)] lg:line-clamp-2">
                                          {step.summary}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : null}

                            <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2">
                              <p className="text-[11px] leading-4 text-[color:var(--app-text-soft)]">
                                {useSimpleSetupCreateLayout
                                  ? isId
                                    ? `Langkah ini: ${currentStoreCreateStep.desc}`
                                    : `Focus on ${currentStoreCreateStep.title.toLowerCase()} first.`
                                  : isGuidedStoreSetup
                                    ? isId
                                      ? 'Isi yang wajib dulu. Detail bisa belakangan.'
                                      : 'Fill the essentials first. Extra detail can come later.'
                                    : isId
                                      ? 'Mode detail aktif.'
                                      : 'Detail mode is active.'}
                              </p>

                              {!useSimpleSetupCreateLayout ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setStoreSetupMode(
                                      isGuidedStoreSetup ? 'full' : 'guided',
                                    )
                                  }
                                  className="ui-button-secondary ui-button-compact px-3 text-xs font-semibold"
                                >
                                  {isGuidedStoreSetup
                                    ? isId
                                      ? 'Pengaturan lengkap'
                                      : 'More settings'
                                    : isId
                                      ? 'Mode ringkas'
                                      : 'Easy mode'}
                                </button>
                              ) : null}
                            </div>
                          </div>

                          {submitError ? (
                            <div className="rounded-[18px] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-3.5 py-2.5 text-sm text-[color:var(--app-accent)]">
                              {submitError}
                            </div>
                          ) : null}

                          {!useSimpleSetupCreateLayout ? (
                            <div className={manageSectionBlockClass}>
                              <div className="flex flex-wrap items-center justify-between gap-2">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]/68">
                                  {isId ? 'Urutan isi' : 'Fill order'}
                                </p>
                                <InlineBadge
                                  tone={
                                    storeCreateChecklist.every(
                                      item => item.done,
                                    )
                                      ? 'success'
                                      : 'warning'
                                  }
                                >
                                  {
                                    storeCreateChecklist.filter(
                                      item => item.done,
                                    ).length
                                  }
                                  /{storeCreateChecklist.length}
                                </InlineBadge>
                              </div>

                              <div className="-mx-1 mt-2 flex gap-1.5 overflow-x-auto px-1 pb-1">
                                {storeCreateSteps.map((step, index) => {
                                  const active = step.id === storeCreateStep;
                                  const done =
                                    index < storeCreateStepIndex ||
                                    (index === storeCreateStepIndex &&
                                      step.id !== 'operations' &&
                                      storeCreateValidation[step.id]);
                                  const unlocked =
                                    index <=
                                    highestUnlockedStoreCreateStepIndex;

                                  return (
                                    <button
                                      key={step.id}
                                      type="button"
                                      onClick={() =>
                                        jumpToStoreCreateStep(step.id)
                                      }
                                      disabled={!unlocked}
                                      className={cn(
                                        'ui-pressable inline-flex min-h-[38px] shrink-0 items-center gap-2 rounded-full px-3 text-left transition',
                                        active
                                          ? 'bg-[color:color-mix(in_srgb,var(--app-accent-soft)_36%,white)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.18)] ring-1 ring-[color:var(--app-accent-border)]'
                                          : unlocked
                                            ? 'bg-slate-50/92 ring-1 ring-slate-200/80 hover:bg-white dark:bg-slate-900/72 dark:ring-slate-800/80'
                                            : 'cursor-not-allowed bg-slate-100/80 opacity-65 ring-1 ring-dashed ring-slate-200/80 dark:bg-slate-900/60 dark:ring-slate-800/80',
                                      )}
                                    >
                                      <span
                                        className={cn(
                                          'inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold',
                                          active || done
                                            ? 'bg-[color:var(--app-accent)] text-white'
                                            : 'bg-white text-[color:var(--app-accent)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80',
                                        )}
                                      >
                                        {done ? (
                                          <CheckCircle2 className="h-3.5 w-3.5" />
                                        ) : (
                                          index + 1
                                        )}
                                      </span>
                                      <span className="whitespace-nowrap text-[11px] font-black text-[color:var(--app-text)]">
                                        {step.title}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className={cn(manageInfoCardClass, 'mt-2')}>
                                <p className="text-[11px] font-black">
                                  {isId
                                    ? `Fokus ke ${currentStoreCreateStep.title.toLowerCase()} aja dulu.`
                                    : `Focus on ${currentStoreCreateStep.title.toLowerCase()} only for now.`}
                                </p>
                                <p className="mt-1 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                                  {currentStoreCreateStep.summary}
                                </p>
                              </div>
                            </div>
                          ) : null}

                          <div className="space-y-3.5">
                            {storeCreateStep === 'intro' ? (
                              <div className={manageStorePanelClass}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                      {isId
                                        ? 'Sebelum mulai'
                                        : 'Before you start'}
                                    </p>
                                    <h5 className="mt-1 text-[1rem] font-black leading-tight text-[color:var(--app-text)]">
                                      {isId
                                        ? 'Bikin dulu versi paling penting'
                                        : 'Create a business profile without the clutter'}
                                    </h5>
                                    <p className="mt-1.5 max-w-2xl text-[12px] leading-5 text-[color:var(--app-text-soft)]">
                                      {isId
                                        ? 'Tidak perlu lengkap sempurna. Mulai dari data yang membuat usaha bisa ditemukan dan dipercaya.'
                                        : 'This step only creates the foundation. After saving, add catalog, QR, team, and operations.'}
                                    </p>
                                  </div>
                                  <InlineBadge tone="success">
                                    {isId
                                      ? 'Bisa diedit nanti'
                                      : 'Editable later'}
                                  </InlineBadge>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  {storeOnboardingInfoCards.map(card => {
                                    const InfoIcon = card.icon;
                                    return (
                                      <div
                                        key={card.title}
                                        className="rounded-[18px] border border-emerald-100/90 bg-white px-3 py-3 shadow-[0_12px_24px_-24px_rgba(15,23,42,0.14)] dark:border-emerald-400/14 dark:bg-slate-950/78"
                                      >
                                        <div className="flex items-start gap-2.5">
                                          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                                            <InfoIcon className="h-4 w-4" />
                                          </span>
                                          <div>
                                            <p className="text-[13px] font-black text-[color:var(--app-text)]">
                                              {card.title}
                                            </p>
                                            <p className="mt-1 text-[11px] leading-4 text-[color:var(--app-text-soft)]">
                                              {card.desc}
                                            </p>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>

                                <div className="mt-3 rounded-[18px] border border-dashed border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-3 text-[12px] leading-5 text-[color:var(--app-accent)]">
                                  {isId
                                    ? 'Tips: kalau ragu, pilih jawaban yang paling dekat. Semua data bisa diedit lagi dari dashboard usaha.'
                                    : 'Tip: do not aim for perfect setup first. Fill what you know now, save, then refine it from the business dashboard.'}
                                </div>
                              </div>
                            ) : null}

                            {storeCreateStep === 'group' ? (
                              <>
                                <div className={manageStorePanelClass}>
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                        {storeRegistrationCopy.modelLabel}
                                      </p>
                                      <p className="mt-1.5 text-[12px] leading-5 text-[color:var(--app-accent)]/76">
                                        {isGuidedStoreSetup
                                          ? isId
                                            ? 'Pilih kategori yang paling mirip dengan aktivitas usahamu.'
                                            : 'Pick the closest fit first.'
                                          : storeRegistrationCopy.modelHint}
                                      </p>
                                    </div>
                                    <InlineBadge tone="accent">
                                      {isId
                                        ? 'Pilih yang paling dekat'
                                        : 'Pick the closest fit'}
                                    </InlineBadge>
                                  </div>

                                  {useSimpleSetupCreateLayout ? (
                                    <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                                      {registrationPathOptions.map(option => {
                                        const active =
                                          selectedStoreCategoryGroup ===
                                          option.groupId;
                                        const Icon = option.icon;

                                        return (
                                          <button
                                            key={option.groupId}
                                            type="button"
                                            onClick={() =>
                                              applyStoreCategoryGroup(
                                                option.groupId,
                                              )
                                            }
                                            className={cn(
                                              'ui-pressable flex min-h-[118px] flex-col items-start justify-between rounded-[16px] border px-3 py-2.5 text-left transition',
                                              active
                                                ? 'border-[color:var(--app-accent)] bg-[color:color-mix(in_srgb,var(--app-accent-soft)_36%,white)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.18)]'
                                                : 'border-emerald-100/90 bg-white hover:border-[color:var(--app-accent-border)]',
                                            )}
                                          >
                                            <span className="flex w-full items-start justify-between gap-2">
                                              <span
                                                className={cn(
                                                  'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-[12px] border',
                                                  active
                                                    ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                                                    : 'border-emerald-100 bg-emerald-50 text-[color:var(--app-accent)]',
                                                )}
                                              >
                                                <Icon className="h-3.5 w-3.5" />
                                              </span>
                                              {active ? (
                                                <CheckCircle2 className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                                              ) : null}
                                            </span>
                                            <span className="mt-2 min-w-0">
                                              <span className="line-clamp-2 text-[12px] font-black leading-4 text-[color:var(--app-text)]">
                                                {option.title}
                                              </span>
                                              <span className="mt-1 line-clamp-2 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                                                {option.desc}
                                              </span>
                                              <span className="mt-1 inline-flex rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-black uppercase tracking-[0.08em] text-[color:var(--app-accent)]">
                                                {option.badge}
                                              </span>
                                            </span>
                                          </button>
                                        );
                                      })}
                                    </div>
                                  ) : (
                                    <div className="mt-3 grid gap-2 md:grid-cols-2">
                                      {registrationPathOptions.map(option => (
                                        <SectionJumpTile
                                          key={option.groupId}
                                          icon={option.icon}
                                          title={option.title}
                                          desc={option.desc}
                                          badge={option.badge}
                                          tone={option.tone}
                                          selected={
                                            selectedStoreCategoryGroup ===
                                            option.groupId
                                          }
                                          actionLabel={isId ? 'Pilih' : 'Pick'}
                                          selectedLabel={
                                            isId ? 'Terpilih' : 'Selected'
                                          }
                                          compact
                                          onClick={() =>
                                            applyStoreCategoryGroup(
                                              option.groupId,
                                            )
                                          }
                                        />
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div
                                  className={cn(
                                    'grid gap-3',
                                    !isGuidedStoreSetup ||
                                      showStoreBusinessFocus ||
                                      storeForm.business_focus.trim().length > 0
                                      ? 'sm:grid-cols-2'
                                      : 'sm:grid-cols-1',
                                  )}
                                >
                                  <SelectInput
                                    label={
                                      isId
                                        ? 'Pilih jenis yang paling pas'
                                        : 'Detailed type'
                                    }
                                    className={compactStoreControlClass}
                                    value={storeForm.business_category}
                                    onChange={event =>
                                      applyStoreCategory(
                                        event.target
                                          .value as UmkmBusinessCategoryId,
                                      )
                                    }
                                  >
                                    {filteredStoreBusinessCategoryOptions.map(
                                      option => (
                                        <option
                                          key={option.id}
                                          value={option.id}
                                        >
                                          {isId
                                            ? option.labelId
                                            : option.labelEn}
                                        </option>
                                      ),
                                    )}
                                  </SelectInput>
                                  {!isGuidedStoreSetup ||
                                    showStoreBusinessFocus ||
                                    storeForm.business_focus.trim().length > 0 ? (
                                    <TextInput
                                      label={
                                        isId
                                          ? 'Jualan / layanan utama'
                                          : 'Business focus'
                                      }
                                      className={compactStoreControlClass}
                                      value={storeForm.business_focus}
                                      onChange={event =>
                                        setStoreForm(current => ({
                                          ...current,
                                          business_focus: event.target.value,
                                        }))
                                      }
                                      placeholder={getUmkmBusinessFocusPlaceholder(
                                        storeForm.business_category,
                                        isId,
                                      )}
                                    />
                                  ) : null}
                                </div>

                                {isGuidedStoreSetup &&
                                  !showStoreBusinessFocus &&
                                  storeForm.business_focus.trim().length === 0 ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setShowStoreBusinessFocus(true)
                                    }
                                    className="ui-button-secondary ui-button-compact px-3 text-xs font-semibold"
                                  >
                                    {isId ? 'Tambah fokus usaha' : 'Add focus'}
                                  </button>
                                ) : null}

                                <div className={manageStoreSoftPanelClass}>
                                  <p className="font-black text-[color:var(--app-accent)]">
                                    {getUmkmBusinessCategoryLabel(
                                      storeForm.business_category,
                                      isId,
                                    )}
                                  </p>
                                  <p className="mt-2">
                                    {getUmkmBusinessCategoryDescription(
                                      storeForm.business_category,
                                      isId,
                                    )}
                                  </p>
                                </div>
                              </>
                            ) : null}

                            {storeCreateStep === 'identity' ? (
                              <>
                                <div className={manageStorePanelClass}>
                                  <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                    {isGuidedStoreSetup
                                      ? isId
                                        ? 'Data dasar usaha'
                                        : 'Fill these 3 fields first'
                                      : isId
                                        ? 'Identitas inti usaha'
                                        : 'Core business identity'}
                                  </p>
                                  <p className="mt-1.5 text-[12px] leading-5 text-[color:var(--app-accent)]/72">
                                    {isGuidedStoreSetup
                                      ? isId
                                        ? 'Cukup isi nama, kota, dan alamat atau patokan supaya pembeli mudah mengenali usaha.'
                                        : 'Name, city, and address are enough for now. Phone and description can wait.'
                                      : isId
                                        ? 'Lengkapi identitas dasar yang dipakai owner dan tim untuk operasional harian.'
                                        : 'Complete the core identity used by the owner and team for daily operations.'}
                                  </p>
                                  <div
                                    className={cn(
                                      'mt-3 grid gap-3 sm:grid-cols-2',
                                      useSimpleSetupCreateLayout &&
                                      '[&>*:last-child]:sm:col-span-2',
                                    )}
                                  >
                                    <TextInput
                                      label={storeRegistrationCopy.nameLabel}
                                      className={compactStoreControlClass}
                                      name="business_name"
                                      value={storeForm.name}
                                      onChange={event =>
                                        setStoreForm(current => ({
                                          ...current,
                                          name: event.target.value,
                                        }))
                                      }
                                      autoComplete="organization"
                                      maxLength={STORE_LIMITS.name}
                                      placeholder={
                                        storeRegistrationCopy.namePlaceholder
                                      }
                                      required
                                    />
                                    <TextInput
                                      label={storeRegistrationCopy.cityLabel}
                                      className={compactStoreControlClass}
                                      name="business_city"
                                      value={storeForm.city}
                                      onChange={event =>
                                        setStoreForm(current => ({
                                          ...current,
                                          city: event.target.value,
                                        }))
                                      }
                                      autoComplete="address-level2"
                                      maxLength={STORE_LIMITS.city}
                                      placeholder={
                                        isId
                                          ? 'Contoh: Jakarta Selatan'
                                          : 'Jakarta'
                                      }
                                      required
                                    />
                                    <TextInput
                                      label={storeRegistrationCopy.addressLabel}
                                      className={compactStoreControlClass}
                                      name="business_address"
                                      value={storeForm.address}
                                      onChange={event =>
                                        setStoreForm(current => ({
                                          ...current,
                                          address: event.target.value,
                                        }))
                                      }
                                      autoComplete="street-address"
                                      maxLength={STORE_LIMITS.address}
                                      placeholder={
                                        isGuidedStoreSetup
                                          ? isId
                                            ? 'Contoh: Jl. Melati No. 10, dekat Alfamart'
                                            : 'Street, landmark, or area name'
                                          : storeRegistrationCopy.addressPlaceholder
                                      }
                                      required
                                    />
                                  </div>
                                  {storeSuggestedBaseAddress &&
                                    normalizeSingleLineInput(storeForm.address)
                                      .length < 3 ? (
                                    <div className="mt-4 flex flex-wrap items-center gap-3 rounded-[20px] border border-dashed border-[color:var(--app-accent-border)] bg-[color:var(--app-surface)] px-4 py-3">
                                      <p className="text-xs leading-5 text-[color:var(--app-accent)]/74">
                                        {isId
                                          ? `Belum sempat isi lengkap? Pakai dulu "${storeSuggestedBaseAddress}" supaya bisa lanjut. Nanti bisa diperbaiki.`
                                          : `Not ready with the full address yet? Start with "${storeSuggestedBaseAddress}".`}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={fillSuggestedStoreAddress}
                                        className="ui-button-secondary ui-button-compact px-3 text-xs font-semibold"
                                      >
                                        {isId
                                          ? 'Pakai dulu'
                                          : 'Use this address'}
                                      </button>
                                    </div>
                                  ) : null}
                                </div>
                              </>
                            ) : null}

                            {storeCreateStep === 'operations' ? (
                              <div className="rounded-[20px] border border-emerald-100/90 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_72%)] px-3 py-3 text-[color:var(--app-accent)] shadow-[0_16px_30px_-28px_rgba(15,23,42,0.24)] dark:border-emerald-400/14 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.2),rgba(2,6,23,0.94))] sm:px-4 sm:py-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                                      {isGuidedStoreSetup
                                        ? isId
                                          ? 'Cek sebelum disimpan'
                                          : 'Automatic starting setup'
                                        : isId
                                          ? storeRegistrationProfile.labelId
                                          : storeRegistrationProfile.labelEn}
                                    </p>
                                    <p className="mt-1.5 text-[12px] leading-5 text-[color:var(--app-accent)]/78">
                                      {isGuidedStoreSetup
                                        ? isId
                                          ? 'Kalau data utama sudah benar, simpan. Setelah itu kamu bisa tambah produk, QR, tim, dan jam buka.'
                                          : 'The common defaults are enabled first. You can change them later.'
                                        : isId
                                          ? storeRegistrationProfile.registrationHintId
                                          : storeRegistrationProfile.registrationHintEn}
                                    </p>
                                  </div>
                                  <InlineBadge tone="accent">
                                    {isGuidedStoreSetup
                                      ? isId
                                        ? 'Langkah terakhir'
                                        : 'Ready to use'
                                      : isId
                                        ? 'Bisa diubah'
                                        : 'Customizable'}
                                  </InlineBadge>
                                </div>

                                <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                                  {storeCreateReviewCards.map(card => (
                                    <div
                                      key={card.label}
                                      className="rounded-[16px] border border-emerald-100/90 bg-white px-3 py-2.5 shadow-[0_10px_20px_-22px_rgba(15,23,42,0.16)] dark:border-emerald-400/14 dark:bg-slate-950/76"
                                    >
                                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/62">
                                        {card.label}
                                      </p>
                                      <p className="mt-1 line-clamp-2 text-[12px] font-black leading-4 text-[color:var(--app-text)]">
                                        {card.value ||
                                          (isId ? 'Belum diisi' : 'Not filled')}
                                      </p>
                                    </div>
                                  ))}
                                </div>

                                {isGuidedStoreSetup ? (
                                  <>
                                    <div className="mt-3 rounded-[18px] border border-[color:var(--app-accent-border)] bg-white px-3 py-3">
                                      <p className="text-[13px] font-black text-[color:var(--app-accent)]">
                                        {isId
                                          ? 'Fitur awal yang aktif'
                                          : 'Starts enabled'}
                                      </p>
                                      <div className="mt-3 flex flex-wrap gap-2">
                                        {storePrimaryCapabilities
                                          .filter(capability =>
                                            storeForm.business_capabilities.includes(
                                              capability,
                                            ),
                                          )
                                          .map(capability => (
                                            <span
                                              key={capability}
                                              className="inline-flex items-center rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[11px] font-bold"
                                            >
                                              {getCapabilityLabel(
                                                capability,
                                                isId,
                                              )}
                                            </span>
                                          ))}
                                      </div>
                                    </div>

                                    {storeTablePlanningAvailable ? (
                                      <div className="mt-3 rounded-[18px] border border-[color:var(--app-accent-border)] bg-white px-3 py-3">
                                        <p className="text-[13px] font-black text-[color:var(--app-accent)]">
                                          {isId
                                            ? 'Usaha ini pakai meja?'
                                            : 'Use tables?'}
                                        </p>
                                        <p className="mt-1 text-[11px] leading-4 text-[color:var(--app-accent)]/72">
                                          {isId
                                            ? 'Kalau belum butuh, pilih Tanpa meja. Bisa diubah nanti.'
                                            : 'If you are unsure, start without tables.'}
                                        </p>
                                        <div className="mt-2.5 grid gap-1.5 sm:grid-cols-4">
                                          {[
                                            {
                                              id: 'none' as const,
                                              label: isId
                                                ? 'Tanpa meja'
                                                : 'No tables',
                                            },
                                            {
                                              id: 'small' as const,
                                              label: isId
                                                ? '4 meja'
                                                : '4 tables',
                                            },
                                            {
                                              id: 'medium' as const,
                                              label: isId
                                                ? '8 meja'
                                                : '8 tables',
                                            },
                                            {
                                              id: 'large' as const,
                                              label: isId
                                                ? '12 meja'
                                                : '12 tables',
                                            },
                                          ].map(preset => (
                                            <button
                                              key={preset.id}
                                              type="button"
                                              onClick={() =>
                                                applyQuickStoreTablePreset(
                                                  preset.id,
                                                )
                                              }
                                              className={cn(
                                                'rounded-[14px] border px-2.5 py-2.5 text-[12px] font-bold transition',
                                                activeStoreTablePreset ===
                                                  preset.id
                                                  ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] shadow-sm'
                                                  : 'border-[color:var(--app-accent-border)] bg-white hover:border-[color:var(--app-accent)]/35',
                                              )}
                                            >
                                              {preset.label}
                                            </button>
                                          ))}
                                        </div>
                                      </div>
                                    ) : (
                                      <div className="mt-3 rounded-[18px] border border-dashed border-[color:var(--app-accent-border)] bg-white px-3 py-3 text-[12px] leading-5 text-[color:var(--app-accent)]/78">
                                        {storeRegistrationCopy.noTablesMessage}
                                      </div>
                                    )}

                                    {!useSimpleSetupCreateLayout ? (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setShowDetailedStoreOperations(
                                            current => !current,
                                          )
                                        }
                                        className="ui-button-secondary ui-button-compact mt-4 px-3 text-xs font-bold"
                                      >
                                        {showDetailedStoreOperations
                                          ? isId
                                            ? 'Sembunyikan detail'
                                            : 'Hide details'
                                          : isId
                                            ? 'Ubah detail'
                                            : 'Adjust details'}
                                      </button>
                                    ) : null}
                                  </>
                                ) : null}

                                {!isGuidedStoreSetup ||
                                  showDetailedStoreOperations ? (
                                  <>
                                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                                      {storePrimaryCapabilities
                                        .filter(capability =>
                                          storeForm.business_capabilities.includes(
                                            capability,
                                          ),
                                        )
                                        .map(capability => (
                                          <div
                                            key={capability}
                                            className="rounded-2xl border border-[color:var(--app-accent-border)] bg-white px-3 py-3"
                                          >
                                            <p className="text-sm font-bold text-[color:var(--app-accent)]">
                                              {getCapabilityLabel(
                                                capability,
                                                isId,
                                              )}
                                            </p>
                                            <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                              {getCapabilityDescription(
                                                capability,
                                                isId,
                                              )}
                                            </p>
                                          </div>
                                        ))}
                                    </div>

                                    <div className="mt-4">
                                      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/76">
                                        {isId
                                          ? 'Fitur yang dipakai usaha ini'
                                          : 'Relevant capabilities'}
                                      </p>
                                      <div className="mt-2.5 flex flex-wrap gap-1.5">
                                        {storePrimaryCapabilities.map(
                                          capability => {
                                            const active =
                                              storeForm.business_capabilities.includes(
                                                capability,
                                              );
                                            return (
                                              <button
                                                key={capability}
                                                type="button"
                                                onClick={() =>
                                                  toggleStoreCapability(
                                                    capability,
                                                  )
                                                }
                                                className={cn(
                                                  'inline-flex min-h-[42px] items-center gap-2 rounded-full border px-3.5 text-xs font-bold transition',
                                                  active
                                                    ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white shadow-sm'
                                                    : 'border-[color:var(--app-accent-border)] bg-white text-[color:var(--app-accent)] hover:border-[color:var(--app-accent)]/35',
                                                )}
                                              >
                                                {active ? (
                                                  <CheckCircle2 className="h-3.5 w-3.5" />
                                                ) : (
                                                  <Circle className="h-3.5 w-3.5" />
                                                )}
                                                {getCapabilityLabel(
                                                  capability,
                                                  isId,
                                                )}
                                              </button>
                                            );
                                          },
                                        )}
                                      </div>
                                    </div>

                                    {storeAdvancedCapabilities.length > 0 ? (
                                      <div className="mt-4">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setShowAdvancedStoreCapabilities(
                                              current => !current,
                                            )
                                          }
                                          className="ui-button-secondary ui-button-compact px-3 text-xs font-bold"
                                        >
                                          {showAdvancedStoreCapabilities
                                            ? isId
                                              ? 'Sembunyikan opsi lanjutan'
                                              : 'Hide advanced options'
                                            : isId
                                              ? 'Lihat fitur tambahan'
                                              : 'Show advanced options'}
                                        </button>

                                        {showAdvancedStoreCapabilities ? (
                                          <div className="mt-3 rounded-[22px] border border-dashed border-[color:var(--app-accent-border)] bg-white px-4 py-4">
                                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/72">
                                              {isId
                                                ? 'Opsi tambahan untuk usaha hybrid'
                                                : 'Extra options for hybrid businesses'}
                                            </p>
                                            <div className="mt-3 flex flex-wrap gap-2">
                                              {storeAdvancedCapabilities.map(
                                                capability => {
                                                  const active =
                                                    storeForm.business_capabilities.includes(
                                                      capability,
                                                    );
                                                  return (
                                                    <button
                                                      key={capability}
                                                      type="button"
                                                      onClick={() =>
                                                        toggleStoreCapability(
                                                          capability,
                                                        )
                                                      }
                                                      className={cn(
                                                        'inline-flex min-h-[42px] items-center gap-2 rounded-full border px-3.5 text-xs font-bold transition',
                                                        active
                                                          ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white shadow-sm'
                                                          : 'border-[color:var(--app-accent-border)] bg-white text-[color:var(--app-accent)] hover:border-[color:var(--app-accent)]/35',
                                                      )}
                                                    >
                                                      {active ? (
                                                        <CheckCircle2 className="h-3.5 w-3.5" />
                                                      ) : (
                                                        <Circle className="h-3.5 w-3.5" />
                                                      )}
                                                      {getCapabilityLabel(
                                                        capability,
                                                        isId,
                                                      )}
                                                    </button>
                                                  );
                                                },
                                              )}
                                            </div>
                                          </div>
                                        ) : null}
                                      </div>
                                    ) : null}
                                  </>
                                ) : null}
                              </div>
                            ) : null}

                            {storeCreateStep === 'identity' &&
                              (!isGuidedStoreSetup ||
                                showOptionalStoreIdentity ||
                                storeForm.phone.trim().length > 0 ||
                                storeForm.description.trim().length > 0) ? (
                              <>
                                <div className={manageStorePanelClass}>
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                        {isId
                                          ? 'WhatsApp & cerita singkat'
                                          : 'Additional info'}
                                      </p>
                                      <p className="mt-1.5 text-[12px] leading-5 text-[color:var(--app-accent)]/72">
                                        {isId
                                          ? 'Opsional, tapi membantu pembeli cepat percaya.'
                                          : 'Optional. Fill it only if you already have it.'}
                                      </p>
                                    </div>
                                    {isGuidedStoreSetup ? (
                                      <InlineBadge tone="accent">
                                        {isId ? 'Opsional' : 'Optional'}
                                      </InlineBadge>
                                    ) : null}
                                  </div>
                                  <div className="mt-3 grid gap-3">
                                    <TextInput
                                      label={storeRegistrationCopy.phoneLabel}
                                      className={compactStoreControlClass}
                                      type="tel"
                                      name="business_phone"
                                      value={storeForm.phone}
                                      onChange={event =>
                                        setStoreForm(current => ({
                                          ...current,
                                          phone: event.target.value,
                                        }))
                                      }
                                      autoComplete="tel"
                                      maxLength={STORE_LIMITS.phone}
                                      placeholder={
                                        isId
                                          ? 'Contoh: 081234567890'
                                          : '08xxxxxxxxxx'
                                      }
                                    />

                                    <TextArea
                                      label={
                                        storeRegistrationCopy.descriptionLabel
                                      }
                                      className={compactStoreTextAreaClass}
                                      name="business_description"
                                      value={storeForm.description}
                                      onChange={event =>
                                        setStoreForm(current => ({
                                          ...current,
                                          description: event.target.value,
                                        }))
                                      }
                                      maxLength={STORE_LIMITS.description}
                                      placeholder={
                                        storeRegistrationCopy.descriptionPlaceholder
                                      }
                                    />
                                  </div>
                                </div>
                              </>
                            ) : null}

                            {storeCreateStep === 'identity' &&
                              isGuidedStoreSetup &&
                              !showOptionalStoreIdentity &&
                              storeForm.phone.trim().length === 0 &&
                              storeForm.description.trim().length === 0 ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setShowOptionalStoreIdentity(true)
                                }
                                className="ui-button-secondary ui-button-compact px-3 text-xs font-semibold"
                              >
                                {isId
                                  ? 'Tambah WhatsApp & deskripsi'
                                  : 'Add phone / description'}
                              </button>
                            ) : null}

                            {storeCreateStep === 'location' &&
                              storeRegistrationCopy.locationHint ? (
                              <div className={manageStoreSoftPanelClass}>
                                {storeRegistrationCopy.locationHint}
                              </div>
                            ) : null}

                            {storeCreateStep === 'location' ? (
                              <div className={manageStorePanelClass}>
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                      {isId
                                        ? 'Cara jualan / layanan'
                                        : 'Location pattern'}
                                    </p>
                                    <p className="mt-1.5 text-[12px] leading-5 text-[color:var(--app-accent)]/76">
                                      {isGuidedStoreSetup
                                        ? isId
                                          ? 'Pilih yang paling mirip: punya tempat tetap atau sering berpindah.'
                                          : 'Choose whether the business has a fixed point or moves around.'
                                        : isId
                                          ? 'Seller keliling, booth event, workshop, dan toko tetap bisa punya titik awal yang berbeda.'
                                          : 'Mobile sellers, event booths, workshops, and fixed stores can start from different point types.'}
                                    </p>
                                  </div>
                                  <InlineBadge tone="accent">
                                    {getUmkmLocationModeLabel(
                                      storeForm.location_mode,
                                      isId,
                                    )}
                                  </InlineBadge>
                                </div>

                                <div className="mt-3 grid gap-2 min-[420px]:grid-cols-2">
                                  {(['fixed', 'mobile'] as const).map(mode => {
                                    const active =
                                      storeForm.location_mode === mode;
                                    return (
                                      <button
                                        key={mode}
                                        type="button"
                                        onClick={() =>
                                          setStoreForm(current => ({
                                            ...current,
                                            location_mode: mode,
                                          }))
                                        }
                                        className={cn(
                                          'rounded-[16px] border px-3 py-2.5 text-left transition',
                                          active
                                            ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] shadow-sm ring-1 ring-[color:var(--app-accent)]/14'
                                            : 'border-[color:var(--app-accent-border)] bg-white hover:border-[color:var(--app-accent)]/35 dark:bg-slate-950',
                                        )}
                                      >
                                        <div className="flex items-start justify-between gap-2">
                                          <div className="min-w-0">
                                            <span
                                              className={cn(
                                                'inline-flex h-8 w-8 items-center justify-center rounded-[14px] border',
                                                active
                                                  ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent)] text-white'
                                                  : 'border-[color:var(--app-accent-border)] bg-white text-[color:var(--app-accent)] dark:bg-slate-950',
                                              )}
                                            >
                                              {mode === 'fixed' ? (
                                                <Store className="h-4 w-4" />
                                              ) : (
                                                <ArrowRightLeft className="h-4 w-4" />
                                              )}
                                            </span>
                                            <p className="mt-2 text-[13px] font-black text-[color:var(--app-accent)]">
                                              {getUmkmLocationModeLabel(
                                                mode,
                                                isId,
                                              )}
                                            </p>
                                            <p className="mt-0.5 line-clamp-2 text-[11px] leading-4 text-[color:var(--app-accent)]/72">
                                              {getUmkmLocationModeHint(
                                                mode,
                                                isId,
                                              )}
                                            </p>
                                          </div>
                                          {active ? (
                                            <CheckCircle2 className="h-5 w-5 shrink-0 text-[color:var(--app-accent)]" />
                                          ) : null}
                                        </div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>
                            ) : null}

                            {storeCreateStep === 'location' ? (
                              <div
                                className={cn(
                                  manageStorePanelClass,
                                  'text-[color:var(--app-accent)]',
                                )}
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                                      {storeForm.location_mode === 'mobile'
                                        ? isId
                                          ? 'Tandai base / area awal'
                                          : 'Initial live business point'
                                        : isId
                                          ? 'Tandai lokasi usaha'
                                          : 'Business location pin'}
                                    </p>
                                    <p className="mt-0.5 text-[11px] leading-4 text-[color:var(--app-accent)]/76">
                                      {isGuidedStoreSetup
                                        ? isId
                                          ? 'Tekan Lokasi saya untuk cepat, lalu geser pin kalau belum tepat.'
                                          : 'If you are unsure, use your current location first.'
                                        : isId
                                          ? 'Tap peta atau geser marker sampai titik usahanya pas.'
                                          : 'Tap the map or drag the marker until the business point is correct.'}
                                    </p>
                                  </div>
                                  <div className="flex flex-wrap gap-2">
                                    <InlineBadge tone="accent">
                                      {storeLocationPoint
                                        ? `${storeLocationPoint.lat.toFixed(6)}, ${storeLocationPoint.lng.toFixed(6)}`
                                        : isId
                                          ? 'Belum ada titik'
                                          : 'No point yet'}
                                    </InlineBadge>
                                    <button
                                      type="button"
                                      onClick={() => fillCurrentCoords('store')}
                                      className="ui-button-secondary ui-button-compact inline-flex items-center gap-2 px-3 text-xs font-semibold"
                                    >
                                      <MapPinned className="h-3.5 w-3.5" />
                                      {isId
                                        ? 'Pakai lokasi saya'
                                        : 'My location'}
                                    </button>
                                  </div>
                                </div>

                                <div className="mt-4">
                                  <UmkmLocationPicker
                                    value={storeLocationPoint}
                                    onChange={point =>
                                      setStoreCoords(
                                        point.lat.toFixed(6),
                                        point.lng.toFixed(6),
                                      )
                                    }
                                    isId={isId}
                                    markerLabel={
                                      storeForm.location_mode === 'mobile'
                                        ? isId
                                          ? 'Titik live awal usaha'
                                          : 'Initial live business point'
                                        : isId
                                          ? 'Lokasi usaha'
                                          : 'Business location'
                                    }
                                  />
                                </div>

                                <div className="mt-2.5 flex flex-wrap gap-1.5 text-[10px] font-semibold text-[color:var(--app-accent)]/80">
                                  <span className="rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1.5">
                                    {isId ? 'Lat' : 'Lat'}: {storeForm.lat}
                                  </span>
                                  <span className="rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1.5">
                                    {isId ? 'Lng' : 'Lng'}: {storeForm.lng}
                                  </span>
                                </div>
                              </div>
                            ) : null}

                            {storeCreateStep === 'operations' ? (
                              storeSupportsTables &&
                                (!isGuidedStoreSetup ||
                                  showDetailedStoreOperations) ? (
                                <div className="grid gap-4 sm:grid-cols-3">
                                  <TextInput
                                    label={
                                      isId ? 'Meja awal' : 'Initial tables'
                                    }
                                    className={compactStoreControlClass}
                                    inputMode="numeric"
                                    value={storeForm.table_count}
                                    onChange={event =>
                                      setStoreForm(current => ({
                                        ...current,
                                        table_count: event.target.value,
                                      }))
                                    }
                                  />
                                  <TextInput
                                    label={isId ? 'Kode meja' : 'Table code'}
                                    className={compactStoreControlClass}
                                    maxLength={STORE_LIMITS.tablePrefix}
                                    value={storeForm.table_prefix}
                                    onChange={event =>
                                      setStoreForm(current => ({
                                        ...current,
                                        table_prefix: event.target.value,
                                      }))
                                    }
                                  />
                                  <TextInput
                                    label={isId ? 'Kapasitas' : 'Capacity'}
                                    className={compactStoreControlClass}
                                    inputMode="numeric"
                                    value={storeForm.default_capacity}
                                    onChange={event =>
                                      setStoreForm(current => ({
                                        ...current,
                                        default_capacity: event.target.value,
                                      }))
                                    }
                                  />
                                </div>
                              ) : !isGuidedStoreSetup ? (
                                <div className={manageStoreSoftPanelClass}>
                                  {storeRegistrationCopy.noTablesMessage}
                                </div>
                              ) : null
                            ) : null}

                            <div className="sticky bottom-2 z-20 rounded-[20px] border border-emerald-100/90 bg-white/96 px-3 py-3 shadow-[0_20px_40px_-28px_rgba(15,23,42,0.44)] backdrop-blur dark:border-emerald-400/14 dark:bg-slate-950/92 sm:px-4">
                              <div
                                className={cn(
                                  'flex gap-3',
                                  useSimpleSetupCreateLayout
                                    ? 'items-center justify-between'
                                    : 'flex-col lg:flex-row lg:items-center lg:justify-between',
                                )}
                              >
                                {!useSimpleSetupCreateLayout ? (
                                  <div>
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]/72">
                                      {isId ? 'Aksi' : 'Action'}
                                    </p>
                                    <p className="mt-1.5 text-[12px] leading-5 text-[color:var(--app-accent)]/76">
                                      {storeCreateStep !== 'operations'
                                        ? isId
                                          ? `Kalau sudah, lanjut ke ${storeCreateSteps[storeCreateStepIndex + 1]?.title?.toLowerCase() || 'langkah berikutnya'}.`
                                          : `When you're done, continue to ${storeCreateSteps[storeCreateStepIndex + 1]?.title?.toLowerCase() || 'the next step'}.`
                                        : isId
                                          ? 'Cek bentar, lalu simpan.'
                                          : 'Review once, then save.'}
                                    </p>
                                  </div>
                                ) : (
                                  <div className="min-w-0">
                                    <p className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/72">
                                      {isId
                                        ? `Langkah ${storeCreateStepIndex + 1} dari ${STORE_CREATE_STEP_ORDER.length}`
                                        : `Step ${storeCreateStepIndex + 1} of ${STORE_CREATE_STEP_ORDER.length}`}
                                    </p>
                                    <p className="mt-0.5 truncate text-[12px] font-black text-[color:var(--app-text)]">
                                      {currentStoreCreateStep.title}
                                    </p>
                                  </div>
                                )}
                                <div className="flex shrink-0 flex-row gap-2">
                                  <button
                                    type="button"
                                    onClick={() => moveStoreCreateStep('back')}
                                    disabled={storeCreateStepIndex === 0}
                                    className="ui-button-secondary inline-flex items-center justify-center gap-2 px-3 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-55 sm:px-3.5"
                                  >
                                    <ChevronLeft className="h-4 w-4" />
                                    <span className="hidden min-[380px]:inline">
                                      {isId ? 'Kembali' : 'Back'}
                                    </span>
                                  </button>
                                  {storeCreateStep !== 'operations' ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        moveStoreCreateStep('next')
                                      }
                                      className="ui-button-primary inline-flex min-w-[96px] items-center justify-center gap-2 px-3.5 text-[13px] font-semibold"
                                    >
                                      {isId ? 'Lanjut' : 'Continue'}
                                      <ChevronRight className="h-4 w-4" />
                                    </button>
                                  ) : (
                                    <button
                                      type="submit"
                                      disabled={submittingStore}
                                      className="ui-button-primary inline-flex min-w-[116px] items-center justify-center gap-2 px-3.5 text-[13px] font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                      {submittingStore ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <Store className="h-4 w-4" />
                                      )}
                                      {isGuidedStoreSetup
                                        ? isId
                                          ? 'Simpan usaha'
                                          : 'Save business'
                                        : isId
                                          ? 'Simpan usaha'
                                          : 'Save business'}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        </form>
                      </SectionCard>
                    </>
                  ) : null}

                  {isSetupListView ? (
                    <SectionCard
                      title={isId ? 'Kelola semua usaha' : 'Manage all outlets'}
                      desc={
                        isId
                          ? 'Cari outlet yang perlu diberesin, pilih yang aktif, lalu masuk ke workspace owner-nya.'
                          : 'Find the outlet that needs attention, pick the active one, and jump into its owner workspace.'
                      }
                      action={
                        <div className="flex flex-wrap items-center gap-2">
                          {loadingStores ? (
                            <Loader2 className="h-4 w-4 animate-spin ui-accent-text" />
                          ) : null}
                          <Link
                            href={buildAssistantHref()}
                            className="ui-button-secondary ui-button-compact inline-flex items-center gap-2 px-3.5 text-xs font-semibold"
                          >
                            <ShieldCheck className="h-3.5 w-3.5" />
                            {isId ? 'Asisten usaha' : 'Business assistant'}
                          </Link>
                          <Link
                            href={buildSetupHref('create')}
                            className="ui-button-primary ui-button-compact inline-flex items-center gap-2 px-3.5 text-xs font-semibold"
                          >
                            <Store className="h-3.5 w-3.5" />
                            {isId ? 'Buat usaha baru' : 'Add new business'}
                          </Link>
                        </div>
                      }
                      compact={false}
                    >
                      {myStores.length === 0 ? (
                        <div className="rounded-[28px] border border-dashed border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,244,235,0.92))] px-4 py-7 text-sm ui-text-soft sm:px-5">
                          <p className="text-[11px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                            {isId
                              ? 'Mulai workspace owner'
                              : 'Start the owner workspace'}
                          </p>
                          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--app-accent)]/82">
                            {isId
                              ? 'Belum ada outlet. Buat outlet pertama dulu, lalu Anda bisa tambah outlet lain dan pakai list ini sebagai pusat kontrol owner.'
                              : 'There is no outlet yet. Create the first outlet, then add more outlets and use this list as the owner control center.'}
                          </p>
                          <Link
                            href={buildAssistantHref()}
                            className="ui-button-secondary mt-4 mr-2 inline-flex items-center gap-2 px-4 text-sm font-semibold"
                          >
                            <ShieldCheck className="h-4 w-4" />
                            {isId
                              ? 'Pakai asisten usaha'
                              : 'Use business assistant'}
                          </Link>
                          <Link
                            href={buildSetupHref('create')}
                            className="ui-button-primary mt-4 inline-flex items-center gap-2 px-4 text-sm font-semibold"
                          >
                            <Store className="h-4 w-4" />
                            {isId
                              ? 'Buat outlet pertama'
                              : 'Create the first outlet'}
                          </Link>
                        </div>
                      ) : (
                        <div className="space-y-4">
                          <div className="rounded-[28px] border border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,244,235,0.94))] p-4 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.18)] sm:p-5">
                            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                              <div className="max-w-3xl">
                                <p className="text-[10px] font-black uppercase tracking-[0.22em] text-[color:var(--app-accent)]/72">
                                  {isId
                                    ? 'Control center owner'
                                    : 'Owner control center'}
                                </p>
                                <h4 className="mt-1 text-[1.05rem] font-black leading-tight text-[color:var(--app-text)] sm:text-[1.25rem]">
                                  {isId
                                    ? 'Pilih usaha yang mau diberesin sekarang'
                                    : 'Pick the business you want to work on right now'}
                                </h4>
                                <p className="mt-2 max-w-2xl text-[12px] leading-5 text-[color:var(--app-text-soft)] sm:text-[13px]">
                                  {selectedStoreInsight
                                    ? isId
                                      ? `Fokus saat ini ada di ${selectedStoreInsight.store.name}. Prioritas berikutnya: ${selectedStoreInsight.nextActionLabel.toLowerCase()}.`
                                      : `Your current focus is ${selectedStoreInsight.store.name}. The next priority is to ${selectedStoreInsight.nextActionLabel.toLowerCase()}.`
                                    : isId
                                      ? 'Lihat outlet yang paling butuh follow-up, lalu masuk ke workspace detail untuk menyelesaikannya.'
                                      : 'Review which outlet needs follow-up first, then enter its detail workspace and finish the setup.'}
                                </p>
                              </div>

                              <div className="w-full rounded-[22px] border border-white/70 bg-white/92 px-4 py-3 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.18)] xl:max-w-[300px]">
                                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]/72">
                                  {isId ? 'Fokus owner' : 'Owner focus'}
                                </p>
                                <p className="mt-1.5 text-[13px] font-black text-[color:var(--app-text)]">
                                  {selectedStoreInsight
                                    ? selectedStoreInsight.nextActionLabel
                                    : isId
                                      ? 'Pilih outlet utama'
                                      : 'Choose the main outlet'}
                                </p>
                                <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                  {selectedStoreInsight
                                    ? selectedStoreInsight.nextActionDesc
                                    : isId
                                      ? 'Kalau owner pegang banyak usaha, mulai dari outlet yang paling sering dipakai atau paling banyak gap.'
                                      : 'If the owner manages several businesses, start with the outlet used most often or the one with the biggest gaps.'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                              <StatCard
                                label={isId ? 'Total usaha' : 'Businesses'}
                                value={myStores.length}
                                desc={
                                  isId
                                    ? 'Semua outlet yang bisa Anda kelola'
                                    : 'All outlets you can manage'
                                }
                              />
                              <StatCard
                                label={isId ? 'Outlet aktif' : 'Active outlets'}
                                value={activeStoreCount}
                                desc={
                                  isId
                                    ? 'Sudah siap dipakai operasional'
                                    : 'Already usable for operations'
                                }
                              />
                              <StatCard
                                label={isId ? 'Perlu aksi' : 'Need action'}
                                value={storeAttentionCount}
                                desc={
                                  isId
                                    ? 'Masih ada gap penting owner'
                                    : 'Still have important owner gaps'
                                }
                              />
                              <StatCard
                                label={isId ? 'Siap jalan' : 'Ready now'}
                                value={readyStoreCount}
                                desc={
                                  isId
                                    ? `${liveStoreCount} outlet sedang live`
                                    : `${liveStoreCount} outlets are live now`
                                }
                              />
                            </div>

                            <div className="mt-4 flex flex-col gap-3 xl:flex-row xl:items-center">
                              <label className="block min-w-0 flex-1">
                                <span className="sr-only">
                                  {isId ? 'Cari outlet' : 'Search outlets'}
                                </span>
                                <input
                                  type="search"
                                  value={storeListQuery}
                                  onChange={event =>
                                    setStoreListQuery(event.target.value)
                                  }
                                  placeholder={
                                    isId
                                      ? 'Cari nama outlet, kota, kategori, atau fokus berikutnya'
                                      : 'Search by outlet name, city, category, or next action'
                                  }
                                  className="min-h-[40px] w-full rounded-[12px] border border-[color:var(--app-accent-border)] bg-white px-3 text-[13px] text-[color:var(--app-text)] outline-none transition placeholder:text-[color:var(--app-text-soft)]/75 focus:border-[color:var(--app-accent)] focus:ring-2 focus:ring-[color:var(--app-accent-border)]"
                                />
                              </label>

                              <div className="flex flex-wrap gap-2">
                                {storeListFilterOptions.map(option => {
                                  const active = option.id === storeListFilter;
                                  return (
                                    <button
                                      key={option.id}
                                      type="button"
                                      onClick={() =>
                                        setStoreListFilter(option.id)
                                      }
                                      className={cn(
                                        'ui-pressable inline-flex min-h-[42px] items-center gap-2 rounded-full px-3.5 text-[12px] font-semibold transition',
                                        active
                                          ? 'bg-[color:color-mix(in_srgb,var(--app-accent-soft)_38%,white)] text-[color:var(--app-accent)] shadow-[0_14px_28px_-24px_rgba(15,23,42,0.18)] ring-1 ring-[color:var(--app-accent-border)]'
                                          : 'bg-white text-[color:var(--app-text-soft)] shadow-[0_10px_22px_-24px_rgba(15,23,42,0.12)] ring-1 ring-slate-200/80 hover:-translate-y-0.5 hover:text-[color:var(--app-accent)]',
                                      )}
                                    >
                                      <span>{option.label}</span>
                                      <span
                                        className={cn(
                                          'inline-flex h-6 min-w-[1.8rem] items-center justify-center rounded-full px-2 text-[10px] font-black',
                                          active
                                            ? 'bg-[color:var(--app-accent)] text-white'
                                            : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]',
                                        )}
                                      >
                                        {option.count}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {filteredStoreList.length === 0 ? (
                            <div className="rounded-[24px] border border-dashed border-[color:var(--app-accent-border)] bg-[color:var(--app-surface)] px-4 py-6 text-sm text-[color:var(--app-text-soft)]">
                              <p>{storeListEmptyMessage}</p>
                              <div className="mt-4 flex flex-wrap gap-2">
                                {(hasStoreListQuery ||
                                  storeListFilter !== 'all') && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setStoreListQuery('');
                                        setStoreListFilter('all');
                                      }}
                                      className="ui-button-secondary ui-button-compact inline-flex px-4 text-sm font-semibold"
                                    >
                                      {isId ? 'Reset pencarian' : 'Reset search'}
                                    </button>
                                  )}
                                <Link
                                  href={buildSetupHref('create')}
                                  className="ui-button-primary ui-button-compact inline-flex px-4 text-sm font-semibold"
                                >
                                  {isId
                                    ? 'Tambah usaha baru'
                                    : 'Add new business'}
                                </Link>
                              </div>
                            </div>
                          ) : (
                            <div className="grid gap-3 xl:grid-cols-2">
                              {filteredStoreList.map(item => (
                                <StoreSwitcherCard
                                  key={item.store.id}
                                  name={item.store.name}
                                  city={item.store.city}
                                  address={item.store.address}
                                  badges={item.badges}
                                  status={item.status}
                                  selected={item.selected}
                                  summary={item.summary}
                                  readinessPercent={item.readinessPercent}
                                  healthLabel={item.healthLabel}
                                  healthTone={item.healthTone}
                                  metrics={item.metrics}
                                  nextActionLabel={item.nextActionLabel}
                                  nextActionDesc={item.nextActionDesc}
                                  actionLabel={item.actionLabel}
                                  secondaryActionHref={item.secondaryActionHref}
                                  secondaryActionLabel={
                                    item.secondaryActionLabel
                                  }
                                  onClick={() => {
                                    setSelectedStoreId(item.store.id);
                                    router.push(
                                      buildWorkspaceHref(
                                        'overview',
                                        item.store.id,
                                      ),
                                    );
                                  }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      )}
                    </SectionCard>
                  ) : null}
                </div>
              ) : null}

              <div className="space-y-4">
                {pageError || (submitError && !isSetupCreateView) ? (
                  <div className="rounded-[24px] border border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-4 py-3 text-sm text-[color:var(--app-accent)]">
                    {pageError || submitError}
                  </div>
                ) : null}

                {verificationMessage ? (
                  <div className="rounded-[24px] border border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] px-4 py-3 text-sm text-[color:var(--app-accent)]">
                    {verificationMessage}
                  </div>
                ) : null}

                {selectedStore &&
                  currentWorkspace !== 'setup' &&
                  !useSimpleWorkspaceShell ? (
                  <>
                    <SectionCard
                      title={
                        isId
                          ? `Usaha aktif: ${selectedStore.name}`
                          : `Active business: ${selectedStore.name}`
                      }
                      desc={[selectedStore.city, selectedStore.address]
                        .filter(Boolean)
                        .join(' - ')}
                      action={
                        <div className="flex flex-wrap items-center gap-2">
                          {selectedBusinessCategory ? (
                            <InlineBadge tone="default">
                              {getUmkmBusinessCategoryLabel(
                                selectedBusinessCategory,
                                isId,
                              )}
                            </InlineBadge>
                          ) : null}
                          {selectedStorePresence ? (
                            <InlineBadge tone="default">
                              {getUmkmLocationModeLabel(
                                selectedStorePresence.locationMode,
                                isId,
                              )}
                            </InlineBadge>
                          ) : null}
                          {storePublishServices.length > 0 ? (
                            <div className="flex flex-wrap gap-2">
                              {storePublishServices.map(service => (
                                <InlineBadge key={service} tone="accent">
                                  {getUmkmPublishServiceLabel(service, isId)}
                                </InlineBadge>
                              ))}
                            </div>
                          ) : null}
                          {selectedStore.access_role ? (
                            <InlineBadge
                              tone={
                                selectedStore.access_role === 'owner'
                                  ? 'accent'
                                  : 'default'
                              }
                            >
                              {teamRoleLabel(selectedStore.access_role, isId)}
                            </InlineBadge>
                          ) : null}
                          <Link
                            href={buildUmkmStorefrontPath(selectedStore.slug)}
                            className="ui-button-secondary ui-button-compact px-4 text-sm font-bold"
                          >
                            {storefrontActionLabel}
                          </Link>
                        </div>
                      }
                    >
                      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                        <StatCard
                          label={isId ? 'Produk' : 'Products'}
                          value={products.length}
                          desc={
                            isId
                              ? 'Semua jualan yang sudah masuk'
                              : 'All registered products'
                          }
                        />
                        <StatCard
                          label={isId ? 'Pesanan aktif' : 'Active orders'}
                          value={openOrders.length}
                          desc={
                            isId
                              ? 'Perlu dicek sekarang'
                              : 'Needs attention now'
                          }
                        />
                        <StatCard
                          label={isId ? 'Stok kritis' : 'Stock risk'}
                          value={lowStockCount + outOfStockCount}
                          desc={
                            outOfStockCount > 0
                              ? isId
                                ? `${outOfStockCount} habis`
                                : `${outOfStockCount} out of stock`
                              : isId
                                ? 'Stok masih aman'
                                : 'Catalog is still healthy'
                          }
                        />
                        <StatCard
                          label={isId ? 'Uang masuk' : 'Collected revenue'}
                          value={formatIdr(paidRevenueCents)}
                          desc={
                            isId
                              ? 'Dari pesanan yang sudah dibayar'
                              : 'From paid orders'
                          }
                        />
                      </div>

                      <div className="mt-5 grid gap-4 xl:grid-cols-[1.05fr_0.95fr]">
                        {nextOwnerStep ? (
                          <div className="rounded-[30px] border border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,rgba(255,255,255,0.98),rgba(255,244,235,0.94))] px-5 py-5 text-[color:var(--app-accent)] shadow-sm">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                              {isId ? 'Mulai dari sini' : 'Start here'}
                            </p>
                            <h4 className="mt-2 text-lg font-black text-[color:var(--app-accent)]">
                              {nextOwnerStep.label}
                            </h4>
                            <p className="mt-1 text-sm text-[color:var(--app-accent)]/80">
                              {nextOwnerStep.desc}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                scrollToSection(nextOwnerStep.target)
                              }
                              className="mt-4 inline-flex min-h-[42px] items-center gap-2 rounded-2xl border border-[color:var(--app-accent)] bg-[color:var(--app-accent)] px-4 text-sm font-black text-white"
                            >
                              <ArrowRightLeft className="h-4 w-4" />
                              {isId ? 'Buka' : 'Open'}
                            </button>
                          </div>
                        ) : null}

                        <div className="rounded-[30px] border border-[color:var(--app-accent-border)] bg-white px-5 py-5 shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                {isId ? 'Cek dulu' : 'Check first'}
                              </p>
                              <p className="mt-2 text-sm text-[color:var(--app-accent)]/78">
                                {isId
                                  ? 'Yang paling penting buat diberesin.'
                                  : 'The most important things to fix first.'}
                              </p>
                            </div>
                            <InlineBadge
                              tone={
                                ownerAlerts.length > 0 ? 'warning' : 'success'
                              }
                            >
                              {ownerAlerts.length > 0
                                ? `${ownerAlerts.length} ${isId ? 'aksi' : 'actions'}`
                                : isId
                                  ? 'Aman'
                                  : 'Healthy'}
                            </InlineBadge>
                          </div>

                          <div className="mt-4 space-y-3">
                            {ownerAlerts.length === 0 ? (
                              <div className="rounded-2xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-4 py-4 text-sm text-[color:var(--app-accent)]">
                                {isId
                                  ? 'Usaha ini sudah cukup rapi. Tinggal lanjut jalanin jualannya.'
                                  : 'This business is healthy enough. You can keep selling.'}
                              </div>
                            ) : (
                              ownerAlerts.map(alert => {
                                const AlertIcon = alert.icon;
                                return (
                                  <button
                                    key={alert.id}
                                    type="button"
                                    onClick={() =>
                                      scrollToSection(alert.target)
                                    }
                                    className="flex w-full items-start justify-between gap-3 rounded-2xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface)] px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                                  >
                                    <div className="flex min-w-0 items-start gap-3">
                                      <div className="rounded-2xl border border-[color:var(--app-accent-border)] bg-white p-2.5">
                                        <AlertIcon className="h-4 w-4 text-[color:var(--app-accent)]" />
                                      </div>
                                      <div className="min-w-0">
                                        <p className="text-sm font-black text-[color:var(--app-accent)]">
                                          {alert.title}
                                        </p>
                                        <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                          {alert.desc}
                                        </p>
                                      </div>
                                    </div>
                                    <InlineBadge tone={alert.tone || 'default'}>
                                      {isId ? 'Lihat' : 'Open'}
                                    </InlineBadge>
                                  </button>
                                );
                              })
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                              {isId ? 'Mode kerja' : 'Work modes'}
                            </p>
                            <p className="mt-2 text-sm text-[color:var(--app-accent)]/78">
                              {isId
                                ? 'Pilih mode yang paling cocok sama kerjaan sekarang.'
                                : 'Pick the mode that matches the current task.'}
                            </p>
                          </div>
                          <InlineBadge tone="accent">
                            {isId ? 'Role-aware MVP' : 'Role-aware MVP'}
                          </InlineBadge>
                        </div>

                        <div className="mt-4 grid gap-3 lg:grid-cols-2 xl:grid-cols-4">
                          {workspaceModes.map(mode => (
                            <ActionTile
                              key={mode.id}
                              icon={mode.icon}
                              title={mode.title}
                              desc={mode.desc}
                              badge={mode.badge}
                              onClick={() => scrollToSection(mode.target)}
                              emphasized={mode.id === 'cashier'}
                            />
                          ))}
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                              {isId ? 'Link & QR' : 'Links & QR'}
                            </p>
                            <p className="mt-2 text-sm text-[color:var(--app-accent)]/78">
                              {isId
                                ? 'Yang paling sering dipakai buat share dan mulai jualan.'
                                : 'The assets used most often for sharing and selling.'}
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                          <ActionTile
                            icon={Store}
                            title={storefrontActionLabel}
                            desc={
                              isId
                                ? 'Cek tampilan toko dari sisi pembeli.'
                                : 'Review the storefront and customer flow directly.'
                            }
                            href={buildUmkmStorefrontPath(selectedStore.slug)}
                            badge={isId ? 'Public view' : 'Public view'}
                            emphasized
                          />
                          <ActionTile
                            icon={Clipboard}
                            title={isId ? 'Salin link toko' : 'Copy store link'}
                            desc={
                              isId
                                ? 'Bagikan ke WhatsApp, katalog, atau promosi komunitas.'
                                : 'Share to WhatsApp, catalogs, or community promos.'
                            }
                            onClick={() =>
                              void copyText(`${origin}${storefrontUrl}`)
                            }
                            badge={isId ? 'Share' : 'Share'}
                          />
                          <ActionTile
                            icon={WalletCards}
                            title={
                              isId
                                ? 'Masuk ke pesanan aktif'
                                : 'Open active orders'
                            }
                            desc={
                              isId
                                ? `${openOrders.length} pesanan masih jalan dan perlu dipantau.`
                                : `${openOrders.length} orders are still live and need monitoring.`
                            }
                            onClick={() => scrollToSection('umkm-orders')}
                            badge={`${openOrders.length} ${isId ? 'live' : 'live'}`}
                          />
                        </div>
                      </div>

                      <div className="mt-5 grid gap-5 xl:grid-cols-[330px_minmax(0,1fr)]">
                        <div className="space-y-4">
                          <div className="rounded-[28px] border border-[color:var(--app-accent-border)] bg-white p-4 text-[color:var(--app-accent)] shadow-sm">
                            <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                              {isId ? 'Link toko' : 'Store link'}
                            </p>
                            <p className="mt-2 break-all text-sm text-[color:var(--app-accent)]">
                              {origin}
                              {storefrontUrl}
                            </p>
                            <button
                              type="button"
                              onClick={() =>
                                void copyText(`${origin}${storefrontUrl}`)
                              }
                              className="mt-3 inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] px-3 text-xs font-bold text-[color:var(--app-accent)]"
                            >
                              <Clipboard className="h-3.5 w-3.5" />
                              {isId ? 'Salin link toko' : 'Copy store link'}
                            </button>
                          </div>

                          {onlineQr ? (
                            <div className="rounded-[28px] border border-[color:var(--app-accent-border)] bg-white p-4 text-[color:var(--app-accent)] shadow-sm">
                              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]">
                                {isId ? 'QR online' : 'Online QR'}
                              </p>
                              <p className="mt-2 break-all text-sm text-[color:var(--app-accent)]">
                                {onlineQrBaseUrl}
                                {encodeURIComponent(onlineQr.token)}
                              </p>
                              <button
                                type="button"
                                onClick={() =>
                                  void copyText(
                                    `${onlineQrBaseUrl}${encodeURIComponent(
                                      onlineQr.token,
                                    )}`,
                                  )
                                }
                                className="mt-3 inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] px-3 text-xs font-bold text-[color:var(--app-accent)]"
                              >
                                <Clipboard className="h-3.5 w-3.5" />
                                {isId ? 'Salin QR online' : 'Copy online QR'}
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                          {onlineQr ? (
                            <QrPreview
                              label={
                                isId
                                  ? 'QR Online Storefront'
                                  : 'Online Storefront QR'
                              }
                              value={`${onlineQrBaseUrl}${encodeURIComponent(onlineQr.token)}`}
                            />
                          ) : null}

                          {offlineQrs.slice(0, 8).map(qr => (
                            <QrPreview
                              key={qr.id}
                              label={
                                isId
                                  ? `QR Meja ${qr.table_code || '-'}`
                                  : `Table QR ${qr.table_code || '-'}`
                              }
                              value={`${onlineQrBaseUrl}${encodeURIComponent(qr.token)}`}
                            />
                          ))}
                        </div>
                      </div>
                    </SectionCard>
                    {isSetupDetailView &&
                      activeSetupDetailStep === 'summary' ? (
                      <SectionCard
                        id="umkm-setup-summary"
                        title={
                          isId
                            ? `Usaha: ${selectedStore.name}`
                            : `Business: ${selectedStore.name}`
                        }
                        desc={[selectedStore.city, selectedStore.address]
                          .filter(Boolean)
                          .join(' - ')}
                        action={
                          <div className="flex flex-wrap items-center gap-2">
                            <InlineBadge tone="accent">
                              {myStores.length}{' '}
                              {isId ? 'usaha dikelola' : 'businesses managed'}
                            </InlineBadge>
                            <Link
                              href={buildSetupHref('list', selectedStore.id)}
                              className="ui-button-secondary ui-button-compact px-4 text-sm font-bold"
                            >
                              {isId ? 'Daftar usaha' : 'Business list'}
                            </Link>
                            <Link
                              href={buildSetupHref('create')}
                              className="ui-button-secondary ui-button-compact px-4 text-sm font-bold"
                            >
                              {isId ? 'Tambah usaha' : 'Add business'}
                            </Link>
                            <Link
                              href={buildUmkmStorefrontPath(selectedStore.slug)}
                              className="ui-button-secondary ui-button-compact px-4 text-sm font-bold"
                            >
                              {storefrontActionLabel}
                            </Link>
                          </div>
                        }
                      >
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                          <StatCard
                            label={isId ? 'Produk' : 'Products'}
                            value={products.length}
                            desc={
                              isId
                                ? 'Terdaftar di outlet ini'
                                : 'Registered in this outlet'
                            }
                          />
                          <StatCard
                            label={isId ? 'Pesanan aktif' : 'Active orders'}
                            value={openOrders.length}
                            desc={isId ? 'Masih berjalan' : 'Still in progress'}
                          />
                          <StatCard
                            label={isId ? 'Stok kritis' : 'Stock risk'}
                            value={lowStockCount + outOfStockCount}
                            desc={isId ? 'Perlu dicek' : 'Needs review'}
                          />
                          <StatCard
                            label={isId ? 'Uang masuk' : 'Collected revenue'}
                            value={formatIdr(paidRevenueCents)}
                            desc={
                              isId
                                ? 'Pesanan yang sudah dibayar'
                                : 'Paid orders only'
                            }
                          />
                        </div>

                        {ownerAlerts.length > 0 ? (
                          <div className="mt-3.5 grid gap-2.5 lg:grid-cols-2">
                            {ownerAlerts.slice(0, 4).map(alert => {
                              const AlertIcon = alert.icon;
                              return (
                                <button
                                  key={alert.id}
                                  type="button"
                                  onClick={() => scrollToSection(alert.target)}
                                  className="flex w-full items-start gap-3 rounded-[18px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-surface)] px-3 py-3 text-left transition hover:-translate-y-0.5 hover:shadow-sm"
                                >
                                  <div className="rounded-[16px] border border-[color:var(--app-accent-border)] bg-white p-2">
                                    <AlertIcon className="h-4 w-4 text-[color:var(--app-accent)]" />
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-[13px] font-black text-[color:var(--app-accent)]">
                                      {alert.title}
                                    </p>
                                    <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-accent)]/76">
                                      {alert.desc}
                                    </p>
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        ) : null}
                      </SectionCard>
                    ) : null}

                    {isSetupDetailView && activeSetupDetailStep === 'basic' ? (
                      <SectionCard
                        id="umkm-store-basic"
                        title={isId ? 'Info dasar outlet' : 'Basic outlet info'}
                        desc={
                          isId
                            ? 'Owner bisa punya banyak usaha. Form ini hanya mengubah outlet yang sedang dipilih.'
                            : 'Owners can manage multiple businesses. This form only updates the currently selected outlet.'
                        }
                        action={
                          <button
                            type="button"
                            onClick={() => void saveBasicStore()}
                            disabled={savingBasicStore}
                            className="ui-button-primary ui-button-compact inline-flex items-center gap-2 px-4 text-sm font-bold disabled:opacity-60"
                          >
                            {savingBasicStore ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Store className="h-4 w-4" />
                            )}
                            {isId ? 'Simpan info outlet' : 'Save outlet info'}
                          </button>
                        }
                      >
                        <div className="grid gap-6 xl:grid-cols-[1.18fr_0.82fr]">
                          <div className="space-y-4">
                            {basicStoreMessage ? (
                              <div className="rounded-[22px] border border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] px-4 py-3 text-sm text-[color:var(--app-accent)]">
                                {basicStoreMessage}
                              </div>
                            ) : null}

                            <div className="grid gap-4 md:grid-cols-2">
                              <TextInput
                                label={isId ? 'Nama usaha' : 'Business name'}
                                value={basicStoreForm.name}
                                onChange={event =>
                                  setBasicStoreForm(current => ({
                                    ...current,
                                    name: event.target.value,
                                  }))
                                }
                                autoComplete="organization"
                                maxLength={STORE_LIMITS.name}
                                placeholder={
                                  isId
                                    ? 'Contoh: Kedai Nusantara'
                                    : 'Example: Nusantara Business'
                                }
                              />
                              <TextInput
                                label={
                                  isId
                                    ? 'Kota / area utama'
                                    : 'City / main area'
                                }
                                value={basicStoreForm.city}
                                onChange={event =>
                                  setBasicStoreForm(current => ({
                                    ...current,
                                    city: event.target.value,
                                  }))
                                }
                                autoComplete="address-level2"
                                maxLength={STORE_LIMITS.city}
                                placeholder="Jakarta"
                              />
                            </div>

                            <TextInput
                              label={
                                isId
                                  ? 'WA / telepon outlet'
                                  : 'Outlet WhatsApp / phone'
                              }
                              type="tel"
                              value={basicStoreForm.phone}
                              onChange={event =>
                                setBasicStoreForm(current => ({
                                  ...current,
                                  phone: event.target.value,
                                }))
                              }
                              autoComplete="tel"
                              maxLength={STORE_LIMITS.phone}
                              placeholder="08xxxxxxxxxx"
                            />

                            <TextArea
                              label={isId ? 'Alamat outlet' : 'Outlet address'}
                              value={basicStoreForm.address}
                              onChange={event =>
                                setBasicStoreForm(current => ({
                                  ...current,
                                  address: event.target.value,
                                }))
                              }
                              maxLength={STORE_LIMITS.address}
                              rows={3}
                              className="min-h-[96px]"
                              placeholder={
                                isId
                                  ? 'Jalan, patokan, atau nama area usaha'
                                  : 'Street, landmark, or business area'
                              }
                            />

                            <TextArea
                              label={
                                isId ? 'Deskripsi singkat' : 'Short description'
                              }
                              value={basicStoreForm.description}
                              onChange={event =>
                                setBasicStoreForm(current => ({
                                  ...current,
                                  description: event.target.value,
                                }))
                              }
                              maxLength={STORE_LIMITS.description}
                              rows={5}
                              placeholder={
                                isId
                                  ? 'Tulis jualan utama dan hal penting.'
                                  : 'Describe the main offer, strengths, and what the owner or team should understand quickly.'
                              }
                            />
                          </div>

                          <div className="rounded-[30px] border border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,245,237,0.96))] p-5 text-[color:var(--app-accent)] shadow-sm">
                            <div className="flex flex-wrap items-start justify-between gap-3">
                              <div>
                                <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                                  {isId
                                    ? 'Flow owner multi usaha'
                                    : 'Multi-business owner flow'}
                                </p>
                                <h4 className="mt-3 text-lg font-black">
                                  {isId
                                    ? 'Edit outlet ini tanpa ganggu usaha lain'
                                    : 'Edit this outlet without affecting the others'}
                                </h4>
                                <p className="mt-2 text-sm leading-6 text-[color:var(--app-accent)]/78">
                                  {isId
                                    ? 'Nama, kota, alamat, telepon, dan deskripsi di sini hanya berlaku untuk outlet yang sedang dipilih.'
                                    : 'The name, city, address, phone, and description here apply only to the currently selected outlet.'}
                                </p>
                              </div>
                              <InlineBadge tone="accent">
                                {myStores.length}{' '}
                                {isId ? 'usaha dikelola' : 'businesses managed'}
                              </InlineBadge>
                            </div>

                            <div className="mt-4 grid gap-3 sm:grid-cols-2">
                              <div className="rounded-[22px] border border-[color:var(--app-accent-border)] bg-white px-4 py-4">
                                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/74">
                                  {isId ? 'Outlet aktif' : 'Active outlet'}
                                </p>
                                <p className="mt-2 text-sm font-black">
                                  {selectedStore.name}
                                </p>
                                <p className="mt-2 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                  {[selectedStore.city, selectedStore.address]
                                    .filter(Boolean)
                                    .join(' - ')}
                                </p>
                              </div>
                              <div className="rounded-[22px] border border-[color:var(--app-accent-border)] bg-white px-4 py-4">
                                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/74">
                                  {isId
                                    ? 'Kategori & akses'
                                    : 'Category & access'}
                                </p>
                                <p className="mt-2 text-sm font-black">
                                  {getUmkmBusinessCategoryLabel(
                                    selectedBusinessCategory,
                                    isId,
                                  )}
                                </p>
                                <p className="mt-2 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                  {selectedStore.access_via === 'owner'
                                    ? isId
                                      ? 'Anda sedang mengelola sebagai owner.'
                                      : 'You are managing this as the owner.'
                                    : isId
                                      ? 'Anda sedang masuk lewat akses tim outlet.'
                                      : 'You are currently accessing this through outlet team access.'}
                                </p>
                              </div>
                            </div>

                            <div className="mt-5 space-y-3">
                              <button
                                type="button"
                                onClick={() =>
                                  scrollToSection('umkm-verification')
                                }
                                className="ui-button-secondary ui-button-compact flex w-full items-center justify-center px-4 text-sm font-bold"
                              >
                                {isId
                                  ? 'Lanjut ke profil & publish'
                                  : 'Continue to profile & publish'}
                              </button>
                              <Link
                                href={buildSetupHref('list', selectedStore.id)}
                                className="ui-button-secondary ui-button-compact flex w-full items-center justify-center px-4 text-sm font-bold"
                              >
                                {isId
                                  ? 'Lihat daftar semua usaha'
                                  : 'View all businesses'}
                              </Link>
                              <Link
                                href={buildUmkmStorefrontPath(
                                  selectedStore.slug,
                                )}
                                className="ui-button-secondary ui-button-compact flex w-full items-center justify-center px-4 text-sm font-bold"
                              >
                                {storefrontActionLabel}
                              </Link>
                            </div>
                          </div>
                        </div>
                      </SectionCard>
                    ) : null}

                    {isSetupDetailView &&
                      activeSetupDetailStep === 'recommendations' ? (
                      <SectionCard
                        id="umkm-start-recommendations"
                        title={
                          isId
                            ? 'Rekomendasi search untuk owner'
                            : 'Search recommendations for the owner'
                        }
                        desc={
                          isId
                            ? 'Supaya setelah outlet tersimpan, owner langsung tahu partner, lokasi, dan support apa yang perlu dicari.'
                            : 'So once the outlet is saved, the owner knows which partners, locations, and support to look for next.'
                        }
                        action={
                          <Link
                            href={buildAssistantHref(selectedStore.id)}
                            className="ui-button-secondary ui-button-compact px-3 text-xs font-bold"
                          >
                            {isId
                              ? 'Buka asisten usaha'
                              : 'Open business assistant'}
                          </Link>
                        }
                      >
                        <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
                          <div>
                            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                              {launchRecommendationCards.map(card => {
                                const Icon = card.icon;
                                return (
                                  <article
                                    key={card.id}
                                    className="rounded-[24px] border border-[color:var(--app-accent-border)] bg-white p-4 shadow-sm"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-[16px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                                        <Icon className="h-4 w-4" />
                                      </span>
                                      <InlineBadge tone="accent">
                                        {card.badge}
                                      </InlineBadge>
                                    </div>
                                    <p className="mt-3 text-sm font-black text-[color:var(--app-accent)]">
                                      {card.title}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                      {card.desc}
                                    </p>

                                    <div className="mt-3 rounded-[18px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-3">
                                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/72">
                                        {isId
                                          ? 'Cari via search'
                                          : 'Search through the marketplace'}
                                      </p>
                                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/82">
                                        {card.query}
                                      </p>
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                      <Link
                                        href={card.searchHref}
                                        className="ui-button-primary ui-button-compact inline-flex items-center justify-center px-3 text-xs font-bold"
                                      >
                                        {card.searchLabel}
                                      </Link>
                                      <Link
                                        href={card.briefHref}
                                        className="ui-button-secondary ui-button-compact inline-flex items-center justify-center px-3 text-xs font-bold"
                                      >
                                        {card.briefLabel}
                                      </Link>
                                    </div>
                                  </article>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-4">
                            <div className="grid gap-3 sm:grid-cols-2">
                              <StatCard
                                label={
                                  isId ? 'Fondasi outlet' : 'Outlet foundation'
                                }
                                value={`${basicStoreCompletion}/5`}
                                desc={
                                  isId
                                    ? 'Nama, kota, alamat, telepon, dan deskripsi.'
                                    : 'Name, city, address, phone, and description.'
                                }
                              />
                              <StatCard
                                label={
                                  isId ? 'Arah pencarian' : 'Search directions'
                                }
                                value={launchRecommendationCards.length}
                                desc={
                                  isId
                                    ? 'Supplier, lokasi, ops, legal, dan talent.'
                                    : 'Supply, location, ops, legal, and talent.'
                                }
                              />
                            </div>

                            <div className="rounded-[28px] border border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,245,237,0.96))] p-5 text-[color:var(--app-accent)] shadow-sm">
                              <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                                {isId
                                  ? 'Supaya owner merasa aman'
                                  : 'So the owner feels safer'}
                              </p>
                              <div className="mt-4 space-y-3">
                                {startCompanionNotes.map(note => (
                                  <div
                                    key={note.title}
                                    className="rounded-[20px] border border-[color:var(--app-accent-border)] bg-white px-4 py-3"
                                  >
                                    <p className="text-sm font-black">
                                      {note.title}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                      {note.desc}
                                    </p>
                                  </div>
                                ))}
                              </div>

                              <div className="mt-4 rounded-[20px] border border-dashed border-[color:var(--app-accent-border)] bg-white px-4 py-4">
                                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/72">
                                  {isId
                                    ? 'Kalau masih ragu'
                                    : 'If it still feels uncertain'}
                                </p>
                                <p className="mt-2 text-sm leading-6 text-[color:var(--app-accent)]/78">
                                  {isId
                                    ? `Mulai satu keputusan untuk ${selectedStore.name}: supplier, lokasi, atau jasa.`
                                    : `Start with one decision only for ${selectedStore.name}: supply, location, or operations support. Then move to the next decision.`}
                                </p>
                              </div>
                            </div>
                          </div>
                        </div>
                      </SectionCard>
                    ) : null}

                    {currentWorkspace === 'team' ? (
                      <SectionCard
                        id="umkm-team"
                        title={
                          isId ? 'Tim & akses kerja' : 'Team & access blueprint'
                        }
                        desc={
                          isId
                            ? 'Untuk pemakaian seharian, owner sebaiknya tidak mengerjakan semuanya sendiri. Mulai dari pola akses per peran dan per outlet.'
                            : 'For all-day usage, owners should not handle everything themselves. Start with role-based and outlet-based access patterns.'
                        }
                        action={
                          <InlineBadge tone="accent">
                            {isId ? 'MVP role system' : 'MVP role system'}
                          </InlineBadge>
                        }
                      >
                        {teamMessage ? (
                          <div className="rounded-[22px] border border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] px-4 py-3 text-sm text-[color:var(--app-accent)]">
                            {teamMessage}
                          </div>
                        ) : null}

                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <StatCard
                            label={isId ? 'Total anggota' : 'Total members'}
                            value={teamSummary.total}
                            desc={
                              isId
                                ? 'Termasuk owner outlet'
                                : 'Including the outlet owner'
                            }
                          />
                          <StatCard
                            label={isId ? 'Aktif' : 'Active'}
                            value={teamSummary.active}
                            desc={
                              isId
                                ? 'Sedang punya akses'
                                : 'Currently have access'
                            }
                          />
                          <StatCard
                            label={isId ? 'Menunggu' : 'Invited'}
                            value={teamSummary.invited}
                            desc={
                              isId
                                ? 'Belum aktif penuh'
                                : 'Not fully active yet'
                            }
                          />
                          <StatCard
                            label={isId ? 'Nonaktif' : 'Disabled'}
                            value={teamSummary.disabled}
                            desc={
                              isId ? 'Akses dihentikan' : 'Access turned off'
                            }
                          />
                        </div>

                        <div className="mt-5 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
                          <div className="space-y-4">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                {isId ? 'Roster outlet' : 'Outlet roster'}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-[color:var(--app-accent)]/78">
                                {isId
                                  ? 'Anggota tim yang benar-benar punya akses ke outlet ini. Role di sini juga dipakai backend untuk mengizinkan modul tertentu.'
                                  : 'The team members who actually have access to this outlet. These roles are also used by the backend to allow specific modules.'}
                              </p>
                            </div>

                            {teamMembers.length === 0 ? (
                              <div className="rounded-[24px] border border-dashed border-[color:var(--app-accent-border)] px-4 py-8 text-sm text-[color:var(--app-accent)]">
                                {isId
                                  ? 'Tambah kasir, stok, atau operasional.'
                                  : 'No team members besides the owner yet. Add cashier, stock, or ops so this dashboard can support all-day use.'}
                              </div>
                            ) : (
                              <div className="space-y-3">
                                {teamMembers.map(member => (
                                  <article
                                    key={member.id}
                                    className="rounded-[26px] border border-[color:var(--app-accent-border)] bg-white p-4 shadow-sm"
                                  >
                                    <div className="flex flex-wrap items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <div className="flex flex-wrap items-center gap-2">
                                          <p className="text-sm font-black text-[color:var(--app-accent)]">
                                            {member.name}
                                          </p>
                                          <InlineBadge
                                            tone={
                                              member.role === 'owner'
                                                ? 'accent'
                                                : 'default'
                                            }
                                          >
                                            {teamRoleLabel(member.role, isId)}
                                          </InlineBadge>
                                          <InlineBadge
                                            tone={
                                              member.status === 'active'
                                                ? 'success'
                                                : member.status === 'invited'
                                                  ? 'warning'
                                                  : 'default'
                                            }
                                          >
                                            {member.status}
                                          </InlineBadge>
                                        </div>
                                        <p className="mt-2 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                          {member.email ||
                                            member.user_id ||
                                            (isId
                                              ? 'Belum dikaitkan ke akun'
                                              : 'Not linked to an account yet')}
                                        </p>
                                        {member.notes ? (
                                          <p className="mt-2 text-xs leading-5 text-[color:var(--app-accent)]/74">
                                            {member.notes}
                                          </p>
                                        ) : null}
                                      </div>

                                      {canManageTeam &&
                                        member.role !== 'owner' ? (
                                        <div className="flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            disabled={
                                              actingTeamMemberId ===
                                              member.id ||
                                              member.status === 'active'
                                            }
                                            onClick={() =>
                                              void updateTeamMemberStatus(
                                                member,
                                                'active',
                                              )
                                            }
                                            className="ui-button-secondary ui-button-compact px-3 text-xs font-bold disabled:opacity-60"
                                          >
                                            {isId ? 'Aktifkan' : 'Activate'}
                                          </button>
                                          <button
                                            type="button"
                                            disabled={
                                              actingTeamMemberId ===
                                              member.id ||
                                              member.status === 'disabled'
                                            }
                                            onClick={() =>
                                              void updateTeamMemberStatus(
                                                member,
                                                'disabled',
                                              )
                                            }
                                            className="ui-button-secondary ui-button-compact px-3 text-xs font-bold disabled:opacity-60"
                                          >
                                            {isId ? 'Nonaktifkan' : 'Disable'}
                                          </button>
                                        </div>
                                      ) : null}
                                    </div>

                                    <div className="mt-4 flex flex-wrap gap-2">
                                      {member.permissions.map(permission => (
                                        <span
                                          key={permission}
                                          className="rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--app-accent)]"
                                        >
                                          {permission.replace(':', ' / ')}
                                        </span>
                                      ))}
                                    </div>
                                  </article>
                                ))}
                              </div>
                            )}
                          </div>

                          <div className="rounded-[30px] border border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,245,237,0.96))] p-5 text-[color:var(--app-accent)] shadow-sm">
                            <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                              {isId
                                ? 'Tambah akses outlet'
                                : 'Add outlet access'}
                            </p>
                            <h4 className="mt-3 text-lg font-black">
                              {canManageTeam
                                ? isId
                                  ? 'Undang kasir, stok, atau operasional'
                                  : 'Invite cashier, stock, or ops'
                                : isId
                                  ? 'Role Anda masih terbatas'
                                  : 'Your role is currently limited'}
                            </h4>
                            <p className="mt-2 text-sm leading-6 text-[color:var(--app-accent)]/78">
                              {canManageTeam
                                ? isId
                                  ? 'Backend sekarang menyimpan role per outlet. Owner bisa mulai membagi akses nyata, bukan cuma diskusi UI.'
                                  : 'The backend now stores outlet-level roles. Owners can start assigning real access, not just discussing UI.'
                                : isId
                                  ? 'Hanya owner outlet yang bisa menambah atau menonaktifkan akses tim pada MVP ini.'
                                  : 'Only the outlet owner can add or disable team access in this MVP.'}
                            </p>

                            {canManageTeam ? (
                              <form
                                onSubmit={submitTeamMember}
                                className="mt-5 space-y-4"
                              >
                                <TextInput
                                  label={isId ? 'Nama anggota' : 'Member name'}
                                  name="team_member_name"
                                  value={teamForm.name}
                                  onChange={event =>
                                    setTeamForm(current => ({
                                      ...current,
                                      name: event.target.value,
                                    }))
                                  }
                                  autoComplete="name"
                                  maxLength={TEAM_LIMITS.name}
                                  placeholder={
                                    isId
                                      ? 'Contoh: Rina Kasir Pagi'
                                      : 'Example: Rina Morning Cashier'
                                  }
                                  required
                                />
                                <TextInput
                                  label={isId ? 'Email login' : 'Login email'}
                                  type="email"
                                  name="team_member_email"
                                  value={teamForm.email}
                                  onChange={event =>
                                    setTeamForm(current => ({
                                      ...current,
                                      email: event.target.value,
                                    }))
                                  }
                                  autoComplete="email"
                                  maxLength={TEAM_LIMITS.email}
                                  placeholder="staff@usaha.com"
                                  required
                                />
                                <SelectInput
                                  label={isId ? 'Role outlet' : 'Outlet role'}
                                  value={teamForm.role}
                                  onChange={event =>
                                    setTeamForm(current => ({
                                      ...current,
                                      role: event.target
                                        .value as TeamMemberRecord['role'],
                                    }))
                                  }
                                >
                                  <option value="cashier">
                                    {isId ? 'Kasir' : 'Cashier'}
                                  </option>
                                  <option value="stock">
                                    {isId
                                      ? 'Stok / katalog'
                                      : 'Stock / catalog'}
                                  </option>
                                  <option value="ops">
                                    {isId
                                      ? 'Operasional outlet'
                                      : 'Outlet operations'}
                                  </option>
                                  <option value="manager">
                                    {isId ? 'Manager outlet' : 'Outlet manager'}
                                  </option>
                                  <option value="finance">
                                    {isId ? 'Keuangan' : 'Finance'}
                                  </option>
                                </SelectInput>
                                <TextArea
                                  label={isId ? 'Catatan akses' : 'Access note'}
                                  name="team_member_notes"
                                  value={teamForm.notes}
                                  onChange={event =>
                                    setTeamForm(current => ({
                                      ...current,
                                      notes: event.target.value,
                                    }))
                                  }
                                  maxLength={TEAM_LIMITS.notes}
                                  placeholder={
                                    isId
                                      ? 'Contoh: shift pagi, khusus outlet Tebet, fokus checkout & bill'
                                      : 'Example: morning shift, Tebet outlet only, focused on checkout & billing'
                                  }
                                />
                                <button
                                  type="submit"
                                  disabled={submittingTeamMember}
                                  className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-bold disabled:opacity-60"
                                >
                                  {submittingTeamMember ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <ShieldCheck className="h-4 w-4" />
                                  )}
                                  {isId
                                    ? 'Simpan akses tim'
                                    : 'Save team access'}
                                </button>
                              </form>
                            ) : (
                              <div className="mt-5 rounded-[24px] border border-[color:var(--app-accent-border)] bg-white px-4 py-4 text-sm text-[color:var(--app-accent)]">
                                {isId
                                  ? 'Anda masih bisa melihat roster dan pembagian role, tetapi perubahan akses perlu dilakukan oleh owner outlet.'
                                  : 'You can still review the roster and role split, but access changes must be made by the outlet owner.'}
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="mt-6">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                {isId
                                  ? 'Blueprint role MVP'
                                  : 'MVP role blueprint'}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-[color:var(--app-accent)]/78">
                                {isId
                                  ? 'Baseline akses untuk backend dan FE.'
                                  : 'This is the baseline access structure keeping backend and frontend aligned.'}
                              </p>
                            </div>
                          </div>

                          <div className="mt-4 grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
                            {teamBlueprints.map(role => (
                              <RoleBlueprintCard
                                key={role.title}
                                icon={role.icon}
                                title={role.title}
                                scope={role.scope}
                                desc={role.desc}
                                permissions={role.permissions}
                                tone={role.tone}
                              />
                            ))}
                          </div>
                        </div>

                        <div className="mt-5 rounded-[30px] border border-[color:var(--app-accent-border)] bg-[linear-gradient(135deg,rgba(255,249,241,0.92),rgba(255,255,255,0.98))] p-5 text-[color:var(--app-accent)] shadow-sm">
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div>
                              <p className="text-[11px] font-black uppercase tracking-[0.16em]">
                                {isId
                                  ? 'Cara pakai MVP sekarang'
                                  : 'How to use this MVP today'}
                              </p>
                              <p className="mt-2 text-sm leading-6 text-[color:var(--app-accent)]/78">
                                {isId
                                  ? 'Owner pegang semua outlet. Tim cukup pegang area kerja.'
                                  : 'The owner keeps full business control. Cashier, stock, and ops should each get a narrow outlet-specific workspace so this dashboard remains useful from morning until closing.'}
                              </p>
                            </div>
                            <button
                              type="button"
                              onClick={() => scrollToSection('umkm-orders')}
                              className="ui-button-secondary ui-button-compact px-4 text-xs font-bold"
                            >
                              {isId ? 'Lihat alur kasir' : 'See cashier flow'}
                            </button>
                          </div>

                          <div className="mt-4 grid gap-3 md:grid-cols-3">
                            <div className="rounded-[24px] border border-[color:var(--app-accent-border)] bg-white px-4 py-4">
                              <p className="text-sm font-black">
                                {isId ? 'Per outlet dulu' : 'Start per outlet'}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                {isId
                                  ? 'Tim pilih satu outlet aktif lalu kerja dari situ.'
                                  : 'Cashiers and ops should not see every business. Choose one active outlet and work from there.'}
                              </p>
                            </div>
                            <div className="rounded-[24px] border border-[color:var(--app-accent-border)] bg-white px-4 py-4">
                              <p className="text-sm font-black">
                                {isId
                                  ? 'Bagi berdasarkan ritme kerja'
                                  : 'Split by work rhythm'}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                {isId
                                  ? 'Kasir fokus order dan pembayaran. Tim stok fokus katalog dan ketersediaan. Owner fokus trust, uang, dan ekspansi.'
                                  : 'Cashiers focus on orders and payments. Stock teams focus on catalog and availability. Owners focus on trust, money, and expansion.'}
                              </p>
                            </div>
                            <div className="rounded-[24px] border border-[color:var(--app-accent-border)] bg-white px-4 py-4">
                              <p className="text-sm font-black">
                                {isId
                                  ? 'Siapkan role matrix berikutnya'
                                  : 'Prepare the next role matrix'}
                              </p>
                              <p className="mt-2 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                {isId
                                  ? 'Tahap berikutnya adalah invite pegawai, akses per outlet, dan izin per modul. UI ini sudah menyiapkan strukturnya.'
                                  : 'The next stage is staff invites, outlet-level access, and module permissions. This UI already prepares the structure.'}
                              </p>
                            </div>
                          </div>
                        </div>
                      </SectionCard>
                    ) : null}

                    {isSetupDetailView &&
                      activeSetupDetailStep === 'publish' ? (
                      <SectionCard
                        id="umkm-verification"
                        title={isId ? 'Profil & publish' : 'Profile & publish'}
                        desc={
                          isId
                            ? 'Isi inti usaha dan dokumen penting dulu.'
                            : 'Complete the essentials and key documents first.'
                        }
                        action={
                          <button
                            type="button"
                            onClick={() => void saveVerification()}
                            disabled={verificationSaving}
                            className="ui-button-primary ui-button-compact inline-flex items-center gap-2 px-4 text-sm font-bold disabled:opacity-60"
                          >
                            {verificationSaving ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <ShieldCheck className="h-4 w-4" />
                            )}
                            {isId ? 'Simpan profil' : 'Save profile'}
                          </button>
                        }
                      >
                        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
                          <div className="space-y-6">
                            <div className="grid gap-4 md:grid-cols-2">
                              <SelectInput
                                label={
                                  isId
                                    ? 'Kategori utama usaha'
                                    : 'Primary business category'
                                }
                                value={verificationForm.business_type}
                                onChange={event => {
                                  const nextCategory = event.target
                                    .value as UmkmBusinessCategoryId;
                                  const nextServices =
                                    getUmkmRecommendedPublishServices(
                                      nextCategory,
                                    );
                                  setShowAdvancedVerificationCapabilities(
                                    false,
                                  );
                                  setVerificationForm(current => ({
                                    ...current,
                                    business_type: nextCategory,
                                    business_capabilities:
                                      getUmkmDefaultCapabilities(nextCategory),
                                    custom_fields:
                                      buildDefaultCustomFieldsForBusiness(
                                        nextCategory,
                                      ),
                                    publish_food: nextServices.includes('food'),
                                    publish_mart: nextServices.includes('mart'),
                                  }));
                                }}
                              >
                                {businessCategoryOptions.map(option => (
                                  <option key={option.id} value={option.id}>
                                    {isId ? option.labelId : option.labelEn}
                                  </option>
                                ))}
                              </SelectInput>

                              <SelectInput
                                label={isId ? 'Bentuk usaha' : 'Legal type'}
                                value={verificationForm.legal_type}
                                onChange={event =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    legal_type: event.target.value,
                                  }))
                                }
                              >
                                <option value="individual">
                                  {isId ? 'Perorangan' : 'Individual'}
                                </option>
                                <option value="company">
                                  {isId ? 'Perusahaan' : 'Company'}
                                </option>
                              </SelectInput>
                            </div>

                            <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_240px]">
                              <TextInput
                                label={
                                  isId
                                    ? 'Fokus usaha / niche'
                                    : 'Business focus / niche'
                                }
                                value={verificationForm.business_focus}
                                onChange={event =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    business_focus: event.target.value,
                                  }))
                                }
                                placeholder={businessFocusPlaceholder}
                              />
                              <TextInput
                                label={
                                  isId
                                    ? 'Tahun mulai usaha'
                                    : 'Business start year'
                                }
                                value={verificationForm.established_year}
                                onChange={event =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    established_year: event.target.value,
                                  }))
                                }
                                placeholder="2019"
                              />
                            </div>

                            <div className="rounded-[22px] border border-[color:var(--app-accent-border)] bg-white px-4 py-3 text-xs leading-5 text-[color:var(--app-accent)]/82">
                              <p className="font-semibold text-[color:var(--app-accent)]">
                                {getUmkmBusinessCategoryLabel(
                                  verificationForm.business_type,
                                  isId,
                                )}
                              </p>
                              <p className="mt-1">
                                {businessCategoryDescription}
                              </p>
                            </div>

                            <div className="rounded-[24px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-4 py-4 text-[color:var(--app-accent)]">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-black">
                                    {isId
                                      ? selectedManageProfile.labelId
                                      : selectedManageProfile.labelEn}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/78">
                                    {isId
                                      ? selectedManageProfile.summaryId
                                      : selectedManageProfile.summaryEn}
                                  </p>
                                </div>
                                <InlineBadge tone="accent">
                                  {isId ? 'Alur kerja' : 'Operating setup'}
                                </InlineBadge>
                              </div>

                              <div className="mt-4">
                                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/76">
                                  {isId
                                    ? 'Yang cocok buat usaha ini'
                                    : 'Relevant setup'}
                                </p>
                                <div className="mt-3 grid gap-3 md:grid-cols-2">
                                  {verificationPrimaryCapabilities.map(
                                    capability => {
                                      const active =
                                        verificationForm.business_capabilities.includes(
                                          capability,
                                        );
                                      return (
                                        <button
                                          key={capability}
                                          type="button"
                                          onClick={() =>
                                            toggleVerificationCapability(
                                              capability,
                                            )
                                          }
                                          className={cn(
                                            'rounded-2xl border px-3 py-3 text-left transition',
                                            active
                                              ? 'border-[color:var(--app-accent)] bg-white shadow-sm'
                                              : 'border-[color:var(--app-accent-border)] bg-transparent hover:border-[color:var(--app-accent)]/30',
                                          )}
                                        >
                                          <p className="text-sm font-bold text-[color:var(--app-accent)]">
                                            {getCapabilityLabel(
                                              capability,
                                              isId,
                                            )}
                                          </p>
                                          <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                            {getCapabilityDescription(
                                              capability,
                                              isId,
                                            )}
                                          </p>
                                        </button>
                                      );
                                    },
                                  )}
                                </div>

                                {verificationAdvancedCapabilities.length > 0 ? (
                                  <div className="mt-4">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setShowAdvancedVerificationCapabilities(
                                          current => !current,
                                        )
                                      }
                                      className="ui-button-secondary ui-button-compact px-3 text-xs font-bold"
                                    >
                                      {showAdvancedVerificationCapabilities
                                        ? isId
                                          ? 'Sembunyikan opsi lanjutan'
                                          : 'Hide advanced options'
                                        : isId
                                          ? 'Lihat opsi lanjutan'
                                          : 'Show advanced options'}
                                    </button>

                                    {showAdvancedVerificationCapabilities ? (
                                      <div className="mt-3 grid gap-3 rounded-[22px] border border-dashed border-[color:var(--app-accent-border)] bg-white p-4 md:grid-cols-2">
                                        {verificationAdvancedCapabilities.map(
                                          capability => {
                                            const active =
                                              verificationForm.business_capabilities.includes(
                                                capability,
                                              );
                                            return (
                                              <button
                                                key={capability}
                                                type="button"
                                                onClick={() =>
                                                  toggleVerificationCapability(
                                                    capability,
                                                  )
                                                }
                                                className={cn(
                                                  'rounded-2xl border px-3 py-3 text-left transition',
                                                  active
                                                    ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] shadow-sm'
                                                    : 'border-[color:var(--app-accent-border)] bg-transparent hover:border-[color:var(--app-accent)]/30',
                                                )}
                                              >
                                                <p className="text-sm font-bold text-[color:var(--app-accent)]">
                                                  {getCapabilityLabel(
                                                    capability,
                                                    isId,
                                                  )}
                                                </p>
                                                <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                                  {getCapabilityDescription(
                                                    capability,
                                                    isId,
                                                  )}
                                                </p>
                                              </button>
                                            );
                                          },
                                        )}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </div>

                            <div className="rounded-[24px] border border-[color:var(--app-accent-border)] bg-white px-4 py-4 text-[color:var(--app-accent)]">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-black">
                                    {isId
                                      ? 'Mode lokasi & status live'
                                      : 'Location mode & live status'}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                    {isId
                                      ? 'Pakai mode ini untuk usaha yang titik jualnya tetap atau ikut berpindah. Cocok untuk pedagang kaki lima, food truck, booth bazaar, dan seller event.'
                                      : 'Use this to separate fixed-base businesses from moving sellers such as street vendors, food trucks, and event booths.'}
                                  </p>
                                </div>
                                <InlineBadge
                                  tone={
                                    verificationPresencePreview.liveNow
                                      ? 'success'
                                      : 'default'
                                  }
                                >
                                  {verificationLiveStatusLabel}
                                </InlineBadge>
                              </div>

                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                {(['fixed', 'mobile'] as const).map(mode => {
                                  const active =
                                    verificationForm.location_mode === mode;
                                  return (
                                    <button
                                      key={mode}
                                      type="button"
                                      onClick={() =>
                                        setVerificationForm(current => ({
                                          ...current,
                                          location_mode: mode,
                                        }))
                                      }
                                      className={cn(
                                        'rounded-2xl border px-4 py-4 text-left transition',
                                        active
                                          ? 'border-[color:var(--app-accent)] bg-[color:var(--app-accent-soft)] shadow-sm'
                                          : 'border-[color:var(--app-accent-border)] bg-white hover:border-[color:var(--app-accent)]/35',
                                      )}
                                    >
                                      <div className="flex items-center gap-2">
                                        {mode === 'fixed' ? (
                                          <Store className="h-4 w-4" />
                                        ) : (
                                          <ArrowRightLeft className="h-4 w-4" />
                                        )}
                                        <p className="text-sm font-bold">
                                          {getUmkmLocationModeLabel(mode, isId)}
                                        </p>
                                      </div>
                                      <p className="mt-2 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                        {getUmkmLocationModeHint(mode, isId)}
                                      </p>
                                    </button>
                                  );
                                })}
                              </div>

                              <div className="mt-4 grid gap-3 md:grid-cols-2">
                                <Toggle
                                  checked={verificationForm.outlet_active}
                                  onChange={next =>
                                    setVerificationForm(current => ({
                                      ...current,
                                      outlet_active: next,
                                    }))
                                  }
                                  label={
                                    isId
                                      ? 'Usaha / unit aktif'
                                      : 'Active business / unit'
                                  }
                                  desc={
                                    isId
                                      ? 'Akun usaha siap tampil dan menerima order.'
                                      : 'This business is visible and ready to receive orders.'
                                  }
                                />
                                <Toggle
                                  checked={
                                    verificationForm.auto_live_schedule_enabled
                                  }
                                  onChange={next =>
                                    setVerificationForm(current => ({
                                      ...current,
                                      auto_live_schedule_enabled: next,
                                    }))
                                  }
                                  label={
                                    isId
                                      ? 'Atur on/off otomatis'
                                      : 'Automatic on/off schedule'
                                  }
                                  desc={
                                    isId
                                      ? 'Status live mengikuti hari dan jam yang Anda tentukan.'
                                      : 'Live status follows the day and time window you set.'
                                  }
                                />
                              </div>

                              {verificationForm.auto_live_schedule_enabled ? (
                                <div className="mt-4 rounded-[22px] border border-dashed border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] p-4">
                                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/76">
                                    {isId ? 'Jadwal live' : 'Live schedule'}
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {UMKM_LIVE_SCHEDULE_DAY_OPTIONS.map(day => {
                                      const active =
                                        verificationForm.live_schedule_days.includes(
                                          day.id,
                                        );
                                      return (
                                        <button
                                          key={day.id}
                                          type="button"
                                          onClick={() =>
                                            toggleVerificationScheduleDay(
                                              day.id,
                                            )
                                          }
                                          className={cn(
                                            'inline-flex min-h-[36px] items-center rounded-full border px-3 text-xs font-bold transition',
                                            active
                                              ? 'border-[color:var(--app-accent)] bg-white text-[color:var(--app-accent)]'
                                              : 'border-[color:var(--app-accent-border)] bg-transparent text-[color:var(--app-accent)]/76',
                                          )}
                                        >
                                          {isId ? day.shortId : day.shortEn}
                                        </button>
                                      );
                                    })}
                                  </div>
                                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                                    <TextInput
                                      label={isId ? 'Mulai live' : 'Start time'}
                                      type="time"
                                      value={
                                        verificationForm.live_schedule_start
                                      }
                                      onChange={event =>
                                        setVerificationForm(current => ({
                                          ...current,
                                          live_schedule_start:
                                            event.target.value,
                                        }))
                                      }
                                    />
                                    <TextInput
                                      label={isId ? 'Selesai live' : 'End time'}
                                      type="time"
                                      value={verificationForm.live_schedule_end}
                                      onChange={event =>
                                        setVerificationForm(current => ({
                                          ...current,
                                          live_schedule_end: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>
                                  {verificationScheduleSummary ? (
                                    <p className="mt-3 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                      {isId ? 'Ringkasan: ' : 'Summary: '}
                                      {verificationScheduleSummary}
                                    </p>
                                  ) : null}
                                </div>
                              ) : null}

                              <div className="mt-4 rounded-[24px] border border-[color:var(--app-accent-border)] bg-white px-4 py-4 text-[color:var(--app-accent)]">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-black">
                                      {verificationForm.location_mode ===
                                        'mobile'
                                        ? isId
                                          ? 'Titik live usaha'
                                          : 'Live business point'
                                        : isId
                                          ? 'Pin lokasi usaha'
                                          : 'Business location pin'}
                                    </p>
                                    <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                      {isId
                                        ? 'Tap peta atau geser marker untuk memperbarui posisi usaha.'
                                        : 'Tap the map or drag the marker to update the business point.'}
                                    </p>
                                  </div>
                                  <InlineBadge tone="accent">
                                    {verificationLocationPoint
                                      ? `${verificationLocationPoint.lat.toFixed(6)}, ${verificationLocationPoint.lng.toFixed(6)}`
                                      : isId
                                        ? 'Belum ada titik'
                                        : 'No point yet'}
                                  </InlineBadge>
                                </div>

                                <div className="mt-4">
                                  <UmkmLocationPicker
                                    value={verificationLocationPoint}
                                    onChange={point =>
                                      setVerificationCoords(
                                        point.lat.toFixed(6),
                                        point.lng.toFixed(6),
                                      )
                                    }
                                    isId={isId}
                                    markerLabel={
                                      verificationForm.location_mode ===
                                        'mobile'
                                        ? isId
                                          ? 'Titik live usaha'
                                          : 'Live business point'
                                        : isId
                                          ? 'Lokasi usaha'
                                          : 'Business location'
                                    }
                                  />
                                </div>

                                <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-semibold text-[color:var(--app-accent)]/80">
                                  <span className="rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1.5">
                                    {isId ? 'Lat' : 'Lat'}:{' '}
                                    {verificationForm.lat}
                                  </span>
                                  <span className="rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1.5">
                                    {isId ? 'Lng' : 'Lng'}:{' '}
                                    {verificationForm.lng}
                                  </span>
                                </div>
                              </div>

                              <div className="mt-4 flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() =>
                                    fillCurrentCoords('verification')
                                  }
                                  className="ui-button-secondary ui-button-compact inline-flex items-center gap-2 px-3 text-xs font-bold"
                                >
                                  <MapPinned className="h-3.5 w-3.5" />
                                  {isId
                                    ? 'Pakai titik saya sekarang'
                                    : 'Use my current point'}
                                </button>
                                {verificationForm.location_mode === 'mobile' ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setLiveLocationSharing(
                                        current => !current,
                                      )
                                    }
                                    disabled={!canShareLiveLocation}
                                    className="ui-button-secondary ui-button-compact inline-flex items-center gap-2 px-3 text-xs font-bold disabled:opacity-60"
                                  >
                                    <ArrowRightLeft className="h-3.5 w-3.5" />
                                    {liveLocationSharing
                                      ? isId
                                        ? 'Stop live tracking'
                                        : 'Stop live tracking'
                                      : isId
                                        ? 'Share lokasi live'
                                        : 'Share live location'}
                                  </button>
                                ) : null}
                              </div>

                              <div className="mt-3 rounded-[20px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-4 py-3 text-xs leading-5 text-[color:var(--app-accent)]/78">
                                <p className="font-semibold text-[color:var(--app-accent)]">
                                  {verificationLocationModeLabel}
                                </p>
                                <p className="mt-1">
                                  {verificationLocationModeHint}
                                </p>
                                {liveLocationMessage ? (
                                  <p className="mt-2">{liveLocationMessage}</p>
                                ) : null}
                                {verificationForm.location_mode === 'mobile' &&
                                  !canShareLiveLocation ? (
                                  <p className="mt-2">
                                    {isId
                                      ? 'Agar titik bisa ikut bergerak, aktifkan dulu usaha lalu nyalakan status live.'
                                      : 'To keep the marker moving, activate the business first and turn live status on.'}
                                  </p>
                                ) : null}
                              </div>
                            </div>

                            <div className="grid gap-3 sm:grid-cols-2">
                              <Toggle
                                checked={verificationForm.live_now}
                                onChange={next =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    live_now: next,
                                  }))
                                }
                                label={
                                  isId
                                    ? 'Sedang jualan / live'
                                    : 'Currently selling / live'
                                }
                                desc={
                                  verificationForm.location_mode === 'mobile'
                                    ? isId
                                      ? 'Tampilkan usaha ini sebagai titik jual aktif yang bisa ikut bergerak.'
                                      : 'Show this business as an active selling point that can keep moving.'
                                    : isId
                                      ? 'Tandai usaha ini sedang buka sekarang.'
                                      : 'Mark this business as currently open.'
                                }
                              />
                              {canUseFoodChannel || canUseMartChannel ? (
                                <div className="grid gap-3">
                                  {canUseFoodChannel ? (
                                    <Toggle
                                      checked={verificationForm.publish_food}
                                      onChange={next =>
                                        setVerificationForm(current => ({
                                          ...current,
                                          publish_food: next,
                                        }))
                                      }
                                      label={
                                        isId
                                          ? 'Aktifkan kanal Food'
                                          : 'Enable Food channel'
                                      }
                                      desc={
                                        isId
                                          ? 'Untuk kuliner siap santap, minuman, atau menu yang dikirim cepat.'
                                          : 'For ready-to-eat meals, drinks, or fast-delivery menus.'
                                      }
                                    />
                                  ) : null}
                                  {canUseMartChannel ? (
                                    <Toggle
                                      checked={verificationForm.publish_mart}
                                      onChange={next =>
                                        setVerificationForm(current => ({
                                          ...current,
                                          publish_mart: next,
                                        }))
                                      }
                                      label={
                                        isId
                                          ? 'Aktifkan kanal Mart'
                                          : 'Enable Mart channel'
                                      }
                                      desc={
                                        isId
                                          ? 'Untuk retail, paket produk, grosir, kriya, dan barang siap jual.'
                                          : 'For retail, packaged goods, wholesale, crafts, and ready-to-sell items.'
                                      }
                                    />
                                  ) : null}
                                </div>
                              ) : (
                                <div className="rounded-2xl border border-dashed border-[color:var(--app-accent-border)] bg-white px-4 py-4 text-xs leading-5 text-[color:var(--app-accent)]/78">
                                  {isId
                                    ? 'Kategori ini nggak wajib masuk Food/Mart. Kamu tetap bisa fokus ke booking, brief, atau delivery digital.'
                                    : 'This category does not need Food/Mart by default. You can keep the flow focused on bookings, briefs, or digital delivery.'}
                                </div>
                              )}
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              <TextInput
                                label={
                                  isId
                                    ? 'Nama pemilik / PIC usaha'
                                    : 'Owner / business PIC'
                                }
                                value={verificationForm.owner_name}
                                onChange={event =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    owner_name: event.target.value,
                                  }))
                                }
                                placeholder={
                                  isId ? 'Contoh: Fauzan' : 'Example: Fauzan'
                                }
                              />
                              <TextInput
                                label={isId ? 'Email pemilik' : 'Owner email'}
                                value={verificationForm.owner_email}
                                onChange={event =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    owner_email: event.target.value,
                                  }))
                                }
                                placeholder="owner@email.com"
                              />
                              <TextInput
                                label={isId ? 'HP pemilik' : 'Owner phone'}
                                value={verificationForm.owner_phone}
                                onChange={event =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    owner_phone: event.target.value,
                                  }))
                                }
                                placeholder="08xxxxxxxxxx"
                              />
                              <TextInput
                                label={
                                  isId
                                    ? 'Telepon usaha / unit'
                                    : 'Business / unit phone'
                                }
                                value={verificationForm.outlet_phone}
                                onChange={event =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    outlet_phone: event.target.value,
                                  }))
                                }
                                placeholder="08xxxxxxxxxx"
                              />
                              <TextInput
                                label={isId ? 'Nomor KTP' : 'ID number'}
                                value={verificationForm.ktp_number}
                                onChange={event =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    ktp_number: event.target.value,
                                  }))
                                }
                              />
                            </div>

                            <div className="grid gap-4 md:grid-cols-3">
                              <TextInput
                                label={isId ? 'Nama bank' : 'Bank name'}
                                value={verificationForm.bank_name}
                                onChange={event =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    bank_name: event.target.value,
                                  }))
                                }
                              />
                              <TextInput
                                label={isId ? 'Nama rekening' : 'Account name'}
                                value={verificationForm.bank_account_name}
                                onChange={event =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    bank_account_name: event.target.value,
                                  }))
                                }
                              />
                              <TextInput
                                label={
                                  isId ? 'Nomor rekening' : 'Account number'
                                }
                                value={verificationForm.bank_account_number}
                                onChange={event =>
                                  setVerificationForm(current => ({
                                    ...current,
                                    bank_account_number: event.target.value,
                                  }))
                                }
                              />
                            </div>

                            {verificationForm.legal_type === 'company' ? (
                              <div className="grid gap-4 md:grid-cols-2">
                                <TextInput
                                  label={isId ? 'Nomor NPWP' : 'NPWP number'}
                                  value={verificationForm.npwp_number}
                                  onChange={event =>
                                    setVerificationForm(current => ({
                                      ...current,
                                      npwp_number: event.target.value,
                                    }))
                                  }
                                />
                                <div className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 text-xs  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                  {isId
                                    ? 'Perusahaan wajib melengkapi NPWP, NIB/SIUP, akta, dan identitas direksi.'
                                    : 'Companies must complete NPWP, business license, deed, and director ID.'}
                                </div>
                              </div>
                            ) : null}

                            <div className="rounded-[24px] border border-[color:var(--app-accent-border)] bg-white px-4 py-4 text-[color:var(--app-accent)]">
                              <div className="flex flex-wrap items-start justify-between gap-3">
                                <div>
                                  <p className="text-sm font-black">
                                    {isId
                                      ? 'Kebutuhan custom per usaha'
                                      : 'Custom business requirements'}
                                  </p>
                                  <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                    {isId
                                      ? 'Tambahkan field yang benar-benar dibutuhkan.'
                                      : 'Add the fields your buyers or ops team actually need. This keeps service businesses away from retail-only forms and retail away from service-only flow.'}
                                  </p>
                                </div>
                                <InlineBadge tone="accent">
                                  {selectedCustomFields.length}{' '}
                                  {isId ? 'field' : 'fields'}
                                </InlineBadge>
                              </div>

                              {getUmkmManageProfile(
                                verificationForm.business_type,
                              ).suggestedCustomFields.length > 0 ? (
                                <div className="mt-4">
                                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-[color:var(--app-accent)]/76">
                                    {isId
                                      ? 'Saran praktis'
                                      : 'Quick suggestions'}
                                  </p>
                                  <div className="mt-2 flex flex-wrap gap-2">
                                    {getUmkmManageProfile(
                                      verificationForm.business_type,
                                    ).suggestedCustomFields.map(field => {
                                      const alreadyAdded =
                                        verificationForm.custom_fields.some(
                                          item => item.id === field.id,
                                        );
                                      return (
                                        <button
                                          key={field.id}
                                          type="button"
                                          disabled={alreadyAdded}
                                          onClick={() =>
                                            addSuggestedCustomField(field)
                                          }
                                          className={cn(
                                            'inline-flex min-h-[36px] items-center rounded-full border px-3 text-xs font-bold transition',
                                            alreadyAdded
                                              ? 'border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] text-[color:var(--app-accent)]'
                                              : 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] hover:border-[color:var(--app-accent)]/35',
                                          )}
                                        >
                                          {alreadyAdded
                                            ? isId
                                              ? 'Sudah ada:'
                                              : 'Added:'
                                            : '+'}{' '}
                                          {field.label}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ) : null}

                              <div className="mt-4 grid gap-4 md:grid-cols-2">
                                <TextInput
                                  label={isId ? 'Label field' : 'Field label'}
                                  value={customFieldDraft.label}
                                  onChange={event =>
                                    setCustomFieldDraft(current => ({
                                      ...current,
                                      label: event.target.value,
                                    }))
                                  }
                                  placeholder={
                                    isId
                                      ? 'Contoh: Ukuran kendaraan'
                                      : 'Example: Vehicle size'
                                  }
                                />
                                <SelectInput
                                  label={isId ? 'Dipakai untuk' : 'Used for'}
                                  value={customFieldDraft.scope}
                                  onChange={event =>
                                    setCustomFieldDraft(current => ({
                                      ...current,
                                      scope: event.target
                                        .value as UmkmCustomFieldScope,
                                    }))
                                  }
                                >
                                  <option value="listing">
                                    {isId ? 'Info listing' : 'Listing info'}
                                  </option>
                                  <option value="booking">
                                    {isId
                                      ? 'Booking / reservasi'
                                      : 'Booking / reservation'}
                                  </option>
                                  <option value="order">
                                    {isId
                                      ? 'Checkout / order'
                                      : 'Checkout / order'}
                                  </option>
                                </SelectInput>
                                <SelectInput
                                  label={isId ? 'Tipe field' : 'Field type'}
                                  value={customFieldDraft.type}
                                  onChange={event =>
                                    setCustomFieldDraft(current => ({
                                      ...current,
                                      type: event.target
                                        .value as UmkmCustomFieldType,
                                    }))
                                  }
                                >
                                  <option value="text">
                                    {isId ? 'Teks singkat' : 'Short text'}
                                  </option>
                                  <option value="textarea">
                                    {isId ? 'Teks panjang' : 'Long text'}
                                  </option>
                                  <option value="number">
                                    {isId ? 'Angka' : 'Number'}
                                  </option>
                                  <option value="select">
                                    {isId ? 'Pilihan' : 'Select'}
                                  </option>
                                  <option value="date">
                                    {isId ? 'Tanggal / waktu' : 'Date / time'}
                                  </option>
                                  <option value="toggle">
                                    {isId ? 'Ya / tidak' : 'Yes / no'}
                                  </option>
                                </SelectInput>
                                <TextInput
                                  label={
                                    isId
                                      ? 'Opsi pilihan (pisah koma)'
                                      : 'Options (comma separated)'
                                  }
                                  value={customFieldDraft.options}
                                  onChange={event =>
                                    setCustomFieldDraft(current => ({
                                      ...current,
                                      options: event.target.value,
                                    }))
                                  }
                                  placeholder={isId ? 'S, M, L' : 'S, M, L'}
                                />
                              </div>

                              <div className="mt-4 grid gap-4 md:grid-cols-[minmax(0,1fr)_180px]">
                                <TextArea
                                  label={isId ? 'Catatan bantu' : 'Helper note'}
                                  value={customFieldDraft.help}
                                  onChange={event =>
                                    setCustomFieldDraft(current => ({
                                      ...current,
                                      help: event.target.value,
                                    }))
                                  }
                                  placeholder={
                                    isId
                                      ? 'Contoh: isi dengan detail unit, ukuran, atau preferensi buyer'
                                      : 'Example: describe what the buyer should fill in'
                                  }
                                />
                                <div className="grid gap-3 self-start">
                                  <Toggle
                                    checked={customFieldDraft.required}
                                    onChange={next =>
                                      setCustomFieldDraft(current => ({
                                        ...current,
                                        required: next,
                                      }))
                                    }
                                    label={isId ? 'Wajib diisi' : 'Required'}
                                  />
                                  <button
                                    type="button"
                                    onClick={addCustomField}
                                    className="ui-button-secondary inline-flex items-center justify-center px-4 text-sm font-bold"
                                  >
                                    {isId ? 'Tambah field' : 'Add field'}
                                  </button>
                                </div>
                              </div>

                              <div className="mt-4 grid gap-3">
                                {verificationForm.custom_fields.length === 0 ? (
                                  <div className="rounded-2xl border border-dashed border-[color:var(--app-accent-border)] px-4 py-4 text-xs leading-5 text-[color:var(--app-accent)]/72">
                                    {isId
                                      ? 'Belum ada field custom. Pakai saran cepat atau tambahkan kebutuhan sendiri.'
                                      : 'No custom fields yet. Use a quick suggestion or add your own requirements.'}
                                  </div>
                                ) : (
                                  verificationForm.custom_fields.map(field => (
                                    <div
                                      key={field.id}
                                      className="rounded-2xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-4 py-3"
                                    >
                                      <div className="flex flex-wrap items-start justify-between gap-3">
                                        <div className="min-w-0">
                                          <div className="flex flex-wrap gap-2">
                                            <InlineBadge tone="default">
                                              {field.scope}
                                            </InlineBadge>
                                            <InlineBadge tone="default">
                                              {field.type}
                                            </InlineBadge>
                                            {field.required ? (
                                              <InlineBadge tone="warning">
                                                {isId ? 'Wajib' : 'Required'}
                                              </InlineBadge>
                                            ) : null}
                                          </div>
                                          <p className="mt-2 text-sm font-bold text-[color:var(--app-accent)]">
                                            {field.label}
                                          </p>
                                          {field.help ? (
                                            <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/74">
                                              {field.help}
                                            </p>
                                          ) : null}
                                          {field.options &&
                                            field.options.length > 0 ? (
                                            <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/72">
                                              {field.options.join(' / ')}
                                            </p>
                                          ) : null}
                                        </div>
                                        <button
                                          type="button"
                                          onClick={() =>
                                            removeCustomField(field.id)
                                          }
                                          className="ui-button-secondary ui-button-compact px-3 text-xs font-bold"
                                        >
                                          {isId ? 'Hapus' : 'Remove'}
                                        </button>
                                      </div>
                                    </div>
                                  ))
                                )}
                              </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-2">
                              {[
                                {
                                  key: 'ktp_url',
                                  label: isId
                                    ? 'Upload foto KTP'
                                    : 'Upload ID photo',
                                  type: 'image' as const,
                                },
                                {
                                  key: 'store_photo_url',
                                  label: isId
                                    ? 'Upload foto usaha / workshop / studio'
                                    : 'Upload business / workshop / studio photo',
                                  type: 'image' as const,
                                },
                                {
                                  key: 'menu_photo_url',
                                  label: isId
                                    ? 'Upload foto produk / menu utama'
                                    : 'Upload key product / menu photo',
                                  type: 'image' as const,
                                },
                                {
                                  key: 'bank_proof_url',
                                  label: isId
                                    ? 'Upload bukti rekening'
                                    : 'Upload bank proof',
                                  type: 'document' as const,
                                },
                                {
                                  key: 'npwp_url',
                                  label: isId ? 'Upload NPWP' : 'Upload NPWP',
                                  type: 'document' as const,
                                },
                                {
                                  key: 'business_license_url',
                                  label: isId
                                    ? 'Upload NIB/SIUP'
                                    : 'Upload business license',
                                  type: 'document' as const,
                                },
                                {
                                  key: 'deed_url',
                                  label: isId
                                    ? 'Upload akta pendirian'
                                    : 'Upload deed',
                                  type: 'document' as const,
                                },
                                {
                                  key: 'director_id_url',
                                  label: isId
                                    ? 'Upload KTP direksi'
                                    : 'Upload director ID',
                                  type: 'document' as const,
                                },
                              ].map(item => {
                                const currentValue =
                                  verificationForm[
                                  item.key as keyof typeof verificationForm
                                  ];

                                return (
                                  <div
                                    key={item.key}
                                    className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                  >
                                    <p className="text-sm font-bold  text-[color:var(--app-accent)]">
                                      {item.label}
                                    </p>
                                    <label className="mt-3 inline-flex min-h-[42px] cursor-pointer items-center gap-2 rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 text-sm font-bold  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                      {uploadingKey === item.key ? (
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                      ) : (
                                        <UploadCloud className="h-4 w-4" />
                                      )}
                                      {isId ? 'Pilih file' : 'Choose file'}
                                      <input
                                        type="file"
                                        className="hidden"
                                        accept={
                                          item.type === 'image'
                                            ? 'image/*'
                                            : '.pdf,.jpg,.jpeg,.png,.doc,.docx'
                                        }
                                        onChange={event => {
                                          const file =
                                            event.target.files?.[0] || null;
                                          void handleUpload(
                                            item.key,
                                            file,
                                            item.type,
                                            url => {
                                              setVerificationForm(current => ({
                                                ...current,
                                                [item.key]: url,
                                              }));
                                            },
                                          );
                                        }}
                                      />
                                    </label>
                                    {typeof currentValue === 'string' &&
                                      currentValue ? (
                                      <p className="mt-2 break-all text-xs  text-[color:var(--app-accent)]">
                                        {currentValue}
                                      </p>
                                    ) : (
                                      <p className="mt-2 text-xs  text-[color:var(--app-accent)]">
                                        {isId
                                          ? 'Belum ada file'
                                          : 'No file uploaded yet'}
                                      </p>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          </div>

                          <div className="space-y-4">
                            {canUseFoodChannel ? (
                              <div className="rounded-3xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em]  text-[color:var(--app-accent)]">
                                  {isId
                                    ? 'Kesiapan kanal Food'
                                    : 'Food channel readiness'}
                                </p>
                                <p className="mt-2 text-lg font-black  text-[color:var(--app-accent)]">
                                  {publishReadiness.food.ok
                                    ? isId
                                      ? 'Siap publish'
                                      : 'Ready to publish'
                                    : isId
                                      ? 'Belum lengkap'
                                      : 'Incomplete'}
                                </p>
                                {publishReadiness.food.missing.length > 0 ? (
                                  <ul className="mt-3 space-y-1 text-xs  text-[color:var(--app-accent)]">
                                    {publishReadiness.food.missing
                                      .slice(0, 8)
                                      .map(item => (
                                        <li key={item}>• {item}</li>
                                      ))}
                                  </ul>
                                ) : null}
                              </div>
                            ) : null}

                            {canUseMartChannel ? (
                              <div className="rounded-3xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em]  text-[color:var(--app-accent)]">
                                  {isId
                                    ? 'Kesiapan kanal Mart'
                                    : 'Mart channel readiness'}
                                </p>
                                <p className="mt-2 text-lg font-black  text-[color:var(--app-accent)]">
                                  {publishReadiness.mart.ok
                                    ? isId
                                      ? 'Siap publish'
                                      : 'Ready to publish'
                                    : isId
                                      ? 'Belum lengkap'
                                      : 'Incomplete'}
                                </p>
                                {publishReadiness.mart.missing.length > 0 ? (
                                  <ul className="mt-3 space-y-1 text-xs  text-[color:var(--app-accent)]">
                                    {publishReadiness.mart.missing
                                      .slice(0, 8)
                                      .map(item => (
                                        <li key={item}>• {item}</li>
                                      ))}
                                  </ul>
                                ) : null}
                              </div>
                            ) : null}

                            {!canUseFoodChannel && !canUseMartChannel ? (
                              <div className="rounded-3xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4">
                                <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                  {isId ? 'Model publish' : 'Publish model'}
                                </p>
                                <p className="mt-2 text-lg font-black text-[color:var(--app-accent)]">
                                  {isId
                                    ? 'Booking / brief dulu'
                                    : 'Booking / brief first'}
                                </p>
                                <p className="mt-3 text-xs leading-5 text-[color:var(--app-accent)]/76">
                                  {isId
                                    ? 'Jasa/digital cukup pakai brief, slot, delivery.'
                                    : 'Service and digital businesses do not need to be forced into Food/Mart. Clean up briefs, slots, and delivery first.'}
                                </p>
                              </div>
                            ) : null}

                            <div className="rounded-3xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                              <p className="text-[11px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]">
                                {isId
                                  ? 'Kanal publish aktif'
                                  : 'Active publish channels'}
                              </p>
                              <div className="mt-3 flex flex-wrap gap-2">
                                {verificationPublishServices.length > 0 ? (
                                  verificationPublishServices.map(service => (
                                    <span
                                      key={service}
                                      className="rounded-full border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-1 text-xs font-bold  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                    >
                                      {getUmkmPublishServiceLabel(
                                        service,
                                        isId,
                                      )}
                                    </span>
                                  ))
                                ) : (
                                  <span className="text-xs  text-[color:var(--app-accent)]">
                                    {isId
                                      ? 'Belum ada kanal publish aktif'
                                      : 'No publish channels active yet'}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      </SectionCard>
                    ) : null}

                    {isSetupDetailView && activeSetupDetailStep === 'next' ? (
                      <SectionCard
                        id="umkm-setup-next"
                        title={
                          isId ? 'Langkah berikutnya' : 'Next business step'
                        }
                        desc={
                          isId
                            ? 'Profil tidak perlu sempurna dulu. Kalau info inti sudah cukup, lanjutkan ke katalog atau lihat tampilan pembeli.'
                            : 'The profile does not need to be perfect first. Once the core is good enough, continue to catalog or preview the buyer view.'
                        }
                        action={
                          <InlineBadge
                            tone={products.length > 0 ? 'success' : 'warning'}
                          >
                            {products.length > 0
                              ? isId
                                ? 'Sudah ada jualan'
                                : 'Listings ready'
                              : isId
                                ? 'Butuh jualan pertama'
                                : 'Needs first listing'}
                          </InlineBadge>
                        }
                      >
                        <div className="grid gap-3 md:grid-cols-3">
                          <Link
                            href={buildWorkspaceHref(
                              'catalog',
                              selectedStore.id,
                            )}
                            className="rounded-[22px] border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent)] px-4 py-4 text-white shadow-[0_18px_32px_-26px_rgba(15,23,42,0.3)] transition hover:-translate-y-0.5"
                          >
                            <PackagePlus className="h-5 w-5" />
                            <p className="mt-3 text-sm font-black">
                              {isId ? 'Tambah jualan' : 'Add listing'}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-white/82">
                              {isId
                                ? 'Masuk ke katalog dan buat produk pertama.'
                                : 'Open the catalog and create the first product.'}
                            </p>
                          </Link>
                          <Link
                            href={buildUmkmStorefrontPath(selectedStore.slug)}
                            className="rounded-[22px] border border-[color:var(--app-accent-border)] bg-white px-4 py-4 text-[color:var(--app-accent)] shadow-[0_14px_26px_-24px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5"
                          >
                            <Store className="h-5 w-5" />
                            <p className="mt-3 text-sm font-black">
                              {storefrontActionLabel}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/76">
                              {isId
                                ? 'Cek tampilan yang akan dilihat pembeli.'
                                : 'Preview what buyers will see.'}
                            </p>
                          </Link>
                          <button
                            type="button"
                            onClick={() =>
                              openSetupDetailStep(
                                products.length > 0 ? 'summary' : 'basic',
                              )
                            }
                            className="rounded-[22px] border border-[color:var(--app-accent-border)] bg-white px-4 py-4 text-left text-[color:var(--app-accent)] shadow-[0_14px_26px_-24px_rgba(15,23,42,0.18)] transition hover:-translate-y-0.5"
                          >
                            <CheckCircle2 className="h-5 w-5" />
                            <p className="mt-3 text-sm font-black">
                              {isId ? 'Cek ulang' : 'Review again'}
                            </p>
                            <p className="mt-1 text-xs leading-5 text-[color:var(--app-accent)]/76">
                              {isId
                                ? 'Balik ke ringkasan atau lengkapi info yang masih kurang.'
                                : 'Return to the summary or fill the missing basics.'}
                            </p>
                          </button>
                        </div>
                      </SectionCard>
                    ) : null}

                    {currentWorkspace === 'catalog' ||
                      currentWorkspace === 'operations' ? (
                      <div className="grid gap-6 2xl:grid-cols-2">
                        {currentWorkspace === 'catalog' ? (
                          <SectionCard
                            id="umkm-products"
                            title={isId ? 'Tambah listing' : 'Create listing'}
                            desc={
                              isId
                                ? 'Isi yang inti dulu. Harga, channel, dan cara kirim bisa dirapikan di sini.'
                                : 'Start with the essentials. Price, channels, and delivery can all be cleaned up here.'
                            }
                          >
                            <form
                              onSubmit={submitProduct}
                              className="space-y-4"
                            >
                              <div className={manageFormHeroClass}>
                                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                                  <div className="max-w-2xl">
                                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-[color:var(--app-accent)]/68">
                                      {isId ? 'Listing cepat' : 'Quick listing'}
                                    </p>
                                    <h4 className="mt-1.5 text-lg font-black text-[color:var(--app-text)]">
                                      {isId
                                        ? 'Bikin listing yang cepat dipahami buyer'
                                        : 'Create a listing buyers can understand fast'}
                                    </h4>
                                    <p className="mt-1.5 text-[13px] leading-5 text-[color:var(--app-text-soft)]">
                                      {isId
                                        ? 'Nama jelas, harga jelas, dan cara belinya jelas. Yang lain bisa menyusul.'
                                        : 'Make the name, price, and buying flow clear first. Everything else can follow.'}
                                    </p>
                                  </div>

                                  <div className="grid gap-2 sm:grid-cols-3 xl:w-[420px]">
                                    {listingQuickCards.map(card => {
                                      const Icon = card.icon;
                                      return (
                                        <div
                                          key={card.key}
                                          className={manageInfoCardClass}
                                        >
                                          <div className="flex items-start justify-between gap-3">
                                            <span
                                              className={cn(
                                                'inline-flex h-9 w-9 items-center justify-center rounded-[14px]',
                                                card.done
                                                  ? 'bg-[color:var(--app-accent)] text-white'
                                                  : 'bg-white text-[color:var(--app-accent)] ring-1 ring-slate-200/80 dark:bg-slate-950 dark:ring-slate-800/80',
                                              )}
                                            >
                                              <Icon className="h-4 w-4" />
                                            </span>
                                            <InlineBadge
                                              tone={
                                                card.done
                                                  ? 'success'
                                                  : 'default'
                                              }
                                            >
                                              {card.done
                                                ? isId
                                                  ? 'Siap'
                                                  : 'Ready'
                                                : isId
                                                  ? 'Isi'
                                                  : 'Fill'}
                                            </InlineBadge>
                                          </div>
                                          <p className="mt-3 text-[12px] font-black text-[color:var(--app-text)]">
                                            {card.title}
                                          </p>
                                          <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                            {card.body}
                                          </p>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              </div>

                              <div className={manageSectionBlockClass}>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/68">
                                  {isId ? 'Inti listing' : 'Listing core'}
                                </p>
                                <h5 className="mt-1.5 text-sm font-black text-[color:var(--app-text)]">
                                  {isId
                                    ? 'Yang buyer lihat duluan'
                                    : 'What buyers see first'}
                                </h5>
                                <div className="mt-4 space-y-4">
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <TextInput
                                      label={
                                        isId
                                          ? catalogFieldProfile.listingLabelId
                                          : catalogFieldProfile.listingLabelEn
                                      }
                                      name="product_name"
                                      value={productForm.name}
                                      onChange={event =>
                                        setProductForm(current => ({
                                          ...current,
                                          name: event.target.value,
                                        }))
                                      }
                                      maxLength={PRODUCT_LIMITS.name}
                                      placeholder={
                                        isId
                                          ? catalogFieldProfile.listingPlaceholderId
                                          : catalogFieldProfile.listingPlaceholderEn
                                      }
                                      required
                                    />
                                    <SelectInput
                                      label={isId ? 'Kategori' : 'Category'}
                                      value={productForm.category}
                                      onChange={event =>
                                        setProductForm(current => ({
                                          ...current,
                                          category: event.target
                                            .value as typeof current.category,
                                        }))
                                      }
                                    >
                                      {productCategoryOptions.map(option => (
                                        <option
                                          key={option.id}
                                          value={option.id}
                                        >
                                          {isId
                                            ? option.labelId
                                            : option.labelEn}
                                        </option>
                                      ))}
                                    </SelectInput>
                                    <SelectInput
                                      label={
                                        isId ? 'Jenis produk' : 'Product type'
                                      }
                                      value={productForm.product_kind}
                                      onChange={event => {
                                        const nextKind =
                                          event.target.value === 'digital'
                                            ? 'digital'
                                            : 'physical';
                                        setProductForm(current => ({
                                          ...current,
                                          product_kind: nextKind,
                                          allow_pickup:
                                            nextKind === 'physical'
                                              ? current.allow_pickup ||
                                              !current.allow_courier_shipping
                                              : false,
                                          allow_courier_shipping:
                                            nextKind === 'physical'
                                              ? current.allow_courier_shipping ||
                                              !current.allow_pickup
                                              : false,
                                        }));
                                      }}
                                    >
                                      <option value="physical">
                                        {isId ? 'Fisik' : 'Physical'}
                                      </option>
                                      <option value="digital">
                                        {isId
                                          ? 'Digital / non-fisik'
                                          : 'Digital / non-physical'}
                                      </option>
                                    </SelectInput>
                                  </div>

                                  <TextArea
                                    label={
                                      isId
                                        ? catalogFieldProfile.descriptionLabelId
                                        : catalogFieldProfile.descriptionLabelEn
                                    }
                                    name="product_description"
                                    value={productForm.description}
                                    onChange={event =>
                                      setProductForm(current => ({
                                        ...current,
                                        description: event.target.value,
                                      }))
                                    }
                                    maxLength={PRODUCT_LIMITS.description}
                                    placeholder={
                                      isId
                                        ? catalogFieldProfile.descriptionPlaceholderId
                                        : catalogFieldProfile.descriptionPlaceholderEn
                                    }
                                  />
                                </div>
                              </div>

                              <div className={manageSectionBlockClass}>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/68">
                                  {isId ? 'Harga & stok' : 'Price and stock'}
                                </p>
                                <h5 className="mt-1.5 text-sm font-black text-[color:var(--app-text)]">
                                  {isId
                                    ? 'Yang bikin buyer cepat ambil keputusan'
                                    : 'What helps buyers decide faster'}
                                </h5>
                                <div className="mt-4 space-y-4">
                                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                    <TextInput
                                      label={
                                        isId
                                          ? 'Harga (Rupiah)'
                                          : 'Price (Rupiah)'
                                      }
                                      inputMode="numeric"
                                      value={productForm.price_rupiah}
                                      onChange={event =>
                                        setProductForm(current => ({
                                          ...current,
                                          price_rupiah: event.target.value,
                                        }))
                                      }
                                      required
                                    />
                                    <TextInput
                                      label={
                                        isId
                                          ? catalogFieldProfile.stockLabelId
                                          : catalogFieldProfile.stockLabelEn
                                      }
                                      inputMode="numeric"
                                      value={productForm.stock_qty}
                                      onChange={event =>
                                        setProductForm(current => ({
                                          ...current,
                                          stock_qty: event.target.value,
                                        }))
                                      }
                                    />
                                    <TextInput
                                      label={
                                        isId
                                          ? catalogFieldProfile.prepLabelId
                                          : catalogFieldProfile.prepLabelEn
                                      }
                                      inputMode="numeric"
                                      value={productForm.prep_minutes}
                                      onChange={event =>
                                        setProductForm(current => ({
                                          ...current,
                                          prep_minutes: event.target.value,
                                        }))
                                      }
                                    />
                                    <TextInput
                                      label="SKU"
                                      name="product_sku"
                                      value={productForm.sku}
                                      onChange={event =>
                                        setProductForm(current => ({
                                          ...current,
                                          sku: event.target.value,
                                        }))
                                      }
                                    />
                                  </div>

                                  <div className="grid gap-3 sm:grid-cols-2">
                                    <div className={manageInfoCardClass}>
                                      <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                                        {isId
                                          ? catalogFieldProfile.stockLabelId
                                          : catalogFieldProfile.stockLabelEn}
                                      </p>
                                      <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                        {isId
                                          ? catalogFieldProfile.stockHintId
                                          : catalogFieldProfile.stockHintEn}
                                      </p>
                                    </div>
                                    <div className={manageInfoCardClass}>
                                      <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                                        {isId
                                          ? catalogFieldProfile.prepLabelId
                                          : catalogFieldProfile.prepLabelEn}
                                      </p>
                                      <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                        {isId
                                          ? catalogFieldProfile.prepHintId
                                          : catalogFieldProfile.prepHintEn}
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              </div>

                              <div className={manageSectionBlockClass}>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/68">
                                  {isId
                                    ? 'Foto & detail tambahan'
                                    : 'Photo and extra detail'}
                                </p>
                                <h5 className="mt-1.5 text-sm font-black text-[color:var(--app-text)]">
                                  {isId
                                    ? 'Lengkapi kalau memang perlu'
                                    : 'Fill these when they matter'}
                                </h5>
                                <div className="mt-4 space-y-4">
                                  <div className="grid gap-4 sm:grid-cols-2">
                                    <TextInput
                                      label={
                                        isId ? 'Berat (gram)' : 'Weight (grams)'
                                      }
                                      inputMode="numeric"
                                      value={productForm.weight_grams}
                                      onChange={event =>
                                        setProductForm(current => ({
                                          ...current,
                                          weight_grams: event.target.value,
                                        }))
                                      }
                                      disabled={
                                        productForm.product_kind !==
                                        'physical' ||
                                        !productForm.allow_courier_shipping
                                      }
                                    />
                                    <TextInput
                                      label={
                                        isId
                                          ? 'Catatan pengiriman digital'
                                          : 'Digital delivery note'
                                      }
                                      value={productForm.digital_delivery_note}
                                      onChange={event =>
                                        setProductForm(current => ({
                                          ...current,
                                          digital_delivery_note:
                                            event.target.value,
                                        }))
                                      }
                                      maxLength={
                                        PRODUCT_LIMITS.digitalDeliveryNote
                                      }
                                      disabled={
                                        productForm.product_kind !== 'digital'
                                      }
                                      placeholder={
                                        isId
                                          ? 'Contoh: dikirim via WhatsApp setelah pembayaran'
                                          : 'Example: delivered via WhatsApp after payment'
                                      }
                                    />
                                  </div>

                                  <TextInput
                                    label={
                                      isId
                                        ? catalogFieldProfile.imageLabelId
                                        : catalogFieldProfile.imageLabelEn
                                    }
                                    name="product_image_url"
                                    value={productForm.image_url}
                                    onChange={event =>
                                      setProductForm(current => ({
                                        ...current,
                                        image_url: event.target.value,
                                      }))
                                    }
                                    maxLength={PRODUCT_LIMITS.imageUrl}
                                    placeholder="https://..."
                                  />

                                  <p className="text-xs leading-5 text-[color:var(--app-text-soft)]">
                                    {isId
                                      ? catalogFieldProfile.imageHintId
                                      : catalogFieldProfile.imageHintEn}
                                  </p>
                                </div>
                              </div>

                              <div className={manageSectionBlockClass}>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/68">
                                  {isId
                                    ? 'Kanal & kirim'
                                    : 'Channels and delivery'}
                                </p>
                                <h5 className="mt-1.5 text-sm font-black text-[color:var(--app-text)]">
                                  {isId
                                    ? 'Pilih yang benar-benar aktif'
                                    : 'Choose only the active ones'}
                                </h5>
                                <div className="mt-4 space-y-4">
                                  <div className="grid gap-3 md:grid-cols-2">
                                    {canUseFoodChannel ? (
                                      <Toggle
                                        checked={productForm.publish_food}
                                        onChange={next =>
                                          setProductForm(current => ({
                                            ...current,
                                            publish_food: next,
                                          }))
                                        }
                                        label={
                                          isId
                                            ? 'Masuk kanal Food'
                                            : 'Include in Food channel'
                                        }
                                      />
                                    ) : null}
                                    {canUseMartChannel ? (
                                      <Toggle
                                        checked={productForm.publish_mart}
                                        onChange={next =>
                                          setProductForm(current => ({
                                            ...current,
                                            publish_mart: next,
                                          }))
                                        }
                                        label={
                                          isId
                                            ? 'Masuk kanal Mart'
                                            : 'Include in Mart channel'
                                        }
                                      />
                                    ) : null}
                                    <Toggle
                                      checked={productForm.channel_online}
                                      onChange={next =>
                                        setProductForm(current => ({
                                          ...current,
                                          channel_online: next,
                                        }))
                                      }
                                      label={
                                        isId
                                          ? 'Channel online'
                                          : 'Online channel'
                                      }
                                    />
                                    <Toggle
                                      checked={productForm.channel_offline}
                                      onChange={next =>
                                        setProductForm(current => ({
                                          ...current,
                                          channel_offline: next,
                                        }))
                                      }
                                      label={
                                        isId
                                          ? 'Channel offline'
                                          : 'Offline channel'
                                      }
                                    />
                                    <Toggle
                                      checked={productForm.allow_pickup}
                                      onChange={next =>
                                        setProductForm(current => ({
                                          ...current,
                                          allow_pickup: next,
                                        }))
                                      }
                                      disabled={
                                        productForm.product_kind !== 'physical'
                                      }
                                      label={
                                        isId
                                          ? 'Bisa pickup'
                                          : 'Pickup available'
                                      }
                                      desc={
                                        productForm.product_kind === 'digital'
                                          ? isId
                                            ? 'Nonaktif untuk produk digital'
                                            : 'Disabled for digital products'
                                          : undefined
                                      }
                                    />
                                    <Toggle
                                      checked={
                                        productForm.allow_courier_shipping
                                      }
                                      onChange={next =>
                                        setProductForm(current => ({
                                          ...current,
                                          allow_courier_shipping: next,
                                        }))
                                      }
                                      disabled={
                                        productForm.product_kind !== 'physical'
                                      }
                                      label={
                                        isId
                                          ? 'Bisa ekspedisi / kurir'
                                          : 'Courier / shipping available'
                                      }
                                      desc={
                                        productForm.product_kind === 'digital'
                                          ? isId
                                            ? 'Nonaktif untuk produk digital'
                                            : 'Disabled for digital products'
                                          : undefined
                                      }
                                    />
                                  </div>

                                  {!canUseFoodChannel && !canUseMartChannel ? (
                                    <div className={manageInfoCardClass}>
                                      {isId
                                        ? 'Fokus ke booking, brief, atau delivery digital.'
                                        : 'This listing is better focused on bookings, briefs, or digital delivery. Food/Mart is optional unless the business also sells meals or physical goods.'}
                                    </div>
                                  ) : null}
                                </div>
                              </div>

                              {listingRequirementFields.length > 0 ||
                                orderRequirementFields.length > 0 ? (
                                <div className={manageSectionBlockClass}>
                                  <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/68">
                                    {isId
                                      ? 'Kebutuhan buyer'
                                      : 'Buyer requirements'}
                                  </p>
                                  <p className="mt-1.5 text-sm font-black text-[color:var(--app-text)]">
                                    {isId
                                      ? 'Yang ikut terbawa ke listing'
                                      : 'What is carried into the listing'}
                                  </p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {[
                                      ...listingRequirementFields,
                                      ...orderRequirementFields,
                                    ].map(field => (
                                      <InlineBadge
                                        key={field.id}
                                        tone={
                                          field.required ? 'warning' : 'default'
                                        }
                                      >
                                        {field.label}
                                      </InlineBadge>
                                    ))}
                                  </div>
                                </div>
                              ) : null}

                              <div className={manageFormHeroClass}>
                                <p className="text-[10px] font-black uppercase tracking-[0.16em] text-[color:var(--app-accent)]/68">
                                  {isId ? 'Preview buyer' : 'Buyer preview'}
                                </p>
                                <p className="mt-1.5 text-sm font-black text-[color:var(--app-text)]">
                                  {isId
                                    ? 'Buyer akan lihat alur sesingkat ini'
                                    : 'This is the flow buyers will see'}
                                </p>
                                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                                  <div className={manageInfoCardClass}>
                                    <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                                      {isId
                                        ? 'Kanal publish'
                                        : 'Publish channels'}
                                    </p>
                                    <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                      {[
                                        productForm.publish_food
                                          ? getUmkmPublishServiceLabel(
                                            'food',
                                            isId,
                                          )
                                          : '',
                                        productForm.publish_mart
                                          ? getUmkmPublishServiceLabel(
                                            'mart',
                                            isId,
                                          )
                                          : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' / ') ||
                                        (isId
                                          ? 'Opsional sesuai channel bisnis'
                                          : 'Optional based on business channel')}
                                    </p>
                                  </div>
                                  <div className={manageInfoCardClass}>
                                    <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                                      {isId
                                        ? 'Channel aktif'
                                        : 'Active channels'}
                                    </p>
                                    <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                      {[
                                        productForm.channel_online
                                          ? 'Online'
                                          : '',
                                        productForm.channel_offline
                                          ? 'Offline'
                                          : '',
                                      ]
                                        .filter(Boolean)
                                        .join(' / ') ||
                                        (isId
                                          ? 'Belum dipilih'
                                          : 'Not selected')}
                                    </p>
                                  </div>
                                  <div className={manageInfoCardClass}>
                                    <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                                      {isId
                                        ? 'Fulfillment checkout'
                                        : 'Checkout fulfillment'}
                                    </p>
                                    <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                      {productForm.product_kind === 'digital'
                                        ? isId
                                          ? 'Digital / instan'
                                          : 'Digital / instant'
                                        : [
                                          productForm.allow_pickup
                                            ? 'Pickup'
                                            : '',
                                          productForm.allow_courier_shipping
                                            ? isId
                                              ? 'Ekspedisi'
                                              : 'Courier'
                                            : '',
                                        ]
                                          .filter(Boolean)
                                          .join(' / ') ||
                                        (isId
                                          ? 'Belum valid'
                                          : 'Not valid yet')}
                                    </p>
                                  </div>
                                  <div className={manageInfoCardClass}>
                                    <p className="text-[11px] font-semibold text-[color:var(--app-text)]">
                                      {isId
                                        ? 'Catatan penting'
                                        : 'Important note'}
                                    </p>
                                    <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                                      {productForm.product_kind === 'digital'
                                        ? isId
                                          ? 'Buyer akan lihat catatan pengiriman digital setelah bayar.'
                                          : 'Buyers will see the digital delivery note after payment.'
                                        : isId
                                          ? 'Tarif expedisi final ikut mode sandbox/live di checkout.'
                                          : 'Final shipping rates follow sandbox/live checkout mode.'}
                                    </p>
                                  </div>
                                </div>
                                <p className="mt-3 text-[11px] leading-5">
                                  {productForm.product_kind === 'digital' &&
                                    !productForm.digital_delivery_note.trim()
                                    ? isId
                                      ? 'Tambahkan catatan kirim digital.'
                                      : 'Add a digital delivery note so buyers know where files, vouchers, or access will be sent.'
                                    : productForm.product_kind === 'physical' &&
                                      productForm.channel_online &&
                                      !productForm.allow_pickup &&
                                      !productForm.allow_courier_shipping
                                      ? isId
                                        ? 'Produk fisik online belum valid. Aktifkan pickup atau ekspedisi.'
                                        : 'This physical online product is not valid yet. Enable pickup or courier.'
                                      : productForm.product_kind ===
                                        'physical' &&
                                        productForm.allow_courier_shipping &&
                                        !(
                                          Number(productForm.weight_grams) > 0
                                        )
                                        ? isId
                                          ? 'Isi berat produk untuk hitung ongkir.'
                                          : 'Fill product weight so courier fees can be calculated correctly.'
                                        : isId
                                          ? 'Listing ini sudah cukup jelas untuk buyer dan siap dipakai.'
                                          : 'This listing is clear enough for buyers and ready to use.'}
                                </p>
                              </div>

                              <button
                                type="submit"
                                disabled={submittingProduct || loadingStoreData}
                                className="ui-button-primary inline-flex w-full items-center justify-center gap-2 px-4 text-sm font-bold disabled:opacity-60"
                              >
                                {submittingProduct ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <PackagePlus className="h-4 w-4" />
                                )}
                                {isId ? 'Tambah listing' : 'Create listing'}
                              </button>
                            </form>

                            <div className="mt-5 space-y-3">
                              {products.length === 0 ? (
                                <div className="rounded-2xl border border-dashed border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-6 text-sm  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                  {isId
                                    ? 'Belum ada listing. Tambahkan produk, jasa, atau paket pertama Anda.'
                                    : 'No listings yet. Add your first product, service, or package.'}
                                </div>
                              ) : (
                                products.slice(0, 8).map(product => (
                                  <div
                                    key={product.id}
                                    className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                  >
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate text-sm font-bold  text-[color:var(--app-accent)]">
                                          {product.name}
                                        </p>
                                        <p className="mt-1 text-xs  text-[color:var(--app-accent)]">
                                          {getUmkmProductCategoryLabel(
                                            product.category,
                                            isId,
                                          )}{' '}
                                          • {formatIdr(product.price_cents)} •{' '}
                                          {isId ? 'stok' : 'stock'}{' '}
                                          {product.stock_qty}
                                        </p>
                                      </div>
                                      <span
                                        className={cn(
                                          'shrink-0 rounded-full px-2.5 py-1 text-[11px] font-bold',
                                          product.is_available
                                            ? ' border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]'
                                            : ' border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]',
                                        )}
                                      >
                                        {product.is_available
                                          ? isId
                                            ? 'Aktif'
                                            : 'Active'
                                          : isId
                                            ? 'Nonaktif'
                                            : 'Inactive'}
                                      </span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </div>
                          </SectionCard>
                        ) : null}

                        {currentWorkspace === 'operations' ? (
                          <SectionCard
                            id="umkm-tables"
                            title={`5. ${isId
                              ? selectedManageProfile.operationsTitleId
                              : selectedManageProfile.operationsTitleEn
                              }`}
                            desc={getUmkmOperationsSummary(
                              selectedBusinessCategory,
                              selectedBusinessCapabilities,
                              isId,
                            )}
                          >
                            {supportsDineInFlow ? (
                              <form
                                onSubmit={submitTables}
                                className="space-y-4"
                              >
                                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                                  <TextInput
                                    label={isId ? 'Jumlah meja' : 'Table count'}
                                    inputMode="numeric"
                                    value={tableForm.count}
                                    onChange={event =>
                                      setTableForm(current => ({
                                        ...current,
                                        count: event.target.value,
                                      }))
                                    }
                                  />
                                  <TextInput
                                    label={
                                      isId ? 'Prefix meja' : 'Table prefix'
                                    }
                                    maxLength={STORE_LIMITS.tablePrefix}
                                    value={tableForm.prefix}
                                    onChange={event =>
                                      setTableForm(current => ({
                                        ...current,
                                        prefix: event.target.value,
                                      }))
                                    }
                                  />
                                  <TextInput
                                    label={
                                      isId ? 'Mulai nomor' : 'Start number'
                                    }
                                    inputMode="numeric"
                                    value={tableForm.start_number}
                                    onChange={event =>
                                      setTableForm(current => ({
                                        ...current,
                                        start_number: event.target.value,
                                      }))
                                    }
                                  />
                                  <TextInput
                                    label={isId ? 'Kapasitas' : 'Capacity'}
                                    inputMode="numeric"
                                    value={tableForm.capacity}
                                    onChange={event =>
                                      setTableForm(current => ({
                                        ...current,
                                        capacity: event.target.value,
                                      }))
                                    }
                                  />
                                </div>

                                <button
                                  type="submit"
                                  disabled={
                                    submittingTables || loadingStoreData
                                  }
                                  className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-bold disabled:opacity-60"
                                >
                                  {submittingTables ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                  ) : (
                                    <Table2 className="h-4 w-4" />
                                  )}
                                  {isId
                                    ? 'Generate meja + QR'
                                    : 'Generate tables + QR'}
                                </button>
                              </form>
                            ) : (
                              <div className="rounded-[24px] border border-dashed border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-4 py-4 text-sm leading-6 text-[color:var(--app-accent)]/78">
                                <p className="font-semibold text-[color:var(--app-accent)]">
                                  {supportsReservationFlow
                                    ? isId
                                      ? 'Outlet ini berjalan dengan booking, sesi, atau janji layanan.'
                                      : 'This outlet operates through bookings, sessions, or appointments.'
                                    : isId
                                      ? 'Outlet ini tidak memakai meja.'
                                      : 'This outlet does not use tables.'}
                                </p>
                                <p className="mt-2">
                                  {supportsFieldVisitFlow
                                    ? isId
                                      ? 'Fokus operasional yang lebih relevan adalah area jangkauan, jadwal kunjungan, pickup/dropoff, dan catatan kerja.'
                                      : 'The relevant operating flow is coverage area, visit schedule, pickup/dropoff, and job notes.'
                                    : supportsDigitalFlow
                                      ? isId
                                        ? 'Untuk jasa digital, fokuskan briefing, turnaround, revisi, dan delivery hasil.'
                                        : 'For digital services, focus on briefs, turnaround, revisions, and final delivery.'
                                      : isId
                                        ? 'Booking, brief, dan alur layanan lebih penting daripada QR meja untuk model usaha ini.'
                                        : 'Bookings, briefs, and service flow matter more than table QR for this business model.'}
                                </p>
                                {bookingRequirementFields.length > 0 ? (
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {bookingRequirementFields.map(field => (
                                      <InlineBadge
                                        key={field.id}
                                        tone={
                                          field.required ? 'warning' : 'default'
                                        }
                                      >
                                        {field.label}
                                      </InlineBadge>
                                    ))}
                                  </div>
                                ) : null}
                              </div>
                            )}

                            {supportsDineInFlow ? (
                              <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                                {tables.length === 0 ? (
                                  <div className="col-span-full rounded-2xl border border-dashed border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-6 text-sm  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                    {isId
                                      ? 'Belum ada meja. Generate meja pertama Anda.'
                                      : 'No tables yet. Generate your first tables.'}
                                  </div>
                                ) : (
                                  tables.map(table => (
                                    <div
                                      key={table.id}
                                      className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                    >
                                      <div className="flex items-center justify-between gap-2">
                                        <p className="text-sm font-black  text-[color:var(--app-accent)]">
                                          {table.table_code}
                                        </p>
                                        <span
                                          className={cn(
                                            'rounded-full px-2.5 py-1 text-[11px] font-bold',
                                            statusTone(table.status),
                                          )}
                                        >
                                          {table.status}
                                        </span>
                                      </div>
                                      <p className="mt-2 text-xs  text-[color:var(--app-accent)]">
                                        {isId ? 'Kapasitas' : 'Capacity'}{' '}
                                        {table.capacity}
                                      </p>
                                    </div>
                                  ))
                                )}
                              </div>
                            ) : null}
                          </SectionCard>
                        ) : null}
                      </div>
                    ) : null}

                    {currentWorkspace === 'orders' ? (
                      <SectionCard
                        id="umkm-orders"
                        title={
                          isId
                            ? '6. Order & pembayaran'
                            : '6. Orders & payments'
                        }
                        desc={
                          isId
                            ? 'Area kerja kasir dan owner untuk order aktif, bill, pembayaran, dan penyelesaian transaksi.'
                            : 'The cashier and owner workspace for live orders, billing, payments, and transaction closeout.'
                        }
                        action={
                          loadingStoreData ? (
                            <Loader2 className="h-4 w-4 animate-spin text-[color:var(--app-accent)]" />
                          ) : null
                        }
                      >
                        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <StatCard
                            label={isId ? 'Aktif' : 'Active'}
                            value={orderSummary.unpaid}
                            desc={isId ? 'Belum selesai' : 'In progress'}
                          />
                          <StatCard
                            label={isId ? 'Menunggu bill' : 'Awaiting bill'}
                            value={orderSummary.awaitingBill}
                            desc={
                              isId ? 'Butuh konfirmasi' : 'Needs confirmation'
                            }
                          />
                          <StatCard
                            label={isId ? 'Sedang disiapkan' : 'Preparing'}
                            value={orderSummary.preparing}
                            desc={isId ? 'Di dapur' : 'In kitchen'}
                          />
                          <StatCard
                            label={isId ? 'Selesai' : 'Completed'}
                            value={orderSummary.completed}
                            desc={isId ? 'Paid / selesai' : 'Paid / done'}
                          />
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          {orderFilterOptions.map(option => (
                            <button
                              key={option.id}
                              type="button"
                              onClick={() => setOrderFilter(option.id)}
                              className={cn(
                                'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-xs font-bold transition',
                                orderFilter === option.id
                                  ? ' border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]'
                                  : ' border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] text-[color:var(--app-accent)]',
                              )}
                            >
                              {option.label}
                              <span
                                className={cn(
                                  'rounded-full px-2 py-0.5 text-[10px]',
                                  orderFilter === option.id
                                    ? ' border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]'
                                    : ' border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]',
                                )}
                              >
                                {option.count}
                              </span>
                            </button>
                          ))}
                        </div>

                        <div className="mt-5 space-y-4">
                          {orders.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-8 text-sm  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                              {supportsDineInFlow
                                ? isId
                                  ? 'Belum ada order. Scan QR atau buka storefront untuk membuat order pertama.'
                                  : 'No orders yet. Scan a QR code or open the storefront to create the first order.'
                                : isId
                                  ? 'Belum ada order. Bagikan storefront atau listing bisnis ini untuk menerima order pertama.'
                                  : 'No orders yet. Share the storefront or listing to receive the first order.'}
                            </div>
                          ) : filteredOrders.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-8 text-sm  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                              {isId
                                ? 'Tidak ada order pada filter ini.'
                                : 'No orders in this filter.'}
                            </div>
                          ) : (
                            filteredOrders.map(order => {
                              const paymentFlow = readPaymentFlow(
                                order.metadata || {},
                              );
                              const deliveryAddress = readMetaString(
                                order.metadata || {},
                                'delivery_address',
                              );
                              const deliveryLat = readMetaNumber(
                                order.metadata || {},
                                'delivery_lat',
                              );
                              const deliveryLng = readMetaNumber(
                                order.metadata || {},
                                'delivery_lng',
                              );
                              const fulfillmentMode =
                                order.fulfillment_mode ||
                                readMetaString(
                                  order.metadata || {},
                                  'fulfillment_mode',
                                ) ||
                                (order.channel === 'offline'
                                  ? 'dine_in'
                                  : 'courier');
                              const shippingOption =
                                typeof order.metadata.shipping_option ===
                                  'object' && order.metadata.shipping_option
                                  ? (order.metadata.shipping_option as Record<
                                    string,
                                    unknown
                                  >)
                                  : {};
                              const shippingFeeCents =
                                typeof order.shipping_fee_cents === 'number'
                                  ? order.shipping_fee_cents
                                  : readMetaNumber(
                                    order.metadata || {},
                                    'shipping_fee_cents',
                                  ) || 0;
                              const paymentStage =
                                order.payment_stage ||
                                (order.payment_status === 'paid'
                                  ? 'paid'
                                  : 'awaiting_prepayment');
                              const paymentMethod =
                                order.payment_method || 'cash';
                              const paymentBlocked =
                                paymentFlow.prepayRequired &&
                                order.payment_status !== 'paid';
                              const isFinalizing =
                                order.payment_status === 'paid' &&
                                order.status === 'served';
                              const canCheckout =
                                paymentStage !== 'awaiting_confirmation' &&
                                (order.payment_status !== 'paid' ||
                                  order.status === 'served');

                              return (
                                <article
                                  key={order.id}
                                  className="rounded-3xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 shadow-sm border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                >
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <p className="text-sm font-black  text-[color:var(--app-accent)]">
                                          {order.customer_name ||
                                            (order.channel === 'offline'
                                              ? isId
                                                ? 'Guest dine-in'
                                                : 'Guest dine-in'
                                              : 'Guest')}
                                        </p>
                                        <span
                                          className={cn(
                                            'rounded-full px-2.5 py-1 text-[11px] font-bold',
                                            statusTone(order.status),
                                          )}
                                        >
                                          {order.status}
                                        </span>
                                        <span
                                          className={cn(
                                            'rounded-full px-2.5 py-1 text-[11px] font-bold',
                                            order.channel === 'offline'
                                              ? ' border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]'
                                              : ' border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]',
                                          )}
                                        >
                                          {order.channel}
                                        </span>
                                        <span className="rounded-full px-2.5 py-1 text-[11px] font-bold border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                          {formatOrderFulfillmentLabel(
                                            fulfillmentMode,
                                            isId,
                                          )}
                                        </span>
                                      </div>

                                      <p className="mt-1 text-xs  text-[color:var(--app-accent)]">
                                        {order.table_code
                                          ? `${isId ? 'Meja' : 'Table'} ${order.table_code} • `
                                          : ''}
                                        {formatIdr(order.total_cents)} •{' '}
                                        {formatDateTime(
                                          order.created_at,
                                          locale,
                                        )}
                                      </p>
                                    </div>

                                    <div className="text-right text-xs  text-[color:var(--app-accent)]">
                                      <p>{order.id.slice(0, 8)}...</p>
                                      <p>{order.payment_status}</p>
                                      <p>
                                        {formatPaymentMethod(
                                          paymentMethod,
                                          isId,
                                          paymentFlow.timing,
                                        )}{' '}
                                        /{' '}
                                        {formatPaymentStage(paymentStage, isId)}
                                      </p>
                                      {shippingFeeCents > 0 ? (
                                        <p>
                                          {isId ? 'Ongkir' : 'Shipping'}:{' '}
                                          {formatIdr(shippingFeeCents)}
                                        </p>
                                      ) : null}
                                    </div>
                                  </div>

                                  {order.channel === 'online' &&
                                    (deliveryAddress ||
                                      (deliveryLat !== null &&
                                        deliveryLng !== null)) ? (
                                    <div className="mt-3 rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-3 text-xs  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                      <p>
                                        {isId ? 'Alamat:' : 'Address:'}{' '}
                                        {deliveryAddress ||
                                          `${deliveryLat?.toFixed(5)}, ${deliveryLng?.toFixed(5)}`}
                                      </p>
                                      {deliveryLat !== null &&
                                        deliveryLng !== null ? (
                                        <a
                                          href={`https://www.google.com/maps?q=${deliveryLat},${deliveryLng}`}
                                          target="_blank"
                                          rel="noreferrer"
                                          className="mt-2 inline-flex items-center gap-1 font-semibold  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                        >
                                          <MapPinned className="h-3.5 w-3.5" />
                                          {isId
                                            ? 'Buka di maps'
                                            : 'Open in maps'}
                                        </a>
                                      ) : null}
                                      {Object.keys(shippingOption).length >
                                        0 ? (
                                        <p className="mt-2">
                                          {isId ? 'Metode:' : 'Mode:'}{' '}
                                          {formatOrderFulfillmentLabel(
                                            fulfillmentMode,
                                            isId,
                                          )}
                                          {typeof shippingOption.label ===
                                            'string'
                                            ? ` / ${shippingOption.label}`
                                            : ''}
                                        </p>
                                      ) : null}
                                    </div>
                                  ) : null}

                                  {paymentBlocked ? (
                                    <div className="mt-3 rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-3 text-xs  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                      {paymentStage === 'awaiting_confirmation'
                                        ? isId
                                          ? 'Menunggu konfirmasi bill sebelum meminta pembayaran di awal.'
                                          : 'Awaiting bill confirmation before requesting prepayment.'
                                        : isId
                                          ? 'Pembayaran di awal wajib sebelum order diproses.'
                                          : 'Prepayment is required before processing.'}
                                    </div>
                                  ) : paymentFlow.timing === 'postpay' ? (
                                    <div className="mt-3 rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-3 text-xs  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                      {paymentStage === 'awaiting_confirmation'
                                        ? isId
                                          ? 'Cash bayar nanti. Bill menunggu konfirmasi sebelum checkout.'
                                          : 'Cash pay later. Bill awaits confirmation before checkout.'
                                        : isId
                                          ? 'Cash dibayar saat checkout setelah bill dikonfirmasi.'
                                          : 'Cash is paid at checkout after bill confirmation.'}
                                    </div>
                                  ) : null}

                                  <div className="mt-4 flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      disabled={
                                        actingOrderId === order.id ||
                                        paymentBlocked
                                      }
                                      onClick={() =>
                                        void runOrderAction(order.id, {
                                          action: 'update_status',
                                          status: 'preparing',
                                        })
                                      }
                                      className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 text-xs font-bold border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] disabled:opacity-60  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                    >
                                      {actingOrderId === order.id ? (
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                      ) : (
                                        <PackagePlus className="h-3.5 w-3.5" />
                                      )}
                                      {fulfillmentMode === 'digital'
                                        ? isId
                                          ? 'Proses digital'
                                          : 'Process digital'
                                        : isId
                                          ? 'Siapkan'
                                          : 'Preparing'}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={
                                        actingOrderId === order.id ||
                                        paymentBlocked
                                      }
                                      onClick={() =>
                                        void runOrderAction(order.id, {
                                          action: 'update_status',
                                          status: 'served',
                                        })
                                      }
                                      className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 text-xs font-bold border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] disabled:opacity-60  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                    >
                                      <WalletCards className="h-3.5 w-3.5" />
                                      {fulfillmentMode === 'courier'
                                        ? isId
                                          ? 'Kirim'
                                          : 'Ship'
                                        : fulfillmentMode === 'pickup'
                                          ? isId
                                            ? 'Siap diambil'
                                            : 'Ready for pickup'
                                          : fulfillmentMode === 'digital'
                                            ? isId
                                              ? 'Kirim digital'
                                              : 'Send digital'
                                            : isId
                                              ? 'Sajikan'
                                              : 'Served'}
                                    </button>

                                    {paymentStage ===
                                      'awaiting_confirmation' ? (
                                      <button
                                        type="button"
                                        disabled={actingOrderId === order.id}
                                        onClick={() =>
                                          void runOrderAction(order.id, {
                                            action: 'confirm_bill',
                                          })
                                        }
                                        className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 text-xs font-bold border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] disabled:opacity-60  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                      >
                                        <FileText className="h-3.5 w-3.5" />
                                        {isId
                                          ? 'Konfirmasi bill'
                                          : 'Confirm bill'}
                                      </button>
                                    ) : null}

                                    <button
                                      type="button"
                                      disabled={
                                        actingOrderId === order.id ||
                                        !canCheckout
                                      }
                                      onClick={() =>
                                        void runOrderAction(order.id, {
                                          action: 'checkout',
                                        })
                                      }
                                      className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 text-xs font-bold border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] disabled:opacity-60  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                    >
                                      <WalletCards className="h-3.5 w-3.5" />
                                      {isFinalizing
                                        ? isId
                                          ? 'Selesaikan order'
                                          : 'Complete order'
                                        : isId
                                          ? 'Terima pembayaran'
                                          : 'Record payment'}
                                    </button>

                                    <button
                                      type="button"
                                      disabled={actingOrderId === order.id}
                                      onClick={() =>
                                        void runOrderAction(order.id, {
                                          action: 'update_status',
                                          status: 'cancelled',
                                        })
                                      }
                                      className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 text-xs font-bold border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] disabled:opacity-60  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                    >
                                      <WalletCards className="h-3.5 w-3.5" />
                                      {isId ? 'Batalkan' : 'Cancel'}
                                    </button>
                                  </div>

                                  {order.channel === 'offline' &&
                                    order.payment_status === 'unpaid' ? (
                                    <div className="mt-4 grid gap-2 sm:grid-cols-[1fr_auto]">
                                      <select
                                        value={moveTargets[order.id] || ''}
                                        onChange={event =>
                                          setMoveTargets(current => ({
                                            ...current,
                                            [order.id]: event.target.value,
                                          }))
                                        }
                                        className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-3 text-sm text-[color:var(--app-accent)] outline-none text-[color:var(--app-accent)] focus:ring-4  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                      >
                                        <option value="">
                                          {isId
                                            ? 'Pilih meja tujuan'
                                            : 'Choose target table'}
                                        </option>
                                        {availableTables.map(table => (
                                          <option
                                            key={table.id}
                                            value={table.id}
                                          >
                                            {table.table_code} (
                                            {isId ? 'kapasitas' : 'capacity'}{' '}
                                            {table.capacity})
                                          </option>
                                        ))}
                                      </select>

                                      <button
                                        type="button"
                                        disabled={
                                          !moveTargets[order.id] ||
                                          actingOrderId === order.id
                                        }
                                        onClick={() =>
                                          void runOrderAction(order.id, {
                                            action: 'move_table',
                                            to_table_id: moveTargets[order.id],
                                          })
                                        }
                                        className="inline-flex min-h-[46px] items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 text-sm font-bold border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] disabled:opacity-60  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                      >
                                        <ArrowRightLeft className="h-4 w-4" />
                                        {isId ? 'Pindah meja' : 'Move table'}
                                      </button>
                                    </div>
                                  ) : null}
                                </article>
                              );
                            })
                          )}
                        </div>
                      </SectionCard>
                    ) : null}

                    {currentWorkspace === 'operations' ? (
                      <SectionCard
                        id="umkm-reservations"
                        title={
                          supportsDineInFlow
                            ? isId
                              ? '7. Reservasi & seating'
                              : '7. Reservations & seating'
                            : isId
                              ? '7. Booking & jadwal layanan'
                              : '7. Bookings & service schedule'
                        }
                        desc={
                          supportsDineInFlow
                            ? isId
                              ? 'Untuk tim outlet: cek booking, tandai datang, lalu tutup sesi dengan rapi.'
                              : 'For outlet teams: review bookings, mark arrivals, then close sessions cleanly.'
                            : isId
                              ? 'Pantau booking jasa, konfirmasi jadwal, dan tutup sesi setelah layanan selesai.'
                              : 'Monitor service bookings, confirm schedules, and close the session after delivery.'
                        }
                      >
                        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-4">
                          <StatCard
                            label={isId ? 'Aktif' : 'Active'}
                            value={reservationSummary.active}
                            desc={
                              isId
                                ? 'Pending / confirmed / seated'
                                : 'Pending / confirmed / seated'
                            }
                          />
                          <StatCard
                            label={isId ? 'Hari ini' : 'Today'}
                            value={reservationSummary.todayCount}
                            desc={isId ? 'Jadwal hari ini' : 'Scheduled today'}
                          />
                          <StatCard
                            label={isId ? 'Sudah datang' : 'Seated'}
                            value={reservationSummary.seated}
                            desc={isId ? 'Sudah duduk' : 'Already seated'}
                          />
                          <StatCard
                            label={isId ? 'Total' : 'Total'}
                            value={reservationSummary.total}
                            desc={isId ? 'Semua reservasi' : 'All reservations'}
                          />
                        </div>

                        <div className="mt-5 space-y-4">
                          {reservations.length === 0 ? (
                            <div className="rounded-2xl border border-dashed border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-8 text-sm  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                              {supportsDineInFlow
                                ? isId
                                  ? 'Belum ada reservasi. User akan mulai muncul di sini saat booking meja dari storefront.'
                                  : 'No reservations yet. Users booking tables from the storefront will appear here.'
                                : isId
                                  ? 'Belum ada booking layanan. Booking, sesi, atau appointment akan muncul di sini saat alurnya mulai dipakai.'
                                  : 'No service bookings yet. Appointments and sessions will appear here once the workflow starts being used.'}
                            </div>
                          ) : (
                            reservations.map(reservation => (
                              <article
                                key={reservation.id}
                                className="rounded-3xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 shadow-sm border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <p className="text-sm font-black  text-[color:var(--app-accent)]">
                                        {reservation.customer_name}
                                      </p>
                                      <span
                                        className={cn(
                                          'rounded-full px-2.5 py-1 text-[11px] font-bold',
                                          statusTone(reservation.status),
                                        )}
                                      >
                                        {reservation.status}
                                      </span>
                                      <span className="rounded-full text-[color:var(--app-accent)] px-2.5 py-1 text-[11px] font-bold  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                        {reservation.reservation_code}
                                      </span>
                                    </div>
                                    <p className="mt-1 text-xs  text-[color:var(--app-accent)]">
                                      {reservation.table_code
                                        ? `${isId ? 'Meja' : 'Table'} ${reservation.table_code} - `
                                        : ''}
                                      {reservation.guest_count}{' '}
                                      {isId ? 'orang' : 'guests'} -{' '}
                                      {formatDateTime(
                                        reservation.reserved_for,
                                        locale,
                                      )}
                                    </p>
                                  </div>
                                  <div className="text-right text-xs  text-[color:var(--app-accent)]">
                                    <p>{reservation.customer_phone}</p>
                                    <p>
                                      {reservation.duration_minutes}{' '}
                                      {isId ? 'menit' : 'minutes'}
                                    </p>
                                  </div>
                                </div>

                                {reservation.notes ? (
                                  <div className="mt-3 rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-3 text-xs  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]">
                                    {reservation.notes}
                                  </div>
                                ) : null}

                                <div className="mt-4 flex flex-wrap gap-2">
                                  <button
                                    type="button"
                                    disabled={
                                      actingReservationId === reservation.id ||
                                      reservation.status !== 'pending'
                                    }
                                    onClick={() =>
                                      void runReservationAction(
                                        reservation.id,
                                        'confirmed',
                                      )
                                    }
                                    className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 text-xs font-bold border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] disabled:opacity-60  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                  >
                                    <ShieldCheck className="h-3.5 w-3.5" />
                                    {isId ? 'Konfirmasi' : 'Confirm'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      actingReservationId === reservation.id ||
                                      (reservation.status !== 'confirmed' &&
                                        reservation.status !== 'pending')
                                    }
                                    onClick={() =>
                                      void runReservationAction(
                                        reservation.id,
                                        'seated',
                                      )
                                    }
                                    className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 text-xs font-bold border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] disabled:opacity-60  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                  >
                                    <Table2 className="h-3.5 w-3.5" />
                                    {isId ? 'Tandai datang' : 'Mark seated'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      actingReservationId === reservation.id ||
                                      reservation.status === 'completed'
                                    }
                                    onClick={() =>
                                      void runReservationAction(
                                        reservation.id,
                                        'completed',
                                      )
                                    }
                                    className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 text-xs font-bold border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] disabled:opacity-60  border-[color:var(--app-accent-border)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                  >
                                    <Clipboard className="h-3.5 w-3.5" />
                                    {isId ? 'Selesaikan' : 'Complete'}
                                  </button>
                                  <button
                                    type="button"
                                    disabled={
                                      actingReservationId === reservation.id ||
                                      reservation.status === 'cancelled'
                                    }
                                    onClick={() =>
                                      void runReservationAction(
                                        reservation.id,
                                        'cancelled',
                                      )
                                    }
                                    className="inline-flex min-h-[38px] items-center gap-2 rounded-xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 text-xs font-bold border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] disabled:opacity-60  border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                                  >
                                    <FileText className="h-3.5 w-3.5" />
                                    {isId ? 'Batalkan' : 'Cancel'}
                                  </button>
                                </div>
                              </article>
                            ))
                          )}
                        </div>
                      </SectionCard>
                    ) : null}
                  </>
                ) : (
                  <div className="rounded-[30px] border border-dashed border-[color:var(--app-accent-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,247,240,0.96))] px-5 py-12 text-sm text-[color:var(--app-accent)]">
                    {isId
                      ? 'Pilih outlet dulu.'
                      : 'Choose an outlet first to open this operations page.'}
                  </div>
                )}
              </div>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
