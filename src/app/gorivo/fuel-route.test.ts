import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import { getFuelPricesPath } from "@/shared/config/public-routes";
import { getFuelSitemapEntry } from "../sitemap.ts";
import { createFuelRefreshPostHandler } from "../api/internal/fuel/refresh/fuel-refresh-handler.ts";

const routeSource = async () => readFile(new URL("./page.tsx", import.meta.url), "utf8");
const pageUrl = new URL("../../modules/fuel/presentation/fuel-prices-page.tsx", import.meta.url);
const pageSource = async () => readFile(pageUrl, "utf8");

test("the fuel route is a single national URL", () => {
  assert.equal(getFuelPricesPath(), "/gorivo");
});

test("metadata is evergreen and self-canonical", async () => {
  const source = await routeSource();

  assert.match(source, /canonical: getFuelPricesPath\(\)/u);
  assert.match(source, /getPageTitle\("Cijene goriva u Crnoj Gori"\)/u);
  // No year, no price and no day in the title or description: they survive every recalculation.
  assert.doesNotMatch(source, /title:[^\n]*20\d\d/u);
  assert.doesNotMatch(source, /description:[^\n]*\b\d,\d\d\b/u);
});

test("the page is rendered per request rather than baked into the build", async () => {
  assert.match(await routeSource(), /export const revalidate = 0;/u);
});

test("a disabled feature has no page and no sitemap URL", async () => {
  const source = await routeSource();

  assert.match(source, /if \(!isFeatureEnabled\("fuelPrices"\)\) notFound\(\);/u);
  assert.deepEqual(await getFuelSitemapEntry(undefined, false), []);
});

test("the sitemap lists /gorivo exactly once", async () => {
  const entries = await getFuelSitemapEntry(
    async () => ({ calculations: [], freshnessStatus: "unavailable" }),
    true,
  );

  assert.equal(entries.length, 1);
  assert.equal(entries.filter(({ url }) => url.endsWith("/gorivo")).length, 1);
});

test("sitemap lastModified is the effective date, not the run time", async () => {
  const entries = await getFuelSitemapEntry(
    async () => ({
      calculations: [
        {
          effectiveDate: "2026-08-04",
          prices: [{ priceCents: 175, productId: "eurosuper95" }],
          publishedAt: "2026-08-03",
          sourceName: "Ministarstvo energetike i rudarstva",
          sourceUrl: "https://www.gov.me/clanak/nove-cijene-goriva-od-04082026",
        },
      ],
      freshnessStatus: "fresh",
      lastSuccessfulUpdate: new Date("2026-08-05T04:17:00.000Z"),
    }),
    true,
  );

  const lastModified = entries[0]?.lastModified;
  assert.ok(lastModified instanceof Date);
  assert.equal(lastModified.toISOString(), "2026-08-04T00:00:00.000Z");
});

test("an unreadable snapshot still yields the URL, just without a claimed date", async () => {
  const entries = await getFuelSitemapEntry(async () => {
    throw new Error("cache unavailable");
  }, true);

  assert.equal(entries.length, 1);
  assert.equal(entries[0]?.lastModified, undefined);
});

const secret = "fuel-refresh-secret-token-for-tests-0001";

const refreshRequest = (token?: string) =>
  new Request("https://gradom.me/api/internal/fuel/refresh", {
    method: "POST",
    ...(token ? { headers: { authorization: `Bearer ${token}` } } : {}),
  });

test("the refresh endpoint runs the collector only for an authorized caller", async () => {
  let runs = 0;
  const handler = createFuelRefreshPostHandler({
    runCollector: async () => {
      runs += 1;
      return {
        exitCode: 0 as const,
        summary: {
          cachePath: "/app/.runtime/cache/fuel-prices.json",
          cacheStatus: "stale" as const,
          calculationCount: 2,
          completedAt: "2026-08-05T04:17:00.000Z",
          retainedPreviousSnapshot: false,
          status: "success" as const,
          warnings: ["latest-calculation-validity-ended"],
        },
      };
    },
    token: secret,
  });

  const response = await handler(refreshRequest(secret));
  assert.equal(response.status, 200);
  assert.equal(runs, 1);
  assert.deepEqual(await response.json(), {
    acceptedCount: 2,
    provider: "fuel-prices",
    retainedPreviousSnapshot: false,
    state: "success",
    warnings: ["latest-calculation-validity-ended"],
  });
});

test("the refresh endpoint rejects a missing or wrong secret without collecting", async () => {
  let runs = 0;
  const handler = createFuelRefreshPostHandler({
    runCollector: async () => {
      runs += 1;
      return {
        exitCode: 0 as const,
        summary: {
          cachePath: "/app/.runtime/cache/fuel-prices.json",
          cacheStatus: "fresh" as const,
          calculationCount: 2,
          completedAt: "2026-08-05T04:17:00.000Z",
          retainedPreviousSnapshot: false,
          status: "success" as const,
          warnings: [],
        },
      };
    },
    token: secret,
  });

  assert.equal((await handler(refreshRequest())).status, 401);
  assert.equal((await handler(refreshRequest("wrong-token-of-the-same-length-00001"))).status, 401);
  // The collector never ran, so an unauthenticated caller cannot make us hit the ministry.
  assert.equal(runs, 0);
});

test("the page never claims a freshness the snapshot does not have", async () => {
  const source = await pageSource();

  assert.match(source, /result\.freshnessStatus === "stale"/u);
  assert.match(source, /result\.freshnessStatus === "unavailable"/u);
  // A retained snapshot keeps showing the last official prices instead of an error page.
  assert.match(source, /Prikazani su posljednji dostupni zvanični podaci\./u);
});

test("the page displays stored source business dates without deriving them", async () => {
  const source = await pageSource();

  assert.match(source, /formatDay\(current\.effectiveDate, locale\)/u);
  assert.match(source, /formatDay\(current\.nextCalculationDate, locale\)/u);
});

test("the cache keeps full history while the page shows a bounded slice", async () => {
  const source = await pageSource();

  assert.match(source, /const historyRowLimit = 12;/u);
  assert.match(source, /result\.calculations\.slice\(0, historyRowLimit\)/u);
  // Chart and table read that one slice, so the two views cannot disagree.
  assert.match(source, /calculations=\{visible\}/u);
  assert.match(source, /\{visible\.map\(\(calculation\) => \(/u);
});
