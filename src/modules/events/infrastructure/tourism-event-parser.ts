import { toZonedIso } from "../domain/event-time.ts";
import type { EventCandidate } from "../domain/event.ts";

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
    .filter((url) => url.protocol === "https:" && url.hostname === "podgorica.travel")
    .map(String)
    .filter((url, index, all) => all.indexOf(url) === index);
}

function parseTourismEventArticle(html: string, sourceUrl: string) {
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
  const time = text.match(/(\d{1,2}):(\d{2})\s*(?:–|-|do)\s*(\d{1,2}):(\d{2})/);
  const startDate = date
    ? `${date[2]}-${date[1].padStart(2, "0")}-${date[0].padStart(2, "0")}`
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
    rawDescription: text,
    rawTitle: title,
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

export { discoverTourismEventUrls, parseTourismEventArticle, tourismCalendarUrl };
