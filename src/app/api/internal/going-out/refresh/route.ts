import { createCityContext } from "@/shared/config/cities";
import { env } from "@/config/env";
import { runMonteGigsGoingOutCollector } from "@/modules/going-out/infrastructure/collect-montegigs-going-out";
import { isMonteGigsSupportedCityId } from "@/modules/going-out/infrastructure/montegigs-going-out";
import { createRefreshPostHandler } from "../../refresh-post-handler";
import { toGoingOutRefreshEndpointResult } from "../../provider-refresh-result";

export const POST = createRefreshPostHandler({
  refresh: async (request) => {
    const cityId = new URL(request.url).searchParams.get("city") ?? "podgorica";
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
      await runMonteGigsGoingOutCollector({ context: createCityContext(cityId) }),
    );
  },
  secret: env.GOING_OUT_REFRESH_SECRET,
});
