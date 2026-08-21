import { Link } from '@/i18n/navigation';
import { cn } from '@/lib/utils';
import type { OverviewAction } from '../types';

export function OverviewActionLink({
  action,
  primary = false,
}: {
  action: OverviewAction;
  primary?: boolean;
}) {
  return (
    <Link
      href={action.href}
      className={cn(
        primary ? 'ui-button-primary' : 'ui-button-secondary',
        'inline-flex min-h-10 items-center justify-center px-4 text-sm font-semibold',
      )}
    >
      {action.label}
    </Link>
  );
}
