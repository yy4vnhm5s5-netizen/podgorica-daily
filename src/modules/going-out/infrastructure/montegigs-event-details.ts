import { decodeHtmlEntities } from "../domain/going-out-event.ts";

interface MonteGigsEventDetail {
  address?: string;
  description?: string;
  informationUrl?: string;
  organizer?: string;
}

interface MonteGigsDetailParserInput {
  sourceEventId: string;
  sourceUrl: string;
  venue?: string;
}

function parseMonteGigsEventDetail(
  html: string,
  { sourceEventId, sourceUrl, venue }: MonteGigsDetailParserInput,
): MonteGigsEventDetail {
  const structured = extractMatchingMusicEvent(html, sourceEventId);
  const visibleDescription = extractSectionText(html, "opis");
  const visibleAddress = extractExplicitAddress(html, venue);
  const visibleOrganizer = extractSectionText(html, "organizator");
  const informationUrl = extractInformationUrl(html, sourceUrl);
  const description = selectDescription(structured?.description, visibleDescription);
  const address = normalizeAddress(structured?.address, venue) ?? visibleAddress;
  const organizer =
    normalizeOrganizer(structured?.organizer) ?? normalizeOrganizer(visibleOrganizer);

  return {
    ...(description ? { description } : {}),
    ...(address ? { address } : {}),
    ...(organizer ? { organizer } : {}),
    ...(informationUrl ? { informationUrl } : {}),
  };
}

function extractMatchingMusicEvent(html: string, sourceEventId: string) {
  for (const serialized of html.matchAll(
    /<script\b[^>]*\btype=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi,
  )) {
    try {
      const candidates = flattenJsonLd(JSON.parse(serialized[1] ?? "")).filter(
        (candidate): candidate is Record<string, unknown> =>
          isRecord(candidate) && hasMusicEventType(candidate["@type"]),
      );
      const exactMatch = candidates.find((candidate) =>
        matchesSourceEvent(candidate, sourceEventId),
      );
      const unambiguousUnkeyedMatch =
        candidates.length === 1 && knownSourceEventIds(candidates[0]!).length === 0
          ? candidates[0]
          : undefined;
      const candidate = exactMatch ?? unambiguousUnkeyedMatch;
      if (!candidate) continue;

      return {
        ...(normalizeDetailText(candidate.description)
          ? { description: normalizeDetailText(candidate.description) }
          : {}),
        ...(extractStructuredAddress(candidate.location)
          ? { address: extractStructuredAddress(candidate.location) }
          : {}),
        ...(extractOrganizer(candidate.organizer)
          ? { organizer: extractOrganizer(candidate.organizer) }
          : {}),
      };
    } catch {
      // JSON-LD is an optional detail enhancement. The labelled source HTML remains available.
    }
  }

  return undefined;
}

function flattenJsonLd(value: unknown): unknown[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!isRecord(value)) return [];
  return [value, ...flattenJsonLd(value["@graph"])];
}

function hasMusicEventType(value: unknown) {
  return (Array.isArray(value) ? value : [value]).includes("MusicEvent");
}

function matchesSourceEvent(value: Record<string, unknown>, sourceEventId: string) {
  const detailIds = knownSourceEventIds(value);
  return detailIds.length > 0 && detailIds.every((detailId) => detailId === sourceEventId);
}

function knownSourceEventIds(value: Record<string, unknown>) {
  const eventUrls = [value["@id"], value.url].flatMap((candidate) =>
    typeof candidate === "string" ? [candidate] : [],
  );
  return eventUrls.flatMap((url) => {
    const match = /\/me\/events\/[a-z0-9-]+\/(\d+)-\d{8}-/iu.exec(url);
    return match?.[1] ? [match[1]] : [];
  });
}

function extractStructuredAddress(value: unknown) {
  const location = isRecord(value) ? value : undefined;
  const address = location && isRecord(location.address) ? location.address : undefined;
  if (!address) return undefined;

  return normalizeAddress(
    [address.streetAddress, address.postalCode, address.addressLocality, address.addressRegion]
      .flatMap((part) => (typeof part === "string" ? [part] : []))
      .join(", "),
  );
}

function extractOrganizer(value: unknown) {
  if (typeof value === "string") return normalizeOrganizer(value);
  return isRecord(value) ? normalizeOrganizer(value.name) : undefined;
}

function extractSectionText(html: string, heading: string) {
  const section = new RegExp(
    `<h[2-4]\\b[^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h[2-4]>([\\s\\S]*?)(?=<h[2-4]\\b|<(?:address|aside|footer|nav)\\b|<\\/(?:main|article|section)>|$)`,
    "iu",
  ).exec(html)?.[1];
  return section ? normalizeDetailText(stripHtml(section)) : undefined;
}

function extractExplicitAddress(html: string, venue: string | undefined) {
  const addresses = [...html.matchAll(/<address\b[^>]*>([\s\S]*?)<\/address>/giu)].flatMap(
    (match) => {
      const address = normalizeAddress(stripHtml(match[1] ?? ""), venue);
      return address ? [address] : [];
    },
  );
  return addresses.length === 1 ? addresses[0] : undefined;
}

function extractInformationUrl(html: string, sourceUrl: string) {
  const linksSection = extractSectionHtml(html, "linkovi");
  if (!linksSection) return undefined;

  for (const link of linksSection.matchAll(
    /<a\b[^>]*\bhref=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/giu,
  )) {
    if (
      normalizeDetailText(stripHtml(link[2] ?? ""))?.toLocaleLowerCase("sr-Latn-ME") !==
      "sajt događaja"
    ) {
      continue;
    }

    const value = normalizeExternalInformationUrl(link[1], sourceUrl);
    if (value) return value;
  }

  return undefined;
}

function extractSectionHtml(html: string, heading: string) {
  return new RegExp(
    `<h[2-4]\\b[^>]*>\\s*${escapeRegExp(heading)}\\s*<\\/h[2-4]>([\\s\\S]*?)(?=<h[2-4]\\b|<(?:address|aside|footer|nav)\\b|<\\/(?:main|article|section)>|$)`,
    "iu",
  ).exec(html)?.[1];
}

function selectDescription(structured: string | undefined, visible: string | undefined) {
  const normalizedStructured = normalizeDetailText(stripHtml(structured ?? ""));
  const normalizedVisible = normalizeDetailText(visible);
  if (normalizedStructured && normalizedVisible && normalizedStructured !== normalizedVisible) {
    return normalizedVisible;
  }
  return normalizedStructured ?? normalizedVisible;
}

function normalizeAddress(value: string | undefined, venue?: string) {
  const address = normalizeDetailText(value);
  if (!address || address.length > 500 || sameText(address, venue)) return undefined;
  return address;
}

function normalizeOrganizer(value: unknown) {
  const organizer = normalizeDetailText(value);
  return organizer && organizer.length <= 250 ? organizer : undefined;
}

function normalizeExternalInformationUrl(value: string | undefined, sourceUrl: string) {
  if (!value) return undefined;
  try {
    const url = new URL(value, sourceUrl);
    const source = new URL(sourceUrl);
    if (url.protocol !== "https:" || url.toString() === source.toString()) return undefined;
    if (url.hostname === source.hostname) return undefined;
    return url.toString();
  } catch {
    return undefined;
  }
}

function normalizeDetailText(value: unknown) {
  if (typeof value !== "string") return undefined;
  const normalized = stripHtml(value)
    .replace(/\s+/gu, " ")
    .replace(/^[-–—\s]+|[-–—\s]+$/gu, "")
    .trim();
  if (!normalized || normalized.length > 4_000 || isBoilerplate(normalized)) return undefined;
  return normalized;
}

function isBoilerplate(value: string) {
  return /^(?:detalji događaja|pratite montegigs na društvenim mrežama|opis|linkovi|organizator)$/iu.test(
    value,
  );
}

function stripHtml(value: string) {
  return decodeHtmlEntities(value.replace(/<[^>]+>/gu, " "));
}

function sameText(left: string, right: string | undefined) {
  return Boolean(
    right && left.toLocaleLowerCase("sr-Latn-ME") === right.toLocaleLowerCase("sr-Latn-ME"),
  );
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export { parseMonteGigsEventDetail, type MonteGigsEventDetail, type MonteGigsDetailParserInput };
