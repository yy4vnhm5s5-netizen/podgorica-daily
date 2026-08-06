import Link from "next/link";

import { fuelProductIds, fuelProductNames } from "@/modules/fuel/domain/fuel-price";
import type { FuelPricesReadResult } from "@/modules/fuel/infrastructure/gov-me-fuel-prices";
import { formatFuelDay } from "@/modules/fuel/presentation/fuel-day-label";
import { formatFuelPriceWithUnit } from "@/modules/fuel/presentation/fuel-price-unit";
import { getLocaleTag } from "@/shared/config/locale";
import { getFuelPricesPath } from "@/shared/config/public-routes";

// Read-only: the snapshot arrives already loaded from the route, through the same
// getFuelPrices() the /gorivo page uses. Nothing here fetches, parses or caches.
interface PlatformFuelSummaryProps {
  result: FuelPricesReadResult;
}

function PlatformFuelSummary({ result }: PlatformFuelSummaryProps) {
  const localeTag = getLocaleTag("me");
  const [current] = result.calculations;
  // A snapshot that is missing or unusable simply removes the price row. The section keeps its
  // heading and its link, and no figure is invented to fill the space.
  const prices =
    result.freshnessStatus === "unavailable" || !current
      ? []
      : fuelProductIds.flatMap((productId) => {
          const price = current.prices.find((entry) => entry.productId === productId);
          // `price` already carries productId; spreading it is the only source of that field.
          return price ? [{ name: fuelProductNames[productId], ...price }] : [];
        });

  return (
    <div className="rounded-xl border border-border bg-background px-5 py-3.5 sm:px-6 sm:py-4">
      <p className="text-xs font-medium uppercase tracking-wide text-primary">Cijene goriva</p>
      <h2
        className="mt-1.5 text-lg font-semibold tracking-tight text-slate-950 sm:text-xl"
        id="fuel-heading"
      >
        Cijene goriva u Crnoj Gori
      </h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
        Zvanične maksimalne maloprodajne cijene naftnih derivata, sa datumom važenja.
      </p>

      {prices.length > 0 ? (
        <>
          {/* gap-px over a border-coloured background draws one thin rule between cells at any
              column count, so the two-column mobile layout separates as cleanly as the
              four-column desktop one. */}
          <dl className="mt-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-border bg-border sm:grid-cols-4">
            {prices.map(({ name, priceCents, productId }) => (
              <div className="bg-background px-3 py-2.5" key={productId}>
                <dt className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {name}
                </dt>
                <dd className="mt-0.5 text-base font-bold tabular-nums tracking-tight sm:text-lg">
                  {formatFuelPriceWithUnit(priceCents, localeTag)}
                </dd>
              </div>
            ))}
          </dl>
          {/* Stated once rather than repeated in all four cells: it is the same date for every
              product, and four copies of it would be noise, not information. */}
          <p className="mt-2 text-xs text-muted-foreground">
            {`Važi od ${formatFuelDay(current.effectiveDate, localeTag)}`}
          </p>
        </>
      ) : null}

      <Link
        className="focus-visible:ring-ring mt-3 inline-flex min-h-11 items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2"
        href={getFuelPricesPath()}
      >
        Pogledaj cijene goriva
        <span aria-hidden="true">→</span>
      </Link>
    </div>
  );
}

export { PlatformFuelSummary, type PlatformFuelSummaryProps };
