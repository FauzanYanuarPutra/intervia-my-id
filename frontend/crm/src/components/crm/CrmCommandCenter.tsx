"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
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

type PageId =
  | "dashboard"
  | "pipeline"
  | "users"
  | "listings"
  | "transactions"
  | "chat"
  | "analytics"
  | "disputes"
  | "settings";

type IconName =
  | "analytics"
  | "bell"
  | "chat"
  | "chevron"
  | "dashboard"
  | "disputes"
  | "listings"
  | "logout"
  | "menu"
  | "pipeline"
  | "search"
  | "settings"
  | "transactions"
  | "users";

type CrmKpi = {
  label: string;
  value: string;
  note: string;
  trend: string;
  tone: "green" | "blue" | "amber" | "rose";
};

type ChartPoint = {
  label: string;
  value: number;
};

type CrmUserRow = {
  id: string;
  name: string;
  handle: string;
  role: "Buyer" | "Seller" | "Talent" | "Admin";
  kyc: "Verified" | "Pending" | "Rejected";
  approvalStatus: string;
  manualHold: boolean;
  riskStrikes: number;
  transactions: number;
  gmvCents: number;
  lastActive: string;
  risk: "low" | "medium" | "high";
  city: string;
};

type CrmListingRow = {
  id: string;
  title: string;
  category: string;
  priceCents: number;
  currency: string;
  location: string;
  status: "active" | "pending" | "rejected" | "draft";
  rawStatus: string;
  image: string;
  ownerId: string;
  featured: boolean;
  updatedAt: string;
  metadata: UnknownRecord;
  reportCount: number;
  reporters: string[];
  reportReasons: string[];
  reportTicketIds: string[];
  moderationStatus: string;
};

type CrmTransactionRow = {
  id: string;
  buyer: string;
  seller: string;
  amountCents: number;
  status: string;
  serviceType: string;
  riskScore: number;
  updatedAt: string;
};

type CrmChatRow = {
  id: string;
  name: string;
  lastMessage: string;
  stage: "Hot" | "Warm" | "Cold";
  source: string;
  listingTitle: string;
  updatedAt: string;
  unread: number;
};

type CrmActivityRow = {
  id: string;
  title: string;
  body: string;
  type: "user" | "listing" | "chat" | "transaction" | "dispute" | "done";
  at: string;
};

type CrmInsight = {
  title: string;
  body: string;
  tone: "green" | "blue" | "amber";
};

type DashboardData = {
  leads: CrmLead[];
  activities: CrmActivityRow[];
  tickets: SupportTicket[];
  orders: SuperAppOrder[];
  trustProfiles: SuperAppTrustProfile[];
  users: CrmUserRow[];
  listings: CrmListingRow[];
  chats: CrmChatRow[];
  sampleCollections: string[];
  emptyCollections: string[];
  failures: string[];
};

type UnknownRecord = Record<string, unknown>;

const NAV_ITEMS: Array<{
  id: PageId;
  label: string;
  hint: string;
  icon: IconName;
}> = [
  {
    id: "dashboard",
    label: "Dashboard",
    hint: "Ringkasan bisnis",
    icon: "dashboard",
  },
  {
    id: "pipeline",
    label: "CRM Pipeline",
    hint: "Follow-up deal",
    icon: "pipeline",
  },
  { id: "users", label: "Users", hint: "Buyer, seller, talent", icon: "users" },
  {
    id: "listings",
    label: "Moderasi Listing",
    hint: "Report dan listing nakal",
    icon: "listings",
  },
  {
    id: "transactions",
    label: "Transactions",
    hint: "Escrow dan order",
    icon: "transactions",
  },
  { id: "chat", label: "Chat CRM", hint: "Inbox prospek", icon: "chat" },
  {
    id: "analytics",
    label: "Analytics",
    hint: "GMV dan konversi",
    icon: "analytics",
  },
  {
    id: "disputes",
    label: "Disputes",
    hint: "Kasus dan risiko",
    icon: "disputes",
  },
  {
    id: "settings",
    label: "Settings",
    hint: "Role dan moderasi",
    icon: "settings",
  },
];

const CRM_DEMO_DATA_ENABLED =
  process.env.NEXT_PUBLIC_CRM_ENABLE_DEMO_DATA === "true";

const SAMPLE_LEADS: CrmLead[] = [
  {
    id: "lead-sample-1",
    requester_user_id: "user-sample-1",
    requester_email: "dapur.kawan@example.com",
    requester_name: "Dapur Kawan Setiabudi",
    owner_id: null,
    contact_user_id: "seller-sample-1",
    content_id: "listing-sample-1",
    chat_room_id: "room-sample-1",
    name: "Dapur Kawan cari supplier kemasan",
    sector: "Makan & minum",
    stage: "lead",
    source: "listing",
    value_cents: 420000000,
    currency: "IDR",
    metadata: { listing_title: "Supplier kemasan food grade" },
    created_at: "2026-06-08T08:20:00.000Z",
    updated_at: "2026-06-10T03:40:00.000Z",
  },
  {
    id: "lead-sample-2",
    requester_user_id: "user-sample-2",
    requester_email: "gudangrasa@example.com",
    requester_name: "Gudang Rasa Bekasi",
    owner_id: "agent-sample",
    contact_user_id: "seller-sample-2",
    content_id: "listing-sample-2",
    chat_room_id: "room-sample-2",
    name: "Gudang Rasa minta reseller aktif",
    sector: "Supplier",
    stage: "negotiation",
    source: "chat",
    value_cents: 1850000000,
    currency: "IDR",
    metadata: { listing_title: "Distributor cemilan kemasan" },
    created_at: "2026-06-07T09:20:00.000Z",
    updated_at: "2026-06-10T05:45:00.000Z",
  },
  {
    id: "lead-sample-3",
    requester_user_id: "user-sample-3",
    requester_email: "panggung.live@example.com",
    requester_name: "Panggung Live Creator",
    owner_id: "agent-sample",
    contact_user_id: "seller-sample-3",
    content_id: "listing-sample-3",
    chat_room_id: null,
    name: "Brand snack cari live host",
    sector: "Talent",
    stage: "qualified",
    source: "manual",
    value_cents: 750000000,
    currency: "IDR",
    metadata: { listing_title: "Paket live host UMKM" },
    created_at: "2026-06-06T10:20:00.000Z",
    updated_at: "2026-06-09T12:10:00.000Z",
  },
  {
    id: "lead-sample-4",
    requester_user_id: "user-sample-4",
    requester_email: "selaras@example.com",
    requester_name: "Butik Selaras Gejayan",
    owner_id: "agent-sample",
    contact_user_id: "seller-sample-4",
    content_id: "listing-sample-4",
    chat_room_id: "room-sample-4",
    name: "Butik butuh admin marketplace",
    sector: "Jasa",
    stage: "contract",
    source: "support",
    value_cents: 1200000000,
    currency: "IDR",
    metadata: { listing_title: "Admin marketplace harian" },
    created_at: "2026-06-05T11:20:00.000Z",
    updated_at: "2026-06-10T01:05:00.000Z",
  },
  {
    id: "lead-sample-5",
    requester_user_id: "user-sample-5",
    requester_email: "kembangkulit@example.com",
    requester_name: "Kembang Kulit Print House",
    owner_id: "agent-sample",
    contact_user_id: "seller-sample-5",
    content_id: "listing-sample-5",
    chat_room_id: null,
    name: "Percetakan ulang order desain",
    sector: "Jasa",
    stage: "won",
    source: "transaction",
    value_cents: 2600000000,
    currency: "IDR",
    metadata: { listing_title: "Desain dan cetak kemasan" },
    created_at: "2026-06-04T07:30:00.000Z",
    updated_at: "2026-06-09T18:25:00.000Z",
  },
];

const SAMPLE_ACTIVITIES: CrmActivity[] = [
  {
    id: "activity-sample-1",
    lead_id: "lead-sample-2",
    actor_user_id: "user-sample-2",
    actor_role: "seller",
    action: "chat_started",
    message: "Chat baru dimulai dari listing distributor cemilan.",
    metadata: {},
    created_at: "2026-06-10T05:45:00.000Z",
  },
  {
    id: "activity-sample-2",
    lead_id: "lead-sample-4",
    actor_user_id: "user-sample-4",
    actor_role: "buyer",
    action: "escrow_locked",
    message: "Transaksi jasa admin marketplace masuk escrow.",
    metadata: {},
    created_at: "2026-06-10T04:15:00.000Z",
  },
  {
    id: "activity-sample-3",
    lead_id: "lead-sample-1",
    actor_user_id: "user-sample-1",
    actor_role: "seller",
    action: "listing_created",
    message: "Listing baru dibuat oleh Dapur Kawan Setiabudi.",
    metadata: {},
    created_at: "2026-06-09T15:10:00.000Z",
  },
  {
    id: "activity-sample-4",
    lead_id: "lead-sample-5",
    actor_user_id: "user-sample-5",
    actor_role: "buyer",
    action: "order_completed",
    message: "Deal desain kemasan selesai dan siap repeat order.",
    metadata: {},
    created_at: "2026-06-09T12:55:00.000Z",
  },
];

const SAMPLE_TICKETS: SupportTicket[] = [
  {
    id: "ticket-sample-1",
    requester_user_id: "user-sample-2",
    requester_email: "gudangrasa@example.com",
    requester_name: "Gudang Rasa Bekasi",
    category: "chat",
    subject: "Buyer minta MOQ dan area kirim",
    status: "open",
    priority: "high",
    assigned_agent_id: null,
    support_room_id: "room-sample-2",
    source: "chat",
    created_at: "2026-06-10T05:40:00.000Z",
    updated_at: "2026-06-10T05:45:00.000Z",
    resolved_at: null,
    first_response_at: null,
    latest_message: "Apakah stok cemilan reseller Bekasi masih ada?",
    latest_message_at: "2026-06-10T05:45:00.000Z",
  },
  {
    id: "ticket-sample-2",
    requester_user_id: "user-sample-4",
    requester_email: "selaras@example.com",
    requester_name: "Butik Selaras Gejayan",
    category: "dispute",
    subject: "Scope kerja belum jelas",
    status: "in_progress",
    priority: "urgent",
    assigned_agent_id: "agent-sample",
    support_room_id: "room-sample-4",
    source: "transaction",
    created_at: "2026-06-09T10:40:00.000Z",
    updated_at: "2026-06-10T01:05:00.000Z",
    resolved_at: null,
    first_response_at: "2026-06-09T10:50:00.000Z",
    latest_message: "Tolong bantu rapikan scope admin marketplace harian.",
    latest_message_at: "2026-06-10T01:05:00.000Z",
  },
];

const SAMPLE_ORDERS: SuperAppOrder[] = [
  {
    id: "order-sample-1",
    requester_id: "user-sample-4",
    partner_id: "seller-sample-4",
    merchant_id: null,
    provider_id: "seller-sample-4",
    service_type: "service",
    status: "in_progress",
    payment_mode: "escrow",
    currency: "IDR",
    amount_estimate_cents: 1200000000,
    amount_final_cents: 1200000000,
    pickup_address: "Yogyakarta",
    pickup_lat: null,
    pickup_lng: null,
    dropoff_address: null,
    dropoff_lat: null,
    dropoff_lng: null,
    risk_score: 24,
    risk_flags: [],
    metadata: { content_id: "listing-sample-4" },
    created_at: "2026-06-09T10:00:00.000Z",
    updated_at: "2026-06-10T01:05:00.000Z",
  },
  {
    id: "order-sample-2",
    requester_id: "user-sample-5",
    partner_id: "seller-sample-5",
    merchant_id: null,
    provider_id: "seller-sample-5",
    service_type: "product",
    status: "completed",
    payment_mode: "escrow",
    currency: "IDR",
    amount_estimate_cents: 2600000000,
    amount_final_cents: 2600000000,
    pickup_address: "Tangerang",
    pickup_lat: null,
    pickup_lng: null,
    dropoff_address: null,
    dropoff_lat: null,
    dropoff_lng: null,
    risk_score: 12,
    risk_flags: [],
    metadata: { content_id: "listing-sample-5" },
    created_at: "2026-06-07T08:00:00.000Z",
    updated_at: "2026-06-09T18:25:00.000Z",
  },
  {
    id: "order-sample-3",
    requester_id: "user-sample-2",
    partner_id: "seller-sample-2",
    merchant_id: null,
    provider_id: "seller-sample-2",
    service_type: "product",
    status: "disputed",
    payment_mode: "escrow",
    currency: "IDR",
    amount_estimate_cents: 1850000000,
    amount_final_cents: 1850000000,
    pickup_address: "Bekasi",
    pickup_lat: null,
    pickup_lng: null,
    dropoff_address: null,
    dropoff_lat: null,
    dropoff_lng: null,
    risk_score: 78,
    risk_flags: ["scope_unclear"],
    metadata: { content_id: "listing-sample-2" },
    created_at: "2026-06-08T08:00:00.000Z",
    updated_at: "2026-06-10T05:45:00.000Z",
  },
];

const SAMPLE_TRUST_PROFILES: SuperAppTrustProfile[] = [
  {
    user_id: "user-sample-1",
    tier: "verified",
    kyc_status: "full",
    crm_approval_status: "approved",
    marketing_segment: "seller_umkm",
    manual_hold: false,
    manual_per_order_cap_cents: null,
    manual_daily_cap_cents: null,
    manual_monthly_cap_cents: null,
    legal_terms_version: "2026-06",
    legal_terms_accepted_at: "2026-06-01T08:00:00.000Z",
    risk_strike_count: 0,
    metadata: { city: "Bandung", role: "Seller" },
    created_at: "2026-06-01T08:00:00.000Z",
    updated_at: "2026-06-10T03:40:00.000Z",
  },
  {
    user_id: "user-sample-2",
    tier: "rookie",
    kyc_status: "basic",
    crm_approval_status: "pending",
    marketing_segment: "supplier",
    manual_hold: true,
    manual_per_order_cap_cents: 3000000000,
    manual_daily_cap_cents: null,
    manual_monthly_cap_cents: null,
    legal_terms_version: "2026-06",
    legal_terms_accepted_at: "2026-06-01T08:00:00.000Z",
    risk_strike_count: 2,
    metadata: { city: "Bekasi", role: "Seller" },
    created_at: "2026-06-01T08:00:00.000Z",
    updated_at: "2026-06-10T05:45:00.000Z",
  },
  {
    user_id: "user-sample-3",
    tier: "trusted_pro",
    kyc_status: "full",
    crm_approval_status: "approved",
    marketing_segment: "talent",
    manual_hold: false,
    manual_per_order_cap_cents: null,
    manual_daily_cap_cents: null,
    manual_monthly_cap_cents: null,
    legal_terms_version: "2026-06",
    legal_terms_accepted_at: "2026-06-01T08:00:00.000Z",
    risk_strike_count: 0,
    metadata: { city: "Surabaya", role: "Talent" },
    created_at: "2026-06-01T08:00:00.000Z",
    updated_at: "2026-06-09T12:10:00.000Z",
  },
];

const SAMPLE_LISTINGS: CrmContentItem[] = [
  {
    id: "listing-sample-1",
    owner_id: "user-sample-1",
    content_type: "product",
    title: "Supplier kemasan food grade untuk UMKM",
    summary: "Kemasan bowl, cup, dan paper bag siap kirim.",
    price_cents: 4500000,
    currency: "IDR",
    category: "Supplier",
    content_status: "active",
    pricing_mode: "fixed",
    cover_image: "",
    metadata: { city: "Bandung", featured: true },
    created_at: "2026-06-08T08:20:00.000Z",
    updated_at: "2026-06-10T03:40:00.000Z",
  },
  {
    id: "listing-sample-2",
    owner_id: "user-sample-2",
    content_type: "product",
    title: "Distributor cemilan kemasan untuk reseller",
    summary: "Cemilan grosir untuk toko, reseller, dan komunitas.",
    price_cents: 18500000,
    currency: "IDR",
    category: "Barang Bekas",
    content_status: "active",
    pricing_mode: "fixed",
    cover_image: "",
    metadata: { city: "Bekasi", featured: false },
    created_at: "2026-06-07T08:20:00.000Z",
    updated_at: "2026-06-10T05:45:00.000Z",
  },
  {
    id: "listing-sample-3",
    owner_id: "user-sample-3",
    content_type: "freelancer",
    title: "Paket live host untuk brand lokal",
    summary: "Host live beauty, fashion, snack, dan edukasi produk.",
    price_cents: 75000000,
    currency: "IDR",
    category: "Talent",
    content_status: "draft",
    pricing_mode: "fixed",
    cover_image: "",
    metadata: { city: "Surabaya", featured: false },
    created_at: "2026-06-06T08:20:00.000Z",
    updated_at: "2026-06-09T12:10:00.000Z",
  },
  {
    id: "listing-sample-4",
    owner_id: "user-sample-4",
    content_type: "service",
    title: "Admin marketplace harian untuk Shopee Tokopedia",
    summary: "Upload produk, balas chat, optimasi etalase.",
    price_cents: 120000000,
    currency: "IDR",
    category: "Jasa",
    content_status: "paused",
    pricing_mode: "fixed",
    cover_image: "",
    metadata: { city: "Yogyakarta", featured: false },
    created_at: "2026-06-05T08:20:00.000Z",
    updated_at: "2026-06-10T01:05:00.000Z",
  },
];

const SAMPLE_USERS: CrmUserRow[] = [
  {
    id: "user-sample-1",
    name: "Dapur Kawan Setiabudi",
    handle: "@dapur_kawan",
    role: "Seller",
    kyc: "Verified",
    transactions: 12,
    gmvCents: 4200000000,
    lastActive: "2026-06-10T03:40:00.000Z",
    risk: "low",
    city: "Bandung",
  },
  {
    id: "user-sample-2",
    name: "Gudang Rasa Bekasi",
    handle: "@gudang_rasa",
    role: "Seller",
    kyc: "Pending",
    transactions: 4,
    gmvCents: 1850000000,
    lastActive: "2026-06-10T05:45:00.000Z",
    risk: "high",
    city: "Bekasi",
  },
  {
    id: "user-sample-3",
    name: "Panggung Live Creator",
    handle: "@panggung_live",
    role: "Talent",
    kyc: "Verified",
    transactions: 8,
    gmvCents: 750000000,
    lastActive: "2026-06-09T12:10:00.000Z",
    risk: "low",
    city: "Surabaya",
  },
  {
    id: "user-sample-4",
    name: "Butik Selaras Gejayan",
    handle: "@butik_selaras",
    role: "Buyer",
    kyc: "Pending",
    transactions: 3,
    gmvCents: 1200000000,
    lastActive: "2026-06-10T01:05:00.000Z",
    risk: "medium",
    city: "Yogyakarta",
  },
];

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

function formatDate(value?: string | null): string {
  if (!value) return "-";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("id-ID", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function compactId(value: string): string {
  if (!value) return "-";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}...${value.slice(-4)}`;
}

function normalizeStage(stage: string): string {
  const clean = stage.toLowerCase();
  if (clean === "qualified") return "Tertarik";
  if (clean === "negotiation") return "Negosiasi";
  if (clean === "contract") return "Escrow";
  if (clean === "won" || clean === "completed") return "Selesai";
  return "Lead Baru";
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
      lastMessage: `Minat pada ${asString(lead.metadata?.listing_title) || lead.name}`,
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

function buildDailySeries(orders: SuperAppOrder[]): ChartPoint[] {
  const labels = ["Sen", "Sel", "Rab", "Kam", "Jum", "Sab", "Min"];
  if (!orders.length) {
    return labels.map(label => ({ label, value: 0 }));
  }
  const buckets = labels.map((label, index) => ({
    label,
    value: orders
      .filter((_, orderIndex) => orderIndex % labels.length === index)
      .reduce(
        (sum, order) =>
          sum + Math.round((order.amount_final_cents || order.amount_estimate_cents || 0) / 10000000),
        0,
      ),
  }));
  return buckets;
}

function buildCategorySeries(listings: CrmListingRow[]): ChartPoint[] {
  const counts = new Map<string, number>();
  for (const listing of listings) {
    counts.set(listing.category, (counts.get(listing.category) || 0) + 1);
  }
  const items = Array.from(counts.entries())
    .map(([label, value]) => ({ label, value }))
    .sort((left, right) => right.value - left.value)
    .slice(0, 5);
  return items;
}

function buildFunnel(leads: CrmLead[], chats: CrmChatRow[], orders: SuperAppOrder[], listings: CrmListingRow[]): ChartPoint[] {
  const negotiation = leads.filter(lead =>
    ["negotiation", "contract", "won"].includes(lead.stage.toLowerCase()),
  ).length;
  const completed = orders.filter(order => order.status === "completed").length;
  return [
    { label: "Dilihat", value: listings.length * 120 },
    { label: "Chat", value: chats.length * 24 },
    { label: "Negosiasi", value: negotiation * 12 },
    { label: "Deal", value: completed * 8 },
  ];
}

function buildInsights(data: DashboardData): CrmInsight[] {
  const hotLead = data.leads.find(lead =>
    ["negotiation", "contract"].includes(lead.stage.toLowerCase()),
  );
  const riskyUser = data.users.find(user => user.risk === "high");
  const strongListing = data.listings.find(listing => listing.featured || listing.status === "active");
  return [
    {
      title: "Listing ini kemungkinan closing tinggi",
      body: strongListing
        ? `${strongListing.title} aktif dan punya sinyal minat. Dorong seller untuk balas chat lebih cepat.`
        : "Belum ada listing kuat. Prioritaskan listing aktif dengan foto dan lokasi jelas.",
      tone: "green",
    },
    {
      title: "User sering chat tapi belum transaksi",
      body: hotLead
        ? `${hotLead.requester_name || hotLead.name} sudah masuk ${normalizeStage(
            hotLead.stage,
          )}. Agent perlu follow-up hari ini.`
        : "Belum ada prospek panas. Pantau chat baru dari supplier dan jasa.",
      tone: "amber",
    },
    {
      title: "Risiko perlu dicek manual",
      body: riskyUser
        ? `${riskyUser.name} punya risiko tinggi. Cek KYC, dispute, dan riwayat transaksi sebelum approve.`
        : "Belum ada risiko tinggi. Tetap cek akun baru yang transaksi besar.",
      tone: "blue",
    },
  ];
}

function buildInitialData(): DashboardData {
  if (!CRM_DEMO_DATA_ENABLED) {
    return {
      leads: [],
      activities: [],
      tickets: [],
      orders: [],
      trustProfiles: [],
      users: [],
      listings: [],
      chats: [],
      sampleCollections: [],
      emptyCollections: [],
      failures: [],
    };
  }

  const listings = normalizeListings(SAMPLE_LISTINGS);
  const users = SAMPLE_USERS;
  const chats = normalizeChats(SAMPLE_TICKETS, SAMPLE_LEADS);
  const listingsWithReports = attachListingReports(listings, SAMPLE_TICKETS);
  const activities = normalizeActivities(SAMPLE_ACTIVITIES, listingsWithReports, SAMPLE_ORDERS, SAMPLE_TICKETS);
  return {
    leads: SAMPLE_LEADS,
    activities,
    tickets: SAMPLE_TICKETS,
    orders: SAMPLE_ORDERS,
    trustProfiles: SAMPLE_TRUST_PROFILES,
    users,
    listings: listingsWithReports,
    chats,
    sampleCollections: ["leads", "activities", "tickets", "orders", "users", "listings"],
    emptyCollections: [],
    failures: [],
  };
}

function resolveMediaUrl(src: string, wwwUrl: string): string {
  if (!src) return "";
  if (/^https?:\/\//i.test(src)) return src;
  const base = wwwUrl.replace(/\/$/, "");
  return `${base}${src.startsWith("/") ? src : `/${src}`}`;
}

function riskLabel(risk: CrmUserRow["risk"]): string {
  if (risk === "high") return "Risiko Tinggi ⚠️";
  if (risk === "medium") return "Risiko Sedang";
  return "Risiko Rendah";
}

function kycLabel(kyc: CrmUserRow["kyc"]): string {
  if (kyc === "Verified") return "Terverifikasi ✔️";
  if (kyc === "Rejected") return "Ditolak";
  return "Perlu Dicek";
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

function LineChart({ data }: { data: ChartPoint[] }) {
  if (!data.length || data.every(item => item.value <= 0)) {
    return (
      <div className="flex h-52 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center">
        <div>
          <p className="text-sm font-black text-slate-900">Belum ada data GMV</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Grafik akan muncul setelah ada order real.</p>
        </div>
      </div>
    );
  }

  const max = Math.max(...data.map(item => item.value), 1);
  const points = data
    .map((item, index) => {
      const x = data.length === 1 ? 160 : 18 + (index / (data.length - 1)) * 284;
      const y = 118 - (item.value / max) * 92;
      return `${x},${y}`;
    })
    .join(" ");
  const area = `18,124 ${points} 302,124`;

  return (
    <div className="h-52 rounded-2xl bg-gradient-to-b from-emerald-50 to-white p-4">
      <svg viewBox="0 0 320 150" className="h-full w-full">
        <defs>
          <linearGradient id="gmvArea" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor="#6cd698" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6cd698" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polyline points="18,124 302,124" stroke="#e5e7eb" strokeWidth="1" />
        <polygon points={area} fill="url(#gmvArea)" />
        <polyline points={points} fill="none" stroke="#22c55e" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" />
        {data.map((item, index) => {
          const x = data.length === 1 ? 160 : 18 + (index / (data.length - 1)) * 284;
          const y = 118 - (item.value / max) * 92;
          return (
            <g key={item.label}>
              <circle cx={x} cy={y} r="4" fill="#16a34a" />
              <text x={x} y="144" textAnchor="middle" fontSize="10" fill="#64748b">
                {item.label}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function BarChart({ data }: { data: ChartPoint[] }) {
  if (!data.length) {
    return <EmptyState title="Belum ada kategori" body="Data kategori muncul setelah ada listing real." />;
  }

  const max = Math.max(...data.map(item => item.value), 1);
  return (
    <div className="space-y-3">
      {data.map(item => (
        <div key={item.label}>
          <div className="mb-1 flex items-center justify-between text-xs font-semibold text-slate-600">
            <span>{item.label}</span>
            <span>{item.value}</span>
          </div>
          <div className="h-3 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full bg-[#6cd698]"
              style={{ width: `${Math.max(8, (item.value / max) * 100)}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function FunnelChart({ data }: { data: ChartPoint[] }) {
  if (!data.length || data.every(item => item.value <= 0)) {
    return <EmptyState title="Funnel masih kosong" body="Sinyal funnel muncul dari listing, chat, negosiasi, dan deal real." />;
  }

  const max = Math.max(...data.map(item => item.value), 1);
  return (
    <div className="space-y-2">
      {data.map((item, index) => (
        <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between text-sm">
            <span className="font-bold text-slate-900">{item.label}</span>
            <span className="text-slate-500">{item.value}</span>
          </div>
          <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.max(10, (item.value / max) * 100)}%`,
                backgroundColor: ["#16a34a", "#22c55e", "#86efac", "#bbf7d0"][index] || "#6cd698",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

function KpiCard({ item }: { item: CrmKpi }) {
  const toneClass = {
    green: "from-emerald-50 to-white text-emerald-700",
    blue: "from-sky-50 to-white text-sky-700",
    amber: "from-amber-50 to-white text-amber-700",
    rose: "from-rose-50 to-white text-rose-700",
  }[item.tone];
  return (
    <ShellCard className={`bg-gradient-to-br ${toneClass} p-4`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-slate-500">{item.label}</p>
          <p className="mt-2 text-2xl font-black tracking-[-0.04em] text-slate-950">{item.value}</p>
        </div>
        <span className="rounded-full bg-white px-2.5 py-1 text-xs font-bold shadow-sm">{item.trend}</span>
      </div>
      <p className="mt-3 text-xs font-medium text-slate-500">{item.note}</p>
    </ShellCard>
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

    const leads = liveLeads.length
      ? liveLeads
      : CRM_DEMO_DATA_ENABLED
        ? SAMPLE_LEADS
        : [];
    const activitiesSource = liveActivities.length
      ? liveActivities
      : CRM_DEMO_DATA_ENABLED
        ? SAMPLE_ACTIVITIES
        : [];
    const tickets = liveTickets.length
      ? liveTickets
      : CRM_DEMO_DATA_ENABLED
        ? SAMPLE_TICKETS
        : [];
    const orders = liveOrders.length
      ? liveOrders
      : CRM_DEMO_DATA_ENABLED
        ? SAMPLE_ORDERS
        : [];
    const trustProfiles = liveTrust.length
      ? liveTrust
      : CRM_DEMO_DATA_ENABLED
        ? SAMPLE_TRUST_PROFILES
        : [];
    const normalizedListings = liveContent.length
      ? normalizeListings(liveContent)
      : CRM_DEMO_DATA_ENABLED
        ? normalizeListings(SAMPLE_LISTINGS)
        : [];
    const users = normalizeUsers(liveUsers, trustProfiles, orders, leads);
    const safeUsers = users.length
      ? users
      : CRM_DEMO_DATA_ENABLED
        ? SAMPLE_USERS
        : [];
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
    const sampleCollections = CRM_DEMO_DATA_ENABLED ? emptyCollections : [];

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
      emptyCollections: CRM_DEMO_DATA_ENABLED ? [] : emptyCollections,
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
      const payload = {
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
      }[action];

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
  const gmvCents = useMemo(
    () =>
      data.orders.reduce(
        (sum, order) => sum + (order.amount_final_cents || order.amount_estimate_cents || 0),
        0,
      ),
    [data.orders],
  );
  const pendingTransactions = useMemo(
    () =>
      data.orders.filter(order =>
        ["pending_verification", "ready_for_dispatch", "dispatching", "in_progress", "disputed"].includes(
          order.status,
        ),
      ).length,
    [data.orders],
  );
  const kpis: CrmKpi[] = useMemo(
    () => [
      {
        label: "Total User",
        value: String(data.users.length),
        note: "Buyer, seller, talent, dan admin yang terpantau.",
        trend: "+12%",
        tone: "green",
      },
      {
        label: "Listing Aktif",
        value: String(data.listings.filter(item => item.status === "active").length),
        note: "Katalog yang sudah bisa ditemukan user.",
        trend: "+8%",
        tone: "blue",
      },
      {
        label: "Total GMV",
        value: formatCurrency(gmvCents),
        note: "Nilai transaksi dan order yang masuk CRM.",
        trend: "+18%",
        tone: "green",
      },
      {
        label: "Transaksi Pending",
        value: String(pendingTransactions),
        note: "Butuh follow-up atau review agent.",
        trend: "cek",
        tone: "amber",
      },
      {
        label: "Chat Aktif",
        value: String(data.chats.length),
        note: "Percakapan prospek dan support aktif.",
        trend: "live",
        tone: "rose",
      },
    ],
    [data.chats.length, data.listings, data.users.length, gmvCents, pendingTransactions],
  );

  const chartData = useMemo(
    () => ({
      daily: buildDailySeries(data.orders),
      categories: buildCategorySeries(data.listings),
      funnel: buildFunnel(data.leads, data.chats, data.orders, data.listings),
      insights: buildInsights(data),
    }),
    [data],
  );

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
              {data.sampleCollections.length ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-800">
                  Mode demo aktif untuk: {data.sampleCollections.join(", ")}.
                  Matikan `NEXT_PUBLIC_CRM_ENABLE_DEMO_DATA` kalau admin harus melihat data real saja.
                  {data.failures.length ? ` Service gagal: ${data.failures.join(", ")}.` : ""}
                </div>
              ) : null}
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
                <DashboardHome
                  data={filteredData}
                  chartData={chartData}
                  kpis={kpis}
                  onOpenPage={setActivePage}
                />
              ) : null}
              {activePage === "pipeline" ? <PipelinePage leads={filteredData.leads} /> : null}
            {activePage === "users" ? (
              <UsersPage users={filteredData.users} onTrustAction={handleUserTrustAction} />
            ) : null}
            {activePage === "listings" ? (
              <ListingsPage
                listings={filteredData.listings}
                wwwUrl={wwwUrl}
                onStatusChange={handleListingStatus}
                onModerationAction={handleListingModeration}
              />
            ) : null}
              {activePage === "transactions" ? <TransactionsPage transactions={transactions} /> : null}
              {activePage === "chat" ? <ChatPage chats={filteredData.chats} /> : null}
              {activePage === "analytics" ? (
                <AnalyticsPage
                  users={filteredData.users}
                  listings={filteredData.listings}
                  transactions={transactions}
                  chartData={chartData}
                />
              ) : null}
              {activePage === "disputes" ? (
                <DisputesPage tickets={data.tickets} transactions={transactions} users={data.users} />
              ) : null}
              {activePage === "settings" ? <SettingsPage /> : null}
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
        className={`fixed inset-0 z-40 bg-slate-950/30 backdrop-blur-sm transition lg:hidden ${
          mobileOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
      />
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-[100dvh] border-r border-slate-200 bg-white transition-all duration-300 lg:static lg:inset-auto lg:z-auto lg:h-full lg:shrink-0 ${
          collapsed ? "w-[88px]" : "w-[280px]"
        } ${mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"}`}
      >
        <div className="flex h-full min-h-0 w-full flex-col p-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[#6cd698] text-lg font-black text-white shadow-[0_16px_26px_-18px_rgba(22,163,74,0.8)]">
              L
            </span>
            {!collapsed ? (
              <div className="min-w-0">
                <p className="text-base font-black tracking-[-0.04em] text-slate-950">Lajukan CRM</p>
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
            {NAV_ITEMS.map(item => {
              const active = activePage === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelect(item.id)}
                  className={`flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 text-left transition ${
                    active
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
                <p className="text-xs font-black text-slate-900">Mode CRM v1</p>
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
  const page = NAV_ITEMS.find(item => item.id === activePage) || NAV_ITEMS[0];
  return (
    <header className="z-30 shrink-0 border-b border-slate-200 bg-white/90 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-[1540px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={onOpenMobile}
          className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-700 lg:hidden"
          aria-label="Buka menu"
        >
          <Icon name="menu" className="h-5 w-5" />
        </button>
        <div className="hidden min-w-[150px] sm:block">
          <p className="text-sm font-black text-slate-950">{page.label}</p>
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
            <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-black text-white">
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
            <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-slate-900 text-xs font-black text-white">
              {userLabel.slice(0, 1).toUpperCase()}
            </span>
            <span className="hidden max-w-[130px] truncate text-sm font-bold text-slate-800 md:block">
              {userLabel}
            </span>
          </button>
          {profileOpen ? (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-slate-200 bg-white p-2 shadow-xl">
              <div className="rounded-xl bg-slate-50 p-3">
                <p className="text-sm font-black text-slate-900">{userLabel}</p>
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

function DashboardHome({
  data,
  chartData,
  kpis,
  onOpenPage,
}: {
  data: DashboardData;
  chartData: {
    daily: ChartPoint[];
    categories: ChartPoint[];
    funnel: ChartPoint[];
    insights: CrmInsight[];
  };
  kpis: CrmKpi[];
  onOpenPage: (page: PageId) => void;
}) {
  return (
    <div className="space-y-5">
      <section className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <Badge tone="success">CRM + CMS Marketplace</Badge>
          <h1 className="mt-3 text-2xl font-black tracking-[-0.05em] text-slate-950 sm:text-3xl">
            Pantau transaksi, chat, dan listing dalam satu tempat.
          </h1>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500">
            Dibuat untuk admin non-teknis: lihat yang perlu dicek, follow-up prospek,
            dan jaga kualitas marketplace tanpa dashboard yang ribet.
          </p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <button
            type="button"
            onClick={() => onOpenPage("listings")}
            className="rounded-2xl bg-[#6cd698] px-4 py-3 text-sm font-black text-white shadow-[0_16px_28px_-20px_rgba(22,163,74,0.8)]"
          >
            Cek Listing
          </button>
          <button
            type="button"
            onClick={() => onOpenPage("chat")}
            className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700"
          >
            Buka Chat
          </button>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        {kpis.map(item => (
          <KpiCard key={item.label} item={item} />
        ))}
      </section>

      <section className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
        <ShellCard className="p-5">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">GMV per hari</p>
              <p className="text-xs font-semibold text-slate-500">Grafik bersih seperti Stripe, fokus tren.</p>
            </div>
            <Badge tone="blue">7 hari</Badge>
          </div>
          <LineChart data={chartData.daily} />
        </ShellCard>

        <ShellCard className="p-5">
          <p className="text-sm font-black text-slate-950">Kategori paling aktif</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Listing dan permintaan paling ramai.</p>
          <div className="mt-5">
            <BarChart data={chartData.categories} />
          </div>
        </ShellCard>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1fr_0.8fr]">
        <ShellCard className="p-5">
          <p className="text-sm font-black text-slate-950">Funnel transaksi</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">Dari dilihat sampai deal sukses.</p>
          <div className="mt-4">
            <FunnelChart data={chartData.funnel} />
          </div>
        </ShellCard>

        <ShellCard className="p-5">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <p className="text-sm font-black text-slate-950">CRM Pipeline Snapshot</p>
              <p className="text-xs font-semibold text-slate-500">Kanban mini untuk prospek panas.</p>
            </div>
            <Badge tone="warning">{data.leads.length} lead</Badge>
          </div>
          <MiniPipeline leads={data.leads} />
        </ShellCard>

        <ShellCard className="p-5">
          <p className="text-sm font-black text-slate-950">Aktivitas realtime</p>
          <div className="mt-4 space-y-3">
            {data.activities.slice(0, 6).map(activity => (
              <ActivityItem key={activity.id} activity={activity} />
            ))}
          </div>
        </ShellCard>
      </section>
    </div>
  );
}

function MiniPipeline({ leads }: { leads: CrmLead[] }) {
  const columns = [
    { id: "new", label: "Lead Baru" },
    { id: "interested", label: "Tertarik" },
    { id: "negotiation", label: "Negosiasi" },
    { id: "locked", label: "Escrow" },
    { id: "completed", label: "Selesai" },
  ] as const;
  return (
    <div className="grid gap-2">
      {columns.map(column => {
        const items = leads.filter(lead => stageGroup(lead.stage) === column.id).slice(0, 2);
        return (
          <div key={column.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-black text-slate-800">{column.label}</p>
              <span className="text-xs font-bold text-slate-400">{items.length}</span>
            </div>
            <div className="mt-2 space-y-2">
              {items.map(lead => (
                <div key={lead.id} className="rounded-xl bg-white p-3 shadow-sm">
                  <p className="line-clamp-1 text-xs font-black text-slate-900">{lead.requester_name || lead.name}</p>
                  <p className="mt-1 line-clamp-1 text-[11px] text-slate-500">
                    {asString(lead.metadata?.listing_title) || lead.sector || "Listing"}
                  </p>
                  <p className="mt-2 text-[11px] font-bold text-emerald-700">
                    {formatCurrency(lead.value_cents || 0, lead.currency || "IDR")}
                  </p>
                </div>
              ))}
              {!items.length ? <p className="text-[11px] text-slate-400">Belum ada.</p> : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ActivityItem({ activity }: { activity: CrmActivityRow }) {
  const tone = {
    user: "bg-sky-100 text-sky-700",
    listing: "bg-emerald-100 text-emerald-700",
    chat: "bg-indigo-100 text-indigo-700",
    transaction: "bg-amber-100 text-amber-700",
    dispute: "bg-rose-100 text-rose-700",
    done: "bg-emerald-100 text-emerald-700",
  }[activity.type];
  return (
    <div className="flex gap-3">
      <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${tone}`} />
      <div className="min-w-0">
        <p className="text-sm font-bold text-slate-900">{activity.title}</p>
        <p className="line-clamp-2 text-xs leading-5 text-slate-500">{activity.body}</p>
        <p className="mt-1 text-[11px] font-semibold text-slate-400">{formatDate(activity.at)}</p>
      </div>
    </div>
  );
}

function PipelinePage({ leads }: { leads: CrmLead[] }) {
  const columns = [
    { id: "new", label: "Lead Baru", help: "Baru masuk dari listing/chat" },
    { id: "interested", label: "Tertarik", help: "Butuh follow-up agent" },
    { id: "negotiation", label: "Negosiasi", help: "Harga dan scope dibahas" },
    { id: "locked", label: "Escrow", help: "Deal mulai dikunci" },
    { id: "completed", label: "Selesai", help: "Deal sukses" },
  ] as const;
  return (
    <div className="space-y-5">
      <PageHeader
        label="CRM Pipeline"
        title="Follow-up prospek sampai jadi deal."
        body="Bahasa dibuat sederhana agar agent langsung tahu siapa yang harus dihubungi dulu."
      />
      <div className="grid gap-4 xl:grid-cols-5">
        {columns.map(column => {
          const items = leads.filter(lead => stageGroup(lead.stage) === column.id);
          return (
            <ShellCard key={column.id} className="min-h-[420px] p-3">
              <div className="mb-3 rounded-2xl bg-slate-50 p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-black text-slate-900">{column.label}</p>
                  <Badge tone={column.id === "completed" ? "success" : "neutral"}>{items.length}</Badge>
                </div>
                <p className="mt-1 text-xs text-slate-500">{column.help}</p>
              </div>
              <div className="space-y-3">
                {items.map(lead => (
                  <div key={lead.id} className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
                    <div className="flex items-start justify-between gap-2">
                      <p className="line-clamp-2 text-sm font-black text-slate-950">{lead.requester_name || lead.name}</p>
                      {column.id === "negotiation" || column.id === "locked" ? (
                        <Badge tone="warning">Hot Lead 🔥</Badge>
                      ) : null}
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-500">
                      {asString(lead.metadata?.listing_title) || lead.sector || "Listing yang dilihat"}
                    </p>
                    <div className="mt-3 flex items-center justify-between text-xs">
                      <span className="font-black text-emerald-700">
                        {formatCurrency(lead.value_cents || 0, lead.currency || "IDR")}
                      </span>
                      <span className="text-slate-400">{formatDate(lead.updated_at)}</span>
                    </div>
                  </div>
                ))}
                {!items.length ? (
                  <EmptyState title="Kosong" body="Belum ada lead di tahap ini." />
                ) : null}
              </div>
            </ShellCard>
          );
        })}
      </div>
    </div>
  );
}

function UsersPage({
  users,
  onTrustAction,
}: {
  users: CrmUserRow[];
  onTrustAction: (
    user: CrmUserRow,
    action: "approve" | "reject" | "warn" | "hold" | "release",
  ) => void;
}) {
  const [role, setRole] = useState("all");
  const [kyc, setKyc] = useState("all");
  const [activity, setActivity] = useState("all");
  const filtered = users.filter(user => {
    const roleOk = role === "all" || user.role === role;
    const kycOk = kyc === "all" || user.kyc === kyc;
    const activityOk = activity === "all" || (activity === "risk" ? user.risk !== "low" : true);
    return roleOk && kycOk && activityOk;
  });
  return (
    <div className="space-y-5">
      <PageHeader
        label="Trust & KYC"
        title="Kelola user nakal tanpa bikin admin bingung."
        body="Approve/reject KYC, beri peringatan, manual hold, atau lepas hold langsung dari trust profile."
      />
      <FilterBar
        filters={[
          { label: "Role", value: role, onChange: setRole, options: ["all", "Buyer", "Seller", "Talent", "Admin"] },
          { label: "Status KYC", value: kyc, onChange: setKyc, options: ["all", "Verified", "Pending", "Rejected"] },
          { label: "Aktivitas", value: activity, onChange: setActivity, options: ["all", "risk"] },
        ]}
      />
      <ShellCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1180px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
              <tr>
                <th className="px-4 py-3">Nama user</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">KYC</th>
                <th className="px-4 py-3">Transaksi</th>
                <th className="px-4 py-3">GMV kontribusi</th>
                <th className="px-4 py-3">Last active</th>
                <th className="px-4 py-3">Risiko</th>
                <th className="px-4 py-3">Trust action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map(user => (
                <tr key={user.id} className="hover:bg-slate-50/70">
                  <td className="px-4 py-4">
                    <div className="flex items-center gap-3">
                      <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-900 text-xs font-black text-white">
                        {user.name.slice(0, 1)}
                      </span>
                      <div>
                        <p className="font-black text-slate-950">{user.name}</p>
                        <p className="text-xs text-slate-500">{user.handle} - {user.city}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-4"><Badge tone="blue">{user.role}</Badge></td>
                  <td className="px-4 py-4"><Badge tone={user.kyc === "Verified" ? "success" : user.kyc === "Rejected" ? "danger" : "warning"}>{kycLabel(user.kyc)}</Badge></td>
                  <td className="px-4 py-4 font-bold text-slate-800">{user.transactions}</td>
                  <td className="px-4 py-4 font-bold text-slate-800">{formatCurrency(user.gmvCents)}</td>
                  <td className="px-4 py-4 text-slate-500">{formatDate(user.lastActive)}</td>
                  <td className="px-4 py-4">
                    <div className="grid gap-1">
                      <Badge tone={user.risk === "high" ? "danger" : user.risk === "medium" ? "warning" : "success"}>{riskLabel(user.risk)}</Badge>
                      <span className="text-[11px] font-semibold text-slate-500">
                        {user.manualHold ? "Manual hold aktif" : `${user.riskStrikes} strike`}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-4">
                    <div className="flex min-w-[280px] flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => onTrustAction(user, "approve")}
                        className="rounded-xl bg-emerald-600 px-2.5 py-2 text-[11px] font-black text-white"
                      >
                        Approve KYC
                      </button>
                      <button
                        type="button"
                        onClick={() => onTrustAction(user, "reject")}
                        className="rounded-xl border border-rose-200 bg-rose-50 px-2.5 py-2 text-[11px] font-black text-rose-700"
                      >
                        Reject
                      </button>
                      <button
                        type="button"
                        onClick={() => onTrustAction(user, "warn")}
                        className="rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2 text-[11px] font-black text-amber-700"
                      >
                        Alert
                      </button>
                      <button
                        type="button"
                        onClick={() => onTrustAction(user, user.manualHold ? "release" : "hold")}
                        className="rounded-xl border border-slate-200 bg-white px-2.5 py-2 text-[11px] font-black text-slate-700"
                      >
                        {user.manualHold ? "Lepas hold" : "Hold akun"}
                      </button>
                    </div>
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
                <div className="flex h-full items-center justify-center text-xs font-black text-slate-400">
                  Preview listing
                </div>
              ) : null}
            </div>
            <div className="p-4">
              <div className="flex items-start justify-between gap-2">
                <p className="line-clamp-2 text-sm font-black text-slate-950">{listing.title}</p>
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
              <p className="mt-3 text-lg font-black text-emerald-700">
                {listing.priceCents ? formatCurrency(listing.priceCents, listing.currency) : "Harga tanya admin"}
              </p>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedListing(listing)}
                  className="rounded-xl bg-[#6cd698] px-3 py-2 text-xs font-black text-white"
                >
                  Detail report
                </button>
                <button
                  type="button"
                  onClick={() => onModerationAction(listing, "review")}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700"
                >
                  Tinjau
                </button>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => onModerationAction(listing, "hide")}
                  className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-600"
                >
                  Sembunyikan
                </button>
                <button
                  type="button"
                  onClick={() => onModerationAction(listing, "ban")}
                  className="rounded-xl border border-slate-200 bg-slate-950 px-3 py-2 text-xs font-black text-white"
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
              <h2 className="mt-3 text-xl font-black tracking-[-0.04em] text-slate-950">
                {selectedListing.title}
              </h2>
              <p className="mt-1 text-sm font-semibold text-slate-500">
                Owner {compactId(selectedListing.ownerId)} - {selectedListing.category} - {selectedListing.location}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedListing(null)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"
            >
              Tutup detail
            </button>
          </div>
          <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.85fr]">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-black text-slate-950">Siapa yang report?</p>
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
              <p className="text-sm font-black text-slate-950">Alasan laporan</p>
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
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-black text-white"
            >
              Pulihkan aktif
            </button>
            <button
              type="button"
              onClick={() => onModerationAction(selectedListing, "review")}
              className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-black text-amber-700"
            >
              Tandai perlu tinjau
            </button>
            <button
              type="button"
              onClick={() => onModerationAction(selectedListing, "hide")}
              className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-black text-rose-700"
            >
              Sembunyikan listing
            </button>
            <button
              type="button"
              onClick={() => onModerationAction(selectedListing, "ban")}
              className="rounded-xl bg-slate-950 px-3 py-2 text-xs font-black text-white"
            >
              Ban / arsipkan
            </button>
          </div>
        </ShellCard>
      ) : null}
      <ShellCard className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-[1120px] w-full text-left text-sm">
            <thead className="bg-slate-50 text-xs font-black uppercase tracking-[0.12em] text-slate-500">
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
                  <td className="px-4 py-4 font-black text-slate-950">{listing.title}</td>
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
                      className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600"
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

function TransactionsPage({ transactions }: { transactions: CrmTransactionRow[] }) {
  return (
    <div className="space-y-5">
      <PageHeader
        label="Transactions"
        title="Pantau order dari dibuat sampai selesai."
        body="Timeline dibuat sederhana agar admin cepat tahu transaksi mana yang macet atau dispute."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        {transactions.map(tx => (
          <ShellCard key={tx.id} className="p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-black text-slate-950">Transaksi {compactId(tx.id)}</p>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  Buyer {tx.buyer} - Seller {tx.seller}
                </p>
              </div>
              <Badge tone={toneForStatus(tx.status)}>{statusLabel(tx.status)}</Badge>
            </div>
            <p className="mt-4 text-2xl font-black tracking-[-0.04em] text-slate-950">
              {formatCurrency(tx.amountCents)}
            </p>
            <OrderTimeline status={tx.status} />
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="rounded-xl bg-slate-900 px-3 py-2 text-xs font-black text-white">
                Lihat detail
              </button>
              <button
                type="button"
                disabled={tx.status !== "disputed"}
                className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-500 disabled:text-slate-300"
                title={tx.status === "disputed" ? "Resolve dispute" : "Hanya untuk dispute"}
              >
                Resolve dispute
              </button>
            </div>
          </ShellCard>
        ))}
      </div>
    </div>
  );
}

function OrderTimeline({ status }: { status: string }) {
  const steps = ["Order created", "Payment locked", "Seller accepted", "Work in progress", status === "disputed" ? "Dispute" : "Completed"];
  const statusIndex = status === "completed" ? 4 : status === "disputed" ? 4 : status.includes("progress") ? 3 : status.includes("dispatch") ? 2 : status.includes("pending") ? 1 : 0;
  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-5">
      {steps.map((step, index) => (
        <div key={step} className="flex items-center gap-2 sm:block">
          <span className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-black ${
            index <= statusIndex ? "bg-[#6cd698] text-white" : "bg-slate-100 text-slate-400"
          }`}>
            {index + 1}
          </span>
          <p className="mt-0 text-xs font-semibold text-slate-600 sm:mt-2">{step}</p>
        </div>
      ))}
    </div>
  );
}

function ChatPage({ chats }: { chats: CrmChatRow[] }) {
  const [selectedId, setSelectedId] = useState(chats[0]?.id || "");
  const selected = chats.find(chat => chat.id === selectedId) || chats[0] || null;

  return (
    <div className="space-y-5">
      <PageHeader
        label="Chat CRM"
        title="Inbox seperti WhatsApp Business."
        body="Agent bisa lihat chat, listing yang dibahas, status prospek, dan template balasan cepat."
      />
      <div className="grid min-h-[680px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)_330px]">
        <ShellCard className="overflow-hidden">
          <div className="border-b border-slate-200 p-4">
            <p className="font-black text-slate-950">Daftar chat</p>
            <p className="text-xs text-slate-500">{chats.length} percakapan aktif</p>
          </div>
          <div className="max-h-[620px] overflow-y-auto p-2">
            {chats.map(chat => (
              <button
                key={chat.id}
                type="button"
                onClick={() => setSelectedId(chat.id)}
                className={`mb-1 flex w-full gap-3 rounded-2xl p-3 text-left transition ${
                  selected?.id === chat.id ? "bg-emerald-50 ring-1 ring-emerald-100" : "hover:bg-slate-50"
                }`}
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-900 text-xs font-black text-white">
                  {chat.name.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-black text-slate-950">{chat.name}</span>
                    {chat.unread ? <span className="h-2 w-2 rounded-full bg-[#6cd698]" /> : null}
                  </span>
                  <span className="line-clamp-1 text-xs text-slate-500">{chat.lastMessage}</span>
                </span>
              </button>
            ))}
          </div>
        </ShellCard>

        <ShellCard className="flex min-h-[620px] flex-col overflow-hidden">
          <div className="flex items-center justify-between border-b border-slate-200 p-4">
            <div>
              <p className="font-black text-slate-950">{selected?.name || "Pilih chat"}</p>
              <p className="text-xs text-slate-500">End-to-end CRM view - bukan chat teknis</p>
            </div>
            {selected ? <Badge tone={selected.stage === "Hot" ? "warning" : "blue"}>{selected.stage === "Hot" ? "Hot Lead 🔥" : selected.stage}</Badge> : null}
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto bg-[#F9FAFB] p-4">
            {selected ? (
              <>
                <ChatBubble side="left" body={`Halo, saya mau tanya tentang ${selected.listingTitle}.`} />
                <ChatBubble side="right" body="Siap, boleh. Saya bantu cek stok, harga, dan area layanan dulu ya." />
                <ChatBubble side="left" body={selected.lastMessage} />
              </>
            ) : (
              <EmptyState title="Belum ada chat" body="Pilih percakapan di kiri." />
            )}
          </div>
          <div className="border-t border-slate-200 bg-white p-3">
            <div className="mb-2 flex flex-wrap gap-2">
              {["Masih tersedia?", "Boleh minta detail?", "Kirim harga dan lokasi"].map(template => (
                <button key={template} type="button" className="rounded-full border border-slate-200 px-3 py-1.5 text-xs font-bold text-slate-600">
                  {template}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                placeholder="Tulis balasan cepat..."
                className="min-h-11 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 text-sm font-semibold outline-none focus:border-emerald-300 focus:bg-white"
              />
              <button type="button" className="rounded-2xl bg-[#6cd698] px-4 text-sm font-black text-white">
                Kirim
              </button>
            </div>
          </div>
        </ShellCard>

        <ShellCard className="p-5">
          {selected ? (
            <div>
              <p className="text-sm font-black text-slate-950">Info user</p>
              <div className="mt-4 rounded-2xl bg-slate-50 p-4">
                <p className="font-black text-slate-950">{selected.name}</p>
                <p className="mt-1 text-xs text-slate-500">{selected.source} - {formatDate(selected.updatedAt)}</p>
              </div>
              <div className="mt-4 space-y-3">
                <InfoRow label="Status prospek" value={selected.stage === "Hot" ? "Hot Lead 🔥" : selected.stage} />
                <InfoRow label="Listing terkait" value={selected.listingTitle} />
                <InfoRow label="Tahap konversi" value={selected.stage === "Hot" ? "Dalam Negosiasi" : "Perlu Follow-up"} />
              </div>
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-sm font-black text-emerald-800">Tag otomatis</p>
                <p className="mt-1 text-xs leading-5 text-emerald-700">
                  User ini cocok dimasukkan ke tahap follow-up karena sudah bertanya soal listing.
                </p>
              </div>
            </div>
          ) : (
            <EmptyState title="Info kosong" body="Pilih chat untuk melihat profil dan listing terkait." />
          )}
        </ShellCard>
      </div>
    </div>
  );
}

function ChatBubble({ side, body }: { side: "left" | "right"; body: string }) {
  return (
    <div className={`flex ${side === "right" ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-6 shadow-sm ${
          side === "right" ? "bg-[#d9ffd7] text-slate-900" : "bg-white text-slate-700"
        }`}
      >
        {body}
        <span className="ml-2 text-[11px] text-slate-400">09:41</span>
      </div>
    </div>
  );
}

function AnalyticsPage({
  users,
  listings,
  transactions,
  chartData,
}: {
  users: CrmUserRow[];
  listings: CrmListingRow[];
  transactions: CrmTransactionRow[];
  chartData: {
    daily: ChartPoint[];
    categories: ChartPoint[];
    funnel: ChartPoint[];
    insights: CrmInsight[];
  };
}) {
  const topSellers = users
    .filter(user => user.role === "Seller" || user.role === "Talent")
    .sort((left, right) => right.gmvCents - left.gmvCents)
    .slice(0, 5);
  return (
    <div className="space-y-5">
      <PageHeader
        label="Analytics"
        title="Insight yang bisa langsung dipakai agent."
        body="Bukan cuma angka. Dashboard memberi sinyal seller, kategori, dan listing yang perlu didorong."
      />
      <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
        <ShellCard className="p-5">
          <p className="text-sm font-black text-slate-950">Revenue chart (GMV)</p>
          <div className="mt-4">
            <LineChart data={chartData.daily} />
          </div>
        </ShellCard>
        <ShellCard className="p-5">
          <p className="text-sm font-black text-slate-950">Conversion rate funnel</p>
          <div className="mt-4">
            <FunnelChart data={chartData.funnel} />
          </div>
        </ShellCard>
      </div>
      <div className="grid gap-5 xl:grid-cols-3">
        <ShellCard className="p-5">
          <p className="text-sm font-black text-slate-950">Top sellers</p>
          <div className="mt-4 space-y-3">
            {topSellers.map(user => (
              <InfoRow key={user.id} label={user.name} value={formatCurrency(user.gmvCents)} />
            ))}
          </div>
        </ShellCard>
        <ShellCard className="p-5">
          <p className="text-sm font-black text-slate-950">Top categories</p>
          <div className="mt-4">
            <BarChart data={chartData.categories} />
          </div>
        </ShellCard>
        <ShellCard className="p-5">
          <p className="text-sm font-black text-slate-950">Heatmap lokasi transaksi</p>
          <LocationHeatmap users={users} listings={listings} transactions={transactions} />
        </ShellCard>
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {chartData.insights.map(insight => (
          <ShellCard key={insight.title} className="p-5">
            <Badge tone={insight.tone === "green" ? "success" : insight.tone === "amber" ? "warning" : "blue"}>
              AI Insight
            </Badge>
            <p className="mt-3 text-base font-black text-slate-950">{insight.title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{insight.body}</p>
          </ShellCard>
        ))}
      </div>
    </div>
  );
}

function LocationHeatmap({
  users,
  listings,
  transactions,
}: {
  users: CrmUserRow[];
  listings: CrmListingRow[];
  transactions: CrmTransactionRow[];
}) {
  const cities = new Map<string, number>();
  users.forEach(user => cities.set(user.city, (cities.get(user.city) || 0) + 1));
  listings.forEach(listing => cities.set(listing.location, (cities.get(listing.location) || 0) + 2));
  transactions.forEach(tx => cities.set(tx.serviceType, (cities.get(tx.serviceType) || 0) + 1));
  const top = Array.from(cities.entries()).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (!top.length) {
    return <EmptyState title="Lokasi kosong" body="Heatmap akan muncul setelah ada user, listing, atau transaksi real." />;
  }
  const max = Math.max(...top.map(([, value]) => value), 1);
  return (
    <div className="mt-4 grid grid-cols-2 gap-2">
      {top.map(([city, value]) => (
        <div
          key={city}
          className="rounded-2xl border border-emerald-100 p-3"
          style={{ backgroundColor: `rgba(108, 214, 152, ${0.15 + (value / max) * 0.35})` }}
        >
          <p className="text-xs font-black text-slate-900">{city}</p>
          <p className="mt-1 text-[11px] font-semibold text-slate-600">{value} sinyal</p>
        </div>
      ))}
    </div>
  );
}

function DisputesPage({
  tickets,
  transactions,
  users,
}: {
  tickets: SupportTicket[];
  transactions: CrmTransactionRow[];
  users: CrmUserRow[];
}) {
  const disputes = transactions.filter(tx => tx.status === "disputed" || tx.riskScore >= 70);
  const urgentTickets = tickets.filter(ticket => ticket.priority === "urgent" || ticket.category === "dispute");
  const riskyUsers = users.filter(user => user.risk !== "low");
  return (
    <div className="space-y-5">
      <PageHeader
        label="Disputes"
        title="Antrian kasus yang perlu dicek manusia."
        body="Gabungan dispute transaksi, report support, dan fraud flags agar admin tidak kecolongan."
      />
      <div className="grid gap-5 xl:grid-cols-3">
        <IssueColumn title="Transaksi bermasalah" items={disputes.map(tx => ({
          id: tx.id,
          title: `Transaksi ${compactId(tx.id)}`,
          body: `${statusLabel(tx.status)} - ${formatCurrency(tx.amountCents)}`,
          badge: tx.riskScore >= 70 ? "Risiko Tinggi ⚠️" : "Dispute",
        }))} />
        <IssueColumn title="Report handling" items={urgentTickets.map(ticket => ({
          id: ticket.id,
          title: ticket.subject,
          body: ticket.latest_message || ticket.requester_email,
          badge: ticket.priority === "urgent" ? "Urgent" : "Perlu review",
        }))} />
        <IssueColumn title="Fraud detection flags" items={riskyUsers.map(user => ({
          id: user.id,
          title: user.name,
          body: `${user.role} - ${user.city}`,
          badge: riskLabel(user.risk),
        }))} />
      </div>
    </div>
  );
}

function IssueColumn({
  title,
  items,
}: {
  title: string;
  items: Array<{ id: string; title: string; body: string; badge: string }>;
}) {
  const [selectedIssue, setSelectedIssue] = useState<{
    id: string;
    title: string;
    body: string;
    badge: string;
  } | null>(null);

  return (
    <ShellCard className="p-5">
      <p className="text-sm font-black text-slate-950">{title}</p>
      <div className="mt-4 space-y-3">
        {items.map(item => (
          <div key={item.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-start justify-between gap-3">
              <p className="text-sm font-black text-slate-950">{item.title}</p>
              <Badge tone={item.badge.includes("Tinggi") || item.badge === "Urgent" ? "danger" : "warning"}>{item.badge}</Badge>
            </div>
            <p className="mt-2 text-xs leading-5 text-slate-500">{item.body}</p>
            <button
              type="button"
              onClick={() => setSelectedIssue(item)}
              className="mt-3 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-600 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700"
            >
              Lihat detail
            </button>
          </div>
        ))}
        {!items.length ? <EmptyState title="Aman" body="Belum ada kasus prioritas." /> : null}
      </div>
      {selectedIssue ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-emerald-700">Detail kasus</p>
              <p className="mt-1 text-sm font-black text-slate-950">{selectedIssue.title}</p>
            </div>
            <button
              type="button"
              onClick={() => setSelectedIssue(null)}
              className="rounded-full bg-white px-2.5 py-1 text-xs font-black text-slate-500"
            >
              Tutup
            </button>
          </div>
          <div className="mt-3 grid gap-2 text-xs">
            <InfoRow label="ID sumber" value={selectedIssue.id} />
            <InfoRow label="Status" value={selectedIssue.badge} />
            <InfoRow label="Catatan" value={selectedIssue.body} />
          </div>
          <button
            type="button"
            disabled
            className="mt-4 rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs font-black text-slate-400"
            title="Perlu endpoint resolve/review dari backend"
          >
            Action resolve belum tersambung
          </button>
        </div>
      ) : null}
    </ShellCard>
  );
}

function SettingsPage() {
  const blocks = [
    ["User ban / suspend", "Bekukan akun bermasalah setelah review manual."],
    ["Content moderation", "Atur alasan reject, revisi, dan konten berisiko."],
    ["Report handling", "Kelola kategori laporan dan SLA agent."],
    ["Fraud detection flags", "Atur ambang risiko untuk transaksi besar."],
    ["Role management admin", "Kelola akses sales, support, admin, super admin."],
  ];
  return (
    <div className="space-y-5">
      <PageHeader
        label="Settings"
        title="Pengaturan operasional admin."
        body="Untuk v1, action sensitif ditampilkan jelas. Endpoint role dan suspend bisa disambungkan bertahap."
      />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {blocks.map(([title, body]) => (
          <ShellCard key={title} className="p-5">
            <p className="text-base font-black text-slate-950">{title}</p>
            <p className="mt-2 text-sm leading-6 text-slate-500">{body}</p>
            <button
              type="button"
              disabled
              className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-400"
            >
              Endpoint belum tersedia
            </button>
          </ShellCard>
        ))}
      </div>
    </div>
  );
}

function PageHeader({ label, title, body }: { label: string; title: string; body: string }) {
  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
      <Badge tone="success">{label}</Badge>
      <h1 className="mt-3 text-2xl font-black tracking-[-0.05em] text-slate-950 sm:text-3xl">{title}</h1>
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
              className="bg-transparent text-sm font-black text-slate-900 outline-none"
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
      <p className="max-w-[60%] text-right text-xs font-black text-slate-900">{value}</p>
    </div>
  );
}
