// types/types.ts

export type User = {
  id: number;
  name: string;
  avatarUrl: string;
};

export type Media = {
  type: 'image' | 'video';
  url: string;
};

export type Reaction = {
  type: string; // 'like', 'love', 'haha', dll.
  count: number;
  users: User[]; // Bisa dihilangkan jika tidak digunakan
};

export type Comment = {
  id: number;
  author: User;
  content: string;
  timestamp: string;
};

export type Post = {
  id: number;
  author: User;

  // 🔥 TAMBAHAN: Properti yang digunakan untuk filtering (TS2339: 'category')
  category: string;

  // Menggunakan 'content' sebagai properti yang dapat dicari (search/title)
  content: string;

  media?: Media[];
  reactions: Reaction[];
  comments?: Comment[];

  // 🔥 PERBAIKAN: Gunakan 'timestamp' untuk sorting latest (TS2339: 'createdAt')
  // timestamp sudah ada, ini sudah benar.

  // 🔥 TAMBAHAN: Properti untuk Sorting 'popular' & 'trending' (TS2339: 'likes', 'comments')
  likes: number; // Untuk sorting 'popular'
  commentsCount: number; // Untuk sorting 'trending' (karena comments adalah array, lebih baik pakai count)

  timestamp: string;
};
