import assert from "node:assert/strict";
import test from "node:test";

import type { CityAlert } from "../domain/city-alert.ts";
import type { CedisCacheSnapshot } from "./cedis-cache.ts";
import { getCedisCityAlerts } from "./cedis-city-alerts-provider.ts";

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

const liveAlert: CityAlert = {
  affectedArea: { kind: "source", value: "Konik" },
  cityIds: ["podgorica"],
  dataMode: "live",
  description: { kind: "source", value: "Planned interruption." },
  id: "cedis-konik",
  severity: "information",
  source: { kind: "source", value: "CEDIS" },
  sourceUrl: "https://cedis.me/planirani-radovi/",
  startsAt: new Date("2026-07-17T08:00:00.000Z"),
  status: "scheduled",
  title: { kind: "source", value: "Planirano isključenje struje" },
  type: "powerOutage",
};

const cache = (freshnessStatus: CedisCacheSnapshot["freshnessStatus"]): CedisCacheSnapshot => ({
  alerts: [liveAlert],
  fetchedAt: "2026-07-17T08:00:00.000Z",
  freshnessStatus,
  lastSuccessfulRefreshAt: "2026-07-17T08:00:00.000Z",
  parserWarnings: [],
  schemaVersion: 1,
  source: "CEDIS",
  sourceUrl: "https://cedis.me/servisne-informacije/",
});

test("reads fresh official CEDIS alerts without changing their source URL", async () => {
  const result = await getCedisCityAlerts({
    context,
    mode: "live",
    readCache: async () => cache("fresh"),
  });
  assert.equal(result.freshnessStatus, "fresh");
  assert.equal(result.mode, "live");
  assert.equal(result.alerts[0]?.dataMode, "live");
  assert.equal(result.alerts[0]?.sourceUrl, liveAlert.sourceUrl);
});

test("keeps stale cached CEDIS alerts available with stale metadata", async () => {
  const result = await getCedisCityAlerts({
    context,
    mode: "live",
    readCache: async () => cache("stale"),
  });
  assert.equal(result.freshnessStatus, "stale");
  assert.equal(result.alerts.length, 1);
  assert.equal(result.lastSuccessfulUpdate?.toISOString(), "2026-07-17T08:00:00.000Z");
});

test("reclassifies cached future CEDIS outages as scheduled when the cache is read", async () => {
  const result = await getCedisCityAlerts({
    context,
    mode: "live",
    now: () => new Date("2026-07-21T12:00:00.000Z"),
    readCache: async () => ({
      ...cache("fresh"),
      alerts: [
        {
          ...liveAlert,
          expectedEndAt: new Date("2026-07-22T10:00:00.000Z"),
          startsAt: new Date("2026-07-22T06:00:00.000Z"),
          status: "expired",
        },
      ],
    }),
  });

  assert.equal(result.alerts[0]?.status, "scheduled");
});

test("does not expose a July 4 CEDIS outage as active on July 21", async () => {
  const result = await getCedisCityAlerts({
    context,
    mode: "live",
    now: () => new Date("2026-07-21T12:00:00.000Z"),
    readCache: async () => ({
      ...cache("fresh"),
      alerts: [
        {
          ...liveAlert,
          publishedAt: new Date("2026-07-04T12:00:00.000Z"),
          startsAt: undefined,
          status: "active",
        },
      ],
    }),
  });

  assert.equal(result.alerts[0]?.status, "expired");
});

test("returns unavailable metadata when no live cache exists", async () => {
  const result = await getCedisCityAlerts({ context, mode: "live", readCache: async () => null });
  assert.equal(result.freshnessStatus, "unavailable");
  assert.deepEqual(result.alerts, []);
});

test("uses mock data only when mock mode is explicitly selected", async () => {
  const mockAlert = { ...liveAlert, dataMode: "demo" as const, id: "mock-alert" };
  const result = await getCedisCityAlerts({
    context,
    getMockAlerts: async () => [mockAlert],
    mode: "mock",
    readCache: async () => cache("fresh"),
  });
  assert.equal(result.mode, "mock");
  assert.equal(result.alerts[0]?.id, "mock-alert");
});

test("does not silently fall back to mock data in live or disabled modes", async () => {
  let mockReads = 0;
  const getMockAlerts = async () => {
    mockReads += 1;
    return [liveAlert];
  };
  const live = await getCedisCityAlerts({
    context,
    mode: "live",
    readCache: async () => null,
    getMockAlerts,
  });
  const disabled = await getCedisCityAlerts({ context, mode: "disabled", getMockAlerts });
  assert.equal(live.freshnessStatus, "unavailable");
  assert.equal(disabled.freshnessStatus, "unavailable");
  assert.equal(mockReads, 0);
});
