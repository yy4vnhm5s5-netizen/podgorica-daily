import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { parseCedisArticle } from "./cedis-planned-outages.ts";

// CEDIS marks outage rows with a bullet on some days and a dash on others. The marker introduces
// the row that follows it, so it must be consumed as a row boundary and never end up inside the
// previous row's affected area — nor become an "outage" of its own.
const fixture = async (name: string) =>
  readFile(new URL(`./__fixtures__/${name}`, import.meta.url), "utf8");

const areasOf = (alerts: readonly { affectedArea: { kind: string; value?: string } }[]) =>
  alerts.map((alert) =>
    alert.affectedArea.kind === "source" ? (alert.affectedArea.value ?? "") : "",
  );

const augustSixth = {
  title: "Planirani radovi na mreži za 06. avgust",
  url: "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-06-avgust/",
};
const sixthOfAugust = new Date("2026-08-06T00:00:00Z");

test("a bullet row keeps only its own location, for every affected city", async () => {
  const podgoricaHtml = await fixture("cedis-august-6-podgorica-bullets.html");
  const ulcinjHtml = await fixture("cedis-august-6-ulcinj.html");

  const podgorica = parseCedisArticle(augustSixth, podgoricaHtml, "podgorica", sixthOfAugust);
  const ulcinj = parseCedisArticle(augustSixth, ulcinjHtml, "ulcinj", sixthOfAugust);
  const kotor = parseCedisArticle(augustSixth, podgoricaHtml, "kotor", sixthOfAugust);

  assert.deepEqual(areasOf(podgorica), [
    "Duške, Jablan, Ljevaja, dio Tološa, Ulica Pavla Mijovića.",
    "dio Rogama, dio Donje Gorice i Ird Šume.",
  ]);
  assert.deepEqual(areasOf(ulcinj), [
    "dio Đerana iza Doma zdravlja, Ulica 28. decembra i okolina.",
    "dio zaseoka Krute Duraku.",
  ]);
  assert.deepEqual(areasOf(kotor), ["dio Dobrote."]);
});

test("no affected area ends with a row separator", async () => {
  const html = await fixture("cedis-august-6-podgorica-bullets.html");

  for (const cityId of ["podgorica", "kotor"] as const) {
    for (const area of areasOf(parseCedisArticle(augustSixth, html, cityId, sixthOfAugust))) {
      assert.doesNotMatch(area, /[•–—-]\s*$/u, `${cityId}: "${area}"`);
    }
  }
});

test("a separator never becomes an outage of its own", async () => {
  // The old splitter left the section's leading bullet as a standalone chunk, which became a
  // third "outage" with no readable time and an affected area of just "•".
  const alerts = parseCedisArticle(
    augustSixth,
    await fixture("cedis-august-6-podgorica-bullets.html"),
    "podgorica",
    sixthOfAugust,
  );

  assert.equal(alerts.length, 2);
  for (const alert of alerts) {
    assert.equal(alert.startsAt !== undefined, true, "every row must keep a readable time range");
    assert.doesNotMatch(
      alert.affectedArea.kind === "source" ? alert.affectedArea.value : "",
      /^[•–—-]+$/u,
    );
  }
});

test("both bullet rows keep their own time range", async () => {
  const alerts = parseCedisArticle(
    augustSixth,
    await fixture("cedis-august-6-podgorica-bullets.html"),
    "podgorica",
    sixthOfAugust,
  );

  // 08–15 and 08–17 local (UTC+2 in August), unchanged by the boundary fix.
  assert.equal(alerts[0].startsAt?.toISOString(), "2026-08-06T06:00:00.000Z");
  assert.equal(alerts[0].expectedEndAt?.toISOString(), "2026-08-06T13:00:00.000Z");
  assert.equal(alerts[1].startsAt?.toISOString(), "2026-08-06T06:00:00.000Z");
  assert.equal(alerts[1].expectedEndAt?.toISOString(), "2026-08-06T15:00:00.000Z");
});

test("rows without any separator are unaffected", async () => {
  // The long-standing non-bullet fixture: one municipality per heading, plain rows.
  const alerts = parseCedisArticle(
    { title: "Planirani radovi za 30. mart", url: "https://cedis.me/planirani-radovi-za-30-mart/" },
    await fixture("cedis-podgorica-budva.html"),
    "podgorica",
    new Date("2026-03-30T00:00:00Z"),
  );

  assert.deepEqual(areasOf(alerts), ["Zabjelo."]);
});

test("bullet rows still cannot cross a municipality boundary", async () => {
  const html = await fixture("cedis-august-6-podgorica-bullets.html");
  const podgorica = areasOf(parseCedisArticle(augustSixth, html, "podgorica", sixthOfAugust));
  const kotor = areasOf(parseCedisArticle(augustSixth, html, "kotor", sixthOfAugust));

  assert.equal(
    podgorica.some((area) => area.includes("Dobrote")),
    false,
  );
  assert.equal(
    kotor.some((area) => /Rogama|Tološa/u.test(area)),
    false,
  );
});
