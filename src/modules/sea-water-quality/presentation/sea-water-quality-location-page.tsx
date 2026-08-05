import { ArrowDown, ArrowRight, ArrowUp, MapPin, Waves } from "lucide-react";
import Link from "next/link";

import type {
  SeaWaterQualityHistory,
  SeaWaterQualityHistoryLocation,
  SeaWaterQualityHistoryMeasurement,
} from "../domain/sea-water-quality.ts";
import { getGradeBadgeClassName, gradeLabels } from "./sea-water-quality-grade-styles";
import { getSeaWaterQualityMapUrl } from "./sea-water-quality-map-point";
import { getSeaWaterQualityLocationBreadcrumbTrail } from "./sea-water-quality-location-structured-data";
import {
  getDistinctBeachName,
  getRelatedSeaWaterQualityLocations,
  getSeaWaterQualityLocationSummary,
  type SeaWaterQualityTrend,
} from "./sea-water-quality-location-ui-model.ts";
import {
  getSeaWaterQualityAdvertisingDescription,
  seaWaterQualityAdvertisingAriaLabel,
  seaWaterQualityAdvertisingCta,
  seaWaterQualityAdvertisingTitle,
} from "./sea-water-quality-advertising.ts";
import { AdvertisingCard } from "@/shared/components/dashboard/advertising-card";
import { ExploreCityLinks } from "@/shared/components/explore-city-links";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import { SectionTitle } from "@/shared/components/section-title";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { getContactPath } from "@/shared/config/public-routes";
import { getSeaWaterQualityLocationPath } from "@/shared/config/public-routes";
import { formatDateTime } from "@/shared/lib/date";
import { formatBcsCount } from "@/shared/lib/pluralize";
import type { CacheFreshnessStatus } from "@/shared/lib/cache";
import type { City } from "@/shared/types/city";

interface SeaWaterQualityLocationPageProps {
  city: City;
  /** The city's own history — already loaded by the route, so siblings cost no extra read. */
  history?: Pick<SeaWaterQualityHistory, "locations">;
  lastSuccessfulRefreshAt?: string;
  locale: Locale;
  location: SeaWaterQualityHistoryLocation;
  sourceUrl: string;
  state: CacheFreshnessStatus;
}

function SeaWaterQualityLocationPage({
  city,
  history,
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
  // Derived from THIS location's own official polygon — never a sibling's, and never presented as
  // the sampling coordinate itself (see sea-water-quality-map-point.ts).
  const mapUrl = getSeaWaterQualityMapUrl(location.officialGeometry);
  const relatedLocations = history ? getRelatedSeaWaterQualityLocations(history, location) : [];

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
              className={getGradeBadgeClassName(latestMeasurement.grade)}
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
          {mapUrl ? (
            <a
              aria-label="Otvori zonu mjernog mjesta na mapi"
              className="mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              href={mapUrl}
              rel="noopener noreferrer"
              target="_blank"
            >
              <MapPin aria-hidden="true" className="size-4" strokeWidth={1.8} />
              Zona mjernog mjesta na mapi
              <NewTabNotice locale={locale} />
            </a>
          ) : null}
        </section>
      ) : null}

      {summary ? (
        <section aria-labelledby="sazetak-mjerenja-heading" className="space-y-3">
          <h2 className="text-base font-semibold tracking-tight" id="sazetak-mjerenja-heading">
            Sažetak mjerenja
          </h2>
          <p className="text-sm leading-6 text-muted-foreground">
            {formatBcsCount(
              summary.measurementCount,
              "dostupno mjerenje",
              "dostupna mjerenja",
              "dostupnih mjerenja",
            )}
          </p>
          {/* Static chips, not controls: no href, no handler, no hover affordance. The grade word
              is always written out, so colour is never the only carrier of meaning. */}
          <ul className="flex flex-wrap gap-2">
            {summary.breakdown.map(({ count, grade }) => (
              <li key={grade}>
                <span className={getGradeBadgeClassName(grade)}>
                  {summary.uniformGrade ? `${count}/${summary.measurementCount}` : `${count}×`}{" "}
                  {gradeLabels[grade]}
                </span>
              </li>
            ))}
          </ul>
          {summary.comparison ? (
            <div className="space-y-1">
              <p className="flex items-center gap-1.5 text-sm font-medium leading-6">
                <ComparisonArrow trend={summary.comparison.trend} />
                {comparisonLabels[summary.comparison.trend]}
              </p>
              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-muted-foreground">
                Prethodno:
                <span className={getGradeBadgeClassName(summary.comparison.previous.grade)}>
                  {gradeLabels[summary.comparison.previous.grade]}
                </span>
                {formatMeasurementDate(summary.comparison.previous, locale) ? (
                  <span>· {formatMeasurementDate(summary.comparison.previous, locale)}</span>
                ) : null}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      {/* Placed after the latest result and the measurement summary, so the reader has the water
          quality facts before any promotional content. One banner per page. */}
      <AdvertisingCard
        align="center"
        ariaLabel={seaWaterQualityAdvertisingAriaLabel}
        description={getSeaWaterQualityAdvertisingDescription(city, "detail")}
        href={getContactPath()}
        subtitle={seaWaterQualityAdvertisingCta}
        title={seaWaterQualityAdvertisingTitle}
      />

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
                      className={getGradeBadgeClassName(measurement.grade)}
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

      {relatedLocations.length > 0 ? (
        <nav aria-labelledby="druga-mjerna-mjesta-heading" className="space-y-3">
          <h2 className="text-sm font-semibold tracking-tight" id="druga-mjerna-mjesta-heading">
            Druga mjerna mjesta na istoj plaži
          </h2>
          {/* Ordinary crawlable links, one per sibling monitoring point, anchored on the point's
              own name rather than "detalji" or "pogledaj". They are visually lighter than the
              grade badges above so the result blocks stay dominant. */}
          <ul className="flex flex-wrap gap-2">
            {relatedLocations.map((related) => (
              <li key={related.canonicalSlug}>
                <Link
                  className="inline-flex min-h-10 items-center rounded-lg border border-border bg-background px-3 py-1.5 text-xs font-semibold text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                  href={getSeaWaterQualityLocationPath(city, related.canonicalSlug)}
                >
                  {related.displayName}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

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

// Direction is carried by the wording; the arrow only reinforces it, so it is aria-hidden and no
// colour is used to signal improvement or deterioration.
const comparisonLabels = {
  improved: "Bolja ocjena nego prethodno mjerenje",
  unchanged: "Ista ocjena kao prethodno mjerenje",
  worsened: "Slabija ocjena nego prethodno mjerenje",
} as const satisfies Record<SeaWaterQualityTrend, string>;

function ComparisonArrow({ trend }: { trend: SeaWaterQualityTrend }) {
  const Icon = trend === "improved" ? ArrowUp : trend === "worsened" ? ArrowDown : ArrowRight;
  return <Icon aria-hidden="true" className="size-4 shrink-0 text-muted-foreground" />;
}

function formatMeasurementDate(measurement: SeaWaterQualityHistoryMeasurement, locale: Locale) {
  if (!measurement.samplingDate) return measurement.samplingDateTime;
  return formatDateTime(new Date(`${measurement.samplingDate}T12:00:00.000Z`), {
    formatOptions: { dateStyle: "medium" },
    locale: getLocaleTag(locale),
  }).label;
}

export { SeaWaterQualityLocationPage, type SeaWaterQualityLocationPageProps };
