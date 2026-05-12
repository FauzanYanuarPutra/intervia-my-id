export type ReelTone = "emerald" | "orange" | "blue" | "amber" | "rose";

export type LajukanReel = {
  id: string;
  title: string;
  creator: string;
  caption: string;
  tag: string;

  productName?: string;
  productPrice?: string;
  productHref?: string;

  videoSrc: string;
  sourceUrl: string;

  likes: string;
  comments: string;
  shares: string;

  tone: ReelTone;
  iconKey: "supplier" | "marketing" | "finance" | "packaging" | "frozen";
};

export type ReelsPageResult = {
  items: LajukanReel[];
  nextCursor: number | null;
  hasMore: boolean;
};

export const lajukanReels: LajukanReel[] = [
  {
    id: "supplier-terpercaya",
    title: "Cara cari supplier terpercaya buat UMKM",
    creator: "Lajukan Business",
    caption:
      "Jangan cuma lihat harga. Cek rating, respon chat, lokasi, minimal order, dan riwayat transaksi supplier.",
    tag: "Supplier",
    productName: "Supplier Ayam Frozen",
    productPrice: "Mulai Rp 28.000/kg",
    productHref: "/home?product=ayam-frozen",
    videoSrc: "https://www.pexels.com/download/video/4434069/",
    sourceUrl: "https://www.pexels.com/video/business-meeting-4434069/",
    likes: "12.4K",
    comments: "328",
    shares: "1.2K",
    tone: "emerald",
    iconKey: "supplier",
  },
  {
    id: "packaging-naik-kelas",
    title: "Packaging murah tapi kelihatan premium",
    creator: "Packindo",
    caption:
      "Kemasan sederhana bisa terlihat mahal kalau label, warna, ukuran, dan finishing-nya konsisten.",
    tag: "Packaging",
    productName: "Kemasan Box Custom",
    productPrice: "Mulai Rp 2.500/pcs",
    productHref: "/home?product=kemasan-box",
    videoSrc: "https://www.pexels.com/download/video/7205557/",
    sourceUrl: "https://www.pexels.com/video/a-person-packing-a-box-7205557/",
    likes: "10.2K",
    comments: "276",
    shares: "1.1K",
    tone: "orange",
    iconKey: "packaging",
  },
  {
    id: "kopi-laris",
    title: "Bikin menu kopi terlihat lebih mahal",
    creator: "Kopi Nusantara",
    caption:
      "Ambil close-up proses, pakai lighting hangat, dan tampilkan harga paket agar pelanggan cepat paham.",
    tag: "Coffee Shop",
    productName: "Kopi Arabica Premium",
    productPrice: "Mulai Rp 150.000/250gr",
    productHref: "/home?product=kopi-arabica",
    videoSrc: "https://www.pexels.com/download/video/17422066/",
    sourceUrl: "https://www.pexels.com/video/coffee-17422066/",
    likes: "8.9K",
    comments: "211",
    shares: "920",
    tone: "amber",
    iconKey: "marketing",
  },
  {
    id: "keuangan-umkm",
    title: "Cashflow usaha kecil jangan dicampur",
    creator: "Keuangan UMKM",
    caption:
      "Pisahkan uang pribadi dan uang usaha. Catat stok, margin, piutang, dan biaya harian biar bisnis sehat.",
    tag: "Keuangan",
    productName: "Template Keuangan UMKM",
    productPrice: "Gratis untuk pengguna",
    productHref: "/home?product=template-keuangan",
    videoSrc: "https://www.pexels.com/download/video/6774772/",
    sourceUrl:
      "https://www.pexels.com/video/a-group-of-people-in-a-business-meeting-6774772/",
    likes: "7.1K",
    comments: "185",
    shares: "740",
    tone: "blue",
    iconKey: "finance",
  },
  {
    id: "packing-online-shop",
    title: "Packing rapi bikin pembeli repeat order",
    creator: "Seller Academy",
    caption:
      "Gunakan pelindung, kartu ucapan, label jelas, dan foto proses packing untuk tingkatkan trust.",
    tag: "Online Shop",
    productName: "Paket Packaging UMKM",
    productPrice: "Mulai Rp 99.000",
    productHref: "/home?product=paket-packaging",
    videoSrc: "https://www.pexels.com/download/video/7308170/",
    sourceUrl:
      "https://www.pexels.com/video/a-person-packing-a-box-for-shipment-7308170/",
    likes: "9.6K",
    comments: "244",
    shares: "980",
    tone: "rose",
    iconKey: "frozen",
  },
];

export function getReelsPage(cursor = 0, limit = 3): ReelsPageResult {
  const safeCursor = Number.isFinite(cursor) ? Math.max(cursor, 0) : 0;
  const safeLimit = Number.isFinite(limit)
    ? Math.min(Math.max(limit, 1), 10)
    : 3;

  const items = lajukanReels.slice(safeCursor, safeCursor + safeLimit);
  const nextCursor =
    safeCursor + items.length < lajukanReels.length
      ? safeCursor + items.length
      : null;

  return {
    items,
    nextCursor,
    hasMore: nextCursor !== null,
  };
}