export type MerchantNextActionKind =
  | 'add_product'
  | 'add_ingredient'
  | 'build_recipe'
  | 'set_channel_price'
  | 'record_money'
  | 'reconcile_settlement'
  | 'restock'
  | 'healthy';

export type MerchantNextAction = {
  kind: MerchantNextActionKind;
  title: string;
  description: string;
  href: string;
  priority: number;
};

export type MerchantNextActionInput = {
  businessId: string;
  canViewCosting: boolean;
  productCount: number;
  ingredientCount: number;
  recipeCount: number;
  lowStockCount: number;
  enabledChannelCount: number;
  productsMissingChannelPriceCount: number;
  unreconciledSettlementCount: number;
  financeEntryCount: number;
};

export function buildMerchantNextActions(input: MerchantNextActionInput): MerchantNextAction[] {
  const base = `/businesses/${input.businessId}`;
  const actions: MerchantNextAction[] = [];

  if (input.lowStockCount > 0) {
    actions.push({
      kind: 'restock',
      title: `${input.lowStockCount} stok perlu ditangani`,
      description: 'Cek barang yang tipis atau habis sebelum menerima jualan berikutnya.',
      href: `${base}/inventory`,
      priority: 100,
    });
  }

  if (input.productCount === 0) {
    actions.push({
      kind: 'add_product',
      title: 'Tambahkan produk pertama',
      description: 'Mulai dari barang atau menu yang benar-benar kamu jual.',
      href: `${base}/products`,
      priority: 90,
    });
  } else if (input.canViewCosting && input.ingredientCount === 0) {
    actions.push({
      kind: 'add_ingredient',
      title: 'Isi bahan & kemasan',
      description: 'Catat bahan nyata agar modal per produk bisa dihitung dengan benar.',
      href: `${base}/inventory`,
      priority: 80,
    });
  } else if (input.canViewCosting && input.recipeCount === 0) {
    actions.push({
      kind: 'build_recipe',
      title: 'Atur resep & HPP',
      description: 'Hubungkan produk dengan bahan agar HPP berasal dari data usaha.',
      href: `${base}/products/hpp`,
      priority: 75,
    });
  }

  if (input.enabledChannelCount > 0 && input.productsMissingChannelPriceCount > 0) {
    actions.push({
      kind: 'set_channel_price',
      title: 'Lengkapi harga kanal jual',
      description: 'Tentukan harga hanya untuk kanal yang memang sedang digunakan.',
      href: `${base}/channels`,
      priority: 65,
    });
  }

  if (input.enabledChannelCount > 0 && input.unreconciledSettlementCount > 0) {
    actions.push({
      kind: 'reconcile_settlement',
      title: 'Cocokkan transfer platform',
      description: `${input.unreconciledSettlementCount} settlement tercatat belum dicocokkan.`,
      href: `${base}/finance`,
      priority: 70,
    });
  }

  if (input.financeEntryCount === 0) {
    actions.push({
      kind: 'record_money',
      title: 'Catat uang pertama',
      description: 'Mulai dari uang masuk atau uang keluar yang benar-benar terjadi.',
      href: `${base}/finance`,
      priority: 55,
    });
  }

  if (actions.length === 0) {
    return [{
      kind: 'healthy',
      title: 'Lanjutkan jualan',
      description: 'Tidak ada tindakan mendesak dari data usaha yang sudah tercatat.',
      href: `${base}/orders`,
      priority: 0,
    }];
  }

  return actions.sort((a, b) => b.priority - a.priority);
}
