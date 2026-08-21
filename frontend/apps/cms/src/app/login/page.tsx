'use client';

import React, { useState } from 'react';
import { useAuth } from '@/context/AuthContext';
import { Button, Input } from '@/ui';

export default function LoginPage() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Login gagal. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg p-6 shadow-sm">
        <h1 className="text-xl font-semibold text-[color:var(--color-text)] mb-1">Lajukan CMS</h1>
        <p className="text-sm text-[color:var(--color-text)] mb-6">Kelola konten & sektor</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {error && (
            <div className="p-3 text-sm text-[color:var(--color-danger)] bg-[color:var(--color-danger-soft)] border border-[color:var(--color-danger-border)] rounded-lg">
              {error}
            </div>
          )}
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@contoh.com"
            required
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="••••••••"
            required
          />
          <Button type="submit" disabled={loading} className="w-full">
            {loading ? 'Memproses...' : 'Masuk'}
          </Button>
        </form>

        <p className="mt-6 text-center">
          <a
            href={process.env.NEXT_PUBLIC_WWW_URL || 'http://localhost:3000'}
            className="text-sm text-[color:var(--color-text)] hover:text-[color:var(--color-text)]"
          >
            ← Kembali ke situs
          </a>
        </p>
      </div>
    </div>
  );
}