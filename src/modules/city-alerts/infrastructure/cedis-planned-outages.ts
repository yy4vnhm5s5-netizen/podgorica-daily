import { createHash } from "node:crypto";

import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";

const cedisOrigin = "https://cedis.me";
const municipalityNames =
  "Podgorica|Nikšić|Danilovgrad|Cetinje|Kolašin|Herceg Novi|Bar|Budva|Kotor|Tivat|Ulcinj|Pljevlja|Bijelo Polje|Berane|Rožaje|Plav|Gusinje|Mojkovac|Šavnik|Žabljak|Tuzi|Zeta";
const municipalityPattern = new RegExp(
  `\\b(${municipalityNames})\\s*(?:[-–—:]\\s*|(?=\\n|$))`,
  "gi",
);
const monthNumbers: Record<string, number> = {
  april: 3,
  aprila: 3,
  avgust: 7,
  avgusta: 7,
  decembar: 11,
  decembra: 11,
  februar: 1,
  februara: 1,
  januar: 0,
  januara: 0,
  jul: 6,
  jula: 6,
  jun: 5,
  juna: 5,
  maj: 4,
  maja: 4,
  mart: 2,
  marta: 2,
  novembar: 10,
  novembra: 10,
  oktobar: 9,
  oktobra: 9,
  septembar: 8,
  septembra: 8,
};

interface CedisArticleLink {
  publishedAt?: Date;
  title: string;
  url: string;
}

interface CedisArticleParseResult {
  alerts: CityAlert[];
  contentSelector?: string;
  contentRecognized: boolean;
  podgoricaHeadingFound: boolean;
  warnings: string[];
  zeroRecordsReason?:
    | "article-content-unrecognized"
    | "no-parseable-podgorica-records"
    | "podgorica-heading-not-found"
    | "publication-date-unrecognized";
}

function discoverCedisArticles(html: string, now = new Date()): CedisArticleLink[] {
  const links = [...html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({ title: stripHtml(match[2]), url: toCedisUrl(match[1]) }))
    .filter((link): link is { title: string; url: string } => Boolean(link.url))
    .filter(({ title }) => /planiran[ai] radov/i.test(title));

  return deduplicate(links).filter(({ title }) => {
    const date = parseArticleDate(title, now);
    return !date || date.getTime() >= startOfDay(addDays(now, -1)).getTime();
  });
}

function parseCedisArticle(article: CedisArticleLink, html: string, now = new Date()): CityAlert[] {
  return parseCedisArticleResult(article, html, now).alerts;
}

function parseCedisArticleResult(
  article: CedisArticleLink,
  html: string,
  now = new Date(),
): CedisArticleParseResult {
  const publicationDate = article.publishedAt ?? parseArticleDate(article.title, now);
  if (!publicationDate) {
    return {
      alerts: [],
      contentRecognized: false,
      podgoricaHeadingFound: false,
      warnings: ["publication-date-unrecognized"],
      zeroRecordsReason: "publication-date-unrecognized",
    };
  }

  const articleContent = extractArticleContent(removeEmbeddedNonContent(html));
  const text = articleContent ? toArticleText(articleContent.content) : "";
  if (!text) {
    return {
      alerts: [],
      contentRecognized: false,
      podgoricaHeadingFound: false,
      warnings: ["article-content-unrecognized"],
      zeroRecordsReason: "article-content-unrecognized",
    };
  }
  const sections = getPodgoricaSections(text);
  if (sections.length === 0) {
    return {
      alerts: [],
      contentRecognized: true,
      contentSelector: articleContent?.selector,
      podgoricaHeadingFound: false,
      warnings: [],
      zeroRecordsReason: "podgorica-heading-not-found",
    };
  }

  const alerts = sections.flatMap(({ section, startIndex }) => {
    const date = getDateBeforePosition(text, startIndex, publicationDate);
    const lines = section
      .split(/(?=\s*-?\s*(?:(?:u terminu\s+)?od\s+\d{1,2}))/i)
      .filter((line) => line.trim() && !/^u terminu$/i.test(line.trim()));
    return lines.flatMap((line) => parseOutageLine(line, date, article));
  });

  const normalizedAlerts = deduplicateAlerts(alerts);
  return {
    alerts: normalizedAlerts,
    contentRecognized: true,
    contentSelector: articleContent?.selector,
    podgoricaHeadingFound: true,
    warnings: [],
    ...(normalizedAlerts.length === 0
      ? { zeroRecordsReason: "no-parseable-podgorica-records" as const }
      : {}),
  };
}

function parseOutageLine(line: string, date: Date, article: CedisArticleLink): CityAlert[] {
  const normalized = normalizeWhitespace(line).replace(/^[-–—]\s*/, "");
  const range = parseTimeRange(normalized);
  const area = extractAffectedArea(normalized, range);

  if (!area) {
    return [];
  }

  const startsAt = range?.start ? withLocalTime(date, range.start) : undefined;
  const expectedEndAt = range?.end ? withLocalTime(date, range.end) : undefined;
  const status = getOutageStatus(startsAt, expectedEndAt, new Date());
  const rawSourceText = range ? undefined : normalized;
  const id = createHash("sha256")
    .update(`${article.url}|${date.toISOString()}|${range?.raw ?? ""}|${normalizeArea(area)}`)
    .digest("hex");

  return [
    {
      affectedArea: { kind: "source", value: area },
      cityIds: ["podgorica"],
      dataMode: "live",
      description: {
        kind: "source",
        value: range
          ? `Planirani prekid od ${range.raw}.`
          : "Planirani prekid; termin nije moguće pouzdano pročitati.",
      },
      expectedEndAt,
      id,
      publishedAt: article.publishedAt ?? date,
      rawSourceText,
      severity: "information",
      source: { kind: "source", value: "CEDIS" },
      sourceUrl: article.url,
      startsAt,
      status,
      title: { kind: "source", value: "Planirano isključenje struje" },
      type: "powerOutage",
    },
  ];
}

function getPodgoricaSection(text: string) {
  return getPodgoricaSections(text)[0]?.section ?? null;
}

function getPodgoricaSections(text: string) {
  const sections: Array<{ section: string; startIndex: number }> = [];
  const matches = [
    ...text.matchAll(new RegExp(`\\b(Podgorica)\\s*(?:[-–—:]\\s*|(?=\\n|$))`, "gi")),
  ];
  for (const [index, match] of matches.entries()) {
    const startIndex = (match.index ?? 0) + match[0].length;
    const nextPodgoricaIndex = matches[index + 1]?.index ?? text.length;
    const afterPodgorica = text.slice(startIndex, nextPodgoricaIndex);
    municipalityPattern.lastIndex = 0;
    const nextMunicipality = municipalityPattern.exec(afterPodgorica);
    const section = (
      nextMunicipality ? afterPodgorica.slice(0, nextMunicipality.index) : afterPodgorica
    ).trim();
    if (section) sections.push({ section, startIndex: match.index ?? 0 });
  }
  return sections;
}

function getDateBeforePosition(text: string, position: number, fallback: Date) {
  const dates = parseArticleDates("", text.slice(0, position), fallback);
  return dates.at(-1) ?? fallback;
}

function parseArticleDates(title: string, text: string, fallback: Date) {
  const dates = [
    ...`${title} ${text}`.matchAll(
      /\b((?:\d{1,2}\.?\s*(?:(?:,|\bi\b|\bi\s+)?\s*)?)+)(januar\w*|februar\w*|mart\w*|april\w*|maj\w*|jun\w*|jul\w*|avgust\w*|septembar\w*|oktobar\w*|novembar\w*|decembar\w*)\b/gi,
    ),
  ]
    .flatMap((match) =>
      (match[1].match(/\d{1,2}/g) ?? []).map((day) =>
        parseMontenegrinDate(`${day} ${match[2]}`, fallback.getFullYear()),
      ),
    )
    .filter((date): date is Date => date !== null);
  return dates.length > 0 ? dates : [fallback];
}

function parseArticleDate(title: string, now: Date) {
  return parseArticleDates(title, "", now)[0];
}

function parseMontenegrinDate(value: string, year: number) {
  const match = /^(\d{1,2})\.?\s*([^\s]+)$/i.exec(value.trim());
  if (!match) return null;
  const month = monthNumbers[match[2].toLowerCase()];
  return month === undefined ? null : new Date(Date.UTC(year, month, Number(match[1]), 12));
}

function parseTimeRange(value: string) {
  const match =
    /(?:u terminu\s*)?(?:od\s*)?(\d{1,2}(?::|\.)?\d{0,2}\s*h?)\s*(?:do|-|–)\s*(\d{1,2}(?::|\.)?\d{0,2}\s*h?)\s*(?:sati)?/i.exec(
      value,
    );
  if (!match) return null;
  const start = parseTime(match[1]);
  const end = parseTime(match[2]);
  return start && end ? { end, raw: match[0].trim(), start } : null;
}

function extractAffectedArea(value: string, range: ReturnType<typeof parseTimeRange>) {
  if (range) {
    const rangeIndex = value
      .toLocaleLowerCase("sr-Latn-ME")
      .indexOf(range.raw.toLocaleLowerCase("sr-Latn-ME"));
    if (rangeIndex >= 0) {
      return value
        .slice(rangeIndex + range.raw.length)
        .replace(/^\s*(?:sati)?\s*[:;,-]?\s*/i, "")
        .replace(
          /\s+\d{1,2}\.?\s*(?:januar\w*|februar\w*|mart\w*|april\w*|maj\w*|jun\w*|jul\w*|avgust\w*|septembar\w*|oktobar\w*|novembar\w*|decembar\w*)$/i,
          "",
        )
        .trim();
    }
  }

  const separator = value.lastIndexOf(":");
  return (separator >= 0 ? value.slice(separator + 1) : value).replace(/^[-–—,:;]+/, "").trim();
}

function parseTime(value: string) {
  const [hours, minutes = "0"] = value.replace(/h\s*$/i, "").replace(".", ":").split(":");
  const hour = Number(hours);
  const minute = Number(minutes);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

function withLocalTime(date: Date, time: { hour: number; minute: number }) {
  const utc = Date.UTC(
    date.getUTCFullYear(),
    date.getUTCMonth(),
    date.getUTCDate(),
    time.hour,
    time.minute,
  );
  const name =
    new Intl.DateTimeFormat("en", { timeZone: "Europe/Podgorica", timeZoneName: "longOffset" })
      .formatToParts(new Date(utc))
      .find(({ type }) => type === "timeZoneName")?.value ?? "GMT+00:00";
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name);
  const offset = match
    ? (Number(match[2]) * 60 + Number(match[3])) * 60_000 * (match[1] === "+" ? 1 : -1)
    : 0;
  return new Date(utc - offset);
}

function getOutageStatus(startsAt: Date | undefined, endsAt: Date | undefined, now: Date) {
  if (endsAt && endsAt < now) return "expired" as const;
  return startsAt && startsAt > now ? ("scheduled" as const) : ("active" as const);
}

function toCedisUrl(value: string) {
  try {
    const url = new URL(value, cedisOrigin);
    return url.protocol === "https:" && url.hostname === "cedis.me" ? url.toString() : null;
  } catch {
    return null;
  }
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
function normalizeArea(value: string) {
  return normalizeWhitespace(value).toLocaleLowerCase("sr-Latn-ME");
}
function stripHtml(value: string) {
  return value.replace(/<[^>]+>/g, " ").replace(/&nbsp;/gi, " ");
}
function toArticleText(value: string) {
  return value
    .replace(/<\/?(?:article|div|h[1-6]|li|ol|p|section|ul)[^>]*>/gi, "\n")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/[\t\f\r ]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{2,}/g, "\n")
    .trim();
}
function extractArticleContent(value: string) {
  const article = extractFirstElementContent(value, "article");
  if (article) return { content: article, selector: "article" };

  for (const className of [
    "entry-content",
    "post-content",
    "article-content",
    "single-post-content",
    "td-post-content",
    "the-content",
    "elementor-widget-theme-post-content",
  ]) {
    const content = extractFirstElementByClass(value, className);
    if (content) return { content, selector: `.${className}` };
  }

  return null;
}
function extractFirstElementByClass(value: string, className: string) {
  const openingTag = /<div\b[^>]*>/gi;
  for (const match of value.matchAll(openingTag)) {
    if (!hasClass(match[0], className)) continue;
    const content = extractElementContent(value, match.index ?? 0, "div");
    if (content) return content;
  }
  return null;
}
function extractFirstElementContent(value: string, tagName: string) {
  const openingTag = new RegExp(`<${tagName}\\b[^>]*>`, "gi");
  for (const match of value.matchAll(openingTag)) {
    const content = extractElementContent(value, match.index ?? 0, tagName);
    if (content) return content;
  }
  return null;
}
function extractElementContent(value: string, openingIndex: number, tagName: string) {
  const openingEnd = value.indexOf(">", openingIndex);
  if (openingEnd < 0) return null;

  const tag = new RegExp(`<\\/?${tagName}\\b[^>]*>`, "gi");
  tag.lastIndex = openingIndex;
  let depth = 0;
  for (let match = tag.exec(value); match; match = tag.exec(value)) {
    const isClosingTag = /^<\//.test(match[0]);
    const isSelfClosingTag = /\/$/.test(match[0].slice(0, -1));
    if (isClosingTag) {
      depth -= 1;
      if (depth === 0) return value.slice(openingEnd + 1, match.index);
    } else if (!isSelfClosingTag) {
      depth += 1;
    }
  }

  return null;
}
function hasClass(tag: string, className: string) {
  const match = /\bclass\s*=\s*(?:["']([^"']*)["']|([^\s>]+))/i.exec(tag);
  return (match?.[1] ?? match?.[2] ?? "").split(/\s+/).includes(className);
}
function removeEmbeddedNonContent(value: string) {
  return value
    .replace(/<!--([\s\S]*?)-->/g, " ")
    .replace(
      /<(script|style|noscript|svg|template|iframe|object|embed)\b[^>]*>[\s\S]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(/<(?:script|style|noscript|svg|template|iframe|object|embed)\b[^>]*\/?\s*>/gi, " ");
}
function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setDate(next.getDate() + days);
  return next;
}
function startOfDay(value: Date) {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate());
}
function deduplicate<T extends { url: string }>(items: T[]) {
  return [...new Map(items.map((item) => [item.url, item])).values()];
}
function deduplicateAlerts(items: CityAlert[]) {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export {
  cedisOrigin,
  discoverCedisArticles,
  getPodgoricaSection,
  parseCedisArticle,
  parseCedisArticleResult,
  parseTimeRange,
  toCedisUrl,
  type CedisArticleLink,
  type CedisArticleParseResult,
};
