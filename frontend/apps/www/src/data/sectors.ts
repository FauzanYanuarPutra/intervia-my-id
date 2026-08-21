import {
  Zap, Laptop, Heart, Building2, Hammer, Home, Factory, Wheat, Pickaxe, Car,
  Plane, Radio, Truck, ShoppingCart, Hotel, GraduationCap, Film, Scale, BarChart3,
  Megaphone, FlaskConical, Shirt, UtensilsCrossed, Ship, Recycle, Landmark
} from 'lucide-react';
import { LucideIcon } from 'lucide-react';

export interface Sector {
  id: string;
  icon: LucideIcon;
  nameEn: string;
  nameId: string;
  color: string;
  descEn: string;
  descId: string;
}

export const SECTORS: Sector[] = [
  { id: 'energy', icon: Zap, nameEn: 'Energy', nameId: 'Energi', color: 'bg-amber-500', descEn: 'Oil & Gas, Renewable, Nuclear, Utilities', descId: 'Minyak & Gas, Energi Terbarukan, Nuklir, Utilitas' },
  { id: 'technology', icon: Laptop, nameEn: 'Technology', nameId: 'Teknologi', color: 'bg-blue-500', descEn: 'Software, IT Services, AI, Cloud, Cybersecurity', descId: 'Perangkat Lunak, Layanan IT, AI, Cloud, Keamanan Siber' },
  { id: 'healthcare', icon: Heart, nameEn: 'Healthcare', nameId: 'Kesehatan', color: 'bg-rose-500', descEn: 'Hospitals, Pharma, Biotech, Medical Devices', descId: 'Rumah Sakit, Farmasi, Bioteknologi, Alat Medis' },
  { id: 'finance', icon: Building2, nameEn: 'Finance & Banking', nameId: 'Keuangan & Perbankan', color: 'bg-emerald-600', descEn: 'Banking, Insurance, Fintech, Investment', descId: 'Perbankan, Asuransi, Fintech, Investasi' },
  { id: 'construction', icon: Hammer, nameEn: 'Construction', nameId: 'Konstruksi', color: 'bg-orange-500', descEn: 'Building, Civil Engineering, Architecture', descId: 'Bangunan, Teknik Sipil, Arsitektur' },
  { id: 'realestate', icon: Home, nameEn: 'Real Estate', nameId: 'Properti', color: 'bg-teal-500', descEn: 'Residential, Commercial, Property Management', descId: 'Residensial, Komersial, Manajemen Properti' },
  { id: 'manufacturing', icon: Factory, nameEn: 'Manufacturing', nameId: 'Manufaktur', color: 'bg-gray-600', descEn: 'Heavy Industry, Consumer Goods, Industrial Equipment', descId: 'Industri Berat, Barang Konsumsi, Peralatan Industri' },
  { id: 'agriculture', icon: Wheat, nameEn: 'Agriculture', nameId: 'Pertanian', color: 'bg-lime-600', descEn: 'Farming, Agritech, Food Processing, Fisheries', descId: 'Pertanian, Agriteknologi, Pengolahan Pangan, Perikanan' },
  { id: 'mining', icon: Pickaxe, nameEn: 'Mining & Metals', nameId: 'Pertambangan', color: 'bg-stone-600', descEn: 'Metals, Minerals, Quarrying, Smelting', descId: 'Logam, Mineral, Penambangan, Peleburan' },
  { id: 'automotive', icon: Car, nameEn: 'Automotive', nameId: 'Otomotif', color: 'bg-red-500', descEn: 'Cars, EV, Parts, Dealerships', descId: 'Mobil, Kendaraan Listrik, Suku Cadang, Dealer' },
  { id: 'aerospace', icon: Plane, nameEn: 'Aerospace & Defense', nameId: 'Dirgantara & Pertahanan', color: 'bg-sky-600', descEn: 'Aviation, Military, Space, Drones', descId: 'Penerbangan, Militer, Antariksa, Drone' },
  { id: 'telecom', icon: Radio, nameEn: 'Telecommunications', nameId: 'Telekomunikasi', color: 'bg-sky-500', descEn: 'Mobile, Internet, Fiber, Satellite', descId: 'Seluler, Internet, Fiber Optik, Satelit' },
  { id: 'transportation', icon: Truck, nameEn: 'Transportation & Logistics', nameId: 'Transportasi & Logistik', color: 'bg-indigo-500', descEn: 'Shipping, Trucking, Air Freight, Warehousing', descId: 'Pengiriman, Truk, Kargo Udara, Pergudangan' },
  { id: 'retail', icon: ShoppingCart, nameEn: 'Retail & E-commerce', nameId: 'Ritel & E-commerce', color: 'bg-pink-500', descEn: 'Stores, Online Marketplace, D2C', descId: 'Toko, Marketplace Online, D2C' },
  { id: 'hospitality', icon: Hotel, nameEn: 'Hospitality & Tourism', nameId: 'Pariwisata & Perhotelan', color: 'bg-cyan-500', descEn: 'Hotels, Restaurants, Travel, Events', descId: 'Hotel, Restoran, Travel, Acara' },
  { id: 'education', icon: GraduationCap, nameEn: 'Education', nameId: 'Pendidikan', color: 'bg-yellow-500', descEn: 'Schools, Universities, EdTech, Training', descId: 'Sekolah, Universitas, EdTech, Pelatihan' },
  { id: 'media', icon: Film, nameEn: 'Media & Entertainment', nameId: 'Media & Hiburan', color: 'bg-blue-700', descEn: 'Film, Music, Gaming, Publishing', descId: 'Film, Musik, Gaming, Penerbitan' },
  { id: 'legal', icon: Scale, nameEn: 'Legal', nameId: 'Hukum', color: 'bg-slate-600', descEn: 'Law Firms, Compliance, Regulatory', descId: 'Firma Hukum, Kepatuhan, Regulasi' },
  { id: 'consulting', icon: BarChart3, nameEn: 'Consulting', nameId: 'Konsultansi', color: '', descEn: 'Management, Strategy, HR Consulting', descId: 'Manajemen, Strategi, Konsultansi SDM' },
  { id: 'marketing', icon: Megaphone, nameEn: 'Marketing & Advertising', nameId: 'Pemasaran & Periklanan', color: 'bg-rose-400', descEn: 'Digital Marketing, Branding, PR', descId: 'Pemasaran Digital, Branding, Humas' },
  { id: 'chemical', icon: FlaskConical, nameEn: 'Chemical & Petrochemical', nameId: 'Kimia & Petrokimia', color: 'bg-teal-600', descEn: 'Chemicals, Plastics, Fertilizers', descId: 'Bahan Kimia, Plastik, Pupuk' },
  { id: 'textiles', icon: Shirt, nameEn: 'Textiles & Fashion', nameId: 'Tekstil & Mode', color: 'bg-pink-400', descEn: 'Clothing, Footwear, Luxury Goods', descId: 'Pakaian, Alas Kaki, Barang Mewah' },
  { id: 'food', icon: UtensilsCrossed, nameEn: 'Food & Beverage', nameId: 'Makanan & Minuman', color: 'bg-orange-400', descEn: 'FMCG, Restaurants, Catering, Beverages', descId: 'FMCG, Restoran, Katering, Minuman' },
  { id: 'marine', icon: Ship, nameEn: 'Marine & Shipping', nameId: 'Maritim & Perkapalan', color: 'bg-blue-800', descEn: 'Ports, Shipbuilding, Naval, Offshore', descId: 'Pelabuhan, Galangan Kapal, Angkatan Laut, Lepas Pantai' },
  { id: 'environmental', icon: Recycle, nameEn: 'Environmental', nameId: 'Lingkungan', color: 'bg-green-500', descEn: 'Waste Management, Recycling, Sustainability', descId: 'Pengelolaan Limbah, Daur Ulang, Keberlanjutan' },
  { id: 'government', icon: Landmark, nameEn: 'Government & Public', nameId: 'Pemerintahan & Publik', color: 'bg-neutral-600', descEn: 'Civil Service, NGO, International Orgs', descId: 'Aparatur Negara, LSM, Organisasi Internasional' },
];

export function getSectorName(sector: Sector, locale: string): string {
  return locale === 'id' ? sector.nameId : sector.nameEn;
}

export function getSectorDesc(sector: Sector, locale: string): string {
  return locale === 'id' ? sector.descId : sector.descEn;
}
