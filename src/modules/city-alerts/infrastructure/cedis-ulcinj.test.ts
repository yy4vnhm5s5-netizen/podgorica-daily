import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { cedisMunicipalities, isCedisSupportedCityId } from "./cedis-cities.ts";
import { getActiveCedisContexts } from "./collect-cedis.ts";
import { parseCedisArticle } from "./cedis-planned-outages.ts";

// Sanitized from real CEDIS "Planirani radovi na mreži" articles. Both heading forms CEDIS was
// observed to use for Ulcinj are covered, alongside a day it published with no Ulcinj section.
const fixture = async (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

const areasOf = (alerts: readonly { affectedArea: { kind: string; value?: string } }[]) =>
  alerts.map((alert) => (alert.affectedArea.kind === "source" ? alert.affectedArea.value : ""));

const augustSixth = {
  title: "Planirani radovi na mreži za 06. avgust",
  url: "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-06-avgust/",
};
const augustFourth = {
  title: "Planirani radovi na mreži za 04. avgust",
  url: "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-04-avgust/",
};

test("reads the bare 'Ulcinj' heading CEDIS publishes", async () => {
  const alerts = parseCedisArticle(
    augustSixth,
    await fixture("cedis-august-6-ulcinj.html"),
    "ulcinj",
    new Date("2026-08-06T00:00:00Z"),
  );

  assert.equal(alerts.length, 2);
  // Verbatim CEDIS wording. The trailing "•" on the first row is a pre-existing artifact of the
  // shared row splitter (the next row's bullet lands at the end of the previous chunk) and is not
  // Ulcinj-specific — Podgorica and Kotor carry it identically on the same live article. It is
  // asserted here rather than papered over, so a future cross-city fix updates this expectation
  // deliberately.
  assert.deepEqual(areasOf(alerts), [
    "dio Đerana iza Doma zdravlja, Ulica 28. decembra i okolina. •",
    "dio zaseoka Krute Duraku.",
  ]);
});

test("reads the 'Ulcinj:' heading form too", async () => {
  const alerts = parseCedisArticle(
    augustFourth,
    await fixture("cedis-august-4-ulcinj-colon.html"),
    "ulcinj",
    new Date("2026-08-04T00:00:00Z"),
  );

  assert.equal(alerts.length, 1);
  assert.deepEqual(areasOf(alerts), ["dio naselja Lisna Bori prema Osmanovićima."]);
});

test("assigns Ulcinj alone, through the existing city-detection contract", async () => {
  const alerts = parseCedisArticle(
    augustSixth,
    await fixture("cedis-august-6-ulcinj.html"),
    "ulcinj",
    new Date("2026-08-06T00:00:00Z"),
  );

  assert.equal(alerts.length > 0, true);
  for (const alert of alerts) assert.deepEqual(alert.cityIds, ["ulcinj"]);
});

test("never inherits a neighbouring municipality's rows", async () => {
  // Bar sits immediately above the Ulcinj heading and Kotor immediately below it, so a section
  // boundary that ran long would surface here as a leaked area or an extra alert.
  const html = await fixture("cedis-august-6-ulcinj.html");
  const now = new Date("2026-08-06T00:00:00Z");
  const ulcinj = parseCedisArticle(augustSixth, html, "ulcinj", now);
  const kotor = parseCedisArticle(augustSixth, html, "kotor", now);
  const bar = parseCedisArticle(augustSixth, html, "bar", now);

  assert.equal(
    areasOf(ulcinj).some((area) => /Šušanj|Dobrote/u.test(area ?? "")),
    false,
  );
  // ...and the neighbours are equally unaffected in the other direction.
  assert.deepEqual(areasOf(kotor), ["dio Dobrote."]);
  assert.deepEqual(areasOf(bar), ["dio naselja Šušanj."]);
  for (const alert of [...kotor, ...bar]) {
    assert.doesNotMatch(
      alert.affectedArea.kind === "source" ? alert.affectedArea.value : "",
      /Đerana|Krute Duraku/u,
    );
  }
});

test("does not invent an Ulcinj section on a day CEDIS published none", async () => {
  const html = await fixture("cedis-august-5-no-ulcinj.html");
  const article = {
    title: "Planirani radovi na mreži za 05. avgust",
    url: "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-5-avgust/",
  };
  const now = new Date("2026-08-05T00:00:00Z");

  assert.deepEqual(parseCedisArticle(article, html, "ulcinj", now), []);
  // The very same article still yields the municipalities it does contain — an absent Ulcinj
  // section is an ordinary outcome, not a parse failure.
  assert.equal(parseCedisArticle(article, html, "podgorica", now).length, 1);
});

test("uses the existing CEDIS scheduled-day and time semantics unchanged", async () => {
  const alerts = parseCedisArticle(
    augustSixth,
    await fixture("cedis-august-6-ulcinj.html"),
    "ulcinj",
    new Date("2026-08-06T00:00:00Z"),
  );

  // "u terminu od 08:30 do 11 sati" on the article's scheduled day, in Europe/Podgorica (UTC+2 in
  // August) — derived by the shared parser, with no Ulcinj-specific date handling.
  assert.equal(alerts[0].startsAt?.toISOString(), "2026-08-06T06:30:00.000Z");
  assert.equal(alerts[0].expectedEndAt?.toISOString(), "2026-08-06T09:00:00.000Z");
  assert.equal(alerts[1].startsAt?.toISOString(), "2026-08-06T07:00:00.000Z");
  assert.equal(alerts[1].expectedEndAt?.toISOString(), "2026-08-06T12:00:00.000Z");
  assert.equal(alerts[0].type, "powerOutage");
});

test("declares only the heading forms CEDIS was observed to publish", () => {
  assert.deepEqual(cedisMunicipalities.ulcinj.headingVariants, ["Ulcinj"]);
  assert.equal(cedisMunicipalities.ulcinj.cityId, "ulcinj");
  assert.equal(isCedisSupportedCityId("ulcinj"), true);

  // The five existing municipalities keep exactly the variants they had.
  assert.deepEqual(cedisMunicipalities.bar.headingVariants, ["Bar"]);
  assert.deepEqual(cedisMunicipalities.budva.headingVariants, ["Budva", "Opština Budva"]);
  assert.deepEqual(cedisMunicipalities.kotor.headingVariants, ["Kotor"]);
  assert.deepEqual(cedisMunicipalities.podgorica.headingVariants, [
    "Podgorica",
    "Glavni grad Podgorica",
  ]);
  assert.deepEqual(cedisMunicipalities.tivat.headingVariants, ["Tivat", "Opština Tivat"]);
});

test("joins the one existing shared CEDIS collection pass", () => {
  const cityIds = getActiveCedisContexts().map(({ city }) => city.id);

  // Same loop, same single memoized fetch — Ulcinj is picked up because it now declares the
  // electricity capability and has a municipality mapping, not because anything was scheduled.
  assert.equal(cityIds.includes("ulcinj"), true);
  for (const cityId of ["podgorica", "budva", "bar", "kotor", "tivat"] as const) {
    assert.equal(cityIds.includes(cityId), true, cityId);
  }
});
