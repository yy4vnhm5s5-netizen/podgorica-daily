import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  discoverCedisArticles,
  getMunicipalitySections,
  getMunicipalitySectionsByHeadingVariants,
  getPodgoricaSection,
  parseCedisArticle,
  parseCedisArticleResult,
  parseServiceDates,
  parseTimeRange,
} from "./cedis-planned-outages.ts";

const fixture = (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

test("discovers only supported CEDIS service-notice listing links", async () => {
  const articles = discoverCedisArticles(
    await fixture("listing.html"),
    new Date("2026-03-29T12:00:00Z"),
  );
  assert.equal(articles.length, 1);
  assert.equal(articles[0].url, "https://cedis.me/planirani-radovi-za-30-mart/");
  assert.equal(articles[0].serviceDate?.toISOString(), "2026-03-30T12:00:00.000Z");
});

test("discovers the CEDIS service-information title family using its service date", () => {
  const articles = discoverCedisArticles(
    '<a href="/servisne-informacije/servisne-informacije-za-11-avgust/">Servisne informacije za 11. avgust</a>',
    new Date("2026-08-10T12:00:00Z"),
  );

  assert.equal(articles.length, 1);
  assert.equal(
    articles[0]?.url,
    "https://cedis.me/servisne-informacije/servisne-informacije-za-11-avgust/",
  );
  assert.equal(articles[0]?.serviceDate?.toISOString(), "2026-08-11T12:00:00.000Z");
});

test("keeps every explicit service date from a multi-day CEDIS title", () => {
  const title = "Planirani radovi na mreži za 10. i 11. avgust";
  const serviceDates = parseServiceDates(title, new Date("2026-08-10T12:00:00Z"));

  assert.deepEqual(
    serviceDates.map((date) => date.toISOString()),
    ["2026-08-10T12:00:00.000Z", "2026-08-11T12:00:00.000Z"],
  );
});

test("keeps a multi-day article eligible on its second explicit service day", () => {
  const listing =
    '<a href="/servisne-informacije/planirani-radovi-na-mrezi-za-10-i-11-avgust/">Planirani radovi na mreži za 10. i 11. avgust</a>';
  const articles = discoverCedisArticles(listing, new Date("2026-08-11T12:00:00Z"));

  assert.equal(articles.length, 1);
  assert.equal(articles[0]?.serviceDate?.toISOString(), "2026-08-11T12:00:00.000Z");
  assert.deepEqual(
    articles[0]?.serviceDates?.map((date) => date.toISOString()),
    ["2026-08-10T12:00:00.000Z", "2026-08-11T12:00:00.000Z"],
  );
});

test("rejects unrelated or malformed dated CEDIS listing titles", () => {
  const listing = [
    '<a href="/servisne-informacije/obavjestenje-za-11-avgust/">Obavještenje za 11. avgust</a>',
    '<a href="/servisne-informacije/servisne-informacije-za-uskoro/">Servisne informacije za uskoro</a>',
    '<a href="/servisne-informacije/servisne-informacije-za-32-avgust/">Servisne informacije za 32. avgust</a>',
  ].join("");

  assert.deepEqual(discoverCedisArticles(listing, new Date("2026-08-10T12:00:00Z")), []);
});

test("selects only the nearest current-or-next daily schedule and excludes yesterday's notice", () => {
  const articles = discoverCedisArticles(
    [
      '<a href="/servisne-informacije/planirani-radovi-na-mrezi-za-01-avgust/">Planirani radovi na mreži za 01. avgust</a>',
      '<a href="/servisne-informacije/planirani-radovi-na-mrezi-za-02-avgust/">Planirani radovi na mreži za 02. avgust</a>',
      '<a href="/servisne-informacije/planirani-radovi-na-mrezi-za-03-avgust/">Planirani radovi na mreži za 03. avgust</a>',
    ].join(""),
    new Date("2026-08-02T12:00:00Z"),
  );

  assert.deepEqual(
    articles.map(({ url }) => url),
    ["https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-02-avgust/"],
  );
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

test("uses the explicit service date, not the visible publication date, for every supported city section", async () => {
  const article = {
    serviceDate: new Date("2026-08-11T12:00:00.000Z"),
    serviceDates: [new Date("2026-08-11T12:00:00.000Z")],
    title: "Servisne informacije za 11. avgust",
    url: "https://cedis.me/servisne-informacije/servisne-informacije-za-11-avgust/",
  };
  const html = await fixture("cedis-august-11-service-information.html");
  const expectedAreas = {
    bar: "Šušanj.",
    budva: "Pržno.",
    kotor: "Dobrota.",
    podgorica: "Zabjelo.",
    ulcinj: "Pinješ.",
  } as const;

  for (const [cityId, expectedArea] of Object.entries(expectedAreas) as [
    keyof typeof expectedAreas,
    string,
  ][]) {
    const alerts = parseCedisArticle(article, html, cityId, new Date("2026-08-10T12:00:00Z"));

    assert.deepEqual(
      alerts.map((alert) => alert.affectedArea.kind === "source" && alert.affectedArea.value),
      [expectedArea],
      cityId,
    );
    assert.deepEqual(
      alerts.map((alert) => alert.startsAt?.toISOString().slice(0, 10)),
      ["2026-08-11"],
      cityId,
    );
    assert.ok(
      alerts.every((alert) => alert.cityIds.length === 1 && alert.cityIds[0] === cityId),
      cityId,
    );
  }
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

test("extracts the Bar section from the approved CEDIS Bar-only fixture", async () => {
  const article = {
    title: "Planirani radovi na mreži za 02. avgust",
    url: "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-02-avgust/",
  };

  const alerts = parseCedisArticle(
    article,
    await fixture("cedis-august-2-bar-only.html"),
    "bar",
    new Date("2026-08-02T00:00:00Z"),
  );

  assert.deepEqual(
    alerts.map((alert) => alert.affectedArea.kind === "source" && alert.affectedArea.value),
    ["Centar."],
  );
  assert.ok(alerts.every((alert) => alert.cityIds.every((cityId) => cityId === "bar")));
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

test("extracts Kotor outages without leaking neighboring municipality sections", () => {
  const extraction = getMunicipalitySections(
    "Budva\nOd 08 do 12 sati: Centar.\nKotor\nOd 10 do 14 sati: Škaljari.\nTivat\nOd 09 do 13 sati: Donja Lastva.",
    "kotor",
  );

  assert.equal(extraction.state, "found");
  assert.match(extraction.sections[0]!.section, /Škaljari/u);
  assert.doesNotMatch(extraction.sections[0]!.section, /Donja Lastva/u);
});

test("treats Andrijevica as a municipality boundary around the Kotor section", async () => {
  const article = {
    serviceDate: new Date("2026-08-02T12:00:00.000Z"),
    title: "Planirani radovi za 3. avgust",
    url: "https://cedis.me/servisne-informacije/planirani-radovi-za-3-avgust/",
  };
  const html = await fixture("cedis-andrijevica-kotor-tivat.html");

  const kotor = parseCedisArticle(article, html, "kotor", fixedNow());
  const andrijevica = getMunicipalitySectionsByHeadingVariants(html.replace(/<[^>]+>/g, " "), [
    "Andrijevica",
  ]);

  assert.deepEqual(
    kotor.map((alert) => alert.affectedArea.kind === "source" && alert.affectedArea.value),
    ["Glavatičići – dio korisnika."],
  );
  assert.ok(kotor.every((alert) => alert.cityIds.every((cityId) => cityId === "kotor")));
  assert.ok(
    kotor.every(
      (alert) =>
        alert.affectedArea.kind === "source" && !alert.affectedArea.value.includes("Andrijevica"),
    ),
  );
  assert.ok(
    kotor.every(
      (alert) =>
        alert.affectedArea.kind === "source" && !alert.affectedArea.value.includes("Donja Lastva"),
    ),
  );

  assert.equal(andrijevica.state, "found");
  assert.equal(andrijevica.sections.length, 1);
  assert.match(andrijevica.sections[0]!.section, /Trešnjevik/u);
  assert.doesNotMatch(andrijevica.sections[0]!.section, /Glavatičići|Donja Lastva/u);
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
    "niksic",
    fixedNow(),
  );

  assert.equal(result.extractionState, "unsupported-city");
  assert.equal(result.alerts.length, 0);
});

test("distinguishes no recognized municipality headings from a benign per-city mismatch", () => {
  const otherCityFound = getMunicipalitySections("Nikšić\nOd 08 do 12 sati: Centar.", "budva");
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
