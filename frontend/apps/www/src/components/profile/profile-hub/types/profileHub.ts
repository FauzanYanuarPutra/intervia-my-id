import type { ReactNode } from 'react';
import type { ListingItem } from './profileListings';
import type { SetupCard, StatItem } from './profileActivity';
import type { SocialUser } from './profileSocial';
import type { ProfileContentTab } from '@/lib/profile/profileContentTabs';

export type ProfessionalEntry = {
  title: string;
  subtitle?: string;
  meta?: string;
  url?: string;
};

export type ProfessionalData = {
  headline: string;
  summary: string;
  skills: string[];
  languages: string[];
  education: ProfessionalEntry[];
  certifications: ProfessionalEntry[];
  experiences: ProfessionalEntry[];
  links: Array<{ label: string; url: string }>;
};

export type DetailLike = {
  id?: string | null;
  email?: string;
  phone?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  username?: string | null;
  location?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  verification?: Record<string, unknown> | null;
  metadata?: Record<string, unknown> | null;
  profile?: Record<string, unknown> | null;
};

export type UserLike = {
  id?: string;
  email: string;
  username?: string;
  full_name?: string;
  phone?: string | null;
};

export type ProfileHubViewProps = {
  detail: DetailLike | null;
  user: UserLike;
  effectiveCoverUrl: string;
  effectiveAvatarUrl: string;
  avatarBuilder?: ReactNode;
  coverUploading: boolean;
  avatarUploading: boolean;
  saving: boolean;
  saveMessage: string | null;
  profileError: string | null;
  roleList: string[];
  professionalData: ProfessionalData;
  statItems: StatItem[];
  fullNameInput: string;
  usernameInput: string;
  phoneInput: string;
  locationInput: string;
  bioInput: string;
  onFullNameChange: (value: string) => void;
  onUsernameChange: (value: string) => void;
  onPhoneChange: (value: string) => void;
  onLocationChange: (value: string) => void;
  onBioChange: (value: string) => void;
  onSaveProfile: () => void;
  onCoverFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  onAvatarFileChange: (event: React.ChangeEvent<HTMLInputElement>) => void;
  listings: ListingItem[];
  activeMarketplaceTab: ProfileContentTab;
  onActiveMarketplaceTabChange: (value: ProfileContentTab) => void;
  txPreview: Array<{ id: string; status?: string; amount_cents?: number; currency?: string; created_at?: string }>;
  formatDate: (value: string | undefined) => string;
  formatMoneyFromCents: (cents: number | undefined, currency?: string) => string;
  verificationSource: Record<string, unknown> | null | undefined;
  onRefreshVerification: () => Promise<void>;
  setupCards: SetupCard[];
  qaResumeUrl: string;
  qaSaving: boolean;
  qaMessage: string | null;
  onQuickApplyResumeChange: (file: File | null) => void;
  onSaveQuickApply: () => void;
  dialPhone: string;
};

export type HubDerivedData = {
  locale: 'id' | 'en';
  isId: boolean;
  setupPercent: number;
  trustReady: boolean;
  listingCounts: Record<ProfileContentTab, number>;
  filteredListings: ListingItem[];
  visibleContentTabs: ProfileContentTab[];
  followerUsers: SocialUser[];
  followingUsers: SocialUser[];
  followerCount: number;
  followingCount: number;
};

