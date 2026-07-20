import { ensureCacheDirectory } from "../../../shared/lib/cache.ts";
import { emitInfoMessage } from "./event-refresh-logger.ts";
import type { EventRefreshSummary } from "./events-refresh-runner.ts";

type EventProviderId = "cineplexx-podgorica" | "cnp" | "glavni-grad-podgorica" | "kic" | "tourism-podgorica";

type EventInitializationState = "cache-found" | "failed" | "refreshed" | "skipped";

interface EventCacheProvider {
  cachePath: string;
  enabled: boolean;
  id: EventProviderId;
  readCache: () => Promise<unknown | null>;
}

interface EventInitializationSummary {
  providers: {
    id: EventProviderId;
    state: EventInitializationState;
  }[];
  refresh?: EventRefreshSummary;
}

interface InitializeEventCachesDependencies {
  ensureDirectory?: (cachePath: string) => Promise<void>;
  log?: (message: string) => void;
  providers: readonly EventCacheProvider[];
  refresh: () => Promise<EventRefreshSummary>;
}

async function initializeEventCaches({
  ensureDirectory = ensureCacheDirectory,
  log = emitInfoMessage,
  providers,
  refresh,
}: InitializeEventCachesDependencies): Promise<EventInitializationSummary> {
  log("Events: cache initialization started.");

  const initialized = await Promise.all(
    providers.map(async (provider) => initializeProvider({ ensureDirectory, log, provider })),
  );
  const requiresRefresh = initialized.some(({ state }) => state === "failed");

  if (!requiresRefresh) {
    log("Events: usable caches found; initialization refresh skipped.");
    return { providers: initialized };
  }

  log("Events: one or more caches are unavailable; refresh started.");
  try {
    const summary = await refresh();
    log(`Events: refresh completed with state ${summary.state}.`);
    return {
      providers: initialized.map(({ id, state }) => {
        const providerRefresh = summary.providers.find((provider) => provider.id === id);
        return {
          id,
          state:
            state === "failed" &&
            (providerRefresh?.state === "success" || providerRefresh?.state === "retained")
              ? "refreshed"
              : state,
        };
      }),
      refresh: summary,
    };
  } catch {
    log("Events: initialization refresh failed.");
    return { providers: initialized };
  }
}

async function initializeProvider({
  ensureDirectory,
  log,
  provider,
}: {
  ensureDirectory: (cachePath: string) => Promise<void>;
  log: (message: string) => void;
  provider: EventCacheProvider;
}) {
  if (!provider.enabled) {
    log(`Events/${provider.id}: initialization skipped because the provider is disabled.`);
    return { id: provider.id, state: "skipped" } as const;
  }

  try {
    await ensureDirectory(provider.cachePath);
    if (await provider.readCache()) {
      log(`Events/${provider.id}: cache found at ${provider.cachePath}.`);
      return { id: provider.id, state: "cache-found" } as const;
    }

    log(`Events/${provider.id}: cache unavailable at ${provider.cachePath}.`);
    return { id: provider.id, state: "failed" } as const;
  } catch {
    log(`Events/${provider.id}: cache initialization failed.`);
    return { id: provider.id, state: "failed" } as const;
  }
}

export {
  initializeEventCaches,
  type EventCacheProvider,
  type EventInitializationSummary,
  type InitializeEventCachesDependencies,
};
