'use client';

import { useCallback, useEffect, useState } from 'react';
import { Ban, CheckCircle2, Flag, Loader2, ShieldAlert } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { useDialog } from '@/components/system/feedback/DialogProvider';
import { useToast } from '@/components/system/feedback/ToastProvider';
import { useAuth } from '@/context/AuthContext';
import { trackLajukanEvent } from '@/lib/analytics/lajukanEvents';
import {
  type ChatReportReason,
  CHAT_REPORT_REASONS,
} from '@/lib/chatTrustSafety';

type ChatSafetyControlsProps = {
  roomId: string;
  peerUserId?: string | null;
  locale: 'id' | 'en';
  onBlockedChange?: (blocked: boolean) => void;
};

const REPORT_REASON_LABELS: Record<
  ChatReportReason,
  { id: string; en: string }
> = {
  spam: { id: 'Spam', en: 'Spam' },
  scam: { id: 'Penipuan', en: 'Scam or fraud' },
  harassment: { id: 'Pelecehan atau perundungan', en: 'Harassment or bullying' },
  hate_speech: { id: 'Ujaran kebencian', en: 'Hate speech' },
  sexual_content: { id: 'Konten seksual', en: 'Sexual content' },
  violence: { id: 'Kekerasan atau ancaman', en: 'Violence or threats' },
  impersonation: { id: 'Menyamar sebagai orang lain', en: 'Impersonation' },
  privacy: { id: 'Pelanggaran privasi', en: 'Privacy violation' },
  other: { id: 'Alasan lain', en: 'Other reason' },
};

type BlockState = 'idle' | 'loading' | 'blocked' | 'unblocked' | 'error';

function readApiCode(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return '';
  const code = (payload as { code?: unknown }).code;
  return typeof code === 'string' ? code : '';
}

export function ChatSafetyControls({
  roomId,
  peerUserId,
  locale,
  onBlockedChange,
}: ChatSafetyControlsProps) {
  const isIndonesian = locale === 'id';
  const { authFetch } = useAuth();
  const { confirm } = useDialog();
  const { notify } = useToast();
  const [blockState, setBlockState] = useState<BlockState>(
    peerUserId ? 'loading' : 'idle',
  );
  const [blockPending, setBlockPending] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const [reportReason, setReportReason] =
    useState<ChatReportReason>('scam');
  const [reportDetails, setReportDetails] = useState('');
  const [reportPending, setReportPending] = useState(false);

  useEffect(() => {
    if (!peerUserId) {
      setBlockState('idle');
      onBlockedChange?.(false);
      return;
    }

    let cancelled = false;
    setBlockState('loading');
    void authFetch(`/api/chat/blocks/${encodeURIComponent(peerUserId)}`, {
      cache: 'no-store',
    })
      .then(async response => {
        const payload = (await response.json().catch(() => null)) as {
          data?: { blocked?: unknown };
        } | null;
        if (cancelled) return;
        if (!response.ok || typeof payload?.data?.blocked !== 'boolean') {
          setBlockState('error');
          return;
        }
        const blocked = payload.data.blocked;
        setBlockState(blocked ? 'blocked' : 'unblocked');
        onBlockedChange?.(blocked);
      })
      .catch(() => {
        if (!cancelled) setBlockState('error');
      });

    return () => {
      cancelled = true;
    };
  }, [authFetch, onBlockedChange, peerUserId]);

  const toggleBlock = useCallback(async () => {
    if (!peerUserId || blockPending) return;
    const isBlocked = blockState === 'blocked';
    const approved = await confirm({
      title: isBlocked
        ? isIndonesian
          ? 'Buka blokir pengguna?'
          : 'Unblock this person?'
        : isIndonesian
          ? 'Blokir pengguna ini?'
          : 'Block this person?',
      description: isBlocked
        ? isIndonesian
          ? 'Pengguna ini dapat menghubungi Anda lagi melalui chat pribadi.'
          : 'This person will be able to contact you in direct chat again.'
        : isIndonesian
          ? 'Pesan dan panggilan pribadi baru akan ditolak. Riwayat chat tetap ada dan grup bersama tidak terpengaruh.'
          : 'New direct messages and calls will be rejected. Chat history stays and shared groups are unaffected.',
      confirmLabel: isBlocked
        ? isIndonesian
          ? 'Buka blokir'
          : 'Unblock'
        : isIndonesian
          ? 'Blokir'
          : 'Block',
      cancelLabel: isIndonesian ? 'Batal' : 'Cancel',
      tone: isBlocked ? 'default' : 'danger',
    });
    if (!approved) return;

    setBlockPending(true);
    try {
      const response = await authFetch(
        isBlocked
          ? `/api/chat/blocks/${encodeURIComponent(peerUserId)}`
          : '/api/chat/blocks',
        {
          method: isBlocked ? 'DELETE' : 'POST',
          ...(isBlocked
            ? {}
            : {
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ blocked_user_id: peerUserId }),
              }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readApiCode(payload) || 'request_failed');

      const blocked = !isBlocked;
      setBlockState(blocked ? 'blocked' : 'unblocked');
      onBlockedChange?.(blocked);
      notify({
        title: blocked
          ? isIndonesian
            ? 'Pengguna diblokir'
            : 'Person blocked'
          : isIndonesian
            ? 'Blokir dibuka'
            : 'Person unblocked',
        description: blocked
          ? isIndonesian
            ? 'Chat pribadi baru dari pengguna ini akan ditolak.'
            : 'New direct chats from this person will be rejected.'
          : undefined,
        variant: 'success',
      });
      void trackLajukanEvent(
        blocked ? 'chat.contact_blocked' : 'chat.contact_unblocked',
        { source: 'chat_settings', entityType: 'user' },
      );
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      notify({
        title:
          code === 'rate_limited'
            ? isIndonesian
              ? 'Terlalu banyak percobaan'
              : 'Too many attempts'
            : isIndonesian
              ? 'Pengaturan belum tersimpan'
              : 'Setting was not saved',
        description: isIndonesian
          ? 'Coba lagi. Status lama tetap berlaku.'
          : 'Try again. The previous setting is unchanged.',
        variant: 'error',
      });
    } finally {
      setBlockPending(false);
    }
  }, [
    authFetch,
    blockPending,
    blockState,
    confirm,
    isIndonesian,
    notify,
    onBlockedChange,
    peerUserId,
  ]);

  const submitReport = useCallback(async () => {
    if (reportPending) return;
    setReportPending(true);
    try {
      const response = await authFetch(
        `/api/chat/rooms/${encodeURIComponent(roomId)}/reports`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            reason: reportReason,
            details: reportDetails.trim(),
          }),
        },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok) throw new Error(readApiCode(payload) || 'request_failed');

      setReportOpen(false);
      setReportDetails('');
      notify({
        title: isIndonesian ? 'Laporan sudah diterima' : 'Report received',
        description: isIndonesian
          ? 'Tim keamanan Lajukan akan meninjaunya. Melaporkan tidak otomatis memblokir pengguna.'
          : 'Lajukan safety will review it. Reporting does not automatically block the person.',
        variant: 'success',
      });
      void trackLajukanEvent('report.submitted', {
        source: 'chat_settings',
        entityType: 'chat_room',
        properties: { reason: reportReason, has_details: Boolean(reportDetails.trim()) },
      });
    } catch (error) {
      const code = error instanceof Error ? error.message : '';
      notify({
        title:
          code === 'rate_limited'
            ? isIndonesian
              ? 'Batas laporan tercapai'
              : 'Report limit reached'
            : isIndonesian
              ? 'Laporan belum terkirim'
              : 'Report was not sent',
        description: isIndonesian
          ? 'Coba lagi beberapa saat.'
          : 'Please try again shortly.',
        variant: 'error',
      });
    } finally {
      setReportPending(false);
    }
  }, [
    authFetch,
    isIndonesian,
    notify,
    reportDetails,
    reportPending,
    reportReason,
    roomId,
  ]);

  return (
    <>
      <section className="ui-feed-tile rounded-[24px] border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface)] p-3">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]">
            <ShieldAlert className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.12em] text-[color:var(--app-text-soft)]">
              {isIndonesian ? 'Keamanan & privasi' : 'Safety & privacy'}
            </p>
            <h4 className="mt-1 text-base font-bold text-[color:var(--app-text)]">
              {isIndonesian ? 'Kendalikan percakapan ini' : 'Control this conversation'}
            </h4>
            <p className="mt-1 text-xs font-medium leading-5 text-[color:var(--app-text-soft)]">
              {isIndonesian
                ? 'Laporan ditinjau tim keamanan. Blokir hanya berlaku untuk chat pribadi; riwayat tidak dihapus.'
                : 'Reports are reviewed by safety. Blocking applies to direct chat only; history is not deleted.'}
            </p>
          </div>
        </div>

        <div className="mt-3 grid gap-2">
          <button
            type="button"
            onClick={() => setReportOpen(true)}
            className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] px-3 text-left text-sm font-bold text-[color:var(--app-danger)] transition hover:bg-[color:var(--app-danger-soft)]"
          >
            <Flag className="h-4 w-4 shrink-0" />
            <span>{isIndonesian ? 'Laporkan percakapan' : 'Report conversation'}</span>
          </button>

          {peerUserId ? (
            <button
              type="button"
              onClick={() => void toggleBlock()}
              disabled={blockPending || blockState === 'loading'}
              className="flex min-h-11 w-full items-center gap-3 rounded-2xl border border-[color:var(--app-border-strong)] bg-[color:var(--app-surface-muted)] px-3 text-left text-sm font-bold text-[color:var(--app-danger)] transition hover:bg-[color:var(--app-danger-soft)] disabled:cursor-wait disabled:opacity-60"
            >
              {blockPending || blockState === 'loading' ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : blockState === 'blocked' ? (
                <CheckCircle2 className="h-4 w-4 shrink-0" />
              ) : (
                <Ban className="h-4 w-4 shrink-0" />
              )}
              <span>
                {blockState === 'blocked'
                  ? isIndonesian
                    ? 'Buka blokir pengguna'
                    : 'Unblock person'
                  : isIndonesian
                    ? 'Blokir pengguna'
                    : 'Block person'}
              </span>
            </button>
          ) : null}

          {blockState === 'error' ? (
            <p role="status" className="px-1 text-xs text-[color:var(--app-warning)]">
              {isIndonesian
                ? 'Status blokir belum dapat dimuat. Coba buka pengaturan lagi.'
                : 'Block status could not be loaded. Reopen settings to retry.'}
            </p>
          ) : null}
        </div>
      </section>

      <Modal
        open={reportOpen}
        title={isIndonesian ? 'Laporkan percakapan' : 'Report conversation'}
        onClose={() => {
          if (!reportPending) setReportOpen(false);
        }}
        footer={
          <>
            <button
              type="button"
              onClick={() => setReportOpen(false)}
              disabled={reportPending}
              className="inline-flex h-11 items-center justify-center rounded-xl border border-[color:var(--app-border)] px-4 text-sm font-semibold text-[color:var(--app-text)] disabled:opacity-60"
            >
              {isIndonesian ? 'Batal' : 'Cancel'}
            </button>
            <button
              type="button"
              onClick={() => void submitReport()}
              disabled={reportPending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[color:var(--app-danger)] px-4 text-sm font-semibold text-[color:var(--app-text-inverse)] disabled:opacity-60"
            >
              {reportPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {reportPending
                ? isIndonesian
                  ? 'Mengirim...'
                  : 'Sending...'
                : isIndonesian
                  ? 'Kirim laporan'
                  : 'Send report'}
            </button>
          </>
        }
      >
        <p className="mb-4 text-sm leading-6 text-[color:var(--app-text-soft)]">
          {isIndonesian
            ? 'Pilih alasan yang paling sesuai. Jangan memasukkan PIN, OTP, kata sandi, atau data rahasia.'
            : 'Choose the closest reason. Do not include PINs, OTPs, passwords, or confidential data.'}
        </p>
        <fieldset className="space-y-2">
          <legend className="sr-only">
            {isIndonesian ? 'Alasan laporan' : 'Report reason'}
          </legend>
          {CHAT_REPORT_REASONS.map(reason => (
            <label
              key={reason}
              className={`flex min-h-11 cursor-pointer items-center gap-3 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                reportReason === reason
                  ? 'border-[color:var(--app-danger-border)] bg-[color:var(--app-danger-soft)] text-[color:var(--app-danger)]'
                  : 'border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)]'
              }`}
            >
              <input
                type="radio"
                name="chat-report-reason"
                value={reason}
                checked={reportReason === reason}
                onChange={() => setReportReason(reason)}
                className="h-4 w-4 accent-[color:var(--app-danger)]"
              />
              <span>
                {isIndonesian
                  ? REPORT_REASON_LABELS[reason].id
                  : REPORT_REASON_LABELS[reason].en}
              </span>
            </label>
          ))}
        </fieldset>

        <label className="mt-4 block text-sm font-semibold">
          {isIndonesian ? 'Keterangan tambahan (opsional)' : 'Additional details (optional)'}
          <textarea
            value={reportDetails}
            onChange={event => setReportDetails(event.target.value)}
            maxLength={1000}
            rows={4}
            placeholder={
              isIndonesian
                ? 'Jelaskan singkat apa yang terjadi'
                : 'Briefly explain what happened'
            }
            className="mt-2 w-full resize-y rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 py-2.5 text-sm outline-none focus:border-[color:var(--app-danger-border)]"
          />
          <span className="mt-1 block text-right text-xs font-normal text-[color:var(--app-text-soft)]">
            {reportDetails.length}/1000
          </span>
        </label>
      </Modal>
    </>
  );
}
