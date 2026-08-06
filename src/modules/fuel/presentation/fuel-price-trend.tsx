"use client";

import { useId, useState } from "react";

import {
  derivePreviousChange,
  formatFuelPrice,
  fuelProductIds,
  fuelProductNames,
  type FuelPriceCalculation,
  type FuelPriceChangeDirection,
  type FuelProductId,
} from "../domain/fuel-price";
import { formatFuelDay } from "./fuel-day-label";
import {
  formatFuelPriceWithUnit,
  formatFuelRangeWithUnit,
  fuelUnitLabel,
} from "./fuel-price-unit";
import {
  getTrendPointDetails,
  getTrendPointLabel,
  getTrendPoints,
  type TrendPoint,
  type TrendPointDetails,
} from "./fuel-price-trend-model";
import { getRovingTabIndex } from "@/shared/lib/roving-tab-index";
import { cn } from "@/shared/lib/utils";

interface FuelPriceTrendProps {
  // The same normalized calculations the price cards and the history table render. There is no
  // second dataset and no separate historical parser: one official history, three views of it.
  calculations: readonly FuelPriceCalculation[];
  // Only serializable values: a function prop cannot cross a Server → Client boundary.
  localeTag: string;
}

// "Sve" means every calculation the page passed in. A shorter range is only offered when it would
// actually show a different set of points. The unit is one official calculation — a ministry price
// update — not a day and not a week: the publications are irregular, and an update that left a
// product's price unchanged still counts as one.
const recentCalculationCount = 6;

function FuelPriceTrend({ calculations, localeTag }: FuelPriceTrendProps) {
  const [productId, setProductId] = useState<FuelProductId>("eurosuper95");
  const [showAll, setShowAll] = useState(false);
  const tabsId = useId();

  const allPoints = getTrendPoints(calculations, productId);
  const points = showAll ? allPoints : allPoints.slice(-recentCalculationCount);
  const offersRange = allPoints.length > recentCalculationCount;
  const latest = points.at(-1);

  function selectProduct(next: FuelProductId) {
    setProductId(next);
    document.getElementById(`${tabsId}-${next}`)?.focus();
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLButtonElement>, current: FuelProductId) {
    const index = fuelProductIds.indexOf(current);
    if (event.key === "ArrowRight" || event.key === "ArrowDown") {
      event.preventDefault();
      selectProduct(fuelProductIds[(index + 1) % fuelProductIds.length]);
    }
    if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
      event.preventDefault();
      selectProduct(fuelProductIds[(index - 1 + fuelProductIds.length) % fuelProductIds.length]);
    }
  }

  const prices = points.map((point) => point.priceCents);
  const minimum = prices.length > 0 ? Math.min(...prices) : 0;
  const maximum = prices.length > 0 ? Math.max(...prices) : 0;

  return (
    <div className="space-y-4">
      <div aria-label="Izaberite gorivo" className="flex flex-wrap gap-1.5" role="tablist">
        {fuelProductIds.map((candidate) => {
          const isSelected = candidate === productId;
          return (
            <button
              aria-controls={`${tabsId}-panel`}
              aria-selected={isSelected}
              className={cn(
                "focus-visible:ring-ring min-h-10 rounded-lg border px-3 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
                isSelected
                  ? "border-amber-300 bg-amber-50 text-amber-900"
                  : "border-border text-muted-foreground hover:bg-muted/60",
              )}
              id={`${tabsId}-${candidate}`}
              key={candidate}
              onClick={() => setProductId(candidate)}
              onKeyDown={(event) => handleKeyDown(event, candidate)}
              role="tab"
              tabIndex={getRovingTabIndex(isSelected)}
              type="button"
            >
              {fuelProductNames[candidate]}
            </button>
          );
        })}
      </div>

      {/* A tabpanel has to name its own tab, and it can hold no focusable element at all (the
          range buttons need enough history), so it stays keyboard-reachable on its own. */}
      <div
        aria-labelledby={`${tabsId}-${productId}`}
        className="space-y-4"
        id={`${tabsId}-panel`}
        role="tabpanel"
        tabIndex={0}
      >
        {points.length < 2 ? (
          // One official calculation cannot show a trend, and inventing points to fill the chart
          // would be fabricating prices the ministry never published.
          <p className="text-sm text-muted-foreground">
            Poređenje kroz vrijeme još nije dostupno — potrebna su najmanje dva zvanična obračuna.
          </p>
        ) : (
          <>
            <dl className="grid gap-3 sm:grid-cols-3">
              <Statistic label="Posljednja cijena">
                {latest ? formatFuelPriceWithUnit(latest.priceCents, localeTag) : "—"}
              </Statistic>
              <Statistic label="Promjena">
                {latest?.change ? (
                  <ChangeValue change={latest.change} localeTag={localeTag} />
                ) : (
                  "—"
                )}
              </Statistic>
              <Statistic label="Raspon">
                {formatFuelRangeWithUnit(minimum, maximum, localeTag)}
              </Statistic>
            </dl>

            {offersRange ? (
              <div className="flex flex-wrap gap-1.5">
                <RangeButton onClick={() => setShowAll(false)} selected={!showAll}>
                  {`Posljednjih ${recentCalculationCount} promjena`}
                </RangeButton>
                <RangeButton onClick={() => setShowAll(true)} selected={showAll}>
                  Sve
                </RangeButton>
              </div>
            ) : null}

            <TrendChart
              localeTag={localeTag}
              points={points}
              productName={fuelProductNames[productId]}
            />
          </>
        )}
      </div>
    </div>
  );
}

function Statistic({ children, label }: { children: React.ReactNode; label: string }) {
  return (
    <div className="rounded-xl border border-border p-3">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 text-lg font-semibold tracking-tight">{children}</dd>
    </div>
  );
}

function ChangeValue({
  change,
  localeTag,
}: {
  change: NonNullable<ReturnType<typeof derivePreviousChange>>;
  localeTag: string;
}) {
  if (change.direction === "unchanged") return <span>bez promjene</span>;
  const sign = change.direction === "increase" ? "+" : "−";
  return <span>{`${sign}${formatFuelPrice(change.cents, localeTag)} €`}</span>;
}

function RangeButton({
  children,
  onClick,
  selected,
}: {
  children: React.ReactNode;
  onClick: () => void;
  selected: boolean;
}) {
  return (
    <button
      aria-pressed={selected}
      className={cn(
        "focus-visible:ring-ring min-h-9 rounded-lg border px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2",
        selected
          ? "border-amber-300 bg-amber-50 text-amber-900"
          : "border-border text-muted-foreground",
      )}
      onClick={onClick}
      type="button"
    >
      {children}
    </button>
  );
}

const chartWidth = 640;
const chartHeight = 200;
const padding = { bottom: 26, left: 46, right: 12, top: 14 };

function TrendChart({
  localeTag,
  points,
  productName,
}: {
  localeTag: string;
  points: readonly TrendPoint[];
  productName: string;
}) {
  const values = points.map((point) => point.priceCents);
  const rawMin = Math.min(...values);
  const rawMax = Math.max(...values);
  // A flat history would otherwise divide by zero; a tiny real spread is padded so the line is not
  // pinned to an edge, but the axis labels always state the actual min and max so a two-cent move
  // can never read as a dramatic swing.
  const span = Math.max(rawMax - rawMin, 4);
  const minimum = rawMin - (span - (rawMax - rawMin)) / 2;
  const plotWidth = chartWidth - padding.left - padding.right;
  const plotHeight = chartHeight - padding.top - padding.bottom;

  const coordinates = points.map((point, index) => ({
    ...point,
    x:
      padding.left +
      (points.length === 1 ? plotWidth / 2 : (index / (points.length - 1)) * plotWidth),
    y: padding.top + plotHeight - ((point.priceCents - minimum) / span) * plotHeight,
  }));
  const line = coordinates.map(({ x, y }) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");

  // Hover, focus and tap all select the same point, so no information is mouse-only.
  const [selected, setSelected] = useState<number | null>(null);
  const details =
    selected === null ? undefined : getTrendPointDetails(points, selected, productName);
  const selectedCoordinate = selected === null ? undefined : coordinates[selected];

  return (
    <figure className="space-y-2">
      <div className="relative">
        {/* A group rather than an image: role="img" makes descendants presentational in several
            screen readers, which would hide the focusable points the chart now relies on. */}
        <svg
          aria-label={`Kretanje cijene: ${productName}, ${points.length} zvaničnih obračuna, od ${formatFuelPrice(rawMin, localeTag)} do ${formatFuelPriceWithUnit(rawMax, localeTag)}`}
          className="h-auto w-full"
          role="group"
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        >
          <line
            className="stroke-border"
            x1={padding.left}
            x2={chartWidth - padding.right}
            y1={padding.top + plotHeight}
            y2={padding.top + plotHeight}
          />
          <text className="fill-muted-foreground text-[11px]" x="0" y={padding.top + 4}>
            {formatFuelPrice(rawMax, localeTag)}
          </text>
          <text className="fill-muted-foreground text-[11px]" x="0" y={padding.top + plotHeight}>
            {formatFuelPrice(rawMin, localeTag)}
          </text>
          <polyline
            className="fill-none stroke-amber-600"
            points={line}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
          />
          {/* Every official calculation stays individually visible — the line is only for reading.
              Each one carries a generous transparent hit area so a fingertip can reach it, and is
              focusable so the same detail is available without a mouse. */}
          {coordinates.map(({ effectiveDate, x, y }, index) => {
            const isSelected = index === selected;
            const pointDetails = getTrendPointDetails(points, index, productName);
            return (
              <g key={effectiveDate}>
                {isSelected ? (
                  <circle className="fill-amber-700/20" cx={x} cy={y} r={9} />
                ) : null}
                <circle className="fill-amber-700" cx={x} cy={y} r={isSelected ? 5 : 3.5} />
                <circle
                  aria-label={
                    pointDetails ? getTrendPointLabel(pointDetails, localeTag) : undefined
                  }
                  className="cursor-pointer fill-transparent focus:outline-none"
                  cx={x}
                  cy={y}
                  onBlur={() => setSelected(null)}
                  onClick={() => setSelected(index)}
                  onFocus={() => setSelected(index)}
                  onMouseEnter={() => setSelected(index)}
                  onMouseLeave={() => setSelected(null)}
                  r={16}
                  role="button"
                  tabIndex={0}
                />
              </g>
            );
          })}
          <text className="fill-muted-foreground text-[11px]" x={padding.left} y={chartHeight - 6}>
            {formatFuelDay(points[0].effectiveDate, localeTag)}
          </text>
          <text
            className="fill-muted-foreground text-[11px]"
            textAnchor="end"
            x={chartWidth - padding.right}
            y={chartHeight - 6}
          >
            {formatFuelDay(points[points.length - 1].effectiveDate, localeTag)}
          </text>
        </svg>
        {details && selectedCoordinate ? (
          <TrendTooltip
            details={details}
            localeTag={localeTag}
            xRatio={selectedCoordinate.x / chartWidth}
            yRatio={selectedCoordinate.y / chartHeight}
          />
        ) : null}
      </div>
      <figcaption className="text-xs text-muted-foreground">
        Svaka tačka je jedan zvanični obračun Ministarstva. Potpune vrijednosti su u tabeli ispod.
      </figcaption>
    </figure>
  );
}

// A small floating surface rather than an SVG overlay: it can use the ordinary card styling, and
// it can never be clipped by the chart's viewBox. Below the sm breakpoint it simply sits under the
// chart, which sidesteps edge clipping on the narrowest screens entirely.
function TrendTooltip({
  details,
  localeTag,
  xRatio,
  yRatio,
}: {
  details: TrendPointDetails;
  localeTag: string;
  xRatio: number;
  yRatio: number;
}) {
  // Anchor away from whichever edge the point is near, so the first and last points stay readable.
  const horizontal =
    xRatio < 0.25
      ? "sm:translate-x-0"
      : xRatio > 0.75
        ? "sm:-translate-x-full"
        : "sm:-translate-x-1/2";

  return (
    <div
      className={cn(
        "mt-3 w-max max-w-[15rem] rounded-xl border border-border bg-background p-3 shadow-md",
        "sm:pointer-events-none sm:absolute sm:z-10 sm:mt-0 sm:-translate-y-[calc(100%+0.75rem)]",
        horizontal,
      )}
      style={{ left: `${xRatio * 100}%`, top: `${yRatio * 100}%` }}
    >
      <p className="text-xs text-muted-foreground">
        {formatFuelDay(details.effectiveDate, localeTag)}
      </p>
      <p className="mt-0.5 text-sm font-medium">{details.productName}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">
        <span className="tabular-nums">{formatFuelPrice(details.priceCents, localeTag)}</span>{" "}
        <span className="text-base font-semibold">{fuelUnitLabel}</span>
      </p>
      {details.change ? (
        <>
          <p className="mt-2 text-xs text-muted-foreground">Promjena u odnosu na prethodni:</p>
          <p className={cn("text-sm font-semibold", tooltipChangeTone[details.change.direction])}>
            <TooltipChange change={details.change} localeTag={localeTag} />
          </p>
        </>
      ) : null}
    </div>
  );
}

function TooltipChange({
  change,
  localeTag,
}: {
  change: NonNullable<TrendPointDetails["change"]>;
  localeTag: string;
}) {
  if (change.direction === "unchanged") return <>Bez promjene</>;
  const sign = change.direction === "increase" ? "+" : "−";
  return <>{`${sign}${formatFuelPrice(change.cents, localeTag)} €`}</>;
}

// The same semantics the price cards use: a rise is red whatever the fuel's identity colour is.
const tooltipChangeTone: Record<FuelPriceChangeDirection, string> = {
  decrease: "text-emerald-700",
  increase: "text-red-700",
  unchanged: "text-slate-600",
};

export { FuelPriceTrend, type FuelPriceTrendProps };
