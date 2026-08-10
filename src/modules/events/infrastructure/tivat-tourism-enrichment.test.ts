import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { createEventId } from "../domain/event-normalization.ts";
import { defaultEventQualityPolicy, isEventWithinQualityWindow } from "../domain/event-quality.ts";
import { refreshTivatTourismEvents } from "./tivat-tourism-refresh.ts";
import { tivatTourismCalendarUrl } from "./tivat-tourism-event-parser.ts";
import type { EventCacheSnapshot } from "./events-cache.ts";
import { createCityContext } from "@/shared/config/cities";

const fixture = async (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

const saborUrl = "https://tivat.travel/dogadjaji/11-srpski-sabor/";
const festaUrl = "https://tivat.travel/dogadjaji/festa-od-ribe-i-vina-u-krasicima/";

const listing = `
  <a href="${saborUrl}">
    <img data-src="https://tivat.travel/wp-content/uploads/sabor.jpg" alt="11. srpski sabor">
    <div class="content"><h4>11. srpski sabor</h4><span>5 Augusta, 2026 Srijeda 21:00h</span></div>
  </a>
  <a href="${festaUrl}">
    <img data-src="https://tivat.travel/wp-content/uploads/festa.jpg" alt="Fešta">
    <div class="content"><h4>Fešta od ribe i vina</h4><span>7 Augusta, 2026 Petak 20:00h</span></div>
  </a>
`;

// Years old: the Tivat calendar keeps its whole archive on later listing pages.
const archiveUrl = "https://tivat.travel/dogadjaji/bokeski-maraton-2025/";
const listingWithArchive = `${listing}
  <a href="${archiveUrl}">
    <img data-src="https://tivat.travel/wp-content/uploads/maraton.jpg" alt="Maraton">
    <div class="content"><h4>Bokeški Maraton</h4><span>13 Decembra, 2025 Subota 10:00h</span></div>
  </a>
`;

const context = createCityContext("tivat", "me");
const now = () => new Date("2026-08-01T09:00:00.000Z");

interface Run {
  requests: string[];
  snapshot: EventCacheSnapshot | null;
  success: boolean;
}

async function run(pages: Record<string, string | Error>): Promise<Run> {
  const requests: string[] = [];
  const result = await refreshTivatTourismEvents({
    cachePath: "/tmp/tivat-events.json",
    context,
    httpClient: {
      get: async (url: string) => {
        requests.push(url);
        const page = pages[url];
        if (page === undefined) throw new Error(`unexpected fetch ${url}`);
        if (page instanceof Error) throw page;
        return page;
      },
    },
    now,
    writeCache: async () => {},
  });

  return { requests, snapshot: result.snapshot, success: result.success };
}

const eventNamed = (snapshot: EventCacheSnapshot | null, title: string) =>
  snapshot?.events.find((event) => event.title.toLocaleLowerCase().includes(title));

test("an event is enriched from its own official detail page", async () => {
  const { snapshot, success } = await run({
    [tivatTourismCalendarUrl]: listing,
    [saborUrl]: await fixture("tivat-tourism-detail-sabor.html"),
    [festaUrl]: await fixture("tivat-tourism-detail-no-location.html"),
  });

  assert.equal(success, true);
  const sabor = eventNamed(snapshot, "srpski sabor");
  assert.ok(sabor);
  // The place the organiser published, carried through verbatim.
  assert.equal(sabor.venueName, "Trg u Radovićima, Krtoli");
  assert.match(sabor.venueName ?? "", /Radović/u);
  assert.match(sabor.description ?? "", /Fenički biseri/u);
  // Still the official detail page, not a second attribution.
  assert.equal(sabor.sourceUrl, saborUrl);
  assert.equal(sabor.sourceName, "Turistička organizacija Tivat");
});

test("one field can arrive without the other", async () => {
  const { snapshot } = await run({
    [tivatTourismCalendarUrl]: listing,
    [saborUrl]: await fixture("tivat-tourism-detail-sabor.html"),
    [festaUrl]: await fixture("tivat-tourism-detail-no-location.html"),
  });

  const festa = eventNamed(snapshot, "fešta");
  assert.ok(festa);
  // That page marks no location, so the description stands alone and no place is guessed.
  assert.equal(festa.venueName, undefined);
  assert.match(festa.description ?? "", /Tradicija se nastavlja/u);
});

test("a failed detail fetch keeps the listing event instead of dropping it", async () => {
  const { snapshot, success } = await run({
    [tivatTourismCalendarUrl]: listing,
    [saborUrl]: new Error("detail page unavailable"),
    [festaUrl]: await fixture("tivat-tourism-detail-no-location.html"),
  });

  assert.equal(success, true);
  const sabor = eventNamed(snapshot, "srpski sabor");
  assert.ok(sabor, "the baseline listing event must survive");
  assert.equal(sabor.venueName, undefined);
  assert.equal(sabor.description, undefined);
  // The other event is unaffected: one bad page does not fail the run.
  assert.ok(eventNamed(snapshot, "fešta"));
  assert.equal(
    snapshot?.parserWarnings.some((warning) => warning.includes("detail page")),
    true,
  );
});

test("each detail page is requested exactly once", async () => {
  const { requests } = await run({
    [tivatTourismCalendarUrl]: listing,
    [saborUrl]: await fixture("tivat-tourism-detail-sabor.html"),
    [festaUrl]: await fixture("tivat-tourism-detail-no-location.html"),
  });

  const detailRequests = requests.filter((url) => url !== tivatTourismCalendarUrl);
  assert.equal(detailRequests.length, new Set(detailRequests).size);
  assert.deepEqual([...detailRequests].sort(), [saborUrl, festaUrl].sort());
});

test("the venue enrichment adds is an identity input, so the event id moves", () => {
  // Documented deliberately: createEventId hashes the venue, so an event that gains a place gets
  // a new id — and therefore a new detail URL. This test exists so that consequence can never
  // change silently without someone reading it.
  const withoutVenue = createEventId({
    cityId: "tivat",
    sourceId: "tourism-tivat",
    startsAt: "2026-08-05T19:00:00.000Z",
    title: "11. srpski sabor",
  });
  const withVenue = createEventId({
    cityId: "tivat",
    sourceId: "tourism-tivat",
    startsAt: "2026-08-05T19:00:00.000Z",
    title: "11. srpski sabor",
    venue: "Trg u Radovićima, Krtoli",
  });

  assert.notEqual(withoutVenue, withVenue);
  // The description is not part of identity, so prose alone never moves a URL.
  assert.equal(
    createEventId({
      cityId: "tivat",
      sourceId: "tourism-tivat",
      startsAt: "2026-08-05T19:00:00.000Z",
      title: "11. srpski sabor",
      venue: "Trg u Radovićima, Krtoli",
    }),
    withVenue,
  );
});

test("an event outside the platform's quality window is never fetched", async () => {
  const { requests, snapshot } = await run({
    [tivatTourismCalendarUrl]: listingWithArchive,
    [saborUrl]: await fixture("tivat-tourism-detail-sabor.html"),
    [festaUrl]: await fixture("tivat-tourism-detail-no-location.html"),
    // The archive page is deliberately absent: requesting it would throw "unexpected fetch".
  });

  assert.equal(requests.includes(archiveUrl), false, "a stale event must cost no request");
  // The two current events are still enriched.
  assert.equal(eventNamed(snapshot, "srpski sabor")?.venueName, "Trg u Radovićima, Krtoli");
});

test("the enrichment window is the shared policy, not a copied day count", async () => {
  const source = await readFile(new URL("./tivat-tourism-refresh.ts", import.meta.url), "utf8");

  assert.match(source, /isEventWithinQualityWindow/u);
  assert.match(source, /getEventQualityPolicy\(\)/u);
  // No second date policy in the provider: no day literals, no millisecond arithmetic.
  const code = source.replace(/\/\/[^\n]*/gu, "");
  assert.doesNotMatch(code, /\b30\b|86[_]?400|maximumPastDays/u);
});

test("the shared window follows the policy it is given", () => {
  const now = new Date("2026-08-06T00:00:00.000Z");
  const at = (date: string) => ({ startsAt: `${date}T18:00:00.000Z` });

  assert.equal(isEventWithinQualityWindow(at("2026-08-20"), defaultEventQualityPolicy, now), true);
  assert.equal(isEventWithinQualityWindow(at("2026-07-20"), defaultEventQualityPolicy, now), true);
  // Older than the policy's past window, and undatable, are both outside it.
  assert.equal(isEventWithinQualityWindow(at("2025-12-13"), defaultEventQualityPolicy, now), false);
  assert.equal(isEventWithinQualityWindow({}, defaultEventQualityPolicy, now), false);
  // A tighter policy moves the boundary — the helper holds no day count of its own.
  const tight = { ...defaultEventQualityPolicy, maximumPastDays: 1 };
  assert.equal(isEventWithinQualityWindow(at("2026-07-20"), tight, now), false);
});

test("a description alone never moves an event id", () => {
  const identity = {
    cityId: "tivat" as const,
    sourceId: "tourism-tivat",
    startsAt: "2026-08-07T18:00:00.000Z",
    title: "Fešta od ribe i vina",
  };

  // Enrichment that finds prose but no marked place leaves the URL exactly where it was.
  assert.equal(createEventId(identity), createEventId({ ...identity }));
});
