import { Package, Wrench, Briefcase, Home, Building2, ShieldCheck, Handshake } from 'lucide-react';
import { LucideIcon } from 'lucide-react';

/**
 * Tipe konten utama untuk filter, create flow, dan navigasi listing.
 */
export interface ContentType {
  id: string;
  icon: LucideIcon;
  nameEn: string;
  nameId: string;
  shortEn: string;
  shortId: string;
}

export const CONTENT_TYPES: ContentType[] = [
  { id: 'product', icon: Package, nameEn: 'Products', nameId: 'Produk', shortEn: 'Products', shortId: 'Produk' },
  { id: 'service', icon: Wrench, nameEn: 'Services', nameId: 'Jasa', shortEn: 'Services', shortId: 'Jasa' },
  { id: 'job', icon: Briefcase, nameEn: 'Jobs', nameId: 'Lowongan', shortEn: 'Jobs', shortId: 'Lowongan' },
  { id: 'tool_rental', icon: ShieldCheck, nameEn: 'Rentals', nameId: 'Sewa Alat', shortEn: 'Rentals', shortId: 'Sewa' },
  { id: 'business_transfer', icon: Handshake, nameEn: 'Business Transfers', nameId: 'Oper Usaha', shortEn: 'Transfer', shortId: 'Oper Usaha' },
  { id: 'company', icon: Building2, nameEn: 'Companies', nameId: 'Perusahaan', shortEn: 'Companies', shortId: 'Perusahaan' },
  { id: 'property', icon: Home, nameEn: 'Property', nameId: 'Properti', shortEn: 'Property', shortId: 'Properti' },
];

export function getContentTypeName(ct: ContentType, locale: string): string {
  return locale === 'id' ? ct.nameId : ct.nameEn;
}

export function getContentTypeShort(ct: ContentType, locale: string): string {
  return locale === 'id' ? ct.shortId : ct.shortEn;
}
