import assert from "node:assert/strict";
import test from "node:test";

import { getPowerOutages } from "../application/get-power-outages.ts";
import { getRelevantPowerOutages } from "../application/power-outage-selection.ts";
import { getCedisCachePath, readCedisCache } from "./cedis-cache.ts";
import { cedisMunicipalities } from "./cedis-cities.ts";
import { cedisProviderMetadata, getCedisCityAlerts } from "./cedis-city-alerts-provider.ts";
import { createCityContext } from "../../../shared/config/cities.ts";
import type { CacheFileSystem } from "../../../shared/lib/cache.ts";

// The snapshot a successful Ulcinj collection writes: one accepted outage from the real
// 6 August CEDIS article, serialized exactly as writeCedisCache stores it.
const ulcinjSnapshot = {
  alerts: [
    {
      affectedArea: { kind: "source", value: "dio zaseoka Krute Duraku." },
      cityIds: ["ulcinj"],
      dataMode: "live",
      description: { kind: "source", value: "Planirani prekid od u terminu od 09 do 14 sati." },
      expectedEndAt: "2026-08-06T12:00:00.000Z",
      id: "ulcinj-alert-1",
      publishedAt: "2026-08-06T12:00:00.000Z",
      severity: "information",
      source: { kind: "source", value: "CEDIS" },
      sourceUrl: "https://cedis.me/servisne-informacije/planirani-radovi-na-mrezi-za-06-avgust/",
      startsAt: "2026-08-06T07:00:00.000Z",
      status: "active",
      title: { kind: "source", value: "Planirano isključenje struje" },
      type: "powerOutage",
    },
  ],
  cityId: "ulcinj",
  fetchedAt: "2026-08-06T06:00:00.000Z",
  freshnessStatus: "fresh",
  lastSuccessfulRefreshAt: "2026-08-06T06:00:00.000Z",
  parserWarnings: [],
  schemaVersion: 1,
  source: "CEDIS",
  sourceUrl: "https://cedis.me/servisne-informacije/",
};

// Only readFile is exercised; the rest of the interface throws so an unexpected write is loud.
const cacheContaining = (path: string, contents: string): CacheFileSystem => ({
  mkdir: async () => assert.fail("read path must not create directories"),
  readFile: async (requested) => {
    if (requested !== path) {
      const error = Object.assign(new Error(`ENOENT: ${requested}`), { code: "ENOENT" });
      throw error;
    }
    return contents;
  },
  rename: async () => assert.fail("read path must not write"),
  rm: async () => assert.fail("read path must not write"),
  writeFile: async () => assert.fail("read path must not write"),
});

const duringTheOutage = new Date("2026-08-06T08:00:00.000Z");

const readUlcinjAlerts = (now = duringTheOutage) => {
  const path = getCedisCachePath("ulcinj");
  const fileSystem = cacheContaining(path, JSON.stringify(ulcinjSnapshot));
  return getCedisCityAlerts({
    context: createCityContext("ulcinj", "me"),
    mode: "live",
    now: () => now,
    readCache: (cityId) => readCedisCache(getCedisCachePath(cityId), fileSystem, cityId),
  });
};

test("the collector's snapshot path is the path the reader opens", () => {
  // Writer and reader both derive it from the same helper, so this pins the shared filename.
  assert.match(getCedisCachePath("ulcinj"), /cedis-planned-outages-ulcinj\.json$/u);
  assert.notEqual(getCedisCachePath("ulcinj"), getCedisCachePath("podgorica"));
});

test("read coverage never falls behind collection coverage", () => {
  // The regression itself: this gate is checked before the snapshot is opened, so any city the
  // collector writes for must be readable, or the page reports "unavailable" for data that exists.
  const collected = Object.values(cedisMunicipalities).map(({ cityId }) => cityId);

  for (const cityId of collected) {
    assert.equal(
      cedisProviderMetadata.supportedCityIds?.includes(cityId),
      true,
      `${cityId} is collected but would be refused on read`,
    );
  }
  assert.equal(cedisProviderMetadata.supportedCityIds?.includes("ulcinj"), true);
});

test("a stored Ulcinj snapshot survives schema validation and the city gate", async () => {
  const result = await readUlcinjAlerts();

  // Freshness is computed from the snapshot age against the real clock, so only the distinction
  // that matters here is pinned: "unavailable" is what the bug produced, and it must not recur.
  // fresh-vs-stale is a function of when the suite runs and is deliberately not asserted.
  assert.notEqual(result.freshnessStatus, "unavailable");
  assert.equal(result.alerts.length, 1);
  assert.deepEqual(result.alerts[0].cityIds, ["ulcinj"]);
  assert.equal(result.alerts[0].startsAt?.toISOString(), "2026-08-06T07:00:00.000Z");
  assert.equal(result.alerts[0].expectedEndAt?.toISOString(), "2026-08-06T12:00:00.000Z");
  assert.equal(result.alerts[0].status, "active");
});

test("refresh accepted 1 Ulcinj outage → /ulcinj/struja returns 1 relevant outage", async () => {
  // End-to-end over the same loader the route calls, with only the filesystem injected.
  const result = await getPowerOutages(createCityContext("ulcinj", "me"), {
    getCedisData: () => readUlcinjAlerts(),
  });

  assert.equal(result.status, "available");
  assert.notEqual(result.freshnessStatus, "unavailable");
  assert.equal(result.outages.length, 1);
  assert.equal(
    result.outages[0].affectedArea.kind === "source" ? result.outages[0].affectedArea.value : "",
    "dio zaseoka Krute Duraku.",
  );
});

test("the dashboard City Services strip selects the same outage", async () => {
  const { alerts } = await readUlcinjAlerts();

  assert.equal(getRelevantPowerOutages(alerts, "ulcinj").length, 1);
  // ...and it stays scoped to Ulcinj.
  assert.equal(getRelevantPowerOutages(alerts, "kotor").length, 0);
});

test("an absent snapshot still reports unavailable rather than an empty success", async () => {
  const missing = cacheContaining("/nowhere.json", "{}");
  const result = await getPowerOutages(createCityContext("ulcinj", "me"), {
    getCedisData: () =>
      getCedisCityAlerts({
        context: createCityContext("ulcinj", "me"),
        mode: "live",
        now: () => duringTheOutage,
        readCache: (cityId) => readCedisCache(getCedisCachePath(cityId), missing, cityId),
      }),
  });

  // A missing snapshot must never render as "no planned outages".
  assert.equal(result.status, "unavailable");
  assert.equal(result.freshnessStatus, "unavailable");
});
