import { LocalizedAnchor as Link } from '@/components/navigation/LocalizedAnchor';

type FeedColumnFooterProps = {
  isId: boolean;
};

export function FeedColumnFooter({ isId }: FeedColumnFooterProps) {
  const links = [
    { href: '/about', label: isId ? 'Tentang' : 'About' },
    { href: '/support', label: isId ? 'Bantuan' : 'Support' },
    { href: '/contact', label: isId ? 'Kontak' : 'Contact' },
    { href: '/privacy', label: isId ? 'Privasi' : 'Privacy' },
    { href: '/terms', label: isId ? 'Ketentuan' : 'Terms' },
  ];

  return (
    <footer
      data-testid="feed-column-footer"
      className="border-t border-[color:var(--app-border)] px-3 pb-2 pt-5 text-center text-[11px] text-[color:var(--app-text-soft)] dark:border-[color:var(--app-border-strong)]"
    >
      <nav
        aria-label={isId ? 'Tautan informasi' : 'Information links'}
        className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2"
      >
        {links.map(item => (
          <Link
            key={item.href}
            href={item.href}
            className="font-semibold transition hover:text-[color:var(--app-accent-strong)] hover:underline"
          >
            {item.label}
          </Link>
        ))}
      </nav>
      <p className="mt-3">
        &copy; {new Date().getFullYear()} Lajukan Indonesia
        <span aria-hidden="true"> · </span>
        {isId
          ? 'Jelas kebutuhannya, tepat mitranya.'
          : 'Clear needs, better-matched partners.'}
      </p>
    </footer>
  );
}
