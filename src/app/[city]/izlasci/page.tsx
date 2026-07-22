import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { resolveActiveCityFeatureRoute } from "@/app/city-routing";
import { getGoingOutEvents } from "@/modules/going-out/application/get-going-out-events";
import { GoingOutPage } from "@/modules/going-out/presentation/going-out-page";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { isFeatureEnabled } from "@/shared/config/features";
import { getGoingOutPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

export const revalidate = 0;

interface GoingOutRouteProps {
  params: Promise<{ city: string }>;
}

async function generateMetadata({ params }: GoingOutRouteProps): Promise<Metadata> {
  const { city: slug } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "goingOut");
  if (!context) return {};
  const title = `Izlasci u ${context.city.name} – koncerti, žurke i noćni život`;
  const description = `Pronađite koncerte, DJ večeri, svirke, žurke i druge izlaske u ${context.city.name} na jednom mjestu.`;
  const metadataTitle = getPageTitle(title);

  return {
    alternates: { canonical: getGoingOutPath(context.city) },
    description,
    openGraph: { description, title: metadataTitle, url: getGoingOutPath(context.city) },
    title: { absolute: metadataTitle },
    twitter: { description, title: metadataTitle },
  };
}

async function GoingOutRoute({ params }: GoingOutRouteProps) {
  const { city: slug } = await params;
  const locale = "me" as const;
  const context = resolveActiveCityFeatureRoute(slug, "goingOut");
  if (!context) notFound();
  if (!isFeatureEnabled("goingOut")) notFound();
  const result = await getGoingOutEvents(context);

  return (
    <DashboardLayout city={context.city} translations={getTranslations(locale)}>
      <GoingOutPage events={result.events} locale={locale} state={result.state} />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default GoingOutRoute;
