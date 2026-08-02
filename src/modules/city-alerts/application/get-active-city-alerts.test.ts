import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import test from "node:test";

import {
  getVodovodKotorCityAlerts,
  readVodovodKotorCache,
  refreshVodovodKotor,
  vodovodKotorServiceInformationUrl,
  writeVodovodKotorCache,
} from "@/modules/city-alerts/infrastructure/vodovod-kotor";
import { createCityContext } from "@/shared/config/cities";
import type { CityAlertServiceId } from "./city-alert-service-capabilities.ts";

import { getActiveCityAlerts } from "./get-active-city-alerts.ts";

test("requests only electricity data for an electricity-only city", async () => {
  const requestedServiceIds: CityAlertServiceId[][] = [];

  const result = await getActiveCityAlerts(createCityContext("bar"), {
    getProviderData: async (_context, serviceIds) => {
      requestedServiceIds.push([...(serviceIds ?? [])]);
      return [{ alerts: [], freshnessStatus: "fresh", mode: "live" }, undefined];
    },
  });

  assert.deepEqual(requestedServiceIds, [["power"]]);
  assert.equal(result.status, "empty");
  assert.ok("metadata" in result);
  assert.deepEqual(
    result.metadata.sources.map(({ id }) => id),
    ["cedis"],
  );
});

function createTomorrowTankerHtml(now: Date) {
  const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const month = [
    "januar",
    "februar",
    "mart",
    "april",
    "maj",
    "jun",
    "jul",
    "avgust",
    "septembar",
    "oktobar",
    "novembar",
    "decembar",
  ][tomorrow.getUTCMonth()];
  const date = `${tomorrow.getUTCDate()}. ${month} ${tomorrow.getUTCFullYear()}.`;

  const detail = `<main><h1>Raspored cisterni za ${date}</h1><p>Distribucija pitke vode putem cisterni.</p><table><tr><th>Vrijeme</th><th>Lokacija</th></tr><tr><td>08:00 – 12:00</td><td>Tabačina</td></tr><tr><td>14:00 – 18:00</td><td>Plagenti</td></tr></table></main>`;

  return {
    detail,
    detailWithThreeRows: detail.replace(
      "</table>",
      "<tr><td>19:00 – 21:00</td><td>Dobrota</td></tr></table>",
    ),
    listing: `<main><h1>Servisne informacije</h1>${Array.from(
      { length: 16 },
      (_, index) =>
        `<article><time>${date}</time><h2><a href="/servisne-informacije/${index + 1}/">Raspored cisterni za ${date}</a></h2></article>`,
    ).join("")}</main>`,
  };
}

test("a successful Kotor Vodovod snapshot remains available through the public City Alerts read path", async () => {
  const cacheDirectory = await mkdtemp(join(tmpdir(), "gradom-vodovod-kotor-read-path-"));
  const cachePath = join(cacheDirectory, "cache", "vodovod-kotor-water-alerts.json");
  const context = createCityContext("kotor");
  const now = new Date();
  const html = createTomorrowTankerHtml(now);

  try {
    const refresh = await refreshVodovodKotor({
      cache: {
        read: () => readVodovodKotorCache(cachePath),
        write: (snapshot) => writeVodovodKotorCache(snapshot, cachePath),
      },
      httpClient: {
        get: async (url) => {
          if (url === vodovodKotorServiceInformationUrl) return html.listing;
          const noticeNumber = Number(/\/(\d+)\/$/.exec(url)?.[1]);
          return noticeNumber <= 8 ? html.detailWithThreeRows : html.detail;
        },
      },
      now: () => now,
    });
    assert.equal(refresh.success, true);
    assert.equal(refresh.snapshot?.alerts.length, 32);

    const snapshot = await readVodovodKotorCache(cachePath);
    assert.ok(snapshot);
    assert.equal(snapshot.alerts.length, 32);
    assert.ok(
      snapshot.alerts.every((alert) => alert.cityIds.length === 1 && alert.cityIds[0] === "kotor"),
    );
    assert.equal(snapshot.freshnessStatus, "fresh");

    const water = await getVodovodKotorCityAlerts({
      context,
      mode: "live",
      now: () => now,
      readCache: () => readVodovodKotorCache(cachePath),
    });
    assert.equal(water.freshnessStatus, "fresh");
    assert.equal(water.alerts.length, 32);

    const result = await getActiveCityAlerts(context, {
      getProviderData: async () => [
        { alerts: [], freshnessStatus: "unavailable", mode: "disabled" },
        water,
      ],
    });
    assert.equal(result.status, "success");
    assert.ok("data" in result);
    assert.equal(result.data.length, 32);
    assert.equal(
      result.metadata.sources.find((source) => source.id === "vodovod-kotor")?.freshnessStatus,
      "fresh",
    );
  } finally {
    await rm(cacheDirectory, { force: true, recursive: true });
  }
});
