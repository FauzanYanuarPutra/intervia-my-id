import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

export default async function RootPage() {
  const cookieStore = await cookies();
  const rawLocale =
    cookieStore.get('NEXT_LOCALE')?.value ??
    cookieStore.get('locale')?.value ??
    'id';
  const locale = rawLocale === 'id' || rawLocale === 'en' ? rawLocale : 'id';
  redirect(`/${locale}/home`);
}
