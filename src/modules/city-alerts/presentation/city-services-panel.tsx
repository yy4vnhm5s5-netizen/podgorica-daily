"use client";

import { Clock3, Droplets, MapPin, Zap, type LucideIcon } from "lucide-react";
import { useId, useState, type KeyboardEvent, type ReactNode } from "react";

import type { CityAlertServiceId } from "@/modules/city-alerts/application/city-alert-service-capabilities";
import { formatAdditionalAffectedAreas } from "@/modules/city-alerts/presentation/power-outages-ui-model";
import { cityServicesEmptyStateCopy } from "@/modules/city-alerts/presentation/city-alerts-translations";
import { Badge } from "@/shared/components/ui/badge";
import { Card } from "@/shared/components/ui/card";
import { getRovingTabIndex } from "@/shared/lib/roving-tab-index";
import { cn } from "@/shared/lib/utils";

type CityServiceState = "available" | "none" | "unavailable";

interface CityServiceInfo {
  additionalLocationCount?: number;
  area?: string;
  detailsHref?: string;
  detailsLabel?: string;
  description?: string;
  freshnessLabel?: string;
  locations?: readonly string[];
  state: CityServiceState;
  statusLabel?: string;
  sourceUrl?: string;
  time?: string;
  title?: string;
}

interface CityServicesTranslations {
  area: string;
  label: string;
  moreLocations: {
    few: string;
    many: string;
    one: string;
  };
  officialSource: string;
  power: string;
  scheduled: string;
  time: string;
  unavailable: string;
  water: string;
}

interface CityServicesPanelProps {
  serviceIds: readonly CityAlertServiceId[];
  services: Partial<Record<CityAlertServiceId, CityServiceInfo>>;
  translations: CityServicesTranslations;
}

const serviceIcons = { power: Zap, water: Droplets };

function CityServicesPanel({ serviceIds, services, translations }: CityServicesPanelProps) {
  const [selectedService, setSelectedService] = useState<CityAlertServiceId>(
    serviceIds[0] ?? "power",
  );
  const panelId = useId();
  const activeServiceId = serviceIds.includes(selectedService) ? selectedService : serviceIds[0];
  if (!activeServiceId) return null;

  const service = services[activeServiceId];
  if (!service) return null;

  const labels = { power: translations.power, water: translations.water };

  function selectService(serviceId: CityAlertServiceId) {
    setSelectedService(serviceId);
    document.getElementById(`${panelId}-${serviceId}`)?.focus();
  }

  function handleTabKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    serviceId: CityAlertServiceId,
  ) {
    const index = serviceIds.indexOf(serviceId);
    const nextService = serviceIds[(index + 1) % serviceIds.length];
    const previousService = serviceIds[(index - 1 + serviceIds.length) % serviceIds.length];

    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectService(nextService);
    }

    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectService(previousService);
    }

    if (event.key === "Home") {
      event.preventDefault();
      selectService(serviceIds[0]);
    }

    if (event.key === "End") {
      event.preventDefault();
      selectService(serviceIds[serviceIds.length - 1]);
    }
  }

  const primaryArea = service.locations?.[0] ?? service.area;
  const emptyState =
    service.state === "none" ? cityServicesEmptyStateCopy[activeServiceId] : undefined;
  const stateLabel = service.state === "unavailable" ? translations.unavailable : undefined;

  return (
    <Card className="overflow-hidden border-border bg-background shadow-none">
      <div className="flex flex-col lg:flex-row lg:items-stretch">
        <div
          aria-label={translations.label}
          className="flex shrink-0 gap-1 border-b border-slate-200/80 p-2 lg:border-b-0 lg:border-r lg:p-1.5"
          role="tablist"
        >
          {serviceIds.map((serviceId) => {
            const TabIcon = serviceIcons[serviceId];
            const isSelected = activeServiceId === serviceId;

            return (
              <button
                aria-controls={panelId}
                aria-selected={isSelected}
                className={cn(
                  "focus-visible:ring-ring flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 lg:min-h-9 lg:flex-none",
                  isSelected
                    ? cn(
                        "card-fog border border-slate-200 bg-background text-foreground shadow-[0_2px_5px_-4px_rgb(15_23_42_/_0.3)]",
                        serviceId === "power"
                          ? "city-service-tab-fog--power"
                          : "city-service-tab-fog--water",
                      )
                    : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
                )}
                id={`${panelId}-${serviceId}`}
                key={serviceId}
                onClick={() => setSelectedService(serviceId)}
                onKeyDown={(event) => handleTabKeyDown(event, serviceId)}
                role="tab"
                tabIndex={getRovingTabIndex(isSelected)}
                type="button"
              >
                <TabIcon
                  aria-hidden="true"
                  className={cn(
                    "size-4",
                    serviceId === "power" ? "text-amber-600" : "text-blue-600",
                  )}
                  strokeWidth={1.8}
                />
                {labels[serviceId]}
              </button>
            );
          })}
        </div>
        <div
          aria-labelledby={`${panelId}-${activeServiceId}`}
          className="flex min-w-0 flex-1 flex-col gap-2 p-3 sm:p-4 lg:grid lg:grid-cols-[minmax(7.5rem,1fr)_minmax(11rem,1.35fr)_minmax(9.5rem,1fr)_auto] lg:items-center lg:gap-0 lg:px-3 lg:py-2"
          id={panelId}
          role="tabpanel"
        >
          {emptyState ? (
            <ServiceEmptyState icon={serviceIcons[activeServiceId]} primary={emptyState.primary} />
          ) : stateLabel ? (
            <p className="min-w-0 text-sm font-semibold text-foreground lg:pr-5">{stateLabel}</p>
          ) : (
            <>
              {primaryArea ? (
                <ServiceStripDetail
                  className="lg:col-start-1 lg:border-l-0 lg:pr-4"
                  icon={MapPin}
                  iconClassName="text-rose-500"
                  trailing={
                    service.additionalLocationCount ? (
                      <Badge
                        aria-label={formatAdditionalAffectedAreas(service.additionalLocationCount)}
                        className="shrink-0 border-amber-200/80 bg-amber-50/70 text-amber-800"
                        variant="outline"
                      >
                        +{service.additionalLocationCount}
                      </Badge>
                    ) : null
                  }
                  value={primaryArea}
                />
              ) : null}
              {service.time ? (
                <ServiceStripDetail className="lg:col-start-2" icon={Clock3} value={service.time} />
              ) : null}
            </>
          )}
          {service.freshnessLabel ? (
            <ServiceStripDetail className="lg:col-start-3" label={service.freshnessLabel} />
          ) : null}
          {service.sourceUrl ? (
            <a
              className="focus-visible:ring-ring inline-flex min-h-10 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 lg:col-start-4 lg:justify-self-end lg:border-l lg:border-slate-200/80 lg:pl-5"
              href={service.sourceUrl}
            >
              {translations.officialSource}
            </a>
          ) : null}
          {service.detailsHref && service.detailsLabel ? (
            <a
              className="focus-visible:ring-ring inline-flex min-h-10 items-center text-sm font-semibold text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 lg:col-start-4 lg:justify-self-end lg:border-l lg:border-slate-200/80 lg:pl-5"
              href={service.detailsHref}
            >
              {service.detailsLabel}
            </a>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

// One line, same rhythm as a populated detail cell, so an empty service does not make the strip
// taller than a populated one. It spans the location and time columns only — the columns a
// populated state would fill — leaving freshness and the details link in their own slots rather
// than reserving an empty column for the time we do not have.
//
// The longer explanatory sentence in cityServicesEmptyStateCopy is deliberately not rendered
// here; the compact strip carries the short label, and /[city]/struja keeps the full copy.
function ServiceEmptyState({ icon, primary }: { icon: LucideIcon; primary: string }) {
  return (
    <ServiceStripDetail
      className="lg:col-start-1 lg:col-span-2 lg:border-l-0 lg:pr-4"
      icon={icon}
      value={primary}
    />
  );
}

function ServiceStripDetail({
  className,
  icon: Icon,
  iconClassName,
  label,
  trailing,
  value,
}: {
  className?: string;
  icon?: LucideIcon;
  iconClassName?: string;
  label?: string;
  /** Rendered inside the value group — for adornments that describe the value itself. */
  trailing?: ReactNode;
  value?: string;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5 text-sm lg:border-l lg:border-slate-200/80 lg:pl-5",
        className,
      )}
    >
      {Icon ? (
        <Icon
          aria-hidden="true"
          className={cn("size-3.5 shrink-0 text-muted-foreground", iconClassName)}
        />
      ) : null}
      {/* Value and any trailing adornment share one wrapping group, so a badge that belongs to
          the value (e.g. "+3 more affected areas") stays beside it instead of drifting into a
          neighbouring column, and a long value wraps with the badge rather than overflowing. */}
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-1">
        {value && label ? <span className="text-muted-foreground">{label}: </span> : null}
        <span className={cn(value ? "font-medium text-foreground" : "text-muted-foreground")}>
          {value ?? label}
        </span>
        {trailing}
      </div>
    </div>
  );
}

export {
  CityServicesPanel,
  type CityAlertServiceId as CityServiceId,
  type CityServiceInfo,
  type CityServicesTranslations,
};
