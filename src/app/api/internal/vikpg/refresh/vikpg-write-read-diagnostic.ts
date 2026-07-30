import {
  readVikpgCache,
  type VikpgCacheSnapshot,
} from "@/modules/city-alerts/infrastructure/vikpg-cache";
import type { VikpgCollectorSummary } from "@/modules/city-alerts/infrastructure/collect-vikpg";

// TEMPORARY (production write/read-path diagnostic — see the VIKPG timestamp investigation).
// Proves whether readVikpgCache() — the exact function getVikpgCityAlerts() (and so the /[city]
// page) reads through — sees the same lastSuccessfulRefreshAt this run just wrote, within the
// same request that wrote it. Safe to delete this whole file, its test, and its one call site in
// route.ts once the write/read path has been verified in production.
interface VikpgWriteReadBackDiagnostic {
  cacheReadBackAlertCount?: number;
  cacheReadBackError?: string;
  cacheReadBackFetchedAt?: string;
  cacheReadBackLastSuccessfulRefreshAt?: string;
  processId: number;
  resolvedCachePath: string;
  writtenLastSuccessfulRefreshAt?: string;
}

async function buildVikpgWriteReadBackDiagnostic({
  getProcessId = () => process.pid,
  readCache = readVikpgCache,
  summary,
}: {
  getProcessId?: () => number;
  readCache?: () => Promise<VikpgCacheSnapshot | null>;
  summary: Pick<VikpgCollectorSummary, "cachePath" | "lastSuccessfulRefreshAt">;
}): Promise<VikpgWriteReadBackDiagnostic> {
  const base = {
    processId: getProcessId(),
    resolvedCachePath: summary.cachePath,
    ...(summary.lastSuccessfulRefreshAt
      ? { writtenLastSuccessfulRefreshAt: summary.lastSuccessfulRefreshAt }
      : {}),
  };

  try {
    const readBack = await readCache();
    // A missing/unreadable snapshot right after a successful write is itself the finding — report
    // it as a diagnostic value, not a thrown error, and never turn the refresh into a failure.
    if (!readBack) return { ...base, cacheReadBackError: "cache-read-back-empty" };

    return {
      ...base,
      cacheReadBackAlertCount: readBack.alerts.length,
      cacheReadBackFetchedAt: readBack.fetchedAt,
      cacheReadBackLastSuccessfulRefreshAt: readBack.lastSuccessfulRefreshAt,
    };
  } catch {
    // Deliberately just a fixed, safe label — never a stack trace, secret, env value, or cache
    // content.
    return { ...base, cacheReadBackError: "cache-read-back-failed" };
  }
}

export { buildVikpgWriteReadBackDiagnostic, type VikpgWriteReadBackDiagnostic };
