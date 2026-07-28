import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  discoverCedisArticles,
  getMunicipalitySections,
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

test("uses the supplied now value for deterministic outage status", async () => {
  const article = {
    title: "Planirani radovi na mreži za 22. jul",
    url: "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-22-jul/",
  };
  const html = await fixture("cedis-bare-municipality-heading.html");
  const now = new Date("2026-07-21T12:00:00Z");

  const first = parseCedisArticle(article, html, now);
  const second = parseCedisArticle(article, html, now);

  assert.deepEqual(
    first.map((alert) => alert.status),
    second.map((alert) => alert.status),
  );
  assert.ok(first.every((alert) => alert.status === "scheduled"));
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

test("extracts only the requested allowlisted municipality from one CEDIS article", async () => {
  const article = {
    title: "Planirani radovi za 30. mart",
    url: "https://cedis.me/planirani-radovi-za-30-mart/",
  };
  const html = await fixture("cedis-podgorica-budva.html");

  const podgorica = parseCedisArticle(article, html, "podgorica", fixedNow());
  const budva = parseCedisArticle(article, html, "budva", fixedNow());

  assert.deepEqual(
    podgorica.map((alert) => alert.affectedArea.kind === "source" && alert.affectedArea.value),
    ["Zabjelo."],
  );
  assert.deepEqual(
    budva.map((alert) => alert.affectedArea.kind === "source" && alert.affectedArea.value),
    ["Pržno i Sveti Stefan."],
  );
  assert.ok(podgorica.every((alert) => alert.cityIds.every((cityId) => cityId === "podgorica")));
  assert.ok(budva.every((alert) => alert.cityIds.every((cityId) => cityId === "budva")));
});

test("handles Budva before Podgorica without cross-city leakage", async () => {
  const article = {
    title: "Planirani radovi za 30. mart",
    url: "https://cedis.me/planirani-radovi-za-30-mart/",
  };
  const html = await fixture("cedis-budva-before-podgorica.html");

  const budva = parseCedisArticle(article, html, "budva", fixedNow());
  const podgorica = parseCedisArticle(article, html, "podgorica", fixedNow());

  assert.equal(
    budva[0]?.affectedArea.kind === "source" && budva[0].affectedArea.value,
    "Petrovac.",
  );
  assert.equal(
    podgorica[0]?.affectedArea.kind === "source" && podgorica[0].affectedArea.value,
    "Konik.",
  );
});

test("does not treat a city name in normal prose as a municipality heading", () => {
  const extraction = getMunicipalitySections(
    "U nastavku je navedena Budva kao primjer, bez posebnog naslova.\nNikšić\nOd 08 do 12 sati: Centar.",
    "budva",
  );

  assert.equal(extraction.state, "not-found");
});

test("extracts a Tivat municipality section bounded by its neighboring headings", () => {
  const extraction = getMunicipalitySections(
    "Budva\nOd 08 do 12 sati: Centar.\nTivat\nOd 09 do 13 sati: Donja Lastva.\nKotor\nOd 10 do 14 sati: Centar.",
    "tivat",
  );

  assert.equal(extraction.state, "found");
  assert.equal(extraction.sections.length, 1);
  assert.match(extraction.sections[0]!.section, /Donja Lastva/u);
  assert.doesNotMatch(extraction.sections[0]!.section, /Centar/u);
});

test("also recognizes the formal 'Opština Tivat' heading variant", () => {
  const extraction = getMunicipalitySections(
    "Opština Tivat\nOd 09 do 13 sati: Donja Lastva.\nKotor\nOd 10 do 14 sati: Centar.",
    "tivat",
  );

  assert.equal(extraction.state, "found");
  assert.match(extraction.sections[0]!.section, /Donja Lastva/u);
});

test("returns a safe not-found result for an unavailable municipality section", async () => {
  const result = parseCedisArticleResult(
    {
      title: "Planirani radovi za 30. mart",
      url: "https://cedis.me/planirani-radovi-za-30-mart/",
    },
    await fixture("multi-municipality.html"),
    "budva",
    fixedNow(),
  );

  assert.equal(result.extractionState, "municipality-section-not-found");
  assert.equal(result.alerts.length, 0);
  assert.equal(result.zeroRecordsReason, "municipality-section-not-found");
});

test("rejects unsupported municipality extraction", async () => {
  const result = parseCedisArticleResult(
    {
      title: "Planirani radovi za 30. mart",
      url: "https://cedis.me/planirani-radovi-za-30-mart/",
    },
    await fixture("multi-municipality.html"),
    "bar",
    fixedNow(),
  );

  assert.equal(result.extractionState, "unsupported-city");
  assert.equal(result.alerts.length, 0);
});

test("distinguishes no recognized municipality headings from a benign per-city mismatch", () => {
  const otherCityFound = getMunicipalitySections(
    "Nikšić\nOd 08 do 12 sati: Centar.",
    "budva",
  );
  assert.equal(otherCityFound.state, "not-found");

  const noHeadingsAtAll = getMunicipalitySections(
    "Obavještenje o planiranim radovima bez navedenih opština.",
    "budva",
  );
  assert.equal(noHeadingsAtAll.state, "no-headings");
});

test("flags an article with no recognizable municipality heading as structurally suspicious, not a benign mismatch", () => {
  const result = parseCedisArticleResult(
    {
      title: "Planirani radovi za 30. mart",
      url: "https://cedis.me/planirani-radovi-za-30-mart/",
    },
    "<article><p>Obavještenje o planiranim radovima bez navedenih opština.</p></article>",
    "budva",
    fixedNow(),
  );

  assert.equal(result.extractionState, "no-municipality-headings-recognized");
  assert.equal(result.alerts.length, 0);
  assert.equal(result.zeroRecordsReason, "no-municipality-headings-recognized");
  assert.deepEqual(result.warnings, ["no-municipality-headings-recognized"]);
});

test("rejects an ambiguous municipality boundary instead of guessing", async () => {
  const result = parseCedisArticleResult(
    {
      title: "Planirani radovi za 30. mart",
      url: "https://cedis.me/planirani-radovi-za-30-mart/",
    },
    await fixture("cedis-ambiguous-municipality.html"),
    "budva",
    fixedNow(),
  );

  assert.equal(result.extractionState, "ambiguous-section-boundaries");
  assert.deepEqual(result.alerts, []);
});

function fixedNow() {
  return new Date("2026-03-29T12:00:00.000Z");
}
