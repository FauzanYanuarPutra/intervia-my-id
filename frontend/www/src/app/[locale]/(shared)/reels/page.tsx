import { getReelsPage, lajukanReels } from "../../_data/reels";
import ReelsClient from "./ReelsClient";

type PageProps = {
  params: Promise<{ locale: string }>;
  searchParams: Promise<{ video?: string }>;
};

export default async function ReelsPage({ params, searchParams }: PageProps) {
  const { locale } = await params;
  const { video } = await searchParams;

  const requestedIndex = Math.min(
    Math.max(Number(video || 1) - 1, 0),
    Math.max(lajukanReels.length - 1, 0),
  );

  const initialLimit = Math.max(3, requestedIndex + 3);
  const initialPage = getReelsPage(0, initialLimit);

  return (
    <ReelsClient
      locale={locale}
      initialIndex={requestedIndex}
      initialItems={initialPage.items}
      initialCursor={initialPage.nextCursor}
      initialHasMore={initialPage.hasMore}
    />
  );
}