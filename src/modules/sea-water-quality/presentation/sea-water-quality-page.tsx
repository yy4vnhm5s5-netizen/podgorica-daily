import type { BudvaSeaWaterQualityCacheResult } from "../application/get-budva-sea-water-quality";
import { gradeLabels, gradeOrder, gradeStyles } from "./sea-water-quality-grade-styles";
import { ErrorState } from "@/shared/components/error-state";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import { SectionTitle } from "@/shared/components/section-title";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";
import type { City } from "@/shared/types/city";

interface SeaWaterQualityPageProps {
  city: City;
  locale: Locale;
  result: BudvaSeaWaterQualityCacheResult;
}

function SeaWaterQualityPage({ city, locale, result }: SeaWaterQualityPageProps) {
  const { lastSuccessfulRefreshAt, state, summary } = result;
  const hasData = state !== "unavailable" && summary !== undefined;

  return (
    <section aria-labelledby="plaze-heading" className="space-y-6" id="plaze">
      <div className="space-y-2">
        <SectionTitle as="h1" id="plaze-heading" title={`Plaže ${city.name}`} />
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          Zvanično praćenje sanitarnog kvaliteta mora na javnim kupalištima u {city.locativeName ?? city.name} —
          podaci Javnog preduzeća za upravljanje morskim dobrom Crne Gore.
        </p>
      </div>

      {!hasData ? (
        <ErrorState
          description="Podaci trenutno nijesu dostupni."
          title="Kvalitet mora"
        />
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

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <div className="rounded-xl border border-border bg-background/60 px-4 py-3">
              <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Kupališta
              </span>
              <span className="block text-2xl font-bold leading-tight text-foreground">
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

          <BeachTable locale={locale} summary={summary} />
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
  locale,
  summary,
}: {
  locale: Locale;
  summary: NonNullable<BudvaSeaWaterQualityCacheResult["summary"]>;
}) {
  if (summary.locations.length === 0) {
    return (
      <p className="text-sm leading-6 text-muted-foreground">
        Pojedinačni rezultati po kupalištima trenutno nijesu dostupni.
      </p>
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
          {summary.locations.map((location) => (
            <tr key={location.id}>
              <td className="px-4 py-3 font-medium text-foreground">{location.name}</td>
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
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { SeaWaterQualityPage, type SeaWaterQualityPageProps };
