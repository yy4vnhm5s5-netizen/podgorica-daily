import type { Metadata } from "next";
import { notFound } from "next/navigation";

import {
  isCityPublicFeatureRouteAvailable,
  resolveActiveCityFeatureRoute,
} from "@/app/city-routing";
import { createPublicRouteMetadata } from "@/app/public-route-metadata";
import { getGoingOutEvents } from "@/modules/going-out/application/get-going-out-events";
import { GoingOutPage } from "@/modules/going-out/presentation/going-out-page";
import { parseGoingOutUiFilters } from "@/modules/going-out/presentation/going-out-ui-model";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { getCityName } from "@/shared/config/cities";
import { getGoingOutPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

export const revalidate = 0;

interface GoingOutRouteProps {
  params: Promise<{ city: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

async function generateMetadata({ params }: GoingOutRouteProps): Promise<Metadata> {
  const { city: slug } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "goingOut");
  if (!context || !isCityPublicFeatureRouteAvailable(context.city, "goingOut")) return {};
  const cityName = getCityName(context.city, "locative");
  // The title used to append a list of nightlife categories the listing model does not store —
  // a keyword tail rather than a description of the page. "dešavanja" stays because it is the same
  // inventory under the word people actually search for, and it remains true on any day.
  const title = `Izlasci i dešavanja u ${cityName}`;
  const description = `Predstojeći izlasci i dešavanja u ${cityName}, grupisani po danima, sa vremenom početka i mjestom kada su poznati. Izvor: MonteGigs.`;
  const metadataTitle = getPageTitle(title);

  return createPublicRouteMetadata({
    canonical: getGoingOutPath(context.city),
    description,
    title: metadataTitle,
  });
}

async function GoingOutRoute({ params, searchParams }: GoingOutRouteProps) {
  const { city: slug } = await params;
  const locale = "me" as const;
  const context = resolveActiveCityFeatureRoute(slug, "goingOut");
  if (!context) notFound();
  if (!isCityPublicFeatureRouteAvailable(context.city, "goingOut")) notFound();
  const filters = parseGoingOutUiFilters(await searchParams);
  const result = await getGoingOutEvents(context);

  return (
    <DashboardLayout city={context.city} translations={getTranslations(locale)}>
      <GoingOutPage
        city={context.city}
        events={result.events}
        filters={filters}
        locale={locale}
        state={result.state}
      />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default GoingOutRoute;
