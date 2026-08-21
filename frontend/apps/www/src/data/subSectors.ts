/**
 * Sub-sectors per main sector.
 * Hierarchical: Main Sector > Sub-Sector
 * Untuk filter mendetail: pembeli, penjual, pencari kerja, dll.
 */

export interface SubSector {
  id: string;
  nameEn: string;
  nameId: string;
}

/** Map: main sector id -> sub-sectors */
export const SUB_SECTORS: Record<string, SubSector[]> = {
  energy: [
    { id: 'oil_gas', nameEn: 'Oil & Gas', nameId: 'Minyak & Gas' },
    { id: 'renewable', nameEn: 'Renewable Energy', nameId: 'Energi Terbarukan' },
    { id: 'nuclear', nameEn: 'Nuclear', nameId: 'Nuklir' },
    { id: 'utilities', nameEn: 'Utilities / Power', nameId: 'Utilitas / Kelistrikan' },
    { id: 'petroleum', nameEn: 'Petroleum Refining', nameId: 'Pengilangan Minyak' },
  ],
  technology: [
    { id: 'software', nameEn: 'Software Development', nameId: 'Pengembangan Perangkat Lunak' },
    { id: 'it_services', nameEn: 'IT Services', nameId: 'Layanan IT' },
    { id: 'ai_ml', nameEn: 'AI & Machine Learning', nameId: 'AI & Pembelajaran Mesin' },
    { id: 'cloud', nameEn: 'Cloud Computing', nameId: 'Komputasi Awan' },
    { id: 'cybersecurity', nameEn: 'Cybersecurity', nameId: 'Keamanan Siber' },
    { id: 'hardware', nameEn: 'Hardware / Electronics', nameId: 'Perangkat Keras / Elektronik' },
    { id: 'semiconductor', nameEn: 'Semiconductor', nameId: 'Semikonduktor' },
    { id: 'edtech', nameEn: 'EdTech', nameId: 'Teknologi Pendidikan' },
  ],
  healthcare: [
    { id: 'hospitals', nameEn: 'Hospitals', nameId: 'Rumah Sakit' },
    { id: 'pharma', nameEn: 'Pharmaceuticals', nameId: 'Farmasi' },
    { id: 'biotech', nameEn: 'Biotechnology', nameId: 'Bioteknologi' },
    { id: 'medical_devices', nameEn: 'Medical Devices', nameId: 'Alat Medis' },
    { id: 'telemedicine', nameEn: 'Telemedicine', nameId: 'Telemedisin' },
    { id: 'clinics', nameEn: 'Clinics', nameId: 'Klinik' },
    { id: 'health_insurance', nameEn: 'Health Insurance', nameId: 'Asuransi Kesehatan' },
  ],
  finance: [
    { id: 'banking', nameEn: 'Banking', nameId: 'Perbankan' },
    { id: 'insurance', nameEn: 'Insurance', nameId: 'Asuransi' },
    { id: 'fintech', nameEn: 'Fintech', nameId: 'Fintech' },
    { id: 'investment', nameEn: 'Investment', nameId: 'Investasi' },
    { id: 'asset_management', nameEn: 'Asset Management', nameId: 'Manajemen Aset' },
    { id: 'accounting', nameEn: 'Accounting', nameId: 'Akuntansi' },
    { id: 'audit', nameEn: 'Audit', nameId: 'Audit' },
  ],
  construction: [
    { id: 'building', nameEn: 'Building Construction', nameId: 'Konstruksi Bangunan' },
    { id: 'civil', nameEn: 'Civil Engineering', nameId: 'Teknik Sipil' },
    { id: 'architecture', nameEn: 'Architecture', nameId: 'Arsitektur' },
    { id: 'infrastructure', nameEn: 'Infrastructure', nameId: 'Infrastruktur' },
    { id: 'mep', nameEn: 'MEP (Mechanical, Electrical, Plumbing)', nameId: 'MEP (Mekanikal, Elektrikal, Plumbing)' },
    { id: 'interior', nameEn: 'Interior Design', nameId: 'Desain Interior' },
  ],
  realestate: [
    { id: 'residential', nameEn: 'Residential', nameId: 'Residensial' },
    { id: 'commercial', nameEn: 'Commercial', nameId: 'Komersial' },
    { id: 'industrial', nameEn: 'Industrial Property', nameId: 'Properti Industri' },
    { id: 'land', nameEn: 'Land', nameId: 'Tanah' },
    { id: 'property_mgmt', nameEn: 'Property Management', nameId: 'Manajemen Properti' },
    { id: 'real_estate_services', nameEn: 'Real Estate Services', nameId: 'Layanan Properti' },
  ],
  manufacturing: [
    { id: 'heavy_industry', nameEn: 'Heavy Industry', nameId: 'Industri Berat' },
    { id: 'consumer_goods', nameEn: 'Consumer Goods', nameId: 'Barang Konsumsi' },
    { id: 'industrial_equipment', nameEn: 'Industrial Equipment', nameId: 'Peralatan Industri' },
    { id: 'electronics_mfg', nameEn: 'Electronics Manufacturing', nameId: 'Manufaktur Elektronik' },
    { id: 'machinery', nameEn: 'Machinery', nameId: 'Mesin' },
    { id: 'fabrication', nameEn: 'Metal Fabrication', nameId: 'Fabrikasi Logam' },
  ],
  agriculture: [
    { id: 'farming', nameEn: 'Farming', nameId: 'Pertanian' },
    { id: 'agritech', nameEn: 'Agritech', nameId: 'Agriteknologi' },
    { id: 'food_processing', nameEn: 'Food Processing', nameId: 'Pengolahan Pangan' },
    { id: 'fisheries', nameEn: 'Fisheries', nameId: 'Perikanan' },
    { id: 'livestock', nameEn: 'Livestock', nameId: 'Peternakan' },
    { id: 'plantation', nameEn: 'Plantation', nameId: 'Perkebunan' },
  ],
  mining: [
    { id: 'metals', nameEn: 'Metals', nameId: 'Logam' },
    { id: 'minerals', nameEn: 'Minerals', nameId: 'Mineral' },
    { id: 'quarrying', nameEn: 'Quarrying', nameId: 'Penambangan Batu' },
    { id: 'smelting', nameEn: 'Smelting', nameId: 'Peleburan' },
    { id: 'coal', nameEn: 'Coal', nameId: 'Batubara' },
    { id: 'precious_metals', nameEn: 'Precious Metals', nameId: 'Logam Mulia' },
  ],
  automotive: [
    { id: 'cars', nameEn: 'Cars', nameId: 'Mobil' },
    { id: 'ev', nameEn: 'Electric Vehicles', nameId: 'Kendaraan Listrik' },
    { id: 'parts', nameEn: 'Parts & Components', nameId: 'Suku Cadang & Komponen' },
    { id: 'dealerships', nameEn: 'Dealerships', nameId: 'Dealer' },
    { id: 'motorcycles', nameEn: 'Motorcycles', nameId: 'Sepeda Motor' },
    { id: 'automotive_services', nameEn: 'Automotive Services', nameId: 'Layanan Otomotif' },
  ],
  aerospace: [
    { id: 'aviation', nameEn: 'Aviation', nameId: 'Penerbangan' },
    { id: 'defense', nameEn: 'Defense', nameId: 'Pertahanan' },
    { id: 'space', nameEn: 'Space', nameId: 'Antariksa' },
    { id: 'drones', nameEn: 'Drones', nameId: 'Drone' },
    { id: 'components', nameEn: 'Aerospace Components', nameId: 'Komponen Dirgantara' },
  ],
  telecom: [
    { id: 'mobile', nameEn: 'Mobile', nameId: 'Seluler' },
    { id: 'internet', nameEn: 'Internet', nameId: 'Internet' },
    { id: 'fiber', nameEn: 'Fiber Optics', nameId: 'Fiber Optik' },
    { id: 'satellite', nameEn: 'Satellite', nameId: 'Satelit' },
    { id: 'tower', nameEn: 'Tower / Infrastructure', nameId: 'Menara / Infrastruktur' },
  ],
  transportation: [
    { id: 'shipping', nameEn: 'Shipping', nameId: 'Pengiriman' },
    { id: 'trucking', nameEn: 'Trucking', nameId: 'Angkutan Truk' },
    { id: 'air_freight', nameEn: 'Air Freight', nameId: 'Kargo Udara' },
    { id: 'warehousing', nameEn: 'Warehousing', nameId: 'Pergudangan' },
    { id: 'logistics', nameEn: 'Logistics', nameId: 'Logistik' },
    { id: 'ride_sharing', nameEn: 'Ride Sharing', nameId: 'Transportasi Online' },
  ],
  retail: [
    { id: 'stores', nameEn: 'Stores', nameId: 'Toko' },
    { id: 'ecommerce', nameEn: 'E-commerce', nameId: 'E-commerce' },
    { id: 'd2c', nameEn: 'Direct to Consumer', nameId: 'Langsung ke Konsumen' },
    { id: 'marketplace', nameEn: 'Marketplace', nameId: 'Marketplace' },
    { id: 'wholesale', nameEn: 'Wholesale', nameId: 'Grosir' },
  ],
  hospitality: [
    { id: 'hotels', nameEn: 'Hotels', nameId: 'Hotel' },
    { id: 'restaurants', nameEn: 'Restaurants', nameId: 'Restoran' },
    { id: 'travel', nameEn: 'Travel', nameId: 'Travel' },
    { id: 'events', nameEn: 'Events', nameId: 'Acara' },
    { id: 'catering', nameEn: 'Catering', nameId: 'Katering' },
    { id: 'tourism', nameEn: 'Tourism', nameId: 'Pariwisata' },
  ],
  education: [
    { id: 'schools', nameEn: 'Schools', nameId: 'Sekolah' },
    { id: 'universities', nameEn: 'Universities', nameId: 'Universitas' },
    { id: 'edtech', nameEn: 'EdTech', nameId: 'Teknologi Pendidikan' },
    { id: 'training', nameEn: 'Training', nameId: 'Pelatihan' },
    { id: 'online_learning', nameEn: 'Online Learning', nameId: 'Pembelajaran Online' },
    { id: 'vocational', nameEn: 'Vocational', nameId: 'Kejuruan' },
  ],
  media: [
    { id: 'film', nameEn: 'Film', nameId: 'Film' },
    { id: 'music', nameEn: 'Music', nameId: 'Musik' },
    { id: 'gaming', nameEn: 'Gaming', nameId: 'Gaming' },
    { id: 'publishing', nameEn: 'Publishing', nameId: 'Penerbitan' },
    { id: 'broadcasting', nameEn: 'Broadcasting', nameId: 'Siaran' },
    { id: 'digital_media', nameEn: 'Digital Media', nameId: 'Media Digital' },
  ],
  legal: [
    { id: 'law_firms', nameEn: 'Law Firms', nameId: 'Firma Hukum' },
    { id: 'compliance', nameEn: 'Compliance', nameId: 'Kepatuhan' },
    { id: 'regulatory', nameEn: 'Regulatory', nameId: 'Regulasi' },
    { id: 'ip', nameEn: 'Intellectual Property', nameId: 'Kekayaan Intelektual' },
    { id: 'corporate_law', nameEn: 'Corporate Law', nameId: 'Hukum Korporat' },
  ],
  consulting: [
    { id: 'management', nameEn: 'Management Consulting', nameId: 'Konsultansi Manajemen' },
    { id: 'strategy', nameEn: 'Strategy', nameId: 'Strategi' },
    { id: 'hr_consulting', nameEn: 'HR Consulting', nameId: 'Konsultansi SDM' },
    { id: 'it_consulting', nameEn: 'IT Consulting', nameId: 'Konsultansi IT' },
    { id: 'advisory', nameEn: 'Advisory', nameId: 'Penasihat' },
  ],
  marketing: [
    { id: 'digital_marketing', nameEn: 'Digital Marketing', nameId: 'Pemasaran Digital' },
    { id: 'branding', nameEn: 'Branding', nameId: 'Branding' },
    { id: 'pr', nameEn: 'PR', nameId: 'Humas' },
    { id: 'advertising', nameEn: 'Advertising', nameId: 'Periklanan' },
    { id: 'content_marketing', nameEn: 'Content Marketing', nameId: 'Pemasaran Konten' },
  ],
  chemical: [
    { id: 'chemicals', nameEn: 'Chemicals', nameId: 'Bahan Kimia' },
    { id: 'plastics', nameEn: 'Plastics', nameId: 'Plastik' },
    { id: 'fertilizers', nameEn: 'Fertilizers', nameId: 'Pupuk' },
    { id: 'pharma_chem', nameEn: 'Pharma Chemicals', nameId: 'Kimia Farmasi' },
    { id: 'specialty_chem', nameEn: 'Specialty Chemicals', nameId: 'Kimia Khusus' },
  ],
  textiles: [
    { id: 'clothing', nameEn: 'Clothing', nameId: 'Pakaian' },
    { id: 'footwear', nameEn: 'Footwear', nameId: 'Alas Kaki' },
    { id: 'luxury', nameEn: 'Luxury Goods', nameId: 'Barang Mewah' },
    { id: 'fabrics', nameEn: 'Fabrics', nameId: 'Kain' },
    { id: 'garment', nameEn: 'Garment', nameId: 'Garmen' },
  ],
  food: [
    { id: 'fmcg', nameEn: 'FMCG', nameId: 'FMCG' },
    { id: 'restaurants_fb', nameEn: 'Restaurants', nameId: 'Restoran' },
    { id: 'catering_fb', nameEn: 'Catering', nameId: 'Katering' },
    { id: 'beverages', nameEn: 'Beverages', nameId: 'Minuman' },
    { id: 'food_production', nameEn: 'Food Production', nameId: 'Produksi Pangan' },
    { id: 'import_export', nameEn: 'Food Import/Export', nameId: 'Impor/Ekspor Pangan' },
  ],
  marine: [
    { id: 'ports', nameEn: 'Ports', nameId: 'Pelabuhan' },
    { id: 'shipbuilding', nameEn: 'Shipbuilding', nameId: 'Galangan Kapal' },
    { id: 'naval', nameEn: 'Naval', nameId: 'Angkatan Laut' },
    { id: 'offshore', nameEn: 'Offshore', nameId: 'Lepas Pantai' },
    { id: 'maritime_services', nameEn: 'Maritime Services', nameId: 'Layanan Maritim' },
  ],
  environmental: [
    { id: 'waste_mgmt', nameEn: 'Waste Management', nameId: 'Pengelolaan Limbah' },
    { id: 'recycling', nameEn: 'Recycling', nameId: 'Daur Ulang' },
    { id: 'sustainability', nameEn: 'Sustainability', nameId: 'Keberlanjutan' },
    { id: 'water_treatment', nameEn: 'Water Treatment', nameId: 'Pengolahan Air' },
  ],
  government: [
    { id: 'civil_service', nameEn: 'Civil Service', nameId: 'Aparatur Negara' },
    { id: 'ngo', nameEn: 'NGO', nameId: 'LSM' },
    { id: 'international', nameEn: 'International Orgs', nameId: 'Organisasi Internasional' },
    { id: 'public_sector', nameEn: 'Public Sector', nameId: 'Sektor Publik' },
  ],
};

export function getSubSectors(sectorId: string): SubSector[] {
  return SUB_SECTORS[sectorId] || [];
}

export function getSubSectorName(sub: SubSector, locale: string): string {
  return locale === 'id' ? sub.nameId : sub.nameEn;
}

export function findSubSector(sectorId: string, subId: string): SubSector | undefined {
  return getSubSectors(sectorId).find((s) => s.id === subId);
}
