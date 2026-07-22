import { toZonedIso } from "../domain/event-time.ts";
import type { EventCandidate, Venue } from "../domain/event.ts";
import { extractEventContentText, extractEventHeading } from "./event-html-content.ts";

const kicVenue: Venue = {
  address: "Vaka Đurovića 12, Podgorica",
  cityId: "podgorica",
  id: "kic-budo-tomovic",
  name: "KIC Budo Tomović",
  sourceUrl: "https://kic.podgorica.me/",
};

function discoverKicArticleUrls(html: string, baseUrl = "https://kic.podgorica.me") {
  return [...html.matchAll(/href=["']([^"']*\/novosti\/[^"'#?]+)["']/gi)]
    .map((match) => new URL(match[1], baseUrl).toString())
    .filter((url, index, urls) => urls.indexOf(url) === index);
}

function parseKicEventArticle(html: string, sourceUrl: string) {
  const warnings: string[] = [];
  const title = extractEventHeading(html) ?? getMeta(html, "og:title") ?? "";
  const description = extractEventContentText(html) || undefined;
  const imageUrl = getMeta(html, "og:image");
  const text = description ?? "";
  const dateMatch = text.match(/(\d{1,2})[.\/]\s*(\d{1,2})[.\/]\s*(\d{4})/);
  const timeMatch = text.match(/(?:u|od)\s*(\d{1,2})(?::|\.)?(\d{2})?\s*(?:h|sati)?/i);
  const endMatch = text.match(/(?:do|-|–)\s*(\d{1,2})(?::|\.)?(\d{2})?\s*(?:h|sati)?/i);
  const startDate = dateMatch
    ? `${dateMatch[3]}-${dateMatch[2].padStart(2, "0")}-${dateMatch[1].padStart(2, "0")}`
    : undefined;
  const startsAt =
    startDate && timeMatch
      ? toZonedIso(
          {
            date: startDate,
            time: `${timeMatch[1].padStart(2, "0")}:${(timeMatch[2] ?? "00").padStart(2, "0")}`,
          },
          "Europe/Podgorica",
        )
      : undefined;
  const endsAt =
    startDate && endMatch
      ? toZonedIso(
          {
            date: startDate,
            time: `${endMatch[1].padStart(2, "0")}:${(endMatch[2] ?? "00").padStart(2, "0")}`,
          },
          "Europe/Podgorica",
        )
      : undefined;

  if (!startDate) warnings.push("KIC article date was unavailable.");
  if (startDate && !startsAt) warnings.push("KIC article start time was unavailable.");
  const candidate: EventCandidate = {
    categoryHint: getCategoryHint(`${title} ${text}`),
    explicitStatus: /otkazan[ao]?|cancelled/i.test(text) ? "cancelled" : undefined,
    imageUrl,
    isFree: /ulaz\s+je\s+slobodan|besplatan/i.test(text) ? true : undefined,
    language: "me",
    parserWarnings: warnings,
    rawDateText: dateMatch?.[0],
    rawDescription: description,
    rawPriceText: getPriceText(text),
    rawTimeText: timeMatch?.[0],
    rawTitle: title,
    rawVenue: /KIC|velik[ao]j? sal[ai]|multimedijaln[ao]j? sal[ai]|izložben/i.test(text)
      ? kicVenue.name
      : undefined,
    priceAmount: getPriceAmount(text),
    currency: /€/.test(text) ? "EUR" : undefined,
    source: { sourceId: "kic-budo-tomovic", sourceName: "KIC Budo Tomović", sourceUrl },
    startsAt,
    startDate: startsAt ? undefined : startDate,
    endsAt,
    timezone: "Europe/Podgorica",
  };

  return { candidate, imageUrl, venue: candidate.rawVenue ? kicVenue : undefined };
}

function getCategoryHint(value: string) {
  const normalized = value.toLocaleLowerCase("sr-Latn");
  if (/koncert|jazz|muzik/.test(normalized)) return "concert";
  if (/predstav|pozorišt|teatar/.test(normalized)) return "theatre";
  if (/izložb/.test(normalized)) return "exhibition";
  if (/film|projekcij/.test(normalized)) return "movie";
  if (/radionic/.test(normalized)) return "workshop";
  if (/promocij.*roman|književ/.test(normalized)) return "literature";
  return "other";
}

function getPriceText(value: string) {
  const match = value.match(/(?:ulaz\s+je\s+slobodan|besplatan|\d+(?:[,.]\d+)?\s*€)/i);
  return match?.[0];
}

function getPriceAmount(value: string) {
  const match = value.match(/(\d+(?:[,.]\d+)?)\s*€/);
  return match ? Number(match[1].replace(",", ".")) : undefined;
}

function getMeta(html: string, property: string) {
  const match = html.match(
    new RegExp(`<meta[^>]+(?:property|name)=["']${property}["'][^>]+content=["']([^"']+)["']`, "i"),
  );
  return match?.[1];
}

export { discoverKicArticleUrls, kicVenue, parseKicEventArticle };
