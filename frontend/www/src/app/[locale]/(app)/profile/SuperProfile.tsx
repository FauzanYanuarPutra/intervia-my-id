'use client';

import {
  type ChangeEvent,
  type ComponentType,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import NextImage from 'next/image';
import { useAuth } from '@/context/AuthContext';
import { LocalizedLink } from '@/components/ui-kit';
import { ImageCropModal } from '@/components/common/ImageCropModal';
import { IdentityVerificationPanel } from '@/components/profile/IdentityVerificationPanel';
import { ProfileHubView } from '@/components/profile/ProfileHubView';
import { ProfileViewSkeleton } from '@/components/system/feedback/RouteSkeletons';
import { type ProfileContentTab } from '@/lib/profile/profileContentTabs';
import { normalizePublicProfileHandleInput } from '@/lib/profile/publicProfileLink';
import {
  extractUploadedDocumentUrls,
  extractFirstUploadedImageUrl,
  normalizeProfileMediaUrl,
} from '@/lib/profile/profileMedia';
import {
  Activity,
  Award,
  Briefcase,
  Camera,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  GraduationCap,
  Languages,
  Link2,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  PhoneCall,
  Save,
  ShieldCheck,
  Sparkles,
  User2,
  Wrench,
} from 'lucide-react';

const QUICK_APPLY_KEY = 'lajukan_quick_apply_v1';

type QuickApplyData = {
  full_name: string;
  email: string;
  phone?: string;
  location?: string;
  resume_url?: string;
};

type ListingItem = {
  id: string;
  title?: string;
  content_type?: string;
  content_status?: string;
  status?: string;
  created_at?: string;
};

type TransactionItem = {
  id: string;
  status?: string;
  amount_cents?: number;
  currency?: string;
  created_at?: string;
};

type UserDetail = {
  id: string;
  email: string;
  phone?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  username?: string | null;
  bio?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  cover_image?: string | null;
  profile?: Record<string, unknown> | null;
  freelancer_profile?: Record<string, unknown> | null;
  provider_profile?: Record<string, unknown> | null;
  buyer_profile?: Record<string, unknown> | null;
  verification?: Record<string, unknown> | null;
  media?: Record<string, unknown> | null;
  email_verified?: boolean | null;
  phone_verified?: boolean | null;
  document_verified?: boolean | null;
  liveness_verified?: boolean | null;
  identity_verified?: boolean | null;
  transaction_eligible?: boolean | null;
  kyc_status?: string | null;
  metadata?: {
    avatar_url?: string | null;
    cover_image?: string | null;
    media?: Record<string, unknown> | null;
    [key: string]: unknown;
  } | null;
  roles?: string[];
  permissions?: string[];
};

type MetaRecord = Record<string, unknown>;

type ProfessionalEntry = {
  title: string;
  subtitle?: string;
  meta?: string;
  url?: string;
};

type ProfessionalData = {
  headline: string;
  summary: string;
  skills: string[];
  languages: string[];
  education: ProfessionalEntry[];
  certifications: ProfessionalEntry[];
  experiences: ProfessionalEntry[];
  links: Array<{ label: string; url: string }>;
};

function loadQuickApply(): QuickApplyData | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(QUICK_APPLY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as QuickApplyData;
  } catch {
    // ignore
  }
  return null;
}

function saveQuickApply(data: QuickApplyData) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(QUICK_APPLY_KEY, JSON.stringify(data));
  } catch {
    // ignore
  }
}

function nonEmpty(value: string | null | undefined): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function formatDate(input: string | undefined): string {
  if (!input) return '-';
  const d = new Date(input);
  if (Number.isNaN(d.getTime())) return '-';
  return d.toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatMoneyFromCents(
  cents: number | undefined,
  currency = 'IDR',
): string {
  if (!Number.isFinite(cents as number)) return '-';
  const amount = Math.max(0, Math.floor((cents as number) / 100));
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

function asRecord(value: unknown): MetaRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as MetaRecord;
}

function readString(value: unknown): string {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : '';
}

function splitList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => readString(item)).filter(Boolean);
  }

  const text = readString(value);
  if (!text) return [];
  return text
    .split(/[\n,;|]/g)
    .map(item => item.trim())
    .filter(Boolean);
}

function dedupeStrings(values: string[]): string[] {
  const seen = new Set<string>();
  const next: string[] = [];
  for (const value of values) {
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    next.push(value);
  }
  return next;
}

function getPathValue(root: MetaRecord | null, path: string[]): unknown {
  if (!root) return undefined;
  let current: unknown = root;
  for (const key of path) {
    if (!current || typeof current !== 'object' || Array.isArray(current))
      return undefined;
    current = (current as MetaRecord)[key];
  }
  return current;
}

function collectListValues(
  root: MetaRecord | null,
  paths: string[][],
): string[] {
  const values: string[] = [];
  for (const path of paths) {
    values.push(...splitList(getPathValue(root, path)));
  }
  return dedupeStrings(values);
}

function normalizeExternalUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return '';
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (/^[a-z]+:\/\//i.test(trimmed)) return '';
  return `https://${trimmed}`;
}

function normalizeEntry(value: unknown): ProfessionalEntry | null {
  if (typeof value === 'string') {
    const title = readString(value);
    return title ? { title } : null;
  }

  const row = asRecord(value);
  if (!row) return null;

  const title =
    readString(row.title) ||
    readString(row.name) ||
    readString(row.degree) ||
    readString(row.role) ||
    readString(row.position) ||
    readString(row.company) ||
    readString(row.school) ||
    readString(row.institution) ||
    readString(row.issuer);

  if (!title) return null;

  const subtitle =
    readString(row.institution) ||
    readString(row.school) ||
    readString(row.company) ||
    readString(row.issuer) ||
    readString(row.field);

  const start = readString(row.start_date) || readString(row.start);
  const end =
    readString(row.end_date) || readString(row.end) || readString(row.year);
  const duration = [start, end].filter(Boolean).join(' - ');

  const level =
    readString(row.level) || readString(row.grade) || readString(row.status);
  const meta = [duration, level].filter(Boolean).join(' - ');
  const url = normalizeExternalUrl(
    readString(row.url) ||
      readString(row.link) ||
      readString(row.certificate_url),
  );

  return {
    title,
    subtitle: subtitle || undefined,
    meta: meta || undefined,
    url: url || undefined,
  };
}

function collectEntries(
  root: MetaRecord | null,
  paths: string[][],
): ProfessionalEntry[] {
  const values: ProfessionalEntry[] = [];

  for (const path of paths) {
    const source = getPathValue(root, path);

    if (Array.isArray(source)) {
      for (const item of source) {
        const entry = normalizeEntry(item);
        if (entry) values.push(entry);
      }
      continue;
    }

    const entry = normalizeEntry(source);
    if (entry) values.push(entry);
  }

  const deduped: ProfessionalEntry[] = [];
  const seen = new Set<string>();

  for (const item of values) {
    const key =
      `${item.title}|${item.subtitle || ''}|${item.meta || ''}`.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(item);
  }

  return deduped;
}

function collectLinks(
  root: MetaRecord | null,
): Array<{ label: string; url: string }> {
  const links: Array<{ label: string; url: string }> = [];

  const register = (label: string, value: unknown) => {
    const raw = readString(value);
    if (!raw) return;
    const url = normalizeExternalUrl(raw);
    if (!url) return;
    if (links.some(entry => entry.url.toLowerCase() === url.toLowerCase()))
      return;
    links.push({ label, url });
  };

  register('Portfolio', getPathValue(root, ['portfolio_url']));
  register('Portfolio', getPathValue(root, ['portfolio']));
  register('Portfolio', getPathValue(root, ['profile', 'portfolio_url']));
  register('Portfolio', getPathValue(root, ['profile', 'portfolio']));
  register('Website', getPathValue(root, ['website']));
  register('Website', getPathValue(root, ['profile', 'website']));
  register('LinkedIn', getPathValue(root, ['linkedin']));
  register('LinkedIn', getPathValue(root, ['linkedin_url']));
  register('LinkedIn', getPathValue(root, ['profile', 'linkedin']));
  register('LinkedIn', getPathValue(root, ['profile', 'linkedin_url']));
  register('GitHub', getPathValue(root, ['github']));
  register('GitHub', getPathValue(root, ['github_url']));
  register('GitHub', getPathValue(root, ['profile', 'github']));
  register('GitHub', getPathValue(root, ['profile', 'github_url']));
  register('Behance', getPathValue(root, ['behance_url']));
  register('Behance', getPathValue(root, ['profile', 'behance_url']));
  register('Dribbble', getPathValue(root, ['dribbble_url']));
  register('Dribbble', getPathValue(root, ['profile', 'dribbble_url']));

  const profileLinks = getPathValue(root, ['profile', 'links']);
  if (Array.isArray(profileLinks)) {
    for (const item of profileLinks) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const row = item as Record<string, unknown>;
      register(
        readString(row.label) || 'Link',
        readString(row.url) || readString(row.link),
      );
    }
  }

  return links;
}

function buildProfessionalData(
  metadataValue: unknown,
  bioValue: string | null | undefined,
): ProfessionalData {
  const root = asRecord(metadataValue);

  const headline =
    readString(
      getPathValue(root, ['freelancer_profile', 'professional_title']),
    ) ||
    readString(getPathValue(root, ['professional_title'])) ||
    readString(getPathValue(root, ['freelancer_profile', 'tagline'])) ||
    readString(getPathValue(root, ['tagline'])) ||
    readString(getPathValue(root, ['headline']));

  const summary =
    readString(getPathValue(root, ['freelancer_profile', 'bio'])) ||
    readString(getPathValue(root, ['summary'])) ||
    readString(getPathValue(root, ['about'])) ||
    readString(bioValue);

  const skills = collectListValues(root, [
    ['skills'],
    ['skill_set'],
    ['expertise'],
    ['must_have_skills'],
    ['freelancer_profile', 'skills'],
  ]);

  const languages = collectListValues(root, [
    ['languages'],
    ['language'],
    ['freelancer_profile', 'languages'],
  ]);

  const education = collectEntries(root, [
    ['education'],
    ['educations'],
    ['education_history'],
    ['freelancer_profile', 'education'],
  ]);

  const certifications = collectEntries(root, [
    ['certificates'],
    ['certificate'],
    ['certifications'],
    ['licenses'],
    ['freelancer_profile', 'certifications'],
    ['freelancer_profile', 'certificates'],
  ]);

  const experiences = collectEntries(root, [
    ['experience'],
    ['experiences'],
    ['work_history'],
    ['work_experience'],
    ['freelancer_profile', 'experience'],
    ['freelancer_profile', 'work_history'],
  ]);

  const links = collectLinks(root);

  return {
    headline,
    summary,
    skills,
    languages,
    education,
    certifications,
    experiences,
    links,
  };
}

function SectionCard({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm sm:shadow-[0_18px_40px_-30px_rgba(15,23,42,0.45)] dark:border-[color:var(--app-border-strong)] sm:p-6">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
            {title}
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
              {subtitle}
            </p>
          ) : null}
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>
      {children}
    </section>
  );
}

function StatCard({
  label,
  value,
  icon: Icon,
  hint,
}: {
  label: string;
  value: string | number;
  icon: ComponentType<{ className?: string }>;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 shadow-none sm:shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:p-4">
      <div className="flex items-center justify-between">
        <div className="rounded-2xl bg-[color:var(--app-accent-soft)] p-2 text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)]">
          <Icon className="h-4 w-4" />
        </div>
        {hint ? (
          <span className="text-[11px] text-[color:var(--app-text-soft)]">
            {hint}
          </span>
        ) : null}
      </div>
      <div className="mt-3">
        <p className="text-xl font-bold tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
          {value}
        </p>
        <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
          {label}
        </p>
      </div>
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return (
    <p className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
      {text}
    </p>
  );
}

export default function SuperProfile() {
  const { user, authFetch, refreshUser, loading: authLoading } = useAuth();

  const [detail, setDetail] = useState<UserDetail | null>(null);
  const [listings, setListings] = useState<ListingItem[]>([]);
  const [transactions, setTransactions] = useState<TransactionItem[]>([]);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);
  const [avatarUrlInput, setAvatarUrlInput] = useState('');
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUrlInput, setCoverUrlInput] = useState('');
  const [coverUploading, setCoverUploading] = useState(false);
  const [cropSource, setCropSource] = useState('');
  const [cropTarget, setCropTarget] = useState<'avatar' | 'cover' | null>(null);

  const [fullNameInput, setFullNameInput] = useState('');
  const [usernameInput, setUsernameInput] = useState('');
  const [phoneInput, setPhoneInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  const [bioInput, setBioInput] = useState('');

  const [qaResumeUrl, setQaResumeUrl] = useState('');
  const [qaResumeFile, setQaResumeFile] = useState<File | null>(null);
  const [qaSaving, setQaSaving] = useState(false);
  const [qaMessage, setQaMessage] = useState<string | null>(null);
  const [activeMarketplaceTab, setActiveMarketplaceTab] =
    useState<ProfileContentTab>('all');

  const hydrateForm = useCallback((value: UserDetail) => {
    setFullNameInput(value.full_name || value.fullName || '');
    setUsernameInput(
      normalizePublicProfileHandleInput(value.username || user?.username || ''),
    );
    setPhoneInput(value.phone || '');
    setLocationInput(value.location || '');
    setBioInput(value.bio || '');
    setAvatarUrlInput(
      normalizeProfileMediaUrl(
        value.avatar_url || value.avatarUrl || value.metadata?.avatar_url,
      ) || '',
    );
    const metaMedia = asRecord(value.metadata?.media) || {};
    setCoverUrlInput(
      normalizeProfileMediaUrl(value.cover_image) ||
        normalizeProfileMediaUrl(value.metadata?.cover_image) ||
        normalizeProfileMediaUrl(metaMedia.cover_image) ||
        '',
    );
  }, [user?.username]);

  const loadProfile = useCallback(async () => {
    if (!user?.id) {
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setProfileError(null);

    try {
      const [detailRes, listingsRes, txRes] = await Promise.all([
        authFetch(`/api/users/${user.id}`),
        authFetch('/api/my-listings?status=active'),
        authFetch('/api/my-applications'),
      ]);

      const detailData = (await detailRes
        .json()
        .catch(() => null)) as UserDetail | null;
      const listingsData = (await listingsRes.json().catch(() => ({}))) as {
        results?: ListingItem[];
      };
      const txData = (await txRes.json().catch(() => ({}))) as {
        results?: TransactionItem[];
      };

      if (!detailRes.ok || !detailData) {
        throw new Error('Failed to load profile data');
      }

      setDetail(detailData);
      hydrateForm(detailData);

      if (
        !nonEmpty(
          detailData.avatar_url ||
            detailData.avatarUrl ||
            detailData.metadata?.avatar_url,
        )
      ) {
        setAvatarUrlInput(
          normalizeProfileMediaUrl(
            user.avatarUrl || user.avatar_url || user.metadata?.avatar_url,
          ) || '',
        );
      }

      setListings(
        Array.isArray(listingsData.results) ? listingsData.results : [],
      );
      setTransactions(Array.isArray(txData.results) ? txData.results : []);
    } catch (error) {
      setProfileError(
        error instanceof Error ? error.message : 'Failed to load profile',
      );
    } finally {
      setProfileLoading(false);
    }
  }, [authFetch, hydrateForm, user]);

  useEffect(() => {
    if (!authLoading) {
      void loadProfile();
    }
  }, [authLoading, loadProfile]);

  useEffect(() => {
    const saved = loadQuickApply();
    if (saved) {
      setQaResumeUrl(saved.resume_url || '');
    }
  }, []);

  const uploadResume = async (file: File) => {
    const formData = new FormData();
    formData.append('files', file);

    const res = await authFetch('/api/content/upload-files', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error((data as { error?: string }).error || 'Upload failed');
    }

    const url = extractUploadedDocumentUrls(data)[0] || '';

    if (!url) throw new Error('No resume URL returned');

    setQaResumeUrl(url);
    setQaResumeFile(null);
    return url;
  };

  const saveQuickApplyProfile = async () => {
    if (!user) return;
    setQaSaving(true);
    setQaMessage(null);

    try {
      let resumeUrl = qaResumeUrl;

      if (qaResumeFile) {
        resumeUrl = await uploadResume(qaResumeFile);
      }

      saveQuickApply({
        full_name: fullNameInput || user.full_name || user.email,
        email: user.email,
        phone: phoneInput || user.phone || undefined,
        location: locationInput || undefined,
        resume_url: resumeUrl || undefined,
      });

      setQaMessage('Quick apply berhasil disimpan');
    } catch (err) {
      setQaMessage(
        err instanceof Error ? err.message : 'Failed to save quick apply',
      );
    } finally {
      setQaSaving(false);
    }
  };

  const saveProfile = async ({
    overrideAvatarUrl,
    overrideCoverUrl,
    successMessage = 'Profile berhasil diperbarui',
  }: {
    overrideAvatarUrl?: string;
    overrideCoverUrl?: string;
    successMessage?: string;
  } = {}) => {
    setSaving(true);
    setSaveMessage(null);

    try {
      const payload: Record<string, string> = {};
      const fullName = nonEmpty(fullNameInput);
      const username = nonEmpty(
        normalizePublicProfileHandleInput(usernameInput),
      );
      const phone = nonEmpty(phoneInput);
      const location = nonEmpty(locationInput);
      const bio = nonEmpty(bioInput);
      const avatar = nonEmpty(overrideAvatarUrl ?? avatarUrlInput);
      const cover = nonEmpty(overrideCoverUrl ?? coverUrlInput);

      if (fullName) payload.full_name = fullName;
      if (username) payload.username = username;
      if (phone) payload.phone = phone;
      if (location) payload.location = location;
      if (bio) payload.bio = bio;
      if (avatar) payload.avatar_url = avatar;

      if (Object.keys(payload).length === 0 && !cover) {
        throw new Error('Tidak ada perubahan untuk disimpan');
      }

      const res = await authFetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...payload,
          ...(avatar || cover
            ? {
                media: {
                  ...(asRecord(mergedMetadata?.media) || {}),
                  ...(avatar ? { avatar_url: avatar } : {}),
                  ...(cover ? { cover_image: cover } : {}),
                },
              }
            : null),
          ...(cover
            ? {
                cover_image: cover,
              }
            : null),
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(
          (data as { error?: string }).error || 'Failed to save profile',
        );
      }

      setSaveMessage(successMessage);
      await Promise.all([loadProfile(), refreshUser()]);
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : 'Failed to save profile',
      );
    } finally {
      setSaving(false);
    }
  };

  const uploadAvatar = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Avatar harus berupa file gambar');
    }

    const formData = new FormData();
    formData.append('images', file);

    const res = await authFetch('/api/content/upload-images', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error || 'Upload avatar gagal',
      );
    }

    const uploadedUrl = extractFirstUploadedImageUrl(data);
    if (!uploadedUrl) {
      throw new Error('No avatar URL returned');
    }

    setAvatarUrlInput(uploadedUrl);
    await saveProfile({
      overrideAvatarUrl: uploadedUrl,
      successMessage: 'Foto profil berhasil diperbarui',
    });
  };

  const handleAvatarFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0] || null;
    event.target.value = '';
    if (!selectedFile) return;
    if (cropSource) URL.revokeObjectURL(cropSource);
    const url = URL.createObjectURL(selectedFile);
    setCropSource(url);
    setCropTarget('avatar');
  };

  const uploadCover = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      throw new Error('Cover harus berupa file gambar');
    }
    const formData = new FormData();
    formData.append('images', file);
    const res = await authFetch('/api/content/upload-images', {
      method: 'POST',
      body: formData,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new Error(
        (data as { error?: string }).error || 'Upload cover gagal',
      );
    }
    const uploadedUrl = extractFirstUploadedImageUrl(data);
    if (!uploadedUrl) throw new Error('No cover URL returned');
    setCoverUrlInput(uploadedUrl);
    await saveProfile({
      overrideCoverUrl: uploadedUrl,
      successMessage: 'Cover profile berhasil diperbarui',
    });
  };

  const handleCoverFileChange = async (
    event: ChangeEvent<HTMLInputElement>,
  ) => {
    const selectedFile = event.target.files?.[0] || null;
    event.target.value = '';
    if (!selectedFile) return;
    if (cropSource) URL.revokeObjectURL(cropSource);
    const url = URL.createObjectURL(selectedFile);
    setCropSource(url);
    setCropTarget('cover');
  };

  const closeCropper = () => {
    if (cropSource) {
      URL.revokeObjectURL(cropSource);
    }
    setCropSource('');
    setCropTarget(null);
  };

  const handleCropConfirm = async (file: File) => {
    if (!cropTarget) return;
    if (cropTarget === 'avatar') {
      setAvatarUploading(true);
      try {
        await uploadAvatar(file);
      } catch (error) {
        setSaveMessage(
          error instanceof Error ? error.message : 'Failed to update avatar',
        );
      } finally {
        setAvatarUploading(false);
        closeCropper();
      }
      return;
    }

    setCoverUploading(true);
    try {
      await uploadCover(file);
    } catch (error) {
      setSaveMessage(
        error instanceof Error ? error.message : 'Failed to update cover',
      );
    } finally {
      setCoverUploading(false);
      closeCropper();
    }
  };

  const roleList = detail?.roles || [];
  const listingsPreview = useMemo(() => listings.slice(0, 5), [listings]);
  const txPreview = useMemo(() => transactions.slice(0, 5), [transactions]);
  const dialPhone = detail?.phone ? detail.phone.replace(/\D/g, '') : '';

  const mergedMetadata = useMemo(() => {
    const userMeta = asRecord(user?.metadata) || {};
    const detailMeta = asRecord(detail?.metadata) || {};
    const detailRecord = asRecord(detail) || {};
    const detailProfile = asRecord(detailRecord.profile);
    const detailFreelancer = asRecord(detailRecord.freelancer_profile);
    const detailProvider = asRecord(detailRecord.provider_profile);
    const detailBuyer = asRecord(detailRecord.buyer_profile);
    const detailMedia = asRecord(detailRecord.media);
    return {
      ...userMeta,
      ...detailMeta,
      ...(detailProfile ? { profile: detailProfile } : {}),
      ...(detailFreelancer ? { freelancer_profile: detailFreelancer } : {}),
      ...(detailProvider ? { provider_profile: detailProvider } : {}),
      ...(detailBuyer ? { buyer_profile: detailBuyer } : {}),
      ...(detailMedia ? { media: detailMedia } : {}),
    };
  }, [detail, user?.metadata]);

  const professionalData = useMemo(
    () => buildProfessionalData(mergedMetadata, detail?.bio || user?.bio),
    [detail?.bio, mergedMetadata, user?.bio],
  );

  const profileCoverage = useMemo(() => {
    const blocks = [
      professionalData.skills.length > 0,
      professionalData.education.length > 0,
      professionalData.certifications.length > 0,
      professionalData.experiences.length > 0,
      professionalData.links.length > 0,
    ];
    const complete = blocks.filter(Boolean).length;
    return {
      complete,
      total: blocks.length,
      percent: Math.round((complete / blocks.length) * 100),
    };
  }, [professionalData]);

  const effectiveAvatarUrl = useMemo(
    () =>
      normalizeProfileMediaUrl(avatarUrlInput) ||
      normalizeProfileMediaUrl(
        detail?.avatar_url || detail?.avatarUrl || detail?.metadata?.avatar_url,
      ) ||
      normalizeProfileMediaUrl(
        user?.avatarUrl || user?.avatar_url || user?.metadata?.avatar_url,
      ) ||
      nonEmpty(
        user?.avatarUrl || user?.avatar_url || user?.metadata?.avatar_url,
      ) ||
      '/default-avatar.svg',
    [
      avatarUrlInput,
      detail?.avatarUrl,
      detail?.avatar_url,
      detail?.metadata?.avatar_url,
      user?.avatarUrl,
      user?.avatar_url,
      user?.metadata?.avatar_url,
    ],
  );

  const effectiveCoverUrl = useMemo(() => {
    const metaMedia =
      asRecord(detail?.metadata?.media) ||
      asRecord(user?.metadata?.media) ||
      {};
    const metaCover =
      typeof metaMedia.cover_image === 'string'
        ? metaMedia.cover_image
        : undefined;
    return (
      normalizeProfileMediaUrl(coverUrlInput) ||
      normalizeProfileMediaUrl(detail?.cover_image) ||
      normalizeProfileMediaUrl(detail?.metadata?.cover_image) ||
      normalizeProfileMediaUrl(metaCover) ||
      normalizeProfileMediaUrl(user?.metadata?.cover_image) ||
      ''
    );
  }, [coverUrlInput, detail?.cover_image, detail?.metadata, user?.metadata]);

  const statItems = useMemo(
    () => [
      {
        label: 'Active Listings',
        value: listings.length.toLocaleString('en-US'),
        icon: Briefcase,
        hint: 'Live',
      },
      {
        label: 'Transactions',
        value: transactions.length.toLocaleString('en-US'),
        icon: Activity,
        hint: 'History',
      },
      {
        label: 'Roles',
        value: roleList.length.toLocaleString('en-US'),
        icon: ShieldCheck,
        hint: 'Access',
      },
      {
        label: 'Profile Score',
        value: `${profileCoverage.percent}%`,
        icon: Sparkles,
        hint: `${profileCoverage.complete}/${profileCoverage.total}`,
      },
    ],
    [listings.length, transactions.length, roleList.length, profileCoverage],
  );

  const setupCards = useMemo(
    () => [
      {
        key: 'identity',
        title: 'Identitas publik',
        description: 'Nama, kontak, bio, dan lokasi yang tampil di profil.',
        href: '/profile/edit?focus=identity',
        progress: [fullNameInput, phoneInput, locationInput, bioInput].filter(
          value => value.trim().length > 0,
        ).length,
        total: 4,
      },
      {
        key: 'talent',
        title: 'Talent / Freelancer',
        description: 'Headline, skill, pengalaman, pendidikan, dan link.',
        href: '/profile/edit?focus=talent',
        progress: [
          professionalData.headline,
          professionalData.skills.length > 0 ? '1' : '',
          professionalData.experiences.length > 0 ? '1' : '',
          professionalData.links.length > 0 ? '1' : '',
        ].filter(Boolean).length,
        total: 4,
      },
      {
        key: 'seller',
        title: 'Seller / Provider',
        description: 'Service coverage, pricing, dan cara Anda menerima pekerjaan.',
        href: '/profile/edit?focus=seller',
        progress: [
          readString(
            getPathValue(asRecord(mergedMetadata), ['provider_profile', 'headline']),
          ),
          readString(
            getPathValue(asRecord(mergedMetadata), ['provider_profile', 'work_mode']),
          ),
          readString(
            getPathValue(asRecord(mergedMetadata), ['provider_profile', 'response_time']),
          ),
        ].filter(Boolean).length,
        total: 3,
      },
      {
        key: 'buyer',
        title: 'Buyer preferences',
        description: 'Intent, budget, dan area yang Anda cari untuk matching.',
        href: '/profile/edit?focus=buyer',
        progress: [
          readString(getPathValue(asRecord(mergedMetadata), ['buyer_profile', 'intent'])),
          readString(
            getPathValue(asRecord(mergedMetadata), ['buyer_profile', 'preferred_location']),
          ),
        ].filter(Boolean).length,
        total: 2,
      },
      {
        key: 'media',
        title: 'Media & dokumen',
        description: 'Avatar, cover, gallery, CV, dan dokumen pendukung.',
        href: '/profile/edit?focus=media',
        progress: [effectiveAvatarUrl, effectiveCoverUrl, qaResumeUrl].filter(Boolean)
          .length,
        total: 3,
      },
    ],
    [
      bioInput,
      effectiveAvatarUrl,
      effectiveCoverUrl,
      fullNameInput,
      locationInput,
      mergedMetadata,
      phoneInput,
      professionalData.experiences.length,
      professionalData.headline,
      professionalData.links.length,
      professionalData.skills.length,
      qaResumeUrl,
    ],
  );

  if (authLoading || profileLoading) {
    return <ProfileViewSkeleton />;
  }

  if (!user) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center px-4">
        <div className="rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-8 text-center shadow-sm dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
          <h2 className="text-xl font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            Please login first
          </h2>
        </div>
      </div>
    );
  }

  const currentUser = user;

  return (
    <>
      <ProfileHubView
        detail={detail}
        user={currentUser}
        effectiveCoverUrl={effectiveCoverUrl}
        effectiveAvatarUrl={effectiveAvatarUrl}
        coverUploading={coverUploading}
        avatarUploading={avatarUploading}
        saving={saving}
        saveMessage={saveMessage}
        profileError={profileError}
        roleList={roleList}
        professionalData={professionalData}
        statItems={statItems}
        fullNameInput={fullNameInput}
        usernameInput={usernameInput}
        phoneInput={phoneInput}
        locationInput={locationInput}
        bioInput={bioInput}
        onFullNameChange={setFullNameInput}
        onUsernameChange={value =>
          setUsernameInput(normalizePublicProfileHandleInput(value))
        }
        onPhoneChange={setPhoneInput}
        onLocationChange={setLocationInput}
        onBioChange={setBioInput}
        onSaveProfile={() => {
          void saveProfile();
        }}
        onCoverFileChange={handleCoverFileChange}
        onAvatarFileChange={handleAvatarFileChange}
        listings={listings}
        activeMarketplaceTab={activeMarketplaceTab}
        onActiveMarketplaceTabChange={setActiveMarketplaceTab}
        txPreview={txPreview}
        formatDate={formatDate}
        formatMoneyFromCents={formatMoneyFromCents}
        verificationSource={detail?.verification || mergedMetadata}
        onRefreshVerification={async () => {
          await Promise.all([loadProfile(), refreshUser()]);
        }}
        setupCards={setupCards}
        qaResumeUrl={qaResumeUrl}
        qaSaving={qaSaving}
        qaMessage={qaMessage}
        onQuickApplyResumeChange={setQaResumeFile}
        onSaveQuickApply={() => {
          void saveQuickApplyProfile();
        }}
        dialPhone={dialPhone}
      />

      <ImageCropModal
        open={Boolean(cropTarget && cropSource)}
        imageSrc={cropSource}
        aspect={cropTarget === 'cover' ? 16 / 9 : 1}
        maxOutputSize={cropTarget === 'cover' ? 1600 : 512}
        title={cropTarget === 'cover' ? 'Crop Cover Image' : 'Crop Foto Profil'}
        shape={cropTarget === 'avatar' ? 'round' : 'rect'}
        onCancel={closeCropper}
        onConfirm={handleCropConfirm}
      />
    </>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-[color:var(--app-surface-muted)] via-[color:var(--app-surface-strong)] to-[color:var(--app-surface-muted)] pb-8 pt-2 dark:from-[color:var(--app-surface-strong)] dark:via-[color:var(--app-surface-strong)] dark:to-[color:color-mix(in_srgb,_var(--app-accent-strong)_12%,_transparent)] sm:pt-6">
      <div className="page-shell">
        <section className="overflow-hidden rounded-3xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-sm sm:shadow-[0_24px_48px_-32px_rgba(15,23,42,0.55)] dark:border-[color:var(--app-border-strong)]">
          <div className="relative h-28 sm:h-36 lg:h-48">
            {effectiveCoverUrl ? (
              <NextImage
                src={effectiveCoverUrl}
                alt="Profile cover"
                fill
                sizes="100vw"
                className="object-cover"
                unoptimized
              />
            ) : (
              <div className="h-full w-full bg-gradient-to-r from-[color:var(--app-accent)] via-[color:var(--app-accent)] to-[color:var(--app-info)]" />
            )}
            <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-[color:var(--app-surface-strong)] to-transparent" />
            <div className="absolute right-3 top-3 flex items-center gap-2">
              <label
                htmlFor="profile-cover-upload"
                className="inline-flex items-center gap-2 rounded-full border border-white/40 bg-black/45 px-3 py-1 text-[11px] font-semibold text-white backdrop-blur-none sm:backdrop-blur"
              >
                {coverUploading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                Cover
              </label>
              <input
                id="profile-cover-upload"
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleCoverFileChange}
                disabled={coverUploading || saving}
              />
            </div>
          </div>

          <div className="p-4 sm:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
                <div className="-mt-12 sm:-mt-16">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-3xl border-4 border-[color:var(--app-surface-strong)] bg-[color:var(--app-surface-muted)] shadow-md sm:shadow-xl dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] sm:h-24 sm:w-24 lg:h-28 lg:w-28">
                    <NextImage
                      src={effectiveAvatarUrl}
                      alt={
                        detail?.username ||
                        currentUser.username ||
                        currentUser.email
                      }
                      fill
                      sizes="112px"
                      className="object-cover"
                      unoptimized
                    />
                    <label
                      htmlFor="profile-avatar-upload"
                      className="absolute bottom-1 right-1 inline-flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] shadow-sm sm:shadow-lg transition hover:scale-[1.03] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-inverse)]"
                      aria-label="Upload avatar"
                    >
                      {avatarUploading ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Camera className="h-4 w-4" />
                      )}
                    </label>
                    <input
                      id="profile-avatar-upload"
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleAvatarFileChange}
                      disabled={avatarUploading || saving}
                    />
                  </div>
                </div>

                <div className="min-w-0 pt-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h1 className="truncate text-2xl font-bold tracking-tight text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-3xl">
                      {detail?.full_name ||
                        detail?.fullName ||
                        currentUser.full_name ||
                        currentUser.email}
                    </h1>
                    <span className="ui-inline-meta ui-accent-bg ui-accent-border ui-accent-text">
                      @{detail?.username || currentUser.username || 'user'}
                    </span>
                  </div>

                  <p className="mt-2 max-w-2xl text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {professionalData.headline ||
                      'Lengkapi profil biar lebih meyakinkan.'}
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    {(detail?.location || locationInput) && (
                      <span className="ui-inline-meta shrink-0">
                        <MapPin className="h-3.5 w-3.5" />
                        {detail?.location || locationInput}
                      </span>
                    )}

                    {(detail?.email || currentUser.email) && (
                      <span className="ui-inline-meta shrink-0">
                        <Mail className="h-3.5 w-3.5" />
                        {detail?.email || currentUser.email}
                      </span>
                    )}

                    {roleList.slice(0, 4).map(role => (
                      <span
                        key={role}
                        className="ui-inline-meta ui-accent-bg ui-accent-border ui-accent-text shrink-0"
                      >
                        {role}
                      </span>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
                <LocalizedLink
                  href="/profile/edit"
                  className="ui-button-secondary inline-flex w-full items-center justify-center gap-2 px-4 text-sm font-semibold sm:w-auto"
                >
                  <Wrench className="h-4 w-4" />
                  Edit Advanced
                </LocalizedLink>

                <LocalizedLink
                  href="/chat"
                  className="ui-button-secondary inline-flex w-full items-center justify-center gap-2 px-4 text-sm font-semibold sm:w-auto"
                >
                  <MessageCircle className="h-4 w-4" />
                  Open Chat
                </LocalizedLink>

                <button
                  type="button"
                  onClick={() => {
                    void saveProfile();
                  }}
                  disabled={saving || avatarUploading}
                  className="ui-button-primary inline-flex w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Profile
                </button>
              </div>
            </div>

            {saveMessage ? (
              <div className="ui-panel-muted mt-4 inline-flex items-center gap-2 px-3 py-2 text-sm ui-text">
                <CheckCircle2 className="h-4 w-4 ui-accent-text" />
                {saveMessage}
              </div>
            ) : null}
          </div>
        </section>

        <section className="mt-4">
          <div className="flex gap-4 overflow-x-auto pb-3 sm:hidden">
            {statItems.map(item => (
              <div key={item.label} className="min-w-[200px]">
                <StatCard
                  label={item.label}
                  value={item.value}
                  icon={item.icon}
                  hint={item.hint}
                />
              </div>
            ))}
          </div>
          <div className="hidden gap-4 sm:grid sm:grid-cols-2 lg:grid-cols-4">
            {statItems.map(item => (
              <StatCard
                key={item.label}
                label={item.label}
                value={item.value}
                icon={item.icon}
                hint={item.hint}
              />
            ))}
          </div>
        </section>

        {profileError ? (
          <section className="ui-panel-muted mt-4 border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] px-4 py-3 text-sm ui-warning-text">
            {profileError}
          </section>
        ) : null}

        <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_360px]">
          <main className="space-y-5">
            <SectionCard
              title="About & Professional Overview"
              subtitle="Tampilan gabungan profile marketplace, jobs, dan creator dashboard."
            >
              <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="space-y-5">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--app-text-soft)]">
                      Summary
                    </p>
                    <p className="mt-2 text-sm leading-6 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] line-clamp-4 sm:line-clamp-none">
                      {professionalData.summary ||
                        bioInput ||
                        'Belum ada ringkasan. Tambah bio, pengalaman, dan value.'}
                    </p>
                  </div>

                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Wrench className="h-4 w-4 text-[color:var(--app-accent)]" />
                      <h3 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        Top Skills
                      </h3>
                    </div>
                    {professionalData.skills.length === 0 ? (
                      <EmptyState text="Belum ada data skill." />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {professionalData.skills.slice(0, 10).map(skill => (
                          <span
                            key={skill}
                            className="inline-flex min-h-[36px] items-center rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-xs font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]"
                          >
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <div>
                    <div className="mb-3 flex items-center gap-2">
                      <Briefcase className="h-4 w-4 text-[color:var(--app-accent)]" />
                      <h3 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        Experience
                      </h3>
                    </div>

                    {professionalData.experiences.length === 0 ? (
                      <EmptyState text="Belum ada pengalaman kerja di metadata profil." />
                    ) : (
                      <div className="space-y-3">
                        {professionalData.experiences.slice(0, 3).map(entry => (
                          <div
                            key={`${entry.title}-${entry.subtitle || ''}-${entry.meta || ''}`}
                            className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                          >
                            <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                              {entry.title}
                            </p>
                            {entry.subtitle ? (
                              <p className="mt-1 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                {entry.subtitle}
                              </p>
                            ) : null}
                            {entry.meta ? (
                              <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                {entry.meta}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
                    <div className="mb-3 flex items-center gap-2">
                      <GraduationCap className="h-4 w-4 text-[color:var(--app-accent)]" />
                      <h3 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        Education
                      </h3>
                    </div>
                    {professionalData.education.length === 0 ? (
                      <EmptyState text="Belum ada data education." />
                    ) : (
                      <div className="space-y-3">
                        {professionalData.education.slice(0, 2).map(entry => (
                          <div
                            key={`${entry.title}-${entry.subtitle || ''}`}
                            className="rounded-xl bg-[color:var(--app-surface-strong)] p-3 dark:bg-[color:var(--app-surface-strong)]"
                          >
                            <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                              {entry.title}
                            </p>
                            {entry.subtitle ? (
                              <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                {entry.subtitle}
                              </p>
                            ) : null}
                            {entry.meta ? (
                              <p className="mt-1 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                {entry.meta}
                              </p>
                            ) : null}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
                    <div className="mb-3 flex items-center gap-2">
                      <Award className="h-4 w-4 text-[color:var(--app-accent)]" />
                      <h3 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        Certificates
                      </h3>
                    </div>
                    {professionalData.certifications.length === 0 ? (
                      <EmptyState text="Belum ada data certificate." />
                    ) : (
                      <div className="space-y-3">
                        {professionalData.certifications
                          .slice(0, 2)
                          .map(entry => (
                            <div
                              key={`${entry.title}-${entry.subtitle || ''}`}
                              className="rounded-xl bg-[color:var(--app-surface-strong)] p-3 dark:bg-[color:var(--app-surface-strong)]"
                            >
                              <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                                {entry.title}
                              </p>
                              {entry.subtitle ? (
                                <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                  {entry.subtitle}
                                </p>
                              ) : null}
                              {entry.meta ? (
                                <p className="mt-1 text-[11px] text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                                  {entry.meta}
                                </p>
                              ) : null}
                              {entry.url ? (
                                <a
                                  href={entry.url}
                                  target="_blank"
                                  rel="noreferrer noopener"
                                  className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-[color:var(--app-accent)] hover:underline dark:text-[color:var(--app-accent)]"
                                >
                                  Open certificate
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              ) : null}
                            </div>
                          ))}
                      </div>
                    )}
                  </div>

                  <div className="rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
                    <div className="mb-3 flex items-center gap-2">
                      <Languages className="h-4 w-4 text-[color:var(--app-accent)]" />
                      <h3 className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                        Languages
                      </h3>
                    </div>
                    {professionalData.languages.length === 0 ? (
                      <EmptyState text="Belum ada data bahasa." />
                    ) : (
                      <div className="flex flex-wrap gap-2">
                        {professionalData.languages
                          .slice(0, 6)
                          .map(language => (
                            <span
                              key={language}
                              className="inline-flex items-center rounded-full bg-[color:var(--app-info-soft)] px-3 py-1.5 text-xs font-semibold text-[color:var(--app-info)] dark:bg-[color:color-mix(in_srgb,_var(--app-info)_40%,_transparent)] dark:text-[color:var(--app-info)]"
                            >
                              {language}
                            </span>
                          ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Edit Public Profile"
              subtitle="Form utama untuk profile marketplace, jobs, dan discoverability."
              action={
                <span className="inline-flex items-center rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_50%,_transparent)] dark:text-[color:var(--app-accent)]">
                  Public
                </span>
              }
            >
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    Full name
                  </span>
                  <input
                    value={fullNameInput}
                    onChange={e => setFullNameInput(e.target.value)}
                    className="ui-control w-full px-3 text-sm"
                    placeholder="Nama lengkap"
                  />
                </label>

                <label className="space-y-1.5">
                  <span className="text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    Phone
                  </span>
                  <input
                    value={phoneInput}
                    onChange={e => setPhoneInput(e.target.value)}
                    className="ui-control w-full px-3 text-sm"
                    placeholder="Nomor telepon"
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    Location
                  </span>
                  <input
                    value={locationInput}
                    onChange={e => setLocationInput(e.target.value)}
                    className="ui-control w-full px-3 text-sm"
                    placeholder="Kota, provinsi, atau lokasi kerja"
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-2">
                  <span className="text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    Bio
                  </span>
                  <textarea
                    value={bioInput}
                    onChange={e => setBioInput(e.target.value)}
                    rows={4}
                    className="ui-control w-full px-3 py-2 text-sm"
                    placeholder="Tulis ringkasan singkat tentang pengalaman, skill, dan value Anda."
                  />
                </label>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => {
                    void saveProfile();
                  }}
                  disabled={saving || avatarUploading}
                  className="ui-button-primary inline-flex items-center gap-2 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Save Changes
                </button>

                <p className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  Perubahan ini dipakai juga untuk marketplace dan chat
                  identity.
                </p>
              </div>
            </SectionCard>

            <IdentityVerificationPanel
              verificationSource={detail?.verification || mergedMetadata}
              onRefresh={async () => {
                await Promise.all([loadProfile(), refreshUser()]);
              }}
            />

            <div className="grid gap-5 lg:grid-cols-2">
              <SectionCard
                title="Your Listings"
                subtitle="Preview listing aktif seperti halaman seller / marketplace."
                action={
                  <LocalizedLink
                    href="/my-listings"
                    className="inline-flex items-center gap-1 text-sm font-semibold ui-accent-text"
                  >
                    View all
                    <ChevronRight className="h-4 w-4" />
                  </LocalizedLink>
                }
              >
                {listings.length === 0 ? (
                  <EmptyState text="Belum ada listing aktif." />
                ) : (
                  <div className="space-y-3">
                    {listingsPreview.map(item => (
                      <div
                        key={item.id}
                        className="flex items-start justify-between gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {item.title || 'Untitled listing'}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {(item.content_type || 'content').toUpperCase()} -{' '}
                            {formatDate(item.created_at)}
                          </p>
                        </div>
                        <span className="ui-inline-meta ui-accent-bg ui-accent-border ui-accent-text shrink-0">
                          {(
                            item.content_status ||
                            item.status ||
                            'active'
                          ).toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>

              <SectionCard
                title="Recent Transactions"
                subtitle="Model compact widget seperti dashboard jobs / freelance."
                action={
                  <LocalizedLink
                    href="/transactions"
                    className="inline-flex items-center gap-1 text-sm font-semibold ui-accent-text"
                  >
                    View all
                    <ChevronRight className="h-4 w-4" />
                  </LocalizedLink>
                }
              >
                {transactions.length === 0 ? (
                  <EmptyState text="Belum ada transaksi." />
                ) : (
                  <div className="space-y-3">
                    {txPreview.map(item => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                            {formatMoneyFromCents(
                              item.amount_cents,
                              item.currency || 'IDR',
                            )}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                            {formatDate(item.created_at)}
                          </p>
                        </div>
                        <span className="shrink-0 rounded-full bg-[color:var(--app-surface)] px-2.5 py-1 text-[11px] font-semibold text-[color:var(--app-text)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)]">
                          {(item.status || 'pending').toUpperCase()}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </div>
          </main>

          <aside className="space-y-5">
            <SectionCard
              title="Quick Apply"
              subtitle="Simpan CV dan data utama untuk lamaran instan."
            >
              <div className="space-y-4">
                <div className="rounded-2xl border border-dashed border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-4 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
                  <p className="text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    Upload CV / Resume
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    Format: PDF, DOC, DOCX
                  </p>

                  <input
                    type="file"
                    accept=".pdf,.doc,.docx"
                    onChange={e => setQaResumeFile(e.target.files?.[0] || null)}
                    className="mt-3 block w-full text-xs text-[color:var(--app-text)] file:mr-3 file:rounded-xl file:border-0 file:bg-[color:var(--app-accent-soft)] file:px-3 file:py-2 file:text-xs file:font-semibold file:text-[color:var(--app-accent)] dark:text-[color:var(--app-text-soft)] dark:file:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_60%,_transparent)] dark:file:text-[color:var(--app-accent)]"
                  />

                  {qaResumeUrl ? (
                    <a
                      href={qaResumeUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="mt-3 inline-flex items-center gap-1 text-xs font-semibold ui-accent-text hover:underline"
                    >
                      Lihat CV tersimpan
                      <ExternalLink className="h-3.5 w-3.5" />
                    </a>
                  ) : null}
                </div>

                <div className="ui-panel-muted p-4">
                  <p className="text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    Data yang akan dipakai
                  </p>
                  <div className="mt-3 space-y-2 text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    <div className="flex items-center gap-2">
                      <User2 className="h-4 w-4 ui-accent-text" />
                      <span>{fullNameInput || currentUser.full_name || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 ui-accent-text" />
                      <span>{currentUser.email}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 ui-accent-text" />
                      <span>{phoneInput || currentUser.phone || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 ui-accent-text" />
                      <span>{locationInput || '-'}</span>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={saveQuickApplyProfile}
                  disabled={qaSaving}
                  className="ui-button-primary inline-flex w-full items-center justify-center gap-2 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {qaSaving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Simpan Quick Apply
                </button>

                {qaMessage ? (
                  <p className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {qaMessage}
                  </p>
                ) : null}
              </div>
            </SectionCard>

            <SectionCard
              title="Account Info"
              subtitle="Informasi akun utama dan shortcut cepat."
            >
              <div className="space-y-3">
                <div className="ui-panel-muted flex items-center gap-3 p-3">
                  <Mail className="h-4 w-4 ui-accent-text" />
                  <span className="min-w-0 truncate text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {detail?.email || currentUser.email}
                  </span>
                </div>

                <div className="ui-panel-muted flex items-center gap-3 p-3">
                  <Phone className="h-4 w-4 ui-accent-text" />
                  <span className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {detail?.phone || '-'}
                  </span>
                </div>

                <div className="ui-panel-muted flex items-center gap-3 p-3">
                  <MapPin className="h-4 w-4 ui-accent-text" />
                  <span className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                    {detail?.location || '-'}
                  </span>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-1">
                  <LocalizedLink
                    href="/chat"
                    className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
                  >
                    <MessageCircle className="h-4 w-4" />
                    Open Chat
                  </LocalizedLink>

                  {dialPhone ? (
                    <a
                      href={`tel:${dialPhone}`}
                      className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold"
                    >
                      <PhoneCall className="h-4 w-4" />
                      Call Now
                    </a>
                  ) : (
                    <div className="ui-panel-muted inline-flex min-h-[44px] items-center justify-center gap-2 px-4 text-sm font-semibold ui-text">
                      <PhoneCall className="h-4 w-4" />
                      No Phone
                    </div>
                  )}
                </div>
              </div>
            </SectionCard>

            <SectionCard
              title="Portfolio & Links"
              subtitle="Link profesional seperti profile freelancer / creative marketplace."
            >
              {professionalData.links.length === 0 ? (
                <EmptyState text="Belum ada link profesional di metadata profil." />
              ) : (
                <div className="space-y-2">
                  {professionalData.links.slice(0, 6).map(item => (
                    <a
                      key={`${item.label}-${item.url}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="flex min-h-[48px] items-center justify-between gap-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-sm text-[color:var(--app-text)] transition hover:border-[color:var(--app-accent-border)] hover:text-[color:var(--app-accent)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)] dark:text-[color:var(--app-text-soft)] dark:hover:border-[color:var(--app-accent-border)] dark:hover:text-[color:var(--app-accent)]"
                    >
                      <span className="inline-flex min-w-0 items-center gap-2">
                        <Link2 className="h-4 w-4 shrink-0" />
                        <span>{item.label}</span>
                      </span>
                      <ExternalLink className="h-4 w-4 shrink-0" />
                    </a>
                  ))}
                </div>
              )}
            </SectionCard>

            <SectionCard
              title="Integration Status"
              subtitle="Sinkron dengan identitas auth dan chat."
            >
              <div className="ui-panel-muted p-4">
                <div className="flex items-start gap-3">
                  <div className="rounded-xl bg-[color:var(--app-surface-strong)] p-2 ui-accent-text">
                    <CheckCircle2 className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold ui-accent-text">
                      Chat Integration Active
                    </p>
                    <p className="mt-1 text-sm leading-6 ui-text-soft">
                      Data profil ini menggunakan auth identity yang sama dengan
                      chat, discover, dan profile visibility.
                    </p>
                  </div>
                </div>
              </div>
            </SectionCard>
          </aside>
        </div>
      </div>

      <ImageCropModal
        open={Boolean(cropTarget && cropSource)}
        imageSrc={cropSource}
        aspect={cropTarget === 'cover' ? 16 / 9 : 1}
        maxOutputSize={cropTarget === 'cover' ? 1600 : 512}
        title={cropTarget === 'cover' ? 'Crop Cover Image' : 'Crop Foto Profil'}
        shape={cropTarget === 'avatar' ? 'round' : 'rect'}
        onCancel={closeCropper}
        onConfirm={handleCropConfirm}
      />
    </div>
  );
}
