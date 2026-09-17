'use client';

import { useRouter } from 'next/navigation';
import { ProductManageForm } from '@/components/forms/ProductManageForm';
import type { ProductRecord } from '@/lib/portal-types';

type Props = {
  businessId: string;
  product: ProductRecord;
  closeHref: string;
};

export function ProductManageQueryModal({ businessId, product, closeHref }: Props) {
  const router = useRouter();

  function handleOpenChange(open: boolean) {
    if (!open) router.replace(closeHref, { scroll: false });
  }

  return (
    <ProductManageForm
      businessId={businessId}
      product={product}
      open
      onOpenChange={handleOpenChange}
      showTrigger={false}
    />
  );
}
