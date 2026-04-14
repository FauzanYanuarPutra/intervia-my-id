'use client';

import React, { useEffect, useRef, useState } from 'react';
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  Bell,
  Boxes,
  ChevronDown,
  CircleDollarSign,
  FileStack,
  LayoutDashboard,
  Menu,
  Package,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Settings2,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  UserPlus,
  UsersRound,
} from 'lucide-react';

type SectionId =
  | 'dashboard'
  | 'contacts'
  | 'leads'
  | 'deals'
  | 'products'
  | 'orders'
  | 'content'
  | 'analytics'
  | 'settings';

type SaasAdminDashboardProps = {
  workspaceLabel: string;
  workspaceTag: string;
  defaultSection?: SectionId;
};

type NavItem = {
  id: SectionId;
  label: string;
  icon: LucideIcon;
  badge?: string;
};

const NAV_ITEMS: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'contacts', label: 'Contacts / Customers', icon: UsersRound, badge: '3.2K' },
  { id: 'leads', label: 'Leads', icon: UserPlus, badge: '128' },
  { id: 'deals', label: 'Deals', icon: CircleDollarSign, badge: '42' },
  { id: 'products', label: 'Products', icon: Boxes, badge: '64' },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, badge: '219' },
  { id: 'content', label: 'CMS Content', icon: FileStack, badge: '12' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, badge: 'Live' },
  { id: 'settings', label: 'Settings', icon: Settings2 },
];

const SECTION_COPY: Record<SectionId, { eyebrow: string; title: string; description: string }> = {
  dashboard: {
    eyebrow: 'Unified command center',
    title: 'Revenue, customers, orders, and content operations in one clean workspace.',
    description:
      'A modern operating layer for CRM and CMS teams with the clarity and restraint you expect from mature SaaS tools.',
  },
  contacts: {
    eyebrow: 'Customer relationships',
    title: 'Keep every customer record, owner, and next step visible without clutter.',
    description: 'The same shell can support renewals, support handoffs, and account expansion planning.',
  },
  leads: {
    eyebrow: 'Lead pipeline',
    title: 'Surface high-intent opportunities early and keep follow-ups moving.',
    description: 'Qualification, velocity, and response timing stay aligned inside one responsive dashboard.',
  },
  deals: {
    eyebrow: 'Deal desk',
    title: 'Monitor close dates, weighted pipeline, and team focus from a single surface.',
    description: 'Fast visibility reduces context switching and keeps commercial work readable.',
  },
  products: {
    eyebrow: 'Catalog operations',
    title: 'Pricing, availability, and launch readiness stay connected to sales execution.',
    description: 'Product and content changes are visible inside the same SaaS workspace.',
  },
  orders: {
    eyebrow: 'Order operations',
    title: 'Track fulfillment health before issues cascade into support volume.',
    description: 'Operations, finance, and support all work from one stable dashboard frame.',
  },
  content: {
    eyebrow: 'CMS studio',
    title: 'Editorial velocity, approvals, and publishing quality stay in sync with demand.',
    description: 'Campaigns and knowledge content can share the same clean operating model as CRM workflows.',
  },
  analytics: {
    eyebrow: 'Performance analytics',
    title: 'Turn growth signals into a daily operating rhythm the whole team can read.',
    description: 'The layout stays minimal while still carrying the metrics that matter.',
  },
  settings: {
    eyebrow: 'Workspace settings',
    title: 'Permissions, automation, and workflow safeguards belong in the same system shell.',
    description: 'A professional dashboard should scale from operators to leadership without changing language.',
  },
};

const KPI_CARDS = [
  { label: 'Revenue', value: '$482.6K', change: '+18.4%', note: 'vs last month', icon: CircleDollarSign, tone: 'text-[color:var(--app-accent)]' },
  { label: 'Customers', value: '8,492', change: '+9.2%', note: 'active accounts', icon: UsersRound, tone: 'text-[color:var(--app-accent)]' },
  { label: 'Orders', value: '1,284', change: '+12.7%', note: 'processed this month', icon: Package, tone: 'text-[color:var(--app-accent)]' },
];

const SALES_DATA = [
  { month: 'Jan', revenue: 74, newCustomers: 28 },
  { month: 'Feb', revenue: 82, newCustomers: 31 },
  { month: 'Mar', revenue: 95, newCustomers: 34 },
  { month: 'Apr', revenue: 108, newCustomers: 37 },
  { month: 'May', revenue: 121, newCustomers: 41 },
  { month: 'Jun', revenue: 134, newCustomers: 43 },
  { month: 'Jul', revenue: 142, newCustomers: 47 },
  { month: 'Aug', revenue: 155, newCustomers: 49 },
  { month: 'Sep', revenue: 167, newCustomers: 52 },
  { month: 'Oct', revenue: 181, newCustomers: 57 },
  { month: 'Nov', revenue: 194, newCustomers: 60 },
  { month: 'Dec', revenue: 208, newCustomers: 64 },
];

const ACTIVITY_ITEMS = [
  { title: 'Enterprise renewal closed', detail: 'Northstar Group upgraded to Growth Plus.', time: '8 min ago' },
  { title: 'Lead segment imported', detail: '124 inbound contacts added from the Q1 campaign.', time: '26 min ago' },
  { title: 'Knowledge base update published', detail: 'The onboarding checklist is now live.', time: '1 hr ago' },
  { title: 'Order review flagged', detail: 'Two high-value orders need manual approval.', time: '2 hr ago' },
];

const TASK_ITEMS = [
  { title: 'Follow up on stalled enterprise deal', owner: 'Mia', due: 'Today', progress: 78 },
  { title: 'Approve homepage campaign copy', owner: 'Rafi', due: 'Tomorrow', progress: 54 },
  { title: 'Review churn-risk customer notes', owner: 'Nadia', due: 'Thu', progress: 33 },
  { title: 'Sync product pricing with CMS', owner: 'Eka', due: 'Fri', progress: 91 },
];

const LATEST_CUSTOMERS = [
  { name: 'Avery Martinez', company: 'Northstar Labs', email: 'avery@northstarlabs.com', value: '$24,000', status: 'Active', lastActive: '2h ago' },
  { name: 'Sofia Turner', company: 'Arc Pixel', email: 'sofia@arcpixel.co', value: '$14,300', status: 'Trial', lastActive: '4h ago' },
  { name: 'Theo Kim', company: 'Atlas Commerce', email: 'theo@atlascommerce.io', value: '$9,800', status: 'Pending', lastActive: 'Yesterday' },
  { name: 'Nina Patel', company: 'Monarch Health', email: 'nina@monarchhealth.ai', value: '$31,500', status: 'Active', lastActive: 'Yesterday' },
];

function statusClass(status: string) {
  if (status === 'Active') return 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]';
  if (status === 'Trial') return 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]';
  return 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]';
}

function SalesTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value?: number; dataKey?: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  const revenue = payload.find((item) => item.dataKey === 'revenue')?.value ?? 0;
  const newCustomers = payload.find((item) => item.dataKey === 'newCustomers')?.value ?? 0;

  return (
    <div className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-3 shadow-xl text-[color:var(--app-accent)] backdrop-blur">
      <p className="text-xs font-semibold text-[color:var(--app-accent)]">{label}</p>
      <p className="mt-1 text-xs text-[color:var(--app-accent)]">Revenue: ${revenue}K</p>
      <p className="text-xs text-[color:var(--app-accent)]">New customers: {newCustomers}</p>
    </div>
  );
}

export default function SaasAdminDashboard({
  workspaceLabel,
  workspaceTag,
  defaultSection = 'dashboard',
}: SaasAdminDashboardProps) {
  const [activeSection, setActiveSection] = useState<SectionId>(defaultSection);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsSidebarOpen(false);
        setIsProfileOpen(false);
      }
    };
    const onPointerDown = (event: MouseEvent) => {
      if (!profileRef.current?.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('mousedown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('mousedown', onPointerDown);
    };
  }, []);

  useEffect(() => {
    if (!isSidebarOpen) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [isSidebarOpen]);

  const currentSection = SECTION_COPY[activeSection];
  const toggleSidebar = () => {
    if (window.innerWidth >= 1024) {
      setIsSidebarCollapsed((current) => !current);
      return;
    }
    setIsSidebarOpen((current) => !current);
  };

  const selectSection = (sectionId: SectionId) => {
    setActiveSection(sectionId);
    if (window.innerWidth < 1024) setIsSidebarOpen(false);
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_26%),radial-gradient(circle_at_top_right,_rgba(59,130,246,0.14),_transparent_24%),linear-gradient(180deg,_rgba(255,255,255,0.82),_rgba(243,247,251,0.55))]" />
      <div className="pointer-events-none absolute inset-0 opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.14)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.14)_1px,transparent_1px)] [background-size:24px_24px]" />
      <div
        className={`fixed inset-0 z-40 text-[color:var(--app-accent)] backdrop-blur-sm transition-opacity duration-300 lg:hidden ${
          isSidebarOpen ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={() => setIsSidebarOpen(false)}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-screen flex-col border-r text-[color:var(--app-accent)] bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_96%,_transparent)] text-[color:var(--app-accent)] shadow-[0_30px_70px_-24px_rgba(15,23,42,0.9)] backdrop-blur-2xl transition-all duration-300 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } ${isSidebarCollapsed ? 'lg:w-24' : 'lg:w-72'} w-[86vw] max-w-[320px] lg:translate-x-0`}
      >
        <div className="flex items-center justify-between border-b text-[color:var(--app-accent)] px-4 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] text-sm font-semibold text-[color:var(--app-accent)]">
              LX
            </div>
            {!isSidebarCollapsed && (
              <div>
                <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--app-accent)]">{workspaceTag}</p>
                <p className="mt-1 text-base font-semibold text-[color:var(--app-accent)]">{workspaceLabel}</p>
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={() => setIsSidebarOpen(false)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-2xl border bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] lg:hidden"
            aria-label="Close sidebar"
          >
            <PanelLeftClose className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-4">
          <div className="mb-3 px-3 text-[11px] uppercase tracking-[0.32em] text-[color:var(--app-accent)]">
            {isSidebarCollapsed ? 'Nav' : 'Workspace'}
          </div>
          <nav className="space-y-1.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive = item.id === activeSection;

              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => selectSection(item.id)}
                  aria-label={item.label}
                  className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                    isActive
                      ? 'bg-gradient-to-r bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] to-transparent text-[color:var(--app-accent)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08)]'
                      : 'bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]'
                  } ${isSidebarCollapsed ? 'justify-center lg:px-0' : ''}`}
                >
                  <span
                    className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                      isActive ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]' : 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                  </span>
                  {!isSidebarCollapsed && (
                    <>
                      <span className="min-w-0 flex-1 text-sm font-medium">{item.label}</span>
                      {item.badge ? (
                        <span
                          className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                            isActive ? 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]' : 'bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]'
                          }`}
                        >
                          {item.badge}
                        </span>
                      ) : null}
                    </>
                  )}
                </button>
              );
            })}
          </nav>
        </div>

        {!isSidebarCollapsed && (
          <div className="border-t text-[color:var(--app-accent)] p-3">
            <div className="rounded-[24px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4 text-[color:var(--app-accent)]">
              <div className="flex items-center gap-2 text-xs font-semibold text-[color:var(--app-accent)]">
                <Sparkles className="h-4 w-4 text-[color:var(--app-accent)]" />
                Enterprise plan
              </div>
              <p className="mt-2 text-sm text-[color:var(--app-accent)]">
                Automation and reporting stay synced across CRM and CMS teams.
              </p>
            </div>
          </div>
        )}
      </aside>
      <div
        className={`relative transition-[padding] duration-300 ${
          isSidebarCollapsed ? 'lg:pl-24' : 'lg:pl-72'
        }`}
      >
        <div className="mx-auto flex min-h-screen w-full max-w-[1600px] flex-col px-4 py-4 sm:px-6 sm:py-6 xl:px-8">
          <header className="sticky top-4 z-30">
            <div className="rounded-[28px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-4 shadow-[0_20px_50px_-30px_rgba(15,23,42,0.45)] backdrop-blur-xl sm:px-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={toggleSidebar}
                    className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] transition border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                    aria-label="Toggle sidebar"
                  >
                    {isSidebarCollapsed ? (
                      <PanelLeftOpen className="hidden h-4 w-4 lg:block" />
                    ) : (
                      <PanelLeftClose className="hidden h-4 w-4 lg:block" />
                    )}
                    <Menu className="h-4 w-4 lg:hidden" />
                  </button>
                  <div>
                    <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--app-accent)]">
                      {currentSection.eyebrow}
                    </p>
                    <p className="mt-1 text-sm font-medium text-[color:var(--app-accent)]">{workspaceTag} workspace</p>
                  </div>
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-3 shadow-inner text-[color:var(--app-accent)] sm:min-w-[280px] xl:min-w-[360px]">
                    <Search className="h-4 w-4 shrink-0 text-[color:var(--app-accent)]" />
                    <input
                      type="search"
                      placeholder="Search customers, deals, content, or orders"
                      className="w-full border-0 bg-transparent p-0 text-sm border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] focus:outline-none focus:ring-0"
                    />
                  </label>

                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] transition border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                      aria-label="Notifications"
                    >
                      <Bell className="h-4 w-4" />
                      <span className="absolute right-3 top-3 h-2.5 w-2.5 rounded-full text-[color:var(--app-accent)] ring-2 text-[color:var(--app-accent)]" />
                    </button>

                    <div className="relative" ref={profileRef}>
                      <button
                        type="button"
                        onClick={() => setIsProfileOpen((current) => !current)}
                        className="flex items-center gap-3 rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-2.5 text-left shadow-sm transition text-[color:var(--app-accent)]"
                        aria-expanded={isProfileOpen}
                        aria-label="Open user menu"
                      >
                        <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)] text-sm font-semibold text-[color:var(--app-accent)]">
                          AL
                        </div>
                        <div className="hidden sm:block">
                          <p className="text-sm font-semibold text-[color:var(--app-accent)]">Alya Putri</p>
                          <p className="text-xs text-[color:var(--app-accent)]">Operations lead</p>
                        </div>
                        <ChevronDown className="h-4 w-4 text-[color:var(--app-accent)]" />
                      </button>

                      <div
                        className={`absolute right-0 top-[calc(100%+12px)] w-60 rounded-3xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-2 shadow-[0_25px_60px_-28px_rgba(15,23,42,0.35)] backdrop-blur-xl transition ${
                          isProfileOpen
                            ? 'translate-y-0 opacity-100'
                            : 'pointer-events-none -translate-y-2 opacity-0'
                        }`}
                      >
                        {['My profile', 'Team settings', 'Notifications', 'Sign out'].map((item) => (
                          <button
                            key={item}
                            type="button"
                            className="flex w-full items-center justify-between rounded-2xl px-4 py-3 text-sm text-[color:var(--app-accent)] transition bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]"
                          >
                            <span>{item}</span>
                            <span className="text-xs text-[color:var(--app-accent)]">Open</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </header>

          <main className="relative z-10 flex-1 pt-6">
            <section className="grid gap-5 xl:grid-cols-[minmax(0,1.35fr)_360px]">
              <div className="rounded-[32px] border text-[color:var(--app-accent)] bg-[linear-gradient(135deg,rgba(255,255,255,0.92),rgba(255,255,255,0.68)),radial-gradient(circle_at_top_right,rgba(16,185,129,0.16),transparent_34%),radial-gradient(circle_at_bottom_left,rgba(59,130,246,0.12),transparent_34%)] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)] backdrop-blur-xl sm:p-8">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-accent)]">
                    {workspaceTag}
                  </span>
                  <span className="rounded-full border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--app-accent)]">
                    Modern SaaS dashboard
                  </span>
                </div>
                <h1 className="mt-6 max-w-3xl text-[clamp(2rem,3vw,3.4rem)] font-semibold tracking-[-0.05em] text-[color:var(--app-accent)]">
                  {currentSection.title}
                </h1>
                <p className="mt-4 max-w-2xl text-sm leading-7 text-[color:var(--app-accent)] sm:text-base">
                  {currentSection.description}
                </p>
                <div className="mt-8 flex flex-wrap gap-3">
                  <button
                    type="button"
                    className="rounded-2xl text-[color:var(--app-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--app-accent)] transition text-[color:var(--app-accent)]"
                  >
                    Create new record
                  </button>
                  <button
                    type="button"
                    className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-5 py-3 text-sm font-semibold text-[color:var(--app-accent)] transition border-[color:var(--app-accent-border)] text-[color:var(--app-accent)]"
                  >
                    Publish content update
                  </button>
                </div>
              </div>

              <div className="rounded-[32px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--app-accent)]">
                  Workspace pulse
                </p>
                <p className="mt-2 text-lg font-semibold text-[color:var(--app-accent)]">Everything is moving on plan.</p>
                <div className="mt-6 space-y-4">
                  {[
                    { label: 'Pipeline coverage', value: '4.6x', note: 'healthy against target' },
                    { label: 'Open tasks', value: '17', note: '7 due before noon' },
                    { label: 'Content in review', value: '12', note: '3 waiting on approval' },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="rounded-[22px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-4"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--app-accent)]">{item.label}</p>
                          <p className="mt-1 text-xs text-[color:var(--app-accent)]">{item.note}</p>
                        </div>
                        <p className="text-lg font-semibold text-[color:var(--app-accent)]">{item.value}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <section className="mt-5 grid gap-5 md:grid-cols-3">
              {KPI_CARDS.map((item) => {
                const Icon = item.icon;
                return (
                  <article
                    key={item.label}
                    className={`rounded-[30px] border text-[color:var(--app-accent)] bg-gradient-to-br ${item.tone} border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-6 shadow-[0_18px_48px_-34px_rgba(15,23,42,0.42)] backdrop-blur-xl`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--app-accent)]">
                          {item.label}
                        </p>
                        <p className="mt-3 text-3xl font-semibold tracking-[-0.04em] text-[color:var(--app-accent)]">
                          {item.value}
                        </p>
                      </div>
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border bg-[color:var(--app-accent-soft)] border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] shadow-sm">
                        <Icon className="h-5 w-5" />
                      </span>
                    </div>
                    <div className="mt-6 flex items-center justify-between">
                      <span className="inline-flex items-center gap-1 rounded-full border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-3 py-1 text-xs font-semibold text-[color:var(--app-accent)]">
                        <TrendingUp className="h-3.5 w-3.5" />
                        {item.change}
                      </span>
                      <span className="text-xs text-[color:var(--app-accent)]">{item.note}</span>
                    </div>
                  </article>
                );
              })}
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1.7fr)_380px]">
              <article className="rounded-[32px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)] backdrop-blur-xl sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--app-accent)]">
                      Sales chart
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--app-accent)]">
                      Revenue keeps climbing with stronger retention.
                    </h2>
                  </div>
                  <div className="inline-flex rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-1 text-xs font-semibold text-[color:var(--app-accent)]">
                    <button type="button" className="rounded-xl text-[color:var(--app-accent)] px-3 py-2 text-[color:var(--app-accent)] shadow-sm">
                      12 months
                    </button>
                    <button type="button" className="rounded-xl px-3 py-2">
                      90 days
                    </button>
                    <button type="button" className="rounded-xl px-3 py-2">
                      30 days
                    </button>
                  </div>
                </div>

                <div className="mt-6 h-[320px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={SALES_DATA} margin={{ top: 12, right: 12, left: -18, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revenueFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--app-accent)" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="var(--app-accent)" stopOpacity={0.02} />
                        </linearGradient>
                        <linearGradient id="customersFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="var(--app-info)" stopOpacity={0.16} />
                          <stop offset="95%" stopColor="var(--app-info)" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="4 4" stroke="var(--app-border)" vertical={false} />
                      <XAxis
                        dataKey="month"
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--app-text-soft)', fontSize: 12 }}
                      />
                      <YAxis
                        axisLine={false}
                        tickLine={false}
                        tick={{ fill: 'var(--app-text-soft)', fontSize: 12 }}
                        tickFormatter={(value: number) => `$${value}K`}
                      />
                      <Tooltip content={<SalesTooltip />} cursor={{ stroke: 'var(--app-border)', strokeDasharray: '4 4' }} />
                      <Area
                        type="monotone"
                        dataKey="newCustomers"
                        stroke="var(--app-info)"
                        strokeWidth={2}
                        fill="url(#customersFill)"
                      />
                      <Area
                        type="monotone"
                        dataKey="revenue"
                        stroke="var(--app-accent)"
                        strokeWidth={3}
                        fill="url(#revenueFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </article>

              <div className="grid gap-5">
                <article className="rounded-[32px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--app-accent)]">
                    Recent activity
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--app-accent)]">
                    Live updates from sales and content ops.
                  </h2>
                  <div className="mt-6 space-y-4">
                    {ACTIVITY_ITEMS.map((item, index) => (
                      <div key={item.title} className="flex gap-4">
                        <span
                          className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                            index === 0
                              ? 'text-[color:var(--app-accent)]'
                              : index === 1
                                ? 'text-[color:var(--app-accent)]'
                                : index === 2
                                  ? 'text-[color:var(--app-accent)]'
                                  : 'text-[color:var(--app-accent)]'
                          }`}
                        />
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--app-accent)]">{item.title}</p>
                          <p className="mt-1 text-sm text-[color:var(--app-accent)]">{item.detail}</p>
                          <p className="mt-2 text-xs uppercase tracking-[0.18em] text-[color:var(--app-accent)]">
                            {item.time}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </article>

                <article className="rounded-[32px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)] backdrop-blur-xl">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--app-accent)]">
                    Task list
                  </p>
                  <h2 className="mt-2 text-xl font-semibold tracking-[-0.03em] text-[color:var(--app-accent)]">
                    The next actions keeping the team ahead.
                  </h2>
                  <div className="mt-6 space-y-4">
                    {TASK_ITEMS.map((item) => (
                      <div key={item.title} className="rounded-[24px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-semibold text-[color:var(--app-accent)]">{item.title}</p>
                            <p className="mt-2 text-xs text-[color:var(--app-accent)]">
                              {item.owner} · Due {item.due}
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-[color:var(--app-accent)]">{item.progress}%</span>
                        </div>
                        <div className="mt-4 h-2 rounded-full text-[color:var(--app-accent)]">
                          <div
                            className="h-full rounded-full bg-gradient-to-r bg-[color:var(--app-accent-soft)] text-[color:var(--app-accent)]"
                            style={{ width: `${item.progress}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </article>
              </div>
            </section>

            <section className="mt-5 rounded-[32px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-6 shadow-[0_24px_60px_-36px_rgba(15,23,42,0.4)] backdrop-blur-xl sm:p-7">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.26em] text-[color:var(--app-accent)]">
                    Latest customers
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] text-[color:var(--app-accent)]">
                    The newest accounts entering the platform this week.
                  </h2>
                </div>
                <button
                  type="button"
                  className="rounded-2xl border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] px-4 py-3 text-sm font-semibold text-[color:var(--app-accent)] transition text-[color:var(--app-accent)]"
                >
                  Export report
                </button>
              </div>

              <div className="mt-6 space-y-3 md:hidden">
                {LATEST_CUSTOMERS.map((customer) => (
                  <div key={customer.email} className="rounded-[24px] border border-[color:var(--app-accent-border)] text-[color:var(--app-accent)] p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--app-accent)]">{customer.name}</p>
                        <p className="mt-1 text-sm text-[color:var(--app-accent)]">{customer.company}</p>
                      </div>
                      <span
                        className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClass(customer.status)}`}
                      >
                        {customer.status}
                      </span>
                    </div>
                    <div className="mt-4 grid gap-2 text-xs text-[color:var(--app-accent)]">
                      <p>{customer.email}</p>
                      <p>Deal value: {customer.value}</p>
                      <p>Last active: {customer.lastActive}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 hidden overflow-x-auto md:block">
                <table className="min-w-full border-separate border-spacing-y-3">
                  <thead>
                    <tr className="text-left text-xs font-semibold uppercase tracking-[0.22em] text-[color:var(--app-accent)]">
                      <th className="px-4 py-2">Customer</th>
                      <th className="px-4 py-2">Company</th>
                      <th className="px-4 py-2">Email</th>
                      <th className="px-4 py-2">Deal value</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Last active</th>
                    </tr>
                  </thead>
                  <tbody>
                    {LATEST_CUSTOMERS.map((customer) => (
                      <tr key={customer.email} className="text-[color:var(--app-accent)] text-sm text-[color:var(--app-accent)]">
                        <td className="rounded-l-[22px] px-4 py-4 font-semibold text-[color:var(--app-accent)]">
                          {customer.name}
                        </td>
                        <td className="px-4 py-4">{customer.company}</td>
                        <td className="px-4 py-4">{customer.email}</td>
                        <td className="px-4 py-4 font-semibold text-[color:var(--app-accent)]">{customer.value}</td>
                        <td className="px-4 py-4">
                          <span
                            className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${statusClass(customer.status)}`}
                          >
                            {customer.status}
                          </span>
                        </td>
                        <td className="rounded-r-[22px] px-4 py-4">{customer.lastActive}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
