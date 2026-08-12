import assert from "node:assert/strict";
import test from "node:test";

import {
  getMonteGigsCitySource,
  isMonteGigsSupportedCityId,
  monteGigsCitySources,
  parseMonteGigsEvents,
} from "./montegigs-going-out.ts";
import { createCityContext } from "@/shared/config/cities";

test("adds Ulcinj to the MonteGigs allow-list without touching the others", () => {
  assert.equal(isMonteGigsSupportedCityId("ulcinj"), true);
  assert.deepEqual(getMonteGigsCitySource("ulcinj"), {
    cityId: "ulcinj",
    listingUrl: "https://montegigs.me/me/events/ulcinj",
  });
  assert.deepEqual(Object.keys(monteGigsCitySources).sort(), [
    "bar",
    "budva",
    "kotor",
    "podgorica",
    "tivat",
    "ulcinj",
  ]);
  assert.equal(isMonteGigsSupportedCityId("niksic"), false);
});

// The payload time lookup is keyed by the numeric MonteGigs id and is city-agnostic; Ulcinj must
// go through exactly the same path, including the "00:00 means unknown" rule.
test("enriches Ulcinj listings with payload times through the generic path", () => {
  const html = `<main>
      <article class="event-card">
        <a href="/me/events/ulcinj/5501-20260810-koncert"><img src="x.jpg" />Koncert na Adi</a>
        <p>10 avg • Ada Bojana</p>
      </article>
      <article class="event-card">
        <a href="/me/events/ulcinj/5502-20260811-ponoc"><img src="x.jpg" />Ponoćni set</a>
        <p>11 avg • Mala plaža</p>
      </article>
      <article class="event-card">
        <a href="/me/events/ulcinj/5503-20260812-bez"><img src="x.jpg" />Bez vremena</a>
        <p>12 avg • Valdanos</p>
      </article>
    </main>
    <script>self.__next_f.push([1,"\\"events\\":[${[
      ['"21:30"', 5501, "2026-08-10"],
      ['"00:00"', 5502, "2026-08-11"],
      ["null", 5503, "2026-08-12"],
    ]
      .map(
        ([time, id, date]) =>
          `{\\"time\\":${time},\\"end_date\\":\\"\\",\\"id\\":${id},\\"date\\":\\"${date}\\"}`,
      )
      .join(",")}]"])</script>`;
  const parsed = parseMonteGigsEvents(
    html,
    createCityContext("ulcinj"),
    new Date("2026-08-01T10:00:00.000Z"),
  );

  assert.equal(parsed.recognized, true);
  assert.equal(parsed.events.length, 3);
  const byTitle = new Map(parsed.events.map((event) => [event.title, event]));
  // 21:30 local on a summer date is 19:30Z, via the shared timezone utility.
  assert.equal(byTitle.get("Koncert na Adi")?.startsAt, "2026-08-10T19:30:00.000Z");
  // 00:00 stays the source's unset placeholder, and null stays absent.
  assert.equal(byTitle.get("Ponoćni set")?.startsAt, undefined);
  assert.equal(byTitle.get("Bez vremena")?.startsAt, undefined);
  assert.equal(
    parsed.events.every((event) => event.city === "ulcinj"),
    true,
  );
});
