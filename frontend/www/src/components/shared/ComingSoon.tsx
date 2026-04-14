'use client';

import { Construction } from 'lucide-react';
import { LocalizedLink } from '@/components/ui-kit';

interface ComingSoonProps {
  title: string;
  descriptionId: string;
  descriptionEn: string;
}

export function ComingSoon({ title, descriptionId, descriptionEn }: ComingSoonProps) {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="w-16 h-16 bg-[color:var(--app-accent-soft)] dark:bg-[color:color-mix(in_srgb,_var(--app-accent-strong)_30%,_transparent)] rounded-2xl flex items-center justify-center mb-5">
        <Construction className="w-8 h-8 text-[color:var(--app-accent)]" />
      </div>
      <h1 className="text-2xl font-black text-[color:var(--app-text)] dark:text-[color:var(--app-text-inverse)] mb-2">{title}</h1>
      <p className="text-sm text-[color:var(--app-text)] dark:text-[color:var(--app-text-soft)] max-w-md mb-1">{descriptionId}</p>
      <p className="text-xs text-[color:var(--app-text-soft)] dark:text-[color:var(--app-text)] max-w-md italic mb-6">{descriptionEn}</p>
      <LocalizedLink
        href="/home"
        className="px-6 py-2.5 bg-[color:var(--app-accent)] hover:bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)] text-sm font-bold rounded-xl transition-colors"
      >
        Kembali ke Beranda
      </LocalizedLink>
    </div>
  );
}
