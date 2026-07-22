import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { getGoingOutEvents } from "@/modules/going-out/application/get-going-out-events";
import { GoingOutPage } from "@/modules/going-out/presentation/going-out-page";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { isFeatureEnabled } from "@/shared/config/features";
import { getLocaleAlternates, isLocale, type Locale } from "@/shared/config/locale";
import { getPageTitle } from "@/shared/config/site";
import { getTranslations } from "@/shared/lib/translations";

const titles = { en: "Nights out", me: "Izlasci" } as const;
const descriptions = {
  en: "Upcoming music performances, parties and nightlife in Podgorica.",
  me: "Predstojeći muzički nastupi, žurke i noćni život u Podgorici.",
} as const;

interface GoingOutRouteProps {
  params: Promise<{ locale: string }>;
}

export const revalidate = 0;

async function generateMetadata({ params }: GoingOutRouteProps): Promise<Metadata> {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam)) return {};
  const locale = localeParam as Locale;
  const title = getPageTitle(titles[locale]);

  return {
    alternates: { canonical: `/${locale}/izlasci`, languages: getLocaleAlternates("/izlasci") },
    description: descriptions[locale],
    openGraph: { description: descriptions[locale], title },
    title: { absolute: title },
    twitter: { description: descriptions[locale], title },
  };
}

async function GoingOutRoute({ params }: GoingOutRouteProps) {
  const { locale: localeParam } = await params;
  if (!isLocale(localeParam) || !isFeatureEnabled("goingOut")) notFound();
  const locale = localeParam as Locale;
  const result = await getGoingOutEvents();

  return (
    <DashboardLayout locale={locale} translations={getTranslations(locale)}>
      <GoingOutPage events={result.events} locale={locale} state={result.state} />
    </DashboardLayout>
  );
}

export { generateMetadata };
export default GoingOutRoute;
