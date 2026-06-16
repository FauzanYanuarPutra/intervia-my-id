'use client';

import { ChangeEvent, useEffect, useMemo, useState } from 'react';
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
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { resolveLocaleFromPathname } from '@/lib/locale';
import { ArrowLeft, Globe2, Loader2, Save, Upload } from 'lucide-react';

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

  const profileScore = useMemo(() => {
    const checks = [
      fullName.trim(),
      location.trim(),
      bio.trim(),
      avatarUrl.trim(),
      headline.trim(),
      skills.trim(),
      providerHeadline.trim(),
      buyerIntent.trim(),
      galleryImages.length > 0 ? '1' : '',
      educationEntries.length > 0 ? '1' : '',
      certificateEntries.length > 0 ? '1' : '',
      experienceEntries.length > 0 ? '1' : '',
    ];
    const complete = checks.filter(Boolean).length;
    return Math.round((complete / checks.length) * 100);
  }, [
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
  ]);

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
        title: 'Dasar',
        description: 'Nama, kontak, bio, dan identitas utama.',
        targetId: 'profile-edit-identity',
      },
      {
        key: 'work' as const,
        title: 'Kerja & usaha',
        description: 'Skill, layanan, buyer intent, dan info usaha.',
        targetId: 'profile-edit-talent',
      },
      {
        key: 'media' as const,
        title: 'Media',
        description: 'Avatar, cover, gallery, dan dokumen.',
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

  const inputClass = 'ui-control ui-data-control w-full px-3 text-sm';
  const textareaClass =
    'ui-control ui-data-control ui-data-textarea w-full px-3 py-2 text-sm';

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
    `ui-panel p-4 transition ${
      isFocusVisible(focus)
        ? 'border-[color:var(--app-accent-border)] shadow-[0_20px_45px_-32px_rgba(16,185,129,0.55)]'
        : 'hidden'
    }`;

  const sendPhoneOtp = async () => {
    if (phoneDigits.length < 8) {
      setPhoneOtpError('Masukkan nomor telepon yang valid dulu.');
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
        'OTP telepon sudah dikirim. Masukkan 6 digit kode untuk verifikasi.',
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
      setPhoneOtpError('Nomor telepon belum valid.');
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
        throw new Error(verifyData.error || 'OTP telepon tidak valid');
      }
      if (!verifyData.token) {
        throw new Error('Token verifikasi telepon tidak ditemukan');
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
          confirmData.error || 'Gagal menyimpan verifikasi telepon',
        );
      }

      setPhone(phoneDigits);
      setVerifiedPhoneDigits(phoneDigits);
      setPhoneVerified(true);
      setPhoneOtp('');
      setPhoneOtpMessage('Nomor telepon berhasil diverifikasi.');
      await refreshUser();
    } catch (err) {
      setPhoneOtpError(
        err instanceof Error ? err.message : 'Verifikasi telepon gagal',
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
      const formData = new FormData();
      Array.from(files).forEach(file => formData.append('images', file));
      const res = await authFetch('/api/content/upload-images', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        urls?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Upload image gagal');
      const next = Array.from(
        new Set([...(galleryImages || []), ...extractUploadedImageUrls(data)]),
      );
      setGalleryImages(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload image gagal');
    } finally {
      setUploadingImages(false);
      event.target.value = '';
    }
  };

  const uploadCoverFile = async (file: File) => {
    setUploadingCover(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('images', file);
      const res = await authFetch('/api/content/upload-images', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        urls?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Upload cover gagal');
      const url = extractFirstUploadedImageUrl(data) || '';
      if (!url) throw new Error('Cover URL tidak ditemukan');
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
      setError(err instanceof Error ? err.message : 'Upload cover gagal');
    } finally {
      setUploadingCover(false);
    }
  };

  const uploadAvatarFile = async (file: File) => {
    setUploadingAvatar(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('images', file);
      const res = await authFetch('/api/content/upload-images', {
        method: 'POST',
        body: formData,
      });
      const data = (await res.json().catch(() => ({}))) as {
        urls?: string[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error || 'Upload foto profil gagal');
      const url = extractFirstUploadedImageUrl(data) || '';
      if (!url) throw new Error('Avatar URL tidak ditemukan');
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
      setError(err instanceof Error ? err.message : 'Upload foto profil gagal');
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
      if (!res.ok) throw new Error(data.error || 'Upload dokumen gagal');
      const next = Array.from(
        new Set([
          ...(documentUrls || []),
          ...extractUploadedDocumentUrls(data),
        ]),
      );
      setDocumentUrls(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upload dokumen gagal');
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
      if (!res.ok) throw new Error(data.error || 'Gagal memperbarui profile');
      setMessage(successMessage);
      await refreshUser();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Gagal memperbarui profile',
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
        ? 'Education berhasil ditambahkan.'
        : 'Education berhasil diperbarui.',
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
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan profile');
      setMessage('Profile advanced berhasil disimpan.');
      setBaseMetadata(metadataPayload);
      await refreshUser();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal menyimpan profile');
    } finally {
      setSaving(false);
    }
  };

  if (authLoading || loading) {
    return <ProfileEditSkeleton />;
  }

  if (!user) {
    return (
      <div className="mx-auto w-full max-w-2xl px-0 py-10 sm:px-4">
        <p className="ui-panel-muted rounded-none border-x-0 border-[color:var(--app-warning-border)] bg-[color:var(--app-warning-soft)] p-4 text-sm ui-warning-text sm:rounded-[var(--app-radius)] sm:border-x">
          Login diperlukan untuk edit profile.
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden ui-surface-muted pb-12 pt-4 dark:bg-[color:var(--app-surface-strong)] sm:pt-6">
      <div className="page-shell max-w-4xl overflow-x-hidden">
        <section className="ui-panel mb-4 p-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="max-w-2xl">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em] ui-accent-text">
                Profil
              </p>
              <h1 className="mt-1 text-2xl font-bold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                Rapikan profil
              </h1>
              <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                Fokus ke satu area dulu. Sisanya bisa nyusul.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              <LocalizedLink
                href="/profile"
                className="ui-button-secondary inline-flex w-full items-center gap-2 px-3 text-sm font-semibold sm:w-auto"
              >
                <ArrowLeft className="h-4 w-4" />
                Kembali
              </LocalizedLink>
              <LocalizedLink
                href={publicProfilePath}
                className="ui-button-secondary inline-flex w-full items-center gap-2 px-3 text-sm font-semibold sm:w-auto"
              >
                <Globe2 className="h-4 w-4" />
                Profil publik
              </LocalizedLink>
              <button
                type="button"
                onClick={handleSave}
                disabled={
                  saving ||
                  uploadingImages ||
                  uploadingDocs ||
                  uploadingCover ||
                  uploadingAvatar
                }
                className="ui-button-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-60 sm:w-auto"
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

          <div className="mt-4 flex flex-wrap gap-2">
            <span className="rounded-full border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-1.5 text-sm font-semibold ui-accent-text">
              Progress {profileScore}%
            </span>
            <span className="rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-1.5 text-sm font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              Fokus {activeFocusSection.title}
            </span>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {focusSections.map(section => (
              <button
                key={section.key}
                type="button"
                onClick={() => setFocusSection(section.key)}
                className={`inline-flex shrink-0 items-center rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  activeFocus === section.key
                    ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                    : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-muted)]'
                }`}
              >
                {section.title}
              </button>
            ))}
          </div>

          <p className="mt-3 text-sm text-[color:var(--app-text-soft)]">
            {activeFocusSection.description}
          </p>
        </section>

        <div className="grid gap-4">
          <section
            id="profile-edit-identity"
            className={sectionCardClass('identity')}
          >
            <h2 className="mb-3 text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Informasi Dasar
            </h2>
            <p className="mb-3 text-sm text-[color:var(--app-text-soft)]">
              Dipakai untuk identitas utama akun, tampilan public profile, dan
              hasil discover/search.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                placeholder="Nama lengkap"
                value={fullName}
                onChange={e => setFullName(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="URL profil publik"
                value={username}
                onChange={e =>
                  setUsername(normalizePublicProfileHandleInput(e.target.value))
                }
              />
              <input
                className={inputClass}
                placeholder="Nomor telepon / WhatsApp"
                value={phone}
                onChange={e => setPhone(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Kota / area"
                value={location}
                onChange={e => setLocation(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Peran, contoh: buyer, seller"
                value={roles}
                onChange={e => setRoles(e.target.value)}
              />
            </div>
            <div className="mt-3 rounded-2xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] p-3 dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_16%,transparent)]">
              <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                URL profil publik
              </p>
              <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                Pakai huruf kecil, angka, dan tanda minus.
              </p>
              <div className="mt-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm font-semibold text-[color:var(--app-text)] break-all dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]">
                {publicProfileDisplayUrl}
              </div>
            </div>
            <div className="mt-3 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    Verifikasi nomor telepon
                  </p>
                  <p className="text-xs text-[color:var(--app-text-soft)]">
                    Dipakai untuk membuka transaksi dan memperjelas identitas
                    akun.
                  </p>
                </div>
                <span
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
                    phoneVerificationReady
                      ? 'bg-[color:var(--app-success-soft)] text-[color:var(--app-success)]'
                      : phoneNeedsVerification
                        ? 'bg-[color:var(--app-warning-soft)] ui-warning-text'
                        : 'bg-[color:var(--app-surface-strong)] text-[color:var(--app-text-soft)] dark:bg-[color:var(--app-surface-muted)]'
                  }`}
                >
                  {phoneVerificationReady
                    ? 'Terverifikasi'
                    : phoneNeedsVerification
                      ? 'Perlu OTP'
                      : 'Isi nomor dulu'}
                </span>
              </div>

              {phoneNeedsVerification ? (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-col gap-2 sm:flex-row">
                    <input
                      className={inputClass}
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="OTP 6 digit"
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
                      className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {sendingPhoneOtp ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Mengirim OTP
                        </>
                      ) : (
                        'Kirim OTP'
                      )}
                    </button>
                    <button
                      type="button"
                      onClick={verifyPhoneOtp}
                      disabled={confirmingPhoneOtp}
                      className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {confirmingPhoneOtp ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Memverifikasi
                        </>
                      ) : (
                        'Verifikasi nomor'
                      )}
                    </button>
                  </div>
                  {phoneOtpMessage ? (
                    <p className="text-xs text-[color:var(--app-accent)]">
                      {phoneOtpMessage}
                    </p>
                  ) : null}
                  {phoneOtpError ? (
                    <p className="text-xs ui-warning-text">{phoneOtpError}</p>
                  ) : null}
                </div>
              ) : phoneVerificationReady ? (
                <p className="mt-3 text-xs text-[color:var(--app-success)]">
                  Nomor ini sudah siap dipakai untuk transaksi.
                </p>
              ) : (
                <p className="mt-3 text-xs text-[color:var(--app-text-soft)]">
                  Tambahkan nomor aktif dulu, lalu kirim OTP dari sini.
                </p>
              )}
            </div>
            <textarea
              className={`${textareaClass} mt-3 min-h-[96px]`}
              placeholder="Bio ringkas"
              value={bio}
              onChange={e => setBio(e.target.value)}
            />
          </section>

          <section
            id="profile-edit-talent"
            className={sectionCardClass('talent')}
          >
            <h2 className="mb-3 text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Talent / Freelancer
            </h2>
            <p className="mb-3 text-sm text-[color:var(--app-text-soft)]">
              Bagian ini memengaruhi jobs, talent discovery, dan cara buyer
              menilai skill profesional Anda.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                placeholder="Headline / Professional title"
                value={headline}
                onChange={e => setHeadline(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Hourly rate (IDR)"
                value={hourlyRate}
                onChange={e => setHourlyRate(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Skills (comma separated)"
                value={skills}
                onChange={e => setSkills(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Languages"
                value={languages}
                onChange={e => setLanguages(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Experience years"
                value={experienceYears}
                onChange={e => setExperienceYears(e.target.value)}
              />
            </div>
            <textarea
              className={`${textareaClass} mt-3 min-h-[80px]`}
              placeholder="Portfolio URLs (comma/new line separated)"
              value={portfolioUrls}
              onChange={e => setPortfolioUrls(e.target.value)}
            />
          </section>

          <section className={sectionCardClass('talent')}>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  Education
                </h2>
                <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                  Tampilkan sekolah, gelar, atau jurusan penting tanpa memenuhi
                  halaman dengan form panjang.
                </p>
              </div>
              <button
                type="button"
                onClick={addEducation}
                className="ui-button-secondary ui-button-compact inline-flex w-full items-center gap-2 text-xs font-semibold sm:w-auto"
              >
                <Upload className="h-4 w-4" />
                Tambah
              </button>
            </div>
            {educationEntries.length === 0 ? (
              <p className="text-sm text-[color:var(--app-text-soft)]">
                Belum ada data pendidikan.
              </p>
            ) : (
              <div className="space-y-3">
                {educationEntries.map((entry, idx) => (
                  <div
                    key={`${entry.title}-${idx}`}
                    className="rounded-xl border border-[color:var(--app-border)] p-3"
                  >
                    <div className="space-y-1">
                      <p className="text-sm font-semibold text-[color:var(--app-text)]">
                        {entry.title}
                      </p>
                      {entry.subtitle ? (
                        <p className="text-sm text-[color:var(--app-text-soft)]">
                          {entry.subtitle}
                        </p>
                      ) : null}
                      {entry.meta ? (
                        <p className="text-xs text-[color:var(--app-text-soft)]">
                          {entry.meta}
                        </p>
                      ) : null}
                      {entry.url ? (
                        <p className="break-all text-xs text-[color:var(--app-text-soft)]">
                          {entry.url}
                        </p>
                      ) : null}
                    </div>
                    <div className="mt-3 flex justify-end gap-3">
                      <button
                        type="button"
                        onClick={() => editEducation(idx)}
                        className="text-xs font-semibold text-[color:var(--app-accent)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => removeEducation(idx)}
                        className="ui-danger-text text-xs font-semibold"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={sectionCardClass('talent')}>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  Certificates
                </h2>
                <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                  Cocok untuk sertifikasi, lisensi, atau pelatihan yang bikin
                  profile lebih kredibel.
                </p>
              </div>
              <button
                type="button"
                onClick={addCertificate}
                className="ui-button-secondary ui-button-compact inline-flex w-full items-center gap-2 text-xs font-semibold sm:w-auto"
              >
                <Upload className="h-4 w-4" />
                Tambah
              </button>
            </div>
            {certificateEntries.length === 0 ? (
              <p className="text-sm text-[color:var(--app-text-soft)]">
                Belum ada data sertifikat.
              </p>
            ) : (
              <div className="space-y-3">
                {certificateEntries.map((entry, idx) => (
                  <div
                    key={`${entry.title}-${idx}`}
                    className="rounded-xl border border-[color:var(--app-border)] p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        className={inputClass}
                        placeholder="Nama sertifikat"
                        value={entry.title}
                        onChange={e =>
                          updateCertificate(idx, 'title', e.target.value)
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Institusi / issuer"
                        value={entry.subtitle || ''}
                        onChange={e =>
                          updateCertificate(idx, 'subtitle', e.target.value)
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Tahun / level"
                        value={entry.meta || ''}
                        onChange={e =>
                          updateCertificate(idx, 'meta', e.target.value)
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Link sertifikat (optional)"
                        value={entry.url || ''}
                        onChange={e =>
                          updateCertificate(idx, 'url', e.target.value)
                        }
                      />
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeCertificate(idx)}
                        className="ui-danger-text text-xs font-semibold"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={sectionCardClass('talent')}>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  Experience
                </h2>
                <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                  Isi pengalaman atau proyek penting.
                </p>
              </div>
              <button
                type="button"
                onClick={addExperience}
                className="ui-button-secondary ui-button-compact inline-flex w-full items-center gap-2 text-xs font-semibold sm:w-auto"
              >
                <Upload className="h-4 w-4" />
                Tambah
              </button>
            </div>
            {experienceEntries.length === 0 ? (
              <p className="text-sm text-[color:var(--app-text-soft)]">
                Belum ada pengalaman kerja.
              </p>
            ) : (
              <div className="space-y-3">
                {experienceEntries.map((entry, idx) => (
                  <div
                    key={`${entry.title}-${idx}`}
                    className="rounded-xl border border-[color:var(--app-border)] p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        className={inputClass}
                        placeholder="Posisi / role"
                        value={entry.title}
                        onChange={e =>
                          updateExperience(idx, 'title', e.target.value)
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Perusahaan / tim"
                        value={entry.subtitle || ''}
                        onChange={e =>
                          updateExperience(idx, 'subtitle', e.target.value)
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Durasi / periode"
                        value={entry.meta || ''}
                        onChange={e =>
                          updateExperience(idx, 'meta', e.target.value)
                        }
                      />
                      <input
                        className={inputClass}
                        placeholder="Link portfolio (optional)"
                        value={entry.url || ''}
                        onChange={e =>
                          updateExperience(idx, 'url', e.target.value)
                        }
                      />
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeExperience(idx)}
                        className="ui-danger-text text-xs font-semibold"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className={sectionCardClass('talent')}>
            <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                  Links & Portfolio
                </h2>
                <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                  Tambah LinkedIn, website, GitHub, atau portfolio.
                </p>
              </div>
              <button
                type="button"
                onClick={addLink}
                className="ui-button-secondary ui-button-compact inline-flex w-full items-center gap-2 text-xs font-semibold sm:w-auto"
              >
                <Upload className="h-4 w-4" />
                Tambah
              </button>
            </div>
            {linkEntries.length === 0 ? (
              <p className="text-sm text-[color:var(--app-text-soft)]">
                Belum ada link profesional.
              </p>
            ) : (
              <div className="space-y-3">
                {linkEntries.map((entry, idx) => (
                  <div
                    key={`${entry.label}-${idx}`}
                    className="rounded-xl border border-[color:var(--app-border)] p-3"
                  >
                    <div className="grid gap-3 sm:grid-cols-2">
                      <input
                        className={inputClass}
                        placeholder="Label (LinkedIn, Portfolio, Website)"
                        value={entry.label}
                        onChange={e => updateLink(idx, 'label', e.target.value)}
                      />
                      <input
                        className={inputClass}
                        placeholder="URL"
                        value={entry.url}
                        onChange={e => updateLink(idx, 'url', e.target.value)}
                      />
                    </div>
                    <div className="mt-2 flex justify-end">
                      <button
                        type="button"
                        onClick={() => removeLink(idx)}
                        className="ui-danger-text text-xs font-semibold"
                      >
                        Hapus
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section
            id="profile-edit-seller"
            className={sectionCardClass('seller')}
          >
            <h2 className="mb-3 text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Provider / Seller
            </h2>
            <p className="mb-3 text-sm text-[color:var(--app-text-soft)]">
              Dipakai saat Anda tampil sebagai seller/provider, termasuk
              coverage, pricing, dan response expectation.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                placeholder="Provider headline"
                value={providerHeadline}
                onChange={e => setProviderHeadline(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Work mode (onsite/remote/hybrid)"
                value={workMode}
                onChange={e => setWorkMode(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Provider skills"
                value={providerSkills}
                onChange={e => setProviderSkills(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Response time (ex: < 2 jam)"
                value={responseTime}
                onChange={e => setResponseTime(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Price min"
                value={priceMin}
                onChange={e => setPriceMin(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Price max"
                value={priceMax}
                onChange={e => setPriceMax(e.target.value)}
              />
            </div>
            <textarea
              className={`${textareaClass} mt-3 min-h-[80px]`}
              placeholder="Service coverage (kota/area), pisahkan koma"
              value={serviceCoverage}
              onChange={e => setServiceCoverage(e.target.value)}
            />
          </section>

          <section
            id="profile-edit-buyer"
            className={sectionCardClass('buyer')}
          >
            <h2 className="mb-3 text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Buyer Preferences
            </h2>
            <p className="mb-3 text-sm text-[color:var(--app-text-soft)]">
              Bantu matching kebutuhan, budget, dan vendor.
            </p>
            <div className="grid gap-3 sm:grid-cols-2">
              <input
                className={inputClass}
                placeholder="Intent kebutuhan (contoh: cari vendor konten)"
                value={buyerIntent}
                onChange={e => setBuyerIntent(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Preferred location"
                value={preferredLocation}
                onChange={e => setPreferredLocation(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Budget min"
                value={buyerBudgetMin}
                onChange={e => setBuyerBudgetMin(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Budget max"
                value={buyerBudgetMax}
                onChange={e => setBuyerBudgetMax(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Preferred sector"
                value={preferredSector}
                onChange={e => setPreferredSector(e.target.value)}
              />
              <input
                className={inputClass}
                placeholder="Preferred sub-sector"
                value={preferredSubSector}
                onChange={e => setPreferredSubSector(e.target.value)}
              />
            </div>
          </section>

          <section
            id="profile-edit-media"
            className={sectionCardClass('media')}
          >
            <h2 className="mb-3 text-base font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              Media Upload
            </h2>
            <p className="mb-3 text-sm text-[color:var(--app-text-soft)]">
              Avatar, cover, gallery, dan dokumen akan dipakai di profile
              public, quick apply, dan showcase pekerjaan.
            </p>
            <div className="mb-4 grid gap-4 md:grid-cols-[1fr_2fr]">
              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  Foto Profil
                </label>
                <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
                  <div className="h-16 w-16 overflow-hidden rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={profileAvatarSrc(
                        avatarUrl,
                        readProfileAvatarStyle(baseMetadata) ||
                          readProfileAvatarStyle(user),
                        fullName || user?.full_name || user?.email,
                      )}
                      alt="Avatar preview"
                      className="h-full w-full object-cover"
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="ui-button-secondary ui-button-compact inline-flex w-full cursor-pointer items-center justify-center gap-2 text-xs font-semibold sm:w-auto">
                      {uploadingAvatar ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      Upload foto
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarChange}
                        disabled={uploadingAvatar || saving}
                      />
                    </label>
                    <p className="text-[11px] text-[color:var(--app-text-soft)]">
                      Foto akan di-crop sebelum upload.
                    </p>
                  </div>
                </div>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  Cover Image
                </label>
                {coverImageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={coverImageUrl}
                    alt="Cover preview"
                    className="mb-2 h-32 w-full rounded-xl object-cover"
                  />
                ) : (
                  <div className="mb-2 flex h-32 items-center justify-center rounded-xl border border-dashed border-[color:var(--app-border)] text-xs text-[color:var(--app-text-soft)]">
                    Belum ada cover image
                  </div>
                )}
                <label className="ui-button-secondary ui-button-compact inline-flex w-full cursor-pointer items-center justify-center gap-2 text-xs font-semibold sm:w-auto">
                  {uploadingCover ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload cover
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
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  Gallery Images
                </label>
                <label className="ui-button-secondary ui-button-compact inline-flex w-full cursor-pointer items-center justify-center gap-2 text-xs font-semibold sm:w-auto">
                  {uploadingImages ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload images
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={uploadImages}
                    disabled={uploadingImages || saving}
                  />
                </label>
                <div className="mt-3 space-y-2">
                  {galleryImages.map(url => (
                    <div
                      key={url}
                      className="ui-panel-muted flex flex-col items-start gap-2 px-2 py-1.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="min-w-0 break-all">{url}</span>
                      <button
                        type="button"
                        className="ui-danger-text shrink-0"
                        onClick={() => removeImage(url)}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  Documents / CV
                </label>
                <label className="ui-button-secondary ui-button-compact inline-flex w-full cursor-pointer items-center justify-center gap-2 text-xs font-semibold sm:w-auto">
                  {uploadingDocs ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  Upload documents
                  <input
                    type="file"
                    multiple
                    className="hidden"
                    onChange={uploadDocuments}
                    disabled={uploadingDocs || saving}
                  />
                </label>
                <div className="mt-3 space-y-2">
                  {documentUrls.map(url => (
                    <div
                      key={url}
                      className="ui-panel-muted flex flex-col items-start gap-2 px-2 py-1.5 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="min-w-0 break-all">{url}</span>
                      <button
                        type="button"
                        className="ui-danger-text shrink-0"
                        onClick={() => removeDoc(url)}
                      >
                        Hapus
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </div>

        {error ? (
          <p className="ui-panel-muted mt-4 border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] px-3 py-2 text-sm ui-danger-text">
            {error}
          </p>
        ) : null}
        {message ? (
          <p className="ui-panel-muted mt-4 border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] px-3 py-2 text-sm ui-accent-text">
            {message}
          </p>
        ) : null}

        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-[color:var(--app-text-soft)]">
            Simpan kalau info utamanya sudah pas.
          </p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <LocalizedLink
              href={publicProfilePath}
              className="ui-button-secondary inline-flex w-full items-center gap-2 px-3 text-sm font-semibold sm:w-auto"
            >
              <Globe2 className="h-4 w-4" />
              Profil publik
            </LocalizedLink>
            <button
              type="button"
              onClick={handleSave}
              disabled={
                saving ||
                uploadingImages ||
                uploadingDocs ||
                uploadingCover ||
                uploadingAvatar
              }
              className="ui-button-primary inline-flex w-full items-center justify-center gap-2 px-4 py-2 text-sm font-semibold disabled:opacity-60 sm:w-auto"
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

      <Modal
        open={educationEditorOpen}
        title={
          educationEditorIndex === null ? 'Tambah Education' : 'Edit Education'
        }
        onClose={closeEducationEditor}
        footer={
          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              onClick={closeEducationEditor}
              className="inline-flex flex-1 items-center justify-center rounded-full border border-[color:var(--app-border)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:text-[color:var(--app-text-soft)]"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={saveEducationDraft}
              className="inline-flex flex-1 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-4 py-2 text-xs font-semibold text-[color:var(--app-text-inverse)]"
            >
              {educationEditorIndex === null ? 'Tambahkan' : 'Simpan perubahan'}
            </button>
          </div>
        }
      >
        <p className="mb-3 text-sm text-[color:var(--app-text-soft)]">
          Isi yang penting saja. Satu card cukup singkat.
        </p>
        <div className="grid gap-3">
          <input
            className={inputClass}
            placeholder="Nama institusi / gelar"
            value={educationDraft.title}
            onChange={e =>
              setEducationDraft(current => ({
                ...current,
                title: e.target.value,
              }))
            }
          />
          <input
            className={inputClass}
            placeholder="Bidang / jurusan"
            value={educationDraft.subtitle || ''}
            onChange={e =>
              setEducationDraft(current => ({
                ...current,
                subtitle: e.target.value,
              }))
            }
          />
          <input
            className={inputClass}
            placeholder="Tahun / status"
            value={educationDraft.meta || ''}
            onChange={e =>
              setEducationDraft(current => ({
                ...current,
                meta: e.target.value,
              }))
            }
          />
          <input
            className={inputClass}
            placeholder="Link sertifikat (optional)"
            value={educationDraft.url || ''}
            onChange={e =>
              setEducationDraft(current => ({
                ...current,
                url: e.target.value,
              }))
            }
          />
        </div>
      </Modal>

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
