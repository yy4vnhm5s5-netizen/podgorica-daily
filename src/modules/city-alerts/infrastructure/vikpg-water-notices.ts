import { createHash } from "node:crypto";

import type { CityAlert } from "@/modules/city-alerts/domain/city-alert";

const vikpgOrigin = "https://vikpg.me";
const vikpgWaterNoticesUrl =
  "https://vikpg.me/me/mediji/servisne-informacije/obavjestenja.html";

const servicePattern =
  /\b(?:vodosnabdijevanj\w*|obustav\w*|prekid\w*|kvar\w*|havarij\w*|sanacij\w*|radov\w*|pritis\w*|restrikc\w*|vodovodn\w*|cjevovod\w*|otklonjen\w*|normalizovan\w*|uspostavljen\w*)\b/i;
const restorationPattern =
  /\b(?:otklonjen\w*|normalizovan\w*|uspostavljen\w*|uredno vodosnabdijevanje)\b/i;
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
  oktobar: 9,
  septembar: 8,
  septembra: 8,
};

interface VikpgNoticeLink {
  publishedAt?: Date;
  title: string;
  url: string;
}

interface VikpgParseResult {
  alert: CityAlert | null;
  contentRecognized: boolean;
  warnings: string[];
}

/**
 * Discovers water-service notices from the official VIK listing. The site currently
 * renders service entries on the home page after redirecting the legacy listing URL.
 */
function discoverVikpgNotices(html: string, now = new Date()): VikpgNoticeLink[] {
  const links = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)]
    .map((match) => ({
      publishedAt: extractListingPublicationDate(html, match.index, now),
      title: normalize(stripHtml(match[2])),
      url: toVikpgUrl(match[1]),
    }))
    .filter((link) => Boolean(link.url && link.title))
    .map(toVikpgNoticeLink)
    .filter(({ title }) => servicePattern.test(title));

  return deduplicateLinks(links).filter(({ publishedAt, title }) => {
    const publicationDate = publishedAt ?? parseDate(title, now.getFullYear());
    return (
      !publicationDate || publicationDate.getTime() >= startOfDay(addDays(now, -2)).getTime()
    );
  });
}

function toVikpgNoticeLink({
  publishedAt,
  title,
  url,
}: {
  publishedAt: Date | undefined;
  title: string;
  url: string | null;
}): VikpgNoticeLink {
  if (!url) {
    throw new Error("A filtered VIK notice link must have an approved URL.");
  }

  return {
    ...(publishedAt ? { publishedAt } : {}),
    title,
    url,
  };
}

function extractListingPublicationDate(html: string, linkIndex: number, now: Date) {
  const articleStart = html.lastIndexOf("<article", linkIndex);
  const articleEnd = articleStart >= 0 ? html.indexOf("</article>", linkIndex) : -1;
  const context =
    articleStart >= 0 && articleEnd >= 0
      ? html.slice(articleStart, articleEnd)
      : html.slice(linkIndex, linkIndex + 600);
  return parseDate(stripHtml(context), now.getFullYear());
}

function parseVikpgNotice(
  notice: VikpgNoticeLink,
  html: string,
  now = new Date(),
): VikpgParseResult {
  const title = extractHeading(html) ?? notice.title;
  const content = extractArticleContent(html);
  const publishedAt = parseDate(`${title} ${content}`, now.getFullYear()) ?? notice.publishedAt;

  if (!content) {
    return { alert: null, contentRecognized: false, warnings: ["article-content-unrecognized"] };
  }
  if (!servicePattern.test(`${title} ${content}`)) {
    return { alert: null, contentRecognized: true, warnings: ["notice-not-water-service-related"] };
  }
  if (!publishedAt) {
    return { alert: null, contentRecognized: true, warnings: ["publication-date-unrecognized"] };
  }

  const expectedEndAt = parseExpectedEnd(content, publishedAt);
  const startsAt = parseStart(content, publishedAt);
  const status = getNoticeStatus({ content, expectedEndAt, publishedAt, startsAt, title, now });
  const affectedArea = extractAffectedArea(content);
  const warnings = affectedArea ? [] : ["affected-area-unrecognized"];
  const id = createHash("sha256")
    .update(`${notice.url}|${publishedAt.toISOString()}|${normalize(title)}|${normalize(content)}`)
    .digest("hex");

  return {
    alert: {
      affectedArea: { kind: "source", value: affectedArea ?? "Podgorica" },
      cityIds: ["podgorica"],
      dataMode: "live",
      description: { kind: "source", value: content },
      ...(expectedEndAt ? { expectedEndAt } : {}),
      id,
      publishedAt,
      rawSourceText: content,
      severity: /\b(?:kvar\w*|havarij\w*|obustav\w*|prekid\w*)\b/i.test(`${title} ${content}`)
        ? "warning"
        : "information",
      source: { kind: "source", value: "Vodovod i kanalizacija Podgorica" },
      sourceUrl: notice.url,
      ...(startsAt ? { startsAt } : {}),
      status,
      title: { kind: "source", value: title },
      type: "waterOutage",
    },
    contentRecognized: true,
    warnings,
  };
}

function extractHeading(html: string) {
  const heading = /<h1\b[^>]*>([\s\S]*?)<\/h1>/i.exec(html)?.[1];
  return heading ? normalize(stripHtml(heading)) : null;
}

function extractArticleContent(html: string) {
  const article = /<article\b[^>]*>([\s\S]*?)<\/article>/i.exec(html)?.[1];
  const main = /<main\b[^>]*>([\s\S]*?)<\/main>/i.exec(html)?.[1];
  const afterHeading = /<h1\b[^>]*>[\s\S]*?<\/h1>([\s\S]*)/i.exec(html)?.[1] ?? html;
  const candidate = article ?? main ?? afterHeading;
  return normalize(
    stripHtml(candidate)
      .split(/\b(?:Dokumentacija|Korisni linkovi|Budi u toku)\b/i)[0]
      .replace(/^\s*(?:\d{1,2}[.\-/]\d{1,2}[.\-/]\d{2,4}|\d{1,2}\s+\p{L}+\s+\d{4})\s*/iu, ""),
  );
}

function extractAffectedArea(value: string) {
  const patterns = [
    /\b(?:u|na)\s+(?:naselju|ulici|dijelu grada|području)\s+([^,.]+?)(?=\s+(?:da\s+)?(?:će|je|su|zbog|usljed|radi)\b|[,.]|$)/i,
    /\bpotrošač\w*\s+(?:u|na|sa)\s+([^,.]+?)(?=\s+(?:da\s+)?(?:će|je|su|zbog|usljed|radi)\b|[,.]|$)/i,
    /\b(?:naselja|ulice)\s+([^,.]+?)(?=\s+(?:da\s+)?(?:će|je|su|zbog|usljed|radi)\b|[,.]|$)/i,
  ];
  const match = patterns.map((pattern) => pattern.exec(value)?.[1]).find(Boolean);
  return match ? normalize(match) : null;
}

function parseExpectedEnd(value: string, fallbackDate: Date) {
  const match =
    /\bdo\s+(\d{1,2}(?:[:.]\d{2})?)\s*(?:čas(?:ova)?|sati|h)?(?:\s+(?:dana\s+)?(\d{1,2}[.\-/]\d{1,2}(?:[.\-/]\d{2,4})?|\d{1,2}\.?\s+\p{L}+(?:\s+\d{4})?))?/iu.exec(
      value,
    );
  if (!match) return undefined;
  const time = parseTime(match[1]);
  const date = match[2] ? parseDate(match[2], fallbackDate.getUTCFullYear()) : fallbackDate;
  return time && date ? withLocalTime(date, time) : undefined;
}

function parseStart(value: string, fallbackDate: Date) {
  const match = /\bod\s+(\d{1,2}(?:[:.]\d{2})?)\s*(?:čas(?:ova)?|sati|h)?/i.exec(value);
  const time = match ? parseTime(match[1]) : null;
  return time ? withLocalTime(fallbackDate, time) : undefined;
}

/**
 * A notice with no explicit restoration time remains active until the end of the
 * following local day. This avoids keeping old incident notices visible forever
 * while retaining same-day notices whose optional time could not be parsed.
 */
function getNoticeStatus({
  content,
  expectedEndAt,
  now,
  publishedAt,
  startsAt,
  title,
}: {
  content: string;
  expectedEndAt?: Date;
  now: Date;
  publishedAt: Date;
  startsAt?: Date;
  title: string;
}) {
  if (expectedEndAt && expectedEndAt < now) return "expired" as const;
  if (startsAt && startsAt > now) return "scheduled" as const;
  if (restorationPattern.test(`${title} ${content}`) && !expectedEndAt) return "expired" as const;
  return now > addDays(endOfLocalDay(publishedAt), 1) ? ("expired" as const) : ("active" as const);
}

function parseDate(value: string, defaultYear: number) {
  const numeric = /\b(\d{1,2})[.\-/](\d{1,2})[.\-/](\d{2,4})\b/.exec(value);
  if (numeric) {
    const year = numeric[3].length === 2 ? 2000 + Number(numeric[3]) : Number(numeric[3]);
    return createDate(year, Number(numeric[2]) - 1, Number(numeric[1]));
  }
  const named = /\b(\d{1,2})\.?\s+(\p{L}+)(?:\s+(\d{4}))?\b/iu.exec(value);
  if (!named) return undefined;
  const month = monthNumbers[named[2].toLocaleLowerCase("sr-Latn-ME")];
  return month === undefined ? undefined : createDate(Number(named[3] ?? defaultYear), month, Number(named[1]));
}

function createDate(year: number, month: number, day: number) {
  const date = new Date(Date.UTC(year, month, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month && date.getUTCDate() === day
    ? date
    : undefined;
}

function parseTime(value: string) {
  const [hours, minutes = "0"] = value.replace(".", ":").split(":");
  const hour = Number(hours);
  const minute = Number(minutes);
  return Number.isInteger(hour) && Number.isInteger(minute) && hour <= 23 && minute <= 59
    ? { hour, minute }
    : null;
}

function withLocalTime(date: Date, time: { hour: number; minute: number }) {
  const utc = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate(), time.hour, time.minute);
  const offset = getPodgoricaOffset(new Date(utc));
  return new Date(utc - offset);
}

function getPodgoricaOffset(value: Date) {
  const name = new Intl.DateTimeFormat("en", {
    timeZone: "Europe/Podgorica",
    timeZoneName: "longOffset",
  })
    .formatToParts(value)
    .find(({ type }) => type === "timeZoneName")?.value;
  const match = /GMT([+-])(\d{2}):(\d{2})/.exec(name ?? "");
  return match
    ? (Number(match[2]) * 60 + Number(match[3])) * 60_000 * (match[1] === "+" ? 1 : -1)
    : 0;
}

function toVikpgUrl(value: string) {
  try {
    const url = new URL(value.replace(/&amp;/gi, "&"), vikpgOrigin);
    return url.protocol === "https:" && ["vikpg.me", "www.vikpg.me"].includes(url.hostname)
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function stripHtml(value: string) {
  return value
    .replace(/<\/(?:p|li|div|h[1-6]|br)\s*>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&");
}
function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim();
}
function deduplicateLinks(items: VikpgNoticeLink[]) {
  return [...new Map(items.map((item) => [item.url, item])).values()];
}
function startOfDay(value: Date) {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}
function endOfLocalDay(value: Date) {
  return withLocalTime(value, { hour: 23, minute: 59 });
}
function addDays(value: Date, days: number) {
  const next = new Date(value);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

export {
  discoverVikpgNotices,
  parseVikpgNotice,
  toVikpgUrl,
  vikpgOrigin,
  vikpgWaterNoticesUrl,
  type VikpgNoticeLink,
  type VikpgParseResult,
};
