"use client";

import { Droplets, Zap } from "lucide-react";
import { useId, useState } from "react";

import { StatusBadge } from "@/shared/components/status-badge";
import { Card, CardContent } from "@/shared/components/ui/card";
import { cn } from "@/shared/lib/utils";

type CityServiceId = "power" | "water";
type CityServiceState = "available" | "none" | "unavailable";

interface CityServiceInfo {
  area?: string;
  description?: string;
  state: CityServiceState;
  statusLabel?: string;
  time?: string;
  title?: string;
}

interface CityServicesTranslations {
  area: string;
  label: string;
  noPowerOutages: string;
  noWaterInterruptions: string;
  power: string;
  scheduled: string;
  time: string;
  unavailable: string;
  water: string;
}

interface CityServicesPanelProps {
  services: Record<CityServiceId, CityServiceInfo>;
  translations: CityServicesTranslations;
}

const serviceIcons = { power: Zap, water: Droplets };

function CityServicesPanel({ services, translations }: CityServicesPanelProps) {
  const [selectedService, setSelectedService] = useState<CityServiceId>("power");
  const panelId = useId();
  const service = services[selectedService];
  const Icon = serviceIcons[selectedService];
  const labels = { power: translations.power, water: translations.water };

  return (
    <Card className="border-blue-200/80 bg-blue-50/60 shadow-none">
      <div
        aria-label={translations.label}
        className="flex gap-1 border-b border-blue-200/70 p-2"
        role="tablist"
      >
        {(Object.keys(labels) as CityServiceId[]).map((serviceId) => {
          const TabIcon = serviceIcons[serviceId];
          const isSelected = selectedService === serviceId;

          return (
            <button
              aria-controls={panelId}
              aria-selected={isSelected}
              className={cn(
                "flex min-h-10 flex-1 items-center justify-center gap-2 rounded-lg px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
                isSelected
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:bg-background/60 hover:text-foreground",
              )}
              id={`${panelId}-${serviceId}`}
              key={serviceId}
              onClick={() => setSelectedService(serviceId)}
              role="tab"
              type="button"
            >
              <TabIcon aria-hidden="true" className="size-4" strokeWidth={1.8} />
              {labels[serviceId]}
            </button>
          );
        })}
      </div>
      <CardContent
        aria-labelledby={`${panelId}-${selectedService}`}
        className="p-4 sm:p-5"
        id={panelId}
        role="tabpanel"
      >
        <div className="flex items-start gap-3">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-800">
            <Icon aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
          </div>
          <div className="min-w-0 flex-1">
            {service.state === "none" ? (
              <p className="pt-1 text-sm font-semibold text-foreground">
                {selectedService === "power"
                  ? translations.noPowerOutages
                  : translations.noWaterInterruptions}
              </p>
            ) : service.state === "unavailable" ? (
              <p className="pt-1 text-sm text-muted-foreground">{translations.unavailable}</p>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-semibold text-foreground">{service.title}</p>
                    {service.description ? (
                      <p className="mt-1 text-sm leading-6 text-muted-foreground">
                        {service.description}
                      </p>
                    ) : null}
                  </div>
                  <StatusBadge tone="warning">
                    {service.statusLabel ?? translations.scheduled}
                  </StatusBadge>
                </div>
                <dl className="grid gap-2 text-sm sm:grid-cols-2">
                  {service.area ? (
                    <ServiceDetail label={translations.area} value={service.area} />
                  ) : null}
                  {service.time ? (
                    <ServiceDetail label={translations.time} value={service.time} />
                  ) : null}
                </dl>
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function ServiceDetail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 font-medium text-foreground">{value}</dd>
    </div>
  );
}

export {
  CityServicesPanel,
  type CityServiceId,
  type CityServiceInfo,
  type CityServicesTranslations,
};
