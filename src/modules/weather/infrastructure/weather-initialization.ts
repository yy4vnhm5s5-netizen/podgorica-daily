import { getActiveWeatherContexts, runActiveWeatherCollectors } from "./collect-weather.ts";
import { getCachedCurrentWeather } from "./weather-cache.ts";

interface InitializeWeatherSnapshotsDependencies {
  getContexts?: typeof getActiveWeatherContexts;
  log?: (message: string) => void;
  readWeather?: typeof getCachedCurrentWeather;
  refresh?: typeof runActiveWeatherCollectors;
}

async function initializeWeatherSnapshots({
  getContexts = getActiveWeatherContexts,
  log = console.info,
  readWeather = getCachedCurrentWeather,
  refresh = runActiveWeatherCollectors,
}: InitializeWeatherSnapshotsDependencies = {}): Promise<"cache-found" | "failed" | "refreshed"> {
  const contexts = getContexts();
  const cached = await Promise.all(contexts.map((context) => readWeather(context)));
  if (cached.every((result) => result.state !== "unavailable")) {
    log("Weather: usable snapshots found for every active weather city.");
    return "cache-found";
  }

  log("Weather: one or more snapshots are unavailable; provider refresh started.");
  const results = await refresh();
  if (results.some(({ state }) => state === "success")) {
    log("Weather: provider refresh completed.");
    return "refreshed";
  }

  log("Weather: provider refresh failed.");
  return "failed";
}

export { initializeWeatherSnapshots, type InitializeWeatherSnapshotsDependencies };
