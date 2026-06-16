'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ChevronLeft,
  Earth,
  Loader2,
  Lock,
  MessageCircle,
  ShieldCheck,
  Users,
} from 'lucide-react';
import { LajukanImage } from '@/components/common/LajukanImage';
import {
  CommunityComposer,
  CommunityDetailModal,
  CommunityFeedSkeleton,
  CommunityPostCard,
  GroupMembersModal,
  readCommunityAvatar,
} from '@/components/community/CommunityFeedClient';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/i18n/navigation';
import { usePathname, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { profileAvatarSrc, readProfileAvatarStyle } from '@/lib/profile/avatar';
import { cn } from '@/lib/utils';
import type {
  CommunityFeedItem,
  CommunityFeedOverview,
  CommunityFeedResponse,
  CommunityGroup,
  CommunityGroupMember,
  CommunityGroupMembersResponse,
} from '@/lib/community/types';

type CommunityGroupDetailClientProps = {
  isId: boolean;
  slug: string;
};

type GroupResponse = {
  data?: CommunityGroup;
  group?: CommunityGroup;
  error?: string;
};

type GroupTab = 'discussion' | 'members' | 'rules';

function compactNumber(value: number | undefined) {
  const safe = Math.max(Number(value || 0), 0);
  if (safe >= 1_000_000)
    return `${(safe / 1_000_000).toFixed(safe >= 10_000_000 ? 0 : 1)}M`;
  if (safe >= 1_000)
    return `${(safe / 1_000).toFixed(safe >= 10_000 ? 0 : 1)}K`;
  return safe.toString();
}

function buildLoginHref(pathname: string | null, search: string) {
  const current = `${pathname || '/community'}${search ? `?${search}` : ''}`;
  return `/login?callbackUrl=${encodeURIComponent(current)}`;
}

function groupPrivacyLabel(group: CommunityGroup, isId: boolean) {
  if (group.privacy === 'hidden') return isId ? 'Tersembunyi' : 'Hidden';
  if (group.privacy === 'private') return isId ? 'Privat' : 'Private';
  return isId ? 'Publik' : 'Public';
}

function groupJoinLabel(group: CommunityGroup, isId: boolean) {
  if (group.viewerMembershipStatus === 'pending')
    return isId ? 'Menunggu approve' : 'Pending approval';
  if (group.viewerMembershipStatus === 'active')
    return isId ? 'Sudah join' : 'Joined';
  if (group.membershipPermission === 'approval')
    return isId ? 'Perlu approval' : 'Approval required';
  if (group.membershipPermission === 'invite')
    return isId ? 'Undangan saja' : 'Invite only';
  return isId ? 'Bisa langsung join' : 'Open join';
}

function groupPostLabel(group: CommunityGroup, isId: boolean) {
  if (group.postingPermission === 'moderator')
    return isId ? 'Admin/moderator' : 'Admins/moderators';
  if (group.postingPermission === 'member')
    return isId ? 'Member aktif' : 'Active members';
  return isId ? 'Semua orang' : 'Everyone';
}

function groupRoleLabel(
  role: CommunityGroupMember['role'] | CommunityGroup['viewerRole'],
  isId: boolean,
) {
  if (role === 'owner') return isId ? 'Admin' : 'Admin';
  if (role === 'moderator') return isId ? 'Moderator' : 'Moderator';
  return isId ? 'Member' : 'Member';
}

function normalizeMembers(payload: Partial<CommunityGroupMembersResponse>) {
  return {
    members: payload.data || [],
    admins: payload.admins || [],
    moderators: payload.moderators || [],
    total: payload.total || 0,
  };
}

function makeGroupOverview(group: CommunityGroup): CommunityFeedOverview {
  return {
    stats: {
      totalThreads: group.postCount,
      totalPosts: group.postCount,
      totalUsers: group.memberCount,
    },
    categories: [
      {
        id: group.categoryId,
        name: group.name,
        slug: group.categoryId,
        description: group.description,
        threadCount: group.postCount,
        postCount: group.postCount,
      },
    ],
    groups: [group],
    recommendedGroups: [],
    joinedGroups: group.viewerMembershipStatus === 'active' ? [group] : [],
    trendingTags: [],
    topContributors: [],
  };
}

function MemberRow({
  member,
  isId,
}: {
  member: CommunityGroupMember;
  isId: boolean;
}) {
  return (
    <article className="flex min-w-0 items-center gap-3 rounded-[18px] border border-[color:var(--app-border)] bg-white p-3">
      <LajukanImage
        alt={member.name}
        src={profileAvatarSrc(
          member.avatarUrl,
          readProfileAvatarStyle(member),
          member.name,
        )}
        width={44}
        height={44}
        className="h-11 w-11 rounded-full object-cover"
      />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-black text-[color:var(--app-text)]">
          {member.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-[color:var(--app-text-soft)]">
          {member.title || (isId ? 'Anggota komunitas' : 'Community member')}
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-black text-[color:var(--app-accent)]">
        {groupRoleLabel(member.role, isId)}
      </span>
    </article>
  );
}

export default function CommunityGroupDetailClient({
  isId,
  slug,
}: CommunityGroupDetailClientProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isAuthenticated, authFetch, user } = useAuth();
  const { notify } = useToast();
  const [group, setGroup] = useState<CommunityGroup | null>(null);
  const [items, setItems] = useState<CommunityFeedItem[]>([]);
  const [members, setMembers] = useState<CommunityGroupMember[]>([]);
  const [admins, setAdmins] = useState<CommunityGroupMember[]>([]);
  const [moderators, setModerators] = useState<CommunityGroupMember[]>([]);
  const [membersTotal, setMembersTotal] = useState(0);
  const [activeTab, setActiveTab] = useState<GroupTab>('discussion');
  const [loadingGroup, setLoadingGroup] = useState(true);
  const [loadingFeed, setLoadingFeed] = useState(false);
  const [loadingMembers, setLoadingMembers] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [busyJoin, setBusyJoin] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [membersModalGroup, setMembersModalGroup] =
    useState<CommunityGroup | null>(null);

  const selectedThreadId = searchParams.get('thread');
  const loginHref = buildLoginHref(pathname, searchParams.toString());
  const viewerAvatar = readCommunityAvatar(user);
  const joined = group?.viewerMembershipStatus === 'active';
  const pending = group?.viewerMembershipStatus === 'pending';
  const overview = useMemo(
    () => (group ? makeGroupOverview(group) : null),
    [group],
  );

  useEffect(() => {
    let alive = true;
    queueMicrotask(() => {
      if (!alive) return;
      setLoadingGroup(true);
      setNotFound(false);
    });

    fetch(`/api/community/groups/${encodeURIComponent(slug)}`, {
      cache: 'no-store',
      credentials: 'include',
    })
      .then(async response => {
        const payload = (await response
          .json()
          .catch(() => ({}))) as GroupResponse;
        if (!response.ok) throw payload;
        return payload.data || payload.group || null;
      })
      .then(nextGroup => {
        if (!alive) return;
        setGroup(nextGroup);
        setNotFound(!nextGroup);
      })
      .catch(() => {
        if (!alive) return;
        setGroup(null);
        setNotFound(true);
      })
      .finally(() => {
        if (alive) setLoadingGroup(false);
      });

    return () => {
      alive = false;
    };
  }, [slug, refreshKey]);

  useEffect(() => {
    if (!group) return;
    let alive = true;
    const params = new URLSearchParams();
    params.set('category', group.categoryId);
    params.set('limit', '10');
    params.set('cursor', '0');
    params.set('_', String(refreshKey));
    queueMicrotask(() => {
      if (alive) setLoadingFeed(true);
    });

    fetch(`/api/community/feed?${params.toString()}`, {
      cache: 'no-store',
      credentials: 'include',
    })
      .then(response => response.json())
      .then((payload: CommunityFeedResponse) => {
        if (!alive) return;
        setItems(payload.items || []);
        setNextCursor(payload.nextCursor);
        setHasMore(Boolean(payload.hasMore));
      })
      .catch(() => {
        if (!alive) return;
        setItems([]);
        setNextCursor(null);
        setHasMore(false);
      })
      .finally(() => {
        if (alive) setLoadingFeed(false);
      });

    return () => {
      alive = false;
    };
  }, [group, refreshKey]);

  useEffect(() => {
    if (!group) return;
    let alive = true;
    queueMicrotask(() => {
      if (alive) setLoadingMembers(true);
    });
    authFetch(
      `/api/community/groups/${encodeURIComponent(group.id)}/members?limit=36`,
      { cache: 'no-store' },
    )
      .then(response => (response.ok ? response.json() : null))
      .then((payload: Partial<CommunityGroupMembersResponse> | null) => {
        if (!alive || !payload) return;
        const next = normalizeMembers(payload);
        setMembers(next.members);
        setAdmins(next.admins);
        setModerators(next.moderators);
        setMembersTotal(next.total);
      })
      .catch(() => {
        if (!alive) return;
        setMembers([]);
        setAdmins([]);
        setModerators([]);
        setMembersTotal(0);
      })
      .finally(() => {
        if (alive) setLoadingMembers(false);
      });

    return () => {
      alive = false;
    };
  }, [authFetch, group, refreshKey]);

  const loadMore = async () => {
    if (!group || !hasMore || nextCursor == null || loadingMore) return;
    setLoadingMore(true);
    const params = new URLSearchParams();
    params.set('category', group.categoryId);
    params.set('limit', '10');
    params.set('cursor', String(nextCursor));
    const response = await fetch(`/api/community/feed?${params.toString()}`, {
      cache: 'no-store',
      credentials: 'include',
    });
    const payload = (await response
      .json()
      .catch(() => ({}))) as Partial<CommunityFeedResponse>;
    setItems(current => {
      const existing = new Set(current.map(item => item.id));
      return [
        ...current,
        ...(payload.items || []).filter(item => !existing.has(item.id)),
      ];
    });
    setNextCursor(payload.nextCursor ?? null);
    setHasMore(Boolean(payload.hasMore));
    setLoadingMore(false);
  };

  const joinOrLeave = async () => {
    if (!group) return;
    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }
    if (group.viewerRole === 'owner') return;

    setBusyJoin(true);
    const response = await authFetch(
      `/api/community/groups/${encodeURIComponent(group.id)}/${joined ? 'leave' : 'join'}`,
      { method: 'POST' },
    );
    const payload = (await response.json().catch(() => ({}))) as GroupResponse;
    setBusyJoin(false);

    if (!response.ok) {
      notify({
        title: isId ? 'Aksi grup gagal' : 'Group action failed',
        description: payload.error || '',
        variant: 'error',
      });
      return;
    }

    if (payload.data || payload.group) {
      setGroup(payload.data || payload.group || group);
    } else {
      setRefreshKey(value => value + 1);
    }
    notify({
      title: joined
        ? isId
          ? 'Keluar dari grup'
          : 'Left group'
        : group.membershipPermission === 'approval'
          ? isId
            ? 'Permintaan join dikirim'
            : 'Join request sent'
          : isId
            ? 'Berhasil join grup'
            : 'Joined group',
      variant: 'success',
    });
  };

  const closeThreadDetail = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('thread');
    const cleanPath = (pathname || `/community/groups/${slug}`).replace(
      /^\/(id|en)(?=\/|$)/,
      '',
    );
    const queryString = params.toString();
    router.push(queryString ? `${cleanPath}?${queryString}` : cleanPath);
  };

  const handleOpenThread = (threadId: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('thread', threadId);
    router.push(
      `/community/groups/${encodeURIComponent(slug)}?${params.toString()}`,
    );
  };

  const handleComposerCreated = (createdItem?: CommunityFeedItem) => {
    if (createdItem) {
      setItems(current => [
        createdItem,
        ...current.filter(item => item.id !== createdItem.id),
      ]);
    }
    setRefreshKey(value => value + 1);
  };

  if (loadingGroup) {
    return (
      <main className="lajukan-home-compact min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-1 pb-6 pt-3 sm:px-2 lg:h-[calc(100svh-(60px+env(safe-area-inset-top)))] lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
        <div className="mx-auto w-full max-w-[980px] pt-2">
          <CommunityFeedSkeleton />
        </div>
      </main>
    );
  }

  if (notFound || !group) {
    return (
      <main className="lajukan-home-compact min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-1 pb-6 pt-3 sm:px-2 lg:px-0">
        <section className="mx-auto mt-4 max-w-lg rounded-[24px] border border-[color:var(--app-border)] bg-white p-6 text-center shadow-[0_18px_38px_-34px_rgba(15,23,42,0.18)]">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-full bg-slate-50 text-[color:var(--app-text-soft)]">
            <Users className="h-7 w-7" />
          </div>
          <h1 className="mt-4 text-xl font-black text-[color:var(--app-text)]">
            {isId ? 'Grup tidak ditemukan' : 'Group not found'}
          </h1>
          <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Link grup ini tidak tersedia atau aksesnya dibatasi.'
              : 'This group link is unavailable or access is restricted.'}
          </p>
          <Link
            href="/community"
            className="mt-5 inline-flex min-h-[42px] items-center justify-center gap-2 rounded-full bg-[color:var(--app-accent)] px-4 text-sm font-bold text-white"
          >
            <ChevronLeft className="h-4 w-4" />
            {isId ? 'Balik ke Komunitas' : 'Back to Community'}
          </Link>
        </section>
      </main>
    );
  }

  const leaders = [...admins, ...moderators].slice(0, 5);
  const tabs: Array<{ id: GroupTab; label: string }> = [
    { id: 'discussion', label: isId ? 'Diskusi' : 'Discussions' },
    { id: 'members', label: isId ? 'Anggota' : 'Members' },
    { id: 'rules', label: isId ? 'Aturan' : 'Rules' },
  ];

  return (
    <main className="lajukan-home-compact min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-1 pb-6 pt-3 sm:px-2 lg:h-[calc(100svh-(60px+env(safe-area-inset-top)))] lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
      <div className="sticky top-0 z-30 -mx-1 mb-3 border-b border-[color:var(--app-border)] bg-white/94 px-1 py-2 backdrop-blur-xl lg:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="/community"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[color:var(--app-text)]"
            aria-label={isId ? 'Balik ke Komunitas' : 'Back to Community'}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-black text-[color:var(--app-text)]">
              {group.name}
            </p>
            <p className="truncate text-[11px] text-[color:var(--app-text-soft)]">
              {compactNumber(group.memberCount)} member
            </p>
          </div>
          <button
            type="button"
            onClick={joinOrLeave}
            disabled={busyJoin || pending || group.viewerRole === 'owner'}
            className="inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-3 text-[11px] font-black text-white disabled:opacity-60"
          >
            {joined ? (isId ? 'Joined' : 'Joined') : isId ? 'Gabung' : 'Join'}
          </button>
        </div>
      </div>

      <div className="mx-auto grid min-h-0 w-full max-w-[1700px] gap-4 lg:h-[calc(100svh-4.625rem)] lg:grid-cols-[260px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="hidden min-h-0 overflow-y-auto overscroll-contain pb-6 lg:block">
          <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
            <Link
              href="/community"
              className="inline-flex items-center gap-2 text-xs font-bold text-[color:var(--app-accent)]"
            >
              <ChevronLeft className="h-4 w-4" />
              {isId ? 'Komunitas' : 'Community'}
            </Link>
            <h1 className="mt-3 text-[1.25rem] font-black leading-tight tracking-[-0.04em] text-[color:var(--app-text)]">
              {group.name}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
              {group.description}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[18px] bg-slate-50 p-3">
                <p className="text-lg font-black text-[color:var(--app-text)]">
                  {compactNumber(group.memberCount)}
                </p>
                <p className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {isId ? 'Anggota' : 'Members'}
                </p>
              </div>
              <div className="rounded-[18px] bg-slate-50 p-3">
                <p className="text-lg font-black text-[color:var(--app-text)]">
                  {compactNumber(group.postCount)}
                </p>
                <p className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  Post
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={joinOrLeave}
              disabled={busyJoin || pending || group.viewerRole === 'owner'}
              className={cn(
                'mt-4 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[15px] text-sm font-black disabled:opacity-60',
                joined
                  ? 'border border-[color:var(--app-border)] bg-white text-[color:var(--app-text)]'
                  : 'bg-[color:var(--app-accent)] text-white',
              )}
            >
              {busyJoin ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {pending
                ? isId
                  ? 'Menunggu approve'
                  : 'Pending approval'
                : joined
                  ? isId
                    ? 'Sudah join'
                    : 'Joined'
                  : isId
                    ? 'Gabung grup'
                    : 'Join group'}
            </button>
            <button
              type="button"
              onClick={() => setMembersModalGroup(group)}
              className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[15px] border border-[color:var(--app-border)] bg-white text-sm font-bold text-[color:var(--app-text)]"
            >
              <Users className="h-4 w-4" />
              {isId ? 'Anggota' : 'Members'}
            </button>
          </section>
        </aside>

        <section
          className="min-w-0 space-y-3 lg:min-h-0 lg:overflow-y-auto lg:overscroll-contain lg:pr-1"
          data-auto-scrollbar
        >
          <section className="overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-white shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
            <div className="relative min-h-[168px] bg-[linear-gradient(135deg,#dcfce7,#f8fafc)] p-4 sm:min-h-[190px]">
              {group.coverUrl ? (
                <LajukanImage
                  src={group.coverUrl}
                  alt={group.name}
                  fill
                  sizes="(max-width: 1023px) 100vw, 900px"
                  className="object-cover"
                />
              ) : (
                <div className="absolute right-5 top-5 grid h-16 w-16 place-items-center rounded-[24px] bg-white/78 text-[color:var(--app-accent)] shadow-[0_20px_38px_-32px_rgba(15,23,42,0.35)]">
                  <Users className="h-8 w-8" />
                </div>
              )}
              <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.10),rgba(15,23,42,0.50))]" />
              <div className="relative z-[1] flex min-h-[136px] flex-col justify-between sm:min-h-[158px]">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black">
                  <Link
                    href="/community"
                    className="rounded-full bg-white/92 px-2.5 py-1 text-[color:var(--app-accent)]"
                  >
                    {isId ? 'Komunitas' : 'Community'}
                  </Link>
                  <span className="rounded-full bg-white/80 px-2 py-1 text-[color:var(--app-text)]">
                    {group.name}
                  </span>
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-black text-[color:var(--app-accent)]">
                      {groupJoinLabel(group, isId)}
                    </span>
                    <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-black text-[color:var(--app-text)]">
                      {group.privacy === 'public' ? (
                        <Earth className="h-3.5 w-3.5" />
                      ) : (
                        <Lock className="h-3.5 w-3.5" />
                      )}
                      {groupPrivacyLabel(group, isId)}
                    </span>
                  </div>
                  <h2 className="mt-2 max-w-2xl text-[1.65rem] font-black leading-tight tracking-[-0.05em] text-white sm:text-[2.1rem]">
                    {group.name}
                  </h2>
                </div>
              </div>
            </div>

            <div className="grid gap-3 p-3.5 sm:p-4 lg:grid-cols-[minmax(0,1fr)_220px]">
              <p className="text-sm leading-6 text-[color:var(--app-text)]">
                {group.description}
              </p>
              <div className="grid grid-cols-3 gap-2 text-center">
                <button
                  type="button"
                  onClick={() => setMembersModalGroup(group)}
                  className="rounded-[16px] bg-slate-50 p-2"
                >
                  <span className="block text-base font-black text-[color:var(--app-text)]">
                    {compactNumber(group.memberCount)}
                  </span>
                  <span className="block text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    Member
                  </span>
                </button>
                <div className="rounded-[16px] bg-slate-50 p-2">
                  <span className="block text-base font-black text-[color:var(--app-text)]">
                    {compactNumber(group.postCount)}
                  </span>
                  <span className="block text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    Post
                  </span>
                </div>
                <div className="rounded-[16px] bg-slate-50 p-2">
                  <span className="block truncate text-xs font-black text-[color:var(--app-text)]">
                    {groupPostLabel(group, isId)}
                  </span>
                  <span className="block text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    Posting
                  </span>
                </div>
              </div>
            </div>
          </section>

          <nav className="sticky top-[58px] z-20 flex gap-2 overflow-x-auto rounded-[18px] border border-[color:var(--app-border)] bg-white/94 p-1.5 backdrop-blur-xl lg:top-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'min-h-[38px] flex-1 rounded-[13px] px-3 text-sm font-black transition',
                  activeTab === tab.id
                    ? 'bg-[color:var(--app-accent)] text-white'
                    : 'text-[color:var(--app-text-soft)] hover:bg-slate-50',
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {activeTab === 'discussion' ? (
            <>
              {group.viewerCanPost ? (
                <CommunityComposer
                  isId={isId}
                  userAvatar={viewerAvatar}
                  isAuthenticated={isAuthenticated}
                  overview={overview}
                  lockedGroup={group}
                  onCreated={handleComposerCreated}
                />
              ) : (
                <section className="rounded-[22px] border border-[color:var(--app-border)] bg-white p-4 text-sm text-[color:var(--app-text-soft)]">
                  {isAuthenticated
                    ? isId
                      ? 'Kamu belum punya izin posting di grup ini.'
                      : 'You do not have posting permission in this group yet.'
                    : isId
                      ? 'Masuk dulu untuk join atau posting di grup ini.'
                      : 'Log in first to join or post in this group.'}
                </section>
              )}

              {loadingFeed ? <CommunityFeedSkeleton /> : null}
              {!loadingFeed && items.length === 0 ? (
                <section className="rounded-[22px] border border-[color:var(--app-border)] bg-white p-6 text-center shadow-[0_16px_30px_-28px_rgba(15,23,42,0.13)]">
                  <MessageCircle className="mx-auto h-8 w-8 text-[color:var(--app-accent)]" />
                  <p className="mt-3 text-sm font-semibold text-[color:var(--app-text)]">
                    {isId
                      ? 'Belum ada diskusi di grup ini.'
                      : 'No discussions in this group yet.'}
                  </p>
                </section>
              ) : null}
              <div className="space-y-3">
                {items.map(item => (
                  <CommunityPostCard
                    key={item.id}
                    item={item}
                    isId={isId}
                    onOpenDetail={handleOpenThread}
                  />
                ))}
              </div>
              {hasMore ? (
                <div className="flex justify-center py-2">
                  <button
                    type="button"
                    onClick={loadMore}
                    disabled={loadingMore}
                    className="inline-flex min-h-[40px] items-center justify-center gap-2 rounded-full border border-[color:var(--app-border)] bg-white px-4 text-sm font-semibold text-[color:var(--app-text)] disabled:opacity-60"
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : null}
                    {isId ? 'Muat lagi' : 'Load more'}
                  </button>
                </div>
              ) : null}
            </>
          ) : null}

          {activeTab === 'members' ? (
            <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-3.5 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-black text-[color:var(--app-text)]">
                    {isId ? 'Anggota grup' : 'Group members'}
                  </h2>
                  <p className="text-xs text-[color:var(--app-text-soft)]">
                    {compactNumber(membersTotal || group.memberCount)} member
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMembersModalGroup(group)}
                  className="inline-flex min-h-[36px] items-center rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-black text-[color:var(--app-accent)]"
                >
                  {isId ? 'Lihat detail' : 'View detail'}
                </button>
              </div>
              {loadingMembers ? <CommunityFeedSkeleton /> : null}
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {members.map(member => (
                  <MemberRow key={member.userId} member={member} isId={isId} />
                ))}
              </div>
            </section>
          ) : null}

          {activeTab === 'rules' ? (
            <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
              <h2 className="text-base font-black text-[color:var(--app-text)]">
                {isId ? 'Aturan grup' : 'Group rules'}
              </h2>
              <div className="mt-3 space-y-2">
                {(group.rules.length
                  ? group.rules
                  : [
                      isId
                        ? 'Diskusi harus relevan dengan usaha.'
                        : 'Discussions must be relevant to business.',
                    ]
                ).map(rule => (
                  <div
                    key={rule}
                    className="flex gap-2 rounded-[18px] bg-slate-50 p-3 text-sm leading-6 text-[color:var(--app-text)]"
                  >
                    <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                    <span>{rule}</span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}
        </section>

        <aside className="hidden min-h-0 overflow-y-auto overscroll-contain pb-6 xl:block">
          <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
            <h2 className="text-sm font-black text-[color:var(--app-text)]">
              {isId ? 'Admin & moderator' : 'Admins & moderators'}
            </h2>
            <div className="mt-3 space-y-2">
              {leaders.length ? (
                leaders.map(member => (
                  <MemberRow key={member.userId} member={member} isId={isId} />
                ))
              ) : (
                <p className="text-xs leading-5 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Belum ada data admin yang bisa ditampilkan.'
                    : 'No visible admin data yet.'}
                </p>
              )}
            </div>
          </section>
          <section className="mt-3 rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
            <h2 className="text-sm font-black text-[color:var(--app-text)]">
              {isId ? 'Ringkas' : 'Summary'}
            </h2>
            <div className="mt-3 space-y-2 text-xs text-[color:var(--app-text)]">
              <p className="flex justify-between gap-3">
                <span>{isId ? 'Privasi' : 'Privacy'}</span>
                <strong>{groupPrivacyLabel(group, isId)}</strong>
              </p>
              <p className="flex justify-between gap-3">
                <span>{isId ? 'Join' : 'Join'}</span>
                <strong>{groupJoinLabel(group, isId)}</strong>
              </p>
              <p className="flex justify-between gap-3">
                <span>{isId ? 'Posting' : 'Posting'}</span>
                <strong>{groupPostLabel(group, isId)}</strong>
              </p>
            </div>
          </section>
        </aside>
      </div>

      <CommunityDetailModal
        isId={isId}
        threadId={selectedThreadId}
        onClose={closeThreadDetail}
        onChanged={() => setRefreshKey(value => value + 1)}
      />
      <GroupMembersModal
        group={membersModalGroup}
        isId={isId}
        onClose={() => setMembersModalGroup(null)}
        onChanged={() => setRefreshKey(value => value + 1)}
      />
    </main>
  );
}
