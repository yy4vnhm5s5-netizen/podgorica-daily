import { MapPinned } from "lucide-react";
import type { ReactNode } from "react";

import { getDailyOverview } from "@/modules/daily-overview/application/get-daily-overview";
import { getDailyOverviewTranslations } from "@/modules/daily-overview/presentation/daily-overview-translations";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { LoadingSkeleton } from "@/shared/components/loading-skeleton";
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
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      <CardHeader className="space-y-3 p-6 sm:p-8">
        <LoadingSkeleton label={translations.loading} lines={2} />
      </CardHeader>
      <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">
        <LoadingSkeleton label={translations.loading} lines={4} />
      </CardContent>
    </Card>
  );
}

async function DailyOverviewCard({ locale }: DailyOverviewCardProps) {
  const result = await getDailyOverview(locale);
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

  const { generatedAt, isDemoData, sentences } = result.data;

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-md">
      <CardHeader className="p-6 sm:p-8">
        <div className="flex items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <MapPinned aria-hidden="true" className="size-5" />
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">
              {translations.title}
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {translations.generatedAt}{" "}
              <Timestamp locale={getLocaleTag(locale)} value={generatedAt} />
            </p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6 sm:px-8 sm:pb-8">
        <div className="max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
          {sentences.map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        </div>
        {isDemoData ? (
          <p className="rounded-lg border border-primary/15 bg-background/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
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
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      <CardHeader className="p-6 sm:p-8">
        <h2 className="text-2xl font-semibold tracking-tight">{translations.title}</h2>
      </CardHeader>
      <CardContent className="px-6 pb-6 sm:px-8 sm:pb-8">{children}</CardContent>
    </Card>
  );
}

export { DailyOverviewCard, DailyOverviewCardLoading };
