// National, not city-scoped: fuel prices are set for all of Montenegro by one ministry decision,
// so nothing here carries a cityId and no city capability gates it.
type FuelProductId = "eurodiesel" | "eurosuper95" | "eurosuper98" | "heatingOil";

// The four products the official publications carry. Order is the display order.
const fuelProductIds: readonly FuelProductId[] = [
  "eurosuper95",
  "eurosuper98",
  "eurodiesel",
  "heatingOil",
];

// Official Montenegrin names exactly as the ministry writes them, kept for presentation so the
// page never invents its own product vocabulary.
const fuelProductNames: Record<FuelProductId, string> = {
  eurodiesel: "Eurodizel",
  eurosuper95: "Eurosuper 95",
  eurosuper98: "Eurosuper 98",
  heatingOil: "Lož ulje",
};

type FuelPriceChangeDirection = "decrease" | "increase" | "unchanged";

interface FuelPriceChange {
  direction: FuelPriceChangeDirection;
  // Absolute size of the move, in cents. Zero when the source said "bez promjene".
  cents: number;
  // "official" is the ministry's own Promjena column; "derived" is a difference this app computed
  // between two adjacent official calculations, used only when the column was absent.
  source: "derived" | "official";
}

interface FuelProductPrice {
  change?: FuelPriceChange;
  // Integer cents. Prices are published to two decimals, so cents avoid the floating-point
  // rounding that would otherwise show "1,7500000000000002 €" on a page about exact prices.
  priceCents: number;
  productId: FuelProductId;
}

interface FuelPriceCalculation {
  // The day the prices start applying, from the official validity wording. Never the publication
  // day: the ministry publishes the evening before, so conflating them shifts every price by a day.
  effectiveDate: string;
  nextCalculationDate?: string;
  prices: FuelProductPrice[];
  // When the article itself was published, from its own "Objavljeno:" timestamp.
  publishedAt: string;
  sourceName: string;
  sourceUrl: string;
}

function formatFuelPrice(priceCents: number, locale = "sr-Latn-ME") {
  return new Intl.NumberFormat(locale, {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  }).format(priceCents / 100);
}

function isCompleteFuelPriceCalculation(calculation: FuelPriceCalculation) {
  const present = new Set(calculation.prices.map(({ productId }) => productId));
  return fuelProductIds.every((productId) => present.has(productId));
}

// Newest first, by the day the prices apply. A calculation is identified by its effective date:
// the ministry publishes exactly one calculation per effective date, and re-running the collector
// on an unchanged article must not add a second row.
function sortFuelCalculations(calculations: readonly FuelPriceCalculation[]) {
  return [...calculations].sort((left, right) =>
    right.effectiveDate.localeCompare(left.effectiveDate),
  );
}

// Accumulated official history is never truncated: each refresh sees only the last few articles the
// ministry still lists, so dropping older calculations would permanently lose history that cannot be
// re-fetched later. How much of it a page shows is a presentation decision, made in presentation.
function mergeFuelCalculations(
  existing: readonly FuelPriceCalculation[],
  incoming: readonly FuelPriceCalculation[],
) {
  // A re-parsed calculation replaces the stored one for the same effective date.
  const byEffectiveDate = new Map(
    [...existing, ...incoming].map((calculation) => [calculation.effectiveDate, calculation]),
  );
  return sortFuelCalculations([...byEffectiveDate.values()]);
}

// Only ever the immediately preceding official calculation — comparing against an arbitrary older
// article would describe a move that never happened.
function derivePreviousChange(
  calculation: FuelPriceCalculation,
  previous: FuelPriceCalculation | undefined,
  productId: FuelProductId,
): FuelPriceChange | undefined {
  const current = calculation.prices.find((price) => price.productId === productId);
  if (!current) return undefined;
  if (current.change) return current.change;
  if (!previous) return undefined;

  const before = previous.prices.find((price) => price.productId === productId);
  if (!before) return undefined;

  const difference = current.priceCents - before.priceCents;
  return {
    cents: Math.abs(difference),
    direction: difference > 0 ? "increase" : difference < 0 ? "decrease" : "unchanged",
    source: "derived",
  };
}

export {
  derivePreviousChange,
  formatFuelPrice,
  fuelProductIds,
  fuelProductNames,
  isCompleteFuelPriceCalculation,
  mergeFuelCalculations,
  sortFuelCalculations,
  type FuelPriceCalculation,
  type FuelPriceChange,
  type FuelPriceChangeDirection,
  type FuelProductId,
  type FuelProductPrice,
};
