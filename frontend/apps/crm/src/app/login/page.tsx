'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Input } from '@/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const wwwUrl = process.env.NEXT_PUBLIC_WWW_URL || 'http://localhost:3000';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(false);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setNotice('');
    setLoading(true);
    try {
      const nextPath = typeof window === 'undefined' ? null : new URLSearchParams(window.location.search).get('next');
      await login(email, password, nextPath);
      setNotice('Login berhasil. Membuka CRM command center...');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] items-center justify-center px-3 py-4 sm:px-5">
      <div className="grid w-full max-w-[920px] overflow-hidden rounded-[28px] border border-[color:color-mix(in_srgb,_var(--color-border)_80%,_transparent)] bg-[color:color-mix(in_srgb,_var(--color-surface)_92%,_transparent)] shadow-[0_28px_70px_color-mix(in_srgb,var(--color-text)_12%,transparent)] lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="p-5 sm:p-7">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[color:var(--color-primary)]">CRM Ops</p>
          <h1 className="mt-2 text-2xl font-semibold tracking-[-0.03em] text-[color:var(--color-text)] sm:text-3xl">Masuk CRM</h1>
          <p className="mt-2 max-w-md text-sm leading-6 text-[color:var(--color-text)]">
            Gunakan akun Lajukan nyata yang sudah diverifikasi dan memiliki role CRM. Tidak ada lagi akun demo atau password bersama.
          </p>
          {error ? <div className="mt-5 rounded-2xl border border-[color:var(--color-danger-border)] bg-[color:var(--color-danger-soft)] px-4 py-3 text-sm text-[color:var(--color-danger)]">{error}</div> : null}
          {notice ? <div className="mt-5 rounded-2xl border border-[color:var(--color-primary-border)] bg-[color:var(--color-primary-soft)] px-4 py-3 text-sm text-[color:var(--color-primary)]">{notice}</div> : null}
          <form onSubmit={handlePasswordSubmit} className="mt-6 space-y-4">
            <Input label="Email atau username" type="text" value={email} onChange={e => setEmail(e.target.value)} placeholder="nama@lajukan.com atau @username" autoComplete="username" required />
            <Input label="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="Password akun" autoComplete="current-password" required />
            <Button type="submit" disabled={loading} className="w-full">{loading ? 'Membuka CRM...' : 'Masuk CRM'}</Button>
          </form>
          <div className="mt-5 rounded-2xl border border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_72%,_transparent)] px-4 py-3 text-sm leading-6 text-[color:var(--color-text)]">
            Kredensial disimpan sebagai HttpOnly session cookie. Aksi sensitif tetap memakai session confirmation dan audit trail.
          </div>
          <p className="mt-6 text-center"><a href={wwwUrl} className="text-sm font-medium text-[color:var(--color-text)] hover:text-[color:var(--color-primary)]">&larr; Kembali ke situs</a></p>
        </section>
        <aside className="border-t border-[color:var(--color-border)] bg-[color:color-mix(in_srgb,_var(--color-surface-muted)_76%,_transparent)] p-5 sm:p-7 lg:border-l lg:border-t-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-[color:var(--color-primary)]">Connected Ops</p>
          <h2 className="mt-2 text-lg font-semibold text-[color:var(--color-text)]">Terhubung ke Lajukan WWW</h2>
          <div className="mt-4 space-y-3 text-sm leading-6 text-[color:var(--color-text)]">
            <p>Lead listing, ticket support, dan risk signal masuk ke CRM.</p>
            <p>Agent bisa follow-up user tanpa bolak-balik dashboard.</p>
            <p>Aksi sensitif tetap dikonfirmasi dan dicatat untuk audit.</p>
          </div>
          <div className="mt-5 grid grid-cols-3 gap-2 text-center text-[11px] font-semibold text-[color:var(--color-text)]">
            {['Role', 'Audit', 'WWW Sync'].map(item => <span key={item} className="rounded-2xl border border-[color:var(--color-border)] bg-[color:var(--color-surface)] px-2 py-2">{item}</span>)}
          </div>
        </aside>
      </div>
    </div>
  );
}
