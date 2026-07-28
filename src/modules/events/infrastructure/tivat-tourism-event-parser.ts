import { toZonedIso } from "../domain/event-time.ts";
import type { EventCandidate } from "../domain/event.ts";

const tivatTourismCalendarUrl = "https://tivat.travel/dogadjaji/";
// Verified against the live listing (2026-07-28): unlike podgorica.travel's calendar (which only
// links to individual events, requiring a detail-page fetch for every field), tivat.travel's
// listing grid already renders each event's title, image, and date/time inline as
// `<a href="…/dogadjaji/<slug>/"><img data-src="…" alt="…"><div class="content"><h4>…</h4>
// <span>…</span></div></a>`. Parsing the listing page(s) directly — instead of mirroring
// Podgorica's discover-then-fetch-each-detail-page shape — is not a redesign of the parsing
// approach, it's the same "extract candidates from official markup" technique applied to what
// this source actually provides, with far fewer requests and fewer failure points.
const maximumPageCount = 10;

interface TivatTourismEventCard {
  detailUrl: string;
  imageUrl?: string;
  rawDateText: string;
  rawTitle: string;
}

function getTivatTourismPageUrl(pageNumber: number) {
  return pageNumber <= 1
    ? tivatTourismCalendarUrl
    : `${tivatTourismCalendarUrl}page/${pageNumber}/`;
}

// The listing page's own pagination links are the source of truth for how many pages exist
// today; capped defensively so a future redesign of the site can never make the collector fetch
// an unbounded number of pages.
function extractTivatTourismPageCount(html: string) {
  const numbers = [...html.matchAll(/\/dogadjaji\/page\/(\d+)\/?/g)]
    .map((match) => Number(match[1]))
    .filter((value) => Number.isInteger(value) && value > 0);
  return Math.min(numbers.length ? Math.max(...numbers) : 1, maximumPageCount);
}

const eventCardPattern =
  /<a href="(https:\/\/tivat\.travel\/dogadjaji\/[^"?#]+\/)">\s*<img\s+data-src="([^"]*)"\s*alt="([^"]*)"[^>]*>\s*<div class="content">\s*<h4>([^<]*)<\/h4>\s*<span>\s*([^<]*?)\s*<\/span>/g;

function extractTivatTourismEventCards(html: string): TivatTourismEventCard[] {
  return [...html.matchAll(eventCardPattern)]
    .map((match) => ({
      detailUrl: match[1],
      imageUrl: isHttpUrl(match[2]) ? match[2] : undefined,
      rawDateText: decodeBasicEntities(match[5]).trim(),
      rawTitle: decodeBasicEntities(match[4] || match[3]).trim(),
    }))
    .filter((card) => card.detailUrl.startsWith(tivatTourismCalendarUrl))
    .filter((card, index, all) => all.findIndex((other) => other.detailUrl === card.detailUrl) === index);
}

function isHttpUrl(value: string) {
  try {
    return ["http:", "https:"].includes(new URL(value).protocol);
  } catch {
    return false;
  }
}

function decodeBasicEntities(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&#8211;|&ndash;/g, "–")
    .replace(/&#8217;|&rsquo;/g, "’");
}

const tivatTourismMonths: Record<string, number> = {
  april: 4,
  aprila: 4,
  august: 8,
  augusta: 8,
  avgust: 8,
  avgusta: 8,
  decembar: 12,
  decembra: 12,
  februar: 2,
  februara: 2,
  januar: 1,
  januara: 1,
  jul: 7,
  jula: 7,
  jun: 6,
  juna: 6,
  maj: 5,
  maja: 5,
  mart: 3,
  marta: 3,
  novembar: 11,
  novembra: 11,
  oktobar: 10,
  oktobra: 10,
  septembar: 9,
  septembra: 9,
};

// Verified format from the live listing (2026-07-28): "25 Jula, 2026 Subota 21:00h" — day,
// genitive month name, comma, year, day-of-week name (unused, present only for a human reader),
// then a 24h time. Both "Jula" and "Augusta" spellings are directly attested on the live site
// (the latter differs from the "avgusta" form used elsewhere on the same site, e.g. in detail-page
// descriptions), so both are accepted here.
const dateTextPattern =
  /^(\d{1,2})\s+([\p{L}]+),?\s+(\d{4})\s+[\p{L}]+\s+(\d{1,2}):(\d{2})h?$/u;

function parseTivatTourismDateText(value: string): { date?: string; time?: string } {
  const match = dateTextPattern.exec(value.replace(/\s+/g, " ").trim());
  if (!match) return {};

  const [, day, monthName, year, hour, minute] = match;
  const month = tivatTourismMonths[monthName.toLocaleLowerCase("me-ME")];
  if (!month) return {};

  const date = toIsoDateIfValid(Number(year), month, Number(day));
  if (!date) return {};

  // A "00:00h" time is not attested to mean a genuine midnight start anywhere on the live site —
  // it is common (observed on several listing cards for multi-day festivals and similar), which
  // is the same pattern the rest of this codebase treats as "no time given" rather than inventing
  // a literal midnight start (see AGENTS.md's "retain date-only events without an invented time").
  const isTimeGiven = !(hour === "00" && minute === "00");
  return { date, time: isTimeGiven ? `${hour.padStart(2, "0")}:${minute}` : undefined };
}

function toIsoDateIfValid(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date.toISOString().slice(0, 10)
    : undefined;
}

function toTivatTourismEventCandidate(card: TivatTourismEventCard): EventCandidate {
  const { date, time } = parseTivatTourismDateText(card.rawDateText);
  const startsAt = date && time ? toZonedIso({ date, time }, "Europe/Podgorica") : undefined;

  return {
    imageUrl: card.imageUrl,
    language: "me",
    parserWarnings: date ? [] : ["Tivat Tourism event date was unavailable."],
    rawDateText: card.rawDateText,
    rawTitle: card.rawTitle,
    source: {
      sourceId: "tourism-tivat",
      sourceName: "Turistička organizacija Tivat",
      sourceUrl: card.detailUrl,
    },
    startDate: startsAt ? undefined : date,
    startsAt,
    timezone: "Europe/Podgorica",
  };
}

function parseTivatTourismEventCards(html: string): { candidates: EventCandidate[] } {
  return { candidates: extractTivatTourismEventCards(html).map(toTivatTourismEventCandidate) };
}

export {
  extractTivatTourismPageCount,
  getTivatTourismPageUrl,
  parseTivatTourismEventCards,
  tivatTourismCalendarUrl,
};
