// app/components/NetworkStatus.tsx
'use client';
import { useState, useEffect } from 'react';
import { Z_INDEX } from '../constants/z-index';

export default function NetworkStatus() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    update();
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (online) return null;
  return (
    <div
      className="fixed inset-0 bg-[color:color-mix(in_srgb,_var(--app-surface-strong)_20%,_transparent)]  flex items-center justify-center"
      style={{ zIndex: Z_INDEX.offline }}
    >
      <div className="bg-[color:var(--app-surface-strong)] p-10 rounded-lg">⚠️ Kamu sedang offline ⚠️</div>
    </div>
  );
}