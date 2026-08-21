export type LajukanDomainKnowledgeItem = {
  id: string;
  category:
    | 'machine'
    | 'tool'
    | 'raw_material'
    | 'packaging'
    | 'ingredient'
    | 'service'
    | 'safety'
    | 'other';
  name: string;
  aliases: string[];
  description: string;
  visualCues: string[];
  businessUses: string[];
  verify: string[];
  searchTerms: string[];
  sourceName?: string;
  sourceUrl?: string;
  imageUrl?: string;
  license?: string;
};

type KnowledgePromptInput = {
  query: string;
  media: Array<{
    name: string;
    mime: string;
    text?: string;
  }>;
  locale: 'id' | 'en';
  items: LajukanDomainKnowledgeItem[];
  limit?: number;
};

const STOPWORDS = new Set([
  'aku',
  'atau',
  'buat',
  'bisa',
  'dari',
  'dan',
  'dengan',
  'foto',
  'gambar',
  'ini',
  'itu',
  'jelaskan',
  'ke',
  'minta',
  'apa',
  'produk',
  'saya',
  'tolong',
  'untuk',
  'yang',
  'the',
  'this',
  'that',
  'and',
  'for',
  'with',
  'image',
  'photo',
  'product',
  'please',
  'explain',
  'describe',
]);

export const BUILTIN_LAJUKAN_DOMAIN_KNOWLEDGE: LajukanDomainKnowledgeItem[] = [
  {
    id: 'machine-sewing-lockstitch',
    category: 'machine',
    name: 'Mesin jahit lockstitch',
    aliases: ['mesin jahit', 'industrial sewing machine', 'lockstitch machine'],
    description:
      'Mesin jahit utama untuk produksi pakaian, tas kain, aksesoris tekstil, dan perbaikan jahitan lurus.',
    visualCues: [
      'meja mesin dengan kepala mesin logam',
      'jarum dan sepatu penekan di bagian depan',
      'spool benang di atas atau belakang mesin',
      'pedal dan motor di bawah meja pada tipe industri',
    ],
    businessUses: [
      'konveksi kaos, seragam, tas, hijab, dan produk kain',
      'produksi sampel sebelum masuk vendor jahit',
    ],
    verify: ['jenis jahitan', 'tipe motor', 'kondisi jarum', 'kelengkapan meja dan pedal'],
    searchTerms: ['mesin jahit industri', 'mesin jahit konveksi', 'alat produksi pakaian'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'machine-overlock',
    category: 'machine',
    name: 'Mesin obras / overlock',
    aliases: ['mesin obras', 'overlock machine', 'serger'],
    description:
      'Mesin untuk merapikan tepi kain dan membuat sambungan elastis pada pakaian rajut atau kaos.',
    visualCues: [
      'beberapa cone benang di bagian atas',
      'area pisau pemotong kecil dekat jarum',
      'jahitan pinggir kain terlihat rapat dan membungkus tepi',
    ],
    businessUses: ['finishing kaos', 'pakaian rajut', 'seragam', 'produk tekstil massal'],
    verify: ['jumlah benang', 'fungsi pisau', 'lebar obras', 'ketersediaan spare part'],
    searchTerms: ['mesin obras', 'overlock konveksi', 'mesin finishing kain'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'machine-heat-press',
    category: 'machine',
    name: 'Mesin heat press',
    aliases: ['heat press', 'mesin press kaos', 'press sublim'],
    description:
      'Mesin pemanas dan penekan untuk sablon transfer, sublimasi, DTF, vinyl, tote bag, mug, atau topi tergantung attachment.',
    visualCues: [
      'pelat datar besar seperti penjepit',
      'tuas tekan di atas atau samping',
      'panel suhu dan timer digital',
    ],
    businessUses: ['custom kaos', 'merchandise', 'printing DTF/sublimasi', 'souvenir UMKM'],
    verify: ['ukuran platen', 'range suhu', 'stabilitas tekanan', 'jenis media yang didukung'],
    searchTerms: ['heat press kaos', 'mesin press DTF', 'alat sablon transfer'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'machine-vacuum-sealer',
    category: 'machine',
    name: 'Vacuum sealer',
    aliases: ['mesin vakum makanan', 'vacuum packaging machine', 'vacuum sealer'],
    description:
      'Alat untuk mengeluarkan udara dari kemasan dan menyegel plastik agar produk pangan lebih tahan simpan.',
    visualCues: [
      'bodi kotak dengan tutup transparan atau bar sealer',
      'mulut plastik dimasukkan ke area seal',
      'panel mode vakum dan seal',
    ],
    businessUses: ['frozen food', 'kopi', 'daging olahan', 'bumbu', 'produk kering'],
    verify: ['tipe chamber atau external', 'lebar seal', 'jenis plastik vakum', 'kapasitas pompa'],
    searchTerms: ['vacuum sealer makanan', 'mesin vakum frozen food', 'kemasan vakum'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'machine-impulse-sealer',
    category: 'machine',
    name: 'Impulse sealer',
    aliases: ['hand sealer', 'mesin press plastik', 'plastic bag sealer'],
    description:
      'Alat sealer panas sederhana untuk menutup plastik kemasan snack, bahan kering, dan produk kecil.',
    visualCues: [
      'bentuk memanjang seperti penjepit meja',
      'tuas tekan di atas',
      'skala waktu panas di sisi alat',
    ],
    businessUses: ['snack rumahan', 'produk bubuk', 'aksesoris', 'kemasan plastik PP/PE'],
    verify: ['panjang seal', 'ketebalan plastik', 'kualitas elemen pemanas', 'ketersediaan teflon tape'],
    searchTerms: ['hand sealer plastik', 'impulse sealer', 'alat kemasan snack'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'machine-dough-mixer',
    category: 'machine',
    name: 'Mixer adonan',
    aliases: ['planetary mixer', 'spiral mixer', 'mixer roti'],
    description:
      'Mesin untuk mencampur dan menguleni adonan roti, kue, bakso, atau bahan pangan sesuai jenis pengaduknya.',
    visualCues: [
      'mangkuk stainless besar',
      'kepala mixer dengan pengaduk hook, beater, atau whisk',
      'bodi berat dengan tombol speed',
    ],
    businessUses: ['bakery', 'kue rumahan', 'donat', 'mie', 'bakso', 'catering'],
    verify: ['kapasitas liter/kg', 'tipe planetary atau spiral', 'daya motor', 'material bowl'],
    searchTerms: ['mixer roti', 'planetary mixer', 'spiral mixer bakery'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'machine-food-dehydrator',
    category: 'machine',
    name: 'Food dehydrator',
    aliases: ['mesin pengering makanan', 'dehydrator', 'oven pengering'],
    description:
      'Alat pengering bersuhu terkontrol untuk buah, bumbu, ikan, jamur, herbal, atau snack kering.',
    visualCues: [
      'rak bertingkat di dalam kabinet',
      'kipas atau ventilasi udara',
      'panel suhu dan timer',
    ],
    businessUses: ['buah kering', 'bumbu kering', 'keripik sehat', 'produk herbal'],
    verify: ['rentang suhu', 'jumlah tray', 'sirkulasi udara', 'material rak food grade'],
    searchTerms: ['mesin pengering makanan', 'food dehydrator', 'alat pengering buah'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'machine-rice-mill',
    category: 'machine',
    name: 'Mesin penggiling padi',
    aliases: ['rice mill', 'huller padi', 'mesin selep padi'],
    description:
      'Mesin pascapanen untuk mengupas gabah menjadi beras, biasanya dipakai penggilingan kecil sampai menengah.',
    visualCues: [
      'corong besar untuk gabah',
      'bodi mesin logam dengan saluran keluaran beras/dedak',
      'sering dipasang dengan diesel atau motor listrik',
    ],
    businessUses: ['jasa selep padi', 'pengolahan hasil tani', 'distribusi beras lokal'],
    verify: ['kapasitas kg/jam', 'rendemen', 'konsumsi daya/bahan bakar', 'spare part rubber roll'],
    searchTerms: ['mesin penggiling padi', 'rice mill kecil', 'huller padi'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'machine-cnc-router',
    category: 'machine',
    name: 'CNC router',
    aliases: ['mesin CNC kayu', 'router CNC', 'CNC engraving'],
    description:
      'Mesin pemotong/ukir berbasis komputer untuk kayu, akrilik, MDF, aluminium tipis, dan signage.',
    visualCues: [
      'meja kerja datar dengan gantry bergerak',
      'spindle/router di kepala mesin',
      'rel linear dan kabel drag chain',
    ],
    businessUses: ['furniture custom', 'signage', 'souvenir akrilik', 'panel dekorasi'],
    verify: ['area kerja', 'daya spindle', 'material yang bisa dipotong', 'software/control board'],
    searchTerms: ['CNC router kayu', 'jasa CNC akrilik', 'mesin CNC signage'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'machine-laser-cutter',
    category: 'machine',
    name: 'Laser cutting machine',
    aliases: ['laser cutter', 'mesin laser cutting', 'laser engraving'],
    description:
      'Mesin laser untuk memotong atau mengukir akrilik, kayu, kulit sintetis, kertas, atau material tertentu sesuai tipe laser.',
    visualCues: [
      'kabinet dengan area kerja tertutup',
      'kepala laser kecil pada rel XY',
      'exhaust atau selang pembuangan asap',
    ],
    businessUses: ['souvenir', 'stempel', 'akrilik display', 'kemasan premium', 'kerajinan'],
    verify: ['tipe CO2/fiber/diode', 'daya watt', 'exhaust', 'material aman dan tidak aman'],
    searchTerms: ['mesin laser cutting', 'laser engraving akrilik', 'jasa laser cut'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'machine-air-compressor',
    category: 'machine',
    name: 'Kompresor udara',
    aliases: ['air compressor', 'kompresor cat', 'kompresor angin'],
    description:
      'Mesin penyedia udara bertekanan untuk pengecatan, pneumatic tools, tambal ban, cleaning, dan produksi ringan.',
    visualCues: [
      'tabung silinder horizontal atau vertikal',
      'motor dan pump di atas tabung',
      'pressure gauge dan regulator',
    ],
    businessUses: ['bengkel', 'cat furniture', 'airbrush', 'produksi dengan alat pneumatic'],
    verify: ['kapasitas liter', 'tekanan PSI/bar', 'oil-free atau oil-lubricated', 'debit CFM'],
    searchTerms: ['kompresor udara', 'kompresor bengkel', 'air compressor'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'packaging-kraft-paper',
    category: 'packaging',
    name: 'Kertas kraft',
    aliases: ['kraft paper', 'kertas coklat', 'paper bag kraft'],
    description:
      'Bahan kertas coklat/putih yang umum untuk paper bag, box, label rustic, wrap, dan kemasan ramah visual.',
    visualCues: ['warna coklat natural atau putih', 'tekstur serat kertas', 'permukaan matte'],
    businessUses: ['paper bag', 'box makanan kering', 'label handmade', 'bungkus produk'],
    verify: ['gramasi GSM', 'food grade', 'ketahanan minyak/air', 'finishing laminasi'],
    searchTerms: ['kertas kraft', 'paper bag kraft', 'kemasan kraft'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'packaging-pet-bottle',
    category: 'packaging',
    name: 'Botol PET',
    aliases: ['PET bottle', 'botol plastik bening', 'botol minuman'],
    description:
      'Kemasan plastik bening ringan untuk minuman, bumbu cair, madu, sabun cair, dan produk cair tertentu.',
    visualCues: ['plastik bening mengkilap', 'bentuk botol ringan', 'ulir tutup di leher botol'],
    businessUses: ['minuman UMKM', 'saus', 'madu', 'sabun cair', 'sampel produk cair'],
    verify: ['volume ml', 'food grade', 'tipe tutup', 'segel shrink atau induction seal'],
    searchTerms: ['botol PET', 'botol plastik minuman', 'supplier botol PET'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'packaging-stand-up-pouch',
    category: 'packaging',
    name: 'Standing pouch',
    aliases: ['stand up pouch', 'ziplock pouch', 'pouch kemasan'],
    description:
      'Kemasan fleksibel yang bisa berdiri, sering dipakai untuk kopi, snack, bubuk, frozen food kering, dan produk premium kecil.',
    visualCues: ['kantong fleksibel dengan gusset bawah', 'ziplock di bagian atas', 'permukaan doff atau glossy'],
    businessUses: ['kopi', 'granola', 'keripik', 'bumbu bubuk', 'produk herbal'],
    verify: ['material PET/AL/PE', 'ukuran gram', 'ziplock', 'valve kopi', 'food grade'],
    searchTerms: ['standing pouch', 'pouch ziplock', 'kemasan kopi'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'material-cotton-fabric',
    category: 'raw_material',
    name: 'Kain katun',
    aliases: ['cotton fabric', 'katun combed', 'cotton textile'],
    description:
      'Bahan tekstil berbasis serat kapas, umum untuk kaos, kemeja, sprei, tote bag, dan produk fashion.',
    visualCues: ['permukaan kain relatif matte', 'serat halus', 'jatuh kain tergantung gramasi dan rajutan'],
    businessUses: ['konveksi', 'brand clothing', 'home textile', 'souvenir kain'],
    verify: ['jenis tenun/rajut', 'gramasi GSM', 'komposisi serat', 'susut dan luntur warna'],
    searchTerms: ['kain katun', 'katun combed', 'supplier kain cotton'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'material-polyester-fabric',
    category: 'raw_material',
    name: 'Kain polyester',
    aliases: ['polyester fabric', 'bahan polyester', 'polyester textile'],
    description:
      'Bahan sintetis yang kuat, cepat kering, dan sering dipakai untuk jersey, seragam, tas, banner kain, atau lining.',
    visualCues: ['permukaan bisa licin atau sedikit mengkilap', 'serat sintetis rapat', 'warna tajam'],
    businessUses: ['jersey sublimasi', 'seragam', 'tas promosi', 'produk outdoor ringan'],
    verify: ['jenis weave/knit', 'gramasi', 'finishing anti air', 'cocok sublimasi atau tidak'],
    searchTerms: ['kain polyester', 'bahan jersey', 'supplier polyester'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'material-plywood',
    category: 'raw_material',
    name: 'Plywood / multipleks',
    aliases: ['plywood', 'multipleks', 'kayu lapis'],
    description:
      'Lembaran kayu lapis untuk furniture, booth, interior, packaging kayu, dan produksi kerajinan.',
    visualCues: ['lembaran kayu datar', 'lapisan terlihat di sisi tepi', 'motif serat kayu di permukaan'],
    businessUses: ['furniture', 'booth pameran', 'rak display', 'kerajinan laser/CNC'],
    verify: ['ketebalan mm', 'grade face/back', 'jenis kayu', 'kadar air', 'lem interior/eksterior'],
    searchTerms: ['multipleks', 'plywood', 'supplier kayu lapis'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'ingredient-wheat-flour',
    category: 'ingredient',
    name: 'Tepung terigu',
    aliases: ['wheat flour', 'tepung protein tinggi', 'tepung protein sedang'],
    description:
      'Bahan baku utama bakery, mie, gorengan, kue, dan produk makanan berbasis gandum.',
    visualCues: ['bubuk putih krem', 'dikemas karung atau plastik', 'label protein/brand sering terlihat di kemasan'],
    businessUses: ['roti', 'donat', 'mie', 'kue', 'snack goreng'],
    verify: ['protein tinggi/sedang/rendah', 'tanggal produksi', 'sertifikasi halal/BPOM jika perlu', 'harga per kg/karung'],
    searchTerms: ['tepung terigu grosir', 'supplier tepung bakery', 'bahan baku roti'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'ingredient-coffee-beans',
    category: 'ingredient',
    name: 'Biji kopi',
    aliases: ['coffee beans', 'green bean', 'roasted coffee'],
    description:
      'Bahan baku minuman kopi, roasting, cold brew, kopi bubuk, dan produk turunan kopi.',
    visualCues: ['biji oval kecil berwarna hijau, coklat, atau coklat gelap', 'sering dalam karung atau pouch valve'],
    businessUses: ['kedai kopi', 'roastery', 'kopi bubuk UMKM', 'minuman RTD'],
    verify: ['jenis arabika/robusta', 'origin', 'roast date', 'grade defect', 'moisture green bean'],
    searchTerms: ['biji kopi', 'green bean kopi', 'supplier kopi'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'ingredient-soybean',
    category: 'ingredient',
    name: 'Kedelai',
    aliases: ['soybean', 'kacang kedelai', 'soy bean'],
    description:
      'Bahan utama tahu, tempe, susu kedelai, kecap, pakan, dan produk protein nabati.',
    visualCues: ['biji bulat kecil kuning pucat', 'dikemas karung atau plastik', 'permukaan biji halus'],
    businessUses: ['produksi tempe', 'tahu', 'susu kedelai', 'kecap rumahan'],
    verify: ['lokal/impor', 'ukuran biji', 'kadar air', 'kotoran', 'harga per kg/karung'],
    searchTerms: ['kedelai grosir', 'bahan tempe', 'supplier kedelai'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'service-product-photography',
    category: 'service',
    name: 'Jasa foto produk',
    aliases: ['product photography', 'foto katalog', 'foto produk UMKM'],
    description:
      'Jasa pendukung untuk membuat foto produk lebih jelas, rapi, dan siap dipakai di marketplace, katalog, atau iklan.',
    visualCues: ['lightbox', 'background putih atau lifestyle', 'produk disusun dengan properti pendukung'],
    businessUses: ['katalog Lajukan', 'iklan sosial media', 'profil UMKM', 'e-commerce'],
    verify: ['jumlah foto', 'hak pakai', 'retouch', 'background', 'format file', 'revisi'],
    searchTerms: ['jasa foto produk UMKM', 'foto katalog produk', 'product photography'],
    sourceName: 'Lajukan seed knowledge',
  },
  {
    id: 'safety-food-grade',
    category: 'safety',
    name: 'Food grade',
    aliases: ['food grade packaging', 'aman pangan', 'kemasan makanan'],
    description:
      'Istilah untuk material/peralatan yang layak kontak dengan makanan sesuai standar dan dokumen pendukung.',
    visualCues: ['tidak selalu bisa dipastikan dari foto', 'kadang ada simbol gelas-garpu atau label food grade'],
    businessUses: ['kemasan makanan', 'alat produksi pangan', 'botol minuman', 'pouch snack'],
    verify: ['dokumen supplier', 'sertifikat material', 'nomor batch', 'suhu penggunaan', 'bahan kontak pangan'],
    searchTerms: ['kemasan food grade', 'sertifikat food grade', 'alat produksi makanan'],
    sourceName: 'Lajukan seed knowledge',
  },
];

export function normalizeDomainKnowledgeItems(
  value: unknown,
): LajukanDomainKnowledgeItem[] {
  const rawItems = Array.isArray(value)
    ? value
    : value &&
        typeof value === 'object' &&
        Array.isArray((value as { items?: unknown }).items)
      ? (value as { items: unknown[] }).items
      : [];

  return rawItems
    .slice(0, 1_000)
    .map(item => normalizeItem(item))
    .filter((item): item is LajukanDomainKnowledgeItem => Boolean(item))
    .slice(0, 500);
}

export function mergeDomainKnowledgeItems(
  primary: LajukanDomainKnowledgeItem[],
  secondary: LajukanDomainKnowledgeItem[],
) {
  const seen = new Set<string>();
  const merged: LajukanDomainKnowledgeItem[] = [];
  for (const item of [...primary, ...secondary].slice(0, 1_000)) {
    const key = `${item.id || item.name}`.trim().toLocaleLowerCase('id-ID');
    const nameKey = item.name.trim().toLocaleLowerCase('id-ID');
    if (!key || seen.has(key) || seen.has(`name:${nameKey}`)) continue;
    seen.add(key);
    seen.add(`name:${nameKey}`);
    merged.push(item);
    if (merged.length >= 500) break;
  }
  return merged;
}

export function buildLajukanDomainKnowledgePrompt({
  query,
  media,
  locale,
  items,
  limit = 8,
}: KnowledgePromptInput) {
  const isId = locale === 'id';
  const queryText = cleanString(
    [
      query,
      ...media.slice(0, 8).map(item =>
        `${cleanString(item.name, 180)} ${cleanString(item.mime, 100)} ${cleanString(item.text, 4_000)}`,
      ),
    ].join('\n'),
    12_000,
  );
  const tokens = tokenize(queryText);
  const safeLimit = Math.max(1, Math.min(12, Math.floor(limit) || 8));
  const ranked = rankItems(items.slice(0, 500), tokens, queryText).slice(
    0,
    safeLimit,
  );

  const guardrail = isId
    ? [
        '[Referensi domain Lajukan]',
        'Gunakan katalog ini sebagai referensi nama kandidat, fungsi usaha, dan pertanyaan verifikasi. Jangan jadikan katalog ini bukti bahwa foto pasti berisi item tertentu.',
        'Jika visual cocok, pakai kata "kemungkinan" atau "mirip", lalu sebutkan hal yang harus dicek.',
      ]
    : [
        '[Lajukan domain reference]',
        'Use this catalog as a reference for candidate names, business use, and verification questions. Do not treat it as proof that the uploaded image is definitely a specific item.',
        'If the visual facts match, say "likely" or "similar to", then list what to verify.',
      ];

  if (ranked.length === 0) {
    return [
      ...guardrail,
      isId
        ? 'Kategori utama Lajukan: mesin dan alat produksi, bahan baku, bahan pangan, kemasan, jasa pendukung, safety/sertifikasi, lokasi dan distribusi.'
        : 'Main Lajukan categories: production machines and tools, raw materials, food ingredients, packaging, support services, safety/certification, location and distribution.',
    ].join('\n');
  }

  return cleanString(
    [
      ...guardrail,
      isId ? 'Item referensi paling relevan:' : 'Most relevant reference items:',
      ...ranked.map(item => formatItemForPrompt(item, isId)),
    ].join('\n'),
    12_000,
  );
}

function normalizeItem(value: unknown): LajukanDomainKnowledgeItem | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const name = cleanString(item.name, 120);
  if (!name) return null;
  const id = cleanString(item.id, 120) || slugify(name);
  const category = normalizeCategory(item.category);
  const sourceUrl = normalizeHttpUrl(item.sourceUrl || item.source_url, 300);
  const imageUrl = normalizeHttpUrl(item.imageUrl || item.image_url, 500);
  return {
    id,
    category,
    name,
    aliases: cleanStringArray(item.aliases, 12, 80),
    description: cleanString(item.description, 420),
    visualCues: cleanStringArray(
      item.visualCues || item.visual_cues,
      8,
      180,
    ),
    businessUses: cleanStringArray(
      item.businessUses || item.business_uses,
      8,
      180,
    ),
    verify: cleanStringArray(item.verify, 8, 180),
    searchTerms: cleanStringArray(item.searchTerms || item.search_terms, 12, 80),
    sourceName: cleanString(item.sourceName || item.source_name, 120),
    // Keep URL fields deterministic for callers/tests: invalid or unsupported
    // schemes become an empty string rather than disappearing as undefined.
    sourceUrl,
    imageUrl,
    license: cleanString(item.license, 120),
  };
}

function normalizeCategory(value: unknown): LajukanDomainKnowledgeItem['category'] {
  const category = cleanString(value, 60).toLowerCase();
  if (
    category === 'machine' ||
    category === 'tool' ||
    category === 'raw_material' ||
    category === 'packaging' ||
    category === 'ingredient' ||
    category === 'service' ||
    category === 'safety'
  ) {
    return category;
  }
  return 'other';
}

function cleanString(value: unknown, maxLength: number) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, maxLength);
}

function normalizeHttpUrl(value: unknown, maxLength: number) {
  const text = cleanString(value, maxLength);
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' || url.protocol === 'http:'
      ? url.toString().slice(0, maxLength)
      : '';
  } catch {
    return '';
  }
}

function cleanStringArray(value: unknown, maxItems: number, maxLength: number) {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const entry of value) {
    const text = cleanString(entry, maxLength);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= maxItems) break;
  }
  return result;
}

function tokenize(value: string) {
  const tokens = value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/\s+/)
    .map(token => token.trim())
    .filter(token => token.length >= 3 && !STOPWORDS.has(token));
  return new Set(tokens);
}

function rankItems(
  items: LajukanDomainKnowledgeItem[],
  tokens: Set<string>,
  queryText: string,
) {
  const normalizedQuery = normalizeForMatch(queryText);
  const scored = items
    .map(item => ({
      item,
      score: scoreItem(item, tokens, normalizedQuery),
    }))
    .filter(entry => entry.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score ||
        a.item.name.localeCompare(b.item.name, 'id-ID'),
    );
  return scored.map(entry => entry.item);
}

function scoreItem(
  item: LajukanDomainKnowledgeItem,
  tokens: Set<string>,
  normalizedQuery: string,
) {
  if (tokens.size === 0 && !normalizedQuery) return 0;
  let score = 0;

  const exactCandidates = [
    item.name,
    ...item.aliases,
    ...item.searchTerms,
  ]
    .map(normalizeForMatch)
    .filter(candidate => candidate.length >= 3);
  for (const candidate of exactCandidates) {
    if (normalizedQuery.includes(candidate)) {
      score += candidate === normalizeForMatch(item.name) ? 18 : 12;
    }
  }

  const fields = [
    [item.name, 6],
    [item.category, 4],
    [item.aliases.join(' '), 5],
    [item.searchTerms.join(' '), 4],
    [item.description, 2],
    [item.visualCues.join(' '), 3],
    [item.businessUses.join(' '), 3],
  ] as const;
  for (const [text, weight] of fields) {
    const haystack = tokenize(text);
    for (const token of tokens) {
      if (haystack.has(token)) score += weight;
    }
  }
  return score;
}

function normalizeForMatch(value: string) {
  return value
    .toLocaleLowerCase('id-ID')
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function formatItemForPrompt(item: LajukanDomainKnowledgeItem, isId: boolean) {
  const details = [
    `- ${item.name} (${categoryLabel(item.category, isId)})`,
    item.aliases.length ? `alias: ${item.aliases.slice(0, 4).join(', ')}` : '',
    item.description ? `deskripsi: ${item.description}` : '',
    item.visualCues.length ? `ciri visual: ${item.visualCues.slice(0, 4).join('; ')}` : '',
    item.businessUses.length ? `fungsi usaha: ${item.businessUses.slice(0, 4).join('; ')}` : '',
    item.verify.length ? `cek: ${item.verify.slice(0, 4).join('; ')}` : '',
    item.sourceName
      ? `sumber: ${item.sourceName}${item.license ? `, ${item.license}` : ''}`
      : '',
  ];
  return details.filter(Boolean).join('. ');
}

function categoryLabel(
  category: LajukanDomainKnowledgeItem['category'],
  isId: boolean,
) {
  const labels: Record<LajukanDomainKnowledgeItem['category'], string> = isId
    ? {
        machine: 'mesin',
        tool: 'alat',
        raw_material: 'bahan baku',
        packaging: 'kemasan',
        ingredient: 'bahan pangan',
        service: 'jasa pendukung',
        safety: 'safety/standar',
        other: 'lainnya',
      }
    : {
        machine: 'machine',
        tool: 'tool',
        raw_material: 'raw material',
        packaging: 'packaging',
        ingredient: 'ingredient',
        service: 'support service',
        safety: 'safety/standard',
        other: 'other',
      };
  return labels[category];
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
}
