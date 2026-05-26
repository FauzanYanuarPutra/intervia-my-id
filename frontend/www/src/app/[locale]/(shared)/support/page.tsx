import { LocalizedLink } from '@/components/ui-kit';
import SupportTicketForm from '@/components/support/SupportTicketForm';
import { ArrowUpRight, FileText, WalletCards } from 'lucide-react';
import { buildUsahaPath } from '@/lib/umkmSurface';

const supportRoutes = [
  {
    title: 'Tidak bisa masuk / verifikasi',
    desc: 'Login, OTP, dan akun.',
    href: '/support#account',
    icon: <FileText className="h-4 w-4" />,
  },
  {
    title: 'Transaksi / pembayaran',
    desc: 'Order, dana masuk, dan payout.',
    href: '/support#transactions',
    icon: <WalletCards className="h-4 w-4" />,
  },
  {
    title: 'Toko / katalog / operasional',
    desc: 'Masuk ke workspace usaha.',
    href: buildUsahaPath('home'),
    icon: <FileText className="h-4 w-4" />,
  },
];

export default function SupportPage() {
  return (
    <main className="page-shell page-rhythm pb-6 pt-4 lg:pb-8">
      <section className="ui-panel ui-hero-panel p-4">
          <p className="ui-page-eyebrow">Pusat bantuan</p>
          <h1 className="ui-page-title mt-2">Pilih jalur bantuan.</h1>
          <p className="ui-page-copy mt-2">
            Pilih yang paling dekat. Kalau masih mentok, kirim tiket singkat.
          </p>

          <div className="mt-4">
            <LocalizedLink
              href={buildUsahaPath('home')}
              className="ui-button-secondary inline-flex items-center gap-2 rounded-full px-4 text-sm font-semibold"
            >
              Kelola usaha
            </LocalizedLink>
          </div>

          <div className="ui-page-link-grid mt-4 md:grid-cols-2">
            {supportRoutes.map(route => (
              <LocalizedLink
                key={route.href}
                href={route.href}
                className="ui-page-link-card p-4"
              >
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-2xl bg-[color:var(--route-accent-soft)] text-[color:var(--route-accent)]">
                  {route.icon}
                </span>
                <h2 className="mt-3 text-sm font-black text-[color:var(--app-text)]">
                  {route.title}
                </h2>
                <p className="mt-1 text-xs text-[color:var(--app-text-soft)]">
                  {route.desc}
                </p>
                <p className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[color:var(--route-accent)]">
                  Buka
                  <ArrowUpRight className="h-3.5 w-3.5" />
                </p>
              </LocalizedLink>
            ))}
          </div>
      </section>

      <section className="ui-panel p-4">
          <p className="ui-page-eyebrow">Kirim tiket</p>
          <h2 className="mt-2 text-lg font-black text-[color:var(--app-text)]">
            Masih belum ketemu?
          </h2>
          <p className="mt-2 text-sm text-[color:var(--app-text-soft)]">
            Tulis singkat saja.
          </p>
          <div className="mt-4">
            <SupportTicketForm />
          </div>
      </section>
    </main>
  );
}
