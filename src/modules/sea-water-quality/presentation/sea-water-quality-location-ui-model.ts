import type {
  SeaWaterQualityGrade,
  SeaWaterQualityHistory,
  SeaWaterQualityHistoryLocation,
  SeaWaterQualityHistoryMeasurement,
} from "../domain/sea-water-quality.ts";
import { gradeOrder } from "./sea-water-quality-grade-styles.ts";

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

export {
  getDistinctBeachName,
  getRelatedSeaWaterQualityLocations,
  getSeaWaterQualityLocationSummary,
  type RelatedSeaWaterQualityLocation,
  type SeaWaterQualityGradeTally,
  type SeaWaterQualityLocationSummary,
  type SeaWaterQualityTrend,
};

type SeaWaterQualityTrend = "improved" | "unchanged" | "worsened";

interface SeaWaterQualityGradeTally {
  count: number;
  grade: SeaWaterQualityGrade;
}

interface SeaWaterQualityLocationSummary {
  /** Observed grades with their counts, ordered best-to-worst by JPMD's own severity scale. */
  breakdown: readonly SeaWaterQualityGradeTally[];
  /** Absent when fewer than two measurements exist — no comparison is claimed from one reading. */
  comparison?: { previous: SeaWaterQualityHistoryMeasurement; trend: SeaWaterQualityTrend };
  latest: SeaWaterQualityHistoryMeasurement;
  measurementCount: number;
  /** True when every retained measurement carries the same grade. */
  uniformGrade: boolean;
}

// Aggregate facts about one monitoring point, derived only from the measurements JPMD published
// for it. Nothing here describes the beach itself — no amenities, geography, cleanliness or
// suitability claims — and no value is introduced that is not already in the retained history.
//
// Returns undefined when there is nothing to summarise, so the page omits the block entirely
// rather than rendering filler.
function getSeaWaterQualityLocationSummary(
  location: Pick<SeaWaterQualityHistoryLocation, "measurements">,
): SeaWaterQualityLocationSummary | undefined {
  // The cache writes measurements in ascending round order, but this re-sorts rather than relying
  // on it: a summary that silently reverses "improved" and "worsened" would be worse than none.
  const measurements = [...location.measurements].sort(
    (left, right) => left.sourceRound - right.sourceRound,
  );
  const latest = measurements.at(-1);
  if (!latest) return undefined;

  const previous = measurements.at(-2);
  const counts = new Map<SeaWaterQualityGrade, number>();
  for (const { grade } of measurements) counts.set(grade, (counts.get(grade) ?? 0) + 1);

  return {
    breakdown: gradeOrder.flatMap((grade) => {
      const count = counts.get(grade);
      return count ? [{ count, grade }] : [];
    }),
    ...(previous
      ? { comparison: { previous, trend: getTrend(latest.grade, previous.grade) } }
      : {}),
    latest,
    measurementCount: measurements.length,
    uniformGrade: counts.size === 1,
  };
}

// JPMD publishes an explicit severity code per measurement (`tezina` 1–4, verified against paired
// "ocjena" values in live responses), and `gradeOrder` is that scale in order. "Better" and
// "worse" here mean exactly a move along JPMD's own scale — not a judgement about the water.
function getTrend(
  latest: SeaWaterQualityGrade,
  previous: SeaWaterQualityGrade,
): SeaWaterQualityTrend {
  const difference = gradeOrder.indexOf(latest) - gradeOrder.indexOf(previous);
  if (difference === 0) return "unchanged";
  return difference < 0 ? "improved" : "worsened";
}

interface RelatedSeaWaterQualityLocation {
  canonicalSlug: string;
  displayName: string;
}

// JPMD samples a long beach at several numbered points and tags each with the same `plaza` value,
// so that field — and only that field — is the grouping key. Matching is an exact comparison of
// two normalized beachName values using the same conservative rule getDistinctBeachName already
// applies (case, diacritics, collapsed whitespace). Nothing is inferred from slugs, from numeric
// suffixes in displayName, or from names that merely look similar: "Sv. Stefan plaža 01" belongs
// to "SVETOSTEFANSKA PLAZA", which no slug-prefix rule would ever discover.
//
// The caller passes the city's own history, so a group can never span cities.
function getRelatedSeaWaterQualityLocations(
  history: Pick<SeaWaterQualityHistory, "locations">,
  current: Pick<SeaWaterQualityHistoryLocation, "beachName" | "canonicalSlug">,
): readonly RelatedSeaWaterQualityLocation[] {
  const beachName = current.beachName?.trim();
  if (!beachName) return [];

  const key = normalizeForComparison(beachName);
  // History order is preserved rather than re-sorted: the cache already stores locations sorted by
  // displayName with Montenegrin collation, which puts "Slovenska plaža 01…06" in reading order.
  return history.locations
    .filter(
      (location) =>
        location.canonicalSlug !== current.canonicalSlug &&
        normalizeForComparison(location.beachName?.trim() ?? "") === key,
    )
    .map(({ canonicalSlug, displayName }) => ({ canonicalSlug, displayName }));
}
