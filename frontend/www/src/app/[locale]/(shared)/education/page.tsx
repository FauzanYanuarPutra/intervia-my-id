import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock3,
  FileText,
  GraduationCap,
  Layers3,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Users,
  Video,
} from 'lucide-react';

import { LajukanImage } from '@/components/common/LajukanImage';
import {
  EDUCATION_HERO,
  EDUCATION_TOPICS,
  LEARN_PATHS,
  LEARN_TRACKS,
} from '@/data/educationHub';
import { pickText } from '@/data/trustCenter';
import { Link } from '@/i18n/navigation';

type PageProps = {
  params: Promise<{ locale: string }>;
};

type LearningCourse = {
  id: string;
  slug: string;
  title: string;
  summary: string | null;
  thumbnail_url: string | null;
  primary_format: string | null;
  category: string | null;
  level: string | null;
  estimated_minutes: number | null;
  price_cents: number | null;
  currency: string | null;
  enrollment_count: number | null;
  view_count: number | null;
  tags: string[] | null;
};

const MARKETPLACE_URL =
  process.env.INTERNAL_MARKETPLACE_URL ??
  process.env.MARKETPLACE_URL ??
  process.env.NEXT_PUBLIC_MARKETPLACE_URL ??
  'http://localhost:8081';
const LEARNING_FETCH_TIMEOUT_MS = 2500;

const courseImages = [
  '/images/articles/warung-digital-story.jpg',
  '/images/articles/komunitas-reseller.jpg',
  '/images/articles/merchant-growth-insights.jpg',
  '/images/hero/reseller-warung-community.jpg',
];

const formatMeta: Record<string, { label: string; tone: string }> = {
  video: {
    label: 'Video',
    tone: 'bg-rose-50 text-rose-700 ring-rose-100',
  },
  reading: {
    label: 'Bacaan',
    tone: 'bg-sky-50 text-sky-700 ring-sky-100',
  },
  course: {
    label: 'Course',
    tone: 'bg-emerald-50 text-emerald-700 ring-emerald-100',
  },
  mixed: {
    label: 'Kelas campuran',
    tone: 'bg-amber-50 text-amber-800 ring-amber-100',
  },
};

function FormatKindIcon({
  format,
  className = 'h-3.5 w-3.5',
}: {
  format: string | null;
  className?: string;
}) {
  if (format === 'video') return <PlayCircle className={className} />;
  if (format === 'reading') return <FileText className={className} />;
  if (format === 'course') return <GraduationCap className={className} />;
  return <Layers3 className={className} />;
}

function StatIcon({ kind }: { kind: string }) {
  if (kind === 'learners') return <Users className="h-5 w-5" />;
  if (kind === 'paths') return <Layers3 className="h-5 w-5" />;
  if (kind === 'formats') return <Video className="h-5 w-5" />;
  return <GraduationCap className="h-5 w-5" />;
}

function TopicIcon({ index }: { index: number }) {
  if (index % 3 === 1) return <AlertTriangle className="h-5 w-5" />;
  if (index % 3 === 2) return <Users className="h-5 w-5" />;
  return <ShieldCheck className="h-5 w-5" />;
}

function ResourceIcon({ kind }: { kind: string }) {
  if (kind === 'learn') return <BookOpen className="h-5 w-5" />;
  if (kind === 'studio') return <Sparkles className="h-5 w-5" />;
  return <ShieldCheck className="h-5 w-5" />;
}

async function getEducationCourses() {
  try {
    const response = await fetch(
      `${MARKETPLACE_URL}/v1/learning/courses?limit=9`,
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(LEARNING_FETCH_TIMEOUT_MS),
      },
    );

    if (!response.ok) {
      return [];
    }

    const body = (await response.json()) as {
      items?: LearningCourse[];
      courses?: LearningCourse[];
    };
    return body.items ?? body.courses ?? [];
  } catch (error) {
    console.warn('Failed to load education learning courses', error);
    return [];
  }
}

function courseImage(course: LearningCourse, index: number) {
  return (
    course.thumbnail_url ??
    courseImages[index % courseImages.length] ??
    courseImages[0]
  );
}

function formatMinutes(minutes: number | null) {
  if (!minutes) {
    return 'Durasi fleksibel';
  }

  if (minutes < 60) {
    return `${minutes} menit`;
  }

  const hours = Math.floor(minutes / 60);
  const remainder = minutes % 60;
  return remainder ? `${hours} jam ${remainder} menit` : `${hours} jam`;
}

function formatPrice(course: LearningCourse) {
  const price = course.price_cents ?? 0;
  if (price <= 0) {
    return 'Gratis';
  }

  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: course.currency ?? 'IDR',
    maximumFractionDigits: 0,
  }).format(price / 100);
}

function formatKind(format: string | null) {
  return formatMeta[format ?? 'mixed'] ?? formatMeta.mixed;
}

export default async function EducationPage({ params }: PageProps) {
  const { locale } = await params;
  const courses = await getEducationCourses();
  const videoCount = courses.filter(
    course => course.primary_format === 'video',
  ).length;
  const readingCount = courses.filter(
    course => course.primary_format === 'reading',
  ).length;
  const totalLearners = courses.reduce(
    (sum, course) => sum + (course.enrollment_count ?? 0),
    0,
  );

  const heroTitle = pickText(locale, EDUCATION_HERO.title);
  const heroBody = pickText(locale, EDUCATION_HERO.description);

  return (
    <main className="min-h-screen bg-[#f6f7f4] text-slate-950">
      <section className="relative isolate overflow-hidden border-b border-white/80 bg-slate-950 text-white">
        <LajukanImage
          src="/images/articles/merchant-growth-insights.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="absolute inset-0 -z-20 object-cover opacity-45"
        />
        <div className="absolute inset-0 -z-10 bg-[linear-gradient(90deg,rgba(2,6,23,0.92),rgba(15,23,42,0.74),rgba(15,118,110,0.52))]" />

        <div className="mx-auto grid min-h-[560px] w-full max-w-7xl items-center gap-8 px-4 pb-12 pt-24 sm:px-6 lg:grid-cols-[1fr_440px] lg:px-8">
          <div className="max-w-3xl">
            <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-sm font-semibold text-emerald-50 backdrop-blur">
              <GraduationCap className="h-4 w-4" />
              Education hub
            </div>
            <h1 className="max-w-3xl text-4xl font-black leading-[1.03] tracking-normal sm:text-5xl lg:text-6xl">
              {heroTitle}
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-7 text-slate-100 sm:text-lg">
              {heroBody}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {EDUCATION_HERO.chips.map(chip => (
                <span
                  key={pickText(locale, chip)}
                  className="rounded-full border border-white/18 bg-white/10 px-3 py-1 text-xs font-black text-slate-100 backdrop-blur"
                >
                  {pickText(locale, chip)}
                </span>
              ))}
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/learn"
                className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-5 text-sm font-black text-slate-950 shadow-[0_22px_44px_-30px_rgba(255,255,255,0.9)] transition hover:-translate-y-0.5"
              >
                <BookOpen className="h-4 w-4" />
                Jelajahi materi user
              </Link>
              <Link
                href="/learn#creator-studio"
                className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 bg-white/10 px-5 text-sm font-black text-white backdrop-blur transition hover:-translate-y-0.5 hover:bg-white/16"
              >
                <Sparkles className="h-4 w-4" />
                Buat course
              </Link>
            </div>
          </div>

          <div className="rounded-[32px] border border-white/18 bg-white/12 p-4 shadow-[0_32px_80px_-42px_rgba(0,0,0,0.85)] backdrop-blur-xl">
            <div className="overflow-hidden rounded-[24px] bg-white text-slate-950">
              <div className="relative aspect-video bg-slate-900">
                <LajukanImage
                  src="/images/articles/komunitas-reseller.jpg"
                  alt="Sesi belajar komunitas bisnis"
                  fill
                  sizes="(min-width: 1024px) 420px, 100vw"
                  className="object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950/76 via-slate-950/10 to-transparent" />
                <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between gap-3 text-white">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.2em] text-emerald-100">
                      Creator playlist
                    </p>
                    <p className="mt-1 text-lg font-black">
                      Video, bacaan, dan kelas praktik
                    </p>
                  </div>
                  <div className="grid h-12 w-12 place-items-center rounded-full bg-white text-slate-950 shadow-xl">
                    <PlayCircle className="h-6 w-6" />
                  </div>
                </div>
              </div>
              <div className="grid grid-cols-3 divide-x divide-slate-100 text-center">
                <div className="p-4">
                  <p className="text-2xl font-black">{courses.length || 9}+</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Materi
                  </p>
                </div>
                <div className="p-4">
                  <p className="text-2xl font-black">
                    {videoCount || LEARN_TRACKS.length}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">Video</p>
                </div>
                <div className="p-4">
                  <p className="text-2xl font-black">
                    {readingCount || LEARN_PATHS.length}
                  </p>
                  <p className="mt-1 text-xs font-bold text-slate-500">
                    Bacaan
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200/70 bg-white">
        <div className="mx-auto grid max-w-7xl gap-3 px-4 py-5 sm:grid-cols-2 sm:px-6 lg:grid-cols-4 lg:px-8">
          {[
            {
              label: 'Course user aktif',
              value: `${courses.length || 12}+`,
              icon: 'courses',
              tone: 'bg-emerald-50 text-emerald-700',
            },
            {
              label: 'Total peserta',
              value: totalLearners ? `${totalLearners}+` : 'Terbuka',
              icon: 'learners',
              tone: 'bg-sky-50 text-sky-700',
            },
            {
              label: 'Jalur belajar',
              value: `${LEARN_PATHS.length}`,
              icon: 'paths',
              tone: 'bg-amber-50 text-amber-700',
            },
            {
              label: 'Format materi',
              value: 'Video + baca',
              icon: 'formats',
              tone: 'bg-rose-50 text-rose-700',
            },
          ].map(stat => {
            return (
              <div
                key={stat.label}
                className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <span
                  className={`grid h-11 w-11 shrink-0 place-items-center rounded-2xl ${stat.tone}`}
                >
                  <StatIcon kind={stat.icon} />
                </span>
                <div>
                  <p className="text-lg font-black text-slate-950">
                    {stat.value}
                  </p>
                  <p className="text-xs font-bold text-slate-500">
                    {stat.label}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-700">
              Materi dari creator
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-slate-950">
              Belajar seperti YouTube, lanjut sedalam Udemy.
            </h2>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
              Satu tempat untuk video singkat, bacaan taktis, modul berurutan,
              dan course berbayar dari seller, operator, dan komunitas Lajukan.
            </p>
          </div>
          <Link
            href="/learn"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-slate-200 bg-white px-4 text-sm font-black text-slate-950 shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-200"
          >
            Buka Learn
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="mt-7 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {(courses.length ? courses : fallbackCourses).map((course, index) => {
            const meta = formatKind(course.primary_format);
            return (
              <Link
                key={course.id}
                href={`/learn/${course.slug}`}
                className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white shadow-[0_24px_60px_-46px_rgba(15,23,42,0.5)] transition hover:-translate-y-1 hover:border-emerald-200"
              >
                <div className="relative aspect-video bg-slate-200">
                  <LajukanImage
                    src={courseImage(course, index)}
                    alt={course.title}
                    fill
                    sizes="(min-width: 1280px) 33vw, (min-width: 768px) 50vw, 100vw"
                    className="object-cover transition duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-gradient-to-t from-slate-950/82 to-transparent p-4 text-white">
                    <span
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-black ring-1 ${meta.tone} bg-white`}
                    >
                      <FormatKindIcon format={course.primary_format} />
                      {meta.label}
                    </span>
                    <span className="rounded-full bg-white/14 px-2.5 py-1 text-xs font-black backdrop-blur">
                      {course.level ?? 'Semua level'}
                    </span>
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-500">
                    <span>{course.category ?? 'Bisnis'}</span>
                    <span aria-hidden="true">•</span>
                    <span>{formatMinutes(course.estimated_minutes)}</span>
                    <span aria-hidden="true">•</span>
                    <span>{formatPrice(course)}</span>
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-lg font-black leading-snug text-slate-950">
                    {course.title}
                  </h3>
                  <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-600">
                    {course.summary ??
                      'Materi praktik dari creator Lajukan untuk membantu operasional bisnis berjalan lebih rapi.'}
                  </p>
                  <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-4 text-xs font-bold text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" />
                      {(course.enrollment_count ?? 0).toLocaleString(
                        'id-ID',
                      )}{' '}
                      peserta
                    </span>
                    <span className="inline-flex items-center gap-1.5 text-emerald-700">
                      Buka
                      <ArrowRight className="h-3.5 w-3.5" />
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="bg-white">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 lg:grid-cols-[0.82fr_1.18fr] lg:px-8">
          <div>
            <p className="text-sm font-black uppercase tracking-[0.18em] text-sky-700">
              Jalur belajar
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-slate-950">
              Pilih urutan belajar sesuai kebutuhan bisnis.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Education merapikan materi Learn menjadi alur praktis: mulai dari
              keamanan transaksi, membuat listing, negosiasi, sampai scale
              channel jualan.
            </p>
            <div className="mt-6 rounded-[26px] border border-slate-200 bg-slate-50 p-5">
              <div className="flex items-start gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-slate-950 text-white">
                  <ShieldCheck className="h-5 w-5" />
                </span>
                <div>
                  <h3 className="font-black text-slate-950">
                    Cocok untuk creator dan learner
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-slate-600">
                    Creator bisa membuat materi di Learn, lalu Education
                    membantu user menemukan konteks, urutan, dan panduan aman
                    sebelum praktik di marketplace.
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {LEARN_PATHS.map((path, index) => (
              <article
                key={path.id}
                className="rounded-[26px] border border-slate-200 bg-[#fbfaf7] p-5"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-950 shadow-sm">
                    <span className="text-sm font-black">
                      {(index + 1).toString().padStart(2, '0')}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-600 ring-1 ring-slate-200">
                    <Clock3 className="h-3.5 w-3.5" />
                    Bertahap
                  </span>
                </div>
                <h3 className="mt-5 text-lg font-black text-slate-950">
                  {pickText(locale, path.title)}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {pickText(locale, path.summary)}
                </p>
                <div className="mt-4 space-y-2">
                  {path.modules.slice(0, 3).map(step => (
                    <div
                      key={pickText(locale, step)}
                      className="flex items-start gap-2 text-sm font-semibold text-slate-700"
                    >
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                      <span>{pickText(locale, step)}</span>
                    </div>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[1.05fr_0.95fr]">
          <div className="rounded-[30px] border border-slate-200 bg-slate-950 p-6 text-white shadow-[0_24px_70px_-52px_rgba(15,23,42,0.9)] sm:p-8">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-emerald-200">
              Format belajar
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-normal">
              Dari baca cepat sampai kelas lengkap.
            </h2>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {LEARN_TRACKS.map(track => (
                <div
                  key={track.id}
                  className="rounded-2xl border border-white/12 bg-white/8 p-4"
                >
                  <div className="flex items-start gap-3">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white text-slate-950">
                      {track.id.includes('video') ? (
                        <Video className="h-5 w-5" />
                      ) : track.id.includes('article') ? (
                        <FileText className="h-5 w-5" />
                      ) : (
                        <BookOpen className="h-5 w-5" />
                      )}
                    </span>
                    <div>
                      <h3 className="font-black">
                        {pickText(locale, track.title)}
                      </h3>
                      <p className="mt-1 text-sm leading-6 text-slate-300">
                        {pickText(locale, track.summary)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div
            id="edu-creator"
            className="rounded-[30px] border border-slate-200 bg-white p-6 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)] sm:p-8"
          >
            <div className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700">
              <Sparkles className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-3xl font-black tracking-normal text-slate-950">
              Punya ilmu operasional? Jadikan materi.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Buat course, upload bacaan, tempel link video, atur harga, susun
              modul, lalu kelola draft sampai publish dari Learn Creator Studio.
            </p>
            <div className="mt-5 grid gap-2 text-sm font-semibold text-slate-700">
              {[
                'Video pendek untuk tips cepat',
                'Bacaan untuk checklist dan SOP',
                'Course berurutan dengan modul dan lesson',
                'Materi gratis atau berbayar dari creator',
              ].map(item => (
                <div key={item} className="flex items-start gap-2">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
            <Link
              href="/learn#creator-studio"
              className="mt-7 inline-flex h-12 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-black text-white shadow-[0_18px_44px_-30px_rgba(4,120,87,0.9)] transition hover:-translate-y-0.5 hover:bg-emerald-800"
            >
              Buka Creator Studio
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </section>

      <section className="border-y border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="max-w-2xl">
            <p className="text-sm font-black uppercase tracking-[0.18em] text-amber-700">
              Panduan aman
            </p>
            <h2 className="mt-2 text-3xl font-black tracking-normal text-slate-950">
              Belajar sambil tetap siap transaksi.
            </h2>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              Education tetap menyimpan panduan dasar supaya creator, buyer, dan
              seller tahu apa yang perlu dicek sebelum deal.
            </p>
          </div>

          <div className="mt-7 grid gap-4 md:grid-cols-3">
            {EDUCATION_TOPICS.map((topic, index) => {
              return (
                <article
                  key={topic.id}
                  className="rounded-[26px] border border-slate-200 bg-slate-50 p-5"
                >
                  <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white text-slate-950 shadow-sm">
                    <TopicIcon index={index} />
                  </span>
                  <h3 className="mt-5 text-lg font-black text-slate-950">
                    {pickText(locale, topic.title)}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-600">
                    {pickText(locale, topic.summary)}
                  </p>
                  <div className="mt-4 space-y-2">
                    {[...topic.actions, ...topic.safeguards]
                      .slice(0, 4)
                      .map(item => (
                        <div
                          key={pickText(locale, item)}
                          className="flex items-start gap-2 text-sm font-semibold text-slate-700"
                        >
                          <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                          <span>{pickText(locale, item)}</span>
                        </div>
                      ))}
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
        <div className="grid gap-4 md:grid-cols-3">
          {[
            {
              title: 'Pusat bantuan',
              body: 'Baca aturan transaksi, dispute, refund, dan keamanan akun.',
              href: '/support',
              icon: 'help',
            },
            {
              title: 'Mulai dari Learn',
              body: 'Cari video, artikel, dan course buatan user Lajukan.',
              href: '/learn',
              icon: 'learn',
            },
            {
              title: 'Kelola materi',
              body: 'Buat, edit, susun modul, dan publish course dari satu panel.',
              href: '/learn#creator-studio',
              icon: 'studio',
            },
          ].map(item => {
            return (
              <Link
                key={item.title}
                href={item.href}
                className="group rounded-[26px] border border-slate-200 bg-white p-5 shadow-[0_20px_54px_-44px_rgba(15,23,42,0.5)] transition hover:-translate-y-1 hover:border-emerald-200"
              >
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-slate-950 text-white">
                  <ResourceIcon kind={item.icon} />
                </span>
                <h3 className="mt-5 text-lg font-black text-slate-950">
                  {item.title}
                </h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {item.body}
                </p>
                <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-black text-emerald-700">
                  Buka
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </Link>
            );
          })}
        </div>
      </section>
    </main>
  );
}

const fallbackCourses: LearningCourse[] = [
  {
    id: 'fallback-video-live',
    slug: 'video-live-shopping-umkm',
    title: 'Live shopping UMKM dari nol sampai closing pertama',
    summary:
      'Rangkaian video pendek tentang skrip live, flow demo produk, dan cara membaca chat pembeli.',
    thumbnail_url: '/images/articles/merchant-growth-insights.jpg',
    primary_format: 'video',
    category: 'Penjualan',
    level: 'Pemula',
    estimated_minutes: 42,
    price_cents: 0,
    currency: 'IDR',
    enrollment_count: 128,
    view_count: 760,
    tags: ['live', 'jualan', 'content'],
  },
  {
    id: 'fallback-reading-sop',
    slug: 'sop-order-supplier-reseller',
    title: 'Template SOP order supplier untuk reseller',
    summary:
      'Bacaan praktis untuk mencatat minimum order, termin pembayaran, retur, dan jadwal pickup.',
    thumbnail_url: '/images/articles/warung-digital-story.jpg',
    primary_format: 'reading',
    category: 'Operasional',
    level: 'Menengah',
    estimated_minutes: 18,
    price_cents: 0,
    currency: 'IDR',
    enrollment_count: 96,
    view_count: 410,
    tags: ['supplier', 'sop', 'reseller'],
  },
  {
    id: 'fallback-course-scale',
    slug: 'course-scale-channel-jualan',
    title: 'Scale channel jualan tanpa operasional berantakan',
    summary:
      'Course campuran berisi modul video, checklist, dan latihan sederhana untuk merapikan channel penjualan.',
    thumbnail_url: '/images/articles/komunitas-reseller.jpg',
    primary_format: 'mixed',
    category: 'Growth',
    level: 'Semua level',
    estimated_minutes: 120,
    price_cents: 9900000,
    currency: 'IDR',
    enrollment_count: 74,
    view_count: 380,
    tags: ['growth', 'marketplace', 'ops'],
  },
];
