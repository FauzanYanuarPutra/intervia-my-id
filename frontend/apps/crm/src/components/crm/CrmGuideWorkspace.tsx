'use client';

import type { PageId } from './types';

type GuideItem = {
  id: PageId;
  title: string;
  purpose: string;
  input: string;
  action: string;
  effect: string;
};

const GUIDE: GuideItem[] = [
  {
    id: 'dashboard',
    title: 'Hari ini',
    purpose: 'Beranda operasional untuk melihat pekerjaan yang benar-benar perlu ditangani sekarang.',
    input: 'Lead aktif, chat belum dibaca, tiket, risiko order/user, listing terlapor, dan News pending.',
    action: 'Klik prioritas untuk langsung masuk ke workspace terkait.',
    effect: 'CRM menjadi antrean kerja, bukan sekadar dashboard angka.',
  },
  {
    id: 'pipeline',
    title: 'Pipeline / Lead',
    purpose: 'Mengelola calon pelanggan atau peluang yang belum selesai menjadi transaksi.',
    input: 'Lead dari form, chat, aktivitas, atau sumber integrasi yang membuat peluang bisnis.',
    action: 'Kualifikasi → follow-up → negosiasi → deal atau lost.',
    effect: 'Tim tahu siapa yang harus dihubungi, tahapnya apa, dan peluang mana yang masih terbuka.',
  },
  {
    id: 'users',
    title: 'Kontak & User',
    purpose: 'Melihat identitas pengguna, status verifikasi, trust, transaksi, dan risiko.',
    input: 'Direktori user real dari Identity + profil Trust/Order yang tersedia.',
    action: 'Review profil, KYC/trust, hold, dan data terkait sebelum mengambil tindakan.',
    effect: 'Keputusan operasional punya konteks orang yang benar, bukan hanya ID.',
  },
  {
    id: 'businesses',
    title: 'Usaha',
    purpose: 'Memeriksa apakah profil UMKM/usaha layak ditampilkan dan dipercaya.',
    input: 'Profil usaha, kelengkapan data, laporan, evidence, verification, appeal.',
    action: 'Review → request completion / approve / hide / reject / escalate sesuai kasus.',
    effect: 'Data usaha publik tetap tertata dan punya jejak keputusan.',
  },
  {
    id: 'listings',
    title: 'Moderasi Listing',
    purpose: 'Menangani laporan user terhadap listing dan konten marketplace yang bermasalah.',
    input: 'Listing + report/support ticket yang dapat dicocokkan.',
    action: 'Tinjau laporan lalu ambil tindakan moderasi yang tersedia.',
    effect: 'Listing bisa dipertahankan, diperbaiki, disembunyikan, atau dieskalasi dengan audit.',
  },
  {
    id: 'news',
    title: 'News Editorial',
    purpose: 'Menjadi newsroom internal untuk semua kiriman News sebelum tampil publik.',
    input: 'News submission + source references + fact-check + legal review + audit history.',
    action: 'Verifikasi sumber → fact-check → legal gate bila sensitif → approve/publish atau revisi/tolak.',
    effect: 'Tidak ada News yang otomatis dianggap publik hanya karena berhasil submit.',
  },
  {
    id: 'transactions',
    title: 'Transactions',
    purpose: 'Memantau order, status transaksi, nominal, dan sinyal risiko.',
    input: 'Order real dari marketplace/order engine.',
    action: 'Monitor status, risiko, dan kejadian transaksi; buka detail saat perlu intervensi.',
    effect: 'Tim bisa tahu transaksi mana yang perlu perhatian sebelum masalah membesar.',
  },
  {
    id: 'chat',
    title: 'Percakapan',
    purpose: 'Inbox operasional untuk prospek dan support.',
    input: 'Support room/ticket dan lead yang punya chat room.',
    action: 'Balas, follow-up, dan pindahkan konteks percakapan ke pekerjaan yang tepat.',
    effect: 'Pesan tidak berhenti sebagai chat; chat bisa menjadi lead atau kasus support.',
  },
  {
    id: 'disputes',
    title: 'Support & Risiko',
    purpose: 'Tempat menangani tiket, dispute, dan kasus risiko yang membutuhkan tindakan.',
    input: 'Support tickets, order risk, dan indikator risiko lain.',
    action: 'Triase → assign → tangani → resolve/escalate.',
    effect: 'Kasus operasional memiliki owner dan status, bukan tercecer di percakapan.',
  },
  {
    id: 'analytics',
    title: 'Analytics',
    purpose: 'Melihat hasil agregat untuk mengetahui apakah operasi membaik atau memburuk.',
    input: 'Data user, listing, transaksi, support, dan aktivitas yang tersedia.',
    action: 'Bandingkan volume, konversi, GMV, dan indikator operasi.',
    effect: 'Angka dipakai untuk diagnosis dan prioritas, bukan sekadar pajangan.',
  },
  {
    id: 'settings',
    title: 'Administrasi',
    purpose: 'Mengatur siapa boleh mengakses CRM/CMS dan menangani governance platform.',
    input: 'Backoffice invitations, role assignment, privacy requests, dan security incidents.',
    action: 'Cari user → pilih aplikasi → pilih role → undang; tangani queue governance.',
    effect: 'Akses tim dan kewajiban governance punya kontrol terpusat dan audit trail.',
  },
];

const FLOW = [
  ['1. Data masuk', 'User, usaha, listing, lead, chat, order, News, ticket, atau report masuk dari service masing-masing.'],
  ['2. CRM menyaring', 'Dashboard mengambil sinyal yang perlu dikerjakan dan setiap workspace mempertahankan konteks domainnya.'],
  ['3. Operator bertindak', 'Review, assign, follow-up, approve, reject, resolve, atau eskalasi sesuai workflow.'],
  ['4. Backend menegakkan aturan', 'Permission, state transition, validation, audit event, dan outbox dijalankan server-side.'],
  ['5. Dampak kembali ke produk', 'Status publik, transaksi, user trust, notifikasi, atau antrean berikutnya berubah berdasarkan action yang berhasil.'],
];

export default function CrmGuideWorkspace({ onOpen }: { onOpen: (page: PageId) => void }) {
  return (
    <div className="space-y-4">
      <section className="rounded-3xl border border-emerald-200 bg-gradient-to-br from-emerald-50 via-white to-white p-5 shadow-sm">
        <p className="text-[11px] font-black uppercase tracking-[0.22em] text-emerald-700">CRM • Panduan</p>
        <h1 className="mt-1 text-2xl font-black tracking-[-0.05em] text-slate-950 sm:text-3xl">CRM itu buat apa?</h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-600">
          CRM adalah pusat operasi internal Lajukan. Bukan tempat membuat data palsu, dan bukan sekadar dashboard. Setiap halaman menerima data dari service nyata, menjelaskan masalah yang perlu ditangani, lalu menyediakan action yang mengubah state bisnis melalui API.
        </p>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400">Flow utama</p>
          <h2 className="mt-1 text-xl font-black text-slate-950">Dari data masuk sampai efeknya</h2>
        </div>
        <div className="mt-3 grid gap-2 lg:grid-cols-5">
          {FLOW.map(([title, body]) => (
            <div key={title} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-sm font-black text-slate-950">{title}</p>
              <p className="mt-2 text-xs leading-5 text-slate-600">{body}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2 xl:grid-cols-3">
        {GUIDE.map(item => (
          <article key={item.id} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Workspace</p>
                <h2 className="mt-1 text-lg font-black text-slate-950">{item.title}</h2>
              </div>
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="rounded-xl bg-slate-950 px-3 py-2 text-[11px] font-black text-white hover:bg-slate-800"
              >
                Buka
              </button>
            </div>
            <p className="mt-3 text-sm font-semibold leading-6 text-slate-700">{item.purpose}</p>
            <div className="mt-3 grid gap-2">
              <div className="rounded-xl bg-slate-50 p-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Data yang masuk</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{item.input}</p>
              </div>
              <div className="rounded-2xl bg-slate-50 p-3">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Yang dilakukan operator</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">{item.action}</p>
              </div>
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-2.5">
                <p className="text-[10px] font-black uppercase tracking-[0.15em] text-emerald-700">Efek ke sistem</p>
                <p className="mt-1 text-xs leading-5 text-emerald-900">{item.effect}</p>
              </div>
            </div>
          </article>
        ))}
      </section>

      <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">Aturan penting</p>
        <div className="mt-2 grid gap-2 text-sm leading-6 text-amber-950 md:grid-cols-2">
          <p>• CRM tidak boleh mengarang data user/order/ticket ketika service kosong.</p>
          <p>• Action penting selalu divalidasi lagi di backend.</p>
          <p>• Status workflow sebaiknya bisa dibuka lewat URL agar refresh dan Back/Forward tetap masuk akal.</p>
          <p>• Permission, audit, dan state transition tidak boleh hanya dijaga dari UI.</p>
        </div>
      </section>
    </div>
  );
}
