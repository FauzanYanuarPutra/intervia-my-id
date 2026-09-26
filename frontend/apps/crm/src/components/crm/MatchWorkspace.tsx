"use client";

import { useCallback, useEffect, useState } from "react";

type Requirement = {
  id: string;
  source_id: string;
  title: string;
  summary?: string | null;
  body: string;
  category?: string | null;
  metadata?: Record<string, unknown>;
  review_id?: string | null;
  review_status?: string | null;
  requester_user_id?: string | null;
};

type Candidate = {
  id: string;
  candidate_type: string;
  candidate_id: string;
  provider_user_id: string | null;
  provider_business_id: string | null;
  rank: number;
  score_total: number;
  score_breakdown: Record<string, number>;
  matched_fields: unknown;
  missing_fields: unknown;
  reasons: string[];
  warnings: string[];
  verification_snapshot: Record<string, unknown>;
  location_snapshot: Record<string, unknown>;
  admin_status: string;
  admin_reason: string | null;
};

type MatchRun = {
  id: string;
  requirement_review_id: string;
  status: string;
  scoring_version: string;
  candidate_count: number;
  top_score: number | null;
};

type RequirementResponse = {
  items: Requirement[];
  limit: number;
  offset: number;
  has_more: boolean;
};

type MatchResponse = {
  run: MatchRun;
  candidates?: Candidate[];
};

const card =
  "rounded-2xl border border-slate-200 bg-white shadow-[0_12px_34px_-28px_rgba(15,23,42,0.55)]";

function readItems<T>(payload: unknown): T[] {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return [];
  const value = payload as Record<string, unknown>;
  return Array.isArray(value.items) ? (value.items as T[]) : [];
}

export function MatchWorkspace() {
  const [requirements, setRequirements] = useState<Requirement[]>([]);
  const [selected, setSelected] = useState<Requirement | null>(null);
  const [run, setRun] = useState<MatchRun | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  const loadRequirements = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/marketplace/v1/crm/requirements?limit=50", {
        credentials: "include",
        cache: "no-store",
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.error || "Gagal memuat kebutuhan"));
      const items = readItems<Requirement>(payload);
      setRequirements(items);
      setSelected(current => current && items.some(item => item.id === current.id) ? current : items[0] ?? null);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Gagal memuat kebutuhan");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequirements();
  }, [loadRequirements]);

  const runMatch = useCallback(async () => {
    if (!selected) return;
    setBusy(true);
    setNotice("");
    try {
      const reviewId = selected.review_id || selected.source_id;
      const response = await fetch(
        `/api/marketplace/v1/crm/requirements/${encodeURIComponent(reviewId)}/match`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            idempotency_key: `crm-match-${reviewId}-${selected.source_id}`,
          }),
        },
      );
      const payload = (await response.json().catch(() => ({}))) as MatchResponse & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Gagal menjalankan Match");
      setRun(payload.run);
      setCandidates(payload.candidates ?? []);
      const runId = payload.run?.id;
      if (runId && !(payload.candidates?.length)) {
        const detail = await fetch(`/api/marketplace/v1/crm/match-runs/${runId}`, {
          credentials: "include",
          cache: "no-store",
        });
        const detailPayload = (await detail.json().catch(() => ({}))) as MatchResponse;
        if (detail.ok) {
          setCandidates(detailPayload.candidates ?? []);
          setRun(detailPayload.run ?? payload.run);
        }
      }
      setNotice(payload.run?.candidate_count ? `${payload.run.candidate_count} kandidat ditemukan.` : "Belum ada kandidat yang cukup cocok.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Gagal menjalankan Match");
    } finally {
      setBusy(false);
    }
  }, [selected]);

  const reviewCandidate = useCallback(async (candidate: Candidate, status: "approved" | "rejected" | "held") => {
    setBusy(true);
    try {
      const response = await fetch(`/api/marketplace/v1/crm/match-candidates/${candidate.id}`, {
        method: "PATCH",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          admin_status: status,
          admin_reason: status === "approved" ? "Kandidat sesuai untuk dihubungkan." : status === "rejected" ? "Kandidat tidak dipilih oleh reviewer." : "Ditahan untuk review lanjutan.",
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.error || "Gagal mengubah status kandidat"));
      setCandidates(current => current.map(item => item.id === candidate.id ? { ...item, admin_status: status } : item));
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Gagal mengubah status kandidat");
    } finally {
      setBusy(false);
    }
  }, []);

  const createConnection = useCallback(async (candidate: Candidate) => {
    if (!selected || !run) return;
    setBusy(true);
    try {
      const response = await fetch("/api/marketplace/v1/crm/connections", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          requirement_review_id: run.requirement_review_id,
          matching_run_id: run.id,
          matching_candidate_id: candidate.id,
          requester_user_id: selected.requester_user_id ?? null,
          provider_user_id: candidate.provider_user_id,
          provider_business_id: candidate.provider_business_id,
          provider_entity_type: candidate.candidate_type,
          provider_entity_id: candidate.candidate_id,
          channel: "manual",
          notes: "Dibuat dari Lajukan Match internal.",
          idempotency_key: `connection-${run.id}-${candidate.id}`,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(String(payload?.error || "Gagal membuat connection"));
      setNotice("Connection berhasil dibuat dan siap diteruskan ke flow komunikasi.");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Gagal membuat connection");
    } finally {
      setBusy(false);
    }
  }, [run, selected]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">Marketplace</p>
          <h1 className="mt-1 text-2xl font-black tracking-[-0.04em] text-slate-950">Lajukan Match</h1>
          <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-500">
            Pahami kebutuhan, temukan kandidat nyata dari data Lajukan, lalu biarkan reviewer menentukan koneksi.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRequirements()}
          disabled={loading || busy}
          className="min-h-10 rounded-xl border border-slate-200 bg-white px-4 text-sm font-bold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
        >
          Muat ulang
        </button>
      </div>

      {notice ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-800">{notice}</div> : null}

      <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
        <section className={`${card} overflow-hidden`}>
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-black text-slate-950">Kebutuhan masuk</p>
            <p className="mt-0.5 text-xs text-slate-500">Source tetap berasal dari kebutuhan nyata pengguna.</p>
          </div>
          <div className="max-h-[68vh] overflow-y-auto">
            {loading ? (
              <div className="p-5 text-sm text-slate-500">Memuat kebutuhan…</div>
            ) : requirements.length ? (
              requirements.map(item => {
                const active = selected?.id === item.id;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => { setSelected(item); setRun(null); setCandidates([]); setNotice(""); }}
                    className={`block w-full border-b border-slate-100 px-4 py-4 text-left transition last:border-b-0 ${active ? "bg-emerald-50/70" : "hover:bg-slate-50"}`}
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-black text-slate-950">{item.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-500">{item.summary || item.body}</p>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">{item.review_status || "new"}</span>
                    </div>
                  </button>
                );
              })
            ) : (
              <div className="p-5 text-sm text-slate-500">Belum ada kebutuhan aktif yang siap ditinjau.</div>
            )}
          </div>
        </section>

        <section className="space-y-4">
          <div className={`${card} p-5`}>
            {selected ? (
              <>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Kebutuhan asli</p>
                    <h2 className="mt-1 text-xl font-black tracking-[-0.03em] text-slate-950">{selected.title}</h2>
                    <p className="mt-2 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-slate-600">{selected.body}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => void runMatch()}
                    disabled={busy}
                    className="min-h-10 rounded-xl bg-emerald-600 px-4 text-sm font-black text-white hover:bg-emerald-700 disabled:opacity-50"
                  >
                    {busy ? "Memproses…" : "Jalankan Match"}
                  </button>
                </div>
                <div className="mt-4 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                  {selected.category ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Kategori: {selected.category}</span> : null}
                  {selected.review_status ? <span className="rounded-full bg-slate-100 px-2.5 py-1">Status: {selected.review_status}</span> : null}
                </div>
              </>
            ) : (
              <div className="py-10 text-center text-sm text-slate-500">Pilih kebutuhan untuk mulai matching.</div>
            )}
          </div>

          {run ? (
            <div className={`${card} p-5`}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-slate-950">Hasil Match</p>
                  <p className="mt-1 text-xs text-slate-500">{run.status} · {run.scoring_version} · {run.candidate_count} kandidat</p>
                </div>
                <span className="rounded-full bg-emerald-50 px-3 py-1.5 text-xs font-black text-emerald-700">
                  Top {run.top_score?.toFixed(0) ?? "—"}
                </span>
              </div>

              <div className="mt-4 space-y-3">
                {candidates.length ? candidates.map(candidate => (
                  <article key={candidate.id} className="rounded-2xl border border-slate-200 p-4">
                    <div className="flex flex-wrap items-start gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-xs font-black text-slate-400">#{candidate.rank}</span>
                          <span className="text-sm font-black text-slate-950">{candidate.candidate_id}</span>
                          <span className="rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black text-emerald-700">
                            {candidate.score_total.toFixed(0)}
                          </span>
                          <span className="rounded-full bg-slate-100 px-2 py-1 text-[10px] font-black text-slate-600">
                            {candidate.admin_status}
                          </span>
                        </div>
                        {candidate.reasons?.length ? <p className="mt-2 text-sm leading-5 text-slate-600">{candidate.reasons[0]}</p> : null}
                        {candidate.warnings?.length ? <p className="mt-2 text-xs leading-5 text-amber-700">⚠ {candidate.warnings.join(" · ")}</p> : null}
                        <div className="mt-3 flex flex-wrap gap-1.5">
                          {Object.entries(candidate.score_breakdown || {}).map(([key, value]) => (
                            <span key={key} className="rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-bold text-slate-500">
                              {key}: {Math.round(Number(value))}
                            </span>
                          ))}
                        </div>
                      </div>
                      <div className="flex shrink-0 flex-wrap gap-2">
                        <button
                          type="button"
                          onClick={() => void reviewCandidate(candidate, "approved")}
                          disabled={busy}
                          className="rounded-xl bg-emerald-600 px-3 py-2 text-[11px] font-black text-white disabled:opacity-50"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewCandidate(candidate, "held")}
                          disabled={busy}
                          className="rounded-xl border border-slate-200 px-3 py-2 text-[11px] font-black text-slate-700 disabled:opacity-50"
                        >
                          Tahan
                        </button>
                        <button
                          type="button"
                          onClick={() => void reviewCandidate(candidate, "rejected")}
                          disabled={busy}
                          className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-[11px] font-black text-rose-700 disabled:opacity-50"
                        >
                          Tolak
                        </button>
                        {candidate.admin_status === "approved" ? (
                          <button
                            type="button"
                            onClick={() => void createConnection(candidate)}
                            disabled={busy}
                            className="rounded-xl border border-sky-200 bg-sky-50 px-3 py-2 text-[11px] font-black text-sky-700 disabled:opacity-50"
                          >
                            Buat connection
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </article>
                )) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    Belum ada kandidat. Perjelas kategori/lokasi/anggaran kebutuhan lalu jalankan lagi.
                  </div>
                )}
              </div>
            </div>
          ) : null}
        </section>
      </div>
    </div>
  );
}
