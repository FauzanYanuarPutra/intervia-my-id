'use client';

import { type ReactNode } from 'react';

type CreateMarketplaceShellProps = {
  children: ReactNode;
};

export function CreateMarketplaceShell({
  children,
}: CreateMarketplaceShellProps) {
  return (
    <div className="relative min-h-screen overflow-x-hidden bg-transparent pb-6 pt-3 lg:py-4">
      <main className="page-shell page-shell-form min-w-0">
        <div className="space-y-3 pb-5">{children}</div>
      </main>
    </div>
  );
}

export default CreateMarketplaceShell;
