import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { LajukanImage } from '@/components/common/LajukanImage';
import {
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Layers3,
  PlayCircle,
  ShieldCheck,
  Star,
  Users,
} from 'lucide-react';

type PageProps = {
  params: Promise<{ locale: string; slug: string }>;
};

type LearningCourse = {
  id: string;
  slug: string;
  title: string;
  summary?: string | null;
  description?: string | null;
  level: string;
  price_cents: number;
  currency: string;
  thumbnail_url?: string | null;
  estimated_minutes: number;
  category: string;
  primary_format: string;
  trailer_url?: string | null;
  tags: string[];
  view_count?: number;
  enrollment_count: number;
  rating_avg: number;
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

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ||
  process.env.MARKETPLACE_URL ||
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ||
  'http://localhost:8081';
const LEARNING_FETCH_TIMEOUT_MS = 2500;

async function getCourse(slug: string): Promise<CourseDetail | null> {
  try {
    const response = await fetch(
      `${MARKETPLACE_URL}/v1/learning/courses/${encodeURIComponent(slug)}`,
      {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
        signal: AbortSignal.timeout(LEARNING_FETCH_TIMEOUT_MS),
      },
    );
    if (response.status === 404) return null;
    if (!response.ok) return null;
    return (await response.json()) as CourseDetail;
  } catch {
    return null;
  }
}

function formatDuration(seconds: number, isId: boolean) {
  if (!seconds) return isId ? 'Singkat' : 'Short';
  const minutes = Math.max(1, Math.round(seconds / 60));
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder
    ? `${hours}${isId ? 'j' : 'h'} ${remainder}m`
    : `${hours} ${isId ? 'jam' : 'h'}`;
}

function formatMinutes(minutes: number, isId: boolean) {
  if (!minutes) return isId ? 'Fleksibel' : 'Flexible';
  return formatDuration(minutes * 60, isId);
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

function youtubeEmbedUrl(value?: string | null): string {
  if (!value) return '';
  try {
    const url = new URL(value);
    if (url.hostname.includes('youtube.com')) {
      const videoId = url.searchParams.get('v');
      return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
    }
    if (url.hostname.includes('youtu.be')) {
      const videoId = url.pathname.replace('/', '').trim();
      return videoId ? `https://www.youtube.com/embed/${videoId}` : '';
    }
  } catch {
    return '';
  }
  return '';
}

function splitReading(text?: string | null): string[] {
  return (text || '')
    .split(/\n+/)
    .map(line => line.trim())
    .filter(Boolean);
}

function LessonIcon({ type }: { type: string }) {
  if (type === 'video') return <PlayCircle className="h-4 w-4" />;
  if (type === 'quiz') return <CheckCircle2 className="h-4 w-4" />;
  if (type === 'assignment') return <FileText className="h-4 w-4" />;
  return <BookOpen className="h-4 w-4" />;
}

export default async function LearnDetailPage({ params }: PageProps) {
  const { locale, slug } = await params;
  const isId = locale === 'id';
  const detail = await getCourse(slug);
  if (!detail) notFound();

  const { course, modules, lessons } = detail;
  const cover = course.thumbnail_url || '';
  const embedUrl = youtubeEmbedUrl(course.trailer_url);
  const readingBlocks = splitReading(course.description || course.summary);
  const firstPreviewLesson =
    lessons.find(lesson => lesson.is_preview && lesson.content_ref) ||
    lessons.find(lesson => lesson.content_ref) ||
    null;
  const previewEmbedUrl =
    youtubeEmbedUrl(firstPreviewLesson?.content_ref) || embedUrl;
  const totalSeconds = lessons.reduce(
    (total, lesson) => total + Math.max(0, lesson.duration_seconds || 0),
    0,
  );

  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <main className="page-shell space-y-5 py-5 sm:py-6">
        <nav className="flex flex-wrap items-center gap-2 text-xs font-bold text-[color:var(--app-text-soft)]">
          <Link href="/learn" className="hover:text-[color:var(--app-accent)]">
            Lajukan Learn
          </Link>
          <span>/</span>
          <span className="line-clamp-1 text-[color:var(--app-text)]">
            {course.title}
          </span>
        </nav>

        <section className="overflow-hidden rounded-[26px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-sm">
          <div className="grid lg:grid-cols-[minmax(0,1fr)_420px]">
            <div className="p-5 sm:p-6">
              <div className="flex flex-wrap gap-2 text-[11px] font-black uppercase text-[color:var(--app-accent)]">
                <span className="inline-flex items-center gap-1 rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1">
                  <GraduationCap className="h-3.5 w-3.5" />
                  {formatLabel(course.primary_format, isId)}
                </span>
                <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1">
                  {course.level}
                </span>
                <span className="rounded-full bg-[color:var(--app-accent-soft)] px-3 py-1">
                  {course.category}
                </span>
              </div>
              <h1 className="mt-4 max-w-3xl text-2xl font-black leading-tight text-[color:var(--app-text)] sm:text-3xl lg:text-4xl">
                {course.title}
              </h1>
              <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
                {course.summary ||
                  (isId
                    ? 'Materi belajar dari creator Lajukan.'
                    : 'Learning content from a Lajukan creator.')}
              </p>
              <div className="mt-5 grid gap-2 sm:grid-cols-4">
                {[
                  {
                    label: isId ? 'Bagian' : 'Modules',
                    value: modules.length.toLocaleString(locale),
                    icon: Layers3,
                  },
                  {
                    label: isId ? 'Lesson' : 'Lessons',
                    value: lessons.length.toLocaleString(locale),
                    icon: BookOpen,
                  },
                  {
                    label: isId ? 'Durasi' : 'Duration',
                    value: formatMinutes(
                      totalSeconds
                        ? Math.round(totalSeconds / 60)
                        : course.estimated_minutes,
                      isId,
                    ),
                    icon: Clock3,
                  },
                  {
                    label: isId ? 'Akses' : 'Access',
                    value: formatMoney(course, isId),
                    icon: Star,
                  },
                ].map(item => (
                  <div
                    key={item.label}
                    className="rounded-2xl bg-[color:var(--app-surface-muted)] p-3"
                  >
                    <item.icon className="h-4 w-4 text-[color:var(--app-accent)]" />
                    <p className="mt-2 truncate text-base font-black text-[color:var(--app-text)]">
                      {item.value}
                    </p>
                    <p className="text-xs font-bold text-[color:var(--app-text-soft)]">
                      {item.label}
                    </p>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap gap-3">
                {course.trailer_url ? (
                  <a
                    href={course.trailer_url}
                    className="ui-button-primary inline-flex h-11 items-center gap-2 px-4 text-sm"
                    target="_blank"
                    rel="noreferrer"
                  >
                    <PlayCircle className="h-4 w-4" />
                    {isId ? 'Buka resource utama' : 'Open main resource'}
                  </a>
                ) : null}
                <Link
                  href="/community"
                  className="ui-button-secondary inline-flex h-11 items-center px-4 text-sm"
                >
                  {isId ? 'Tanya komunitas' : 'Ask community'}
                </Link>
              </div>
            </div>
            <div className="relative min-h-[280px] bg-[color:var(--app-surface-muted)] lg:min-h-full">
              <LajukanImage
                src={cover}
                alt={course.title}
                fill
                priority
                sizes="(max-width: 1024px) 100vw, 420px"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 rounded-2xl bg-white/92 p-3 text-sm font-black text-slate-950 shadow-lg">
                <span className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-emerald-600" />
                  {(
                    course.enrollment_count ||
                    course.view_count ||
                    0
                  ).toLocaleString(locale)}{' '}
                  {isId ? 'aktivitas belajar' : 'learning signals'}
                </span>
              </div>
            </div>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <section className="overflow-hidden rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] shadow-sm">
              <div className="border-b border-[color:var(--app-border)] px-4 py-3">
                <h2 className="flex items-center gap-2 text-base font-black text-[color:var(--app-text)]">
                  <PlayCircle className="h-5 w-5 text-[color:var(--app-accent)]" />
                  {isId ? 'Ruang belajar' : 'Learning room'}
                </h2>
              </div>
              {previewEmbedUrl ? (
                <div className="aspect-video w-full bg-black">
                  <iframe
                    src={previewEmbedUrl}
                    title={course.title}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                  />
                </div>
              ) : (
                <div className="relative min-h-[260px] overflow-hidden bg-[color:var(--app-surface-muted)]">
                  <LajukanImage
                    src={cover}
                    alt={course.title}
                    fill
                    sizes="100vw"
                    className="object-cover"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
                  <div className="absolute bottom-5 left-5 right-5">
                    <p className="max-w-xl text-xl font-black text-white">
                      {isId
                        ? 'Creator belum menaruh embed video. Gunakan resource dan curriculum di bawah.'
                        : 'The creator has not added an embedded video yet. Use the resources and curriculum below.'}
                    </p>
                  </div>
                </div>
              )}
            </section>

            {readingBlocks.length > 0 ? (
              <section className="rounded-[24px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm sm:p-5">
                <h2 className="flex items-center gap-2 text-base font-black text-[color:var(--app-text)]">
                  <FileText className="h-5 w-5 text-[color:var(--app-accent)]" />
                  {isId ? 'Catatan bacaan' : 'Reading notes'}
                </h2>
                <div className="mt-4 space-y-4 text-sm leading-7 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                  {readingBlocks.slice(0, 8).map(block => (
                    <p key={block}>{block}</p>
                  ))}
                </div>
              </section>
            ) : null}

            <section className="space-y-3">
              {modules.length === 0 ? (
                <div className="rounded-[22px] border border-dashed border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-strong)] p-5 text-sm text-[color:var(--app-text-soft)]">
                  {isId
                    ? 'Creator belum menambahkan lesson.'
                    : 'The creator has not added lessons yet.'}
                </div>
              ) : (
                modules.map(module => {
                  const moduleLessons = lessons.filter(
                    lesson => lesson.module_id === module.id,
                  );
                  return (
                    <article
                      key={module.id}
                      className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm"
                    >
                      <h2 className="text-base font-black text-[color:var(--app-text)]">
                        {module.position}. {module.title}
                      </h2>
                      <div className="mt-3 divide-y divide-[color:var(--app-border)]">
                        {moduleLessons.length > 0 ? (
                          moduleLessons.map(lesson => (
                            <div
                              key={lesson.id}
                              className="flex items-center justify-between gap-3 py-3"
                            >
                              <div className="flex min-w-0 items-center gap-3">
                                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)]">
                                  <LessonIcon type={lesson.lesson_type} />
                                </span>
                                <div className="min-w-0">
                                  <p className="line-clamp-1 text-sm font-black text-[color:var(--app-text)]">
                                    {lesson.title}
                                  </p>
                                  <p className="mt-0.5 text-xs text-[color:var(--app-text-soft)]">
                                    {lesson.lesson_type} -{' '}
                                    {formatDuration(
                                      lesson.duration_seconds,
                                      isId,
                                    )}
                                  </p>
                                </div>
                              </div>
                              {lesson.content_ref ? (
                                <a
                                  href={lesson.content_ref}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="ui-button-secondary h-9 px-3 text-xs"
                                >
                                  {isId ? 'Buka' : 'Open'}
                                </a>
                              ) : (
                                <span className="rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1 text-[11px] font-bold text-[color:var(--app-text-soft)]">
                                  Soon
                                </span>
                              )}
                            </div>
                          ))
                        ) : (
                          <p className="py-3 text-sm text-[color:var(--app-text-soft)]">
                            {isId
                              ? 'Belum ada lesson di bagian ini.'
                              : 'No lessons in this module yet.'}
                          </p>
                        )}
                      </div>
                    </article>
                  );
                })
              )}
            </section>
          </div>

          <aside className="space-y-3">
            <div className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-black text-[color:var(--app-text)]">
                <ShieldCheck className="h-4 w-4 text-[color:var(--app-accent)]" />
                {isId ? 'Belajar aman' : 'Safe learning'}
              </p>
              <ul className="mt-3 space-y-2 text-sm text-[color:var(--app-text-soft)]">
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                  {isId
                    ? 'Cek ringkasan dan resource sebelum mulai.'
                    : 'Check the summary and resources before starting.'}
                </li>
                <li className="flex gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                  {isId
                    ? 'Simpan pertanyaan untuk komunitas.'
                    : 'Save questions for the community.'}
                </li>
                <li className="flex gap-2">
                  <Clock3 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                  {isId
                    ? 'Kerjakan sedikit, tapi rutin.'
                    : 'Keep it short and consistent.'}
                </li>
              </ul>
            </div>

            <div className="rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-4 shadow-sm">
              <p className="text-sm font-black text-[color:var(--app-text)]">
                {isId ? 'Tags' : 'Tags'}
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {(course.tags || []).length > 0 ? (
                  course.tags.map(tag => (
                    <Link
                      key={tag}
                      href={`/learn?q=${encodeURIComponent(tag)}`}
                      className="rounded-full bg-[color:var(--app-surface-muted)] px-3 py-1 text-xs font-bold text-[color:var(--app-text-soft)]"
                    >
                      #{tag}
                    </Link>
                  ))
                ) : (
                  <span className="text-sm text-[color:var(--app-text-soft)]">
                    {isId ? 'Belum ada tag.' : 'No tags yet.'}
                  </span>
                )}
              </div>
            </div>
          </aside>
        </section>
      </main>
    </div>
  );
}
