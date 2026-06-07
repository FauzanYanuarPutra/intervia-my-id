import { LocalizedLink } from '@/components/ui-kit';
import SupportTicketForm from '@/components/support/SupportTicketForm';
import {
  ArrowUpRight,
  Building2,
  Clock3,
  LifeBuoy,
  MessageCircle,
  ReceiptText,
  ShieldCheck,
  WalletCards,
} from 'lucide-react';
import { buildUsahaPath } from '@/lib/umkmSurface';

const supportRoutes = [
  {
    title: 'Tidak bisa masuk / verifikasi',
    desc: 'OTP, password, sesi akun, dan akses workspace.',
    href: '#ticket',
    icon: <ShieldCheck className="h-4 w-4" />,
  },
  {
    title: 'Transaksi / pembayaran',
    desc: 'Order, escrow, refund, dana masuk, dan payout.',
    href: '#ticket',
    icon: <WalletCards className="h-4 w-4" />,
  },
  {
    title: 'Toko / katalog / operasional',
    desc: 'Kelola toko, katalog, QR, order, dan tim.',
    href: buildUsahaPath('home'),
    icon: <Building2 className="h-4 w-4" />,
  },
];

const supportSignals = [
  {
    label: 'Ticket rapi',
    desc: 'Subjek, kategori, prioritas, dan kronologi masuk ke satu alur.',
    icon: <ReceiptText className="h-4 w-4" />,
  },
  {
    label: 'Chat tersimpan',
    desc: 'Balasan agent dan chat support tetap nyambung ke ticket.',
    icon: <MessageCircle className="h-4 w-4" />,
  },
  {
    label: 'Follow up jelas',
    desc: 'Login untuk pantau status ticket dan update terakhir.',
    icon: <Clock3 className="h-4 w-4" />,
  },
];

export default function SupportPage() {
  return (
    <main className="page-shell pb-8 pt-4 lg:pb-10">
      <section className="grid gap-4 lg:grid-cols-[minmax(0,1.25fr)_minmax(280px,0.75fr)]">
        <div className="ui-panel p-5 sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,_var(--route-accent)_32%,_var(--app-border))] bg-[color:color-mix(in_srgb,_var(--route-accent)_10%,_var(--app-surface-strong))] text-[color:var(--route-accent)]">
              <LifeBuoy className="h-5 w-5" />
            </span>
            <p className="ui-page-eyebrow">Pusat bantuan</p>
          </div>

          <h1 className="ui-page-title mt-4 max-w-3xl">
            Bantuan yang langsung nyambung ke masalah Anda.
          </h1>
          <p className="ui-page-copy mt-3 max-w-2xl">
            Pilih jalur cepat untuk akun, transaksi, atau workspace usaha. Kalau
            belum ketemu, buat ticket dengan kronologi singkat dan ID transaksi
            bila ada.
          </p>

          <div className="mt-5 flex flex-wrap gap-2">
            <LocalizedLink
              href="#ticket"
              className="ui-button-primary inline-flex items-center gap-2 rounded-full px-4 text-sm font-semibold"
            >
              Buat ticket
              <ArrowUpRight className="h-4 w-4" />
            </LocalizedLink>
            <LocalizedLink
              href={buildUsahaPath('home')}
              className="ui-button-secondary inline-flex items-center gap-2 rounded-full px-4 text-sm font-semibold"
            >
              Kelola usaha
            </LocalizedLink>
          </div>
        </div>

        <aside className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
          {supportSignals.map(item => (
            <div key={item.label} className="ui-panel p-4">
              <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] text-[color:var(--route-accent)]">
                {item.icon}
              </span>
              <h2 className="mt-3 text-sm font-black text-[color:var(--app-text)]">
                {item.label}
              </h2>
              <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
                {item.desc}
              </p>
            </div>
          ))}
        </aside>
      </section>

      <section className="mt-4 grid gap-3 md:grid-cols-3">
        {supportRoutes.map(route => (
          <LocalizedLink
            key={route.title}
            href={route.href}
            className="ui-panel group p-4 transition hover:border-[color:color-mix(in_srgb,_var(--route-accent)_44%,_var(--app-border))] hover:shadow-md"
          >
            <span className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border border-[color:color-mix(in_srgb,_var(--route-accent)_24%,_var(--app-border))] bg-[color:color-mix(in_srgb,_var(--route-accent)_8%,_var(--app-surface-strong))] text-[color:var(--route-accent)]">
              {route.icon}
            </span>
            <h2 className="mt-3 text-sm font-black text-[color:var(--app-text)]">
              {route.title}
            </h2>
            <p className="mt-1 text-xs leading-5 text-[color:var(--app-text-soft)]">
              {route.desc}
            </p>
            <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[color:var(--route-accent)]">
              Buka
              <ArrowUpRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
            </p>
          </LocalizedLink>
        ))}
      </section>

      <section id="ticket" className="mt-5 scroll-mt-24">
        <div className="mb-3 flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="ui-page-eyebrow">Kirim ticket</p>
            <h2 className="mt-1 text-xl font-black text-[color:var(--app-text)]">
              Jelaskan kendalanya, biar cepat ditangani.
            </h2>
          </div>
          <p className="max-w-md text-sm text-[color:var(--app-text-soft)]">
            Sertakan ID transaksi, email akun, dan bukti singkat kalau ada.
            Detail kecil sering mempercepat triase.
          </p>
        </div>
        <SupportTicketForm />
      </section>
    </main>
  );
}
