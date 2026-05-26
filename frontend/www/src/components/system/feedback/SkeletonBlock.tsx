import { cn } from '@/lib/utils';
import { Skeleton } from '@/components/ui/Skeleton';

type SkeletonBlockProps = {
  lines?: number;
  className?: string;
};

export function SkeletonBlock({ lines = 3, className }: SkeletonBlockProps) {
  const safeLines = Math.max(1, Math.min(8, lines));

  return (
    <div className={cn('space-y-2', className)} aria-hidden="true">
      {Array.from({ length: safeLines }).map((_, idx) => (
        <Skeleton
          key={idx}
          className={cn(
            'h-3.5 rounded',
            idx === safeLines - 1 && 'w-2/3',
          )}
        />
      ))}
    </div>
  );
}
