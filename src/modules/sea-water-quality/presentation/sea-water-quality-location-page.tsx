import { Waves } from "lucide-react";
import Link from "next/link";

import type {
  SeaWaterQualityHistoryLocation,
  SeaWaterQualityHistoryMeasurement,
} from "../domain/sea-water-quality.ts";
import { gradeLabels, gradeStyles } from "./sea-water-quality-grade-styles";
import { getSeaWaterQualityLocationBreadcrumbTrail } from "./sea-water-quality-location-structured-data";
import {
  getDistinctBeachName,
  getSeaWaterQualityLocationSummary,
  type SeaWaterQualityLocationSummary,
} from "./sea-water-quality-location-ui-model.ts";
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
  const breadcrumb = getSeaWaterQualityLocationBreadcrumbTrail({
    city,
    locationName: location.displayName,
    slug: location.canonicalSlug,
  });
  const beachName = getDistinctBeachName(location);
  const summary = getSeaWaterQualityLocationSummary(location);

  return (
    <section aria-labelledby="plaza-heading" className="space-y-6" id="plaza">
      {/* Same trail as the BreadcrumbList JSON-LD emitted by the route, built from one helper so
          the visible hierarchy and the structured data cannot disagree. */}
      <nav aria-label="Putanja" className="text-xs leading-5 text-muted-foreground">
        <ol className="flex flex-wrap items-center gap-x-1.5">
          {breadcrumb.map((step, index) => {
            const isCurrent = index === breadcrumb.length - 1;
            return (
              <li className="flex items-center gap-x-1.5" key={step.href}>
                {index > 0 ? <span aria-hidden="true">/</span> : null}
                {isCurrent ? (
                  <span aria-current="page">{step.name}</span>
                ) : (
                  <Link
                    className="underline-offset-4 hover:text-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    href={step.href}
                  >
                    {step.name}
                  </Link>
                )}
              </li>
            );
          })}
        </ol>
      </nav>

      <div className="space-y-2">
        <SectionTitle
          as="h1"
          icon={Waves}
          iconClassName="bg-gradient-to-br from-cyan-400 to-cyan-600 text-white shadow-cyan-900/20"
          id="plaza-heading"
          title={`${location.displayName}, ${city.name} — kvalitet mora`}
        />
        {/* Secondary context only: JPMD's `plaza` names the wider beach a sampling point sits on.
            The H1 keeps identifying the monitoring location itself, which is what this canonical
            URL represents — there is no separate beach route for the beach to link to. */}
        {beachName ? (
          <p className="text-sm leading-6 text-muted-foreground">
            Plaža: <span className="font-medium text-foreground">{beachName}</span>
          </p>
        ) : null}
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

      {summary ? (
        <section aria-labelledby="sazetak-mjerenja-heading" className="space-y-2">
          <h2 className="text-base font-semibold tracking-tight" id="sazetak-mjerenja-heading">
            Sažetak mjerenja
          </h2>
          <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
            {describeMeasurementCounts(summary)}
            {summary.comparison ? ` ${describeComparison(summary, locale)}` : ""}
          </p>
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

// Both sentences below are assembled from the derived counts only. They state what JPMD measured
// and nothing about the beach, the water's suitability, or any legal threshold — JPMD's own grade
// wording is reused verbatim via gradeLabels.
function describeMeasurementCounts(summary: SeaWaterQualityLocationSummary) {
  const latestLabel = gradeLabels[summary.latest.grade].toLocaleLowerCase("sr-Latn-ME");
  if (summary.measurementCount === 1) {
    return `Dostupno je jedno mjerenje, ocijenjeno kao ${latestLabel}.`;
  }
  if (summary.uniformGrade) {
    return `Svih ${summary.measurementCount} dostupnih mjerenja ocijenjeno je kao ${latestLabel}.`;
  }
  const breakdown = summary.breakdown
    .map(({ count, grade }) => `${count}× ${gradeLabels[grade].toLocaleLowerCase("sr-Latn-ME")}`)
    .join(", ");
  return `Od ${summary.measurementCount} dostupnih mjerenja: ${breakdown}.`;
}

function describeComparison(summary: SeaWaterQualityLocationSummary, locale: Locale) {
  const { comparison } = summary;
  if (!comparison) return "";
  const previousDate = formatMeasurementDate(comparison.previous, locale);
  const previousLabel = gradeLabels[comparison.previous.grade].toLocaleLowerCase("sr-Latn-ME");
  const suffix = previousDate ? ` (${previousDate}: ${previousLabel})` : ` (${previousLabel})`;

  if (comparison.trend === "unchanged") {
    return `Posljednje mjerenje donijelo je istu ocjenu kao prethodno${suffix}.`;
  }
  const direction = comparison.trend === "improved" ? "bolju" : "slabiju";
  return `Posljednje mjerenje donijelo je ${direction} ocjenu nego prethodno${suffix}.`;
}

function formatMeasurementDate(measurement: SeaWaterQualityHistoryMeasurement, locale: Locale) {
  if (!measurement.samplingDate) return measurement.samplingDateTime;
  return formatDateTime(new Date(`${measurement.samplingDate}T12:00:00.000Z`), {
    formatOptions: { dateStyle: "medium" },
    locale: getLocaleTag(locale),
  }).label;
}

export { SeaWaterQualityLocationPage, type SeaWaterQualityLocationPageProps };
