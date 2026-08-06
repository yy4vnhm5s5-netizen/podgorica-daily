import {
  formatFuelPrice,
  fuelProductNames,
  type FuelPriceChange,
  type FuelPriceChangeDirection,
  type FuelProductId,
} from "../domain/fuel-price";

// Spoken form of the move. The card shows the direction as an arrow and an accent colour, neither
// of which a screen reader conveys, so the accessible name says it in words instead.
const changeWords: Record<FuelPriceChangeDirection, string> = {
  decrease: "smanjenje",
  increase: "povećanje",
  unchanged: "bez promjene",
};

// Pure and in its own .ts file so it can actually be unit-tested: the test runner strips types but
// cannot parse JSX, so nothing importable from the card component itself is testable.
function getFuelCardLabel(
  productId: FuelProductId,
  priceCents: number,
  localeTag: string,
  change?: FuelPriceChange,
) {
  const base = `${fuelProductNames[productId]}, cijena ${formatFuelPrice(priceCents, localeTag)} eura po litru`;
  if (!change) return base;

  // "promjena bez promjene" would be clumsy, so the unchanged case drops the prefix.
  if (change.direction === "unchanged") return `${base}, ${changeWords.unchanged}`;
  const move = `${changeWords[change.direction]} ${formatFuelPrice(change.cents, localeTag)} eura`;
  return `${base}, promjena ${move}`;
}

export { changeWords, getFuelCardLabel };
