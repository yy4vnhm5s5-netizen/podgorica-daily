import { ArrowRight, Waves } from "lucide-react";
import Link from "next/link";

import type { BudvaSeaWaterQualityCacheResult } from "../application/get-budva-sea-water-quality";
import { gradeLabels, gradeOrder, gradeStyles } from "./sea-water-quality-grade-styles";
import { ErrorState } from "@/shared/components/error-state";
import { InCardEmptyNote } from "@/shared/components/in-card-empty-note";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import { SectionTitle } from "@/shared/components/section-title";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { getSeaWaterQualityLocationPath } from "@/shared/config/public-routes";
import { formatDateTime } from "@/shared/lib/date";
import type { City } from "@/shared/types/city";

interface SeaWaterQualityPageProps {
  city: City;
  locationSlugs?: ReadonlyMap<number, string>;
  locale: Locale;
  result: BudvaSeaWaterQualityCacheResult;
}

function SeaWaterQualityPage({ city, locale, locationSlugs, result }: SeaWaterQualityPageProps) {
  const { lastSuccessfulRefreshAt, state, summary } = result;
  const hasData = state !== "unavailable" && summary !== undefined;

  return (
    <section aria-labelledby="plaze-heading" className="space-y-6" id="plaze">
      <div className="space-y-2">
        <SectionTitle
          as="h1"
          icon={Waves}
          iconClassName="bg-gradient-to-br from-cyan-400 to-cyan-600 text-white shadow-cyan-900/20"
          id="plaze-heading"
          title={`Plaže u ${city.locativeName ?? city.name} i kvalitet mora`}
        />
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Zvanično praćenje sanitarnog kvaliteta mora na javnim kupalištima u{" "}
          {city.locativeName ?? city.name} — podaci Javnog preduzeća za upravljanje morskim dobrom
          Crne Gore.
        </p>
      </div>

      {!hasData ? (
        <ErrorState description="Podaci trenutno nijesu dostupni." title="Kvalitet mora" />
      ) : (
        <div className="space-y-8">
          {state === "stale" ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              Prikazani podaci mogu biti zastarjeli.
            </p>
          ) : null}

          <section aria-labelledby="plaze-pregled-heading" className="space-y-3">
            <h2 className="text-base font-semibold tracking-tight" id="plaze-pregled-heading">
              Pregled kvaliteta
            </h2>
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              <div className="rounded-xl border border-brand/25 bg-brand-soft px-4 py-3 dark:border-brand/25 dark:bg-brand/10">
                <span className="block text-[11px] font-medium uppercase tracking-wide text-brand-foreground/80">
                  Kupališta
                </span>
                <span className="block text-2xl font-bold leading-tight text-brand-foreground">
                  {summary.totalLocations}
                </span>
              </div>
              {gradeOrder.map((grade) => (
                <div className={`rounded-xl border px-4 py-3 ${gradeStyles[grade]}`} key={grade}>
                  <span className="block text-[11px] font-medium uppercase tracking-wide opacity-80">
                    {gradeLabels[grade]}
                  </span>
                  <span className="block text-2xl font-bold leading-tight">
                    {summary.gradeCounts[grade]}
                  </span>
                </div>
              ))}
            </div>

            <div className="space-y-1">
              {summary.latestSamplingDate ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  Uzorkovanje:{" "}
                  {
                    formatDateTime(new Date(`${summary.latestSamplingDate}T12:00:00.000Z`), {
                      formatOptions: { dateStyle: "medium" },
                      locale: getLocaleTag(locale),
                    }).label
                  }
                </p>
              ) : null}
              {lastSuccessfulRefreshAt ? (
                <p className="text-xs leading-5 text-muted-foreground">
                  Posljednje osvježenje:{" "}
                  {
                    formatDateTime(new Date(lastSuccessfulRefreshAt), {
                      formatOptions: { dateStyle: "medium" },
                      locale: getLocaleTag(locale),
                    }).label
                  }
                </p>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="plaze-tabela-heading" className="space-y-3">
            <div className="space-y-1">
              <h2 className="text-base font-semibold tracking-tight" id="plaze-tabela-heading">
                Sva kupališta
              </h2>
              <p className="text-xs italic leading-5 text-muted-foreground">
                Kliknite na ime plaže za detaljne informacije
              </p>
            </div>
            <BeachTable
              city={city}
              locale={locale}
              locationSlugs={locationSlugs}
              summary={summary}
            />
          </section>
        </div>
      )}

      <a
        className="inline-flex min-h-11 items-center text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        href="https://monitoring.morskodobro.me"
        rel="noopener noreferrer"
        target="_blank"
      >
        Izvor: Javno preduzeće za upravljanje morskim dobrom Crne Gore
        <NewTabNotice locale={locale} />
      </a>
    </section>
  );
}

function BeachTable({
  city,
  locale,
  locationSlugs,
  summary,
}: {
  city: City;
  locale: Locale;
  locationSlugs?: ReadonlyMap<number, string>;
  summary: NonNullable<BudvaSeaWaterQualityCacheResult["summary"]>;
}) {
  if (summary.locations.length === 0) {
    return (
      <InCardEmptyNote icon={Waves}>
        Pojedinačni rezultati po kupalištima trenutno nijesu dostupni.
      </InCardEmptyNote>
    );
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-border">
      <table className="w-full min-w-[32rem] text-left text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/40 text-xs uppercase tracking-wide text-muted-foreground">
            <th className="px-4 py-3 font-medium" scope="col">
              Kupalište
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              Kvalitet vode
            </th>
            <th className="px-4 py-3 font-medium" scope="col">
              Datum uzorkovanja
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {summary.locations.map((location) => {
            const locationSlug = locationSlugs?.get(location.id);
            return (
              <tr key={location.id}>
                <td className="px-4 py-3 font-medium text-foreground">
                  {/* The arrow is a navigation affordance for the detail page, so it only ever
                      accompanies a location that actually has one. Locations without history keep
                      their plain-text rendering. */}
                  {locationSlug ? (
                    <Link
                      className="inline-flex items-center gap-1 underline-offset-4 hover:text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                      href={getSeaWaterQualityLocationPath(city, locationSlug)}
                    >
                      <ArrowRight
                        aria-hidden="true"
                        className="size-3.5 shrink-0 text-muted-foreground"
                      />
                      {location.name}
                    </Link>
                  ) : (
                    location.name
                  )}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${gradeStyles[location.grade]}`}
                  >
                    {gradeLabels[location.grade]}
                  </span>
                </td>
                <td className="px-4 py-3 text-muted-foreground">
                  {location.samplingDate
                    ? formatDateTime(new Date(`${location.samplingDate}T12:00:00.000Z`), {
                        formatOptions: { dateStyle: "medium" },
                        locale: getLocaleTag(locale),
                      }).label
                    : "—"}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { SeaWaterQualityPage, type SeaWaterQualityPageProps };
