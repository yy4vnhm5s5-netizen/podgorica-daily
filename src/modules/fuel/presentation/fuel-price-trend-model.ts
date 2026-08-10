import { changeWords } from "./fuel-card-label.ts";
import { formatFuelDay } from "./fuel-day-label.ts";
import { formatFuelPriceWithUnit } from "./fuel-price-unit.ts";
import {
  derivePreviousChange,
  formatFuelPrice,
  type FuelPriceCalculation,
  type FuelPriceChange,
  type FuelProductId,
} from "../domain/fuel-price.ts";

interface TrendPoint {
  change?: FuelPriceChange;
  effectiveDate: string;
  priceCents: number;
}

// Pure, and deliberately in its own .ts file: the repo's test runner strips types but cannot parse
// JSX, so chart logic that deserves real assertions has to live outside the component.
//
// One point per official calculation, oldest first, keyed on the date the prices took effect.
// Nothing is interpolated between calculations — the ministry publishes discrete decisions, not a
// daily series, and inventing points between them would be inventing prices.
function getTrendPoints(
  calculations: readonly FuelPriceCalculation[],
  productId: FuelProductId,
): TrendPoint[] {
  return [...calculations]
    .sort((left, right) => left.effectiveDate.localeCompare(right.effectiveDate))
    .flatMap((calculation, index, sorted) => {
      const price = calculation.prices.find((entry) => entry.productId === productId);
      if (!price) return [];
      const change = derivePreviousChange(calculation, sorted[index - 1], productId);
      return [
        {
          ...(change ? { change } : {}),
          effectiveDate: calculation.effectiveDate,
          priceCents: price.priceCents,
        },
      ];
    });
}

// What one chart point states when it is selected. The comparison is deliberately against the
// previous *displayed* point: the visible series is a contiguous slice of the official history, so
// its neighbour is the chronologically previous calculation — and the oldest visible point has no
// predecessor on screen, so it claims no comparison at all rather than inventing one.
interface TrendPointDetails {
  change?: FuelPriceChange;
  effectiveDate: string;
  priceCents: number;
  productName: string;
}

function getTrendPointDetails(
  points: readonly TrendPoint[],
  index: number,
  productName: string,
): TrendPointDetails | undefined {
  const point = points[index];
  if (!point) return undefined;

  // point.change was derived against the immediately preceding calculation and prefers the
  // ministry's own Promjena value, so it is exactly the comparison to the previous point — but
  // only when that calculation is itself on screen.
  const hasPreviousOnScreen = index > 0;
  return {
    ...(hasPreviousOnScreen && point.change ? { change: point.change } : {}),
    effectiveDate: point.effectiveDate,
    priceCents: point.priceCents,
    productName,
  };
}

// The accessible name of a point: everything the tooltip shows, in words, so a screen reader never
// has to infer a value from where a dot sits in an SVG.
function getTrendPointLabel(details: TrendPointDetails, localeTag: string) {
  const base = [
    formatFuelDay(details.effectiveDate, localeTag),
    details.productName,
    formatFuelPriceWithUnit(details.priceCents, localeTag),
  ].join(", ");
  if (!details.change) return base;
  if (details.change.direction === "unchanged") return `${base}, ${changeWords.unchanged}`;

  const amount = formatFuelPrice(details.change.cents, localeTag);
  const move = `${changeWords[details.change.direction]} ${amount} eura`;
  return `${base}, ${move}`;
}

export {
  getTrendPointDetails,
  getTrendPointLabel,
  getTrendPoints,
  type TrendPoint,
  type TrendPointDetails,
};
