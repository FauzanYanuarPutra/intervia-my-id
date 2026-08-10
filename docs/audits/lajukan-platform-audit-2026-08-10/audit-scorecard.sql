-- Qualitative readiness scorecard for the audited working tree.
SELECT domain, status, release_gate, reason
FROM (
  VALUES
    ('Tesis produk dan taksonomi', 'Fondasi kuat', 'Pertahankan', 'Posisi Indonesia-first, Explore canonical, dan lima kategori marketplace sudah terdokumentasi.'),
    ('Discovery dan Explore', 'Beta terbatas', 'Validasi', 'Pemisahan intent lebih jelas, tetapi relevansi search, latency produksi, dan hasil funnel belum terbukti.'),
    ('Create dan onboarding', 'Beta terbatas', 'Perbaiki recovery', 'Fase terlihat lebih sederhana, tetapi false-success draft dan celah aksesibilitas masih ada.'),
    ('Identity dan autentikasi', 'Stop-ship', 'Blokir rilis', 'Login telepon langsung dapat menerbitkan session tanpa bukti kepemilikan OTP.'),
    ('Privasi dan consent', 'Stop-ship', 'Blokir rilis', 'Profil publik dapat mengekspos raw metadata, dokumen, dan kontak tanpa allowlist ketat.'),
    ('Trust dan safety', 'Stop-ship', 'Blokir rilis', 'Flow report dan block hilang atau tidak berfungsi di Reels, Community, dan Chat.'),
    ('Chat dan messaging', 'Stop-ship', 'Blokir rilis', 'Pesan yang diakui belum durable dan throttling/storage inbox salah.'),
    ('Order dan pembayaran', 'Stop-ship', 'Blokir rilis', 'Authorization order tidak ada dan operasi finansial live belum memiliki reconciliation gate lengkap.'),
    ('Konsistensi data', 'Stop-ship', 'Blokir rilis', 'Sinkronisasi identity dan recovery outbox belum lengkap.'),
    ('Performa dan scale', 'Belum terbukti', 'Ukur dahulu', 'Response lokal sehat, tetapi Web Vitals produksi, p95/p99, load, dan saturation tidak tersedia.'),
    ('Quality dan release', 'Stop-ship', 'Blokir rilis', 'Gate lint/type/test/source-health sedang merah dan tidak ada workflow CI yang menegakkannya.'),
    ('Operasi, observability, dan DR', 'Stop-ship', 'Blokir rilis', 'Readiness dangkal, monitoring nonaktif, dan topology storage/backup produksi belum memadai.'),
    ('Aksesibilitas dan lokalisasi', 'Kesenjangan besar', 'Perbaiki sebelum beta luas', 'Dialog kritis, focus flow, touch target, error announcement, dan konsistensi locale belum lengkap.'),
    ('Maintainability', 'Utang tinggi', 'Kurangi blast radius', 'Client component besar dan entrypoint service monolitik membuat perubahan berisiko dan lambat diverifikasi.'),
    ('Analytics dan learning loop', 'Belum lengkap', 'Instrumentasikan', 'Aksi contact, moderation, recovery, dan conversion belum diukur konsisten.')
) AS scorecard(domain, status, release_gate, reason);
