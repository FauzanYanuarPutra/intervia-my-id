'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { ProductQuickForm } from '@/components/forms/ProductQuickForm';

export function ProductCreateModal({ businessId }: { businessId: string }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="portal-button-primary min-h-10 shrink-0 justify-center px-3.5 text-sm"
      >
        <Plus className="h-4 w-4" />
        Tambah produk
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-slate-950/45 p-0 backdrop-blur-[2px] sm:items-center sm:p-4"
          role="presentation"
          onMouseDown={event => {
            if (event.target === event.currentTarget) setOpen(false);
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="product-create-title"
            className="flex max-h-[92dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[24px] bg-white shadow-2xl ring-1 ring-slate-200 sm:rounded-[24px]"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-portal-line px-4 py-3.5 sm:px-5">
              <div className="min-w-0">
                <p id="product-create-title" className="text-base font-black text-portal-ink">
                  Tambah produk
                </p>
                <p className="mt-0.5 text-xs text-portal-soft">
                  Nama dan harga dulu. Detail lain bisa dilengkapi nanti.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Tutup"
                className="portal-button-ghost h-9 w-9 shrink-0 justify-center rounded-full p-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 overflow-y-auto p-4 sm:p-5">
              <ProductQuickForm businessId={businessId} />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
