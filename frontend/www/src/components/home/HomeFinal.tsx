import { HomeResponsiveMarketplace } from './HomeResponsiveMarketplace';

type HomeFinalProps = {
  locale?: string;
};

export default function LajukanResponsiveHome({
  locale = 'id',
}: HomeFinalProps) {
  return <HomeResponsiveMarketplace locale={locale} />;
}
