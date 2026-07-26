'use client';

import { type ReactNode } from 'react';

type CreateMarketplaceShellProps = {
  children: ReactNode;
};

export function CreateMarketplaceShell({
  children,
}: CreateMarketplaceShellProps) {
  return (
    <div className=" relative min-h-screen overflow-x-hidden bg-transparent px-2 pb-6 pt-3 sm:px-4 lg:px-5 lg:py-4">
      <main className="mx-auto min-w-0 w-full max-w-[1180px]">
        <div className="space-y-3 pb-5">{children}</div>
      </main>
    </div>
  );
}

export default CreateMarketplaceShell;
