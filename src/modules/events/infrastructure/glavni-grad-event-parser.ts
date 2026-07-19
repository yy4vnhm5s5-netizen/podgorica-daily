import { toZonedIso } from "../domain/event-time.ts";
import type { EventCandidate, Venue } from "../domain/event.ts";

const glavniGradEventsUrl = "https://podgorica.me/category/aktuelni-dogadjaji/";
const glavniGradVenue: Venue = {
  cityId: "podgorica",
  id: "glavni-grad-podgorica",
  name: "Glavni grad Podgorica",
  sourceUrl: "https://podgorica.me/",
};

function discoverGlavniGradEventUrls(html: string) {
  const articleBlocks = html.match(/<article\b[\s\S]*?<\/article>/gi) ?? [];

  return articleBlocks
    .flatMap((article) => [...article.matchAll(/href=["']([^"']+)["']/gi)])
    .flatMap((match) => {
      try {
        return [new URL(match[1], glavniGradEventsUrl)];
      } catch {
        return [];
      }
    })
    .filter(
      (url) =>
        url.protocol === "https:" &&
        url.hostname === "podgorica.me" &&
        url.pathname !== "/category/aktuelni-dogadjaji/" &&
        !url.pathname.startsWith("/category/"),
    )
    .map(String)
    .filter((url, index, all) => all.indexOf(url) === index);
}

function parseGlavniGradEventArticle(html: string, sourceUrl: string) {
  const articleHtml = html.match(/<article\b[\s\S]*?<\/article>/i)?.[0] ?? html;
  const text = toPlainText(articleHtml);
  const title =
    articleHtml
      .match(/<h[1-3][^>]*>([\s\S]*?)<\/h[1-3]>/i)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .trim() ?? "";
  const numericDate = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)?.slice(1);
  const namedDate = text.match(
    /\b(\d{1,2})\.\s*(januara|februara|marta|aprila|maja|juna|jula|avgusta|septembra|oktobra|novembra|decembra)\b/i,
  );
  const publicationDate = parsePublicationDate(articleHtml) ?? parsePublicationDate(html);
  const time = text.match(/\b(?:u|od)\s+(\d{1,2})(?::(\d{2}))?\s*(?:h|čas(?:ova)?|sati)?\b/i);
  const startDate = numericDate
    ? `${numericDate[2]}-${numericDate[1].padStart(2, "0")}-${numericDate[0].padStart(2, "0")}`
    : namedDate && publicationDate
      ? toIsoDate({
          day: namedDate[1],
          month: montenegrinMonths[namedDate[2].toLocaleLowerCase("me-ME")],
          year: publicationDate.getUTCFullYear(),
        })
      : undefined;
  const startsAt =
    startDate && time
      ? toZonedIso(
          { date: startDate, time: `${time[1].padStart(2, "0")}:${time[2] ?? "00"}` },
          "Europe/Podgorica",
        )
      : undefined;
  const rawVenue =
    text.match(/(?:u|na)\s+((?:digitalizovanoj\s+)?bioskopskoj sali[^.,]+)/i)?.[1] ??
    [...text.matchAll(/(?:u|na)\s+(?:parku|trgu|platou|centru)\s+([^.,]+)/gi)].at(-1)?.[0];
  const candidate: EventCandidate = {
    categoryHint: /koncert|muzik/i.test(text)
      ? "concert"
      : /film|projekcij/i.test(text)
        ? "movie"
        : /predstav|pozorišt/i.test(text)
          ? "theatre"
          : /izložb/i.test(text)
            ? "exhibition"
            : /radionic/i.test(text)
              ? "workshop"
              : "other",
    explicitStatus: /otkaz/i.test(text)
      ? "cancelled"
      : /odgođen/i.test(text)
        ? "postponed"
        : undefined,
    imageUrl: html.match(/property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1],
    language: "me",
    parserWarnings: [
      ...(startDate
        ? []
        : [
            namedDate && !publicationDate
              ? "Glavni Grad article date could not be resolved without a publication year."
              : "Glavni Grad article date was unavailable.",
          ]),
      ...(startDate && !time ? ["Glavni Grad article start time was unavailable."] : []),
    ],
    rawDateText: numericDate?.join(".") ?? namedDate?.[0],
    rawDescription: text,
    rawTimeText: time?.[0],
    rawTitle: title,
    rawVenue,
    source: {
      sourceId: "glavni-grad-podgorica",
      sourceName: "Glavni grad Podgorica",
      sourceUrl,
    },
    sourceUpdatedAt: publicationDate?.toISOString(),
    startDate: startsAt ? undefined : startDate,
    startsAt,
    timezone: "Europe/Podgorica",
  };
  return { candidate, venue: rawVenue ? undefined : glavniGradVenue };
}

function toPlainText(html: string) {
  return html
    .replace(/<head\b[\s\S]*?<\/head>/gi, " ")
    .replace(/<(?:script|style|svg)\b[\s\S]*?<\/(?:script|style|svg)>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const montenegrinMonths: Record<string, number> = {
  aprila: 4,
  avgusta: 8,
  decembra: 12,
  februara: 2,
  januara: 1,
  jula: 7,
  juna: 6,
  maja: 5,
  marta: 3,
  novembra: 11,
  oktobra: 10,
  septembra: 9,
};

function parsePublicationDate(html: string) {
  const isoDate =
    html.match(/<time[^>]+datetime=["'](\d{4}-\d{2}-\d{2})/i)?.[1] ??
    html.match(/article:published_time["'][^>]+content=["'](\d{4}-\d{2}-\d{2})/i)?.[1];
  if (isoDate) return parseIsoDate(isoDate);

  const englishDate = html.match(
    /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+(\d{1,2}),\s+(\d{4})\b/i,
  );
  if (!englishDate) return undefined;

  const month = englishMonths[englishDate[1].toLocaleLowerCase("en-US")];
  return month
    ? toUtcDate({ day: englishDate[2], month, year: Number(englishDate[3]) })
    : undefined;
}

const englishMonths: Record<string, number> = {
  april: 4,
  august: 8,
  december: 12,
  february: 2,
  january: 1,
  july: 7,
  june: 6,
  march: 3,
  may: 5,
  november: 11,
  october: 10,
  september: 9,
};

function toIsoDate({ day, month, year }: { day: string; month: number | undefined; year: number }) {
  if (!month) return undefined;
  const date = toUtcDate({ day, month, year });
  return date?.toISOString().slice(0, 10);
}

function parseIsoDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return toUtcDate({ day: String(day), month, year });
}

function toUtcDate({ day, month, year }: { day: string; month: number; year: number }) {
  const numericDay = Number(day);
  const date = new Date(Date.UTC(year, month - 1, numericDay));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === numericDay
    ? date
    : undefined;
}

export { discoverGlavniGradEventUrls, glavniGradEventsUrl, parseGlavniGradEventArticle };
