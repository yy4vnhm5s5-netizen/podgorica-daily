import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getPodgoricaFlights } from "@/modules/flights/application/get-podgorica-flights";
import { AirportFlightsPage } from "@/modules/flights/presentation/airport-flights-page";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { isFeatureEnabled } from "@/shared/config/features";
import { getLocaleAlternates, isLocale, type Locale } from "@/shared/config/locale";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

const titles = { en: "Podgorica Airport flights", me: "Letovi Aerodroma Podgorica" } as const;
const descriptions = {
  en: "Arrivals and departures at Podgorica Airport from official Airports of Montenegro data.",
  me: "Dolasci i odlasci na Aerodromu Podgorica iz zvaničnih podataka Aerodroma Crne Gore.",
} as const;

interface FlightsPageProps {
  params: Promise<{ locale: string }>;
}

export const revalidate = 0;

async function generateMetadata({ params }: FlightsPageProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) return {};
  const locale = localeParam as Locale;
  const title = getPageTitle(titles[locale]);

  return {
    alternates: { canonical: `/${locale}/letovi`, languages: getLocaleAlternates("/letovi") },
    description: descriptions[locale],
    openGraph: { description: descriptions[locale], title },
    title: { absolute: title },
    twitter: { description: descriptions[locale], title },
  };
}

async function FlightsPage({ params }: FlightsPageProps) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam) || !isFeatureEnabled("flights")) notFound();
  const locale = localeParam as Locale;
  const result = await getPodgoricaFlights();

  return (
    <DashboardLayout locale={locale} translations={getTranslations(locale)}>
      <AirportFlightsPage
        flights={result.flights}
        lastSuccessfulRefreshAt={result.lastSuccessfulRefreshAt}
        locale={locale}
        state={result.state}
      />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default FlightsPage;
