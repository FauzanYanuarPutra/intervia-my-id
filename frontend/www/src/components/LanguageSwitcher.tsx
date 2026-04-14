'use client';
import { useRouter, usePathname } from '@/i18n/navigation';
import { routing } from '@/i18n/routing';

export function LanguageSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const currentLocale = pathname.split('/')[1];
  const otherLocales = routing.locales.filter(l => l !== currentLocale);

  const handleSwitch = (locale: string) => {
    router.replace(pathname, { locale });
  };

  return (
    <div className="flex gap-2">
      {otherLocales.map(locale => (
        <button
          key={locale}
          onClick={() => handleSwitch(locale)}
          className="px-3 py-1 rounded bg-[color:var(--app-accent)] text-[color:var(--app-text-inverse)]"
        >
          {locale.toUpperCase()}
        </button>
      ))}
    </div>
  );
}