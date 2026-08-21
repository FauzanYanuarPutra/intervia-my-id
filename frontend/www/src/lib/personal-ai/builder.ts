export type AIBuilderOption = {
  id: string;
  label: string;
  value: string;
  description?: string;
  icon?: string;
  imageUrl?: string;
  badge?: string;
  instructionAppend?: string;
  negativeInstruction?: string;
  nextStepId?: string;
  autoNext?: boolean;
  metadata?: Record<string, unknown>;
};

export type AIBuilderBlockType =
  | 'heading'
  | 'paragraph'
  | 'notice'
  | 'single_choice'
  | 'multi_choice'
  | 'text'
  | 'textarea'
  | 'number'
  | 'slider'
  | 'toggle'
  | 'image_upload'
  | 'document_upload'
  | 'model_select'
  | 'summary';

export type AIBuilderBlock = {
  id: string;
  type: AIBuilderBlockType;
  label: string;
  variable?: string;
  placeholder?: string;
  helpText?: string;
  required?: boolean;
  min?: number;
  max?: number;
  defaultValue?: string | number | boolean;
  instruction?: string;
  options?: AIBuilderOption[];
};

export type AIBuilderStep = {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  optional?: boolean;
  hidden?: boolean;
  instruction?: string;
  blocks: AIBuilderBlock[];
};

export type AIOutputSection = {
  id: string;
  key: string;
  title: string;
  description?: string;
  type: 'text' | 'markdown' | 'prompt' | 'code' | 'table' | 'scene_collection' | 'key_value' | 'json';
  copyable?: boolean;
  downloadable?: boolean;
  instruction?: string;
};

export type AIModelDefinition = {
  id: string;
  provider: string;
  name: string;
  description?: string;
  capabilities: Array<'text' | 'image' | 'video' | 'audio' | 'document' | 'vision'>;
  tags?: string[];
  status: 'available' | 'preview' | 'unavailable';
  strengths?: string[];
};

export type PersonalAiBuilderConfig = {
  schemaVersion: 1;
  templateId?: string;
  branding: {
    name: string;
    shortDescription: string;
    description?: string;
    category?: string;
    tags: string[];
    accentColor?: string;
  };
  instructions: {
    baseInstruction: string;
    behaviorRules: string[];
    negativeInstruction?: string;
  };
  steps: AIBuilderStep[];
  output: {
    format: 'markdown' | 'plain_text' | 'json';
    sections: AIOutputSection[];
  };
  modelPolicy: {
    mode: 'auto' | 'locked' | 'user_select';
    preferredModelId?: string;
    requiredCapabilities: AIModelDefinition['capabilities'];
  };
};

export const PERSONAL_AI_MODEL_REGISTRY: AIModelDefinition[] = [
  {
    id: 'auto',
    provider: 'Lajukan',
    name: 'Model otomatis',
    description: 'Lajukan memilih provider yang tersedia dan cocok dengan input.',
    capabilities: ['text', 'image', 'vision', 'document'],
    status: 'available',
    strengths: ['Fallback', 'Vision aware'],
  },
  {
    id: 'veo3',
    provider: 'Google DeepMind',
    name: 'Veo 3',
    description: 'Target model video untuk prompt sinematik. Provider langsung belum dihubungkan.',
    capabilities: ['video'],
    status: 'preview',
    strengths: ['Cinematic quality', 'Long form'],
  },
  {
    id: 'sora',
    provider: 'OpenAI',
    name: 'Sora',
    description: 'Target model video untuk prompt realistis. Provider langsung belum dihubungkan.',
    capabilities: ['video'],
    status: 'preview',
    strengths: ['Realistic motion', 'Text adherence'],
  },
  {
    id: 'kling',
    provider: 'Kuaishou',
    name: 'Kling AI',
    description: 'Target prompt video dengan kontrol kamera dan konsistensi wajah.',
    capabilities: ['video'],
    status: 'preview',
    strengths: ['Camera control', 'Face consistency'],
  },
  {
    id: 'runway',
    provider: 'Runway ML',
    name: 'Runway Gen',
    description: 'Target prompt video/gambar kreatif.',
    capabilities: ['video', 'image'],
    status: 'preview',
    strengths: ['Creative control', 'Inpainting'],
  },
  {
    id: 'openai-vision',
    provider: 'OpenAI',
    name: 'OpenAI Vision',
    description: 'Analisis gambar produk, kemasan, dokumen visual, dan caption.',
    capabilities: ['text', 'image', 'vision'],
    status: 'available',
    strengths: ['Image understanding', 'Structured output'],
  },
  {
    id: 'ollama-qwen-vl',
    provider: 'Ollama lokal',
    name: 'Qwen VL lokal',
    description: 'Vision lokal jika model tersedia di mesin/server.',
    capabilities: ['text', 'image', 'vision'],
    status: 'available',
    strengths: ['Local', 'Private'],
  },
];

function option(
  id: string,
  label: string,
  description: string,
  instructionAppend: string,
  badge?: string,
): AIBuilderOption {
  return {
    id,
    label,
    value: id,
    description,
    instructionAppend,
    badge,
  };
}

export const PERSONAL_AI_BUILDER_TEMPLATES: Array<{
  id: string;
  name: string;
  description: string;
  quickButtons: Array<{
    label: string;
    prompt: string;
    instructionAppend: string;
  }>;
  config: PersonalAiBuilderConfig;
}> = [
  {
    id: 'google_flow_video_studio',
    name: 'Google Flow Video Studio',
    description:
      'Tool mudah untuk mengubah foto, produk, bahan jualan, atau ide konten menjadi prompt video Google Flow/Veo yang lengkap per scene.',
    quickButtons: [
      {
        label: 'Prompt Flow lengkap',
        prompt:
          'Buat prompt Google Flow/Veo lengkap dari bahan yang saya kirim. Susun cerita dan scene agar videonya enak ditonton.',
        instructionAppend:
          'Hasilkan paket lengkap untuk Google Flow/Veo: brief video, konsep cerita, hook 3 detik, master prompt, scene-by-scene prompt, camera movement, lighting, audio/VO, subtitle, transition, consistency notes, negative prompt, caption, hashtag, dan checklist produksi. Jika ada gambar, pakai gambar sebagai bahan utama dan pisahkan fakta visual dari asumsi.',
      },
      {
        label: 'Perkuat cerita',
        prompt:
          'Perkuat cerita video ini supaya lebih menarik, natural, dan cocok untuk short video.',
        instructionAppend:
          'Fokuskan pada story arc yang jelas: hook, masalah/penasaran, reveal, manfaat, bukti visual, payoff, dan CTA. Buat pacing per scene, emosi penonton, serta alasan kenapa scene itu perlu ada.',
      },
      {
        label: 'Scene dari foto produk',
        prompt:
          'Ubah foto produk ini menjadi prompt video 9:16 untuk Google Flow.',
        instructionAppend:
          'Mulai dari analisis visual foto, lalu buat 5-7 scene video vertical. Setiap scene wajib berisi durasi, visual prompt, subjek/produk, aksi, kamera, lighting, background, teks layar, voice over, sound cue, transisi, dan negative prompt. Jangan menebak merek/harga/lokasi jika tidak terlihat.',
      },
      {
        label: 'Iklan 30 detik',
        prompt:
          'Buat iklan video 30 detik dari produk atau ide ini untuk TikTok/Reels.',
        instructionAppend:
          'Buat format iklan 30 detik: 5 scene x 6 detik, hook kuat, masalah pembeli, demonstrasi visual, benefit, social proof yang tidak mengada-ada, offer/CTA, VO, subtitle, dan prompt Google Flow siap copy.',
      },
    ],
    config: {
      schemaVersion: 1,
      templateId: 'google_flow_video_studio',
      branding: {
        name: 'AI Google Flow Studio',
        shortDescription:
          'Buat scene, cerita, prompt Veo/Flow, VO, subtitle, caption, dan checklist dari foto atau ide konten.',
        description:
          'Mini-app AI untuk pelaku UMKM dan kreator yang ingin mengubah bahan mentah seperti foto produk, bahan jualan, referensi, atau ide cerita menjadi prompt video Google Flow/Veo yang detail dan siap dipakai.',
        category: 'Konten Video',
        tags: ['google-flow', 'veo', 'video', 'scene', 'umkm'],
        accentColor: '#7c3aed',
      },
      instructions: {
        baseInstruction:
          'Kamu adalah AI creative producer untuk pelaku UMKM Indonesia. Tugasmu mengubah bahan mentah user menjadi cerita video short-form dan prompt Google Flow/Veo yang sangat jelas, visual, dan siap dipakai.',
        behaviorRules: [
          'Mulai dari bahan baku user: foto, produk, bahan jualan, ide, target pembeli, dan konteks bisnis.',
          'Jika ada gambar, analisis hanya fakta visual yang terlihat sebelum membuat cerita atau prompt.',
          'Buat cerita yang punya hook, alasan penonton bertahan, payoff, dan CTA yang natural.',
          'Setiap scene harus punya durasi, tujuan cerita, visual prompt, subjek, aksi, kamera, lighting, background, teks layar, voice over, sound cue, transisi, dan catatan konsistensi.',
          'Optimalkan untuk video vertical 9:16 kecuali user memilih format lain.',
          'Pisahkan fakta, asumsi kreatif, dan hal yang perlu user konfirmasi.',
        ],
        negativeInstruction:
          'Jangan mengarang merek, harga, testimoni, izin, lokasi, komposisi produk, atau klaim hasil. Jangan memasukkan database schema, folder structure, atau detail SaaS internal kecuali user meminta.',
      },
      steps: [
        {
          id: 'source',
          title: 'Bahan Baku',
          description: 'Masukkan foto, produk, ide, atau referensi utama.',
          icon: 'image',
          instruction:
            'Jadikan bagian ini sebagai sumber utama. Bila foto tersedia, analisis visual dulu sebelum membuat scene.',
          blocks: [
            {
              id: 'source_image',
              type: 'image_upload',
              label: 'Foto / referensi visual',
              variable: 'source_image',
              helpText: 'Opsional, tapi sangat membantu untuk produk, kemasan, makanan, tempat, atau bahan jualan.',
            },
            {
              id: 'raw_idea',
              type: 'textarea',
              label: 'Produk, bahan, atau ide',
              variable: 'raw_idea',
              required: true,
              placeholder:
                'Contoh: foto kopi susu botol 250ml untuk iklan Reels, target anak kampus dan pekerja kantor.',
            },
            {
              id: 'must_include',
              type: 'textarea',
              label: 'Hal yang wajib masuk',
              variable: 'must_include',
              placeholder:
                'Contoh: rasa gula aren, botol dingin, harga jangan disebut dulu, CTA chat WhatsApp.',
            },
          ],
        },
        {
          id: 'goal',
          title: 'Tujuan Video',
          description: 'Pilih jenis konten dan platform.',
          icon: 'target',
          instruction:
            'Tujuan video menentukan angle cerita, ritme scene, CTA, dan bentuk prompt akhir.',
          blocks: [
            {
              id: 'content_goal',
              type: 'single_choice',
              label: 'Tujuan konten',
              variable: 'content_goal',
              required: true,
              options: [
                option(
                  'product_ads',
                  'Iklan Produk',
                  'Mendorong orang tertarik dan menghubungi penjual.',
                  'Gunakan struktur problem, visual proof, benefit, offer, dan CTA. Hindari klaim yang tidak bisa diverifikasi.',
                  'Rekomendasi',
                ),
                option(
                  'storytelling',
                  'Storytelling',
                  'Cerita pendek yang membangun rasa penasaran.',
                  'Gunakan setup, konflik kecil, reveal, payoff, dan CTA lembut.',
                ),
                option(
                  'interesting_fact',
                  'Fakta Menarik',
                  'Video edukasi/fakta yang mudah dishare.',
                  'Gunakan hook fakta, visual pembanding, penjelasan sederhana, dan payoff.',
                ),
                option(
                  'product_explainer',
                  'Penjelasan Produk',
                  'Menjelaskan bahan, fungsi, cara pakai, atau keunggulan.',
                  'Fokus pada visual detail, demonstrasi, dan penjelasan yang jujur.',
                ),
              ],
            },
            {
              id: 'platform',
              type: 'single_choice',
              label: 'Platform',
              variable: 'platform',
              defaultValue: 'tiktok',
              options: [
                option(
                  'tiktok',
                  'TikTok',
                  'Pacing cepat, hook kuat, subtitle jelas.',
                  'Optimalkan 3 detik pertama, visual cepat, dan CTA singkat.',
                ),
                option(
                  'reels',
                  'Instagram Reels',
                  'Visual clean dan mudah disimpan/dibagikan.',
                  'Optimalkan opening visual, caption ringkas, dan estetika brand.',
                ),
                option(
                  'shorts',
                  'YouTube Shorts',
                  'Retensi tinggi dan payoff jelas.',
                  'Optimalkan alur tanya-jawab, retention loop, dan akhir yang jelas.',
                ),
              ],
            },
            {
              id: 'audience',
              type: 'text',
              label: 'Target penonton',
              variable: 'audience',
              placeholder: 'Contoh: ibu rumah tangga, reseller makanan, anak kampus, pemilik warung.',
            },
          ],
        },
        {
          id: 'story',
          title: 'Cerita',
          description: 'Atur hook, konflik, manfaat, dan CTA.',
          icon: 'sparkles',
          instruction:
            'Bangun cerita yang terasa natural, bukan hanya daftar fitur. Setiap scene harus punya fungsi cerita.',
          blocks: [
            {
              id: 'hook_style',
              type: 'single_choice',
              label: 'Gaya hook',
              variable: 'hook_style',
              options: [
                option(
                  'curiosity',
                  'Bikin penasaran',
                  'Mulai dengan pertanyaan atau kejutan visual.',
                  'Buka dengan curiosity gap yang relevan dan tidak clickbait berlebihan.',
                  'Rekomendasi',
                ),
                option(
                  'problem',
                  'Masalah sehari-hari',
                  'Mulai dari pain point pembeli.',
                  'Buka dengan masalah nyata, lalu tunjukkan produk sebagai solusi yang masuk akal.',
                ),
                option(
                  'before_after',
                  'Before / After',
                  'Kontras kondisi sebelum dan sesudah.',
                  'Buat visual perbandingan yang jelas tanpa klaim palsu.',
                ),
                option(
                  'cinematic',
                  'Cinematic reveal',
                  'Membangun mood dan reveal produk.',
                  'Mulai dengan detail visual/macro shot, lalu reveal produk secara dramatis.',
                ),
              ],
            },
            {
              id: 'main_message',
              type: 'textarea',
              label: 'Pesan utama',
              variable: 'main_message',
              placeholder: 'Contoh: kopi ini praktis untuk pagi sibuk, rasanya creamy, dan bisa pesan untuk kantor.',
            },
            {
              id: 'cta',
              type: 'text',
              label: 'CTA',
              variable: 'cta',
              placeholder: 'Contoh: Chat untuk order, simpan dulu, cek katalog, tanya stok.',
            },
          ],
        },
        {
          id: 'visual',
          title: 'Visual',
          description: 'Gaya, mood, kamera, dan lighting.',
          icon: 'palette',
          instruction:
            'Pastikan gaya visual mendukung produk dan konsisten antar scene.',
          blocks: [
            {
              id: 'visual_style',
              type: 'single_choice',
              label: 'Style visual',
              variable: 'visual_style',
              defaultValue: 'realistic_cinematic',
              options: [
                option(
                  'realistic_cinematic',
                  'Realistic Cinematic',
                  'Realistis, detail produk jelas, lighting rapi.',
                  'Gunakan visual realistis, detail tekstur terlihat, lighting cinematic, depth of field natural.',
                  'Rekomendasi',
                ),
                option(
                  'clean_commercial',
                  'Clean Commercial',
                  'Iklan produk bersih seperti brand modern.',
                  'Gunakan background bersih, product hero shot, lighting studio, warna brand konsisten.',
                ),
                option(
                  'animation',
                  'Animation',
                  'Animasi modern dan ekspresif.',
                  'Gunakan animasi modern, karakter/produk konsisten, warna hidup, motion halus.',
                ),
                option(
                  'documentary',
                  'Mini Documentary',
                  'Terasa nyata, humanis, dan lokal.',
                  'Gunakan gaya dokumenter pendek, handheld halus, lokasi natural, momen manusiawi.',
                ),
              ],
            },
            {
              id: 'mood',
              type: 'single_choice',
              label: 'Mood',
              variable: 'mood',
              options: [
                option('warm', 'Hangat', 'Ramah, dekat, dan manusiawi.', 'Gunakan tone hangat, natural, dan terpercaya.'),
                option('fresh', 'Fresh', 'Segar, energik, modern.', 'Gunakan pacing cepat, warna segar, lighting terang.'),
                option('premium', 'Premium', 'Elegan dan meyakinkan.', 'Gunakan komposisi rapi, detail close-up, lighting premium.'),
                option('epic', 'Epic', 'Lebih dramatis dan sinematik.', 'Gunakan camera movement dinamis, music build-up, dan reveal kuat.'),
              ],
            },
            {
              id: 'camera',
              type: 'multi_choice',
              label: 'Gerakan kamera',
              variable: 'camera',
              options: [
                option('macro', 'Macro close-up', 'Detail tekstur produk.', 'Tambahkan macro close-up untuk detail bahan/tekstur.'),
                option('slow_push', 'Slow push-in', 'Membangun fokus.', 'Gunakan slow push-in untuk reveal atau CTA.'),
                option('tracking', 'Tracking shot', 'Mengikuti aksi.', 'Gunakan tracking shot untuk gerakan manusia/produk.'),
                option('top_down', 'Top-down', 'Cocok untuk makanan/bahan.', 'Gunakan top-down untuk komposisi bahan, packing, atau proses.'),
              ],
            },
          ],
        },
        {
          id: 'production',
          title: 'Produksi Flow',
          description: 'Durasi, scene, format, dan model target.',
          icon: 'settings',
          instruction:
            'Gunakan pengaturan ini sebagai batas produksi prompt. Jangan membuat output terlalu panjang jika durasi pendek.',
          blocks: [
            {
              id: 'scene_count',
              type: 'number',
              label: 'Jumlah scene',
              variable: 'scene_count',
              defaultValue: 5,
              min: 3,
              max: 10,
            },
            {
              id: 'total_duration',
              type: 'single_choice',
              label: 'Total durasi',
              variable: 'total_duration',
              defaultValue: '30s',
              options: [
                option('15s', '15 detik', 'Iklan cepat.', 'Buat 3-5 scene singkat dengan hook sangat cepat.'),
                option('30s', '30 detik', 'Paling aman untuk iklan pendek.', 'Buat 5 scene x 6 detik atau struktur setara.', 'Rekomendasi'),
                option('45s', '45 detik', 'Lebih naratif.', 'Buat 6-8 scene dengan storytelling lebih lengkap.'),
                option('60s', '60 detik', 'Edukasi/story panjang.', 'Buat 7-10 scene dengan pacing jelas.'),
              ],
            },
            {
              id: 'aspect_ratio',
              type: 'single_choice',
              label: 'Aspect ratio',
              variable: 'aspect_ratio',
              defaultValue: '9:16',
              options: [
                option('9:16', '9:16 Vertical', 'TikTok/Reels/Shorts.', 'Gunakan komposisi vertical, safe area subtitle, dan product framing jelas.', 'Rekomendasi'),
                option('1:1', '1:1 Square', 'Feed atau katalog.', 'Gunakan framing square yang seimbang.'),
                option('16:9', '16:9 Landscape', 'YouTube/website.', 'Gunakan komposisi landscape dan ruang visual yang lebih luas.'),
              ],
            },
            {
              id: 'model',
              type: 'model_select',
              label: 'Model target',
              variable: 'ai_model',
              defaultValue: 'veo3',
            },
            {
              id: 'avoid',
              type: 'textarea',
              label: 'Yang harus dihindari',
              variable: 'avoid',
              placeholder: 'Contoh: jangan ada teks kecil, jangan sebut harga, jangan ubah bentuk botol.',
            },
          ],
        },
      ],
      output: {
        format: 'markdown',
        sections: [
          {
            id: 'brief',
            key: 'video_brief',
            title: 'Brief Video',
            type: 'markdown',
            copyable: true,
            instruction:
              'Ringkas tujuan, target penonton, pesan utama, visual direction, durasi, format, dan asumsi yang dipakai.',
          },
          {
            id: 'visual_facts',
            key: 'visual_facts',
            title: 'Fakta Visual / Bahan Utama',
            type: 'markdown',
            copyable: true,
            instruction:
              'Jika ada gambar, tulis hal yang terlihat jelas. Jika tidak ada gambar, tulis bahan input user dan hal yang perlu dikonfirmasi.',
          },
          {
            id: 'master_prompt',
            key: 'master_prompt',
            title: 'Master Prompt Google Flow',
            type: 'prompt',
            copyable: true,
            downloadable: true,
            instruction:
              'Satu prompt utama yang bisa ditempel ke Google Flow/Veo, lengkap dengan style, mood, ratio, consistency, dan production constraints.',
          },
          {
            id: 'scenes',
            key: 'scene_prompts',
            title: 'Scene-by-Scene Prompt',
            type: 'scene_collection',
            copyable: true,
            downloadable: true,
            instruction:
              'Setiap scene berisi durasi, tujuan cerita, visual prompt, subjek/produk, aksi, kamera, lighting, background, teks layar, VO, sound, transisi, consistency notes, dan negative prompt.',
          },
          {
            id: 'voice',
            key: 'voice_over_subtitle',
            title: 'Voice Over + Subtitle',
            type: 'markdown',
            copyable: true,
          },
          {
            id: 'negative',
            key: 'negative_prompt',
            title: 'Negative Prompt',
            type: 'prompt',
            copyable: true,
          },
          {
            id: 'caption',
            key: 'caption_hashtag',
            title: 'Caption + Hashtag',
            type: 'markdown',
            copyable: true,
          },
          {
            id: 'checklist',
            key: 'production_checklist',
            title: 'Checklist Produksi',
            type: 'markdown',
            copyable: true,
          },
        ],
      },
      modelPolicy: {
        mode: 'user_select',
        preferredModelId: 'veo3',
        requiredCapabilities: ['text', 'vision', 'video'],
      },
    },
  },
  {
    id: 'product_photo_analyzer',
    name: 'AI Analisis Foto Produk',
    description: 'Untuk upload foto produk, lalu AI menjelaskan objek, bahan, warna, kondisi, target pembeli, dan ide konten.',
    quickButtons: [
      {
        label: 'Analisis foto produk',
        prompt: 'Tolong analisis foto produk ini dan jelaskan produk yang terlihat secara jelas.',
        instructionAppend:
          'Jika ada gambar, jelaskan objek utama, warna, bahan/tekstur yang terlihat, kemasan/label yang terbaca, kondisi visual, kemungkinan fungsi, target pembeli, keunggulan visual, kekurangan foto, dan rekomendasi caption/iklan. Jangan menebak merek, harga, lokasi, atau klaim yang tidak tampak.',
      },
      {
        label: 'Deskripsi marketplace',
        prompt: 'Buat deskripsi marketplace dari foto dan informasi produk ini.',
        instructionAppend:
          'Hasilkan nama produk alternatif, deskripsi singkat, bullet benefit, spesifikasi yang terlihat, catatan hal yang perlu dikonfirmasi, dan CTA WhatsApp. Pisahkan fakta visual dari asumsi.',
      },
      {
        label: 'Scene iklan Flow',
        prompt: 'Buat scene iklan vertical untuk Google Flow dari produk ini.',
        instructionAppend:
          'Buat output untuk video 9:16: konsep, hook 3 detik, 5 scene, prompt visual per scene, camera movement, lighting, voice over, subtitle, CTA, negative prompt, dan catatan konsistensi produk.',
      },
    ],
    config: {
      schemaVersion: 1,
      templateId: 'product_photo_analyzer',
      branding: {
        name: 'AI Analisis Produk',
        shortDescription: 'Upload foto produk, dapatkan deskripsi, insight visual, dan bahan konten.',
        description:
          'Mini-app AI untuk membantu UMKM memahami foto produk dan mengubahnya menjadi deskripsi jualan, caption, atau prompt video.',
        category: 'UMKM',
        tags: ['produk', 'foto', 'marketplace', 'iklan'],
        accentColor: '#16a34a',
      },
      instructions: {
        baseInstruction:
          'Kamu adalah AI analisis produk untuk pelaku UMKM Indonesia. Analisis hanya hal yang terlihat pada gambar dan informasi yang diberikan user.',
        behaviorRules: [
          'Pisahkan fakta visual dari asumsi.',
          'Jika gambar buram atau tidak cukup, sebutkan keterbatasannya dengan jelas.',
          'Jangan menebak merek, harga, legalitas, lokasi, atau kandungan produk.',
          'Berikan output praktis untuk jualan, konten, dan perbaikan foto.',
        ],
        negativeInstruction:
          'Jangan membuat klaim medis, klaim pasti laku, harga palsu, atau identitas produk yang tidak terlihat.',
      },
      steps: [
        {
          id: 'media',
          title: 'Media Produk',
          description: 'Upload foto dan jelaskan konteks singkat.',
          icon: 'image',
          instruction: 'Gunakan gambar sebagai sumber utama analisis visual.',
          blocks: [
            {
              id: 'product_image',
              type: 'image_upload',
              label: 'Foto produk',
              variable: 'product_image',
              required: true,
              helpText: 'JPG/PNG/WEBP yang jelas, idealnya produk memenuhi frame.',
            },
            {
              id: 'known_context',
              type: 'textarea',
              label: 'Konteks tambahan',
              variable: 'context',
              placeholder: 'Contoh: ini kemasan keripik singkong 250g untuk reseller.',
            },
          ],
        },
        {
          id: 'goal',
          title: 'Tujuan Output',
          description: 'Pilih hasil yang ingin dibuat.',
          icon: 'target',
          instruction: 'Pilihan tujuan menentukan struktur output akhir.',
          blocks: [
            {
              id: 'output_goal',
              type: 'single_choice',
              label: 'Output',
              variable: 'output_goal',
              required: true,
              options: [
                option('description', 'Deskripsi produk', 'Untuk marketplace dan katalog.', 'Fokus pada deskripsi jualan yang jelas, benefit, spesifikasi terlihat, dan CTA.'),
                option('content', 'Ide konten', 'Untuk Reels/TikTok/Shorts.', 'Fokus pada hook, angle konten, script pendek, caption, hashtag, dan shot list.'),
                option('flow_video', 'Prompt Google Flow', 'Prompt scene video 9:16.', 'Fokus pada prompt video multi-scene, camera movement, lighting, voice over, subtitle, dan negative prompt.', 'Rekomendasi'),
              ],
            },
          ],
        },
      ],
      output: {
        format: 'markdown',
        sections: [
          { id: 'visual', key: 'visual_analysis', title: 'Analisis Visual', type: 'markdown', copyable: true },
          { id: 'selling', key: 'selling_copy', title: 'Copy Jualan', type: 'markdown', copyable: true },
          { id: 'content', key: 'content_plan', title: 'Konten / Scene', type: 'scene_collection', copyable: true, downloadable: true },
        ],
      },
      modelPolicy: {
        mode: 'auto',
        requiredCapabilities: ['vision', 'text'],
      },
    },
  },
  {
    id: 'creative_prompt_generator',
    name: 'AI Prompt Generator Studio',
    description: 'Wizard konten seperti contoh Kreatif Fakta Menarik Digital: konten, output, style, topik, produksi, platform, model.',
    quickButtons: [
      {
        label: 'Generate prompt video',
        prompt: 'Buat full package prompt AI untuk konten video vertical dari konfigurasi ini.',
        instructionAppend:
          'Hasilkan Master Prompt, PRD singkat, scene prompts, character, environment, camera, lighting, negative prompt, thumbnail, voice over, subtitle, caption, CTA, hashtag, SEO, viral engine, dan JSON configuration. Jangan sertakan schema database kecuali diminta.',
      },
      {
        label: 'Google Flow scene',
        prompt: 'Buat prompt Google Flow/Veo untuk video 9:16.',
        instructionAppend:
          'Output harus berupa scene-by-scene prompt yang jelas: visual, subject, action, camera, lighting, duration, voice over, subtitle, transition, consistency notes, negative prompt.',
      },
    ],
    config: {
      schemaVersion: 1,
      templateId: 'creative_prompt_generator',
      branding: {
        name: 'AI Prompt Generator Studio',
        shortDescription: 'Bangun prompt konten, image, video, caption, SEO, dan full package produksi.',
        category: 'Konten',
        tags: ['prompt', 'video', 'caption', 'seo'],
        accentColor: '#2563eb',
      },
      instructions: {
        baseInstruction:
          'Kamu adalah AI prompt generator profesional untuk konten digital. Buat output yang siap dipakai, rapi, dan tidak mengada-ada.',
        behaviorRules: [
          'Gunakan struktur sesuai pilihan user.',
          'Jangan memasukkan bagian teknis aplikasi seperti database schema kecuali user meminta.',
          'Optimalkan untuk platform dan model yang dipilih.',
          'Beri negative prompt dan production checklist.',
        ],
        negativeInstruction:
          'Jangan membuat klaim palsu, watermark, teks acak, identitas merek tidak sah, atau instruksi berbahaya.',
      },
      steps: [
        {
          id: 'content',
          title: 'Konten',
          description: 'Pilih tipe konten.',
          icon: 'sparkles',
          blocks: [
            {
              id: 'content_type',
              type: 'single_choice',
              label: 'Tipe konten',
              variable: 'content_type',
              required: true,
              options: [
                option('interesting_facts', 'Fakta Menarik', 'Fakta mengejutkan dan mudah dipahami.', 'Buat konten fakta menarik dengan hook kuat, sumber/konteks jelas, dan akhir yang bikin penonton ingin share.'),
                option('storytelling', 'Storytelling', 'Narasi cerita yang memikat.', 'Gunakan struktur naratif: setup, konflik, reveal, payoff, CTA.'),
                option('education', 'Edukasi', 'Konten pembelajaran.', 'Buat edukasi praktis, step-by-step, mudah diikuti, dengan contoh nyata.'),
                option('product_promo', 'Promosi Produk', 'Promosi produk langsung.', 'Fokus pada masalah user, benefit produk, bukti visual, offer, dan CTA.'),
                option('review', 'Review Produk', 'Ulasan dan penilaian produk.', 'Buat review seimbang: kelebihan, kekurangan, cocok untuk siapa, dan keputusan beli.'),
              ],
            },
          ],
        },
        {
          id: 'output',
          title: 'Output',
          description: 'Pilih format hasil.',
          icon: 'package',
          blocks: [
            {
              id: 'output_type',
              type: 'single_choice',
              label: 'Tipe output',
              variable: 'output_type',
              required: true,
              options: [
                option('video_prompt', 'Video Prompt', 'Prompt generasi video AI.', 'Hasilkan prompt video lengkap dengan scene, camera, lighting, motion, dan negative prompt.'),
                option('image_prompt', 'Image Prompt', 'Prompt gambar AI.', 'Hasilkan prompt gambar detail: subject, composition, style, lighting, camera, negative prompt.'),
                option('full_package', 'Full Package', 'Semua output dalam satu paket.', 'Hasilkan paket lengkap: brief, prompt, scenes, VO, caption, hashtag, SEO, thumbnail, checklist.', 'Rekomendasi'),
              ],
            },
          ],
        },
        {
          id: 'style',
          title: 'Style',
          description: 'Gaya visual.',
          icon: 'palette',
          blocks: [
            {
              id: 'visual_style',
              type: 'single_choice',
              label: 'Visual style',
              variable: 'visual_style',
              options: [
                option('animation', 'Animation', 'Kartun modern dan ekspresif.', 'Gunakan visual animation modern, bersih, ekspresif, warna konsisten, karakter stabil.'),
                option('realistic', 'Realistic', 'Realistis dan cinematic.', 'Gunakan detail realistis, lighting natural/cinematic, tekstur jelas, motion natural.'),
                option('miniature', 'Miniature', 'Diorama miniatur.', 'Gunakan gaya miniature diorama, depth of field, skala kecil, detail rapi.'),
                option('3d', '3D', '3D stylized.', 'Gunakan 3D stylized, material clean, lighting studio, karakter/produk konsisten.'),
              ],
            },
          ],
        },
        {
          id: 'production',
          title: 'Produksi',
          description: 'Scene, durasi, platform, model.',
          icon: 'settings',
          blocks: [
            { id: 'topic', type: 'text', label: 'Topik', variable: 'topic', required: true, placeholder: 'Contoh: bahan baku bakso ikan, kopi susu, mesin sealer' },
            { id: 'scene_count', type: 'number', label: 'Jumlah scene', variable: 'scene_count', defaultValue: 5, min: 1, max: 12 },
            { id: 'platform', type: 'single_choice', label: 'Platform', variable: 'platform', options: [
              option('tiktok', 'TikTok', 'Short vertical video.', 'Optimalkan hook 3 detik pertama, subtitle cepat, dan CTA singkat.'),
              option('reels', 'Instagram Reels', 'Short video Instagram.', 'Optimalkan visual opening, caption ringkas, dan shareability.'),
              option('youtube_shorts', 'YouTube Shorts', 'Shorts vertical.', 'Optimalkan retention, search intent, dan payoff jelas.'),
            ] },
            { id: 'model', type: 'model_select', label: 'AI model target', variable: 'ai_model', defaultValue: 'auto' },
            { id: 'reference', type: 'textarea', label: 'Referensi opsional', variable: 'reference', placeholder: 'Link, gaya channel, atau contoh output yang disukai.' },
          ],
        },
      ],
      output: {
        format: 'markdown',
        sections: [
          { id: 'master', key: 'master_prompt', title: 'Master Prompt', type: 'prompt', copyable: true },
          { id: 'prd', key: 'prd', title: 'PRD Singkat', type: 'markdown', copyable: true },
          { id: 'scenes', key: 'scene_prompts', title: 'Scene Prompts', type: 'scene_collection', copyable: true, downloadable: true },
          { id: 'seo', key: 'seo', title: 'SEO dan Viral Engine', type: 'markdown', copyable: true },
        ],
      },
      modelPolicy: {
        mode: 'user_select',
        requiredCapabilities: ['text', 'video'],
      },
    },
  },
  {
    id: 'umkm_caption',
    name: 'AI Caption UMKM',
    description: 'Buat caption, hook, hashtag, dan CTA dari produk atau bahan jualan.',
    quickButtons: [
      {
        label: 'Caption jualan',
        prompt: 'Buat caption jualan untuk produk saya.',
        instructionAppend:
          'Buat 5 variasi caption: soft selling, hard selling, edukatif, cerita pelanggan, dan promo. Sertakan hook, CTA, dan hashtag relevan.',
      },
    ],
    config: {
      schemaVersion: 1,
      templateId: 'umkm_caption',
      branding: {
        name: 'AI Caption UMKM',
        shortDescription: 'Buat caption dan CTA jualan lokal dengan cepat.',
        category: 'Pemasaran',
        tags: ['caption', 'jualan', 'umkm'],
        accentColor: '#0f766e',
      },
      instructions: {
        baseInstruction:
          'Kamu adalah AI copywriter UMKM Indonesia. Bantu buat caption jualan yang jujur, lokal, dan mudah dipakai.',
        behaviorRules: ['Jangan overclaim.', 'Gunakan bahasa natural.', 'Berikan beberapa variasi.'],
      },
      steps: [
        {
          id: 'brief',
          title: 'Brief',
          description: 'Masukkan produk dan tujuan caption.',
          blocks: [
            { id: 'product', type: 'text', label: 'Produk', variable: 'product', required: true },
            { id: 'audience', type: 'text', label: 'Target pembeli', variable: 'audience' },
            { id: 'offer', type: 'text', label: 'Promo/CTA', variable: 'offer' },
          ],
        },
      ],
      output: {
        format: 'markdown',
        sections: [
          { id: 'captions', key: 'captions', title: 'Caption', type: 'markdown', copyable: true },
          { id: 'hashtags', key: 'hashtags', title: 'Hashtag', type: 'text', copyable: true },
        ],
      },
      modelPolicy: { mode: 'auto', requiredCapabilities: ['text'] },
    },
  },
];

export function createDefaultPersonalAiBuilderConfig(): PersonalAiBuilderConfig {
  // Never hand callers the mutable template singleton. Builder forms mutate
  // nested arrays/objects heavily, so each agent needs an isolated copy.
  return structuredClone(PERSONAL_AI_BUILDER_TEMPLATES[0]!.config);
}

function cleanText(value: unknown, maxLength: number): string {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\u0000/g, '')
    .replace(/\r\n/g, '\n')
    .replace(/[\u0001-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanAccentColor(value: unknown, fallback?: string) {
  const color = cleanText(value, 32);
  if (/^#[0-9a-f]{6}$/i.test(color) || /^#[0-9a-f]{3}$/i.test(color)) {
    return color.toLowerCase();
  }
  return fallback && (/^#[0-9a-f]{6}$/i.test(fallback) || /^#[0-9a-f]{3}$/i.test(fallback))
    ? fallback.toLowerCase()
    : undefined;
}

function finiteNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

function cleanStringList(value: unknown, limit: number, maxLength: number): string[] {
  if (!Array.isArray(value)) return [];
  const result: string[] = [];
  const seen = new Set<string>();
  for (const item of value) {
    const text = cleanText(item, maxLength);
    const key = text.toLocaleLowerCase('id-ID');
    if (!text || seen.has(key)) continue;
    seen.add(key);
    result.push(text);
    if (result.length >= limit) break;
  }
  return result;
}

function cleanOptions(value: unknown): AIBuilderOption[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
      const label = cleanText(record.label, 80);
      const valueText = cleanText(record.value, 120) || label.toLowerCase().replace(/\s+/g, '_');
      if (!label || !valueText) return null;
      return {
        id: cleanText(record.id, 80) || `option_${index + 1}`,
        label,
        value: valueText,
        description: cleanText(record.description, 220) || undefined,
        icon: cleanText(record.icon, 40) || undefined,
        badge: cleanText(record.badge, 40) || undefined,
        instructionAppend: cleanText(record.instructionAppend, 900) || undefined,
        negativeInstruction: cleanText(record.negativeInstruction, 500) || undefined,
        nextStepId: cleanText(record.nextStepId, 80) || undefined,
        autoNext: record.autoNext === true,
      } satisfies AIBuilderOption;
    })
    .filter(Boolean)
    .slice(0, 40) as AIBuilderOption[];
}

function cleanBlocks(value: unknown): AIBuilderBlock[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item, index) => {
      const record = item && typeof item === 'object' && !Array.isArray(item)
        ? (item as Record<string, unknown>)
        : {};
      const label = cleanText(record.label, 100);
      if (!label) return null;
      const type = [
        'heading',
        'paragraph',
        'notice',
        'single_choice',
        'multi_choice',
        'text',
        'textarea',
        'number',
        'slider',
        'toggle',
        'image_upload',
        'document_upload',
        'model_select',
        'summary',
      ].includes(String(record.type))
        ? (record.type as AIBuilderBlockType)
        : 'text';
      return {
        id: cleanText(record.id, 80) || `block_${index + 1}`,
        type,
        label,
        variable: cleanText(record.variable, 80) || undefined,
        placeholder: cleanText(record.placeholder, 180) || undefined,
        helpText: cleanText(record.helpText, 260) || undefined,
        required: record.required === true,
        min: finiteNumber(record.min),
        max: finiteNumber(record.max),
        defaultValue:
          typeof record.defaultValue === 'string' ||
            typeof record.defaultValue === 'number' ||
            typeof record.defaultValue === 'boolean'
            ? record.defaultValue
            : undefined,
        instruction: cleanText(record.instruction, 700) || undefined,
        options: cleanOptions(record.options),
      } satisfies AIBuilderBlock;
    })
    .filter(Boolean)
    .slice(0, 80) as AIBuilderBlock[];
}

export function sanitizePersonalAiBuilderConfig(value: unknown): PersonalAiBuilderConfig {
  const fallback = createDefaultPersonalAiBuilderConfig();
  const input = value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
  const branding = input.branding && typeof input.branding === 'object' && !Array.isArray(input.branding)
    ? (input.branding as Record<string, unknown>)
    : {};
  const instructions =
    input.instructions && typeof input.instructions === 'object' && !Array.isArray(input.instructions)
      ? (input.instructions as Record<string, unknown>)
      : {};
  const output = input.output && typeof input.output === 'object' && !Array.isArray(input.output)
    ? (input.output as Record<string, unknown>)
    : {};
  const modelPolicy =
    input.modelPolicy && typeof input.modelPolicy === 'object' && !Array.isArray(input.modelPolicy)
      ? (input.modelPolicy as Record<string, unknown>)
      : {};
  const steps = Array.isArray(input.steps)
    ? input.steps
      .map((step, index) => {
        const record = step && typeof step === 'object' && !Array.isArray(step)
          ? (step as Record<string, unknown>)
          : {};
        const title = cleanText(record.title, 90);
        if (!title) return null;
        return {
          id: cleanText(record.id, 80) || `step_${index + 1}`,
          title,
          description: cleanText(record.description, 220) || undefined,
          icon: cleanText(record.icon, 40) || undefined,
          optional: record.optional === true,
          hidden: record.hidden === true,
          instruction: cleanText(record.instruction, 900) || undefined,
          blocks: cleanBlocks(record.blocks),
        } satisfies AIBuilderStep;
      })
      .filter(Boolean)
      .slice(0, 12) as AIBuilderStep[]
    : fallback.steps;

  return {
    schemaVersion: 1,
    templateId: cleanText(input.templateId, 80) || fallback.templateId,
    branding: {
      name: cleanText(branding.name, 90) || fallback.branding.name,
      shortDescription: cleanText(branding.shortDescription, 220) || fallback.branding.shortDescription,
      description: cleanText(branding.description, 1200) || undefined,
      category: cleanText(branding.category, 80) || undefined,
      tags: cleanStringList(branding.tags, 12, 40),
      accentColor: cleanAccentColor(
        branding.accentColor,
        fallback.branding.accentColor,
      ),
    },
    instructions: {
      baseInstruction:
        cleanText(instructions.baseInstruction, 3000) ||
        fallback.instructions.baseInstruction,
      behaviorRules: cleanStringList(instructions.behaviorRules, 20, 220),
      negativeInstruction: cleanText(instructions.negativeInstruction, 1600) || undefined,
    },
    steps,
    output: {
      format: output.format === 'json' || output.format === 'plain_text' ? output.format : 'markdown',
      sections: Array.isArray(output.sections)
        ? output.sections
          .map((section, index) => {
            const record =
              section && typeof section === 'object' && !Array.isArray(section)
                ? (section as Record<string, unknown>)
                : {};
            const title = cleanText(record.title, 90);
            if (!title) return null;
            return {
              id: cleanText(record.id, 80) || `section_${index + 1}`,
              key: cleanText(record.key, 80) || `section_${index + 1}`,
              title,
              description: cleanText(record.description, 180) || undefined,
              type: ['text', 'markdown', 'prompt', 'code', 'table', 'scene_collection', 'key_value', 'json'].includes(String(record.type))
                ? (record.type as AIOutputSection['type'])
                : 'markdown',
              copyable: record.copyable !== false,
              downloadable: record.downloadable === true,
              instruction: cleanText(record.instruction, 700) || undefined,
            } satisfies AIOutputSection;
          })
          .filter(Boolean)
          .slice(0, 24) as AIOutputSection[]
        : fallback.output.sections,
    },
    modelPolicy: {
      mode:
        modelPolicy.mode === 'locked' || modelPolicy.mode === 'user_select'
          ? modelPolicy.mode
          : 'auto',
      preferredModelId: cleanText(modelPolicy.preferredModelId, 80) || undefined,
      requiredCapabilities: (() => {
        const capabilities = cleanStringList(
          modelPolicy.requiredCapabilities,
          6,
          30,
        ).filter(value =>
          ['text', 'image', 'video', 'audio', 'document', 'vision'].includes(value),
        ) as AIModelDefinition['capabilities'];
        return capabilities.length > 0
          ? capabilities
          : [...fallback.modelPolicy.requiredCapabilities];
      })(),
    },
  };
}
