import type { OverviewModel } from './types';
import { NextActionStrip } from './components/NextActionStrip';
import { OverviewHero } from './components/OverviewHero';
import { OverviewStoreList } from './components/OverviewStoreList';

export function UsahaOverview({
  isId,
  model,
}: {
  isId: boolean;
  model: OverviewModel;
}) {
  return (
    <main className="page-shell overflow-x-hidden bg-[#fbfaf7] py-0 pb-8 dark:bg-slate-950 sm:py-4">
      <div className="mx-auto flex w-full max-w-[1180px] flex-col gap-3 px-2 sm:px-4">
        <OverviewHero isId={isId} model={model} />
        <NextActionStrip action={model.nextAction} isId={isId} />
        <OverviewStoreList
          addStoreAction={model.addStoreAction}
          isId={isId}
          stores={model.storeChoices}
        />
      </div>
    </main>
  );
}
