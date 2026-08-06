import { ArrowDown, ArrowUp, ExternalLink, Fuel, Minus } from "lucide-react";

import {
  derivePreviousChange,
  formatFuelPrice,
  fuelProductIds,
  fuelProductNames,
  type FuelPriceCalculation,
  type FuelPriceChange,
} from "../domain/fuel-price";
import { FuelPriceTrend } from "./fuel-price-trend";
import type { FuelPricesReadResult } from "../infrastructure/gov-me-fuel-prices";
import { EmptyState } from "@/shared/components/empty-state";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import { SectionTitle } from "@/shared/components/section-title";
import { Card, CardContent } from "@/shared/components/ui/card";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { formatDateTime } from "@/shared/lib/date";

interface FuelPricesPageProps {
  locale: Locale;
  result: FuelPricesReadResult;
}

const copy = {
  currentHeading: "Aktuelne cijene",
  effectiveFrom: "Cijene važe od",
  historyHeading: "Prethodne cijene",
  trendHeading: "Kretanje cijena goriva",
  intro: "Aktuelne maksimalne maloprodajne cijene naftnih derivata u Crnoj Gori.",
  nextCalculation: "Naredni obračun",
  source: "Izvor",
  sourceLink: "Zvanično saopštenje",
  stale: "Prikazani su posljednji dostupni zvanični podaci.",
  title: "Cijene goriva u Crnoj Gori",
  unavailable: "Podaci o cijenama goriva trenutno nijesu dostupni.",
  unavailableTitle: "Nema dostupnih podataka",
} as const;

// The cache keeps the full official history; a page shows a readable slice of it.
const historyRowLimit = 12;

function formatDay(date: string, locale: Locale) {
  return formatDateTime(new Date(`${date}T12:00:00.000Z`), {
    formatOptions: { dateStyle: "long", timeStyle: undefined },
    locale: getLocaleTag(locale),
  }).label;
}

function FuelPricesPage({ locale, result }: FuelPricesPageProps) {
  const [current, previous] = result.calculations;
  // One dataset for the chart and the table, so the two views can never disagree.
  const visible = result.calculations.slice(0, historyRowLimit);
  const isUnavailable = result.freshnessStatus === "unavailable" || !current;

  return (
    <section aria-labelledby="gorivo-heading" className="space-y-8" id="gorivo">
      <div className="space-y-2">
        <SectionTitle
          as="h1"
          icon={Fuel}
          iconClassName="bg-gradient-to-br from-amber-400 to-amber-600 text-white shadow-amber-900/20"
          id="gorivo-heading"
          title={copy.title}
        />
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">{copy.intro}</p>
      </div>

      {isUnavailable ? (
        <EmptyState description={copy.unavailable} title={copy.unavailableTitle} />
      ) : (
        <>
          {/* Applies to a retained snapshot too: last week's official prices are still the last
              official prices, so they stay visible rather than being replaced by an error. */}
          {result.freshnessStatus === "stale" ? (
            <p
              className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950"
              role="status"
            >
              {copy.stale}
            </p>
          ) : null}

          <section aria-label={copy.currentHeading} className="grid gap-3 sm:grid-cols-2">
            {fuelProductIds.map((productId) => {
              const price = current.prices.find((entry) => entry.productId === productId);
              if (!price) return null;
              const change = derivePreviousChange(current, previous, productId);

              return (
                <Card className="border-border bg-card shadow-none" key={productId}>
                  <CardContent className="space-y-1 p-4 sm:p-5">
                    <p className="text-sm font-medium text-muted-foreground">
                      {fuelProductNames[productId]}
                    </p>
                    <p className="text-2xl font-semibold tracking-tight sm:text-3xl">
                      {formatFuelPrice(price.priceCents, getLocaleTag(locale))} €/l
                    </p>
                    <ChangeBadge change={change} locale={locale} />
                  </CardContent>
                </Card>
              );
            })}
          </section>

          <dl className="space-y-1 text-sm">
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">{copy.effectiveFrom}:</dt>
              <dd className="font-medium">{formatDay(current.effectiveDate, locale)}</dd>
            </div>
            {/* Only when the ministry actually stated it — most articles do not. */}
            {current.nextCalculationDate ? (
              <div className="flex flex-wrap gap-x-2">
                <dt className="text-muted-foreground">{copy.nextCalculation}:</dt>
                <dd className="font-medium">{formatDay(current.nextCalculationDate, locale)}</dd>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-x-2">
              <dt className="text-muted-foreground">{copy.source}:</dt>
              <dd className="font-medium">{current.sourceName}</dd>
            </div>
          </dl>

          <a
            className="focus-visible:ring-ring inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2"
            href={current.sourceUrl}
            rel="noopener noreferrer"
            target="_blank"
          >
            {copy.sourceLink}
            <NewTabNotice locale={locale} />
            <ExternalLink aria-hidden="true" className="size-3.5" />
          </a>

          {result.calculations.length > 1 ? (
            <section aria-labelledby="gorivo-kretanje" className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight" id="gorivo-kretanje">
                {copy.trendHeading}
              </h2>
              {/* The only client boundary on the page: the selector needs state. Current prices,
                  the effective date, the source link and the full history table above and below it
                  all stay server-rendered, so every official value is in the initial HTML. */}
              <FuelPriceTrend
                calculations={visible}
                formatDay={(date) => formatDay(date, locale)}
                localeTag={getLocaleTag(locale)}
              />
            </section>
          ) : null}

          {result.calculations.length > 1 ? (
            <section aria-labelledby="gorivo-istorija" className="space-y-3">
              <h2 className="text-lg font-semibold tracking-tight" id="gorivo-istorija">
                {copy.historyHeading}
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[34rem] border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">Datum</th>
                      {fuelProductIds.map((productId) => (
                        <th className="py-2 pr-3 font-medium" key={productId}>
                          {fuelProductNames[productId]}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((calculation) => (
                      <HistoryRow
                        calculation={calculation}
                        key={calculation.effectiveDate}
                        locale={locale}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          ) : null}
        </>
      )}
    </section>
  );
}

interface HistoryRowProps {
  calculation: FuelPriceCalculation;
  locale: Locale;
}

function HistoryRow({ calculation, locale }: HistoryRowProps) {
  return (
    <tr className="border-b border-border/60">
      <td className="py-2 pr-3 whitespace-nowrap">
        {formatDay(calculation.effectiveDate, locale)}
      </td>
      {fuelProductIds.map((productId) => {
        const price = calculation.prices.find((entry) => entry.productId === productId);
        return (
          <td className="py-2 pr-3 whitespace-nowrap" key={productId}>
            {/* A product the source did not publish stays visibly absent rather than showing 0. */}
            {price ? `${formatFuelPrice(price.priceCents, getLocaleTag(locale))} €` : "—"}
          </td>
        );
      })}
    </tr>
  );
}

function ChangeBadge({ change, locale }: { change?: FuelPriceChange; locale: Locale }) {
  if (!change) return null;
  if (change.direction === "unchanged") {
    return (
      <p className="flex items-center gap-1 text-sm text-muted-foreground">
        <Minus aria-hidden="true" className="size-3.5" />
        bez promjene
      </p>
    );
  }

  const Icon = change.direction === "increase" ? ArrowUp : ArrowDown;
  return (
    <p
      className={`flex items-center gap-1 text-sm ${
        change.direction === "increase" ? "text-red-700" : "text-emerald-700"
      }`}
    >
      <Icon aria-hidden="true" className="size-3.5" />
      {formatFuelPrice(change.cents, getLocaleTag(locale))} €
    </p>
  );
}

export { FuelPricesPage, type FuelPricesPageProps };
