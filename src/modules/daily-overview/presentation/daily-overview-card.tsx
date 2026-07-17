import { MapPinned } from "lucide-react";
import type { ReactNode } from "react";

import { getDefaultCityContext } from "@/config/city-context";
import { getDailyOverview } from "@/modules/daily-overview/application/get-daily-overview";
import type { AirQualityCategory } from "@/modules/daily-overview/domain/daily-overview";
import { getDailyOverviewTranslations } from "@/modules/daily-overview/presentation/daily-overview-translations";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { LoadingSkeleton } from "@/shared/components/loading-skeleton";
import { StatusBadge, type StatusTone } from "@/shared/components/status-badge";
import { Timestamp } from "@/shared/components/timestamp";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import type { Locale } from "@/shared/config/locale";
import { getLocaleTag } from "@/shared/config/locale";

interface DailyOverviewCardProps {
  locale: Locale;
}

function DailyOverviewCardLoading({ locale }: DailyOverviewCardProps) {
  const translations = getDailyOverviewTranslations(locale);

  return (
    <Card className="overflow-hidden border-blue-200/90 bg-blue-100/55">
      <CardHeader className="space-y-3 p-5 sm:p-6">
        <LoadingSkeleton label={translations.loading} lines={2} />
      </CardHeader>
      <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">
        <LoadingSkeleton label={translations.loading} lines={4} />
      </CardContent>
    </Card>
  );
}

async function DailyOverviewCard({ locale }: DailyOverviewCardProps) {
  const result = await getDailyOverview(getDefaultCityContext(locale));
  const translations = getDailyOverviewTranslations(locale);

  if (result.status === "error") {
    return (
      <DailyOverviewFrame locale={locale}>
        <ErrorState description={translations.errorDescription} title={translations.errorTitle} />
      </DailyOverviewFrame>
    );
  }

  if (result.status === "empty") {
    return (
      <DailyOverviewFrame locale={locale}>
        <EmptyState description={translations.emptyDescription} title={translations.emptyTitle} />
      </DailyOverviewFrame>
    );
  }

  const { airQualityCategory, generatedAt, isDemoData, sentences } = result.data;

  return (
    <Card className="overflow-hidden border-blue-200/90 bg-blue-100/55 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)] dark:border-blue-950/80">
      <CardHeader className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-100/70 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300">
            <MapPinned aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
          </div>
          <div>
            <h2 className="text-xl font-semibold tracking-tight sm:text-2xl">
              {translations.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {translations.generatedAt}{" "}
              <Timestamp locale={getLocaleTag(locale)} value={generatedAt} />
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-5 p-5 pt-0 sm:p-6 sm:pt-0">
        {airQualityCategory ? (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm leading-6 text-muted-foreground">
            <span>{translations.airQualityLabel}</span>
            <StatusBadge tone={airQualityTones[airQualityCategory]}>
              {translations.airQualityCategories[airQualityCategory]}
            </StatusBadge>
          </div>
        ) : null}
        <div className="max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
          {sentences.map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        </div>
        {isDemoData ? (
          <p className="rounded-lg border border-blue-200/60 bg-background/60 px-4 py-3 text-sm leading-6 text-muted-foreground dark:border-blue-950/80">
            {translations.demoNotice}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

interface DailyOverviewFrameProps extends DailyOverviewCardProps {
  children: ReactNode;
}

function DailyOverviewFrame({ children, locale }: DailyOverviewFrameProps) {
  const translations = getDailyOverviewTranslations(locale);

  return (
    <Card className="overflow-hidden border-blue-200/90 bg-blue-100/55 dark:border-blue-950/80">
      <CardHeader className="p-5 sm:p-6">
        <h2 className="text-xl font-semibold tracking-tight">{translations.title}</h2>
      </CardHeader>
      <CardContent className="p-5 pt-0 sm:p-6 sm:pt-0">{children}</CardContent>
    </Card>
  );
}

export { DailyOverviewCard, DailyOverviewCardLoading };

const airQualityTones: Record<AirQualityCategory, StatusTone> = {
  good: "success",
  moderate: "warning",
  unhealthy: "error",
};
