import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Store } from 'lucide-react';
import { ChannelSettingsWorkspace } from '@/components/business-control/ChannelSettingsWorkspace';
import { MerchantCopyPack } from '@/components/business-control/MerchantCopyPack';
import { PortalShell } from '@/components/portal/PortalShell';
import { SectionCard } from '@/components/portal/SectionCard';
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
    canView && canViewCosting && product
      ? getControlRecipe(business.id, product.id)
      : Promise.resolve(null),
  ]);
  const numericPrice = parseRecordedProductPrice(product?.priceLabel);
  const defaultHpp = canViewCosting ? recordedRecipeHpp(recipe, ingredients) : null;

  return (
    <PortalShell activeBusiness={business} availableBusinesses={businesses} viewerName={account?.name ?? null} currentSection="channels">
      <SectionCard eyebrow="Jual Online" title="Atur harga tanpa menebak" description="Masukkan potongan aplikasi dan promo yang benar-benar berlaku. Lajukan membantu membandingkan uang yang diterima tanpa mengarang angka.">
        {canView ? (
          <div className="space-y-4">
            <section className="rounded-xl border border-portal-line bg-white p-4 sm:p-5">
              <p className="text-sm font-bold text-portal-ink">Pertanyaan utamanya sederhana:</p>
              <p className="mt-1 text-lg font-bold tracking-[-0.025em] text-portal-forest">Kalau harga toko segini, berapa harga online agar tetap aman?</p>
              <p className="mt-2 text-sm leading-6 text-portal-soft">{numericPrice !== null ? `Harga ${product?.name ?? 'produk utama'} sudah diambil dari produk.` : 'Harga jual produk belum tersedia.'} {canViewCosting ? (defaultHpp !== null ? 'Modal produk juga sudah tersedia untuk perbandingan.' : 'Modal produk belum lengkap; hasil laba akan ditandai belum siap.') : 'Detail modal disembunyikan sesuai aksesmu.'}</p>
            </section>

            <ChannelSettingsWorkspace businessId={business.id} initialChannels={channels} defaultPrice={numericPrice} defaultHpp={defaultHpp} canViewCosting={canViewCosting} />

            <div className="grid gap-3 sm:grid-cols-2">
              <Link href={`/businesses/${business.id}/buyer-page`} className="rounded-xl border border-portal-line bg-white p-4 transition hover:bg-portal-mist/40">
                <Store className="h-4 w-4 text-portal-forest" />
                <p className="mt-3 font-bold text-portal-ink">Tampilan Toko</p>
                <p className="mt-1 text-sm leading-6 text-portal-soft">Atur bagaimana produk dan usaha terlihat oleh pelanggan.</p>
              </Link>
              <details className="rounded-xl border border-portal-line bg-white">
                <summary className="cursor-pointer list-none p-4"><span className="font-bold text-portal-ink">Data toko untuk aplikasi lain</span><span className="ml-2 text-xs font-semibold text-portal-soft">Opsional</span></summary>
                <div className="border-t border-portal-line p-3 sm:p-4"><MerchantCopyPack business={business} /></div>
              </details>
            </div>
          </div>
        ) : (
          <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses mengatur tempat jualan online dan harga.</div>
        )}
      </SectionCard>
    </PortalShell>
  );
}
