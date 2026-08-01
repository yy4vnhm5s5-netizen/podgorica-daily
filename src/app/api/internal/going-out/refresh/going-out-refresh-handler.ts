import { env } from "@/config/env";
import { createCityContext } from "@/shared/config/cities";
import {
  runActiveMonteGigsGoingOutCollectors,
  runMonteGigsGoingOutCollector,
} from "@/modules/going-out/infrastructure/collect-montegigs-going-out";
import { isMonteGigsSupportedCityId } from "@/modules/going-out/infrastructure/montegigs-going-out";

import { createRefreshPostHandler } from "../../refresh-post-handler.ts";
import {
  toGoingOutRefreshEndpointResult,
  toMultiCityGoingOutRefreshEndpointResult,
} from "../../provider-refresh-result.ts";

function createGoingOutRefreshPostHandler({
  runActiveCollectors = runActiveMonteGigsGoingOutCollectors,
  runCollector = runMonteGigsGoingOutCollector,
  secret = env.GOING_OUT_REFRESH_SECRET,
}: {
  runActiveCollectors?: typeof runActiveMonteGigsGoingOutCollectors;
  runCollector?: typeof runMonteGigsGoingOutCollector;
  secret?: string;
} = {}) {
  return createRefreshPostHandler({
    refresh: async (request) => {
      const url = new URL(request.url);
      if (!url.searchParams.has("city")) {
        return toMultiCityGoingOutRefreshEndpointResult(await runActiveCollectors());
      }

      const cityId = url.searchParams.get("city") ?? "";
      if (!isMonteGigsSupportedCityId(cityId)) {
        return {
          acceptedCount: 0,
          cityId,
          errorCode: "montegigs-city-unsupported",
          provider: "montegigs-going-out",
          retainedPreviousSnapshot: false,
          state: "bad-request" as const,
          warnings: ["montegigs-city-unsupported"],
        };
      }

      return toGoingOutRefreshEndpointResult(
        await runCollector({ context: createCityContext(cityId) }),
      );
    },
    secret,
  });
}

export { createGoingOutRefreshPostHandler };
