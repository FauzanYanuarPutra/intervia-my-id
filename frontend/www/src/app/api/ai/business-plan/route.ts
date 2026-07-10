import { NextRequest, NextResponse } from 'next/server';
import { enforceRateLimit, getClientIp } from '@/lib/rateLimit';
import { requireAuth } from '@/lib/serverAuth';

const USE_OLLAMA = process.env.USE_OLLAMA === 'true';
const OLLAMA_URL = process.env.OLLAMA_URL || 'http://localhost:11434';
const OLLAMA_MODEL =
  process.env.OLLAMA_BUSINESS_MODEL || process.env.OLLAMA_MODEL || 'llama3.2:3b';

type BusinessPlanItem = {
  label: string;
  note: string;
  query: string;
};

type BusinessPlan = {
  provider: 'local-rules' | 'ollama+rules';
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

function cleanPlanItem(value: unknown, fallback: BusinessPlanItem): BusinessPlanItem {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return fallback;
  const record = value as Record<string, unknown>;
  return {
    label: cleanText(record.label, 80) || fallback.label,
    note: cleanText(record.note, 180) || fallback.note,
    query: cleanText(record.query, 100) || fallback.query,
  };
}

function cleanPlanItems(value: unknown, fallback: BusinessPlanItem[]): BusinessPlanItem[] {
  if (!Array.isArray(value)) return fallback;
  return fallback.map((fallbackItem, index) => cleanPlanItem(value[index], fallbackItem));
}

function extractJsonObject(value: string): Record<string, unknown> | null {
  const direct = value.trim();
  const fenced =
    direct.match(/```json\s*([\s\S]+?)```/i)?.[1] ||
    direct.match(/```([\s\S]+?)```/i)?.[1] ||
    '';
  const candidates = [direct, fenced].filter(Boolean);
  for (const candidate of candidates) {
    try {
      const parsed = JSON.parse(candidate) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      // Try brace slicing below.
    }
  }
  const firstBrace = direct.indexOf('{');
  const lastBrace = direct.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    try {
      const parsed = JSON.parse(direct.slice(firstBrace, lastBrace + 1)) as unknown;
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        return parsed as Record<string, unknown>;
      }
    } catch {
      return null;
    }
  }
  return null;
}

function sanitizeAiPlan(rawText: string, fallback: BusinessPlan): BusinessPlan | null {
  const parsed = extractJsonObject(rawText);
  if (!parsed) return null;
  const needs = parsed.needs && typeof parsed.needs === 'object'
    ? (parsed.needs as Record<string, unknown>)
    : {};
  const estimates = parsed.estimates && typeof parsed.estimates === 'object'
    ? (parsed.estimates as Record<string, unknown>)
    : {};

  return {
    provider: 'ollama+rules',
    ideaTitle: cleanText(parsed.ideaTitle, 90) || fallback.ideaTitle,
    summary: cleanText(parsed.summary, 320) || fallback.summary,
    budget: fallback.budget,
    needs: {
      supplies: cleanPlanItems(needs.supplies, fallback.needs.supplies),
      equipment: cleanPlanItems(needs.equipment, fallback.needs.equipment),
      packaging: cleanPlanItems(needs.packaging, fallback.needs.packaging),
      services: cleanPlanItems(needs.services, fallback.needs.services),
    },
    estimates: {
      startingBudgetMin: fallback.estimates.startingBudgetMin,
      startingBudgetMax: fallback.estimates.startingBudgetMax,
      sellingPriceRange:
        cleanText(estimates.sellingPriceRange, 90) || fallback.estimates.sellingPriceRange,
      grossMarginRange:
        cleanText(estimates.grossMarginRange, 90) || fallback.estimates.grossMarginRange,
      breakEvenRange:
        cleanText(estimates.breakEvenRange, 90) || fallback.estimates.breakEvenRange,
      caveat: cleanText(estimates.caveat, 200) || fallback.estimates.caveat,
    },
    risks: cleanList(parsed.risks, 4, 170).length
      ? cleanList(parsed.risks, 4, 170)
      : fallback.risks,
    firstSteps: cleanList(parsed.firstSteps, 5, 170).length
      ? cleanList(parsed.firstSteps, 5, 170)
      : fallback.firstSteps,
    searchQueries: cleanList(parsed.searchQueries, 6, 100).length
      ? cleanList(parsed.searchQueries, 6, 100)
      : fallback.searchQueries,
  };
}

async function callOllamaPlan(input: BusinessPlanInput, fallback: BusinessPlan) {
  const response = await fetch(`${trimBaseUrl(OLLAMA_URL)}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      messages: [
        {
          role: 'system',
          content: [
            'Kamu adalah AI Perencana Usaha Lokal Lajukan untuk pelaku usaha Indonesia.',
            'Berikan saran praktis, hemat modal, dan tidak menjanjikan pasti untung.',
            'Jangan menyebut nama supplier palsu. Beri kebutuhan dan query pencarian saja.',
            'Gunakan JSON valid saja. Jangan markdown.',
          ].join('\n'),
        },
        {
          role: 'user',
          content: JSON.stringify({
            request: 'Susun paket usaha ringan dari input user.',
            input,
            safeFallbackShape: fallback,
            requiredSchema: {
              ideaTitle: 'string',
              summary: 'string',
              needs: {
                supplies: [{ label: 'string', note: 'string', query: 'string' }],
                equipment: [{ label: 'string', note: 'string', query: 'string' }],
                packaging: [{ label: 'string', note: 'string', query: 'string' }],
                services: [{ label: 'string', note: 'string', query: 'string' }],
              },
              estimates: {
                sellingPriceRange: 'string',
                grossMarginRange: 'string',
                breakEvenRange: 'string',
                caveat: 'string',
              },
              risks: ['string'],
              firstSteps: ['string'],
              searchQueries: ['string'],
            },
          }),
        },
      ],
      options: {
        temperature: 0.25,
        num_predict: 900,
      },
    }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new Error(`Ollama ${response.status}: ${text.slice(0, 300)}`);
  }
  const payload = (await response.json().catch(() => ({}))) as {
    message?: { content?: string };
  };
  const plan = sanitizeAiPlan(payload.message?.content || '', fallback);
  if (!plan) throw new Error('Ollama returned invalid business plan JSON.');
  return plan;
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

    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
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
    if (USE_OLLAMA) {
      try {
        const plan = await callOllamaPlan(input, fallback);
        return NextResponse.json({ data: plan });
      } catch (error) {
        console.warn(
          '[AI_BUSINESS_PLAN_OLLAMA_FALLBACK]',
          error instanceof Error ? error.message : error,
        );
      }
    }

    return NextResponse.json({ data: fallback });
  } catch (error) {
    console.error('[AI_BUSINESS_PLAN_ERROR]', error);
    return NextResponse.json(
      { error: 'Gagal membuat rencana usaha.' },
      { status: 500 },
    );
  }
}
