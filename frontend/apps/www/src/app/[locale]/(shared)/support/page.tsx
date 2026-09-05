import { LocalizedLink } from '@/components/ui-kit';
import SupportTicketForm from '@/components/support/SupportTicketForm';
import { ArrowRight, BookOpenCheck, Building2, CheckCircle2, Clock3, FileText, ImageIcon, LifeBuoy, MessageCircle, ShieldCheck, UserRoundCheck, type LucideIcon } from 'lucide-react';
import { buildUsahaPath } from '@/lib/umkmSurface';

type SupportTopic = { title: string; desc: string; href: string; icon: LucideIcon };
const supportTopics: SupportTopic[] = [
  { title: 'Akun & login', desc: 'Login Google, sesi akun, akses ditolak, atau akun tidak terbaca.', href: '#ticket', icon: UserRoundCheck },
  { title: 'Posting & media', desc: 'Foto, video, draft, atau listing yang sulit diedit.', href: '#ticket', icon: ImageIcon },
  { title: 'Chat & komunitas', desc: 'Pesan, room chat, forum, komentar, atau notifikasi.', href: '#ticket', icon: MessageCircle },
  { title: 'Usaha & katalog', desc: 'Profil usaha, katalog, lokasi, tim, dan halaman toko.', href: buildUsahaPath('home'), icon: Building2 },
];
const supportStats = [
  { label: 'Buat ticket', value: '1 menit', icon: FileText },
  { label: 'Pantau status', value: 'Realtime', icon: Clock3 },
  { label: 'Konteks rapi', value: 'Aman', icon: ShieldCheck },
];
const beforeSend = [
  'Tulis masalah paling inti dulu.',
  'Sertakan email akun Lajukan yang dipakai.',
  'Tambahkan link posting, chat, atau screenshot bila ada.',
  'Kalau ada ID transaksi lama, tulis di kronologi.',
];
const helpShortcuts = [
  { label: 'Saya tidak bisa masuk', hint: 'Login Google, sesi akun, akses akun' },
  { label: 'Gambar/video tidak muncul', hint: 'Upload, preview, format file' },
  { label: 'Chat tidak nyambung', hint: 'DM, grup, support room' },
  { label: 'Listing saya salah', hint: 'Judul, kategori, foto, status' },
];

export default function SupportPage() {
  return (
    <main className="page-shell page-rhythm pb-8 pt-3 lg:pb-10">
      <section className="ui-hero-panel p-4 sm:p-5">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px] lg:items-center">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2"><span className="inline-flex h-10 w-10 items-center justify-center rounded-[14px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] ring-1 ring-[color:var(--app-accent-border)]"><LifeBuoy className="h-5 w-5" /></span><span className="ui-page-eyebrow">Pusat bantuan Lajukan</span></div>
            <h1 className="mt-4 max-w-3xl text-2xl font-bold leading-tight tracking-tight text-[color:var(--app-text)] sm:text-3xl lg:text-[2.35rem]">Ada kendala? Pilih jalur paling dekat, lalu kirim konteks singkat.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-[color:var(--app-text-soft)]">Bantuan difokuskan ke akun, listing, media, chat, komunitas, dan halaman usaha. Buat ticket kalau belum ketemu jawaban yang pas.</p>
            <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center"><LocalizedLink href="#ticket" className="ui-button-primary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">Buat ticket bantuan<ArrowRight className="h-4 w-4" /></LocalizedLink><LocalizedLink href="/support?openLive=1#ticket" className="ui-button-secondary inline-flex items-center justify-center gap-2 px-4 text-sm font-semibold">Buka chat & AI<MessageCircle className="h-4 w-4" /></LocalizedLink></div>
          </div>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">{supportStats.map(item => { const Icon=item.icon; return <div key={item.label} className="flex items-center gap-3 rounded-[16px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] px-3 py-2.5"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-[12px] bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)]"><Icon className="h-4 w-4" /></span><span className="min-w-0"><span className="block text-sm font-bold text-[color:var(--app-text)]">{item.value}</span><span className="block truncate text-xs font-semibold text-[color:var(--app-text-soft)]">{item.label}</span></span></div>; })}</div>
        </div>
      </section>
      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{supportTopics.map(topic => { const Icon=topic.icon; return <LocalizedLink key={topic.title} href={topic.href} className="group rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)]"><div className="flex items-start gap-3"><span className="grid h-10 w-10 shrink-0 place-items-center rounded-[14px] bg-[color:var(--app-surface-muted)] text-[color:var(--app-accent)]"><Icon className="h-4.5 w-4.5" /></span><span className="min-w-0 flex-1"><span className="block text-sm font-bold text-[color:var(--app-text)]">{topic.title}</span><span className="mt-1 block text-xs font-semibold leading-5 text-[color:var(--app-text-soft)]">{topic.desc}</span></span><ArrowRight className="mt-1 h-4 w-4 shrink-0 text-[color:var(--app-text-soft)] transition group-hover:translate-x-0.5 group-hover:text-[color:var(--app-accent)]" /></div></LocalizedLink>; })}</section>
      <section className="grid gap-4 lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
        <div className="ui-panel p-4 sm:p-5"><div className="flex items-start gap-3"><span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-[14px] bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]"><BookOpenCheck className="h-5 w-5" /></span><div><p className="ui-page-eyebrow">Sebelum kirim</p><h2 className="mt-1 text-lg font-bold text-[color:var(--app-text)]">Biar support langsung paham.</h2></div></div><div className="mt-4 space-y-2">{beforeSend.map(item => <div key={item} className="flex items-start gap-3 rounded-[14px] bg-[color:var(--app-surface)] px-3 py-2.5 text-sm font-semibold text-[color:var(--app-text-soft)]"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[color:var(--app-accent)]" /><span>{item}</span></div>)}</div></div>
        <div className="ui-panel p-4 sm:p-5"><div className="flex flex-wrap items-end justify-between gap-3"><div><p className="ui-page-eyebrow">Masalah umum</p><h2 className="mt-1 text-lg font-bold text-[color:var(--app-text)]">Pilih contoh, lalu lanjut ke ticket.</h2></div><LocalizedLink href="#ticket" className="ui-button-secondary inline-flex items-center gap-2 px-3 text-xs font-semibold">Tulis ticket<ArrowRight className="h-3.5 w-3.5" /></LocalizedLink></div><div className="mt-4 grid gap-2 sm:grid-cols-2">{helpShortcuts.map(item => <LocalizedLink key={item.label} href="#ticket" className="group rounded-[14px] border border-[color:var(--app-border)] bg-[color:var(--app-surface)] p-3 transition hover:border-[color:var(--app-accent-border)] hover:bg-[color:var(--app-accent-soft)]"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-bold text-[color:var(--app-text)]">{item.label}</p><p className="mt-1 text-xs font-semibold text-[color:var(--app-text-soft)]">{item.hint}</p></div><ArrowRight className="mt-0.5 h-4 w-4 text-[color:var(--app-accent)] transition group-hover:translate-x-0.5" /></div></LocalizedLink>)}</div></div>
      </section>
      <section id="ticket" className="scroll-mt-24"><div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between"><div><p className="ui-page-eyebrow">Kirim ticket</p><h2 className="mt-1 text-xl font-bold text-[color:var(--app-text)] sm:text-2xl">Jelaskan kendalanya. Statusnya bisa dipantau setelah dibuat.</h2></div><p className="max-w-md text-sm leading-6 text-[color:var(--app-text-soft)]">Gunakan satu ticket untuk satu masalah supaya follow-up tidak tercampur.</p></div><SupportTicketForm /></section>
    </main>
  );
}
