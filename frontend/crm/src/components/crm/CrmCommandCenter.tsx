"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth, useRequireAuth } from "@/context/AuthContext";
import {
  activityApi,
  identityApi,
  leadApi,
  superAppApi,
  supportApi,
  type CrmActivity,
  type CrmLead,
  type IdentityPublicProfile,
  type SupportTicket,
  type SupportTicketDetail,
  type SuperAppCrmApprovalStatus,
  type SuperAppKycStatus,
  type SuperAppOrder,
  type SuperAppOrderDetail,
  type SuperAppTrustProfile,
  type SuperAppTrustTier,
} from "@/lib/api";
import { Button, Card, Input } from "@/ui";

type TabId = "command" | "pipeline" | "support" | "risk";

type LeadDraft = {
  name: string;
  sector: string;
  requester_email: string;
  value_cents: string;
  source: string;
};

type TrustDraft = {
  tier: SuperAppTrustTier;
  kyc_status: SuperAppKycStatus;
  crm_approval_status: SuperAppCrmApprovalStatus;
  marketing_segment: string;
  manual_hold: boolean;
  manual_per_order_cap_cents: string;
  manual_daily_cap_cents: string;
  manual_monthly_cap_cents: string;
  risk_strike_count: string;
};

type SensitiveAction = {
  title: string;
  message: string;
  run: () => Promise<void>;
};

type ActivityAttachment = {
  label: string;
  url: string;
  externalRef: string;
};

type ActivityInsight = {
  transactionId: string;
  amountLabel: string;
  status: string;
  protectionStatus: string;
  attemptNumber: number;
  maxAttempts: number;
  attachmentCount: number;
  attachments: ActivityAttachment[];
  note: string;
  decision: string;
  autoEscalated: boolean;
  kind: "delivery" | "revision" | "accepted" | "dispute" | "generic";
};

const FIELD_CLASS =
  "w-full rounded-2xl border border-[color:color-mix(in_srgb,_var(--color-border)_78%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_88%,_transparent)] px-3 py-2.5 text-sm text-[color:var(--color-text)] outline-none transition focus:border-[color:var(--color-primary-border)] focus:ring-2 focus:ring-[color:color-mix(in_srgb,_var(--color-primary)_30%,_transparent)]";
const BADGE_BASE =
  "inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.18em]";
const LEAD_STAGES = [
  "lead",
  "qualified",
  "negotiation",
  "contract",
  "won",
] as const;
const TICKET_STATUSES = [
  "open",
  "in_progress",
  "pending_customer",
  "resolved",
  "closed",
] as const;
const ORDER_STATUSES = [
  "pending_verification",
  "ready_for_dispatch",
  "dispatching",
  "in_progress",
  "delivered",
  "completed",
  "disputed",
] as const;
const TRUST_TIERS: SuperAppTrustTier[] = [
  "rookie",
  "verified",
  "trusted_pro",
  "elite",
  "influencer",
  "enterprise",
];
const KYC_STATUSES: SuperAppKycStatus[] = ["none", "basic", "full", "enhanced"];
const APPROVAL_STATUSES: SuperAppCrmApprovalStatus[] = [
  "pending",
  "approved",
  "restricted",
  "rejected",
];

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

function formatCurrency(value?: number | null, currency = "IDR"): string {
  const amount = Number.isFinite(value) ? Number(value) : 0;
  const base = amount / 100;
  if (currency.toUpperCase() === "IDR")
    return `Rp ${base.toLocaleString("id-ID")}`;
  return `${currency.toUpperCase()} ${base.toLocaleString("id-ID")}`;
}

function compactNumber(value: number): string {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}jt`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}rb`;
  return `${value}`;
}

function toRiskFlags(value: unknown): string[] {
  if (Array.isArray(value))
    return value.map((item) => String(item).trim()).filter(Boolean);
  if (value && typeof value === "object") {
    return Object.entries(value as Record<string, unknown>)
      .filter(([, active]) => Boolean(active))
      .map(([key]) => key.replaceAll("_", " "));
  }
  return [];
}

function metadataEntries(value: Record<string, unknown> | null | undefined) {
  return Object.entries(value || {})
    .slice(0, 8)
    .map(([key, raw]) => ({
      key,
      value:
        typeof raw === "string"
          ? raw
          : raw === null
            ? "null"
            : Array.isArray(raw)
              ? raw.map((item) => String(item)).join(", ")
              : JSON.stringify(raw),
    }))
    .filter((item) => item.value);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function asPositiveInt(value: unknown): number {
  const numeric =
    typeof value === "number" && Number.isFinite(value)
      ? value
      : Number(String(value ?? "").trim());
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return Math.floor(numeric);
}

function asBoolean(value: unknown): boolean {
  return value === true;
}

function compactId(value: string): string {
  if (!value) return "-";
  if (value.length <= 16) return value;
  return `${value.slice(0, 8)}...${value.slice(-4)}`;
}

function parseActivityAttachments(value: unknown): ActivityAttachment[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const record = asRecord(entry);
      const label = asString(record.label);
      const url = asString(record.url);
      const externalRef = asString(record.external_ref || record.externalRef);
      if (!label && !url && !externalRef) return null;
      return { label, url, externalRef };
    })
    .filter((item): item is ActivityAttachment => Boolean(item));
}

function parseActivityInsight(activity: CrmActivity): ActivityInsight | null {
  const metadata = asRecord(activity.metadata);
  const statusContext = asRecord(metadata.status_context);
  const delivery = asRecord(statusContext.delivery);
  const deliveryReview = asRecord(statusContext.delivery_review);
  const deliveryAttachments = parseActivityAttachments(delivery.attachments);
  const reviewAttachments = parseActivityAttachments(
    deliveryReview.attachments,
  );
  const disputeAttachments = parseActivityAttachments(
    metadata.evidence_attachments,
  );
  const attachments =
    deliveryAttachments.length > 0
      ? deliveryAttachments
      : reviewAttachments.length > 0
        ? reviewAttachments
        : disputeAttachments;
  const transactionId = asString(metadata.transaction_id);
  if (!transactionId && !activity.action.startsWith("transaction.")) {
    return null;
  }

  const attemptNumber = asPositiveInt(
    delivery.attempt_number || deliveryReview.attempt_number,
  );
  const maxAttempts =
    asPositiveInt(delivery.max_attempts || deliveryReview.max_attempts) || 3;
  const decision = asString(deliveryReview.decision);
  const autoEscalated = asBoolean(deliveryReview.auto_escalated);
  let kind: ActivityInsight["kind"] = "generic";
  if (activity.action === "transaction.delivered") kind = "delivery";
  else if (
    activity.action === "transaction.in_progress" &&
    decision === "request_revision"
  ) {
    kind = "revision";
  } else if (
    activity.action === "transaction.completed" &&
    decision === "accept"
  ) {
    kind = "accepted";
  } else if (activity.action === "transaction.disputed" && autoEscalated) {
    kind = "dispute";
  }

  return {
    transactionId,
    amountLabel: formatCurrency(
      asPositiveInt(metadata.amount_cents),
      asString(metadata.currency) || "IDR",
    ),
    status: asString(metadata.status),
    protectionStatus: asString(metadata.protection_status),
    attemptNumber,
    maxAttempts,
    attachmentCount:
      asPositiveInt(
        delivery.attachments_count || deliveryReview.attachments_count,
      ) || attachments.length,
    attachments,
    note:
      asString(delivery.note) ||
      asString(deliveryReview.note) ||
      asString(metadata.evidence_note) ||
      asString(metadata.response_message),
    decision,
    autoEscalated,
    kind,
  };
}

function activityKindLabel(insight: ActivityInsight) {
  switch (insight.kind) {
    case "delivery":
      return "Seller kirim hasil";
    case "revision":
      return "Buyer minta revisi";
    case "accepted":
      return "Buyer terima hasil";
    case "dispute":
      return "Auto-escalate dispute";
    default:
      return "Update transaksi";
  }
}

function activityKindTone(
  insight: ActivityInsight,
): "default" | "risk" | "success" | "warning" {
  switch (insight.kind) {
    case "delivery":
      return "success";
    case "revision":
      return "warning";
    case "accepted":
      return "success";
    case "dispute":
      return "risk";
    default:
      return "default";
  }
}

function actorRoleLabel(value: string) {
  switch (value) {
    case "seller":
      return "Seller";
    case "buyer":
      return "Buyer";
    case "system":
      return "System";
    default:
      return value || "CRM";
  }
}

function getLeadUserId(lead: CrmLead | null | undefined) {
  return lead?.requester_user_id || lead?.contact_user_id || null;
}

function sourceLabel(source?: string | null) {
  const normalized = String(source || "").toLowerCase();
  if (normalized.includes("chat")) return "Chat intent";
  if (normalized.includes("order")) return "Transaction";
  if (normalized.includes("listing") || normalized.includes("content"))
    return "Listing";
  if (normalized.includes("support")) return "Support";
  if (normalized.includes("manual")) return "Manual CRM";
  return source || "Unknown";
}

function pillTone(
  value: string,
  type: "default" | "risk" | "success" | "warning" = "default",
) {
  if (
    type === "success" ||
    ["won", "approved", "completed", "resolved", "verified"].includes(value)
  ) {
    return `${BADGE_BASE} border-[color:var(--color-primary-border)] bg-[color:var(--color-primary-soft)] text-[color:var(--color-primary)]`;
  }
  if (
    type === "risk" ||
    ["disputed", "restricted", "rejected", "urgent", "manual_hold"].includes(
      value,
    )
  ) {
    return `${BADGE_BASE} border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-soft)] text-[color:var(--color-danger)]`;
  }
  if (
    type === "warning" ||
    [
      "pending",
      "pending_verification",
      "in_progress",
      "qualified",
      "negotiation",
      "contract",
    ].includes(value)
  ) {
    return `${BADGE_BASE} border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-soft)] text-[color:var(--color-warning)]`;
  }
  return `${BADGE_BASE} border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_82%,_transparent)] text-[color:var(--color-text)]`;
}

function defaultLeadDraft(): LeadDraft {
  return {
    name: "",
    sector: "general",
    requester_email: "",
    value_cents: "",
    source: "crm_manual",
  };
}

function normalizeKycStatus(value?: string | null): SuperAppKycStatus {
  return KYC_STATUSES.includes((value || "none") as SuperAppKycStatus)
    ? (value as SuperAppKycStatus)
    : "none";
}

function trustToDraft(
  profile: SuperAppTrustProfile | null,
  identity: IdentityPublicProfile | null,
): TrustDraft {
  if (profile) {
    return {
      tier: profile.tier,
      kyc_status: profile.kyc_status,
      crm_approval_status: profile.crm_approval_status,
      marketing_segment: profile.marketing_segment || "general",
      manual_hold: Boolean(profile.manual_hold),
      manual_per_order_cap_cents:
        profile.manual_per_order_cap_cents === null
          ? ""
          : String(profile.manual_per_order_cap_cents),
      manual_daily_cap_cents:
        profile.manual_daily_cap_cents === null
          ? ""
          : String(profile.manual_daily_cap_cents),
      manual_monthly_cap_cents:
        profile.manual_monthly_cap_cents === null
          ? ""
          : String(profile.manual_monthly_cap_cents),
      risk_strike_count: String(profile.risk_strike_count ?? 0),
    };
  }
  return {
    tier: identity?.identity_verified ? "verified" : "rookie",
    kyc_status: normalizeKycStatus(identity?.kyc_status),
    crm_approval_status: "pending",
    marketing_segment: "general",
    manual_hold: false,
    manual_per_order_cap_cents: "",
    manual_daily_cap_cents: "",
    manual_monthly_cap_cents: "",
    risk_strike_count: "0",
  };
}

function parseOptionalInt(value: string): number | null {
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed) || parsed < 0) return null;
  return parsed;
}

function buildRiskReasons(
  order: SuperAppOrder | null,
  profile: SuperAppTrustProfile | null,
  identity: IdentityPublicProfile | null,
) {
  const reasons = new Set<string>();
  for (const flag of toRiskFlags(order?.risk_flags)) reasons.add(flag);
  if ((order?.risk_score || 0) >= 70) reasons.add("risk score tinggi");
  if (order?.status === "pending_verification")
    reasons.add("butuh verifikasi manual");
  if (profile?.manual_hold) reasons.add("manual hold aktif");
  if ((profile?.risk_strike_count || 0) > 0) reasons.add("punya strike risiko");
  if (profile?.crm_approval_status === "restricted")
    reasons.add("trust dibatasi CRM");
  if (identity && !identity.identity_verified)
    reasons.add("KTP / liveness belum lengkap");
  return [...reasons];
}

function MetricCard(props: { label: string; value: string; note: string }) {
  return (
    <Card className="rounded-[28px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-text)]">
        {props.label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-[color:var(--color-text)]">
        {props.value}
      </p>
      <p className="mt-2 text-sm text-[color:var(--color-text)]">
        {props.note}
      </p>
    </Card>
  );
}

function IdentitySnapshotCard({
  identity,
  loading,
}: {
  identity: IdentityPublicProfile | null;
  loading: boolean;
}) {
  const flags = [
    { label: "Email", value: identity?.email_verified },
    { label: "Phone", value: identity?.phone_verified },
    { label: "KTP", value: identity?.document_verified },
    { label: "Liveness", value: identity?.liveness_verified },
    { label: "Eligible", value: identity?.transaction_eligible },
  ];

  return (
    <Card className="rounded-[28px]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
            Identity Snapshot
          </p>
          <h3 className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">
            {identity?.full_name ||
              identity?.username ||
              "Belum ada user terpilih"}
          </h3>
          <p className="mt-1 text-sm text-[color:var(--color-text)]">
            {loading
              ? "Memuat profil identity..."
              : identity?.headline ||
                identity?.bio ||
                "Gunakan data ini untuk validasi transaksi dan trust."}
          </p>
        </div>
        <span
          className={pillTone(
            identity?.kyc_status || "none",
            identity?.identity_verified ? "success" : "warning",
          )}
        >
          {identity?.kyc_status || "none"}
        </span>
      </div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        {flags.map((flag) => (
          <div
            key={flag.label}
            className="rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_78%,_transparent)] px-3 py-3"
          >
            <p className="text-xs text-[color:var(--color-text)]">
              {flag.label}
            </p>
            <p className="mt-1 text-sm font-semibold text-[color:var(--color-text)]">
              {flag.value ? "Verified" : "Pending"}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CrmActivityCard({ activity }: { activity: CrmActivity }) {
  const insight = parseActivityInsight(activity);
  const fallbackMetadata = metadataEntries(activity.metadata).slice(0, 4);
  const attemptProgress =
    insight && insight.attemptNumber > 0
      ? Math.max(
          12,
          Math.round((insight.attemptNumber / insight.maxAttempts) * 100),
        )
      : 0;

  return (
    <div className="rounded-[24px] border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface)_84%,_transparent)] px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap gap-2">
            {insight ? (
              <span
                className={pillTone(
                  activityKindLabel(insight),
                  activityKindTone(insight),
                )}
              >
                {activityKindLabel(insight)}
              </span>
            ) : null}
            <span className={pillTone(activity.actor_role || "crm")}>
              {actorRoleLabel(activity.actor_role)}
            </span>
            {insight?.transactionId ? (
              <span className={pillTone("transaction")}>
                TXN {compactId(insight.transactionId)}
              </span>
            ) : null}
            {insight?.attemptNumber ? (
              <span className={pillTone(`attempt-${insight.attemptNumber}`)}>
                Attempt {insight.attemptNumber}/{insight.maxAttempts}
              </span>
            ) : null}
            {insight?.decision === "accept" ? (
              <span className={pillTone("accept", "success")}>Accepted</span>
            ) : null}
            {insight?.decision === "request_revision" ? (
              <span className={pillTone("revision", "warning")}>
                Revision requested
              </span>
            ) : null}
            {insight?.autoEscalated ? (
              <span className={pillTone("auto_dispute", "risk")}>
                Needs support review
              </span>
            ) : null}
          </div>
          <p className="mt-3 text-sm font-semibold text-[color:var(--color-text)]">
            {activity.message || activity.action}
          </p>
        </div>
        <p className="text-xs text-[color:var(--color-text)]">
          {formatDate(activity.created_at)}
        </p>
      </div>

      {insight ? (
        <>
          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_76%,_transparent)] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text)]">
                Amount
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--color-text)]">
                {insight.amountLabel}
              </p>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_76%,_transparent)] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text)]">
                Status
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <span
                  className={pillTone(
                    insight.status || "unknown",
                    insight.status === "completed"
                      ? "success"
                      : insight.status === "disputed"
                        ? "risk"
                        : "warning",
                  )}
                >
                  {insight.status || "unknown"}
                </span>
                {insight.protectionStatus ? (
                  <span className={pillTone(insight.protectionStatus)}>
                    {insight.protectionStatus}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_76%,_transparent)] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text)]">
                Bukti
              </p>
              <p className="mt-1 text-sm font-semibold text-[color:var(--color-text)]">
                {insight.attachmentCount} item
              </p>
            </div>
          </div>

          {insight.attemptNumber ? (
            <div className="mt-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_70%,_transparent)] px-3 py-3">
              <div className="flex items-center justify-between gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text)]">
                <span>Progress attempt</span>
                <span>
                  {insight.attemptNumber}/{insight.maxAttempts}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-[color:color-mix(in_srgb,_var(--color-border)_74%,_transparent)]">
                <div
                  className="h-2 rounded-full bg-[color:var(--color-primary)]"
                  style={{ width: `${attemptProgress}%` }}
                />
              </div>
            </div>
          ) : null}

          {insight.note ? (
            <div className="mt-3 rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_70%,_transparent)] px-3 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text)]">
                {insight.kind === "delivery"
                  ? "Catatan seller"
                  : insight.kind === "revision" ||
                      insight.kind === "accepted" ||
                      insight.kind === "dispute"
                    ? "Feedback buyer"
                    : "Catatan"}
              </p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-[color:var(--color-text)]">
                {insight.note}
              </p>
            </div>
          ) : null}

          {insight.attachments.length ? (
            <div className="mt-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text)]">
                Bukti & referensi
              </p>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {insight.attachments.slice(0, 4).map((attachment, index) => {
                  const label =
                    attachment.label ||
                    attachment.url ||
                    attachment.externalRef ||
                    `Bukti ${index + 1}`;
                  const body = attachment.url || attachment.externalRef;
                  return attachment.url ? (
                    <a
                      key={`${label}-${index}`}
                      href={attachment.url}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_76%,_transparent)] px-3 py-3 text-sm text-[color:var(--color-text)] transition hover:border-[color:var(--color-primary-border)] hover:text-[color:var(--color-primary)]"
                    >
                      <p className="font-semibold">{label}</p>
                      <p className="mt-1 break-all text-xs">{body}</p>
                    </a>
                  ) : (
                    <div
                      key={`${label}-${index}`}
                      className="rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_76%,_transparent)] px-3 py-3 text-sm text-[color:var(--color-text)]"
                    >
                      <p className="font-semibold">{label}</p>
                      <p className="mt-1 break-all text-xs">{body}</p>
                    </div>
                  );
                })}
                {insight.attachmentCount > insight.attachments.length ? (
                  <div className="rounded-2xl border border-dashed border-[color:var(--color-border)] px-3 py-3 text-xs text-[color:var(--color-text)]">
                    +{insight.attachmentCount - insight.attachments.length}{" "}
                    bukti lain tersimpan di activity ini.
                  </div>
                ) : null}
              </div>
            </div>
          ) : null}
        </>
      ) : fallbackMetadata.length ? (
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          {fallbackMetadata.map((item) => (
            <div
              key={item.key}
              className="rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_76%,_transparent)] px-3 py-3"
            >
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--color-text)]">
                {item.key.replaceAll("_", " ")}
              </p>
              <p className="mt-1 break-all text-sm text-[color:var(--color-text)]">
                {item.value}
              </p>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function StepUpDialog(props: {
  open: boolean;
  title: string;
  message: string;
  error: string;
  notice: string;
  devOtp: string;
  otp: string;
  onOtpChange: (value: string) => void;
  onClose: () => void;
  onSubmit: () => void;
  busy: boolean;
}) {
  if (!props.open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:color-mix(in_srgb,_black_48%,_transparent)] p-4">
      <Card className="max-h-[80svh] w-full max-w-md overflow-y-auto rounded-[32px]">
        <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
          Step-up Verification
        </p>
        <h2 className="mt-2 text-2xl font-semibold text-[color:var(--color-text)]">
          {props.title}
        </h2>
        <p className="mt-3 text-sm text-[color:var(--color-text)]">
          {props.message}
        </p>
        {props.notice ? (
          <div className="mt-4 rounded-2xl border border-[color:var(--color-primary-border)] bg-[color:var(--color-primary-soft)] px-4 py-3 text-sm text-[color:var(--color-primary)]">
            {props.notice}
          </div>
        ) : null}
        {props.error ? (
          <div className="mt-4 rounded-2xl border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-soft)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
            {props.error}
          </div>
        ) : null}
        {props.devOtp ? (
          <div className="mt-4 rounded-2xl border border-[color:var(--color-warning-border)] bg-[color:var(--color-warning-soft)] px-4 py-3 text-sm text-[color:var(--color-warning)]">
            Dev OTP:{" "}
            <span className="font-semibold tracking-[0.28em]">
              {props.devOtp}
            </span>
          </div>
        ) : null}
        <div className="mt-5">
          <Input
            label="OTP"
            inputMode="numeric"
            value={props.otp}
            onChange={(event) =>
              props.onOtpChange(
                event.target.value.replace(/\D/g, "").slice(0, 6),
              )
            }
            placeholder="000000"
          />
        </div>
        <div className="mt-6 flex gap-3">
          <Button
            variant="secondary"
            className="flex-1"
            onClick={props.onClose}
            disabled={props.busy}
          >
            Nanti
          </Button>
          <Button
            className="flex-1"
            onClick={props.onSubmit}
            disabled={props.busy}
          >
            {props.busy ? "Memverifikasi..." : "Verifikasi"}
          </Button>
        </div>
      </Card>
    </div>
  );
}

export default function CrmCommandCenter() {
  const { isAuthenticated, loading: authLoading } = useRequireAuth();
  const {
    accessToken,
    isStepUpFresh,
    logout,
    requestStepUp,
    stepUpVerifiedAt,
    user,
    verifyStepUp,
  } = useAuth();

  const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || "http://localhost:3000";
  const pendingSensitiveAction = useRef<SensitiveAction | null>(null);
  const [tab, setTab] = useState<TabId>("command");
  const [refreshing, setRefreshing] = useState(false);
  const [bootLoading, setBootLoading] = useState(true);
  const [bootError, setBootError] = useState("");
  const [leads, setLeads] = useState<CrmLead[]>([]);
  const [activities, setActivities] = useState<CrmActivity[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [trustProfiles, setTrustProfiles] = useState<SuperAppTrustProfile[]>(
    [],
  );
  const [orders, setOrders] = useState<SuperAppOrder[]>([]);
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(null);
  const [selectedTicketId, setSelectedTicketId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [ticketDetail, setTicketDetail] = useState<SupportTicketDetail | null>(
    null,
  );
  const [orderDetail, setOrderDetail] = useState<SuperAppOrderDetail | null>(
    null,
  );
  const [leadIdentity, setLeadIdentity] =
    useState<IdentityPublicProfile | null>(null);
  const [supportIdentity, setSupportIdentity] =
    useState<IdentityPublicProfile | null>(null);
  const [riskIdentity, setRiskIdentity] =
    useState<IdentityPublicProfile | null>(null);
  const [leadIdentityLoading, setLeadIdentityLoading] = useState(false);
  const [supportIdentityLoading, setSupportIdentityLoading] = useState(false);
  const [riskIdentityLoading, setRiskIdentityLoading] = useState(false);
  const [leadDraft, setLeadDraft] = useState<LeadDraft>(defaultLeadDraft);
  const [leadBusy, setLeadBusy] = useState(false);
  const [leadNotice, setLeadNotice] = useState("");
  const [leadError, setLeadError] = useState("");
  const [supportFilter, setSupportFilter] = useState<
    "open" | "mine" | "urgent" | "all"
  >("open");
  const [ticketStatusDraft, setTicketStatusDraft] = useState("open");
  const [replyDraft, setReplyDraft] = useState("");
  const [replyInternal, setReplyInternal] = useState(false);
  const [supportBusy, setSupportBusy] = useState(false);
  const [supportError, setSupportError] = useState("");
  const [supportNotice, setSupportNotice] = useState("");
  const [aiDraftBusy, setAiDraftBusy] = useState(false);
  const [riskStatusDraft, setRiskStatusDraft] = useState(
    "pending_verification",
  );
  const [riskNoteDraft, setRiskNoteDraft] = useState("");
  const [trustProfile, setTrustProfile] = useState<SuperAppTrustProfile | null>(
    null,
  );
  const [trustDraft, setTrustDraft] = useState<TrustDraft>(() =>
    trustToDraft(null, null),
  );
  const [riskBusy, setRiskBusy] = useState(false);
  const [riskError, setRiskError] = useState("");
  const [riskNotice, setRiskNotice] = useState("");
  const [stepUpOpen, setStepUpOpen] = useState(false);
  const [stepUpTitle, setStepUpTitle] = useState("");
  const [stepUpMessage, setStepUpMessage] = useState("");
  const [stepUpNotice, setStepUpNotice] = useState("");
  const [stepUpError, setStepUpError] = useState("");
  const [stepUpDevOtp, setStepUpDevOtp] = useState("");
  const [stepUpOtp, setStepUpOtp] = useState("");
  const [stepUpBusy, setStepUpBusy] = useState(false);

  const refreshCollections = useCallback(async () => {
    if (!accessToken) return;
    const [leadRes, activityRes, ticketRes, trustRes, orderRes] =
      await Promise.allSettled([
        leadApi.list(accessToken, { limit: "80" }),
        activityApi.list(accessToken, { limit: "12" }),
        supportApi.list(accessToken, { limit: "80" }),
        superAppApi.listTrustProfiles(accessToken, { limit: "80" }),
        superAppApi.listOrders(accessToken, { limit: "80" }),
      ]);

    if (leadRes.status === "fulfilled") {
      const next = Array.isArray(leadRes.value.items)
        ? leadRes.value.items
        : [];
      setLeads(next);
      setSelectedLeadId((current) => current || next[0]?.id || null);
    }
    if (activityRes.status === "fulfilled") {
      setActivities(
        Array.isArray(activityRes.value.items) ? activityRes.value.items : [],
      );
    }
    if (ticketRes.status === "fulfilled") {
      const next = Array.isArray(ticketRes.value.items)
        ? ticketRes.value.items
        : [];
      setTickets(next);
      setSelectedTicketId((current) => current || next[0]?.id || null);
    }
    if (trustRes.status === "fulfilled") {
      setTrustProfiles(
        Array.isArray(trustRes.value.items) ? trustRes.value.items : [],
      );
    }
    if (orderRes.status === "fulfilled") {
      const next = Array.isArray(orderRes.value.items)
        ? orderRes.value.items
        : [];
      setOrders(next);
      setSelectedOrderId((current) => current || next[0]?.id || null);
    }

    const failures = [
      leadRes,
      activityRes,
      ticketRes,
      trustRes,
      orderRes,
    ].filter(
      (result) => result.status === "rejected",
    ) as PromiseRejectedResult[];
    if (failures.length) {
      throw new Error(
        failures[0]?.reason instanceof Error
          ? failures[0].reason.message
          : "CRM gagal memuat sebagian data.",
      );
    }
  }, [accessToken]);

  const bootDashboard = useCallback(async () => {
    if (!accessToken) return;
    setBootLoading(true);
    setBootError("");
    try {
      await refreshCollections();
    } catch (error) {
      setBootError(
        error instanceof Error ? error.message : "CRM gagal dimuat.",
      );
    } finally {
      setBootLoading(false);
    }
  }, [accessToken, refreshCollections]);

  useEffect(() => {
    void bootDashboard();
  }, [bootDashboard]);

  const loadIdentity = useCallback(
    async (
      userId: string | null,
      setter: React.Dispatch<
        React.SetStateAction<IdentityPublicProfile | null>
      >,
      setLoading: React.Dispatch<React.SetStateAction<boolean>>,
    ) => {
      if (!userId) {
        setter(null);
        return;
      }
      setLoading(true);
      try {
        setter(await identityApi.getPublicProfile(userId));
      } catch {
        setter(null);
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  const selectedLead = useMemo(
    () => leads.find((lead) => lead.id === selectedLeadId) || null,
    [leads, selectedLeadId],
  );
  const filteredTickets = useMemo(() => {
    if (supportFilter === "all") return tickets;
    if (supportFilter === "mine") {
      return tickets.filter((ticket) => ticket.assigned_agent_id === user?.id);
    }
    if (supportFilter === "urgent") {
      return tickets.filter(
        (ticket) => ticket.priority === "urgent" || ticket.priority === "high",
      );
    }
    return tickets.filter(
      (ticket) =>
        ticket.status === "open" ||
        ticket.status === "in_progress" ||
        ticket.status === "pending_customer",
    );
  }, [supportFilter, tickets, user?.id]);
  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) || null,
    [selectedTicketId, tickets],
  );
  const riskQueue = useMemo(
    () =>
      orders.filter((order) => {
        const flags = toRiskFlags(order.risk_flags);
        return (
          order.status === "pending_verification" ||
          order.status === "disputed" ||
          order.risk_score >= 70 ||
          flags.length > 0
        );
      }),
    [orders],
  );
  const selectedOrder = useMemo(
    () =>
      orders.find((order) => order.id === selectedOrderId) ||
      riskQueue[0] ||
      null,
    [orders, riskQueue, selectedOrderId],
  );

  useEffect(() => {
    void loadIdentity(
      getLeadUserId(selectedLead),
      setLeadIdentity,
      setLeadIdentityLoading,
    );
  }, [loadIdentity, selectedLead]);

  useEffect(() => {
    void loadIdentity(
      selectedTicket?.requester_user_id || null,
      setSupportIdentity,
      setSupportIdentityLoading,
    );
  }, [loadIdentity, selectedTicket?.requester_user_id]);

  useEffect(() => {
    void loadIdentity(
      selectedOrder?.requester_id || null,
      setRiskIdentity,
      setRiskIdentityLoading,
    );
  }, [loadIdentity, selectedOrder?.requester_id]);

  useEffect(() => {
    if (!accessToken || !selectedTicketId) {
      setTicketDetail(null);
      return;
    }
    void (async () => {
      try {
        const detail = await supportApi.get(accessToken, selectedTicketId);
        setTicketDetail(detail);
        setTicketStatusDraft(detail.ticket.status);
      } catch (error) {
        setSupportError(
          error instanceof Error
            ? error.message
            : "Gagal memuat detail ticket.",
        );
      }
    })();
  }, [accessToken, selectedTicketId]);

  useEffect(() => {
    if (!accessToken || !selectedOrder?.id) {
      setOrderDetail(null);
      return;
    }
    void (async () => {
      try {
        const detail = await superAppApi.getOrder(
          accessToken,
          selectedOrder.id,
        );
        setOrderDetail(detail);
        setRiskStatusDraft(detail.order.status);
      } catch (error) {
        setRiskError(
          error instanceof Error ? error.message : "Gagal memuat detail order.",
        );
      }
    })();
  }, [accessToken, selectedOrder?.id]);

  useEffect(() => {
    if (!accessToken || !selectedOrder?.requester_id) {
      setTrustProfile(null);
      setTrustDraft(trustToDraft(null, riskIdentity));
      return;
    }
    void (async () => {
      try {
        const response = await superAppApi.getTrustProfile(
          accessToken,
          selectedOrder.requester_id,
        );
        setTrustProfile(response.profile);
        setTrustDraft(trustToDraft(response.profile, riskIdentity));
      } catch {
        const local =
          trustProfiles.find(
            (profile) => profile.user_id === selectedOrder.requester_id,
          ) || null;
        setTrustProfile(local);
        setTrustDraft(trustToDraft(local, riskIdentity));
      }
    })();
  }, [accessToken, riskIdentity, selectedOrder?.requester_id, trustProfiles]);

  const runRefresh = useCallback(async () => {
    if (!accessToken) return;
    setRefreshing(true);
    try {
      await refreshCollections();
      if (selectedTicketId) {
        const detail = await supportApi.get(accessToken, selectedTicketId);
        setTicketDetail(detail);
        setTicketStatusDraft(detail.ticket.status);
      }
      if (selectedOrder?.id) {
        const detail = await superAppApi.getOrder(
          accessToken,
          selectedOrder.id,
        );
        setOrderDetail(detail);
        setRiskStatusDraft(detail.order.status);
      }
    } catch (error) {
      setBootError(
        error instanceof Error ? error.message : "Refresh CRM gagal.",
      );
    } finally {
      setRefreshing(false);
    }
  }, [accessToken, refreshCollections, selectedOrder?.id, selectedTicketId]);

  const openStepUp = useCallback(
    async (action: SensitiveAction) => {
      if (isStepUpFresh()) {
        await action.run();
        return;
      }
      pendingSensitiveAction.current = action;
      setStepUpTitle(action.title);
      setStepUpMessage(action.message);
      setStepUpError("");
      setStepUpNotice("");
      setStepUpDevOtp("");
      setStepUpOtp("");
      setStepUpOpen(true);
      try {
        const response = await requestStepUp();
        setStepUpNotice(response?.message || "OTP dikirim ke email CRM Anda.");
        setStepUpDevOtp(response?.devOtp || "");
      } catch (error) {
        setStepUpError(
          error instanceof Error
            ? error.message
            : "Gagal mengirim OTP step-up.",
        );
      }
    },
    [isStepUpFresh, requestStepUp],
  );

  const submitStepUp = useCallback(async () => {
    if (!stepUpOtp.trim()) {
      setStepUpError("Masukkan OTP terlebih dulu.");
      return;
    }
    setStepUpBusy(true);
    setStepUpError("");
    try {
      await verifyStepUp(stepUpOtp.trim());
      const action = pendingSensitiveAction.current;
      pendingSensitiveAction.current = null;
      setStepUpOpen(false);
      setStepUpOtp("");
      if (action) await action.run();
    } catch (error) {
      setStepUpError(
        error instanceof Error ? error.message : "OTP tidak valid.",
      );
    } finally {
      setStepUpBusy(false);
    }
  }, [stepUpOtp, verifyStepUp]);

  const createLead = useCallback(async () => {
    if (!accessToken) return;
    if (!leadDraft.name.trim() || !leadDraft.requester_email.trim()) {
      setLeadError("Nama lead dan email requester wajib diisi.");
      return;
    }
    setLeadBusy(true);
    setLeadError("");
    setLeadNotice("");
    try {
      const response = await leadApi.create(accessToken, {
        name: leadDraft.name.trim(),
        sector: leadDraft.sector.trim() || "general",
        requester_email: leadDraft.requester_email.trim().toLowerCase(),
        source: leadDraft.source.trim() || "crm_manual",
        stage: "lead",
        value_cents: parseOptionalInt(leadDraft.value_cents) ?? 0,
        currency: "IDR",
      });
      await refreshCollections();
      setSelectedLeadId(response.lead.id);
      setLeadDraft(defaultLeadDraft());
      setLeadNotice("Lead baru masuk ke pipeline CRM.");
      setTab("pipeline");
    } catch (error) {
      setLeadError(
        error instanceof Error ? error.message : "Gagal membuat lead.",
      );
    } finally {
      setLeadBusy(false);
    }
  }, [accessToken, leadDraft, refreshCollections]);

  const updateLead = useCallback(
    async (data: Record<string, unknown>, notice: string) => {
      if (!accessToken || !selectedLeadId) return;
      setLeadBusy(true);
      setLeadError("");
      setLeadNotice("");
      try {
        await leadApi.update(accessToken, selectedLeadId, data);
        await refreshCollections();
        setLeadNotice(notice);
      } catch (error) {
        setLeadError(
          error instanceof Error ? error.message : "Gagal memperbarui lead.",
        );
      } finally {
        setLeadBusy(false);
      }
    },
    [accessToken, refreshCollections, selectedLeadId],
  );

  const sendReply = useCallback(async () => {
    if (!accessToken || !selectedTicketId || !replyDraft.trim()) return;
    setSupportBusy(true);
    setSupportError("");
    setSupportNotice("");
    try {
      await supportApi.reply(accessToken, selectedTicketId, {
        body: replyDraft.trim(),
        is_internal: replyInternal,
      });
      const detail = await supportApi.get(accessToken, selectedTicketId);
      setTicketDetail(detail);
      setReplyDraft("");
      setReplyInternal(false);
      await refreshCollections();
      setSupportNotice(
        replyInternal
          ? "Internal note tersimpan."
          : "Balasan terkirim ke user.",
      );
    } catch (error) {
      setSupportError(
        error instanceof Error ? error.message : "Gagal mengirim balasan.",
      );
    } finally {
      setSupportBusy(false);
    }
  }, [
    accessToken,
    refreshCollections,
    replyDraft,
    replyInternal,
    selectedTicketId,
  ]);

  const generateAiDraft = useCallback(async () => {
    if (!ticketDetail) return;
    setAiDraftBusy(true);
    setSupportError("");
    try {
      const response = await fetch("/api/ai/support-reply", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ticket: ticketDetail.ticket,
          replies: ticketDetail.replies,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        reply?: string;
        error?: string;
      };
      if (!response.ok) {
        throw new Error(payload.error || "AI gagal membuat draft.");
      }
      setReplyDraft(String(payload.reply || ""));
    } catch (error) {
      setSupportError(
        error instanceof Error ? error.message : "AI gagal membuat draft.",
      );
    } finally {
      setAiDraftBusy(false);
    }
  }, [ticketDetail]);

  const updateTicket = useCallback(
    async (data: Record<string, unknown>, notice: string) => {
      if (!accessToken || !selectedTicketId) return;
      setSupportBusy(true);
      setSupportError("");
      setSupportNotice("");
      try {
        await supportApi.update(accessToken, selectedTicketId, data);
        const detail = await supportApi.get(accessToken, selectedTicketId);
        setTicketDetail(detail);
        setTicketStatusDraft(detail.ticket.status);
        await refreshCollections();
        setSupportNotice(notice);
      } catch (error) {
        setSupportError(
          error instanceof Error ? error.message : "Gagal update ticket.",
        );
      } finally {
        setSupportBusy(false);
      }
    },
    [accessToken, refreshCollections, selectedTicketId],
  );

  const saveTrust = useCallback(async () => {
    if (!accessToken || !selectedOrder?.requester_id) return;
    setRiskBusy(true);
    setRiskError("");
    setRiskNotice("");
    try {
      const response = await superAppApi.upsertTrustProfile(
        accessToken,
        selectedOrder.requester_id,
        {
          tier: trustDraft.tier,
          kyc_status: trustDraft.kyc_status,
          crm_approval_status: trustDraft.crm_approval_status,
          marketing_segment: trustDraft.marketing_segment.trim() || "general",
          manual_hold: trustDraft.manual_hold,
          manual_per_order_cap_cents: parseOptionalInt(
            trustDraft.manual_per_order_cap_cents,
          ),
          manual_daily_cap_cents: parseOptionalInt(
            trustDraft.manual_daily_cap_cents,
          ),
          manual_monthly_cap_cents: parseOptionalInt(
            trustDraft.manual_monthly_cap_cents,
          ),
          risk_strike_count:
            parseOptionalInt(trustDraft.risk_strike_count) ?? 0,
          metadata: {
            crm_last_editor: user?.id || null,
            crm_last_updated_at: new Date().toISOString(),
          },
        },
      );
      setTrustProfile(response.profile);
      setTrustDraft(trustToDraft(response.profile, riskIdentity));
      await refreshCollections();
      setRiskNotice("Trust profile berhasil disimpan.");
    } catch (error) {
      setRiskError(
        error instanceof Error
          ? error.message
          : "Gagal menyimpan trust profile.",
      );
    } finally {
      setRiskBusy(false);
    }
  }, [
    accessToken,
    refreshCollections,
    riskIdentity,
    selectedOrder?.requester_id,
    trustDraft,
    user?.id,
  ]);

  const updateRiskOrder = useCallback(async () => {
    if (!accessToken || !selectedOrder?.id) return;
    setRiskBusy(true);
    setRiskError("");
    setRiskNotice("");
    try {
      await superAppApi.updateOrder(accessToken, selectedOrder.id, {
        status: riskStatusDraft,
        note: riskNoteDraft.trim() || undefined,
        event_type: "crm.risk.status_update",
        metadata: {
          crm_actor_id: user?.id || null,
          crm_step_up_at: new Date().toISOString(),
        },
      });
      const detail = await superAppApi.getOrder(accessToken, selectedOrder.id);
      setOrderDetail(detail);
      await refreshCollections();
      setRiskNoteDraft("");
      setRiskNotice("Status order berhasil diperbarui.");
    } catch (error) {
      setRiskError(
        error instanceof Error ? error.message : "Gagal mengubah status order.",
      );
    } finally {
      setRiskBusy(false);
    }
  }, [
    accessToken,
    refreshCollections,
    riskNoteDraft,
    riskStatusDraft,
    selectedOrder?.id,
    user?.id,
  ]);

  const metrics = useMemo(() => {
    const pipelineValue = leads.reduce(
      (sum, lead) => sum + (lead.value_cents || 0),
      0,
    );
    const activeTickets = tickets.filter(
      (ticket) => ticket.status !== "resolved" && ticket.status !== "closed",
    ).length;
    const blockedTrust = trustProfiles.filter(
      (profile) =>
        profile.manual_hold || profile.crm_approval_status !== "approved",
    ).length;
    return [
      {
        label: "Pipeline",
        value: compactNumber(leads.length),
        note: `${formatCurrency(pipelineValue)} nilai deal masuk`,
      },
      {
        label: "Support Queue",
        value: compactNumber(activeTickets),
        note: "ticket dari WWW, transaksi, dan dispute",
      },
      {
        label: "Risk Queue",
        value: compactNumber(riskQueue.length),
        note: "order yang butuh verifikasi manual",
      },
      {
        label: "Trust Hold",
        value: compactNumber(blockedTrust),
        note: "akun ditahan atau dibatasi CRM",
      },
    ];
  }, [leads, riskQueue.length, tickets, trustProfiles]);

  const signalMap = [
    {
      title: "Listing dan demand intake",
      body: "Listing, content, dan request dari WWW masuk ke CRM sebagai lead sehingga sales tahu intent yang layak di-close.",
    },
    {
      title: "Chat dan negosiasi",
      body: "Room chat yang menunjukkan niat transaksi atau pola mencurigakan harus dibawa ke pipeline atau support desk.",
    },
    {
      title: "Support dan dispute",
      body: "Semua keluhan, gagal transaksi, atau penyalahgunaan masuk ke support inbox agar ada owner, SLA, dan jejak tindak lanjut.",
    },
    {
      title: "KTP, liveness, dan fraud",
      body: "Hasil OCR + AI + trust policy dipakai di risk desk untuk approve, restrict, manual hold, dan membatasi exposure.",
    },
  ];

  const stepUpFresh = isStepUpFresh();
  const riskReasons = buildRiskReasons(
    orderDetail?.order || selectedOrder,
    trustProfile,
    riskIdentity,
  );

  if (authLoading || bootLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-[color:var(--color-text)]">
        Memuat CRM...
      </div>
    );
  }
  if (!isAuthenticated) return null;

  return (
    <div className="dashboard-shell">
      <div className="pointer-events-none absolute left-6 top-6 h-44 w-44 rounded-full bg-[color:color-mix(in_srgb,_var(--color-primary)_22%,_transparent)] blur-3xl" />
      <div className="pointer-events-none absolute bottom-4 right-8 h-56 w-56 rounded-full bg-[color:color-mix(in_srgb,_var(--color-primary-strong)_18%,_transparent)] blur-3xl" />
      <div className="relative z-10 mx-auto grid min-h-screen max-w-[1500px] gap-6 p-4 lg:grid-cols-[280px_1fr] lg:p-6">
        <aside className="glass-panel rounded-[32px] p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--color-primary)]">
                Lajukan
              </p>
              <h1 className="mt-2 text-2xl font-semibold text-[color:var(--color-text)]">
                CRM Command
              </h1>
            </div>
            <span
              className={pillTone(
                stepUpFresh ? "verified" : "pending",
                stepUpFresh ? "success" : "warning",
              )}
            >
              {stepUpFresh ? "OTP fresh" : "OTP needed"}
            </span>
          </div>
          <p className="mt-3 text-sm text-[color:var(--color-text)]">
            CRM bukan cuma catatan lead. Ini command center untuk growth,
            support, trust, dan anti-fraud dari seluruh WWW.
          </p>
          <div className="mt-6 space-y-2">
            {[
              ["command", "Command", "lihat aliran sistem"],
              ["pipeline", "Pipeline", "listing, demand, closing"],
              ["support", "Support", "ticket, dispute, abuse"],
              ["risk", "Risk Desk", "KYC, trust, transaksi"],
            ].map((item) => (
              <button
                key={item[0]}
                type="button"
                onClick={() => setTab(item[0] as TabId)}
                className={`w-full rounded-2xl border px-4 py-3 text-left transition ${
                  tab === item[0]
                    ? "border-[color:var(--color-primary-border)] bg-[color:var(--color-primary-soft)]"
                    : "border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_72%,_transparent)]"
                }`}
              >
                <p className="text-sm font-semibold text-[color:var(--color-text)]">
                  {item[1]}
                </p>
                <p className="mt-1 text-xs text-[color:var(--color-text)]">
                  {item[2]}
                </p>
              </button>
            ))}
          </div>
          <div className="mt-6 rounded-[28px] border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_80%,_transparent)] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-text)]">
              Operator
            </p>
            <p className="mt-2 text-sm font-semibold text-[color:var(--color-text)]">
              {user?.username || user?.email}
            </p>
            <p className="mt-1 text-xs text-[color:var(--color-text)]">
              Step-up terakhir:{" "}
              {stepUpVerifiedAt
                ? formatDate(new Date(stepUpVerifiedAt).toISOString())
                : "belum ada"}
            </p>
            <div className="mt-4 flex gap-2">
              <a href={wwwUrl} className="flex-1">
                <Button variant="secondary" className="w-full">
                  Buka WWW
                </Button>
              </a>
              <Button
                variant="ghost"
                className="flex-1"
                onClick={() => void logout()}
              >
                Logout
              </Button>
            </div>
          </div>
          <div className="mt-6 space-y-3 text-sm text-[color:var(--color-text)]">
            <p className="font-semibold">Guard rails CRM</p>
            <p>
              Approval order berisiko dan perubahan trust profile selalu minta
              step-up OTP.
            </p>
            <p>
              Identity snapshot dipakai untuk cek email, phone, KTP, liveness,
              dan transaction eligibility.
            </p>
            <p>
              Manual hold dipakai saat ada niat jahat, anomali transaksi, atau
              repeat abuse.
            </p>
          </div>
        </aside>

        <main className="space-y-6">
          <div className="glass-panel rounded-[32px] p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[color:var(--color-primary)]">
                  Operational CRM
                </p>
                <h2 className="mt-2 text-3xl font-semibold text-[color:var(--color-text)]">
                  Growth, support, dan risk saling terhubung
                </h2>
                <p className="mt-2 max-w-3xl text-sm text-[color:var(--color-text)]">
                  WWW perlu CRM yang bisa menutup deal, mengelola complaint, dan
                  memblokir abuse. Semua sinyal itu harus terlihat dalam satu
                  dashboard.
                </p>
              </div>
              <Button onClick={() => void runRefresh()} disabled={refreshing}>
                {refreshing ? "Refreshing..." : "Refresh data"}
              </Button>
            </div>
            {bootError ? (
              <div className="mt-4 rounded-2xl border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-soft)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
                {bootError}
              </div>
            ) : null}
            <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {metrics.map((metric) => (
                <MetricCard
                  key={metric.label}
                  label={metric.label}
                  value={metric.value}
                  note={metric.note}
                />
              ))}
            </div>
          </div>

          {tab === "command" ? (
            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <Card className="rounded-[32px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                  Kenapa CRM dibutuhkan
                </p>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {signalMap.map((signal) => (
                    <div
                      key={signal.title}
                      className="rounded-[26px] border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_78%,_transparent)] p-4"
                    >
                      <h3 className="text-base font-semibold text-[color:var(--color-text)]">
                        {signal.title}
                      </h3>
                      <p className="mt-2 text-sm text-[color:var(--color-text)]">
                        {signal.body}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-[28px] border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface)_76%,_transparent)] p-5">
                  <p className="text-sm font-semibold text-[color:var(--color-text)]">
                    Recent CRM activity
                  </p>
                  <div className="mt-4 space-y-3">
                    {activities.slice(0, 8).map((activity) => (
                      <CrmActivityCard key={activity.id} activity={activity} />
                    ))}
                    {!activities.length ? (
                      <p className="text-sm text-[color:var(--color-text)]">
                        Belum ada activity CRM terbaru.
                      </p>
                    ) : null}
                  </div>
                </div>
              </Card>

              <Card className="rounded-[32px]">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                  Intake baru
                </p>
                <h3 className="mt-2 text-xl font-semibold text-[color:var(--color-text)]">
                  Masukkan lead manual
                </h3>
                <p className="mt-2 text-sm text-[color:var(--color-text)]">
                  Pakai saat ada demand dari telepon, WhatsApp, pemerintah, atau
                  partner yang belum otomatis masuk dari WWW.
                </p>
                {leadError ? (
                  <div className="mt-4 rounded-2xl border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-soft)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
                    {leadError}
                  </div>
                ) : null}
                {leadNotice ? (
                  <div className="mt-4 rounded-2xl border border-[color:var(--color-primary-border)] bg-[color:var(--color-primary-soft)] px-4 py-3 text-sm text-[color:var(--color-primary)]">
                    {leadNotice}
                  </div>
                ) : null}
                <div className="mt-5 space-y-4">
                  <Input
                    label="Nama lead"
                    value={leadDraft.name}
                    onChange={(event) =>
                      setLeadDraft((current) => ({
                        ...current,
                        name: event.target.value,
                      }))
                    }
                  />
                  <Input
                    label="Email requester"
                    type="email"
                    value={leadDraft.requester_email}
                    onChange={(event) =>
                      setLeadDraft((current) => ({
                        ...current,
                        requester_email: event.target.value,
                      }))
                    }
                  />
                  <div className="grid gap-4 md:grid-cols-2">
                    <Input
                      label="Sector"
                      value={leadDraft.sector}
                      onChange={(event) =>
                        setLeadDraft((current) => ({
                          ...current,
                          sector: event.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Value cents"
                      inputMode="numeric"
                      value={leadDraft.value_cents}
                      onChange={(event) =>
                        setLeadDraft((current) => ({
                          ...current,
                          value_cents: event.target.value.replace(/\D/g, ""),
                        }))
                      }
                    />
                  </div>
                  <Input
                    label="Source"
                    value={leadDraft.source}
                    onChange={(event) =>
                      setLeadDraft((current) => ({
                        ...current,
                        source: event.target.value,
                      }))
                    }
                  />
                  <Button
                    onClick={() => void createLead()}
                    disabled={leadBusy}
                    className="w-full"
                  >
                    {leadBusy ? "Membuat..." : "Masukkan ke pipeline"}
                  </Button>
                </div>
              </Card>
            </div>
          ) : null}
          {tab === "pipeline" ? (
            <div className="grid gap-6 xl:grid-cols-[1.25fr_0.75fr]">
              <Card className="rounded-[32px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                      Pipeline Board
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-[color:var(--color-text)]">
                      Lead dari listing, chat, dan transaksi
                    </h3>
                  </div>
                  <span className={pillTone(String(leads.length), "warning")}>
                    {leads.length} total
                  </span>
                </div>
                <div className="mt-5 grid gap-4 xl:grid-cols-5">
                  {LEAD_STAGES.map((stage) => (
                    <div
                      key={stage}
                      className="rounded-[26px] border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_80%,_transparent)] p-3"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-sm font-semibold capitalize text-[color:var(--color-text)]">
                          {stage}
                        </p>
                        <span
                          className={pillTone(
                            stage,
                            stage === "won" ? "success" : "warning",
                          )}
                        >
                          {leads.filter((lead) => lead.stage === stage).length}
                        </span>
                      </div>
                      <div className="mt-3 space-y-3">
                        {leads
                          .filter((lead) => lead.stage === stage)
                          .map((lead) => (
                            <button
                              key={lead.id}
                              type="button"
                              onClick={() => setSelectedLeadId(lead.id)}
                              className={`w-full rounded-2xl border px-3 py-3 text-left transition ${
                                selectedLeadId === lead.id
                                  ? "border-[color:var(--color-primary-border)] bg-[color:var(--color-primary-soft)]"
                                  : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                              }`}
                            >
                              <p className="text-sm font-semibold text-[color:var(--color-text)]">
                                {lead.name}
                              </p>
                              <p className="mt-1 text-xs text-[color:var(--color-text)]">
                                {sourceLabel(lead.source)} ·{" "}
                                {lead.sector || "general"}
                              </p>
                              <p className="mt-2 text-xs text-[color:var(--color-text)]">
                                {formatCurrency(
                                  lead.value_cents,
                                  lead.currency || "IDR",
                                )}
                              </p>
                            </button>
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-[32px]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                        Lead Detail
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-[color:var(--color-text)]">
                        {selectedLead?.name || "Pilih lead"}
                      </h3>
                    </div>
                    <span
                      className={pillTone(
                        selectedLead?.stage || "lead",
                        selectedLead?.stage === "won" ? "success" : "warning",
                      )}
                    >
                      {selectedLead?.stage || "lead"}
                    </span>
                  </div>
                  <div className="mt-4 space-y-2 text-sm text-[color:var(--color-text)]">
                    <p>Source: {sourceLabel(selectedLead?.source)}</p>
                    <p>Sector: {selectedLead?.sector || "general"}</p>
                    <p>Requester: {selectedLead?.requester_email || "-"}</p>
                    <p>Owner: {selectedLead?.owner_id || "belum diambil"}</p>
                    <p>Content ID: {selectedLead?.content_id || "-"}</p>
                    <p>Chat Room: {selectedLead?.chat_room_id || "-"}</p>
                  </div>
                  <div className="mt-5 grid gap-2 sm:grid-cols-2">
                    <Button
                      variant="secondary"
                      onClick={() =>
                        void updateLead(
                          { owner_id: user?.id || null },
                          "Lead diambil oleh agent ini.",
                        )
                      }
                      disabled={!selectedLead || leadBusy}
                    >
                      Claim lead
                    </Button>
                    <Button
                      onClick={() =>
                        void updateLead(
                          { stage: "won" },
                          "Lead dipindah ke closed won.",
                        )
                      }
                      disabled={!selectedLead || leadBusy}
                    >
                      Mark won
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {LEAD_STAGES.map((stage) => (
                      <button
                        key={stage}
                        type="button"
                        onClick={() =>
                          void updateLead(
                            { stage },
                            `Lead dipindah ke stage ${stage}.`,
                          )
                        }
                        disabled={!selectedLead || leadBusy}
                        className={pillTone(
                          stage,
                          stage === "won" ? "success" : "warning",
                        )}
                      >
                        {stage}
                      </button>
                    ))}
                  </div>
                  {!!metadataEntries(selectedLead?.metadata).length ? (
                    <div className="mt-5 rounded-[24px] border border-[color:var(--color-border)] p-4">
                      <p className="text-sm font-semibold text-[color:var(--color-text)]">
                        Metadata
                      </p>
                      <div className="mt-3 space-y-2 text-xs text-[color:var(--color-text)]">
                        {metadataEntries(selectedLead?.metadata).map((item) => (
                          <p key={item.key}>
                            <span className="font-semibold">{item.key}:</span>{" "}
                            {item.value}
                          </p>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Card>
                <IdentitySnapshotCard
                  identity={leadIdentity}
                  loading={leadIdentityLoading}
                />
              </div>
            </div>
          ) : null}
          {tab === "support" ? (
            <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
              <Card className="rounded-[32px]">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                      Support Queue
                    </p>
                    <h3 className="mt-2 text-xl font-semibold text-[color:var(--color-text)]">
                      Ticket, dispute, dan abuse handling
                    </h3>
                  </div>
                  <select
                    className={FIELD_CLASS}
                    value={supportFilter}
                    onChange={(event) =>
                      setSupportFilter(
                        event.target.value as
                          | "open"
                          | "mine"
                          | "urgent"
                          | "all",
                      )
                    }
                  >
                    <option value="open">Open</option>
                    <option value="mine">Mine</option>
                    <option value="urgent">Urgent</option>
                    <option value="all">All</option>
                  </select>
                </div>
                <div className="mt-5 space-y-3">
                  {filteredTickets.map((ticket) => (
                    <button
                      key={ticket.id}
                      type="button"
                      onClick={() => setSelectedTicketId(ticket.id)}
                      className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                        selectedTicketId === ticket.id
                          ? "border-[color:var(--color-primary-border)] bg-[color:var(--color-primary-soft)]"
                          : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-[color:var(--color-text)]">
                            {ticket.subject}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--color-text)]">
                            {ticket.requester_email} · {ticket.category}
                          </p>
                        </div>
                        <span
                          className={pillTone(
                            ticket.priority,
                            ticket.priority === "urgent" ||
                              ticket.priority === "high"
                              ? "risk"
                              : "warning",
                          )}
                        >
                          {ticket.priority}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        <span
                          className={pillTone(
                            ticket.status,
                            ticket.status === "resolved"
                              ? "success"
                              : "warning",
                          )}
                        >
                          {ticket.status}
                        </span>
                        <span className={pillTone(ticket.source || "support")}>
                          {ticket.source || "support"}
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </Card>

              <div className="space-y-6">
                <Card className="rounded-[32px]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                        Ticket Detail
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-[color:var(--color-text)]">
                        {ticketDetail?.ticket.subject || "Pilih ticket"}
                      </h3>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() =>
                          void updateTicket(
                            {
                              assigned_agent_id: user?.id || null,
                              status: "in_progress",
                            },
                            "Ticket di-assign ke Anda.",
                          )
                        }
                        disabled={!selectedTicket || supportBusy}
                      >
                        Take ownership
                      </Button>
                      <Button
                        onClick={() =>
                          void updateTicket(
                            { status: ticketStatusDraft },
                            "Status ticket diperbarui.",
                          )
                        }
                        disabled={!selectedTicket || supportBusy}
                      >
                        Save status
                      </Button>
                    </div>
                  </div>
                  {supportError ? (
                    <div className="mt-4 rounded-2xl border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-soft)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
                      {supportError}
                    </div>
                  ) : null}
                  {supportNotice ? (
                    <div className="mt-4 rounded-2xl border border-[color:var(--color-primary-border)] bg-[color:var(--color-primary-soft)] px-4 py-3 text-sm text-[color:var(--color-primary)]">
                      {supportNotice}
                    </div>
                  ) : null}
                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <select
                      className={FIELD_CLASS}
                      value={ticketStatusDraft}
                      onChange={(event) =>
                        setTicketStatusDraft(event.target.value)
                      }
                    >
                      {TICKET_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <div className="rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_76%,_transparent)] px-4 py-3 text-sm text-[color:var(--color-text)]">
                      SLA anchor:{" "}
                      {formatDate(
                        ticketDetail?.ticket.latest_message_at ||
                          ticketDetail?.ticket.created_at,
                      )}
                    </div>
                  </div>
                  <div className="mt-5 space-y-3">
                    {ticketDetail?.replies.map((reply) => (
                      <div
                        key={reply.id}
                        className="rounded-[24px] border border-[color:var(--color-border)] px-4 py-4"
                      >
                        <div className="flex items-center justify-between gap-3">
                          <span
                            className={pillTone(
                              reply.is_internal
                                ? "manual_hold"
                                : reply.author_role,
                              reply.is_internal ? "risk" : "default",
                            )}
                          >
                            {reply.is_internal
                              ? "internal note"
                              : reply.author_role}
                          </span>
                          <p className="text-xs text-[color:var(--color-text)]">
                            {formatDate(reply.created_at)}
                          </p>
                        </div>
                        <p className="mt-3 text-sm text-[color:var(--color-text)]">
                          {reply.body}
                        </p>
                      </div>
                    ))}
                    {!ticketDetail?.replies.length ? (
                      <p className="text-sm text-[color:var(--color-text)]">
                        Belum ada balasan. Gunakan AI untuk menyiapkan jawaban
                        pertama.
                      </p>
                    ) : null}
                  </div>
                  <div className="mt-5 space-y-3">
                    <textarea
                      className={`${FIELD_CLASS} min-h-36`}
                      value={replyDraft}
                      onChange={(event) => setReplyDraft(event.target.value)}
                      placeholder="Tulis balasan atau internal note..."
                    />
                    <label className="flex items-center gap-2 text-sm text-[color:var(--color-text)]">
                      <input
                        type="checkbox"
                        checked={replyInternal}
                        onChange={(event) =>
                          setReplyInternal(event.target.checked)
                        }
                      />
                      Simpan sebagai internal note
                    </label>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="secondary"
                        onClick={() => void generateAiDraft()}
                        disabled={!ticketDetail || aiDraftBusy}
                      >
                        {aiDraftBusy ? "AI berpikir..." : "AI draft"}
                      </Button>
                      <Button
                        onClick={() => void sendReply()}
                        disabled={
                          !ticketDetail || supportBusy || !replyDraft.trim()
                        }
                      >
                        {supportBusy ? "Mengirim..." : "Kirim balasan"}
                      </Button>
                    </div>
                  </div>
                </Card>
                <IdentitySnapshotCard
                  identity={supportIdentity}
                  loading={supportIdentityLoading}
                />
              </div>
            </div>
          ) : null}
          {tab === "risk" ? (
            <div className="grid gap-6 xl:grid-cols-[0.72fr_1.28fr]">
              <div className="space-y-6">
                <Card className="rounded-[32px]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                    Risk Queue
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-[color:var(--color-text)]">
                    Order yang perlu review manual
                  </h3>
                  <div className="mt-5 space-y-3">
                    {riskQueue.map((order) => (
                      <button
                        key={order.id}
                        type="button"
                        onClick={() => setSelectedOrderId(order.id)}
                        className={`w-full rounded-[24px] border px-4 py-4 text-left transition ${
                          selectedOrder?.id === order.id
                            ? "border-[color:var(--color-primary-border)] bg-[color:var(--color-primary-soft)]"
                            : "border-[color:var(--color-border)] bg-[color:var(--color-surface)]"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-semibold text-[color:var(--color-text)]">
                              {order.service_type}
                            </p>
                            <p className="mt-1 text-xs text-[color:var(--color-text)]">
                              {order.id}
                            </p>
                          </div>
                          <span
                            className={pillTone(
                              order.status,
                              order.status === "disputed" ? "risk" : "warning",
                            )}
                          >
                            {order.status}
                          </span>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          <span
                            className={pillTone(
                              `risk-${order.risk_score}`,
                              order.risk_score >= 70 ? "risk" : "warning",
                            )}
                          >
                            risk {order.risk_score}
                          </span>
                          <span className={pillTone(order.payment_mode)}>
                            {order.payment_mode}
                          </span>
                        </div>
                      </button>
                    ))}
                    {!riskQueue.length ? (
                      <p className="text-sm text-[color:var(--color-text)]">
                        Tidak ada order berisiko tinggi saat ini.
                      </p>
                    ) : null}
                  </div>
                </Card>
                <Card className="rounded-[32px]">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                    Trust Watchlist
                  </p>
                  <div className="mt-4 space-y-3">
                    {trustProfiles
                      .filter(
                        (profile) =>
                          profile.manual_hold ||
                          profile.crm_approval_status !== "approved" ||
                          profile.risk_strike_count > 0,
                      )
                      .slice(0, 6)
                      .map((profile) => (
                        <div
                          key={profile.user_id}
                          className="rounded-2xl border border-[color:var(--color-border)] px-4 py-3"
                        >
                          <div className="flex flex-wrap gap-2">
                            <span
                              className={pillTone(
                                profile.crm_approval_status,
                                profile.crm_approval_status === "approved"
                                  ? "success"
                                  : "risk",
                              )}
                            >
                              {profile.crm_approval_status}
                            </span>
                            {profile.manual_hold ? (
                              <span className={pillTone("manual_hold", "risk")}>
                                manual hold
                              </span>
                            ) : null}
                          </div>
                          <p className="mt-2 text-sm font-semibold text-[color:var(--color-text)]">
                            {profile.user_id}
                          </p>
                          <p className="mt-1 text-xs text-[color:var(--color-text)]">
                            tier {profile.tier} · {profile.risk_strike_count}{" "}
                            strike
                          </p>
                        </div>
                      ))}
                  </div>
                </Card>
              </div>

              <div className="space-y-6">
                <Card className="rounded-[32px]">
                  <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                        Order Review
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-[color:var(--color-text)]">
                        {orderDetail?.order.service_type ||
                          selectedOrder?.service_type ||
                          "Pilih order"}
                      </h3>
                      <p className="mt-2 text-sm text-[color:var(--color-text)]">
                        Gunakan desk ini untuk approve verifikasi, dispute, atau
                        membatasi exposure sebelum transaksi lanjut.
                      </p>
                    </div>
                    <span
                      className={pillTone(
                        selectedOrder?.status || "pending_verification",
                        selectedOrder?.status === "disputed"
                          ? "risk"
                          : "warning",
                      )}
                    >
                      {selectedOrder?.status || "pending_verification"}
                    </span>
                  </div>
                  {riskError ? (
                    <div className="mt-4 rounded-2xl border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-soft)] px-4 py-3 text-sm text-[color:var(--color-danger)]">
                      {riskError}
                    </div>
                  ) : null}
                  {riskNotice ? (
                    <div className="mt-4 rounded-2xl border border-[color:var(--color-primary-border)] bg-[color:var(--color-primary-soft)] px-4 py-3 text-sm text-[color:var(--color-primary)]">
                      {riskNotice}
                    </div>
                  ) : null}
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className="rounded-[24px] border border-[color:var(--color-border)] p-4">
                      <p className="text-sm font-semibold text-[color:var(--color-text)]">
                        Exposure
                      </p>
                      <div className="mt-3 space-y-2 text-sm text-[color:var(--color-text)]">
                        <p>
                          Estimate:{" "}
                          {formatCurrency(
                            selectedOrder?.amount_estimate_cents,
                            selectedOrder?.currency || "IDR",
                          )}
                        </p>
                        <p>
                          Final:{" "}
                          {formatCurrency(
                            selectedOrder?.amount_final_cents,
                            selectedOrder?.currency || "IDR",
                          )}
                        </p>
                        <p>Requester: {selectedOrder?.requester_id || "-"}</p>
                        <p>Provider: {selectedOrder?.provider_id || "-"}</p>
                      </div>
                    </div>
                    <div className="rounded-[24px] border border-[color:var(--color-border)] p-4">
                      <p className="text-sm font-semibold text-[color:var(--color-text)]">
                        Risk signals
                      </p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {riskReasons.length ? (
                          riskReasons.map((reason) => (
                            <span
                              key={reason}
                              className={pillTone(reason, "risk")}
                            >
                              {reason}
                            </span>
                          ))
                        ) : (
                          <span className={pillTone("clean", "success")}>
                            clean
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-[0.9fr_1.1fr]">
                    <select
                      className={FIELD_CLASS}
                      value={riskStatusDraft}
                      onChange={(event) =>
                        setRiskStatusDraft(event.target.value)
                      }
                    >
                      {ORDER_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <Input
                      label="Catatan keputusan"
                      value={riskNoteDraft}
                      onChange={(event) => setRiskNoteDraft(event.target.value)}
                      placeholder="Alasan approve, restrict, atau dispute..."
                    />
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        void openStepUp({
                          title: "Konfirmasi aksi risk desk",
                          message:
                            "Approval order, dispute, dan perubahan exposure harus dikunci OTP karena berdampak ke transaksi user.",
                          run: updateRiskOrder,
                        })
                      }
                      disabled={!selectedOrder || riskBusy}
                    >
                      {riskBusy ? "Menyimpan..." : "Apply order action"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setRiskStatusDraft("ready_for_dispatch")}
                      disabled={!selectedOrder}
                    >
                      Set ready_for_dispatch
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() => setRiskStatusDraft("disputed")}
                      disabled={!selectedOrder}
                    >
                      Escalate dispute
                    </Button>
                  </div>
                  {orderDetail?.events.length ? (
                    <div className="mt-5 rounded-[24px] border border-[color:var(--color-border)] p-4">
                      <p className="text-sm font-semibold text-[color:var(--color-text)]">
                        Order events
                      </p>
                      <div className="mt-3 space-y-3">
                        {orderDetail.events.slice(0, 6).map((event) => (
                          <div
                            key={event.id}
                            className="rounded-2xl border border-[color:var(--color-border)] px-4 py-3"
                          >
                            <p className="text-sm font-medium text-[color:var(--color-text)]">
                              {event.event_type}
                            </p>
                            <p className="mt-1 text-xs text-[color:var(--color-text)]">
                              {formatDate(event.created_at)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </Card>

                <Card className="rounded-[32px]">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">
                        Trust Editor
                      </p>
                      <h3 className="mt-2 text-xl font-semibold text-[color:var(--color-text)]">
                        Policy untuk user terpilih
                      </h3>
                    </div>
                    <span
                      className={pillTone(
                        trustProfile?.crm_approval_status ||
                          trustDraft.crm_approval_status,
                        trustDraft.crm_approval_status === "approved"
                          ? "success"
                          : "risk",
                      )}
                    >
                      {trustProfile?.crm_approval_status ||
                        trustDraft.crm_approval_status}
                    </span>
                  </div>
                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <label className="block text-sm text-[color:var(--color-text)]">
                      Tier
                      <select
                        className={`${FIELD_CLASS} mt-2`}
                        value={trustDraft.tier}
                        onChange={(event) =>
                          setTrustDraft((current) => ({
                            ...current,
                            tier: event.target.value as SuperAppTrustTier,
                          }))
                        }
                      >
                        {TRUST_TIERS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm text-[color:var(--color-text)]">
                      KYC status
                      <select
                        className={`${FIELD_CLASS} mt-2`}
                        value={trustDraft.kyc_status}
                        onChange={(event) =>
                          setTrustDraft((current) => ({
                            ...current,
                            kyc_status: event.target.value as SuperAppKycStatus,
                          }))
                        }
                      >
                        {KYC_STATUSES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm text-[color:var(--color-text)]">
                      CRM approval
                      <select
                        className={`${FIELD_CLASS} mt-2`}
                        value={trustDraft.crm_approval_status}
                        onChange={(event) =>
                          setTrustDraft((current) => ({
                            ...current,
                            crm_approval_status: event.target
                              .value as SuperAppCrmApprovalStatus,
                          }))
                        }
                      >
                        {APPROVAL_STATUSES.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Input
                      label="Marketing segment"
                      value={trustDraft.marketing_segment}
                      onChange={(event) =>
                        setTrustDraft((current) => ({
                          ...current,
                          marketing_segment: event.target.value,
                        }))
                      }
                    />
                    <Input
                      label="Per-order cap (cents)"
                      value={trustDraft.manual_per_order_cap_cents}
                      onChange={(event) =>
                        setTrustDraft((current) => ({
                          ...current,
                          manual_per_order_cap_cents:
                            event.target.value.replace(/\D/g, ""),
                        }))
                      }
                    />
                    <Input
                      label="Daily cap (cents)"
                      value={trustDraft.manual_daily_cap_cents}
                      onChange={(event) =>
                        setTrustDraft((current) => ({
                          ...current,
                          manual_daily_cap_cents: event.target.value.replace(
                            /\D/g,
                            "",
                          ),
                        }))
                      }
                    />
                    <Input
                      label="Monthly cap (cents)"
                      value={trustDraft.manual_monthly_cap_cents}
                      onChange={(event) =>
                        setTrustDraft((current) => ({
                          ...current,
                          manual_monthly_cap_cents: event.target.value.replace(
                            /\D/g,
                            "",
                          ),
                        }))
                      }
                    />
                    <Input
                      label="Risk strikes"
                      value={trustDraft.risk_strike_count}
                      onChange={(event) =>
                        setTrustDraft((current) => ({
                          ...current,
                          risk_strike_count: event.target.value.replace(
                            /\D/g,
                            "",
                          ),
                        }))
                      }
                    />
                  </div>
                  <label className="mt-4 flex items-center gap-2 text-sm text-[color:var(--color-text)]">
                    <input
                      type="checkbox"
                      checked={trustDraft.manual_hold}
                      onChange={(event) =>
                        setTrustDraft((current) => ({
                          ...current,
                          manual_hold: event.target.checked,
                        }))
                      }
                    />
                    Aktifkan manual hold
                  </label>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button
                      onClick={() =>
                        void openStepUp({
                          title: "Konfirmasi perubahan trust profile",
                          message:
                            "Perubahan trust bisa memblokir transaksi, menaikkan limit, atau melepaskan manual hold. OTP wajib untuk audit trail.",
                          run: saveTrust,
                        })
                      }
                      disabled={!selectedOrder || riskBusy}
                    >
                      {riskBusy ? "Menyimpan..." : "Save trust profile"}
                    </Button>
                    <Button
                      variant="secondary"
                      onClick={() =>
                        setTrustDraft(trustToDraft(trustProfile, riskIdentity))
                      }
                    >
                      Reset draft
                    </Button>
                  </div>
                </Card>

                <IdentitySnapshotCard
                  identity={riskIdentity}
                  loading={riskIdentityLoading}
                />
              </div>
            </div>
          ) : null}
        </main>
      </div>

      <StepUpDialog
        open={stepUpOpen}
        title={stepUpTitle}
        message={stepUpMessage}
        error={stepUpError}
        notice={stepUpNotice}
        devOtp={stepUpDevOtp}
        otp={stepUpOtp}
        onOtpChange={setStepUpOtp}
        onClose={() => setStepUpOpen(false)}
        onSubmit={() => void submitStepUp()}
        busy={stepUpBusy}
      />
    </div>
  );
}
