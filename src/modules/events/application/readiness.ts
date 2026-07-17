import type { EventProviderReadState } from "./get-city-events.ts";

type ReadinessStatus = "degraded" | "ready" | "unavailable";

function getEventsReadiness(providers: readonly EventProviderReadState[]) {
  const unavailableCount = providers.filter(({ state }) => state === "unavailable").length;
  const usableCount = providers.filter(
    ({ state }) => state === "fresh" || state === "stale",
  ).length;
  const status: ReadinessStatus =
    providers.length === 0 || unavailableCount === 0
      ? "ready"
      : usableCount > 0
        ? "degraded"
        : "unavailable";

  return {
    eventProviders: providers.map(({ id, state, status: providerStatus }) => ({
      id,
      state,
      status: providerStatus.qualityHealthState,
    })),
    status,
  };
}

export { getEventsReadiness, type ReadinessStatus };
