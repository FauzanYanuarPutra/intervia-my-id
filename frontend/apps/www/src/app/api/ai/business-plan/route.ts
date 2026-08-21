import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

const INTERNAL_AI_URL = (process.env.INTERNAL_AI_URL || '').trim().replace(/\/+$/, '');
const AI_SERVICE_TOKEN = process.env.AI_SERVICE_TOKEN || '';
const AI_REQUEST_TIMEOUT_MS = (() => {
  const value = Number.parseInt(process.env.AI_REQUEST_TIMEOUT_MS || '', 10);
  if (!Number.isFinite(value)) return 90_000;
  return Math.min(180_000, Math.max(3_000, value));
})();

type BusinessPlanItem = {
  label: string;
  note: string;
  query: string;
};

type BusinessPlan = {
  provider: 'local-rules' | 'ai-service+rules';
  ideaTitle: string;
  summary: string;
  budget: Array<{ label: string; amount: number; note: string }>;
  needs: {
    supplies: BusinessPlanItem[];
    equipment: BusinessPlanItem[];
    packaging: BusinessPlanItem[];
    services: BusinessPlanItem[];
  };
  estimates: {
    startingBudgetMin: number;
    startingBudgetMax: number;
    sellingPriceRange: string;
    grossMarginRange: string;
    breakEvenRange: string;
    caveat: string;
  };
  risks: string[];
  firstSteps: string[];
  searchQueries: string[];
};

type BusinessPlanInput = {
  locale: 'id' | 'en';
  capital: number;
  city: string;
  interest: string;
  target: string;
  experience: string;
};

function cleanText(value: unknown, maxLength = 220): string {
  return typeof value === 'string'
    ? value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, maxLength)
    : '';
}

function cleanAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  const raw = typeof value === 'string' ? value : '';
  const number = Number(raw.replace(/[^\d]/g, ''));
  if (!Number.isFinite(number)) return 0;
  return Math.max(0, Math.min(number, 500_000_000));
}

function clampAmount(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) return min;
  return Math.round(Math.max(min, Math.min(max, value)));
}

function trimBaseUrl(value: string) {
  return value.trim().replace(/\/+$/, '');
}

function classifyInterest(input: string) {
  const text = input.toLowerCase();
  if (/kopi|coffee|espresso|latte/.test(text)) return 'coffee';
  if (/minum|drink|thai|coklat|es |jus|boba|cup/.test(text)) return 'drink';
  if (/snack|cemilan|keripik|basreng|makanan ringan/.test(text)) return 'snack';
  if (/frozen|beku|seblak|nugget|dimsum/.test(text)) return 'frozen';
  if (/jasa|service|desain|foto|konten|laundry/.test(text)) return 'service';
  if (/fashion|baju|kaos|hijab|sepatu/.test(text)) return 'fashion';
  return 'general';
}

function item(label: string, note: string, query: string): BusinessPlanItem {
  return { label, note, query };
}

function buildLocalPlan(input: BusinessPlanInput): BusinessPlan {
  const capital = input.capital || 3_000_000;
  const city = input.city || 'Indonesia';
  const kind = classifyInterest(`${input.interest} ${input.target}`);
  const smallCapital = capital <= 3_500_000;

  const baseBudget = [
    {
      label: input.locale === 'id' ? 'Bahan awal' : 'Initial supplies',
      amount: clampAmount(capital * 0.34, 250_000, capital * 0.48),
      note:
        input.locale === 'id'
          ? 'Mulai dari stok kecil agar cepat validasi pasar.'
          : 'Start with small stock to validate demand.',
    },
    {
      label: input.locale === 'id' ? 'Kemasan' : 'Packaging',
      amount: clampAmount(capital * 0.14, 100_000, capital * 0.22),
      note:
        input.locale === 'id'
          ? 'Pilih kemasan sederhana tapi rapi dan mudah difoto.'
          : 'Use simple, neat packaging that is easy to photograph.',
    },
    {
      label: input.locale === 'id' ? 'Alat utama' : 'Core tools',
      amount: clampAmount(capital * 0.28, 250_000, capital * 0.42),
      note:
        input.locale === 'id'
          ? 'Prioritaskan alat yang benar-benar dipakai harian.'
          : 'Prioritize tools used daily.',
    },
    {
      label: input.locale === 'id' ? 'Promosi awal' : 'Initial promotion',
      amount: clampAmount(capital * 0.1, 75_000, capital * 0.18),
      note:
        input.locale === 'id'
          ? 'Foto produk, banner kecil, tester, atau iklan lokal.'
          : 'Product photos, small banner, samples, or local ads.',
    },
    {
      label: input.locale === 'id' ? 'Cadangan' : 'Buffer',
      amount: clampAmount(capital * 0.14, 100_000, capital * 0.22),
      note:
        input.locale === 'id'
          ? 'Jangan habiskan modal di hari pertama.'
          : 'Do not spend all capital on day one.',
    },
  ];

  const templates: Record<
    string,
    Pick<BusinessPlan, 'ideaTitle' | 'summary' | 'needs' | 'estimates' | 'risks' | 'firstSteps' | 'searchQueries'>
  > = {
    drink: {
      ideaTitle: smallCapital
        ? 'Minuman cup rumahan modal ringan'
        : 'Booth minuman cup lokal',
      summary: `Cocok untuk mulai di ${city} dengan menu sederhana, stok kecil, dan tes jual 30-50 cup pertama.`,
      needs: {
        supplies: [
          item('Bubuk minuman', 'Coklat, thai tea, matcha, atau varian paling laku di area kamu.', `supplier bubuk minuman ${city}`),
          item('Susu dan gula cair', 'Hitung HPP per cup sebelum beli banyak.', `supplier susu gula cair ${city}`),
          item('Topping sederhana', 'Pilih 1-2 topping dulu agar stok tidak mati.', `topping minuman grosir ${city}`),
        ],
        equipment: [
          item('Cup sealer', 'Bisa mulai dari manual/semi otomatis sesuai modal.', `cup sealer ${city}`),
          item('Termos es', 'Penting untuk jualan mobile atau depan rumah.', `termos es minuman ${city}`),
        ],
        packaging: [
          item('Cup 16 oz', 'Ukuran aman untuk menu minuman kekinian.', `cup plastik 16 oz ${city}`),
          item('Sedotan dan plastik take away', 'Beli paket kecil dulu.', `sedotan plastik take away ${city}`),
        ],
        services: [
          item('Desain logo', 'Buat label sederhana agar mudah diingat.', `jasa desain logo UMKM ${city}`),
          item('Cetak banner', 'Cukup banner kecil untuk validasi awal.', `cetak banner UMKM ${city}`),
        ],
      },
      estimates: {
        startingBudgetMin: clampAmount(capital * 0.78, 700_000, capital),
        startingBudgetMax: clampAmount(capital * 0.96, 900_000, capital),
        sellingPriceRange: 'Rp8.000 - Rp12.000/cup',
        grossMarginRange: '35% - 50% sebelum sewa dan tenaga',
        breakEvenRange: '4 - 8 minggu jika penjualan stabil',
        caveat: 'Estimasi kasar. Cek harga bahan dan cup aktual sebelum belanja.',
      },
      risks: [
        'Kompetitor minuman biasanya ramai, jadi rasa dan lokasi harus jelas.',
        'Es, susu, dan topping mudah rusak kalau stok terlalu besar.',
        'Jangan beli alat mahal sebelum menu terbukti laku.',
      ],
      firstSteps: [
        'Pilih 2 menu utama dan hitung HPP per cup.',
        'Cari 3 supplier bahan dan 2 supplier kemasan di Lajukan.',
        'Tes jual 30 cup pertama ke tetangga, kantor, sekolah, atau komunitas.',
        'Catat menu paling laku sebelum tambah varian.',
      ],
      searchQueries: [
        `supplier bubuk minuman ${city}`,
        `cup plastik 16 oz ${city}`,
        `cup sealer ${city}`,
        `jasa desain logo UMKM ${city}`,
      ],
    },
    coffee: {
      ideaTitle: 'Es kopi literan atau cup kecil',
      summary: `Mulai dari menu kopi sederhana di ${city}, fokus repeat order kantor/rumah.`,
      needs: {
        supplies: [
          item('Kopi atau concentrate', 'Pilih rasa stabil dan mudah diracik.', `supplier kopi concentrate ${city}`),
          item('Susu dan gula aren', 'Pakai ukuran kecil untuk tes rasa.', `supplier susu gula aren ${city}`),
        ],
        equipment: [
          item('Botol/cup dan takaran', 'Takaran konsisten membantu rasa stabil.', `alat takar minuman kopi ${city}`),
          item('Cooler box', 'Menjaga minuman tetap dingin saat antar.', `cooler box minuman ${city}`),
        ],
        packaging: [
          item('Botol 250 ml atau cup 16 oz', 'Sesuaikan target: literan, harian, atau event.', `botol kopi literan cup ${city}`),
        ],
        services: [
          item('Foto produk', 'Foto rapi bisa menaikkan trust di chat.', `jasa foto produk UMKM ${city}`),
        ],
      },
      estimates: {
        startingBudgetMin: clampAmount(capital * 0.72, 600_000, capital),
        startingBudgetMax: clampAmount(capital * 0.92, 900_000, capital),
        sellingPriceRange: 'Rp10.000 - Rp18.000/cup',
        grossMarginRange: '30% - 45% sebelum ongkir',
        breakEvenRange: '5 - 10 minggu jika repeat order jalan',
        caveat: 'Harga kopi dan susu berubah. Selalu hitung ulang HPP.',
      },
      risks: [
        'Rasa harus konsisten agar repeat order jalan.',
        'Produk dingin perlu kontrol penyimpanan dan pengantaran.',
      ],
      firstSteps: [
        'Tes 2 resep saja dulu.',
        'Cari supplier kopi/susu dan kemasan.',
        'Buat paket kantor kecil 10-20 cup.',
      ],
      searchQueries: [`supplier kopi ${city}`, `botol kopi literan ${city}`, `jasa foto produk ${city}`],
    },
    snack: {
      ideaTitle: 'Snack repack atau cemilan kiloan',
      summary: `Cocok untuk modal bertahap di ${city}, bisa mulai dari pre-order kecil.`,
      needs: {
        supplies: [
          item('Snack kiloan', 'Cari rasa yang tahan simpan dan cepat laku.', `supplier snack kiloan ${city}`),
          item('Bumbu tabur', 'Beli varian paling aman dulu.', `supplier bumbu tabur ${city}`),
        ],
        equipment: [
          item('Timbangan digital', 'Penting untuk porsi konsisten.', `timbangan digital UMKM ${city}`),
          item('Sealer plastik', 'Membantu kemasan lebih rapi.', `sealer plastik ${city}`),
        ],
        packaging: [
          item('Standing pouch', 'Ukuran kecil untuk tes harga.', `standing pouch snack ${city}`),
          item('Stiker label', 'Buat identitas produk sederhana.', `stiker label makanan ${city}`),
        ],
        services: [
          item('Desain label', 'Label sederhana meningkatkan trust.', `jasa desain label makanan ${city}`),
        ],
      },
      estimates: {
        startingBudgetMin: clampAmount(capital * 0.68, 500_000, capital),
        startingBudgetMax: clampAmount(capital * 0.9, 800_000, capital),
        sellingPriceRange: 'Rp5.000 - Rp18.000/pack',
        grossMarginRange: '25% - 45% sebelum retur',
        breakEvenRange: '3 - 7 minggu jika stok cepat muter',
        caveat: 'Perhatikan izin/label jika skala mulai besar.',
      },
      risks: [
        'Stok bisa melempem jika kemasan kurang rapat.',
        'Varian terlalu banyak bikin modal terkunci.',
      ],
      firstSteps: [
        'Mulai dari 3 varian rasa.',
        'Tentukan ukuran 100g/250g.',
        'Tes jual dengan sistem pre-order.',
      ],
      searchQueries: [`supplier snack kiloan ${city}`, `standing pouch snack ${city}`, `sealer plastik ${city}`],
    },
    frozen: {
      ideaTitle: 'Frozen food rumahan kecil',
      summary: `Mulai dari stok terbatas di ${city}, cocok untuk pre-order dan reseller kecil.`,
      needs: {
        supplies: [
          item('Bahan frozen', 'Pilih produk cepat muter seperti dimsum, nugget, atau seblak frozen.', `supplier frozen food ${city}`),
          item('Bumbu dan bahan pendukung', 'Pastikan rasa stabil.', `supplier bumbu frozen ${city}`),
        ],
        equipment: [
          item('Freezer kecil', 'Bisa sewa/beli bekas dengan cek kondisi.', `freezer kecil bekas ${city}`),
          item('Vacuum sealer', 'Pakai jika produk perlu tahan lebih lama.', `vacuum sealer ${city}`),
        ],
        packaging: [
          item('Plastik vacuum', 'Sesuaikan ukuran porsi.', `plastik vacuum frozen ${city}`),
          item('Label tanggal produksi', 'Wajib untuk kontrol stok.', `label stiker frozen food ${city}`),
        ],
        services: [
          item('Desain label makanan', 'Bantu informasi produk lebih jelas.', `jasa desain label makanan ${city}`),
        ],
      },
      estimates: {
        startingBudgetMin: clampAmount(capital * 0.78, 900_000, capital),
        startingBudgetMax: clampAmount(capital * 0.98, 1_200_000, capital),
        sellingPriceRange: 'Rp15.000 - Rp45.000/pack',
        grossMarginRange: '20% - 40% sebelum listrik dan retur',
        breakEvenRange: '6 - 12 minggu jika stok terjaga',
        caveat: 'Butuh kontrol suhu. Jangan mulai tanpa penyimpanan aman.',
      },
      risks: [
        'Produk rusak jika suhu tidak stabil.',
        'Modal bisa terkunci di freezer dan stok.',
        'Pastikan aturan pangan jika skala membesar.',
      ],
      firstSteps: [
        'Mulai pre-order sebelum stok besar.',
        'Cari freezer dan kemasan dulu.',
        'Catat tanggal masuk/keluar stok.',
      ],
      searchQueries: [`supplier frozen food ${city}`, `freezer kecil ${city}`, `plastik vacuum frozen ${city}`],
    },
    service: {
      ideaTitle: 'Jasa lokal berbasis skill',
      summary: `Cocok jika modal terbatas di ${city}; fokus portofolio, respon cepat, dan paket harga jelas.`,
      needs: {
        supplies: [
          item('Template kerja', 'Siapkan format brief, invoice, dan revisi.', `template invoice jasa UMKM ${city}`),
        ],
        equipment: [
          item('Perangkat kerja utama', 'Gunakan alat yang sudah ada dulu.', `alat kerja jasa UMKM ${city}`),
        ],
        packaging: [
          item('Profil dan portofolio', 'Buat contoh hasil agar calon klien cepat percaya.', `jasa buat portofolio ${city}`),
        ],
        services: [
          item('Foto/profil bisnis', 'Profil rapi menaikkan konversi chat.', `jasa foto profil bisnis ${city}`),
        ],
      },
      estimates: {
        startingBudgetMin: clampAmount(capital * 0.35, 100_000, capital),
        startingBudgetMax: clampAmount(capital * 0.7, 300_000, capital),
        sellingPriceRange: 'Rp50.000 - Rp500.000/proyek kecil',
        grossMarginRange: '50% - 80% sebelum waktu kerja',
        breakEvenRange: '1 - 4 proyek pertama',
        caveat: 'Estimasi tergantung skill, waktu pengerjaan, dan revisi.',
      },
      risks: [
        'Scope pekerjaan harus jelas agar tidak rugi waktu.',
        'Minta DP wajar dan catat kesepakatan tertulis.',
      ],
      firstSteps: [
        'Buat 3 paket harga.',
        'Siapkan contoh hasil/portofolio.',
        'Cari calon klien lokal dan komunitas UMKM.',
      ],
      searchQueries: [`jasa desain UMKM ${city}`, `jasa foto produk ${city}`, `template invoice jasa ${city}`],
    },
    fashion: {
      ideaTitle: 'Reseller fashion stok kecil',
      summary: `Mulai dengan katalog kecil di ${city}, fokus ukuran/warna yang paling aman.`,
      needs: {
        supplies: [
          item('Supplier fashion', 'Cari supplier dengan foto asli dan stok jelas.', `supplier fashion grosir ${city}`),
        ],
        equipment: [
          item('Rak atau display kecil', 'Tidak wajib di awal jika jual online.', `rak display fashion ${city}`),
        ],
        packaging: [
          item('Poly mailer', 'Kemasan kirim yang rapi dan murah.', `poly mailer ${city}`),
          item('Label ukuran', 'Bantu kurangi salah kirim.', `label ukuran baju ${city}`),
        ],
        services: [
          item('Foto katalog', 'Foto jelas mengurangi pertanyaan berulang.', `jasa foto katalog fashion ${city}`),
        ],
      },
      estimates: {
        startingBudgetMin: clampAmount(capital * 0.7, 500_000, capital),
        startingBudgetMax: clampAmount(capital * 0.93, 900_000, capital),
        sellingPriceRange: 'Rp35.000 - Rp150.000/item',
        grossMarginRange: '20% - 40% sebelum retur',
        breakEvenRange: '5 - 10 minggu jika stok muter',
        caveat: 'Ukuran dan retur harus dikontrol ketat.',
      },
      risks: [
        'Stok ukuran/warna bisa lambat keluar.',
        'Foto supplier harus dicek agar tidak mengecewakan pembeli.',
      ],
      firstSteps: [
        'Tes 5-10 SKU saja.',
        'Minta foto/video asli ke supplier.',
        'Catat ukuran yang paling cepat laku.',
      ],
      searchQueries: [`supplier fashion grosir ${city}`, `poly mailer ${city}`, `jasa foto katalog ${city}`],
    },
    general: {
      ideaTitle: 'Paket usaha kecil tervalidasi',
      summary: `Mulai dari kebutuhan paling sederhana di ${city}, lalu tes pasar sebelum belanja besar.`,
      needs: {
        supplies: [
          item('Bahan utama', 'Cari supplier dengan harga dan minimum order masuk akal.', `supplier bahan usaha ${city}`),
        ],
        equipment: [
          item('Alat utama', 'Utamakan alat yang langsung memengaruhi produksi.', `alat usaha ${city}`),
        ],
        packaging: [
          item('Kemasan dasar', 'Pilih kemasan yang mudah dibeli ulang.', `kemasan usaha ${city}`),
        ],
        services: [
          item('Logo dan banner', 'Cukup sederhana untuk mulai jualan.', `jasa desain logo banner ${city}`),
        ],
      },
      estimates: {
        startingBudgetMin: clampAmount(capital * 0.65, 500_000, capital),
        startingBudgetMax: clampAmount(capital * 0.9, 800_000, capital),
        sellingPriceRange: 'Sesuaikan HPP + margin 25% - 45%',
        grossMarginRange: '25% - 45% sebelum biaya operasional',
        breakEvenRange: '4 - 12 minggu jika validasi pasar jalan',
        caveat: 'AI perlu minat usaha yang lebih spesifik untuk estimasi lebih tajam.',
      },
      risks: [
        'Ide terlalu umum bisa membuat belanja tidak fokus.',
        'Cek permintaan lokal sebelum beli stok besar.',
      ],
      firstSteps: [
        'Tentukan produk/jasa pertama yang paling mudah dijual.',
        'Cari 3 supplier pembanding.',
        'Tes jual ke 20-30 calon pembeli pertama.',
      ],
      searchQueries: [`supplier bahan usaha ${city}`, `alat usaha ${city}`, `kemasan usaha ${city}`],
    },
  };

  const template = templates[kind] || templates.general;
  return {
    provider: 'local-rules',
    ...template,
    budget: baseBudget,
  };
}

function cleanList(value: unknown, maxItems: number, maxLength = 180): string[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: string[] = [];
  for (const itemValue of value) {
    const text = cleanText(itemValue, maxLength);
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= maxItems) break;
  }
  return result;
}

type BusinessAdvisorData = {
  objective?: unknown;
  summary?: unknown;
  assumptions?: unknown;
  recommendations?: unknown;
  next_steps?: unknown;
  risks?: unknown;
  metrics_to_watch?: unknown;
};

type InternalAiBusinessResponse = {
  status?: unknown;
  request_id?: unknown;
  response?: unknown;
  message?: unknown;
  data?: unknown;
  error?: unknown;
  warnings?: unknown;
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function buildAiEnhancedPlan(
  payload: InternalAiBusinessResponse,
  fallback: BusinessPlan,
): BusinessPlan | null {
  const data = asRecord(payload.data) as BusinessAdvisorData;

  const summary =
    cleanText(data.summary, 320) ||
    (typeof payload.response === 'string'
      ? cleanText(payload.response, 320)
      : '') ||
    fallback.summary;

  const recommendations = cleanList(data.recommendations, 5, 170);
  const nextSteps = cleanList(data.next_steps, 5, 170);
  const risks = cleanList(data.risks, 4, 170);

  const combinedFirstSteps = Array.from(
    new Set([...nextSteps, ...recommendations].map((item) => item.trim())),
  )
    .filter(Boolean)
    .slice(0, 5);

  if (
    summary === fallback.summary &&
    combinedFirstSteps.length === 0 &&
    risks.length === 0
  ) {
    return null;
  }

  return {
    ...fallback,
    provider: 'ai-service+rules',
    summary,
    risks: risks.length > 0 ? risks : fallback.risks,
    firstSteps:
      combinedFirstSteps.length > 0
        ? combinedFirstSteps
        : fallback.firstSteps,
  };
}

async function callInternalAiPlan(
  input: BusinessPlanInput,
  fallback: BusinessPlan,
  requestId: string,
): Promise<BusinessPlan> {
  if (!INTERNAL_AI_URL) {
    throw new Error('INTERNAL_AI_URL_NOT_CONFIGURED');
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    'x-request-id': requestId,
  };

  if (AI_SERVICE_TOKEN) {
    headers.Authorization = `Bearer ${AI_SERVICE_TOKEN}`;
  }

  const message =
    input.locale === 'en'
      ? [
          'Review this small-business plan for an Indonesian operator.',
          'Use the supplied input and baseline plan as facts.',
          'Prioritize practical recommendations, risks, and next steps.',
          'Do not invent suppliers, current prices, stock, permits, or guaranteed profit.',
        ].join(' ')
      : [
          'Tinjau rencana usaha kecil ini untuk pelaku usaha Indonesia.',
          'Gunakan input dan baseline plan pada context sebagai fakta.',
          'Prioritaskan rekomendasi praktis, risiko, dan langkah berikutnya.',
          'Jangan mengarang supplier, harga terkini, stok, izin, atau menjanjikan keuntungan.',
        ].join(' ');

  const response = await fetch(
    `${INTERNAL_AI_URL}/v1/business/advice`,
    {
      method: 'POST',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(AI_REQUEST_TIMEOUT_MS),
      body: JSON.stringify({
        message,
        locale: input.locale,
        response_mode: 'json',
        temperature: 0.18,
        max_tokens: 800,
        context: {
          business_plan_input: input,
          baseline_plan: fallback,
        },
      }),
    },
  );

  const payload = (await response.json().catch(() => ({}))) as InternalAiBusinessResponse;

  if (!response.ok) {
    const error =
      typeof payload.error === 'string'
        ? payload.error
        : `Internal AI ${response.status}`;
    throw new Error(error);
  }

  const enhanced = buildAiEnhancedPlan(payload, fallback);
  if (!enhanced) {
    throw new Error('AI_SERVICE_RETURNED_NO_USABLE_BUSINESS_PLAN_DATA');
  }

  return enhanced;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req);
    if (!auth.ok) return auth.res;

    const ip = getClientIp(req.headers);
    const rate = await enforceRateLimit({
      key: `rl:ai:business-plan:${auth.ctx.userId}:${ip}`,
      limit: 20,
      windowSeconds: 3600,
      message: 'Too many business plan requests. Please retry later.',
    });

    if (!rate.ok) return rate.response;

    const body = (await req.json().catch(() => ({}))) as Record<
      string,
      unknown
    >;

    const input: BusinessPlanInput = {
      locale: body.locale === 'en' ? 'en' : 'id',
      capital: cleanAmount(body.capital),
      city: cleanText(body.city, 80) || 'Indonesia',
      interest: cleanText(body.interest, 120),
      target: cleanText(body.target, 220),
      experience: cleanText(body.experience, 80),
    };

    if (!input.interest) {
      return NextResponse.json(
        { error: 'Interest or business type is required.' },
        { status: 400 },
      );
    }

    const fallback = buildLocalPlan(input);

    /*
     * Business-plan must remain usable even if the local model is cold/down.
     * AI enhancement is centralized in ai_service; deterministic local rules
     * remain the safe availability fallback.
     */
    if (INTERNAL_AI_URL) {
      const requestId =
        req.headers.get('x-request-id')?.trim() || crypto.randomUUID();

      try {
        const plan = await callInternalAiPlan(
          input,
          fallback,
          requestId,
        );

        const response = NextResponse.json({ data: plan });
        response.headers.set('x-request-id', requestId);
        response.headers.set('Cache-Control', 'no-store');
        return response;
      } catch (error) {
        console.warn(
          '[AI_BUSINESS_PLAN_GATEWAY_FALLBACK]',
          {
            requestId,
            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
        );
      }
    } else {
      console.warn(
        '[AI_BUSINESS_PLAN_GATEWAY_FALLBACK]',
        'INTERNAL_AI_URL is not configured; using local rules.',
      );
    }

    const response = NextResponse.json({ data: fallback });
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('X-AI-Fallback', 'local-rules');

    return response;
  } catch (error) {
    console.error('[AI_BUSINESS_PLAN_ERROR]', error);

    return NextResponse.json(
      { error: 'Gagal membuat rencana usaha.' },
      { status: 500 },
    );
  }
}