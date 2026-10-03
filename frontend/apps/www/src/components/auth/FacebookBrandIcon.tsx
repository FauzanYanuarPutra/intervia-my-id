type FacebookBrandIconProps = {
  className?: string;
};

export function FacebookBrandIcon({ className }: FacebookBrandIconProps) {
  return (
    <svg
      aria-hidden="true"
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      focusable="false"
    >
      <path
        d="M13.5 21v-7h2.4l.45-2.8H13.5V9.38c0-.81.4-1.38 1.55-1.38H16.5V5.49c-.25-.04-1.1-.14-2.1-.14-2.08 0-3.5 1.27-3.5 3.6v2.25H8.5V14h2.4v7h2.6Z"
      />
    </svg>
  );
}
