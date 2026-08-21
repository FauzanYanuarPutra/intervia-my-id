export type LocalizedText = {
  id: string;
  en: string;
};

export type JourneyIconKey =
  | 'sparkles'
  | 'wallet'
  | 'coins'
  | 'briefcase'
  | 'store'
  | 'rocket'
  | 'book'
  | 'target'
  | 'shield'
  | 'users'
  | 'graduation'
  | 'workflow';

export type JourneyAction = {
  href: string;
  title: LocalizedText;
  description: LocalizedText;
  tag: LocalizedText;
  icon: JourneyIconKey;
  tone: 'emerald' | 'sky' | 'amber' | 'rose' | 'violet';
};

export type JourneyStage = {
  slug: string;
  level: string;
  icon: JourneyIconKey;
  title: LocalizedText;
  summary: LocalizedText;
  capital: LocalizedText;
  target: LocalizedText;
  cta: LocalizedText;
  ctaHref: string;
  missions: LocalizedText[];
  warnings: LocalizedText[];
  actions: JourneyAction[];
};

export type OpportunityLane = {
  slug: string;
  icon: JourneyIconKey;
  title: LocalizedText;
  description: LocalizedText;
  href: string;
  cta: LocalizedText;
};

export type EducationModule = {
  slug: string;
  icon: JourneyIconKey;
  title: LocalizedText;
  description: LocalizedText;
  outcome: LocalizedText;
  href: string;
  cta: LocalizedText;
};

export type CapitalLadderItem = {
  slug: string;
  icon: JourneyIconKey;
  title: LocalizedText;
  description: LocalizedText;
  rule: LocalizedText;
  href: string;
};

export type DailyLoopItem = {
  slug: string;
  time: LocalizedText;
  title: LocalizedText;
  description: LocalizedText;
};

export function pickJourneyText(text: LocalizedText, locale: string): string {
  return locale === 'id' ? text.id : text.en;
}

export const ZERO_CAPITAL_GUARDRAILS: LocalizedText[] = [
  {
    id: 'Belum perlu stok barang dulu. Validasi pasar lewat jasa, komisi, atau order by request.',
    en: 'Do not buy inventory yet. Validate demand through services, commissions, or order-by-request.',
  },
  {
    id: 'Belum perlu sewa tempat. Pakai HP, rumah, komunitas, dan channel online dulu.',
    en: 'Do not rent space yet. Start with your phone, home base, community, and online channels.',
  },
  {
    id: 'Belum perlu tim besar. Bangun ritme dan SOP pribadi dulu sebelum merekrut orang.',
    en: 'Do not build a team yet. Build your own rhythm and SOPs before hiring.',
  },
  {
    id: 'Belum perlu iklan besar atau beli course mahal. Cari cashflow dulu, baru reinvest terukur.',
    en: 'Do not spend on big ads or expensive courses yet. Find cashflow first, then reinvest carefully.',
  },
];

export const ZERO_CAPITAL_STAGES: JourneyStage[] = [
  {
    slug: 'level-0',
    level: 'Level 0',
    icon: 'sparkles',
    title: {
      id: 'Nol Modal, Cari Nafas Dulu',
      en: 'Zero Capital, Find Oxygen First',
    },
    summary: {
      id: 'Tahap ini fokus ke cashflow pertama tanpa stok, tanpa ruko, tanpa alat mahal. Yang dijual dulu adalah waktu, tenaga, respon cepat, dan skill yang bisa dipelajari cepat.',
      en: 'This stage focuses on first cashflow without stock, storefront, or expensive tools. Sell time, effort, responsiveness, and quick-to-learn skills first.',
    },
    capital: {
      id: 'Modal wajib: Rp0. Modal nyata: HP, internet, waktu, disiplin, dan keberanian eksekusi.',
      en: 'Required capital: $0. Real capital: a phone, internet, time, discipline, and execution.',
    },
    target: {
      id: 'Target naik level: dapat bukti kerja pertama, testimoni pertama, dan penghasilan pertama.',
      en: 'Level-up target: get your first proof of work, first testimonial, and first income.',
    },
    cta: {
      id: 'Buka jalur tanpa modal',
      en: 'Open the zero-capital path',
    },
    ctaHref: '/education?track=zero-capital',
    missions: [
      {
        id: 'Rapikan profil dan jelaskan kamu bisa bantu apa sekarang juga.',
        en: 'Clean up your profile and clearly explain what you can help with right now.',
      },
      {
        id: 'Cari 10 peluang harian yang tidak minta modal besar.',
        en: 'Find 10 daily opportunities that do not require big capital.',
      },
      {
        id: 'Ambil tugas kecil yang bisa selesai cepat untuk bangun reputasi.',
        en: 'Take small tasks you can finish quickly to build reputation.',
      },
    ],
    warnings: [
      {
        id: 'Jangan buka toko dulu.',
        en: 'Do not open a store yet.',
      },
      {
        id: 'Jangan utang demi terlihat besar.',
        en: 'Do not take debt just to look bigger.',
      },
      {
        id: 'Jangan beli alat sebelum ada order yang membayar alat itu.',
        en: 'Do not buy tools before orders can pay for them.',
      },
    ],
    actions: [
      {
        href: '/microgigs',
        title: {
          id: 'Ambil microgigs cepat',
          en: 'Take fast microgigs',
        },
        description: {
          id: 'Cari tugas harian, bantuan lapangan, admin, dan kerja cepat yang cair lebih dulu.',
          en: 'Look for daily tasks, field help, admin work, and quick jobs that pay first.',
        },
        tag: {
          id: 'Rp0 dulu',
          en: 'Start at $0',
        },
        icon: 'briefcase',
        tone: 'emerald',
      },
      {
        href: '/explore?type=job&q=lowongan',
        title: {
          id: 'Masuk ke kerja yang paling dekat',
          en: 'Enter the nearest work path',
        },
        description: {
          id: 'Fokus ke peran yang bisa kamu ambil sekarang sambil bangun pengalaman dan relasi.',
          en: 'Focus on roles you can take now while building experience and relationships.',
        },
        tag: {
          id: 'Cashflow pertama',
          en: 'First cashflow',
        },
        icon: 'target',
        tone: 'sky',
      },
      {
        href: '/education?track=zero-capital',
        title: {
          id: 'Belajar yang langsung kepakai',
          en: 'Learn what gets used immediately',
        },
        description: {
          id: 'Pelajari skill cepat jual, cara respon peluang, dan cara bikin bukti kerja pertama.',
          en: 'Learn fast-sell skills, opportunity response, and how to create first proof of work.',
        },
        tag: {
          id: 'Belajar sambil gerak',
          en: 'Learn while moving',
        },
        icon: 'graduation',
        tone: 'amber',
      },
    ],
  },
  {
    slug: 'level-1',
    level: 'Level 1',
    icon: 'wallet',
    title: {
      id: 'Cashflow Pertama',
      en: 'First Cashflow',
    },
    summary: {
      id: 'Begitu uang pertama masuk, fokus bukan gaya hidup. Fokusnya mengulang apa yang paling gampang cair dan paling sedikit drama.',
      en: 'Once the first money comes in, the focus is not lifestyle. The focus is repeating what clears fastest with the least drama.',
    },
    capital: {
      id: 'Modal masih tipis. Semua uang pertama dipakai untuk napas, data, transport, dan alat yang langsung menunjang order.',
      en: 'Capital is still thin. First money goes to breathing room, data, transport, and tools that directly support orders.',
    },
    target: {
      id: 'Target naik level: 3-10 transaksi sukses, portfolio kecil, dan repeat order pertama.',
      en: 'Level-up target: 3-10 successful transactions, a small portfolio, and the first repeat order.',
    },
    cta: {
      id: 'Ubah skill jadi penawaran',
      en: 'Turn skill into an offer',
    },
    ctaHref: '/create?mode=quick',
    missions: [
      {
        id: 'Pilih 1-2 layanan yang paling mudah dijual, jangan kebanyakan.',
        en: 'Pick 1-2 services that are easiest to sell; do not spread too wide.',
      },
      {
        id: 'Buat listing cepat atau profil jasa sederhana agar orang tahu cara membeli kamu.',
        en: 'Create a quick listing or simple service profile so people know how to buy from you.',
      },
      {
        id: 'Kumpulkan testimoni, before-after, atau hasil kerja kecil jadi portfolio.',
        en: 'Collect testimonials, before-after shots, or small outcomes as a portfolio.',
      },
    ],
    warnings: [
      {
        id: 'Jangan naikkan biaya hidup dari uang pertama.',
        en: 'Do not increase your lifestyle from the first income.',
      },
      {
        id: 'Jangan ambil semua jenis kerja. Pilih yang paling bisa diulang.',
        en: 'Do not take every kind of job. Pick what is easiest to repeat.',
      },
      {
        id: 'Jangan malu jual jasa yang sederhana kalau pasar membutuhkannya.',
        en: 'Do not avoid simple services when the market wants them.',
      },
    ],
    actions: [
      {
        href: '/create?mode=quick',
        title: {
          id: 'Pasang listing jasa cepat',
          en: 'Publish a service listing fast',
        },
        description: {
          id: 'Jelaskan output, harga awal, waktu pengerjaan, dan cara kontak supaya conversion naik.',
          en: 'Explain deliverables, starting price, turnaround time, and contact path to improve conversion.',
        },
        tag: {
          id: 'Jasa > stok',
          en: 'Service over stock',
        },
        icon: 'briefcase',
        tone: 'emerald',
      },
      {
        href: '/explore?type=freelancer&q=umkm',
        title: {
          id: 'Lihat benchmark talent lain',
          en: 'See how other talent positions themselves',
        },
        description: {
          id: 'Pelajari harga, positioning, dan bahasa jual yang dipakai pemain lain.',
          en: 'Study pricing, positioning, and sales language used by other players.',
        },
        tag: {
          id: 'Belajar pasar',
          en: 'Read the market',
        },
        icon: 'users',
        tone: 'sky',
      },
      {
        href: '/explore',
        title: {
          id: 'Cari peluang yang serupa',
          en: 'Look for similar opportunities',
        },
        description: {
          id: 'Kalau satu layanan mulai laku, cari versi yang demand-nya lebih rutin.',
          en: 'Once one service starts moving, find versions of it with more recurring demand.',
        },
        tag: {
          id: 'Repeatable',
          en: 'Repeatable',
        },
        icon: 'target',
        tone: 'amber',
      },
    ],
  },
  {
    slug: 'level-2',
    level: 'Level 2',
    icon: 'coins',
    title: {
      id: 'Bangun Modal Kecil',
      en: 'Build Small Capital',
    },
    summary: {
      id: 'Setelah ada ritme order, uang harus dipaksa jadi modal kerja kecil: alat sederhana, paket data lebih stabil, transport, template, packaging, atau stok by request.',
      en: 'Once orders have rhythm, money must become small working capital: simple tools, better data plans, transport, templates, packaging, or stock by request.',
    },
    capital: {
      id: 'Modal mulai ada, tapi belum aman. Reinvest bertahap, jangan all-in.',
      en: 'Capital starts to exist, but it is not safe yet. Reinvest gradually, not all-in.',
    },
    target: {
      id: 'Target naik level: punya cash buffer, penawaran lebih rapi, dan margin yang mulai bisa diukur.',
      en: 'Level-up target: build a cash buffer, cleaner offers, and measurable margins.',
    },
    cta: {
      id: 'Atur uang dan inventaris awal',
      en: 'Set up money and starter inventory',
    },
    ctaHref: '/payments',
    missions: [
      {
        id: 'Pisahkan uang hidup, uang jalan, dan uang reinvest.',
        en: 'Separate living money, operating money, and reinvestment money.',
      },
      {
        id: 'Cari produk atau alat yang bisa mempercepat order paling laku.',
        en: 'Find products or tools that speed up your best-performing orders.',
      },
      {
        id: 'Mulai catat margin, biaya kirim, repeat order, dan produk yang paling bergerak.',
        en: 'Start tracking margin, delivery cost, repeat orders, and the most active products.',
      },
    ],
    warnings: [
      {
        id: 'Jangan habiskan modal kecil untuk branding mewah.',
        en: 'Do not burn small capital on luxury branding.',
      },
      {
        id: 'Jangan stok banyak barang yang belum teruji.',
        en: 'Do not overstock unproven items.',
      },
      {
        id: 'Jangan buka terlalu banyak kategori sekaligus.',
        en: 'Do not open too many categories at once.',
      },
    ],
    actions: [
      {
        href: '/payments',
        title: {
          id: 'Bangun disiplin uang',
          en: 'Build money discipline',
        },
        description: {
          id: 'Pantau saldo, arus masuk, dan keputusan reinvest supaya modal tidak bocor.',
          en: 'Track balance, inflows, and reinvestment choices so capital does not leak away.',
        },
        tag: {
          id: 'Buffer dulu',
          en: 'Buffer first',
        },
        icon: 'wallet',
        tone: 'sky',
      },
      {
        href: '/explore?type=product&q=supplier',
        title: {
          id: 'Cari alat atau barang pendukung',
          en: 'Find tools or support goods',
        },
        description: {
          id: 'Belanja hanya yang mempercepat penjualan atau meningkatkan kualitas eksekusi.',
          en: 'Buy only what speeds up sales or improves execution quality.',
        },
        tag: {
          id: 'Modal kerja',
          en: 'Working capital',
        },
        icon: 'store',
        tone: 'amber',
      },
      {
        href: '/dashboard',
        title: {
          id: 'Pantau langkah yang mulai jadi mesin',
          en: 'Watch what starts becoming a machine',
        },
        description: {
          id: 'Lihat apa yang paling sering laku, paling sehat marginnya, dan paling layak diulang.',
          en: 'See what sells most often, has the healthiest margin, and deserves repetition.',
        },
        tag: {
          id: 'Naik kelas',
          en: 'Leveling up',
        },
        icon: 'workflow',
        tone: 'emerald',
      },
    ],
  },
  {
    slug: 'level-3',
    level: 'Level 3',
    icon: 'store',
    title: {
      id: 'Buka Usaha Ringan',
      en: 'Open a Lean Business',
    },
    summary: {
      id: 'Di tahap ini kamu tidak lagi menjual tenaga acak. Kamu mulai punya produk, jasa, paket, atau sistem kecil yang bisa dibeli berulang.',
      en: 'At this stage you are no longer selling random labor. You start to have products, services, packages, or a small system that can be bought repeatedly.',
    },
    capital: {
      id: 'Modal dipakai untuk menguatkan penawaran: stok tipis, quality control, alat inti, dan storefront.',
      en: 'Capital is used to strengthen the offer: light inventory, quality control, core tools, and storefront.',
    },
    target: {
      id: 'Target naik level: satu usaha kecil yang bisa jualan berulang tanpa bergantung penuh pada mood harian.',
      en: 'Level-up target: one small business that can sell repeatedly without depending entirely on daily mood.',
    },
    cta: {
      id: 'Masuk ke hub UMKM',
      en: 'Enter the UMKM hub',
    },
    ctaHref: '/umkm',
    missions: [
      {
        id: 'Pilih satu mesin inti: jasa, reseller, makanan, produk, atau agency mini.',
        en: 'Pick one core engine: service, reseller, food, product, or a mini agency.',
      },
      {
        id: 'Rapikan penawaran jadi paket, menu, atau katalog yang mudah dibeli orang.',
        en: 'Package the offer into bundles, menus, or catalogs that are easy to buy.',
      },
      {
        id: 'Bangun jalur order, pembayaran, dan follow-up yang konsisten.',
        en: 'Build consistent order, payment, and follow-up flows.',
      },
    ],
    warnings: [
      {
        id: 'Jangan buka lima usaha kecil sekaligus.',
        en: 'Do not open five small businesses at once.',
      },
      {
        id: 'Jangan terlalu cepat kejar omset kalau margin belum jelas.',
        en: 'Do not chase revenue too early when margin is still unclear.',
      },
      {
        id: 'Jangan biarkan semua order cuma lewat chat tanpa sistem.',
        en: 'Do not let every order happen through chat only without a system.',
      },
    ],
    actions: [
      {
        href: '/umkm',
        title: {
          id: 'Buka storefront dan operasional UMKM',
          en: 'Open a storefront and UMKM operations',
        },
        description: {
          id: 'Kelola toko, produk, QR, order online-offline, dan transaksi dalam satu hub.',
          en: 'Manage store, products, QR, online-offline orders, and transactions in one hub.',
        },
        tag: {
          id: 'Usaha sendiri',
          en: 'Own business',
        },
        icon: 'store',
        tone: 'emerald',
      },
      {
        href: '/create?mode=quick',
        title: {
          id: 'Buat katalog atau paket jualan',
          en: 'Create a catalog or offer package',
        },
        description: {
          id: 'Ubah penawaran acak jadi listing yang bisa dipahami dan dibeli lebih cepat.',
          en: 'Turn scattered offers into listings that are easier to understand and buy.',
        },
        tag: {
          id: 'Produk / jasa',
          en: 'Product / service',
        },
        icon: 'briefcase',
        tone: 'sky',
      },
      {
        href: '/my-listings',
        title: {
          id: 'Rapikan listing yang sudah jalan',
          en: 'Clean up the listings already running',
        },
        description: {
          id: 'Review mana yang benar-benar hidup dan mana yang sebaiknya dihentikan.',
          en: 'Review which listings are truly alive and which ones should be stopped.',
        },
        tag: {
          id: 'Fokus',
          en: 'Focus',
        },
        icon: 'shield',
        tone: 'amber',
      },
    ],
  },
  {
    slug: 'level-4',
    level: 'Level 4',
    icon: 'workflow',
    title: {
      id: 'Sistemkan Operasi',
      en: 'Systemize Operations',
    },
    summary: {
      id: 'Saat bisnis mulai jalan, tugas berikutnya adalah membunuh kekacauan. Bikin SOP, follow-up, CRM, dan tracking supaya growth tidak memakan kamu hidup-hidup.',
      en: 'Once the business moves, the next job is killing chaos. Build SOPs, follow-up, CRM, and tracking so growth does not eat you alive.',
    },
    capital: {
      id: 'Modal dipakai untuk efisiensi: tools, template, admin, quality control, dan automasi ringan.',
      en: 'Capital is used for efficiency: tools, templates, admin, quality control, and light automation.',
    },
    target: {
      id: 'Target naik level: order tetap jalan walau kamu tidak pegang semua hal sendiri.',
      en: 'Level-up target: orders keep moving even when you do not personally touch everything.',
    },
    cta: {
      id: 'Buka panel operasional',
      en: 'Open the operations panel',
    },
    ctaHref: '/dashboard',
    missions: [
      {
        id: 'Buat SOP order masuk, produksi/eksekusi, pembayaran, dan komplain.',
        en: 'Create SOPs for incoming orders, execution, payment, and complaints.',
      },
      {
        id: 'Pisahkan pelanggan baru, pelanggan repeat, dan pelanggan bermasalah.',
        en: 'Separate new customers, repeat customers, and risky customers.',
      },
      {
        id: 'Lihat channel yang paling menghasilkan, bukan cuma paling ramai.',
        en: 'Identify which channel produces the most, not just the loudest one.',
      },
    ],
    warnings: [
      {
        id: 'Jangan scale kalau cashflow dan service quality masih kacau.',
        en: 'Do not scale while cashflow and service quality are still chaotic.',
      },
      {
        id: 'Jangan tambah orang sebelum peran dan SOP jelas.',
        en: 'Do not add people before roles and SOPs are clear.',
      },
      {
        id: 'Jangan menilai usaha hanya dari omset. Lihat margin, repeat rate, dan kapasitas tim.',
        en: 'Do not judge the business by revenue alone. Look at margin, repeat rate, and team capacity.',
      },
    ],
    actions: [
      {
        href: '/dashboard',
        title: {
          id: 'Pantau performa inti',
          en: 'Track core performance',
        },
        description: {
          id: 'Lihat listing, order, transaksi, dan rekomendasi tindakan di satu panel.',
          en: 'Watch listings, orders, transactions, and action recommendations in one panel.',
        },
        tag: {
          id: 'Analytics',
          en: 'Analytics',
        },
        icon: 'workflow',
        tone: 'emerald',
      },
      {
        href: '/crm',
        title: {
          id: 'Bangun hubungan pelanggan',
          en: 'Build customer relationships',
        },
        description: {
          id: 'Jangan biarkan pelanggan repeat hilang hanya karena follow-up berantakan.',
          en: 'Do not lose repeat customers because follow-up is messy.',
        },
        tag: {
          id: 'Repeat order',
          en: 'Repeat orders',
        },
        icon: 'users',
        tone: 'sky',
      },
      {
        href: '/dashboard',
        title: {
          id: 'Putuskan dari data, bukan perasaan',
          en: 'Decide from data, not feelings',
        },
        description: {
          id: 'Pilih produk, channel, dan penawaran berdasarkan angka yang benar-benar sehat.',
          en: 'Choose products, channels, and offers using numbers that are actually healthy.',
        },
        tag: {
          id: 'Scale sehat',
          en: 'Healthy scale',
        },
        icon: 'target',
        tone: 'violet',
      },
    ],
  },
  {
    slug: 'level-5',
    level: 'Level 5',
    icon: 'rocket',
    title: {
      id: 'Naik ke Owner dan Ekspansi',
      en: 'Move into Ownership and Expansion',
    },
    summary: {
      id: 'Tahap ini bukan soal kelihatan besar. Tahap ini soal menambah distribution, brand trust, dan channel penghasilan baru tanpa merusak mesin utama.',
      en: 'This stage is not about looking big. It is about adding distribution, brand trust, and new income channels without breaking the core machine.',
    },
    capital: {
      id: 'Modal dipakai untuk ekspansi yang masih rasional: channel baru, partner, konten, dan pembelajaran lanjutan.',
      en: 'Capital is used for rational expansion: new channels, partners, content, and advanced learning.',
    },
    target: {
      id: 'Target akhir: kamu punya bisnis yang bisa tumbuh, bukan cuma kerja keras yang makin berat.',
      en: 'Final target: build a business that can grow, not just harder work that keeps getting heavier.',
    },
    cta: {
      id: 'Lihat jalur ekspansi',
      en: 'See the expansion path',
    },
    ctaHref: '/umkm',
    missions: [
      {
        id: 'Tambah channel penjualan yang paling masuk akal, satu per satu.',
        en: 'Add the most rational sales channels one by one.',
      },
      {
        id: 'Bangun brand trust lewat konten, testimoni, dan experience yang konsisten.',
        en: 'Build brand trust through content, testimonials, and a consistent experience.',
      },
      {
        id: 'Pertimbangkan monetisasi ilmu: kelas, template, konsultasi, atau komunitas.',
        en: 'Consider monetizing knowledge: classes, templates, consulting, or community.',
      },
    ],
    warnings: [
      {
        id: 'Jangan ekspansi sebelum mesin inti stabil.',
        en: 'Do not expand before the core machine is stable.',
      },
      {
        id: 'Jangan tambah channel kalau tim dan SOP belum siap menanggungnya.',
        en: 'Do not add channels before the team and SOPs can support them.',
      },
      {
        id: 'Jangan lupa bahwa margin sehat lebih penting daripada kelihatan besar.',
        en: 'Remember that healthy margin matters more than looking big.',
      },
    ],
    actions: [
      {
        href: '/umkm',
        title: {
          id: 'Masuk ke mesin distribusi lebih besar',
          en: 'Move into a larger distribution engine',
        },
        description: {
          id: 'Pakai layanan super app, operasional, dan omnichannel untuk memperluas jangkauan.',
          en: 'Use super app services, operations, and omnichannel flows to expand reach.',
        },
        tag: {
          id: 'Omnichannel',
          en: 'Omnichannel',
        },
        icon: 'rocket',
        tone: 'emerald',
      },
      {
        href: '/education?bundle=academy-business',
        title: {
          id: 'Monetisasi ilmu dan pengalaman',
          en: 'Monetize knowledge and experience',
        },
        description: {
          id: 'Naik dari operator menjadi owner yang juga bisa menjual insight, sistem, atau pelatihan.',
          en: 'Move from operator to owner who can also sell insight, systems, or training.',
        },
        tag: {
          id: 'Leverage',
          en: 'Leverage',
        },
        icon: 'graduation',
        tone: 'amber',
      },
      {
        href: '/explore?type=product&q=supplier',
        title: {
          id: 'Perluas penawaran dan partner',
          en: 'Expand offers and partners',
        },
        description: {
          id: 'Cari supplier, mitra, alat, atau kategori baru hanya bila mesin utama sudah sehat.',
          en: 'Find suppliers, partners, tools, or new categories only after the core machine is healthy.',
        },
        tag: {
          id: 'Ekspansi',
          en: 'Expansion',
        },
        icon: 'store',
        tone: 'sky',
      },
    ],
  },
];

export const ZERO_CAPITAL_OPPORTUNITIES: OpportunityLane[] = [
  {
    slug: 'time-labor',
    icon: 'briefcase',
    title: {
      id: 'Jual tenaga dan waktu dulu',
      en: 'Sell time and labor first',
    },
    description: {
      id: 'Mulai dari microgigs, helper, admin, live ops, riset, input data, kurir, atau tugas lapangan yang tidak butuh stok.',
      en: 'Start with microgigs, helper work, admin, live ops, research, data entry, courier work, or field tasks that do not need inventory.',
    },
    href: '/microgigs',
    cta: {
      id: 'Cari misi cepat',
      en: 'Find quick missions',
    },
  },
  {
    slug: 'digital-skill',
    icon: 'graduation',
    title: {
      id: 'Jual skill digital ringan',
      en: 'Sell light digital skills',
    },
    description: {
      id: 'Caption, customer service, desain simpel, AI operator, edit basic, upload katalog, dan pekerjaan digital yang bisa dipelajari cepat.',
      en: 'Captions, customer service, simple design, AI operations, basic editing, catalog uploads, and digital work that can be learned fast.',
    },
    href: '/education?track=skill-cash',
    cta: {
      id: 'Belajar yang langsung bisa dijual',
      en: 'Learn what you can sell fast',
    },
  },
  {
    slug: 'commission',
    icon: 'coins',
    title: {
      id: 'Jual akses, komisi, dan referral',
      en: 'Sell access, commissions, and referrals',
    },
    description: {
      id: 'Affiliate, reseller tanpa stok, makelar sehat, jasa titip, atau pencarian lead bisa jadi jembatan saat modal masih nol.',
      en: 'Affiliate work, inventory-free reselling, healthy brokering, concierge sourcing, or lead generation can bridge the gap while capital is still zero.',
    },
    href: '/explore?type=product&q=supplier',
    cta: {
      id: 'Lihat barang dan peluang tanpa stok',
      en: 'See stock-light opportunities',
    },
  },
  {
    slug: 'learn-inside-business',
    icon: 'users',
    title: {
      id: 'Masuk ke usaha orang lain dulu',
      en: 'Enter someone else’s business first',
    },
    description: {
      id: 'Bantu UMKM, toko, creator, atau tim kecil lain untuk belajar sistem sebelum buka usaha sendiri.',
      en: 'Support MSMEs, shops, creators, or other small teams to learn the system before opening your own business.',
    },
    href: '/explore?type=job&q=lowongan',
    cta: {
      id: 'Cari pintu masuk',
      en: 'Find an entry point',
    },
  },
];

export const ZERO_CAPITAL_EDUCATION_MODULES: EducationModule[] = [
  {
    slug: 'track-01',
    icon: 'book',
    title: {
      id: 'Track 01: Survival Tanpa Modal',
      en: 'Track 01: Zero-Capital Survival',
    },
    description: {
      id: 'Belajar urutan sehat: cari permintaan, pilih misi aman, dan berhenti beli hal yang belum menghasilkan.',
      en: 'Learn the healthy order: find demand, choose safe missions, and stop buying things that do not produce income yet.',
    },
    outcome: {
      id: 'Hasil: tahu harus mulai dari mana ketika belum punya apa-apa.',
      en: 'Outcome: know where to start when you have nothing yet.',
    },
    href: '/education?track=zero-capital',
    cta: {
      id: 'Mulai track ini',
      en: 'Start this track',
    },
  },
  {
    slug: 'track-02',
    icon: 'target',
    title: {
      id: 'Track 02: Cashflow 7 Hari',
      en: 'Track 02: 7-Day Cashflow',
    },
    description: {
      id: 'Latihan respon peluang, positioning jasa, dan penawaran yang bisa cair cepat tanpa ribet.',
      en: 'Practice opportunity response, service positioning, and offers that can close quickly without complexity.',
    },
    outcome: {
      id: 'Hasil: punya jalur menuju penghasilan pertama.',
      en: 'Outcome: have a path toward first income.',
    },
    href: '/education?track=skill-cash',
    cta: {
      id: 'Gas cashflow',
      en: 'Push cashflow',
    },
  },
  {
    slug: 'track-03',
    icon: 'wallet',
    title: {
      id: 'Track 03: Modal Kecil yang Waras',
      en: 'Track 03: Healthy Small Capital',
    },
    description: {
      id: 'Belajar kapan harus reinvest, kapan harus tahan uang, dan alat apa yang layak dibeli lebih dulu.',
      en: 'Learn when to reinvest, when to hold cash, and which tools deserve the first spend.',
    },
    outcome: {
      id: 'Hasil: modal kecil tidak habis buat gaya, tapi jadi mesin.',
      en: 'Outcome: small capital turns into a machine instead of style spending.',
    },
    href: '/education?track=small-capital',
    cta: {
      id: 'Naik ke modal kecil',
      en: 'Move into small capital',
    },
  },
  {
    slug: 'track-04',
    icon: 'store',
    title: {
      id: 'Track 04: Usaha Ringan sampai SOP',
      en: 'Track 04: Lean Business to SOP',
    },
    description: {
      id: 'Bangun paket jualan, storefront, SOP, repeat order, dan operasional yang tidak sepenuhnya bergantung pada kamu.',
      en: 'Build offer packages, storefronts, SOPs, repeat orders, and operations that do not rely fully on you.',
    },
    outcome: {
      id: 'Hasil: usaha kecil mulai punya tulang punggung.',
      en: 'Outcome: the small business starts to gain a backbone.',
    },
    href: '/education?track=business-builder',
    cta: {
      id: 'Bangun usaha',
      en: 'Build the business',
    },
  },
];

export const ZERO_CAPITAL_LADDER: CapitalLadderItem[] = [
  {
    slug: 'rp0',
    icon: 'sparkles',
    title: {
      id: 'Rp0 -> Bukti Kerja',
      en: '$0 -> Proof of Work',
    },
    description: {
      id: 'Di tahap ini yang dicari bukan logo atau branding. Yang dicari adalah testimoni, hasil kerja, dan skill yang nyata dipakai orang.',
      en: 'At this stage the goal is not logos or branding. The goal is testimonials, work samples, and skills people actually use.',
    },
    rule: {
      id: 'Aturan: validasi dulu sebelum belanja apa pun.',
      en: 'Rule: validate before buying anything.',
    },
    href: '/education?track=zero-capital',
  },
  {
    slug: 'reinvest',
    icon: 'coins',
    title: {
      id: 'Cashflow -> Modal Kerja',
      en: 'Cashflow -> Working Capital',
    },
    description: {
      id: 'Sisihkan persentase tetap untuk alat, bahan, transport, atau hal yang langsung menambah kemampuan mengeksekusi order.',
      en: 'Set aside a fixed percentage for tools, materials, transport, or anything that directly improves order execution.',
    },
    rule: {
      id: 'Aturan: reinvest hanya pada hal yang mempercepat uang kembali.',
      en: 'Rule: reinvest only in things that speed money coming back.',
    },
    href: '/payments',
  },
  {
    slug: 'catalog',
    icon: 'store',
    title: {
      id: 'Modal Kecil -> Katalog / Paket',
      en: 'Small Capital -> Catalog / Package',
    },
    description: {
      id: 'Saat sudah ada buffer, ubah jasa acak jadi paket yang jelas atau produk yang bisa dijual berulang.',
      en: 'Once you have a buffer, turn random services into clear packages or products that can sell repeatedly.',
    },
    rule: {
      id: 'Aturan: satu penawaran utama jauh lebih kuat daripada lima penawaran setengah matang.',
      en: 'Rule: one strong offer beats five half-baked offers.',
    },
    href: '/create?mode=quick',
  },
  {
    slug: 'system',
    icon: 'workflow',
    title: {
      id: 'Usaha Kecil -> Mesin Usaha',
      en: 'Small Business -> Business Machine',
    },
    description: {
      id: 'Masuk ke SOP, CRM, analytics, dan omnichannel agar usaha tidak lagi bergantung penuh pada tenaga harian.',
      en: 'Move into SOPs, CRM, analytics, and omnichannel flows so the business no longer depends fully on daily effort.',
    },
    rule: {
      id: 'Aturan: scale hanya kalau margin, kualitas, dan ritme operasional sudah sehat.',
      en: 'Rule: scale only when margin, quality, and operational rhythm are healthy.',
    },
    href: '/dashboard',
  },
];

export const ZERO_CAPITAL_DAILY_LOOP: DailyLoopItem[] = [
  {
    slug: 'morning',
    time: {
      id: 'Pagi',
      en: 'Morning',
    },
    title: {
      id: 'Buru peluang',
      en: 'Hunt opportunities',
    },
    description: {
      id: 'Cari peluang baru, follow-up lead lama, dan pilih 1-3 target yang paling mungkin cair.',
      en: 'Look for new opportunities, follow up old leads, and choose 1-3 targets most likely to close.',
    },
  },
  {
    slug: 'midday',
    time: {
      id: 'Siang',
      en: 'Midday',
    },
    title: {
      id: 'Eksekusi yang paling dekat uang',
      en: 'Execute what is closest to money',
    },
    description: {
      id: 'Dahulukan tugas yang paling cepat selesai, paling gampang diukur, dan paling mendekati pembayaran.',
      en: 'Prioritize tasks that finish fastest, are easiest to measure, and sit closest to payment.',
    },
  },
  {
    slug: 'evening',
    time: {
      id: 'Sore',
      en: 'Evening',
    },
    title: {
      id: 'Ubah hasil jadi bukti jual',
      en: 'Turn outcomes into sales proof',
    },
    description: {
      id: 'Jadikan hasil kerja jadi testimoni, portfolio, listing, atau update yang membuat peluang berikutnya lebih mudah masuk.',
      en: 'Turn work output into testimonials, portfolio, listings, or updates that make the next opportunity easier to win.',
    },
  },
  {
    slug: 'night',
    time: {
      id: 'Malam',
      en: 'Night',
    },
    title: {
      id: 'Belajar dan evaluasi margin',
      en: 'Learn and review margin',
    },
    description: {
      id: 'Belajar 15-20 menit lalu cek apa yang menghasilkan, apa yang capek tapi tipis, dan apa yang harus dibuang besok.',
      en: 'Study for 15-20 minutes then review what produced results, what was tiring but thin, and what should be cut tomorrow.',
    },
  },
];
