import { Link } from '@/i18n/navigation';

type PageProps = { params: Promise<{ locale: string }> };

const prohibitedId = [
  'Penipuan, impersonasi, manipulasi informasi, atau klaim usaha yang menyesatkan.',
  'Spam dan aktivitas yang mengganggu layanan.',
  'Barang atau jasa yang dilarang hukum.',
  'Pelecehan, ancaman, kekerasan, diskriminasi, atau doxxing.',
  'Konten seksual/pornografi yang tidak diperbolehkan serta materi yang membahayakan anak.',
  'Penyalahgunaan data pribadi atau identitas pihak lain.',
  'Pelanggaran hak cipta.',
] as const;

const stepsId = [
  'Laporan dikirim lewat sarana pelaporan publik dan mendapat tanda terima.',
  'Sistem menormalisasi alasan, severity, dan membuat atau menghubungkan case.',
  'Reviewer memeriksa konten, konteks, riwayat, dan bukti yang relevan.',
  'Keputusan dicatat dengan alasan terstruktur dan evidence audit, lalu uploader diberi notifikasi.',
  'Pemilik konten dapat mengajukan banding bila keputusan memenuhi syarat.',
  'Banding ditinjau oleh reviewer berbeda dan hasilnya dicatat.',
] as const;

export default async function CommunityGuidelinesPage({ params }: PageProps) {
  const { locale } = await params;
  const isId = locale === 'id';
  const prohibited = isId ? prohibitedId : prohibitedId.map((value) => value);
  return (
    <main className="page-shell page-shell-readable page-rhythm pb-10 pt-4">
      <section className="ui-hero-panel rounded-[28px] p-6 sm:p-8">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-[color:var(--app-accent)]">Community Guidelines</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.04em] text-[color:var(--app-text)] sm:text-3xl">
          {isId ? 'Aturan komunitas dan konten Lajukan' : 'Lajukan community and content rules'}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--app-text-soft)]">
          {isId ? 'Aturan ini menjelaskan konten yang dilarang, mekanisme laporan, tindakan moderasi, dan jalur banding.' : 'These rules explain prohibited content, reporting, moderation actions, and appeals.'}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className="ui-panel rounded-[24px] p-5">
          <h2 className="text-lg font-bold text-[color:var(--app-text)]">{isId ? 'Yang diharapkan' : 'What we expect'}</h2>
          <div className="mt-4 space-y-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
            {(isId ? ['Berikan informasi usaha, harga, lokasi, dan kemampuan secara jujur.','Hormati pengguna lain dan gunakan chat untuk tujuan layanan yang relevan.','Jangan unggah data pribadi pihak lain yang tidak diperlukan.','Gunakan kanal laporan ketika menemukan masalah.'] : ['Provide accurate business information.','Respect other users.','Do not upload unnecessary personal data about others.','Use the reporting channel when you find a problem.']).map(item => <p key={item} className="rounded-2xl bg-[color:var(--app-surface-muted)] px-3 py-2">{item}</p>)}
          </div>
        </article>
        <article className="ui-panel rounded-[24px] p-5">
          <h2 className="text-lg font-bold text-[color:var(--app-text)]">{isId ? 'Konten yang dilarang' : 'Prohibited content'}</h2>
          <div className="mt-4 space-y-2 text-sm leading-6 text-[color:var(--app-text-soft)]">
            {prohibited.map(item => <p key={item} className="rounded-2xl bg-[color:var(--app-surface-muted)] px-3 py-2">{item}</p>)}
          </div>
        </article>
      </section>

      <section className="ui-panel rounded-[24px] p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[color:var(--app-text)]">{isId ? 'Bagaimana laporan diproses' : 'How reports are handled'}</h2>
        <ol className="mt-4 grid gap-3 md:grid-cols-2">
          {(isId ? stepsId : ['A report is submitted through a public reporting channel.','The system normalizes reason and severity and opens a case.','A reviewer checks content, context, history, and evidence.','The decision is logged and the uploader is notified.','Eligible owners can appeal.','Appeals are reviewed by a different reviewer.']).map((item,index) => <li key={item} className="rounded-2xl border border-[color:var(--app-border)] p-4"><span className="text-xs font-bold text-[color:var(--app-accent)]">0{index+1}</span><p className="mt-1 text-sm leading-6 text-[color:var(--app-text-soft)]">{item}</p></li>)}
        </ol>
      </section>

      <section className="ui-panel rounded-[24px] p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[color:var(--app-text)]">{isId ? 'Tindakan moderasi' : 'Moderation actions'}</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {(isId ? [['Perlu revisi','Konten dikembalikan ke pemilik agar diperbaiki.'],['Restrict','Konten disembunyikan selama review.'],['Remove','Konten tidak lagi tersedia untuk publik setelah keputusan.'],['Escalate','Kasus diteruskan ke reviewer senior/legal atau penanganan khusus.'],['Account restriction','Pembatasan akun diproses terpisah dari satu konten.']] : [['Needs revision','Content is returned for correction.'],['Restrict','Content is temporarily hidden during review.'],['Remove','Content is no longer public after a decision.'],['Escalate','Case is moved to a senior/legal workflow.'],['Account restriction','Account sanctions are handled separately.']]).map(([title,body]) => <div key={title} className="rounded-2xl bg-[color:var(--app-surface-muted)] p-4"><p className="font-bold text-[color:var(--app-text)]">{title}</p><p className="mt-1 text-sm leading-6 text-[color:var(--app-text-soft)]">{body}</p></div>)}
        </div>
      </section>

      <section className="ui-panel rounded-[24px] p-5 sm:p-6">
        <h2 className="text-lg font-bold text-[color:var(--app-text)]">{isId ? 'Baca juga' : 'Related'}</h2>
        <div className="mt-4 flex flex-wrap gap-2"><Link href="/privacy" className="ui-button-secondary px-4 py-2 text-sm">Privacy</Link><Link href="/terms" className="ui-button-secondary px-4 py-2 text-sm">Terms</Link><Link href="/trust" className="ui-button-secondary px-4 py-2 text-sm">Trust Center</Link></div>
      </section>
    </main>
  );
}