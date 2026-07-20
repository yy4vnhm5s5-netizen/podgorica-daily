type RailwayCacheState = "fresh" | "stale" | "unavailable";
type RailwayStationDisplayState = "departures" | "empty" | "stale" | "unavailable";

function getRailwayStationDisplayState({
  departureCount,
  state,
}: {
  departureCount: number;
  state: RailwayCacheState;
}): RailwayStationDisplayState {
  if (departureCount > 0) {
    return state === "stale" ? "stale" : "departures";
  }

  return state === "unavailable" ? "unavailable" : "empty";
}

export {
  getRailwayStationDisplayState,
  type RailwayCacheState,
  type RailwayStationDisplayState,
};
