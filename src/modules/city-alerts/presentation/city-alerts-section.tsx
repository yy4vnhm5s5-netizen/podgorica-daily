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

import { getDefaultCityContext } from "@/config/city-context";
import {
  getActiveCityAlerts,
  type CityAlertsMetadata,
} from "@/modules/city-alerts/application/get-active-city-alerts";
import { getHomepagePowerOutageLocations } from "@/modules/city-alerts/application/power-outage-selection";
import { selectNextPowerOutage } from "@/modules/city-alerts/application/select-next-power-outage";
import type { AlertSeverity, AlertType, CityAlert } from "@/modules/city-alerts/domain/city-alert";
import {
  getCityAlertContent,
  getCityAlertsTranslations,
  type CityAlertsTranslations,
} from "@/modules/city-alerts/presentation/city-alerts-translations";
import {
  CityServicesPanel,
  type CityServiceInfo,
} from "@/modules/city-alerts/presentation/city-services-panel";
import { getCityServiceFreshnessLabel } from "@/modules/city-alerts/presentation/city-service-freshness";
import { getPowerOutageDetailsLabel } from "@/modules/city-alerts/presentation/power-outages-ui-model";
import { LoadingSkeleton } from "@/shared/components/loading-skeleton";
import { SectionTitle } from "@/shared/components/section-title";
import { StatusBadge, type StatusTone } from "@/shared/components/status-badge";
import { Timestamp } from "@/shared/components/timestamp";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import type { Locale } from "@/shared/config/locale";
import { getLocaleTag } from "@/shared/config/locale";
import { getElectricityPath } from "@/shared/config/public-routes";
import { formatDateTime } from "@/shared/lib/date";
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
    card: "border-red-300/80 bg-red-50/50 dark:border-red-900",
    icon: "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-100",
    tone: "error",
  },
  information: {
    card: "border-blue-200/80 bg-blue-50/50 dark:border-blue-900",
    icon: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-100",
    tone: "info",
  },
  resolved: {
    card: "border-border bg-slate-50/50",
    icon: "bg-muted text-muted-foreground",
    tone: "success",
  },
  warning: {
    card: "border-amber-300/80 bg-amber-50/50 dark:border-amber-900",
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
      <SectionTitle id="city-alerts-heading" title={translations.cityServices} />
      <Card className="border-blue-200/80 bg-blue-50/60 shadow-none">
        <CardContent className="p-4">
          <LoadingSkeleton label={translations.loading} lines={4} />
        </CardContent>
      </Card>
    </section>
  );
}

async function CityAlertsSection({ locale }: CityAlertsSectionProps) {
  const result = await getActiveCityAlerts(getDefaultCityContext(locale));
  const translations = getCityAlertsTranslations(locale);
  const metadata: CityAlertsMetadata = "metadata" in result ? result.metadata : { sources: [] };
  const services = getCityServices(result, locale, translations, metadata);
  const otherAlerts =
    result.status === "success"
      ? result.data.filter(({ type }) => type !== "powerOutage" && type !== "waterOutage")
      : [];

  return (
    <section aria-labelledby="city-alerts-heading" className="space-y-4">
      <SectionTitle id="city-alerts-heading" title={translations.cityServices} />
      <CityServicesPanel
        locale={locale}
        services={services}
        translations={{ ...translations, label: translations.cityServices }}
      />
      {otherAlerts.length > 0 ? (
        <div className="space-y-4 pt-2">
          <SectionTitle title={translations.otherAlerts} />
          <div className="grid gap-4 lg:grid-cols-2">
            {otherAlerts.map((alert) => (
              <CityAlertCard
                alert={alert}
                key={alert.id}
                locale={locale}
                metadata={metadata}
                translations={translations}
              />
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}

function getCityServices(
  result: Awaited<ReturnType<typeof getActiveCityAlerts>>,
  locale: Locale,
  translations: CityAlertsTranslations,
  metadata: CityAlertsMetadata,
): Record<"power" | "water", CityServiceInfo> {
  const alerts = result.status === "success" ? result.data : [];
  const powerAlert = selectNextPowerOutage(alerts);
  const waterAlert = alerts.find(({ type }) => type === "waterOutage");
  const cedisSource = metadata.sources.find(({ id }) => id === "cedis");
  const vikpgSource = metadata.sources.find(({ id }) => id === "vikpg");

  return {
    power: powerAlert
      ? toCityServiceInfo(powerAlert, cedisSource, locale, translations)
      : {
          ...toEmptyCityServiceInfo(cedisSource, locale, translations),
          detailsHref: getElectricityPath(),
          detailsLabel: getPowerOutageDetailsLabel(locale),
        },
    water: waterAlert
      ? toCityServiceInfo(waterAlert, vikpgSource, locale, translations)
      : toEmptyCityServiceInfo(vikpgSource, locale, translations),
  };
}

function toEmptyCityServiceInfo(
  source: CityAlertsMetadata["sources"][number] | undefined,
  locale: Locale,
  translations: CityAlertsTranslations,
): CityServiceInfo {
  if (!source || source.freshnessStatus === "unavailable") return { state: "unavailable" };

  return {
    freshnessLabel: getCityServiceFreshnessLabel({
      freshnessStatus: source.freshnessStatus,
      lastSuccessfulUpdate: source.lastSuccessfulUpdate,
      locale,
      now: new Date(),
      translations,
    }),
    state: "none",
  };
}

function toCityServiceInfo(
  alert: CityAlert,
  source: CityAlertsMetadata["sources"][number] | undefined,
  locale: Locale,
  translations: CityAlertsTranslations,
): CityServiceInfo {
  const localeTag = getLocaleTag(locale);
  const time = [alert.startsAt, alert.expectedEndAt]
    .filter((value): value is Date => value !== undefined)
    .map((value) => formatDateTime(value, { locale: localeTag }).label)
    .join(" – ");

  return {
    ...(alert.type === "powerOutage"
      ? {
          ...getHomepagePowerOutageLocations(alert),
          detailsHref: getElectricityPath(),
          detailsLabel: getPowerOutageDetailsLabel(locale),
        }
      : { area: getCityAlertContent(alert.affectedArea, translations) }),
    description:
      alert.type === "powerOutage"
        ? undefined
        : getCityAlertContent(alert.description, translations),
    freshnessLabel: source
      ? getCityServiceFreshnessLabel({
          freshnessStatus: source.freshnessStatus,
          lastSuccessfulUpdate: source.lastSuccessfulUpdate,
          locale,
          now: new Date(),
          translations,
        })
      : undefined,
    publicationContext: alert.publishedAt
      ? `${translations.publishedAt}: ${formatDateTime(alert.publishedAt, { locale: localeTag }).label}`
      : undefined,
    sourceUrl: alert.type === "powerOutage" ? undefined : alert.sourceUrl,
    state: "available",
    statusLabel:
      alert.status === "scheduled" ? translations.statuses.scheduled : translations.statuses.active,
    time: time || undefined,
    title: getCityAlertContent(alert.title, translations),
  };
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
