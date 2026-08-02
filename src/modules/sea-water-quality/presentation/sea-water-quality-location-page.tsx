import { Waves } from "lucide-react";

import type { SeaWaterQualityHistoryLocation } from "../domain/sea-water-quality.ts";
import { gradeLabels, gradeStyles } from "./sea-water-quality-grade-styles";
import { ExploreCityLinks } from "@/shared/components/explore-city-links";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import { SectionTitle } from "@/shared/components/section-title";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";
import type { CacheFreshnessStatus } from "@/shared/lib/cache";
import type { City } from "@/shared/types/city";

interface SeaWaterQualityLocationPageProps {
  city: City;
  lastSuccessfulRefreshAt?: string;
  locale: Locale;
  location: SeaWaterQualityHistoryLocation;
  sourceUrl: string;
  state: CacheFreshnessStatus;
}

function SeaWaterQualityLocationPage({
  city,
  lastSuccessfulRefreshAt,
  locale,
  location,
  sourceUrl,
  state,
}: SeaWaterQualityLocationPageProps) {
  const latestMeasurement = location.measurements.at(-1);

  return (
    <section aria-labelledby="plaza-heading" className="space-y-6" id="plaza">
      <div className="space-y-2">
        <SectionTitle
          as="h1"
          icon={Waves}
          iconClassName="bg-gradient-to-br from-cyan-400 to-cyan-600 text-white shadow-cyan-900/20"
          id="plaza-heading"
          title={`${location.displayName}, ${city.name} — kvalitet mora`}
        />
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Rezultati zvaničnog praćenja sanitarnog kvaliteta mora za ovo kupalište.
        </p>
      </div>

      {state === "stale" ? (
        <p
          className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
          role="status"
        >
          Prikazani podaci mogu biti zastarjeli.
        </p>
      ) : null}

      {latestMeasurement ? (
        <section
          aria-labelledby="najnoviji-rezultat-heading"
          className="bg-card rounded-xl border border-border p-5"
        >
          <h2 className="text-sm font-semibold tracking-tight" id="najnoviji-rezultat-heading">
            Najnoviji rezultat
          </h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span
              className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${gradeStyles[latestMeasurement.grade]}`}
            >
              {gradeLabels[latestMeasurement.grade]}
            </span>
            {latestMeasurement.samplingDateTime ? (
              <span className="text-sm text-muted-foreground">
                Uzorkovanje: {latestMeasurement.samplingDateTime}
              </span>
            ) : latestMeasurement.samplingDate ? (
              <span className="text-sm text-muted-foreground">
                Uzorkovanje:{" "}
                {
                  formatDateTime(new Date(`${latestMeasurement.samplingDate}T12:00:00.000Z`), {
                    formatOptions: { dateStyle: "medium" },
                    locale: getLocaleTag(locale),
                  }).label
                }
              </span>
            ) : null}
          </div>
        </section>
      ) : null}

      <section aria-labelledby="istorija-uzorkovanja-heading" className="space-y-3">
        <h2 className="text-base font-semibold tracking-tight" id="istorija-uzorkovanja-heading">
          Istorija uzorkovanja
        </h2>
        <div className="rounded-xl border border-border">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
                <th className="px-4 py-3 font-medium" scope="col">
                  Kvalitet vode
                </th>
                <th className="px-4 py-3 font-medium" scope="col">
                  Datum uzorkovanja
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {[...location.measurements].reverse().map((measurement) => (
                <tr key={measurement.sourceRound}>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${gradeStyles[measurement.grade]}`}
                    >
                      {gradeLabels[measurement.grade]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {measurement.samplingDateTime ?? measurement.samplingDate ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="text-sm italic text-muted-foreground">
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
      {lastSuccessfulRefreshAt ? (
        <p className="text-xs leading-5 text-muted-foreground">
          Posljednje osvježenje:{" "}
          {
            formatDateTime(new Date(lastSuccessfulRefreshAt), {
              formatOptions: { dateStyle: "medium", timeStyle: "short" },
              locale: getLocaleTag(locale),
            }).label
          }
        </p>
      ) : null}

      {/* The beach listing this page already belongs to is excluded, so the block only offers
          genuinely different destinations within the same city. */}
      <ExploreCityLinks city={city} exclude={["seaWaterQuality"]} />
    </section>
  );
}

export { SeaWaterQualityLocationPage, type SeaWaterQualityLocationPageProps };
