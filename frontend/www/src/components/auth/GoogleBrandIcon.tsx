'use client';

import { cn } from '@/lib/utils';

type GoogleBrandIconProps = {
  className?: string;
};

export function GoogleBrandIcon({ className }: GoogleBrandIconProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        'relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full',
        className,
      )}
    >
      <span className="absolute inset-0 rounded-full bg-[conic-gradient(from_45deg,#ea4335_0_25%,#fbbc05_25%_50%,#34a853_50%_75%,#4285f4_75%_100%)]" />
      <span className="absolute inset-[14%] rounded-full bg-white" />
      <span className="absolute left-[48%] top-1/2 h-[16%] w-[34%] -translate-y-1/2 rounded-r-full bg-[#4285f4]" />
      <span className="absolute left-[57%] top-[50.5%] h-[12%] w-[12%] -translate-y-1/2 rounded-sm bg-[#4285f4]" />
    </span>
  );
}
