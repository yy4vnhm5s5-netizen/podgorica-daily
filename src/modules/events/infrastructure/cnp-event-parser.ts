import { toZonedIso } from "../domain/event-time.ts";
import type { EventCandidate, Venue } from "../domain/event.ts";

const cnpRepertoireUrl = "https://cnp.me/repertoar/";
const cnpVenue: Venue = {
  address: "Stanka Dragojevića bb, Podgorica",
  cityId: "podgorica",
  id: "cnp",
  name: "Crnogorsko narodno pozorište",
  sourceUrl: "https://cnp.me/",
};

function discoverCnpEventUrls(html: string) {
  return [...html.matchAll(/href=["']([^"']+)["']/gi)]
    .flatMap((match) => {
      try {
        return [new URL(match[1], cnpRepertoireUrl)];
      } catch {
        return [];
      }
    })
    .filter(
      (url) =>
        url.protocol === "https:" && url.hostname === "cnp.me" && url.pathname !== "/repertoar/",
    )
    .map(String)
    .filter((url, index, all) => all.indexOf(url) === index);
}

function parseCnpEventArticle(html: string, sourceUrl: string) {
  const text = toPlainText(html);
  const title =
    html
      .match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]
      ?.replace(/<[^>]+>/g, " ")
      .trim() ?? "";
  const date = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/)?.slice(1);
  const time = text.match(/(?:u|od)\s*(\d{1,2})(?::(\d{2}))?\s*(?:h|sati)?/i);
  const price = text.match(
    /(?:cijena ulaznice(?: je)?|ulaznica(?: je)?)\s*(\d+(?:[,.]\d+)?)\s*(€|eur)/i,
  );
  const rawVenue = extractVenue(text);
  const startDate = date
    ? `${date[2]}-${date[1].padStart(2, "0")}-${date[0].padStart(2, "0")}`
    : undefined;
  const startsAt =
    startDate && time
      ? toZonedIso(
          {
            date: startDate,
            time: `${time[1].padStart(2, "0")}:${(time[2] ?? "00").padStart(2, "0")}`,
          },
          "Europe/Podgorica",
        )
      : undefined;
  const candidate: EventCandidate = {
    categoryHint: /opera|koncert/i.test(text)
      ? "concert"
      : /festival/i.test(text)
        ? "festival"
        : /dje(c|č)|djeca/i.test(text)
          ? "kids"
          : /predstava|drama|pozorišt/i.test(text)
            ? "theatre"
            : "other",
    explicitStatus: /otkaz|cancelled/i.test(text)
      ? "cancelled"
      : /odgođen|postponed/i.test(text)
        ? "postponed"
        : undefined,
    currency: price ? "EUR" : undefined,
    imageUrl: extractOpenGraphImage(html),
    isFree: /(?:ulaz(?: je)? slobodan|besplatan ulaz)/i.test(text) ? true : undefined,
    language: "me",
    parserWarnings: [
      ...(startDate ? [] : ["CNP article date was unavailable."]),
      ...(startDate && !time ? ["CNP article start time was unavailable."] : []),
    ],
    priceAmount: price ? Number(price[1].replace(",", ".")) : undefined,
    rawDateText: date?.join("."),
    rawDescription: text,
    rawPriceText: price?.[0],
    rawTitle: title,
    rawTimeText: time?.[0],
    rawVenue,
    source: { sourceId: "cnp", sourceName: "Crnogorsko narodno pozorište", sourceUrl },
    startDate: startsAt ? undefined : startDate,
    startsAt,
    timezone: "Europe/Podgorica",
  };
  return { candidate, venue: isCnpVenue(rawVenue) ? cnpVenue : undefined };
}

function extractOpenGraphImage(html: string) {
  return (
    html.match(/property=["']og:image["'][^>]+content=["']([^"']+)/i)?.[1] ??
    html.match(/content=["']([^"']+)["'][^>]+property=["']og:image/i)?.[1]
  );
}

function extractVenue(text: string) {
  const knownVenue = text.match(
    /(?:Velika scena|Velikoj sceni|Mala scena|Maloj sceni|Scena Studio)\s+CNP/i,
  )?.[0];
  if (knownVenue) return cnpVenue.name;

  return text.match(/(?:na|u)\s+(?:prostoru|sali|galeriji)\s+([^.,]+)/i)?.[0]?.trim();
}

function isCnpVenue(value: string | undefined) {
  return value === cnpVenue.name;
}

function toPlainText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export { cnpRepertoireUrl, cnpVenue, discoverCnpEventUrls, parseCnpEventArticle };
