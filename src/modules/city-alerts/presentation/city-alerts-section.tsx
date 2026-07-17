import {
  AlertTriangle,
  CircleAlert,
  CloudLightning,
  Construction,
  Droplets,
  Siren,
  TrafficCone,
  Zap,
  type LucideIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import {
  getActiveCityAlerts,
  type CityAlertsMetadata,
} from "@/modules/city-alerts/application/get-active-city-alerts";
import type { AlertSeverity, AlertType, CityAlert } from "@/modules/city-alerts/domain/city-alert";
import {
  getCityAlertContent,
  getCityAlertsTranslations,
  type CityAlertsTranslations,
} from "@/modules/city-alerts/presentation/city-alerts-translations";
import { EmptyState } from "@/shared/components/empty-state";
import { ErrorState } from "@/shared/components/error-state";
import { LoadingSkeleton } from "@/shared/components/loading-skeleton";
import { SectionTitle } from "@/shared/components/section-title";
import { StatusBadge, type StatusTone } from "@/shared/components/status-badge";
import { Timestamp } from "@/shared/components/timestamp";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import type { Locale } from "@/shared/config/locale";
import { getLocaleTag } from "@/shared/config/locale";
import { cn } from "@/shared/lib/utils";

const alertIcons: Record<AlertType, LucideIcon> = {
  emergency: Siren,
  powerOutage: Zap,
  roadWorks: Construction,
  trafficDisruption: TrafficCone,
  waterOutage: Droplets,
  weatherWarning: CloudLightning,
};

const severityStyles: Record<AlertSeverity, { card: string; icon: string; tone: StatusTone }> = {
  critical: {
    card: "border-red-300/80 dark:border-red-900",
    icon: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100",
    tone: "error",
  },
  information: {
    card: "border-blue-200/80 dark:border-blue-900",
    icon: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-100",
    tone: "info",
  },
  resolved: {
    card: "border-border",
    icon: "bg-muted text-muted-foreground",
    tone: "success",
  },
  warning: {
    card: "border-amber-300/80 dark:border-amber-900",
    icon: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-100",
    tone: "warning",
  },
};

interface CityAlertsSectionProps {
  locale: Locale;
}

function CityAlertsSectionLoading({ locale }: CityAlertsSectionProps) {
  const translations = getCityAlertsTranslations(locale);

  return (
    <section aria-labelledby="city-alerts-heading" className="space-y-4">
      <SectionTitle id="city-alerts-heading" title={translations.title} />
      <Card>
        <CardContent className="pt-6">
          <LoadingSkeleton label={translations.loading} lines={4} />
        </CardContent>
      </Card>
    </section>
  );
}

async function CityAlertsSection({ locale }: CityAlertsSectionProps) {
  const result = await getActiveCityAlerts();
  const translations = getCityAlertsTranslations(locale);

  if (result.status === "error") {
    return (
      <CityAlertsFrame locale={locale}>
        <ErrorState description={translations.errorDescription} title={translations.errorTitle} />
      </CityAlertsFrame>
    );
  }

  if (result.status === "empty") {
    return (
      <CityAlertsFrame locale={locale}>
        <EmptyState description={translations.emptyDescription} title={translations.emptyTitle} />
      </CityAlertsFrame>
    );
  }

  if (result.status === "unavailable") {
    return (
      <CityAlertsFrame locale={locale}>
        <p
          className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm text-muted-foreground"
          role="status"
        >
          {translations.unavailable}
        </p>
      </CityAlertsFrame>
    );
  }

  return (
    <section aria-labelledby="city-alerts-heading" className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <SectionTitle id="city-alerts-heading" title={translations.title} />
        {result.data.some((alert) => alert.dataMode === "demo") ? (
          <StatusBadge tone="info">{translations.demo}</StatusBadge>
        ) : null}
      </div>
      {result.data.some((alert) => alert.dataMode === "demo") ? (
        <p className="text-sm text-muted-foreground">{translations.demoNotice}</p>
      ) : null}
      {result.metadata.sources
        .filter((source) => source.freshnessStatus === "stale")
        .map((source) => (
          <p
            className="rounded-lg border border-amber-300/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-100"
            key={source.id}
            role="status"
          >
            {translations.staleData}{" "}
            {source.lastSuccessfulUpdate ? (
              <Timestamp locale={getLocaleTag(locale)} value={source.lastSuccessfulUpdate} />
            ) : null}
          </p>
        ))}
      <div className="grid gap-4 lg:grid-cols-2">
        {result.data.map((alert) => (
          <CityAlertCard
            alert={alert}
            key={alert.id}
            locale={locale}
            metadata={result.metadata}
            translations={translations}
          />
        ))}
      </div>
    </section>
  );
}

interface CityAlertsFrameProps extends CityAlertsSectionProps {
  children: ReactNode;
}

function CityAlertsFrame({ children, locale }: CityAlertsFrameProps) {
  const translations = getCityAlertsTranslations(locale);

  return (
    <section aria-labelledby="city-alerts-heading" className="space-y-4">
      <SectionTitle id="city-alerts-heading" title={translations.title} />
      {children}
    </section>
  );
}

interface CityAlertCardProps {
  alert: CityAlert;
  locale: Locale;
  metadata: CityAlertsMetadata;
  translations: CityAlertsTranslations;
}

function CityAlertCard({ alert, locale, metadata, translations }: CityAlertCardProps) {
  const Icon = alertIcons[alert.type];
  const severity = severityStyles[alert.severity];
  const localeTag = getLocaleTag(locale);
  const sourceMetadata = getSourceMetadata(alert, metadata);

  return (
    <Card className={cn("overflow-hidden", severity.card)}>
      <CardHeader className="flex-row items-start gap-4 space-y-0 p-5">
        <div
          className={cn(
            "flex size-10 shrink-0 items-center justify-center rounded-xl",
            severity.icon,
          )}
        >
          <Icon aria-hidden="true" className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {translations.types[alert.type]}
              </p>
              <h3 className="mt-1 text-base font-semibold tracking-tight">
                {getCityAlertContent(alert.title, translations)}
              </h3>
            </div>
            <StatusBadge tone={severity.tone}>
              {translations.severities[alert.severity]}
            </StatusBadge>
          </div>
          <p className="mt-3 text-sm leading-6 text-muted-foreground">
            {getCityAlertContent(alert.description, translations)}
          </p>
        </div>
      </CardHeader>
      <CardContent className="border-t pt-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-2">
          <AlertDetail
            icon={CircleAlert}
            label={translations.affectedArea}
            value={getCityAlertContent(alert.affectedArea, translations)}
          />
          <AlertDetail
            icon={AlertTriangle}
            label={translations.source}
            value={
              alert.sourceUrl ? (
                <>
                  {getCityAlertContent(alert.source, translations)} ·{" "}
                  <a
                    aria-label={`${getCityAlertContent(alert.source, translations)}: ${translations.officialSource}`}
                    className="focus-visible:ring-ring text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2"
                    href={alert.sourceUrl}
                  >
                    {translations.officialSource}
                  </a>
                </>
              ) : (
                getCityAlertContent(alert.source, translations)
              )
            }
          />
          {alert.startsAt ? (
            <AlertDetail
              icon={AlertTriangle}
              label={translations.startsAt}
              value={<Timestamp locale={localeTag} value={alert.startsAt} />}
            />
          ) : null}
          {alert.expectedEndAt ? (
            <AlertDetail
              icon={AlertTriangle}
              label={translations.expectedEnd}
              value={<Timestamp locale={localeTag} value={alert.expectedEndAt} />}
            />
          ) : null}
          {alert.status === "active" || alert.status === "scheduled" ? (
            <AlertDetail
              icon={CircleAlert}
              label={translations.status}
              value={translations.statuses[alert.status]}
            />
          ) : null}
          {sourceMetadata?.lastSuccessfulUpdate ? (
            <AlertDetail
              icon={AlertTriangle}
              label={translations.lastUpdated}
              value={<Timestamp locale={localeTag} value={sourceMetadata.lastSuccessfulUpdate} />}
            />
          ) : null}
        </dl>
      </CardContent>
    </Card>
  );
}

function getSourceMetadata(alert: CityAlert, metadata: CityAlertsMetadata) {
  if (alert.source.kind !== "source") return undefined;
  const id = alert.source.value.toLocaleLowerCase("en") as "amscg" | "cedis";
  return metadata.sources.find((source) => source.id === id);
}

interface AlertDetailProps {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
}

function AlertDetail({ icon: Icon, label, value }: AlertDetailProps) {
  return (
    <div className="flex gap-2">
      <Icon aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="mt-0.5 break-words font-medium text-foreground">{value}</dd>
      </div>
    </div>
  );
}

export { CityAlertsSection, CityAlertsSectionLoading };
