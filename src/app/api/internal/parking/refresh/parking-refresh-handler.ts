import { env } from "@/config/env";
import { runActiveParkingCollectors } from "@/modules/parking/infrastructure/collect-parking-availability";

import { toParkingRefreshEndpointResult } from "../../provider-refresh-result.ts";
import { createRefreshPostHandler } from "../../refresh-post-handler.ts";

function createParkingRefreshPostHandler({
  runCollectors = runActiveParkingCollectors,
  secret = env.PARKING_REFRESH_SECRET,
}: {
  runCollectors?: typeof runActiveParkingCollectors;
  secret?: string;
} = {}) {
  return createRefreshPostHandler({
    refresh: async () => {
      const [result] = await runCollectors();
      return result
        ? toParkingRefreshEndpointResult(result)
        : createParkingUnavailableEndpointResult();
    },
    secret,
  });
}

function createParkingUnavailableEndpointResult() {
  return {
    acceptedCount: 0,
    cityId: "podgorica",
    provider: "parking-servis-podgorica",
    retainedPreviousSnapshot: false,
    state: "unavailable" as const,
    warnings: [] as const,
  };
}

export { createParkingRefreshPostHandler, createParkingUnavailableEndpointResult };
