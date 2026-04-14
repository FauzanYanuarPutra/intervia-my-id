import { localAvatarForSeed, localHomeVisual } from '@/lib/media/localSeedMedia';
import { Post as PostType } from '@/types/types';

export const dummyPosts: PostType[] = [
  {
    id: 1,
    author: {
      id: 1,
      name: 'Nadya',
      avatarUrl: localAvatarForSeed('post-1'),
    },
    category: 'UMKM',
    content:
      'Checklist supplier untuk UMKM pemula: minta MOQ, lead time, contoh produk, dan bukti pengiriman sebelum deal pertama.',
    media: [{ type: 'image', url: localHomeVisual('supplier') }],
    reactions: [
      {
        type: 'like',
        count: 18,
        users: [{ id: 2, name: 'Raka', avatarUrl: localAvatarForSeed('post-2') }],
      },
      { type: 'love', count: 6, users: [] },
    ],
    comments: [
      {
        id: 1,
        author: {
          id: 3,
          name: 'Mira',
          avatarUrl: localAvatarForSeed('post-3'),
        },
        content: 'Ini pas banget buat yang baru mulai reseller.',
        timestamp: '2 jam lalu',
      },
    ],
    likes: 24,
    commentsCount: 1,
    timestamp: '2026-03-22T07:30:00Z',
  },
  {
    id: 2,
    author: {
      id: 2,
      name: 'Bagas',
      avatarUrl: localAvatarForSeed('post-4'),
    },
    category: 'Konten',
    content:
      'Template konten TikTok untuk seller: hook 3 detik, demo produk, bukti pakai, lalu CTA ke chat atau checkout.',
    media: [{ type: 'image', url: localHomeVisual('support') }],
    reactions: [{ type: 'like', count: 14, users: [] }],
    comments: [],
    likes: 14,
    commentsCount: 0,
    timestamp: '2026-03-21T10:00:00Z',
  },
  {
    id: 3,
    author: {
      id: 3,
      name: 'Dian',
      avatarUrl: localAvatarForSeed('post-5'),
    },
    category: 'Lokasi',
    content:
      'Kalau test jualan offline, cari booth mingguan dulu. Jangan langsung ambil kontrak tahunan sebelum tahu traffic dan repeat order.',
    media: [{ type: 'image', url: localHomeVisual('location') }],
    reactions: [
      { type: 'like', count: 21, users: [] },
      { type: 'love', count: 4, users: [] },
    ],
    comments: [
      {
        id: 2,
        author: {
          id: 4,
          name: 'Ari',
          avatarUrl: localAvatarForSeed('post-6'),
        },
        content: 'Setuju, bazaar mingguan jauh lebih aman buat validasi produk.',
        timestamp: '1 jam lalu',
      },
    ],
    likes: 25,
    commentsCount: 1,
    timestamp: '2026-03-22T05:30:00Z',
  },
  {
    id: 4,
    author: {
      id: 4,
      name: 'Sari',
      avatarUrl: localAvatarForSeed('post-7'),
    },
    category: 'Ads',
    content:
      'Iklan UMKM sering bocor karena landing dan chat admin belum siap. Pastikan stok, promo, dan respons tim sudah beres sebelum scale budget.',
    media: [],
    reactions: [{ type: 'like', count: 16, users: [] }],
    comments: [
      {
        id: 3,
        author: {
          id: 5,
          name: 'Intan',
          avatarUrl: localAvatarForSeed('post-8'),
        },
        content: 'Benar, closing turun kalau admin lambat balas.',
        timestamp: '30 menit lalu',
      },
    ],
    likes: 16,
    commentsCount: 1,
    timestamp: '2026-03-20T12:00:00Z',
  },
  {
    id: 5,
    author: {
      id: 5,
      name: 'Yusuf',
      avatarUrl: localAvatarForSeed('post-9'),
    },
    category: 'Operasional',
    content:
      'Bahan baku paling aman bukan yang termurah, tapi yang stabil kirimnya. UMKM lebih cepat rugi kalau stok putus daripada selisih harga tipis.',
    media: [],
    reactions: [
      { type: 'like', count: 22, users: [] },
      { type: 'love', count: 5, users: [] },
    ],
    comments: [],
    likes: 27,
    commentsCount: 0,
    timestamp: '2026-03-22T06:00:00Z',
  },
];
