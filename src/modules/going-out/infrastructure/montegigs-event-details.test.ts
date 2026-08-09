import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import { parseMonteGigsEventDetail } from "./montegigs-event-details.ts";

const fixtures = join(import.meta.dirname, "__fixtures__");
const kotorSourceUrl =
  "https://staging.montegigs.me/me/events/kotor/7465-20260812-koncert-u-kotoru";
const barSourceUrl =
  "https://staging.montegigs.me/me/events/bar/6453-20260807-ljeto-sa-zvijezdama-savo-perovic-sladja-allegro";

test("prefers matching MusicEvent JSON-LD and preserves its explicit fields", async () => {
  const html = await readFile(join(fixtures, "montegigs-kotor-detail-jsonld.html"), "utf8");

  assert.deepEqual(
    parseMonteGigsEventDetail(html, {
      sourceEventId: "7465",
      sourceUrl: kotorSourceUrl,
      venue: "Pjaca od kina",
    }),
    {
      address: "Trg od kina, Kotor",
      description: "Koncert na otvorenom uz lokalne izvođače i goste večeri.",
      informationUrl: "https://kotorart.me/program/koncert-u-kotoru",
      organizer: "KotorArt",
    },
  );
});

test("uses labelled source HTML when a valid Bar detail page has no MusicEvent JSON-LD", async () => {
  const html = await readFile(join(fixtures, "montegigs-bar-detail-visible.html"), "utf8");

  assert.deepEqual(
    parseMonteGigsEventDetail(html, {
      sourceEventId: "6453",
      sourceUrl: barSourceUrl,
      venue: "Šetalište Kralja Nikole",
    }),
    {
      description:
        "Glazbeno veče uz Savo Perovića i Slađu Allegro u sklopu ljetnjeg programa na Šetalištu kralja Nikole u Baru.",
      informationUrl: "https://www.instagram.com/tobar.me/",
      organizer: "Tourism Organisation of Bar",
    },
  );
});

test("falls back from malformed JSON-LD to labelled HTML and rejects unsafe information links", async () => {
  const html = await readFile(join(fixtures, "montegigs-budva-detail-partial-jsonld.html"), "utf8");

  assert.deepEqual(
    parseMonteGigsEventDetail(html, {
      sourceEventId: "7906",
      sourceUrl: "https://staging.montegigs.me/me/events/budva/7906-20260809-budva-sunset-session",
    }),
    {
      description: "Veče elektronske muzike na otvorenom uz gostujuće izvođače.",
      organizer: "Budva Music Collective",
    },
  );
});

test("uses one semantic visible address when structured address data is absent", () => {
  const html = "<main><address>Njegoševa 12, Kotor</address></main>";

  assert.deepEqual(
    parseMonteGigsEventDetail(html, {
      sourceEventId: "7465",
      sourceUrl: kotorSourceUrl,
      venue: "Pjaca od kina",
    }),
    { address: "Njegoševa 12, Kotor" },
  );
});

test("does not accept a mismatched MusicEvent record or source URL as an information URL", () => {
  const html = `
    <script type="application/ld+json">
      {"@type":"MusicEvent","url":"https://staging.montegigs.me/me/events/kotor/9999-20260812-other","description":"Pogrešan događaj","organizer":{"name":"Pogrešan organizator"}}
    </script>
    <main><h2>Linkovi</h2><a href="${kotorSourceUrl}">Sajt događaja</a></main>
  `;

  assert.deepEqual(
    parseMonteGigsEventDetail(html, {
      sourceEventId: "7465",
      sourceUrl: kotorSourceUrl,
    }),
    {},
  );
});

test("keeps the explicit visible description when it conflicts with JSON-LD", () => {
  const html = `
    <script type="application/ld+json">
      {"@type":"MusicEvent","url":"${kotorSourceUrl}","description":"Zastarjeli strukturirani opis"}
    </script>
    <main><h2>Opis</h2><p>Aktuelni vidljivi opis događaja.</p></main>
  `;

  assert.deepEqual(
    parseMonteGigsEventDetail(html, { sourceEventId: "7465", sourceUrl: kotorSourceUrl }),
    { description: "Aktuelni vidljivi opis događaja." },
  );
});

test("does not turn a performer or an absent description into an organizer or source prose", () => {
  const html = `
    <main>
      <h2>Izvođači</h2><p>Jedan izvođač</p>
      <h2>Opis</h2><p>Pratite MonteGigs na društvenim mrežama</p>
      <address>Pjaca od kina</address>
    </main>
  `;

  assert.deepEqual(
    parseMonteGigsEventDetail(html, {
      sourceEventId: "7465",
      sourceUrl: kotorSourceUrl,
      venue: "Pjaca od kina",
    }),
    {},
  );
});
