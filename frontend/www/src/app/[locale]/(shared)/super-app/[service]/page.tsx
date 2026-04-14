import { notFound } from 'next/navigation';
import { Link } from '@/i18n/navigation';
import { serviceItems } from '@/components/home/homeLauncherData';
import { SuperAppOrderPanel } from '@/components/super-app/SuperAppOrderPanel';
import {
  getSuperAppService,
  type SuperAppServiceDefinition,
} from '@/lib/super-app/catalog';
import { UMKM_OWNER_PATH } from '@/lib/umkmSurface';
import {
  ArrowRight,
  ChevronLeft,
  ClipboardList,
  Package,
  ShieldCheck,
  Store,
  Truck,
} from 'lucide-react';

type PageProps = {
  params: Promise<{ locale: string; service: string }>;
};

type Playbook = {
  summaryId: string;
  summaryEn: string;
  bestForId: string[];
  bestForEn: string[];
  checklistId: string[];
  checklistEn: string[];
  primaryHref: string;
  primaryLabelId: string;
  primaryLabelEn: string;
  secondaryHref: string;
  secondaryLabelId: string;
  secondaryLabelEn: string;
};

const MODULE_PLAYBOOKS: Record<string, Playbook> = {
  ride: {
    summaryId: 'Gunakan modul ini untuk pickup cepat: ambil bahan dari supplier, drop order customer, atau kirim sampel ke calon buyer.',
    summaryEn: 'Use this module for urgent pickups: collect stock from suppliers, drop customer orders, or send samples to buyers.',
    bestForId: [
      'Bahan baku yang harus tiba hari ini',
      'Sampel produk untuk closing',
      'Order kecil yang butuh pickup cepat',
    ],
    bestForEn: [
      'Raw materials needed today',
      'Product samples for closing',
      'Small orders that need fast pickup',
    ],
    checklistId: [
      'Alamat pickup dan dropoff harus spesifik',
      'Catatan barang ditulis sebelum kurir jalan',
      'Simpan bukti pickup dan penerimaan',
    ],
    checklistEn: [
      'Pickup and dropoff addresses should be specific',
      'Write package notes before the courier starts',
      'Keep pickup and delivery proof',
    ],
    primaryHref: '#ops-panel',
    primaryLabelId: 'Buka flow pickup',
    primaryLabelEn: 'Open pickup flow',
    secondaryHref: '/search?type=product&q=bahan%20baku',
    secondaryLabelId: 'Cari bahan baku',
    secondaryLabelEn: 'Find raw materials',
  },
  car: {
    summaryId: 'Pakai modul ini saat butuh belanja grosir, survey lokasi usaha, atau kirim muatan yang lebih besar dari operasional motor.',
    summaryEn: 'Use this module for wholesale runs, business location surveys, or larger deliveries than a bike flow can handle.',
    bestForId: [
      'Belanja stok grosir dan packaging',
      'Survey booth, kios, atau ruko',
      'Kunjungan supplier dan partner',
    ],
    bestForEn: [
      'Wholesale restocking and packaging runs',
      'Booth, kiosk, or shophouse surveys',
      'Supplier and partner visits',
    ],
    checklistId: [
      'Tulis tujuan operasional sebelum berangkat',
      'Catat kebutuhan belanja atau survey',
      'Gunakan riwayat trip untuk kontrol biaya',
    ],
    checklistEn: [
      'Write the operating objective before departure',
      'Record the procurement or survey list',
      'Use trip history for cost control',
    ],
    primaryHref: '#ops-panel',
    primaryLabelId: 'Atur perjalanan',
    primaryLabelEn: 'Plan trip',
    secondaryHref: '/search?type=property&q=lokasi%20jualan',
    secondaryLabelId: 'Cari lokasi jualan',
    secondaryLabelEn: 'Find selling locations',
  },
  food: {
    summaryId: 'Modul ini paling berguna untuk melihat benchmark usaha kuliner, menu, harga, dan experience storefront yang siap dipakai.',
    summaryEn: 'This module is best for benchmarking local food businesses, menus, pricing, and storefront experience that is ready to use.',
    bestForId: [
      'Belajar flow order kuliner lokal',
      'Bandingkan menu, paket, dan promo',
      'Cari inspirasi storefront usaha',
    ],
    bestForEn: [
      'Learn from local food ordering flows',
      'Compare menus, bundles, and promos',
      'Find inspiration for business storefronts',
    ],
    checklistId: [
      'Lihat struktur menu dan bundling',
      'Perhatikan copy, foto, dan CTA yang dipakai',
      'Catat apa yang bisa ditiru untuk outlet sendiri',
    ],
    checklistEn: [
      'Review the menu and bundle structure',
      'Observe copy, photos, and CTAs',
      'Note what can be adapted for your own outlet',
    ],
    primaryHref: '#ops-panel',
    primaryLabelId: 'Lihat storefront',
    primaryLabelEn: 'Open storefronts',
    secondaryHref: UMKM_OWNER_PATH,
    secondaryLabelId: 'Kelola outlet sendiri',
    secondaryLabelEn: 'Manage your own outlet',
  },
  send: {
    summaryId: 'Fokus modul ini adalah fulfillment: kirim order customer, dokumen usaha, sampel produk, atau stok kecil ke outlet lain.',
    summaryEn: 'This module is built for fulfillment: ship customer orders, business documents, product samples, or small stock to another outlet.',
    bestForId: [
      'Order customer dalam kota',
      'Dokumen atau invoice fisik',
      'Sampel atau stok kecil antar outlet',
    ],
    bestForEn: [
      'In-city customer orders',
      'Physical documents or invoices',
      'Samples or small stock between outlets',
    ],
    checklistId: [
      'Nama penerima dan nomor telepon harus valid',
      'Tuliskan catatan barang yang dikirim',
      'Gunakan bukti penerimaan untuk dispute bila perlu',
    ],
    checklistEn: [
      'Receiver name and phone should be valid',
      'Write clear package notes',
      'Use proof of receipt if a dispute happens',
    ],
    primaryHref: '#ops-panel',
    primaryLabelId: 'Buat pengiriman',
    primaryLabelEn: 'Create shipment',
    secondaryHref: '/transactions',
    secondaryLabelId: 'Lihat order aktif',
    secondaryLabelEn: 'See active orders',
  },
  mart: {
    summaryId: 'Gunakan modul ini untuk isi stok cepat: kemasan, bahan pendamping, kebutuhan outlet, dan produk jual ulang skala harian.',
    summaryEn: 'Use this module for quick restocking: packaging, supporting materials, outlet supplies, and daily resale goods.',
    bestForId: [
      'Restock kemasan dan kebutuhan toko',
      'Cari bahan tambahan harian',
      'Belanja stok kecil tanpa proses panjang',
    ],
    bestForEn: [
      'Restock packaging and store supplies',
      'Find daily supporting materials',
      'Buy small stock without a long process',
    ],
    checklistId: [
      'Bandingkan merchant dan kisaran harga',
      'Cek estimasi waktu tiba sebelum checkout',
      'Simpan supplier yang paling konsisten',
    ],
    checklistEn: [
      'Compare merchants and price range',
      'Check ETA before checkout',
      'Save the suppliers that stay consistent',
    ],
    primaryHref: '#ops-panel',
    primaryLabelId: 'Isi stok sekarang',
    primaryLabelEn: 'Restock now',
    secondaryHref: '/search?type=product&q=packaging',
    secondaryLabelId: 'Cari packaging',
    secondaryLabelEn: 'Find packaging',
  },
  services: {
    summaryId: 'Modul ini adalah pintu masuk ke jasa operasional usaha: admin marketplace, desain, konten, customer service, dan support yang siap eksekusi.',
    summaryEn: 'This module is the entry point to operational services: marketplace admins, design, content, customer service, and execution support.',
    bestForId: [
      'Butuh tim cepat tanpa rekrut panjang',
      'Mau beli paket jasa yang jelas scope-nya',
      'Butuh bantuan operasional yang berulang',
    ],
    bestForEn: [
      'Need support fast without lengthy hiring',
      'Want packages with clearer scope',
      'Need repeatable operational help',
    ],
    checklistId: [
      'Scope, timeline, dan output ditulis jelas',
      'Pilih provider dengan trust dan review kuat',
      'Gunakan escrow saat deal berjalan',
    ],
    checklistEn: [
      'Write scope, timeline, and output clearly',
      'Pick providers with stronger trust and reviews',
      'Use escrow once the deal starts',
    ],
    primaryHref: '/search?type=service&q=paket%20jasa',
    primaryLabelId: 'Cari paket jasa',
    primaryLabelEn: 'Find service packages',
    secondaryHref: '/search?type=freelancer&q=admin%20marketplace',
    secondaryLabelId: 'Cari freelancer ops',
    secondaryLabelEn: 'Find ops freelancers',
  },
};

function serviceLabel(service: SuperAppServiceDefinition, isId: boolean) {
  return isId ? service.labelId : service.labelEn;
}

function serviceDescription(service: SuperAppServiceDefinition, isId: boolean) {
  return isId ? service.descriptionId : service.descriptionEn;
}

function playbookText(valuesId: string[], valuesEn: string[], isId: boolean) {
  return isId ? valuesId : valuesEn;
}

export default async function SuperAppServicePage({ params }: PageProps) {
  const { locale, service: serviceSlug } = await params;
  const isId = locale === 'id';
  const service = getSuperAppService(serviceSlug);

  if (!service) return notFound();

  const playbook = MODULE_PLAYBOOKS[service.slug];
  if (!playbook) return notFound();

  const showInteractivePanel = service.slug !== 'services';
  const primaryHref =
    playbook.primaryHref === '#ops-panel'
      ? `/super-app/${service.slug}#ops-panel`
      : playbook.primaryHref;

  return (
    <main className="page-shell py-4 sm:py-5">
      <div className="mx-auto max-w-[1120px] space-y-4">
        <section className="ui-panel ui-hero-panel rounded-none border-x-0 p-4 sm:rounded-[32px] sm:border-x sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href="/super-app"
              className="ui-button-secondary inline-flex min-h-[42px] items-center gap-2 px-3 text-xs font-semibold"
            >
              <ChevronLeft className="h-4 w-4" />
              {isId ? 'Kembali ke super app' : 'Back to super app'}
            </Link>
            <div className="flex flex-wrap gap-2">
              <Link href="/transactions" className="ui-inline-meta ui-border ui-text-soft">
                {isId ? 'Transaksi' : 'Transactions'}
              </Link>
              <Link href="/support" className="ui-inline-meta ui-border ui-text-soft">
                {isId ? 'Support' : 'Support'}
              </Link>
            </div>
          </div>

          <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.06fr)_320px]">
            <div>
              <p className="ui-kicker">
                <ShieldCheck className="h-3.5 w-3.5" />
                {isId ? 'Modul operasional' : 'Operational module'}
              </p>
              <h1 className="mt-3 ui-display-2 text-[color:var(--app-text)]">
                {serviceLabel(service, isId)}
              </h1>
              <p className="mt-3 max-w-[42rem] text-sm text-[color:var(--app-text-soft)] sm:text-[15px]">
                {serviceDescription(service, isId)}
              </p>
              <p className="mt-3 max-w-[42rem] text-sm leading-6 text-[color:var(--app-text-soft)]">
                {isId ? playbook.summaryId : playbook.summaryEn}
              </p>

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={primaryHref}
                  className="ui-button-primary inline-flex min-h-[46px] items-center gap-2 px-4 text-sm font-semibold"
                >
                  {isId ? playbook.primaryLabelId : playbook.primaryLabelEn}
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href={playbook.secondaryHref}
                  className="ui-button-secondary inline-flex min-h-[46px] items-center gap-2 px-4 text-sm font-semibold"
                >
                  {isId ? playbook.secondaryLabelId : playbook.secondaryLabelEn}
                </Link>
              </div>

              <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-7">
                {serviceItems.map((item) => {
                  const active = item.href === `/super-app/${service.slug}`;

                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
                      className={`rounded-[20px] border px-3 py-3 text-center transition ${
                        active
                          ? 'border-[color:var(--app-accent-border)] bg-[color:var(--app-accent-soft)]'
                          : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] hover:border-[color:var(--app-accent-border)] hover:shadow-[var(--app-shadow)]'
                      }`}
                    >
                      <span
                        className={`mx-auto inline-flex h-10 w-10 items-center justify-center rounded-[16px] ${item.bgClass}`}
                      >
                        {item.icon ? (
                          <item.icon className="h-4.5 w-4.5 text-[color:var(--app-text)]" />
                        ) : null}
                      </span>
                      <span className="mt-2 block text-[12px] font-semibold text-[color:var(--app-text)]">
                        {isId ? item.labelId : item.labelEn}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <aside className="ui-sheet p-4">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Paling cocok untuk' : 'Best used for'}
              </p>
              <div className="mt-4 space-y-2">
                {playbookText(playbook.bestForId, playbook.bestForEn, isId).map((item) => (
                  <div
                    key={item}
                    className="ui-feed-row rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3 text-sm font-semibold text-[color:var(--app-text)]"
                  >
                    {item}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </section>

        <section className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
          <div className="ui-panel rounded-none border-x-0 p-4 sm:rounded-[28px] sm:border-x sm:p-5">
            <div className="flex items-center gap-2">
              <ClipboardList className="h-4.5 w-4.5 text-[color:var(--app-accent)]" />
              <h2 className="text-lg font-semibold text-[color:var(--app-text)]">
                {isId ? 'Checklist operasional' : 'Operational checklist'}
              </h2>
            </div>
            <div className="mt-4 grid gap-2">
              {playbookText(playbook.checklistId, playbook.checklistEn, isId).map((item, index) => (
                <div
                  key={item}
                  className="ui-feed-row flex items-start gap-3 rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-3"
                >
                  <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[color:var(--app-accent-soft)] text-sm font-bold text-[color:var(--app-accent)]">
                    {index + 1}
                  </span>
                  <span className="text-sm text-[color:var(--app-text-soft)]">{item}</span>
                </div>
              ))}
            </div>
          </div>

          <aside className="ui-panel rounded-none border-x-0 p-4 sm:rounded-[28px] sm:border-x sm:p-5">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
              {isId ? 'Kontrol inti' : 'Core controls'}
            </p>
            <div className="mt-4 grid gap-2">
              {[
                {
                  icon: ShieldCheck,
                  text: isId ? 'Trust, verifikasi, dan bukti transaksi tetap dekat.' : 'Trust, verification, and transaction proof stay close.',
                },
                {
                  icon: Package,
                  text: isId ? 'Semua modul dipakai untuk memperlancar ritme bisnis, bukan sekadar transaksi sesaat.' : 'Every module is designed to support business rhythm, not a one-off transaction.',
                },
                {
                  icon: Store,
                  text: isId ? 'Hubungkan modul ini ke storefront usaha, supplier, dan support operasional.' : 'Connect this module to your business storefront, suppliers, and execution support.',
                },
                {
                  icon: Truck,
                  text: isId ? 'Jaga agar sourcing, fulfillment, dan repeat order tetap satu alur.' : 'Keep sourcing, fulfillment, and repeat orders in one flow.',
                },
              ].map((item) => (
                <div
                  key={item.text}
                  className="ui-feed-row rounded-[20px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-3"
                >
                  <div className="flex items-start gap-3">
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]">
                      <item.icon className="h-4.5 w-4.5" />
                    </span>
                    <p className="text-sm text-[color:var(--app-text-soft)]">{item.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </aside>
        </section>

        {showInteractivePanel ? (
          <section id="ops-panel" className="space-y-3">
            <div className="ui-panel rounded-none border-x-0 p-4 sm:rounded-[28px] sm:border-x sm:p-5">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[color:var(--app-text-soft)]">
                {isId ? 'Flow interaktif' : 'Interactive flow'}
              </p>
              <h2 className="mt-1 text-lg font-semibold text-[color:var(--app-text)]">
                {isId
                  ? 'Pakai modul ini langsung untuk simulasi atau operasional lapangan'
                  : 'Use this module directly for simulation or field operations'}
              </h2>
            </div>
            <SuperAppOrderPanel service={service.slug} isId={isId} />
          </section>
        ) : null}
      </div>
    </main>
  );
}
