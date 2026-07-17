import { Sparkles } from "lucide-react";
import type { ReactNode } from "react";

import { getDailyBrief } from "@/modules/daily-brief/application/get-daily-brief";
import { DailyBriefRefreshButton } from "@/modules/daily-brief/presentation/daily-brief-refresh-button";
import { getDailyBriefTranslations } from "@/modules/daily-brief/presentation/daily-brief-translations";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { LoadingSkeleton } from "@/shared/components/loading-skeleton";
import { StatusBadge } from "@/shared/components/status-badge";
import { Timestamp } from "@/shared/components/timestamp";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import type { Locale } from "@/shared/config/locale";
import { getLocaleTag } from "@/shared/config/locale";
import { getHourInTimeZone } from "@/shared/lib/date";

interface DailyBriefCardProps {
  locale: Locale;
}

function DailyBriefCardLoading({ locale }: DailyBriefCardProps) {
  const translations = getDailyBriefTranslations(locale);

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <div className="space-y-2">
          <LoadingSkeleton label={translations.loading} lines={2} />
        </div>
        <StatusBadge tone="info">{translations.demo}</StatusBadge>
      </CardHeader>
      <CardContent>
        <LoadingSkeleton label={translations.loading} lines={5} />
      </CardContent>
    </Card>
  );
}

async function DailyBriefCard({ locale }: DailyBriefCardProps) {
  const result = await getDailyBrief();
  const translations = getDailyBriefTranslations(locale);

  if (result.status === "error") {
    return (
      <DailyBriefFrame locale={locale}>
        <ErrorState description={translations.errorDescription} title={translations.errorTitle} />
      </DailyBriefFrame>
    );
  }

  if (result.status === "empty") {
    return (
      <DailyBriefFrame locale={locale}>
        <EmptyState description={translations.emptyDescription} title={translations.emptyTitle} />
      </DailyBriefFrame>
    );
  }

  const { content, generatedAt } = result.data;
  const greeting = getGreeting(translations, generatedAt);

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-md">
      <CardHeader className="flex-col gap-5 space-y-0 p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <Sparkles aria-hidden="true" className="size-5" />
            </div>
            <div>
              <p className="text-sm font-medium text-muted-foreground">{greeting}</p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">
                {translations.title}
              </h2>
            </div>
          </div>
          <StatusBadge tone="info">{translations.demo}</StatusBadge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6 px-6 pb-6 sm:px-8 sm:pb-8">
        <div className="max-w-3xl space-y-3 text-sm leading-6 text-muted-foreground sm:text-base sm:leading-7">
          {translations.summaries[content.key].map((sentence) => (
            <p key={sentence}>{sentence}</p>
          ))}
        </div>
        <p className="rounded-lg border border-primary/15 bg-background/70 px-4 py-3 text-sm leading-6 text-muted-foreground">
          {translations.demoNotice}
        </p>
        <div className="flex flex-col gap-3 border-t pt-5 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>
            {translations.generatedAt}{" "}
            <Timestamp locale={getLocaleTag(locale)} value={generatedAt} />
          </p>
          <DailyBriefRefreshButton
            label={translations.refresh}
            title={translations.refreshUnavailable}
          />
        </div>
      </CardContent>
    </Card>
  );
}

interface DailyBriefFrameProps extends DailyBriefCardProps {
  children: ReactNode;
}

function DailyBriefFrame({ children, locale }: DailyBriefFrameProps) {
  const translations = getDailyBriefTranslations(locale);

  return (
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/10 via-background to-background shadow-sm">
      <CardHeader className="flex-row items-center justify-between gap-4 space-y-0">
        <h2 className="text-xl font-semibold tracking-tight">{translations.title}</h2>
        <StatusBadge tone="info">{translations.demo}</StatusBadge>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

function getGreeting(
  translations: ReturnType<typeof getDailyBriefTranslations>,
  generatedAt: Date,
) {
  return getHourInTimeZone(generatedAt) < 12
    ? translations.greeting.morning
    : translations.greeting.afternoon;
}

export { DailyBriefCard, DailyBriefCardLoading };
