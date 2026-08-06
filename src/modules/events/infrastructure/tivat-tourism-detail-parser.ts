import { extractEventContentText } from "./event-html-content.ts";

interface TivatTourismEventDetail {
  description?: string;
  venueName?: string;
}

// Tivat Tourism writes its event facts as an emoji-prefixed block inside the article body:
//
//   📅 5. avgust 2026.
//   📍 Trg u Radovićima, Krtoli
//   🕘 21:00 h
//   🎟️ Ulaz slobodan
//
// Audited across six live detail pages: three carry the block (11. Srpski Sabor, Koncert Marije
// Mikić, Lastovska fešta) in exactly this shape, and three state the place only inside prose
// ("na glavnom pristaništu u Krašićima"). The marker is therefore treated as the one reliable
// location signal: where it exists the value is taken verbatim, and where it does not, no venue
// is inferred from prose — guessing a place out of a sentence is not a fact the source asserted.
const locationMarker = "📍";
// Tivat Tourism renders every event body inside this container. Requiring it is what keeps a soft
// error page — which still answers 200 and still has a heading — from being read as an event
// description: without the container there is no event content on the page, so nothing is taken.
const articleBodyPattern = /\bwp_editor\b/i;
const factMarkers = ["📅", "📍", "🕘", "🕐", "🎟️", "🎟", "💶", "💰", "🎫"];

function parseTivatTourismEventDetail(html: string): TivatTourismEventDetail {
  if (!articleBodyPattern.test(html)) return {};

  const lines = extractEventContentText(html)
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const description = getDescription(lines);
  const venueName = getVenueName(lines);
  return {
    ...(description ? { description } : {}),
    ...(venueName ? { venueName } : {}),
  };
}

// Verbatim, minus the marker itself. "Trg u Radovićima, Krtoli" stays exactly that: it is not
// split into a hierarchy, not turned into a street address, and no coordinates are derived —
// the source states a place name, so a place name is what we store.
function getVenueName(lines: readonly string[]) {
  const line = lines.find((candidate) => candidate.startsWith(locationMarker));
  if (!line) return undefined;

  const value = line.slice(locationMarker.length).replace(/^[\s:–-]+/u, "").trim();
  return value || undefined;
}

// The prose the source wrote, with the fact block removed: the date, time, location and
// admission lines are facts that belong in their own fields (or, for admission, nowhere yet),
// and repeating them inside the description would be boilerplate. Trailing hashtag lines are
// social-media markup rather than description text. Nothing is summarised or rewritten.
function getDescription(lines: readonly string[]) {
  const prose = lines.filter(
    (line) => !factMarkers.some((marker) => line.startsWith(marker)) && !line.startsWith("#"),
  );
  const value = prose.join(" ").replace(/\s+/gu, " ").trim();
  return value || undefined;
}

export { parseTivatTourismEventDetail, type TivatTourismEventDetail };
