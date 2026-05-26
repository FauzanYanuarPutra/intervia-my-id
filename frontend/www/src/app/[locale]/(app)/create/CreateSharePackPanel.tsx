'use client';

import { useMemo, useState } from 'react';
import {
  Copy,
  Download,
  ExternalLink,
  Link2,
  Megaphone,
  Settings2,
} from 'lucide-react';
import { Link } from '@/i18n/navigation';
import {
  buildSharePackChannels,
  type SharePackInput,
} from '@/lib/content/distribution';

type Props = {
  locale: string;
  input: SharePackInput;
  compact?: boolean;
};

export function CreateSharePackPanel({
  locale,
  input,
  compact = false,
}: Props) {
  const [message, setMessage] = useState<string | null>(null);
  const isId = locale === 'id';
  const channels = useMemo(() => {
    const items = buildSharePackChannels(input);
    return [...items].sort((left, right) => {
      if (left.id === 'whatsapp') return -1;
      if (right.id === 'whatsapp') return 1;
      return left.label.localeCompare(right.label);
    });
  }, [input]);
  const connections = input.connections || {};
  const listingUrl = input.listingUrl || '';
  const coverImage = input.coverImage || '';
  const whatsappChannel = channels.find(channel => channel.id === 'whatsapp');

  const handleCopy = async (value: string, label: string) => {
    if (!value.trim()) return;
    try {
      await navigator.clipboard.writeText(value);
      setMessage(isId ? `${label} udah ke-copy.` : `${label} copied.`);
    } catch {
      setMessage(
        isId
          ? 'Belum ke-copy. Coba copy manual ya.'
          : 'Failed to copy. Please copy it manually.',
      );
    }
  };

  if (compact) {
    return (
      <div className="relative overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_16px_30px_-26px_rgba(15,23,42,0.12)] backdrop-blur-xl dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
        <div className="relative flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="inline-flex rounded-full border border-teal-200/80 bg-teal-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-teal-700 dark:border-teal-900/70 dark:bg-teal-950/20 dark:text-teal-200">
              Share Pack
            </p>
            <p className="mt-2 text-[13px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {isId ? 'Copy, terus kirim aja.' : 'Copy, then send.'}
            </p>
            <p className="mt-1 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
              {isId
                ? 'Yang paling depan tetap WhatsApp.'
                : 'WhatsApp stays first.'}
            </p>
          </div>
          <Link
            href="/settings#distribution"
            className="inline-flex h-9 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 text-[10px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/60"
          >
            <Settings2 className="h-3.5 w-3.5" />
            {isId ? 'Jalur share' : 'Channels'}
          </Link>
        </div>

        <div className="relative mt-3 flex flex-wrap gap-2">
          {whatsappChannel ? (
            <a
              href={whatsappChannel.shareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-[11px] font-semibold text-white shadow-[0_18px_28px_-20px_rgba(5,150,105,0.34)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isId ? 'WhatsApp' : 'WhatsApp'}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() =>
              void handleCopy(
                channels[0]?.caption || '',
                isId ? 'Caption utama' : 'Primary caption',
              )
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
          >
            <Copy className="h-3.5 w-3.5" />
            {isId ? 'Salin caption' : 'Copy caption'}
          </button>
          {listingUrl ? (
            <button
              type="button"
              onClick={() => void handleCopy(listingUrl, 'Link')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
            >
              <Link2 className="h-3.5 w-3.5" />
              {isId ? 'Salin link' : 'Copy link'}
            </button>
          ) : null}
          {listingUrl ? (
            <a
              href={listingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isId ? 'Lihat listing' : 'Open listing'}
            </a>
          ) : null}
          {coverImage ? (
            <a
              href={coverImage}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
            >
              <Download className="h-3.5 w-3.5" />
              {isId ? 'Cover' : 'Cover'}
            </a>
          ) : null}
        </div>

        <div className="relative mt-3 grid gap-2">
          {channels.slice(0, 4).map(channel => (
            <div
              key={channel.id}
              className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-3 py-2.5 shadow-[0_12px_22px_-18px_rgba(15,23,42,0.1)] backdrop-blur-sm dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/68"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-[11px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                      {channel.label}
                    </p>
                    <span
                      className={`inline-flex rounded-full border px-2 py-0.5 text-[9px] font-semibold ${
                        channel.status === 'connected'
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                          : channel.status === 'ready'
                            ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-200'
                            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                      }`}
                    >
                      {channel.status === 'connected'
                        ? isId
                          ? 'Terhubung'
                          : 'Connected'
                        : channel.status === 'ready'
                          ? isId
                            ? 'Siap'
                            : 'Ready'
                          : isId
                            ? 'Manual'
                            : 'Manual'}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-1 text-[10px] leading-4 text-[color:var(--app-text-soft)]">
                    {connections[channel.id]?.label || channel.helper}
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      void handleCopy(
                        channel.caption,
                        `${channel.label} caption`,
                      )
                    }
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[10px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
                  >
                    <Copy className="h-3 w-3" />
                    {isId ? 'Copy' : 'Copy'}
                  </button>
                  <a
                    href={channel.shareUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex h-8 items-center justify-center gap-1.5 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[10px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {isId ? 'Buka' : 'Open'}
                  </a>
                </div>
              </div>
            </div>
          ))}
        </div>

        {message ? (
          <p className="mt-3 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
            {message}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="relative overflow-hidden rounded-[22px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] p-3 shadow-[0_14px_28px_-24px_rgba(15,23,42,0.12)] dark:border-[color:var(--app-border-strong)] dark:bg-[color:var(--app-surface-strong)]">
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="inline-flex rounded-full border border-teal-200/80 bg-teal-50 px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-teal-700 dark:border-teal-900/70 dark:bg-teal-950/20 dark:text-teal-200">
            {isId ? 'Share Pack' : 'Share Pack'}
          </p>
          <p className="mt-2.5 text-[15px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
            {isId ? 'Sebarin' : 'Share listing'}
          </p>
          <p className="mt-1.5 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
            {isId
              ? 'Salin caption. Kirim ke channel.'
              : 'Copy the caption, open the channel, and send it. WhatsApp stays first.'}
          </p>
        </div>
        <Link
          href="/settings#distribution"
          className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-4 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55"
        >
          <Settings2 className="h-3.5 w-3.5" />
          {isId ? 'Channel' : 'Channels'}
        </Link>
      </div>

      <div className="relative mt-3 overflow-hidden rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 shadow-[0_12px_24px_-22px_rgba(15,23,42,0.1)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/55">
        <div className="flex items-start gap-2">
          <Megaphone className="mt-0.5 h-4 w-4 text-[color:var(--app-info)]" />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
              {input.title ||
                (isId
                  ? 'Judul belum ada'
                  : 'Listing title is not filled yet')}
            </p>
            <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
              {input.summary ||
                input.body ||
                (isId
                  ? 'Isi judul dan ringkasan dulu.'
                  : 'Add the title and summary first so the share pack becomes stronger.')}
            </p>
            {!listingUrl ? (
              <p className="mt-2 text-[11px] leading-5 text-[color:var(--app-warning)]">
                {isId
                  ? 'Publish dulu biar link aktif.'
                  : 'Publish the listing first to unlock the live link. The caption and posting paths can already be prepared now.'}
              </p>
            ) : null}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {whatsappChannel ? (
            <a
              href={whatsappChannel.shareUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 text-[11px] font-semibold text-white shadow-[0_18px_28px_-20px_rgba(5,150,105,0.34)]"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isId ? 'WhatsApp' : 'Continue in WhatsApp'}
            </a>
          ) : null}
          <button
            type="button"
            onClick={() =>
              void handleCopy(
                channels[0]?.caption || '',
                isId ? 'Caption utama' : 'Primary caption',
              )
            }
            className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
          >
            <Copy className="h-3.5 w-3.5" />
            {isId ? 'Caption' : 'Copy caption'}
          </button>
          {listingUrl ? (
            <button
              type="button"
              onClick={() => void handleCopy(listingUrl, 'Link')}
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
            >
              <Link2 className="h-3.5 w-3.5" />
              {isId ? 'Link' : 'Copy link'}
            </button>
          ) : null}
          {coverImage ? (
            <a
              href={coverImage}
              download
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
            >
              <Download className="h-3.5 w-3.5" />
              {isId ? 'Cover' : 'Download cover'}
            </a>
          ) : null}
          {listingUrl ? (
            <a
              href={listingUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex h-10 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
            >
              <ExternalLink className="h-3.5 w-3.5" />
              {isId ? 'Lihat' : 'Open listing'}
            </a>
          ) : null}
        </div>
      </div>

      <div className="mt-3 grid gap-2">
        {channels.map(channel => (
          <div
            key={channel.id}
            className="rounded-[18px] border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] p-3 shadow-[0_12px_22px_-18px_rgba(15,23,42,0.1)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/68"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[12px] font-semibold text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)]">
                    {channel.label}
                  </p>
                  <span
                    className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-semibold ${
                      channel.status === 'connected'
                        ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950/30 dark:text-emerald-200'
                        : channel.status === 'ready'
                          ? 'border-teal-200 bg-teal-50 text-teal-700 dark:border-teal-900 dark:bg-teal-950/30 dark:text-teal-200'
                          : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200'
                    }`}
                  >
                    {channel.status === 'connected'
                      ? isId
                        ? 'Terhubung'
                        : 'Connected'
                      : channel.status === 'ready'
                        ? isId
                          ? 'Siap'
                          : 'Ready'
                        : isId
                          ? 'Manual / open app'
                          : 'Manual / open app'}
                  </span>
                  {connections[channel.id]?.label ? (
                    <span className="inline-flex rounded-full border border-[color:var(--app-border)] bg-[color:var(--app-surface-muted)] px-2 py-0.5 text-[10px] font-semibold text-[color:var(--app-text-soft)]">
                      {connections[channel.id]?.label}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-[11px] leading-5 text-[color:var(--app-text-soft)]">
                  {channel.helper}
                </p>
              </div>
              <a
                href={channel.shareUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-2xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-4 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                {channel.actionLabel}
              </a>
            </div>

            <div className="mt-3 rounded-[18px] border border-slate-200/80 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-900/50">
              <p className="line-clamp-3 whitespace-pre-line text-[11px] leading-5 text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)]">
                {channel.caption}
              </p>
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  void handleCopy(channel.caption, `${channel.label} caption`)
                }
                className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
              >
                <Copy className="h-3.5 w-3.5" />
                {isId ? 'Salin caption' : 'Copy caption'}
              </button>
              {listingUrl ? (
                <button
                  type="button"
                  onClick={() =>
                    void handleCopy(listingUrl, `${channel.label} link`)
                  }
                  className="inline-flex h-9 items-center justify-center gap-2 rounded-xl border border-[color:var(--app-border)] bg-[color:var(--app-surface-strong)] px-3 text-[11px] font-semibold text-[color:var(--app-text)] dark:border-[color:var(--app-border-strong)] dark:bg-slate-950/70"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  {isId ? 'Salin link' : 'Copy link'}
                </button>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {message ? (
        <p className="mt-3 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
          {message}
        </p>
      ) : whatsappChannel ? (
        <p className="mt-3 text-[11px] font-semibold text-[color:var(--app-text-soft)]">
          {isId
            ? 'Tip: paling enak mulai dari WhatsApp dulu.'
            : 'Tip: start from WhatsApp first.'}
        </p>
      ) : null}
    </div>
  );
}
