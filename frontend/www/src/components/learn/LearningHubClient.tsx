'use client';

import { useMemo, useState } from 'react';
import { Link } from '@/i18n/navigation';
import { LajukanImage } from '@/components/common/LajukanImage';
import { DailyLoginRewardCard } from '@/components/rewards/DailyLoginRewardCard';
import { LearnCreatorStudio } from '@/components/learn/LearnCreatorStudio';
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  GraduationCap,
  Layers3,
  PlayCircle,
  Search,
  Sparkles,
  Star,
  Users,
  Video,
} from 'lucide-react';

export type LearningCourse = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  level: string;
  price_cents: number;
  currency: string;
  status: string;
  visibility?: string | null;
  thumbnail_url?: string | null;
  estimated_minutes: number;
  category: string;
  primary_format: string;
  trailer_url?: string | null;
  tags: string[];
  view_count: number;
  enrollment_count: number;
  rating_avg: number;
  updated_at?: string;
};

type Props = {
  locale: string;
  initialCourses: LearningCourse[];
};

type FormatFilter = 'all' | 'video' | 'reading' | 'course' | 'mixed';

function text(value: unknown): string {
  return typeof value === 'string' && value.trim() ? value.trim() : '';
}

function formatMinutes(minutes: number, isId: boolean) {
  if (!minutes) return isId ? 'Singkat' : 'Short';
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder
    ? `${hours}${isId ? 'j' : 'h'} ${remainder}m`
    : `${hours} ${isId ? 'jam' : 'h'}`;
}

function formatMoney(course: LearningCourse, isId: boolean) {
  if (!course.price_cents || course.price_cents <= 0) {
    return isId ? 'Gratis' : 'Free';
  }
  return new Intl.NumberFormat(isId ? 'id-ID' : 'en-US', {
    style: 'currency',
    currency: course.currency || 'IDR',
    maximumFractionDigits: 0,
  }).format(Math.floor(course.price_cents / 100));
}

function formatLabel(format: string, isId: boolean) {
  if (format === 'video') return 'Video';
  if (format === 'reading') return isId ? 'Bacaan' : 'Reading';
  if (format === 'course') return isId ? 'Kelas' : 'Course';
  return isId ? 'Campuran' : 'Mixed';
}

function FormatIconGlyph({ format }: { format: string }) {
  if (format === 'video') return <PlayCircle className="h-3.5 w-3.5" />;
  if (format === 'reading') return <BookOpen className="h-3.5 w-3.5" />;
  if (format === 'course') return <GraduationCap className="h-3.5 w-3.5" />;
  return <Layers3 className="h-3.5 w-3.5" />;
}

function imageForCourse(course: LearningCourse, index: number) {
  void index;
  return course.thumbnail_url || '';
}

function courseMatches(
  course: LearningCourse,
  query: string,
  format: FormatFilter,
) {
  if (format !== 'all') {
    if (format === 'course') {
      if (
        course.primary_format !== 'course' &&
        course.primary_format !== 'mixed'
      ) {
        return false;
      }
    } else if (course.primary_format !== format) {
      return false;
    }
  }
  const normalized = query.trim().toLowerCase();
  if (!normalized) return true;
  const haystack = [
    course.title,
    course.summary,
    course.description,
    course.category,
    course.level,
    course.primary_format,
    ...(course.tags || []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  return haystack.includes(normalized);
}

function CourseCard({
  course,
  index,
  isId,
  compact = false,
}: {
  course: LearningCourse;
  index: number;
  isId: boolean;
  compact?: boolean;
}) {
  const image = imageForCourse(course, index);

  return (
    <Link
      href={`/learn/${course.slug}`}
      className="group block overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-sm transition hover:-translate-y-0.5 hover:border-[color:var(--app-accent-border)] hover:shadow-[0_18px_42px_-30px_rgba(15,23,42,0.34)]"
    >
      <div
        className={
          compact
            ? 'relative h-32 overflow-hidden bg-[color:var(--app-surface-muted)]'
            : 'relative h-44 overflow-hidden bg-[color:var(--app-surface-muted)] sm:h-48'
        }
      >
        <LajukanImage
          src={image}
          alt={course.title}
          fill
          sizes={compact ? '260px' : '(max-width: 768px) 100vw, 33vw'}
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
        <span className="absolute left-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/94 px-2.5 py-1 text-[11px] font-bold text-slate-950">
          <FormatIconGlyph format={course.primary_format} />
          {formatLabel(course.primary_format, isId)}
        </span>
        <span className="absolute bottom-3 left-3 rounded-full bg-black/72 px-2.5 py-1 text-[11px] font-bold text-white">
          {formatMinutes(course.estimated_minutes, isId)}
        </span>
      </div>
      <div className="space-y-3 p-4">
        <div>
          <h2 className="line-clamp-2 text-base font-bold leading-5 text-[color:var(--app-text)]">
            {course.title}
          </h2>
          <p className="mt-2 line-clamp-2 text-sm leading-5 text-[color:var(--app-text-soft)]">
            {course.summary ||
              (isId
                ? 'Materi praktis dari creator Lajukan.'
                : 'Practical content from Lajukan creators.')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5 text-[11px] font-bold text-[color:var(--app-text-soft)]">
          <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1">
            {course.category || 'business'}
          </span>
          <span className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1">
            {course.level}
          </span>
          {(course.tags || []).slice(0, compact ? 1 : 2).map(tag => (
            <span
              key={tag}
              className="rounded-full bg-[color:var(--app-surface-muted)] px-2.5 py-1"
            >
              #{tag}
            </span>
          ))}
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-[color:var(--app-border)] pt-3 text-xs text-[color:var(--app-text-soft)]">
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-3.5 w-3.5" />
            {course.enrollment_count || course.view_count || 0}
          </span>
          <span className="font-bold text-[color:var(--app-accent)]">
            {formatMoney(course, isId)}
          </span>
        </div>
      </div>
    </Link>
  );
}

function EmptyLearningState({ isId }: { isId: boolean }) {
  return (
    <div className="rounded-[24px] border border-dashed border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-6 text-center">
      <BookOpen className="mx-auto h-10 w-10 text-[color:var(--app-accent)]" />
      <h2 className="mt-3 text-lg font-bold text-[color:var(--app-text)]">
        {isId ? 'Belum ada materi dari database' : 'No database content yet'}
      </h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-[color:var(--app-text-soft)]">
        {isId
          ? 'Begitu creator membuat kelas, video, atau bacaan, materi akan muncul di sini.'
          : 'Once creators add courses, videos, or readings, they will appear here.'}
      </p>
    </div>
  );
}

export function LearningHubClient({ locale, initialCourses }: Props) {
  const isId = locale === 'id';
  const [query, setQuery] = useState('');
  const [format, setFormat] = useState<FormatFilter>('all');

  const courses = useMemo(
    () => initialCourses.filter(course => course.status !== 'archived'),
    [initialCourses],
  );
  const filteredCourses = useMemo(
    () => courses.filter(course => courseMatches(course, query, format)),
    [courses, format, query],
  );
  const featured = filteredCourses[0] || courses[0] || null;
  const videoCourses = courses.filter(
    course => course.primary_format === 'video',
  );
  const readingCourses = courses.filter(
    course => course.primary_format === 'reading',
  );
  const courseSeries = courses.filter(
    course =>
      course.primary_format === 'course' || course.primary_format === 'mixed',
  );
  const totalMinutes = courses.reduce(
    (total, course) => total + Math.max(0, course.estimated_minutes || 0),
    0,
  );
  const categories = Array.from(
    new Set(courses.map(course => text(course.category)).filter(Boolean)),
  ).slice(0, 8);

  const filters: Array<{ key: FormatFilter; label: string; count: number }> = [
    { key: 'all', label: isId ? 'Semua' : 'All', count: courses.length },
    { key: 'video', label: 'Video', count: videoCourses.length },
    {
      key: 'reading',
      label: isId ? 'Bacaan' : 'Reading',
      count: readingCourses.length,
    },
    {
      key: 'course',
      label: isId ? 'Kelas' : 'Courses',
      count: courseSeries.length,
    },
  ];

  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="page-shell space-y-6 py-5 sm:py-6">
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(280px,0.65fr)]">
          <div className="overflow-hidden rounded-[26px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-sm">
            <div className="grid gap-0 lg:grid-cols-[minmax(0,1fr)_360px]">
              <div className="p-5 sm:p-6">
                <p className="inline-flex items-center gap-2 rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1 text-[11px] font-bold uppercase text-[color:var(--app-accent)]">
                  <GraduationCap className="h-3.5 w-3.5" />
                  Lajukan Learn
                </p>
                <h1 className="mt-4 max-w-3xl text-2xl font-bold leading-tight text-[color:var(--app-text)] sm:text-3xl lg:text-4xl">
                  {isId
                    ? 'Belajar usaha dari video, bacaan, dan kelas buatan creator.'
                    : 'Learn business from creator-made videos, readings, and courses.'}
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Creator bisa bikin materi pendek seperti YouTube, kelas bertahap seperti Udemy, atau bacaan praktis untuk langsung dipakai.'
                    : 'Creators can publish short videos, structured courses, or practical readings that learners can apply immediately.'}
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-3">
                  {[
                    {
                      label: isId ? 'Materi' : 'Items',
                      value: courses.length.toLocaleString(locale),
                      icon: Layers3,
                    },
                    {
                      label: isId ? 'Video' : 'Videos',
                      value: videoCourses.length.toLocaleString(locale),
                      icon: Video,
                    },
                    {
                      label: isId ? 'Durasi' : 'Minutes',
                      value: totalMinutes
                        ? totalMinutes.toLocaleString(locale)
                        : '0',
                      icon: Clock3,
                    },
                  ].map(item => (
                    <div
                      key={item.label}
                      className="rounded-[16px] bg-[color:var(--app-surface-muted)] p-3"
                    >
                      <item.icon className="h-4 w-4 text-[color:var(--app-accent)]" />
                      <p className="mt-2 text-lg font-bold text-[color:var(--app-text)]">
                        {item.value}
                      </p>
                      <p className="text-xs font-bold text-[color:var(--app-text-soft)]">
                        {item.label}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href="#creator-studio"
                    className="ui-button-primary inline-flex h-11 items-center px-4 text-sm"
                  >
                    {isId ? 'Buat materi' : 'Create content'}
                  </a>
                  <Link
                    href="/education"
                    className="ui-button-secondary inline-flex h-11 items-center px-4 text-sm"
                  >
                    {isId ? 'Panduan belajar aman' : 'Safe learning guide'}
                  </Link>
                </div>
              </div>
              <div className="relative min-h-[280px] overflow-hidden bg-[color:var(--app-surface-muted)]">
                {featured ? (
                  <>
                    <LajukanImage
                      src={imageForCourse(featured, 0)}
                      alt={featured.title}
                      fill
                      priority
                      sizes="(max-width: 1024px) 100vw, 380px"
                      className="object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/72 via-black/15 to-transparent" />
                    <div className="absolute inset-x-4 bottom-4">
                      <span className="inline-flex items-center gap-2 rounded-full bg-white/94 px-3 py-1 text-[11px] font-bold text-slate-950">
                        <PlayCircle className="h-3.5 w-3.5" />
                        {formatLabel(featured.primary_format, isId)}
                      </span>
                      <h2 className="mt-3 line-clamp-2 text-xl font-bold leading-6 text-white">
                        {featured.title}
                      </h2>
                      <Link
                        href={`/learn/${featured.slug}`}
                        className="mt-4 inline-flex h-10 items-center rounded-full bg-white px-4 text-sm font-bold text-slate-950"
                      >
                        {isId ? 'Mulai belajar' : 'Start learning'}
                      </Link>
                    </div>
                  </>
                ) : (
                  <div className="flex h-full min-h-[280px] items-center justify-center bg-[linear-gradient(135deg,#f8fafc_0%,#dbeafe_50%,#dcfce7_100%)] p-6 text-center">
                    <p className="text-sm font-bold text-slate-800">
                      {isId
                        ? 'Materi creator akan tampil di sini.'
                        : 'Creator content will appear here.'}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <DailyLoginRewardCard locale={locale} />
        </section>

        <section className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-sm sm:p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <label className="relative block">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[color:var(--app-text-soft)]" />
              <input
                value={query}
                onChange={event => setQuery(event.target.value)}
                placeholder={
                  isId
                    ? 'Cari packaging, reseller, margin, live shopping...'
                    : 'Search packaging, reseller, margin, live shopping...'
                }
                className="h-10 w-full rounded-[12px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] pl-9 pr-3 text-[13px] font-semibold text-[color:var(--app-text)] outline-none transition focus:border-[color:var(--app-accent-border)]"
              />
            </label>
            <div className="flex gap-2 overflow-x-auto pb-1 lg:pb-0">
              {filters.map(item => {
                const active = format === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setFormat(item.key)}
                    className={
                      active
                        ? 'inline-flex h-11 shrink-0 items-center gap-2 rounded-full bg-[color:var(--app-accent-strong)] px-4 text-sm font-bold text-[color:var(--app-text-inverse)]'
                        : 'inline-flex h-11 shrink-0 items-center gap-2 rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-sm font-bold text-[color:var(--app-text)]'
                    }
                  >
                    {item.label}
                    <span className="rounded-full bg-black/10 px-2 py-0.5 text-[11px]">
                      {item.count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
          {categories.length > 0 ? (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
              {categories.map(category => (
                <button
                  key={category}
                  type="button"
                  onClick={() => setQuery(category)}
                  className="inline-flex h-9 shrink-0 items-center rounded-full bg-[color:var(--app-surface-muted)] px-3 text-xs font-bold text-[color:var(--app-text-soft)]"
                >
                  #{category}
                </button>
              ))}
            </div>
          ) : null}
        </section>

        <section className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="inline-flex items-center gap-2 text-xs font-bold uppercase text-[color:var(--app-accent)]">
                <Sparkles className="h-4 w-4" />
                {isId ? 'Untukmu' : 'For you'}
              </p>
              <h2 className="mt-1 text-xl font-bold text-[color:var(--app-text)]">
                {isId
                  ? 'Materi terbaru dari creator'
                  : 'Latest creator learning'}
              </h2>
            </div>
            <Link
              href="/community"
              className="ui-button-secondary inline-flex h-10 items-center px-3 text-sm"
            >
              {isId ? 'Diskusi komunitas' : 'Community discussion'}
            </Link>
          </div>

          {filteredCourses.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {filteredCourses.map((course, index) => (
                <CourseCard
                  key={course.id}
                  course={course}
                  index={index}
                  isId={isId}
                />
              ))}
            </div>
          ) : (
            <EmptyLearningState isId={isId} />
          )}
        </section>

        {videoCourses.length > 0 || readingCourses.length > 0 ? (
          <section className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-[color:var(--app-text)]">
                  {isId ? 'Belajar lewat video' : 'Learn by video'}
                </h2>
                <PlayCircle className="h-5 w-5 text-[color:var(--app-accent)]" />
              </div>
              <div className="mt-3 grid gap-3 sm:grid-cols-2">
                {videoCourses.slice(0, 4).map((course, index) => (
                  <CourseCard
                    key={course.id}
                    course={course}
                    index={index}
                    isId={isId}
                    compact
                  />
                ))}
              </div>
            </div>
            <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-[color:var(--app-text)]">
                  {isId ? 'Belajar lewat bacaan' : 'Learn by reading'}
                </h2>
                <BookOpen className="h-5 w-5 text-[color:var(--app-accent)]" />
              </div>
              <div className="mt-3 space-y-2">
                {readingCourses.slice(0, 5).map(course => (
                  <Link
                    key={course.id}
                    href={`/learn/${course.slug}`}
                    className="flex items-start gap-3 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 transition hover:border-[color:var(--app-accent-border)]"
                  >
                    <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-surface-strong)] text-[color:var(--app-accent)]">
                      <BookOpen className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="line-clamp-1 text-sm font-bold text-[color:var(--app-text)]">
                        {course.title}
                      </span>
                      <span className="mt-1 flex items-center gap-2 text-xs font-bold text-[color:var(--app-text-soft)]">
                        <Clock3 className="h-3.5 w-3.5" />
                        {formatMinutes(course.estimated_minutes, isId)}
                      </span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        ) : null}

        <section className="grid gap-4 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)]">
          <div className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
            <h2 className="flex items-center gap-2 text-base font-bold text-[color:var(--app-text)]">
              <CheckCircle2 className="h-5 w-5 text-[color:var(--app-accent)]" />
              {isId ? 'Cara pilih materi' : 'How to choose'}
            </h2>
            <div className="mt-4 space-y-3 text-sm text-[color:var(--app-text-soft)]">
              {[
                isId
                  ? 'Butuh cepat? Pilih video singkat.'
                  : 'Need it fast? Pick a short video.',
                isId
                  ? 'Butuh SOP? Pilih bacaan atau course.'
                  : 'Need an SOP? Pick a reading or course.',
                isId
                  ? 'Butuh hasil nyata? Diskusikan di komunitas setelah belajar.'
                  : 'Need real outcomes? Discuss in community after learning.',
              ].map(item => (
                <p key={item} className="flex gap-2">
                  <Star className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                  <span>{item}</span>
                </p>
              ))}
            </div>
          </div>
          <LearnCreatorStudio locale={locale} />
        </section>
      </div>
    </div>
  );
}
