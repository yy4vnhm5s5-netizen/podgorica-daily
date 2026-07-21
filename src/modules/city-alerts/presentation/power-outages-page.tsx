import { Zap } from "lucide-react";

import { getPowerOutageLocations } from "@/modules/city-alerts/application/power-outage-selection";
import type { PowerOutagesReadResult } from "@/modules/city-alerts/application/get-power-outages";
import type { CityAlert, CityAlertContent } from "@/modules/city-alerts/domain/city-alert";
import { getPowerOutagesTranslations } from "@/modules/city-alerts/presentation/power-outages-translations";
import { ErrorState } from "@/shared/components/error-state";
import { SectionTitle } from "@/shared/components/section-title";
import { StatusBadge } from "@/shared/components/status-badge";
import { Timestamp } from "@/shared/components/timestamp";
import { EmptyState } from "@/shared/components/empty-state";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";

interface PowerOutagesPageProps {
  locale: Locale;
  result: PowerOutagesReadResult;
}

function PowerOutagesPage({ locale, result }: PowerOutagesPageProps) {
  const translations = getPowerOutagesTranslations(locale);

  return (
    <section aria-labelledby="power-outages-heading" className="space-y-6" id="power-outages">
      <div className="space-y-2">
        <SectionTitle id="power-outages-heading" title={translations.title} />
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          {translations.description}
        </p>
      </div>
      {result.status === "unavailable" ? (
        <ErrorState description={translations.unavailable} title={translations.title} />
      ) : result.status === "empty" ? (
        <EmptyState description={translations.empty} title={translations.title} />
      ) : (
        <div className="space-y-4">
          {result.freshnessStatus === "stale" ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              {translations.stale}
            </p>
          ) : null}
          <div className="grid gap-4">
            {result.outages.map((outage) => (
              <PowerOutageCard alert={outage} key={outage.id} locale={locale} />
            ))}
          </div>
        </div>
      )}
    </section>
  );
}

function PowerOutageCard({ alert, locale }: { alert: CityAlert; locale: Locale }) {
  const translations = getPowerOutagesTranslations(locale);
  const localeTag = getLocaleTag(locale);
  const time = [alert.startsAt, alert.expectedEndAt]
    .filter((value): value is Date => value !== undefined)
    .map((value) => formatDateTime(value, { locale: localeTag }).label)
    .join(" – ");
  const locations = getPowerOutageLocations(alert);
  const affectedArea = getSourceContent(alert.affectedArea);
  const title = getSourceContent(alert.title);

  return (
    <Card className="border-amber-200/80 bg-amber-50/40 shadow-none">
      <CardHeader className="flex-row items-start gap-3 space-y-0 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-100 text-amber-800">
          <Zap aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-base font-semibold tracking-tight">{title}</h2>
            <StatusBadge tone="warning">
              {alert.status === "scheduled"
                ? translations.status.scheduled
                : translations.status.active}
            </StatusBadge>
          </div>
          {time ? (
            <p className="mt-2 text-sm text-muted-foreground">
              {translations.scheduledTime}: {time}
            </p>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4 p-4 pt-0 sm:p-5 sm:pt-0">
        {locations.length > 0 ? (
          <div>
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {translations.affectedLocations}
            </h3>
            <ul className="mt-2 grid gap-1.5 text-sm leading-6 text-foreground sm:grid-cols-2">
              {locations.map((location) => (
                <li key={location}>{location}</li>
              ))}
            </ul>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">{affectedArea}</p>
        )}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-amber-200/80 pt-3 text-sm text-muted-foreground">
          {alert.publishedAt ? (
            <span>
              {translations.publicationTime}:{" "}
              <Timestamp locale={localeTag} value={alert.publishedAt} />
            </span>
          ) : null}
          <span>{translations.source}</span>
          {alert.sourceUrl ? (
            <a
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={alert.sourceUrl}
              rel="noreferrer"
              target="_blank"
            >
              {translations.officialSource}
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function getSourceContent(content: CityAlertContent) {
  return content.kind === "source" ? content.value : "";
}

export { PowerOutagesPage, type PowerOutagesPageProps };
