
'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth, useRequireAuth } from '@/context/AuthContext';
import { backofficeApi, moderationApi, newsApi } from '@/lib/api';
import CmsDashboard from './CmsDashboard';

type R = Record<string, unknown>;
type Workspace = 'overview' | 'news' | 'moderation' | 'studio' | 'team';
type FactCheckStatus = 'pending' | 'verified' | 'not_required';
type LegalReviewStatus = 'pending' | 'approved' | 'not_required';
type EditorialPriority = 'low' | 'normal' | 'high' | 'urgent';
type Sensitivity = 'normal' | 'high';
type NewsForm = {
  title: string;
  slug: string;
  summary: string;
  body: string;
  category: string;
  article_kind: string;
  location: string;
  topics: string;
  source_urls: string;
  cover_image: string;
  seo_title: string;
  seo_description: string;
  og_image: string;
  note: string;
  publish_at: string;
  fact_check_status: FactCheckStatus;
  legal_review_status: LegalReviewStatus;
  editorial_priority: EditorialPriority;
  sensitivity: Sensitivity;
};

const CATEGORIES = ['Ekonomi', 'Bisnis', 'UMKM', 'Teknologi', 'Keuangan', 'Regulasi', 'Industri', 'Daerah'];
const KINDS = [['news', 'Berita'], ['analysis', 'Analisis'], ['press_release', 'Siaran pers']] as const;

const rec = (v: unknown): R => (v && typeof v === 'object' && !Array.isArray(v) ? v as R : {});
const arr = (v: unknown): R[] => Array.isArray(v) ? v as R[] : ['items', 'data', 'results'].flatMap(k => Array.isArray(rec(v)[k]) ? rec(v)[k] as R[] : []);
const str = (v: unknown, fallback = '') => typeof v === 'string' ? v : fallback;
const factCheckStatus = (v: unknown): FactCheckStatus => {
  const value = str(v);
  return value === 'verified' || value === 'not_required' ? value : 'pending';
};
const legalReviewStatus = (v: unknown): LegalReviewStatus => {
  const value = str(v);
  return value === 'pending' || value === 'approved' ? value : 'not_required';
};
const editorialPriority = (v: unknown): EditorialPriority => {
  const value = str(v);
  return value === 'low' || value === 'high' || value === 'urgent' ? value : 'normal';
};
const sensitivity = (v: unknown): Sensitivity => str(v) === 'high' ? 'high' : 'normal';
const num = (v: unknown) => typeof v === 'number' && Number.isFinite(v) ? v : Number(v || 0);
const dateLabel = (v: unknown) => {
  if (!v) return '-';
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' });
};
const inputDate = (v: unknown) => {
  if (!v) return '';
  const d = new Date(String(v));
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate()) + 'T' + p(d.getHours()) + ':' + p(d.getMinutes());
};
const isoDate = (v: string) => {
  if (!v.trim()) return undefined;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
};
const statusOf = (v: R) => {
  const news = rec(rec(v.metadata).news);
  return str(news.editorial_status, str(v.content_status, 'pending_review'));
};
const statusClass = (s: string) => {
  if (['published', 'approved', 'active', 'verified'].includes(s)) return 'bg-emerald-500/10 text-emerald-700 border-emerald-500/20';
  if (['rejected', 'retracted', 'removed', 'critical'].includes(s)) return 'bg-rose-500/10 text-rose-700 border-rose-500/20';
  if (['high', 'needs_revision', 'pending_review', 'open'].includes(s)) return 'bg-amber-500/10 text-amber-700 border-amber-500/20';
  return 'bg-slate-500/10 text-slate-700 border-slate-500/20';
};

function initialNews(item: R | null): NewsForm {
  if (!item) return {
    title: '', slug: '', summary: '', body: '', category: 'Ekonomi', article_kind: 'news', location: '',
    topics: '', source_urls: '', cover_image: '', seo_title: '', seo_description: '', og_image: '',
    note: '', publish_at: '', fact_check_status: 'pending', legal_review_status: 'not_required',
    editorial_priority: 'normal', sensitivity: 'normal'
  };
  const news = rec(rec(item.metadata).news);
  const seo = rec(news.seo);
  return {
    title: str(item.title), slug: str(item.slug), summary: str(item.summary), body: str(item.body),
    category: str(news.category, 'Ekonomi'), article_kind: str(news.article_kind, 'news'),
    location: str(news.location), topics: Array.isArray(news.topics) ? news.topics.join(', ') : '',
    source_urls: Array.isArray(news.source_urls) ? news.source_urls.join('\n') : '',
    cover_image: str(item.cover_image), seo_title: str(seo.title), seo_description: str(seo.description),
    og_image: str(seo.og_image), note: '', publish_at: inputDate(news.scheduled_for || item.published_at),
    fact_check_status: str(news.fact_check_status, 'pending'),
    legal_review_status: str(news.legal_review_status, 'not_required'),
    editorial_priority: str(news.editorial_priority, 'normal'),
    sensitivity: str(news.sensitivity, 'normal')
  };
}

export default function CmsControlCenter() {
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const { user, accessToken } = useAuth();
  const [workspace, setWorkspace] = useState<Workspace>('overview');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [newsStatus, setNewsStatus] = useState('pending_review');
  const [newsItems, setNewsItems] = useState<R[]>([]);
  const [newsMetrics, setNewsMetrics] = useState<R>({});
  const [selectedId, setSelectedId] = useState('');
  const [newsHistory, setNewsHistory] = useState<R>({});
  const [newsForm, setNewsForm] = useState(initialNews(null));
  const [savedAt, setSavedAt] = useState('');
  const [uploadingCover, setUploadingCover] = useState(false);

  const [moderationStatus, setModerationStatus] = useState('open');
  const [moderationItems, setModerationItems] = useState<R[]>([]);

  const [teamQuery, setTeamQuery] = useState('');
  const [candidates, setCandidates] = useState<R[]>([]);
  const [invitations, setInvitations] = useState<R[]>([]);
  const [teamRole, setTeamRole] = useState('content_admin');

  const selectedNews = useMemo(() => newsItems.find(x => str(x.id) === selectedId) || null, [newsItems, selectedId]);

  const loadHistory = useCallback(async (id: string) => {
    if (!accessToken || !id) return;
    try { setNewsHistory(rec(await newsApi.history(accessToken, id))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal memuat riwayat'); }
  }, [accessToken]);

  const selectNews = useCallback((item: R | null) => {
    const id = item ? str(item.id) : '';
    setSelectedId(id);
    setNewsForm(initialNews(item));
    if (id) void loadHistory(id);
  }, [loadHistory]);

  const refreshNews = useCallback(async () => {
    if (!accessToken) return;
    const [q, m] = await Promise.all([newsApi.queue(accessToken, newsStatus), newsApi.metrics(accessToken)]);
    const next = arr(q);
    setNewsItems(next);
    setNewsMetrics(rec(m));
    if (!selectedId && next[0]?.id) selectNews(next[0]);
  }, [accessToken, newsStatus, selectedId, selectNews]);

  const refreshModeration = useCallback(async () => {
    if (!accessToken) return;
    const q = await moderationApi.queue(accessToken, { status: moderationStatus, limit: '100' });
    setModerationItems(arr(q));
  }, [accessToken, moderationStatus]);

  const refreshTeam = useCallback(async () => {
    if (!accessToken || !user?.roles?.includes('super_admin')) return;
    setInvitations(arr(await backofficeApi.invitations(accessToken)));
  }, [accessToken, user?.roles]);

  useEffect(() => {
    if (!accessToken) return;
    queueMicrotask(() => {
      void refreshNews().catch(e => setError(e instanceof Error ? e.message : 'Gagal memuat News'));
      void refreshModeration().catch(e => setError(e instanceof Error ? e.message : 'Gagal memuat moderasi'));
      void refreshTeam().catch(e => setError(e instanceof Error ? e.message : 'Gagal memuat tim'));
    });
  }, [accessToken, refreshNews, refreshModeration, refreshTeam]);

  const uploadCover = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploadingCover(true);
    setError('');
    try {
      const form = new FormData();
      form.append('image', file);
      const response = await fetch('/api/content/upload-images', { method: 'POST', body: form });
      const payload = rec(await response.json().catch(() => ({})));
      const urls = Array.isArray(payload.urls) ? payload.urls : [];
      const files = Array.isArray(payload.files) ? payload.files : [];
      const url = str(urls[0]) || str(rec(files[0]).url);
      if (!response.ok || !url) throw new Error(str(payload.error, 'Gagal mengunggah gambar.'));
      setNewsForm(prev => ({ ...prev, cover_image: url }));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Gagal mengunggah gambar');
    } finally {
      setUploadingCover(false);
    }
  };

  const refreshAll = async () => {
    setBusy(true); setError('');
    try { await Promise.all([refreshNews(), refreshModeration(), refreshTeam()]); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal refresh CMS'); }
    finally { setBusy(false); }
  };

  const saveNews = async (action: 'edit' | 'correct' = 'edit') => {
    if (!accessToken || !selectedId) return;
    setBusy(true); setError('');
    try {
      const result = rec(await newsApi.edit(accessToken, selectedId, {
        action, title: newsForm.title, slug: newsForm.slug, summary: newsForm.summary, body: newsForm.body,
        category: newsForm.category, article_kind: newsForm.article_kind, location: newsForm.location,
        topics: newsForm.topics.split(',').map(x => x.trim()).filter(Boolean),
        source_urls: newsForm.source_urls.split('\n').map(x => x.trim()).filter(Boolean),
        cover_image: newsForm.cover_image, seo_title: newsForm.seo_title, seo_description: newsForm.seo_description,
        og_image: newsForm.og_image, note: newsForm.note || undefined
      }));
      setNewsItems(prev => prev.map(x => str(x.id) === selectedId ? result : x));
      setSavedAt(new Date().toLocaleTimeString('id-ID'));
      await loadHistory(selectedId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menyimpan berita'); }
    finally { setBusy(false); }
  };

  const moderateNews = async (action: 'approve' | 'needs_revision' | 'reject' | 'retract') => {
    if (!accessToken || !selectedId) return;
    setBusy(true); setError('');
    try {
      await newsApi.moderate(accessToken, selectedId, {
        action,
        note: newsForm.note || undefined,
        publish_at: isoDate(newsForm.publish_at),
        fact_check_status: newsForm.fact_check_status,
        legal_review_status: newsForm.legal_review_status,
        editorial_priority: newsForm.editorial_priority,
        sensitivity: newsForm.sensitivity
      });
      await Promise.all([refreshNews(), loadHistory(selectedId)]);
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal menjalankan aksi editorial'); }
    finally { setBusy(false); }
  };

  const verifySource = async (source: R, status: 'verified' | 'broken' | 'rejected') => {
    if (!accessToken || !selectedId) return;
    setBusy(true); setError('');
    try {
      await newsApi.updateSource(accessToken, selectedId, str(source.id), { verification_status: status, note: newsForm.note || undefined });
      await loadHistory(selectedId);
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal memperbarui source'); }
    finally { setBusy(false); }
  };

  const moderateContent = async (item: R, action: string) => {
    if (!accessToken) return;
    setBusy(true); setError('');
    try {
      await moderationApi.moderate(accessToken, str(item.content_id), {
        action,
        reason_code: action === 'approve' ? 'approved_clean' : 'quality',
        reason_note: action === 'approve' ? 'Ditinjau oleh tim CMS.' : 'Ditinjau melalui CMS.',
        severity: str(item.severity, 'medium'),
        legal_hold: Boolean(item.legal_hold)
      });
      await refreshModeration();
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal moderasi'); }
    finally { setBusy(false); }
  };

  const searchCandidates = async () => {
    if (!accessToken || !user?.roles?.includes('super_admin') || teamQuery.trim().length < 2) return;
    setBusy(true); setError('');
    try { setCandidates(arr(await backofficeApi.candidates(accessToken, teamQuery.trim()))); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal mencari kandidat'); }
    finally { setBusy(false); }
  };

  const invite = async (candidate: R) => {
    if (!accessToken || !user?.roles?.includes('super_admin')) return;
    setBusy(true); setError('');
    try {
      await backofficeApi.invite(accessToken, {
        invitee_user_id: str(candidate.id), application: 'cms', role_names: [teamRole], expires_in_days: 7
      });
      await refreshTeam();
    } catch (e) { setError(e instanceof Error ? e.message : 'Gagal mengundang anggota'); }
    finally { setBusy(false); }
  };

  const revoke = async (id: string) => {
    if (!accessToken || !user?.roles?.includes('super_admin')) return;
    setBusy(true); setError('');
    try { await backofficeApi.revokeInvitation(accessToken, id); await refreshTeam(); }
    catch (e) { setError(e instanceof Error ? e.message : 'Gagal revoke invitation'); }
    finally { setBusy(false); }
  };

  if (authLoading) return <div className="min-h-screen grid place-items-center text-sm text-slate-600">Memuat CMS...</div>;
  if (!isAuthenticated) return null;

  const buckets = Array.isArray(newsMetrics.queue) ? newsMetrics.queue as R[] : [];
  const qcount = (key: string) => num(buckets.find(x => str(x.key) === key)?.value);
  const top = Array.isArray(newsMetrics.top_articles_7d) ? newsMetrics.top_articles_7d as R[] : [];
  const sources = rec(newsMetrics.sources);
  const engagement = Array.isArray(newsMetrics.engagement_24h) ? newsMetrics.engagement_24h as R[] : [];

  const nav: Array<[Workspace, string, string]> = [
    ['overview', 'Overview', 'Editorial & analytics'],
    ['news', 'News', String(qcount('pending_review')) + ' pending review'],
    ['moderation', 'Moderation', String(moderationItems.length) + ' antrean'],
    ['studio', 'Content Studio', 'Konten, sektor, banner'],
    ['team', 'Team & Access', user?.roles?.includes('super_admin') ? 'Kelola akses' : 'Super admin only']
  ];

  const input = 'mt-1 w-full rounded-xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-3 py-2.5 text-sm';
  const card = 'rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-5';

  return (
    <main className="min-h-screen bg-[color:var(--color-background)] text-[color:var(--color-text)]">
      <div className="mx-auto max-w-[1600px] px-4 py-4 md:px-6 lg:px-8">
        <header className="sticky top-3 z-30 rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-background)]/90 p-4 shadow-lg backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex items-center gap-3">
                <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[color:var(--color-primary)] text-lg font-black text-white">L</div>
                <div><div className="text-[11px] font-bold uppercase tracking-[0.3em] text-[color:var(--color-primary)]">LAJUKAN</div><h1 className="text-xl font-bold">CMS Control Center</h1></div>
              </div>
              <p className="mt-2 text-sm text-slate-500">Pusat editorial News, moderasi, content operations, analytics, dan akses tim.</p>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={() => void refreshAll()} disabled={busy} className="rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-sm font-semibold disabled:opacity-50">{busy ? 'Memproses...' : 'Refresh'}</button>
              <div className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-semibold">{user?.email}</div>
            </div>
          </div>
          <nav className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {nav.map(([id, label, desc]) => (
              <button key={id} onClick={() => setWorkspace(id)} className={id === workspace ? 'min-w-max rounded-2xl border border-[color:var(--color-primary)] bg-[color:var(--color-primary)] px-4 py-3 text-left text-white' : 'min-w-max rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-4 py-3 text-left hover:bg-slate-50'}>
                <div className="text-sm font-bold">{label}</div><div className={id === workspace ? 'text-[11px] text-white/75' : 'text-[11px] text-slate-500'}>{desc}</div>
              </button>
            ))}
          </nav>
        </header>

        {error ? <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700"><b>Ada error:</b> {error}</div> : null}

        {workspace === 'overview' ? (
          <section className="mt-6 space-y-6">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              {[
                ['Pending review', qcount('pending_review')], ['Needs revision', qcount('needs_revision')],
                ['Published 24 jam', num(newsMetrics.published_24h)], ['Terjadwal', num(newsMetrics.scheduled)],
                ['Stale >24 jam', num(newsMetrics.stale_review_24h)]
              ].map(([label, value]) => <article key={String(label)} className={card}><div className="text-xs font-semibold text-slate-500">{label}</div><div className="mt-3 text-3xl font-black">{value}</div></article>)}
            </div>
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <section className={card}>
                <div className="flex items-center justify-between gap-4"><div><h2 className="text-lg font-bold">Editorial health</h2><p className="text-sm text-slate-500">Sumber, review, publication cadence.</p></div><span className={'rounded-full border px-2.5 py-1 text-[11px] font-bold ' + statusClass(num(sources.flagged) ? 'high' : 'verified')}>{num(sources.flagged)} flagged source</span></div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  {[
                    ['Rata-rata review', num(newsMetrics.avg_review_minutes) ? Math.round(num(newsMetrics.avg_review_minutes)) + ' menit' : '-'],
                    ['Sources verified', num(sources.verified) + ' / ' + num(sources.total)],
                    ['Version history', num(newsMetrics.versions)],
                    ['Published 7 hari', num(newsMetrics.published_7d)]
                  ].map(([label, value]) => <div key={String(label)} className="rounded-2xl bg-slate-50 p-4"><div className="text-xs text-slate-500">{label}</div><div className="mt-1 text-xl font-bold">{value}</div></div>)}
                </div>
                <div className="mt-6"><h3 className="text-sm font-bold">Engagement 24 jam</h3><div className="mt-3 flex flex-wrap gap-2">{engagement.slice(0, 10).map(x => <div key={str(x.key)} className="rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-xs"><b>{str(x.key).replace('news.', '')}</b><span className="ml-2 text-slate-500">{num(x.value)}</span></div>)}</div></div>
              </section>
              <section className={card}>
                <h2 className="text-lg font-bold">Top News 7 hari</h2>
                <div className="mt-4 space-y-2">{top.map((x, i) => <button key={str(x.id)} onClick={() => { setWorkspace('news'); setNewsStatus('all'); selectNews(x); }} className="flex w-full items-center gap-3 rounded-2xl border border-[color:var(--color-border)] p-3 text-left hover:bg-slate-50"><div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-slate-100 text-xs font-black">{i + 1}</div><div className="min-w-0 flex-1"><div className="truncate text-sm font-bold">{str(x.title, 'Tanpa judul')}</div><div className="text-xs text-slate-500">{num(x.opens)} open</div></div></button>)}{!top.length ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada engagement.</div> : null}</div>
              </section>
            </div>
          </section>
        ) : null}

        {workspace === 'news' ? (
          <section className="mt-6 grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
            <aside className="space-y-3">
              <div className={card}>
                <div className="flex items-center justify-between gap-3"><div><h2 className="font-bold">Editorial queue</h2><p className="text-xs text-slate-500">Review sampai retract.</p></div><select value={newsStatus} onChange={e => setNewsStatus(e.target.value)} className="rounded-xl border border-[color:var(--color-border)] px-2.5 py-2 text-xs"><option value="pending_review">Review</option><option value="needs_revision">Revisi</option><option value="published">Published</option><option value="rejected">Rejected</option><option value="retracted">Retracted</option><option value="all">Semua</option></select></div>
              </div>
              {newsItems.map(item => <button key={str(item.id)} onClick={() => selectNews(item)} className={str(item.id) === selectedId ? 'w-full rounded-2xl border border-[color:var(--color-primary)] bg-[color:var(--color-surface)] p-4 text-left shadow-md' : 'w-full rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] p-4 text-left hover:bg-slate-50'}><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="line-clamp-2 text-sm font-bold">{str(item.title, 'Tanpa judul')}</div><div className="mt-1 text-xs text-slate-500">{dateLabel(item.updated_at)}</div></div><span className={'shrink-0 rounded-full border px-2 py-1 text-[10px] font-bold ' + statusClass(statusOf(item))}>{statusOf(item)}</span></div></button>)}
              {!newsItems.length ? <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] p-6 text-sm text-slate-500">Antrean kosong.</div> : null}
            </aside>

            <div className="space-y-6">
              {selectedNews ? <>
                <div className={card}>
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div><div className="flex items-center gap-2"><span className={'rounded-full border px-2.5 py-1 text-[10px] font-bold ' + statusClass(statusOf(selectedNews))}>{statusOf(selectedNews)}</span><span className="text-xs text-slate-500">{dateLabel(selectedNews.updated_at)}</span></div><h2 className="mt-3 text-2xl font-black">Editorial workspace</h2><div className="text-sm text-slate-500">{savedAt ? 'Tersimpan ' + savedAt : 'Versioning + audit aktif.'}</div></div>
                    <div className="flex flex-wrap gap-2">
                      <button disabled={busy} onClick={() => void saveNews(statusOf(selectedNews) === 'published' ? 'correct' : 'edit')} className="rounded-xl bg-[color:var(--color-primary)] px-4 py-2 text-sm font-bold text-white disabled:opacity-50">{statusOf(selectedNews) === 'published' ? 'Simpan koreksi' : 'Simpan'}</button>
                      {statusOf(selectedNews) !== 'published' ? <><button disabled={busy} onClick={() => void moderateNews('needs_revision')} className="rounded-xl border border-amber-300 px-4 py-2 text-sm font-bold text-amber-700">Minta revisi</button><button disabled={busy} onClick={() => void moderateNews('reject')} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-bold text-rose-700">Tolak</button><button disabled={busy} onClick={() => void moderateNews('approve')} className="rounded-xl border border-emerald-300 px-4 py-2 text-sm font-bold text-emerald-700">Publish / Schedule</button></> : <><button disabled={busy} onClick={() => void saveNews('correct')} className="rounded-xl border border-sky-300 px-4 py-2 text-sm font-bold text-sky-700">Simpan koreksi</button><button disabled={busy} onClick={() => void moderateNews('retract')} className="rounded-xl border border-rose-300 px-4 py-2 text-sm font-bold text-rose-700">Tarik</button></>}
                    </div>
                  </div>
                </div>

                <div className="grid gap-6 2xl:grid-cols-[1.15fr_0.85fr]">
                  <div className={card}>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="md:col-span-2"><span className="text-xs font-semibold text-slate-500">Judul</span><input value={newsForm.title} onChange={e => setNewsForm(p => ({ ...p, title: e.target.value }))} className={input} /></label>
                      <label><span className="text-xs font-semibold text-slate-500">Slug</span><input value={newsForm.slug} onChange={e => setNewsForm(p => ({ ...p, slug: e.target.value }))} className={input} /></label>
                      <label><span className="text-xs font-semibold text-slate-500">Lokasi</span><input value={newsForm.location} onChange={e => setNewsForm(p => ({ ...p, location: e.target.value }))} className={input} /></label>
                      <label><span className="text-xs font-semibold text-slate-500">Kategori</span><select value={newsForm.category} onChange={e => setNewsForm(p => ({ ...p, category: e.target.value }))} className={input}>{CATEGORIES.map(x => <option key={x}>{x}</option>)}</select></label>
                      <label><span className="text-xs font-semibold text-slate-500">Jenis</span><select value={newsForm.article_kind} onChange={e => setNewsForm(p => ({ ...p, article_kind: e.target.value }))} className={input}>{KINDS.map(x => <option key={x[0]} value={x[0]}>{x[1]}</option>)}</select></label>
                      <label className="md:col-span-2"><span className="text-xs font-semibold text-slate-500">Ringkasan</span><textarea value={newsForm.summary} onChange={e => setNewsForm(p => ({ ...p, summary: e.target.value }))} rows={3} className={input} /></label>
                      <label className="md:col-span-2"><span className="text-xs font-semibold text-slate-500">Isi berita</span><textarea value={newsForm.body} onChange={e => setNewsForm(p => ({ ...p, body: e.target.value }))} rows={16} className={input + ' leading-6'} /></label>
                      <label className="md:col-span-2"><span className="text-xs font-semibold text-slate-500">Topics, pisahkan dengan koma</span><input value={newsForm.topics} onChange={e => setNewsForm(p => ({ ...p, topics: e.target.value }))} className={input} /></label>
                      <label className="md:col-span-2"><span className="text-xs font-semibold text-slate-500">Source URLs, satu per baris</span><textarea value={newsForm.source_urls} onChange={e => setNewsForm(p => ({ ...p, source_urls: e.target.value }))} rows={4} className={input} /></label>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <section className={card}><div className="flex items-start justify-between gap-3"><div><h3 className="font-bold">Media</h3><p className="text-xs text-slate-500">Upload langsung ke storage resmi Lajukan atau gunakan media path yang sudah ada.</p></div><label className="inline-flex cursor-pointer items-center rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-xs font-bold hover:bg-slate-50"><input type="file" accept="image/*" className="sr-only" disabled={uploadingCover} onChange={uploadCover} />{uploadingCover ? 'Mengunggah...' : 'Upload gambar'}</label></div><label className="mt-3 block"><span className="text-xs font-semibold text-slate-500">Cover URL / media path</span><input value={newsForm.cover_image} onChange={e => setNewsForm(p => ({ ...p, cover_image: e.target.value }))} placeholder="/api/content/media/..." className={input} /></label>{newsForm.cover_image ? <div className="mt-3 overflow-hidden rounded-2xl border border-[color:var(--color-border)]"><img src={newsForm.cover_image} alt={newsForm.title} className="aspect-video w-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /><button type="button" onClick={() => setNewsForm(p => ({ ...p, cover_image: '' }))} className="w-full border-t border-[color:var(--color-border)] px-3 py-2 text-left text-xs font-bold text-rose-600">Hapus cover</button></div> : <div className="mt-3 grid aspect-video place-items-center rounded-2xl bg-slate-100 text-xs text-slate-500">Belum ada cover</div>}</section>
                    <section className={card}><h3 className="font-bold">SEO & social</h3><label className="mt-3 block"><span className="text-xs font-semibold text-slate-500">SEO title</span><input value={newsForm.seo_title} onChange={e => setNewsForm(p => ({ ...p, seo_title: e.target.value }))} className={input} /></label><label className="mt-3 block"><span className="text-xs font-semibold text-slate-500">Meta description</span><textarea value={newsForm.seo_description} onChange={e => setNewsForm(p => ({ ...p, seo_description: e.target.value }))} rows={4} className={input} /></label><label className="mt-3 block"><span className="text-xs font-semibold text-slate-500">OG image</span><input value={newsForm.og_image} onChange={e => setNewsForm(p => ({ ...p, og_image: e.target.value }))} className={input} /></label></section>
                    <section className={card}><h3 className="font-bold">Publish controls</h3><div className="grid gap-3 md:grid-cols-2"><label><span className="text-xs font-semibold text-slate-500">Publish at</span><input type="datetime-local" value={newsForm.publish_at} onChange={e => setNewsForm(p => ({ ...p, publish_at: e.target.value }))} className={input} /></label><label><span className="text-xs font-semibold text-slate-500">Fact check</span><select value={newsForm.fact_check_status} onChange={e => setNewsForm(p => ({ ...p, fact_check_status: e.target.value }))} className={input}><option value="pending">Pending</option><option value="verified">Verified</option><option value="not_required">Tidak perlu</option></select></label><label><span className="text-xs font-semibold text-slate-500">Legal</span><select value={newsForm.legal_review_status} onChange={e => setNewsForm(p => ({ ...p, legal_review_status: e.target.value }))} className={input}><option value="not_required">Tidak perlu</option><option value="pending">Pending</option><option value="approved">Approved</option></select></label><label><span className="text-xs font-semibold text-slate-500">Priority</span><select value={newsForm.editorial_priority} onChange={e => setNewsForm(p => ({ ...p, editorial_priority: e.target.value }))} className={input}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option><option value="urgent">Urgent</option></select></label><label className="md:col-span-2"><span className="text-xs font-semibold text-slate-500">Sensitivity</span><select value={newsForm.sensitivity} onChange={e => setNewsForm(p => ({ ...p, sensitivity: e.target.value }))} className={input}><option value="normal">Normal</option><option value="high">High</option></select></label></div><label className="mt-3 block"><span className="text-xs font-semibold text-slate-500">Catatan editor</span><textarea value={newsForm.note} onChange={e => setNewsForm(p => ({ ...p, note: e.target.value }))} rows={4} className={input} /></label></section>
                  </div>
                </div>

                <div className="grid gap-6 xl:grid-cols-2">
                  <section className={card}><h3 className="font-bold">Sources</h3><p className="mt-1 text-xs text-slate-500">Approval membutuhkan source verified untuk News/Analysis.</p><div className="mt-4 space-y-3">{arr(newsHistory.sources).map(source => <div key={str(source.id)} className="rounded-2xl border border-[color:var(--color-border)] p-3"><div className="break-all text-xs font-semibold">{str(source.source_url)}</div><div className="mt-2 flex flex-wrap items-center justify-between gap-2"><span className={'rounded-full border px-2 py-1 text-[10px] font-bold ' + statusClass(str(source.verification_status, 'unverified'))}>{str(source.verification_status)}</span><div className="flex gap-2"><button disabled={busy} onClick={() => void verifySource(source, 'verified')} className="rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11px] font-bold text-emerald-700">Verify</button><button disabled={busy} onClick={() => void verifySource(source, 'broken')} className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-[11px] font-bold text-amber-700">Broken</button><button disabled={busy} onClick={() => void verifySource(source, 'rejected')} className="rounded-lg bg-rose-50 px-2.5 py-1.5 text-[11px] font-bold text-rose-700">Reject</button></div></div>{str(source.editor_note) ? <div className="mt-2 text-xs text-slate-500">{str(source.editor_note)}</div> : null}</div>)}{!arr(newsHistory.sources).length ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada source.</div> : null}</div></section>
                  <section className={card}><h3 className="font-bold">Version & audit</h3><div className="mt-4 max-h-[420px] space-y-3 overflow-auto">{arr(newsHistory.versions).map(version => <div key={str(version.id)} className="rounded-2xl border border-[color:var(--color-border)] p-3"><div className="flex items-center justify-between gap-3"><b className="text-sm">v{str(version.version_number)}</b><span className="text-[11px] text-slate-500">{dateLabel(version.created_at)}</span></div><div className="mt-1 text-xs text-slate-500">{str(version.action)} · {str(version.actor_role)}</div><div className="mt-2 text-sm">{str(version.title)}</div></div>)}{!arr(newsHistory.versions).length ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada version history.</div> : null}</div></section>
                </div>

                <section className={card}><h3 className="font-bold">Live preview</h3><div className="mt-4 overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-white">{newsForm.cover_image ? <img src={newsForm.cover_image} alt="" className="h-64 w-full object-cover" onError={e => { e.currentTarget.style.display = 'none'; }} /> : null}<div className="p-6"><div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">{newsForm.category}</div><h3 className="mt-2 text-3xl font-black">{newsForm.title || 'Judul berita'}</h3><p className="mt-3 text-base leading-7 text-slate-600">{newsForm.summary || 'Ringkasan berita.'}</p><div className="mt-5 whitespace-pre-wrap text-sm leading-7 text-slate-800">{newsForm.body || 'Isi berita.'}</div></div></div></section>
              </> : <div className="rounded-3xl border border-dashed border-[color:var(--color-border)] p-10 text-center text-sm text-slate-500">Pilih berita dari antrean.</div>}
            </div>
          </section>
        ) : null}

        {workspace === 'moderation' ? (
          <section className="mt-6 space-y-5">
            <div className={card}><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-bold">Moderation Center</h2><p className="text-sm text-slate-500">Reports, severity, visibility, dan audit.</p></div><select value={moderationStatus} onChange={e => setModerationStatus(e.target.value)} className="rounded-xl border border-[color:var(--color-border)] px-3 py-2 text-sm"><option value="open">Open</option><option value="reviewing">Reviewing</option><option value="escalated">Escalated</option><option value="resolved">Resolved</option><option value="appealed">Appealed</option></select></div></div>
            <div className="grid gap-4 xl:grid-cols-2">
              {moderationItems.map(item => <article key={str(item.case_id)} className={card}><div className="flex items-start justify-between gap-3"><div><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{str(rec(item.content).content_type)}</div><h3 className="mt-1 text-lg font-bold">{str(rec(item.content).title, 'Konten tanpa judul')}</h3></div><span className={'rounded-full border px-2.5 py-1 text-[10px] font-bold ' + statusClass(str(item.severity, 'medium'))}>{str(item.severity, 'medium')}</span></div><div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-500"><div>Status: <b className="text-slate-700">{str(item.case_status)}</b></div><div>Reason: <b className="text-slate-700">{str(item.current_reason_code, '-')}</b></div><div>Source: <b className="text-slate-700">{str(item.source, '-')}</b></div><div>Reports: <b className="text-slate-700">{Array.isArray(item.reports) ? item.reports.length : 0}</b></div></div><div className="mt-4 flex flex-wrap gap-2"><button disabled={busy} onClick={() => void moderateContent(item, 'approve')} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">Approve</button><button disabled={busy} onClick={() => void moderateContent(item, 'needs_revision')} className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700">Need revision</button><button disabled={busy} onClick={() => void moderateContent(item, 'restrict')} className="rounded-xl bg-sky-50 px-3 py-2 text-xs font-bold text-sky-700">Restrict</button><button disabled={busy} onClick={() => void moderateContent(item, 'remove')} className="rounded-xl bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">Remove</button><button disabled={busy} onClick={() => void moderateContent(item, 'escalate')} className="rounded-xl bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700">Escalate</button></div>{Array.isArray(item.reports) && item.reports.length ? <details className="mt-4"><summary className="cursor-pointer text-xs font-semibold">Lihat laporan ({item.reports.length})</summary><div className="mt-2 space-y-2">{item.reports.slice(0, 5).map((r: R) => <div key={str(r.id)} className="rounded-xl bg-slate-50 p-3 text-xs"><b>{str(r.reason_code)}</b><div className="mt-1 text-slate-500">{str(r.details, 'Tanpa detail')}</div></div>)}</div></details> : null}</article>)}
            </div>
            {!moderationItems.length ? <div className="rounded-3xl border border-dashed border-[color:var(--color-border)] p-10 text-center text-sm text-slate-500">Tidak ada antrean.</div> : null}
          </section>
        ) : null}

        {workspace === 'studio' ? <section className="mt-6 overflow-hidden rounded-3xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)]"><CmsDashboard /></section> : null}

        {workspace === 'team' ? (
          <section className="mt-6 space-y-5">
            {!user?.roles?.includes('super_admin') ? <div className="rounded-3xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-800"><b>Super admin only.</b><div className="mt-1">Akses Team & Access mengikuti Identity Service.</div></div> : <>
              <div className="grid gap-6 xl:grid-cols-2">
                <section className={card}><h2 className="text-lg font-bold">Undang anggota CMS</h2><p className="mt-1 text-sm text-slate-500">Cari akun yang sudah terverifikasi, lalu kirim invitation.</p><div className="mt-4 flex gap-2"><input value={teamQuery} onChange={e => setTeamQuery(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') void searchCandidates(); }} placeholder="email / nama / username" className="min-w-0 flex-1 rounded-xl border border-[color:var(--color-border)] px-3 py-2.5 text-sm" /><button disabled={busy || teamQuery.trim().length < 2} onClick={() => void searchCandidates()} className="rounded-xl bg-[color:var(--color-primary)] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">Cari</button></div><label className="mt-3 block text-xs font-semibold text-slate-500">Role<select value={teamRole} onChange={e => setTeamRole(e.target.value)} className={input}><option value="content_admin">Content Admin</option><option value="admin">Admin</option></select></label><div className="mt-4 space-y-2">{candidates.map(c => <div key={str(c.id)} className="rounded-2xl border border-[color:var(--color-border)] p-3"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-bold">{str(c.email)}</div><div className="text-xs text-slate-500">{str(c.full_name) || str(c.username) || 'Tanpa nama'}</div></div><button disabled={busy || c.eligible === false} onClick={() => void invite(c)} className="rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700 disabled:opacity-50">Undang</button></div>{c.eligible === false ? <div className="mt-2 text-[11px] text-rose-600">Belum eligible.</div> : null}</div>)}</div></section>
                <section className={card}><h2 className="text-lg font-bold">Invitation & access</h2><p className="mt-1 text-sm text-slate-500">Dikelola oleh Identity Service, bukan role hard-coded CMS.</p><div className="mt-4 space-y-2">{invitations.map(i => <div key={str(i.id)} className="rounded-2xl border border-[color:var(--color-border)] p-3"><div className="flex items-center justify-between gap-3"><div><div className="text-sm font-bold">{str(i.email)}</div><div className="text-xs text-slate-500">{Array.isArray(i.role_names) ? i.role_names.join(', ') : str(i.role_names)}</div></div><span className={'rounded-full border px-2 py-1 text-[10px] font-bold ' + statusClass(str(i.status))}>{str(i.status)}</span></div><div className="mt-2 flex items-center justify-between text-[11px] text-slate-500"><span>Exp {dateLabel(i.expires_at)}</span>{str(i.status) === 'pending' ? <button onClick={() => void revoke(str(i.id))} className="font-bold text-rose-600">Revoke</button> : null}</div></div>)}{!invitations.length ? <div className="rounded-2xl bg-slate-50 p-4 text-sm text-slate-500">Belum ada invitation.</div> : null}</div></section>
              </div>
              <section className={card}><h3 className="font-bold">Permission model</h3><div className="mt-4 grid gap-3 md:grid-cols-3">{[['Super admin', 'Team, roles, publish, moderation, settings'], ['Admin', 'Operational CMS + moderation sesuai permission'], ['Content admin', 'Editorial, content, banner, taxonomy']].map(([a,b]) => <div key={a} className="rounded-2xl bg-slate-50 p-4"><div className="text-sm font-bold">{a}</div><div className="mt-1 text-xs leading-5 text-slate-500">{b}</div></div>)}</div></section>
            </>}
          </section>
        ) : null}
      </div>
    </main>
  );
}
