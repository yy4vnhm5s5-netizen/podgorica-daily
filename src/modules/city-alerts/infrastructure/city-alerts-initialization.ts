import { ensureCacheDirectory } from "../../../shared/lib/cache.ts";
import type { CityAlertCollectorSummary } from "./city-alerts-collector.ts";

type ProviderInitializationState =
  | "already-running"
  | "cache-found"
  | "failed"
  | "refreshed"
  | "skipped";

interface CityAlertCacheProvider {
  cachePath: string;
  enabled: boolean;
  id: "CEDIS" | "VIK";
  readCache: () => Promise<{ error?: { code: string }; snapshot: unknown | null }>;
  refresh: () => Promise<{ summary: CityAlertCollectorSummary }>;
}

interface CityAlertInitializationSummary {
  providers: {
    alertCount?: number;
    id: CityAlertCacheProvider["id"];
    state: ProviderInitializationState;
  }[];
}

interface InitializeCityAlertCachesDependencies {
  ensureDirectory?: (cachePath: string) => Promise<void>;
  log?: (message: string) => void;
  providers: readonly CityAlertCacheProvider[];
  refreshTimeoutMs?: number;
}

async function initializeCityAlertCaches({
  ensureDirectory = ensureCacheDirectory,
  log = console.info,
  providers,
  refreshTimeoutMs = 45_000,
}: InitializeCityAlertCachesDependencies): Promise<CityAlertInitializationSummary> {
  log("Starting provider initialization...");
  const results = await Promise.all(
    providers.map((provider) =>
      initializeProvider({ ensureDirectory, log, provider, refreshTimeoutMs }),
    ),
  );
  return { providers: results };
}

async function initializeProvider({
  ensureDirectory,
  log,
  provider,
  refreshTimeoutMs,
}: {
  ensureDirectory: (cachePath: string) => Promise<void>;
  log: (message: string) => void;
  provider: CityAlertCacheProvider;
  refreshTimeoutMs: number;
}) {
  if (!provider.enabled) {
    log(`${provider.id}: initialization skipped because the provider is disabled.`);
    return { id: provider.id, state: "skipped" } as const;
  }

  try {
    await ensureDirectory(provider.cachePath);
    const cache = await provider.readCache();
    if (isUsableCacheSnapshot(cache.snapshot, provider.id)) {
      log(`${provider.id}: cache found at ${provider.cachePath}.`);
      return { id: provider.id, state: "cache-found" } as const;
    }

    const reason = cache.error
      ? ` (${cache.error.code})`
      : cache.snapshot
        ? " (cache-unusable)"
        : "";
    log(`${provider.id}: cache missing${reason}; refresh started.`);
    const result = await withTimeout(provider.refresh(), refreshTimeoutMs, provider.id);
    const { summary } = result;
    if (summary.status === "already-running") {
      log(`${provider.id}: refresh already running.`);
      return { id: provider.id, state: "already-running" } as const;
    }
    if (summary.status === "success") {
      log(
        summary.alertCount === 0
          ? `${provider.id}: refresh completed successfully with zero alerts.`
          : `${provider.id}: refresh completed successfully with ${summary.alertCount} alert(s).`,
      );
      return { alertCount: summary.alertCount, id: provider.id, state: "refreshed" } as const;
    }
    if (summary.status === "retained") {
      log(`${provider.id}: refresh retained the previous cache with ${summary.alertCount} alert(s).`);
      return { alertCount: summary.alertCount, id: provider.id, state: "refreshed" } as const;
    }

    log(`${provider.id}: refresh failed${summary.errorCode ? ` (${summary.errorCode})` : ""}.`);
    return { id: provider.id, state: "failed" } as const;
  } catch (error) {
    log(`${provider.id}: initialization failed (${getErrorMessage(error)}).`);
    return { id: provider.id, state: "failed" } as const;
  }
}

function isUsableCacheSnapshot(snapshot: unknown, providerId: CityAlertCacheProvider["id"]) {
  if (!isRecord(snapshot)) return false;

  const cache = snapshot;
  const freshnessStatus = cache.freshnessStatus;
  const lastSuccessfulRefreshAt = cache.lastSuccessfulRefreshAt;
  return (
    (freshnessStatus === "fresh" || freshnessStatus === "stale") &&
    Array.isArray(cache.alerts) &&
    typeof lastSuccessfulRefreshAt === "string" &&
    typeof cache.source === "string" &&
    (providerId === "CEDIS"
      ? cache.source === "CEDIS"
      : cache.source === "Vodovod i kanalizacija Podgorica") &&
    !Number.isNaN(Date.parse(lastSuccessfulRefreshAt))
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function withTimeout<T>(operation: Promise<T>, timeoutMs: number, providerId: string): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${providerId} refresh timed out.`)), timeoutMs);
  });
  return Promise.race([operation, timeoutPromise]).finally(() => {
    if (timeout) clearTimeout(timeout);
  });
}

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown error";
}

export {
  initializeCityAlertCaches,
  type CityAlertCacheProvider,
  type CityAlertCollectorSummary,
  type CityAlertInitializationSummary,
  type InitializeCityAlertCachesDependencies,
};
