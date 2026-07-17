import { Suspense } from "react";

import {
  CurrentWeatherCard,
  CurrentWeatherCardLoading,
} from "@/modules/weather/presentation/current-weather-card";
import { DashboardCard } from "@/shared/components/dashboard/dashboard-card";
import { DashboardLayout } from "@/shared/components/layout/dashboard-layout";
import { GlobalSearch } from "@/shared/components/layout/global-search";
import { SectionTitle } from "@/shared/components/section-title";
import { isFeatureEnabled } from "@/shared/config/features";

export default function HomePage() {
  return (
    <DashboardLayout>
      <section className="space-y-8" id="dashboard">
        <div className="space-y-6">
          <SectionTitle
            description="A calm, accessible workspace for Podgorica’s daily information."
            title="Dashboard"
          />
          <GlobalSearch />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {isFeatureEnabled("weather") ? (
            <Suspense fallback={<CurrentWeatherCardLoading />}>
              <CurrentWeatherCard />
            </Suspense>
          ) : null}
          <DashboardCard title="Air Quality" />
          <DashboardCard title="Public Transport" />
          <DashboardCard title="Events" />
          <DashboardCard title="City Alerts" />
          <DashboardCard title="AI Daily Summary" />
          <DashboardCard title="Important Numbers" />
          <DashboardCard title="Explore Podgorica" />
        </div>
      </section>
    </DashboardLayout>
  );
}
