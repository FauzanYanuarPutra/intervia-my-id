import { cn } from '@/lib/utils';

type LajukanLogoProps = {
  compact?: boolean;
  markOnly?: boolean;
  className?: string;
  markClassName?: string;
  textClassName?: string;
};

export function LajukanLogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center text-[color:var(--app-accent)] drop-shadow-[0_12px_24px_rgba(7,148,85,0.22)]',
        className,
      )}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 64 64"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="h-full w-full"
      >
        <rect x="5" y="5" width="54" height="54" rx="17" fill="currentColor" />
        <path
          d="M12 19.5C17.1 11.7 25.5 8.4 36.4 9.1c7.8.5 14 3.8 18.5 9.7v-3.6C54.9 9.6 50.4 5 44.8 5H22.3C16.7 5 12 9.7 12 15.3v4.2Z"
          fill="white"
          opacity="0.16"
        />
        <path
          d="M8 43.5c9.2 8.7 20.3 12.7 34.5 11.8C52.4 54.7 59 49.2 59 40.5V49c0 5.5-4.5 10-10 10H15c-5.5 0-10-4.5-10-10v-8.1c.9.9 1.9 1.8 3 2.6Z"
          fill="#052E1A"
          opacity="0.15"
        />
        <path
          d="M21 19.5V44h19.4"
          stroke="white"
          strokeWidth="7.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M36.2 32.4 47.4 43.6 36.2 54.8"
          stroke="white"
          strokeWidth="7.4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M21 19.5V44h19.4"
          stroke="#DFFDEA"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.72"
        />
        <path
          d="M36.2 32.4 47.4 43.6 36.2 54.8"
          stroke="#DFFDEA"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity="0.72"
        />
        <path
          d="M19 51.5h10"
          stroke="#DFFDEA"
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.55"
        />
        <circle cx="46.8" cy="18.6" r="3.4" fill="white" opacity="0.28" />
      </svg>
    </span>
  );
}

const LajukanLogo = ({
  compact = false,
  markOnly = false,
  className,
  markClassName,
  textClassName,
}: LajukanLogoProps) => {
  return (
    <div
      className={cn(
        'group inline-flex select-none items-center gap-2.5 whitespace-nowrap',
        className,
      )}
    >
      <LajukanLogoMark
        className={cn(
          compact ? 'h-8 w-8' : 'h-8 w-8 sm:h-9 sm:w-9',
          markClassName,
        )}
      />
      {markOnly ? null : (
        <span
          className={cn(
            compact ? 'text-lg' : 'text-xl sm:text-[1.35rem]',
            'font-bold leading-none tracking-[-0.035em] text-[color:var(--app-text)] transition-colors group-hover:text-[color:var(--app-accent)]',
            textClassName,
          )}
        >
          Lajukan
        </span>
      )}
    </div>
  );
};

export default LajukanLogo;
