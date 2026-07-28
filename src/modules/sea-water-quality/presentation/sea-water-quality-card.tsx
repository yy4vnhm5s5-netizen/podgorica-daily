import { Waves } from "lucide-react";

import type {
  SeaWaterQualityGrade,
  SeaWaterQualitySummary,
} from "../domain/sea-water-quality";
import { Card, CardContent, CardHeader } from "@/shared/components/ui/card";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import type { CacheFreshnessStatus } from "@/shared/lib/cache";
import type { Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";
import { getBcsPluralForm } from "@/shared/lib/pluralize";

interface SeaWaterQualityCardProps {
  lastSuccessfulRefreshAt?: string;
  locale: Locale;
  sourceUrl?: string;
  state: CacheFreshnessStatus;
  summary?: SeaWaterQualitySummary;
}

const gradeOrder: readonly SeaWaterQualityGrade[] = ["excellent", "good", "satisfactory", "poor"];

const gradeLabels: Record<SeaWaterQualityGrade, string> = {
  excellent: "Odlična",
  good: "Dobra",
  poor: "Loša",
  satisfactory: "Zadovoljavajuća",
};

function SeaWaterQualityCard({
  lastSuccessfulRefreshAt,
  locale,
  sourceUrl = "https://monitoring.morskodobro.me",
  state,
  summary,
}: SeaWaterQualityCardProps) {
  const hasData = state !== "unavailable" && summary !== undefined;

  return (
    <Card className="card-fog card-fog--info border-primary/15 bg-slate-50/65">
      <CardHeader className="flex-row items-center gap-3 space-y-0 p-4 sm:p-5">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Waves aria-hidden="true" className="size-[1.125rem]" strokeWidth={1.8} />
        </div>
        <div>
          <h2 className="text-base font-semibold tracking-tight">Kvalitet mora</h2>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Zvanično praćenje sanitarnog kvaliteta mora na javnim kupalištima
          </p>
        </div>
      </CardHeader>
      <CardContent className="p-4 pt-0 sm:p-5 sm:pt-0">
        {hasData ? (
          <>
            <p className="text-sm leading-6 text-foreground">
              <span className="font-semibold">{summary.totalLocations}</span>{" "}
              {getBcsPluralForm(summary.totalLocations, "kupalište", "kupališta", "kupališta")} pod
              kontrolom u Budvi
            </p>
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {gradeOrder.map((grade) => (
                <div className="rounded-lg border border-border bg-background/60 px-3 py-2" key={grade}>
                  <span className="block text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {gradeLabels[grade]}
                  </span>
                  <span className="block text-sm font-semibold leading-5 text-foreground">
                    {summary.gradeCounts[grade]}
                  </span>
                </div>
              ))}
            </div>
            {summary.latestSamplingDate ? (
              <p className="mt-3 text-xs leading-5 text-muted-foreground">
                Posljednje uzorkovanje:{" "}
                {formatDateTime(new Date(`${summary.latestSamplingDate}T12:00:00.000Z`), {
                  formatOptions: { dateStyle: "medium" },
                  locale: locale === "me" ? "sr-Latn-ME" : "en-US",
                }).label}
              </p>
            ) : null}
          </>
        ) : (
          <p className="text-sm leading-6 text-muted-foreground">
            Podaci trenutno nijesu dostupni.
          </p>
        )}
        {state === "stale" ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Prikazani podaci mogu biti zastarjeli.
          </p>
        ) : null}
        {lastSuccessfulRefreshAt ? (
          <p className="mt-3 text-xs leading-5 text-muted-foreground">
            Ažurirano:{" "}
            {
              formatDateTime(new Date(lastSuccessfulRefreshAt), {
                formatOptions: { dateStyle: "medium" },
                locale: locale === "me" ? "sr-Latn-ME" : "en-US",
              }).label
            }
          </p>
        ) : null}
        <p className="mt-3 text-xs leading-5 text-muted-foreground">
          Izvor:{" "}
          <a
            className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            href={sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            Javno preduzeće za upravljanje morskim dobrom Crne Gore
            <NewTabNotice locale={locale} />
          </a>
        </p>
      </CardContent>
    </Card>
  );
}

export { SeaWaterQualityCard, type SeaWaterQualityCardProps };
