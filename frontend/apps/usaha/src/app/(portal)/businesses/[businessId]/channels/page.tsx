import { notFound } from 'next/navigation';
import { Boxes, Info, Store } from 'lucide-react';
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
      <SectionCard eyebrow="Kanal Jual" title="Aktifkan kanal yang benar-benar dipakai" description="Harga, fee, promo, dan HPP harus berasal dari data merchantmu. Lajukan tidak mengisi angka platform atau harga contoh secara diam-diam.">
        {canView ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Store className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Kanal aktif dulu</p><p className="mt-1 text-xs leading-5 text-portal-soft">Aktifkan hanya kanal yang memang sedang kamu gunakan.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Boxes className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Asumsi tersimpan</p><p className="mt-1 text-xs leading-5 text-portal-soft">Fee, promo merchant, biaya tetap, dan target margin tersimpan per kanal.</p></div>
              <div className="portal-panel p-4"><div className="portal-icon-tile"><Info className="h-4 w-4" /></div><p className="mt-3 font-bold text-portal-ink">Tidak hard-code fee</p><p className="mt-1 text-xs leading-5 text-portal-soft">Kontrak platform bisa berbeda per merchant dan bisa berubah.</p></div>
            </div>

            <div>
              <div className="mb-3"><p className="portal-kicker">Harga & margin per kanal</p><h2 className="mt-1 text-lg font-bold text-portal-ink">Bandingkan hanya dari angka nyata</h2><p className="mt-1 text-sm text-portal-soft">{numericPrice !== null ? `Harga ${product?.name ?? 'produk utama'} diambil dari produk yang tercatat.` : 'Harga jual produk belum valid.'} {canViewCosting ? (defaultHpp !== null ? 'HPP diambil dari resep dan bahan tersimpan.' : 'HPP durable belum lengkap; isi resep/HPP sebelum meminta harga minimum aman.') : 'HPP dan margin sensitif disembunyikan untuk peranmu.'}</p></div>
              <ChannelSettingsWorkspace businessId={business.id} initialChannels={channels} defaultPrice={numericPrice} defaultHpp={defaultHpp} canViewCosting={canViewCosting} />
            </div>

            <details className="portal-panel group">
              <summary className="cursor-pointer list-none p-4 sm:p-5"><span className="font-bold text-portal-ink">Data merchant untuk disalin</span><span className="ml-2 text-xs font-semibold text-portal-soft">Pengaturan lanjutan</span></summary>
              <div className="border-t border-portal-line p-3 sm:p-4"><MerchantCopyPack business={business} /></div>
            </details>
          </div>
        ) : (
          <div className="portal-panel p-5 text-sm text-portal-soft">Peranmu tidak memiliki akses mengelola kanal jual dan asumsi margin.</div>
        )}
      </SectionCard>
    </PortalShell>
  );
}
