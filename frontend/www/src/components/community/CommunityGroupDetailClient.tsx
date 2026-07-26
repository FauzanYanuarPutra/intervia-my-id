'use client';

import {
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import {
  Camera,
  ChevronLeft,
  Earth,
  ImageIcon,
  Loader2,
  Lock,
  MessageCircle,
  Settings,
  ShieldCheck,
  Upload,
  Users,
} from 'lucide-react';
import { LajukanImage } from '@/components/common/LajukanImage';
import {
  CommunityComposer,
  CommunityDetailModal,
  CommunityFeedSkeleton,
  CommunityPostCard,
  GroupAvatarMark,
  GroupMembersModal,
  readCommunityAvatar,
} from '@/components/community/CommunityFeedClient';
import { useAuth } from '@/context/AuthContext';
import { Link, useRouter } from '@/i18n/navigation';
import { usePathname, useSearchParams } from 'next/navigation';
import { useToast } from '@/components/system/feedback/ToastProvider';
import {
  isPreviewableContentMediaUrl,
  normalizeContentMediaUrl,
} from '@/lib/content/catalog';
import { prepareUploadFiles } from '@/lib/media/prepareUploadMedia';
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

type GroupTab = 'discussion' | 'members' | 'about' | 'rules';

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

function resolveGroupMediaSrc(value?: string | null): string {
  const clean = normalizeContentMediaUrl(String(value || '').trim());
  if (!clean) return '';
  if (!isPreviewableContentMediaUrl(clean)) return '';
  return clean;
}

function readUploadedGroupMediaUrl(payload: unknown): string {
  const data =
    payload && typeof payload === 'object'
      ? (payload as Record<string, unknown>)
      : {};
  const dataFile =
    data.data && typeof data.data === 'object'
      ? (data.data as Record<string, unknown>)
      : null;
  const files = Array.isArray(data.files) ? data.files : [];
  const urls = Array.isArray(data.urls) ? data.urls : [];
  const candidates = [
    urls[0],
    dataFile?.url,
    files[0] && typeof files[0] === 'object'
      ? (files[0] as Record<string, unknown>).url
      : null,
  ];

  for (const candidate of candidates) {
    if (typeof candidate !== 'string') continue;
    const resolved = resolveGroupMediaSrc(candidate);
    if (resolved) return resolved;
  }

  return '';
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
        <p className="truncate text-sm font-bold text-[color:var(--app-text)]">
          {member.name}
        </p>
        <p className="mt-0.5 truncate text-xs text-[color:var(--app-text-soft)]">
          {member.title || (isId ? 'Anggota komunitas' : 'Community member')}
        </p>
      </div>
      <span className="inline-flex shrink-0 items-center rounded-full bg-[color:var(--app-accent-soft)] px-2.5 py-1 text-[10px] font-bold text-[color:var(--app-accent)]">
        {groupRoleLabel(member.role, isId)}
      </span>
    </article>
  );
}

function GroupSettingsModal({
  group,
  isId,
  open,
  onClose,
  onSaved,
}: {
  group: CommunityGroup;
  isId: boolean;
  open: boolean;
  onClose: () => void;
  onSaved: (group: CommunityGroup) => void;
}) {
  const { authFetch } = useAuth();
  const { notify } = useToast();
  const [name, setName] = useState(group.name);
  const [description, setDescription] = useState(group.description);
  const [privacy, setPrivacy] = useState<CommunityGroup['privacy']>(
    group.privacy,
  );
  const [postingPermission, setPostingPermission] = useState<
    CommunityGroup['postingPermission']
  >(group.postingPermission);
  const [membershipPermission, setMembershipPermission] = useState<
    CommunityGroup['membershipPermission']
  >(group.membershipPermission);
  const [rules, setRules] = useState<string[]>(
    group.rules.length ? group.rules : [''],
  );
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  const updateRule = (index: number, value: string) => {
    setRules(current =>
      current.map((item, itemIndex) => (itemIndex === index ? value : item)),
    );
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const cleanRules = rules.map(rule => rule.trim()).filter(Boolean);
    setSaving(true);
    const response = await authFetch(
      `/api/community/groups/${encodeURIComponent(group.id)}/permissions`,
      {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          description,
          privacy,
          postingPermission,
          membershipPermission,
          rules: cleanRules,
        }),
      },
    );
    const payload = (await response.json().catch(() => ({}))) as GroupResponse;
    setSaving(false);

    if (!response.ok || !payload.data) {
      notify({
        title: isId ? 'Edit group gagal' : 'Group update failed',
        description: payload.error || '',
        variant: 'error',
      });
      return;
    }

    onSaved(payload.data);
    notify({
      title: isId ? 'Group diperbarui' : 'Group updated',
      variant: 'success',
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-slate-950/45 px-2 py-2 sm:items-center">
      <form
        onSubmit={submit}
        className="flex max-h-[min(780px,calc(100dvh-24px))] w-full max-w-2xl flex-col overflow-hidden rounded-[24px] bg-white shadow-[0_24px_70px_-34px_rgba(15,23,42,0.42)]"
      >
        <header className="flex min-h-[62px] items-center justify-between gap-3 border-b border-[color:var(--app-border)] px-4">
          <div className="min-w-0">
            <p className="text-sm font-bold text-[color:var(--app-text)]">
              {isId ? 'Edit group' : 'Edit group'}
            </p>
            <p className="text-[11px] text-[color:var(--app-text-soft)]">
              {isId
                ? 'Nama, deskripsi, akses, dan aturan.'
                : 'Name, description, access, and rules.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-slate-50"
            aria-label={isId ? 'Tutup' : 'Close'}
          >
            <ChevronLeft className="h-5 w-5 rotate-[-90deg]" />
          </button>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
          <label className="block">
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Nama group' : 'Group name'}
            </span>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              maxLength={72}
              className="mt-1 min-h-[42px] w-full rounded-[14px] bg-slate-50 px-3 text-sm outline-none"
            />
          </label>

          <label className="block">
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Deskripsi' : 'Description'}
            </span>
            <textarea
              value={description}
              onChange={event => setDescription(event.target.value)}
              maxLength={520}
              rows={4}
              className="mt-1 w-full resize-none rounded-[14px] bg-slate-50 px-3 py-2 text-sm leading-6 outline-none"
            />
          </label>

          <div className="grid gap-2 sm:grid-cols-3">
            <label className="block">
              <span className="text-xs font-bold text-[color:var(--app-text)]">
                {isId ? 'Privasi' : 'Privacy'}
              </span>
              <select
                value={privacy}
                onChange={event =>
                  setPrivacy(event.target.value as CommunityGroup['privacy'])
                }
                className="mt-1 min-h-[40px] w-full rounded-[14px] bg-slate-50 px-3 text-xs outline-none"
              >
                <option value="public">{isId ? 'Publik' : 'Public'}</option>
                <option value="private">{isId ? 'Privat' : 'Private'}</option>
                <option value="hidden">
                  {isId ? 'Tersembunyi' : 'Hidden'}
                </option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-[color:var(--app-text)]">
                {isId ? 'Posting' : 'Posting'}
              </span>
              <select
                value={postingPermission}
                onChange={event =>
                  setPostingPermission(
                    event.target.value as CommunityGroup['postingPermission'],
                  )
                }
                className="mt-1 min-h-[40px] w-full rounded-[14px] bg-slate-50 px-3 text-xs outline-none"
              >
                <option value="public">
                  {isId ? 'Semua orang' : 'Everyone'}
                </option>
                <option value="member">{isId ? 'Member' : 'Members'}</option>
                <option value="moderator">
                  {isId ? 'Moderator' : 'Moderators'}
                </option>
              </select>
            </label>

            <label className="block">
              <span className="text-xs font-bold text-[color:var(--app-text)]">
                {isId ? 'Join' : 'Join'}
              </span>
              <select
                value={membershipPermission}
                onChange={event =>
                  setMembershipPermission(
                    event.target
                      .value as CommunityGroup['membershipPermission'],
                  )
                }
                className="mt-1 min-h-[40px] w-full rounded-[14px] bg-slate-50 px-3 text-xs outline-none"
              >
                <option value="open">{isId ? 'Langsung masuk' : 'Open'}</option>
                <option value="approval">
                  {isId ? 'Perlu approve' : 'Approval'}
                </option>
                <option value="invite">
                  {isId ? 'Undangan saja' : 'Invite only'}
                </option>
              </select>
            </label>
          </div>

          <div className="rounded-[18px] bg-slate-50 p-3">
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs font-bold text-[color:var(--app-text)]">
                {isId ? 'Aturan group' : 'Group rules'}
              </p>
              <button
                type="button"
                onClick={() =>
                  setRules(current =>
                    current.length >= 10 ? current : [...current, ''],
                  )
                }
                className="inline-flex min-h-[30px] items-center gap-1 rounded-full bg-white px-3 text-[11px] font-bold text-[color:var(--app-accent)]"
              >
                {isId ? 'Tambah' : 'Add'}
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {rules.map((rule, index) => (
                <div key={index} className="flex gap-2">
                  <input
                    value={rule}
                    onChange={event => updateRule(index, event.target.value)}
                    className="min-h-[38px] min-w-0 flex-1 rounded-[13px] bg-white px-3 text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setRules(current =>
                        current.length <= 1
                          ? ['']
                          : current.filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                      )
                    }
                    className="inline-flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-[13px] bg-white text-[color:var(--app-text-soft)]"
                    aria-label={isId ? 'Hapus aturan' : 'Remove rule'}
                  >
                    <ChevronLeft className="h-4 w-4 rotate-180" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        <footer className="border-t border-[color:var(--app-border)] p-4">
          <button
            type="submit"
            disabled={saving || !name.trim() || !description.trim()}
            className="inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[14px] bg-[color:var(--app-accent)] px-4 text-sm font-bold text-white disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {isId ? 'Simpan perubahan' : 'Save changes'}
          </button>
        </footer>
      </form>
    </div>
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
  const [uploadingMedia, setUploadingMedia] = useState<
    'avatar' | 'cover' | null
  >(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [nextCursor, setNextCursor] = useState<number | null>(0);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [membersModalGroup, setMembersModalGroup] =
    useState<CommunityGroup | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);

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

  const uploadGroupMedia = async (file: File, target: 'avatar' | 'cover') => {
    if (!group) return;
    if (!isAuthenticated) {
      router.push(loginHref);
      return;
    }
    if (!group.viewerCanManage) {
      notify({
        title: isId ? 'Tidak punya akses' : 'No access',
        description: isId
          ? 'Hanya admin atau moderator yang bisa mengubah tampilan grup.'
          : 'Only admins or moderators can update group media.',
        variant: 'error',
      });
      return;
    }

    setUploadingMedia(target);
    try {
      const [optimizedFile] = await prepareUploadFiles([file]);
      const formData = new FormData();
      formData.append('image', optimizedFile || file);
      const uploadResponse = await authFetch('/api/forum/upload-images', {
        method: 'POST',
        body: formData,
      });
      const uploadPayload = await uploadResponse.json().catch(() => ({}));
      const uploadedUrl = readUploadedGroupMediaUrl(uploadPayload);

      if (!uploadResponse.ok || !uploadedUrl) {
        notify({
          title: isId ? 'Upload gambar gagal' : 'Image upload failed',
          description:
            typeof uploadPayload.error === 'string' ? uploadPayload.error : '',
          variant: 'error',
        });
        return;
      }

      const updateResponse = await authFetch(
        `/api/community/groups/${encodeURIComponent(group.id)}/permissions`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            target === 'avatar'
              ? { avatarUrl: uploadedUrl }
              : { coverUrl: uploadedUrl },
          ),
        },
      );
      const updatePayload = (await updateResponse
        .json()
        .catch(() => ({}))) as GroupResponse;

      if (!updateResponse.ok) {
        notify({
          title: isId ? 'Gagal menyimpan tampilan' : 'Failed to save media',
          description: updatePayload.error || '',
          variant: 'error',
        });
        return;
      }

      setGroup(updatePayload.data || updatePayload.group || group);
      notify({
        title: isId ? 'Tampilan grup diperbarui' : 'Group media updated',
        variant: 'success',
      });
    } finally {
      setUploadingMedia(null);
    }
  };

  const handleGroupMediaInput = (
    event: ChangeEvent<HTMLInputElement>,
    target: 'avatar' | 'cover',
  ) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    void uploadGroupMedia(file, target);
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
      <main className="lajukan-home-compact min-h-screen bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-1 pb-6 pt-3 sm:px-2 lg:h-[calc(var(--app-viewport-height)-(60px+env(safe-area-inset-top)))] lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
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
          <h1 className="mt-4 text-xl font-bold text-[color:var(--app-text)]">
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
    { id: 'about', label: isId ? 'Tentang' : 'About' },
    { id: 'rules', label: isId ? 'Aturan' : 'Rules' },
  ];

  return (
    <main className="lajukan-home-compact min-h-screen overflow-x-hidden bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-1 pb-6 pt-3 sm:px-2 lg:h-[calc(var(--app-viewport-height)-(60px+env(safe-area-inset-top)))] lg:min-h-0 lg:overflow-hidden lg:px-0 lg:pb-0 lg:pt-0">
      <div className="sticky top-0 z-30 -mx-1 mb-3 border-b border-[color:var(--app-border)] bg-white/94 px-1 py-2  lg:hidden">
        <div className="flex items-center gap-2">
          <Link
            href="/community"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[color:var(--app-text)]"
            aria-label={isId ? 'Balik ke Komunitas' : 'Back to Community'}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <GroupAvatarMark
            group={group}
            className="h-9 w-9 rounded-[13px] text-sm"
            sizes="36px"
          />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-bold text-[color:var(--app-text)]">
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
            className="inline-flex min-h-[34px] shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent)] px-3 text-[11px] font-bold text-white disabled:opacity-60"
          >
            {joined ? (isId ? 'Joined' : 'Joined') : isId ? 'Gabung' : 'Join'}
          </button>
          {group.viewerCanManage ? (
            <button
              type="button"
              onClick={() => setSettingsOpen(true)}
              className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-50 text-[color:var(--app-text)]"
              aria-label={isId ? 'Edit group' : 'Edit group'}
            >
              <Settings className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="mx-auto grid min-h-0 w-full max-w-[1700px] gap-4 lg:h-[calc(var(--app-viewport-height)-4.625rem)] lg:grid-cols-[260px_minmax(0,1fr)] lg:overflow-hidden xl:grid-cols-[280px_minmax(0,1fr)_340px]">
        <aside className="hidden min-h-0 overflow-y-auto overscroll-contain pb-6 lg:block">
          <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
            <Link
              href="/community"
              className="inline-flex items-center gap-2 text-xs font-bold text-[color:var(--app-accent)]"
            >
              <ChevronLeft className="h-4 w-4" />
              {isId ? 'Komunitas' : 'Community'}
            </Link>
            <h1 className="mt-3 text-[1.25rem] font-bold leading-tight tracking-[-0.04em] text-[color:var(--app-text)]">
              {group.name}
            </h1>
            <div className="mt-3 flex items-center gap-3">
              <GroupAvatarMark
                group={group}
                className="h-14 w-14 rounded-[18px] text-lg"
                sizes="56px"
              />
              <div className="min-w-0 text-xs font-semibold text-[color:var(--app-text-soft)]">
                <p className="truncate">{groupPrivacyLabel(group, isId)}</p>
                <p className="truncate">{groupJoinLabel(group, isId)}</p>
              </div>
            </div>
            <p className="mt-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
              {group.description}
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-[18px] bg-slate-50 p-3">
                <p className="text-lg font-bold text-[color:var(--app-text)]">
                  {compactNumber(group.memberCount)}
                </p>
                <p className="text-[11px] font-semibold text-[color:var(--app-text-soft)]">
                  {isId ? 'Anggota' : 'Members'}
                </p>
              </div>
              <div className="rounded-[18px] bg-slate-50 p-3">
                <p className="text-lg font-bold text-[color:var(--app-text)]">
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
                'mt-4 inline-flex min-h-[42px] w-full items-center justify-center gap-2 rounded-[15px] text-sm font-bold disabled:opacity-60',
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
            {group.viewerCanManage ? (
              <button
                type="button"
                onClick={() => setSettingsOpen(true)}
                className="mt-2 inline-flex min-h-[40px] w-full items-center justify-center gap-2 rounded-[15px] bg-[color:var(--app-accent-soft)] text-sm font-bold text-[color:var(--app-accent)]"
              >
                <Settings className="h-4 w-4" />
                {isId ? 'Edit group' : 'Edit group'}
              </button>
            ) : null}
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
              {group.viewerCanManage ? (
                <label className="absolute right-4 top-4 z-[2] inline-flex min-h-[34px] cursor-pointer items-center gap-2 rounded-full bg-white/94 px-3 text-xs font-bold text-[color:var(--app-text)] shadow-sm transition hover:text-[color:var(--app-accent)]">
                  <input
                    type="file"
                    accept="image/*"
                    className="sr-only"
                    disabled={uploadingMedia !== null}
                    onChange={event => handleGroupMediaInput(event, 'cover')}
                  />
                  {uploadingMedia === 'cover' ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <ImageIcon className="h-4 w-4" />
                  )}
                  {isId ? 'Ganti cover' : 'Change cover'}
                </label>
              ) : null}
              <div className="relative z-[1] flex min-h-[136px] flex-col justify-between sm:min-h-[158px]">
                <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-bold">
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
                <div className="flex items-end gap-3">
                  {group.viewerCanManage ? (
                    <label className="relative inline-flex cursor-pointer">
                      <GroupAvatarMark
                        group={group}
                        className="h-20 w-20 rounded-[24px] border-[4px] border-white text-2xl shadow-[0_20px_34px_-26px_rgba(15,23,42,0.5)]"
                        sizes="80px"
                      />
                      <span className="absolute -bottom-1 -right-1 grid h-8 w-8 place-items-center rounded-full border-2 border-white bg-[color:var(--app-accent)] text-white shadow-sm">
                        {uploadingMedia === 'avatar' ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Camera className="h-4 w-4" />
                        )}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploadingMedia !== null}
                        onChange={event =>
                          handleGroupMediaInput(event, 'avatar')
                        }
                      />
                    </label>
                  ) : (
                    <GroupAvatarMark
                      group={group}
                      className="h-20 w-20 rounded-[24px] border-[4px] border-white text-2xl shadow-[0_20px_34px_-26px_rgba(15,23,42,0.5)]"
                      sizes="80px"
                    />
                  )}
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-[color:var(--app-accent)]">
                        {groupJoinLabel(group, isId)}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-[color:var(--app-text)]">
                        {group.privacy === 'public' ? (
                          <Earth className="h-3.5 w-3.5" />
                        ) : (
                          <Lock className="h-3.5 w-3.5" />
                        )}
                        {groupPrivacyLabel(group, isId)}
                      </span>
                    </div>
                    <h2 className="mt-2 max-w-2xl text-[1.55rem] font-bold leading-tight tracking-[-0.05em] text-white sm:text-[2.1rem]">
                      {group.name}
                    </h2>
                  </div>
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
                  <span className="block text-base font-bold text-[color:var(--app-text)]">
                    {compactNumber(group.memberCount)}
                  </span>
                  <span className="block text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    Member
                  </span>
                </button>
                <div className="rounded-[16px] bg-slate-50 p-2">
                  <span className="block text-base font-bold text-[color:var(--app-text)]">
                    {compactNumber(group.postCount)}
                  </span>
                  <span className="block text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    Post
                  </span>
                </div>
                <div className="rounded-[16px] bg-slate-50 p-2">
                  <span className="block truncate text-xs font-bold text-[color:var(--app-text)]">
                    {groupPostLabel(group, isId)}
                  </span>
                  <span className="block text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                    Posting
                  </span>
                </div>
              </div>
            </div>
          </section>

          <nav className="sticky top-[58px] z-20 flex gap-2 overflow-x-auto rounded-[18px] border border-[color:var(--app-border)] bg-white/94 p-1.5  lg:top-2">
            {tabs.map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'min-h-[38px] flex-1 rounded-[13px] px-3 text-sm font-bold transition',
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
                  <h2 className="text-base font-bold text-[color:var(--app-text)]">
                    {isId ? 'Anggota grup' : 'Group members'}
                  </h2>
                  <p className="text-xs text-[color:var(--app-text-soft)]">
                    {compactNumber(membersTotal || group.memberCount)} member
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setMembersModalGroup(group)}
                  className="inline-flex min-h-[36px] items-center rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-bold text-[color:var(--app-accent)]"
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

          {activeTab === 'about' ? (
            <section className="space-y-3">
              <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
                <h2 className="text-base font-bold text-[color:var(--app-text)]">
                  {isId ? 'Tentang grup' : 'About this group'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--app-text)]">
                  {group.description}
                </p>
                <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {[
                    {
                      label: isId ? 'Privasi' : 'Privacy',
                      value: groupPrivacyLabel(group, isId),
                    },
                    {
                      label: isId ? 'Cara join' : 'Join mode',
                      value: groupJoinLabel(group, isId),
                    },
                    {
                      label: isId ? 'Izin posting' : 'Posting permission',
                      value: groupPostLabel(group, isId),
                    },
                    {
                      label: isId ? 'Role kamu' : 'Your role',
                      value: groupRoleLabel(group.viewerRole, isId),
                    },
                    {
                      label: isId ? 'Anggota' : 'Members',
                      value: compactNumber(group.memberCount),
                    },
                    {
                      label: 'Post',
                      value: compactNumber(group.postCount),
                    },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="rounded-[18px] bg-slate-50 p-3"
                    >
                      <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
                        {item.label}
                      </p>
                      <p className="mt-1 text-sm font-bold text-[color:var(--app-text)]">
                        {item.value}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-base font-bold text-[color:var(--app-text)]">
                      {isId ? 'Admin & moderator' : 'Admins & moderators'}
                    </h2>
                    <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Orang yang menjaga arah diskusi dan membership.'
                        : 'People keeping discussions and membership healthy.'}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setMembersModalGroup(group)}
                    className="inline-flex min-h-[36px] shrink-0 items-center rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-bold text-[color:var(--app-accent)]"
                  >
                    {isId ? 'Lihat semua' : 'View all'}
                  </button>
                </div>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {leaders.length ? (
                    leaders.map(member => (
                      <MemberRow
                        key={member.userId}
                        member={member}
                        isId={isId}
                      />
                    ))
                  ) : (
                    <p className="text-sm leading-6 text-[color:var(--app-text-soft)]">
                      {isId
                        ? 'Belum ada admin atau moderator yang bisa ditampilkan.'
                        : 'No visible admins or moderators yet.'}
                    </p>
                  )}
                </div>
              </section>

              {group.viewerCanManage ? (
                <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h2 className="text-base font-bold text-[color:var(--app-text)]">
                        {isId ? 'Kelola group' : 'Manage group'}
                      </h2>
                      <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                        {isId
                          ? 'Edit informasi, aturan, izin akses, foto, dan cover.'
                          : 'Edit info, rules, access, photo, and cover.'}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSettingsOpen(true)}
                      className="inline-flex min-h-[36px] shrink-0 items-center gap-2 rounded-full bg-[color:var(--app-accent-soft)] px-3 text-xs font-bold text-[color:var(--app-accent)]"
                    >
                      <Settings className="h-4 w-4" />
                      {isId ? 'Edit' : 'Edit'}
                    </button>
                  </div>
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-[16px] bg-[color:var(--app-accent)] px-4 text-sm font-bold text-white">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploadingMedia !== null}
                        onChange={event =>
                          handleGroupMediaInput(event, 'avatar')
                        }
                      />
                      {uploadingMedia === 'avatar' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Upload className="h-4 w-4" />
                      )}
                      {isId ? 'Upload foto grup' : 'Upload group photo'}
                    </label>
                    <label className="inline-flex min-h-[44px] cursor-pointer items-center justify-center gap-2 rounded-[16px] border border-[color:var(--app-border)] bg-white px-4 text-sm font-bold text-[color:var(--app-text)]">
                      <input
                        type="file"
                        accept="image/*"
                        className="sr-only"
                        disabled={uploadingMedia !== null}
                        onChange={event =>
                          handleGroupMediaInput(event, 'cover')
                        }
                      />
                      {uploadingMedia === 'cover' ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="h-4 w-4" />
                      )}
                      {isId ? 'Upload cover' : 'Upload cover'}
                    </label>
                  </div>
                </section>
              ) : null}
            </section>
          ) : null}

          {activeTab === 'rules' ? (
            <section className="rounded-[24px] border border-[color:var(--app-border)] bg-white p-4 shadow-[0_16px_32px_-30px_rgba(15,23,42,0.14)]">
              <h2 className="text-base font-bold text-[color:var(--app-text)]">
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
            <h2 className="text-sm font-bold text-[color:var(--app-text)]">
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
            <h2 className="text-sm font-bold text-[color:var(--app-text)]">
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
      {settingsOpen ? (
        <GroupSettingsModal
          key={`${group.id}:${group.name}`}
          group={group}
          isId={isId}
          open={settingsOpen}
          onClose={() => setSettingsOpen(false)}
          onSaved={nextGroup => {
            setGroup(nextGroup);
            setRefreshKey(value => value + 1);
          }}
        />
      ) : null}
    </main>
  );
}
