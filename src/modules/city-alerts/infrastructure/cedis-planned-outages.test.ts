import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  discoverCedisArticles,
  getPodgoricaSection,
  parseCedisArticle,
  parseTimeRange,
} from "./cedis-planned-outages.ts";

const fixture = (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

test("discovers only planned-work listing links", async () => {
  const articles = discoverCedisArticles(
    await fixture("listing.html"),
    new Date("2026-03-29T12:00:00Z"),
  );
  assert.equal(articles.length, 1);
  assert.equal(articles[0].url, "https://cedis.me/planirani-radovi-za-30-mart/");
});

test("isolates Podgorica and stops at the next municipality", async () => {
  const html = await fixture("multi-municipality.html");
  const section = getPodgoricaSection(html.replace(/<[^>]+>/g, " "));
  assert.ok(section?.includes("Zabjelo"));
  assert.ok(!section?.includes("Nikšić"));
});

test("parses multiple time formats and DST-aware timestamps", () => {
  assert.deepEqual(parseTimeRange("od 08 do 15 sati")?.start, { hour: 8, minute: 0 });
  assert.deepEqual(parseTimeRange("08.30 do 13 sati")?.end, { hour: 13, minute: 0 });
  assert.deepEqual(parseTimeRange("8h do 15h")?.end, { hour: 15, minute: 0 });
});

test("keeps valid Podgorica entries when a later entry is malformed", async () => {
  const article = {
    title: "Planirani radovi za 30. mart",
    url: "https://cedis.me/planirani-radovi-za-30-mart/",
  };
  const alerts = parseCedisArticle(
    article,
    await fixture("multi-municipality.html"),
    new Date("2026-03-30T12:00:00Z"),
  );
  assert.ok(alerts.length >= 2);
  assert.ok(alerts.every((alert) => alert.affectedArea.kind === "source"));
});

test("assigns each Podgorica entry its own date in a multi-date article", async () => {
  const alerts = parseCedisArticle(
    {
      title: "Planirani radovi za 30. i 31. mart",
      url: "https://cedis.me/planirani-radovi-za-30-i-31-mart/",
    },
    await fixture("multi-date-municipalities.html"),
    new Date("2026-03-29T12:00:00Z"),
  );

  assert.equal(alerts.length, 2);
  assert.deepEqual(
    alerts.map((alert) => alert.affectedArea.kind === "source" && alert.affectedArea.value),
    ["Donja Gorica.", "Konik."],
  );
  assert.deepEqual(
    alerts.map((alert) => alert.startsAt?.toISOString()),
    ["2026-03-30T06:00:00.000Z", "2026-03-31T06:30:00.000Z"],
  );
  assert.ok(alerts.every((alert) => !alert.rawSourceText?.includes("Nikšić")));
});
