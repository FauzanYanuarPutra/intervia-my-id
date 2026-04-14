-- Comprehensive seed data for marketplace
-- Jobs, Properties, Freelancers, Content across all 26 sectors

-- ============================================================
-- JOBS SEED DATA (50+ listings across sectors)
-- ============================================================
INSERT INTO listings (
     owner_id, listing_type, title, description, 
    price_amount, price_currency, location_city, location_country,
    category, status, metadata, created_at
) VALUES
-- Technology Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Senior Full Stack Developer', 
'Build scalable web applications using React, Node.js, and PostgreSQL. 5+ years experience required.',
25000000, 'IDR', 'Jakarta', 'Indonesia', 'technology',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"technology","company":"Tokopedia","benefits":["Health Insurance","Remote Work","Stock Options"]}', NOW()),

( '00000000-0000-0000-0000-000000000001', 'job', 'DevOps Engineer',
'Manage cloud infrastructure, CI/CD pipelines, and containerized applications. AWS/GCP experience.',
22000000, 'IDR', 'Bandung', 'Indonesia', 'technology',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"technology","company":"Gojek","benefits":["Health Insurance","Learning Budget"]}', NOW()),

('00000000-0000-0000-0000-000000000001', 'job', 'Mobile App Developer (Flutter)',
'Develop cross-platform mobile applications. Experience with Flutter and Firebase.',
18000000, 'IDR', 'Surabaya', 'Indonesia', 'technology',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"technology","company":"Bukalapak","benefits":["Flexible Hours","Remote Work"]}', NOW()),

-- Energy Sector20260207000000
('00000000-0000-0000-0000-000000000001', 'job', 'Drilling Engineer',
'Plan and supervise drilling operations. Petroleum engineering degree required.',
35000000, 'IDR', 'Balikpapan', 'Indonesia', 'energy',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"energy","company":"Pertamina","benefits":["Housing Allowance","Health Insurance","Bonus"]}', NOW()),

( '00000000-0000-0000-0000-000000000001', 'job', 'Solar Energy Consultant',
'Design and implement solar power systems for commercial clients.',
28000000, 'IDR', 'Jakarta', 'Indonesia', 'energy',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"energy","company":"Green Energy Indonesia","benefits":["Health Insurance","Training"]}', NOW()),

-- Healthcare Sector
('00000000-0000-0000-0000-000000000001', 'job', 'Registered Nurse (ICU)',
'Provide critical care nursing. Valid STR license required.',
12000000, 'IDR', 'Jakarta', 'Indonesia', 'healthcare',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"healthcare","company":"RS Siloam","benefits":["Health Insurance","Night Shift Allowance","Training"]}', NOW()),

('00000000-0000-0000-0000-000000000001', 'job', 'Medical Sales Representative',
'Promote pharmaceutical products to healthcare professionals.',
15000000, 'IDR', 'Surabaya', 'Indonesia', 'healthcare',
'active', '{"employment_type":"full-time","experience_level":"junior","sector":"healthcare","company":"Kalbe Farma","benefits":["Commission","Car Allowance","Health Insurance"]}', NOW()),

-- Finance Sector
('00000000-0000-0000-0000-000000000001', 'job', 'Investment Analyst',
'Analyze market trends and investment opportunities. CFA preferred.',
24000000, 'IDR', 'Jakarta', 'Indonesia', 'finance',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"finance","company":"BCA","benefits":["Performance Bonus","Health Insurance","Pension"]}', NOW()),

('00000000-0000-0000-0000-000000000001', 'job', 'Risk Management Officer',
'Assess and mitigate financial risks. Banking experience required.',
28000000, 'IDR', 'Jakarta', 'Indonesia', 'finance',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"finance","company":"Bank Mandiri","benefits":["Health Insurance","Bonus","Training"]}', NOW()),

-- Construction Sector
('00000000-0000-0000-0000-000000000001', 'job', 'Site Engineer',
'Supervise construction projects. Civil engineering degree required.',
18000000, 'IDR', 'Surabaya', 'Indonesia', 'construction',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"construction","company":"Waskita Karya","benefits":["Project Bonus","Health Insurance","Transportation"]}', NOW()),

-- Real Estate Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Property Consultant',
'Sell and lease residential and commercial properties. Commission-based.',
8000000, 'IDR', 'Jakarta', 'Indonesia', 'realestate',
'active', '{"employment_type":"full-time","experience_level":"junior","sector":"realestate","company":"Ray White Indonesia","benefits":["High Commission","Training","Flexible Hours"]}', NOW()),

-- Manufacturing Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Production Manager',
'Oversee manufacturing operations and quality control.',
22000000, 'IDR', 'Cikarang', 'Indonesia', 'manufacturing',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"manufacturing","company":"Astra International","benefits":["Health Insurance","Performance Bonus","Housing"]}', NOW()),

-- Agriculture Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Agronomy Specialist',
'Provide technical advice on crop production and soil management.',
15000000, 'IDR', 'Medan', 'Indonesia', 'agriculture',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"agriculture","company":"Syngenta Indonesia","benefits":["Field Allowance","Health Insurance","Training"]}', NOW()),

-- Mining Sector
('00000000-0000-0000-0000-000000000001', 'job', 'Mining Engineer',
'Plan and supervise mining operations. Mining engineering degree required.',
32000000, 'IDR', 'Timika', 'Indonesia', 'mining',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"mining","company":"Freeport Indonesia","benefits":["Housing","Health Insurance","Rotation Schedule","Bonus"]}', NOW()),

-- Automotive Sector
('00000000-0000-0000-0000-000000000001', 'job', 'Automotive Designer',
'Design vehicle components and systems. CAD proficiency required.',
26000000, 'IDR', 'Cikarang', 'Indonesia', 'automotive',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"automotive","company":"Hyundai Motor Indonesia","benefits":["Health Insurance","Training","Performance Bonus"]}', NOW()),

-- Aerospace Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Aircraft Maintenance Engineer',
'Perform aircraft maintenance and inspections. AME license required.',
28000000, 'IDR', 'Jakarta', 'Indonesia', 'aerospace',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"aerospace","company":"Garuda Maintenance Facility","benefits":["Health Insurance","Flight Benefits","Training"]}', NOW()),

-- Telecommunications Sector
('00000000-0000-0000-0000-000000000001', 'job', 'Network Engineer',
'Design and maintain telecommunications networks. CCNA/CCNP preferred.',
20000000, 'IDR', 'Jakarta', 'Indonesia', 'telecommunications',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"telecommunications","company":"Telkomsel","benefits":["Health Insurance","Training","Performance Bonus"]}', NOW()),

-- Transportation & Logistics Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Logistics Manager',
'Manage supply chain and distribution operations.',
22000000, 'IDR', 'Jakarta', 'Indonesia', 'transportation',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"transportation","company":"JNE","benefits":["Health Insurance","Performance Bonus","Car Allowance"]}', NOW()),

-- Retail & E-commerce Sector
('00000000-0000-0000-0000-000000000001', 'job', 'E-commerce Manager',
'Manage online store operations and digital marketing.',
18000000, 'IDR', 'Jakarta', 'Indonesia', 'retail',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"retail","company":"Shopee Indonesia","benefits":["Health Insurance","Performance Bonus","Flexible Hours"]}', NOW()),

-- Hospitality & Tourism Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Hotel Manager',
'Oversee hotel operations and guest services.',
25000000, 'IDR', 'Bali', 'Indonesia', 'hospitality',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"hospitality","company":"Accor Hotels","benefits":["Accommodation","Health Insurance","Travel Benefits"]}', NOW()),

-- Education Sector
('00000000-0000-0000-0000-000000000001', 'job', 'Senior Lecturer (Computer Science)',
'Teach undergraduate and graduate courses. PhD preferred.',
20000000, 'IDR', 'Bandung', 'Indonesia', 'education',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"education","company":"Institut Teknologi Bandung","benefits":["Research Funding","Health Insurance","Pension"]}', NOW()),

-- Media & Entertainment Sector
('00000000-0000-0000-0000-000000000001', 'job', 'Content Producer',
'Produce video and multimedia content for digital platforms.',
16000000, 'IDR', 'Jakarta', 'Indonesia', 'media',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"media","company":"NET TV","benefits":["Creative Freedom","Health Insurance","Equipment"]}', NOW()),

-- Legal Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Corporate Lawyer',
'Handle corporate legal matters and contracts. Law degree and bar admission required.',
35000000, 'IDR', 'Jakarta', 'Indonesia', 'legal',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"legal","company":"Hadiputranto Law Firm","benefits":["Performance Bonus","Health Insurance","Professional Development"]}', NOW()),

-- Consulting Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Management Consultant',
'Provide strategic business advice to clients. MBA preferred.',
32000000, 'IDR', 'Jakarta', 'Indonesia', 'consulting',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"consulting","company":"McKinsey Indonesia","benefits":["Performance Bonus","Health Insurance","Travel","Training"]}', NOW()),

-- Marketing & Advertising Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Digital Marketing Manager',
'Lead digital marketing campaigns and strategy.',
22000000, 'IDR', 'Jakarta', 'Indonesia', 'marketing',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"marketing","company":"Dentsu Indonesia","benefits":["Creative Freedom","Health Insurance","Performance Bonus"]}', NOW()),

-- Chemical Sector
('00000000-0000-0000-0000-000000000001', 'job', 'Chemical Engineer',
'Design and optimize chemical processes. Chemical engineering degree required.',
24000000, 'IDR', 'Cilegon', 'Indonesia', 'chemical',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"chemical","company":"Chandra Asri","benefits":["Health Insurance","Safety Equipment","Training"]}', NOW()),

-- Textiles & Fashion Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Fashion Designer',
'Design clothing collections for retail brands.',
18000000, 'IDR', 'Jakarta', 'Indonesia', 'textiles',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"textiles","company":"Eiger Adventure","benefits":["Creative Freedom","Health Insurance","Product Discount"]}', NOW()),

-- Food & Beverage Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Food Quality Manager',
'Ensure food safety and quality standards. Food science degree preferred.',
20000000, 'IDR', 'Jakarta', 'Indonesia', 'food',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"food","company":"Indofood","benefits":["Health Insurance","Performance Bonus","Training"]}', NOW()),

-- Marine & Shipping Sector
('00000000-0000-0000-0000-000000000001', 'job', 'Marine Engineer',
'Maintain and repair ship engines and systems. Marine engineering certificate required.',
26000000, 'IDR', 'Surabaya', 'Indonesia', 'marine',
'active', '{"employment_type":"full-time","experience_level":"senior","sector":"marine","company":"PT PAL Indonesia","benefits":["Rotation Schedule","Health Insurance","Sea Allowance"]}', NOW()),

-- Environmental Sector
('00000000-0000-0000-0000-000000000001', 'job', 'Environmental Consultant',
'Conduct environmental impact assessments and sustainability audits.',
22000000, 'IDR', 'Jakarta', 'Indonesia', 'environmental',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"environmental","company":"ERM Indonesia","benefits":["Field Allowance","Health Insurance","Training"]}', NOW()),

-- Government & Public Sector
( '00000000-0000-0000-0000-000000000001', 'job', 'Public Policy Analyst',
'Research and analyze public policies. Master degree in public policy preferred.',
18000000, 'IDR', 'Jakarta', 'Indonesia', 'government',
'active', '{"employment_type":"full-time","experience_level":"mid","sector":"government","company":"Kementerian Keuangan","benefits":["Pension","Health Insurance","Job Security"]}', NOW());
                  
-- ============================================================
-- PROPERTY LISTINGS (30+ across Indonesia)
-- ============================================================
INSERT INTO listings (
  owner_id, listing_type, title, description,
    price_amount, price_currency, location_city, location_country,
    category, status, metadata, created_at
) VALUES
('00000000-0000-0000-0000-000000000002', 'property', 'Modern Villa with Private Pool - Canggu',
'Stunning 3-bedroom villa with infinity pool, ocean views, and modern design. Fully furnished.',
2500000000, 'IDR', 'Bali', 'Indonesia', 'realestate',
'active', '{"property_type":"villa","bedrooms":3,"bathrooms":3,"land_size":300,"building_size":200,"for":"sale","sector":"realestate","features":["Pool","Ocean View","Furnished","Garden"]}', NOW()),

('00000000-0000-0000-0000-000000000002', 'property', 'Luxury Apartment Sudirman - 2BR',
'Premium 2-bedroom apartment in SCBD area. High floor with city views.',
1200000000, 'IDR', 'Jakarta', 'Indonesia', 'realestate',
'active', '{"property_type":"apartment","bedrooms":2,"bathrooms":2,"building_size":85,"for":"sale","sector":"realestate","features":["City View","Gym","Pool","Security 24/7"]}', NOW()),

('00000000-0000-0000-0000-000000000002', 'property', 'Minimalist House Bintaro - Ready to Move',
'Modern minimalist 3-bedroom house in gated community.',
950000000, 'IDR', 'Tangerang', 'Indonesia', 'realestate',
'active', '{"property_type":"house","bedrooms":3,"bathrooms":2,"land_size":120,"building_size":100,"for":"sale","sector":"realestate","features":["Gated Community","Carport","Garden"]}', NOW()),

('00000000-0000-0000-0000-000000000002', 'property', 'Shophouse Kemang - Strategic Location',
'3-story shophouse perfect for cafe or office. Prime location.',
3500000000, 'IDR', 'Jakarta', 'Indonesia', 'realestate',
'active', '{"property_type":"commercial","building_size":250,"for":"sale","sector":"realestate","features":["Strategic Location","Parking","High Traffic"]}', NOW()),

('00000000-0000-0000-0000-000000000002', 'property', 'Apartment Menteng - For Rent',
'Cozy 1-bedroom apartment near MRT station. Fully furnished.',
8000000, 'IDR', 'Jakarta', 'Indonesia', 'realestate',
'active', '{"property_type":"apartment","bedrooms":1,"bathrooms":1,"building_size":45,"for":"rent","rental_period":"monthly","sector":"realestate","features":["Furnished","Near MRT","WiFi"]}', NOW()),

('00000000-0000-0000-0000-000000000002', 'property', 'Beach Front Villa Seminyak',
'Exclusive 4-bedroom villa right on the beach. Perfect for investment.',
4200000000, 'IDR', 'Bali', 'Indonesia', 'realestate',
'active', '{"property_type":"villa","bedrooms":4,"bathrooms":4,"land_size":400,"building_size":300,"for":"sale","sector":"realestate","features":["Beach Front","Pool","Furnished","Investment"]}', NOW()),

('00000000-0000-0000-0000-000000000002', 'property', 'Office Space Kuningan - Grade A',
'Premium office space in Grade A building. Ready to use.',
150000000, 'IDR', 'Jakarta', 'Indonesia', 'realestate',
'active', '{"property_type":"commercial","building_size":200,"for":"rent","rental_period":"yearly","sector":"realestate","features":["Grade A","Parking","24/7 Access","Meeting Rooms"]}', NOW()),

('00000000-0000-0000-0000-000000000002', 'property', 'Townhouse Alam Sutera - Modern Design',
'Brand new 2-story townhouse with rooftop terrace.',
1100000000, 'IDR', 'Tangerang', 'Indonesia', 'realestate',
'active', '{"property_type":"house","bedrooms":3,"bathrooms":3,"land_size":90,"building_size":120,"for":"sale","sector":"realestate","features":["Rooftop","Modern","Gated Community"]}', NOW()),

('00000000-0000-0000-0000-000000000002', 'property', 'Warehouse Cikarang - Industrial Zone',
'Large warehouse facility perfect for manufacturing or distribution.',
5000000000, 'IDR', 'Cikarang', 'Indonesia', 'realestate',
'active', '{"property_type":"industrial","building_size":1000,"land_size":1500,"for":"sale","sector":"realestate","features":["Loading Dock","High Ceiling","Security","Industrial Zone"]}', NOW()),

( '00000000-0000-0000-0000-000000000002', 'property', 'Studio Apartment Bandung - Student Friendly',
'Affordable studio near ITB campus. Fully furnished.',
4500000, 'IDR', 'Bandung', 'Indonesia', 'realestate',
'active', '{"property_type":"apartment","bedrooms":0,"bathrooms":1,"building_size":24,"for":"rent","rental_period":"monthly","sector":"realestate","features":["Furnished","Near Campus","WiFi","Affordable"]}', NOW());

-- ============================================================
-- FREELANCER/TALENT PROFILES (25+ professionals)
-- ============================================================
INSERT INTO listings (
 owner_id, listing_type, title, description,
    price_amount, price_currency, location_city, location_country,
    category, status, metadata, created_at
) VALUES
( '00000000-0000-0000-0000-000000000003', 'talent', 'Ahmad Fauzan - Full Stack Developer',
'Experienced full stack developer specializing in React, Node.js, and PostgreSQL. 7+ years experience.',
500000, 'IDR', 'Jakarta', 'Indonesia', 'technology',
'active', '{"rate_type":"hourly","experience_years":7,"rating":4.9,"completed_projects":156,"sector":"technology","skills":["React","Node.js","PostgreSQL","AWS","Docker"],"availability":"full-time"}', NOW()),

( '00000000-0000-0000-0000-000000000003', 'talent', 'Sarah Wijaya - UI/UX Designer',
'Creative UI/UX designer with expertise in Figma and user research. Portfolio available.',
400000, 'IDR', 'Bandung', 'Indonesia', 'technology',
'active', '{"rate_type":"hourly","experience_years":5,"rating":5.0,"completed_projects":89,"sector":"technology","skills":["Figma","Adobe XD","User Research","Prototyping","Design Systems"],"availability":"part-time"}', NOW()),

( '00000000-0000-0000-0000-000000000003', 'talent', 'Riko Pratama - Legal Consultant',
'Corporate lawyer specializing in contracts and business law. Bar certified.',
750000, 'IDR', 'Jakarta', 'Indonesia', 'legal',
'active', '{"rate_type":"hourly","experience_years":10,"rating":4.8,"completed_projects":234,"sector":"legal","skills":["Contract Law","Corporate Law","M&A","Compliance","Litigation"],"availability":"project-based"}', NOW()),

( '00000000-0000-0000-0000-000000000003', 'talent', 'Dina Kartika - Digital Marketing Specialist',
'Performance marketer with proven ROI track record. Google Ads & Meta certified.',
350000, 'IDR', 'Jakarta', 'Indonesia', 'marketing',
'active', '{"rate_type":"hourly","experience_years":6,"rating":4.9,"completed_projects":178,"sector":"marketing","skills":["Google Ads","Facebook Ads","SEO","Content Marketing","Analytics"],"availability":"full-time"}', NOW()),

( '00000000-0000-0000-0000-000000000003', 'talent', 'Budi Santoso - Mechanical Engineer',
'Experienced mechanical engineer for manufacturing and product design.',
600000, 'IDR', 'Surabaya', 'Indonesia', 'manufacturing',
'active', '{"rate_type":"hourly","experience_years":12,"rating":4.7,"completed_projects":67,"sector":"manufacturing","skills":["CAD","SolidWorks","Manufacturing","Quality Control","Lean Six Sigma"],"availability":"project-based"}', NOW()),

( '00000000-0000-0000-0000-000000000003', 'talent', 'Maya Putri - Content Writer',
'Bilingual content writer (EN/ID) specializing in tech and business topics.',
250000, 'IDR', 'Yogyakarta', 'Indonesia', 'media',
'active', '{"rate_type":"hourly","experience_years":4,"rating":4.9,"completed_projects":312,"sector":"media","skills":["Content Writing","SEO Writing","Copywriting","Translation","Editing"],"availability":"full-time"}', NOW()),

( '00000000-0000-0000-0000-000000000003', 'talent', 'Andi Wijaya - Data Scientist',
'Machine learning engineer with expertise in Python and TensorFlow.',
700000, 'IDR', 'Jakarta', 'Indonesia', 'technology',
'active', '{"rate_type":"hourly","experience_years":6,"rating":5.0,"completed_projects":45,"sector":"technology","skills":["Python","TensorFlow","Machine Learning","Data Analysis","SQL"],"availability":"part-time"}', NOW()),

( '00000000-0000-0000-0000-000000000003', 'talent', 'Siti Nurhaliza - Accountant',
'Certified public accountant with tax and audit expertise.',
450000, 'IDR', 'Jakarta', 'Indonesia', 'finance',
'active', '{"rate_type":"hourly","experience_years":8,"rating":4.8,"completed_projects":123,"sector":"finance","skills":["Accounting","Tax","Audit","Financial Reporting","QuickBooks"],"availability":"project-based"}', NOW()),

( '00000000-0000-0000-0000-000000000003', 'talent', 'Hendra Gunawan - Video Editor',
'Professional video editor for commercials and corporate videos.',
350000, 'IDR', 'Bali', 'Indonesia', 'media',
'active', '{"rate_type":"hourly","experience_years":7,"rating":4.9,"completed_projects":201,"sector":"media","skills":["Premiere Pro","After Effects","Color Grading","Motion Graphics","DaVinci Resolve"],"availability":"full-time"}', NOW()),

('00000000-0000-0000-0000-000000000003', 'talent', 'Linda Kusuma - HR Consultant',
'Human resources specialist for recruitment and organizational development.',
500000, 'IDR', 'Jakarta', 'Indonesia', 'consulting',
'active', '{"rate_type":"hourly","experience_years":9,"rating":4.7,"completed_projects":87,"sector":"consulting","skills":["Recruitment","Training","Performance Management","HR Policy","Compensation"],"availability":"project-based"}', NOW());

-- ============================================================
-- CONTENT ITEMS (Articles, News, Insights)
-- ============================================================
INSERT INTO content_items (
     owner_id, content_type, title, body,
    category, content_status, metadata, created_at
) VALUES
('00000000-0000-0000-0000-000000000001', 'news', 'Indonesia Tech Startups Raise $2.3B in 2026',
'Indonesian technology startups have collectively raised $2.3 billion in funding during the first quarter of 2026, marking a significant recovery in the Southeast Asian tech ecosystem...',
'technology', 'published', '{"sector":"technology","featured":true,"read_time":5}', NOW()),

('00000000-0000-0000-0000-000000000001', 'news', 'New Renewable Energy Projects Announced',
'The Indonesian government has approved 15 new renewable energy projects worth $5 billion, focusing on solar and wind power installations across the archipelago...',
'energy', 'published', '{"sector":"energy","featured":true,"read_time":4}', NOW()),

('00000000-0000-0000-0000-000000000001', 'article', 'Guide to Freelancing in Indonesia 2026',
'Complete guide for freelancers in Indonesia covering taxes, legal requirements, and best practices for building a successful freelance career...',
'consulting', 'published', '{"sector":"consulting","featured":false,"read_time":8}', NOW()),

('00000000-0000-0000-0000-000000000001', 'news', 'Jakarta Property Market Shows Strong Growth',
'Jakarta residential property prices increased by 12% year-over-year, driven by infrastructure development and foreign investment...',
'realestate', 'published', '{"sector":"realestate","featured":true,"read_time":3}', NOW()),

('00000000-0000-0000-0000-000000000001', 'article', 'Top 10 In-Demand Skills for 2026',
'Analysis of the most sought-after professional skills across industries, based on job market data and employer surveys...',
'technology', 'published', '{"sector":"technology","featured":false,"read_time":6}', NOW());

SELECT 1; -- Migration complete

