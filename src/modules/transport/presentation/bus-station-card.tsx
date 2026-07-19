import { BusFront, ExternalLink } from "lucide-react";

import { getBusStationConfig } from "@/modules/transport/domain/bus-station";
import { getBusStationTranslations } from "@/modules/transport/presentation/bus-station-translations";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import type { Locale } from "@/shared/config/locale";
import type { City } from "@/shared/types/city";

interface BusStationCardProps {
  city: City;
  locale: Locale;
}

function BusStationCard({ city, locale }: BusStationCardProps) {
  const config = getBusStationConfig(city);
  const translations = getBusStationTranslations(locale);

  if (!config) return null;

  return (
    <Card className="card-fog card-fog--neutral border-slate-200/90 bg-slate-50/65 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-slate-100/80 text-slate-700">
          <BusFront aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
        </div>
        <h2 className="text-base font-semibold tracking-tight">{translations.title}</h2>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        <p className="text-sm leading-6 text-muted-foreground">
          {translations.description(config.cityName)}
        </p>
        <a
          aria-label={`${translations.openDepartures} — ${translations.externalService}`}
          className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={config.stationUrl}
          rel="noreferrer"
          target="_blank"
        >
          {translations.openDepartures}
          <ExternalLink aria-hidden="true" className="size-3.5" />
        </a>
      </CardContent>
    </Card>
  );
}

export { BusStationCard, type BusStationCardProps };
