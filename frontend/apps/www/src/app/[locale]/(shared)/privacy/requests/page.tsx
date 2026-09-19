import { PrivacyRequestCenter } from '@/components/trust/PrivacyRequestCenter';

type Props = { params: Promise<{ locale: string }> };

export default async function PrivacyRequestsPage({ params }: Props) {
  const { locale } = await params;
  const isId = locale === 'id';

  return (
    <main className="page-shell page-shell-readable pb-10 pt-4">
      <PrivacyRequestCenter locale={isId ? 'id' : 'en'} />
    </main>
  );
}
