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

export type BlogArticle = {
  slug: string;
  publishedAt: string;
  updatedAt: string;
  image: string;
  keywords: string[];
  copy: Record<BlogLocale, BlogArticleCopy>;
};

const SITE_URL = (
  process.env.NEXT_PUBLIC_APP_URL || 'https://www.lajukan.com'
).replace(/\/+$/, '');
const DEFAULT_BLOG_IMAGE = `${SITE_URL}/opengraph-image.png`;

export const BLOG_ARTICLES: BlogArticle[] = [
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

export function getBlogArticles(
  locale: string,
): Array<BlogArticle & { localized: BlogArticleCopy }> {
  const lang: BlogLocale = locale === 'en' ? 'en' : 'id';
  return BLOG_ARTICLES.map(article => ({
    ...article,
    localized: article.copy[lang],
  }));
}

export function getBlogArticle(slug: string, locale: string) {
  const article = BLOG_ARTICLES.find(item => item.slug === slug);
  if (!article) return null;
  const lang: BlogLocale = locale === 'en' ? 'en' : 'id';
  return {
    ...article,
    localized: article.copy[lang],
  };
}

export function buildBlogUrl(locale: string, slug?: string) {
  const lang = locale === 'en' ? 'en' : 'id';
  return `${SITE_URL}/${lang}/blog${slug ? `/${slug}` : ''}`;
}

export function buildBlogPath(slug?: string) {
  return `/blog${slug ? `/${slug}` : ''}`;
}

export function buildBlogArticleJsonLd(
  article: BlogArticle & { localized: BlogArticleCopy },
  locale: string,
) {
  const lang = locale === 'en' ? 'en' : 'id';
  const url = buildBlogUrl(lang, article.slug);
  return {
    '@context': 'https://schema.org',
    '@type': 'BlogPosting',
    headline: article.localized.title,
    description: article.localized.description,
    image: [article.image],
    datePublished: article.publishedAt,
    dateModified: article.updatedAt,
    inLanguage: lang === 'id' ? 'id-ID' : 'en-US',
    mainEntityOfPage: {
      '@type': 'WebPage',
      '@id': url,
    },
    author: {
      '@type': 'Organization',
      name: 'Lajukan',
      url: SITE_URL,
    },
    publisher: {
      '@type': 'Organization',
      name: 'Lajukan',
      logo: {
        '@type': 'ImageObject',
        url: `${SITE_URL}/logo.png`,
      },
    },
    keywords: article.keywords.join(', '),
  };
}

export function buildBlogIndexJsonLd(locale: string) {
  const lang = locale === 'en' ? 'en' : 'id';
  const articles = getBlogArticles(lang);
  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    name: lang === 'id' ? 'Blog Lajukan' : 'Lajukan Blog',
    description:
      lang === 'id'
        ? 'Panduan praktis untuk UMKM, supplier lokal, AI bisnis, peta usaha, dan operasional usaha Indonesia.'
        : 'Practical guides for SMEs, local suppliers, business AI, maps, and Indonesian business operations.',
    url: buildBlogUrl(lang),
    inLanguage: lang === 'id' ? 'id-ID' : 'en-US',
    publisher: {
      '@type': 'Organization',
      name: 'Lajukan',
      url: SITE_URL,
    },
    blogPost: articles.map(article => ({
      '@type': 'BlogPosting',
      headline: article.localized.title,
      url: buildBlogUrl(lang, article.slug),
      datePublished: article.publishedAt,
      dateModified: article.updatedAt,
    })),
  };
}
