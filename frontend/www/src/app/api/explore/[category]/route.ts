import { NextRequest, NextResponse } from 'next/server';

import {
  getExploreCategoryBySlug,
  type LajukanExploreCategory,
} from '@/lib/discovery/lajukanCategories';
import {
  type ExploreCategoryResponse,
  type ExploreFaq,
  type ExploreGuide,
  unavailableExploreGroup,
} from '@/lib/explore/exploreData';
import type {
  GlobalSearchGroup,
  GlobalSearchItem,
  GlobalSearchResponse,
} from '@/lib/search/globalSearch';
import {
  mapCommunityGroup,
  mapCommunityPost,
  mapVideo,
} from '@/lib/search/socialSearchMappers';
import { getInternalWwwOrigin } from '@/lib/server/internalWwwOrigin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type JsonRecord = Record<string, unknown>;

type InternalFetchResult = {
  ok: boolean;
  payload: unknown;
};

function asRecord(value: unknown): JsonRecord | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  return value as JsonRecord;
}

function asArray(value: unknown): JsonRecord[] {
  return Array.isArray(value)
    ? value.map(asRecord).filter((item): item is JsonRecord => Boolean(item))
    : [];
}

function forwardedHeaders(req: NextRequest): Headers {
  const headers = new Headers();
  const cookie = req.headers.get('cookie');
  const authorization = req.headers.get('authorization');
  const forwardedFor = req.headers.get('x-forwarded-for');
  if (cookie) headers.set('cookie', cookie);
  if (authorization) headers.set('authorization', authorization);
  if (forwardedFor) headers.set('x-forwarded-for', forwardedFor);
  return headers;
}

async function fetchInternalJson(
  req: NextRequest,
  path: string,
): Promise<InternalFetchResult> {
  try {
    const response = await fetch(new URL(path, getInternalWwwOrigin(req)), {
      headers: forwardedHeaders(req),
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    return {
      ok: response.ok,
      payload: await response.json().catch(() => null),
    };
  } catch {
    return { ok: false, payload: null };
  }
}

function exploreGroup(
  items: Array<GlobalSearchItem | null>,
  available: boolean,
): GlobalSearchGroup {
  const unique = new Map<string, GlobalSearchItem>();
  for (const item of items) {
    if (item) unique.set(`${item.kind}:${item.id}`, item);
  }
  const normalized = Array.from(unique.values());
  return {
    items: normalized,
    total: normalized.length,
    nextCursor: null,
    available,
    error: available ? null : 'section_unavailable',
  };
}

async function loadSocialExploreGroups(req: NextRequest): Promise<{
  groups: GlobalSearchResponse['groups'];
  communityAvailable: boolean;
  videosAvailable: boolean;
}> {
  const [communityGroupsResult, communityFeedResult, videosResult] =
    await Promise.all([
      fetchInternalJson(req, '/api/community/groups?limit=12'),
      fetchInternalJson(req, '/api/community/feed?limit=12'),
      fetchInternalJson(req, '/api/reels?limit=12'),
    ]);

  const groupPayload = asRecord(communityGroupsResult.payload);
  const feedPayload = asRecord(communityFeedResult.payload);
  const videosPayload = asRecord(videosResult.payload);
  const communityAvailable = communityGroupsResult.ok || communityFeedResult.ok;

  return {
    groups: {
      products: unavailableExploreGroup(),
      services: unavailableExploreGroup(),
      businesses: unavailableExploreGroup(),
      needs: unavailableExploreGroup(),
      communities: exploreGroup(
        [
          ...asArray(groupPayload?.data).map(mapCommunityGroup),
          ...asArray(feedPayload?.items).map(mapCommunityPost),
        ],
        communityAvailable,
      ),
      videos: exploreGroup(
        asArray(videosPayload?.items).map(mapVideo),
        videosResult.ok,
      ),
      users: unavailableExploreGroup(),
    },
    communityAvailable,
    videosAvailable: videosResult.ok,
  };
}

function buildGuides(category: LajukanExploreCategory): ExploreGuide[] {
  if (category.id === 'community') {
    return [
      {
        titleId: 'Pilih grup sesuai tujuanmu',
        titleEn: 'Choose groups that fit your goal',
        summaryId:
          'Lihat topik, aturan, aktivitas, dan jenis anggota sebelum bergabung.',
        summaryEn:
          'Review topics, rules, activity, and member profiles before joining.',
        href: '/community?tab=groups',
      },
      {
        titleId: 'Jaga privasi saat berdiskusi',
        titleEn: 'Protect privacy in discussions',
        summaryId:
          'Hindari membagikan nomor pribadi, dokumen, atau detail usaha sensitif di ruang publik.',
        summaryEn:
          'Avoid sharing personal numbers, documents, or sensitive business details publicly.',
        href: '/trust',
      },
      {
        titleId: 'Mulai diskusi yang mudah dijawab',
        titleEn: 'Start a discussion people can answer',
        summaryId:
          'Berikan konteks, tujuan, dan pertanyaan yang spesifik agar anggota dapat membantu.',
        summaryEn:
          'Provide context, goals, and a specific question so members can help.',
        href: '/community',
      },
    ];
  }

  if (category.id === 'video') {
    return [
      {
        titleId: 'Tonton berdasarkan kebutuhan',
        titleEn: 'Watch based on your needs',
        summaryId:
          'Gunakan topik edukasi, tutorial, dan cerita usaha untuk menemukan video relevan.',
        summaryEn:
          'Use education, tutorial, and business story topics to find relevant videos.',
        href: '/reels',
      },
      {
        titleId: 'Periksa konteks dan sumber',
        titleEn: 'Check context and sources',
        summaryId:
          'Jangan menganggap klaim harga, hasil, atau legalitas dalam video otomatis terverifikasi.',
        summaryEn:
          'Do not assume price, outcome, or legality claims in videos are verified.',
        href: '/trust',
      },
      {
        titleId: 'Bagikan pengetahuan usahamu',
        titleEn: 'Share your business knowledge',
        summaryId:
          'Buat video singkat dengan judul, konteks, dan media yang jelas serta aman.',
        summaryEn:
          'Create a short video with a clear title, context, and safe media.',
        href: '/reels?upload=1',
      },
    ];
  }

  return [
    {
      titleId: 'Tentukan kebutuhan sebelum membandingkan',
      titleEn: 'Define your needs before comparing',
      summaryId:
        'Catat spesifikasi, jumlah, lokasi, tenggat, dan anggaran agar hasil lebih relevan.',
      summaryEn:
        'Note specifications, quantity, location, deadline, and budget for more relevant results.',
      href: `/learn?topic=${encodeURIComponent(category.slug)}`,
    },
    {
      titleId: 'Periksa profil dan bukti usaha',
      titleEn: 'Review profiles and business evidence',
      summaryId:
        'Gunakan informasi verifikasi, portofolio, lokasi, dan riwayat interaksi yang benar-benar tersedia.',
      summaryEn:
        'Use available verification, portfolio, location, and interaction history.',
      href: '/trust',
    },
    {
      titleId: 'Mulai percakapan dengan brief yang jelas',
      titleEn: 'Start with a clear brief',
      summaryId:
        'Sampaikan kebutuhan utama tanpa membagikan data pribadi yang tidak diperlukan.',
      summaryEn:
        'Share the core need without unnecessary personal information.',
      href: `/create?side=demand&category=${encodeURIComponent(category.slug)}`,
    },
  ];
}

function buildFaq(category: LajukanExploreCategory): ExploreFaq[] {
  if (category.id === 'community') {
    return [
      {
        questionId: 'Apa bedanya Jelajahi Komunitas dan halaman Komunitas?',
        questionEn:
          'What is the difference between Explore Communities and Community?',
        answerId:
          'Jelajahi Komunitas memberi ringkasan grup, diskusi, dan video pilihan. Halaman Komunitas adalah tempat membuka feed lengkap, bergabung, dan berdiskusi.',
        answerEn:
          'Explore Communities summarizes selected groups, discussions, and videos. Community contains the full feed, membership, and discussion tools.',
      },
      {
        questionId: 'Apakah semua grup dan diskusi sudah diverifikasi?',
        questionEn: 'Are all groups and discussions verified?',
        answerId:
          'Tidak. Periksa profil, aturan grup, sumber informasi, dan laporkan konten yang menyesatkan atau tidak aman.',
        answerEn:
          'No. Review profiles, group rules, and sources, and report misleading or unsafe content.',
      },
      {
        questionId: 'Bagaimana memilih komunitas yang tepat?',
        questionEn: 'How do I choose the right community?',
        answerId:
          'Pilih berdasarkan tujuan, topik, tingkat aktivitas, aturan, dan kualitas percakapan yang terlihat.',
        answerEn:
          'Choose based on your goal, topic, activity level, rules, and visible discussion quality.',
      },
    ];
  }

  if (category.id === 'video') {
    return [
      {
        questionId: 'Apa bedanya Jelajahi Video dan Reels?',
        questionEn: 'What is the difference between Explore Videos and Reels?',
        answerId:
          'Jelajahi Video merangkum topik dan unggahan pilihan. Reels adalah pengalaman menonton penuh dan tempat membuat unggahan.',
        answerEn:
          'Explore Videos summarizes selected topics and uploads. Reels is the full viewing and publishing experience.',
      },
      {
        questionId: 'Apakah klaim dalam video sudah diverifikasi?',
        questionEn: 'Are claims made in videos verified?',
        answerId:
          'Tidak otomatis. Periksa profil kreator, sumber, detail produk atau usaha, dan status verifikasi yang benar-benar tersedia.',
        answerEn:
          'Not automatically. Review the creator, sources, product or business details, and any available verification status.',
      },
      {
        questionId: 'Bagaimana mengunggah video usaha?',
        questionEn: 'How do I upload a business video?',
        answerId:
          'Buka Reels, pilih unggah, lalu tambahkan media, judul, konteks, dan hubungan ke produk atau usaha jika tersedia.',
        answerEn:
          'Open Reels, choose upload, then add media, a title, context, and a product or business connection when available.',
      },
    ];
  }

  return [
    {
      questionId: `Apa bedanya Jelajahi ${category.labelId} dan Search?`,
      questionEn: `What is the difference between exploring ${category.labelEn} and Search?`,
      answerId:
        'Jelajahi memberi konteks, subkategori, dan section pilihan. Search dipakai ketika kamu sudah memiliki kata kunci yang lebih spesifik.',
      answerEn:
        'Explore provides context, subcategories, and curated sections. Search is for specific keywords.',
    },
    {
      questionId: 'Apakah semua informasi penyedia sudah diverifikasi?',
      questionEn: 'Is every provider detail verified?',
      answerId:
        'Tidak. Status verifikasi hanya ditampilkan jika sumber datanya tersedia. Tetap periksa detail dan gunakan kanal komunikasi yang aman.',
      answerEn:
        'No. Verification is shown only when supported by source data. Review details and use safe communication channels.',
    },
    {
      questionId: 'Bagaimana jika belum menemukan hasil yang cocok?',
      questionEn: 'What if I cannot find a suitable result?',
      answerId:
        'Gunakan Search dengan kata yang lebih umum, ubah lokasi, atau buat kebutuhan agar penyedia dapat merespons.',
      answerEn:
        'Use a broader Search term, adjust location, or post a need so providers can respond.',
    },
  ];
}

export async function GET(
  req: NextRequest,
  context: { params: Promise<{ category: string }> },
) {
  const { category: requestedCategory } = await context.params;
  const category = getExploreCategoryBySlug(requestedCategory);
  if (!category) {
    return NextResponse.json({ error: 'Category not found' }, { status: 404 });
  }

  const unavailableGroups: GlobalSearchResponse['groups'] = {
    products: unavailableExploreGroup(),
    services: unavailableExploreGroup(),
    businesses: unavailableExploreGroup(),
    needs: unavailableExploreGroup(),
    communities: unavailableExploreGroup(),
    videos: unavailableExploreGroup(),
    users: unavailableExploreGroup(),
  };

  let groups = unavailableGroups;
  let degraded = true;

  if (category.id === 'community' || category.id === 'video') {
    const social = await loadSocialExploreGroups(req);
    groups = social.groups;
    degraded =
      category.id === 'community'
        ? !social.communityAvailable
        : !social.videosAvailable;
  } else {
    const searchParams = new URLSearchParams({
      q: category.searchQuery,
      category: category.slug,
      tab: 'all',
      sort: 'latest',
    });
    const searchResult = await fetchInternalJson(
      req,
      `/api/search?${searchParams.toString()}`,
    );
    if (searchResult.ok && asRecord(searchResult.payload)) {
      const searchPayload = searchResult.payload as GlobalSearchResponse;
      groups = searchPayload.groups;
      degraded = false;
    }
  }

  const payload: ExploreCategoryResponse = {
    category,
    subcategories: category.subcategories,
    sections: category.sections,
    groups,
    guides: buildGuides(category),
    faq: buildFaq(category),
    degraded,
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, max-age=30, stale-while-revalidate=180',
    },
  });
}
