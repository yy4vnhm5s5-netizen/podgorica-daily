import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { normalizeEventCandidate } from "../domain/event-normalization.ts";
import { parseCineplexxProgramme } from "./cineplexx-programme-parser.ts";

const fixturePath = new URL("./__fixtures__/cineplexx-podgorica-rendered.html", import.meta.url);
const context = {
  city: {
    country: "Montenegro",
    id: "podgorica" as const,
    isActive: true,
    isMain: true,
    latitude: 42,
    longitude: 19,
    name: "Podgorica",
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
  locale: "me" as const,
  timezone: "Europe/Podgorica",
};

test("parses rendered Cineplexx programme entries and preserves separate screenings", async () => {
  const candidates = parseCineplexxProgramme(await readFile(fixturePath, "utf8"), {
    today: "2026-07-20",
  });

  assert.equal(candidates.length, 3);
  assert.deepEqual(
    candidates.slice(0, 2).map(({ rawTimeText, rawTitle, source }) => ({
      sourceUrl: source.sourceUrl,
      time: rawTimeText,
      title: rawTitle,
    })),
    [
      {
        sourceUrl: "https://www.cineplexx.me/purchase/wizard/1121-73565",
        time: "16:20",
        title: "Priča o igračkama 5",
      },
      {
        sourceUrl: "https://www.cineplexx.me/purchase/wizard/1121-73566",
        time: "18:30",
        title: "Priča o igračkama 5",
      },
    ],
  );
  assert.deepEqual(candidates[0]?.tags, [
    "movie:https://www.cineplexx.me/film/prica-o-igrackama-5?date=2026-07-20&location=all",
    "format:2D",
    "language:SINH",
    "genre:Komedija, Animirani",
    "duration:1h 42m",
    "hall:Sala 5",
    "cinema:Cineplexx Podgorica",
  ]);
  assert.equal(candidates[0]?.startsAt, "2026-07-20T14:20:00.000Z");
  assert.equal(candidates[1]?.startsAt, "2026-07-20T16:30:00.000Z");

  const first = normalizeEventCandidate(candidates[0]!, context, new Date("2026-07-20T08:00:00Z"));
  const second = normalizeEventCandidate(candidates[1]!, context, new Date("2026-07-20T08:00:00Z"));
  assert.notEqual(first.event?.id, second.event?.id);
});

test("keeps entries with optional Cineplexx metadata missing and skips malformed booking links", async () => {
  const candidates = parseCineplexxProgramme(await readFile(fixturePath, "utf8"), {
    today: "2026-07-20",
  });
  const entry = candidates.find((candidate) => candidate.rawTitle === "Opsesija");

  assert.ok(entry);
  assert.equal(entry.imageUrl, undefined);
  assert.equal(
    entry.tags?.some((tag) => tag.startsWith("format:")),
    false,
  );
  assert.equal(entry.startsAt, "2026-07-20T17:30:00.000Z");
  assert.equal(
    candidates.some((candidate) => candidate.source.sourceUrl.includes("example.test")),
    false,
  );
});

test("does not invent a screening date when the rendered programme lacks its Today marker", async () => {
  const candidates = parseCineplexxProgramme(
    (await readFile(fixturePath, "utf8")).replace("Danas", "Program"),
    { today: "2026-07-20" },
  );

  assert.equal(candidates[0]?.startsAt, undefined);
  assert.equal(candidates[0]?.startDate, undefined);
  assert.ok(candidates[0]?.parserWarnings.includes("Cineplexx programme date was unavailable."));
});
