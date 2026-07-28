import { dirname } from "node:path";

import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";

import { defaultBudvaSeaWaterQualityCachePath } from "./budva-sea-water-quality-cache.ts";
import {
  refreshBudvaSeaWaterQuality,
  type BudvaSeaWaterQualityRefreshResult,
} from "./budva-sea-water-quality-refresh.ts";
import { createMorskodobroHttpClient } from "./morskodobro-http-client.ts";

interface BudvaSeaWaterQualityCollectorDependencies {
  cachePath?: string;
  refresh?: () => Promise<BudvaSeaWaterQualityRefreshResult>;
  writeOutput?: (line: string) => void;
}

interface BudvaSeaWaterQualityCollectorResult {
  exitCode: 0 | 1;
  output: string;
  refresh: BudvaSeaWaterQualityRefreshResult | null;
  state: "already-running" | "failed" | "success";
}

async function runBudvaSeaWaterQualityCollector({
  cachePath = defaultBudvaSeaWaterQualityCachePath,
  refresh,
  writeOutput = console.log,
}: BudvaSeaWaterQualityCollectorDependencies = {}): Promise<BudvaSeaWaterQualityCollectorResult> {
  const lock = await acquireRefreshLock(dirname(cachePath), {
    lockFileName: ".budva-sea-water-quality-refresh.lock",
  });
  if (!("release" in lock)) {
    const output = [
      "provider=budva-sea-water-quality",
      "state=already-running",
      "accepted=0",
      "cache=not-run",
      `cache_path=${cachePath}`,
    ].join(" ");
    writeOutput(output);
    return { exitCode: 0, output, refresh: null, state: "already-running" };
  }

  try {
    const result = await (
      refresh ??
      (() =>
        refreshBudvaSeaWaterQuality({
          cachePath,
          httpClient: createMorskodobroHttpClient(),
        }))
    )();
    const state = result.success ? "success" : "failed";
    const cache = result.success
      ? "written"
      : result.retainedPreviousSnapshot
        ? "retained"
        : "unavailable";
    const output = [
      "provider=budva-sea-water-quality",
      `state=${state}`,
      `accepted=${result.totalLocations}`,
      `cache=${cache}`,
      `cache_path=${cachePath}`,
      ...(result.errorCode ? [`error=${result.errorCode}`] : []),
      ...(result.warnings[0] ? [`reason=${formatReason(result.warnings[0])}`] : []),
    ].join(" ");
    writeOutput(output);

    return { exitCode: result.success ? 0 : 1, output, refresh: result, state };
  } finally {
    await lock.release();
  }
}

function formatReason(value: string) {
  return value.replace(/\s+/g, "-").slice(0, 120);
}

if (process.argv[1]?.endsWith("collect-budva-sea-water-quality.ts")) {
  void runBudvaSeaWaterQualityCollector().then(({ exitCode }) => {
    process.exitCode = exitCode;
  });
}

export {
  runBudvaSeaWaterQualityCollector,
  type BudvaSeaWaterQualityCollectorDependencies,
  type BudvaSeaWaterQualityCollectorResult,
};
