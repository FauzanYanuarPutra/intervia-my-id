#!/usr/bin/env node

import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, '../../..');
const defaultOut = path.join(
  repoRoot,
  '.runtime',
  'personal-ai',
  'domain-dataset.json',
);
const defaultImageDir = path.join(
  repoRoot,
  '.runtime',
  'personal-ai',
  'domain-images',
);

const args = new Map(
  process.argv.slice(2).map(arg => {
    const [key, ...rest] = arg.replace(/^--/, '').split('=');
    return [key, rest.length ? rest.join('=') : 'true'];
  }),
);

const outFile = path.resolve(String(args.get('out') || defaultOut));
const imageDir = path.resolve(String(args.get('image-dir') || defaultImageDir));
const requestedLimit = Number(args.get('limit') || 80);
const openFoodFactsLimit = Number(args.get('off-limit') || 6);
const openFoodFactsDelayMs = Number(args.get('off-delay-ms') || 8000);
const openFoodFactsProductDelayMs = Number(
  args.get('off-product-delay-ms') || 4200,
);
const downloadImages = args.get('download-images') === 'true';
const includeOpenFoodFacts = args.get('include-open-food-facts') === 'true';

const USER_AGENT =
  'LajukanPersonalAI-DatasetPull/1.0 (open-data enrichment; https://www.lajukan.com)';

const QID_OVERRIDES = {
  'mesin las': 'Q1936800',
  'timbangan digital': 'Q134566',
  'kertas kraft': 'Q1755609',
  'botol PET': 'Q24841394',
  'standing pouch': 'Q2026232',
  'label stiker': 'Q2511068',
  'kain katun': 'Q3695916',
  'kain polyester': 'Q188245',
  MDF: 'Q642231',
  'bijih plastik': 'Q109875324',
  'biji kopi': 'Q153697',
  cabai: 'Q165199',
  'minyak kelapa sawit': 'Q231458',
  'fotografi produk': 'Q2111747',
  'sertifikasi halal': 'Q2946899',
};

const SOURCES = [
  {
    name: 'Wikidata Query/API',
    url: 'https://www.wikidata.org/wiki/Wikidata:SPARQL_query_service',
    license: 'Wikidata content: CC0, see Wikidata terms',
  },
  {
    name: 'Wikimedia Commons API',
    url: 'https://commons.wikimedia.org/wiki/Commons:API',
    license: 'Per-file license from Commons extmetadata',
  },
  {
    name: 'Open Images Dataset reference',
    url: 'https://storage.googleapis.com/openimages/web/index.html',
    license: 'Annotations CC BY 4.0; image license should be verified per image',
  },
  {
    name: 'Open Food Facts API',
    url: 'https://openfoodfacts.github.io/openfoodfacts-server/api/',
    license:
      'Database ODbL; database contents DbCL; product images CC BY-SA, with per-product rights caveats',
  },
];

const APPROVED_DATASET_SOURCES = [
  {
    id: 'hf-openfoodfacts-product-database',
    source: 'Hugging Face',
    dataset: 'openfoodfacts/product-database',
    url: 'https://huggingface.co/datasets/openfoodfacts/product-database',
    status: 'approved_metadata_only',
    relevance: [
      'produk kemasan nyata',
      'ingredient list',
      'kategori pangan',
      'packaging',
      'barcode/source page',
    ],
    license:
      'HF card tags ODbL/AGPL; official Open Food Facts docs state product images are CC BY-SA with rights caveats',
    ingestVia:
      'Open Food Facts API, not direct HF bulk download, so rate limits and fields can be controlled',
  },
  {
    id: 'hf-voxel51-nutrigreen',
    source: 'Hugging Face',
    dataset: 'Voxel51/NutriGreen',
    url: 'https://huggingface.co/datasets/Voxel51/NutriGreen',
    status: 'approved_for_eval_optional',
    relevance: [
      'foto kemasan pangan nyata',
      'label kemasan',
      'dataset image/object-detection kecil',
    ],
    license: 'CC-BY-SA-4.0 according to dataset card',
    ingestVia:
      'Optional future evaluation pack; current script does not bulk-copy transient HF asset URLs',
  },
];

async function main() {
  await mkdir(path.dirname(outFile), { recursive: true });
  if (downloadImages) await mkdir(imageDir, { recursive: true });

  const items = [];
  const selectedTerms = TERMS.slice(0, clamp(requestedLimit, 1, TERMS.length));
  for (const [index, term] of selectedTerms.entries()) {
    process.stdout.write(
      `[${index + 1}/${selectedTerms.length}] ${term.name}... `,
    );
    try {
      const item = await buildItem(term);
      if (item) {
        items.push(item);
        process.stdout.write(`ok (${item.name})\n`);
      } else {
        process.stdout.write('not found\n');
      }
    } catch (error) {
      process.stdout.write('failed\n');
      console.warn(
        `[dataset] ${term.name}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    await sleep(180);
  }

  if (includeOpenFoodFacts) {
    const offItems = await fetchOpenFoodFactsItems(
      clamp(openFoodFactsLimit, 1, OPEN_FOOD_FACTS_TERMS.length),
    );
    items.push(...offItems);
  }

  const dedupedItems = dedupeItems(items);
  const dataset = {
    version: 1,
    generated_at: new Date().toISOString(),
    item_count: dedupedItems.length,
    license_note:
      'This file is a Lajukan Personal AI reference/RAG dataset, not a proof set and not a fine-tuning corpus. Wikidata/Commons/Open Food Facts records are real external data with source URLs and license notes. Check each source_url/image page before redistribution, publication, or model training.',
    sources: SOURCES,
    approved_dataset_sources: APPROVED_DATASET_SOURCES,
    items: dedupedItems,
  };

  await writeFile(outFile, `${JSON.stringify(dataset, null, 2)}\n`, 'utf8');
  console.log(`\nSaved ${dedupedItems.length} domain items to ${outFile}`);
  if (downloadImages) console.log(`Images saved under ${imageDir}`);
}

async function buildItem(term) {
  const qid = term.qid || QID_OVERRIDES[term.name] || '';
  const search = qid
    ? { id: qid, label: term.name, description: term.description }
    : (await searchWikidata(term.name, 'id')) ||
      (await searchWikidata(term.en || term.name, 'en'));
  if (!search?.id) return null;

  const entity = await fetchEntity(search.id);
  const wikidataLabel = pickLang(entity.labels, ['id', 'en']);
  const label = qid ? term.name : wikidataLabel || search.label || term.name;
  const description =
    pickLang(entity.descriptions, ['id', 'en']) ||
    search.description ||
    term.description;
  const aliases = [
    term.name,
    term.en,
    wikidataLabel,
    ...pickAliases(entity.aliases, ['id', 'en']),
    ...(term.aliases || []),
  ].filter(Boolean);

  const imageFile = firstCommonsImage(entity);
  const commons = imageFile ? await fetchCommonsImageInfo(imageFile) : null;
  let localImagePath = '';
  if (downloadImages && commons?.url) {
    localImagePath = await downloadImage(search.id, imageFile, commons.thumbUrl || commons.url);
  }

  return {
    id: `wikidata-${search.id.toLowerCase()}`,
    category: term.category,
    name: label,
    aliases: unique(aliases).slice(0, 12),
    description: stripHtml(description).slice(0, 420),
    visualCues: term.visualCues,
    businessUses: term.businessUses,
    verify: term.verify,
    searchTerms: unique([term.name, term.en, ...(term.searchTerms || [])]).slice(0, 12),
    sourceName: 'Wikidata / Wikimedia Commons',
    sourceUrl: `https://www.wikidata.org/wiki/${search.id}`,
    imageUrl: commons?.url || commonsFilePath(imageFile),
    license: commons?.license || '',
    attribution: commons?.attribution || '',
    localImagePath,
  };
}

async function searchWikidata(search, language) {
  const url = new URL('https://www.wikidata.org/w/api.php');
  url.searchParams.set('action', 'wbsearchentities');
  url.searchParams.set('format', 'json');
  url.searchParams.set('language', language);
  url.searchParams.set('uselang', language);
  url.searchParams.set('limit', '1');
  url.searchParams.set('search', search);
  const json = await fetchJson(url);
  return Array.isArray(json.search) ? json.search[0] : null;
}

async function fetchEntity(id) {
  const url = `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(id)}.json`;
  const json = await fetchJson(url);
  return json.entities?.[id] || {};
}

function firstCommonsImage(entity) {
  const claims = entity.claims?.P18;
  const value = Array.isArray(claims)
    ? claims[0]?.mainsnak?.datavalue?.value
    : null;
  return typeof value === 'string' ? value : '';
}

async function fetchCommonsImageInfo(filename) {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|extmetadata|mime|size');
  url.searchParams.set('iiurlwidth', '640');
  url.searchParams.set('titles', `File:${filename}`);
  const json = await fetchJson(url);
  const page = Object.values(json.query?.pages || {})[0];
  const info = page?.imageinfo?.[0];
  const metadata = info?.extmetadata || {};
  return {
    url: info?.url || commonsFilePath(filename),
    thumbUrl: info?.thumburl || '',
    license: stripHtml(
      metadata.LicenseShortName?.value || metadata.License?.value || '',
    ),
    attribution: stripHtml(
      metadata.Artist?.value || metadata.Credit?.value || '',
    ).slice(0, 220),
  };
}

async function fetchOpenFoodFactsItems(limit) {
  const selectedTerms = OPEN_FOOD_FACTS_TERMS.slice(0, limit);
  const items = [];
  console.log(
    `\nOpen Food Facts real product pull: ${selectedTerms.length} search terms`,
  );

  for (const [index, term] of selectedTerms.entries()) {
    process.stdout.write(
      `[OFF ${index + 1}/${selectedTerms.length}] ${term.query}... `,
    );
    try {
      const products = await searchOpenFoodFacts(term);
      const mapped = products
        .map(product => buildOpenFoodFactsItem(term, product))
        .filter(Boolean);
      items.push(...mapped);
      process.stdout.write(`ok (${mapped.length} products)\n`);
    } catch (error) {
      process.stdout.write('failed\n');
      console.warn(
        `[open-food-facts] ${term.query}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    await sleep(openFoodFactsDelayMs);
  }

  return items;
}

async function searchOpenFoodFacts(term) {
  const barcodeProducts = await fetchOpenFoodFactsProductsByCode(
    term.barcodes || [],
  );
  if (term.search === false || barcodeProducts.length >= (term.minProducts || 2)) {
    return dedupeProducts(barcodeProducts);
  }

  const url = new URL('https://world.openfoodfacts.org/cgi/search.pl');
  url.searchParams.set('search_terms', term.query);
  url.searchParams.set('search_simple', '1');
  url.searchParams.set('action', 'process');
  url.searchParams.set('json', '1');
  url.searchParams.set('page_size', String(term.pageSize || 4));
  url.searchParams.set(
    'fields',
    [
      'code',
      'product_name',
      'generic_name',
      'brands',
      'categories',
      'categories_tags',
      'ingredients_text',
      'ingredients_tags',
      'packaging',
      'packaging_tags',
      'image_front_small_url',
      'image_front_url',
      'countries_tags',
      'lang',
      'quantity',
      'stores',
      'manufacturing_places',
      'labels_tags',
      'data_quality_errors_tags',
      'data_quality_warnings_tags',
    ].join(','),
  );

  const json = await fetchJson(url);
  const searchProducts = Array.isArray(json.products) ? json.products : [];
  return dedupeProducts([...barcodeProducts, ...searchProducts]);
}

async function fetchOpenFoodFactsProductsByCode(codes) {
  const products = [];
  for (const code of codes) {
    const url = new URL(
      `https://world.openfoodfacts.org/api/v2/product/${encodeURIComponent(code)}.json`,
    );
    url.searchParams.set(
      'fields',
      [
        'code',
        'product_name',
        'generic_name',
        'brands',
        'categories',
        'categories_tags',
        'ingredients_text',
        'ingredients_tags',
        'packaging',
        'packaging_tags',
        'image_front_small_url',
        'image_front_url',
        'countries_tags',
        'lang',
        'quantity',
        'stores',
        'manufacturing_places',
        'labels_tags',
        'data_quality_errors_tags',
        'data_quality_warnings_tags',
      ].join(','),
    );
    try {
      const json = await fetchJson(url);
      if (json.status === 1 && json.product) products.push(json.product);
    } catch (error) {
      console.warn(
        `[open-food-facts-product] ${code}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
    await sleep(openFoodFactsProductDelayMs);
  }
  return products;
}

function buildOpenFoodFactsItem(term, product) {
  const code = cleanExternalText(product.code, 80);
  const productName = cleanExternalText(product.product_name, 160);
  if (!code || !productName) return null;
  const errors = cleanTagList(product.data_quality_errors_tags).slice(0, 3);

  const brand = cleanExternalText(product.brands, 120);
  const genericName = cleanExternalText(product.generic_name, 180);
  const categories = cleanExternalText(product.categories, 240);
  const ingredients = cleanExternalText(product.ingredients_text, 300);
  const packaging = cleanExternalText(product.packaging, 180);
  const countries = cleanTagList(product.countries_tags)
    .map(stripTagPrefix)
    .slice(0, 5);
  const warningTags = cleanTagList(product.data_quality_warnings_tags)
    .map(stripTagPrefix)
    .slice(0, 4);

  const descriptionParts = [
    brand ? `brand ${brand}` : '',
    categories ? `kategori ${categories}` : '',
    ingredients ? `komposisi: ${ingredients}` : '',
    packaging ? `kemasan: ${packaging}` : '',
    countries.length ? `negara data: ${countries.join(', ')}` : '',
  ].filter(Boolean);

  return {
    id: `openfoodfacts-${code}`,
    category: term.category,
    name: productName,
    aliases: unique([
      productName,
      genericName,
      brand,
      term.query,
      ...cleanTagList(product.categories_tags).map(stripTagPrefix),
      ...cleanTagList(product.ingredients_tags).map(stripTagPrefix),
    ]).slice(0, 12),
    description:
      `Contoh produk nyata dari Open Food Facts untuk referensi Lajukan: ${descriptionParts.join('; ')}.`.slice(
        0,
        420,
      ),
    visualCues: unique([
      ...term.visualCues,
      packaging ? `kemasan tertulis: ${packaging}` : '',
      product.image_front_url || product.image_front_small_url
        ? 'punya foto front packaging di sumber'
        : '',
    ]).slice(0, 8),
    businessUses: unique([
      ...term.businessUses,
      'benchmark foto produk dan label kemasan nyata',
      'referensi deskripsi bahan, kategori, dan packaging',
    ]).slice(0, 8),
    verify: unique([
      ...term.verify,
      'cek langsung visual foto user, jangan klaim dari database saja',
      'cocokkan barcode/label jika user ingin identifikasi produk spesifik',
      'verifikasi izin edar, halal, kedaluwarsa, dan supplier sebelum transaksi',
      ...errors.map(tag => `jangan pakai untuk klaim nutrisi otomatis: ${stripTagPrefix(tag)}`),
      ...warningTags.map(tag => `catatan kualitas data OFF: ${tag}`),
    ]).slice(0, 8),
    searchTerms: unique([
      term.query,
      productName,
      brand,
      genericName,
      categories,
      ingredients,
      packaging,
      ...cleanTagList(product.categories_tags).map(stripTagPrefix),
      ...cleanTagList(product.ingredients_tags).map(stripTagPrefix),
      ...cleanTagList(product.packaging_tags).map(stripTagPrefix),
    ]).slice(0, 16),
    sourceName: 'Open Food Facts API / Hugging Face product-database audit',
    sourceUrl: `https://world.openfoodfacts.org/product/${encodeURIComponent(code)}`,
    imageUrl:
      cleanExternalText(product.image_front_small_url, 500) ||
      cleanExternalText(product.image_front_url, 500),
    license:
      'Open Food Facts: database ODbL, contents DbCL, product images CC BY-SA with product rights caveats',
  };
}

function dedupeProducts(products) {
  const seen = new Set();
  const result = [];
  for (const product of products) {
    const code = cleanExternalText(product?.code, 80);
    if (!code || seen.has(code)) continue;
    seen.add(code);
    result.push(product);
  }
  return result;
}

async function downloadImage(id, filename, url) {
  const extension = path.extname(filename).toLowerCase().slice(0, 8) || '.jpg';
  const safeName = `${id.toLowerCase()}-${slugify(filename)}${extension}`;
  const target = path.join(imageDir, safeName);
  const response = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    throw new Error(`image ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(target, buffer);
  return path.relative(repoRoot, target).replace(/\\/g, '/');
}

async function fetchJson(url) {
  const response = await fetch(url, {
    headers: { Accept: 'application/json', 'User-Agent': USER_AGENT },
  });
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new Error(`HTTP ${response.status} for ${url}: ${body.slice(0, 160)}`);
  }
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`Non-JSON response for ${url}: ${text.slice(0, 160)}`);
  }
}

function pickLang(value, languages) {
  for (const language of languages) {
    const text = value?.[language]?.value;
    if (typeof text === 'string' && text.trim()) return text.trim();
  }
  return '';
}

function pickAliases(value, languages) {
  return languages.flatMap(language =>
    Array.isArray(value?.[language])
      ? value[language]
          .map(entry => entry?.value)
          .filter(text => typeof text === 'string')
      : [],
  );
}

function commonsFilePath(filename) {
  if (!filename) return '';
  return `https://commons.wikimedia.org/wiki/Special:FilePath/${encodeURIComponent(filename)}`;
}

function stripHtml(value) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanExternalText(value, maxLength) {
  if (Array.isArray(value)) {
    return value
      .map(entry =>
        typeof entry === 'object' && entry !== null
          ? entry.text || entry.value || ''
          : entry,
      )
      .map(entry => cleanExternalText(entry, maxLength))
      .filter(Boolean)[0] || '';
  }
  return stripHtml(value)
    .replace(/[\u0000-\u001f\u007f]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanTagList(value) {
  return Array.isArray(value)
    ? unique(value.map(item => cleanExternalText(item, 120))).filter(Boolean)
    : [];
}

function stripTagPrefix(value) {
  return String(value || '')
    .replace(/^[a-z]{2,3}:/i, '')
    .replace(/-/g, ' ')
    .trim();
}

function dedupeItems(items) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const isOpenFoodFacts = String(item.id || '').startsWith('openfoodfacts-');
    const key = isOpenFoodFacts
      ? `openfoodfacts:${String(item.category || '')}:${slugify(item.name)}`
      : String(item.id || item.name || '').toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

function unique(values) {
  const seen = new Set();
  const result = [];
  for (const value of values) {
    const text = String(value || '').trim();
    const key = text.toLowerCase();
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
  }
  return result;
}

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 72);
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return max;
  return Math.max(min, Math.min(max, Math.round(value)));
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

const TERMS = [
  term('mesin jahit', 'sewing machine', 'machine', ['kepala mesin', 'jarum', 'meja', 'benang'], ['konveksi', 'repair jahit', 'sampel pakaian'], ['jenis jahitan', 'motor', 'spare part']),
  term('mesin obras', 'overlock sewing machine', 'machine', ['cone benang banyak', 'pisau kecil', 'jahitan pinggir'], ['kaos', 'finishing kain'], ['jumlah benang', 'pisau', 'lebar obras']),
  term('mesin press panas', 'heat press', 'machine', ['pelat press', 'tuas', 'timer suhu'], ['DTF', 'sublimasi', 'custom kaos'], ['ukuran platen', 'range suhu', 'tekanan']),
  term('vacuum sealer', 'vacuum sealer', 'machine', ['tutup atau bar seal', 'kantong vakum', 'panel mode'], ['frozen food', 'kopi', 'produk kering'], ['tipe chamber', 'lebar seal', 'plastik vakum']),
  term('impulse sealer', 'impulse sealer', 'machine', ['tuas panjang', 'skala panas', 'bar pemanas'], ['snack', 'produk bubuk', 'kemasan kecil'], ['panjang seal', 'elemen pemanas', 'ketebalan plastik']),
  term('mixer adonan', 'dough mixer', 'machine', ['bowl stainless', 'pengaduk hook', 'bodi besar'], ['bakery', 'donat', 'mie'], ['kapasitas kg', 'tipe mixer', 'daya motor']),
  term('dehydrator makanan', 'food dehydrator', 'machine', ['rak bertingkat', 'kipas', 'panel suhu'], ['buah kering', 'herbal', 'bumbu kering'], ['jumlah tray', 'suhu', 'sirkulasi udara']),
  term('mesin penggiling padi', 'rice mill', 'machine', ['corong gabah', 'saluran beras', 'bodi logam'], ['selep padi', 'hasil tani'], ['kapasitas', 'rendemen', 'spare part']),
  term('CNC router', 'CNC router', 'machine', ['gantry', 'meja kerja', 'spindle'], ['furniture', 'signage', 'akrilik'], ['area kerja', 'spindle', 'software']),
  term('mesin laser cutting', 'laser cutting machine', 'machine', ['kabinet', 'kepala laser', 'exhaust'], ['souvenir', 'akrilik', 'kerajinan'], ['tipe laser', 'daya watt', 'material aman']),
  term('kompresor udara', 'air compressor', 'machine', ['tabung silinder', 'pressure gauge', 'motor pump'], ['bengkel', 'cat', 'pneumatic tools'], ['liter', 'PSI', 'CFM']),
  term('mesin las', 'welding machine', 'machine', ['kabel elektroda', 'clamp ground', 'panel ampere'], ['bengkel las', 'rangka besi'], ['tipe MMA/MIG/TIG', 'ampere', 'safety']),
  term('pompa air', 'water pump', 'machine', ['inlet outlet pipa', 'motor pompa', 'impeller housing'], ['irigasi', 'air bersih', 'produksi'], ['debit', 'head', 'daya']),
  term('mesin penggiling kopi', 'coffee grinder', 'machine', ['hopper biji', 'burr', 'wadah bubuk'], ['kedai kopi', 'roastery'], ['burr', 'grind size', 'kapasitas']),
  term('mesin espresso', 'espresso machine', 'machine', ['group head', 'portafilter', 'steam wand'], ['coffee shop', 'minuman kopi'], ['boiler', 'group', 'tekanan']),
  term('oven', 'oven', 'machine', ['ruang pemanas', 'rak', 'knob suhu'], ['bakery', 'roasting kecil'], ['kapasitas', 'suhu', 'gas/listrik']),
  term('deep fryer', 'deep fryer', 'machine', ['bak minyak', 'keranjang', 'thermostat'], ['ayam goreng', 'snack', 'resto'], ['kapasitas liter', 'drain oil', 'suhu']),
  term('blender', 'blender', 'tool', ['jar transparan', 'pisau bawah', 'motor base'], ['minuman', 'bumbu', 'saus'], ['watt', 'kapasitas', 'material jar']),
  term('timbangan digital', 'digital scale', 'tool', ['display angka', 'platform timbang', 'tombol tare'], ['packing', 'resep', 'QC'], ['akurasi', 'kapasitas', 'kalibrasi']),
  term('kertas kraft', 'kraft paper', 'packaging', ['warna coklat', 'serat kertas', 'matte'], ['paper bag', 'wrap', 'label'], ['GSM', 'food grade', 'laminasi']),
  term('botol PET', 'PET bottle', 'packaging', ['botol bening', 'ulir tutup', 'plastik ringan'], ['minuman', 'saus', 'madu'], ['volume', 'food grade', 'segel']),
  term('standing pouch', 'stand-up pouch', 'packaging', ['gusset bawah', 'ziplock', 'pouch fleksibel'], ['kopi', 'snack', 'bumbu'], ['material', 'ukuran gram', 'valve']),
  term('bubble wrap', 'bubble wrap', 'packaging', ['gelembung udara', 'lembar plastik', 'transparan'], ['packing pengiriman', 'barang pecah'], ['ketebalan', 'lebar roll', 'lapisan']),
  term('corrugated box', 'corrugated fiberboard', 'packaging', ['kardus bergelombang', 'flute', 'box coklat'], ['pengiriman', 'kemasan retail'], ['ply', 'ECT/BCT', 'ukuran']),
  term('label stiker', 'sticker label', 'packaging', ['lembar stiker', 'print label', 'adhesive'], ['branding', 'barcode', 'segel'], ['bahan vinyl/paper', 'adhesive', 'finishing']),
  term('kain katun', 'cotton fabric', 'raw_material', ['kain matte', 'serat halus', 'warna solid'], ['kaos', 'kemeja', 'tote bag'], ['GSM', 'susut', 'komposisi']),
  term('kain polyester', 'polyester fabric', 'raw_material', ['permukaan licin', 'sintetis', 'warna tajam'], ['jersey', 'seragam', 'tas'], ['gramasi', 'finishing', 'sublimasi']),
  term('kulit sintetis', 'artificial leather', 'raw_material', ['tekstur kulit', 'lembaran fleksibel', 'backing kain'], ['tas', 'dompet', 'sepatu'], ['ketebalan', 'PU/PVC', 'retak']),
  term('plywood', 'plywood', 'raw_material', ['lembaran kayu', 'lapisan tepi', 'serat kayu'], ['furniture', 'booth', 'rak'], ['ketebalan', 'grade', 'lem']),
  term('MDF', 'medium-density fibreboard', 'raw_material', ['papan halus', 'warna coklat homogen', 'serbuk padat'], ['furniture', 'CNC', 'display'], ['ketebalan', 'density', 'finishing']),
  term('baja', 'steel', 'raw_material', ['logam abu', 'batang/pipa/plat', 'berat'], ['rangka', 'alat', 'konstruksi'], ['grade', 'ketebalan', 'coating']),
  term('aluminium', 'aluminium', 'raw_material', ['logam ringan', 'warna silver', 'profil ekstrusi'], ['etalase', 'frame', 'kemasan'], ['seri alloy', 'ketebalan', 'finishing']),
  term('bijih plastik', 'plastic pellet', 'raw_material', ['butiran kecil', 'karung', 'warna putih/bening'], ['injeksi plastik', 'blow molding'], ['jenis PP/PE/PET', 'grade', 'MFI']),
  term('tepung terigu', 'wheat flour', 'ingredient', ['bubuk putih krem', 'karung/plastik', 'label protein'], ['roti', 'mie', 'kue'], ['protein', 'tanggal produksi', 'halal']),
  term('gula pasir', 'granulated sugar', 'ingredient', ['kristal putih', 'butiran', 'karung/plastik'], ['minuman', 'kue', 'snack'], ['grade', 'kemurnian', 'harga kg']),
  term('biji kopi', 'coffee bean', 'ingredient', ['biji oval', 'hijau/coklat', 'karung/pouch'], ['roastery', 'kedai kopi'], ['origin', 'roast date', 'grade']),
  term('kakao', 'cocoa bean', 'ingredient', ['biji coklat', 'karung', 'aroma kakao'], ['coklat', 'minuman', 'bakery'], ['fermentasi', 'moisture', 'grade']),
  term('kedelai', 'soybean', 'ingredient', ['biji kuning bulat', 'karung', 'permukaan halus'], ['tempe', 'tahu', 'susu kedelai'], ['lokal/impor', 'kadar air', 'kotoran']),
  term('singkong', 'cassava', 'ingredient', ['umbi coklat', 'daging putih', 'kulit kasar'], ['keripik', 'tapioka', 'makanan olahan'], ['varietas', 'kadar pati', 'freshness']),
  term('cabai', 'chili pepper', 'ingredient', ['buah merah/hijau', 'tangkai', 'kulit mengkilap'], ['sambal', 'bumbu', 'frozen'], ['jenis', 'tingkat pedas', 'kesegaran']),
  term('rempah-rempah', 'spice', 'ingredient', ['biji/batang/bubuk aromatik', 'warna coklat/kuning/merah'], ['bumbu', 'jamu', 'makanan'], ['jenis rempah', 'moisture', 'kontaminan']),
  term('minyak kelapa sawit', 'palm oil', 'ingredient', ['cairan kuning', 'jeriken/botol', 'label minyak'], ['gorengan', 'makanan', 'sabun'], ['grade', 'izin pangan', 'harga liter']),
  term('fotografi produk', 'product photography', 'service', ['lightbox', 'background putih', 'lighting studio'], ['katalog', 'iklan', 'profil UMKM'], ['hak pakai', 'jumlah foto', 'retouch']),
  term('desain kemasan', 'packaging design', 'service', ['mockup label', 'dieline', 'warna brand'], ['branding', 'retail', 'marketplace'], ['file final', 'revisi', 'hak cipta']),
  term('sertifikasi halal', 'halal certification', 'service', ['logo halal', 'dokumen', 'audit bahan'], ['makanan', 'kosmetik', 'resto'], ['lembaga', 'masa berlaku', 'cakupan produk']),
];

const OPEN_FOOD_FACTS_TERMS = [
  offTerm(
    'kopi',
    'ingredient',
    ['sachet/pouch/jar kopi', 'label rasa atau varian', 'warna kemasan kopi'],
    ['referensi produk kopi kemasan', 'bahan konten UMKM minuman'],
    ['jenis kopi', 'komposisi gula/susu', 'izin edar dan halal'],
    ['8991002122017', '8992696420557'],
  ),
  offTerm(
    'tepung terigu',
    'ingredient',
    ['karung/plastik tepung', 'label protein atau brand', 'warna dominan kemasan'],
    ['bakery', 'gorengan', 'bahan produksi makanan'],
    ['protein tepung', 'berat bersih', 'tanggal produksi'],
    ['8993296201119', '8993296301116', '8995333060970'],
  ),
  offTerm(
    'sambal',
    'ingredient',
    ['botol/jar/sachet sambal', 'warna merah/oranye', 'label pedas'],
    ['produk bumbu siap jual', 'konten makanan pedas'],
    ['level pedas', 'komposisi cabai', 'BPOM/halal'],
  ),
  offTerm(
    'keripik',
    'ingredient',
    ['pouch snack', 'foto keripik di kemasan', 'label rasa'],
    ['snack UMKM', 'reseller makanan ringan'],
    ['bahan utama', 'berat bersih', 'tanggal kedaluwarsa'],
  ),
  offTerm(
    'minyak goreng',
    'ingredient',
    ['botol/pouch minyak', 'cairan kuning', 'label volume'],
    ['usaha gorengan', 'catering', 'bahan produksi makanan'],
    ['jenis minyak', 'volume', 'sertifikasi dan tanggal kedaluwarsa'],
    ['8992946121005', '8993496001076', '8992628020152'],
  ),
];

function offTerm(query, category, visualCues, businessUses, verify, barcodes = []) {
  return {
    query,
    category,
    visualCues,
    businessUses,
    verify,
    barcodes,
    minProducts: barcodes.length ? 1 : 2,
    search: barcodes.length === 0,
    pageSize: 4,
  };
}

function term(name, en, category, visualCues, businessUses, verify) {
  return {
    name,
    en,
    category,
    visualCues,
    businessUses,
    verify,
    aliases: [name, en],
    searchTerms: [name, en, ...businessUses],
    description: '',
  };
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
