export type SupportedLocale = 'id' | 'en';

export type LocalizedText = {
  id: string;
  en: string;
};

export type LegalSection = {
  id: string;
  title: LocalizedText;
  body: LocalizedText;
  bullets?: LocalizedText[];
};

export type LegalSummary = {
  key: 'privacy' | 'terms' | 'cookie';
  title: LocalizedText;
  summary: LocalizedText;
  bullets: LocalizedText[];
  href: string;
};

export type TrustTopicSlug =
  | 'privacy-data-rights'
  | 'security'
  | 'payments'
  | 'accessibility'
  | 'reliability-incidents'
  | 'vendor-risk'
  | 'global-regulations';

export type TrustTopic = {
  slug: TrustTopicSlug;
  badge: LocalizedText;
  shortTitle: LocalizedText;
  title: LocalizedText;
  summary: LocalizedText;
  audience: LocalizedText;
  sections: LegalSection[];
};

export const TRUST_LAST_UPDATED: LocalizedText = {
  id: '13 Maret 2026',
  en: 'March 13, 2026',
};

export function pickText(locale: string, value: LocalizedText): string {
  return locale === 'id' ? value.id : value.en;
}

const privacyTopicSections: LegalSection[] = [
  {
    id: 'what',
    title: { id: 'Apa ini', en: 'What this is' },
    body: {
      id: 'Topik ini menjelaskan bagaimana Lajukan mengumpulkan, memakai, menyimpan, dan menghapus data pribadi ketika pengguna memakai akun, transaksi, support, chat, dan verifikasi.',
      en: 'This topic explains how Lajukan collects, uses, stores, and deletes personal data across accounts, transactions, support, chat, and verification flows.',
    },
  },
  {
    id: 'why',
    title: { id: 'Kenapa penting', en: 'Why it matters' },
    body: {
      id: 'Data pribadi menyentuh identitas, transaksi, keamanan akun, dan bukti sengketa. Kalau flow data tidak rapi, trust dan kepatuhan langsung jatuh.',
      en: 'Personal data touches identity, transactions, account security, and dispute evidence. If the data flow is messy, trust and compliance break immediately.',
    },
  },
  {
    id: 'affected',
    title: { id: 'Siapa terdampak', en: 'Who is affected' },
    body: {
      id: 'Pengguna publik, merchant, pemilik listing, peminjam, tim support, dan admin internal yang mengakses data operasional.',
      en: 'Public users, merchants, listing owners, borrowers, support teams, and internal admins who access operational data.',
    },
  },
  {
    id: 'operations',
    title: { id: 'Flow operasional Lajukan', en: 'Lajukan operational flow' },
    body: {
      id: 'Setiap fitur baru seharusnya masuk review data: data apa yang diambil, untuk apa, siapa yang boleh lihat, berapa lama disimpan, dan kapan harus dihapus atau dianonimkan.',
      en: 'Every new feature should pass a data review: what data is collected, why, who can access it, how long it stays, and when it must be deleted or anonymized.',
    },
    bullets: [
      {
        id: 'Data sensitif harus dibatasi aksesnya.',
        en: 'Sensitive data should have restricted access.',
      },
      {
        id: 'Ekspor data dan hapus akun harus punya jalur yang jelas.',
        en: 'Data export and account deletion need a clear path.',
      },
      {
        id: 'Bukti persetujuan, perubahan, dan aktivitas sensitif perlu audit trail.',
        en: 'Consent, changes, and sensitive actions need audit trails.',
      },
    ],
  },
  {
    id: 'controls',
    title: { id: 'Kontrol yang dipakai', en: 'Controls in use' },
    body: {
      id: 'Kontrol minimumnya meliputi consent notice, minimisasi data, retention policy, pengamanan akses, logging, dan proses respons insiden.',
      en: 'The baseline controls include consent notices, data minimization, retention policy, access security, logging, and incident response.',
    },
  },
  {
    id: 'rights',
    title: { id: 'Hak user', en: 'User rights' },
    body: {
      id: 'User perlu bisa meminta akses data, koreksi, ekspor, dan penghapusan sesuai flow yang tersedia dan batasan hukum yang berlaku.',
      en: 'Users should be able to request access, correction, export, and deletion through the available flow and any legal limits that apply.',
    },
  },
  {
    id: 'risks',
    title: { id: 'Risiko umum', en: 'Common risks' },
    body: {
      id: 'Risiko yang paling sering muncul adalah pengumpulan berlebihan, vendor menerima data terlalu banyak, log bocor, dan akun internal punya akses terlalu luas.',
      en: 'The most common risks are over-collection, vendors receiving too much data, leaked logs, and internal accounts with overly broad access.',
    },
  },
  {
    id: 'help',
    title: { id: 'Jika ada masalah', en: 'If something goes wrong' },
    body: {
      id: 'Buka support, pilih kategori privasi & data, jelaskan permintaan atau insiden, lalu simpan nomor ticket untuk tindak lanjut.',
      en: 'Open support, choose the privacy and data category, describe the request or incident, then keep the ticket number for follow-up.',
    },
  },
];

const securityTopicSections: LegalSection[] = [
  {
    id: 'what',
    title: { id: 'Apa ini', en: 'What this is' },
    body: {
      id: 'Topik keamanan menjelaskan cara Lajukan mengurangi risiko penyalahgunaan akun, akses ilegal, kebocoran data, fraud, dan manipulasi flow transaksi.',
      en: 'The security topic explains how Lajukan reduces the risk of account abuse, unauthorized access, data leakage, fraud, and transaction manipulation.',
    },
  },
  {
    id: 'why',
    title: { id: 'Kenapa penting', en: 'Why it matters' },
    body: {
      id: 'Platform besar tidak cukup hanya punya login. Kontrol akses, bukti audit, batasan aksi sensitif, dan monitoring harus jalan bersamaan.',
      en: 'A large platform needs more than login. Access control, audit evidence, limits on sensitive actions, and monitoring must work together.',
    },
  },
  {
    id: 'affected',
    title: { id: 'Siapa terdampak', en: 'Who is affected' },
    body: {
      id: 'Semua akun publik, seller, buyer, agent support, admin operasional, dan integrasi pihak ketiga.',
      en: 'All public accounts, sellers, buyers, support agents, operations admins, and third-party integrations.',
    },
  },
  {
    id: 'operations',
    title: { id: 'Flow operasional Lajukan', en: 'Lajukan operational flow' },
    body: {
      id: 'Aksi sensitif seperti login, perubahan profil penting, pembayaran, escrow, dan dispute harus punya pemeriksaan izin, logging, dan jejak waktu.',
      en: 'Sensitive actions like login, important profile changes, payments, escrow, and disputes need permission checks, logging, and time trails.',
    },
  },
  {
    id: 'controls',
    title: { id: 'Kontrol yang dipakai', en: 'Controls in use' },
    body: {
      id: 'Kontrol inti meliputi proteksi sesi, rate limit, pembatasan role, audit log, pemeriksaan input, dan review komponen yang menyentuh data sensitif.',
      en: 'Core controls include session protection, rate limits, role restrictions, audit logs, input validation, and review of components touching sensitive data.',
    },
  },
  {
    id: 'rights',
    title: { id: 'Hak user', en: 'User rights' },
    body: {
      id: 'User berhak tahu ketika ada aktivitas mencurigakan yang memengaruhi akun atau transaksi mereka dan perlu punya jalur pemulihan yang jelas.',
      en: 'Users should know when suspicious activity affects their account or transactions and should have a clear recovery path.',
    },
  },
  {
    id: 'risks',
    title: { id: 'Risiko umum', en: 'Common risks' },
    body: {
      id: 'Akar masalah yang sering terjadi adalah akses terlalu luas, token bocor, komponen lama, dan panel admin yang kurang dibatasi.',
      en: 'The usual root causes are broad access, leaked tokens, outdated components, and poorly restricted admin panels.',
    },
  },
  {
    id: 'help',
    title: { id: 'Jika ada masalah', en: 'If something goes wrong' },
    body: {
      id: 'Segera ubah password, cek sesi aktif, lalu laporkan ke support kategori keamanan bila ada login asing, phishing, atau penyalahgunaan akun.',
      en: 'Change the password, review active sessions, and report to security support immediately if there is foreign login, phishing, or account abuse.',
    },
  },
];

const paymentsTopicSections: LegalSection[] = [
  {
    id: 'what',
    title: { id: 'Apa ini', en: 'What this is' },
    body: {
      id: 'Topik ini menjelaskan standar kesiapan untuk saldo, pembayaran, top up, escrow, uang jaminan, dan refund. Fitur yang belum diberi status aktif di produk belum dapat dianggap tersedia.',
      en: 'This topic explains readiness standards for wallet, payments, top-ups, escrow, deposits, and refunds. A feature is not available until the product explicitly marks it as active.',
    },
  },
  {
    id: 'why',
    title: { id: 'Kenapa penting', en: 'Why it matters' },
    body: {
      id: 'Begitu platform menyentuh uang, risiko hukum, fraud, sengketa, dan ekspektasi user langsung naik tajam.',
      en: 'Once a platform touches money, legal risk, fraud, disputes, and user expectations rise sharply.',
    },
  },
  {
    id: 'affected',
    title: { id: 'Siapa terdampak', en: 'Who is affected' },
    body: {
      id: 'Buyer, seller, owner alat sewa, borrower, tim finance, tim operasional, dan partner pembayaran.',
      en: 'Buyers, sellers, rental owners, borrowers, finance teams, operations teams, and payment partners.',
    },
  },
  {
    id: 'operations',
    title: {
      id: 'Standar sebelum diaktifkan',
      en: 'Standards before activation',
    },
    body: {
      id: 'Sebelum fitur dana diaktifkan, nominal, status, pihak penerima, dasar pelepasan dana, serta bukti refund harus dapat dicatat dan diaudit.',
      en: 'Before any fund-handling feature is activated, amounts, statuses, recipients, release conditions, and refund evidence must be recordable and auditable.',
    },
  },
  {
    id: 'controls',
    title: { id: 'Kontrol yang diwajibkan', en: 'Required controls' },
    body: {
      id: 'Aktivasi membutuhkan partner pembayaran yang sesuai, status transaksi eksplisit, audit trail, dan prosedur penanganan selisih atau chargeback.',
      en: 'Activation requires a suitable payment partner, explicit transaction states, audit trails, and procedures for mismatches or chargebacks.',
    },
  },
  {
    id: 'rights',
    title: { id: 'Hak user', en: 'User rights' },
    body: {
      id: 'Jika fitur dana sudah aktif untuk suatu transaksi, user berhak melihat status dana, alasan hold atau gagal bayar, dasar pemotongan, dan status refund.',
      en: 'When a fund-handling feature is active for a transaction, users are entitled to see fund status, hold or payment-failure reasons, deduction basis, and refund status.',
    },
  },
  {
    id: 'risks',
    title: { id: 'Risiko umum', en: 'Common risks' },
    body: {
      id: 'Risikonya termasuk hold dana yang tidak jelas, salah arah payout, bukti transaksi kurang lengkap, dan deposit dilepas sebelum sengketa selesai.',
      en: 'Risks include unclear fund holds, misdirected payouts, incomplete transaction evidence, and deposits released before disputes are resolved.',
    },
  },
  {
    id: 'help',
    title: { id: 'Jika ada masalah', en: 'If something goes wrong' },
    body: {
      id: 'Pilih kategori support yang sesuai dan lampirkan ID percakapan atau transaksi, nominal, waktu, serta bukti yang relevan. Support tidak menggantikan bank, penyedia pembayaran, atau penegak hukum.',
      en: 'Choose the relevant support category and attach the conversation or transaction ID, amount, time, and supporting evidence. Support does not replace banks, payment providers, or law enforcement.',
    },
  },
];

const accessibilityTopicSections: LegalSection[] = [
  {
    id: 'what',
    title: { id: 'Apa ini', en: 'What this is' },
    body: {
      id: 'Aksesibilitas memastikan halaman bisa dipakai dengan keyboard, screen reader, zoom, dan kondisi visual atau motorik yang berbeda.',
      en: 'Accessibility ensures pages work with keyboard, screen readers, zoom, and different visual or motor conditions.',
    },
  },
  {
    id: 'why',
    title: { id: 'Kenapa penting', en: 'Why it matters' },
    body: {
      id: 'UI yang cantik tapi tidak bisa dioperasikan banyak orang akan merusak trust, konversi, dan kepatuhan.',
      en: 'A beautiful UI that many people cannot operate will hurt trust, conversion, and compliance.',
    },
  },
  {
    id: 'affected',
    title: { id: 'Siapa terdampak', en: 'Who is affected' },
    body: {
      id: 'Pengguna mobile, pengguna keyboard-only, pengguna pembaca layar, dan pengguna yang butuh kontras atau motion yang lebih ringan.',
      en: 'Mobile users, keyboard-only users, screen-reader users, and users who need stronger contrast or lighter motion.',
    },
  },
  {
    id: 'operations',
    title: { id: 'Flow operasional Lajukan', en: 'Lajukan operational flow' },
    body: {
      id: 'Komponen baru seharusnya dites untuk fokus keyboard, label form, urutan interaksi, dan teks singkat yang tetap jelas.',
      en: 'New components should be tested for keyboard focus, form labels, interaction order, and short text that stays clear.',
    },
  },
  {
    id: 'controls',
    title: { id: 'Kontrol yang dipakai', en: 'Controls in use' },
    body: {
      id: 'Kontrol kunci meliputi skip link, fokus terlihat, contrast yang cukup, label yang tegas, dan kontrol motion yang bisa diperkecil.',
      en: 'Key controls include skip links, visible focus, sufficient contrast, clear labels, and motion controls that can be reduced.',
    },
  },
  {
    id: 'rights',
    title: { id: 'Hak user', en: 'User rights' },
    body: {
      id: 'User perlu tetap bisa menyelesaikan flow inti walau tidak memakai mouse atau tidak nyaman dengan animasi besar.',
      en: 'Users should still be able to complete core flows without a mouse or with reduced motion.',
    },
  },
  {
    id: 'risks',
    title: { id: 'Risiko umum', en: 'Common risks' },
    body: {
      id: 'Risiko umumnya adalah tombol tanpa label, modal yang menjebak fokus, teks abu-abu terlalu tipis, dan informasi penting hanya disampaikan lewat warna.',
      en: 'Common risks are unlabeled buttons, modals that trap focus badly, low-contrast text, and important information communicated by color alone.',
    },
  },
  {
    id: 'help',
    title: { id: 'Jika ada masalah', en: 'If something goes wrong' },
    body: {
      id: 'Laporkan halaman, langkah yang gagal, dan perangkat atau assistive tech yang dipakai ke support kategori umum atau keamanan bila flow sensitif terganggu.',
      en: 'Report the page, failing step, and device or assistive tech used to support, or to security if a sensitive flow is affected.',
    },
  },
];
const reliabilityTopicSections: LegalSection[] = [
  {
    id: 'what',
    title: { id: 'Apa ini', en: 'What this is' },
    body: {
      id: 'Reliability menjelaskan bagaimana platform menjaga uptime, performa, pemulihan gangguan, backup, dan komunikasi ketika ada insiden.',
      en: 'Reliability explains how the platform maintains uptime, performance, incident recovery, backups, and communication during incidents.',
    },
  },
  {
    id: 'why',
    title: { id: 'Kenapa penting', en: 'Why it matters' },
    body: {
      id: 'Saat transaksi, chat, atau support gagal di momen penting, user akan menganggap platform tidak bisa diandalkan walau fitur lengkap.',
      en: 'When transactions, chat, or support fail at a critical moment, users will see the platform as unreliable even if it has many features.',
    },
  },
  {
    id: 'affected',
    title: { id: 'Siapa terdampak', en: 'Who is affected' },
    body: {
      id: 'Semua user, terutama mereka yang sedang transaksi, menunggu payout, atau butuh bukti sengketa.',
      en: 'All users, especially those in live transactions, waiting for payouts, or depending on dispute evidence.',
    },
  },
  {
    id: 'operations',
    title: { id: 'Flow operasional Lajukan', en: 'Lajukan operational flow' },
    body: {
      id: 'Gangguan perlu punya jalur triage, prioritas, fallback, dan status update yang jelas supaya user tidak menebak-nebak.',
      en: 'Incidents need triage, prioritization, fallback, and clear status updates so users do not have to guess.',
    },
  },
  {
    id: 'controls',
    title: { id: 'Kontrol yang dipakai', en: 'Controls in use' },
    body: {
      id: 'Kontrolnya meliputi monitoring, alerting, retry yang aman, backup, recovery drill, dan postmortem setelah gangguan penting.',
      en: 'Controls include monitoring, alerting, safe retries, backups, recovery drills, and postmortems after important incidents.',
    },
  },
  {
    id: 'rights',
    title: { id: 'Hak user', en: 'User rights' },
    body: {
      id: 'User berhak tahu jika insiden memengaruhi transaksi, data, atau penyelesaian permintaan mereka.',
      en: 'Users should know when an incident affects their transactions, data, or request resolution.',
    },
  },
  {
    id: 'risks',
    title: { id: 'Risiko umum', en: 'Common risks' },
    body: {
      id: 'Risiko yang sering muncul adalah retry ganda, status yang tidak sinkron, backup tidak pernah diuji restore, dan insiden selesai tanpa catatan akar masalah.',
      en: 'Common risks are duplicate retries, inconsistent status, backups never tested for restore, and incidents closed without root-cause notes.',
    },
  },
  {
    id: 'help',
    title: { id: 'Jika ada masalah', en: 'If something goes wrong' },
    body: {
      id: 'Jika ada error yang memengaruhi transaksi atau data, sertakan waktu, ID terkait, langkah terakhir, dan tangkapan layar saat membuat ticket.',
      en: 'If an error affects transactions or data, include the time, related ID, last step, and screenshots when creating a ticket.',
    },
  },
];

const vendorTopicSections: LegalSection[] = [
  {
    id: 'what',
    title: { id: 'Apa ini', en: 'What this is' },
    body: {
      id: 'Vendor risk membahas layanan pihak ketiga seperti payment, analytics, support, storage, auth, dan AI yang bisa menerima atau memproses data user.',
      en: 'Vendor risk covers third-party services like payment, analytics, support, storage, auth, and AI that may receive or process user data.',
    },
  },
  {
    id: 'why',
    title: { id: 'Kenapa penting', en: 'Why it matters' },
    body: {
      id: 'Platform bisa terlihat aman di sisi sendiri, tetapi tetap bocor atau gagal patuh lewat vendor yang terlalu luas aksesnya.',
      en: 'A platform can look secure internally yet still leak or fail compliance through vendors with overly broad access.',
    },
  },
  {
    id: 'affected',
    title: { id: 'Siapa terdampak', en: 'Who is affected' },
    body: {
      id: 'User akhir, admin internal, tim growth, tim support, dan semua flow yang mengirim data ke subprocessor.',
      en: 'End users, internal admins, growth teams, support teams, and every flow that sends data to subprocessors.',
    },
  },
  {
    id: 'operations',
    title: { id: 'Flow operasional Lajukan', en: 'Lajukan operational flow' },
    body: {
      id: 'Setiap vendor baru seharusnya ditinjau: data apa yang diterima, kenapa perlu, retention-nya apa, dan bagaimana vendor itu diamankan.',
      en: 'Every new vendor should be reviewed: what data it receives, why it is needed, what its retention is, and how it is secured.',
    },
  },
  {
    id: 'controls',
    title: { id: 'Kontrol yang dipakai', en: 'Controls in use' },
    body: {
      id: 'Kontrolnya termasuk pembatasan scope data, review kontrak, daftar vendor aktif, dan evaluasi periodik untuk layanan penting.',
      en: 'Controls include limiting data scope, contract review, an active vendor inventory, and periodic evaluations for critical services.',
    },
  },
  {
    id: 'rights',
    title: { id: 'Hak user', en: 'User rights' },
    body: {
      id: 'User perlu tahu kategori vendor apa saja yang membantu operasional inti dan bagaimana data mereka ikut diproses.',
      en: 'Users should know which vendor categories support core operations and how their data is processed there.',
    },
  },
  {
    id: 'risks',
    title: { id: 'Risiko umum', en: 'Common risks' },
    body: {
      id: 'Risiko paling umum adalah SDK berlebihan, tools session replay tanpa review, penyimpanan bukti di tempat yang terlalu terbuka, dan prompt AI yang memuat data sensitif.',
      en: 'The most common risks are oversized SDK use, session replay tools without review, evidence stored too openly, and AI prompts containing sensitive data.',
    },
  },
  {
    id: 'help',
    title: { id: 'Jika ada masalah', en: 'If something goes wrong' },
    body: {
      id: 'Kalau ada pertanyaan vendor atau pemrosesan data oleh pihak ketiga, arahkan ke support kategori privasi & data agar bisa ditriase dengan benar.',
      en: 'If there is a vendor or third-party processing concern, route it to privacy and data support for proper triage.',
    },
  },
];

const regulationsTopicSections: LegalSection[] = [
  {
    id: 'what',
    title: { id: 'Apa ini', en: 'What this is' },
    body: {
      id: 'Topik ini merangkum aturan dan standar yang biasa relevan untuk website atau aplikasi besar seperti privasi, keamanan, pembayaran, aksesibilitas, dan operasional.',
      en: 'This topic summarizes the rules and standards that commonly matter for large websites or apps across privacy, security, payments, accessibility, and operations.',
    },
  },
  {
    id: 'why',
    title: { id: 'Kenapa penting', en: 'Why it matters' },
    body: {
      id: 'Produk besar tidak cukup patuh pada satu aturan. Scope bisnis, negara target, dan jenis data menentukan kontrol apa yang wajib ada.',
      en: 'A large product rarely needs only one rule. Business scope, target countries, and data type determine which controls must exist.',
    },
  },
  {
    id: 'affected',
    title: { id: 'Siapa terdampak', en: 'Who is affected' },
    body: {
      id: 'Tim produk, engineering, legal, security, support, dan pengguna lintas wilayah.',
      en: 'Product, engineering, legal, security, support, and users across regions.',
    },
  },
  {
    id: 'operations',
    title: { id: 'Flow operasional Lajukan', en: 'Lajukan operational flow' },
    body: {
      id: 'Fitur baru perlu dicek terhadap peta regulasi: data apa yang disentuh, negara mana yang terdampak, partner apa yang terlibat, dan bukti apa yang harus disimpan.',
      en: 'New features should be checked against a regulation map: what data is touched, which countries are affected, what partners are involved, and what evidence must be stored.',
    },
    bullets: [
      {
        id: 'Privasi: GDPR, UU PDP, PDPA, CCPA atau aturan serupa.',
        en: 'Privacy: GDPR, PDP Law, PDPA, CCPA, or similar laws.',
      },
      {
        id: 'Keamanan: OWASP, secure SDLC, audit, dan kontrol akses.',
        en: 'Security: OWASP, secure SDLC, audits, and access controls.',
      },
      {
        id: 'Pembayaran: partner dan scope kepatuhan yang tepat.',
        en: 'Payments: the right partner and compliance scope.',
      },
      {
        id: 'Aksesibilitas dan reliability juga harus masuk dari awal.',
        en: 'Accessibility and reliability also need to be built in from the start.',
      },
    ],
  },
  {
    id: 'controls',
    title: { id: 'Kontrol yang dipakai', en: 'Controls in use' },
    body: {
      id: 'Kontrol yang matang butuh inventaris data, risk register, review vendor, legal pages yang jelas, serta ownership lintas tim.',
      en: 'Mature controls need a data inventory, risk register, vendor reviews, clear legal pages, and cross-team ownership.',
    },
  },
  {
    id: 'rights',
    title: { id: 'Hak user', en: 'User rights' },
    body: {
      id: 'Hak user bergantung pada hukum yang berlaku, tetapi prinsip minimumnya adalah transparansi, akses, koreksi, dan jalur pengaduan yang masuk akal.',
      en: 'User rights depend on the applicable law, but the minimum principle is transparency, access, correction, and a reasonable complaint path.',
    },
  },
  {
    id: 'risks',
    title: { id: 'Risiko umum', en: 'Common risks' },
    body: {
      id: 'Kesalahan terbesar biasanya muncul ketika tim hanya menempelkan policy tanpa mengubah flow produk dan operasional sehari-hari.',
      en: 'The biggest failures usually happen when teams add policies without changing real product and day-to-day operational flows.',
    },
  },
  {
    id: 'help',
    title: { id: 'Jika ada masalah', en: 'If something goes wrong' },
    body: {
      id: 'Kalau ada kebutuhan audit, permintaan data lintas negara, atau pertanyaan compliance yang lebih berat, arahkan ke support dan legal review internal.',
      en: 'If there is an audit need, cross-border data request, or heavier compliance question, route it to support and internal legal review.',
    },
  },
];

export const TRUST_TOPICS: TrustTopic[] = [
  {
    slug: 'privacy-data-rights',
    badge: { id: 'Privasi & hak data', en: 'Privacy & data rights' },
    shortTitle: { id: 'Privasi & data', en: 'Privacy & data' },
    title: {
      id: 'Privasi data, consent, retention, dan hak pengguna',
      en: 'Data privacy, consent, retention, and user rights',
    },
    summary: {
      id: 'Lihat bagaimana data pribadi dipakai, dibatasi, diekspor, dan dihapus di Lajukan.',
      en: 'See how personal data is used, limited, exported, and deleted at Lajukan.',
    },
    audience: {
      id: 'Untuk user, merchant, dan tim internal yang memegang data operasional.',
      en: 'For users, merchants, and internal teams handling operational data.',
    },
    sections: privacyTopicSections,
  },
  {
    slug: 'security',
    badge: { id: 'Keamanan akun', en: 'Account security' },
    shortTitle: { id: 'Keamanan', en: 'Security' },
    title: {
      id: 'Keamanan akun, role, session, dan aktivitas sensitif',
      en: 'Account, role, session, and sensitive-activity security',
    },
    summary: {
      id: 'Ringkasan cara Lajukan menjaga akses, sesi, dan tindakan penting tetap terkendali.',
      en: 'A summary of how Lajukan keeps access, sessions, and critical actions controlled.',
    },
    audience: {
      id: 'Untuk semua user dan tim yang bersentuhan dengan akun serta transaksi.',
      en: 'For all users and teams touching accounts and transactions.',
    },
    sections: securityTopicSections,
  },
  {
    slug: 'payments',
    badge: { id: 'Kesiapan pembayaran', en: 'Payment readiness' },
    shortTitle: { id: 'Pembayaran', en: 'Payments' },
    title: {
      id: 'Status kesiapan pembayaran, saldo, escrow, dan refund',
      en: 'Readiness status for payments, wallet, escrow, and refunds',
    },
    summary: {
      id: 'Standar yang harus dipenuhi sebelum fitur dana ditandai aktif pada transaksi.',
      en: 'Standards that must be met before fund-handling features are marked active for a transaction.',
    },
    audience: {
      id: 'Untuk buyer, seller, owner alat, borrower, dan tim operasional dana.',
      en: 'For buyers, sellers, asset owners, borrowers, and operations teams handling funds.',
    },
    sections: paymentsTopicSections,
  },
  {
    slug: 'accessibility',
    badge: { id: 'Aksesibilitas', en: 'Accessibility' },
    shortTitle: { id: 'Aksesibilitas', en: 'Accessibility' },
    title: {
      id: 'Aksesibilitas, keyboard flow, dan motion yang terkendali',
      en: 'Accessibility, keyboard flow, and controlled motion',
    },
    summary: {
      id: 'Supaya flow inti tetap bisa dipakai banyak orang tanpa friksi visual atau interaksi.',
      en: 'So the core flow stays usable for more people without visual or interaction friction.',
    },
    audience: {
      id: 'Untuk pengguna mobile, keyboard-only, assistive tech, dan perangkat lambat.',
      en: 'For mobile, keyboard-only, assistive-tech, and slower-device users.',
    },
    sections: accessibilityTopicSections,
  },
  {
    slug: 'reliability-incidents',
    badge: { id: 'Reliability & insiden', en: 'Reliability & incidents' },
    shortTitle: { id: 'Reliability', en: 'Reliability' },
    title: {
      id: 'Reliability, monitoring, backup, dan respons insiden',
      en: 'Reliability, monitoring, backup, and incident response',
    },
    summary: {
      id: 'Bagaimana platform menjaga layanan tetap hidup dan jelas saat ada gangguan.',
      en: 'How the platform keeps service alive and clear during failures.',
    },
    audience: {
      id: 'Untuk semua user, terutama yang sedang transaksi atau menunggu penyelesaian.',
      en: 'For all users, especially those in live transactions or waiting for resolution.',
    },
    sections: reliabilityTopicSections,
  },
  {
    slug: 'vendor-risk',
    badge: { id: 'Vendor & subprocessor', en: 'Vendors & subprocessors' },
    shortTitle: { id: 'Vendor risk', en: 'Vendor risk' },
    title: {
      id: 'Vendor, subprocessor, analytics, dan risiko pihak ketiga',
      en: 'Vendors, subprocessors, analytics, and third-party risk',
    },
    summary: {
      id: 'Lihat bagaimana layanan pihak ketiga dinilai dan dibatasi sebelum menerima data.',
      en: 'See how third-party services are reviewed and limited before they receive data.',
    },
    audience: {
      id: 'Untuk user, tim internal, dan pihak yang ingin tahu bagaimana vendor digunakan.',
      en: 'For users, internal teams, and anyone who wants to understand vendor usage.',
    },
    sections: vendorTopicSections,
  },
  {
    slug: 'global-regulations',
    badge: { id: 'Regulasi global', en: 'Global regulations' },
    shortTitle: { id: 'Regulasi', en: 'Regulations' },
    title: {
      id: 'Peta regulasi: GDPR, UU PDP, keamanan, pembayaran, dan aksesibilitas',
      en: 'Regulation map: GDPR, PDP law, security, payments, and accessibility',
    },
    summary: {
      id: 'Ringkasan aturan dan standar yang biasanya relevan untuk web dan aplikasi besar.',
      en: 'A summary of the rules and standards that commonly matter for large apps and websites.',
    },
    audience: {
      id: 'Untuk tim produk, engineering, legal, dan user yang butuh gambaran besar.',
      en: 'For product, engineering, legal teams, and users who need the big picture.',
    },
    sections: regulationsTopicSections,
  },
];

export function getTrustTopic(slug: string): TrustTopic | undefined {
  return TRUST_TOPICS.find(topic => topic.slug === slug);
}

export const PRIVACY_POLICY_SECTIONS: LegalSection[] = [
  {
    id: 'scope',
    title: {
      id: 'Lingkup & data yang kami kumpulkan',
      en: 'Scope & data we collect',
    },
    body: {
      id: 'Kami mengumpulkan data yang dibutuhkan untuk akun, transaksi, keamanan, support, dan peningkatan layanan. Jenis data bisa meliputi identitas, kontak, riwayat transaksi, dan bukti komunikasi.',
      en: 'We collect data needed for accounts, transactions, security, support, and service improvement. Data types may include identity, contact, transaction history, and communication evidence.',
    },
  },
  {
    id: 'consent',
    title: { id: 'Consent & dasar pemrosesan', en: 'Consent & legal basis' },
    body: {
      id: 'Pemrosesan dilakukan atas dasar persetujuan, kontrak layanan, kewajiban hukum, atau kepentingan sah yang relevan. Kami menampilkan pemberitahuan yang jelas saat data sensitif diminta.',
      en: 'Processing is based on consent, service contracts, legal obligations, or legitimate interests. We show clear notices when sensitive data is requested.',
    },
    bullets: [
      {
        id: 'Persetujuan bisa ditarik lewat pengaturan akun.',
        en: 'Consent can be withdrawn via account settings.',
      },
      {
        id: 'Data sensitif hanya diminta saat benar-benar perlu.',
        en: 'Sensitive data is only requested when necessary.',
      },
    ],
  },
  {
    id: 'retention',
    title: { id: 'Retensi & penghapusan', en: 'Retention & deletion' },
    body: {
      id: 'Data disimpan selama dibutuhkan untuk operasional, kepatuhan, dan penyelesaian sengketa. Setelah tidak diperlukan, data dihapus atau dianonimkan sesuai kebijakan retensi.',
      en: 'Data is stored as long as needed for operations, compliance, and dispute resolution. When no longer required, data is deleted or anonymized per retention policy.',
    },
  },
  {
    id: 'transfer',
    title: { id: 'Transfer data & vendor', en: 'Data transfer & vendors' },
    body: {
      id: 'Kami dapat membagikan data ke vendor yang membantu pembayaran, verifikasi, penyimpanan, atau analitik dengan batasan akses yang jelas.',
      en: 'We may share data with vendors that support payments, verification, storage, or analytics under clear access limits.',
    },
    bullets: [
      {
        id: 'Kami meninjau vendor sebelum data dibagikan.',
        en: 'We review vendors before sharing data.',
      },
      {
        id: 'Transfer lintas negara mengikuti aturan yang berlaku.',
        en: 'Cross-border transfers follow applicable rules.',
      },
    ],
  },
  {
    id: 'breach',
    title: { id: 'Respon insiden', en: 'Incident response' },
    body: {
      id: 'Jika terjadi insiden, kami melakukan investigasi, mitigasi, dan komunikasi sesuai prosedur. Pengguna terdampak akan diberi pemberitahuan jika diperlukan.',
      en: 'If an incident occurs, we investigate, mitigate, and communicate according to procedure. Affected users will be notified when required.',
    },
  },
  {
    id: 'rights',
    title: { id: 'Hak pengguna', en: 'User rights' },
    body: {
      id: 'Pengguna dapat meminta akses, koreksi, ekspor, atau penghapusan data sesuai ketentuan hukum dan status akun.',
      en: 'Users can request access, correction, export, or deletion of data subject to legal requirements and account status.',
    },
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: 'eligibility',
    title: { id: 'Akses & penggunaan akun', en: 'Account access & use' },
    body: {
      id: 'Pengguna wajib memberi informasi yang akurat, menjaga kredensial, dan menggunakan platform sesuai hukum yang berlaku.',
      en: 'Users must provide accurate information, safeguard credentials, and use the platform in accordance with applicable law.',
    },
  },
  {
    id: 'transactions',
    title: { id: 'Transaksi & pembayaran', en: 'Transactions & payments' },
    body: {
      id: 'Saat ini Lajukan membantu pencarian, listing, chat, dan pencatatan kesepakatan. Pembayaran atau escrow hanya berlaku bila halaman transaksi secara eksplisit menandainya aktif; selain itu pembayaran berlangsung langsung antar pihak dengan risiko masing-masing.',
      en: 'Lajukan currently supports discovery, listings, chat, and agreement records. Payments or escrow apply only when the transaction page explicitly marks them active; otherwise payment happens directly between the parties at their own risk.',
    },
  },
  {
    id: 'content',
    title: { id: 'Konten & moderasi', en: 'Content & moderation' },
    body: {
      id: 'Konten yang melanggar hukum, menipu, atau merugikan pihak lain dapat dihapus. Kami berhak menangguhkan akun yang melanggar kebijakan.',
      en: 'Content that is unlawful, deceptive, or harmful may be removed. We may suspend accounts that violate policy.',
    },
  },
  {
    id: 'dispute',
    title: { id: 'Sengketa & penyelesaian', en: 'Disputes & resolution' },
    body: {
      id: 'Lajukan dapat menerima laporan dan membantu merangkum bukti yang tersimpan di platform. Bantuan tersebut bukan jaminan mediasi, refund, atau keputusan yang mengikat kecuali dinyatakan khusus pada transaksi terkait.',
      en: 'Lajukan may receive reports and help summarize evidence stored on the platform. This assistance does not guarantee mediation, refunds, or a binding decision unless explicitly stated for the relevant transaction.',
    },
  },
  {
    id: 'liability',
    title: { id: 'Batasan tanggung jawab', en: 'Limitation of liability' },
    body: {
      id: 'Platform berupaya menjaga layanan tetap berjalan, namun tidak menjamin bebas dari gangguan. Tanggung jawab dibatasi sesuai hukum yang berlaku.',
      en: 'We work to keep the service available but do not guarantee uninterrupted access. Liability is limited as permitted by law.',
    },
  },
  {
    id: 'updates',
    title: { id: 'Perubahan kebijakan', en: 'Policy updates' },
    body: {
      id: 'Kami dapat memperbarui syarat dan ketentuan. Perubahan penting akan diumumkan melalui kanal resmi.',
      en: 'We may update these terms. Material changes will be announced through official channels.',
    },
  },
];

export const COOKIE_POLICY_SECTIONS: LegalSection[] = [
  {
    id: 'what',
    title: { id: 'Apa itu cookie', en: 'What cookies are' },
    body: {
      id: 'Cookie adalah file kecil yang disimpan di perangkat untuk menjaga sesi, preferensi, dan performa layanan.',
      en: 'Cookies are small files stored on your device to maintain sessions, preferences, and service performance.',
    },
  },
  {
    id: 'types',
    title: { id: 'Jenis cookie', en: 'Types of cookies' },
    body: {
      id: 'Kami memakai cookie esensial untuk login, cookie fungsional untuk preferensi UI, dan cookie analitik untuk memahami performa.',
      en: 'We use essential cookies for login, functional cookies for UI preferences, and analytics cookies to understand performance.',
    },
  },
  {
    id: 'purpose',
    title: { id: 'Tujuan penggunaan', en: 'Purpose of use' },
    body: {
      id: 'Cookie membantu keamanan, menjaga sesi, menyimpan bahasa/pengaturan, dan memperbaiki pengalaman pengguna.',
      en: 'Cookies support security, session continuity, language/settings storage, and user experience improvements.',
    },
  },
  {
    id: 'control',
    title: { id: 'Kontrol pengguna', en: 'User controls' },
    body: {
      id: 'Pengguna dapat menghapus atau memblokir cookie melalui pengaturan browser. Beberapa fitur mungkin tidak berjalan optimal jika cookie diblokir.',
      en: 'Users can delete or block cookies via browser settings. Some features may not work properly if cookies are blocked.',
    },
  },
  {
    id: 'third-party',
    title: { id: 'Pihak ketiga', en: 'Third-party cookies' },
    body: {
      id: 'Sebagian cookie dapat berasal dari layanan pihak ketiga untuk analitik atau keamanan. Kami meninjau vendor sebelum integrasi.',
      en: 'Some cookies may come from third-party services for analytics or security. We review vendors before integration.',
    },
  },
  {
    id: 'retention',
    title: { id: 'Masa berlaku', en: 'Retention period' },
    body: {
      id: 'Cookie memiliki masa simpan yang berbeda tergantung jenisnya. Cookie sesi berakhir saat browser ditutup, cookie persisten bertahan lebih lama.',
      en: 'Cookies have different lifetimes depending on type. Session cookies end when the browser closes, persistent cookies last longer.',
    },
  },
];

export const LEGAL_SUMMARIES: LegalSummary[] = [
  {
    key: 'privacy',
    title: { id: 'Kebijakan Privasi', en: 'Privacy Policy' },
    summary: {
      id: 'Ringkasan cara Lajukan mengelola data, consent, retensi, dan hak pengguna.',
      en: 'A summary of how Lajukan manages data, consent, retention, and user rights.',
    },
    bullets: [
      {
        id: 'Hak akses, koreksi, ekspor, dan penghapusan data.',
        en: 'Rights to access, correct, export, and delete data.',
      },
      {
        id: 'Aturan retensi dan pemrosesan data sensitif.',
        en: 'Retention and sensitive data handling rules.',
      },
    ],
    href: '/privacy',
  },
  {
    key: 'terms',
    title: { id: 'Syarat & Ketentuan', en: 'Terms & Conditions' },
    summary: {
      id: 'Aturan penggunaan platform, transaksi, moderasi, dan batasan tanggung jawab.',
      en: 'Rules for platform usage, transactions, moderation, and liability limits.',
    },
    bullets: [
      {
        id: 'Aturan akun, transaksi, dan penyelesaian sengketa.',
        en: 'Account, transaction, and dispute rules.',
      },
      {
        id: 'Moderasi konten dan kebijakan perubahan.',
        en: 'Content moderation and policy updates.',
      },
    ],
    href: '/terms',
  },
  {
    key: 'cookie',
    title: { id: 'Cookie Policy', en: 'Cookie Policy' },
    summary: {
      id: 'Informasi cookie, tujuan pemakaian, dan kontrol pengguna.',
      en: 'Cookie information, usage purposes, and user controls.',
    },
    bullets: [
      {
        id: 'Jenis cookie dan masa simpan.',
        en: 'Cookie types and retention periods.',
      },
      {
        id: 'Cara menghapus atau memblokir cookie.',
        en: 'How to delete or block cookies.',
      },
    ],
    href: '/cookie-policy',
  },
];
