import { dirname } from "node:path";

import { acquireRefreshLock } from "../../../shared/lib/refresh-lock.ts";
import { createCityContext, getActiveCities, supportsCityCapability } from "@/shared/config/cities";
import type { City, CityContext, CityId } from "@/shared/types/city";
import type { CityAlertCollectorResult } from "./city-alerts-collector.ts";
import { getCedisCityId } from "./cedis-cities.ts";
import {
  defaultCachePath,
  getCedisCachePath,
  readCedisCache,
  writeCedisCache,
} from "./cedis-cache.ts";
import {
  createCedisHttpClient,
  type CedisHttpClient,
  type CedisHttpDocument,
} from "./cedis-http-client.ts";
import { refreshCedis, type RefreshResult } from "./cedis-refresh.ts";

interface CollectorDependencies {
  cachePath?: string;
  context?: CityContext;
  httpClient?: CedisHttpClient;
  refresh?: () => Promise<RefreshResult>;
  writeOutput?: (line: string) => void;
}

interface ActiveCedisCollectorDependencies {
  cities?: readonly City[];
  createContext?: (cityId: CityId) => CityContext;
  httpClient?: CedisHttpClient;
  runCollector?: (context: CityContext, httpClient: CedisHttpClient) => Promise<CollectorResult>;
}

type CollectorResult = CityAlertCollectorResult;

async function runCedisCollector({
  cachePath,
  context = createCityContext("podgorica"),
  httpClient = createCedisHttpClient(),
  refresh,
  writeOutput = console.log,
}: CollectorDependencies = {}): Promise<CollectorResult> {
  const cityId = getCedisCityId(context);
  if (!cityId) {
    const summary: CollectorResult["summary"] = {
      alertCount: 0,
      cachePath: cachePath ?? defaultCachePath,
      cacheStatus: "unavailable",
      cityId: context.city.id,
      completedAt: new Date().toISOString(),
      errorCode: "cedis-city-unsupported",
      retainedPreviousSnapshot: false,
      status: "unavailable",
      warnings: ["cedis-city-unsupported"],
    };
    writeOutput(JSON.stringify({ ...summary, cityId: context.city.id }));
    return { exitCode: 1, summary };
  }
  const resolvedCachePath = cachePath ?? getCedisCachePath(cityId);
  const lock = await acquireRefreshLock(dirname(resolvedCachePath), {
    lockFileName: `.cedis-refresh-${cityId}.lock`,
  });
  if (!("release" in lock)) {
    const summary: CollectorResult["summary"] = {
      alertCount: 0,
      cachePath: resolvedCachePath,
      cacheStatus: "unavailable",
      cityId,
      completedAt: new Date().toISOString(),
      retainedPreviousSnapshot: false,
      status: "already-running",
      warnings: [],
    };
    writeOutput(JSON.stringify(summary));
    return { exitCode: 0, summary };
  }

  try {
    const result = await (
      refresh ??
      (() =>
        refreshCedis({
          cache: {
            read: () => readCedisCache(resolvedCachePath, undefined, cityId),
            write: (snapshot) => writeCedisCache(snapshot, resolvedCachePath),
          },
          context,
          httpClient,
        }))
    )();
    const retainedPreviousSnapshot = result.retainedPreviousSnapshot;
    const summary: CollectorResult["summary"] = {
      alertCount: result.snapshot?.alerts.length ?? 0,
      cachePath: resolvedCachePath,
      cacheStatus: result.snapshot?.freshnessStatus ?? "unavailable",
      cityId,
      completedAt: new Date().toISOString(),
      ...(result.errorCode ? { errorCode: result.errorCode } : {}),
      retainedPreviousSnapshot,
      status: result.success ? "success" : retainedPreviousSnapshot ? "retained" : "unavailable",
      warnings: result.warnings,
    };
    writeOutput(JSON.stringify(summary));
    return { exitCode: result.success || retainedPreviousSnapshot ? 0 : 1, summary };
  } finally {
    await lock.release();
  }
}

function getActiveCedisContexts(
  cities: readonly City[] = getActiveCities(),
  createContext: (cityId: CityId) => CityContext = createCityContext,
) {
  return cities
    .filter(
      (city) =>
        city.isActive &&
        supportsCityCapability(city, "electricity") &&
        Boolean(getCedisCityId(city.id)),
    )
    .map((city) => createContext(city.id));
}

function createMemoizedCedisHttpClient(client: CedisHttpClient): CedisHttpClient {
  const documents = new Map<string, Promise<CedisHttpDocument>>();
  const getDocument = (url: string) => {
    const existing = documents.get(url);
    if (existing) return existing;
    const request = client.getDocument
      ? client.getDocument(url)
      : client.get(url).then((html) => ({ finalUrl: url, html, status: 200 }));
    documents.set(url, request);
    return request;
  };
  return { get: async (url) => (await getDocument(url)).html, getDocument };
}

async function runActiveCedisCollectors({
  cities,
  createContext,
  httpClient = createCedisHttpClient(),
  runCollector = (context, client) => runCedisCollector({ context, httpClient: client }),
}: ActiveCedisCollectorDependencies = {}) {
  const sharedHttpClient = createMemoizedCedisHttpClient(httpClient);
  const results: CollectorResult[] = [];
  for (const context of getActiveCedisContexts(cities, createContext)) {
    results.push(await runCollector(context, sharedHttpClient));
  }
  return results;
}

if (process.argv[1]?.endsWith("collect-cedis.ts")) {
  void runActiveCedisCollectors().then((results) => {
    process.exitCode = results.some(({ exitCode }) => exitCode !== 0) ? 1 : 0;
  });
}

export {
  createMemoizedCedisHttpClient,
  getActiveCedisContexts,
  runActiveCedisCollectors,
  runCedisCollector,
  type ActiveCedisCollectorDependencies,
  type CollectorDependencies,
  type CollectorResult,
};
