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

function parseCnpRepertoire(html: string): EventCandidate[] {
  const monthAndYear = parseRepertoireMonthAndYear(html);
  const rows = [...html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)];

  return rows.flatMap((row) => {
    const cells = [...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/gi)].map(
      (cell) => cell[1],
    );
    const day = toPlainText(cells[0] ?? "").match(/\b(\d{1,2})\./)?.[1];
    const title =
      extractTagText(cells[1] ?? "", "strong") ?? extractTagText(cells[1] ?? "", "b");
    const schedule = toPlainText(cells[2] ?? "");
    const time = schedule.match(/\bu\s*(\d{1,2})(?::(\d{2}))?\s*h?\b/i);
    const startDate =
      day && monthAndYear
        ? `${monthAndYear.year}-${String(monthAndYear.month).padStart(2, "0")}-${day.padStart(2, "0")}`
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

    if (!title) return [];

    return [
      {
        categoryHint: /opera|koncert/i.test(`${title} ${schedule}`)
          ? "concert"
          : /festival/i.test(`${title} ${schedule}`)
            ? "festival"
            : /dje(c|č)|djeca/i.test(`${title} ${schedule}`)
              ? "kids"
              : /predstava|drama|pozorišt/i.test(`${title} ${schedule}`)
                ? "theatre"
                : "other",
        language: "me",
        parserWarnings: [
          ...(startDate ? [] : ["CNP repertoire date was unavailable."]),
          ...(startDate && !time ? ["CNP repertoire start time was unavailable."] : []),
        ],
        rawDateText: startDate
          ? `${day}. ${monthAndYear?.name} ${monthAndYear?.year}`
          : undefined,
        rawDescription: schedule || undefined,
        rawTimeText: time?.[0],
        rawTitle: title,
        rawVenue:
          schedule.replace(/\s+u\s*\d{1,2}(?::\d{2})?\s*h?\b/i, "").trim() || undefined,
        source: {
          sourceId: "cnp",
          sourceName: "Crnogorsko narodno pozorište",
          sourceUrl: cnpRepertoireUrl,
        },
        startDate: startsAt ? undefined : startDate,
        startsAt,
        timezone: "Europe/Podgorica",
      } satisfies EventCandidate,
    ];
  });
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
  return (
    value === cnpVenue.name || /^(?:Velika scena|Mala scena|Scena Studio)$/i.test(value ?? "")
  );
}

function extractTagText(html: string, tag: "b" | "strong") {
  const match = html.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? toPlainText(match[1]) : undefined;
}

function parseRepertoireMonthAndYear(html: string) {
  const match = toPlainText(html).match(
    /\b(januar|februar|mart|april|maj|jun|jul|avgust|septembar|oktobar|novembar|decembar)\s+(20\d{2})\b/i,
  );
  if (!match) return undefined;

  const name = match[1].toLocaleLowerCase("me-ME");
  const month = repertoireMonths[name];
  return month ? { month, name, year: Number(match[2]) } : undefined;
}

const repertoireMonths: Record<string, number> = {
  april: 4,
  avgust: 8,
  decembar: 12,
  februar: 2,
  januar: 1,
  jul: 7,
  jun: 6,
  maj: 5,
  mart: 3,
  novembar: 11,
  oktobar: 10,
  septembar: 9,
};

function toPlainText(html: string) {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export {
  cnpRepertoireUrl,
  cnpVenue,
  discoverCnpEventUrls,
  parseCnpEventArticle,
  parseCnpRepertoire,
};
