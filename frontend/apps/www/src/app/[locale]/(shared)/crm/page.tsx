import CrmSecurityLogin from '@/components/crm/CrmSecurityLogin';

type PageProps = {
  params: Promise<{ locale: string }>;
};

export default async function CrmPage({ params }: PageProps) {
  const { locale } = await params;

  return <CrmSecurityLogin locale={locale} />;
}
