import { SquareParking } from "lucide-react";
import Link from "next/link";

import type { ParkingAvailabilityReadModel } from "../domain/parking-availability.ts";
import { getParkingDashboardSummary } from "./parking-ui-model.ts";
import { InCardEmptyNote } from "@/shared/components/in-card-empty-note";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { getParkingPath } from "@/shared/config/public-routes";
import type { City } from "@/shared/types/city";

interface ParkingAvailabilityCardProps {
  city: City;
  result: ParkingAvailabilityReadModel;
}

function ParkingAvailabilityCard({ city, result }: ParkingAvailabilityCardProps) {
  const summary = getParkingDashboardSummary(result.locations);

  return (
    <Card className="border-border bg-background transition-[box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-[0_12px_24px_-20px_rgb(15_23_42_/_0.32)]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-blue-400 to-blue-600 text-white shadow-sm shadow-blue-900/20">
          <SquareParking aria-hidden="true" className="size-[1.125rem]" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">Parking</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">Slobodna mjesta</p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {summary.locations.length > 0 ? (
          <>
            <ul aria-label="Slobodna mjesta po lokaciji" className="divide-y divide-primary/10">
              {summary.locations.map((location) => (
                <li
                  className="flex items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0"
                  key={location.sourceId}
                >
                  <span className="min-w-0 break-words text-sm font-semibold leading-5">
                    {location.name}
                  </span>
                  <span className="shrink-0 text-sm font-semibold tabular-nums text-foreground">
                    {location.freeSpaces}
                    <span className="sr-only"> slobodnih mjesta</span>
                  </span>
                </li>
              ))}
            </ul>
            {summary.summaryLabel ? (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">{summary.summaryLabel}</p>
            ) : null}
          </>
        ) : (
          <InCardEmptyNote icon={SquareParking}>
            Trenutno nema dostupnih ažuriranih podataka.
          </InCardEmptyNote>
        )}
        <Link
          className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          href={getParkingPath(city)}
        >
          Sva parkirališta
          <span aria-hidden="true">→</span>
        </Link>
      </CardContent>
    </Card>
  );
}

export { ParkingAvailabilityCard, type ParkingAvailabilityCardProps };
