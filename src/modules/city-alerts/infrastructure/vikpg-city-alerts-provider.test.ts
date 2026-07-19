import assert from "node:assert/strict";
import test from "node:test";

import type { VikpgCacheSnapshot } from "./vikpg-cache.ts";
import { getVikpgCityAlerts } from "./vikpg-city-alerts-provider.ts";

const context = {
  city: {
    country: "Montenegro",
    displayName: "Podgorica",
    enabled: true,
    id: "podgorica" as const,
    latitude: 42.441,
    longitude: 19.263,
    slug: "podgorica",
    timezone: "Europe/Podgorica",
  },
  locale: "me" as const,
  timezone: "Europe/Podgorica",
};

const snapshot = (freshnessStatus: VikpgCacheSnapshot["freshnessStatus"]): VikpgCacheSnapshot => ({
  alerts: [
    {
      affectedArea: { kind: "source", value: "Zabjelo" },
      cityIds: ["podgorica"],
      dataMode: "live",
      description: { kind: "source", value: "Prekid vodosnabdijevanja." },
      id: "vikpg-zabjelo",
      severity: "warning",
      source: { kind: "source", value: "Vodovod i kanalizacija Podgorica" },
      status: "active",
      title: { kind: "source", value: "Informacija o kvaru" },
      type: "waterOutage",
    },
  ],
  fetchedAt: "2026-07-20T10:00:00.000Z",
  freshnessStatus,
  lastSuccessfulRefreshAt: "2026-07-20T10:00:00.000Z",
  parserWarnings: [],
  schemaVersion: 1,
  source: "Vodovod i kanalizacija Podgorica",
  sourceUrl: "https://vikpg.me/me/mediji/servisne-informacije/obavjestenja.html",
});

test("reads cached VIK alerts only in live mode", async () => {
  const result = await getVikpgCityAlerts({
    context,
    mode: "live",
    readCache: async () => snapshot("fresh"),
  });
  assert.equal(result.freshnessStatus, "fresh");
  assert.equal(result.lastSuccessfulUpdate?.toISOString(), "2026-07-20T10:00:00.000Z");
  assert.equal(result.alerts[0]?.dataMode, "live");
  assert.equal(result.alerts[0]?.type, "waterOutage");
});

test("keeps a stale VIK cache readable and isolates corrupt cache reads", async () => {
  const stale = await getVikpgCityAlerts({
    context,
    mode: "live",
    readCache: async () => snapshot("stale"),
  });
  const unavailable = await getVikpgCityAlerts({
    context,
    mode: "live",
    readCache: async () => {
      throw new Error("bad cache");
    },
  });
  assert.equal(stale.freshnessStatus, "stale");
  assert.equal(stale.lastSuccessfulUpdate?.toISOString(), "2026-07-20T10:00:00.000Z");
  assert.equal(unavailable.freshnessStatus, "unavailable");
  assert.equal(unavailable.lastSuccessfulUpdate, undefined);
  assert.deepEqual(unavailable.alerts, []);
});
