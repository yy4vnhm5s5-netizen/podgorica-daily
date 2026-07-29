import { env } from "@/config/env";
import { runActiveSeaWaterQualityCollectors } from "@/modules/sea-water-quality/infrastructure/collect-budva-sea-water-quality";
import { createRefreshPostHandler } from "../../refresh-post-handler";
import { toMultiCitySeaWaterQualityRefreshEndpointResult } from "../../provider-refresh-result";

export const POST = createRefreshPostHandler({
  refresh: async () =>
    toMultiCitySeaWaterQualityRefreshEndpointResult(await runActiveSeaWaterQualityCollectors()),
  secret: env.SEA_WATER_QUALITY_REFRESH_SECRET,
});
