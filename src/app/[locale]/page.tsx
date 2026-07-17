import { Suspense } from "react";
import { notFound } from "next/navigation";
import { CalendarDays, Landmark, Phone } from "lucide-react";

import { getDefaultCityContext } from "@/config/city-context";
import { getDailyOverview } from "@/modules/daily-overview/application/get-daily-overview";
import { DailySummaryBar } from "@/modules/daily-overview/presentation/daily-summary-bar";
import {
  CurrentWeatherCard,
  CurrentWeatherCardLoading,
} from "@/modules/weather/presentation/current-weather-card";
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

async function DashboardPage({ locale }: { locale: Locale }) {
  const translations = getTranslations(locale);
  const { advertising, cards, emptyCardDescription } = translations.dashboard;
  const dailyOverview = isFeatureEnabled("dailyOverview")
    ? await getDailyOverview(getDefaultCityContext(locale))
    : null;
  const airQualityCategory =
    dailyOverview?.status === "success" ? dailyOverview.data.airQualityCategory : undefined;

  return (
    <DashboardLayout locale={locale} translations={translations}>
      <section className="space-y-10" id="dashboard">
        <div className="space-y-7">
          {dailyOverview ? <DailySummaryBar locale={locale} result={dailyOverview} /> : null}
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
              <CurrentWeatherCard airQualityCategory={airQualityCategory} locale={locale} />
            </Suspense>
          ) : null}
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
