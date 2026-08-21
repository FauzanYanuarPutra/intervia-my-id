export type ExploreDiscoveryMode = 'supply' | 'demand' | 'people' | 'references';

export type ExploreModeCopy = {
  value: ExploreDiscoveryMode;
  labelId: string;
  labelEn: string;
  hintId: string;
  hintEn: string;
};

export const EXPLORE_MODE_COPY: ExploreModeCopy[] = [
  {
    value: 'supply',
    labelId: 'Produk & Jasa',
    labelEn: 'Find Products & Services',
    hintId: 'Cari kebutuhan usaha',
    hintEn: 'Suppliers, materials, tools, places',
  },
  {
    value: 'demand',
    labelId: 'Cari Pembeli',
    labelEn: 'Find Potential Buyers',
    hintId: 'Untuk yang jualan',
    hintEn: 'See what buyers currently need',
  },
  {
    value: 'people',
    labelId: 'Orang & Keahlian',
    labelEn: 'Find People & Skills',
    hintId: 'Cari profil dan keahlian',
    hintEn: 'Business owners, freelancers, skills',
  },
  {
    value: 'references',
    labelId: 'Usaha di Sekitar',
    labelEn: 'Businesses Nearby',
    hintId: 'Cari lewat peta',
    hintEn: 'Find business locations on the map',
  },
];

export function exploreModeOptions(isId: boolean) {
  return EXPLORE_MODE_COPY.map(item => ({
    value: item.value,
    label: isId ? item.labelId : item.labelEn,
    hint: isId ? item.hintId : item.hintEn,
  }));
}

type CategoryCopy = {
  titleId: string;
  titleEn: string;
  descriptionId: string;
  descriptionEn: string;
  demandDescriptionId: string;
  demandDescriptionEn: string;
  placeholderId: string;
  placeholderEn: string;
  demandPlaceholderId: string;
  demandPlaceholderEn: string;
};

const CATEGORY_COPY: Record<string, CategoryCopy> = {
  supplies: {
    titleId: 'Bahan & Supplier',
    titleEn: 'Materials & Suppliers',
    descriptionId: 'Cari bahan baku, kemasan, stok grosir, atau supplier untuk kebutuhan usahamu.',
    descriptionEn: 'Find raw materials, packaging, wholesale stock, or suppliers for your business.',
    demandDescriptionId: 'Lihat pembeli yang sedang mencari bahan, kemasan, stok, atau supplier.',
    demandDescriptionEn: 'See buyers looking for materials, packaging, stock, or suppliers.',
    placeholderId: 'Contoh: supplier kemasan standing pouch Bandung',
    placeholderEn: 'Example: standing pouch supplier in Bandung',
    demandPlaceholderId: 'Contoh: pembeli butuh kemasan 1.000 pcs',
    demandPlaceholderEn: 'Example: buyer needs 1,000 packaging units',
  },
  service: {
    titleId: 'Cari Jasa',
    titleEn: 'Find Services',
    descriptionId: 'Cari jasa desain, foto produk, website, legal, pemasaran, atau kebutuhan operasional.',
    descriptionEn: 'Find design, product photography, websites, legal, marketing, or operational services.',
    demandDescriptionId: 'Lihat calon klien yang sedang mencari jasa untuk kebutuhan usahanya.',
    demandDescriptionEn: 'See potential clients currently looking for business services.',
    placeholderId: 'Contoh: jasa foto produk makanan Bandung',
    placeholderEn: 'Example: food product photography in Bandung',
    demandPlaceholderId: 'Contoh: UMKM butuh jasa desain logo',
    demandPlaceholderEn: 'Example: MSME needs logo design service',
  },
  equipment: {
    titleId: 'Mesin & Alat',
    titleEn: 'Machines & Equipment',
    descriptionId: 'Cari mesin produksi, peralatan usaha, sewa alat, teknisi, atau suku cadang.',
    descriptionEn: 'Find production machines, business equipment, rentals, technicians, or spare parts.',
    demandDescriptionId: 'Lihat orang atau usaha yang sedang mencari mesin, alat, sewa, atau teknisi.',
    demandDescriptionEn: 'See people or businesses looking for machines, equipment, rentals, or technicians.',
    placeholderId: 'Contoh: mesin sealer atau sewa freezer',
    placeholderEn: 'Example: sealing machine or freezer rental',
    demandPlaceholderId: 'Contoh: pembeli cari mesin kopi bekas',
    demandPlaceholderEn: 'Example: buyer looking for used coffee machine',
  },
  property: {
    titleId: 'Tempat Usaha',
    titleEn: 'Business Places',
    descriptionId: 'Cari ruko, kios, booth, gudang, dapur bersama, atau tempat usaha lainnya.',
    descriptionEn: 'Find shops, kiosks, booths, warehouses, shared kitchens, or other business places.',
    demandDescriptionId: 'Lihat orang atau usaha yang sedang mencari tempat untuk jualan, produksi, atau penyimpanan.',
    demandDescriptionEn: 'See people or businesses looking for places to sell, produce, or store goods.',
    placeholderId: 'Contoh: kios disewa Bandung',
    placeholderEn: 'Example: kiosk for rent in Bandung',
    demandPlaceholderId: 'Contoh: cari gudang 100 m² Bandung',
    demandPlaceholderEn: 'Example: looking for a 100 m² warehouse in Bandung',
  },
  opportunity: {
    titleId: 'Peluang Usaha',
    titleEn: 'Business Opportunities',
    descriptionId: 'Cari kemitraan, franchise, reseller, distributor, atau peluang usaha yang sesuai modalmu.',
    descriptionEn: 'Find partnerships, franchises, resellers, distributors, or opportunities that fit your budget.',
    demandDescriptionId: 'Lihat usaha yang sedang mencari reseller, distributor, mitra, atau partner baru.',
    demandDescriptionEn: 'See businesses looking for resellers, distributors, partners, or new collaborators.',
    placeholderId: 'Contoh: franchise minuman modal 10 juta',
    placeholderEn: 'Example: beverage franchise under 10 million IDR',
    demandPlaceholderId: 'Contoh: brand cari reseller Bandung',
    demandPlaceholderEn: 'Example: brand looking for resellers in Bandung',
  },
  community: {
    titleId: 'Komunitas',
    titleEn: 'Community',
    descriptionId: 'Tanya, berbagi pengalaman, dan terhubung dengan pelaku usaha yang punya minat serupa.',
    descriptionEn: 'Ask questions, share experience, and connect with business owners with similar interests.',
    demandDescriptionId: 'Tanya, berbagi pengalaman, dan terhubung dengan komunitas usaha.',
    demandDescriptionEn: 'Ask questions, share experience, and connect with business communities.',
    placeholderId: 'Contoh: komunitas frozen food Bandung',
    placeholderEn: 'Example: frozen food community Bandung',
    demandPlaceholderId: 'Contoh: komunitas frozen food Bandung',
    demandPlaceholderEn: 'Example: frozen food community Bandung',
  },
  video: {
    titleId: 'Video Usaha',
    titleEn: 'Business Videos',
    descriptionId: 'Tonton tips, tutorial, review alat, dan cerita usaha dari kreator Lajukan.',
    descriptionEn: 'Watch tips, tutorials, equipment reviews, and business stories from Lajukan creators.',
    demandDescriptionId: 'Tonton tips, tutorial, review alat, dan cerita usaha dari kreator Lajukan.',
    demandDescriptionEn: 'Watch tips, tutorials, equipment reviews, and business stories from Lajukan creators.',
    placeholderId: 'Contoh: cara kemas frozen food',
    placeholderEn: 'Example: how to package frozen food',
    demandPlaceholderId: 'Contoh: cara kemas frozen food',
    demandPlaceholderEn: 'Example: how to package frozen food',
  },
};

export function exploreCategoryCopy(
  categoryId: string,
  isId: boolean,
  side: 'supply' | 'demand' = 'supply',
) {
  const fallback = CATEGORY_COPY.supplies;
  const copy = CATEGORY_COPY[categoryId] || fallback;

  return {
    title: isId ? copy.titleId : copy.titleEn,
    description:
      side === 'demand'
        ? isId
          ? copy.demandDescriptionId
          : copy.demandDescriptionEn
        : isId
          ? copy.descriptionId
          : copy.descriptionEn,
    placeholder:
      side === 'demand'
        ? isId
          ? copy.demandPlaceholderId
          : copy.demandPlaceholderEn
        : isId
          ? copy.placeholderId
          : copy.placeholderEn,
  };
}

export const HUB_CATEGORY_COPY: Record<
  string,
  { labelId: string; labelEn: string; descriptionId: string; descriptionEn: string }
> = {
  supplies: {
    labelId: 'Bahan & Supplier',
    labelEn: 'Materials & Suppliers',
    descriptionId: 'Supplier, bahan baku, kemasan',
    descriptionEn: 'Raw materials, packaging, wholesale stock',
  },
  service: {
    labelId: 'Cari Jasa',
    labelEn: 'Find Services',
    descriptionId: 'Desain, foto produk, website, legal',
    descriptionEn: 'Design, product photography, website, legal',
  },
  equipment: {
    labelId: 'Mesin & Alat',
    labelEn: 'Machines & Equipment',
    descriptionId: 'Mesin, alat, sewa, servis',
    descriptionEn: 'Machines, tools, rentals, repairs, spare parts',
  },
  property: {
    labelId: 'Tempat Usaha',
    labelEn: 'Business Places',
    descriptionId: 'Ruko, kios, booth, gudang',
    descriptionEn: 'Shops, kiosks, booths, warehouses',
  },
  opportunity: {
    labelId: 'Peluang Usaha',
    labelEn: 'Business Opportunities',
    descriptionId: 'Franchise, reseller, mitra',
    descriptionEn: 'Partnerships, franchises, resellers',
  },
};