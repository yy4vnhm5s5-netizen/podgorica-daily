import { Waves } from "lucide-react";
import Link from "next/link";

import type { SeaWaterQualitySummary } from "../domain/sea-water-quality";
import { gradeLabels, gradeOrder, gradeStyles } from "./sea-water-quality-grade-styles";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { InCardEmptyNote } from "@/shared/components/in-card-empty-note";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import type { CacheFreshnessStatus } from "@/shared/lib/cache";
import type { Locale } from "@/shared/config/locale";
import { getSeaWaterQualityPath } from "@/shared/config/public-routes";
import { formatDateTime } from "@/shared/lib/date";
import type { City } from "@/shared/types/city";

interface SeaWaterQualityCardProps {
  city: City;
  lastSuccessfulRefreshAt?: string;
  locale: Locale;
  sourceUrl?: string;
  state: CacheFreshnessStatus;
  summary?: SeaWaterQualitySummary;
}

function SeaWaterQualityCard({
  city,
  lastSuccessfulRefreshAt,
  locale,
  sourceUrl = "https://monitoring.morskodobro.me",
  state,
  summary,
}: SeaWaterQualityCardProps) {
  const hasData = state !== "unavailable" && summary !== undefined;

  return (
    <Card className="border-border bg-background shadow-[0_18px_42px_-32px_rgb(8_145_178_/_0.3)]">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-cyan-600 text-white shadow-sm shadow-cyan-900/20">
          <Waves aria-hidden="true" className="size-[1.125rem]" strokeWidth={2} />
        </div>
        <div>
          <h2 className="text-sm font-medium uppercase leading-5 tracking-[0.16em] text-slate-800 sm:text-[0.9375rem]">
            Kvalitet mora
          </h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Zvanično praćenje sanitarnog kvaliteta mora na javnim kupalištima
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {hasData ? (
          <>
            <p className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm text-muted-foreground">
              <span className="text-4xl font-bold leading-none tracking-tight text-foreground">
                {summary.totalLocations}
              </span>
              <span>kupališta pod monitoringom</span>
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {gradeOrder.map((grade) => (
                <div className={`rounded-lg border px-3 py-2 ${gradeStyles[grade]}`} key={grade}>
                  <span className="block text-[11px] font-medium uppercase tracking-wide opacity-80">
                    {gradeLabels[grade]}
                  </span>
                  <span className="block text-sm font-semibold leading-5">
                    {summary.gradeCounts[grade]}
                  </span>
                </div>
              ))}
            </div>
            <Link
              className="mt-4 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={getSeaWaterQualityPath(city)}
            >
              Pogledajte sva kupališta
              <span aria-hidden="true">→</span>
            </Link>
          </>
        ) : (
          <InCardEmptyNote icon={Waves}>Podaci trenutno nijesu dostupni.</InCardEmptyNote>
        )}
        {state === "stale" ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Prikazani podaci mogu biti zastarjeli.
          </p>
        ) : null}
        <div className="mt-3 space-y-0.5 text-xs leading-5 text-muted-foreground">
          {hasData && summary.latestSamplingDate ? (
            <p>
              Uzorkovanje:{" "}
              {
                formatDateTime(new Date(`${summary.latestSamplingDate}T12:00:00.000Z`), {
                  formatOptions: { dateStyle: "medium" },
                  locale: locale === "me" ? "sr-Latn-ME" : "en-US",
                }).label
              }
            </p>
          ) : null}
          {lastSuccessfulRefreshAt ? (
            <p>
              Posljednje osvježenje:{" "}
              {
                formatDateTime(new Date(lastSuccessfulRefreshAt), {
                  formatOptions: { dateStyle: "medium" },
                  locale: locale === "me" ? "sr-Latn-ME" : "en-US",
                }).label
              }
            </p>
          ) : null}
          <p className="italic">
            Izvor:{" "}
            <a
              className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={sourceUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              JPMD
              <NewTabNotice locale={locale} />
            </a>
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

export { SeaWaterQualityCard, type SeaWaterQualityCardProps };
