import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

import {
  assertVodovodKotorUrl,
  discoverVodovodKotorNotices,
  parseVodovodKotorNotice,
  refreshVodovodKotor,
} from "./vodovod-kotor.ts";

const fixture = (name: string) => readFile(join(import.meta.dirname, "__fixtures__", name), "utf8");
const now = new Date("2026-08-01T09:00:00.000Z");

test("discovers allowlisted Vodovod Kotor detail notices from the service listing", async () => {
  const notices = discoverVodovodKotorNotices(await fixture("vodovod-kotor-listing.html"), now);

  assert.deepEqual(
    notices.map(({ url }) => url),
    [
      "https://vodovodkotor.com/servisne-informacije/90/",
      "https://vodovodkotor.com/servisne-informacije/91/",
    ],
  );
  assert.equal(notices[0]?.publishedAt?.toISOString(), "2026-08-01T12:00:00.000Z");
});

test("normalizes tanker schedules separately from water outages", async () => {
  const [notice] = discoverVodovodKotorNotices(await fixture("vodovod-kotor-listing.html"), now);
  assert.ok(notice);
  const parsed = parseVodovodKotorNotice(notice, await fixture("vodovod-kotor-tanker.html"), now);

  assert.equal(parsed.contentRecognized, true);
  assert.deepEqual(
    parsed.alerts.map(({ affectedArea, type }) => [affectedArea.value, type]),
    [
      ["Tabačina", "waterTankerSchedule"],
      ["Plagenti", "waterTankerSchedule"],
    ],
  );
  assert.equal(parsed.alerts[0]?.startsAt?.toISOString(), "2026-08-01T06:00:00.000Z");
});

test("normalizes interruption and drinking-water notices only when an explicit area exists", async () => {
  const notices = discoverVodovodKotorNotices(await fixture("vodovod-kotor-listing.html"), now);
  const interruption = parseVodovodKotorNotice(
    notices[1]!,
    await fixture("vodovod-kotor-interruption.html"),
    now,
  );
  const drinkingWater = parseVodovodKotorNotice(
    {
      title: "Obavještenje o pitkoj vodi u Risnu",
      url: "https://vodovodkotor.com/servisne-informacije/92/",
    },
    await fixture("vodovod-kotor-drinking-water.html"),
    now,
  );

  assert.equal(interruption.alerts[0]?.type, "waterOutage");
  assert.equal(interruption.alerts[0]?.affectedArea.value, "Škaljara");
  assert.equal(drinkingWater.alerts[0]?.type, "drinkingWaterNotice");
  assert.equal(drinkingWater.alerts[0]?.affectedArea.value, "Risna");
});

test("uses the municipality fallback for municipality-wide or ambiguous notices", async () => {
  const municipalityWide = parseVodovodKotorNotice(
    {
      title: "Obavještenje o vodosnabdijevanju",
      url: "https://vodovodkotor.com/servisne-informacije/93/",
    },
    await fixture("vodovod-kotor-municipality-wide.html"),
    now,
  );
  const ambiguous = parseVodovodKotorNotice(
    {
      title: "Obavještenje o vodosnabdijevanju",
      url: "https://vodovodkotor.com/servisne-informacije/94/",
    },
    "<main><h1>Obavještenje o vodosnabdijevanju</h1><p>Zbog otežanog vodosnabdijevanja preduzimaju se mjere.</p></main>",
    now,
  );

  for (const result of [municipalityWide, ambiguous]) {
    assert.equal(result.alerts.length, 1);
    assert.equal(result.alerts[0]?.affectedArea.value, "Opština Kotor");
    assert.deepEqual(result.warnings, []);
    assert.ok(
      result.alerts.every(
        ({ affectedArea }) =>
          !/(?:opštine\s+kotor|području\s+opštine\s+kotor)/i.test(affectedArea.value),
      ),
    );
  }
});

test("keeps structured tanker locations ahead of the municipality fallback", async () => {
  const [notice] = discoverVodovodKotorNotices(await fixture("vodovod-kotor-listing.html"), now);
  assert.ok(notice);

  const parsed = parseVodovodKotorNotice(notice, await fixture("vodovod-kotor-tanker.html"), now);

  assert.deepEqual(
    parsed.alerts.map(({ affectedArea }) => affectedArea.value),
    ["Tabačina", "Plagenti"],
  );
});

test("retains the previous snapshot when every discovered Kotor detail page is unavailable", async () => {
  const listing = await fixture("vodovod-kotor-listing.html");
  const tanker = await fixture("vodovod-kotor-tanker.html");
  let snapshot: Awaited<ReturnType<typeof refreshVodovodKotor>>["snapshot"] = null;
  const cache = {
    read: async () => snapshot,
    write: async (next: NonNullable<typeof snapshot>) => {
      snapshot = next;
    },
  };
  const success = await refreshVodovodKotor({
    cache,
    httpClient: {
      get: async (url) =>
        url === "https://vodovodkotor.com/servisne-informacije/" ? listing : tanker,
    },
    now: () => now,
  });
  const retained = await refreshVodovodKotor({
    cache,
    httpClient: {
      get: async () => {
        throw new Error("upstream unavailable");
      },
    },
    now: () => new Date("2026-08-01T10:00:00.000Z"),
  });

  assert.equal(success.success, true);
  assert.equal(retained.success, false);
  assert.equal(retained.retainedPreviousSnapshot, true);
  assert.equal(retained.snapshot?.alerts.length, 4);
});

test("treats a local cache-write error as a failed refresh without falsely retaining a snapshot", async () => {
  const listing = await fixture("vodovod-kotor-listing.html");
  const tanker = await fixture("vodovod-kotor-tanker.html");
  const result = await refreshVodovodKotor({
    cache: {
      read: async () => null,
      write: async () => {
        throw new Error("disk full");
      },
    },
    httpClient: {
      get: async (url) =>
        url === "https://vodovodkotor.com/servisne-informacije/" ? listing : tanker,
    },
    now: () => now,
  });

  assert.equal(result.success, false);
  assert.equal(result.errorCode, "cache-write-failed");
  assert.equal(result.retainedPreviousSnapshot, false);
  assert.equal(result.snapshot, null);
});

test("rejects a non-Vodovod Kotor host", () => {
  assert.doesNotThrow(() =>
    assertVodovodKotorUrl("https://vodovodkotor.com/servisne-informacije/90/"),
  );
  assert.throws(() => assertVodovodKotorUrl("https://example.test/servisne-informacije/90/"));
});
