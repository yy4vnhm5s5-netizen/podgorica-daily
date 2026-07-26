import { getMainCity } from "@/shared/config/cities";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getTranslations } from "@/shared/lib/translations";

import { getPlatformCityCards, getPlatformHomepageMetadata } from "@/app/platform-homepage-data";
import { PlatformHomepage } from "@/app/platform-homepage";

export const metadata = getPlatformHomepageMetadata();
export const revalidate = 0;

async function HomePage() {
  const [cards, city] = await Promise.all([getPlatformCityCards(), Promise.resolve(getMainCity())]);

  return (
    <DashboardLayout
      brandVariant="platform"
      city={city}
      homeHref="/"
      translations={getTranslations("me")}
    >
      <PlatformHomepage cards={cards} />
    </DashboardLayout>
  );
}

export default HomePage;
