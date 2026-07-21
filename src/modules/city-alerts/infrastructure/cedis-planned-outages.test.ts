import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  discoverCedisArticles,
  getPodgoricaSection,
  parseCedisArticle,
  parseCedisArticleResult,
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

test("parses a bare Podgorica heading from the current CEDIS article structure", async () => {
  const alerts = parseCedisArticle(
    {
      title: "Planirani radovi na mreži za 22. jul",
      url: "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-22-jul/",
    },
    await fixture("cedis-bare-municipality-heading.html"),
    new Date("2026-07-21T12:00:00Z"),
  );

  assert.deepEqual(
    alerts.map((alert) => alert.affectedArea.kind === "source" && alert.affectedArea.value),
    [
      "Ulica Pohorska i Pljevaljska.",
      "Liješta, Dučići, Koći i Radan.",
      "Ulica Raka Mugoše.",
      "Ubli, Živkovići i Prelevići.",
    ],
  );
  assert.deepEqual(
    alerts.map((alert) => alert.startsAt?.toISOString()),
    [
      "2026-07-22T06:00:00.000Z",
      "2026-07-22T06:00:00.000Z",
      "2026-07-22T06:00:00.000Z",
      "2026-07-22T07:00:00.000Z",
    ],
  );
  assert.ok(
    alerts.every(
      (alert) =>
        alert.affectedArea.kind !== "source" || !alert.affectedArea.value.includes("Ponari"),
    ),
  );
});

test("parses the current Elementor post-content container", async () => {
  const result = parseCedisArticleResult(
    {
      title: "Planirani radovi na mreži za 23. jul",
      url: "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-23-jul/",
    },
    await fixture("cedis-elementor-theme-post-content.html"),
    new Date("2026-07-21T12:00:00Z"),
  );

  assert.equal(result.contentSelector, ".elementor-widget-theme-post-content");
  assert.equal(result.podgoricaHeadingFound, true);
  assert.equal(result.zeroRecordsReason, undefined);
  assert.deepEqual(
    result.alerts.map((alert) => alert.affectedArea.kind === "source" && alert.affectedArea.value),
    [
      "hangari uz magistralu oko Kipsa-Cijevna.",
      "Liješnje, Vrbica, IRD Šume, naselje oko Vinopodruma, dio Tološa, Tivatska ulica i Ulica Boška Buhe.",
      "Ulica Raka Mugoše.",
      "Ubli, Živkovići, Ubli Prisoja, Prelevići, Bezjovo, Cvilin, Orahovo, Lazorci, Građen, Toke, Korita i Ulica Pavla Mijovića.",
    ],
  );
});

test("extracts only the article content and ignores embedded asset payloads", async () => {
  const alerts = parseCedisArticle(
    {
      title: "Planirani radovi na mreži za 22. jul",
      url: "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-22-jul/",
    },
    await fixture("cedis-entry-content-with-embedded-assets.html"),
    new Date("2026-07-21T12:00:00Z"),
  );

  assert.deepEqual(
    alerts.map((alert) => alert.affectedArea.kind === "source" && alert.affectedArea.value),
    ["Ulica stvarnog sadržaja."],
  );
  assert.ok(
    alerts.every(
      (alert) =>
        alert.affectedArea.kind !== "source" ||
        !/lazySizesConfig|JavaScript sadržaj|CSS sadržaj|JSON-LD|Noscript|SVG/i.test(
          alert.affectedArea.value,
        ),
    ),
  );
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
