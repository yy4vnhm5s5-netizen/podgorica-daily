import { toZonedIso } from "../domain/event-time.ts";
import type { EventCandidate } from "../domain/event.ts";

const cineplexxProgrammeUrl = "https://www.cineplexx.me/cinemas/CINEPLEXX-PODGORICA/";
const cineplexxHostnames = new Set(["cineplexx.me", "www.cineplexx.me"]);
const voidElements = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source"]);

interface CineplexxProgrammeParseOptions {
  sourceUrl?: string;
  today: string;
}

interface ParsedHtmlNode {
  attributes: Record<string, string>;
  children: ParsedHtmlNode[];
  tag: string;
  text: string;
}

function parseCineplexxProgramme(
  html: string,
  { sourceUrl = cineplexxProgrammeUrl, today }: CineplexxProgrammeParseOptions,
) {
  const document = parseHtml(html);
  const isTodayProgramme = includesTodayMarker(document);

  return findAll(document, (node) => hasClass(node, "l-sessions__item")).flatMap((movie) =>
    parseMovieScreenings(movie, {
      sourceUrl,
      today: isTodayProgramme ? today : undefined,
    }),
  );
}

function parseMovieScreenings(
  movie: ParsedHtmlNode,
  { sourceUrl, today }: { sourceUrl: string; today?: string },
) {
  const title = getText(findFirst(movie, (node) => node.tag === "h2"));
  const movieUrl = absoluteCineplexxUrl(
    getAttribute(findFirst(movie, (node) => node.tag === "a" && hrefStartsWith(node, "/film/")), "href"),
    sourceUrl,
  );
  const posterUrl = getAttribute(findFirst(movie, (node) => node.tag === "img"), "src");
  const genre = getText(findFirst(movie, (node) => hasClass(node, "b-title-with-poster__genre")));
  const duration = getText(findFirst(movie, (node) => hasClass(node, "b-title-with-poster__duration")));
  const ageRating = (getText(movie) ?? "").match(/\b(?:[1-9]|1[0-8])\+\b/)?.[0];

  return findAll(movie, (node) => hasClass(node, "l-tickets__item")).flatMap((screening) => {
    const bookingUrl = absoluteCineplexxUrl(
      getAttribute(
        findFirst(screening, (node) => node.tag === "a" && hrefStartsWith(node, "/purchase/wizard/")),
        "href",
      ),
      sourceUrl,
    );
    const screeningTime = getText(
      findFirst(screening, (node) => hasClass(node, "l-tickets__item-time")),
    );
    const hall = getText(findFirst(screening, (node) => hasClass(node, "l-tickets__item-cinema")));
    const info = getText(findFirst(screening, (node) => hasClass(node, "l-tickets__item-info")));
    const { format, language } = splitFormatAndLanguage(info);
    const warnings = [
      ...(title ? [] : ["Cineplexx movie title was unavailable."]),
      ...(today ? [] : ["Cineplexx programme date was unavailable."]),
      ...(isValidTime(screeningTime) ? [] : ["Cineplexx screening time was unavailable."]),
      ...(bookingUrl ? [] : ["Cineplexx booking URL was unavailable."]),
    ];
    const startsAt =
      today && isValidTime(screeningTime)
        ? toZonedIso({ date: today, time: screeningTime }, "Europe/Podgorica")
        : undefined;

    if (!bookingUrl || !title) return [];

    const venue = ["Cineplexx Podgorica", hall, format].filter(Boolean).join(" — ");
    const tags = [
      movieUrl ? `movie:${movieUrl}` : undefined,
      format ? `format:${format}` : undefined,
      language ? `language:${language}` : undefined,
      genre ? `genre:${genre}` : undefined,
      duration ? `duration:${duration}` : undefined,
      ageRating ? `age_rating:${ageRating}` : undefined,
      hall ? `hall:${hall}` : undefined,
      "cinema:Cineplexx Podgorica",
    ].filter((tag): tag is string => Boolean(tag));

    const candidate: EventCandidate = {
      categoryHint: "movie",
      imageUrl: posterUrl,
      language: "me",
      parserWarnings: warnings,
      rawDateText: today,
      rawDescription: [genre, duration, hall, info].filter(Boolean).join(" · "),
      rawTimeText: screeningTime || undefined,
      rawTitle: title,
      rawVenue: venue || undefined,
      source: {
        sourceId: "cineplexx-podgorica",
        sourceName: "Cineplexx Podgorica",
        sourceUrl: bookingUrl,
      },
      startDate: startsAt ? undefined : today,
      startsAt,
      tags,
      timezone: "Europe/Podgorica",
    };

    return [candidate];
  });
}

function parseHtml(html: string) {
  const root: ParsedHtmlNode = { attributes: {}, children: [], tag: "root", text: "" };
  const stack = [root];
  const tokens = html.matchAll(/<!--[\s\S]*?-->|<\/?[A-Za-z][^>]*>|[^<]+/g);

  for (const token of tokens) {
    const value = token[0];
    if (value.startsWith("<!--")) continue;
    if (!value.startsWith("<")) {
      stack.at(-1)?.children.push({ attributes: {}, children: [], tag: "#text", text: value });
      continue;
    }
    if (value.startsWith("</")) {
      const closingTag = value.slice(2, -1).trim().toLowerCase();
      while (stack.length > 1 && stack.at(-1)?.tag !== closingTag) stack.pop();
      if (stack.at(-1)?.tag === closingTag) stack.pop();
      continue;
    }

    const match = value.match(/^<([A-Za-z][\w:-]*)([\s\S]*?)\/?\s*>$/);
    if (!match) continue;
    const node: ParsedHtmlNode = {
      attributes: parseAttributes(match[2]),
      children: [],
      tag: match[1].toLowerCase(),
      text: "",
    };
    stack.at(-1)?.children.push(node);
    if (!value.endsWith("/>") && !voidElements.has(node.tag)) stack.push(node);
  }

  return root;
}

function parseAttributes(value: string) {
  const attributes: Record<string, string> = {};
  for (const match of value.matchAll(/([\w:-]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g)) {
    attributes[match[1].toLowerCase()] = decodeHtml(match[2] ?? match[3] ?? match[4] ?? "");
  }
  return attributes;
}

function findAll(root: ParsedHtmlNode, predicate: (node: ParsedHtmlNode) => boolean) {
  const matches: ParsedHtmlNode[] = [];
  const visit = (node: ParsedHtmlNode) => {
    if (predicate(node)) matches.push(node);
    node.children.forEach(visit);
  };
  visit(root);
  return matches;
}

function findFirst(root: ParsedHtmlNode, predicate: (node: ParsedHtmlNode) => boolean) {
  return findAll(root, predicate)[0];
}

function getText(node: ParsedHtmlNode | undefined): string | undefined {
  if (!node) return undefined;
  const value = collectText(node).replace(/\s+/g, " ").trim();
  return value || undefined;
}

function collectText(node: ParsedHtmlNode): string {
  return node.tag === "#text" ? decodeHtml(node.text) : node.children.map(collectText).join(" ");
}

function getAttribute(node: ParsedHtmlNode | undefined, name: string) {
  return node?.attributes[name.toLowerCase()] || undefined;
}

function hasClass(node: ParsedHtmlNode, className: string) {
  return getAttribute(node, "class")?.split(/\s+/).includes(className) ?? false;
}

function hrefStartsWith(node: ParsedHtmlNode, prefix: string) {
  return getAttribute(node, "href")?.startsWith(prefix) ?? false;
}

function absoluteCineplexxUrl(value: string | undefined, sourceUrl: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value, sourceUrl);
    return url.protocol === "https:" && cineplexxHostnames.has(url.hostname) ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

function includesTodayMarker(root: ParsedHtmlNode) {
  return /\bdanas\b/i.test(getText(root) ?? "");
}

function isValidTime(value: string | undefined): value is string {
  if (!value || !/^\d{1,2}:\d{2}$/.test(value)) return false;
  const [hour, minute] = value.split(":").map(Number);
  return hour <= 23 && minute <= 59;
}

function splitFormatAndLanguage(value: string | undefined) {
  const values = value?.split(",").map((item) => item.trim()).filter(Boolean) ?? [];
  return {
    format: values.filter((item) => /^(?:2D|3D|IMAX|4DX|DOLBY(?:\s+ATMOS)?|ONE)$/i.test(item)).join(", ") || undefined,
    language:
      values
        .filter((item) => /(?:sinh|sinhron|titl|sub|dub)/i.test(item))
        .join(", ") || undefined,
  };
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

export {
  cineplexxProgrammeUrl,
  parseCineplexxProgramme,
  splitFormatAndLanguage,
  type CineplexxProgrammeParseOptions,
};
