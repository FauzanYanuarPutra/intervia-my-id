-- Confirmed P0 stop-ship register for the audited working tree.
SELECT id, domain, finding, impact, evidence
FROM (
  VALUES
    ('P0-01', 'Identity', 'Backend login telepon menerbitkan token tanpa memvalidasi bukti OTP.', 'Account takeover untuk nomor telepon yang diketahui.', 'services/identity_service/src/routes/auth.rs:1633-1853'),
    ('P0-02', 'Order', 'Route order tidak memiliki autentikasi principal dan ownership check, sementara payload mengontrol actor dan harga.', 'Kebocoran order, price tampering, dan transisi state tanpa izin.', 'services/marketplace_service/src/order_engine.rs:101-130,550-858'),
    ('P0-03', 'Privasi', 'Profil publik mengembalikan raw metadata dan UI mencari kontak di luar consent projection eksplisit.', 'Kebocoran metadata KYC/profil dan scraping kontak.', 'services/identity_service/src/routes/user_lookup.rs:493-604'),
    ('P0-04', 'Trust dan safety', 'Aksi Report di Reels hanya menutup sheet dan operasi report/block setara tidak ada di surface sosial lain.', 'Konten berbahaya tidak memiliki jalur user-ke-moderator yang dapat diandalkan.', 'frontend/www/src/app/[locale]/(shared)/reels/ReelsClient.tsx:5183-5198'),
    ('P0-05', 'Chat', 'Pesan WebSocket diakui dan dibroadcast sebelum persistence selesai.', 'User dapat melihat pesan terkirim yang hilang permanen.', 'services/chat_service/lib/chat_service_web/channels/room_channels.ex:245-272'),
    ('P0-06', 'Chat', 'Counter rate WebSocket hanya bertambah dan tidak pernah reset.', 'Setiap user diblokir setelah delapan pesan sampai service restart.', 'services/chat_service/lib/chat_service_web/channels/room_channels.ex:348-354'),
    ('P0-07', 'Chat', 'Primary key inbox membuat baris baru per pesan dan reader hanya mengambil 500 terbaru sebelum dedupe.', 'Storage tumbuh tanpa batas dan room sibuk menenggelamkan percakapan lain.', 'services/chat_service/priv/scylladb/init.cql:68-82'),
    ('P0-08', 'Infrastruktur chat', 'Merge production mempertahankan satu node Scylla 512 MB developer-mode sementara keyspace mendeklarasikan RF=3.', 'Tidak ada posture availability, quorum, backup, atau restore yang kredibel.', 'docker-compose.yml:193-210'),
    ('P0-09', 'Konsistensi data', 'Verifikasi transaksi marketplace bergantung pada user read model tanpa identity consumer.', 'User valid dapat ditolak dan trust state stale dapat bertahan.', 'services/marketplace_service/src/main.rs:192-267,6225-6301'),
    ('P0-10', 'Keamanan deployment', 'Overlay production mewarisi identity, chat, community, database, object storage, mail, dan admin tools yang dipublish ke host.', 'Attack surface langsung melewati kontrol BFF dan mengekspos infrastruktur privileged.', 'docker-compose.yml:67-873'),
    ('P0-11', 'Operasi finansial', 'Wallet/payment live aktif default sementara amount/currency check dan reconciliation terjadwal global belum lengkap.', 'Uang dapat settle tanpa jalur credit/recovery yang lengkap.', 'docker-compose.prod.yml:18-25,77-78')
) AS stop_ship(id, domain, finding, impact, evidence);
