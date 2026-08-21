export type BlogLocale = 'id' | 'en';

export type BlogArticleSection = {
  heading: string;
  body: string[];
  bullets?: string[];
};

export type BlogArticleCopy = {
  title: string;
  description: string;
  eyebrow: string;
  category: string;
  readTime: string;
  hero: string;
  takeaways: string[];
  sections: BlogArticleSection[];
  ctaTitle: string;
  ctaDescription: string;
  ctaLabel: string;
  ctaHref: string;
};

export type BlogContentKind = 'editorial' | 'programmatic';

export type BlogSource = {
  label: string;
  url: string;
  publisher?: string;
  accessedAt?: string;
};

export type BlogSeoConfig = {
  indexable: boolean;
  qualityScore: number;
  primaryKeyword: string;
  searchIntent: 'informational' | 'commercial' | 'transactional' | 'local';
  canonicalSlug?: string;
};

export type BlogMarketContext = {
  city?: string;
  province?: string;
  topicKey?: string;
  topicLabel?: string;
  nearbyAreas?: string[];
  dataRequirements?: string[];
};

export type BlogArticle = {
  slug: string;
  publishedAt: string;
  updatedAt: string;
  image: string;
  keywords: string[];
  copy: Record<BlogLocale, BlogArticleCopy>;
  contentKind?: BlogContentKind;
  cluster?: string;
  seo?: BlogSeoConfig;
  market?: BlogMarketContext;
  sources?: BlogSource[];
};

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.lajukan.com'
).replace(/\/+$/, '');
const DEFAULT_BLOG_IMAGE = `${SITE_URL}/opengraph-image.png`;

const CORE_BLOG_ARTICLES: BlogArticle[] = [
  {
    slug: 'cara-mencari-supplier-lokal-untuk-umkm',
    publishedAt: '2026-06-11',
    updatedAt: '2026-06-11',
    image: DEFAULT_BLOG_IMAGE,
    keywords: [
      'supplier lokal',
      'supplier indonesia',
      'bahan baku umkm',
      'distributor indonesia',
      'sourcing umkm',
    ],
    copy: {
      id: {
        title: 'Cara mencari supplier lokal untuk UMKM tanpa buang waktu',
        description:
          'Panduan praktis mencari supplier lokal, membandingkan stok, mengecek kepercayaan, dan lanjut chat agar UMKM bisa belanja lebih aman.',
        eyebrow: 'Panduan supplier',
        category: 'Sourcing',
        readTime: '5 menit baca',
        hero: 'Supplier yang tepat biasanya bukan cuma yang paling murah. UMKM butuh stok jelas, respon cepat, lokasi masuk akal, dan bukti bahwa penjual bisa dipercaya.',
        takeaways: [
          'Mulai dari kebutuhan, bukan dari nama toko.',
          'Bandingkan harga, lokasi, minimal order, dan kecepatan respon.',
          'Simpan bukti chat dan transaksi agar pembelian berikutnya lebih rapi.',
        ],
        sections: [
          {
            heading: 'Mulai dari kebutuhan yang spesifik',
            body: [
              'Tuliskan produk, jumlah, kota tujuan, budget, dan waktu butuh. Query seperti "supplier kemasan makanan Bandung 500 pcs" biasanya lebih kuat daripada hanya "supplier kemasan".',
              'Di Lajukan, pencarian bisa diarahkan ke supplier, jasa, lokasi, dan kategori. Ini membantu calon pembeli menemukan penjual yang lebih dekat dengan kebutuhan nyata.',
            ],
          },
          {
            heading: 'Cek sinyal kepercayaan sebelum chat panjang',
            body: [
              'Lihat profil, lokasi, foto, deskripsi, dan riwayat listing. Jika ada data usaha yang lengkap, pembeli bisa menilai lebih cepat sebelum bertanya.',
              'Untuk supplier baru, mulai dari order kecil atau tanya sampel. Hindari transfer di luar platform kalau belum yakin dengan identitas penjual.',
            ],
            bullets: [
              'Nama usaha dan kontak jelas.',
              'Alamat atau area layanan masuk akal.',
              'Deskripsi produk tidak terlalu umum.',
              'Respon chat menjawab detail, bukan hanya copy paste.',
            ],
          },
          {
            heading: 'Bangun daftar supplier cadangan',
            body: [
              'UMKM yang sehat sebaiknya punya lebih dari satu sumber barang. Harga bisa berubah, stok bisa kosong, dan pengiriman bisa terlambat.',
              'Simpan supplier utama, supplier cadangan, dan catatan kualitas. Lama-lama proses belanja jadi lebih cepat karena data lama tidak hilang.',
            ],
          },
        ],
        ctaTitle: 'Cari supplier lokal sekarang',
        ctaDescription:
          'Buka pencarian Lajukan, masukkan kebutuhan, lalu bandingkan supplier dari lokasi dan kategori yang relevan.',
        ctaLabel: 'Cari supplier',
        ctaHref: '/explore?type=product&side=supply&q=supplier',
      },
      en: {
        title: 'How Indonesian SMEs can find local suppliers faster',
        description:
          'A practical guide to finding local suppliers, comparing stock, checking trust signals, and moving into chat with less friction.',
        eyebrow: 'Supplier guide',
        category: 'Sourcing',
        readTime: '5 min read',
        hero: 'The best supplier is not always the cheapest one. SMEs need clear stock, fast replies, reasonable location, and enough proof to trust the seller.',
        takeaways: [
          'Start from the exact need, not the store name.',
          'Compare price, location, minimum order, and response quality.',
          'Keep chat and transaction evidence for easier repeat buying.',
        ],
        sections: [
          {
            heading: 'Start with a specific need',
            body: [
              'Write the item, quantity, destination city, budget, and deadline. A query like "food packaging supplier Bandung 500 pcs" is stronger than just "packaging supplier".',
              'On Lajukan, search can be directed by supplier, service, location, and category so buyers can find sellers closer to the real need.',
            ],
          },
          {
            heading: 'Check trust signals before a long chat',
            body: [
              'Look at the profile, location, photos, description, and listing history. Complete business data helps buyers decide faster.',
              'For a new supplier, start with a small order or ask for samples. Avoid off-platform transfers if the seller identity is still unclear.',
            ],
            bullets: [
              'Clear business name and contact.',
              'Reasonable address or service area.',
              'Product descriptions that are not too generic.',
              'Chat replies that answer details, not just templates.',
            ],
          },
          {
            heading: 'Build a backup supplier list',
            body: [
              'Healthy SMEs should avoid relying on one source. Prices can move, stock can run out, and deliveries can be delayed.',
              'Save primary suppliers, backups, and quality notes. Over time, buying gets faster because previous knowledge stays organized.',
            ],
          },
        ],
        ctaTitle: 'Find local suppliers now',
        ctaDescription:
          'Open Lajukan search, enter your need, and compare suppliers by location and category.',
        ctaLabel: 'Search suppliers',
        ctaHref: '/explore?type=product&side=supply&q=supplier',
      },
    },
  },
  {
    slug: 'umkm-naik-kelas-dengan-profil-digital',
    publishedAt: '2026-06-11',
    updatedAt: '2026-06-11',
    image: DEFAULT_BLOG_IMAGE,
    keywords: [
      'profil digital umkm',
      'usaha online',
      'promosi umkm',
      'marketplace umkm',
      'toko online indonesia',
    ],
    copy: {
      id: {
        title: 'UMKM naik kelas dimulai dari profil digital yang jelas',
        description:
          'Profil digital membantu calon pelanggan memahami usaha, produk, lokasi, dan cara chat tanpa harus tanya dari nol.',
        eyebrow: 'Profil usaha',
        category: 'UMKM',
        readTime: '4 menit baca',
        hero: 'Banyak pembeli batal chat bukan karena tidak tertarik, tapi karena info dasar usaha tidak terlihat. Profil yang jelas mengurangi ragu dan mempercepat keputusan.',
        takeaways: [
          'Nama, kategori, lokasi, dan foto adalah info inti.',
          'Deskripsi pendek lebih baik daripada teks panjang yang membingungkan.',
          'Profil digital harus langsung mengarah ke chat atau rute.',
        ],
        sections: [
          {
            heading: 'Tampilkan jawaban sebelum ditanya',
            body: [
              'Calon pembeli biasanya ingin tahu usaha menjual apa, lokasinya di mana, bisa online atau datang langsung, dan bagaimana cara menghubungi.',
              'Kalau empat hal itu jelas, percakapan bisa langsung masuk ke stok, harga, dan jadwal.',
            ],
          },
          {
            heading: 'Gunakan visual yang membantu keputusan',
            body: [
              'Foto profil, sampul, katalog, dan lokasi bukan sekadar dekorasi. Visual membantu pembeli merasa bahwa usaha benar-benar aktif.',
              'Untuk tahap awal, satu foto produk yang terang dan satu deskripsi pendek sering lebih berguna daripada banyak panel statistik.',
            ],
          },
          {
            heading: 'Buat CTA yang sederhana',
            body: [
              'Jangan membuat pembeli menebak langkah berikutnya. Berikan tombol chat, rute, katalog, atau lihat profil publik.',
              'Semakin sedikit pilihan yang membingungkan, semakin besar peluang orang lanjut berinteraksi.',
            ],
          },
        ],
        ctaTitle: 'Rapikan profil usaha',
        ctaDescription:
          'Buat atau pilih usaha di Lajukan, lengkapi info inti, lalu publikasikan agar mudah ditemukan.',
        ctaLabel: 'Buka usaha',
        ctaHref: '/usaha',
      },
      en: {
        title: 'A better digital profile helps Indonesian SMEs grow',
        description:
          'A clear digital profile helps customers understand your business, products, location, and chat options without starting from zero.',
        eyebrow: 'Business profile',
        category: 'SME',
        readTime: '4 min read',
        hero: 'Many buyers do not cancel because they are uninterested. They stop because basic business information is missing. A clear profile reduces doubt.',
        takeaways: [
          'Name, category, location, and photos are the core signals.',
          'Short descriptions beat long confusing text.',
          'A digital profile should lead directly to chat or directions.',
        ],
        sections: [
          {
            heading: 'Answer questions before buyers ask',
            body: [
              'Buyers usually want to know what you sell, where you are, whether online order is available, and how to contact you.',
              'When those four points are clear, the conversation can move straight to stock, price, and timing.',
            ],
          },
          {
            heading: 'Use visuals that support decisions',
            body: [
              'Profile photos, covers, catalog images, and location are not just decoration. They show that the business is active.',
              'At the early stage, one clear product photo and a short description often beat many dashboard panels.',
            ],
          },
          {
            heading: 'Keep the CTA simple',
            body: [
              'Do not make buyers guess the next step. Provide chat, route, catalog, or public profile actions.',
              'The fewer confusing choices, the more likely people continue interacting.',
            ],
          },
        ],
        ctaTitle: 'Improve your business profile',
        ctaDescription:
          'Create or select a business on Lajukan, complete the core data, and publish it so people can find you.',
        ctaLabel: 'Open business hub',
        ctaHref: '/usaha',
      },
    },
  },
  {
    slug: 'ai-untuk-umkm-indonesia-yang-aman-dan-berguna',
    publishedAt: '2026-06-11',
    updatedAt: '2026-06-11',
    image: DEFAULT_BLOG_IMAGE,
    keywords: [
      'ai untuk umkm',
      'ai bisnis indonesia',
      'asisten ai usaha',
      'konten ai umkm',
      'otomatisasi bisnis kecil',
    ],
    copy: {
      id: {
        title: 'AI untuk UMKM Indonesia: pakai untuk bantu kerja, bukan spam',
        description:
          'Cara memakai AI untuk deskripsi produk, ide promosi, balasan chat, dan ringkasan usaha tanpa membuat konten asal banyak.',
        eyebrow: 'AI praktis',
        category: 'AI',
        readTime: '6 menit baca',
        hero: 'AI bisa mempercepat kerja UMKM, tapi hasilnya tetap harus dicek manusia. Konten yang membantu pelanggan lebih penting daripada konten yang hanya banyak.',
        takeaways: [
          'AI bagus untuk draft, ringkasan, ide, dan struktur.',
          'Pemilik usaha tetap harus mengecek fakta, harga, stok, dan klaim.',
          'Konten AI harus unik, relevan, dan menjawab kebutuhan pembeli.',
        ],
        sections: [
          {
            heading: 'Gunakan AI untuk pekerjaan yang berulang',
            body: [
              'AI cocok untuk membuat draft deskripsi produk, variasi caption promosi, ringkasan chat, dan checklist operasional.',
              'Hal ini menghemat waktu, terutama untuk owner yang mengurus stok, pelanggan, dan promosi sendiri.',
            ],
          },
          {
            heading: 'Jangan jadikan AI mesin spam SEO',
            body: [
              'Konten banyak tidak otomatis bagus. Jika semua artikel terasa umum, tidak akurat, atau hanya mengejar ranking, pembaca akan cepat pergi.',
              'Lebih baik membuat sedikit konten yang benar-benar menjawab masalah lokal: harga bahan, lokasi supplier, cara cek kualitas, dan langkah praktis.',
            ],
            bullets: [
              'Tambahkan pengalaman nyata dari owner.',
              'Cek data harga, stok, alamat, dan regulasi.',
              'Hindari klaim berlebihan yang tidak bisa dibuktikan.',
              'Update artikel saat informasi berubah.',
            ],
          },
          {
            heading: 'Buat AI membantu transaksi',
            body: [
              'Di marketplace, AI paling berguna saat membantu pembeli memahami listing, merapikan kebutuhan, dan memberi saran pertanyaan untuk chat.',
              'Tujuannya bukan menggantikan manusia, tapi membuat percakapan bisnis lebih cepat dan jelas.',
            ],
          },
        ],
        ctaTitle: 'Coba alur usaha yang lebih rapi',
        ctaDescription:
          'Gunakan Lajukan untuk membuat profil, katalog, dan promosi usaha dengan alur yang lebih sederhana.',
        ctaLabel: 'Mulai dari usaha',
        ctaHref: '/usaha',
      },
      en: {
        title: 'AI for Indonesian SMEs: useful assistance, not spam',
        description:
          'How to use AI for product descriptions, promotion ideas, chat replies, and business summaries without producing low-quality bulk content.',
        eyebrow: 'Practical AI',
        category: 'AI',
        readTime: '6 min read',
        hero: 'AI can speed up SME work, but humans still need to check the result. Helpful content matters more than simply producing more content.',
        takeaways: [
          'AI is useful for drafts, summaries, ideas, and structure.',
          'Business owners must still verify facts, prices, stock, and claims.',
          'AI-assisted content should be unique, relevant, and useful.',
        ],
        sections: [
          {
            heading: 'Use AI for repetitive work',
            body: [
              'AI is useful for product description drafts, promotion captions, chat summaries, and operational checklists.',
              'This saves time for owners who handle stock, customers, and promotion by themselves.',
            ],
          },
          {
            heading: 'Do not turn AI into an SEO spam machine',
            body: [
              'More content is not automatically better. If every article feels generic, inaccurate, or ranking-first, readers leave quickly.',
              'It is better to publish fewer pieces that solve local problems: material prices, supplier locations, quality checks, and practical steps.',
            ],
            bullets: [
              'Add real owner experience.',
              'Verify price, stock, address, and regulation data.',
              'Avoid claims that cannot be proven.',
              'Update articles when information changes.',
            ],
          },
          {
            heading: 'Let AI support transactions',
            body: [
              'In a marketplace, AI is strongest when it helps buyers understand listings, clarify needs, and prepare better chat questions.',
              'The goal is not to replace people, but to make business conversations faster and clearer.',
            ],
          },
        ],
        ctaTitle: 'Try a cleaner business flow',
        ctaDescription:
          'Use Lajukan to create profiles, catalogs, and promotion flows with fewer confusing steps.',
        ctaLabel: 'Start with business hub',
        ctaHref: '/usaha',
      },
    },
  },
  {
    slug: 'local-seo-untuk-usaha-yang-punya-lokasi',
    publishedAt: '2026-06-11',
    updatedAt: '2026-06-11',
    image: DEFAULT_BLOG_IMAGE,
    keywords: [
      'local seo umkm',
      'peta usaha',
      'usaha sekitar',
      'google maps usaha',
      'profil usaha lokal',
    ],
    copy: {
      id: {
        title: 'Local SEO untuk usaha yang punya lokasi fisik',
        description:
          'Panduan sederhana agar usaha lokal lebih mudah ditemukan lewat nama, kategori, alamat, peta, dan halaman profil yang bisa dibagikan.',
        eyebrow: 'Local SEO',
        category: 'Peta usaha',
        readTime: '5 menit baca',
        hero: 'Untuk usaha lokal, pencarian sering dimulai dari lokasi: dekat sini, kota tertentu, atau kategori tertentu. Data lokasi yang rapi membantu pembeli mengambil keputusan.',
        takeaways: [
          'Gunakan nama usaha yang konsisten di semua tempat.',
          'Alamat, area layanan, jam buka, dan nomor chat harus jelas.',
          'Halaman profil yang bisa dibagikan membantu pencarian dan promosi.',
        ],
        sections: [
          {
            heading: 'Pastikan data inti konsisten',
            body: [
              'Nama usaha, alamat, nomor, kategori, dan jam layanan sebaiknya sama di profil, peta, sosial media, dan marketplace.',
              'Ketidakkonsistenan kecil bisa membuat calon pembeli ragu, terutama jika ada cabang atau nama usaha yang mirip.',
            ],
          },
          {
            heading: 'Buat halaman profil yang punya URL jelas',
            body: [
              'URL yang bisa dibagikan membantu pembeli kembali ke profil usaha tanpa harus mencari ulang.',
              'Untuk listing dan usaha yang namanya sama, identifier unik tetap penting agar halaman tidak tabrakan.',
            ],
          },
          {
            heading: 'Peta harus mendukung aksi, bukan sekadar pin',
            body: [
              'Pin peta bagus, tapi pembeli tetap butuh aksi berikutnya: chat, rute, lihat katalog, atau buka profil.',
              'Di Lajukan, halaman UMKM dan peta usaha harus saling tersambung agar orang bisa menemukan usaha lalu langsung menghubungi.',
            ],
          },
        ],
        ctaTitle: 'Lihat usaha sekitar',
        ctaDescription:
          'Cari usaha dari peta, buka profil, lalu lanjut chat atau rute tanpa harus menebak.',
        ctaLabel: 'Buka peta UMKM',
        ctaHref: '/umkm',
      },
      en: {
        title: 'Local SEO for businesses with a physical location',
        description:
          'A simple guide to help local businesses get discovered through names, categories, addresses, maps, and shareable profile pages.',
        eyebrow: 'Local SEO',
        category: 'Business map',
        readTime: '5 min read',
        hero: 'For local businesses, search often starts from location: nearby, a specific city, or a category. Clean location data helps buyers decide.',
        takeaways: [
          'Use a consistent business name everywhere.',
          'Address, service area, opening hours, and chat number should be clear.',
          'A shareable profile page supports discovery and promotion.',
        ],
        sections: [
          {
            heading: 'Keep core data consistent',
            body: [
              'Business name, address, phone, category, and service hours should match across profiles, maps, social media, and marketplaces.',
              'Small inconsistencies can create doubt, especially when branches or similar business names exist.',
            ],
          },
          {
            heading: 'Use a profile page with a clear URL',
            body: [
              'A shareable URL helps buyers return to a business profile without searching again.',
              'For listings and businesses with similar names, a unique identifier still matters to avoid collisions.',
            ],
          },
          {
            heading: 'Maps should support action, not just pins',
            body: [
              'Map pins are useful, but buyers still need the next step: chat, route, catalog, or profile.',
              'On Lajukan, UMKM pages and business maps should connect so people can discover a business and contact it immediately.',
            ],
          },
        ],
        ctaTitle: 'Explore nearby businesses',
        ctaDescription:
          'Find businesses from the map, open the profile, then continue to chat or route.',
        ctaLabel: 'Open UMKM map',
        ctaHref: '/umkm',
      },
    },
  },
  {
    slug: 'substitusi-impor-dan-peluang-supplier-indonesia',
    publishedAt: '2026-06-11',
    updatedAt: '2026-06-11',
    image: DEFAULT_BLOG_IMAGE,
    keywords: [
      'substitusi impor',
      'supplier lokal indonesia',
      'produk lokal',
      'bahan baku indonesia',
      'pasokan lokal',
    ],
    copy: {
      id: {
        title: 'Substitusi impor: peluang supplier lokal Indonesia',
        description:
          'Bagaimana pembeli usaha bisa mulai mencari alternatif lokal untuk bahan baku, komponen, jasa produksi, dan produk siap jual.',
        eyebrow: 'Pasokan lokal',
        category: 'Supply chain',
        readTime: '6 menit baca',
        hero: 'Substitusi impor bukan berarti semua barang harus langsung diganti. Mulainya dari menemukan bagian yang bisa dipasok lebih dekat, lebih cepat, atau lebih mudah dikontrol.',
        takeaways: [
          'Mulai dari komponen yang paling sering dibeli.',
          'Bandingkan total biaya, bukan hanya harga unit.',
          'Supplier lokal perlu profil dan katalog yang mudah dipercaya.',
        ],
        sections: [
          {
            heading: 'Cari komponen yang paling realistis diganti',
            body: [
              'Tidak semua bahan bisa langsung diganti dengan pasokan lokal. Pilih yang volumenya rutin, spesifikasinya jelas, dan risiko kualitasnya bisa diuji.',
              'Contohnya kemasan, bahan pendukung, jasa finishing, alat bantu produksi, atau produk pelengkap.',
            ],
          },
          {
            heading: 'Hitung total biaya pasokan',
            body: [
              'Harga unit yang murah bisa kalah oleh ongkos kirim, waktu tunggu, retur, dan risiko stok kosong.',
              'Supplier lokal bisa menang jika komunikasi lebih cepat, pengiriman lebih dekat, dan perbaikan masalah lebih mudah.',
            ],
          },
          {
            heading: 'Bantu supplier lokal terlihat profesional',
            body: [
              'Supplier lokal perlu data yang jelas: katalog, kapasitas, lokasi, minimal order, foto, dan cara chat.',
              'Jika data itu mudah ditemukan, pembeli B2B lebih cepat membandingkan dan mengambil keputusan.',
            ],
          },
        ],
        ctaTitle: 'Temukan alternatif lokal',
        ctaDescription:
          'Gunakan Lajukan untuk mencari supplier, jasa produksi, dan produk lokal yang relevan dengan kebutuhan usaha.',
        ctaLabel: 'Cari pasokan lokal',
        ctaHref: '/explore?q=supplier%20lokal',
      },
      en: {
        title: 'Import substitution: opportunities for Indonesian suppliers',
        description:
          'How business buyers can start finding local alternatives for materials, components, production services, and ready-to-sell products.',
        eyebrow: 'Local supply',
        category: 'Supply chain',
        readTime: '6 min read',
        hero: 'Import substitution does not mean every item must be replaced immediately. Start with parts that can be sourced closer, faster, or with better control.',
        takeaways: [
          'Start from components purchased repeatedly.',
          'Compare total cost, not just unit price.',
          'Local suppliers need profiles and catalogs that are easy to trust.',
        ],
        sections: [
          {
            heading: 'Find components that are realistic to replace',
            body: [
              'Not every material can be replaced with local supply immediately. Choose recurring items with clear specifications and testable quality risk.',
              'Examples include packaging, supporting materials, finishing services, production tools, or complementary products.',
            ],
          },
          {
            heading: 'Calculate total supply cost',
            body: [
              'Cheap unit prices can lose to shipping, waiting time, returns, and stock-out risk.',
              'Local suppliers can win when communication is faster, delivery is closer, and problem-solving is easier.',
            ],
          },
          {
            heading: 'Help local suppliers look professional',
            body: [
              'Local suppliers need clear data: catalog, capacity, location, minimum order, photos, and chat options.',
              'When that data is easy to find, B2B buyers can compare and decide faster.',
            ],
          },
        ],
        ctaTitle: 'Find local alternatives',
        ctaDescription:
          'Use Lajukan to search suppliers, production services, and local products that match your business needs.',
        ctaLabel: 'Search local supply',
        ctaHref: '/explore?q=local%20supplier',
      },
    },
  },
];

const OFFICIAL_SOURCES = {
  bpsEcommerce2024: {
    label: 'Statistik E-Commerce 2024',
    publisher: 'Badan Pusat Statistik',
    url: 'https://www.bps.go.id/id/publication/2025/11/28/647323224ecc656c2933571b/statistik-e-commerce-2024.html',
    accessedAt: '2026-08-19',
  },
  indonesiaDigitalUmkm: {
    label: 'Komitmen Pemerintah Memperkuat UMKM',
    publisher: 'Kementerian Koordinator Bidang Perekonomian Republik Indonesia',
    url: 'https://ekon.go.id/publikasi/detail/6782/komitmen-pemerintah-memperkuat-umkm-sebagai-motor-pemerataan-dan-pemberdayaan-ekonomi-masyarakat',
    accessedAt: '2026-08-19',
  },
  googleHelpfulContent: {
    label: 'Creating helpful, reliable, people-first content',
    publisher: 'Google Search Central',
    url: 'https://developers.google.com/search/docs/fundamentals/creating-helpful-content',
    accessedAt: '2026-08-19',
  },
  googleArticleSchema: {
    label: 'Article structured data',
    publisher: 'Google Search Central',
    url: 'https://developers.google.com/search/docs/appearance/structured-data/article',
    accessedAt: '2026-08-19',
  },
} satisfies Record<string, BlogSource>;

type ProgrammaticCity = {
  key: string;
  name: string;
  province: string;
  nearbyAreas: string[];
  logisticsNote: string;
};

type ProgrammaticTopic = {
  key: string;
  labelId: string;
  labelEn: string;
  query: string;
  cluster: string;
  buyerQuestionsId: string[];
  buyerQuestionsEn: string[];
  redFlagsId: string[];
  redFlagsEn: string[];
};

type ProgrammaticIntent = {
  key: 'supplier' | 'checklist';
  labelId: string;
  labelEn: string;
};

/**
 * 25 kota x 10 topik x 2 intent = 500 records.
 *
 * Penting: record programmatic default `noindex`. Tujuannya membangun content
 * inventory tanpa membuat 500 halaman tipis terindeks sekaligus. Aktifkan index
 * per slug setelah halaman diperkaya data marketplace nyata (jumlah penyedia,
 * kebutuhan aktif, rentang MOQ/harga yang benar-benar tersedia, respons, dsb.).
 */
export const PROGRAMMATIC_CITIES: ProgrammaticCity[] = [
  { key: 'bandung', name: 'Bandung', province: 'Jawa Barat', nearbyAreas: ['Cimahi', 'Kabupaten Bandung', 'Sumedang'], logisticsNote: 'Bandung terhubung dengan kawasan produksi dan perdagangan Jawa Barat, sehingga radius pencarian sebaiknya tidak berhenti di batas kota.' },
  { key: 'jakarta', name: 'Jakarta', province: 'DKI Jakarta', nearbyAreas: ['Tangerang', 'Bekasi', 'Depok'], logisticsNote: 'Jakarta punya kepadatan pemasok tinggi, tetapi ongkir, waktu tempuh, dan batas pengiriman antarkawasan perlu dibandingkan.' },
  { key: 'bekasi', name: 'Bekasi', province: 'Jawa Barat', nearbyAreas: ['Jakarta Timur', 'Karawang', 'Depok'], logisticsNote: 'Bekasi dekat dengan kawasan industri dan akses logistik Jabodetabek, sehingga pencarian lintas kota sering masuk akal.' },
  { key: 'depok', name: 'Depok', province: 'Jawa Barat', nearbyAreas: ['Jakarta Selatan', 'Bogor', 'Bekasi'], logisticsNote: 'Depok berada di koridor Jabodetabek; bandingkan pemasok lokal dengan opsi Jakarta dan Bogor berdasarkan total biaya.' },
  { key: 'tangerang', name: 'Tangerang', province: 'Banten', nearbyAreas: ['Tangerang Selatan', 'Jakarta Barat', 'Serang'], logisticsNote: 'Tangerang memiliki banyak kawasan industri dan pergudangan, sehingga radius sourcing dapat diperluas ke Tangerang Selatan dan Jakarta Barat.' },
  { key: 'bogor', name: 'Bogor', province: 'Jawa Barat', nearbyAreas: ['Depok', 'Sukabumi', 'Jakarta Selatan'], logisticsNote: 'Bogor memiliki pasar usaha yang tersebar; cek area layanan supplier karena jarak antarkecamatan dapat memengaruhi biaya kirim.' },
  { key: 'surabaya', name: 'Surabaya', province: 'Jawa Timur', nearbyAreas: ['Sidoarjo', 'Gresik', 'Mojokerto'], logisticsNote: 'Surabaya adalah hub perdagangan Jawa Timur; pemasok dari Sidoarjo dan Gresik sering relevan untuk pembeli Surabaya.' },
  { key: 'sidoarjo', name: 'Sidoarjo', province: 'Jawa Timur', nearbyAreas: ['Surabaya', 'Gresik', 'Mojokerto'], logisticsNote: 'Sidoarjo dekat kawasan industri dan Surabaya, sehingga bandingkan supplier di dua wilayah sebelum memilih.' },
  { key: 'semarang', name: 'Semarang', province: 'Jawa Tengah', nearbyAreas: ['Demak', 'Kendal', 'Ungaran'], logisticsNote: 'Semarang menjadi simpul logistik Jawa Tengah; supplier dari Demak, Kendal, dan Ungaran dapat menjadi alternatif.' },
  { key: 'solo', name: 'Solo', province: 'Jawa Tengah', nearbyAreas: ['Sukoharjo', 'Karanganyar', 'Klaten'], logisticsNote: 'Solo terhubung erat dengan sentra produksi di Sukoharjo, Karanganyar, dan Klaten, sehingga pencarian regional sering lebih efektif.' },
  { key: 'yogyakarta', name: 'Yogyakarta', province: 'DI Yogyakarta', nearbyAreas: ['Sleman', 'Bantul', 'Klaten'], logisticsNote: 'Banyak penyedia melayani Kota Yogyakarta dari Sleman dan Bantul; cek area layanan, bukan hanya alamat usaha.' },
  { key: 'malang', name: 'Malang', province: 'Jawa Timur', nearbyAreas: ['Batu', 'Kabupaten Malang', 'Pasuruan'], logisticsNote: 'Malang memiliki ekosistem F&B, kreatif, dan produksi lokal; perluas pencarian ke Kabupaten Malang dan Batu bila stok terbatas.' },
  { key: 'medan', name: 'Medan', province: 'Sumatera Utara', nearbyAreas: ['Deli Serdang', 'Binjai', 'Tebing Tinggi'], logisticsNote: 'Medan menjadi pusat distribusi Sumatera Utara; cek cakupan pengiriman dan lead time dari Deli Serdang atau Binjai.' },
  { key: 'makassar', name: 'Makassar', province: 'Sulawesi Selatan', nearbyAreas: ['Gowa', 'Maros', 'Takalar'], logisticsNote: 'Makassar adalah hub Indonesia Timur; biaya logistik dan ketersediaan stok lokal penting untuk dibandingkan.' },
  { key: 'denpasar', name: 'Denpasar', province: 'Bali', nearbyAreas: ['Badung', 'Gianyar', 'Tabanan'], logisticsNote: 'Untuk Denpasar, pemasok dari Badung dan Gianyar sering relevan; cek jadwal kirim karena kepadatan lalu lintas dapat memengaruhi lead time.' },
  { key: 'palembang', name: 'Palembang', province: 'Sumatera Selatan', nearbyAreas: ['Banyuasin', 'Ogan Ilir', 'Prabumulih'], logisticsNote: 'Palembang menjadi pusat distribusi Sumatera Selatan; pertimbangkan supplier regional bila produk tidak tersedia di kota.' },
  { key: 'pekanbaru', name: 'Pekanbaru', province: 'Riau', nearbyAreas: ['Kampar', 'Siak', 'Dumai'], logisticsNote: 'Pekanbaru melayani pasar Riau yang luas; biaya antarwilayah dan minimum order perlu dihitung sejak awal.' },
  { key: 'batam', name: 'Batam', province: 'Kepulauan Riau', nearbyAreas: ['Bintan', 'Tanjung Pinang', 'Karimun'], logisticsNote: 'Batam memiliki karakter logistik kepulauan dan kawasan industri; pastikan pemasok menjelaskan metode pengiriman dan lead time.' },
  { key: 'bandar-lampung', name: 'Bandar Lampung', province: 'Lampung', nearbyAreas: ['Pesawaran', 'Lampung Selatan', 'Metro'], logisticsNote: 'Bandar Lampung menjadi pintu distribusi penting di Sumatera bagian selatan; pemasok lintas kabupaten dapat kompetitif.' },
  { key: 'cirebon', name: 'Cirebon', province: 'Jawa Barat', nearbyAreas: ['Majalengka', 'Kuningan', 'Indramayu'], logisticsNote: 'Cirebon berada di jalur perdagangan Pantura; supplier dari kabupaten sekitar sering dapat melayani dengan waktu kirim singkat.' },
  { key: 'tasikmalaya', name: 'Tasikmalaya', province: 'Jawa Barat', nearbyAreas: ['Ciamis', 'Garut', 'Banjar'], logisticsNote: 'Tasikmalaya memiliki banyak usaha produksi dan perdagangan regional; cek pemasok di Ciamis dan Garut sebagai cadangan.' },
  { key: 'garut', name: 'Garut', province: 'Jawa Barat', nearbyAreas: ['Bandung', 'Tasikmalaya', 'Sumedang'], logisticsNote: 'Untuk kebutuhan yang tidak tersedia lokal, Bandung dan Tasikmalaya dapat menjadi radius sourcing tambahan.' },
  { key: 'cimahi', name: 'Cimahi', province: 'Jawa Barat', nearbyAreas: ['Bandung', 'Kabupaten Bandung', 'Bandung Barat'], logisticsNote: 'Cimahi menyatu dengan kawasan Bandung Raya, sehingga pencarian supplier sebaiknya memanfaatkan seluruh area metropolitan.' },
  { key: 'karawang', name: 'Karawang', province: 'Jawa Barat', nearbyAreas: ['Bekasi', 'Purwakarta', 'Subang'], logisticsNote: 'Karawang memiliki konsentrasi industri tinggi; bedakan pemasok untuk kebutuhan pabrik, usaha kecil, dan perdagangan umum.' },
  { key: 'purwakarta', name: 'Purwakarta', province: 'Jawa Barat', nearbyAreas: ['Karawang', 'Subang', 'Bandung Barat'], logisticsNote: 'Purwakarta berada di koridor industri Jawa Barat; supplier dari Karawang atau Subang dapat menjadi pembanding.' },
];

export const PROGRAMMATIC_TOPICS: ProgrammaticTopic[] = [
  {
    key: 'kemasan-usaha',
    labelId: 'kemasan usaha',
    labelEn: 'business packaging',
    query: 'supplier kemasan usaha',
    cluster: 'Bahan & Supplier',
    buyerQuestionsId: ['Berapa MOQ per ukuran atau desain?', 'Apakah tersedia sampel sebelum order besar?', 'Berapa lead time produksi dan pengiriman?', 'Apakah harga sudah termasuk cetak atau finishing?'],
    buyerQuestionsEn: ['What is the MOQ for each size or design?', 'Are samples available before a larger order?', 'What are production and delivery lead times?', 'Does the quote include printing or finishing?'],
    redFlagsId: ['Spesifikasi bahan tidak jelas.', 'Harga jauh di bawah pasar tanpa penjelasan.', 'Tidak bersedia memberi detail ukuran atau ketebalan.', 'Meminta pembayaran penuh sebelum identitas usaha jelas.'],
    redFlagsEn: ['Material specification is unclear.', 'Price is unusually low without explanation.', 'Seller avoids size or thickness details.', 'Full payment is requested before business identity is clear.'],
  },
  {
    key: 'bahan-baku-produksi',
    labelId: 'bahan baku produksi',
    labelEn: 'production raw materials',
    query: 'supplier bahan baku produksi',
    cluster: 'Bahan & Supplier',
    buyerQuestionsId: ['Apa grade atau spesifikasi bahan?', 'Apakah stok rutin tersedia?', 'Bagaimana kebijakan retur jika kualitas tidak sesuai?', 'Berapa minimum pembelian dan jadwal restock?'],
    buyerQuestionsEn: ['What grade or material specification is offered?', 'Is recurring stock available?', 'What is the return policy for quality issues?', 'What is the MOQ and restock schedule?'],
    redFlagsId: ['Tidak ada spesifikasi teknis.', 'Batch atau asal bahan tidak dapat dijelaskan.', 'Tidak ada prosedur komplain kualitas.', 'Stok disebut tersedia tetapi jadwal kirim tidak pasti.'],
    redFlagsEn: ['No technical specification.', 'Batch or origin cannot be explained.', 'No quality complaint process.', 'Stock is claimed available but delivery timing is vague.'],
  },
  {
    key: 'stok-grosir',
    labelId: 'stok grosir',
    labelEn: 'wholesale stock',
    query: 'supplier stok grosir',
    cluster: 'Bahan & Supplier',
    buyerQuestionsId: ['Apakah harga bertingkat berdasarkan jumlah?', 'Apakah stok yang ditawarkan benar-benar siap kirim?', 'Bagaimana kebijakan barang rusak atau kurang?', 'Apakah ada katalog SKU dan variasi yang jelas?'],
    buyerQuestionsEn: ['Are there quantity-based price tiers?', 'Is the stock actually ready to ship?', 'How are damaged or missing items handled?', 'Is there a clear SKU and variation catalog?'],
    redFlagsId: ['Katalog tidak konsisten dengan stok.', 'Tidak ada bukti jumlah barang.', 'Harga berubah setelah order.', 'Syarat retur tidak dijelaskan.'],
    redFlagsEn: ['Catalog does not match stock.', 'No evidence of inventory quantity.', 'Price changes after ordering.', 'Return terms are not explained.'],
  },
  {
    key: 'produk-jual-ulang',
    labelId: 'produk jual ulang',
    labelEn: 'resale products',
    query: 'supplier produk jual ulang',
    cluster: 'Bahan & Supplier',
    buyerQuestionsId: ['Apakah reseller boleh memakai foto katalog?', 'Ada minimum order atau paket starter?', 'Bagaimana margin dihitung setelah ongkir?', 'Apakah wilayah penjualan dibatasi?'],
    buyerQuestionsEn: ['Can resellers use catalog photos?', 'Is there an MOQ or starter package?', 'How does margin look after shipping?', 'Are sales territories restricted?'],
    redFlagsId: ['Janji margin tanpa perhitungan.', 'Tidak ada informasi produk yang konsisten.', 'Memaksa stok besar di awal.', 'Tidak jelas siapa pemilik merek atau distributor.'],
    redFlagsEn: ['Margin claims have no calculation.', 'Product information is inconsistent.', 'Large upfront stock is forced.', 'Brand or distributor ownership is unclear.'],
  },
  {
    key: 'jasa-kreatif-desain',
    labelId: 'jasa kreatif dan desain',
    labelEn: 'creative and design services',
    query: 'jasa desain usaha',
    cluster: 'Cari Jasa',
    buyerQuestionsId: ['Apa saja output yang diterima?', 'Berapa jumlah revisi?', 'Apakah file sumber termasuk?', 'Berapa estimasi pengerjaan dan milestone?'],
    buyerQuestionsEn: ['What deliverables are included?', 'How many revisions are included?', 'Are source files included?', 'What is the timeline and milestone plan?'],
    redFlagsId: ['Portfolio tidak dapat diverifikasi.', 'Scope kerja berubah-ubah.', 'Tidak ada batas revisi.', 'Hak penggunaan hasil tidak dijelaskan.'],
    redFlagsEn: ['Portfolio cannot be verified.', 'Scope keeps changing.', 'Revision limits are undefined.', 'Usage rights are not explained.'],
  },
  {
    key: 'digital-teknologi',
    labelId: 'jasa digital dan teknologi',
    labelEn: 'digital and technology services',
    query: 'jasa website aplikasi usaha',
    cluster: 'Cari Jasa',
    buyerQuestionsId: ['Apa scope fitur dan teknologi?', 'Siapa yang memegang akun, domain, dan source code?', 'Bagaimana support setelah rilis?', 'Apa milestone pembayaran dan acceptance criteria?'],
    buyerQuestionsEn: ['What is the feature and technology scope?', 'Who owns the accounts, domain, and source code?', 'What support is available after launch?', 'What are the payment milestones and acceptance criteria?'],
    redFlagsId: ['Semua dijanjikan tanpa scope tertulis.', 'Akses akun dipegang vendor sepenuhnya.', 'Tidak ada backup atau handover.', 'Tidak ada definisi selesai.'],
    redFlagsEn: ['Everything is promised without written scope.', 'Vendor exclusively controls accounts.', 'No backup or handover plan.', 'No definition of done.'],
  },
  {
    key: 'operasional-usaha',
    labelId: 'jasa operasional usaha',
    labelEn: 'business operations services',
    query: 'jasa operasional usaha',
    cluster: 'Cari Jasa',
    buyerQuestionsId: ['Apa layanan yang termasuk dan tidak termasuk?', 'Bagaimana SLA atau waktu respons?', 'Apakah ada biaya tambahan di luar paket?', 'Bagaimana proses eskalasi masalah?'],
    buyerQuestionsEn: ['What is included and excluded?', 'What service level or response time applies?', 'Are there fees outside the package?', 'How are issues escalated?'],
    redFlagsId: ['Harga paket tidak menjelaskan scope.', 'Kontak penanggung jawab tidak jelas.', 'Tidak ada SLA.', 'Biaya tambahan muncul tanpa persetujuan.'],
    redFlagsEn: ['Package price does not define scope.', 'Accountable contact is unclear.', 'No service level is defined.', 'Extra charges appear without approval.'],
  },
  {
    key: 'mesin-produksi',
    labelId: 'mesin produksi',
    labelEn: 'production machinery',
    query: 'mesin produksi usaha',
    cluster: 'Mesin & Alat',
    buyerQuestionsId: ['Berapa kapasitas per jam?', 'Apakah ada garansi dan spare part?', 'Berapa kebutuhan listrik atau bahan bakar?', 'Apakah instalasi dan training termasuk?'],
    buyerQuestionsEn: ['What is the hourly capacity?', 'Are warranty and spare parts available?', 'What power or fuel is required?', 'Are installation and training included?'],
    redFlagsId: ['Kapasitas hanya klaim tanpa spesifikasi.', 'Tidak ada informasi servis.', 'Spare part sulit diperoleh.', 'Kondisi mesin bekas tidak terdokumentasi.'],
    redFlagsEn: ['Capacity is claimed without specs.', 'Service information is missing.', 'Spare parts are difficult to source.', 'Used-machine condition is undocumented.'],
  },
  {
    key: 'peralatan-usaha',
    labelId: 'peralatan usaha',
    labelEn: 'business equipment',
    query: 'peralatan usaha',
    cluster: 'Mesin & Alat',
    buyerQuestionsId: ['Apakah ukuran dan spesifikasi cocok dengan ruang?', 'Berapa garansi?', 'Apakah tersedia servis lokal?', 'Apa saja aksesori yang termasuk?'],
    buyerQuestionsEn: ['Do size and specs fit the available space?', 'What warranty is included?', 'Is local service available?', 'Which accessories are included?'],
    redFlagsId: ['Spesifikasi produk tidak lengkap.', 'Garansi hanya lisan.', 'Tidak ada ketersediaan spare part.', 'Foto produk tidak sesuai unit yang dijual.'],
    redFlagsEn: ['Product specifications are incomplete.', 'Warranty is only verbal.', 'Spare-part availability is unclear.', 'Photos do not match the offered unit.'],
  },
  {
    key: 'peluang-reseller-distributor',
    labelId: 'peluang reseller dan distributor',
    labelEn: 'reseller and distributor opportunities',
    query: 'peluang reseller distributor',
    cluster: 'Peluang Usaha',
    buyerQuestionsId: ['Apa modal awal dan komponen biayanya?', 'Apakah ada target minimum?', 'Wilayah penjualan eksklusif atau terbuka?', 'Apa dukungan pemasaran dan supply?'],
    buyerQuestionsEn: ['What is the initial capital and cost breakdown?', 'Is there a minimum target?', 'Is the territory exclusive or open?', 'What marketing and supply support is provided?'],
    redFlagsId: ['Fokus hanya pada biaya pendaftaran.', 'Janji keuntungan pasti.', 'Produk dan supply tidak jelas.', 'Kontrak kemitraan tidak tersedia untuk dibaca.'],
    redFlagsEn: ['Focus is only on registration fees.', 'Guaranteed-profit claims.', 'Product and supply are unclear.', 'Partnership contract is not available for review.'],
  },
];

export const PROGRAMMATIC_INTENTS: ProgrammaticIntent[] = [
  { key: 'supplier', labelId: 'Panduan supplier lokal', labelEn: 'Local supplier guide' },
  { key: 'checklist', labelId: 'Checklist pembelian', labelEn: 'Buying checklist' },
];

/**
 * Slug programmatic yang sudah diperkaya dan lolos QA boleh dimasukkan di sini.
 * Jangan mengaktifkan 500 slug sekaligus tanpa data nyata.
 */
export const BLOG_INDEXABLE_PROGRAMMATIC_SLUGS = new Set<string>([]);

function slugify(value: string) {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\\u0300-\\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function buildExploreHref(query: string, city: string) {
  return `/explore?side=supply&q=${encodeURIComponent(`${query} ${city}`)}`;
}

function createProgrammaticCopy(
  city: ProgrammaticCity,
  topic: ProgrammaticTopic,
  intent: ProgrammaticIntent,
): Record<BlogLocale, BlogArticleCopy> {
  const nearbyId = city.nearbyAreas.join(', ');
  const nearbyEn = city.nearbyAreas.join(', ');
  const isSupplier = intent.key === 'supplier';

  return {
    id: {
      title: isSupplier
        ? `Cara mencari ${topic.labelId} di ${city.name} untuk usaha`
        : `Checklist memilih ${topic.labelId} di ${city.name} sebelum deal`,
      description: isSupplier
        ? `Panduan praktis mencari ${topic.labelId} di ${city.name}: spesifikasi kebutuhan, pembanding supplier, area sekitar, pertanyaan penting, dan langkah lanjut ke penawaran.`
        : `Checklist praktis membandingkan ${topic.labelId} di ${city.name}: scope, kualitas, biaya total, red flag, dan pertanyaan sebelum melakukan pemesanan.`,
      eyebrow: intent.labelId,
      category: topic.cluster,
      readTime: '7 menit baca',
      hero: isSupplier
        ? `Mencari ${topic.labelId} di ${city.name} lebih efektif jika kebutuhan dibuat spesifik sejak awal. Jangan berhenti di harga: bandingkan spesifikasi, minimum order, lead time, area layanan, dan kualitas respons.`
        : `Sebelum memilih ${topic.labelId} di ${city.name}, buat pembanding yang konsisten. Supplier atau penyedia yang terlihat murah belum tentu paling efisien setelah ongkir, revisi, risiko kualitas, dan waktu tunggu dihitung.`,
      takeaways: [
        `Tulis kebutuhan ${topic.labelId} dengan jumlah, budget, lokasi, dan target waktu.`,
        `Bandingkan pilihan di ${city.name} dengan area sekitar seperti ${nearbyId}.`,
        'Minta bukti spesifikasi, ketentuan pembayaran, dan jadwal yang dapat diperiksa.',
        'Jika belum menemukan penyedia yang cocok, pasang kebutuhan agar penyedia dapat menawarkan solusi.',
      ],
      sections: [
        {
          heading: `Mulai dari kebutuhan ${topic.labelId} yang bisa dibandingkan`,
          body: [
            `Hindari query terlalu umum. Cantumkan jenis, jumlah, ukuran atau scope, budget indikatif, lokasi ${city.name}, dan kapan barang atau jasa dibutuhkan. Data ini membuat hasil pencarian dan chat lebih relevan.`,
            `Untuk pembelian B2B, tujuan pertama bukan mendapatkan daftar terpanjang, tetapi mendapatkan beberapa kandidat yang benar-benar mampu memenuhi kebutuhan yang sama sehingga penawaran dapat dibandingkan secara adil.`,
          ],
        },
        {
          heading: `Perluas radius pencarian di sekitar ${city.name}`,
          body: [
            city.logisticsNote,
            `Pertimbangkan juga ${nearbyId}. Supplier yang sedikit lebih jauh bisa tetap lebih efisien jika stok siap, MOQ lebih cocok, atau jadwal kirim lebih pasti.`,
          ],
        },
        {
          heading: 'Pertanyaan yang sebaiknya diajukan sebelum memilih',
          body: [
            `Gunakan pertanyaan yang sama ke beberapa penyedia ${topic.labelId} agar perbandingan tidak bias. Simpan jawaban penting di chat atau catatan pembelian.`,
          ],
          bullets: topic.buyerQuestionsId,
        },
        {
          heading: 'Red flag yang perlu diperhatikan',
          body: [
            'Satu red flag tidak selalu berarti penjual bermasalah, tetapi semakin banyak informasi penting yang tidak dapat dijelaskan, semakin besar kebutuhan untuk verifikasi tambahan atau order percobaan.',
          ],
          bullets: topic.redFlagsId,
        },
        {
          heading: 'Ubah pencarian menjadi kebutuhan yang bisa ditawar',
          body: [
            `Jika pencarian ${topic.labelId} di ${city.name} belum memberikan hasil yang cocok, buat kebutuhan dengan spesifikasi yang sama lalu biarkan penyedia relevan mengirim penawaran.`,
            'Untuk Lajukan, pola ini penting karena pencarian yang kosong tidak harus menjadi jalan buntu: kebutuhan buyer dapat menjadi sinyal demand yang membantu menarik supply baru.',
          ],
        },
      ],
      ctaTitle: `Cari ${topic.labelId} di ${city.name}`,
      ctaDescription: `Buka Lajukan, bandingkan penyedia yang tersedia, atau pasang kebutuhan agar penyedia dapat menawarkan solusi yang sesuai.`,
      ctaLabel: isSupplier ? 'Cari penyedia' : 'Bandingkan pilihan',
      ctaHref: buildExploreHref(topic.query, city.name),
    },
    en: {
      title: isSupplier
        ? `How to find ${topic.labelEn} in ${city.name} for your business`
        : `Checklist for choosing ${topic.labelEn} in ${city.name}`,
      description: isSupplier
        ? `A practical guide to finding ${topic.labelEn} in ${city.name}: requirements, supplier comparison, nearby areas, key questions, and next steps.`
        : `A practical checklist for comparing ${topic.labelEn} in ${city.name}: scope, quality, total cost, red flags, and questions before ordering.`,
      eyebrow: intent.labelEn,
      category: topic.cluster,
      readTime: '7 min read',
      hero: isSupplier
        ? `Finding ${topic.labelEn} in ${city.name} works better when the requirement is specific from the start. Compare specification, minimum order, lead time, service area, and response quality instead of price alone.`
        : `Before choosing ${topic.labelEn} in ${city.name}, use a consistent comparison. The cheapest option can become expensive after shipping, revisions, quality risk, and waiting time are included.`,
      takeaways: [
        `Write the ${topic.labelEn} requirement with quantity, budget, location, and deadline.`,
        `Compare options in ${city.name} with nearby areas such as ${nearbyEn}.`,
        'Ask for verifiable specifications, payment terms, and delivery timing.',
        'If supply is limited, publish a requirement so relevant providers can respond.',
      ],
      sections: [
        {
          heading: `Start from a comparable ${topic.labelEn} requirement`,
          body: [
            `Avoid overly broad queries. Include type, quantity, size or scope, indicative budget, ${city.name} location, and required date. This makes search results and supplier conversations more relevant.`,
            'For B2B buying, the goal is not the longest list. It is a shortlist of providers capable of solving the same requirement so quotes can be compared fairly.',
          ],
        },
        {
          heading: `Expand the sourcing radius around ${city.name}`,
          body: [
            `The practical sourcing radius around ${city.name} can extend beyond the city itself. Compare total delivered cost and lead time, not only the seller address.`,
            `Also consider ${nearbyEn}. A slightly farther supplier may still be more efficient when stock is ready, MOQ fits better, or delivery timing is clearer.`,
          ],
        },
        {
          heading: 'Questions to ask before choosing',
          body: ['Ask multiple providers the same core questions so the comparison stays consistent. Keep important answers in chat or purchasing notes.'],
          bullets: topic.buyerQuestionsEn,
        },
        {
          heading: 'Red flags to watch',
          body: ['One red flag does not automatically mean a seller is unsafe, but missing critical information should trigger extra verification or a smaller trial order.'],
          bullets: topic.redFlagsEn,
        },
        {
          heading: 'Turn an empty search into a request providers can quote',
          body: [
            `If ${topic.labelEn} search in ${city.name} does not produce a useful match, publish the same requirement so relevant providers can send an offer.`,
            'For Lajukan, this keeps an empty search from becoming a dead end and turns buyer demand into a signal that can attract new supply.',
          ],
        },
      ],
      ctaTitle: `Find ${topic.labelEn} in ${city.name}`,
      ctaDescription: 'Open Lajukan to compare available providers or publish a requirement so providers can respond.',
      ctaLabel: isSupplier ? 'Find providers' : 'Compare options',
      ctaHref: buildExploreHref(topic.query, city.name),
    },
  };
}

function createProgrammaticArticles(): BlogArticle[] {
  const articles: BlogArticle[] = [];

  for (const city of PROGRAMMATIC_CITIES) {
    for (const topic of PROGRAMMATIC_TOPICS) {
      for (const intent of PROGRAMMATIC_INTENTS) {
        const slug = `${intent.key}-${topic.key}-${city.key}`;
        const indexable = BLOG_INDEXABLE_PROGRAMMATIC_SLUGS.has(slug);
        const primaryKeyword =
          intent.key === 'supplier'
            ? `${topic.query} ${city.name}`
            : `cara memilih ${topic.labelId} ${city.name}`;

        articles.push({
          slug,
          publishedAt: '2026-08-19',
          updatedAt: '2026-08-19',
          image: DEFAULT_BLOG_IMAGE,
          keywords: [
            primaryKeyword,
            `${topic.labelId} ${city.name}`,
            `${topic.labelId} ${city.province}`,
            `${topic.cluster.toLowerCase()} ${city.name}`,
            `kebutuhan usaha ${city.name}`,
          ],
          copy: createProgrammaticCopy(city, topic, intent),
          contentKind: 'programmatic',
          cluster: topic.cluster,
          seo: {
            indexable,
            qualityScore: indexable ? 88 : 72,
            primaryKeyword,
            searchIntent: 'local',
          },
          market: {
            city: city.name,
            province: city.province,
            topicKey: topic.key,
            topicLabel: topic.labelId,
            nearbyAreas: city.nearbyAreas,
            dataRequirements: [
              'Jumlah penyedia aktif untuk topik dan kota ini',
              'Jumlah kebutuhan buyer aktif atau 30 hari terakhir',
              'Contoh MOQ/rentang harga hanya jika berasal dari listing nyata',
              'Median atau distribusi response time jika datanya cukup',
              'Tanggal verifikasi data marketplace',
            ],
          },
          sources: [OFFICIAL_SOURCES.bpsEcommerce2024],
        });
      }
    }
  }

  return articles;
}

export const PROGRAMMATIC_BLOG_ARTICLES = createProgrammaticArticles();

export const BLOG_ARTICLES: BlogArticle[] = [
  ...CORE_BLOG_ARTICLES.map(article => ({
    ...article,
    contentKind: article.contentKind || 'editorial',
    seo: article.seo || {
      indexable: true,
      qualityScore: 92,
      primaryKeyword: article.keywords[0] || article.slug,
      searchIntent: 'informational',
    },
    sources:
      article.sources ||
      (article.slug.includes('ai-untuk-umkm')
        ? [OFFICIAL_SOURCES.googleHelpfulContent]
        : [OFFICIAL_SOURCES.bpsEcommerce2024]),
  })),
  ...PROGRAMMATIC_BLOG_ARTICLES,
];

export const BLOG_STATS = {
  editorial: CORE_BLOG_ARTICLES.length,
  programmatic: PROGRAMMATIC_BLOG_ARTICLES.length,
  total: CORE_BLOG_ARTICLES.length + PROGRAMMATIC_BLOG_ARTICLES.length,
  cities: PROGRAMMATIC_CITIES.length,
  topics: PROGRAMMATIC_TOPICS.length,
  intents: PROGRAMMATIC_INTENTS.length,
} as const;

function normalizeLocale(locale: string): BlogLocale {
  return locale === 'en' ? 'en' : 'id';
}

function toLocalizedArticle(article: BlogArticle, lang: BlogLocale) {
  return {
    ...article,
    localized: article.copy[lang],
  };
}

export function isBlogArticleIndexable(article: BlogArticle) {
  if (article.contentKind !== 'programmatic') return article.seo?.indexable !== false;
  return Boolean(
    article.seo?.indexable &&
      (article.seo?.qualityScore || 0) >= 80 &&
      BLOG_INDEXABLE_PROGRAMMATIC_SLUGS.has(article.slug),
  );
}

export function getBlogArticles(
  locale: string,
): Array<BlogArticle & { localized: BlogArticleCopy }> {
  const lang = normalizeLocale(locale);
  return BLOG_ARTICLES.map(article => toLocalizedArticle(article, lang));
}

export function getIndexableBlogArticles(
  locale: string,
): Array<BlogArticle & { localized: BlogArticleCopy }> {
  const lang = normalizeLocale(locale);
  return BLOG_ARTICLES.filter(isBlogArticleIndexable).map(article =>
    toLocalizedArticle(article, lang),
  );
}

export function getBlogArticlePage(
  locale: string,
  options: {
    page?: number;
    pageSize?: number;
    city?: string;
    topic?: string;
    cluster?: string;
    query?: string;
    contentKind?: BlogContentKind;
  } = {},
) {
  const lang = normalizeLocale(locale);
  const page = Math.max(1, options.page || 1);
  const pageSize = Math.min(100, Math.max(1, options.pageSize || 24));
  const query = options.query?.trim().toLowerCase();

  const filtered = BLOG_ARTICLES.filter(article => {
    if (options.contentKind && article.contentKind !== options.contentKind) return false;
    if (options.city && slugify(article.market?.city || '') !== slugify(options.city)) return false;
    if (options.topic && article.market?.topicKey !== options.topic) return false;
    if (options.cluster && article.cluster !== options.cluster) return false;
    if (!query) return true;

    const haystack = [
      article.slug,
      article.copy[lang].title,
      article.copy[lang].description,
      article.market?.city,
      article.market?.province,
      article.market?.topicLabel,
      ...article.keywords,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    return haystack.includes(query);
  }).sort((a, b) => {
    const dateCompare = b.updatedAt.localeCompare(a.updatedAt);
    if (dateCompare !== 0) return dateCompare;
    return a.copy[lang].title.localeCompare(b.copy[lang].title);
  });

  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;

  return {
    items: filtered
      .slice(start, start + pageSize)
      .map(article => toLocalizedArticle(article, lang)),
    page: safePage,
    pageSize,
    total,
    totalPages,
    hasPreviousPage: safePage > 1,
    hasNextPage: safePage < totalPages,
  };
}

export function getBlogArticle(slug: string, locale: string) {
  const article = BLOG_ARTICLES.find(item => item.slug === slug);
  if (!article) return null;
  return toLocalizedArticle(article, normalizeLocale(locale));
}

export function getRelatedBlogArticles(
  slug: string,
  locale: string,
  limit = 6,
) {
  const current = BLOG_ARTICLES.find(item => item.slug === slug);
  if (!current) return [];
  const lang = normalizeLocale(locale);

  return BLOG_ARTICLES.filter(item => item.slug !== slug)
    .map(item => {
      let score = 0;
      if (item.cluster && item.cluster === current.cluster) score += 5;
      if (item.market?.topicKey && item.market.topicKey === current.market?.topicKey) score += 6;
      if (item.market?.city && item.market.city === current.market?.city) score += 4;
      if (item.contentKind === 'editorial') score += 2;
      const sharedKeywords = item.keywords.filter(keyword =>
        current.keywords.some(currentKeyword =>
          currentKeyword.toLowerCase().includes(keyword.toLowerCase()) ||
          keyword.toLowerCase().includes(currentKeyword.toLowerCase()),
        ),
      );
      score += Math.min(3, sharedKeywords.length);
      return { item, score };
    })
    .filter(result => result.score > 0)
    .sort((a, b) => b.score - a.score || b.item.updatedAt.localeCompare(a.item.updatedAt))
    .slice(0, Math.max(1, limit))
    .map(result => toLocalizedArticle(result.item, lang));
}

export function buildBlogUrl(locale: string, slug?: string) {
  const lang = normalizeLocale(locale);
  return `${SITE_URL}/${lang}/blog${slug ? `/${slug}` : ''}`;
}

export function buildBlogPath(slug?: string) {
  return `/blog${slug ? `/${slug}` : ''}`;
}

export function buildBlogAlternates(locale: string, slug?: string) {
  const lang = normalizeLocale(locale);
  return {
    canonical: buildBlogUrl(lang, slug),
    languages: {
      'id-ID': buildBlogUrl('id', slug),
      'en-US': buildBlogUrl('en', slug),
      'x-default': buildBlogUrl('id', slug),
    },
  };
}

export function buildBlogRobots(article: BlogArticle) {
  const index = isBlogArticleIndexable(article);
  return {
    index,
    follow: true,
    googleBot: {
      index,
      follow: true,
      'max-image-preview': 'large' as const,
      'max-snippet': -1,
      'max-video-preview': -1,
    },
  };
}

export function buildBlogArticleJsonLd(
  article: BlogArticle & { localized: BlogArticleCopy },
  locale: string,
) {
  const lang = normalizeLocale(locale);
  const url = buildBlogUrl(lang, article.slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    '@id': `${url}#article`,
    headline: article.localized.title,
    description: article.localized.description,
    image: [article.image],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: lang === 'id' ? 'id-ID' : 'en-US',
    articleSection: article.localized.category,
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    author: {
      '@type': 'Organization',
      name: 'Lajukan',
      url: `${SITE_URL}/${lang}/about`,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Lajukan',
      url: SITE_URL,
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    },
    keywords: article.keywords.join(', '),
    citation: article.sources?.map(source => source.url),
    about: article.market?.topicLabel
      ? [
          { '@type': 'Thing', name: article.market.topicLabel },
          article.market.city
            ? { '@type': 'Place', name: article.market.city }
            : undefined,
        ].filter(Boolean)
      : undefined,
  };
}

export function buildBlogBreadcrumbJsonLd(
  article: BlogArticle & { localized: BlogArticleCopy },
  locale: string,
) {
  const lang = normalizeLocale(locale);
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: [
      {
        '@type': 'ListItem',
        position: 1,
        name: lang === 'id' ? 'Beranda' : 'Home',
        item: `${SITE_URL}/${lang}`,
      },
      {
        '@type': 'ListItem',
        position: 2,
        name: 'Blog',
        item: buildBlogUrl(lang),
      },
      {
        '@type': 'ListItem',
        position: 3,
        name: article.localized.title,
        item: buildBlogUrl(lang, article.slug),
      },
    ],
  };
}

export function buildBlogIndexJsonLd(locale: string) {
  const lang = normalizeLocale(locale);
  const articles = getIndexableBlogArticles(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': `${buildBlogUrl(lang)}#blog`,
    name: lang === 'id' ? 'Blog Lajukan' : 'Lajukan Blog',
    description:
      lang === 'id'
        ? 'Panduan praktis untuk sourcing UMKM, supplier lokal, jasa usaha, mesin, peluang usaha, AI bisnis, dan operasional usaha Indonesia.'
        : 'Practical guides for SME sourcing, local suppliers, business services, machinery, opportunities, business AI, and Indonesian operations.',
    url: buildBlogUrl(lang),
    inLanguage: lang === 'id' ? 'id-ID' : 'en-US',
    publisher: {
      '@type': 'Organization',
      name: 'Lajukan',
      url: SITE_URL,
    },
    blogPost: articles.slice(0, 100).map(article => ({
      '@type': 'BlogPosting',
      headline: article.localized.title,
      url: buildBlogUrl(lang, article.slug),
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
    })),
  };
}

export type BlogMarketplaceQualityInput = {
  supplyCount: number;
  demandCount30d: number;
  verifiedSupplierCount: number;
  uniqueMarketDataPoints: number;
  hasFreshMarketplaceData: boolean;
  hasHumanReview: boolean;
};

export function evaluateProgrammaticIndexReadiness(
  input: BlogMarketplaceQualityInput,
) {
  let score = 0;
  const reasons: string[] = [];

  if (input.supplyCount >= 3) score += 25;
  else reasons.push('Butuh minimal 3 penyedia relevan agar halaman tidak kosong.');

  if (input.demandCount30d >= 2) score += 15;
  else reasons.push('Tambahkan sinyal demand nyata 30 hari terakhir.');

  if (input.verifiedSupplierCount >= 1) score += 15;
  else reasons.push('Minimal satu penyedia terverifikasi disarankan.');

  if (input.uniqueMarketDataPoints >= 3) score += 20;
  else reasons.push('Tambahkan minimal 3 data lokal unik: MOQ, rentang harga nyata, response time, atau stok.');

  if (input.hasFreshMarketplaceData) score += 15;
  else reasons.push('Data marketplace perlu masih fresh dan memiliki tanggal verifikasi.');

  if (input.hasHumanReview) score += 10;
  else reasons.push('Lakukan human review sebelum halaman diindeks.');

  return {
    score,
    indexable: score >= 80,
    reasons,
  };
}

export function getBlogSitemapEntries() {
  return (['id', 'en'] as const).flatMap(locale =>
    BLOG_ARTICLES.filter(isBlogArticleIndexable).map(article => ({
      url: buildBlogUrl(locale, article.slug),
      lastModified: article.updatedAt,
      changeFrequency: article.contentKind === 'programmatic' ? 'weekly' : 'monthly',
      priority: article.contentKind === 'programmatic' ? 0.65 : 0.8,
      alternates: {
        languages: {
          id: buildBlogUrl('id', article.slug),
          en: buildBlogUrl('en', article.slug),
        },
      },
    })),
  );
}

export function getBlogContentInventory() {
  const byCluster = new Map<string, number>();
  const byCity = new Map<string, number>();

  for (const article of BLOG_ARTICLES) {
    const cluster = article.cluster || article.copy.id.category;
    byCluster.set(cluster, (byCluster.get(cluster) || 0) + 1);
    if (article.market?.city) {
      byCity.set(article.market.city, (byCity.get(article.market.city) || 0) + 1);
    }
  }

  return {
    ...BLOG_STATS,
    indexable: BLOG_ARTICLES.filter(isBlogArticleIndexable).length,
    noindex: BLOG_ARTICLES.filter(article => !isBlogArticleIndexable(article)).length,
    byCluster: Object.fromEntries(byCluster),
    byCity: Object.fromEntries(byCity),
    officialSources: Object.values(OFFICIAL_SOURCES),
  };
}