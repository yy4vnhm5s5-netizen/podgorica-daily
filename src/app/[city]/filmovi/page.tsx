import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { resolveActiveCityFeatureRoute } from "@/app/city-routing";
import { getCityEvents } from "@/modules/events/application/get-city-events";
import { CineplexxProgrammeCard } from "@/modules/events/presentation/cineplexx-programme-card";
import { selectHomepageCinemaProgramme } from "@/modules/events/presentation/cineplexx-programme-ui-model";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { SectionTitle } from "@/shared/components/section-title";
import { getCinemaPath } from "@/shared/config/public-routes";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

export const revalidate = 0;

interface CinemaPageProps {
  params: Promise<{ city: string }>;
}

async function generateMetadata({ params }: CinemaPageProps): Promise<Metadata> {
  const { city: slug } = await params;
  const context = resolveActiveCityFeatureRoute(slug, "events");
  if (!context) return {};

  const title = `Filmovi u ${context.city.name}`;
  const description = `Aktuelni program Cineplexx bioskopa u ${context.city.name}.`;
  const metadataTitle = getPageTitle(title);

  return {
    alternates: { canonical: getCinemaPath(context.city) },
    description,
    openGraph: { description, title: metadataTitle, url: getCinemaPath(context.city) },
    title: { absolute: metadataTitle },
    twitter: { description, title: metadataTitle },
  };
}

async function CinemaPage({ params }: CinemaPageProps) {
  const { city: slug } = await params;
  const locale = "me" as const;
  const context = resolveActiveCityFeatureRoute(slug, "events");
  if (!context) notFound();

  const result = await getCityEvents(context);
  const cinemaEvents = result.events.filter((event) => event.sourceId === "cineplexx-podgorica");
  const programme = selectHomepageCinemaProgramme(cinemaEvents, {
    now: new Date(),
    timeZone: context.timezone,
  });
  const providerState = result.providers.find(
    (provider) => provider.id === "cineplexx-podgorica",
  )?.state;

  return (
    <DashboardLayout city={context.city} translations={getTranslations(locale)}>
      <section aria-labelledby="cinema-heading" className="space-y-6" id="filmovi">
        <SectionTitle id="cinema-heading" title="Filmovi" />
        <CineplexxProgrammeCard
          day={programme.day}
          events={programme.events}
          locale={locale}
          state={providerState}
        />
      </section>
    </DashboardLayout>
  );
}

export { generateMetadata };
export default CinemaPage;
