import type { CnpRefreshResult } from "./cnp-refresh.ts";

interface CnpCollectorSummary {
  cachePath: string;
  cacheStatus: "fresh" | "stale" | "unavailable";
  completedAt: string;
  detailPagesRequested: number;
  diagnostics?: CnpRefreshResult["diagnostics"];
  errorCode?: CnpRefreshResult["errorCode"];
  lastRefreshError?: string;
  retainedPreviousSnapshot: boolean;
  status: "fresh" | "retained" | "unavailable";
  zeroResultProtectionTriggered: boolean;
}

async function runCnpCollector({
  refresh,
  writeOutput = (line: string) => process.stdout.write(`${line}\n`),
}: {
  refresh: () => Promise<CnpRefreshResult>;
  writeOutput?: (line: string) => void;
}) {
  const result = await refresh();
  const summary = formatCnpCollectorSummary(result);
  writeOutput(JSON.stringify(summary));
  return { exitCode: summary.status === "unavailable" ? 1 : 0, summary };
}

function formatCnpCollectorSummary(result: CnpRefreshResult): CnpCollectorSummary {
  return {
    cachePath: result.cachePath,
    cacheStatus: result.snapshot?.freshnessStatus ?? "unavailable",
    completedAt: result.refreshedAt,
    detailPagesRequested: result.detailPagesRequested,
    diagnostics: result.diagnostics,
    errorCode: result.errorCode,
    lastRefreshError: result.lastRefreshError,
    retainedPreviousSnapshot: result.retainedPreviousSnapshot,
    status:
      result.classification === "fresh"
        ? "fresh"
        : result.retainedPreviousSnapshot
          ? "retained"
          : "unavailable",
    zeroResultProtectionTriggered: result.zeroResultProtectionTriggered,
  };
}

export { formatCnpCollectorSummary, runCnpCollector, type CnpCollectorSummary };
