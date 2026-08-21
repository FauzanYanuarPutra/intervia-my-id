import type { UmkmPublishService } from './umkm-commerce.types';
import {
  getDefaultProductCategoryForBusiness,
  inferUmkmBusinessCategory,
  normalizeUmkmBusinessCategory,
  type UmkmBusinessCategoryId,
  type UmkmProductCategoryId,
} from './umkm-taxonomy';

export type UmkmManageWorkspaceId =
  | 'overview'
  | 'setup'
  | 'catalog'
  | 'operations'
  | 'orders'
  | 'team';

export type UmkmBusinessCapabilityId =
  | 'inventory'
  | 'variants'
  | 'made_to_order'
  | 'pickup'
  | 'courier_shipping'
  | 'dine_in'
  | 'reservations'
  | 'appointments'
  | 'field_service'
  | 'digital_delivery';

export type UmkmBusinessProfileId =
  | 'food_service'
  | 'retail_inventory'
  | 'made_to_order'
  | 'service_booking'
  | 'repair_service'
  | 'digital_service';

export type UmkmCustomFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'select'
  | 'date'
  | 'toggle';

export type UmkmCustomFieldScope = 'listing' | 'booking' | 'order';

export type UmkmCustomFieldDefinition = {
  id: string;
  label: string;
  type: UmkmCustomFieldType;
  scope: UmkmCustomFieldScope;
  required: boolean;
  help?: string;
  placeholder?: string;
  options?: string[];
};

export type UmkmCatalogFieldProfile = {
  listingLabelId: string;
  listingLabelEn: string;
  listingPlaceholderId: string;
  listingPlaceholderEn: string;
  descriptionLabelId: string;
  descriptionLabelEn: string;
  descriptionPlaceholderId: string;
  descriptionPlaceholderEn: string;
  stockLabelId: string;
  stockLabelEn: string;
  stockHintId: string;
  stockHintEn: string;
  prepLabelId: string;
  prepLabelEn: string;
  prepHintId: string;
  prepHintEn: string;
  imageLabelId: string;
  imageLabelEn: string;
  imageHintId: string;
  imageHintEn: string;
};

export type UmkmManageProfile = {
  id: UmkmBusinessProfileId;
  labelId: string;
  labelEn: string;
  summaryId: string;
  summaryEn: string;
  registrationHintId: string;
  registrationHintEn: string;
  operationsTitleId: string;
  operationsTitleEn: string;
  operationsDescId: string;
  operationsDescEn: string;
  defaultProductKind: 'physical' | 'digital';
  defaultChannels: Array<'online' | 'offline'>;
  recommendedPublishServices: UmkmPublishService[];
  defaultCapabilities: UmkmBusinessCapabilityId[];
  suggestedCustomFields: UmkmCustomFieldDefinition[];
  catalog: UmkmCatalogFieldProfile;
};

type ProfileConfig = UmkmManageProfile & {
  categories: UmkmBusinessCategoryId[];
};

const PROFILE_CONFIG: ProfileConfig[] = [
  {
    id: 'food_service',
    categories: ['culinary', 'warung_kios'],
    labelId: 'Kuliner, dine-in & pickup',
    labelEn: 'Food, dine-in & pickup',
    summaryId:
      'Cocok untuk menu siap saji, outlet makan, pickup cepat, dan meja bila memang dipakai.',
    summaryEn:
      'Built for ready-to-serve menus, food outlets, quick pickup, and table flow when needed.',
    registrationHintId:
      'Fokuskan setup ke menu, pickup, kurir, dan meja hanya bila outlet memang melayani makan di tempat.',
    registrationHintEn:
      'Focus setup on menu, pickup, couriers, and only keep tables enabled when the outlet actually supports dine-in.',
    operationsTitleId: 'Alur outlet makanan',
    operationsTitleEn: 'Food outlet flow',
    operationsDescId:
      'Meja, QR, reservasi, dan ritme pelayanan relevan untuk outlet kuliner yang menerima pelanggan di tempat.',
    operationsDescEn:
      'Tables, QR, reservations, and service rhythm are only relevant for food outlets serving customers on site.',
    defaultProductKind: 'physical',
    defaultChannels: ['online', 'offline'],
    recommendedPublishServices: ['food'],
    defaultCapabilities: ['inventory', 'pickup', 'courier_shipping', 'dine_in', 'reservations'],
    suggestedCustomFields: [
      {
        id: 'spice_level',
        label: 'Level pedas',
        type: 'select',
        scope: 'order',
        required: false,
        help: 'Opsional untuk menu yang bisa dikustom.',
        options: ['Tidak pedas', 'Sedang', 'Pedas'],
      },
      {
        id: 'serving_note',
        label: 'Catatan penyajian',
        type: 'textarea',
        scope: 'order',
        required: false,
        help: 'Contoh: tanpa bawang, pisah sambal, plastik tambahan.',
      },
    ],
    catalog: {
      listingLabelId: 'Nama menu / produk',
      listingLabelEn: 'Menu / product name',
      listingPlaceholderId: 'Contoh: Nasi Goreng Kampung',
      listingPlaceholderEn: 'Example: Kampung Fried Rice',
      descriptionLabelId: 'Deskripsi menu',
      descriptionLabelEn: 'Menu description',
      descriptionPlaceholderId:
        'Jelaskan isi, porsi, rasa utama, atau keunggulan menu ini.',
      descriptionPlaceholderEn:
        'Describe the portion, flavors, core ingredients, or what makes this menu stand out.',
      stockLabelId: 'Porsi / stok siap jual',
      stockLabelEn: 'Ready portions / stock',
      stockHintId: 'Pakai untuk stok harian atau batas porsi.',
      stockHintEn: 'Use this as daily stock or a serving cap.',
      prepLabelId: 'Waktu siap saji (menit)',
      prepLabelEn: 'Prep time (minutes)',
      prepHintId: 'Berapa lama menu siap dikirim atau disajikan.',
      prepHintEn: 'How long the menu needs before serving or dispatch.',
      imageLabelId: 'Foto menu',
      imageLabelEn: 'Menu photo',
      imageHintId: 'Foto close-up makanan/minuman lebih efektif untuk conversion.',
      imageHintEn: 'Close-up food or drink photography usually converts better.',
    },
  },
  {
    id: 'retail_inventory',
    categories: [
      'grocery_retail',
      'beauty_personal_care',
      'crafts_souvenirs',
      'home_living',
      'health_wellness',
      'agri_fishery',
      'electronics_accessories',
      'books_stationery_printing',
      'baby_kids_family',
      'pets_hobbies',
    ],
    labelId: 'Retail, stok & pengiriman',
    labelEn: 'Retail, inventory & shipping',
    summaryId:
      'Paling cocok untuk jual barang, bundling, stok fisik, pickup, dan kirim kurir.',
    summaryEn:
      'Best suited for merchandise, bundles, physical stock, pickup, and courier delivery.',
    registrationHintId:
      'Tekankan katalog, ketersediaan stok, variasi, dan opsi fulfillment. Meja biasanya tidak relevan.',
    registrationHintEn:
      'Prioritize catalog, stock, variants, and fulfillment options. Tables usually do not matter here.',
    operationsTitleId: 'Operasional retail',
    operationsTitleEn: 'Retail operations',
    operationsDescId:
      'Fokus operasional ada di stok, picking, packing, pickup, dan pengiriman, bukan meja atau seating.',
    operationsDescEn:
      'Operations focus on stock, picking, packing, pickup, and shipping rather than tables or seating.',
    defaultProductKind: 'physical',
    defaultChannels: ['online', 'offline'],
    recommendedPublishServices: ['mart'],
    defaultCapabilities: ['inventory', 'variants', 'pickup', 'courier_shipping'],
    suggestedCustomFields: [
      {
        id: 'variant_note',
        label: 'Pilihan varian',
        type: 'select',
        scope: 'order',
        required: false,
        help: 'Ukuran, warna, aroma, atau varian pack.',
        options: ['Ukuran', 'Warna', 'Pack'],
      },
      {
        id: 'packaging_request',
        label: 'Permintaan packing',
        type: 'textarea',
        scope: 'order',
        required: false,
        help: 'Contoh: gift wrap, bubble wrap ekstra, kirim campur.',
      },
    ],
    catalog: {
      listingLabelId: 'Nama produk',
      listingLabelEn: 'Product name',
      listingPlaceholderId: 'Contoh: Serum Brightening 30 ml',
      listingPlaceholderEn: 'Example: Brightening Serum 30 ml',
      descriptionLabelId: 'Deskripsi produk',
      descriptionLabelEn: 'Product description',
      descriptionPlaceholderId:
        'Jelaskan isi paket, ukuran, material, manfaat, atau spesifikasi penting.',
      descriptionPlaceholderEn:
        'Explain package contents, size, materials, benefits, or the key specs buyers should know.',
      stockLabelId: 'Stok tersedia',
      stockLabelEn: 'Available stock',
      stockHintId: 'Gunakan angka stok fisik yang benar-benar bisa dijual.',
      stockHintEn: 'Use the actual physical stock that can really be sold.',
      prepLabelId: 'Lead time packing (menit)',
      prepLabelEn: 'Packing lead time (minutes)',
      prepHintId: 'Waktu dari order masuk sampai siap pickup/kirim.',
      prepHintEn: 'Time from order placement until ready for pickup or shipping.',
      imageLabelId: 'Foto produk',
      imageLabelEn: 'Product photo',
      imageHintId: 'Utamakan foto jelas yang menunjukkan bentuk barang atau kemasan.',
      imageHintEn: 'Prioritize a clear photo showing the item or its packaging.',
    },
  },
  {
    id: 'made_to_order',
    categories: ['fashion_apparel'],
    labelId: 'Made-to-order & konveksi',
    labelEn: 'Made-to-order & tailoring',
    summaryId:
      'Dipakai untuk jahit, konveksi, custom size, pre-order, atau produksi sesuai brief.',
    summaryEn:
      'Designed for tailoring, made-to-order fashion, custom sizes, pre-orders, or production from a brief.',
    registrationHintId:
      'Aktifkan variasi dan made-to-order. Yang penting biasanya ukuran, bahan, desain, dan lead time produksi.',
    registrationHintEn:
      'Enable variants and made-to-order. The critical pieces are usually size, materials, design references, and production lead time.',
    operationsTitleId: 'Operasional produksi custom',
    operationsTitleEn: 'Custom production flow',
    operationsDescId:
      'Usaha seperti ini lebih butuh brief, ukuran, timeline produksi, dan pickup/kirim daripada meja.',
    operationsDescEn:
      'This type of business needs briefs, sizing, production timelines, and pickup/shipping far more than tables.',
    defaultProductKind: 'physical',
    defaultChannels: ['online', 'offline'],
    recommendedPublishServices: ['mart'],
    defaultCapabilities: ['inventory', 'variants', 'made_to_order', 'pickup', 'courier_shipping'],
    suggestedCustomFields: [
      {
        id: 'size_request',
        label: 'Ukuran / size',
        type: 'text',
        scope: 'order',
        required: true,
        help: 'Contoh: S, M, L, atau ukuran detail.',
      },
      {
        id: 'material_preference',
        label: 'Bahan yang diinginkan',
        type: 'text',
        scope: 'order',
        required: false,
        help: 'Contoh: katun, linen, drill, satin.',
      },
      {
        id: 'design_reference',
        label: 'Referensi desain',
        type: 'textarea',
        scope: 'order',
        required: false,
        help: 'Tautan Pinterest, kode model, atau detail potongan.',
      },
    ],
    catalog: {
      listingLabelId: 'Nama produk / paket jahit',
      listingLabelEn: 'Product / tailoring package name',
      listingPlaceholderId: 'Contoh: Jahit Gamis Custom',
      listingPlaceholderEn: 'Example: Custom Dress Tailoring',
      descriptionLabelId: 'Deskripsi paket',
      descriptionLabelEn: 'Package description',
      descriptionPlaceholderId:
        'Jelaskan model, jenis bahan, ukuran yang didukung, dan hasil akhir yang didapat.',
      descriptionPlaceholderEn:
        'Describe the style, supported materials, sizing, and the final result the buyer gets.',
      stockLabelId: 'Kapasitas order',
      stockLabelEn: 'Order capacity',
      stockHintId: 'Pakai untuk batas order atau slot produksi yang masih tersedia.',
      stockHintEn: 'Use this for open order slots or remaining production capacity.',
      prepLabelId: 'Lead time produksi (hari)',
      prepLabelEn: 'Production lead time (days)',
      prepHintId: 'Masukkan estimasi realistis sebelum barang siap.',
      prepHintEn: 'Enter a realistic estimate before the item is ready.',
      imageLabelId: 'Foto hasil / contoh model',
      imageLabelEn: 'Result / model photo',
      imageHintId: 'Tampilkan hasil jadi atau contoh model paling representatif.',
      imageHintEn: 'Show the final result or the strongest example model.',
    },
  },
  {
    id: 'service_booking',
    categories: ['services_local'],
    labelId: 'Jasa, booking & kunjungan',
    labelEn: 'Services, bookings & visits',
    summaryId:
      'Cocok untuk servis AC, cleaning, laundry, salon, event, sewa alat, fotografi, atau jasa yang pakai jadwal.',
    summaryEn:
      'A fit for AC service, cleaning, laundry, salons, events, rentals, photography, or any service business that runs on schedules.',
    registrationHintId:
      'Yang utama biasanya slot booking, durasi layanan, area jangkauan, alamat kunjungan, pickup-dropoff, dan brief pelanggan.',
    registrationHintEn:
      'The main needs are booking slots, service duration, coverage area, visit addresses, pickup-dropoff, and customer briefs.',
    operationsTitleId: 'Operasional booking jasa',
    operationsTitleEn: 'Service booking flow',
    operationsDescId:
      'Untuk jasa murni, lebih masuk akal mengelola booking, jadwal, pickup/dropoff, dan catatan layanan daripada meja.',
    operationsDescEn:
      'For service-led businesses, managing bookings, schedules, pickup/dropoff, and service notes makes more sense than tables.',
    defaultProductKind: 'physical',
    defaultChannels: ['online', 'offline'],
    recommendedPublishServices: [],
    defaultCapabilities: ['appointments', 'field_service', 'pickup'],
    suggestedCustomFields: [
      {
        id: 'preferred_schedule',
        label: 'Waktu yang diinginkan',
        type: 'date',
        scope: 'booking',
        required: true,
        help: 'Dipakai untuk jadwal kunjungan atau sesi.',
      },
      {
        id: 'service_notes',
        label: 'Catatan layanan',
        type: 'textarea',
        scope: 'booking',
        required: false,
        help: 'Contoh: model rambut, jenis noda laundry, area foto, atau detail acara.',
      },
      {
        id: 'pickup_address',
        label: 'Alamat pickup',
        type: 'textarea',
        scope: 'booking',
        required: false,
        help: 'Aktifkan bila jasa menerima pickup barang atau kunjungan ke lokasi pelanggan.',
      },
    ],
    catalog: {
      listingLabelId: 'Nama layanan / paket jasa',
      listingLabelEn: 'Service / package name',
      listingPlaceholderId: 'Contoh: Cuci AC Split 1 PK',
      listingPlaceholderEn: 'Example: 1 PK Split AC Cleaning',
      descriptionLabelId: 'Deskripsi layanan',
      descriptionLabelEn: 'Service description',
      descriptionPlaceholderId:
        'Jelaskan apa yang dikerjakan, area layanan, syarat booking, dan hasil akhir layanan.',
      descriptionPlaceholderEn:
        'Explain what is done, service area, booking requirements, and the final service outcome.',
      stockLabelId: 'Slot / kapasitas harian',
      stockLabelEn: 'Slots / daily capacity',
      stockHintId: 'Pakai untuk kapasitas booking atau jumlah order yang masih bisa diterima.',
      stockHintEn: 'Use this for booking capacity or how many jobs can still be accepted.',
      prepLabelId: 'Durasi / SLA layanan',
      prepLabelEn: 'Service duration / SLA',
      prepHintId: 'Masukkan durasi pengerjaan atau janji selesai paling realistis.',
      prepHintEn: 'Enter the realistic service duration or promised completion window.',
      imageLabelId: 'Foto layanan / hasil kerja',
      imageLabelEn: 'Service / result photo',
      imageHintId: 'Tunjukkan hasil kerja, before-after, atau contoh setup layanan.',
      imageHintEn: 'Show the result, a before-after, or a representative service setup.',
    },
  },
  {
    id: 'repair_service',
    categories: ['automotive_tools'],
    labelId: 'Servis, bengkel & sparepart',
    labelEn: 'Repair, workshop & spare parts',
    summaryId:
      'Campuran yang umum: jual sparepart, terima servis, estimasi pengerjaan, dan approval tambahan.',
    summaryEn:
      'A common blend of spare-part sales, repair jobs, work estimates, and additional approvals.',
    registrationHintId:
      'Pisahkan antara item sparepart dan paket servis. Yang penting adalah keluhan, unit masuk, dan estimasi selesai.',
    registrationHintEn:
      'Separate spare-part items from service packages. The critical parts are incoming issues, unit intake, and completion estimates.',
    operationsTitleId: 'Alur bengkel / reparasi',
    operationsTitleEn: 'Workshop / repair flow',
    operationsDescId:
      'Bengkel lebih relevan dengan antrian servis, catatan unit, sparepart, dan estimasi selesai daripada seating.',
    operationsDescEn:
      'Workshops care more about repair queues, unit notes, spare parts, and completion estimates than seating.',
    defaultProductKind: 'physical',
    defaultChannels: ['online', 'offline'],
    recommendedPublishServices: ['mart'],
    defaultCapabilities: ['inventory', 'appointments', 'made_to_order', 'pickup'],
    suggestedCustomFields: [
      {
        id: 'unit_type',
        label: 'Jenis unit',
        type: 'text',
        scope: 'booking',
        required: true,
        help: 'Contoh: Honda Beat 2022, iPhone 13, laptop Asus Vivobook, AC Split 1 PK.',
      },
      {
        id: 'complaint',
        label: 'Keluhan utama',
        type: 'textarea',
        scope: 'booking',
        required: true,
        help: 'Ringkasan kerusakan atau gejala.',
      },
      {
        id: 'sparepart_approval',
        label: 'Setuju jika perlu sparepart tambahan',
        type: 'toggle',
        scope: 'order',
        required: false,
        help: 'Berguna untuk bengkel atau repair elektronik.',
      },
    ],
    catalog: {
      listingLabelId: 'Nama servis / sparepart',
      listingLabelEn: 'Service / spare part name',
      listingPlaceholderId: 'Contoh: Tune Up Motor Matic',
      listingPlaceholderEn: 'Example: Automatic Motorbike Tune-Up',
      descriptionLabelId: 'Deskripsi layanan / item',
      descriptionLabelEn: 'Service / item description',
      descriptionPlaceholderId:
        'Jelaskan gejala yang ditangani, sparepart yang termasuk, dan batas pekerjaan.',
      descriptionPlaceholderEn:
        'Explain the issues covered, included parts, and the work boundaries.',
      stockLabelId: 'Slot servis / stok',
      stockLabelEn: 'Service slots / stock',
      stockHintId: 'Pakai untuk slot teknisi atau stok sparepart.',
      stockHintEn: 'Use this for technician slots or spare-part stock.',
      prepLabelId: 'Estimasi pengerjaan',
      prepLabelEn: 'Estimated completion',
      prepHintId: 'Isi estimasi realistis sebelum unit selesai.',
      prepHintEn: 'Enter a realistic completion estimate before the unit is ready.',
      imageLabelId: 'Foto layanan / sparepart',
      imageLabelEn: 'Service / part photo',
      imageHintId: 'Foto hasil servis, area kerja, atau sparepart utama akan membantu trust.',
      imageHintEn: 'A photo of the service result, work area, or key spare parts helps trust.',
    },
  },
  {
    id: 'digital_service',
    categories: ['digital_creative'],
    labelId: 'Produk digital & jasa kreatif',
    labelEn: 'Digital products & creative services',
    summaryId:
      'Ideal untuk desain, template, file digital, jasa konten, atau layanan yang seluruh hasilnya dikirim online.',
    summaryEn:
      'Ideal for design, templates, digital files, content services, or work delivered entirely online.',
    registrationHintId:
      'Yang penting adalah brief, format output, revisi, dan cara pengiriman digital. Meja dan QR offline tidak relevan.',
    registrationHintEn:
      'The key needs are briefs, output format, revisions, and digital delivery. Tables and offline QR do not matter here.',
    operationsTitleId: 'Alur brief & delivery digital',
    operationsTitleEn: 'Brief & digital delivery flow',
    operationsDescId:
      'Untuk jasa digital, operasional utamanya adalah brief masuk, timeline, revisi, dan delivery file.',
    operationsDescEn:
      'For digital services, operations revolve around incoming briefs, timelines, revisions, and file delivery.',
    defaultProductKind: 'digital',
    defaultChannels: ['online'],
    recommendedPublishServices: [],
    defaultCapabilities: ['digital_delivery', 'appointments'],
    suggestedCustomFields: [
      {
        id: 'creative_brief',
        label: 'Creative brief',
        type: 'textarea',
        scope: 'order',
        required: true,
        help: 'Tujuan, audiens, style, dan referensi.',
      },
      {
        id: 'delivery_format',
        label: 'Format file',
        type: 'text',
        scope: 'order',
        required: false,
        help: 'Contoh: PNG, PDF, Figma, MP4, Canva.',
      },
      {
        id: 'revision_rounds',
        label: 'Jumlah revisi',
        type: 'number',
        scope: 'listing',
        required: false,
        help: 'Bisa dipakai sebagai batas atau benefit paket.',
      },
    ],
    catalog: {
      listingLabelId: 'Nama layanan / produk digital',
      listingLabelEn: 'Digital service / product name',
      listingPlaceholderId: 'Contoh: Paket Desain Feed 9 Post',
      listingPlaceholderEn: 'Example: 9-Post Feed Design Package',
      descriptionLabelId: 'Deskripsi deliverable',
      descriptionLabelEn: 'Deliverable description',
      descriptionPlaceholderId:
        'Jelaskan deliverable, revisi, format file, dan turnaround yang didapat buyer.',
      descriptionPlaceholderEn:
        'Describe the deliverables, revisions, file formats, and turnaround the buyer gets.',
      stockLabelId: 'Slot project aktif',
      stockLabelEn: 'Active project slots',
      stockHintId: 'Gunakan untuk jumlah project yang masih bisa ditangani.',
      stockHintEn: 'Use this for how many projects you can still take on.',
      prepLabelId: 'Turnaround (jam / hari)',
      prepLabelEn: 'Turnaround (hours / days)',
      prepHintId: 'Masukkan SLA realistik untuk draft atau hasil final.',
      prepHintEn: 'Enter a realistic SLA for drafts or final delivery.',
      imageLabelId: 'Cover layanan / preview hasil',
      imageLabelEn: 'Service cover / preview',
      imageHintId: 'Tampilkan portfolio, mockup, atau preview hasil digital.',
      imageHintEn: 'Show portfolio work, a mockup, or a digital preview.',
    },
  },
];

const CAPABILITY_META: Record<
  UmkmBusinessCapabilityId,
  {
    labelId: string;
    labelEn: string;
    descId: string;
    descEn: string;
  }
> = {
  inventory: {
    labelId: 'Stok fisik',
    labelEn: 'Inventory',
    descId: 'Pakai ini kalau stok barangnya perlu dihitung dan dijaga.',
    descEn: 'Needs stock, availability, and quantity control.',
  },
  variants: {
    labelId: 'Varian',
    labelEn: 'Variants',
    descId: 'Pakai ini kalau ada ukuran, warna, aroma, paket, atau pilihan lain.',
    descEn: 'Uses size, color, scent, bundle, or option-based choices.',
  },
  made_to_order: {
    labelId: 'Made to order',
    labelEn: 'Made to order',
    descId: 'Pakai ini kalau barang atau jasa baru dikerjain setelah ada brief atau ukuran.',
    descEn: 'The item or service is created after the buyer sends a brief or measurements.',
  },
  pickup: {
    labelId: 'Pickup',
    labelEn: 'Pickup',
    descId: 'Pembeli bisa ambil sendiri di outlet atau titik serah terima.',
    descEn: 'Buyers can collect the order themselves or do handoff at the outlet.',
  },
  courier_shipping: {
    labelId: 'Kirim kurir',
    labelEn: 'Courier shipping',
    descId: 'Pakai ini kalau ordernya dikirim kurir dan butuh hitung ongkir.',
    descEn: 'Requires shipping fees, weight, and delivery flow.',
  },
  dine_in: {
    labelId: 'Makan / layanan di tempat',
    labelEn: 'On-site / dine-in',
    descId: 'Pakai ini kalau butuh meja, QR, atau layanan langsung di outlet.',
    descEn: 'Needs tables, QR, seating, or direct on-site service.',
  },
  reservations: {
    labelId: 'Booking',
    labelEn: 'Reservations',
    descId: 'Pakai ini kalau pelanggan perlu booking dulu sebelum datang.',
    descEn: 'Needs booking slots or pre-arrival reservations.',
  },
  appointments: {
    labelId: 'Janji / booking',
    labelEn: 'Appointments',
    descId: 'Pakai ini kalau layanan jalan pakai jadwal atau slot tertentu.',
    descEn: 'Schedule-driven service with technician slots or fixed sessions.',
  },
  field_service: {
    labelId: 'Kunjungan ke lokasi',
    labelEn: 'Field service',
    descId: 'Pakai ini kalau tim kamu datang ke lokasi pelanggan.',
    descEn: 'Work is performed at the customer site or within a service area.',
  },
  digital_delivery: {
    labelId: 'Pengiriman digital',
    labelEn: 'Digital delivery',
    descId: 'Hasil akhirnya dikirim sebagai file, link, atau output online.',
    descEn: 'The output is delivered as a file, link, or online result.',
  },
};

function dedupeCapabilities(
  value: UmkmBusinessCapabilityId[],
): UmkmBusinessCapabilityId[] {
  return Array.from(new Set(value));
}

function slugifyLabel(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 48);
}

export function resolveUmkmBusinessCategoryForManage(
  value: unknown,
): UmkmBusinessCategoryId | null {
  return normalizeUmkmBusinessCategory(value) || inferUmkmBusinessCategory(value);
}

export function getUmkmManageProfile(
  businessCategory: unknown,
): UmkmManageProfile {
  const normalized = resolveUmkmBusinessCategoryForManage(businessCategory);
  const matched =
    PROFILE_CONFIG.find((profile) => normalized && profile.categories.includes(normalized)) ||
    PROFILE_CONFIG.find((profile) => profile.id === 'retail_inventory');

  return {
    id: matched?.id || 'retail_inventory',
    labelId: matched?.labelId || 'Retail, stok & pengiriman',
    labelEn: matched?.labelEn || 'Retail, inventory & shipping',
    summaryId:
      matched?.summaryId ||
      'Gunakan pola retail umum lalu kustom capability sesuai cara kerja usaha Anda.',
    summaryEn:
      matched?.summaryEn ||
      'Start from the retail baseline, then customize capabilities to match the way the business works.',
    registrationHintId:
      matched?.registrationHintId ||
      'Mulai dari setup paling dekat dengan ritme usaha, lalu sesuaikan capability sendiri.',
    registrationHintEn:
      matched?.registrationHintEn ||
      'Start from the closest operating setup, then adjust capabilities yourself.',
    operationsTitleId: matched?.operationsTitleId || 'Operasional outlet',
    operationsTitleEn: matched?.operationsTitleEn || 'Outlet operations',
    operationsDescId:
      matched?.operationsDescId ||
      'Pilih setup operasional yang benar-benar dipakai, lalu singkirkan modul yang tidak relevan.',
    operationsDescEn:
      matched?.operationsDescEn ||
      'Keep the operating setup that is truly used and remove modules that do not matter.',
    defaultProductKind: matched?.defaultProductKind || 'physical',
    defaultChannels: [...(matched?.defaultChannels || ['online', 'offline'])],
    recommendedPublishServices: [...(matched?.recommendedPublishServices || ['mart'])],
    defaultCapabilities: [...(matched?.defaultCapabilities || ['inventory', 'pickup'])],
    suggestedCustomFields: [...(matched?.suggestedCustomFields || [])],
    catalog:
      matched?.catalog ||
      {
        listingLabelId: 'Nama produk / layanan',
        listingLabelEn: 'Product / service name',
        listingPlaceholderId: 'Contoh: Paket utama usaha Anda',
        listingPlaceholderEn: 'Example: Your main business package',
        descriptionLabelId: 'Deskripsi',
        descriptionLabelEn: 'Description',
        descriptionPlaceholderId: 'Jelaskan kebutuhan utama buyer dan hasil akhirnya.',
        descriptionPlaceholderEn: 'Describe the main buyer need and the final outcome.',
        stockLabelId: 'Kapasitas / stok',
        stockLabelEn: 'Capacity / stock',
        stockHintId: 'Isi sesuai ritme usaha Anda.',
        stockHintEn: 'Fill this based on your operating rhythm.',
        prepLabelId: 'Lead time / durasi',
        prepLabelEn: 'Lead time / duration',
        prepHintId: 'Gunakan estimasi paling realistis.',
        prepHintEn: 'Use the most realistic estimate.',
        imageLabelId: 'Foto / cover',
        imageLabelEn: 'Photo / cover',
        imageHintId: 'Tampilkan representasi paling kuat dari penawaran Anda.',
        imageHintEn: 'Show the strongest representation of your offer.',
      },
  };
}

export function getUmkmDefaultCapabilities(
  businessCategory: unknown,
): UmkmBusinessCapabilityId[] {
  return dedupeCapabilities(getUmkmManageProfile(businessCategory).defaultCapabilities);
}

export function getUmkmRecommendedPublishServices(
  businessCategory: unknown,
): UmkmPublishService[] {
  return [...getUmkmManageProfile(businessCategory).recommendedPublishServices];
}

export function getUmkmCatalogFieldProfile(
  businessCategory: unknown,
): UmkmCatalogFieldProfile {
  return getUmkmManageProfile(businessCategory).catalog;
}

export function getUmkmDefaultProductKindForBusiness(
  businessCategory: unknown,
): 'physical' | 'digital' {
  return getUmkmManageProfile(businessCategory).defaultProductKind;
}

export function getUmkmDefaultChannelsForBusiness(
  businessCategory: unknown,
): Array<'online' | 'offline'> {
  return [...getUmkmManageProfile(businessCategory).defaultChannels];
}

export function getUmkmSuggestedCustomFields(
  businessCategory: unknown,
): UmkmCustomFieldDefinition[] {
  return [...getUmkmManageProfile(businessCategory).suggestedCustomFields];
}

export function getCapabilityLabel(
  capability: UmkmBusinessCapabilityId,
  isId: boolean,
): string {
  const config = CAPABILITY_META[capability];
  return isId ? config.labelId : config.labelEn;
}

export function getCapabilityDescription(
  capability: UmkmBusinessCapabilityId,
  isId: boolean,
): string {
  const config = CAPABILITY_META[capability];
  return isId ? config.descId : config.descEn;
}

export function parseCapabilityList(
  value: unknown,
  businessCategory?: unknown,
): UmkmBusinessCapabilityId[] {
  const tokens = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(/[,\n]+/)
      : [];

  const normalized = tokens
    .map((item) => (typeof item === 'string' ? item.trim().toLowerCase() : ''))
    .filter(Boolean)
    .filter(
      (item): item is UmkmBusinessCapabilityId =>
        item === 'inventory' ||
        item === 'variants' ||
        item === 'made_to_order' ||
        item === 'pickup' ||
        item === 'courier_shipping' ||
        item === 'dine_in' ||
        item === 'reservations' ||
        item === 'appointments' ||
        item === 'field_service' ||
        item === 'digital_delivery',
    );

  if (normalized.length > 0) return dedupeCapabilities(normalized);
  return businessCategory ? getUmkmDefaultCapabilities(businessCategory) : [];
}

function normalizeCustomFieldType(value: unknown): UmkmCustomFieldType {
  return value === 'textarea' ||
    value === 'number' ||
    value === 'select' ||
    value === 'date' ||
    value === 'toggle'
    ? value
    : 'text';
}

function normalizeCustomFieldScope(value: unknown): UmkmCustomFieldScope {
  return value === 'booking' || value === 'order' ? value : 'listing';
}

function normalizeOptions(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const options = value
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
    .slice(0, 12);
  return options.length > 0 ? options : undefined;
}

export function createCustomFieldDefinition(
  input: Partial<UmkmCustomFieldDefinition> & { label: string },
): UmkmCustomFieldDefinition {
  const label = input.label.trim();
  return {
    id: input.id?.trim() || slugifyLabel(label) || `custom_${Date.now()}`,
    label,
    type: normalizeCustomFieldType(input.type),
    scope: normalizeCustomFieldScope(input.scope),
    required: input.required === true,
    help: input.help?.trim() || undefined,
    placeholder: input.placeholder?.trim() || undefined,
    options: normalizeOptions(input.options),
  };
}

export function parseCustomFieldDefinitions(
  value: unknown,
  businessCategory?: unknown,
): UmkmCustomFieldDefinition[] {
  if (!Array.isArray(value)) {
    return businessCategory ? getUmkmSuggestedCustomFields(businessCategory) : [];
  }

  return value
    .map((item) => {
      if (!item || typeof item !== 'object') return null;
      const record = item as Record<string, unknown>;
      const label = typeof record.label === 'string' ? record.label.trim() : '';
      if (!label) return null;
      return createCustomFieldDefinition({
        id: typeof record.id === 'string' ? record.id : undefined,
        label,
        type: normalizeCustomFieldType(record.type),
        scope: normalizeCustomFieldScope(record.scope),
        required: record.required === true,
        help: typeof record.help === 'string' ? record.help : undefined,
        placeholder:
          typeof record.placeholder === 'string' ? record.placeholder : undefined,
        options: normalizeOptions(record.options),
      });
    })
    .filter((item): item is UmkmCustomFieldDefinition => Boolean(item));
}

export function getRelevantCustomFields(
  fields: UmkmCustomFieldDefinition[],
  scope: UmkmCustomFieldScope,
): UmkmCustomFieldDefinition[] {
  return fields.filter((field) => field.scope === scope);
}

export function supportsDineIn(
  capabilities: UmkmBusinessCapabilityId[],
): boolean {
  return capabilities.includes('dine_in');
}

export function supportsReservations(
  capabilities: UmkmBusinessCapabilityId[],
): boolean {
  return capabilities.includes('reservations') || capabilities.includes('appointments');
}

export function supportsDigitalDelivery(
  capabilities: UmkmBusinessCapabilityId[],
): boolean {
  return capabilities.includes('digital_delivery');
}

export function supportsShipping(
  capabilities: UmkmBusinessCapabilityId[],
): boolean {
  return capabilities.includes('courier_shipping');
}

export function supportsInventory(
  capabilities: UmkmBusinessCapabilityId[],
): boolean {
  return capabilities.includes('inventory');
}

export function supportsFieldService(
  capabilities: UmkmBusinessCapabilityId[],
): boolean {
  return capabilities.includes('field_service');
}

export function supportsAppointments(
  capabilities: UmkmBusinessCapabilityId[],
): boolean {
  return capabilities.includes('appointments');
}

export function getUmkmOperationsSummary(
  businessCategory: unknown,
  capabilities: UmkmBusinessCapabilityId[],
  isId: boolean,
): string {
  const profile = getUmkmManageProfile(businessCategory);
  const hints = [
    supportsDineIn(capabilities)
      ? isId
        ? 'aktifkan meja dan QR'
        : 'enable tables and QR'
      : null,
    supportsAppointments(capabilities)
      ? isId
        ? 'rapikan alur booking'
        : 'organize booking flow'
      : null,
    supportsFieldService(capabilities)
      ? isId
        ? 'siapkan area layanan'
        : 'define service coverage'
      : null,
    supportsDigitalDelivery(capabilities)
      ? isId
        ? 'jelaskan delivery digital'
        : 'clarify digital delivery'
      : null,
  ].filter(Boolean);

  if (hints.length === 0) {
    return isId ? profile.operationsDescId : profile.operationsDescEn;
  }

  return `${isId ? profile.operationsDescId : profile.operationsDescEn} ${
    isId ? 'Prioritas:' : 'Priority:'
  } ${hints.join(', ')}.`;
}

export function buildDefaultCustomFieldsForBusiness(
  businessCategory: unknown,
): UmkmCustomFieldDefinition[] {
  return getUmkmSuggestedCustomFields(businessCategory).map((field) =>
    createCustomFieldDefinition(field),
  );
}

export function buildUmkmCatalogMetadata(
  businessCategory: unknown,
  capabilities: UmkmBusinessCapabilityId[],
  customFields: UmkmCustomFieldDefinition[],
): Record<string, unknown> {
  return {
    umkm_category:
      resolveUmkmBusinessCategoryForManage(businessCategory) || undefined,
    business_profile: getUmkmManageProfile(businessCategory).id,
    business_capabilities: dedupeCapabilities(capabilities),
    custom_fields: customFields,
    default_product_category: getDefaultProductCategoryForBusiness(businessCategory),
  };
}

export function getDefaultProductCategoryForManage(
  businessCategory: unknown,
): UmkmProductCategoryId {
  return getDefaultProductCategoryForBusiness(businessCategory);
}
