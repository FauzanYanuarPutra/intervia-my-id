export type CreateIntent = 'offer' | 'request';

export type CreateStepId =
  | 'intent'
  | 'category'
  | 'taxonomy'
  | 'main'
  | 'details'
  | 'media'
  | 'location'
  | 'contact'
  | 'review';

export type ListingFieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'currency'
  | 'select'
  | 'multi-select'
  | 'radio'
  | 'toggle'
  | 'date';

export type ListingFieldSchema = {
  key: string;
  type: ListingFieldType;
  labelId: string;
  labelEn: string;
  helpId?: string;
  helpEn?: string;
  placeholderId?: string;
  placeholderEn?: string;
  required: boolean;
  step: 4 | 5 | 7 | 8;
  group?: 'primary' | 'additional' | 'location' | 'contact';
  options?: Array<{ value: string; labelId: string; labelEn: string }>;
  allowCustomOption?: boolean;
  suffixId?: string;
  suffixEn?: string;
  validation?: {
    min?: number;
    max?: number;
    minLength?: number;
    maxLength?: number;
  };
};

export type CreateStepSchema = {
  id: CreateStepId;
  labelId: string;
  labelEn: string;
  titleId: string;
  titleEn: string;
  descriptionId: string;
  descriptionEn: string;
};

export const CREATE_STEPS: CreateStepSchema[] = [
  {
    id: 'intent',
    labelId: 'Aksi',
    labelEn: 'Purpose',
    titleId: 'Kamu mau apa?',
    titleEn: 'What do you want to do?',
    descriptionId:
      'Pilih satu. Nanti pertanyaan berikutnya menyesuaikan otomatis.',
    descriptionEn:
      'Choose whether you want to offer something or request something.',
  },
  {
    id: 'category',
    labelId: 'Kategori',
    labelEn: 'Category',
    titleId: 'Pilih kebutuhan usaha',
    titleEn: 'Choose a category',
    descriptionId:
      'Pilih yang paling dekat agar postingan lebih mudah ditemukan di Jelajahi.',
    descriptionEn: 'Pick the closest fit so your post is easier to find.',
  },
  {
    id: 'taxonomy',
    labelId: 'Jenis',
    labelEn: 'Type & industry',
    titleId: 'Perjelas jenisnya',
    titleEn: 'Choose subcategory and industry',
    descriptionId: 'Pilih jenis dan industri agar hasil pencarian lebih tepat.',
    descriptionEn:
      'Choose one subcategory and at least one industry so the next questions, search, and provider recommendations are more relevant.',
  },
  {
    id: 'main',
    labelId: 'Informasi utama',
    labelEn: 'Main info',
    titleId: 'Isi informasi utama',
    titleEn: 'Describe your offer',
    descriptionId:
      'Tulis hal yang paling dicari orang: nama, harga atau budget, dan ringkasan singkat.',
    descriptionEn: 'Add the key details buyers need to understand your offer.',
  },
  {
    id: 'details',
    labelId: 'Detail penting',
    labelEn: 'Important details',
    titleId: 'Detail tambahan',
    titleEn: 'Add details',
    descriptionId:
      'Isi seperlunya. Detail yang jelas membantu orang cepat memutuskan.',
    descriptionEn: 'Clear details help people decide faster.',
  },
  {
    id: 'media',
    labelId: 'Media',
    labelEn: 'Media',
    titleId: 'Tambah foto atau referensi',
    titleEn: 'Add photos or references',
    descriptionId:
      'Tambahkan media kalau membantu orang memahami konteks postingan.',
    descriptionEn:
      'Add media when it helps people understand the post context.',
  },
  {
    id: 'location',
    labelId: 'Lokasi',
    labelEn: 'Location',
    titleId: 'Lokasi atau area layanan',
    titleEn: 'Where does this post apply?',
    descriptionId: 'Pilih lokasi barang atau area yang bisa dilayani.',
    descriptionEn: 'Choose the item location or service area.',
  },
  {
    id: 'contact',
    labelId: 'Kontak',
    labelEn: 'Contact',
    titleId: 'Kontak yang bisa dihubungi',
    titleEn: 'Check contact',
    descriptionId: 'Pastikan orang dapat menghubungimu dengan mudah.',
    descriptionEn: 'Make sure people can reach you easily.',
  },
  {
    id: 'review',
    labelId: 'Tinjau',
    labelEn: 'Review',
    titleId: 'Cek sebelum terbit',
    titleEn: 'Review before publishing',
    descriptionId:
      'Pastikan detail utama, lokasi, kontak, dan media sudah benar.',
    descriptionEn:
      'Check that key details, location, contact, and media are correct.',
  },
];

const priceOptions = {
  offer: [
    ['fixed', 'Harga tetap', 'Fixed price'],
    ['starting_from', 'Mulai dari', 'Starting from'],
    ['range', 'Rentang harga', 'Price range'],
    ['negotiable', 'Bisa dinegosiasikan', 'Negotiable'],
    ['contact_provider', 'Hubungi penyedia', 'Contact provider'],
    ['free', 'Gratis', 'Free'],
  ],
  request: [
    ['fixed_budget', 'Budget tetap', 'Fixed budget'],
    ['maximum_budget', 'Budget maksimal', 'Maximum budget'],
    ['budget_range', 'Rentang budget', 'Budget range'],
    ['negotiable', 'Bisa dibicarakan', 'Negotiable'],
    ['undetermined', 'Belum menentukan budget', 'Not decided yet'],
  ],
} as const;

function option(value: string, labelId: string, labelEn: string) {
  return { value, labelId, labelEn };
}

const tradeUnitOptions = [
  option('kg', 'Kilogram (kg)', 'Kilogram (kg)'),
  option('g', 'Gram (g)', 'Gram (g)'),
  option('ton', 'Ton', 'Ton'),
  option('lb', 'Pound (lb)', 'Pound (lb)'),
  option('oz', 'Ons / ounce (oz)', 'Ounce (oz)'),
  option('l', 'Liter (L)', 'Liter (L)'),
  option('ml', 'Mililiter (ml)', 'Milliliter (ml)'),
  option('m3', 'Meter kubik (m3)', 'Cubic meter (m3)'),
  option('m', 'Meter (m)', 'Meter (m)'),
  option('cm', 'Sentimeter (cm)', 'Centimeter (cm)'),
  option('m2', 'Meter persegi (m2)', 'Square meter (m2)'),
  option('pcs', 'Pcs / unit', 'Pcs / unit'),
  option('dozen', 'Lusin / dozen', 'Dozen'),
  option('pack', 'Pak / pack', 'Pack'),
  option('box', 'Dus / box', 'Box'),
  option('carton', 'Karton / carton', 'Carton'),
  option('case', 'Case', 'Case'),
  option('sack', 'Karung / sak', 'Sack'),
  option('bag', 'Kantong / bag', 'Bag'),
  option('roll', 'Roll', 'Roll'),
  option('sheet', 'Lembar / sheet', 'Sheet'),
  option('bundle', 'Bundel / bundle', 'Bundle'),
  option('pallet', 'Palet / pallet', 'Pallet'),
  option('container', 'Kontainer / container', 'Container'),
];

const stockStatusOptions = [
  option('ready_stock', 'Ready stock', 'Ready stock'),
  option('limited_stock', 'Stok terbatas', 'Limited stock'),
  option('pre_order', 'Pre-order', 'Pre-order'),
  option('made_to_order', 'Produksi sesuai pesanan', 'Made to order'),
  option('recurring_stock', 'Stok rutin / restock berkala', 'Recurring stock'),
  option('seasonal', 'Musiman', 'Seasonal'),
];

const needFrequencyOptions = [
  option('one_time', 'Sekali beli', 'One-time'),
  option('weekly', 'Mingguan', 'Weekly'),
  option('monthly', 'Bulanan', 'Monthly'),
  option('recurring', 'Kontrak rutin', 'Recurring contract'),
  option('on_demand', 'Sesuai kebutuhan', 'On demand'),
];

const certificationOptions = [
  option('halal', 'Halal', 'Halal'),
  option('pirt', 'PIRT', 'PIRT'),
  option('bpom', 'BPOM', 'BPOM'),
  option('nib', 'NIB', 'NIB'),
  option('sni', 'SNI', 'SNI'),
  option('coa', 'COA', 'COA'),
  option('msds', 'MSDS', 'MSDS'),
  option('organic', 'Organik', 'Organic'),
];

const pricingBasisOptions = [
  option('project', 'Per proyek', 'Per project'),
  option('hour', 'Per jam', 'Per hour'),
  option('day', 'Per hari', 'Per day'),
  option('visit', 'Per kunjungan', 'Per visit'),
  option('item', 'Per item', 'Per item'),
  option('package', 'Paket', 'Package'),
  option('month', 'Bulanan', 'Monthly'),
];

const deliveryEstimateOptions = [
  option('same_day', 'Hari yang sama', 'Same day'),
  option('one_to_three_days', '1-3 hari', '1-3 days'),
  option('three_to_seven_days', '3-7 hari', '3-7 days'),
  option('one_to_two_weeks', '1-2 minggu', '1-2 weeks'),
  option('more_than_two_weeks', 'Lebih dari 2 minggu', 'More than 2 weeks'),
];

const warrantyOptions = [
  option('none', 'Tanpa garansi', 'No warranty'),
  option('seven_days', '7 hari', '7 days'),
  option('fourteen_days', '14 hari', '14 days'),
  option('thirty_days', '30 hari', '30 days'),
  option('three_months', '3 bulan', '3 months'),
  option('six_months', '6 bulan', '6 months'),
  option('one_year', '1 tahun', '1 year'),
];

const serviceWarrantyOptions = [
  option('none', 'Tanpa garansi', 'No warranty'),
  option('one_revision', '1x revisi', '1 revision'),
  option('two_revisions', '2x revisi', '2 revisions'),
  option('seven_day_revision', 'Revisi 7 hari', '7-day revision window'),
  option('fourteen_day_rework', 'Perbaikan 14 hari', '14-day rework guarantee'),
  option('thirty_day_support', 'Dukungan 30 hari', '30-day support'),
];

const equipmentConditionOptions = [
  option('new', 'Baru', 'New'),
  option('like_new', 'Seperti baru', 'Like new'),
  option('used', 'Bekas - kondisi baik', 'Used - good condition'),
  option('used_fair', 'Bekas - kondisi cukup', 'Used - fair condition'),
  option('needs_service', 'Perlu servis', 'Needs service'),
];

const facilityOptions = [
  option('electricity', 'Listrik', 'Electricity'),
  option('water', 'Air', 'Water'),
  option('toilet', 'Toilet', 'Toilet'),
  option('parking', 'Parkir', 'Parking'),
  option('loading_access', 'Akses bongkar muat', 'Loading access'),
  option('internet', 'Internet', 'Internet'),
  option('air_conditioning', 'AC', 'Air conditioning'),
  option('security', 'Keamanan', 'Security'),
  option('kitchen', 'Dapur', 'Kitchen'),
  option('storage', 'Penyimpanan', 'Storage'),
];

const partnershipTypeOptions = [
  option('franchise', 'Franchise', 'Franchise'),
  option('partnership', 'Kemitraan', 'Partnership'),
  option('reseller', 'Reseller', 'Reseller'),
  option('dropship', 'Dropship', 'Dropship'),
  option('agent', 'Agen', 'Agent'),
  option('distributor', 'Distributor', 'Distributor'),
  option('consignment', 'Konsinyasi', 'Consignment'),
  option('joint_production', 'Produksi bersama', 'Joint production'),
];

const legalStatusOptions = [
  option('complete', 'Legalitas lengkap', 'Fully registered'),
  option('partial', 'Sebagian sudah ada', 'Partially registered'),
  option('in_process', 'Sedang diproses', 'In process'),
  option('not_registered', 'Belum terdaftar', 'Not registered'),
  option('not_applicable', 'Tidak berlaku', 'Not applicable'),
];

const packagingMaterialOptions = [
  option('plastic', 'Plastik', 'Plastic'),
  option('paper', 'Kertas / karton', 'Paper / cardboard'),
  option('glass', 'Kaca', 'Glass'),
  option('metal', 'Logam', 'Metal'),
  option('wood', 'Kayu', 'Wood'),
  option('fabric', 'Kain', 'Fabric'),
  option('biodegradable', 'Ramah lingkungan', 'Biodegradable'),
];

const shippingAreaOptions = [
  option('pickup_only', 'Ambil di tempat', 'Pickup only'),
  option('same_city', 'Dalam kota', 'Same city'),
  option('same_province', 'Dalam provinsi', 'Same province'),
  option('java_bali', 'Jawa & Bali', 'Java & Bali'),
  option('nationwide', 'Seluruh Indonesia', 'Nationwide'),
  option('international', 'Internasional', 'International'),
];

function priceField(intent: CreateIntent): ListingFieldSchema {
  return {
    key: intent === 'offer' ? 'price_mode' : 'budget_mode',
    type: 'radio',
    labelId: intent === 'offer' ? 'Tipe harga' : 'Tipe budget',
    labelEn: intent === 'offer' ? 'Price type' : 'Budget type',
    helpId:
      intent === 'offer'
        ? 'Pilih cara harga ditampilkan ke pembeli.'
        : 'Pilih cara budget ditampilkan ke penyedia.',
    helpEn:
      intent === 'offer'
        ? 'Choose how the price is shown to buyers.'
        : 'Choose how the budget is shown to providers.',
    required: intent === 'offer',
    step: 4,
    group: 'primary',
    options: priceOptions[intent].map(([value, labelId, labelEn]) =>
      option(value, labelId, labelEn),
    ),
  };
}

function baseMain(intent: CreateIntent): ListingFieldSchema[] {
  return [
    {
      key: 'title',
      type: 'text',
      labelId: intent === 'offer' ? 'Judul penawaran' : 'Judul kebutuhan',
      labelEn: intent === 'offer' ? 'Offer title' : 'Request title',
      helpId:
        intent === 'offer'
          ? 'Tulis nama yang dicari pembeli. Hindari judul terlalu umum seperti "produk bagus".'
          : 'Tulis kebutuhan utama dengan barang/jasa dan jumlah jika sudah tahu.',
      helpEn:
        intent === 'offer'
          ? 'Write the name buyers would search for. Avoid vague titles like "great product".'
          : 'Write the main need with item/service and quantity if known.',
      placeholderId:
        intent === 'offer'
          ? 'Biji Kopi Arabika Gayo Grade 1'
          : 'Butuh Biji Kopi Arabika 10 Kg per Minggu',
      placeholderEn:
        intent === 'offer'
          ? 'Gayo Arabica Coffee Beans Grade 1'
          : 'Need 10 kg Gayo Arabica Coffee Beans Weekly',
      required: true,
      step: 4,
      group: 'primary',
      validation: { minLength: 6, maxLength: 160 },
    },
    priceField(intent),
    {
      key: 'price_amount',
      type: 'currency',
      labelId: intent === 'offer' ? 'Harga' : 'Budget',
      labelEn: intent === 'offer' ? 'Price' : 'Budget',
      helpId:
        intent === 'offer'
          ? 'Isi angka saja. Kosongkan kalau harga perlu dibicarakan.'
          : 'Isi angka saja. Kosongkan kalau budget belum pasti.',
      helpEn:
        intent === 'offer'
          ? 'Numbers only. Leave empty if the price needs discussion.'
          : 'Numbers only. Leave empty if the budget is not decided yet.',
      placeholderId: intent === 'offer' ? '75000' : '1000000',
      placeholderEn: intent === 'offer' ? '75000' : '1000000',
      required: false,
      step: 4,
      group: 'primary',
    },
    {
      key: 'summary',
      type: 'textarea',
      labelId: intent === 'offer' ? 'Ringkasan singkat' : 'Brief kebutuhan',
      labelEn: intent === 'offer' ? 'Short summary' : 'Need brief',
      helpId:
        intent === 'offer'
          ? 'Jelaskan manfaat, stok, area, atau syarat penting dalam 1-2 kalimat.'
          : 'Tulis konteks, jumlah jika sudah tahu, deadline, area, atau syarat utama. Tidak perlu lengkap dulu.',
      helpEn:
        intent === 'offer'
          ? 'Explain benefit, stock, area, or key terms in 1-2 sentences.'
          : 'Share context, quantity if known, deadline, area, or key requirements. It does not need to be complete upfront.',
      placeholderId:
        intent === 'offer'
          ? 'Contoh: Stok rutin 50 kg per minggu, bisa kirim Bandung/Jakarta, tersedia sampel.'
          : 'Contoh: Butuh supplier mingguan untuk 2 outlet di Bandung. Budget masih fleksibel, prioritas kualitas stabil.',
      placeholderEn:
        intent === 'offer'
          ? 'Example: Weekly 50 kg stock, ships to Bandung/Jakarta, samples available.'
          : 'Example: Need a weekly supplier for 2 outlets in Bandung. Budget is flexible; stable quality matters most.',
      required: true,
      step: 4,
      group: 'primary',
      validation: { minLength: 12, maxLength: 280 },
    },
  ];
}

const categoryFields: Record<
  string,
  Record<CreateIntent, ListingFieldSchema[]>
> = {
  'materials-suppliers': {
    offer: [
      {
        key: 'item_name',
        type: 'text',
        labelId: 'Nama bahan atau produk',
        labelEn: 'Supply or product name',
        helpId:
          'Isi nama barang yang kamu jual, bukan nama toko. Contoh: biji kopi, cup plastik, tepung mocaf.',
        helpEn:
          'Enter the item you sell, not the store name. Example: coffee beans, plastic cups, mocaf flour.',
        placeholderId: 'Biji kopi arabika, cup plastik 16 oz, tepung mocaf',
        placeholderEn: 'Arabica coffee beans, 16 oz plastic cups, mocaf flour',
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'unit',
        type: 'select',
        labelId: 'Satuan',
        labelEn: 'Unit',
        helpId:
          'Pilih satuan jual utama. Ini membantu harga, minimum order, dan pencarian terbaca konsisten.',
        helpEn:
          'Choose the main selling unit. This keeps price, MOQ, and search consistent.',
        required: true,
        step: 4,
        group: 'primary',
        options: tradeUnitOptions,
      },
      {
        key: 'minimum_order',
        type: 'number',
        labelId: 'Minimum pembelian',
        labelEn: 'Minimum order',
        helpId: 'Jumlah paling kecil yang bisa dibeli pelanggan.',
        helpEn: 'The smallest quantity a buyer can order.',
        required: false,
        step: 4,
        group: 'primary',
        placeholderId: '5 kg, 100 pcs, atau 1 dus',
        placeholderEn: '5 kg, 100 pcs, or 1 box',
      },
      {
        key: 'stock_status',
        type: 'radio',
        labelId: 'Ketersediaan stok',
        labelEn: 'Stock availability',
        helpId:
          'Pilih pola stok utama. Detail jumlah stok bisa ditulis di kapasitas pasokan.',
        helpEn:
          'Choose the main stock pattern. Quantity details can go into supply capacity.',
        required: false,
        step: 4,
        group: 'primary',
        options: stockStatusOptions,
      },
      {
        key: 'supply_capacity',
        type: 'text',
        labelId: 'Kapasitas pasokan',
        labelEn: 'Supply capacity',
        helpId:
          'Kira-kira kemampuan pasok per minggu/bulan jika ada pesanan rutin.',
        helpEn:
          'Approximate weekly/monthly capacity if buyers need recurring supply.',
        placeholderId: '50-100 kg per minggu',
        placeholderEn: '50-100 kg weekly',
        required: false,
        step: 5,
        group: 'additional',
      },
      {
        key: 'owned_certifications',
        type: 'multi-select',
        labelId: 'Sertifikasi yang dimiliki',
        labelEn: 'Owned certifications',
        helpId: 'Isi hanya yang benar-benar dimiliki atau sedang proses.',
        helpEn:
          'Only list certifications you have or are currently processing.',
        placeholderId: 'Halal, PIRT, BPOM, COA, MSDS',
        placeholderEn: 'Halal, PIRT, BPOM, COA, MSDS',
        options: certificationOptions,
        allowCustomOption: true,
        required: false,
        step: 5,
        group: 'additional',
      },
      {
        key: 'sample_available',
        type: 'toggle',
        labelId: 'Sampel tersedia',
        labelEn: 'Sample available',
        helpId: 'Aktifkan kalau pembeli bisa minta contoh sebelum order besar.',
        helpEn: 'Turn on if buyers can request samples before a larger order.',
        required: false,
        step: 5,
        group: 'additional',
      },
    ],
    request: [
      {
        key: 'item_needed',
        type: 'text',
        labelId: 'Bahan yang dibutuhkan',
        labelEn: 'Supply needed',
        helpId:
          'Isi barang yang dicari. Kalau bisa, sebut grade, ukuran, bahan, atau standar.',
        helpEn:
          'Enter the item needed. If possible, mention grade, size, material, or standard.',
        placeholderId: 'Biji kopi arabika grade 1',
        placeholderEn: 'Grade 1 arabica coffee beans',
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'unit',
        type: 'select',
        labelId: 'Satuan kebutuhan',
        labelEn: 'Required unit',
        helpId:
          'Opsional. Isi kalau kamu sudah tahu satuan atau ukuran kebutuhan.',
        helpEn: 'Optional. Fill this if you already know the unit or size.',
        required: false,
        step: 4,
        group: 'primary',
        options: tradeUnitOptions,
      },
      {
        key: 'quantity',
        type: 'number',
        labelId: 'Jumlah',
        labelEn: 'Quantity',
        helpId:
          'Opsional. Perkiraan juga boleh; detail bisa disepakati saat penyedia merespons.',
        helpEn:
          'Optional. An estimate is fine; details can be clarified when providers respond.',
        required: false,
        step: 4,
        group: 'primary',
        placeholderId: '10',
        placeholderEn: '10',
      },
      {
        key: 'needed_by',
        type: 'date',
        labelId: 'Dibutuhkan kapan',
        labelEn: 'Needed by',
        helpId: 'Opsional. Isi kalau ada deadline pembelian atau produksi.',
        helpEn:
          'Optional. Fill this if there is a purchase or production deadline.',
        required: false,
        step: 4,
        group: 'primary',
      },
      {
        key: 'need_frequency',
        type: 'radio',
        labelId: 'Frekuensi kebutuhan',
        labelEn: 'Need frequency',
        helpId: 'Contoh: sekali beli, mingguan, bulanan, atau kontrak rutin.',
        helpEn: 'Example: one-time, weekly, monthly, or recurring contract.',
        placeholderId: 'Mingguan untuk 3 outlet',
        placeholderEn: 'Weekly for 3 outlets',
        options: needFrequencyOptions,
        required: false,
        step: 5,
        group: 'additional',
      },
      {
        key: 'required_certifications',
        type: 'multi-select',
        labelId: 'Sertifikasi yang diwajibkan',
        labelEn: 'Required certifications',
        helpId: 'Isi kalau supplier wajib punya dokumen tertentu.',
        helpEn: 'Fill this if suppliers must have specific documents.',
        placeholderId: 'Halal aktif dan COA batch',
        placeholderEn: 'Active halal certificate and batch COA',
        options: certificationOptions,
        allowCustomOption: true,
        required: false,
        step: 5,
        group: 'additional',
      },
      {
        key: 'cold_chain',
        type: 'toggle',
        labelId: 'Perlu cold chain',
        labelEn: 'Cold chain needed',
        helpId: 'Aktifkan untuk bahan yang harus dikirim dingin/beku.',
        helpEn: 'Turn on for goods that must be shipped chilled/frozen.',
        required: false,
        step: 5,
        group: 'additional',
      },
    ],
  },
  services: {
    offer: [
      {
        key: 'service_name',
        type: 'text',
        labelId: 'Nama jasa',
        labelEn: 'Service name',
        helpId:
          'Sebut jasa utama yang kamu tawarkan, bukan semua layanan sekaligus.',
        helpEn: 'Name the main service you offer, not every service at once.',
        placeholderId: 'Foto produk, desain kemasan, urus NIB',
        placeholderEn: 'Product photography, packaging design, NIB licensing',
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'pricing_basis',
        type: 'radio',
        labelId: 'Sistem harga',
        labelEn: 'Pricing basis',
        helpId:
          'Jelaskan harga dihitung per proyek, per jam, per kunjungan, atau paket.',
        helpEn:
          'Explain whether pricing is per project, hour, visit, or package.',
        placeholderId: 'Mulai Rp500.000 per proyek',
        placeholderEn: 'Starts at IDR 500,000 per project',
        options: pricingBasisOptions,
        required: false,
        step: 4,
        group: 'primary',
      },
      {
        key: 'delivery_estimate',
        type: 'radio',
        labelId: 'Estimasi pengerjaan',
        labelEn: 'Delivery estimate',
        helpId: 'Berapa lama biasanya selesai setelah brief dan bahan lengkap.',
        helpEn:
          'How long it usually takes after the brief and materials are ready.',
        placeholderId: '3-5 hari kerja',
        placeholderEn: '3-5 business days',
        options: deliveryEstimateOptions,
        required: false,
        step: 4,
        group: 'primary',
      },
      {
        key: 'portfolio',
        type: 'textarea',
        labelId: 'Portofolio',
        labelEn: 'Portfolio',
        required: false,
        step: 5,
        group: 'additional',
      },
      {
        key: 'work_warranty',
        type: 'radio',
        labelId: 'Garansi pengerjaan',
        labelEn: 'Work warranty',
        options: serviceWarrantyOptions,
        required: false,
        step: 5,
        group: 'additional',
      },
    ],
    request: [
      {
        key: 'service_needed',
        type: 'text',
        labelId: 'Jasa yang dibutuhkan',
        labelEn: 'Service needed',
        helpId:
          'Sebut pekerjaan yang kamu butuhkan dengan output yang diharapkan.',
        helpEn: 'Name the work you need and the expected output.',
        placeholderId: 'Butuh foto produk untuk 30 SKU',
        placeholderEn: 'Need product photos for 30 SKUs',
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'work_brief',
        type: 'textarea',
        labelId: 'Ringkasan pekerjaan',
        labelEn: 'Work brief',
        helpId:
          'Ceritakan konteks, jumlah pekerjaan, referensi, dan batasan penting.',
        helpEn:
          'Share context, workload, references, and important constraints.',
        placeholderId:
          'Contoh: Foto untuk marketplace, background putih, butuh 3 angle per produk.',
        placeholderEn:
          'Example: Marketplace photos, white background, need 3 angles per product.',
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'target_done',
        type: 'date',
        labelId: 'Target selesai',
        labelEn: 'Target completion',
        required: false,
        step: 4,
        group: 'primary',
      },
      {
        key: 'provider_criteria',
        type: 'textarea',
        labelId: 'Kriteria penyedia',
        labelEn: 'Provider criteria',
        required: false,
        step: 5,
        group: 'additional',
      },
    ],
  },
  'machines-tools': {
    offer: [
      {
        key: 'equipment_name',
        type: 'text',
        labelId: 'Nama mesin atau alat',
        labelEn: 'Machine or tool name',
        helpId: 'Isi nama alat spesifik yang dijual/disewakan.',
        helpEn: 'Enter the specific machine/tool being sold or rented.',
        placeholderId: 'Cup sealer, oven deck, freezer box',
        placeholderEn: 'Cup sealer, deck oven, chest freezer',
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'sale_mode',
        type: 'radio',
        labelId: 'Jual atau sewa',
        labelEn: 'Sell or rent',
        helpId: 'Pilih apakah alat ini dijual putus atau bisa disewa.',
        helpEn: 'Choose whether this tool is for sale or available to rent.',
        required: true,
        step: 4,
        group: 'primary',
        options: [
          option('sell', 'Jual', 'Sell'),
          option('rent', 'Sewa', 'Rent'),
        ],
      },
      {
        key: 'condition',
        type: 'radio',
        labelId: 'Kondisi',
        labelEn: 'Condition',
        helpId:
          'Tulis kondisi singkat: baru, bekas, siap pakai, atau perlu servis.',
        helpEn:
          'Write a short condition: new, used, ready to use, or needs service.',
        placeholderId: 'Baru, garansi 1 tahun',
        placeholderEn: 'New, 1-year warranty',
        options: equipmentConditionOptions,
        required: false,
        step: 4,
        group: 'primary',
      },
      {
        key: 'brand_model',
        type: 'text',
        labelId: 'Merek dan model',
        labelEn: 'Brand and model',
        required: false,
        step: 5,
        group: 'additional',
      },
      {
        key: 'warranty',
        type: 'radio',
        labelId: 'Garansi',
        labelEn: 'Warranty',
        options: warrantyOptions,
        required: false,
        step: 5,
        group: 'additional',
      },
    ],
    request: [
      {
        key: 'equipment_needed',
        type: 'text',
        labelId: 'Mesin atau alat yang dicari',
        labelEn: 'Machine or tool needed',
        helpId: 'Sebut alat yang dicari dan kapasitas minimum kalau ada.',
        helpEn: 'Name the tool needed and minimum capacity if any.',
        placeholderId: 'Mesin sealer cup untuk minuman 16 oz',
        placeholderEn: 'Cup sealing machine for 16 oz drinks',
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'buy_or_rent',
        type: 'radio',
        labelId: 'Beli atau sewa',
        labelEn: 'Buy or rent',
        helpId: 'Pilih rencana transaksi supaya penyedia tahu opsi yang cocok.',
        helpEn:
          'Choose the transaction plan so providers know the right option.',
        required: true,
        step: 4,
        group: 'primary',
        options: [option('buy', 'Beli', 'Buy'), option('rent', 'Sewa', 'Rent')],
      },
      {
        key: 'needed_by',
        type: 'date',
        labelId: 'Dibutuhkan kapan',
        labelEn: 'Needed by',
        required: false,
        step: 4,
        group: 'primary',
      },
      {
        key: 'minimum_capacity',
        type: 'text',
        labelId: 'Kapasitas minimum',
        labelEn: 'Minimum capacity',
        required: false,
        step: 5,
        group: 'additional',
      },
    ],
  },
  'business-places': {
    offer: [
      {
        key: 'place_name',
        type: 'text',
        labelId: 'Nama atau jenis tempat',
        labelEn: 'Place name or type',
        helpId:
          'Sebut jenis tempat yang ditawarkan, misalnya ruko, kios, booth, gudang.',
        helpEn:
          'Name the place type offered, such as shop house, kiosk, booth, warehouse.',
        placeholderId: 'Kios 3x3 dekat kampus',
        placeholderEn: '3x3 kiosk near campus',
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'transaction_mode',
        type: 'radio',
        labelId: 'Disewakan atau dijual',
        labelEn: 'For rent or sale',
        helpId: 'Pilih status transaksi tempat ini.',
        helpEn: 'Choose the transaction status for this place.',
        required: true,
        step: 4,
        group: 'primary',
        options: [
          option('rent', 'Disewakan', 'For rent'),
          option('sale', 'Dijual', 'For sale'),
        ],
      },
      {
        key: 'available_from',
        type: 'date',
        labelId: 'Tersedia mulai',
        labelEn: 'Available from',
        required: false,
        step: 4,
        group: 'primary',
      },
      {
        key: 'building_area',
        type: 'number',
        labelId: 'Luas bangunan',
        labelEn: 'Building area',
        suffixId: 'm²',
        suffixEn: 'm²',
        required: false,
        step: 5,
        group: 'additional',
      },
      {
        key: 'facilities',
        type: 'multi-select',
        labelId: 'Fasilitas',
        labelEn: 'Facilities',
        options: facilityOptions,
        allowCustomOption: true,
        required: false,
        step: 5,
        group: 'additional',
      },
    ],
    request: [
      {
        key: 'place_needed',
        type: 'text',
        labelId: 'Tempat yang dicari',
        labelEn: 'Place needed',
        helpId: 'Sebut jenis tempat, ukuran, dan area target jika sudah tahu.',
        helpEn: 'Name the place type, size, and target area if known.',
        placeholderId: 'Cari booth minuman 2x2 di area kampus',
        placeholderEn: 'Looking for a 2x2 drink booth near campus',
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'rent_or_buy',
        type: 'radio',
        labelId: 'Sewa atau beli',
        labelEn: 'Rent or buy',
        required: true,
        step: 4,
        group: 'primary',
        options: [option('rent', 'Sewa', 'Rent'), option('buy', 'Beli', 'Buy')],
      },
      {
        key: 'target_move',
        type: 'date',
        labelId: 'Target pindah',
        labelEn: 'Target move date',
        required: false,
        step: 4,
        group: 'primary',
      },
      {
        key: 'required_facilities',
        type: 'multi-select',
        labelId: 'Fasilitas wajib',
        labelEn: 'Required facilities',
        options: facilityOptions,
        allowCustomOption: true,
        required: false,
        step: 5,
        group: 'additional',
      },
    ],
  },
  'business-opportunities': {
    offer: [
      {
        key: 'opportunity_name',
        type: 'text',
        labelId: 'Nama peluang',
        labelEn: 'Opportunity name',
        helpId: 'Sebut nama program/peluang yang ditawarkan.',
        helpEn: 'Name the program/opportunity being offered.',
        placeholderId: 'Kemitraan minuman modal kecil',
        placeholderEn: 'Low-capital drink partnership',
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'partnership_type',
        type: 'radio',
        labelId: 'Jenis kerja sama',
        labelEn: 'Partnership type',
        helpId:
          'Contoh: reseller, franchise, distributor, konsinyasi, atau produksi bersama.',
        helpEn:
          'Example: reseller, franchise, distributor, consignment, or co-production.',
        placeholderId: 'Reseller, franchise, distributor',
        placeholderEn: 'Reseller, franchise, distributor',
        options: partnershipTypeOptions,
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'initial_capital',
        type: 'currency',
        labelId: 'Modal awal',
        labelEn: 'Initial capital',
        required: false,
        step: 4,
        group: 'primary',
      },
      {
        key: 'training_support',
        type: 'toggle',
        labelId: 'Pelatihan',
        labelEn: 'Training',
        required: false,
        step: 5,
        group: 'additional',
      },
      {
        key: 'legal_status',
        type: 'radio',
        labelId: 'Status legalitas',
        labelEn: 'Legal status',
        options: legalStatusOptions,
        required: false,
        step: 5,
        group: 'additional',
      },
    ],
    request: [
      {
        key: 'opportunity_needed',
        type: 'text',
        labelId: 'Peluang yang dicari',
        labelEn: 'Opportunity needed',
        helpId: 'Sebut jenis peluang dan batas modal jika sudah ada.',
        helpEn: 'Name the opportunity type and capital limit if any.',
        placeholderId: 'Cari kemitraan makanan modal di bawah 5 juta',
        placeholderEn: 'Looking for food partnership under IDR 5M',
        required: true,
        step: 4,
        group: 'primary',
      },
      {
        key: 'partnership_type',
        type: 'radio',
        labelId: 'Jenis kerja sama',
        labelEn: 'Partnership type',
        options: partnershipTypeOptions,
        required: false,
        step: 4,
        group: 'primary',
      },
      {
        key: 'capital_budget',
        type: 'currency',
        labelId: 'Budget modal',
        labelEn: 'Capital budget',
        required: false,
        step: 4,
        group: 'primary',
      },
      {
        key: 'experience',
        type: 'textarea',
        labelId: 'Pengalaman yang dimiliki',
        labelEn: 'Existing experience',
        required: false,
        step: 5,
        group: 'additional',
      },
    ],
  },
};

const locationFields: Record<string, ListingFieldSchema[]> = {
  services: [
    {
      key: 'service_area',
      type: 'text',
      labelId: 'Area layanan',
      labelEn: 'Service area',
      helpId:
        'Isi kota/area yang bisa dilayani. Jangan tulis alamat pribadi jika tidak perlu.',
      helpEn:
        'Enter the cities/areas you can serve. Do not enter a private address unless needed.',
      placeholderId: 'Bandung, Cimahi, remote nasional',
      placeholderEn: 'Bandung, Cimahi, nationwide remote',
      required: true,
      step: 7,
      group: 'location',
    },
    {
      key: 'remote_available',
      type: 'toggle',
      labelId: 'Bisa remote',
      labelEn: 'Remote available',
      helpId: 'Aktifkan kalau pekerjaan bisa dilakukan tanpa datang ke lokasi.',
      helpEn: 'Turn on if the work can be done without visiting the location.',
      required: false,
      step: 7,
      group: 'location',
    },
    {
      key: 'onsite_available',
      type: 'toggle',
      labelId: 'Bisa datang ke lokasi',
      labelEn: 'Can visit location',
      helpId: 'Aktifkan kalau kamu bisa datang ke tempat pelanggan.',
      helpEn: 'Turn on if you can visit the customer location.',
      required: false,
      step: 7,
      group: 'location',
    },
  ],
  'business-places': [
    {
      key: 'address',
      type: 'textarea',
      labelId: 'Alamat lengkap',
      labelEn: 'Full address',
      helpId:
        'Isi alamat yang aman ditampilkan untuk tempat usaha. Hindari detail pribadi.',
      helpEn: 'Enter a safe-to-show business address. Avoid private details.',
      placeholderId: 'Nama jalan, area, kota, patokan utama',
      placeholderEn: 'Street name, area, city, main landmark',
      required: true,
      step: 7,
      group: 'location',
    },
    {
      key: 'landmark',
      type: 'text',
      labelId: 'Patokan lokasi',
      labelEn: 'Location landmark',
      helpId: 'Bantu orang memahami posisi tanpa harus membuka peta.',
      helpEn: 'Help people understand the position without opening a map.',
      placeholderId: 'Dekat kampus, pasar, jalan utama',
      placeholderEn: 'Near campus, market, main road',
      required: false,
      step: 7,
      group: 'location',
    },
  ],
};

export function buildListingFieldSchema(
  intent: CreateIntent,
  categorySlug: string,
  subcategorySlug?: string,
): ListingFieldSchema[] {
  const category = categoryFields[categorySlug]?.[intent] || [];
  const subcategorySpecific: ListingFieldSchema[] =
    subcategorySlug === 'business-packaging'
      ? [
          {
            key: 'material',
            type: 'multi-select',
            labelId: 'Bahan kemasan',
            labelEn: 'Packaging material',
            options: packagingMaterialOptions,
            allowCustomOption: true,
            required: false,
            step: 5,
            group: 'additional',
          },
          {
            key: 'custom_printing',
            type: 'toggle',
            labelId: 'Bisa custom cetak',
            labelEn: 'Custom printing available',
            required: false,
            step: 5,
            group: 'additional',
          },
        ]
      : subcategorySlug === 'technical-repair'
        ? [
            {
              key: 'warranty',
              type: 'radio',
              labelId: 'Garansi servis',
              labelEn: 'Service warranty',
              options: warrantyOptions,
              required: false,
              step: 5,
              group: 'additional',
            },
          ]
        : [];
  const locations = locationFields[categorySlug] || [
    {
      key: 'location',
      type: 'text',
      labelId: 'Lokasi / area',
      labelEn: 'Location / area',
      helpId: 'Isi kota asal barang atau area transaksi utama.',
      helpEn: 'Enter the item city or main transaction area.',
      placeholderId: 'Bandung, Jawa Barat',
      placeholderEn: 'Bandung, West Java',
      required: true,
      step: 7,
      group: 'location',
    },
    {
      key: 'shipping_area',
      type: 'radio',
      labelId: 'Area pengiriman',
      labelEn: 'Shipping area',
      helpId:
        'Isi area yang bisa dikirim. Kosongkan kalau hanya ambil di tempat.',
      helpEn: 'Enter delivery coverage. Leave empty for pickup only.',
      placeholderId: 'Bandung Raya, Jabodetabek, nasional via cargo',
      placeholderEn: 'Greater Bandung, Greater Jakarta, nationwide cargo',
      options: shippingAreaOptions,
      required: false,
      step: 7,
      group: 'location',
    },
  ];
  const intentLocations =
    intent === 'request'
      ? locations.map(field => ({
          ...field,
          labelId:
            field.key === 'address'
              ? 'Area target'
              : field.key === 'service_area'
                ? 'Area kebutuhan'
                : field.labelId,
          labelEn:
            field.key === 'address'
              ? 'Target area'
              : field.key === 'service_area'
                ? 'Need area'
                : field.labelEn,
          helpId:
            field.key === 'address' || field.key === 'location'
              ? 'Opsional. Isi kota/area umum dulu; alamat detail bisa menyusul saat cocok.'
              : field.helpId,
          helpEn:
            field.key === 'address' || field.key === 'location'
              ? 'Optional. Start with a city or general area; exact address can follow once there is a fit.'
              : field.helpEn,
          required: false,
        }))
      : locations;
  const contact: ListingFieldSchema[] = [
    {
      key: 'display_as',
      type: 'radio',
      labelId: 'Tampilkan sebagai',
      labelEn: 'Display as',
      helpId:
        intent === 'request'
          ? 'Pilih identitas yang ingin dilihat penyedia saat menanggapi kebutuhan ini.'
          : 'Pilih identitas yang ingin dilihat pembeli di postingan ini.',
      helpEn:
        intent === 'request'
          ? 'Choose the identity providers will see when responding to this need.'
          : 'Choose the identity buyers will see on this post.',
      required: true,
      step: 8,
      group: 'contact',
      options: [
        option('personal', 'Profil pribadi', 'Personal profile'),
        option('business', 'Salah satu usaha saya', 'One of my businesses'),
      ],
    },
    {
      key: 'contact_channel',
      type: 'radio',
      labelId: 'Pilihan kontak',
      labelEn: 'Contact option',
      helpId:
        intent === 'request'
          ? 'Pilih jalur kontak utama untuk penyedia. Chat menyimpan riwayat di Lajukan; WhatsApp untuk respons cepat.'
          : 'Pilih jalur kontak utama untuk pembeli. Chat menyimpan riwayat di Lajukan; WhatsApp untuk respons cepat.',
      helpEn:
        intent === 'request'
          ? 'Choose the main contact path for providers. Chat keeps history in Lajukan; WhatsApp supports fast response.'
          : 'Choose the main contact path for buyers. Chat keeps history in Lajukan; WhatsApp supports fast response.',
      required: true,
      step: 8,
      group: 'contact',
      options: [
        option('chat', 'Chat Lajukan', 'Lajukan chat'),
        option('whatsapp', 'WhatsApp', 'WhatsApp'),
        option('both', 'Keduanya', 'Both'),
      ],
    },
  ];
  return [
    ...baseMain(intent),
    ...category,
    ...subcategorySpecific,
    ...intentLocations,
    ...contact,
  ];
}

export function fieldsForStep(
  fields: ListingFieldSchema[],
  step: 4 | 5 | 7 | 8,
) {
  return fields.filter(field => field.step === step);
}
