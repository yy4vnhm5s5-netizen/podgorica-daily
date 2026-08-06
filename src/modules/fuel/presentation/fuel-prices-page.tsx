import {
  Droplet,
  ExternalLink,
  Fuel,
  Minus,
  TrendingDown,
  TrendingUp,
  type LucideIcon,
} from "lucide-react";

import {
  derivePreviousChange,
  formatFuelPrice,
  fuelProductIds,
  fuelProductNames,
  type FuelPriceCalculation,
  type FuelPriceChange,
  type FuelPriceChangeDirection,
  type FuelProductId,
} from "../domain/fuel-price";
import { changeWords, getFuelCardLabel } from "./fuel-card-label";
import { formatFuelDay } from "./fuel-day-label";
import { FuelPriceTrend } from "./fuel-price-trend";
import type { FuelPricesReadResult } from "../infrastructure/gov-me-fuel-prices";
import { EmptyState } from "@/shared/components/empty-state";
import { NewTabNotice } from "@/shared/components/new-tab-notice";
import { SectionTitle } from "@/shared/components/section-title";
import { Card, CardContent } from "@/shared/components/ui/card";
import { getLocaleTag, type Locale } from "@/shared/config/locale";
import { cn } from "@/shared/lib/utils";

interface FuelPricesPageProps {
  locale: Locale;
  result: FuelPricesReadResult;
}

const copy = {
  currentHeading: "Aktuelne cijene",
  effectiveFrom: "Cijene važe od",
  lastPrice: "Posljednja cijena",
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

// Fuel identity only: the gradient, the top border and the icon container. Written out in full
// because Tailwind only ships classes it can see in the source — a class name composed at runtime
// would be purged and render unstyled. The -700 text shade is used rather than -600 because -600
// on the matching -50 tint measures 3.6:1, below the 4.5:1 this design requires.
const fuelCardAccents: Record<FuelProductId, { icon: string; surface: string }> = {
  eurodiesel: {
    icon: "bg-amber-100 text-amber-700",
    surface: "border-t-2 border-t-amber-500 bg-gradient-to-br from-amber-50 to-amber-100",
  },
  eurosuper95: {
    icon: "bg-emerald-100 text-emerald-700",
    surface: "border-t-2 border-t-emerald-500 bg-gradient-to-br from-emerald-50 to-emerald-100",
  },
  eurosuper98: {
    icon: "bg-blue-100 text-blue-700",
    surface: "border-t-2 border-t-blue-500 bg-gradient-to-br from-blue-50 to-blue-100",
  },
  heatingOil: {
    icon: "bg-violet-100 text-violet-700",
    surface: "border-t-2 border-t-violet-500 bg-gradient-to-br from-violet-50 to-violet-100",
  },
};

// Deliberately independent of fuel identity: a price rise must never read as good news just
// because that fuel's identity colour happens to be green. Icon and amount share one state.
const changeBadges: Record<FuelPriceChangeDirection, string> = {
  decrease: "bg-emerald-50 text-emerald-700",
  increase: "bg-red-50 text-red-700",
  unchanged: "bg-slate-100 text-slate-700",
};

const fuelCardIcons: Record<FuelProductId, LucideIcon> = {
  eurodiesel: Fuel,
  eurosuper95: Fuel,
  eurosuper98: Fuel,
  heatingOil: Droplet,
};

const changeIcons: Record<FuelPriceChangeDirection, LucideIcon> = {
  decrease: TrendingDown,
  increase: TrendingUp,
  unchanged: Minus,
};

function formatDay(date: string, locale: Locale) {
  return formatFuelDay(date, getLocaleTag(locale));
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

          <section
            aria-label={copy.currentHeading}
            className="grid gap-4 sm:grid-cols-2 md:gap-6 lg:grid-cols-4"
          >
            {fuelProductIds.map((productId) => {
              const price = current.prices.find((entry) => entry.productId === productId);
              if (!price) return null;

              return (
                <FuelPriceCard
                  change={derivePreviousChange(current, previous, productId)}
                  key={productId}
                  locale={locale}
                  priceCents={price.priceCents}
                  productId={productId}
                />
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
              {/* Only serializable props cross into the client: the calculation data and a
                  locale tag. Date wording comes from the shared formatFuelDay module, which the
                  chart imports directly — a function prop here is what crashed the route. */}
              <FuelPriceTrend calculations={visible} localeTag={getLocaleTag(locale)} />
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

interface FuelPriceCardProps {
  change?: FuelPriceChange;
  locale: Locale;
  priceCents: number;
  productId: FuelProductId;
}

function FuelPriceCard({ change, locale, priceCents, productId }: FuelPriceCardProps) {
  const accent = fuelCardAccents[productId];
  const localeTag = getLocaleTag(locale);
  const price = formatFuelPrice(priceCents, localeTag);
  const ProductIcon = fuelCardIcons[productId];
  const ChangeIcon = change ? changeIcons[change.direction] : undefined;

  return (
    <Card
      aria-label={getFuelCardLabel(productId, priceCents, localeTag, change)}
      className={cn(
        "rounded-xl transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md",
        "motion-reduce:transition-none motion-reduce:hover:translate-y-0",
        accent.surface,
      )}
      role="group"
    >
      <CardContent className="p-4 pt-4 sm:p-5 sm:pt-5">
        <div className="flex items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span
              className={cn(
                "flex size-10 shrink-0 items-center justify-center rounded-full",
                accent.icon,
              )}
            >
              <ProductIcon aria-hidden="true" className="size-5" />
            </span>
            <span className="truncate text-sm font-medium">{fuelProductNames[productId]}</span>
          </div>
          {change && ChangeIcon ? (
            <span
              className={cn(
                "flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium",
                changeBadges[change.direction],
              )}
            >
              <ChangeIcon aria-hidden="true" className="size-4" />
              {change.direction === "unchanged"
                ? changeWords.unchanged
                : `${formatFuelPrice(change.cents, localeTag)} €`}
            </span>
          ) : null}
        </div>
        <p className="mt-2 text-2xl font-bold tracking-tight">
          <span className="tabular-nums">{price}</span> €/l
        </p>
        <p className="mt-1 text-xs text-muted-foreground">{copy.lastPrice}</p>
      </CardContent>
    </Card>
  );
}

export { FuelPricesPage, type FuelPricesPageProps };
