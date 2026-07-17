import { Suspense } from "react";
import { notFound } from "next/navigation";

import {
  CurrentWeatherCard,
  CurrentWeatherCardLoading,
} from "@/modules/weather/presentation/current-weather-card";
import {
  DailyOverviewCard,
  DailyOverviewCardLoading,
} from "@/modules/daily-overview/presentation/daily-overview-card";
import {
  CityAlertsSection,
  CityAlertsSectionLoading,
} from "@/modules/city-alerts/presentation/city-alerts-section";
import { DashboardCard } from "@/shared/components/dashboard/dashboard-card";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { GlobalSearch } from "@/shared/components/layout/global-search";
import { SectionTitle } from "@/shared/components/section-title";
import { isLocale, type Locale } from "@/shared/config/locale";
import { isFeatureEnabled } from "@/shared/config/features";
import { getTranslations } from "@/shared/lib/translations";

interface LocalePageProps {
  params: Promise<{ locale: string }>;
}

async function LocalePage({ params }: LocalePageProps) {
  const { locale: localeParam } = await params;

  if (!isLocale(localeParam)) {
    notFound();
  }

  return <DashboardPage locale={localeParam} />;
}

function DashboardPage({ locale }: { locale: Locale }) {
  const translations = getTranslations(locale);
  const { cards, description, emptyCardDescription, title } = translations.dashboard;

  return (
    <DashboardLayout locale={locale} translations={translations}>
      <section className="space-y-8" id="dashboard">
        <div className="space-y-6">
          <SectionTitle description={description} title={title} />
          {isFeatureEnabled("dailyOverview") ? (
            <Suspense fallback={<DailyOverviewCardLoading locale={locale} />}>
              <DailyOverviewCard locale={locale} />
            </Suspense>
          ) : null}
          {isFeatureEnabled("cityAlerts") ? (
            <Suspense fallback={<CityAlertsSectionLoading locale={locale} />}>
              <CityAlertsSection locale={locale} />
            </Suspense>
          ) : null}
          <GlobalSearch label={translations.shell.globalSearchComingSoon} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isFeatureEnabled("weather") ? (
            <Suspense fallback={<CurrentWeatherCardLoading locale={locale} />}>
              <CurrentWeatherCard locale={locale} />
            </Suspense>
          ) : null}
          <DashboardCard description={emptyCardDescription} title={cards.airQuality} />
          <DashboardCard description={emptyCardDescription} title={cards.publicTransport} />
          <DashboardCard description={emptyCardDescription} title={cards.events} />
          <DashboardCard description={emptyCardDescription} title={cards.importantNumbers} />
          <DashboardCard description={emptyCardDescription} title={cards.explorePodgorica} />
        </div>
      </section>
    </DashboardLayout>
  );
}

export default LocalePage;
