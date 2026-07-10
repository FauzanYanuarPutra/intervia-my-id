'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Archive,
  BookOpen,
  CheckCircle2,
  ClipboardList,
  Layers3,
  Loader2,
  PencilLine,
  Plus,
  Save,
  Video,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';

type LearningCourse = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  status: string;
  visibility?: string | null;
  primary_format: string;
  level: string;
  category: string;
  thumbnail_url?: string | null;
  trailer_url?: string | null;
  estimated_minutes?: number | null;
  price_cents?: number | null;
  currency?: string | null;
  tags?: string[] | null;
  updated_at?: string;
};

type LearningModule = {
  id: string;
  title: string;
  position: number;
};

type LearningLesson = {
  id: string;
  module_id: string;
  title: string;
  lesson_type: string;
  content_ref?: string | null;
  duration_seconds: number;
  is_preview: boolean;
  position: number;
};

type CourseDetail = {
  course: LearningCourse;
  modules: LearningModule[];
  lessons: LearningLesson[];
};

type CourseFormState = {
  title: string;
  summary: string;
  description: string;
  category: string;
  primary_format: string;
  level: string;
  estimated_minutes: string;
  price_idr: string;
  thumbnail_url: string;
  trailer_url: string;
  tags: string;
  visibility: string;
  status: string;
};

type LessonFormState = {
  module_title: string;
  lesson_title: string;
  lesson_type: string;
  content_ref: string;
  duration_minutes: string;
  is_preview: boolean;
};

type Props = {
  locale: string;
};

const EMPTY_COURSE_FORM: CourseFormState = {
  title: '',
  summary: '',
  description: '',
  category: 'business',
  primary_format: 'course',
  level: 'beginner',
  estimated_minutes: '20',
  price_idr: '0',
  thumbnail_url: '',
  trailer_url: '',
  tags: '',
  visibility: 'public',
  status: 'draft',
};

const EMPTY_LESSON_FORM: LessonFormState = {
  module_title: 'Mulai di sini',
  lesson_title: '',
  lesson_type: 'reading',
  content_ref: '',
  duration_minutes: '5',
  is_preview: true,
};

const FORMAT_OPTIONS = [
  { value: 'course', labelId: 'Kelas bertahap', labelEn: 'Structured course' },
  { value: 'video', labelId: 'Video singkat', labelEn: 'Short video' },
  { value: 'reading', labelId: 'Bacaan', labelEn: 'Reading' },
  { value: 'mixed', labelId: 'Campuran', labelEn: 'Mixed' },
];

const LEVEL_OPTIONS = [
  { value: 'beginner', labelId: 'Pemula', labelEn: 'Beginner' },
  { value: 'intermediate', labelId: 'Menengah', labelEn: 'Intermediate' },
  { value: 'advanced', labelId: 'Lanjutan', labelEn: 'Advanced' },
];

const STATUS_OPTIONS = [
  { value: 'draft', labelId: 'Draft', labelEn: 'Draft' },
  { value: 'published', labelId: 'Tayang', labelEn: 'Published' },
];

function inputClass(extra = '') {
  return `mt-1 min-h-11 w-full rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] px-3 text-sm text-[color:var(--app-text)] outline-none transition focus:border-[color:var(--app-accent)] ${extra}`;
}

function tagsFromInput(value: string): string[] {
  return value
    .split(',')
    .map(tag => tag.trim().toLowerCase())
    .filter(Boolean)
    .slice(0, 12);
}

function idrToCents(value: string): number {
  const amount = Number.parseInt(value.replace(/\D/g, ''), 10);
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  return amount * 100;
}

function centsToIdr(value: number | null | undefined): string {
  if (!value || value <= 0) return '0';
  return String(Math.floor(value / 100));
}

function minutesToSeconds(value: string): number {
  const minutes = Number.parseInt(value.replace(/\D/g, ''), 10);
  if (!Number.isFinite(minutes) || minutes <= 0) return 0;
  return minutes * 60;
}

function courseToForm(course: LearningCourse): CourseFormState {
  return {
    title: course.title || '',
    summary: course.summary || '',
    description: course.description || '',
    category: course.category || 'business',
    primary_format: course.primary_format || 'course',
    level: course.level || 'beginner',
    estimated_minutes: String(course.estimated_minutes || 20),
    price_idr: centsToIdr(course.price_cents),
    thumbnail_url: course.thumbnail_url || '',
    trailer_url: course.trailer_url || '',
    tags: (course.tags || []).join(', '),
    visibility: course.visibility || 'public',
    status: course.status === 'published' ? 'published' : 'draft',
  };
}

function formatCourseMeta(course: LearningCourse, isId: boolean) {
  const format =
    FORMAT_OPTIONS.find(item => item.value === course.primary_format) ||
    FORMAT_OPTIONS[0];
  const level =
    LEVEL_OPTIONS.find(item => item.value === course.level) || LEVEL_OPTIONS[0];
  return `${isId ? format.labelId : format.labelEn} - ${isId ? level.labelId : level.labelEn
    } - ${course.status}`;
}

export function LearnCreatorStudio({ locale }: Props) {
  const isId = locale === 'id';
  const { user, loading, authFetch } = useAuth();
  const [courses, setCourses] = useState<LearningCourse[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [editingCourseId, setEditingCourseId] = useState<string>('');
  const [courseForm, setCourseForm] =
    useState<CourseFormState>(EMPTY_COURSE_FORM);
  const [lessonForm, setLessonForm] =
    useState<LessonFormState>(EMPTY_LESSON_FORM);
  const [detail, setDetail] = useState<CourseDetail | null>(null);
  const [status, setStatus] = useState<
    'idle' | 'loading' | 'saving' | 'error' | 'saved'
  >('idle');
  const [message, setMessage] = useState('');

  const selectedCourse = useMemo(
    () => courses.find(course => course.id === selectedCourseId) || null,
    [courses, selectedCourseId],
  );
  const activeCourseForLessons = selectedCourse || detail?.course || null;
  const isEditing = Boolean(editingCourseId);

  const updateCourseForm = (key: keyof CourseFormState, value: string) => {
    setCourseForm(current => ({ ...current, [key]: value }));
  };
  const updateLessonForm = <K extends keyof LessonFormState>(
    key: K,
    value: LessonFormState[K],
  ) => {
    setLessonForm(current => ({ ...current, [key]: value }));
  };

  const loadCourses = async () => {
    if (!user) return;
    setStatus(current => (current === 'saving' ? current : 'loading'));
    try {
      const res = await authFetch('/api/learning/courses?mine=true&limit=24');
      if (!res.ok) throw new Error('load_failed');
      const payload = await res.json();
      const nextCourses = Array.isArray(payload.items) ? payload.items : [];
      setCourses(nextCourses);
      setSelectedCourseId(current => current || nextCourses[0]?.id || '');
      setStatus(current => (current === 'loading' ? 'idle' : current));
    } catch {
      setStatus('error');
      setMessage(isId ? 'Gagal memuat kelas saya.' : 'Could not load courses.');
    }
  };

  useEffect(() => {
    if (loading || !user) return;
    void loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, user]);

  useEffect(() => {
    if (!selectedCourseId || !user) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    authFetch(`/api/learning/courses/${selectedCourseId}`)
      .then(async res => {
        if (!res.ok) throw new Error('detail_failed');
        return res.json();
      })
      .then(payload => {
        if (!cancelled) setDetail(payload as CourseDetail);
      })
      .catch(() => {
        if (!cancelled) setDetail(null);
      });
    return () => {
      cancelled = true;
    };
  }, [authFetch, selectedCourseId, user]);

  function resetCreateMode() {
    setEditingCourseId('');
    setCourseForm(EMPTY_COURSE_FORM);
  }

  function startEdit(course: LearningCourse) {
    setEditingCourseId(course.id);
    setSelectedCourseId(course.id);
    setCourseForm(courseToForm(course));
    setMessage('');
  }

  async function handleCourseSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;

    const body = {
      title: courseForm.title,
      summary: courseForm.summary,
      description: courseForm.description,
      category: courseForm.category || 'business',
      primary_format: courseForm.primary_format,
      level: courseForm.level,
      estimated_minutes:
        Number.parseInt(courseForm.estimated_minutes.replace(/\D/g, ''), 10) ||
        0,
      price_cents: idrToCents(courseForm.price_idr),
      currency: 'IDR',
      thumbnail_url: courseForm.thumbnail_url,
      trailer_url: courseForm.trailer_url,
      tags: tagsFromInput(courseForm.tags),
      visibility: courseForm.visibility,
      status: courseForm.status,
      metadata: {
        source: 'learn_creator_studio',
        edit_mode: isEditing ? 'update' : 'create',
      },
    };

    setStatus('saving');
    setMessage('');
    const endpoint = isEditing
      ? `/api/learning/courses/${editingCourseId}`
      : '/api/learning/courses';
    const method = isEditing ? 'PATCH' : 'POST';
    const res = await authFetch(endpoint, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus('error');
      setMessage(
        payload.error ||
        (isId ? 'Materi gagal disimpan.' : 'Could not save content.'),
      );
      return;
    }

    const course = payload.course as LearningCourse;
    setCourses(current =>
      [course, ...current.filter(item => item.id !== course.id)].slice(0, 24),
    );
    setSelectedCourseId(course.id);
    setEditingCourseId(course.id);
    setCourseForm(courseToForm(course));
    setStatus('saved');
    setMessage(
      isEditing
        ? isId
          ? 'Materi diperbarui.'
          : 'Content updated.'
        : isId
          ? 'Materi tersimpan. Tambahkan lesson di panel kanan.'
          : 'Content saved. Add lessons in the right panel.',
    );
    trackLajukanEvent(
      isEditing ? 'learning.course_updated' : 'learning.course_created',
      {
        entityType: 'learning_course',
        entityId: course.id,
        properties: { format: course.primary_format, status: course.status },
      },
    );
  }

  async function handleLessonCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeCourseForLessons) return;
    const body = {
      module_title: lessonForm.module_title || 'Mulai di sini',
      title: lessonForm.lesson_title,
      lesson_type: lessonForm.lesson_type,
      content_ref: lessonForm.content_ref,
      duration_seconds: minutesToSeconds(lessonForm.duration_minutes),
      is_preview: lessonForm.is_preview,
    };
    setStatus('saving');
    const res = await authFetch(
      `/api/learning/courses/${activeCourseForLessons.id}/lessons`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      },
    );
    if (!res.ok) {
      setStatus('error');
      setMessage(isId ? 'Materi gagal ditambahkan.' : 'Could not add lesson.');
      return;
    }
    setStatus('saved');
    setMessage(isId ? 'Lesson ditambahkan.' : 'Lesson added.');
    setLessonForm(EMPTY_LESSON_FORM);
    const detailRes = await authFetch(
      `/api/learning/courses/${activeCourseForLessons.id}`,
    );
    if (detailRes.ok) setDetail((await detailRes.json()) as CourseDetail);
  }

  async function updateStatus(
    course: LearningCourse,
    nextStatus: 'draft' | 'published' | 'archived',
  ) {
    setStatus('saving');
    const res = await authFetch(`/api/learning/courses/${course.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus }),
    });
    const payload = await res.json().catch(() => ({}));
    if (!res.ok) {
      setStatus('error');
      setMessage(
        payload.error ||
        (isId ? 'Status gagal diubah.' : 'Could not update status.'),
      );
      return;
    }
    const updated = payload.course as LearningCourse;
    setCourses(current =>
      current
        .map(item => (item.id === updated.id ? updated : item))
        .filter(item => item.status !== 'archived'),
    );
    if (nextStatus === 'archived') {
      if (selectedCourseId === course.id) setSelectedCourseId('');
      if (editingCourseId === course.id) resetCreateMode();
    }
    setStatus('saved');
    setMessage(
      nextStatus === 'published'
        ? isId
          ? 'Materi sudah tayang.'
          : 'Content is live.'
        : nextStatus === 'archived'
          ? isId
            ? 'Materi diarsipkan.'
            : 'Content archived.'
          : isId
            ? 'Materi kembali jadi draft.'
            : 'Content moved to draft.',
    );
  }

  if (!loading && !user) {
    return (
      <section
        id="creator-studio"
        className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-5 shadow-sm"
      >
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <p className="text-base font-bold text-[color:var(--app-text)]">
              {isId ? 'Punya ilmu usaha?' : 'Have business knowledge?'}
            </p>
            <p className="mt-1 max-w-2xl text-sm text-[color:var(--app-text-soft)]">
              {isId
                ? 'Login untuk bikin video, bacaan, kelas bertahap, dan mengelola materi sendiri.'
                : 'Log in to create videos, readings, structured courses, and manage your own content.'}
            </p>
          </div>
          <Link
            href="/login"
            className="ui-button-primary inline-flex h-11 items-center px-4 text-sm"
          >
            {isId ? 'Login dan buat' : 'Log in to create'}
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section
      id="creator-studio"
      className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]"
    >
      <form
        onSubmit={handleCourseSave}
        className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm sm:p-5"
      >
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="inline-flex items-center gap-2 rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-[11px] font-bold uppercase text-[color:var(--app-accent)]">
              <PencilLine className="h-3.5 w-3.5" />
              Creator Studio
            </p>
            <h2 className="mt-3 text-xl font-bold text-[color:var(--app-text)]">
              {isEditing
                ? isId
                  ? 'Edit materi belajar'
                  : 'Edit learning content'
                : isId
                  ? 'Buat materi belajar'
                  : 'Create learning content'}
            </h2>
            <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
              {isId
                ? 'Buat video pendek, bacaan praktis, atau kelas bertahap dari satu form.'
                : 'Create short videos, practical readings, or structured courses from one form.'}
            </p>
          </div>
          {isEditing ? (
            <button
              type="button"
              onClick={resetCreateMode}
              className="ui-button-secondary inline-flex h-10 items-center px-3 text-xs"
            >
              <Plus className="h-4 w-4" />
              {isId ? 'Buat baru' : 'New'}
            </button>
          ) : null}
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2">
          <label className="sm:col-span-2">
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Judul' : 'Title'}
            </span>
            <input
              value={courseForm.title}
              onChange={event => updateCourseForm('title', event.target.value)}
              required
              maxLength={160}
              placeholder={
                isId
                  ? 'Contoh: Packaging murah terlihat premium'
                  : 'Example: Affordable packaging that looks premium'
              }
              className={inputClass()}
            />
          </label>

          <label>
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Format' : 'Format'}
            </span>
            <select
              value={courseForm.primary_format}
              onChange={event =>
                updateCourseForm('primary_format', event.target.value)
              }
              className={inputClass()}
            >
              {FORMAT_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {isId ? option.labelId : option.labelEn}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Level' : 'Level'}
            </span>
            <select
              value={courseForm.level}
              onChange={event => updateCourseForm('level', event.target.value)}
              className={inputClass()}
            >
              {LEVEL_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {isId ? option.labelId : option.labelEn}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Kategori' : 'Category'}
            </span>
            <input
              value={courseForm.category}
              onChange={event =>
                updateCourseForm('category', event.target.value)
              }
              placeholder={isId ? 'marketing, operasional' : 'marketing, ops'}
              className={inputClass()}
            />
          </label>

          <label>
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Estimasi menit' : 'Estimated minutes'}
            </span>
            <input
              value={courseForm.estimated_minutes}
              onChange={event =>
                updateCourseForm('estimated_minutes', event.target.value)
              }
              inputMode="numeric"
              className={inputClass()}
            />
          </label>

          <label className="sm:col-span-2">
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Ringkasan' : 'Summary'}
            </span>
            <textarea
              value={courseForm.summary}
              onChange={event =>
                updateCourseForm('summary', event.target.value)
              }
              rows={3}
              maxLength={500}
              placeholder={
                isId
                  ? 'Jelaskan manfaat materi dalam 1-2 kalimat.'
                  : 'Explain the outcome in 1-2 sentences.'
              }
              className={inputClass('py-2')}
            />
          </label>

          <label className="sm:col-span-2">
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId
                ? 'Isi bacaan / deskripsi kelas'
                : 'Reading body / course description'}
            </span>
            <textarea
              value={courseForm.description}
              onChange={event =>
                updateCourseForm('description', event.target.value)
              }
              rows={5}
              placeholder={
                isId
                  ? 'Kalau format bacaan, tulis isi materinya di sini. Kalau format video/kelas, tulis outline dan hasil akhir.'
                  : 'For readings, write the content here. For videos/courses, write the outline and outcome.'
              }
              className={inputClass('py-2')}
            />
          </label>

          <label>
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Harga IDR' : 'Price IDR'}
            </span>
            <input
              value={courseForm.price_idr}
              onChange={event =>
                updateCourseForm('price_idr', event.target.value)
              }
              inputMode="numeric"
              placeholder="0"
              className={inputClass()}
            />
          </label>

          <label>
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Status' : 'Status'}
            </span>
            <select
              value={courseForm.status}
              onChange={event => updateCourseForm('status', event.target.value)}
              className={inputClass()}
            >
              {STATUS_OPTIONS.map(option => (
                <option key={option.value} value={option.value}>
                  {isId ? option.labelId : option.labelEn}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              Thumbnail URL
            </span>
            <input
              value={courseForm.thumbnail_url}
              onChange={event =>
                updateCourseForm('thumbnail_url', event.target.value)
              }
              placeholder="https://..."
              className={inputClass()}
            />
          </label>

          <label>
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              {isId ? 'Video / resource URL' : 'Video / resource URL'}
            </span>
            <input
              value={courseForm.trailer_url}
              onChange={event =>
                updateCourseForm('trailer_url', event.target.value)
              }
              placeholder="https://youtube.com/..."
              className={inputClass()}
            />
          </label>

          <label className="sm:col-span-2">
            <span className="text-xs font-bold text-[color:var(--app-text)]">
              Tags
            </span>
            <input
              value={courseForm.tags}
              onChange={event => updateCourseForm('tags', event.target.value)}
              placeholder={
                isId
                  ? 'packaging, reseller, murah'
                  : 'packaging, reseller, affordable'
              }
              className={inputClass()}
            />
          </label>
        </div>

        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <p
            className={
              status === 'error'
                ? 'text-xs font-semibold text-[color:var(--app-warning)]'
                : 'text-xs text-[color:var(--app-text-soft)]'
            }
          >
            {message ||
              (isId
                ? 'Draft bisa diedit, ditayangkan, atau diarsipkan kapan saja.'
                : 'Drafts can be edited, published, or archived anytime.')}
          </p>
          <button
            type="submit"
            className="ui-button-primary inline-flex h-11 items-center gap-2 px-4 text-sm"
            disabled={status === 'saving'}
          >
            {status === 'saving' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : isEditing ? (
              <Save className="h-4 w-4" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            {status === 'saving'
              ? isId
                ? 'Menyimpan...'
                : 'Saving...'
              : isEditing
                ? isId
                  ? 'Simpan update'
                  : 'Save changes'
                : isId
                  ? 'Simpan materi'
                  : 'Save content'}
          </button>
        </div>
      </form>

      <aside className="space-y-3">
        <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
          <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
            <ClipboardList className="h-4 w-4 text-[color:var(--app-accent)]" />
            {isId ? 'Kelola materi saya' : 'Manage my content'}
          </p>
          <div className="mt-3 space-y-2">
            {status === 'loading' ? (
              <div className="rounded-2xl bg-[color:var(--app-surface-muted)] px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                {isId ? 'Memuat...' : 'Loading...'}
              </div>
            ) : courses.length === 0 ? (
              <p className="rounded-2xl bg-[color:var(--app-surface-muted)] px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                {isId
                  ? 'Belum ada materi. Buat satu dari form.'
                  : 'No content yet. Create one from the form.'}
              </p>
            ) : (
              courses.map(course => {
                const active = selectedCourseId === course.id;
                const Icon =
                  course.primary_format === 'video'
                    ? Video
                    : course.primary_format === 'reading'
                      ? BookOpen
                      : Layers3;
                return (
                  <div
                    key={course.id}
                    className={
                      active
                        ? 'rounded-2xl border border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)] p-3'
                        : 'rounded-2xl border border-[color:var(--app-border)] p-3'
                    }
                  >
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => setSelectedCourseId(course.id)}
                        className="min-w-0 text-left"
                      >
                        <p className="line-clamp-1 text-sm font-bold text-[color:var(--app-text)]">
                          {course.title}
                        </p>
                        <p className="mt-1 text-[11px] font-bold uppercase text-[color:var(--app-text-soft)]">
                          {formatCourseMeta(course, isId)}
                        </p>
                      </button>
                      <Icon className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                    </div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => startEdit(course)}
                        className="ui-button-secondary h-9 text-xs"
                      >
                        {isId ? 'Edit' : 'Edit'}
                      </button>
                      {course.status !== 'published' ? (
                        <button
                          type="button"
                          onClick={() => updateStatus(course, 'published')}
                          className="ui-button-primary h-9 text-xs"
                        >
                          {isId ? 'Tayangkan' : 'Publish'}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => updateStatus(course, 'draft')}
                          className="ui-button-secondary h-9 text-xs"
                        >
                          Draft
                        </button>
                      )}
                      <Link
                        href={`/learn/${course.slug}`}
                        className="ui-button-secondary h-9 text-xs"
                      >
                        {isId ? 'Lihat' : 'View'}
                      </Link>
                      <button
                        type="button"
                        onClick={() => updateStatus(course, 'archived')}
                        className="ui-button-secondary h-9 text-xs"
                      >
                        <Archive className="h-3.5 w-3.5" />
                        {isId ? 'Arsip' : 'Archive'}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
          {status === 'saved' ? (
            <p className="mt-3 flex items-center gap-2 text-xs font-semibold text-[color:var(--app-accent)]">
              <CheckCircle2 className="h-4 w-4" />
              {message}
            </p>
          ) : null}
        </div>

        <form
          onSubmit={handleLessonCreate}
          className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm"
        >
          <p className="flex items-center gap-2 text-sm font-bold text-[color:var(--app-text)]">
            <BookOpen className="h-4 w-4 text-[color:var(--app-accent)]" />
            {isId ? 'Tambah lesson' : 'Add lesson'}
          </p>
          <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
            {activeCourseForLessons
              ? activeCourseForLessons.title
              : isId
                ? 'Pilih materi dulu dari daftar.'
                : 'Select content first from the list.'}
          </p>
          <div className="mt-3 space-y-2">
            <input
              value={lessonForm.module_title}
              onChange={event =>
                updateLessonForm('module_title', event.target.value)
              }
              placeholder={isId ? 'Bagian 1' : 'Module 1'}
              className={inputClass()}
              disabled={!activeCourseForLessons}
            />
            <input
              value={lessonForm.lesson_title}
              onChange={event =>
                updateLessonForm('lesson_title', event.target.value)
              }
              required
              placeholder={isId ? 'Judul lesson' : 'Lesson title'}
              className={inputClass()}
              disabled={!activeCourseForLessons}
            />
            <select
              value={lessonForm.lesson_type}
              onChange={event =>
                updateLessonForm('lesson_type', event.target.value)
              }
              className={inputClass()}
              disabled={!activeCourseForLessons}
            >
              <option value="reading">{isId ? 'Bacaan' : 'Reading'}</option>
              <option value="video">Video</option>
              <option value="quiz">Quiz</option>
              <option value="assignment">
                {isId ? 'Tugas' : 'Assignment'}
              </option>
            </select>
            <input
              value={lessonForm.content_ref}
              onChange={event =>
                updateLessonForm('content_ref', event.target.value)
              }
              placeholder={isId ? 'Link video/artikel' : 'Video/article link'}
              className={inputClass()}
              disabled={!activeCourseForLessons}
            />
            <input
              value={lessonForm.duration_minutes}
              onChange={event =>
                updateLessonForm('duration_minutes', event.target.value)
              }
              inputMode="numeric"
              placeholder={isId ? 'Durasi menit' : 'Minutes'}
              className={inputClass()}
              disabled={!activeCourseForLessons}
            />
            <label className="inline-flex items-center gap-2 rounded-2xl border border-[color:var(--app-border)] px-3 py-2 text-xs font-bold text-[color:var(--app-text-soft)]">
              <input
                checked={lessonForm.is_preview}
                onChange={event =>
                  updateLessonForm('is_preview', event.target.checked)
                }
                type="checkbox"
                className="h-4 w-4 accent-[color:var(--app-accent)]"
                disabled={!activeCourseForLessons}
              />
              {isId ? 'Bisa preview' : 'Preview lesson'}
            </label>
            <button
              type="submit"
              className="ui-button-primary w-full text-sm"
              disabled={!activeCourseForLessons || status === 'saving'}
            >
              <Plus className="h-4 w-4" />
              {isId ? 'Tambah lesson' : 'Add lesson'}
            </button>
          </div>
        </form>

        {detail ? (
          <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
            <p className="text-sm font-bold text-[color:var(--app-text)]">
              {isId ? 'Struktur kelas' : 'Course structure'}
            </p>
            <div className="mt-3 space-y-2">
              {detail.modules.length === 0 ? (
                <p className="rounded-2xl bg-[color:var(--app-surface-muted)] px-3 py-3 text-xs text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Belum ada module atau lesson.'
                    : 'No modules or lessons yet.'}
                </p>
              ) : (
                detail.modules.map(module => {
                  const lessons = detail.lessons.filter(
                    lesson => lesson.module_id === module.id,
                  );
                  return (
                    <div
                      key={module.id}
                      className="rounded-2xl bg-[color:var(--app-surface-muted)] p-3"
                    >
                      <p className="text-xs font-bold text-[color:var(--app-text)]">
                        {module.position}. {module.title}
                      </p>
                      <div className="mt-2 space-y-1">
                        {lessons.map(lesson => (
                          <p
                            key={lesson.id}
                            className="line-clamp-1 text-xs text-[color:var(--app-text-soft)]"
                          >
                            {lesson.position}. {lesson.title} -{' '}
                            {lesson.lesson_type}
                          </p>
                        ))}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        ) : null}
      </aside>
    </section>
  );
}
