import { z } from "zod";

import {
  createEmptySeaWaterQualityGradeCounts,
  type SeaWaterQualityGrade,
  type SeaWaterQualityLocation,
  type SeaWaterQualityMunicipality,
  type SeaWaterQualitySummary,
} from "../domain/sea-water-quality.ts";
import { morskodobroOrigin } from "./morskodobro-http-client.ts";
import {
  getSeaWaterQualityMunicipality,
  seaWaterQualityMunicipalities,
} from "./sea-water-quality-cities.ts";

// Kept for backward compatibility with existing callers/tests; sourced from the shared
// multi-city config in sea-water-quality-cities.ts so the confirmed id (2) is defined once.
const budvaMunicipalityId = seaWaterQualityMunicipalities.budva.municipalityId;

const morskodobroCalendarDataUrl = `${morskodobroOrigin}/javna/getCalendarData`;
const morskodobroMapDataUrl = `${morskodobroOrigin}/javna/crtajMapu`;

// tezina (1-4) is the API's own severity/grade code; the mapping below was confirmed directly
// against paired "ocjena"/"tezina" values in live responses (tezina 1 = "Odlična", ... 4 = "Loša").
const gradeByTezina: Record<number, SeaWaterQualityGrade> = {
  1: "excellent",
  2: "good",
  3: "satisfactory",
  4: "poor",
};

const calendarResponseSchema = z
  .object({
    data: z.array(z.object({ id: z.number() })),
    odabraniKalendar: z.number().optional(),
  })
  .passthrough();

const mapResponseSchema = z
  .object({
    mjerenja: z.array(
      z
        .object({
          datumUzorkovanja: z.string(),
          id: z.number(),
          kalendar: z.number().optional(),
          naziv: z.string(),
          opstina: z.string(),
          plaza: z.string().nullable().optional(),
          tezina: z.number(),
          vrijemeUzorkovanja: z.string().optional(),
        })
        .passthrough(),
    ),
    sumarno: z.array(z.tuple([z.number(), z.number()])),
    ukupno: z.number(),
  })
  .passthrough();

function buildCalendarDataRequestBody() {
  return new URLSearchParams();
}

function buildMapDataRequestBody({
  municipalityId,
  round,
  year,
}: {
  municipalityId: number;
  round: number;
  year: number;
}) {
  return new URLSearchParams({
    godina: String(year),
    opstina: String(municipalityId),
    q: "",
    rb: String(round),
  });
}

// The API has no dedicated "current round" endpoint; the calendar-data response is the site's own
// signal for which sampling round is currently selected/active (falls back to the newest round id
// in the list if the field is ever missing).
function parseCurrentRoundId(body: string): number | undefined {
  const parsed = safeJsonParse(body);
  if (parsed === undefined) return undefined;

  const result = calendarResponseSchema.safeParse(parsed);
  if (!result.success) return undefined;

  if (typeof result.data.odabraniKalendar === "number") return result.data.odabraniKalendar;
  return result.data.data.map((entry) => entry.id).sort((left, right) => right - left)[0];
}

// The same calendar payload, read for backfill instead of for "which round is current". Alongside
// the real sampling rounds the response carries a negative pseudo-entry (observed: id -2026,
// tekst "za sezonu") that aggregates the whole season rather than identifying a fetchable round —
// only positive ids are real rounds, so a backfill must never treat that entry as one. There is no
// explicit "completed" flag anywhere in the payload; `selectedRound` (odabraniKalendar) is the
// site's own newest-usable-round signal and is the safest available upper bound.
function parseSeaWaterQualityCalendar(
  body: string,
): { rounds: number[]; selectedRound?: number } | undefined {
  const parsed = safeJsonParse(body);
  if (parsed === undefined) return undefined;

  const result = calendarResponseSchema.safeParse(parsed);
  if (!result.success) return undefined;

  const rounds = [...new Set(result.data.data.map((entry) => entry.id))]
    .filter((id) => Number.isInteger(id) && id > 0)
    .sort((left, right) => left - right);
  const selectedRound = result.data.odabraniKalendar;

  return {
    rounds,
    ...(typeof selectedRound === "number" && Number.isInteger(selectedRound) && selectedRound > 0
      ? { selectedRound }
      : {}),
  };
}

interface BudvaSeaWaterQualityParseResult {
  sourceRound?: number;
  summary: SeaWaterQualitySummary;
  warnings: string[];
}

function parseBudvaSeaWaterQualitySummary(
  body: string,
  municipality: SeaWaterQualityMunicipality = "budva",
): BudvaSeaWaterQualityParseResult | undefined {
  const parsed = safeJsonParse(body);
  if (parsed === undefined) return undefined;

  const result = mapResponseSchema.safeParse(parsed);
  if (!result.success) return undefined;

  const sourceMunicipality = getSeaWaterQualityMunicipality(municipality);
  if (!sourceMunicipality) return undefined;
  const containsOtherMunicipalities = result.data.mjerenja.some(
    (measurement) => measurement.opstina !== sourceMunicipality.sourceMunicipalityName,
  );
  const measurements = containsOtherMunicipalities
    ? result.data.mjerenja.filter(
        (measurement) => measurement.opstina === sourceMunicipality.sourceMunicipalityName,
      )
    : result.data.mjerenja;
  const gradeCounts = createEmptySeaWaterQualityGradeCounts();
  const warnings = new Set<string>();
  if (containsOtherMunicipalities) {
    for (const measurement of measurements) {
      const grade = gradeByTezina[measurement.tezina];
      if (grade) gradeCounts[grade] += 1;
      else warnings.add(`sea-water-quality-unknown-tezina:${measurement.tezina}`);
    }
  } else {
    for (const [tezina, count] of result.data.sumarno) {
      const grade = gradeByTezina[tezina];
      if (grade) {
        gradeCounts[grade] += count;
      } else {
        // The provider's severity codes are a fixed 1-4 scale today. Surfacing an unrecognized
        // code as a warning (rather than silently dropping it) means totalLocations diverging
        // from the sum of the displayed grade counts gets noticed immediately instead of quietly
        // producing a summary that no longer adds up.
        warnings.add(`sea-water-quality-unknown-tezina:${tezina}`);
      }
    }
  }

  const latestSamplingDate = measurements
    .map((measurement) => toIsoDate(measurement.datumUzorkovanja))
    .filter((value): value is string => value !== undefined)
    .sort()
    .at(-1);

  const locations: SeaWaterQualityLocation[] = [];
  for (const measurement of measurements) {
    const grade = gradeByTezina[measurement.tezina];
    if (!grade) continue; // Already recorded as a warning above.

    const samplingDate = toIsoDate(measurement.datumUzorkovanja);
    locations.push({
      grade,
      id: measurement.id,
      name: measurement.naziv,
      ...(measurement.plaza ? { beachName: measurement.plaza } : {}),
      ...(measurement.vrijemeUzorkovanja
        ? { samplingDateTime: measurement.vrijemeUzorkovanja }
        : {}),
      ...(samplingDate ? { samplingDate } : {}),
    });
  }

  return {
    sourceRound: getSingleRound(measurements),
    summary: {
      gradeCounts,
      ...(latestSamplingDate ? { latestSamplingDate } : {}),
      locations,
      municipality,
      totalLocations: containsOtherMunicipalities ? measurements.length : result.data.ukupno,
    },
    warnings: [...warnings],
  };
}

function getSingleRound(measurements: readonly { kalendar?: number }[]): number | undefined {
  const rounds = new Set(
    measurements
      .map((measurement) => measurement.kalendar)
      .filter((value): value is number => typeof value === "number"),
  );
  return rounds.size === 1 ? [...rounds][0] : undefined;
}

// Source dates look like "21.07.2026" (day.month.year, no leading zeros guaranteed).
function toIsoDate(value: string): string | undefined {
  const match = value.trim().match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})\.?$/);
  if (!match) return undefined;
  const [, day, month, year] = match;
  return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
}

function safeJsonParse(value: string): unknown {
  try {
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

export {
  budvaMunicipalityId,
  buildCalendarDataRequestBody,
  buildMapDataRequestBody,
  morskodobroCalendarDataUrl,
  morskodobroMapDataUrl,
  parseBudvaSeaWaterQualitySummary,
  parseCurrentRoundId,
  parseSeaWaterQualityCalendar,
  type BudvaSeaWaterQualityParseResult,
};
