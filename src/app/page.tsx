import { getFuelPrices } from "@/modules/fuel/infrastructure/gov-me-fuel-prices";
import { getMainCity } from "@/shared/config/cities";
import { isFeatureEnabled } from "@/shared/config/features";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getTranslations } from "@/shared/lib/translations";

import { getPlatformCityCards, getPlatformHomepageMetadata } from "@/app/platform-homepage-data";
import { PlatformHomepage } from "@/app/platform-homepage";

export const metadata = getPlatformHomepageMetadata();
export const revalidate = 0;

async function HomePage() {
  // The same read the /gorivo page performs: one cached snapshot, no collector, no network.
  const [cards, fuel] = await Promise.all([
    getPlatformCityCards(),
    isFeatureEnabled("fuelPrices") ? getFuelPrices() : Promise.resolve(undefined),
  ]);
  const city = getMainCity();

  return (
    <DashboardLayout city={city} homeHref="/" translations={getTranslations("me")}>
      <PlatformHomepage cards={cards} fuel={fuel} />
    </DashboardLayout>
  );
}

export default HomePage;
