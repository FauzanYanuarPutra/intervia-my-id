'use client';

import { startTransition, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LogOut } from 'lucide-react';

type LogoutButtonProps = {
  compact?: boolean;
};

export function LogoutButton({ compact = false }: LogoutButtonProps) {
  const router = useRouter();
  const [isPending, setIsPending] = useState(false);

  async function handleLogout() {
    setIsPending(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
      });
    } finally {
      startTransition(() => {
        router.push('/');
        router.refresh();
      });
      setIsPending(false);
    }
  }

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={isPending}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-portal-line bg-white text-sm font-semibold text-portal-ink transition disabled:cursor-not-allowed disabled:opacity-60 ${
        compact ? 'min-h-10 px-4' : 'min-h-11 px-5'
      }`}
    >
      <LogOut className="h-4 w-4" />
      {isPending ? 'Keluar...' : 'Keluar'}
    </button>
  );
}
