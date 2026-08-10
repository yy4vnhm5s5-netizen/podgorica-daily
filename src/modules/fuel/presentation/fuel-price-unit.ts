import { formatFuelPrice } from "../domain/fuel-price.ts";

// One spelling of the per-litre unit for the whole page: the cards, the chart statistics, the
// chart's accessible description and the point tooltip. Spaced around the slash and an uppercase
// litre, so it reads as a unit beside a large number rather than crowding it.
const fuelUnitLabel = "€ / L";

// For accessible names and any other place the price and its unit have to be one string. The
// number itself is untouched — this only appends the unit to the existing formatting.
function formatFuelPriceWithUnit(priceCents: number, localeTag: string) {
  return `${formatFuelPrice(priceCents, localeTag)} ${fuelUnitLabel}`;
}

// An en dash between the bounds, and the unit stated once at the end.
function formatFuelRangeWithUnit(
  minimumCents: number,
  maximumCents: number,
  localeTag: string,
): string {
  const minimum = formatFuelPrice(minimumCents, localeTag);
  const maximum = formatFuelPrice(maximumCents, localeTag);
  return `${minimum} – ${maximum} ${fuelUnitLabel}`;
}

export { formatFuelPriceWithUnit, formatFuelRangeWithUnit, fuelUnitLabel };
