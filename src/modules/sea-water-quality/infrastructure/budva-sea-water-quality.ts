import { z } from "zod";

import {
  createEmptySeaWaterQualityGradeCounts,
  type SeaWaterQualityGrade,
  type SeaWaterQualitySummary,
} from "../domain/sea-water-quality.ts";
import { morskodobroOrigin } from "./morskodobro-http-client.ts";

// Municipality id used by the official Morsko dobro monitoring API's "opstina" filter — confirmed
// by reading the populated <select id="opstina"> options on the public monitoring page. This is a
// small, fixed government-administrative list, not something derived from user input.
const budvaMunicipalityId = 2;

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
          opstina: z.string(),
          tezina: z.number(),
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

function buildMapDataRequestBody({ round, year }: { round: number; year: number }) {
  return new URLSearchParams({
    godina: String(year),
    opstina: String(budvaMunicipalityId),
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

interface BudvaSeaWaterQualityParseResult {
  summary: SeaWaterQualitySummary;
  warnings: string[];
}

function parseBudvaSeaWaterQualitySummary(body: string): BudvaSeaWaterQualityParseResult | undefined {
  const parsed = safeJsonParse(body);
  if (parsed === undefined) return undefined;

  const result = mapResponseSchema.safeParse(parsed);
  if (!result.success) return undefined;

  const gradeCounts = createEmptySeaWaterQualityGradeCounts();
  const warnings = new Set<string>();
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

  const latestSamplingDate = result.data.mjerenja
    .map((measurement) => toIsoDate(measurement.datumUzorkovanja))
    .filter((value): value is string => value !== undefined)
    .sort()
    .at(-1);

  return {
    summary: {
      gradeCounts,
      ...(latestSamplingDate ? { latestSamplingDate } : {}),
      municipality: "budva",
      totalLocations: result.data.ukupno,
    },
    warnings: [...warnings],
  };
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
  type BudvaSeaWaterQualityParseResult,
};
