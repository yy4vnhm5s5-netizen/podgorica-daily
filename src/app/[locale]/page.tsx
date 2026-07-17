import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarDays, Landmark, Phone, Wind } from "lucide-react";

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
  const { advertising, cards, emptyCardDescription } = translations.dashboard;

  return (
    <DashboardLayout locale={locale} translations={translations}>
      <section className="space-y-10" id="dashboard">
        <div className="space-y-7">
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
          <AdvertisingCard
            label={advertising.label}
            subtitle={advertising.subtitle}
            title={advertising.title}
          />
          <GlobalSearch label={translations.shell.globalSearchComingSoon} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {isFeatureEnabled("weather") ? (
            <Suspense fallback={<CurrentWeatherCardLoading locale={locale} />}>
              <CurrentWeatherCard locale={locale} />
            </Suspense>
          ) : null}
          <DashboardCard
            accent="emerald"
            description={emptyCardDescription}
            icon={Wind}
            title={cards.airQuality}
          />
          <DashboardCard
            accent="amber"
            description={emptyCardDescription}
            icon={CalendarDays}
            title={cards.events}
          />
          <DashboardCard
            accent="red"
            description={emptyCardDescription}
            icon={Phone}
            title={cards.importantNumbers}
          />
          <DashboardCard
            accent="slate"
            description={emptyCardDescription}
            icon={Landmark}
            title={cards.explorePodgorica}
          />
        </div>
      </section>
    </DashboardLayout>
  );
}

export default LocalePage;
