import type { ProfileContentTab } from '@/lib/profile/profileContentTabs';

export type ListingItem = {
  id: string;
  title?: string;
  content_type?: string;
  content_status?: string;
  status?: string;
  created_at?: string;
  category?: string | null;
  metadata?: Record<string, unknown> | null;
};

export type ListingCounts = Record<ProfileContentTab, number>;

