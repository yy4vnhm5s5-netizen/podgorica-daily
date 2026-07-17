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
  return [...html.matchAll(/href=["']([^"']+)["']/gi)]
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
  const text = html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const title =
    html
      .match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .trim() ?? "";
  const date = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)?.slice(1);
  const time = text.match(/(?:u|od)\s*(\d{1,2})(?::(\d{2}))?\s*(?:h|čas(?:ova)?|sati)?/i);
  const startDate = date
    ? `${date[2]}-${date[1].padStart(2, "0")}-${date[0].padStart(2, "0")}`
    : undefined;
  const startsAt =
    startDate && time
      ? toZonedIso(
          { date: startDate, time: `${time[1].padStart(2, "0")}:${time[2] ?? "00"}` },
          "Europe/Podgorica",
        )
      : undefined;
  const rawVenue = [...text.matchAll(/(?:u|na)\s+(?:parku|trgu|platou|centru)\s+([^.,]+)/gi)].at(
    -1,
  )?.[0];
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
      ...(startDate ? [] : ["Glavni Grad article date was unavailable."]),
      ...(startDate && !time ? ["Glavni Grad article start time was unavailable."] : []),
    ],
    rawDateText: date?.join("."),
    rawDescription: text,
    rawTimeText: time?.[0],
    rawTitle: title,
    rawVenue,
    source: {
      sourceId: "glavni-grad-podgorica",
      sourceName: "Glavni grad Podgorica",
      sourceUrl,
    },
    startDate: startsAt ? undefined : startDate,
    startsAt,
    timezone: "Europe/Podgorica",
  };
  return { candidate, venue: rawVenue ? undefined : glavniGradVenue };
}

export { discoverGlavniGradEventUrls, glavniGradEventsUrl, parseGlavniGradEventArticle };
