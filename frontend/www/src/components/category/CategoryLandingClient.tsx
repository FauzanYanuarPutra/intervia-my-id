'use client';

import Image from 'next/image';
import { type FormEvent, useMemo, useState } from 'react';
import {
  ArrowRight,
  Bell,
  Bookmark,
  BriefcaseBusiness,
  ChevronRight,
  Headphones,
  LayoutGrid,
  MapPin,
  Package,
  Search,
  ShieldCheck,
  ShoppingBag,
  Star,
  UserRound,
  type LucideIcon,
} from 'lucide-react';
import { Link, useRouter } from '@/i18n/navigation';
import { useAuth } from '@/context/AuthContext';
import { useNotificationInbox } from '@/context/NotificationInboxContext';
import { Header } from '@/components/layout/Header';
import {
  localContentImageForTopic,
  localHomeVisual,
  localProductImageForCategory,
} from '@/lib/media/localSeedMedia';
import { cn } from '@/lib/utils';

type Copy = {
  id: string;
  en: string;
};

type Tone = 'emerald' | 'rose' | 'sky' | 'violet' | 'amber';
type LeafCategoryId =
  | 'supplier'
  | 'location'
  | 'service'
  | 'product'
  | 'talent';
type CategoryId = 'all' | LeafCategoryId;

type CategoryDefinition = {
  id: LeafCategoryId;
  tone: Tone;
  icon: LucideIcon;
  label: Copy;
  summary: Copy;
  description: Copy;
  heroTitle: Copy;
  heroDescription: Copy;
  illustration: string;
  browseHref: string;
  searchQuery: string;
};

type TopicChip = {
  id: string;
  emoji: string;
  label: Copy;
  href: string;
};

type ShowcaseItem = {
  id: string;
  category: LeafCategoryId;
  title: string;
  location: string;
  rating: string;
  reviews: string;
  price: string;
  unit: string;
  image: string;
  href: string;
  description: Copy;
  verified?: boolean;
};

type BenefitItem = {
  id: string;
  title: Copy;
  description: Copy;
  icon: LucideIcon;
};

const CATEGORY_DEFINITIONS: CategoryDefinition[] = [
  {
    id: 'supplier',
    tone: 'emerald',
    icon: ShoppingBag,
    label: { id: 'Supplier', en: 'Suppliers' },
    summary: {
      id: 'Supplier siap buat usahamu',
      en: 'Find trusted suppliers for your business needs',
    },
    description: {
      id: 'Supplier stok, bahan baku, grosir.',
      en: 'Discover reliable suppliers for daily stock, raw materials, and wholesale sourcing.',
    },
    heroTitle: {
      id: 'Cari supplier cepat',
      en: 'Find the best suppliers for your business needs',
    },
    heroDescription: {
      id: 'Terpercaya, berkualitas, dan harga bersaing',
      en: 'Trusted quality with competitive pricing',
    },
    illustration: localHomeVisual('supplier'),
    browseHref: '/search?q=supplier%20bahan%20baku',
    searchQuery: 'supplier bahan baku',
  },
  {
    id: 'location',
    tone: 'rose',
    icon: MapPin,
    label: { id: 'Lokasi Usaha', en: 'Business Locations' },
    summary: {
      id: 'Lokasi usaha siap cek',
      en: 'Find strategic places for your business',
    },
    description: {
      id: 'Kios, booth, ruko, dapur.',
      en: 'Compare kiosks, booths, cloud kitchens, and other spaces that match your budget.',
    },
    heroTitle: {
      id: 'Cari lokasi usaha',
      en: 'Find the business location that fits you best',
    },
    heroDescription: {
      id: 'Cek area, traffic, budget.',
      en: 'Compare area, traffic, and budget faster',
    },
    illustration: localHomeVisual('location'),
    browseHref: '/property',
    searchQuery: 'lokasi usaha',
  },
  {
    id: 'service',
    tone: 'sky',
    icon: BriefcaseBusiness,
    label: { id: 'Jasa', en: 'Services' },
    summary: {
      id: 'Jasa biar operasional jalan',
      en: 'Pick services that keep operations moving',
    },
    description: {
      id: 'Desain, admin, legal, foto.',
      en: 'Find design, admin, legal, photography, and execution support in one place.',
    },
    heroTitle: {
      id: 'Pilih jasa operasional',
      en: 'Choose service partners for your operations',
    },
    heroDescription: {
      id: 'Dari desain, admin, hingga eksekusi lapangan',
      en: 'From design and admin to hands-on execution',
    },
    illustration: localContentImageForTopic('service', 'category-service'),
    browseHref: '/search?q=jasa%20usaha',
    searchQuery: 'jasa usaha',
  },
  {
    id: 'product',
    tone: 'violet',
    icon: Package,
    label: { id: 'Produk', en: 'Products' },
    summary: {
      id: 'Stok siap jual',
      en: 'Find ready-to-sell products with faster turnover',
    },
    description: {
      id: 'Produk, frozen food, grosir.',
      en: 'Explore products, frozen food, retail stock, and wholesale-ready items for resale.',
    },
    heroTitle: {
      id: 'Cari stok toko',
      en: 'Find ready-to-sell stock for your store',
    },
    heroDescription: {
      id: 'Cepat putar, margin aman.',
      en: 'Fast-moving items, safer margins, cleaner sourcing',
    },
    illustration: localContentImageForTopic('product', 'category-product'),
    browseHref: '/marketplace',
    searchQuery: 'produk reseller',
  },
  {
    id: 'talent',
    tone: 'amber',
    icon: UserRound,
    label: { id: 'Talent', en: 'Talent' },
    summary: {
      id: 'Talent siap bantu',
      en: 'Find dependable talent to support your business team',
    },
    description: {
      id: 'Admin, konten, sales, operator.',
      en: 'Search for creators, admin staff, sales support, and other business-ready talent.',
    },
    heroTitle: {
      id: 'Cari talent cepat',
      en: 'Find talent that helps your business grow',
    },
    heroDescription: {
      id: 'Freelancer, admin, sales, dan partner kreatif',
      en: 'Freelancers, admins, sales support, and creative partners',
    },
    illustration: localContentImageForTopic('talent', 'category-talent'),
    browseHref: '/freelancers',
    searchQuery: 'talent usaha',
  },
];

const CATEGORY_BY_ID = Object.fromEntries(
  CATEGORY_DEFINITIONS.map(item => [item.id, item]),
) as Record<LeafCategoryId, CategoryDefinition>;

const ALL_CATEGORY_TILE_LABEL: Copy = {
  id: 'Semua Kategori',
  en: 'All Categories',
};

const BENEFITS: BenefitItem[] = [
  {
    id: 'easy',
    title: { id: 'Gratis & Mudah', en: 'Free & Easy' },
    description: { id: 'Tanpa biaya apapun', en: 'No extra platform fee' },
    icon: UserRound,
  },
  {
    id: 'offers',
    title: { id: 'Banyak Penawaran', en: 'More Offers' },
    description: { id: 'Pilihan terbaik', en: 'Get better comparisons' },
    icon: ShoppingBag,
  },
  {
    id: 'verified',
    title: { id: 'Terverifikasi', en: 'Verified' },
    description: { id: 'Supplier tepercaya', en: 'From trusted partners' },
    icon: ShieldCheck,
  },
];

const ALL_CATEGORY_TOPICS: TopicChip[] = [
  {
    id: 'ayam',
    emoji: '🐔',
    label: { id: 'Ayam & Daging', en: 'Chicken & Meat' },
    href: '/search?q=supplier%20ayam',
  },
  {
    id: 'seafood',
    emoji: '🐟',
    label: { id: 'Ikan & Seafood', en: 'Seafood' },
    href: '/search?q=ikan%20seafood',
  },
  {
    id: 'vegetables',
    emoji: '🥬',
    label: { id: 'Sayuran', en: 'Vegetables' },
    href: '/search?q=sayuran',
  },
  {
    id: 'fruit',
    emoji: '🍎',
    label: { id: 'Buah-buahan', en: 'Fruits' },
    href: '/search?q=buah',
  },
  {
    id: 'dry',
    emoji: '📦',
    label: { id: 'Bahan Kering', en: 'Dry Goods' },
    href: '/search?q=bahan%20kering',
  },
  {
    id: 'drinks',
    emoji: '🥤',
    label: { id: 'Minuman', en: 'Drinks' },
    href: '/search?q=minuman',
  },
  {
    id: 'kitchen',
    emoji: '🍳',
    label: { id: 'Peralatan Dapur', en: 'Kitchen Tools' },
    href: '/search?q=peralatan%20dapur',
  },
  {
    id: 'packaging',
    emoji: '🧃',
    label: { id: 'Kemasan', en: 'Packaging' },
    href: '/search?q=kemasan',
  },
  {
    id: 'creative',
    emoji: '✏️',
    label: { id: 'Desain & Kreatif', en: 'Design & Creative' },
    href: '/search?q=desain%20kreatif',
  },
  {
    id: 'marketing',
    emoji: '📣',
    label: { id: 'Marketing', en: 'Marketing' },
    href: '/search?q=marketing',
  },
];

const CATEGORY_TOPICS: Record<LeafCategoryId, TopicChip[]> = {
  supplier: [
    {
      id: 'chicken',
      emoji: '🐔',
      label: { id: 'Ayam', en: 'Chicken' },
      href: '/search?q=supplier%20ayam',
    },
    {
      id: 'meat',
      emoji: '🥩',
      label: { id: 'Daging', en: 'Meat' },
      href: '/search?q=supplier%20daging',
    },
    {
      id: 'seafood',
      emoji: '🐟',
      label: { id: 'Ikan & Seafood', en: 'Seafood' },
      href: '/search?q=supplier%20seafood',
    },
    {
      id: 'vegetables',
      emoji: '🥬',
      label: { id: 'Sayuran', en: 'Vegetables' },
      href: '/search?q=supplier%20sayuran',
    },
    {
      id: 'fruit',
      emoji: '🍊',
      label: { id: 'Buah', en: 'Fruit' },
      href: '/search?q=supplier%20buah',
    },
    {
      id: 'dry',
      emoji: '📦',
      label: { id: 'Bahan Kering', en: 'Dry Goods' },
      href: '/search?q=bahan%20kering',
    },
  ],
  location: [
    {
      id: 'ruko',
      emoji: '🏬',
      label: { id: 'Ruko', en: 'Shophouse' },
      href: '/property?q=ruko',
    },
    {
      id: 'kios',
      emoji: '🛍️',
      label: { id: 'Kios', en: 'Kiosk' },
      href: '/property?q=kios',
    },
    {
      id: 'booth',
      emoji: '🧺',
      label: { id: 'Booth', en: 'Booth' },
      href: '/property?q=booth',
    },
    {
      id: 'cloud',
      emoji: '🍽️',
      label: { id: 'Cloud Kitchen', en: 'Cloud Kitchen' },
      href: '/property?q=cloud%20kitchen',
    },
    {
      id: 'warehouse',
      emoji: '🏭',
      label: { id: 'Gudang Kecil', en: 'Small Warehouse' },
      href: '/property?q=gudang',
    },
    {
      id: 'mall',
      emoji: '🏢',
      label: { id: 'Mall Area', en: 'Mall Area' },
      href: '/property?q=mall',
    },
  ],
  service: [
    {
      id: 'design',
      emoji: '🎨',
      label: { id: 'Desain', en: 'Design' },
      href: '/search?q=jasa%20desain',
    },
    {
      id: 'photo',
      emoji: '📷',
      label: { id: 'Foto Produk', en: 'Product Photo' },
      href: '/search?q=foto%20produk',
    },
    {
      id: 'admin',
      emoji: '🧾',
      label: { id: 'Admin', en: 'Admin' },
      href: '/search?q=jasa%20admin',
    },
    {
      id: 'legal',
      emoji: '⚖️',
      label: { id: 'Legal', en: 'Legal' },
      href: '/search?q=jasa%20legal',
    },
    {
      id: 'marketing',
      emoji: '📣',
      label: { id: 'Marketing', en: 'Marketing' },
      href: '/search?q=jasa%20marketing',
    },
    {
      id: 'delivery',
      emoji: '🛵',
      label: { id: 'Kurir', en: 'Courier' },
      href: '/search?q=jasa%20kurir',
    },
  ],
  product: [
    {
      id: 'frozen',
      emoji: '🧊',
      label: { id: 'Frozen Food', en: 'Frozen Food' },
      href: '/marketplace?category=Frozen%20Food',
    },
    {
      id: 'drinks',
      emoji: '🥤',
      label: { id: 'Minuman', en: 'Drinks' },
      href: '/marketplace?category=Minuman',
    },
    {
      id: 'snacks',
      emoji: '🍪',
      label: { id: 'Snack', en: 'Snacks' },
      href: '/marketplace?category=Snack',
    },
    {
      id: 'staples',
      emoji: '🛒',
      label: { id: 'Sembako', en: 'Staples' },
      href: '/marketplace?category=Sembako',
    },
    {
      id: 'packaging',
      emoji: '📦',
      label: { id: 'Kemasan', en: 'Packaging' },
      href: '/marketplace?category=Kemasan',
    },
    {
      id: 'tools',
      emoji: '🍳',
      label: { id: 'Peralatan', en: 'Tools' },
      href: '/marketplace?category=Peralatan',
    },
  ],
  talent: [
    {
      id: 'cashier',
      emoji: '💳',
      label: { id: 'Kasir', en: 'Cashier' },
      href: '/freelancers?q=kasir',
    },
    {
      id: 'admin',
      emoji: '🧾',
      label: { id: 'Admin Toko', en: 'Store Admin' },
      href: '/freelancers?q=admin%20toko',
    },
    {
      id: 'creator',
      emoji: '🎥',
      label: { id: 'Konten Kreator', en: 'Content Creator' },
      href: '/freelancers?q=konten%20kreator',
    },
    {
      id: 'sales',
      emoji: '🤝',
      label: { id: 'Sales', en: 'Sales' },
      href: '/freelancers?q=sales',
    },
    {
      id: 'ops',
      emoji: '📋',
      label: { id: 'Operasional', en: 'Operations' },
      href: '/freelancers?q=operasional',
    },
    {
      id: 'design',
      emoji: '✏️',
      label: { id: 'Desainer', en: 'Designer' },
      href: '/freelancers?q=desainer',
    },
  ],
};

const SHOWCASE_ITEMS: ShowcaseItem[] = [
  {
    id: 'supplier-ayam',
    category: 'supplier',
    title: 'Supplier Ayam Segar Premium',
    location: 'Jakarta Barat',
    rating: '4.9',
    reviews: '128',
    price: 'Rp 28.000',
    unit: '/kg',
    image: localProductImageForCategory('ayam', 'kategori-ayam'),
    href: '/search?q=supplier%20ayam%20segar',
    description: {
      id: 'Potongan ayam segar dengan pasokan rutin untuk kebutuhan outlet harian.',
      en: 'Fresh chicken cuts with steady daily supply for food outlets.',
    },
    verified: true,
  },
  {
    id: 'supplier-daging',
    category: 'supplier',
    title: 'Daging Nusantara',
    location: 'Jakarta Utara',
    rating: '4.8',
    reviews: '52',
    price: 'Rp 120.000',
    unit: '/kg',
    image: localProductImageForCategory('daging', 'kategori-daging'),
    href: '/search?q=supplier%20daging',
    description: {
      id: 'Supplier daging sapi dan kambing segar, halal, dan higienis.',
      en: 'Fresh halal beef and lamb supplier for business kitchens.',
    },
    verified: true,
  },
  {
    id: 'location-office',
    category: 'location',
    title: 'Sewa Kantor Strategis',
    location: 'Jakarta Selatan',
    rating: '4.7',
    reviews: '76',
    price: 'Rp 5.000.000',
    unit: '/bulan',
    image: localContentImageForTopic('property', 'kategori-kantor'),
    href: '/property?q=kantor%20strategis',
    description: {
      id: 'Lokasi kantor dan showroom dekat akses utama dengan fasilitas siap pakai.',
      en: 'Office and showroom location close to major access points.',
    },
    verified: true,
  },
  {
    id: 'service-logo',
    category: 'service',
    title: 'Jasa Desain Logo',
    location: 'Bandung',
    rating: '4.9',
    reviews: '54',
    price: 'Rp 250.000',
    unit: '',
    image: localContentImageForTopic('service', 'kategori-logo'),
    href: '/search?q=jasa%20desain%20logo',
    description: {
      id: 'Desain logo dan identitas visual untuk produk, outlet, dan campaign baru.',
      en: 'Logo and visual identity design for products and new campaigns.',
    },
    verified: true,
  },
  {
    id: 'talent-photo',
    category: 'talent',
    title: 'Fotografer Produk',
    location: 'Surabaya',
    rating: '4.8',
    reviews: '62',
    price: 'Rp 500.000',
    unit: '',
    image: localContentImageForTopic('talent', 'kategori-fotografer'),
    href: '/freelancers?q=fotografer%20produk',
    description: {
      id: 'Fotografer berpengalaman untuk katalog, menu, dan konten marketplace.',
      en: 'Experienced photographer for catalog, menu, and marketplace content.',
    },
    verified: true,
  },
  {
    id: 'supplier-eggs',
    category: 'supplier',
    title: 'Toko Telur Kita',
    location: 'Jakarta Pusat',
    rating: '4.9',
    reviews: '64',
    price: 'Rp 24.000',
    unit: '/kg',
    image: localProductImageForCategory('telur', 'kategori-telur'),
    href: '/search?q=supplier%20telur',
    description: {
      id: 'Menyediakan telur segar berkualitas dengan harga terjangkau.',
      en: 'Fresh eggs with consistent quality and practical pricing.',
    },
    verified: true,
  },
  {
    id: 'supplier-seafood',
    category: 'supplier',
    title: 'Fresh Seafood Indo',
    location: 'Tangerang Selatan',
    rating: '4.7',
    reviews: '38',
    price: 'Rp 35.000',
    unit: '/kg',
    image: localProductImageForCategory('seafood', 'kategori-seafood'),
    href: '/search?q=supplier%20seafood',
    description: {
      id: 'Berbagai pilihan seafood segar langsung dari nelayan.',
      en: 'Fresh seafood selection sourced directly from fishers.',
    },
    verified: true,
  },
  {
    id: 'location-kiosk',
    category: 'location',
    title: 'Kios Ramai Pasar Baru',
    location: 'Bandung',
    rating: '4.8',
    reviews: '41',
    price: 'Rp 3.200.000',
    unit: '/bulan',
    image: localContentImageForTopic('property', 'kategori-kios'),
    href: '/property?q=kios%20pasar',
    description: {
      id: 'Kios dengan traffic tinggi cocok untuk F&B dan retail cepat putar.',
      en: 'High-traffic kiosk for F&B and fast-moving retail businesses.',
    },
    verified: true,
  },
  {
    id: 'service-marketplace',
    category: 'service',
    title: 'Jasa Kelola Marketplace',
    location: 'Online',
    rating: '4.8',
    reviews: '48',
    price: 'Rp 1.800.000',
    unit: '/bulan',
    image: localContentImageForTopic('service', 'kategori-marketplace'),
    href: '/search?q=jasa%20kelola%20marketplace',
    description: {
      id: 'Optimasi listing, balas chat, dan rutinitas operasional marketplace.',
      en: 'Listing optimization, chat response, and marketplace operations support.',
    },
    verified: true,
  },
  {
    id: 'product-frozen',
    category: 'product',
    title: 'Frozen Food Siap Jual',
    location: 'Bekasi',
    rating: '4.7',
    reviews: '71',
    price: 'Rp 18.000',
    unit: '/pack',
    image: localProductImageForCategory('frozen', 'kategori-frozen'),
    href: '/marketplace?category=Frozen%20Food',
    description: {
      id: 'Produk frozen food dengan margin aman dan stok siap kirim.',
      en: 'Frozen food products with safer margins and ready stock.',
    },
    verified: true,
  },
  {
    id: 'product-drinks',
    category: 'product',
    title: 'Paket Minuman Literan',
    location: 'Depok',
    rating: '4.8',
    reviews: '33',
    price: 'Rp 22.000',
    unit: '/botol',
    image: localProductImageForCategory('minuman', 'kategori-minuman'),
    href: '/marketplace?category=Minuman',
    description: {
      id: 'Minuman siap jual untuk reseller, booth, dan penjualan event.',
      en: 'Ready-to-sell drinks for resellers, booths, and event sales.',
    },
    verified: true,
  },
  {
    id: 'talent-admin',
    category: 'talent',
    title: 'Admin Operasional UMKM',
    location: 'Yogyakarta',
    rating: '4.8',
    reviews: '29',
    price: 'Rp 2.800.000',
    unit: '/bulan',
    image: localContentImageForTopic('talent', 'kategori-admin'),
    href: '/freelancers?q=admin%20operasional',
    description: {
      id: 'Bisa bantu order entry, follow up supplier, dan administrasi harian.',
      en: 'Helps with order entry, supplier follow-up, and daily admin work.',
    },
    verified: true,
  },
  {
    id: 'talent-creator',
    category: 'talent',
    title: 'Konten Kreator Produk',
    location: 'Jakarta Barat',
    rating: '4.9',
    reviews: '35',
    price: 'Rp 1.200.000',
    unit: '/project',
    image: localContentImageForTopic('talent', 'kategori-kreator'),
    href: '/freelancers?q=konten%20kreator',
    description: {
      id: 'Bikin konten promosi, reels, dan materi upload marketplace.',
      en: 'Creates promo content, reels, and marketplace-ready assets.',
    },
    verified: true,
  },
];

function pick(isId: boolean, copy: Copy): string {
  return isId ? copy.id : copy.en;
}

function toneStyles(tone: Tone) {
  if (tone === 'rose') {
    return {
      active: 'border-rose-500 bg-rose-50 text-rose-700',
      idle: 'border-slate-200 bg-white text-slate-700 hover:border-rose-200 hover:bg-rose-50/70',
      icon: 'bg-rose-100 text-rose-600',
      badge: 'bg-rose-50 text-rose-700',
      hero: 'from-white via-rose-50 to-orange-50',
      shadow: 'shadow-[0_24px_40px_-30px_rgba(244,63,94,0.42)]',
      accentText: 'text-rose-600',
    };
  }
  if (tone === 'sky') {
    return {
      active: 'border-teal-500 bg-teal-50 text-teal-700',
      idle: 'border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50/70',
      icon: 'bg-teal-100 text-teal-700',
      badge: 'bg-teal-50 text-teal-700',
      hero: 'from-white via-teal-50 to-emerald-50',
      shadow: 'shadow-[0_24px_40px_-30px_rgba(13,148,136,0.35)]',
      accentText: 'text-teal-700',
    };
  }
  if (tone === 'violet') {
    return {
      active: 'border-lime-500 bg-lime-50 text-lime-800',
      idle: 'border-slate-200 bg-white text-slate-700 hover:border-lime-200 hover:bg-lime-50/70',
      icon: 'bg-lime-100 text-lime-800',
      badge: 'bg-lime-50 text-lime-800',
      hero: 'from-white via-lime-50 to-emerald-50',
      shadow: 'shadow-[0_24px_40px_-30px_rgba(101,163,13,0.35)]',
      accentText: 'text-lime-700',
    };
  }
  if (tone === 'amber') {
    return {
      active: 'border-amber-500 bg-amber-50 text-amber-700',
      idle: 'border-slate-200 bg-white text-slate-700 hover:border-amber-200 hover:bg-amber-50/70',
      icon: 'bg-amber-100 text-amber-600',
      badge: 'bg-amber-50 text-amber-700',
      hero: 'from-white via-amber-50 to-orange-50',
      shadow: 'shadow-[0_24px_40px_-30px_rgba(245,158,11,0.35)]',
      accentText: 'text-amber-600',
    };
  }
  return {
    active: 'border-emerald-500 bg-emerald-50 text-emerald-700',
    idle: 'border-slate-200 bg-white text-slate-700 hover:border-emerald-200 hover:bg-emerald-50/70',
    icon: 'bg-emerald-100 text-emerald-700',
    badge: 'bg-emerald-50 text-emerald-700',
    hero: 'from-white via-emerald-50 to-lime-50',
    shadow: 'shadow-[0_24px_40px_-30px_rgba(22,163,74,0.35)]',
    accentText: 'text-emerald-600',
  };
}

function getPrimaryAction(
  category: LeafCategoryId,
  requestHref: string,
  isId: boolean,
): { href: string; label: string } {
  if (category === 'location') {
    return {
      href: '/property',
      label: isId ? 'Cari Lokasi' : 'Find Location',
    };
  }
  if (category === 'product') {
    return {
      href: '/marketplace',
      label: isId ? 'Lihat Produk' : 'View Products',
    };
  }
  if (category === 'talent') {
    return {
      href: '/freelancers',
      label: isId ? 'Cari Talent' : 'Find Talent',
    };
  }
  return {
    href: requestHref,
    label: isId ? 'Buat Permintaan' : 'Create Request',
  };
}

function getShowcaseItems(category: CategoryId): ShowcaseItem[] {
  if (category === 'all') {
    return SHOWCASE_ITEMS.slice(0, 5);
  }
  const filtered = SHOWCASE_ITEMS.filter(item => item.category === category);
  return filtered.length ? filtered : SHOWCASE_ITEMS.slice(0, 5);
}

function getTopicLabel(category: LeafCategoryId, isId: boolean): string {
  const label = pick(isId, CATEGORY_BY_ID[category].label);
  return isId ? `Kategori ${label}` : `${label} Categories`;
}

type CategoryLandingClientProps = {
  isId: boolean;
  initialQuery?: string;
};

export function CategoryLandingClient({
  isId,
  initialQuery = '',
}: CategoryLandingClientProps) {
  const router = useRouter();
  const { isAuthenticated } = useAuth();
  const { unreadCount } = useNotificationInbox();
  const [searchValue, setSearchValue] = useState(initialQuery);
  const [desktopCategory, setDesktopCategory] = useState<CategoryId>('all');
  const [mobileCategory, setMobileCategory] =
    useState<LeafCategoryId>('supplier');

  const requestHref = isAuthenticated ? '/create' : '/register';

  const desktopCategoryConfig =
    desktopCategory === 'all' ? null : CATEGORY_BY_ID[desktopCategory];
  const resolvedDesktopConfig =
    desktopCategoryConfig ?? CATEGORY_DEFINITIONS[0];
  const desktopTone = toneStyles(desktopCategoryConfig?.tone || 'emerald');
  const mobileCategoryConfig = CATEGORY_BY_ID[mobileCategory];
  const mobileTone = toneStyles(mobileCategoryConfig.tone);

  const desktopShowcase = useMemo(
    () => getShowcaseItems(desktopCategory),
    [desktopCategory],
  );
  const mobileShowcase = useMemo(
    () => getShowcaseItems(mobileCategory),
    [mobileCategory],
  );
  const desktopTopics = useMemo(
    () =>
      desktopCategory === 'all'
        ? ALL_CATEGORY_TOPICS
        : CATEGORY_TOPICS[desktopCategory],
    [desktopCategory],
  );
  const mobileTopics = CATEGORY_TOPICS[mobileCategory];

  const desktopAction =
    desktopCategory === 'all'
      ? {
          href: requestHref,
          label: isId ? 'Buat Permintaan Sekarang' : 'Create Request Now',
        }
      : getPrimaryAction(desktopCategory, requestHref, isId);
  const mobileAction = getPrimaryAction(mobileCategory, requestHref, isId);

  const handleSearchSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const trimmed = searchValue.trim();
    router.push(
      trimmed ? `/search?q=${encodeURIComponent(trimmed)}` : '/search',
    );
  };

  const desktopBannerTitle =
    desktopCategory === 'all'
      ? isId
        ? 'Belum menemukan yang cocok?'
        : 'Still not seeing the right fit?'
      : pick(isId, resolvedDesktopConfig.heroTitle);
  const desktopBannerDescription =
    desktopCategory === 'all'
      ? isId
        ? 'Tulis kebutuhan. Supplier bisa masuk.'
        : 'Post a specific request and get offers from trusted business partners.'
      : pick(isId, resolvedDesktopConfig.heroDescription);
  const desktopBannerIllustration =
    desktopCategory === 'all'
      ? localHomeVisual('support')
      : resolvedDesktopConfig.illustration;

  return (
    <main className="lajukan-market-page lajukan-market-category page-shell max-lg:!px-0 overflow-x-hidden pb-5 pt-2 sm:pt-4 lg:pb-8">
      <div className="hidden lg:block">
        <Header />
      </div>
      <div aria-hidden="true" className="hidden h-[4.625rem] lg:block" />
      <div className="mx-auto w-full max-w-[1500px] px-2 sm:px-4 lg:px-6">
        <div className="lg:hidden">
          <section
            className="ui-layer-local-topbar fixed inset-x-0 top-0 border-b border-[color:var(--app-border)] bg-[color:color-mix(in_srgb,var(--app-surface-strong)_96%,transparent)] px-2 pb-1.5 shadow-[0_12px_26px_-24px_rgba(15,23,42,0.26)] backdrop-blur-xl sm:px-3"
            style={{ paddingTop: 'max(env(safe-area-inset-top), 0.3rem)' }}
          >
            <div className="mx-auto flex max-w-[720px] items-center gap-2">
              <form
                onSubmit={handleSearchSubmit}
                className="ui-navbar-search-field flex-1"
              >
                <Search className="ui-navbar-search-icon" />
                <input
                  type="search"
                  value={searchValue}
                  onChange={event => setSearchValue(event.target.value)}
                  placeholder={
                    isId
                      ? 'Cari supplier, jasa, lokasi...'
                      : 'Search suppliers, locations, services, products, talent...'
                  }
                  className="ui-navbar-search-input"
                />
              </form>
              <Link
                href="/notifications"
                className="relative inline-flex h-[42px] w-[42px] shrink-0 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.24)]"
                aria-label={isId ? 'Buka notifikasi' : 'Open notifications'}
              >
                <Bell className="h-4.5 w-4.5" />
                {unreadCount > 0 ? (
                  <span className="absolute right-0.5 top-0.5 inline-flex min-w-4 items-center justify-center rounded-full bg-red-500 px-1 py-0.5 text-[9px] font-black text-white">
                    {unreadCount > 99 ? '99+' : unreadCount}
                  </span>
                ) : null}
              </Link>
            </div>
          </section>
          <div
            aria-hidden="true"
            className="h-[calc(3.55rem+env(safe-area-inset-top))]"
          />

          <div className="space-y-3">
            <div className="-mx-2 flex gap-2 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {CATEGORY_DEFINITIONS.map(item => {
                const Icon = item.icon;
                const tone = toneStyles(item.tone);
                const active = mobileCategory === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setMobileCategory(item.id)}
                    className={cn(
                      'inline-flex shrink-0 items-center gap-2 rounded-[15px] border px-2.5 py-1.5 text-left text-xs font-semibold transition',
                      active ? tone.active : tone.idle,
                    )}
                  >
                    <span
                      className={cn(
                        'inline-flex h-7 w-7 items-center justify-center rounded-[10px]',
                        tone.icon,
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                    </span>
                    <span>{pick(isId, item.label)}</span>
                  </button>
                );
              })}
            </div>

            <article
              className={cn(
                'relative min-h-[148px] overflow-hidden rounded-[22px] border border-slate-200 bg-gradient-to-br p-4',
                mobileTone.hero,
                mobileTone.shadow,
              )}
            >
              <div className="max-w-[68%] space-y-2">
                <h2 className="text-[1.45rem] font-black leading-[1.04] tracking-[-0.04em] text-slate-950">
                  {pick(isId, mobileCategoryConfig.heroTitle)}
                </h2>
                <p className="line-clamp-2 text-xs leading-5 text-slate-600">
                  {pick(isId, mobileCategoryConfig.heroDescription)}
                </p>
                <Link
                  href={mobileAction.href}
                  className="inline-flex min-h-[38px] items-center justify-center rounded-[14px] bg-emerald-600 px-4 text-xs font-semibold text-white shadow-[0_14px_26px_-20px_rgba(22,163,74,0.55)]"
                >
                  {mobileAction.label}
                </Link>
              </div>

              <div className="pointer-events-none absolute bottom-0 right-0 flex w-[38%] items-end justify-end">
                <Image
                  src={mobileCategoryConfig.illustration}
                  alt={pick(isId, mobileCategoryConfig.label)}
                  width={240}
                  height={200}
                  className="h-auto w-full max-w-[170px] object-contain"
                  priority={mobileCategory === 'supplier'}
                />
              </div>
            </article>

            <SectionHeader
              title={
                isId
                  ? `${pick(true, mobileCategoryConfig.label)} Populer`
                  : `Popular ${pick(false, mobileCategoryConfig.label)}`
              }
              actionHref={mobileCategoryConfig.browseHref}
              actionLabel={isId ? 'Lihat Semua' : 'View All'}
              mobile
            />

            <div className="-mx-2 flex gap-2.5 overflow-x-auto px-2 pb-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
              {mobileShowcase.map(item => (
                <MobileShowcaseCard key={item.id} item={item} isId={isId} />
              ))}
            </div>

            <SectionHeader
              title={getTopicLabel(mobileCategory, isId)}
              actionHref={mobileCategoryConfig.browseHref}
              actionLabel={isId ? 'Lihat Semua' : 'View All'}
              mobile
            />

            <div className="grid grid-cols-3 gap-2">
              {mobileTopics.map(topic => (
                <Link
                  key={topic.id}
                  href={topic.href}
                  className="rounded-[16px] border border-slate-200 bg-white px-2 py-2.5 text-center shadow-[0_14px_26px_-24px_rgba(15,23,42,0.18)]"
                >
                  <span className="mx-auto inline-flex h-9 w-9 items-center justify-center rounded-[12px] bg-slate-50 text-xl">
                    {topic.emoji}
                  </span>
                  <span className="mt-2 block truncate text-xs font-semibold text-slate-900">
                    {pick(isId, topic.label)}
                  </span>
                </Link>
              ))}
            </div>

            <SectionHeader
              title={isId ? 'Rekomendasi untukmu' : 'Recommendations for you'}
              actionHref={mobileCategoryConfig.browseHref}
              actionLabel={isId ? 'Lihat Semua' : 'View All'}
              mobile
            />

            <div className="space-y-2">
              {mobileShowcase.slice(0, 3).map(item => (
                <MobileRecommendationRow
                  key={`${item.id}-row`}
                  item={item}
                  isId={isId}
                />
              ))}
            </div>
          </div>
        </div>

        <section className="hidden lg:block">
          <div className="grid gap-6 xl:grid-cols-[240px_minmax(0,1fr)]">
            <aside className="space-y-4 xl:sticky xl:top-24 xl:self-start">
              <nav className="rounded-[28px] border border-slate-200 bg-white p-4 shadow-[0_24px_44px_-34px_rgba(15,23,42,0.2)]">
                <div className="space-y-2">
                  <SidebarCategoryButton
                    active={desktopCategory === 'all'}
                    label={pick(isId, ALL_CATEGORY_TILE_LABEL)}
                    icon={LayoutGrid}
                    tone="emerald"
                    onClick={() => setDesktopCategory('all')}
                  />
                  {CATEGORY_DEFINITIONS.map(item => (
                    <SidebarCategoryButton
                      key={item.id}
                      active={desktopCategory === item.id}
                      label={pick(isId, item.label)}
                      icon={item.icon}
                      tone={item.tone}
                      onClick={() => setDesktopCategory(item.id)}
                    />
                  ))}
                </div>
              </nav>

              <article className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_44px_-34px_rgba(15,23,42,0.2)]">
                <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                  <Headphones className="h-5 w-5" />
                </span>
                <h2 className="mt-4 text-lg font-black tracking-[-0.04em] text-slate-950">
                  {isId ? 'Butuh bantuan?' : 'Need help?'}
                </h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">
                  {isId
                    ? 'Tim kami siap membantu menemukan kategori dan partner bisnis yang paling cocok.'
                    : 'Our team can help you find the right category and business partner.'}
                </p>
                <Link
                  href="/support"
                  className="mt-5 inline-flex min-h-[46px] items-center justify-center rounded-[16px] bg-emerald-600 px-4 text-sm font-semibold text-white"
                >
                  {isId ? 'Chat dengan Kami' : 'Chat with Us'}
                </Link>
              </article>
            </aside>

            <div className="space-y-7">
              <nav className="flex items-center gap-2 text-sm text-slate-500">
                <Link href="/home" className="transition hover:text-slate-900">
                  {isId ? 'Beranda' : 'Home'}
                </Link>
                <ChevronRight className="h-4 w-4" />
                <span className="font-medium text-slate-700">
                  {isId ? 'Kategori' : 'Categories'}
                </span>
              </nav>

              <div className="flex flex-col gap-5 rounded-[36px] border border-slate-200 bg-white p-6 shadow-[0_24px_44px_-34px_rgba(15,23,42,0.2)] xl:p-7">
                <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
                  <div className="max-w-3xl">
                    <h1 className="text-[3.2rem] font-black leading-[0.92] tracking-[-0.08em] text-slate-950">
                      {isId ? 'Kategori' : 'Categories'}
                    </h1>
                    <p className="mt-3 text-base leading-7 text-slate-600">
                      {isId
                        ? 'Cari yang dibutuhkan. Lanjut chat.'
                        : 'Find the business categories you need to keep your operation moving.'}
                    </p>
                  </div>

                  <form
                    onSubmit={handleSearchSubmit}
                    className="flex w-full max-w-[560px] items-center gap-3 rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-3"
                  >
                    <Search className="h-5 w-5 text-slate-400" />
                    <input
                      type="search"
                      value={searchValue}
                      onChange={event => setSearchValue(event.target.value)}
                      placeholder={
                        isId
                          ? 'Cari supplier, jasa, lokasi...'
                          : 'Search suppliers, locations, services, products, talent...'
                      }
                      className="w-full min-w-0 border-0 bg-transparent p-0 text-sm text-slate-700 outline-none placeholder:text-slate-400"
                    />
                    <button
                      type="submit"
                      className="inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-[16px] bg-emerald-600 px-4 text-sm font-semibold text-white"
                    >
                      {isId ? 'Cari' : 'Search'}
                    </button>
                  </form>
                </div>

                <div className="grid gap-4 xl:grid-cols-5">
                  {CATEGORY_DEFINITIONS.map(item => (
                    <DesktopCategoryCard
                      key={item.id}
                      category={item}
                      active={desktopCategory === item.id}
                      isId={isId}
                      onClick={() => setDesktopCategory(item.id)}
                    />
                  ))}
                </div>
              </div>

              <article
                className={cn(
                  'grid gap-6 overflow-hidden rounded-[36px] border border-slate-200 bg-gradient-to-r p-6 shadow-[0_24px_44px_-34px_rgba(15,23,42,0.2)] xl:grid-cols-[minmax(0,1fr)_260px_minmax(0,0.95fr)] xl:items-center xl:p-7',
                  desktopCategoryConfig
                    ? desktopTone.hero
                    : 'from-white via-emerald-50 to-teal-50',
                )}
              >
                <div>
                  <h2 className="text-[2.2rem] font-black leading-[1] tracking-[-0.06em] text-slate-950">
                    {desktopBannerTitle}
                  </h2>
                  <p className="mt-3 max-w-xl text-base leading-7 text-slate-600">
                    {desktopBannerDescription}
                  </p>
                  <Link
                    href={desktopAction.href}
                    className="mt-6 inline-flex min-h-[48px] items-center justify-center rounded-[16px] bg-emerald-600 px-5 text-sm font-semibold text-white"
                  >
                    {desktopAction.label}
                  </Link>
                </div>

                <div className="mx-auto flex w-full max-w-[240px] justify-center">
                  <Image
                    src={desktopBannerIllustration}
                    alt={
                      desktopCategoryConfig
                        ? pick(isId, desktopCategoryConfig.label)
                        : 'Support illustration'
                    }
                    width={260}
                    height={220}
                    className="h-auto w-full object-contain"
                  />
                </div>

                <div className="grid gap-4">
                  {BENEFITS.map(item => {
                    const Icon = item.icon;
                    return (
                      <div
                        key={item.id}
                        className="flex items-start gap-4 rounded-[24px] border border-white/70 bg-white/80 px-4 py-4 backdrop-blur-sm"
                      >
                        <span className="inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div>
                          <p className="text-sm font-black text-slate-950">
                            {pick(isId, item.title)}
                          </p>
                          <p className="mt-1 text-sm text-slate-600">
                            {pick(isId, item.description)}
                          </p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </article>

              <div className="space-y-4">
                <SectionHeader
                  title={
                    desktopCategory === 'all'
                      ? isId
                        ? 'Kategori Populer'
                        : 'Popular Categories'
                      : getTopicLabel(desktopCategory, isId)
                  }
                  actionHref={
                    desktopCategory === 'all'
                      ? '/search'
                      : CATEGORY_BY_ID[desktopCategory].browseHref
                  }
                  actionLabel={isId ? 'Lihat Semua' : 'View All'}
                />

                <div className="grid grid-cols-2 gap-4 xl:grid-cols-6">
                  {desktopTopics.map(topic => (
                    <Link
                      key={topic.id}
                      href={topic.href}
                      className="rounded-[24px] border border-slate-200 bg-white px-4 py-5 text-center shadow-[0_20px_36px_-34px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:border-emerald-200 hover:shadow-[0_28px_50px_-36px_rgba(22,163,74,0.28)]"
                    >
                      <span className="mx-auto inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-50 text-[1.7rem]">
                        {topic.emoji}
                      </span>
                      <span className="mt-4 block text-sm font-semibold text-slate-900">
                        {pick(isId, topic.label)}
                      </span>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                <SectionHeader
                  title={
                    isId ? 'Rekomendasi Untukmu' : 'Recommendations For You'
                  }
                  actionHref={
                    desktopCategory === 'all'
                      ? '/search'
                      : CATEGORY_BY_ID[desktopCategory].browseHref
                  }
                  actionLabel={isId ? 'Lihat Semua' : 'View All'}
                />

                <div className="grid gap-5 xl:grid-cols-5">
                  {desktopShowcase.map(item => (
                    <DesktopShowcaseCard
                      key={item.id}
                      item={item}
                      isId={isId}
                    />
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

function SectionHeader({
  title,
  actionHref,
  actionLabel,
  mobile = false,
}: {
  title: string;
  actionHref: string;
  actionLabel: string;
  mobile?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <h2
        className={cn(
          'font-black tracking-[-0.04em] text-slate-950',
          mobile ? 'text-[1.2rem]' : 'text-[2rem]',
        )}
      >
        {title}
      </h2>
      <Link
        href={actionHref}
        className={cn(
          'shrink-0 font-semibold text-emerald-600 transition hover:text-emerald-700',
          mobile ? 'rounded-full bg-emerald-50 px-2.5 py-1 text-xs' : 'text-sm',
        )}
      >
        {actionLabel}
      </Link>
    </div>
  );
}

function SidebarCategoryButton({
  active,
  label,
  icon: Icon,
  tone,
  onClick,
}: {
  active: boolean;
  label: string;
  icon: LucideIcon;
  tone: Tone;
  onClick: () => void;
}) {
  const palette = toneStyles(tone);

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 rounded-[20px] border px-4 py-3 text-left text-sm font-semibold transition',
        active ? palette.active : palette.idle,
      )}
    >
      <span
        className={cn(
          'inline-flex h-10 w-10 items-center justify-center rounded-2xl',
          palette.icon,
        )}
      >
        <Icon className="h-4.5 w-4.5" />
      </span>
      <span>{label}</span>
    </button>
  );
}

function DesktopCategoryCard({
  category,
  active,
  isId,
  onClick,
}: {
  category: CategoryDefinition;
  active: boolean;
  isId: boolean;
  onClick: () => void;
}) {
  const palette = toneStyles(category.tone);
  const Icon = category.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group relative overflow-hidden rounded-[28px] border bg-white p-5 text-left shadow-[0_20px_36px_-34px_rgba(15,23,42,0.22)] transition hover:-translate-y-0.5 hover:shadow-[0_28px_46px_-36px_rgba(15,23,42,0.22)]',
        active ? palette.active : 'border-slate-200',
      )}
    >
      <span
        className={cn(
          'inline-flex h-12 w-12 items-center justify-center rounded-2xl',
          palette.icon,
        )}
      >
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-[1.35rem] font-black tracking-[-0.04em] text-slate-950">
        {pick(isId, category.label)}
      </h3>
      <p className="mt-2 max-w-[15rem] text-sm leading-6 text-slate-600">
        {pick(isId, category.summary)}
      </p>
      <span
        className={cn(
          'mt-5 inline-flex items-center gap-2 text-sm font-semibold',
          palette.accentText,
        )}
      >
        {isId ? 'Jelajahi' : 'Explore'}
        <ArrowRight className="h-4 w-4" />
      </span>

      <div className="pointer-events-none absolute bottom-3 right-3 w-[42%] max-w-[120px]">
        <Image
          src={category.illustration}
          alt={pick(isId, category.label)}
          width={140}
          height={120}
          className="h-auto w-full object-contain"
        />
      </div>
    </button>
  );
}

function DesktopShowcaseCard({
  item,
  isId,
}: {
  item: ShowcaseItem;
  isId: boolean;
}) {
  return (
    <article className="overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-[0_20px_36px_-34px_rgba(15,23,42,0.22)]">
      <div className="relative aspect-[1.08/0.78] overflow-hidden">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-cover transition duration-500 group-hover:scale-[1.02]"
          sizes="(min-width: 1280px) 18vw, 40vw"
        />
        {item.verified ? (
          <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/92 px-2.5 py-1 text-[11px] font-bold text-emerald-700 shadow-sm">
            <ShieldCheck className="h-3.5 w-3.5" />
            Verified
          </span>
        ) : null}
        <span className="absolute right-3 top-3 inline-flex h-10 w-10 items-center justify-center rounded-full bg-white/92 text-slate-600 shadow-sm">
          <Bookmark className="h-4.5 w-4.5" />
        </span>
      </div>
      <div className="space-y-3 p-4">
        <h3 className="text-[1.15rem] font-black leading-[1.2] tracking-[-0.04em] text-slate-950">
          {item.title}
        </h3>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <MapPin className="h-4 w-4" />
          <span>{item.location}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-slate-700">{item.rating}</span>
          <span>
            {isId ? `(${item.reviews} ulasan)` : `(${item.reviews} reviews)`}
          </span>
        </div>
        <p className="min-h-[66px] text-sm leading-6 text-slate-600">
          {pick(isId, item.description)}
        </p>
        <p className="text-sm text-slate-500">
          {isId ? 'Mulai dari ' : 'Starting at '}
          <span className="text-[1.1rem] font-black tracking-[-0.03em] text-emerald-600">
            {item.price}
          </span>
          <span className="text-slate-500">{item.unit}</span>
        </p>
        <Link
          href={item.href}
          className="inline-flex min-h-[44px] w-full items-center justify-center rounded-[16px] border border-emerald-200 bg-emerald-50 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          {isId ? 'Lihat Detail' : 'View Details'}
        </Link>
      </div>
    </article>
  );
}

function MobileShowcaseCard({
  item,
  isId,
}: {
  item: ShowcaseItem;
  isId: boolean;
}) {
  return (
    <article className="w-[calc(50vw-0.875rem)] min-w-[166px] max-w-[214px] shrink-0 overflow-hidden rounded-[18px] border border-slate-200 bg-white shadow-[0_16px_28px_-26px_rgba(15,23,42,0.22)]">
      <div className="relative aspect-[1.08/0.82] overflow-hidden">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-cover"
          sizes="(max-width: 640px) 50vw, 214px"
        />
        {item.verified ? (
          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/92 px-2 py-0.5 text-[9.5px] font-bold text-emerald-700 shadow-sm">
            <ShieldCheck className="h-3 w-3" />
            Verified
          </span>
        ) : null}
        <span className="absolute right-2 top-2 inline-flex h-8 w-8 items-center justify-center rounded-full bg-white/92 text-slate-600 shadow-sm">
          <Bookmark className="h-4 w-4" />
        </span>
      </div>
      <div className="space-y-1.5 p-2.5">
        <h3 className="line-clamp-2 text-sm font-black leading-[1.2] tracking-[-0.03em] text-slate-950">
          {item.title}
        </h3>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{item.location}</span>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
          <span className="font-semibold text-slate-700">{item.rating}</span>
          <span className="truncate">
            {isId ? `(${item.reviews} ulasan)` : `(${item.reviews} reviews)`}
          </span>
        </div>
        <p className="truncate text-[11px] text-slate-500">
          {isId ? 'Mulai dari ' : 'Starting at '}
          <span className="text-sm font-black tracking-[-0.02em] text-emerald-600">
            {item.price}
          </span>
          <span>{item.unit}</span>
        </p>
      </div>
    </article>
  );
}

function MobileRecommendationRow({
  item,
  isId,
}: {
  item: ShowcaseItem;
  isId: boolean;
}) {
  return (
    <article className="flex gap-2.5 rounded-[18px] border border-slate-200 bg-white p-2 shadow-[0_16px_28px_-26px_rgba(15,23,42,0.2)]">
      <div className="relative h-[92px] w-[92px] shrink-0 overflow-hidden rounded-[15px]">
        <Image
          src={item.image}
          alt={item.title}
          fill
          className="object-cover"
          sizes="92px"
        />
        {item.verified ? (
          <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-white/92 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 shadow-sm">
            <ShieldCheck className="h-3 w-3" />
            Verified
          </span>
        ) : null}
      </div>
      <div className="flex min-w-0 flex-1 items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-black tracking-[-0.03em] text-slate-950">
            {item.title}
          </h3>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <MapPin className="h-3.5 w-3.5 shrink-0" />
            <span className="truncate">{item.location}</span>
          </div>
          <div className="mt-1 flex items-center gap-1.5 text-[11px] text-slate-500">
            <Star className="h-3.5 w-3.5 shrink-0 fill-amber-400 text-amber-400" />
            <span className="font-semibold text-slate-700">{item.rating}</span>
            <span className="truncate">
              {isId ? `(${item.reviews} ulasan)` : `(${item.reviews} reviews)`}
            </span>
          </div>
          <p className="mt-1 line-clamp-1 text-[11px] leading-4 text-slate-600">
            {pick(isId, item.description)}
          </p>
          <p className="mt-1.5 text-[11px] text-slate-500">
            {isId ? 'Mulai dari ' : 'Starting at '}
            <span className="text-sm font-black tracking-[-0.02em] text-emerald-600">
              {item.price}
            </span>
            <span>{item.unit}</span>
          </p>
        </div>
        <Link
          href={item.href}
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-600"
          aria-label={isId ? 'Simpan rekomendasi' : 'Save recommendation'}
        >
          <Bookmark className="h-4 w-4" />
        </Link>
      </div>
    </article>
  );
}
