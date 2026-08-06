import {
  derivePreviousChange,
  type FuelPriceCalculation,
  type FuelPriceChange,
  type FuelProductId,
} from "../domain/fuel-price";


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

export { getTrendPoints, type TrendPoint };
