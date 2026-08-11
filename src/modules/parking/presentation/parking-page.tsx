import { Building2, SquareParking } from "lucide-react";

import type {
  ParkingAvailabilityReadModel,
  ParkingLocationType,
} from "../domain/parking-availability.ts";
import { parkingAvailabilityPageUrl } from "../infrastructure/parking-servis-podgorica.ts";
import { getParkingAvailabilityLabel } from "./parking-ui-model.ts";
import { CityFeatureDiscovery } from "@/shared/components/city-feature-discovery";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import { SectionTitle } from "@/shared/components/section-title";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { getCityName } from "@/shared/config/cities";
import type { Locale } from "@/shared/config/locale";
import type { City } from "@/shared/types/city";

interface ParkingPageProps {
  city: City;
  locale: Locale;
  result: ParkingAvailabilityReadModel;
}

const parkingTypeCopy: Record<ParkingLocationType, string> = {
  garage: "Garaže",
  parking: "Parkirališta",
};

function ParkingPage({ city, locale, result }: ParkingPageProps) {
  const title = `Parking u ${getCityName(city, "locative")}`;

  return (
    <section aria-labelledby="parking-heading" className="space-y-6" id="parking">
      <div className="space-y-2">
        <SectionTitle
          as="h1"
          icon={SquareParking}
          iconClassName="bg-gradient-to-br from-sky-400 to-sky-600 text-white shadow-sky-900/20"
          id="parking-heading"
          title={title}
        />
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Pregled javno objavljenih lokacija Parking servisa Podgorica. Broj slobodnih mjesta
          prikazuje se samo kada je izvorni podatak dovoljno svjež.
        </p>
      </div>

      {(["parking", "garage"] as const).map((type) => {
        const locations = result.locations.filter((location) => location.type === type);
        if (locations.length === 0) return null;
        return (
          <section aria-labelledby={`parking-${type}-heading`} key={type}>
            <h2
              className="text-sm font-medium uppercase leading-5 tracking-[0.16em] text-slate-800 sm:text-[0.9375rem]"
              id={`parking-${type}-heading`}
            >
              {parkingTypeCopy[type]}
            </h2>
            <ul className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {locations.map((location) => {
                const availability = getParkingAvailabilityLabel(location, locale);
                return (
                  <li key={location.sourceId}>
                    <Card className="h-full border-border bg-background shadow-sm shadow-slate-950/[0.03]">
                      <CardHeader className="flex-row items-start gap-3 space-y-0 p-4 sm:p-5">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-100 text-sky-700">
                          <Building2
                            aria-hidden="true"
                            className="size-[1.125rem]"
                            strokeWidth={2}
                          />
                        </div>
                        <h3 className="text-base font-semibold leading-6 tracking-tight text-foreground">
                          {location.name}
                        </h3>
                      </CardHeader>
                      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
                        {availability.state === "fresh" ? (
                          <>
                            <p className="text-2xl font-semibold tracking-tight text-foreground">
                              {availability.freeSpaces} slobodnih mjesta
                            </p>
                            <p className="mt-1 text-sm text-muted-foreground">
                              od {location.capacity} mjesta
                            </p>
                            <p className="mt-3 text-xs leading-5 text-muted-foreground">
                              {availability.updatedLabel}
                            </p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm text-muted-foreground">
                              {location.capacity} parking mjesta
                            </p>
                            <p className="mt-2 text-sm font-medium text-foreground">
                              Dostupnost trenutno nije dostupna.
                            </p>
                          </>
                        )}
                      </CardContent>
                    </Card>
                  </li>
                );
              })}
            </ul>
          </section>
        );
      })}

      <p className="text-xs leading-5 text-muted-foreground">
        Izvor:{" "}
        <a
          className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={parkingAvailabilityPageUrl}
          rel="noopener noreferrer"
          target="_blank"
        >
          Parking servis Podgorica
          <NewTabNotice locale={locale} />
        </a>
      </p>

      <CityFeatureDiscovery city={city} currentFeature="parking" />
    </section>
  );
}

export { ParkingPage, type ParkingPageProps };
