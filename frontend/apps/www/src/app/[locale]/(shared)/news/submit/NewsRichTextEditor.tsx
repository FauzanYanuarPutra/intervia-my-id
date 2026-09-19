'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bold, Code2, Eye, Heading2, Heading3, ImagePlus, Italic, Link2, List, ListOrdered, Quote, Redo2, Undo2, Underline } from 'lucide-react';

type Props = {
  value: string;
  onChange: (html: string, plainText: string) => void;
  locale: string;
};

const MAX_CHARS = 20_000;

function textFromHtml(html: string) {
  if (typeof window === 'undefined') return html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
}

export default function NewsRichTextEditor({ value, onChange, locale }: Props) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [preview, setPreview] = useState(false);
  const [saved, setSaved] = useState(false);
  const isId = locale === 'id';

  useEffect(() => {
    if (!editorRef.current || editorRef.current.innerHTML === value) return;
    editorRef.current.innerHTML = value || '<p><br></p>';
  }, [value]);

  const plainText = useMemo(() => textFromHtml(value), [value]);

  const emit = () => {
    const html = editorRef.current?.innerHTML || '';
    const text = textFromHtml(html);
    onChange(html, text);
    try {
      localStorage.setItem('lajukan-news-draft', JSON.stringify({ value: html }));
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1200);
    } catch {}
  };

  const command = (name: string, arg?: string) => {
    editorRef.current?.focus();
    document.execCommand(name, false, arg);
    emit();
  };

  const insertLink = () => {
    const url = window.prompt(isId ? 'URL tautan' : 'Link URL');
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      command('createLink', parsed.toString());
    } catch {}
  };

  const insertImage = () => {
    const url = window.prompt(isId ? 'URL gambar publik' : 'Public image URL');
    if (!url) return;
    try {
      const parsed = new URL(url);
      if (!['http:', 'https:'].includes(parsed.protocol)) return;
      command('insertImage', parsed.toString());
    } catch {}
  };

  const restoreDraft = () => {
    try {
      const draft = JSON.parse(localStorage.getItem('lajukan-news-draft') || 'null') as { value?: string };
      if (draft?.value && editorRef.current) {
        editorRef.current.innerHTML = draft.value;
        emit();
      }
    } catch {}
  };

  const tools = [
    { action: 'bold', Icon: Bold },
    { action: 'italic', Icon: Italic },
    { action: 'underline', Icon: Underline },
    { action: 'formatBlock:H2', Icon: Heading2 },
    { action: 'formatBlock:H3', Icon: Heading3 },
    { action: 'insertUnorderedList', Icon: List },
    { action: 'insertOrderedList', Icon: ListOrdered },
    { action: 'formatBlock:BLOCKQUOTE', Icon: Quote },
    { action: 'formatBlock:PRE', Icon: Code2 },
  ] as const;

  return (
    <div className="mt-1 overflow-hidden rounded-2xl border border-slate-200 bg-white dark:border-white/10 dark:bg-slate-950">
      <div className="flex flex-wrap items-center gap-1 border-b border-slate-200 bg-slate-50 p-2 dark:border-white/10 dark:bg-white/[0.04]" role="toolbar" aria-label={isId ? 'Format tulisan' : 'Text formatting'}>
        {tools.map(({ action, Icon }) => (
          <button key={action} type="button" title={action} onMouseDown={e => e.preventDefault()} onClick={() => {
            const [name, arg] = action.split(':');
            command(name, arg);
          }} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-white/10">
            <Icon className="h-4 w-4" />
          </button>
        ))}
        <span className="mx-1 h-6 w-px bg-slate-200 dark:bg-white/10" />
        <button type="button" title="Link" onMouseDown={e => e.preventDefault()} onClick={insertLink} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-white/10"><Link2 className="h-4 w-4" /></button>
        <button type="button" title="Image" onMouseDown={e => e.preventDefault()} onClick={insertImage} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-white hover:text-emerald-700 dark:text-slate-300 dark:hover:bg-white/10"><ImagePlus className="h-4 w-4" /></button>
        <button type="button" title="Undo" onClick={() => command('undo')} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10"><Undo2 className="h-4 w-4" /></button>
        <button type="button" title="Redo" onClick={() => command('redo')} className="inline-flex h-9 w-9 items-center justify-center rounded-lg text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10"><Redo2 className="h-4 w-4" /></button>
        <button type="button" onClick={() => setPreview(v => !v)} className="ml-auto inline-flex h-9 items-center gap-2 rounded-lg px-3 text-xs font-bold text-slate-600 hover:bg-white dark:text-slate-300 dark:hover:bg-white/10"><Eye className="h-4 w-4" />{preview ? (isId ? 'Edit' : 'Edit') : (isId ? 'Preview' : 'Preview')}</button>
      </div>
      {preview ? (
        <div className="prose prose-slate max-w-none min-h-[320px] p-5 dark:prose-invert" dangerouslySetInnerHTML={{ __html: value || '<p>Belum ada isi.</p>' }} />
      ) : (
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          role="textbox"
          aria-multiline="true"
          onInput={emit}
          onBlur={emit}
          className="min-h-[320px] px-5 py-4 text-[15px] font-medium leading-8 text-slate-800 outline-none dark:text-slate-100 [&_blockquote]:my-4 [&_blockquote]:border-l-4 [&_blockquote]:border-emerald-500 [&_blockquote]:pl-4 [&_h2]:mt-5 [&_h2]:text-2xl [&_h2]:font-bold [&_h3]:mt-4 [&_h3]:text-xl [&_h3]:font-bold [&_img]:my-4 [&_img]:max-h-[520px] [&_img]:rounded-2xl [&_img]:object-cover [&_li]:ml-6 [&_ol]:list-decimal [&_p]:my-3 [&_pre]:overflow-x-auto [&_pre]:rounded-xl [&_pre]:bg-slate-950 [&_pre]:p-4 [&_pre]:text-slate-100 [&_ul]:list-disc"
          data-placeholder={isId ? 'Tulis berita kamu di sini...' : 'Write your story here...'}
        />
      )}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-slate-200 px-4 py-2 text-xs font-semibold text-slate-500 dark:border-white/10 dark:text-slate-400">
        <span>{plainText.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} {isId ? 'karakter' : 'characters'}</span>
        <span>{saved ? (isId ? 'Draft tersimpan di perangkat' : 'Draft saved locally') : (isId ? 'Tersimpan otomatis' : 'Autosaved')}</span>
      </div>
      {plainText.length > MAX_CHARS ? <p className="px-4 pb-3 text-xs font-bold text-red-600">{isId ? 'Isi terlalu panjang.' : 'Content is too long.'}</p> : null}
      <button type="button" onClick={restoreDraft} className="hidden">Restore draft</button>
    </div>
  );
}
