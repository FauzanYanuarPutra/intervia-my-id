import { LocalizedLink } from '@/components/ui-kit';
import SupportTicketForm from '@/components/support/SupportTicketForm';
import {
  ArrowRight,
  BadgeCheck,
  BookOpenCheck,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileText,
  ImageIcon,
  LifeBuoy,
  MessageCircle,
  Search,
  ShieldCheck,
  Sparkles,
  UserRoundCheck,
} from 'lucide-react';
import { buildUsahaPath } from '@/lib/umkmSurface';

const supportTopics = [
  {
    title: 'Akun & login',
    desc: 'OTP, password, akun terkunci, atau nomor WhatsApp belum terbaca.',
    href: '#ticket',
    accent: 'from-emerald-500 to-teal-500',
    icon: UserRoundCheck,
  },
  {
    title: 'Posting & media',
    desc: 'Foto tidak muncul, video gagal preview, listing sulit diedit.',
    href: '#ticket',
    accent: 'from-sky-500 to-cyan-500',
    icon: ImageIcon,
  },
  {
    title: 'Chat & komunitas',
    desc: 'Pesan tidak terkirim, room chat hilang, atau forum bermasalah.',
    href: '#ticket',
    accent: 'from-amber-500 to-orange-500',
    icon: MessageCircle,
  },
  {
    title: 'Usaha & katalog',
    desc: 'Profil usaha, katalog, lokasi, tim, dan halaman toko.',
    href: buildUsahaPath('home'),
    accent: 'from-lime-500 to-emerald-500',
    icon: Building2,
  },
];

const supportStats = [
  { label: 'Buat ticket', value: '1 menit', icon: FileText },
  { label: 'Cek status', value: 'Real-time', icon: Clock3 },
  { label: 'Aman', value: 'Rapi', icon: ShieldCheck },
];

const beforeSend = [
  'Tulis masalah paling inti dulu.',
  'Sertakan email/nomor akun yang dipakai.',
  'Tambahkan link posting, room chat, atau screenshot bila ada.',
  'Kalau ada ID transaksi lama, tulis di kronologi.',
];

const helpShortcuts = [
  {
    label: 'Saya tidak bisa masuk',
    hint: 'OTP, password, sesi login',
  },
  {
    label: 'Gambar/video tidak muncul',
    hint: 'Upload, preview, format file',
  },
  {
    label: 'Chat tidak nyambung',
    hint: 'DM, grup, support room',
  },
  {
    label: 'Listing saya salah',
    hint: 'Judul, kategori, foto, status',
  },
];

export default function SupportPage() {
  return (
    <main className="page-shell overflow-hidden pb-8 pt-3 lg:pb-10">
      <section className="relative overflow-hidden rounded-[32px] border border-emerald-900/10 bg-[radial-gradient(circle_at_18%_12%,rgba(16,185,129,0.22),transparent_30%),radial-gradient(circle_at_88%_18%,rgba(14,165,233,0.18),transparent_26%),linear-gradient(135deg,#f7fff9_0%,#ffffff_46%,#eefdf5_100%)] p-4 shadow-[0_30px_80px_-62px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-[radial-gradient(circle_at_18%_12%,rgba(16,185,129,0.16),transparent_30%),linear-gradient(135deg,#07110d_0%,#0f172a_58%,#062018_100%)] sm:p-5 lg:p-6">
        <div
          className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-emerald-300/28 blur-3xl"
          aria-hidden="true"
        />
        <div
          className="pointer-events-none absolute -bottom-24 left-1/4 h-56 w-56 rounded-full bg-cyan-300/24 blur-3xl"
          aria-hidden="true"
        />

        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1.1fr)_380px] lg:items-stretch">
          <div className="flex min-h-[360px] flex-col justify-between rounded-[28px] bg-white/72 p-5 ring-1 ring-white/80 backdrop-blur dark:bg-white/[0.06] dark:ring-white/10 sm:p-6">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] bg-emerald-600 text-white shadow-[0_16px_34px_-24px_rgba(5,150,105,0.7)]">
                  <LifeBuoy className="h-5 w-5" />
                </span>
                <span className="rounded-full border border-emerald-700/10 bg-white/82 px-3 py-1 text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 shadow-sm dark:border-white/10 dark:bg-white/10 dark:text-emerald-200">
                  Pusat bantuan Lajukan
                </span>
              </div>

              <h1 className="mt-5 max-w-3xl text-[2.25rem] font-black leading-[0.98] tracking-[-0.065em] text-slate-950 dark:text-white sm:text-[3.4rem] lg:text-[4.2rem]">
                Ada kendala? Kita bereskan satu-satu.
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-700 dark:text-slate-200 sm:text-base">
                Pilih bantuan cepat, tulis kronologi singkat, lalu pantau status
                ticket. Fokus sekarang: akun, listing, media, chat, komunitas,
                dan halaman usaha.
              </p>
            </div>

            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:items-center">
              <LocalizedLink
                href="#ticket"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-emerald-700 px-5 text-sm font-black text-white shadow-[0_18px_38px_-26px_rgba(4,120,87,0.75)] transition hover:-translate-y-0.5 hover:bg-emerald-800"
              >
                Buat ticket bantuan
                <ArrowRight className="h-4 w-4" />
              </LocalizedLink>
              <LocalizedLink
                href="/support?openLive=1#ticket"
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-emerald-800/10 bg-white/88 px-5 text-sm font-black text-slate-900 shadow-sm transition hover:-translate-y-0.5 hover:bg-white dark:border-white/10 dark:bg-white/10 dark:text-white"
              >
                Buka chat & AI
                <Sparkles className="h-4 w-4 text-emerald-600" />
              </LocalizedLink>
            </div>
          </div>

          <aside className="grid gap-3 rounded-[28px] bg-slate-950 p-4 text-white shadow-[0_30px_70px_-50px_rgba(2,6,23,0.9)]">
            <div className="rounded-[24px] bg-white/10 p-4 ring-1 ring-white/10">
              <p className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-200">
                Jalur cepat
              </p>
              <h2 className="mt-2 text-2xl font-black tracking-[-0.04em]">
                Cari dulu, kalau belum ketemu langsung ticket.
              </h2>
              <div className="mt-4 flex min-h-12 items-center gap-2 rounded-full bg-white px-3 text-slate-900">
                <Search className="h-4 w-4 text-emerald-700" />
                <span className="text-sm font-bold text-slate-500">
                  Contoh: foto tidak muncul
                </span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {supportStats.map(item => {
                const Icon = item.icon;
                return (
                  <div
                    key={item.label}
                    className="rounded-[20px] bg-white/[0.08] p-3 ring-1 ring-white/10"
                  >
                    <Icon className="h-4 w-4 text-emerald-200" />
                    <p className="mt-3 text-base font-black">{item.value}</p>
                    <p className="mt-0.5 text-[10px] font-bold text-white/58">
                      {item.label}
                    </p>
                  </div>
                );
              })}
            </div>

            <div className="rounded-[24px] bg-emerald-400/12 p-4 ring-1 ring-emerald-300/20">
              <div className="flex items-start gap-3">
                <BadgeCheck className="mt-0.5 h-5 w-5 text-emerald-200" />
                <div>
                  <p className="text-sm font-black">Tips biar cepat dibalas</p>
                  <p className="mt-1 text-xs leading-5 text-white/68">
                    Kirim subjek jelas, link posting/chat kalau ada, dan
                    kronologi singkat. Semakin rapi, triase makin cepat.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {supportTopics.map(topic => {
          const Icon = topic.icon;
          return (
            <LocalizedLink
              key={topic.title}
              href={topic.href}
              className="group overflow-hidden rounded-[26px] border border-slate-200 bg-white p-3 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_30px_60px_-44px_rgba(15,23,42,0.35)] dark:border-white/10 dark:bg-white/[0.04]"
            >
              <div
                className={`flex h-24 items-start justify-between rounded-[22px] bg-gradient-to-br ${topic.accent} p-4 text-white`}
              >
                <Icon className="h-6 w-6" />
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/18 transition group-hover:translate-x-0.5">
                  <ChevronRight className="h-4 w-4" />
                </span>
              </div>
              <h2 className="mt-4 text-base font-black tracking-[-0.02em] text-slate-950 dark:text-white">
                {topic.title}
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-600 dark:text-slate-300">
                {topic.desc}
              </p>
            </LocalizedLink>
          );
        })}
      </section>

      <section className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
        <div className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.2)] dark:border-white/10 dark:bg-white/[0.04] sm:p-5">
          <div className="flex items-center gap-3">
            <span className="inline-flex h-11 w-11 items-center justify-center rounded-[18px] bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100 dark:bg-emerald-400/10 dark:text-emerald-200 dark:ring-emerald-300/15">
              <BookOpenCheck className="h-5 w-5" />
            </span>
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                Sebelum kirim
              </p>
              <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
                Biar support langsung paham.
              </h2>
            </div>
          </div>

          <div className="mt-4 space-y-2">
            {beforeSend.map(item => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-[18px] bg-slate-50 p-3 text-sm text-slate-700 dark:bg-white/[0.05] dark:text-slate-200"
              >
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[28px] border border-slate-200 bg-[linear-gradient(135deg,#ffffff,#f7fbf8)] p-4 shadow-[0_18px_44px_-38px_rgba(15,23,42,0.2)] dark:border-white/10 dark:bg-white/[0.04] sm:p-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
                Pilih contoh
              </p>
              <h2 className="text-xl font-black tracking-[-0.04em] text-slate-950 dark:text-white">
                Masalah yang sering terjadi.
              </h2>
            </div>
            <LocalizedLink
              href="#ticket"
              className="inline-flex min-h-10 items-center gap-2 rounded-full bg-slate-950 px-4 text-xs font-black text-white transition hover:bg-slate-800 dark:bg-white dark:text-slate-950"
            >
              Tulis ticket
              <ArrowRight className="h-3.5 w-3.5" />
            </LocalizedLink>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {helpShortcuts.map(item => (
              <LocalizedLink
                key={item.label}
                href="#ticket"
                className="group rounded-[20px] border border-slate-200 bg-white p-3 transition hover:border-emerald-200 hover:bg-emerald-50/60 dark:border-white/10 dark:bg-white/[0.04] dark:hover:bg-emerald-400/10"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-950 dark:text-white">
                      {item.label}
                    </p>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-300">
                      {item.hint}
                    </p>
                  </div>
                  <ArrowRight className="mt-0.5 h-4 w-4 text-emerald-600 transition group-hover:translate-x-0.5" />
                </div>
              </LocalizedLink>
            ))}
          </div>
        </div>
      </section>

      <section id="ticket" className="mt-5 scroll-mt-24">
        <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-200">
              Kirim ticket
            </p>
            <h2 className="mt-1 text-2xl font-black tracking-[-0.045em] text-slate-950 dark:text-white">
              Jelaskan kendalanya, nanti statusnya bisa dipantau.
            </h2>
          </div>
          <p className="max-w-md text-sm leading-6 text-slate-600 dark:text-slate-300">
            Untuk fase awal, support difokuskan ke akun, listing, media, chat,
            komunitas, dan profil usaha.
          </p>
        </div>
        <SupportTicketForm />
      </section>
    </main>
  );
}
