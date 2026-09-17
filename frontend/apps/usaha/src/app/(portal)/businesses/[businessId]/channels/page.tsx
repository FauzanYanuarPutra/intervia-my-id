import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Store } from 'lucide-react';
import { ChannelSettingsWorkspace } from '@/components/business-control/ChannelSettingsWorkspace';
import { MerchantCopyPack } from '@/components/business-control/MerchantCopyPack';
import { PageHeader } from '@/components/portal/PageHeader';
import { PortalShell } from '@/components/portal/PortalShell';
import {
  getControlRecipe,
  listControlChannels,
  listControlIngredients,
  type ControlIngredient,
  type ControlRecipe,
} from '@/lib/business-control-server';
import { parseRecordedProductPrice } from '@/lib/business-control/channel-readiness';
import { calculateRecipeCost, type IngredientCostInput } from '@/lib/business-control/costing';
import { hasPermission } from '@/lib/portal-logic';
import { resolvePortalBusinessPageState } from '@/lib/portal-server';

type PageProps = { params: Promise<{ businessId: string }> };

function n(value: string | number | null | undefined) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function recordedRecipeHpp(recipe: ControlRecipe | null, ingredients: ControlIngredient[]): number | null {
  if (!recipe?.items.length) return null;
  const servings = n(recipe.recipe.servings);
  if (servings <= 0) return null;
  const ingredientMap = new Map(ingredients.map(item => [item.id, item]));
  const rows: IngredientCostInput[] = [];

  for (const item of recipe.items) {
    const ingredient = ingredientMap.get(item.ingredient_id);
    if (!ingredient) return null;
    const purchaseQuantity = n(ingredient.purchase_quantity);
    const conversionFactor = n(ingredient.conversion_factor);
    const yieldPercent = n(ingredient.yield_percent);
    if (purchaseQuantity <= 0 || conversionFactor <= 0 || yieldPercent <= 0) return null;
    rows.push({
      name: ingredient.name,
      purchasePrice: ingredient.purchase_price_amount,
      purchaseQuantity,
      conversionFactor,
      yieldPercent,
      wastePercent: item.waste_percent_override === null ? n(ingredient.waste_percent) : n(item.waste_percent_override),
      recipeQuantity: n(item.quantity) / servings,
    });
  }

  try {
    const total = calculateRecipeCost(rows).totalCost;
    return Number.isFinite(total) && total > 0 ? total : null;
  } catch {
    return null;
  }
}

export default async function BusinessChannelsPage({ params }: PageProps) {
  const { businessId } = await params;
  const { account, businesses, activeBusiness } = await resolvePortalBusinessPageState(businessId);
  const business = activeBusiness;
  if (!business) notFound();

  const canView = hasPermission(business, 'viewChannels');
  const canViewCosting = hasPermission(business, 'viewCosting');
  const product = business.products.find(item => item.status === 'live') ?? business.products[0];
  const [channels, ingredients, recipe] = await Promise.all([
    canView ? listControlChannels(business.id) : Promise.resolve([]),
    canView && canViewCosting ? listControlIngredients(business.id) : Promise.resolve([]),
    canView && canViewCosting && product ? getControlRecipe(business.id, product.id) : Promise.resolve(null),
  ]);
  const numericPrice = parseRecordedProductPrice(product?.priceLabel);
  const defaultHpp = canViewCosting ? recordedRecipeHpp(recipe, ingredients) : null;
  const enabledCount = channels.filter(channel => channel.enabled).length;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="channels">
      <PageHeader eyebrow="Jual Online" title="Harga online" description="Atur potongan aplikasi dari angka yang benar-benar berlaku, lalu lihat harga online yang aman." />

      {canView ? (
        <div className="space-y-4">
          <section className="merchant-surface-bordered p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[11px] font-semibold text-portal-soft">Kanal aktif</p>
                <p className="mt-1 text-2xl font-black text-portal-ink">{enabledCount}<span className="ml-1 text-sm font-semibold text-portal-soft">/ {channels.length || '—'}</span></p>
                <p className="mt-1 text-xs leading-5 text-portal-soft">{numericPrice !== null ? `Harga ${product?.name ?? 'produk utama'} sudah terbaca dari katalog.` : 'Harga produk utama belum tersedia.'}</p>
              </div>
              <Link href={`/businesses/${business.id}/buyer-page`} className="portal-button-secondary"><Store className="h-4 w-4" /> Tampilan toko</Link>
            </div>
          </section>

          <ChannelSettingsWorkspace
            businessId={business.id}
            initialChannels={channels}
            defaultPrice={numericPrice}
            defaultHpp={defaultHpp}
            canViewCosting={canViewCosting}
          />

          <details className="merchant-surface-bordered group">
            <summary className="cursor-pointer list-none px-4 py-3.5 sm:px-5"><span className="font-black text-portal-ink">Data toko untuk aplikasi lain</span><span className="ml-2 text-xs font-semibold text-portal-soft">Opsional</span></summary>
            <div className="border-t border-portal-line/70 p-3 sm:p-4"><MerchantCopyPack business={business} /></div>
          </details>
        </div>
      ) : (
        <div className="merchant-surface-bordered p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses mengatur tempat jualan online dan harga.</div>
      )}
    </PortalShell>
  );
}
