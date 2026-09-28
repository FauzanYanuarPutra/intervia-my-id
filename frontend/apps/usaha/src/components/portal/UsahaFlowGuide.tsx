import Link from 'next/link';
import { ArrowRight, CheckCircle2 } from 'lucide-react';
import type { BusinessRecord } from '@/lib/portal-types';
import { getSetupSteps } from '@/lib/portal-logic';

type UsahaFlowGuideProps = {
  business: BusinessRecord;
  currentSection: Parameters<typeof getSetupSteps>[0] extends never ? never : 'home' | string;
};

const href = (businessId: string, path = '') => '/businesses/' + businessId + path;

function nextSetupHref(businessId: string, id: string) {
  switch (id) {
    case 'locations':
      return href(businessId, '/locations');
    case 'products':
      return href(businessId, '/products');
    case 'operations':
      return href(businessId, '/operations');
    case 'buyer-page':
      return href(businessId, '/buyer-page');
    default:
      return href(businessId, '/info');
  }
}

export function UsahaFlowGuide({ business, currentSection }: UsahaFlowGuideProps) {
  if (currentSection !== 'home') return null;

  const next = getSetupSteps(business).find(step => !step.done && !step.optional);
  if (!next) return null;

  return (
    <section
      className="merchant-surface-bordered overflow-hidden"
      aria-labelledby="usaha-next-step-title"
    >
      <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-start gap-3">
          <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-portal-mist text-portal-forest">
            <CheckCircle2 className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-black uppercase tracking-[.12em] text-portal-forest">
              Langkah berikutnya
            </p>
            <h2 id="usaha-next-step-title" className="mt-1 text-base font-black tracking-[-.025em] text-portal-ink">
              {next.label}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-5 text-portal-soft">{next.hint}</p>
          </div>
        </div>
        <Link
          href={nextSetupHref(business.id, next.id)}
          className="portal-button-primary shrink-0"
        >
          Kerjakan <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    </section>
  );
}
