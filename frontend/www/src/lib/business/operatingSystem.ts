export type BusinessOsModuleMetric = {
  status: 'live' | 'partial' | 'planned';
  value: number;
  label: string;
  trend: string;
};

export type BusinessOsOverview = {
  active_transactions: number;
  unread_messages: number;
  active_leads: number;
  open_support_tickets: number;
  published_content: number;
  weekly_throughput: number;
};

export type BusinessOsBuildInput = {
  overview: BusinessOsOverview;
  moduleMetrics: Record<string, BusinessOsModuleMetric>;
};

export type BusinessSystemRelation = {
  id: string;
  from: string;
  to: string;
  title: string;
  signal: string;
  automation: string;
  href: string;
  priority: 'critical' | 'high' | 'medium';
};

export type BusinessAutomationAction = {
  id: string;
  title: string;
  trigger: string;
  action: string;
  impact: string;
  href: string;
};

export type BusinessAiAction = {
  id: string;
  title: string;
  prompt: string;
  output: string;
  href: string;
};

export type BusinessRetentionLoop = {
  id: string;
  title: string;
  loop: string;
  reward: string;
  metric: string;
};

export type BusinessTrustControl = {
  id: string;
  title: string;
  guardrail: string;
  signal: string;
};

export type BusinessDataFlow = {
  id: string;
  source: string;
  enriches: string;
  usedBy: string;
};

export type BusinessOperatingSystemSnapshot = {
  health_score: number;
  focus_lane: {
    id: string;
    title: string;
    description: string;
    href: string;
  };
  system_relations: BusinessSystemRelation[];
  automation_queue: BusinessAutomationAction[];
  ai_copilot_actions: BusinessAiAction[];
  retention_loops: BusinessRetentionLoop[];
  trust_controls: BusinessTrustControl[];
  data_flows: BusinessDataFlow[];
};

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function metricValue(
  metrics: Record<string, BusinessOsModuleMetric>,
  slug: string,
): number {
  return Math.max(0, Math.floor(Number(metrics[slug]?.value || 0)));
}

function metricIsActive(
  metrics: Record<string, BusinessOsModuleMetric>,
  slug: string,
): boolean {
  const status = metrics[slug]?.status;
  return (
    status === 'live' || status === 'partial' || metricValue(metrics, slug) > 0
  );
}

export function buildBusinessOperatingSystemSnapshot({
  overview,
  moduleMetrics,
}: BusinessOsBuildInput): BusinessOperatingSystemSnapshot {
  const activeModules = Object.values(moduleMetrics).filter(
    item => item.status === 'live' || item.status === 'partial',
  ).length;
  const signalVolume =
    overview.active_transactions * 3 +
    overview.unread_messages +
    overview.active_leads * 2 +
    overview.open_support_tickets +
    overview.published_content +
    overview.weekly_throughput * 2;
  const healthScore = clampScore(42 + activeModules * 2.2 + signalVolume * 0.7);

  const focusLane =
    overview.unread_messages > 0
      ? {
          id: 'reply-to-revenue',
          title: 'Chat -> Deal -> CRM',
          description:
            'Balas chat yang menunggu, rangkum kebutuhan, lalu ubah jadi offer agar peluang tidak hilang.',
          href: '/chat',
        }
      : overview.active_transactions > 0
        ? {
            id: 'transaction-control',
            title: 'Transaksi -> Operasional -> Trust',
            description:
              'Pantau milestone transaksi aktif, bukti pengerjaan, dan status pembayaran supaya trust tetap aman.',
            href: '/transactions',
          }
        : overview.published_content > 0
          ? {
              id: 'listing-growth',
              title: 'Listing -> Search -> Reels',
              description:
                'Naikkan kualitas listing yang sudah tayang lalu dorong lewat konten pendek dan rekomendasi search.',
              href: '/my-listings',
            }
          : {
              id: 'create-first-signal',
              title: 'Create -> Search -> Chat',
              description:
                'Mulai dari satu kebutuhan atau penawaran supaya sistem punya sinyal untuk matching otomatis.',
              href: '/create',
            };

  const relations: BusinessSystemRelation[] = [
    {
      id: 'crm-marketplace',
      from: 'CRM',
      to: 'Marketplace',
      title: 'Lead panas jadi rekomendasi supplier/jasa',
      signal: `${overview.active_leads} lead aktif + ${overview.unread_messages} chat`,
      automation:
        'Jika lead menyebut kategori atau kota, buat shortlist vendor dan draft follow-up.',
      href: '/search',
      priority: overview.active_leads > 0 ? 'high' : 'medium',
    },
    {
      id: 'chat-transaction',
      from: 'Chat',
      to: 'Transaksi',
      title: 'Negosiasi diubah menjadi offer terstruktur',
      signal: `${overview.unread_messages} pesan belum dibalas`,
      automation:
        'AI merangkum harga, deadline, fulfillment, dan membuat draft transaksi.',
      href: '/chat',
      priority: overview.unread_messages > 0 ? 'critical' : 'medium',
    },
    {
      id: 'erp-trust',
      from: 'ERP',
      to: 'Trust',
      title: 'Milestone transaksi memperkuat reputasi',
      signal: `${overview.active_transactions} transaksi aktif`,
      automation:
        'Setiap status transaksi memicu reminder, bukti kerja, dan permintaan review.',
      href: '/transactions',
      priority: overview.active_transactions > 0 ? 'high' : 'medium',
    },
    {
      id: 'content-growth',
      from: 'Listing/Reels',
      to: 'Growth',
      title: 'Konten menjadi jalur masuk demand',
      signal: `${overview.published_content} konten/listing tayang`,
      automation:
        'Listing berkualitas tinggi dipasangkan dengan ide reels dan komunitas relevan.',
      href: '/my-listings',
      priority: overview.published_content > 0 ? 'high' : 'medium',
    },
    {
      id: 'support-retention',
      from: 'Support',
      to: 'Retention',
      title: 'Masalah customer menjadi playbook repeat usage',
      signal: `${overview.open_support_tickets} tiket terbuka`,
      automation:
        'Tiket selesai dibuat jadi knowledge snippet dan follow-up kepuasan.',
      href: '/support',
      priority: overview.open_support_tickets > 0 ? 'critical' : 'medium',
    },
  ];

  const relationPriorityOrder: Record<
    BusinessSystemRelation['priority'],
    number
  > = {
    critical: 0,
    high: 1,
    medium: 2,
  };

  relations.sort(
    (left, right) =>
      relationPriorityOrder[left.priority] -
      relationPriorityOrder[right.priority],
  );

  const automationQueue: BusinessAutomationAction[] = [
    {
      id: 'auto-chat-sla',
      title: 'SLA chat prospek',
      trigger: 'Chat belum dibalas lebih dari 2 jam',
      action:
        'Kirim reminder, sarankan template jawaban, dan tandai lead panas.',
      impact: 'Naikkan peluang deal dari respons cepat.',
      href: '/chat',
    },
    {
      id: 'auto-offer-draft',
      title: 'Draft offer dari chat',
      trigger: 'Chat berisi harga, jumlah, deadline, atau alamat',
      action:
        'AI membuat offer draft dengan nominal, fulfillment, dan catatan.',
      impact: 'Kurangi bolak-balik negosiasi manual.',
      href: '/transactions',
    },
    {
      id: 'auto-listing-quality',
      title: 'Perbaikan listing otomatis',
      trigger: 'Listing tayang tapi minim chat atau minim klik',
      action: 'Skor foto, judul, harga satuan, kota, dan CTA.',
      impact: 'Listing lebih mudah dipahami UMKM dan buyer awam.',
      href: '/my-listings',
    },
    {
      id: 'auto-support-kb',
      title: 'Support jadi knowledge base',
      trigger: 'Tiket support selesai dengan solusi berulang',
      action: 'Buat draft artikel bantuan dan snippet balasan cepat.',
      impact: 'Support makin cepat dan user tidak bingung.',
      href: '/support',
    },
  ];

  const aiActions: BusinessAiAction[] = [
    {
      id: 'ai-next-best-action',
      title: 'Next best action harian',
      prompt:
        'Gabungkan chat, transaksi, listing, support, dan aktivitas 7 hari terakhir.',
      output: '3 tindakan paling dekat ke transaksi atau repeat usage.',
      href: '/dashboard',
    },
    {
      id: 'ai-demand-sourcing',
      title: 'Smart sourcing untuk UMKM',
      prompt:
        'Baca request, kategori listing, kota, budget, dan riwayat vendor.',
      output: 'Shortlist supplier/jasa/talent beserta alasan matching.',
      href: '/search',
    },
    {
      id: 'ai-risk-trust',
      title: 'Trust & fraud reviewer',
      prompt:
        'Pantau pola chat, refund, dispute, direct-transfer hint, dan akun baru.',
      output: 'Risk label, guardrail transaksi, dan rekomendasi verifikasi.',
      href: '/transactions',
    },
  ];

  const retentionLoops: BusinessRetentionLoop[] = [
    {
      id: 'daily-work-loop',
      title: 'Daily work loop',
      loop: 'Login -> klaim reward -> lihat next action -> selesaikan 1 tugas.',
      reward: 'Coin, XP, streak, dan unlock boost ringan.',
      metric: 'daily_active_operator',
    },
    {
      id: 'seller-growth-loop',
      title: 'Seller growth loop',
      loop: 'Upload listing -> dapat view -> balas chat -> transaksi -> review.',
      reward: 'Trust badge, ranking search, dan insight performa.',
      metric: 'listing_to_deal_rate',
    },
    {
      id: 'community-commerce-loop',
      title: 'Community commerce loop',
      loop: 'Diskusi masalah -> rekomendasi solusi -> vendor/chat -> deal.',
      reward: 'Social proof, reputation point, dan expert badge.',
      metric: 'community_to_transaction_assist',
    },
  ];

  const trustControls: BusinessTrustControl[] = [
    {
      id: 'rbac-audit',
      title: 'RBAC + audit log',
      guardrail:
        'Setiap aksi bisnis sensitif wajib punya actor, role, dan log.',
      signal: metricIsActive(moduleMetrics, 'erp') ? 'erp_active' : 'erp_ready',
    },
    {
      id: 'scam-prevention',
      title: 'Anti scam transaksi',
      guardrail:
        'Deteksi direct transfer, kata risiko, akun baru, dan dispute pattern.',
      signal:
        overview.active_transactions > 0 ? 'transaction_signal' : 'baseline',
    },
    {
      id: 'privacy-minimization',
      title: 'Privacy minimization',
      guardrail:
        'Event analytics menyimpan konteks produk, bukan isi chat atau data sensitif.',
      signal: 'analytics_ready',
    },
  ];

  const dataFlows: BusinessDataFlow[] = [
    {
      id: 'chat-to-crm',
      source: 'Chat dan inbox',
      enriches: 'CRM lead, customer profile, response SLA',
      usedBy: 'AI follow-up, sales priority, retention reminder',
    },
    {
      id: 'transaction-to-erp',
      source: 'Transaksi dan milestone',
      enriches: 'ERP order state, finance, trust score',
      usedBy: 'Automation reminder, dispute prevention, review prompt',
    },
    {
      id: 'content-to-recommendation',
      source: 'Listing, reels, komunitas, learn',
      enriches: 'Search ranking, creator graph, category demand',
      usedBy: 'Recommendation engine, SEO surface, growth campaign',
    },
    {
      id: 'reward-to-retention',
      source: 'Login streak, coin, XP, mission',
      enriches: 'Retention segment dan active operator score',
      usedBy: 'Daily mission, voucher, boost, lifecycle notification',
    },
  ];

  return {
    health_score: healthScore,
    focus_lane: focusLane,
    system_relations: relations,
    automation_queue: automationQueue,
    ai_copilot_actions: aiActions,
    retention_loops: retentionLoops,
    trust_controls: trustControls,
    data_flows: dataFlows,
  };
}
