import type { SeaWaterQualityHistoryLocation } from "../domain/sea-water-quality.ts";

// JPMD's `plaza` names the wider beach a sampling point belongs to. It is worth showing whenever
// it is a different name from the sampling point's own, and suppressed only when it is effectively
// the same complete name — which happens when JPMD records an unnumbered location, e.g.
// "Kamenovo" / "KAMENOVO", where repeating it would just echo the page heading.
//
// The comparison is deliberately conservative: two values are the same only if they match after
// case, diacritic and whitespace normalization. Numeric point suffixes are NOT stripped — the
// suffix is exactly what distinguishes monitoring point "Jaz 01" from the broader beach "JAZ", so
// stripping it would suppress the useful context this line exists to provide. No fuzzy matching.
//
// The returned value is the verified source string. It is not re-cased: JPMD often supplies
// uppercase ("SLOVENSKA PLAZA"), and no repository helper safely restores Montenegrin
// presentation form (the only title-caser is private to the events domain and tuned for event
// titles, and no rule can recover the diacritics the source itself omitted).
function getDistinctBeachName(
  location: Pick<SeaWaterQualityHistoryLocation, "beachName" | "displayName">,
): string | undefined {
  const beachName = location.beachName?.trim();
  if (!beachName) return undefined;

  return normalizeForComparison(beachName) === normalizeForComparison(location.displayName)
    ? undefined
    : beachName;
}

function normalizeForComparison(value: string) {
  return value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("sr-Latn-ME")
    .replace(/\s+/g, " ")
    .trim();
}

export { getDistinctBeachName };
