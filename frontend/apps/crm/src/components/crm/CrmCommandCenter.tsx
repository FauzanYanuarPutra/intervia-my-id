"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { OperationsPriorityPanel } from "./OperationsPriorityPanel";
import { PipelineWorkspace } from "./PipelineWorkspace";
import { ContactWorkspace } from "./ContactWorkspace";
import { ConversationWorkspace } from "./ConversationWorkspace";
import { SupportRiskWorkspace } from "./SupportRiskWorkspace";
import { TransactionWorkspace } from "./TransactionWorkspace";
import { AnalyticsWorkspace } from "./AnalyticsWorkspace";
import { AdministrationWorkspace } from "./AdministrationWorkspace";
import { OperationsOverview } from "./OperationsOverview";
import { createEmptyDashboardData } from "./dashboardData";
import { buildOperationsPriorities } from "./operationsPriority";
import { CRM_NAV_ITEMS } from "./navigation";
import type { IconName, PageId } from "./types";
import { useAuth, useRequireAuth } from "@/context/AuthContext";
import {
  activityApi,
  contentApi,
  leadApi,
  superAppApi,
  supportApi,
  usersApi,
  type CrmActivity,
  type CrmContentItem,
  type CrmLead,
  type SuperAppOrder,
  type SuperAppTrustProfile,
  type SupportTicket,
} from "@/lib/api";

import type { CrmActivityRow, CrmChatRow, CrmListingRow, CrmTransactionRow, CrmUserRow, DashboardData, UnknownRecord } from './models';


type TrustProfileUpdatePayload = Parameters<
  typeof superAppApi.upsertTrustProfile
>[2];


function asRecord(value: unknown): UnknownRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as UnknownRecord;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  const numeric = Number(String(value ?? "").replace(/[^\d.-]/g, ""));
  return Number.isFinite(numeric) ? numeric : 0;
}

function asBoolean(value: unknown): boolean {
  return value === true || value === "true" || value === 1 || value === "1";
}

function readItems<T>(value: unknown): T[] {
  if (Array.isArray(value)) return value as T[];
  const record = asRecord(value);
  const candidates = [record.items, record.users, record.data, record.results];
  const found = candidates.find(Array.isArray);
  return Array.isArray(found) ? (found as T[]) : [];
}

function settledItems<T>(
  result: PromiseSettledResult<unknown>,
  label: string,
  failures: string[],
): T[] {
  if (result.status === "rejected") {
    failures.push(label);
    return [];
  }
  return readItems<T>(result.value);
}

function formatCurrency(valueCents: number, currency = "IDR"): string {
  const amount = Math.max(0, Math.round(valueCents || 0)) / 100;
  if (currency.toUpperCase() !== "IDR") {
    return `${currency.toUpperCase()} ${amount.toLocaleString("id-ID")}`;
  }
  if (amount >= 1_000_000_000) return `Rp ${(amount / 1_000_000_000).toFixed(1)} M`;
  if (amount >= 1_000_000) return `Rp ${(amount / 1_000_000).toFixed(1)} jt`;
  return `Rp ${amount.toLocaleString("id-ID")}`;
}

function compactId(value: string): string {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function stageGroup(stage: string): "new" | "interested" | "negotiation" | "locked" | "completed" {
  const clean = stage.toLowerCase();
  if (clean === "qualified") return "interested";
  if (clean === "negotiation") return "negotiation";
  if (clean === "contract") return "locked";
  if (clean === "won" || clean === "completed") return "completed";
  return "new";
}

function statusLabel(status: string): string {
  const clean = status.toLowerCase();
  if (clean === "active") return "Aktif";
  if (clean === "draft") return "Draft";
  if (clean === "paused") return "Perlu revisi";
  if (clean === "archived") return "Arsip";
  if (clean === "completed") return "Selesai";
  if (clean === "disputed") return "Dispute";
  if (clean.includes("progress")) return "Dikerjakan";
  if (clean.includes("pending")) return "Pending";
  return clean ? clean.replaceAll("_", " ") : "-";
}

function listingStatus(status: string): CrmListingRow["status"] {
  const clean = status.toLowerCase();
  if (clean === "active") return "active";
  if (clean === "paused" || clean === "archived") return "rejected";
  if (clean === "draft") return "draft";
  return "pending";
}

function toneForStatus(status: string): "success" | "warning" | "danger" | "neutral" {
  const clean = status.toLowerCase();
  if (clean === "active" || clean === "completed" || clean === "won") return "success";
  if (clean === "paused" || clean === "archived" || clean === "disputed") return "danger";
  if (clean.includes("pending") || clean.includes("progress") || clean === "draft") return "warning";
  return "neutral";
}

function roleFromRecord(record: UnknownRecord, trust?: SuperAppTrustProfile): CrmUserRow["role"] {
  const rawRoles = Array.isArray(record.roles) ? record.roles.map(String).join(" ") : "";
  const raw = `${rawRoles} ${asString(record.role)} ${asString(trust?.metadata?.role)} ${trust?.marketing_segment || ""}`.toLowerCase();
  if (raw.includes("admin")) return "Admin";
  if (raw.includes("talent") || raw.includes("freelancer")) return "Talent";
  if (raw.includes("seller") || raw.includes("supplier") || raw.includes("merchant")) return "Seller";
  return "Buyer";
}

function kycFromTrust(record: UnknownRecord, trust?: SuperAppTrustProfile): CrmUserRow["kyc"] {
  const raw = `${asString(record.kyc_status)} ${trust?.kyc_status || ""} ${trust?.crm_approval_status || ""}`.toLowerCase();
  if (raw.includes("rejected") || raw.includes("restricted")) return "Rejected";
  if (raw.includes("full") || raw.includes("enhanced") || raw.includes("approved")) return "Verified";
  return "Pending";
}

function riskFromScore(score: number): CrmUserRow["risk"] {
  if (score >= 70) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function trustRiskScore(trust?: SuperAppTrustProfile): number {
  return (trust?.risk_strike_count || 0) * 32 + (trust?.manual_hold ? 35 : 0);
}

function mergeTrustIntoUser(user: CrmUserRow, trust: SuperAppTrustProfile): CrmUserRow {
  const score = trustRiskScore(trust);
  return {
    ...user,
    kyc: kycFromTrust({}, trust),
    approvalStatus: trust.crm_approval_status,
    manualHold: trust.manual_hold,
    riskStrikes: trust.risk_strike_count,
    risk: riskFromScore(score),
    lastActive: trust.updated_at || user.lastActive,
  };
}

function normalizeUsers(
  rawUsers: UnknownRecord[],
  trusts: SuperAppTrustProfile[],
  orders: SuperAppOrder[],
  leads: CrmLead[],
): CrmUserRow[] {
  const trustMap = new Map(trusts.map(item => [item.user_id, item]));
  const rawMap = new Map<string, UnknownRecord>();

  for (const raw of rawUsers) {
    const id = asString(raw.id || raw.user_id);
    if (id) rawMap.set(id, raw);
  }
  for (const trust of trusts) {
    if (!rawMap.has(trust.user_id)) rawMap.set(trust.user_id, { id: trust.user_id });
  }
  for (const lead of leads) {
    const id = lead.requester_user_id || lead.contact_user_id;
    if (id && !rawMap.has(id)) {
      rawMap.set(id, {
        id,
        full_name: lead.requester_name || lead.name,
        email: lead.requester_email,
      });
    }
  }
  for (const order of orders) {
    [order.requester_id, order.partner_id, order.merchant_id, order.provider_id]
      .filter(Boolean)
      .forEach(id => {
        if (id && !rawMap.has(id)) rawMap.set(id, { id });
      });
  }

  return Array.from(rawMap.entries()).map(([id, raw]) => {
    const trust = trustMap.get(id);
    const relatedOrders = orders.filter(order =>
      [order.requester_id, order.partner_id, order.merchant_id, order.provider_id].includes(id),
    );
    const gmvCents = relatedOrders.reduce(
      (sum, order) => sum + (order.amount_final_cents || order.amount_estimate_cents || 0),
      0,
    );
    const riskScore =
      asNumber(raw.risk_score) ||
      Math.max(...relatedOrders.map(order => order.risk_score || 0), 0) ||
      trustRiskScore(trust);
    const name =
      asString(raw.full_name) ||
      asString(raw.fullName) ||
      asString(raw.username) ||
      asString(raw.email) ||
      compactId(id);
    const city =
      asString(raw.location) ||
      asString(raw.city) ||
      asString(trust?.metadata?.city) ||
      "Indonesia";

    return {
      id,
      name,
      handle: asString(raw.username) ? `@${asString(raw.username)}` : compactId(id),
      role: roleFromRecord(raw, trust),
      kyc: kycFromTrust(raw, trust),
      approvalStatus: trust?.crm_approval_status || "pending",
      manualHold: Boolean(trust?.manual_hold),
      riskStrikes: trust?.risk_strike_count || 0,
      transactions: relatedOrders.length,
      gmvCents,
      lastActive:
        asString(raw.last_active_at) ||
        asString(raw.updated_at) ||
        trust?.updated_at ||
        relatedOrders[0]?.updated_at ||
        "",
      risk: riskFromScore(riskScore),
      city,
    };
  });
}

function normalizeListings(items: CrmContentItem[]): CrmListingRow[] {
  return items.map(item => {
    const metadata = asRecord(item.metadata);
    const imageUrls = Array.isArray(item.image_urls)
      ? item.image_urls
      : Array.isArray(item.listing_images)
        ? item.listing_images
        : [];
    const rawStatus = asString(item.content_status || item.status || "pending");
    const priceCents =
      asNumber(item.price_cents) ||
      (asNumber(item.price) > 0 && asNumber(item.price) < 1_000_000
        ? asNumber(item.price) * 100
        : asNumber(item.price));

    return {
      id: item.id,
      title: asString(item.title) || "Listing tanpa judul",
      category:
        asString(item.category) ||
        asString(item.content_type || item.type) ||
        "Listing",
      priceCents,
      currency: asString(item.currency) || "IDR",
      location:
        asString(metadata.city) ||
        asString(metadata.location) ||
        asString(metadata.region) ||
        "Indonesia",
      status: listingStatus(rawStatus),
      rawStatus,
      image: asString(item.cover_image) || asString(imageUrls[0]),
      ownerId: asString(item.owner_id),
      featured: asBoolean(metadata.featured),
      updatedAt: asString(item.updated_at || item.created_at),
      metadata,
      reportCount: 0,
      reporters: [],
      reportReasons: [],
      reportTicketIds: [],
      moderationStatus: asString(asRecord(metadata.moderation).status) || "normal",
    };
  });
}

function ticketRecord(ticket: SupportTicket): UnknownRecord {
  return ticket as unknown as UnknownRecord;
}

function reportTargetId(ticket: SupportTicket): string {
  const record = ticketRecord(ticket);
  const metadata = asRecord(record.metadata);
  return (
    asString(record.content_id) ||
    asString(record.listing_id) ||
    asString(record.target_listing_id) ||
    asString(metadata.content_id) ||
    asString(metadata.listing_id) ||
    asString(metadata.target_listing_id)
  );
}

function isListingReportTicket(ticket: SupportTicket): boolean {
  const text = `${ticket.category} ${ticket.source} ${ticket.subject} ${ticket.latest_message || ""}`.toLowerCase();
  return [
    "report",
    "lapor",
    "penipuan",
    "scam",
    "fraud",
    "listing",
    "content",
    "moderation",
    "spam",
    "palsu",
  ].some(token => text.includes(token));
}

function ticketMatchesListing(ticket: SupportTicket, listing: CrmListingRow): boolean {
  const targetId = reportTargetId(ticket);
  if (targetId && (targetId === listing.id || targetId === listing.ownerId)) return true;
  const haystack = `${ticket.subject} ${ticket.latest_message || ""}`.toLowerCase();
  const title = listing.title.toLowerCase();
  return title.length > 12 && haystack.includes(title.slice(0, 32));
}

function attachListingReports(
  listings: CrmListingRow[],
  tickets: SupportTicket[],
): CrmListingRow[] {
  const reportTickets = tickets.filter(isListingReportTicket);
  return listings.map(listing => {
    const matched = reportTickets.filter(ticket => ticketMatchesListing(ticket, listing));
    const reporters = Array.from(
      new Set(
        matched.map(ticket => ticket.requester_name || ticket.requester_email).filter(Boolean),
      ),
    );
    const reportReasons = Array.from(
      new Set(
        matched
          .map(ticket => ticket.latest_message || ticket.subject)
          .filter(Boolean)
          .slice(0, 6),
      ),
    );
    const moderationStatus =
      asString(asRecord(listing.metadata.moderation).status) ||
      (matched.length >= 3 ? "perlu_tinjau" : matched.length > 0 ? "ada_laporan" : "normal");
    return {
      ...listing,
      reportCount: matched.length,
      reporters,
      reportReasons,
      reportTicketIds: matched.map(ticket => ticket.id),
      moderationStatus,
    };
  });
}

function normalizeTransactions(orders: SuperAppOrder[]): CrmTransactionRow[] {
  return orders.map(order => ({
    id: order.id,
    buyer: compactId(order.requester_id),
    seller: compactId(order.partner_id || order.provider_id || order.merchant_id || ""),
    amountCents: order.amount_final_cents || order.amount_estimate_cents || 0,
    status: order.status,
    serviceType: order.service_type || "marketplace",
    riskScore: order.risk_score || 0,
    updatedAt: order.updated_at || order.created_at,
  }));
}

function normalizeChats(tickets: SupportTicket[], leads: CrmLead[]): CrmChatRow[] {
  const fromTickets = tickets.map(ticket => ({
    id: ticket.support_room_id || ticket.id,
    name: ticket.requester_name || ticket.requester_email || "User Lajukan",
    lastMessage: ticket.latest_message || ticket.subject,
    stage:
      ticket.priority === "urgent" || ticket.priority === "high"
        ? ("Hot" as const)
        : ticket.status === "open"
          ? ("Warm" as const)
          : ("Cold" as const),
    source: ticket.category || ticket.source || "support",
    listingTitle: ticket.subject,
    updatedAt: ticket.latest_message_at || ticket.updated_at,
    unread: ticket.status === "open" ? 1 : 0,
  }));
  const ticketRooms = new Set(fromTickets.map(chat => chat.id));
  const fromLeads = leads
    .filter(lead => lead.chat_room_id && !ticketRooms.has(lead.chat_room_id))
    .map(lead => ({
      id: lead.chat_room_id || lead.id,
      name: lead.requester_name || lead.name,
      lastMessage: "",
      stage:
        stageGroup(lead.stage) === "negotiation" || stageGroup(lead.stage) === "locked"
          ? ("Hot" as const)
          : ("Warm" as const),
      source: lead.source || "chat",
      listingTitle: asString(lead.metadata?.listing_title) || lead.name,
      updatedAt: lead.updated_at,
      unread: 0,
    }));
  return [...fromTickets, ...fromLeads].sort(
    (left, right) => new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime(),
  );
}

function normalizeActivities(
  activities: CrmActivity[],
  listings: CrmListingRow[],
  orders: SuperAppOrder[],
  tickets: SupportTicket[],
): CrmActivityRow[] {
  const fromApi = activities.map(activity => {
    const action = activity.action.toLowerCase();
    const type: CrmActivityRow["type"] = action.includes("dispute")
      ? "dispute"
      : action.includes("chat")
        ? "chat"
        : action.includes("order") || action.includes("escrow")
          ? "transaction"
          : action.includes("listing")
            ? "listing"
            : action.includes("done") || action.includes("completed")
              ? "done"
              : "user";
    return {
      id: activity.id,
      title: activityLabel(activity.action),
      body: activity.message,
      type,
      at: activity.created_at,
    };
  });
  const derived = [
    ...listings.slice(0, 3).map(item => ({
      id: `listing:${item.id}`,
      title: "Listing baru",
      body: `${item.title} diperbarui oleh seller.`,
      type: "listing" as const,
      at: item.updatedAt,
    })),
    ...orders.slice(0, 3).map(item => ({
      id: `order:${item.id}`,
      title: item.status === "disputed" ? "Dispute dibuka" : "Transaksi baru",
      body: `${statusLabel(item.status)} senilai ${formatCurrency(
        item.amount_final_cents || item.amount_estimate_cents,
        item.currency,
      )}.`,
      type: item.status === "disputed" ? ("dispute" as const) : ("transaction" as const),
      at: item.updated_at,
    })),
    ...tickets.slice(0, 2).map(item => ({
      id: `ticket:${item.id}`,
      title: "Chat dimulai",
      body: item.latest_message || item.subject,
      type: "chat" as const,
      at: item.latest_message_at || item.updated_at,
    })),
  ];
  return [...fromApi, ...derived]
    .filter(item => item.at)
    .sort((left, right) => new Date(right.at).getTime() - new Date(left.at).getTime())
    .slice(0, 12);
}

function activityLabel(action: string): string {
  const clean = action.toLowerCase();
  if (clean.includes("register")) return "User Baru";
  if (clean.includes("listing")) return "Listing Baru";
  if (clean.includes("chat")) return "Chat Dimulai";
  if (clean.includes("escrow")) return "Masuk Escrow";
  if (clean.includes("dispute")) return "Dispute Dibuka";
  if (clean.includes("completed")) return "Transaksi Selesai";
  return "Aktivitas Baru";
}

function buildInitialData(): DashboardData {
  return createEmptyDashboardData();
}

function resolveMediaUrl(src: string, wwwUrl: string): string {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  const base = wwwUrl.replace(/\/$/, "");
  return `${base}${src.startsWith("/") ? src : `/${src}`}`;
}

function iconPaths(name: IconName): string[] {
  switch (name) {
    case "analytics":
      return ["M4 19V5", "M4 19h16", "M8 15l3-4 3 2 5-7"];
    case "bell":
      return ["M18 16v-5a6 6 0 0 0-12 0v5l-2 2h16l-2-2", "M10 20h4"];
    case "chat":
      return ["M5 6h14v9H8l-3 3V6Z", "M8 9h8", "M8 12h5"];
    case "chevron":
      return ["M9 6l6 6-6 6"];
    case "dashboard":
      return ["M4 5h7v7H4V5Z", "M13 5h7v4h-7V5Z", "M13 11h7v8h-7v-8Z", "M4 14h7v5H4v-5Z"];
    case "disputes":
      return ["M12 3l8 4v5c0 5-3.4 8-8 9-4.6-1-8-4-8-9V7l8-4Z", "M12 8v5", "M12 17h.01"];
    case "listings":
      return ["M5 4h14v16H5V4Z", "M8 8h8", "M8 12h8", "M8 16h5"];
    case "logout":
      return ["M10 5H5v14h5", "M14 8l4 4-4 4", "M8 12h10"];
    case "menu":
      return ["M4 7h16", "M4 12h16", "M4 17h16"];
    case "pipeline":
      return ["M5 6h4v4H5V6Z", "M15 14h4v4h-4v-4Z", "M9 8h3a4 4 0 0 1 4 4v2"];
    case "search":
      return ["M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14Z", "M16.5 16.5 21 21"];
    case "settings":
      return ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M19 12a7 7 0 0 0-.1-1l2-1.5-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 3h-5l-.3 3.1a7 7 0 0 0-1.7 1l-2.4-1-2 3.4 2 1.5A7 7 0 0 0 5 12c0 .3 0 .7.1 1l-2 1.5 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 3.1h5l.3-3.1a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.5c.1-.3.1-.7.1-1Z"];
    case "transactions":
      return ["M5 7h14v10H5V7Z", "M8 11h4", "M16 13h.01", "M8 15h8"];
    case "users":
      return ["M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z", "M3 20a6 6 0 0 1 12 0", "M17 11a2.5 2.5 0 1 0 0-5", "M16 15a5 5 0 0 1 5 5"];
  }
}

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {iconPaths(name).map(path => (
        <path key={path} d={path} />
      ))}
    </svg>
  );
}

function Badge({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "success" | "warning" | "danger" | "neutral" | "blue";
}) {
  const classes = {
    success: "border-emerald-200 bg-emerald-50 text-emerald-700",
    warning: "border-amber-200 bg-amber-50 text-amber-700",
    danger: "border-rose-200 bg-rose-50 text-rose-700",
    neutral: "border-slate-200 bg-slate-50 text-slate-600",
    blue: "border-sky-200 bg-sky-50 text-sky-700",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${classes[tone]}`}
    >
      {children}
    </span>
  );
}

function ShellCard({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <section className={`rounded-2xl border border-slate-200 bg-white shadow-[0_12px_34px_-28px_rgba(15,23,42,0.55)] ${className}`}>
      {children}
    </section>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center">
      <p className="text-sm font-bold text-slate-900">{title}</p>
      <p className="mt-1 text-sm text-slate-500">{body}</p>
    </div>
  );
}

export default function CrmCommandCenter() {
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const { accessToken, logout, user } = useAuth();
  const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";
  const [activePage, setActivePage] = useState<PageId>("dashboard");
  const [collapsed, setCollapsed] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [notice, setNotice] = useState("");
  const [data, setData] = useState<DashboardData>(() => buildInitialData());

  const loadData = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    const failures: string[] = [];
    const [leadRes, activityRes, ticketRes, orderRes, trustRes, contentRes, userRes] =
      await Promise.allSettled([
        leadApi.list(accessToken, { limit: "120" }),
        activityApi.list(accessToken, { limit: "60" }),
        supportApi.list(accessToken, { limit: "120" }),
        superAppApi.listOrders(accessToken, { limit: "120" }),
        superAppApi.listTrustProfiles(accessToken, { limit: "120" }),
        contentApi.list(accessToken, { limit: "160", offset: "0" }),
        usersApi.list(accessToken),
      ]);

    const liveLeads = settledItems<CrmLead>(leadRes, "leads", failures);
    const liveActivities = settledItems<CrmActivity>(activityRes, "activities", failures);
    const liveTickets = settledItems<SupportTicket>(ticketRes, "tickets", failures);
    const liveOrders = settledItems<SuperAppOrder>(orderRes, "orders", failures);
    const liveTrust = settledItems<SuperAppTrustProfile>(trustRes, "trustProfiles", failures);
    const liveContent = settledItems<CrmContentItem>(contentRes, "listings", failures);
    const liveUsers =
      userRes.status === "fulfilled"
        ? readItems<UnknownRecord>(userRes.value)
        : (failures.push("users"), []);

    const leads = liveLeads;
    const activitiesSource = liveActivities;
    const tickets = liveTickets;
    const orders = liveOrders;
    const trustProfiles = liveTrust;
    const normalizedListings = normalizeListings(liveContent);
    const users = normalizeUsers(liveUsers, trustProfiles, orders, leads);
    const safeUsers = users;
    const chats = normalizeChats(tickets, leads);
    const listings = attachListingReports(normalizedListings, tickets);
    const activities = normalizeActivities(activitiesSource, listings, orders, tickets);
    const emptyCollections = [
      !liveLeads.length ? "leads" : "",
      !liveActivities.length ? "activities" : "",
      !liveTickets.length ? "tickets" : "",
      !liveOrders.length ? "orders" : "",
      !liveTrust.length ? "trustProfiles" : "",
      !liveContent.length ? "listings" : "",
      !liveUsers.length ? "users" : "",
    ].filter(Boolean);
    const sampleCollections: string[] = [];

    setData({
      leads,
      activities,
      tickets,
      orders,
      trustProfiles,
      users: safeUsers,
      listings,
      chats,
      sampleCollections,
      emptyCollections,
      failures,
    });
    setLoading(false);
    setRefreshing(false);
  }, [accessToken]);

  useEffect(() => {
    if (!accessToken) return;
    const timeout = window.setTimeout(() => {
      void loadData();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [accessToken, loadData]);

  const handleRefresh = useCallback(() => {
    setNotice("");
    void loadData();
  }, [loadData]);

  const handleListingStatus = useCallback(
    async (listing: CrmListingRow, nextStatus: "active" | "paused") => {
      if (!accessToken) return;
      setNotice("");
      try {
        await contentApi.update(accessToken, listing.id, {
          content_status: nextStatus,
        });
        setData(current => ({
          ...current,
          listings: current.listings.map(item =>
            item.id === listing.id
              ? {
                ...item,
                rawStatus: nextStatus,
                status: listingStatus(nextStatus),
              }
              : item,
          ),
        }));
        setNotice(
          nextStatus === "active"
            ? "Listing berhasil diaktifkan."
            : "Listing ditandai perlu revisi.",
        );
      } catch {
        setNotice(
          "Endpoint admin CMS belum tersedia untuk akun ini. Tombol sudah siap, tapi backend perlu admin moderation endpoint.",
        );
      }
    },
    [accessToken],
  );

  const handleListingModeration = useCallback(
    async (
      listing: CrmListingRow,
      action: "restore" | "review" | "hide" | "ban",
    ) => {
      if (!accessToken) return;
      setNotice("");

      const nextStatus =
        action === "restore" ? "active" : action === "ban" ? "archived" : "paused";
      const actionLabel = {
        restore: "dipulihkan",
        review: "ditandai perlu tinjau",
        hide: "disembunyikan",
        ban: "diarsipkan karena pelanggaran",
      }[action];
      const moderation = {
        ...asRecord(listing.metadata.moderation),
        status: action === "restore" ? "normal" : action,
        last_action: action,
        last_reason:
          listing.reportReasons[0] ||
          "Keputusan admin berdasarkan laporan dan review manual.",
        report_count: listing.reportCount,
        updated_at: new Date().toISOString(),
      };

      try {
        await contentApi.update(accessToken, listing.id, {
          content_status: nextStatus,
          metadata: {
            ...listing.metadata,
            moderation,
          },
        });
        setData(current => ({
          ...current,
          listings: current.listings.map(item =>
            item.id === listing.id
              ? {
                ...item,
                rawStatus: nextStatus,
                status: listingStatus(nextStatus),
                metadata: {
                  ...item.metadata,
                  moderation,
                },
                moderationStatus: moderation.status,
              }
              : item,
          ),
        }));
        setNotice(`Listing ${listing.title} berhasil ${actionLabel}.`);
      } catch {
        setNotice(
          "Action moderasi listing gagal. Pastikan akun admin punya role content_admin/super_admin dan marketplace service aktif.",
        );
      }
    },
    [accessToken],
  );

  const handleUserTrustAction = useCallback(
    async (
      targetUser: CrmUserRow,
      action: "approve" | "reject" | "warn" | "hold" | "release",
    ) => {
      if (!accessToken) return;
      setNotice("");

      const now = new Date().toISOString();
      const nextStrike =
        action === "warn" || action === "hold" || action === "reject"
          ? targetUser.riskStrikes + 1
          : targetUser.riskStrikes;
      const payloadByAction: Record<
        "approve" | "reject" | "warn" | "hold" | "release",
        TrustProfileUpdatePayload
      > = {
        approve: {
          kyc_status: "full",
          crm_approval_status: "approved",
          manual_hold: false,
          metadata: {
            last_admin_action: "approved",
            last_admin_note: "User lolos review CRM.",
            last_admin_action_at: now,
          },
        },
        reject: {
          kyc_status: "none",
          crm_approval_status: "rejected",
          manual_hold: true,
          risk_strike_count: nextStrike,
          metadata: {
            last_admin_action: "kyc_rejected",
            admin_alert: "Akun perlu memperbaiki data sebelum aktivitas dilanjutkan.",
            last_admin_action_at: now,
          },
        },
        warn: {
          crm_approval_status: targetUser.manualHold ? "restricted" : "pending",
          risk_strike_count: nextStrike,
          metadata: {
            last_admin_action: "warning_sent",
            admin_alert: "Ada laporan terhadap aktivitas akun. Harap perbaiki perilaku/listing.",
            last_admin_action_at: now,
          },
        },
        hold: {
          crm_approval_status: "restricted",
          manual_hold: true,
          risk_strike_count: nextStrike,
          metadata: {
            last_admin_action: "manual_hold",
            admin_alert: "Akun sedang ditinjau admin karena laporan atau risiko.",
            last_admin_action_at: now,
          },
        },
        release: {
          crm_approval_status: "approved",
          manual_hold: false,
          metadata: {
            last_admin_action: "manual_hold_released",
            last_admin_note: "Hold manual dicabut setelah review.",
            last_admin_action_at: now,
          },
        },
      };
      const payload = payloadByAction[action];

      try {
        const response = await superAppApi.upsertTrustProfile(
          accessToken,
          targetUser.id,
          payload,
        );
        const profile = response.profile;
        setData(current => ({
          ...current,
          trustProfiles: [
            profile,
            ...current.trustProfiles.filter(item => item.user_id !== profile.user_id),
          ],
          users: current.users.map(item =>
            item.id === targetUser.id ? mergeTrustIntoUser(item, profile) : item,
          ),
        }));
        setNotice(`Trust profile ${targetUser.name} berhasil diperbarui.`);
      } catch {
        setNotice(
          "Action trust user gagal. Pastikan akun admin punya akses agent/super_admin dan marketplace service aktif.",
        );
      }
    },
    [accessToken],
  );

  const transactions = useMemo(() => normalizeTransactions(data.orders), [data.orders]);
  const operationPriorities = useMemo(() => buildOperationsPriorities({ leads: data.leads, tickets: data.tickets, orders: data.orders, chats: data.chats, users: data.users, listings: data.listings }), [data]);

  const filteredData = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data;
    return {
      ...data,
      users: data.users.filter(item =>
        `${item.name} ${item.handle} ${item.role} ${item.city}`.toLowerCase().includes(needle),
      ),
      listings: data.listings.filter(item =>
        `${item.title} ${item.category} ${item.location} ${item.rawStatus}`.toLowerCase().includes(needle),
      ),
      chats: data.chats.filter(item =>
        `${item.name} ${item.lastMessage} ${item.listingTitle}`.toLowerCase().includes(needle),
      ),
    };
  }, [data, query]);

  const openIssues = data.tickets.filter(ticket =>
    ["open", "in_progress", "pending_customer"].includes(ticket.status),
  ).length;
  const highRiskOrders = data.orders.filter(order => order.risk_score >= 70 || order.status === "disputed").length;

  if (authLoading || loading) {
    return (
      <div className="flex h-[100dvh] items-center justify-center bg-[#F9FAFB] text-sm font-semibold text-slate-600">
        Memuat dashboard CRM...
      </div>
    );
  }

  if (!isAuthenticated) return null;

  return (
    <div className="dashboard-shell bg-[#F9FAFB] text-slate-950">
      <div className="flex h-full min-h-0">
        <Sidebar
          activePage={activePage}
          collapsed={collapsed}
          mobileOpen={mobileNavOpen}
          onCloseMobile={() => setMobileNavOpen(false)}
          onSelect={page => {
            setActivePage(page);
            setMobileNavOpen(false);
          }}
          onToggle={() => setCollapsed(current => !current)}
        />

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <TopBar
            activePage={activePage}
            query={query}
            userLabel={user?.username || user?.email || "Admin"}
            refreshing={refreshing}
            notificationCount={openIssues + highRiskOrders}
            profileOpen={profileOpen}
            onQueryChange={setQuery}
            onRefresh={handleRefresh}
            onOpenMobile={() => setMobileNavOpen(true)}
            onToggleProfile={() => setProfileOpen(current => !current)}
            onLogout={() => void logout()}
          />

          <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-[1540px] space-y-5">
              {data.emptyCollections.length ? (
                <div className="rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-800">
                  Data real kosong untuk: {data.emptyCollections.join(", ")}. CRM tidak mengisi data palsu otomatis.
                </div>
              ) : null}
              {data.failures.length && !data.sampleCollections.length ? (
                <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-800">
                  Service gagal dibaca: {data.failures.join(", ")}. Cek token admin atau endpoint API.
                </div>
              ) : null}
              {notice ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
                  {notice}
                </div>
              ) : null}

              {activePage === "dashboard" ? (
                <OperationsPriorityPanel items={operationPriorities} onOpen={destination => setActivePage(destination)} />
              ) : null}

              {activePage === "dashboard" ? <OperationsOverview data={filteredData} /> : null}
              {activePage === "pipeline" ? <PipelineWorkspace leads={filteredData.leads} /> : null}
              {activePage === "users" ? (
                <ContactWorkspace users={filteredData.users} listings={filteredData.listings} orders={data.orders} tickets={data.tickets} trustProfiles={data.trustProfiles} onTrustAction={handleUserTrustAction} />
              ) : null}
              {activePage === "listings" ? (
                <ListingsPage
                  listings={filteredData.listings}
                  wwwUrl={wwwUrl}
                  onStatusChange={handleListingStatus}
                  onModerationAction={handleListingModeration}
                />
              ) : null}
              {activePage === "transactions" ? <TransactionWorkspace transactions={transactions} /> : null}
              {activePage === "chat" ? <ConversationWorkspace chats={filteredData.chats} /> : null}
              {activePage === "analytics" ? <AnalyticsWorkspace users={filteredData.users} listings={filteredData.listings} transactions={transactions} openSupport={openIssues} /> : null}
              {activePage === "disputes" ? <SupportRiskWorkspace tickets={data.tickets} transactions={transactions} users={data.users} supportFailed={data.failures.includes("support") || data.failures.includes("tickets")} /> : null}
              {activePage === "settings" ? <AdministrationWorkspace /> : null}
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

function Sidebar({
  activePage,
  collapsed,
  mobileOpen,
  onCloseMobile,
  onSelect,
  onToggle,
}: {
  activePage: PageId;
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onSelect: (page: PageId) => void;
  onToggle: () => void;
}) {
  return (
    <>
      <button
        type="button"
        aria-label="Tutup menu"
        onClick={onCloseMobile}
        className={`fixed inset-0 z-40 bg-slate-950/30  transition lg:hidden ${mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
          }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] border-r border-slate-200 bg-white transition-all duration-300 lg:static lg:inset-auto lg:z-auto lg:h-full lg:shrink-0 ${collapsed ? "w-[88px]" : "w-[280px]"
          } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-full min-h-0 w-full flex-col p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#6cd698] text-lg font-bold text-white shadow-[0_16px_26px_-18px_rgba(22,163,74,0.8)]">
              L
            </span>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="text-base font-bold tracking-[-0.04em] text-slate-950">Lajukan CRM</p>
                <p className="text-xs font-semibold text-slate-500">Admin marketplace</p>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            onClick={onToggle}
            className="mt-5 hidden min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 text-sm font-bold text-slate-600 transition hover:bg-slate-100 lg:flex"
          >
            <Icon name="menu" className="h-4 w-4" />
            {!collapsed ? "Ringkas sidebar" : null}
          </button>

          <nav className="mt-6 min-h-0 flex-1 space-y-1 overflow-y-auto pr-1">
            {CRM_NAV_ITEMS.map(item => {
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left transition ${active
                    ? "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100"
                    : "text-slate-600 hover:bg-slate-50 hover:text-slate-950"
                    } ${collapsed ? "justify-center" : ""}`}
                  title={item.label}
                >
                  <Icon name={item.icon} className="h-5 w-5 shrink-0" />
                  {!collapsed ? (
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-bold">{item.label}</span>
                      <span className="block truncate text-[11px] font-medium text-slate-400">{item.hint}</span>
                    </span>
                  ) : null}
                </button>
              );
            })}
          </nav>

          <div className="mt-4 shrink-0 rounded-2xl border border-slate-200 bg-slate-50 p-3">
            {!collapsed ? (
              <>
                <p className="text-xs font-bold text-slate-900">Mode CRM v1</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Fokus transaksi, chat, listing, dan moderasi.
                </p>
              </>
            ) : (
              <Badge tone="success">v1</Badge>
            )}
          </div>
        </div>
      </aside>
    </>
  );
}

function TopBar({
  activePage,
  query,
  userLabel,
  refreshing,
  notificationCount,
  profileOpen,
  onQueryChange,
  onRefresh,
  onOpenMobile,
  onToggleProfile,
  onLogout,
}: {
  activePage: PageId;
  query: string;
  userLabel: string;
  refreshing: boolean;
  notificationCount: number;
  profileOpen: boolean;
  onQueryChange: (value: string) => void;
  onRefresh: () => void;
  onOpenMobile: () => void;
  onToggleProfile: () => void;
  onLogout: () => void;
}) {
  const page = CRM_NAV_ITEMS.find(item => item.id === activePage) || CRM_NAV_ITEMS[0];
  return (
    <header className="z-30 shrink-0 border-b border-slate-200 bg-white/90 ">
      <div className="mx-auto flex h-16 max-w-[1540px] items-center gap-3 px-1 sm:px-3 md:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobile}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
          aria-label="Buka menu"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <div className="hidden min-w-[150px] sm:block">
          <p className="text-sm font-bold text-slate-950">{page.label}</p>
          <p className="text-xs font-semibold text-slate-500">{page.hint}</p>
        </div>
        <label className="flex min-h-11 min-w-0 flex-1 items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 text-slate-500 focus-within:border-emerald-300 focus-within:bg-white focus-within:ring-4 focus-within:ring-emerald-100">
          <Icon name="search" className="h-4 w-4 shrink-0" />
          <input
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="Cari user, listing, transaksi..."
            className="min-w-0 flex-1 bg-transparent text-sm font-semibold text-slate-900 outline-none placeholder:text-slate-400"
          />
        </label>
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="hidden min-h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60 sm:inline-flex sm:items-center"
        >
          {refreshing ? "Memuat..." : "Refresh"}
        </button>
        <button
          type="button"
          className="relative inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-700"
          aria-label="Notifikasi"
        >
          <Icon name="bell" className="h-5 w-5" />
          {notificationCount ? (
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-bold text-white">
              {notificationCount}
            </span>
          ) : null}
        </button>
        <div className="relative">
          <button
            type="button"
            onClick={onToggleProfile}
            className="flex min-h-11 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-2.5 text-left"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-xs font-bold text-white">
              {userLabel.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[130px] truncate text-sm font-bold text-slate-800 md:block">
              {userLabel}
            </span>
          </button>
          {profileOpen ? (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-bold text-slate-900">{userLabel}</p>
                <p className="text-xs text-slate-500">Admin internal</p>
              </div>
              <button
                type="button"
                onClick={onLogout}
                className="mt-2 flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-sm font-bold text-rose-600 transition hover:bg-rose-50"
              >
                <Icon name="logout" className="h-4 w-4" />
                Keluar
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

function ListingsPage({
  listings,
  wwwUrl,
  onStatusChange,
  onModerationAction,
}: {
  listings: CrmListingRow[];
  wwwUrl: string;
  onStatusChange: (listing: CrmListingRow, status: "active" | "paused") => void;
  onModerationAction: (
    listing: CrmListingRow,
    action: "restore" | "review" | "hide" | "ban",
  ) => void;
}) {
  const [status, setStatus] = useState("all");
  const [reportFilter, setReportFilter] = useState("all");
  const [selectedListing, setSelectedListing] = useState<CrmListingRow | null>(null);
  const filtered = listings.filter(item => {
    const statusOk =
      status === "all" ||
      item.status === status ||
      item.rawStatus.toLowerCase() === status;
    const reportOk =
      reportFilter === "all" ||
      (reportFilter === "reported" && item.reportCount > 0) ||
      (reportFilter === "high" && item.reportCount >= 3);
    return statusOk && reportOk;
  });
  return (
    <div className="space-y-5">
      <PageHeader
        label="Moderasi Listing"
        title="Tinjau laporan, listing nakal, dan tindakan ke pemilik."
        body="Bukan CMS biasa. Halaman ini fokus report user, status listing, dan action trust agar marketplace tetap aman."
      />
      <FilterBar
        filters={[
          { label: "Status", value: status, onChange: setStatus, options: ["all", "active", "pending", "draft", "paused", "archived", "rejected"] },
          { label: "Laporan", value: reportFilter, onChange: setReportFilter, options: ["all", "reported", "high"] },
        ]}
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {filtered.slice(0, 8).map(listing => (
          <ShellCard key={listing.id} className="overflow-hidden">
            <div
              className="h-36 bg-gradient-to-br from-slate-100 to-slate-200 bg-cover bg-center"
              style={
                listing.image
                  ? { backgroundImage: `url("${resolveMediaUrl(listing.image, wwwUrl)}")` }
                  : undefined
              }
            >
              {!listing.image ? (
                <div className="flex h-full items-center justify-center text-xs font-bold text-slate-400">
                  Preview listing
                </div>
              ) : null}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-bold text-slate-950">{listing.title}</p>
                <Badge tone={toneForStatus(listing.rawStatus)}>{statusLabel(listing.rawStatus)}</Badge>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Badge tone={listing.reportCount >= 3 ? "danger" : listing.reportCount > 0 ? "warning" : "success"}>
                  {listing.reportCount ? `${listing.reportCount} laporan` : "Belum dilaporkan"}
                </Badge>
                <Badge tone={listing.moderationStatus === "normal" ? "neutral" : "warning"}>
                  {listing.moderationStatus.replaceAll("_", " ")}
                </Badge>
              </div>
              <p className="mt-2 text-xs font-semibold text-slate-500">
                {listing.category} - {listing.location}
              </p>
              <p className="mt-3 text-lg font-bold text-emerald-700">
                {listing.priceCents ? formatCurrency(listing.priceCents, listing.currency) : "Harga tanya admin"}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedListing(listing)}
                  className="rounded-xl bg-[#6cd698] px-3 py-2 text-xs font-bold text-white"
                >
                  Detail report
                </button>
                <button
                  type="button"
                  onClick={() => onModerationAction(listing, "review")}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
                >
                  Tinjau
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onModerationAction(listing, "hide")}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600"
                >
                  Sembunyikan
                </button>
                <button
                  type="button"
                  onClick={() => onModerationAction(listing, "ban")}
                  className="rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-xs font-bold text-white"
                >
                  Ban listing
                </button>
              </div>
            </div>
          </ShellCard>
        ))}
      </div>
      {!filtered.length ? (
        <EmptyState title="Belum ada listing" body="Data listing atau laporan belum masuk dari API real." />
      ) : null}
      {selectedListing ? (
        <ShellCard className="p-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div className="min-w-0">
              <Badge tone={selectedListing.reportCount >= 3 ? "danger" : selectedListing.reportCount ? "warning" : "neutral"}>
                {selectedListing.reportCount ? `${selectedListing.reportCount} laporan masuk` : "Tidak ada laporan"}
              </Badge>
              <h2 className="mt-3 text-xl font-bold tracking-[-0.04em] text-slate-950">
                {selectedListing.title}
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Owner {compactId(selectedListing.ownerId)} - {selectedListing.category} - {selectedListing.location}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedListing(null)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"
            >
              Tutup detail
            </button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-950">Siapa yang report?</p>
              <div className="mt-3 grid gap-2">
                {selectedListing.reporters.length ? (
                  selectedListing.reporters.map(reporter => (
                    <InfoRow key={reporter} label="Reporter" value={reporter} />
                  ))
                ) : (
                  <EmptyState title="Belum ada reporter" body="Kalau laporan masuk lewat support ticket, nama/email reporter akan muncul di sini." />
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-950">Alasan laporan</p>
              <div className="mt-3 space-y-2">
                {selectedListing.reportReasons.length ? (
                  selectedListing.reportReasons.map(reason => (
                    <p key={reason} className="rounded-xl bg-white p-3 text-xs font-semibold leading-5 text-slate-600">
                      {reason}
                    </p>
                  ))
                ) : (
                  <p className="text-xs leading-5 text-slate-500">
                    Belum ada alasan laporan yang cocok dengan listing ini.
                  </p>
                )}
              </div>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => onStatusChange(selectedListing, "active")}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white"
            >
              Pulihkan aktif
            </button>
            <button
              type="button"
              onClick={() => onModerationAction(selectedListing, "review")}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-700"
            >
              Tandai perlu tinjau
            </button>
            <button
              type="button"
              onClick={() => onModerationAction(selectedListing, "hide")}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700"
            >
              Sembunyikan listing
            </button>
            <button
              type="button"
              onClick={() => onModerationAction(selectedListing, "ban")}
              className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-bold text-white"
            >
              Ban / arsipkan
            </button>
          </div>
        </ShellCard>
      ) : null}
      <ShellCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-bold uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Listing</th>
                <th className="px-4 py-3">Kategori</th>
                <th className="px-4 py-3">Harga</th>
                <th className="px-4 py-3">Lokasi</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Laporan</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(listing => (
                <tr key={`row-${listing.id}`} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4 font-bold text-slate-950">{listing.title}</td>
                  <td className="px-4 py-4 text-slate-600">{listing.category}</td>
                  <td className="px-4 py-4 font-bold text-slate-800">{listing.priceCents ? formatCurrency(listing.priceCents, listing.currency) : "-"}</td>
                  <td className="px-4 py-4 text-slate-600">{listing.location}</td>
                  <td className="px-4 py-4"><Badge tone={toneForStatus(listing.rawStatus)}>{statusLabel(listing.rawStatus)}</Badge></td>
                  <td className="px-4 py-4">
                    <Badge tone={listing.reportCount >= 3 ? "danger" : listing.reportCount ? "warning" : "neutral"}>
                      {listing.reportCount} report
                    </Badge>
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => setSelectedListing(listing)}
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-600"
                    >
                      Review
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </ShellCard>
    </div>
  );
}

function PageHeader({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <Badge tone="success">{label}</Badge>
      <h1 className="mt-3 text-2xl font-bold tracking-[-0.05em] text-slate-950 sm:text-3xl">{title}</h1>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">{body}</p>
    </section>
  );
}

function FilterBar({
  filters,
}: {
  filters: Array<{
    label: string;
    value: string;
    options: string[];
    onChange: (value: string) => void;
  }>;
}) {
  return (
    <ShellCard className="p-3">
      <div className="flex flex-wrap gap-2">
        {filters.map(filter => (
          <label key={filter.label} className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-600">
            {filter.label}
            <select
              value={filter.value}
              onChange={event => filter.onChange(event.target.value)}
              className="bg-transparent text-sm font-bold text-slate-900 outline-none"
            >
              {filter.options.map(option => (
                <option key={option} value={option}>
                  {option === "all" ? "Semua" : option === "risk" ? "Risiko saja" : option}
                </option>
              ))}
            </select>
          </label>
        ))}
      </div>
    </ShellCard>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-500">{label}</p>
      <p className="max-w-[60%] text-right text-xs font-bold text-slate-900">{value}</p>
    </div>
  );
}
