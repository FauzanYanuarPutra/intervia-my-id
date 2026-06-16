export type DiscoverUser = {
  id?: string;
  username?: string | null;
  full_name?: string | null;
  fullName?: string | null;
  avatar_url?: string | null;
  avatarUrl?: string | null;
  avatar_style?: unknown;
  avatarStyle?: unknown;
  metadata?: unknown;
  location?: string | null;
  headline?: string | null;
  bio?: string | null;
  level?: string | null;
  rating?: number | null;
  completed_jobs?: number | null;
};

export type SocialUser = {
  id: string;
  name: string;
  handle: string;
  href: string;
  avatarUrl: string;
  subtitle: string;
  meta: string;
};
