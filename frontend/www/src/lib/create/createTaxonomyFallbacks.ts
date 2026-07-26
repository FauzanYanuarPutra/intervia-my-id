export type CreateTaxonomyItem = {
  id: string;
  slug: string;
  name_id?: string;
  name_en?: string;
  label_id?: string;
  label_en?: string;
};

function item(
  slug: string,
  nameId: string,
  nameEn: string,
): CreateTaxonomyItem {
  return {
    id: slug,
    slug,
    name_id: nameId,
    name_en: nameEn,
  };
}

export const FALLBACK_CREATE_SUBCATEGORIES: Record<
  string,
  CreateTaxonomyItem[]
> = {
  'materials-suppliers': [
    item('raw-materials', 'Bahan Baku Produksi', 'Raw Materials'),
    item('business-packaging', 'Kemasan Usaha', 'Business Packaging'),
    item('wholesale-stock', 'Stok Grosir', 'Wholesale Stock'),
    item('resale-products', 'Produk Jual Ulang', 'Resale Products'),
    item('supporting-materials', 'Bahan Penunjang', 'Supporting Materials'),
    item('direct-manufacturers', 'Produsen Langsung', 'Direct Manufacturers'),
    item('local-suppliers', 'Supplier Lokal', 'Local Suppliers'),
    item(
      'private-label-manufacturing',
      'Maklon & Private Label',
      'Private Label Manufacturing',
    ),
  ],
  services: [
    item('business-operations', 'Operasional Usaha', 'Business Operations'),
    item('creative-design', 'Kreatif & Desain', 'Creative & Design'),
    item('digital-technology', 'Digital & Teknologi', 'Digital & Technology'),
    item('legal-licensing', 'Legal & Perizinan', 'Legal & Licensing'),
    item('finance-accounting', 'Keuangan & Pembukuan', 'Finance & Accounting'),
    item('technical-repair', 'Teknisi & Perbaikan', 'Technical Repair'),
    item('logistics-delivery', 'Logistik & Pengiriman', 'Logistics & Delivery'),
    item(
      'production-manufacturing',
      'Produksi & Maklon',
      'Production & Manufacturing',
    ),
    item('marketing', 'Pemasaran', 'Marketing'),
    item('field-workforce', 'Tenaga Lapangan', 'Field Workforce'),
  ],
  'machines-tools': [
    item('production-machines', 'Mesin Produksi', 'Production Machines'),
    item(
      'food-beverage-machines',
      'Mesin Makanan & Minuman',
      'Food & Beverage Machines',
    ),
    item(
      'store-pos-equipment',
      'Peralatan Toko & Kasir',
      'Store & POS Equipment',
    ),
    item(
      'commercial-kitchen-equipment',
      'Peralatan Dapur Usaha',
      'Commercial Kitchen Equipment',
    ),
    item('agricultural-tools', 'Alat Pertanian', 'Agricultural Tools'),
    item('workshop-tools', 'Alat Bengkel', 'Workshop Tools'),
    item('construction-tools', 'Alat Konstruksi', 'Construction Tools'),
    item(
      'laundry-cleaning-equipment',
      'Alat Laundry & Kebersihan',
      'Laundry & Cleaning Equipment',
    ),
    item('office-equipment', 'Peralatan Kantor', 'Office Equipment'),
    item('equipment-rental', 'Sewa Mesin & Alat', 'Equipment Rental'),
    item(
      'spare-parts-components',
      'Sparepart & Komponen',
      'Spare Parts & Components',
    ),
  ],
  'business-places': [
    item('shop-houses', 'Ruko', 'Shop Houses'),
    item('kiosks', 'Kios', 'Kiosks'),
    item('booths-stalls', 'Booth & Lapak', 'Booths & Stalls'),
    item('warehouses', 'Gudang', 'Warehouses'),
    item('production-kitchens', 'Dapur Produksi', 'Production Kitchens'),
    item('offices', 'Kantor', 'Offices'),
    item('studios', 'Studio', 'Studios'),
    item('workshops', 'Workshop & Bengkel', 'Workshops'),
    item('business-land', 'Lahan Usaha', 'Business Land'),
    item(
      'shared-business-spaces',
      'Tempat Usaha Bersama',
      'Shared Business Spaces',
    ),
  ],
  'business-opportunities': [
    item('franchise', 'Franchise', 'Franchise'),
    item('partnerships', 'Kemitraan', 'Partnerships'),
    item('reseller', 'Reseller', 'Reseller'),
    item('dropshipping', 'Dropship', 'Dropshipping'),
    item('agents', 'Agen', 'Agents'),
    item('distributors', 'Distributor', 'Distributors'),
    item('consignment', 'Titip Jual', 'Consignment'),
    item(
      'production-partnerships',
      'Kerja Sama Produksi',
      'Production Partnerships',
    ),
    item(
      'marketing-partnerships',
      'Kerja Sama Pemasaran',
      'Marketing Partnerships',
    ),
    item(
      'ready-business-packages',
      'Paket Usaha Siap Jalan',
      'Ready Business Packages',
    ),
    item(
      'home-business-opportunities',
      'Peluang Usaha Rumahan',
      'Home Business Opportunities',
    ),
  ],
};

export const FALLBACK_CREATE_INDUSTRIES: CreateTaxonomyItem[] = [
  item('food-beverage', 'Makanan & Minuman', 'Food & Beverage'),
  item('laundry', 'Laundry', 'Laundry'),
  item('fashion-garment', 'Fashion & Konveksi', 'Fashion & Garment'),
  item('cosmetics-care', 'Kosmetik & Perawatan', 'Cosmetics & Care'),
  item('printing', 'Percetakan', 'Printing'),
  item('crafts', 'Kerajinan', 'Crafts'),
  item('agriculture', 'Pertanian', 'Agriculture'),
  item('livestock', 'Peternakan', 'Livestock'),
  item('fishery', 'Perikanan', 'Fishery'),
  item('automotive-workshop', 'Bengkel & Otomotif', 'Automotive & Workshop'),
  item('construction', 'Bangunan & Konstruksi', 'Building & Construction'),
  item('furniture-interior', 'Furnitur & Interior', 'Furniture & Interior'),
  item('retail', 'Retail', 'Retail'),
  item('health', 'Kesehatan', 'Health'),
  item('education', 'Pendidikan', 'Education'),
  item('technology', 'Teknologi', 'Technology'),
  item('logistics', 'Logistik', 'Logistics'),
  item('property', 'Properti', 'Property'),
  item('events', 'Event', 'Events'),
  item('tourism', 'Pariwisata', 'Tourism'),
  item('professional-services', 'Jasa Profesional', 'Professional Services'),
  item('other', 'Lainnya', 'Other'),
];

export function mergeCreateTaxonomyItems(
  primary: CreateTaxonomyItem[],
  fallback: CreateTaxonomyItem[],
): CreateTaxonomyItem[] {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter(value => {
    const slug = value.slug?.trim();
    if (!slug || seen.has(slug)) return false;
    seen.add(slug);
    return true;
  });
}
