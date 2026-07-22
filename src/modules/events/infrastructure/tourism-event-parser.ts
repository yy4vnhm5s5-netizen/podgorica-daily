import { toZonedIso } from "../domain/event-time.ts";
import type { EventCandidate } from "../domain/event.ts";
import {
  extractEventContentText,
  extractEventHeading,
  toEventPlainText,
} from "./event-html-content.ts";

const tourismCalendarUrl = "https://podgorica.travel/dogadjaji-kalendar/";

function discoverTourismEventUrls(html: string) {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .flatMap((match) => {
      try {
        return [new URL(match[1], tourismCalendarUrl)];
      } catch {
        return [];
      }
    })
    .filter(
      (url) =>
        url.protocol === "https:" &&
        url.hostname === "podgorica.travel" &&
        url.pathname.startsWith("/calendar-event/"),
    )
    .map(String)
    .filter((url, index, all) => all.indexOf(url) === index);
}

function parseTourismEventArticle(html: string, sourceUrl: string) {
  const content = extractEventContentText(html);
  const details = extractTourismEventDetails(html);
  const text = [content, details].filter(Boolean).join(" ");
  const title = extractEventHeading(html) ?? "";
  const numericDate = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)?.slice(1);
  const namedDate = text.match(
    /\b(\d{1,2})\.\s*(januar(?:a)?|februar(?:a)?|mart(?:a)?|april(?:a)?|maj(?:a)?|jun(?:a)?|jul(?:a)?|avgust(?:a)?|septembar(?:a)?|oktobar(?:a)?|novembar(?:a)?|decembar(?:a)?)\s*(20\d{2})\b/i,
  );
  const time = text.match(
    /(\d{1,2}):(\d{2})\s*(?:h|sati)?\s*(?:–|-|do)\s*(\d{1,2}):(\d{2})\s*(?:h|sati)?/i,
  );
  const startDate = numericDate
    ? `${numericDate[2]}-${numericDate[1].padStart(2, "0")}-${numericDate[0].padStart(2, "0")}`
    : namedDate
      ? toIsoDate(namedDate[1], namedDate[2], namedDate[3])
      : undefined;
  const startsAt =
    startDate && time
      ? toZonedIso({ date: startDate, time: `${time[1]}:${time[2]}` }, "Europe/Podgorica")
      : undefined;
  const endsAt =
    startDate && time
      ? toZonedIso({ date: startDate, time: `${time[3]}:${time[4]}` }, "Europe/Podgorica")
      : undefined;
  const candidate: EventCandidate = {
    categoryHint: /izložb/i.test(text)
      ? "exhibition"
      : /koncert|muzik/i.test(text)
        ? "concert"
        : /radionic/i.test(text)
          ? "workshop"
          : undefined,
    endsAt,
    explicitStatus: /otkazan/i.test(text)
      ? "cancelled"
      : /odgođen/i.test(text)
        ? "postponed"
        : undefined,
    imageUrl: html.match(/(?:src|content)=["']([^"']+\.(?:jpg|jpeg|png|webp)[^"']*)/i)?.[1],
    language: "me",
    organizer: text.match(/Organizator:\s*([^.|]+)/i)?.[1]?.trim(),
    parserWarnings: [
      ...(startDate ? [] : ["Tourism event date was unavailable."]),
      ...(startDate && !time ? ["Tourism event time was unavailable."] : []),
    ],
    rawDateText: numericDate?.join(".") ?? namedDate?.[0],
    rawDescription: content || undefined,
    rawTitle: title,
    rawTimeText: time?.[0],
    rawVenue: text.match(/Lokacija:\s*([^.|]+)/i)?.[1]?.trim(),
    source: {
      sourceId: "tourism-podgorica",
      sourceName: "Turistička organizacija Podgorice",
      sourceUrl,
    },
    startDate: startsAt ? undefined : startDate,
    startsAt,
    timezone: "Europe/Podgorica",
  };
  return { candidate };
}

function extractTourismEventDetails(html: string) {
  const details = /<aside\b(?=[^>]*\bpe-single-sidebar\b)[^>]*>([\s\S]*?)<\/aside>/i.exec(
    html,
  )?.[1];
  return details ? toEventPlainText(details) : "";
}

const tourismMonths: Record<string, number> = {
  april: 4,
  aprila: 4,
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

function toIsoDate(day: string, monthName: string, year: string) {
  const month = tourismMonths[monthName.toLocaleLowerCase("me-ME")];
  const date = new Date(Date.UTC(Number(year), (month ?? 0) - 1, Number(day)));
  return month &&
    date.getUTCFullYear() === Number(year) &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === Number(day)
    ? date.toISOString().slice(0, 10)
    : undefined;
}

export { discoverTourismEventUrls, parseTourismEventArticle, tourismCalendarUrl };
