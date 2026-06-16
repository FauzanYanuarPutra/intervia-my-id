import { PROMO_ONLY_MODE } from '@/lib/featureFlags';

export type BusinessModuleStatus = 'live' | 'partial' | 'planned';

export type BusinessModuleCategory =
  | 'Core Platform'
  | 'Operations'
  | 'People and Knowledge'
  | 'Finance'
  | 'Growth';

export type BusinessModuleDefinition = {
  slug: string;
  acronym: string;
  name: string;
  category: BusinessModuleCategory;
  status: BusinessModuleStatus;
  summary: string;
  valueStatement: string;
  primaryPath?: string;
  integrations: string[];
  securityFocus: string[];
  kpis: string[];
};

export const BUSINESS_MODULES: BusinessModuleDefinition[] = [
  {
    slug: 'crm',
    acronym: 'CRM',
    name: 'Customer Relationship Management',
    category: 'Core Platform',
    status: 'live',
    summary: 'Lead pipeline, assignment, and support handoff.',
    valueStatement:
      'Turn chats and support tickets into tracked revenue opportunities.',
    primaryPath: '/crm',
    integrations: ['Chat inbox', 'Support queue', 'Transactions'],
    securityFocus: [
      'Role-based access for sales/support',
      'Audit-friendly lead history',
    ],
    kpis: ['Active leads', 'Win rate', 'Support SLA'],
  },
  {
    slug: 'cms',
    acronym: 'CMS',
    name: 'Content Management System',
    category: 'Core Platform',
    status: 'partial',
    summary: 'Publishing and listing lifecycle with moderation hooks.',
    valueStatement:
      'Keep all product and content entries consistent across channels.',
    primaryPath: '/my-listings',
    integrations: ['Search indexing', 'Marketplace content', 'PIM sync'],
    securityFocus: [
      'Draft to publish workflow',
      'Ownership validation before edits',
    ],
    kpis: ['Published content', 'Content freshness', 'Approval turnaround'],
  },
  {
    slug: 'erp',
    acronym: 'ERP',
    name: 'Enterprise Resource Planning',
    category: 'Core Platform',
    status: PROMO_ONLY_MODE ? 'planned' : 'partial',
    summary:
      'Cross-functional operations snapshot for finance, sales, and fulfillment.',
    valueStatement:
      'Single operational truth from transaction to delivery and support.',
    primaryPath: PROMO_ONLY_MODE ? '/dashboard' : '/transactions',
    integrations: ['CRM', 'Finance stack', 'Support and dispute workflow'],
    securityFocus: [
      'Transaction integrity checks',
      'Protected status transitions',
    ],
    kpis: ['In-progress orders', 'Cycle time', 'Dispute rate'],
  },
  {
    slug: 'scm',
    acronym: 'SCM',
    name: 'Supply Chain Management',
    category: 'Operations',
    status: 'planned',
    summary: 'Procurement, vendor chain visibility, and fulfillment readiness.',
    valueStatement:
      'Reduce stock-outs and bottlenecks from supplier to customer.',
    integrations: ['WMS', 'TMS', 'ERP'],
    securityFocus: ['Vendor access boundaries', 'Traceable fulfillment events'],
    kpis: ['Lead time', 'Supplier reliability', 'Fill rate'],
  },
  {
    slug: 'wms',
    acronym: 'WMS',
    name: 'Warehouse Management System',
    category: 'Operations',
    status: 'planned',
    summary: 'Stock movement and warehouse slot control.',
    valueStatement: 'Improve picking speed and inventory accuracy.',
    integrations: ['SCM', 'ERP', 'PIM'],
    securityFocus: ['Scoped operator permissions', 'Inventory mutation logs'],
    kpis: ['Inventory accuracy', 'Pick time', 'Shrinkage'],
  },
  {
    slug: 'tms',
    acronym: 'TMS',
    name: 'Transportation Management System',
    category: 'Operations',
    status: 'partial',
    summary: 'Shipment planning and route orchestration.',
    valueStatement:
      'Lower delivery cost with better route and carrier planning.',
    primaryPath: '/search?type=service&q=jasa%20pengiriman%20usaha',
    integrations: ['SCM', 'ERP', 'Support notifications'],
    securityFocus: ['Carrier identity validation', 'Delivery event signing'],
    kpis: [
      'On-time delivery',
      'Transport cost per order',
      'Failed delivery rate',
    ],
  },
  {
    slug: 'plm',
    acronym: 'PLM',
    name: 'Product Lifecycle Management',
    category: 'Operations',
    status: 'partial',
    summary: 'From product idea to active listing and retirement.',
    valueStatement: 'Align teams on one product lifecycle and change log.',
    primaryPath: '/create',
    integrations: ['PIM', 'CMS', 'Analytics'],
    securityFocus: [
      'Versioned product history',
      'Approval gates for spec changes',
    ],
    kpis: ['Time-to-launch', 'Spec accuracy', 'Revision cycles'],
  },
  {
    slug: 'mes',
    acronym: 'MES',
    name: 'Manufacturing Execution System',
    category: 'Operations',
    status: 'planned',
    summary: 'Factory floor and production state monitoring.',
    valueStatement: 'Expose real-time production signals for better planning.',
    integrations: ['PLM', 'SCM', 'BI'],
    securityFocus: ['Machine access zoning', 'Operational telemetry integrity'],
    kpis: ['Downtime', 'Yield', 'Throughput'],
  },
  {
    slug: 'hris',
    acronym: 'HRIS',
    name: 'Human Resource Information System',
    category: 'People and Knowledge',
    status: 'partial',
    summary: 'Talent pipeline and team profile foundation.',
    valueStatement: 'Recruit and operate teams with structured people data.',
    primaryPath: '/search?type=job&q=lowongan',
    integrations: ['LMS', 'PMS', 'KMS'],
    securityFocus: [
      'Sensitive data separation',
      'Least privilege for HR operations',
    ],
    kpis: ['Time-to-hire', 'Applicant conversion', 'Retention signals'],
  },
  {
    slug: 'lms',
    acronym: 'LMS',
    name: 'Learning Management System',
    category: 'People and Knowledge',
    status: 'partial',
    summary: 'Training, learning pathways, and upskilling readiness.',
    valueStatement:
      'Build a learning loop directly from operational performance gaps.',
    primaryPath: '/education',
    integrations: ['HRIS', 'KMS', 'BI'],
    securityFocus: ['Learning access control', 'Certified completion records'],
    kpis: ['Course completion', 'Skill progression', 'Certification rate'],
  },
  {
    slug: 'pms',
    acronym: 'PMS',
    name: 'Project Management System',
    category: 'People and Knowledge',
    status: PROMO_ONLY_MODE ? 'planned' : 'live',
    summary:
      'Project progress, delivery checkpoints, and execution visibility.',
    valueStatement:
      'Connect planning to execution without leaving the platform.',
    primaryPath: PROMO_ONLY_MODE ? '/home' : '/my-projects',
    integrations: ['Chat', 'Transactions', 'KMS'],
    securityFocus: ['Workspace member roles', 'Project activity logs'],
    kpis: ['On-time completion', 'Blocked task age', 'Scope change frequency'],
  },
  {
    slug: 'kms',
    acronym: 'KMS',
    name: 'Knowledge Management System',
    category: 'People and Knowledge',
    status: 'live',
    summary: 'Persistent internal knowledge base and team know-how.',
    valueStatement: 'Keep operational knowledge discoverable and reusable.',
    primaryPath: '/community',
    integrations: ['LMS', 'PMS', 'Support'],
    securityFocus: [
      'Granular read/write permission',
      'Versioned knowledge records',
    ],
    kpis: [
      'Knowledge reuse rate',
      'Resolution time',
      'Duplicate question ratio',
    ],
  },
  {
    slug: 'dms',
    acronym: 'DMS',
    name: 'Document Management System',
    category: 'People and Knowledge',
    status: 'partial',
    summary: 'Document-centric workflows for business and legal operations.',
    valueStatement:
      'Store, version, and retrieve critical files fast and safely.',
    primaryPath: '/content',
    integrations: ['ERP', 'KMS', 'Support'],
    securityFocus: ['Document access boundaries', 'Immutable version timeline'],
    kpis: [
      'Document retrieval time',
      'Version conflicts',
      'Compliance completion',
    ],
  },
  {
    slug: 'fms',
    acronym: 'FMS',
    name: 'Financial Management System',
    category: 'Finance',
    status: PROMO_ONLY_MODE ? 'planned' : 'partial',
    summary: 'Financial oversight, cash movement, and operational accounting.',
    valueStatement:
      'Track business cash flow and transaction health from one place.',
    primaryPath: PROMO_ONLY_MODE ? '/dashboard' : '/payments',
    integrations: ['ERP', 'POS', 'Transactions'],
    securityFocus: [
      'Monetary mutation protection',
      'High-risk action verification',
    ],
    kpis: ['Cash velocity', 'Margin trend', 'Payment success rate'],
  },
  {
    slug: 'pos',
    acronym: 'POS',
    name: 'Point of Sale',
    category: 'Finance',
    status: PROMO_ONLY_MODE ? 'planned' : 'partial',
    summary:
      'Checkout and payment operations for online and assisted channels.',
    valueStatement: 'Unify checkout data with CRM and finance reporting.',
    primaryPath: PROMO_ONLY_MODE ? '/dashboard' : '/payments',
    integrations: ['FMS', 'ERP', 'CDP'],
    securityFocus: [
      'Payment tokenization strategy',
      'Fraud and anomaly checks',
    ],
    kpis: ['Checkout conversion', 'Refund ratio', 'Chargeback rate'],
  },
  {
    slug: 'eam',
    acronym: 'EAM',
    name: 'Enterprise Asset Management',
    category: 'Finance',
    status: 'partial',
    summary: 'Asset lifecycle tracking for high-value equipment and property.',
    valueStatement:
      'Reduce downtime and asset leakage with stronger governance.',
    primaryPath: '/search?type=property&q=lokasi%20jualan',
    integrations: ['ERP', 'FMS', 'BI'],
    securityFocus: [
      'Asset ownership traceability',
      'Maintenance approval controls',
    ],
    kpis: ['Asset uptime', 'Maintenance cost', 'Asset utilization'],
  },
  {
    slug: 'bi',
    acronym: 'BI',
    name: 'Business Intelligence',
    category: 'Growth',
    status: 'partial',
    summary: 'Cross-domain analytics and insight dashboarding.',
    valueStatement:
      'Transform raw operational data into decision-ready signals.',
    primaryPath: '/dashboard',
    integrations: ['CRM', 'ERP', 'CDP', 'MA'],
    securityFocus: ['PII-safe aggregation', 'Controlled analytics access'],
    kpis: ['Insight adoption', 'Forecast accuracy', 'Reporting latency'],
  },
  {
    slug: 'ma',
    acronym: 'MA',
    name: 'Marketing Automation',
    category: 'Growth',
    status: 'partial',
    summary: 'Audience campaigns and lifecycle engagement automation.',
    valueStatement:
      'Run targeted campaigns using behavior and transaction context.',
    primaryPath: '/search',
    integrations: ['CDP', 'CRM', 'BI'],
    securityFocus: [
      'Consent-aware campaign triggers',
      'Audience policy enforcement',
    ],
    kpis: ['Campaign ROI', 'Lead conversion', 'Engagement lift'],
  },
  {
    slug: 'cdp',
    acronym: 'CDP',
    name: 'Customer Data Platform',
    category: 'Growth',
    status: 'partial',
    summary: 'Unified customer profile from activity across modules.',
    valueStatement:
      'Create a 360 customer view for better service and conversion.',
    primaryPath: '/crm',
    integrations: ['CRM', 'MA', 'BI', 'Support'],
    securityFocus: [
      'Identity stitching safeguards',
      'Data minimization controls',
    ],
    kpis: ['Profile completeness', 'Segment quality', 'Personalization impact'],
  },
  {
    slug: 'pim',
    acronym: 'PIM',
    name: 'Product Information Management',
    category: 'Growth',
    status: 'live',
    summary: 'Central product metadata for marketplace consistency.',
    valueStatement:
      'Keep product content consistent across every sales channel.',
    primaryPath: '/my-listings',
    integrations: ['CMS', 'PLM', 'WMS'],
    securityFocus: [
      'Controlled catalog edits',
      'Validation for mandatory fields',
    ],
    kpis: [
      'Catalog completeness',
      'Listing quality score',
      'Update propagation time',
    ],
  },
];

export function getBusinessModuleBySlug(
  slug: string,
): BusinessModuleDefinition | undefined {
  return BUSINESS_MODULES.find(item => item.slug === slug);
}

export function getModulePrimaryHref(module: BusinessModuleDefinition): string {
  return module.primaryPath || `/workspace/modules/${module.slug}`;
}

export function getModuleBlueprintHref(
  module: BusinessModuleDefinition,
): string {
  return `/workspace/modules/${module.slug}`;
}
