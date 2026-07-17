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
import { AdvertisingCard } from "@/shared/components/dashboard/advertising-card";
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
  const { advertising, cards, description, emptyCardDescription, title } =
    translations.dashboard;

  return (
    <DashboardLayout locale={locale} translations={translations}>
      <section className="space-y-10" id="dashboard">
        <div className="space-y-7">
          <div className="rounded-2xl border border-primary/10 bg-gradient-to-r from-primary/[0.08] via-background to-sky-100/60 px-5 py-6 sm:px-7 sm:py-8 dark:to-sky-950/20">
            <SectionTitle description={description} title={title} />
          </div>
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
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {isFeatureEnabled("weather") ? (
            <Suspense fallback={<CurrentWeatherCardLoading locale={locale} />}>
              <CurrentWeatherCard locale={locale} />
            </Suspense>
          ) : null}
          <DashboardCard
            accent="blue"
            description={emptyCardDescription}
            title={cards.airQuality}
          />
          <DashboardCard
            accent="orange"
            description={emptyCardDescription}
            title={cards.events}
          />
          <DashboardCard
            accent="red"
            description={emptyCardDescription}
            title={cards.importantNumbers}
          />
          <DashboardCard
            accent="blue"
            description={emptyCardDescription}
            title={cards.explorePodgorica}
          />
          <AdvertisingCard
            label={advertising.label}
            subtitle={advertising.subtitle}
            title={advertising.title}
          />
        </div>
      </section>
    </DashboardLayout>
  );
}

export default LocalePage;
