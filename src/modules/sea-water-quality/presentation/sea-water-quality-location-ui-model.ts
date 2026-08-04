import type {
  SeaWaterQualityGrade,
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
  getSeaWaterQualityLocationSummary,
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
