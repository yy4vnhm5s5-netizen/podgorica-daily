import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import test from "node:test";

// Structural guarantees that no unit test can express: which modules are allowed to reach the
// backfill, and that no public read path can reach JPMD.
async function readSource(path: string) {
  return readFile(join(process.cwd(), path), "utf8");
}

const backfillModule = "src/modules/sea-water-quality/infrastructure/sea-water-quality-history-backfill.ts";

const publicReadPaths = [
  "src/app/[city]/plaze/page.tsx",
  "src/app/[city]/plaze/[slug]/page.tsx",
  "src/app/sitemap.ts",
  "src/modules/sea-water-quality/application/get-sea-water-quality-history.ts",
  "src/modules/sea-water-quality/application/get-budva-sea-water-quality.ts",
];

test("backfill never writes the current sea-water snapshot", async () => {
  const source = await readSource(backfillModule);

  // The current-snapshot writer must not even be reachable from this module.
  assert.doesNotMatch(source, /writeBudvaSeaWaterQualityCache/u);
  assert.doesNotMatch(source, /mergeSeaWaterQualityHistory\b(?!Backfill)/u);
  assert.match(source, /writeSeaWaterQualityHistoryCache/u);
  assert.match(source, /mergeSeaWaterQualityHistoryBackfill/u);
});

test("backfill is reachable only from the authenticated endpoint and the manual CLI", async () => {
  const [route, cli] = await Promise.all([
    readSource("src/app/api/internal/sea-water-quality/backfill/route.ts"),
    readSource("src/modules/sea-water-quality/infrastructure/collect-sea-water-quality-history.ts"),
  ]);

  assert.match(route, /createRefreshPostHandler/u);
  assert.match(route, /secret: env\.SEA_WATER_QUALITY_REFRESH_SECRET/u);
  assert.match(route, /backfillSeaWaterQualityHistory/u);
  assert.match(cli, /backfillSeaWaterQualityHistory/u);
  // No second secret was invented for this operation.
  assert.doesNotMatch(route, /BACKFILL_SECRET/u);
});

test("no public read path performs a JPMD request", async () => {
  for (const path of publicReadPaths) {
    const source = await readSource(path);

    assert.doesNotMatch(source, /morskodobro/iu, `${path} must not reference the JPMD host`);
    assert.doesNotMatch(source, /backfillSeaWaterQualityHistory/u, `${path} must not backfill`);
    assert.doesNotMatch(source, /createMorskodobroHttpClient/u, `${path} must not build a client`);
    assert.doesNotMatch(source, /refreshBudvaSeaWaterQuality/u, `${path} must not refresh`);
  }
});

test("the sitemap derives sea-water URLs from local history only", async () => {
  const sitemap = await readSource("src/app/sitemap.ts");

  assert.match(sitemap, /getSeaWaterQualityLocationSlugs|getSeaWaterQualityHistory/u);
  assert.doesNotMatch(sitemap, /fetch\(/u);
});
