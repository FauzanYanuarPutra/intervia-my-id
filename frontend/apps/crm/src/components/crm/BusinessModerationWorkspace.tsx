"use client";

import { useEffect, useMemo, useState } from "react";
import {
  businessModerationApi,
  type CrmBusiness,
  type CrmBusinessModerationEvent,
} from "@/lib/api";
import { useAuth } from "@/context/AuthContext";

type Action = "approve" | "restore" | "request_completion" | "hide" | "reject" | "escalate";

const REASONS = [
  ["missing_required_info", "Data usaha belum lengkap"],
  ["missing_image", "Foto/logo usaha belum tersedia"],
  ["missing_contact", "Kontak usaha belum lengkap"],
  ["policy_violation", "Melanggar kebijakan penayangan"],
  ["unverifiable_business", "Informasi usaha belum dapat diverifikasi"],
  ["duplicate_business", "Usaha terindikasi duplikat"],
  ["fraud_misleading", "Informasi berpotensi menyesatkan"],
  ["inaccurate_information", "Data usaha tidak akurat"],
  ["privacy_personal_data", "Mengandung data pribadi yang tidak perlu"],
  ["owner_request", "Permintaan dari pemilik usaha"],
  ["quality", "Kualitas data/profil belum memadai"],
  ["not_eligible", "Belum memenuhi syarat penayangan"],
  ["other", "Lainnya"],
] as const;

const ACTIONS: Record<Action, { label: string; confirmLabel: string; tone: string; destructive?: boolean }> = {
  approve: { label: "Setujui penayangan", confirmLabel: "Setujui", tone: "bg-emerald-600 text-white" },
  restore: { label: "Pulihkan penayangan", confirmLabel: "Pulihkan", tone: "bg-emerald-600 text-white" },
  request_completion: { label: "Minta dilengkapi", confirmLabel: "Kirim permintaan", tone: "bg-amber-500 text-white" },
  hide: { label: "Sembunyikan dari publik", confirmLabel: "Sembunyikan", tone: "bg-rose-600 text-white", destructive: true },
  reject: { label: "Tolak penayangan", confirmLabel: "Tolak", tone: "bg-slate-950 text-white", destructive: true },
  escalate: { label: "Kirim ke peninjauan lanjut", confirmLabel: "Eskalasi", tone: "bg-slate-800 text-white" },
};

function stateLabel(business: CrmBusiness) {
  switch (business.review_state) {
    case "approved":
      return "Disetujui";
    case "needs_completion":
      return "Perlu dilengkapi";
    case "hidden":
      return "Disembunyikan";
    case "escalated":
      return "Peninjauan lanjut";
    case "under_review":
      return "Sedang ditinjau";
    default:
      return "Belum ditinjau";
  }
}

function stateTone(business: CrmBusiness) {
  switch (business.review_state) {
    case "approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "needs_completion":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "hidden":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "escalated":
      return "bg-slate-100 text-slate-700 border-slate-200";
    default:
      return "bg-sky-50 text-sky-700 border-sky-200";
  }
}

function actionLabel(action: string) {
  const map: Record<string, string> = {
    approve: "Setujui penayangan",
    restore: "Pulihkan penayangan",
    request_completion: "Minta dilengkapi",
    hide: "Sembunyikan dari publik",
    reject: "Tolak penayangan",
    escalate: "Peninjauan lanjut",
  };
  return map[action] || action.replaceAll("_", " ");
}

function reasonLabel(reason: string) {
  return REASONS.find(([value]) => value === reason)?.[1] || reason.replaceAll("_", " ");
}

function formatTime(value: string) {
  if (!value) return "-";
  try {
    return new Intl.DateTimeFormat("id-ID", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(value));
  } catch {
    return value;
  }
}

function verificationLabel(status: string) {
  return {
    verified: "Terverifikasi",
    pending: "Menunggu verifikasi",
    rejected: "Verifikasi ditolak",
  }[status] || "Belum diverifikasi";
}

function isOverdue(value: string | null) {
  return Boolean(value && new Date(value).getTime() < Date.now());
}

export default function BusinessModerationWorkspace() {
  const { accessToken, user } = useAuth();
  const [businesses, setBusinesses] = useState<CrmBusiness[]>([]);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState("");
  const [selected, setSelected] = useState<CrmBusiness | null>(null);
  const [history, setHistory] = useState<CrmBusinessModerationEvent[]>([]);
  const [reports, setReports] = useState<Array<Record<string, unknown>>>([]);
  const [appeals, setAppeals] = useState<Array<Record<string, unknown>>>([]);
  const [evidence, setEvidence] = useState<Array<Record<string, unknown>>>([]);
  const [verification, setVerification] = useState<Record<string, unknown> | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [verificationDraft, setVerificationDraft] = useState<CrmBusiness | null>(null);
  const [verificationReason, setVerificationReason] = useState("");
  const [evidenceDraft, setEvidenceDraft] = useState<{ label: string; url: string; note: string } | null>(null);
  const [draft, setDraft] = useState<{ business: CrmBusiness; action: Action } | null>(null);
  const [reasonCode, setReasonCode] = useState<string>("quality");
  const [reasonNote, setReasonNote] = useState("");
  const [severity, setSeverity] = useState<"low" | "medium" | "high" | "critical">("medium");
  const [busy, setBusy] = useState(false);

  async function loadBusinesses() {
    if (!accessToken) return;
    setLoading(true);
    try {
      const response = await businessModerationApi.list(accessToken, { limit: "100", q: query });
      setBusinesses(response.items || []);
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Data usaha gagal dimuat.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadBusinesses();
  }, [accessToken]);

  const filtered = useMemo(
    () =>
      businesses.filter(item =>
        status === "all"
          ? true
          : item.review_state === status ||
            (status === "needs_review" &&
              ["unreviewed", "under_review", "escalated"].includes(item.review_state)),
      ),
    [businesses, status],
  );

  async function openHistory(business: CrmBusiness) {
    if (!accessToken) return;
    setSelected(business);
    setHistoryLoading(true);
    try {
      const response = await businessModerationApi.history(accessToken, business.id);
      setHistory(response.events || []);
      setReports(response.reports || []);
      setAppeals(response.appeals || []);
      setEvidence(response.evidence || []);
      setVerification(response.verification || null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "History usaha gagal dimuat.");
      setHistory([]);
      setReports([]);
      setAppeals([]);
      setEvidence([]);
      setVerification(null);
    } finally {
      setHistoryLoading(false);
    }
  }

  function openAction(business: CrmBusiness, action: Action) {
    setDraft({ business, action });
    setReasonCode(action === "request_completion" ? "missing_required_info" : "quality");
    setReasonNote("");
    setSeverity(action === "hide" || action === "reject" ? "high" : "medium");
  }

  async function confirmAction() {
    if (!draft || !accessToken) return;
    const requiresNote = ["request_completion", "hide", "reject", "escalate"].includes(draft.action);
    if (requiresNote && !reasonNote.trim()) {
      setNotice("Catatan alasan wajib diisi untuk tindakan ini.");
      return;
    }
    setBusy(true);
    try {
      await businessModerationApi.moderate(accessToken, draft.business.id, {
        action: draft.action,
        reason_code: reasonCode,
        reason_note: reasonNote.trim() || undefined,
        missing_fields: draft.action === "request_completion" ? draft.business.missing_fields : undefined,
        severity,
        legal_hold: severity === "high" || severity === "critical",
      });
      setNotice(
        draft.action === "request_completion"
          ? "Permintaan melengkapi data sudah dikirim ke pemilik usaha."
          : "Keputusan moderasi usaha berhasil disimpan dan masuk history.",
      );
      setDraft(null);
      await loadBusinesses();
      if (selected?.id === draft.business.id) await openHistory(draft.business);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Keputusan usaha gagal disimpan.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Usaha & Verifikasi</p>
        <h1 className="mt-2 text-2xl font-bold tracking-[-0.05em] text-slate-950 sm:text-3xl">
          Tinjau usaha yang tampil di sekitar pengguna
        </h1>
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">
          CRM dapat meninjau kelengkapan profil, meminta pemilik melengkapi data, menyembunyikan usaha dari publik,
          memulihkan penayangan, dan melihat alasan serta riwayat setiap keputusan.
        </p>
      </section>

      {notice ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">
          {notice}
        </div>
      ) : null}

      <div className="rounded-2xl border border-slate-200 bg-white p-3">
        <div className="flex flex-col gap-2 lg:flex-row">
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            onKeyDown={event => {
              if (event.key === "Enter") void loadBusinesses();
            }}
            placeholder="Cari nama usaha, kota, alamat..."
            className="min-h-11 flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm font-semibold outline-none focus:border-emerald-300 focus:bg-white"
          />
          <select
            value={status}
            onChange={event => setStatus(event.target.value)}
            className="min-h-11 rounded-xl border border-slate-200 bg-white px-3 text-sm font-bold"
          >
            <option value="all">Semua status</option>
            <option value="needs_review">Perlu ditinjau</option>
            <option value="needs_completion">Perlu dilengkapi</option>
            <option value="approved">Disetujui</option>
            <option value="hidden">Disembunyikan</option>
            <option value="escalated">Peninjauan lanjut</option>
          </select>
          <button
            type="button"
            onClick={() => void loadBusinesses()}
            className="min-h-11 rounded-xl bg-slate-950 px-4 text-sm font-bold text-white"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm font-semibold text-slate-500">
          Memuat data usaha...
        </div>
      ) : !filtered.length ? (
        <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center">
          <p className="text-base font-bold text-slate-900">Belum ada usaha pada filter ini</p>
          <p className="mt-1 text-sm text-slate-500">CRM tidak membuat data usaha contoh. Yang tampil berasal dari data real.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map(business => (
            <article key={business.id} className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="grid sm:grid-cols-[180px_1fr]">
                <div className="min-h-44 bg-slate-100">
                  {business.image_urls[0] ? (
                    <img src={business.image_urls[0]} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="grid h-full min-h-44 place-items-center px-5 text-center text-xs font-bold text-slate-400">
                      Belum ada foto/logo
                    </div>
                  )}
                </div>
                <div className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="truncate text-base font-bold text-slate-950">{business.name}</h2>
                      <p className="mt-1 text-xs font-semibold text-slate-500">{business.city} · {business.address}</p>
                    </div>
                    <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${stateTone(business)}`}>
                      {stateLabel(business)}
                    </span>
                  </div>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                      {business.source_type === "reference" ? "Data referensi" : "Data usaha"}
                    </span>
                    <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-bold text-sky-700">
                      {verificationLabel(business.verification_status)}
                    </span>
                    {business.report_count > 0 ? (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-bold text-rose-700">
                        {business.report_count} laporan
                      </span>
                    ) : null}
                    {business.due_at ? (
                      <span className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${isOverdue(business.due_at) ? "border-rose-200 bg-rose-50 text-rose-700" : "border-slate-200 bg-slate-50 text-slate-600"}`}>
                        {isOverdue(business.due_at) ? "SLA lewat" : `SLA ${formatTime(business.due_at)}`}
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-4">
                    <div className="flex items-center justify-between text-xs font-bold text-slate-500">
                      <span>Kelengkapan profil</span>
                      <span>{business.completeness_percent}%</span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-slate-100">
                      <div className="h-full rounded-full bg-emerald-500" style={{ width: `${business.completeness_percent}%` }} />
                    </div>
                  </div>

                  {business.missing_fields.length ? (
                    <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                      <p className="text-xs font-bold text-amber-900">Yang perlu dilengkapi</p>
                      <p className="mt-1 text-xs leading-5 font-semibold text-amber-800">
                        {business.missing_fields.join(" · ")}
                      </p>
                    </div>
                  ) : (
                    <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs font-semibold text-emerald-800">
                      Data dasar usaha lengkap.
                    </div>
                  )}

                  <div className="mt-4 flex flex-wrap gap-2">
                    {business.verification_status === "pending" ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setVerificationDraft(business)}
                          className="rounded-xl bg-sky-600 px-3 py-2 text-xs font-bold text-white"
                        >
                          Tinjau verifikasi
                        </button>
                      </>
                    ) : null}
                    {(business.review_state === "unreviewed" || business.review_state === "needs_completion") ? (
                      <button type="button" onClick={() => openAction(business, "approve")} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
                        Setujui
                      </button>
                    ) : null}
                    {business.missing_fields.length ? (
                      <button type="button" onClick={() => openAction(business, "request_completion")} className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-xs font-bold text-amber-800">
                        Minta dilengkapi
                      </button>
                    ) : null}
                    {business.review_state === "hidden" ? (
                      <button type="button" onClick={() => openAction(business, "restore")} className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-bold text-white">
                        Pulihkan
                      </button>
                    ) : (
                      <button type="button" onClick={() => openAction(business, "hide")} className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700">
                        Sembunyikan
                      </button>
                    )}
                    {business.review_state !== "approved" || business.assigned_to !== user?.id ? (
                      <button
                        type="button"
                        onClick={() => void (accessToken && businessModerationApi.assign(accessToken, business.id, user?.id || null, 24).then(() => loadBusinesses()))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                      >
                        {business.assigned_to === user?.id ? "Saya pegang tugas" : "Ambil tugas"}
                      </button>
                    ) : null}
                    {business.assigned_to === user?.id ? (
                      <button
                        type="button"
                        onClick={() => void (accessToken && businessModerationApi.assign(accessToken, business.id, null).then(() => loadBusinesses()))}
                        className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                      >
                        Lepas tugas
                      </button>
                    ) : null}
                    <button type="button" onClick={() => void openHistory(business)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700">
                      History
                    </button>
                  </div>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {selected ? (
        <div className="fixed inset-0 z-[110] flex items-center justify-center bg-slate-950/35 p-4">
          <div className="max-h-[88vh] w-full max-w-3xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Riwayat usaha</p>
                <h2 className="mt-1 text-xl font-bold text-slate-950">{selected.name}</h2>
                <p className="mt-1 text-xs font-semibold text-slate-500">{selected.city} · {selected.address}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                Tutup
              </button>
            </div>

            {!historyLoading ? (
              <div className="mt-5 grid gap-2 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold text-slate-500">Laporan</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{reports.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold text-slate-500">Bukti</p>
                  <p className="mt-1 text-lg font-black text-slate-950">{evidence.length}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  <p className="text-[11px] font-bold text-slate-500">Verifikasi</p>
                  <p className="mt-1 text-sm font-black text-slate-950">{verificationLabel(String((verification || {}).status || selected.verification_status))}</p>
                </div>
              </div>
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  onClick={() => setEvidenceDraft({ label: "", url: "", note: "" })}
                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700"
                >
                  + Tambah bukti
                </button>
              </div>
            ) : null}

            {reports.length ? (
              <section className="mt-5 rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-rose-700">Laporan terbaru</p>
                <div className="mt-3 space-y-2">
                  {reports.slice(0, 5).map(report => (
                    <div key={String(report.id)} className="rounded-xl border border-rose-100 bg-white p-3">
                      <p className="text-xs font-bold text-slate-900">{reasonLabel(String(report.reason_code || "other"))}</p>
                      <p className="mt-1 text-xs text-slate-500">{String(report.status || "open")} · {formatTime(String(report.created_at || ""))}</p>
                      {report.details ? <p className="mt-2 text-xs leading-5 text-slate-600">{String(report.details)}</p> : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {evidence.length ? (
              <section className="mt-5 rounded-2xl border border-sky-200 bg-sky-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-sky-700">Bukti kasus</p>
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {evidence.slice(0, 8).map(item => (
                    <div key={String(item.id)} className="rounded-xl border border-sky-100 bg-white p-3">
                      <p className="text-xs font-bold text-slate-900">{String(item.label || item.evidence_type || "Bukti")}</p>
                      {item.source_url ? <a className="mt-1 block truncate text-xs font-semibold text-sky-700 underline" href={String(item.source_url)} target="_blank" rel="noreferrer">{String(item.source_url)}</a> : null}
                      {item.note ? <p className="mt-2 text-xs leading-5 text-slate-600">{String(item.note)}</p> : null}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {appeals.length ? (
              <section className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-black uppercase tracking-[0.12em] text-amber-700">Banding</p>
                <div className="mt-3 space-y-2">
                  {appeals.slice(0, 5).map(appeal => (
                    <div key={String(appeal.id)} className="rounded-xl border border-amber-100 bg-white p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="text-xs font-bold text-slate-900">{String(appeal.status || "pending")}</p>
                          <p className="mt-1 text-xs text-slate-500">{formatTime(String(appeal.created_at || ""))}</p>
                        </div>
                        {["pending", "in_review"].includes(String(appeal.status)) ? (
                          <div className="flex gap-2">
                            <button type="button" onClick={() => void (accessToken && businessModerationApi.reviewAppeal(accessToken, String(appeal.id), { action: "overturn", note: "Keputusan dibatalkan setelah review banding." }).then(() => openHistory(selected!)))} className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white">Terima</button>
                            <button type="button" onClick={() => void (accessToken && businessModerationApi.reviewAppeal(accessToken, String(appeal.id), { action: "uphold", note: "Keputusan sebelumnya tetap berlaku setelah review banding." }).then(() => openHistory(selected!)))} className="rounded-lg bg-slate-900 px-2.5 py-1.5 text-[11px] font-bold text-white">Pertahankan</button>
                          </div>
                        ) : null}
                      </div>
                      <p className="mt-2 text-xs leading-5 text-slate-600">{String(appeal.reason || "")}</p>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}

            {historyLoading ? (
              <p className="mt-6 text-sm font-semibold text-slate-500">Memuat history...</p>
            ) : !history.length ? (
              <div className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-5 text-sm font-semibold text-slate-500">
                Belum ada keputusan moderasi untuk usaha ini.
              </div>
            ) : (
              <div className="mt-6 space-y-3">
                {history.map(event => (
                  <div key={event.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <p className="text-sm font-bold text-slate-950">{actionLabel(event.action)}</p>
                        <p className="mt-0.5 text-xs font-semibold text-slate-500">{formatTime(event.created_at)}</p>
                      </div>
                      <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-bold text-slate-600">
                        {event.severity}
                      </span>
                    </div>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[11px] font-bold text-slate-500">Alasan</p>
                        <p className="mt-1 text-xs font-bold text-slate-800">{reasonLabel(event.reason_code)}</p>
                      </div>
                      <div className="rounded-xl bg-slate-50 p-3">
                        <p className="text-[11px] font-bold text-slate-500">Status</p>
                        <p className="mt-1 text-xs font-bold text-slate-800">
                          {event.previous_status || "-"} → {event.new_status || "-"}
                        </p>
                      </div>
                    </div>
                    {event.reason_note ? (
                      <p className="mt-3 rounded-xl border border-slate-200 bg-white p-3 text-xs leading-5 font-semibold text-slate-600">
                        {event.reason_note}
                      </p>
                    ) : null}
                    {event.missing_fields.length ? (
                      <p className="mt-2 text-xs font-semibold text-amber-700">
                        Diminta dilengkapi: {event.missing_fields.join(" · ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {verificationDraft ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">Verifikasi usaha</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">{verificationDraft.name}</h2>
                <p className="mt-1 text-xs leading-5 text-slate-500">
                  Verifikasi ini adalah status verifikasi di platform Lajukan, bukan klaim bahwa seluruh izin pemerintah sudah diverifikasi.
                </p>
              </div>
              <button type="button" onClick={() => setVerificationDraft(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                Tutup
              </button>
            </div>
            <label className="mt-5 block text-sm font-bold text-slate-950">
              Catatan keputusan
              <textarea
                value={verificationReason}
                onChange={event => setVerificationReason(event.target.value)}
                rows={4}
                maxLength={4000}
                placeholder="Catatan dapat menjelaskan bukti yang diperiksa atau alasan penolakan."
                className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-sky-400"
              />
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setVerificationDraft(null)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600"
              >
                Batal
              </button>
              <button
                type="button"
                disabled={!verificationReason.trim() || busy}
                onClick={() => {
                  if (!accessToken || !verificationDraft) return;
                  setBusy(true);
                  void businessModerationApi.reviewVerification(accessToken, verificationDraft.id, {
                    status: "rejected",
                    reason_note: verificationReason.trim(),
                  }).then(async () => {
                    setNotice("Verifikasi usaha ditolak dan alasannya tersimpan.");
                    setVerificationDraft(null);
                    setVerificationReason("");
                    await loadBusinesses();
                    if (selected?.id === verificationDraft.id) await openHistory(verificationDraft);
                  }).catch(error => setNotice(error instanceof Error ? error.message : "Keputusan verifikasi gagal."))
                    .finally(() => setBusy(false));
                }}
                className="rounded-xl bg-rose-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Tolak verifikasi
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!accessToken || !verificationDraft) return;
                  setBusy(true);
                  void businessModerationApi.reviewVerification(accessToken, verificationDraft.id, {
                    status: "verified",
                    reason_note: verificationReason.trim() || "Bukti verifikasi diperiksa dan dinyatakan cukup.",
                  }).then(async () => {
                    setNotice("Usaha berhasil diverifikasi.");
                    setVerificationDraft(null);
                    setVerificationReason("");
                    await loadBusinesses();
                    if (selected?.id === verificationDraft.id) await openHistory(verificationDraft);
                  }).catch(error => setNotice(error instanceof Error ? error.message : "Keputusan verifikasi gagal."))
                    .finally(() => setBusy(false));
                }}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Verifikasi
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {evidenceDraft && selected ? (
        <div className="fixed inset-0 z-[130] flex items-center justify-center bg-slate-950/35 p-4">
          <div className="w-full max-w-lg rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-sky-700">Bukti kasus</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">{selected.name}</h2>
              </div>
              <button type="button" onClick={() => setEvidenceDraft(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">Tutup</button>
            </div>
            <div className="mt-5 space-y-3">
              <input
                value={evidenceDraft.label}
                onChange={event => setEvidenceDraft(current => current && ({ ...current, label: event.target.value }))}
                placeholder="Nama bukti, misalnya NIB / screenshot lokasi"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky-400"
              />
              <input
                value={evidenceDraft.url}
                onChange={event => setEvidenceDraft(current => current && ({ ...current, url: event.target.value }))}
                placeholder="URL media/dokumen"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-semibold outline-none focus:border-sky-400"
              />
              <textarea
                value={evidenceDraft.note}
                onChange={event => setEvidenceDraft(current => current && ({ ...current, note: event.target.value }))}
                rows={4}
                placeholder="Catatan bukti (opsional)"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-sky-400"
              />
            </div>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setEvidenceDraft(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">Batal</button>
              <button
                type="button"
                disabled={busy || !evidenceDraft.label.trim() || !evidenceDraft.url.trim()}
                onClick={() => {
                  if (!accessToken || !selected || !evidenceDraft) return;
                  setBusy(true);
                  void businessModerationApi.addEvidence(accessToken, selected.id, {
                    evidence_type: "url",
                    label: evidenceDraft.label.trim(),
                    source_url: evidenceDraft.url.trim(),
                    note: evidenceDraft.note.trim() || undefined,
                  }).then(async () => {
                    setEvidenceDraft(null);
                    setNotice("Bukti kasus berhasil ditambahkan.");
                    await openHistory(selected);
                  }).catch(error => setNotice(error instanceof Error ? error.message : "Bukti gagal disimpan."))
                    .finally(() => setBusy(false));
                }}
                className="rounded-xl bg-sky-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-50"
              >
                Simpan bukti
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {draft ? (
        <div className="fixed inset-0 z-[120] flex items-center justify-center bg-slate-950/35 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.14em] text-emerald-700">Keputusan usaha</p>
                <h2 className="mt-1 text-lg font-bold text-slate-950">{ACTIONS[draft.action].label}</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">{draft.business.name}</p>
              </div>
              <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600">
                Tutup
              </button>
            </div>

            <div className="mt-5">
              <p className="text-sm font-bold text-slate-950">Alasan</p>
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {REASONS.map(([value, label]) => (
                  <label key={value} className="flex cursor-pointer items-start gap-2 rounded-2xl border border-slate-200 p-3 text-xs font-semibold">
                    <input type="radio" name="business-reason" checked={reasonCode === value} onChange={() => setReasonCode(value)} className="mt-0.5" />
                    <span>{label}</span>
                  </label>
                ))}
              </div>
            </div>

            {draft.action === "request_completion" && draft.business.missing_fields.length ? (
              <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-3">
                <p className="text-xs font-bold text-amber-900">Akan diminta dilengkapi</p>
                <p className="mt-1 text-xs font-semibold leading-5 text-amber-800">{draft.business.missing_fields.join(" · ")}</p>
              </div>
            ) : null}

            <label className="mt-4 block text-sm font-bold text-slate-950">
              Catatan {["request_completion", "hide", "reject", "escalate"].includes(draft.action) ? "(wajib)" : "(opsional)"}
              <textarea
                value={reasonNote}
                onChange={event => setReasonNote(event.target.value)}
                maxLength={4000}
                rows={4}
                className="mt-2 w-full rounded-2xl border border-slate-200 p-3 text-sm outline-none focus:border-emerald-400"
                placeholder="Tulis alasan yang faktual dan bisa dibaca lagi di history."
              />
            </label>

            <div className="mt-4">
              <p className="text-sm font-bold text-slate-950">Tingkat penanganan</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {(["low", "medium", "high", "critical"] as const).map(value => (
                  <label key={value} className="flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold">
                    <input type="radio" name="business-severity" checked={severity === value} onChange={() => setSeverity(value)} />
                    {value}
                  </label>
                ))}
              </div>
            </div>

            {ACTIONS[draft.action].destructive ? (
              <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-3 text-xs leading-5 font-semibold text-rose-800">
                Tindakan ini memengaruhi penayangan publik. Alasan akan tersimpan di history dan dikirim ke pemilik usaha melalui notifikasi.
              </div>
            ) : null}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setDraft(null)} className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold text-slate-600">
                Batal
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={() => void confirmAction()}
                className={`rounded-xl px-4 py-2 text-sm font-bold disabled:cursor-not-allowed disabled:opacity-50 ${ACTIONS[draft.action].tone}`}
              >
                {busy ? "Menyimpan..." : ACTIONS[draft.action].confirmLabel}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
