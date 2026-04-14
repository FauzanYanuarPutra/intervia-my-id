import { Link } from '@/i18n/navigation';
import { pickText } from '@/data/trustCenter';
import {
  EDUCATION_HERO,
  EDUCATION_TOPICS,
} from '@/data/educationHub';
import {
  AnchorLink,
  InfoChips,
  SummaryCard,
  TrustBadge,
} from '@/components/trust/TrustUI';
import {
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  ShieldCheck,
} from 'lucide-react';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function EducationPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';

  return (
    <div className="min-h-screen bg-[color:var(--app-surface-muted)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="page-shell space-y-6 py-6">
        <SummaryCard
          title={pickText(locale, EDUCATION_HERO.title)}
          description={pickText(locale, EDUCATION_HERO.description)}
          meta={isId ? 'Edukasi' : 'Education'}
        >
          <InfoChips items={EDUCATION_HERO.chips.map((chip) => pickText(locale, chip))} />
          <AnchorLink href="#edu-topics" label={isId ? 'Topik utama' : 'Core topics'} />
          <AnchorLink href="#edu-actions" label={isId ? 'Langkah aman' : 'Safety steps'} />
          <AnchorLink href="#edu-resources" label={isId ? 'Resource' : 'Resources'} />
          <Link href="/learn" className="ui-button-primary inline-flex items-center px-4 text-sm">
            {isId ? 'Mulai belajar' : 'Start learning'}
          </Link>
        </SummaryCard>

        <section id="edu-topics" className="space-y-3">
          <div className="flex items-center gap-2">
            <TrustBadge label={isId ? 'PANDUAN' : 'GUIDE'} />
            <h2 className="text-lg font-bold text-[color:var(--app-text)]">
              {isId ? 'Panduan per kebutuhan usaha' : 'Guides by business need'}
            </h2>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {EDUCATION_TOPICS.map((topic) => (
              <article
                key={topic.id}
                className="ui-panel rounded-[20px] p-4 space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h3 className="text-base font-semibold text-[color:var(--app-text)]">
                      {pickText(locale, topic.title)}
                    </h3>
                    <p className="mt-1 text-sm text-[color:var(--app-text-soft)]">
                      {pickText(locale, topic.summary)}
                    </p>
                  </div>
                  <ShieldCheck className="h-5 w-5 text-[color:var(--app-accent)]" />
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-[color:var(--app-warning)]">
                    <AlertTriangle className="h-4 w-4" />
                    <span className="font-semibold">{isId ? 'Risiko utama' : 'Main risks'}</span>
                  </div>
                  <ul className="space-y-1 text-[color:var(--app-text-soft)]">
                    {topic.risks.map((risk) => (
                      <li key={pickText(locale, risk)} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--app-warning)]" />
                        <span>{pickText(locale, risk)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-[color:var(--app-accent)]">
                    <CheckCircle2 className="h-4 w-4" />
                    <span className="font-semibold">{isId ? 'Langkah aman' : 'Safe steps'}</span>
                  </div>
                  <ul className="space-y-1 text-[color:var(--app-text-soft)]">
                    {topic.actions.map((action) => (
                      <li key={pickText(locale, action)} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--app-accent)]" />
                        <span>{pickText(locale, action)}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2 text-[color:var(--app-info)]">
                    <BookOpen className="h-4 w-4" />
                    <span className="font-semibold">
                      {isId ? 'Proteksi Lajukan' : 'Lajukan safeguards'}
                    </span>
                  </div>
                  <ul className="space-y-1 text-[color:var(--app-text-soft)]">
                    {topic.safeguards.map((item) => (
                      <li key={pickText(locale, item)} className="flex items-start gap-2">
                        <span className="mt-2 h-1.5 w-1.5 rounded-full bg-[color:var(--app-info)]" />
                        <span>{pickText(locale, item)}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section id="edu-actions" className="ui-panel rounded-[20px] p-4 space-y-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-[color:var(--app-accent)]" />
            <h2 className="text-base font-semibold text-[color:var(--app-text)]">
              {isId ? 'Langkah cepat saat supply atau transaksi bermasalah' : 'Fast steps when supply or transactions break'}
            </h2>
          </div>
          <ol className="space-y-2 text-sm text-[color:var(--app-text-soft)]">
            <li className="flex gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-xs font-bold text-[color:var(--app-accent)]">
                1
              </span>
              <span>
                {isId
                  ? 'Hentikan transaksi di luar aplikasi. Simpan chat, invoice, foto barang, dan file pendukung.'
                  : 'Stop any off-platform transaction. Save chat, invoices, item photos, and supporting files.'}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-xs font-bold text-[color:var(--app-accent)]">
                2
              </span>
              <span>
                {isId
                  ? 'Laporkan dari halaman listing, chat, atau order, sertakan detail supplier, jasa, atau shipment yang bermasalah.'
                  : 'Report from the listing, chat, or order and attach the supplier, service, or shipment details.'}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-xs font-bold text-[color:var(--app-accent)]">
                3
              </span>
              <span>
                {isId
                  ? 'Aktifkan dispute dan eskalasi jika deal, shipment, atau pekerjaan sudah berjalan.'
                  : 'Trigger disputes and escalation if the deal, shipment, or work is already in progress.'}
              </span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 inline-flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-xs font-bold text-[color:var(--app-accent)]">
                4
              </span>
              <span>
                {isId
                  ? 'Update keamanan akun: ganti password, aktifkan MFA.'
                  : 'Secure your account: change password and enable MFA.'}
              </span>
            </li>
          </ol>
          <div className="flex flex-wrap gap-2">
            <Link href="/support" className="ui-button-primary inline-flex items-center px-4 text-sm">
              {isId ? 'Hubungi Support' : 'Contact support'}
            </Link>
            <Link href="/trust" className="ui-button-secondary inline-flex items-center px-4 text-sm">
              {isId ? 'Lihat Trust Center' : 'Open Trust Center'}
            </Link>
          </div>
        </section>

        <section id="edu-resources" className="ui-panel rounded-[20px] p-4 space-y-2">
          <h2 className="text-base font-semibold text-[color:var(--app-text)]">
            {isId ? 'Resource dan standar operasional aman' : 'Resources and safe operating standards'}
          </h2>
          <p className="text-sm text-[color:var(--app-text-soft)]">
            {isId
              ? 'Semua deal supplier, jasa, storefront, dan pengiriman mengikuti kebijakan Lajukan, escrow, dan audit trail. Panduan lengkap tersedia di Trust Center.'
              : 'All supplier, service, storefront, and delivery flows follow Lajukan policies, escrow, and audit trails. Full guidance is in Trust Center.'}
          </p>
          <div className="flex flex-wrap gap-2">
            <Link href="/trust/security" className="ui-button-secondary inline-flex items-center px-4 text-sm">
              {isId ? 'Keamanan' : 'Security'}
            </Link>
            <Link href="/trust/privacy-data-rights" className="ui-button-secondary inline-flex items-center px-4 text-sm">
              {isId ? 'Hak Data' : 'Data Rights'}
            </Link>
            <Link href="/trust/payments" className="ui-button-secondary inline-flex items-center px-4 text-sm">
              {isId ? 'Pembayaran' : 'Payments'}
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}
