#!/usr/bin/env python3
"""
Generate comprehensive seed data for Lajukan marketplace
Creates 50 items per category: product, service, job, property, image, user
"""

import json
import uuid
from datetime import datetime, timedelta
import random

# Test user IDs (from identity_service migrations)
TEST_USER_IDS = [
    '00000000-0000-0000-0000-000000000001',  # admin
    '00000000-0000-0000-0000-000000000002',  # user
    '00000000-0000-0000-0000-000000000003',  # freelancer
    '00000000-0000-0000-0000-000000000004',  # employer
    '00000000-0000-0000-0000-000000000005',  # agent
]

SECTORS = [
    'technology', 'energy', 'healthcare', 'finance', 'construction',
    'realestate', 'manufacturing', 'agriculture', 'mining', 'automotive',
    'aerospace', 'telecommunications', 'transportation', 'retail',
    'hospitality', 'education', 'media', 'legal', 'consulting', 'marketing'
]

LOCATIONS = [
    'Jakarta', 'Bandung', 'Surabaya', 'Yogyakarta', 'Bali',
    'Medan', 'Semarang', 'Makassar', 'Palembang', 'Denpasar'
]

def generate_slug(title):
    """Generate URL-friendly slug from title"""
    return title.lower().replace(' ', '-').replace(',', '').replace("'", '').replace('.', '')

def generate_product_data(count=50):
    """Generate product seed data"""
    products = []
    
    product_templates = [
        # Technology
        ('Laptop Gaming ASUS ROG', 'Laptop gaming high performance dengan RTX 4060', 15000000, ['laptop', 'gaming', 'asus', 'rog', 'technology'], 'technology', 'electronics'),
        ('Smartphone Samsung Galaxy S24', 'Smartphone flagship dengan kamera 200MP', 12000000, ['smartphone', 'samsung', 'galaxy', 'mobile'], 'technology', 'mobile'),
        ('Keyboard Mechanical Corsair K70', 'Keyboard mechanical RGB dengan switch Cherry MX', 2500000, ['keyboard', 'mechanical', 'corsair', 'gaming'], 'technology', 'peripherals'),
        ('Mouse Logitech MX Master 3', 'Mouse wireless ergonomis untuk produktivitas', 1500000, ['mouse', 'wireless', 'logitech', 'productivity'], 'technology', 'peripherals'),
        ('Monitor Samsung 4K 32 inch', 'Monitor 4K UHD untuk design dan programming', 6000000, ['monitor', '4k', 'samsung', 'display'], 'technology', 'display'),
        ('Webcam Logitech C920 HD Pro', 'Webcam HD 1080p untuk video call dan streaming', 2000000, ['webcam', 'logitech', 'video', 'streaming'], 'technology', 'peripherals'),
        ('Headset SteelSeries Arctis 7', 'Headset wireless dengan surround sound 7.1', 3500000, ['headset', 'wireless', 'gaming', 'steelseries'], 'technology', 'audio'),
        ('Tablet iPad Pro 12.9 inch', 'Tablet iPad Pro dengan M2 chip untuk kreativitas', 18000000, ['tablet', 'ipad', 'apple', 'creative'], 'technology', 'tablet'),
        ('SSD Samsung 980 Pro 1TB', 'SSD NVMe PCIe 4.0 dengan kecepatan tinggi', 2500000, ['ssd', 'storage', 'samsung', 'nvme'], 'technology', 'storage'),
        ('Router TP-Link AX3000 WiFi 6', 'Router WiFi 6 dengan kecepatan hingga 3000 Mbps', 2000000, ['router', 'wifi', 'tp-link', 'networking'], 'technology', 'networking'),
        
        # Home & Living
        ('Sofa Modern 3 Seater', 'Sofa modern dengan bahan kain berkualitas tinggi', 5000000, ['sofa', 'furniture', 'home', 'living'], 'retail', 'furniture'),
        ('Dining Table Kayu Jati', 'Meja makan kayu jati dengan 6 kursi', 8000000, ['dining', 'table', 'wood', 'furniture'], 'retail', 'furniture'),
        ('Kasur King Size Spring Bed', 'Kasur spring bed king size dengan matras premium', 12000000, ['bed', 'mattress', 'furniture', 'bedroom'], 'retail', 'furniture'),
        ('Lemari Pakaian Sliding Door', 'Lemari pakaian dengan pintu geser, 3 pintu', 6000000, ['wardrobe', 'closet', 'furniture', 'storage'], 'retail', 'furniture'),
        ('TV Stand Modern Minimalis', 'TV stand modern dengan rak penyimpanan', 2500000, ['tv stand', 'furniture', 'modern', 'minimalist'], 'retail', 'furniture'),
        ('Lampu Chandelier Kristal', 'Lampu gantung kristal untuk ruang tamu mewah', 4000000, ['lamp', 'chandelier', 'lighting', 'crystal'], 'retail', 'lighting'),
        ('Gorden Blackout Premium', 'Gorden blackout untuk kamar tidur', 1500000, ['curtain', 'blackout', 'home', 'bedroom'], 'retail', 'home decor'),
        ('Karpet Persian Rug', 'Karpet persian autentik dengan motif klasik', 3500000, ['carpet', 'rug', 'persian', 'home decor'], 'retail', 'home decor'),
        ('Rak Buku Modern', 'Rak buku modern dengan 5 tingkat', 2000000, ['bookshelf', 'shelf', 'furniture', 'storage'], 'retail', 'furniture'),
        ('Cermin Dinding Dekoratif', 'Cermin dinding dekoratif dengan frame kayu', 1500000, ['mirror', 'decorative', 'home', 'wall decor'], 'retail', 'home decor'),
        
        # Fashion
        ('Jaket Kulit Pria', 'Jaket kulit asli untuk pria, desain klasik', 2500000, ['jacket', 'leather', 'mens', 'fashion'], 'retail', 'apparel'),
        ('Dress Elegan Wanita', 'Dress elegan untuk acara formal atau pesta', 1500000, ['dress', 'elegant', 'womens', 'fashion'], 'retail', 'apparel'),
        ('Sepatu Sneakers Nike Air Max', 'Sneakers Nike Air Max dengan teknologi Air', 2000000, ['sneakers', 'nike', 'shoes', 'sport'], 'retail', 'footwear'),
        ('Jam Tangan Rolex Submariner', 'Jam tangan Rolex Submariner original', 150000000, ['watch', 'rolex', 'luxury', 'timepiece'], 'retail', 'accessories'),
        ('Tas Louis Vuitton Neverfull', 'Tas Louis Vuitton Neverfull original', 25000000, ['bag', 'louis vuitton', 'luxury', 'handbag'], 'retail', 'accessories'),
        ('Kacamata Hitam Ray-Ban Aviator', 'Kacamata hitam Ray-Ban Aviator klasik', 3000000, ['sunglasses', 'ray-ban', 'accessories', 'eyewear'], 'retail', 'accessories'),
        ('Sabuk Kulit Gucci', 'Sabuk kulit Gucci dengan logo GG', 8000000, ['belt', 'gucci', 'leather', 'accessories'], 'retail', 'accessories'),
        ('Parfum Chanel No. 5', 'Parfum Chanel No. 5 original 100ml', 2500000, ['perfume', 'chanel', 'fragrance', 'beauty'], 'retail', 'beauty'),
        ('Kalung Emas 24 Karat', 'Kalung emas 24 karat dengan desain modern', 15000000, ['jewelry', 'gold', 'necklace', 'luxury'], 'retail', 'jewelry'),
        ('Tas Ransel The North Face', 'Tas ransel The North Face untuk outdoor', 3000000, ['backpack', 'north face', 'outdoor', 'travel'], 'retail', 'bags'),
        
        # Health & Beauty
        ('Serum Vitamin C untuk Wajah', 'Serum vitamin C dengan konsentrasi tinggi', 500000, ['skincare', 'serum', 'vitamin c', 'beauty'], 'retail', 'beauty'),
        ('Palet Eyeshadow 12 Warna', 'Palet eyeshadow dengan 12 warna matte dan shimmer', 350000, ['makeup', 'eyeshadow', 'palette', 'beauty'], 'retail', 'beauty'),
        ('Hair Dryer Dyson Supersonic', 'Hair dryer Dyson Supersonic dengan teknologi ion', 8000000, ['hair dryer', 'dyson', 'beauty', 'hair care'], 'retail', 'beauty'),
        ('Sikat Gigi Elektrik Oral-B', 'Sikat gigi elektrik dengan teknologi 3D cleaning', 1500000, ['toothbrush', 'electric', 'oral-b', 'health'], 'retail', 'health'),
        ('Suplemen Vitamin D3 1000 IU', 'Suplemen vitamin D3 untuk kesehatan tulang', 200000, ['supplement', 'vitamin d3', 'health', 'wellness'], 'retail', 'health'),
        ('Fitness Tracker Fitbit Charge 5', 'Fitness tracker dengan GPS dan heart rate monitor', 3500000, ['fitness tracker', 'fitbit', 'health', 'wearable'], 'retail', 'health'),
        ('Matras Yoga Premium', 'Matras yoga dengan ketebalan 6mm, non-slip', 500000, ['yoga mat', 'fitness', 'exercise', 'wellness'], 'retail', 'fitness'),
        ('Massage Gun Theragun Pro', 'Massage gun untuk recovery otot setelah olahraga', 8000000, ['massage gun', 'theragun', 'fitness', 'recovery'], 'retail', 'fitness'),
        ('Sunscreen SPF 50 PA++++', 'Sunscreen dengan SPF 50 dan PA++++', 300000, ['sunscreen', 'skincare', 'spf', 'protection'], 'retail', 'beauty'),
        ('Sheet Mask Korea 10 pcs', 'Sheet mask Korea dengan berbagai varian', 150000, ['face mask', 'sheet mask', 'korean', 'skincare'], 'retail', 'beauty'),
        
        # Food & Beverages
        ('Biji Kopi Arabica Premium', 'Biji kopi arabica dari daerah pegunungan', 200000, ['coffee', 'arabica', 'beans', 'beverage'], 'retail', 'food'),
        ('Teh Hijau Jepang Matcha', 'Teh hijau matcha premium dari Jepang', 500000, ['tea', 'matcha', 'green tea', 'japanese'], 'retail', 'food'),
        ('Madu Organik Murni', 'Madu organik murni tanpa pasteurisasi', 300000, ['honey', 'organic', 'natural', 'food'], 'retail', 'food'),
        ('Cokelat Belgia Premium', 'Cokelat Belgia dengan berbagai varian rasa', 250000, ['chocolate', 'belgian', 'premium', 'food'], 'retail', 'food'),
        ('Minyak Zaitun Extra Virgin', 'Minyak zaitun extra virgin dari Italia', 400000, ['olive oil', 'extra virgin', 'cooking', 'food'], 'retail', 'food'),
        ('Set Rempah-Rempah Premium', 'Set rempah-rempah premium berbagai varian', 500000, ['spices', 'cooking', 'premium', 'food'], 'retail', 'food'),
        ('Anggur Merah Prancis', 'Anggur merah dari Bordeaux, Prancis', 1500000, ['wine', 'red wine', 'french', 'beverage'], 'retail', 'food'),
        ('Kacang-Kacangan Premium', 'Kacang-kacangan premium berbagai varian', 300000, ['nuts', 'snacks', 'premium', 'food'], 'retail', 'food'),
        ('Protein Powder Whey', 'Protein powder whey untuk fitness', 1200000, ['protein', 'whey', 'fitness', 'supplement'], 'retail', 'food'),
        ('Sereal Organik Granola', 'Sereal organik granola dengan berbagai topping', 200000, ['cereal', 'granola', 'organic', 'breakfast'], 'retail', 'food'),
        
        # Add more variations to reach 50
        ('Laptop MacBook Pro M3', 'Laptop MacBook Pro dengan chip M3, 16GB RAM', 25000000, ['laptop', 'macbook', 'apple', 'professional'], 'technology', 'electronics'),
        ('Smartphone iPhone 15 Pro', 'Smartphone iPhone 15 Pro dengan kamera 48MP', 18000000, ['smartphone', 'iphone', 'apple', 'mobile'], 'technology', 'mobile'),
        ('Gaming Chair Ergonomic', 'Gaming chair ergonomic dengan lumbar support', 3500000, ['chair', 'gaming', 'ergonomic', 'furniture'], 'retail', 'furniture'),
        ('Smart TV Samsung 55 inch', 'Smart TV Samsung 55 inch 4K UHD', 12000000, ['tv', 'samsung', 'smart tv', '4k'], 'technology', 'electronics'),
        ('Air Purifier Dyson Pure', 'Air purifier Dyson dengan HEPA filter', 8000000, ['air purifier', 'dyson', 'health', 'home'], 'retail', 'home'),
        ('Robot Vacuum iRobot Roomba', 'Robot vacuum cleaner dengan mapping', 6000000, ['vacuum', 'robot', 'irobot', 'home'], 'retail', 'home'),
        ('Drone DJI Mavic 3', 'Drone DJI Mavic 3 dengan kamera 4K', 25000000, ['drone', 'dji', 'camera', 'technology'], 'technology', 'electronics'),
        ('Camera Canon EOS R6', 'Camera mirrorless Canon EOS R6 dengan lens kit', 35000000, ['camera', 'canon', 'mirrorless', 'photography'], 'technology', 'electronics'),
        ('Printer HP LaserJet Pro', 'Printer laser HP untuk kantor', 4000000, ['printer', 'hp', 'laser', 'office'], 'technology', 'office'),
        ('Projector Epson Home Cinema', 'Projector Epson untuk home theater', 15000000, ['projector', 'epson', 'home theater', 'entertainment'], 'technology', 'electronics'),
    ]
    
    # Generate variations to reach 50 products
    while len(products) < count:
        template = random.choice(product_templates)
        title, summary, base_price, tags, sector, category = template
        
        # Add variations
        variations = ['Premium', 'Pro', 'Plus', 'Max', 'Ultra', 'Deluxe', 'Special Edition']
        if len(products) > len(product_templates):
            variation = random.choice(variations)
            title = f"{title} {variation}"
        
        price_variation = random.uniform(0.8, 1.5)
        price = int(base_price * price_variation)
        
        product = {
            'id': str(uuid.uuid4()),
            'owner_id': random.choice(TEST_USER_IDS),
            'type': 'product',
            'slug': generate_slug(title),
            'title': title,
            'summary': summary,
            'body': f"{summary}. Produk berkualitas tinggi dengan garansi resmi.",
            'price_cents': price,
            'currency': 'IDR',
            'tags': tags,
            'cover_image': f'https://images.unsplash.com/photo-{random.randint(1500000000000, 1600000000000)}?w=800',
            'metadata': {
                'sector': sector,
                'category': category,
                'brand': tags[0].title() if tags else 'Generic',
                'location': random.choice(LOCATIONS),
            },
            'status': 'active',
            'created_at': (datetime.now() - timedelta(days=random.randint(0, 90))).isoformat(),
            'updated_at': datetime.now().isoformat(),
        }
        products.append(product)
    
    return products[:count]

def generate_service_data(count=50):
    """Generate service seed data"""
    services = []
    
    service_templates = [
        # Programming & Development
        ('Jasa Programming Website', 'Jasa pembuatan website custom dengan teknologi terbaru', 5000000, ['programming', 'website', 'development', 'web'], 'technology', 'web_development'),
        ('Jasa Mobile App Development', 'Pembuatan aplikasi mobile iOS dan Android', 10000000, ['mobile', 'app', 'development', 'ios', 'android'], 'technology', 'mobile_development'),
        ('Jasa Backend Development', 'Pengembangan backend API dengan Node.js, Python, atau Go', 8000000, ['backend', 'api', 'development', 'programming'], 'technology', 'backend_development'),
        ('Jasa Frontend Development', 'Pengembangan frontend dengan React, Vue, atau Angular', 6000000, ['frontend', 'react', 'vue', 'angular', 'development'], 'technology', 'frontend_development'),
        ('Jasa Full Stack Development', 'Pengembangan aplikasi full stack dari awal hingga deploy', 15000000, ['fullstack', 'development', 'programming', 'web'], 'technology', 'fullstack_development'),
        ('Jasa DevOps & Cloud Setup', 'Setup infrastructure cloud dan CI/CD pipeline', 12000000, ['devops', 'cloud', 'ci/cd', 'infrastructure'], 'technology', 'devops'),
        ('Jasa Database Design', 'Desain dan optimasi database untuk aplikasi', 5000000, ['database', 'design', 'sql', 'optimization'], 'technology', 'database'),
        ('Jasa Machine Learning', 'Implementasi machine learning dan AI untuk bisnis', 20000000, ['machine learning', 'ai', 'data science', 'ml'], 'technology', 'ai_ml'),
        ('Jasa Blockchain Development', 'Pengembangan aplikasi blockchain dan smart contract', 25000000, ['blockchain', 'crypto', 'smart contract', 'web3'], 'technology', 'blockchain'),
        ('Jasa Cybersecurity Audit', 'Audit keamanan sistem dan aplikasi', 15000000, ['cybersecurity', 'security', 'audit', 'penetration testing'], 'technology', 'security'),
        
        # Design & Creative
        ('Jasa UI/UX Design', 'Desain user interface dan user experience untuk aplikasi', 8000000, ['ui', 'ux', 'design', 'interface'], 'technology', 'design'),
        ('Jasa Graphic Design', 'Desain grafis untuk branding dan marketing', 3000000, ['graphic design', 'branding', 'marketing', 'design'], 'marketing', 'graphic_design'),
        ('Jasa Logo Design', 'Desain logo profesional untuk brand', 2000000, ['logo', 'branding', 'design', 'identity'], 'marketing', 'logo_design'),
        ('Jasa Video Editing', 'Editing video untuk konten marketing atau dokumentasi', 5000000, ['video', 'editing', 'production', 'content'], 'media', 'video_production'),
        ('Jasa Photography', 'Jasa fotografi untuk produk, event, atau portrait', 3000000, ['photography', 'photo', 'event', 'portrait'], 'media', 'photography'),
        ('Jasa 3D Modeling', 'Pembuatan model 3D untuk produk atau arsitektur', 10000000, ['3d', 'modeling', 'rendering', 'design'], 'technology', '3d_design'),
        ('Jasa Animation', 'Pembuatan animasi 2D atau 3D untuk konten', 15000000, ['animation', '2d', '3d', 'motion graphics'], 'media', 'animation'),
        ('Jasa Illustration', 'Jasa ilustrasi digital untuk buku atau konten', 4000000, ['illustration', 'digital art', 'art', 'creative'], 'media', 'illustration'),
        ('Jasa Brand Identity', 'Pembuatan identitas brand lengkap (logo, color, typography)', 10000000, ['branding', 'identity', 'logo', 'design'], 'marketing', 'branding'),
        ('Jasa Packaging Design', 'Desain kemasan produk yang menarik', 5000000, ['packaging', 'design', 'product', 'branding'], 'retail', 'packaging_design'),
        
        # Writing & Content
        ('Jasa Content Writing', 'Penulisan konten artikel, blog, atau website', 2000000, ['writing', 'content', 'blog', 'article'], 'media', 'content_writing'),
        ('Jasa Copywriting', 'Penulisan copy untuk iklan dan marketing', 3000000, ['copywriting', 'marketing', 'advertising', 'copy'], 'marketing', 'copywriting'),
        ('Jasa Translation', 'Jasa penerjemahan dokumen atau konten', 1500000, ['translation', 'translate', 'language', 'document'], 'media', 'translation'),
        ('Jasa Proofreading', 'Koreksi dan editing naskah atau dokumen', 1000000, ['proofreading', 'editing', 'correction', 'document'], 'media', 'editing'),
        ('Jasa Technical Writing', 'Penulisan dokumentasi teknis untuk produk', 5000000, ['technical writing', 'documentation', 'manual', 'guide'], 'technology', 'technical_writing'),
        ('Jasa Social Media Content', 'Pembuatan konten untuk social media', 2500000, ['social media', 'content', 'smm', 'marketing'], 'marketing', 'social_media'),
        ('Jasa SEO Content', 'Penulisan konten yang SEO-friendly', 3000000, ['seo', 'content', 'writing', 'optimization'], 'marketing', 'seo'),
        ('Jasa Script Writing', 'Penulisan script untuk video atau podcast', 4000000, ['script', 'writing', 'video', 'podcast'], 'media', 'script_writing'),
        ('Jasa Ghostwriting', 'Penulisan buku atau artikel atas nama klien', 8000000, ['ghostwriting', 'book', 'writing', 'author'], 'media', 'ghostwriting'),
        ('Jasa Resume Writing', 'Pembuatan CV dan resume profesional', 1500000, ['resume', 'cv', 'career', 'writing'], 'consulting', 'career'),
        
        # Marketing & Business
        ('Jasa Digital Marketing', 'Strategi dan implementasi digital marketing', 10000000, ['digital marketing', 'marketing', 'strategy', 'online'], 'marketing', 'digital_marketing'),
        ('Jasa Social Media Management', 'Manajemen akun social media untuk brand', 5000000, ['social media', 'management', 'smm', 'marketing'], 'marketing', 'social_media'),
        ('Jasa SEO Optimization', 'Optimasi SEO untuk website dan konten', 8000000, ['seo', 'optimization', 'search engine', 'marketing'], 'marketing', 'seo'),
        ('Jasa Google Ads Management', 'Manajemen iklan Google Ads untuk bisnis', 10000000, ['google ads', 'ppc', 'advertising', 'marketing'], 'marketing', 'ppc'),
        ('Jasa Facebook Ads', 'Manajemen iklan Facebook dan Instagram', 8000000, ['facebook ads', 'social media ads', 'advertising'], 'marketing', 'social_media_ads'),
        ('Jasa Email Marketing', 'Setup dan manajemen email marketing campaign', 5000000, ['email marketing', 'campaign', 'automation', 'marketing'], 'marketing', 'email_marketing'),
        ('Jasa Influencer Marketing', 'Koneksi dengan influencer untuk promosi brand', 15000000, ['influencer', 'marketing', 'promotion', 'social media'], 'marketing', 'influencer_marketing'),
        ('Jasa Market Research', 'Riset pasar dan analisis kompetitor', 12000000, ['market research', 'research', 'analysis', 'business'], 'consulting', 'market_research'),
        ('Jasa Business Consulting', 'Konsultasi bisnis dan strategi perusahaan', 20000000, ['consulting', 'business', 'strategy', 'advisory'], 'consulting', 'business_consulting'),
        ('Jasa Financial Planning', 'Perencanaan keuangan untuk individu atau bisnis', 15000000, ['financial planning', 'finance', 'investment', 'planning'], 'finance', 'financial_planning'),
        
        # Legal & Professional
        ('Jasa Legal Consulting', 'Konsultasi hukum untuk bisnis atau individu', 10000000, ['legal', 'law', 'consulting', 'advice'], 'legal', 'legal_consulting'),
        ('Jasa Accounting Services', 'Jasa akuntansi dan pembukuan untuk bisnis', 5000000, ['accounting', 'bookkeeping', 'finance', 'tax'], 'finance', 'accounting'),
        ('Jasa Tax Consulting', 'Konsultasi perpajakan dan pelaporan pajak', 8000000, ['tax', 'consulting', 'finance', 'taxation'], 'finance', 'tax_consulting'),
        ('Jasa HR Consulting', 'Konsultasi sumber daya manusia dan rekrutmen', 10000000, ['hr', 'human resources', 'recruitment', 'consulting'], 'consulting', 'hr_consulting'),
        ('Jasa Business Plan Writing', 'Pembuatan business plan untuk startup atau bisnis', 15000000, ['business plan', 'startup', 'planning', 'documentation'], 'consulting', 'business_planning'),
        ('Jasa Company Registration', 'Pendaftaran perusahaan dan pengurusan legalitas', 8000000, ['company registration', 'legal', 'business', 'registration'], 'legal', 'company_registration'),
        ('Jasa Contract Review', 'Review dan drafting kontrak bisnis', 12000000, ['contract', 'legal', 'review', 'drafting'], 'legal', 'contract_law'),
        ('Jasa Intellectual Property', 'Pendaftaran hak kekayaan intelektual', 15000000, ['ip', 'intellectual property', 'patent', 'trademark'], 'legal', 'ip_law'),
        ('Jasa Notary Services', 'Jasa notaris untuk legalisasi dokumen', 3000000, ['notary', 'legal', 'notarization', 'document'], 'legal', 'notary'),
        ('Jasa Compliance Audit', 'Audit kepatuhan regulasi untuk perusahaan', 20000000, ['compliance', 'audit', 'regulatory', 'legal'], 'legal', 'compliance'),
        
        # More services to reach 50
        ('Jasa Data Entry', 'Input data ke sistem dengan akurat dan cepat', 2000000, ['data entry', 'input', 'administrative', 'office'], 'consulting', 'data_entry'),
        ('Jasa Virtual Assistant', 'Asisten virtual untuk tugas administratif', 4000000, ['virtual assistant', 'va', 'administrative', 'support'], 'consulting', 'virtual_assistant'),
        ('Jasa Customer Support', 'Layanan customer support untuk bisnis', 5000000, ['customer support', 'support', 'service', 'helpdesk'], 'consulting', 'customer_support'),
        ('Jasa Project Management', 'Manajemen proyek untuk berbagai industri', 15000000, ['project management', 'pm', 'management', 'planning'], 'consulting', 'project_management'),
        ('Jasa Training & Workshop', 'Pelatihan dan workshop untuk karyawan', 10000000, ['training', 'workshop', 'education', 'learning'], 'education', 'training'),
        ('Jasa Event Planning', 'Perencanaan dan eksekusi event', 20000000, ['event planning', 'event', 'organizing', 'management'], 'consulting', 'event_planning'),
        ('Jasa Interior Design', 'Desain interior untuk rumah atau kantor', 15000000, ['interior design', 'design', 'home', 'decoration'], 'retail', 'interior_design'),
        ('Jasa Architecture Design', 'Desain arsitektur untuk bangunan', 30000000, ['architecture', 'design', 'building', 'construction'], 'construction', 'architecture'),
        ('Jasa Landscape Design', 'Desain landscape untuk taman atau outdoor', 12000000, ['landscape', 'design', 'garden', 'outdoor'], 'construction', 'landscape_design'),
        ('Jasa Cleaning Services', 'Jasa kebersihan untuk rumah atau kantor', 2000000, ['cleaning', 'service', 'maintenance', 'housekeeping'], 'consulting', 'cleaning'),
    ]
    
    while len(services) < count:
        template = random.choice(service_templates)
        title, summary, base_price, tags, sector, category = template
        
        if len(services) > len(service_templates):
            variations = ['Premium', 'Professional', 'Expert', 'Advanced']
            variation = random.choice(variations)
            title = f"{title} - {variation}"
        
        price_variation = random.uniform(0.8, 1.5)
        price = int(base_price * price_variation)
        
        service = {
            'id': str(uuid.uuid4()),
            'owner_id': random.choice([TEST_USER_IDS[2], TEST_USER_IDS[3]]),  # freelancer or employer
            'type': 'service',
            'slug': generate_slug(title),
            'title': title,
            'summary': summary,
            'body': f"{summary}. Layanan profesional dengan garansi kepuasan.",
            'price_cents': price,
            'currency': 'IDR',
            'tags': tags,
            'cover_image': f'https://images.unsplash.com/photo-{random.randint(1500000000000, 1600000000000)}?w=800',
            'metadata': {
                'sector': sector,
                'category': category,
                'location': random.choice(LOCATIONS),
                'work_mode': random.choice(['remote', 'onsite', 'hybrid']),
                'delivery_days': random.randint(3, 30),
            },
            'status': 'active',
            'created_at': (datetime.now() - timedelta(days=random.randint(0, 90))).isoformat(),
            'updated_at': datetime.now().isoformat(),
        }
        services.append(service)
    
    return services[:count]

def generate_job_data(count=50):
    """Generate job seed data"""
    jobs = []
    
    job_templates = [
        # Technology
        ('Full Stack Developer', 'Mencari full stack developer berpengalaman dengan React dan Node.js', 15000000, ['developer', 'fullstack', 'react', 'node.js'], 'technology', 'mid'),
        ('DevOps Engineer', 'DevOps engineer untuk setup CI/CD dan cloud infrastructure', 20000000, ['devops', 'cloud', 'ci/cd', 'infrastructure'], 'technology', 'senior'),
        ('Mobile Developer', 'Mobile developer untuk iOS dan Android development', 18000000, ['mobile', 'ios', 'android', 'development'], 'technology', 'mid'),
        ('Data Scientist', 'Data scientist untuk analisis data dan machine learning', 25000000, ['data science', 'machine learning', 'ai', 'analytics'], 'technology', 'senior'),
        ('UI/UX Designer', 'UI/UX designer untuk desain aplikasi mobile dan web', 12000000, ['ui', 'ux', 'design', 'interface'], 'technology', 'mid'),
        ('Backend Developer', 'Backend developer dengan Python atau Go', 16000000, ['backend', 'python', 'go', 'api'], 'technology', 'mid'),
        ('Frontend Developer', 'Frontend developer dengan React atau Vue.js', 14000000, ['frontend', 'react', 'vue', 'javascript'], 'technology', 'mid'),
        ('QA Engineer', 'QA engineer untuk testing aplikasi web dan mobile', 10000000, ['qa', 'testing', 'quality assurance', 'test'], 'technology', 'mid'),
        ('Product Manager', 'Product manager untuk produk teknologi', 22000000, ['product manager', 'pm', 'product', 'management'], 'technology', 'senior'),
        ('Tech Lead', 'Tech lead untuk memimpin tim development', 30000000, ['tech lead', 'lead', 'engineering', 'management'], 'technology', 'senior'),
        
        # Finance
        ('Investment Analyst', 'Investment analyst untuk analisis pasar keuangan', 18000000, ['investment', 'finance', 'analyst', 'financial'], 'finance', 'mid'),
        ('Financial Advisor', 'Financial advisor untuk konsultasi keuangan', 15000000, ['finance', 'advisor', 'consulting', 'financial planning'], 'finance', 'mid'),
        ('Accountant', 'Accountant untuk pembukuan dan laporan keuangan', 8000000, ['accountant', 'accounting', 'finance', 'bookkeeping'], 'finance', 'junior'),
        ('Risk Management Officer', 'Risk management officer untuk analisis risiko', 20000000, ['risk', 'management', 'finance', 'analysis'], 'finance', 'senior'),
        ('Auditor', 'Auditor untuk audit keuangan perusahaan', 16000000, ['auditor', 'audit', 'finance', 'accounting'], 'finance', 'mid'),
        
        # Healthcare
        ('ICU Nurse', 'Perawat ICU dengan pengalaman minimal 3 tahun', 12000000, ['nurse', 'icu', 'healthcare', 'medical'], 'healthcare', 'mid'),
        ('Medical Sales Representative', 'Medical sales untuk produk farmasi', 10000000, ['medical', 'sales', 'pharmaceutical', 'healthcare'], 'healthcare', 'mid'),
        ('General Practitioner', 'Dokter umum untuk klinik atau rumah sakit', 25000000, ['doctor', 'gp', 'medical', 'healthcare'], 'healthcare', 'senior'),
        ('Pharmacist', 'Apoteker untuk apotek atau rumah sakit', 15000000, ['pharmacist', 'pharmacy', 'medical', 'healthcare'], 'healthcare', 'mid'),
        ('Medical Laboratory Technician', 'Teknisi laboratorium medis', 8000000, ['laboratory', 'medical', 'technician', 'healthcare'], 'healthcare', 'junior'),
        
        # Other sectors
        ('Site Engineer', 'Site engineer untuk proyek konstruksi', 15000000, ['engineer', 'construction', 'site', 'civil'], 'construction', 'mid'),
        ('Architect', 'Arsitek untuk desain bangunan', 20000000, ['architect', 'architecture', 'design', 'construction'], 'construction', 'senior'),
        ('Marketing Manager', 'Marketing manager untuk strategi pemasaran', 18000000, ['marketing', 'manager', 'strategy', 'digital marketing'], 'marketing', 'senior'),
        ('Sales Manager', 'Sales manager untuk tim penjualan', 16000000, ['sales', 'manager', 'business', 'revenue'], 'marketing', 'mid'),
        ('HR Manager', 'HR manager untuk manajemen sumber daya manusia', 15000000, ['hr', 'human resources', 'management', 'recruitment'], 'consulting', 'senior'),
        ('Operations Manager', 'Operations manager untuk operasional perusahaan', 20000000, ['operations', 'manager', 'management', 'business'], 'consulting', 'senior'),
        ('Project Manager', 'Project manager untuk manajemen proyek', 18000000, ['project manager', 'pm', 'management', 'planning'], 'consulting', 'mid'),
        ('Business Analyst', 'Business analyst untuk analisis bisnis', 14000000, ['business analyst', 'analysis', 'business', 'consulting'], 'consulting', 'mid'),
        ('Legal Counsel', 'Legal counsel untuk konsultasi hukum perusahaan', 25000000, ['legal', 'lawyer', 'counsel', 'law'], 'legal', 'senior'),
        ('Content Writer', 'Content writer untuk konten marketing', 8000000, ['content', 'writer', 'writing', 'marketing'], 'media', 'junior'),
        ('Graphic Designer', 'Graphic designer untuk desain grafis', 10000000, ['graphic design', 'design', 'creative', 'art'], 'media', 'mid'),
        ('Video Editor', 'Video editor untuk produksi konten video', 12000000, ['video', 'editing', 'production', 'media'], 'media', 'mid'),
        ('Social Media Specialist', 'Social media specialist untuk manajemen media sosial', 9000000, ['social media', 'smm', 'marketing', 'content'], 'marketing', 'junior'),
        ('SEO Specialist', 'SEO specialist untuk optimasi search engine', 11000000, ['seo', 'search engine', 'optimization', 'marketing'], 'marketing', 'mid'),
        ('Customer Service', 'Customer service untuk layanan pelanggan', 6000000, ['customer service', 'support', 'service', 'helpdesk'], 'consulting', 'junior'),
        ('Administrative Assistant', 'Asisten administrasi untuk tugas administratif', 7000000, ['administrative', 'assistant', 'office', 'admin'], 'consulting', 'junior'),
        ('Warehouse Manager', 'Warehouse manager untuk manajemen gudang', 12000000, ['warehouse', 'logistics', 'management', 'supply chain'], 'transportation', 'mid'),
        ('Logistics Coordinator', 'Logistics coordinator untuk koordinasi logistik', 10000000, ['logistics', 'coordinator', 'supply chain', 'transportation'], 'transportation', 'mid'),
        ('Quality Control Inspector', 'Quality control inspector untuk inspeksi kualitas', 9000000, ['quality control', 'qc', 'inspection', 'manufacturing'], 'manufacturing', 'mid'),
        ('Production Supervisor', 'Production supervisor untuk supervisi produksi', 13000000, ['production', 'supervisor', 'manufacturing', 'management'], 'manufacturing', 'mid'),
        ('Mechanical Engineer', 'Mechanical engineer untuk desain mesin', 16000000, ['mechanical', 'engineer', 'engineering', 'design'], 'manufacturing', 'mid'),
        ('Electrical Engineer', 'Electrical engineer untuk sistem kelistrikan', 15000000, ['electrical', 'engineer', 'engineering', 'power'], 'energy', 'mid'),
        ('Civil Engineer', 'Civil engineer untuk proyek infrastruktur', 17000000, ['civil', 'engineer', 'construction', 'infrastructure'], 'construction', 'mid'),
        ('Mining Engineer', 'Mining engineer untuk operasi pertambangan', 20000000, ['mining', 'engineer', 'mineral', 'extraction'], 'mining', 'senior'),
        ('Petroleum Engineer', 'Petroleum engineer untuk industri minyak dan gas', 25000000, ['petroleum', 'engineer', 'oil', 'gas'], 'energy', 'senior'),
        ('Environmental Consultant', 'Environmental consultant untuk konsultasi lingkungan', 18000000, ['environmental', 'consultant', 'sustainability', 'environment'], 'consulting', 'senior'),
        ('Real Estate Agent', 'Real estate agent untuk penjualan properti', 12000000, ['real estate', 'agent', 'property', 'sales'], 'realestate', 'mid'),
        ('Property Manager', 'Property manager untuk manajemen properti', 15000000, ['property', 'manager', 'real estate', 'management'], 'realestate', 'mid'),
        ('Hotel Manager', 'Hotel manager untuk manajemen hotel', 20000000, ['hotel', 'manager', 'hospitality', 'management'], 'hospitality', 'senior'),
        ('Chef', 'Chef untuk restoran atau hotel', 15000000, ['chef', 'culinary', 'cooking', 'restaurant'], 'hospitality', 'mid'),
        ('Teacher', 'Guru untuk sekolah atau institusi pendidikan', 8000000, ['teacher', 'education', 'teaching', 'school'], 'education', 'junior'),
        ('Lecturer', 'Dosen untuk universitas atau perguruan tinggi', 15000000, ['lecturer', 'university', 'education', 'teaching'], 'education', 'mid'),
    ]
    
    while len(jobs) < count:
        template = random.choice(job_templates)
        title, summary, base_salary, tags, sector, level = template
        
        if len(jobs) > len(job_templates):
            variations = ['Senior', 'Junior', 'Lead', 'Principal']
            variation = random.choice(variations)
            title = f"{variation} {title}"
        
        salary_variation = random.uniform(0.8, 1.3)
        salary = int(base_salary * salary_variation)
        
        job = {
            'id': str(uuid.uuid4()),
            'owner_id': TEST_USER_IDS[3],  # employer
            'type': 'job',
            'slug': generate_slug(title),
            'title': title,
            'summary': summary,
            'body': f"{summary}. Kualifikasi: minimal 3 tahun pengalaman, kemampuan komunikasi yang baik.",
            'price_cents': salary,
            'currency': 'IDR',
            'tags': tags,
            'cover_image': f'https://images.unsplash.com/photo-{random.randint(1500000000000, 1600000000000)}?w=800',
            'metadata': {
                'sector': sector,
                'level': level,
                'location': random.choice(LOCATIONS),
                'work_mode': random.choice(['full-time', 'part-time', 'contract', 'freelance']),
                'employment_type': random.choice(['permanent', 'contract', 'internship']),
            },
            'status': 'active',
            'created_at': (datetime.now() - timedelta(days=random.randint(0, 90))).isoformat(),
            'updated_at': datetime.now().isoformat(),
        }
        jobs.append(job)
    
    return jobs[:count]

def generate_property_data(count=50):
    """Generate property seed data"""
    properties = []
    
    property_templates = [
        # Residential
        ('Rumah di Jakarta Selatan', 'Rumah 2 lantai dengan 3 kamar tidur di Jakarta Selatan', 2500000000, ['house', 'residential', 'jakarta'], 'Jakarta', 'house'),
        ('Apartemen di SCBD', 'Apartemen 2BR di kawasan SCBD Jakarta', 1800000000, ['apartment', 'scbd', 'jakarta'], 'Jakarta', 'apartment'),
        ('Villa di Bali Canggu', 'Villa mewah dengan kolam renang di Canggu Bali', 4500000000, ['villa', 'bali', 'canggu', 'luxury'], 'Bali', 'villa'),
        ('Rumah di Bandung', 'Rumah minimalis dengan taman di Bandung', 1200000000, ['house', 'bandung', 'residential'], 'Bandung', 'house'),
        ('Townhouse di Tangerang', 'Townhouse modern di Alam Sutera Tangerang', 2000000000, ['townhouse', 'tangerang', 'alam sutera'], 'Tangerang', 'townhouse'),
        ('Rumah di Surabaya', 'Rumah dengan 4 kamar tidur di Surabaya', 1500000000, ['house', 'surabaya', 'residential'], 'Surabaya', 'house'),
        ('Apartemen di Menteng', 'Apartemen 1BR di kawasan Menteng Jakarta', 1200000000, ['apartment', 'menteng', 'jakarta'], 'Jakarta', 'apartment'),
        ('Villa di Seminyak', 'Villa dengan view pantai di Seminyak Bali', 5000000000, ['villa', 'seminyak', 'bali', 'luxury'], 'Bali', 'villa'),
        ('Rumah di Yogyakarta', 'Rumah tradisional Joglo di Yogyakarta', 800000000, ['house', 'yogyakarta', 'traditional'], 'Yogyakarta', 'house'),
        ('Apartemen di Sudirman', 'Apartemen 3BR di kawasan Sudirman Jakarta', 2500000000, ['apartment', 'sudirman', 'jakarta'], 'Jakarta', 'apartment'),
        
        # Commercial
        ('Ruko di Jakarta Pusat', 'Ruko 2 lantai di lokasi strategis Jakarta Pusat', 3500000000, ['ruko', 'commercial', 'jakarta'], 'Jakarta', 'commercial'),
        ('Kantor di SCBD', 'Kantor di gedung perkantoran SCBD Jakarta', 5000000000, ['office', 'scbd', 'jakarta', 'commercial'], 'Jakarta', 'office'),
        ('Gudang di Cikarang', 'Gudang untuk industri di Cikarang', 8000000000, ['warehouse', 'cikarang', 'industrial'], 'Cikarang', 'warehouse'),
        ('Toko di Mall', 'Toko di mall untuk retail', 2000000000, ['shop', 'mall', 'retail', 'commercial'], 'Jakarta', 'commercial'),
        ('Kios di Pasar', 'Kios di pasar tradisional', 500000000, ['kios', 'market', 'commercial'], 'Jakarta', 'commercial'),
        ('Showroom Mobil', 'Showroom mobil di lokasi strategis', 6000000000, ['showroom', 'automotive', 'commercial'], 'Jakarta', 'commercial'),
        ('Restoran di Kemang', 'Restoran di kawasan Kemang Jakarta', 4000000000, ['restaurant', 'kemang', 'commercial'], 'Jakarta', 'commercial'),
        ('Cafe di Bandung', 'Cafe dengan konsep modern di Bandung', 2500000000, ['cafe', 'bandung', 'commercial'], 'Bandung', 'commercial'),
        ('Hotel di Bali', 'Hotel dengan 50 kamar di Bali', 15000000000, ['hotel', 'bali', 'hospitality'], 'Bali', 'hotel'),
        ('Kos-kosan di Yogyakarta', 'Kos-kosan dengan 20 kamar di Yogyakarta', 2000000000, ['boarding house', 'yogyakarta', 'residential'], 'Yogyakarta', 'boarding_house'),
        
        # Land
        ('Tanah di Jakarta Selatan', 'Tanah kavling siap bangun di Jakarta Selatan', 5000000000, ['land', 'jakarta', 'plot'], 'Jakarta', 'land'),
        ('Tanah di Bandung', 'Tanah untuk investasi di Bandung', 2000000000, ['land', 'bandung', 'investment'], 'Bandung', 'land'),
        ('Tanah di Bali', 'Tanah dengan view pantai di Bali', 8000000000, ['land', 'bali', 'beach'], 'Bali', 'land'),
        ('Tanah di Cikarang', 'Tanah untuk industri di Cikarang', 3000000000, ['land', 'cikarang', 'industrial'], 'Cikarang', 'land'),
        ('Tanah di Surabaya', 'Tanah di lokasi strategis Surabaya', 2500000000, ['land', 'surabaya', 'strategic'], 'Surabaya', 'land'),
        
        # More properties to reach 50
        ('Rumah di Depok', 'Rumah dengan 3 kamar tidur di Depok', 900000000, ['house', 'depok', 'residential'], 'Depok', 'house'),
        ('Apartemen di BSD', 'Apartemen 2BR di BSD City Tangerang', 1500000000, ['apartment', 'bsd', 'tangerang'], 'Tangerang', 'apartment'),
        ('Villa di Ubud', 'Villa dengan view sawah di Ubud Bali', 4000000000, ['villa', 'ubud', 'bali'], 'Bali', 'villa'),
        ('Rumah di Bekasi', 'Rumah minimalis di Bekasi', 1100000000, ['house', 'bekasi', 'residential'], 'Bekasi', 'house'),
        ('Apartemen di Kelapa Gading', 'Apartemen 1BR di Kelapa Gading Jakarta', 1300000000, ['apartment', 'kelapa gading', 'jakarta'], 'Jakarta', 'apartment'),
        ('Rumah di Medan', 'Rumah dengan 4 kamar tidur di Medan', 1400000000, ['house', 'medan', 'residential'], 'Medan', 'house'),
        ('Apartemen di Semarang', 'Apartemen 2BR di Semarang', 800000000, ['apartment', 'semarang'], 'Semarang', 'apartment'),
        ('Villa di Sanur', 'Villa dengan kolam renang di Sanur Bali', 4200000000, ['villa', 'sanur', 'bali'], 'Bali', 'villa'),
        ('Rumah di Makassar', 'Rumah dengan 3 kamar tidur di Makassar', 1000000000, ['house', 'makassar', 'residential'], 'Makassar', 'house'),
        ('Apartemen di Palembang', 'Apartemen 2BR di Palembang', 700000000, ['apartment', 'palembang'], 'Palembang', 'apartment'),
        ('Rumah di Solo', 'Rumah tradisional di Solo', 600000000, ['house', 'solo', 'traditional'], 'Solo', 'house'),
        ('Apartemen di Denpasar', 'Apartemen 1BR di Denpasar Bali', 900000000, ['apartment', 'denpasar', 'bali'], 'Denpasar', 'apartment'),
        ('Rumah di Malang', 'Rumah dengan taman di Malang', 800000000, ['house', 'malang', 'residential'], 'Malang', 'house'),
        ('Villa di Nusa Dua', 'Villa mewah di Nusa Dua Bali', 6000000000, ['villa', 'nusa dua', 'bali', 'luxury'], 'Bali', 'villa'),
        ('Rumah di Bogor', 'Rumah dengan view gunung di Bogor', 1200000000, ['house', 'bogor', 'residential'], 'Bogor', 'house'),
        ('Apartemen di Batam', 'Apartemen 2BR di Batam', 1000000000, ['apartment', 'batam'], 'Batam', 'apartment'),
        ('Rumah di Padang', 'Rumah dengan 3 kamar tidur di Padang', 700000000, ['house', 'padang', 'residential'], 'Padang', 'house'),
        ('Villa di Jimbaran', 'Villa dengan view sunset di Jimbaran Bali', 4800000000, ['villa', 'jimbaran', 'bali'], 'Bali', 'villa'),
        ('Rumah di Pontianak', 'Rumah dengan 4 kamar tidur di Pontianak', 900000000, ['house', 'pontianak', 'residential'], 'Pontianak', 'house'),
        ('Apartemen di Balikpapan', 'Apartemen 2BR di Balikpapan', 1100000000, ['apartment', 'balikpapan'], 'Balikpapan', 'apartment'),
        ('Rumah di Banjarmasin', 'Rumah dengan 3 kamar tidur di Banjarmasin', 600000000, ['house', 'banjarmasin', 'residential'], 'Banjarmasin', 'house'),
        ('Villa di Amed', 'Villa dengan view laut di Amed Bali', 3500000000, ['villa', 'amed', 'bali'], 'Bali', 'villa'),
        ('Rumah di Samarinda', 'Rumah dengan taman di Samarinda', 800000000, ['house', 'samarinda', 'residential'], 'Samarinda', 'house'),
        ('Apartemen di Manado', 'Apartemen 1BR di Manado', 700000000, ['apartment', 'manado'], 'Manado', 'apartment'),
        ('Rumah di Pekanbaru', 'Rumah dengan 4 kamar tidur di Pekanbaru', 850000000, ['house', 'pekanbaru', 'residential'], 'Pekanbaru', 'house'),
        ('Villa di Lovina', 'Villa dengan kolam renang di Lovina Bali', 3800000000, ['villa', 'lovina', 'bali'], 'Bali', 'villa'),
    ]
    
    while len(properties) < count:
        template = random.choice(property_templates)
        title, summary, base_price, tags, location, property_type = template
        
        if len(properties) > len(property_templates):
            variations = ['Mewah', 'Premium', 'Eksklusif', 'Strategis']
            variation = random.choice(variations)
            title = f"{title} - {variation}"
        
        price_variation = random.uniform(0.9, 1.2)
        price = int(base_price * price_variation)
        
        property_data = {
            'id': str(uuid.uuid4()),
            'owner_id': TEST_USER_IDS[4],  # agent
            'type': 'property',
            'slug': generate_slug(title),
            'title': title,
            'summary': summary,
            'body': f"{summary}. Properti dengan sertifikat lengkap dan lokasi strategis.",
            'price_cents': price,
            'currency': 'IDR',
            'tags': tags,
            'cover_image': f'https://images.unsplash.com/photo-{random.randint(1500000000000, 1600000000000)}?w=800',
            'metadata': {
                'sector': 'realestate',
                'property_type': property_type,
                'location': location,
                'listing_type': random.choice(['sale', 'rent']),
                'bedrooms': random.randint(1, 5) if property_type in ['house', 'apartment', 'villa'] else None,
                'bathrooms': random.randint(1, 4) if property_type in ['house', 'apartment', 'villa'] else None,
            },
            'status': 'active',
            'created_at': (datetime.now() - timedelta(days=random.randint(0, 90))).isoformat(),
            'updated_at': datetime.now().isoformat(),
        }
        properties.append(property_data)
    
    return properties[:count]

def generate_image_data(count=50):
    """Generate image content items"""
    images = []
    
    image_categories = [
        ('Foto Produk', 'product'),
        ('Foto Jasa', 'service'),
        ('Foto Lowongan', 'job'),
        ('Foto Properti', 'property'),
        ('Foto Portfolio', 'portfolio'),
        ('Foto Event', 'event'),
        ('Foto Landscape', 'landscape'),
        ('Foto Portrait', 'portrait'),
        ('Foto Makanan', 'food'),
        ('Foto Fashion', 'fashion'),
    ]
    
    for i in range(count):
        category_title, category = random.choice(image_categories)
        title = f"{category_title} - {i+1}"
        
        image = {
            'id': str(uuid.uuid4()),
            'owner_id': random.choice(TEST_USER_IDS),
            'type': 'image',
            'slug': generate_slug(title),
            'title': title,
            'summary': f'Gambar {category_title.lower()} berkualitas tinggi',
            'body': f'Gambar {category_title.lower()} dengan resolusi tinggi, cocok untuk berbagai keperluan.',
            'price_cents': random.randint(50000, 500000),
            'currency': 'IDR',
            'tags': [category, 'image', 'photo', 'photography'],
            'cover_image': f'https://images.unsplash.com/photo-{random.randint(1500000000000, 1600000000000)}?w=800',
            'metadata': {
                'sector': random.choice(SECTORS),
                'category': category,
                'image_type': category,
                'resolution': random.choice(['HD', 'Full HD', '4K']),
            },
            'status': 'active',
            'created_at': (datetime.now() - timedelta(days=random.randint(0, 90))).isoformat(),
            'updated_at': datetime.now().isoformat(),
        }
        images.append(image)
    
    return images

def generate_user_content_data(count=50):
    """Generate user profile content items"""
    users = []
    
    professions = [
        'Freelancer', 'Designer', 'Developer', 'Writer', 'Consultant',
        'Photographer', 'Videographer', 'Marketer', 'Accountant', 'Lawyer',
        'Engineer', 'Architect', 'Doctor', 'Teacher', 'Chef',
    ]
    
    for i in range(count):
        profession = random.choice(professions)
        title = f"{profession} Professional - User {i+1}"
        
        user_content = {
            'id': str(uuid.uuid4()),
            'owner_id': random.choice(TEST_USER_IDS),
            'type': 'user',
            'slug': generate_slug(title),
            'title': title,
            'summary': f'Profil {profession.lower()} profesional dengan pengalaman luas',
            'body': f'Profil {profession.lower()} profesional dengan portofolio dan pengalaman yang luas di bidangnya.',
            'price_cents': None,
            'currency': 'IDR',
            'tags': [profession.lower(), 'professional', 'user', 'profile'],
            'cover_image': f'https://images.unsplash.com/photo-{random.randint(1500000000000, 1600000000000)}?w=800',
            'metadata': {
                'sector': random.choice(SECTORS),
                'profession': profession,
                'location': random.choice(LOCATIONS),
                'experience_years': random.randint(1, 20),
            },
            'status': 'active',
            'created_at': (datetime.now() - timedelta(days=random.randint(0, 90))).isoformat(),
            'updated_at': datetime.now().isoformat(),
        }
        users.append(user_content)
    
    return users

def main():
    """Generate all seed data"""
    print("Generating seed data...")
    
    products = generate_product_data(50)
    services = generate_service_data(50)
    jobs = generate_job_data(50)
    properties = generate_property_data(50)
    images = generate_image_data(50)
    users = generate_user_content_data(50)
    
    all_data = {
        'products': products,
        'services': services,
        'jobs': jobs,
        'properties': properties,
        'images': images,
        'users': users,
    }
    
    # Save to JSON file
    with open('seed_data.json', 'w', encoding='utf-8') as f:
        json.dump(all_data, f, indent=2, ensure_ascii=False)
    
    # Generate SQL INSERT statements
    sql_lines = []
    sql_lines.append("-- Comprehensive seed data generated by generate_seed_data.py")
    sql_lines.append("-- Categories: product (50), service (50), job (50), property (50), image (50), user (50)")
    sql_lines.append("")
    
    for category, items in all_data.items():
        sql_lines.append(f"-- {category.upper()} ({len(items)} items)")
        sql_lines.append("INSERT INTO content_items (")
        sql_lines.append("  id, owner_id, type, slug, title, summary, body, price_cents, currency,")
        sql_lines.append("  tags, cover_image, metadata, status, created_at, updated_at")
        sql_lines.append(") VALUES")
        
        for i, item in enumerate(items):
            tags_str = "ARRAY[" + ", ".join([f"'{tag}'" for tag in item['tags']]) + "]"
            metadata_str = f"'{json.dumps(item['metadata'])}'::jsonb"
            price = item['price_cents'] if item['price_cents'] else 'NULL'
            
            # Escape single quotes for SQL
            title_escaped = item['title'].replace("'", "''")
            summary_escaped = item['summary'].replace("'", "''")
            body_escaped = item['body'].replace("'", "''")
            
            sql_line = f"('{item['id']}', '{item['owner_id']}', '{item['type']}', '{item['slug']}', "
            sql_line += f"'{title_escaped}', '{summary_escaped}', "
            sql_line += f"'{body_escaped}', {price}, '{item['currency']}', "
            sql_line += f"{tags_str}, '{item['cover_image']}', {metadata_str}, '{item['status']}', "
            sql_line += f"'{item['created_at']}', '{item['updated_at']}')"
            
            if i < len(items) - 1:
                sql_line += ","
            else:
                sql_line += ";"
            
            sql_lines.append(sql_line)
        
        sql_lines.append("")
    
    # Save SQL file
    with open('seed_data.sql', 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_lines))
    
    print(f"Generated:")
    print(f"  - {len(products)} products")
    print(f"  - {len(services)} services")
    print(f"  - {len(jobs)} jobs")
    print(f"  - {len(properties)} properties")
    print(f"  - {len(images)} images")
    print(f"  - {len(users)} user content items")
    print(f"\nTotal: {len(products) + len(services) + len(jobs) + len(properties) + len(images) + len(users)} items")
    print("\nFiles generated:")
    print("  - seed_data.json")
    print("  - seed_data.sql")

if __name__ == '__main__':
    main()
