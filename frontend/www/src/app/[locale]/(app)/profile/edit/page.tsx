'use client';

import {
  type ChangeEvent,
  type ReactNode,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useAuth } from '@/context/AuthContext';
import { Modal } from '@/components/common/Modal';
import { LocalizedLink } from '@/components/ui-kit';
import { ImageCropModal } from '@/components/common/ImageCropModal';
import { ProfileEditSkeleton } from '@/components/system/feedback/RouteSkeletons';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  buildPublicProfileHref,
  normalizePublicProfileHandleInput,
} from '@/lib/profile/publicProfileLink';
import {
  extractFirstUploadedImageUrl,
  extractUploadedDocumentUrls,
  extractUploadedImageUrls,
  normalizeProfileMediaList,
  normalizeProfileMediaUrl,
} from '@/lib/profile/profileMedia';
import {
  prepareUploadFile,
  prepareUploadFiles,
} from '@/lib/media/prepareUploadMedia';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { resolveLocaleFromPathname } from '@/lib/locale';
import {
  ArrowLeft,
  AtSign,
  Award,
  BriefcaseBusiness,
  Camera,
  CheckCircle2,
  CircleAlert,
  FileText,
  Globe2,
  GraduationCap,
  ImagePlus,
  Images,
  Link2,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Save,
  Search,
  Store,
  Trash2,
  UserRound,
  WandSparkles,
} from 'lucide-react';
import { cn } from '@/lib/utils';

type UserDetail = {
  id: string;
  email: string;
  full_name?: string | null;
  username?: string | null;
  phone?: string | null;
  phone_verified?: boolean | null;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  cover_image?: string | null;
  verification?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

type ProfileMap = Record<string, unknown>;
type ProfileEntry = {
  title: string;
  subtitle?: string;
  meta?: string;
  url?: string;
};

type LinkEntry = {
  label: string;
  url: string;
};

type EditFocus = 'identity' | 'work' | 'media';
type ProfileChecklistItem = {
  key: string;
  label: string;
  focus: EditFocus;
  done: boolean;
};

function createEmptyProfileEntry(): ProfileEntry {
  return { title: '', subtitle: '', meta: '', url: '' };
}

function asObject(value: unknown): ProfileMap {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as ProfileMap;
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value))
    return value.map(item => String(item || '')).filter(Boolean);
  if (typeof value === 'string') {
    return value
      .split(/[,\n;|]/g)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function joinList(values: string[]): string {
  return values.join(', ');
}

function normalizeEntry(value: unknown): ProfileEntry | null {
  if (typeof value === 'string') {
    const title = value.trim();
    return title ? { title } : null;
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const row = value as ProfileMap;
  const title =
    asString(row.title) ||
    asString(row.name) ||
    asString(row.degree) ||
    asString(row.school) ||
    asString(row.institution);
  if (!title) return null;
  const subtitle =
    asString(row.institution) ||
    asString(row.school) ||
    asString(row.field) ||
    '';
  const meta =
    asString(row.year) || asString(row.level) || asString(row.status) || '';
  const url = asString(row.url) || asString(row.link) || '';
  return {
    title,
    subtitle: subtitle || undefined,
    meta: meta || undefined,
    url: url || undefined,
  };
}


function FormField({
  label,
  hint,
  required = false,
  className,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <label className={cn('flex min-w-0 flex-col', className)}>
      <span className="flex min-h-[58px] flex-col justify-end">
        <span className="flex min-h-5 flex-wrap items-center gap-2 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          <span>{label}</span>
          <span
            className={cn(
              'shrink-0 whitespace-nowrap rounded-full px-2 py-0.5 text-[9px] font-black uppercase tracking-wide',
              required
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] dark:bg-white/10',
            )}
          >
            {required ? 'Disarankan' : 'Opsional'}
          </span>
        </span>

        {hint ? (
          <span className="mt-1 line-clamp-2 min-h-5 text-xs leading-5 text-[color:var(--app-text-soft)]">
            {hint}
          </span>
        ) : (
          <span className="mt-1 block min-h-5" aria-hidden="true" />
        )}
      </span>

      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function SectionHeading({
  step,
  title,
  description,
  icon,
  optional = false,
  action,
}: {
  step: string;
  title: string;
  description: string;
  icon: ReactNode;
  optional?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="grid gap-4 border-b border-[color:var(--app-border)] pb-5 dark:border-[color:var(--app-border-strong)] sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
          {icon}
        </span>

        <div className="min-w-0">
          <div className="flex min-h-5 flex-wrap items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-emerald-700 dark:text-emerald-300">
              {step}
            </span>
            {optional ? (
              <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2 py-0.5 text-[9px] font-black uppercase tracking-wide text-[color:var(--app-text-soft)] dark:bg-white/10">
                Isi bila relevan
              </span>
            ) : null}
          </div>

          <h2 className="mt-1 text-lg font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {title}
          </h2>
          <p className="mt-1 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
            {description}
          </p>
        </div>
      </div>

      {action ? (
        <div className="w-full shrink-0 sm:w-auto [&>*]:w-full sm:[&>*]:w-auto">
          {action}
        </div>
      ) : null}
    </div>
  );
}

function EmptyEditorState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
}) {
  return (
    <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-5 py-8 text-center dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
      <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {title}
      </p>
      <p className="mx-auto mt-2 max-w-md text-xs leading-5 text-[color:var(--app-text-soft)]">
        {description}
      </p>
      <button
        type="button"
        onClick={onAction}
        className="ui-button-secondary mt-4 inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-black"
      >
        <Plus className="h-4 w-4" />
        {actionLabel}
      </button>
    </div>
  );
}

function getFileName(url: string): string {
  try {
    const parsed = new URL(url);
    const name = parsed.pathname.split('/').filter(Boolean).pop();
    return decodeURIComponent(name || 'Dokumen profil');
  } catch {
    const name = url.split('/').filter(Boolean).pop();
    return decodeURIComponent(name || 'Dokumen profil');
  }
}

export default function EditProfilePage() {
  const { user, authFetch, loading: authLoading, refreshUser } = useAuth();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phone, setPhone] = useState('');
  const [verifiedPhoneDigits, setVerifiedPhoneDigits] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpMessage, setPhoneOtpMessage] = useState<string | null>(null);
  const [phoneOtpError, setPhoneOtpError] = useState<string | null>(null);
  const [phoneOtpResendAt, setPhoneOtpResendAt] = useState(0);
  const [sendingPhoneOtp, setSendingPhoneOtp] = useState(false);
  const [confirmingPhoneOtp, setConfirmingPhoneOtp] = useState(false);
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [roles, setRoles] = useState('');

  const [headline, setHeadline] = useState('');
  const [skills, setSkills] = useState('');
  const [languages, setLanguages] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [portfolioUrls, setPortfolioUrls] = useState('');

  const [providerHeadline, setProviderHeadline] = useState('');
  const [providerSkills, setProviderSkills] = useState('');
  const [serviceCoverage, setServiceCoverage] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [responseTime, setResponseTime] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  const [buyerIntent, setBuyerIntent] = useState('');
  const [buyerBudgetMin, setBuyerBudgetMin] = useState('');
  const [buyerBudgetMax, setBuyerBudgetMax] = useState('');
  const [preferredSector, setPreferredSector] = useState('');
  const [preferredSubSector, setPreferredSubSector] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');

  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [coverImageUrl, setCoverImageUrl] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [cropSource, setCropSource] = useState('');
  const [cropTarget, setCropTarget] = useState<'avatar' | 'cover' | null>(null);
  const [educationEntries, setEducationEntries] = useState<ProfileEntry[]>([]);
  const [certificateEntries, setCertificateEntries] = useState<ProfileEntry[]>(
    [],
  );
  const [experienceEntries, setExperienceEntries] = useState<ProfileEntry[]>(
    [],
  );
  const [linkEntries, setLinkEntries] = useState<LinkEntry[]>([]);
  const [baseMetadata, setBaseMetadata] = useState<ProfileMap>({});
  const [activeFocus, setActiveFocus] = useState<EditFocus>('identity');
  const [educationEditorOpen, setEducationEditorOpen] = useState(false);
  const [educationEditorIndex, setEducationEditorIndex] = useState<
    number | null
  >(null);
  const [educationDraft, setEducationDraft] = useState<ProfileEntry>(
    createEmptyProfileEntry(),
  );

  useEffect(() => {
    const load = async () => {
      if (!user?.id) {
        setLoading(false);
        return;
      }
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(`/api/users/${user.id}`);
        const data = (await res.json().catch(() => ({}))) as UserDetail & {
          error?: string;
        };
        if (!res.ok) throw new Error(data.error || 'Failed to load profile');

        const meta = asObject(data.metadata);
        const freelancer = asObject(meta.freelancer_profile);
        const provider = asObject(meta.provider_profile);
        const buyer = asObject(meta.buyer_profile);
        const metaMedia = asObject(meta.media);
        const profileMeta = asObject(meta.profile);
        const verification = asObject(data.verification);
        const nextPhone = asString(data.phone);
        setBaseMetadata(meta);

        setFullName(asString(data.full_name));
        setUsername(normalizePublicProfileHandleInput(asString(data.username)));
        setPhone(nextPhone);
        setVerifiedPhoneDigits(normalizePhoneDigits(nextPhone));
        setPhoneVerified(
          Boolean(data.phone_verified ?? verification.phone_verified),
        );
        setPhoneOtp('');
        setPhoneOtpMessage(null);
        setPhoneOtpError(null);
        setLocation(asString(data.location));
        setBio(asString(data.bio));
        setRoles(joinList(toStringList(meta.roles)));
        setAvatarUrl(
          normalizeProfileMediaUrl(data.avatar_url) ||
            normalizeProfileMediaUrl(meta.avatar_url) ||
            normalizeProfileMediaUrl(metaMedia.avatar_url) ||
            '',
        );

        setHeadline(
          asString(freelancer.professional_title) ||
            asString(freelancer.tagline),
        );
        setSkills(joinList(toStringList(freelancer.skills)));
        setLanguages(joinList(toStringList(freelancer.languages)));
        setHourlyRate(asString(freelancer.hourly_rate));
        setExperienceYears(asString(freelancer.experience_years));
        setPortfolioUrls(joinList(toStringList(freelancer.portfolio_urls)));

        setProviderHeadline(asString(provider.headline));
        setProviderSkills(joinList(toStringList(provider.skills)));
        setServiceCoverage(joinList(toStringList(provider.service_coverage)));
        setWorkMode(asString(provider.work_mode));
        setResponseTime(asString(provider.response_time));
        setPriceMin(asString(provider.price_min));
        setPriceMax(asString(provider.price_max));

        setBuyerIntent(asString(buyer.intent));
        setBuyerBudgetMin(asString(buyer.budget_min));
        setBuyerBudgetMax(asString(buyer.budget_max));
        setPreferredSector(asString(buyer.preferred_sector));
        setPreferredSubSector(asString(buyer.preferred_sub_sector));
        setPreferredLocation(asString(buyer.preferred_location));

        setGalleryImages(
          normalizeProfileMediaList(
            meta.gallery_images || metaMedia.gallery_images,
          ),
        );
        setDocumentUrls(
          normalizeProfileMediaList(meta.documents || metaMedia.documents),
        );
        setCoverImageUrl(
          normalizeProfileMediaUrl(data.cover_image) ||
            normalizeProfileMediaUrl(meta.cover_image) ||
            normalizeProfileMediaUrl(metaMedia.cover_image) ||
            '',
        );
        const educationSource =
          (Array.isArray(freelancer.education) ? freelancer.education : null) ||
          (Array.isArray(meta.education) ? meta.education : null) ||
          [];
        setEducationEntries(
          educationSource
            .map(entry => normalizeEntry(entry))
            .filter((entry): entry is ProfileEntry => Boolean(entry)),
        );
        const certificateSource =
          (Array.isArray(freelancer.certifications)
            ? freelancer.certifications
            : null) ||
          (Array.isArray(freelancer.certificates)
            ? freelancer.certificates
            : null) ||
          (Array.isArray(meta.certifications) ? meta.certifications : null) ||
          (Array.isArray(meta.certificate) ? meta.certificate : null) ||
          [];
        setCertificateEntries(
          certificateSource
            .map(entry => normalizeEntry(entry))
            .filter((entry): entry is ProfileEntry => Boolean(entry)),
        );
        const experienceSource =
          (Array.isArray(freelancer.experiences)
            ? freelancer.experiences
            : null) ||
          (Array.isArray(freelancer.experience)
            ? freelancer.experience
            : null) ||
          (Array.isArray(meta.experiences) ? meta.experiences : null) ||
          (Array.isArray(meta.experience) ? meta.experience : null) ||
          [];
        setExperienceEntries(
          experienceSource
            .map(entry => normalizeEntry(entry))
            .filter((entry): entry is ProfileEntry => Boolean(entry)),
        );

        const normalizeLink = (value: unknown): LinkEntry | null => {
          if (typeof value === 'string') {
            const url = value.trim();
            return url ? { label: 'Link', url } : null;
          }
          if (!value || typeof value !== 'object' || Array.isArray(value))
            return null;
          const row = value as ProfileMap;
          const url = asString(row.url) || asString(row.link);
          if (!url) return null;
          return {
            label: asString(row.label) || asString(row.title) || 'Link',
            url,
          };
        };

        const knownLinks: LinkEntry[] = [
          { label: 'Portfolio', url: asString(profileMeta.portfolio_url) },
          { label: 'Website', url: asString(profileMeta.website) },
          { label: 'LinkedIn', url: asString(profileMeta.linkedin_url) },
          { label: 'GitHub', url: asString(profileMeta.github_url) },
        ].filter(item => item.url);

        const extraLinks = Array.isArray(profileMeta.links)
          ? profileMeta.links
              .map(normalizeLink)
              .filter((item): item is LinkEntry => Boolean(item))
          : [];

        const mergedLinks = [...knownLinks, ...extraLinks].reduce<LinkEntry[]>(
          (acc, item) => {
            if (acc.find(entry => entry.url === item.url)) return acc;
            acc.push(item);
            return acc;
          },
          [],
        );
        setLinkEntries(mergedLinks);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load profile');
      } finally {
        setLoading(false);
      }
    };

    if (!authLoading) void load();
  }, [authFetch, authLoading, user?.id]);

  const locale = useMemo(() => resolveLocaleFromPathname(pathname), [pathname]);

  const publicProfilePath = useMemo(
    () =>
      buildPublicProfileHref(
        {
          id: user?.id,
          username,
          full_name: fullName || user?.full_name || user?.email || 'member',
        },
        `/${locale}/profile`,
      ),
    [fullName, locale, user?.email, user?.full_name, user?.id, username],
  );

  const publicProfileDisplayUrl = useMemo(
    () => `www.lajukan.com${publicProfilePath}`,
    [publicProfilePath],
  );

  const profileChecklist = useMemo<ProfileChecklistItem[]>(
    () => [
      {
        key: 'fullName',
        label: 'Nama yang ditampilkan',
        focus: 'identity',
        done: Boolean(fullName.trim()),
      },
      {
        key: 'location',
        label: 'Kota atau area',
        focus: 'identity',
        done: Boolean(location.trim()),
      },
      {
        key: 'bio',
        label: 'Perkenalan singkat',
        focus: 'identity',
        done: Boolean(bio.trim()),
      },
      {
        key: 'avatar',
        label: 'Foto profil',
        focus: 'media',
        done: Boolean(avatarUrl.trim()),
      },
      {
        key: 'headline',
        label: 'Judul keahlian profesional',
        focus: 'work',
        done: Boolean(headline.trim()),
      },
      {
        key: 'skills',
        label: 'Keahlian utama',
        focus: 'work',
        done: Boolean(skills.trim()),
      },
      {
        key: 'provider',
        label: 'Nama usaha atau layanan',
        focus: 'work',
        done: Boolean(providerHeadline.trim()),
      },
      {
        key: 'buyerIntent',
        label: 'Barang atau jasa yang dicari',
        focus: 'work',
        done: Boolean(buyerIntent.trim()),
      },
      {
        key: 'gallery',
        label: 'Foto galeri',
        focus: 'media',
        done: galleryImages.length > 0,
      },
      {
        key: 'education',
        label: 'Pendidikan',
        focus: 'work',
        done: educationEntries.length > 0,
      },
      {
        key: 'certificates',
        label: 'Sertifikat',
        focus: 'work',
        done: certificateEntries.length > 0,
      },
      {
        key: 'experience',
        label: 'Pengalaman',
        focus: 'work',
        done: experienceEntries.length > 0,
      },
    ],
    [
      avatarUrl,
      bio,
      buyerIntent,
      certificateEntries.length,
      educationEntries.length,
      experienceEntries.length,
      fullName,
      galleryImages.length,
      headline,
      location,
      providerHeadline,
      skills,
    ],
  );

  const profileScore = useMemo(() => {
    const complete = profileChecklist.filter(item => item.done).length;
    return Math.round((complete / profileChecklist.length) * 100);
  }, [profileChecklist]);

  const nextProfileTask = useMemo(
    () => profileChecklist.find(item => !item.done) || null,
    [profileChecklist],
  );

  const completedProfileItems = useMemo(
    () => profileChecklist.filter(item => item.done).length,
    [profileChecklist],
  );

  const phoneDigits = useMemo(() => normalizePhoneDigits(phone), [phone]);
  const phoneVerificationReady = useMemo(
    () =>
      phoneVerified &&
      phoneDigits.length >= 8 &&
      phoneDigits === verifiedPhoneDigits,
    [phoneDigits, phoneVerified, verifiedPhoneDigits],
  );
  const phoneNeedsVerification =
    phoneDigits.length >= 8 && !phoneVerificationReady;

  useEffect(() => {
    if (phoneDigits === verifiedPhoneDigits) return;
    setPhoneOtp('');
    setPhoneOtpMessage(null);
    setPhoneOtpError(null);
  }, [phoneDigits, verifiedPhoneDigits]);

  const focusSections = useMemo(
    () => [
      {
        key: 'identity' as const,
        title: 'Informasi utama',
        description: 'Nama, lokasi, kontak, dan perkenalan singkat.',
        targetId: 'profile-edit-identity',
      },
      {
        key: 'work' as const,
        title: 'Keahlian & kebutuhan',
        description: 'Yang kamu tawarkan atau sedang kamu cari.',
        targetId: 'profile-edit-talent',
      },
      {
        key: 'media' as const,
        title: 'Foto & dokumen',
        description: 'Foto profil, sampul, galeri, dan dokumen pendukung.',
        targetId: 'profile-edit-media',
      },
    ],
    [],
  );

  const setFocusSection = (focus: EditFocus) => {
    setActiveFocus(focus);
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    url.searchParams.set('focus', focus);
    window.history.replaceState(
      {},
      '',
      `${url.pathname}${url.search}${url.hash}`,
    );
  };

  const focusAndScrollSection = (focus: EditFocus) => {
    setFocusSection(focus);
    if (typeof window === 'undefined') return;

    const target = focusSections.find(section => section.key === focus);
    window.setTimeout(() => {
      if (!target) return;
      document
        .getElementById(target.targetId)
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 0);
  };

  useEffect(() => {
    const raw = searchParams.get('focus');
    const nextFocus =
      raw === 'identity'
        ? 'identity'
        : raw === 'media'
          ? 'media'
          : raw === 'work' ||
              raw === 'talent' ||
              raw === 'seller' ||
              raw === 'buyer'
            ? 'work'
            : null;
    if (!nextFocus) return;
    setActiveFocus(nextFocus);
  }, [focusSections, searchParams]);

  const activeFocusSection =
    focusSections.find(section => section.key === activeFocus) ||
    focusSections[0];

  const focusProgress = useMemo(() => {
    const progress = focusSections.reduce(
      (acc, section) => {
        const items = profileChecklist.filter(
          item => item.focus === section.key,
        );
        const complete = items.filter(item => item.done).length;
        acc[section.key] = {
          complete,
          total: items.length,
          percent:
            items.length > 0 ? Math.round((complete / items.length) * 100) : 0,
        };
        return acc;
      },
      {} as Record<
        EditFocus,
        { complete: number; total: number; percent: number }
      >,
    );
    return progress;
  }, [focusSections, profileChecklist]);

  const activeFocusProgress = focusProgress[activeFocus] || {
    complete: 0,
    total: 0,
    percent: 0,
  };

  const activeFocusChecklist = useMemo(
    () => profileChecklist.filter(item => item.focus === activeFocus),
    [activeFocus, profileChecklist],
  );

  const activeFocusMissingCount = useMemo(
    () => activeFocusChecklist.filter(item => !item.done).length,
    [activeFocusChecklist],
  );

  const inputClass =
    'ui-control ui-data-control min-h-11 w-full rounded-xl px-3 text-sm focus:border-[color:var(--app-accent-border)] focus:ring-2 focus:ring-[color:var(--app-accent-soft)]';
  const textareaClass =
    'ui-control ui-data-control ui-data-textarea w-full rounded-xl px-3 py-2 text-sm focus:border-[color:var(--app-accent-border)] focus:ring-2 focus:ring-[color:var(--app-accent-soft)]';

  const isFocusVisible = (
    focus: 'identity' | 'talent' | 'seller' | 'buyer' | 'media',
  ) => {
    if (activeFocus === 'identity') return focus === 'identity';
    if (activeFocus === 'media') return focus === 'media';
    return focus === 'talent' || focus === 'seller' || focus === 'buyer';
  };

  const sectionCardClass = (
    focus: 'identity' | 'talent' | 'seller' | 'buyer' | 'media',
  ) =>
    `ui-panel scroll-mt-24 p-4 transition sm:p-5 lg:p-6 ${
      isFocusVisible(focus)
        ? 'border-emerald-300 shadow-[0_20px_45px_-32px_rgba(16,185,129,0.35)] dark:border-emerald-900/70'
        : 'hidden'
    }`;

  const saveDisabled =
    saving ||
    uploadingImages ||
    uploadingDocs ||
    uploadingCover ||
    uploadingAvatar;

  const sendPhoneOtp = async () => {
    if (phoneDigits.length < 8) {
      setPhoneOtpError('Masukkan nomor WhatsApp yang valid terlebih dahulu.');
      return;
    }
    if (phoneOtpResendAt > Date.now()) {
      setPhoneOtpError('Tunggu sebentar sebelum kirim ulang OTP.');
      return;
    }

    setSendingPhoneOtp(true);
    setPhoneOtpError(null);
    setPhoneOtpMessage(null);

    try {
      const res = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'phone',
          target: phoneDigits,
          purpose: 'profile',
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!res.ok) {
        throw new Error(data.error || 'Gagal mengirim OTP telepon');
      }

      setPhoneOtp('');
      setPhoneOtpResendAt(Date.now() + 30_000);
      setPhoneOtpMessage(
        'Kode OTP sudah dikirim. Masukkan 6 digit kode untuk verifikasi.',
      );
    } catch (err) {
      setPhoneOtpError(
        err instanceof Error ? err.message : 'Gagal mengirim OTP telepon',
      );
    } finally {
      setSendingPhoneOtp(false);
    }
  };

  const verifyPhoneOtp = async () => {
    if (phoneDigits.length < 8) {
      setPhoneOtpError('Nomor WhatsApp belum valid.');
      return;
    }
    if (!/^\d{6}$/.test(phoneOtp)) {
      setPhoneOtpError('Masukkan OTP 6 digit.');
      return;
    }

    setConfirmingPhoneOtp(true);
    setPhoneOtpError(null);
    setPhoneOtpMessage(null);

    try {
      const verifyRes = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'phone',
          target: phoneDigits,
          otp: phoneOtp,
          purpose: 'profile',
        }),
      });
      const verifyData = (await verifyRes.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
      };
      if (!verifyRes.ok) {
        throw new Error(verifyData.error || 'Kode OTP tidak valid');
      }
      if (!verifyData.token) {
        throw new Error('Data verifikasi nomor tidak ditemukan');
      }

      const confirmRes = await authFetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: phoneDigits,
          phone_otp_token: verifyData.token,
        }),
      });
      const confirmData = (await confirmRes.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!confirmRes.ok) {
        throw new Error(
          confirmData.error || 'Gagal menyimpan verifikasi nomor',
        );
      }

      setPhone(phoneDigits);
      setVerifiedPhoneDigits(phoneDigits);
      setPhoneVerified(true);
      setPhoneOtp('');
      setPhoneOtpMessage('Nomor WhatsApp berhasil diverifikasi.');
      await refreshUser();
    } catch (err) {
      setPhoneOtpError(
        err instanceof Error ? err.message : 'Verifikasi nomor gagal',
      );
    } finally {
      setConfirmingPhoneOtp(false);
    }
  };

  const uploadImages = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setUploadingImages(true);
    setError(null);
    try {
      const optimizedFiles = await prepareUploadFiles(Array.from(files));
      const formData = new FormData();
      optimizedFiles.forEach(file => formData.append('images', file));
      const res = await authFetch('/api/content/upload-images', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        urls?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah gambar');
      const next = Array.from(
        new Set([...(galleryImages || []), ...extractUploadedImageUrls(data)]),
      );
      setGalleryImages(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah gambar');
    } finally {
      setUploadingImages(false);
      event.target.value = '';
    }
  };

  const uploadCoverFile = async (file: File) => {
    setUploadingCover(true);
    setError(null);
    try {
      const optimizedFile = await prepareUploadFile(file);
      const formData = new FormData();
      formData.append('images', optimizedFile);
      const res = await authFetch('/api/content/upload-images', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        urls?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah foto sampul');
      const url = extractFirstUploadedImageUrl(data) || '';
      if (!url) throw new Error('Alamat foto sampul tidak ditemukan');
      setCoverImageUrl(url);
      await persistPartialUpdate(
        {
          cover_image: url,
          media: {
            cover_image: url,
          },
        },
        'Cover berhasil diperbarui.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah foto sampul');
    } finally {
      setUploadingCover(false);
    }
  };

  const uploadAvatarFile = async (file: File) => {
    setUploadingAvatar(true);
    setError(null);
    try {
      const optimizedFile = await prepareUploadFile(file);
      const formData = new FormData();
      formData.append('images', optimizedFile);
      const res = await authFetch('/api/content/upload-images', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        urls?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah foto profil');
      const url = extractFirstUploadedImageUrl(data) || '';
      if (!url) throw new Error('Alamat foto profil tidak ditemukan');
      setAvatarUrl(url);
      await persistPartialUpdate(
        {
          avatar_url: url,
          media: {
            avatar_url: url,
          },
        },
        'Foto profil berhasil diperbarui.',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah foto profil');
    } finally {
      setUploadingAvatar(false);
    }
  };

  const openCropper = (file: File, target: 'avatar' | 'cover') => {
    if (cropSource) URL.revokeObjectURL(cropSource);
    const url = URL.createObjectURL(file);
    setCropSource(url);
    setCropTarget(target);
  };

  const closeCropper = () => {
    if (cropSource) URL.revokeObjectURL(cropSource);
    setCropSource('');
    setCropTarget(null);
  };

  const handleCropConfirm = async (file: File) => {
    if (!cropTarget) return;
    if (cropTarget === 'avatar') {
      await uploadAvatarFile(file);
      closeCropper();
      return;
    }
    await uploadCoverFile(file);
    closeCropper();
  };

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    openCropper(file, 'avatar');
  };

  const handleCoverChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    openCropper(file, 'cover');
  };

  const uploadDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;
    setUploadingDocs(true);
    setError(null);
    try {
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('files', file));
      const res = await authFetch('/api/content/upload-files', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        urls?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Gagal mengunggah dokumen');
      const next = Array.from(
        new Set([
          ...(documentUrls || []),
          ...extractUploadedDocumentUrls(data),
        ]),
      );
      setDocumentUrls(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal mengunggah dokumen');
    } finally {
      setUploadingDocs(false);
      event.target.value = '';
    }
  };

  const persistPartialUpdate = async (
    partial: Record<string, unknown>,
    successMessage: string,
  ) => {
    try {
      const res = await authFetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui profil');
      setMessage(successMessage);
      await refreshUser();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal memperbarui profil',
      );
    }
  };

  const removeImage = (url: string) =>
    setGalleryImages(prev => prev.filter(item => item !== url));
  const removeDoc = (url: string) =>
    setDocumentUrls(prev => prev.filter(item => item !== url));
  const addEducation = () => {
    setEducationEditorIndex(null);
    setEducationDraft(createEmptyProfileEntry());
    setEducationEditorOpen(true);
  };
  const editEducation = (index: number) => {
    const current = educationEntries[index];
    if (!current) return;
    setEducationEditorIndex(index);
    setEducationDraft({
      title: current.title || '',
      subtitle: current.subtitle || '',
      meta: current.meta || '',
      url: current.url || '',
    });
    setEducationEditorOpen(true);
  };
  const removeEducation = (index: number) => {
    setEducationEntries(prev => prev.filter((_, idx) => idx !== index));
  };
  const closeEducationEditor = () => {
    setEducationEditorOpen(false);
    setEducationEditorIndex(null);
    setEducationDraft(createEmptyProfileEntry());
  };
  const saveEducationDraft = () => {
    const nextEntry: ProfileEntry = {
      title: educationDraft.title.trim(),
      subtitle: educationDraft.subtitle?.trim() || undefined,
      meta: educationDraft.meta?.trim() || undefined,
      url: educationDraft.url?.trim() || undefined,
    };
    if (!nextEntry.title) {
      setError('Nama institusi / gelar wajib diisi.');
      return;
    }

    setEducationEntries(prev => {
      if (educationEditorIndex === null) return [...prev, nextEntry];
      return prev.map((entry, idx) =>
        idx === educationEditorIndex ? nextEntry : entry,
      );
    });
    setMessage(
      educationEditorIndex === null
        ? 'Pendidikan berhasil ditambahkan.'
        : 'Pendidikan berhasil diperbarui.',
    );
    setError(null);
    closeEducationEditor();
  };

  const updateCertificate = (
    index: number,
    field: keyof ProfileEntry,
    value: string,
  ) => {
    setCertificateEntries(prev =>
      prev.map((entry, idx) =>
        idx === index ? { ...entry, [field]: value } : entry,
      ),
    );
  };
  const addCertificate = () => {
    setCertificateEntries(prev => [
      ...prev,
      { title: '', subtitle: '', meta: '', url: '' },
    ]);
  };
  const removeCertificate = (index: number) => {
    setCertificateEntries(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateExperience = (
    index: number,
    field: keyof ProfileEntry,
    value: string,
  ) => {
    setExperienceEntries(prev =>
      prev.map((entry, idx) =>
        idx === index ? { ...entry, [field]: value } : entry,
      ),
    );
  };
  const addExperience = () => {
    setExperienceEntries(prev => [
      ...prev,
      { title: '', subtitle: '', meta: '', url: '' },
    ]);
  };
  const removeExperience = (index: number) => {
    setExperienceEntries(prev => prev.filter((_, idx) => idx !== index));
  };

  const updateLink = (index: number, field: keyof LinkEntry, value: string) => {
    setLinkEntries(prev =>
      prev.map((entry, idx) =>
        idx === index ? { ...entry, [field]: value } : entry,
      ),
    );
  };
  const addLink = () => {
    setLinkEntries(prev => [...prev, { label: '', url: '' }]);
  };
  const removeLink = (index: number) => {
    setLinkEntries(prev => prev.filter((_, idx) => idx !== index));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    setError(null);
    try {
      const toList = (value: string) =>
        value
          .split(/[,\n;|]/g)
          .map(item => item.trim())
          .filter(Boolean);
      const toInt = (value: string) => {
        const parsed = Number.parseInt(value, 10);
        return Number.isFinite(parsed) ? parsed : undefined;
      };

      const profilePayload = {
        portfolio_url: linkEntries.find(
          item => item.label.toLowerCase() === 'portfolio',
        )?.url,
        website: linkEntries.find(
          item => item.label.toLowerCase() === 'website',
        )?.url,
        linkedin_url: linkEntries.find(
          item => item.label.toLowerCase() === 'linkedin',
        )?.url,
        github_url: linkEntries.find(
          item => item.label.toLowerCase() === 'github',
        )?.url,
        links: linkEntries
          .map(item => ({
            label: item.label.trim() || 'Link',
            url: item.url.trim(),
          }))
          .filter(item => item.url),
      };

      const freelancerPayload = {
        professional_title: headline || undefined,
        tagline: headline || undefined,
        skills: toList(skills),
        languages: toList(languages),
        hourly_rate: toInt(hourlyRate),
        experience_years: toInt(experienceYears),
        portfolio_urls: toList(portfolioUrls),
        certifications: certificateEntries
          .map(entry => ({
            title: entry.title.trim(),
            subtitle: entry.subtitle?.trim() || undefined,
            meta: entry.meta?.trim() || undefined,
            url: entry.url?.trim() || undefined,
          }))
          .filter(entry => entry.title),
        experiences: experienceEntries
          .map(entry => ({
            title: entry.title.trim(),
            subtitle: entry.subtitle?.trim() || undefined,
            meta: entry.meta?.trim() || undefined,
            url: entry.url?.trim() || undefined,
          }))
          .filter(entry => entry.title),
        education: educationEntries
          .map(entry => ({
            title: entry.title.trim(),
            subtitle: entry.subtitle?.trim() || undefined,
            meta: entry.meta?.trim() || undefined,
            url: entry.url?.trim() || undefined,
          }))
          .filter(entry => entry.title),
      };

      const providerPayload = {
        headline: providerHeadline || undefined,
        skills: toList(providerSkills),
        service_coverage: toList(serviceCoverage),
        work_mode: workMode || undefined,
        response_time: responseTime || undefined,
        price_min: toInt(priceMin),
        price_max: toInt(priceMax),
      };

      const buyerPayload = {
        intent: buyerIntent || undefined,
        budget_min: toInt(buyerBudgetMin),
        budget_max: toInt(buyerBudgetMax),
        preferred_sector: preferredSector || undefined,
        preferred_sub_sector: preferredSubSector || undefined,
        preferred_location: preferredLocation || undefined,
      };

      const mediaPayload = {
        gallery_images: galleryImages,
        documents: documentUrls,
        cover_image: coverImageUrl || undefined,
      };

      const baseMeta = asObject(baseMetadata);
      const metadataPayload = {
        ...baseMeta,
        roles: toList(roles),
        avatar_url: avatarUrl || undefined,
        cover_image: coverImageUrl || undefined,
        profile: { ...asObject(baseMeta.profile), ...profilePayload },
        freelancer_profile: {
          ...asObject(baseMeta.freelancer_profile),
          ...freelancerPayload,
        },
        provider_profile: {
          ...asObject(baseMeta.provider_profile),
          ...providerPayload,
        },
        buyer_profile: { ...asObject(baseMeta.buyer_profile), ...buyerPayload },
        media: { ...asObject(baseMeta.media), ...mediaPayload },
        gallery_images: galleryImages,
        documents: documentUrls,
      };

      const payload: Record<string, unknown> = {
        full_name: fullName || undefined,
        username: username || undefined,
        phone: phone || undefined,
        location: location || undefined,
        bio: bio || undefined,
        roles: toList(roles),
        avatar_url: avatarUrl || undefined,
        cover_image: coverImageUrl || undefined,
        onboarding_step: 'advanced_profile',
        image_urls: galleryImages,
        document_urls: documentUrls,
        profile: profilePayload,
        freelancer_profile: freelancerPayload,
        provider_profile: providerPayload,
        buyer_profile: buyerPayload,
        media: mediaPayload,
        metadata: metadataPayload,
      };

      const res = await authFetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profil');
      setMessage('Profil berhasil disimpan.');
      setBaseMetadata(metadataPayload);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan profil');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <ProfileEditSkeleton />;
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-0 py-10 sm:px-2">
        <p className="ui-panel-muted rounded-none border-x-0 border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] p-4 text-sm ui-warning-text sm:rounded-[var(--app-radius)] sm:border-x">
          Login diperlukan untuk edit profile.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-[color:var(--app-surface-muted)] pb-[calc(8rem+env(safe-area-inset-bottom))] pt-3 dark:bg-[color:var(--app-surface-strong)] sm:pt-5">
      <div className="page-shell page-shell-readable mx-auto max-w-6xl overflow-x-hidden">
        <section className="ui-panel mb-4 overflow-hidden p-0">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_360px] lg:items-stretch">
            <div className="relative overflow-hidden border-b border-[color:var(--app-border)] bg-[linear-gradient(135deg,rgba(16,185,129,0.14),transparent_44%),linear-gradient(180deg,var(--app-surface-strong),var(--app-surface-strong))] p-4 dark:border-[color:var(--app-border-strong)] sm:p-6 lg:border-b-0 lg:border-r">
              <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full bg-emerald-300/15 blur-2xl" />

              <div className="relative flex h-full flex-col justify-between">
                <div>
                  <LocalizedLink
                    href="/profile"
                    className="inline-flex min-h-9 items-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-xs font-bold text-[color:var(--app-text-soft)] transition hover:border-emerald-300 hover:text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)]"
                  >
                    <ArrowLeft className="h-4 w-4" />
                    Kembali ke profil
                  </LocalizedLink>

                  <div className="mt-5 max-w-2xl">
                    <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">
                      Pengaturan profil
                    </p>
                    <h1 className="mt-2 text-2xl font-black tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-3xl">
                      Buat profil yang langsung dipahami
                    </h1>
                    <p className="mt-3 max-w-xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                      Isi informasi penting saja. Jelaskan siapa kamu, apa yang kamu
                      tawarkan atau cari, dan bagaimana orang bisa menghubungimu.
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid gap-2 sm:grid-cols-2 lg:max-w-md">
                  <LocalizedLink
                    href={publicProfilePath}
                    className="ui-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-bold"
                  >
                    <Globe2 className="h-4 w-4" />
                    Lihat sebagai pengunjung
                  </LocalizedLink>
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={saveDisabled}
                    className="ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {saving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    Simpan perubahan
                  </button>
                </div>
              </div>
            </div>

            <aside className="flex h-full min-h-[280px] flex-col bg-[color:var(--app-surface-strong)]">
              <div className="border-b border-[color:var(--app-border)] p-4 dark:border-[color:var(--app-border-strong)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold text-[color:var(--app-text-soft)]">
                      Pratinjau singkat
                    </p>
                    <p className="mt-0.5 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      Tampilan profilmu
                    </p>
                  </div>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                    {profileScore}%
                  </span>
                </div>
              </div>

              <div className="flex flex-1 flex-col justify-between p-4">
                <div>
                  <div className="flex items-center gap-3">
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-full border-2 border-white bg-[color:var(--app-surface-muted)] shadow-sm dark:border-slate-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={profileAvatarSrc(
                          avatarUrl,
                          readProfileAvatarStyle(baseMetadata) ||
                            readProfileAvatarStyle(user),
                          fullName || user?.full_name || user?.email,
                        )}
                        alt="Pratinjau foto profil"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-base font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        {fullName.trim() || 'Nama kamu'}
                      </p>
                      <p className="mt-0.5 truncate text-xs font-semibold text-[color:var(--app-text-soft)]">
                        @{username || 'alamat-profil'}
                      </p>
                      <p className="mt-1 flex items-center gap-1 truncate text-xs text-[color:var(--app-text-soft)]">
                        <MapPin className="h-3.5 w-3.5 shrink-0" />
                        {location.trim() || 'Kota atau area belum diisi'}
                      </p>
                    </div>
                  </div>

                  <p className="mt-4 line-clamp-3 min-h-[60px] text-sm leading-5 text-[color:var(--app-text-soft)]">
                    {bio.trim() ||
                      'Tulis penjelasan singkat tentang usaha, layanan, keahlian, atau kebutuhanmu.'}
                  </p>
                </div>

                <div className="mt-5">
                  <div className="h-2 overflow-hidden rounded-full bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface)]">
                    <div
                      className="h-full rounded-full bg-emerald-600 transition-[width] duration-500"
                      style={{ width: `${profileScore}%` }}
                    />
                  </div>
                  <p className="mt-2 text-xs text-[color:var(--app-text-soft)]">
                    {completedProfileItems} dari {profileChecklist.length} informasi
                    penting sudah diisi.
                  </p>
                </div>
              </div>
            </aside>
          </div>
        </section>

        {error ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] p-4 text-sm ui-danger-text">
            <CircleAlert className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {message ? (
          <div className="mb-4 flex items-start gap-3 rounded-2xl border border-[color:var(--app-success-border)] bg-[color:var(--app-success-soft)] p-4 text-sm font-semibold text-[color:var(--app-success)]">
            <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
            <span>{message}</span>
          </div>
        ) : null}

        <section className="ui-panel mb-4 overflow-hidden p-0">
          <div className="border-b border-[color:var(--app-border)] p-4 dark:border-[color:var(--app-border-strong)] sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  Lengkapi dalam 3 langkah
                </p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                  Kamu tidak harus mengisi semuanya sekaligus. Mulai dari bagian
                  yang paling penting.
                </p>
              </div>
              {nextProfileTask ? (
                <button
                  type="button"
                  onClick={() => focusAndScrollSection(nextProfileTask.focus)}
                  className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-amber-50 px-3 text-xs font-black text-amber-800 transition hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-200"
                >
                  <CircleAlert className="h-4 w-4" />
                  Berikutnya: {nextProfileTask.label}
                </button>
              ) : (
                <span className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-xs font-black text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Informasi utama sudah lengkap
                </span>
              )}
            </div>
          </div>

          <div className="grid auto-rows-fr gap-3 p-3 sm:grid-cols-3 sm:p-4">
            {focusSections.map((section, index) => {
              const progress = focusProgress[section.key];
              const active = activeFocus === section.key;

              return (
                <button
                  key={section.key}
                  type="button"
                  onClick={() => focusAndScrollSection(section.key)}
                  className={`group flex h-full min-h-[112px] flex-col rounded-2xl border p-4 text-left transition ${
                    active
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm dark:bg-emerald-500/10'
                      : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] hover:border-emerald-300 hover:bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)]'
                  }`}
                >
                  <span className="flex items-center justify-between gap-3">
                    <span
                      className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-black ${
                        active
                          ? 'bg-emerald-600 text-white'
                          : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)] dark:bg-white/10'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="rounded-full bg-white/80 px-2 py-1 text-[10px] font-black text-[color:var(--app-text-soft)] dark:bg-white/10">
                      {progress.complete}/{progress.total}
                    </span>
                  </span>
                  <span className="mt-3 block text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {section.title}
                  </span>
                  <span className="mt-1 block min-h-10 line-clamp-2 text-xs leading-5 text-[color:var(--app-text-soft)]">
                    {section.description}
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        <div className="mb-4 grid auto-rows-fr gap-4 md:grid-cols-2">
          <section className="ui-panel flex h-full flex-col p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  Checklist langkah aktif
                </p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                  {activeFocusMissingCount > 0
                    ? `${activeFocusMissingCount} informasi masih perlu diisi.`
                    : 'Semua informasi pada langkah ini sudah diisi.'}
                </p>
              </div>
              <span
                className={cn(
                  'rounded-full px-2.5 py-1 text-[10px] font-black',
                  activeFocusMissingCount > 0
                    ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
                    : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300',
                )}
              >
                {activeFocusProgress.complete}/{activeFocusProgress.total}
              </span>
            </div>

            <div className="mt-4 grid flex-1 gap-2 sm:grid-cols-2">
              {activeFocusChecklist.map(item =>
                item.done ? (
                  <div
                    key={item.key}
                    className="flex min-h-11 items-center gap-2 rounded-xl bg-emerald-50 px-3 text-xs font-bold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300"
                  >
                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 truncate">{item.label}</span>
                  </div>
                ) : (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => focusAndScrollSection(item.focus)}
                    className="flex min-h-11 w-full items-center gap-2 rounded-xl bg-amber-50 px-3 text-left text-xs font-bold text-amber-800 transition hover:bg-amber-100 dark:bg-amber-500/10 dark:text-amber-200"
                  >
                    <CircleAlert className="h-4 w-4 shrink-0" />
                    <span className="min-w-0 flex-1 truncate">{item.label}</span>
                    <span className="rounded-lg bg-white px-2 py-1 text-[9px] font-black dark:bg-white/10">
                      Isi
                    </span>
                  </button>
                ),
              )}
            </div>
          </section>

          <section className="ui-panel flex h-full flex-col p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-emerald-950 text-emerald-300">
                <WandSparkles className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  Profil yang mudah dipercaya
                </p>
                <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                  Gunakan foto jelas, bahasa sederhana, lokasi nyata, dan jelaskan
                  manfaat yang bisa kamu berikan.
                </p>
              </div>
            </div>

            <div className="mt-4 grid flex-1 gap-2 sm:grid-cols-2">
              <LocalizedLink
                href={publicProfilePath}
                className="ui-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-black"
              >
                <Globe2 className="h-4 w-4" />
                Periksa profil
              </LocalizedLink>
              {nextProfileTask ? (
                <button
                  type="button"
                  onClick={() => focusAndScrollSection(nextProfileTask.focus)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 text-sm font-black text-amber-800 transition hover:bg-amber-100 dark:bg-amber-500/15 dark:text-amber-200"
                >
                  <CircleAlert className="h-4 w-4" />
                  Isi berikutnya
                </button>
              ) : (
                <div className="flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 text-sm font-black text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Profil sudah rapi
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="min-w-0">
          <div className="min-w-0 space-y-4">
            <section
              id="profile-edit-identity"
              className={sectionCardClass('identity')}
            >
              <SectionHeading
                step="Langkah 1"
                title="Informasi utama"
                description="Informasi ini muncul paling awal ketika orang membuka profilmu."
                icon={<UserRound className="h-5 w-5" />}
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Nama yang ditampilkan"
                  hint="Gunakan nama asli atau nama usaha yang mudah dikenali."
                  required
                >
                  <input
                    className={inputClass}
                    placeholder="Contoh: Fauzan Yanuar"
                    value={fullName}
                    onChange={e => setFullName(e.target.value)}
                  />
                </FormField>

                <FormField
                  label="Alamat profil"
                  hint="Akan menjadi alamat khusus profilmu."
                  required
                >
                  <div className="relative">
                    <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
                    <input
                      className={`${inputClass} pl-9`}
                      placeholder="fauzan-yanuar"
                      value={username}
                      onChange={e =>
                        setUsername(
                          normalizePublicProfileHandleInput(e.target.value),
                        )
                      }
                    />
                  </div>
                </FormField>

                <FormField
                  label="Nomor WhatsApp aktif"
                  hint="Digunakan untuk verifikasi dan kebutuhan transaksi."
                >
                  <div className="relative">
                    <Phone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
                    <input
                      className={`${inputClass} pl-9`}
                      inputMode="tel"
                      placeholder="Contoh: 081234567890"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                    />
                  </div>
                </FormField>

                <FormField
                  label="Kota atau area"
                  hint="Bantu orang menemukanmu berdasarkan lokasi."
                  required
                >
                  <div className="relative">
                    <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
                    <input
                      className={`${inputClass} pl-9`}
                      placeholder="Contoh: Bandung, Jawa Barat"
                      value={location}
                      onChange={e => setLocation(e.target.value)}
                    />
                  </div>
                </FormField>

                <FormField
                  label="Kamu menggunakan Lajukan sebagai"
                  hint="Boleh lebih dari satu, pisahkan dengan koma."
                  className="sm:col-span-2"
                >
                  <input
                    className={inputClass}
                    placeholder="Contoh: penjual, pembeli, penyedia jasa"
                    value={roles}
                    onChange={e => setRoles(e.target.value)}
                  />
                </FormField>

                <FormField
                  label="Perkenalan singkat"
                  hint="Cukup 1–3 kalimat: siapa kamu dan apa yang bisa kamu bantu."
                  required
                  className="sm:col-span-2"
                >
                  <textarea
                    className={`${textareaClass} min-h-[120px]`}
                    placeholder="Contoh: Saya menyediakan jasa pembuatan website untuk UMKM di Bandung. Bisa konsultasi online dan pengerjaan mulai dari 7 hari."
                    value={bio}
                    onChange={e => setBio(e.target.value)}
                  />
                </FormField>
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/60 dark:bg-emerald-500/10">
                <div className="flex items-start gap-3">
                  <Globe2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700 dark:text-emerald-300" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-black text-emerald-900 dark:text-emerald-100">
                      Alamat profilmu
                    </p>
                    <p className="mt-1 text-xs leading-5 text-emerald-800/75 dark:text-emerald-200/75">
                      Bagikan alamat ini agar orang bisa melihat profil, penawaran,
                      dan informasi usahamu.
                    </p>
                    <div className="mt-3 break-all rounded-xl border border-emerald-200 bg-white px-3 py-2.5 text-sm font-bold text-emerald-800 dark:border-emerald-900/70 dark:bg-white/10 dark:text-emerald-200">
                      {publicProfileDisplayUrl}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        Verifikasi nomor WhatsApp
                      </p>
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10px] font-black ${
                          phoneVerificationReady
                            ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300'
                            : phoneNeedsVerification
                              ? 'bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-200'
                              : 'bg-white text-[color:var(--app-text-soft)] dark:bg-white/10'
                        }`}
                      >
                        {phoneVerificationReady
                          ? 'Sudah terverifikasi'
                          : phoneNeedsVerification
                            ? 'Perlu verifikasi'
                            : 'Nomor belum diisi'}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                      Verifikasi membuat akun lebih dipercaya dan dapat membuka
                      fitur transaksi tertentu.
                    </p>
                  </div>
                </div>

                {phoneNeedsVerification ? (
                  <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="Masukkan kode OTP 6 digit"
                      value={phoneOtp}
                      onChange={e =>
                        setPhoneOtp(
                          e.target.value.replace(/\D/g, '').slice(0, 6),
                        )
                      }
                    />
                    <button
                      type="button"
                      onClick={sendPhoneOtp}
                      disabled={sendingPhoneOtp}
                      className="ui-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-bold disabled:opacity-60"
                    >
                      {sendingPhoneOtp ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Kirim kode
                    </button>
                    <button
                      type="button"
                      onClick={verifyPhoneOtp}
                      disabled={confirmingPhoneOtp}
                      className="ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-black disabled:opacity-60"
                    >
                      {confirmingPhoneOtp ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Verifikasi
                    </button>
                  </div>
                ) : null}

                {phoneOtpMessage ? (
                  <p className="mt-3 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                    {phoneOtpMessage}
                  </p>
                ) : null}
                {phoneOtpError ? (
                  <p className="mt-3 text-xs font-semibold ui-danger-text">
                    {phoneOtpError}
                  </p>
                ) : null}
              </div>
            </section>

            <section
              id="profile-edit-talent"
              className={sectionCardClass('talent')}
            >
              <SectionHeading
                step="Langkah 2A"
                title="Keahlian profesional"
                description="Isi bagian ini jika kamu menawarkan kemampuan, pekerjaan freelance, atau jasa profesional."
                icon={<BriefcaseBusiness className="h-5 w-5" />}
                optional
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Judul keahlian"
                  hint="Gunakan istilah yang biasa dicari orang."
                  required
                >
                  <input
                    className={inputClass}
                    placeholder="Contoh: Web Developer untuk UMKM"
                    value={headline}
                    onChange={e => setHeadline(e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Keahlian utama"
                  hint="Pisahkan dengan koma."
                  required
                >
                  <input
                    className={inputClass}
                    placeholder="Contoh: React, Laravel, desain website"
                    value={skills}
                    onChange={e => setSkills(e.target.value)}
                  />
                </FormField>
                <FormField label="Bahasa yang dikuasai">
                  <input
                    className={inputClass}
                    placeholder="Contoh: Indonesia, Inggris"
                    value={languages}
                    onChange={e => setLanguages(e.target.value)}
                  />
                </FormField>
                <FormField label="Lama pengalaman" hint="Isi angka dalam tahun.">
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    placeholder="Contoh: 3"
                    value={experienceYears}
                    onChange={e => setExperienceYears(e.target.value)}
                  />
                </FormField>
                <FormField label="Tarif per jam" hint="Isi angka tanpa titik atau Rp.">
                  <input
                    type="number"
                    min="0"
                    inputMode="numeric"
                    className={inputClass}
                    placeholder="Contoh: 150000"
                    value={hourlyRate}
                    onChange={e => setHourlyRate(e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Link portofolio tambahan"
                  hint="Boleh beberapa link, pisahkan dengan koma atau baris baru."
                  className="sm:col-span-2"
                >
                  <textarea
                    className={`${textareaClass} min-h-[90px]`}
                    placeholder="Contoh: https://portfolio.com, https://behance.net/..."
                    value={portfolioUrls}
                    onChange={e => setPortfolioUrls(e.target.value)}
                  />
                </FormField>
              </div>
            </section>

            <section className={sectionCardClass('talent')}>
              <SectionHeading
                step="Tambahan"
                title="Pendidikan"
                description="Tambahkan pendidikan yang membantu orang memahami latar belakangmu."
                icon={<GraduationCap className="h-5 w-5" />}
                optional
                action={
                  <button
                    type="button"
                    onClick={addEducation}
                    className="ui-button-secondary inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-black"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah pendidikan
                  </button>
                }
              />

              <div className="mt-4">
                {educationEntries.length === 0 ? (
                  <EmptyEditorState
                    title="Belum ada pendidikan"
                    description="Bagian ini opsional. Tambahkan sekolah, kampus, jurusan, atau pelatihan utama."
                    actionLabel="Tambah pendidikan"
                    onAction={addEducation}
                  />
                ) : (
                  <div className="space-y-3">
                    {educationEntries.map((entry, idx) => (
                      <div
                        key={`${entry.title}-${idx}`}
                        className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                              {entry.title}
                            </p>
                            {entry.subtitle ? (
                              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                                {entry.subtitle}
                              </p>
                            ) : null}
                            {entry.meta ? (
                              <p className="mt-1 text-xs font-semibold text-[color:var(--app-text-soft)]">
                                {entry.meta}
                              </p>
                            ) : null}
                          </div>
                          <div className="flex shrink-0 gap-2">
                            <button
                              type="button"
                              onClick={() => editEducation(idx)}
                              className="rounded-lg px-2.5 py-1.5 text-xs font-black text-emerald-700 hover:bg-emerald-50 dark:text-emerald-300 dark:hover:bg-emerald-500/10"
                            >
                              Ubah
                            </button>
                            <button
                              type="button"
                              onClick={() => removeEducation(idx)}
                              aria-label="Hapus pendidikan"
                              className="grid h-8 w-8 place-items-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className={sectionCardClass('talent')}>
              <SectionHeading
                step="Tambahan"
                title="Sertifikat dan pelatihan"
                description="Tampilkan bukti kemampuan yang paling relevan."
                icon={<Award className="h-5 w-5" />}
                optional
                action={
                  <button
                    type="button"
                    onClick={addCertificate}
                    className="ui-button-secondary inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-black"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah sertifikat
                  </button>
                }
              />

              <div className="mt-4">
                {certificateEntries.length === 0 ? (
                  <EmptyEditorState
                    title="Belum ada sertifikat"
                    description="Tambahkan sertifikat, lisensi, atau pelatihan yang membuat profilmu lebih dipercaya."
                    actionLabel="Tambah sertifikat"
                    onAction={addCertificate}
                  />
                ) : (
                  <div className="space-y-3">
                    {certificateEntries.map((entry, idx) => (
                      <div
                        key={`${entry.title}-${idx}`}
                        className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField label="Nama sertifikat" required>
                            <input
                              className={inputClass}
                              placeholder="Contoh: Google UX Design"
                              value={entry.title}
                              onChange={e =>
                                updateCertificate(idx, 'title', e.target.value)
                              }
                            />
                          </FormField>
                          <FormField label="Penerbit">
                            <input
                              className={inputClass}
                              placeholder="Contoh: Google / Coursera"
                              value={entry.subtitle || ''}
                              onChange={e =>
                                updateCertificate(idx, 'subtitle', e.target.value)
                              }
                            />
                          </FormField>
                          <FormField label="Tahun atau tingkat">
                            <input
                              className={inputClass}
                              placeholder="Contoh: 2026"
                              value={entry.meta || ''}
                              onChange={e =>
                                updateCertificate(idx, 'meta', e.target.value)
                              }
                            />
                          </FormField>
                          <FormField label="Link bukti">
                            <input
                              className={inputClass}
                              placeholder="https://..."
                              value={entry.url || ''}
                              onChange={e =>
                                updateCertificate(idx, 'url', e.target.value)
                              }
                            />
                          </FormField>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeCertificate(idx)}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-black text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Hapus sertifikat
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className={sectionCardClass('talent')}>
              <SectionHeading
                step="Tambahan"
                title="Pengalaman kerja atau proyek"
                description="Masukkan pengalaman yang paling menunjukkan kemampuanmu."
                icon={<BriefcaseBusiness className="h-5 w-5" />}
                optional
                action={
                  <button
                    type="button"
                    onClick={addExperience}
                    className="ui-button-secondary inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-black"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah pengalaman
                  </button>
                }
              />

              <div className="mt-4">
                {experienceEntries.length === 0 ? (
                  <EmptyEditorState
                    title="Belum ada pengalaman"
                    description="Tambahkan pekerjaan, proyek, atau pencapaian yang paling relevan."
                    actionLabel="Tambah pengalaman"
                    onAction={addExperience}
                  />
                ) : (
                  <div className="space-y-3">
                    {experienceEntries.map((entry, idx) => (
                      <div
                        key={`${entry.title}-${idx}`}
                        className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                      >
                        <div className="grid gap-4 sm:grid-cols-2">
                          <FormField label="Posisi atau nama proyek" required>
                            <input
                              className={inputClass}
                              placeholder="Contoh: Fullstack Developer"
                              value={entry.title}
                              onChange={e =>
                                updateExperience(idx, 'title', e.target.value)
                              }
                            />
                          </FormField>
                          <FormField label="Perusahaan atau klien">
                            <input
                              className={inputClass}
                              placeholder="Contoh: PT Contoh Indonesia"
                              value={entry.subtitle || ''}
                              onChange={e =>
                                updateExperience(idx, 'subtitle', e.target.value)
                              }
                            />
                          </FormField>
                          <FormField label="Periode">
                            <input
                              className={inputClass}
                              placeholder="Contoh: 2024–2026"
                              value={entry.meta || ''}
                              onChange={e =>
                                updateExperience(idx, 'meta', e.target.value)
                              }
                            />
                          </FormField>
                          <FormField label="Link hasil kerja">
                            <input
                              className={inputClass}
                              placeholder="https://..."
                              value={entry.url || ''}
                              onChange={e =>
                                updateExperience(idx, 'url', e.target.value)
                              }
                            />
                          </FormField>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeExperience(idx)}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-black text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Hapus pengalaman
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section className={sectionCardClass('talent')}>
              <SectionHeading
                step="Tambahan"
                title="Link profesional"
                description="Tambahkan website, LinkedIn, GitHub, Behance, atau portofolio lainnya."
                icon={<Link2 className="h-5 w-5" />}
                optional
                action={
                  <button
                    type="button"
                    onClick={addLink}
                    className="ui-button-secondary inline-flex min-h-10 items-center justify-center gap-2 px-3 text-xs font-black"
                  >
                    <Plus className="h-4 w-4" />
                    Tambah link
                  </button>
                }
              />

              <div className="mt-4">
                {linkEntries.length === 0 ? (
                  <EmptyEditorState
                    title="Belum ada link"
                    description="Link membantu orang memeriksa hasil kerja dan identitas profesionalmu."
                    actionLabel="Tambah link"
                    onAction={addLink}
                  />
                ) : (
                  <div className="space-y-3">
                    {linkEntries.map((entry, idx) => (
                      <div
                        key={`${entry.label}-${idx}`}
                        className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                      >
                        <div className="grid gap-4 sm:grid-cols-[180px_minmax(0,1fr)]">
                          <FormField label="Nama link">
                            <input
                              className={inputClass}
                              placeholder="Contoh: LinkedIn"
                              value={entry.label}
                              onChange={e =>
                                updateLink(idx, 'label', e.target.value)
                              }
                            />
                          </FormField>
                          <FormField label="Alamat link" required>
                            <input
                              className={inputClass}
                              placeholder="https://..."
                              value={entry.url}
                              onChange={e =>
                                updateLink(idx, 'url', e.target.value)
                              }
                            />
                          </FormField>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeLink(idx)}
                          className="mt-3 inline-flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-black text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                        >
                          <Trash2 className="h-4 w-4" />
                          Hapus link
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            <section
              id="profile-edit-seller"
              className={sectionCardClass('seller')}
            >
              <SectionHeading
                step="Langkah 2B"
                title="Usaha atau jasa yang kamu tawarkan"
                description="Isi bagian ini agar calon pembeli cepat memahami layanan, area, dan kisaran hargamu."
                icon={<Store className="h-5 w-5" />}
                optional
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <FormField label="Nama usaha atau layanan" required>
                  <input
                    className={inputClass}
                    placeholder="Contoh: Jasa Pembuatan Website UMKM"
                    value={providerHeadline}
                    onChange={e => setProviderHeadline(e.target.value)}
                  />
                </FormField>
                <FormField label="Keahlian atau jenis layanan" hint="Pisahkan dengan koma.">
                  <input
                    className={inputClass}
                    placeholder="Contoh: website toko, landing page, maintenance"
                    value={providerSkills}
                    onChange={e => setProviderSkills(e.target.value)}
                  />
                </FormField>
                <FormField label="Cara layanan diberikan">
                  <input
                    className={inputClass}
                    placeholder="Contoh: online, datang ke lokasi, keduanya"
                    value={workMode}
                    onChange={e => setWorkMode(e.target.value)}
                  />
                </FormField>
                <FormField label="Perkiraan waktu membalas">
                  <input
                    className={inputClass}
                    placeholder="Contoh: kurang dari 2 jam"
                    value={responseTime}
                    onChange={e => setResponseTime(e.target.value)}
                  />
                </FormField>
                <FormField label="Harga mulai" hint="Isi angka tanpa titik atau Rp.">
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    placeholder="Contoh: 500000"
                    value={priceMin}
                    onChange={e => setPriceMin(e.target.value)}
                  />
                </FormField>
                <FormField label="Harga tertinggi" hint="Boleh dikosongkan jika harga menyesuaikan.">
                  <input
                    type="number"
                    min="0"
                    className={inputClass}
                    placeholder="Contoh: 5000000"
                    value={priceMax}
                    onChange={e => setPriceMax(e.target.value)}
                  />
                </FormField>
                <FormField
                  label="Area layanan"
                  hint="Pisahkan beberapa kota atau area dengan koma."
                  className="sm:col-span-2"
                >
                  <textarea
                    className={`${textareaClass} min-h-[90px]`}
                    placeholder="Contoh: Bandung, Cimahi, seluruh Indonesia untuk layanan online"
                    value={serviceCoverage}
                    onChange={e => setServiceCoverage(e.target.value)}
                  />
                </FormField>
              </div>
            </section>

            <section
              id="profile-edit-buyer"
              className={sectionCardClass('buyer')}
            >
              <SectionHeading
                step="Langkah 2C"
                title="Barang atau jasa yang sedang kamu cari"
                description="Bagian ini membantu Lajukan mencocokkan kebutuhanmu dengan penjual atau penyedia jasa yang tepat."
                icon={<Search className="h-5 w-5" />}
                optional
              />

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <FormField
                  label="Apa yang sedang kamu butuhkan?"
                  hint="Tulis kebutuhan dengan bahasa sehari-hari."
                  required
                  className="sm:col-span-2"
                >
                  <input
                    className={inputClass}
                    placeholder="Contoh: mencari vendor konten TikTok untuk UMKM"
                    value={buyerIntent}
                    onChange={e => setBuyerIntent(e.target.value)}
                  />
                </FormField>
                <FormField label="Lokasi yang diinginkan">
                  <input
                    className={inputClass}
                    placeholder="Contoh: Bandung atau bisa online"
                    value={preferredLocation}
                    onChange={e => setPreferredLocation(e.target.value)}
                  />
                </FormField>
                <FormField label="Bidang usaha">
                  <input
                    className={inputClass}
                    placeholder="Contoh: pemasaran digital"
                    value={preferredSector}
                    onChange={e => setPreferredSector(e.target.value)}
                  />
                </FormField>
                <FormField label="Jenis yang lebih spesifik">
                  <input
                    className={inputClass}
                    placeholder="Contoh: video pendek dan iklan"
                    value={preferredSubSector}
                    onChange={e => setPreferredSubSector(e.target.value)}
                  />
                </FormField>
                <div className="grid gap-4 sm:col-span-2 sm:grid-cols-2">
                  <FormField label="Anggaran minimum">
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      placeholder="Contoh: 500000"
                      value={buyerBudgetMin}
                      onChange={e => setBuyerBudgetMin(e.target.value)}
                    />
                  </FormField>
                  <FormField label="Anggaran maksimum">
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      placeholder="Contoh: 3000000"
                      value={buyerBudgetMax}
                      onChange={e => setBuyerBudgetMax(e.target.value)}
                    />
                  </FormField>
                </div>
              </div>
            </section>

            <section
              id="profile-edit-media"
              className={sectionCardClass('media')}
            >
              <SectionHeading
                step="Langkah 3"
                title="Foto dan dokumen"
                description="Gunakan foto yang jelas agar profil terlihat lebih terpercaya dan mudah dikenali."
                icon={<Images className="h-5 w-5" />}
              />

              <div className="mt-5 grid items-stretch gap-4 md:grid-cols-2">
                <div className="flex min-h-[330px] flex-col justify-between rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 text-center dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
                  <div className="mx-auto h-28 w-28 overflow-hidden rounded-full border-4 border-white bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profileAvatarSrc(
                        avatarUrl,
                        readProfileAvatarStyle(baseMetadata) ||
                          readProfileAvatarStyle(user),
                        fullName || user?.full_name || user?.email,
                      )}
                      alt="Foto profil"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <p className="mt-3 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    Foto profil
                  </p>
                  <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                    Gunakan foto wajah, logo usaha, atau identitas yang jelas.
                  </p>
                  <label className="ui-button-secondary mt-4 inline-flex min-h-10 w-full cursor-pointer items-center justify-center gap-2 px-3 text-xs font-black">
                    {uploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Camera className="h-4 w-4" />
                    )}
                    Ganti foto profil
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarChange}
                      disabled={uploadingAvatar || saving}
                    />
                  </label>
                </div>

                <div className="flex min-h-[330px] flex-col overflow-hidden rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]">
                  <div className="relative min-h-[220px] flex-1 bg-[color:var(--app-surface)]">
                    {coverImageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={coverImageUrl}
                        alt="Foto sampul"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full flex-col items-center justify-center px-5 text-center">
                        <ImagePlus className="h-8 w-8 text-[color:var(--app-text-soft)]" />
                        <p className="mt-2 text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                          Belum ada foto sampul
                        </p>
                        <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                          Tambahkan foto tempat usaha, produk, tim, atau hasil kerja.
                        </p>
                      </div>
                    )}
                  </div>
                  <div className="mt-auto flex min-h-[96px] flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        Foto sampul
                      </p>
                      <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                        Rasio lebar akan dipotong otomatis sebelum diunggah.
                      </p>
                    </div>
                    <label className="ui-button-secondary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-3 text-xs font-black">
                      {uploadingCover ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImagePlus className="h-4 w-4" />
                      )}
                      {coverImageUrl ? 'Ganti sampul' : 'Tambah sampul'}
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleCoverChange}
                        disabled={uploadingCover || saving}
                      />
                    </label>
                  </div>
                </div>
              </div>

              <div className="mt-4 grid auto-rows-fr items-stretch gap-4 md:grid-cols-2">
                <div className="flex h-full min-h-[320px] flex-col rounded-2xl border border-[color:var(--app-border)] p-4 dark:border-[color:var(--app-border-strong)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        Galeri usaha atau hasil kerja
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        Unggah beberapa foto produk, tempat usaha, proyek, atau hasil pekerjaan.
                      </p>
                    </div>
                    <label className="ui-button-secondary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-3 text-xs font-black">
                      {uploadingImages ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Tambah foto
                      <input
                        type="file"
                        accept="image/*"
                        multiple
                        className="hidden"
                        onChange={uploadImages}
                        disabled={uploadingImages || saving}
                      />
                    </label>
                  </div>

                  {galleryImages.length > 0 ? (
                    <div className="mt-4 grid flex-1 grid-cols-2 content-start gap-2 sm:grid-cols-3">
                      {galleryImages.map(url => (
                        <div
                          key={url}
                          className="group relative aspect-square overflow-hidden rounded-xl bg-[color:var(--app-surface-muted)]"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={url}
                            alt="Galeri profil"
                            className="h-full w-full object-cover"
                          />
                          <button
                            type="button"
                            onClick={() => removeImage(url)}
                            aria-label="Hapus foto"
                            className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full bg-black/65 text-white shadow-sm backdrop-blur transition hover:bg-rose-600"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 grid flex-1 place-items-center rounded-xl border border-dashed border-[color:var(--app-border)] px-4 py-8 text-center text-xs text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]">
                      Belum ada foto galeri.
                    </div>
                  )}
                </div>

                <div className="flex h-full min-h-[320px] flex-col rounded-2xl border border-[color:var(--app-border)] p-4 dark:border-[color:var(--app-border-strong)]">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        Dokumen pendukung
                      </p>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        Misalnya CV, katalog, proposal, sertifikat, atau dokumen usaha.
                      </p>
                    </div>
                    <label className="ui-button-secondary inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 px-3 text-xs font-black">
                      {uploadingDocs ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4" />
                      )}
                      Tambah dokumen
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,image/*"
                        multiple
                        className="hidden"
                        onChange={uploadDocuments}
                        disabled={uploadingDocs || saving}
                      />
                    </label>
                  </div>

                  {documentUrls.length > 0 ? (
                    <div className="mt-4 flex-1 space-y-2">
                      {documentUrls.map(url => (
                        <div
                          key={url}
                          className="flex min-w-0 items-center gap-3 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface)]"
                        >
                          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-emerald-700 dark:bg-white/10 dark:text-emerald-300">
                            <FileText className="h-5 w-5" />
                          </span>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                              {getFileName(url)}
                            </p>
                            <p className="mt-0.5 truncate text-[10px] text-[color:var(--app-text-soft)]">
                              Dokumen profil
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removeDoc(url)}
                            aria-label="Hapus dokumen"
                            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 grid flex-1 place-items-center rounded-xl border border-dashed border-[color:var(--app-border)] px-4 py-8 text-center text-xs text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]">
                      Belum ada dokumen pendukung.
                    </div>
                  )}
                </div>
              </div>
            </section>
          </div>

        </div>

        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-20 mt-6 rounded-2xl border border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_96%,_transparent)] p-3 shadow-[0_-18px_40px_-32px_rgba(15,23,42,0.55)] backdrop-blur-xl dark:border-[color:var(--app-border-strong)] sm:bottom-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
              <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                Jangan lupa simpan perubahan
              </p>
              <p className="mt-0.5 text-xs text-[color:var(--app-text-soft)]">
                Profil {profileScore}% lengkap · langkah aktif:{' '}
                {activeFocusSection.title}
              </p>
            </div>
            <div className="grid gap-2 sm:flex">
              <LocalizedLink
                href={publicProfilePath}
                className="ui-button-secondary inline-flex min-h-11 items-center justify-center gap-2 px-4 text-sm font-bold"
              >
                <Globe2 className="h-4 w-4" />
                Lihat profil
              </LocalizedLink>
              <button
                type="button"
                onClick={handleSave}
                disabled={saveDisabled}
                className="ui-button-primary inline-flex min-h-11 items-center justify-center gap-2 px-5 text-sm font-black disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                Simpan perubahan
              </button>
            </div>
          </div>
        </div>
      </div>

      <Modal
        open={educationEditorOpen}
        title={
          educationEditorIndex === null
            ? 'Tambah pendidikan'
            : 'Ubah pendidikan'
        }
        onClose={closeEducationEditor}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={closeEducationEditor}
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-[color:var(--app-border)] px-4 text-xs font-black text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={saveEducationDraft}
              className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-[color:var(--app-accent)] px-4 text-xs font-black text-white"
            >
              {educationEditorIndex === null ? 'Tambahkan' : 'Simpan perubahan'}
            </button>
          </div>
        }
      >
        <p className="mb-4 text-sm leading-6 text-[color:var(--app-text-soft)]">
          Isi pendidikan yang paling relevan. Tidak perlu memasukkan semua
          riwayat sekolah.
        </p>
        <div className="grid gap-4">
          <FormField label="Sekolah, kampus, atau gelar" required>
            <input
              className={inputClass}
              placeholder="Contoh: Universitas Budi Luhur"
              value={educationDraft.title}
              onChange={e =>
                setEducationDraft(current => ({
                  ...current,
                  title: e.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Jurusan atau bidang">
            <input
              className={inputClass}
              placeholder="Contoh: Teknik Informatika"
              value={educationDraft.subtitle || ''}
              onChange={e =>
                setEducationDraft(current => ({
                  ...current,
                  subtitle: e.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Tahun atau status">
            <input
              className={inputClass}
              placeholder="Contoh: 2024–sekarang"
              value={educationDraft.meta || ''}
              onChange={e =>
                setEducationDraft(current => ({
                  ...current,
                  meta: e.target.value,
                }))
              }
            />
          </FormField>
          <FormField label="Link pendukung">
            <input
              className={inputClass}
              placeholder="https://..."
              value={educationDraft.url || ''}
              onChange={e =>
                setEducationDraft(current => ({
                  ...current,
                  url: e.target.value,
                }))
              }
            />
          </FormField>
        </div>
      </Modal>

      <ImageCropModal
        open={Boolean(cropTarget && cropSource)}
        imageSrc={cropSource}
        aspect={cropTarget === 'cover' ? 16 / 9 : 1}
        maxOutputSize={cropTarget === 'cover' ? 1600 : 512}
        title={cropTarget === 'cover' ? 'Atur foto sampul' : 'Atur foto profil'}
        shape={cropTarget === 'avatar' ? 'round' : 'rect'}
        onCancel={closeCropper}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
