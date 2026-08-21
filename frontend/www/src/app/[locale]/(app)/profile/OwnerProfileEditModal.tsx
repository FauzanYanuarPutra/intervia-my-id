'use client';

import {
  type ChangeEvent,
  type ComponentType,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { createPortal } from 'react-dom';
import {
  ArrowLeft,
  BadgeCheck,
  BriefcaseBusiness,
  Check,
  CheckCircle2,
  ChevronRight,
  FileText,
  Globe2,
  GraduationCap,
  Images,
  Link2,
  Loader2,
  MapPin,
  Phone,
  Plus,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  UserRound,
  X,
} from 'lucide-react';

import { useAuth } from '@/context/AuthContext';
import { prepareUploadFiles } from '@/lib/media/prepareUploadMedia';
import {
  extractUploadedDocumentUrls,
  extractUploadedImageUrls,
  normalizeProfileMediaList,
} from '@/lib/profile/profileMedia';
import { normalizePublicProfileHandleInput } from '@/lib/profile/publicProfileLink';
import { cn } from '@/lib/utils';

type MetaRecord = Record<string, unknown>;

export type OwnerProfileEditSection =
  | 'menu'
  | 'identity'
  | 'contact'
  | 'business'
  | 'professional'
  | 'buyer'
  | 'history'
  | 'media'
  | 'trust';

type UserDetailLike = {
  id: string;
  email?: string | null;
  phone?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  username?: string | null;
  bio?: string | null;
  location?: string | null;
  phone_verified?: boolean | null;
  email_verified?: boolean | null;
  identity_verified?: boolean | null;
  document_verified?: boolean | null;
  liveness_verified?: boolean | null;
  kyc_status?: string | null;
  verification?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
};

type ProfileEntry = {
  title: string;
  subtitle?: string;
  meta?: string;
  url?: string;
};

type LinkEntry = { label: string; url: string };
type EntryKind = 'experience' | 'education' | 'certificate';

type OwnerProfileEditModalProps = {
  open: boolean;
  detail: UserDetailLike | null;
  metadata: MetaRecord;
  isId: boolean;
  initialSection?: OwnerProfileEditSection;
  onSectionChange?: (section: OwnerProfileEditSection) => void;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
};

function asRecord(value: unknown): MetaRecord {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as MetaRecord)
    : {};
}

function asString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function asBoolean(value: unknown, fallback: boolean): boolean {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['true', '1', 'yes', 'on'].includes(normalized)) return true;
    if (['false', '0', 'no', 'off'].includes(normalized)) return false;
  }
  return fallback;
}

function toStringList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map(item => String(item || '').trim()).filter(Boolean);
  }
  if (typeof value === 'string') {
    return value
      .split(/[,\n;|]/g)
      .map(item => item.trim())
      .filter(Boolean);
  }
  return [];
}

function joinList(value: unknown): string {
  return toStringList(value).join(', ');
}

function normalizePhoneDigits(value: string): string {
  return value.replace(/\D/g, '');
}

function normalizeEntry(value: unknown): ProfileEntry | null {
  if (typeof value === 'string') {
    const title = value.trim();
    return title ? { title } : null;
  }
  const row = asRecord(value);
  const title =
    asString(row.title) ||
    asString(row.name) ||
    asString(row.degree) ||
    asString(row.school) ||
    asString(row.institution);
  if (!title) return null;
  return {
    title,
    subtitle:
      asString(row.subtitle) ||
      asString(row.institution) ||
      asString(row.school) ||
      asString(row.field) ||
      undefined,
    meta:
      asString(row.meta) ||
      asString(row.year) ||
      asString(row.level) ||
      asString(row.status) ||
      undefined,
    url: asString(row.url) || asString(row.link) || undefined,
  };
}

function readEntries(value: unknown): ProfileEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .map(normalizeEntry)
    .filter((item): item is ProfileEntry => Boolean(item));
}

function toInt(value: string): number | undefined {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function InputLabel({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="block min-w-0">
      <span className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        {label}
      </span>
      {hint ? (
        <span className="mt-0.5 block text-[11px] leading-4 text-[color:var(--app-text-soft)]">
          {hint}
        </span>
      ) : null}
      <span className="mt-2 block">{children}</span>
    </label>
  );
}

function StatusDot({ active }: { active: boolean }) {
  return active ? (
    <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-600 text-white">
      <Check className="h-3 w-3" strokeWidth={3} />
    </span>
  ) : (
    <span className="h-5 w-5 rounded-full border-2 border-[color:var(--app-border-strong)]" />
  );
}

function MenuRow({
  icon: Icon,
  title,
  description,
  complete,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  title: string;
  description: string;
  complete?: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[68px] w-full min-w-0 items-center gap-3 border-b border-[color:var(--app-border)] px-4 py-3 text-left transition last:border-b-0 hover:bg-[color:var(--app-surface-muted)] sm:px-5"
    >
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[color:var(--app-surface-muted)] text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
        <Icon className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-2">
          <span className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {title}
          </span>
          {complete ? (
            <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" />
          ) : null}
        </span>
        <span className="mt-0.5 block line-clamp-1 text-[11px] text-[color:var(--app-text-soft)]">
          {description}
        </span>
      </span>
      <ChevronRight className="h-4 w-4 shrink-0 text-[color:var(--app-text-soft)]" />
    </button>
  );
}

export function OwnerProfileEditModal({
  open,
  detail,
  metadata,
  isId,
  initialSection = 'menu',
  onSectionChange,
  onClose,
  onSaved,
}: OwnerProfileEditModalProps) {
  const { authFetch, refreshUser } = useAuth();
  const [mounted, setMounted] = useState(false);
  const [section, setSection] = useState<OwnerProfileEditSection>(initialSection);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [location, setLocation] = useState('');
  const [bio, setBio] = useState('');
  const [roles, setRoles] = useState('');
  const [discoverable, setDiscoverable] = useState(true);

  const [phone, setPhone] = useState('');
  const [verifiedPhoneDigits, setVerifiedPhoneDigits] = useState('');
  const [phoneVerified, setPhoneVerified] = useState(false);
  const [phoneOtp, setPhoneOtp] = useState('');
  const [phoneOtpMessage, setPhoneOtpMessage] = useState('');
  const [sendingOtp, setSendingOtp] = useState(false);
  const [verifyingOtp, setVerifyingOtp] = useState(false);

  const [providerHeadline, setProviderHeadline] = useState('');
  const [providerSkills, setProviderSkills] = useState('');
  const [serviceCoverage, setServiceCoverage] = useState('');
  const [workMode, setWorkMode] = useState('');
  const [responseTime, setResponseTime] = useState('');
  const [priceMin, setPriceMin] = useState('');
  const [priceMax, setPriceMax] = useState('');

  const [headline, setHeadline] = useState('');
  const [skills, setSkills] = useState('');
  const [languages, setLanguages] = useState('');
  const [hourlyRate, setHourlyRate] = useState('');
  const [experienceYears, setExperienceYears] = useState('');
  const [portfolioUrls, setPortfolioUrls] = useState('');

  const [buyerIntent, setBuyerIntent] = useState('');
  const [buyerBudgetMin, setBuyerBudgetMin] = useState('');
  const [buyerBudgetMax, setBuyerBudgetMax] = useState('');
  const [preferredSector, setPreferredSector] = useState('');
  const [preferredSubSector, setPreferredSubSector] = useState('');
  const [preferredLocation, setPreferredLocation] = useState('');

  const [educationEntries, setEducationEntries] = useState<ProfileEntry[]>([]);
  const [experienceEntries, setExperienceEntries] = useState<ProfileEntry[]>([]);
  const [certificateEntries, setCertificateEntries] = useState<ProfileEntry[]>([]);
  const [linkEntries, setLinkEntries] = useState<LinkEntry[]>([]);
  const [entryKind, setEntryKind] = useState<EntryKind | null>(null);
  const [entryIndex, setEntryIndex] = useState<number | null>(null);
  const [entryDraft, setEntryDraft] = useState<ProfileEntry>({ title: '' });

  const [galleryImages, setGalleryImages] = useState<string[]>([]);
  const [documentUrls, setDocumentUrls] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState(false);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const inputClass =
    'min-h-11 w-full rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-sm text-[color:var(--app-text)] outline-none transition placeholder:text-[color:var(--app-text-soft)] focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/15 dark:text-[color:var(--app-text-inverse)]';
  const textareaClass = `${inputClass} min-h-28 resize-y py-2.5`;

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setSection(initialSection);
    setEntryKind(null);
    setEntryIndex(null);
    setError('');
    setMessage('');
  }, [initialSection, open]);

  useEffect(() => {
    if (!open || !detail) return;

    const baseMeta = asRecord(metadata);
    const freelancer = asRecord(baseMeta.freelancer_profile);
    const provider = asRecord(baseMeta.provider_profile);
    const buyer = asRecord(baseMeta.buyer_profile);
    const profile = asRecord(baseMeta.profile);
    const media = asRecord(baseMeta.media);
    const verification = asRecord(detail.verification);

    setFullName(asString(detail.full_name || detail.fullName));
    setUsername(normalizePublicProfileHandleInput(asString(detail.username)));
    setLocation(asString(detail.location));
    setBio(asString(detail.bio));
    setRoles(joinList(baseMeta.roles));
    setDiscoverable(asBoolean(baseMeta.discoverable, true));

    const nextPhone = asString(detail.phone);
    setPhone(nextPhone);
    setVerifiedPhoneDigits(normalizePhoneDigits(nextPhone));
    setPhoneVerified(Boolean(detail.phone_verified ?? verification.phone_verified));
    setPhoneOtp('');
    setPhoneOtpMessage('');

    setProviderHeadline(asString(provider.headline));
    setProviderSkills(joinList(provider.skills));
    setServiceCoverage(joinList(provider.service_coverage));
    setWorkMode(asString(provider.work_mode));
    setResponseTime(asString(provider.response_time));
    setPriceMin(asString(provider.price_min));
    setPriceMax(asString(provider.price_max));

    setHeadline(
      asString(freelancer.professional_title) || asString(freelancer.tagline),
    );
    setSkills(joinList(freelancer.skills));
    setLanguages(joinList(freelancer.languages));
    setHourlyRate(asString(freelancer.hourly_rate));
    setExperienceYears(asString(freelancer.experience_years));
    setPortfolioUrls(joinList(freelancer.portfolio_urls));

    setBuyerIntent(asString(buyer.intent));
    setBuyerBudgetMin(asString(buyer.budget_min));
    setBuyerBudgetMax(asString(buyer.budget_max));
    setPreferredSector(asString(buyer.preferred_sector));
    setPreferredSubSector(asString(buyer.preferred_sub_sector));
    setPreferredLocation(asString(buyer.preferred_location));

    setEducationEntries(
      readEntries(
        Array.isArray(freelancer.education)
          ? freelancer.education
          : baseMeta.education,
      ),
    );
    setExperienceEntries(
      readEntries(
        Array.isArray(freelancer.experiences)
          ? freelancer.experiences
          : freelancer.experience || baseMeta.experiences || baseMeta.experience,
      ),
    );
    setCertificateEntries(
      readEntries(
        Array.isArray(freelancer.certifications)
          ? freelancer.certifications
          : freelancer.certificates || baseMeta.certifications,
      ),
    );

    const knownLinks: LinkEntry[] = [
      { label: 'Portfolio', url: asString(profile.portfolio_url) },
      { label: 'Website', url: asString(profile.website) },
      { label: 'LinkedIn', url: asString(profile.linkedin_url) },
      { label: 'GitHub', url: asString(profile.github_url) },
    ].filter(item => item.url);
    const extraLinks = Array.isArray(profile.links)
      ? profile.links
          .map(value => {
            const row = asRecord(value);
            const url = asString(row.url || row.link);
            return url
              ? { label: asString(row.label || row.title) || 'Link', url }
              : null;
          })
          .filter((item): item is LinkEntry => Boolean(item))
      : [];
    setLinkEntries(
      [...knownLinks, ...extraLinks].filter(
        (item, index, rows) => rows.findIndex(row => row.url === item.url) === index,
      ),
    );

    setGalleryImages(
      normalizeProfileMediaList(baseMeta.gallery_images || media.gallery_images),
    );
    setDocumentUrls(
      normalizeProfileMediaList(baseMeta.documents || media.documents),
    );
  }, [detail, metadata, open]);

  useEffect(() => {
    if (!open || typeof document === 'undefined') return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [open]);

  const goToSection = (nextSection: OwnerProfileEditSection) => {
    setSection(nextSection);
    setEntryKind(null);
    setEntryIndex(null);
    setError('');
    setMessage('');
    onSectionChange?.(nextSection);
  };

  const phoneDigits = useMemo(() => normalizePhoneDigits(phone), [phone]);
  const phoneVerificationReady =
    phoneVerified &&
    phoneDigits.length >= 8 &&
    phoneDigits === verifiedPhoneDigits;

  const verificationStatus = useMemo(() => {
    const raw =
      asString(detail?.kyc_status) ||
      asString(detail?.verification?.status) ||
      asString(metadata.kyc_status) ||
      asString(asRecord(metadata.verification).status);
    return raw.toLowerCase();
  }, [detail?.kyc_status, detail?.verification, metadata]);

  const identityVerified = Boolean(
    detail?.identity_verified ||
      detail?.document_verified ||
      detail?.liveness_verified ||
      ['verified', 'approved', 'complete', 'completed'].includes(verificationStatus),
  );
  const emailVerified = Boolean(
    detail?.email_verified || metadata.email_verified === true,
  );

  const sectionTitle: Record<OwnerProfileEditSection, string> = isId
    ? {
        menu: 'Edit profil',
        identity: 'Profil utama',
        contact: 'Kontak',
        business: 'Usaha atau jasa',
        professional: 'Keahlian profesional',
        buyer: 'Sedang mencari',
        history: 'Pengalaman & bukti',
        media: 'Galeri & dokumen',
        trust: 'Kepercayaan & verifikasi',
      }
    : {
        menu: 'Edit profile',
        identity: 'Main profile',
        contact: 'Contact',
        business: 'Business or services',
        professional: 'Professional skills',
        buyer: 'Looking for',
        history: 'Experience & proof',
        media: 'Gallery & documents',
        trust: 'Trust & verification',
      };

  const updateProfile = async (payload: Record<string, unknown>) => {
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await authFetch('/api/auth/update-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        throw new Error(data.error || (isId ? 'Perubahan belum tersimpan.' : 'Changes were not saved.'));
      }
      setMessage(isId ? 'Perubahan tersimpan.' : 'Changes saved.');
      await refreshUser();
      await onSaved();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : isId
            ? 'Perubahan belum tersimpan.'
            : 'Changes were not saved.',
      );
    } finally {
      setSaving(false);
    }
  };

  const saveIdentity = async () => {
    const nextMetadata = {
      ...metadata,
      discoverable,
      roles: toStringList(roles),
    };
    await updateProfile({
      full_name: fullName.trim() || undefined,
      username: normalizePublicProfileHandleInput(username) || undefined,
      location: location.trim() || undefined,
      bio: bio.trim() || undefined,
      roles: toStringList(roles),
      metadata: nextMetadata,
    });
  };

  const saveContact = async () => {
    await updateProfile({
      phone: phoneDigits || undefined,
      metadata: { ...metadata },
    });
  };

  const saveBusiness = async () => {
    const payload = {
      headline: providerHeadline.trim() || undefined,
      skills: toStringList(providerSkills),
      service_coverage: toStringList(serviceCoverage),
      work_mode: workMode.trim() || undefined,
      response_time: responseTime.trim() || undefined,
      price_min: toInt(priceMin),
      price_max: toInt(priceMax),
    };
    await updateProfile({
      provider_profile: payload,
      metadata: {
        ...metadata,
        provider_profile: { ...asRecord(metadata.provider_profile), ...payload },
      },
    });
  };

  const saveProfessional = async () => {
    const payload = {
      professional_title: headline.trim() || undefined,
      tagline: headline.trim() || undefined,
      skills: toStringList(skills),
      languages: toStringList(languages),
      hourly_rate: toInt(hourlyRate),
      experience_years: toInt(experienceYears),
      portfolio_urls: toStringList(portfolioUrls),
    };
    await updateProfile({
      freelancer_profile: payload,
      metadata: {
        ...metadata,
        freelancer_profile: {
          ...asRecord(metadata.freelancer_profile),
          ...payload,
        },
      },
    });
  };

  const saveBuyer = async () => {
    const payload = {
      intent: buyerIntent.trim() || undefined,
      budget_min: toInt(buyerBudgetMin),
      budget_max: toInt(buyerBudgetMax),
      preferred_sector: preferredSector.trim() || undefined,
      preferred_sub_sector: preferredSubSector.trim() || undefined,
      preferred_location: preferredLocation.trim() || undefined,
    };
    await updateProfile({
      buyer_profile: payload,
      metadata: {
        ...metadata,
        buyer_profile: { ...asRecord(metadata.buyer_profile), ...payload },
      },
    });
  };

  const entryPayload = (entries: ProfileEntry[]) =>
    entries
      .map(item => ({
        title: item.title.trim(),
        subtitle: item.subtitle?.trim() || undefined,
        meta: item.meta?.trim() || undefined,
        url: item.url?.trim() || undefined,
      }))
      .filter(item => item.title);

  const saveHistory = async () => {
    const freelancer = {
      ...asRecord(metadata.freelancer_profile),
      education: entryPayload(educationEntries),
      experiences: entryPayload(experienceEntries),
      certifications: entryPayload(certificateEntries),
    };
    const profile = {
      ...asRecord(metadata.profile),
      links: linkEntries
        .map(item => ({
          label: item.label.trim() || 'Link',
          url: item.url.trim(),
        }))
        .filter(item => item.url),
    };
    await updateProfile({
      freelancer_profile: freelancer,
      profile,
      metadata: {
        ...metadata,
        freelancer_profile: freelancer,
        profile,
        education: entryPayload(educationEntries),
        experiences: entryPayload(experienceEntries),
        certifications: entryPayload(certificateEntries),
      },
    });
  };

  const saveMedia = async () => {
    const media = {
      ...asRecord(metadata.media),
      gallery_images: galleryImages,
      documents: documentUrls,
    };
    await updateProfile({
      image_urls: galleryImages,
      document_urls: documentUrls,
      media,
      metadata: {
        ...metadata,
        media,
        gallery_images: galleryImages,
        documents: documentUrls,
      },
    });
  };

  const sendPhoneOtp = async () => {
    if (phoneDigits.length < 8) {
      setError(isId ? 'Masukkan nomor WhatsApp yang valid.' : 'Enter a valid WhatsApp number.');
      return;
    }
    setSendingOtp(true);
    setError('');
    setPhoneOtpMessage('');
    try {
      const response = await fetch('/api/auth/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'phone', target: phoneDigits, purpose: 'profile' }),
      });
      const data = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) throw new Error(data.error || 'OTP failed');
      setPhoneOtp('');
      setPhoneOtpMessage(isId ? 'Kode OTP sudah dikirim.' : 'OTP code sent.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'OTP failed');
    } finally {
      setSendingOtp(false);
    }
  };

  const verifyPhoneOtp = async () => {
    if (!/^\d{6}$/.test(phoneOtp)) {
      setError(isId ? 'Masukkan OTP 6 digit.' : 'Enter the 6-digit OTP.');
      return;
    }
    setVerifyingOtp(true);
    setError('');
    try {
      const verifyResponse = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'phone',
          target: phoneDigits,
          otp: phoneOtp,
          purpose: 'profile',
        }),
      });
      const verifyData = (await verifyResponse.json().catch(() => ({}))) as {
        token?: string;
        error?: string;
      };
      if (!verifyResponse.ok || !verifyData.token) {
        throw new Error(verifyData.error || (isId ? 'Kode OTP tidak valid.' : 'Invalid OTP.'));
      }
      const confirmResponse = await authFetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneDigits, phone_otp_token: verifyData.token }),
      });
      const confirmData = (await confirmResponse.json().catch(() => ({}))) as {
        error?: string;
      };
      if (!confirmResponse.ok) {
        throw new Error(confirmData.error || (isId ? 'Verifikasi gagal.' : 'Verification failed.'));
      }
      setPhone(phoneDigits);
      setVerifiedPhoneDigits(phoneDigits);
      setPhoneVerified(true);
      setPhoneOtp('');
      setPhoneOtpMessage(isId ? 'Nomor berhasil diverifikasi.' : 'Number verified.');
      await refreshUser();
      await onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Verification failed');
    } finally {
      setVerifyingOtp(false);
    }
  };

  const uploadGallery = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = '';
    if (!files?.length) return;
    setUploadingImages(true);
    setError('');
    try {
      const prepared = await prepareUploadFiles(Array.from(files));
      const body = new FormData();
      prepared.forEach(file => body.append('images', file));
      const response = await authFetch('/api/content/upload-images', {
        method: 'POST',
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(asString(asRecord(data).error) || 'Upload failed');
      setGalleryImages(current =>
        Array.from(new Set([...current, ...extractUploadedImageUrls(data)])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingImages(false);
    }
  };

  const uploadDocuments = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    event.target.value = '';
    if (!files?.length) return;
    setUploadingDocs(true);
    setError('');
    try {
      const body = new FormData();
      Array.from(files).forEach(file => body.append('files', file));
      const response = await authFetch('/api/content/upload-files', {
        method: 'POST',
        body,
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(asString(asRecord(data).error) || 'Upload failed');
      setDocumentUrls(current =>
        Array.from(new Set([...current, ...extractUploadedDocumentUrls(data)])),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload failed');
    } finally {
      setUploadingDocs(false);
    }
  };

  const openEntry = (kind: EntryKind, index: number | null) => {
    const rows =
      kind === 'experience'
        ? experienceEntries
        : kind === 'education'
          ? educationEntries
          : certificateEntries;
    const current = index === null ? null : rows[index];
    setEntryKind(kind);
    setEntryIndex(index);
    setEntryDraft(current ? { ...current } : { title: '', subtitle: '', meta: '', url: '' });
  };

  const saveEntryDraft = () => {
    if (!entryKind || !entryDraft.title.trim()) {
      setError(isId ? 'Judul utama wajib diisi.' : 'A title is required.');
      return;
    }
    const updater = (rows: ProfileEntry[]) =>
      entryIndex === null
        ? [...rows, { ...entryDraft, title: entryDraft.title.trim() }]
        : rows.map((row, index) =>
            index === entryIndex ? { ...entryDraft, title: entryDraft.title.trim() } : row,
          );
    if (entryKind === 'experience') setExperienceEntries(updater);
    if (entryKind === 'education') setEducationEntries(updater);
    if (entryKind === 'certificate') setCertificateEntries(updater);
    setEntryKind(null);
    setEntryIndex(null);
    setEntryDraft({ title: '' });
    setError('');
  };

  const removeEntry = (kind: EntryKind, index: number) => {
    if (kind === 'experience') setExperienceEntries(rows => rows.filter((_, i) => i !== index));
    if (kind === 'education') setEducationEntries(rows => rows.filter((_, i) => i !== index));
    if (kind === 'certificate') setCertificateEntries(rows => rows.filter((_, i) => i !== index));
  };

  const sectionSave =
    section === 'identity'
      ? saveIdentity
      : section === 'contact'
        ? saveContact
        : section === 'business'
          ? saveBusiness
          : section === 'professional'
            ? saveProfessional
            : section === 'buyer'
              ? saveBuyer
              : section === 'history'
                ? saveHistory
                : section === 'media'
                  ? saveMedia
                  : null;

  const providerReady = Boolean(providerHeadline || providerSkills || serviceCoverage);
  const professionalReady = Boolean(headline || skills);
  const buyerReady = Boolean(buyerIntent || preferredLocation);
  const historyReady =
    educationEntries.length + experienceEntries.length + certificateEntries.length + linkEntries.length > 0;
  const mediaReady = galleryImages.length + documentUrls.length > 0;
  const identityReady = Boolean(fullName && location && bio);
  const contactReady = phoneVerificationReady || emailVerified;

  if (!open || !detail || !mounted) return null;

  const entryLabels = isId
    ? {
        experience: 'Pengalaman',
        education: 'Pendidikan',
        certificate: 'Sertifikat',
      }
    : {
        experience: 'Experience',
        education: 'Education',
        certificate: 'Certificate',
      };

  const content = (
    <div className="fixed inset-0 z-[1600] flex items-end justify-center bg-slate-950/50 backdrop-blur-[2px] sm:items-center sm:p-4">
      <div className="flex h-[100dvh] w-full min-w-0 flex-col overflow-hidden bg-[color:var(--app-surface-strong)] shadow-2xl sm:h-auto sm:max-h-[90dvh] sm:max-w-2xl sm:rounded-[28px] sm:border sm:border-[color:var(--app-border)]">
        <header className="flex min-h-14 shrink-0 items-center gap-2 border-b border-[color:var(--app-border)] px-2.5 sm:px-4">
          <button
            type="button"
            onClick={() => {
              if (entryKind) {
                setEntryKind(null);
                setEntryIndex(null);
                return;
              }
              if (section !== 'menu') {
                goToSection('menu');
                return;
              }
              onClose();
            }}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-[color:var(--app-text)] transition hover:bg-[color:var(--app-surface-muted)] dark:text-[color:var(--app-text-inverse)]"
            aria-label={section === 'menu' ? (isId ? 'Tutup' : 'Close') : isId ? 'Kembali' : 'Back'}
          >
            {section === 'menu' && !entryKind ? <X className="h-5 w-5" /> : <ArrowLeft className="h-5 w-5" />}
          </button>
          <div className="min-w-0 flex-1 text-center">
            <h2 className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] sm:text-base">
              {entryKind ? `${entryIndex === null ? (isId ? 'Tambah' : 'Add') : isId ? 'Ubah' : 'Edit'} ${entryLabels[entryKind]}` : sectionTitle[section]}
            </h2>
          </div>
          {sectionSave && !entryKind ? (
            <button
              type="button"
              onClick={() => void sectionSave()}
              disabled={saving || uploadingImages || uploadingDocs}
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-3 text-xs font-black text-white transition hover:bg-emerald-700 disabled:opacity-60"
            >
              {saving ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null}
              {isId ? 'Simpan' : 'Save'}
            </button>
          ) : entryKind ? (
            <button
              type="button"
              onClick={saveEntryDraft}
              className="inline-flex min-h-9 shrink-0 items-center justify-center rounded-full bg-emerald-600 px-3 text-xs font-black text-white"
            >
              {isId ? 'Simpan' : 'Save'}
            </button>
          ) : (
            <span className="w-10 shrink-0" />
          )}
        </header>

        {(error || message) && (
          <div
            className={cn(
              'shrink-0 border-b px-4 py-2.5 text-xs font-semibold',
              error
                ? 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-900/60 dark:bg-rose-500/10 dark:text-rose-200'
                : 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/60 dark:bg-emerald-500/10 dark:text-emerald-200',
            )}
          >
            {error || message}
          </div>
        )}

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          {entryKind ? (
            <div className="space-y-4 p-4 sm:p-5">
              <InputLabel label={isId ? 'Judul utama' : 'Main title'}>
                <input
                  className={inputClass}
                  value={entryDraft.title}
                  onChange={event => setEntryDraft(row => ({ ...row, title: event.target.value }))}
                  placeholder={
                    entryKind === 'education'
                      ? isId
                        ? 'Kampus / sekolah / gelar'
                        : 'School / degree'
                      : entryKind === 'experience'
                        ? isId
                          ? 'Posisi / pekerjaan'
                          : 'Role / job'
                        : isId
                          ? 'Nama sertifikat'
                          : 'Certificate name'
                  }
                />
              </InputLabel>
              <InputLabel label={isId ? 'Keterangan' : 'Details'}>
                <input
                  className={inputClass}
                  value={entryDraft.subtitle || ''}
                  onChange={event => setEntryDraft(row => ({ ...row, subtitle: event.target.value }))}
                  placeholder={isId ? 'Perusahaan, jurusan, penerbit, dll.' : 'Company, field, issuer, etc.'}
                />
              </InputLabel>
              <InputLabel label={isId ? 'Tahun / status' : 'Year / status'}>
                <input
                  className={inputClass}
                  value={entryDraft.meta || ''}
                  onChange={event => setEntryDraft(row => ({ ...row, meta: event.target.value }))}
                  placeholder={isId ? 'Contoh: 2024–sekarang' : 'Example: 2024–present'}
                />
              </InputLabel>
              <InputLabel label={isId ? 'Link pendukung' : 'Supporting link'}>
                <input
                  className={inputClass}
                  value={entryDraft.url || ''}
                  onChange={event => setEntryDraft(row => ({ ...row, url: event.target.value }))}
                  placeholder="https://..."
                />
              </InputLabel>
            </div>
          ) : section === 'menu' ? (
            <div>
              <div className="border-b border-[color:var(--app-border)] px-4 py-4 sm:px-5">
                <p className="text-sm leading-5 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Ubah bagian yang perlu saja. Kamu tidak perlu mengisi semuanya.'
                    : 'Edit only what you need. You do not have to fill everything.'}
                </p>
              </div>
              <MenuRow icon={UserRound} title={sectionTitle.identity} description={isId ? 'Nama, username, lokasi, bio, dan visibilitas.' : 'Name, username, location, bio, and visibility.'} complete={identityReady} onClick={() => goToSection('identity')} />
              <MenuRow icon={Phone} title={sectionTitle.contact} description={isId ? 'WhatsApp dan status verifikasi kontak.' : 'WhatsApp and contact verification.'} complete={contactReady} onClick={() => goToSection('contact')} />
              <MenuRow icon={Store} title={sectionTitle.business} description={isId ? 'Usaha, layanan, area, harga, dan cara melayani.' : 'Business, services, area, pricing, and service mode.'} complete={providerReady} onClick={() => goToSection('business')} />
              <MenuRow icon={BriefcaseBusiness} title={sectionTitle.professional} description={isId ? 'Keahlian, bahasa, pengalaman, dan tarif profesional.' : 'Skills, languages, experience, and professional rate.'} complete={professionalReady} onClick={() => goToSection('professional')} />
              <MenuRow icon={Search} title={sectionTitle.buyer} description={isId ? 'Kebutuhan, budget, sektor, dan lokasi yang dicari.' : 'Needs, budget, sector, and preferred location.'} complete={buyerReady} onClick={() => goToSection('buyer')} />
              <MenuRow icon={GraduationCap} title={sectionTitle.history} description={isId ? 'Pengalaman, pendidikan, sertifikat, dan link.' : 'Experience, education, certificates, and links.'} complete={historyReady} onClick={() => goToSection('history')} />
              <MenuRow icon={Images} title={sectionTitle.media} description={isId ? 'Galeri usaha dan dokumen pendukung.' : 'Business gallery and supporting documents.'} complete={mediaReady} onClick={() => goToSection('media')} />
              <MenuRow icon={ShieldCheck} title={sectionTitle.trust} description={isId ? 'Lihat status identitas, email, dan nomor kontak.' : 'Review identity, email, and contact status.'} complete={identityVerified && contactReady} onClick={() => goToSection('trust')} />
            </div>
          ) : section === 'identity' ? (
            <div className="space-y-4 p-4 sm:p-5">
              <InputLabel label={isId ? 'Nama' : 'Name'}>
                <input className={inputClass} value={fullName} onChange={event => setFullName(event.target.value)} placeholder={isId ? 'Nama yang ditampilkan' : 'Display name'} />
              </InputLabel>
              <InputLabel label="Username" hint={isId ? 'Dipakai untuk alamat profil publik.' : 'Used in your public profile URL.'}>
                <div className="relative">
                  <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[color:var(--app-text-soft)]">@</span>
                  <input className={`${inputClass} pl-8`} value={username} onChange={event => setUsername(event.target.value)} placeholder="username" />
                </div>
              </InputLabel>
              <InputLabel label={isId ? 'Lokasi' : 'Location'}>
                <div className="relative">
                  <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
                  <input className={`${inputClass} pl-9`} value={location} onChange={event => setLocation(event.target.value)} placeholder={isId ? 'Contoh: Bandung' : 'Example: Bandung'} />
                </div>
              </InputLabel>
              <InputLabel label="Bio" hint={isId ? 'Singkat saja: siapa kamu dan apa yang kamu tawarkan.' : 'Keep it short: who you are and what you offer.'}>
                <textarea className={textareaClass} value={bio} onChange={event => setBio(event.target.value)} maxLength={500} placeholder={isId ? 'Ceritakan singkat tentang usaha atau keahlianmu.' : 'Tell people briefly about your business or expertise.'} />
                <span className="mt-1 block text-right text-[10px] text-[color:var(--app-text-soft)]">{bio.length}/500</span>
              </InputLabel>
              <InputLabel label={isId ? 'Peran di Lajukan' : 'Roles on Lajukan'} hint={isId ? 'Pisahkan dengan koma. Opsional.' : 'Separate with commas. Optional.'}>
                <input className={inputClass} value={roles} onChange={event => setRoles(event.target.value)} placeholder={isId ? 'Supplier, Freelancer, Pembeli' : 'Supplier, Freelancer, Buyer'} />
              </InputLabel>
              <button type="button" onClick={() => setDiscoverable(value => !value)} className="flex min-h-14 w-full items-center gap-3 rounded-xl border border-[color:var(--app-border)] px-3 text-left">
                <Globe2 className="h-5 w-5 shrink-0 text-emerald-600" />
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{isId ? 'Tampil di pencarian' : 'Show in search'}</span>
                  <span className="mt-0.5 block text-[11px] text-[color:var(--app-text-soft)]">{isId ? 'Orang dapat menemukan profilmu dari Lajukan.' : 'People can discover your profile on Lajukan.'}</span>
                </span>
                <span className={cn('relative h-6 w-11 shrink-0 rounded-full transition', discoverable ? 'bg-emerald-600' : 'bg-slate-300 dark:bg-slate-700')}>
                  <span className={cn('absolute top-1 h-4 w-4 rounded-full bg-white shadow transition', discoverable ? 'left-6' : 'left-1')} />
                </span>
              </button>
            </div>
          ) : section === 'contact' ? (
            <div className="space-y-4 p-4 sm:p-5">
              <div className="rounded-2xl border border-[color:var(--app-border)] p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">WhatsApp</p>
                    <p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)]">{phoneVerificationReady ? (isId ? 'Nomor sudah terverifikasi.' : 'Number is verified.') : isId ? 'Verifikasi nomor agar lebih dipercaya.' : 'Verify your number to build trust.'}</p>
                  </div>
                  <span className={cn('rounded-full px-2.5 py-1 text-[10px] font-black', phoneVerificationReady ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300')}>
                    {phoneVerificationReady ? (isId ? 'Terverifikasi' : 'Verified') : isId ? 'Belum' : 'Not verified'}
                  </span>
                </div>
                <div className="mt-4 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                  <input className={inputClass} inputMode="tel" value={phone} onChange={event => { setPhone(event.target.value); setPhoneVerified(normalizePhoneDigits(event.target.value) === verifiedPhoneDigits && phoneVerified); }} placeholder="08xxxxxxxxxx" />
                  {!phoneVerificationReady ? (
                    <button type="button" onClick={() => void sendPhoneOtp()} disabled={sendingOtp} className="inline-flex min-h-11 items-center justify-center rounded-xl border border-emerald-600 px-4 text-sm font-black text-emerald-700 disabled:opacity-60 dark:text-emerald-300">
                      {sendingOtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{isId ? 'Kirim OTP' : 'Send OTP'}
                    </button>
                  ) : null}
                </div>
                {!phoneVerificationReady ? (
                  <div className="mt-2 grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto]">
                    <input className={inputClass} inputMode="numeric" maxLength={6} value={phoneOtp} onChange={event => setPhoneOtp(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder={isId ? 'OTP 6 digit' : '6-digit OTP'} />
                    <button type="button" onClick={() => void verifyPhoneOtp()} disabled={verifyingOtp} className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-black text-white disabled:opacity-60">
                      {verifyingOtp ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{isId ? 'Verifikasi' : 'Verify'}
                    </button>
                  </div>
                ) : null}
                {phoneOtpMessage ? <p className="mt-2 text-xs font-semibold text-emerald-700 dark:text-emerald-300">{phoneOtpMessage}</p> : null}
              </div>
              <div className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-border)] p-4">
                <BadgeCheck className={cn('h-5 w-5', emailVerified ? 'text-emerald-600' : 'text-[color:var(--app-text-soft)]')} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{detail.email || 'Email'}</p>
                  <p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)]">{emailVerified ? (isId ? 'Email terverifikasi.' : 'Email verified.') : isId ? 'Email belum terverifikasi.' : 'Email not verified.'}</p>
                </div>
              </div>
            </div>
          ) : section === 'business' ? (
            <div className="space-y-4 p-4 sm:p-5">
              <InputLabel label={isId ? 'Nama usaha atau layanan' : 'Business or service name'}><input className={inputClass} value={providerHeadline} onChange={event => setProviderHeadline(event.target.value)} placeholder={isId ? 'Contoh: Sinar Packaging' : 'Example: Sinar Packaging'} /></InputLabel>
              <InputLabel label={isId ? 'Produk / jenis layanan' : 'Products / service types'} hint={isId ? 'Pisahkan dengan koma.' : 'Separate with commas.'}><input className={inputClass} value={providerSkills} onChange={event => setProviderSkills(event.target.value)} placeholder={isId ? 'Standing pouch, paper cup, custom print' : 'Standing pouch, paper cup, custom print'} /></InputLabel>
              <InputLabel label={isId ? 'Area layanan' : 'Service area'} hint={isId ? 'Kota atau wilayah yang kamu layani.' : 'Cities or regions you serve.'}><input className={inputClass} value={serviceCoverage} onChange={event => setServiceCoverage(event.target.value)} placeholder="Bandung, Cimahi, Jakarta" /></InputLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputLabel label={isId ? 'Cara melayani' : 'Work mode'}><input className={inputClass} value={workMode} onChange={event => setWorkMode(event.target.value)} placeholder={isId ? 'Online, datang ke lokasi' : 'Online, on-site'} /></InputLabel>
                <InputLabel label={isId ? 'Estimasi balasan' : 'Response time'}><input className={inputClass} value={responseTime} onChange={event => setResponseTime(event.target.value)} placeholder={isId ? 'Contoh: < 2 jam' : 'Example: < 2 hours'} /></InputLabel>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputLabel label={isId ? 'Harga mulai' : 'Starting price'}><input className={inputClass} inputMode="numeric" value={priceMin} onChange={event => setPriceMin(event.target.value.replace(/\D/g, ''))} placeholder="0" /></InputLabel>
                <InputLabel label={isId ? 'Harga sampai' : 'Maximum price'}><input className={inputClass} inputMode="numeric" value={priceMax} onChange={event => setPriceMax(event.target.value.replace(/\D/g, ''))} placeholder="0" /></InputLabel>
              </div>
            </div>
          ) : section === 'professional' ? (
            <div className="space-y-4 p-4 sm:p-5">
              <InputLabel label={isId ? 'Judul keahlian' : 'Professional title'}><input className={inputClass} value={headline} onChange={event => setHeadline(event.target.value)} placeholder={isId ? 'Fullstack Developer' : 'Fullstack Developer'} /></InputLabel>
              <InputLabel label={isId ? 'Keahlian utama' : 'Main skills'} hint={isId ? 'Pisahkan dengan koma.' : 'Separate with commas.'}><input className={inputClass} value={skills} onChange={event => setSkills(event.target.value)} placeholder="Java, Spring Boot, Next.js" /></InputLabel>
              <InputLabel label={isId ? 'Bahasa' : 'Languages'}><input className={inputClass} value={languages} onChange={event => setLanguages(event.target.value)} placeholder={isId ? 'Indonesia, Inggris' : 'Indonesian, English'} /></InputLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputLabel label={isId ? 'Pengalaman (tahun)' : 'Experience (years)'}><input className={inputClass} inputMode="numeric" value={experienceYears} onChange={event => setExperienceYears(event.target.value.replace(/\D/g, ''))} placeholder="2" /></InputLabel>
                <InputLabel label={isId ? 'Tarif per jam' : 'Hourly rate'}><input className={inputClass} inputMode="numeric" value={hourlyRate} onChange={event => setHourlyRate(event.target.value.replace(/\D/g, ''))} placeholder="0" /></InputLabel>
              </div>
              <InputLabel label={isId ? 'Link portofolio' : 'Portfolio links'} hint={isId ? 'Bisa lebih dari satu, pisahkan dengan koma.' : 'You can add multiple links separated by commas.'}><textarea className={textareaClass} value={portfolioUrls} onChange={event => setPortfolioUrls(event.target.value)} placeholder="https://..." /></InputLabel>
            </div>
          ) : section === 'buyer' ? (
            <div className="space-y-4 p-4 sm:p-5">
              <InputLabel label={isId ? 'Apa yang sedang dicari?' : 'What are you looking for?'}><textarea className={textareaClass} value={buyerIntent} onChange={event => setBuyerIntent(event.target.value)} placeholder={isId ? 'Contoh: supplier standing pouch 500 pcs' : 'Example: standing pouch supplier, 500 pcs'} /></InputLabel>
              <InputLabel label={isId ? 'Lokasi yang diutamakan' : 'Preferred location'}><input className={inputClass} value={preferredLocation} onChange={event => setPreferredLocation(event.target.value)} placeholder="Bandung" /></InputLabel>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputLabel label={isId ? 'Sektor' : 'Sector'}><input className={inputClass} value={preferredSector} onChange={event => setPreferredSector(event.target.value)} placeholder={isId ? 'Makanan & minuman' : 'Food & beverage'} /></InputLabel>
                <InputLabel label={isId ? 'Jenis spesifik' : 'Specific type'}><input className={inputClass} value={preferredSubSector} onChange={event => setPreferredSubSector(event.target.value)} placeholder={isId ? 'Kemasan' : 'Packaging'} /></InputLabel>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <InputLabel label={isId ? 'Budget minimum' : 'Minimum budget'}><input className={inputClass} inputMode="numeric" value={buyerBudgetMin} onChange={event => setBuyerBudgetMin(event.target.value.replace(/\D/g, ''))} placeholder="0" /></InputLabel>
                <InputLabel label={isId ? 'Budget maksimum' : 'Maximum budget'}><input className={inputClass} inputMode="numeric" value={buyerBudgetMax} onChange={event => setBuyerBudgetMax(event.target.value.replace(/\D/g, ''))} placeholder="0" /></InputLabel>
              </div>
            </div>
          ) : section === 'history' ? (
            <div className="space-y-5 p-4 sm:p-5">
              {([
                ['experience', experienceEntries],
                ['education', educationEntries],
                ['certificate', certificateEntries],
              ] as Array<[EntryKind, ProfileEntry[]]>).map(([kind, rows]) => (
                <section key={kind}>
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{entryLabels[kind]}</h3>
                    <button type="button" onClick={() => openEntry(kind, null)} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[color:var(--app-border)] px-3 text-xs font-black text-emerald-700 dark:text-emerald-300"><Plus className="h-3.5 w-3.5" />{isId ? 'Tambah' : 'Add'}</button>
                  </div>
                  <div className="mt-2 overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
                    {rows.length ? rows.map((item, index) => (
                      <div key={`${kind}-${index}`} className="flex items-center gap-3 border-b border-[color:var(--app-border)] p-3 last:border-b-0">
                        <button type="button" onClick={() => openEntry(kind, index)} className="min-w-0 flex-1 text-left">
                          <p className="truncate text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{item.title}</p>
                          <p className="mt-0.5 truncate text-[11px] text-[color:var(--app-text-soft)]">{item.subtitle || item.meta || (isId ? 'Ketuk untuk mengubah' : 'Tap to edit')}</p>
                        </button>
                        <button type="button" onClick={() => removeEntry(kind, index)} className="grid h-9 w-9 place-items-center rounded-full text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10" aria-label={isId ? 'Hapus' : 'Delete'}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )) : <p className="px-3 py-4 text-xs text-[color:var(--app-text-soft)]">{isId ? 'Belum ada.' : 'Nothing added yet.'}</p>}
                  </div>
                </section>
              ))}
              <section>
                <div className="flex items-center justify-between gap-3">
                  <h3 className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">Link</h3>
                  <button type="button" onClick={() => setLinkEntries(rows => [...rows, { label: '', url: '' }])} className="inline-flex min-h-9 items-center gap-1 rounded-full border border-[color:var(--app-border)] px-3 text-xs font-black text-emerald-700 dark:text-emerald-300"><Plus className="h-3.5 w-3.5" />{isId ? 'Tambah' : 'Add'}</button>
                </div>
                <div className="mt-2 space-y-2">
                  {linkEntries.map((item, index) => (
                    <div key={`link-${index}`} className="grid grid-cols-[minmax(0,0.75fr)_minmax(0,1.25fr)_40px] gap-2">
                      <input className={inputClass} value={item.label} onChange={event => setLinkEntries(rows => rows.map((row, i) => i === index ? { ...row, label: event.target.value } : row))} placeholder={isId ? 'Nama' : 'Label'} />
                      <input className={inputClass} value={item.url} onChange={event => setLinkEntries(rows => rows.map((row, i) => i === index ? { ...row, url: event.target.value } : row))} placeholder="https://..." />
                      <button type="button" onClick={() => setLinkEntries(rows => rows.filter((_, i) => i !== index))} className="grid h-11 w-10 place-items-center rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          ) : section === 'media' ? (
            <div className="space-y-5 p-4 sm:p-5">
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{isId ? 'Galeri' : 'Gallery'}</h3><p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)]">{isId ? 'Foto usaha, proses kerja, atau hasil pekerjaan.' : 'Business, process, or work photos.'}</p></div>
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-[color:var(--app-border)] px-3 text-xs font-black text-emerald-700 dark:text-emerald-300"><Plus className="h-3.5 w-3.5" />{uploadingImages ? (isId ? 'Mengunggah...' : 'Uploading...') : isId ? 'Tambah' : 'Add'}<input type="file" accept="image/*" multiple className="hidden" disabled={uploadingImages} onChange={uploadGallery} /></label>
                </div>
                {galleryImages.length ? <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-4">{galleryImages.map(url => <div key={url} className="relative aspect-square overflow-hidden rounded-xl bg-[color:var(--app-surface-muted)]"><img src={url} alt="" className="h-full w-full object-cover" /><button type="button" onClick={() => setGalleryImages(rows => rows.filter(item => item !== url))} className="absolute right-1.5 top-1.5 grid h-7 w-7 place-items-center rounded-full bg-black/60 text-white"><X className="h-3.5 w-3.5" /></button></div>)}</div> : <div className="mt-3 rounded-2xl border border-dashed border-[color:var(--app-border)] px-4 py-6 text-center text-xs text-[color:var(--app-text-soft)]">{isId ? 'Belum ada foto galeri.' : 'No gallery photos yet.'}</div>}
              </section>
              <section>
                <div className="flex items-center justify-between gap-3">
                  <div><h3 className="text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{isId ? 'Dokumen pendukung' : 'Supporting documents'}</h3><p className="mt-0.5 text-[11px] text-[color:var(--app-text-soft)]">{isId ? 'Company profile, katalog, atau bukti relevan.' : 'Company profile, catalog, or relevant proof.'}</p></div>
                  <label className="inline-flex min-h-9 cursor-pointer items-center gap-1 rounded-full border border-[color:var(--app-border)] px-3 text-xs font-black text-emerald-700 dark:text-emerald-300"><Plus className="h-3.5 w-3.5" />{uploadingDocs ? (isId ? 'Mengunggah...' : 'Uploading...') : isId ? 'Tambah' : 'Add'}<input type="file" multiple className="hidden" disabled={uploadingDocs} onChange={uploadDocuments} /></label>
                </div>
                <div className="mt-3 overflow-hidden rounded-2xl border border-[color:var(--app-border)]">
                  {documentUrls.length ? documentUrls.map(url => <div key={url} className="flex items-center gap-3 border-b border-[color:var(--app-border)] p-3 last:border-b-0"><FileText className="h-5 w-5 shrink-0 text-[color:var(--app-text-soft)]" /><span className="min-w-0 flex-1 truncate text-xs font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{decodeURIComponent(url.split('/').pop() || (isId ? 'Dokumen' : 'Document'))}</span><button type="button" onClick={() => setDocumentUrls(rows => rows.filter(item => item !== url))} className="grid h-9 w-9 place-items-center rounded-full text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-500/10"><Trash2 className="h-4 w-4" /></button></div>) : <p className="px-4 py-5 text-center text-xs text-[color:var(--app-text-soft)]">{isId ? 'Belum ada dokumen.' : 'No documents yet.'}</p>}
                </div>
              </section>
            </div>
          ) : (
            <div className="space-y-3 p-4 sm:p-5">
              {[
                { label: isId ? 'Identitas' : 'Identity', active: identityVerified, icon: ShieldCheck, detail: identityVerified ? (isId ? 'Identitas sudah terverifikasi.' : 'Identity is verified.') : (isId ? 'Belum ada status verifikasi identitas aktif.' : 'No active identity verification status.') },
                { label: 'WhatsApp', active: phoneVerificationReady, icon: Phone, detail: phoneVerificationReady ? (isId ? 'Nomor terverifikasi.' : 'Number verified.') : (isId ? 'Nomor belum terverifikasi.' : 'Number not verified.') },
                { label: 'Email', active: emailVerified, icon: BadgeCheck, detail: emailVerified ? (isId ? 'Email terverifikasi.' : 'Email verified.') : (isId ? 'Email belum terverifikasi.' : 'Email not verified.') },
              ].map(item => {
                const Icon = item.icon;
                return <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-border)] p-4"><span className={cn('grid h-10 w-10 shrink-0 place-items-center rounded-xl', item.active ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300' : 'bg-[color:var(--app-surface-muted)] text-[color:var(--app-text-soft)]')}><Icon className="h-5 w-5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">{item.label}</span><span className="mt-0.5 block text-[11px] text-[color:var(--app-text-soft)]">{item.detail}</span></span><StatusDot active={item.active} /></div>;
              })}
              {!phoneVerificationReady ? <button type="button" onClick={() => goToSection('contact')} className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-emerald-600 px-4 text-sm font-black text-white">{isId ? 'Verifikasi kontak' : 'Verify contact'}</button> : null}
              {!identityVerified ? <p className="rounded-xl bg-[color:var(--app-surface-muted)] px-3 py-3 text-[11px] leading-5 text-[color:var(--app-text-soft)]">{isId ? 'Status identitas hanya akan tampil sebagai terverifikasi jika backend/KYC Lajukan memang sudah menyetujuinya. Modal ini tidak membuat badge verifikasi secara manual.' : 'Identity shows as verified only when Lajukan backend/KYC has actually approved it. This modal cannot grant verification manually.'}</p> : null}
            </div>
          )}
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
}
